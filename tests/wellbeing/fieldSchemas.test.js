import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  WELLBEING_FIELD_SCHEMAS,
  validateWellbeingStandardizedFields,
  wellbeingFieldSchema
} from "../../lib/wellbeing/fieldSchemas.js";
import { buildHardCaseRecord } from "../../lib/wellbeing/hardCase.js";
import { buildInterruptionsRecord } from "../../lib/wellbeing/interruptions.js";
import { buildQuickCheckRecord } from "../../lib/wellbeing/quickCheck.js";
import { buildRecoveryRecord } from "../../lib/wellbeing/recovery.js";
import { buildRoleBoundariesRecord } from "../../lib/wellbeing/roleBoundaries.js";
import { buildStarterSupportRecord } from "../../lib/wellbeing/starterSupport.js";
import { buildWorkBoundariesRecord } from "../../lib/wellbeing/workBoundaries.js";
import { buildWorkProcessesRecord } from "../../lib/wellbeing/workProcesses.js";
import { buildWorkplaceViolenceRecord } from "../../lib/wellbeing/workplaceViolence.js";

const COMPONENTS = Object.freeze({
  "quick-check": "QuickCheckWorkflow.jsx",
  "hard-case": "HardCaseWorkflow.jsx",
  "workplace-violence": "WorkplaceViolenceWorkflow.jsx",
  recovery: "RecoveryWorkflow.jsx",
  "work-boundaries": "WorkBoundariesWorkflow.jsx",
  interruptions: "InterruptionsWorkflow.jsx",
  "work-processes": "WorkProcessesWorkflow.jsx",
  "role-boundaries": "RoleBoundariesWorkflow.jsx",
  "starter-support": "StarterSupportWorkflow.jsx"
});

const BUILDERS = Object.freeze({
  "quick-check": buildQuickCheckRecord,
  "hard-case": buildHardCaseRecord,
  "workplace-violence": buildWorkplaceViolenceRecord,
  recovery: buildRecoveryRecord,
  "work-boundaries": buildWorkBoundariesRecord,
  interruptions: buildInterruptionsRecord,
  "work-processes": buildWorkProcessesRecord,
  "role-boundaries": buildRoleBoundariesRecord,
  "starter-support": buildStarterSupportRecord
});

/** Liidese `initialFields` objektiliteraal JSON-ina. */
function uiInitialFields(workflowType) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "components", "wellbeing", COMPONENTS[workflowType]),
    "utf8"
  );
  const match = source.match(/const initialFields = (\{[\s\S]*?\n\});/u);
  assert.ok(match, `${workflowType}: initialFields puudub`);
  const json = match[1]
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/([{,]\s*)([A-Za-z0-9_]+):/gu, '$1"$2":')
    .replace(/,(\s*[}\]])/gu, "$1");
  return JSON.parse(json);
}

/** Sobiv väärtus välja liigi kohta — kehtiva näidise ehitamiseks. */
function validValue(spec) {
  switch (spec.kind) {
    case "enum": return spec.values[0];
    case "boolean": return false;
    case "text": return "üldistatud kirjeldus";
    case "enum_list": return [spec.values[0]];
    case "text_list": return ["ülesanne"];
    default: throw new Error(`tundmatu liik ${spec.kind}`);
  }
}

function validFields(workflowType) {
  const schema = wellbeingFieldSchema(workflowType);
  return Object.fromEntries(
    Object.entries(schema.fields).map(([key, spec]) => [key, validValue(spec)])
  );
}

function expectRejected(workflowType, fields, expectedDetailKey) {
  assert.throws(
    () => validateWellbeingStandardizedFields(workflowType, fields),
    (error) => {
      assert.equal(error.message, "wellbeing.errors.invalid_standardized_fields");
      assert.equal(error.status, 400);
      assert.ok(error.details?.[expectedDetailKey], `${workflowType}: details.${expectedDetailKey} puudub`);
      return true;
    }
  );
}

for (const workflowType of Object.keys(WELLBEING_FIELD_SCHEMAS)) {
  /* Kriteerium: „Testida iga töövoo kõiki välju vähemalt ühe vale tüübi ja
     tundmatu enumiga." Ei ole valimit — käiakse iga välja läbi. */
  test(`${workflowType}: every field rejects a wrong type and an unknown value`, () => {
    const schema = wellbeingFieldSchema(workflowType);
    assert.doesNotThrow(() => validateWellbeingStandardizedFields(workflowType, validFields(workflowType)));

    for (const [key, spec] of Object.entries(schema.fields)) {
      const wrongType = spec.kind === "boolean" ? "false" : { nested: true };
      expectRejected(workflowType, { ...validFields(workflowType), [key]: wrongType }, "invalid");

      if (spec.kind === "enum") {
        expectRejected(workflowType, { ...validFields(workflowType), [key]: "totally_unknown" }, "invalid");
      }
      if (spec.kind === "enum_list") {
        expectRejected(workflowType, { ...validFields(workflowType), [key]: ["totally_unknown"] }, "invalid");
      }
      if (spec.kind === "text") {
        expectRejected(workflowType, { ...validFields(workflowType), [key]: "x".repeat(4001) }, "invalid");
      }
    }
  });

  test(`${workflowType}: missing and unknown keys both fail closed`, () => {
    const fields = validFields(workflowType);
    const [firstKey] = Object.keys(fields);
    const { [firstKey]: _dropped, ...withoutOne } = fields;

    expectRejected(workflowType, withoutOne, "missing");
    expectRejected(workflowType, { ...fields, injectedByOldClient: "x" }, "unknown");
  });

  /* Liides ei tohi saata väärtust, mida server ei tunne — muidu oleks range
     skeem kasutaja jaoks lihtsalt katkine salvestusnupp. */
  test(`${workflowType}: the UI's own defaults pass the server schema`, () => {
    assert.doesNotThrow(() => validateWellbeingStandardizedFields(workflowType, uiInitialFields(workflowType)));
  });

  test(`${workflowType}: the UI field set and the schema field set are the same set`, () => {
    assert.deepEqual(
      Object.keys(uiInitialFields(workflowType)).toSorted(),
      Object.keys(wellbeingFieldSchema(workflowType).fields).toSorted()
    );
  });

  /* Skeemiversiooni tõstmine ilma uue skeemita peab kukkuma siin, mitte
     toodangus — vana skeem uue versiooni peal tähendaks vaikset auku. */
  test(`${workflowType}: the schema declares the same schemaVersion as the builder`, () => {
    const built = BUILDERS[workflowType]({ standardizedFields: validFields(workflowType) });
    assert.equal(built.schemaVersion, wellbeingFieldSchema(workflowType).schemaVersion);
  });
}

/* SOL-WB-03 tuum: TEADMATUS EI OLE OHUTUS. Enne parandust andis tundmatu
   `dangerStatus` (nt vale kirjapilt) `no_immediate_danger` ja ükski turvateade
   ei käivitunud. Negatiivkontroll on skoorija ise: ta EI OLE muutunud, seega
   ilma väravata oleks vale vastus endiselt „ohtu ei ole". */
test("an unknown safety value is refused, not silently scored as safe", async () => {
  const { computeWorkplaceViolenceResult } = await import("../../lib/wellbeing/workplaceViolence.js");
  const { computeHardCaseResult } = await import("../../lib/wellbeing/hardCase.js");

  const violence = computeWorkplaceViolenceResult({ ...validFields("workplace-violence"), dangerStatus: "ONGOING" });
  assert.equal(violence.signalLevel, "no_immediate_danger");
  assert.equal(violence.safetyNoticeRequired, false);

  const hardCase = computeHardCaseResult({ ...validFields("hard-case"), immediateDanger: "YES" });
  assert.equal(hardCase.safetyNoticeRequired, false);

  expectRejected("workplace-violence", { ...validFields("workplace-violence"), dangerStatus: "ONGOING" }, "invalid");
  expectRejected("hard-case", { ...validFields("hard-case"), immediateDanger: "YES" }, "invalid");
});

test("a string boolean no longer flips a negative answer into a positive one", () => {
  const fields = { ...validFields("quick-check"), difficultCaseMarker: "false" };
  assert.equal(Boolean(fields.difficultCaseMarker), true, "negatiivkontroll: string 'false' ON tõene");
  expectRejected("quick-check", fields, "invalid");
});

test("an unsupported workflow type is refused by name", () => {
  assert.throws(
    () => validateWellbeingStandardizedFields("overview", {}),
    /wellbeing\.errors\.workflow_not_supported/u
  );
});
