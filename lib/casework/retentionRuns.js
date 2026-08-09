/**
 * JTA-V1 (E7) / SOL-CW-14 — säilitustöö JOOKSUSEIS ja alarm.
 *
 * MIDA SEE FAIL LAHENDAB. `runRetention()` oli olemas ja testitud, aga teda
 * kutsus ainult käsitsi käivitatav skript ning cron oli näide skripti päises,
 * mitte repositooriumi hallatav ajastus. Kui serverivälist cron'i eraldi
 * paigaldatud ei ole, ei kustu ülekantud mustandite sisu 12 kuu järel ja
 * arhiveeritud juhtumid ei saa hoiatust ega kustu tähtajal — **ilma ühegi
 * veateate, tühja logi või puuduva rea märgita**.
 *
 * KOLM KÜSIMUST, MILLELE PEAB SAAMA VASTATA, ja nad on siin nimeliselt:
 *
 *   1. **millal töö viimati ÕNNESTUS** — `lastSuccessAt`
 *   2. **millal ta järgmine kord käib** — `nextRunAt` (ajastuse intervallist,
 *      mitte oletusest)
 *   3. **kas keegi märkab, kui ta lakkab käimast** — `evaluateRetentionHealth()`
 *      annab `ALARM`, mille smoke muudab mitte-nulliks väljumiskoodiks
 *
 * OTSUS: ALARMI LÄVI ON AJAS, MITTE JOOKSUDE ARVUS. „Kaks vahelejäänud jooksu"
 * eeldab, et keegi teab intervalli; „viimasest õnnestumisest on möödas rohkem
 * kui N tundi" kehtib ka siis, kui ajastust muudetakse — ja just ajastuse
 * muutmine on see, mis järelevalve vaikselt katki teeb.
 *
 * KUIV KÄIVITUS EI OLE TÕEND. `dryRun` jooks ei kirjuta midagi; kui ta loeks
 * „viimaseks õnnestumiseks", näitaks tervis rohelist töö kohta, mida ei tehtud.
 */

import prismaClient from "@/lib/prisma";

/** Vaikimisi ajastus: iga tund. Vt `deploy/systemd/` ja allpool „miks tund". */
export const RETENTION_INTERVAL_MINUTES = 60;

/**
 * Mitu intervalli tohib vahele jääda, enne kui see on ALARM.
 *
 * KAKS, MITTE ÜKS: üks vahelejäänud jooks on taaskäivitus või aeglane host ja
 * temast alarmi tegemine õpetab inimest alarmi eirama. Kolm oleks juba pool
 * päeva vaikust.
 */
export const RETENTION_ALARM_MISSED_INTERVALS = 2;

export const RETENTION_HEALTH = Object.freeze({
  OK: "OK",
  ALARM: "ALARM",
  /** Ühtegi jooksu ei ole KUNAGI olnud — ajastus ei ole paigaldatud. */
  NEVER_RUN: "NEVER_RUN"
});

const MINUTE_MS = 60_000;

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Jooksu ALGUS. Rida tekib ENNE tööd, mitte pärast.
 *
 * MIKS ENNE: rida, mis kirjutatakse alles lõpus, ei jäta protsessi tapmisest
 * mingit jälge — töö, mis suri keset partiid, näeks välja täpselt nagu töö, mis
 * ei käivitunudki. `finishedAt: null` + `ok: false` ütleb ausalt „algas ja ei
 * lõpetanud" ja seda seisu jõustab ka andmebaasi `CHECK`.
 */
export async function startRetentionRun({ startedAt = new Date(), dryRun = false, db = prismaClient } = {}) {
  return db.caseWorkRetentionRun.create({
    data: { startedAt, dryRun: Boolean(dryRun), ok: false },
    select: { id: true, startedAt: true }
  });
}

/**
 * Jooksu LÕPP.
 *
 * `ok` on `true` AINULT siis, kui ühtegi tõrget ei olnud. Osaliselt õnnestunud
 * partii ei ole õnnestunud jooks: `runRetention()` teadlikult ei peata end ühe
 * kukkunud rea peale, aga see tähendab, et rida jäi töötlemata — ja täpselt see
 * peab järelevalveni jõudma.
 *
 * VEATEADET EI SALVESTATA, ainult erindi klass ja kood: Prisma paneb
 * ebaõnnestunud päringu argumendid teatesse ja mõni teenuskiht kirje teksti.
 */
export async function finishRetentionRun({
  runId,
  result = null,
  error = null,
  finishedAt = new Date(),
  db = prismaClient
} = {}) {
  if (!runId) return null;

  const counters = {
    draftsPurged: Number(result?.draftsPurged || 0),
    draftFieldsDeleted: Number(result?.draftFieldsDeleted || 0),
    warningsSent: Number(result?.warningsSent || 0),
    casesDeleted: Number(result?.casesDeleted || 0),
    failed: Number(result?.failed || 0)
  };

  await db.caseWorkRetentionRun.updateMany({
    where: { id: runId },
    data: {
      finishedAt,
      ok: !error && counters.failed === 0,
      disabled: Boolean(result?.disabled),
      ...counters,
      errorName: error ? String(error?.name || "Error").slice(0, 200) : null,
      errorCode: error ? String(error?.code || error?.messageKey || "").slice(0, 200) || null : null
    }
  });
  return { runId };
}

/**
 * Tervis: viimane edukas jooks, järgmine jooks ja alarm.
 *
 * PUHAS FUNKTSIOON, sest just teda peab saama testida mõlemast otsast — ja
 * ajastuse tervis on täpselt see asi, mille kohta „töötab küll" on kõige lihtsam
 * uskuda ilma tõendita.
 *
 * @param {{ lastSuccessAt: Date|null, lastRunAt: Date|null, lastRunOk: boolean|null }} state
 */
export function evaluateRetentionHealth({
  lastSuccessAt = null,
  lastRunAt = null,
  lastRunOk = null,
  now = new Date(),
  intervalMinutes = RETENTION_INTERVAL_MINUTES,
  missedIntervals = RETENTION_ALARM_MISSED_INTERVALS
} = {}) {
  const at = toDate(now) || new Date();
  const success = toDate(lastSuccessAt);
  const last = toDate(lastRunAt);
  const interval = Number(intervalMinutes) > 0 ? Number(intervalMinutes) : RETENTION_INTERVAL_MINUTES;
  const budgetMs = interval * missedIntervals * MINUTE_MS;

  /* JÄRGMINE JOOKS tuleb VIIMASEST JOOKSUST, mitte viimasest õnnestumisest:
     ajastaja käivitab töö sõltumata sellest, kas eelmine kord õnnestus. Ilma
     ühegi jooksuta ei ole „järgmist" olemas — ja väljamõeldud aeg oleks halvem
     kui tühjus, sest ta näeks välja nagu tõend. */
  const nextRunAt = last ? new Date(last.getTime() + interval * MINUTE_MS) : null;

  if (!success) {
    return {
      state: last ? RETENTION_HEALTH.ALARM : RETENTION_HEALTH.NEVER_RUN,
      reason: last ? "casework.retention.health.never_succeeded" : "casework.retention.health.never_run",
      lastSuccessAt: null,
      lastRunAt: last,
      lastRunOk: lastRunOk === null ? null : Boolean(lastRunOk),
      nextRunAt,
      staleMinutes: null
    };
  }

  const staleMinutes = Math.max(0, Math.round((at.getTime() - success.getTime()) / MINUTE_MS));
  const stale = at.getTime() - success.getTime() > budgetMs;

  return {
    state: stale ? RETENTION_HEALTH.ALARM : RETENTION_HEALTH.OK,
    reason: stale ? "casework.retention.health.stale" : null,
    lastSuccessAt: success,
    lastRunAt: last,
    lastRunOk: lastRunOk === null ? null : Boolean(lastRunOk),
    nextRunAt,
    staleMinutes
  };
}

/**
 * Jooksuseis andmebaasist + tervis.
 *
 * KAKS PÄRINGUT, MITTE ÜKS: „viimane jooks" ja „viimane EDUKAS jooks" on eri
 * read niipea, kui midagi kukub — ja just siis on vahe oluline.
 */
export async function getRetentionHealth({
  now = new Date(),
  intervalMinutes = RETENTION_INTERVAL_MINUTES,
  db = prismaClient
} = {}) {
  const [lastRun, lastSuccess] = await Promise.all([
    db.caseWorkRetentionRun.findFirst({
      orderBy: [{ startedAt: "desc" }],
      select: { startedAt: true, finishedAt: true, ok: true, failed: true, errorName: true, errorCode: true }
    }),
    db.caseWorkRetentionRun.findFirst({
      /* Kuiv käivitus ei kirjuta midagi ja ei kõlba tõendiks. */
      where: { ok: true, dryRun: false },
      orderBy: [{ startedAt: "desc" }],
      select: { startedAt: true, finishedAt: true }
    })
  ]);

  const health = evaluateRetentionHealth({
    lastSuccessAt: lastSuccess?.finishedAt || lastSuccess?.startedAt || null,
    lastRunAt: lastRun?.startedAt || null,
    lastRunOk: lastRun ? Boolean(lastRun.ok) : null,
    now,
    intervalMinutes
  });

  return { ...health, lastRun: lastRun || null };
}
