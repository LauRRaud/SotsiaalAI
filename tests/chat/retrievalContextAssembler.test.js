import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildLegalExactSelection,
  buildRagSearchErrorPayload,
  mergePackageDisplayedSources,
  shouldUseReportedPracticeInstruction
} from "../../lib/chat/retrievalContextAssembler.js";

function readSource(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("buildRagSearchErrorPayload marks optional RAG failures with planner context", () => {
  const payload = buildRagSearchErrorPayload({
    err: new Error("background search timeout"),
    userId: "user-1",
    role: "SOCIAL_WORKER",
    isCrisis: false,
    stage: "rag_search_background_scope",
    optional: true,
    topK: 8,
    conversationId: "conversation-1",
    selectionStrategy: "mmr_diversity",
    queryPlan: {
      mode: "municipality_service_benefit",
      query_order: "default",
      selection_strategy: "mmr_diversity",
      query_count: 2,
      rag_top_k: 36
    }
  });

  assert.equal(payload.stage, "rag_search_background_scope");
  assert.equal(payload.optional, true);
  assert.equal(payload.error_message, "background search timeout");
  assert.equal(payload.queryPlanMode, "municipality_service_benefit");
  assert.equal(payload.queryPlanSelectionStrategy, "mmr_diversity");
  assert.equal(payload.queryPlanQueryOrder, "default");
  assert.equal(payload.query_plan.query_count, 2);
  assert.equal(payload.query_plan.rag_top_k, 36);
  assert.equal(payload.top_k, 8);
  assert.equal(payload.conversation_id, "conversation-1");
});

test("buildRagSearchErrorPayload truncates long error text", () => {
  const payload = buildRagSearchErrorPayload({
    err: new Error("x".repeat(300)),
    stage: "rag_search"
  });

  assert.equal(payload.error_message.length, 240);
});

test("mergePackageDisplayedSources enriches existing package source with package URL", () => {
  const merged = mergePackageDisplayedSources([
    {
      source_id: "kuusalu-koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info"
    }
  ], [
    {
      source_id: "kuusalu-koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info",
      url_canonical: "https://www.kuusalu.ee/koduteenus"
    }
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].source_id, "kuusalu-koduteenus");
  assert.equal(merged[0].url, "https://www.kuusalu.ee/koduteenus");
  assert.equal(merged[0].url_canonical, "https://www.kuusalu.ee/koduteenus");
});

test("mergePackageDisplayedSources enriches title municipality alias with package URL", () => {
  const merged = mergePackageDisplayedSources([
    {
      source_id: "kuusalu_vald_service_koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info",
      municipality_id: "kuusalu_vald"
    }
  ], [
    {
      source_id: "koduteenus_page",
      title: "Koduteenus",
      source_type: "kov_service_page",
      resource_type: "service_page",
      municipality_id: "kuusalu_vald",
      url_canonical: "https://www.kuusalu.ee/koduteenus"
    }
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].source_id, "kuusalu_vald_service_koduteenus");
  assert.equal(merged[0].url, "https://www.kuusalu.ee/koduteenus");
  assert.equal(merged[0].url_canonical, "https://www.kuusalu.ee/koduteenus");
});

test("reported practice instruction is enabled for article-backed organization use questions", () => {
  assert.equal(shouldUseReportedPracticeInstruction(
    "kas tehisintellekti kasutatakse töötukassas?",
    [
      {
        sourceType: "journal_article",
        collectionId: "sotsiaaltoo_articles",
        title: "Tehisintellekt sotsiaaltöös"
      }
    ]
  ), true);
});

test("reported practice instruction is not enabled without a background practice source", () => {
  assert.equal(shouldUseReportedPracticeInstruction(
    "kas tehisintellekti kasutatakse töötukassas?",
    [
      {
        sourceType: "kov_service_info",
        collectionId: "kov_services",
        title: "Koduteenus"
      }
    ]
  ), false);
});

test("municipality chat context can use service map KOV contacts", () => {
  const source = readSource("lib/chat/retrievalContextAssembler.js");

  assert.match(source, /SERVICE_MAP_KOV_CONTACTS/);
  assert.match(source, /prisma\.serviceMapEntry\.findMany/);
  assert.match(source, /KOV_SOCIAL_CONTACT/);
  assert.match(source, /KOV_GENERAL_CONTACT/);
  assert.match(source, /contextParts\.push\(serviceMapKovContactContext\)/);
  assert.match(source, /serviceMapKovContactCount/);
});

test("buildLegalExactSelection keeps only requested legal paragraph groups", () => {
  const result = buildLegalExactSelection([
    {
      key: "law-140",
      sourceType: "national_law",
      sourceStatus: "active",
      historical: false,
      actTitle: "Sotsiaalhoolekande seadus",
      paragraphNumber: "140",
      paragraphTitle: "Toimetulekutoetuse maksmine"
    },
    {
      key: "law-160",
      sourceType: "national_law",
      sourceStatus: "active",
      historical: false,
      actTitle: "Sotsiaalhoolekande seadus",
      paragraphNumber: "160",
      paragraphTitle: "Paragrahvi 140 rakendamine"
    },
    {
      key: "law-70",
      sourceType: "national_law",
      sourceStatus: "active",
      historical: false,
      actTitle: "Sotsiaalhoolekande seadus",
      paragraphNumber: "70"
    },
    {
      key: "journal-140",
      sourceType: "journal_article",
      actTitle: "Sotsiaalhoolekande seadus",
      paragraphNumber: "140"
    }
  ], {
    enabled: true,
    mode: "explicit_paragraph",
    sourceTypes: ["national_law"],
    actTitle: "Sotsiaalhoolekande seadus",
    paragraphRefs: ["140"],
    requireCurrent: true
  });

  assert.equal(result.insufficientPreciseLegalSourceSupport, false);
  assert.deepEqual(result.missingParagraphRefs, []);
  assert.deepEqual(result.selectionGroups.map(item => item.paragraphNumber), ["140"]);
  assert.deepEqual(result.groupedMatches.map(item => item.paragraphNumber), ["140"]);
});

test("buildLegalExactSelection reports insufficient support when exact paragraph is missing", () => {
  const result = buildLegalExactSelection([
    {
      key: "law-160",
      sourceType: "national_law",
      sourceStatus: "active",
      historical: false,
      actTitle: "Sotsiaalhoolekande seadus",
      paragraphNumber: "160",
      paragraphTitle: "Paragrahvi 140 rakendamine"
    }
  ], {
    enabled: true,
    mode: "explicit_paragraph",
    sourceTypes: ["national_law"],
    actTitle: "Sotsiaalhoolekande seadus",
    paragraphRefs: ["999"],
    requireCurrent: true
  });

  assert.equal(result.insufficientPreciseLegalSourceSupport, true);
  assert.deepEqual(result.missingParagraphRefs, ["999"]);
  assert.deepEqual(result.selectionGroups, []);
});

test("national service benefit detection covers fee questions about concrete services", async () => {
  const { isNationalServiceBenefitQuestion } = await import("../../lib/chat/retrievalContextAssembler.js");

  assert.equal(isNationalServiceBenefitQuestion("Kas tugiisikuteenusel on omaosalus?"), true);
  assert.equal(isNationalServiceBenefitQuestion("Kui suur on koduteenuse omaosalus?"), true);
  assert.equal(isNationalServiceBenefitQuestion("Kas koduteenus on tasuline?"), true);
  assert.equal(isNationalServiceBenefitQuestion("Mis teenuseid riik pakub?"), true);

  assert.equal(isNationalServiceBenefitQuestion("Kas Kuusalu vallas on koduteenus tasuline?"), false);
  assert.equal(isNationalServiceBenefitQuestion("Mis on murekohad lastekaitses?"), false);
  assert.equal(isNationalServiceBenefitQuestion("Tere"), false);
});
