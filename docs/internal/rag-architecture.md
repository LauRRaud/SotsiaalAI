# SotsiaalAI RAG Architecture And Roadmap

## Juhtpõhimõte

STATUS: active principle

SotsiaalAI RAG otsib laialt, filtreerib rangelt, koostab kontrollitud source package'i ja kuvab allikatena ainult need allikad, millele lõplik vastus sisuliselt toetub.

RAG pipeline peab eristama nelja kihti:

1. `retrieved candidates` - kõik otsinguga leitud võimalikud allikad.
2. `selected context sources` - allikad või paketid, mis saadetakse mudelile vastuse koostamiseks.
3. `answer sources` - allikad, millele lõplik vastus sisuliselt toetub.
4. `displayed sources` - kasutajale nähtavad allikad; peavad olema `answer sources` kontrollitud alamhulk või sama hulk.

Kasutajale nähtavad `Vastuste allikad` ei tohi olla kõik otsingukandidaadid ega kõik mudelile saadetud kontekstiallikad.
Kasutajale kuvatavad allikad ei tohi sisaldada allikaid, mida vastus ei kasutanud või mida server ei kinnitanud.

## Current State vs Target State

STATUS: active snapshot

| Area | Current | Target |
| --- | --- | --- |
| Source display | Uued RAG vastused kasutavad backendist tulnud `displayed_sources`; legal exact juhtumid on production smoke'iga kontrollitud; legacy `sources` jääb ainult vanade sõnumite ühilduvuseks | Täielik `displayed_sources` enforcement kõigis uutes RAG vastustes ja adminis nähtav display precision ning contract violation mõõdik |
| Retrieval | V2 kasutab dense + lightweight lexical kanaleid (`title_match`, `exact_phrase`, `bm25`) ning hybrid/RRF merge'i | Tugevam hübriidotsing koos metadata filtrite, full-text/BM25 indeksi ja vajadusel mudelipõhise reranking'uga |
| Attribution | `answer_source_ids`, `displayed_source_ids`, `attribution_decisions` ja legal attribution contract on kasutusel; legal exact puhul ei kuvata valet paragrahvi; `§999` / exact missing annab `insufficient_precise_legal_source_support` signaali; V3.4A section-level attribution on productionis kinnitatud package-aware ja high-risk vastustele | Claim-level attribution kõrge riskiga väidetele ning allikakonflikti põhjendatud lahendamine |
| Trace | `rag_trace` sisaldab `query_plan`'i, retrieval kanaleid, source kihte, `legalLookupPlan`'i, `selection_strategy`'t, riskitaset, legal exact signaale, runtime `source_packages` kokkuvõtet ning V3.4A `section_attribution` signaale; source-package ja attribution smoke kinnitavad trace kihi | Täisobservability koos source package'i, latency, tokenite ja kvaliteedimõõdikutega |
| KOV service model | KOV/RT andmebaasi katvus on laiendatud: kõik kohalikud omavalitsused ja nende Riigi Teataja failid on andmebaasis, erandina Tallinn; 10-KOV kontrollsample on eraldi auditeeritud SourcePackage kvaliteediproov | Runtime või persisted `SourcePackage` teenustele, vormidele, kontaktidele ja õiguslikule alusele ning kvaliteedimõõdikud kogu korpusele |
| Metadata | V2.5 canonical contract on kasutusel; KOV veebipaketid ja RT/legal kihid on andmebaasis kõigi KOV-ide kohta peale Tallinna; 10-KOV kontrollsample on valideeritud/auditeeritud; legacy storage jäi rollback'iks alles | Kõik korpusepered map'ivad samale source contract'ile; Tallinn, org/template/methodology korpuste readiness ja ingest tuleb veel eraldi teha |


Current-state update after V3.4A follow-up:

- KOV service model is now beyond the original runtime-only package summary: V3.0A runtime `SourcePackage`, V3.1 persisted snapshot, V3.2 package-aware answering and V3.4A section attribution are confirmed.
- The V3.4A follow-up added and production-verified conservative SourcePackage completeness mapping for `forms`, `contacts`, `legal_basis`, `fees` and `deadlines`, more precise Jogeva gap-report candidate diagnostics, a supplemental same-KOV `kov_regulation` lookup, and a Jogeva canonical relation fallback resolver for `relatedForms` / `relatedContacts`.
- The remaining target is fuller package coverage from ingest metadata and V3.4B claim-level attribution, not a retrieval engine replacement. V3.4B is not required to solve same-turn wrong-KOV source leakage; that is handled by strict municipality scoping and post-retrieval guardrails.
- KOV table rows above are superseded by the 2026-04-29 golden reingest and 10-KOV control batch state plus the 2026-05-02 coverage update below: server cleanup is complete, Harku and Jogeva gates are complete, the 10-KOV batch is ingested/audited as a quality control sample, and all KOV/RT source files are in the database except Tallinn.

### KOV Source Display Attribution Fix 2026-05-02

STATUS: implemented

The Viljandi source-icon regression was not a frontend rendering bug. The RAG trace had `retrieved: 59`, `selected: 5`, but `attribution: 0/5`; therefore the backend returned an empty `displayed_sources` list and the chat UI correctly had no `Vastuste allikad` icon to show.

Fix:

- `sourceAttribution.js` now includes KOV metadata (`municipality_name`, `canonical_item_id`, `item_type`, `resource_type`) in attribution matching.
- Estonian inflections used in KOV questions are normalized for attribution anchors, for example `vallas` -> `vald` and `koduteenust` / `koduteenuse` -> `koduteenus`.
- KOV service/benefit attribution receives the retrieval municipality context, so an Ihaste-style settlement alias can still display Tartu linn sources, while Viljandi valla questions do not display Viljandi linna or Anija valla service sources.
- KOV displayed-source URL handling now preserves service URL aliases through the backend and frontend. `url_canonical`, `urlCanonical`, `official_url`, `officialUrl` and `sourceUrl` are normalized into a clickable displayed-source URL instead of requiring only a literal `url` field.
- The Kuusalu/Alutaguse class of issues was therefore a source metadata/display contract bug, not a source modal bug: a backend-confirmed service source may be displayed only when attribution accepts it, but if the accepted source has a canonical or official URL alias, the UI must render `Ava allikas`.
- Package-aware displayed source merge now enriches an already-selected source with the matching `SourcePackage` URL when both have the same `source_id`; the package source must not be dropped as a duplicate if it is the only layer that carries the clickable service URL.
- If a KOV service page itself has `sections_present` signals for `forms` or `contacts`, the service page may fill those SourcePackage sections as `partial` evidence. This covers pages where the application block contains a form link or contact/email, while still reserving `strong` evidence for separate `application_form`, `web_form`, `pdf_form`, `official_contact` or `contact_page` sources.
- SourcePackage relation fallback is generic for local `KOV/<slug>/<slug>.json` and `<slug>.sources.json` bundles, so Alutaguse/Kuusalu/Parnu-style local canonical packages can resolve `relatedForms` and `relatedContacts` even when live retrieval metadata does not carry those relations.
- Package-aware answer context exposes confirmed section URLs, especially `forms` URLs, so an answer that mentions applying for a service can include the concrete application form link in the message body instead of leaving it only in the source modal.
- The UI contract remains unchanged: the source icon appears only when `displayed_sources` is non-empty. If retrieval finds context but attribution rejects all selected sources, the trace must show the hide reasons in `attribution_decisions`.
- If old RAG storage lacks any canonical/official URL metadata for a KOV service, the fix still requires reingesting or revalidating that KOV web bundle; the UI does not invent links.

V3.4B claim-level attribution is still useful for high-risk claim evidence, but it is not required for this source-icon class. This class is handled by municipality scoping plus answer-source attribution guardrails.

### KOV Admin / Metadata Update 2026-04-29

STATUS: implemented

- Admin KOV `RAG dokumendi seis` lookup for both web RAG and RT RAG now goes through server-side `app/api/admin/rag/document-status/[docId]/route.js`, not direct browser -> RAG service calls.
- The server-side status route builds authenticated RAG headers and includes `X-API-Key`, so refreshing admin KOV detail no longer causes unauthenticated `GET /documents/:docId -> 401` noise in RAG logs.
- `401` from RAG document status is now logged as a precise admin-side auth failure instead of collapsing into generic `api.common.server_error`.
- Generic KOV bundle ingest in `lib/admin/rag/kov/service.js` now derives document and chunk metadata from `<kov-slug>.meta.json` first, with fallback to sources/admin data.
- The normalized KOV metadata path now carries `municipality_id`, `municipality_name`, `municipality`, `municipality_slug`, `county`, `checked_at`, `last_checked`, `country`, `language`, `collection_id` and `jurisdiction_level`.
- This metadata fix is not Harku-specific; it is intended to work for Jõgeva, Harku and future KOV bundles that provide the canonical root fields in `meta.json`.

### KOV V2.5 SourcePackage Metadata Batch Upgrade 2026-04-29

STATUS: implemented / validation green / not yet ingested

Harku remains the reference bundle and is explicitly excluded from the batch upgrader. Existing KOV web bundles were upgraded as metadata/schema work only: no new web collection, no content rewrite, no new RT/legal_basis source injection, and no ingest.

Upgraded KOV bundles:

- `jogeva-vald`
- `antsla-vald`
- `anija-vald`
- `alutaguse-vald`
- `elva-vald`
- `haademeeste-vald`
- `haapsalu-linn`
- `hiiumaa-vald`
- `haljala-vald`

Added tooling:

```text
npm run kov:upgrade-metadata -- --slug <slug> --municipality <municipality_id> --county "<county>" --write
npm run kov:upgrade-metadata:batch -- --manifest config/kov-metadata-upgrade-manifest.json --dry-run
npm run kov:upgrade-metadata:batch -- --manifest config/kov-metadata-upgrade-manifest.json --write
npm run kov:validate-metadata -- --manifest config/kov-metadata-upgrade-manifest.json
```

The batch upgrade adds canonical source/item metadata such as `metadata_schema_version`, `source_id`, `document_id`, `canonical_item_id`, `source_type`, `resource_type`, `source_format`, `municipality_id`, `collection_id`, `jurisdiction_level`, `checked_at`, `last_checked`, `url_canonical`, `content_hash`, `sourcePackageReadiness`, and compatibility aliases such as `item_type` and `source_keys`.

Validation result:

- `9/9` manifest KOV bundles validate successfully.
- `harku-vald` unchanged check is green.
- Every upgraded bundle has `sourcePackageReadiness.ok = true`.
- Every upgraded bundle has `items_missing_source_keys = []`.
- `regulation_sources = 0` for this batch because RT/legal_basis sources are intentionally not added during web bundle metadata upgrade.

Backups are written before `--write` as `*.bak-<timestamp>` for `.sources.json`, `.json`, `.meta.json`, and `.rag.md`. The `rag.md` content is not rewritten by this metadata upgrade.

### KOV RAG Cleanup And Admin Workflow Reset 2026-04-29

STATUS: implemented / dry-run-first / no reingest

KOV cleanup now treats RAG state and app DB admin workflow state as separate layers. Deleting a KOV document from RAG service removes the retrievable document/chunks, but it does not by itself prove that the admin workflow row is no longer marked as ingested. Therefore `rag:cleanup:kov` plans and, with explicit confirmation, resets both layers.

Tooling:

```text
npm run rag:inventory:kov -- --json logs/kov-rag-inventory.json
npm run rag:cleanup:kov -- --manifest config/kov-reingest-cleanup-manifest.json --dry-run --json logs/cleanup-kov-rag-state-dry-run.json
npm run rag:cleanup:kov -- --manifest config/kov-reingest-cleanup-manifest.json --write --confirm-cleanup --json logs/cleanup-kov-rag-state-write.json
```

Safety rules:

- default mode is read-only dry-run;
- destructive cleanup requires both `--write` and `--confirm-cleanup`;
- `--write` without `--confirm-cleanup` aborts before planning/deleting;
- cleanup never deletes repository KOV source bundles or files under `KOV/`, `scripts/`, `config/`, or the knowledge-doc layer;
- cleanup does not perform reingest and does not implement V3.4B claim-level attribution.

Inventory now includes KOV admin workflow state per municipality when DB access is available:

- `adminStatus` from `MunicipalityKovAdmin.status`;
- `readyForIngest`;
- `ingestStatus`, `lastIngestedAt`, `lastIngestError`;
- `rtIngestStatus`, `rtLastIngestedAt`, `rtLastIngestError`;
- `ragDocId` / expected web docId;
- `rtRagDocId` / expected RT docId;
- RAG `/documents` existence signal for expected web and RT docIds;
- `staleAdminIngested` signal.

Cleanup dry-run now includes `admin_status_reset` for each scoped KOV, with `before`, `after`, `changes`, `will_update`, and `removes_top_level_ingested_status`. This makes stale admin UI states visible before any write.

Confirmed reset policy uses the actual Prisma enums:

- if the KOV source bundle exists and its metadata/sourcePackage readiness is OK, set `MunicipalityKovAdmin.status = READY_FOR_INGEST`;
- otherwise set `MunicipalityKovAdmin.status = NEEDS_REVIEW`;
- set `readyForIngest` according to source bundle readiness;
- set `ingestStatus = NOT_INGESTED`;
- clear `lastIngestedAt` and `lastIngestError`;
- set `rtIngestStatus = NOT_INGESTED`;
- clear `rtLastIngestedAt` and `rtLastIngestError`.

`ragDocId` and `rtRagDocId` are treated as deterministic expected ids (`kov-<slug>` and `kov-rt-<slug>`), not as proof that the document currently exists in RAG. The real ingest presence signal must come from `ingestStatus` plus authenticated `/documents/:docId` status lookup.

This fixes the admin UI inconsistency where the top-level KOV badge could still show `Ingested` after the underlying RAG document had been manually deleted, while the document status panel correctly showed `KOV: Pole ingestitud`.

### SourcePackage Review Queue Usability 2026-04-29

STATUS: implemented / build green / no reingest

SourcePackage review now behaves as an actionable work queue instead of a raw mass list of every missing section. The queue separates problems by operational severity:

- `blocker` - data contract or evidence integrity problems that must be fixed before the package can be trusted, such as missing source keys, wrong municipality signal, wrong collection id, invalid current evidence, or legal_basis present without RT/legal evidence.
- `review` - admin review needed, such as missing forms, contacts, or legal_basis when the relevant evidence layer exists but is not linked into the package.
- `info` - non-blocking completeness warnings, such as missing `fees` or `deadlines`, amount not published, or deadline not published.

Default SourcePackage review UI shows only active `blocker` and `review` rows. `info` warnings are hidden behind an explicit "show info/warnings" filter, and archived snapshots are hidden behind an explicit "show archived" filter.

Important queue policy:

- `fees` and `deadlines` missing by themselves do not create actionable pending review rows.
- Info-only packages can remain visible for audit with the info filter, but they do not inflate the critical pending count.
- `pending` means active package with at least one unaccepted `blocker` or `review` reason.
- `info warnings` are counted separately.
- `archived` is counted separately and hidden by default.
- If there are no visible active actionable rows, the UI shows: "Aktiivseid SourcePackage ulevaatuse ridu pole."

Each visible review reason now includes a repair hint rather than only a missing-section label:

- KOV detail link (`/admin/rag/kov?slug=<slug>`);
- canonical item id;
- sourceKeys/source ids;
- target field such as `relatedForms`, `relatedContacts`, `legalBasis`, `fees`, or `deadlines`;
- file-level repair hint such as `<slug>.json -> items[] -> id = ... -> relatedForms`.

Admin can mark specific acceptable gaps as accepted without changing source facts. This is stored as `SourcePackageSnapshotReviewEvent` metadata using the `accept_gap` action. Supported dispositions include:

- `not_published` - not published on KOV web;
- `not_applicable` - not applicable;
- `checked_missing_form` - checked, form is missing;
- `deadline_not_published` - checked, deadline is not published.

Accepted gaps are review metadata, not source truth. They do not modify `sourceMembership`, `sectionSummary`, KOV source JSON, RT/legal evidence, or RAG chunks. Recompute keeps accepted info-only gaps from returning as pending review rows.

Implemented files:

- `lib/admin/rag/sourcePackages/service.js` - severity calculation, actionable queue flags, accepted gap metadata, recompute behavior.
- `app/api/admin/rag/source-packages/[id]/review/route.js` - accepts `accept_gap` parameters.
- `components/admin/rag/RagAdminSourcePackagesScreen.jsx` - default queue filter, info/archive toggles, repair hints, accepted-gap actions.
- `tests/rag/sourcePackageAdminService.test.js` - regression tests for severity, info-only fees/deadlines, accepted gaps, and recompute.

This does not perform reingest, cleanup write, source-file mutation, or V3.4B claim-level attribution.

### KOV Golden Reingest And 10-KOV Batch 2026-04-29

STATUS: Harku completed / Jogeva gate completed / 10-KOV batch completed

Server KOV/RT runtime state was reset before the pilot:

- active KOV/RT RAG documents after cleanup: `0`;
- active `SourcePackageSnapshot` rows after cleanup: `0`;
- archived old Jogeva snapshots remained as archive: `62`;
- stale admin `INGESTED` states after cleanup: `0`;
- second cleanup dry-run after write had `0` actions;
- non-KOV corpora were not touched.

Harku is the first golden municipality. The web layer and RT/legal layer are intentionally separate:

- web docId: `kov-harku-vald`;
- RT docId: `kov-rt-harku-vald`;
- web collection: `kov_services`;
- RT collection: `kov_legal`;
- RT source type: `kov_regulation`;
- RT source format: `xml`;
- RT `legal_basis = true`;
- Harku web package does not contain RT/legal source rows.

Validation and ingest result:

- `npm run kov:validate-metadata -- --root KOV --slug harku-vald` is green;
- `npm run kov:validate-rt -- --root KOV --slug harku-vald` is green;
- `kov-harku-vald` exists in RAG with status `COMPLETED` and `59` chunks;
- `kov-rt-harku-vald` exists in RAG with status `COMPLETED` and `110` chunks;
- KOV inventory after ingest reports `kov_related_rag_document_count = 2`;
- stale admin ingested count is `0`.

SourcePackage smoke/auth blocker was fixed with a server-side CLI fallback in `scripts/smoke-rag-source-packages.mjs`. If no browser cookie or bearer token is configured, the smoke command no longer returns `skipped: missing_auth`; it builds and persists SourcePackages from the local KOV bundle plus RT manifest using server DB/RAG environment. The preflight output exposes only booleans:

- `auth_configured`;
- `cookie_present`;
- `bearer_present`;
- `internal_key_present`;
- `skip_reason`.

No cookie, bearer token, or internal key value is logged.

Confirmed Harku smoke command:

```text
npm run rag:smoke:source-packages -- --municipality harku_vald --slug harku-vald --answering --persist --attribution
```

Result:

- `skipped = false`;
- `mode = cli_sourcepackage_persist`;
- `package_count = 41`;
- active Harku `SourcePackageSnapshot` count = `41`;
- duplicate normalized canonical id count = `0`;
- `package_aware_answering_used = true`;
- `package_attribution_checked = true`.

Harku gap report after snapshot persistence:

- missing forms: `18`;
- missing contacts: `3`;
- missing legal_basis: `0`;
- missing fees: `41`;
- missing deadlines: `41`.

Fees and deadlines remain conservative info-level gaps unless stronger explicit evidence is mapped. This is expected and must not by itself create critical pending review state.

Jogeva was run as the second golden KOV after Harku:

- `npm run kov:validate-metadata -- --root KOV --slug jogeva-vald` is green;
- `npm run kov:validate-rt -- --root KOV --slug jogeva-vald` is green;
- web docId `kov-jogeva-vald` exists in RAG with status `COMPLETED` and `35` chunks;
- RT docId `kov-rt-jogeva-vald` exists in RAG with status `COMPLETED` and `21` chunks;
- source-package smoke result: `skipped = false`, `mode = cli_sourcepackage_persist`, `package_count = 37`;
- active Jogeva `SourcePackageSnapshot` count = `37`;
- archived old Jogeva snapshots remain archived = `62`;
- duplicate normalized canonical id count = `0`.

Jogeva gap report after snapshot persistence:

- missing forms: `19`;
- missing contacts: `11`;
- missing legal_basis: `0`;
- missing fees: `37`;
- missing deadlines: `37`.

The remaining 8 local KOV bundles were then validated, ingested and audited as a controlled 10-KOV batch together with Harku and Jogeva. Web and RT/legal layers remain separate: web docIds use `kov-<slug>`, RT docIds use `kov-rt-<slug>`, web collection is `kov_services`, RT collection is `kov_legal`, and RT has `source_type = "kov_regulation"` and `legal_basis = true`.

10-KOV inventory after batch:

- KOV-related RAG document rows: `529` (bundle docs plus item docs plus RT docs);
- 10/10 expected web docs exist;
- 10/10 expected RT docs exist;
- active `SourcePackageSnapshot` count: `376`;
- archived `SourcePackageSnapshot` count: `62`;
- active duplicate normalized canonical id count: `0`;
- stale admin `INGESTED` count: `0`;
- KOV runtime file cleanup candidates: `0`.

Per-KOV batch summary:

| KOV | Web chunks | RT chunks | Active packages | Missing forms | Missing contacts | Missing legal_basis | Missing fees | Missing deadlines |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `harku-vald` | 59 | 110 | 41 | 18 | 3 | 0 | 41 | 41 |
| `jogeva-vald` | 35 | 21 | 37 | 19 | 11 | 0 | 37 | 37 |
| `alutaguse-vald` | 50 | 63 | 37 | 12 | 6 | 0 | 37 | 37 |
| `anija-vald` | 33 | 97 | 35 | 20 | 0 | 0 | 35 | 35 |
| `antsla-vald` | 50 | 60 | 40 | 40 | 10 | 0 | 40 | 40 |
| `elva-vald` | 44 | 120 | 31 | 7 | 2 | 0 | 31 | 31 |
| `haademeeste-vald` | 30 | 56 | 37 | 24 | 1 | 0 | 37 | 37 |
| `haapsalu-linn` | 33 | 23 | 51 | 42 | 39 | 51 | 51 | 51 |
| `haljala-vald` | 25 | 1 | 34 | 20 | 10 | 0 | 34 | 34 |
| `hiiumaa-vald` | 35 | 16 | 33 | 19 | 0 | 0 | 33 | 33 |

Known batch notes:

- `haapsalu-linn` RT document exists, but SourcePackage legal_basis linking is still missing for its packages. This is reported as a real gap instead of being papered over.
- `haljala-vald` RT XML validated from the manifest but had empty `<sisu/>`; RT ingest now creates a single metadata-only chunk for the act reference/URL. That chunk confirms the RT act metadata, not paragraph-level legal content.
- Anija contact items exposed an ingest metadata edge case where an item had `name` but no `title`; KOV item ingest now derives a safe title from `title`, `name`, `label`, `heading`, or `id`.
- Forms/contacts audit now tolerates `null` relation arrays and treats them as empty arrays.
- Smoke was run successfully for all 8 post-Jogeva batch KOVs; at minimum the required Haljala and Elva smoke checks are confirmed.

Harku RT chat lookup follow-up:

- Harku RT document existence was confirmed in admin and RAG as `kov-rt-harku-vald`.
- The user-facing question `kas Harku valla riigiteataja on sul?` initially returned insufficient evidence because the chat legal lookup still searched the old KOV RT collection and added an over-specific synthetic `act_title = "Harku vald kord"` filter.
- KOV municipality RT source availability questions now route to `legal_source_lookup`, target `collection_id = "kov_legal"` with `source_type = "kov_regulation"` and `municipality_id`, and do not add a synthetic `act_title` filter.
- `kov_legal` is treated as a municipality legal layer in chat context grouping/ranking alongside legacy `kov_regulations`.
- The content question `mis oigusakti alusel Harku vald sotsiaalhoolekandelist abi annab?` already retrieved the correct RT evidence; this fix closes the metadata/existence lookup path as well.

Important limits:

- V3.4B claim-level attribution has not been started. It is still useful for claim-level evidence on high-risk answers, but it is no longer a blocker for the Viljandi/Häädemeeste-Anija-Alutaguse wrong-KOV source class.
- V3.5 regression system and V3.6 full rollout are not in scope for this completed step.
- The 10 local KOV batch remains the audited control sample. Broader KOV/RT source coverage is now in the database except Tallinn, but the whole corpus still needs quality hardening.
- Fees/deadlines are intentionally conservative info-level gaps unless explicit evidence is mapped.

### KOV / RT Database Coverage Update 2026-05-02

STATUS: source coverage loaded / Tallinn exception / system hardening continues

Current coverage statement:

- All local government KOV source files are in the RAG database except Tallinn.
- The corresponding KOV Riigi Teataja / RT files are in the RAG database except Tallinn.
- Tallinn is an explicit exception and must be treated as a separate ingest/readiness track before claiming full national KOV coverage.
- The 10-KOV batch remains the audited control sample for quality, SourcePackage behavior and smoke checks; it is no longer the full extent of database coverage.

Important interpretation:

- "In the database" means the source layer is present/retrievable. It does not mean every answer is already production-perfect.
- The system still needs development around KOV disambiguation, hard `municipality_id` scoping, wrong-municipality guardrails, SourcePackage completeness, forms/contacts/legal_basis joining, displayed source precision, and larger regression coverage.
- V3.4B claim-level attribution remains useful for high-risk claim evidence, but database coverage and KOV scope correctness must be maintained independently in the retrieval/planner/filter layers.
- V3.5/V3.6 work should now focus on proving quality across the broader all-KOV-except-Tallinn corpus, not only on adding more source files.

### KOV Admin Coverage / Workflow Drift 2026-05-02

STATUS: false invalid-file signal fixed / RAG-status reconciliation still needed

Admin KOV vaade ei tohi tõlgendada 10-KOV kontrollsample'it kogu andmebaasi katvuse piirina. Pärast laiema KOV/RT korpuse laadimist näitas admin paneel uute KOV-ide puhul massiliselt `Sisaldab vigaseid faile`, `Vajavad toimetamist`, `KOV: Pole ingestitud` ja `RT: Pole ingestitud`, kuigi source layer on andmebaasis olemas kõigi KOV-ide kohta peale Tallinna.

Root cause:

- admini `sources.json` validaator oli jäänud vanale kujule `key/type`, kuid V2.5 SourcePackage failid kasutavad `source_id/source_type`;
- uued KOV source failid kasutavad ka kohalikku allikataxonomiat, näiteks `kov_homepage`, `kov_service_page`, `kov_benefit_page`, `kov_contact_page`, `kov_resource_page`, `docx_form` ja `file_attachment`; neid ei tohi failipaki olemasolu kontrollis tagasi lükata ainult seetõttu, et need ei ole lõplikud chunk-level RAG `source_type` väärtused;
- `MunicipalityKovAdmin.status`, `readyForIngest`, `ingestStatus` ja `rtIngestStatus` võivad olla admin workflow read-only vaates vanad isegi siis, kui repo source bundle ja RT manifest on olemas või RAG ingest on tehtud eraldi CLI-ga;
- admin peab eristama kolme signaali: source package on olemas/valid, admin workflow on üle vaadatud/ready, ja RAG dokument eksisteerib retrievable andmebaasis.

Implemented admin behavior:

- KOV admin validaator aktsepteerib nüüd V2.5 `source_id/source_type` kuju ning legacy `key/type` kuju;
- repo fallback failid (`KOV/<slug>/<slug>.sources.json`, `.json`, `.meta.json`, `.rag.md`) ja RT manifesti kaudu leitud XML saavad admin serialiseerimisel arvestada source bundle'i valmisolekuks;
- kui repo/manifesti source bundle on valid, ei käsitleta rida vaikimisi `NOT_STARTED`/`NEEDS_REVIEW` massveana ainult puuduva vana admin toggle'i tõttu;
- KPI silt on `KOV failid valid`, mitte `Admin failid valid`, sest allikaks võib olla ka repo fallback, mitte ainult käsitsi admini upload.

Remaining admin work:

- lisada või käivitada RAG document reconciliation, mis kontrollib expected `kov-<slug>` ja `kov-rt-<slug>` olemasolu RAG `/documents` põhjal ning sünkroonib `ingestStatus` / `rtIngestStatus` ainult tõendatud dokumentide alusel;
- Tallinn peab jääma eraldi erandiks, mitte paistma sama kvaliteedi- või ingest-valmidusega nagu all-KOV-except-Tallinn korpus;
- admin loendurid peavad jätkuvalt eristama `source files valid`, `ready for ingest`, `RAG ingested`, `SourcePackage audited` ja `needs manual review`.

### KOV Scope Guardrail Follow-up 2026-05-02

STATUS: implemented / targeted regression green

The Viljandi chat regression exposed a separate scoping failure from V3.4B claim attribution. The user asked whether Viljandi valla social services are in the database, but the answer displayed Häädemeeste, Anija and Alutaguse sources. Those municipalities are unrelated to Viljandi vald/linn and must not be shown as evidence for a Viljandi-scoped question.

Root cause:

- municipality detection matched the shared base name `Viljandi` too broadly and could keep both `Viljandi vald` and `Viljandi linn` in scope;
- the query planner used `municipality_name` when a stable `municipality_id` should have been available;
- a short follow-up such as `jah` did not reliably carry the previous KOV/service-list intent;
- retrieval did not have a final same-KOV post-filter before grouping and source display.

Implemented behavior:

- `detectMentionedMunicipalitiesFromUserText` now returns stable `id` / `municipalityId` values derived from slug, e.g. `viljandi_vald` and `viljandi_linn`;
- typed municipality forms such as `Viljandi valla`, `Viljandi valda` and `Viljandi linna` are matched to the correct KOV instead of falling back to the ambiguous base name;
- KOV-scoped RAG queries and filters prefer `municipality_id` over `municipality_name`;
- service/benefit follow-ups carry the KOV from recent history for affirmative turns such as `jah`;
- when the current message names a new KOV in a follow-up, the previous service/benefit list intent can still be reused with the new KOV;
- `filterMatchesToMunicipalities` removes wrong-municipality KOV service/legal matches after retrieval while preserving national/background matches where appropriate.

Expected user-facing behavior:

- `kas viljandi valla sotsiaalteenused on andmebaasis?` must scope to `viljandi_vald`;
- `aga viljandi linna?` must scope to `viljandi_linn`;
- Häädemeeste, Anija, Alutaguse or any other KOV source must not be displayed for a Viljandi scoped answer unless the user explicitly asks for comparison across municipalities.

Verification:

```text
TSX_TSCONFIG_PATH=jsconfig.json node --import tsx --test tests/chat/municipalityDetection.test.js tests/chat/queryPlanner.test.js
TSX_TSCONFIG_PATH=jsconfig.json node --import tsx --test tests/chat/ragContextRanking.test.js tests/chat/retrievalContextAssembler.test.js
npx eslint lib/help/municipalityData.js lib/chat/requestContext.js lib/chat/queryPlanner.js lib/chat/ragContext.js lib/chat/retrievalContextAssembler.js tests/chat/municipalityDetection.test.js tests/chat/queryPlanner.test.js tests/chat/ragContextRanking.test.js
```

Planning implication:

- V3.4B claim-level attribution is still a roadmap item for high-risk claim evidence, claim hashing, admin claim analytics and possible persisted claim store.
- V3.4B is not needed before closing this wrong-KOV leakage class; this class is covered by municipality disambiguation, hard `municipality_id` filters, post-retrieval same-KOV filtering and targeted regressions.

### Settlement / District To KOV Fallback 2026-05-02

STATUS: implemented for local alias fallback / external geocoder remains optional

The chat path must not require the user to know the municipality name when they provide a known settlement, village or district. The help/workflow layer already had location alias and optional geocoding helpers, but `detectMentionedMunicipalitiesFromUserText` only used official KOV names. This left questions such as `mis sotsiaalteenuseid ja toetusi Ihastes pakutakse?`, `ihaste` and `aga Kaberneeme?` on the default planner path with no `municipality_id`, zero selected context and a prompt asking for a municipality.

Implemented behavior:

- chat municipality detection now applies local `locationAliases` before official KOV-name matching;
- `Ihaste` / `Ihastes` resolves to `Tartu linn` (`tartu_linn`);
- `Kaberneeme` resolves to `Jõelähtme vald` (`joelahtme_vald`);
- alias-resolved municipalities use the same stable `municipalityId` contract as direct KOV mentions, so query planning can use `municipality_service_benefit_list` and hard `municipality_id` filters.

Remaining work:

- expand the local alias table from an authoritative settlement/asum dataset instead of adding aliases one by one;
- keep the external geocoder optional and bounded because chat latency must not depend on a slow third-party geocoding call;
- add analytics for `location_alias`, `geocoding`, `geocoding_unmapped` and ambiguous place fallback rates.

### V3.0A Implementation Update 2026-04-28

STATUS: implemented and smoke-tested

- Runtime `SourcePackage` builder on rakendatud `lib/chat/sourcePackages.js`.
- Selected context põhjal koostatakse ohutu `rag_trace.source_packages` summary.
- Builder rühmitab sama `canonical_item_id` + `municipality_id` järgi.
- `ragContext` kannab edasi `resource_type` ja `sections_present`.
- Unit/regression testid läbisid.
- Source-package smoke kinnitab päris Jõgeva KOV küsimusega `rag_trace.source_packages` olemasolu.
- V3.1 DB-write smoke kinnitab `SourcePackageSnapshot` persistence'i.


## Evolution Principle

STATUS: active principle

Süsteemi edasiarendamine ei tähenda, et praegune vana RAG pipeline peab jääma samaks. V1 eesmärk on vältida pimesi ümberkirjutamist, mitte lukustada olemasolevaid tehnilisi piire.

Legacy ühilduvus on üleminekuvahend:

- vanad vestlused ja olemasolevad allikad peavad jääma loetavaks;
- uusi kihte võib lisada adapterite või feature flag'ide taga;
- nõrgad või segased vanad vastutuspiirid võib refaktoreerida, kui uus data contract on selgem;
- vana `sources` loogika võib järk-järgult taanduda `displayed_sources`, `rag_trace` ja `attribution_decisions` kasuks;
- kui trace ja testid näitavad, et olemasolev retrieval, salvestus või UI allikaloogika on takistus, võib selle asendada, mitte ainult ümber pakkida.

Oluline põhimõte: vana süsteemi ei säilitata sellepärast, et see on olemas. Seda säilitatakse ainult nii kaua, kui see aitab turvaliselt üle minna kontrollitavamale ja usaldusväärsemale arhitektuurile.

## Evidence Policy

STATUS: active policy

Iga faktiväide peab võimaluse korral tuginema kontrollitud allikale. Kõrge riskiga väited, nagu õigus, toetus, summa, tähtaeg, vorm, kontakt, abikõlblikkus või kriisiolukorra juhis, vajavad tugevat tõendusastet.

Evidence strength:

- `strong` - ametlik, kehtiv, õige KOV-i või riikliku tasandi allikas, mis vastab küsimusele otseselt.
- `medium` - asjakohane ja autoriteetne allikas, kuid osaliselt kaudne või mittetäielik.
- `weak` - taustamaterjal, metoodiline käsitlus, artikkel või praktikanäide; sobib selgituseks, kuid mitte konkreetse õiguse, summa, tähtaja, vormi või kontakti kinnitamiseks.
- `insufficient` - allikas ei kinnita väidet piisavalt.

Kõrge riskiga väiteid ei tohi esitada kindla faktina, kui nende kohta puudub `strong` evidence. Sellisel juhul peab vastus ütlema, mida allikad kinnitavad, mida nad ei kinnita ja kust infot tuleks üle kontrollida.

Ajaloolist allikat, ajakirjaartiklit, praktikalugu või arvamust ei tohi kasutada tänase kehtiva õiguse, toetuse, vormi, tähtaja või kontakti tõendusena.

## Risk-Based RAG Policy

STATUS: active policy / partially implemented

Kõik kasutajaküsimused ei vaja sama ranget retrieval'i ja attribution'i taset.

- `low risk` - üldine selgitus, metoodiline taust, mõistete seletus.
- `medium risk` - KOV teenus, taotlemise sammud, vormid, kontaktid, praktiline juhendamine.
- `high risk` - õigus, toetus, summa, tähtaeg, abikõlblikkus, kehtivus, kriisiolukord.

Kõrge riskiga küsimuste puhul peab süsteem eelistama ametlikke ja kehtivaid allikaid ning andma kindla vastuse ainult siis, kui tõendus on piisav. Kui tõendus puudub, peab vastus kasutama insufficient evidence režiimi.

## Insufficient Evidence And Source Conflict Handling

STATUS: active policy / partially implemented

Kui süsteem ei leia piisavalt tugevat allikat, peab vastus eristama:

- mida allikad kinnitavad;
- mida allikad ei kinnita;
- milline info tuleb KOV-ist, õigusaktist või ametlikust allikast üle kontrollida.

Lõppkasutajale ei tohi allikapiirangut sõnastada sisemise otsingukonteksti kaudu. Vastus ei kasuta väljendeid nagu `nähtavas kontekstis`, `RAG kontekstis`, `kontekstis ei ole`, `selles vaates ei ole` või muid tehnilisi fraase, mis viitavad mudelile saadetud kontekstile.

Kui RAG/allikad ei anna piisavat kinnitust, kasutatakse loomulikku sõnastust, näiteks:

- "Praegu kasutatud allikad ei anna sellele piisavalt täpset vastust."
- "Ma ei saa seda nende allikate põhjal kindlalt kinnitada."
- "Leitud allikad puudutavad teemat, kuid ei kinnita seda detaili."
- "Ma ei leidnud praeguse otsinguga sellele piisavalt täpset allikavastet."

Õiguslike küsimuste puhul eelistada sõnastust:

- "Ma ei leidnud praeguse otsinguga sellele piisavalt täpset õiguslikku allikakinnitust."

Oluline: süsteem ei tohi väita, et midagi ei eksisteeri ainult seetõttu, et praegune otsing või RAG seda ei leidnud. Kui täpne allikas ei tulnud esile, peab vastus ütlema, et praeguse otsinguga ei leitud piisavat kinnitust.

Kui allikad on omavahel vastuolus, ei tohi vastus vastuolu ära siluda. Vastus peab nimetama vastuolu ja eelistama kõrgema autoriteediga, kehtivamat või konkreetsema intent'iga sobivat allikat. Näiteks õigusliku küsimuse puhul on kehtiv õigusakt tugevam kui artikkel; vormi küsimuse puhul võib ametlik vorm või e-teenuse link olla tugevam kui üldine teenuseleht.

## Freshness Policy

STATUS: active policy / partially implemented

Allika värskuse nõue sõltub allikatüübist.

- KOV kontaktid ja vormid vajavad regulaarset kontrolli ning vananenud `last_checked` peab olema adminis nähtav.
- KOV teenused ja toetused vajavad kehtivuse kontrolli, eriti kui vastus puudutab taotlemist, summat, tähtaega või tingimust.
- Õigusaktide puhul tuleb eelistada kehtivusinfoga ametlikku allikat.
- Artiklid, metoodika ja praktikalood võivad olla taustaks, kuid neid ei kasutata tänase kehtiva teenuseinfo tõendusena.

## KOV Disambiguation Policy

STATUS: active policy / partially implemented

KOV on hard filter ainult siis, kui kasutaja küsimus või tööruumi kontekst annab selle kõrge kindlusega.

Kui kasutaja viitab mitmele KOV-ile, näiteks elukoht on ühes ja viibimiskoht teises, peab süsteem vältima automaatset oletust. Sellisel juhul küsib süsteem täpsustust või annab tingimusliku vastuse, mis eristab KOV-e ja ütleb, millist infot tuleb üle kontrollida.

## Legal Exact Retrieval Policy

STATUS: active / implemented / production-smoked

- Kui kasutaja nimetab õigusakti ja konkreetse paragrahvi, muutub `paragraph_number` metadata hard filteriks.
- Semantiliselt sarnane säte ei tohi asendada otseselt küsitud paragrahvi.
- Näide: `SHS § 140?` peab kasutama `paragraph_number = "140"`; `§ 160` "Paragrahvi 140 rakendamine" võib olla debug-taseme retrieved kandidaat, aga ei tohi olla `selected context` ega `displayed source`.
- `explicit_paragraph` viide võidab alati teemaankrud ja vestluse ajaloo.
- `explicit_paragraph` tuvastus ei tohi sõltuda ainult `sourceLookupRequest` heuristikast; sisendkujud nagu `SHS § 140?`, `SHS §140`, `Sotsiaalhoolekande seadus § 140`, `Sotsiaalhoolekande seaduse § 140`, `SHS paragrahv 140` ja `Sotsiaalhoolekande seadus paragrahv 140` peavad minema legal exact rajale ka siis, kui muu lookup-heuristika oleks vaikimisi nõrk.
- `topic_to_paragraphs` režiimis ei hardcodeta paragrahve; otsing toimub akti canonical metadata ja teema-termide alusel.

Production smoke confirmation:

- SHS `§ 132` ja `§ 140` RAG-service direct exact paragraph filter läbib.
- Chat `SHS § 140?` kasutab `selection_strategy = legal_exact`.
- `selected_context_details` sisaldab ainult küsitud `paragraph_number` väärtust.
- `displayed_sources` ei ole tühi ja sisaldab ainult küsitud `paragraph_number` väärtust.
- History override ei vii tagasi vana teemaankru juurde.
- `SHS § 999?` ei asendu sarnase paragrahviga ja annab `insufficient_precise_legal_source_support = true`.

## V2.5 Pre-launch Canonical Hardening

STATUS: active implementation boundary

V2.5 on kohustuslik vahekiht enne V3.

V2.5 sisaldab:

- canonical metadata contract'i;
- RAG-service täielikke `where` filtreid;
- `legalLookupPlan` loogikat;
- legal exact retrieval selection'it;
- legal attribution contract'i;
- reingest readiness'i.

V3 `SourcePackage`'i ega claim-level attribution'it ei tohi ehitada segase legacy/canonical metadata peale.

## Pre-launch Canonical Reset Decision

STATUS: active implementation policy

- Kuna platvorm ei ole veel avalik, ei säilitata uut RAG-i ehitades vana ja uue metadata skeemi segadust.
- Legacy väljad on lubatud ainult sisendadapteris ja normalizeris.
- Uus ingest peab kirjutama canonical metadata väljad.
- Vajadusel tehakse backup + clean reingest, kuid ükski skript ei tohi production RAG storage'it automaatselt kustutada.

## V2.5 Clean Canonical Reingest

STATUS: completed for current available corpus / maintenance

2026-04-28 tehti kontrollitud clean canonical reingest töövoog:

- vana aktiivne RAG storage tõsteti legacy kausta rollback'i jaoks;
- uus `/var/lib/sotsiaalai-rag` loodi puhtalt;
- ingestiti SHS / national RT;
- ingestiti Jõgeva KOV RT;
- ingestiti Jõgeva KOV web/service;
- ingestiti ajakiri `Sotsiaaltöö`;
- legal exact smoke'id ja V2 metadata smoke'id läbisid.

Aktiivne corpus pärast reingest'i:

- `national_regulations`: 1
- `kov_regulations`: 1
- `kov_services`: 64
- `sotsiaaltoo_articles`: 638

Legacy storage:

- `/var/lib/sotsiaalai-rag.legacy.2026-04-28-0933` jäi alles rollback'i jaoks;
- seda ei kustutata enne, kui UI pärisküsimused ja täiendav smoke on kinnitanud uue storage'i stabiilsuse.

Known non-blocking recommended metadata:

- `kov_web`: `content_hash` recommended väli võib vajada hilisemat täiendust;
- `sotsiaaltoo_articles`: vanadel artiklitel võib `url_canonical` puududa, kui sisendis oli ainult `source_path` või PDF failinimi, mitte päris canonical URL;
- need ei ole required blockerid.

## ETAPP 8 Reingest Readiness

STATUS: completed / active tool

Readiness audit:

```text
npm run rag:reingest:readiness -- --root <INPUT_ROOT> --json logs/rag-reingest-readiness.json
```

Tõlgendus:

- `blocked > 0`: ära tee clean reingest'i enne parandust;
- `backfill_required > 0`: lubatud, kui normalizer/backfill suudab canonical väljad tuletada;
- `ready`: sisend on juba canonical või piisavalt täielik.

Kontrollitud tulemused:

- KOV root: `blocked = 0`, `backfill_required = 139`;
- ajakiri Sotsiaaltöö: `blocked = 0`, `backfill_required = 638`.

Runbook:

- detailne backup → clean storage → reingest → smoke → rollback juhis on failis `docs/internal/rag-clean-reingest-runbook.md`.

## P0 Known Defect: Legal Paragraph Filtering

STATUS: fixed / production-smoked

- `RAG-service /search where paragraph_number` peab päriselt filtreerima.
- `§ 140` filter ei tohi tagastada `§ 160`.
- ETAPP 1 parandas RAG-service filterikihi.
- ETAPP 3 ühendas selle `legalLookupPlan` ja query planneri kihiga.
- ETAPP 7 parandas live chat legal exact smoke'i.
- ETAPP 7.1 parandas `displayed_sources` ja exact-missing signaali.
- Production smoke'id kinnitasid, et `§ 140` ei too `§ 160` selected/displayed kihti.

## Teostusjärjekord

STATUS: historical roadmap / superseded by current V1-V2-V3 status blocks

### 1. Väike Golden Set

STATUS: done / maintenance

Kohe alguses tuleb teha umbes 20 küsimusega testikomplekt. See peab tekkima enne suuremaid RAG-i muudatusi või samas arendustsüklis koos trace'i ja allikafiltri esimese versiooniga, et iga muudatuse mõju oleks võrreldav.

Esialgsed juhtumid:

1. Mis on Võimaluste kohvik?
2. Mis oli Võimaluste kohvik 2017. aasta allika põhjal?
3. Mis on Kanep - mis on mis?
4. Leia konkreetse KOV-i koduteenus.
5. Kuidas taotleda konkreetse KOV-i sotsiaaltransporti?
6. Milline vorm on seotud konkreetse KOV-i hooldajatoetusega?
7. Kes on konkreetse teenuse kontaktisik?
8. Kas inimesel on õigus toimetulekutoetusele?
9. Mis on riikliku ja KOV tasandi info vahe selles küsimuses?
10. Küsimus, kus õige vastus on: allikas ei kinnita.
11. Küsimus, kus vana artikkel ei tohi muutuda tänaseks kehtivaks infoks.
12. Küsimus, kus ajakirjaartikkel sobib taustaks, aga mitte õiguslikuks aluseks.
13. Küsimus vale KOV-i välistamise kohta.
14. Küsimus vale keele välistamise kohta.
15. Küsimus, kus täpne pealkiri peab võitma semantilise sarnasuse.
16. Küsimus, kus vormi allikas peab olema ametlik.
17. Küsimus, kus kontakt peab tulema kontaktiallikast, mitte artiklist.
18. Pöörduja lihtkeelne küsimus.
19. Spetsialisti põhjalikum küsimus.
20. Küsimus, kus allikapaneel ei tohi näidata kõiki kandidaate.

Iga testi puhul hinnata:

- kas õige allikas leiti;
- kas vale allikas jäi välja;
- kas vastus ei väitnud rohkem kui allikas lubab;
- kas `displayed sources` on `answer sources` kinnitatud alamhulk või sama hulk;
- kas kasutajale ei kuvatud kasutamata kandidaate.

### 2. Minimaalne RAG Trace

STATUS: done / maintenance

Answer-source filtering'ut ei saa parandada pimesi. Iga RAG-vastuse juurde peab kohe logima vähemalt:

```json
{
  "retrieved_count": 0,
  "retrievers_used": [],
  "retrieved_source_ids": [],
  "selected_context_source_ids": [],
  "answer_source_ids": [],
  "displayed_source_ids": [],
  "filtered_out_source_ids": [],
  "filter_reasons": {},
  "attribution_decisions": []
}
```

See näitab, kas filter on liiga range, liiga leebe või ebajärjekindel.

### 3. Answer Sources / Displayed Sources Ausaks

STATUS: done / maintenance

Esimene prioriteet on parandada allikapaneeli loogika.

Praegune risk:

```text
retrieved candidates = displayed sources
```

Soovitud loogika:

```text
retrieved candidates
-> selected context sources
-> answer sources
-> displayed sources
```

Esimese versioonina võib süsteem nõuda, et vastuse koostamisel tagastatakse eraldi `answer_source_ids` ja `source_usage`. Hiljem saab liikuda lõigu- või väitepõhise attribution'i peale.

```json
{
  "answer_source_ids": [
    "tartu_linn_koduteenus_page",
    "tartu_linn_koduteenuse_taotlusvorm"
  ],
  "source_usage": [
    {
      "source_id": "tartu_linn_koduteenus_page",
      "usage": "supports_service_description"
    },
    {
      "source_id": "tartu_linn_koduteenuse_taotlusvorm",
      "usage": "supports_application_form"
    }
  ]
}
```

Kasutajale kuvatakse ainult serveri kinnitatud `displayed_source_ids`, mis on `answer_source_ids` alamhulk või sama hulk.

Server peab mudeli enesemärgistust kontrollima vähemalt:

- vastuse ja allika sisulise kattuvuse järgi;
- kasutaja päringu ankurterminite järgi;
- allikatüübi sobivuse järgi;
- ajakonteksti järgi, kui küsimus puudutab kehtivat või ajaloolist infot.

```json
{
  "source_id": "x",
  "decision": "display",
  "reason": "model_declared_and_context_validated"
}
```

`sourceAttribution.js` ei tohiks ainult filtreerida valmis allikaloendit, vaid peaks tagastama ka põhjendatud `attribution_decision` objektid.

### 4. Metadata Ja Source Type Korrastamine

STATUS: active / partially implemented

Miinimumväljad:

```json
{
  "source_id": "...",
  "title": "...",
  "source_type": "...",
  "authority": "...",
  "audience": ["CLIENT", "SOCIAL_WORKER"],
  "language": "et",
  "municipality": null,
  "municipality_id": null,
  "document_id": "...",
  "chunk_id": "...",
  "published_at": null,
  "last_checked": null,
  "valid_from": null,
  "valid_to": null,
  "historical": false,
  "canonical_item_id": null,
  "content_hash": "...",
  "url_canonical": "...",
  "source_status": "active"
}
```

Olulised `source_type` väärtused:

```text
national_law
kov_regulation
court_decision
state_guide
kov_service_info
official_form
application_form
web_form
pdf_form
contact_page
official_contact
service_standard
quality_guideline
methodology_guide
journal_article
practice_example
project_description
personal_story
opinion
historical_source
template
faq
partner_service_info
```

### 4.1. Source Metadata Profiles Enne Mass-Ingesti

STATUS: active design / partially implemented

KOV materjale ja suuremat korpust ei ole mõistlik andmebaasi laadida enne, kui allikapõhised metadata profiilid on kokku lepitud. Kõik allikad ei pea kasutama sama detailset skeemi, aga kõik peavad map'ima ühisele RAG source contract'ile.

Ühine minimaalne contract kõikidele allikatele:

```json
{
  "source_id": "...",
  "document_id": "...",
  "title": "...",
  "source_type": "...",
  "authority": "...",
  "language": "et",
  "audience": ["CLIENT", "SOCIAL_WORKER"],
  "published_at": null,
  "retrieved_at": "...",
  "last_checked": "...",
  "valid_from": null,
  "valid_to": null,
  "historical": false,
  "source_status": "active",
  "url": "...",
  "url_canonical": "...",
  "content_hash": "..."
}
```

`source_id` tähistab konkreetset allikat või lehte, `document_id` dokumendi versiooni või faili ning `chunk_id` ainult tükki dokumendi sees. `canonical_item_id` tekib siis, kui mitu allikat kirjeldavad sama teenust, toetust, vormi, kontakti või metoodilist objekti.

#### Ajakiri Sotsiaaltöö Ja Artiklid

Sobib tausta, metoodika, praktikanäidete ja ajaloolise konteksti jaoks. Ei tohi üksi kinnitada tänast õigust, KOV teenust, vormi, summat, tähtaega ega kontakti.

```json
{
  "source_type": "journal_article",
  "authority": "editorial",
  "journal_title": "Sotsiaaltöö",
  "issue_id": "...",
  "issue_label": "...",
  "year": 2024,
  "authors": [],
  "article_url": "...",
  "page_range": null,
  "topic": [],
  "life_event": [],
  "historical": true,
  "evidence_allowed_for": ["background", "methodology", "practice_context"],
  "evidence_not_allowed_for": ["current_law", "current_benefit", "current_form", "current_contact"]
}
```

#### KOV Kodulehed

KOV teenuse, toetuse, vormi ja kontakti info peab olema KOV-põhiselt filtreeritav. KOV allikas ei ole lihtsalt tekstilõik, vaid tulevase source package'i kandidaat.

```json
{
  "source_type": "kov_service_info",
  "authority": "KOV",
  "municipality": "Tartu linn",
  "municipality_id": "tartu_linn",
  "canonical_item_id": "tartu_linn_service_koduteenus",
  "item_type": "service",
  "service_name": "Koduteenus",
  "sections_present": ["description", "eligibility", "application", "forms", "contacts", "legal_basis"],
  "last_checked": "2026-04-25",
  "source_status": "active"
}
```

KOV kodulehe eraldi alamprofiilid:

- `kov_service_info` - teenuse või toetuse ametlik kirjeldus;
- `application_form`, `web_form`, `pdf_form` - vormid ja e-teenuse lingid;
- `official_contact` või `contact_page` - kontaktid;
- `partner_service_info` - KOV viidatud partnerteenus, mis ei ole täielikult KOV enda allikas;
- `faq` - korduma kippuvad küsimused, sobib täpsustuseks, mitte primaarseks õiguslikuks aluseks.

#### KOV Riigi Teataja Määrused

KOV määrused on tugevamad kui KOV kodulehe üldtekst, kui küsimus puudutab õigust, tingimust, summat, tähtaega või menetluskorda. Need peavad olema eraldi eristatavad tavalisest KOV veebilehest.

```json
{
  "source_type": "kov_regulation",
  "authority": "official_legal",
  "legal_level": "municipal_regulation",
  "municipality_id": "tartu_linn",
  "act_title": "...",
  "act_id": "...",
  "rt_url": "...",
  "issuer": "...",
  "adopted_at": null,
  "valid_from": null,
  "valid_to": null,
  "paragraph": null,
  "section_title": null,
  "historical": false
}
```

#### Riiklik Riigi Teataja Ja Riiklikud Juhised

Riiklik õigus ja riiklikud juhised annavad üldraami. Need ei tohi automaatselt asendada KOV konkreetset korda, kui küsimus puudutab kohalikku teenust või vormi.

```json
{
  "source_type": "national_law",
  "authority": "official_legal",
  "legal_level": "national_law",
  "act_title": "...",
  "act_id": "...",
  "rt_url": "...",
  "valid_from": null,
  "valid_to": null,
  "paragraph": null,
  "topic": [],
  "applies_nationally": true
}
```

Riikliku juhise puhul:

```json
{
  "source_type": "state_guide",
  "authority": "state_official",
  "publisher": "SKA | Sotsiaalministeerium | Eesti.ee | muu",
  "topic": [],
  "validity_note": null,
  "evidence_allowed_for": ["general_guidance", "state_level_process"],
  "evidence_not_allowed_for": ["municipality_specific_form", "municipality_specific_contact"]
}
```

#### Organisatsioonide Materjalid

Organisatsiooni materjal võib olla teenuseinfo, metoodika, juhend, blankett või partnerteenuse kirjeldus. Süsteem peab eristama, kas organisatsioon on ametlik teenuseosutaja, partner või lihtsalt taustmaterjali avaldaja.

```json
{
  "source_type": "partner_service_info",
  "authority": "organization",
  "organization_id": "...",
  "organization_name": "...",
  "organization_role": "service_provider",
  "service_area": [],
  "geo": null,
  "linked_municipality_ids": [],
  "contract_or_referral_basis": null,
  "audience": ["CLIENT", "SOCIAL_WORKER"],
  "evidence_allowed_for": ["service_description", "contact", "methodology"],
  "evidence_not_allowed_for": ["legal_entitlement", "municipal_decision"]
}
```

#### Mallid, Blanketid Ja Töövahendid

Mallid ja töövahendid võivad toetada dokumentide koostamist, aga nad ei kinnita iseseisvalt õigust, summat, tähtaega ega KOV korda.

```json
{
  "source_type": "template",
  "authority": "internal_or_methodology",
  "template_type": "letter | assessment | checklist | plan | form",
  "intended_role": "SOCIAL_WORKER",
  "requires_review": true,
  "evidence_allowed_for": ["drafting_support", "workflow_support"],
  "evidence_not_allowed_for": ["legal_basis", "benefit_amount", "eligibility"]
}
```

#### Metadata Failide Esialgne Jaotus

Mass-ingesti eel tuleks igale korpuseperele teha eraldi sisendfailid, mis map'itakse ühisele source contract'ile.

```text
KOV kodulehed:
- <kov>.sources.json
- <kov>.data.json
- <kov>.meta.json
- <kov>.rag.md

KOV Riigi Teataja:
- <kov>.rt.sources.json
- <kov>.rt.acts.json
- <kov>.rt.meta.json
- <kov>.rt.md

Riiklik Riigi Teataja:
- national-rt.sources.json
- national-rt.acts.json
- national-rt.meta.json

Ajakiri Sotsiaaltöö:
- sotsiaaltoo.sources.json
- sotsiaaltoo.issues.json
- sotsiaaltoo.articles.json
- sotsiaaltoo.meta.json

Organisatsioonid:
- <organization>.sources.json
- <organization>.materials.json
- <organization>.meta.json

Mallid ja töövahendid:
- templates.sources.json
- templates.items.json
- templates.meta.json
```

Open decision enne tulevaste korpuste ingest'i: kas kasutada igas korpuseperes eraldi failinimesid või hoida failinimed ühtsed ja eristada tüüpi `collection_type` väljaga. Mõlemal juhul peab väljund jõudma samasse `source_documents`, `chunks`, `source_packages` ja `answer_sources` loogikasse.

### 5. Hard Filters

STATUS: planned / partially implemented

Hard filter peab tulema enne pehmet ranking'ut ainult siis, kui filterväli on tuvastatud kõrge kindlusega. Madala kindlusega väljade puhul kasutatakse soft boost / soft penalty loogikat, et õige allikas ei kaoks enne ranking'ut.

High-confidence hard filter:

- vale keel välja, kui UI või kasutaja kontekst kinnitab keele;
- vale audience välja, kui roll on kindel;
- vale KOV välja, kui küsimus sisaldab selget KOV-i ja kontekst ei viita mitmele KOV-ile;
- aegunud allikas välja, kui küsitakse kehtivat infot;
- mitteametlik allikas välja, kui küsitakse õigust, summat, tähtaega või vormi;
- ajalooline allikas välja, kui küsimus eeldab praegust teenuseinfot.

Soft filter / boost:

- ebakindel KOV;
- ebakindel intent;
- teemad ja sünonüümid;
- allikatüübi sobivus;
- authority ja recency eelistus.

### 6. Hübriidotsing

STATUS: active / partially implemented

Soovitud kombinatsioon:

```text
exact phrase search
+ title / heading match
+ BM25 / full-text search
+ semantic vector search
+ metadata filters
```

Täpne fraas, pealkirja kattuvus ja allikatüüp peavad kaaluma rohkem kui üldine semantiline sarnasus, eriti konkreetsete nimede, artiklite, KOV teenuste ja vormide puhul.

### 7. Canonical Item + Source Package

STATUS: active design / partially implemented

Eesmärk on liikuda chunk-põhiselt RAG-ilt source package RAG-ile.

KOV teenuse pakett võiks sisaldada:

- teenus/toetus;
- kellele;
- tingimused;
- taotlemine;
- vormid;
- kontaktid;
- õiguslik alus;
- KOV / riiklik tase;
- `last_checked`;
- `valid_from` / `valid_to`;
- allikad.

Mudelile ei anta lihtsalt 12 sarnast lõiku, vaid kontrollitud tervikpakett.

Source package peab olema eraldi objekt, mitte ainult renderdatud promptitekst.

```json
{
  "package_id": "tartu_linn_service_koduteenus_package",
  "canonical_item_id": "tartu_linn_service_koduteenus",
  "package_type": "kov_service",
  "title": "Koduteenus",
  "municipality_id": "tartu_linn",
  "sections": {
    "description": [],
    "eligibility": [],
    "application": [],
    "forms": [],
    "contacts": [],
    "legal_basis": []
  },
  "source_ids": [],
  "last_checked": "2026-04-25",
  "confidence": "medium"
}
```

See sama objekt peab saama toetada RAG vastust, allikapaneeli, vormide ja kontaktide eraldi kuvamist, admini kvaliteedikontrolli ja teste.

### 8. Reranking

STATUS: planned

Reranker hindab näiteks:

- kas allikas vastab küsimusele;
- kas see sisaldab küsitud üksust;
- kas see on õiges KOV-is;
- kas see on õiges ajas;
- kas source type sobib;
- kas see dubleerib paremat allikat;
- kas see peaks minema source package'i või jääma välja.

Reranking võib olla alguses reeglipõhine ja hiljem mudelipõhine.

### 9. Täis Observability

STATUS: planned / design target

Kui põhiloogika töötab, laiendada trace täisobservability'ks:

- query intent;
- role;
- language;
- geo/KOV;
- hard filters;
- otsingupäringud;
- retrieved candidates;
- ranking scores;
- selected context sources;
- source package;
- model context;
- answer sources;
- displayed sources;
- latency;
- input/output/cached tokens;
- kasutaja tagasiside.

### 10. Suurem Regressioonitestide Komplekt

STATUS: planned

Siht:

- 100-300 küsimust;
- eri rollid;
- eri KOV-id;
- eri allikatüübid;
- õiguslikud küsimused;
- vormid;
- kontaktid;
- ajaloolised artiklid;
- praktikanäited;
- teadlikult puuduliku infoga küsimused.

Iga suurem RAG-i muudatus peab selle komplekti läbima.

## V1 Implementation Scope

STATUS: done / maintenance

V1 eesmärk ei ole kogu RAG stack ümber ehitada. V1 eesmärk on muuta olemasolev süsteem jälgitavaks ja allikate kuvamine ausaks.

V1 sisaldab:

- 20 küsimusega golden set;
- minimaalne RAG trace;
- `answer_source_ids`, `displayed_source_ids` ja `attribution_decisions`;
- `sourceAttribution.js` otsuste logimine;
- frontendis allikapaneeli sidumine ainult `displayed_source_ids` külge;
- ingest metadata miinimumväljade kontroll.

V1 ei sisalda:

- Chroma asendamist;
- täielikku Qdrant migratsiooni;
- claim-level attribution'it;
- täielikku source package andmemudelit;
- mudelipõhist rerankerit;
- täielikku hübriidotsingut kõigi allikate jaoks.

V1 on valmis, kui kasutajale nähtavad allikad ei sisalda enam otsingumüra ja iga RAG-vastuse kohta on võimalik trace'ist näha, kus allikas tekkis, valiti, kasutati või välja filtreeriti.

## V1 Acceptance Criteria

STATUS: done / maintenance

V1 loetakse tehtuks, kui:

- iga RAG-vastus logib `retrieved_source_ids`, `selected_context_source_ids`, `answer_source_ids`, `displayed_source_ids`, `filtered_out_source_ids`, `filter_reasons` ja `attribution_decisions`;
- allikapaneel kuvab ainult backendist tulnud `displayed_sources` või nendega seotud kinnitatud allikad;
- golden setis on vähemalt 20 testjuhtumit;
- testides on vähemalt üks juhtum, kus retrieved allikas jääb displayed allikatest välja;
- kõrge riskiga väide ei ilmu kindla faktina, kui sellel puudub `strong` evidence;
- legacy sõnumid jäävad UI-s loetavaks ka vana `sources` metadata korral;
- ingest annab vea või hoiatuse, kui kriitiline metadata puudub.

## V1 Delivery Plan

STATUS: done / historical

### RAG-1: Add Golden Set Fixture

STATUS: done

Luua 20 küsimusega testikomplekt koos oodatud allikatüüpide, keelatud allikate ja `must_not_claim` reeglitega.

Acceptance:

- olemas on vähemalt 20 testjuhtumit;
- testid katavad KOV, vormi, kontakti, ajaloolise allika, vale KOV-i, vale keele ja "allikas ei kinnita" juhtumi.

### RAG-2: Add Minimal RagTrace Object

STATUS: done

Luua ühtne trace objekt, mis salvestab vähemalt:

- `retrieved_source_ids`;
- `selected_context_source_ids`;
- `answer_source_ids`;
- `displayed_source_ids`;
- `filtered_out_source_ids`;
- `filter_reasons`;
- `attribution_decisions`.

Acceptance:

- iga RAG-vastus logib need väljad;
- trace on hiljem leitav debugimiseks.

### RAG-3: Return Attribution Decisions From sourceAttribution.js

STATUS: done

`sourceAttribution.js` peab tagastama lisaks kuvatavatele allikatele ka otsuste loendi.

```json
{
  "source_id": "tartu_linn_koduteenus",
  "decision": "display",
  "reason": "model_declared_and_context_validated"
}
```

Acceptance:

- iga allika kohta on otsus `display` või `hide`;
- iga `hide` otsusel on põhjus.

### RAG-4: Persist displayed_source_ids In Message Metadata

STATUS: done

Salvestada lõplikud `displayed_source_ids` assistendi sõnumi metadata'sse.

Acceptance:

- uued sõnumid sisaldavad `displayed_source_ids`;
- legacy sõnumid jäävad ühilduvaks vana `sources` loogikaga.

### RAG-5: Make Source Panel Read displayed_source_ids Only

STATUS: done

Frontendi allikapaneel ei tohi enam ise retrieved või selected allikaid kokku korjata.

Acceptance:

- `ChatSourcesPanel.jsx` kuvab ainult backendist tulnud `displayed_sources`;
- vähemalt üks test tõendab, et retrieved allikas ei ilmu paneeli, kui seda ei kinnitatud.

### RAG-6: Add Metadata Validation To Ingest

STATUS: partially implemented / active hardening

Ingest peab kontrollima miinimumvälju:

- `source_id`;
- `title`;
- `source_type`;
- `authority`;
- `language`;
- `municipality` või `municipality_id`, kui KOV-allikas;
- `last_checked`;
- `historical`;
- `source_status`.

Acceptance:

- puuduv kriitiline väli annab vea või hoiatuse;
- `source_type` peab kuuluma kontrollitud väärtuste hulka.

### RAG-7: Add Retrieved-But-Not-Displayed Regression Test

STATUS: done

Lisada test, kus otsing leiab mitu kandidaati, aga kasutajale kuvatakse ainult üks või kaks kinnitatud allikat.

Acceptance:

- testis on retrieved allikaid rohkem kui displayed allikaid;
- allikapaneel ei kuva kasutamata kandidaate.

## V1 Ja V2 Täiendavad Märkused

STATUS: mixed / historical notes and active V2 guidance

Need märkused täpsustavad järgmisi arendusideid. Need ei laienda automaatselt V1 kohustuslikku skoopi, vaid aitavad hiljem ticketiteks ja otsusteks jagada.

### V1 Audit Checklist

STATUS: done / historical

Enne V1 koodi muutmist tuleb praeguse pipeline'i vastu kontrollida:

- kust `retrieved sources` praegu tulevad;
- kus ja kuidas neist saavad `selected context sources`;
- mida `sourceAttribution.js` praegu eemaldab või alles jätab;
- mis salvestatakse `ConversationMessage.metadata.sources` sisse;
- kas streaming ja non-streaming vastused käituvad allikate osas samamoodi;
- kas frontend kogub vestlussõnumitest allikaid ise juurde;
- kas allikapaneel võib kuvada allikat, mida backend ei kinnitanud.

### V1 Backend Response Contract

STATUS: done / maintenance

V1 peab lukustama backendist frontendile liikuva minimaalse vastusekuju.

```json
{
  "sources": [],
  "displayed_sources": [],
  "rag_trace": {
    "retrieved_source_ids": [],
    "selected_context_source_ids": [],
    "answer_source_ids": [],
    "displayed_source_ids": [],
    "filtered_out_source_ids": [],
    "filter_reasons": {},
    "attribution_decisions": []
  }
}
```

`sources` võib jääda legacy ühilduvuseks, aga uus allikapaneeli loogika peab eelistama `displayed_sources` välja.

### V1 Feature Flags And Legacy Sources

STATUS: partially completed / historical

V1 rollout võiks kasutada feature flag'e:

```text
RAG_TRACE_V1_ENABLED
RAG_ATTRIBUTION_DECISIONS_ENABLED
RAG_DISPLAYED_SOURCES_ENFORCED
```

Legacy allikate käsitlus:

- vanad sõnumid jäävad loetavaks vana `sources` metadata põhjal;
- uued sõnumid salvestavad `displayed_source_ids` ja võimalusel `rag_trace`;
- UI oskab lugeda nii vana kui uut kuju;
- analytics/debug eristab legacy ja V1 allikaloogikat.

### V1 Golden Set Schema

STATUS: done / maintenance

Golden set peab olema masinloetav, mitte ainult tekstiloend.

```json
{
  "id": "kov_koduteenus_tartu_001",
  "question": "Kuidas taotleda koduteenust Tartus?",
  "role": "CLIENT",
  "language": "et",
  "expected_source_types": ["kov_service_info", "application_form"],
  "forbidden_source_types": ["journal_article"],
  "must_mention": ["taotlus", "abivajaduse hindamine"],
  "must_not_claim": ["kindel summa, kui allikas seda ei kinnita"]
}
```

### V2 Implementation Boundary

STATUS: partially implemented / active

V2 eesmärk on parandada otsingu ja kvaliteedipoliitika tugevust ilma V3 täielikku teadmismudelit nõudmata.

V2 query planner võiks tagastada näiteks:

```json
{
  "intent": "kov_service_application",
  "risk_level": "medium",
  "language": "et",
  "role": "CLIENT",
  "municipality": {
    "id": "tartu_linn",
    "confidence": "high"
  },
  "needs": {
    "forms": true,
    "contacts": true,
    "legal_basis": true,
    "current_info": true
  }
}
```

V2 hübriidotsing võib jääda evolutsiooniliseks:

- Chroma dense retrieval jääb alles;
- exact/title match lisandub serveri või andmebaasi kihis;
- BM25/full-text lisandub eraldi kanalina;
- tulemused ühendatakse RRF/weighted merge loogikaga;
- reranking võib jääda reeglipõhiseks; mudelipõhist rerankerit kaalutakse ainult siis, kui mõõdikud näitavad vajadust.

V2 retrieval trace peab iga kanali eraldi nähtavaks tegema. Esimese sammuna peab ka olemasolev Chroma otsing märkima tulemused `dense` retriever'ist tulnuks ja `rag_trace.retrievers_used` peab selle salvestama. Hilisemad `exact_phrase`, `title_match`, `bm25` ja reranker'i kanalid lisanduvad samasse välja, et kvaliteedilangust või -võitu saaks mõõta, mitte aimata.

V2 esimene hübriidotsingu samm on lightweight lexical retrieval:

- `dense` jääb põhikanaliks;
- `title_match` otsib pealkirja kattuvust;
- `exact_phrase` otsib täpse fraasi kattuvust tekstis;
- `bm25` märgib tokenipõhise full-text kattuvuse, kui täpne fraas või pealkiri üksi ei kata päringut;
- leksikaalne scan on piiratud `RAG_LEXICAL_SCAN_LIMIT` ja `RAG_LEXICAL_TOP_K` väärtustega;
- leitud kanalid kantakse tulemuse `retrieval_channels` väljale ja hiljem `rag_trace.retrievers_used` alla;
- lexical kanal ei asenda eraldi full-text indeksit, vaid annab V2-s esimese mõõdetava silla päris hübriidotsingu poole.

V2 evidence score võib alguses olla reeglipõhine:

```text
retrieval_channel + authority + source_type + municipality_match + freshness + exact_title_match + risk_fit
```

V2 esimene ranking quality layer kasutab olemasolevat metadata't enne võimalikku hilisemat mudelipõhist reranker'it:

- `title_match` ja `exact_phrase` kanalid annavad täpsel kattuvusel ranking boost'i;
- ametlikud ja kõrgema autoriteediga `source_type` väärtused saavad eelistuse taustaallikate ees;
- `source_status=active` saab väikese eelistuse;
- `stale`, `inactive`, `archived`, `historical=true` ja `historical_source` saavad ranking penalty;
- `valid_from`, `valid_to` ja `historical` peavad liikuma retrieval match'ist selected context source'i edasi, et hilisem evidence policy saaks neid kontrollida;
- `ragRiskPolicy` liigub retrieval assembler'ist rankingusse, et `high` riskiga küsimustes tõuseksid ametlikud ja nõutud evidence source type'id taustaallikatest ette;
- see kiht ei asenda hard/soft filter policy't, vaid annab V2-s parema vaikimisi järjestuse.

V2 esimene teostatud quality-policy tükk on `RAG_RISK_POLICY`:

- küsimus klassifitseeritakse `low`, `medium` või `high` riskiks;
- riskipoliitika määrab nõutava tõendusastme (`medium` või `strong`);
- `medium` ja `high` riskiga RAG vastused saavad täiendava system instruction'i;
- riskitase ja nõutav tõendus salvestatakse `rag_trace` ning message metadata sisse;
- admin logivaates kuvatakse `rag_risk_level` ja `rag_required_evidence`.
- attribution filter kontrollib riskipoliitika põhjal ka `evidence_strength` väärtust;
- kõrge riskiga vastuses ei kuvata nõrka taustaallikat, näiteks ajakirjaartiklit, `strong` evidence allikana;
- kui ainus kandidaat ei täida nõutavat tõendusastet, jääb `displayed_sources` tühjaks ja otsus logitakse põhjusega `insufficient_evidence_strength`.

Esialgne V2 riskipoliitika:

```json
{
  "riskLevel": "high",
  "requiredEvidence": "strong",
  "preferredSourceTypes": [
    "national_law",
    "kov_regulation",
    "state_guide",
    "kov_service_info",
    "application_form",
    "official_contact"
  ],
  "insufficientEvidenceMode": true
}
```

V2 admin quality queue peaks näitama vähemalt:

- puuduv metadata;
- vana `last_checked`;
- KOV teenus ilma vormita;
- kontakt ilma ametliku allikata;
- vastuolulised allikad;
- failed ingest;
- stale source.

V2 mõõdikud:

- `displayed_source_precision`;
- `wrong_municipality_rate`;
- `stale_source_rate`;
- `unsupported_claim_rate`;
- `insufficient_evidence_correctness`.

## Arenduse Seis 2026-04-28

STATUS: current snapshot

See plokk kirjeldab hetkeseisu lokaalses arenduses ja production-smoke'iga kinnitatud seisu pärast clean canonical reingest'i.

### Seis pärast clean canonical reingest'i 2026-04-28

STATUS: production-smoked snapshot

- V2.5 canonical hardening on productionis kontrollitud.
- Legal exact retrieval + `displayed_sources` on production smoke'iga kontrollitud.
- Clean canonical reingest on tehtud olemasoleva korpuse piires.
- Aktiivses registry's on 704 kirjet:
  - `national_regulations`: 1
  - `kov_regulations`: 1
  - `kov_services`: 64
  - `sotsiaaltoo_articles`: 638
- `npm run rag:smoke:v2 -- --chat --legal-exact` ja `npm run rag:smoke:v2` läbivad.
- Legacy storage on alles rollback'i jaoks.

### V1 Praktiliselt Tehtud

STATUS: done / maintenance

- Golden set ja RAG regressioonitestid on olemas ning neid kasutatakse muudatuste kontrolliks.
- `displayed_sources`, `displayed_source_ids`, `attribution_decisions` ja `rag_trace` liiguvad backend response'i ja message metadata kaudu.
- Allikapaneeli loogika eelistab backendist tulnud kinnitatud `displayed_sources` andmeid, mitte ei kogu pimesi kõiki legacy `sources` allikaid.
- `sourceAttribution.js` tagastab kuvamise/peitmise otsused koos põhjustega.
- Streaming ja non-streaming vastuste jaoks on testid, mis kontrollivad `displayed_sources` metadata liikumist.
- RAG trace eristab retrieved, selected context, answer ja displayed source kihte.
- Legacy `sources` loogika jääb ühilduvuseks alles, aga uus rada on `displayed_sources` ja `rag_trace`.
- Uued RAG metadata objektid märgivad `rag_contract_version: "v1"` ja `source_display_mode`, et legacy ja V1 allikaloogika oleks hiljem eristatav.
- `rag_trace.selected_context_details` sanitiseeritakse lubatud tehniliste väljadeni; trace ei kopeeri täit prompti, kasutaja teksti, model context'i ega tõendilõikude sisu.
- Attribution decision reason'id on koondatud standardseks taksonoomiaks ja testiga kontrollitud.

### V2 Osaliselt Tehtud

STATUS: partially implemented / active

- RAG service tagastab ja märgistab retrieval kanalid, sh `dense`, `title_match`, `exact_phrase` ja lightweight `bm25`.
- Vastete küljes liigub `retrieval_channels`; trace'is liigub `retrievers_used`.
- Riskipoliitika klassifitseerib küsimused `low`, `medium` ja `high` tasemele.
- Riskitase ja nõutav tõendus liiguvad `rag_trace` sisse.
- Ranking kasutab olemasolevat metadata't: `source_type`, `source_status`, `historical`, `retrieval_channels`, pealkirja-, fraasi- ja tokenikattuvust.
- Kõrge riskiga vastustes ei kuvata nõrka taustaallikat tugeva tõendusena.
- Lühikesed artikli järelküsimused, näiteks "Eesti", "Soome" või "OTT", ankurdatakse hiljutise assistendi allika külge.
- Sama allika järelküsimuses kasutatakse esmalt `doc_id`, `source_id` või `canonical_item_id` põhist filtrit ning seejärel fallback otsingut.
- Laiade võrdlus- ja sünteesiküsimuste puhul ei lukustata otsingut ainult eelmise artikli külge; broad query jookseb esimesena ja source-focused query jääb toetavaks.
- Multi-source selection eelistab laia sünteesi puhul eri allikaidentiteete, mitte sama dokumendi korduvaid chunk'e.
- Query Planner V2 on eraldi moodulis `lib/chat/queryPlanner.js` ja tagastab standardse plaani: päringud, filtrid, topK, selection strategy, context group target ja trace'i `query_plan`.
- `query_plan` liigub `rag_trace` sisse, et hiljem oleks näha, miks valiti `source_focused_followup`, `broad_multi_source`, `temporal`, `municipality_service_benefit_list` või muu planner mode.
- Dense ja lexical kanalid ühendatakse RRF/weighted merge loogikaga ning tulemuste küljes liiguvad `rrf_score`, `hybrid_score` ja `hybrid_rank`.
- Lightweight `bm25` kanal kannab nüüd mõõdetavaid tuning-signaale: `bm25_score`, `bm25_coverage`, `bm25_matches`, `bm25_query_tokens`, BM25 env seaded merge strategy's ning `rag_trace.hybrid_retrieval.bm25` kokkuvõte. See võimaldab päris probleemvestlustest otsustada, kas lightweight kanalist piisab või on vaja Postgres full-texti / eraldi indeksit.
- RAG source metadata contract on koondatud ühisesse helperisse ning KOV, organisatsiooni, ajakirja ja Riigi Teataja ingest/validation radades kasutatakse rangemat metadata kontrolli.
- KOV/RT/organisatsiooni metadata jaoks on lisatud dry-run backfill planner `rag:plan:metadata`, mis koostab enne mass-ingesti JSON plaani: millised V2 contract'i väljad saab olemasolevatest source/meta failidest tuletada ja millised kirjed jäävad blokkeriks.
- Ajakirja ingest dry-run oskab vanadest JSON-idest koostada V2 metadata contract'i ilma faile käsitsi muutmata ning `--plan-json` väljundiga salvestada ready/blocked/backfill plaani enne mass re-ingest'i.
- Ajakirja mass re-ingest on productionis kontrollitud `--resume` ja `--concurrency 2` töövooga; `--skip-existing` ei sobi metadata paranduse re-ingestiks, sest vanad olemasolevad dokumendid tuleb uue contract'iga üle kirjutada.
- Ajakirja ingest skriptil on RAG HTTP päringute timeout (`--request-timeout-ms`, vaikimisi 300000 ms), et RAG service'i või fetch'i hangumine ei jätaks batch'i lõputult rippuma.
- Ajakirja legacy cleanup tööriist `rag:cleanup:ajakiri-legacy` koostab RAG service registry põhjal dry-run plaani vanade `source_type=file` / `unknown` ajakirjakirjete eemaldamiseks ainult siis, kui olemas on sama pealkirja ja aasta `article_ingest` asendus.
- Legacy cleanup kustutab päriselt ainult `--delete` lipuga ja ainult `delete_duplicate` otsuseid; ebakindlad või ilma asenduseta kirjed jäävad `review_legacy` staatusesse.
- Productionis eemaldati selle tööriistaga 2026-04-26 esmalt neli kindlat ajakirja legacy duplikaati. Pärast AI ja Sloveenia artikli siht-ingesti ning kahe kinnitatud `covered_by_combined_article` mappingu lisamist eemaldati ülejäänud kolm legacy kirjet; järelkontrollis oli `legacy_file: 0`, `delete_duplicate: 0` ja `review_legacy: 0`.
- Source freshness audit on eraldi helperis ja CLI-s olemas: allikatüübi põhine kontroll leiab puuduva või aegunud `last_checked`, aegunud `valid_to`, mitteaktiivse `source_status` ja kõrge prioriteediga ülevaatusvajaduse.
- Admin analytics RAG dokumentide vaates on esimene quality queue: see kuvab freshness auditi vead ja hoiatused ning annab prioriteetse nimekirja allikatest, mis vajavad metadata või värskuse ülevaatust.
- Kui productionis on Prisma `RagDocument` tabel tühi, aga RAG service registry/Chroma sisaldab dokumente, kasutab admin analytics freshness audit fallback'ina RAG service `/documents` nimekirja. Vastuses on selleks `ragDocs.freshness.auditSource`, `ragServiceFallbackCount` ja `ragServiceFallbackError`.
- Quality queue kontrollib esimeses versioonis ka URL-i kuju, puuduvaid URL-e praeguse info tõendusallikatel, KOV teenust ilma seotud vormiallikata ning kontaktiviiteid, mis ei tule `official_contact` või `contact_page` allikatüübist.
- KOV ingest lisab item metadata külge `sections_present`, vormi-, kontakti- ja õigusliku aluse loendurid; quality queue kasutab neid source package signaale, et vormi või ametliku kontakti puudumist märkida ainult siis, kui teenuse metadata seda vajadust päriselt näitab.
- Quality queue tuvastab nüüd ka esimese source package konflikti: sama `canonical_item_id` alla ei tohi sattuda mitme erineva `municipality_id` KOV allikad ilma ülevaatuseta.
- SourcePackage `wrong collection id` kontroll käsitleb KOV RT kihi jaoks lubatud aliasena nii `kov_regulations` kui ka productionis kasutatavat `kov_legal` väärtust, kui `source_type = "kov_regulation"`.
- Admin analytics mõõdab metadata contract'i completeness'i: näha on puuduvad kohustuslikud väljad, soovituslike väljade puudumine ja kui suur osa auditeeritud allikatest vastab miinimumcontract'ile.
- Metadata kvaliteet on jaotatud ka korpusepere järgi (`kov_web`, `kov_rt`, `national_rt`, `ajakiri_sotsiaaltoo`, `organizations`, `unknown`), et admin näeks, milline ingest rada toodab puuduliku contract'iga allikaid.
- Metadata kvaliteet on jaotatud ka sisendi/failitüübi järgi (`rag_md`, `kov_data_item`, `sources_json`, `meta_json`, `rt_xml`, `article_ingest` jne), et parandustöö jõuaks konkreetse ingest sisendini.
- Quality queue issue'd sisaldavad `remediation` objekti: paranduse tegevus, puuduvad väljad ja siht (`collection_family`, `source_file_type`, `source_id`, `document_id`, `canonical_item_id`). Siht sisaldab võimalusel ka `admin_href` väärtust ning admin vaade kuvab selle “Fix” veeruna.
- `admin_href` kannab nüüd parandustöö konteksti query parameetrites edasi: `remediation_action`, `fields`, `source_id`, `document_id`, `canonical_item_id`, `source_type`, `source_file_type` ja vajadusel `source_path`, `municipality` või `organization`.
- RAG admini sihtlehed loevad quality queue query parameetreid ja kuvavad parandustöö konteksti: action, parandatavad väljad ning source/document/canonical identifikaatorid.
- RAG admini parandustöö banner näitab ka `focus` ja `file_key` väärtusi, et admin näeks kohe, kas parandustöö puudutab dokumenti, lingiplokki või konkreetset failikaarti.
- RAG admin controller kasutab sama query konteksti madala riskiga eeltäitmiseks: dokumendivaate otsing saab siht-identifikaatori ning ingest PDF+metadata textarea saab metadata parandusstub'i.
- KOV ja organisatsioonide admin controllerid kasutavad quality queue query konteksti sihtkirje leidmiseks: vaade puhastab piiravad filtrid, valib õige KOV-i või organisatsiooni ning avab vajadusel lingi/detaili muutmise režiimi.
- Quality queue remediation target kannab nüüd ka töö fookust: `focus` ja võimalusel `file_key`. Admin UI märgib KOV ja organisatsiooni detailis konkreetse failikaardi või lingiploki, mida parandustöö puudutab.
- KOV admin detail ei eelda enam, et kõik failikaardid oleksid eelnevalt `municipalityKovAdminFile` tabelis. Kui DB kirje puudub, aga repo all on canonical fail (`KOV/<slug>/<slug>.sources.json`, `.json`, `.meta.json`, `.rag.md`) või RT XML leitakse `kov_rt` manifesti kaudu, serialiseeritakse see admini jaoks repository fallback failina, valideeritakse ning summary ei jää valesti `0/4` või `0/1`.
- Admin analytics mõõdab kõrge riskiga RAG vastuste allikariski kahes kihis: `answer_source_stale_rate` / `answer_unknown_source_rate` näitavad vastuse tõendusallikate riski ning `displayed_source_stale_rate` / `displayed_unknown_source_rate` näitavad kasutajale kuvatud allikapaneeli riski.
- Admin analytics kuvab eraldi high-risk source risk queue tabeli, mis näitab, kas risk tuli `answer` või `displayed` kihist.
- High-risk source risk mõõdik on seotud tulevase claim-level attribution kihiga. Kui trace sisaldab `claim_attributions`, loeb analytics eraldi `claim` allikakihi ning arvutab `high_risk_claim_source_count`, `stale_claim_source_responses`, `unknown_claim_source_responses`, `claim_source_stale_rate`, `claim_unknown_source_rate` ja `claim_source_risk_readiness_rate`.
- Claim-level risk queue kirjed ei salvesta täit väiteteksti, vaid ainult piiratud tehnilisi viiteid nagu `claim_id`, `claim_type`, `evidence_strength` ja seotud `source_id`, et privaatsuspiir jääks samaks.
- Admin analytics mõõdab nüüd trace'i põhjal source display contract'i: `displayed_source_precision`, contract violation count/rate ning retrieved/selected allikate filtratsioonimäär näitavad, kas kuvatud allikad on kinnitatud answer source'id ja kui palju otsingumüra välja jäi.
- Trace kannab nüüd valitud kontekstiallikate juures ohutut KOV metadata't (`municipality_id`, `municipality_name`) ning Query Planner trace kannab oodatud KOV sihti; admin analytics arvutab nende põhjal `wrong_municipality_rate`.
- Quality queue remediation target lisab parandustöö linkidele ohutud soovitused: `suggested_source_type`, `suggested_authority`, `suggested_url`, vajadusel `suggested_last_checked` ja `suggested_source_status`.
- Admin remediation context oskab nende põhjal metadata stub'i eeltäita, näiteks `source_type`, `authority`, `last_checked`, `source_status` ja `url` väljade parandamiseks. Eeltäitmine on piiratud madala riskiga väärtustega ega kirjuta automaatselt andmeid üle.
- Assistendi vastuse stiilijuhis keelab lõppvastuses tehnilised fraasid nagu `nähtavas kontekstis`, `RAG kontekstis`, `kontekstis ei ole` ja `selles vaates ei ole`. Ebapiisava allikakinnituse korral kasutatakse loomulikku sõnastust, näiteks "Praegu kasutatud allikad ei anna sellele piisavalt täpset vastust" või õiguslike küsimuste puhul "Ma ei leidnud praeguse otsinguga sellele piisavalt täpset õiguslikku allikakinnitust."
- Admin analytics sündmuste real kuvatakse `query_plan` detailid: planner mode, query order, selection strategy, query count ja `rag_top_k`.
- Admin analytics 30 päeva kokkuvõttes arvutatakse Query Planner mode, query order ja selection strategy jaotused.
- Query Planner V2 esimene eval-fixture on olemas: see kontrollib artikli järelküsimust, laia võrdlust, KOV teenuseid/toetusi, national scope'i, teenuse tasandi liigitust, temporal päringut, source lookup'i ja default low-risk päringut.
- Query Planner V2 eval-fixture katab nüüd mitu realistlikku artikli-follow-up varianti: lühike riigiküsimus, küsimus sama artikli näidete kohta, nime/akronüümi otsing, `source_id` fallback, `canonical_item_id` fallback ning broad multi-source küsimus, mis ei tohi lukustuda ainult eelmise artikli külge.
- Sama Query Planner V2 fixture kontrollib nüüd ka retrieval orchestrator'i päringuehitust: source-focused juhtumites peab esimene päring olema filtriga ja broad multi-source juhtumites peab esimene päring jääma filtrita.
- Multi-source context selection testib nüüd ka `canonical_item_id` põhist dedupe'i: laia sünteesi puhul ei valita sama canonical item'i korduvaid dokumente enne, kui eri allikaidentiteedid on kaetud.

### Viimati Kontrollitud Testid

STATUS: current snapshot / needs refresh after each release

Viimane lokaalne kontroll:

```text
chat/RAG regressioonipakk: 66/66 passed
RAG metadata/freshness/ingest/cleanup/backfill static pack: 40/40 passed
prompt/retrieval style pack: 10/10 passed
source freshness/remediation/source quality pack: 23/23 passed
```

See ei asenda serveri smoke testi pärast deploy'd. Productionis tuleb eraldi kontrollida RAG service health'i, chat endpointi, allikapaneeli ja vähemalt üht päris vestluse artikli-follow-up juhtumit.

### V1.2 Production Smoke

STATUS: done / maintenance

V1.2 lisab production smoke skripti:

```text
npm run rag:smoke:v1
```

Skript: `scripts/smoke-rag-v1-contract.mjs`.

Käivitamiseks productioni vastu:

```text
SOTSIAALAI_SMOKE_BASE_URL=https://sotsiaal.ai
SOTSIAALAI_SMOKE_COOKIE="next-auth.session-token=..."
npm run rag:smoke:v1
```

Vajadusel saab kasutada bearer tokenit:

```text
SOTSIAALAI_SMOKE_BEARER="..."
npm run rag:smoke:v1
```

Streamingu kontrollimiseks:

```text
npm run rag:smoke:v1 -- --stream
```

Smoke kontrollib vähemalt:

- `/api/chat` health GET vastab;
- `/api/chat` RAG päring vastab edukalt;
- vastuses on `sources` ja `displayed_sources`;
- `displayed_sources.length <= sources.length`;
- RAG vastuses on `rag_contract_version: "v1"`;
- RAG vastuses on `source_display_mode`;
- RAG vastuses on `rag_trace`;
- `rag_trace.displayed_source_ids` sisaldab kuvatud allikaid;
- `rag_trace` ei sisalda täit kasutaja sõnumit, prompti, model context'i ega pikki tõendilõike.

Pärast V1.2 võib V1 lugeda arenduslikult lõpetatuks ning hoida seda maintenance/hardening režiimis. Uus RAG kvaliteediarendus liigub V2 alla.

Production kontroll 2026-04-26:

```text
npm run rag:smoke:v1
npm run rag:smoke:v1 -- --stream
```

Mõlemad smoke käsud läbisid `https://sotsiaal.ai` vastu edukalt. Kontroll kinnitas, et non-stream ja streaming `/api/chat` vastused tagastavad V1 contract'i väljad, sealhulgas `rag_contract_version`, `source_display_mode`, `rag_trace`, `sources` ja `displayed_sources`.

### V2 Production/Admin Smoke

STATUS: active / partially implemented

V2 lisab eraldi kvaliteedikihi smoke skripti:

```text
npm run rag:smoke:v2
```

Skript: `scripts/smoke-rag-v2-quality.mjs`.

Käivitamiseks productioni vastu:

```text
SOTSIAALAI_SMOKE_BASE_URL=https://sotsiaal.ai
SOTSIAALAI_SMOKE_COOKIE="next-auth.session-token=..."
npm run rag:smoke:v2
```

Vajadusel saab kasutada bearer tokenit:

```text
SOTSIAALAI_SMOKE_BEARER="..."
npm run rag:smoke:v2
```

Chat trace'i V2 signaalide kontrollimiseks:

```text
npm run rag:smoke:v2 -- --chat
```

Pärast clean canonical reingest'i minimaalne kontroll:

```text
npm run rag:smoke:v2 -- --chat --legal-exact
npm run rag:smoke:v2
```

Täielikum kontroll:

```text
npm run rag:smoke:v2 -- --legal-exact
npm run rag:smoke:v2 -- --chat --legal-exact
npm run rag:smoke:legal-exact -- --all
npm run rag:smoke:v2
```

`--chat --legal-exact` on kõige olulisem legal smoke, sest see kontrollib RAG-service, chat, selected context ja displayed sources kihti.

Smoke kontrollib vähemalt:

- `/api/admin/analytics/summary` vastab admin autentimisega;
- `ragDocs.freshness.auditSource` näitab, kas freshness audit tuli Prisma `RagDocument` tabelist või RAG service `/documents` fallback'ist;
- `ragDocs.freshness.ragServiceFallbackCount` ja `ragServiceFallbackError` on olemas, et productionis oleks näha, kas fallback leidis registry dokumendid või ebaõnnestus;
- `ragDocs.freshness.summary.metadata_quality` sisaldab kokkuvõtte, collection ja file type jaotusi;
- smoke väljund näitab `freshnessReasons`, `missingRequiredFields` ja `missingRecommendedFields`, et re-ingest'i järel oleks kohe näha, kas `unknown_source_type`, `missing_last_checked` või muu metadata probleem vähenes;
- re-ingest'i kontrolliks saab smoke käsule anda lävendi, näiteks `--max-reason unknown_source_type=0 --max-reason missing_last_checked=0`;
- smoke väljundis on ka `metadataByCollection` ja `metadataByFileType`, et ajakirja, KOV, national RT või muu korpuse re-ingest'i mõju oleks eraldi mõõdetav; vajadusel saab kasutada `--min-collection-completeness ajakiri_sotsiaaltoo=0.95`;
- kvaliteedijärjekorra kirjetel on `collection_family`, `source_file_type`, `metadata_quality` ja `remediation`;
- remediation target sisaldab admin sihtlinki `admin_href`, action'it, parandatavate väljade loendit ning võimalusel `focus`/`file_key` sihti;
- `admin_href` query string sisaldab sama `focus`/`file_key` sihti, mis `remediation.target` objekt;
- `ragDocs.sourceQuality.summary` sisaldab `displayed_source_precision`, contract violation, retrieved/selected filter rate ja `wrong_municipality_rate` mõõdikuid;
- high-risk source freshness kokkuvõte ja järjekord on olemas;
- high-risk source freshness kokkuvõttes on olemas ka claim-kihi väljad: `high_risk_claim_source_count`, `stale_claim_source_responses` ja `claim_source_risk_readiness_rate`;
- `--chat` korral on `/api/chat` vastuse `rag_trace` sees `retrievers_used`, `query_plan` ja riskipoliitika signaal.

## Järgmised Plaanitavad Tööd

STATUS: active backlog

### V2 Maintenance Backlog

STATUS: active maintenance

1. Hoida smoke'id ja readiness auditid aktiivsed pärast iga reingest'i.
2. Parandada recommended `content_hash` KOV web/service allikatele.
3. Kui ajakirja artiklitele tekivad päris canonical URL-id, täita `url_canonical`; ära tee `source_path` väärtusest URL-i.
4. Teha organisatsioonide, template ja metoodikakorpuste readiness + ingest.
5. Laiendada golden set'i päris probleemvestluste põhjal.
6. Parandada artikli follow-up kvaliteeti ja BM25/full-text tuningut production näidete põhjal.
7. Hoida insufficient evidence sõnastus mittetehniline.

## V3 Roadmap And Architecture Maturity

STATUS: planned / staged implementation

V3 fookus ei ole uus otsingumootor, Qdrant migratsioon ega suur DB-migratsioon. V3 fookus on kontrollitud teadmuse kiht: `SourcePackage`, package-aware answering, tõendusrollid, claim/section attribution, admin quality workflow ja regressioonitestid.

V3 arhitektuurne küpsus tuleb sellest, et süsteem ei vali ainult õigeid chunk'e, vaid teab, mis tüüpi infot ta kasutab ja milleks seda tohib kasutada. Õigusakt, KOV määrus, KOV teenuseinfo, vorm, kontakt, juhend ja taustartikkel ei ole sama tüüpi tõendusallikad.

### V3.0A — Runtime SourcePackage Builder

STATUS: implemented and smoke-tested

V3.0A esimene praktiline skoop on runtime `SourcePackage` builder Jõgeva KOV piloodi peal. See ei ole veel persisted andmemudel ega package-aware answering, vaid kontrollkiht, mis koondab valitud kontekstiallikad sama `canonical_item_id` ja sama `municipality_id` põhjal ohutuks trace'itavaks paketiks.

Implementation status 2026-04-28:

- runtime builder on failis `lib/chat/sourcePackages.js`;
- `retrievalContextAssembler` ehitab `retrievalMeta.sourcePackages` valitud kontekstiallikatest;
- `mainResponseHandler` lisab safe kujul `rag_trace.source_packages`;
- `ragContext` kannab edasi package'i jaoks vajalikke metadata signaale nagu `resource_type` ja `sections_present`;
- testid katavad Jõgeva KOV teenuse package'i, vale KOV-i eraldi hoidmise, ajakirjaartikli välistamise current evidence sektsioonidest ja trace sanitiseerimise.

Eesmärk:

- koondada sama `canonical_item_id` ja sama `municipality_id` allikad kontrollitud paketiks;
- eristada sektsioonid `description`, `eligibility`, `application`, `forms`, `contacts`, `legal_basis`, `fees` ja `deadlines`;
- lubada KOV määrus `legal_basis` sektsioonis;
- lubada KOV service info `description`, `eligibility` ja `application` sektsioonides;
- lubada `official_contact` / `contact_page` allikad `contacts` sektsioonis;
- lubada `application_form`, `web_form` ja `pdf_form` allikad `forms` sektsioonis;
- mitte lubada `journal_article` allikat tänase õiguse, vormi, kontakti või kehtiva teenuseinfo kinnitamiseks;
- lisada `rag_trace.source_packages`;
- hoida olemasolevad legal exact smoke'id rohelisena.

Minimal `SourcePackage` kuju:

```json
{
  "package_id": "jogeva_vald_service_koduteenus_package",
  "canonical_item_id": "jogeva_vald_service_koduteenus",
  "package_type": "kov_service",
  "title": "Koduteenus",
  "municipality_id": "jogeva_vald",
  "sections": {
    "description": [],
    "eligibility": [],
    "application": [],
    "forms": [],
    "contacts": [],
    "legal_basis": [],
    "fees": [],
    "deadlines": []
  },
  "source_ids": [],
  "last_checked": "2026-04-28",
  "confidence": "medium",
  "missing_sections": []
}
```

V3.0A acceptance:

- Jõgeva teenuse või toetuse küsimus loob source package'i;
- `package.municipality_id = jogeva_vald`;
- vale KOV allikat ei panda paketti;
- KOV määrus võib minna `legal_basis` alla;
- vorm jõuab `forms` sektsiooni, kui sobiv vormiallikas on olemas;
- kontakt jõuab `contacts` sektsiooni, kui sobiv kontaktiallikas on olemas;
- ajakirjaartikkel võib olla background, aga mitte current legal/form/contact evidence;
- `rag_trace` sisaldab `source_packages` kokkuvõtet;
- legal exact smoke'id jäävad roheliseks.

V3.0A piirid:

- package ehitatakse runtime'is ainult valitud kontekstist;
- package ei ole veel persisted andmemudel;
- selected context ei ole veel täielikult package-aware, vaid package on trace'i ja järgmise arenduse kontrollkiht;
- package ei asenda legal exact retrieval'i ega displayed source attribution contract'i.

### V3.1 — Persisted SourcePackage Snapshot + Versioning

STATUS: deployed and DB-write smoke confirmed / not yet package-aware answering

SourcePackage salvestatakse snapshot'ina, mitte kohe käsitsi hallatava sisuna. Eesmärk on näha, milline pakett tekkis, millistest allikatest, millise hash'i ja versiooniga. V3.1 ei muuda veel vastust package-aware'iks; see jääb V3.2 skoobiks.

Vajalikud väljad:

- `package_id`
- `canonical_item_id`
- `municipality_id`
- `package_type`
- `title`
- `confidence`
- `package_hash`
- `last_built_at`
- `last_checked`
- `version`
- `section_summary`
- `source_membership`
- `missing_sections`
- `active`
- `status`: `active | needs_review | archived`

Oluline risk: persisted SourcePackage ei tohi muutuda "vanaks tõeks". Seetõttu peab olema version history, rebuild trigger pärast reingest'i või metadata muutust ning `needs_review` staatus, kui allikas vananeb või paketi sektsioon kaob.

Esimene V3.1 implementatsioon salvestab snapshot'i ja read-only admin loendurid. See ei lisa käsitsi sisuhaldust, claim-level attribution'it, retrieval migrationit ega package-aware answeringut.

Production confirmation:

- source package smoke lõi 3 Jõgeva KOV service package'i;
- korduv smoke ei loonud sama hash'i jaoks duplikaatversioone;
- active snapshot'id püsisid `version=1` väärtusega;
- mittetäielikud package'id märgiti korrektselt `needs_review` staatusesse.

### V3.2 — Package-Aware Answering

STATUS: implemented and production-smoked

Vastus ei tugine enam ainult valitud chunk'idele, vaid kasutab teenuse või toetuse kontrollitud SourcePackage'it.

- Kui vorm puudub, süsteem ei leiuta vormi.
- Kui kontakt puudub, süsteem ütleb, et kontaktiallikas puudub.
- Kui õiguslik alus on KOV määruses, viitab süsteem KOV määrusele.
- Kui allikas on ainult ajakirjaartikkel, ei kasutata seda tänase teenuse, vormi, kontakti või õiguse tõenduseks.

Production smoke confirmation:

- `npm run rag:smoke:source-packages -- --answering --persist` läbis;
- `rag_trace.package_aware_answering_used = true`;
- `used_package_ids`, `missing_sections_used` ja `package_displayed_source_ids` olid olemas;
- smoke kasutas Jõgeva KOV service package'e ning `missing_sections_used` sisaldas `forms`, `contacts`, `legal_basis`, `fees` ja `deadlines`;
- `SourcePackageSnapshot` persistence jäi tööle;
- `npm run rag:smoke:v2 -- --chat --legal-exact` jäi roheliseks;
- `npm run rag:smoke:v2` jäi roheliseks.

### V3.3 — Admin Review Workflow

STATUS: V3.3B admin review operations implemented at code/test level / production smoke pending

V3.3A/V3.3B lisavad `SourcePackageSnapshot` andmetele esimese admin review operatsioonikihi:

- admin saab SourcePackageSnapshot pakette listida;
- admin saab paketi detaili vaadata;
- admin näeb `missing_sections` ja arvutatud review flags signaale;
- admin saab teha `mark_reviewed` ja `archive`;
- admin saab teha `restore_active`, mis taastab vana snapshoti aktiivseks ilma mitme aktiivse versiooni konfliktita;
- admin detailis on review/audit history;
- admin saab teha ohutu `recompute` tegevuse, mis arvutab review state'i olemasoleva persisted metadata pealt uuesti;
- admin analytics näitab SourcePackage review loendureid;
- admin UI on read-only tabel minimaalse tegevusloogikaga.

V3.3C usability update muudab review lehe tööjärjekorraks:

- review reasons jagunevad `blocker`, `review` ja `info` severity tasemeteks;
- default queue näitab ainult aktiivseid `blocker`/`review` ridu;
- `fees` ja `deadlines` missing on info-only ega tekita üksi pending review rida;
- archived snapshotid on vaikimisi peidetud;
- iga nähtav reason sisaldab parandamise kohta: KOV detail link, canonical item id, sourceKeys ja failivihje (`<slug>.json -> items[] -> id = ... -> relatedForms`);
- `accept_gap` action salvestab admini override'i `SourcePackageSnapshotReviewEvent.metadata` alla ega muuda allikafakte;
- recompute ei tõsta aktsepteeritud info-only puuduseid tagasi pending queue'sse.

See ei ole käsitsi teenuseinfo sisuhaldus. V3.3 ei luba vorme, kontakte, õiguslikku alust ega teenusekirjeldust käsitsi muuta. `status` jääb automaatseks paketikvaliteedi väljaks (`active | needs_review | archived`), `reviewStatus` on admini review töövoog (`pending | reviewed | archived`).

V3.3B kasutab action log'i ja persisted review reason detaili, kuid ei tee veel käsitsi source membership muutmist ega package sisuhaldust. V3.4 claim/section attribution jääb järgmiseks suuremaks etapiks.

### V3.4 — Claim/Section Attribution For High-Risk Answers

STATUS: V3.4A section-level attribution foundation production confirmed / completeness and KOV-scope guardrail follow-ups implemented / V3.4B planned

V3.4A ei ole veel täielik claim-level attribution ega persisted claim store. See lisab esimese kitsama usalduskihi: package-aware või high-risk vastuse `rag_trace` sisaldab kompaktset `section_attribution` kokkuvõtet, mis seob `SourcePackage` sektsioonid ja `source_id` väärtused.

V3.4A trace väljad:

- `section_attribution`;
- `attribution_flags`;
- `package_attribution_checked`;
- `high_risk_attribution_checked`.

`section_attribution` kirje sisaldab ainult ohutuid tehnilisi välju: `package_id`, `section`, `source_ids`, `evidence_strength` ja `evidence_statuses`. Trace ei salvesta prompti, kasutajateksti, vastuse täisteksti, full claim text'i ega pikki allikakatkeid.

Missing sections on deterministlikult trace'is nähtavad. Kui `forms`, `contacts`, `legal_basis`, `fees` või `deadlines` puudub, tekib vastava sektsiooni kirje `evidence_strength = "missing"`, `evidence_statuses = ["missing_section"]` ja `source_ids = []`.

Legal exact rada on opt-out. `legal_exact` ja `legal_exact_paragraph` päringud ei kasuta SourcePackage section attribution'it ning nende `displayed_sources` enforcement jääb legal exact lepingusse.

V3.4B-sse jäävad täielik claim-level attribution, claim hashing, admin claim analytics ja võimalik persisted claim store. V3.4B ei ole eeldus KOV-i hard-scope vigade parandamiseks; need tuleb lahendada retrieval/planner/filter guardrail kihis enne claim attribution'it.

Post-confirmation audit layer:

- admin SourcePackage detail kuvab ohutut section attribution summary't, missing sections signaale, evidence strength/status väärtusi, attribution flags infot ja review reasons loetavas kujus;
- Jõgeva SourcePackage gap report kontrollib persisted snapshot'ite põhjal, millistel pakettidel puuduvad `forms`, `contacts`, `legal_basis`, `fees` või `deadlines`;
- raport eristab esialgselt põhjuseid `input_missing`, `mapping_missing`, `source_type_mismatch`, `inactive_or_historical` ja `unknown`;
- eesmärk on parandada package completeness enne V3.4B claim-level attribution'it.

Käsk:

```text
npm run rag:report:jogeva-sourcepackage-gaps -- --json logs/jogeva-sourcepackage-gap-report.json
```

Kõrge riskiga väited seotakse konkreetse allika, SourcePackage'i sektsiooni või claim attribution'iga.

Kõrge riskiga väited:

- õigus;
- toetus;
- summa;
- tähtaeg;
- vorm;
- kontakt;
- abikõlblikkus;
- menetlus;
- kriisiolukorra juhis.

Trace ei pea salvestama täit väiteteksti. Piisab ohututest väljadest:

- `claim_id`;
- `claim_type`;
- `package_id`;
- `section`;
- `source_ids`;
- `evidence_strength`.

V3.4A follow-up: Jogeva SourcePackage completeness fix

STATUS: production-confirmed for `legal_basis`, `forms` and `contacts` / conservative `fees`-`deadlines` mapping verified

The follow-up fixed the first package completeness issue found by the Jogeva gap report. The issue was not pure `input_missing`: the repository inputs contain Jogeva form/contact signals and the KOV regulation XML, but runtime package building and gap diagnostics did not use those relationships precisely enough.

Implemented behavior:

- `application_form`, `web_form` and `pdf_form` sources can populate the `forms` section when they belong to the same municipality and have a direct or related `canonical_item_id` link to the service package;
- `official_contact` and `contact_page` sources can populate the `contacts` section under the same conservative relation rule;
- Jogeva fallback resolver can use repository canonical JSON and `sources.json` data to resolve `relatedForms` and `relatedContacts` when live retrieval metadata does not carry those relations into the runtime builder;
- duplicate-prefixed snapshot canonical ids are normalized only for local canonical JSON lookup, not for package identity, so existing stable `packageId` / `canonicalItemId` values remain unchanged;
- same-municipality `kov_regulation` can populate `legal_basis`;
- `fees` and `deadlines` are mapped conservatively and do not become present only because a general KOV regulation exists;
- a generic same-municipality KOV regulation association is marked `partial`, not `strong`;
- KOV service/benefit chat retrieval adds a small supplemental same-municipality `kov_regulation` lookup so the registry RT candidate can reach the runtime SourcePackage builder;
- production-shaped RT metadata such as `source_type = "kov_regulation"`, `collection_id = "kov_regulations"`, `municipality_id = "jogeva_vald"` and `is_current_version = true` is normalized into active package evidence;
- KOV RT evidence normalizer accepts both `collection_id = "kov_regulations"` and `collection_id = "kov_legal"` for `source_type = "kov_regulation"` so production RT chunks and admin review logic do not disagree on the same layer;
- wrong municipality sources are excluded from the package;
- `journal_article` remains disallowed as current `forms`, `contacts`, `legal_basis`, `fees` or `deadlines` evidence;
- `national_law` is not used as an automatic substitute for KOV regulation in this fix;
- the gap report now includes `candidate_source_ids` for `mapping_missing` and `source_type_mismatch`, and returns `input_missing` when no candidate source exists.

Operational note:

- If production metadata carries `relatedCanonicalItemIds` or an equivalent relation, Jogeva forms and contacts can join the package directly.
- If live retrieval metadata does not carry those relation fields, the Jogeva fallback resolver can use `KOV/Jogeva/jogeva-vald/jogeva-vald.json` and `jogeva-vald.sources.json` as a safe local relation source.
- Jogeva KOV RT (`jogeva-vald-rt-406112024020`) can now reach `legal_basis` as `partial` evidence when it is retrieved as a same-municipality regulation candidate.
- Production confirmation after the full resolver follow-up: active Jogeva logical packages = `14`, duplicate normalized active package count = `0`, `forms` missing = `2`, `contacts` missing = `0`, `legal_basis` missing = `0`, `fees` missing = `14`, `deadlines` missing = `14`.
- Forms are present for `12/14` Jogeva packages and contacts are present for `14/14` packages when corresponding canonical relations and source records exist.
- The RT regulation reached `SourcePackage` `sourceMembership`, source-package attribution smoke was updated for present-or-missing `forms` / `contacts`, and `rag:smoke:v2 -- --chat --legal-exact` plus `rag:smoke:v2` stayed green.
- Source-package attribution smoke must no longer require `legal_basis` to be missing; after the RT mapping fix, `legal_basis` may be present with `kov_regulation` source ids and `partial` or `strong` evidence strength.
- Source-package attribution smoke must no longer require `forms` or `contacts` to be missing; when present, their `source_id` values must come from the package section and use allowed form/contact source types.
- `forms` and `contacts` may still remain missing only when no valid candidate package source exists.
- `fees` and `deadlines` must stay missing unless metadata, section hints or regulation text signals indicate those sections specifically.

Production check:

```text
npm run rag:report:jogeva-sourcepackage-gaps -- --summary-only --json logs/jogeva-sourcepackage-gap-report.json
npm run rag:smoke:source-packages -- --answering --persist --attribution
npm run rag:smoke:v2 -- --chat --legal-exact
npm run rag:smoke:v2
```

### V3.5 — Larger Regression System

STATUS: planned

Pärast package-aware answering ja high-risk attribution kihti kasvatatakse regressioonikomplekt 100–300 testini.

Testid peavad kontrollima:

- õige KOV;
- õige paragrahv;
- õige source type;
- current vs historical evidence;
- displayed sources ainult kinnitatud allikatest;
- missing section käsitlus;
- insufficient evidence;
- `journal_article` ei muutu current legal/form/contact evidence'iks.

### V3.6 — Multi-KOV Rollout In Waves

STATUS: source coverage loaded except Tallinn / quality rollout active

KOV/RT source coverage has moved past the original wave plan: source files for all KOVs except Tallinn are now in the database. The remaining rollout work is quality rollout, not just source ingestion.

Tallinn remains a separate exception and needs its own readiness/ingest/quality plan.

Historical expansion path:

1. Jõgeva pilot.
2. 3–5 eri suurusega KOV-i.
3. 10–15 KOV-i.
4. Suurem korpus.
5. Täiskorpus, except Tallinn until its separate track is completed.

The current next step is to prove quality across the all-KOV-except-Tallinn corpus:

- readiness audit;
- package build;
- package quality;
- legal exact smoke;
- V2 metadata smoke;
- manual UI küsimused;
- wrong municipality rate;
- displayed source precision.

### V3.7 — Optional Retrieval/Index Technology Review

STATUS: optional / future technology decision

V3.7 ei ole kohustuslik arendusetapp ega tipptaseme tingimus.

Uut otsingumootorit, Qdranti, tugevamat BM25 indeksit, rerankerit või eraldi SourcePackage index'it kaalutakse ainult siis, kui V3.0–V3.6 mõõdikud näitavad, et olemasolev retrieval/index kiht piirab kvaliteeti, recall'i, latency't või skaleerumist.

Kui olemasolev Chroma + lexical/BM25 kiht toetab SourcePackage pipeline'i piisavalt hästi, jääb V3.7 tegemata või lükkub tuleviku tehnoloogiauuenemiseks.

### Architecture Maturity Definition

STATUS: design criterion

SotsiaalAI RAG-i võib lugeda arhitektuuriliselt tipptasemele jõudnuks siis, kui iga kõrge riskiga vastuse puhul on automaatselt jälgitav:

- milline intent, riskitase, KOV või õigusraam tuvastati;
- millised allikad leiti;
- millised allikad valiti;
- milline SourcePackage koostati;
- millised package sektsioonid olid olemas või puudu;
- millised allikad konkreetseid olulisi väiteid kinnitasid;
- miks mõni allikas välja jäeti;
- miks just need allikad kasutajale kuvati;
- kas admin saab puuduse parandada;
- kas regressioonitestid püüavad kinni vale KOV-i, vale paragrahvi, vale allikatüübi ja kasutamata allika kuvamise.

Tipptase ei tule ainult uuest otsingumootorist. Tipptase tuleb sellest, et süsteem kontrollib teadmuse struktuuri, allikatüüpe, tõendusrolle, väiteid, kuvatavaid allikaid ja kvaliteediprobleeme.

## Data Contracts

STATUS: active contract / evolving

Pipeline'is liikuvad põhiobjektid peavad olema eristatavad:

- `RetrievalCandidate` - otsingukanalist leitud allikas või chunk koos score'i ja metadata'ga.
- `SelectedContext` - mudelile saadetav kontrollitud kontekstiosa.
- `SourcePackage` - canonical item'i ümber koostatud tervikpakett.
- `AnswerSource` - allikas, mida vastus deklareerib kasutatuks.
- `DisplayedSource` - serveri kinnitatud kasutajale nähtav allikas.
- `AttributionDecision` - otsus allika kuvamise või peitmise kohta koos põhjusega.
- `RagTrace` - retrieval'i, attribution'i, filtering'u ja kuvamise tehniline jälg.

Need objektid ei tohi segada `source_id`, `document_id`, `chunk_id` ja `canonical_item_id` tähendust.

## Rollout Plan

STATUS: partially completed / historical

V1 tuleb sisse lülitada järk-järgult:

1. `shadow mode` - uus trace ja attribution decision'id logitakse, aga UI käitumist ei muudeta.
2. `admin-only trace` - admin/debug vaates saab võrrelda retrieved, selected, answer ja displayed allikaid.
3. `partial source filtering` - allikapaneel kasutab uut loogikat valitud juhtudel või feature flag'i taga.
4. `full displayed_sources enforcement` - allikapaneel kuvab ainult serveri kinnitatud `displayed_sources`.

## Privacy Boundary For RAG Trace

STATUS: active policy

RAG trace peab vaikimisi salvestama tehnilised otsused ja allikaidentifikaatorid, mitte kogu kasutaja sisendit, täit model context'i ega delikaatseid juhtumikirjeldusi.

Trace võib salvestada:

- source id-d;
- attribution decisions;
- filter reasons;
- retrieval counts;
- source type;
- risk level;
- latency;
- token usage.

Trace ei peaks vaikimisi salvestama:

- täit kasutaja küsimust, kui see sisaldab tundlikku isikuinfot;
- kogu mudelile saadetud konteksti;
- kasutaja faile või dokumentide sisu;
- delikaatseid kliendiandmeid.

Kui detailsem debug-logi on arenduses ajutiselt vajalik, peab see olema piiratud ligipääsuga ja ajaliselt piiratud.

## Remaining Open Decisions

STATUS: active decisions

- Kas `answer_sources` ja `displayed_sources` salvestatakse `ConversationMessage.metadata` sisse või eraldi tabelitesse?
- Kas `canonical_item_id` tekib ingestis automaatselt või admini kinnitusega?
- Milline on persisted `SourcePackage` täpne DB schema V3.1-s?
- Milline rebuild trigger strategy valida pärast reingest'i, source metadata muutust või stale source signaali?
- Kuidas admin review workflow piirata nii, et see ei muutuks käsitsi sisuhalduseks?
- Milline on claim text privacy mudel: `text_hash` vs excerpt-free `claim_id`?
- Millal ja kuidas teha Tallinna eraldi ingest/readiness rada ning kuidas tõendada kvaliteeti kogu all-KOV-except-Tallinn korpuse peal?
- V3.7 retrieval/index technology review on optional: Chroma, Postgres full-text, tugevam BM25, reranker, Qdrant või eraldi SourcePackage index vaadatakse üle ainult siis, kui mõõdikud näitavad vajadust.

## V3 Conceptual Target State

STATUS: conceptual / superseded by V3 Roadmap And Architecture Maturity

See plokk kirjeldab V3 üldist kontseptsiooni. Konkreetne staged roadmap ja prioriteedid on plokis `V3 Roadmap And Architecture Maturity`. Kui tekib vastuolu, kehtib roadmap'i plokk.

V3 tähendab SotsiaalAI RAG-is küpset tootetasemel teadmussüsteemi, mitte ainult parandatud otsingut.

```text
V1 = tee praegune RAG kontrollitavaks
V2 = tee otsing ja kvaliteedipoliitika paremaks
V3 = tee teadmussüsteem struktureeritud, tõendatavaks ja skaleeritavaks
```

V3-s ei ole RAG enam ainult:

```text
küsimus -> otsing -> paar lõiku -> AI vastus
```

vaid:

```text
küsimus
-> rolli, riski, KOV-i ja teema tuvastus
-> hübriidotsing ja metadata filtrid
-> source package
-> evidence policy
-> vastus
-> kinnitatud allikad
-> trace
-> testid ja admin-kontroll
```

### V3 Core Capabilities

STATUS: design target

V3 põhivõimekused:

- täielik `SourcePackage` andmemudel KOV teenuste, toetuste, vormide, kontaktide ja õigusliku aluse jaoks;
- claim-level attribution kõrge riskiga väidetele;
- 100-300 küsimusega regressioonitestide komplekt;
- kvaliteedimõõdikud nagu `source_recall`, `source_precision`, `displayed_source_precision`, `unsupported_claim_rate`, `wrong_municipality_rate`, `stale_source_rate` ja `insufficient_evidence_correctness`;
- admini kvaliteeditöövoog vananenud, vastuoluliste, puudulike või kinnitamata allikate jaoks;
- optional retrieval/index technology review ainult siis, kui trace ja regressioonid näitavad, et olemasolev otsingukiht jääb kvaliteedi, recall'i, latency või skaleerumise piiranguks.

### V3 Source Package

STATUS: design target

V3-s on KOV teenus või toetus struktureeritud objekt, mitte ainult hulk chunk'e.

```json
{
  "canonical_item_id": "tartu_linn_service_koduteenus",
  "type": "kov_service",
  "title": "Koduteenus",
  "municipality_id": "tartu_linn",
  "sections": {
    "description": {},
    "eligibility": {},
    "application": {},
    "forms": [],
    "contacts": [],
    "legal_basis": [],
    "fees": {},
    "deadlines": {}
  },
  "source_ids": [],
  "last_checked": "2026-04-25",
  "status": "active",
  "confidence": "high"
}
```

See võimaldab küsida otse:

- mis teenus see on;
- kellele see kehtib;
- kuidas taotleda;
- milline vorm on õige;
- kes on kontakt;
- mis on õiguslik alus;
- kas info on kehtiv;
- millised allikad seda kinnitavad.

### V3 Claim-Level Attribution

STATUS: design target

V3-s liigub süsteem kõrge riskiga väidete puhul väitepõhise tõenduse poole.

```json
{
  "claim_id": "claim_1",
  "claim_type": "eligibility_or_assessment",
  "text_hash": "...",
  "package_id": "jogeva_vald_service_koduteenus_package",
  "section": "eligibility",
  "source_ids": ["..."],
  "evidence_strength": "strong"
}
```

Trace ja claim attribution ei salvesta täit väiteteksti, prompti ega kasutaja teksti. Kasutatakse piiratud tehnilisi viiteid nagu `claim_id`, `claim_type`, `text_hash`, `package_id`, `section`, `source_ids` ja `evidence_strength`.

Claim-level attribution on eriti oluline järgmiste väidete puhul:

- õigus;
- toetus;
- summa;
- tähtaeg;
- abikõlblikkus;
- kontakt;
- vorm;
- kehtivus;
- KOV-spetsiifiline tingimus.

### V3 Maturity Notes

STATUS: design target

V3 valmisolek ei tähenda ainult uute funktsioonide olemasolu. V3 peab olema auditeeritav, mõõdetav ja hooldatav teadmussüsteem.

Source versioning:

- iga allikas peab olema versioonitav või vähemalt `content_hash` ja `last_checked` põhiselt auditeeritav;
- vastuse trace peab näitama, millise allika seisu põhjal vastus koostati;
- vormi, kontakti või määruse muutumisel peab olema võimalik aru saada, millal vana info asendus.

Claim store:

```json
{
  "claim_id": "claim_1",
  "claim_type": "application_step",
  "text_hash": "...",
  "package_id": "jogeva_vald_service_koduteenus_package",
  "section": "application",
  "source_ids": ["..."],
  "evidence_strength": "strong"
}
```

Claim store ja trace ei salvesta täit väiteteksti, prompti ega kasutaja teksti. Vajadusel kasutatakse `text_hash` väärtust, et sama väidet tehniliselt võrrelda ilma sisu logimata.

Temporal reasoning:

- süsteem peab eristama praegu kehtivat infot, ajaloolist infot ja aastal X kehtinud infot;
- vana artikkel võib olla metoodiline taust, aga mitte tänase toetuse, vormi, tähtaja või kontakti tõendus;
- kui kasutaja küsib ajaloolist infot, ei tohi süsteem seda automaatselt tänaseks infoks muuta.

Source conflict resolution:

- kui teenuseleht ja määrus on õigusliku väite puhul vastuolus, eelistatakse kehtivat määrust või seadust;
- kui vorm ja teenuseleht erinevad taotlemiskanali osas, märgitakse vastuolu ja suunatakse kontrollima KOV-ist;
- vastuolu ei tohi vastuses ära siluda.

Knowledge operations:

- admin peab nägema stale allikaid, katkisi linke, muutunud vorme ja puudulikku metadata't;
- source package peab olema vajadusel käsitsi kinnitatav;
- admin peab saama märkida, et allikas on ainult taust, mitte tõendus;
- vastuoluline allikapaar peab jõudma ülevaatuse järjekorda.

Reproducible answers:

- V3 trace peab võimaldama taastada query planner output'i, valitud allikad, source package'i versiooni, prompt contract'i, mudeli versiooni ja lõplikud `displayed_sources`;
- täielikku tundlikku kasutajasisendit ei pea selleks vaikimisi salvestama.

Domain ontology:

- `koduteenus`, `koduhooldus` ja `abi kodus` peavad olema seostatavad mõisted;
- `hooldajatoetus`, `hoolduse seadmine` ja `puudega isiku hooldaja toetus` tuleb eristada;
- `sotsiaaltransport`, `invatransport`, `sõiduteenus` ja transport ravile võivad olla eri KOV-ides erineva sisuga;
- riiklik toetus ja KOV toetus peavad olema eraldi kategooriad.

V3 evaluation gates:

```text
displayed_source_precision >= 0.95
wrong_municipality_rate <= 0.02
unsupported_claim_rate <= 0.05
stale_source_rate high-risk answers <= 0.01
insufficient_evidence_correctness >= 0.90
```

Need numbrid on algsed sihid, mitte lõplikud lepingulised lubadused. Oluline on, et V3 kvaliteeti mõõdetakse, mitte ei hinnata ainult tunde järgi.

### V3 Acceptance Criteria

STATUS: design target

V3 loetakse tehtuks, kui:

- KOV teenused, toetused, vormid ja kontaktid on esindatud source package objektidena;
- kõrge riskiga väited on claim-level attribution'iga kaetud;
- allika versioon ja kehtivus on auditeeritavad;
- süsteem tuvastab ja märgib allikakonflikte;
- admin saab hallata stale, puudulikke ja vastuolulisi allikaid;
- regressioonikomplektis on vähemalt 100-300 juhtumit;
- mõõdetakse unsupported claim, wrong KOV, stale source ja displayed source precision näitajaid.

### V3 Limits

STATUS: design target

Ka V3 ei tee süsteemi eksimatuks.

- Kui KOV veebileht on puudulik, vana või segane, saab süsteem ainult ausalt öelda, et allikas ei kinnita.
- Õigusaktide ja KOV määruste kehtivust saab kontrollida paremini kui tavaliste veebilehtede ja vormide ajakohasust.
- Mõnes sotsiaaltöö juhtumis ei ole üks õige vastus; süsteem peab toetama mõtlemist, mitte otsustama inimese või organisatsiooni eest.
- KOV-info killustatus nõuab pidevat hooldust ja admini kvaliteedikontrolli.
- Platvorm ei asenda ametlikku otsust, juhtumikorraldust ega õigusnõustamist.

V3 suurim tugevus ei ole see, et süsteem leiab rohkem infot, vaid see, et ta teab, mida ta teab, mida allikas ei kinnita, millist allikat ta kasutas ja miks kasutajale just need allikad kuvati.

## Praeguse Süsteemi Failikaart

STATUS: reference / active map

### Vestluse API Ja Orkestreerimine

STATUS: reference / active code map

- `app/api/chat/route.js` - peamine chat endpoint; ühendab bootstrap'i, töövood, RAG konteksti ja vastuse genereerimise.
- `lib/chat/requestBootstrap.js` - autentimine, sisendi normaliseerimine, ajalugu, roll, keel, greeting, töövoo olekud.
- `lib/chat/mainResponseHandler.js` - OpenAI vastuse kutsumine/streamimine, vastuse finaliseerimine, allikate filtreerimine.
- `lib/chat/workflowBranchHandlers.js` - dokumendi- ja abisoovi/abipakkumise töövoogude harud.
- `lib/chat/orchestrationPolicy.js` - otsustab üldise orkestreerimisplaani.
- `lib/chat/modeSelection.js`, `lib/chat/workflowModeRouting.js` - vestluse töörežiimi valik ja suunamine.

### Promptid Ja OpenAI Vastus

STATUS: reference / active code map

- `lib/chat/promptBuilder.js` - Responses API sisendi koostamine, RAG_CONTEXT, grounding, greeting strings, max tokenid.
- `lib/chat/openaiRuntime.js` - `callOpenAI`, `streamOpenAI`, Responses API payload.
- `lib/chat/systemPrompts/index.js` - keelepõhiste süsteemipromptide valik.
- `lib/chat/systemPrompts/et.js` - eesti süsteemiprompt.
- `lib/chat/systemPrompts/en.js` - inglise süsteemiprompt.
- `lib/chat/systemPrompts/ru.js` - vene süsteemiprompt.
- `lib/chat/systemPrompts/common.js` - promptide renderdamise abifunktsioonid.

### RAG Vajaduse Tuvastus, Otsing Ja Kontekst

STATUS: reference / active code map

- `lib/chat/sourceNeed.js` - otsustab, kas pöörde jaoks on vaja väliseid allikaid/RAG-i.
- `lib/chat/retrievalContextAssembler.js` - RAG pipeline'i keskne koostaja: võtab planneri otsuse, käivitab otsingu, koostab konteksti ja allikad.
- `lib/chat/queryPlanner.js` - Query Planner V2: koostab RAG päringud, filtrid, topK, selection strategy, context group target ja `query_plan` trace'i.
- `lib/chat/retrievalOrchestrator.js` - RAG päringu ehitus, source lookup tuvastus, RAG service `/search` kutsumine, dedupe.
- `lib/chat/retrievalPlanning.js` - ajatelje/aastate kaupa retrieval, temporal query'd ja juhised.
- `lib/chat/requestContext.js` - omavalitsuse, hiljutise teksti ja ajutiste dokumentide konteksti abiloogika.
- `lib/chat/ragContext.js` - match'ide normaliseerimine, grupeerimine, ranking, MMR, kontekstiplokkide renderdamine.
- `lib/chat/safety.js` - kriisi tuvastus ja grounding strength.
- `lib/chat/settings.js` - RAG ja mudeli env seadistused (`RAG_TOP_K`, `RAG_CONTEXT_GROUPS_MAX`, `RAG_API_BASE`, jne).
- `lib/chat/sourceAttribution.js` - vastusepõhine allikafiltreerimine: `answer sources` -> `displayed sources`.

### Salvestamine, Metadata Ja Allikate Kuvamine

STATUS: reference / active code map

- `lib/chat/responseFinalizer.js` - vastuse JSON/SSE finaliseerimine, allikate/attachmentide salvestus.
- `lib/chat/persistence.js` - vestluse ja assistendi sõnumi salvestus, metadata `sources`.
- `components/chat/hooks/useChatStream.js` - frontendi chat stream, `meta`, `delta`, `done`, allikate vastuvõtt.
- `components/chat/hooks/useConversationSources.js` - vestlussõnumitest allikapaneeli allikate koondamine.
- `components/chat/utils/sources.js` - allikate normaliseerimine ja label'i koostamine.
- `components/alalehed/chat/ChatSourcesPanel.jsx` - kasutajale kuvatav `Vastuste allikad` paneel.
- `components/chat/LeftRail.jsx`, `components/chat/RightRail.jsx`, `components/alalehed/chat/view/ChatMobileTopNav.jsx` - allikapaneeli nupud ja olek.

### RAG Service

STATUS: reference / active code map

- `rag-service/main.py` - FastAPI RAG service, OpenAI embeddings, Chroma, upload/search endpointid, registry ja observability headerid.
- `rag-service/requirements.txt` - RAG service Python sõltuvused.

### RAG Ingest Ja Admin

STATUS: reference / active code map

- `scripts/ingest-kov-rag.mjs` - KOV RAG pakettide ingest.
- `scripts/validate-kov-rag.mjs` - KOV `sources.json`, `data.json`, `meta.json`, `rag.md` valideerimine.
- `scripts/ingest-national-rt-xml.mjs` - riikliku Riigi Teataja XML ingest.
- `scripts/ingest-ajakiri-sotsiaaltoo.mjs` - Sotsiaaltöö ajakirja artiklite ingest.
- `scripts/reindex-rag-documents.mjs` - dokumentide reindex.
- `scripts/inventory-kov-rag-state.mjs` - KOV RAG/SourcePackage/admin workflow inventory; read-only.
- `scripts/cleanup-kov-rag-state.mjs` - safe KOV cleanup/reset; dry-run-first, `--write --confirm-cleanup` required for destructive work.
- `scripts/lib/kov-rag-state.mjs` - shared KOV cleanup/inventory helpers, including admin workflow reset planning.
- `lib/admin/rag/kov/service.js` - KOV admin, failid, kontroll, ingest ja generic KOV metadata normaliseerimine `meta.json` -> RAG document/chunk metadata.
- `lib/admin/rag/kov/validation.js` - KOV failide valideerimine.
- `lib/admin/rag/kov/rtXml.js` - KOV/Riigi Teataja XML parser ja chunk'id.
- `lib/admin/rag/kov/shared.js`, `storage.js`, `api.js` - KOV admini abikihid.
- `lib/admin/rag/sourcePackages/service.js` - SourcePackageSnapshot admin review service: severity queue, accepted gap metadata, recompute, archive/restore.
- `components/admin/rag/RagAdminSourcePackagesScreen.jsx` - SourcePackage review UI: active blocker/review queue, info/archive filters, repair hints.
- `app/api/admin/rag/source-packages/[id]/review/route.js` - SourcePackage review actions including `accept_gap`.
- `lib/admin/rag/organizations/service.js` - organisatsioonide RAG admin ja ingest.
- `lib/admin/rag/organizations/validation.js` - organisatsiooni failide valideerimine.
- `app/api/admin/rag/**` - RAG admin API endpointid KOV, organisatsioonide ja national RT jaoks.
- `app/api/admin/rag/document-status/[docId]/route.js` - admini server-side dokumentide seisu päring; kasutab authitud RAG service call'i nii KOV web kui RT doc status jaoks.

### Andmebaas Ja Logid

STATUS: reference / active code map

- `prisma/schema.prisma` - `RagDocument`, `Conversation`, `ConversationMessage`, `ConversationRun`, `ChatLog`, KOV/organization admin mudelid.
- `lib/chat/logger.js` - chat/RAG sündmuste logimine `ChatLog` tabelisse.
- `app/api/admin/analytics/summary/route.js` - RAG logide ja dokumentide admin-kokkuvõte.
- `app/api/admin/analytics/users/route.js` - kasutajapõhine RAG/chat kasutuse statistika.
- `app/api/admin/analytics/ai-costs/route.js` - AI/RAG kulude kokkuvõte.

### Testid

STATUS: reference / active test map

- `tests/chat/queryPlanner.test.js` - Query Planner V2 plaani, filtrite, broad/source-focused käitumise ja KOV laiendatud päringute testid.
- `tests/fixtures/query-planner-v2-cases.json` - Query Planner V2 eval-fixture planner mode'ide ja filtrite regressiooniks.
- `tests/chat/municipalityDetection.test.js` - KOV nime ja tüüpi sisaldavate käändevormide regressioonid ning asula/asumi alias fallback, sh `Viljandi valla` -> `viljandi_vald`, `Viljandi linna` -> `viljandi_linn`, `Ihastes` -> `tartu_linn` ja `Kaberneeme` -> `joelahtme_vald`.
- `tests/rag/kovAdminValidation.test.js` - KOV admin `sources.json` validaatori regressioonid V2.5 `source_id/source_type` ja legacy `key/type` kujule.
- `tests/chat/sourceNeed.test.js` - RAG vajaduse tuvastus.
- `tests/chat/retrievalOrchestrator.test.js` - RAG päringute, follow-up source anchoring'u, hübriidkanalite ja source filter merge'i testid.
- `tests/chat/sourceAttribution.test.js` - vastusepõhine allikafiltreerimine.
- `tests/chat/ragTraceMetadata.test.js` - `rag_trace`, allikakihtide ja `query_plan` metadata testid.
- `tests/chat/ragContextRanking.test.js` - teema vihjete põhine ranking ning wrong-KOV post-filter regressioon.
- `tests/chat/conversationSources.test.js` - allikapaneeli jaoks sõnumitest allikate kogumise ja `displayed_sources` eelistamise testid.
- `tests/chat/promptStyle.test.js` - prompti stiil, tervitused ja ajakontekst.

## Esmane Analüüsisuund

STATUS: historical / superseded by current V2 backlog

Järgmises analüüsis vaadata järjest:

1. `sourceAttribution.js`, `mainResponseHandler.js`, `useChatStream.js`, `useConversationSources.js` - kas `displayed sources` on piisavalt aus ja kas attribution decision'id on logitavad.
2. `retrievalContextAssembler.js`, `retrievalOrchestrator.js`, `ragContext.js` - kuidas `retrieved candidates` muutuvad `selected context sources` kihiks.
3. `rag-service/main.py` - kas search toetab piisavat metadata filtering'ut, phrase/title/BM25 hübriidi ja trace'i.
4. `scripts/validate-kov-rag.mjs`, `scripts/ingest-kov-rag.mjs`, `lib/admin/rag/kov/service.js` - kas ingest toodab source package'i jaoks piisavalt struktuuri.
5. `prisma/schema.prisma` - kas andmemudel toetab source type, canonical item, answer source ja trace kihte.

## Lõppeesmärk

STATUS: active principle

SotsiaalAI RAG-i eesmärk ei ole leida võimalikult palju sarnaseid tekstikatkeid, vaid koostada kontrollitud tõenduspakett, mille põhjal saab anda rolli, aja, KOV-i ja allikatüübi suhtes usaldusväärse vastuse.
