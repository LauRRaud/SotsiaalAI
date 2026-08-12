/**
 * T25 ORG-FOUNDATION-V1 — organisatsiooni elutsükkel ja moodulid (E3).
 *
 * ELUTSÜKKEL: DRAFT → PENDING_VERIFICATION → ACTIVE, kõrvalharudena SUSPENDED ja
 * terminalina ARCHIVED. Arhiveeritut ei äratata ellu (arenduskava §5.1) — see ei
 * ole piirang mugavuse pärast, vaid selleks, et arhiveerimise järel ei saaks
 * vanad õigused vaikselt tagasi tulla.
 *
 * KES MIDA TOHIB:
 *   - loomine ja verifitseerimisele saatmine: kasutaja ise / `ORG_OWNER`;
 *   - ACTIVE-ks kinnitamine ja peatamine: AINULT platvormi admin, sest see on
 *     identiteedikontroll (arenduskava §7.1, §10 aktiveerimisvärav);
 *   - arhiveerimine: `ORG_OWNER` või platvormi admin.
 *
 * DB tagab lisaks CHECK-iga, et ACTIVE ilma `verifiedAt`-ita on võimatu ka siis,
 * kui keegi kirjutab mööda seda moodulit.
*/

import { createHash } from "node:crypto";

import prisma from "@/lib/prisma";

import {
  OrganizationCapability,
  OrganizationCapabilityScopeType,
  OrganizationMembershipStatus,
  OrganizationModuleStatus,
  OrganizationSeatRole,
  OrganizationStatus,
  canTransitionOrganizationStatus,
  isOrganizationLegalKind,
  isOrganizationModuleKey
} from "./constants.js";
import { badRequest, conflict, forbidden, notFound } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "./audit.js";

const MAX_NAME_LENGTH = 200;
const MAX_CLIENT_ACTION_ID_LENGTH = 100;

function cleanText(value, { max = MAX_NAME_LENGTH } = {}) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

/**
 * Kes tohib organisatsiooni luua. `CLIENT` ei tohi: pöörduja ei ole tööandja ja
 * `OrganizationSeatRole`-is ei ole `CLIENT` väärtust (otsus O-E0-1).
 * `normalizeRole` teisendab ADMIN → SOCIAL_WORKER, seega admin saab luua.
 */
export function seatRoleForProductRole(productRole) {
  if (productRole === "SERVICE_PROVIDER") return OrganizationSeatRole.SERVICE_PROVIDER;
  if (productRole === "SOCIAL_WORKER") return OrganizationSeatRole.SOCIAL_WORKER;
  return null;
}

function normalizeCreationActionId(value) {
  const actionId = String(value || "").trim();
  if (!actionId || actionId.length > MAX_CLIENT_ACTION_ID_LENGTH || !/^[a-zA-Z0-9_-]+$/.test(actionId)) {
    throw badRequest("org.errors.client_action_id_required");
  }
  return actionId;
}

function creationPayloadHash(payload) {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

function publicOrganization(organization) {
  if (!organization) return organization;
  const copy = { ...organization };
  delete copy.creationClientActionId;
  delete copy.creationPayloadHash;
  delete copy.memberships;
  return copy;
}

/**
 * Loob organisatsiooni DRAFT-seisus ja teeb loojast kohe aktiivse liikme
 * `ORG_OWNER` õigusega. Kõik ühes tehingus: organisatsioon ilma omanikuta oleks
 * kohe pärast loomist ligipääsmatu.
 */
export async function createOrganization(
  { userId, productRole, displayName, legalKind, legalName, registryCode, municipalityId, clientActionId },
  { db = prisma } = {}
) {
  const seatRole = seatRoleForProductRole(productRole);
  if (!seatRole) throw forbidden("org.errors.role_cannot_create_organization");

  const name = cleanText(displayName);
  if (!name) throw badRequest("org.errors.display_name_required");
  if (!isOrganizationLegalKind(legalKind)) throw badRequest("org.errors.invalid_legal_kind");

  const actionId = normalizeCreationActionId(clientActionId);
  const normalizedPayload = {
    displayName: name,
    legalKind,
    legalName: cleanText(legalName),
    registryCode: cleanText(registryCode, { max: 40 }),
    municipalityId: cleanText(municipalityId, { max: 40 }),
    seatRole
  };
  const payloadHash = creationPayloadHash(normalizedPayload);

  try {
    return await db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          displayName: normalizedPayload.displayName,
          legalKind: normalizedPayload.legalKind,
          legalName: normalizedPayload.legalName,
          registryCode: normalizedPayload.registryCode,
          municipalityId: normalizedPayload.municipalityId,
          status: OrganizationStatus.DRAFT,
          createdByUserId: userId,
          creationClientActionId: actionId,
          creationPayloadHash: payloadHash
        }
      });

      const membership = await tx.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId,
          status: OrganizationMembershipStatus.ACTIVE,
          seatRole
        }
      });

      await tx.organizationCapabilityGrant.createMany({
        data: [
          OrganizationCapability.ORG_OWNER,
          OrganizationCapability.MEMBER_ADMIN,
          OrganizationCapability.AUDIT_VIEWER
        ].map((capability) => ({
          membershipId: membership.id,
          capability,
          scopeType: OrganizationCapabilityScopeType.ORGANIZATION,
          grantedByUserId: userId,
          reason: "org.reason.founder"
        }))
      });

      await writeOrgAudit(tx, {
        actorUserId: userId,
        action: OrgAuditAction.ORGANIZATION_CREATED,
        resourceType: OrgAuditResource.ORGANIZATION,
        resourceId: organization.id,
        meta: { organizationId: organization.id, seatRole }
      });

      return { organization: publicOrganization(organization), membership, replayed: false };
    });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const existing = await db.organization.findFirst({
      where: { createdByUserId: userId, creationClientActionId: actionId },
      include: {
        memberships: {
          where: { userId },
          take: 1
        }
      }
    });
    if (!existing) throw error;
    if (existing.creationPayloadHash !== payloadHash) {
      throw conflict("org.errors.creation_idempotency_conflict");
    }
    return {
      organization: publicOrganization(existing),
      membership: existing.memberships[0] || null,
      replayed: true
    };
  }
}

export async function updateOrganization(
  organizationId,
  { actorUserId, displayName, legalName, registryCode, municipalityId, defaultLocale, timezone },
  { db = prisma } = {}
) {
  const data = {};
  if (displayName !== undefined) {
    const name = cleanText(displayName);
    if (!name) throw badRequest("org.errors.display_name_required");
    data.displayName = name;
  }
  if (legalName !== undefined) data.legalName = cleanText(legalName);
  if (registryCode !== undefined) data.registryCode = cleanText(registryCode, { max: 40 });
  if (municipalityId !== undefined) data.municipalityId = cleanText(municipalityId, { max: 40 });
  if (defaultLocale !== undefined) data.defaultLocale = cleanText(defaultLocale, { max: 8 }) || "et";
  if (timezone !== undefined) data.timezone = cleanText(timezone, { max: 64 }) || "Europe/Tallinn";
  if (!Object.keys(data).length) throw badRequest();

  return db.$transaction(async (tx) => {
    const organization = await tx.organization.update({ where: { id: organizationId }, data });
    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.ORGANIZATION_UPDATED,
      resourceType: OrgAuditResource.ORGANIZATION,
      resourceId: organizationId,
      meta: { organizationId }
    });
    return organization;
  });
}

/**
 * Olekusiire. `isPlatformAdmin` on siin päris värav, mitte mugavuslipp:
 * identiteedikontroll ei ole midagi, mida organisatsioon saab endale ise anda.
 */
export async function changeOrganizationStatus(
  organizationId,
  { actorUserId, isPlatformAdmin = false, toStatus, reason, verificationNote },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, status: true, verifiedAt: true }
    });
    if (!organization) throw notFound("org.errors.organization_not_found");

    const fromStatus = organization.status;
    if (fromStatus === toStatus) throw conflict("org.errors.status_unchanged");
    if (!canTransitionOrganizationStatus(fromStatus, toStatus)) {
      throw conflict("org.errors.invalid_status_transition", { fromStatus, toStatus });
    }

    const adminOnly =
      toStatus === OrganizationStatus.ACTIVE || toStatus === OrganizationStatus.SUSPENDED;
    if (adminOnly && !isPlatformAdmin) throw forbidden("org.errors.verification_requires_admin");

    const data = { status: toStatus };
    if (toStatus === OrganizationStatus.ACTIVE) {
      // Aktiveerimine ON identiteedikontrolli kinnitus. Ilma templita jääks
      // DB CHECK ette ja viga oleks arusaamatu.
      if (!organization.verifiedAt) {
        data.verifiedAt = now;
        data.verifiedByUserId = actorUserId;
        if (verificationNote) data.verificationNote = cleanText(verificationNote, { max: 500 });
      }
      data.activatedAt = now;
      data.suspendedAt = null;
      data.suspendedReason = null;
    }
    if (toStatus === OrganizationStatus.SUSPENDED) {
      data.suspendedAt = now;
      data.suspendedReason = cleanText(reason, { max: 500 });
    }
    if (toStatus === OrganizationStatus.ARCHIVED) {
      data.archivedAt = now;
      data.archivedReason = cleanText(reason, { max: 500 });
    }

    /* SIIRE ON TINGIMUSLIK, MITTE TINGIMUSTETA (SOL-ORG-12).
       Ülemine `canTransition` kontroll hindas MÄLUS loetud algolekut. Kaks
       lubatud siiret samast algolekust — näiteks `PENDING_VERIFICATION → ACTIVE`
       ja `PENDING_VERIFICATION → ARCHIVED` — võisid mõlemad kontrolli läbida ja
       hilisem kirjutas varasema üle. Nii sai `ARCHIVED`, mis on TERMINAL,
       muutuda tagasi `ACTIVE`-ks koos kõigi vanade liikmesuste ja grantidega.

       `updateMany` tingimusega `status = fromStatus` hindab algolekut andmebaasis,
       rea luku all: kui ta ei kirjutanud, siis maailm muutus meie all ära ja
       meie otsus käis vale aluse pealt. Kaotaja saab 409 ja EI JÄTA auditijälge —
       sündmust, mida ei toimunud, ei tohi ajaloos olla. */
    const changed = await tx.organization.updateMany({
      where: { id: organizationId, status: fromStatus },
      data
    });
    if (changed.count !== 1) {
      /* Värske seis loetakse teate jaoks: „ARCHIVED → ACTIVE ei ole lubatud" on
         kasutajale arusaadav, „PENDING_VERIFICATION → ACTIVE ei ole lubatud"
         oleks vale ja segane, sest tema alus oli vahepeal aegunud. */
      const fresh = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { status: true }
      });
      throw conflict("org.errors.invalid_status_transition", {
        fromStatus: fresh?.status || null,
        toStatus
      });
    }
    const updated = await tx.organization.findUnique({ where: { id: organizationId } });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.ORGANIZATION_STATUS_CHANGED,
      resourceType: OrgAuditResource.ORGANIZATION,
      resourceId: organizationId,
      meta: { organizationId, fromStatus, toStatus, reason: cleanText(reason, { max: 200 }) }
    });

    return updated;
  });
}

/**
 * Aktiveerib mooduli. Moodul EI anna ise sisuõigust — ta avab vastava
 * capability-kihi kasutamise (arenduskava §5.1). Seepärast ei puuduta see
 * funktsioon ühtegi granti.
 */
export async function activateModule(
  organizationId,
  { actorUserId, moduleKey, reason },
  { db = prisma, now = new Date() } = {}
) {
  if (!isOrganizationModuleKey(moduleKey)) throw badRequest("org.errors.invalid_module");

  return db.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, status: true }
    });
    if (!organization) throw notFound("org.errors.organization_not_found");
    if (organization.status !== OrganizationStatus.ACTIVE) {
      throw conflict("org.errors.organization_not_writable");
    }

    const existing = await tx.organizationModule.findFirst({
      where: { organizationId, moduleKey, status: OrganizationModuleStatus.ACTIVE }
    });
    if (existing) throw conflict("org.errors.module_already_active");

    const created = await tx.organizationModule.create({
      data: {
        organizationId,
        moduleKey,
        status: OrganizationModuleStatus.ACTIVE,
        validFrom: now,
        activatedByUserId: actorUserId,
        reason: cleanText(reason, { max: 500 })
      }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.MODULE_ACTIVATED,
      resourceType: OrgAuditResource.MODULE,
      resourceId: created.id,
      meta: { organizationId, moduleKey }
    });

    return created;
  });
}

export async function suspendModule(
  organizationId,
  { actorUserId, moduleKey, reason },
  { db = prisma, now = new Date() } = {}
) {
  if (!isOrganizationModuleKey(moduleKey)) throw badRequest("org.errors.invalid_module");

  return db.$transaction(async (tx) => {
    const active = await tx.organizationModule.findFirst({
      where: { organizationId, moduleKey, status: OrganizationModuleStatus.ACTIVE }
    });
    if (!active) throw notFound("org.errors.module_not_active");

    const updated = await tx.organizationModule.update({
      where: { id: active.id },
      data: {
        status: OrganizationModuleStatus.SUSPENDED,
        validUntil: now,
        reason: cleanText(reason, { max: 500 })
      }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.MODULE_SUSPENDED,
      resourceType: OrgAuditResource.MODULE,
      resourceId: active.id,
      meta: { organizationId, moduleKey }
    });

    return updated;
  });
}

/**
 * Kasutaja organisatsioonid tööruumivahetaja jaoks. AINULT aktiivsed liikmesused
 * ja nähtavad organisatsioonid — vahetajas ei tohi vilkuda organisatsiooni, kuhu
 * inimene enam ei kuulu.
 */
export async function listUserOrganizations(userId, { db = prisma } = {}) {
  const rows = await db.organizationMembership.findMany({
    where: {
      userId,
      status: OrganizationMembershipStatus.ACTIVE,
      organization: { status: { not: OrganizationStatus.ARCHIVED } }
    },
    select: {
      id: true,
      seatRole: true,
      jobTitle: true,
      organization: {
        select: { id: true, displayName: true, legalKind: true, status: true }
      }
    },
    orderBy: { startedAt: "asc" }
  });

  return rows.map((row) => ({
    membershipId: row.id,
    seatRole: row.seatRole,
    jobTitle: row.jobTitle,
    id: row.organization.id,
    displayName: row.organization.displayName,
    legalKind: row.organization.legalKind,
    status: row.organization.status
  }));
}
