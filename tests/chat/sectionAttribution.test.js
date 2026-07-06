import test from "node:test";
import assert from "node:assert/strict";

import {
  allowedSectionAttributionSourceIds,
  buildSectionAttribution
} from "../../lib/chat/sectionAttribution.js";

function packageFixture(overrides = {}) {
  return {
    package_id: "jogeva_vald_service_koduteenus_package",
    canonical_item_id: "jogeva_vald_service_koduteenus",
    package_type: "kov_service",
    municipality_id: "jogeva_vald",
    sections: {
      description: [
        {
          source_id: "service-info",
          source_type: "kov_service_info",
          source_status: "active",
          historical: false,
          evidenceText: "This long source excerpt must not appear."
        }
      ],
      eligibility: [
        {
          source_id: "service-info",
          source_type: "kov_service_info",
          source_status: "active",
          historical: false
        }
      ],
      application: [
        {
          source_id: "service-info",
          source_type: "kov_service_info",
          source_status: "active",
          historical: false
        }
      ],
      forms: [],
      contacts: [],
      legal_basis: [],
      fees: [],
      deadlines: []
    },
    missing_sections: ["forms", "contacts", "legal_basis", "fees", "deadlines"],
    ...overrides
  };
}

function section(result, name) {
  return result.section_attribution.find(entry => entry.section === name);
}

test("confirmed service sections get strong section attribution", () => {
  const result = buildSectionAttribution({
    sourcePackages: [packageFixture()],
    packageAwareAnswering: { used: true },
    ragRiskPolicy: { riskLevel: "medium" },
    queryPlan: { selection_strategy: "mmr_diversity" }
  });

  assert.equal(result.package_attribution_checked, true);
  assert.equal(section(result, "description").evidence_strength, "strong");
  assert.deepEqual(section(result, "description").evidence_statuses, ["confirmed"]);
  assert.deepEqual(section(result, "eligibility").source_ids, ["service-info"]);
  assert.deepEqual(section(result, "application").source_ids, ["service-info"]);
});

test("missing high-risk sections are deterministic missing_section entries", () => {
  const result = buildSectionAttribution({
    sourcePackages: [packageFixture()],
    packageAwareAnswering: { used: true },
    queryPlan: {}
  });

  for (const name of ["forms", "contacts", "legal_basis", "fees", "deadlines"]) {
    const entry = section(result, name);
    assert.deepEqual(entry.source_ids, []);
    assert.equal(entry.evidence_strength, "missing");
    assert.deepEqual(entry.evidence_statuses, ["missing_section"]);
  }
});

test("journal_article cannot confirm current forms, contacts, legal_basis, fees, or deadlines", () => {
  const result = buildSectionAttribution({
    sourcePackages: [
      packageFixture({
        sections: {
          ...packageFixture().sections,
          forms: [{ source_id: "journal", source_type: "journal_article", source_status: "active" }],
          contacts: [{ source_id: "journal", source_type: "journal_article", source_status: "active" }],
          legal_basis: [{ source_id: "journal", source_type: "journal_article", source_status: "active" }],
          fees: [{ source_id: "journal", source_type: "journal_article", source_status: "active" }],
          deadlines: [{ source_id: "journal", source_type: "journal_article", source_status: "active" }]
        }
      })
    ],
    packageAwareAnswering: { used: true }
  });

  for (const name of ["forms", "contacts", "legal_basis", "fees", "deadlines"]) {
    const entry = section(result, name);
    assert.equal(entry.evidence_strength, "unsupported");
    assert.equal(entry.evidence_statuses.includes("wrong_source_type"), true);
    assert.equal(entry.evidence_statuses.includes("disallowed_evidence_role"), true);
  }
});

test("historical or inactive source cannot confirm current evidence", () => {
  const result = buildSectionAttribution({
    sourcePackages: [
      packageFixture({
        sections: {
          ...packageFixture().sections,
          forms: [{ source_id: "form", source_type: "application_form", source_status: "inactive" }],
          contacts: [{ source_id: "contact", source_type: "official_contact", source_status: "active", historical: true }],
          legal_basis: [{ source_id: "reg", source_type: "kov_regulation", source_status: "archived" }]
        }
      })
    ],
    packageAwareAnswering: { used: true }
  });

  for (const name of ["forms", "contacts", "legal_basis"]) {
    const entry = section(result, name);
    assert.equal(entry.evidence_strength, "unsupported");
    assert.equal(entry.evidence_statuses.includes("stale_or_historical"), true);
  }
});

test("partial KOV regulation association stays partial in section attribution", () => {
  const result = buildSectionAttribution({
    sourcePackages: [
      packageFixture({
        sections: {
          ...packageFixture().sections,
          legal_basis: [
            {
              source_id: "jogeva-regulation",
              source_type: "kov_regulation",
              source_status: "active",
              historical: false,
              evidence_strength: "partial"
            }
          ]
        }
      })
    ],
    packageAwareAnswering: { used: true }
  });

  const entry = section(result, "legal_basis");
  assert.deepEqual(entry.source_ids, ["jogeva-regulation"]);
  assert.equal(entry.evidence_strength, "partial");
  assert.deepEqual(entry.evidence_statuses, ["weak_or_indirect_section"]);
});

test("service page can partially confirm forms and contacts when section signals are present", () => {
  const result = buildSectionAttribution({
    sourcePackages: [
      packageFixture({
        sections: {
          ...packageFixture().sections,
          forms: [{ source_id: "service-info", source_type: "kov_service_info", source_status: "active", evidence_strength: "partial" }],
          contacts: [{ source_id: "service-info", source_type: "kov_service_info", source_status: "active", evidence_strength: "partial" }]
        },
        missing_sections: ["legal_basis", "fees", "deadlines"]
      })
    ],
    packageAwareAnswering: { used: true }
  });

  assert.equal(section(result, "forms").evidence_strength, "partial");
  assert.deepEqual(section(result, "forms").evidence_statuses, ["weak_or_indirect_section"]);
  assert.equal(section(result, "contacts").evidence_strength, "partial");
  assert.deepEqual(section(result, "contacts").evidence_statuses, ["weak_or_indirect_section"]);
});

test("legal exact query opts out of SourcePackage section attribution", () => {
  const result = buildSectionAttribution({
    sourcePackages: [packageFixture()],
    packageAwareAnswering: { used: true },
    ragRiskPolicy: { riskLevel: "high" },
    queryPlan: {
      selection_strategy: "legal_exact",
      legalLookupPlan: { enabled: true, mode: "explicit_paragraph" }
    }
  });

  assert.equal(result.package_attribution_checked, false);
  assert.equal(result.high_risk_attribution_checked, false);
  assert.deepEqual(result.section_attribution, []);
  assert.deepEqual(result.attribution_flags, ["legal_exact_opt_out"]);
});

test("trace payload is compact and does not include prompt, user text, reply text, or excerpts", () => {
  const result = buildSectionAttribution({
    sourcePackages: [packageFixture()],
    packageAwareAnswering: { used: true }
  });
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes("This long source excerpt"), false);
  assert.equal(serialized.includes("prompt"), false);
  assert.equal(serialized.includes("userMessage"), false);
  assert.equal(serialized.includes("reply text"), false);
});

test("allowedSectionAttributionSourceIds keeps usable section source ids but missing sections hide nothing globally", () => {
  const result = buildSectionAttribution({
    sourcePackages: [packageFixture()],
    packageAwareAnswering: { used: true }
  });

  assert.deepEqual(allowedSectionAttributionSourceIds(result.section_attribution), ["service-info"]);
  assert.equal(section(result, "forms").source_ids.length, 0);
  assert.equal(result.section_attribution.every(entry => Array.isArray(entry.evidence_statuses)), true);
});
