import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  cancelDataExport,
  dataExportInternals,
  DATA_EXPORT_TTL_MS,
  expireDataExports,
  readDataExportForOwner,
  requestDataExport,
  runNextDataExport
} from "../../lib/dataExport/service.js";
import { buildPortableZip } from "../../lib/dataExport/zip.js";

// Minimal Prisma-shaped fake. The where-matcher covers the operators the export
// service actually uses (equality, null, in, not, gt/gte/lt/lte) so ownership,
// expiry and status guards are exercised for real rather than stubbed away.
function matchValue(rowValue, condition) {
  if (condition === null) return rowValue == null;
  if (condition instanceof Date) return rowValue instanceof Date ? rowValue.getTime() === condition.getTime() : rowValue === condition;
  if (condition && typeof condition === "object") {
    if ("in" in condition) return condition.in.includes(rowValue);
    if ("not" in condition) return rowValue !== condition.not;
    if ("gt" in condition) return rowValue != null && rowValue > condition.gt;
    if ("gte" in condition) return rowValue != null && rowValue >= condition.gte;
    if ("lt" in condition) return rowValue != null && rowValue < condition.lt;
    if ("lte" in condition) return rowValue != null && rowValue <= condition.lte;
    return false;
  }
  return rowValue === condition;
}

function matchWhere(row, where) {
  return Object.entries(where || {}).every(([key, value]) => matchValue(row[key], value));
}

function applyOrder(list, orderBy) {
  if (!orderBy) return list;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...list].sort((a, b) => {
    for (const clause of clauses) {
      const [field, direction] = Object.entries(clause)[0];
      const av = a[field];
      const bv = b[field];
      if (av === bv) continue;
      const cmp = av > bv ? 1 : -1;
      return direction === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

function createDb() {
  const rows = [];
  const select = where => rows.filter(row => matchWhere(row, where));
  const db = {
    rows,
    dataExportJob: {
      findFirst: async ({ where, orderBy } = {}) => applyOrder(select(where), orderBy)[0] || null,
      findMany: async ({ where, orderBy, take } = {}) => {
        const ordered = applyOrder(select(where), orderBy);
        return typeof take === "number" ? ordered.slice(0, take) : ordered;
      },
      findUnique: async ({ where }) => rows.find(row => row.id === where.id) || null,
      create: async ({ data }) => {
        const row = { id: `job-${rows.length + 1}`, downloadedAt: null, createdAt: data.requestedAt, updatedAt: data.requestedAt, ...data };
        rows.push(row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const matched = select(where);
        for (const row of matched) {
          for (const [key, value] of Object.entries(data)) {
            row[key] = value && typeof value === "object" && "increment" in value ? (row[key] || 0) + value.increment : value;
          }
        }
        return { count: matched.length };
      },
      update: async ({ where, data }) => {
        const row = rows.find(item => item.id === where.id);
        Object.assign(row, data);
        return row;
      }
    },
    user: { findUnique: async () => ({ email: "owner@example.test", role: "CLIENT", acceptsPreInquiries: false, createdAt: new Date(), updatedAt: new Date(), profile: null, frameworkAcceptances: [] }) },
    conversation: { findMany: async () => [{ title: "Mine", role: "CLIENT", createdAt: new Date(), updatedAt: new Date(), messages: [
      { authorId: "owner", role: "USER", content: "own words" },
      { authorId: "other", role: "USER", content: "other user words" },
      { authorId: "other", role: "SYSTEM", content: "do not export" },
      { authorId: null, role: "ASSISTANT", content: "visible answer" }
    ] }] },
    journey: { findMany: async () => [] },
    wellbeingRecord: { findMany: async () => [] },
    /* SOL-WB-18: mustandid on omaniku enda tekst ja nad kuuluvad koopiasse. */
    wellbeingOutputDraft: { findMany: async () => [] },
    preInquiry: { findMany: async () => [{ topic: "Topic", situation: "Own situation", receiverNote: "secret recipient note", recipientOwnerId: "other", status: "DRAFT", recipientType: "SERVICE", deliveryChannel: "INTERNAL", createdAt: new Date(), updatedAt: new Date() }] },
    userDocument: { findMany: async () => [] },
    agentArtifact: { findMany: async () => [] }
  };
  db.$transaction = fn => fn(db);
  return db;
}

async function withStorageDir(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sotsiaalai-export-test-"));
  const original = process.env.DATA_EXPORT_STORAGE_DIR;
  process.env.DATA_EXPORT_STORAGE_DIR = directory;
  try {
    return await run(directory);
  } finally {
    if (original === undefined) delete process.env.DATA_EXPORT_STORAGE_DIR;
    else process.env.DATA_EXPORT_STORAGE_DIR = original;
    await fs.rm(directory, { recursive: true, force: true });
  }
}

const silent = async () => null;

test("request is idempotent while an owner has an active job", async () => {
  const db = createDb();
  const now = new Date("2026-07-17T10:00:00.000Z");
  const first = await requestDataExport("owner", { db, now, audit: silent });
  const second = await requestDataExport("owner", { db, now, audit: silent });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(db.rows.length, 1);
});

test("registry ZIP contains only owner allowlists and manifest excludes content (C1)", async () => {
  const db = createDb();
  const job = { id: "job-safe", userId: "owner" };
  const { entries, manifest } = await dataExportInternals.collectExportEntries(job, { db, now: new Date("2026-07-17T10:00:00.000Z") });
  const archive = buildPortableZip(entries);
  const exported = archive.toString("utf8");
  assert.match(exported, /Own situation/);
  assert.match(exported, /own words/);
  assert.match(exported, /visible answer/);
  // Another user's message inside the same conversation, third-party notes and
  // internal SYSTEM turns must never reach the copy.
  assert.doesNotMatch(exported, /other user words/);
  assert.doesNotMatch(exported, /secret recipient note|do not export|recipientOwnerId/);
  assert.doesNotMatch(JSON.stringify(manifest), /Own situation|owner@example/);
  assert.equal(manifest.surfaces.every(surface => surface.thirdPartyExcluded), true);
});

test("worker creates a real ZIP and publishes one ready result", async () => {
  const db = createDb();
  const now = new Date("2026-07-17T10:00:00.000Z");
  await requestDataExport("owner", { db, now, audit: silent });
  await withStorageDir(async directory => {
    const result = await runNextDataExport({ db, now, audit: silent, notify: async () => ({ created: true }) });
    assert.equal(result.status, "ready");
    const content = await fs.readFile(path.join(directory, "job-1.zip"));
    assert.equal(content.subarray(0, 2).toString("utf8"), "PK");
    assert.equal(db.rows[0].manifest.schemaVersion, "data-export-v1");
  });
});

test("download is owner-, expiry- and existence-safe (C4)", async () => {
  const db = createDb();
  const now = new Date("2026-07-17T10:00:00.000Z");
  await withStorageDir(async directory => {
    const zipPath = path.join(directory, "job-ready.zip");
    await fs.writeFile(zipPath, buildPortableZip([{ name: "manifest.json", content: Buffer.from("{}") }], now));
    db.rows.push({ id: "job-ready", userId: "owner", status: "ready", requestedAt: now, expiresAt: new Date(now.getTime() + DATA_EXPORT_TTL_MS), outputPath: zipPath, downloadedAt: null });
    db.rows.push({ id: "job-old", userId: "owner", status: "ready", requestedAt: now, expiresAt: new Date(now.getTime() - 1000), outputPath: zipPath, downloadedAt: null });

    const owned = await readDataExportForOwner("owner", "job-ready", { db, now, audit: silent });
    assert.equal(owned.content.subarray(0, 2).toString("utf8"), "PK");
    assert.ok(db.rows.find(row => row.id === "job-ready").downloadedAt, "download must be recorded");

    // Stranger, expired and non-existent jobs must all fail identically: a 404
    // with the same message, giving no existence oracle.
    const rejects = [];
    for (const attempt of [
      () => readDataExportForOwner("intruder", "job-ready", { db, now, audit: silent }),
      () => readDataExportForOwner("owner", "job-old", { db, now, audit: silent }),
      () => readDataExportForOwner("owner", "does-not-exist", { db, now, audit: silent })
    ]) {
      const error = await attempt().then(() => null, err => err);
      assert.ok(error, "expected a rejection");
      rejects.push(error);
    }
    for (const error of rejects) {
      assert.equal(error.status, 404);
      assert.equal(error.message, "api.common.not_found");
    }
  });
});

test("copy-choice, cancel and expiry are idempotent (C5)", async () => {
  const db = createDb();
  const now = new Date("2026-07-17T10:00:00.000Z");
  // Copy-choice: a second request while active never creates a second job.
  await requestDataExport("owner", { db, now, audit: silent });
  const second = await requestDataExport("owner", { db, now, audit: silent });
  assert.equal(second.created, false);
  assert.equal(db.rows.length, 1);
  const jobId = db.rows[0].id;

  // Cancel is idempotent: the first cancels, the second is an honest 404 rather
  // than a second state transition.
  const cancelled = await cancelDataExport("owner", jobId, { db, now, audit: silent });
  assert.equal(cancelled.status, "cancelled");
  const second404 = await cancelDataExport("owner", jobId, { db, now, audit: silent }).then(() => null, err => err);
  assert.equal(second404?.status, 404);

  // Final expiry is idempotent: a ready job expires exactly once.
  await withStorageDir(async directory => {
    const zipPath = path.join(directory, "expiry.zip");
    await fs.writeFile(zipPath, Buffer.from("PK"));
    const readyAt = new Date(now.getTime());
    db.rows.push({ id: "job-expire", userId: "owner", status: "ready", requestedAt: now, readyAt, expiresAt: new Date(now.getTime() + 1000), outputPath: zipPath, downloadedAt: null });
    const later = new Date(now.getTime() + 2000);
    assert.equal(await expireDataExports({ db, now: later, audit: silent }), 1);
    assert.equal(await expireDataExports({ db, now: later, audit: silent }), 0);
    assert.equal(db.rows.find(row => row.id === "job-expire").status, "expired");
  });
});

test("worker notifies exactly once and retention removes the ZIP (C6)", async () => {
  const db = createDb();
  const now = new Date("2026-07-17T10:00:00.000Z");
  await requestDataExport("owner", { db, now, audit: silent });
  await withStorageDir(async () => {
    let notifyCount = 0;
    const notify = async () => { notifyCount += 1; return { created: true }; };
    const ready = await runNextDataExport({ db, now, audit: silent, notify });
    assert.equal(ready.status, "ready");
    // A second sweep finds no queued candidate, so no duplicate "ready" event.
    assert.equal(await runNextDataExport({ db, now, audit: silent, notify }), null);
    assert.equal(notifyCount, 1);

    const zipPath = db.rows[0].outputPath;
    assert.ok(zipPath);
    const later = new Date(now.getTime() + DATA_EXPORT_TTL_MS + 1000);
    assert.equal(await expireDataExports({ db, now: later, audit: silent }), 1);
    await assert.rejects(fs.access(zipPath), "expired ZIP must be removed from disk");
    assert.equal(db.rows[0].status, "expired");
    assert.equal(db.rows[0].outputPath, null);
    assert.equal(db.rows[0].manifest, null);
  });
});

test("data-copy and deletion copy is present with ET/EN/RU parity (C8)", async () => {
  const messagesDir = fileURLToPath(new URL("../../messages/", import.meta.url));
  const locales = {};
  for (const locale of ["et", "en", "ru"]) {
    locales[locale] = JSON.parse(await fs.readFile(path.join(messagesDir, `${locale}.json`), "utf8"));
  }
  const keySet = data => Object.keys(data.profile.data_export).sort();
  const baseline = keySet(locales.et);
  const required = ["title", "description", "included", "excluded", "download", "cancel", "ready", "expired", "delete_choice", "delete_copy", "delete_without_copy"];
  for (const [locale, data] of Object.entries(locales)) {
    assert.deepEqual(keySet(data), baseline, `profile.data_export keys differ in ${locale}`);
    for (const key of required) {
      assert.ok(typeof data.profile.data_export[key] === "string" && data.profile.data_export[key].length, `missing profile.data_export.${key} in ${locale}`);
    }
    assert.ok(data.notifications?.events?.data_export_ready, `missing notifications.events.data_export_ready in ${locale}`);
  }
});
