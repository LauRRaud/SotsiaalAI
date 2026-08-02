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
import { assertServiceLogEnabled, isServiceLogMeasurementEnabled } from "./flags.js";
import { ServiceLogDisabledError } from "./flags.js";
import { requireWritableProfile } from "./entries.js";
import { SAMPLE_KIND, normalizeSample, summarize } from "./measurement.js";

/**
 * Aken, mille pealt baasjoon võetakse. Ilma aknata segaks ammune, veel
 * harjumatu kasutus kokku tänase omaga ja „kas platvorm tegi midagi paremaks"
 * ei oleks enam vastatav.
 */
export const BASELINE_WINDOW_DAYS = 90;

/**
 * PROOVIDE OMA KUSTUTAMISTÄHTAEG — 180 päeva.
 *
 * Proov EI OLE raamatupidamise dokument ja tema peale ei kehti 7 aasta
 * säilitus. Ilma oma tähtajata jääks piloodi ajal kogutud mõõtmisandmestik
 * andmebaasi igaveseks lihtsalt sellepärast, et keegi ei tulnud teda
 * kustutama. Piloodi baasjoon võetakse nädalatega; pool aastat on lai varu.
 *
 * Kustutamine käib `purgeExpiredSamples`-iga (koristusskript või käsitsi) —
 * mitte lugemise pealt, sest siis sõltuks andmete kadumine sellest, kes
 * juhtub vaatama.
 */
export const SAMPLE_RETENTION_DAYS = 180;

/** Ülempiir ühe päringu peale — baasjoon ei vaja kogu ajalugu, vaid akent. */
const MAX_SAMPLES = 2000;

export async function recordSample(userId, input = {}, { db = prisma, env = process.env } = {}) {
  try {
    assertServiceLogEnabled(env);
    /* VÄLJAS LIPUGA EI KOGUTA MIDAGI. Mõõtmine on piloodi vahend; tavaline
       kasutaja ei anna aega, mida keegi ei ole küsinud. */
    if (!isServiceLogMeasurementEnabled(env)) return false;
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
  /* Väljas mõõtmine annab 404, mitte tühja baasjoone: pilooti mitte kuuluv
     kasutaja ei pea teadma, et selline vaade olemas on. */
  if (!isServiceLogMeasurementEnabled(env)) throw new ServiceLogDisabledError();
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

/**
 * Kustutab tähtaja ületanud proovid. Kutsutakse koristusest, mitte lugemisest.
 *
 * @returns kustutatud ridade arv
 */
export async function purgeExpiredSamples({ db = prisma, retentionDays = SAMPLE_RETENTION_DAYS } = {}) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await db.serviceLogTimeSample.deleteMany({ where: { recordedAt: { lt: cutoff } } });
  return result.count;
}
