import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  buildInventory,
  fetchRagDocuments,
  InventoryError,
  loadRagDump,
  loadRegistry,
  STATE_SCHEMA_VERSION,
  validateStatePayload,
  writeInventoryStateAtomic
} from "../../scripts/lib/master-sources-inventory.mjs";

const REGISTRY_PATH = path.resolve("Andmebaasi/Admebaasi-materjali-lisa/master_sources_final.json");
const FIXTURE_PATH = path.resolve("tests/fixtures/rag-master-inventory-dump.json");
const CLI_PATH = path.resolve("scripts/inventory-master-sources.mjs");
const NOW = new Date("2026-07-15T12:00:00.000Z");

async function buildFixtureInventory() {
  const registry = await loadRegistry(REGISTRY_PATH);
  const rag = await loadRagDump(FIXTURE_PATH, { registrySha256: registry.sha256 });
  return buildInventory({
    registryRecords: registry.records,
    registrySha256: registry.sha256,
    documents: rag.documents,
    input: rag.input,
    now: NOW
  });
}

async function temporaryDirectory() {
  return fs.mkdtemp(path.join(os.tmpdir(), "rag-p8-inventory-"));
}

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, RAG_SERVICE_API_KEY: "SENTINEL_ENV_SECRET_MUST_NOT_LEAK" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
}

test("fixture inventory assigns conservative K7/P8.0 states and never claims covered_ok", async () => {
  const state = await buildFixtureInventory();
  assert.equal(state.state_schema_version, STATE_SCHEMA_VERSION);
  assert.equal(state.registry_entry_count, 323);
  assert.equal(state.summary.rag_documents, 8);
  assert.equal(state.summary.proven_ready, 0);
  assert.equal(state.status_counts.covered_ok, 0);

  assert.equal(
    state.sources.eesti_puuetega_inimeste_koda_eesti_puuetega_inimeste_koda_epikoda.match_status,
    "covered_by_other_pipeline"
  );
  assert.equal(
    state.sources.eesti_puuetega_inimeste_koda_epikoja_liikmed.match_status,
    "needs_adoption"
  );
  assert.equal(state.sources.registrid_riha_mtr_kirje.match_status, "incomplete");
  assert.equal(state.sources.oiguskantsler_lapse_oigused.match_status, "needs_content_check");
  assert.equal(
    state.sources.tervisekassa_vaevuste_leevendamine_palliatiivses_ravis.match_status,
    "stale_match"
  );
  assert.equal(
    state.sources.tarkvanem_tooleht_abikusimused_vestluseks_teismelisega.match_status,
    "redirected"
  );
  assert.equal(
    state.sources["1_katusorganisatsioonid_ja_kojad_tallinna_koja_liikmesuhingud"].match_status,
    "duplicate_content"
  );
  assert.equal(state.status_counts.missing, 316);
  assert.equal(Object.values(state.status_counts).reduce((sum, value) => sum + value, 0), 323);
  assert.equal(JSON.stringify(state).includes("SENTINEL_DOCUMENT_TEXT_MUST_NOT_LEAK"), false);
  assert.equal(JSON.stringify(state).includes("SENTINEL_SECRET_MUST_NOT_LEAK"), false);
  assert.equal(validateStatePayload(state, { expectedRegistrySha256: state.registry_sha256 }), true);
});

test("empty, malformed and registry-incompatible dumps fail closed", async () => {
  const directory = await temporaryDirectory();
  const registry = await loadRegistry(REGISTRY_PATH);
  const empty = path.join(directory, "empty.json");
  const malformed = path.join(directory, "malformed.json");
  const mismatch = path.join(directory, "mismatch.json");
  const duplicate = path.join(directory, "duplicate.json");
  await fs.writeFile(empty, JSON.stringify({ documents: [] }));
  await fs.writeFile(malformed, "{not json");
  await fs.writeFile(mismatch, JSON.stringify({
    registry_sha256: "0".repeat(64),
    documents: [{ id: "doc-1", url: "https://example.ee", chunks: 1 }]
  }));
  await fs.writeFile(duplicate, JSON.stringify({
    documents: [
      { id: "doc-1", url: "https://example.ee/a", chunks: 1 },
      { id: "doc-1", url: "https://example.ee/b", chunks: 1 }
    ]
  }));

  await assert.rejects(loadRagDump(empty, { registrySha256: registry.sha256 }), error => error instanceof InventoryError && error.code === "rag_dump_empty");
  await assert.rejects(loadRagDump(malformed, { registrySha256: registry.sha256 }), error => error instanceof InventoryError && error.code === "rag_dump_invalid_json");
  await assert.rejects(loadRagDump(mismatch, { registrySha256: registry.sha256 }), error => error instanceof InventoryError && error.code === "rag_dump_registry_hash_mismatch");
  await assert.rejects(loadRagDump(duplicate, { registrySha256: registry.sha256 }), error => error instanceof InventoryError && error.code === "rag_dump_duplicate_document_id");
});

test("read-only live loader performs only GET /documents and does not expose its API key", async () => {
  const calls = [];
  const result = await fetchRagDocuments({
    baseUrl: "http://127.0.0.1:8000",
    apiKey: "SENTINEL_LIVE_API_KEY",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), method: options.method, headerPresent: Boolean(options.headers["X-API-Key"]) });
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: "doc-live-1", title: "Live", url: "https://example.ee", chunks: 1 }]
      };
    }
  });
  assert.deepEqual(calls.map(call => call.method), ["GET"]);
  assert.ok(calls[0].url.includes("/documents?"));
  assert.equal(calls[0].headerPresent, true);
  assert.equal(JSON.stringify(result).includes("SENTINEL_LIVE_API_KEY"), false);
  assert.equal(result.input.type, "rag_service_read_only");
});

test("corrupt existing state is not overwritten", async () => {
  const directory = await temporaryDirectory();
  const statePath = path.join(directory, "master_sources.state.json");
  const corrupt = "{broken state";
  await fs.writeFile(statePath, corrupt);
  const state = await buildFixtureInventory();
  await assert.rejects(writeInventoryStateAtomic(statePath, state), error => error instanceof InventoryError && error.code === "existing_state_corrupt");
  assert.equal(await fs.readFile(statePath, "utf8"), corrupt);
});

test("CLI fails closed before creating reports when the existing state is corrupt", async () => {
  const directory = await temporaryDirectory();
  const statePath = path.join(directory, "master_sources.state.json");
  const reportDir = path.join(directory, "reports");
  const corrupt = "{broken state";
  await fs.writeFile(statePath, corrupt);
  const result = await runCli([
    "--rag-dump", FIXTURE_PATH,
    "--state", statePath,
    "--report-dir", reportDir,
    "--now", NOW.toISOString(),
    "--json"
  ]);
  assert.equal(result.code, 3);
  assert.equal(JSON.parse(result.stderr).error.code, "existing_state_corrupt");
  assert.equal(await fs.readFile(statePath, "utf8"), corrupt);
  await assert.rejects(fs.access(reportDir), error => error?.code === "ENOENT");
});

test("registry hash mismatch prevents replacing an otherwise valid state", async () => {
  const directory = await temporaryDirectory();
  const statePath = path.join(directory, "master_sources.state.json");
  const state = await buildFixtureInventory();
  const oldState = structuredClone(state);
  oldState.registry_sha256 = "f".repeat(64);
  await fs.writeFile(statePath, `${JSON.stringify(oldState, null, 2)}\n`);
  await assert.rejects(writeInventoryStateAtomic(statePath, state), error => error instanceof InventoryError && error.code === "state_registry_hash_mismatch");
  assert.equal(JSON.parse(await fs.readFile(statePath, "utf8")).registry_sha256, "f".repeat(64));
});

test("state validation rejects internally inconsistent status counts", async () => {
  const state = await buildFixtureInventory();
  const corrupted = structuredClone(state);
  corrupted.status_counts.missing -= 1;
  corrupted.status_counts.covered_ok += 1;
  corrupted.summary.missing -= 1;
  corrupted.summary.proven_ready += 1;
  assert.throws(
    () => validateStatePayload(corrupted, { expectedRegistrySha256: state.registry_sha256 }),
    error => error instanceof InventoryError && error.code === "state_status_count_mismatch"
  );
});

test("atomic write failure leaves the previous complete state byte-for-byte intact", async () => {
  const directory = await temporaryDirectory();
  const statePath = path.join(directory, "master_sources.state.json");
  const state = await buildFixtureInventory();
  await writeInventoryStateAtomic(statePath, state);
  const before = await fs.readFile(statePath);
  const next = structuredClone(state);
  next.updated_at = "2026-07-15T13:00:00.000Z";
  await assert.rejects(
    writeInventoryStateAtomic(statePath, next, {
      beforeRename: async () => {
        const error = new Error("simulated rename failure");
        error.code = "SIMULATED";
        throw error;
      }
    }),
    error => error instanceof InventoryError && error.code === "state_atomic_write_failed"
  );
  assert.deepEqual(await fs.readFile(statePath), before);
  assert.deepEqual((await fs.readdir(directory)).sort(), ["master_sources.state.json"]);
});

test("--json output is valid, secret-free and contains no document text", async () => {
  const directory = await temporaryDirectory();
  const statePath = path.join(directory, "master_sources.state.json");
  const reportDir = path.join(directory, "reports");
  const result = await runCli([
    "--rag-dump", FIXTURE_PATH,
    "--state", statePath,
    "--report-dir", reportDir,
    "--now", NOW.toISOString(),
    "--json"
  ]);
  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.read_only, true);
  assert.equal(output.summary.proven_ready, 0);
  const combined = `${result.stdout}\n${result.stderr}\n${await fs.readFile(statePath, "utf8")}`;
  assert.equal(combined.includes("SENTINEL_DOCUMENT_TEXT_MUST_NOT_LEAK"), false);
  assert.equal(combined.includes("SENTINEL_SECRET_MUST_NOT_LEAK"), false);
  assert.equal(combined.includes("SENTINEL_ENV_SECRET_MUST_NOT_LEAK"), false);

  const reportFiles = await fs.readdir(reportDir);
  assert.equal(reportFiles.filter(file => file.endsWith(".json")).length, 1);
  assert.equal(reportFiles.filter(file => file.endsWith(".md")).length, 1);
  const reportJson = await fs.readFile(path.join(reportDir, reportFiles.find(file => file.endsWith(".json"))), "utf8");
  assert.equal(reportJson.includes("SENTINEL_DOCUMENT_TEXT_MUST_NOT_LEAK"), false);
  assert.equal(reportJson.includes("SENTINEL_SECRET_MUST_NOT_LEAK"), false);
});
