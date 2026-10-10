/**
 * Tekstikataloog eraldi failina: üks skript keele kohta, nimes sisu räsi.
 *
 * MIKS. Juurpaigutus andis kogu kataloogi (umbes 800 kB) kliendile atribuudina:
 * see kirjutati iga lehe HTML-i sisse ja laaditi iga lehe avamisega uuesti.
 * Nüüd viitab leht failile `/i18n/<keel>.<räsi>.js`. Räsi muutub ainult siis,
 * kui tekstid muutuvad, seega võib brauser faili hoida vahemälus püsivalt.
 *
 * KUIDAS LEHT KATALOOGI SAAB.
 *  - Skript seisab lehe keha lõpus tavalise (mitte `async`) skriptina: brauser
 *    joonistab enne lehe sisu ja käivitab skripti enne neid lehe lõpu skripte,
 *    millest React lehe elustamiseks andmed saab. Kataloog on seega alati käes
 *    enne, kui React esimest korda joonistab; tõlkimata võtmeid ei näidata.
 *  - Skript paneb kataloogi kohta `window.__SOTSIAAL_I18N__[<keel>]`.
 *  - Serveris joonistab tõlke pakkuja lehe samast kataloogist
 *    (`globalThis.__SOTSIAAL_I18N_SERVER__`, täidetakse siin faili laadimisel).
 *
 * Serveri moodul (Node): kliendi koodist seda ei impordita.
 */
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib";

import en from "../../messages/en.json" with { type: "json" };
import et from "../../messages/et.json" with { type: "json" };
import ru from "../../messages/ru.json" with { type: "json" };

import { CATALOG_LOCALES, normalizeCatalogLocale } from "./catalogLoader.js";

export const CATALOG_GLOBAL = "__SOTSIAAL_I18N__";
export const CATALOG_SERVER_GLOBAL = "__SOTSIAAL_I18N_SERVER__";
export const CATALOG_ASSET_PREFIX = "/i18n/";

const CATALOGS = Object.freeze({ et, en, ru });

/* Serveri joonistus (kliendi komponendid serveris) loeb kataloogi siit. */
globalThis[CATALOG_SERVER_GLOBAL] = CATALOGS;

/* JSON tekst ühekordsetes jutumärkides JS-sõnena: kaldkriips ja ülakoma saavad
   paomärgi. `JSON.parse` suure sõne peal on brauseris kiirem kui sama sisu
   objektina kirjutatult. */
/* Rea- ja lõiguvahe märgid (U+2028, U+2029) kirjutatakse paojadana: vanem brauser
   ei luba neid JS-sõne sees. Märgid tehakse koodist, et lähtefailis neid ei oleks. */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const BACKSLASH = String.fromCharCode(92);

function asSingleQuoted(jsonText) {
  const escaped = jsonText
    .split(BACKSLASH).join(BACKSLASH + BACKSLASH)
    .split("'").join(BACKSLASH + "'")
    .split(LINE_SEPARATOR).join(BACKSLASH + "u2028")
    .split(PARAGRAPH_SEPARATOR).join(BACKSLASH + "u2029");
  return `'${escaped}'`;
}

/** Skripti sisu ühe keele jaoks. Eraldi funktsioon, et test saaks selle käivitada. */
export function buildCatalogScript(locale, catalog) {
  const key = normalizeCatalogLocale(locale);
  return `(self.${CATALOG_GLOBAL}=self.${CATALOG_GLOBAL}||{}).${key}=JSON.parse(${asSingleQuoted(JSON.stringify(catalog))});`;
}

const built = new Map();

/** @returns {{ locale: string, body: string, hash: string, path: string }} */
export function catalogAsset(locale) {
  const key = normalizeCatalogLocale(locale);
  if (!built.has(key)) {
    const body = buildCatalogScript(key, CATALOGS[key]);
    const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);
    built.set(key, { locale: key, body, hash, path: `${CATALOG_ASSET_PREFIX}${key}.${hash}.js` });
  }
  return built.get(key);
}

const warmed = new Set();

/**
 * Aadress, mida leht kataloogi skriptina laadib.
 *
 * Esimene leht, mis keele aadressi küsib, paneb ka pakkimise käima: brauser
 * küsib faili alles pärast HTML-i kättesaamist ja saab siis juba poolelioleva
 * (või valmis) pakkimise tulemuse, mitte ei oota tervet sekundit.
 */
export function catalogScriptPath(locale) {
  const asset = catalogAsset(locale);
  if (!warmed.has(asset.locale)) {
    warmed.add(asset.locale);
    for (const encoding of ["br", "gzip"]) packedCatalogAsset(asset, encoding).catch(() => {});
  }
  return asset.path;
}

const ASSET_NAME = /^([a-z]{2})\.([0-9a-f]{16})\.js$/;

/**
 * Faili nimi → mida vastata. Tundmatu nimi või keel: `null` (404).
 * `current: false` tähendab, et küsiti vana räsiga faili (leht on avatud enne
 * tekstide muutumist): vastatakse praeguse kataloogiga, aga vahemällu seda ei
 * panda, sest nimi ja sisu ei käi enam kokku.
 */
export function resolveCatalogAsset(name) {
  const match = ASSET_NAME.exec(String(name || ""));
  if (!match || !CATALOG_LOCALES.includes(match[1])) return null;
  const asset = catalogAsset(match[1]);
  return { ...asset, current: asset.hash === match[2] };
}

/* ── pakkimine ───────────────────────────────────────────────────────────────
   Server pakib ise lehti ja ehitaja faile, aga mitte selle marsruudi vastust
   (mõõdetud: 731 kB läks teele pakkimata). Fail pakitakse seepärast siin, üks
   kord keele ja pakkimisviisi kohta: brotli umbes 180 kB, gzip umbes 220 kB.
   Brotli kõige tihedam aste võtab umbes sekundi; see tehakse taustalõimes ja
   tulemus jääb mällu kuni serveri taaskäivitamiseni. */
const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);
const packed = new Map();

/** Mida brauser vastu võtab: `br`, `gzip` või tühi (pakkimata). `;q=0` tähendab keeldu. */
export function pickEncoding(acceptEncoding) {
  const accepted = new Set();
  for (const part of String(acceptEncoding || "").toLowerCase().split(",")) {
    const [name, ...params] = part.split(";").map((piece) => piece.trim());
    if (!name) continue;
    const refused = params.some((param) => /^q=0(\.0*)?$/.test(param));
    if (!refused) accepted.add(name);
  }
  if (accepted.has("br")) return "br";
  if (accepted.has("gzip")) return "gzip";
  return "";
}

/**
 * Faili sisu baitidena selle pakkimisega, mida brauser vastu võtab.
 * @returns {Promise<{ bytes: Buffer, encoding: string }>}
 */
export async function packedCatalogAsset(asset, acceptEncoding) {
  const encoding = pickEncoding(acceptEncoding);
  const key = `${asset.locale}:${asset.hash}:${encoding}`;
  if (!packed.has(key)) {
    const plain = Buffer.from(asset.body, "utf8");
    const work =
      encoding === "br"
        ? brotliAsync(plain, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11, [zlibConstants.BROTLI_PARAM_SIZE_HINT]: plain.length } })
        : encoding === "gzip"
          ? gzipAsync(plain, { level: 9 })
          : Promise.resolve(plain);
    /* Ebaõnnestunud pakkimist ei jäeta mällu: järgmine päring proovib uuesti. */
    packed.set(key, work.catch((error) => {
      packed.delete(key);
      throw error;
    }));
  }
  return { bytes: await packed.get(key), encoding };
}
