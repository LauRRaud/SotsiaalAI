/**
 * TEENUSPÄEVIK E8 — aruandlusaja mõõtmine ja baasjoon.
 *
 * MIKS SEE ON OMAETTE ETAPP, MITTE KÕRVALSAADUS: leping lubab „kirje sisestus
 * alla 30 sekundiga (mõõdetud)" (DoD 1) ja „aruandlusaja mõõtmine sisse
 * ehitatud, baasjoon võetav" (DoD 5). Mõlemad on kontrollitavad ainult päris
 * numbriga. Ilma selleta oleks „alla 30 sekundi" arvamus — ja just seda tüüpi
 * väidet me konkurendi pealt ise ette heitsime (7,4 → 11 ilma metoodikata).
 *
 * MIDA MÕÕDAME: DOKUMENTEERIMISELE kuluvat aega, mitte teenusele kuluvat aega.
 * Kaks eri asja, mida on lihtne segi ajada — teenuse kestus tuleb templitest ja
 * on aruande sisu; siinne proov on tööriista enda kohta.
 *
 * MEDIAAN, MITTE KESKMINE. Üks vahepeal lahti unustatud vorm nihutaks keskmise
 * kasutuks; mediaan ja p90 kirjeldavad päris kogemust. „Osakaal alla 30 s" on
 * see number, mille vastu DoD 1 loetakse.
 */

export const SAMPLE_KIND = Object.freeze({
  /** Vormi esimesest puutest kuni õnnestunud salvestuseni. */
  ENTRY_INPUT: "ENTRY_INPUT",
  /** Kuuvaate avamisest kuni sealt lahkumiseni — „kui kaua ma aruannet vaatasin". */
  MONTH_REVIEW: "MONTH_REVIEW",
  /** Ekspordi vaate avamisest kuni faili tekkimiseni. */
  EXPORT: "EXPORT"
});

const SAMPLE_KINDS = new Set(Object.values(SAMPLE_KIND));

export function isSampleKind(value) {
  return SAMPLE_KINDS.has(String(value || "").toUpperCase());
}

/** DoD 1 lävi. Siin, mitte UI-s: lubadus on lepingu oma, mitte ekraani oma. */
export const ENTRY_TARGET_SECONDS = 30;

/**
 * ÜLEMPIIR VIskab PROOVI ÄRA, mitte ei kärbi teda.
 *
 * Kärpimine (`min(seconds, 900)`) tooks mediaani sisse hunniku täpselt
 * 900-sekundilisi proove ja moonutaks p90 nii, nagu oleks tegu päris
 * sisestustega. Vorm, mis oli lahti 40 minutit, EI OLE sisestussessioon — ta on
 * lahti unustatud vorm ja tema koht ei ole valimis.
 */
export const MAX_PLAUSIBLE_SECONDS = 900;

/**
 * Alumine piir: alla sekundi kestnud „sisestus" tähendab kas mõõtmisviga või
 * automaatikat. Null-sekundilised proovid teeksid mediaani ilusaks põhjusel,
 * millel ei ole kasutajaga mingit seost.
 */
export const MIN_PLAUSIBLE_SECONDS = 1;

export function isPlausibleSample(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return false;
  return value >= MIN_PLAUSIBLE_SECONDS && value <= MAX_PLAUSIBLE_SECONDS;
}

/**
 * Normaliseerib proovi. Tagastab `null`, kui proov ei kõlba — kutsuja EI TOHI
 * seda veaks lugeda: kõlbmatu proov on mõõtmise tavaline osa ja tema pärast ei
 * tohi kasutaja tegevus (kirje salvestamine) kukkuda.
 */
export function normalizeSample(input = {}) {
  const kind = String(input.kind || "").toUpperCase();
  if (!isSampleKind(kind)) return null;
  const seconds = Math.round(Number(input.seconds));
  if (!isPlausibleSample(seconds)) return null;
  return { kind, seconds };
}

function percentile(sortedValues, fraction) {
  if (!sortedValues.length) return null;
  /* Lähim-järk meetod: valim on väike (kümned proovid), seega interpoleerimine
     annaks võlts täpsuse — „p90 = 41,37 s" ei ole ausam kui „41 s". */
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(fraction * sortedValues.length) - 1)
  );
  return sortedValues[index];
}

/**
 * Baasjoon ühe liigi kohta.
 *
 * @param samples proovid (objektid `{seconds}` või pelgad numbrid)
 * @returns null, kui proove ei ole — MITTE nullidega objekt. „0 sekundit
 *   mediaan" oleks vale väide; „mõõdetud ei ole" on aus.
 */
export function summarize(samples = [], { targetSeconds = ENTRY_TARGET_SECONDS } = {}) {
  const values = samples
    .map((sample) => (typeof sample === "number" ? sample : Number(sample?.seconds)))
    .filter((value) => isPlausibleSample(value))
    .sort((a, b) => a - b);

  if (!values.length) return null;

  const underTarget = values.filter((value) => value <= targetSeconds).length;
  return {
    count: values.length,
    medianSeconds: percentile(values, 0.5),
    p90Seconds: percentile(values, 0.9),
    fastestSeconds: values[0],
    slowestSeconds: values[values.length - 1],
    targetSeconds,
    underTargetCount: underTarget,
    /* Ümardatud protsendipunktini: valim on väike ja komakohad teeskleksid
       täpsust, mida seal ei ole. */
    underTargetShare: Math.round((underTarget / values.length) * 100)
  };
}

/**
 * Kas DoD 1 on tõendatud?
 *
 * KAKS TINGIMUST, mõlemad vajalikud: mediaan alla läve JA piisav valim. Ilma
 * valimi nõudeta tõendaks üks kiire sisestus terve lubaduse ära.
 */
export const MIN_SAMPLES_FOR_CLAIM = 20;

export function meetsEntryTarget(summary) {
  if (!summary) return false;
  return summary.count >= MIN_SAMPLES_FOR_CLAIM && summary.medianSeconds <= summary.targetSeconds;
}
