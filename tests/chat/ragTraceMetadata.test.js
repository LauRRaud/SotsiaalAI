import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAttributionMetadata,
  buildRagTraceFromAttribution,
  RAG_CONTRACT_VERSION
} from "../../lib/chat/mainResponseHandler.js";
import { buildSourceAttribution } from "../../lib/chat/sourceAttribution.js";

const sources = [
  {
    source_id: "tartu-koduteenus",
    title: "Tartu linn koduteenus",
    source_type: "kov_service_info",
    evidenceText: "Koduteenust saab taotleda Tartu linnas sotsiaal- ja tervishoiuosakonna kaudu."
  },
  {
    source_id: "general-article",
    title: "Koduteenuse metoodiline ülevaade",
    source_type: "journal_article",
    evidenceText: "Artikkel kirjeldab koduteenuse üldist tähendust."
  }
];

test("RAG trace preserves retrieved, selected, answer and displayed source layers", () => {
  const attribution = buildSourceAttribution("Tartu linn koduteenus on taotletav sotsiaal- ja tervishoiuosakonna kaudu.", sources, {
    query: "Tartu linn koduteenus"
  });
  const trace = buildRagTraceFromAttribution(sources, attribution, {
    rawMatchesCount: 7,
    selectedContextCount: 2,
    retrieversUsed: ["dense"],
    retrievedSourceIds: ["retrieved-a", "retrieved-b", "retrieved-c"],
    selectedContextSourceIds: ["tartu-koduteenus", "general-article"],
    selectedContextDetails: [
      {
        source_id: "tartu-koduteenus",
        source_type: "kov_service_info",
        municipality_id: "tartu_linn",
        municipality_name: "Tartu linn",
        source_status: "active",
        retrieval_channels: ["dense", "title_match"],
        hybrid_score: 0.82,
        dense_score: 0.41,
        lexical_score: 6.2,
        lexical_score_normalized: 0.43662,
        bm25_score: 2.4,
        bm25_coverage: 0.75,
        bm25_matches: 3,
        bm25_query_tokens: 4,
        rrf_score: 0.04,
        channel_boost: 0.09,
        hybrid_rank: 1,
        dense_rank: 3,
        lexical_rank: 1,
        rank_score: 1.24,
        topic_boost: 0.18,
        quality_adjust: 0.42,
        evidence_text: "Sensitive context text must not be copied to trace.",
        model_context: "Full model context must not be copied to trace."
      }
    ],
    userMessage: "Client private story must not be copied to trace.",
    modelContext: "Full RAG context must not be copied to trace.",
    prompt: "Full prompt must not be copied to trace.",
    ragRiskPolicy: {
      riskLevel: "medium",
      requiredEvidence: "strong",
      insufficientEvidenceMode: true
    },
    queryPlan: {
      planner_version: "v2",
      mode: "broad_multi_source",
      query_order: "broad_first",
      selection_strategy: "multi_source_diversity",
      query_count: 2,
      filter_keys: ["audience", "doc_id"]
    },
    hybridRetrieval: {
      merge_strategy: {
        strategy: "weighted_hybrid_rrf",
        rrf_k: 60,
        requested_retrievers: ["dense", "title_match", "exact_phrase", "bm25"]
      },
      channel_counts: {
        dense: 2,
        title_match: 1,
        bm25: 1
      },
      bm25: {
        result_count: 1,
        average_coverage: 0.75
      },
      scored_count: 2,
      top_hybrid_score: 0.82,
      top_rrf_score: 0.04
    }
  });

  assert.equal(trace.retrieved_count, 7);
  assert.equal(trace.selected_context_count, 2);
  assert.deepEqual(trace.retrievers_used, ["dense"]);
  assert.deepEqual(trace.retrieved_source_ids, ["retrieved-a", "retrieved-b", "retrieved-c"]);
  assert.deepEqual(trace.selected_context_source_ids, ["tartu-koduteenus", "general-article"]);
  assert.deepEqual(trace.selected_context_details, [
    {
      source_id: "tartu-koduteenus",
      source_type: "kov_service_info",
      municipality_id: "tartu_linn",
      municipality_name: "Tartu linn",
      source_status: "active",
      retrieval_channels: ["dense", "title_match"],
      hybrid_score: 0.82,
      dense_score: 0.41,
      lexical_score: 6.2,
      lexical_score_normalized: 0.43662,
      bm25_score: 2.4,
      bm25_coverage: 0.75,
      bm25_matches: 3,
      bm25_query_tokens: 4,
      rrf_score: 0.04,
      channel_boost: 0.09,
      hybrid_rank: 1,
      dense_rank: 3,
      lexical_rank: 1,
      rank_score: 1.24,
      topic_boost: 0.18,
      quality_adjust: 0.42
    }
  ]);
  assert.deepEqual(trace.answer_source_ids, ["tartu-koduteenus"]);
  assert.deepEqual(trace.displayed_source_ids, ["tartu-koduteenus"]);
  assert.deepEqual(trace.filtered_out_source_ids, ["general-article"]);
  assert.equal(trace.filter_reasons["general-article"], "query_anchor_mismatch");
  assert.equal(trace.selected_source_count, 2);
  assert.equal(trace.answer_source_count, 1);
  assert.equal(trace.displayed_source_count, 1);
  assert.equal(trace.filtered_out_source_count, 1);
  assert.equal(trace.displayed_sources_subset_of_selected, true);
  assert.equal(trace.displayed_sources_subset_of_answer, true);
  assert.deepEqual(trace.selected_but_not_displayed_source_ids, ["general-article"]);
  assert.deepEqual(trace.attribution_filtered_source_ids, ["general-article"]);
  assert.equal(trace.attribution_filter_reasons["general-article"], "query_anchor_mismatch");
  assert.equal(trace.rag_risk_level, "medium");
  assert.equal(trace.rag_required_evidence, "strong");
  assert.equal(trace.rag_insufficient_evidence_mode, true);
  assert.equal(JSON.stringify(trace).includes("Sensitive context text"), false);
  assert.equal(JSON.stringify(trace).includes("Client private story"), false);
  assert.equal(JSON.stringify(trace).includes("Full RAG context"), false);
  assert.equal(JSON.stringify(trace).includes("Full prompt"), false);
  assert.deepEqual(trace.query_plan, {
    planner_version: "v2",
    mode: "broad_multi_source",
    query_order: "broad_first",
    selection_strategy: "multi_source_diversity",
    query_count: 2,
    filter_keys: ["audience", "doc_id"]
  });
  assert.equal(trace.hybrid_retrieval.merge_strategy.strategy, "weighted_hybrid_rrf");
  assert.equal(trace.hybrid_retrieval.channel_counts.title_match, 1);
  assert.equal(trace.hybrid_retrieval.bm25.average_coverage, 0.75);
  assert.equal(trace.hybrid_retrieval.top_hybrid_score, 0.82);
  assert.equal(trace.retrieval_trace_level, "retrieved_candidates");
});

test("attribution metadata stores displayed sources and keeps legacy metadata", () => {
  const attribution = buildSourceAttribution("Tartu linn koduteenus on taotletav sotsiaal- ja tervishoiuosakonna kaudu.", sources, {
    query: "Tartu linn koduteenus"
  });
  const metadata = buildAttributionMetadata({ workflow: "chat" }, sources, attribution, {
    rawMatchesCount: 3,
    selectedContextCount: 2,
    retrieversUsed: ["dense"],
    ragRiskPolicy: {
      riskLevel: "medium",
      requiredEvidence: "strong",
      insufficientEvidenceMode: true
    }
  });

  assert.equal(metadata.workflow, "chat");
  assert.equal(metadata.rag_contract_version, RAG_CONTRACT_VERSION);
  assert.equal(metadata.source_display_mode, "displayed_sources_enforced");
  assert.deepEqual(metadata.displayed_source_ids, ["tartu-koduteenus"]);
  assert.equal(metadata.displayed_sources.length, 1);
  assert.equal(metadata.displayed_sources[0].source_id, "tartu-koduteenus");
  assert.equal(Array.isArray(metadata.attribution_decisions), true);
  assert.equal(metadata.rag_trace.retrieved_count, 3);
  assert.equal(metadata.rag_trace.selected_context_count, 2);
  assert.deepEqual(metadata.rag_trace.retrievers_used, ["dense"]);
  assert.equal(metadata.rag_trace.rag_risk_level, "medium");
});

test("RAG trace includes overview synthesis selection metadata without source excerpts", () => {
  const overviewSources = [
    {
      source_id: "article-a",
      title: "Lastekaitse artikkel",
      source_type: "journal_article",
      collection_id: "sotsiaaltoo_articles",
      evidenceText: "Lastekaitse dokumenteerimise koormus."
    },
    {
      source_id: "guide-b",
      title: "Lastekaitse juhend",
      source_type: "methodology_guide",
      evidenceText: "JuhtumitĆ¶Ć¶ ja hindamise tugi."
    }
  ];
  const attribution = buildSourceAttribution("Lastekaitses korduvad dokumenteerimise ja juhtumitĆ¶Ć¶ toe teemad.", overviewSources, {
    query: "millised on probleemid lastekaitses?",
    queryPlan: {
      mode: "overview_synthesis",
      selection_strategy: "overview_diversity_then_depth"
    }
  });
  const trace = buildRagTraceFromAttribution(overviewSources, attribution, {
    rawMatchesCount: 8,
    selectedContextCount: 2,
    selectedContextSourceIds: ["article-a", "guide-b"],
    queryPlan: {
      planner_version: "v2",
      mode: "overview_synthesis",
      selection_strategy: "overview_diversity_then_depth"
    },
    overviewSynthesis: {
      overview_synthesis_used: true,
      selection_strategy: "overview_diversity_then_depth",
      distinct_candidate_document_count: 5,
      distinct_relevant_candidate_document_count: 4,
      distinct_selected_document_count: 2,
      selected_document_ids: ["doc-a", "doc-b"],
      document_identity_fields_used: { doc_id: 4, title: 1 },
      chunks_per_document: { "doc-a": 1, "doc-b": 1 },
      initial_diversity_pass_document_count: 2,
      depth_pass_added_chunks: 0,
      dominant_document_id: "doc-a",
      dominant_document_share: 0.5,
      dominant_document_allowed: true,
      dominant_document_reason: "within_limit",
      source_diversity_limited: false,
      source_diversity_reason: null,
      evidenceText: "Do not leak"
    }
  });

  assert.equal(trace.overview_synthesis.mode, "overview_synthesis");
  assert.equal(trace.overview_synthesis.selection_strategy, "overview_diversity_then_depth");
  assert.deepEqual(trace.overview_synthesis.selected_document_ids, ["doc-a", "doc-b"]);
  assert.equal(trace.displayed_sources_subset_of_selected, true);
  assert.equal(trace.displayed_source_count, 2);
  assert.equal(JSON.stringify(trace).includes("Do not leak"), false);
});

test("RAG trace includes sanitized EvidencePackage metadata without source excerpts", () => {
  const attribution = buildSourceAttribution("KOV ja SHS allikad toetavad praktilist sammude vastust.", [
    {
      source_id: "shs-8",
      title: "Sotsiaalhoolekande seadus § 8 Vältimatu sotsiaalabi",
      source_type: "national_law",
      paragraphNumber: "8",
      evidenceText: "Sensitive source excerpt must not be copied."
    },
    {
      source_id: "kov-help",
      title: "KOV sotsiaalabi",
      source_type: "kov_service_info",
      collection_id: "kov_web",
      evidenceText: "Sensitive KOV excerpt must not be copied."
    }
  ], {
    query: "Mul pole raha üüri ja toidu jaoks, mida teha?"
  });
  const trace = buildRagTraceFromAttribution([], attribution, {
    queryPlan: {
      planner_version: "v2",
      mode: "life_situation_guidance",
      selection_strategy: "multi_source_diversity"
    },
    evidencePackage: {
      version: "v2.4a",
      mode: "life_situation_guidance",
      selected_sources: [
        {
          id: "shs-8",
          title: "Sotsiaalhoolekande seadus § 8 Vältimatu sotsiaalabi",
          source_type: "national_law",
          source_layer: "legal",
          source_year: 2025,
          paragraph_number: "8",
          evidenceText: "Sensitive source excerpt must not be copied."
        },
        {
          id: "kov-help",
          title: "KOV sotsiaalabi",
          source_type: "kov_service_info",
          collection_id: "kov_web",
          source_layer: "kov",
          source_year: 2024,
          body_preview: "Sensitive body preview must not be copied."
        }
      ],
      selected_documents: [
        {
          document_id: "shs-8",
          title: "Sotsiaalhoolekande seadus § 8",
          source_type: "national_law",
          source_year: 2025,
          chunk_count: 1,
          source_ids: ["shs-8"]
        }
      ],
      source_layer_mix: {
        by_layer: { legal: 1, kov: 1 },
        by_source_type: { national_law: 1, kov_service_info: 1 },
        by_collection_id: { national_regulations: 1, kov_web: 1 }
      },
      evidence_strength: {
        overall: "limited",
        selected_source_count: 2,
        selected_document_count: 1,
        risk_level: "medium",
        required_evidence: "strong",
        insufficient_evidence_mode: false
      },
      coverage_warnings: [],
      missing_coverage: [],
      limitations: [],
      answer_guidance: ["Give practical next steps first."],
      temporal_coverage: {
        years: [2024, 2025],
        min_year: 2024,
        max_year: 2025,
        year_range: "2024-2025",
        span_years: 1,
        source_count_with_year: 2,
        document_count_with_year: 1,
        by_year: { 2024: 1, 2025: 2 },
        has_multi_year_range: true
      },
      trace_summary: {
        mode: "life_situation_guidance",
        selected_source_count: 2,
        selected_document_count: 1,
        source_layer_count: 2,
        year_range: "2024-2025",
        distinct_year_count: 2,
        temporal_span_years: 1,
        warning_count: 0,
        planner_reason: "financial hardship question",
        topics: ["rent", "food"]
      }
    }
  });

  assert.equal(trace.evidence_package.version, "v2.4a");
  assert.equal(trace.evidence_package.mode, "life_situation_guidance");
  assert.equal(trace.evidence_package.selected_sources.length, 2);
  assert.equal(trace.evidence_package.selected_sources[0].source_year, 2025);
  assert.equal(trace.evidence_package.selected_documents[0].source_year, 2025);
  assert.equal(trace.evidence_package.source_layer_mix.by_layer.legal, 1);
  assert.equal(trace.evidence_package.source_layer_mix.by_layer.kov, 1);
  assert.deepEqual(trace.evidence_package.temporal_coverage.years, [2024, 2025]);
  assert.equal(trace.evidence_package.temporal_coverage.year_range, "2024-2025");
  assert.equal(trace.evidence_package.trace_summary.year_range, "2024-2025");
  assert.equal(trace.evidence_package.trace_summary.distinct_year_count, 2);
  assert.deepEqual(trace.evidence_package.answer_guidance, ["Give practical next steps first."]);
  assert.equal(JSON.stringify(trace).includes("Sensitive source excerpt"), false);
  assert.equal(JSON.stringify(trace).includes("Sensitive body preview"), false);
});

test("RAG trace truncates selected context body previews", () => {
  const attribution = buildSourceAttribution("Allikas kinnitab vastust.", [
    {
      source_id: "long-preview-source",
      title: "Pikk diagnostiline eelvaade",
      source_type: "journal_article",
      evidenceText: "Allikas kinnitab vastust."
    }
  ], {
    query: "test"
  });
  const longPreview = "x".repeat(900);
  const trace = buildRagTraceFromAttribution([], attribution, {
    selectedContextDetails: [
      {
        source_id: "long-preview-source",
        source_type: "journal_article",
        body_preview: longPreview
      }
    ]
  });

  assert.equal(trace.selected_context_details[0].body_preview.length <= 240, true);
  assert.equal(JSON.stringify(trace).includes(longPreview), false);
});

test("RAG trace merges legalLookupPlan into query_plan when retrievalMeta carries it separately", () => {
  const attribution = buildSourceAttribution("SHS § 140 käsitleb toimetulekutoetuse maksmist.", [
    {
      source_id: "rt-140",
      title: "SHS § 140",
      source_type: "national_law",
      paragraphNumber: "140",
      evidenceText: "Toimetulekutoetuse maksmine."
    }
  ], {
    query: "SHS § 140"
  });

  const trace = buildRagTraceFromAttribution([], attribution, {
    queryPlan: {
      planner_version: "v2",
      mode: "explicit_paragraph",
      selection_strategy: "legal_exact"
    },
    legalLookupPlan: {
      enabled: true,
      mode: "explicit_paragraph",
      jurisdictionLevel: "NATIONAL",
      sourceTypes: ["national_law"],
      collectionId: "national_regulations",
      actTitle: "Sotsiaalhoolekande seadus",
      actAliases: ["shs"],
      municipalityId: null,
      paragraphRefs: ["140"],
      topicTerms: [],
      requireCurrent: true
    }
  });

  assert.equal(trace.query_plan.legalLookupPlan.enabled, true);
  assert.equal(trace.query_plan.legalLookupPlan.mode, "explicit_paragraph");
  assert.deepEqual(trace.query_plan.legalLookupPlan.paragraphRefs, ["140"]);
  assert.equal(trace.query_plan.legalLookupPlan.actTitle, "Sotsiaalhoolekande seadus");
});

test("RAG trace exposes legal exact section attribution opt-out safely", () => {
  const attribution = buildSourceAttribution("SHS § 140 vastus kasutab legal exact rada.", [
    {
      source_id: "rt-140",
      title: "SHS § 140",
      source_type: "national_law",
      paragraphNumber: "140"
    }
  ], {
    query: "SHS § 140"
  });

  const trace = buildRagTraceFromAttribution([], attribution, {
    queryPlan: {
      planner_version: "v2",
      mode: "explicit_paragraph",
      selection_strategy: "legal_exact"
    },
    sectionAttribution: {
      package_attribution_checked: false,
      high_risk_attribution_checked: false,
      section_attribution: [],
      attribution_flags: ["legal_exact_opt_out"]
    }
  });

  assert.equal(trace.package_attribution_checked, false);
  assert.equal(trace.high_risk_attribution_checked, false);
  assert.deepEqual(trace.section_attribution, []);
  assert.deepEqual(trace.attribution_flags, ["legal_exact_opt_out"]);
});

test("RAG trace exposes sanitized runtime source packages", () => {
  const attribution = buildSourceAttribution("Jogeva valla koduteenuse info on kinnitatud teenuse, vormi ja kontakti allikatega.", [
    {
      source_id: "service-info",
      title: "Koduteenus",
      source_type: "kov_service_info",
      evidenceText: "Koduteenuse kirjeldus."
    }
  ], {
    query: "Jogeva vald koduteenus"
  });

  const trace = buildRagTraceFromAttribution([], attribution, {
    sourcePackages: [
      {
        package_id: "jogeva_vald_service_koduteenus_package",
        canonical_item_id: "jogeva_vald_service_koduteenus",
        package_type: "kov_service",
        title: "Koduteenus",
        municipality_id: "jogeva_vald",
        municipality_name: "Jogeva vald",
        section_counts: {
          description: 1,
          forms: 1,
          contacts: 0,
          legal_basis: 0
        },
        sections: {
          description: [
            {
              source_id: "service-info",
              title: "Koduteenus",
              source_type: "kov_service_info",
              evidenceText: "Sensitive package source text must not be copied."
            }
          ],
          forms: [
            {
              source_id: "service-form",
              title: "Koduteenuse taotlus",
              source_type: "application_form"
            }
          ],
          contacts: [],
          legal_basis: []
        },
        source_ids: ["service-info", "service-form"],
        last_checked: "2026-04-28",
        confidence: "medium",
        missing_sections: ["contacts", "legal_basis"]
      }
    ],
    packageAwareAnswering: {
      used: true,
      usedPackageIds: ["jogeva_vald_service_koduteenus_package"],
      missingSectionsUsed: ["contacts", "legal_basis"],
      packageDisplayedSourceIds: ["service-info", "service-form"],
      packageAnswerFlags: ["missing_contacts", "missing_legal_basis"]
    },
    sectionAttribution: {
      package_attribution_checked: true,
      high_risk_attribution_checked: false,
      section_attribution: [
        {
          package_id: "jogeva_vald_service_koduteenus_package",
          section: "description",
          source_ids: ["service-info"],
          evidence_strength: "strong",
          evidence_statuses: ["confirmed"],
          evidenceText: "Sensitive section attribution text must not be copied."
        },
        {
          package_id: "jogeva_vald_service_koduteenus_package",
          section: "contacts",
          source_ids: [],
          evidence_strength: "missing",
          evidence_statuses: ["missing_section"],
          prompt: "Sensitive prompt must not be copied."
        }
      ],
      attribution_flags: ["missing_contacts"]
    }
  });

  assert.equal(trace.source_packages.length, 1);
  assert.equal(trace.package_aware_answering_used, true);
  assert.deepEqual(trace.used_package_ids, ["jogeva_vald_service_koduteenus_package"]);
  assert.deepEqual(trace.missing_sections_used, ["contacts", "legal_basis"]);
  assert.deepEqual(trace.package_displayed_source_ids, ["service-info", "service-form"]);
  assert.deepEqual(trace.package_answer_flags, ["missing_contacts", "missing_legal_basis"]);
  assert.equal(trace.source_packages[0].package_type, "kov_service");
  assert.equal(trace.source_packages[0].municipality_id, "jogeva_vald");
  assert.deepEqual(trace.source_packages[0].source_ids, ["service-info", "service-form"]);
  assert.equal(trace.source_packages[0].section_counts.description, 1);
  assert.equal(trace.source_packages[0].section_counts.forms, 1);
  assert.deepEqual(trace.source_packages[0].sections.forms.map(source => source.source_id), ["service-form"]);
  assert.equal(JSON.stringify(trace.source_packages).includes("Sensitive package source text"), false);
  assert.equal(trace.package_attribution_checked, true);
  assert.equal(trace.high_risk_attribution_checked, false);
  assert.equal(trace.section_attribution.length, 2);
  assert.deepEqual(trace.section_attribution[0], {
    package_id: "jogeva_vald_service_koduteenus_package",
    section: "description",
    source_ids: ["service-info"],
    evidence_strength: "strong",
    evidence_statuses: ["confirmed"]
  });
  assert.deepEqual(trace.section_attribution[1], {
    package_id: "jogeva_vald_service_koduteenus_package",
    section: "contacts",
    source_ids: [],
    evidence_strength: "missing",
    evidence_statuses: ["missing_section"]
  });
  assert.deepEqual(trace.attribution_flags, ["missing_contacts"]);
  assert.equal(Array.isArray(trace.section_attribution[0].evidence_statuses), true);
  assert.equal(JSON.stringify(trace.section_attribution).includes("Sensitive section attribution text"), false);
  assert.equal(JSON.stringify(trace.section_attribution).includes("Sensitive prompt"), false);
});

test("RAG trace and metadata expose insufficient precise legal source support flag", () => {
  const attribution = buildSourceAttribution("Praeguse otsinguga ei leitud piisavalt täpset õiguslikku kinnitust.", [], {
    query: "SHS § 999"
  });

  const trace = buildRagTraceFromAttribution([], attribution, {
    queryPlan: {
      planner_version: "v2",
      mode: "explicit_paragraph",
      selection_strategy: "legal_exact"
    },
    legalLookupPlan: {
      enabled: true,
      mode: "explicit_paragraph",
      jurisdictionLevel: "NATIONAL",
      sourceTypes: ["national_law"],
      collectionId: "national_regulations",
      actTitle: "Sotsiaalhoolekande seadus",
      paragraphRefs: ["999"],
      topicTerms: [],
      requireCurrent: true
    },
    insufficientPreciseLegalSourceSupport: true
  });

  const metadata = buildAttributionMetadata({}, [], attribution, {
    insufficientPreciseLegalSourceSupport: true
  });

  assert.equal(trace.insufficient_precise_legal_source_support, true);
  assert.equal(trace.insufficientPreciseLegalSourceSupport, true);
  assert.equal(metadata.insufficient_precise_legal_source_support, true);
  assert.equal(metadata.insufficientPreciseLegalSourceSupport, true);
});
