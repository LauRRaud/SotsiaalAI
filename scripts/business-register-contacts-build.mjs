/**
 * Teeb äriregistri avaandmete failist „Üldandmed" kontrollfaili, mille järgi platvorm näeb, kas
 * e-posti aadress on registris ühe registrikoodi kontaktina kirjas (lib/businessRegisterContacts.js).
 *
 * Allikas: https://avaandmed.ariregister.rik.ee → „Üldandmed" →
 * ettevotja_rekvisiidid__yldandmed.json.zip (umbes 230 MB, lahti pakituna 4,6 GB; litsents CC BY 4.0,
 * uueneb kord päevas). Fail laaditakse käsitsi alla ja antakse siia teena: skript ise võrku ei lähe.
 *
 * Käsk tööpuu juurest:
 *   node scripts/business-register-contacts-build.mjs <tee zip-failini> [--source-date 2026-10-10]
 *
 * Väljund: src/server/data/business-register-contact-hashes.bin ja ….meta.json. Aadresse välja ei
 * kirjutata: failis on iga paari (registrikood, e-post) SHA-256 räsi kaheksa esimest baiti.
 *
 * Fail loetakse voona ja rida-realt: register väljastab iga välja omal real. Kui kuju muutub nii,
 * et asutusi või paare tuleb oodatust palju vähem, lõpetab skript veaga ega kirjuta midagi.
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
  collectRegisterContactHashes,
  hashListFrom
} from "../lib/businessRegisterContacts.js";

const MIN_COMPANIES = 300000;
const MIN_PAIRS = 300000;
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

async function* counted(lines) {
  for await (const line of lines) {
    if (line.startsWith('        "ariregistri_kood"')) seen += 1;
    yield line;
  }
}

const { companies, registered, registeredWithEmail: withEmail, hashes } = await collectRegisterContactHashes(
  counted(createInterface({ input: inflate, crlfDelay: Infinity }))
);

if (companies < MIN_COMPANIES || hashes.size < MIN_PAIRS) {
  fail(`liiga vähe andmeid (asutusi ${companies}, paare ${hashes.size}): faili kuju on ilmselt muutunud; midagi ei kirjutatud`);
}

const output = hashListFrom(hashes);

await mkdir(path.dirname(CONTACT_HASH_FILE), { recursive: true });
await writeFile(`${CONTACT_HASH_FILE}.tmp`, output);
await rename(`${CONTACT_HASH_FILE}.tmp`, CONTACT_HASH_FILE);
const meta = {
  sourceFile: entry.name,
  sourceUrl: "https://avaandmed.ariregister.rik.ee/et/avaandmete-allalaadimine",
  sourceLicence: "CC BY 4.0, Registrite ja Infosüsteemide Keskus (äriregister)",
  sourceLastModified: sourceDate || null,
  sourceZipBytes: zipStat.size,
  builtAt: new Date().toISOString().slice(0, 10),
  companies,
  registered,
  registeredWithEmail: withEmail,
  pairs: hashes.size,
  hashBytes: CONTACT_HASH_BYTES,
  sha256: createHash("sha256").update(output).digest("hex")
};
await writeFile(CONTACT_HASH_META_FILE, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
console.log(`[business-register-contacts] asutusi ${companies}, registris ${registered}, e-postiga ${withEmail}, paare ${hashes.size}, fail ${output.length} baiti`);
