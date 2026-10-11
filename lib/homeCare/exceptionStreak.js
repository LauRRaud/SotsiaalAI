/**
 * KODUTEENUS K6-g — käigud ilma ühegi erandita (kava II.6.6, lõpetamine erandite kaudu).
 *
 * Käigu lõpus puudutab hooldaja ainult erandeid ja kinnitab siis „ülejäänud tehtud". See on
 * kiire, aga sellel on oma oht: kui kinnitus muutub harjumuseks, näitab päevik kuude kaupa
 * sama pilti ka siis, kui kohapeal on asjad muutunud. Kui kliendi viimasel
 * `EXCEPTION_STREAK_VISITS` käigul järjest ei ole olnud ühtegi erandit, saab hooldusjuht
 * kliendi lehel märke. Märge on kliendi, mitte töötaja kohta: selle käigud võisid teha mitu
 * inimest ja põhjus võib olla ka see, et kava on täpne. Hinnangut ei anta.
 *
 * Erand on: kava toiming, mis jäi tegemata; kavaväline toiming; kava toiming, mis tehti
 * teise viisiga kui kavas; vastus „jah" küsimusele „kas täna oli midagi teisiti". Loetakse
 * ainult käigu kirjed, millel on vähemalt üks kava toiming.
 */

import { CareActivityOutcome, HOME_CARE_LIMITS } from "./constants.js";

/** Kas käigus oli mõni erand. `visit`: `{ changeAnswer, activities: [{ outcome, outsidePlan, mode, planMode }] }`. */
export function hasException(visit) {
  if (visit.changeAnswer === "YES") return true;
  return (visit.activities || []).some(
    (activity) => activity.outcome !== CareActivityOutcome.DONE || activity.outsidePlan || (activity.planMode && activity.mode !== activity.planMode)
  );
}

/** Mitu käiku järjest alates viimasest oli ilma erandita. `visits` on uuem ees. Puhas funktsioon. */
export function exceptionFreeStreak(visits) {
  let streak = 0;
  for (const visit of visits || []) {
    if (hasException(visit)) break;
    streak += 1;
  }
  return streak;
}

/**
 * Hooldusjuhile kliendi lehele: `{ visits, since }`, kui viimased `size` kava toimingutega
 * käiku on kõik ilma erandita; muidu `null`. `since` on neist vanima käigu aeg.
 */
export async function loadExceptionStreakWithin(tx, clientId, { size = HOME_CARE_LIMITS.EXCEPTION_STREAK_VISITS } = {}) {
  const rows = await tx.careClientEntry.findMany({
    where: { clientId, retractedAt: null, activities: { some: { planLineId: { not: null } } } },
    select: {
      occurredAt: true,
      changeAnswer: true,
      activities: { select: { outcome: true, outsidePlan: true, mode: true, planLine: { select: { mode: true } } } }
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: size
  });
  if (rows.length < size) return null;
  const visits = rows.map((row) => ({
    changeAnswer: row.changeAnswer,
    activities: row.activities.map((activity) => ({ outcome: activity.outcome, outsidePlan: activity.outsidePlan, mode: activity.mode, planMode: activity.planLine?.mode || null }))
  }));
  if (exceptionFreeStreak(visits) < size) return null;
  return { visits: size, since: rows[rows.length - 1].occurredAt.toISOString() };
}
