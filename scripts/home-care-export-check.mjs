#!/usr/bin/env node
/**
 * Koduteenuse täieliku väljavõtte kontroll käsurealt.
 *
 *   node scripts/home-care-export-check.mjs <fail.json>
 *
 * Prindib faili SHA-256 (võrdle asutuse tööloendis oleva kontrollsummaga),
 * koguarvud ja leiud: kas kuju on õige, kas koguarvud klapivad ridadega ja kas
 * iga viide leiab oma rea. Skript ei vaja andmebaasi ega platvormi: asutus või
 * tema uus tarkvarapakkuja saab faili kontrollida oma arvutis.
 *
 * Väljumiskood: 0 = korras, 1 = failis on vigu, 2 = faili ei saa lugeda.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { checkHomeCareExport } from "../lib/homeCare/exportFormat.js";

const path = process.argv[2];
if (!path) {
  console.error("Kasutus: node scripts/home-care-export-check.mjs <fail.json>");
  process.exit(2);
}

let bytes;
try {
  bytes = readFileSync(path);
} catch (error) {
  console.error(`Faili ei saa lugeda: ${error.message}`);
  process.exit(2);
}
/* Kontrollsumma ja suurus enne sisu lugemist: neid saab võrrelda ka siis, kui sisu ei avane. */
console.log(`SHA-256: ${createHash("sha256").update(bytes).digest("hex")}`);
console.log(`Suurus: ${bytes.length} baiti`);

let document;
try {
  document = JSON.parse(bytes.toString("utf8"));
} catch (error) {
  console.error(`Fail ei ole terviklik JSON (poolik või muudetud): ${error.message}`);
  process.exit(2);
}

const result = checkHomeCareExport(document);
console.log(`Väljavõte: ${String(document?.exportId || "")}, koostatud ${String(document?.generatedAt || "")}`);
console.log("Koguarvud:");
for (const [key, count] of Object.entries(result.totals)) console.log(`  ${key}: ${count}`);
for (const note of result.notes) console.log(`Tähelepanek: ${note}`);
for (const problem of result.problems) console.log(`VIGA: ${problem}`);
if (!result.ok) console.log(`Leitud ${result.problems.length} viga.`);
else if (result.notes.length) console.log(`Korras: kuju, koguarvud ja kirjete omavahelised viited klapivad. Tähelepanekuid: ${result.notes.length} (vt ülal).`);
else console.log("Korras: kuju, koguarvud ja viited klapivad.");
process.exit(result.ok ? 0 : 1);
