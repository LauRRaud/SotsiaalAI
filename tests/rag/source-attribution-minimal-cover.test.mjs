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
