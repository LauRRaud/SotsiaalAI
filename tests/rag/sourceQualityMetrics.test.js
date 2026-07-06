import test from "node:test";
import assert from "node:assert/strict";

import { summarizeRagTraceSourceQuality } from "../../lib/rag/sourceQualityMetrics.js";

test("summarizes displayed source contract precision from rag traces", () => {
  const result = summarizeRagTraceSourceQuality([
    {
      data: {
        retrieved_source_ids: ["source-a", "source-b", "source-c"],
        selected_context_source_ids: ["source-a", "source-b"],
        answer_source_ids: ["source-a"],
        displayed_source_ids: ["source-a"],
        filtered_out_source_ids: ["source-b", "source-c"],
        source_display_mode: "displayed_sources_enforced",
        attribution_decisions: [
          { source_id: "source-a", decision: "display", reason: "model_declared_and_context_validated" },
          { source_id: "source-b", decision: "hide", reason: "not_used_in_answer" }
        ]
      }
    },
    {
      data: {
        retrieved_source_ids: ["source-d", "source-e"],
        selected_context_source_ids: ["source-d"],
        answer_source_ids: ["source-d"],
        displayed_source_ids: ["source-e"],
        source_display_mode: "displayed_sources_enforced",
        attribution_decisions: [
          { source_id: "source-e", decision: "display", reason: "legacy_fallback" }
        ]
      }
    }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.summary.traces, 2);
  assert.equal(result.summary.retrieved_source_count, 5);
  assert.equal(result.summary.selected_context_source_count, 3);
  assert.equal(result.summary.answer_source_count, 2);
  assert.equal(result.summary.displayed_source_count, 2);
  assert.equal(result.summary.displayed_source_valid_count, 1);
  assert.equal(result.summary.displayed_source_violation_count, 1);
  assert.equal(result.summary.displayed_selected_source_valid_count, 1);
  assert.equal(result.summary.displayed_selected_source_violation_count, 1);
  assert.equal(result.summary.displayed_source_precision, 0.5);
  assert.equal(result.summary.traces_with_display_contract_violation, 1);
  assert.equal(result.summary.traces_with_display_selected_contract_violation, 1);
  assert.equal(result.summary.display_contract_violation_rate, 0.5);
  assert.equal(result.summary.displayed_selected_source_contract_violation_rate, 0.5);
  assert.equal(result.summary.retrieved_but_not_displayed_count, 3);
  assert.equal(result.summary.retrieved_filter_rate, 3 / 5);
  assert.equal(result.summary.selected_but_not_displayed_count, 2);
  assert.equal(result.summary.selected_filter_rate, 2 / 3);
  assert.equal(result.summary.filtered_out_source_count, 2);
  assert.equal(result.summary.source_display_mode_distribution.displayed_sources_enforced, 2);
  assert.equal(result.summary.attribution_decision_distribution.display, 2);
  assert.equal(result.summary.attribution_decision_distribution.hide, 1);
  assert.equal(result.summary.attribution_decision_reason_distribution.not_used_in_answer, 1);
  assert.equal(result.issues.length, 2);
  assert.equal(result.issues[0].type, "displayed_source_not_in_answer_sources");
  assert.deepEqual(result.issues[0].offending_source_ids, ["source-e"]);
  assert.equal(result.issues[1].type, "displayed_source_not_in_selected_context");
  assert.deepEqual(result.issues[1].offending_source_ids, ["source-e"]);
});

test("uses count fallbacks when trace source id arrays are missing", () => {
  const result = summarizeRagTraceSourceQuality([
    {
      data: {
        retrieved_count: 5,
        selected_context_count: 3,
        answer_source_ids: [],
        displayed_source_ids: []
      }
    }
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.summary.retrieved_source_count, 5);
  assert.equal(result.summary.selected_context_source_count, 3);
  assert.equal(result.summary.retrieved_but_not_displayed_count, 5);
  assert.equal(result.summary.selected_but_not_displayed_count, 3);
  assert.equal(result.summary.displayed_source_precision, 1);
  assert.equal(result.summary.displayed_source_precision_basis, 0);
  assert.equal(result.summary.source_display_mode_distribution.unknown, 1);
});

test("measures wrong municipality rate from selected context details", () => {
  const result = summarizeRagTraceSourceQuality([
    {
      data: {
        query_plan: {
          municipality_names: ["Tartu linn"],
          municipality_ids: ["tartu_linn"]
        },
        selected_context_details: [
          {
            source_id: "tartu-koduteenus",
            source_type: "kov_service_info",
            municipality_id: "tartu_linn",
            municipality_name: "Tartu linn"
          },
          {
            source_id: "voru-koduteenus",
            source_type: "kov_service_info",
            municipality_id: "voru_linn",
            municipality_name: "Voru linn"
          },
          {
            source_id: "background",
            source_type: "journal_article"
          }
        ]
      }
    },
    {
      data: {
        query_plan: {
          municipality_names: ["Tartu linn"]
        },
        selected_context_details: [
          {
            source_id: "tartu-contact",
            source_type: "official_contact",
            municipality_name: "Tartu linn"
          }
        ]
      }
    }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.summary.municipality_scope_expected_traces, 2);
  assert.equal(result.summary.municipality_source_count, 3);
  assert.equal(result.summary.wrong_municipality_source_count, 1);
  assert.equal(result.summary.traces_with_wrong_municipality, 1);
  assert.equal(result.summary.wrong_municipality_rate, 1 / 3);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].type, "selected_context_wrong_municipality");
  assert.equal(result.issues[0].source_id, "voru-koduteenus");
  assert.deepEqual(result.issues[0].expected_municipality_ids, ["tartu_linn"]);
  assert.deepEqual(result.issues[0].expected_municipality_names, ["tartu linn"]);
});

test("measures legal displayed paragraph precision and flags wrong displayed paragraph", () => {
  const result = summarizeRagTraceSourceQuality([
    {
      data: {
        query_plan: {
          legalLookupPlan: {
            enabled: true,
            mode: "explicit_paragraph",
            actTitle: "Sotsiaalhoolekande seadus",
            paragraphRefs: ["140"]
          }
        },
        attribution_decisions: [
          {
            source_id: "rt-160",
            decision: "display",
            source_type: "national_law",
            paragraph_number: "160",
            act_title: "Sotsiaalhoolekande seadus",
            source_status: "active"
          }
        ]
      }
    }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.summary.legal_displayed_paragraph_precision, 0);
  assert.equal(result.summary.legal_wrong_paragraph_count, 1);
  assert.equal(result.issues.some(item => item.type === "legal_displayed_wrong_paragraph"), true);
});

test("measures legal paragraph precision through central source metadata aliases", () => {
  const result = summarizeRagTraceSourceQuality([
    {
      data: {
        query_plan: {
          legalLookupPlan: {
            enabled: true,
            mode: "explicit_paragraph",
            paragraphRefs: ["6"]
          }
        },
        attribution_decisions: [
          {
            source_id: "kov-rt-6",
            decision: "display",
            source_type: "riigiteataja_regulation",
            paragraph_number: "7",
            source_status: "active"
          }
        ]
      }
    }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.summary.legal_displayed_wrong_paragraph_count, 1);
  assert.equal(result.issues.some(item => item.type === "legal_displayed_wrong_paragraph"), true);
});

test("does not treat non-legal research aliases as current legal source violations", () => {
  const result = summarizeRagTraceSourceQuality([
    {
      data: {
        selected_context_details: [
          {
            source_id: "sotsiaaltoo-article",
            source_type: "article",
            source_status: "active"
          }
        ]
      }
    }
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.summary.legal_current_source_violation_count, 0);
});

test("measures legal selected paragraph precision through central source metadata aliases", () => {
  const result = summarizeRagTraceSourceQuality([
    {
      data: {
        query_plan: {
          legalLookupPlan: {
            enabled: true,
            mode: "explicit_paragraph",
            paragraphRefs: ["6"]
          }
        },
        selected_context_details: [
          {
            source_id: "kov-rt-7",
            source_type: "municipal_regulation",
            paragraph_number: "7",
            source_status: "active"
          }
        ]
      }
    }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.summary.legal_selected_wrong_paragraph_count, 1);
  assert.equal(result.issues.some(item => item.type === "legal_selected_wrong_paragraph"), true);
});

test("measures legal selected paragraph precision and flags wrong selected paragraph", () => {
  const result = summarizeRagTraceSourceQuality([
    {
      data: {
        query_plan: {
          legalLookupPlan: {
            enabled: true,
            mode: "explicit_paragraph",
            actTitle: "Sotsiaalhoolekande seadus",
            paragraphRefs: ["140"]
          }
        },
        selected_context_details: [
          {
            source_id: "rt-160",
            source_type: "national_law",
            paragraph_number: "160",
            act_title: "Sotsiaalhoolekande seadus",
            source_status: "active"
          }
        ]
      }
    }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.summary.legal_selected_paragraph_precision, 0);
  assert.equal(result.summary.legal_wrong_paragraph_count, 1);
  assert.equal(result.issues.some(item => item.type === "legal_selected_wrong_paragraph"), true);
});

test("summarizes overview synthesis source diversity metrics", () => {
  const result = summarizeRagTraceSourceQuality([
    {
      data: {
        overview_synthesis: {
          mode: "overview_synthesis",
          overview_synthesis_used: true,
          distinct_candidate_document_count: 8,
          distinct_relevant_candidate_document_count: 5,
          distinct_selected_document_count: 4,
          selected_document_ids: ["doc-a", "doc-b", "doc-c", "doc-d"],
          depth_pass_added_chunks: 2,
          dominant_document_id: "doc-a",
          dominant_document_share: 0.35,
          dominant_document_allowed: false,
          source_diversity_limited: false
        }
      }
    }
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.summary.overview_synthesis_trace_count, 1);
  assert.equal(result.summary.overview_synthesis_used_count, 1);
  assert.equal(result.summary.overview_distinct_candidate_document_count, 8);
  assert.equal(result.summary.overview_distinct_relevant_candidate_document_count, 5);
  assert.equal(result.summary.overview_distinct_selected_document_count, 4);
  assert.equal(result.summary.overview_distinct_selected_document_average, 4);
  assert.equal(result.summary.overview_depth_pass_added_chunks, 2);
  assert.equal(result.summary.overview_dominant_document_share_max, 0.35);
  assert.equal(result.summary.overview_source_diversity_reason_distribution.not_limited, 1);
});

test("flags overview synthesis when enough relevant documents exist but selected context is too narrow", () => {
  const result = summarizeRagTraceSourceQuality([
    {
      data: {
        overview_synthesis: {
          overview_synthesis_used: true,
          distinct_candidate_document_count: 6,
          distinct_relevant_candidate_document_count: 5,
          distinct_selected_document_count: 2,
          selected_document_ids: ["doc-a", "doc-b"],
          dominant_document_id: "doc-a",
          dominant_document_share: 0.75,
          dominant_document_allowed: false,
          dominant_document_reason: "none",
          source_diversity_limited: false
        }
      }
    }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.summary.overview_low_source_diversity_count, 1);
  assert.equal(result.summary.overview_unallowed_dominant_document_count, 1);
  assert.equal(result.issues.some(item => item.type === "overview_synthesis_low_source_diversity"), true);
  assert.equal(result.issues.some(item => item.type === "overview_synthesis_unallowed_dominant_document"), true);
});

test("allows limited overview diversity when retrieval has too few relevant documents", () => {
  const result = summarizeRagTraceSourceQuality([
    {
      data: {
        overview_synthesis: {
          overview_synthesis_used: true,
          distinct_candidate_document_count: 2,
          distinct_relevant_candidate_document_count: 2,
          distinct_selected_document_count: 1,
          selected_document_ids: ["doc-a"],
          dominant_document_id: "doc-a",
          dominant_document_share: 1,
          dominant_document_allowed: true,
          dominant_document_reason: "not_enough_relevant_documents",
          source_diversity_limited: true,
          source_diversity_reason: "not_enough_relevant_documents"
        }
      }
    }
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.summary.overview_source_diversity_limited_count, 1);
  assert.equal(result.summary.overview_source_diversity_limited_rate, 1);
  assert.equal(result.summary.overview_dominant_document_allowed_count, 1);
  assert.equal(result.summary.overview_source_diversity_reason_distribution.not_enough_relevant_documents, 1);
  assert.equal(result.summary.overview_low_source_diversity_count, 0);
  assert.equal(result.summary.overview_unallowed_dominant_document_count, 0);
});
