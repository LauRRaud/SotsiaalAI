/**
 * KODUTEENUS K5-d — ravimitoimingu märge (kava II.3.2, otsus 20).
 *
 * Käigu kirjel märgitakse ravimitoimingu juures, mida hooldaja tegi: tuletas meelde, nägi
 * võtmas või andis. Siin on see, mida hooldusjuht sellest päevaplaanis näeb: kelle kavas on
 * ravimitoiming ja kas tänase käigu juures on selle kohta midagi kirjas.
 *
 * Annuseid, ravimite nimesid ega raviskeemi ei hoita. Märk päevaplaanis ei ole häire: see
 * ei helista kellelegi ega asenda inimese kontrolli. Ta näitab hooldusjuhile, kus märge
 * puudub, et ta saaks järele küsida.
 */

import { localDateTimeToUtc, shiftLocalDate, zonedParts } from "../time/estonianDay.js";

import { CareActivityGroup, CareActivityOutcome, CarePlanStatus, CarePlannedState } from "./constants.js";

/** Ravimi seis käigu juures päevaplaanis. */
export const CareMedicationState = Object.freeze({
  /** Käik on ees, kavas on ravimitoiming. */
  DUE: "DUE",
  /** Ravimitoiming on täna tehtuks märgitud. */
  MARKED: "MARKED",
  /** Ravimitoiming on täna märgitud tegemata (keeldus, polnud vaja, ei saanud). */
  NOT_DONE: "NOT_DONE",
  /** Käik on kirjas, aga ravimitoimingu kohta ei ole midagi öeldud. */
  UNMARKED: "UNMARKED",
  /** Käik on tegemata ja kavas on ravimitoiming. */
  MISSED: "MISSED"
});

/** Seisud, mille puhul hooldusjuht peaks järele küsima. */
export const MEDICATION_OPEN_STATES = Object.freeze([CareMedicationState.UNMARKED, CareMedicationState.MISSED]);

/**
 * Puhas reegel: kliendi kavas on ravimitoiming (`inPlan`), selle päeva ravimimärked
 * (`marks`: tehtud ja tegemata ridade arv) ja käigu seis päevaplaanis.
 */
export function medicationState({ inPlan, marks = null, visitState }) {
  if (!inPlan) return null;
  if (visitState === CarePlannedState.CANCELLED) return null;
  if (marks?.done > 0) return CareMedicationState.MARKED;
  if (marks?.notDone > 0) return CareMedicationState.NOT_DONE;
  if (visitState === CarePlannedState.DONE) return CareMedicationState.UNMARKED;
  if (visitState === CarePlannedState.MISSING) return CareMedicationState.MISSED;
  return CareMedicationState.DUE;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function partsOf(day) {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month, day: date };
}

/** Hetke päev asutuse ajavööndis kujul AAAA-KK-PP. */
function dayOfDate(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Kliendid, kelle kehtivas hoolduskavas on ravimitoiming. */
export async function loadMedicationClientIds(db, organizationId, clientIds) {
  if (!clientIds.length) return new Set();
  const rows = await db.carePlanLine.findMany({
    where: { clientId: { in: clientIds }, activityGroup: CareActivityGroup.MEDICATION, plan: { organizationId, status: CarePlanStatus.ACTIVE } },
    select: { clientId: true },
    distinct: ["clientId"]
  });
  return new Set(rows.map((row) => row.clientId));
}

/** Ühe päeva ravimimärked kliendi kaupa: tehtud ja tegemata ridade arv tühistamata kirjetel. */
export async function loadMedicationMarksOfDay(db, organizationId, clientIds, day, timeZone) {
  const marks = new Map();
  if (!clientIds.length) return marks;
  const rows = await db.careEntryActivity.findMany({
    where: {
      organizationId,
      clientId: { in: clientIds },
      activityGroup: CareActivityGroup.MEDICATION,
      entry: {
        retractedAt: null,
        occurredAt: { gte: localDateTimeToUtc(partsOf(day), timeZone), lt: localDateTimeToUtc(shiftLocalDate(partsOf(day), 1), timeZone) }
      }
    },
    select: { clientId: true, outcome: true, entry: { select: { occurredAt: true } } }
  });
  for (const row of rows) {
    if (dayOfDate(row.entry.occurredAt, timeZone) !== day) continue;
    const current = marks.get(row.clientId) || { done: 0, notDone: 0 };
    if ((row.outcome || CareActivityOutcome.DONE) === CareActivityOutcome.DONE) current.done += 1;
    else current.notDone += 1;
    marks.set(row.clientId, current);
  }
  return marks;
}
