import test from "node:test";
import assert from "node:assert/strict";

import {
  buildJogevaFormsContactsAudit,
  normalizeJogevaCanonicalItemId
} from "../../lib/admin/rag/sourcePackages/formsContactsAudit.js";

function baseInput(overrides = {}) {
  return {
    municipalityId: "jogeva_vald",
    localData: {
      items: [
        {
          id: "jogeva_vald_service_koduteenus",
          itemType: "service",
          title: "Koduteenus",
          summary: "Koduteenus toetab kodus hakkamasaamist.",
          application: "Taotlus esitatakse vallale.",
          relatedForms: [],
          relatedContacts: []
        }
      ]
    },
    localSourcesData: {
      sources: []
    },
    registry: {
      documents: []
    },
    snapshots: [],
    ...overrides
  };
}

function service(overrides = {}) {
  return {
    id: "jogeva_vald_service_koduteenus",
    itemType: "service",
    title: "Koduteenus",
    summary: "Koduteenus toetab kodus hakkamasaamist.",
    application: "Taotlus esitatakse vallale.",
    relatedForms: [],
    relatedContacts: [],
    ...overrides
  };
}

test("registry candidate without relation is reported distinctly", () => {
  const report = buildJogevaFormsContactsAudit(baseInput({
    registry: {
      documents: [
        {
          source_id: "jogeva_vald_form_sotsiaalabi_taotlus",
          source_type: "application_form",
          municipality_id: "jogeva_vald",
          title: "Sotsiaalabi taotlus"
        }
      ]
    }
  }));

  assert.equal(report.services[0].forms.reason, "registry_candidate_without_relation");
  assert.deepEqual(report.services[0].forms.registry_candidate_ids, ["jogeva_vald_form_sotsiaalabi_taotlus"]);
});

test("relation exists but source is not indexed is reported distinctly", () => {
  const report = buildJogevaFormsContactsAudit(baseInput({
    localData: {
      items: [
        service({ relatedForms: ["jogeva_vald_form_sotsiaalabi_taotlus"] }),
        {
          id: "jogeva_vald_form_sotsiaalabi_taotlus",
          itemType: "form",
          title: "Sotsiaalabi taotlus",
          sourceKeys: ["sotsiaalabi_taotlus_pdf"]
        }
      ]
    },
    localSourcesData: {
      sources: []
    },
    registry: {
      documents: []
    }
  }));

  assert.equal(report.services[0].forms.reason, "relation_exists_but_not_indexed");
  assert.deepEqual(report.services[0].forms.related_ids, ["jogeva_vald_form_sotsiaalabi_taotlus"]);
  assert.deepEqual(report.services[0].forms.candidate_source_ids, []);
});

test("service page contact-like metadata without extracted contact source is reported", () => {
  const report = buildJogevaFormsContactsAudit(baseInput({
    localData: {
      items: [
        service({
          application: "Lisainfo telefonil 776 6520 või e-post sotsiaal@jogeva.ee."
        })
      ]
    }
  }));

  assert.equal(report.services[0].contacts.reason, "service_page_contains_contact_but_not_extracted");
  assert.equal(report.services[0].contacts.signals.has_contact_reference, true);
});

test("no candidate is reported when there is no relation, source, or embedded signal", () => {
  const report = buildJogevaFormsContactsAudit(baseInput({
    localData: {
      items: [
        service({
          summary: "Teenuse kirjeldus.",
          application: "Pöördu vallavalitsuse poole."
        })
      ]
    }
  }));

  assert.equal(report.services[0].forms.reason, "no_registry_candidate");
});

test("metadata type issue is reported when related candidate has wrong source type", () => {
  const report = buildJogevaFormsContactsAudit(baseInput({
    localData: {
      items: [
        service({ relatedContacts: ["jogeva_vald_contact_eve_viks"] }),
        {
          id: "jogeva_vald_contact_eve_viks",
          itemType: "contact",
          title: "Eve Viks",
          sourceKeys: ["eve_viks"]
        }
      ]
    },
    localSourcesData: {
      sources: [
        {
          key: "eve_viks",
          source_id: "jogeva_vald_contact_eve_viks",
          source_type: "kov_service_info",
          municipality_id: "jogeva_vald"
        }
      ]
    }
  }));

  assert.equal(report.services[0].contacts.reason, "metadata_type_missing");
  assert.deepEqual(report.services[0].contacts.metadata_issue_source_ids, ["jogeva_vald_contact_eve_viks"]);
});

test("output stays compact and does not expose long excerpts or prompt text", () => {
  const longText = "x".repeat(500);
  const report = buildJogevaFormsContactsAudit(baseInput({
    localData: {
      items: [
        service({
          summary: longText,
          prompt: "hidden prompt",
          userMessage: "hidden user text"
        })
      ]
    },
    registry: {
      documents: [
        {
          source_id: "form-source",
          source_type: "application_form",
          municipality_id: "jogeva_vald",
          title: longText,
          excerpt: longText,
          prompt: "hidden prompt",
          userMessage: "hidden user text"
        }
      ]
    }
  }));
  const serialized = JSON.stringify(report);

  assert.equal(report.safe_output, true);
  assert.equal(serialized.includes(longText), false);
  assert.equal(serialized.includes("hidden prompt"), false);
  assert.equal(serialized.includes("hidden user text"), false);
});

test("double-prefixed SourcePackage canonicalItemId matches repo item id", () => {
  const report = buildJogevaFormsContactsAudit(baseInput({
    snapshots: [
      {
        packageId: "jogeva_vald_service_jogeva_vald_service_koduteenus_package",
        canonicalItemId: "jogeva_vald_service_jogeva_vald_service_koduteenus",
        sectionSummary: {},
        sourceMembership: []
      }
    ]
  }));

  assert.equal(normalizeJogevaCanonicalItemId("jogeva_vald_service_jogeva_vald_service_koduteenus"), "jogeva_vald_service_koduteenus");
  assert.equal(report.summary.active_snapshot_count, 1);
  assert.equal(report.summary.services_audited, 1);
  assert.equal(report.services[0].package_id, "jogeva_vald_service_jogeva_vald_service_koduteenus_package");
});

test("report exposes local path diagnostics", () => {
  const report = buildJogevaFormsContactsAudit(baseInput({
    localJsonFound: true,
    localDataSourcePath: "C:/repo/KOV/Jogeva/jogeva-vald/jogeva-vald.json",
    checkedPaths: {
      root: "C:/repo/KOV/Jogeva/jogeva-vald",
      localData: "C:/repo/KOV/Jogeva/jogeva-vald/jogeva-vald.json"
    }
  }));

  assert.equal(report.localJsonFound, true);
  assert.equal(report.localDataSourcePath.endsWith("jogeva-vald.json"), true);
  assert.equal(report.checkedPaths.localData.endsWith("jogeva-vald.json"), true);
  assert.equal(typeof report.recommended_next_step, "string");
});
