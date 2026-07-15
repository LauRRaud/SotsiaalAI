import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  ALLOWED_EVENTS,
  buildBaselineReport,
  loadLiveTelemetry,
  PRIVACY_NOTICE,
  renderReportMarkdown,
  validateClassificationWorkbook,
  validateFixturePayload,
  validatePrivacySafeOutputValue,
  validateReportOutput,
  validateReportShape,
  writeReportPairAtomic
} from "../../scripts/lib/rag-quality-baseline.mjs";
import { parseArgs, runBaseline } from "../../scripts/rag-quality-baseline.mjs";

const FIXTURE_PATH = path.resolve("tests/fixtures/rag-quality-baseline-events.json");
const WORKBOOK_PATH = path.resolve("docs/platvormi arendus/rag-qm-p0-classification-workbook.json");
const SCHEMA_PATH = path.resolve("docs/platvormi arendus/rag-qm-p0-baseline-report.schema.json");
const CLI_PATH = path.resolve("scripts/rag-quality-baseline.mjs");
const INTERVAL = {
  from: new Date("2026-07-01T00:00:00.000Z"),
  to: new Date("2026-07-03T00:00:00.000Z")
};
const GENERATED_AT = new Date("2026-07-15T12:00:00.000Z");

async function fixturePayload() {
  return JSON.parse(await fs.readFile(FIXTURE_PATH, "utf8"));
}

async function fixtureReport() {
  const telemetry = validateFixturePayload(await fixturePayload(), INTERVAL);
  return buildBaselineReport({
    ...telemetry,
    interval: INTERVAL,
    generatedAt: GENERATED_AT,
    sourceKind: "sanitized_fixture"
  });
}

function distribution(report, name) {
  return report.metrics.distributions.find(item => item.dimension === name);
}

function countMetric(report, name) {
  return report.metrics.counts.find(item => item.metric === name);
}

function numericMetric(report, name) {
  return report.metrics.numeric_summaries.find(item => item.metric === name);
}

async function temporaryDirectory(prefix = "rag-qm-p0-") {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function runCli(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
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

test("only the four Appendix A events are accepted", async () => {
  assert.deepEqual(ALLOWED_EVENTS, ["rag_trace", "rag_search", "chat_no_external_sources", "crisis_detected"]);
  const fixture = await fixturePayload();
  fixture.groups[0].event = "chat_request";
  assert.throws(
    () => validateFixturePayload(fixture, INTERVAL),
    error => error?.code === "fixture_event"
  );
});

test("live database projection never selects conversation content or forbidden trace text", async () => {
  const queries = [];
  const prisma = {
    async $queryRaw(strings) {
      const sql = strings.join("?");
      queries.push(sql);
      return sql.includes("COUNT(DISTINCT") ? [{ uniqueUserCount: 25 }] : [];
    }
  };
  await loadLiveTelemetry(prisma, INTERVAL);
  assert.equal(queries.length, 2);
  const sql = queries.join("\n");
  assert.equal(/ConversationMessage|\bcontent\b|planner_reason|topics|source_ids/i.test(sql), false);
  assert.match(sql, /FROM "ChatLog"/);
  assert.match(sql, /COUNT\(DISTINCT "userId"\)/);
});

test("database path consists only of bounded SELECT statements", async () => {
  const queries = [];
  const prisma = {
    async $queryRaw(strings) {
      const sql = strings.join("?");
      queries.push(sql);
      return sql.includes("COUNT(DISTINCT") ? [{ uniqueUserCount: 20 }] : [];
    }
  };
  await loadLiveTelemetry(prisma, INTERVAL);
  for (const sql of queries) {
    assert.match(sql.trim(), /^SELECT/i);
    assert.equal(/\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|ALTER|DROP)\b/i.test(sql), false);
    assert.match(sql, /"createdAt" >=/);
    assert.match(sql, /"createdAt" </);
  }
});

test("source aggregates use explicit counters and fixture has no source-ID arrays", async () => {
  const fixtureText = await fs.readFile(FIXTURE_PATH, "utf8");
  assert.equal(/source_ids?|retrieved_source_ids|displayed_source_ids/i.test(fixtureText), false);
  const report = await fixtureReport();
  assert.equal(numericMetric(report, "retrieved_count").total, 199);
});

test("groups below 20 are suppressed without an exact count", async () => {
  const report = await fixtureReport();
  const rare = distribution(report, "trace_planner_modes").groups.find(group => group.value === "rare_mode");
  assert.equal(rare.measurement.status, "suppressed");
  assert.equal(rare.measurement.count, null);
  assert.equal(rare.measurement.minimum_group_size, 20);
});

test("a group of exactly 20 is reported", async () => {
  const report = await fixtureReport();
  const exact = distribution(report, "trace_planner_modes").groups.find(group => group.value === "overview_synthesis");
  assert.equal(exact.measurement.status, "reported");
  assert.equal(exact.measurement.count, 20);
});

test("report contains no identifier-valued keys", async () => {
  const report = await fixtureReport();
  const keys = [];
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      keys.push(key);
      visit(entry);
    }
  };
  visit(report);
  assert.equal(keys.some(key => /^(?:user_?id|conv(?:ersation)?_?id|message_?id|email|name)$/i.test(key)), false);
});

test("privacy validator rejects email-shaped values", () => {
  assert.throws(
    () => validatePrivacySafeOutputValue({ safe: "person@example.test" }),
    error => error?.code === "privacy_email_value"
  );
});

test("privacy validator rejects 11-digit values", () => {
  assert.throws(
    () => validatePrivacySafeOutputValue({ safe: "37605030299" }),
    error => error?.code === "privacy_personal_code_value"
  );
});

test("privacy validator rejects private agent identifiers", () => {
  assert.throws(
    () => validatePrivacySafeOutputValue({ safe: "agent::private-doc" }),
    error => error?.code === "privacy_agent_id_value"
  );
});

test("privacy validator rejects long free text", () => {
  assert.throws(
    () => validatePrivacySafeOutputValue({ safe: "x".repeat(31) }),
    error => error?.code === "privacy_long_text_value"
  );
});

test("privacy validator rejects query, answer, topics and planner reason fields", () => {
  for (const key of ["query", "answer", "topics", "planner_reason", "content", "message"]) {
    assert.throws(
      () => validatePrivacySafeOutputValue({ [key]: "blocked" }),
      error => error?.code === "privacy_forbidden_key"
    );
  }
});

test("privacy validator rejects identifier keys and source-ID lists", () => {
  for (const key of ["userId", "conversationId", "messageId", "email", "source_ids", "retrieved_source_ids"]) {
    assert.throws(
      () => validatePrivacySafeOutputValue({ [key]: [] }),
      error => error?.code === "privacy_forbidden_key"
    );
  }
});

test("privacy failure happens before output directory or partial reports are created", async () => {
  const outputDir = path.join(await temporaryDirectory(), "not-created");
  await assert.rejects(
    writeReportPairAtomic(outputDir, { invalid: "person@example.test" }),
    error => error?.code === "report_schema"
  );
  await assert.rejects(fs.access(outputDir), error => error?.code === "ENOENT");
});

test("atomic pair writer rolls back the first report if the second rename fails", async () => {
  const outputDir = await temporaryDirectory();
  const report = await fixtureReport();
  let renameCalls = 0;
  const failingFs = new Proxy(fs, {
    get(target, property) {
      if (property === "rename") {
        return async (...args) => {
          renameCalls += 1;
          if (renameCalls === 2) throw new Error("synthetic rename failure");
          return target.rename(...args);
        };
      }
      return target[property];
    }
  });
  await assert.rejects(
    writeReportPairAtomic(outputDir, report, { fsImpl: failingFs }),
    error => error?.code === "output_write_failed"
  );
  assert.deepEqual(await fs.readdir(outputDir), []);
});

test("JSON and Markdown contain the same validated report object", async () => {
  const outputDir = await temporaryDirectory();
  const report = await fixtureReport();
  const outputs = await writeReportPairAtomic(outputDir, report);
  const json = JSON.parse(await fs.readFile(outputs.jsonPath, "utf8"));
  const markdown = await fs.readFile(outputs.markdownPath, "utf8");
  const embedded = markdown.match(/```json\n([\s\S]+?)\n```/);
  assert.ok(embedded);
  assert.deepEqual(JSON.parse(embedded[1]), json);
  assert.equal(json.integrity.data_sha256, report.integrity.data_sha256);
});

test("committed expected reports are deterministic fixture output", async () => {
  const report = await fixtureReport();
  const expectedJson = await fs.readFile(path.resolve("tests/fixtures/expected/rag-quality-baseline-2026-07-15.json"), "utf8");
  const expectedMarkdown = await fs.readFile(path.resolve("tests/fixtures/expected/rag-quality-baseline-2026-07-15.md"), "utf8");
  assert.equal(expectedJson, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(expectedMarkdown, renderReportMarkdown(report));
});

test("fixture is explicitly synthetic and contains no real-person or production-text fields", async () => {
  const fixture = await fixturePayload();
  const raw = JSON.stringify(fixture);
  assert.equal(fixture.synthetic, true);
  assert.equal(/\b(?:user_?id|email|name|conversation|message_id|query|answer|content|text)\b/i.test(raw), false);
  assert.equal(/agent::|\b\d{11}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(raw), false);
});

test("classification workbook uses random sample IDs unrelated to users or conversations", async () => {
  const workbook = JSON.parse(await fs.readFile(WORKBOOK_PATH, "utf8"));
  assert.equal(validateClassificationWorkbook(workbook), true);
  assert.equal(new Set(workbook.rows.map(row => row.sample_id)).size, workbook.rows.length);
  assert.equal(workbook.rows.some(row => /user|conv|message/i.test(row.sample_id)), false);
});

test("classification workbook has only Appendix A.5 row fields and allowed synthetic references", async () => {
  const workbook = JSON.parse(await fs.readFile(WORKBOOK_PATH, "utf8"));
  const expectedKeys = [
    "answer_outcome", "bucket", "confidence", "displayed_count", "evidence_ref", "language",
    "note", "planner_mode", "query_kind", "role", "sample_id", "selected_count"
  ];
  for (const row of workbook.rows) assert.deepEqual(Object.keys(row).sort(), expectedKeys);
  assert.equal(workbook.rows.filter(row => row.query_kind.startsWith("golden:")).length, 37);
  assert.equal(workbook.rows.filter(row => row.query_kind.startsWith("catalog:")).length, 35);
  assert.equal(workbook.rows.some(row => Object.hasOwn(row, "query") || Object.hasOwn(row, "content") || Object.hasOwn(row, "answer")), false);
  assert.equal(workbook.rows.every(row => row.note === "not_run"), true);
});

test("required privacy sentence is exact in reports and workbook", async () => {
  const report = await fixtureReport();
  const workbook = JSON.parse(await fs.readFile(WORKBOOK_PATH, "utf8"));
  assert.equal(report.privacy_notice, PRIVACY_NOTICE);
  assert.equal(workbook.privacy_notice, PRIVACY_NOTICE);
});

test("missing measurements remain unavailable or null and are never invented as zero", () => {
  const report = buildBaselineReport({
    rows: [],
    uniqueUserCount: 0,
    interval: INTERVAL,
    generatedAt: GENERATED_AT,
    sourceKind: "chatlog_read_only"
  });
  const retrieved = numericMetric(report, "retrieved_count");
  assert.equal(retrieved.status, "unavailable");
  assert.equal(retrieved.records.count, null);
  assert.equal(retrieved.total, null);
  assert.equal(retrieved.average, null);
  assert.equal(report.classification.bucket_distribution, null);
});

test("missing, malformed and reversed intervals fail closed", async () => {
  const outputDir = await temporaryDirectory();
  for (const args of [
    parseArgs(["--to", INTERVAL.to.toISOString(), "--output-dir", outputDir]),
    parseArgs(["--from", "not-a-time", "--to", INTERVAL.to.toISOString(), "--output-dir", outputDir]),
    parseArgs(["--from", INTERVAL.to.toISOString(), "--to", INTERVAL.from.toISOString(), "--output-dir", outputDir])
  ]) {
    await assert.rejects(runBaseline(args), error => error?.exitCode === 2);
  }
  assert.deepEqual(await fs.readdir(outputDir), []);
});

test("CLI JSON mode uses stable exit codes and never echoes environment secrets", async () => {
  const outputDir = await temporaryDirectory();
  const secret = "SENTINEL_DATABASE_SECRET_MUST_NOT_LEAK";
  const success = await runCli([
    "--from", INTERVAL.from.toISOString(),
    "--to", INTERVAL.to.toISOString(),
    "--fixture", FIXTURE_PATH,
    "--output-dir", outputDir,
    "--now", GENERATED_AT.toISOString(),
    "--json"
  ], { DATABASE_URL: secret });
  assert.equal(success.code, 0);
  assert.equal(`${success.stdout}${success.stderr}`.includes(secret), false);
  assert.equal(validateReportOutput(JSON.parse(success.stdout)), true);

  const failure = await runCli(["--from", INTERVAL.from.toISOString(), "--json"], { DATABASE_URL: secret });
  assert.equal(failure.code, 2);
  assert.equal(`${failure.stdout}${failure.stderr}`.includes(secret), false);
  assert.equal(JSON.parse(failure.stderr).error.code, "missing_interval");
});

test("published JSON schema top-level contract matches real output", async () => {
  const schema = JSON.parse(await fs.readFile(SCHEMA_PATH, "utf8"));
  const report = await fixtureReport();
  assert.equal(validateReportShape(report), true);
  assert.deepEqual([...schema.required].sort(), Object.keys(report).sort());
  assert.equal(schema.properties.schema_version.const, report.schema_version);
  assert.equal(schema.properties.privacy_notice.const, report.privacy_notice);
  assert.ok(schema.properties.source.enum.includes(report.source));
});

test("crisis signal is present only as a k-safe aggregate", async () => {
  const report = await fixtureReport();
  const crisis = countMetric(report, "crisis_detected_events");
  assert.equal(crisis.measurement.status, "reported");
  assert.equal(crisis.measurement.count, 20);
  assert.equal(JSON.stringify(report).includes("crisis_detected"), true);
  assert.equal(Object.keys(report).some(key => /user/i.test(key)), false);
});

test("CLI and library have no ingest, patch, delete, fetch, or runtime mutation path", async () => {
  const source = [
    await fs.readFile(CLI_PATH, "utf8"),
    await fs.readFile(path.resolve("scripts/lib/rag-quality-baseline.mjs"), "utf8")
  ].join("\n");
  assert.equal(/\bfetch\s*\(|\/ingest\b|\/documents\/.+patch|\bprisma\.[A-Za-z]+\.(?:create|update|delete|upsert)\s*\(/i.test(source), false);
  assert.equal(/\$executeRaw|\$executeRawUnsafe|\$queryRawUnsafe/i.test(source), false);
});

test("report integrity detects any post-validation data change", async () => {
  const report = await fixtureReport();
  const changed = structuredClone(report);
  changed.classification.status = "complete";
  assert.throws(
    () => validateReportShape(changed),
    error => error?.code === "report_schema"
  );
  const { integrity, ...core } = changed;
  changed.integrity = { data_sha256: crypto.createHash("sha256").update(JSON.stringify(core)).digest("hex") };
  assert.equal(validateReportShape(changed), true);
  assert.notEqual(changed.integrity.data_sha256, integrity.data_sha256);
});
