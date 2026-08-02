/**
 * TEENUSPÄEVIK E8 — proovide salvestus ja baasjoone lugemine.
 *
 * SKOOP TULEB `requireWritableProfile`-ist nagu kõik muu selles teemas: proov
 * kuulub sellele profiilile, kelle nimel ta tekkis, ja võõra profiili baasjoont
 * ei ole kuidagi võimalik küsida.
 *
 * PROOV EI TOHI KUNAGI KUKUTADA KASUTAJA TEGEVUST. Mõõdik on kõrvalsaadus;
 * kui ta ei salvestu, on kaotus üks number statistikas, mitte kirje. Seepärast
 * `recordSample` neelab vea ja tagastab `false` — kutsuja ei pea teda üldse
 * kontrollima.
 */

import { prisma } from "@/lib/prisma";
import { assertServiceLogEnabled } from "./flags.js";
import { requireWritableProfile } from "./entries.js";
import { SAMPLE_KIND, normalizeSample, summarize } from "./measurement.js";

/**
 * Aken, mille pealt baasjoon võetakse. Ilma aknata segaks ammune, veel
 * harjumatu kasutus kokku tänase omaga ja „kas platvorm tegi midagi paremaks"
 * ei oleks enam vastatav.
 */
export const BASELINE_WINDOW_DAYS = 90;

/** Ülempiir ühe päringu peale — baasjoon ei vaja kogu ajalugu, vaid akent. */
const MAX_SAMPLES = 2000;

export async function recordSample(userId, input = {}, { db = prisma, env = process.env } = {}) {
  try {
    assertServiceLogEnabled(env);
    const sample = normalizeSample(input);
    if (!sample) return false;
    const profile = await requireWritableProfile(userId, { db });
    await db.serviceLogTimeSample.create({
      data: {
        providerProfileId: profile.id,
        ownerUserId: userId,
        kind: sample.kind,
        seconds: sample.seconds
      }
    });
    return true;
  } catch {
    /* Vaikimine on siin TEADLIK. Vt mooduli päist: mõõdiku tõrge ei tohi
       kasutajale paista, sest ta ei saa sellega midagi peale hakata ja tema
       päris töö (kirje) on juba salvestatud. */
    return false;
  }
}

/**
 * @returns `{ windowDays, entry, month, export }` — iga liik eraldi kokkuvõte
 *   või `null`, kui proove ei ole. Vt `summarize`: „mõõdetud ei ole" on aus
 *   vastus ja seda ei asendata nullidega.
 */
export async function readBaseline(
  userId,
  { windowDays = BASELINE_WINDOW_DAYS } = {},
  { db = prisma, env = process.env } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const rows = await db.serviceLogTimeSample.findMany({
    where: { providerProfileId: profile.id, recordedAt: { gte: since } },
    select: { kind: true, seconds: true },
    orderBy: { recordedAt: "desc" },
    take: MAX_SAMPLES
  });

  const byKind = new Map();
  for (const row of rows) {
    if (!byKind.has(row.kind)) byKind.set(row.kind, []);
    byKind.get(row.kind).push(row.seconds);
  }

  return {
    windowDays,
    entryInput: summarize(byKind.get(SAMPLE_KIND.ENTRY_INPUT) || []),
    monthReview: summarize(byKind.get(SAMPLE_KIND.MONTH_REVIEW) || []),
    exportRun: summarize(byKind.get(SAMPLE_KIND.EXPORT) || [])
  };
}
