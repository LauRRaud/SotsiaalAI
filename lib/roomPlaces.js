/**
 * Töölaud: tuba on töölaud (omanik 11.10.2026, kavand „Tuba on töölaud").
 *
 * Töölaua tööriistad seisavad toas kolmes kohas (tugitool ja lamp, valgustatud
 * sein, riiul). Suurelt on ees ainult see, mis täna ootab; ülejäänud on väikesed
 * märgid. Kohale minnes liigub kaamera sinna ja kõik selle koha tööriistad
 * tulevad loetavalt ette.
 *
 * Siin on lehe OTSUSED puhta koodina (testitav ilma brauserita): mis tsoon on
 * toas kus, mis tööriist on suur ja mis väike, mis kirjas märk on ja kuhu
 * kaamera läheb. Joonistab components/room/RoomPlaces.jsx.
 *
 * Tsoonid ja kaartide jaotus tsoonidesse tulevad endiselt failist
 * lib/deskZones.js ja kaardiloendist (RoomStage): seda siin ei korrata.
 */

/* Kus tsoon toas seisab: koht pildil protsentides ekraanist (nagu kavandis).
   `spot` on toa ese, mille juures koht on. Kliendil on kaks tsooni: tema enda
   asjad seisavad valgustatud seinal (toa keskel, kõige suuremalt), abi
   leidmine riiuli juures.
   Telefonis (`ny`) on toast näha ainult sein: kohad seisavad seal üksteise
   all keskjoonel, samas järjekorras mis kiirmenüüs. Kõrvuti ei mahtunud kolm
   kohta 390 px laiusele: märgid olid 34 px ja avatud koha kaardid jooksid
   ekraani servast välja (mõõdetud 23.10: „Mina" vasak veerg −74 px). */
export const PLACE_SPOTS = Object.freeze({
  mina: Object.freeze({ spot: "chair", ax: 18, ay: 44, ny: 25 }),
  juhtum: Object.freeze({ spot: "wall", ax: 50, ay: 36, ny: 48 }),
  teadmine: Object.freeze({ spot: "shelf", ax: 82, ay: 46, ny: 71 }),
  minu_tee: Object.freeze({ spot: "wall", ax: 42, ay: 38, ny: 34 }),
  leian_abi: Object.freeze({ spot: "shelf", ax: 78, ay: 46, ny: 64 })
});

/** Telefonis tuleb avatud koht ekraani keskele: sinna, kuhu kaamera vaatab. */
export const NARROW_FOCUS = Object.freeze({ ax: 50, ay: 40 });

/* Mis kaardi taga mis „ootab" arv on. Arvud annab olemasolev päring
   /api/workspace/continuity (lib/workspaceContinuity.js, väli `badges`).
   Kaardil, mida siin ei ole, märki ei ole: ta on toas alati väike. */
export const CARD_BADGE_KEY = Object.freeze({
  poordumised: "pre_inquiries",
  valitoo: "field_visits",
  teekond: "journey",
  tooheaolu: "wellbeing",
  mentorlus: "mentoring",
  supervisioon: "supervision",
  teenuseprofiil: "service_profile"
});

/* Need märgid tähendavad „sul on pooleli", mitte „keegi ootab sind": seal ei
   ole arv see, mida inimene teada tahab. Kliendi eelpöördumiste märk on tema
   enda mustand, töötajal on sama märgi taga saabunud pöördumised. */
const DRAFT_BADGES = new Set(["wellbeing", "journey"]);

/** Kui palju suuri kaarte ühes kohas korraga: rohkem ei mahu koha ümber ära. */
export const MAX_LARGE_PER_PLACE = 3;

function badgeCount(badge) {
  const value = Number(badge?.value);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Mis ühe kaardi taga ootab. `null`, kui ei oota midagi või allikat ei ole.
 * @returns {{ kind: "count" | "draft", count: number, label: string } | null}
 */
export function waitingFor(cardKey, badges, role) {
  const badgeKey = CARD_BADGE_KEY[cardKey];
  if (!badgeKey) return null;
  const badge = badges?.[badgeKey];
  const count = badgeCount(badge);
  if (!count) return null;
  const isClient = String(role || "").trim().toUpperCase() === "CLIENT";
  const draft = DRAFT_BADGES.has(badgeKey) || (badgeKey === "pre_inquiries" && isClient);
  return { kind: draft ? "draft" : "count", count, label: String(badge.label || count) };
}

/**
 * Kohad toas: tsoonid selles järjekorras, nagu nad toas vasakult paremale
 * seisavad, igaühel oma tööriistad. Tühja kohta ei näidata. Tundmatu tsooniga
 * kaart ei kao ära, vaid läheb viimasesse kohta (sama reegel mis laual oli).
 */
export function buildPlaces(zones, items) {
  const ids = (Array.isArray(zones) ? zones : []).filter((id) => PLACE_SPOTS[id]);
  if (!ids.length) return [];
  const groups = ids.map((id) => ({ id, ...PLACE_SPOTS[id], items: [] }));
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.key) continue;
    (byId.get(item.zone) || groups[groups.length - 1]).items.push(item);
  }
  return groups.filter((group) => group.items.length > 0).sort((a, b) => a.ax - b.ax);
}

/**
 * Ühe koha tööriistad kaheks: suured (ootavad) ja väikesed märgid.
 * Ootavaid võib olla rohkem, kui suuri kaarte mahub: ülejäänud jäävad
 * väikeseks, aga kannavad täppi (`waiting` on neil küljes).
 */
export function splitTools(placeItems, badges, role, maxLarge = MAX_LARGE_PER_PLACE) {
  const large = [];
  const small = [];
  for (const item of Array.isArray(placeItems) ? placeItems : []) {
    const waiting = waitingFor(item.key, badges, role);
    if (waiting && large.length < maxLarge) large.push({ item, waiting });
    else small.push({ item, waiting });
  }
  return { large, small };
}

/** Mitu veergu on koha tööriistadel, kui koht on avatud (telefonis alati kolm). */
export function gridColumns(count, narrow = false) {
  if (narrow) return count <= 2 ? Math.max(1, count) : 3;
  if (count <= 3) return Math.max(1, count);
  return count <= 6 ? 3 : 4;
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * Kaamera: kui palju tuba suureneb ja nihkub, et koht tuleks ekraani keskele
 * nii palju, kui toa servad lubavad (tuba ei tohi ekraani servast lahti tulla).
 * Nihe on protsentides ekraanist; `width` ja `height` annavad sama pikslites.
 * Telefonis vaatab kaamera alati keskele, sest avatud koht tuleb ise sinna
 * (RoomPlaces.module.css): servas seisvat kohta ei saaks kaamera keskele tuua.
 */
export function cameraFor(place, { width = 0, height = 0, narrow = false } = {}) {
  if (!place) return { scale: 1, txPercent: 0, tyPercent: 0, tx: 0, ty: 0 };
  const scale = narrow ? 1.2 : 1.3;
  const at = narrow ? NARROW_FOCUS : place;
  const txPercent = clamp(50 / scale - at.ax, 100 / scale - 100, 0);
  const tyPercent = clamp(42 / scale - at.ay, 100 / scale - 100, 0);
  return {
    scale,
    txPercent,
    tyPercent,
    tx: Math.round((txPercent / 100) * width * 100) / 100,
    ty: Math.round((tyPercent / 100) * height * 100) / 100
  };
}

/** Koht, mis on ekraani sellele kohale (protsent laiusest) kõige lähemal. */
export function nearestPlace(places, xPercent) {
  if (!Array.isArray(places) || !places.length) return null;
  return places.reduce((best, place) => (Math.abs(place.ax - xPercent) < Math.abs(best.ax - xPercent) ? place : best));
}

/** Järgmine koht nooleklahviga: toa servast edasi ei lähe. */
export function stepPlace(places, currentId, direction) {
  if (!Array.isArray(places) || !places.length) return null;
  const at = places.findIndex((place) => place.id === currentId);
  if (at < 0) return direction > 0 ? places[0] : places[places.length - 1];
  return places[clamp(at + (direction > 0 ? 1 : -1), 0, places.length - 1)];
}
