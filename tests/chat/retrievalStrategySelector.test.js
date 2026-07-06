import assert from "node:assert/strict";
import test from "node:test";

import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { selectRetrievalStrategy } from "../../lib/chat/retrievalStrategySelector.js";

test("retrieval strategy selector maps resource discovery to diversity resource retrieval", () => {
  const questionPlan = buildQuestionPlan({
    message: "Millised organisatsioonid voi materjalid aitavad puudega inimest?",
    role: "SOCIAL_WORKER"
  });
  const strategy = selectRetrievalStrategy({ questionPlan });

  assert.equal(strategy.mode, "resource_discovery");
  assert.equal(strategy.retrieval_strategy, "resource_discovery_hybrid");
  assert.equal(strategy.selection_strategy, "resource_discovery_diversity");
  assert.equal(strategy.query_order, "broad_first");
  assert.equal(strategy.source_layer_filter_mode, "prefer");
  assert.equal(strategy.force_rag, true);
});

test("retrieval strategy selector maps life situation guidance to multi-source client guidance", () => {
  const questionPlan = buildQuestionPlan({
    message: "Mul pole raha uuri ja toidu jaoks, mida teha?",
    role: "CLIENT"
  });
  const strategy = selectRetrievalStrategy({ questionPlan });

  assert.equal(strategy.mode, "life_situation_guidance");
  assert.equal(strategy.retrieval_strategy, "life_situation_guidance_hybrid");
  assert.equal(strategy.selection_strategy, "multi_source_diversity");
  assert.deepEqual(strategy.preferred_source_count, { min: 3, max: 6 });
  assert.equal(strategy.answer_contract, "client_next_steps_no_entitlement_promise");
});

test("retrieval strategy selector maps comparison to balanced multi-source retrieval", () => {
  const questionPlan = buildQuestionPlan({
    message: "Kuidas eristada koduteenust ja isikliku abistaja teenust?",
    role: "SOCIAL_WORKER"
  });
  const strategy = selectRetrievalStrategy({ questionPlan });

  assert.equal(strategy.mode, "comparison");
  assert.equal(strategy.retrieval_strategy, "comparison_balanced_sources");
  assert.equal(strategy.selection_strategy, "multi_source_diversity");
  assert.equal(strategy.needs_multiple_sources, true);
});

test("retrieval strategy selector lets legal route override planner mapping", () => {
  const questionPlan = buildQuestionPlan({
    message: "Mis utleb SHS paragrahv 42?",
    role: "SOCIAL_WORKER"
  });
  const strategy = selectRetrievalStrategy({
    questionPlan,
    routeContext: {
      legalLookupEnabled: true,
      legalLookupMode: "explicit_paragraph"
    }
  });

  assert.equal(strategy.route_override, true);
  assert.equal(strategy.retrieval_strategy, "legal_exact");
  assert.equal(strategy.selection_strategy, "legal_exact");
  assert.equal(strategy.reason, "route_override_legal_lookup");
});

test("retrieval strategy selector lets KOV route override planner mapping", () => {
  const questionPlan = buildQuestionPlan({
    message: "Millised on Kuusalu valla koduteenuse tingimused?",
    role: "SOCIAL_WORKER"
  });
  const strategy = selectRetrievalStrategy({
    questionPlan,
    routeContext: {
      municipalityServiceBenefitListRequest: true,
      allowMunicipalityScopedRag: true
    }
  });

  assert.equal(strategy.route_override, true);
  assert.equal(strategy.retrieval_strategy, "kov_service_benefit_list");
  assert.equal(strategy.selection_strategy, "municipality_service_benefit_balance");
  assert.equal(strategy.reason, "route_override_municipality_service_benefit_list");
});
