import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [{ resolveRunStatusFromTurn, resolveRunStatus }] = await Promise.all([
  import("../../lib/chat/turnStatus.js")
]);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

/**
 * SOL-CHAT-06 — voo lõpp on edu AINULT valideeritud `done` sündmuse järel.
 *
 * Klient märkis varem iga reader-EOF-i `COMPLETED`-iks: võrgu, proxy või serveri katkestus andis
 * poolelijäänud vastuse „lõpliku edukana", ilma Retry-nuputa. Kuna kinnitus käib `/api/chat/run`
 * pealt, mõõdetakse siin mõlemat poolt: marsruudi tõde ja kliendi lepingut.
 */

test("pöörde oma rida on tõde, sõnumitest tuletamine on varuvariant", () => {
  const now = Date.parse("2026-08-11T12:00:00Z");
  assert.equal(resolveRunStatusFromTurn({ status: "COMPLETED" }, { nowMs: now }), "COMPLETED");
  assert.equal(resolveRunStatusFromTurn({ status: "ABORTED" }, { nowMs: now }), "ABORTED");
  assert.equal(resolveRunStatusFromTurn({ status: "ERROR" }, { nowMs: now }), "ERROR");

  // Värske südamelöök = päriselt töös.
  assert.equal(
    resolveRunStatusFromTurn({ status: "RUNNING", updatedAt: new Date(now - 10_000) }, { nowMs: now }),
    "RUNNING"
  );
  // Rippuma jäänud pööre ei ole „veel töös" — muidu ei saaks teda kunagi korrata.
  assert.equal(
    resolveRunStatusFromTurn({ status: "RUNNING", updatedAt: new Date(now - 3_600_000) }, { nowMs: now }),
    "ERROR"
  );
  // Rida puudub (enne migratsiooni loodud vestlus) → tuletus jääb alles.
  assert.equal(resolveRunStatusFromTurn(null), null);
  assert.equal(resolveRunStatus({ latestTurnRole: "ASSISTANT", metadata: { completionStatus: "ERROR" } }), "ERROR");
});

test("`/api/chat/run` eelistab pöörde rida ja langeb tuletusele ainult tema puudumisel", () => {
  const source = read("app/api/chat/run/route.js");
  assert.match(source, /prisma\.chatTurn\.findFirst\(/);
  assert.match(source, /resolveRunStatusFromTurn\(latestTurn[\s\S]*?\?\?\s*resolveRunStatus\(/);
  // Pöördeid loetakse ainult päringu tegija omi.
  assert.match(source, /chatTurn\.findFirst\(\{\s*where: \{ conversationId: convId, userId: auth\.userId \}/);
});

test("klient ei märgi EOF-i eduks ilma serveri kinnituseta", () => {
  const source = read("components/chat/hooks/useChatStream.js");

  // `streamCompleted` tõeseks ainult `done` sündmusel …
  assert.match(source, /ev\.event === "done"\) \{\s*\n\s*streamCompleted = true;/);
  // … ja EOF-i järel küsitakse serverilt, mitte ei eeldata.
  assert.match(source, /if \(!streamCompleted\) \{[\s\S]*?readPersistedConversationResult\(/);
  assert.match(source, /if \(!confirmed\) \{[\s\S]*?chat\.error\.stream_incomplete/);

  /* VOO raja COMPLETED märgend tohib jääda ainult kinnitatud raja taha. Teine COMPLETED (enne
     väravat) on JSON-vastuse rada, kus server vastas 200-ga ja voogu ei olnudki — seal on kinnitus
     juba olemas. Seepärast mõõdetakse VIIMAST esinemist, mitte esimest. */
  const eofGate = source.indexOf("if (!streamCompleted) {");
  const streamCompletedMark = source.lastIndexOf('completionStatus: "COMPLETED"');
  assert.ok(eofGate > 0, "EOF-värav peab olemas olema");
  assert.ok(streamCompletedMark > eofGate, "kinnitus peab olema ENNE voo COMPLETED märkimist");
});
