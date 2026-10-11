/**
 * Tekstikataloog kliendi poolel: kust tõlke pakkuja selle saab.
 *
 * 1. LEHE ENDA KEEL on käes kohe: paigutus lisab lehe lõppu skripti
 *    (`/i18n/<keel>.<räsi>.js`, vt lib/i18n/catalogAsset.js), mis paneb kataloogi
 *    kohta `window.__SOTSIAAL_I18N__[<keel>]` enne, kui React lehe elustab.
 *    Serveris on sama kataloog kohas `globalThis.__SOTSIAAL_I18N_SERVER__`.
 *    `readCatalog` loeb selle ootamata.
 * 2. TEINE KEEL (keelevahetuse eelvaade ja salvestatud uus keel) ning varutee,
 *    kui lehe skript ei jõudnud kohale: `loadCatalog` / `refreshCatalog`
 *    laadivad keelefaili eraldi failina (ehitaja teeb igast `import()` reast
 *    oma faili; laaditakse ainult küsitud keel).
 *
 * ÄRA IMPORDI kataloogi kliendi koodis tavalise `import`-iga: siis läheks see
 * lehe põhikimpu ja laaditaks iga lehega kõigis keeltes.
 */
import { createCatalogLoader, hasTexts, normalizeCatalogLocale } from "@/lib/i18n/catalogLoader";

/* Samad nimed mis failis lib/i18n/catalogAsset.js (see on serveri moodul ja siia seda ei impordita). */
const CATALOG_GLOBAL = "__SOTSIAAL_I18N__";
const CATALOG_SERVER_GLOBAL = "__SOTSIAAL_I18N_SERVER__";

const catalogs = createCatalogLoader({
  et: () => import("@/messages/et.json"),
  ru: () => import("@/messages/ru.json"),
  en: () => import("@/messages/en.json")
});

/** Püsiv lubadus keele kataloogile (joonistamise ajaks; ei lükka kunagi tagasi). */
export const loadCatalog = catalogs.load;
/**
 * Sama, aga ebaõnnestunud katse järel proovib uuesti (efektist või nupust).
 * Kataloogi, mis on juba käes (lehe enda keel), uuesti ei laadita.
 */
export function refreshCatalog(locale) {
  const ready = readCatalog(locale);
  return ready ? Promise.resolve(ready) : catalogs.refresh(locale);
}

/**
 * Kataloog, mis on juba käes (lehe skriptist, serveris serveri mälust või varem
 * laaditud failist), või `null`. Ei oota ega laadi midagi.
 */
export function readCatalog(locale) {
  const key = normalizeCatalogLocale(locale);
  const store = typeof window === "undefined" ? globalThis[CATALOG_SERVER_GLOBAL] : window[CATALOG_GLOBAL];
  const ready = store && typeof store === "object" ? store[key] : null;
  if (hasTexts(ready)) return ready;
  return catalogs.peek(key);
}
