import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRagMetadataBackfillPlan,
  planRagMetadataBackfillForSource
} from "../../lib/rag/metadataBackfillPlan.js";
import { RAG_METADATA_SCHEMA_VERSION } from "../../lib/rag/sourceMetadata.js";

const kovContext = {
  collectionFamily: "kov_web",
  filePath: "KOV/Jogeva/jogeva-vald/jogeva-vald.sources.json",
  slug: "jogeva-vald",
  root: {
    id: "jogeva-vald",
    municipality: "Jogeva vald",
    checkedAt: "2026-04-11"
  }
};

test("plans V2 metadata backfill for KOV web source register entries", () => {
  const plan = planRagMetadataBackfillForSource({
    key: "koduteenus_page",
    type: "web_page",
    title: "Koduteenus",
    url: "https://example.test/koduteenus"
  }, kovContext);

  assert.equal(plan.status, "backfill_required");
  assert.equal(plan.source_id, "jogeva_vald_koduteenus_page");
  assert.equal(plan.source_type, "kov_service_info");
  assert.equal(plan.metadata.authority, "KOV");
  assert.equal(plan.metadata.metadata_schema_version, RAG_METADATA_SCHEMA_VERSION);
  assert.equal(plan.metadata.municipality_id, "jogeva_vald");
  assert.equal(plan.metadata.last_checked, "2026-04-11");
  assert.deepEqual(plan.metadata.audience, ["CLIENT", "SOCIAL_WORKER"]);
  assert.equal(plan.remaining_errors.length, 0);
  assert.ok(plan.inferred_fields.includes("source_type"));
  assert.ok(plan.inferred_fields.includes("last_checked"));
});

test("maps KOV contact and form source types from legacy source register fields", () => {
  const contact = planRagMetadataBackfillForSource({
    key: "social_contacts",
    type: "contact_page",
    title: "Sotsiaalvaldkonna kontaktid",
    url: "https://example.test/kontaktid"
  }, kovContext);
  const form = planRagMetadataBackfillForSource({
    key: "hooldajatoetuse_taotlus_pdf",
    type: "pdf",
    title: "Hooldajatoetuse taotlus",
    url: "https://example.test/taotlus.pdf"
  }, kovContext);

  assert.equal(contact.status, "backfill_required");
  assert.equal(contact.source_type, "contact_page");
  assert.equal(form.status, "backfill_required");
  assert.equal(form.source_type, "application_form");
});

test("maps KOV dataset item metadata with canonical item id", () => {
  const plan = planRagMetadataBackfillForSource({
    id: "jogeva_vald_service_koduteenus",
    itemType: "service",
    title: "Koduteenus",
    status: "active",
    officialUrl: "https://example.test/koduteenus",
    sourceKeys: ["koduteenus_page"]
  }, {
    ...kovContext,
    recordKind: "item"
  });

  assert.equal(plan.status, "backfill_required");
  assert.equal(plan.source_id, "jogeva_vald_service_koduteenus");
  assert.equal(plan.source_type, "kov_service_info");
  assert.equal(plan.metadata.canonical_item_id, "jogeva_vald_service_koduteenus");
  assert.equal(plan.metadata.source_status, "active");
  assert.equal(plan.metadata.municipality_name, "Jogeva vald");
  assert.equal(plan.metadata.url_canonical, "https://example.test/koduteenus");
  assert.deepEqual(plan.metadata.source_urls, ["koduteenus_page"]);
});

test("backfill normalizes legacy canonical aliases before validation", () => {
  const plan = planRagMetadataBackfillForSource({
    canonical_source_id: "legacy-source",
    docId: "legacy-doc",
    title: "Legacy allikas",
    source_type: "journal_article",
    authority: "editorial",
    audience: "BOTH",
    language: "et",
    checked_at: "2026-04-12T09:00:00Z",
    content_status: "archived",
    effective_start: "2026-01-01T00:00:00Z",
    effective_end: "2026-12-31T00:00:00Z",
    is_current_version: false,
    url: "https://example.test/legacy"
  }, {
    collectionFamily: "ajakiri_sotsiaaltoo"
  });

  assert.equal(plan.status, "backfill_required");
  assert.equal(plan.metadata.metadata_schema_version, RAG_METADATA_SCHEMA_VERSION);
  assert.equal(plan.metadata.source_id, "legacy_source");
  assert.equal(plan.metadata.document_id, "legacy-doc");
  assert.equal(plan.metadata.last_checked, "2026-04-12");
  assert.equal(plan.metadata.source_status, "archived");
  assert.equal(plan.metadata.valid_from, "2026-01-01");
  assert.equal(plan.metadata.valid_to, "2026-12-31");
  assert.equal(plan.metadata.historical, true);
  assert.equal(plan.metadata.url_canonical, "https://example.test/legacy");
});

test("backfill maps legacy Sotsiaaltoo article metadata to canonical journal profile", () => {
  const plan = planRagMetadataBackfillForSource({
    docId: "sotsiaaltoo-4-2019",
    articleId: "omavalitsuste-noustamisuksus-2019",
    title: "Omavalitsuste jaoks loodud nõustamisüksus",
    authors: ["Heli Ferschel", "Evelyn Hallika", "Kätlin Hanson", "Meeli Tuubel"],
    year: 2019,
    journalTitle: "Sotsiaaltöö",
    issueLabel: "4/2019",
    section: "Sotsiaaltöö korraldus",
    pageRange: "20-23",
    audience: "BOTH",
    language: "et",
    source_type: "file",
    source_path: "ST4_2019_web_link_Part8.pdf"
  }, {
    collectionFamily: "ajakiri_sotsiaaltoo",
    filePath: "imports/ajakiri_sotsiaaltoo/19-4/omavalitsuste-noustamisuksus-2019.json"
  }, {
    defaultLastChecked: "2026-04-28"
  });

  assert.equal(plan.status, "backfill_required");
  assert.equal(plan.metadata.source_type, "journal_article");
  assert.equal(plan.metadata.collection_id, "sotsiaaltoo_articles");
  assert.equal(plan.metadata.authority, "editorial");
  assert.equal(plan.metadata.document_id, "sotsiaaltoo-4-2019");
  assert.equal(plan.metadata.source_id, "omavalitsuste-noustamisuksus-2019");
  assert.equal(plan.metadata.articleId, "omavalitsuste-noustamisuksus-2019");
  assert.equal(plan.metadata.journalTitle, "Sotsiaaltöö");
  assert.equal(plan.metadata.issueLabel, "4/2019");
  assert.equal(plan.metadata.year, 2019);
  assert.equal(plan.metadata.historical, true);
  assert.equal(plan.metadata.source_status, "active");
  assert.equal(plan.metadata.last_checked, "2026-04-28");
  assert.equal(plan.metadata.url_canonical, null);
  assert.equal(plan.remaining_errors.length, 0);
  assert.ok(plan.inferred_fields.includes("source_type"));
  assert.ok(plan.inferred_fields.includes("last_checked"));
});

test("maps RT and organization collections to their V2 source profiles", () => {
  const rt = planRagMetadataBackfillForSource({
    key: "act_123",
    title: "Koduteenuse kord",
    url: "https://www.riigiteataja.ee/akt/123"
  }, {
    collectionFamily: "kov_rt",
    slug: "jogeva-vald",
    root: {
      id: "jogeva-vald",
      checkedAt: "2026-04-12"
    }
  });
  const organization = planRagMetadataBackfillForSource({
    key: "teenusepakkuja",
    title: "Partnerteenus",
    url: "https://example.test"
  }, {
    collectionFamily: "organizations",
    slug: "partner-org",
    root: {
      id: "partner-org",
      checkedAt: "2026-04-12"
    }
  });

  assert.equal(rt.status, "backfill_required");
  assert.equal(rt.source_type, "kov_regulation");
  assert.equal(rt.metadata.authority, "official_legal");
  assert.equal(rt.metadata.municipality_id, "jogeva_vald");
  assert.equal(organization.status, "backfill_required");
  assert.equal(organization.source_type, "partner_service_info");
  assert.equal(organization.metadata.authority, "organization");
});

test("keeps records blocked when required identity cannot be inferred", () => {
  const plan = planRagMetadataBackfillForSource({}, {
    collectionFamily: "national_rt",
    root: {
      checkedAt: "2026-04-12"
    }
  });

  assert.equal(plan.status, "blocked");
  assert.ok(plan.remaining_errors.some(error => error.includes("source_id")));
});

test("summarizes metadata backfill plan by status, collection, and inferred fields", () => {
  const plan = buildRagMetadataBackfillPlan([
    {
      source: {
        key: "koduteenus_page",
        type: "web_page",
        title: "Koduteenus",
        url: "https://example.test/koduteenus"
      },
      context: kovContext
    },
    {
      source: {},
      context: {
        collectionFamily: "national_rt",
        root: {
          checkedAt: "2026-04-12"
        }
      }
    }
  ]);

  assert.equal(plan.ok, false);
  assert.equal(plan.summary.total, 2);
  assert.equal(plan.summary.backfill_required, 1);
  assert.equal(plan.summary.blocked, 1);
  assert.equal(plan.summary.by_collection.kov_web, 1);
  assert.ok(plan.summary.inferred_fields.source_type >= 1);
});
