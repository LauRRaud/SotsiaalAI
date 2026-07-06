import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  upgradeKovBundle,
  validateKovBundle
} from "../../scripts/kovMetadataUpgradeLib.mjs";

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createLegacyBundle(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kov-metadata-upgrade-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const slug = "kuusalu-vald";
  const dir = path.join(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, `${slug}.sources.json`), {
    checkedAt: "2026-05-02",
    sources: [
      {
        source_id: "koduteenus_page",
        title: "Koduteenus",
        url: "https://www.kuusalu.ee/koduteenus",
        source_type: "kov_service_page"
      },
      {
        source_id: "taotlusvorm_docx",
        title: "Koduteenuse taotlusvorm",
        url: "https://www.kuusalu.ee/koduteenus.docx",
        source_type: "web_form"
      }
    ]
  });
  writeJson(path.join(dir, `${slug}.json`), {
    checkedAt: "2026-05-02",
    items: [
      {
        id: "kuusalu_vald_service_koduteenus",
        itemType: "service",
        title: "Koduteenus",
        sourceKeys: ["koduteenus_page"],
        officialUrl: "https://www.kuusalu.ee/koduteenus",
        relatedForms: ["kuusalu_vald_form_koduteenuse_taotlus"],
        relatedContacts: []
      },
      {
        id: "kuusalu_vald_form_koduteenuse_taotlus",
        itemType: "form",
        title: "Koduteenuse taotlusvorm",
        sourceKeys: ["taotlusvorm_docx"],
        officialUrl: "https://www.kuusalu.ee/koduteenus.docx"
      }
    ]
  });
  writeJson(path.join(dir, `${slug}.meta.json`), {
    checkedAt: "2026-05-02",
    coverage: {}
  });
  fs.writeFileSync(path.join(dir, `${slug}.rag.md`), "# Kuusalu vald\n", "utf8");

  return {
    root,
    entry: {
      slug,
      municipality_id: "kuusalu_vald",
      municipality_name: "Kuusalu vald",
      county: "Harjumaa"
    }
  };
}

test("metadata upgrade preserves source_id as source_key and normalizes legacy KOV page type", t => {
  const { root, entry } = createLegacyBundle(t);

  const result = upgradeKovBundle(entry, { root });
  const serviceSource = result.sources.sources.find(source => source.source_id === "koduteenus_page");
  const formSource = result.sources.sources.find(source => source.source_id === "taotlusvorm_docx");
  const serviceItem = result.data.items.find(item => item.id === "kuusalu_vald_service_koduteenus");

  assert.equal(serviceSource.source_key, "koduteenus_page");
  assert.equal(serviceSource.source_type, "kov_service_info");
  assert.equal(serviceSource.resource_type, "service_page");
  assert.equal(serviceSource.municipality_id, "kuusalu_vald");
  assert.deepEqual(serviceSource.sections_present, ["description", "eligibility", "application"]);
  assert.equal(formSource.source_key, "taotlusvorm_docx");
  assert.equal(formSource.source_type, "web_form");
  assert.equal(formSource.resource_type, "form");
  assert.deepEqual(serviceItem.source_keys, ["koduteenus_page"]);
});

test("upgraded legacy bundle validates after writing upgraded metadata", t => {
  const { root, entry } = createLegacyBundle(t);
  const result = upgradeKovBundle(entry, { root });
  const dir = path.join(root, entry.slug);

  writeJson(path.join(dir, `${entry.slug}.sources.json`), result.sources);
  writeJson(path.join(dir, `${entry.slug}.json`), result.data);
  writeJson(path.join(dir, `${entry.slug}.meta.json`), result.meta);

  const validation = validateKovBundle(entry, { root });
  assert.equal(validation.ok, true, validation.errors.join("\n"));
});
