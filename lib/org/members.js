/**
 * T25 ORG-FOUNDATION-V1 — liikmesused, üksuseliikmesus ja capability'd (E4).
 *
 * LIIKMENIMEKIRJA PROJEKTSIOON on selle faili kõige tähtsam osa. Arenduskava
 * §7.4 loetleb, mida juht EI näe, ja see nimekiri on siin kood, mitte kommentaar:
 *   - EI OLE „viimati aktiivne" ega ühtegi ajatemplit peale liikmesuse enda;
 *   - EI OLE kasutuskordi, vestluste arvu, tootlikkust ega riskiskoori;
 *   - EI OLE ühtegi välja ühestki privaatobjektist.
 * Liikme kohta tagastatakse ainult see, mis on vajalik LIIKMESUSE haldamiseks.
 *
 * Kui keegi lisab siia hiljem „lastSeenAt", on see arenduskava rikkumine, mitte
 * mugavustäiendus.
 */

import prisma from "@/lib/prisma";

import {
  CAPABILITY_TEMPLATES,
  OrganizationCapabilityScopeType,
  OrganizationMembershipStatus,
  ORGANIZATION_ONLY_CAPABILITIES,
  isOrganizationCapability
} from "./constants.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "./audit.js";

/**
 * Liikmete loend. `capabilityGrants` tuleb kaasa, sest õiguste haldus ongi selle
 * vaate mõte; `user` alt AINULT identifitseerimiseks vajalik.
 */
export async function listMembers(organizationId, { db = prisma, includeEnded = false, now = new Date() } = {}) {
  const rows = await db.organizationMembership.findMany({
    where: {
      organizationId,
      ...(includeEnded ? {} : { status: { not: OrganizationMembershipStatus.ENDED } })
    },
    select: {
      id: true,
      status: true,
      seatRole: true,
      jobTitle: true,
      startedAt: true,
      endedAt: true,
      userId: true,
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { firstName: true, lastName: true } }
        }
      },
      units: {
        where: { endedAt: null },
        select: { unitId: true, isPrimary: true, unit: { select: { id: true, name: true } } }
      },
      capabilityGrants: {
        where: { revokedAt: null },
        select: {
          id: true,
          capability: true,
          scopeType: true,
          scopeUnitId: true,
          validFrom: true,
          validUntil: true
        }
      }
    },
    orderBy: [{ status: "asc" }, { startedAt: "asc" }]
  });

  return rows.map((row) => ({
    membershipId: row.id,
    status: row.status,
    seatRole: row.seatRole,
    jobTitle: row.jobTitle,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    person: {
      userId: row.userId,
      email: row.user?.email || null,
      firstName: row.user?.profile?.firstName || null,
      lastName: row.user?.profile?.lastName || null
    },
    units: row.units
      .filter((unitRow) => unitRow.unit)
      .map((unitRow) => ({ id: unitRow.unit.id, name: unitRow.unit.name, isPrimary: unitRow.isPrimary })),
    capabilities: row.capabilityGrants
      .filter((grant) => !grant.validUntil || new Date(grant.validUntil) > now)
      .filter((grant) => !grant.validFrom || new Date(grant.validFrom) <= now)
      .map((grant) => ({
        id: grant.id,
        capability: grant.capability,
        scopeType: grant.scopeType,
        scopeUnitId: grant.scopeUnitId,
        validUntil: grant.validUntil
      }))
  }));
}

async function requireMembership(tx, organizationId, membershipId) {
  const membership = await tx.organizationMembership.findFirst({
    where: { id: membershipId, organizationId },
    select: { id: true, status: true, userId: true, seatRole: true }
  });
  // 404 ka siis, kui liikmesus on olemas TEISES organisatsioonis (§11.1).
  if (!membership) throw notFound("org.errors.membership_not_found");
  return membership;
}

/**
 * Annab capability. Skoobi reeglid on siin, mitte ainult DB CHECK-is, et viga
 * jõuaks kasutajani arusaadavalt.
 */
export async function grantCapability(
  organizationId,
  membershipId,
  { actorUserId, capability, scopeType = OrganizationCapabilityScopeType.ORGANIZATION, scopeUnitId = null, validUntil = null, reason },
  { db = prisma } = {}
) {
  if (!isOrganizationCapability(capability)) throw badRequest("org.errors.invalid_capability");

  if (scopeType === OrganizationCapabilityScopeType.UNIT) {
    if (!scopeUnitId) throw badRequest("org.errors.capability_scope_unit_required");
    if (ORGANIZATION_ONLY_CAPABILITIES.includes(capability)) {
      // Üksusepiiratud ORG_OWNER oleks õiguste vaikne laiendamine: nimi ütleks
      // „ainult see tiim", tegelik mõju oleks kogu organisatsioon.
      throw badRequest("org.errors.capability_requires_organization_scope");
    }
  } else if (scopeUnitId) {
    throw badRequest("org.errors.capability_scope_conflict");
  }

  return db.$transaction(async (tx) => {
    const membership = await requireMembership(tx, organizationId, membershipId);
    if (membership.status !== OrganizationMembershipStatus.ACTIVE) {
      throw conflict("org.errors.membership_not_active");
    }

    if (scopeUnitId) {
      const unit = await tx.organizationUnit.findFirst({
        where: { id: scopeUnitId, organizationId },
        select: { id: true }
      });
      if (!unit) throw notFound("org.errors.unit_not_found");
    }

    const existing = await tx.organizationCapabilityGrant.findFirst({
      where: { membershipId, capability, scopeType, scopeUnitId, revokedAt: null },
      select: { id: true }
    });
    if (existing) throw conflict("org.errors.capability_already_granted");

    const grant = await tx.organizationCapabilityGrant.create({
      data: {
        membershipId,
        capability,
        scopeType,
        scopeUnitId,
        validUntil: validUntil ? new Date(validUntil) : null,
        grantedByUserId: actorUserId,
        reason: reason ? String(reason).slice(0, 500) : null
      }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      targetUserId: membership.userId,
      action: OrgAuditAction.CAPABILITY_GRANTED,
      resourceType: OrgAuditResource.CAPABILITY_GRANT,
      resourceId: grant.id,
      meta: { organizationId, membershipId, capability, scopeType, scopeUnitId }
    });

    return grant;
  });
}

/**
 * Tühistab capability. `revokedAt`, mitte kustutamine: õiguse ajalugu on
 * auditeeritav fakt (arenduskava §5.4).
 */
export async function revokeCapability(
  organizationId,
  membershipId,
  grantId,
  { actorUserId },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const membership = await requireMembership(tx, organizationId, membershipId);
    const grant = await tx.organizationCapabilityGrant.findFirst({
      where: { id: grantId, membershipId, revokedAt: null },
      select: { id: true, capability: true, scopeType: true, scopeUnitId: true }
    });
    if (!grant) throw notFound("org.errors.capability_grant_not_found");

    const updated = await tx.organizationCapabilityGrant.update({
      where: { id: grantId },
      data: { revokedAt: now, revokedByUserId: actorUserId }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      targetUserId: membership.userId,
      action: OrgAuditAction.CAPABILITY_REVOKED,
      resourceType: OrgAuditResource.CAPABILITY_GRANT,
      resourceId: grantId,
      meta: {
        organizationId,
        membershipId,
        capability: grant.capability,
        scopeType: grant.scopeType,
        scopeUnitId: grant.scopeUnitId
      }
    });

    return updated;
  });
}

/** Rakendab capability-malli. Mall on kiirvalik, mitte uus õigusklass. */
export async function applyCapabilityTemplate(
  organizationId,
  membershipId,
  { actorUserId, templateKey, scopeUnitId = null },
  { db = prisma } = {}
) {
  const template = CAPABILITY_TEMPLATES[templateKey];
  if (!template) throw badRequest("org.errors.unknown_capability_template");
  if (template.scope === "UNIT" && !scopeUnitId) throw badRequest("org.errors.capability_scope_unit_required");

  const granted = [];
  for (const capability of template.capabilities) {
    const scopeType =
      template.scope === "UNIT" && !ORGANIZATION_ONLY_CAPABILITIES.includes(capability)
        ? OrganizationCapabilityScopeType.UNIT
        : OrganizationCapabilityScopeType.ORGANIZATION;
    try {
      granted.push(
        await grantCapability(
          organizationId,
          membershipId,
          {
            actorUserId,
            capability,
            scopeType,
            scopeUnitId: scopeType === OrganizationCapabilityScopeType.UNIT ? scopeUnitId : null,
            reason: `org.reason.template.${template.key}`
          },
          { db }
        )
      );
    } catch (error) {
      // Juba olemasolev sama grant ei ole malli rakendamisel viga.
      if (error?.status !== 409) throw error;
    }
  }
  return granted;
}

/**
 * Vahetab liikme põhiüksuse. Vana rida LÕPETATAKSE (`endedAt`), mitte ei
 * kustutata — arenduskava §5.3 „üksuse vahetus säilitab ajaloo".
 */
export async function setPrimaryUnit(
  organizationId,
  membershipId,
  { actorUserId, unitId },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const membership = await requireMembership(tx, organizationId, membershipId);
    if (membership.status !== OrganizationMembershipStatus.ACTIVE) {
      throw conflict("org.errors.membership_not_active");
    }

    const unit = await tx.organizationUnit.findFirst({
      where: { id: unitId, organizationId, status: "ACTIVE" },
      select: { id: true }
    });
    if (!unit) throw notFound("org.errors.unit_not_found");

    const current = await tx.organizationMembershipUnit.findFirst({
      where: { membershipId, isPrimary: true, endedAt: null },
      select: { id: true, unitId: true }
    });
    if (current?.unitId === unitId) throw conflict("org.errors.unit_unchanged");

    if (current) {
      await tx.organizationMembershipUnit.update({ where: { id: current.id }, data: { endedAt: now } });
    }

    // Sama üksus võib olla liikmel juba mitte-põhiüksusena; siis lõpetame ka selle,
    // muidu rikub uus rida osalist unikaalindeksit (membershipId, unitId).
    const duplicate = await tx.organizationMembershipUnit.findFirst({
      where: { membershipId, unitId, endedAt: null },
      select: { id: true }
    });
    if (duplicate) {
      await tx.organizationMembershipUnit.update({ where: { id: duplicate.id }, data: { endedAt: now } });
    }

    const created = await tx.organizationMembershipUnit.create({
      data: { membershipId, unitId, isPrimary: true, startedAt: now }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      targetUserId: membership.userId,
      action: OrgAuditAction.MEMBER_UNIT_CHANGED,
      resourceType: OrgAuditResource.MEMBERSHIP,
      resourceId: membershipId,
      meta: { organizationId, membershipId, unitId }
    });

    return created;
  });
}

/**
 * Peatab liikmesuse. Peatatud liige ei saa organisatsioonikonteksti — resolver
 * nõuab ACTIVE-t. Capability'sid EI tühistata: peatamine on ajutine ja õiguste
 * taastamine käsitsi oleks veaallikas.
 */
export async function suspendMembership(organizationId, membershipId, { actorUserId }, { db = prisma } = {}) {
  return db.$transaction(async (tx) => {
    const membership = await requireMembership(tx, organizationId, membershipId);
    if (membership.status !== OrganizationMembershipStatus.ACTIVE) {
      throw conflict("org.errors.membership_not_active");
    }
    const updated = await tx.organizationMembership.update({
      where: { id: membershipId },
      data: { status: OrganizationMembershipStatus.SUSPENDED }
    });
    await writeOrgAudit(tx, {
      actorUserId,
      targetUserId: membership.userId,
      action: OrgAuditAction.MEMBER_SUSPENDED,
      resourceType: OrgAuditResource.MEMBERSHIP,
      resourceId: membershipId,
      meta: { organizationId, membershipId }
    });
    return updated;
  });
}

export async function reactivateMembership(organizationId, membershipId, { actorUserId }, { db = prisma } = {}) {
  return db.$transaction(async (tx) => {
    const membership = await requireMembership(tx, organizationId, membershipId);
    if (membership.status !== OrganizationMembershipStatus.SUSPENDED) {
      throw conflict("org.errors.membership_not_suspended");
    }
    // Osaline unikaalindeks lubab ainult ÜHE aktiivse liikmesuse org+kasutaja
    // kohta; kui inimene on vahepeal uuesti liitunud, ei tohi vana ellu äratada.
    const conflicting = await tx.organizationMembership.findFirst({
      where: {
        organizationId,
        userId: membership.userId,
        status: OrganizationMembershipStatus.ACTIVE
      },
      select: { id: true }
    });
    if (conflicting) throw conflict("org.errors.membership_already_active");

    const updated = await tx.organizationMembership.update({
      where: { id: membershipId },
      data: { status: OrganizationMembershipStatus.ACTIVE }
    });
    await writeOrgAudit(tx, {
      actorUserId,
      targetUserId: membership.userId,
      action: OrgAuditAction.MEMBER_REACTIVATED,
      resourceType: OrgAuditResource.MEMBERSHIP,
      resourceId: membershipId,
      meta: { organizationId, membershipId }
    });
    return updated;
  });
}

/**
 * Lõpetab liikmesuse (lahkumine või eemaldamine).
 *
 * MIDA SEE TEEB: lõpetab liikmesuse, tühistab KÕIK capability'd, sulgeb
 * üksuseliikmesused.
 * MIDA SEE EI TEE: ei puuduta kasutaja kontot, tellimust ega ühtegi isiklikku
 * objekti (arenduskava §D1, §E10 „konto jääb alles").
 *
 * Viilus A ei ole veel org-tööobjekte (postkast ja määramised tulevad viilus B),
 * seega pooleliolevat tööd ei ole vaja üle anda. Kui viil B need lisab, laieneb
 * see funktsioon offboarding-kontrollnimekirjaga — mitte enne.
 */
export async function endMembership(
  organizationId,
  membershipId,
  { actorUserId, reason },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const membership = await requireMembership(tx, organizationId, membershipId);
    if (membership.status === OrganizationMembershipStatus.ENDED) {
      throw conflict("org.errors.membership_already_ended");
    }

    const lastOwner = await isLastActiveOwner(tx, organizationId, membershipId);
    if (lastOwner) throw conflict("org.errors.last_owner_cannot_leave");

    await tx.organizationCapabilityGrant.updateMany({
      where: { membershipId, revokedAt: null },
      data: { revokedAt: now, revokedByUserId: actorUserId }
    });
    await tx.organizationMembershipUnit.updateMany({
      where: { membershipId, endedAt: null },
      data: { endedAt: now }
    });

    const updated = await tx.organizationMembership.update({
      where: { id: membershipId },
      data: {
        status: OrganizationMembershipStatus.ENDED,
        endedAt: now,
        endedReason: reason ? String(reason).slice(0, 500) : null
      }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      targetUserId: membership.userId,
      action: OrgAuditAction.MEMBER_ENDED,
      resourceType: OrgAuditResource.MEMBERSHIP,
      resourceId: membershipId,
      meta: { organizationId, membershipId, reason: reason ? String(reason).slice(0, 200) : null }
    });

    return updated;
  });
}

/**
 * Kas see liikmesus on organisatsiooni VIIMANE aktiivne `ORG_OWNER`?
 * Organisatsioon ilma omanikuta oleks haldamatu ja seda ei saaks enam ükski
 * route parandada.
 */
export async function isLastActiveOwner(tx, organizationId, membershipId) {
  const owners = await tx.organizationCapabilityGrant.findMany({
    where: {
      capability: "ORG_OWNER",
      revokedAt: null,
      membership: { organizationId, status: OrganizationMembershipStatus.ACTIVE }
    },
    select: { membershipId: true }
  });
  const ownerIds = new Set(owners.map((row) => row.membershipId));
  return ownerIds.has(membershipId) && ownerIds.size === 1;
}
