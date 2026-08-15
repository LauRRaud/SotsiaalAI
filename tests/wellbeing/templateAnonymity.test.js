import assert from "node:assert/strict";
import test from "node:test";

import { detectAnonymityIssues } from "../../lib/covisionShared.js";
import { buildWellbeingShareableDraft } from "../../lib/wellbeing/supportDraftText.js";

const WORKFLOW_TYPES = [
  "quick-check",
  "overview",
  "hard-case",
  "workplace-violence",
  "recovery",
  "work-boundaries",
  "interruptions",
  "work-processes",
  "role-boundaries",
  "starter-support"
];

const OUTPUTS = [
  ["covision_input", "covision"],
  ["manager_memo", "manager"],
  ["support_request", "pilot_support_contact"]
];

test("every standard shareable template passes the anonymity gate", () => {
  for (const workflowType of WORKFLOW_TYPES) {
    for (const [outputType, recipientType] of OUTPUTS) {
      const draft = buildWellbeingShareableDraft({
        sourceWorkflowType: workflowType,
        outputType,
        recipientType,
        context: {}
      });
      const issues = detectAnonymityIssues(draft.generatedText);
      assert.deepEqual(
        issues,
        [],
        `${workflowType}/${outputType} template must pass the gate, got: ${JSON.stringify(issues.map((issue) => issue.type))}`
      );
    }
  }
});

test("a capitalized word at line end followed by a capitalized line start is not a name", () => {
  const issues = detectAnonymityIssues("Teema: Kiirkontroll\nOlukorra üldistatud kirjeldus: töökorralduslik koormus.");
  assert.deepEqual(issues.map((issue) => issue.type), []);
});

test("a real single-line name is still detected", () => {
  const types = detectAnonymityIssues("Klient Mari Mets helistas kontorisse.").map((issue) => issue.type);
  assert.equal(types.includes("name"), true);
});

test("a real name split across a line break is detected", () => {
  for (const separator of ["\n", "\r\n"]) {
    const types = detectAnonymityIssues(`Juhtumis osaleb Mari${separator}Mets ning vajab tuge.`).map(
      (issue) => issue.type
    );
    assert.equal(types.includes("name"), true, `name must be detected across ${JSON.stringify(separator)}`);
  }
});

test("the full direct identifier set is still detected on one line", () => {
  const issues = detectAnonymityIssues(
    "Klient Mari Mets elab aadressil Tamme tn 12, telefon +372 5123 4567, isikukood 48901011234 ja e-post mari@example.ee."
  );
  const types = new Set(issues.map((issue) => issue.type));

  assert.equal(types.has("name"), true);
  assert.equal(types.has("address"), true);
  assert.equal(types.has("phone"), true);
  assert.equal(types.has("personal_code"), true);
  assert.equal(types.has("email"), true);
});

test("identifier detection issues never echo suggestions without type context", () => {
  const issues = detectAnonymityIssues("Klient Mari Mets helistas.");
  for (const issue of issues) {
    assert.equal(typeof issue.type, "string");
    assert.equal(issue.type.length > 0, true);
  }
});
