/**
 * SOL-SCHEMA-01 — migratsioon ja Prisma mudel peavad kandma SAMU kohustuslikke
 * veerge.
 *
 * MIDA SIIN TÕENDATAKSE JA MIKS TA OLEMAS ON. `20260808160000_jta_v1_meeting_note`
 * lõi `CaseWorkMeetingNoteEntry."updatedAt" TIMESTAMP(3) NOT NULL` **ilma
 * vaikeväärtuseta**, aga mudel seda veergu ei kandnud. Prisma ei saada seda, mida
 * mudelis ei ole, seega **iga kirje loomine kukkus päris PostgreSQL-is** koodiga
 * `23502`. Kohtumise märge — kogu E4 ja SOL-CW-15 töö — ei oleks toodangus
 * kirjutanud ühtegi rida.
 *
 * MIKS SEDA EI NÄINUD ÜKSKI ROHELINE VÄRAV:
 *   · `npm test` jookseb fake-Prisma peal, mis ei jõusta `NOT NULL`-i
 *   · `db:migrate:check` rakendab migratsioone, aga ei kirjuta ühtegi rida
 *   · `prisma validate` kontrollib skeemi süntaksit, mitte skeemi-DB vastavust
 *
 * Leidis alles päris andmebaasi vastu käiv sond. See test on tema odav dublikaat,
 * mis jookseb igas sviidis.
 *
 * PIIR ON AUS: test loeb `CREATE TABLE` plokke. Hiljem `ALTER TABLE ADD COLUMN`-iga
 * lisatud veerg jääb talle nähtamatuks ja seda katab endiselt ainult sond.
 * Katvus on `CaseWork*` tabelid — auditi ese.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = new URL("../../", import.meta.url);

function readRepoFile(relative) {
  return readFileSync(fileURLToPath(new URL(relative, repoRoot)), "utf8");
}

/** `model X { … }` plokk skeemist. Sulgude lugemist ei ole vaja — mudelid on tasapinnalised. */
function modelBlock(schema, modelName) {
  const start = schema.indexOf(`model ${modelName} {`);
  if (start === -1) return null;
  const end = schema.indexOf("\n}", start);
  return end === -1 ? null : schema.slice(start, end);
}

/**
 * `CREATE TABLE` ploki veerud, mis on KOHUSTUSLIKUD ja millel EI OLE
 * vaikeväärtust — ainult nemad kukutavad `INSERT`-i, kui mudel neid ei tea.
 */
function requiredColumnsWithoutDefault(createTableBody) {
  const columns = [];
  for (const rawLine of createTableBody.split("\n")) {
    const line = rawLine.trim();
    const match = /^"([A-Za-z0-9_]+)"\s+(.+?),?$/.exec(line);
    if (!match) continue;
    const [, column, rest] = match;
    if (!/\bNOT NULL\b/.test(rest)) continue;
    if (/\bDEFAULT\b/.test(rest)) continue;
    columns.push(column);
  }
  return columns;
}

function caseWorkCreateTables() {
  const migrationsDir = fileURLToPath(new URL("prisma/migrations", repoRoot));
  const tables = new Map();

  for (const entry of readdirSync(migrationsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let sql;
    try {
      sql = readRepoFile(`prisma/migrations/${entry.name}/migration.sql`);
    } catch {
      continue;
    }

    const pattern = /CREATE TABLE "(CaseWork[A-Za-z0-9_]*)" \(([\s\S]*?)\n\);/g;
    let match;
    while ((match = pattern.exec(sql)) !== null) {
      const [, table, body] = match;
      /* Esimene loomine loeb; hilisem `CREATE TABLE IF NOT EXISTS` ei asenda teda. */
      if (!tables.has(table)) tables.set(table, body);
    }
  }

  return tables;
}

test("SOL-SCHEMA-01: iga kohustuslik vaikeväärtuseta veerg on ka Prisma mudelis", () => {
  const schema = readRepoFile("prisma/schema.prisma");
  const tables = caseWorkCreateTables();

  assert.ok(tables.size >= 10, `CaseWork-tabeleid leiti ainult ${tables.size} — parser ei tööta`);

  const missing = [];
  for (const [table, body] of tables) {
    const block = modelBlock(schema, table);
    if (!block) {
      missing.push(`${table}: mudelit ei ole skeemis`);
      continue;
    }

    for (const column of requiredColumnsWithoutDefault(body)) {
      const declared =
        new RegExp(`^\\s*${column}\\s`, "m").test(block) || block.includes(`@map("${column}")`);
      if (!declared) {
        missing.push(`${table}.${column}`);
      }
    }
  }

  assert.deepEqual(
    missing,
    [],
    `Mudelist puuduvad kohustuslikud veerud — nende tabelite INSERT kukub päris andmebaasis 23502-ga: ${missing.join(", ")}`
  );
});

test("SOL-SCHEMA-01: NEGATIIVKONTROLL — parser NÄEB puuduvat veergu", () => {
  /* Ilma selleta tõendaks eelmine test ka siis rohelist, kui parser ei leiaks
     ühtegi veergu ega ühtegi mudelit. */
  const body = [
    '    "id" TEXT NOT NULL,',
    '    "olemasolev" TEXT NOT NULL,',
    '    "puuduv" TIMESTAMP(3) NOT NULL,',
    '    "vaikevaartusega" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '    "vabatahtlik" TEXT'
  ].join("\n");

  const required = requiredColumnsWithoutDefault(body);
  assert.deepEqual(required, ["id", "olemasolev", "puuduv"]);

  const fakeSchema = ["model Naidis {", "  id String @id", "  olemasolev String", "}"].join("\n");
  const block = modelBlock(fakeSchema, "Naidis");
  assert.ok(block, "mudeliploki lugeja ei tööta");
  assert.ok(new RegExp("^\\s*olemasolev\\s", "m").test(block));
  assert.ok(!new RegExp("^\\s*puuduv\\s", "m").test(block), "parser ei märkaks puuduvat veergu");
});

test("SOL-SCHEMA-01: märkme kirje kannab neid kahte veergu, mis leiu tekitasid", () => {
  /* Nimeline test lisaks üldisele: just see rida oli katki ja just tema tagasi
     kadumine oleks vaikne. */
  const schema = readRepoFile("prisma/schema.prisma");
  const block = modelBlock(schema, "CaseWorkMeetingNoteEntry");
  assert.ok(block, "mudelit ei leitud");
  assert.match(block, /^\s*createdAt\s+DateTime\s+@default\(now\(\)\)/m);
  assert.match(block, /^\s*updatedAt\s+DateTime\s+@updatedAt/m);
});
