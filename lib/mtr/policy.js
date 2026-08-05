/* A4 — kontrolli rütm ja vananemine ÜHES kohas.

   Omaniku otsus 05.08: need on konfiguratsioon, mitte koodi laiali puistatud
   konstandid ega andmebaasi read. Kui number muutub, muutub ta siin ühe korra. */

const HOUR = 60 * 60 * 1000;

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const MTR_CHECK_POLICY = Object.freeze({
  /* Automaatkontroll üks kord ööpäevas. */
  get autoIntervalMs() {
    return positiveNumber(process.env.MTR_AUTO_INTERVAL_HOURS, 24) * HOUR;
  },
  /* Eduka kontrolli kehtivus. Vanem kontroll ei ole kontroll — seis langeb
     „ei saanud kinnitada" peale, mitte ei jää vaikselt rohelisena rippuma. */
  get freshnessMs() {
    return positiveNumber(process.env.MTR_FRESHNESS_HOURS, 72) * HOUR;
  },
  /* Tõrke korduskatsed: 1 h, 6 h, 24 h, edasi 24 h. */
  get retryStepsMs() {
    const raw = String(process.env.MTR_RETRY_HOURS || "1,6,24")
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isFinite(entry) && entry > 0);
    return (raw.length ? raw : [1, 6, 24]).map((hours) => hours * HOUR);
  },
  /* Käsitsi „kontrolli uuesti" käivitub kohe, aga mitte tihedamini. */
  get manualCooldownMs() {
    return positiveNumber(process.env.MTR_MANUAL_COOLDOWN_MINUTES, 15) * 60 * 1000;
  },
  /* Mitu järjestikust EDUKAT kontrolli peab luba puuduma, enne kui avalik
     märgis kaob. Ühekordne registrikapriis ei tohi muutuda avalikuks väiteks. */
  get missesBeforeNotFound() {
    return positiveNumber(process.env.MTR_MISSES_BEFORE_NOT_FOUND, 2);
  }
});

/** Millal järgmine automaatkontroll toimub. */
export function nextCheckAfter({ succeeded, consecutiveFailures = 0, now = new Date() }) {
  const base = now instanceof Date ? now.getTime() : Date.now();
  if (succeeded) return new Date(base + MTR_CHECK_POLICY.autoIntervalMs);
  const steps = MTR_CHECK_POLICY.retryStepsMs;
  const index = Math.min(Math.max(consecutiveFailures, 0), steps.length - 1);
  return new Date(base + steps[index]);
}

/** Kas käsitsi kontroll on lubatud (jahtumisaeg). */
export function manualCheckAllowed({ lastAttemptAt, now = new Date() }) {
  if (!lastAttemptAt) return true;
  const last = lastAttemptAt instanceof Date ? lastAttemptAt.getTime() : new Date(lastAttemptAt).getTime();
  if (!Number.isFinite(last)) return true;
  const current = now instanceof Date ? now.getTime() : Date.now();
  return current - last >= MTR_CHECK_POLICY.manualCooldownMs;
}

/** Kas edukas kontroll on veel värske. */
export function checkIsFresh({ verifiedAt, now = new Date() }) {
  if (!verifiedAt) return false;
  const verified = verifiedAt instanceof Date ? verifiedAt.getTime() : new Date(verifiedAt).getTime();
  if (!Number.isFinite(verified)) return false;
  const current = now instanceof Date ? now.getTime() : Date.now();
  return current - verified < MTR_CHECK_POLICY.freshnessMs;
}
