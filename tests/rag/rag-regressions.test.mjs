import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { formatSourceLabel } from "../../components/chat/utils/sources.js";
import { validateExactFactAnswer } from "../../lib/chat/factContract.js";
import { normalizePageReferences } from "../../lib/chat/pageRanges.js";
import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { selectSpecificResearchFactGroups } from "../../lib/chat/retrievalContextAssembler.js";
import { buildSourceAttribution } from "../../lib/chat/sourceAttribution.js";

describe("allikaviite leheküljed", () => {
  test("sordib, eemaldab duplikaadid ja ühendab järjestikused leheküljed", () => {
    assert.equal(normalizePageReferences([68, 64, 67, 65, 66]), "64–68");
    assert.equal(normalizePageReferences(["68", "64", "67"]), "64, 67–68");
    assert.equal(normalizePageReferences([64, 64, 65, 66, 68]), "64–66, 68");
    assert.equal(normalizePageReferences(["67–68", "64", "65–66"]), "64–68");
  });

  test("kasutajale kuvatav allikaviide kasutab sama normaliseerimist", () => {
    const label = formatSourceLabel({
      authors: ["Elin Kütt"],
      year: 2016,
      title: "Sotsiaaltöötajate tööalase toetuse kogemused",
      journalTitle: "Sotsiaaltöö",
      issueLabel: "3/2016",
      pages: [68, 64, 67, 65, 66]
    });
    assert.match(label, /lk 64–68/u);
  });
});

describe("faktiküsimuse planner", () => {
  const specificResearchCases = [
    "Mitu intervjuud tehti töötamise toetamise uuringus?",
    "Kui paljude intervjuude põhjal tehti Elin Küti kirjeldatud töötamise toetamise uuring?",
    "Mitu lapse perest eraldamise otsust uuringus vaadeldi ja mis aasta otsused need olid?",
    "Laste eraldamise otsused: arv ja aasta?"
  ];

  for (const message of specificResearchCases) {
    test(`valib ühe uuringu faktiraja: ${message}`, () => {
      const plan = buildQuestionPlan({ message });
      assert.equal(plan.mode, "specific_research_fact");
      assert.equal(plan.retrieval_strategy, "document_identity_then_fact");
      assert.equal(plan.answer_contract, "same_identified_document_fact_required");
    });
  }

  test("ei neela õigus-, KOV-, autori- ega sünteesipäringut faktirajale", () => {
    assert.equal(buildQuestionPlan({ message: "Mida ütleb SHS § 15?" }).mode, "legal_exact");
    assert.equal(buildQuestionPlan({ message: "Millised on Tartu linna koduteenuse tingimused?" }).mode, "kov_service_or_benefit");
    assert.equal(buildQuestionPlan({ message: "Millest on Laur Raudsoo kirjutanud?" }).mode, "person_source_lookup");
    assert.equal(buildQuestionPlan({ message: "Millised murekohad korduvad eri sotsiaaltöö uuringutes?" }).mode, "overview_synthesis");
  });
});

describe("uuringudokumendi identiteet", () => {
  const plan = buildQuestionPlan({
    message: "Kui paljude intervjuude põhjal tehti Elin Küti kirjeldatud töötamise toetamise uuring?"
  });

  test("õigusallikas ei saa uuringuidentiteediks", () => {
    const correct = {
      docId: "elin-2016",
      title: "Sotsiaaltöötajate tööalase toetuse kogemused",
      authors: ["Elin Kütt"],
      sourceType: "journal_article",
      retrievalChannels: ["author_match", "title_match"]
    };
    const law = {
      docId: "shs",
      title: "Sotsiaalhoolekande seadus: töötamise toetamise uuring ja intervjuud",
      authors: ["Elin Kütt"],
      sourceType: "national_law",
      retrievalChannels: ["exact_phrase", "title_match"]
    };
    const result = selectSpecificResearchFactGroups("", [law, correct], plan);
    assert.equal(result.matched, true);
    assert.equal(result.selectedDocumentId, "elin-2016");
    assert.equal(result.groups[0], correct);
  });

  test("kahe sisuliselt võrdse uuringukandidaadi korral keeldub valimast", () => {
    const groups = ["a", "b"].map(docId => ({
      docId,
      title: "Sotsiaaltöötajate tööalase toetuse kogemused",
      authors: ["Elin Kütt"],
      sourceType: "journal_article",
      retrievalChannels: ["author_match", "title_match"]
    }));
    const result = selectSpecificResearchFactGroups("", groups, plan);
    assert.equal(result.matched, false);
    assert.equal(result.confidence, "ambiguous");
  });
});

describe("täpse faktivastuse värav", () => {
  test("võrdsustab eesti arvsõnad ja numbrikujud ühe renderdatud allika sees", () => {
    const result = validateExactFactAnswer({
      message: "Mitu intervjuud tehti töötamise toetamise uuringus?",
      reply: "Tehti 7 intervjuud: 6 individuaalset ja 1 rühmaintervjuu.",
      sources: [{
        id: "elin-2016",
        documentId: "elin-2016",
        title: "Sotsiaaltöötajate tööalase toetuse kogemused",
        evidenceText: "(1) Elin Kütt. Sotsiaaltöötajate tööalase toetuse kogemused.\nTehti seitse intervjuud: kuus individuaalset ja üks rühmaintervjuu."
      }],
      retrievalMeta: {
        documentIdentityEvidence: {
          required: true,
          matched: true,
          confidence: "high",
          selectedDocumentId: "elin-2016",
          selectedTitle: "Sotsiaaltöötajate tööalase toetuse kogemused"
        }
      }
    });
    assert.equal(result.passed, true);
    assert.equal(result.trace.reason, "all_claims_in_one_rendered_source");
  });

  test("keelab eri allikate arvude kokkusegamise", () => {
    const result = validateExactFactAnswer({
      message: "Mitu intervjuud tehti uuringus?",
      reply: "Uuringus tehti 17 intervjuud, neist 6 individuaalset.",
      sources: [
        { id: "a", evidenceText: "Uuringus tehti 17 intervjuud." },
        { id: "b", evidenceText: "Teises uuringus tehti kuus individuaalset intervjuud." }
      ]
    });
    assert.equal(result.passed, false);
    assert.equal(result.trace.reason, "cross_source_numeric_mix");
  });

  test("eristab küsitud andmeaasta allika ilmumisaastast", () => {
    const result = validateExactFactAnswer({
      message: "Mitu lapse perest eraldamise otsust uuringus vaadeldi ja mis aasta otsused need olid?",
      reply: "Vaadeldi 169 otsust 2018. aastast. Artikkel ilmus 2022. aastal.",
      sources: [{
        id: "merli-2022",
        evidenceText: "(1) Merli Laur. source_year=2022.\nKokku analüüsiti 169 maakohtu lõpplahendit, mis jõustusid 2018. aastal."
      }]
    });
    assert.equal(result.passed, true);
    assert.equal(result.trace.year_mode, "body_evidence_year");
  });

  test("ei luba vastata allika ilmumisaastaga, kui küsiti andmeaastat", () => {
    const result = validateExactFactAnswer({
      message: "Mitu lapse perest eraldamise otsust uuringus vaadeldi ja mis aasta otsused need olid?",
      reply: "Vaadeldi 169 otsust 2022. aastal.",
      sources: [{
        id: "merli-2022",
        evidenceText: "(1) Merli Laur. source_year=2022.\nKokku analüüsiti 169 maakohtu lõpplahendit, mis jõustusid 2018. aastal."
      }]
    });
    assert.equal(result.passed, false);
    assert.equal(result.trace.reason, "source_year_not_body_year");
  });
});

test("kuvatud allika ID jääb valitud tõendiallika ID-ga samaks", () => {
  const source = {
    source_id: "elin-2016",
    sourceType: "journal_article",
    title: "Sotsiaaltöötajate tööalase toetuse kogemused",
    evidenceText: "Tehti seitse intervjuud: kuus individuaalset ja üks rühmaintervjuu."
  };
  const attribution = buildSourceAttribution(
    "Tehti 7 intervjuud: 6 individuaalset ja 1 rühmaintervjuu.",
    [source]
  );
  assert.deepEqual(attribution.selected_context_source_ids, ["elin-2016"]);
  assert.deepEqual(attribution.displayed_source_ids, ["elin-2016"]);
  assert.equal(attribution.displayed_sources_subset_of_selected, true);
});
