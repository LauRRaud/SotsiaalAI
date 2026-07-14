import test from "node:test";
import assert from "node:assert/strict";

import { createEffectivePracticeService } from "../../lib/effectivePractices.js";

// P1-C: reviewer-assignment repair — read-only audit (dryRun) + apply, with the
// author-is-reviewer, stale-content-version and contradictory-completed detectors.

const NOW = new Date("2026-07-14T12:00:00.000Z");
const SYSTEM = { userId: "system", role: "SYSTEM", isAdmin: true };

function makeDb({
  assignments = [], practices = [], capabilities = [], fragilePractices = [], applications = [],
  onAssignmentUpdate = null, onApplicationUpdate = null
} = {}) {
  const state = { assignments, capabilities, fragilePractices, applications, audits: [] };
  const practiceById = new Map(practices.map((p) => [p.id, p]));
  const withPractice = (a) => ({ ...a, practice: practiceById.get(a.practiceId) || null });
  const client = {
    state,
    effectivePracticeReviewAssignment: {
      findMany: async ({ where = {} } = {}) => {
        if (where.status === "ASSIGNED") {
          return state.assignments.filter((a) => a.status === "ASSIGNED").map(withPractice);
        }
        return state.assignments.filter((a) =>
          a.practiceId === where.practiceId && a.capabilityType === where.capabilityType && a.contentVersion === where.contentVersion);
      },
      updateMany: async ({ where, data }) => {
        if (onAssignmentUpdate) {
          const override = await onAssignmentUpdate({ where, data, state });
          if (override) return override;
        }
        const a = state.assignments.find((x) => x.id === where.id && (!where.status || x.status === where.status));
        if (!a) return { count: 0 };
        Object.assign(a, data);
        return { count: 1 };
      },
      create: async ({ data }) => { const row = { id: `new-${state.assignments.length + 1}`, ...data }; state.assignments.push(row); return row; }
    },
    practiceCapability: {
      findFirst: async ({ where }) => state.capabilities.find((c) =>
        c.userId === where.userId && c.type === where.type && !c.revokedAt) || null,
      findMany: async ({ where }) => {
        const types = where.type?.in || [where.type];
        return state.capabilities.filter((c) =>
          types.includes(c.type) && !c.revokedAt && !(where.userId?.notIn || []).includes(c.userId));
      }
    },
    effectivePractice: {
      findMany: async () => state.fragilePractices,
      updateMany: async ({ where, data }) => {
        const row = state.fragilePractices.find((item) => item.id === where.id && item.status === where.status && item.version === where.version);
        if (!row) return { count: 0 };
        Object.assign(row, data, { version: row.version + (data.version?.increment || 0) });
        return { count: 1 };
      }
    },
    effectivePracticeApplication: {
      findMany: async () => state.applications,
      updateMany: async ({ where, data }) => {
        if (onApplicationUpdate) {
          const override = await onApplicationUpdate({ where, data, state });
          if (override) return override;
        }
        const row = state.applications.find((item) => item.id === where.id
          && where.status.in.includes(item.status)
          && item.assignedReviewerId === where.assignedReviewerId
          && item.assignedCapabilityType === where.assignedCapabilityType);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }
    },
    effectivePracticeAuditEvent: { create: async ({ data }) => { state.audits.push(data); return data; } },
    async $transaction(cb) { return cb(client); }
  };
  return client;
}

const service = (db) => createEffectivePracticeService(db, { now: () => NOW });
const assignment = (o = {}) => ({ id: "a1", practiceId: "p1", reviewerId: "rev-1", capabilityType: "REVIEWER", contentVersion: 2, status: "ASSIGNED", completedAt: null, ...o });
const practice = (o = {}) => ({ id: "p1", authorId: "author-1", contentVersion: 2, ...o });
const capability = (o = {}) => ({ userId: "rev-1", type: "REVIEWER", scope: "", revokedAt: null, validFrom: new Date("2020-01-01"), validUntil: null, ...o });

test("repair flags and reassigns an author reviewing their own practice", async () => {
  const db = makeDb({
    assignments: [assignment({ reviewerId: "author-1" })],
    practices: [practice()],
    capabilities: [capability(), capability({ userId: "rev-2" })]
  });
  const result = await service(db).repairAssignments(SYSTEM);
  const finding = result.findings.find((f) => f.issue === "author_is_reviewer");
  assert.ok(finding, "author-is-reviewer detected");
  assert.equal(result.candidateRepairs, 1);
  const old = db.state.assignments.find((a) => a.id === "a1");
  assert.equal(old.status, "DECLINED");
  assert.ok(
    db.state.assignments.some((a) => a.status === "ASSIGNED" && a.reviewerId && a.reviewerId !== "author-1"),
    "reassigned to a non-author reviewer"
  );
  assert.equal(db.state.audits.length, 1);
  assert.equal(db.state.audits[0].action, "ASSIGNMENT_REPAIR_APPLIED");
  assert.equal(db.state.audits[0].metadata.result, "reassigned");
});

test("real review winning the repair CAS creates no replacement and no audit (SOL-P1-3 ordering A)", async () => {
  let firstUpdate = true;
  const db = makeDb({
    assignments: [assignment({ reviewerId: "author-1" })],
    practices: [practice()],
    capabilities: [capability({ userId: "rev-2" })],
    onAssignmentUpdate: ({ where, state }) => {
      if (!firstUpdate || where.id !== "a1") return null;
      firstUpdate = false;
      Object.assign(state.assignments[0], { status: "COMPLETED", completedAt: NOW });
      return { count: 0 };
    }
  });
  const result = await service(db).repairAssignments(SYSTEM);
  assert.equal(result.candidateRepairs, 0);
  assert.equal(db.state.assignments.length, 1, "repair cannot mint a replacement after losing CAS");
  assert.equal(db.state.assignments[0].status, "COMPLETED");
  assert.equal(db.state.audits.length, 0);
});

test("repair winning the CAS declines, reassigns and audits before a later review (SOL-P1-3 ordering B)", async () => {
  const db = makeDb({
    assignments: [assignment({ reviewerId: "author-1" })],
    practices: [practice()],
    capabilities: [capability({ userId: "rev-2" })]
  });
  const result = await service(db).repairAssignments(SYSTEM);
  assert.equal(result.candidateRepairs, 1);
  assert.equal(db.state.assignments.find((row) => row.id === "a1").status, "DECLINED");
  assert.equal(db.state.assignments.filter((row) => row.status === "ASSIGNED").length, 1);
  assert.equal(db.state.audits.filter((row) => row.action === "ASSIGNMENT_REPAIR_APPLIED").length, 1);
});

test("repair declines a stale-content-version assignment (superseded cycle)", async () => {
  const db = makeDb({
    assignments: [assignment({ contentVersion: 1 })],
    practices: [practice({ contentVersion: 3 })],
    capabilities: [capability()]
  });
  const result = await service(db).repairAssignments(SYSTEM);
  assert.ok(result.findings.some((f) => f.issue === "stale_content_version"));
  assert.equal(db.state.assignments.find((a) => a.id === "a1").status, "DECLINED");
});

test("repair normalizes a contradictory ASSIGNED row that already has completedAt", async () => {
  const db = makeDb({
    assignments: [assignment({ completedAt: NOW })],
    practices: [practice()],
    capabilities: [capability()]
  });
  const result = await service(db).repairAssignments(SYSTEM);
  assert.ok(result.findings.some((f) => f.issue === "contradictory_completed"));
  assert.equal(db.state.assignments.find((a) => a.id === "a1").status, "COMPLETED");
});

test("repair leaves a healthy assignment untouched", async () => {
  const db = makeDb({
    assignments: [assignment()],
    practices: [practice()],
    capabilities: [capability()]
  });
  const result = await service(db).repairAssignments(SYSTEM);
  assert.equal(result.findings.length, 0);
  assert.equal(result.candidateRepairs, 0);
  assert.equal(db.state.assignments.find((a) => a.id === "a1").status, "ASSIGNED");
});

test("dryRun detects issues WITHOUT writing any change", async () => {
  const db = makeDb({
    assignments: [assignment({ reviewerId: "author-1" })],
    practices: [practice()],
    capabilities: [capability({ userId: "rev-2" })]
  });
  const result = await service(db).repairAssignments(SYSTEM, { dryRun: true });
  assert.equal(result.dryRun, true);
  assert.ok(result.findings.some((f) => f.issue === "author_is_reviewer"));
  // No mutation: the broken row stays ASSIGNED and nothing was reassigned.
  assert.equal(db.state.assignments.length, 1);
  assert.equal(db.state.assignments[0].status, "ASSIGNED");
});

test("repair leaves a row visibly unassigned when no replacement exists (attention, not silent)", async () => {
  const db = makeDb({
    assignments: [assignment({ reviewerId: "author-1" })],
    practices: [practice()],
    capabilities: [] // no eligible replacement reviewer
  });
  const result = await service(db).repairAssignments(SYSTEM);
  assert.equal(result.unresolved, 1);
  assert.ok(result.findings.some((f) => f.issue === "no_replacement"));
  assert.equal(db.state.assignments.find((a) => a.id === "a1").status, "DECLINED");
  assert.equal(db.state.assignments.length, 1, "never mints a silent wrong assignment");
  assert.equal(db.state.audits.length, 1, "applied decline is always audited");
});

test("high-risk repair ignores approvals from old content versions (SOL-P1-3)", async () => {
  const fragile = {
    ...practice({ status: "READY_TO_PUBLISH", riskLevel: "HIGH", version: 7, contentVersion: 3 }),
    reviews: [
      { reviewerId: "old-1", capabilityType: "REVIEWER", reviewedVersion: 2, decision: "APPROVED", decidedAt: NOW },
      { reviewerId: "old-2", capabilityType: "REVIEWER", reviewedVersion: 2, decision: "APPROVED", decidedAt: NOW }
    ],
    reviewAssignments: []
  };
  const db = makeDb({
    practices: [fragile],
    fragilePractices: [fragile],
    capabilities: [capability({ userId: "current-reviewer" })]
  });
  const result = await service(db).repairAssignments(SYSTEM);
  assert.ok(result.findings.some((row) => row.type === "high_risk_chain"));
  assert.equal(fragile.status, "IN_REVIEW");
  assert.equal(db.state.audits.some((row) => row.action === "HIGH_RISK_REVIEW_CHAIN_REPAIRED"), true);
});

test("application assignment repair is CAS-applied and audited", async () => {
  const appPractice = practice({ status: "PUBLISHED", topics: ["families"] });
  const application = {
    id: "app-1",
    status: "SUBMITTED",
    authorId: "app-author",
    assignedReviewerId: "rev-invalid",
    assignedCapabilityType: "REVIEWER",
    practice: appPractice,
    practiceSnapshot: { publicId: "pub-1", topics: ["families"] },
    context: "families",
    targetGroup: "families"
  };
  const db = makeDb({
    practices: [appPractice],
    applications: [application],
    capabilities: [capability({ userId: "rev-2", scope: "families" })]
  });
  const result = await service(db).repairAssignments(SYSTEM);
  assert.equal(result.applicationRepairs, 1);
  assert.equal(application.assignedReviewerId, "rev-2");
  assert.equal(db.state.audits.length, 1);
  assert.equal(db.state.audits[0].action, "APPLICATION_ASSIGNMENT_REPAIR_APPLIED");
  assert.equal(db.state.audits[0].metadata.replacementAssigned, true);
});

test("application repair losing its assignment CAS does not overwrite or audit the concurrent winner", async () => {
  const appPractice = practice({ status: "PUBLISHED", topics: ["families"] });
  const application = {
    id: "app-1",
    status: "SUBMITTED",
    authorId: "app-author",
    assignedReviewerId: "rev-invalid",
    assignedCapabilityType: "REVIEWER",
    practice: appPractice,
    practiceSnapshot: { publicId: "pub-1", topics: ["families"] }
  };
  const db = makeDb({
    practices: [appPractice],
    applications: [application],
    capabilities: [capability({ userId: "rev-2", scope: "families" })],
    onApplicationUpdate: ({ state }) => {
      Object.assign(state.applications[0], { assignedReviewerId: "concurrent-reviewer", assignedCapabilityType: "EDITOR" });
      return { count: 0 };
    }
  });
  const result = await service(db).repairAssignments(SYSTEM);
  assert.equal(result.applicationRepairs, 0);
  assert.equal(application.assignedReviewerId, "concurrent-reviewer");
  assert.equal(application.assignedCapabilityType, "EDITOR");
  assert.equal(db.state.audits.length, 0);
});

test("only admin / SYSTEM may run the repair", async () => {
  const db = makeDb({ assignments: [], practices: [] });
  const error = await service(db).repairAssignments({ userId: "u1", role: "SOCIAL_WORKER" }).then(() => null, (e) => e);
  assert.equal(error.status, 403);
});
