import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { formatSourceLabel, normalizeSourceLabelPages } from "../../components/chat/utils/sources.js";
import { validateExactFactAnswer } from "../../lib/chat/factContract.js";
import { normalizePageReferences } from "../../lib/chat/pageRanges.js";
import { buildSpecificResearchFactQueries } from "../../lib/chat/queryPlanner.js";
import { buildQuestionPlan } from "../../lib/chat/questionPlanner.js";
import { resolveMultiQueryTopK } from "../../lib/chat/retrievalOrchestrator.js";
import {
  prioritizeRequestedNumericEvidence,
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
    assert.ok(queries.some(query => /(?:^|\s)2%(?:\s|$)/u.test(query) && !/10%|6%/u.test(query)));
  });

  test("üksiku protsendi faktipäring säilitab piisava lõigusügavuse", () => {
    const plan = buildQuestionPlan({
      message: "Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?"
    });
    const queries = buildSpecificResearchFactQueries([], "", plan);
    const twoPercent = queries.find(entry => /(?:^|\s)2%(?:\s|$)/u.test(entry.query) && !/10%|6%/u.test(entry.query));
    assert.equal(twoPercent?.min_top_k, 16);
    assert.match(twoPercent.query, /eakate.*vanemaealiste.*vagivalla.*uuring.*2%/u);
    assert.doesNotMatch(twoPercent.query, /vagivallauuring.*vagivallauuring/u);
    assert.equal(resolveMultiQueryTopK({ index: 4, topK: 18, queryCount: 6, minTopK: twoPercent.min_top_k }), 16);
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

  test("kolme protsendi küsimus nõuab samast dokumendist kõigi kolme protsendi lõike", () => {
    const result = selectSingleSourceNumericFactGroups(
      "Eakate vägivallauuring: mis olid 10%, 6% ja 2% näidud?",
      [{ bodies: ["10% (n=640) ja 6% (n=227)"] }]
    );
    assert.equal(result.expectedCount, 3);
    assert.equal(result.evidenceCount, 2);
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
