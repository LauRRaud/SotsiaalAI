#!/usr/bin/env node
/**
 * SOL-süvaauditi loendur.
 *
 *   npm run sol:tally             → koond + peatükkide tabel
 *   npm run sol:tally -- --open   → lisaks iga lahtise leiu pealkiri
 *   npm run sol:tally -- --write  → kirjutab tagasiühilduvalt kolmeastmelise ploki
 *                                   `parandusaudit.md`-sse markerite vahele
 *   npm run sol:progress          → eristab DONE / PARTIAL / NOT_DONE
 *   npm run sol:progress -- --write → kirjutab kolmeastmelise ploki
 *
 * `parandusaudit.md` väidab enda kohta, et tema numbrid on RAPORTIST LOETUD, mitte
 * käsitsi kokku pandud. Seni ei olnud seda väidet millegagi katta — käesolev skript
 * on see kate, ja ta loeb täpselt sama reegli järgi, mille fail ise kirja paneb:
 *
 *   - leid  = `### SOL-XXX-NN — … — Pn` pealkiri;
 *   - tehtud = leiu Seis-lõik ALGAB sõnaga `DONE`; `PARTIAL` on ametlikult LAHTINE.
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

import { readdir, readFile, writeFile } from "node:fs/promises";
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

export const FINDING_STATE = Object.freeze({
  DONE: "DONE",
  PARTIAL: "PARTIAL",
  NOT_DONE: "NOT_DONE"
});

/**
 * Ametlik DONE-reegel ei muutu: ainult sõnaga DONE algav Seis sulgeb leiu.
 * PARTIAL peab samuti olema Seis-lõigu alguses selgelt kirjas. Nii ei saa vabatekst
 * nagu „EI OLE DONE" või väiketähega `done` edenemiseks muutuda. Tühi ja otsuse taha
 * blokitud Seis on NOT_DONE.
 */
export function classifyFindingStatus(status = "") {
  const value = String(status).trim();
  if (/^DONE\b/.test(value)) return FINDING_STATE.DONE;
  if (/^PARTIAL\b/.test(value)) return FINDING_STATE.PARTIAL;
  return FINDING_STATE.NOT_DONE;
}

export function assertCanonicalProgressStates(findings) {
  const ambiguous = findings.filter(
    (row) => row.state === FINDING_STATE.NOT_DONE && row.status && /\bDONE\b/.test(row.status)
  );
  if (ambiguous.length === 0) return;
  const detail = ambiguous.map((row) => `  ${row.id}: ${row.status}`).join("\n");
  throw new Error(
    "sol:progress — kvalifitseeritud DONE peab algama sõnaga PARTIAL; muidu ei ole seis üheselt loetav:\n" + detail
  );
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
    const state = classifyFindingStatus(status);
    return {
      file,
      chapter,
      number,
      id: `${chapter}${match[2] ?? ""}-${String(number).padStart(2, "0")}`,
      title: match[4],
      priority: match[5],
      status,
      state,
      done: state === FINDING_STATE.DONE,
      partial: state === FINDING_STATE.PARTIAL
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
    const done = rows.filter((row) => row.state === FINDING_STATE.DONE);
    const partial = rows.filter((row) => row.state === FINDING_STATE.PARTIAL);
    const notDone = rows.filter((row) => row.state === FINDING_STATE.NOT_DONE);
    const open = [...partial, ...notDone];
    const fromExtra = rows.filter((row) => row.file !== MAIN_FILE).length;
    return {
      chapter,
      total: rows.length,
      done: done.length,
      partial: partial.length,
      notDone: notDone.length,
      open: open.length ? byPriority(open) : "–",
      note: [open.length === 0 ? "**tehtud**" : "", fromExtra ? `${fromExtra} jätkufailist` : ""]
        .filter(Boolean)
        .join(", ")
    };
  });
}

/* „Mis on tehtud" oli `parandusaudit.md`-s KÄSITSI kirjutatud jutustus ja ta jäi
   üheksa peatüki võrra maha (lõppes SOL-CHAT-08 juures) — fail ise tunnistas seda
   ja nimetas järelejõudmise „eraldi tööks", mida keegi kunagi ette ei võtnud.
   Sama veaklass mis numbritel, ainult aeglasem: käsitsi hoitav tuletis lahkneb.
   Nüüd tuleb ta samast allikast mis numbrid — leiu enda Seis-lõigust. */
/* Peatüki eestikeelne nimi ei ole leiu pealkirjast tuletatav ja ta on ainus asi
   siin failis, mida hoitakse käsitsi. Ta on ka ohutu: ükski ARV temast ei sõltu
   ja puuduv nimi langeb tagasi koodile, mitte tühjusele. */
export const CHAPTER_NAMES = Object.freeze({
  "SOL-SCHEMA": "Skeemi ja Prisma mudeli vastavus",
  "SOL-BUILD": "Build",
  "SOL-AUTH": "Autentimine ja autoriseerimine",
  "SOL-CW": "Juhtumitöö (JTA-V1)",
  "SOL-RAGADMIN": "RAG-i admin ja failihaldus",
  "SOL-ORG": "Organisatsioonid ja skoop",
  "SOL-FIELD": "Välitöö",
  "SOL-DOC": "Dokumendid ja AI-kasutus",
  "SOL-RES": "Uuringud",
  "SOL-MEET": "Koosolekukokkuvõtted",
  "SOL-CHAT": "Vestlus",
  "SOL-VOICE": "Hääl (STT/TTS)",
  "SOL-ROOM": "Ruumid",
  "SOL-CALL": "Kõned ja salvestus",
  "SOL-INV": "Kutsed ja sponsorlus",
  "SOL-PAY": "Maksed",
  "SOL-NOTIF": "Teavitused",
  "SOL-EVENT": "Domeenisündmused",
  "SOL-URG": "Kiireloomuline abi",
  "SOL-WB": "Tööheaolu",
  "SOL-SLOG": "Teenuspäevik",
  "SOL-RAGSVC": "RAG-teenus ja ingest",
  "SOL-PRISMA": "Migratsioonid",
  "SOL-MENT": "Mentorlus",
  "SOL-SUP": "Supervisioon",
  "SOL-COV": "Kovisioon",
  "SOL-PRAC": "Tõenduspõhised praktikad",
  "SOL-SEED": "Teemaseemned",
  "SOL-JOUR": "Teekond ja jagamine",
  "SOL-PRE": "Eelpöördumised",
  "SOL-HELP": "Abikuulutused",
  "SOL-NET": "Võrgustikutöö",
  "SOL-REF": "Refleksioonid",
  "SOL-SEARCH": "Otsing",
  "SOL-SPROF": "Teenuseosutaja profiil",
  "SOL-COMP": "Dokumendi koostamine",
  "SOL-MAT": "Materjalid",
  "SOL-SHARE": "Minu jagamised",
  "SOL-SMAP": "Teenusekaart"
});

export const BLOCK_START = "<!-- sol:tally algus — GENEREERITUD, ÄRA TOIMETA KÄSITSI -->";
export const BLOCK_END = "<!-- sol:tally lõpp -->";

export function progressCounts(findings) {
  return {
    done: findings.filter((row) => row.state === FINDING_STATE.DONE).length,
    partial: findings.filter((row) => row.state === FINDING_STATE.PARTIAL).length,
    notDone: findings.filter((row) => row.state === FINDING_STATE.NOT_DONE).length
  };
}

export function renderProgressBlock(findings) {
  assertCanonicalProgressStates(findings);
  const done = findings.filter((row) => row.state === FINDING_STATE.DONE);
  const partial = findings.filter((row) => row.state === FINDING_STATE.PARTIAL);
  const notDone = findings.filter((row) => row.state === FINDING_STATE.NOT_DONE);
  const open = [...partial, ...notDone];
  const rows = chapterRows(findings);
  const lines = [];

  lines.push(BLOCK_START);
  lines.push("");
  lines.push("## Paranduste seis: DONE / PARTIAL / NOT_DONE");
  lines.push("");
  lines.push(
    "**See plokk on genereeritud** (`npm run sol:progress -- --write`) raporti enda Seis-lõikudest.",
    "Käsitsi siia ei kirjutata. DONE algab sõnaga `DONE`, PARTIAL sõnaga `PARTIAL` ja kõik muu",
    "on NOT_DONE. Kvalifitseeritud DONE-väide vale algusega katkestab genereerimise, et ta ei",
    "kaoks vaikselt valesse rühma. Iga loetletud leiu lõpus on Seis-lõik **sõna-sõnalt**."
  );
  lines.push("");
  lines.push(
    `DONE **${done.length}** / ${findings.length} · PARTIAL **${partial.length}** / ${findings.length} · ` +
      `NOT_DONE **${notDone.length}** / ${findings.length} · peatükke täielikult DONE ` +
      `**${rows.filter((row) => row.done === row.total).length}** / ${rows.length} · ` +
      `ametlikult lahtiseid ${open.length} — ${byPriority(open)}`
  );
  lines.push("");
  lines.push("| Peatükk | Kood | DONE | PARTIAL | NOT_DONE | Lahtiste prioriteedid | Märkus |");
  lines.push("|---|---|---:|---:|---:|---|---|");
  for (const row of rows) {
    const name = CHAPTER_NAMES[row.chapter] || row.chapter;
    lines.push(
      `| ${name} | ${row.chapter} | ${row.done}/${row.total} | ${row.partial} | ${row.notDone} | ` +
        `${row.open} | ${row.note} |`
    );
  }
  lines.push("");
  lines.push("### PARTIAL leiud peatükkide kaupa");
  lines.push("");

  for (const row of rows) {
    const chapterPartial = partial.filter((item) => item.chapter === row.chapter);
    if (chapterPartial.length === 0) continue;
    lines.push(`**${CHAPTER_NAMES[row.chapter] || row.chapter}** (\`${row.chapter}\`, ${chapterPartial.length} PARTIAL)`);
    lines.push("");
    for (const item of chapterPartial) {
      lines.push(`- \`${item.id}\` ${item.priority} — ${item.title} — ${item.status}`);
    }
    lines.push("");
  }

  lines.push("### DONE leiud peatükkide kaupa");
  lines.push("");

  for (const row of rows) {
    const chapterDone = done.filter((item) => item.chapter === row.chapter);
    if (chapterDone.length === 0) continue;
    lines.push(`**${CHAPTER_NAMES[row.chapter] || row.chapter}** (\`${row.chapter}\`, ${row.done}/${row.total})`);
    lines.push("");
    for (const item of chapterDone) {
      lines.push(`- \`${item.id}\` ${item.priority} — ${item.title} — ${item.status}`);
    }
    lines.push("");
  }

  lines.push(BLOCK_END);
  return lines.join("\n");
}

// Tagasiühilduv ekspordinimi olemasolevatele kasutajatele; sisu on nüüd kolmeastmeline.
export const renderDoneBlock = renderProgressBlock;

/* Asendus, mitte lisamine: puuduv marker VISKAB. Vaikne lisamine faili lõppu
   tähendaks kahte „Paranduste seis" plokki, millest vanem oleks eespool ja teda
   loetaks esimesena — täpselt see viga, mille see plokk kaotama peaks. */
export function replaceBlock(source, block) {
  const start = source.indexOf(BLOCK_START);
  const end = source.indexOf(BLOCK_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `sol:tally --write — markereid ei leitud. Fail peab sisaldama ridu:\n  ${BLOCK_START}\n  ${BLOCK_END}`
    );
  }
  return source.slice(0, start) + block + source.slice(end + BLOCK_END.length);
}

export async function main(argv = process.argv.slice(2)) {
  const { files, findings } = await collectFindings();
  const main_ = findings.filter((row) => row.file === MAIN_FILE);
  const extra = findings.filter((row) => row.file !== MAIN_FILE);
  const done = findings.filter((row) => row.done);
  const open = findings.filter((row) => !row.done);
  const partial = findings.filter((row) => row.state === FINDING_STATE.PARTIAL);
  const notDone = findings.filter((row) => row.state === FINDING_STATE.NOT_DONE);
  const progress = argv.includes("--progress");

  if (progress || argv.includes("--write")) assertCanonicalProgressStates(findings);

  console.log(`Peafail        : ${main_.length} leidu (${files[0]})`);
  console.log(`Jätkufailid    : ${extra.length} leidu ${files.length - 1} failis`);
  console.log(`KOKKU          : ${findings.length}`);
  if (progress) {
    console.log(`DONE           : ${done.length}`);
    console.log(`PARTIAL        : ${partial.length}`);
    console.log(`NOT_DONE       : ${notDone.length}`);
    console.log(`Ametlikult lahti: ${open.length} — ${byPriority(open)}`);
  } else {
    console.log(`Tehtud         : ${done.length}`);
    console.log(`Lahtised       : ${open.length} — ${byPriority(open)}`);
  }
  console.log("");

  if (progress) {
    console.log("| Peatükk | DONE | PARTIAL | NOT_DONE | Lahtiste prioriteedid | Märkus |");
    console.log("|---|---:|---:|---:|---|---|");
    for (const row of chapterRows(findings)) {
      console.log(
        `| ${row.chapter} | ${row.done}/${row.total} | ${row.partial} | ${row.notDone} | ${row.open} | ${row.note} |`
      );
    }
  } else {
    console.log("| Peatükk | Tehtud | Lahtised | Märkus |");
    console.log("|---|---|---|---|");
    for (const row of chapterRows(findings)) {
      console.log(`| ${row.chapter} | ${row.done}/${row.total} | ${row.open} | ${row.note} |`);
    }
  }

  if (argv.includes("--write")) {
    const target = path.join(AUDIT_DIR, "parandusaudit.md");
    const source = await readFile(target, "utf8");
    const next = replaceBlock(source, renderProgressBlock(findings));
    if (next === source) {
      console.log(`\n[sol:tally --write] ${target} oli juba värske.`);
    } else {
      await writeFile(target, next);
      console.log(
        `\n[sol:tally --write] ${target} uuendatud — ` +
          `${done.length} DONE · ${partial.length} PARTIAL · ${notDone.length} NOT_DONE.`
      );
    }
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
