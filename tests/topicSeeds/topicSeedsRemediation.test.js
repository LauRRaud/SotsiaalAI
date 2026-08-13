import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as topicSeeds from "../../lib/topicSeeds.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function completeSeed(overrides = {}) {
  return {
    id: "seed_1",
    ownerId: "owner_1",
    title: "Katkendlik kooliskäimine",
    contextType: "child",
    caseType: "current",
    whyNow: "Puudumised on sagenenud.",
    requestedSupport: ["understanding"],
    importance: 8,
    safetyGate: "no_immediate_risk",
    status: "DRAFT",
    version: 1,
    sharedCardSnapshot: null,
    ownerConfirmedAt: null,
    sharedAt: null,
    covisionCaseId: null,
    createdAt: new Date("2026-08-13T08:00:00.000Z"),
    updatedAt: new Date("2026-08-13T08:00:00.000Z"),
    ...overrides
  };
}

function queueDb(seed) {
  const row = { ...seed };
  return {
    row,
    topicSeed: {
      async findFirst() { return { ...row }; },
      async updateMany({ data }) {
        Object.assign(row, data, { version: row.version + 1 });
        return { count: 1 };
      },
      async findUnique() { return { ...row }; }
    }
  };
}

test("negative proof: an email cannot enter the frozen Kovisioon snapshot", async () => {
  const db = queueDb(completeSeed({ whyNow: "Kirjuta mari.maas@example.test" }));
  const error = await topicSeeds.queueTopicSeed("owner_1", "seed_1", {
    expectedVersion: 1,
    confirmedNoIdentifiers: true,
    db
  }).then(() => null, (caught) => caught);

  assert.equal(error?.status, 422);
  assert.equal(error?.message, "topic_seeds.errors.direct_identifier_detected");
  assert.equal(db.row.status, "DRAFT");
});

test("remediation contract exposes owner lifecycle and bounded list services", () => {
  assert.equal(typeof topicSeeds.deleteTopicSeed, "function");
  assert.equal(typeof topicSeeds.withdrawTopicSeed, "function");
  assert.equal(typeof topicSeeds.listTopicSeedPage, "function");
  assert.equal(typeof topicSeeds.listWaitingTopicSeedPage, "function");
});

test("schema and API surface pin integer CAS, dedicated queue and lifecycle routes", () => {
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  const page = readFileSync(join(root, "components/teemaseeme/TeemaseemnedPage.jsx"), "utf8");
  const workspace = readFileSync(join(root, "components/covision/CovisionWorkspace.jsx"), "utf8");

  assert.match(schema, /model TopicSeed[\s\S]*?version\s+Int\s+@default\(1\)/);
  assert.match(page, /TOPIC_SEED_STATUS_META/);
  for (const status of ["DRAFT", "WAITING", "IN_COVISION", "FOLLOW_UP", "CLOSED"]) {
    assert.match(page, new RegExp(`\\b${status}\\b`));
  }
  assert.match(page, /nextCursor/);
  assert.match(workspace, /\/api\/topic-seeds\/queue/);
  assert.ok(existsSync(join(root, "app/api/topic-seeds/queue/route.js")));
  assert.ok(existsSync(join(root, "app/api/topic-seeds/[id]/withdraw/route.js")));
  assert.match(readFileSync(join(root, "app/api/topic-seeds/[id]/route.js"), "utf8"), /export async function DELETE/);
});
