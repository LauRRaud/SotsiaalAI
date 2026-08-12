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
import { organizationSponsorOrigin } from "@/lib/payments/subscriptionOrigin";

import {
  CLIENT_SPONSORSHIP_REFERENCE_PRICE_CENTS,
  OrganizationClientSponsorshipStatus,
  OrganizationStatus
} from "./constants.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, maskEmail, writeOrgAudit } from "./audit.js";
import {
  decodePageCursor,
  descendingCursorWhere,
  normalizePageSize,
  toCursorPage
} from "./pagination.js";
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

/**
 * ATOMAARNE OLEKUVAHETUS — TÄPSELT ÜKS VÕISTLEJA VÕIDAB (SOL-ORG-06).
 *
 * Sponsorlusel on kolm väljapääsu `PENDING`-ust: vastuvõtmine, keeldumine ja
 * organisatsioonipoolne tagasivõtmine. Kõik kolm lugesid varem seisu ja
 * kirjutasid seejärel TINGIMUSTETA — kaks paralleelset kutset nägid mõlemad
 * `PENDING`-ut ja hilisem kirjutas varasema tulemuse üle. Tagajärg ei olnud
 * ainult vale olek: vastuvõtmine muudab ka `Subscription`-it, seega arveldus-,
 * audit- ja ligipääsuolek lakkasid kirjeldamast sama sündmust.
 *
 * `updateMany ... WHERE status = 'PENDING'` teeb lugemisest ja kirjutamisest ühe
 * sammu: Postgres võtab rea luku ja hindab tingimuse UUESTI luku all (READ
 * COMMITTED). Teine võistleja leiab 0 rida ja teab, et ta kaotas. Eraldi
 * `SELECT ... FOR UPDATE` ei ole vaja — tingimuslik `UPDATE` ise ON see lukk.
 *
 * NÕUE KUTSUJALE: see peab olema tehingu ESIMENE kirjutus. Vastuvõtmine puutub
 * ka tellimusse ja kui tellimus kirjutatakse enne nõude võitmist, teeb kaotaja
 * asjatut tööd, mille tehing küll tagasi keerab, aga mille lukud on vahepeal
 * juba võõraste ridade peal.
 *
 * @returns `true`, kui SEE kutse võitis nõude.
 */
async function claimPendingSponsorship(tx, where, data) {
  const claimed = await tx.organizationClientSponsorship.updateMany({
    where: { ...where, status: OrganizationClientSponsorshipStatus.PENDING },
    data
  });
  return claimed.count === 1;
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

export async function listClientSponsorshipPage(
  organizationId,
  { db = prisma, includeClosed = false, take = 100, cursor, status } = {}
) {
  const normalizedStatus = String(status || "").trim();
  if (normalizedStatus && !Object.values(OrganizationClientSponsorshipStatus).includes(normalizedStatus)) {
    throw badRequest("org.errors.invalid_payload");
  }
  const decoded = decodePageCursor(cursor, { dateKeys: ["createdAt"], stringKeys: ["id"] });
  const pageSize = normalizePageSize(take, 100, 200);
  const baseWhere = {
    organizationId,
    ...(normalizedStatus
      ? { status: normalizedStatus }
      : includeClosed
        ? {}
        : { status: OrganizationClientSponsorshipStatus.PENDING })
  };
  const rows = await db.organizationClientSponsorship.findMany({
    where: decoded
      ? { AND: [baseWhere, descendingCursorWhere(decoded, ["createdAt", "id"])] }
      : baseWhere,
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
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1
  });
  return toCursorPage(rows, pageSize, (row) => ({ createdAt: row.createdAt, id: row.id }));
}

export async function listClientSponsorships(organizationId, options = {}) {
  return (await listClientSponsorshipPage(organizationId, options)).items;
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

    /* Eelnev lugemine annab e-posti auditijälje jaoks; OTSUSE teeb nõue.
       Vahepeal vastu võetud või keeldutud sponsorlust ei tohi „tagasi võtta". */
    const claimed = await claimPendingSponsorship(
      tx,
      { id: sponsorshipId, organizationId },
      {
        status: OrganizationClientSponsorshipStatus.REVOKED,
        revokedAt: now,
        revokedByUserId: actorUserId
      }
    );
    if (!claimed) throw conflict("org.errors.sponsorship_not_pending");
    const updated = await tx.organizationClientSponsorship.findUnique({ where: { id: sponsorshipId } });

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

    /* NÕUE ENNE TELLIMUST (SOL-ORG-06). Varem kirjutati `Subscription` esimesena
       ja sponsorluse olek alles pärast — paralleelne tagasivõtmine sai vahele
       jääda ja lõppseis oli aktiivne tellimus organisatsiooni kulul kutse all,
       mis oli `REVOKED`. Nõue on nüüd tehingu esimene kirjutus: kes ta kaotab,
       ei jõua tellimuseni. */
    const claimed = await claimPendingSponsorship(
      tx,
      { id: row.id },
      {
        status: OrganizationClientSponsorshipStatus.ACCEPTED,
        acceptedAt: now,
        acceptedByUserId: userId
      }
    );
    /* Kaotaja saab SAMA vastuse mis kasutatud kutse — see EI OLE eriharu, vaid
       täpselt seesama olukord: kutset ei saa enam vastu võtta. */
    if (!claimed) throw notFound(inviteRejectionMessageKey("NOT_PENDING"));

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

    /* SOL-PAY-04: päritolu kirjutatakse TERVIKUNA. Vana kuju jättis varasema
       hosti-sponsorluse `sponsorUserId`/`inviteId` rea külge, seega ühel real
       võis korraga seista kaks maksjat. */
    const data = {
      status: "ACTIVE",
      plan,
      planDefinitionId,
      ...organizationSponsorOrigin({ organizationId: row.organizationId, sponsorshipId: row.id }),
      validUntil,
      nextBilling: null,
      canceledAt: null
    };

    if (existing) {
      await tx.subscription.update({ where: { id: existing.id }, data });
    } else {
      await tx.subscription.create({ data: { userId, ...data } });
    }

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

    const claimed = await claimPendingSponsorship(
      tx,
      { id: row.id },
      { status: OrganizationClientSponsorshipStatus.DECLINED, declinedAt: now }
    );
    if (!claimed) throw notFound(inviteRejectionMessageKey("NOT_PENDING"));
    const updated = await tx.organizationClientSponsorship.findUnique({ where: { id: row.id } });

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
