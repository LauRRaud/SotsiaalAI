/**
 * KODUTEENUS K6-k — „Soovin sellest rääkida" (kava II.6.3, pärast rasket käiku).
 *
 * Hooldaja töötab üksi. Raske juhtumi järel (agressiivsus, õnnetus, inimese leidmine maast,
 * väärkohtlemise kahtlus) saab erijuhtumi autor ühe puudutusega öelda, et soovib sellest
 * rääkida. Soov ei kanna teksti: hooldusjuht saab teada, KES soovib rääkida ja mis juhtumi
 * järel, mitte seda, mida töötaja tunneb. Teavitus hooldusjuhile kannab ainult rea ID-d.
 *
 * Soovi näevad esitaja ise ja hooldusjuht; kliendi meeskond seda ei näe ega saa sellest
 * teada. Esitaja saab lahtise soovi tagasi võtta; hooldusjuht märgib, et rääkimine on
 * toimunud. Rida ei kustutata. Mida räägiti, siia ei kirjutata.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, requireClientAccess, requireClientCoordinator } from "./access.js";
import { CARE_TALK_INCIDENT_TYPES, CareEntryKind, HOME_CARE_LIMITS } from "./constants.js";
import { notifyCoordinatorsOfTalk } from "./notify.js";
import { normalizeId } from "./validation.js";

const TALK_SELECT = Object.freeze({
  id: true,
  entryId: true,
  membershipId: true,
  requesterName: true,
  createdAt: true,
  handledAt: true,
  handledByName: true
});

/**
 * Kas selle kirje juures saab rääkimist soovida: `null`, kui saab, muidu vea võti. Ainult
 * tühistamata raske erijuhtum ja ainult selle autor või kaasas käinud paariline. Puhas funktsioon.
 */
export function talkRefusal(entry, membershipId) {
  if (!entry || entry.kind !== CareEntryKind.INCIDENT || entry.retractedAt) return "home_care.errors.talk_not_incident";
  if (!CARE_TALK_INCIDENT_TYPES.includes(entry.incidentType)) return "home_care.errors.talk_not_incident";
  if (!membershipId || (entry.authorMembershipId !== membershipId && entry.companionMembershipId !== membershipId)) return "home_care.errors.talk_not_author";
  return null;
}

/** Soov vaatesse. Esitaja nime näeb ainult hooldusjuht; esitaja teab, et soov on tema oma. Puhas funktsioon. */
export function serializeTalk(row, viewerMembershipId) {
  const mine = Boolean(viewerMembershipId && row.membershipId === viewerMembershipId);
  return {
    id: row.id,
    state: row.handledAt ? "HANDLED" : "OPEN",
    mine,
    requesterName: mine ? null : row.requesterName || null,
    requestedAt: new Date(row.createdAt).toISOString(),
    handledAt: row.handledAt ? new Date(row.handledAt).toISOString() : null,
    handledByName: row.handledByName || null
  };
}

/**
 * Kirjete juurde käivad soovid: kaart kirje ID → viimane tagasi võtmata soov. Hooldusjuht näeb
 * kõigi omi, teised ainult enda oma.
 */
export async function loadTalkStates(tx, { entryIds, viewerMembershipId, isCoordinator }) {
  const talks = new Map();
  if (!entryIds.length || (!isCoordinator && !viewerMembershipId)) return talks;
  const rows = await tx.careTalkRequest.findMany({
    where: { entryId: { in: entryIds }, withdrawnAt: null, ...(isCoordinator ? {} : { membershipId: viewerMembershipId }) },
    select: TALK_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
  for (const row of rows) {
    if (!talks.has(row.entryId)) talks.set(row.entryId, serializeTalk(row, viewerMembershipId));
  }
  return talks;
}

async function writeTalkAudit(tx, context, clientId, entryId, requestId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_TALK_REQUEST_CHANGED,
    resourceType: OrgAuditResource.CARE_TALK_REQUEST,
    resourceId: requestId,
    meta: { organizationId: context.organization.id, clientId, entryId, change }
  });
}

/**
 * Erijuhtumi autor soovib sellest rääkida. Kordusvajutus annab sama lahtise soovi tagasi.
 * `notify: null` jätab teavituse saatmata (testides).
 */
export async function requestTalk(context, clientId, entryId, { db = prisma, now = new Date(), env = process.env, notify = notifyCoordinatorsOfTalk } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");
  const membershipId = context.membership?.id || null;

  const result = await db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now, lock: true });
    const entry = await tx.careClientEntry.findFirst({
      where: { id: entryKey, clientId: id, organizationId: context.organization.id },
      select: { id: true, kind: true, incidentType: true, retractedAt: true, authorMembershipId: true, companionMembershipId: true }
    });
    if (!entry) throw notFound("home_care.errors.entry_not_found");
    const refusal = talkRefusal(entry, membershipId);
    if (refusal === "home_care.errors.talk_not_author") throw forbidden(refusal);
    if (refusal) throw badRequest(refusal);

    const open = await tx.careTalkRequest.findFirst({
      where: { entryId: entryKey, membershipId, withdrawnAt: null, handledAt: null },
      select: TALK_SELECT
    });
    if (open) return { talk: serializeTalk(open, membershipId), created: false, unitId: access.client.unitId || null, requestId: open.id };

    const created = await tx.careTalkRequest.create({
      data: {
        organizationId: context.organization.id,
        clientId: id,
        entryId: entryKey,
        membershipId,
        requesterName: await membershipDisplayName(tx, context),
        createdAt: now
      },
      select: TALK_SELECT
    });
    await writeTalkAudit(tx, context, id, entryKey, created.id, "requested");
    return { talk: serializeTalk(created, membershipId), created: true, unitId: access.client.unitId || null, requestId: created.id };
  });

  if (result.created && notify) {
    await notify({ requestId: result.requestId, organizationId: context.organization.id, unitId: result.unitId, actorMembershipId: membershipId }, { db, now });
  }
  return { talk: result.talk };
}

/** Esitaja võtab oma lahtise soovi tagasi. Räägituks märgitud soovi tagasi võtta ei saa. */
export async function withdrawTalk(context, clientId, entryId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");
  const membershipId = context.membership?.id || null;

  return db.$transaction(async (tx) => {
    await requireClientAccess(tx, context, id, { now, lock: true });
    const row = await tx.careTalkRequest.findFirst({
      where: { entryId: entryKey, clientId: id, membershipId, withdrawnAt: null },
      select: { id: true, handledAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
    if (!row) throw notFound("home_care.errors.talk_not_found");
    if (row.handledAt) throw conflict("home_care.errors.talk_handled");
    await tx.careTalkRequest.updateMany({ where: { id: row.id, withdrawnAt: null, handledAt: null }, data: { withdrawnAt: now } });
    await writeTalkAudit(tx, context, id, entryKey, row.id, "withdrawn");
    return { talk: null };
  });
}

/** Hooldusjuht märgib, et rääkimine on toimunud. Mida räägiti, siia ei kirjutata. */
export async function handleTalk(context, requestId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const targetId = normalizeId(requestId, "home_care.errors.talk_not_found");

  return db.$transaction(async (tx) => {
    const row = await tx.careTalkRequest.findFirst({
      where: { id: targetId, organizationId: context.organization.id },
      select: { id: true, clientId: true, entryId: true, withdrawnAt: true, handledAt: true }
    });
    if (!row) throw notFound("home_care.errors.talk_not_found");
    await requireClientCoordinator(tx, context, row.clientId, { lock: true, now });
    if (row.withdrawnAt) throw conflict("home_care.errors.talk_withdrawn");
    if (row.handledAt) throw conflict("home_care.errors.talk_handled");
    await tx.careTalkRequest.updateMany({
      where: { id: targetId, withdrawnAt: null, handledAt: null },
      data: { handledAt: now, handledByMembershipId: context.membership?.id || null, handledByName: await membershipDisplayName(tx, context) }
    });
    await writeTalkAudit(tx, context, row.clientId, row.entryId, targetId, "handled");
    const fresh = await tx.careTalkRequest.findUnique({ where: { id: targetId }, select: TALK_SELECT });
    return { talk: serializeTalk(fresh, context.membership?.id || null) };
  });
}

/** Tähtaegade vaatele: lahtised soovid hooldusjuhi ulatuses, vanem ees. Lõppenud teenusega kliendi juhtumi soov jääb nimekirja. */
export async function loadTalkRequestsOpen(db, { organizationId, clientWhere = {} }) {
  const rows = await db.careTalkRequest.findMany({
    where: { organizationId, withdrawnAt: null, handledAt: null, ...(Object.keys(clientWhere).length ? { client: clientWhere } : {}) },
    select: {
      id: true,
      entryId: true,
      requesterName: true,
      createdAt: true,
      client: { select: { id: true, displayName: true, status: true } },
      entry: { select: { incidentType: true, occurredAt: true } }
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.TALK_REQUESTS_OPEN_MAX
  });
  return rows.map((row) => ({
    id: row.id,
    entryId: row.entryId,
    requesterName: row.requesterName || "",
    requestedAt: row.createdAt.toISOString(),
    client: row.client,
    incidentType: row.entry?.incidentType || null,
    occurredAt: row.entry?.occurredAt ? row.entry.occurredAt.toISOString() : null
  }));
}
