import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSectionAttributionSummary,
  buildSourcePackageGapItem,
  buildSourcePackageGapReport
} from "../../lib/admin/rag/sourcePackages/gapReport.js";

function snapshotFixture(overrides = {}) {
  return {
    packageId: "jogeva_vald_service_koduteenus_package",
    canonicalItemId: "jogeva_vald_service_koduteenus",
    municipalityId: "jogeva_vald",
    packageType: "kov_service",
    title: "Koduteenus",
    status: "needs_review",
    reviewStatus: "pending",
    missingSections: ["forms", "contacts", "legal_basis"],
    sectionSummary: {
      description: {
        count: 1,
        source_ids: ["service-info"],
        excerpt: "This long excerpt must not appear."
      },
      forms: {
        count: 0,
        source_ids: []
      }
    },
    sourceMembership: [
      {
        source_id: "service-info",
        source_type: "kov_service_info",
        resource_type: "service_page",
        item_type: "service",
        municipality_id: "jogeva_vald",
        source_status: "active",
        historical: false,
        sections: ["description", "application"],
        evidenceText: "Long source excerpt must not appear.",
        prompt: "Hidden prompt",
        userMessage: "Hidden user text"
      }
    ],
    ...overrides
  };
}

test("missing section receives a gap reason", () => {
  const item = buildSourcePackageGapItem(snapshotFixture());

  assert.equal(item.gaps.forms.status, "missing");
  assert.equal(typeof item.gaps.forms.likelyReason, "string");
});

test("candidate source with allowed evidence role makes missing section mapping_missing", () => {
  const item = buildSourcePackageGapItem(snapshotFixture(), {
    candidateSources: [
      {
        canonical_item_id: "jogeva_vald_service_koduteenus",
        section: "forms",
        source_id: "form-source",
        source_type: "application_form",
        item_type: "form",
        municipality_id: "jogeva_vald",
        source_status: "active"
      }
    ]
  });

  assert.equal(item.gaps.forms.likelyReason, "mapping_missing");
  assert.deepEqual(item.gaps.forms.candidate_source_ids, ["form-source"]);
});

test("candidate source with wrong source type makes source_type_mismatch", () => {
  const item = buildSourcePackageGapItem(snapshotFixture(), {
    candidateSources: [
      {
        canonical_item_id: "jogeva_vald_service_koduteenus",
        section: "legal_basis",
        source_id: "service-info",
        source_type: "kov_service_info",
        municipality_id: "jogeva_vald",
        source_status: "active"
      }
    ]
  });

  assert.equal(item.gaps.legal_basis.likelyReason, "source_type_mismatch");
  assert.deepEqual(item.gaps.legal_basis.candidate_source_ids, ["service-info"]);
});

test("missing section without candidate source is input_missing", () => {
  const item = buildSourcePackageGapItem(snapshotFixture());

  assert.equal(item.gaps.forms.likelyReason, "input_missing");
  assert.deepEqual(item.gaps.forms.candidate_source_ids, []);
});

test("existing section is marked present", () => {
  const item = buildSourcePackageGapItem(snapshotFixture({
    sectionSummary: {
      forms: {
        count: 1,
        source_ids: ["form-source"]
      }
    },
    sourceMembership: [
      {
        source_id: "form-source",
        source_type: "application_form",
        source_status: "active",
        historical: false,
        sections: ["forms"]
      }
    ]
  }));

  assert.equal(item.gaps.forms.status, "present");
  assert.deepEqual(item.gaps.forms.sourceIds, ["form-source"]);
});

test("legal_basis gap is present after KOV regulation joins package", () => {
  const item = buildSourcePackageGapItem(snapshotFixture({
    missingSections: ["forms", "contacts"],
    sectionSummary: {
      legal_basis: {
        count: 1,
        source_ids: ["jogeva-vald-rt-406112024020"]
      }
    },
    sourceMembership: [
      {
        source_id: "service-info",
        source_type: "kov_service_info",
        source_status: "active",
        historical: false,
        sections: ["description", "application"]
      },
      {
        source_id: "jogeva-vald-rt-406112024020",
        source_type: "kov_regulation",
        municipality_id: "jogeva_vald",
        source_status: "active",
        historical: false,
        evidence_strength: "partial",
        sections: ["legal_basis"]
      }
    ]
  }), {
    candidateSources: [
      {
        section: "legal_basis",
        source_id: "jogeva-vald-rt-406112024020",
        source_type: "kov_regulation",
        municipality_id: "jogeva_vald",
        global_current_evidence: true
      }
    ]
  });

  assert.equal(item.gaps.legal_basis.status, "present");
  assert.deepEqual(item.gaps.legal_basis.sourceIds, ["jogeva-vald-rt-406112024020"]);
  assert.equal(item.gaps.forms.likelyReason, "input_missing");
  assert.equal(item.gaps.contacts.likelyReason, "input_missing");
});

test("section attribution summary is safe and compact", () => {
  const summary = buildSectionAttributionSummary(snapshotFixture());
  const report = buildSourcePackageGapReport([snapshotFixture()]);
  const serialized = JSON.stringify({ summary, report });

  assert.equal(summary.forms.evidence_strength, "missing");
  assert.deepEqual(summary.forms.evidence_statuses, ["missing_section"]);
  assert.equal(serialized.includes("Long source excerpt"), false);
  assert.equal(serialized.includes("Hidden prompt"), false);
  assert.equal(serialized.includes("Hidden user text"), false);
});
