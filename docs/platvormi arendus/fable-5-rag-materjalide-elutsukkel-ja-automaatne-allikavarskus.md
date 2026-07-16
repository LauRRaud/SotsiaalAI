# RAG-i materjalide elutsükkel ja automaatne allikavärskus

> Fable 5 analüüs, 2026-07-15. Sügav tehniline, toote-, usaldus-, operatiiv- ja testimisanalüüs aktiivse `main`-i vastu.
> See on analüüs ja rakendusplaan, MITTE teostuse, merge'i ega deploy otsus.
> Rakenduskoodi, skeemi ega migratsioone ei muudetud; ühtegi kirjutavat RAG-toimingut ei käivitatud.

**Põhiküsimused:**

1. kas SotsiaalAI praegune RAG-süsteem on terviklikult kasutus- ja produktsioonivalmis;
2. kuidas liigub materjal algallikast kinnitatud RAG-versioonini;
3. kuidas olemasolevat allikat parandatakse, uuendatakse, aegunuks märgitakse ja eemaldatakse;
4. kuidas saaks ametlike veebiallikate, KOV-kontaktide, vormide ja teenuseinfo muutusi automaatselt avastada;
5. millised muudatused võib süsteem rakendada automaatselt ja millised vajavad inimese kinnitust;
6. milline päris eval- ja regressioonipakett tõendab, et vastused on õiged, värsked, allikapõhised ja audience'i järgi eraldatud.

> **Täiendus 15.07:** peatükk 14 käsitleb `master_sources_final.json`-i kui kanoonilist lingiregistrit ja platvormiülest URL-allikate korjet — master-listi PDF ise on RAG-is olemas; puudu on lingitud veebilehtede sisu andmekorje.

---

## 1. Praeguse RAG-arhitektuuri kaart

### 1.1 Komponendid aktiivses koodis

| Lüli | Kus | Seis | Märkused |
|---|---|---|---|
| RAG-teenus | `rag-service/main.py` (FastAPI, ~4890 rida) | `TÖÖTAB` | ChromaDB `PersistentClient` (lokaalne kettasalvestus `STORAGE_DIR/chroma`) + JSON-registrifail (`_load_registry`/`_save_registry`). Üksainus protsess, üks kollektsioon. API-võti (`X-API-Key`) kohustuslik igal endpointil. |
| Käivitamine | systemd `sotsiaalai-rag.service`; Next.js räägib `127.0.0.1:8000` | `TÖÖTAB` | `deploy-server.mjs` restardib teenuse deploy'l. `ALLOW_EXTERNAL_RAG=1` puudumisel keeldub frontend mitte-lokaalsest hostist ([ragService.js:49](lib/documents/ragService.js:49)). |
| Ingest | `/ingest/file`, `/ingest/text`, `/upload`, `/ingest/pdf-with-metadata`, `/ingest/url`, `/ingest/articles` + ~15 npm-skripti (`rag:ingest:kov`, `rag:ingest:rt-national`, `rag:ingest:ajakiri`, `knowledge:folder:*`, `organization:ingest*`, `knowledge:source-master:*`) | `TÖÖTAB` | Skriptid on dry-run-vaikimisi ja valideerivad metaandmed enne saatmist. Ingest on **käsitsi käivitatav** (CLI või admin-API), mitte ajastatud. |
| Chunkimine | `main.py` (`CHUNK_MODE=tokens`, 700 tokenit / 120 kattuvust; fallback 1200/200 tähemärki) | `TÖÖTAB` | Deterministlik; PDF-ile TOC/pealkirja-sektsioonisignaalid (`--analyze-pdf`). |
| Embedding | OpenAI `text-embedding-3-large`; alam-partiid ≤96 sisendit / ≤200k tokenit | `TÖÖTAB` | Suurte dokumentide BadRequest parandatud 2026-06-12 (462–863 chunki dokumendid kinnitatud). |
| Dokumendi ja versiooni mudel | rag-service'i registrikirje `doc_id` kaupa (`type` FILE/URL/TEXT, `lastIngested`, meta) | `OSALINE` | **Versioone ei ole**: `_replace_document_vectors` kustutab ja kirjutab sama `doc_id` üle. Versioonimus elab doc_id konventsioonides: praktikad `publicId:v<versioon>`, kasutajadokumendid `agent::<id>::<sha256>`, KOV/teadmusdokid stabiilne id + ülekirjutus. |
| Prisma `RagDocument` | `prisma/schema.prisma:1053` | `EKSITAVALT LUBATUD` | Skeemis rikas mudel (status PENDING/PROCESSING/COMPLETED/FAILED, audience, remoteId), aga aktiivses koodis kasutavad seda ainult analytics-summary ja `rag:audit:freshness --db`. Admin-RAG-UI käib läbi proxy (`app/api/rag/[...path]/route.js`) otse rag-service'i registrisse — DB-peegel EI ole tõeallikas ega ole sünkroonis. |
| Metadata-leping | `lib/rag/sourceMetadata.js` (874 rida; skeemiversioon v2.5) | `TÖÖTAB` | Kanooniline: `source_type`, `source_status` (active/inactive/stale/archived/unknown), `authority`, `last_checked`, `url_canonical`, `content_hash`. Backfill 2026-06-11: 5547/5547 paika. |
| Retrieval | `POST /search`: dense (Chroma) + leksikaalne BM25 (tiitli/keha kaalud) + RRF; retrieverid `dense`/`bm25`/`title_match`/`exact_phrase` | `TÖÖTAB` | Filtrid caller'i `where`-klauslist (audience, doc_id, collection_id, municipality, year, tag_tokens, historical, $or). **Teenus ise ei sunni ühtegi filtrit peale** — eraldatus sõltub kutsujast. |
| Hybrid search | sama `/search` + runtime `retrievalOrchestrator.js` (päringuvariandid, multi-query) | `TÖÖTAB` | Smoke: `rag:hybrid:test`. |
| Reranking | RRF teenuses + `ragContext.js` grupeerimine/mitmekesistamine + `retrievalStrategySelector.js` | `OSALINE` | Cross-encoder/LLM-rerankerit ei ole; mitmekesisus on heuristiline (overview diversity-then-depth). |
| Vastuse koostamine | `lib/chat` konveier: `requestBootstrap` → `retrievalContextAssembler` → `retrievalOrchestrator` → `ragContext` → `evidencePackage`/`sourcePackages` → `promptBuilder` → `mainResponseHandler` | `TÖÖTAB` | Deterministlik `questionPlanner.js` + režiimid (overview_synthesis, resource_discovery, life_situation_guidance, comparison, legal_exact, KOV). |
| Allikaviited | `sourceAttribution.js` + displayed-source leping + `sourceQualityMetrics.js` | `TÖÖTAB` | Kuvatud allikad filtreeritakse valitud kontekstist; kontraktirikkumised (displayed-not-in-selected, vale KOV) mõõdetavad trace'ist. |
| Kasutaja dokumendid | `UserDocument` → `ensureDocumentIndexed` (laisk, sha256-värskuskontroll) → otsing `searchDocumentChunks` `doc_id $in` + `collection_id=agent_documents` | `TÖÖTAB` | Kustutus: `deleteDocumentRagReference` → `DataDeletionJob` (RAG_DELETE) + audit; 404 = idempotentne edu. |
| Spetsialisti esitatud materjalid | `MaterialSubmission` (pending/reviewed/rejected/imported) + admini e-kiri + `/materjalid` admin-vaade | `ERALDI TORU` | **RAG-i ühendus puudub täielikult**: „imported" on käsitsi staatus; faili peab admin ise alla laadima ja teise toru kaudu (admin-RAG-UI / knowledge-folder skript) sisestama. Esitaja staatusevaadet aktiivsest koodist ei leidnud (GET on admin-only). |
| KOV-allikad | `KOV/<slug>` failipaketid (`<slug>.sources.json`, `<slug>.rag.md`, …) + `rag:ingest:kov` + admin-API (`light-check`, `revalidate`, `ingest`, `reset-rag-state`) | `TÖÖTAB` | Sisu-tõeallikas on **failisüsteemi register** (repo/serveri kaust), mitte DB. |
| Riigi Teataja | `rag:ingest:rt-national` (XML), KOV-RT manifest (`kov_rt_manifest.json`) + `kov:rt:check-web`/`apply-check`; registriväljad `act_reference`, `effective_start/end`, `is_current_version` | `TÖÖTAB` | Redaktsiooniteadlikkus on metaandmetes olemas; kehtivuse kontroll on käsitsi skript. |
| Organisatsioonide allikad | `organization:ingest` (4-faili pakett) + `lib/admin/rag/organizations` | `TÖÖTAB` | Astangu attributsiooniparandus tõestas identiteediväljade lepingu vajalikkuse. |
| Teenuseprofiilid | `ServiceProviderProfile` → `syncServiceProviderProfileToRag` (`service_provider_profiles` kollektsioon; `ragSourceId`/`ragMetadata`; saadavuse sünk) | `TÖÖTAB` | Ainuke „rakendus kirjutab RAG-i automaatselt" toru peale praktikate; sünk toimub profiili salvestusel, ebaõnnestumine jätab `syncStatus: failed` meta. |
| Avaldatud parimad praktikad | `EffectivePractice` → deterministlik `publicId:v<N>` → `RAG_INGEST` retry-tööd (backoff 1min·2ⁿ, max 8) + `RAG_DELETE` järjekord + purge; `practices:rag:drain` / `--verify-only` | `TÖÖTAB` | Küpseim elutsükkel repos: fail-closed deploy-värav (`practices:deploy-gate`), superseded-ingest'i koristus, versioonivalve (`RAG_DOCUMENT_ID_MISMATCH`). |
| Source package'id | runtime `sourcePackages.js` + `SourcePackageSnapshot` (packageHash + versiooninumber + review-staatus + review-sündmused) + gap-report + forms/contacts audit | `TÖÖTAB` | Ainus koht, kus on päris *versioonihoidla* (unique `[packageId, version]`, `[packageId, packageHash]`). |
| Allikate tagasiside | `SourceFeedback` mudel + `/api/source-feedback` + admin-resolve (`lib/sourceFeedback.js`) | `TÖÖTAB` | Kategooriad + dedupeKey; staatus OPEN→resolved. Ühendus konkreetse RAG-dokumendi parandusega on käsitsi. |
| Kustutamisjärjekord + retry | `DataDeletionJob` (action RAG_DELETE/RAG_INGEST, `nextAttemptAt`, `maxAttempts`, `lastErrorCode`) + `retryDeletionJob` + drain-skriptid | `TÖÖTAB` | Kandja on üldine; praktikad ja kasutajadokumendid kasutavad; KOV/teadmusdokumentidel kustutusjärjekorda EI ole (kustutus on sünkroonne skript/admin-nupp). |
| Scheduler'id | — | `PUUDUB` | Repo-s ei ole ühtegi RAG-iga seotud cron'i/timerit: kõik värskuse-, kontakti-, RT- ja veebikontrollid on käsitsi npm-skriptid või admin-nupud. |
| Freshness-audit | `rag:audit:freshness` (failid või `--db`) + `lib/rag/sourceFreshness.js` poliitikad + `ragServiceFreshnessFallback.js` | `OSALINE` | Poliitikad (maxAgeDays tüübi kaupa) on olemas ja testitud, aga audit on käsitsi; `--db` režiim loeb peaaegu tühja `RagDocument` tabelit → eksitav, kui ei kasutata failide/fallback-sisendit. |
| Deploy-väravad | `practices:deploy-gate` (fail-closed; migratsioonistaatus + RAG-jääk) ; `ci:smoke` (HTTP-staatused) | `OSALINE` | **`deploy-server.mjs` ei käivita kumbagi** — deploy teeb ainult `prisma:generate + build` + teenuste restardi. Praktikavärav on eraldi käsk; golden eval (`rag:eval:golden`, 37 kaasust, 9 perekonda) nõuab elavat serverit + sessiooniküpsist ega ole üheski väravas. |

### 1.2 Elutsükli diagramm

```
algallikas ──► registreerimine ──► kontroll ──► versioon ──► ingest ──► aktiivne retrieval ──► uuendus ──► supersede ──► eemaldamine
```

Lülihinnangud allikaklasside kaupa (kokkuvõte; detailid ptk 2):

| Lüli | KOV veeb | RT õigusakt | Kontaktid | Teadmusdok/PDF | Organisatsioon | Praktika | Teenuseprofiil | Kasutaja dok | Spetsialisti materjal |
|---|---|---|---|---|---|---|---|---|---|
| Registreerimine | `TÖÖTAB` (sources.json) | `TÖÖTAB` (manifest) | `TÖÖTAB` (kontaktifail) | `OSALINE` (master_sources_final.json + kaustad) | `TÖÖTAB` (pakett) | `TÖÖTAB` (DB) | `TÖÖTAB` (DB) | `TÖÖTAB` (DB) | `TÖÖTAB` (DB) |
| Kontroll enne ingest'i | `TÖÖTAB` (validate + light-check) | `TÖÖTAB` (validate-rt) | `TÖÖTAB` (fingerprint) | `TÖÖTAB` (knowledge:validate) | `TÖÖTAB` (audit-metadata) | `TÖÖTAB` (review-voog) | `OSALINE` (kood valideerib) | `OSALINE` (mime/kvoot) | `PUUDUB` (ainult käsitsi pilk) |
| Versioon | `PUUDUB` (ülekirjutus) | `OSALINE` (redaktsioonimeta, üks aktiivne) | `OSALINE` (varukoopiafail) | `PUUDUB` (ülekirjutus) | `PUUDUB` (ülekirjutus) | `TÖÖTAB` (v<N>) | `PUUDUB` (ülekirjutus) | `TÖÖTAB` (sha256-id) | `PUUDUB` |
| Ingest | `TÖÖTAB` | `TÖÖTAB` | `ERALDI TORU` (läheb ServiceMap'i, RAG saab KOV-veebi kaudu) | `TÖÖTAB` | `TÖÖTAB` | `TÖÖTAB` (retry'ga) | `TÖÖTAB` | `TÖÖTAB` (laisk) | `PUUDUB` |
| Aktiivne retrieval | `TÖÖTAB` | `TÖÖTAB` (legal_exact) | `TÖÖTAB` (SourcePackage kontaktisektsioon) | `TÖÖTAB` | `TÖÖTAB` | `TÖÖTAB` | `TÖÖTAB` | `TÖÖTAB` (doc_id-skoop) | — |
| Uuendus (muutuse avastus) | `OSALINE` (käsitsi web-check) | `OSALINE` (käsitsi rt-check) | `OSALINE` (käsitsi contact-check) | `PUUDUB` | `PUUDUB` | `TÖÖTAB` (re-review voog) | `TÖÖTAB` (salvestusel) | `TÖÖTAB` (sha muutub) | `PUUDUB` |
| Supersede | `OSALINE` (sama id ülekirjutus = vana kaob vaikselt) | `OSALINE` (is_current_version lipp) | `OSALINE` (bak-fail) | `OSALINE` | `OSALINE` | `TÖÖTAB` (superseded_ingest_cleanup) | `OSALINE` | `TÖÖTAB` (uus sha-id, vana kustutatakse) | — |
| Eemaldamine | `TÖÖTAB` (cleanup/reset skriptid) | `TÖÖTAB` | `OSALINE` | `TÖÖTAB` (delete API) | `TÖÖTAB` | `TÖÖTAB` (queue+drain) | `TÖÖTAB` | `TÖÖTAB` (job+retry) | `OSALINE` (fail kustub kontokustutusega) |

### 1.3 Kriitilised arhitektuurileiud

1. **Kaks paralleelset „dokumendiregistrit", kumbki pole täielik.** Rag-service'i JSON-register on tegelik tõeallikas (mida admin-UI proxy kaudu haldab); Prisma `RagDocument` on peaaegu kasutu peegel. Kõik, mis eeldab DB-d (analytics, freshness `--db`), näeb vale/tühja pilti.
2. **Kustutus on parimapüüdlik teenuse sees.** `DELETE /documents/{id}` neelab Chroma-vea vaikides (`except: pass`, [main.py:4418](rag-service/main.py:4418)) ja tagastab ikkagi `ok:true` — chunk'id võivad ellu jääda, kuigi registrikirje ja failid kustuvad. Kutsuja retry-loogika (nt DataDeletionJob) usub `ok:true`-d ega proovi uuesti.
3. **Audience/skoobi eraldatus on 100% kutsuja distsipliin.** `/search` rakendab ainult neid filtreid, mida kutsuja saadab. Vestlusrada saadab alati audience-filtri ([retrievalContextAssembler.js:1174](lib/chat/retrievalContextAssembler.js:1174)) ja kasutajadokumendid alati `doc_id $in` ([search.js:27](lib/documents/search.js:27)) — aga iga uus kutsuja võib selle unustada ja teenus ei kaitse.
4. **Ainus päris versioonimudel on praktikatel; kõik ülejäänu on ülekirjutus.** See tähendab: rollback = re-ingest vanast failist (kui fail alles), vastuse sidumine versiooniga pole üldjuhul võimalik, „mis muutus" ei ole taasesitatav.
5. **Automaatika lakkab avastamise ja avaldamise vahel — ja see on praegu õige.** Check→kandidaat→apply muster (kontaktid, KOV-veeb, RT) on disainitud inimkinnitusega; puudu on ainult *ajastatud käivitus* ja *ühtne tööjärjekord*, mitte muster ise.
6. **Ükski deploy-värav ei kaitse RAG-i tervikuna.** Praktikaväraval on õige fail-closed disain, aga seda ei käivitata deploy's; golden eval on käsitsi; värskusaudit on käsitsi.

---

## 2. Allikatüüpide tegelik elutsükkel

Iga allika kohta sama väljakomplekt. „Toru ühendatud?" = kas rada algallikast retrieval'ini on aktiivses koodis päriselt olemas.

### 2.1 Riigi Teataja õigusakt

- **Omanik:** platvormi sisutiim (admin). **Algne tõeallikas:** Riigi Teataja (XML/URL).
- **Esitab/kinnitab:** admin käivitab `rag:ingest:rt-national` või KOV-RT batch'i; kinnitus = skripti validate-samm (`kov:validate-rt`, manifest).
- **Aktiivseks:** kohe pärast ingest'i (chunk'id asendatakse sünkroonselt).
- **Uus versioon:** uus redaktsioon = uus ingest; metas `effective_start/end`, `is_current_version`, `act_reference`. Sama doc_id → ülekirjutus; eri redaktsioonid võivad olla eri dokumendid (kanooniline id `canonical_source_id` seob).
- **Vana eemaldamine retrieval'ist:** ülekirjutusel automaatne; kui redaktsioon on eraldi dokument, siis `is_current_version=false` + runtime `historical`-filter — **sõltub sellest, et ingest lipu õigesti seab**.
- **Embeddingute/failide kustutus:** `DELETE /documents/{id}` (admin/skript); järjekorda pole.
- **Rollback:** re-ingest vanast XML-ist (kui säilitatud); registrivarukoopiat teenus ei tee.
- **Kasutajale kuvatav kuupäev/kehtivus:** legal_exact tsiteerib akti + viidet; kehtivusinfo tuleb metast, kuvamise garantiid UI-s ei auditeerinud.
- **Toru ühendatud?** JAH (`TÖÖTAB`); kehtivuskontroll `kov:rt:check-web` on käsitsi.

### 2.2 KOV veebileht (teenuseinfo)

- **Omanik:** sisutiim; sisuliselt KOV ise (väline). **Tõeallikas:** KOV veebisait.
- **Esitab/kinnitab:** harvester + `rag:validate:kov` → admin käivitab `rag:ingest:kov` (või admin-API `ingest`); `light-check`/`revalidate` on eelkontroll.
- **Aktiivseks:** ingest'i hetkel.
- **Uus versioon:** `kov:web-sources:check` võrdleb normaliseeritud teksti sha256 baseline'iga (`web_content_sha256` failis `<slug>.sources.json`), kirjutab kandidaadi `<slug>.sources.kontroll.json` + raporti; `apply-check` (fingerprint-kaitse + bak-fail) uuendab registrifaili; **uus RAG-ingest on eraldi käsitsi samm** — kandidaadi apply EI vii sisu RAG-i.
- **Vana eemaldamine:** sama doc_id ülekirjutus.
- **Kustutus:** `rag:cleanup:kov` / `reset-rag-state` (sünkroonne).
- **Rollback:** bak-failist + re-ingest.
- **Kuupäev kasutajale:** SourcePackage kannab `lastChecked`/kontrolliaega sektsioonides; vestlus kuvab allika, mitte alati kontrolliaega.
- **Toru ühendatud?** JAH kuni „apply" — sealt edasi (apply → re-ingest → snapshot-rebuild) on käsitsi kolme sammu ahel, mida miski ei jälgi (`OSALINE`).

### 2.3 KOV kontakt

- **Omanik:** sisutiim. **Tõeallikas:** KOV veebisait; kanooniline koond `KOV/kov_kontaktid_loplik.json` (+ Tallinna LOV-failid).
- **Kinnitab:** admin (`kov:contacts:apply-check` või admin-API) pärast `kov:contacts:check-web` raporti vaatamist; Cloudflare-kaitstud e-postid dekodeeritakse.
- **Aktiivseks:** apply → valikuline `syncKovContactsToServiceMap` (DB `ServiceMapEntry`) → Teenusekaart. **RAG ei loe seda registrit** — RAG-i kontaktiinfo tuleb KOV-veebilehe chunk'idest (`official_contact`/`contact_page` tüübid) eraldi ingest'iga.
- **Uus versioon:** kandidaatfail + fingerprint + bak; väärtuste diff raportis (`changedContacts`).
- **Vana eemaldamine retrieval'ist:** ei kohaldu otse (register pole RAG-is); RAG-i vana kontaktichunk jääb, kuni keegi KOV-lehe uuesti ingest'ib → **kaks tõde võivad lahkneda**.
- **Rollback:** bak-fail.
- **Kuupäev kasutajale:** ServiceMap kirjel on kontrolliaeg; RAG-vastuses sõltub SourcePackage'i kontaktisektsiooni metast.
- **Toru ühendatud?** Register→Teenusekaart JAH; register→RAG **PUUDUB** (see ongi ptk 6 põhiettepanek).

### 2.4 KOV vorm

- Nagu 2.2, kuid värskuspoliitika rangeim (`application_form`/`web_form`/`pdf_form`/`official_form`: maxAge 90 päeva, [sourceFreshness.js:37](lib/rag/sourceFreshness.js:37)).
- Vormi-URL-i muutus ilmub web-check'i diffis; `rag:audit:forms-contacts` auditeerib vormide/kontaktide katvust SourcePackage'ites.
- **Risk:** vorm on sageli PDF — checksum-kontrolli PDF-idele web-check ei tee (ainult HTML-tekst); aegunud vormilink võib jääda avastamata kuni käsitsi auditini. Toru: `OSALINE`.

### 2.5 Teenuseosutaja teenuseprofiil

- **Omanik:** teenuseosutaja (org-admin kasutaja). **Tõeallikas:** profiilivorm rakenduses (DB).
- **Kinnitab:** salvestamine ise (admin-kinnituseta); kood valideerib.
- **Aktiivseks:** salvestusel sünkroonne `syncServiceProviderProfileToRag` → `service_provider_profiles` kollektsioon; saadavuse muutus sünkroonib samuti.
- **Uus versioon:** ülekirjutus sama ragDocId-ga; ebaõnnestumine → `ragMetadata.syncStatus=failed` (nähtav DB-s), **retry-järjekorda pole** — järgmine salvestus parandab.
- **Eemaldamine:** profiili kustutus/peitmine → `deleteRagDocument`; RAG-võtme puudumisel `skipped` meta.
- **Rollback:** puudub (eelmine tekst pole salvestatud).
- **Kuupäev kasutajale:** saadavusinfo kannab kontrolliaega (`serviceAvailabilityRagFields`).
- **Toru ühendatud?** JAH (`TÖÖTAB`), aga ilma inimretsensioonita ja ilma retry'ta — vt riskiklassid ptk 7.

### 2.6 Kasutaja dokument

- **Omanik:** kasutaja. **Tõeallikas:** üleslaetud fail (`UserDocument`, sha256, storagePath).
- **Kinnitab:** keegi ei retsenseeri; `agentAllowed` lipp lubab agendil kasutada.
- **Aktiivseks:** laisk ingest esimesel vajadusel (`ensureDocumentIndexed`): kui registris pole või sha/updatedAt ei klapi → `/ingest/text` id-ga `agent::<docId>::<sha256>`, `collection_id=agent_documents`.
- **Uus versioon:** uus fail = uus sha → **uus doc_id**; vana doc_id kustutatakse dokumendi kustutuse/asenduse rajal (`deleteDocumentRagReference` → DataDeletionJob RAG_DELETE + audit; 404 = juba korras).
- **Rollback:** ei kohaldu.
- **Kuvamine:** ainult omaniku vestluses; retrieval alati `doc_id $in` omaniku dokumentidest.
- **Toru ühendatud?** JAH (`TÖÖTAB`) — parim privaatsusrada repos (job + retry + audit).

### 2.7 Spetsialisti esitatud materjal

- **Omanik:** esitaja (spetsialist); õiguste omaja sageli kolmas osapool — **rollide eristust (esitaja/autor/õiguste omaja/kinnitaja) andmemudelis ei ole**, on ainult `submittedByUserId` + vaba `comment`.
- **Tõeallikas:** üleslaetud fail (`MaterialSubmission`, sha256, kvoodid, mime-valideering).
- **Kinnitab:** admin `/materjalid` vaates (pending→reviewed/rejected/imported) + e-kiri adminile.
- **Aktiivseks RAG-is:** **MITTE KUNAGI automaatselt** — „imported" on käsitsi märge; tegelik ingest nõuab, et admin laeb faili alla ja sisestab teise toruga. Sidet `MaterialSubmission ↔ RagDocument/doc_id` ei salvestata → hiljem ei saa vastata „kas see esitis on RAG-is?".
- **Eemaldamine/rollback:** faili kustutus kontokustutusel (`userDeletionOrchestrator` käsitleb materialSubmissions'e); RAG-ist eemaldamine pole seotud, sest seost pole.
- **Staatuse nähtavus esitajale:** ei ole (GET admin-only).
- **Toru ühendatud?** `ERALDI TORU` + lõpp `PUUDUB` — suurim tootelünk selles analüüsis.

### 2.8 Organisatsiooni juhend / profiil

- **Omanik:** sisutiim; tõeallikas organisatsiooni veeb/PDF.
- **Kinnitab:** `organization:audit-metadata` + admin käivitab `organization:ingest`.
- **Versioon:** ülekirjutus; `documents[]` viited on eraldi kandidaadid (ei ingest'ita automaatselt).
- **Kuvamine:** attributsioon vajab identiteedivälju (Astangu õppetund) — leping on nüüd olemas.
- **Toru ühendatud?** JAH (`TÖÖTAB`), muutuste avastus `PUUDUB`.

### 2.9 Avaldatud parim praktika

- **Omanik:** praktika autor + retsensendid. **Tõeallikas:** DB (EffectivePractice + versioonid + review-määrangud).
- **Kinnitab:** retsenseerimisvoog; avaldamine loob `publishedVersion` ja RAG-dokumendi `publicId:v<N>`.
- **Uus versioon:** uus avaldus v<N+1>; vana v<N> saab `RAG_DELETE` (superseded_ingest_cleanup); ingest'i ebaõnnestumine → `RAG_INGEST` retry-job (backoff, max 8), crash-guard 10 min.
- **Eemaldamine:** re-review/tagasivõtt → RAG_DELETE queue → drain; `staleReferences` loendur valvab, et mitte-PUBLISHED praktikal poleks ragSourceId-d.
- **Rollback:** eelmise versiooni re-publish (versioonid DB-s alles).
- **Toru ühendatud?** JAH — **kanooniline eeskuju** (`TÖÖTAB`).

### 2.10 Staatiline repo teadmusdokument (PDF + knowledge-doc-v1 meta)

- **Omanik:** sisutiim; tõeallikas kaustapakett (`Andmebaasi/...`) + `master_sources_final.json` (323 allikat).
- **Kinnitab:** `knowledge:validate` (+ smoke); admin käivitab folder-ingest'i.
- **Versioon:** ülekirjutus sama doc_id-ga; `content_hash` metas võimaldab muutumatust tuvastada, aga midagi ei võrdle seda automaatselt.
- **Eemaldamine:** delete API käsitsi; ~8 surnud linki ja 5 OCR-vajadust seisavad `needs_review` nimekirjas.
- **Toru ühendatud?** JAH ingest'ini; värskus `PUUDUB`.

### 2.11 Väline metoodiline allikas (uuringud, juhendid, ajakiri)

- Ajakirjal oma konveier (`rag:ingest:ajakiri`, artikli-meta väljad registris, legacy-cleanup skriptid). Uuringud/juhendid = 2.10 rada.
- Värskuspoliitika: `journal_article`/`practice_example` jne maxAge **null** (ei aegu; `currentEvidence:false` — riskipolicy ei luba neil kinnitada kehtivaid vorme/kontakte/õiguslikku alust). See piir on **runtime'is jõustatud** (`riskPolicy.js`, `sourcePackages.js`) — tugev disainiotsus.
- **Toru ühendatud?** JAH (`TÖÖTAB`).

---

## 3. Materjali esitamise tervikvoog

Kontrollitud rada: `spetsialist esitab → ülevaatus → heakskiit/tagasilükkamine → versioon → RAG-ingest → otsing → allikaviide → parandus/eemaldamine`.

Tegelik seis aktiivses koodis: rada **katkeb kolmandal sammul**. Olemas on esitamine (`POST /api/materials`: kvoodid, mime-kontroll, sha256, e-kiri adminile) ja ülevaatus (staatusemasin `pending→reviewed/rejected/imported`, reviewNote, reviewedBy). Kõik alates „versioon" on teise, käsitsi toruga tegemata sild.

Vastused küsimustele:

1. **Kas esitaja näeb staatust?** EI. `/api/materials` GET on `assertAdmin`; „minu esitised" vaadet ei ole. Esitaja saab teadmata ajaks vaikuse — usalduse seisukohalt halvim variant.
2. **Kas retsensent näeb vajalikku, mitte üleliigset?** Osaliselt. Admin näeb faili, kommentaari, esitaja e-posti. Puudub: sisu eelvaade ilma allalaadimiseta, duplikaadiviide (sha256 on indekseeritud, aga UI ei kasuta), sihtkoht (kuhu kollektsiooni see läheks), litsentsi/õiguste väli.
3. **Kas topeltesitamine on idempotentne?** EI. Sama sha256 loob uue rea; indeks on olemas, unikaalsuspiirangut ega UI-hoiatust pole. Sama fail võib olla kaks korda järjekorras ja kaks korda „imported".
4. **Kas fail ja metadata jäävad sünkrooni?** Esitamise piires jah (üks tehing kirjutab rea + faili; kustutus koristab mõlemad). Kuid pärast „imported" märget puudub igasugune seos RAG-i doc_id-ga → sünkroonsust RAG-iga ei saa isegi defineerida.
5. **Mis juhtub ebaõnnestunud ingest'i korral?** Materjalitorus ingest'i pole; kui admin sisestab faili knowledge-folder skriptiga ja see kukub, jääb `MaterialSubmission.status="imported"` valeks lubaduseks — keegi ei vii staatust tagasi.
6. **Kas avaldamine võib jääda „RAG-is nähtamatu" vaheolekusse?** Jah, kahel viisil: (a) „imported" ilma tegeliku ingest'ita; (b) ingest õnnestus, aga metadata (audience, collection_id, identiteediväljad) puudulik → attributsioon peidab allika (ptk 1.3 leid 4 klass; Astangu juhtum).
7. **Kas eemaldamine kustutab kõik koopiad?** Esitise kustutus kustutab faili + rea; RAG-koopia (kui admin selle lõi) jääb, sest seost pole. Vastupidi ka: RAG-ist kustutamine ei muuda esitise staatust.
8. **Kas konto kustutamine jätab jääke?** `userDeletionOrchestrator` käsitleb materialSubmissions'e (failid + read). Aga kui esitatud materjal on vahepeal RAG-i viidud, jääb see RAG-i alles — mis võib olla isegi õige (litsents platvormile), kuid praegu on see **juhus, mitte otsus**: õiguste omaja väli puudub (vt 2.7).
9. **Esitaja/autori/õiguste omaja/kinnitaja eristus?** Puudub. On `submittedByUserId` ja `reviewedBy` (string). Autor ja õiguste omaja elavad parimal juhul vabatekstis.

**Miinimumparandus (kajastub paketis RAG-P4):** lisada `MaterialSubmission`'ile `ragDocId`, `ingestedAt`, `ingestError`, `rightsHolder`, `authorName` + esitaja „minu esitised" GET + admin-toiming „saada RAG-i" mis kasutab sama `/ingest/pdf-with-metadata` toru ja kirjutab seose. Idempotentsus: enne ingest'i kontrolli sha256 vastu olemasolevaid esitisi ja RAG-registrit.

## 4. Allika uuendamine ja versioonimine

Praegused vastused:

- **Kas olemasolevat RAG-dokumenti saab parandada?** Jah: `update-meta` (FILE-tüübile), `patch-meta` (üldine, backfill'iks ehitatud), sisu re-ingest sama doc_id-ga, `reindex` (loeb salvestatud faili uuesti). Sisu parandus = täisasendus.
- **Kas uus ingest loob uue versiooni või kirjutab üle?** Kirjutab üle (`_replace_document_vectors`: delete where doc_id + insert). Versioonihoidlat rag-service'is ei ole. Erandid: praktikad (`:v<N>` id-s) ja kasutajadokid (sha256 id-s) — seal on „versioon" doc_id sees ja ülekirjutus ei juhtu, juhtub uus dokument + vana kustutus.
- **Kuidas toimub supersede?** Kolme eri mehhanismiga: (a) vaikne ülekirjutus (enamik); (b) praktikate `RAG_DELETE superseded_ingest_cleanup:v<N>`; (c) RT `is_current_version=false` + runtime `historical`-filter. Ühtset lepingut pole.
- **Kas vana chunk võib jääda retrieval'isse?** Jah, kolmel teel: (1) DELETE neelab Chroma-vea (ptk 1.3.2); (2) doc_id muutus ilma vana kustutuseta (nt ajakirja legacy-id-d — selleks on olemas eraldi cleanup-skriptid, mis tõestab, et klass on reaalne); (3) apply-check uuendas registrifaili, aga re-ingest jäi tegemata → RAG serveerib vana sisu, register väidab uut.
- **Kas vastus on seotav konkreetse versiooniga?** Ei (v.a praktikad, kus doc_id kannab versiooni). `rag_trace` salvestab doc_id-d ja chunk-id-d, aga kuna sisu kirjutatakse sama id alla üle, ei saa hiljem taastada, *millise sisuga* versioon vastust andis.
- **Kuidas tuvastatakse muutumatu sisu?** `content_hash` on metas (backfill täitis), kasutajadokidel sha-võrdlus enne ingest'i (`ensureDocumentIndexed`), KOV-veebil normaliseeritud-teksti sha. Teadmusdokidel/organisatsioonidel keegi ei võrdle → iga re-ingest maksab embeddingu uuesti.
- **Kuidas välditakse topeltchunk'e?** Asendusmuster hoiab sama doc_id piires puhta; **eri doc_id sama sisu** vastu kaitset pole (nt sama PDF kahes kaustapaketis).
- **Kuidas taastatakse eelmine versioon?** Failipõhistel: bak-failist / git-ajaloost re-ingest. DB-põhistel (praktika): eelmise versiooni re-publish. Registrifailil endal (rag-service registry JSON) varukoopiaid pole.
- **Allikaviited pärast uuendust?** Viide käib doc_id + meta järgi, seega uuendus „liigub kaasa"; aga vestlusajaloos kuvatud vana viide võib nüüd osutada teistsugusele sisule — kasutajale seda ei märgita.
- **Mida näeb kasutaja, kui allikas on aegunud/eemaldatud?** Aegunud: mitte midagi eristuvat (freshness on audit, mitte runtime-märgis; `stale` staatus on metas olemas, aga UI-märgistust ei leidnud). Eemaldatud: allikas lihtsalt ei ilmu enam; vana vestluse viide jääb rippuma.

### 4.1 Kanooniline versioonileping (ettepanek, kehtib KÕIGILE allikatüüpidele)

Üks leping, mida iga toru peab täitma (praktikad juba täidavad; teised viiakse järele):

1. **Identiteet:** `source_id` (püsiv, tüübiprefiksiga: `kov:<slug>:<key>`, `rt:<akt>`, `org:<slug>`, `material:<submissionId>`, `practice:<publicId>`, `agent:<docId>`) + `version` (kasvav täisarv VÕI sisu-sha, aga alati eksplitsiitne väli, mitte ainult id-konventsioon).
2. **RAG doc_id = `source_id` + `:v<version>`** — ülekirjutus keelatud; uus sisu = uus versioon.
3. **Registrikirje kohustuslikud väljad:** `content_hash`, `supersedes` (eelmise versiooni doc_id), `is_current_version`, `last_checked`, `source_status`.
4. **Aktiveerimine on tehing:** (a) ingest v<N+1> → (b) kontrolli chunk-count>0 → (c) märgi v<N+1> current → (d) pane v<N> kohta `RAG_DELETE` järjekorda (mitte sünkroonne delete). Kui (a–c) kukub, jääb v<N> aktiivseks — fail-closed.
5. **Retrieval filtreerib alati `is_current_version=true`** (v.a eksplitsiitne ajalooline režiim) — see muudab „vana chunk jäi alles" leitavast veast mitteleitavaks jäägiks, mida koristab järjekord.
6. **Kustutuse kviteering:** DELETE peab tagastama kustutatud chunk'ide arvu ja vea korral vea (mitte `ok:true`); järelkontroll `GET /documents/{id}/chunks → 0`.
7. **Trace kannab versiooni:** `rag_trace` salvestab `doc_id` (mis nüüd sisaldab versiooni) → vastus on taasesitatav.
8. **Rollback = eelmise versiooni current-lipu tagasitõstmine** (chunk'id on veel alles, kuni koristusjärjekord pole jooksnud) või re-ingest säilitatud lähtefailist.

Maksumus: doc_id-de migratsioon (uus konventsioon) võib toimuda järk-järgult — vana id loetakse `v0`-ks ja supersede'itakse esimesel uuendusel; midagi ei pea korraga ümber ingest'ima.

---

## 5. Automaatne muutuste avastamine

Hea uudis: **mudel on juba pooleldi ehitatud**. Kolm registrit (kontaktid, KOV-veebiallikad, KOV-RT manifest) järgivad täpselt sama check→kandidaat→apply mustrit fingerprint-kaitsega. Puudu on ajastus, üldistus teistele allikatüüpidele, riskiklassifikatsioon ja ühendus RAG-ingest'iga.

### 5.1 Sihtmudel

```
allikaregister ──► ajastatud kontroll ──► fingerprint/diff ──► muutuse kandidaat ──► riskiklass ──► auto VÕI inimkontroll ──► uus versioon (ptk 4.1 leping) ──► kontrollitud ingest
     │                    │                                        │                                                            │
 (mis, kus, kui tihti,   (ETag/Last-Modified → tingimuslik GET;   (kandidaatfail + raport,                                  (aktiveerimistehing,
  mis riskiklass,         normaliseeritud tekst → sha256;          nagu praegu *.kontroll.json)                              fail-closed)
  baseline-hash)          PDF → baiti-checksum)
```

Neli selgelt lahus hoitavat sammu (praegune kood juba eristab kahte esimest):

1. **Avastamine** — võrgupäring + fingerprint'i võrdlus. Tohib olla täisautomaatne ja ajastatud. Kirjutab ainult kandidaadi + raporti, mitte kunagi registrit ega RAG-i.
2. **Sisuline kinnitamine** — inimene (või madala riski korral reegel) otsustab, et kandidaat on õige muutus, mitte müra. Väljund: registrikirje uus versioon.
3. **Avaldamine** — registri uus versioon muutub kanooniliseks (apply + bak + fingerprint-kaitse — olemas).
4. **RAG-i uuendamine** — kontrollitud ingest ptk 4.1 tehinguga. **Praegu käsitsi ja jälgimata; see samm tuleb apply külge aheldada** (mitte automaatselt avaldada, vaid automaatselt *järjekorda panna*).

Muutuse avastamine ≠ avaldamine — see piir on juba koodis õigesti (check ei kirjuta registrit) ja peab jääma.

### 5.2 Tehnikad signaali kaupa

| Signaal | Praegu | Sihtolek |
|---|---|---|
| `ETag` / `Last-Modified` | Ei kasutata (alati täis-GET) | Tingimuslik GET registri baseline'i väljadega `etag`, `last_modified`; 304 → odav „unchanged", ilma HTML-i parsimata. Fingerprint jääb tõeks, ETag on ainult optimeering (CDN-id valetavad). |
| Sisufingerprint | ✔ sha256 normaliseeritud tekstist | Jääb põhikontrolliks. |
| HTML-i normaliseeritud tekst | ✔ `stripTags` + kuupäevamustrite eemaldus + lowercase ([kovSourceMonitor/service.js:72](lib/admin/rag/kovSourceMonitor/service.js:72)) | Lisada: küpsisebännerite/nav-i heuristiline eemaldus (main/article-eelistus), et vähendada valepositiivseid. |
| Struktureeritud välja diff | ✔ kontaktidel (e-post; `changedContacts` võrdleb välju) | Laiendada telefonile, aadressile, vastuvõtuaegadele; diff-raport peab alati näitama vana→uus paari (kontaktiraport juba näitab). |
| PDF/faili checksum | ✘ web-check vaatab ainult HTML-i | Vormide ja juhend-PDF-ide baiti-sha256 (Content-Length + hash); muutus = kandidaat. Kriitiline vormidele (ptk 2.4 risk). |
| Kontaktandmete muutus | ✔ check-web + Cloudflare-dekodeering | Riskiklass „kõrge" → alati inimkinnitus (ptk 6/7). |
| Vormi URL-i/faili muutus | Osaline (URL diff HTML-is) | PDF-checksum + redirect-lõppsihi võrdlus. |
| Õigusakti redaktsioon | ✔ käsitsi `kov:rt:check-web` | Ajastatud RT-kontroll; RT pakub stabiilset redaktsiooni-URL-i → uue redaktsiooni ilmumine = kandidaat, mitte kunagi auto-avaldus. |
| Eemaldatud leht (404/410) | Osaline (`fetch_failed` raportis) | Eraldi olek `gone_candidate`; EI märgi allikat kadunuks enne N järjestikust kinnitust (vt 5.3). |
| Redirect | ✔ `finalUrl` salvestatakse | 301 püsiredirect → URL-i uuenduse kandidaat; 302 → ainult logi. Domeenivahetus = kõrge risk (võimalik parkimisleht). |
| Ajutine võrguviga | ✔ timeout eristatatud (`AbortError`) | Backoff + korduskatse enne raporteerimist; võrguviga EI ole kunagi „muutus". |
| robots.txt ja kasutustingimused | ✘ ei kontrollita | Kontrolli robots.txt üks kord ööpäevas domeeni kohta; User-Agent on juba korrektne (`SotsiaalAI KOV source monitor/1.0 (+https://sotsiaal.ai)`); viisakusviive domeeni kohta (≥1 s), sest KOV-saidid on väikesed. Avalik ametlik info + mõistlik sagedus = legitiimne; keeldu (robots disallow) austatakse ja allikas märgitakse `manual_check_required`. |
| Kadunuks märkimine | ✘ | **Mitmekordne järjestikune kinnitus:** `gone_candidate` → 3 järjestikust ebaõnnestunud kontrolli ≥48 h jooksul eri kellaaegadel → alles siis inimjärjekorda „kadunud?" otsusena. Üksik 404 ei muuda mitte midagi. |

### 5.3 Olekumasin allika kohta (registrisse)

```
active ──(fingerprint muutus)──► change_candidate ──(kinnitus)──► active (uus versioon)
  │                                   └─(müra)──► active (baseline uuendatud, versioonita)
  ├──(404/timeout)──► check_failed(n) ──(n≥3, ≥48h)──► gone_candidate ──(inimene)──► archived | active(uus URL)
  └──(robots keeld)──► manual_check_required
```

Iga üleminek kirjutab auditikirje (kes/mis reegel, millal, vana→uus hash). See on olemasoleva raportiformaadi formaliseering, mitte uus süsteem.

### 5.4 Ajastus (puuduv tükk)

Repo-s ei ole RAG-kontrollidel ühtegi taimerit. Ettepanek — **üks scheduler, mitte mitu**: server-side cron (systemd timer samas masinas, kus `sotsiaalai-rag.service`), mis käivitab olemasolevaid npm-skripte `--max-urls` eelarvega ja kirjutab raportid samadesse failidesse, mida admin-UI juba loeb (`getKovWebSourcesStatus`, `getKovContactRegistryStatus`, `getKovRtRegistryStatus`). Mitte ehitada app-sisest job-runnerit enne, kui admin-järjekorrad (ptk 11) seda päriselt vajavad. Sagedused ptk 7 riskimaatriksist.

## 6. Kontaktide ja teenuseinfo erireegel

**Arhitektuuripiir: RAG ei ole kontaktandmete ega teenuse saadavuse algne tõeallikas.** See piir on täna *pooleldi* tõsi: Teenusekaart loeb `ServiceMapEntry`-t (mis sünkitakse kontaktiregistrist), aga vestluse RAG-vastus võtab kontakti KOV-veebilehe chunk'ist, mis võib olla registrist vanem või uuem. Kaks tõde.

### 6.1 Sihtmudel (kanooniline register → kaks tarbijat)

```
KOV veeb ──check──► kandidaat ──inimkinnitus──► KONTAKTIREGISTER (kanooniline, versioonitud)
                                                    │                        │
                                            ServiceMapEntry sync      RAG snapshot-ingest
                                            (Teenusekaart, DB)        (kontrollitud, sama registrikirje
                                                                       renderdatud tekstiks, doc_id
                                                                       kontakt:<slug>:v<N>)
```

Reeglid, igaüks konkreetse mehhanismiga:

1. **Struktureeritud kontaktiregister on kanooniline** — `kov_kontaktid_loplik.json` juba on; anda talle ptk 4.1 versiooniväljad (praegu on ainult bak-failid).
2. **Teenusekaart loeb registrit** — juba töötab (`syncKovContactsToServiceMap`); sync muuta apply kohustuslikuks osaks, mitte lipuks (`syncServiceMap=false` vaikimisi on praegu vale suund).
3. **RAG saab sama registrikirje kontrollitud snapshot'i** — UUS: apply järel renderdatakse iga KOV-i kohta kompaktne kontaktidokument (`source_type=official_contact`, `authority=municipality`, `last_checked=apply aeg`, `url_canonical=KOV leht`) ja ingest'itakse ptk 4.1 tehinguga. SourcePackage'i kontaktisektsioon hakkab eelistama seda dokumenti KOV-veebi chunk'idele (retrievalStrategySelector'i reegel: `official_contact` registriallikas > `contact_page` veebichunk).
4. **Veebikontroll loob muutuse kandidaadi** — juba töötab.
5. **Kõrge riskiga kontaktimuutus vajab kinnitamist** — kriisi-/lastekaitsekontakt: alati inimene; üldkontakti e-posti kirjaviga (sama domeen, väike Levenshtein) võib auto-kinnitada (ptk 7 maatriks).
6. **Vana ja uus väärtus võrreldavad** — raport juba kannab `currentEmail`/`foundEmail`; hoida see auditis alles.
7. **Allika URL ja kontrolliaeg jäävad alles** — registrikirjel `officialUrl` + `web_checked_at` juba olemas; RAG-snapshot kannab need metasse.
8. **Aegunud kontakt on kasutajale nähtavalt märgistatud** — kui `last_checked` > stale-after (90 p), lisab vastuse koostaja kohustusliku märke („kontrollitud <kuupäev>; kontrolli KOV-i lehelt") — see on runtime-reegel `riskPolicy`/SourcePackage kontaktisektsioonis, mitte UI-lisand.
9. **RAG-vastus ei tohi pakkuda kinnitamata uut kontakti** — kui retrieval toob kontakti, mille `source_type` pole registrisnapshot (nt värske veebichunk enne kinnitust), siis kontaktisektsioon degradeerub viitama üldkontaktile + „vaata KOV-i lehelt". Jõustatav `sourcePackages.js` kontaktisektsiooni filtriga (sama mehhanism, millega ajakirjaartiklid ei tohi kinnitada vorme — muster on juba olemas).

### 6.2 Väljade kaupa

| Väli | Kanooniline koht | Automaatuuendus lubatud? |
|---|---|---|
| KOV üldkontakt (üldtelefon, üld-e-post, aadress) | kontaktiregister | Kandidaat automaatselt; apply auto ainult „sama domeen, formaadiparandus" klassis, muidu inimene |
| Sotsiaalhoolekande kontakt | kontaktiregister | Kandidaat auto; apply alati inimene |
| Lastekaitse kontakt | kontaktiregister | Kandidaat auto; apply alati inimene; stale-märgis rangeim |
| Teenuseosutaja kontakt | `ServiceProviderProfile` (osutaja ise haldab) | Osutaja muudatus = tõeallikas; veebikontroll ei kohaldu; RAG-sünk juba automaatne |
| Teeninduskoht | `ServiceProviderLocation` / registrikirje | Nagu osutaja kontakt |
| Teenuse kättesaadavus | `serviceAvailability*` (DB, kontrolliajaga) | Osutaja/admini sisestus; RAG saab snapshot'i juba täna (`serviceAvailabilityRagFields`) — hoida |
| Vastuvõtu tingimused | KOV-veeb → SourcePackage | Kandidaat auto; apply inimene (õiguslik sisu) |
| Vormid ja taotluslingid | KOV-veeb + PDF-checksum | Kandidaat auto (sh checksum); apply inimene; katkine link võib **auto-peita** (fail-closed: parem link puudu kui vale link) |

---

## 7. Riskiklassid ja automaatika piir

Põhimõte: **avastamine on alati automaatne; avaldamine on automaatne ainult siis, kui vale-avaldamise kahju on väiksem kui hilinemise kahju.** Fail-closed = kahtluse korral pigem peida/degradeeri kui näita kinnitamata väidet.

| Klass | Kontrolli sagedus | Auto-avaldus? | Retsensent | Stale-after | Fail-closed käitumine | Rollback | Usaldusmärge kasutajale |
|---|---|---|---|---|---|---|---|
| Õigused ja õigusaktid (RT) | 1×/nädal + RT redaktsioonivoog | EI — alati inimene | sisutoimetaja (õigusteadlik) | 365 p (`national_law`) | uue redaktsiooni kandidaadi ajal vastus lisab „kontrolli kehtivat redaktsiooni RT-st" | eelmine redaktsioon current'iks | akti viide + redaktsiooni kuupäev |
| Kriisi- ja hädaabikontaktid | 1×/päev | EI — alati inimene; muutuse kandidaat = kõrgeim prioriteet järjekorras | admin + teine kinnitaja (four-eyes) | 30 p | kahtluse korral kuva ainult riiklikud numbrid (112, 116111 jms staatiline nimekiri, mis EI tule RAG-ist) | registriversioon | „kontrollitud <kuupäev>" alati nähtav |
| Lastega seotud info | 1×/nädal | EI | lastekaitse-pädevusega retsensent | 90 p | vastus degradeerub üldjuhisele + ametlikule kontaktile | registriversioon | allikas + kuupäev kohustuslik |
| KOV kontaktid | 1×/nädal | Kandidaat auto; apply auto AINULT formaadi-/domeeniparandus, muu inimene | sisutoimetaja | 90 p (`official_contact`) | aegunud kontakt saab möönduse (6.1.8); kinnitamata uut ei kuvata (6.1.9) | bak/registriversioon | „kontrollitud <kuupäev>" |
| Toetuste summad ja tähtajad | 1×/nädal KOV-veeb; RT-muutus katab riikliku | EI | sisutoimetaja | 180 p (`kov_service_info`) | summa/tähtaeg ilma värske kinnituseta → konservatiivne sõnastus („summa kehtivus kontrollimata"), mis on juba `sourcePackages.js` konservatiivsete fees/deadlines reeglite laiendus | registriversioon | kuupäev + KOV-viide |
| Vormid | 1×/nädal + PDF-checksum | Katkise lingi PEITMINE auto; uue vormi avaldus inimene | sisutoimetaja | 90 p | katkine link maha; „vorm KOV-i lehel" asenduslink | eelmine vormiviide | lingi kontrolliaeg |
| Teenuse saadavus | osutaja sisestus reaalajas | JAH (osutaja ise on tõeallikas) | — (osutaja vastutus; admin pisteliselt) | teenusepõhine meeldetuletus (serviceAvailabilityReminders on olemas) | aegunud saadavus → „viimati kinnitatud <kuupäev>" | eelmine kirje | kinnituskuupäev |
| Metoodilised juhendid | 1×/kvartal linkide elusus | EI (sisu-uuendus alati toimetaja) | sisutoimetaja | 730 p (`methodology_guide`) | vana juhend jääb, märge „võib olla uuenenud" | — | avaldamisaasta |
| Üldine selgitav sisu | linkide elusus 1×/kvartal | JAH (madal risk; keeleparandused jms) | järelauditiga (post-hoc) | — | — | git/registriversioon | — |
| Spetsialisti praktiline materjal | ei kohaldu (ei muutu veebis) | EI — ülevaatusvoog (ptk 3) | teine spetsialist või toimetaja | — | mustand/tagasilükatu ei jõua kunagi retrieval'isse | versioon | autor + aasta |
| Avaldatud parim praktika | ei kohaldu | EI — olemasolev review-voog | praktika retsensendid | — | mitte-PUBLISHED ⇒ RAG-ist väljas (juba jõustatud + deploy-värav) | eelmise versiooni re-publish | versioon + avaldamisaeg |

Automaatika piiri kokkuvõte: täisautomaatsed on ainult (a) avastamine+kandidaat, (b) katkiste linkide peitmine, (c) formaadiparandusklassi kontaktiparandus, (d) osutaja enda hallatav saadavus, (e) madala riski selgitava sisu keeleparandused järelauditiga. Kõik muu — inimene enne avaldamist.

## 8. Audience, omanikuskoop ja privaatsus

Seis aktiivses koodis:

- **Kasutaja dokumentide eraldatus:** tugev muster — retrieval käib ainult `doc_id $in` (omaniku dokumentidest ehitatud) + `collection_id=agent_documents`; doc_id sisaldab cuid+sha256 (mitte äraarvatav). Nõrkus: eraldatus on kutsuja-poolne (ptk 1.3.3); teenuses pole „see kollektsioon nõuab doc_id-filtrit" kaitset.
- **Tenant/organisatsiooni eraldatus:** RAG-korpuses ei ole tenant-mõõdet — kõik mitte-agent kollektsioonid on platvormi-globaalsed teadmisallikad. Kovisiooni teadmusotsing loeb `effective_practices` kollektsiooni (avaldatud sisu) — org-piiri rikkumist ei teki, sest privaatset org-sisu RAG-is ei hoita. See on õige lihtsus: **privaatne koostöösisu (kovisioon, ruumid) EI tohi RAG-i jõuda** ja praegu ei jõuagi.
- **Privaatne vs avalik materjal:** eristus on kollektsioonide kaupa (`agent_documents` vs ülejäänud). Audience (`SOCIAL_WORKER`/`CLIENT`/`BOTH`) eraldab spetsialisti- ja kliendisisu; filter on vestlusrajal alati peal ([retrievalContextAssembler.js:1174](lib/chat/retrievalContextAssembler.js:1174)).
- **Rollipõhine retrieval:** CLIENT → `[CLIENT, BOTH]`, muu → `[SOCIAL_WORKER, BOTH]`. Kahetasemeline, deterministlik.
- **Admini ligipääs:** `/api/rag/[...path]` proxy = iga admin näeb/haldab kogu registrit, sh `agent_documents` kirjeid (GET /documents, /chunks, /source). **Admini haldusõigus annab praegu ka privaatse sisu lugemisõiguse** — allpool negatiivne invariant nr 6 seda piirab.
- **Kustutamine:** kasutajadokid job+retry+audit (tugev); konto kustutus käsitleb dokumente, materjale, praktikaid (`effectivePracticeAccountCleanup`).
- **Logid ja promptide sisu:** `ChatLog.data` on vaba Json sündmuse kaupa; `rag_trace` püsib vestluskäigus (seda kontrollib `rag:check:v24a-live-trace`). Trace sisaldab doc_id-sid ja pealkirju — mitte chunk-teksti — see piir tuleb lepinguna kirja panna (test 10.9), et tulevane „lisame trace'i rohkem konteksti" ei lekitaks kasutajadokumendi sisu adminile analytics'usse.
- **Source feedback:** raporteerija id + sourceId + kategooria + vaba `note` (≤500) — sisaldab potentsiaalselt tundlikku konteksti; nähtav ainult adminile; kontokustutusel Cascade kustub. OK.
- **Ristkasutaja/ristorganisatsiooni lekke piir:** ainus reaalne pind on `agent_documents` kollektsioon ühises Chromas — leke nõuaks kutsuja-vea (filter puudu) VÕI doc_id lekke. Mõlemad on testitavad (10.7, 10.8).

### Negatiivsed invariandid (peavad olema testidega tõendatud, mitte usutud)

1. **Privaatne dokument ei jõua teise kasutaja vastusesse.** Jõustus: `doc_id $in` ehitatakse ainult omaniku ridadest (`lib/documents/access.js` rada). Test: kaks kasutajat, sama päring, kummagi trace ei sisalda teise doc_id-d.
2. **Mustandmaterjal ei jõua retrieval'isse.** Jõustus: MaterialSubmission ei jõua RAG-i üldse enne admini ingest'i; praktikad ainult PUBLISHED. Test: pending-esitis + päring pealkirjaga → 0 vastet.
3. **Tagasilükatud versioon ei jää aktiivseks.** Praktikatel jõustatud (`staleReferences=0` värav); teistel tüüpidel puudub mõiste → ptk 4.1 leping toob (`is_current_version`).
4. **Superseded versioon ei ilmu vastusesse.** Praktikatel cleanup-queue; üldine alles ptk 4.1 järel (current-filter).
5. **Eemaldatud allika chunk ei jää leitavaks.** Praegu NÕRK (DELETE neelab vead, ptk 1.3.2). Test 10.3/10.4 + teenuseparandus (kviteering).
6. **Admini haldusõigus ≠ õigus privaatset sisu lugeda.** Praegu rikutud (proxy annab /source ja /chunks ka agent-dokumentidele). Parandus: proxy blokeerib `agent::`-prefiksi sisuendpointid (metadata OK, sisu mitte) või nõuab eraldi „privacy override" auditikirjega.

---

## 9. Praegused testid ja nende tegelik väärtus

Taust: `npm test` = node:test, **ilma elava DB-ta** (DB-loogika süstitud fake-prismaga); päris referentsiaalsus → `npm run db:migrate:check` (lokaalne Postgres). Ükski automaattest ei kasuta päris Chromat, päris embeddingut ega päris mudelit.

| Test / värav | Mida päriselt tõendab | Mida ainult simuleerib | Päris DB? | Päris embedding? | Päris retrieval? | Päris mudel? | Determin.? | Suurim pime nurk |
|---|---|---|---|---|---|---|---|---|
| `tests/rag/sourceMetadata`, `sourceFreshness`, `riskPolicy` | metadata-lepingu, värskuspoliitika ja tõendusjõu reeglid puhaste funktsioonidena | sisendid on käsitsi koostatud kirjed | EI | EI | EI | EI | JAH | reaalse korpuse meta-drift (leping õige, andmed valed) |
| `sourcePackageSnapshots`, `sourcePackageAdminService`, `sourcePackageGapReport` | snapshoti hash/versioon/duplikaadi-identiteet, admin-teenuse loogika | fake-prisma | EI | — | — | — | JAH | päris-DB unique-piirangute käitumine race'is |
| `tests/rag/kov*`, `rtXmlIngestPayload`, `ajakiriIngestScriptStatic`, `ragServiceIngestPayloadStatic`, `knowledgeDocsMetadata`, `pdfSectionIndex` | ingest-payload'ide kuju ja valideerimine STAATILISELT (mida skript saadaks) | rag-service'i vastust ei ole; „static" nimigi ütleb | EI | EI | EI | EI | JAH | teenuse-poolne normaliseerimine võib payload'i tähendust muuta |
| `tests/admin/rag/contactRegistry`, `kovSourceMonitor`, `rtRegistry` | check→kandidaat→apply loogika, fingerprint-kaitsed, HTML-parsimine fixture'itega | võrk on fixture; päris KOV-saitide müra puudub | EI | — | — | — | JAH | reaalne HTML-müra (bännerid, CF-kaitse) → valepositiivid |
| `tests/chat/*` (planner, orchestrator, assembler, ragContext, attribution, sourcePackages, evidencePackage, legalLookup, safety, workflowBypass) | runtime-konveieri otsused mock-vastete peal; režiimivalik; attributsioonifiltrid | RAG-vasted on käsitsi koostatud match-objektid | EI | EI | EI | EI | JAH | retrieval'i tegelik jaotus (mock ei valeta samamoodi nagu Chroma) |
| `tests/chat/ragGoldenSet` | golden-seti struktuuri/ootuste valideerimine | EI jooksuta päringuid | EI | EI | EI | EI | JAH | — |
| `tests/privacy/*`, `tests/materials/*`, `tests/effectivePractices/*` | job-oleku masinad, staatusemasinad, orkestraatori järjekord fake-prismaga | RAG-kustutuse HTTP-kutse on mock | EI | — | — | — | JAH | päris 404/timeout/poolik-kustutus semantika |
| `rag:smoke:v1/v2`, `rag:smoke:legal(-exact)`, `rag:smoke:source-packages`, `rag:hybrid:test`, `rag:check:v24a-live-trace` | ELUS serveri vastu: marsruutimine, hybrid-otsing, legal-exact, SourcePackage, püsiv trace | — | JAH | JAH | JAH | JAH | osaliselt (mudeliväljund varieerub; kontrollid on struktuursed) | vajavad käsitsi käivitust + küpsist; ei jookse üheski CI-s |
| `rag:eval:golden` (37 kaasust, 9 perekonda) | vastuse sisu ootused (diakriitika-immuunsed substring'id) elavas keskkonnas | — | JAH | JAH | JAH | JAH | EI (mudel) | käsitsi; kukkumine ei blokeeri midagi |
| `rag:audit:freshness` | meta-värskuse KOKKUVÕTE failidest/fallback'ist | `--db` režiim loeb sisuliselt tühja RagDocument tabelit | osaliselt | — | — | — | JAH | vaikimisi sisend eksitav (ptk 1.3.1) |
| `practices:deploy-gate` + `practices:rag:verify` | RAG-jäägi ja viidete invariandid päris DB vastu; fail-closed | — | JAH | — | — | — | JAH | **ei käivitu deploy's automaatselt** |
| `ci:smoke` | HTTP-staatused / leheküljed | RAG-i ei puuduta | — | — | — | — | JAH | — |
| `db:migrate:check` | migratsioonide+cascade'ide rakendatavus lokaalsele Postgresile | — | JAH | — | — | — | JAH | Chroma/registri failipoolt ei kata |

Kandvaim järeldus: **kõik, mis on kiire ja alati jookseb, on simulatsioon; kõik, mis tõendab päris süsteemi, on käsitsi ja küpsise taga.** Regressioonid, mis jäävad KINDLASTI tabamata: (1) Chroma delete-jääk; (2) ingest→search indekseerimisviive/serialiseerimisvead päris teenuses; (3) audience-filtri kadumine uuel kutsujarajal; (4) registri JSON-faili korruptsioon/konkurentne kirjutus; (5) embeddingu-mudeli vahetuse mõju pingereale.

## 10. Kohustuslik eval- ja regressiooniprogramm

Kolm jooksukonteksti: **CI** (iga PR; kiire, deterministlik, fake välisilm), **NIGHTLY** (ajastatud; päris lokaalne rag-service + päris Postgres + päris embedding väikese korpusega; mudel võib olla päris), **PRE-DEPLOY** (elav sihtkeskkond; read-only või no-persist). Sünteetiline minikorpus (~20 dok, iga allikatüüp esindatud + 2 „mürgist" duplikaati) elab repos `eval/fixtures/` all.

| # | Kiht | Testandmed | Invariant | Kus jookseb |
|---|---|---|---|---|
| 1 | Ingest-leping | minikorpus | iga tüübi payload → chunks>0, meta normaliseerub kanooniliseks (source_type, audience, content_hash) | CI (static) + NIGHTLY (päris teenus) |
| 2 | Versiooniuuendus | sama source_id v1→v2 | pärast v2 aktiveerimist retrieval tagastab ainult v2; trace kannab v2 doc_id | NIGHTLY |
| 3 | Superseded chunk'i eemaldamine | v1 pärast v2 | `GET /documents/v1/chunks` → 0 pärast koristusjärjekorda; otsing v1 tekstiga ei too v1-te | NIGHTLY |
| 4 | Kustutus ja retry | dok + tapetud teenus keskel | DELETE kviteering ausalt vigane; DataDeletionJob retry viib chunks→0; audit kirjas | NIGHTLY |
| 5 | Idempotentsus | sama ingest 2× | chunk-count ei kasva; sama content_hash → skip (mõõdetav „0 uut embeddingut") | CI (static) + NIGHTLY |
| 6 | Katkestatud töö taastamine | SIGKILL ingest'i keskel | pooleliolev versioon EI ole current; retry viib lõpuni; pole „pool-dokumenti" retrieval'is | NIGHTLY |
| 7 | Audience'i eraldatus | CLIENT-only + WORKER-only dok | CLIENT-päring ei too WORKER-dokki kummaski suunas; filter puudub → test KUKUB (kaitse kutsujavea vastu: eraldi test kutsub /search ilma filtrita ja nõuab, et *rakenduse* rajad seda kunagi ei tee — lint/grep-värav) | CI (mock) + NIGHTLY (päris) |
| 8 | Ristkasutaja/ristorg negatiivtest | 2 kasutajat, kumbki 1 privaatdokk | kummagi vastuse trace ∌ teise doc_id; agent-kollektsiooni päring ilma doc_id-filtrita = testiviga | NIGHTLY |
| 9 | Allikaviite õigsus | minikorpuse teadaolevad vastused | iga displayed-source ∈ selected-context; trace ei sisalda chunk-teksti (privaatsuspiir, ptk 8) | CI (kontraktitest trace-fixture'il) + PRE-DEPLOY (v24a checker) |
| 10 | Kõrge riskiga väite värskus | vorm/kontakt stale-after ületatud | vastus kannab kohustuslikku värskusmöödet; kinnitamata uus kontakt ei ilmu | NIGHTLY + PRE-DEPLOY |
| 11 | Täpne õiguslik fakt | 3 legal-exact kaasust (SHS §-d) | õige akt + paragrahv tsiteeritud; vale KOV-i leke = 0 (sourceQualityMetrics juba mõõdab) | PRE-DEPLOY (`rag:smoke:legal-exact`) |
| 12 | Kontaktandmete kontroll | registrisnapshot vs teadaolev fixture | vastuse kontakt == registri current; registrivälise kontakti pakkumine = FAIL | NIGHTLY |
| 13 | ET/EN/RU retrieval | sama küsimus 3 keeles minikorpuse vastu | iga keel toob õige dokumendi (või deklareeritud piirang); keele-metafiltri regressioon püütud | NIGHTLY |
| 14 | Adversaalsed päringud | prompt-injection chunk minikorpuses („ignoreeri juhiseid…"), XSS-pealkiri, 10k-tähemärgi päring | injection ei muuda vastuse juhiseid; pealkiri escape'itud; pikk päring ei kukuta teenust | NIGHTLY |
| 15 | Vastamisest hoidumine | küsimus, millele korpuses tõendit pole | `insufficient_evidence` rada käivitub; mudel ei fabritseeri allikat (displayed=0 & vastus ütleb seda) | NIGHTLY + golden-eval edge-perekond |
| 16 | Vana versiooni rollback | v2 vigane → rollback v1 | current-lipp tagasi v1-le; retrieval serveerib v1; audit kirjas | NIGHTLY |
| 17 | Päris RAG-teenuse smoke | 7 küsimust (olemas: smoke v1/v2) | HTTP 200 + struktuursed ootused | PRE-DEPLOY |
| 18 | Päris DB migratsiooni-/cleanup-kontroll | `db:migrate:check` + `practices:rag:verify` | migratsioonid rakenduvad; RAG-jääk 0 | CI (migrate:check) + PRE-DEPLOY (verify) |
| 19 | Jõudlus ja maksumus | 20 päringut NIGHTLY korpuse vastu | p95 /search < eelarve; embeddingu-kulu ingest'il = 0 muutumatul sisul (idempotentsuse kulumõõdik); OpenAI-kulu logitakse (cost-mirror on teenuses olemas) | NIGHTLY |
| 20 | Deploy-värav | kõik ülal | PRE-DEPLOY komplekt on ÜKS käsk (`rag:gate`), fail-closed, ja `deploy-server.mjs` keeldub ilma selle rohelise tulemita (praktikavärava laiendus kogu RAG-ile) | PRE-DEPLOY |

Golden eval (37) jääb sisu-kvaliteedi mõõdikuks (PRE-DEPLOY, mitte-blokeeriv trend + blokeeriv miinimum nt ≥33/37); kihid 1–8, 16 on uus *infrastruktuuri*-eval, mida praegu ei eksisteeri üldse.

---

## 11. Admini ja retsensendi tööjärjekorrad

Ainult RAG-i järjekorrad (admini üldanalüütika on eraldi teema — `fable-5-admini-analuutika-haldus-ja-koondvaated.md`). Praegu on olemas andmed (raportifailid, DataDeletionJob read, SourceFeedback, MaterialSubmission), aga **mitte ühtegi ühendatud järjekorravaadet** — admin peab teadma, millist skripti/lehte vaadata. Sihtolek: üks „RAG-i töölaud", mille iga rida viitab tõendile.

| Järjekord | Prioriteet | Omanik | Vajalik tõend rea juures | Lubatud toimingud | Auditijälg | Valmis, kui |
|---|---|---|---|---|---|---|
| Uus materjal (MaterialSubmission pending) | P2 (SLA 7 p) | sisutoimetaja | fail, sha256, duplikaadivihje, esitaja kommentaar | review/reject/import-RAG-i (uus, ptk 3) | staatusemuutus + reviewNote (olemas) | staatus lõplik JA import'itud real on ragDocId |
| Muutuse kandidaat (web/RT/kontaktid) | P1; kriisikontakt P0 | sisutoimetaja | vana→uus diff, hash'id, finalUrl, sample (raportid juba kannavad) | apply / lükka tagasi (baseline-uuendus) / märgi müraks | apply-raport + bak (olemas); lisada „kes" | kandidaatfaili pole JA re-ingest järjekorras |
| Aegunud allikas (stale-after ületatud) | P2; vormid/kontaktid P1 | sisutoimetaja | freshness-audit rida (tüüp, last_checked, põhjused) | käivita kontroll / märgi kehtivaks (uus last_checked) / arhiveeri | meta-patch auditiga | `stale`+`expired` loend tühi või teadlikult aktsepteeritud |
| Ebaõnnestunud ingest | P1 | tehniline admin | DataDeletionJob rida (lastErrorCode, attempts) — praktikatel olemas, teistele tüüpidele tuleb sama kandja | retry / loobu (koos põhjusega) | job-rida ise | pending/failed = 0 (nagu `practices:rag:verify`) |
| Kustutamisjääk | P0 (privaatsus) | tehniline admin | job-rida + `GET /documents/{id}/chunks` tulemus | retry / eskaleeri | job + DataAuditLog (olemas) | jääk 0; verify-värav roheline |
| Kasutaja veateade (SourceFeedback OPEN) | P1 kui kategooria = vale/aegunud info; muidu P2 | sisutoimetaja | teade + sourceId + vestluskontekst (kui jagatud) | resolve märkusega / ava seotud allikas / loo muutuse kandidaat | resolvedBy/resolutionNote (olemas) | OPEN=0 üle SLA |
| Kontaktimuutus | P0–P1 (klassi järgi, ptk 7) | sisutoimetaja (+ teine kinnitaja kriisiklassil) | currentEmail vs foundEmail, confidence, allika-URL (raport kannab) | apply / tagasi lükka | apply-raport + ServiceMap sync tulemus | registri + ServiceMap + RAG-snapshot kolmik sünkroonis |
| Kõrge riskiga allikas (õigus/kriis/lapsed) | P1 ülevaatustsükkel | pädev retsensent | allikas + kehtiv redaktsioon + viimane kontrolliaeg | kinnita kehtivus / algata uuendus | reviewEvent (SourcePackage'il olemas — laiendada) | kõik kõrge riski allikad kontrolliajaga ≤ klassi piir |
| Topeltallikas | P3 | sisutoimetaja | sama content_hash / sama url_canonical eri doc_id-del (päringuga leitav) | liida (supersede) / märgi teadlikuks duplikaadiks | supersede-kirje | duplikaadiraport tühi |
| Versioonikonflikt (register ütleb v2, RAG serveerib v1) | P1 | tehniline admin | registri version vs RAG-i meta võrdlusraport (uus, odav skript) | re-ingest / rollback | job-rida | võrdlusraport tühi |

## 12. Rakendusjärjekord

Paketid on järjestatud nii, et iga järgmine toetub eelmisele; P0–P2 on väikesed ja kohe alustatavad.

### RAG-P0: aktiivse oleku ja kustutuse invariandid
- **Eesmärk:** „eemaldatud on päriselt eemaldatud" ja „ok tähendab ok". DELETE tagastab kustutatud chunk-arvu ja vea korral vea; `deleteRagDocument` + DataDeletionJob käsitlevad ausat vastust; chunks-järelkontroll retry-rajal.
- **Sõltuvused:** puudub. **Puutepind:** rag-service `delete_doc`; `lib/documents/ragService.js`; retry-teenus. Migratsioone EI.
- **Testid:** 10.4 (NIGHTLY miinimumvariant: lokaalne rag-service tmp-kaustaga), ühiktestid vastuse kujule.
- **Teadlikult ei tee:** versioonimudelit, UI-d.
- **Valmis:** tapetud-teenuse stsenaarium läbib; `hadEntry=false`+chunks>0 kombinatsioon võimatu.
- **Järelkontroll:** kas mõni kutsuja sõltus vanast `ok:true`-st.

### RAG-P1: kanooniline allika- ja versioonileping
- **Eesmärk:** ptk 4.1 leping koodi: `source_id`+`version`+`supersedes`+`is_current_version` registris; aktiveerimistehing; retrieval'i current-filter; trace kannab versiooni.
- **Sõltuvused:** P0. **Puutepind:** rag-service ingest/registri väljad + `/search` vaikefilter; `sourceMetadata.js`; ingest-skriptide ühine helper. Prisma migratsioone EI (register on failipõhine).
- **Testid:** 10.2, 10.3, 10.5, 10.16 (NIGHTLY); static-payload testide uuendus.
- **Teadlikult ei tee:** vanade doc_id-de mass-migratsiooni (v0-reegel, ptk 4.1).
- **Valmis:** minikorpuse v1→v2→rollback tsükkel roheline.
- **Järelkontroll:** kas mõni runtime-rada filtreerib historical/current topelt (RT `is_current_version` juba olemas — ühtlustada, mitte dubleerida).

### RAG-P2: allikaregister ja automaatne muutusekontroll
- **Eesmärk:** kolme olemasoleva check/apply toru ajastamine (systemd timer), 5.3 olekumasin, PDF-checksum, gone-kandidaadi 3×48h reegel, robots.txt austus; raportid samadesse failidesse, mida admin-API-d juba loevad.
- **Sõltuvused:** P1 (kandidaadi apply → versioon). **Puutepind:** scriptid + `lib/admin/rag/*Monitor*`; ops (timer). Rakenduskoodi minimaalne.
- **Testid:** monitor-ühiktestide laiendus (redirect, 404-seeria, PDF-hash); NIGHTLY fixture-sait.
- **Teadlikult ei tee:** auto-avaldamist (ainult kandidaadid + järjekord).
- **Valmis:** nädal timer-jookse ilma inim-käivituseta; kandidaadid ilmuvad järjekorda.
- **Järelkontroll:** valepositiivide määr (normaliseerimise piisavus) enne sageduste tõstmist.

### RAG-P3: kontaktiregistri ja RAG-i ühine tõeallikas
- **Eesmärk:** ptk 6.1 — registrisnapshot RAG-i (`kontakt:<slug>:v<N>`), SourcePackage kontaktisektsiooni eelistus registrisnapshot'ile, kinnitamata kontakti mittekuvamise reegel, stale-möönde runtime'is; ServiceMap-sync apply kohustuslikuks.
- **Sõltuvused:** P1, P2. **Puutepind:** contactRegistry service (snapshot-render + ingest), `sourcePackages.js`/`riskPolicy.js`, apply-rada.
- **Testid:** 10.10, 10.12 (NIGHTLY); sourcePackages ühiktestid uuele eelistusreeglile.
- **Teadlikult ei tee:** kontaktide DB-stumist (failiregister jääb; DB-sse viimine on eraldi otsus).
- **Valmis:** „Kes on X valla sotsiaaltöötaja?" vastuse kontakt == registri current + kontrolliaeg kuvatud.
- **Järelkontroll:** kas KOV-veebi contact_page chunk'id hakkavad snapshot'iga konkureerima (dedup-reegel).

### RAG-P4: materjalide ülevaatus ja staatuse nähtavus
- **Eesmärk:** ptk 3 miinimumparandus: MaterialSubmission→RAG sild (admini „saada RAG-i" sama ingest-toruga, ragDocId+ingestedAt+ingestError seos), esitaja „minu esitised" vaade, sha256-duplikaadihoiatus, rightsHolder/authorName väljad.
- **Sõltuvused:** P1 (`material:<id>:v<N>` id-d). **Puutepind:** **Prisma migratsioon** (uued veerud), `/api/materials` GET-i omaniku-skoop, admin-UI toiming, ingest-helper.
- **Testid:** 10.1 materjalitüübile; staatusemasina laiendus; negatiivtest 8.2 (pending ei ilmu retrieval'is).
- **Teadlikult ei tee:** avalikku esitusvormi mittekasutajatele; automaatset kinnitamist.
- **Valmis:** esitaja näeb staatust; „imported" ilma ragDocId-ta on võimatu uutel ridadel.
- **Järelkontroll:** vanade „imported" ridade backfill-otsus (käsitsi seos või jäävad märkimata).

### RAG-P5: eval-programm
- **Eesmärk:** ptk 10 kihid 1–16 NIGHTLY komplektina (lokaalne rag-service + Postgres + minikorpus), kihid 9/18 CI-sse; golden-eval miinimumlävi.
- **Sõltuvused:** P0–P1 (muidu testitakse teadaolevalt katkist). **Puutepind:** `eval/fixtures/`, test-harness (docker-compose või lokaalne käivitusskript), CI-konf.
- **Teadlikult ei tee:** LLM-judge'i; mudeliväljundi range determinismi nõuet.
- **Valmis:** NIGHTLY roheline 7 järjestikust ööd.
- **Järelkontroll:** flakiness-määr; kulu öö kohta.

### RAG-P6: deploy-väravad, scheduler ja operatiivjuhis
- **Eesmärk:** üks `rag:gate` käsk (praktikavärav + verify + freshness-errors + smoke) ja `deploy-server.mjs` keeldub ilma selleta; timerite/järjekordade operatiivjuhis `docs/internal/` alla; registri JSON-i varukoopia rotatsioon.
- **Sõltuvused:** P5. **Puutepind:** deploy-skript, ops-doc. **Teadlikult ei tee:** pilve-CI ümberehitust.
- **Valmis:** deploy ilma väravata on võimatu ilma eksplitsiitse `--skip-gate --reason` auditita.
- **Järelkontroll:** värava kestus (peab jääma minutitesse).

### RAG-P7: admini RAG-tööjärjekorrad
- **Eesmärk:** ptk 11 tabel üheks töölauavaateks olemasoleva ra-* admin-UI sees; iga rida viitab tõendile; toimingud kutsuvad olemasolevaid API-sid.
- **Sõltuvused:** P2–P4 (muidu pole ridu, mida näidata). **Puutepind:** admin-UI + paar list-API-t; migratsioone ideaalis EI (loeb olemasolevaid allikaid).
- **Valmis:** admin leiab kõik kümme järjekorda ühelt lehelt; „mitu asja ootab?" on üks number.
- **Järelkontroll:** kas järjekorrad päriselt tühjenevad (SLA-mõõdik), mitte ei kuhju.

## 13. Lõpphinnang

1. **Kas praegune RAG vajab edasiarendamist?** Jah — aga mitte otsingu kvaliteedi poolel. Retrieval, marsruutimine, attributsioon ja KOV/SourcePackage kiht on küpsemad kui enamik selliseid süsteeme; **elutsükkel** (versioonid, kustutuse kviteering, värskuse automaatika, materjalisild) on see, mis pole produktsioonivalmis.
2. **Mis on juba tugev?** Hybrid-otsing + deterministlik planner + displayed-source leping + trace; praktikate täielik elutsükkel (versioon→retry→purge→fail-closed värav); check→kandidaat→apply muster kolme registriga; kasutajadokumentide privaatsusrada; värskuspoliitikate ja riskipolicy runtime-piirid (ajakirjaartikkel ei kinnita vormi).
3. **Suurim produktsioonirisk?** Kolmik: (a) kustutus võib vaikselt jätta chunk'e (leitavus säilib pärast „edukat" kustutust); (b) versioonita ülekirjutus teeb vead taastamatuks ja vastused taasesitamatuks; (c) mitte ükski RAG-invariant ei jookse üheski väravas automaatselt — kõik sõltub sellest, et keegi mäletab käsku. Kõik kolm on odavad parandada (P0/P1/P6).
4. **Kas automaatne allikavärskendus on realistlik?** Jah — pool tööst on tehtud (fingerprint-kontrollid, kandidaadifailid, apply-kaitsed). Puudu on ainult taimer, olekumasin ja järjekord. See EI ole uurimisprojekt, see on ops-töö.
5. **Millised muudatused võivad olla automaatsed?** Avastamine ja kandidaadi loomine alati; katkise lingi peitmine; formaadiparandusklassi kontaktiparandus; osutaja enda saadavusinfo; muutumatu sisu re-check (last_checked värskendus). 
6. **Millised vajavad alati inimest?** Õigusaktide sisu, kriisi- ja lastekaitsekontaktid (four-eyes), toetuste summad/tähtajad, uue vormi avaldamine, spetsialistimaterjali vastuvõtt, iga „allikas kadunud → arhiveeri" otsus.
7. **Kuidas kontakte ajakohastada?** Ptk 6 mudel: failiregister jääb kanooniliseks, veebikontroll toodab kandidaate, inimene apply'b, apply sünkroonib KOHUSTUSLIKULT nii ServiceMap'i kui RAG-snapshot'i (`kontakt:<slug>:v<N>`), runtime eelistab snapshot'i ja märgib vananenud kontrolli aja. RAG ei ole kunagi kontakti tõeallikas.
8. **Viis testi, mis peavad enne pilooti töötama:** 10.3 (superseded eemaldus), 10.4 (kustutus+retry ausa kviteeringuga), 10.7 (audience-eraldatus päris teenusega), 10.8 (ristkasutaja negatiivtest), 10.12 (kontakti vastavus registrile). Need viis katavad usalduse miinimumi: „vale, vana, võõras ja kinnitamata sisu ei jõua vastusesse".
9. **Järgmise teostaja esimene piiritletud ülesanne:** **RAG-P0** — muuta rag-service'i `delete_doc` ausaks (kustutatud chunk-arv + viga vea korral), kohandada `deleteRagDocument`/retry sellele ja lisada NIGHTLY-miinimumtest lokaalse teenusega. Väike, iseseisev, mõõdetav; avab ukse P1 versioonilepingule.

## 14. Master-list kui kanooniline lingiregister ja platvormiülene URL-korje

### 14.0 Faktid enne analüüsi (piiritlus)

1. **Master-listi PDF on RAG-is dokumendina olemas.** Seda EI käsitleta puuduva failina ja selle uuesti-ingest ei ole lahendus millelegi selles peatükis.
2. **PDF-is/paketis loetletud veebiallikate üldist automaatkorjet ei ole tehtud.** Register on kaart; lingitud lehtede sisulist koopiat platvormiülese toruna ei eksisteeri. Koodis on see isegi eksplitsiitne: `knowledge:source-master:*` töötleb AINULT PDF-kandidaate ja ütleb ise: „Organization/web pages remain outside this pipeline and should use separate collection agents" ([ingest-source-master-pdfs.mjs:52](scripts/ingest-source-master-pdfs.mjs:52)).
3. **Juhendatud KOV-korje ≠ platvormiülene URL-korje ja seire.** KOV-toru (ptk 2.2, 5) on slug-põhine, käsitsi kureeritud failipakettidega ja KOV-teenuseinfo-spetsiifilise metaga; master-listi 323 allikat on riigi/organisatsioonide/uuringute/juhendite tasand, millel oma tüübid, oma marsruudid (`recommended_pipeline`) ja millest suurem osa ei käi ühegi KOV-paketi kaudu.
4. **Master-listi dokument ise ei tohi saada lõppkasutaja vastuste peamiseks sisuliseks allikaks.** Register ise deklareerib seda: kõigil 323 kirjel on `user_facing_knowledge: false` ja `registry_role: "dedupe_seed_and_ingest_planning"`. Kui vastus peab tuginema algallikale, peab retrieval jõudma algallika sisuni, mitte registri реa kirjelduseni. Kuna master-listi PDF *on* korpuses, on olemas reaalne risk, et „milliseid materjale on X kohta?" stiilis päring toob vastuseks registri enda chunk'e — see tuleb metadata-märgistuse ja attributsioonireegliga maha suruda (14.4.5).

Registri tegelik kuju (kontrollitud `Andmebaasi/Admebaasi-materjali-lisa/master_sources_final.json` vastu): 323 kirjet; `source_format` html 143 / pdf 180; `recommended_pipeline`: knowledge_doc_pipeline 186, organization_collection_agent 60, html_or_topic_pipeline 50, journal_layer 11, registry_reference 16; `ingest_status`: ingest_candidate 172, referenced_only 137, needs_review 14; `ingest_priority`: high 34, medium 173, low 116; 75 duplikaadigruppi (`duplicate_group_id`), igal kirjel `normalized_url` ja `dedupe_key`. **Väli `link_check_status` on täidetud ainult 121 kirjel 323-st (OK 89, Search-confirmed 24, Redirect 5, muu 3) ja on käsitsi hetkemärge ilma ajatempli ja järgmise kontrolli ajata.**

Kattuvus produktsiooniga (kasutaja võrdlus, 15.07): 323 URL-ist **167 kattub** produktsiooni RAG-i URL-idega ja **156 ei kattu**. Kattuvust EI tohi lugeda „korjatud ja korras" — vt 14.9 protokoll.

### 14.1 Master-list kanooniliseks lingiregistriks (küsimus 1)

Register on juba peaaegu õige kujuga (normalized_url, dedupe_key, tüübid, marsruudid, prioriteedid). Kanooniliseks saamiseks on vaja nelja asja:

1. **Üks omanik ja üks asukoht.** Fail jääb repo-osaks (nagu KOV-registrid), aga saab ptk 4.1 versiooniväljad faili tasandil: `registry_version`, `updated_at`, muutuste bak-failid — täpselt sama muster nagu `kov_kontaktid_loplik.json`-il (fingerprint + bak on kontaktiregistris juba tõestatud).
2. **Elutsükliväljad kirje tasandil.** Praegused `ingest_status`/`link_check_status` on staatilised planeerimismärkmed. Lisada: `last_checked` (ISO), `next_check_at`, `check_status` (5.3 olekumasina olek), `web_content_sha256`/`pdf_sha256` (baseline), `rag_doc_id` (kui korjatud, siis millise dokumendina), `rag_ingested_at`, `superseded_by`. NB: mitte nimetada olemasolevaid välju ümber — lisada kõrvale, et vanad tööriistad ei puruneks.
3. **Tüübilepingu vastavusse viimine.** Master-listi `source_type` väärtused `registry`, `web_page`, `social_media_page` (ja kontrollida `organization_profile`) ei ole (kõik) kanoonilises `sourceMetadata.js` tüübinimistus ega värskuspoliitikas ([sourceFreshness.js:36](lib/rag/sourceFreshness.js:36)). Enne korjet tuleb leping laiendada või väärtused mäppida — muidu tekib korpusesse taas `unknown`-klassi meta, mille backfill just ära koristati.
4. **Registri kirje = allika identiteet.** `source_id` master-listist saab ptk 4.1 lepingu `source_id` prefiksiga `master:<source_id>` ja RAG doc_id-ks `master:<source_id>:v<N>`. Nii on iga korjatud leht tagasi viidav registrikirjeni ühe välja kaudu.

### 14.2 URL-i kontroll olemasoleva RAG-sisu vastu (küsimus 2)

Enne mistahes korjet jooksutada **võrdlusskript** (read-only; sama klass nagu `rag:list:docs`):

1. Normaliseeri mõlemad pooled sama funktsiooniga: skeem+host lowercase, `www.` maha, lõpu-`/` maha, query-parameetrite valge nimekiri (enamik ametlikke lehti ei vaja query'sid; `?id=` tüüpi CMS-parameetrid jäävad), fragment maha. Registri `normalized_url` on juba olemas — sama normaliseerija tuleb rakendada RAG-i registrikirjete `url`/`url_canonical`/`source_url` väljadele (need on teenuse registris olemas, ptk 1).
2. Võrdle kolmes astmes: (a) täpne normaliseeritud URL; (b) sama host + path ilma lõpusegmendita (avastab „sama leht, teine keeleversioon/alamleht"); (c) `dedupe_key`/pealkirja sarnasus kandidaatide markeerimiseks. Ainult (a) loeb „kattuvuseks"; (b)–(c) on inimesele vihjed.
3. Väljund registri kirjesse: `rag_match` = {doc_id, matched_by, collection_id, source_type, last_ingested} või null. See on 14.9 protokolli sisend.

### 14.3 Puuduvatest URL-idest korjekandidaadid (küsimus 3)

156 mittekattuvat (ja 14.9 järgi „kattub, aga puudulik") kirjet EI lähe otse ingest'i. Igast saab **korjekandidaat** — sama kandidaadimuster, mis KOV-torudel (`*.kontroll.json`):

- kandidaadifail `master_sources.korje.json`: kirje + fetch'i tulemus (HTTP-staatus, finalUrl, content-type, normaliseeritud teksti sha, teksti pikkus, sample 420 tm) — st täpselt `buildPageSnapshot` formaat ([kovSourceMonitor/service.js:137](lib/admin/rag/kovSourceMonitor/service.js:137));
- prioriteet registri `ingest_priority` järgi (high 34 → esimene laine);
- inimene kinnitab kandidaadi enne ingest'i (ptk 7 piir: avastamine auto, avaldamine mitte) — v.a 14.7 madala riski erand;
- kinnitatud kandidaat → ptk 4.1 aktiveerimistehing doc_id-ga `master:<source_id>:v1`.

### 14.4 Sisu korje allikatüübi järgi (küsimus 4)

`recommended_pipeline` on juba registris — korje peab seda austama, mitte leiutama uut ühtset kraabitsat:

1. **`knowledge_doc_pipeline` (186; valdavalt PDF).** Olemasolev toru töötab (`knowledge:source-master:plan/ingest`, `--skip-existing`, sektsioonianalüüs). Puudu on ainult HTML-lehel elavate 6 kirje käsitlus ja registri tagasikirjutus (`rag_doc_id`).
2. **`organization_collection_agent` (60).** Olemasolev organisatsioonipakettide toru (4-faili pakett, ptk 2.8) — korje tähendab siin paketi *loomist/uuendamist*, mitte lehe toorest ingest'i. Automaat võib toota mustandpaketi (lehe tekst + meta), inimene kinnitab.
3. **`html_or_topic_pipeline` (50).** See ongi puuduv toru: HTML → normaliseeritud põhitekst (main/article-eelistus, nav/bännerid maha — sama normaliseerija, mis 5.2) → `/ingest/text` teemalehe metaga (`source_type` mäpitud, `url_canonical`, `authority` publisher'ist, `audience`/`language` registrist). Väike ja ehitatav olemasolevate tükkide peale.
4. **`journal_layer` (11).** Suunata olemasolevasse ajakirjakonveierisse (`rag:ingest:ajakiri`), mitte üldkorjesse — artikli-meta (autorid, number, aasta) on seal juba lepinguline.
5. **`registry_reference` (16) + master-listi PDF ise.** NEED EI OLE KORJE SIHTMÄRGID sisuna — need on viited registritele/kataloogidele. Märgistada RAG-is `evidence_role=registry_reference` (patch-meta olemasolevatele, sh master-listi PDF-dokumendile) ja lisada attributsiooni/riskipoliitika reegel: registriviide ei või olla vastuse ainus kuvatud allikas, kui küsimus puudutab sisu (sama mehhanism, millega ajakirjaartikkel ei kinnita vormi — [riskPolicy.js](lib/rag/riskPolicy.js) muster). See jõustab fakti 14.0.4 runtime'is.
6. **`social_media_page` (2).** Jätta korjest välja (`manual_check_required`): sotsiaalmeedia kraapimine on ToS-i ja müra küsimus; kirjed jäävad registrisse viidetena.

### 14.5 Dubleerimise vältimine teiste torudega (küsimus 5)

Kolm kaitset, järjekorras odavaimast:

1. **URL-tasand:** 14.2 võrdlus enne iga korjelainet; kui normaliseeritud URL on juba RAG-is teise toru dokumendina (KOV, organisatsioon, ajakiri), siis master-korje EI ingest'i sama URL-i — registrikirje saab `rag_match` viite olemasolevale doc_id-le ja `dedupe_status=covered_by_other_pipeline`. Master-list on dedupe-seeme (tema enda `registry_role` ütleb seda), mitte konkureeriv koopia.
2. **Sisutasand:** enne ingest'i võrdle normaliseeritud teksti sha-d olemasolevate `content_hash`-idega (meta on backfill'itud, ptk 4). Sama hash teise doc_id all → duplikaadijärjekorda (ptk 11), mitte ingest.
3. **Grupitasand:** registri 75 `duplicate_group_id` gruppi — korja grupist ainult esinduskirje (`duplicate_merged` juba märgib liidetuid); ülejäänud saavad `covered_by_group_representative`.

Eraldi reegel KOV-kattuvusele: kui master-listi URL on KOV-domeenil, kuulub ta KOV-toru omandisse (slug-põhine meta, SourcePackage) — master-register viitab, aga ei korja. Vastasel juhul tekiks sama leht kahe eri metadata-lepinguga (nt ilma `municipality_id`-ta), mis rikuks KOV-vastuste attributsiooni.

### 14.6 Muutunud, ümber suunatud, aegunud, kadunud lehed (küsimus 6)

Sama mehhanism, mis ptk 5.2–5.3 — mitte uus süsteem, vaid sama olekumasin uue registri peal:

- baseline = korje hetke `web_content_sha256`/`pdf_sha256` registrikirjes;
- ajastatud re-check sagedusega ptk 7 klassi järgi (nt `official_guideline` 1×/kvartal linkide elusus; `information_material` harvem; `research_report`/PDF checksum 1×/kvartal);
- redirect: 301 → URL-i uuenduskandidaat (registrisse `normalized_url` uuendus inimkinnitusega); domeenivahetus = kõrge risk;
- kadunud: `gone_candidate` alles pärast 3 järjestikust ebaõnnestumist ≥48 h jooksul; inimotsus → `archived` (RAG-dokument saab `source_status=archived` + supersede ilma asendajata, st eemaldub current-filtriga) või uus URL;
- muutunud sisu: kandidaat → kinnitus → `master:<source_id>:v<N+1>` ptk 4.1 tehinguga; vana versioon supersede.

`link_check_status` vabateksti („Search-confirmed" jms) EI kasutata automaatikas — see jääb ajalooliseks märkmeks; automaatika tugineb ainult uutele masinväljadele (`check_status`, `last_checked`, hash'id).

### 14.7 Automaatika piir (küsimus 7)

Ptk 7 maatriks kehtib; master-korje spetsiifiliselt:

| Samm | Auto? |
|---|---|
| URL-võrdlus RAG-iga (14.2), raport | JAH, ajastatud |
| Fetch + snapshot + korjekandidaadi loomine | JAH |
| Kandidaadi ingest — `information_material`, `research_report`, `web_page` (madal risk, mitte-KOV, mitte-õiguslik) | JAH tingimusel: sisu-sha unikaalne, HTTP 200 ilma redirectita, teksti pikkus > lävi, tüübimäpp olemas; **järelauditiga** (ptk 7 „üldine selgitav sisu" klass) |
| Kandidaadi ingest — `official_guideline`, `policy_analysis`, `registry`, org-paketid, kõik õigusliku/kontakti/vormi sisuga lehed | EI — inimkinnitus |
| Redirect'i/kadumise otsus (registri URL-i muutus, arhiveerimine) | EI — inimkinnitus |
| Re-check + muutuse kandidaat | JAH |
| Uue versiooni avaldamine muutunud sisust | EI (v.a sama madala riski klass, sama tingimustega) |

### 14.8 Päritolu, versioon, kontrolliaeg, järgmine kontroll (küsimus 8)

Iga korjatud dokumendi RAG-meta kannab (kõik väljad on registri/lepingu olemasolevad või ptk 4.1 lisad):

- **päritolu:** `source_register_file="master_sources_final.json"`, `canonical_source_id=master:<source_id>`, `url_canonical`, `publisher`/`authority`, `collection_id` registri `collection_hint`'ist, `evidence_role`;
- **versioon:** doc_id `master:<source_id>:v<N>` + `content_hash` + `supersedes`;
- **kontrolliaeg:** `last_checked` (korje/re-check'i aeg) — juba kohustuslik väli metadata-lepingus;
- **järgmine kontroll:** `next_check_at` elab REGISTRIS (mitte RAG-metas) — RAG on snapshot, register on ajakava omanik; freshness-audit loeb mõlemat ja raporteerib lahknevused.

### 14.9 Kattuvuse kontrolli protokoll (167 ≠ „valmis")

Iga kattuva URL-i kohta neli kontrolli, mis annavad kirjele ühe seisunditest:

1. **Päritolu:** millise toru dokument katab (`collection_id`/`source_type`/doc_id muster)? Kui katab KOV-/org-/ajakirjatoru → `covered_by_other_pipeline` (õige seis, master ei dubleeri). Kui katab juhuslik üksik-ingest ilma lepingulise metata → `needs_adoption` (dokument tuleb „adopteerida": patch-meta `canonical_source_id` + registri `rag_doc_id` seos).
2. **Sisu ja täielikkus:** kas RAG-dokument katab registri kirje *sisu* (nt org-profiil katab kodulehe avalehe, aga registri kirje viitab konkreetsele juhendilehele sama domeeni all)? Kontroll: path-täpsusega URL-võrdlus (mitte ainult host) + chunk-arv > 0 + teksti pikkuse võrdlus värske fetch'iga (>50% kadu → `incomplete`).
3. **Värskus:** `last_checked` olemas ja klassi piires? Puudub/ületatud → `stale_match`.
4. **Meta-leping:** `source_type`/`audience`/`url_canonical` kanoonilised? Ei → `needs_meta_patch` (patch-meta, mitte re-ingest).

Alles `covered_by_other_pipeline` või `adopted+fresh+complete` loeb „korjatud ja korras"; kõik muu läheb 14.3 kandidaadivoogu või patch-järjekorda. Sama protokoll annab ka esimese ausa numbri: mitu master-listi allikat on *päriselt* kasutuskõlblikult korpuses (praegu teadmata; 167 on ülempiir).

### 14.10 Rakenduspakett RAG-P8: master-listi URL-korje ja seire

- **Eesmärk:** 14.1–14.9 töövoog: registri elutsükliväljad, võrdlusskript, korjekandidaadid, html_or_topic toru, dedupe-reeglid, registriviite allasurumisreegel, seire samale olekumasinale.
- **Sõltuvused:** RAG-P1 (versioonileping), RAG-P2 (olekumasin+timer); P3-st sõltumatu.
- **Puutepind:** skriptid (`scripts/` + `scripts/lib/source-master-*`), `sourceMetadata.js` tüübilaiend, `riskPolicy.js`/attributsiooni registriviite reegel, registri JSON. Prisma migratsioone EI; rag-service'i muudatusi EI (kasutab olemasolevaid endpoint'e).
- **Testid:** võrdlusskripti ühiktestid (normaliseerija!), kandidaadi-snapshot fixture'id, 10.1/10.5 laiendus master-tüüpidele, registriviite-allasurumisreegli ühiktest, NIGHTLY minikorpuse master-fixture.
- **Teadlikult ei tee:** social_media korjet; KOV-domeenide korjet (jääb KOV-torule); registri DB-stumist; 156 puuduva mass-ingest'i ühe laadungina (lained prioriteedi kaupa, high 34 enne).
- **Lõpetamiskriteerium:** iga registri kirje on täpselt ühes seisundis (`covered_by_other_pipeline` / `adopted` / `ingested:v<N>` / `candidate` / `manual_check_required` / `archived`); „mitu allikat on päriselt korpuses" on üks raportinumber; registriviite-dokument ei ilmu enam sisulise vastuse ainsa allikana.
- **Sõltumatu järelkontroll:** valepositiivsete duplikaatide määr (kas dedupe ei blokeeri õigustatud korjet); kas html_or_topic ingest'i meta läbib freshness-auditi puhtalt.

STATUS: COMPLETE
