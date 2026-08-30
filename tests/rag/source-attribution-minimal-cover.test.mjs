import test from "node:test";
import assert from "node:assert/strict";

import {
  ALLOWED_ATTRIBUTION_DECISION_REASONS,
  buildSourceAttribution
} from "../../lib/chat/sourceAttribution.js";

function guideline(sourceId, title, evidenceText) {
  return {
    source_id: sourceId,
    source_type: "official_guideline",
    title,
    evidenceText
  };
}

const twoClaimReply = [
  "Muuda ohustatud kontode paroolid kohe.",
  "Säilita sõnumid ja ekraanipildid tõenditena."
].join(" ");

test("default single-topic attribution suppresses lower-ranked subsumed claim support", () => {
  const result = buildSourceAttribution(twoClaimReply, [
    guideline(
      "supporting-guide",
      "Toetav juhend",
      "Säilita sõnumid ja ekraanipildid tõenditena."
    ),
    guideline(
      "primary-guide",
      "Põhijuhend",
      twoClaimReply
    )
  ], {
    query: "Kuidas inimest digiohu korral aidata?",
    queryPlan: { mode: "default", needs_multiple_sources: false }
  });

  assert.deepEqual(result.displayed_source_ids, ["primary-guide"]);
  const suppressed = result.attribution_decisions.find(item => item.source_id === "supporting-guide");
  assert.equal(suppressed?.decision, "hide");
  assert.equal(suppressed?.reason, "claim_support_subsumed");
  assert.equal(ALLOWED_ATTRIBUTION_DECISION_REASONS.has(suppressed?.reason), true);
});

test("default single-topic attribution keeps a source that adds another claim", () => {
  const result = buildSourceAttribution(twoClaimReply, [
    guideline(
      "password-guide",
      "Kontoturbe juhend",
      "Muuda ohustatud kontode paroolid kohe."
    ),
    guideline(
      "evidence-guide",
      "Tõendite juhend",
      "Säilita sõnumid ja ekraanipildid tõenditena."
    )
  ], {
    query: "Kuidas inimest digiohu korral aidata?",
    queryPlan: { mode: "default", needs_multiple_sources: false }
  });

  assert.deepEqual(new Set(result.displayed_source_ids), new Set([
    "password-guide",
    "evidence-guide"
  ]));
});

test("professional method guidance uses claim cover for its multi-source context", () => {
  for (const queryPlan of [{
      mode: "professional_method_guidance",
      needs_multiple_sources: true,
      selection_strategy: "multi_source_diversity"
    }, {
      mode: "default",
      selection_strategy: "multi_source_diversity",
      question_planner: {
        mode: "professional_method_guidance",
        needs_multiple_sources: true
      }
    }]) {
    const result = buildSourceAttribution(twoClaimReply, [
      guideline(
        "supporting-guide",
        "Toetav juhend",
        "Säilita sõnumid ja ekraanipildid tõenditena."
      ),
      guideline("primary-guide", "Põhijuhend", twoClaimReply)
    ], {
      query: "Kuidas spetsialist peaks abistamist korraldama?",
      queryPlan
    });

    assert.deepEqual(result.displayed_source_ids, ["primary-guide"]);
    assert.equal(result.filter_reasons["supporting-guide"], "claim_support_subsumed");
  }
});

test("explicit multi-source plan keeps overlapping supporting sources", () => {
  const result = buildSourceAttribution(twoClaimReply, [
    guideline("supporting-guide", "Toetav juhend", twoClaimReply),
    guideline("primary-guide", "Põhijuhend", twoClaimReply)
  ], {
    query: "Koonda mitme allika soovitused.",
    queryPlan: { mode: "default", needs_multiple_sources: true }
  });

  assert.deepEqual(result.displayed_source_ids, [
    "supporting-guide",
    "primary-guide"
  ]);
});

test("plural source-set listing keeps every named displayed source", () => {
  const reply = "Kuvatud allikad olid „Esimene juhend” ja „Teine käsiraamat”.";
  const result = buildSourceAttribution(reply, [
    guideline("first-source", "Esimene juhend", "Esimese juhendi sisu."),
    guideline("second-source", "Teine käsiraamat", "Teise käsiraamatu sisu.")
  ], {
    query: "Mis olid nende allikate pealkirjad?",
    queryPlan: { mode: "default", needs_multiple_sources: false }
  });

  assert.deepEqual(result.displayed_source_ids, [
    "first-source",
    "second-source"
  ]);
});

test("registry reference cannot subsume the only substantive answer source", () => {
  const result = buildSourceAttribution(twoClaimReply, [
    {
      ...guideline("registry-reference", "Materjalide register", twoClaimReply),
      evidence_role: "registry_reference"
    },
    guideline("substantive-guide", "Sisuline juhend", twoClaimReply)
  ], {
    queryPlan: { mode: "default", needs_multiple_sources: false }
  });

  assert.equal(result.displayed_source_ids.includes("substantive-guide"), true);
});
