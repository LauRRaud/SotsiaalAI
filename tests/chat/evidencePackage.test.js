import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEvidencePackage,
  buildEvidencePackageInstruction,
  shouldBuildEvidencePackage
} from "../../lib/chat/evidencePackage.js";

test("EvidencePackage skeleton summarizes overview selected context without changing selection", () => {
  const pkg = buildEvidencePackage({
    queryPlan: {
      mode: "overview_synthesis",
      selection_strategy: "overview_diversity_then_depth",
      planner_reason: "broad topic question"
    },
    selectedEntries: [
      { docId: "doc-a", sourceId: "a1", title: "Lastekaitse artikkel", sourceType: "journal_article", collectionId: "sotsiaaltoo_articles" },
      { docId: "doc-b", sourceId: "b1", title: "Lastekaitse juhend", sourceType: "official_guideline", collectionId: "national_guidelines" },
      { docId: "doc-c", sourceId: "c1", title: "Lastekaitse uuring", sourceType: "research", collectionId: "research" }
    ],
    selectedSources: [
      { source_id: "a1", title: "Lastekaitse artikkel", source_type: "journal_article", collection_id: "sotsiaaltoo_articles", evidenceText: "Do not include" },
      { source_id: "b1", title: "Lastekaitse juhend", source_type: "official_guideline", collection_id: "national_guidelines", evidenceText: "Do not include" },
      { source_id: "c1", title: "Lastekaitse uuring", source_type: "research", collection_id: "research", evidenceText: "Do not include" }
    ],
    ragRiskPolicy: {
      riskLevel: "low",
      requiredEvidence: "medium"
    },
    overviewSynthesis: {
      distinct_selected_document_count: 3,
      source_diversity_limited: false
    }
  });

  assert.equal(pkg.version, "v2.4a");
  assert.equal(pkg.mode, "overview_synthesis");
  assert.equal(pkg.selected_sources.length, 3);
  assert.equal(pkg.selected_documents.length, 3);
  assert.equal(pkg.source_layer_mix.by_layer.research_or_journal, 2);
  assert.equal(pkg.source_layer_mix.by_layer.material, 1);
  assert.equal(pkg.evidence_strength.overall, "multi_source");
  assert.deepEqual(pkg.coverage_warnings, []);
  assert.equal(JSON.stringify(pkg).includes("Do not include"), false);
});

test("EvidencePackage adds temporal framing guidance for multi-year overview sources", () => {
  const pkg = buildEvidencePackage({
    queryPlan: {
      mode: "overview_synthesis",
      selection_strategy: "overview_diversity_then_depth"
    },
    selectedEntries: [
      { docId: "doc-2017", sourceId: "a1", title: "Earlier article", sourceType: "journal_article", collectionId: "sotsiaaltoo_articles", year: 2017 },
      { docId: "doc-2021", sourceId: "b1", title: "Middle report", sourceType: "research_report", collectionId: "research_reports", publication_date: "2021-04-03" },
      { docId: "doc-2025", sourceId: "c1", title: "Recent article", sourceType: "journal_article", collectionId: "sotsiaaltoo_articles", issueLabel: "2/2025" }
    ],
    selectedSources: [
      { source_id: "a1", title: "Earlier article", source_type: "journal_article", collection_id: "sotsiaaltoo_articles", year: 2017 },
      { source_id: "b1", title: "Middle report", source_type: "research_report", collection_id: "research_reports", publication_date: "2021-04-03" },
      { source_id: "c1", title: "Recent article", source_type: "journal_article", collection_id: "sotsiaaltoo_articles", issueLabel: "2/2025" }
    ]
  });

  assert.deepEqual(pkg.temporal_coverage.years, [2017, 2021, 2025]);
  assert.equal(pkg.temporal_coverage.year_range, "2017-2025");
  assert.equal(pkg.temporal_coverage.has_multi_year_range, true);
  assert.equal(pkg.selected_sources[0].source_year, 2017);
  assert.equal(pkg.selected_documents[1].source_year, 2021);
  assert.equal(pkg.answer_guidance.some(item => item.includes("earlier and newer selected materials")), true);
  assert.equal(pkg.answer_guidance.some(item => item.includes("Do not infer a trend")), true);
  assert.equal(pkg.trace_summary.year_range, "2017-2025");
  assert.equal(pkg.trace_summary.distinct_year_count, 3);

  const instruction = buildEvidencePackageInstruction(pkg);
  assert.equal(instruction.includes("Temporal coverage: selected source years 2017-2025"), true);
  assert.equal(instruction.includes("do not present publication years as proof of a trend"), true);
});

test("EvidencePackage does not add temporal framing guidance for a single source year", () => {
  const pkg = buildEvidencePackage({
    queryPlan: {
      mode: "resource_discovery",
      selection_strategy: "resource_discovery_diversity"
    },
    selectedEntries: [
      { docId: "doc-2025-a", sourceId: "a1", title: "Guide A", sourceType: "official_guideline", collectionId: "national_guidelines", year: 2025 },
      { docId: "doc-2025-b", sourceId: "b1", title: "Guide B", sourceType: "information_material", collectionId: "materials", publicationYear: 2025 }
    ],
    selectedSources: [
      { source_id: "a1", title: "Guide A", source_type: "official_guideline", collection_id: "national_guidelines", year: 2025 },
      { source_id: "b1", title: "Guide B", source_type: "information_material", collection_id: "materials", publicationYear: 2025 }
    ]
  });

  assert.deepEqual(pkg.temporal_coverage.years, [2025]);
  assert.equal(pkg.temporal_coverage.has_multi_year_range, false);
  assert.equal(pkg.answer_guidance.some(item => item.includes("earlier and newer selected materials")), false);
  assert.equal(buildEvidencePackageInstruction(pkg).includes("Temporal coverage:"), false);
});

test("EvidencePackage marks life situation guidance without official or KOV support", () => {
  const pkg = buildEvidencePackage({
    queryPlan: {
      mode: "life_situation_guidance",
      selection_strategy: "multi_source_diversity"
    },
    selectedEntries: [
      { docId: "article-a", sourceId: "a1", title: "Taustaartikkel", sourceType: "journal_article", collectionId: "sotsiaaltoo_articles" }
    ],
    selectedSources: [
      { source_id: "a1", title: "Taustaartikkel", source_type: "journal_article", collection_id: "sotsiaaltoo_articles" }
    ],
    ragRiskPolicy: {
      riskLevel: "medium",
      requiredEvidence: "strong",
      insufficientEvidenceMode: true
    }
  });

  assert.equal(pkg.mode, "life_situation_guidance");
  assert.equal(pkg.evidence_strength.overall, "limited");
  assert.equal(pkg.coverage_warnings.includes("life_situation_no_official_or_kov_source"), true);
  assert.equal(pkg.missing_coverage.includes("official_or_kov_help_source"), true);
  assert.equal(pkg.answer_guidance.some(item => item.includes("practical next steps")), true);
});

test("EvidencePackage records resource discovery legal-only limitation", () => {
  const pkg = buildEvidencePackage({
    queryPlan: {
      mode: "resource_discovery",
      selection_strategy: "resource_discovery_diversity"
    },
    selectedEntries: [
      { docId: "shs-42", sourceId: "law-42", title: "SHS 42", sourceType: "national_law", collectionId: "national_regulations" }
    ],
    selectedSources: [
      { source_id: "law-42", title: "SHS 42", source_type: "national_law", collection_id: "national_regulations", paragraphNumber: "42" }
    ]
  });

  assert.equal(pkg.mode, "resource_discovery");
  assert.equal(pkg.source_layer_mix.by_layer.legal, 1);
  assert.equal(pkg.coverage_warnings.includes("resource_discovery_legal_only_support"), true);
  assert.equal(pkg.missing_coverage.includes("organization_material_or_background_source"), true);
});

test("EvidencePackage source layer mix uses central metadata helper aliases", () => {
  const pkg = buildEvidencePackage({
    queryPlan: {
      mode: "resource_discovery",
      selection_strategy: "resource_discovery_diversity"
    },
    selectedEntries: [
      { docId: "kov-service", sourceId: "kov-1", title: "Koduteenus", sourceType: "municipality_kov", collectionId: "kov_services" },
      { docId: "org", sourceId: "org-1", title: "Astangu", sourceType: "organization_profile", collectionId: "organizations" },
      { docId: "article", sourceId: "article-1", title: "Artikkel", sourceType: "article", collectionId: "journal_articles" }
    ],
    selectedSources: [
      { source_id: "kov-1", title: "Koduteenus", source_type: "municipality_kov", collection_id: "kov_services" },
      { source_id: "org-1", title: "Astangu", source_type: "organization_profile", collection_id: "organizations" },
      { source_id: "article-1", title: "Artikkel", source_type: "article", collection_id: "journal_articles" }
    ]
  });

  assert.equal(pkg.source_layer_mix.by_layer.kov, 1);
  assert.equal(pkg.source_layer_mix.by_layer.organization, 1);
  assert.equal(pkg.source_layer_mix.by_layer.research_or_journal, 1);
  assert.equal(pkg.coverage_warnings.includes("resource_discovery_legal_only_support"), false);
});

test("EvidencePackage preserves coarse layers while recording central source metadata contract aliases", () => {
  const pkg = buildEvidencePackage({
    queryPlan: {
      mode: "resource_discovery",
      selection_strategy: "resource_discovery_diversity"
    },
    selectedSources: [
      {
        source_id: "org-profile",
        title: "Astangu Kutserehabilitatsiooni Keskus",
        source_type: "organization_profile",
        collection_id: "organizations",
        organization_id: "astangu"
      },
      {
        source_id: "training",
        title: "Koolitusmaterjal",
        source_type: "training_material",
        collection_id: "training_materials"
      },
      {
        source_id: "article",
        title: "Sotsiaaltöö artikkel",
        source_type: "journal_article",
        collection_id: "sotsiaaltoo_articles"
      },
      {
        source_id: "research",
        title: "Uuring",
        source_type: "research_report",
        collection_id: "research_reports"
      },
      {
        source_id: "rt",
        title: "Riigi Teataja määrus",
        source_type: "riigiteataja_regulation",
        collection_id: "national_regulations"
      },
      {
        source_id: "shs",
        title: "Sotsiaalhoolekande seadus",
        source_type: "national_law",
        collection_id: "national_rt"
      },
      {
        source_id: "kov-runtime",
        title: "KOV teenuseleht",
        source_type: "municipality_kov",
        collection_id: "kov_services",
        municipality_id: "kuusalu_vald"
      },
      {
        source_id: "kov-page",
        title: "KOV koduteenuse leht",
        source_type: "kov_service_page",
        collection_id: "kov_services",
        municipality_id: "kuusalu_vald"
      }
    ]
  });

  const byId = Object.fromEntries(pkg.selected_sources.map((source) => [source.id, source]));

  assert.equal(byId["org-profile"].source_layer, "organization");
  assert.equal(byId["org-profile"].source_layer_contract, "organization");
  assert.equal(byId["org-profile"].evidence_role, "organization_background");
  assert.equal(byId["org-profile"].claim_support.includes("organization_background"), true);

  assert.equal(byId.training.source_layer, "material");
  assert.equal(byId.training.source_layer_contract, "material");
  assert.equal(byId.training.claim_support.includes("practice_guidance"), true);

  assert.equal(byId.article.source_layer, "research_or_journal");
  assert.equal(byId.research.source_layer, "research_or_journal");
  assert.equal(byId.article.evidence_role, "research_evidence");
  assert.equal(byId.research.evidence_role, "research_evidence");

  assert.equal(byId.rt.source_layer, "legal");
  assert.equal(byId.rt.source_layer_contract, "national_law");
  assert.equal(byId.shs.source_layer, "legal");
  assert.equal(byId.shs.source_layer_contract, "national_law");
  assert.equal(byId.rt.claim_support.includes("legal_basis"), true);

  assert.equal(byId["kov-runtime"].source_layer, "kov");
  assert.equal(byId["kov-runtime"].source_layer_contract, "kov_web");
  assert.equal(byId["kov-page"].source_layer, "kov");
  assert.equal(byId["kov-page"].source_layer_contract, "kov_web");
  assert.equal(byId["kov-page"].claim_support.includes("municipal_service_availability"), true);

  assert.equal(pkg.source_layer_mix.by_layer.organization, 1);
  assert.equal(pkg.source_layer_mix.by_layer.material, 1);
  assert.equal(pkg.source_layer_mix.by_layer.research_or_journal, 2);
  assert.equal(pkg.source_layer_mix.by_layer.legal, 2);
  assert.equal(pkg.source_layer_mix.by_layer.kov, 2);
});

test("EvidencePackage applies only to selected V2 modes and skips legal exact, SourcePackage, and user document paths", () => {
  assert.equal(shouldBuildEvidencePackage({ queryPlan: { mode: "comparison" } }), true);
  assert.equal(shouldBuildEvidencePackage({ queryPlan: { mode: "resource_discovery" } }), true);
  assert.equal(shouldBuildEvidencePackage({
    queryPlan: { mode: "explicit_paragraph", selection_strategy: "legal_exact" },
    legalLookupPlan: { enabled: true, mode: "explicit_paragraph" }
  }), false);
  assert.equal(shouldBuildEvidencePackage({
    queryPlan: { mode: "life_situation_guidance" },
    packageAwareAnsweringUsed: true
  }), false);
  assert.equal(shouldBuildEvidencePackage({
    queryPlan: { mode: "overview_synthesis" },
    usedDocContext: true
  }), false);
  assert.equal(shouldBuildEvidencePackage({ queryPlan: { mode: "default" } }), false);
});

test("EvidencePackage instruction is guidance-only and does not request new retrieval", () => {
  const instruction = buildEvidencePackageInstruction({
    mode: "comparison",
    answer_guidance: ["Compare only the requested topics."],
    coverage_warnings: ["comparison_topic_coverage_uncertain"]
  });

  assert.equal(instruction.includes("EVIDENCE_PACKAGE_MODE"), true);
  assert.equal(instruction.includes("Do not treat it as an instruction to retrieve new sources"), true);
  assert.equal(instruction.includes("comparison_topic_coverage_uncertain"), true);
});
