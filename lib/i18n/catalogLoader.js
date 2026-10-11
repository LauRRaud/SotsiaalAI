/**
 * Tekstikataloogi laadija: üks lubadus keele kohta.
 *
 * MIKS. Kataloog (messages/<keel>.json, umbes 800 kB) kirjutati varem iga lehe
 * HTML-i sisse: juurpaigutus andis selle kliendile atribuudina ja iga lehe
 * avamine laadis selle uuesti. Nüüd laadib leht kataloogi eraldi failina, mille
 * nimes on sisu räsi: brauser hoiab seda vahemälus, kuni tekstid muutuvad.
 *
 * REEGLID.
 *  - `load(keel)` annab ALATI SAMA lubaduse. React'i `use` ootab lubadust
 *    joonistamise ajal: kui iga joonistus saaks uue lubaduse, jääks leht
 *    lõputult ootama.
 *  - Laadimise tõrge ei tohi lehte maha võtta. Proovitakse veel üks kord; kui
 *    ka see ei õnnestu, on vastus tühi kataloog (ekraanile jäävad varutekstid).
 *    Ebaõnnestunud lubadust `load` ei asenda (vt eelmine punkt): uue katse teeb
 *    `refresh(keel)`, mida kutsutakse väljaspool joonistamist.
 *  - Tundmatu keel on eesti keel, nagu juurpaigutuses.
 *
 * Puhas moodul: laadijad antakse sisse (`components/i18n/catalogs.js` annab
 * päris failid, test annab võltsid).
 */

export const CATALOG_LOCALES = Object.freeze(["et", "ru", "en"]);
export const DEFAULT_CATALOG_LOCALE = "et";

export function normalizeCatalogLocale(locale) {
  const value = String(locale || "").trim().toLowerCase();
  return CATALOG_LOCALES.includes(value) ? value : DEFAULT_CATALOG_LOCALE;
}

/** Kas kataloogis on tekste (tühi kataloog = laadimine ebaõnnestus või seda ei ole). */
export function hasTexts(catalog) {
  if (!catalog || typeof catalog !== "object") return false;
  for (const key in catalog) {
    if (Object.prototype.hasOwnProperty.call(catalog, key)) return true;
  }
  return false;
}

/* Mooduli sisu: JSON-i import annab kataloogi `default` all. */
function catalogFrom(loaded) {
  const value = loaded && typeof loaded === "object" && "default" in loaded ? loaded.default : loaded;
  return value && typeof value === "object" ? value : {};
}

/**
 * @param {Record<string, () => Promise<unknown>>} loaders keel → laadija
 */
export function createCatalogLoader(loaders) {
  /* keel → { promise, failed, catalog } */
  const entries = new Map();

  function start(key) {
    const entry = { promise: null, failed: false, catalog: null };
    const attempt = () => Promise.resolve().then(() => loaders[key]()).then(catalogFrom);
    entry.promise = attempt()
      .catch(() => attempt())
      .then((catalog) => {
        if (!hasTexts(catalog)) throw new Error("empty catalogue");
        entry.catalog = catalog;
        return catalog;
      })
      .catch(() => {
        entry.failed = true;
        return {};
      });
    entries.set(key, entry);
    return entry;
  }

  /** Püsiv lubadus: sobib joonistamise ajal (`use`). Ei lükka kunagi tagasi. */
  function load(locale) {
    const key = normalizeCatalogLocale(locale);
    return (entries.get(key) || start(key)).promise;
  }

  /** Nagu `load`, aga ebaõnnestunud katse järel proovib uuesti. Kutsu efektist või nupust, mitte joonistamise ajal. */
  function refresh(locale) {
    const key = normalizeCatalogLocale(locale);
    const entry = entries.get(key);
    return (entry && !entry.failed ? entry : start(key)).promise;
  }

  /** Juba laaditud kataloog ootamata, või `null`. */
  function peek(locale) {
    return entries.get(normalizeCatalogLocale(locale))?.catalog || null;
  }

  return { load, refresh, peek };
}
