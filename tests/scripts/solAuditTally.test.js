import assert from "node:assert/strict";
import test from "node:test";

import { collectFindings, parseAuditFile } from "../../scripts/sol-audit-tally.mjs";

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
  "**Seis (11.08.2026): kood DONE, brauseritest NOT_PROVEN.**",
  ""
].join("\n");

test("jätkufaili `-J` leid loetakse sama peatüki alla, aga tema ID jääb terveks", () => {
  const rows = parseAuditFile("fixture.md", FIXTURE);

  assert.deepEqual(
    rows.map((row) => [row.id, row.chapter, row.priority, row.done]),
    [
      ["SOL-DOC-01", "SOL-DOC", "P1", true],
      ["SOL-DOC-J-01", "SOL-DOC", "P2", false],
      ["SOL-DOC-J-02", "SOL-DOC", "P1", false]
    ]
  );
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

test("päris auditifailides ei jää ühtegi leiu pealkirja loendusest välja", async () => {
  const { files, findings } = await collectFindings();

  assert.ok(files.length >= 8, "peafail + jätkufailid peavad olema leitud");
  assert.ok(findings.length >= 403, `oodatud vähemalt 403 leidu, loeti ${findings.length}`);

  const docJ = findings.filter((row) => row.id.startsWith("SOL-DOC-J-"));
  assert.equal(docJ.length, 6);
  assert.ok(
    docJ.every((row) => row.chapter === "SOL-DOC"),
    "dokumentide jätk kuulub SOL-DOC peatüki alla"
  );
});
