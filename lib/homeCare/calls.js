/**
 * KODUTEENUS K1-h — kõnede loendur.
 *
 * Kõnemärge on päeviku kirje, mille kontakti viis on telefon ja millel on kaks
 * lisavälja: kes helistas ja mille pärast (`callCaller`, `callTopic`). Kirjena
 * on see meeskonnale näha, otsitav ja võrguta salvestatav nagu iga teine kirje.
 *
 * LOENDUR näitab hooldusjuhile, millest tegelikult helistatakse: kuu kaupa,
 * teema ja helistaja järgi. See on lähtetase, enne kui ehitatakse midagi, mis
 * peaks kõnesid vähendama (pere teavitamine, kliendi enda vaade).
 *
 * Loendur loeb ARVE, mitte sisu: vastuses ei ole ühtegi nime ega teksti.
 * Tühistatud kirje loendurisse ei lähe. Kuu on asutuse kalendrikuu.
 */

import prisma from "@/lib/prisma";

import { badRequest, forbidden } from "../org/errors.js";
import { localDateTimeToUtc, zonedParts } from "../time/estonianDay.js";

import { assertHomeCareContext, coordinatorScope, organizationTimeZone } from "./access.js";
import { CARE_CALL_CALLERS, CARE_CALL_TOPICS, HOME_CARE_COORDINATOR } from "./constants.js";
import { asObject } from "./validation.js";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function monthText(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function shiftMonth({ year, month }, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** `AAAA-KK` või tühi (= käesolev kuu asutuse ajavööndis). */
export function resolveCallMonth(value, now, timeZone) {
  if (value === undefined || value === null || value === "") {
    const today = zonedParts(now, timeZone);
    return { year: today.year, month: today.month };
  }
  const match = MONTH_PATTERN.exec(String(value));
  if (!match) throw badRequest("home_care.errors.invalid_month");
  return { year: Number(match[1]), month: Number(match[2]) };
}

function monthRange(month, timeZone) {
  const next = shiftMonth(month, 1);
  return {
    gte: localDateTimeToUtc({ year: month.year, month: month.month, day: 1 }, timeZone),
    lt: localDateTimeToUtc({ year: next.year, month: next.month, day: 1 }, timeZone)
  };
}

function emptyCounts() {
  const byTopic = Object.fromEntries(CARE_CALL_TOPICS.map((topic) => [topic, 0]));
  const byCaller = Object.fromEntries(CARE_CALL_CALLERS.map((caller) => [caller, 0]));
  const matrix = Object.fromEntries(
    CARE_CALL_TOPICS.map((topic) => [topic, Object.fromEntries(CARE_CALL_CALLERS.map((caller) => [caller, 0]))])
  );
  return { total: 0, byTopic, byCaller, matrix };
}

async function countMonth(db, context, scope, month, timeZone) {
  const rows = await db.careClientEntry.groupBy({
    by: ["callTopic", "callCaller"],
    where: {
      organizationId: context.organization.id,
      ...(scope.wholeOrg ? {} : { client: { unitId: { in: scope.unitIds } } }),
      callTopic: { not: null },
      retractedAt: null,
      occurredAt: monthRange(month, timeZone)
    },
    _count: { _all: true }
  });
  const counts = emptyCounts();
  for (const row of rows) {
    const topic = row.callTopic;
    const caller = row.callCaller;
    const count = row._count?._all || 0;
    /* Tundmatu väärtus andmebaasis (vanem koodiversioon) loendurit katki ei tee. */
    if (!(topic in counts.byTopic) || !(caller in counts.byCaller)) continue;
    counts.total += count;
    counts.byTopic[topic] += count;
    counts.byCaller[caller] += count;
    counts.matrix[topic][caller] += count;
  }
  return counts;
}

/**
 * Kõnede arv kuus teema ja helistaja kaupa, hooldusjuhi skoobis, koos eelmise
 * kuuga võrdluseks.
 */
export async function getCallCounts(context, rawQuery = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  const timeZone = organizationTimeZone(context);
  const month = resolveCallMonth(asObject(rawQuery).month, now, timeZone);
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const today = zonedParts(now, timeZone);
  const isCurrent = month.year === today.year && month.month === today.month;
  const isFuture = month.year > today.year || (month.year === today.year && month.month > today.month);

  return {
    month: monthText(month.year, month.month),
    previousMonth: monthText(previous.year, previous.month),
    /* Tulevikku ei sirvita: seal ei ole midagi lugeda. */
    nextMonth: isCurrent || isFuture ? null : monthText(next.year, next.month),
    counts: await countMonth(db, context, scope, month, timeZone),
    previous: await countMonth(db, context, scope, previous, timeZone)
  };
}
