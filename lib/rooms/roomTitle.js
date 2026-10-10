/**
 * Ruumi nimi. Puhas fail (andmebaasi ei puuduta): seda loevad nii eelpöördumise
 * ruumi loomine kui ka loendid, mis ruumi nime näitavad.
 *
 * Eelpöördumisest tehtud ruumi nimi kirjutati varem täpitähtedeta
 * („Eelpoordumine: …”) ja teemata pöördumise korral läks nimesse autori e-posti
 * aadress, mis oli näha igale ruumi liikmele. Uus ruum saab nime siit; juba
 * olemasolevate ruumide nime ei kirjutata üle (see on andmete parandus), aga
 * näitamisel parandab `displayRoomTitle` vana kuju ja jätab aadressi välja.
 */
const PRE_INQUIRY_PREFIX = "Eelpöördumine";
const LEGACY_PREFIX = /^Eelpoordumine(?![A-Za-zÕÄÖÜõäöü])/;
const EMAIL_SHAPE = /[^\s@:]+@[^\s@]+\.[^\s@]+/;
const TOPIC_MAX = 72;

/** Eelpöördumisest tehtud ruumi nimi: teema, kui see on, muidu ainult sõna. */
export function preInquiryRoomTitle(topic) {
  const value = String(topic || "").trim();
  return value ? `${PRE_INQUIRY_PREFIX}: ${value.slice(0, TOPIC_MAX)}` : PRE_INQUIRY_PREFIX;
}

/** Ruumi nimi näitamiseks: vana kuju parandatakse ja e-posti aadress jääb nimest välja. */
export function displayRoomTitle(title) {
  const value = String(title || "").trim();
  if (!LEGACY_PREFIX.test(value)) return value;
  const rest = value.replace(LEGACY_PREFIX, "").replace(/^\s*:\s*/, "").trim();
  return rest && !EMAIL_SHAPE.test(rest) ? `${PRE_INQUIRY_PREFIX}: ${rest}` : PRE_INQUIRY_PREFIX;
}
