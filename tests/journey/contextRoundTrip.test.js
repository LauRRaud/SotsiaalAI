import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeJourneyCreateInput,
  normalizeJourneyUpdateInput
} from "../../lib/journey/validation.js";
import { buildJourneyDraft } from "../../lib/journey/draft.js";
import { serializeJourney } from "../../lib/journey/serializers.js";

const STRUCTURED_CONTEXT = Object.freeze({
  source: "manual_structured_journey_start",
  overviewType: "structured",
  lifeDomains: ["igapäevaelu toimingud", "elukeskkond"],
  needTags: ["liikumisabivahend"],
  keywords: ["rollaator", "koduabi"],
  assistiveDevices: [
    {
      id: "assistive-rollator",
      name: "rollaator",
      status: "NOT_WORKING",
      useContext: "HOME",
      issue: "Pidur ei tööta.",
      supportNeed: "Vajab parandust või asendust.",
      relatedNeedTags: ["liikumisabivahend"],
      relatedLifeDomains: ["füüsiline tervis", "igapäevaelu toimingud"],
      relatedDocuments: ["abivahendi kaart"],
      suggestedActions: ["võta ühendust spetsialistiga"]
    }
  ],
  activityLog: [
    {
      id: "activity-overview",
      type: "created_overview",
      title: "teekonna ülevaade koostatud",
      description: "Algne struktureeritud ülevaade.",
      date: "2026-08-13T08:00:00.000Z"
    }
  ],
  helpMediation: {
    categoryCode: "HOME_HELP",
    needTags: ["koduabi"],
    lifeDomains: ["igapäevaelu toimingud"],
    relatedServiceCategories: ["Kodune abi ja hooldus"]
  },
  serviceContinuity: {
    serviceName: "Koduteenus",
    currentProvider: "Näidispartner",
    municipality: "Tartu linn",
    hasExistingService: true,
    knownEndDate: true,
    endDate: "2026-09-01",
    hasDecisionOrPlan: true,
    documentAttached: false,
    kovAlreadyInvolved: true,
    providerAlreadyInvolved: true,
    userGoal: "Teenuse katkematu jätkumine",
    updatedAt: "2026-08-13T08:15:00.000Z"
  }
});

function containsObjectString(value) {
  if (value === "[object Object]") return true;
  if (Array.isArray(value)) return value.some(containsObjectString);
  if (value && typeof value === "object") return Object.values(value).some(containsObjectString);
  return false;
}

test("SOL-JOUR-03: structured context survives create, serialize and update normalization", () => {
  const draft = buildJourneyDraft({
    situation: "Inimene vajab katkise rollaatori tõttu koduabi ja transpordi tuge."
  });
  const draftContext = {
    ...draft.context,
    ...STRUCTURED_CONTEXT
  };
  const created = normalizeJourneyCreateInput({
    ...draft,
    context: draftContext
  });
  const serialized = serializeJourney({
    id: "journey-1",
    ownerUserId: "owner-1",
    createdAt: new Date("2026-08-13T08:00:00.000Z"),
    updatedAt: new Date("2026-08-13T08:15:00.000Z"),
    ...created
  });
  const updated = normalizeJourneyUpdateInput({ context: serialized.context });

  assert.equal(draft.context.schemaVersion, 1);
  assert.equal(created.context.schemaVersion, 1);
  assert.deepEqual(updated.context, created.context);
  assert.deepEqual(created.context.assistiveDevices, STRUCTURED_CONTEXT.assistiveDevices);
  assert.deepEqual(created.context.activityLog, STRUCTURED_CONTEXT.activityLog);
  assert.deepEqual(created.context.helpMediation, STRUCTURED_CONTEXT.helpMediation);
  assert.deepEqual(created.context.serviceContinuity, STRUCTURED_CONTEXT.serviceContinuity);
  assert.equal(containsObjectString(updated), false);
});

test("SOL-JOUR-03: object values can never become the string [object Object]", () => {
  const normalized = normalizeJourneyCreateInput({
    summary: "Kontrollitud olukirjeldus",
    domains: [{ private: "object" }],
    context: {
      personWish: { private: "object" },
      lifeDomains: [{ private: "object" }],
      assistiveDevices: [{ name: { private: "object" } }]
    }
  });

  assert.equal(containsObjectString(normalized), false);
});
