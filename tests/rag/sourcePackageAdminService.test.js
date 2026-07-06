import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSourcePackageReviewReasons,
  buildSourcePackageWhere,
  computeSourcePackageReviewFlags,
  getSourcePackageSnapshot,
  listSourcePackageSnapshots,
  reviewSourcePackageSnapshot,
  serializeSourcePackageSnapshot
} from "../../lib/admin/rag/sourcePackages/service.js";

function snapshotFixture(overrides = {}) {
  return {
    id: "snapshot-1",
    packageId: "jogeva_vald_service_koduteenus_package",
    canonicalItemId: "jogeva_vald_service_koduteenus",
    municipalityId: "jogeva_vald",
    packageType: "kov_service",
    title: "Koduteenus",
    status: "needs_review",
    reviewStatus: "pending",
    confidence: "medium",
    missingSections: ["forms", "contacts", "legal_basis"],
    packageHash: "hash-1",
    lastBuiltAt: new Date("2026-04-28T10:00:00.000Z"),
    lastChecked: "2026-04-28",
    version: 1,
    active: true,
    createdAt: new Date("2026-04-28T10:00:00.000Z"),
    updatedAt: new Date("2026-04-28T10:00:00.000Z"),
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
    sectionSummary: {
      description: {
        count: 1,
        source_ids: ["service-info"],
        excerpt: "This long excerpt must not leave the service serializer."
      }
    },
    sourceMembership: [
      {
        source_id: "service-info",
        source_type: "kov_service_info",
        collection_id: "kov_services",
        resource_type: "service_page",
        municipality_id: "jogeva_vald",
        source_status: "active",
        historical: false,
        sections: ["description", "application"],
        evidence_allowed: true,
        evidence_strength: "strong",
        evidenceText: "This long source excerpt must not be returned.",
        prompt: "hidden prompt",
        userMessage: "hidden user text"
      }
    ],
    ...overrides
  };
}

function matchesValue(rowValue, expected) {
  if (expected && typeof expected === "object" && "not" in expected) {
    return rowValue !== expected.not;
  }
  return rowValue === expected;
}

function matchesWhere(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && "id" in value && value.id && typeof value.id === "object" && "not" in value.id) {
      return row.id !== value.id.not;
    }
    return matchesValue(row[key], value);
  });
}

function createFakeClient(seedRows = [], seedEvents = []) {
  const rows = seedRows.map(row => ({ ...row }));
  const events = seedEvents.map(row => ({ ...row }));
  let eventCounter = events.length + 1;

  const snapshotDelegate = {
    rows,
    async count({ where = {} } = {}) {
      return rows.filter(row => matchesWhere(row, where)).length;
    },
    async findMany({ where = {}, skip = 0, take = 50, select } = {}) {
      const filtered = rows.filter(row => matchesWhere(row, where)).slice(skip, skip + take);
      if (!select) return filtered;
      return filtered.map(row => Object.fromEntries(Object.keys(select).map(key => [key, row[key]])));
    },
    async findUnique({ where = {} } = {}) {
      return rows.find(row => matchesWhere(row, where)) || null;
    },
    async update({ where = {}, data = {} } = {}) {
      const row = rows.find(item => matchesWhere(item, where));
      if (!row) {
        const error = new Error("Record not found");
        error.code = "P2025";
        throw error;
      }
      Object.assign(row, data, { updatedAt: new Date("2026-04-28T11:00:00.000Z") });
      return row;
    },
    async updateMany({ where = {}, data = {} } = {}) {
      let count = 0;
      for (const row of rows) {
        if (!matchesWhere(row, where)) continue;
        Object.assign(row, data, { updatedAt: new Date("2026-04-28T11:00:00.000Z") });
        count += 1;
      }
      return { count };
    }
  };

  const eventDelegate = {
    events,
    async create({ data = {} } = {}) {
      const row = {
        id: `event-${eventCounter++}`,
        createdAt: new Date("2026-04-28T11:00:00.000Z"),
        ...data
      };
      events.push(row);
      return row;
    },
    async findMany({ where = {}, take = 20 } = {}) {
      return events.filter(row => matchesWhere(row, where)).slice(0, take);
    }
  };

  return {
    sourcePackageSnapshot: snapshotDelegate,
    sourcePackageSnapshotReviewEvent: eventDelegate,
    rows,
    events,
    async $transaction(work) {
      return work(this);
    }
  };
}

test("serializeSourcePackageSnapshot returns safe review data without prompt, user text, or excerpts", () => {
  const serialized = serializeSourcePackageSnapshot(snapshotFixture(), { detail: true });
  const text = JSON.stringify(serialized);

  assert.equal(serialized.reviewStatus, "pending");
  assert.equal(Array.isArray(serialized.reviewReasons), true);
  assert.equal(serialized.reviewReasons.length > 0, true);
  assert.equal(serialized.packageAttributionChecked, true);
  assert.equal(serialized.highRiskAttributionChecked, false);
  assert.equal(Array.isArray(serialized.attributionFlags), true);
  assert.equal(serialized.sectionAttributionSummary.forms.evidence_strength, "missing");
  assert.equal(serialized.gapSummary.forms.status, "missing");
  assert.deepEqual(serialized.reviewFlags, {
    missing_source_keys: false,
    missing_forms: true,
    missing_contacts: true,
    missing_legal_basis: false,
    missing_fees: false,
    missing_deadlines: false,
    package_conflict: false,
    invalid_current_evidence: false,
    legal_basis_without_rt_layer: false,
    wrong_collection_id: false
  });
  assert.equal(serialized.reviewQueueSeverity, "review");
  assert.equal(serialized.hasActionableReview, true);
  assert.equal(text.includes("hidden prompt"), false);
  assert.equal(text.includes("hidden user text"), false);
  assert.equal(text.includes("long source excerpt"), false);
  assert.equal(text.includes("long excerpt"), false);
});

test("buildSourcePackageWhere supports review, status, active, and needsReview filters", () => {
  assert.deepEqual(buildSourcePackageWhere({ reviewStatus: "pending" }), { reviewStatus: "pending" });
  assert.deepEqual(buildSourcePackageWhere({ status: "needs_review" }), { status: "needs_review" });
  assert.deepEqual(buildSourcePackageWhere({ active: "true" }), { active: true });
  assert.deepEqual(buildSourcePackageWhere({ needsReview: "true" }), { status: "needs_review" });
  assert.deepEqual(buildSourcePackageWhere({ needsReview: "false" }), { status: { not: "needs_review" } });
});

test("buildSourcePackageReviewReasons exposes readable reason details", () => {
  const reasons = buildSourcePackageReviewReasons({
    missing_forms: true,
    invalid_current_evidence: true
  });

  assert.deepEqual(reasons.map(item => item.code), ["missing_forms", "invalid_current_evidence"]);
  assert.equal(reasons[0].label.length > 5, true);
  assert.equal(reasons[0].severity, "review");
  assert.equal(reasons[1].severity, "blocker");
});

test("fees and deadlines missing are info-only and do not create actionable pending queue", () => {
  const serialized = serializeSourcePackageSnapshot(snapshotFixture({
    status: "active",
    missingSections: ["fees", "deadlines"],
    sourceMembership: [
      {
        source_id: "service-info",
        source_type: "kov_service_info",
        collection_id: "kov_services",
        municipality_id: "jogeva_vald",
        source_status: "active",
        historical: false,
        sections: ["description"],
        evidence_allowed: true
      }
    ]
  }));

  assert.equal(serialized.reviewQueueSeverity, "info");
  assert.equal(serialized.hasActionableReview, false);
  assert.equal(serialized.hasInfoWarnings, true);
  assert.deepEqual(serialized.actionableReviewReasons, []);
  assert.deepEqual(serialized.infoReviewReasons.map(reason => reason.code), ["missing_fees", "missing_deadlines"]);
});

test("listSourcePackageSnapshots applies reviewStatus and status filters", async () => {
  const client = createFakeClient([
    snapshotFixture({ id: "pending", reviewStatus: "pending", status: "needs_review" }),
    snapshotFixture({ id: "reviewed", reviewStatus: "reviewed", status: "active" })
  ]);

  const pending = await listSourcePackageSnapshots({ reviewStatus: "pending" }, client);
  const needsReview = await listSourcePackageSnapshots({ status: "needs_review" }, client);

  assert.equal(pending.total, 1);
  assert.equal(pending.items[0].id, "pending");
  assert.equal(needsReview.total, 1);
  assert.equal(needsReview.items[0].id, "pending");
});

test("mark_reviewed sets review metadata without changing automated package status and writes history", async () => {
  const client = createFakeClient([snapshotFixture()]);
  const reviewed = await reviewSourcePackageSnapshot("snapshot-1", "mark_reviewed", {
    reviewedBy: "admin@example.test",
    reviewNote: "Checked in admin."
  }, client);

  assert.equal(reviewed.reviewStatus, "reviewed");
  assert.equal(reviewed.status, "needs_review");
  assert.equal(reviewed.reviewedBy, "admin@example.test");
  assert.equal(reviewed.reviewNote, "Checked in admin.");
  assert.ok(reviewed.reviewedAt);
  assert.equal(client.rows[0].reviewedBy, "admin@example.test");
  assert.equal(client.rows[0].active, true);
  assert.equal(client.events.length, 1);
  assert.equal(client.events[0].action, "mark_reviewed");
});

test("archive sets reviewStatus archived, status archived, and active false", async () => {
  const client = createFakeClient([snapshotFixture()]);
  const archived = await reviewSourcePackageSnapshot("snapshot-1", "archive", {
    reviewedBy: "admin@example.test"
  }, client);

  assert.equal(archived.reviewStatus, "archived");
  assert.equal(archived.status, "archived");
  assert.equal(archived.active, false);
  assert.equal(archived.reviewedBy, "admin@example.test");
  assert.ok(archived.reviewedAt);
  assert.equal(client.events.at(-1).action, "archive");
});

test("restore_active deactivates previous active snapshot, keeps one active snapshot, and clears row-level review metadata when pending", async () => {
  const client = createFakeClient([
    snapshotFixture({
      id: "snapshot-archived",
      active: false,
      status: "archived",
      reviewStatus: "archived",
      reviewedAt: new Date("2026-04-28T09:00:00.000Z"),
      reviewedBy: "old-admin@example.test",
      reviewNote: "Older archive review."
    }),
    snapshotFixture({
      id: "snapshot-active",
      packageHash: "hash-2",
      version: 2,
      active: true,
      status: "active",
      reviewStatus: "reviewed"
    })
  ]);

  const restored = await reviewSourcePackageSnapshot("snapshot-archived", "restore_active", {
    reviewedBy: "admin@example.test",
    reviewNote: "Rollback to previous snapshot"
  }, client);

  assert.equal(restored.active, true);
  assert.equal(restored.reviewStatus, "pending");
  assert.equal(restored.reviewedAt, null);
  assert.equal(restored.reviewedBy, null);
  assert.equal(restored.reviewNote, null);
  assert.equal(client.rows.find(row => row.id === "snapshot-active").active, false);
  assert.equal(client.rows.find(row => row.id === "snapshot-active").status, "archived");
  assert.equal(client.rows.filter(row => row.active === true).length, 1);
  assert.equal(client.events.at(-1).action, "restore_active");
  assert.deepEqual(client.events.at(-1).metadata.displaced_snapshot_ids, ["snapshot-active"]);
});

test("recompute that moves snapshot back to pending clears reviewedAt, reviewedBy, and reviewNote while keeping history", async () => {
  const client = createFakeClient([
    snapshotFixture({
      reviewStatus: "reviewed",
      reviewedAt: new Date("2026-04-28T09:00:00.000Z"),
      reviewedBy: "admin@example.test",
      reviewNote: "Previously reviewed."
    })
  ]);

  const recomputed = await reviewSourcePackageSnapshot("snapshot-1", "recompute", {
    reviewedBy: "admin@example.test"
  }, client);

  assert.equal(recomputed.status, "needs_review");
  assert.equal(recomputed.reviewStatus, "pending");
  assert.equal(recomputed.reviewedAt, null);
  assert.equal(recomputed.reviewedBy, null);
  assert.equal(recomputed.reviewNote, null);
  assert.equal(client.events.at(-1).action, "recompute");
  assert.equal(client.events.at(-1).metadata.recomputed_status, "needs_review");
});

test("recompute does not keep fees and deadlines only snapshots pending", async () => {
  const client = createFakeClient([
    snapshotFixture({
      status: "needs_review",
      reviewStatus: "pending",
      missingSections: ["fees", "deadlines"],
      sourceMembership: [
        {
          source_id: "service-info",
          source_type: "kov_service_info",
          collection_id: "kov_services",
          municipality_id: "jogeva_vald",
          source_status: "active",
          historical: false,
          sections: ["description"],
          evidence_allowed: true
        }
      ]
    })
  ]);

  const recomputed = await reviewSourcePackageSnapshot("snapshot-1", "recompute", {
    reviewedBy: "admin@example.test"
  }, client);

  assert.equal(recomputed.status, "active");
  assert.equal(recomputed.reviewStatus, "reviewed");
  assert.equal(recomputed.reviewQueueSeverity, "info");
  assert.equal(recomputed.hasActionableReview, false);
});

test("accept_gap stores override metadata and prevents info-only gaps from returning pending on recompute", async () => {
  const client = createFakeClient([
    snapshotFixture({
      status: "active",
      missingSections: ["fees", "deadlines"],
      sourceMembership: [
        {
          source_id: "service-info",
          source_type: "kov_service_info",
          collection_id: "kov_services",
          municipality_id: "jogeva_vald",
          source_status: "active",
          historical: false,
          sections: ["description"],
          evidence_allowed: true
        }
      ]
    })
  ]);

  const accepted = await reviewSourcePackageSnapshot("snapshot-1", "accept_gap", {
    reviewedBy: "admin@example.test",
    acceptedReasonCode: "missing_fees",
    acceptedDisposition: "not_published",
    reviewNote: "KOV veebis tasu ei avaldata."
  }, client);

  assert.equal(accepted.reviewStatus, "reviewed");
  assert.equal(accepted.status, "active");
  assert.equal(accepted.acceptedReviewReasonCodes.includes("missing_fees"), true);
  assert.equal(client.events.at(-1).action, "accept_gap");
  assert.equal(client.events.at(-1).metadata.accepted_reason_code, "missing_fees");

  const recomputed = await reviewSourcePackageSnapshot("snapshot-1", "recompute", {
    reviewedBy: "admin@example.test"
  }, client);

  assert.equal(recomputed.status, "active");
  assert.equal(recomputed.reviewStatus, "reviewed");
});

test("recompute that stays reviewed keeps reviewedAt, reviewedBy, and reviewNote", async () => {
  const client = createFakeClient([
    snapshotFixture({
      status: "active",
      reviewStatus: "reviewed",
      reviewedAt: new Date("2026-04-28T09:00:00.000Z"),
      reviewedBy: "admin@example.test",
      reviewNote: "Previously reviewed.",
      missingSections: [],
      sourceMembership: [
        {
          source_id: "service-form",
          municipality_id: "jogeva_vald",
          source_status: "active",
          historical: false,
          sections: ["forms", "contacts", "legal_basis"],
          evidence_allowed: true
        }
      ]
    })
  ]);

  const recomputed = await reviewSourcePackageSnapshot("snapshot-1", "recompute", {
    reviewedBy: "new-admin@example.test",
    reviewNote: "Should not overwrite reviewed metadata when still reviewed."
  }, client);

  assert.equal(recomputed.status, "active");
  assert.equal(recomputed.reviewStatus, "reviewed");
  assert.equal(String(recomputed.reviewedAt), String(new Date("2026-04-28T09:00:00.000Z")));
  assert.equal(recomputed.reviewedBy, "admin@example.test");
  assert.equal(recomputed.reviewNote, "Previously reviewed.");
  assert.equal(client.events.at(-1).action, "recompute");
  assert.equal(client.events.at(-1).metadata.recomputed_status, "active");
});

test("getSourcePackageSnapshot returns safe history entries", async () => {
  const client = createFakeClient([snapshotFixture()], [
    {
      id: "event-1",
      snapshotId: "snapshot-1",
      packageId: "jogeva_vald_service_koduteenus_package",
      action: "mark_reviewed",
      actor: "admin@example.test",
      note: "Reviewed",
      fromStatus: "needs_review",
      toStatus: "needs_review",
      fromReviewStatus: "pending",
      toReviewStatus: "reviewed",
      fromActive: true,
      toActive: true,
      metadata: {
        hiddenPrompt: "must not exist in snapshot itself but event metadata is allowed when explicitly added"
      },
      createdAt: new Date("2026-04-28T11:00:00.000Z")
    }
  ]);

  const item = await getSourcePackageSnapshot("snapshot-1", client);

  assert.equal(item.id, "snapshot-1");
  assert.equal(Array.isArray(item.history), true);
  assert.equal(item.history.length, 1);
  assert.equal(item.history[0].action, "mark_reviewed");
});

test("computeSourcePackageReviewFlags detects package conflict and invalid current evidence", () => {
  const flags = computeSourcePackageReviewFlags(snapshotFixture({
    missingSections: ["fees", "deadlines"],
    sourceMembership: [
      {
        source_id: "service-info",
        municipality_id: "jogeva_vald",
        source_status: "active",
        historical: false,
        sections: ["description"],
        evidence_allowed: true
      },
      {
        source_id: "wrong-municipality",
        municipality_id: "tartu_linn",
        source_status: "archived",
        historical: true,
        sections: ["contacts"],
        evidence_allowed: false
      }
    ]
  }));

  assert.equal(flags.missing_fees, true);
  assert.equal(flags.missing_deadlines, true);
  assert.equal(flags.package_conflict, true);
  assert.equal(flags.invalid_current_evidence, true);
});

test("kov_legal collection is accepted for kov_regulation source membership", () => {
  const flags = computeSourcePackageReviewFlags(snapshotFixture({
    missingSections: [],
    sourceMembership: [
      {
        source_id: "harku-rt",
        source_type: "kov_regulation",
        collection_id: "kov_legal",
        municipality_id: "harku_vald",
        source_status: "active",
        historical: false,
        sections: ["legal_basis"],
        evidence_allowed: true
      }
    ]
  }));

  assert.equal(flags.wrong_collection_id, false);
});
