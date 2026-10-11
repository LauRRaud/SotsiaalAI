/**
 * ÄRIREGISTRI KONTAKTIDE KONTROLL — ilma aadresside loendita.
 *
 * Teenuseprofiili esindusõiguse kinnituslink läheb asutuse e-postile, mis on äriregistris selle
 * asutuse kontaktina kirjas. Platvorm EI HOIA asutuste aadresse: teenuseosutaja kirjutab
 * aadressi ise ja siin kontrollitakse ainult, kas paar (registrikood, e-post) on registris.
 *
 * Selleks on fail `src/server/data/business-register-contact-hashes.bin`: iga registris oleva
 * paari kohta kaheksa baiti SHA-256 räsist, sorteeritult. Faili teeb
 * `scripts/business-register-contacts-build.mjs` äriregistri avaandmete failist „Üldandmed"
 * (avaandmed.ariregister.rik.ee, litsents CC BY 4.0). Failis on ainult registrisse kantud
 * (staatus R) asutuste kehtivad e-posti kontaktid.
 *
 * Kaheksa baiti: juhusliku vale aadressi sattumine loendisse on tõenäosusega umbes 2·10⁻¹⁴
 * katse kohta, ja katseid piirab päringupiirang. Räsist ei saa aadressi tagasi lugeda muidu kui
 * proovides aadresse, mis on registris niikuinii avalikud.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const CONTACT_HASH_BYTES = 8;
const HASH_DOMAIN = "sotsiaal.pro/business-register-contact/v1";
export const CONTACT_HASH_FILE = path.join(process.cwd(), "src", "server", "data", "business-register-contact-hashes.bin");
export const CONTACT_HASH_META_FILE = path.join(process.cwd(), "src", "server", "data", "business-register-contact-hashes.meta.json");

/** Registrikood kujul, nagu register seda kannab: ainult numbrid. */
export function normalizeRegistryCode(value) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  return digits.length >= 6 && digits.length <= 12 ? digits : "";
}

/** E-posti aadress võrdlemiseks: tühikuteta ja väiketähtedega. Vigane kuju annab tühja. */
export function normalizeContactEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return "";
  return /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/u.test(email) ? email : "";
}

/** Paari räsi: kaheksa baiti. Tagastab `null`, kui kood või aadress ei ole sobival kujul. */
export function contactPairHash(registryCode, email) {
  const code = normalizeRegistryCode(registryCode);
  const address = normalizeContactEmail(email);
  if (!code || !address) return null;
  return createHash("sha256")
    .update(`${HASH_DOMAIN}\n${code}\n${address}`)
    .digest()
    .subarray(0, CONTACT_HASH_BYTES);
}

/** Kahendotsing sorteeritud kaheksabaidiste kirjete puhvris. */
export function hashListHas(list, hash) {
  if (!list || !hash || hash.length !== CONTACT_HASH_BYTES) return false;
  if (list.length % CONTACT_HASH_BYTES !== 0) return false;
  let low = 0;
  let high = list.length / CONTACT_HASH_BYTES - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const offset = middle * CONTACT_HASH_BYTES;
    const order = list.compare(hash, 0, CONTACT_HASH_BYTES, offset, offset + CONTACT_HASH_BYTES);
    if (order === 0) return true;
    /* `compare` võrdleb loendi lõiku räsiga: negatiivne tähendab, et loendi kirje on väiksem. */
    if (order < 0) low = middle + 1;
    else high = middle - 1;
  }
  return false;
}

const COMPANY_LINE = /^\s{8}"ariregistri_kood":\s*(\d+)/u;
const COMPANY_NAME_LINE = /^\s{8}"nimi":/u;
const FIELD_LINE = /^\s*"([a-z_0-9]+)":\s*(.*?),?\s*$/u;

function jsonString(raw) {
  try {
    const value = JSON.parse(raw);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

/**
 * Loeb äriregistri faili „Üldandmed" ridu ja annab asutused ükshaaval:
 * `{ code, name, status, legalForm, emails }`.
 *
 * Register väljastab iga välja omal real: asutus algab reaga `"ariregistri_kood"` kaheksa tühiku
 * taandega ja tema nimi on sama taandega real `"nimi"`. Kontaktid on loendis `sidevahendid` ja
 * kontakti kirje viimane väli on `lopp_kpv`; `emails` on kehtivad (`lopp_kpv` tühi) e-posti
 * kontaktid (`liik` EMAIL). `status` ja `legalForm` on asutuse kirje esimesed `staatus` ja
 * `oiguslik_vorm`: hilisemad samanimelised väljad kuuluvad kaartidele ja ajaloole.
 *
 * `lines` on ridade asünkroonne jada.
 */
export async function* registerCompanies(lines) {
  let company = null;
  let inContacts = false;
  let kind = "";
  let content = "";

  for await (const line of lines) {
    const start = COMPANY_LINE.exec(line);
    if (start) {
      if (company) yield company;
      company = { code: start[1], name: "", status: null, legalForm: null, emails: [] };
      inContacts = false;
      continue;
    }
    if (!company) continue;
    const field = FIELD_LINE.exec(line);
    if (!field) {
      if (inContacts && line.trimStart().startsWith("]")) inContacts = false;
      continue;
    }
    const [, key, raw] = field;
    if (key === "sidevahendid") {
      inContacts = !raw.startsWith("[]");
      continue;
    }
    if (!inContacts) {
      if (key === "nimi" && !company.name && COMPANY_NAME_LINE.test(line)) company.name = jsonString(raw);
      else if (key === "staatus" && company.status === null) company.status = jsonString(raw);
      else if (key === "oiguslik_vorm" && company.legalForm === null) company.legalForm = jsonString(raw);
      continue;
    }
    if (key === "liik") kind = jsonString(raw);
    else if (key === "sisu") content = jsonString(raw);
    else if (key === "lopp_kpv") {
      /* Lõppenud kontakt (kuupäevaga) ei ole enam asutuse aadress. */
      if (kind === "EMAIL" && raw === "null") company.emails.push(content);
      kind = "";
      content = "";
    }
  }
  if (company) yield company;
}

/**
 * Kogub paaride (registrikood, e-post) räsid: ainult registrisse kantud asutuse (staatus R)
 * kehtivad e-posti kontaktid. `result()` annab loendurid ja räside hulga (kuueteistkümnendkujul).
 */
export function contactHashCollector() {
  const hashes = new Set();
  let companies = 0;
  let registered = 0;
  let registeredWithEmail = 0;
  return {
    add(company) {
      companies += 1;
      if (company.status !== "R") return;
      registered += 1;
      let hasEmail = false;
      for (const email of company.emails) {
        const hash = contactPairHash(company.code, email);
        if (!hash) continue;
        hashes.add(hash.toString("hex"));
        hasEmail = true;
      }
      if (hasEmail) registeredWithEmail += 1;
    },
    result() {
      return { companies, registered, registeredWithEmail, hashes };
    }
  };
}

/** Loeb äriregistri faili ridu ja kogub paaride räsid (`registerCompanies`, `contactHashCollector`). */
export async function collectRegisterContactHashes(lines) {
  const collector = contactHashCollector();
  for await (const company of registerCompanies(lines)) collector.add(company);
  return collector.result();
}

/** Räside hulgast sorteeritud puhver, nagu `hashListHas` seda loeb. */
export function hashListFrom(hashes) {
  const sorted = [...hashes].sort();
  const output = Buffer.alloc(sorted.length * CONTACT_HASH_BYTES);
  sorted.forEach((hex, index) => output.write(hex, index * CONTACT_HASH_BYTES, "hex"));
  return output;
}

let cached = null;

async function loadHashList(file = CONTACT_HASH_FILE) {
  if (cached?.file === file) return cached.list;
  const list = await readFile(file);
  if (!list.length || list.length % CONTACT_HASH_BYTES !== 0) {
    throw new Error("BUSINESS_REGISTER_CONTACTS_INVALID");
  }
  cached = { file, list };
  return list;
}

/**
 * Kas e-post on äriregistris selle registrikoodi kontaktina kirjas.
 *
 * Vastus on kolmene, sest „ei tea" ei tohi paista kui „ei ole":
 *   `match`        paar on registris;
 *   `no_match`     kood või aadress ei ole registris selle paarina (või on vigasel kujul);
 *   `unavailable`  kontrollfaili ei saanud lugeda.
 */
export async function checkRegisterContact(registryCode, email, { file = CONTACT_HASH_FILE } = {}) {
  const hash = contactPairHash(registryCode, email);
  if (!hash) return "no_match";
  let list;
  try {
    list = await loadHashList(file);
  } catch {
    return "unavailable";
  }
  return hashListHas(list, hash) ? "match" : "no_match";
}

/** Kontrollfaili päis: millal ja millest see tehti. `null`, kui faili ei ole. */
export async function registerContactsMeta({ file = CONTACT_HASH_META_FILE } = {}) {
  try {
    const meta = JSON.parse(await readFile(file, "utf8"));
    return {
      builtAt: meta?.builtAt || null,
      sourceFile: meta?.sourceFile || null,
      sourceLastModified: meta?.sourceLastModified || null,
      pairs: Number(meta?.pairs) || 0
    };
  } catch {
    return null;
  }
}

/** Ainult testile: unusta mällu loetud fail. */
export function resetRegisterContactsCache() {
  cached = null;
}
