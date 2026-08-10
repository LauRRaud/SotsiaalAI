/**
 * TEENUSPÄEVIK — SEADME KOHALIK SALVESTUS ON KONTO OMA, MITTE BRAUSERI OMA.
 *
 * MIKS SEE FAIL OLEMAS ON (SOL-SLOG-01, P0). Nii võrgujärjekord (`outbox.js`)
 * kui pooleli külastuse mustand (`visitDraft.js`) kasutasid ÜHT fikseeritud
 * `localStorage` võtit kogu brauseriprofiili kohta. Jagatud arvutis või samas
 * brauseris kontot vahetades nägi järgmine töötaja eelmise kliendi nime,
 * märkust ja aegu — ja järjekorra tühjendus SAATIS need kirjed uue töötaja
 * profiili teenuskirjeteks. Korraga isikuandmete leke ja vale arve
 * alusdokumendi teke.
 *
 * KAITSE ON STRUKTUURNE, MITTE MEELESPEA. Ei ole „ära unusta omanikku kaasa
 * anda" — `openDeviceStore()` on AINUS viis nende ridadeni jõuda ja ta
 * tagastab **`null`**, kui omanikku ei ole teada. Kutsujad käsitlevad `null`-i
 * juba täna kui „salvestust ei ole" (server-render), seega identiteedita hetk
 * ei loe ega kirjuta MITTE MIDAGI. See on ühtlasi kasutajavahetuse lukk:
 * sessiooni vahetumise ja uue omaniku teadasaamise vahel on seade kinni.
 *
 * VÕTMES ON TOORES KASUTAJA-ID. Auditi kriteerium lubab „krüptograafiliselt VÕI
 * vähemalt autoriteetse ID järgi" eraldada. Räsimine oleks siin halvem tehing:
 * sünkroonne mitte-krüptoräsi (FNV jms) toob kokkupõrke võimaluse, ja kokkupõrge
 * ON see leke, mida parandame. ID ise ei ole saladus — ridade VÄÄRTUSED on
 * tundlikud, mitte nende nimed.
 *
 * LOGOUT EI KUSTUTA. Järjekord hoiab TEHTUD TÖÖD; tema kustutamine on täpselt
 * see kahju, mida SOL-SLOG-02/-03 kirjeldavad (tasustamata töö). Seepärast on
 * valitud kriteeriumi teine haru — „turvaliselt üle antud": rida jääb oma konto
 * skoopi ja järgmine kasutaja ei jõua temani. Mustandil on lisaks oma iga
 * (`DRAFT_MAX_AGE_MS`), seega kliendi nimi ei seisa seadmes üle öö.
 */

/**
 * Ridade nimed. Enne olid need otse `localStorage` võtmed; nüüd on nad ALUS,
 * millele omanik lisatakse. Vana nimi jääb alusena samaks meelega — nii on
 * `purgeUnscopedRows()` alt näha, mida täpselt koristatakse.
 */
export const DEVICE_ROW = Object.freeze({
  OUTBOX: "sotsiaalai.service_log.outbox",
  VISIT_DRAFT: "sotsiaalai.service_log.visit_draft"
});

/** `::` sellepärast, et alusnimedes on juba punkte ja piir peab olema loetav. */
const OWNER_SEPARATOR = "::";

function normalizeOwnerId(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function deviceRowKey(row, ownerId) {
  const owner = normalizeOwnerId(ownerId);
  if (!row || !owner) return null;
  return `${row}${OWNER_SEPARATOR}${owner}`;
}

/**
 * @returns omanikuga seotud salvestus või **`null`**, kui omanikku ei ole
 *   (väljalogitud, sessioon veel laadimata) või salvestust ei ole (server).
 */
export function openDeviceStore(storage, ownerId) {
  const owner = normalizeOwnerId(ownerId);
  if (!storage || !owner) return null;
  return {
    owner,
    getItem(row) {
      const key = deviceRowKey(row, owner);
      return key ? storage.getItem(key) : null;
    },
    setItem(row, value) {
      const key = deviceRowKey(row, owner);
      if (key) storage.setItem(key, value);
    },
    removeItem(row) {
      const key = deviceRowKey(row, owner);
      if (key) storage.removeItem(key);
    }
  };
}

/**
 * VANA SILDISTAMATA RIDA KUSTUTATAKSE, MITTE EI ANTA KELLELEGI.
 *
 * Enne seda parandust kirjutatud read ei kanna omanikku ega saa teda tagantjärele
 * saada: payload'is on kliendi nimi, aeg ja märkus, aga mitte töötajat. Kolm
 * valikut ja miks jääb ainult üks:
 *
 *   a) anda esimesele, kes lehe avab → see ON leke, mida parandame;
 *   b) jätta puutumata → kliendi nimi seisab jagatud seadmes igavesti, omanikuta
 *      ja aegumiseta;
 *   c) kustutada → kaob saatmata töö, mis oli järjekorras parandusest VAREM.
 *
 * (c) on mõõdetud kahju, mitte oletatud: 10.08 seisuga on tootmises 11
 * teenuskirjet ja ÜKS osutajaprofiil (omaniku enda oma), viimane kirje 02.08.
 * Päris flotti, kelle telefonis saaks olla saatmata päevatöö, ei ole veel.
 */
export function purgeUnscopedRows(storage, rows = Object.values(DEVICE_ROW)) {
  if (!storage) return [];
  const removed = [];
  for (const row of rows) {
    try {
      if (storage.getItem(row) === null) continue;
      storage.removeItem(row);
      removed.push(row);
    } catch {
      /* Privaatrežiim või täis kvoot ei tohi lehe avanemist katkestada. */
    }
  }
  return removed;
}
