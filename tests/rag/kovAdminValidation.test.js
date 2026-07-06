import assert from "node:assert/strict";
import test from "node:test";

import { validateKovFileContent } from "../../lib/admin/rag/kov/validation.js";

function validateSources(payload) {
  return validateKovFileContent({
    fileKey: "sourcesJson",
    text: JSON.stringify(payload),
    slug: "test-vald",
    displayName: "Test vald"
  });
}

test("KOV admin sources validation accepts v2.5 source_id/source_type shape", () => {
  const result = validateSources({
    municipality: "Test vald",
    checkedAt: "2026-04-29",
    sources: [
      {
        source_id: "home",
        source_type: "kov_homepage",
        title: "Test valla ametlik veeb",
        url: "https://example.test"
      },
      {
        source_id: "form_doc",
        source_type: "docx_form",
        title: "Taotlus",
        url_canonical: "https://example.test/form.docx"
      }
    ]
  });

  assert.equal(result.validationStatus, "VALID");
});

test("KOV admin sources validation still accepts legacy key/type shape", () => {
  const result = validateSources({
    municipality: "Test vald",
    checkedAt: "2026-04-29",
    sources: [
      {
        key: "service_page",
        type: "kov_service_info",
        title: "Teenused",
        url: "https://example.test/services"
      }
    ]
  });

  assert.equal(result.validationStatus, "VALID");
});

test("KOV admin sources validation rejects sources without identifier", () => {
  const result = validateSources({
    municipality: "Test vald",
    checkedAt: "2026-04-29",
    sources: [
      {
        source_type: "kov_homepage",
        title: "Test valla ametlik veeb",
        url: "https://example.test"
      }
    ]
  });

  assert.equal(result.validationStatus, "INVALID");
  assert.match(result.validationMessage, /source id/i);
});

test("KOV admin data validation accepts v2.5 item_type and source_keys aliases", () => {
  const result = validateKovFileContent({
    fileKey: "dataJson",
    text: JSON.stringify({
      municipality: "Test vald",
      items: [
        {
          id: "test_vald_service_koduteenus",
          item_type: "service",
          title: "Koduteenus",
          source_keys: ["koduteenus_page"]
        }
      ]
    }),
    slug: "test-vald",
    displayName: "Test vald"
  });

  assert.equal(result.validationStatus, "VALID");
});

test("KOV admin meta validation accepts v2.5 source package shape without legacy notes", () => {
  const result = validateKovFileContent({
    fileKey: "metaJson",
    text: JSON.stringify({
      schemaVersion: "kov-meta-v2.5-sourcepackage",
      municipality: "Test vald",
      municipality_id: "test_vald",
      collection_id: "kov_services",
      sourcePackageReadiness: {
        ok: true
      }
    }),
    slug: "test-vald",
    displayName: "Test vald"
  });

  assert.equal(result.validationStatus, "VALID");
});

test("KOV admin meta validation rejects mismatched municipality", () => {
  const result = validateKovFileContent({
    fileKey: "metaJson",
    text: JSON.stringify({
      schemaVersion: "kov-meta-v2.5-sourcepackage",
      municipality: "Märjamaa vald",
      municipality_id: "marjamaa_vald",
      collection_id: "kov_services",
      sourcePackageReadiness: {
        ok: true
      }
    }),
    slug: "maardu-linn",
    displayName: "Maardu linn"
  });

  assert.equal(result.validationStatus, "INVALID");
  assert.match(result.validationMessage, /Municipality does not match/i);
});
