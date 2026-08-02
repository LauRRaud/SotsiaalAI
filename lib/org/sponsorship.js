/**
 * T25 ORG-FUNDING-INBOX-V1 — pöörduja organisatsioonipoolne sponsorlus (E5).
 *
 * OTSUS O-E0-1: see rada on RUUMIST SÕLTUMATU. Olemasolev `Invite` nõuab
 * `roomId`-d (NOT NULL), mis tähendaks, et 200 elanikku sponsoreeriv KOV peaks
 * looma 200 ruumi. Olemasolevat ruumikutset EI muudeta ebamääraseks
 * üldkutseks — see on eraldi mudel eraldi elutsükliga.
 *
 * MIDA SPONSORLUS ANNAB: tellimuse, mille maksja on organisatsioon.
 * MIDA SEE EI ANNA (arenduskava §5.6):
 *   - `OrganizationMembership`-i — pöörduja ei ole töötaja;
 *   - `OrganizationSeatPlan`/`SeatAssignment`-i — see ei ole töötajakoht;
 *   - ühtegi organisatsioonivaate õigust;
 *   - organisatsioonile ligipääsu pöörduja vestlustele, Teekonnale ega
 *     kasutussagedusele. Maksmine ei ole nägemisõigus.
 *
 * LIGIPÄÄSU LÕPP ei tohi sulgeda pöörduja oma andmete lugemist, eksporti ega
 * kriisikontakte — seepärast on `Subscription.sponsorOrganization` `SetNull`
 * ja tellimust ei kustutata, vaid lastakse aeguda.
 */

import prisma from "@/lib/prisma";

import { getPlanDefinitionId, getRolePlanKey } from "@/lib/subscriptionPlans";

import {
  CLIENT_SPONSORSHIP_REFERENCE_PRICE_CENTS,
  OrganizationClientSponsorshipStatus,
  OrganizationStatus
} from "./constants.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, maskEmail, writeOrgAudit } from "./audit.js";
import {
  createInviteToken,
  hashInviteToken,
  inviteExpiryFrom,
  inviteRejectionMessageKey,
  normalizeInviteEmail
} from "./invites.js";

function addOneMonth(from) {
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1);
  return next;
}

/** Sama fail-closed hindamine mis töötajakutsel, oma seisunimedega. */
function evaluateSponsorship(row, { acceptingEmail, now }) {
  if (!row) return { ok: false, reason: "NOT_FOUND" };
  if (row.status !== OrganizationClientSponsorshipStatus.PENDING) {
    return { ok: false, reason: row.status === "EXPIRED" ? "EXPIRED" : "NOT_PENDING" };
  }
  if (!row.expiresAt || new Date(row.expiresAt) <= now) return { ok: false, reason: "EXPIRED" };
  if (acceptingEmail !== undefined) {
    const normalized = String(acceptingEmail || "").trim().toLowerCase();
    if (!normalized || normalized !== String(row.email || "").trim().toLowerCase()) {
      return { ok: false, reason: "EMAIL_MISMATCH" };
    }
  }
  return { ok: true, reason: null };
}

export async function createClientSponsorship(
  organizationId,
  { actorUserId, email, unitPriceCents, priceReason },
  { db = prisma, now = new Date() } = {}
) {
  const normalizedEmail = normalizeInviteEmail(email);
  const price =
    unitPriceCents === undefined || unitPriceCents === null
      ? CLIENT_SPONSORSHIP_REFERENCE_PRICE_CENTS
      : Number(unitPriceCents);
  if (!Number.isInteger(price) || price < 0) throw badRequest("org.errors.invalid_price");

  const reason = priceReason ? String(priceReason).slice(0, 500) : null;
  if (price !== CLIENT_SPONSORSHIP_REFERENCE_PRICE_CENTS && !reason) {
    throw badRequest("org.errors.price_reason_required");
  }

  return db.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, status: true }
    });
    if (!organization) throw notFound("org.errors.organization_not_found");
    if (organization.status !== OrganizationStatus.ACTIVE) {
      throw conflict("org.errors.organization_not_writable");
    }

    const open = await tx.organizationClientSponsorship.findFirst({
      where: {
        organizationId,
        email: normalizedEmail,
        status: OrganizationClientSponsorshipStatus.PENDING
      },
      select: { id: true }
    });
    if (open) throw conflict("org.errors.sponsorship_already_pending");

    const token = createInviteToken();
    const sponsorship = await tx.organizationClientSponsorship.create({
      data: {
        organizationId,
        email: normalizedEmail,
        tokenHash: token.hash,
        status: OrganizationClientSponsorshipStatus.PENDING,
        unitPriceCents: price,
        priceReason: reason,
        invitedByUserId: actorUserId,
        expiresAt: inviteExpiryFrom(now)
      }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.CLIENT_SPONSORSHIP_CREATED,
      resourceType: OrgAuditResource.CLIENT_SPONSORSHIP,
      resourceId: sponsorship.id,
      meta: {
        organizationId,
        sponsorshipId: sponsorship.id,
        emailMasked: maskEmail(normalizedEmail),
        unitPriceCents: price,
        reason
      }
    });

    return { sponsorship, rawToken: token.raw };
  });
}

export async function listClientSponsorships(organizationId, { db = prisma, includeClosed = false } = {}) {
  return db.organizationClientSponsorship.findMany({
    where: {
      organizationId,
      ...(includeClosed ? {} : { status: OrganizationClientSponsorshipStatus.PENDING })
    },
    select: {
      id: true,
      email: true,
      status: true,
      unitPriceCents: true,
      currency: true,
      priceReason: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

export async function revokeClientSponsorship(
  organizationId,
  sponsorshipId,
  { actorUserId },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const row = await tx.organizationClientSponsorship.findFirst({
      where: { id: sponsorshipId, organizationId },
      select: { id: true, status: true, email: true }
    });
    if (!row) throw notFound("org.errors.sponsorship_not_found");
    if (row.status !== OrganizationClientSponsorshipStatus.PENDING) {
      throw conflict("org.errors.sponsorship_not_pending");
    }

    const updated = await tx.organizationClientSponsorship.update({
      where: { id: sponsorshipId },
      data: {
        status: OrganizationClientSponsorshipStatus.REVOKED,
        revokedAt: now,
        revokedByUserId: actorUserId
      }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.CLIENT_SPONSORSHIP_REVOKED,
      resourceType: OrgAuditResource.CLIENT_SPONSORSHIP,
      resourceId: sponsorshipId,
      meta: { organizationId, sponsorshipId, emailMasked: maskEmail(row.email) }
    });

    return updated;
  });
}

/** Eelvaade enne nõustumist: kes maksab, mille eest ja kui kaua. */
export async function previewClientSponsorship(rawToken, { acceptingEmail, db = prisma, now = new Date() } = {}) {
  const row = await db.organizationClientSponsorship.findUnique({
    where: { tokenHash: hashInviteToken(String(rawToken || "")) },
    select: {
      id: true,
      email: true,
      status: true,
      unitPriceCents: true,
      currency: true,
      expiresAt: true,
      organization: { select: { displayName: true, legalKind: true, status: true } }
    }
  });
  const verdict = evaluateSponsorship(row, { acceptingEmail, now });
  if (!verdict.ok) throw notFound(inviteRejectionMessageKey(verdict.reason));
  if (row.organization?.status !== OrganizationStatus.ACTIVE) {
    throw conflict("org.errors.organization_not_writable");
  }

  return {
    organization: {
      displayName: row.organization.displayName,
      legalKind: row.organization.legalKind
    },
    unitPriceCents: row.unitPriceCents,
    currency: row.currency,
    expiresAt: row.expiresAt
  };
}

/**
 * Võtab sponsorluse vastu.
 *
 * Loob või pikendab `Subscription`-it — SAMA mustri järgi, mida kasutab
 * olemasolev ruumipõhine sponsorkutse (`lib/invites/acceptInviteCore.js`),
 * aga `billingSource = SPONSORED_BY_ORGANIZATION` ja maksja on organisatsioon.
 *
 * `OrganizationMembership`-i EI LOODA. Kui keegi lisab selle siia hiljem, on
 * see arenduskava §5.6 rikkumine.
 */
export async function acceptClientSponsorship(
  rawToken,
  { userId, userEmail },
  { db = prisma, now = new Date() } = {}
) {
  const tokenHash = hashInviteToken(String(rawToken || ""));

  return db.$transaction(async (tx) => {
    const row = await tx.organizationClientSponsorship.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        organizationId: true,
        email: true,
        status: true,
        expiresAt: true,
        organization: { select: { status: true } }
      }
    });
    const verdict = evaluateSponsorship(row, { acceptingEmail: userEmail, now });
    if (!verdict.ok) throw notFound(inviteRejectionMessageKey(verdict.reason));
    if (row.organization?.status !== OrganizationStatus.ACTIVE) {
      throw conflict("org.errors.organization_not_writable");
    }

    /* Pöörduja tellimus on ALATI CLIENT-paketil: sponsorlus ei muuda inimese
       rolli ega anna talle spetsialisti funktsioone (arenduskava §D5). */
    const plan = getRolePlanKey("CLIENT");
    const planDefinitionId = getPlanDefinitionId(plan, "CLIENT");
    const validUntil = addOneMonth(now);

    const existing = await tx.subscription.findFirst({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }],
      select: { id: true }
    });

    const data = {
      status: "ACTIVE",
      plan,
      planDefinitionId,
      billingSource: "SPONSORED_BY_ORGANIZATION",
      sponsorOrganizationId: row.organizationId,
      orgClientSponsorshipId: row.id,
      validUntil,
      nextBilling: null,
      canceledAt: null
    };

    if (existing) {
      await tx.subscription.update({ where: { id: existing.id }, data });
    } else {
      await tx.subscription.create({ data: { userId, ...data } });
    }

    await tx.organizationClientSponsorship.update({
      where: { id: row.id },
      data: {
        status: OrganizationClientSponsorshipStatus.ACCEPTED,
        acceptedAt: now,
        acceptedByUserId: userId
      }
    });

    await writeOrgAudit(tx, {
      actorUserId: userId,
      targetUserId: userId,
      action: OrgAuditAction.CLIENT_SPONSORSHIP_ACCEPTED,
      resourceType: OrgAuditResource.CLIENT_SPONSORSHIP,
      resourceId: row.id,
      meta: { organizationId: row.organizationId, sponsorshipId: row.id }
    });

    return { organizationId: row.organizationId, validUntil };
  });
}

export async function declineClientSponsorship(
  rawToken,
  { userId, userEmail },
  { db = prisma, now = new Date() } = {}
) {
  const tokenHash = hashInviteToken(String(rawToken || ""));
  return db.$transaction(async (tx) => {
    const row = await tx.organizationClientSponsorship.findUnique({
      where: { tokenHash },
      select: { id: true, organizationId: true, email: true, status: true, expiresAt: true }
    });
    const verdict = evaluateSponsorship(row, { acceptingEmail: userEmail, now });
    if (!verdict.ok) throw notFound(inviteRejectionMessageKey(verdict.reason));

    const updated = await tx.organizationClientSponsorship.update({
      where: { id: row.id },
      data: { status: OrganizationClientSponsorshipStatus.DECLINED, declinedAt: now }
    });

    await writeOrgAudit(tx, {
      actorUserId: userId,
      action: OrgAuditAction.CLIENT_SPONSORSHIP_DECLINED,
      resourceType: OrgAuditResource.CLIENT_SPONSORSHIP,
      resourceId: row.id,
      meta: { organizationId: row.organizationId, sponsorshipId: row.id }
    });

    return updated;
  });
}
