import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildLegalExactSelection,
  buildRagContextBudgetOptions,
  buildRagSearchErrorPayload,
  buildServiceMapKovContactContext,
  buildServiceMapKovContactInstruction,
  excludeSupersededKovContactMatches,
  isMunicipalityServiceBenefitListRequest,
  mergePackageDisplayedSources,
  resolveKovContactMode,
  selectPersonSourceGroups,
  selectSingleSourceNumericFactGroups,
  selectGroupsWithPreferredSourceYear,
  shouldCarryMunicipalityFromHistory,
  shouldIncludeContextAuthors,
  shouldUseReportedPracticeInstruction
} from "../../lib/chat/retrievalContextAssembler.js";

test("municipality history is not carried into independent research and journal fact questions", () => {
  for (const message of [
    "MAPPA kohtumised – kui tihti ja mitu neid kolmes Virumaa linnas oli?",
    "Mis olid erihooldekodude kaardistuse kolm protsenti?",
    "Laste eraldamise otsused: arv ja aasta?",
    "Mitu intervjuud tehti töötamise toetamise uuringus, millised need olid ja kuidas andmeid analüüsiti?"
  ]) {
    assert.equal(shouldCarryMunicipalityFromHistory(message), false, message);
  }
});

test("municipality history is carried only for clear service follow-ups", () => {
  for (const message of [
    "Kas koduteenus on tasuta?",
    "Milliseid teenuseid ja toetusi seal pakutakse?",
    "Aga lastega peredele?"
  ]) {
    assert.equal(shouldCarryMunicipalityFromHistory(message), true, message);
  }
});

test("multi-source synthesis compacts context so every selected source gets evidence space", () => {
  const options = buildRagContextBudgetOptions({
    broadMultiSourceQuestion: true,
    contextGroupTarget: 8
  });

  assert.equal(options.compact, true);
  assert.equal(options.maxGroups, 8);
});

test("numeric fact selection never borrows percentages from a different source group", () => {
  const groups = [
    {
      key: "care-home-2017",
      docId: "care-home-2017",
      title: "Suurte erihooldekodude ümberkorraldamine",
      bodies: ["Artikli sissejuhatus kirjeldab erihooldekodude ümberkorraldamist."]
    },
    {
      key: "integration-statistics-2020",
      docId: "integration-statistics-2020",
      title: "Puudega inimeste sotsiaalne lõimumine",
      bodies: ["Institutsioonides elas 5,1%, neist 80% olid tegevuspiiranguga ja 70% raskete piirangutega."]
    }
  ];

  const result = selectSingleSourceNumericFactGroups(
    "Millised kolm osakaalu näitas erihooldekodude elanike kaardistus?",
    groups
  );

  assert.equal(result.enabled, true);
  assert.equal(result.sufficient, false);
  assert.equal(result.expectedCount, 3);
  assert.equal(result.evidenceCount, 0);
  assert.deepEqual(result.groups.map(group => group.key), ["care-home-2017"]);
});

test("numeric fact selection accepts all requested percentages from the primary source group", () => {
  const groups = [{
    key: "care-home-2017",
    docId: "care-home-2017",
    bodies: ["Ligi 25% saaks hakkama kergemal teenusel, 45% vajab juhendamist ja 30% pidevat hooldamist."]
  }, {
    key: "other",
    docId: "other",
    bodies: ["Teises aruandes oli 80%." ]
  }];

  const result = selectSingleSourceNumericFactGroups(
    "Millised kolm osakaalu näitas erihooldekodude elanike kaardistus?",
    groups
  );

  assert.equal(result.enabled, true);
  assert.equal(result.sufficient, true);
  assert.equal(result.evidenceCount, 3);
  assert.deepEqual(result.groups.map(group => group.key), ["care-home-2017"]);
});

test("a lower-scored group from the explicitly named source year is selected first", () => {
  const selected = selectGroupsWithPreferredSourceYear([
    { key: "old", year: 2017, bestScore: 0.98, bodies: ["Vana seire."] },
    { key: "wanted", year: 2025, bestScore: 0.71, bodies: ["Uus seire."] },
    { key: "other", year: 2022, bestScore: 0.8, bodies: ["Muu aruanne."] }
  ], [2025], 3, 0.7);

  assert.equal(selected[0].key, "wanted");
  assert.deepEqual(new Set(selected.map(item => item.key)).size, selected.length);
});

test("year preference falls back to ordinary ranking when that year is absent", () => {
  const selected = selectGroupsWithPreferredSourceYear([
    { key: "best", year: 2024, bestScore: 0.9, bodies: ["Parim."] },
    { key: "second", year: 2023, bestScore: 0.7, bodies: ["Teine."] }
  ], [2025], 2, 0.7);

  assert.equal(selected[0].key, "best");
});

test("topic questions hide intermediary authors while author questions preserve them", () => {
  const groups = [{ authors: ["Laur Raudsoo"] }];

  assert.equal(shouldIncludeContextAuthors(
    "Kuidas kasutab Eesti Töötukassa OTT-süsteemi?",
    groups
  ), false);
  assert.equal(shouldIncludeContextAuthors("Kes on Laur Raudsoo?", groups), true);
  assert.equal(shouldIncludeContextAuthors("Kes selle artikli kirjutas?", groups), true);
});

test("person-source selection prefers actual authorship over an article that merely mentions the person", () => {
  const selected = selectPersonSourceGroups("Millest on Krister Tüllinen kirjutanud?", [
    {
      key: "mentions-person",
      title: "Sotsiaaltöö ajakirja kujundanud inimesed",
      authors: ["Teine Autor"],
      bodies: ["Krister Tüllinen meenutab ajakirja arengut."],
      bestScore: 0.99
    },
    {
      key: "authored-one",
      title: "Esimene sisuline artikkel",
      authors: ["Krister Tüllinen"],
      bodies: ["Artikkel käsitleb sotsiaaltöö praktikat."],
      bestScore: 0.72
    },
    {
      key: "authored-two",
      title: "Teine sisuline artikkel",
      authors: ["Krister Tüllinen", "Kaasautor"],
      bodies: ["Artikkel käsitleb teenuste korraldust."],
      bestScore: 0.68
    }
  ], 3);

  assert.deepEqual(selected.slice(0, 2).map(group => group.key), ["authored-one", "authored-two"]);
  assert.equal(selected[2].key, "mentions-person");
});

test("bare municipality social-services heading is treated as a list request", () => {
  assert.equal(isMunicipalityServiceBenefitListRequest("Harku valla sotsiaalteenused?"), true);
  assert.equal(isMunicipalityServiceBenefitListRequest("Tartu linna toetused"), true);
  assert.equal(isMunicipalityServiceBenefitListRequest("Harku valla koduteenuse hind?"), false);
});

test("published service-map contacts supersede stale RAG contact copies for that municipality", () => {
  const matches = [
    { id: "old-contact", itemType: "contact", municipalityId: "harku_vald" },
    { id: "service", itemType: "service", municipalityId: "harku_vald" },
    { id: "other-contact", item_type: "contact", municipality_name: "Saue vald" }
  ];

  assert.deepEqual(
    excludeSupersededKovContactMatches(matches, [
      { id: "verified", municipalityId: "harku_vald", municipalityName: "Harku vald" }
    ]).map((entry) => entry.id),
    ["service", "other-contact"]
  );
  assert.deepEqual(excludeSupersededKovContactMatches(matches, []), matches);
});

function readSource(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("buildRagSearchErrorPayload marks optional RAG failures with planner context", () => {
  const payload = buildRagSearchErrorPayload({
    err: new Error("background search timeout"),
    userId: "user-1",
    role: "SOCIAL_WORKER",
    isCrisis: false,
    stage: "rag_search_background_scope",
    optional: true,
    topK: 8,
    conversationId: "conversation-1",
    selectionStrategy: "mmr_diversity",
    queryPlan: {
      mode: "municipality_service_benefit",
      query_order: "default",
      selection_strategy: "mmr_diversity",
      query_count: 2,
      rag_top_k: 36
    }
  });

  assert.equal(payload.stage, "rag_search_background_scope");
  assert.equal(payload.optional, true);
  assert.equal(payload.error_message, "background search timeout");
  assert.equal(payload.queryPlanMode, "municipality_service_benefit");
  assert.equal(payload.queryPlanSelectionStrategy, "mmr_diversity");
  assert.equal(payload.queryPlanQueryOrder, "default");
  assert.equal(payload.query_plan.query_count, 2);
  assert.equal(payload.query_plan.rag_top_k, 36);
  assert.equal(payload.top_k, 8);
  assert.equal(payload.conversation_id, "conversation-1");
});

test("buildRagSearchErrorPayload truncates long error text", () => {
  const payload = buildRagSearchErrorPayload({
    err: new Error("x".repeat(300)),
    stage: "rag_search"
  });

  assert.equal(payload.error_message.length, 240);
});

test("mergePackageDisplayedSources enriches existing package source with package URL", () => {
  const merged = mergePackageDisplayedSources([
    {
      source_id: "kuusalu-koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info"
    }
  ], [
    {
      source_id: "kuusalu-koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info",
      url_canonical: "https://www.kuusalu.ee/koduteenus"
    }
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].source_id, "kuusalu-koduteenus");
  assert.equal(merged[0].url, "https://www.kuusalu.ee/koduteenus");
  assert.equal(merged[0].url_canonical, "https://www.kuusalu.ee/koduteenus");
});

test("mergePackageDisplayedSources enriches title municipality alias with package URL", () => {
  const merged = mergePackageDisplayedSources([
    {
      source_id: "kuusalu_vald_service_koduteenus",
      title: "Koduteenus",
      source_type: "kov_service_info",
      municipality_id: "kuusalu_vald"
    }
  ], [
    {
      source_id: "koduteenus_page",
      title: "Koduteenus",
      source_type: "kov_service_page",
      resource_type: "service_page",
      municipality_id: "kuusalu_vald",
      url_canonical: "https://www.kuusalu.ee/koduteenus"
    }
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].source_id, "kuusalu_vald_service_koduteenus");
  assert.equal(merged[0].url, "https://www.kuusalu.ee/koduteenus");
  assert.equal(merged[0].url_canonical, "https://www.kuusalu.ee/koduteenus");
});

test("reported practice instruction is enabled for article-backed organization use questions", () => {
  assert.equal(shouldUseReportedPracticeInstruction(
    "kas tehisintellekti kasutatakse töötukassas?",
    [
      {
        sourceType: "journal_article",
        collectionId: "sotsiaaltoo_articles",
        title: "Tehisintellekt sotsiaaltöös"
      }
    ]
  ), true);
});

test("reported practice instruction is not enabled without a background practice source", () => {
  assert.equal(shouldUseReportedPracticeInstruction(
    "kas tehisintellekti kasutatakse töötukassas?",
    [
      {
        sourceType: "kov_service_info",
        collectionId: "kov_services",
        title: "Koduteenus"
      }
    ]
  ), false);
});

test("ordinary RAG answers are instructed to present found knowledge directly", () => {
  const systemPrompt = readSource("lib/chat/systemPrompts/et.js");
  const retrievalAssembler = readSource("lib/chat/retrievalContextAssembler.js");
  const evidencePackage = readSource("lib/chat/evidencePackage.js");

  assert.match(systemPrompt, /esita teadmine otse/);
  assert.match(systemPrompt, /Ära kurda kasutajale/);
  assert.doesNotMatch(retrievalAssembler, /Kui valitud allikabaas on kitsas, ütle seda loomulikult/);
  assert.match(retrievalAssembler, /ära lisa eraldi lõiku tänase kinnituse puudumise/);
  assert.match(retrievalAssembler, /Ära nimeta vastuses RAG-konteksti, otsingu seisu ega allikabaasi laiust/);
  assert.match(retrievalAssembler, /Ära raamista sünteesi väljenditega/);
  assert.match(retrievalAssembler, /Esimesed kaks sisulist lauset esita ilma sõnadeta/);
  assert.doesNotMatch(evidencePackage, /State naturally when the selected source base is narrow/);
});

test("municipality chat context can use service map KOV contacts", () => {
  const source = readSource("lib/chat/retrievalContextAssembler.js");

  assert.match(source, /SERVICE_MAP_KOV_CONTACTS/);
  assert.match(source, /prisma\.serviceMapEntry\.findMany/);
  assert.match(source, /KOV_SOCIAL_CONTACT/);
  assert.match(source, /KOV_GENERAL_CONTACT/);
  assert.match(source, /contextParts\.push\(serviceMapKovContactContext\)/);
  assert.match(source, /serviceMapKovContactCount/);
  assert.match(source, /preciseServiceContactUnsupported/);
  assert.match(source, /CONTACT_EVIDENCE_STATUS: insufficient_service_match/);
});

const HARKU_CONTACTS = [
  { id: "c1", municipalityName: "Harku vald", title: "Meeli Vaarpuu", description: "Roll: sotsiaalhoolekandespetsialist\nOsakond: Sotsiaal- ja tervishoiuosakond", phone: "5552 0232", email: "meeli.vaarpuu@harku.ee" },
  { id: "c2", municipalityName: "Harku vald", title: "Epp Sõna", description: "Roll: sotsiaalhoolekandespetsialist\nOsakond: Sotsiaal- ja tervishoiuosakond", phone: "5308 3290", email: "epp.sona@harku.ee" },
  { id: "c3", municipalityName: "Harku vald", title: "Heli Tuulik", description: "Roll: laste heaolu spetsialist\nOsakond: Sotsiaal- ja tervishoiuosakond", phone: "5323 0694", email: "heli.tuulik@harku.ee" },
  { id: "c4", municipalityName: "Harku vald", title: "Ivika Kelder", description: "Roll: laste heaolu spetsialist\nOsakond: Sotsiaal- ja tervishoiuosakond", phone: "5912 4800", email: "ivika.kelder@harku.ee" },
  { id: "c5", municipalityName: "Harku vald", title: "Kadi Netse", description: "Roll: toetuste spetsialist\nOsakond: Sotsiaal- ja tervishoiuosakond", phone: "5884 7260", email: "kadi.netse@harku.ee" },
  { id: "c6", municipalityName: "Harku vald", title: "Katri Heinjärv", description: "Osakond: Sotsiaal- ja tervishoiuosakond", email: "katri.heinjarv@harku.ee" }
];

test("KOV contact context exposes the role palette, not just a flat name list", () => {
  const context = buildServiceMapKovContactContext(HARKU_CONTACTS);
  const roleIndexLine = context
    .split("\n")
    .find((line) => line.startsWith("- Harku vald:"));

  assert.match(context, /^SERVICE_MAP_KOV_CONTACTS:/);
  assert.match(context, /KOV_CONTACT_ROLES/);
  assert.match(roleIndexLine, /laste heaolu spetsialist \(2\)/);
  assert.match(roleIndexLine, /sotsiaalhoolekandespetsialist \(2\)/);
  assert.match(roleIndexLine, /toetuste spetsialist \(1\)/);
  // Role missing from the description falls back to the department, never dropped.
  assert.match(roleIndexLine, /Sotsiaal- ja tervishoiuosakond \(1\)/);
  assert.equal(context.match(/^- Harku vald \| roll: /gmu).length, HARKU_CONTACTS.length);
  assert.match(context, /roll: toetuste spetsialist \| Kadi Netse \| .*tel: 5884 7260/);
});

test("KOV contact context stays empty without entries", () => {
  assert.equal(buildServiceMapKovContactContext([]), "");
  assert.equal(buildServiceMapKovContactContext(), "");
});

test("resolveKovContactMode asks for the topic when the turn names none", () => {
  assert.equal(resolveKovContactMode({ message: "millega sa mind aidata saad?" }), "overview");
  assert.equal(resolveKovContactMode({ message: "tere" }), "overview");
  assert.equal(
    resolveKovContactMode({ message: "millised sotsiaalteenused Harku vallas on?", listRequest: true }),
    "overview"
  );
});

test("resolveKovContactMode routes explicit contact requests to the role listing", () => {
  assert.equal(resolveKovContactMode({ message: "kelle poole ma pean pöörduma?" }), "contacts");
  assert.equal(resolveKovContactMode({ message: "kes tegeleb lastega?" }), "contacts");
  assert.equal(resolveKovContactMode({ message: "anna spetsialisti telefon" }), "contacts");
  // An explicit contact request wins even when a service package matched.
  assert.equal(
    resolveKovContactMode({ message: "kelle poole koduteenuse asjus pöörduda?", serviceSpecific: true }),
    "contacts"
  );
});

test("resolveKovContactMode keeps concrete service and benefit turns service-scoped", () => {
  assert.equal(resolveKovContactMode({ message: "kui palju koduteenus maksab?" }), "service");
  assert.equal(resolveKovContactMode({ message: "kuidas taotleda hooldajatoetust?" }), "service");
  assert.equal(resolveKovContactMode({ message: "mu lapsel on abi vaja" }), "service");
  assert.equal(resolveKovContactMode({ message: "kuidas edasi?", serviceSpecific: true }), "service");
});

test("KOV contact instruction carries the mode-specific rule in both languages", () => {
  const overviewEt = buildServiceMapKovContactInstruction("et", { mode: "overview" });
  assert.match(overviewEt, /Ara nimeta uht-kaht inimest, telefoninumbrit ega e-posti vaikimisi kontaktina/);
  assert.match(overviewEt, /Lopeta kusimusega, mis teemaga inimest aidata saab/);
  assert.match(overviewEt, /KOV_CONTACT_ROLES/);

  const contactsEt = buildServiceMapKovContactInstruction("et", { mode: "contacts" });
  assert.match(contactsEt, /nimeta koik selle teema rolliga kontaktid/);

  const serviceEn = buildServiceMapKovContactInstruction("en", { mode: "service" });
  assert.match(serviceEn, /Do not fall back to the general social welfare specialist/);

  // Unknown or missing mode must not drop the block-level rules.
  const fallback = buildServiceMapKovContactInstruction("et", {});
  assert.match(fallback, /SERVICE_MAP_CONTACT_MODE:/);
  assert.match(fallback, /toetuste spetsialist/);
});

test("buildLegalExactSelection keeps only requested legal paragraph groups", () => {
  const result = buildLegalExactSelection([
    {
      key: "law-140",
      sourceType: "national_law",
      sourceStatus: "active",
      historical: false,
      actTitle: "Sotsiaalhoolekande seadus",
      paragraphNumber: "140",
      paragraphTitle: "Toimetulekutoetuse maksmine"
    },
    {
      key: "law-160",
      sourceType: "national_law",
      sourceStatus: "active",
      historical: false,
      actTitle: "Sotsiaalhoolekande seadus",
      paragraphNumber: "160",
      paragraphTitle: "Paragrahvi 140 rakendamine"
    },
    {
      key: "law-70",
      sourceType: "national_law",
      sourceStatus: "active",
      historical: false,
      actTitle: "Sotsiaalhoolekande seadus",
      paragraphNumber: "70"
    },
    {
      key: "journal-140",
      sourceType: "journal_article",
      actTitle: "Sotsiaalhoolekande seadus",
      paragraphNumber: "140"
    }
  ], {
    enabled: true,
    mode: "explicit_paragraph",
    sourceTypes: ["national_law"],
    actTitle: "Sotsiaalhoolekande seadus",
    paragraphRefs: ["140"],
    requireCurrent: true
  });

  assert.equal(result.insufficientPreciseLegalSourceSupport, false);
  assert.deepEqual(result.missingParagraphRefs, []);
  assert.deepEqual(result.selectionGroups.map(item => item.paragraphNumber), ["140"]);
  assert.deepEqual(result.groupedMatches.map(item => item.paragraphNumber), ["140"]);
});

test("buildLegalExactSelection reports insufficient support when exact paragraph is missing", () => {
  const result = buildLegalExactSelection([
    {
      key: "law-160",
      sourceType: "national_law",
      sourceStatus: "active",
      historical: false,
      actTitle: "Sotsiaalhoolekande seadus",
      paragraphNumber: "160",
      paragraphTitle: "Paragrahvi 140 rakendamine"
    }
  ], {
    enabled: true,
    mode: "explicit_paragraph",
    sourceTypes: ["national_law"],
    actTitle: "Sotsiaalhoolekande seadus",
    paragraphRefs: ["999"],
    requireCurrent: true
  });

  assert.equal(result.insufficientPreciseLegalSourceSupport, true);
  assert.deepEqual(result.missingParagraphRefs, ["999"]);
  assert.deepEqual(result.selectionGroups, []);
});

test("national service benefit detection covers fee questions about concrete services", async () => {
  const { isNationalServiceBenefitQuestion } = await import("../../lib/chat/retrievalContextAssembler.js");

  assert.equal(isNationalServiceBenefitQuestion("Kas tugiisikuteenusel on omaosalus?"), true);
  assert.equal(isNationalServiceBenefitQuestion("Kui suur on koduteenuse omaosalus?"), true);
  assert.equal(isNationalServiceBenefitQuestion("Kas koduteenus on tasuline?"), true);
  assert.equal(isNationalServiceBenefitQuestion("Mis teenuseid riik pakub?"), true);

  assert.equal(isNationalServiceBenefitQuestion("Kas Kuusalu vallas on koduteenus tasuline?"), false);
  assert.equal(isNationalServiceBenefitQuestion("Mis on murekohad lastekaitses?"), false);
  assert.equal(isNationalServiceBenefitQuestion("Tere"), false);
});
