/**
 * Loendisse tagasituleku märk.
 *
 * Koostatud teksti detailileht on omaette leht ja toob dokumentide lehele tagasi
 * lehe algusesse. Kes läks sinna loendist, tahab tagasi tulles loendit näha:
 * märk pannakse lahkudes (`markListReturn`) ja loetakse üks kord tagasi jõudes
 * (`consumeListReturn`). Detailileht küsib `hasListReturn` abil, kas inimene
 * tuli loendist: siis viib „tagasi" tavalisele dokumentide lehele, mis märgi
 * ära kasutab, mitte süvalingile, mis jätaks märgi alles ja sunniks peale
 * koostatud tekstide filtri.
 */
const LIST_RETURN_STORAGE_KEY = "__SOTSIAAL.PRO_DOCUMENTS_LIST_RETURN__";
const LIST_RETURN_MAX_AGE_MS = 30 * 60 * 1000;

function readMark() {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(LIST_RETURN_STORAGE_KEY);
    if (!raw) return 0;
    const ts = Number(JSON.parse(raw)?.ts || 0);
    return Number.isFinite(ts) ? ts : 0;
  } catch {
    return 0;
  }
}

export function isFreshListReturn(ts, now = Date.now()) {
  return Number.isFinite(ts) && ts > 0 && now - ts < LIST_RETURN_MAX_AGE_MS;
}

export function markListReturn() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LIST_RETURN_STORAGE_KEY, JSON.stringify({ ts: Date.now() }));
  } catch {}
}

/** Kas märk on olemas ja värske (märki ei kustuta). */
export function hasListReturn() {
  return isFreshListReturn(readMark());
}

/** Loeb märgi ja kustutab selle: tagasitulek kehtib üks kord. */
export function consumeListReturn() {
  const ts = readMark();
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(LIST_RETURN_STORAGE_KEY);
    } catch {}
  }
  return isFreshListReturn(ts);
}
