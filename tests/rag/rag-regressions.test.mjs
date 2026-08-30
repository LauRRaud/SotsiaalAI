import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { formatSourceLabel, normalizeSourceLabelPages } from "../../components/chat/utils/sources.js";
import { shouldValidateExactFactAnswer, validateExactFactAnswer } from "../../lib/chat/factContract.js";
import { buildRagTraceFromAttribution } from "../../lib/chat/mainResponseHandler.js";
import { normalizePageReferences } from "../../lib/chat/pageRanges.js";
import {
  buildDocumentScopedMissingFactQueries,
  buildDocumentScopedResearchFactQueries,
  buildSpecificResearchFactQueries
} from "../../lib/chat/queryPlanner.js";
import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { resolveMultiQueryTopK } from "../../lib/chat/retrievalOrchestrator.js";
import {
  buildPercentCountSemanticsInstruction,
  buildRequestedFactSlotContract,
  buildRequestedQualitativeSlotContract,
  buildRequestedFactSlotCoverage,
  prioritizeRequestedNumericEvidence,
  prioritizeRequestedMetricSlotEvidence,
  selectSingleSourceNumericFactGroups,
  selectSpecificResearchFactGroups
} from "../../lib/chat/retrievalContextAssembler.js";
import { extractExplicitSourceYears } from "../../lib/chat/retrievalPlanning.js";
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
    assert.equal(
      normalizeSourceLabelPages("Merli Laur, 2022. Lapse perekonnast eraldamine · lk 2, 4, 7, 1, 5, 3 · Uurimus"),
      "Merli Laur, 2022. Lapse perekonnast eraldamine · lk 1–5, 7 · Uurimus"
    );
  });
});

describe("faktiküsimuse planner", () => {
  const specificResearchCases = [
    "Mitu intervjuud tehti töötamise toetamise uuringus?",
    "Kui paljude intervjuude põhjal tehti Elin Küti kirjeldatud töötamise toetamise uuring?",
    "Mitu lapse perest eraldamise otsust uuringus vaadeldi ja mis aasta otsused need olid?",
    "Laste eraldamise otsused: arv ja aasta?",
    "Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?",
    "Kui palju üle 60-aastasi oli 2023. aastal kuriteoohvrite ja ohvriabisse pöördunute seas ning mitu üle 75-aastast oli viimase aasta jooksul kuritegevusega kokku puutunud?",
    "Millal tehakse sotsiaalvaldkonna koolitajate e-kursusega seotud järelhindamine ja kelle hinnangud sinna kaasatakse?"
  ];

  for (const message of specificResearchCases) {
    test(`valib ühe uuringu faktiraja: ${message}`, () => {
      const plan = buildQuestionPlan({ message });
      assert.equal(plan.mode, "specific_research_fact");
      assert.equal(plan.retrieval_strategy, "document_identity_then_fact");
      assert.equal(plan.answer_contract, "same_identified_document_fact_required");
    });
  }

  test("säilitab varasema 11 vigase küsimuse kõik küsitud faktislotid", () => {
    const cases = [{
      id: "J03",
      message: "Millised on vaimse tervise kriisi tunnused ning millistele telefoninumbritele tuleb nende korral helistada Külli Mäe 2018. aasta artikli „Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?” järgi?",
      types: ["entity_list", "entity_list"]
    }, {
      id: "J05",
      message: "Artiklis „Taastav õigus ja COVID-19” mitu spetsialisti ja riiki osales igakuisel kohtumisel ning mitu inimest ja riiki osales 2020. aasta aprillist juulini toimunud neljal kohtumisel?",
      types: ["count", "count", "count", "count"]
    }, {
      id: "J08",
      message: "Vaike Vainu 2023. aasta artiklis „Suure hoolduskoormusega inimesed vajavad täiendavat abi” kui suur osa vastanutest vajas lisabi, kui suur osa palju lisabi ning kui suur osa oli suure ja keskmise hoolduskoormuse riskiga?",
      types: ["proportion", "proportion", "proportion", "proportion"]
    }, {
      id: "J11",
      message: "Artiklis „Sotsiaaltöötajate tööalase toetuse kogemused” mitu intervjuud tehti, kuidas jagunesid individuaal- ja rühmavestlused ning millist kolmeetapilist analüüsi kasutati?",
      types: ["count", "count", "count", "method"]
    }, {
      id: "J13",
      message: "2018. aasta artiklis „Käitumisprobleemidega lapsed peaksid abi saama enne, kui asjad väga hulluks lähevad” millist noorte vanuserühma käsitleti ning mida öeldi probleemide kattuvuse ja nende varase avaldumise kohta?",
      types: ["entity_list", "text_relation", "text_relation"]
    }, {
      id: "J14",
      message: "Anne-Ly Sumre 2019. aasta artiklis „Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele” kui palju oli Saue vallas alla 18-aastasi lapsi, kui suur osa hooldusõiguse jagamise juhtumitest jõudis kohtusse ning mitu kohtujuhtumit ja kohtuvälist kokkulepet oli ühe spetsialisti näites?",
      types: ["count", "proportion", "count", "count"],
      scope: ["18"],
      slotScopes: [["18"], [], [], []]
    }, {
      id: "J18",
      message: "Erle Eenmaa 2022. aasta artiklis „Psüühilise erivajadusega inimese osalus oma eestkostes” kui palju osalejaid oli igas kolmes praktikute rühmas ja kui palju kokku?",
      types: ["count", "count"],
      firstCardinality: 3
    }, {
      id: "V04",
      message: "Anu Lepsi ja Lenne Indovi 2025. aasta artiklis kui suur osakaal ja mitu inimest oli üle 60-aastaste registreeritud kuriteoohvrite seas, kui suur osakaal ja mitu inimest oli üle 60-aastaste ohvriabisse helistajate seas ning kui suur osakaal ja mitu inimest oli üle 75-aastaste kuriteo tõttu kannatanute seas?",
      types: ["proportion", "count", "proportion", "count", "proportion", "count"],
      authors: ["Anu Lepsi", "Lenne Indovi"],
      scope: ["60", "75"],
      slotScopes: [["60"], ["60"], ["60"], ["60"], ["75"], ["75"]]
    }, {
      id: "V05",
      message: "Marina Vaino artiklis „Uus e-kursus pakub tuge sotsiaalvaldkonna koolitajatele” kui pika aja pärast hinnati järelmõju ning kelle hinnanguid võrreldi?",
      types: ["duration", "person_role"]
    }, {
      id: "V06",
      message: "Mitu laste eraldamise otsust analüüsiti 2022. aasta artiklis „Lapse perekonnast eraldamine vaimse tervise probleemiga vanemalt” ja mis aastast need otsused pärinesid?",
      types: ["count", "calendar_year"]
    }, {
      id: "M02",
      message: "EPIKoja aruandes „Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuring” milline soovitus anti Tallinnale kontaktisiku või juhtumikorralduse kohta, milline ennetava abi kohta, milline teenustele pääsu ja korduvate hindamiste kohta ning milline toetatud otsustamise kohta?",
      types: ["recommendation", "recommendation", "recommendation", "recommendation"]
    }];

    for (const item of cases) {
      const plan = buildQuestionPlan({ message: item.message });
      const requested = plan.semantic_candidates?.requested_fact_slots;
      assert.equal(plan.mode, "specific_research_fact", item.id);
      assert.equal(requested?.complete, true, item.id);
      assert.deepEqual(requested?.slots?.map(slot => slot.value_type), item.types, item.id);
      if (item.authors) assert.deepEqual(plan.document_author_names, item.authors, item.id);
      if (item.scope) assert.deepEqual(requested.question_scope_values, item.scope, item.id);
      if (item.slotScopes) {
        assert.deepEqual(requested.slots.map(slot => slot.scope_values || []), item.slotScopes, item.id);
      }
      if (item.firstCardinality) {
        assert.equal(requested.slots[0].expected_cardinality, item.firstCardinality, item.id);
      }
    }
  });

  test("säilitab protsendid faktipäringu täpsete otsinguankrutena", () => {
    const plan = buildQuestionPlan({
      message: "Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?"
    });
    assert.deepEqual(plan.document_fact_terms, ["10%", "6%", "2%"]);
  });

  test("laiendab uuringuteema morfoloogia ja liitsõna enne otsingut", () => {
    const plan = buildQuestionPlan({
      message: "Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?"
    });
    const queries = buildSpecificResearchFactQueries([], "", plan).map(entry => entry.query);
    assert.match(queries[0], /\beakas\b/u);
    assert.match(queries[0], /\bvanemaealiste\b/u);
    assert.match(queries[0], /\bvagivalla\b/u);
    assert.match(queries[0], /\buuring\b/u);
    assert.match(queries[1], /10% 6% 2%/u);
    const scopedQueries = buildDocumentScopedResearchFactQueries(plan).map(entry => entry.query);
    assert.ok(scopedQueries.some(query => query === "2%"));
  });

  test("dokumendisisene üksiku protsendi päring säilitab piisava lõigusügavuse", () => {
    const plan = buildQuestionPlan({
      message: "Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?"
    });
    const queries = buildDocumentScopedResearchFactQueries(plan);
    const twoPercent = queries.find(entry => /(?:^|\s)2%(?:\s|$)/u.test(entry.query) && !/10%|6%/u.test(entry.query));
    assert.equal(twoPercent?.min_top_k, 12);
    assert.equal(twoPercent.query, "2%");
    assert.equal(resolveMultiQueryTopK({ index: 4, topK: 18, queryCount: 6, minTopK: twoPercent.min_top_k }), 12);
  });

  test("pärast dokumendi tuvastamist otsib iga arvulist fakti ainult selle dokumendi seest", () => {
    const plan = buildQuestionPlan({
      message: "Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?"
    });
    const queries = buildDocumentScopedResearchFactQueries(plan);
    assert.ok(queries.length >= 4);
    assert.ok(queries.every(entry => entry.min_top_k === 12));
    assert.deepEqual(
      ["10%", "6%", "2%"].filter(value => queries.some(entry => entry.query === value)),
      ["10%", "6%", "2%"]
    );
  });

  test("laiendab vanusepiiriga faktiküsimuse vanemaealiste otsingusõnavaraks", () => {
    const plan = buildQuestionPlan({
      message: "Kui palju üle 60-aastasi oli 2023. aastal kuriteoohvrite ja ohvriabisse pöördunute seas ning mitu üle 75-aastast oli viimase aasta jooksul kuritegevusega kokku puutunud?"
    });
    const queries = buildSpecificResearchFactQueries([], "", plan).map(entry => entry.query);
    assert.equal(plan.mode, "specific_research_fact");
    assert.match(queries[0], /\bvanemaealiste\b/u);
    assert.match(queries[0], /\beakate\b/u);
  });

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

  test("lühike teemaankur valib selge exact- ja title-tabamusega dokumendi", () => {
    const shortPlan = buildQuestionPlan({
      message: "Erihooldekodude kaardistus: mis olid need kolm protsenti?"
    });
    const correct = {
      docId: "erihoole-2017",
      title: "Suurte erihooldekodude ümberkorraldamine on hoolikalt läbimõeldud protsess",
      sourceType: "journal_article",
      retrievalChannels: ["title_match", "exact_phrase"]
    };
    const distractor = {
      docId: "hooldekodu-2021",
      title: "Hooldekodu elanike autonoomiaga arvestamine kolme hooldekodu näitel",
      sourceType: "journal_article",
      retrievalChannels: ["dense"]
    };
    const result = selectSpecificResearchFactGroups("", [correct, distractor], shortPlan);
    assert.deepEqual(shortPlan.document_subject_terms, ["erihooldekodude"]);
    assert.equal(result.matched, true);
    assert.equal(result.selectedDocumentId, "erihoole-2017");
  });

  test("teemaankruga kandidaat võidab ankruta kanaliboostiga kandidaadi", () => {
    const compactPlan = buildQuestionPlan({
      message: "E-kursuse järelmõju – millal ja kelle hinnangud?"
    });
    const unrelated = {
      docId: "elulugu-2016",
      title: "Asenduskodulapse identiteedi kujunemise toetamine elulootöö meetodil",
      sourceType: "journal_article",
      retrievalChannels: ["registry_fact"]
    };
    const correct = {
      docId: "e-kursus-2026",
      title: "Uus e-kursus pakub tuge sotsiaalvaldkonna koolitajatele",
      sourceType: "journal_article",
      retrievalChannels: ["dense"]
    };
    const result = selectSpecificResearchFactGroups("", [unrelated, correct], compactPlan);
    assert.equal(result.matched, true);
    assert.equal(result.selectedDocumentId, "e-kursus-2026");
  });

  test("eakas ja vanemaealine on dokumendiidentiteedis sama teema", () => {
    const violencePlan = buildQuestionPlan({
      message: "Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?"
    });
    const generic = {
      docId: "generic-ageing-study",
      title: "Vanemaealiste ja eakate toimetuleku uuring 2015",
      sourceType: "research_report",
      retrievalChannels: ["registry_fact", "title_match"]
    };
    const correct = {
      docId: "older-violence-2025",
      title: "Vägivald vanemaealiste vastu vajab tähelepanu",
      sourceType: "journal_article",
      retrievalChannels: ["dense", "bm25", "title_match"]
    };
    const result = selectSpecificResearchFactGroups("", [generic, correct], violencePlan);
    assert.deepEqual(violencePlan.document_subject_terms, ["eakate", "vagivalla"]);
    assert.equal(result.matched, true);
    assert.equal(result.selectedDocumentId, "older-violence-2025");
  });

  test("loomulik mitme vanuserühma faktiküsimus valib kõiki arvulisi ankruid katva dokumendi", () => {
    const message = "Kui palju üle 60-aastasi oli 2023. aastal kuriteoohvrite ja ohvriabisse pöördunute seas ning mitu üle 75-aastast oli viimase aasta jooksul kuritegevusega kokku puutunud?";
    const plan = buildQuestionPlan({ message });
    const result = selectSpecificResearchFactGroups(message, [{
      docId: "older-violence-2025",
      title: "Vägivald vanemaealiste vastu vajab tähelepanu",
      tags: ["vanemaealised", "ohvriabi"],
      bodies: [
        "2023. aastal olid üle 60-aastased kuriteoohvrite ja ohvriabisse pöördunute seas.",
        "2% (n=100) üle 75-aastastest puutus viimase aasta jooksul kokku kuritegevusega."
      ],
      retrievalChannels: ["dense"]
    }, {
      docId: "generic-ageing-2025",
      title: "Vanemaealiste heaolu 2023. aastal",
      tags: ["vanemaealised"],
      bodies: ["Üle 60-aastaste heaolu üldine ülevaade."],
      retrievalChannels: ["title_match"]
    }], plan);
    assert.equal(result.matched, true);
    assert.equal(result.selectedDocumentId, "older-violence-2025");
  });

  test("mitme autori ankur nõuab kõiki autoreid samalt dokumendilt", () => {
    const message = "Anu Lepsi ja Lenne Indovi 2025. aasta artiklis kui suur osakaal ja mitu inimest oli üle 60-aastaste registreeritud kuriteoohvrite seas, kui suur osakaal ja mitu inimest oli üle 60-aastaste ohvriabisse helistajate seas ning kui suur osakaal ja mitu inimest oli üle 75-aastaste kuriteo tõttu kannatanute seas?";
    const plan = buildQuestionPlan({ message });
    const correct = {
      docId: "leps-indov-2025",
      title: "Vägivald vanemaealiste vastu vajab tähelepanu",
      authors: ["Anu Leps", "Lenne Indov"],
      year: 2025,
      sourceType: "journal_article",
      retrievalChannels: ["author_match", "title_match"],
      bodies: ["10% ehk 640 kuriteoohvrit; 6% ehk 227 ohvriabisse helistajat; 2% ehk 100 kannatanut."]
    };
    const oneAuthorOnly = {
      ...correct,
      docId: "leps-only-2025",
      authors: ["Anu Leps"],
      retrievalChannels: ["author_match", "title_match", "registry_fact"]
    };
    const result = selectSpecificResearchFactGroups(message, [oneAuthorOnly, correct], plan);
    assert.deepEqual(plan.document_author_names, ["Anu Lepsi", "Lenne Indovi"]);
    assert.equal(result.matched, true);
    assert.equal(result.selectedDocumentId, "leps-indov-2025");
    assert.equal(result.candidates.find(item => item.documentId === "leps-only-2025")?.authorMatched, false);
  });

  test("dokumendilukk jääb valikuks ka tugevama üldskooriga värskenduse järel", () => {
    const message = "Anu Lepsi ja Lenne Indovi 2025. aasta artiklis kui suur osakaal ja mitu inimest oli üle 60-aastaste registreeritud kuriteoohvrite seas?";
    const basePlan = buildQuestionPlan({ message });
    const lockedPlan = {
      ...basePlan,
      trusted_document_id: "locked-doc",
      trusted_document_id_source: "current_turn_document_identity"
    };
    const locked = {
      docId: "locked-doc",
      title: "Vägivald vanemaealiste vastu vajab tähelepanu",
      authors: ["Anu Leps", "Lenne Indov"],
      year: 2025,
      sourceType: "journal_article",
      retrievalChannels: ["author_match", "title_match"],
      bodies: ["Üle 60-aastaste registreeritud kuriteoohvrite seas oli osakaal ja inimeste arv."]
    };
    const strongerRefreshCandidate = {
      ...locked,
      docId: "other-doc",
      retrievalChannels: ["author_match", "title_match", "registry_fact", "exact_phrase"]
    };
    const result = selectSpecificResearchFactGroups(
      message,
      [strongerRefreshCandidate, locked],
      lockedPlan
    );
    assert.equal(result.matched, true);
    assert.equal(result.selectedDocumentId, "locked-doc");
    assert.ok(result.reasons.includes("current_turn_document_identity"));
  });

  test("praeguse pöörde täpne pealkiri tühistab vana vestlusallika luku", () => {
    const message = "Selles artiklis „Uus uuring” mitu intervjuud tehti?";
    const plan = {
      ...buildQuestionPlan({ message }),
      trusted_document_id: "old-doc",
      trusted_document_id_source: "previous_source_exact_filter"
    };
    const currentDocument = {
      docId: "new-doc",
      title: "Uus uuring",
      sourceType: "journal_article",
      retrievalChannels: ["title_match", "exact_phrase"],
      bodies: ["Uues uuringus tehti 7 intervjuud."]
    };
    const previousDocument = {
      docId: "old-doc",
      title: "Vana uuring",
      sourceType: "journal_article",
      retrievalChannels: ["title_match"],
      bodies: ["Vanas uuringus tehti 99 intervjuud."]
    };
    const result = selectSpecificResearchFactGroups(message, [currentDocument, previousDocument], plan);
    assert.equal(result.matched, true);
    assert.equal(result.selectedDocumentId, "new-doc");
  });

  test("jutumärkides Title Case pealkiri ei muutu dokumendi autoriks", () => {
    for (const [message, title] of [[
      "Artiklis „Social Work Practice Today” mitu intervjuud tehti?",
      "Social Work Practice Today"
    ], [
      "Artiklis „Lapse Perekonnast Eraldamine” mitu otsust analüüsiti?",
      "Lapse Perekonnast Eraldamine"
    ], [
      "Artiklis \u201eSocial Work Practice Today\u201c mitu intervjuud tehti?",
      "Social Work Practice Today"
    ]]) {
      const currentIdentity = buildQuestionPlan({ message })
        .semantic_candidates.current_turn_document_identity;
      assert.equal(currentIdentity.title_hint.value, title);
      assert.deepEqual(currentIdentity.authors, []);
    }
  });
});

describe("aasta roll otsingus", () => {
  test("andmeaasta ei muutu allika ilmumisaasta filtriks", () => {
    assert.deepEqual(
      extractExplicitSourceYears("Kui palju üle 60-aastasi oli 2023. aastal kuriteoohvrite ja ohvriabisse pöördunute seas?"),
      []
    );
  });

  test("selgelt nimetatud allika ilmumisaasta jääb filtriks", () => {
    assert.deepEqual(extractExplicitSourceYears("Mida ütles 2023. aasta aruanne?"), [2023]);
  });
});

describe("renderdatud tõendi faktileping", () => {
  function metricContract(message, bodies, docId = "rendered-doc") {
    const questionPlan = buildQuestionPlan({ message });
    return buildRequestedFactSlotContract({
      questionPlan,
      renderedGroups: [{ sourceId: `${docId}-source`, docId }],
      renderedBlocks: [{ evidenceText: bodies.join("\n---\n") }],
      specificResearchFactQuestion: true,
      documentIdentityEvidence: {
        matched: true,
        confidence: "high",
        selectedDocumentId: docId
      }
    });
  }

  test("seob J08 ja J14 eelnevad sildid ning säilitab arvukvalifikaatorid", () => {
    const j08 = metricContract(
      "Vaike Vainu 2023. aasta artiklis „Suure hoolduskoormusega inimesed vajavad täiendavat abi” kui suur osa vastanutest vajas lisabi, kui suur osa palju lisabi ning kui suur osa oli suure ja keskmise hoolduskoormuse riskiga?",
      [
        "Lisabi vajas 61% vastanutest. Palju lisabi vajas 26%.",
        "Suure hoolduskoormuse riskiga oli 11%. Keskmise hoolduskoormuse riskiga oli 18%."
      ],
      "j08-doc"
    );
    assert.equal(j08.trace?.complete, true);
    assert.deepEqual(j08.trace?.slots.map(slot => slot.evidence_value), ["61", "26", "11", "18"]);

    const j14 = metricContract(
      "Anne-Ly Sumre 2019. aasta artiklis „Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele” kui palju oli Saue vallas alla 18-aastasi lapsi, kui suur osa hooldusõiguse jagamise juhtumitest jõudis kohtusse ning mitu kohtujuhtumit ja kohtuvälist kokkulepet oli ühe spetsialisti näites?",
      [
        "Saue vallas oli alla 18-aastasi lapsi üle 5800.",
        "Hooldusõiguse jagamise juhtumitest jõudis kohtusse umbes 90%.",
        "Ühe spetsialisti näites oli kohtujuhtumeid 14 ja kohtuväliseid kokkuleppeid 3."
      ],
      "j14-doc"
    );
    assert.equal(j14.trace?.complete, true);
    assert.deepEqual(j14.trace?.slots.map(slot => slot.evidence_value), ["5800", "90", "14", "3"]);
    assert.deepEqual(j14.trace?.slots.map(slot => slot.qualifier), ["over", "about", null, null]);
  });

  test("tõlgendab arvsõnu, kestust ja käändelist tõendiaastat enne faktivalideerimist", () => {
    const j11 = metricContract(
      "Artiklis „Sotsiaaltöötajate tööalase toetuse kogemused” mitu intervjuud tehti, kuidas jagunesid individuaal- ja rühmavestlused ning millist kolmeetapilist analüüsi kasutati?",
      [
        "Kokku tehti seitse intervjuud.",
        "Neist kuus olid individuaalintervjuud.",
        "Üks oli rühmaintervjuu, milles osales kolm inimest."
      ],
      "j11-doc"
    );
    assert.equal(j11.trace?.complete, true);
    assert.deepEqual(j11.trace?.slots.map(slot => slot.evidence_value), ["7", "6", "1"]);

    const v05 = metricContract(
      "Marina Vaino artiklis „Uus e-kursus pakub tuge sotsiaalvaldkonna koolitajatele” kui pika aja pärast hinnati järelmõju ning kelle hinnanguid võrreldi?",
      ["Järelmõju hinnati kuue kuu pärast."],
      "v05-doc"
    );
    assert.equal(v05.trace?.complete, true);
    assert.deepEqual(v05.trace?.slots.map(slot => slot.evidence_value), ["6"]);

    const v06 = metricContract(
      "Mitu laste eraldamise otsust analüüsiti 2022. aasta artiklis „Lapse perekonnast eraldamine vaimse tervise probleemiga vanemalt” ja mis aastast need otsused pärinesid?",
      ["Analüüsiti 169 lapse perekonnast eraldamise otsust 2018. aastast."],
      "v06-doc"
    );
    assert.equal(v06.trace?.complete, true);
    assert.deepEqual(v06.trace?.slots.map(slot => slot.evidence_value), ["169", "2018"]);
  });

  test("seob J13 sisulised suhted ja sõnalise varase vanusevahemiku", () => {
    const message = "2018. aasta artiklis „Käitumisprobleemidega lapsed peaksid abi saama enne, kui asjad väga hulluks lähevad” millist noorte vanuserühma käsitleti ning mida öeldi probleemide kattuvuse ja nende varase avaldumise kohta?";
    const questionPlan = buildQuestionPlan({ message });
    const result = buildRequestedQualitativeSlotContract({
      questionPlan,
      renderedGroups: [{
        sourceId: "j13-source",
        docId: "j13-doc",
        bodies: [
          "Uuring käsitles 13–18-aastaseid noori.",
          "Käitumisprobleemid kattusid sageli teiste probleemidega.",
          "Varane avaldumine oli võimalik juba kolme- kuni viieaastaselt."
        ]
      }],
      specificResearchFactQuestion: true,
      documentIdentityEvidence: {
        matched: true,
        confidence: "high",
        selectedDocumentId: "j13-doc"
      }
    });
    assert.equal(result.trace?.complete, true);
    assert.deepEqual(result.trace?.slots[0]?.required_numeric_values, ["13", "18"]);
    assert.deepEqual(result.trace?.slots[2]?.required_numeric_values, ["3", "5"]);
  });
});

describe("uuringupealkirja kitsas kokkuvõttepere", () => {
  const baseTitle = "Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuring";
  const message = `EPIKoja aruandes „${baseTitle}” milline soovitus anti Tallinnale kontaktisiku või juhtumikorralduse kohta, milline ennetava abi kohta, milline teenustele pääsu ja korduvate hindamiste kohta ning milline toetatud otsustamise kohta?`;

  test("baaspealkiri valib täiskokkuvõtte enne lühikokkuvõtet", () => {
    const plan = buildQuestionPlan({ message });
    const result = selectSpecificResearchFactGroups(message, [{
      docId: "short",
      title: `${baseTitle}u lühikokkuvõte`,
      sourceType: "research_report",
      retrievalChannels: ["title_match", "exact_phrase"],
      bodies: ["Lühikokkuvõte."]
    }, {
      docId: "full",
      title: `${baseTitle}u kokkuvõte`,
      sourceType: "research_report",
      retrievalChannels: ["title_match", "exact_phrase"],
      bodies: ["Täiskokkuvõte."]
    }], plan);
    assert.equal(result.matched, true);
    assert.equal(result.selectedDocumentId, "full");
    assert.ok(result.reasons.includes("decisive_canonical_title_family_anchor"));
  });

  test("sama prioriteediga kaks eri dokumenti jäävad fail-closed mitmetähenduslikuks", () => {
    const plan = buildQuestionPlan({ message });
    const groups = ["a", "b"].map(docId => ({
      docId,
      title: `${baseTitle}u kokkuvõte`,
      sourceType: "research_report",
      retrievalChannels: ["title_match", "exact_phrase"],
      bodies: ["Sama pealkirjapere."]
    }));
    const result = selectSpecificResearchFactGroups(message, groups, plan);
    assert.equal(result.matched, false);
    assert.equal(result.confidence, "ambiguous");
  });
});

describe("faktislottide dokumendisisene katvus", () => {
  test("leiab kvalitatiivse mitmeosalise küsimuse kõik tõendilõigud samast dokumendist", () => {
    const plan = buildQuestionPlan({
      message: "EPIKoja aruandes „Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuring” milline soovitus anti Tallinnale kontaktisiku või juhtumikorralduse kohta, milline ennetava abi kohta, milline teenustele pääsu ja korduvate hindamiste kohta ning milline toetatud otsustamise kohta?"
    });
    const documentIdentityEvidence = {
      matched: true,
      confidence: "high",
      selectedDocumentId: "epikoda-tallinn"
    };
    const groups = [{
      docId: "epikoda-tallinn",
      bodies: [
        "Tallinnale soovitati üht kontaktisikut või juhtumikorraldajat.",
        "Ennetava abi ja proaktiivse toe peab viima inimeseni varem.",
        "Teenustele pääs tuleb lihtsustada ning vältida korduvaid hindamisi.",
        "Toetatud otsustamist tuleb kasutada alternatiivina."
      ]
    }];
    const coverage = buildRequestedFactSlotCoverage(plan, groups, {
      specificResearchFactQuestion: true,
      documentIdentityEvidence
    });
    assert.equal(coverage.complete, true);
    assert.equal(coverage.covered_slot_count, 4);
    assert.deepEqual(coverage.missing_slot_indexes, []);
  });

  test("telefonislot ei ole kaetud, kui tõendis on ainult üks küsitud telefon", () => {
    const plan = buildQuestionPlan({
      message: "Millised on vaimse tervise kriisi tunnused ning millistele telefoninumbritele tuleb nende korral helistada Külli Mäe 2018. aasta artikli „Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?” järgi?"
    });
    const coverage = buildRequestedFactSlotCoverage(plan, [{
      docId: "j03-doc",
      bodies: [
        "Vaimse tervise kriisi tunnused on lootusetus ja segasus.",
        "Vahetu ohu korral tuleb helistada telefoninumbrile 112."
      ]
    }], {
      specificResearchFactQuestion: true,
      documentIdentityEvidence: {
        matched: true,
        confidence: "high",
        selectedDocumentId: "j03-doc"
      }
    });
    assert.equal(coverage.complete, false);
    assert.deepEqual(coverage.missing_slot_indexes, [1]);
  });

  test("meetodislot ei ole kaetud pelga analüüsi kordusega", () => {
    const message = "Artiklis „Sotsiaaltöötajate tööalase toetuse kogemused” mitu intervjuud tehti, kuidas jagunesid individuaal- ja rühmavestlused ning millist kolmeetapilist analüüsi kasutati?";
    const plan = buildQuestionPlan({ message });
    const coverage = buildRequestedFactSlotCoverage(plan, [{
      docId: "j11-doc",
      bodies: [
        "Tehti kokku 7 intervjuud.",
        "Individuaalseid vestlusi oli 6.",
        "Rühmavestlusi oli 1.",
        "Analüüsi kasutati."
      ]
    }], {
      specificResearchFactQuestion: true,
      documentIdentityEvidence: {
        matched: true,
        confidence: "high",
        selectedDocumentId: "j11-doc"
      }
    });
    assert.equal(coverage.complete, false);
    assert.deepEqual(coverage.missing_slot_indexes, [3]);

    const completeCoverage = buildRequestedFactSlotCoverage(plan, [{
      docId: "j11-doc",
      bodies: [
        "Tehti kokku 7 intervjuud.",
        "Individuaalseid vestlusi oli 6.",
        "Rühmavestlusi oli 1.",
        "Kasutati kolmeetapilist temaatilist analüüsi."
      ]
    }], {
      specificResearchFactQuestion: true,
      documentIdentityEvidence: {
        matched: true,
        confidence: "high",
        selectedDocumentId: "j11-doc"
      }
    });
    assert.equal(completeCoverage.complete, true);
  });

  test("puuduvate slottide taastamispäringud sisaldavad ainult puuduvaid suhteid", () => {
    const plan = buildQuestionPlan({
      message: "EPIKoja aruandes „Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuring” milline soovitus anti Tallinnale kontaktisiku või juhtumikorralduse kohta, milline ennetava abi kohta, milline teenustele pääsu ja korduvate hindamiste kohta ning milline toetatud otsustamise kohta?"
    });
    const queries = buildDocumentScopedMissingFactQueries(plan, [1, 3]);
    assert.equal(queries.length, 2);
    assert.match(queries[0].query, /ennetava.*abi/u);
    assert.match(queries[1].query, /toetatud.*otsustamise/u);
    assert.doesNotMatch(queries.map(item => item.query).join(" "), /kontaktisiku|juhtumikorralduse/u);
  });

  test("peatüki listinumber ei võida päris loendust", () => {
    const plan = buildQuestionPlan({
      message: "Mitu laste eraldamise otsust analüüsiti artiklis?"
    });
    const [group] = prioritizeRequestedMetricSlotEvidence(plan, [{
      docId: "laste-eraldamine",
      bodies: [
        "1. Laste eraldamise otsused analüüsiti.",
        "Analüüsiti 169 laste eraldamise otsust."
      ]
    }], {
      specificResearchFactQuestion: true,
      documentIdentityEvidence: {
        matched: true,
        confidence: "high",
        selectedDocumentId: "laste-eraldamine"
      }
    });
    assert.match(group.bodies[0], /169/u);
  });
});

describe("täpse faktivastuse värav", () => {
  test("püsiv RAG trace hoiab lepingutest alles struktuuri, mitte tooreid tõendi- ega isikuandmeid", () => {
    const privateRelation = "PRIVATE_RELATION_TOKEN_9X";
    const privateAnchor = "PRIVATE_ANCHOR_TOKEN_9X";
    const privateAction = "PRIVATE_ACTION_TOKEN_9X";
    const privateAnswerToken = "PRIVATE_ANSWER_TOKEN_9X";
    const privatePhone = "+372 5555 1234";
    const privateEmail = "trace-private@example.invalid";
    const privateIdentifier = "406062023041";
    const privateDocumentId = "private-document-id-9x";
    const trace = buildRagTraceFromAttribution([], {}, {
      requestedFactSlotContract: {
        version: "requested_fact_slot_contract_v1",
        enabled: true,
        complete: true,
        reason: "all_requested_slots_mapped_in_one_rendered_source",
        source: "final_rendered_evidence",
        mapping_method: "bounded_rendered_sentence_peer_alignment_v7",
        requested_slot_count: 1,
        mapped_slot_count: 1,
        source_id: "private-source-id-9x",
        document_id: privateDocumentId,
        rendered_evidence_hash: "a".repeat(64),
        slots: [{
          slot_index: 1,
          value_type: "count",
          slot_source: "requested_fact_slots",
          relation_terms: [privateRelation],
          relation_term_variants: [{ term: privateRelation, variants: [privateAnchor] }],
          relation_term_count: 1,
          evidence_value: privateIdentifier,
          fragment_index: 2,
          mention_index: 1,
          matched_term_count: 1
        }]
      },
      requestedQualitativeSlotContract: {
        version: "requested_qualitative_slot_contract_v1",
        enabled: true,
        complete: true,
        reason: "all_qualitative_slots_bound_to_rendered_evidence",
        selected_document_id: privateDocumentId,
        reply_language: "et",
        requested_slot_count: 1,
        mapped_slot_count: 1,
        used_for_generation: true,
        used_for_validation: true,
        slots: [{
          slot_index: 1,
          value_type: "recommendation",
          validation_language: "et",
          minimum_answer_items: 1,
          minimum_relation_matches: 1,
          minimum_evidence_anchor_count: 1,
          minimum_anchor_matches: 1,
          relation_terms: [privateRelation],
          matched_relation_terms: [privateRelation],
          evidence_anchor_terms: [privateAnchor],
          evidence_action_terms: [privateAction],
          evidence_action_categories: ["enable"],
          evidence_negated: false,
          minimum_action_matches: 1,
          required_numeric_values: [privateIdentifier],
          action_object_bindings: [{
            action_family: "assign",
            action_category: "enable",
            evidence_action_terms: [privateAction],
            object_anchor_terms: [privateAnchor],
            minimum_object_matches: 1,
            evidence_negated: false
          }],
          evidence_fragment_hash: "b".repeat(64),
          evidence_fragment_index: 3
        }]
      },
      factValidation: {
        version: "exact_fact_answer_v1",
        enabled: true,
        passed: false,
        reason: "requested_fact_answer_incomplete",
        claim_values: [privateIdentifier, privatePhone],
        unsupported_claim_values: [privateIdentifier],
        unsupported_contact_phone_values: [privatePhone],
        unsupported_contact_email_values: [privateEmail],
        requested_fact_qualitative_slot_bindings: [{
          slot_index: 1,
          unit_index: 0,
          matched_relation_terms: [privateRelation],
          matched_evidence_anchors: [privateAnchor],
          substantive_answer_tokens: [privateAnswerToken],
          required_numeric_values: [privateIdentifier],
          action_object_bindings: [{
            clause_index: 0,
            expected_action_family: "assign",
            answer_action_family: "assign",
            action_category: "enable",
            answer_negated: false,
            matched_object_count: 1,
            required_object_count: 1
          }]
        }],
        requested_fact_metric_slot_bindings: [{
          slot_index: 1,
          value_type: "count",
          claim_index: 0,
          claim_value: privateIdentifier,
          scope_values: [privateIdentifier],
          bound_scope_values: [privateIdentifier]
        }],
        requested_metric_slot_bindings: [{
          slot_index: 1,
          value_type: "count",
          evidence_value: privateIdentifier,
          claim_index: 0,
          matched_relation_terms: [privateRelation]
        }]
      }
    });
    const safeSubtrees = {
      requested_fact_slot_contract: trace.requested_fact_slot_contract,
      requested_qualitative_slot_contract: trace.requested_qualitative_slot_contract,
      fact_validation: trace.fact_validation
    };
    const serialized = JSON.stringify(safeSubtrees);
    for (const sentinel of [
      privateRelation, privateAnchor, privateAction, privateAnswerToken,
      privatePhone, privateEmail, privateIdentifier, privateDocumentId
    ]) assert.doesNotMatch(serialized, new RegExp(sentinel.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    for (const rawField of [
      "relation_terms", "relation_term_variants", "evidence_anchor_terms", "evidence_action_terms",
      "substantive_answer_tokens", "required_numeric_values", "claim_value", "evidence_value",
      "scope_values", "bound_scope_values"
    ]) assert.equal(serialized.includes(`"${rawField}":`), false);
    assert.equal(trace.requested_fact_slot_contract.slots[0].relation_term_count, 1);
    assert.equal(trace.requested_qualitative_slot_contract.slots[0].action_object_bindings[0].action_family, "assign");
    assert.equal(trace.fact_validation.claim_count, 2);
    assert.equal(trace.fact_validation.requested_fact_qualitative_slot_bindings[0].substantive_answer_token_count, 1);
  });

  test("annab protsendi ja n-loenduse semantika ka loomulikule mitu-küsimusele", () => {
    const instruction = buildPercentCountSemanticsInstruction([{
      bodies: [
        "Üle 60-aastasi kuriteoohvreid oli 10% (n=640) ja ohvriabisse pöördunuid 6% (n=227).",
        "Üle 75-aastastest puutus kuritegevusega kokku 2% (n=100)."
      ]
    }]);
    assert.match(instruction, /10% = n 640/u);
    assert.match(instruction, /6% = n 227/u);
    assert.match(instruction, /2% = n 100/u);
    assert.match(instruction, /ära arvuta X% × Y/u);
    assert.match(instruction, /ära pane kõiki ühe ühise aastapealkirja alla/u);
  });

  test("lühike protsentidega näiduküsimus läbib faktivastuse värava", () => {
    assert.equal(shouldValidateExactFactAnswer({
      message: "Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?",
      sources: [{ evidenceText: "10% (n=640), 6% (n=227), 2% (n=100)" }]
    }), true);
  });

  test("M02 kvalitatiivne vastus peab katma neli eri soovitusslotti", () => {
    const message = "EPIKoja aruandes „Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuring” milline soovitus anti Tallinnale kontaktisiku või juhtumikorralduse kohta, milline ennetava abi kohta, milline teenustele pääsu ja korduvate hindamiste kohta ning milline toetatud otsustamise kohta?";
    const plan = buildQuestionPlan({ message });
    const evidenceText = "Määrata vastutav kontaktisik või juhtumikorraldaja. Ennetav abi peab olema proaktiivne. Teenustele pääsu tuleb lihtsustada ja korduvaid hindamisi vältida. Toetatud otsustamist tuleb kasutada alternatiivina.";
    const contractResult = buildRequestedQualitativeSlotContract({
      questionPlan: plan,
      renderedGroups: [{ docId: "m02-doc", bodies: [evidenceText] }],
      replyLang: "et",
      specificResearchFactQuestion: true,
      documentIdentityEvidence: {
        matched: true,
        confidence: "high",
        selectedDocumentId: "m02-doc"
      }
    });
    const requestedQualitativeSlotContract = contractResult.trace;
    assert.equal(requestedQualitativeSlotContract.enabled, true);
    assert.equal(requestedQualitativeSlotContract.complete, true);
    assert.equal(requestedQualitativeSlotContract.slots.length, 4);
    assert.equal(requestedQualitativeSlotContract.slots.every(slot =>
      Array.isArray(slot.action_object_bindings) && slot.action_object_bindings.length > 0
    ), true);
    const sources = [{
      id: "m02",
      documentId: "m02-doc",
      evidenceText
    }];
    const retrievalMeta = {
      documentIdentityEvidence: {
        required: true,
        matched: true,
        confidence: "high",
        selectedDocumentId: "m02-doc"
      },
      queryPlan: { mode: "specific_research_fact", question_planner: plan },
      requestedFactEvidenceCoverage: { enabled: true, complete: true },
      requestedQualitativeSlotContract
    };
    assert.equal(shouldValidateExactFactAnswer({ message, sources, retrievalMeta }), true);

    const partial = validateExactFactAnswer({
      message,
      reply: "1. Kontaktisik või juhtumikorraldus: määrata vastutav kontaktisik.\n2. Ennetav abi: pakkuda proaktiivset abi.\n3. Teenustele pääs ja korduvad hindamised: pääsu tuleb lihtsustada.",
      sources,
      retrievalMeta
    });
    assert.equal(partial.passed, false);
    assert.equal(partial.trace.reason, "requested_fact_answer_incomplete");
    assert.deepEqual(partial.trace.requested_fact_answer_missing_slot_indexes, [3, 4]);

    const complete = validateExactFactAnswer({
      message,
      reply: "1. Kontaktisik või juhtumikorraldus: nimetada vastutav kontaktisik.\n2. Ennetav abi: pakkuda proaktiivset abi.\n3. Teenustele pääs ja korduvad hindamised: pääsu tuleb lihtsustada ning korduvaid hindamisi vältida.\n4. Toetatud otsustamine: rakendada seda alternatiivina.",
      sources,
      retrievalMeta
    });
    assert.equal(complete.passed, true);
    assert.equal(complete.trace.reason, "requested_qualitative_slots_validated");

    const positiveContrast = validateExactFactAnswer({
      message,
      reply: "1. Kontaktisik või juhtumikorraldus: määrata vastutav kontaktisik, mitte jätta vastutust hajusaks.\n2. Ennetav abi: pakkuda proaktiivset abi.\n3. Teenustele pääs ja korduvad hindamised: pääsu tuleb lihtsustada ning korduvaid hindamisi vältida.\n4. Toetatud otsustamine: kasutada seda alternatiivina.",
      sources,
      retrievalMeta
    });
    assert.equal(positiveContrast.passed, true);

    const negatedAssignment = validateExactFactAnswer({
      message,
      reply: "1. Kontaktisik või juhtumikorraldus: vastutavat kontaktisikut ei tule määrata.\n2. Ennetav abi: pakkuda proaktiivset abi.\n3. Teenustele pääs ja korduvad hindamised: pääsu tuleb lihtsustada ning korduvaid hindamisi vältida.\n4. Toetatud otsustamine: kasutada seda alternatiivina.",
      sources,
      retrievalMeta
    });
    assert.equal(negatedAssignment.passed, false);

    const inverted = validateExactFactAnswer({
      message,
      reply: "1. Kontaktisik või juhtumikorraldus: vastutav kontaktisik tuleb keelata.\n2. Ennetav abi: proaktiivne abi tuleb lõpetada.\n3. Teenustele pääs ja korduvad hindamised: lihtsustada tuleb teenuste sulgemist.\n4. Toetatud otsustamine: alternatiivina tuleb see keelata.",
      sources,
      retrievalMeta
    });
    assert.equal(inverted.passed, false);
    assert.equal(inverted.trace.reason, "requested_fact_answer_incomplete");

    const actionObjectSwap = validateExactFactAnswer({
      message,
      reply: "1. Kontaktisik või juhtumikorraldus: määrata vastutav kontaktisik.\n2. Ennetav abi: pakkuda proaktiivset abi.\n3. Teenustele pääs ja korduvad hindamised: korduvaid hindamisi tuleb lihtsustada ning teenustele pääsu vältida.\n4. Toetatud otsustamine: kasutada seda alternatiivina.",
      sources,
      retrievalMeta
    });
    assert.equal(actionObjectSwap.passed, false);
    assert.equal(actionObjectSwap.trace.reason, "requested_fact_answer_incomplete");

    const rejectedProactiveHelp = validateExactFactAnswer({
      message,
      reply: "1. Kontaktisik või juhtumikorraldus: määrata vastutav kontaktisik.\n2. Ennetav abi: proaktiivne abi on tarbetu.\n3. Teenustele pääs ja korduvad hindamised: pääsu tuleb lihtsustada ning korduvaid hindamisi vältida.\n4. Toetatud otsustamine: kasutada seda alternatiivina.",
      sources,
      retrievalMeta
    });
    assert.equal(rejectedProactiveHelp.passed, false);
    assert.equal(rejectedProactiveHelp.trace.reason, "requested_fact_answer_incomplete");

    const unrelatedEnglish = validateExactFactAnswer({
      message,
      reply: "1. Bananas grow underwater.\n2. Mars has purple rivers.\n3. The moon is made of cheese.\n4. Penguins operate the ministry.",
      sources,
      retrievalMeta: {
        ...retrievalMeta,
        requestedQualitativeSlotContract: {
          ...requestedQualitativeSlotContract,
          slots: requestedQualitativeSlotContract.slots.map(slot => ({
            ...slot,
            validation_language: "en"
          }))
        }
      },
      replyLang: "en"
    });
    assert.equal(unrelatedEnglish.passed, false);
    assert.equal(unrelatedEnglish.trace.reason, "requested_fact_answer_incomplete");
  });

  test("V05 segavastus peab sisaldama nii kestust kui ka mõlemat hinnangu osapoolt", () => {
    const message = "Marina Vaino artiklis „Uus e-kursus pakub tuge sotsiaalvaldkonna koolitajatele” kui pika aja pärast hinnati järelmõju ning kelle hinnanguid võrreldi?";
    const plan = buildQuestionPlan({ message });
    const roleSlot = plan.semantic_candidates.requested_fact_slots.slots[1];
    const sources = [{
      id: "v05",
      documentId: "v05-doc",
      evidenceText: "Järelmõju hinnati 6 kuu pärast. Võrreldi osaleja ja tööandja hinnanguid."
    }];
    const retrievalMeta = {
      documentIdentityEvidence: {
        required: true,
        matched: true,
        confidence: "high",
        selectedDocumentId: "v05-doc"
      },
      queryPlan: { mode: "specific_research_fact", question_planner: plan },
      requestedFactEvidenceCoverage: { enabled: true, complete: true },
      requestedFactSlotContract: {
        version: "requested_fact_slot_contract_v1",
        enabled: true,
        complete: true,
        requested_metric_slot_count: 1,
        slots: [{ slot_index: 1, value_type: "duration", evidence_value: "6", unit: "kuu", scope_values: [] }]
      },
      requestedQualitativeSlotContract: {
        version: "requested_qualitative_slot_contract_v1",
        enabled: true,
        complete: true,
        selected_document_id: "v05-doc",
        slots: [{
          slot_index: roleSlot.index,
          value_type: roleSlot.value_type,
          relation_terms: roleSlot.relation_terms,
          minimum_relation_matches: 1,
          minimum_anchor_matches: 2,
          evidence_anchor_terms: ["osaleja", "tooandja"],
          required_numeric_values: []
        }]
      }
    };
    const partial = validateExactFactAnswer({
      message,
      reply: "1. Järelmõju hinnati 6 kuu pärast.",
      sources,
      retrievalMeta
    });
    assert.equal(partial.passed, false);
    assert.equal(partial.trace.reason, "requested_fact_answer_incomplete");

    const oneSide = validateExactFactAnswer({
      message,
      reply: "1. Järelmõju hinnati 6 kuu pärast.\n2. Hinnanguid võrreldi osaleja vastustega.",
      sources,
      retrievalMeta
    });
    assert.equal(oneSide.passed, false);

    const complete = validateExactFactAnswer({
      message,
      reply: "1. Järelmõju hinnati 6 kuu pärast.\n2. Hinnanguid võrreldi: osaleja ja tööandja.",
      sources,
      retrievalMeta
    });
    assert.equal(complete.passed, true);
  });

  test("J11 arvud ei korva vastusest puuduvat analüüsimeetodit", () => {
    const message = "Artiklis „Sotsiaaltöötajate tööalase toetuse kogemused” mitu intervjuud tehti, kuidas jagunesid individuaal- ja rühmavestlused ning millist kolmeetapilist analüüsi kasutati?";
    const plan = buildQuestionPlan({ message });
    const methodSlot = plan.semantic_candidates.requested_fact_slots.slots[3];
    const sources = [{
      id: "j11",
      documentId: "j11-doc",
      evidenceText: "Tehti 7 intervjuud: 6 individuaalvestlust ja 1 rühmavestlus. Kasutati kolmeetapilist temaatilist analüüsi."
    }];
    const retrievalMeta = {
      documentIdentityEvidence: {
        required: true,
        matched: true,
        confidence: "high",
        selectedDocumentId: "j11-doc"
      },
      queryPlan: { mode: "specific_research_fact", question_planner: plan },
      requestedFactEvidenceCoverage: { enabled: true, complete: true },
      requestedFactSlotContract: {
        version: "requested_fact_slot_contract_v1",
        enabled: true,
        complete: true,
        requested_metric_slot_count: 3,
        slots: [
          { slot_index: 1, value_type: "count", evidence_value: "7", scope_values: [] },
          { slot_index: 2, value_type: "count", evidence_value: "6", scope_values: [] },
          { slot_index: 3, value_type: "count", evidence_value: "1", scope_values: [] }
        ]
      },
      requestedQualitativeSlotContract: {
        version: "requested_qualitative_slot_contract_v1",
        enabled: true,
        complete: true,
        selected_document_id: "j11-doc",
        slots: [{
          slot_index: methodSlot.index,
          value_type: methodSlot.value_type,
          relation_terms: methodSlot.relation_terms,
          minimum_answer_items: 1,
          minimum_relation_matches: 2,
          minimum_anchor_matches: 1,
          evidence_anchor_terms: ["temaatilist"],
          required_numeric_values: []
        }]
      }
    };
    const partial = validateExactFactAnswer({
      message,
      reply: "1. Intervjuud kokku: 7.\n2. Individuaalvestlused: 6.\n3. Rühmavestlused: 1.",
      sources,
      retrievalMeta
    });
    assert.equal(partial.passed, false);
    assert.deepEqual(partial.trace.requested_fact_answer_missing_slot_indexes, [4]);

    const complete = validateExactFactAnswer({
      message,
      reply: "1. Intervjuud kokku: 7.\n2. Individuaalvestlused: 6.\n3. Rühmavestlused: 1.\n4. Kolmeetapiline analüüs: kasutati temaatilist analüüsi.",
      sources,
      retrievalMeta
    });
    assert.equal(complete.passed, true);
  });

  test("V06 loendus ja tõendi kalendriaasta on kaks kohustuslikku mõõdikuslotti", () => {
    const message = "Mitu laste eraldamise otsust analüüsiti 2022. aasta artiklis „Lapse perekonnast eraldamine vaimse tervise probleemiga vanemalt” ja mis aastast need otsused pärinesid?";
    const plan = buildQuestionPlan({ message });
    const sources = [{
      id: "v06",
      documentId: "v06-doc",
      evidenceText: "Analüüsiti 169 lapse eraldamise otsust, mis pärinesid 2018. aastast."
    }];
    const retrievalMeta = {
      documentIdentityEvidence: {
        required: true,
        matched: true,
        confidence: "high",
        selectedDocumentId: "v06-doc"
      },
      queryPlan: { mode: "specific_research_fact", question_planner: plan },
      requestedFactEvidenceCoverage: { enabled: true, complete: true },
      requestedFactSlotContract: {
        version: "requested_fact_slot_contract_v1",
        enabled: true,
        complete: true,
        requested_metric_slot_count: 2,
        slots: [
          { slot_index: 1, value_type: "count", evidence_value: "169", scope_values: [] },
          { slot_index: 2, value_type: "calendar_year", evidence_value: "2018", scope_values: [] }
        ]
      }
    };
    const partial = validateExactFactAnswer({
      message,
      reply: "Otsused pärinesid 2018. aastast.",
      sources,
      retrievalMeta
    });
    assert.equal(partial.passed, false);
    assert.equal(partial.trace.reason, "requested_metric_slot_missing");

    const complete = validateExactFactAnswer({
      message,
      reply: "1. Analüüsitud otsuseid: 169.\n2. Otsuste aasta: 2018.",
      sources,
      retrievalMeta
    });
    assert.equal(complete.passed, true);
  });

  test("renderdatud mõõdikulepingu mappingu ebaõnnestumine sulgeb segaküsimuse", () => {
    const message = "Artiklis „Sotsiaaltöötajate tööalase toetuse kogemused” mitu intervjuud tehti ja millist analüüsi kasutati?";
    const plan = buildQuestionPlan({ message });
    const result = validateExactFactAnswer({
      message,
      reply: "Tehti 7 intervjuud.",
      sources: [{ id: "j11", documentId: "j11-doc", evidenceText: "Tehti 7 intervjuud ja kasutati temaatilist analüüsi." }],
      retrievalMeta: {
        queryPlan: { mode: "specific_research_fact", question_planner: plan },
        requestedFactEvidenceCoverage: { enabled: true, complete: true },
        requestedFactSlotContract: {
          version: "requested_fact_slot_contract_v1",
          enabled: false,
          complete: false,
          requested_metric_slot_count: 1,
          reason: "rendered_evidence_mapping_incomplete"
        },
        requestedQualitativeSlotContract: {
          version: "requested_qualitative_slot_contract_v1",
          enabled: true,
          complete: true,
          slots: [{
            slot_index: 2,
            value_type: "method",
            relation_terms: ["analuusi", "kasutati"],
            minimum_relation_matches: 1,
            minimum_anchor_matches: 1,
            evidence_anchor_terms: ["temaatilist"],
            required_numeric_values: []
          }]
        }
      }
    });
    assert.equal(result.passed, false);
    assert.equal(result.trace.reason, "requested_fact_plan_incomplete");
  });

  test("J03 nõuab kriisitunnuste kõrval mõlemat tõendis seotud telefoninumbrit", () => {
    const message = "Millised on vaimse tervise kriisi tunnused ning millistele telefoninumbritele tuleb nende korral helistada Külli Mäe 2018. aasta artikli järgi?";
    const plan = buildQuestionPlan({ message });
    const [signSlot, phoneSlot] = plan.semantic_candidates.requested_fact_slots.slots;
    const sources = [{
      id: "j03",
      documentId: "j03-doc",
      evidenceText: "Vaimse tervise kriisi tunnused on lootusetus ja suitsiidimõtted. Vahetu ohu korral helista 112 ning nõu saamiseks 1220."
    }];
    const retrievalMeta = {
      documentIdentityEvidence: {
        required: true,
        matched: true,
        confidence: "high",
        selectedDocumentId: "j03-doc"
      },
      queryPlan: { mode: "specific_research_fact", question_planner: plan },
      requestedFactEvidenceCoverage: { enabled: true, complete: true },
      requestedQualitativeSlotContract: {
        version: "requested_qualitative_slot_contract_v1",
        enabled: true,
        complete: true,
        selected_document_id: "j03-doc",
        slots: [{
          slot_index: signSlot.index,
          value_type: signSlot.value_type,
          relation_terms: signSlot.relation_terms,
          minimum_relation_matches: 2,
          minimum_anchor_matches: 2,
          evidence_anchor_terms: ["lootusetus", "suitsiidimotted"],
          required_numeric_values: []
        }, {
          slot_index: phoneSlot.index,
          value_type: phoneSlot.value_type,
          relation_terms: phoneSlot.relation_terms,
          minimum_relation_matches: 1,
          minimum_anchor_matches: 0,
          evidence_anchor_terms: [],
          required_numeric_values: ["112", "1220"]
        }]
      }
    };
    const partial = validateExactFactAnswer({
      message,
      reply: "1. Vaimse tervise kriisi tunnused: lootusetus ja suitsiidimõtted.\n2. Telefoninumbrid: ohu korral helista 112.",
      sources,
      retrievalMeta
    });
    assert.equal(partial.passed, false);
    assert.deepEqual(partial.trace.requested_fact_answer_missing_slot_indexes, [2]);

    const complete = validateExactFactAnswer({
      message,
      reply: "1. Vaimse tervise kriisi tunnused: lootusetus ja suitsiidimõtted.\n2. Telefoninumbrid: ohu korral helista 112 ja nõu saamiseks 1220.",
      sources,
      retrievalMeta
    });
    assert.equal(complete.passed, true);
  });

  test("J13 varase avaldumise slot nõuab tõendiga seotud vanusevahemikku", () => {
    const message = "2018. aasta artiklis „Käitumisprobleemidega lapsed peaksid abi saama enne, kui asjad väga hulluks lähevad” millist noorte vanuserühma käsitleti ning mida öeldi probleemide kattuvuse ja nende varase avaldumise kohta?";
    const plan = buildQuestionPlan({ message });
    const [ageSlot, overlapSlot, onsetSlot] = plan.semantic_candidates.requested_fact_slots.slots;
    const sources = [{
      id: "j13",
      documentId: "j13-doc",
      evidenceText: "Käsitleti 13–18-aastasi noori. Probleemid võivad kattuda. Need võivad avalduda juba 3–5-aastaselt."
    }];
    const retrievalMeta = {
      documentIdentityEvidence: {
        required: true,
        matched: true,
        confidence: "high",
        selectedDocumentId: "j13-doc"
      },
      queryPlan: { mode: "specific_research_fact", question_planner: plan },
      requestedFactEvidenceCoverage: { enabled: true, complete: true },
      requestedQualitativeSlotContract: {
        version: "requested_qualitative_slot_contract_v1",
        enabled: true,
        complete: true,
        selected_document_id: "j13-doc",
        slots: [{
          slot_index: ageSlot.index,
          value_type: ageSlot.value_type,
          relation_terms: ageSlot.relation_terms,
          minimum_relation_matches: 1,
          minimum_anchor_matches: 0,
          evidence_anchor_terms: [],
          required_numeric_values: ["13", "18"]
        }, {
          slot_index: overlapSlot.index,
          value_type: overlapSlot.value_type,
          relation_terms: overlapSlot.relation_terms,
          minimum_relation_matches: 1,
          minimum_anchor_matches: 1,
          evidence_anchor_terms: ["kattuda"],
          required_numeric_values: []
        }, {
          slot_index: onsetSlot.index,
          value_type: onsetSlot.value_type,
          relation_terms: onsetSlot.relation_terms,
          minimum_relation_matches: 1,
          minimum_anchor_matches: 0,
          evidence_anchor_terms: [],
          required_numeric_values: ["3", "5"]
        }]
      }
    };
    const partial = validateExactFactAnswer({
      message,
      reply: "1. Noorte vanuserühm: 13–18-aastased.\n2. Probleemide kattuvus: probleemid võivad kattuda.\n3. Varane avaldumine: probleemid võivad avalduda juba lapseeas.",
      sources,
      retrievalMeta
    });
    assert.equal(partial.passed, false);
    assert.deepEqual(partial.trace.requested_fact_answer_missing_slot_indexes, [3]);

    const complete = validateExactFactAnswer({
      message,
      reply: "1. Noorte vanuserühm: 13–18-aastased.\n2. Probleemide kattuvus: probleemid võivad kattuda.\n3. Varane avaldumine: probleemid võivad avalduda juba 3–5-aastaselt.",
      sources,
      retrievalMeta
    });
    assert.equal(complete.passed, true);
  });

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

  test("millal-küsimuse kuuekuuline ajavahemik ei nõua kalendriaastat", () => {
    const result = validateExactFactAnswer({
      message: "Millal tehakse e-kursuse järelhindamine ja kelle hinnangud kaasatakse?",
      reply: "Järelhindamine tehakse kuus kuud pärast koolitust ning kaasatakse osaleja ja tööandja.",
      sources: [{
        id: "e-kursus-2026",
        evidenceText: "(1) Uus e-kursus. source_year=2026.\nKuus kuud pärast koolitust tehakse järelhindamine, kuhu on kaasatud nii osaleja kui ka tema tööandja."
      }]
    });
    assert.equal(result.passed, true);
    assert.equal(result.trace.year_mode, "not_requested");
  });

  test("mitme mõõdiku küsimuse vanusepiir ei muutu koguarvuks", () => {
    const result = validateExactFactAnswer({
      message: "Kui palju üle 60-aastasi oli 2023. aastal kuriteoohvrite ja ohvriabisse pöördunute seas ning mitu üle 75-aastast oli kuritegevusega kokku puutunud?",
      reply: "2023. aastal olid üle 60-aastastest 10% ehk 640 kuriteoohvrid ja 6% ehk 227 ohvriabisse pöördunud; üle 75-aastastest oli 2% ehk 100 kuritegevusega kokku puutunud.",
      sources: [{
        id: "older-violence-2025",
        evidenceText: "(1) Vägivald vanemaealiste vastu. source_year=2025.\nAastal 2023 olid üle 60-aastastest 10% ehk 640 kuriteoohvrid ja 6% ehk 227 ohvriabisse pöördunud. Üle 75-aastastest oli 2% ehk 100 kuritegevusega kokku puutunud. Kokku käsitles ülevaade 999 kirjet."
      }]
    });
    assert.equal(result.passed, true);
  });

  test("küsimuse vanusepiirid on lepingu ulatus, mitte ootamatud vastusearvud", () => {
    const message = "Anu Lepsi ja Lenne Indovi 2025. aasta artiklis kui suur osakaal ja mitu inimest oli üle 60-aastaste registreeritud kuriteoohvrite seas, kui suur osakaal ja mitu inimest oli üle 60-aastaste ohvriabisse helistajate seas ning kui suur osakaal ja mitu inimest oli üle 75-aastaste kuriteo tõttu kannatanute seas?";
    const result = validateExactFactAnswer({
      message,
      reply: "1. Üle 60-aastaste registreeritud kuriteoohvrite seas oli 10% ehk 640 inimest.\n2) Üle 60-aastaste ohvriabisse helistajate seas 6% ehk 227 inimest.\n3. Üle 75-aastaste kannatanute seas 2% ehk 100 inimest.",
      sources: [{
        id: "v04",
        documentId: "v04-doc",
        evidenceText: "Üle 60-aastaste registreeritud kuriteoohvrite seas oli 10% ehk 640 inimest. Üle 60-aastaste ohvriabisse helistajate seas oli 6% ehk 227 inimest. Üle 75-aastaste kannatanute seas oli 2% ehk 100 inimest."
      }],
      retrievalMeta: {
        documentIdentityEvidence: {
          required: true,
          matched: true,
          confidence: "high",
          selectedDocumentId: "v04-doc"
        },
        requestedFactSlotContract: {
          version: "requested_fact_slot_contract_v1",
          enabled: true,
          complete: true,
          question_scope_values: ["60", "75"],
          slots: [
            ["proportion", "10", "percent"],
            ["count", "640", null],
            ["proportion", "6", "percent"],
            ["count", "227", null],
            ["proportion", "2", "percent"],
            ["count", "100", null]
          ].map(([value_type, evidence_value, unit], index) => ({
            slot_index: index + 1,
            value_type,
            evidence_value,
            unit,
            scope_values: index < 4 ? ["60"] : ["75"],
            input_form: "original"
          }))
        }
      }
    });
    assert.equal(result.passed, true);
    assert.equal(result.trace.requested_fact_slot_contract_checked, true);
  });

  test("õiged V04 arvud ei läbi väravat, kui nähtuste sildid on vahetatud", () => {
    const message = "Anu Lepsi ja Lenne Indovi 2025. aasta artiklis kui suur osakaal ja mitu inimest oli üle 60-aastaste registreeritud kuriteoohvrite seas, kui suur osakaal ja mitu inimest oli üle 60-aastaste ohvriabisse helistajate seas ning kui suur osakaal ja mitu inimest oli üle 75-aastaste kuriteo tõttu kannatanute seas?";
    const plan = buildQuestionPlan({ message });
    const values = [["10", "percent"], ["640", null], ["6", "percent"], ["227", null], ["2", "percent"], ["100", null]];
    const requestedFactSlotContract = {
      version: "requested_fact_slot_contract_v1",
      enabled: true,
      complete: true,
      question_scope_values: ["60", "75"],
      slots: plan.semantic_candidates.requested_fact_slots.slots.map((slot, index) => ({
        slot_index: slot.index,
        value_type: slot.value_type,
        evidence_value: values[index][0],
        unit: values[index][1],
        scope_values: slot.scope_values,
        relation_terms: slot.relation_terms,
        relation_term_variants: slot.relation_term_variants || []
      }))
    };
    const sources = [{
      id: "v04",
      documentId: "v04-doc",
      evidenceText: "Üle 60-aastaste registreeritud kuriteoohvrite seas oli 10% ehk 640 inimest. Üle 60-aastaste ohvriabisse helistajate seas oli 6% ehk 227 inimest. Üle 75-aastaste kannatanute seas oli 2% ehk 100 inimest."
    }];
    const retrievalMeta = {
      documentIdentityEvidence: {
        required: true,
        matched: true,
        confidence: "high",
        selectedDocumentId: "v04-doc"
      },
      queryPlan: { mode: "specific_research_fact", question_planner: plan },
      requestedFactEvidenceCoverage: { enabled: true, complete: true },
      requestedFactSlotContract
    };
    const swapped = validateExactFactAnswer({
      message,
      reply: "1. Üle 60-aastaste ohvriabisse helistajate seas oli 10% ehk 640.\n2. Üle 60-aastaste registreeritud kuriteoohvrite seas oli 6% ehk 227.\n3. Üle 75-aastaste kuriteo tõttu kannatanute seas oli 2% ehk 100.",
      sources,
      retrievalMeta
    });
    assert.equal(swapped.passed, false);
    assert.equal(swapped.trace.reason, "requested_metric_relation_mismatch");

    const swappedComma = validateExactFactAnswer({
      message,
      reply: "Üle 60-aastaste ohvriabisse helistajate seas oli 10% ehk 640 inimest, üle 60-aastaste registreeritud kuriteoohvrite seas oli 6% ehk 227 inimest, üle 75-aastaste kuriteo tõttu kannatanute seas oli 2% ehk 100 inimest.",
      sources,
      retrievalMeta
    });
    assert.equal(swappedComma.passed, false);
    assert.equal(swappedComma.trace.reason, "requested_metric_relation_mismatch");

    const substitutedThirdLabel = validateExactFactAnswer({
      message,
      reply: "1. Üle 60-aastaste registreeritud kuriteoohvrite seas oli 10% ehk 640.\n2. Üle 60-aastaste ohvriabisse helistajate seas oli 6% ehk 227.\n3. Üle 75-aastaste registreeritud kuriteoohvrite seas oli 2% ehk 100.",
      sources,
      retrievalMeta
    });
    assert.equal(substitutedThirdLabel.passed, false);
    assert.equal(substitutedThirdLabel.trace.reason, "requested_metric_relation_mismatch");

    const correct = validateExactFactAnswer({
      message,
      reply: "1. Üle 60-aastaste registreeritud kuriteoohvrite seas oli 10% ehk 640.\n2. Üle 60-aastaste ohvriabisse helistajate seas oli 6% ehk 227.\n3. Üle 75-aastaste kuriteo tõttu kannatanute seas oli 2% ehk 100.",
      sources,
      retrievalMeta
    });
    assert.equal(correct.passed, true);

    const correctComma = validateExactFactAnswer({
      message,
      reply: "Üle 60-aastaste registreeritud kuriteoohvrite seas oli 10% ehk 640 inimest, üle 60-aastaste ohvriabisse helistajate seas oli 6% ehk 227 inimest, üle 75-aastaste kuriteo tõttu kannatanute seas oli 2% ehk 100 inimest.",
      sources,
      retrievalMeta
    });
    assert.equal(correctComma.passed, true);

    const correctParentheticalComma = validateExactFactAnswer({
      message,
      reply: "Üle 60-aastaste registreeritud kuriteoohvrite seas, keda uuringus käsitleti, oli 10% ehk 640 inimest; üle 60-aastaste ohvriabisse helistajate seas oli 6% ehk 227 inimest; üle 75-aastaste kuriteo tõttu kannatanute seas oli 2% ehk 100 inimest.",
      sources,
      retrievalMeta
    });
    assert.equal(correctParentheticalComma.passed, true);
  });

  test("J08 suure ja keskmise hoolduskoormuse riskisildid jäävad oma protsendi külge", () => {
    const message = "Vaike Vainu 2023. aasta artiklis „Suure hoolduskoormusega inimesed vajavad täiendavat abi” kui suur osa vastanutest vajas lisabi, kui suur osa palju lisabi ning kui suur osa oli suure ja keskmise hoolduskoormuse riskiga?";
    const plan = buildQuestionPlan({ message });
    const values = ["61", "26", "11", "18"];
    const requestedFactSlotContract = {
      version: "requested_fact_slot_contract_v1",
      enabled: true,
      complete: true,
      question_scope_values: [],
      slots: plan.semantic_candidates.requested_fact_slots.slots.map((slot, index) => ({
        slot_index: slot.index,
        value_type: slot.value_type,
        evidence_value: values[index],
        unit: "percent",
        scope_values: slot.scope_values,
        relation_terms: slot.relation_terms,
        relation_term_variants: slot.relation_term_variants || [],
        coordination_group: slot.coordination_group
      }))
    };
    const sources = [{
      id: "j08",
      documentId: "j08-doc",
      evidenceText: "Lisabi vajas 61% vastanutest ja palju lisabi 26%. Suure hoolduskoormuse riskiga oli 11% ning keskmise hoolduskoormuse riskiga 18%."
    }];
    const retrievalMeta = {
      documentIdentityEvidence: {
        required: true,
        matched: true,
        confidence: "high",
        selectedDocumentId: "j08-doc"
      },
      queryPlan: { mode: "specific_research_fact", question_planner: plan },
      requestedFactEvidenceCoverage: { enabled: true, complete: true },
      requestedFactSlotContract
    };
    const correct = validateExactFactAnswer({
      message,
      reply: "Lisabi vajas 61%; palju lisabi 26%; suure hoolduskoormuse riskiga oli 11%; keskmise hoolduskoormuse riskiga oli 18%.",
      sources,
      retrievalMeta
    });
    assert.equal(correct.passed, true);

    const swapped = validateExactFactAnswer({
      message,
      reply: "Lisabi vajas 61%; palju lisabi 26%; keskmise hoolduskoormuse riskiga oli 11%; suure hoolduskoormuse riskiga oli 18%.",
      sources,
      retrievalMeta
    });
    assert.equal(swapped.passed, false);
    assert.equal(swapped.trace.reason, "requested_metric_relation_mismatch");
  });

  test("J14 kohtujuhtumite ja kohtuväliste kokkulepete sildid jäävad lähima arvu külge", () => {
    const message = "Anne-Ly Sumre 2019. aasta artiklis „Lastekaitsjad jäävad tihti omavahel sõdivate vanemate vahele” kui palju oli Saue vallas alla 18-aastasi lapsi, kui suur osa hooldusõiguse jagamise juhtumitest jõudis kohtusse ning mitu kohtujuhtumit ja kohtuvälist kokkulepet oli ühe spetsialisti näites?";
    const plan = buildQuestionPlan({ message });
    const values = [["5800", null], ["90", "percent"], ["14", null], ["3", null]];
    const requestedFactSlotContract = {
      version: "requested_fact_slot_contract_v1",
      enabled: true,
      complete: true,
      question_scope_values: ["18"],
      slots: plan.semantic_candidates.requested_fact_slots.slots.map((slot, index) => ({
        slot_index: slot.index,
        value_type: slot.value_type,
        evidence_value: values[index][0],
        unit: values[index][1],
        scope_values: slot.scope_values,
        relation_terms: slot.relation_terms,
        relation_term_variants: slot.relation_term_variants || [],
        coordination_group: slot.coordination_group
      }))
    };
    const sources = [{
      id: "j14",
      documentId: "j14-doc",
      evidenceText: "Saue vallas oli alla 18-aastasi lapsi üle 5800. Hooldusõiguse jagamise juhtumitest jõudis kohtusse umbes 90%. Ühe spetsialisti näites oli 14 kohtujuhtumit ja 3 kohtuvälist kokkulepet."
    }];
    const retrievalMeta = {
      documentIdentityEvidence: {
        required: true,
        matched: true,
        confidence: "high",
        selectedDocumentId: "j14-doc"
      },
      queryPlan: { mode: "specific_research_fact", question_planner: plan },
      requestedFactEvidenceCoverage: { enabled: true, complete: true },
      requestedFactSlotContract
    };
    const correct = validateExactFactAnswer({
      message,
      reply: "Saue vallas oli alla 18-aastasi lapsi üle 5800 ja kohtusse jõudis umbes 90%; ühe spetsialisti näites oli 14 kohtujuhtumit ja 3 kohtuvälist kokkulepet.",
      sources,
      retrievalMeta
    });
    assert.equal(correct.passed, true);

    const swapped = validateExactFactAnswer({
      message,
      reply: "Saue vallas oli alla 18-aastasi lapsi üle 5800 ja kohtusse jõudis umbes 90%; ühe spetsialisti näites oli 14 kohtuvälist kokkulepet ja 3 kohtujuhtumit.",
      sources,
      retrievalMeta
    });
    assert.equal(swapped.passed, false);
    assert.equal(swapped.trace.reason, "requested_metric_relation_mismatch");
  });

  test("ei luba sama dokumendi vanuserühmade kvalifikaatoreid mõõdikute vahel vahetada", () => {
    const message = "Anu Lepsi ja Lenne Indovi 2025. aasta artiklis kui suur osakaal ja mitu inimest oli üle 60-aastaste registreeritud kuriteoohvrite seas, kui suur osakaal ja mitu inimest oli üle 60-aastaste ohvriabisse helistajate seas ning kui suur osakaal ja mitu inimest oli üle 75-aastaste kuriteo tõttu kannatanute seas?";
    const result = validateExactFactAnswer({
      message,
      reply: "Üle 75-aastaste registreeritud kuriteoohvrite seas oli 10% ehk 640 inimest; üle 60-aastaste ohvriabisse helistajate seas 6% ehk 227 inimest; üle 60-aastaste kannatanute seas 2% ehk 100 inimest.",
      sources: [{
        id: "v04",
        documentId: "v04-doc",
        evidenceText: "Üle 60-aastaste registreeritud kuriteoohvrite seas oli 10% ehk 640 inimest. Üle 60-aastaste ohvriabisse helistajate seas oli 6% ehk 227 inimest. Üle 75-aastaste kannatanute seas oli 2% ehk 100 inimest."
      }],
      retrievalMeta: {
        documentIdentityEvidence: {
          required: true,
          matched: true,
          confidence: "high",
          selectedDocumentId: "v04-doc"
        },
        queryPlan: {
          mode: "specific_research_fact",
          question_planner: buildQuestionPlan({ message })
        }
      }
    });
    assert.equal(result.passed, false);
    assert.equal(result.trace.reason, "requested_metric_scope_mismatch");
  });

  test("J18 nõuab kolme praktikurühma täielikku seost ja sama valimi koguarvu", () => {
    const message = "Erle Eenmaa 2022. aasta artiklis „Psüühilise erivajadusega inimese osalus oma eestkostes” kui palju osalejaid oli igas kolmes praktikute rühmas ja kui palju kokku?";
    const sources = [{
      id: "j18",
      documentId: "j18-doc",
      year: 2022,
      evidenceText: "Igas kolmes praktikute rühmas oli 5 osalejat: kohtunikud, erihoolekandeasutuse töötajad ja KOV-i sotsiaaltöötajad. Kokku osales 15 praktikut."
    }];
    const retrievalMeta = {
      documentIdentityEvidence: {
        required: true,
        matched: true,
        confidence: "high",
        selectedDocumentId: "j18-doc"
      },
      queryPlan: {
        mode: "specific_research_fact",
        question_planner: buildQuestionPlan({ message })
      }
    };
    const complete = validateExactFactAnswer({
      message,
      reply: "Igas kolmes praktikute rühmas oli 5 osalejat, kokku 15.",
      sources,
      retrievalMeta
    });
    assert.equal(complete.passed, true);

    const incomplete = validateExactFactAnswer({
      message,
      reply: "Praktikute rühmas oli 5 osalejat, kokku 15.",
      sources,
      retrievalMeta
    });
    assert.equal(incomplete.passed, false);
    assert.equal(incomplete.trace.reason, "numeric_category_value_mismatch");
    assert.equal(incomplete.trace.expected_group_cardinality, 3);
  });

  test("lukustatud document_id võidab sama pealkirjaga kõrvaldokumendi", () => {
    const result = validateExactFactAnswer({
      message: "Mitu otsust analüüsiti?",
      reply: "Analüüsiti 42 otsust.",
      sources: [{
        id: "right-source",
        documentId: "right-doc",
        title: "Sama pealkiri",
        evidenceText: "Analüüsiti 41 otsust."
      }, {
        id: "wrong-source",
        documentId: "wrong-doc",
        title: "Sama pealkiri",
        evidenceText: "Analüüsiti 42 otsust."
      }],
      retrievalMeta: {
        documentIdentityEvidence: {
          required: true,
          matched: true,
          confidence: "high",
          selectedDocumentId: "right-doc",
          selectedTitle: "Sama pealkiri"
        }
      }
    });
    assert.equal(result.passed, false);
    assert.equal(result.trace.reason, "unsupported_numeric_claim");
  });

  test("lõpliku konteksti puuduva faktisloti korral ei valideeri osalist vastust", () => {
    const result = validateExactFactAnswer({
      message: "Mitu intervjuud tehti ja millist analüüsimeetodit kasutati?",
      reply: "Tehti 7 intervjuud.",
      sources: [{ id: "j11", documentId: "j11-doc", evidenceText: "Tehti 7 intervjuud." }],
      retrievalMeta: {
        queryPlan: { mode: "specific_research_fact" },
        requestedFactEvidenceCoverage: {
          enabled: true,
          complete: false,
          requested_slot_count: 2,
          covered_slot_count: 1,
          missing_slot_indexes: [1]
        }
      }
    });
    assert.equal(result.passed, false);
    assert.equal(result.trace.reason, "requested_fact_evidence_incomplete");
    assert.deepEqual(result.trace.requested_fact_missing_slot_indexes, [1]);
  });

  test("J03 artikli telefoninumbrid läbivad sama allika arvuvärava", () => {
    const message = "Millised on vaimse tervise kriisi tunnused ning millistele telefoninumbritele tuleb nende korral helistada Külli Mäe 2018. aasta artikli järgi?";
    const sources = [{
      id: "j03",
      evidenceText: "Kriisi tunnused on lootusetus ja suitsiidimõtted. Vahetu ohu korral helista 112, emotsionaalse toe telefon on 1220."
    }];
    const supported = validateExactFactAnswer({
      message,
      reply: "Tunnused on lootusetus ja suitsiidimõtted. Vahetu ohu korral helista 112 ning emotsionaalse toe saamiseks 1220.",
      sources
    });
    assert.equal(supported.passed, true);

    const unsupported = validateExactFactAnswer({
      message,
      reply: "Tunnused on lootusetus ja suitsiidimõtted. Helista numbrile 116111.",
      sources
    });
    assert.equal(unsupported.passed, false);
    assert.equal(unsupported.trace.reason, "unsupported_numeric_claim");
  });

  test("ei luba tõlgendada protsendi n-väärtust valimi suuruseks ega tuletada uut isikute arvu", () => {
    const result = validateExactFactAnswer({
      message: "Kui palju üle 75-aastaseid oli kuritegevusega kokku puutunud?",
      reply: "Üle 75-aastastest oli kokku puutunud 2% ehk 100 inimese suuruses valimis 2 inimest.",
      sources: [{
        id: "older-violence-2025",
        evidenceText: "(1) Vägivald vanemaealiste vastu.\nÜle 75-aastastest oli viimase aasta jooksul kuritegevusega kokku puutunud 2% (n=100)."
      }]
    });
    assert.equal(result.passed, false);
    assert.equal(result.trace.reason, "numeric_relation_mismatch");
  });

  test("leiab n-väärtuse vale valimitõlgenduse ka järgmisest lausest", () => {
    const result = validateExactFactAnswer({
      message: "Kui palju üle 75-aastaseid oli viimase aasta jooksul kuritegevusega kokku puutunud?",
      reply: "Kuritegevusega puutus kokku 2% üle 75-aastastest. Valimis oli 100 üle 75-aastast inimest, seega vastas sellele ligikaudu 2 inimest.",
      sources: [{
        id: "older-violence-2025",
        evidenceText: "(1) Vägivald vanemaealiste vastu.\nÜle 75-aastastest oli viimase aasta jooksul kuritegevusega kokku puutunud 2% (n=100)."
      }]
    });
    assert.equal(result.passed, false);
    assert.equal(result.trace.reason, "numeric_relation_mismatch");
  });

  test("kolme protsendi küsimus nõuab samast dokumendist kõigi kolme protsendi lõike", () => {
    const result = selectSingleSourceNumericFactGroups(
      "Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?",
      [{ bodies: ["10% (n=640) ja 6% (n=227)"] }]
    );
    assert.equal(result.expectedCount, 3);
    assert.equal(result.evidenceCount, 2);
    assert.equal(result.sufficient, false);
  });

  test("küsitud protsente ei asenda sama artikli muud protsendid", () => {
    const result = selectSingleSourceNumericFactGroups(
      "Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?",
      [{ bodies: ["2% (n=100), 9% (n=225) ja 11% puutusid eri nähtustega kokku."] }]
    );
    assert.equal(result.expectedCount, 3);
    assert.equal(result.evidenceCount, 1);
    assert.equal(result.sufficient, false);
  });

  test("renderduse ette tõusevad sama dokumendi kõiki küsitud protsente katvad lõigud", () => {
    const [group] = prioritizeRequestedNumericEvidence(
      "Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?",
      [{ bodies: [
        "Üldine sissejuhatus.",
        "10% (n=640) ja 6% (n=227) olid üle 60-aastased.",
        "Muu taustainfo.",
        "2% (n=100) üle 75-aastastest puutus kuritegevusega kokku."
      ] }]
    );
    assert.match(group.bodies[0], /10%.*6%/u);
    assert.match(group.bodies[1], /2%/u);
  });

  test("säilitab allika n-väärtuse loendusena ega nimeta seda valimiks", () => {
    const result = validateExactFactAnswer({
      message: "Mida näitas 2% vanemaealiste kohta?",
      reply: "Üle 75-aastastest oli 2% (n=100) viimase aasta jooksul kuritegevusega kokku puutunud.",
      sources: [{
        id: "older-violence-2025",
        evidenceText: "(1) Vägivald vanemaealiste vastu.\nÜle 75-aastastest oli viimase aasta jooksul kuritegevusega kokku puutunud 2% (n=100)."
      }]
    });
    assert.equal(result.passed, true);
  });
});

test("kuvatud allika ID jääb valitud tõendiallika ID-ga samaks", () => {
  const source = {
    source_id: "elin-2016",
    document_id: "elin-doc-2016",
    sourceType: "journal_article",
    title: "Sotsiaaltöötajate tööalase toetuse kogemused",
    evidenceText: "Tehti seitse intervjuud: kuus individuaalset ja üks rühmaintervjuu."
  };
  const attribution = buildSourceAttribution(
    "Tehti 7 intervjuud: 6 individuaalset ja 1 rühmaintervjuu.",
    [source],
    {
      queryPlan: { mode: "specific_research_fact" },
      factValidation: { passed: true, supporting_source_id: "elin-2016" },
      documentIdentityEvidence: {
        required: true,
        matched: true,
        confidence: "high",
        selectedDocumentId: "elin-doc-2016"
      }
    }
  );
  assert.deepEqual(attribution.selected_context_source_ids, ["elin-2016"]);
  assert.deepEqual(attribution.displayed_source_ids, ["elin-2016"]);
  assert.equal(attribution.displayed_sources_subset_of_selected, true);
});

test("validaatori toetatud kõrvalallikas ei murra lukustatud dokumendi allikakuva", () => {
  const attribution = buildSourceAttribution(
    "Vastus tugineb faktile.",
    [{
      source_id: "wrong-source",
      document_id: "wrong-doc",
      sourceType: "journal_article",
      title: "Kõrvalartikkel",
      evidenceText: "Vastus tugineb faktile."
    }],
    {
      queryPlan: { mode: "specific_research_fact" },
      factValidation: { passed: true, supporting_source_id: "wrong-source" },
      documentIdentityEvidence: {
        required: true,
        matched: true,
        confidence: "high",
        selectedDocumentId: "locked-doc"
      }
    }
  );
  assert.deepEqual(attribution.displayed_source_ids, []);
  assert.equal(attribution.attribution_decisions[0].reason, "query_anchor_mismatch");
});
