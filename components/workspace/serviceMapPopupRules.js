/**
 * Teenusekaardi kontaktipaneeli reeglid ilma joonistamiseta.
 *
 * Paneeli sisu ehitab ServiceMapLeaflet.jsx käsitsi (DOM), mida ilma brauserita
 * testida ei saa. Otsused, mida seal tehakse (milline vaade on ees, mis sõna
 * väärtus saab, kuhu allikalink läheb, kui lai on vaba äär), on seepärast siin
 * ja testitud failis tests/service-map-popup.test.mjs.
 */

/* Vaba serv avatud paneeli ja kaardiala ääre vahel. Sama arvuga arvestab
   paneeli kõrguse valem failis app/styles/workspace.css (2 × 10 px). */
export const POPUP_EDGE_PADDING = 10;
/* Suumi nupud on kaardi vasakus ülanurgas (x 10 kuni 44 px) ja kõigi
   kaardikihtide kohal. Laial kaardil hoitakse paneel neist paremal. */
export const ZOOM_CONTROL_CLEARANCE = 56;
/* Kitsal kaardil (telefon) on paneel peaaegu kaardi laiune ja suumi nuppude
   kõrvale ei mahu: seal peidetakse nupud avatud paneeli ajaks
   (ServiceMapLeaflet.module.css, sama piir). */
export const NARROW_MAP_WIDTH = 480;

/** Paneeli vaba äär vasakul ja ülal kaardi laiuse järgi: `[vasak, ülemine]`. */
export function popupTopLeftPadding(mapWidth) {
  const width = Number(mapWidth);
  const narrow = !Number.isFinite(width) || width < NARROW_MAP_WIDTH;
  return [narrow ? POPUP_EDGE_PADDING : ZOOM_CONTROL_CLEARANCE, POPUP_EDGE_PADDING];
}

/**
 * Ligipääsutee väärtuse sõna. Sisemist koodi ekraanile ei lasta: väärtus, millel
 * kataloogis sõna ei ole, on „Teadmata". Tõlkefunktsioon tagastab puuduva võtme
 * korral VÕTME ENDA (mitte varuväärtuse), seepärast loetakse ka see puuduvaks.
 */
export function accessPathWord(t, group, value) {
  const normalized = String(value || "UNKNOWN").toUpperCase();
  const key = `serviceMap.accessPath.${group}.${normalized}`;
  const word = typeof t === "function" ? String(t(key, "") || "") : "";
  if (word && word !== key) return word;
  const unknownKey = "serviceMap.accessPath.unknownShort";
  const unknown = typeof t === "function" ? String(t(unknownKey, "Teadmata") || "") : "";
  return unknown && unknown !== unknownKey ? unknown : "Teadmata";
}

/**
 * Telefoninumbri link. Kui väljal on kaks numbrit järjest („6123456 5123456"),
 * võetakse esimene: enne liideti need üheks valeks numbriks.
 */
export function servicePhoneHref(value) {
  const raw = String(value || "");
  const compact = raw.match(/(?:\+?372[\s-]?)?(?<!\d)\d{7,8}(?!\d)/u);
  const match = compact || raw.match(/\+?\d(?:[\s()-]*\d){6,11}/u);
  const normalized = match ? match[0].replace(/[^\d+]/gu, "") : "";
  return normalized ? `tel:${normalized}` : "";
}

export function serviceEmailHref(value) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ? `mailto:${email}` : "";
}

/** Kas aadress juba nimetab omavalitsuse (siis piirkonnarida seda ei korda). */
export function addressNamesMunicipality(entry) {
  const address = String(entry?.address || "").toLowerCase();
  const municipality = String(entry?.municipalityName || "").trim().toLowerCase();
  return Boolean(address && municipality && address.includes(municipality));
}

/**
 * Allikalink tegevuste reas. Ligipääsutee plokil on oma allikalink; kui plokki
 * ei joonistata, on link tegevuste reas, aga mitte siis, kui see on sama
 * aadress mis veebilehe link.
 */
export function popupSourceLink({ accessShown = false, sourceUrl = "", websiteUrl = "" } = {}) {
  if (accessShown || !sourceUrl) return "";
  return sourceUrl === websiteUrl ? "" : sourceUrl;
}

/**
 * Milline vaade on mitme kontaktiga paneelis ees: loend või üks kontakt.
 * Valitud kontakt on ees, kuni inimene vajutab „tagasi" (`listGroupId` on siis
 * selle rühma tunnus); uus valik toob jälle kontakti ette.
 */
export function groupPopupView(group, selectedEntryId, listGroupId = "") {
  const entries = Array.isArray(group?.entries) ? group.entries : [];
  const selected = selectedEntryId ? entries.find((entry) => entry?.id === selectedEntryId) : null;
  if (!selected || (listGroupId && listGroupId === group?.id)) return { view: "list", entry: null };
  return { view: "contact", entry: selected };
}

/** Kuupäeva kuju lehe keele järgi. */
export function popupDateLocale(locale) {
  const code = String(locale || "et").toLowerCase().slice(0, 2);
  if (code === "en") return "en-GB";
  if (code === "ru") return "ru-RU";
  return "et-EE";
}
