import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const helperPath = path.join(repoRoot, "scripts", "lib", "kov-admin-sync.mjs");
const kovIngestPath = path.join(repoRoot, "scripts", "ingest-kov-rag.mjs");
const rtIngestPath = path.join(repoRoot, "scripts", "ingest-national-rt-xml.mjs");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("CLI KOV ingest scripts wire admin DB sync helpers", () => {
  const helper = read(helperPath);
  const kovIngest = read(kovIngestPath);
  const rtIngest = read(rtIngestPath);

  assert.match(helper, /export async function syncKovWebCliIngest/);
  assert.match(helper, /export async function syncKovRtCliIngest/);
  assert.match(helper, /municipalityKovAdmin\.upsert/);
  assert.match(helper, /ingestStatus: "INGESTED"/);
  assert.match(helper, /rtIngestStatus: "INGESTED"/);

  assert.match(kovIngest, /syncKovWebCliIngest/);
  assert.match(kovIngest, /admin sync:/);
  assert.match(rtIngest, /syncKovRtCliIngest/);
  assert.match(rtIngest, /\[rt:admin-sync\]/);
});
