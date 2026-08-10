/**
 * SEADME KOHALIK SALVESTUS ON KONTO OMA, MITTE BRAUSERI OMA.
 *
 * KAKS LEIDU, ÜKS REEGEL. SOL-SLOG-01 (teenuspäeviku mustand ja võrgujärjekord
 * `localStorage`-is) ja SOL-JOUR-02 (Teekonna mustand `sessionStorage`-is) olid
 * sama viga eri failides: fikseeritud võti kogu brauseriprofiili kohta, ilma
 * kasutaja ID-ta, ilma logout-puhastuseta. Jagatud arvutis nägi järgmine
 * sisselogija eelmise inimese teksti.
 *
 * Kaks koopiat samast kaitsest lahkneksid — see fail on see üks koht.
 *
 * KAITSE ON STRUKTUURNE. `openOwnerScopedStore()` on ainus tee ridadeni ja ta
 * tagastab **`null`**, kui omanikku ei ole teada. Kutsujad käsitlevad `null`-i
 * juba niikuinii kui „salvestust ei ole" (server-render), seega identiteedita
 * hetk ei loe ega kirjuta midagi. See on ühtlasi kasutajavahetuse lukk.
 *
 * VÕTMES ON TOORES KASUTAJA-ID. Auditi kriteerium lubab „krüptograafiliselt VÕI
 * vähemalt autoriteetse ID järgi". Sünkroonne mitte-krüptoräsi tooks
 * kokkupõrke võimaluse, ja kokkupõrge ON see leke, mida parandame. Tundlik on
 * ridade VÄÄRTUS, mitte nende nimi.
 */

/** `::` sellepärast, et alusnimedes on juba punkte ja koolonit. */
const OWNER_SEPARATOR = "::";

function normalizeOwnerId(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function ownerScopedKey(row, ownerId) {
  const owner = normalizeOwnerId(ownerId);
  if (!row || !owner) return null;
  return `${row}${OWNER_SEPARATOR}${owner}`;
}

/**
 * @returns omanikuga seotud salvestus või **`null`**, kui omanikku ei ole
 *   (väljalogitud, sessioon veel laadimata) või salvestust ei ole (server).
 */
export function openOwnerScopedStore(storage, ownerId) {
  const owner = normalizeOwnerId(ownerId);
  if (!storage || !owner) return null;
  return {
    owner,
    getItem(row) {
      const key = ownerScopedKey(row, owner);
      if (!key) return null;
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(row, value) {
      const key = ownerScopedKey(row, owner);
      if (!key) return;
      try {
        storage.setItem(key, value);
      } catch {
        /* Kvoot täis või privaatrežiim ei tohi tööd katkestada. */
      }
    },
    removeItem(row) {
      const key = ownerScopedKey(row, owner);
      if (!key) return;
      try {
        storage.removeItem(key);
      } catch {
        /* sama */
      }
    }
  };
}

/**
 * VANA SILDISTAMATA RIDA KUSTUTATAKSE, MITTE EI ANTA KELLELEGI.
 *
 * Enne seda parandust kirjutatud read ei kanna omanikku ja teda ei saa
 * tagantjärele tuletada — sisus on kliendi tekst, mitte kasutaja. Kolm valikut
 * ja ainult üks ei leki: anda esimesele avajale (= leke ise), jätta seisma
 * (omanikuta isikuandmed jagatud seadmes) või kustutada.
 */
export function purgeUnscopedRows(storage, rows = []) {
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
