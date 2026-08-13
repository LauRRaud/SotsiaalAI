import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  AUDIT_DIR,
  BLOCK_END,
  BLOCK_START,
  FINDING_STATE,
  assertCanonicalProgressStates,
  assertUniqueFindingIds,
  classifyFindingStatus,
  collectFindings,
  parseAuditFile,
  renderProgressBlock,
  replaceBlock
} from "../../scripts/sol-audit-tally.mjs";

const FIXTURE = [
  "### SOL-DOC-01 — peafaili leid — P1",
  "",
  "**Seis (11.08.2026): DONE.**",
  "",
  "### SOL-DOC-J-01 — jätkufaili leid — P2",
  "",
  "**Seis.** NOT_DONE; runtime: not_run.",
  "",
  "### SOL-DOC-J-02 — kvalifitseeritud seis ei ole tehtud — P1",
  "",
  "**Seis (11.08.2026): PARTIAL — kood DONE, brauseritest NOT_PROVEN.**",
  "",
  "### SOL-DOC-J-03 — selgelt osaline leid — P2",
  "",
  "**Seis (11.08.2026): PARTIAL — teenus DONE, runtime not_run.**",
  "",
  "### SOL-DOC-J-04 — Seis-lõiguta leid — P1",
  ""
].join("\n");

test("jätkufaili `-J` leid loetakse sama peatüki alla, aga tema ID jääb terveks", () => {
  const rows = parseAuditFile("fixture.md", FIXTURE);

  assert.deepEqual(
    rows.map((row) => [row.id, row.chapter, row.priority, row.state, row.done]),
    [
      ["SOL-DOC-01", "SOL-DOC", "P1", FINDING_STATE.DONE, true],
      ["SOL-DOC-J-01", "SOL-DOC", "P2", FINDING_STATE.NOT_DONE, false],
      ["SOL-DOC-J-02", "SOL-DOC", "P1", FINDING_STATE.PARTIAL, false],
      ["SOL-DOC-J-03", "SOL-DOC", "P2", FINDING_STATE.PARTIAL, false],
      ["SOL-DOC-J-04", "SOL-DOC", "P1", FINDING_STATE.NOT_DONE, false]
    ]
  );
});

test("kolmeastmeline seis ei aja NOT_DONE sõnaosa DONE-ga segamini", () => {
  assert.equal(classifyFindingStatus("DONE — valmis."), FINDING_STATE.DONE);
  assert.equal(classifyFindingStatus("PARTIAL — kood olemas."), FINDING_STATE.PARTIAL);
  assert.equal(classifyFindingStatus("done — vale väiketäht."), FINDING_STATE.NOT_DONE);
  assert.equal(classifyFindingStatus("kood DONE; brauseritest NOT_PROVEN."), FINDING_STATE.NOT_DONE);
  assert.equal(classifyFindingStatus("EI OLE DONE."), FINDING_STATE.NOT_DONE);
  assert.equal(classifyFindingStatus("NOT_DONE; runtime: not_run."), FINDING_STATE.NOT_DONE);
  assert.equal(classifyFindingStatus("BLOCKED_DECISION — omaniku otsus puudub."), FINDING_STATE.NOT_DONE);
  assert.equal(classifyFindingStatus(""), FINDING_STATE.NOT_DONE);
});

test("kvalifitseeritud DONE vale algusega katkestab progressi, mitte ei kao NOT_DONE sisse", () => {
  const [ambiguous] = parseAuditFile(
    "fixture.md",
    ["### SOL-DOC-01 — ebaselge seis — P1", "", "**Seis.** kood DONE; runtime not_run."].join("\n")
  );
  assert.throws(() => assertCanonicalProgressStates([ambiguous]), /SOL-DOC-01.*kood DONE/s);

  const [canonical] = parseAuditFile(
    "fixture.md",
    ["### SOL-DOC-01 — selge seis — P1", "", "**Seis.** PARTIAL — kood DONE; runtime not_run."].join("\n")
  );
  assert.doesNotThrow(() => assertCanonicalProgressStates([canonical]));
});

test("dubleeritud leiu-ID katkestab loenduse, mitte ei kasvata nimetajat", () => {
  const [finding] = parseAuditFile(
    "esimene.md",
    ["### SOL-DOC-01 — esimene — P1", "", "**Seis.** NOT_DONE."].join("\n")
  );
  assert.throws(
    () => assertUniqueFindingIds([finding, { ...finding, file: "teine.md" }]),
    /SOL-DOC-01.*esimene\.md.*teine\.md/s
  );
  assert.doesNotThrow(() => assertUniqueFindingIds([finding]));
});

test("kattekontroll VISKAB tundmatu ID-vormingu peale, mitte ei jäta teda vaikselt loendusest välja", () => {
  const unknown = ["### SOL-DOC-K2-01 — tundmatu nimeruum — P1", "", "**Seis.** NOT_DONE.", ""].join("\n");

  // Ilma kattekontrollita annaks see 0 leidu ja väiksema nimetaja — täpselt nii kadus
  // `SOL-DOC-J-01…-06` (6 leidu) ja enne teda kogu SOL-MAT peatükk.
  assert.throws(() => parseAuditFile("fixture.md", unknown), /fixture\.md:1.*SOL-DOC-K2-01/su);

  // Negatiivkontroll kattekontrolli enda peale: sama pealkiri lubatud kujul läbib.
  const accepted = parseAuditFile("fixture.md", unknown.replace("SOL-DOC-K2-01", "SOL-DOC-J-01"));
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].id, "SOL-DOC-J-01");
});

test("genereeritud plokk eristab DONE, PARTIAL ja NOT_DONE ning kannab Seis-lõiku SÕNA-SÕNALT", () => {
  const block = renderProgressBlock(parseAuditFile("fixture.md", FIXTURE));

  assert.match(block, /`SOL-DOC-01` P1 — peafaili leid — DONE\./);
  assert.match(
    block,
    /`SOL-DOC-J-02` P1 — kvalifitseeritud seis ei ole tehtud — PARTIAL — kood DONE, brauseritest NOT_PROVEN\./
  );
  assert.match(block, /`SOL-DOC-J-03` P2 — selgelt osaline leid — PARTIAL — teenus DONE, runtime not_run\./);
  assert.equal(block.includes("`SOL-DOC-J-01`"), false, "NOT_DONE leide ei dubleerita pikas loendis");
  assert.equal(block.includes("`SOL-DOC-J-04`"), false, "Seis-lõiguta leide ei dubleerita pikas loendis");
  assert.match(block, /DONE \*\*1\*\* \/ 5/);
  assert.match(block, /PARTIAL \*\*2\*\* \/ 5/);
  assert.match(block, /NOT_DONE \*\*2\*\* \/ 5/);
  /* Ümberjutustus on see, mis vanas käsitsi jutustuses maha jäi — plokk tsiteerib. */
  assert.match(block, /DONE\./);
});

test("plokk ASENDATAKSE, ja markerite puudumine viskab, mitte ei lisa vaikselt teist ploki", () => {
  const findings = parseAuditFile("fixture.md", FIXTURE);
  const page = `# Pealkiri\n\n${BLOCK_START}\nVANA SISU\n${BLOCK_END}\n\n## Jutustus\n`;

  const once = replaceBlock(page, renderProgressBlock(findings));
  assert.equal(once.includes("VANA SISU"), false, "vana plokk peab kaduma");
  assert.match(once, /## Jutustus/, "ploki taga olev tekst peab alles jääma");

  /* Idempotentne: teine jooks ei kasvata faili ega tekita teist ploki. */
  const twice = replaceBlock(once, renderProgressBlock(findings));
  assert.equal(twice, once);
  assert.equal(twice.split(BLOCK_START).length - 1, 1);

  /* NEGATIIVKONTROLL: markeriteta faili peale VISKAB. Vaikne lisamine faili lõppu
     tähendaks kahte „Mis on tehtud" ploki, millest VANEM oleks eespool ja teda
     loetaks esimesena — täpselt see viga, mille see plokk kaotama peab. */
  assert.throws(
    () => replaceBlock("# Pealkiri\n\nilma markeriteta\n", renderProgressBlock(findings)),
    /markereid ei leitud/
  );
});

test("päris parandusaudit.md sisaldab markereid ja tema plokk on värske", async () => {
  const { findings } = await collectFindings();
  const source = await readFile(path.join(AUDIT_DIR, "parandusaudit.md"), "utf8");
  const normalizeEol = (value) => value.replace(/\r\n/g, "\n");

  assert.ok(source.includes(BLOCK_START) && source.includes(BLOCK_END), "markerid peavad failis olema");
  /* Kui see kukub, on plokk vananenud — jooksuta `npm run sol:tally -- --write`.
     Just see kontroll teeb ta lagunemise NÄHTAVAKS: vana käsitsi jutustus lagunes
     üheksa peatüki võrra ja ükski test ei öelnud selle kohta midagi. */
  assert.equal(
    normalizeEol(replaceBlock(source, renderProgressBlock(findings))),
    normalizeEol(source),
    "parandusaudit.md kolmeastmeline plokk ei ole värske — jooksuta: npm run sol:progress -- --write"
  );
});

test("package.json pakub eraldi kolmeastmelist progressikäsku", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(pkg.scripts?.["sol:progress"], "node scripts/sol-audit-tally.mjs --progress");
});

test("päris auditikorpus sisaldab kõik 429 unikaalset leidu", async () => {
  const { files, findings } = await collectFindings();

  assert.deepEqual(files, [
    "sotsiaalai-sol-suvaaudit.md",
    "sotsiaalai-sol-suvaaudit-jatk-dokumendid.md",
    "sotsiaalai-sol-suvaaudit-jatk-funktsioonideulene-lopetus.md",
    "sotsiaalai-sol-suvaaudit-jatk-koosta-dokument.md",
    "sotsiaalai-sol-suvaaudit-jatk-materjalid.md",
    "sotsiaalai-sol-suvaaudit-jatk-minu-jagamised-lopetus.md",
    "sotsiaalai-sol-suvaaudit-jatk-minu-jagamised.md",
    "sotsiaalai-sol-suvaaudit-jatk-organisatsioonid-lopetus.md",
    "sotsiaalai-sol-suvaaudit-jatk-organisatsioonid.md",
    "sotsiaalai-sol-suvaaudit-jatk-teenusekaart-lopetus.md",
    "sotsiaalai-sol-suvaaudit-jatk-teenusekaart.md",
    "sotsiaalai-sol-suvaaudit-jatk-teenuspaevik.md",
    "sotsiaalai-sol-suvaaudit-jatk-tooheaolu.md",
    "sotsiaalai-sol-suvaaudit-jatk-valitoo.md"
  ]);
  assert.equal(findings.length, 429, `oodatud täpselt 429 leidu, loeti ${findings.length}`);
  assert.equal(new Set(findings.map((row) => row.id)).size, 429, "kõik leiu-ID-d peavad olema unikaalsed");

  const importedIdsByFile = {
    "sotsiaalai-sol-suvaaudit-jatk-valitoo.md": Array.from(
      { length: 11 },
      (_, index) => `SOL-FIELD-J-${String(index + 1).padStart(2, "0")}`
    ),
    "sotsiaalai-sol-suvaaudit-jatk-teenuspaevik.md": Array.from(
      { length: 7 },
      (_, index) => `SOL-SLOG-J-${String(index + 1).padStart(2, "0")}`
    ),
    "sotsiaalai-sol-suvaaudit-jatk-organisatsioonid-lopetus.md": ["SOL-ORG-18", "SOL-ORG-19"],
    "sotsiaalai-sol-suvaaudit-jatk-minu-jagamised-lopetus.md": ["SOL-SHARE-06", "SOL-SHARE-07"],
    "sotsiaalai-sol-suvaaudit-jatk-teenusekaart-lopetus.md": ["SOL-SMAP-09"],
    "sotsiaalai-sol-suvaaudit-jatk-funktsioonideulene-lopetus.md": [
      "SOL-XFUNC-01",
      "SOL-XFUNC-02",
      "SOL-XFUNC-03"
    ]
  };
  for (const [file, expectedIds] of Object.entries(importedIdsByFile)) {
    assert.deepEqual(
      findings
        .filter((row) => row.file === file)
        .map((row) => row.id)
        .sort(),
      [...expectedIds].sort(),
      `${file} peab sisaldama täpselt imporditud leiu-ID-sid`
    );
  }

  const docJ = findings.filter((row) => row.id.startsWith("SOL-DOC-J-"));
  assert.equal(docJ.length, 6);
  assert.ok(
    docJ.every((row) => row.chapter === "SOL-DOC"),
    "dokumentide jätk kuulub SOL-DOC peatüki alla"
  );
});
