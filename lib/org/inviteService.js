/**
 * T25 ORG-FOUNDATION-V1 — kutse elutsükkel (E4).
 *
 * VASTUVÕTT ON TEADLIK NÕUSTUMINE (arenduskava §5.5). Lingile klikkimine avab
 * EELVAATE; liikmesus tekib alles eraldi kinnitusest. Seepärast on `previewInvite`
 * ja `acceptInvite` kaks eri funktsiooni ja eelvaade ei muuda mitte midagi.
 *
 * FAIL-CLOSED (§11.2): vale e-post, aegumine, revoke ja korduskasutus annavad
 * kõik sama tulemuse — liikmesust ei teki. Aegumine on ainus eristatud sõnum,
 * sest kasutaja saab sellega ise midagi peale hakata (küsi uus kutse).
 */

import prisma from "@/lib/prisma";

import {
  CAPABILITY_TEMPLATES,
  OrganizationCapabilityScopeType,
  OrganizationInviteStatus,
  OrganizationMembershipStatus,
  OrganizationStatus,
  ORGANIZATION_ONLY_CAPABILITIES
} from "./constants.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, maskEmail, writeOrgAudit } from "./audit.js";
import {
  assertInviteInput,
  createInviteToken,
  evaluateInvite,
  hashInviteToken,
  inviteExpiryFrom,
  inviteRejectionMessageKey,
  toInvitePreview
} from "./invites.js";

/**
 * ATOMAARNE OLEKUVAHETUS — TÄPSELT ÜKS VÕISTLEJA VÕIDAB (SOL-ORG-09).
 *
 * Kutsel on kolm väljapääsu `PENDING`-ust: vastuvõtmine, keeldumine ja
 * organisatsioonipoolne tühistamine. Kõik kolm lugesid varem seisu ja kirjutasid
 * seejärel TINGIMUSTETA — kaks tehingut nägid mõlemad `PENDING`-ut ja hilisem
 * kirjutas varasema tulemuse üle.
 *
 * MIKS SEE ON RANGEM KUI SPONSORLUSE OMA (SOL-ORG-06): siin ei ole tagajärjeks
 * ainult vale olek, vaid **liikmesus ja capability-grandid**. Administraatori
 * tühistamisotsus peab olema turvapiir, mitte ajastuse küsimus.
 *
 * `updateMany ... WHERE status = 'PENDING'` teeb lugemisest ja kirjutamisest ühe
 * sammu: Postgres võtab rea luku ja hindab tingimuse UUESTI luku all. Teine
 * võistleja leiab 0 rida ja teab, et ta kaotas.
 *
 * NÕUE ON VASTUVÕTMISE ESIMENE KIRJUTUS. Liikmesus ja õigused sünnivad ainult
 * tehingus, mis nõude võitis — kaotaja ei jõua nendeni.
 *
 * @returns `true`, kui SEE kutse võitis nõude.
 */
async function claimPendingInvite(tx, where, data) {
  const claimed = await tx.organizationInvite.updateMany({
    where: { ...where, status: OrganizationInviteStatus.PENDING },
    data
  });
  return claimed.count === 1;
}

/**
 * Loob kutse ja tagastab TOORE tokeni ainult sellel ühel korral. Andmebaasi
 * läheb ainult räsi — kutse lingi kordussaatmine tähendab uut kutset.
 */
export async function createInvite(
  organizationId,
  { actorUserId, email, seatRole, capabilityTemplate, primaryUnitId = null, jobTitle = null },
  { db = prisma, now = new Date() } = {}
) {
  const parsed = assertInviteInput({ email, seatRole, capabilityTemplate });

  return db.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, status: true }
    });
    if (!organization) throw notFound("org.errors.organization_not_found");
    if (organization.status !== OrganizationStatus.ACTIVE) {
      throw conflict("org.errors.organization_not_writable");
    }

    if (primaryUnitId) {
      const unit = await tx.organizationUnit.findFirst({
        where: { id: primaryUnitId, organizationId, status: "ACTIVE" },
        select: { id: true }
      });
      if (!unit) throw notFound("org.errors.unit_not_found");
    }
    if (parsed.template.scope === "UNIT" && !primaryUnitId) {
      throw badRequest("org.errors.capability_scope_unit_required");
    }

    /* Kui inimene on juba aktiivne liige, ei ole kutse mõtet — ja see hoiab ära
       „kutsu ennast uuesti kõrgema malliga" trikki. */
    const existingMember = await tx.organizationMembership.findFirst({
      where: {
        organizationId,
        status: OrganizationMembershipStatus.ACTIVE,
        user: { email: parsed.email }
      },
      select: { id: true }
    });
    if (existingMember) throw conflict("org.errors.already_member");

    const openInvite = await tx.organizationInvite.findFirst({
      where: { organizationId, email: parsed.email, status: OrganizationInviteStatus.PENDING },
      select: { id: true }
    });
    if (openInvite) throw conflict("org.errors.invite_already_pending");

    const token = createInviteToken();
    const invite = await tx.organizationInvite.create({
      data: {
        organizationId,
        email: parsed.email,
        tokenHash: token.hash,
        status: OrganizationInviteStatus.PENDING,
        seatRole: parsed.seatRole,
        primaryUnitId: primaryUnitId || null,
        capabilityTemplate: parsed.template.key,
        jobTitle: jobTitle ? String(jobTitle).slice(0, 200) : null,
        invitedByUserId: actorUserId,
        expiresAt: inviteExpiryFrom(now)
      }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.INVITE_CREATED,
      resourceType: OrgAuditResource.INVITE,
      resourceId: invite.id,
      meta: {
        organizationId,
        inviteId: invite.id,
        emailMasked: maskEmail(parsed.email),
        seatRole: parsed.seatRole,
        templateKey: parsed.template.key
      }
    });

    return { invite, rawToken: token.raw };
  });
}

/** Organisatsiooni kutsete loend. E-post on siin nähtav — see ON haldusvaade. */
export async function listInvites(organizationId, { db = prisma, includeClosed = false } = {}) {
  return db.organizationInvite.findMany({
    where: {
      organizationId,
      ...(includeClosed ? {} : { status: OrganizationInviteStatus.PENDING })
    },
    select: {
      id: true,
      email: true,
      status: true,
      seatRole: true,
      capabilityTemplate: true,
      jobTitle: true,
      expiresAt: true,
      createdAt: true,
      acceptedAt: true,
      revokedAt: true,
      primaryUnit: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

export async function revokeInvite(organizationId, inviteId, { actorUserId }, { db = prisma, now = new Date() } = {}) {
  return db.$transaction(async (tx) => {
    const invite = await tx.organizationInvite.findFirst({
      where: { id: inviteId, organizationId },
      select: { id: true, status: true, email: true }
    });
    if (!invite) throw notFound("org.errors.invite_not_found");

    /* Eelnev lugemine annab e-posti auditijälje jaoks; OTSUSE teeb nõue.
       Vahepeal vastu võetud kutset ei saa enam „tühistada" — tühistamine
       jätaks liikmesuse ja õigused alles ning audit valetaks. */
    const claimed = await claimPendingInvite(
      tx,
      { id: inviteId, organizationId },
      { status: OrganizationInviteStatus.REVOKED, revokedAt: now, revokedByUserId: actorUserId }
    );
    if (!claimed) throw conflict("org.errors.invite_not_pending");
    const updated = await tx.organizationInvite.findUnique({ where: { id: inviteId } });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.INVITE_REVOKED,
      resourceType: OrgAuditResource.INVITE,
      resourceId: inviteId,
      meta: { organizationId, inviteId, emailMasked: maskEmail(invite.email) }
    });

    return updated;
  });
}

async function findInviteByToken(db, rawToken) {
  const tokenHash = hashInviteToken(String(rawToken || ""));
  return db.organizationInvite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      organizationId: true,
      email: true,
      status: true,
      seatRole: true,
      capabilityTemplate: true,
      jobTitle: true,
      primaryUnitId: true,
      expiresAt: true,
      organization: { select: { id: true, displayName: true, legalKind: true, status: true } },
      primaryUnit: { select: { id: true, name: true } }
    }
  });
}

/**
 * EELVAADE. Ei muuda midagi ega loo liikmesust. Kutsutu peab enne nõustumist
 * nägema organisatsiooni, üksust, hinnastatavat rolli ja kavandatud õigusi.
 */
export async function previewInvite(rawToken, { acceptingEmail, db = prisma, now = new Date() } = {}) {
  const invite = await findInviteByToken(db, rawToken);
  const verdict = evaluateInvite(invite, { acceptingEmail, now });
  if (!verdict.ok) throw notFound(inviteRejectionMessageKey(verdict.reason));
  if (invite.organization?.status !== OrganizationStatus.ACTIVE) {
    throw conflict("org.errors.organization_not_writable");
  }
  return toInvitePreview(invite);
}

/**
 * Võtab kutse vastu ja loob liikmesuse.
 *
 * Kogu töö ühes tehingus, sest kolm asja peavad koos õnnestuma või koos
 * ebaõnnestuma: kutse sulgemine, liikmesuse loomine ja malli rakendamine.
 * Kutse staatust kontrollime UUESTI tehingu sees — muidu saaks kahe samaaegse
 * päringuga ühest kutsest kaks liikmesust.
 */
export async function acceptInvite(
  rawToken,
  { userId, userEmail },
  { db = prisma, now = new Date() } = {}
) {
  const tokenHash = hashInviteToken(String(rawToken || ""));

  return db.$transaction(async (tx) => {
    const invite = await tx.organizationInvite.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        organizationId: true,
        email: true,
        status: true,
        seatRole: true,
        capabilityTemplate: true,
        jobTitle: true,
        primaryUnitId: true,
        expiresAt: true,
        organization: { select: { id: true, status: true } }
      }
    });

    const verdict = evaluateInvite(invite, { acceptingEmail: userEmail, now });
    if (!verdict.ok) throw notFound(inviteRejectionMessageKey(verdict.reason));
    if (invite.organization?.status !== OrganizationStatus.ACTIVE) {
      throw conflict("org.errors.organization_not_writable");
    }

    /* NÕUE ENNE LIIKMESUST (SOL-ORG-09). Varem loodi liikmesus ja grandid
       esimesena ning kutse olek alles pärast — paralleelne tühistamine sai
       vahele jääda ja lõppseis oli `REVOKED` kutse, mille alt õigused olid juba
       välja antud. Administraatori otsus peab olema turvapiir, mitte ajastuse
       küsimus: kes nõude kaotab, ei jõua liikmesuseni. */
    const claimed = await claimPendingInvite(
      tx,
      { id: invite.id },
      {
        status: OrganizationInviteStatus.ACCEPTED,
        acceptedAt: now,
        acceptedByUserId: userId
      }
    );
    /* Kaotaja saab SAMA vastuse mis kasutatud kutse — see ei ole eriharu, vaid
       täpselt seesama olukord: kutset ei saa enam vastu võtta. */
    if (!claimed) throw notFound(inviteRejectionMessageKey("NOT_PENDING"));

    const existing = await tx.organizationMembership.findFirst({
      where: {
        organizationId: invite.organizationId,
        userId,
        status: OrganizationMembershipStatus.ACTIVE
      },
      select: { id: true }
    });
    if (existing) throw conflict("org.errors.already_member");

    const membership = await tx.organizationMembership.create({
      data: {
        organizationId: invite.organizationId,
        userId,
        status: OrganizationMembershipStatus.ACTIVE,
        seatRole: invite.seatRole,
        jobTitle: invite.jobTitle,
        invitedByUserId: null,
        startedAt: now
      }
    });

    if (invite.primaryUnitId) {
      await tx.organizationMembershipUnit.create({
        data: { membershipId: membership.id, unitId: invite.primaryUnitId, isPrimary: true, startedAt: now }
      });
    }

    /* Mall rakendatakse SIIN, mitte `applyCapabilityTemplate` kaudu: see funktsioon
       avaks oma tehingu ja kutse vastuvõtt peab olema üks atomaarne toiming. */
    const template = CAPABILITY_TEMPLATES[invite.capabilityTemplate] || CAPABILITY_TEMPLATES.MEMBER;
    for (const capability of template.capabilities) {
      const scopeType =
        template.scope === "UNIT" &&
        invite.primaryUnitId &&
        !ORGANIZATION_ONLY_CAPABILITIES.includes(capability)
          ? OrganizationCapabilityScopeType.UNIT
          : OrganizationCapabilityScopeType.ORGANIZATION;
      await tx.organizationCapabilityGrant.create({
        data: {
          membershipId: membership.id,
          capability,
          scopeType,
          scopeUnitId: scopeType === OrganizationCapabilityScopeType.UNIT ? invite.primaryUnitId : null,
          grantedByUserId: null,
          reason: `org.reason.template.${template.key}`
        }
      });
    }

    await writeOrgAudit(tx, {
      actorUserId: userId,
      targetUserId: userId,
      action: OrgAuditAction.INVITE_ACCEPTED,
      resourceType: OrgAuditResource.INVITE,
      resourceId: invite.id,
      meta: {
        organizationId: invite.organizationId,
        inviteId: invite.id,
        membershipId: membership.id,
        seatRole: invite.seatRole,
        templateKey: template.key
      }
    });

    return { membership, organizationId: invite.organizationId };
  });
}

export async function declineInvite(rawToken, { userId, userEmail }, { db = prisma, now = new Date() } = {}) {
  const tokenHash = hashInviteToken(String(rawToken || ""));

  return db.$transaction(async (tx) => {
    const invite = await tx.organizationInvite.findUnique({
      where: { tokenHash },
      select: { id: true, organizationId: true, email: true, status: true, expiresAt: true }
    });
    const verdict = evaluateInvite(invite, { acceptingEmail: userEmail, now });
    if (!verdict.ok) throw notFound(inviteRejectionMessageKey(verdict.reason));

    const claimed = await claimPendingInvite(
      tx,
      { id: invite.id },
      { status: OrganizationInviteStatus.DECLINED, declinedAt: now }
    );
    if (!claimed) throw notFound(inviteRejectionMessageKey("NOT_PENDING"));
    const updated = await tx.organizationInvite.findUnique({ where: { id: invite.id } });

    await writeOrgAudit(tx, {
      actorUserId: userId,
      action: OrgAuditAction.INVITE_DECLINED,
      resourceType: OrgAuditResource.INVITE,
      resourceId: invite.id,
      meta: { organizationId: invite.organizationId, inviteId: invite.id }
    });

    return updated;
  });
}

/**
 * Kasutajale suunatud ootel kutsed (tema e-posti aadressile). Ei näita
 * organisatsiooni sisemist infot peale nime ja pakutava rolli.
 */
export async function listPendingInvitesForEmail(email, { db = prisma, now = new Date() } = {}) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return [];
  const rows = await db.organizationInvite.findMany({
    where: {
      email: normalized,
      status: OrganizationInviteStatus.PENDING,
      expiresAt: { gt: now }
    },
    select: {
      id: true,
      seatRole: true,
      capabilityTemplate: true,
      expiresAt: true,
      organization: { select: { displayName: true, legalKind: true } },
      primaryUnit: { select: { name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  return rows.map((row) => ({
    id: row.id,
    seatRole: row.seatRole,
    capabilityTemplate: row.capabilityTemplate,
    expiresAt: row.expiresAt,
    organizationName: row.organization?.displayName || null,
    legalKind: row.organization?.legalKind || null,
    unitName: row.primaryUnit?.name || null
  }));
}
