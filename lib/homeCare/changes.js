/**
 * KODUTEENUS K5-a — „Kas täna oli midagi teisiti?" (kava II.6.2).
 *
 * Kui klienti jagab mitu hooldajat, näeb igaüks teda harva ja aeglast muutust ei märka
 * keegi. Seepärast kannab muutust süsteem, kolmes osas:
 *
 *   1. TAVALINE SEIS. Kliendi juures on lühike kirjeldus sellest, kuidas tal tavaliselt
 *      läheb, kuues valdkonnas. Selle järgi saab iga hooldaja muutust hinnata.
 *   2. ÜKS KÜSIMUS KÄIGU LÕPUS. „Ei" on üks puudutus; „jah" küsib valdkonna ja ühe lause.
 *      Vastus on käigu kirje osa (vt `entries.js`), siin on ainult reegel.
 *   3. MÄRKAMINE SAAB VASTUSE. Kui kaks eri hooldajat märgivad 14 päeva jooksul sama
 *      valdkonna või üks märgib suure muutuse, tekib hooldusjuhile märkamine, mis vajab
 *      vastust. Toode ei luba tervisetulemust: ta lubab, et märkamine jõuab vastutajani.
 *
 * Tavalist seisu muudavad kliendi meeskond ja hooldusjuht (nagu püsikaarti); loeb igaüks,
 * kes tohib kliendi lehte avada. Märkamisi näeb ja neile vastab hooldusjuht. Ridu ei
 * muudeta ega kustutata: uus tekst lõpetab eelmise.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";

import { assertHomeCareContext, coordinatorScope, membershipDisplayName, organizationTimeZone, requireClientAccess, requireClientCoordinator } from "./access.js";
import { CARE_CHANGE_AREAS, CARE_CHANGE_OUTCOMES, CareChangeAnswer, CareChangeReason, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { asObject, normalizeEnum, normalizeId, normalizeLine } from "./validation.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const areaOrder = (area) => CARE_CHANGE_AREAS.indexOf(area);

/** Kliendi kehtiv tavaline seis valdkondade kindlas järjekorras. */
export async function loadUsualStateWithin(tx, clientId) {
  const rows = await tx.careUsualState.findMany({
    where: { clientId, endedAt: null },
    select: { id: true, area: true, text: true, createdByName: true, createdAt: true }
  });
  return rows
    .sort((a, b) => areaOrder(a.area) - areaOrder(b.area))
    .map((row) => ({ id: row.id, area: row.area, text: row.text, byName: row.createdByName || "", at: row.createdAt.toISOString() }));
}

/** Sisend on `{ areas: { MOBILITY: "tekst", … } }`; puuduv valdkond jääb puutumata, tühi tekst lõpetab rea. Puhas funktsioon. */
export function normalizeUsualState(rawInput) {
  const areas = asObject(asObject(rawInput).areas);
  const result = {};
  for (const key of Object.keys(areas)) {
    if (!CARE_CHANGE_AREAS.includes(key)) throw badRequest("home_care.errors.change_area_invalid");
    result[key] = normalizeLine(areas[key], HOME_CARE_LIMITS.USUAL_STATE_TEXT_MAX) || "";
  }
  return result;
}

/** Salvestab muutunud valdkonnad: eelmine rida lõpeb ja uus tekib. Muutmata tekst ei tee midagi. */
export async function saveUsualState(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const wanted = normalizeUsualState(input);

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { lock: true, now });
    /* Põhjusega avaja loeb, aga kirjeldust ei muuda. */
    if (!access.isCoordinator && !access.isTeam) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });

    const current = new Map((await loadUsualStateWithin(tx, id)).map((row) => [row.area, row]));
    const changed = Object.keys(wanted).filter((area) => (current.get(area)?.text || "") !== wanted[area]);
    if (!changed.length) return { usualState: [...current.values()] };

    const membershipId = context.membership?.id || null;
    const createdByName = await membershipDisplayName(tx, context);
    await tx.careUsualState.updateMany({
      where: { clientId: id, endedAt: null, area: { in: changed } },
      data: { endedAt: now, endedByMembershipId: membershipId }
    });
    const fresh = changed.filter((area) => wanted[area]);
    if (fresh.length) {
      await tx.careUsualState.createMany({
        data: fresh.map((area) => ({
          organizationId: context.organization.id,
          clientId: id,
          area,
          text: wanted[area],
          createdByMembershipId: membershipId,
          createdByName,
          createdAt: now
        }))
      });
    }
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_USUAL_STATE_CHANGED,
      resourceType: OrgAuditResource.CARE_CLIENT,
      resourceId: id,
      meta: { organizationId: context.organization.id, clientId: id, change: "saved" }
    });
    return { usualState: await loadUsualStateWithin(tx, id) };
  });
}

/**
 * Reegel pärast käigu kirje salvestamist, SAMAS tehingus. Tagastab loodud märkamiste ID-d.
 *
 *   - suur muutus avab märkamise kohe;
 *   - muidu avab selle teise hooldaja sama valdkonna märge 14 päeva sees. Märge, mis on
 *     tehtud enne selle valdkonna viimast vastust, on juba vastuse saanud ja ei loe.
 *
 * Kliendi ja valdkonna kohta on üks lahtine märkamine (osaline unikaalne indeks);
 * `skipDuplicates` jätab tehingu terveks, kui teine kirje jõudis samal hetkel ette.
 */
export async function openChangeSignalsWithin(tx, { organizationId, clientId, entryId, authorMembershipId, occurredAt, areas, major, now }) {
  const opened = [];
  for (const area of areas) {
    const open = await tx.careChangeSignal.findFirst({ where: { clientId, area, handledAt: null }, select: { id: true } });
    if (open) continue;
    let reason = major ? CareChangeReason.MAJOR : null;
    if (!reason) {
      const answered = await tx.careChangeSignal.findFirst({
        where: { clientId, area, handledAt: { not: null } },
        orderBy: { handledAt: "desc" },
        select: { handledAt: true }
      });
      const window = HOME_CARE_LIMITS.CHANGE_WINDOW_DAYS * DAY_MS;
      const other = await tx.careClientEntry.findFirst({
        where: {
          clientId,
          id: { not: entryId },
          retractedAt: null,
          changeAnswer: CareChangeAnswer.YES,
          changeAreas: { has: area },
          authorMembershipId: { not: authorMembershipId },
          occurredAt: { gte: new Date(occurredAt.getTime() - window), lte: new Date(occurredAt.getTime() + window) },
          ...(answered ? { createdAt: { gt: answered.handledAt } } : {})
        },
        select: { id: true }
      });
      if (other) reason = CareChangeReason.TWO_WORKERS;
    }
    if (!reason) continue;
    const { count } = await tx.careChangeSignal.createMany({
      data: [{ organizationId, clientId, area, reason, entryId, openedAt: now }],
      skipDuplicates: true
    });
    if (count !== 1) continue;
    const made = await tx.careChangeSignal.findFirst({ where: { clientId, area, handledAt: null }, select: { id: true } });
    if (made) opened.push(made.id);
  }
  return opened;
}

function serializeSignal(row, today, timeZone) {
  const openedOn = todayText(row.openedAt, timeZone);
  return {
    id: row.id,
    area: row.area,
    reason: row.reason,
    openedAt: row.openedAt.toISOString(),
    days: daysBetween(openedOn, today),
    handledAt: row.handledAt ? row.handledAt.toISOString() : null,
    handledByName: row.handledByName || null,
    outcome: row.outcome || null,
    note: row.note || null
  };
}

const SIGNAL_SELECT = Object.freeze({
  id: true,
  clientId: true,
  area: true,
  reason: true,
  openedAt: true,
  handledAt: true,
  handledByName: true,
  outcome: true,
  note: true
});

/** Kliendi lahtised märkamised ja viimased vastatud. Ainult hooldusjuhile (kutsuja kontrollib). */
export async function loadChangeSignalsWithin(tx, clientId, { now, timeZone }) {
  const today = todayText(now, timeZone);
  const open = await tx.careChangeSignal.findMany({ where: { clientId, handledAt: null }, select: SIGNAL_SELECT, orderBy: [{ openedAt: "asc" }] });
  const handled = await tx.careChangeSignal.findMany({
    where: { clientId, handledAt: { not: null } },
    select: SIGNAL_SELECT,
    orderBy: [{ handledAt: "desc" }],
    take: HOME_CARE_LIMITS.CHANGE_HANDLED_SHOWN
  });
  return { open: open.map((row) => serializeSignal(row, today, timeZone)), handled: handled.map((row) => serializeSignal(row, today, timeZone)) };
}

/** Asutuse lahtised märkamised hooldusjuhi skoobis, kõige kauem oodanu ees. Tähtaegade lehele. */
export async function loadOpenChangeSignals(db, organizationId, clientWhere, { now, timeZone }) {
  const today = todayText(now, timeZone);
  const rows = await db.careChangeSignal.findMany({
    where: { organizationId, handledAt: null, client: clientWhere },
    select: { ...SIGNAL_SELECT, client: { select: { id: true, displayName: true, status: true } } },
    orderBy: [{ openedAt: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX
  });
  return rows.map((row) => ({ ...serializeSignal(row, today, timeZone), client: row.client }));
}

/** Hooldusjuht vastab märkamisele: mida tehti ja soovi korral märkus. Vastatud märkamist ei muudeta. */
export async function handleChangeSignal(context, signalId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  if (!coordinatorScope(context)) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  const id = normalizeId(signalId, "home_care.errors.change_signal_not_found");
  const body = asObject(input);
  const outcome = normalizeEnum(body.outcome, CARE_CHANGE_OUTCOMES, "home_care.errors.change_outcome_required");
  const note = normalizeLine(body.note, HOME_CARE_LIMITS.CHANGE_NOTE_MAX) || null;
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const signal = await tx.careChangeSignal.findFirst({ where: { id, organizationId }, select: { id: true, clientId: true, handledAt: true } });
    if (!signal) throw notFound("home_care.errors.change_signal_not_found");
    await requireClientCoordinator(tx, context, signal.clientId, { lock: true, now });
    if (signal.handledAt) throw conflict("home_care.errors.change_signal_handled");
    const result = await tx.careChangeSignal.updateMany({
      where: { id, handledAt: null },
      data: { handledAt: now, handledByMembershipId: context.membership?.id || null, handledByName: await membershipDisplayName(tx, context), outcome, note }
    });
    if (result.count !== 1) throw conflict("home_care.errors.change_signal_handled");
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_CHANGE_SIGNAL_HANDLED,
      resourceType: OrgAuditResource.CARE_CLIENT,
      resourceId: signal.clientId,
      meta: { organizationId, clientId: signal.clientId, change: "handled" }
    });
    return { clientId: signal.clientId, changeSignals: await loadChangeSignalsWithin(tx, signal.clientId, { now, timeZone: organizationTimeZone(context) }) };
  });
}

/**
 * Märkamiste vastamise näit (K5-x, kava II.6.2): toode lubab, et iga märkamine jõuab
 * vastutajani ja saab vastuse, mitte tervisetulemust; seepärast mõõdetakse, mitu märkamist
 * sai vastuse ja kui kiiresti. `rows`: `{ openedAt, handledAt }`. Mediaan täispäevades
 * (samal päeval vastatud = 0). Puhas funktsioon.
 */
export function signalResponseStats(rows) {
  const handled = (rows || []).filter((row) => row.handledAt);
  const days = handled
    .map((row) => Math.max(0, Math.floor((new Date(row.handledAt).getTime() - new Date(row.openedAt).getTime()) / (24 * 60 * 60 * 1000))))
    .sort((a, b) => a - b);
  const middle = Math.floor(days.length / 2);
  const medianDays = !days.length ? null : days.length % 2 ? days[middle] : Math.round((days[middle - 1] + days[middle]) / 2);
  return { opened: (rows || []).length, handled: handled.length, waiting: (rows || []).length - handled.length, medianDays };
}

/** Ajavahemikus avatud märkamiste vastamise näit vaataja skoobis. */
export async function loadSignalResponseStats(db, organizationId, range, clientWhere = {}) {
  const rows = await db.careChangeSignal.findMany({
    where: { organizationId, openedAt: range, client: clientWhere },
    select: { openedAt: true, handledAt: true },
    take: HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX
  });
  return signalResponseStats(rows);
}
