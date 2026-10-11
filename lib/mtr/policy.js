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
  /* EDUKA kontrolli järel 30 päeva (omanik 10.10.2026: „kontroll peaks olema nt kord kuus",
     järelkontroll ei pea tihe olema; varem 14 päeva). Esimene kontroll ei oota korjet: ta
     käivitub kohe, kui inimene teenuse liigi kinnitab (`bindServiceKey`); korje teeb ainult
     järelkontrolli. Korje ärkab kord ööpäevas ja vaatab, kelle `nextCheckAt` on käes: ta ei
     kontrolli kõiki iga päev. */
  get successIntervalMs() {
    return positiveNumber(process.env.MTR_SUCCESS_INTERVAL_DAYS, 30) * DAY;
  },
  /* Positiivse märgise värskus 35 päeva: 30-päevase järelkontrolli ümber VIIE PÄEVA puhver.
     Ilma selleta kaoks märgis kohe, kui täpselt 30. päeva kontroll ajutiselt ebaõnnestub;
     puhvriga jõuab korje viis ööd uuesti proovida. */
  get freshnessMs() {
    return positiveNumber(process.env.MTR_FRESHNESS_DAYS, 35) * DAY;
  },
  /* Tõrke korduskatse: järgmisel ööl. Korje ärkab kord ööpäevas, seega lühem aste ei
     tähendaks midagi; astmestik on endiselt seadistatav (`MTR_RETRY_HOURS=1,6,24`), kui
     ajastus kunagi tihedamaks tehakse. */
  get retryStepsMs() {
    const raw = String(process.env.MTR_RETRY_HOURS || "24")
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isFinite(entry) && entry > 0);
    return (raw.length ? raw : [24]).map((hours) => hours * HOUR);
  },
  /* Kui edukas kontroll kehtivat luba EI leidnud, ootab teenus teist kinnitavat kontrolli
     (avalik „luba ei leitud" nõuab kahte järjestikust tühja vastust). Seda teist kontrolli
     ei tohi oodata kuu aega: registri ühekordne kapriis jätaks uue teenuse nii kauaks
     kinnitamata ja varem kontrollitud teenus kannaks vana märgist oma värskuse lõpuni,
     kuigi register luba enam ei näita. */
  get pendingRecheckMs() {
    return positiveNumber(process.env.MTR_PENDING_RECHECK_DAYS, 1) * DAY;
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
export function nextCheckAfter({ succeeded, consecutiveFailures = 0, pendingSecondCheck = false, now = new Date() }) {
  const base = now instanceof Date ? now.getTime() : Date.now();
  if (succeeded && pendingSecondCheck) return new Date(base + MTR_CHECK_POLICY.pendingRecheckMs);
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
