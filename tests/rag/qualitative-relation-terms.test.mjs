import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { buildRequestedFactSlotContract } from "../../lib/chat/retrievalContextAssembler.js";

describe("kvalitatiivse faktiküsimuse sisulised seosesõnad", () => {
  test("kahe tingimuse loetelu ei kasuta kardinaali ega allikakirjelduse metasõnu", () => {
    const message = "Milliseid kaht keelelist turvatunnet toetavat tingimust kirjeldab Yuliia Kravchenko 2022. aasta artikkel Ukraina algkoolilaste uue kooliga kohanemisel?";
    const slot = buildQuestionPlan({ message, role: "SOCIAL_WORKER" })
      .semantic_candidates.requested_fact_slots.slots[0];

    assert.equal(slot.value_type, "entity_list");
    assert.equal(slot.minimum_answer_items, 2);
    assert.doesNotMatch(slot.relation_terms.join(" "), /\b(?:kaht|kirjeldab|artikkel)\b/u);
    assert.match(slot.relation_terms.join(" "), /\b(?:algkoolilaste|kooliga|kohanemisel)\b/u);
  });

  test("miks-küsimus eraldab põhjenduse autori, aasta ja pealkirja raamidest", () => {
    const message = "Miks peab Piret Salmistu 2024. aasta artiklis „Intiimsuse ja seksuaalsuse käsitlus üldhooldusteenusel” probleemseks seksuaalse aktiivsuse mõõtmist üksnes penetratiivse vahekorrana?";
    const requested = buildQuestionPlan({ message, role: "SOCIAL_WORKER" })
      .semantic_candidates.requested_fact_slots;
    const slot = requested.slots[0];

    assert.equal(requested.qualitative_clause_count, 1);
    assert.equal(slot.value_type, "text_relation");
    assert.doesNotMatch(slot.relation_terms.join(" "), /\b(?:piret|salmistu|2024|aasta|artiklis|intiimsuse|uldhooldusteenusel)\b/u);
    assert.match(slot.relation_terms.join(" "), /\bpenetratiivse\b/u);
    assert.match(slot.relation_terms.join(" "), /\bvahekorrana\b/u);
  });

  test("analüüsiaasta slot ei seo avaldamise metasõnu küsitud aastaga", () => {
    const message = "Mis aastal tegi Praxis artiklis „Tööampsu abil tööturule” kirjeldatud analüüsi, mis perioodi registriandmeid kasutati ning millist teist andmekogumisviisi rakendati?";
    const questionPlan = buildQuestionPlan({ message, role: "SOCIAL_WORKER" });
    const yearSlot = questionPlan.semantic_candidates.requested_fact_slots.slots[0];
    const evidenceText = "Artiklis kirjeldatud Praxise analüüsi tulemused avaldati 2025. aastal. " +
      "Mõttekoda Praxis analüüsis 2024. aastal tööampse. " +
      "Registriandmed pärinesid septembrist 2020 kuni detsembrini 2023 ning lisaks tehti intervjuud.";
    const contract = buildRequestedFactSlotContract({
      questionPlan,
      renderedGroups: [{ sourceId: "praxis-source", docId: "praxis-doc" }],
      renderedBlocks: [{ evidenceText }],
      specificResearchFactQuestion: true,
      documentIdentityEvidence: {
        matched: true,
        confidence: "high",
        selectedDocumentId: "praxis-doc"
      }
    }).trace;

    assert.doesNotMatch(yearSlot.relation_terms.join(" "), /\bkirjeldatud\b/u);
    assert.equal(contract.complete, true, JSON.stringify(contract));
    assert.equal(contract.slots[0].evidence_value, "2024");
  });

  test("sõnaline loeteluarv säilib komponendinõude kardinaalsusena", () => {
    const message = "Millist kolme komponenti ühendab tõenduspõhine praktika Karin Streimanni 2017. aasta artiklis vahendatud Rubin ja Babbie käsitluse järgi?";
    const requested = buildQuestionPlan({ message, role: "SOCIAL_WORKER" })
      .semantic_candidates.requested_fact_slots;
    const slot = requested.slots[0];

    assert.equal(requested.expected_cardinality, 3);
    assert.equal(slot.value_type, "entity_list");
    assert.equal(slot.expected_cardinality, 3);
    assert.equal(slot.minimum_answer_items, 3);
    assert.doesNotMatch(slot.relation_terms.join(" "), /\b(?:kolme|vahendatud|artiklis)\b/u);
  });
});
