import test from "node:test";
import assert from "node:assert/strict";
import { isJournalFrontMatter } from "../../lib/chat/evidenceContent.js";
import { buildContextWithBudget, groupMatches } from "../../lib/chat/ragContext.js";

import {
  ALLOWED_ATTRIBUTION_DECISION_REASONS,
  buildSourceAttribution
} from "../../lib/chat/sourceAttribution.js";

function guideline(sourceId, title, evidenceText) {
  return {
    source_id: sourceId,
    source_type: "official_guideline",
    title,
    evidenceText
  };
}

test("journal cover headings cannot supply article evidence or claim support", () => {
  const cover = "NR 4/2023 ISSN 1406-8826 Kuidas pakkuda inimesele terviklikku tuge? Rehabilitatsiooniteenuse muudatused ja asutuste kogemused Sotsiaaltöötaja aitab raviteekonnal vastu pidada Millist tuge vajab õpilane koolis?";
  const content = "Tugiisik saadab inimese arsti juurde ja aitab tal tervishoiuteenustele pääseda.";
  const source = { source_id: "support-article", source_type: "journal_article", title: "Tugiisik toetab inimest", evidenceText: cover };
  assert.equal(isJournalFrontMatter(cover, source), true);
  assert.equal(isJournalFrontMatter(content + " ISSN 1406-8826", source), false);
  assert.equal(isJournalFrontMatter("NR 4/2023 ISSN 1406-8826 " + content, source), false);
  assert.equal(isJournalFrontMatter(cover, { source_type: "official_guideline" }), false);
  assert.equal(isJournalFrontMatter(`${"Artikli metadata ".repeat(12)} Sisukord 12 Lastekaitse 23 Sotsiaaltöö 45 Hoolekanne`, source), true);
  const attribution = buildSourceAttribution("Artikkel „Tugiisik toetab inimest” selgitab terviklikku tuge ja rehabilitatsiooniteenuse muudatusi.", [source],
    { query: "Mida kirjutab ajakiri terviklikust toest?", queryPlan: { mode: "overview_synthesis", needs_multiple_sources: true } });
  assert.deepEqual(attribution.claim_supported_source_ids, []);
  assert.deepEqual(attribution.displayed_source_ids, []);
  const matches = [cover, content].map(text => ({ id: "support-article", text,
    metadata: { source_id: "support-article", source_type: "journal_article", title: source.title } }));
  const groups = groupMatches(matches);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].bodies, [content]);
  const rendered = buildContextWithBudget([{ ...groups[0], bodies: [cover, content] }]);
  assert.equal(rendered.text.includes("ISSN"), false);
  assert.equal(rendered.text.includes(content), true);
  const metadataOnlyGroups = groupMatches([matches[0]]);
  assert.equal(metadataOnlyGroups.length, 1);
  assert.deepEqual(metadataOnlyGroups[0].bodies, []);
  assert.equal(buildContextWithBudget(metadataOnlyGroups).text, "");
  const authoredSource = { ...source, authors: ["Marin Vaher"], year: 2023, document_id: "public-article" };
  const authorPlan = { mode: "person_source_lookup", person_name: "Marin Vaher", person_source_intent: "authored_works" };
  assert.deepEqual(buildSourceAttribution("Marin Vaher kirjutas artikli „Tugiisik toetab inimest”.", [authoredSource],
    { query: "Millised artiklid kirjutas Marin Vaher?", queryPlan: authorPlan }).displayed_source_ids, ["support-article"]);
  assert.deepEqual(buildSourceAttribution("Marin Vaher, 2023. Tugiisik toetab inimest.", [authoredSource],
    { query: "Millised artiklid kirjutas Marin Vaher?", queryPlan: authorPlan }).displayed_source_ids, ["support-article"]);
  assert.deepEqual(buildSourceAttribution("Marin Vaher kirjutas artikli „Tugiisik toetab inimest”, mis tõendab rehabilitatsiooniteenuse muudatusi.", [authoredSource],
    { query: "Millised artiklid kirjutas Marin Vaher?", queryPlan: authorPlan }).displayed_source_ids, []);
});

test("journal synthesis needs rendered body support, not publisher or title metadata", () => {
  const plan = { mode: "overview_synthesis", needs_multiple_sources: true };
  const claim = "See kirjeldab otsest koostööd tervishoiu ja sotsiaaltöö vahel.";
  const promotion = "Telli e-uudiskiri, mis sisaldab ajakirja uudiseid. Telli ajakiri! Tellimuse saab vormistada veebilehel. Teeme koostööd! Kaastöid ja koostööettepanekuid ootame.";
  const source = { source_id: "promo", source_type: "journal_article", title: "Uus omastehoolduse infopunkt", journalTitle: "Sotsiaaltöö", section: "Reklaam", evidenceText: promotion };
  assert.equal(isJournalFrontMatter(promotion, source), true);
  assert.equal(isJournalFrontMatter("Infopunkt nõustab omastehooldajaid ja pakub abi.", source), false);
  assert.deepEqual(buildSourceAttribution(claim, [source], { queryPlan: plan }).displayed_source_ids, []);
  const unrelated = { ...source, evidenceText: "(1) Sotsiaaltöö | koostöö tervishoius\nKirjutage toimetusele koostööettepanekutega." };
  assert.deepEqual(buildSourceAttribution(claim, [unrelated], { queryPlan: plan }).claim_supported_source_ids, []);
  const titleOnly = { ...source, title: "Koostöö tervishoius", evidenceText: "Infopunkt avati raamatukogus." };
  assert.deepEqual(buildSourceAttribution("Artikkel „Koostöö tervishoius” tõendab, et teenuste ühine juhtimine vähendas katkestusi.", [titleOnly], { queryPlan: plan }).claim_supported_source_ids, []);
  const substantive = { ...titleOnly, year: 2024, evidenceText: "Teenuste ühine juhtimine vähendas katkestusi ning toetas koostööd tervishoiu ja sotsiaaltöö vahel." };
  assert.deepEqual(buildSourceAttribution("Artikkel „Koostöö tervishoius” (2024) kirjeldab, kuidas teenuste ühine juhtimine vähendas katkestusi.", [substantive], { queryPlan: plan }).displayed_source_ids, ["promo"]);
});

const twoClaimReply = [
  "Muuda ohustatud kontode paroolid kohe.",
  "Säilita sõnumid ja ekraanipildid tõenditena."
].join(" ");

test("long answers use complete internal claim coverage beyond the trace limit", () => {
  const statements = Array.from({ length: 40 }, (_, index) =>
    `Hindamisvaldkond ${index + 1}: hinnatakse lapse turvalisust ja toimetulekut.`);
  const method = "Erimeetod kasutab turvavõrgustiku genogrammi ning kokkuleppelist skaalaankrut.";
  const result = buildSourceAttribution([...statements, method].join("\n"), [
    guideline("primary", "Põhijuhend", statements.join("\n")),
    guideline("late-duplicate", "Täiendav käsitlus", statements.slice(32).join("\n")),
    guideline("distinct-method", "Eraldi mudel", method)
  ], { queryPlan: { mode: "professional_method_guidance", needs_multiple_sources: true } });
  assert.deepEqual(new Set(result.displayed_source_ids), new Set(["primary", "distinct-method"]));
  assert.equal(result.filter_reasons["late-duplicate"], "claim_support_subsumed");
  const primary = result.attribution_decisions.find(item => item.source_id === "primary");
  assert.equal(primary.supported_claim_count, 40);
  assert.equal(primary.supported_claim_indices.length, 32);
  assert.equal(result.claim_support_graph[39].supporting_source_ids.includes("primary"), true);
});

test("long method guidance keeps the named model source while suppressing late duplicates", () => {
  const modelClaim = "„Turvalisuse märkide“ mudelit on Eestis käsitletud täiendava juhtumikorralduse töövahendina.";
  // Before and after the former 64-claim boundary, including the observed
  // index 71 and a longer permitted answer: do not merely raise the cap.
  for (const precedingClaims of [63, 64, 71, 128]) {
    const statements = Array.from({ length: precedingClaims }, (_, index) =>
      `Hindamisvaldkond ${index + 1}: hinnatakse lapse turvalisust ja toimetulekut.`);
    const result = buildSourceAttribution([...statements, modelClaim].join("\n"), [
      guideline("primary", "Põhijuhend", statements.join("\n") +
        " Eestis käsitletakse juhtumikorralduse töövahendina lapse heaolu kolmnurka."),
      guideline("late-duplicate", "Täiendav käsitlus", statements.slice(32).join("\n")),
      { source_id: "named-model", source_type: "journal_article", title: "Täiendav juhtumikorraldusmudel",
        evidenceText: "„T urvalisuse märkide“ mudelit saab ühildada Eestis kasutatavate juhtumikorralduse töövahenditega." }
    ], { queryPlan: { mode: "professional_method_guidance", needs_multiple_sources: true } });
    assert.deepEqual(new Set(result.displayed_source_ids), new Set(["primary", "named-model"]));
    assert.equal(result.claim_support_graph.length, precedingClaims + 1);
    assert.deepEqual(result.claim_support_graph.at(-1).supporting_source_ids, ["named-model"]);
    assert.equal(result.filter_reasons["late-duplicate"], "claim_support_subsumed");
    const primary = result.attribution_decisions.find(item => item.source_id === "primary");
    assert.equal(primary.supported_claim_count, precedingClaims);
    assert.equal(primary.supported_claim_indices.length, 32);
  }
});

test("ordinal publication years stay bound to their claim, including at the start of a line", () => {
  const queryPlan = { mode: "overview_synthesis", needs_multiple_sources: true };
  // Exact rendered 31.08 Eessõna body, SHA-256 650f1fe2...: the publication
  // year is metadata, while the integration/KOV content is in the body.
  const evidenceText = "Sotsiaaltöö argipäeva ja arengu tutvustamisel toob ajakiri ühise laua taha praktikud, teoreetikud, õppurid ja huvilugejad. Eesti sotsiaaltöö assotsiatsioon (ESTA) esindab erialakogukonda, on sotsiaaltööd tegevate ja väärtustavate inimeste ühendaja ning seisab valdkonna töötajate huvide eest.\n---\nSelle numbri teemad on vaheldusrikkad, ulatudes kohaliku omavalitsuse tööst ja lastekaitsest ning noorte heaolust kuni rehabilitatsiooni, sotsiaal- ja tervishoiu lõimumise, eetika, töötajate turvalisuse, kriisivalmiduse ja mentorluseni....";
  for (const year of [2018, 2026, 2031]) {
    const sources = [
      { source_id: "old-publication", source_type: "journal_article", title: "Varasem käsitlus", year: year - 1, evidenceText },
      { source_id: "current-publication", source_type: "journal_article", title: "Eessõna", year, evidenceText },
      { source_id: "metadata-only", source_type: "journal_article", title: "Lõimumine ja kohalik omavalitsus", year,
        evidenceText: "Kaastöid oodatakse toimetuse e-posti aadressile." }
    ];
    for (const reply of [
      `Uuemates, ${year}. aasta ajakirja teemakäsitlustes seostub see jätkuvalt sotsiaal- ja tervishoiu lõimumise ning kohaliku omavalitsuse tööga.`,
      `${year}. aasta käsitluses seostub see sotsiaal- ja tervishoiu lõimumise ning kohaliku omavalitsuse tööga.`,
      `1. ${year}. aasta artiklis seostub see sotsiaal- ja tervishoiu lõimumise ning kohaliku omavalitsuse tööga.`
    ]) {
      const result = buildSourceAttribution(reply, sources, { queryPlan });
      assert.equal(result.claim_support_graph.length, 1, reply);
      assert.deepEqual(result.claim_supported_source_ids, ["current-publication"], reply);
      assert.deepEqual(result.displayed_source_ids, ["current-publication"], reply);
    }
  }
});

test("publication metadata cannot date service events, even beside an exact title or repeated year", () => {
  const queryPlan = { mode: "thematic_synthesis", needs_multiple_sources: true };
  const source = { source_id: "journal", source_type: "journal_article", title: "Teenuste lõimumine", year: 2031,
    evidenceText: "Teenus alustas tegevust ning ühendas tervishoiu ja sotsiaalvaldkonna spetsialiste." };
  for (const reply of [
    "2031. aastal alustas teenus tegevust ja ühendas tervishoiu ning sotsiaalvaldkonna spetsialiste.",
    "Artikkel „Teenuste lõimumine” kinnitab, et teenus alustas tegevust 2031. aastal.",
    "2031. aasta artiklis „Teenuste lõimumine” kinnitatakse, et teenus alustas tegevust 2031. aastal.",
    "Teenus alustas tegevust 2031. aastal ning ühendas spetsialiste („Teenuste lõimumine”, 2031)."
  ]) {
    const result = buildSourceAttribution(reply, [source], { queryPlan });
    assert.deepEqual(result.claim_supported_source_ids, [], reply);
    assert.deepEqual(result.displayed_source_ids, [], reply);
  }
  const evidencedEvent = "Teenus alustas tegevust 2031. aastal ja ühendas tervishoiu ning sotsiaalvaldkonna spetsialiste.";
  assert.deepEqual(buildSourceAttribution(evidencedEvent, [{ ...source, evidenceText: evidencedEvent }], { queryPlan })
    .displayed_source_ids, ["journal"]);
  for (const citation of ["Artikkel „Teenuste lõimumine” (2031)", "Artikkel („Teenuste lõimumine”, 2031)"]) {
    assert.deepEqual(buildSourceAttribution(`${citation} kirjeldab, kuidas teenus ühendas tervishoiu ja sotsiaalvaldkonna spetsialiste.`, [source], { queryPlan })
      .displayed_source_ids, ["journal"]);
  }
});

test("two scattered general words cannot manufacture a unique synthesis source", () => {
  const queryPlan = { mode: "overview_synthesis", needs_multiple_sources: true };
  // Exact isolated Hiiumaa body (675 chars, ef6c97a0...). Only "teenus"
  // and "inimese" overlap with the claim, in different evidence sentences.
  const evidenceText = "S OT S I A A LTÖ Ö Koduteenust osutavad Hiiumaa Sotsiaalkeskus, Hellamaa Perekeskus, Emmaste ja Käina osavald. Kokku abistavad 42 klienti kaheksa töötajat. Sotsiaaltranspordi tarvis on Hiiumaa vallas viis sõiduautot ja kaks 9kohalist bussi, millest üks on kohandatud invabussiks. Hajaasustusest ja puudulikust ühistranspordiühendusest tingituna osutab vald sotsiaaltransporditeenust igas kuus ligikaudu 400 inimesele. Peamiselt sõidavad teenuse kasutajad arsti juurde nii Hiiumaa piires kui ka mandrile. Varjupaigateenust osutab MT Ü Samaaria Eesti Misjoni Hiiumaa osakond. Võlanõustamist pakume koostöös töötukassa ja sotsiaalkindlustusametiga. Turvakodu Hiiumaal ei ole....";
  const source = { source_id: "island-practice", source_type: "journal_article", year: 2018,
    title: "Hiiumaa: meretagune ühinemine tõi sotsiaaltöötajad kokku", evidenceText };
  const genericClaim = "Rõhk on sellel, et teenuseid ei korraldataks asutuste tööloogika, vaid inimese tegeliku vajaduse järgi.";
  assert.deepEqual(buildSourceAttribution(genericClaim, [source], { queryPlan }).claim_supported_source_ids, []);
  assert.deepEqual(buildSourceAttribution(genericClaim, [source], { queryPlan }).displayed_source_ids, []);
  // The same source genuinely supplies this sequential answer's local example.
  const localClaim = "Hiiumaa näide näitab, et teenuseid saab korraldada mitme kohaliku üksuse ja teenuseosutaja koostöös: koduteenust pakkusid Hiiumaa Sotsiaalkeskus, Hellamaa Perekeskus ning Emmaste ja Käina osavald; sotsiaaltransport toetas inimesi nii Hiiumaal kui ka mandrile arsti juurde sõitmisel („Hiiumaa: meretagune ühinemine tõi sotsiaaltöötajad kokku”, 2018).";
  assert.deepEqual(buildSourceAttribution(localClaim, [{ ...source, evidenceText: evidenceText.slice(0, 503) + "..." }], { queryPlan })
    .displayed_source_ids, ["island-practice"]);
  const relevant = { ...source, source_id: "person-centred", title: "Teenuskorralduse põhimõtted", evidenceText: genericClaim };
  assert.deepEqual(buildSourceAttribution(genericClaim, [source, relevant], { queryPlan }).displayed_source_ids, ["person-centred"]);
});

test("local paraphrases and stronger multi-sentence synthesis retain claim support", () => {
  const queryPlan = { mode: "overview_synthesis", needs_multiple_sources: true };
  for (const [reply, evidenceText] of [
    ["Teenused lähtuvad inimese vajadustest.", "Lähtutakse inimese vajadustest ning kavandatakse teenused."],
    ["Tervishoiu spetsialistid koordineerivad võrgustikutööd ja toetavad peresid.",
      "Tervishoiu spetsialistid koordineerivad võrgustikutööd. Võrgustikud toetavad peresid."],
    ["Kaardistatakse tugevusi ja hinnatakse abivajadust.", "Hinnatakse abivajadust ning kaardistatakse tugevusi."]
  ]) {
    const source = { source_id: "substantive", source_type: "journal_article", title: "Praktiline meetod", evidenceText };
    assert.deepEqual(buildSourceAttribution(reply, [source], { queryPlan }).displayed_source_ids, ["substantive"], reply);
  }
});

test("named objects require the complete ordered phrase in body evidence, not metadata", () => {
  const claim = "„Turvalisuse märkide“ mudel toetab lapse hindamist ja pere kaasamist.";
  for (const sourceType of ["journal_article", "official_guideline"]) {
    const sources = [
      { source_id: "actual", source_type: sourceType, title: "Täiendav mudel", evidenceText: claim },
      { source_id: "title-only", source_type: sourceType, title: "Turvalisuse märkide mudel",
        evidenceText: "Mudel toetab lapse hindamist ja pere kaasamist." },
      { source_id: "header-only", source_type: sourceType, title: "Turvalisuse märkide mudel",
        evidenceText: "(1) Turvalisuse märkide mudel\nMudel toetab lapse hindamist ja pere kaasamist." },
      { source_id: "different-name", source_type: sourceType, title: "Teine mudel",
        evidenceText: "„Turvalisuse käikide“ mudel toetab lapse hindamist ja pere kaasamist." },
      { source_id: "scattered", source_type: sourceType, title: "Hindamisjuhend",
        evidenceText: "Turvalisuse hindamisel on tähtis pere kaasamine. Märkide mudel toetab lapse hindamist." }
    ];
    const result = buildSourceAttribution(claim, sources,
      { queryPlan: { mode: "professional_method_guidance", needs_multiple_sources: true } });
    assert.deepEqual(result.claim_supported_source_ids, ["actual"]);
    assert.deepEqual(result.displayed_source_ids, ["actual"]);
  }
});

test("named service and method anchors retain suffix matching and numeric evidence checks", () => {
  for (const [claim, evidence] of [
    ["Meetod „Toetatud otsustamise“ parandas osalemist 3 rühmas.",
      "Toetatud otsustamisest lähtuv meetod parandas osalemist 3 rühmas."],
    ["Teenuse «Kogukonna toetus» kaudu jõudis abini 3 peret.",
      "Kogukonna toetus jõudis 3 pereni ning teenuse kaudu pakuti abi."],
    ['The "Shared decisions" method improved participation in 3 groups.',
      'The Shared decisions method improved participation in 3 groups.']
  ]) {
    const result = buildSourceAttribution(claim, [
      guideline("actual", "Juhend", evidence),
      guideline("name-without-number", "Meetodinimi", evidence.replace(/3/gu, "9"))
    ], { queryPlan: { mode: "professional_method_guidance", needs_multiple_sources: true } });
    assert.deepEqual(result.claim_supported_source_ids, ["actual"]);
  }
});

test("named-object body guards do not change pure authored-work bibliography", () => {
  const source = { source_id: "authored-model", source_type: "journal_article",
    title: "„Turvalisuse märkide“ mudel", authors: ["Marin Vaher"],
    evidenceText: "NR 4/2023 ISSN 1406-8826 Kuidas pakkuda inimesele terviklikku tuge? Rehabilitatsiooniteenuse muudatused ja asutuste kogemused Sotsiaaltöötaja aitab raviteekonnal vastu pidada Millist tuge vajab õpilane koolis?" };
  const options = { query: "Millised artiklid kirjutas Marin Vaher?",
    queryPlan: { mode: "person_source_lookup", person_name: "Marin Vaher", person_source_intent: "authored_works" } };
  assert.equal(isJournalFrontMatter(source.evidenceText, source), true);
  assert.deepEqual(buildSourceAttribution("Marin Vaher — „Turvalisuse märkide“ mudel.", [source], options)
    .displayed_source_ids, ["authored-model"]);
  assert.deepEqual(buildSourceAttribution("Marin Vaher kirjutas artikli „Turvalisuse märkide“ mudel, mis tõendab rehabilitatsiooniteenuse muudatusi.", [source], options)
    .displayed_source_ids, []);
});

test("default single-topic attribution suppresses lower-ranked subsumed claim support", () => {
  const result = buildSourceAttribution(twoClaimReply, [
    guideline(
      "supporting-guide",
      "Toetav juhend",
      "Säilita sõnumid ja ekraanipildid tõenditena."
    ),
    guideline(
      "primary-guide",
      "Põhijuhend",
      twoClaimReply
    )
  ], {
    query: "Kuidas inimest digiohu korral aidata?",
    queryPlan: { mode: "default", needs_multiple_sources: false }
  });

  assert.deepEqual(result.displayed_source_ids, ["primary-guide"]);
  const suppressed = result.attribution_decisions.find(item => item.source_id === "supporting-guide");
  assert.equal(suppressed?.decision, "hide");
  assert.equal(suppressed?.reason, "claim_support_subsumed");
  assert.equal(ALLOWED_ATTRIBUTION_DECISION_REASONS.has(suppressed?.reason), true);
});

test("default single-topic attribution keeps a source that adds another claim", () => {
  const result = buildSourceAttribution(twoClaimReply, [
    guideline(
      "password-guide",
      "Kontoturbe juhend",
      "Muuda ohustatud kontode paroolid kohe."
    ),
    guideline(
      "evidence-guide",
      "Tõendite juhend",
      "Säilita sõnumid ja ekraanipildid tõenditena."
    )
  ], {
    query: "Kuidas inimest digiohu korral aidata?",
    queryPlan: { mode: "default", needs_multiple_sources: false }
  });

  assert.deepEqual(new Set(result.displayed_source_ids), new Set([
    "password-guide",
    "evidence-guide"
  ]));
});

test("professional method guidance uses claim cover for its multi-source context", () => {
  for (const queryPlan of [{
      mode: "professional_method_guidance",
      needs_multiple_sources: true,
      selection_strategy: "multi_source_diversity"
    }, {
      mode: "default",
      selection_strategy: "multi_source_diversity",
      question_planner: {
        mode: "professional_method_guidance",
        needs_multiple_sources: true
      }
    }]) {
    const result = buildSourceAttribution(twoClaimReply, [
      guideline(
        "supporting-guide",
        "Toetav juhend",
        "Säilita sõnumid ja ekraanipildid tõenditena."
      ),
      guideline("primary-guide", "Põhijuhend", twoClaimReply)
    ], {
      query: "Kuidas spetsialist peaks abistamist korraldama?",
      queryPlan
    });

    assert.deepEqual(result.displayed_source_ids, ["primary-guide"]);
    assert.equal(result.filter_reasons["supporting-guide"], "claim_support_subsumed");
  }
});

test("explicit multi-source plan keeps overlapping supporting sources", () => {
  const result = buildSourceAttribution(twoClaimReply, [
    guideline("supporting-guide", "Toetav juhend", twoClaimReply),
    guideline("primary-guide", "Põhijuhend", twoClaimReply)
  ], {
    query: "Koonda mitme allika soovitused.",
    queryPlan: { mode: "default", needs_multiple_sources: true }
  });

  assert.deepEqual(result.displayed_source_ids, [
    "supporting-guide",
    "primary-guide"
  ]);
});

test("plural source-set listing keeps every named displayed source", () => {
  const reply = "Kuvatud allikad olid „Esimene juhend” ja „Teine käsiraamat”.";
  const result = buildSourceAttribution(reply, [
    guideline("first-source", "Esimene juhend", "Esimese juhendi sisu."),
    guideline("second-source", "Teine käsiraamat", "Teise käsiraamatu sisu.")
  ], {
    query: "Mis olid nende allikate pealkirjad?",
    queryPlan: { mode: "default", needs_multiple_sources: false }
  });

  assert.deepEqual(result.displayed_source_ids, [
    "first-source",
    "second-source"
  ]);
});

test("registry reference cannot subsume the only substantive answer source", () => {
  const result = buildSourceAttribution(twoClaimReply, [
    {
      ...guideline("registry-reference", "Materjalide register", twoClaimReply),
      evidence_role: "registry_reference"
    },
    guideline("substantive-guide", "Sisuline juhend", twoClaimReply)
  ], {
    queryPlan: { mode: "default", needs_multiple_sources: false }
  });

  assert.equal(result.displayed_source_ids.includes("substantive-guide"), true);
});

test("subject-first evidence limitation and a request for missing evidence show no sources", () => {
  const reply = "Teenuse maksumust ei saa siinse teabe põhjal usaldusväärselt öelda. Vastamiseks on vaja ajakohast hinnakirja, sest väljavõtted käsitlevad teenuse reforme, kuid ei sisalda hinnasummasid.";
  const result = buildSourceAttribution(reply, [
    guideline("background", "Teenuse reformid", "Väljavõtted käsitlevad teenuse reforme ja teenuse maksumust.")
  ]);
  assert.deepEqual(result.displayed_source_ids, []);
});

test("partial and same-sentence limitations keep independently supported substance", () => {
  for (const reply of [
    "Hinda ei saa kinnitada. Koduteenus toetab inimese iseseisvat toimetulekut kodus.",
    "Hinda ei saa kinnitada, kuid koduteenus toetab inimese iseseisvat toimetulekut kodus."
  ]) {
    const result = buildSourceAttribution(reply, [
      guideline("service", "Koduteenus", "Koduteenus toetab inimese iseseisvat toimetulekut kodus.")
    ]);
    assert.deepEqual(result.displayed_source_ids, ["service"]);
  }
});

test("narrated synthesis preserves cited sources but removes redundant unnamed background", () => {
  const reply = "Turvalise suhtluse käsiraamat soovitab luua turvalise suhtluskanali. Digitaalsete tõendite käsiraamat soovitab tõendid säilitada. Ohvrit tuleb kuulata ja toetada.";
  const result = buildSourceAttribution(reply, [
    guideline("communication", "Turvalise suhtluse käsiraamat", reply),
    guideline("evidence", "Digitaalsete tõendite käsiraamat", "Digitaalsed tõendid tuleb säilitada. Ohvrit tuleb kuulata ja toetada."),
    guideline("background", "Üldine vestlemise juhis", "Ohvrit tuleb kuulata ja toetada.")
  ], {
    query: "Mida ütlevad juhendid ohvri toetamisest?",
    queryPlan: { mode: "thematic_synthesis", needs_multiple_sources: true }
  });
  assert.deepEqual(new Set(result.displayed_source_ids), new Set(["communication", "evidence"]));
  assert.equal(result.filter_reasons.background, "claim_support_subsumed");
});
