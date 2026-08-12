import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { DATA_EXPORT_REGISTRY } from "../../lib/dataExport/registry.js";

const SCHEMA = fs.readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");

/** Mudeli skalaarväljad skeemist — ilma kommentaaride ja seosteta. */
function modelScalarFields(model) {
  const block = SCHEMA.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`, "u"))[1]
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\/\/[^\n]*/gu, "");
  const fields = [];
  for (const line of block.split("\n")) {
    const match = line.match(/^\s{2}([A-Za-z][A-Za-z0-9_]*)\s+([A-Za-z][A-Za-z0-9_]*)(\[\])?(\?)?/u);
    if (!match) continue;
    const [, name, type] = match;
    /* Seosed ja tagasiviited ei ole andmeväljad. */
    if (/^[A-Z]/u.test(type) && !["String", "Int", "Boolean", "DateTime", "Json", "Float", "Decimal", "BigInt", "Bytes"].includes(type)) continue;
    fields.push(name);
  }
  return fields;
}

function entry(name) {
  return DATA_EXPORT_REGISTRY.find((item) => item.name === name);
}

async function collect(name, db) {
  return entry(name).collect({ db, userId: "user_1" });
}

function ndjson(files, fileName) {
  const file = files.find((item) => item.name === fileName);
  assert.ok(file, `${fileName} puudub`);
  return file.content.toString("utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

/* SOL-WB-18 kriteerium: „võrrelda ekspordi semantilist täielikkust DB
   omanikuvaatega". Nimekiri on VÄLISTUSTE oma, mitte kaasamiste oma — nii
   kukub test siis, kui skeemi lisandub uus veerg ja keegi unustab otsustada,
   kas ta kuulub koopiasse. Vaikne väljajätmine oligi leid. */
test("every WellbeingRecord column is either exported or explicitly excluded", async () => {
  /* Rida on TÄIS: `JSON.stringify` viskaks `undefined` väljad minema ja test
     mõõdaks siis fikstuuri, mitte projektsiooni. */
  const files = await collect("wellbeing_records", {
    wellbeingRecord: {
      findMany: async () => [{
        id: "rec_1",
        ownerUserId: "user_1",
        schemaVersion: "1.0",
        scoringVersion: "quick-check-v1",
        workflowType: "quick-check",
        period: "current",
        roleGroup: "SOCIAL_WORKER",
        standardizedFields: { workloadLevel: "high" },
        computedSignal: { signalLevel: "yellow" },
        loadFactors: ["workload.high"],
        resourceFactors: [],
        riskMarkers: [],
        recommendedActions: [],
        visibility: "private",
        aggregationEligible: true,
        supersedesRecordId: "rec_0",
        supersededBy: { id: "rec_2" },
        checkpointDueOn: new Date("2026-08-01T09:00:00.000Z"),
        checkpointAnsweredAt: new Date("2026-08-02T09:00:00.000Z"),
        checkpoint: { id: "cp_1", nextStep: "räägin juhiga" },
        createdAt: new Date(),
        updatedAt: new Date()
      }]
    }
  });
  const [row] = ndjson(files, "wellbeing-records.ndjson");
  const exported = new Set(Object.keys(row));

  const excluded = new Set([
    /* Sisemine võti — kasutajale ei ütle ta midagi ja koopia ei ole varukoopia. */
    "id",
    /* Omanik on koopia saaja ise; tema ID kordamine igal real ei lisa infot. */
    "ownerUserId"
  ]);

  const missing = modelScalarFields("WellbeingRecord")
    .filter((field) => !exported.has(field) && !excluded.has(field));

  assert.deepEqual(missing, [], "need veerud ei ole ei eksporditud ega teadlikult välistatud");
});

test("every WellbeingOutputDraft column is either exported or explicitly excluded", async () => {
  const files = await collect("wellbeing_output_drafts", {
    wellbeingOutputDraft: {
      findMany: async () => [{
        id: "draft_1",
        userId: "user_1",
        sourceWorkflowType: "quick-check",
        sourceRecordId: "rec_1",
        outputType: "manager_memo",
        recipientType: "manager",
        generatedText: "genereeritud",
        editedText: "toimetatud",
        userReviewed: true,
        userConfirmed: true,
        visibility: "private",
        status: "confirmed",
        schemaVersion: "1.0",
        covisionCaseId: "case_1",
        handedOffAt: new Date("2026-05-26T10:00:00.000Z"),
        createdAt: new Date(),
        updatedAt: new Date()
      }]
    }
  });

  const [row] = ndjson(files, "wellbeing-output-drafts.ndjson");
  const exported = new Set(Object.keys(row));
  const excluded = new Set([
    "id",
    "userId",
    /* Kovisiooni juhtum on JAGATUD objekt: tema sisu ei kuulu ühe osaleja
       koopiasse. Kaasa käib ainult fakt, et üleandmine toimus. */
    "covisionCaseId"
  ]);

  const missing = modelScalarFields("WellbeingOutputDraft")
    .filter((field) => !exported.has(field) && !excluded.has(field));
  assert.deepEqual(missing, []);

  assert.equal(row.handedOff, true, "üleandmise FAKT on koopias");
  assert.equal(row.editedText, "toimetatud");
  assert.equal(JSON.stringify(row).includes("case_1"), false, "võõra objekti ID ei lekita");
});

/* Kriteeriumi teine pool: parandus ja handoff peavad koopias LOETAVAD olema. */
test("a corrected record exports both ends of the chain and its checkpoint", async () => {
  const dueOn = new Date("2026-08-01T09:00:00.000Z");
  const files = await collect("wellbeing_records", {
    wellbeingRecord: {
      findMany: async () => [
        {
          id: "rec_1",
          workflowType: "quick-check",
          standardizedFields: { workloadLevel: "high" },
          computedSignal: { signalLevel: "yellow" },
          aggregationEligible: false,
          supersedesRecordId: null,
          supersededBy: { id: "rec_2" },
          checkpointDueOn: null,
          checkpointAnsweredAt: null,
          checkpoint: null,
          createdAt: new Date("2026-07-20T09:00:00.000Z"),
          updatedAt: new Date("2026-07-21T09:00:00.000Z")
        },
        {
          id: "rec_2",
          workflowType: "quick-check",
          standardizedFields: { workloadLevel: "moderate" },
          computedSignal: { signalLevel: "green" },
          aggregationEligible: true,
          supersedesRecordId: "rec_1",
          supersededBy: null,
          checkpointDueOn: dueOn,
          checkpointAnsweredAt: new Date("2026-08-02T09:00:00.000Z"),
          checkpoint: { id: "cp_1", nextStep: "räägin juhiga", followUp: { state: "kept" } },
          createdAt: new Date("2026-07-21T09:00:00.000Z"),
          updatedAt: new Date("2026-08-02T09:00:00.000Z")
        }
      ]
    }
  });

  const rows = ndjson(files, "wellbeing-records.ndjson");
  assert.equal(rows.length, 2);

  /* Ahel on loetav MÕLEMAST otsast: ilma tagasiviiteta ei saaks koopia lugeja
     aru, et vana kirje on asendatud. */
  assert.equal(rows[0].supersededByRecordId, "rec_2");
  assert.equal(rows[0].aggregationEligible, false);
  assert.equal(rows[1].supersedesRecordId, "rec_1");

  /* Kokkulepe ja tema vastus — täpselt see, mida kasutaja ei saanud taastada. */
  assert.equal(rows[1].checkpointDueOn, dueOn.toISOString());
  assert.equal(rows[1].checkpoint.nextStep, "räägin juhiga");
  assert.equal(rows[1].checkpoint.followUp.state, "kept");
  assert.equal(rows[1].checkpointAnsweredAt, "2026-08-02T09:00:00.000Z");
});

/* Negatiivkontroll: vana projektsioon (ilma elutsükliväljadeta) EI läbiks
   ülalolevat täielikkusväravat — muidu mõõdaks test lihtsalt seda, et JSON
   tekkis. */
test("the old projection would fail the completeness gate", () => {
  const oldKeys = new Set([
    "schemaVersion", "scoringVersion", "workflowType", "period", "roleGroup",
    "standardizedFields", "computedSignal", "loadFactors", "resourceFactors",
    "riskMarkers", "recommendedActions", "visibility", "createdAt", "updatedAt"
  ]);
  const excluded = new Set(["id", "ownerUserId"]);
  const missing = modelScalarFields("WellbeingRecord")
    .filter((field) => !oldKeys.has(field) && !excluded.has(field));

  assert.deepEqual(missing.toSorted(), [
    "aggregationEligible",
    "checkpoint",
    "checkpointAnsweredAt",
    "checkpointDueOn",
    "supersedesRecordId"
  ]);
});
