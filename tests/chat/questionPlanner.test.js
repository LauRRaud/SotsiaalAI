import assert from "node:assert/strict";
import test from "node:test";

import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";

function plan(message) {
  return buildQuestionPlan({
    message,
    role: "SOCIAL_WORKER"
  });
}

test("Question Planner V2.1 routes organization and material help questions to resource discovery", () => {
  const result = plan("Millised organisatsioonid või materjalid aitavad puudega inimest?");

  assert.equal(result.mode, "resource_discovery");
  assert.equal(result.needs_rag, true);
  assert.equal(result.needs_multiple_sources, true);
  assert.deepEqual(result.preferred_source_count, { min: 3, max: 8 });
  assert.equal(result.source_layer_filter_mode, "prefer");
  assert.equal(result.source_layers.includes("organizations"), true);
  assert.equal(result.source_layers.includes("organization_materials"), true);
  assert.equal(result.source_layers.includes("sotsiaaltoo_articles"), true);
  assert.equal(result.source_layers.includes("journal_article"), true);
  assert.equal(result.source_layers.includes("research_reports"), true);
  assert.equal(result.source_layers.includes("partner_service_info"), true);
  assert.equal(result.source_layers.includes("public_body_info"), true);
  assert.equal(result.avoid_source_layers.includes("national_law_as_primary"), true);
});

test("Question Planner V2.2 maps client financial hardship to life situation guidance", () => {
  const result = buildQuestionPlan({
    message: "Mul pole raha üüri ja toidu jaoks, mida teha?",
    role: "CLIENT"
  });

  assert.equal(result.mode, "life_situation_guidance");
  assert.equal(result.role, "client");
  assert.equal(result.input_role, "client");
  assert.equal(result.life_situation, "financial_hardship");
  assert.equal(result.needs_location, true);
  assert.equal(result.needs_multiple_sources, true);
  assert.equal(result.topics.includes("toimetulekutoetus"), true);
  assert.equal(result.topics.includes("valtimatu_sotsiaalabi"), true);
  assert.equal(result.answer_contract, "client_next_steps_no_entitlement_promise");
});

test("Question Planner V2.2 maps elderly relative care difficulty to life situation guidance", () => {
  const result = buildQuestionPlan({
    message: "Ema ei saa enam üksi kodus hakkama, kuhu pöörduda?",
    role: "CLIENT"
  });

  assert.equal(result.mode, "life_situation_guidance");
  assert.equal(result.role, "client");
  assert.equal(result.life_situation, "elderly_relative_care_difficulty");
  assert.equal(result.needs_location, true);
  assert.equal(result.topics.includes("koduteenus"), true);
  assert.equal(result.topics.includes("abivajaduse_hindamine"), true);
});

test("Question Planner V2.2 maps disabled child family help to life situation guidance", () => {
  const result = buildQuestionPlan({
    message: "Mul on puudega laps, kuhu pöörduda?",
    role: "CLIENT"
  });

  assert.equal(result.mode, "life_situation_guidance");
  assert.equal(result.life_situation, "disabled_child_family_support");
  assert.equal(result.needs_location, true);
  assert.equal(result.topics.includes("tugiisikuteenus"), true);
  assert.equal(result.topics.includes("rehabilitatsioon"), true);
});

test("Question Planner V2.2 detects specialist comparison without overriding legal or KOV routes", () => {
  const result = buildQuestionPlan({
    message: "Kuidas eristada koduteenust ja isikliku abistaja teenust?",
    role: "SOCIAL_WORKER"
  });

  assert.equal(result.mode, "comparison");
  assert.equal(result.role, "social_worker");
  assert.equal(result.needs_multiple_sources, true);
  assert.equal(result.retrieval_strategy, "comparison_balanced_sources");
});

test("Question Planner V2.3 detects inflected service comparison topics", () => {
  const result = buildQuestionPlan({
    message: "Mis vahe on koduteenusel ja tugiisikuteenusel?",
    role: "SOCIAL_WORKER"
  });

  assert.equal(result.mode, "comparison");
  assert.equal(result.needs_multiple_sources, true);
  assert.equal(result.retrieval_strategy, "comparison_balanced_sources");
  assert.equal(result.source_layer_filter_mode, "prefer");
  assert.equal(result.topics.includes("koduteenus"), true);
  assert.equal(result.topics.includes("tugiisikuteenus"), true);
});

test("Question Planner V2.1 routes school mental health material questions to resource discovery", () => {
  const result = plan("Mis materjale on laste vaimse tervise kohta koolis?");

  assert.equal(result.mode, "resource_discovery");
  assert.equal(result.retrieval_strategy, "resource_discovery_hybrid");
});

test("Question Planner V2.1 treats organization lookups as resource discovery", () => {
  const result = plan("Mida Astangu Keskus pakub?");

  assert.equal(result.mode, "resource_discovery");
  assert.equal(result.answer_contract, "prefer_organization_material_contact_and_guideline_sources");
});

test("Question Planner V2.1 does not let resource discovery override legal exact questions", () => {
  const result = plan("Mis ütleb SHS § 42?");

  assert.equal(result.mode, "legal_exact");
  assert.notEqual(result.mode, "resource_discovery");
});

test("Question Planner V2.1 does not let resource discovery override KOV service questions", () => {
  const result = plan("Millised on Kuusalu valla koduteenuse tingimused?");

  assert.equal(result.mode, "kov_service_or_benefit");
  assert.notEqual(result.mode, "resource_discovery");
});

test("Question Planner V2.1 does not let resource discovery override overview synthesis questions", () => {
  const result = plan("Mis on murekohad lastekaitses?");

  assert.equal(result.mode, "overview_synthesis");
  assert.notEqual(result.mode, "resource_discovery");
});

test("Question Planner V2.1 does not let resource discovery override specific document summaries", () => {
  const result = plan("Tee kokkuvõte dokumendist X.");

  assert.equal(result.mode, "specific_document_summary");
  assert.notEqual(result.mode, "resource_discovery");
});

test("Question Planner routes worksheet material questions to resource discovery", () => {
  const result = plan("Kas on abiküsimuste töölehti vestluseks algkoolilapsega?");

  assert.equal(result.mode, "resource_discovery");
  assert.equal(result.needs_rag, true);
});
