/**
 * TEENUSPÄEVIK E12 — KERGE SÕIDUPÄEVIK ja E11 navigatsioonilink.
 *
 * OMANIKU OTSUS 03.08, MIS MUUDAB LEPINGUT: **ODOMEETRIT EI TULE.**
 * Sõna-sõnalt: „Siin ma ütlesin stop sellele, et inimene peab odomeetri pealt
 * sõitu jälgima, seda ei saa kindlasti lubada."
 *
 * Leping (E12) lubas kaks allikat — odomeetri algus/lõpp VÕI saabumispunktide
 * vaheline hinnang. Esimene on nüüd VÄLJAS ja see ei ole kärbe, vaid õige
 * otsus: odomeetri lugemine tähendab, et töötaja peab iga sõidu alguses ja
 * lõpus autonäidikut vaatama ja numbrit tippima. See on täpselt see „paberil
 * arvestus digitaalses kuues", mille kaotamiseks kogu teenuspäevik olemas on.
 *
 * JÄÄB ÜKS ALLIKAS: kahe järjestikuse külastuse SAABUMISPUNKTI vaheline
 * kaugus. Selle annab seade ise, ilma et keegi peaks midagi lugema.
 *
 * KOLM ASJA, MIDA SEE MEETOD EI TEE, JA MIDA TULEB VÄLJA ÖELDA:
 *
 * 1. TA MÕÕDAB LINNULENNULT, MITTE TEED PIDI. Päris sõit on alati pikem.
 *    Seepärast on tulemus märgistatud HINNANGUNA ja tema kõrval on tegur, mille
 *    võrra teed mööda sõit tüüpiliselt pikem on. Me EI esita hinnangut faktina.
 *
 * 2. ILMA PUNKTITA EI OLE KAUGUST. Kui GPS-i luba puudus või täpsus ei
 *    kandnud välja, jääb lõik `null`-iks — mitte nulliks. Väljamõeldud number
 *    oleks siin halvem kui puuduv number, sest tema järgi makstakse.
 *
 * 3. TÖÖTAJA KINNITAB IGA RIDA. Hinnang ei lähe arvesse enne, kui inimene on
 *    ta üle vaadanud. Parandus on VABATAHTLIK ja käib kilomeetrites — see EI
 *    OLE odomeetri lugem, vaid „see arv on vale, õige on umbes selline".
 */

/** Maa keskmine raadius kilomeetrites. */
const EARTH_RADIUS_KM = 6371;

/**
 * TEEKONNATEGUR. Linnulennult mõõdetud kaugus korrutatakse sellega, et saada
 * teed mööda sõidu hinnang. 1,3 on levinud lähend Euroopa teedevõrgus; ta on
 * konstant ja mitte peenhäälestus, sest täpsem number nõuaks marsruudimootorit
 * ja looks eksliku mulje täpsusest.
 */
export const ROAD_FACTOR = 1.3;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Linnulennuline kaugus kahe punkti vahel. `null`, kui kumbki puudub. */
export function haversineKm(from, to) {
  const lat1 = Number(from?.lat);
  const lng1 = Number(from?.lng);
  const lat2 = Number(to?.lat);
  const lng2 = Number(to?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

const arrivalPoint = (visit) => visit?.locationStamps?.arrivedAt || null;

/**
 * AADRESSI KOORDINAAT (Maa-ameti register) — varuvariant mõõdetud punktile.
 *
 * Ta EI OLE tõend kohaloleku kohta: aadress ütleb, kuhu MINDI, tempel ütleb,
 * kus keegi OLI. Kauguse arvutamiseks kõlbab ta aga sama hästi ja tema võtmine
 * kasutusele kaotab enamiku „kaugus mõõtmata" ridadest — nimelt need, kus
 * GPS-i luba puudus.
 */
const addressPoint = (visit) =>
  Number.isFinite(Number(visit?.addressLat)) && Number.isFinite(Number(visit?.addressLng))
    ? { lat: Number(visit.addressLat), lng: Number(visit.addressLng) }
    : null;

/**
 * RISTKONTROLL: kas mõõdetud punkt ja aadress räägivad samast kohast?
 *
 * See on otsene vastus omaniku 02.08 mõõtmisele — seade ütles Kopli, tegelik
 * koht oli Tabasalu. Ühe punkti puhul EI OLE VÕIMALIK teada, kas ta on õige;
 * kahe sõltumatu allika puhul on. Kui nad lahknevad rohkem kui `toleranceKm`,
 * on üks neist vale ja seda peab NÄGEMA, mitte vaikselt salvestama.
 *
 * @returns `null` kui võrrelda ei ole, muidu `{ km, mismatch }`.
 */
export const LOCATION_MISMATCH_KM = 1;

export function crossCheckLocation(visit, { toleranceKm = LOCATION_MISMATCH_KM } = {}) {
  const measured = arrivalPoint(visit);
  const expected = addressPoint(visit);
  const km = haversineKm(measured, expected);
  if (km === null) return null;
  return { km: Math.round(km * 10) / 10, mismatch: km > toleranceKm };
}

/**
 * SÕIDULÕIGUD PÄEVA SEEST.
 *
 * Lõik tekib KAHE JÄRJESTIKUSE külastuse vahele: eelmise juurest ära, järgmise
 * juurde kohale. Just see on E2c parandus praktikas — „tagasi kontorisse" ei
 * ole kuskil, sest teda ei juhtunud.
 *
 * @returns iga lõigu kohta `{ fromVisitId, toVisitId, minutes, km, source }`,
 *   kus `source` on `"gps"` (mõõdetud punktidest), `"manual"` (töötaja
 *   parandus) või `"unknown"` (punkte ei olnud).
 */
export function buildLegs(visits = [], { corrections = {} } = {}) {
  const legs = [];
  for (let index = 1; index < visits.length; index += 1) {
    const previous = visits[index - 1];
    const current = visits[index];

    const minutes = (() => {
      const from = previous?.completedAt || previous?.cancelledAt || previous?.arrivedAt;
      const to = current?.enRouteAt || current?.arrivedAt;
      if (!from || !to) return null;
      const diff = (new Date(to).getTime() - new Date(from).getTime()) / 60000;
      return diff > 0 ? Math.round(diff) : null;
    })();

    const manual = Number(corrections[current.id]);
    /* MÕÕDETUD PUNKT VÕIDAB AADRESSI, sest ta ütleb, kus töötaja PÄRISELT oli.
       Aadress astub sisse ainult siis, kui mõõdetud punkti ei ole — muidu jääks
       lõik mõõtmata ka seal, kus me kaugust tegelikult teame. */
    const from = arrivalPoint(previous) || addressPoint(previous);
    const to = arrivalPoint(current) || addressPoint(current);
    const straight = haversineKm(from, to);
    const fromAddress = !arrivalPoint(previous) || !arrivalPoint(current);

    let km = null;
    let source = "unknown";
    if (Number.isFinite(manual) && manual >= 0) {
      /* Töötaja parandus võidab mõõtmise: tema teab, kas ta sõitis ringi. */
      km = Math.round(manual * 10) / 10;
      source = "manual";
    } else if (straight !== null) {
      km = Math.round(straight * ROAD_FACTOR * 10) / 10;
      /* Allikas öeldakse VÄLJA: „aadressi järgi" ja „mõõdetud punktide järgi"
         ei ole sama usaldusväärsusega ja aruande lugeja peab seda teadma. */
      source = fromAddress ? "address" : "gps";
    }

    legs.push({
      fromVisitId: previous.id,
      toVisitId: current.id,
      fromClient: previous.clientDisplayName || null,
      toClient: current.clientDisplayName || null,
      minutes,
      km,
      source,
      /* HINNANG ON MÄRGISTATUD. Ilma selle liputa hakkaks keegi teda mõne kuu
         pärast mõõdetud kilomeetriks pidama. */
      estimated: source === "gps" || source === "address"
    });
  }
  return legs;
}

export function summarizeMileage(legs = []) {
  let km = 0;
  let minutes = 0;
  let missing = 0;
  for (const leg of legs) {
    if (leg.km === null) missing += 1;
    else km += leg.km;
    minutes += leg.minutes || 0;
  }
  return {
    legs: legs.length,
    km: Math.round(km * 10) / 10,
    minutes,
    /* MITU LÕIKU JÄI MÕÕTMATA — see number peab olema nähtav. Kui ta on suur,
       ei ole päeva kilomeetrid esitamiskõlblikud ja seda peab teadma ENNE
       aruande saatmist, mitte pärast. */
    missing
  };
}

/**
 * E11 — ÜHE PUUTEGA NAVIGATSIOON.
 *
 * Kaardimootorit me ei ehita ega manusta: link avab selle rakenduse, mis
 * kasutajal juba olemas on. AADRESS VÕIDAB KOORDINAADI, sest aadress viib
 * ukseni ja koordinaat viib punkti, mille täpsus võib olla sadu meetreid.
 * Koordinaat on varuvariant, kui aadressi ei ole.
 *
 * `null` tähendab „navigeerida ei ole kuhugi" — nuppu siis ei kuvata.
 */
export function buildNavigationUrl(visit) {
  const address = String(visit?.address || "").trim();
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  const point = arrivalPoint(visit);
  if (point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))) {
    return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
  }
  return null;
}
