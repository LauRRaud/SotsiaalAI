/**
 * KODUTEENUS K5-w — transpordi soov ja järgmine sõit (kava II.6.14, variandi A esimene samm).
 *
 * Kliendi arsti juurde või asjaajamisele viimine on koduabi toiming, aga sõidu korraldab
 * teine inimene ja praegu käib see telefoniga. Siin paneb kliendi meeskonna liige või
 * hooldusjuht kirja soovi („Telli transport": päev, kellaaeg, sihtkoht, mida on vaja), ja
 * hooldusjuht vastab: korraldatud (mis kell auto tuleb) või ei saa (põhjusega). Korraldatud
 * sõit on kliendi lehel ja selle päeva käigu juures näha, et hooldaja saaks kliendi valmis
 * panna.
 *
 * Sõitu ennast platvorm ei korralda ega telli: see on kokkuleppe jälg osutaja sees. Autojuhi
 * vaade ja sõidukite plaan tulevad siis, kui transport tuleb platvormile üle (variant B).
 *
 * Ridu ei kustutata: soov võetakse tagasi või saab vastuse. Loevad kõik, kes kliendi lehte
 * näevad (ka põhjusega avaja: just asendaja peab teadma, et täna on sõit).
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, organizationTimeZone, requireClientAccess, requireClientCoordinator } from "./access.js";
import { CARE_TRANSPORT_ANSWERS, CareClientStatus, CareTransportState, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { renderTransportCardHtml } from "./transportCardDocument.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeLine } from "./validation.js";

const REQUEST_SELECT = {
  id: true,
  clientId: true,
  wantedOn: true,
  wantedTime: true,
  destination: true,
  needs: true,
  requestedByMembershipId: true,
  requestedByName: true,
  createdAt: true,
  state: true,
  pickupTime: true,
  answerNote: true,
  answeredByName: true
};

function pad(value) {
  return String(value).padStart(2, "0");
}

/** Kellaaeg kujule `TT:MM`. Lubab ka „9.40" ja „9:40". Tühi on `null`. Puhas funktsioon. */
export function normalizeClock(value, errorKey = "home_care.errors.transport_time") {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(String(value).trim());
  if (!match) throw badRequest(errorKey);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw badRequest(errorKey);
  return `${pad(hour)}:${pad(minute)}`;
}

/** Soovi sisend: päev (täna kuni pool aastat ette) ja sihtkoht on kohustuslikud. Puhas funktsioon. */
export function normalizeTransportRequest(rawInput, today) {
  const input = asObject(rawInput);
  const parts = normalizeIsoDay(input.wantedOn);
  if (!parts) throw badRequest("home_care.errors.transport_day");
  const wantedOn = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  const ahead = daysBetween(today, wantedOn);
  if (ahead < 0 || ahead > HOME_CARE_LIMITS.TRANSPORT_AHEAD_DAYS) throw badRequest("home_care.errors.transport_day");
  return {
    wantedOn,
    wantedTime: normalizeClock(input.wantedTime),
    destination: normalizeLine(input.destination, HOME_CARE_LIMITS.TRANSPORT_TEXT_MAX, { required: true, errorKey: "home_care.errors.transport_destination" }),
    needs: normalizeLine(input.needs, HOME_CARE_LIMITS.TRANSPORT_TEXT_MAX) || null
  };
}

/** Vastuse sisend: „korraldatud" (kellaaeg ja märkus soovi korral) või „ei saa" (põhjus kohustuslik). Puhas funktsioon. */
export function normalizeTransportAnswer(rawInput) {
  const input = asObject(rawInput);
  const state = normalizeEnum(input.state, CARE_TRANSPORT_ANSWERS, "home_care.errors.transport_answer");
  const answerNote = normalizeLine(input.answerNote, HOME_CARE_LIMITS.TRANSPORT_TEXT_MAX) || null;
  if (state === CareTransportState.DECLINED) {
    if (!answerNote) throw badRequest("home_care.errors.transport_decline_reason");
    return { state, pickupTime: null, answerNote };
  }
  return { state, pickupTime: normalizeClock(input.pickupTime), answerNote };
}

/** Kellaaeg, mille järgi klient valmis pannakse: auto tuleku aeg, selle puudumisel soovitud aeg. Puhas funktsioon. */
export function rideClock(row) {
  return row.pickupTime || row.wantedTime || null;
}

function serialize(row, viewerMembershipId) {
  return {
    id: row.id,
    wantedOn: row.wantedOn,
    wantedTime: row.wantedTime || null,
    destination: row.destination,
    needs: row.needs || null,
    requestedByName: row.requestedByName || null,
    isMine: Boolean(viewerMembershipId && row.requestedByMembershipId === viewerMembershipId),
    state: row.state,
    pickupTime: row.pickupTime || null,
    answerNote: row.answerNote || null,
    answeredByName: row.answeredByName || null
  };
}

/** Kliendi eesolevad sõidud ja soovid (ka eilne päev, et vastus ei kaoks kohe). Tagasi võetud soove ei näidata. */
export async function loadTransportWithin(tx, clientId, { today, viewerMembershipId = null }) {
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const rows = await tx.careTransportRequest.findMany({
    where: { clientId, state: { not: CareTransportState.WITHDRAWN }, wantedOn: { gte: yesterday.toISOString().slice(0, 10) } },
    select: REQUEST_SELECT,
    orderBy: [{ wantedOn: "asc" }, { wantedTime: "asc" }, { createdAt: "asc" }],
    take: HOME_CARE_LIMITS.TRANSPORT_SHOWN
  });
  const requests = rows.map((row) => serialize(row, viewerMembershipId));
  /* Järgmine sõit: esimene korraldatud sõit tänasest alates. */
  const next = requests.find((row) => row.state === CareTransportState.ARRANGED && row.wantedOn >= today) || null;
  return { requests, next: next ? { id: next.id, wantedOn: next.wantedOn, time: rideClock(next), destination: next.destination } : null };
}

async function writeTransportAudit(tx, context, clientId, requestId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_TRANSPORT_CHANGED,
    resourceType: OrgAuditResource.CARE_TRANSPORT_REQUEST,
    resourceId: requestId,
    meta: { organizationId: context.organization.id, clientId, change }
  });
}

/** „Telli transport": soov hooldusjuhi nimekirja. Kliendi meeskonna liige või hooldusjuht; põhjusega avaja ei telli. */
export async function requestTransport(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const today = todayText(now, organizationTimeZone(context));
  const data = normalizeTransportRequest(input, today);
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id || null;

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now, lock: true });
    if (!access.isCoordinator && !access.isTeam) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
    if (access.client.status === CareClientStatus.ENDED) throw conflict("home_care.errors.client_ended");
    const open = await tx.careTransportRequest.count({ where: { clientId: id, state: CareTransportState.REQUESTED } });
    if (open >= HOME_CARE_LIMITS.TRANSPORT_OPEN_MAX) throw badRequest("home_care.errors.transport_too_many", { limit: HOME_CARE_LIMITS.TRANSPORT_OPEN_MAX });
    const row = await tx.careTransportRequest.create({
      data: { organizationId, clientId: id, ...data, requestedByMembershipId: membershipId, requestedByName: await membershipDisplayName(tx, context), createdAt: now },
      select: { id: true }
    });
    await writeTransportAudit(tx, context, id, row.id, "requested");
    return { requestId: row.id, transport: await loadTransportWithin(tx, id, { today, viewerMembershipId: membershipId }) };
  });
}

/** Hooldusjuhi vastus soovile: korraldatud või ei saa. Vastus pannakse ootel soovile, üks kord. */
export async function answerTransport(context, clientId, requestId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const rowId = normalizeId(requestId, "home_care.errors.transport_not_found");
  const today = todayText(now, organizationTimeZone(context));
  const data = normalizeTransportAnswer(input);
  const membershipId = context.membership?.id || null;

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const row = await tx.careTransportRequest.findFirst({ where: { id: rowId, clientId: id }, select: { id: true, state: true } });
    if (!row) throw notFound("home_care.errors.transport_not_found");
    if (row.state !== CareTransportState.REQUESTED) throw conflict("home_care.errors.transport_closed");
    const changed = await tx.careTransportRequest.updateMany({
      where: { id: rowId, state: CareTransportState.REQUESTED },
      data: { ...data, answeredAt: now, answeredByMembershipId: membershipId, answeredByName: await membershipDisplayName(tx, context) }
    });
    if (changed.count !== 1) throw conflict("home_care.errors.transport_closed");
    await writeTransportAudit(tx, context, id, rowId, data.state === CareTransportState.ARRANGED ? "arranged" : "declined");
    return { transport: await loadTransportWithin(tx, id, { today, viewerMembershipId: membershipId }) };
  });
}

/**
 * Võtab soovi või sõidu tagasi (klient ei lähe, aeg tühistati). Ootel soovi võtab tagasi
 * selle esitaja või hooldusjuht; korraldatud sõidu ainult hooldusjuht, sest see tuleb ka
 * transpordi korraldajaga tühistada.
 */
export async function withdrawTransport(context, clientId, requestId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const rowId = normalizeId(requestId, "home_care.errors.transport_not_found");
  const today = todayText(now, organizationTimeZone(context));
  const membershipId = context.membership?.id || null;

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now, lock: true });
    const row = await tx.careTransportRequest.findFirst({ where: { id: rowId, clientId: id }, select: { id: true, state: true, requestedByMembershipId: true } });
    if (!row) throw notFound("home_care.errors.transport_not_found");
    const mine = Boolean(membershipId && row.requestedByMembershipId === membershipId);
    const allowed = access.isCoordinator || (mine && access.isTeam && row.state === CareTransportState.REQUESTED);
    if (!allowed) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
    if (row.state !== CareTransportState.REQUESTED && row.state !== CareTransportState.ARRANGED) throw conflict("home_care.errors.transport_closed");
    const changed = await tx.careTransportRequest.updateMany({
      where: { id: rowId, state: row.state },
      data: { state: CareTransportState.WITHDRAWN, withdrawnAt: now, withdrawnByMembershipId: membershipId }
    });
    if (changed.count !== 1) throw conflict("home_care.errors.transport_closed");
    await writeTransportAudit(tx, context, id, rowId, "withdrawn");
    return { transport: await loadTransportWithin(tx, id, { today, viewerMembershipId: membershipId }) };
  });
}

/** Tähtaegade vaatele: soovid, mis ootavad korraldamist, varasem sõit ees. */
export async function loadTransportOpen(db, organizationId, clientScope, { today }) {
  const rows = await db.careTransportRequest.findMany({
    where: { organizationId, state: CareTransportState.REQUESTED, wantedOn: { gte: today }, client: clientScope },
    select: { id: true, wantedOn: true, wantedTime: true, destination: true, requestedByName: true, client: { select: { id: true, displayName: true, status: true } } },
    orderBy: [{ wantedOn: "asc" }, { wantedTime: "asc" }, { createdAt: "asc" }],
    take: HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX
  });
  return rows.map((row) => ({
    key: row.id,
    client: row.client,
    wantedOn: row.wantedOn,
    wantedTime: row.wantedTime || null,
    destination: row.destination,
    requestedByName: row.requestedByName || null,
    daysLeft: daysBetween(today, row.wantedOn)
  }));
}

/**
 * Korraldatud sõidud päevade vahemikus: võti `klient:päev`. Päevaplaani ja töötaja päeva
 * käigu juurde, et hooldaja saaks kliendi sõiduks valmis panna.
 */
export async function loadRides(db, organizationId, clientIds, fromDay, toDay) {
  const ids = [...new Set(clientIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await db.careTransportRequest.findMany({
    where: { organizationId, clientId: { in: ids }, state: CareTransportState.ARRANGED, wantedOn: { gte: fromDay, lte: toDay } },
    select: { clientId: true, wantedOn: true, wantedTime: true, pickupTime: true, destination: true },
    orderBy: [{ wantedOn: "asc" }, { pickupTime: "asc" }, { wantedTime: "asc" }, { createdAt: "asc" }]
  });
  const rides = new Map();
  /* Kui samal päeval on mitu sõitu, on käigu juures esimene. */
  for (const row of rows) {
    const key = `${row.clientId}:${row.wantedOn}`;
    if (!rides.has(key)) rides.set(key, { time: rideClock(row), destination: row.destination });
  }
  return rides;
}

/**
 * Transpordikaart prinditava dokumendina (K5-y): kliendi nimi, aadress ja telefon, autojuhile
 * nähtavaks märgitud püsikaardi read ja eesolevad sõidud. Hooldusjuht ja kliendi meeskond.
 * Leht läheb asutusest välja (transpordi korraldajale), seepärast jääb väljaandmisest
 * auditirida; lehe sisu sinna ei lähe.
 */
export async function getTransportCard(context, clientId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const today = todayText(now, organizationTimeZone(context));

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    if (!access.isCoordinator && !access.isTeam) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
    const client = await tx.careClient.findFirst({ where: { id, organizationId: context.organization.id }, select: { address: true, contactPhone: true } });
    const lines = await tx.careClientCardLine.findMany({
      where: { clientId: id, endedAt: null, forDriver: true },
      select: { text: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }]
    });
    const rides = await tx.careTransportRequest.findMany({
      where: { clientId: id, wantedOn: { gte: today }, state: { in: [CareTransportState.REQUESTED, CareTransportState.ARRANGED] } },
      select: { wantedOn: true, wantedTime: true, pickupTime: true, destination: true, needs: true, state: true },
      orderBy: [{ wantedOn: "asc" }, { wantedTime: "asc" }, { createdAt: "asc" }],
      take: HOME_CARE_LIMITS.TRANSPORT_SHOWN
    });
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_TRANSPORT_CHANGED,
      resourceType: OrgAuditResource.CARE_CLIENT,
      resourceId: id,
      meta: { organizationId: context.organization.id, clientId: id, change: "card_issued" }
    });
    return {
      html: renderTransportCardHtml({
        clientName: access.client.displayName,
        address: client?.address || null,
        phone: client?.contactPhone || null,
        organizationName: context.organization.displayName || "",
        lines: lines.map((row) => row.text),
        rides: rides.map((row) => ({ wantedOn: row.wantedOn, time: rideClock(row), destination: row.destination, needs: row.needs || null, arranged: row.state === CareTransportState.ARRANGED })),
        issuedOn: today,
        locale: context.organization.defaultLocale || "et"
      })
    };
  });
}
