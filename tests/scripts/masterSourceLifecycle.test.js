import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createMasterSourceLifecycleService } from "../../lib/rag/masterSourceLifecycle.js";
import { createMasterSourceRagClient } from "../../lib/rag/masterSourceRagClient.js";
import { contentHashForHtmlOrTopic } from "../../scripts/lib/master-source-html-adapter.mjs";
import { createMasterSourceRuntimeStateStore, createMasterSourceRuntimeState, readMasterSourceRuntimeState, writeMasterSourceRuntimeStateCas, MasterSourceStateConflictError } from "../../scripts/lib/master-source-runtime-state.mjs";

async function temporaryDirectory() {
  return fs.mkdtemp(path.join(os.tmpdir(), "rag-master-lifecycle-"));
}

function createFakeDb() {
  const jobs = [];
  let next = 1;
  const matches = (job, where = {}) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && Array.isArray(value.in)) return value.in.includes(job[key]);
    return job[key] === value;
  });
  const dataDeletionJob = {
    async findFirst({ where }) { return jobs.find(job => matches(job, where)) || null; },
    async create({ data }) { const job = { id: `job-${next++}`, ...data }; jobs.push(job); return job; },
    async update({ where, data }) {
      const job = jobs.find(item => item.id === where.id);
      if (!job) throw new Error("job_not_found");
      Object.assign(job, data);
      return job;
    }
  };
  return {
    jobs,
    dataDeletionJob,
    async $transaction(run) {
      return run({ dataDeletionJob, $executeRaw: async () => 1 });
    }
  };
}

async function fixtureRagService() {
  const docs = new Map();
  let rejectIngest = false;
  let rejectDelete = false;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://fixture.local");
    const docId = decodeURIComponent(url.pathname.split("/")[2] || "");
    const body = await new Promise(resolve => {
      let text = "";
      request.setEncoding("utf8");
      request.on("data", chunk => { text += chunk; });
      request.on("end", () => resolve(text));
    });
    if (request.method === "POST" && url.pathname === "/ingest/text") {
      if (rejectIngest) { response.writeHead(503).end("unavailable"); return; }
      const payload = JSON.parse(body);
      docs.set(payload.doc_id, { text: payload.text, metadata: payload.metadata, chunks: payload.text ? 1 : 0 });
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
      return;
    }
    if (request.method === "GET" && url.pathname.endsWith("/chunks")) {
      const doc = docs.get(docId);
      response.writeHead(doc ? 200 : 404, { "content-type": "application/json" }).end(JSON.stringify({ count: doc?.chunks || 0 }));
      return;
    }
    if (request.method === "POST" && url.pathname.endsWith("/patch-meta")) {
      const doc = docs.get(docId);
      if (!doc) { response.writeHead(404).end(); return; }
      Object.assign(doc.metadata, JSON.parse(body).metadata);
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
      return;
    }
    if (request.method === "DELETE" && url.pathname.startsWith("/documents/")) {
      if (rejectDelete) { response.writeHead(503).end("unavailable"); return; }
      docs.delete(docId);
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  return {
    docs,
    setRejectIngest(value) { rejectIngest = value; },
    setRejectDelete(value) { rejectDelete = value; },
    baseUrl: `http://127.0.0.1:${port}`,
    async close() { await new Promise(resolve => server.close(resolve)); }
  };
}

const record = {
  source_id: "fixture-guide",
  title: "Fixture guide",
  url: "https://fixtures.example/guide",
  normalized_url: "https://fixtures.example/guide",
  source_type: "information_material",
  recommended_pipeline: "html_or_topic_pipeline",
  ingest_status: "ingest_candidate",
  collection_hint: "national_guidelines",
  language: "et",
  audience: "BOTH"
};

test("approved fixture candidate moves v1 to v2, suppresses v1 and drains its deletion job", async t => {
  const directory = await temporaryDirectory();
  const fixture = await fixtureRagService();
  t.after(async () => { await fixture.close(); await fs.rm(directory, { recursive: true, force: true }); });
  const stateStore = createMasterSourceRuntimeStateStore(path.join(directory, "runtime.json"), "registry-fixture");
  const db = createFakeDb();
  const rag = createMasterSourceRagClient({ baseUrl: fixture.baseUrl });
  let sourceHtml = "<main>Version one guidance</main>";
  const service = createMasterSourceLifecycleService({
    stateStore, db, rag,
    fetcher: async () => ({ body: Buffer.from(sourceHtml), finalUrl: record.url }),
    now: () => new Date("2026-07-17T12:00:00.000Z")
  });
  const v1 = { source_id: record.source_id, url: record.url, final_url: record.url, content_hash: contentHashForHtmlOrTopic(sourceHtml), candidate_fingerprint: "v1-fingerprint" };
  await service.approve({ sourceId: record.source_id, candidate: v1, expectedFingerprint: "v1-fingerprint", actorUserId: "admin-fixture", confirmed: true });
  const first = await service.applyApproved({ sourceId: record.source_id, record, candidate: v1, expectedFingerprint: "v1-fingerprint", actorUserId: "admin-fixture", confirmed: true });
  assert.equal(first.docId, "master-source:fixture-guide:v1");
  assert.equal(fixture.docs.get(first.docId).metadata.is_current_version, true);

  sourceHtml = "<main>Version two guidance</main>";
  const v2 = { source_id: record.source_id, url: record.url, final_url: record.url, content_hash: contentHashForHtmlOrTopic(sourceHtml), candidate_fingerprint: "v2-fingerprint" };
  await service.approve({ sourceId: record.source_id, candidate: v2, expectedFingerprint: "v2-fingerprint", actorUserId: "admin-fixture", confirmed: true });
  const second = await service.applyApproved({ sourceId: record.source_id, record, candidate: v2, expectedFingerprint: "v2-fingerprint", actorUserId: "admin-fixture", confirmed: true });
  assert.equal(second.docId, "master-source:fixture-guide:v2");
  assert.equal(fixture.docs.get(first.docId).metadata.is_current_version, false);
  assert.equal(fixture.docs.get(first.docId).metadata.historical, true);
  assert.equal((await service.applyApproved({ sourceId: record.source_id, record, candidate: v2, expectedFingerprint: "v2-fingerprint", actorUserId: "admin-fixture", confirmed: true })).status, "already_applied");
  assert.equal(db.jobs.length, 1);
  db.jobs[0].nextAttemptAt = new Date("2026-07-17T00:00:00.000Z");
  const processed = await service.processJob(db.jobs[0]);
  assert.equal(processed.status, "done");
  assert.equal(await rag.countChunks(first.docId), 0);
  assert.equal(await rag.countChunks(second.docId), 1);
  assert.equal(db.jobs[0].status, "done");
});

test("failed ingest queues a bounded RAG_INGEST retry and does not change current version", async t => {
  const directory = await temporaryDirectory();
  const fixture = await fixtureRagService();
  t.after(async () => { await fixture.close(); await fs.rm(directory, { recursive: true, force: true }); });
  const stateStore = createMasterSourceRuntimeStateStore(path.join(directory, "runtime.json"), "registry-fixture");
  const db = createFakeDb();
  const rag = createMasterSourceRagClient({ baseUrl: fixture.baseUrl });
  const html = "<main>Broken ingest</main>";
  const candidate = { source_id: record.source_id, url: record.url, content_hash: contentHashForHtmlOrTopic(html), candidate_fingerprint: "broken" };
  const service = createMasterSourceLifecycleService({ stateStore, db, rag, fetcher: async () => ({ body: Buffer.from(html), finalUrl: record.url }) });
  await service.approve({ sourceId: record.source_id, candidate, expectedFingerprint: "broken", actorUserId: "admin-fixture", confirmed: true });
  fixture.setRejectIngest(true);
  await assert.rejects(() => service.applyApproved({ sourceId: record.source_id, record, candidate, expectedFingerprint: "broken", actorUserId: "admin-fixture", confirmed: true }));
  assert.equal((await stateStore.read()).state.sources[record.source_id].current_doc_id, undefined);
  assert.equal(db.jobs.length, 1);
  assert.equal(db.jobs[0].action, "RAG_INGEST");
  assert.equal(db.jobs[0].resourceType, "master_source");
  assert.equal(db.jobs[0].maxAttempts, 5);
});

test("master-source deletion retry backs off and ends in an explicit dead-letter state", async t => {
  const directory = await temporaryDirectory();
  const fixture = await fixtureRagService();
  t.after(async () => { await fixture.close(); await fs.rm(directory, { recursive: true, force: true }); });
  const stateStore = createMasterSourceRuntimeStateStore(path.join(directory, "runtime.json"), "registry-fixture");
  const db = createFakeDb();
  const rag = createMasterSourceRagClient({ baseUrl: fixture.baseUrl });
  const service = createMasterSourceLifecycleService({ stateStore, db, rag, fetcher: async () => ({ body: Buffer.from("<main>x</main>"), finalUrl: record.url }) });
  fixture.setRejectDelete(true);
  const job = await db.dataDeletionJob.create({ data: { id: "dead-letter", action: "RAG_DELETE", resourceType: "master_source", resourceId: record.source_id, externalRef: "missing", status: "pending", attempts: 0, maxAttempts: 2, nextAttemptAt: new Date("2020-01-01T00:00:00.000Z") } });
  await service.processJob(job);
  assert.equal(job.status, "pending");
  assert.equal(job.attempts, 1);
  assert.ok(job.nextAttemptAt instanceof Date);
  job.nextAttemptAt = new Date("2020-01-01T00:00:00.000Z");
  await service.processJob(job);
  assert.equal(job.status, "failed");
  assert.equal(job.attempts, 2);
  assert.equal(job.nextAttemptAt, null);
});

test("runtime state uses CAS and a lock so parallel writers cannot overwrite each other", async t => {
  const directory = await temporaryDirectory();
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "runtime.json");
  const base = createMasterSourceRuntimeState("registry-fixture", new Date("2026-07-17T00:00:00.000Z"));
  const initial = await writeMasterSourceRuntimeStateCas(file, base, { expectedFingerprint: null, registrySha256: "registry-fixture" });
  const left = { ...initial.state, sources: { left: { source_id: "left" } } };
  const right = { ...initial.state, sources: { right: { source_id: "right" } } };
  const results = await Promise.allSettled([
    writeMasterSourceRuntimeStateCas(file, left, { expectedFingerprint: initial.fingerprint, registrySha256: "registry-fixture" }),
    writeMasterSourceRuntimeStateCas(file, right, { expectedFingerprint: initial.fingerprint, registrySha256: "registry-fixture" })
  ]);
  assert.equal(results.filter(item => item.status === "fulfilled").length, 1);
  assert.ok(results.some(item => item.status === "rejected" && item.reason instanceof MasterSourceStateConflictError));
  assert.equal((await readMasterSourceRuntimeState(file, "registry-fixture")).state.revision, 2);
});
