import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateGoldenCase,
  extractResponseFacts,
  normalizeText,
  summarizeResults
} from "../../scripts/run-golden-eval.mjs";

const comparisonCase = {
  id: "comparison_kodu_tugiisik",
  family: "comparison",
  expect: {
    mode: "comparison",
    evidence_package: true,
    displayed_must_include: ["§ 17", "§ 23"],
    displayed_must_not_include: ["§ 44"]
  }
};

function comparisonBody({ extraSource = null } = {}) {
  const sources = [
    { title: "Sotsiaalhoolekande seadus § 17 Koduteenuse eesmärk ja sisu" },
    { title: "Sotsiaalhoolekande seadus § 23 Tugiisikuteenuse eesmärk ja sisu" }
  ];
  if (extraSource) sources.push(extraSource);
  return {
    reply: "Koduteenus ja tugiisikuteenus erinevad eesmärgi poolest.",
    sources,
    rag_trace: {
      query_plan: { mode: "comparison" },
      evidence_package: { mode: "comparison" }
    }
  };
}

test("normalizeText strips diacritics and case", () => {
  assert.equal(normalizeText("Tugiisikuteenuse EESMÄRK ja sisu"), "tugiisikuteenuse eesmark ja sisu");
  assert.equal(normalizeText("  Vältimatu   abi "), "valtimatu abi");
});

test("comparison case passes with exact paragraph sources", () => {
  const result = evaluateGoldenCase(comparisonCase, comparisonBody());
  assert.equal(result.ok, true);
});

test("comparison case fails when unrelated paragraph displayed", () => {
  const result = evaluateGoldenCase(comparisonCase, comparisonBody({
    extraSource: { title: "Sotsiaalhoolekande seadus § 44 Võlanõustamisteenus" }
  }));
  assert.equal(result.ok, false);
  const failed = result.checks.filter(check => !check.ok).map(check => check.name);
  assert.deepEqual(failed, ["displayed_excludes:§ 44"]);
});

test("mode mismatch is reported", () => {
  const body = comparisonBody();
  body.rag_trace.query_plan.mode = "default";
  const result = evaluateGoldenCase(comparisonCase, body);
  assert.equal(result.ok, false);
  assert.ok(result.checks.find(check => check.name === "mode" && !check.ok));
});

test("answer_must_include_any passes when one alternative matches", () => {
  const testCase = {
    id: "life",
    family: "life_situation",
    expect: { answer_must_include_any: ["vältimatu", "sotsiaalosakon"] }
  };
  const result = evaluateGoldenCase(testCase, { reply: "Pöördu kohaliku omavalitsuse sotsiaalosakonda." });
  assert.equal(result.ok, true);
});

test("displayed_url_required fails without urls", () => {
  const testCase = { id: "org", family: "organization", expect: { displayed_url_required: true } };
  const failing = evaluateGoldenCase(testCase, { sources: [{ title: "Astangu" }] });
  assert.equal(failing.ok, false);
  const passing = evaluateGoldenCase(testCase, { sources: [{ title: "Astangu", url: "https://astangu.ee" }] });
  assert.equal(passing.ok, true);
});

test("crisis expectation reads isCrisis flag", () => {
  const testCase = { id: "edge_crisis", family: "edge", expect: { crisis: true } };
  assert.equal(evaluateGoldenCase(testCase, { isCrisis: true, reply: "Helista 112" }).ok, true);
  assert.equal(evaluateGoldenCase(testCase, { isCrisis: false, reply: "" }).ok, false);
});

test("extractResponseFacts reads package-aware flag from source_packages", () => {
  const facts = extractResponseFacts({
    rag_trace: { source_packages: { package_aware_answering_used: true }, query_plan: { mode: "municipality_service_benefit_list" } }
  });
  assert.equal(facts.package_aware, true);
  assert.equal(facts.mode, "municipality_service_benefit_list");
});

test("summarizeResults aggregates by family", () => {
  const summary = summarizeResults([
    { id: "a", family: "kov", ok: true },
    { id: "b", family: "kov", ok: false },
    { id: "c", family: "legal", ok: true }
  ]);
  assert.equal(summary.total, 3);
  assert.equal(summary.pass, 2);
  assert.deepEqual(summary.by_family.kov, { pass: 1, fail: 1 });
  assert.deepEqual(summary.failed_case_ids, ["b"]);
});
