#!/usr/bin/env node
/** SOL-SEED-02/04/05 — real PostgreSQL lifecycle, CAS race and 20k pagination probe. */
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import {
  createTopicSeed,
  deleteTopicSeed,
  listTopicSeedPage,
  listWaitingTopicSeedPage,
  queueTopicSeed,
  updateTopicSeed,
  withdrawTopicSeed
} from "../lib/topicSeeds.js";
import { startCovisionFromTopicSeed } from "../lib/covisionSession.js";
import { raceOnLockedRow, expectExactlyOneWinner } from "./probe-race-harness.mjs";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error("Sond kasutab ainult localhost PostgreSQL-i");
}

const databaseName = `sotsiaal_ai_topic_seed_probe_${Date.now()}`;
const adminUrl = new URL(parsed); adminUrl.pathname = "/postgres"; adminUrl.search = "";
const probeUrl = new URL(parsed); probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });

let passed = 0;
const expect = (label, condition, detail = "") => {
  if (!condition) throw new Error(`PROBE_FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
};
const runPrisma = (args) => {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (result.status !== 0) throw new Error(`prisma ${args.join(" ")} failed\n${result.stderr}`);
};

const complete = (title) => ({
  complete: true,
  title,
  contextType: "child",
  caseType: "current",
  whyNow: "Puudumised on sagenenud.",
  requestedSupport: ["perspectives"],
  importance: 8,
  safetyGate: "no_immediate_risk"
});

async function owner(label) {
  return prisma.user.create({
    data: {
      email: `${label}-${Math.random().toString(36).slice(2)}@sol-seed.invalid`,
      role: "SOCIAL_WORKER",
      emailVerified: new Date()
    }
  });
}

async function draft(userId, label) {
  return createTopicSeed(userId, complete(label), { db: prisma });
}

async function waiting(userId, label) {
  const seed = await draft(userId, label);
  return queueTopicSeed(userId, seed.id, {
    expectedVersion: seed.version,
    confirmedNoIdentifiers: true,
    db: prisma
  });
}

async function raceSeed(label, seedId, first, second) {
  return raceOnLockedRow({
    prisma,
    label,
    expect,
    lockRow: (tx) => tx.$queryRaw`SELECT "id" FROM "TopicSeed" WHERE "id" = ${seedId} FOR UPDATE`,
    first,
    second
  });
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  runPrisma(["migrate", "deploy"]);
  const user = await owner("race");

  {
    const seed = await draft(user.id, "Legacy timestamp negative control");
    const legacyFingerprint = seed.updatedAt;
    const firstWinner = await prisma.$executeRaw`
      UPDATE "TopicSeed"
      SET "title" = ${"Legacy winner A"}, "updatedAt" = ${legacyFingerprint}
      WHERE "id" = ${seed.id} AND "updatedAt" = ${legacyFingerprint}
    `;
    const secondWinner = await prisma.$executeRaw`
      UPDATE "TopicSeed"
      SET "title" = ${"Legacy winner B"}, "updatedAt" = ${legacyFingerprint}
      WHERE "id" = ${seed.id} AND "updatedAt" = ${legacyFingerprint}
    `;
    const row = await prisma.topicSeed.findUnique({ where: { id: seed.id } });
    expect(
      "NEGATIVE CONTROL: legacy millisecond fingerprint admits both writes",
      firstWinner === 1 && secondWinner === 1 && row.title === "Legacy winner B"
    );
  }

  {
    const seed = await draft(user.id, "PATCH versus PATCH");
    const { resultA, resultB } = await raceSeed(
      "PATCH↔PATCH",
      seed.id,
      () => updateTopicSeed(user.id, seed.id, { expectedVersion: seed.version, title: "Võitja A" }, { db: prisma }),
      () => updateTopicSeed(user.id, seed.id, { expectedVersion: seed.version, title: "Võitja B" }, { db: prisma })
    );
    expectExactlyOneWinner(expect, "PATCH↔PATCH", resultA, resultB);
    const row = await prisma.topicSeed.findUnique({ where: { id: seed.id } });
    const winner = resultA.value?.title || resultB.value?.title;
    expect("PATCH↔PATCH: version increments exactly once", row.version === seed.version + 1, String(row.version));
    expect("PATCH↔PATCH: persisted content is the winner", row.title === winner, `${row.title} != ${winner}`);
  }

  for (const queueFirst of [false, true]) {
    const seed = await draft(user.id, queueFirst ? "Queue first" : "Patch first");
    const patch = () => updateTopicSeed(
      user.id,
      seed.id,
      { expectedVersion: seed.version, title: "Parandatud sisu" },
      { db: prisma }
    );
    const queue = () => queueTopicSeed(user.id, seed.id, {
      expectedVersion: seed.version,
      confirmedNoIdentifiers: true,
      db: prisma
    });
    const { resultA, resultB } = await raceSeed(
      queueFirst ? "queue→PATCH" : "PATCH→queue",
      seed.id,
      queueFirst ? queue : patch,
      queueFirst ? patch : queue
    );
    expectExactlyOneWinner(expect, queueFirst ? "queue→PATCH" : "PATCH→queue", resultA, resultB);
    const row = await prisma.topicSeed.findUnique({ where: { id: seed.id } });
    expect(`${queueFirst ? "queue→PATCH" : "PATCH→queue"}: version increments once`, row.version === seed.version + 1);
    if (queueFirst) {
      expect("queue→PATCH: frozen snapshot matches the queue winner", row.status === "WAITING" && row.sharedCardSnapshot.title === seed.title);
    } else {
      expect("PATCH→queue: stale queue cannot freeze old content", row.status === "DRAFT" && row.title === "Parandatud sisu" && row.sharedCardSnapshot === null);
    }
  }

  for (const startFirst of [true, false]) {
    const seed = await waiting(user.id, startFirst ? "Start first" : "Withdraw first");
    const start = () => startCovisionFromTopicSeed(user.id, seed.id, { expectedVersion: seed.version, db: prisma });
    const withdraw = () => withdrawTopicSeed(user.id, seed.id, { expectedVersion: seed.version, db: prisma });
    const { resultA, resultB } = await raceSeed(
      startFirst ? "start→withdraw" : "withdraw→start",
      seed.id,
      startFirst ? start : withdraw,
      startFirst ? withdraw : start
    );
    expectExactlyOneWinner(expect, startFirst ? "start→withdraw" : "withdraw→start", resultA, resultB);
    const row = await prisma.topicSeed.findUnique({ where: { id: seed.id } });
    expect(
      `${startFirst ? "start→withdraw" : "withdraw→start"}: final state is coherent`,
      (row.status === "IN_COVISION" && Boolean(row.covisionCaseId) && row.sharedCardSnapshot)
        || (row.status === "DRAFT" && !row.covisionCaseId && row.sharedCardSnapshot === null)
    );
  }

  {
    const seed = await waiting(user.id, "Audit rollback");
    const failingAuditDb = {
      $transaction: (callback) => prisma.$transaction((tx) => callback(new Proxy(tx, {
        get(target, property) {
          if (property === "dataAuditLog") return { create: async () => { throw new Error("injected audit failure"); } };
          return target[property];
        }
      })))
    };
    const error = await withdrawTopicSeed(user.id, seed.id, {
      expectedVersion: seed.version,
      db: failingAuditDb
    }).then(() => null, (caught) => caught);
    const row = await prisma.topicSeed.findUnique({ where: { id: seed.id } });
    expect("audit failure is surfaced", error?.message === "injected audit failure");
    expect("audit failure rolls WAITING withdrawal back", row.status === "WAITING" && row.version === seed.version);
  }

  {
    const deleteOwner = await owner("delete");
    const seed = await draft(deleteOwner.id, "Delete receipt");
    await deleteTopicSeed(deleteOwner.id, seed.id, { expectedVersion: seed.version, db: prisma });
    const receiptBefore = await prisma.dataAuditLog.findFirst({
      where: { action: "TOPIC_SEED_DRAFT_DELETED", resourceId: seed.id }
    });
    expect("DRAFT delete removes the content row", !await prisma.topicSeed.findUnique({ where: { id: seed.id } }));
    expect("DRAFT delete writes a content-free audit receipt", receiptBefore && !JSON.stringify(receiptBefore).includes("Delete receipt"));
    await prisma.user.delete({ where: { id: deleteOwner.id } });
    const receiptAfter = await prisma.dataAuditLog.findUnique({ where: { id: receiptBefore.id } });
    expect("audit receipt survives account deletion", Boolean(receiptAfter));
  }

  {
    const loadOwner = await owner("load");
    const total = 20_005;
    const base = Date.now() - total * 1000;
    const batch = 1_000;
    for (let offset = 0; offset < total; offset += batch) {
      const size = Math.min(batch, total - offset);
      await prisma.topicSeed.createMany({
        data: Array.from({ length: size }, (_, index) => {
          const number = offset + index;
          return {
            id: `load-${String(number).padStart(6, "0")}`,
            ownerId: loadOwner.id,
            title: `Koormusseeme ${number}`,
            contextType: "adult",
            caseType: "current",
            whyNow: "Üldistatud koormustesti sisu.",
            requestedSupport: ["understanding"],
            importance: 5,
            safetyGate: "no_immediate_risk",
            status: number % 5 === 0 ? "WAITING" : "DRAFT",
            version: 1,
            sharedCardSnapshot: number % 5 === 0 ? {
              title: `Koormusseeme ${number}`,
              contextType: "adult",
              caseType: "current",
              whyNow: "Üldistatud koormustesti sisu.",
              requestedSupport: ["understanding"],
              importance: 5,
              frozenAt: new Date(base + number * 1000).toISOString()
            } : undefined,
            updatedAt: new Date(base + number * 1000)
          };
        })
      });
    }
    const startedAt = performance.now();
    const page = await listTopicSeedPage(loadOwner.id, { limit: 24, db: prisma });
    const elapsedMs = performance.now() - startedAt;
    const bytes = Buffer.byteLength(JSON.stringify(page));
    expect("20k owner history returns only the requested page", page.seeds.length === 24 && page.counts.ALL === total);
    expect("20k owner history response stays below 64 KiB", bytes < 65_536, `${bytes} bytes`);
    expect("20k owner history indexed query completes under 5 s", elapsedMs < 5_000, `${elapsedMs.toFixed(1)} ms`);
    const next = await listTopicSeedPage(loadOwner.id, { limit: 24, cursor: page.nextCursor, db: prisma });
    expect("20k cursor has no duplicate across adjacent pages", new Set([...page.seeds, ...next.seeds].map((row) => row.id)).size === 48);

    const queueStartedAt = performance.now();
    const queue = await listWaitingTopicSeedPage(loadOwner.id, { limit: 50, db: prisma });
    const queueElapsedMs = performance.now() - queueStartedAt;
    const queueBytes = Buffer.byteLength(JSON.stringify(queue));
    expect("dedicated queue is bounded and minimal", queue.seeds.length === 50 && Object.keys(queue.seeds[0]).length === 6);
    expect("dedicated queue response stays below 64 KiB", queueBytes < 65_536, `${queueBytes} bytes`);
    expect("dedicated queue indexed query completes under 5 s", queueElapsedMs < 5_000, `${queueElapsedMs.toFixed(1)} ms`);
  }

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await prisma.$disconnect().catch(() => null);
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
