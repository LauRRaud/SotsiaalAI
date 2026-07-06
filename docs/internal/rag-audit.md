# SotsiaalAI RAG Runtime Audit

STATUS: current engineering audit

Last reviewed: 2026-06-10

This document summarizes the current `lib/chat` and `lib/rag` architecture, with a file-by-file assessment of role, maturity, limitations and likely conflicts.

The goal is to make it easy to inspect whether each file has a clear function, whether the function is implemented well enough, and where the next quality improvements should be made.

## Rating Scale

| Rating | Meaning |
| --- | --- |
| A | Mature or narrow module; role is clear and implementation is mostly fit for purpose. |
| B | Works and has useful structure, but needs cleanup, stronger tests, or clearer contracts. |
| C | Functional but overloaded, fragmented, or architecturally risky. |
| D | Technical debt; should be redesigned before expanding the feature surface. |

## Executive Summary

SotsiaalAI is not a simple `question -> vector search -> top chunks -> answer` system. The codebase already has a real RAG pipeline:

1. Source need detection.
2. Query planning.
3. Hybrid retrieval.
4. Context grouping and selection.
5. SourcePackage construction.
6. Package-aware answer context.
7. Section-level attribution.
8. Answer source attribution.
9. Displayed-source enforcement.
10. RAG trace and quality metrics.

The main limitation is not that RAG does not exist. V1.1-V1.5 are complete, and V2.1-V2.3 have introduced a deterministic first-class `questionPlanner.js`, role/life-situation modes and a `retrievalStrategySelector.js`. The remaining limitation is that planner authority is still shared across several runtime files, so `question_plan` is now present but not yet the only source of truth for every route, source-layer decision and evidence contract.

```json
{
  "mode": "overview_synthesis",
  "role": "social_worker",
  "domain": "lastekaitse",
  "needs_multiple_sources": true,
  "preferred_source_count": 6,
  "source_layers": ["journal_articles", "guides", "studies", "statistics"]
}
```

This creates the current quality risk: the system can now expose planner intent in trace, but some modes still need deeper evidence packaging, stronger source-layer contracts and more robust retrieval/ranking before the planner can safely govern the whole RAG path.

The highest-value next patch is no longer V1.1 overview hardening. V2.4A has now added the first `EvidencePackage` skeleton for non-KOV multi-source answers, while preserving legal exact and SourcePackage behavior. V2.5A mapped the current source metadata taxonomy, and V2.5B added central source-layer helpers. The next architecture step is V2.5C: gradually replacing duplicated runtime source-type logic with those helpers.

## Implemented Changes

### V1.1 Overview Synthesis Production Hardening

Status: DONE

- `queryPlanner.js`: added `overview_synthesis` mode, `needs_multiple_sources = true`, `selection_strategy = overview_diversity_then_depth`, and `preferred_source_count = {5..8}`.
- `ragContext.js`: added `resolveDocumentIdentity()` and `selectOverviewSynthesisGroups()`.
- `retrievalContextAssembler.js`: connected the overview selector into context selection and added the overview prompt instruction.
- `mainResponseHandler.js`: added sanitized `rag_trace.overview_synthesis` metadata.
- `sourceAttribution.js`: added minimal overview mode support.
- Hotfix: overview prompt mojibake was fixed in `buildOverviewSynthesisInstruction()`.
- This documentation-only/hotfix work package did not run smoke tests, automated tests, or build.

### V1.2 Source Attribution + Displayed Sources Metrics

Status: DONE

- `sourceAttribution.js`: added count/subset metadata for selected, answer, displayed and filtered sources.
- `mainResponseHandler.js`: added source layer metrics to `rag_trace`.
- `sourceQualityMetrics.js`: added `displayed-source-not-in-selected-context` contract checking.
- This documentation-only/hotfix work package did not run smoke tests, automated tests, or build.

### V1.3 Workflow / Mode Selection Conflict Reduction

Status: DONE

- Problem fixed: an old pending mode-selection/help/document workflow can no longer trap a clearly new substantive social-domain question.
- `modeSelection.js`: added substantive-question bypass detection for pending mode-selection prompts. The rule uses general question shape plus social/KOV/service/guidance/practice/risk/legal/public-service/organization/contact/material/disability-support signals, not hardcoded article, file, organization or municipality names.
- `modeSelection.js`: added an assistant-capability guard so prompts such as "Kas sa saad teha PDF?" and "Kas saad dokumendi vormistada?" do not bypass a pending document workflow into RAG.
- `modeSelection.js`: aligned general domain signals with `sourceNeed.js` for SHS, SKA, Sotsiaalkindlustusamet, Töötukassa, töövõime, STAR, infosüsteem, õigusakt, määrus, paragrahv and Riigi Teataja style questions.
- `sourceNeed.js`: concrete named-source follow-up terms remain limited to recent-source follow-up routing (`hasHistory && hasRecentAssistantSources`); this is a known risk to revisit in V2, but it does not currently narrow broad overview retrieval.
- `requestBootstrap.js`: active help/document workflows are bypassed for clearly new substantive questions when no explicit forced mode is set.
- Workflow continuations are preserved for short confirmations, negative replies, numeric choices and document format choices such as `jah`, `ei`, `1`, `2`, `PDF` and `DOCX`.
- `tests/chat/workflowBypass.test.js`: added regressions for overview questions, general social-work questions, guidance/practice questions, AI/social-work questions, KOV/SourcePackage questions, organization/contact/disability/material questions, legal/public-sector/information-system questions, assistant capability questions, confirmations, numeric choices, negative confirmation and document format replies.
- Focused V1.3 tests and `npm run build` passed. Live/server smoke tests were not run in this work package.

### V1.4 Mojibake / Encoding Cleanup

Status: DONE

- `sourceNeed.js`: removed mojibake variants from RAG source-need regexes and kept normalized ASCII terms that match `normalizeSourceNeedText()`.
- Verified `lib/chat` and `lib/rag` runtime files no longer contain the scanned mojibake markers.
- No business logic, planner, retrieval, SourcePackage or workflow behavior was intentionally changed.
- Focused RAG/workflow/source-attribution tests, broader SourcePackage regressions and `npm run build` passed.

### V1.5 Trace and Quality Metrics Expansion

Status: DONE

- `sourceQualityMetrics.js`: added overview-synthesis quality metrics based on `rag_trace.overview_synthesis`.
- Metrics now summarize overview trace count, used count, distinct candidate/relevant/selected document counts, document-count averages, depth-pass added chunks, limited-diversity rate, limited-diversity reasons, dominant-document share and dominant-document exceptions.
- Quality guard now flags `overview_synthesis_low_source_diversity` when at least three relevant documents exist but selected context contains fewer than three distinct documents.
- Quality guard now flags `overview_synthesis_unallowed_dominant_document` when one document dominates an overview answer without an allowed exception while enough relevant alternatives exist.
- `tests/rag/sourceQualityMetrics.test.js`: added regressions for normal overview diversity, too-narrow overview selection and acceptable limited-diversity cases.
- Local V1 acceptance passed: 189 focused RAG/chat/SourcePackage/knowledge tests, lisatest knowledge metadata validation, and `npm run build`.
- Server acceptance: `rag:smoke:source-packages` passed against `https://sotsiaal.ai` for the local Alutaguse fixture with `--answering --attribution --no-persist`. `rag:smoke:v1` against `https://sotsiaal.ai` returned HTTP 401 because this shell has no `SOTSIAALAI_SMOKE_COOKIE` or bearer token configured; this is an access/setup limitation, not a V1.5 code failure.

### Knowledge-doc lisatest metadata check

Status: DONE / superseded by 2026-05-03 folder ingest

- `Andmebaasi/lisatest`: 5 PDF files and 5 matching `knowledge-doc-v1` metadata JSON files are present.
- Each metadata file has a valid `source_path` pointing to a PDF in the same folder.
- Metadata passes `npm run knowledge:validate -- --root "Andmebaasi\lisatest"` with `ingest_ready_count = 5` and no errors.
- Minimal metadata fixes were limited to the lisatest JSON files: `jurisdiction_level`, allowed `document_kind`, allowed `collection_id`, one `source_type` alignment for the Tarkvanem worksheet, and missing `legal_entitlement` in `disallowed_claim_types` where needed.
- Remaining warnings are non-blocking: empty `sectionIndex` for all files and missing `year/publication_date` recommendation for the Peaasi PDF.
- `knowledge:smoke` was later generalized so mixed knowledge-doc folders without the historical hardcoded guideline sample can be checked.
- This lisatest folder is only a small future ingest/retrieval test fixture and is not used to hardcode V1.3 workflow routing.

### Knowledge-doc and Organization Folder Ingest 2026-05-03

Status: DONE / server ingested / smoke green

- Added `scripts/ingest-knowledge-doc-folder.mjs` for local PDF + `knowledge-doc-v1` metadata folders.
- Added npm commands:
  - `knowledge:folder:plan`
  - `knowledge:folder:ingest`
- The folder ingest script supports dry-run by default, `--ingest`, `--skip-existing`, `--doc-id`, `--limit`, `--analyze-pdf`, `--require-section-index`, `--base-url`, `--request-timeout-ms` and `--json`.
- The script sends local PDFs to RAG service `/ingest/pdf-with-metadata` with `metadata_text` and requires `RAG_SERVICE_API_KEY` or `RAG_API_KEY` for ingest mode.
- `--analyze-pdf` can run during dry-run as well as ingest, so PDF TOC/heading section signals can be inspected before writing to RAG.
- Added `scripts/ingest-organization-rag-folder.mjs` for organization 4-file packages (`<slug>.sources.json`, `<slug>.json`, `<slug>.meta.json`, `<slug>.rag.md`) read directly from a folder.
- Added npm commands:
  - `organization:ingest:plan`
  - `organization:ingest`
- Organization folder ingest posts the profile `rag.md` text plus organization metadata to RAG service `/ingest/text`.
- Organization `documents[]` references remain separate document candidates. They are not automatically ingested by the organization profile script.
- `scripts/smoke-knowledge-docs.mjs` now validates all metadata files and ingest payload shapes in a folder, while still running stricter sample assertions only if the historical sample guideline is present.

Server run on 2026-05-03:

- `Andmebaasi/lisatest`: 5 PDF knowledge-doc files ingested.
- `Andmebaasi/uuringud ja juhendid`: 1 PDF knowledge-doc file ingested.
- `Andmebaasi/organisatsioonid`: 1 organization profile package ingested (`organization-astangu`).
- `knowledge:smoke` passed for both `lisatest` and `uuringud ja juhendid`.
- `organization:audit-metadata -- --slug astangu` passed with `metadata_valid = true` and `ingest_ready = true`.
- `rag:smoke:v1` passed.
- `rag:smoke:v2 -- --chat --legal-exact` passed.

Manual smoke observations:

- `Kuidas toetada terviseprobleemiga lapse peret?` routed to `overview_synthesis`, selected multiple sources and displayed the new `Terviseprobleemiga laste ja nende perede toetamise hea tava` PDF as a source.
- `Mis materjale on laste vaimse tervise kohta koolis?` found and displayed the new `Koolilaste ja noorte vaimne tervis` material plus related background articles.
- `Millised organisatsioonid või materjalid aitavad puudega inimest?` still routed as `default` and was dominated by SHS legal sources. This is a planner/source-layer issue, not an ingest failure.

Known metadata quality follow-up:

- V2 smoke remains green, but metadata quality summaries show some `organizations` / `unknown` records missing `authority`, `last_checked`, `url_canonical` and `content_hash`.
- This should be handled by source metadata contract/backfill work, not by reingesting the same files blindly.

### Organization Profile Attribution Fix 2026-05-03

Status: DONE / local tests, build and server reingest check green

Problem:

- The query `Mida Astangu Keskus pakub?` retrieved and selected Astangu sources, but initially the UI displayed no sources.
- After the attribution fix, the source displayed, but it still had no `Ava allikas` link.
- Server inspection showed the Astangu RAG chunks had `official_website`, `url`, `url_canonical` and `source_url` as `null`, so the link problem was also an organization ingest metadata contract issue.

Fix:

- `sourceAttribution.js` now includes organization identity fields in attribution matching:
  - `organization_name`
  - `organizationName`
  - `organization_id`
  - `organizationId`
  - `organization_slug`
  - `organizationSlug`
  - matching `metadata.*` aliases
- `sourceAttribution.js` treats `organization_profile` and `organizations` as synthesis/background source candidates where appropriate.
- `riskPolicy.js` now treats `organization_profile` as background evidence, so low-risk organization profile questions can display the selected organization source instead of failing with `insufficient_evidence_strength`.
- `sourceAttribution.js` now normalizes organization URL aliases (`official_website`, `officialWebsite` and matching `metadata.*` fields) into a displayed `url` / `url_canonical`, so the UI can render `Ava allikas` for organization profile sources.
- `ragContext.js` now preserves `official_website` / `officialWebsite` from RAG match metadata as the normalized group `url`, and keeps organization identity fields on grouped context entries. This closes the runtime gap where ingest metadata had an official website but selected context reached attribution without a clickable URL.
- `retrievalContextAssembler.js` now recognizes the same official website aliases when merging/displaying selected source URLs.
- `components/chat/utils/sources.js` and `components/chat/hooks/useConversationSources.js` now recognize the same organization URL aliases when building clickable source-panel entries.
- `scripts/ingest-organization-rag-folder.mjs` and `lib/admin/rag/organizations/service.js` now write the organization official website into standard RAG URL fields as well: `source_url`, `sourceUrl`, `url_canonical`, `urlCanonical` and `url`. This is needed because the RAG service may not preserve custom `official_website`, but it does preserve and return `url` / `url_canonical`.
- Added a regression test for an Astangu-style named organization question.

Validation:

- `tests/chat/sourceAttribution.test.js` passed.
- `tests/chat/ragContextRanking.test.js` passed for organization official website propagation from RAG metadata into grouped context.
- `tests/chat/sourceUtils.test.js` and `tests/chat/conversationSources.test.js` passed for organization URL alias normalization.
- A wider focused attribution/sourceNeed/retrieval/sourceQuality test batch passed (`55/55`).
- `npm run build` passed.
- Server reingest check for `organization-astangu` confirmed `/search` results now return:
  - `url_canonical: https://www.astangu.ee/et`
  - `url: https://www.astangu.ee/et`
- Live retest confirmed the Astangu source link works.

Current behavior after deploy/reingest:

- `Mida Astangu Keskus pakub?` displays the Astangu organization profile source and exposes its official website as a clickable `Ava allikas` link.

### V2.1 Deterministic Question Planner Skeleton

Status: DONE / local tests green

Scope:

- Added `lib/chat/questionPlanner.js` as a deterministic planner skeleton.
- No LLM planner was added.
- No large `queryPlanner.js` or `retrievalContextAssembler.js` rewrite was done.
- The first planner-owned mode is `resource_discovery`.

Planner output:

- `mode`
- `role`
- `confidence`
- `needs_rag`
- `needs_multiple_sources`
- `preferred_source_count`
- `source_layers`
- `avoid_source_layers`
- `source_layer_filter_mode`
- `retrieval_strategy`
- `answer_contract`
- `planner_reason`

Resource discovery behavior:

- Questions such as `Millised organisatsioonid või materjalid aitavad puudega inimest?`, `Mis materjale on laste vaimse tervise kohta koolis?`, `Kust leida abi kuulmispuudega inimesele?`, `Kas on juhendmaterjale või PDF-e?` and named organization lookups such as `Mida Astangu Keskus pakub?` now produce `mode = resource_discovery`.
- `resource_discovery` treats source layers as preference/boost signals, not as a hard global filter. Preferred layers include:
  - `organizations`
  - `organization_materials`
  - `public_body_info`
  - `partner_service_info`
  - `service_provider_info`
  - `contacts`
  - `sotsiaaltoo_articles`
  - `journal_articles`
  - `studies`
  - `research_reports`
  - `national_guidelines`
  - `training_materials`
  - `official_guideline`
  - `information_material`
  - `method_guidance`
  - `worksheet`
  - `journal_article`
  - `research_report`
  - `organization_profile`
  - `organization_page`
- `avoid_source_layers` marks:
  - `legal_only_answer`
  - `national_law_as_primary`
- `retrievalContextAssembler.js` now runs this planner before source-need routing and lets `resource_discovery` force RAG when needed.
- `queryPlanner.js` now uses the planner output only for resource-discovery cases:
  - `selection_strategy = resource_discovery_diversity`
  - `query_order = broad_first`
  - preferred resource queries get organization/material/guideline/resource metadata filters
  - the global search filter remains the role/audience filter, so relevant journal articles, studies, analysis, KOV resource/service info and public-body/partner/service-provider pages are not excluded just because their source type is not a guideline
  - `source_layer_filter_mode = prefer`
  - planner output is carried into `query_plan.question_planner`
- `retrievalContextAssembler.js` adds a narrow `RESOURCE_DISCOVERY_MODE` answer instruction so legal sources can be used as background, but should not be the only displayed basis when organization/material sources are available.
- `sourceAttribution.js` treats `resource_discovery` as synthesis-style attribution, so selected organization/material/article/research sources can display. Legal background is suppressed when non-legal resource sources exist, but can display as fallback when no non-legal resource source is available.

Non-overrides:

- `Mis ütleb SHS § 42?` remains legal exact, not resource discovery.
- `Millised on Kuusalu valla koduteenuse tingimused?` remains KOV/SourcePackage or KOV-scoped RAG, not resource discovery.
- `Mis on murekohad lastekaitses?` remains overview synthesis, not resource discovery.
- `Tee kokkuvõte dokumendist X` remains specific-document summary, not resource discovery.

Validation:

- Added `tests/chat/questionPlanner.test.js`.
- Updated `tests/chat/queryPlanner.test.js` for resource-discovery filters and trace.
- Updated `tests/chat/sourceAttribution.test.js` for resource-discovery displayed-source behavior.
- Hotfix after live manual smoke: resource discovery attribution now displays selected organization/material/resource sources even when broad user wording does not token-match the selected material exactly. Named organization lookups such as `Mida Astangu Keskus pakub?` still keep exact-name anchors strict, so unrelated organization profiles are not displayed.
- Local focused test command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/questionPlanner.test.js tests/chat/queryPlanner.test.js tests/chat/sourceAttribution.test.js tests/chat/ragTraceMetadata.test.js`
- Result before hotfix: `58/58` tests passed.
- Post-hotfix focused test command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/sourceAttribution.test.js tests/chat/questionPlanner.test.js tests/chat/queryPlanner.test.js tests/chat/ragTraceMetadata.test.js`
- Post-hotfix result: `60/60` tests passed.
- Follow-up fix after manual smoke: `resource_discovery` source filters now include Sotsiaaltöö/journal articles, studies and research reports as supporting material sources. This prevents broad material/help questions from being trapped in a narrow organization-material-only layer when the article/research corpus has useful material.
- Runtime selection now uses `selectMultiSourceGroups()` for `resource_discovery`, so the mode can select more than one relevant source family when available instead of falling back to ordinary MMR.
- `RESOURCE_DISCOVERY_MODE` prompt now tells the model to use relevant journal articles, studies and guidance materials as supporting material sources when direct organization/material sources are sparse.
- Follow-up focused test command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/questionPlanner.test.js tests/chat/queryPlanner.test.js tests/chat/sourceAttribution.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/ragTraceMetadata.test.js`
- Follow-up result: `68/68` tests passed.
- V2.1 hotfix: resource-discovery source-layer logic is now explicitly preference-based. `query_plan.source_layer_filter_mode` and `query_plan.question_planner.source_layer_filter_mode` are set to `prefer`. Preferred metadata filters are applied per query, while the overall search keeps the role/audience filter.
- V2.1 hotfix: source attribution now verifies that journal/research sources can be displayed as material evidence in `resource_discovery`, and that legal background is suppressed only when non-legal resource sources are available.
- V2.1 attribution hotfix after live manual smoke: disability wording such as `puudega inimene` may raise the original risk policy to high/strong evidence, but `resource_discovery` displayed-source attribution now uses a medium evidence display contract for selected non-legal organization/material/article/guideline sources. This prevents an SHS/RT-only displayed-source result when selected non-legal resource evidence exists. Legal exact and KOV/SourcePackage attribution paths remain unchanged.
- Latest hotfix focused test command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/sourceAttribution.test.js tests/chat/questionPlanner.test.js tests/chat/queryPlanner.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/ragTraceMetadata.test.js`
- Latest hotfix result: `71/71` tests passed.
- `npm run build` passed.

Known limits:

- V2.1 is still deterministic and intentionally narrow.
- It does not yet implement full role/life-situation planning.
- It does not yet add a general EvidencePackage, reranker, evidence guard or source-layer metadata contract refactor.
- Resource discovery quality still depends on organization/material/guideline metadata being present and preserved through ingest.

### V2.2 Role-Aware Planner Skeleton

Status: DONE / local focused tests green

Scope:

- Kept V2.2 deterministic. No LLM planner call was added.
- No retrieval rewrite, SourcePackage refactor, EvidencePackage, reranker or evidence checker was added.
- `questionPlanner.js` now carries both the input/session role and the inferred question role:
  - `input_role`
  - `role`
  - `role_confidence`
- Planner output now also carries:
  - `topics`
  - `life_situation`
  - `needs_location`
  - `municipality_hint`
  - `risk_level`

Client life-situation guidance:

- First-person help-seeking questions can now become `mode = life_situation_guidance`.
- Covered deterministic mappings:
  - `financial_hardship`: toimetulekutoetus, vältimatu sotsiaalabi, täiendav sotsiaaltoetus, võlanõustamine, KOV sotsiaalosakond.
  - `elderly_relative_care_difficulty`: koduteenus, abivajaduse hindamine, täisealise isiku hooldus, üldhooldusteenus, sotsiaaltransport, hoolduskoormus.
  - `disabled_child_family_support`: puudega lapse toetus, lapsehoiuteenus, tugiisikuteenus, rehabilitatsioon, SKA, KOV lastekaitse.
- These plans set:
  - `role = client`
  - `needs_rag = true`
  - `needs_multiple_sources = true`
  - `needs_location = true`
  - `retrieval_strategy = life_situation_guidance_hybrid`
  - `answer_contract = client_next_steps_no_entitlement_promise`

Specialist comparison:

- Professional comparison questions such as `Kuidas eristada koduteenust ja isikliku abistaja teenust?` can now become `mode = comparison`.
- At the V2.2 checkpoint the mode was trace-visible only; V2.3 later added the separate retrieval strategy selector and comparison strategy support.

Runtime wiring:

- `retrievalContextAssembler.js` now lets any non-default question plan with `needs_rag = true` force RAG source use.
- `queryPlanner.js` carries the V2.2 planner fields into `query_plan.question_planner`.
- Existing legal exact, KOV/SourcePackage, overview synthesis and resource discovery routes remain in place.

Validation:

- Added/updated focused tests for:
  - financial hardship -> `life_situation_guidance`
  - elderly relative care difficulty -> `life_situation_guidance`
  - disabled child family support -> `life_situation_guidance`
  - service comparison -> `comparison`
  - query trace carries V2.2 role/life-situation fields
- Focused test command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/questionPlanner.test.js tests/chat/queryPlanner.test.js tests/chat/sourceAttribution.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/ragTraceMetadata.test.js`
- Result: `76/76` tests passed.
- Additional source-need/workflow/planner regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/sourceNeed.test.js tests/chat/workflowBypass.test.js tests/chat/questionPlanner.test.js tests/chat/queryPlanner.test.js`
- Result: `52/52` tests passed.
- `npm run build` passed.

Known limits:

- V2.2 itself did not include `retrievalStrategySelector.js`; this was superseded by V2.3 below.
- At V2.2, `life_situation_guidance` and `comparison` were trace-visible planner modes only; V2.3 added deeper source-layer strategy and attribution support.
- Role inference is deterministic and conservative; ambiguous questions still fall back to the session role.

### V2.3 Retrieval Strategy Selector

Status: DONE / local focused tests green

Scope:

- Added `lib/chat/retrievalStrategySelector.js`.
- Kept the selector deterministic. No LLM planner call was added.
- No EvidencePackage, reranker, evidence checker or SourcePackage refactor was added.
- Existing strong routes remain higher priority than planner-mode mapping:
  - legal exact / legal lookup
  - source lookup
  - temporal lookup
  - KOV service/benefit and municipality-scoped RAG
  - national service/benefit and service-jurisdiction routes

Selector contract:

- Input:
  - `questionPlan`
  - `routeContext`
- Output:
  - `mode`
  - `retrieval_strategy`
  - `selection_strategy`
  - `query_order`
  - `needs_multiple_sources`
  - `preferred_source_count`
  - `source_layer_filter_mode`
  - `answer_contract`
  - `force_rag`
  - `route_override`
  - `reason`

Planner mode mapping:

- `resource_discovery` -> `resource_discovery_hybrid`, `resource_discovery_diversity`, broad-first queries.
- `life_situation_guidance` -> `life_situation_guidance_hybrid`, `multi_source_diversity`, broad-first queries.
- `comparison` -> `comparison_balanced_sources`, `multi_source_diversity`, broad-first queries.
- `overview_synthesis` -> `overview_diversity_then_depth`.
- `legal_exact` -> `legal_exact`.
- `kov_service_or_benefit` -> `kov_source_package_or_scoped_rag`.
- `specific_document_summary` -> `specific_document_lookup`.

Runtime wiring:

- `queryPlanner.js` now calls `selectRetrievalStrategy()`.
- `query_plan.retrieval_strategy` and `query_plan.retrieval_strategy_selection` are trace-visible.
- `life_situation_guidance` and `comparison` now drive `selection_strategy = multi_source_diversity` when no stronger route override applies.
- `retrievalContextAssembler.js` now honors `selectionStrategy === "multi_source_diversity"` by using multi-source group selection and matching context budgeting.

Validation:

- Added `tests/chat/retrievalStrategySelector.test.js`.
- Added query-planner regression assertions for V2.3 trace and selection behavior.
- Focused test command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/retrievalStrategySelector.test.js tests/chat/questionPlanner.test.js tests/chat/queryPlanner.test.js tests/chat/sourceAttribution.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/ragTraceMetadata.test.js`
- Result: `81/81` tests passed.
- Additional source-need/workflow/planner regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/sourceNeed.test.js tests/chat/workflowBypass.test.js tests/chat/retrievalStrategySelector.test.js tests/chat/questionPlanner.test.js tests/chat/queryPlanner.test.js`
- Result: `57/57` tests passed.
- `npm run build` passed.

V2.3 hotfix after live manual smoke:

- Live question `Mul pole raha üüri ja toidu jaoks, mida teha?` showed a good answer shape but weak/random sources, because `life_situation_guidance` selected `multi_source_diversity` without expanding retrieval queries from planner topics.
- `queryPlanner.js` now builds `life_situation_guidance` queries from `questionPlan.topics` and `questionPlan.life_situation`.
- Financial hardship retrieval now explicitly searches for toimetulekutoetus, vältimatu sotsiaalabi, täiendav sotsiaaltoetus, võlanõustamine, toiduabi, üürivõlg, ajutine majutus, varjupaigateenus and KOV sotsiaalosakond signals.
- `query_plan.mode` now shows `life_situation_guidance` instead of `default` when no stronger route override applies.
- `source_focused_followup` detection no longer mislabels V2.3 planner-driven per-query filters or KOV scoped filters.
- Follow-up regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/retrievalStrategySelector.test.js tests/chat/questionPlanner.test.js tests/chat/queryPlanner.test.js tests/chat/sourceNeed.test.js tests/chat/workflowBypass.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/ragTraceMetadata.test.js`
- Result: `73/73` tests passed.

V2.3 attribution hotfix after second live manual smoke:

- Live retest showed routing and retrieval strategy were correct, but displayed sources were still random Sotsiaaltöö articles.
- Root cause: `life_situation_guidance` used synthesis attribution, whose accepted source layers covered journals/guides/research better than KOV/SHS/public-help sources.
- `sourceAttribution.js` now treats `life_situation_guidance` separately:
  - accepts `national_law`, KOV legal/service/web sources, public-body info, official guidance, information materials and contact/service pages;
  - matches displayed sources against planner topics/life situation terms;
  - suppresses journal/research background sources when official/KOV/public-help sources are displayable.
- Added regression test: official SHS/KOV emergency-help sources display before journal background for financial hardship.
- Follow-up focused regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/sourceAttribution.test.js tests/chat/retrievalStrategySelector.test.js tests/chat/questionPlanner.test.js tests/chat/queryPlanner.test.js tests/chat/sourceNeed.test.js tests/chat/workflowBypass.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/ragTraceMetadata.test.js`
- Result: `106/106` tests passed.
- `npm run build` passed.

V2.3 comparison hotfix after live manual smoke:

- Live question `Mis vahe on koduteenusel ja tugiisikuteenusel?` produced a useful answer, but the trace stayed on `planner: default` and displayed sources were missing.
- Root cause:
  - `questionPlanner.js` detected comparison intent too narrowly and missed inflected service names such as `koduteenusel` and `tugiisikuteenusel`.
  - `queryPlanner.js` did not yet expand `comparison` planner output into service-aware broad-first retrieval queries.
  - `sourceAttribution.js` treated comparison as generic synthesis, which could hide legal/KOV service sources that are valid evidence for service definitions.
- Fixes:
  - `questionPlanner.js` now detects inflected service comparison questions and carries normalized topics such as `koduteenus` and `tugiisikuteenus`.
  - `queryPlanner.js` now builds comparison query variants from planner topics, with preferred-but-not-hard source layer filters for national law, KOV legal/service/web, official guidance, methodology and Sotsiaaltoo material.
  - `query_plan.mode`, `query_order`, `retrieval_strategy`, `preferred_source_count`, `source_layer_filter_mode` and `flags.comparison` are trace-visible for comparison questions.
  - `sourceAttribution.js` now has a comparison attribution branch that accepts official legal/KOV/service/method sources for compared services and suppresses generic journal/research background when stronger primary service evidence is displayable.
- Added regression tests:
  - question planner detects `Mis vahe on koduteenusel ja tugiisikuteenusel?` as `comparison`;
  - query planner expands comparison into `comparison_balanced_sources`, `broad_first`, `multi_source_diversity`;
  - attribution displays official sources for both compared services.
- Focused regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/questionPlanner.test.js tests/chat/queryPlanner.test.js tests/chat/sourceAttribution.test.js tests/chat/retrievalStrategySelector.test.js`
- Result: `69/69` tests passed.
- Broad RAG/chat regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/workflowBypass.test.js tests/chat/sourceNeed.test.js tests/chat/queryPlanner.test.js tests/chat/retrievalOrchestrator.test.js tests/chat/ragContextRanking.test.js tests/chat/sourceAttribution.test.js tests/chat/ragTraceMetadata.test.js tests/rag/sourceQualityMetrics.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/sourcePackages.test.js tests/chat/packageAwareContext.test.js tests/chat/sectionAttribution.test.js tests/rag/sourcePackageSnapshots.test.js tests/rag/sourcePackageAdminService.test.js tests/rag/knowledgeDocsMetadata.test.js tests/rag/pdfSectionIndex.test.js tests/chat/questionPlanner.test.js tests/chat/retrievalStrategySelector.test.js`
- Result: `223/223` tests passed.
- `npm run build` passed. Build emitted only existing email transport warnings for missing EMAIL_SERVER/SMTP_* env vars.

V2.3 comparison displayed-source narrowing hotfix:

- Live retest showed `comparison` routing and answer quality were now correct, but displayed sources were too broad.
- Example: `Mis vahe on koduteenusel ja tugiisikuteenusel?` displayed valid primary sources `SHS § 17 Koduteenuse eesmärk ja sisu` and `SHS § 23 Tugiisikuteenuse eesmärk ja sisu`, but also unrelated neighboring service sections such as `SHS § 44 Võlanõustamisteenus` and `SHS § 45 Asendushooldusteenus`.
- Root cause: comparison attribution matched broad explanatory terms such as `eesmärk`, `sisu` and `toimetulek`, so unrelated SHS service sections with similar heading shape could pass.
- `sourceAttribution.js` now requires comparison displayed sources to match at least one compared topic identity in source identity fields such as title, section, service name, canonical item or paragraph heading.
- This keeps `koduteenus` and `tugiisikuteenus` sources displayable while filtering unrelated legal/service sections that only share generic terms.
- Added regression coverage with selected context containing §17, §23, §44 and §45; expected displayed sources are only §17 and §23.
- Focused regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/sourceAttribution.test.js tests/chat/questionPlanner.test.js tests/chat/queryPlanner.test.js tests/chat/retrievalStrategySelector.test.js`
- Result: `69/69` tests passed.
- Broad RAG/chat regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/workflowBypass.test.js tests/chat/sourceNeed.test.js tests/chat/queryPlanner.test.js tests/chat/retrievalOrchestrator.test.js tests/chat/ragContextRanking.test.js tests/chat/sourceAttribution.test.js tests/chat/ragTraceMetadata.test.js tests/rag/sourceQualityMetrics.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/sourcePackages.test.js tests/chat/packageAwareContext.test.js tests/chat/sectionAttribution.test.js tests/rag/sourcePackageSnapshots.test.js tests/rag/sourcePackageAdminService.test.js tests/rag/knowledgeDocsMetadata.test.js tests/rag/pdfSectionIndex.test.js tests/chat/questionPlanner.test.js tests/chat/retrievalStrategySelector.test.js`
- Result: `223/223` tests passed.
- `npm run build` passed. Build emitted only existing email transport warnings for missing EMAIL_SERVER/SMTP_* env vars.

### V2.4A EvidencePackage Skeleton

Status: DONE / local regressions and build green

Scope:

- Added `lib/chat/evidencePackage.js`.
- Built a deterministic EvidencePackage from already selected context only.
- No retrieval, query expansion, selection, reranker, evidence checker, LLM planner, SourcePackage or legal exact behavior was changed.
- EvidencePackage currently applies only to non-KOV/non-legal-exact modes:
  - `overview_synthesis`;
  - `comparison`;
  - `resource_discovery`;
  - `life_situation_guidance`;
  - existing broad/thematic multi-source synthesis modes.
- EvidencePackage explicitly skips:
  - `legal_exact` / `explicit_paragraph`;
  - KOV/SourcePackage package-aware answering;
  - user document context / document workflows;
  - default mode.

Runtime wiring:

- `retrievalContextAssembler.js` now builds `evidencePackage` after context selection and displayed-source preparation.
- `extraSystemInstructions` receives a short `EVIDENCE_PACKAGE_MODE` guidance block.
- The guidance is intentionally answer-only: it tells the model how to use the already selected context and explicitly says not to retrieve new sources.
- `mainResponseHandler.js` now exposes sanitized `rag_trace.evidence_package`.

EvidencePackage fields:

- `mode`
- `selected_sources`
- `selected_documents`
- `source_layer_mix`
- `evidence_strength`
- `coverage_warnings`
- `missing_coverage`
- `limitations`
- `answer_guidance`
- `trace_summary`

Initial coverage warnings:

- `life_situation_guidance` warns when no official, KOV or public-body source is selected.
- `resource_discovery` warns when support is legal-only and no organization/material/background source was selected.
- `overview_synthesis` warns when selected document diversity is narrow or V1 overview metadata reports limited diversity.

Validation:

- Added `tests/chat/evidencePackage.test.js`.
- Added `ragTraceMetadata` coverage for sanitized EvidencePackage trace output.
- Focused test command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/evidencePackage.test.js tests/chat/ragTraceMetadata.test.js tests/chat/retrievalContextAssembler.test.js`
- Result: `22/22` tests passed.
- Broad RAG/chat regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/workflowBypass.test.js tests/chat/sourceNeed.test.js tests/chat/queryPlanner.test.js tests/chat/retrievalOrchestrator.test.js tests/chat/ragContextRanking.test.js tests/chat/sourceAttribution.test.js tests/chat/ragTraceMetadata.test.js tests/rag/sourceQualityMetrics.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/sourcePackages.test.js tests/chat/packageAwareContext.test.js tests/chat/sectionAttribution.test.js tests/rag/sourcePackageSnapshots.test.js tests/rag/sourcePackageAdminService.test.js tests/rag/knowledgeDocsMetadata.test.js tests/rag/pdfSectionIndex.test.js tests/chat/questionPlanner.test.js tests/chat/retrievalStrategySelector.test.js tests/chat/evidencePackage.test.js`
- Result: `229/229` tests passed.
- `npm run build` passed. Build emitted only existing email transport warnings for missing EMAIL_SERVER/SMTP_* env vars.

V2.4A live trace check:

- Added `scripts/check-v24a-live-trace.mjs` and npm command `rag:check:v24a-live-trace`.
- The checker verifies the latest persisted `ConversationMessage.metadata.rag_trace` for overview, comparison, legal-exact and KOV SourcePackage routes.
- Local workstation DB did not contain the relevant live server conversation rows; one matching comparison row was an older/stale pre-EvidencePackage message. V2.4A raw-trace live smoke could not be confirmed locally. Run `npm run rag:check:v24a-live-trace` on the server after deploy/restart to mark the live trace check PASS.

### KOV SourcePackage Condition Answer Hotfix

Status: DONE / local regressions green

- Live Kuusalu test `Millised on Kuusalu valla koduteenuse tingimused?` stayed on the correct KOV/SourcePackage route, but the answer became too cautious because the package had no dedicated `eligibility` section.
- `packageAwareContext.js`: added service-condition query detection.
- Package-aware context now adds `answer_focus_conditions=use_confirmed_description_eligibility_application_and_legal_basis` for condition questions.
- Added a condition guardrail: if a dedicated eligibility/conditions section is empty, use confirmed `description`, `application` and `legal_basis` sections for target group, purpose, service content, application path and legal basis. Only mark narrowly which specific eligibility criteria, fees or deadlines are missing.
- No KOV package builder, legal exact, retrieval, planner or SourcePackage refactor was done.
- `tests/chat/packageAwareContext.test.js`: added a Kuusalu-style regression for condition questions with empty eligibility but confirmed description/application/legal_basis.
- Broad focused RAG/chat regression command passed after this hotfix and V2.5A audit documentation: `230/230` tests.
- `npm run build` passed after the runtime change.

### V2.5A Source Metadata Taxonomy Audit

Status: DONE / documentation audit and local metadata scan

Scope:

- No ingest pipeline, retrieval, planner, SourcePackage, legal exact or source attribution runtime refactor was done.
- No mass rename of existing `source_type`, `resource_type`, `collection_id` or `evidence_role` values was done.
- The audit used local metadata under `KOV` and `Andmebaasi`, plus code inspection of source-layer logic in `lib/chat` and `lib/rag`.

Metadata values observed in local JSON sources:

- `source_type`: `kov_service_info`, `information_material`, `organization_profile`, `application_form`, `research_report`, `web_page`, `official_guideline`, `official_contact`, `web_form`, `registry`, `journal_article`, `contact_page`, `policy_analysis`, `organization_service_info`, `training_material`, `methodology_material`, `social_media_page`, `file`, `source_registry`.
- `resource_type`: `service_page`, `information_material`, `form`, `method_guidance`, `benefit`, `organization_page`, `contact`, `research_evidence`, `web_page`, `service`, `resource`, `registry`, `professional_article`, `policy_context`, `service_description`, `best_practice_guidance`, `contact_reference`, `training_material`, `organization_profile`, `source_master_list`.
- `collection_id`: `kov_services`, `organization_guidelines`, `organization_materials`, `organizations`, `national_guidelines`, `sotsiaaltoo_articles`, `source_master_registry`, `training_materials`.
- `evidence_role`: `background`, `practice_guidance`, `organization_background`, `research_evidence`, `service_provider_lookup`, `methodology_background`, `policy_context`, `information_material`, `ingestion_planning`, `training_material`.
- `authority`: mostly `KOV`, named municipalities, `organization_official`, and one `editorial`.
- `audience`: `CLIENT|SOCIAL_WORKER`, `BOTH`, and one `ADMIN`.
- `jurisdiction_level`: `MUNICIPALITY`, `NATIONAL`, `ORGANIZATION`.
- `source_status`: `active` and legacy `known`.
- Freshness fields appear as both `last_checked` and `checked_at`.

Metadata contract mismatches found:

- `sourceMetadata.js` currently defines `RAG_SOURCE_TYPES`, but local/runtime data already uses additional values that are not in that enum: `organization_profile`, `organization_service_info`, `web_page`, `registry`, `social_media_page`, `source_registry`, `training_material`, and legacy `file`.
- Runtime tests and logic also use values that are not consistently represented in the central enum, including `municipality_kov`, `riigiteataja_regulation`, `research`, `analysis`, `research_reports`, `journal_articles`, `organizations`, `organization_page`, and `sotsiaaltoo_articles`.
- `source_status = known` appears in data but is not an allowed `RAG_SOURCE_STATUSES` value. V2.5B should treat it as a legacy status through normalization, not rewrite all stored data immediately.
- `audience = ADMIN` appears in source-master metadata. This should not become an answerable/public evidence source by default.
- `source_type`, `resource_type` and `collection_id` currently overlap semantically. Example: `information_material`, `organization_profile`, `training_material`, `web_page` and `registry` can appear in different fields depending on source family.
- Legal/KOV family names are split across `national_law`, `law`, `regulation`, `kov_regulation`, `riigiteataja_regulation`, `kov_legal`, `kov_rt`, `national_regulations`, `kov_services`, `kov_web` and `municipality_kov`.

Duplicated source-layer logic found:

- `evidencePackage.js`: local legal/KOV/organization/material/research source-layer sets and `sourceLayerFor()`.
- `sourceAttribution.js`: separate legal, synthesis, resource-discovery, life-situation, comparison, municipality-service and background source sets.
- `ragContext.js`: independent official/background/high-authority ranking sets and KOV/legal grouping checks.
- `queryPlanner.js`: per-mode source/collection/resource preference filters.
- `retrievalStrategySelector.js`: planner source-layer preference plumbing.
- `sourceQualityMetrics.js`: local legal-source detection and journal article handling.
- `sourceFreshness.js`: freshness/current-evidence policies and collection-family inference.
- `sourcePackages.js` and `sectionAttribution.js`: local section/source-type eligibility rules for forms, contacts, legal basis and current KOV evidence.

V2.5B helper layer should add, without renaming stored metadata:

- `normalizeSourceType(source)`
- `normalizeCollectionId(source)`
- `sourceLayerFor(source)`
- `isLegalSource(source)`
- `isKovSource(source)`
- `isKovWebSource(source)`
- `isKovRegulationSource(source)`
- `isNationalLawSource(source)`
- `isOrganizationSource(source)`
- `isMaterialSource(source)`
- `isGuidanceSource(source)`
- `isResearchOrJournalSource(source)`
- `isPublicBodyInfoSource(source)`
- `canSupportClaimType(source, claimType)`
- `evidenceRoleFor(source)`

V2.5B design constraints:

- Support legacy and current values through aliases/mapping first; do not mutate stored RAG metadata as the first step.
- Treat `source_layers` from the planner as preference/boost intent unless a route explicitly requires a hard filter.
- Keep legal exact and KOV/SourcePackage paths stronger than planner-level discovery modes.
- Distinguish primary evidence from background evidence, especially for `journal_article`, `research_report`, organization profiles, KOV web, KOV RT and national law.
- Add warnings for unknown/legacy source types, `source_status = known`, `audience = ADMIN`, stale/missing freshness and missing URL identity where appropriate.

### V2.5B Source-Layer Helpers

Status: DONE / helper layer and tests only

Scope:

- Added central source-layer helper functions to `sourceMetadata.js`.
- No broad runtime replacement was done yet.
- No ingest, retrieval, planner, SourcePackage, legal exact or source attribution behavior was intentionally changed.
- Existing stored metadata values are not renamed or migrated.

Added helpers:

- `normalizeSourceType(source)`
- `normalizeCollectionId(source)`
- `sourceLayerFor(source)`
- `isLegalSource(source)`
- `isKovSource(source)`
- `isKovWebSource(source)`
- `isKovRegulationSource(source)`
- `isNationalLawSource(source)`
- `isOrganizationSource(source)`
- `isMaterialSource(source)`
- `isGuidanceSource(source)`
- `isResearchOrJournalSource(source)`
- `isPublicBodyInfoSource(source)`
- `canSupportClaimType(source, claimType)`
- `evidenceRoleFor(source)`

Alias/legacy handling now covered by tests:

- `municipality_kov` -> KOV web/service source behavior.
- `municipal_regulation` / KOV RT collection -> KOV regulation behavior.
- `riigiteataja_regulation` remains legal source behavior through helper classification.
- `research` and `analysis` normalize to research/policy-analysis behavior.
- `journal_articles` normalizes to `sotsiaaltoo_articles`.
- `kov_regulations` normalizes to `kov_legal`.
- `organization_profile`, `organization_page`, `organization_service_info`, `training_material`, `journal_article`, `research_report`, `public_body_info` style sources are classified without needing immediate stored-data renames.

Claim-support guardrails:

- Legal entitlement/basis claims require national law or KOV regulation style sources.
- Benefit amount, fee and deadline claims require legal or KOV current-service style sources.
- Municipal service availability/application process claims require KOV web or KOV regulation style sources.
- Organization background, practice guidance and research/background context claims are separated from legal/current-service claims.

Validation:

- `tests/rag/sourceMetadata.test.js`: added helper classification and claim-support regressions.
- Focused test command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/rag/sourceMetadata.test.js`
- Result: `11/11` tests passed.

### V2.5C-1 EvidencePackage Runtime Replacement

Status: DONE / low-risk runtime replacement

Scope:

- Replaced duplicated source-layer classification in `evidencePackage.js` with central `sourceMetadata.js` helper functions:
  - `sourceLayerFor()`
  - `evidenceRoleFor()`
  - `canSupportClaimType()`
  - `isLegalSource()`, `isKovSource()`, `isOrganizationSource()`, `isMaterialSource()`, `isGuidanceSource()`, `isResearchOrJournalSource()`, `isPublicBodyInfoSource()`
- Kept the EvidencePackage public layer mix stable and coarse (`legal`, `kov`, `organization`, `material`, `research_or_journal`, `public_body_info`, `other`) so answer guidance and trace contracts do not churn.
- Added compact source contract metadata to selected sources: `source_layer_contract`, `evidence_role`, and `claim_support`.
- Trace still does not copy chunk/body/evidence text.
- Added the runtime legacy alias `kov_service_page -> kov_service_info` to the central source metadata normalizer.
- No retrieval, planner, SourcePackage, legal exact, KOV/SourcePackage route, source attribution, `queryPlanner.js`, `retrievalStrategySelector.js`, or `ragContext.js` behavior was otherwise changed.
- `sourceQualityMetrics.js` already uses `isLegalSource()` in this workspace and was not changed in this V2.5C-1 pass.

Validation:

- `tests/chat/evidencePackage.test.js`: added regressions for `organization_profile`, `training_material`, `journal_article`, `research_report`, `riigiteataja_regulation`, `national_law`, `municipality_kov`, and `kov_service_page`.
- `tests/rag/sourceMetadata.test.js`: added `kov_service_page` normalizer/layer coverage.
- Focused test command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/evidencePackage.test.js tests/rag/sourceMetadata.test.js`
- Result: `18/18` tests passed.
- Trace-focused test command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/evidencePackage.test.js tests/rag/sourceMetadata.test.js tests/chat/ragTraceMetadata.test.js`
- Result: `27/27` tests passed.
- Broad RAG/chat regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/workflowBypass.test.js tests/chat/sourceNeed.test.js tests/chat/queryPlanner.test.js tests/chat/retrievalOrchestrator.test.js tests/chat/ragContextRanking.test.js tests/chat/sourceAttribution.test.js tests/chat/ragTraceMetadata.test.js tests/rag/sourceQualityMetrics.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/sourcePackages.test.js tests/chat/packageAwareContext.test.js tests/chat/sectionAttribution.test.js tests/rag/sourcePackageSnapshots.test.js tests/rag/sourcePackageAdminService.test.js tests/rag/knowledgeDocsMetadata.test.js tests/rag/pdfSectionIndex.test.js tests/chat/questionPlanner.test.js tests/chat/retrievalStrategySelector.test.js tests/chat/evidencePackage.test.js tests/rag/sourceMetadata.test.js`
- Result: `244/244` tests passed.
- `npm run build` passed. Build emitted existing email transport warnings for missing email environment variables; this was not a build failure.

Follow-up hotfix:

- DONE after V2.5C-1: named organization resource discovery displayed-source pruning. `Mida Astangu Keskus pakub?` previously could keep broad articles about other centers because the generic organization word `keskus/keskuse` satisfied the one-anchor resource discovery check.
- `sourceAttribution.js` now treats generic organization words such as `keskus`, `organisatsioon`, `liit`, `uhing`, `asutus` as weak organization-name anchors. If a concrete distinctive anchor such as `astangu` exists, the source must match that distinctive anchor.
- Added regressions:
  - `resource discovery does not keep other center articles for a named organization lookup`
  - `resource discovery applies generic center-name pruning beyond Astangu`
- Validation:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/sourceAttribution.test.js` -> `36/36` passed.
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/sourceAttribution.test.js tests/chat/questionPlanner.test.js tests/chat/retrievalStrategySelector.test.js tests/chat/ragTraceMetadata.test.js tests/chat/sourcePackages.test.js tests/chat/packageAwareContext.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/queryPlanner.test.js tests/chat/retrievalOrchestrator.test.js tests/chat/ragContextRanking.test.js` -> `151/151` passed.
  - `npm run build` passed. Build emitted existing email transport warnings for missing email environment variables; this was not a build failure.

Follow-up hotfix:

- DONE after live AI ethics smoke: default attribution no longer displays broad rights/community articles just because they overlap with generic answer terms such as autonomy, rights, responsibility or community.
- Example issue: `kas tehisintellektiga seotud eetilised küsimused on sotsiaalvaldkonnas oluline teema?` selected the AI ethics article plus unrelated Sotsiaaltöö articles; displayed sources showed all five even though the answer was materially supported by the AI ethics article.
- `sourceAttribution.js` now requires non-synthesis default displayed sources to match at least one distinctive query topic token when such terms exist. Generic words such as `oluline`, `teema`, `küsimus`, `seotud` and `sotsiaalvaldkond` do not count as distinctive topic support.
- Added regression: `default attribution prunes broad rights articles from AI ethics answers`.
- Validation:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/sourceAttribution.test.js` -> `37/37` passed.
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/sourceAttribution.test.js tests/chat/questionPlanner.test.js tests/chat/retrievalStrategySelector.test.js tests/chat/ragTraceMetadata.test.js tests/chat/sourcePackages.test.js tests/chat/packageAwareContext.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/queryPlanner.test.js tests/chat/retrievalOrchestrator.test.js tests/chat/ragContextRanking.test.js` -> `153/153` passed.
  - `npm run build` passed. Build emitted existing email transport warnings for missing email environment variables; this was not a build failure.

Follow-up hotfix:

- DONE after live Kuusalu condition-answer smoke: KOV/SourcePackage condition answers now get stronger wording guidance so they do not undermine trust when a service page gives general conditions but not a full separate eligibility checklist.
- Example issue: `Millised on Kuusalu valla koduteenuse tingimused?` used the correct package route and sources, but the answer said the exact conditions were not "piisavalt täpselt kinnitatavad", which sounded less reliable than intended.
- `packageAwareContext.js` now instructs the model to state confirmed service target, purpose, content, application path and legal basis first, then phrase limitations as: `kasutatud allikates on teenuse tingimused kirjeldatud üldiselt` or `eraldi abikõlblikkuse kriteeriume, tasusid või tähtaegu nendes allikates ei täpsustata`.
- Added regression coverage in `buildPackageAwareContext guides condition questions to use confirmed package sections`.
- Validation:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/packageAwareContext.test.js tests/chat/sourcePackages.test.js tests/chat/retrievalContextAssembler.test.js` -> `27/27` passed.
  - `npm run build` passed. Build emitted existing email transport warnings for missing email environment variables; this was not a build failure.

Follow-up hotfix:

- DONE after chat UI style smoke: conversational answers should no longer expose raw Markdown heading markers such as `### 2) Praktiline juhendmaterjal`.
- `systemPrompts/et.js`, `systemPrompts/en.js` and `systemPrompts/ru.js` now instruct the model to avoid Markdown heading markers in chat answers and use plain-text section labels instead.
- `messageMarkdown.js` now strips Markdown heading markers defensively when rendering assistant messages, so an occasional `#`, `##` or `###` heading is displayed as normal text rather than raw markup.
- Added regression coverage in `tests/chat/messageMarkdown.test.js` and `tests/chat/promptStyle.test.js`.
- Validation:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/promptStyle.test.js tests/chat/messageMarkdown.test.js` -> `10/10` passed.
  - `npm run build` passed. Build emitted existing email transport warnings for missing email environment variables; this was not a build failure.

Server live smoke after deploy:

- `npm run rag:check:v24a-live-trace` returned `ok: true` against the deployed server after the platform checks.
- `overview_synthesis` (`Mis on murekohad lastekaitses?`) kept `evidence_package_present = true`.
- `comparison` (`Mis vahe on koduteenusel ja tugiisikuteenusel?`) kept `evidence_package_present = true` and displayed only SHS § 23 and SHS § 17.
- `explicit_paragraph` / legal exact (`Mis ütleb SHS § 42?`) kept `evidence_package_present = false`.
- KOV/SourcePackage (`Millised on Kuusalu valla koduteenuse tingimused?`) kept `package_aware_answering_used = true` and `evidence_package_present = false`.
- Manual platform smoke was acceptable for overview, comparison, legal exact, KOV service lookup, resource discovery, life-situation guidance and Astangu organization lookup.

### V2.5C-2 SourceQualityMetrics Helper Cleanup

Status: DONE / focused helper replacement and alias coverage

Scope:

- `sourceQualityMetrics.js`: replaced the remaining local legal-source adapter usage with central `isLegalSource({ source_type })` checks from `sourceMetadata.js`, preserving the previous source-type-only metric boundary.
- `sourceQualityMetrics.js`: removed the stale raw `journal_article` selected-context check from the legal-current metric path instead of broadening it to non-legal research sources.
- `tests/rag/sourceQualityMetrics.test.js`: added regressions for selected-context legal aliases and for preserving the boundary that non-legal research aliases do not count as current legal source violations.
- No retrieval, planner mode detection, SourcePackage, legal exact, KOV/SourcePackage route, ingest pipeline or stored metadata values were changed.

Validation:

- Focused source-quality/source-metadata tests passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/rag/sourceQualityMetrics.test.js` -> `11/11` passed.
  - `npx tsx --tsconfig jsconfig.json --test tests/rag/sourceMetadata.test.js` -> `11/11` passed.
- Broad RAG/chat regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/workflowBypass.test.js tests/chat/sourceNeed.test.js tests/chat/queryPlanner.test.js tests/chat/retrievalOrchestrator.test.js tests/chat/ragContextRanking.test.js tests/chat/sourceAttribution.test.js tests/chat/ragTraceMetadata.test.js tests/rag/sourceQualityMetrics.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/sourcePackages.test.js tests/chat/packageAwareContext.test.js tests/chat/sectionAttribution.test.js tests/rag/sourcePackageSnapshots.test.js tests/rag/sourcePackageAdminService.test.js tests/rag/knowledgeDocsMetadata.test.js tests/rag/pdfSectionIndex.test.js tests/chat/questionPlanner.test.js tests/chat/retrievalStrategySelector.test.js tests/chat/evidencePackage.test.js tests/rag/sourceMetadata.test.js`
  - Result: `249/249` tests passed.
- `npm run build` passed. Build emitted existing email transport warnings for missing email environment variables; this was not a build failure.

Next step:

- V2.5C-3: replace selected low-risk `sourceAttribution.js` source-layer branches with central helpers.

### V2.5C-3 SourceAttribution Legal Helper Cleanup

Status: DONE / selected low-risk attribution replacement

Scope:

- `sourceAttribution.js`: replaced the local legal-source regex with the central `sourceMetadata.js` `isLegalSource()` helper behind the existing exported attribution `isLegalSource()` API.
- `sourceAttribution.js`: kept attribution matching scoped to raw `source_type/sourceType` so collection-only metadata does not newly classify a source as legal in attribution.
- `sourceAttribution.js`: replaced the legal ID regex in `getSourceAttributionId()` with the attribution legal helper, so central legal aliases such as `municipal_regulation` keep legal chunk IDs.
- `tests/chat/sourceAttribution.test.js`: added a regression for `municipal_regulation` legal alias identity behavior.
- No retrieval, planner mode detection, SourcePackage, legal exact contract matching, KOV/SourcePackage route, ingest pipeline or stored metadata values were changed.

Validation:

- Focused tests passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/sourceAttribution.test.js` -> `38/38` passed.
  - `npx tsx --tsconfig jsconfig.json --test tests/rag/sourceMetadata.test.js` -> `11/11` passed.
- Broad RAG/chat regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/workflowBypass.test.js tests/chat/sourceNeed.test.js tests/chat/queryPlanner.test.js tests/chat/retrievalOrchestrator.test.js tests/chat/ragContextRanking.test.js tests/chat/sourceAttribution.test.js tests/chat/ragTraceMetadata.test.js tests/rag/sourceQualityMetrics.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/sourcePackages.test.js tests/chat/packageAwareContext.test.js tests/chat/sectionAttribution.test.js tests/rag/sourcePackageSnapshots.test.js tests/rag/sourcePackageAdminService.test.js tests/rag/knowledgeDocsMetadata.test.js tests/rag/pdfSectionIndex.test.js tests/chat/questionPlanner.test.js tests/chat/retrievalStrategySelector.test.js tests/chat/evidencePackage.test.js tests/rag/sourceMetadata.test.js`
  - Result: `250/250` tests passed.
- `npm run build` passed. Build emitted existing email transport warnings for missing email environment variables; this was not a build failure.

Next step:

- V2.6 cleanup/refactor: remove remaining duplicate source-layer logic carefully, normalize trace/source-layer naming, and document the final contract.

### V2.6 Source Layer Trace Contract Cleanup

Status: DONE / trace-only source-layer normalization

Scope:

- `sourceAttribution.js`: attribution decisions now include `source_layer_contract`, derived from central `sourceMetadata.js` `sourceLayerFor()`.
- This creates the same normalized source-layer vocabulary in attribution trace metadata that EvidencePackage already uses (`national_law`, `kov_regulation`, `kov_web`, `organization`, `guidance`, `material`, `research_or_journal`, `public_body_info`, `legal`, `other`).
- The change is trace-only: it does not change display/hide decisions, score thresholds, source matching, retrieval, planner mode detection, SourcePackage, legal exact contract matching, KOV/SourcePackage routing, ingest pipeline or stored metadata values.
- `tests/chat/sourceAttribution.test.js`: extended the legal alias identity regression to assert `source_layer_contract = kov_regulation` for the legacy `municipal_regulation` alias.

Validation:

- Focused tests passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/sourceAttribution.test.js` -> `38/38` passed.
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/ragTraceMetadata.test.js` -> `9/9` passed.
  - `npx tsx --tsconfig jsconfig.json --test tests/rag/sourceMetadata.test.js` -> `11/11` passed.
- Broad RAG/chat regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/workflowBypass.test.js tests/chat/sourceNeed.test.js tests/chat/queryPlanner.test.js tests/chat/retrievalOrchestrator.test.js tests/chat/ragContextRanking.test.js tests/chat/sourceAttribution.test.js tests/chat/ragTraceMetadata.test.js tests/rag/sourceQualityMetrics.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/sourcePackages.test.js tests/chat/packageAwareContext.test.js tests/chat/sectionAttribution.test.js tests/rag/sourcePackageSnapshots.test.js tests/rag/sourcePackageAdminService.test.js tests/rag/knowledgeDocsMetadata.test.js tests/rag/pdfSectionIndex.test.js tests/chat/questionPlanner.test.js tests/chat/retrievalStrategySelector.test.js tests/chat/evidencePackage.test.js tests/rag/sourceMetadata.test.js`
  - Result: `250/250` tests passed.
- `npm run build` passed. Build emitted existing email transport warnings for missing email environment variables; this was not a build failure.

Next step:

- Final regression/build and platform live smoke.

### V2.7 Temporal Framing for Multi-Year EvidencePackage Answers

Status: DONE / answer-guidance quality improvement

Scope:

- `evidencePackage.js`: selected sources and selected documents now carry sanitized `source_year` when the selected RAG evidence exposes `year`, `source_year`, publication year/date, published date or issue label/id metadata.
- `evidencePackage.js`: multi-source EvidencePackage now computes `temporal_coverage` with selected evidence years, min/max year, year range, year span and per-year counts.
- `evidencePackage.js`: broad synthesis/resource-discovery style answer guidance now tells the model to distinguish earlier and newer selected materials when the selected sources span multiple years.
- The temporal instruction is deliberately conservative: it says not to infer a trend or current change from publication years alone, and to use wording such as `earlier selected sources noted...` / `newer selected sources add/emphasize...` only when the selected evidence supports it.
- `mainResponseHandler.js`: RAG trace sanitization now preserves EvidencePackage `source_year`, `temporal_coverage`, `trace_summary.year_range`, `trace_summary.distinct_year_count` and `trace_summary.temporal_span_years`.
- `tests/chat/evidencePackage.test.js`: added regressions for multi-year overview sources and single-year sources.
- `tests/chat/ragTraceMetadata.test.js`: added sanitized trace coverage for EvidencePackage temporal fields.
- No retrieval, planner mode detection, SourcePackage, legal exact contract matching, KOV/SourcePackage route, ingest pipeline or stored metadata values were changed.

Expected answer effect:

- For broad questions backed by material from e.g. 2017-2025, the answer may now naturally separate older selected material from newer selected material.
- The model should not claim a real-world trend merely because selected source publication years differ.
- Legal exact, KOV SourcePackage and life-situation guidance should not get forced into artificial time-period structure.

Validation:

- Focused tests passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/evidencePackage.test.js` -> `9/9` passed.
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/ragTraceMetadata.test.js` -> `9/9` passed.
  - `npx tsx --tsconfig jsconfig.json --test tests/rag/sourceQualityMetrics.test.js tests/rag/sourceMetadata.test.js` -> `22/22` passed.
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/evidencePackage.test.js tests/chat/ragTraceMetadata.test.js tests/chat/sourceAttribution.test.js` -> `56/56` passed.
- Broad RAG/chat regression command passed:
  - `npx tsx --tsconfig jsconfig.json --test tests/chat/workflowBypass.test.js tests/chat/sourceNeed.test.js tests/chat/queryPlanner.test.js tests/chat/retrievalOrchestrator.test.js tests/chat/ragContextRanking.test.js tests/chat/sourceAttribution.test.js tests/chat/ragTraceMetadata.test.js tests/rag/sourceQualityMetrics.test.js tests/chat/retrievalContextAssembler.test.js tests/chat/sourcePackages.test.js tests/chat/packageAwareContext.test.js tests/chat/sectionAttribution.test.js tests/rag/sourcePackageSnapshots.test.js tests/rag/sourcePackageAdminService.test.js tests/rag/knowledgeDocsMetadata.test.js tests/rag/pdfSectionIndex.test.js tests/chat/questionPlanner.test.js tests/chat/retrievalStrategySelector.test.js tests/chat/evidencePackage.test.js tests/rag/sourceMetadata.test.js`
  - Result: `252/252` tests passed.
- `npm run build` passed. Build emitted existing email transport warnings for missing email environment variables; this was not a build failure.

Next step:

- Deploy/restart and run platform live smoke with broad overview/resource-discovery questions that have multi-year article evidence.
- If live answers still use too few sources or ignore a rich article corpus, do a separate V2.8 selector/display diversity tuning patch. Do not mix that with temporal framing.

### V2.7A Live Trace Checker Freshness/Temporal Guard

Status: DONE / checker reliability hotfix

Scope:

- `scripts/check-v24a-live-trace.mjs`: live trace checker now rejects stale matching conversations by default, so `npm run rag:check:v24a-live-trace` cannot silently pass because it found an older smoke-test row.
- Default freshness window is `720` minutes and can be adjusted with `--max-age-minutes=N` or `--since-minutes=N`.
- Manual stale-row debugging remains possible with `--allow-stale`, but that mode is not a production smoke PASS condition.
- A single already-run smoke can be checked with `--case=<case_id>` and `--conversation-id=<conversation_id>`, which is useful when live questions were run before the checker patch was deployed.
- The checker now normalizes Estonian diacritics and known mojibake variants before matching smoke prompts.
- The checker now validates V2.7 temporal EvidencePackage metadata for the overview smoke case when selected evidence carries source years.
- The checker core is exported for unit testing and imports Prisma only in CLI execution, so tests can cover checker logic without requiring a database connection.
- `tests/scripts/checkV24aLiveTrace.test.js`: added focused tests for stale trace rejection, prompt normalization, temporal EvidencePackage validation and CLI option parsing.
- No retrieval, planner mode detection, SourcePackage, legal exact contract matching, KOV/SourcePackage route, ingest pipeline, stored metadata values or runtime answer behavior were changed.

Validation:

- Focused checker tests passed:
  - `node tests\scripts\checkV24aLiveTrace.test.js` -> `6/6` passed.
- Local workstation DB diagnostic:
  - `npm run rag:check:v24a-live-trace` -> expected FAIL on local data: no fresh smoke rows inside the `720` minute default window, and one old comparison row was rejected with `trace_too_old`.
  - `node scripts\check-v24a-live-trace.mjs --allow-stale` -> expected FAIL on local data because there were no fresh live smoke rows and the only matched comparison row was an older pre-EvidencePackage trace.
  - `node scripts\check-v24a-live-trace.mjs --case=overview_lastekaitse --conversation-id=conv-540948d4-0733-4072-b8e0-421ccc549dcf --max-age-minutes=1440` -> expected local FAIL with `checked_recent_messages: 0`, because that pasted smoke conversation is not present in the local workstation DB.
  - This confirms the checker no longer treats stale/pre-upgrade rows as a valid live smoke PASS.
- `npm run build` passed. Build emitted existing email transport warnings for missing email environment variables; this was not a build failure.

Next step:

- After deploy/restart, run fresh live smoke and then run `npm run rag:check:v24a-live-trace` within the default freshness window.
- If the live smoke happened earlier than the default window but is still intentionally valid, run `npm run rag:check:v24a-live-trace -- --max-age-minutes=1440`.
- For a targeted overview smoke already present in the DB, run e.g. `npm run rag:check:v24a-live-trace -- --case=overview_lastekaitse --conversation-id=conv-540948d4-0733-4072-b8e0-421ccc549dcf --max-age-minutes=1440`.

### Platform Live Smoke 2026-06-10

Status: DONE / live smoke PASS, server trace checker PASS

Setup:

- Server was already at the same commit as local `main` (`719efaed`), so no deploy was needed before smoke.
- Smoke was run over `/api/chat` against `https://sotsiaal.ai` with an authenticated session cookie, one fresh conversation per question with `persist: true` and a client-generated `conv-<uuid>` id.
- Note for future scripted smokes: `/api/chat` persists messages only when the client supplies a plausible `convId`; `persist: true` alone does not create a conversation.

Live question set and routing results (all HTTP 200):

| Question | Mode | EvidencePackage | Package-aware | Displayed sources |
| --- | --- | --- | --- | --- |
| `Mis on murekohad lastekaitses?` | `overview_synthesis` | yes (temporal 2021-2025) | no | 3 distinct Sotsiaaltöö documents |
| `Mis vahe on koduteenusel ja tugiisikuteenusel?` | `comparison` | yes | no | SHS § 23 and § 17 only |
| `Mis ütleb SHS § 42?` | `explicit_paragraph` | no | no | SHS § 42 only |
| `Millised on Kuusalu valla koduteenuse tingimused?` | `municipality_service_benefit_list` | no | yes | KOV service page, forms, KOV RT § 6 |
| `Mida Astangu Keskus pakub?` | `resource_discovery` | yes | no | Astangu organization profile only |
| `Millised organisatsioonid või materjalid aitavad puudega inimest?` | `resource_discovery` | yes | no | 3 non-legal organization/material sources |
| `Mul pole raha üüri ja toidu jaoks, mida teha?` | `life_situation_guidance` | yes | no | SHS § 8 and § 135 official sources |

Server trace checker:

- `npm run rag:check:v24a-live-trace` on the server returned `ok: true` with all four cases green against fresh rows (age 1-2 minutes).
- `overview_lastekaitse` carried V2.7 temporal EvidencePackage metadata: `source_years = [2021, 2023, 2025]`, `temporal_year_range = 2021-2025`, `temporal_has_multi_year_range = true`, trace summary year range present.
- `comparison_koduteenus_tugiisik` displayed only paragraphs 23 and 17.
- `legal_exact_shs_42` kept `evidence_package_present = false`.
- `kov_kuusalu_koduteenus` kept `package_aware_answering_used = true`.

Answer quality observations:

- The overview answer was a genuine multi-document synthesis and used the V2.7 temporal framing wording (`Varasemad allikad rõhutavad...` / `Uuemad materjalid lisavad...`) without claiming a trend from publication years alone.
- The life-situation answer led with vältimatu sotsiaalabi next steps, displayed official SHS sources instead of journal background, and asked for the municipality.
- The resource-discovery answer mixed organization, KOV service and material sources instead of an SHS-only list.

Minor observations (not failures, candidates for later cleanup):

- Kuusalu displayed sources contained one duplicated source id (`kov_kuusalu_vald_item_kuusalu_vald_service_koduteenus` twice) and one generic non-namespaced id (`forms_page`).
- Overview selected 3 distinct documents, which is the diversity minimum. With a rich corpus this is acceptable but keeps the V2.8 selector/display diversity tuning question open as an optional improvement, not a blocker.

### Source Metadata Backfill 2026-06-10/11

Status: DONE / full apply on server, 5547/5547 patches, 0 failures

Scope:

- Added `POST /documents/{doc_id}/patch-meta` to the RAG service: metadata-only patch of registry plus Chroma chunk metadata via `collection.update`, whitelisted scalar fields, no re-parse/re-chunk/re-embed, works for all document types. This closed the gap that `update-meta` re-processes the whole file, supports only FILE documents and would have downgraded `source_type` to legacy `file`.
- Added `scripts/backfill-rag-metadata.mjs` (`npm run rag:backfill:metadata`), dry-run by default, `--apply` / `--limit` / `--json` options. Patches are additive only; existing values are never overwritten. Script is idempotent and safe to re-run after interruption.
- Backfill rules applied:
  - R1: `journal_article` without `collection_id` -> `collection_id = sotsiaaltoo_articles` (636 documents).
  - R2: `kov_services` document without `content_hash` -> identity `stableHash` with the same sha256 convention as `kovMetadataUpgradeLib.mjs` (4931 documents; 20 in the verified trial apply, 4911 in the full run).
- `tests/scripts/backfillRagMetadata.test.js`: 8 unit tests for the patch rules, report findings and base-URL normalization.

Corpus state before -> after (live `/documents` scan, 5655 documents):

- missing `collection_id`: 636 -> 0 (`sotsiaaltoo_articles` now has 638 documents).
- missing `content_hash`: 4938 -> 7 (the 7 remaining are non-`kov_services` collections that were deliberately out of scope).
- RAG service health unchanged: 5655 documents, 27393 vectors, search healthy; verified registry + chunk metadata + untouched neighbor fields on a patched document.

Deliberately not auto-patched (report-only, needs curation): 7 missing `authority`, 33 `source_status = unknown`, 1 missing `last_checked`, 2 `sotsiaaltoo_articles` without a URL. `year` on KOV web pages and URLs for PDF-collection article parts were left alone on purpose.

Operational note: full apply was run detached on the server (`nohup ... &`), so SSH interruptions do not affect it; progress is logged every 100 patches.

### Overnight Work Package 2026-06-11 (A1 + B0 + A2 + C1)

Status: DONE / all four stages committed and pushed; no deploy, no prisma migrate (per explicit instruction)

- **A1 curated mini-backfill (commit 325c95ec):** all 43 report-only documents resolved with 41 patches, 0 failures. 33 `source_status=unknown` -> `active` (KOV canonical files confirm), 7 `authority` values (issuing body unambiguous: state/KOV/organization_official), 1 `last_checked` from ingest date, 2 Sotsiaaltöö article URLs verified on tai.ee. Verified: authority/last_checked/unknown-status gaps are now 0 corpus-wide. Backfill script gained a `--patch-file` mode for curated lists; the curated list is in `reports/rag-mini-backfill-2026-06-11.json`.
- **B0 EPIKoda eestkoste study ingest (commit 0dae4d4e):** knowledge-doc metadata created for the two `Andmebaasi/uuringud ja juhendid` study PDFs (full kokkuvõte with a 13-section index from the TOC + lühikokkuvõte), validated 3/3 ingest-ready, ingested to the server RAG (213 + 6 chunks), content_hash backfilled, search retrieval verified.
- **A2 golden eval v1 (commit bff68f97):** `eval/golden-rag-v1.json` with 25 corpus-anchored cases (kov 4, legal 3, ajakiri 4, ingested PDFs 4, organizations 2, life/comparison 4, edge 4) + `npm run rag:eval:golden` runner + 9 unit tests. Live baseline `reports/golden-eval-baseline-2026-06-11.json`: **19/25 PASS**. Failures are findings, not noise:
  - `ajakiri_overview_omastehooldus`: overview mode used only 1 displayed source -> the V2.8 diversity question is now measurable;
  - `pdf_tarkvanem_tooleht`: worksheet material not retrieved at all (mode default, 0 sources);
  - `edge_inflected_tugiisikuteenusel`: inflected service name + fee question got no retrieval;
  - `edge_crisis`: "Ma ei jaksa enam elada" did not set `isCrisis` -> crisis regex needs a safety review;
  - `edge_followup_paragraph`: paragraph follow-up with history reused no sources (verify eval history payload shape first);
  - `kov_harku_sotsiaaltransport`: answer wording check may simply be too strict (5 correct sources displayed).
- **C1 graph-lite phase 1 (commit d01c3552):** Prisma models `RagEntity`/`RagRelation`/`RagChunkEntity` + enums (deliberately NO migration file: creating one would auto-apply on the next `prisma migrate deploy`; activation is a separate approved step). `lib/rag/graph/graphSchema.js` defines the vocabulary, allowed (from, relation, to) triples, mandatory evidence on every relation, and forces risk relations to NEEDS_REVIEW. `lib/rag/graph/kovGraphBuilder.js` builds deterministically from KOV canonical bundles; free-text fields are not turned into entities. `npm run rag:graph:plan` over 78 KOV bundles produced 4046 entities and 9385 evidence-carrying relations with 185 data-quality warnings (dangling relatedForms/relatedContacts references — useful KOV data findings). Plan JSON (7.9 MB) is regenerable and not committed.
- Final broad regression incl. new suites: **280/280**; `npm run build` green with the schema change.

### Graph-lite Track C Complete + Live 2026-06-12/13 (C1 activation + C2 + matcher)

Status: DONE / deployed / `RAG_GRAPH_CHANNEL_ENABLED=1` ON in production

- **C1 activation:** prisma migration applied, graph persisted in Postgres (4046 entities / 9385 relations).
- **C2 graph retrieval channel (commits fa152401 → 70b68d3e, f28911df):** the channel matches question entities and 1-hop-traverses `RagRelation` to produce extra retrieval query anchors — never answer text, never bypasses attribution. Two design refinements after the first eval comparison (graph-on 28/30 vs off 30/30, where graph queries diluted comparison/legal balance):
  - **Mode-gate:** excluded `comparison`/`legal_exact`/`explicit_paragraph`/`overview_synthesis`/`national_source_lookup`/`source_lookup`/`temporal` — modes with purpose-built query plans that graph expansion measurably dilutes.
  - **Separate tagged pass + quota:** graph queries run as their own `searchRagQueries` pass (not mixed into native queries), so native per-query depth is structurally untouched. `selectGraphChannelSupplement` keeps only documents native retrieval missed (native wins via `ragMatchKey` dedupe), marks them `graph_channel_origin`/`retrieval_channel_graph`, and caps to `GRAPH_CHANNEL_MAX_DISPLAYED` (default 3, env `RAG_GRAPH_CHANNEL_MAX_SLOTS`). `graphChannelSearchTopK` sizes the separate pass budget. Trace: `query_plan.graph_channel.added_candidate_count`.
- **Municipality matcher fix (commit 5c071fec):** people ask "kas Kuusalus on koduteenus?", not "Kuusalu vallas". `municipalityStem` matches the name minus trailing vald/linn with Estonian case-ending tolerance (tighter suffix window for short stems so `rae` ≠ `raekoja`). `scopeMatchesToMunicipalities` scopes per-municipality `kov_item:*` entities to the municipality named in the question (via matched MUNICIPALITY entity) or carried by the conversation — with no municipality context they are dropped rather than linked to an alphabetical pick. Matching is uncapped → scoped → then capped so the right municipality is not crowded out by a same-name service across 78 bundles. Live probe confirmed `"Kas Kuusalus on koduteenus?"` → `municipality:kuusalu_vald` + its koduteenus (previously Alutaguse/Anija by alphabet).
- **Eval parity:** golden eval re-run after each change — graph-off 37/37 and graph-on 37/37 (`RAG_EVAL_GRAPH_TEST=1` override; reports `golden-eval-graph{off,on}-2026-06-13.json`). The activation gate (graph-on must not regress) is met.
- **Flag enabled (deploy 9c2d6e9f, commit ee6ac2c7):** `RAG_GRAPH_CHANNEL_ENABLED=1` set in `/etc/sotsiaalai/frontend.env` + service restart. Live probe WITHOUT the test override confirms `graph_channel` fires in the production trace. Rollback = env `=0` + restart (code stays, channel sleeps).
- **Corpus growth alongside (track B):** B1 high 32 PDFs + B2 medium 129 PDFs ingested; embedding sub-batching fix (`rag-service/main.py`) re-ingested 6 large reports that previously hit BadRequest. DB 5824 docs / 50410 vectors.

## Current Next Steps

The full forward plan lives in `docs/internal/rag-roadmap.md` (quality track A, ingestion track B, architecture track C). As of 2026-06-13 A1/A2, B0–B2 and the whole architecture track C (C1 activation + C2 channel, flag ON in production) are DONE; the original 6 golden-eval baseline failures were all closed (eval grew to 37/37). Remaining candidates:

1. **0-source fix (next genuine item):** a general topic question with no source hint (e.g. "Mis on integreeritud teenused?") stays in default mode and displays 0 sources even though the answer comes from RAG. Same class as the V2.8 diversity question — make the mode/source-display decision recognize topic questions that RAG actually answered.
2. **B3** journal articles from the master list (11) via the existing `rag:ingest:ajakiri` pipeline; **B4** organization-harvest automation (60 orgs) — the large remaining ingest item.
3. **Optional / future:** B5 HTML/theme pages, A3 diversity tuning (only if eval shows narrow corpus use), C3 LLM-planner experiment, C4 graph-lite phase 2 (LLM extraction with review).
4. **Graph polish:** per-source UI marking of graph origin (marker currently dies at `groupMatches`, trace-only), same-stem municipality dedupe (rare), the 185 KOV dangling-reference warnings, `needs_review` dead-link URL fixes, OCR path for image brochures.

`master_sources_final.json` was restored from git history on 2026-06-11 (323 sources, 180 PDF ingest candidates, 39 high priority) after being accidentally deleted in commit 8a4c767b.

Guardrails:

- Keep replacements incremental; do not rewrite all attribution/ranking source-type logic in one patch.
- Keep legal exact and KOV/SourcePackage regressions protected before replacing route-critical source logic.
- Do not change ingest metadata values or rename stored `source_type` / `collection_id` values as part of V2.5C.
- V2.4B only if live EvidencePackage tests show answer-contract gaps.
- Do not add LLM planner calls until deterministic planner contracts and trace are stable.

## Next Window Handoff Task

The validation, metadata-backfill, golden-eval and graph-lite milestones are all closed (2026-06-10 → 06-13). Graph-lite track C is live in production. The canonical forward handoff now lives in `docs/internal/rag-roadmap.md` "JÄTKA SIIT".

Next task: the **0-source fix**. A general topic question with no source hint ("Mis on integreeritud teenused?") falls into default mode and shows 0 sources even though the answer is RAG-derived. Investigate the mode/source-display decision in `lib/chat/retrievalContextAssembler.js`, get a baseline (probe + a couple of golden-eval cases of this class), make a targeted change behind the existing patterns, and re-run the golden eval for parity. Keep the cookie-based smoke + eval workflow (`SOTSIAALAI_SMOKE_COOKIE` from the browser).

## Previous V2.4A Live Smoke Prompt List

1. After deploy/restart, run a server smoke for V2.4A EvidencePackage trace and answer guidance:
   - `Millised organisatsioonid või materjalid aitavad puudega inimest?`
   - `Mis materjale on laste vaimse tervise kohta koolis?`
   - `Mida Astangu Keskus pakub?`
   - `Mul pole raha üüri ja toidu jaoks, mida teha?`
   - `Ema ei saa enam üksi kodus hakkama, kuhu pöörduda?`
   - `Mul on puudega laps, kuhu pöörduda?`
   - `Kuidas eristada koduteenust ja isikliku abistaja teenust?`
   - `Mis vahe on koduteenusel ja tugiisikuteenusel?`
2. Continue V2 incrementally:
   - V2.4B: tighten EvidencePackage answer contracts only if live tests show gaps.
   - V2.5A: source metadata taxonomy audit.
   - V2.5B: central source-layer helpers in `sourceMetadata.js`.
   - V2.5C: gradually replace duplicated runtime source-type logic.
3. Keep KOV/RT/SourcePackage/legal exact regressions protected before expanding planner authority.
4. Do not add LLM planner calls until deterministic planner contracts and trace are stable.

## Current Runtime Flow

Approximate runtime flow:

```text
requestBootstrap
  -> role, auth, subscription, crisis, language, history, workflow state

workflow / mode layer
  -> help workflow?
  -> document workflow?
  -> mode selection?

retrievalContextAssembler
  -> should RAG run?
  -> query plan
  -> legal/KOV/source/thematic route
  -> retrieval orchestration

retrievalOrchestrator
  -> query variants
  -> recent-source anchors
  -> hybrid retrievers
  -> multi-query search

ragContext
  -> normalize matches
  -> group matches
  -> rank/diversify
  -> render RAG_CONTEXT

evidencePackage
  -> summarize already selected non-KOV evidence
  -> source layer mix
  -> coverage warnings
  -> answer guidance

sourcePackages / packageAwareContext / sectionAttribution
  -> runtime SourcePackage
  -> package-aware context
  -> section-level attribution summary

promptBuilder / openaiRuntime
  -> system prompt
  -> RAG_CONTEXT
  -> grounding/risk instructions
  -> model answer

mainResponseHandler / sourceAttribution
  -> answer source attribution
  -> displayed sources
  -> rag_trace
  -> persistence
  -> final response
```

## Main Architectural Findings

### What Is Strong

- Hybrid retrieval exists. The runtime can use `dense`, `bm25`, `title_match` and `exact_phrase`.
- Displayed sources are not raw retrieved sources. They are filtered through `sourceAttribution.js`.
- SourcePackage is part of the answer context, not only an admin artifact.
- Section-level attribution exists for package-aware and high-risk answers.
- Legal exact is separated from SourcePackage attribution.
- RAG trace includes source layers, query plan, SourcePackage data, attribution decisions and displayed-source IDs.
- `lib/rag/sourceQualityMetrics.js` can already evaluate displayed-source contract violations and wrong municipality leakage.

### What Is Weak

- `questionPlanner.js` now exists as a deterministic first-class planner skeleton.
- `retrievalStrategySelector.js` maps planner modes to retrieval, selection and query-order strategy.
- `overview_synthesis` is now a distinct V1 mode with document-diversity selection and trace metrics.
- Multi-source synthesis now has a V1 quality guard for distinct selected documents when enough relevant documents exist.
- `resource_discovery`, `life_situation_guidance` and `comparison` are trace-visible and have initial V2.1-V2.3 retrieval/attribution support plus a V2.4A EvidencePackage skeleton.
- Source attribution can hide useful sources if evidence text or metadata is incomplete.
- Runtime mojibake cleanup was completed in V1.4; this audit document still contains some older captured mojibake examples and should be cleaned separately if needed.
- Some modules are too large and combine planning, retrieval, selection, tracing and context construction.

### Most Important Next Fix

Do not immediately expand EvidencePackage into a broad rewrite. V2.5A shows that source-layer semantics are now the main shared contract risk.

- Run `npm run rag:check:v24a-live-trace` on the server to confirm persisted V2.4A trace behavior.
- Implement V2.5B central source-layer helpers/normalizers with legacy alias support.
- Replace duplicated source-type/source-layer logic gradually after the helpers exist.
- Keep `legal_exact` and KOV/SourcePackage routes outside the EvidencePackage path unless there is a separate explicit design change.

## lib/chat Audit

### Core RAG Routing and Planning

| File | Role | Rating | Notes |
| --- | --- | --- | --- |
| `questionPlanner.js` | Deterministic first-class planner skeleton for role, mode, topics, source-layer preferences, retrieval strategy and answer contract. | B | Added in V2.1 and expanded in V2.2/V2.3. Handles `resource_discovery`, `life_situation_guidance`, `comparison`, legal/KOV/overview/document-summary routing signals. Still deterministic and intentionally narrower than the future full planner. |
| `retrievalStrategySelector.js` | Maps planner mode plus route overrides to retrieval strategy, selection strategy, query order and source-layer filter mode. | B | Added in V2.3. Keeps legal/KOV/source lookup overrides stronger than planner modes and gives `resource_discovery`, `life_situation_guidance` and `comparison` mode-specific retrieval behavior. |
| `evidencePackage.js` | Builds a structured non-KOV EvidencePackage from already selected context. | B | Added in V2.4A. Covers `overview_synthesis`, `comparison`, `resource_discovery`, `life_situation_guidance` and broad/thematic multi-source answers. It is trace/answer-guidance only; it does not change retrieval, selection, legal exact, SourcePackage, reranking or claim checking. |
| `sourceNeed.js` | Decides whether a turn needs external/RAG sources. | B | Improved so substantive user text triggers RAG by default. Still regex-heavy. Should keep shrinking into a gate/helper as `questionPlanner.js` becomes more authoritative. |
| `queryPlanner.js` | Builds RAG query plan: mode, filters, topK, selection strategy and trace summary. | B/C | Important and functional. It handles legal, temporal, municipality, source lookup, overview, resource discovery, life-situation and comparison modes. It now consumes planner output and retrieval-strategy selection, but remains too broad and should keep shedding planner responsibilities. |
| `retrievalOrchestrator.js` | Builds retrieval queries, recent-source anchors, thematic expansions and multi-query search. | B | Hybrid retrieval and partial failure handling are useful. Exact-name query expansion is intentionally deactivated so broad RAG quality does not depend on rare named anchors. Risk: thematic expansion can become hand-tuned by topic. Needs a cleaner document discovery layer. |
| `retrievalContextAssembler.js` | Main RAG assembly layer. Runs planning, retrieval, selection, SourcePackage, EvidencePackage, risk policy and metadata assembly. | C | Functional but overloaded. This is the central integration point and the largest refactor candidate. V2.4A now delegates non-KOV evidence packaging to `evidencePackage.js`; more planner/source package/evidence/trace delegation should continue gradually. |
| `retrievalPlanning.js` | Temporal/year retrieval planning and topic hints. | B | Useful helper. Not the main bottleneck. |
| `queryAnchors.js` | Extracts exact entity/name anchors such as `OTT`, `Woebot`, `Wysa`. | B | Optional helper only. It is deactivated for RAG gating and retrieval query expansion, and remains useful only as a source-attribution guard for rare exact-name questions. Do not build V1/V2 quality around this file. |

### Context Selection and Rendering

| File | Role | Rating | Notes |
| --- | --- | --- | --- |
| `ragContext.js` | Normalizes matches, groups them, ranks/diversifies them and renders `RAG_CONTEXT`. | B/C | Very important. It now has MMR, multi-source selection and `selectOverviewSynthesisGroups()` for document-level overview diversity. Remaining work: expose/consume a future EvidencePackage cleanly. |
| `promptBuilder.js` | Builds model input, system prompt, `RAG_CONTEXT`, grounding messages and output token settings. | B | Good structure. Overview/resource/life-situation/comparison instructions now need to stay aligned with planner answer contracts and future EvidencePackage warnings. |
| `systemPrompts/et.js` | Estonian system prompt. | B | Good evidence discipline. Can make answers cautious when retrieval is weak. Do not solve retrieval failures by weakening this prompt. |
| `systemPrompts/en.js` | English system prompt. | B | Should stay aligned with Estonian prompt. |
| `systemPrompts/ru.js` | Russian system prompt. | B | Should stay aligned with Estonian prompt. |
| `systemPrompts/common.js` | Shared system prompt rendering helpers. | A | Small and clear. |
| `systemPrompts/index.js` | Language-specific prompt selector. | A | Small and clear. |

### SourcePackage and Attribution

| File | Role | Rating | Notes |
| --- | --- | --- | --- |
| `sourcePackages.js` | Builds runtime SourcePackages from selected/retrieved context and canonical KOV relation files. | B/C | Core KOV package logic is useful and now supports forms, contacts and legal basis. Risk: historical special cases remain. Canonical fallback should be fully generic across all KOV bundles. |
| `packageAwareContext.js` | Converts SourcePackages into compact answer context. | A/B | Good V3.2 layer. It makes package structure visible to the model and exposes missing sections. |
| `sectionAttribution.js` | Builds V3.4A section-level attribution for SourcePackage/high-risk answers. | B | Good foundation. Not claim-level attribution and should not be treated as a full claim store. |
| `sourceAttribution.js` | Filters selected sources into displayed/answer sources. | B | Essential layer. Good legal, package-aware, overview/resource/life-situation/comparison branches. V1.1 added overview support; 2026-05-03 added organization identity/link handling and V2.3 added life-situation/comparison attribution support. Remaining risk: may hide correct sources if evidence text or metadata is incomplete. |
| `mainResponseHandler.js` | Runs OpenAI response handling, attribution, trace, SourcePackage persistence and final response assembly. | A/B | Strong final contract. Persistence failure is isolated. File is long and has stream/non-stream duplication, but conceptually sound. |

### Legal and Risk

| File | Role | Rating | Notes |
| --- | --- | --- | --- |
| `legalLookup.js` | Detects exact legal lookups and builds legal query entries. | A/B | Important and reasonably isolated. Must remain opt-out from SourcePackage section attribution. |
| `safety.js` | Crisis/greeting detection and simple grounding strength. | B | Small and useful. Crisis detection is regex-based and should not be considered comprehensive clinical/safety triage. |
| `guardrails.js` | Turn limit helpers. | A | Narrow and clear. |

### Request, Workflow and Response Plumbing

| File | Role | Rating | Notes |
| --- | --- | --- | --- |
| `requestBootstrap.js` | Auth, rate limit, role, language, subscription, crisis and workflow bootstrap. | B | Important and large. Works as route entry orchestration. Risk: workflow state can affect normal RAG turns. |
| `requestContext.js` | Municipality detection, document context, source request detection and chat IDs. | B/C | Useful but mixed responsibilities. Municipality and source-intent logic should eventually be owned by the planner. |
| `mainRouteRuntime.js` | Route helpers, error shape, orchestration metadata and missing municipality instruction. | B | Mostly clean support layer. |
| `modeSelection.js` | Mode selection workflow for RAG/help/document work. | C | Useful, but risky. A new substantive user question should be able to cancel or bypass a pending mode selection. |
| `workflowBranchHandlers.js` | Help/document workflow branch handlers. | C | Functional but broad. Keep separated from normal RAG path. |
| `workflowModeRouting.js` | Help workflow mode routing. | A/B | Small and clear. |
| `orchestrationPolicy.js` | Work modes, complexity and reasoning-depth policy. | B | Useful but not a full RAG planner. |
| `documentOrchestration.js` | Document workflow orchestration. | C | Very large and separate from core RAG. Should not absorb general RAG planning responsibilities. |
| `documentWorkflowState.js` | Document workflow state helpers. | A | Small and clear. |
| `documentWorkflowText.js` | Document workflow i18n wrapper. | A | Small and clear. |
| `responseFinalizer.js` | Final response persistence and response construction. | B | Good separation from main handler. |
| `openaiRuntime.js` | OpenAI call/stream wrapper. | B | Narrow enough. |
| `persistence.js` | Conversation persistence. | B | Clear role. |
| `logger.js` | Event logging wrapper. | B | Small. Depends on Prisma/log model. |
| `routeServerUtils.js` | Chat route auth and no-store utilities. | A/B | Clear support module. |
| `subscriptionGate.js` | Subscription bypass/gate logic. | A | Narrow. |
| `conversationRoles.js` | Conversation role normalization. | A | Narrow. |
| `messageMarkdown.js` | Assistant markdown block parsing. | A/B | Narrow utility. |
| `exportDocument.js` | PDF/Word export from text. | B | Separate feature, not central to RAG. |
| `analyzeFileConfig.js` | Upload file MIME/size helpers. | A | Narrow and clear. |
| `documentWorkflowText.js` | Document workflow labels. | A | Narrow and clear. |

## lib/rag Audit

| File | Role | Rating | Notes |
| --- | --- | --- | --- |
| `sourceMetadata.js` | Canonical RAG metadata contract, source types and validation. | A/B | Very important. Should remain the single source of truth for source types and readiness metadata. Runtime and ingest must not drift from this file. |
| `sourceFreshness.js` | Freshness policy and audit summaries. | B | Useful and detailed. Currently more audit/admin than runtime ranking. Later selection should use freshness more directly. |
| `riskPolicy.js` | Risk classification and source evidence strength. | B | Good evidence guard. `organization_profile` is now accepted as background evidence for low-risk organization profile answers. Regex-based risk classification is useful but not sufficient as final planner. |
| `sourcePackageSnapshots.js` | Persisted SourcePackage snapshot hash/versioning. | A/B | Strong V3.1/V3.3 layer. Keep tests around normalized duplicate identity and active version cleanup. |
| `sourceQualityMetrics.js` | Trace quality metrics: displayed/answer contract, wrong municipality, legal precision and overview source diversity. | A/B | Valuable observability layer. V1.5 now flags too-narrow overview selection and unallowed dominant-document cases. |
| `metadataBackfillPlan.js` | Metadata backfill planning. | B | Good migration/ops helper. Not runtime. |
| `ragServiceFreshnessFallback.js` | Fallback fetch of RAG service documents for freshness audit. | B | Useful operational fallback. |
| `legacyAjakiriCleanup.js` | Legacy Sotsiaaltöö/Ajakiri cleanup planning. | B | Useful cleanup helper. Not runtime. |

## Key Conflicts and Limitations

### 1. Planner Is Still Partly Fragmented

The deterministic `questionPlanner.js` and `retrievalStrategySelector.js` now exist, but some planner responsibilities still remain spread across:

- `sourceNeed.js`
- `queryPlanner.js`
- `retrievalOrchestrator.js`
- `retrievalContextAssembler.js`
- `ragContext.js`

This means the system can make a correct planner decision and still need downstream adapters to preserve that intention. Recent V2.3 hotfixes fixed this for `life_situation_guidance` and `comparison`, but the general architectural direction remains: planner output should gradually become the central contract, while route-specific legacy logic becomes thinner.

### 2. Evidence Packaging Is Now a Skeleton Outside SourcePackage

KOV service/benefit answers have SourcePackage. General overview, comparison, resource discovery, life-situation and broad/thematic answers now have a first V2.4A EvidencePackage skeleton.

This means selected context and displayed sources now also have a structured trace object that carries:

- selected documents and selected source summaries;
- source layer mix;
- evidence strength;
- missing coverage warnings;
- answer limitations;
- answer guidance.

This is still a skeleton. It does not yet enforce claim-level evidence, rerank sources or replace SourcePackage. The next V2.4 work should be driven by live/eval gaps, not by a broad rewrite.

### 3. Overview Questions Have V1 Guarantees But Still Need Eval Coverage

Questions like:

- "Millised on probleemid lastekaitses?"
- "Mis raskused on omastehooldajatel?"
- "Millised teemad korduvad sotsiaaltöö praktikas?"

should not default to one article or one document. V1.1 and V1.5 now provide:

- document-level discovery;
- 5-8 preferred source candidates where available;
- diversity pass plus depth pass;
- at least 3 distinct documents if at least 3 relevant documents exist;
- displayed sources from the sources actually used in the synthesis;
- trace metrics and quality warnings for low diversity or unallowed dominance.

Remaining work belongs mostly to golden evaluation and EvidencePackage, not another V1 overview selector rewrite.

### 4. Attribution Can Hide Good Sources

`sourceAttribution.js` is necessary because it prevents random retrieved sources from appearing in the source modal. But it can also hide useful sources if:

- source metadata lacks the relevant title/entity;
- `evidenceText` is missing;
- exact anchors are only present in chunk text but not in displayed source metadata;
- the query has many anchors and the source only partially matches them.

This is especially important for named systems like `Woebot`, `Wysa`, `Vivibot`, `XiaoE`, `OTT`, `STAR` and similar.

The 2026-05-03 Astangu fix closed one concrete instance of this class for organization profiles: organization identity metadata is now part of attribution matching, and `organization_profile` is accepted as low-risk background evidence. V2.3 also added life-situation and comparison attribution branches. The broader rule remains: every new source family must expose its identity fields to attribution, otherwise retrieval may select the right source while displayed sources stay empty.

### 5. SourcePackage Is Strong but KOV Fallback Should Be General

`sourcePackages.js` now supports a lot of correct KOV behavior:

- service description/application/eligibility;
- forms;
- contacts;
- legal basis;
- conservative fees/deadlines;
- journal articles cannot confirm current forms/contacts/legal basis.

But KOV canonical relation fallback still has historical special-case shape. It should become a generic resolver for all `KOV/<slug>/<slug>.json` and `<slug>.sources.json` bundles.

### 6. Encoding/Mojibake Artifacts Are Mostly Runtime-Cleaned

V1.4 cleaned the scanned runtime mojibake markers in `lib/chat` and `lib/rag`. Some older examples in this audit document still show mojibake because they were copied from historical logs/tests. That is documentation noise, not a current runtime blocker.

If cleaned, do it as a documentation/test-fixture cleanup patch, not as a RAG behavior change.

### 7. Workflow State Can Interfere With New Questions

`modeSelection.js` and workflow state are useful. V1.3 added bypass protection so a fresh substantive question should not remain trapped behind an old pending mode-selection state. Remaining risk is future workflow expansion reintroducing broad capture behavior.

## Recommended Next Patch

The next small, high-impact patch is V2.5B, not a broad EvidencePackage expansion.

1. Add central source-layer helpers/normalizers with legacy alias support.
2. Add tests that prove current values such as `organization_profile`, `journal_article`, `research_report`, `kov_service_info`, `kov_regulation`, `national_law`, `municipality_kov` and `riigiteataja_regulation` map consistently.
3. Keep stored metadata untouched; runtime should understand legacy and current values before any backfill or rename work.
4. Keep legal exact and KOV/SourcePackage routes stronger than general planner/source-layer preferences.
5. Use V2.4B only if live EvidencePackage tests show answer-contract gaps.

## Suggested Future Module Split

Longer term, split the current planner work into explicit modules:

```text
lib/chat/questionPlanner.js
  -> role, mode, topics, source layers, risk, source count, location need

lib/chat/retrievalStrategySelector.js
  -> converts question plan into retrieval channels, filters and topK

lib/chat/documentDiscovery.js
  -> document-level discovery and source diversity

lib/chat/evidencePackage.js
  -> non-KOV multi-source evidence package

lib/chat/sourceSelectionTrace.js
  -> trace reasons and source diversity metrics
```

This should be done gradually. The current system is functional enough to improve incrementally.

## Practical Interpretation

Current system quality:

- KOV package-aware answering: good and improving.
- Legal exact: good, but must be protected from planner changes.
- Displayed-source enforcement: good.
- Section attribution: good foundation.
- General thematic RAG: materially improved by V1.1/V1.5 and now has a V2.4A EvidencePackage skeleton, but still needs golden eval before it is considered stable at production scale.
- Resource discovery, life-situation guidance and comparison: initial V2.1-V2.3 deterministic planner paths are implemented and V2.4A now packages selected evidence for trace/answer guidance, but these modes still need broader live/eval coverage.
- PDF/future document ingest: metadata contract exists, but retrieval quality depends on document-level discovery, section titles, chunk metadata and source diversity.

The most important product-quality goal is:

> A broad or practical user question should trigger an auditable evidence-seeking plan, not a narrow nearest-chunk answer.

That is now partly implemented through V1/V2 planner work and the first V2.4A EvidencePackage skeleton. The next architecture step is to validate that evidence package against live/eval gaps, then harden source metadata contracts in V2.5.

## V1.1 Test Data And Manual Regression Checklist

STATUS: DONE / retained as manual regression checklist

Use the local data folders below when validating V1.1 and later RAG hardening work:

| Corpus | Path | Use |
| --- | --- | --- |
| KOV / RT / SourcePackage files | `C:\Users\rauds\Desktop\SotsiaalAI\KOV` | KOV service, benefit, regulation and SourcePackage regression checks. |
| Articles, studies and guides | `C:\Users\rauds\Desktop\SotsiaalAI\Andmebaasi` | `overview_synthesis`, methodology, practice and multi-source synthesis checks. |

### Corpus Boundary

Overview synthesis tests should primarily use the articles, studies and guidance corpus, not the KOV SourcePackage path.

KOV service or benefit regression tests should use the KOV folder and must confirm that V1.1 does not route concrete municipality-service questions into a generic overview mode.

Concrete rule:

> If a question mentions a specific municipality and a specific service or benefit, the system should prefer the KOV/SourcePackage path, not `overview_synthesis`.

### Manual Overview Synthesis Questions

Use these questions against the articles, studies and guides corpus:

1. "Millised on probleemid lastekaitses?"
2. "Anna ülevaade probleemidest lastekaitses."
3. "Mis raskused on omastehooldajatel?"
4. "Kuidas toetada puudega lapse peret?"
5. "Millised on peamised kitsaskohad sotsiaaltöös?"
6. "Millised teemad korduvad sotsiaaltöö praktikas?"

Expected behavior:

- query plan mode is `overview_synthesis`;
- selected context uses multiple distinct documents when multiple relevant documents exist;
- answer is a synthesis across sources, not a single article summary;
- displayed sources come from selected/answer sources;
- trace explains if source diversity was limited.

### Manual KOV / SourcePackage Regression Questions

Use these questions against the KOV corpus:

1. "Millised on Harku valla koduteenuse tingimused?"
2. "Kuidas taotleda Harku vallas sotsiaaltransporditeenust?"
3. "Millised vormid on seotud koduteenusega?"
4. "Mis kontaktile pöörduda sotsiaalteenuse küsimuses?"

Expected behavior:

- concrete KOV service/benefit questions do not become `overview_synthesis`;
- SourcePackage remains active where a package can be built;
- KOV web, KOV RT, forms and contacts remain separate evidence roles;
- missing forms, contacts, fees or deadlines are treated as gaps unless the package sources confirm them;
- legal exact and RT regression paths remain green.

### Automated Test Fallback

If local folders are not directly available in automated tests, use mock data for unit tests and keep the manual checklist above as a required smoke procedure.

Minimum automated coverage for V1.1:

1. Query planner mock test: broad topic question returns `mode = overview_synthesis`.
2. Specific document regression: "Tee kokkuvõte artiklist X" does not become `overview_synthesis`.
3. Source diversity selector: five candidate documents produce at least three selected document IDs.
4. Dominance test: one high-scoring document cannot dominate the selected context when other relevant documents exist.
5. Depth pass test: a strong document can contribute additional chunks after diversity is satisfied.
6. Limited diversity test: one or two relevant documents set `source_diversity_limited = true`.
7. KOV regression test: concrete municipality-service question keeps the KOV/SourcePackage path.
