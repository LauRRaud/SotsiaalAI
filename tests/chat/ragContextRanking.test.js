import test from "node:test";
import assert from "node:assert/strict";

import {
  filterMatchesToMunicipalities,
  groupMatches,
  rankGroupsWithTopicHints,
  renderOneContextBlock,
  resolveDocumentIdentity,
  selectMultiSourceGroups,
  selectOverviewSynthesisGroups
} from "../../lib/chat/ragContext.js";

test("topic hints outrank generic high-scoring noise for named concept questions", () => {
  const ranked = rankGroupsWithTopicHints([
    {
      key: "kanep",
      title: "Kanep - mis on mis?",
      bodies: ["Artikkel selgitab kanepi tarvitamise tervisemõjusid."],
      bestScore: 0.82,
      tags: []
    },
    {
      key: "voimaluste-kohvik",
      title: "Võimaluste kohvik võimalikuks",
      bodies: ["Projekt kirjeldas Võimaluste kohvikut psüühilise erivajadusega inimestele."],
      bestScore: 0.54,
      tags: []
    }
  ], ["voimaluste", "kohvik"]);

  assert.equal(ranked[0].key, "voimaluste-kohvik");
});

test("groupMatches strips repeated synthetic metadata prefix from chunk body", () => {
  const groups = groupMatches([
    {
      id: "ai-chunk",
      doc_id: "article-doc",
      title: "Tehisintellekt sotsiaaltĆ¶Ć¶s",
      chunk: "[TITLE] Tehisintellekt sotsiaaltĆ¶Ć¶s [DESC] Artikkel arutleb AI kasutuse yle. [AUTHORS] Laur Raudsoo [JOURNAL] SotsiaaltĆ¶Ć¶ [ISSUE] 2/2025 [SECTION] Eetika [YEAR] 2025 [STATUS] active Eesti tĆ¶Ć¶tukassa OTT-sĆ¼steem hindab pikaajalise tĆ¶Ć¶tuse riski 45 nĆ¤itaja alusel.",
      metadata: {
        source_type: "journal_article",
        collection_id: "sotsiaaltoo_articles"
      },
      retrieval_channels: ["dense"]
    }
  ]);

  assert.equal(groups.length, 1);
  assert.doesNotMatch(groups[0].bodies[0], /^\[TITLE\]/);
  assert.match(groups[0].bodies[0], /^Eesti/);
  assert.match(groups[0].bodies[0], /OTT-sĆ¼steem/);
});

test("groupMatches preserves organization official website URL aliases", () => {
  const groups = groupMatches([
    {
      id: "organization-astangu",
      text: "Astangu Kutserehabilitatsiooni Keskus pakub töötamise toetamise teenust ja rehabilitatsiooniteenuseid.",
      metadata: {
        doc_id: "organization-astangu",
        title: "Astangu Kutserehabilitatsiooni Keskus",
        source_type: "organization_profile",
        collection_id: "organizations",
        organization_name: "Astangu Kutserehabilitatsiooni Keskus",
        organization_id: "astangu",
        organization_slug: "astangu",
        official_website: "https://www.astangu.ee/et"
      }
    }
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].url, "https://www.astangu.ee/et");
  assert.equal(groups[0].organizationName, "Astangu Kutserehabilitatsiooni Keskus");
  assert.equal(groups[0].organizationId, "astangu");
  assert.equal(groups[0].organizationSlug, "astangu");
  assert.equal(groups[0].officialWebsite, "https://www.astangu.ee/et");
});

test("title_match channel boosts lexical exact title candidates", () => {
  const ranked = rankGroupsWithTopicHints([
    {
      key: "semantic-noise",
      title: "Koduteenuse üldine taust",
      bodies: ["Üldine kirjeldus koduteenuse tähendusest."],
      bestScore: 0.61,
      retrievalChannels: ["dense"],
      tags: []
    },
    {
      key: "title-hit",
      title: "Tartu linn koduteenus",
      bodies: ["Koduteenuse taotlemise info Tartu linnas."],
      bestScore: 0.3,
      retrievalChannels: ["title_match"],
      tags: []
    }
  ], []);

  assert.equal(ranked[0].key, "title-hit");
});

test("bm25 channel boosts lexical body matches without requiring exact phrase", () => {
  const ranked = rankGroupsWithTopicHints([
    {
      key: "dense-nearby",
      title: "Teenuste ylevaade",
      bodies: ["Yldine kohalike teenuste kirjeldus."],
      bestScore: 0.46,
      retrievalChannels: ["dense"],
      tags: []
    },
    {
      key: "bm25-hit",
      title: "Koduteenuse taotlemine",
      bodies: ["Tartu koduteenus ja taotlus on kirjeldatud teenuselehel."],
      bestScore: 0.31,
      retrievalChannels: ["bm25"],
      tags: []
    }
  ], []);

  assert.equal(ranked[0].key, "bm25-hit");
});

test("group ranking uses backend hybrid_score when present", () => {
  const groups = groupMatches([
    {
      id: "dense-top",
      doc_id: "dense-top",
      title: "Semantiline vaste",
      chunk: "Sisuliselt laiem vastus.",
      distance: 0.05,
      retrieval_channels: ["dense"],
      hybrid_score: 0.42
    },
    {
      id: "hybrid-top",
      doc_id: "hybrid-top",
      title: "Täpne hübriidvaste",
      chunk: "Päringu täpne tekstiline vaste.",
      distance: 0.4,
      retrieval_channels: ["dense", "bm25"],
      hybrid_score: 0.78
    }
  ]);
  const ranked = rankGroupsWithTopicHints(groups, []);

  assert.equal(ranked[0].key, "hybrid-top");
  assert.equal(ranked[0].bestScore, 0.78);
});

test("groupMatches preserves hybrid retrieval score components for trace", () => {
  const groups = groupMatches([
    {
      id: "chunk-1",
      title: "Koduteenus",
      text: "Koduteenuse taotlemine.",
      retrieval_channels: ["dense", "title_match", "bm25"],
      hybrid_score: 0.82,
      dense_score: 0.41,
      lexical_score: 6.2,
      lexical_score_normalized: 0.43662,
      bm25_score: 2.4,
      bm25_coverage: 0.75,
      bm25_matches: 3,
      bm25_query_tokens: 4,
      rrf_score: 0.04,
      channel_boost: 0.14,
      hybrid_rank: 1,
      dense_rank: 3,
      lexical_rank: 1,
      retrieval_scores: {
        hybrid_score: 0.82,
        rrf_score: 0.04
      }
    }
  ]);

  assert.equal(groups[0].bestScore, 0.82);
  assert.equal(groups[0].denseScore, 0.41);
  assert.equal(groups[0].lexicalScore, 6.2);
  assert.equal(groups[0].lexicalScoreNormalized, 0.43662);
  assert.equal(groups[0].bm25Score, 2.4);
  assert.equal(groups[0].bm25Coverage, 0.75);
  assert.equal(groups[0].bm25Matches, 3);
  assert.equal(groups[0].bm25QueryTokens, 4);
  assert.equal(groups[0].rrfScore, 0.04);
  assert.equal(groups[0].channelBoost, 0.14);
  assert.equal(groups[0].hybridRank, 1);
  assert.equal(groups[0].denseRank, 3);
  assert.equal(groups[0].lexicalRank, 1);
  assert.equal(groups[0].retrievalScores.hybrid_score, 0.82);
});

test("groupMatches orders same-article bodies by lexical chunk relevance", () => {
  const groups = groupMatches([
    {
      id: "generic-summary",
      doc_id: "article-doc",
      articleId: "ai-article",
      title: "Tehisintellekt sotsiaaltöös",
      text: "Artikkel käsitleb tehisintellekti väärtuspõhiseid piire sotsiaaltöös üldiselt.",
      metadata: {
        source_type: "journal_article",
        collection_id: "sotsiaaltoo_articles"
      },
      retrieval_channels: ["dense"],
      hybrid_score: 0.9
    },
    {
      id: "ott-specific",
      doc_id: "article-doc",
      articleId: "ai-article",
      title: "Tehisintellekt sotsiaaltöös",
      text: "Eesti töötukassa OTT-süsteem hindab pikaajalise töötuse riski 45 näitaja alusel.",
      metadata: {
        source_type: "journal_article",
        collection_id: "sotsiaaltoo_articles"
      },
      retrieval_channels: ["bm25", "exact_phrase"],
      hybrid_score: 0.4,
      bm25_score: 4.2,
      bm25_coverage: 0.8
    }
  ]);

  assert.equal(groups.length, 1);
  assert.match(groups[0].bodies[0], /OTT-süsteem/);
});

test("groupMatches preserves related form and contact metadata for SourcePackage mapping", () => {
  const groups = groupMatches([
    {
      id: "koduteenus",
      title: "Koduteenus",
      text: "Koduteenuse taotlemine.",
      metadata: {
        source_type: "municipality_kov",
        collection_id: "kov_services",
        item_id: "jogeva_vald_service_koduteenus",
        item_type: "service",
        canonical_item_id: "jogeva_vald_service_koduteenus",
        municipality_id: "jogeva_vald",
        related_forms: ["jogeva_vald_form_sotsiaalabi_taotlus"],
        related_contacts: ["jogeva_vald_contact_eve_viks"],
        sections_present: ["description", "eligibility", "application"]
      }
    }
  ]);

  assert.deepEqual(groups[0].relatedForms, ["jogeva_vald_form_sotsiaalabi_taotlus"]);
  assert.deepEqual(groups[0].relatedContacts, ["jogeva_vald_contact_eve_viks"]);
});

test("resolveDocumentIdentity uses stable source document field priority", () => {
  assert.deepEqual(resolveDocumentIdentity({
    document_id: "doc-main",
    docId: "doc-fallback",
    sourceId: "source-fallback",
    title: "Title"
  }), {
    id: "doc-main",
    field: "document_id",
    weak: false
  });

  assert.deepEqual(resolveDocumentIdentity({
    docId: "doc-camel",
    articleId: "article-fallback"
  }), {
    id: "doc-camel",
    field: "doc_id",
    weak: false
  });

  assert.deepEqual(resolveDocumentIdentity({
    title: "Only title"
  }), {
    id: "Only title",
    field: "title",
    weak: true
  });
});

function overviewGroup(docId, chunkId, score, body, extra = {}) {
  return {
    key: `${docId}-${chunkId}`,
    docId,
    title: extra.title || `Document ${docId}`,
    section: extra.section || `Section ${chunkId}`,
    bodies: [body],
    bestScore: score,
    rankScore: score,
    sourceType: extra.sourceType || "journal_article",
    collectionId: extra.collectionId || "sotsiaaltoo_articles",
    ...extra
  };
}

test("selectOverviewSynthesisGroups selects diverse relevant documents first", () => {
  const groups = [
    overviewGroup("doc-a", "1", 0.96, "lastekaitse dokumenteerimine ajapuudus juhtumitĆ¶Ć¶"),
    overviewGroup("doc-a", "2", 0.91, "lastekaitse dokumenteerimine andmesĆ¼steem kanded"),
    overviewGroup("doc-b", "1", 0.88, "lastekaitse jĆ¤relevalve tugi selgus kvaliteet"),
    overviewGroup("doc-c", "1", 0.84, "lastekaitse pered riskihindamine koostĆ¶Ć¶"),
    overviewGroup("doc-d", "1", 0.81, "lastekaitse spetsialistide koormus tĆ¶Ć¶korraldus"),
    overviewGroup("doc-e", "1", 0.79, "lastekaitse ennetus kogukond teenused")
  ];

  const result = selectOverviewSynthesisGroups(groups, 8, 0.55, {
    minDocuments: 3,
    preferredSourceCount: 6
  });

  assert.equal(result.metadata.overview_synthesis_used, true);
  assert.equal(result.metadata.selection_strategy, "overview_diversity_then_depth");
  assert.equal(result.metadata.distinct_relevant_candidate_document_count >= 5, true);
  assert.equal(result.metadata.distinct_selected_document_count >= 3, true);
  assert.equal(result.metadata.initial_diversity_pass_document_count >= 3, true);
  assert.equal(new Set(result.selected.map(item => item.docId)).size >= 3, true);
});

test("selectOverviewSynthesisGroups does not add weak documents only to meet diversity count", () => {
  const groups = [
    overviewGroup("strong-doc", "1", 0.95, "lastekaitse dokumenteerimine ajapuudus hindamine"),
    overviewGroup("strong-doc", "2", 0.9, "lastekaitse kohtumised protokollimine andmesĆ¼steem"),
    overviewGroup("weak-a", "1", 0.22, "kaugel olev Ć¼ldine mĆ¤rkus"),
    overviewGroup("weak-b", "1", 0.2, "teine nĆµrk kandidaat"),
    overviewGroup("weak-c", "1", 0.18, "kolmas nĆµrk kandidaat")
  ];

  const result = selectOverviewSynthesisGroups(groups, 5, 0.55, {
    minDocuments: 3,
    preferredSourceCount: 5
  });

  assert.equal(result.metadata.distinct_relevant_candidate_document_count, 1);
  assert.equal(result.metadata.source_diversity_limited, true);
  assert.equal(result.metadata.source_diversity_reason, "not_enough_relevant_documents");
  assert.deepEqual(Array.from(new Set(result.selected.map(item => item.docId))), ["strong-doc"]);
});

test("selectOverviewSynthesisGroups allows depth after diversity without unbounded dominance", () => {
  const groups = [
    overviewGroup("deep-doc", "1", 0.98, "lastekaitse dokumenteerimine ajapuudus sissekanded"),
    overviewGroup("deep-doc", "2", 0.94, "jĆ¤relevalve selgus tugi kvaliteedinĆµuded"),
    overviewGroup("deep-doc", "3", 0.92, "andmesĆ¼steem automaatika kohtumiste protokollid"),
    overviewGroup("deep-doc", "4", 0.9, "spetsialistide koormus otsused lepingud"),
    overviewGroup("doc-b", "1", 0.88, "pered ja abivajaduse hindamine"),
    overviewGroup("doc-c", "1", 0.86, "ennetustĆ¶Ć¶ ja kogukondlik tugi"),
    overviewGroup("doc-d", "1", 0.84, "lastekaitse koostĆ¶Ć¶ koolide ja teenustega")
  ];

  const result = selectOverviewSynthesisGroups(groups, 7, 0.55, {
    minDocuments: 3,
    preferredSourceCount: 4,
    dominantShareLimit: 0.4
  });
  const chunks = result.metadata.chunks_per_document;

  assert.equal(result.metadata.distinct_selected_document_count >= 3, true);
  assert.equal((chunks["deep-doc"] || 0) > 1, true);
  assert.equal(result.metadata.depth_pass_added_chunks > 0, true);
  assert.equal(result.metadata.dominant_document_allowed, true);
  assert.equal(result.metadata.dominant_document_share <= 0.4, true);
});

test("groupMatches preserves canonical and official URL aliases for displayed sources", () => {
  const canonicalUrl = "https://www.kuusalu.ee/koduteenus";
  const groups = groupMatches([
    {
      id: "kuusalu-koduteenus",
      text: "Kuusalu vallas pakutakse koduteenust.",
      metadata: {
        title: "Koduteenus",
        source_id: "kov_kuusalu_vald_item_kuusalu_vald_service_koduteenus",
        source_type: "kov_service_info",
        collection_id: "kov_services",
        item_type: "service",
        municipality_id: "kuusalu_vald",
        url_canonical: canonicalUrl
      }
    },
    {
      id: "kuusalu-koduteenus-2",
      text: "Koduteenuse taotlemise info.",
      metadata: {
        title: "Koduteenus",
        source_id: "kov_kuusalu_vald_item_kuusalu_vald_service_koduteenus",
        source_type: "kov_service_info",
        collection_id: "kov_services",
        item_type: "service",
        municipality_id: "kuusalu_vald",
        officialUrl: canonicalUrl
      }
    }
  ]);

  assert.equal(groups[0].url, canonicalUrl);
});

test("filterMatchesToMunicipalities drops wrong KOV service matches", () => {
  const matches = filterMatchesToMunicipalities([
    {
      id: "viljandi-koduteenus",
      metadata: {
        collection_id: "kov_services",
        municipality_id: "viljandi_vald",
        municipality_name: "Viljandi vald"
      }
    },
    {
      id: "anija-koduteenus",
      metadata: {
        collection_id: "kov_services",
        municipality_id: "anija_vald",
        municipality_name: "Anija vald"
      }
    },
    {
      id: "national-background",
      metadata: {
        collection_id: "national_regulations",
        jurisdiction_level: "NATIONAL"
      }
    }
  ], [
    {
      id: "viljandi_vald",
      displayName: "Viljandi vald"
    }
  ]);

  assert.deepEqual(matches.map(item => item.id), ["viljandi-koduteenus", "national-background"]);
});

test("official active sources outrank background sources with close scores", () => {
  const ranked = rankGroupsWithTopicHints([
    {
      key: "background",
      title: "Koduteenuse taust",
      bodies: ["Artikkel selgitab koduteenuse üldist tähendust."],
      bestScore: 0.57,
      sourceType: "journal_article",
      sourceStatus: "active",
      tags: []
    },
    {
      key: "official",
      title: "Koduteenus",
      bodies: ["Ametlik KOV teenuseinfo koduteenuse taotlemise kohta."],
      bestScore: 0.45,
      sourceType: "kov_service_info",
      sourceStatus: "active",
      tags: []
    }
  ], []);

  assert.equal(ranked[0].key, "official");
  assert.ok(ranked[0].qualityAdjust > ranked[1].qualityAdjust);
});

test("historical or inactive sources are penalized below active current sources", () => {
  const ranked = rankGroupsWithTopicHints([
    {
      key: "historical",
      title: "Koduteenus",
      bodies: ["Vana teenusekirjeldus."],
      bestScore: 0.65,
      sourceType: "kov_service_info",
      sourceStatus: "inactive",
      historical: true,
      tags: []
    },
    {
      key: "current",
      title: "Koduteenus",
      bodies: ["Kehtiv teenusekirjeldus."],
      bestScore: 0.25,
      sourceType: "kov_service_info",
      sourceStatus: "active",
      historical: false,
      tags: []
    }
  ], []);

  assert.equal(ranked[0].key, "current");
});

test("groupMatches preserves source validity metadata for later evidence checks", () => {
  const groups = groupMatches([
    {
      id: "chunk-1",
      chunk: "Koduteenuse taotlemine.",
      metadata: {
        title: "Koduteenus",
        source_id: "tartu-koduteenus",
        source_type: "kov_service_info",
        source_status: "active",
        last_checked: "2026-04-25",
        valid_from: "2026-01-01",
        valid_to: null,
        historical: false
      }
    }
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].sourceId, "tartu-koduteenus");
  assert.equal(groups[0].sourceType, "kov_service_info");
  assert.equal(groups[0].sourceStatus, "active");
  assert.equal(groups[0].lastChecked, "2026-04-25");
  assert.equal(groups[0].validFrom, "2026-01-01");
  assert.equal(groups[0].historical, false);
});

test("groupMatches keeps RT legal paragraphs separate after V2 source type normalization", () => {
  const groups = groupMatches([
    {
      id: "rt-14",
      chunk: "Kohaliku omavalitsuse üksus korraldab sotsiaalteenuste osutamist.",
      metadata: {
        doc_id: "national-rt-shs",
        canonical_chunk_id: "riigiteataja:shs:paragraph-14",
        title: "Eesti - Sotsiaalhoolekande seadus - § 14",
        paragraph_number: "14",
        paragraph_title: "Kohaliku omavalitsuse üksuse ülesanded",
        source_type: "national_law",
        collection_id: "national_regulations"
      }
    },
    {
      id: "rt-157",
      chunk: "Riikliku ja haldusjärelevalve teostamine.",
      metadata: {
        doc_id: "national-rt-shs",
        canonical_chunk_id: "riigiteataja:shs:paragraph-157",
        title: "Eesti - Sotsiaalhoolekande seadus - § 157",
        paragraph_number: "157",
        paragraph_title: "Riikliku ja haldusjärelevalve teostamine",
        source_type: "national_law",
        collection_id: "national_regulations"
      }
    }
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(group => group.paragraphNumber), ["14", "157"]);
});

test("groupMatches aggregates RT legal subsections into paragraph-level source units", () => {
  const groups = groupMatches([
    {
      id: "rt-131-lg-1",
      chunk: "§ 131 lg 1 Toimetulekutoetuse eesmärk.",
      metadata: {
        doc_id: "rt-130122025029",
        canonical_chunk_id: "riigiteataja:130122025029:paragraph-131-lg-1",
        title: "Eesti - Sotsiaalhoolekande seadus - § 131 Toimetulekutoetus lg 1",
        act_title: "Sotsiaalhoolekande seadus",
        paragraph_number: "131",
        paragraph_title: "Toimetulekutoetus",
        source_type: "national_law",
        collection_id: "national_regulations"
      }
    },
    {
      id: "rt-131-lg-2",
      chunk: "§ 131 lg 2 Õigus saada toimetulekutoetust.",
      metadata: {
        doc_id: "rt-130122025029",
        canonical_chunk_id: "riigiteataja:130122025029:paragraph-131-lg-2",
        title: "Eesti - Sotsiaalhoolekande seadus - § 131 Toimetulekutoetus lg 2",
        act_title: "Sotsiaalhoolekande seadus",
        paragraph_number: "131",
        paragraph_title: "Toimetulekutoetus",
        source_type: "national_law",
        collection_id: "national_regulations"
      }
    },
    {
      id: "rt-132-lg-1",
      chunk: "§ 132 lg 1 Toimetulekutoetuse taotlemine.",
      metadata: {
        doc_id: "rt-130122025029",
        canonical_chunk_id: "riigiteataja:130122025029:paragraph-132-lg-1",
        title: "Eesti - Sotsiaalhoolekande seadus - § 132 Toimetulekutoetuse taotlemine lg 1",
        act_title: "Sotsiaalhoolekande seadus",
        paragraph_number: "132",
        paragraph_title: "Toimetulekutoetuse taotlemine",
        source_type: "national_law",
        collection_id: "national_regulations"
      }
    }
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].paragraphNumber, "131");
  assert.equal(groups[0].bodies.length, 2);
  assert.match(groups[0].title, /§ 131 Toimetulekutoetus/);
  assert.equal(groups[1].paragraphNumber, "132");
});

test("legal paragraph ranking prefers term-specific RT paragraph over generic legal noise", () => {
  const ranked = rankGroupsWithTopicHints([
    {
      key: "paragraph-157",
      title: "Eesti - Sotsiaalhoolekande seadus - § 157",
      paragraphTitle: "Riikliku ja haldusjärelevalve teostamine",
      paragraphNumber: "157",
      bodies: ["Riikliku ja haldusjärelevalve teostamine sotsiaalhoolekande seaduse täitmise üle."],
      bestScore: 0.9,
      sourceType: "national_law",
      sourceStatus: "active",
      collectionId: "national_regulations",
      retrievalChannels: ["bm25"],
      tags: []
    },
    {
      key: "paragraph-14",
      title: "Eesti - Sotsiaalhoolekande seadus - § 14",
      paragraphTitle: "Kohaliku omavalitsuse üksuse ülesanded",
      paragraphNumber: "14",
      bodies: ["Kohaliku omavalitsuse üksus korraldab sotsiaalteenuste osutamist ja muud abi vastavalt abivajadusele."],
      bestScore: 0.55,
      sourceType: "national_law",
      sourceStatus: "active",
      collectionId: "national_regulations",
      retrievalChannels: ["bm25"],
      tags: []
    }
  ], ["kohaliku omavalitsuse üksus", "sotsiaalteenuste", "korraldab"]);

  assert.equal(ranked[0].key, "paragraph-14");
});

test("legal paragraph ranking penalizes amendment provisions for ordinary benefit section lookup", () => {
  const ranked = rankGroupsWithTopicHints([
    {
      key: "paragraph-176",
      title: "Eesti - Sotsiaalhoolekande seadus - § 176",
      paragraphTitle: "Sotsiaalhoolekande seaduse muutmine",
      paragraphNumber: "176",
      bodies: ["Sotsiaalhoolekande seaduse muutmine. Toimetulekutoetuse muudatused."],
      bestScore: 0.92,
      sourceType: "national_law",
      sourceStatus: "active",
      collectionId: "national_regulations",
      retrievalChannels: ["bm25", "title_match"],
      tags: []
    },
    {
      key: "paragraph-132",
      title: "Eesti - Sotsiaalhoolekande seadus - § 132",
      paragraphTitle: "Toimetulekutoetuse taotlemine",
      paragraphNumber: "132",
      bodies: ["Toimetulekutoetuse taotleja esitab taotluse kohaliku omavalitsuse üksusele."],
      bestScore: 0.62,
      sourceType: "national_law",
      sourceStatus: "active",
      collectionId: "national_regulations",
      retrievalChannels: ["bm25", "title_match"],
      tags: []
    }
  ], ["sotsiaalhoolekande seadus", "toimetulekutoetus", "paragrahvid"]);

  assert.equal(ranked[0].key, "paragraph-132");
});

test("renderOneContextBlock exposes source status metadata for time-aware answers", () => {
  const block = renderOneContextBlock({
    title: "Juubelilugu",
    sourceType: "journal_article",
    sourceStatus: "archived",
    historical: true,
    year: 2018,
    lastChecked: "2026-04-25",
    validFrom: "2018-01-01",
    bodies: ["Artiklis kirjeldati varasemat rolli."],
    authors: []
  }, 0);

  assert.match(block, /source_year=2018/);
  assert.match(block, /source_type=journal_article/);
  assert.match(block, /source_status=archived/);
  assert.match(block, /historical=true/);
});

test("renderOneContextBlock exposes RT paragraph numbers in legal context headers", () => {
  const block = renderOneContextBlock({
    title: "Eesti - Sotsiaalhoolekande seadus",
    sourceType: "national_law",
    collectionId: "national_regulations",
    jurisdictionLevel: "NATIONAL",
    paragraphNumber: "14",
    paragraphTitle: "Kohaliku omavalitsuse üksuse ülesanded",
    bodies: ["Kohaliku omavalitsuse ülesandeid kirjeldav lõik."]
  }, 0);

  assert.match(block, /§ 14/);
  assert.match(block, /Kohaliku omavalitsuse üksuse ülesanded/);
});

test("high-risk ranking prefers strong official evidence over high-scoring background", () => {
  const ranked = rankGroupsWithTopicHints([
    {
      key: "background",
      title: "Toimetulekutoetuse käsitlus",
      bodies: ["Ajakirjaartikkel kirjeldab toimetulekutoetuse tausta."],
      bestScore: 0.82,
      sourceType: "journal_article",
      sourceStatus: "active",
      tags: []
    },
    {
      key: "law",
      title: "Sotsiaalhoolekande seadus",
      bodies: ["Kehtiv õiguslik alus toimetulekutoetuse kohta."],
      bestScore: 0.5,
      sourceType: "national_law",
      sourceStatus: "active",
      tags: []
    }
  ], [], {
    ragRiskPolicy: {
      riskLevel: "high",
      preferredSourceTypes: ["national_law", "kov_regulation", "state_guide"],
      requiredEvidence: "strong"
    }
  });

  assert.equal(ranked[0].key, "law");
});

test("low-risk ranking can still prefer methodology and practice background", () => {
  const ranked = rankGroupsWithTopicHints([
    {
      key: "generic",
      title: "Projekti kirjeldus",
      bodies: ["Üldine projekti taustakirjeldus."],
      bestScore: 0.46,
      sourceType: "project_description",
      sourceStatus: "active",
      tags: []
    },
    {
      key: "methodology",
      title: "Juhtumikorralduse metoodika",
      bodies: ["Metoodiline taust juhtumikorralduse praktika kohta."],
      bestScore: 0.42,
      sourceType: "methodology_guide",
      sourceStatus: "active",
      tags: []
    }
  ], [], {
    ragRiskPolicy: {
      riskLevel: "low",
      preferredSourceTypes: ["journal_article", "methodology_guide", "practice_example"],
      requiredEvidence: "medium"
    }
  });

  assert.equal(ranked[0].key, "methodology");
});

test("selectMultiSourceGroups prefers distinct source identities for synthesis", () => {
  const selected = selectMultiSourceGroups([
    {
      key: "a-1",
      docId: "article-a",
      title: "Article A",
      bestScore: 0.9,
      rankScore: 0.9,
      __sig: "article a tehisintellekt"
    },
    {
      key: "a-2",
      docId: "article-a",
      title: "Article A",
      bestScore: 0.85,
      rankScore: 0.85,
      __sig: "article a tehisintellekt teine"
    },
    {
      key: "b-1",
      docId: "article-b",
      title: "Article B",
      bestScore: 0.7,
      rankScore: 0.7,
      __sig: "article b tehisintellekt"
    }
  ], 2, 0.8);

  assert.equal(selected.length, 2);
  assert.deepEqual(selected.map(item => item.docId), ["article-a", "article-b"]);
});

test("selectMultiSourceGroups deduplicates canonical item identities for synthesis", () => {
  const groups = groupMatches([
    {
      id: "ai-summary",
      text: "Article summary about tehisintellekt in social work.",
      hybrid_score: 0.95,
      metadata: {
        title: "Tehisintellekt sotsiaaltoos",
        doc_id: "article-ai-summary",
        source_id: "article-ai-summary",
        canonical_item_id: "article-ai",
        source_type: "journal_article"
      }
    },
    {
      id: "ai-pdf",
      text: "PDF chunk from the same tehisintellekt social work article.",
      hybrid_score: 0.93,
      metadata: {
        title: "Tehisintellekt sotsiaaltoos PDF",
        doc_id: "article-ai-pdf",
        source_id: "article-ai-pdf",
        canonical_item_id: "article-ai",
        source_type: "journal_article"
      }
    },
    {
      id: "slovenia",
      text: "Separate article about long-term care in Slovenia.",
      hybrid_score: 0.64,
      metadata: {
        title: "Pikaajaline hooldus Sloveenias",
        doc_id: "article-slovenia",
        source_id: "article-slovenia",
        canonical_item_id: "article-slovenia",
        source_type: "journal_article"
      }
    },
    {
      id: "ott",
      text: "Separate article about community service examples and OTT.",
      hybrid_score: 0.62,
      metadata: {
        title: "Kogukonnateenuse naited",
        doc_id: "article-ott",
        source_id: "article-ott",
        canonical_item_id: "article-ott",
        source_type: "journal_article"
      }
    }
  ]);
  const ranked = rankGroupsWithTopicHints(groups, ["tehisintellekt", "sotsiaaltoo"]);
  const selected = selectMultiSourceGroups(ranked, 3, 0.9);

  assert.equal(selected.length, 3);
  assert.deepEqual(selected.map(item => item.canonicalItemId), ["article-ai", "article-slovenia", "article-ott"]);
  assert.deepEqual(new Set(selected.map(item => item.canonicalItemId)).size, selected.length);
});
