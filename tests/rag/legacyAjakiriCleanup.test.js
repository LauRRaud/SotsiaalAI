import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAjakiriRemovalPlan,
  buildLegacyAjakiriCleanupPlan,
  extractAjakiriYear,
  isLegacyAjakiriFileDocument,
  normalizeAjakiriTitle
} from "../../lib/rag/legacyAjakiriCleanup.js";

test("normalizes ajakiri titles for duplicate matching", () => {
  assert.equal(
    normalizeAjakiriTitle("Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid"),
    "tehisintellekt sotsiaaltoos praktika kaalutlused ja vaartuspohised piirid"
  );
});

test("detects legacy ajakiri file documents but not article ingest documents", () => {
  assert.equal(isLegacyAjakiriFileDocument({
    docId: "sotsiaaltoo-2-2025-old",
    title: "Artikkel",
    type: "FILE",
    source_type: "file",
    source_file_type: "unknown",
    collection_family: "ajakiri_sotsiaaltoo"
  }), true);

  assert.equal(isLegacyAjakiriFileDocument({
    docId: "sotsiaaltoo-2-2025-new",
    title: "Artikkel",
    source_type: "journal_article",
    source_file_type: "article_ingest",
    collection_family: "ajakiri_sotsiaaltoo"
  }), false);

  assert.equal(isLegacyAjakiriFileDocument({
    docId: "kov-tartu-koduteenus",
    title: "Koduteenus",
    type: "FILE",
    source_type: "file",
    collection_family: "kov_web"
  }), false);
});

test("extracts year from explicit year or document identity", () => {
  assert.equal(extractAjakiriYear({ year: "2025" }), 2025);
  assert.equal(extractAjakiriYear({ docId: "sotsiaaltoo-1-2023-hooldekodude-rahastamine" }), 2023);
});

test("builds safe delete_duplicate plan when article ingest replacement exists", () => {
  const plan = buildLegacyAjakiriCleanupPlan([
    {
      docId: "sotsiaaltoo-2-2025-tehisintellekt-old",
      title: "Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid",
      source_type: "file",
      source_file_type: "unknown",
      collection_family: "ajakiri_sotsiaaltoo"
    },
    {
      docId: "sotsiaaltoo-2-2025-artikkel-12-tehisintellekt-sotsiaaltoos",
      source_id: "sotsiaaltoo-2-2025-artikkel-12-tehisintellekt-sotsiaaltoos",
      title: "Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid",
      year: 2025,
      source_type: "journal_article",
      source_file_type: "article_ingest",
      collection_family: "ajakiri_sotsiaaltoo"
    }
  ]);

  assert.equal(plan.summary.article_ingest_documents, 1);
  assert.equal(plan.summary.legacy_ajakiri_file_documents, 1);
  assert.equal(plan.summary.delete_duplicate, 1);
  assert.equal(plan.actions[0].action, "delete_duplicate");
  assert.equal(plan.actions[0].replacement_doc_id, "sotsiaaltoo-2-2025-artikkel-12-tehisintellekt-sotsiaaltoos");
  assert.equal(plan.actions[0].match_reason, "normalized_title_and_year");
});

test("marks unmatched legacy ajakiri files for review instead of deletion", () => {
  const plan = buildLegacyAjakiriCleanupPlan([
    {
      docId: "sotsiaaltoo-1-2021-old-only",
      title: "Pikaajaline hooldus Sloveenias: probleemid ja tulevikusuunad",
      source_type: "file",
      source_file_type: "unknown",
      collection_family: "ajakiri_sotsiaaltoo"
    }
  ]);

  assert.equal(plan.summary.delete_duplicate || 0, 0);
  assert.equal(plan.summary.review_legacy, 1);
  assert.equal(plan.actions[0].action, "review_legacy");
  assert.equal(plan.actions[0].reason, "replacement_not_found");
});

test("keeps ambiguous replacements in review", () => {
  const title = "Sama pealkiri";
  const plan = buildLegacyAjakiriCleanupPlan([
    {
      docId: "sotsiaaltoo-old-2024",
      title,
      source_type: "file",
      source_file_type: "unknown",
      collection_family: "ajakiri_sotsiaaltoo"
    },
    {
      docId: "sotsiaaltoo-new-2023",
      title,
      year: 2023,
      source_type: "journal_article",
      source_file_type: "article_ingest",
      collection_family: "ajakiri_sotsiaaltoo"
    },
    {
      docId: "sotsiaaltoo-new-2025",
      title,
      year: 2025,
      source_type: "journal_article",
      source_file_type: "article_ingest",
      collection_family: "ajakiri_sotsiaaltoo"
    }
  ]);

  assert.equal(plan.summary.delete_duplicate || 0, 0);
  assert.equal(plan.summary.review_legacy, 1);
  assert.equal(plan.actions[0].reason, "ambiguous_replacement");
  assert.equal(plan.actions[0].replacement_candidates.length, 2);
});

test("uses approved manual mappings for legacy subarticle records covered by combined articles", () => {
  const plan = buildLegacyAjakiriCleanupPlan([
    {
      docId: "sotsiaaltoo-3-2022-mida-sotsiaaltootaja-saab-teha-enda-heaks-meelespea-2022-3",
      title: "Mida sotsiaaltöötaja saab teha enda heaks – meelespea",
      source_type: "file",
      source_file_type: "unknown",
      collection_family: "ajakiri_sotsiaaltoo"
    },
    {
      docId: "sotsiaaltoo-3-2022-ole-iseenda-terapeut-koos-meelespeaga-2022-3",
      title: "Ole iseenda terapeut!",
      year: 2022,
      source_type: "journal_article",
      source_file_type: "article_ingest",
      collection_family: "ajakiri_sotsiaaltoo"
    }
  ]);

  assert.equal(plan.summary.delete_duplicate, 1);
  assert.equal(plan.actions[0].action, "delete_duplicate");
  assert.equal(plan.actions[0].reason, "covered_by_combined_article");
  assert.equal(plan.actions[0].match_reason, "manual_covered_by_combined_article");
  assert.equal(plan.actions[0].replacement_doc_id, "sotsiaaltoo-3-2022-ole-iseenda-terapeut-koos-meelespeaga-2022-3");
});

test("keeps manual mappings in review when replacement is missing", () => {
  const plan = buildLegacyAjakiriCleanupPlan([
    {
      docId: "sotsiaaltoo-1-2023-hooldekodude-rahastamise-reform-tahendab-kolossaalset-muutust-2023-1",
      title: "Hooldekodude rahastamise reform tähendab kolossaalset muutust",
      source_type: "file",
      source_file_type: "unknown",
      collection_family: "ajakiri_sotsiaaltoo"
    }
  ]);

  assert.equal(plan.summary.delete_duplicate || 0, 0);
  assert.equal(plan.summary.review_legacy, 1);
  assert.equal(plan.actions[0].reason, "manual_replacement_not_found");
  assert.equal(plan.actions[0].expected_replacement_doc_id, "sotsiaaltoo-1-2023-hooldekodude-rahastamise-pohimotted-ja-kommentaar-2023-1");
});

test("builds removal plan for all ajakiri documents only", () => {
  const plan = buildAjakiriRemovalPlan([
    {
      docId: "sotsiaaltoo-2-2025-artikkel-12-tehisintellekt-sotsiaaltoos",
      title: "Tehisintellekt sotsiaaltĆ¶Ć¶s",
      source_type: "journal_article",
      source_file_type: "article_ingest",
      collection_family: "ajakiri_sotsiaaltoo"
    },
    {
      docId: "legacy-sotsiaaltoo-file",
      title: "Vana ajakirja fail",
      source_type: "file",
      source_file_type: "unknown",
      collection_id: "sotsiaaltoo_articles"
    },
    {
      docId: "jogeva-vald-koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info",
      collection_family: "kov_web"
    }
  ]);

  assert.equal(plan.summary.total_documents, 3);
  assert.equal(plan.summary.ajakiri_documents, 2);
  assert.equal(plan.summary.by_source_type.journal_article, 1);
  assert.equal(plan.summary.by_source_type.file, 1);
  assert.deepEqual(plan.actions.map(item => item.doc_id), [
    "legacy-sotsiaaltoo-file",
    "sotsiaaltoo-2-2025-artikkel-12-tehisintellekt-sotsiaaltoos"
  ]);
  assert.equal(plan.actions.every(item => item.action === "delete_ajakiri_document"), true);
});
