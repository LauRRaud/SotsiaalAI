#!/usr/bin/env node
/**
 * SOL-süvaauditi loendur.
 *
 *   npm run sol:tally            → koond + peatükkide tabel
 *   npm run sol:tally -- --open  → lisaks iga lahtise leiu pealkiri
 *
 * `parandusaudit.md` väidab enda kohta, et tema numbrid on RAPORTIST LOETUD, mitte
 * käsitsi kokku pandud. Seni ei olnud seda väidet millegagi katta — käesolev skript
 * on see kate, ja ta loeb täpselt sama reegli järgi, mille fail ise kirja paneb:
 *
 *   - leid  = `### SOL-XXX-NN — … — Pn` pealkiri;
 *   - tehtud = leiu Seis-lõik ALGAB sõnaga `DONE`. Kvalifitseeritud seis
 *     („kood DONE; brauseritest NOT_PROVEN", „mehhanism DONE…") on LAHTINE.
 *
 * Loeb ka jätkufailid (`…-jatk-*.md`). Nemad on peafailist väljas ja just seepärast
 * kadus SOL-MAT peatükk loendist täielikult — 13 leidu, mida tabelis ei olnud.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const AUDIT_DIR = path.join(process.cwd(), "docs", "audits");
const MAIN_FILE = "sotsiaalai-sol-suvaaudit.md";
const HEADING = /^### (SOL-[A-Z]+)-(\d+)\s+—\s+(.+?)\s+—\s+(P\d)/;

function statusOf(lines, from, to) {
  for (let i = from; i < to; i += 1) {
    const bare = lines[i].replace(/\*/g, "");
    const match = bare.match(/^Seis\s*(?:\([^)]*\))?\s*[.:]?\s*(.*)$/);
    if (match) return match[1].trim();
  }
  return "";
}

async function parse(file) {
  const source = await readFile(path.join(AUDIT_DIR, file), "utf8");
  const lines = source.split(/\r?\n/);
  const marks = [];
  lines.forEach((line, index) => {
    const match = line.match(HEADING);
    if (match) marks.push({ index, match });
  });

  return marks.map(({ index, match }, position) => {
    const end = position + 1 < marks.length ? marks[position + 1].index : lines.length;
    const status = statusOf(lines, index + 1, end);
    return {
      file,
      chapter: match[1],
      number: Number(match[2]),
      title: match[3],
      priority: match[4],
      status,
      done: status.startsWith("DONE")
    };
  });
}

const files = (await readdir(AUDIT_DIR))
  .filter((name) => name === MAIN_FILE || /^sotsiaalai-sol-suvaaudit-jatk-.*\.md$/.test(name))
  .sort((a, b) => (a === MAIN_FILE ? -1 : b === MAIN_FILE ? 1 : a.localeCompare(b)));

const findings = (await Promise.all(files.map(parse))).flat();
const main = findings.filter((row) => row.file === MAIN_FILE);
const extra = findings.filter((row) => row.file !== MAIN_FILE);

const done = findings.filter((row) => row.done);
const open = findings.filter((row) => !row.done);
const byPriority = (rows) =>
  ["P0", "P1", "P2", "P3"]
    .map((p) => [p, rows.filter((row) => row.priority === p).length])
    .filter(([, count]) => count > 0)
    .map(([p, count]) => `${count} × ${p}`)
    .join(" · ");

console.log(`Peafail        : ${main.length} leidu (${files[0]})`);
console.log(`Jätkufailid    : ${extra.length} leidu ${files.length - 1} failis`);
console.log(`KOKKU          : ${findings.length}`);
console.log(`Tehtud         : ${done.length}`);
console.log(`Lahtised       : ${open.length} — ${byPriority(open)}`);
console.log("");

const chapters = [...new Set(findings.map((row) => row.chapter))];
// Peatüki koht dokumendis on tema ESIMESE leiu koht. `new Map(pairs)` jätaks alles
// viimase ja SOL-AUTH rändaks peatükkide keskele.
const order = new Map();
main.forEach((row, index) => {
  if (!order.has(row.chapter)) order.set(row.chapter, index);
});
chapters.sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity) || a.localeCompare(b));

console.log("| Peatükk | Tehtud | Lahtised | Märkus |");
console.log("|---|---|---|---|");
for (const chapter of chapters) {
  const rows = findings.filter((row) => row.chapter === chapter);
  const chapterOpen = rows.filter((row) => !row.done);
  const fromExtra = rows.filter((row) => row.file !== MAIN_FILE).length;
  const note = [
    chapterOpen.length === 0 ? "**tehtud**" : "",
    fromExtra ? `${fromExtra} jätkufailist` : ""
  ]
    .filter(Boolean)
    .join(", ");
  console.log(
    `| ${chapter} | ${rows.length - chapterOpen.length}/${rows.length} | ${
      chapterOpen.length ? byPriority(chapterOpen) : "–"
    } | ${note} |`
  );
}

if (process.argv.includes("--open")) {
  console.log("\nLahtised leiud:");
  for (const row of open) {
    const where = row.file === MAIN_FILE ? "" : `  [${row.file.replace(/^sotsiaalai-sol-suvaaudit-/, "")}]`;
    console.log(`  ${row.chapter}-${String(row.number).padStart(2, "0")}  ${row.priority}  ${row.title}${where}`);
  }
}
