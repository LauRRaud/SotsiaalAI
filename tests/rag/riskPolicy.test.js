import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRiskPolicyInstruction,
  classifyRagRisk,
  inferSourceEvidenceStrength,
  sourceMeetsEvidenceRequirement
} from "../../lib/rag/riskPolicy.js";

test("classifies general concept questions as low risk", () => {
  const policy = classifyRagRisk("Mis on juhtumikorraldus?");

  assert.equal(policy.riskLevel, "low");
  assert.equal(policy.requiredEvidence, "medium");
  assert.equal(policy.insufficientEvidenceMode, false);
  assert.equal(policy.preferredSourceTypes.includes("journal_article"), true);
});

test("classifies KOV service and form questions as medium risk", () => {
  const policy = classifyRagRisk("Kuidas taotleda Tartu linnas koduteenuse vormi?");

  assert.equal(policy.riskLevel, "medium");
  assert.equal(policy.requiredEvidence, "strong");
  assert.equal(policy.insufficientEvidenceMode, true);
  assert.equal(policy.preferredSourceTypes.includes("kov_service_info"), true);
  assert.equal(policy.preferredSourceTypes.includes("application_form"), true);
});

test("classifies legal, benefit amount and deadline questions as high risk", () => {
  const policy = classifyRagRisk("Kas inimesel on õigus toimetulekutoetusele ja mis on tähtaeg?");

  assert.equal(policy.riskLevel, "high");
  assert.equal(policy.requiredEvidence, "strong");
  assert.equal(policy.insufficientEvidenceMode, true);
  assert.equal(policy.preferredSourceTypes.includes("national_law"), true);
  assert.equal(policy.preferredSourceTypes.includes("kov_regulation"), true);
});

test("classifies inflected legal provision lookup questions as high risk", () => {
  const policy = classifyRagRisk("Millised Sotsiaalhoolekande seaduse paragrahvid reguleerivad toimetulekutoetust?");

  assert.equal(policy.riskLevel, "high");
  assert.equal(policy.requiredEvidence, "strong");
  assert.equal(policy.insufficientEvidenceMode, true);
});

test("crisis option forces high risk", () => {
  const policy = classifyRagRisk("Vajan abi", { isCrisis: true });

  assert.equal(policy.riskLevel, "high");
  assert.equal(policy.reasons.includes("crisis"), true);
});

test("risk policy instruction tells model to avoid unsupported high-risk facts", () => {
  const policy = classifyRagRisk("Mis summa on hooldajatoetusel?");
  const instruction = buildRiskPolicyInstruction(policy, "et");

  assert.match(instruction, /RAG_RISK_POLICY: high/);
  assert.match(instruction, /Nõutav tõendusaste: strong/);
  assert.match(instruction, /RAG_CONTEXT seda otseselt kinnitab/);
  assert.match(instruction, /mida allikad kinnitavad/);
});

test("official source types meet strong evidence requirements", () => {
  const policy = classifyRagRisk("Kas inimesel on õigus toimetulekutoetusele?");
  const result = sourceMeetsEvidenceRequirement({
    source_type: "national_law",
    source_status: "active"
  }, policy);

  assert.equal(result.ok, true);
  assert.equal(result.strength, "strong");
  assert.equal(result.reason, "official_source_type");
});

test("municipality_kov service items meet medium-risk strong evidence requirements", () => {
  const policy = classifyRagRisk("Kuidas taotleda Viljandi vallas koduteenust?");
  const result = sourceMeetsEvidenceRequirement({
    source_type: "municipality_kov",
    item_type: "service",
    source_status: "active"
  }, policy);

  assert.equal(policy.riskLevel, "medium");
  assert.equal(result.ok, true);
  assert.equal(result.strength, "strong");
  assert.equal(result.reason, "official_source_type");
});

test("background sources do not meet high-risk strong evidence requirements", () => {
  const policy = classifyRagRisk("Mis summa on hooldajatoetusel?");
  const result = sourceMeetsEvidenceRequirement({
    source_type: "journal_article",
    source_status: "active"
  }, policy);

  assert.equal(result.ok, false);
  assert.equal(result.strength, "weak");
  assert.equal(result.reason, "background_source_type");
});

test("historical sources are insufficient for current medium/high risk evidence", () => {
  const policy = classifyRagRisk("Kuidas taotleda Tartu linnas koduteenust?");
  const evidence = inferSourceEvidenceStrength({
    source_type: "kov_service_info",
    historical: true
  }, policy);

  assert.equal(evidence.strength, "insufficient");
  assert.equal(evidence.reason, "historical_source_not_current_evidence");
});
