/**
 * KODUTEENUS K5-e — töötaja kaart (kava II.6.10, juhendi ptk 3).
 *
 * Koduteenuse osutajalt oodatakse, et töötaja taust on kontrollitud ja väljaõpe olemas.
 * Töötaja kohta on kaks liiki ridu:
 *   - TAUSTAKONTROLL: ainult kuupäev ja soovi korral, millal kontrollitakse uuesti.
 *     Tulemust ega sisu siin EI HOITA: rida ütleb, et kontroll tehti, mitte mida see näitas.
 *   - KOOLITUS: teema, kuupäev ja soovi korral kehtivuse lõpp (näiteks esmaabi).
 *
 * Kaarti näeb ja täidab ainult kogu asutuse hooldusjuht: see on personaliinfo, mitte
 * meeskonna töövahend. Ridu ei muudeta ega kustutata; eemaldatud rida saab lõpu.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, forbidden, notFound } from "../org/errors.js";

import { loadCareWorkerIds } from "./absences.js";
import { assertHomeCareContext, coordinatorScope, membershipDisplayName, organizationTimeZone } from "./access.js";
import { CARE_WORKER_RECORD_KINDS, CareWorkerRecordKind, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeLine } from "./validation.js";

function pad(value) {
  return String(value).padStart(2, "0");
}

function dayText(parts) {
  return parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : null;
}

function requireWholeOrg(context) {
  if (!coordinatorScope(context)?.wholeOrg) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
}

/** Sisendi kuju: liik, päev, soovi korral kehtivus; koolitusel teema. Puhas funktsioon. */
export function normalizeWorkerRecord(rawInput, today) {
  const input = asObject(rawInput);
  const kind = normalizeEnum(input.kind, CARE_WORKER_RECORD_KINDS, "home_care.errors.worker_record_kind_required");
  const doneOn = dayText(normalizeIsoDay(input.doneOn));
  if (!doneOn) throw badRequest("home_care.errors.worker_record_day_required");
  if (doneOn > today) throw badRequest("home_care.errors.worker_record_day_future");
  const validUntil = dayText(normalizeIsoDay(input.validUntil));
  if (validUntil && validUntil < doneOn) throw badRequest("home_care.errors.worker_record_period_invalid");
  /* Taustakontrollil vaba teksti ei ole: tulemust ega sisu ei hoita. */
  const title =
    kind === CareWorkerRecordKind.TRAINING
      ? normalizeLine(input.title, HOME_CARE_LIMITS.WORKER_RECORD_TITLE_MAX, { required: true, errorKey: "home_care.errors.worker_record_title_required" })
      : null;
  return { kind, title, doneOn, validUntil };
}

/** Rea seis tänase päeva suhtes. Puhas funktsioon. */
export function workerRecordState(record, today) {
  if (!record.validUntil) return { daysLeft: null, expired: false, soon: false };
  const daysLeft = daysBetween(today, record.validUntil);
  return { daysLeft, expired: daysLeft < 0, soon: daysLeft >= 0 && daysLeft <= HOME_CARE_LIMITS.WORKER_RECORD_SOON_DAYS };
}

function serialize(row, today) {
  return { id: row.id, kind: row.kind, title: row.title || null, doneOn: row.doneOn, validUntil: row.validUntil || null, ...workerRecordState(row, today) };
}

const RECORD_SELECT = Object.freeze({ id: true, membershipId: true, kind: true, title: true, doneOn: true, validUntil: true });

async function loadCards(db, organizationId, today) {
  const workers = await loadCareWorkerIds(db, organizationId);
  const rows = workers.length
    ? await db.careWorkerRecord.findMany({
        where: { organizationId, endedAt: null, membershipId: { in: workers.map((worker) => worker.membershipId) } },
        select: RECORD_SELECT,
        orderBy: [{ doneOn: "desc" }, { id: "asc" }]
      })
    : [];
  return workers.map((worker) => {
    const records = rows.filter((row) => row.membershipId === worker.membershipId).map((row) => serialize(row, today));
    /* Kehtiv taustakontroll: viimane kontroll, mille kordamise päev ei ole möödas. */
    const checks = records.filter((record) => record.kind === CareWorkerRecordKind.BACKGROUND_CHECK);
    return { ...worker, records, backgroundChecked: checks.some((record) => !record.expired), backgroundMissing: checks.length === 0 };
  });
}

/** Töötajate kaardid kogu asutuse hooldusjuhile: iga hooldaja ja tema kehtivad read. */
export async function getWorkerCards(context, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  requireWholeOrg(context);
  const today = todayText(now, organizationTimeZone(context));
  return { today, canEdit: Boolean(context.writable), workers: await loadCards(db, context.organization.id, today) };
}

/**
 * Tähtaegade lehe nimekiri: mis töötajate ridadest on aegunud või aegub varsti ja kellel
 * taustakontrolli rida puudub. Üksuse hooldusjuhile tagastatakse tühi nimekiri.
 */
export async function loadWorkerRecordsDue(db, context, today) {
  if (!coordinatorScope(context)?.wholeOrg) return [];
  const due = [];
  for (const worker of await loadCards(db, context.organization.id, today)) {
    if (worker.backgroundMissing) due.push({ key: `${worker.membershipId}:none`, worker: { membershipId: worker.membershipId, name: worker.name }, kind: "MISSING_BACKGROUND", title: null, validUntil: null, daysLeft: null, expired: false });
    for (const record of worker.records) {
      if (!record.expired && !record.soon) continue;
      due.push({ key: record.id, worker: { membershipId: worker.membershipId, name: worker.name }, kind: record.kind, title: record.title, validUntil: record.validUntil, daysLeft: record.daysLeft, expired: record.expired });
    }
  }
  /* Aegunud enne, siis varem aeguv; puuduva taustakontrolliga read lõpus. */
  return due.sort(
    (a, b) => (a.daysLeft === null) - (b.daysLeft === null) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0) || a.worker.name.localeCompare(b.worker.name, "et")
  );
}

async function writeRecordAudit(tx, context, membershipId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_WORKER_RECORD_CHANGED,
    resourceType: OrgAuditResource.CARE_WORKER_RECORD,
    resourceId: membershipId,
    meta: { organizationId: context.organization.id, membershipId, change }
  });
}

/** Lisab töötajale rea. Töötaja peab olema selle asutuse hooldaja (kellegi meeskonnas). */
export async function addWorkerRecord(context, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  requireWholeOrg(context);
  const today = todayText(now, organizationTimeZone(context));
  const membershipId = normalizeId(asObject(input).membershipId, "home_care.errors.worker_not_found");
  const data = normalizeWorkerRecord(input, today);
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const workers = await loadCareWorkerIds(tx, organizationId);
    if (!workers.some((worker) => worker.membershipId === membershipId)) throw notFound("home_care.errors.worker_not_found");
    const open = await tx.careWorkerRecord.count({ where: { organizationId, membershipId, endedAt: null } });
    if (open >= HOME_CARE_LIMITS.WORKER_RECORDS_MAX) throw badRequest("home_care.errors.worker_records_too_many", { limit: HOME_CARE_LIMITS.WORKER_RECORDS_MAX });
    await tx.careWorkerRecord.create({
      data: { ...data, organizationId, membershipId, createdByMembershipId: context.membership?.id || null, createdByName: await membershipDisplayName(tx, context), createdAt: now }
    });
    await writeRecordAudit(tx, context, membershipId, "added");
    return { today, canEdit: true, workers: await loadCards(tx, organizationId, today) };
  });
}

/** Eemaldab rea (ekslik või asendatud). Rida jääb ajalukku lõpuga. */
export async function endWorkerRecord(context, recordId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  requireWholeOrg(context);
  const id = normalizeId(recordId, "home_care.errors.worker_record_not_found");
  const organizationId = context.organization.id;
  const today = todayText(now, organizationTimeZone(context));

  return db.$transaction(async (tx) => {
    const record = await tx.careWorkerRecord.findFirst({ where: { id, organizationId, endedAt: null }, select: { id: true, membershipId: true } });
    if (!record) throw notFound("home_care.errors.worker_record_not_found");
    await tx.careWorkerRecord.updateMany({ where: { id, endedAt: null }, data: { endedAt: now, endedByMembershipId: context.membership?.id || null } });
    await writeRecordAudit(tx, context, record.membershipId, "removed");
    return { today, canEdit: true, workers: await loadCards(tx, organizationId, today) };
  });
}
