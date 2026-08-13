import assert from "node:assert/strict";
import test from "node:test";

import { createEffectivePracticeService } from "../../lib/effectivePractices.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");

function practice(id, overrides = {}) {
  const snapshot = {
    publicId: `public-${id}`, title: `Practice ${id}`, summary: "Generalised guidance",
    suitableContext: "KOV", conditions: ["Consent"], limitations: "General only", steps: ["Assess"],
    practiceType: "Network", targetGroups: ["Adults"], environments: ["KOV"], maturityLevel: "confirmed",
    riskLevel: "LOW", topics: ["coordination"], tags: [], version: 1, publishedAt: NOW.toISOString(),
    professionalReviewedAt: NOW.toISOString(), nextReviewAt: "2027-01-01T00:00:00.000Z", reviewRoles: ["REVIEWER", "EDITOR", "ETHICS"]
  };
  return {
    id, publicId: `public-${id}`, authorId: "other", title: snapshot.title, summary: snapshot.summary,
    suitableContext: snapshot.suitableContext, conditions: snapshot.conditions, limitations: snapshot.limitations,
    steps: snapshot.steps, practiceType: snapshot.practiceType, targetGroups: snapshot.targetGroups,
    environments: snapshot.environments, maturityLevel: "practice_candidate", riskLevel: "LOW", topics: snapshot.topics,
    tags: [], status: "PUBLISHED", version: 1, contentVersion: 1, publishedVersion: 1, updatedAt: NOW,
    professionalReviewedAt: NOW, nextReviewAt: new Date("2027-01-01"), versions: [{ version: 1, publicSnapshot: snapshot }],
    reviews: [], reviewAssignments: [], applications: [], auditEvents: [], ...overrides
  };
}

function application(id, authorId = "actor") {
  return {
    id, publicId: `public-${id}`, authorId, assignedReviewerId: authorId === "actor" ? null : "actor",
    assignedCapabilityType: authorId === "actor" ? null : "REVIEWER", status: "SUBMITTED", version: 1, versionUsed: 1,
    practiceSnapshot: { publicId: "published-practice", title: "Practice", practiceType: "Network", topics: [] },
    context: "KOV", targetGroup: "Adults", adaptations: "None", whatWorked: "Roles", whatDidNot: "None",
    limitationOrRisk: "General", needsReview: true, createdAt: NOW, updatedAt: NOW, practice: practice("linked")
  };
}

function paginate(rows, args = {}) {
  const cursor = args.cursor?.id;
  const start = cursor ? Math.max(0, rows.findIndex((row) => row.id === cursor) + Number(args.skip || 0)) : 0;
  return rows.slice(start, start + Number(args.take || rows.length));
}

function makeDb() {
  const published = Array.from({ length: 201 }, (_, index) => practice(`p${String(index).padStart(3, "0")}`));
  published[200].title = "Needle behind the old cut";
  published[200].versions[0].publicSnapshot.title = published[200].title;
  const candidates = Array.from({ length: 101 }, (_, index) => practice(`c${String(index).padStart(3, "0")}`, {
    authorId: "actor", status: "DRAFT", versions: []
  }));
  const reviews = Array.from({ length: 101 }, (_, index) => practice(`r${String(index).padStart(3, "0")}`, {
    status: "IN_REVIEW", contentVersion: 2, versions: [],
    reviewAssignments: [{ reviewerId: "actor", capabilityType: "REVIEWER", contentVersion: 2, status: "ASSIGNED" }]
  }));
  const ownApplications = Array.from({ length: 101 }, (_, index) => application(`oa${String(index).padStart(3, "0")}`));
  const assignedApplications = Array.from({ length: 101 }, (_, index) => application(`ra${String(index).padStart(3, "0")}`, "someone-else"));
  const capabilities = Array.from({ length: 501 }, (_, index) => ({
    id: `cap${String(index).padStart(3, "0")}`, userId: index === 0 ? "actor" : `user-${index}`,
    type: "REVIEWER", scope: "", validFrom: new Date("2026-01-01"), validUntil: null, revokedAt: null, grantBasis: "verified"
  }));
  const selectPractices = (args = {}) => {
    let rows;
    if (args.where?.status === "PUBLISHED") rows = published;
    else if (args.where?.authorId === "actor") rows = candidates;
    else rows = reviews;
    const q = args.where?.OR?.[0]?.title?.contains;
    if (q) rows = rows.filter((row) => row.title.toLowerCase().includes(String(q).toLowerCase()));
    return paginate(rows, args);
  };
  const selectApplications = (args = {}) => paginate(args.where?.assignedReviewerId ? assignedApplications : ownApplications, args);
  const client = {
    effectivePractice: {
      findMany: async (args) => selectPractices(args),
      count: async (args) => selectPractices({ ...args, take: 10_000 }).length
    },
    effectivePracticeApplication: {
      findMany: async (args) => selectApplications(args),
      count: async (args) => selectApplications({ ...args, take: 10_000 }).length
    },
    practiceCapability: {
      findMany: async (args = {}) => {
        const rows = args.where?.userId === "actor" ? capabilities.filter((row) => row.userId === "actor") : capabilities;
        return paginate(rows, args);
      },
      count: async () => capabilities.length
    }
  };
  return client;
}

test("workspace pages every old 100/200 cut with stable cursors and full totals", async () => {
  const service = createEffectivePracticeService(makeDb(), { now: () => NOW });
  const actor = { userId: "actor", role: "SOCIAL_WORKER" };
  const first = await service.listWorkspace(actor, { limit: 100 });
  for (const key of ["practices", "candidates", "myApplications", "reviewQueue", "applicationQueue"]) {
    assert.equal(first[key].length, 100, key);
    assert.equal(first.pageInfo[key].hasMore, true, key);
    assert.equal(first.pageInfo[key].total, key === "practices" ? 201 : 101, key);
  }
  for (const [key, cursorName] of Object.entries({
    practices: "practicesCursor", candidates: "candidatesCursor", myApplications: "applicationsCursor",
    reviewQueue: "reviewsCursor", applicationQueue: "applicationReviewsCursor"
  })) {
    let cursor = first.pageInfo[key].nextCursor;
    let seen = first[key].length;
    while (cursor) {
      const next = await service.listWorkspace(actor, { limit: 100, [cursorName]: cursor });
      seen += next[key].length;
      cursor = next.pageInfo[key].nextCursor;
    }
    assert.equal(seen, key === "practices" ? 201 : 101, key);
  }
});

test("published filtering happens before pagination and finds the 201st row", async () => {
  const service = createEffectivePracticeService(makeDb(), { now: () => NOW });
  const result = await service.listWorkspace({ userId: "actor", role: "SOCIAL_WORKER" }, { q: "Needle", limit: 50 });
  assert.equal(result.practices.length, 1);
  assert.equal(result.practices[0].title, "Needle behind the old cut");
  assert.equal(result.pageInfo.practices.total, 1);
});

test("admin capability list reaches the 501st row through the same cursor contract", async () => {
  const service = createEffectivePracticeService(makeDb(), { now: () => NOW });
  const actor = { userId: "admin", role: "ADMIN", isAdmin: true };
  let cursor = "";
  const ids = [];
  do {
    const page = await service.listCapabilities(actor, { limit: 100, cursor });
    ids.push(...page.items.map((item) => item.id));
    cursor = page.pageInfo.nextCursor || "";
  } while (cursor);
  assert.equal(ids.length, 501);
  assert.equal(ids.at(-1), "cap500");
});
