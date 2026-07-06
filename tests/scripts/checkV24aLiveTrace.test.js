import test from "node:test";
import assert from "node:assert/strict";

import {
  CASES,
  evaluateCase,
  evaluateCasesFromMessages,
  normalize,
  parseOptions,
  selectCases
} from "../../scripts/check-v24a-live-trace.mjs";

const NOW = new Date("2026-05-05T09:00:00.000Z");

function pair({
  user = "Mis on murekohad lastekaitses?",
  createdAt = "2026-05-05T08:50:00.000Z",
  trace = {}
} = {}) {
  return {
    user: {
      id: "user-1",
      conversationId: "conv-1",
      role: "USER",
      content: user,
      createdAt: new Date("2026-05-05T08:49:00.000Z")
    },
    assistant: {
      id: "assistant-1",
      conversationId: "conv-1",
      role: "ASSISTANT",
      content: "Answer",
      createdAt: new Date(createdAt),
      metadata: {
        rag_trace: trace,
        displayed_sources: []
      }
    }
  };
}

test("live trace checker normalizes Estonian diacritics and historical mojibake", () => {
  assert.equal(normalize("Mis ütleb SHS § 42?"), "mis utleb shs 42");
  assert.equal(normalize("Mis Ć¼tleb SHS Ā§ 42?"), "mis utleb shs 42");
});

test("live trace checker rejects stale matching traces by default", () => {
  const result = evaluateCase(CASES[0], pair({
    createdAt: "2026-05-04T08:50:00.000Z",
    trace: {
      query_plan: { mode: "overview_synthesis" },
      evidence_package: {
        mode: "overview_synthesis",
        selected_sources: [{ source_year: 2025 }],
        temporal_coverage: { years: [2025], has_multi_year_range: false }
      }
    }
  }), {
    now: NOW,
    maxAgeMinutes: 60
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.startsWith("trace_too_old_")), true);
});

test("live trace checker validates temporal metadata when overview evidence has multiple years", () => {
  const missingTemporal = evaluateCase(CASES[0], pair({
    trace: {
      query_plan: { mode: "overview_synthesis" },
      evidence_package: {
        mode: "overview_synthesis",
        selected_sources: [{ source_year: 2023 }, { source_year: 2025 }]
      }
    }
  }), {
    now: NOW,
    maxAgeMinutes: 60
  });

  assert.equal(missingTemporal.ok, false);
  assert.equal(missingTemporal.errors.includes("temporal_coverage_missing_for_multi_year_evidence"), true);

  const withTemporal = evaluateCase(CASES[0], pair({
    trace: {
      query_plan: { mode: "overview_synthesis" },
      evidence_package: {
        mode: "overview_synthesis",
        selected_sources: [{ source_year: 2023 }, { source_year: 2025 }],
        temporal_coverage: {
          years: [2023, 2025],
          year_range: "2023-2025",
          has_multi_year_range: true
        },
        trace_summary: {
          year_range: "2023-2025",
          distinct_year_count: 2
        }
      }
    }
  }), {
    now: NOW,
    maxAgeMinutes: 60
  });

  assert.equal(withTemporal.ok, true);
  assert.deepEqual(withTemporal.summary.evidence_package_temporal.source_years, [2023, 2025]);
  assert.equal(withTemporal.summary.evidence_package_temporal.temporal_year_range, "2023-2025");
});

test("live trace checker evaluates cases from recent conversation messages", () => {
  const messages = [
    {
      id: "u1",
      conversationId: "c1",
      role: "USER",
      content: "Mis ütleb SHS § 42?",
      createdAt: new Date("2026-05-05T08:55:00.000Z")
    },
    {
      id: "a1",
      conversationId: "c1",
      role: "ASSISTANT",
      content: "Answer",
      createdAt: new Date("2026-05-05T08:56:00.000Z"),
      metadata: {
        rag_trace: {
          query_plan: { mode: "explicit_paragraph" }
        },
        displayed_sources: []
      }
    }
  ];

  const [result] = evaluateCasesFromMessages(messages, [CASES[2]], {
    now: NOW,
    maxAgeMinutes: 60
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.mode, "explicit_paragraph");
});

test("live trace checker supports stale opt-out for manual debugging", () => {
  assert.equal(parseOptions(["--allow-stale"]).maxAgeMinutes, 0);
  assert.equal(parseOptions(["--max-age-minutes=15"]).maxAgeMinutes, 15);
  assert.equal(parseOptions(["--since-minutes=20"]).maxAgeMinutes, 20);
  assert.equal(parseOptions(["--max-age-minutes=not-a-number"]).maxAgeMinutes, 720);
});

test("live trace checker supports targeted case and conversation filters", () => {
  const options = parseOptions([
    "--case=overview_lastekaitse",
    "--conversation-id=conv-540948d4-0733-4072-b8e0-421ccc549dcf"
  ]);
  assert.deepEqual(options.caseIds, ["overview_lastekaitse"]);
  assert.equal(options.conversationId, "conv-540948d4-0733-4072-b8e0-421ccc549dcf");

  const selected = selectCases(CASES, options.caseIds);
  assert.deepEqual(selected.selectedCases.map(testCase => testCase.id), ["overview_lastekaitse"]);
  assert.deepEqual(selected.unknownCaseIds, []);

  const mixed = selectCases(CASES, ["overview_lastekaitse", "missing_case"]);
  assert.deepEqual(mixed.selectedCases.map(testCase => testCase.id), ["overview_lastekaitse"]);
  assert.deepEqual(mixed.unknownCaseIds, ["missing_case"]);
});
