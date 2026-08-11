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
 *
 * **Loenduri enda veaklass on vaikimine.** Tundmatu ID-vorming ei anna viga, vaid
 * väiksema nimetaja: nii kadus 11.08 kogu `SOL-DOC-J-01…-06` plokk (6 leidu), sest
 * range muster ei tundnud kolmeosalist koodi. Seetõttu on siin KAKS mustrit ja
 * `assertEveryHeadingParsed()` nõuab, et nad annaksid sama hulga — loendur kukub
 * nimeliselt enne, kui ta jõuab vale numbri välja trükkida.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const AUDIT_DIR = path.join("docs", "audits");
export const MAIN_FILE = "sotsiaalai-sol-suvaaudit.md";

/**
 * `-J` on jätkufaili leiu nimeruum (`SOL-DOC-J-01`) ja ta EI ole omaette peatükk:
 * dokumentide jätk katab sama pinda mis `SOL-DOC`, nii nagu `SOL-ORG-13…-17` katab
 * sama pinda mis `SOL-ORG`. Peatükk tuleb esimesest rühmast, leiu terve ID jääb alles
 * eraldi väljal — ilma selleta annaks `--open` kahele eri leiule sama nime.
 */
const HEADING = /^### (SOL-[A-Z]+)(-J)?-(\d+)\s+—\s+(.+?)\s+—\s+(P\d)/;
const LOOSE_HEADING = /^### (SOL-\S+)/;

function assertEveryHeadingParsed(file, lines, marks) {
  const parsed = new Set(marks.map(({ index }) => index));
  const missed = [];
  lines.forEach((line, index) => {
    if (LOOSE_HEADING.test(line) && !parsed.has(index)) missed.push({ index, line });
  });
  if (missed.length === 0) return;
  const detail = missed.map(({ index, line }) => `  ${file}:${index + 1}  ${line.trim()}`).join("\n");
  throw new Error(
    `sol:tally — ${missed.length} leiu pealkirja ei vasta mustrile ja jääks loendusest VÄLJA:\n${detail}\n` +
      "Oodatud kuju: `### SOL-XXX-NN — pealkiri — Pn` (jätkufailis lubatud ka `SOL-XXX-J-NN`)."
  );
}

function statusOf(lines, from, to) {
  for (let i = from; i < to; i += 1) {
    const bare = lines[i].replace(/\*/g, "");
    const match = bare.match(/^Seis\s*(?:\([^)]*\))?\s*[.:]?\s*(.*)$/);
    if (match) return match[1].trim();
  }
  return "";
}

export function parseAuditFile(file, source) {
  const lines = source.split(/\r?\n/);
  const marks = [];
  lines.forEach((line, index) => {
    const match = line.match(HEADING);
    if (match) marks.push({ index, match });
  });
  assertEveryHeadingParsed(file, lines, marks);

  return marks.map(({ index, match }, position) => {
    const end = position + 1 < marks.length ? marks[position + 1].index : lines.length;
    const status = statusOf(lines, index + 1, end);
    const chapter = match[1];
    const number = Number(match[3]);
    return {
      file,
      chapter,
      number,
      id: `${chapter}${match[2] ?? ""}-${String(number).padStart(2, "0")}`,
      title: match[4],
      priority: match[5],
      status,
      done: status.startsWith("DONE")
    };
  });
}

export async function collectFindings(auditDir = AUDIT_DIR) {
  const files = (await readdir(auditDir))
    .filter((name) => name === MAIN_FILE || /^sotsiaalai-sol-suvaaudit-jatk-.*\.md$/.test(name))
    .sort((a, b) => (a === MAIN_FILE ? -1 : b === MAIN_FILE ? 1 : a.localeCompare(b)));

  const parsed = await Promise.all(
    files.map(async (file) => parseAuditFile(file, await readFile(path.join(auditDir, file), "utf8")))
  );
  return { files, findings: parsed.flat() };
}

const byPriority = (rows) =>
  ["P0", "P1", "P2", "P3"]
    .map((p) => [p, rows.filter((row) => row.priority === p).length])
    .filter(([, count]) => count > 0)
    .map(([p, count]) => `${count} × ${p}`)
    .join(" · ");

export function chapterRows(findings) {
  const main = findings.filter((row) => row.file === MAIN_FILE);
  const chapters = [...new Set(findings.map((row) => row.chapter))];
  // Peatüki koht dokumendis on tema ESIMESE leiu koht. `new Map(pairs)` jätaks alles
  // viimase ja SOL-AUTH rändaks peatükkide keskele.
  const order = new Map();
  main.forEach((row, index) => {
    if (!order.has(row.chapter)) order.set(row.chapter, index);
  });
  chapters.sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity) || a.localeCompare(b));

  return chapters.map((chapter) => {
    const rows = findings.filter((row) => row.chapter === chapter);
    const open = rows.filter((row) => !row.done);
    const fromExtra = rows.filter((row) => row.file !== MAIN_FILE).length;
    return {
      chapter,
      total: rows.length,
      done: rows.length - open.length,
      open: open.length ? byPriority(open) : "–",
      note: [open.length === 0 ? "**tehtud**" : "", fromExtra ? `${fromExtra} jätkufailist` : ""]
        .filter(Boolean)
        .join(", ")
    };
  });
}

export async function main(argv = process.argv.slice(2)) {
  const { files, findings } = await collectFindings();
  const main_ = findings.filter((row) => row.file === MAIN_FILE);
  const extra = findings.filter((row) => row.file !== MAIN_FILE);
  const done = findings.filter((row) => row.done);
  const open = findings.filter((row) => !row.done);

  console.log(`Peafail        : ${main_.length} leidu (${files[0]})`);
  console.log(`Jätkufailid    : ${extra.length} leidu ${files.length - 1} failis`);
  console.log(`KOKKU          : ${findings.length}`);
  console.log(`Tehtud         : ${done.length}`);
  console.log(`Lahtised       : ${open.length} — ${byPriority(open)}`);
  console.log("");

  console.log("| Peatükk | Tehtud | Lahtised | Märkus |");
  console.log("|---|---|---|---|");
  for (const row of chapterRows(findings)) {
    console.log(`| ${row.chapter} | ${row.done}/${row.total} | ${row.open} | ${row.note} |`);
  }

  if (argv.includes("--open")) {
    console.log("\nLahtised leiud:");
    for (const row of open) {
      const where = row.file === MAIN_FILE ? "" : `  [${row.file.replace(/^sotsiaalai-sol-suvaaudit-/, "")}]`;
      console.log(`  ${row.id}  ${row.priority}  ${row.title}${where}`);
    }
  }
}

// `new URL(process.argv[1], "file:")` ei kõlba siin: Windowsi tee `C:\…` annab temaga
// vale href'i ja main-värav jääks vaikselt kinni — skript lõpetaks väljundita.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
