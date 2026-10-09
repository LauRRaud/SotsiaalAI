/**
 * KODUTEENUS kiht 2, K2-c — otsus ja maht kliendi juures.
 *
 * Koduteenust osutatakse haldusakti või halduslepingu alusel (SHS § 18 lg 2). Otsuse
 * teeb omavalitsus; asutus paneb siia kirja, MIS on otsustatud: kes otsustas, mis
 * numbriga, mis ajast mis ajani ja kui palju abi (tunde nädalas või kuus). Otsuse
 * dokument ise jääb sinna, kus see on (omavalitsuse dokumendihaldus, STAR).
 *
 * Kirje on asutuse ühine, mitte ühe töötaja oma: asendaja ja hooldusjuht näevad sama
 * otsust. Sellest loetakse hiljem „otsustatud maht" osutatud käikude kõrvale ja
 * tähtaegade vaade („lõpeb 30 päeva jooksul").
 *
 * Otsust ei kustutata. Ekslikult sisestatud otsus TÜHISTATAKSE (jääb hooldusjuhile
 * näha); parandus muudab kirjet ja jätab auditisse jälje. Kattuvad otsused on
 * lubatud (ajutine lisamaht), kehtivaks loetakse hiliseima algusega otsus.
 *
 * Loeb igaüks, kes tohib kliendi lehte avada: täna kehtivat otsust. Kõiki otsuseid
 * näeb ja muudab ainult hooldusjuht, kelle skoobis klient on.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, notFound } from "../org/errors.js";
import { zonedParts } from "../time/estonianDay.js";

import { assertHomeCareContext, membershipDisplayName, organizationTimeZone, requireClientAccess, requireClientCoordinator } from "./access.js";
import { CARE_DECISION_KINDS, CARE_VOLUME_PERIODS, CareDecisionState, CareVolumePeriod, HOME_CARE_LIMITS } from "./constants.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeLine, normalizeText, normalizeVersion } from "./validation.js";

const DECISION_SELECT = Object.freeze({
  id: true,
  kind: true,
  issuerName: true,
  documentNumber: true,
  decidedOn: true,
  validFrom: true,
  validUntil: true,
  volumeMinutes: true,
  volumePeriod: true,
  feeNote: true,
  note: true,
  version: true,
  createdByName: true,
  retractedAt: true,
  retractedByName: true,
  createdAt: true,
  updatedAt: true
});

function pad(value) {
  return String(value).padStart(2, "0");
}

/** `normalizeIsoDay` annab päeva osadena; otsuses hoitakse seda tekstina `AAAA-KK-PP`. */
function dayText(parts) {
  return parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : null;
}

/** Tänane päev asutuse ajavööndis kujul `AAAA-KK-PP`. */
export function todayText(now, timeZone) {
  const today = zonedParts(now, timeZone);
  return `${today.year}-${pad(today.month)}-${pad(today.day)}`;
}

/** Mitu päeva on päevast `from` päevani `to` (mõlemad `AAAA-KK-PP`); minevik on negatiivne. */
export function daysBetween(from, to) {
  const stamp = (text) => {
    const [year, month, day] = text.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((stamp(to) - stamp(from)) / 86_400_000);
}

/** Otsuse seis tänase päeva suhtes. Päevad on samal kujul tekstid, seega võrdlus on päevade järjekord. */
export function decisionState(row, today) {
  if (row.retractedAt) return CareDecisionState.RETRACTED;
  if (row.validFrom > today) return CareDecisionState.UPCOMING;
  if (row.validUntil && row.validUntil < today) return CareDecisionState.ENDED;
  return CareDecisionState.IN_FORCE;
}

function serializeDecision(row, today) {
  if (!row) return null;
  const state = decisionState(row, today);
  return {
    id: row.id,
    kind: row.kind,
    issuerName: row.issuerName || null,
    documentNumber: row.documentNumber || null,
    decidedOn: row.decidedOn || null,
    validFrom: row.validFrom,
    validUntil: row.validUntil || null,
    volumeMinutes: row.volumeMinutes ?? null,
    volumePeriod: row.volumePeriod || null,
    feeNote: row.feeNote || null,
    note: row.note || null,
    version: row.version,
    state,
    /* Mitu päeva kehtiv tähtajaline otsus veel kehtib (täna lõppev = 0). */
    daysLeft: state === CareDecisionState.IN_FORCE && row.validUntil ? daysBetween(today, row.validUntil) : null,
    createdByName: row.createdByName || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    retractedAt: row.retractedAt ? new Date(row.retractedAt).toISOString() : null,
    retractedByName: row.retractedByName || null
  };
}

/**
 * Maht sisendist. Ekraanil sisestatakse tunnid (ka „6,5"); hoitakse minutites.
 * Tühi tundide väli tähendab, et otsuses mahtu ei ole: siis ei ole ka perioodi.
 */
function normalizeVolume(input) {
  const raw = input.volumeHours;
  if (raw === undefined || raw === null || String(raw).trim() === "") return { volumeMinutes: null, volumePeriod: null };
  const text = String(raw).trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) throw badRequest("home_care.errors.decision_volume_invalid");
  const volumeMinutes = Math.round(Number(text) * 60);
  const volumePeriod = normalizeEnum(input.volumePeriod, CARE_VOLUME_PERIODS, "home_care.errors.decision_volume_period_required");
  const limit = volumePeriod === CareVolumePeriod.WEEK ? HOME_CARE_LIMITS.DECISION_WEEK_MINUTES_MAX : HOME_CARE_LIMITS.DECISION_MONTH_MINUTES_MAX;
  if (volumeMinutes < 1 || volumeMinutes > limit) throw badRequest("home_care.errors.decision_volume_invalid");
  return { volumeMinutes, volumePeriod };
}

function normalizeDecisionInput(rawInput) {
  const input = asObject(rawInput);
  const validFrom = dayText(normalizeIsoDay(input.validFrom));
  if (!validFrom) throw badRequest("home_care.errors.decision_valid_from_required");
  const validUntil = dayText(normalizeIsoDay(input.validUntil));
  if (validUntil && validUntil < validFrom) throw badRequest("home_care.errors.decision_period_invalid");
  return {
    kind: normalizeEnum(input.kind, CARE_DECISION_KINDS, "home_care.errors.decision_kind_required"),
    issuerName: normalizeLine(input.issuerName, HOME_CARE_LIMITS.DECISION_ISSUER_MAX),
    documentNumber: normalizeLine(input.documentNumber, HOME_CARE_LIMITS.DECISION_NUMBER_MAX),
    decidedOn: dayText(normalizeIsoDay(input.decidedOn)),
    validFrom,
    validUntil,
    ...normalizeVolume(input),
    feeNote: normalizeLine(input.feeNote, HOME_CARE_LIMITS.DECISION_FEE_NOTE_MAX),
    note: normalizeText(input.note, HOME_CARE_LIMITS.DECISION_NOTE_MAX)
  };
}

async function writeDecisionAudit(tx, context, clientId, decisionId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_DECISION_CHANGED,
    resourceType: OrgAuditResource.CARE_DECISION,
    resourceId: decisionId,
    meta: { organizationId: context.organization.id, clientId, decisionId, change }
  });
}

/** Täna kehtiv otsus: tühistamata, alanud ja lõppemata; mitme puhul hiliseima algusega. */
export async function loadCurrentDecisionWithin(tx, clientId, today) {
  const row = await tx.careDecision.findFirst({
    where: {
      clientId,
      retractedAt: null,
      validFrom: { lte: today },
      OR: [{ validUntil: null }, { validUntil: { gte: today } }]
    },
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: DECISION_SELECT
  });
  return serializeDecision(row, today);
}

async function loadAllWithin(tx, clientId, today) {
  const rows = await tx.careDecision.findMany({
    where: { clientId },
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: HOME_CARE_LIMITS.DECISIONS_MAX,
    select: DECISION_SELECT
  });
  return rows.map((row) => serializeDecision(row, today));
}

/** Otsuste vaade: kehtiv otsus kõigile lehe avajatele; kõik otsused hooldusjuhile. */
export async function getDecisions(context, clientId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const today = todayText(now, organizationTimeZone(context));
  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    const current = await loadCurrentDecisionWithin(tx, id, today);
    if (!access.isCoordinator) return { today, current, decisions: [], canEdit: false };
    return { today, current, decisions: await loadAllWithin(tx, id, today), canEdit: Boolean(context.writable) };
  });
}

/** Otsuste lehe algseis hooldusjuhile: klient ja kõik otsused. Muu on 403 (leht teeb sellest 404). */
export async function getDecisionEditor(context, clientId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const today = todayText(now, organizationTimeZone(context));
  return db.$transaction(async (tx) => {
    const access = await requireClientCoordinator(tx, context, id, { now });
    return {
      client: { id: access.client.id, displayName: access.client.displayName },
      today,
      current: await loadCurrentDecisionWithin(tx, id, today),
      decisions: await loadAllWithin(tx, id, today),
      canEdit: Boolean(context.writable)
    };
  });
}

async function viewAfterChange(tx, context, clientId, today) {
  return {
    today,
    current: await loadCurrentDecisionWithin(tx, clientId, today),
    decisions: await loadAllWithin(tx, clientId, today),
    canEdit: Boolean(context.writable)
  };
}

/** Lisab otsuse. Ainult hooldusjuht, kelle skoobis klient on. */
export async function createDecision(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const data = normalizeDecisionInput(input);
  const today = todayText(now, organizationTimeZone(context));

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const count = await tx.careDecision.count({ where: { clientId: id } });
    if (count >= HOME_CARE_LIMITS.DECISIONS_MAX) throw badRequest("home_care.errors.decision_too_many", { limit: HOME_CARE_LIMITS.DECISIONS_MAX });
    const created = await tx.careDecision.create({
      data: {
        ...data,
        organizationId: context.organization.id,
        clientId: id,
        createdByMembershipId: context.membership?.id || null,
        createdByName: await membershipDisplayName(tx, context)
      },
      select: { id: true }
    });
    await writeDecisionAudit(tx, context, id, created.id, "created");
    return { decisionId: created.id, ...(await viewAfterChange(tx, context, id, today)) };
  });
}

async function findOwnDecision(tx, clientId, decisionId) {
  const row = await tx.careDecision.findFirst({ where: { id: decisionId, clientId }, select: { id: true, version: true, retractedAt: true } });
  if (!row) throw notFound("home_care.errors.decision_not_found");
  return row;
}

/** Parandab otsuse kirjet. Muutja saadab versiooni, mida ta nägi; tühistatud otsust ei muudeta. */
export async function updateDecision(context, clientId, decisionId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(decisionId, "home_care.errors.decision_not_found");
  const version = normalizeVersion(asObject(input).version);
  const data = normalizeDecisionInput(input);
  const today = todayText(now, organizationTimeZone(context));

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const row = await findOwnDecision(tx, id, targetId);
    if (row.retractedAt) throw conflict("home_care.errors.decision_retracted");
    const result = await tx.careDecision.updateMany({
      where: { id: targetId, version, retractedAt: null },
      data: { ...data, version: { increment: 1 } }
    });
    if (result.count !== 1) throw conflict("home_care.errors.version_conflict", { currentVersion: row.version });
    await writeDecisionAudit(tx, context, id, targetId, "updated");
    return viewAfterChange(tx, context, id, today);
  });
}

/** Tühistab ekslikult sisestatud otsuse. Rida jääb alles ja on hooldusjuhile näha. */
export async function retractDecision(context, clientId, decisionId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(decisionId, "home_care.errors.decision_not_found");
  const version = normalizeVersion(asObject(input).version);
  const today = todayText(now, organizationTimeZone(context));

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const row = await findOwnDecision(tx, id, targetId);
    if (row.retractedAt) throw conflict("home_care.errors.decision_retracted");
    const result = await tx.careDecision.updateMany({
      where: { id: targetId, version, retractedAt: null },
      data: {
        retractedAt: now,
        retractedByMembershipId: context.membership?.id || null,
        retractedByName: await membershipDisplayName(tx, context),
        version: { increment: 1 }
      }
    });
    if (result.count !== 1) throw conflict("home_care.errors.version_conflict", { currentVersion: row.version });
    await writeDecisionAudit(tx, context, id, targetId, "retracted");
    return viewAfterChange(tx, context, id, today);
  });
}
