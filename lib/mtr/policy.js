/* A4 — kontrolli rütm ja vananemine ÜHES kohas.

   Omaniku otsus 05.08: need on konfiguratsioon, mitte koodi laiali puistatud
   konstandid ega andmebaasi read. Kui number muutub, muutub ta siin ühe korra. */

const HOUR = 60 * 60 * 1000;

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DAY = 24 * HOUR;

export const MTR_CHECK_POLICY = Object.freeze({
  /* EDUKA kontrolli järel 14 päeva (omanik 05.08): teenust kontrollitakse
     tavaliselt kaks korda kuus. Cron käib sellest hoolimata kord tunnis —
     ta ei kontrolli kõiki, vaid vaatab, kelle `nextCheckAt` on käes, ja
     ainult nii saavad tõrkejärgsed 1/6/24 h korduskatsed toimida. */
  get successIntervalMs() {
    return positiveNumber(process.env.MTR_SUCCESS_INTERVAL_DAYS, 14) * DAY;
  },
  /* Positiivse märgise värskus 16 päeva — 14-päevase korje ümber KAHE PÄEVA
     puhver. Ilma selleta kaoks märgis kohe, kui täpselt 14. päeva kontroll
     ajutiselt ebaõnnestub; puhvriga jõuab korduskatse enne ära. */
  get freshnessMs() {
    return positiveNumber(process.env.MTR_FRESHNESS_DAYS, 16) * DAY;
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
  /* Pikem kui MTR-i kahe järjestikuse kolmesammulise otsingu halvim ooteaeg. */
  get manualLeaseMs() {
    return positiveNumber(process.env.MTR_MANUAL_LEASE_MINUTES, 3) * 60 * 1000;
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
  if (succeeded) return new Date(base + MTR_CHECK_POLICY.successIntervalMs);
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
