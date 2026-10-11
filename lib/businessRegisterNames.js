/**
 * ÄRIREGISTRI NIMED — mis nimi on registris ühe registrikoodi all.
 *
 * Auk, mida see sulgeb: teenuseprofiili asutuse nimi oli vaba tekst. Registrikoodi sai kinnitada
 * profiilil, mille nimi oli hoopis teine, ja registrikoodita profiil sai kanda mis tahes asutuse
 * nime. Avalik profiil ja märgis „tegevusluba kontrollitud" võisid seista vale nime all.
 *
 * Fail `src/server/data/business-register-names.tsv`: üks rida iga registrisse kantud (staatus R)
 * asutuse kohta, järjestatud registrikoodi järgi. Faili teeb
 * `scripts/business-register-contacts-build.mjs` samast äriregistri avaandmete failist, millest
 * tuleb kontaktide kontrollfail (lib/businessRegisterContacts.js; litsents CC BY 4.0).
 *
 *   kood<TAB>N<TAB>nimi   juriidiline isik või asutus: nimi on failis, vorm saab seda näidata;
 *   kood<TAB>H<TAB>räsi   füüsilisest isikust ettevõtja: nimi on inimese nimi ja seda failis EI OLE.
 *                         Real on paari (kood, ühtlustatud nimi) SHA-256 räsi algus; kontroll
 *                         ütleb „sobib" või „ei sobi", aga nime ei näita.
 *
 * Nimed võrreldakse ühtlustatud kujul: suurtähed, jutumärgid ja tühikute arv ei loe, kõik muu
 * loeb. Võrreldakse alati tervet nime, mitte osa: lühike või tavaline sõna ei anna valehäiret.
 *
 * Vastus ei ole kunagi vaikimisi „sobib": kui faili ei saa lugeda, on vastus `unavailable`.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeRegistryCode } from "./businessRegisterContacts.js";

export const REGISTER_NAMES_FILE = path.join(process.cwd(), "src", "server", "data", "business-register-names.tsv");
export const REGISTER_NAMES_META_FILE = path.join(process.cwd(), "src", "server", "data", "business-register-names.meta.json");

const NAME_HASH_DOMAIN = "sotsiaal.pro/business-register-name/v1";
const NAME_HASH_HEX = 16;
const KIND_NAME = "N";
const KIND_HASH = "H";
const TAB = 0x09;
const NEWLINE = 0x0a;

/* Õiguslikud vormid, mille nimi ei ole inimese nimi ja võib failis lihttekstina olla. Iga muu vorm
   (füüsilisest isikust ettevõtja, tundmatu või uus vorm) läheb faili ainult räsina. */
export const PLAIN_NAME_LEGAL_FORMS = Object.freeze(new Set([
  "OÜ", "AS", "MTÜ", "SA", "TÜ", "UÜ", "TÜH", "KÜ", "FIL", "KOVAS", "TRAS", "AMETÜ", "MPÜ", "AVOIG", "EMÜ", "SE", "ERAK"
]));

export const RegisterNameResult = Object.freeze({
  /* Registrikoodiga: nimi on registri nimi selle koodi kohta. */
  MATCH: "match",
  /* Registrikoodiga: kood on registris, aga nimi on teine. */
  MISMATCH: "mismatch",
  /* Registrikoodiga: seda koodi failis ei ole (vigane kood või asutus ei ole registrisse kantud). */
  CODE_NOT_LISTED: "code_not_listed",
  /* Registrikoodita: kirjutatud nimi on registrisse kantud asutuse nimi. */
  CODE_REQUIRED: "code_required",
  /* Registrikoodita: sellist asutuse nime registris ei ole. */
  FREE: "free",
  /* Faili ei saanud lugeda: „ei tea", mitte „sobib". */
  UNAVAILABLE: "unavailable"
});

const QUOTE_MARKS = /["'`´‘’‚‛“”„‟«»‹›]/gu;
const DASH_MARKS = /[‐‑‒–—―]/gu;

/**
 * Nimi võrdlemiseks: väiketähtedega, jutumärkideta, kriipsud ühel kujul ja tühikud ühekordsed.
 * Muud märgid (koma, punkt, &) jäävad: teine kirjapilt on teine nimi.
 */
export function normalizeOrganizationName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(QUOTE_MARKS, "")
    .replace(DASH_MARKS, "-")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Paari (registrikood, nimi) räsi kuueteistkümnendkujul; tühi, kui kood või nimi ei ole sobiv. */
export function registerNamePairHash(registryCode, name) {
  const code = normalizeRegistryCode(registryCode);
  const normalized = normalizeOrganizationName(name);
  if (!code || !normalized) return "";
  return createHash("sha256")
    .update(`${NAME_HASH_DOMAIN}\n${code}\n${normalized}`)
    .digest("hex")
    .slice(0, NAME_HASH_HEX);
}

/* Nimi faili reale: reavahetus ega tabeldusmärk ei tohi rea kuju lõhkuda. */
function lineSafeName(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

/**
 * Kogub asutuste nimed (`registerCompanies` väljund, lib/businessRegisterContacts.js): ainult
 * registrisse kantud (staatus R) asutused, igaüks üks kord.
 */
export function registerNameCollector() {
  const entries = new Map();
  const byLegalForm = {};
  return {
    add(company) {
      const code = normalizeRegistryCode(company?.code);
      const name = lineSafeName(company?.name);
      if (company?.status !== "R" || !code || !name) return;
      const legalForm = String(company.legalForm || "");
      if (!entries.has(code)) byLegalForm[legalForm || "?"] = (byLegalForm[legalForm || "?"] || 0) + 1;
      entries.set(code, { name, plain: PLAIN_NAME_LEGAL_FORMS.has(legalForm) });
    },
    result() {
      let plainNames = 0;
      for (const entry of entries.values()) if (entry.plain) plainNames += 1;
      return { entries, plainNames, hashedNames: entries.size - plainNames, byLegalForm };
    }
  };
}

/** Nimede fail kogutud kirjetest, järjestatud registrikoodi järgi (vt faili päis). */
export function registerNamesFileFrom(entries) {
  const lines = [...entries]
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([code, entry]) => (entry.plain
      ? `${code}\t${KIND_NAME}\t${entry.name}\n`
      : `${code}\t${KIND_HASH}\t${registerNamePairHash(code, entry.name)}\n`));
  return Buffer.from(lines.join(""), "utf8");
}

function parseLine(buffer, start, end) {
  const codeEnd = buffer.indexOf(TAB, start);
  if (codeEnd <= start || codeEnd + 2 >= end || buffer[codeEnd + 2] !== TAB) return null;
  const code = buffer.toString("latin1", start, codeEnd);
  const kind = String.fromCharCode(buffer[codeEnd + 1]);
  if (!/^\d{6,12}$/u.test(code) || (kind !== KIND_NAME && kind !== KIND_HASH)) return null;
  return { code, kind, value: buffer.toString("utf8", codeEnd + 3, end) };
}

/* Kahendotsing ridade kaupa: rea algus leitakse keskkohast tagasi minnes. */
function findEntry(buffer, code) {
  const target = Number(code);
  let low = 0;
  let high = buffer.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const start = middle > 0 ? buffer.lastIndexOf(NEWLINE, middle - 1) + 1 : 0;
    const end = buffer.indexOf(NEWLINE, start);
    const line = parseLine(buffer, start, end);
    if (!line) return null;
    const order = Number(line.code) - target;
    if (order === 0) return line;
    if (order < 0) low = end + 1;
    else high = start;
  }
  return null;
}

const YIELD_EVERY = 20000;

/* Loeb faili korra läbi: kontrollib kuju ja järjekorda ning kogub juriidiliste isikute ühtlustatud
   nimed (registrikoodita profiili kontrolli jaoks). Annab vahepeal järje teistele päringutele. */
async function readRegisterNames(file) {
  const buffer = await readFile(file);
  if (!buffer.length || buffer[buffer.length - 1] !== NEWLINE) throw new Error("BUSINESS_REGISTER_NAMES_INVALID");
  const names = new Set();
  let entries = 0;
  let previous = -1;
  let start = 0;
  while (start < buffer.length) {
    const end = buffer.indexOf(NEWLINE, start);
    const line = parseLine(buffer, start, end);
    const code = line ? Number(line.code) : -1;
    if (!line || !line.value || code <= previous) throw new Error("BUSINESS_REGISTER_NAMES_INVALID");
    if (line.kind === KIND_NAME) names.add(normalizeOrganizationName(line.value));
    previous = code;
    entries += 1;
    start = end + 1;
    if (entries % YIELD_EVERY === 0) await new Promise((resolve) => setImmediate(resolve));
  }
  return {
    entries,
    /** Registri kirje koodi järgi: `{ name }` (juriidiline isik), `{ name: null, hash }` või `null`. */
    entry(registryCode) {
      const code = normalizeRegistryCode(registryCode);
      const line = code ? findEntry(buffer, code) : null;
      if (!line) return null;
      return line.kind === KIND_NAME ? { name: line.value, hash: null } : { name: null, hash: line.value };
    },
    /** Kas ühtlustatud nimi on registrisse kantud juriidilise isiku või asutuse nimi. */
    hasName(normalizedName) {
      return Boolean(normalizedName) && names.has(normalizedName);
    }
  };
}

let cached = null;

/** Nimede register mälus. Viskab, kui faili ei saa lugeda või selle kuju on vale. */
export function loadRegisterNames({ file = REGISTER_NAMES_FILE } = {}) {
  if (cached?.file !== file) {
    const loading = readRegisterNames(file);
    cached = { file, loading };
    /* Ebaõnnestunud lugemist ei jäeta meelde: järgmine päring proovib uuesti. */
    loading.catch(() => {
      if (cached?.loading === loading) cached = null;
    });
  }
  return cached.loading;
}

/**
 * Nimekontroll juba loetud registri vastu (`register` on `null`, kui lugemine ebaõnnestus).
 *
 * Tagastab `{ result, registerName }`. `registerName` on registri nimi selle koodi kohta, kui see
 * on failis lihttekstina; füüsilisest isikust ettevõtja korral `null`.
 */
export function registerNameCheck(register, { registryCode, organizationName } = {}) {
  if (!register) return { result: RegisterNameResult.UNAVAILABLE, registerName: null };
  const name = normalizeOrganizationName(organizationName);
  if (!String(registryCode ?? "").trim()) {
    return { result: register.hasName(name) ? RegisterNameResult.CODE_REQUIRED : RegisterNameResult.FREE, registerName: null };
  }
  const entry = register.entry(registryCode);
  if (!entry) return { result: RegisterNameResult.CODE_NOT_LISTED, registerName: null };
  const matches = entry.name !== null
    ? Boolean(name) && normalizeOrganizationName(entry.name) === name
    : Boolean(name) && entry.hash === registerNamePairHash(registryCode, organizationName);
  return { result: matches ? RegisterNameResult.MATCH : RegisterNameResult.MISMATCH, registerName: entry.name };
}

/** Nimede register või `null`, kui seda ei saa lugeda (kutsujale, kes kontrollib mitut profiili). */
export async function loadRegisterNamesOrNull(options) {
  try {
    return await loadRegisterNames(options);
  } catch {
    return null;
  }
}

/**
 * Kas profiili nimi vastab äriregistrile.
 *
 * Registrikoodiga: `match`, `mismatch` või `code_not_listed`. Registrikoodita: `code_required`
 * (nimi on registrisse kantud asutuse nimi) või `free`. Kui faili ei saa lugeda: `unavailable`.
 */
export async function checkRegisterName(input, options) {
  return registerNameCheck(await loadRegisterNamesOrNull(options), input);
}

/** Nimede faili päis: millal ja millest see tehti. `null`, kui faili ei ole. */
export async function registerNamesMeta({ file = REGISTER_NAMES_META_FILE } = {}) {
  try {
    const meta = JSON.parse(await readFile(file, "utf8"));
    return {
      builtAt: meta?.builtAt || null,
      sourceFile: meta?.sourceFile || null,
      sourceLastModified: meta?.sourceLastModified || null,
      entries: Number(meta?.entries) || 0
    };
  } catch {
    return null;
  }
}

/** Ainult testile: unusta mällu loetud fail. */
export function resetRegisterNamesCache() {
  cached = null;
}
