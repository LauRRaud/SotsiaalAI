#!/usr/bin/env node
// `npm test`: kõik `tests/*.test.mjs` failid, mis ei vaja kohalikku andmebaasi ega
// EstNLTK-d. CI ja auto-merge'i värav jooksutab just seda komplekti.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Nimelt `.test.mjs`, aga vajavad väliseid ressursse (M4_TEST_DATABASE_URL või
// RAG_V2_ESTNLTK_PYTHON). Käivita neid käsitsi kohalikus keskkonnas.
const NEEDS_LOCAL_RESOURCES = new Set([
  "rag-v2-dialogue-store.test.mjs",
  "rag-v2-pilot-store.test.mjs",
  "rag-v2-record-scope.test.mjs"
]);

const testsDir = path.resolve("tests");
const files = fs
  .readdirSync(testsDir)
  .filter(name => name.endsWith(".test.mjs"))
  .filter(name => !name.endsWith(".integration.test.mjs"))
  .filter(name => !NEEDS_LOCAL_RESOURCES.has(name))
  .sort()
  .map(name => path.join("tests", name));

if (files.length === 0) {
  console.error("[test] No unit test files found");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "./scripts/register-node-source-loader.mjs", "--test", ...files],
  { stdio: "inherit", env: { ...process.env, TZ: "UTC" } }
);

if (result.error) {
  console.error(`[test] ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
