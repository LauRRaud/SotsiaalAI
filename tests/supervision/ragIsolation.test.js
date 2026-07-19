import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setupBase, sv, os1, makeActiveProcess } from "./scenario.js";
import { createSummary, submitSummary, approveSummary } from "../../lib/supervision/summaries.js";
import { shareTopic } from "../../lib/supervision/topics.js";

test("test #18: lib/supervision EI impordi ühtki RAG-moodulit (grep-invariant)", () => {
  const root = path.resolve("lib/supervision");
  const files = fs.readdirSync(root).filter((f) => f.endsWith(".js"));
  assert.ok(files.length >= 10, "supervisiooni lib-failid peaks olema olemas");
  for (const file of files) {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    const importLines = src.split("\n").filter((line) => /^\s*import\s/.test(line));
    for (const line of importLines) {
      assert.ok(!/\brag\b|embedding|pipeline|vector/i.test(line), `${file}: RAG-import keelatud → ${line.trim()}`);
    }
  }
});

test("test #18 runtime: supervisiooni voog ei tekita ühtki RAG-tööjärjekorra kirjet", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  await shareTopic({ processId, session: os1(), input: { audience: "PROCESS", title: "T", body: "Tundlik teemakeha" } }, { db });
  const sum = await createSummary({ processId, session: sv(), input: { kind: "FINAL", body: "Tundlik kokkuvõte" } }, { db });
  await submitSummary({ summaryId: sum.summary.id, session: sv(), input: { expectedVersion: sum.summary.version } }, { db });
  await approveSummary({ summaryId: sum.summary.id, session: os1() }, { db });

  // Harness'is puudub igasugune RAG-/embedding-tabel; supervisioon ei kirjuta neisse.
  const ragTables = Object.keys(db.store).filter((t) => /rag|embedding|vector/i.test(t));
  assert.equal(ragTables.length, 0, "harness ei tohiks omada RAG-tabelit (supervisioon ei kasuta RAG-i)");
});
