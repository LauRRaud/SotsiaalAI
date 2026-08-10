import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import { serviceProfileSaveNoticeKey } from "../../lib/privacy/serviceProfileSaveNotice.js";

/**
 * SOL-SPROF-02 — „Route/UI peab näitama ausat pending/failed olekut."
 *
 * Server kirjutab `pending_removal`, kui kaugkoopia kustutus on veel kinnitamata.
 * Kui liides ütleb sel hetkel tingimusteta „salvestati", arvab kasutaja, et
 * nõusoleku tagasivõtmine on jõustunud, kuigi see alles käib.
 */

test("kinnitamata eemaldus annab ausa pending-teate", () => {
  const notice = serviceProfileSaveNoticeKey({ ragMetadata: { syncStatus: "pending_removal" } });
  assert.equal(notice.key, "workspace_feature_pages.service_profile.save_success_removal_pending");
});

test("sünkroonimise tõrge ei peitu eduteate taha", () => {
  const notice = serviceProfileSaveNoticeKey({ ragMetadata: { syncStatus: "failed" } });
  assert.equal(notice.key, "workspace_feature_pages.service_profile.save_success_assistant_sync_failed");
});

test("kinnitatud eemaldus ja tavaline salvestus annavad tavalise eduteate", () => {
  for (const syncStatus of ["removed", "synced", "skipped", "", undefined]) {
    const notice = serviceProfileSaveNoticeKey({ ragMetadata: { syncStatus } });
    assert.equal(
      notice.key,
      "workspace_feature_pages.service_profile.save_success",
      `syncStatus=${String(syncStatus)}`
    );
  }
  assert.equal(
    serviceProfileSaveNoticeKey(null).key,
    "workspace_feature_pages.service_profile.save_success"
  );
});

/* Varutekst on liidese viimane kaitse, aga tema koht ei ole sõnastik: kui võti
   sõnastikest puudu on, näeb kasutaja eestikeelset teksti ka vene liideses. */
test("iga teate võti on kõigis kolmes sõnastikus olemas", () => {
  const keys = [
    serviceProfileSaveNoticeKey({ ragMetadata: { syncStatus: "pending_removal" } }).key,
    serviceProfileSaveNoticeKey({ ragMetadata: { syncStatus: "failed" } }).key,
    serviceProfileSaveNoticeKey(null).key
  ];
  for (const locale of ["et", "en", "ru"]) {
    const messages = JSON.parse(fs.readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));
    for (const key of keys) {
      const value = key.split(".").reduce((node, part) => (node == null ? node : node[part]), messages);
      assert.equal(typeof value, "string", `${locale}: ${key}`);
      assert.ok(value.trim(), `${locale}: ${key} on tühi`);
    }
  }
});
