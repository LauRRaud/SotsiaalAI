/**
 * Teeb äriregistri avaandmete failist „Üldandmed" kaks kontrollfaili:
 *
 *   1. kontaktid: kas e-posti aadress on registris ühe registrikoodi kontaktina kirjas
 *      (lib/businessRegisterContacts.js);
 *   2. nimed: mis nimi on registris ühe registrikoodi all (lib/businessRegisterNames.js).
 *
 * Mõlemad tehakse ühe lugemisega samast failist, et nad kirjeldaksid registri sama seisu.
 *
 * Allikas: https://avaandmed.ariregister.rik.ee → „Üldandmed" →
 * ettevotja_rekvisiidid__yldandmed.json.zip (umbes 230 MB, lahti pakituna 4,6 GB; litsents CC BY 4.0,
 * uueneb kord päevas). Fail laaditakse käsitsi alla ja antakse siia teena: skript ise võrku ei lähe.
 *
 * Käsk tööpuu juurest:
 *   node scripts/business-register-contacts-build.mjs <tee zip-failini> [--source-date 2026-10-10]
 *
 * Väljund kaustas src/server/data:
 *   business-register-contact-hashes.bin (+ .meta.json)  aadresse välja ei kirjutata: iga paari
 *       (registrikood, e-post) SHA-256 räsi kaheksa esimest baiti;
 *   business-register-names.tsv (+ .meta.json)  registrisse kantud asutuste nimed koodi järgi.
 *       Füüsilisest isikust ettevõtja nime (inimese nimi) välja ei kirjutata, ainult räsi.
 *
 * Fail loetakse voona ja rida-realt: register väljastab iga välja omal real. Kui kuju muutub nii,
 * et asutusi, paare või nimesid tuleb oodatust palju vähem, lõpetab skript veaga ega kirjuta midagi.
 */
import { createReadStream } from "node:fs";
import { mkdir, open, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { createInflateRaw } from "node:zlib";
import { createHash } from "node:crypto";

import {
  CONTACT_HASH_BYTES,
  CONTACT_HASH_FILE,
  CONTACT_HASH_META_FILE,
  contactHashCollector,
  hashListFrom,
  registerCompanies
} from "../lib/businessRegisterContacts.js";
import {
  REGISTER_NAMES_FILE,
  REGISTER_NAMES_META_FILE,
  registerNameCollector,
  registerNamesFileFrom
} from "../lib/businessRegisterNames.js";

const MIN_COMPANIES = 300000;
const MIN_PAIRS = 300000;
/* Nimede kuju kontroll: kui õigusliku vormi väli kaob, läheks iga nimi räsiks (lihtnimesid 0);
   kui füüsilisest isikust ettevõtjaid enam ei tunta, oleks räsisid 0. Kumbki ei ole päris seis. */
const MIN_PLAIN_NAMES = 250000;
const MIN_HASHED_NAMES = 10000;
const ENTRY_NAME = /yldandmed\.json$/u;

function fail(message) {
  console.error(`[business-register-contacts] ${message}`);
  process.exit(1);
}

/** Loeb zip-faili esimese kirje päise ja tagastab, kust tihendatud andmed algavad. */
async function firstEntry(zipPath) {
  const handle = await open(zipPath, "r");
  try {
    const head = Buffer.alloc(30);
    await handle.read(head, 0, 30, 0);
    if (head.readUInt32LE(0) !== 0x04034b50) fail("fail ei alga zip-kirje päisega");
    const method = head.readUInt16LE(8);
    if (method !== 8) fail(`ootamatu tihendusviis ${method}; oodati deflate`);
    const nameLength = head.readUInt16LE(26);
    const extraLength = head.readUInt16LE(28);
    const name = Buffer.alloc(nameLength);
    await handle.read(name, 0, nameLength, 30);
    return { name: name.toString("utf8"), dataStart: 30 + nameLength + extraLength };
  } finally {
    await handle.close();
  }
}

async function writeWhole(file, content) {
  await writeFile(`${file}.tmp`, content);
  await rename(`${file}.tmp`, file);
}

const args = process.argv.slice(2);
const zipPath = args.find((arg) => !arg.startsWith("--"));
if (!zipPath) fail("anna zip-faili tee");
const dateFlag = args.indexOf("--source-date");
const sourceDate = dateFlag >= 0 ? String(args[dateFlag + 1] || "") : "";
if (sourceDate && !/^\d{4}-\d{2}-\d{2}$/u.test(sourceDate)) fail("--source-date kuju on AAAA-KK-PP");

const entry = await firstEntry(zipPath);
if (!ENTRY_NAME.test(entry.name)) fail(`ootamatu fail arhiivis: ${entry.name}`);
const zipStat = await stat(zipPath);

/* Tihendatud voo järel tulevad zip-faili sisukord ja lõpukirje. Lahtipakkija lõpetab voo lõpus
   ise; ülejäänud baidid ei ole viga. */
let seen = 0;
const inflate = createInflateRaw();
const source = createReadStream(zipPath, { start: entry.dataStart });
source.on("error", (error) => fail(`lugemine ebaõnnestus: ${error.message}`));
inflate.on("error", (error) => {
  if (seen < MIN_COMPANIES) fail(`lahtipakkimine ebaõnnestus: ${error.message}`);
});
source.pipe(inflate);

const contacts = contactHashCollector();
const names = registerNameCollector();
for await (const company of registerCompanies(createInterface({ input: inflate, crlfDelay: Infinity }))) {
  seen += 1;
  contacts.add(company);
  names.add(company);
}
const { companies, registered, registeredWithEmail: withEmail, hashes } = contacts.result();
const { entries, plainNames, hashedNames, byLegalForm } = names.result();

if (companies < MIN_COMPANIES || hashes.size < MIN_PAIRS) {
  fail(`liiga vähe andmeid (asutusi ${companies}, paare ${hashes.size}): faili kuju on ilmselt muutunud; midagi ei kirjutatud`);
}
if (plainNames < MIN_PLAIN_NAMES || hashedNames < MIN_HASHED_NAMES) {
  fail(`nimede kuju ei klapi (lihtnimesid ${plainNames}, räsisid ${hashedNames}): õigusliku vormi väli on ilmselt muutunud; midagi ei kirjutatud`);
}

const output = hashListFrom(hashes);
const namesOutput = registerNamesFileFrom(entries);
const sourceMeta = {
  sourceFile: entry.name,
  sourceUrl: "https://avaandmed.ariregister.rik.ee/et/avaandmete-allalaadimine",
  sourceLicence: "CC BY 4.0, Registrite ja Infosüsteemide Keskus (äriregister)",
  sourceLastModified: sourceDate || null,
  sourceZipBytes: zipStat.size,
  builtAt: new Date().toISOString().slice(0, 10)
};

await mkdir(path.dirname(CONTACT_HASH_FILE), { recursive: true });
await writeWhole(CONTACT_HASH_FILE, output);
await writeFile(CONTACT_HASH_META_FILE, `${JSON.stringify({
  ...sourceMeta,
  companies,
  registered,
  registeredWithEmail: withEmail,
  pairs: hashes.size,
  hashBytes: CONTACT_HASH_BYTES,
  sha256: createHash("sha256").update(output).digest("hex")
}, null, 2)}\n`, "utf8");

await writeWhole(REGISTER_NAMES_FILE, namesOutput);
await writeFile(REGISTER_NAMES_META_FILE, `${JSON.stringify({
  ...sourceMeta,
  contents: "Registrisse kantud (staatus R) asutused, üks rida asutuse kohta, järjestatud registrikoodi järgi.",
  lineFormats: {
    N: "kood<TAB>N<TAB>nimi: juriidiline isik või asutus, nimi registri kujul",
    H: "kood<TAB>H<TAB>räsi: füüsilisest isikust ettevõtja või tundmatu õiguslik vorm; nime failis ei ole, real on paari (kood, ühtlustatud nimi) SHA-256 räsi 16 esimest kuueteistkümnendmärki"
  },
  entries: entries.size,
  plainNames,
  hashedNames,
  byLegalForm: Object.fromEntries(Object.entries(byLegalForm).sort(([, left], [, right]) => right - left)),
  bytes: namesOutput.length,
  sha256: createHash("sha256").update(namesOutput).digest("hex")
}, null, 2)}\n`, "utf8");

console.log(`[business-register-contacts] asutusi ${companies}, registris ${registered}, e-postiga ${withEmail}, paare ${hashes.size}, fail ${output.length} baiti`);
console.log(`[business-register-contacts] nimesid ${entries.size} (lihttekstina ${plainNames}, räsina ${hashedNames}), fail ${namesOutput.length} baiti`);
