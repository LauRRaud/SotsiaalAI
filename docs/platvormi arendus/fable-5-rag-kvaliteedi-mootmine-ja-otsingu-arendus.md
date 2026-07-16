# RAG-i kvaliteedi mõõtmine ja otsingukihi järgmine areng

STATUS: COMPLETE

> Fable 5 read-only analüüs, 2026-07-15, aktiivse `main`-i (890124bd) vastu.
> Rakenduskoodi, skeemi, migratsioone, andmebaasi ega RAG-i sisu ei muudeta; ingest'i, patch'i, delete'i ega deploy'd ei tehta.
> Eeldus: P8 tehniline tööplaan (`fable-5-rag-p8-url-korje-tehniline-tooplaan.md`) ja elutsükli analüüs (`fable-5-rag-materjalide-elutsukkel-ja-automaatne-allikavarskus.md`) — siin EI korrata.

## Sisukord

1. [Alus ja loetud kood](#1-alus-ja-loetud-kood)
2. [Kolme veaämbriga mõõtmismudel](#2-kolme-veaämbriga-mõõtmismudel)
3. [Praegune mõõdetavus](#3-praegune-mõõdetavus)
4. [Golden-evali tegelik väärtus](#4-golden-evali-tegelik-väärtus)
5. [Mõõdikute leping](#5-mõõdikute-leping)
6. [Otsinguparanduste hinnang](#6-otsinguparanduste-hinnang)
7. [Eesti keele sihtkontroll: rahvakeele eval-kataloog](#7-eesti-keele-sihtkontroll-rahvakeele-eval-kataloog)
8. [Soovitatud arengujärjekord](#8-soovitatud-arengujärjekord)
9. [Väljund](#9-väljund)
10. [Lisa A — RAG-QM-P0 privaatsuskindel valim ja teostusleping](#lisa-a--rag-qm-p0-privaatsuskindel-valim-ja-teostusleping) *(ülimuslik ptk 8–9 varasemate sõnastuste suhtes)*

---

## 1. Alus ja loetud kood

Loetud täielikult: elutsükli analüüs (ptk 1, 9, 10 — testide tabel), P8 tööplaan, kasutaja lisatud koondhinnang (`.codex/attachments/9871b8eb…/pasted-text.txt` — sisaldab kolme veaämbri hüpoteesi ja 6 otsinguhoova esialgset pingerida, mida siin koodi vastu kontrollin). Kood (aktiivne `main`, 890124bd):

- **Planner:** [questionPlanner.js](lib/chat/questionPlanner.js) — deterministlikud režiimid: `legal_exact`/`explicit_paragraph`, `kov_service_or_benefit`, `specific_document_lookup`, `overview_synthesis`, `life_situation_guidance(_hybrid)`, `comparison`, `resource_discovery(_hybrid)`.
- **Hybrid/BM25/RRF:** [main.py:3030](rag-service/main.py:3030) — RRF `k=60` (`RAG_RRF_K`), kanalikaalud `HYBRID_CHANNEL_WEIGHTS`, per-vaste `rrf_contributions`; leksikaalne pool = skaneeriv skoorija ([main.py:3176](rag-service/main.py:3176)), indeksita.
- **Evidence/attribution/trust:** [evidencePackage.js](lib/chat/evidencePackage.js), [sourceAttribution.js](lib/chat/sourceAttribution.js) (otsusekoodid, nt `INSUFFICIENT_EVIDENCE_STRENGTH`, `LEGAL_MUNICIPALITY_MISMATCH`), [sourceTrust.js:82](lib/chat/sourceTrust.js:82).
- **Freshness:** [sourceFreshness.js:36](lib/rag/sourceFreshness.js:36) poliitikad (audit-, mitte pingerea-kasutuses).
- **Graph-lite:** offline plan-builder ([build-rag-graph.mjs](scripts/build-rag-graph.mjs) — KOV-kimpudest, DB-kirjutuseta, migratsioon ootab) + runtime graafikanali eksperiment assembleris (`graphChannelTest`).
- **Trace:** ehitaja [mainResponseHandler.js:337](lib/chat/mainResponseHandler.js:337) (`buildRagTraceFromAttribution`, lipu `RAG_TRACE_V1_ENABLED` taga); püsitalletus kahes kohas — `ChatLog` sündmusena `rag_trace` ([mainResponseHandler.js:449](lib/chat/mainResponseHandler.js:449) → [logger.js](lib/chat/logger.js), `redactObject`-iga) ja `ConversationMessage.metadata`-s ([persistence.js:189](lib/chat/persistence.js:189)).
- **Muud sündmused:** `rag_search` ([retrievalContextAssembler.js:1800](lib/chat/retrievalContextAssembler.js:1800) — vastearvud, grounding, retrieverid, aastad, riskitase, režiim), `chat_no_external_sources` (:1832), `crisis_detected` (:1843), `chat_request`, `openai_stream_timing`, `openai_usage/error`.
- **Eval:** [eval/golden-rag-v1.json](eval/golden-rag-v1.json) (37 kaasust) + [run-golden-eval.mjs](scripts/run-golden-eval.mjs) (elav `/api/chat`, küpsis, `persist:false`) + staatiline struktuurivalidaator (tests/fixtures + goldenEval.test.js) + [check-v24a-live-trace.mjs](scripts/check-v24a-live-trace.mjs) (püsinud trace'i kontroll elavas vestluses, max vanus 720 min).
- **Retention:** ChatLog üldsündmused kustuvad `GENERAL_RETENTION_DAYS` (vaikimisi 90 p, [retention.js:17](lib/retention.js:17)); vestlused aeguvad `CONVERSATION_TTL_DAYS` järgi; kontokustutus kustutab kasutaja ChatLog-read ([userDeletion.js:134](lib/privacy/userDeletion.js:134)).

## 2. Kolme veaämbriga mõõtmismudel

Otsus: kolm ämbrit EI piisa klassifitseerimislepinguks — koodi vastu kontrollides on vaja 8 klassi, sest (a) attributsioonirikkumine on juba täna otse masinloetav ja väärib oma klassi, (b) „õige keeldumine" tuleb eristada veast, (c) planneri/keele viga ja filtripõhine blokk EI ole retrieval'i viga.

| Klass | Masinloetav tunnus | Vajalik tõend | Mida juba logitakse | Mida EI saa praegu mõõta | Valesti klassifitseerimise vältimine |
|---|---|---|---|---|---|
| `COVERAGE_GAP` | `bucket=coverage_gap` | päring + KOGU korpuse filtrivaba kontroll + master-registri seisund (P8.0 raport) kinnitavad: sisu pole | `chat_no_external_sources`; `rag_search.ragMatchCount=0`; `no_context` | automaatne eristus RETRIEVAL_GAP-ist — 0 vastet ≠ sisu puudub | klassifitseeri alles pärast korpuse-kontrolli (offline töö), mitte 0-vaste pealt |
| `RETRIEVAL_GAP` | `bucket=retrieval_gap` | sihtdokument on TEADA (golden-paar/kaebus) ja puudub `retrieved/selected_context_source_ids` hulgast | trace'i täielikud id-loendid + `hybrid_retrieval` kanalid + `retrieval_trace_level` | tavaliikluse „õige dokument" — puudub päring→oodatav-dokument märgendus | nõuab labeled-paari; ilma selleta → `UNKNOWN` |
| `LIFECYCLE_GAP` | `bucket=lifecycle_gap` | kuvatud `source_id` + registri/freshness-poliitika näitavad aegunud/vale versiooni/kustutusjääki | `selected_context_details` (piiratud väljad); freshness-audit eraldi | versiooniviga — versioonimõiste puudub enamikul tüüpidel (RAG-P1); kustutusjääk vajab chunks-kontrolli | proxy = freshness-poliitika rikkumine kuvatud allikal; ära nimeta „aegunuks" ilma `last_checked`-ita |
| `ATTRIBUTION_GAP` | `displayed_sources_subset_of_selected=false` VÕI `displayed_not_in_selected_source_ids≠[]` | trace ise | **täielikult logitud** — ainus juba-valmis klass | — | leping on range; valepositiive pole teada |
| `INSUFFICIENT_EVIDENCE_CORRECT` | `answer_outcome=refused` + korpuse kontroll kinnitab puudumist | outcome-lipp + korpuse kontroll | režiimilipud (`rag_insufficient_evidence_mode`, `insufficient_precise_legal_source_support`) — need on POLIITIKA, mitte tulemus | **vastuse tegelik tulemus (vastas/keeldus/möönis)** — tuvastatav ainult reply-teksti substringidest | ära loe keeldumist veaks enne korpuse-kontrolli; vajab uut `answer_outcome` välja (ptk 3.4) |
| `QUERY_UNDERSTANDING_GAP` | `query_plan.mode`/`topics` ≠ oodatav (rahvakeel, käändevorm, kirjaviga) | golden-paar oodatava režiimi/terminiga | `query_plan` (mode, planner_reason ≤180 tm, topics) on trace'is | tavaliikluselt EI mõõda — päringu tekst ei ole event-logis (õigesti; privaatsus) | mõõda AINULT märgendatud komplektiga (ptk 7 kataloog) |
| `AUDIENCE_OR_SCOPE_BLOCK` | õige allikas esineb `filtered_out_source_ids`-is põhjusega `filter_reasons`/`attribution_decisions` (nt `legal_municipality_mismatch`) | trace + oodatav dokument | filtri-id-d ja põhjused logitud | kas blokk oli ÕIGE (kaitse) või VALE (üleliigne) — vajab märgendust | blokk on vaikimisi kaitse, mitte viga; vale-bloki väide nõuab labeled-paari |
| `GENERATION_GAP` | kontekst sisaldas õiget tõendit, vastus väidab muud | selected ok + inim-/LLM-hinnang vastusele | golden `answer_must_*` substringid (jäme proxy) | tsitaadi-väite vastavus automaatselt | viimane klass otsustuspuus — alles siis, kui kõik eelnevad välistatud |

**Otsustuspuu (järjekord on leping, väldib topeltloendamist):** 1) ATTRIBUTION (mehaaniline) → 2) kas retrieval üldse jooksis (`no_external_sources`/`no_context`) → 3) korpuse-kontroll → COVERAGE vs edasi → 4) kas keeldumine oli õige (INSUFFICIENT_CORRECT) → 5) plaani kontroll (QUERY_UNDERSTANDING) → 6) filtrikontroll (AUDIENCE_OR_SCOPE) → 7) id-loendite kontroll (RETRIEVAL) → 8) värskuse/versiooni kontroll (LIFECYCLE) → 9) GENERATION. Klassifitseerimata jääk = `UNKNOWN` (aus kategooria, mitte suurima ämbri paisutaja).

## 3. Praegune mõõdetavus

### 3.1 Mida `rag_trace` päriselt sisaldab (verifitseeritud)

Loendurid (`retrieved/selected/answer/displayed/filtered_out_source_count`), id-loendid (retrieved, selected_context, answer, displayed, filtered_out, selected-but-not-displayed, retrieved-but-not-displayed), lepingubooleanid (`displayed_sources_subset_of_selected/answer` + rikkuvate id-de loendid), `filter_reasons`, `attribution_decisions`, `retrievers_used`, `selected_context_details` (sanitiseeritud), `source_packages` + package-aware väljad, `section_attribution` + `attribution_flags`, riskiväljad (`rag_risk_level`, `rag_required_evidence`, `rag_insufficient_evidence_mode`), `insufficient_precise_legal_source_support`, `query_plan` (mode, planner_reason ≤180 tm, topics, strateegiad, `legalLookupPlan`), `hybrid_retrieval` (kanalite loendus, tipp-skoorid, merge-strateegia; [retrievalContextAssembler.js:636](lib/chat/retrievalContextAssembler.js:636)), `retrieval_trace_level` (kas retrieved-tase on olemas või ainult selected). **Ei sisalda:** kasutaja päringu teksti, chunk-teksti, latentsust, convId/messageId (event-variandis).

### 3.2 Kus ja millal tekib `insufficient_evidence`

Kolm ERI asja, mida ei tohi segi ajada: (a) **poliitikarežiim** `insufficientEvidenceMode` — riskipoliitika nõue ([riskPolicy.js SOURCE_POLICY](lib/rag/riskPolicy.js)), trace'is `rag_insufficient_evidence_mode`; (b) **legal-tugi puudub** `insufficient_precise_legal_source_support` boolean; (c) **attributsiooni otsusekood** `insufficient_evidence_strength` allika filtreerimisel. **Tulemuse-lippu „vastus JÄI andmata" EI OLE** — golden-kaasus `edge_no_corpus_answer_v2` tuvastab keeldumist reply-substringidega („ei leia", „puudub" …), mis kinnitab lünka.

### 3.3 Püsivus, seostatavus, tundlikkus, nähtavus, retention

- **Püsivus:** `rag_trace`/`rag_search`/`chat_no_external_sources`/`crisis_detected`/`openai_stream_timing` lähevad **andmebaasi** (`ChatLog`, event+data Json, indeks `[event, createdAt]`) läbi `redactObject`-i; täistrace lisaks `ConversationMessage.metadata`-sse. Mõlemad env-lippude taga (`RAG_TRACE_V1_ENABLED` jt) — **mõõdetavus sõltub sellest, et lipud on produktsioonis sees; seda tuleb enne baasjoont kinnitada** (koodist ei saa verifitseerida).
- **Seostatavus:** ChatLog `rag_trace` sündmusel on `userId`+`role`+aeg, aga **MITTE convId/messageId** — sündmust ei saa deterministlikult siduda konkreetse vestlussõnumiga; sidumine on võimalik ainult `ConversationMessage.metadata` kaudu (kus on ka päringu tekst ja vastus), ja SEE rada katkeb `persist:false` korral (sh golden-eval ise). Päring↔plaan↔valikud↔kuvatud↔vastus on seega seostatavad AINULT persisteeritud vestlustes.
- **Tundlik kasutajatekst:** event-logis ei ole päringuteksti (ainult `messageLength` no-sources sündmusel; `query_plan.topics` võib kanda päringust tuletatud fraase — kerge risk); `ConversationMessage` kannab täisteksti — iga mõõtmistöö, mis loeb sõnumeid, on isikuandmete töötlus ja vajab pseudonüümimist (userId → räsi) + koondamist enne raporteerimist.
- **Admin/arendaja nähtavus:** mõõdikuid EI kuva ükski vaade — analytics-summary loeb muid sündmusi; trace'e loeb ainult käsitsi `check-v24a-live-trace`. Jaotused (režiim, risk, retrieverid, 0-vastuste osakaal) on SQL-iga ChatLog'ist arvutatavad, aga keegi ei arvuta.
- **Retention/pseudonüümimine:** ChatLog 90 p (env), vestlused TTL-iga, kontokustutus koristab — mõõtmisbaasjoon peab seega olema **korduvjooksev aruanne** (mitte ühekordne), sest aken libiseb; soovitus: baasjoone-raport salvestab AINULT agregaadid + pseudonüümitud näidisjuhtumid.

### 3.4 Kas kolme ämbri baasjaotuse saab olemasolevast andmest?

**Osaliselt — ausalt: EI saa täielikult.** Olemasolevast saab ilma uue telemeetriata: (1) ATTRIBUTION_GAP määra (lepingubooleanid); (2) „retrieval ei jooksnud / 0 vastet" osakaalu (`chat_no_external_sources`, `ragMatchCount=0`); (3) režiimi-/riski-/retrieveri-jaotused; (4) displayed=0-aga-selected>0 juhtumid; (5) package-aware kasutuse. **EI saa:** COVERAGE vs RETRIEVAL eristust (vajab korpuse-kontrolli iga juhtumi kohta), tegelikku vastuse-tulemust (answer_outcome puudub), LIFECYCLE määra (versioonimõiste puudub), latentsust (retrieval'i kestust trace ei kanna; olemas on ainult embeddingu `latency_ms` kulupeeglis ja `openai_stream_timing`). Protsente siin EI esitata — need tuleb arvutada, mitte arvata.

**Puuduv minimaalne instrumentatsioon (leping, 5 välja — kõik additiivsed, olemasolevatesse sündmustesse):**
1. `trace_id` (juhuslik id) nii `rag_trace` sündmusesse kui `ConversationMessage.metadata`-sse — seob event-logi ja sõnumi ilma teksti kopeerimata;
2. `answer_outcome` (`answered | refused_no_evidence | degraded_partial | crisis_redirect`) — responseFinalizer'i tasandil tuletatav;
3. `retrieval_duration_ms` + `total_duration_ms` trace'i;
4. `displayed_source_freshness` miinimum (kuvatud allikate vanim `last_checked` + kas ületab poliitikat) — LIFECYCLE-proxy;
5. `plan_input_hash` (päringu normaliseeritud räsi, MITTE tekst) — korduvate päringute klasterdamiseks privaatsust rikkumata.

## 4. Golden-evali tegelik väärtus

### 4.1 Audit (37 kaasust, verifitseeritud failist)

- **Perekonnad:** kov 4, legal 3, ajakiri 6, ingested_pdf 13, organization 2, life_situation 2, comparison 2, edge 4, graph 1.
- **Rollid/keeled:** 0 kaasust määrab rolli → KÕIK jooksevad `SOCIAL_WORKER`-ina; kõik ET; `uiLocale:"et"`. CLIENT-vaade, RU/EN ja rahvakeelsed sõnastused on katmata.
- **Mida testitakse:** elav `/api/chat` (päris retrieval + päris mudel, `persist:false`, `forceSources:true`) — MITTE käsitsi vaheobjektid. Kontrollid: `mode` (12 kaasust), `evidence_package`/`package_aware` lipud, `displayed_min` (32), kuvatud allika TIITLI substring (17 must + 4 must-not), vastuse substringid (15+15any+3not), `crisis` (1), `displayed_url_required` (1), 1 history-kaasus (järelküsimus).
- **Mida EI kontrollita:** allika järjestust/pingerida; doc_id-täpsusega valikut; tsitaadi vastavust väitele; värskust/`source_checked_at`; audience-eraldatust; versiooni; latentsust; `insufficient` tulemuse struktuurset lippu (edge-kaasus kontrollib reply-sõnastust).
- **Determinism:** mode/lipud/displayed-kontrollid on retrieval-deterministlikud (sama korpus → sama tulemus); `answer_must_*` sõltub mudelist (mittedeterministlik) — ~45% kontrollidest. Kõik sõltuvad elavast serverist+küpsisest+korpuse seisust; ükski ei jookse CI-s.
- **Diakriitika-immuunsus** on sisse ehitatud (normalizeText mõlemal poolel) — hea.

### 4.2 Katvusmaatriks

| Mõõde \ kaetus | Kaetud | Osaline | Katmata |
|---|---|---|---|
| Režiimid | explicit_paragraph, overview, resource_discovery, life_situation, comparison, municipality_list, national_benefit | legal_exact (kaudselt) | specific_document_lookup, method_guidance |
| Sisukorpus | KOV (4 valda-mainet), RT §-d, ajakiri, riiklikud PDF-id, org (2) | graph (1, lipu taga) | praktikad, teenuseprofiilid, kasutajadokid, kontaktisnapshotid, master-listi uued teemad (võlanõustamine, omastehooldus, sõltuvus, eetika) |
| Roll/keel | SOCIAL_WORKER + ET | — | CLIENT; RU; EN; rahvakeel (0 kaasust!) |
| Kvaliteedimõõde | õige allikas kuvatud (tiitli tasand), KOV-lekke kaitse, kriis, keeldumine (tekstiproxy) | evidence-paketi kasutus | järjestus, tsitaat↔väide, värskus, audience-negatiivtest, versioon |

### 4.3 Minimaalne laiendus ENNE otsinguarendusi (mõõdupuu peab eelnema muutusele)

1. **+10 rahvakeele-paari** (ptk 7 kataloogist, SOCIAL_WORKER ja CLIENT pooleks) — QUERY_UNDERSTANDING baasjoon;
2. **+4 CLIENT-rolli kaasust** olemasolevatel teemadel (audience-jaotuse positiivtest) + **2 audience-negatiivtesti** (spetsialisti-sisu ei tohi ilmuda CLIENT-vastuses) — praegu 0;
3. **+3 doc_id-täpsusega kontrolli** (`displayed_must_include_source_id` — nõuab evali runneris ühe välja lisamist, `extractResponseFacts` juba loeb id-d) — RETRIEVAL_GAP mõõdetavaks;
4. **+2 RU kaasust** (vene keeles küsimus, ET-korpuse vastus) — teadlik piir, mitte üllatus;
5. iga kaasus saab `expected_bucket_on_fail` välja — kukkumine klassifitseerub ptk 2 lepingusse automaatselt.

Kokku ~+21 kaasust (37→58); ei nõua rakenduskoodi muutmist (ainult eval-fail + runneri 1 lisakontroll).

## 5. Mõõdikute leping

Kaks konteksti: **OFFLINE** (labeled-komplekt: golden + ptk 7 paarid, päring→oodatav doc_id; jookseb elava teenuse vastu nagu golden) ja **RUNTIME** (ChatLog agregaadid persisteeritud liikluselt). Privaatsuspiir kõigil: ainult id-d, loendurid, räsid — mitte kunagi päringu-/vastuseteksti raportisse; runtime-raportid ainult agregaatidena (n≥20 rühma kohta). Läved on ALGSED ettepanekud — kinnitatakse esimese baasjoone pealt, mitte enne (näilise täpsuse keeld).

| Mõõdik | Valem | Andmeallikas | Kontekst | Algne väravalävi |
|---|---|---|---|---|
| Recall@k | oodatav doc_id ∈ retrieved top-k / kõik labeled-päringud | labeled-paarid + trace `retrieved_source_ids` VASTUSE KEHAST evali jooksul (ChatLog'i salvestatud id-loendid on redactObject'iga 12 elemendini kärbitud — neid agregaatideks EI kasutata, vt Lisa A.1); nõuab `retrieval_trace_level=retrieved_candidates` | OFFLINE | R@10 ≥ 0.85 uue muudatuse mitte-halvenemine |
| MRR | Σ(1/rank(oodatav)) / n; rank `selected_context_source_ids` järjekorrast | sama | OFFLINE | trend, mitte värav (järjestust golden ei fikseeri veel) |
| Õige allika leidmine | oodatav doc_id ∈ displayed / labeled | trace `displayed_source_ids` | OFFLINE | ≥ 0.9 kriitilistel perekondadel (legal, kov) |
| Õige versiooni leidmine | kuvatud doc_id == registri current / labeled | trace + P8 seisundifail; **enne RAG-P1 mõõdetav ainult praktikatel+RT-l** | OFFLINE | 1.0 (kui mõõdetav) |
| Keelatud/aegunud allika osakaal | vastused, kus displayed sisaldab poliitikat rikkuvat (`last_checked` üle stale-after / `historical=true` / registry_reference ainsana) / kõik | trace + freshness-poliitika; vajab instr. p4 (ptk 3.4) | RUNTIME | 0 kõrge riski klassis |
| displayed ⊆ selected | `displayed_sources_subset_of_selected=false` osakaal | trace (juba olemas!) | RUNTIME | 0 — leping, iga rikkumine on defekt |
| Tsitaadi vastavus väitele | inimhinnang: kuvatud allikas toetab väidet (skaala jah/osaliselt/ei) | golden-/kataloogivastused (sünteetiline valim); produktsioonivestluste valim AINULT Lisa A.3 eraldi otsuse järel | OFFLINE, käsitsi valim | ≥ 0.9 „jah" valimis; automaatlävi ALLES pärast metoodika valideerimist |
| Korrektne insufficient_evidence | refused ∧ korpuses-pole / kõik refused | `answer_outcome` (PUUDUB — instr. p2) + korpuse-kontroll | OFFLINE | ≥ 0.9 |
| Vale negatiiv (vastus jäi andmata, tõend olemas) | refused ∧ oodatav-doc-korpuses / labeled | sama + labeled | OFFLINE | ≤ 0.05 |
| Katvuse puudumine | COVERAGE_GAP osakaal klassifitseeritud kukkumistest | ptk 2 otsustuspuu (osaliselt käsitsi) | mõlemad | trend → P8 lainete sisend |
| Retrieval'i latents | p50/p95 `retrieval_duration_ms` | PUUDUB — instr. p3; praegu ainult embeddingu `latency_ms` + `openai_stream_timing` | RUNTIME | p95 < 1500 ms (kinnitada baasjoonelt) |
| Allikatüübi/režiimi jaotus | count by `query_plan.mode`, `rag_risk_level`, retrieverid, displayed source_type | ChatLog `rag_search`/`rag_trace` (olemas) | RUNTIME | — (seire, mitte värav) |
| ET/EN/RU + rahvakeele erinevus | sama mõõdikustik keele/registri lõikes; delta ET-ametikeele baasist | labeled-komplekti alamhulgad (ptk 7) | OFFLINE | delta dokumenteeritud; värav pärast baasjoont |

## 6. Otsinguparanduste hinnang

Ämbrite tähised: C=COVERAGE, R=RETRIEVAL, L=LIFECYCLE, Q=QUERY_UNDERSTANDING, G=GENERATION.

| # | Parandus | Parandab | EI aita, kui | Determinism | Privaatsus/turve | Latents/opskulu | Vajalik eval | Rollback | Sõltuvus | Soovitus |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Rahvakeel↔ametikeele terminisild (kureeritud, multi-query laiendusse) | Q, R | sisu puudub (C) või pingerida juba leiab (mõõda enne!) | säilib (deterministlik sõnastik) | ohutu; sõnastik on avalik terminoloogia | ~0; +1–2 päringuvarianti | ptk 7 paarid enne/pärast; golden regressioon | sõnastikufail välja (env-lipp) | puudub | **AFTER_MEASUREMENT** (ehitus võib alata: eval-kataloog ptk 7 on eeltöö) |
| 2 | ET lemmatiseerimine BM25 ees (A: päringupoolne vormisüntees; B: ingest-aegne lemmaväli) | R (leksikaalne kanal) | dense-kanal juba katab; või Q-viga (vale sõna, mitte vale vorm) | säilib (Vabamorf deterministlik) | ohutu; uus sõltuvus teenusesse (estnltk) | A: μs-id päringul; B: ingest aeglustub + backfill | leksikaalse kanali tabamismäär (`bm25_matches` trace'is) enne/pärast; `toimetulekutoetus`-regressi test ([main.py:2690](rag-service/main.py:2690) häkk üldistub) | env-lipp `RAG_LEXICAL_LEMMA_EXPANSION` | A: puudub; B: P1 re-ingest laine | A: **AFTER_MEASUREMENT**; B: **LATER** |
| 3 | Mitmekeelne cross-encoder reranker (top-50→top-10) | R (täpsus) | recall on viga (kandidaadis polegi õiget); C/L ämbrid | väheneb (mudelikaal; sama sisend→sama väljund, aga mudeliuuendus muudab) | chunk-tekst läheb reranker-mudelile — kui väline API, siis andmeleke-küsimus; lokaalne mudel eelistatud | +100–300 ms; GPU/CPU-teenus üleval pidada | Recall@k ja MRR labeled-komplektil; golden täisregressioon | lipp kanali kaupa | eval-harness (P5-klass) KOHUSTUSLIK enne | **AFTER_MEASUREMENT** |
| 4 | Kontekstualiseeritud chunkid ingest'il | R (eriti PDF-id) | R-viga on kanalivalikus, mitte chunki esituses | säilib pärast ingest'i (ingest ise kasutab LLM-i — versioonimata prompt = drift-risk, fikseeri prompt versiooniga) | chunk+dokumendi kontekst läheb LLM-ile (OpenAI juba embeddib sama teksti — sama usalduspiir) | ingest kallineb (1 LLM-pass/chunk); päringul 0 | A/B vari-kollektsioonis; golden | uus versioon supersede'itakse tagasi | **P1 versioonileping** (muidu ülekirjutus hävitab võrdluse) | **LATER** |
| 5 | Graph-lite lõpuni (migratsioon + runtime-kanal) | R (faktiahelad: vorm→kontakt→teenus), G kaudselt | vabatekst-küsimused; korpus, mida graaf ei kata (ainult KOV praegu) | säilib (deterministlik ekstraktor) | ohutu (avalik struktuur) | väike päringul; builder offline | golden `graph`-perekonna laiendus (praegu 1 kaasus lipu taga) | kanal lipu taga (`graphChannelTest` juba olemas) | migratsioon = eraldi kinnitatav samm; P6 värav soovitav | **AFTER_MEASUREMENT** (disain valmis; mõõda enne, kui palju faktiahela-päringuid kukub) |
| 6 | Värskuse/autoriteedi kaal pingereas | L (kuvamise pool), R servadel | sisu ongi ainult vana (C/P8) | säilib (deterministlik kaal) | ohutu | ~0 | „võrdsete vaste" juhtumid labeled-komplektis; kõrvalmõju-kontroll (kas vana-aga-õige kaob?) | kaalu env-lipp | `last_checked` katvus korpuses (backfill OK) | **AFTER_MEASUREMENT**, väike |
| 7 | Embeddingu-mudeli A/B vari-kollektsioonis | R (dense kanal) | Q/C/L; ja kui dense juba dominantne kanal on OK | säilib antud mudeli piires | uus mudel = uus andmetöötleja, kontrolli lepingut | täis-re-embed kulu; kaks kollektsiooni korraga | KOGU offline-komplekt mõlemal; kanalite kaupa võrdlus | vana kollektsioon jääb | eval-harness + P1 (versioonid) + kulu-luba | **LATER** |
| 8 | Query expansion / sünonüümid (üldine, väljaspool terminisilda) | Q, R | täpsed õiguspäringud (legal_exact peab jääma kitsaks — laiendus AINULT mitte-legal režiimides) | säilib, kui kureeritud loend; LLM-expansion EI (mittedeterministlik) | ohutu kureeritud kujul | +variandid = +retrieval-kulu | nagu #1 | lipp | puudub | kureeritud osa = #1 osa; LLM-variant **DO_NOT_BUILD** praegu |
| 9 | Chunkimise muutmine allikatüübi järgi | R (pikad juhendid, seadusetekstid) | lühikesed lehed; C/L | säilib | ohutu | re-ingest vajalik → kulu | chunk-suuruse A/B vari-kollektsioonis; PDF-sektsioonisignaalid juba olemas ([pdf-section-index](scripts/lib/pdf-section-index.mjs)) | versioonivahetusega tagasi | P1 | **LATER** |

**DO_NOT_BUILD (kinnitus koondhinnangust, koodipõhjendusega):** agentne mitmehüppeline retrieval — lõhuks deterministliku planneri (ptk 1 režiimiloend on süsteemi selgroog) ilma mõõdetud vajaduseta; vektorbaasi vahetus — Chroma + skaneeriv leksikaalne kanal töötavad praeguses mahus (5,5k chunki; [main.py:3186](rag-service/main.py:3186) skaneerimislimiit 100k) ja ükski mõõdik ei näita pudelikaela; LLM-judge igal päringul — kulu ilma lepinguta.

## 7. Eesti keele sihtkontroll: rahvakeele eval-kataloog

Eval- ja tooteomaniku ülevaatusmaterjal — MITTE runtime-sõnastik. Iga rida: rahvakeelne päring (nagu kasutaja kirjutab) → ametlik termin, mille alla sisu korpuses elab. Oodatav kontroll: displayed sisaldab ametliku termini allikat VÕI plaan tuvastab õige teema.

**A. Põhipaarid (rahvakeel → ametikeel):**

| # | Rahvakeelne päring | Ametlik termin / teenus |
|---|---|---|
| 1 | „kas saab invatransporti tellida?" | sotsiaaltransporditeenus |
| 2 | „hooldaja raha — kui palju makstakse?" | hooldajatoetus |
| 3 | „ema ei saa enam üksi kodus hakkama" | abivajaduse hindamine; koduteenus |
| 4 | „vanadekodu koht — kuidas saada?" | väljaspool kodu osutatav üldhooldusteenus |
| 5 | „toimetulekuraha taotlemine" | toimetulekutoetus |
| 6 | „tugiisik lapsele kooli" | tugiisikuteenus |
| 7 | „abistaja ratastoolis inimesele" | isikliku abistaja teenus |
| 8 | „võlgadest ei saa välja, kohtutäitur võtab kõik" | võlanõustamisteenus; täitemenetlus ja võlgade aegumine |
| 9 | „üürivõlg, ähvardatakse välja tõsta" | eluruumi tagamise teenus |
| 10 | „pole kuhugi ööbima minna" | varjupaigateenus |
| 11 | „mees lööb, kuhu põgeneda lapsega" | turvakoduteenus; naiste tugikeskus; ohvriabi |
| 12 | „naabri laps on hooletusse jäetud, kellele teatada" | abivajavast lapsest teatamine (lastekaitse) |
| 13 | „ratastooli/rulaatori saamine" | abivahendi vajaduse tuvastamine, abivahendikaart |
| 14 | „psühholoogi jutule tasuta" | psühholoogiline nõustamine; vaimse tervise teenused |
| 15 | „joomine on käest ära läinud" | sõltuvusravi; kahjude vähendamine |
| 16 | „dementne vanem vajab valvamist" | päevahoiuteenus dementsusega inimesele; intervallhooldus |
| 17 | „tahan hooldajana vahepeal puhata" | intervallhooldus / asendushooldus (hoolduskoormuse leevendus) |
| 18 | „lapsehoidja puudega lapsele" | lapsehoiuteenus raske/sügava puudega lapsele |
| 19 | „sotsiaalmaja korter" | sotsiaaleluruum; eluruumi tagamise teenus |
| 20 | „valla otsus ei meeldi, kuidas vaidlustada" | vaie haldusaktile; haldusakti vormistamine |

**B. Käändevormid ja liitsõnad (leksikaalse kanali sihttestid):**

| # | Päringuvorm | Testib |
|---|---|---|
| 21 | „toimetulekutoetust saab kes?" | partitiiv — [main.py:2690](rag-service/main.py:2690) häki üldistus |
| 22 | „sotsiaaltranspordiga arsti juurde" | komitatiiv + liitsõna lühikuju vs `sotsiaaltransporditeenus` |
| 23 | „tugiisikuteenusel käimine" | adessiiv (golden `edge_inflected_tugiisikuteenusel` juba olemas — hoida) |
| 24 | „hooldajatoetuse suurus 2026" | genitiiv + aastafilter |
| 25 | „koduteenuste hinnad" | mitmus vs ainsuse `koduteenus` |
| 26 | „varjupaika pääsemine" | illatiiv + tuletis (`varjupaik` vs `varjupaigateenus`) |
| 27 | „eluasemekulud toimetulekutoetuses" | liitmõiste kahe dokumendi vahel |

**C. Vene keel (CLIENT-kasutajate reaalsus):**

| # | Päring | Oodatav teema |
|---|---|---|
| 28 | „пособие по уходу за родственником" | hooldajatoetus |
| 29 | „социальное такси для инвалида" | sotsiaaltransporditeenus |
| 30 | „не справляюсь с уходом за мамой" | abivajaduse hindamine; koduteenus |
| 31 | „куда обратиться если муж бьёт" | ohvriabi; naiste tugikeskus |
| 32 | „долговой консультант бесплатно" | võlanõustamisteenus |

**D. Inglise keel:**

| # | Päring | Oodatav teema |
|---|---|---|
| 33 | "care allowance for family caregiver in Estonia" | hooldajatoetus |
| 34 | "homeless shelter Tallinn" | varjupaigateenus |
| 35 | "disability transport service" | sotsiaaltransporditeenus |

Märkused tooteomanikule: (a) 1–20 vajavad kinnitust, et sihttermin on see, mille alla sisu PÄRISELT ingest'itud on (COVERAGE vs QUERY_UNDERSTANDING eristus!); (b) 28–35 mõõdavad teadlikku piiri — kui RU/EN tugi pole tooteotsus, dokumenteerib eval vähemalt praeguse käitumise; (c) vanad terminid („invaliidsusgrupp" → puude raskusaste; „töövõimetuspension" → töövõimetoetus) väärivad eraldi paari, kui sihtrühmas on vanemaealisi.

## 8. Soovitatud arengujärjekord

1. **Elutsükli töö, mis PEAB eelnema otsingutäiustustele:** P0 (aus kustutus) ja P1 (versioonileping) — ilma nendeta on „õige versiooni leidmise" ja LIFECYCLE-mõõdikud defineerimata ning vari-kollektsiooni katsed (kontekstualiseerimine, chunkimine, embedding) võrdlusaluseta; P8.0 inventuur — ilma selleta ei saa COVERAGE_GAP-i klassifitseerida.
2. **Mõõtmistaristu, mida saab KOHE ehitada (koodi muutmata):** baasjoone-raport olemasolevast ChatLog'ist (ainult Lisa A.1 lubatud väljad) + golden 37 jooks + käsitsi klassifitseerimine AINULT sünteetilisest/lubatud valimist (golden + ptk 7 kataloog + testkontod; Lisa A.3–A.4) → esimene aus, teadlikult ebatäielik ämbrijaotus. See on esimene pakett (RAG-QM-P0, ptk 9.7 + Lisa A). Produktsioonivestluste sisuline lugemine EI kuulu siia — see on eraldi otsus (Lisa A.3).
3. **Väike instrumentatsioonileping (esimene koodimuudatus; paketinimi RAG-QM-P1):** ptk 3.4 viis välja — additiivne, lippude taga, ei muuda käitumist. EI kuulu RAG-QM-P0-sse.
4. **Esimene madala riskiga retrieval'i katse:** terminisild (#1) — eval-kataloog (ptk 7) jookseb ENNE runtime-muudatust baasjooneks; sõnastik env-lipu taga; mõõdik: Q-klassi kukkumiste langus ilma legal-perekonna regressioonita. Paralleelselt lemmatiseerimise variant A (#2) sama mõõdupuuga.
5. **Vari-kollektsiooni nõudvad katsed (LATER):** kontekstualiseeritud chunkid (#4), embeddingu A/B (#7), chunkimisstrateegia (#9) — kõik alles pärast P1 + eval-harnessi.
6. **Mida praegu EI ehita:** reranker enne mõõtmist (#3 AFTER_MEASUREMENT — infra-otsus vajab tõendit, et R-ämber domineerib); agentne retrieval, vektorbaasi vahetus, LLM-judge-per-päring, LLM-põhine query expansion (ptk 6 DO_NOT_BUILD).

## 9. Väljund

1. **Mida praegu tegelikult mõõta saab:** attributsioonilepingu rikkumised, 0-vaste/`no_external_sources` määr, režiimi-/riski-/retrieveri-jaotused, package-kasutus, kriisituvastus — kõik ChatLog'ist SQL-iga; golden 37 elava teenuse vastu. **EI saa:** COVERAGE↔RETRIEVAL eristust automaatselt, vastuse tegelikku tulemust (answer_outcome puudub), versiooni-/värskusrikkumisi runtime'is, retrieval'i latentsust, midagi CLIENT/RU/rahvakeele kohta (eval ei kata). Ükski protsent selles dokumendis pole väidetud — need arvutab RAG-QM-P0.
2. **Puuduv minimaalne instrumentatsioon:** ptk 3.4 viis välja (`trace_id`, `answer_outcome`, `retrieval_duration_ms`+`total_duration_ms`, `displayed_source_freshness`, `plan_input_hash`) + kinnitus, et `RAG_TRACE_V1_ENABLED` on produktsioonis sees.
3. **Golden-evali katvusmaatriks:** ptk 4.2; teravaim auk: 0 CLIENT-, 0 RU/EN-, 0 rahvakeele-kaasust; tsitaat↔väide ja värskus kontrollimata.
4. **Klassifitseerimisleping:** ptk 2 — 8 klassi + `UNKNOWN`, otsustuspuu fikseeritud järjekorraga.
5. **Rahvakeele eval-paarid:** ptk 7 — 35 paari (20 põhiparai + 7 morfoloogia + 5 RU + 3 EN), ülevaatusmaterjal.
6. **Otsinguparanduste järjestatud hinnang:** ptk 6 — kohe: mitte ükski; AFTER_MEASUREMENT: terminisild, lemmatiseerimine-A, reranker, graph-lite, värskuskaal; LATER: kontekstualiseerimine, embedding-A/B, chunkimine, lemmatiseerimine-B; DO_NOT_BUILD: agentne retrieval, DB-vahetus, LLM-judge, LLM-expansion.
7. **Esimene rakendusvalmis mõõtmispakett — RAG-QM-P0 „kvaliteedi baasjoon" (read-only, koodi muutmata):** (a) skript `rag:qm:baseline`, mis arvutab ChatLog'ist AINULT Lisa A.1 lubatud väljade agregaadid (n≥20, loenduritest — mitte kärbitud id-loenditest) raportifaili; (b) golden 37 täisjooks + tulemuse arhiveerimine; (c) ~~50 persisteeritud vestluse käsitsi klassifitseerimine~~ **ASENDATUD Lisa A.3-ga:** käsitsi klassifitseerimine ainult sünteetilisest/lubatud valimist (golden + kataloog + testkontod); produktsioonivestluste lugemine = eraldi tooteomaniku/privaatsusotsus; (d) väljund: esimene ämbrijaotus märkega „produktsiooni-jaotus kinnitamata" + otsus, milline ämber domineerib. Valmis-kriteerium: raport olemas, iga järgnev otsinguinvesteering viitab sellele.
8. **Jätkamiskäsk järgmisele koodi kirjutavale aknale:** ⚠️ **SEE VERSIOON ON ASENDATUD — kehtiv jätkamiskäsk on Lisa A.7** (privaatsuskindel kaheastmeline variant). Siinset varasemat sõnastust ei tohi kasutada, sest see ei kandnud Lisa A valimipiiranguid.
9. **Sõltumatu auditi fookus:** (a) kas `redactObject` tõesti hoiab päringuteksti event-logist väljas (privaatsuslubadus, millel kogu runtime-mõõtmine seisab); (b) kas `rag_trace` event ilma convId-ta on aktsepteeritud piirang või tuleb `trace_id` kiirendada; (c) klassifitseerimislepingu rakendajate-vaheline kooskõla (kaks inimest, sama 20 juhtumit — Cohen'i kappa enne, kui jaotust usaldatakse); (d) golden-laienduse kaasuste leke (kas uued kaasused testivad korpust, mis on olemas — muidu mõõdavad COVERAGE'it, mitte Q/R-i); (e) terminisilla sõnastiku kallutatus (kas paarid peegeldavad päris kasutajakeelt) — võrdlus päris päringutega on lubatud AINULT Lisa A.3 eraldi otsuse järel; enne seda valideeritakse paarid tooteomaniku/nõustajate teadmise vastu.

---

*Read-only analüüs: rakenduskoodi, skeemi, migratsioone, andmebaasi ega RAG-i sisu ei muudetud; ingest'i, patch'i, delete'i ega deploy'd ei tehtud. Fable 5, 2026-07-15, main 890124bd.*

---

# Lisa A — RAG-QM-P0 privaatsuskindel valim ja teostusleping

## A.1 Lubatud andmeallikad

Redigeerimisreeglid on verifitseeritud: iga `logEvent` payload läbib `redactObject`-i ([logger.js](lib/chat/logger.js) → [safeError.js:1](lib/privacy/safeError.js:1)) — tundlikud VÕTMENIMED (`content`, `text`, `messageContent`, `body`, `payload`, `token`, `cookie`, `password` jt) redigeeritakse; stringid lõigatakse 220 tm; **massiivid lõigatakse 12 elemendini**; objektid 30 võtmeni, sügavus 4.

| Andmeallikas / väli | Koondmõõtmiseks | Märkus |
|---|---|---|
| `ChatLog.event`, `createdAt`, `role` | JAH | sisuta dimensioonid |
| `ChatLog.userId` (veerg ja data sees) | AINULT kardinaalsuseks (unikaalsete kasutajate arv), räsituna; raportisse EI jõua | identiteet; EI ole redactObject'i poolt redigeeritud |
| `rag_trace` loendurid ja lepingubooleanid (`*_count`, `displayed_sources_subset_of_selected` jt) | JAH — eelistatud alus | usaldusväärsed; **id-LOENDID on ChatLog'is 12 elemendini kärbitud → agregaadid arvutada loenduritest, MITTE loendite pikkusest** |
| `rag_trace.query_plan.mode`, `retrieval_trace_level`, `rag_risk_level`, `retrievers_used`, `hybrid_retrieval` | JAH | struktuursed |
| `rag_trace.query_plan.topics`, `planner_reason` | EI raportisse | võivad kanda kasutaja päringust tuletatud fraase (ptk 3.3) |
| `rag_search` (vastearvud, grounding, aastad, riskitase, režiim) | JAH | sisuta |
| `rag_search.municipalityMatches` | ainult agregaadis n≥20 | kvaasi-identifikaator (väike vald + ajatempel) |
| `chat_no_external_sources.messageLength` | JAH | pikkus, mitte sisu |
| `crisis_detected` / `isCrisis` | AINULT agregaadina, mitte kunagi rea-tasandil koos userId-ga | eriliigiline signaal (terviseseisundile viitav) |
| `source_id`-d, mis algavad `agent::` | EI (või asenda konstandiga `agent_doc`) | kasutaja privaatdokumendi identifikaator |
| `ConversationMessage.metadata.rag_trace` | JAH, aga AINULT metadata-veerg — sõnumi `content`-veergu EI loeta | rida seob trace'i kasutajatekstiga; päring peab selekteerima ainult metadata |
| `ConversationMessage` sisu (kasutaja päring, vastus) | **EI** (vt A.3 — eraldi otsus) | toortekst |

Ilma vestluse sisu lugemata arvutatavad agregaadid: režiimi-/riski-/retrieveri-/rolli-jaotused; 0-vaste ja `no_external_sources` määr; attributsioonilepingu rikkumiste arv; displayed=0-aga-selected>0 määr; package-kasutus; kriisimäär (koond); `messageLength` jaotus; ajatrendid päeva täpsusega.

## A.2 Keelatud tegevused

RAG-QM-P0 EI TOHI vaikimisi:

1. eksportida 50 (ega ühtegi) toorest produktsioonivestlust — ei faili, raportisse, klassifitseerimis-töövihikusse ega ajutisse kausta;
2. kirjutada vestluse sisu (kasutaja päringut, vastuse teksti, dokumendi-chunki) raportisse, logisse ega git'i;
3. salvestada väljundisse kasutaja ID-d, e-posti, nime, sõnumit või täisteksti — ka mitte „ainult debugiks";
4. kasutada admini ligipääsu uueks sisuliseks jälgimiseks — baasjoon mõõdab süsteemi, mitte kasutajaid; ühegi üksikkasutaja käitumisprofiili ei koostata (rühmad n≥20);
5. saata vestlusi ega nende fragmente välisele mudelile/teenusele klassifitseerimiseks — LLM-abistatud klassifitseerimine on keelatud, kuni eraldi otsus (A.3) ja andmetöötluspiir on kinnitatud;
6. muuta andmebaasi või telemeetriat — skript on read-only (`SELECT` klass); instrumentatsiooni 5 välja (ptk 3.4) EI kuulu P0-sse.

## A.3 Kaheastmeline baasjoon

**Aste 1 — automaatne agregaat (P0 tuum, alati lubatud):** kõik A.1 „JAH"-väljad üle ChatLog'i redigeeritud sündmuste, ilma ühegi sõnumitekstita. Väljund: ptk 9.7(a) raport. See aste annab: attributsioonirikkumised, 0-vaste määra, jaotused, kriisimäära — st ämbrid ATTRIBUTION täielikult ja „retrieval ei jooksnud" signaali; ülejäänud ämbrite kohta ainult ülempiirid.

**Aste 2 — käsitsi klassifitseeritav valim (esimeses ringis AINULT lubatud päritolu):**
- golden-evali 37 kaasuse jooksutulemused (`persist:false`, küsimused on repo-failis, mitte kasutajate omad) — iga kukkumine klassifitseeritakse ptk 2 puuga;
- ptk 7 kataloogi 35 paari jooksutulemused (sünteetilised päringud);
- testkontode/piloodi vestlused, mille kohta on EKSPLITSIITNE luba (nt arendajate endi testpäringud, LoginTempToken-testkasutajad);
- SourceFeedback-teadete juurde kuuluvad juhtumid AINULT siis, kui teate esitaja voog seda luba katab — vaikimisi väljas.

Kokku annab see ~72+ klassifitseeritavat juhtumit ILMA ühegi päris kasutajavestluse lugemiseta. **Päris produktsioonivestluste sisuline lugemine (ptk 9.7(c) algne „50 vestlust") EI OLE P0 vaikeosa** — see on eraldi tooteomaniku- ja privaatsusotsus (õiguslik alus, kasutajate teavitus, ligipääsu audit), mis vormistatakse eraldi enne, kui keegi ühtegi vestlust avab. Kuni otsuseta kannab baasjoon märget „ämbrijaotus põhineb sünteetilisel valimil; produktsioonijaotus kinnitamata".

## A.4 Valimi moodustamine (kuni 50 juhtumit, kihistatud)

Kihid ja sihtosakaalud (lubatud allikatest, A.3 aste 2):

| Kiht | Sihtjaotus | Allikas esimeses ringis |
|---|---|---|
| Roll | SOCIAL_WORKER ~60% / CLIENT ~40% | golden (kõik SW!) + ptk 7 paarid CLIENT-ina → **CLIENT-kiht tuleb ptk 7 jooksudest** |
| Keel | ET ~80% / RU ~15% / EN ~5% | ptk 7 C/D-plokid; golden on 100% ET |
| Planner'i režiim | iga ptk 1 režiim ≥2 juhtumit | golden mode-ootustega kaasused + sihitud lisapäringud |
| Teema | KOV, legal, ajakiri, PDF-juhendid, org + master-listi uued teemad (võlanõustamine, omastehooldus) | golden perekonnad + ptk 7 |
| Allikatega / allikateta vastus | ~80/20 | `displayed_count` jooksutulemusest |
| `insufficient_evidence` | ≥4 juhtumit (sh `edge_no_corpus_answer_v2` klass) | golden edge + sihitud „korpuses-pole" päringud |
| Riskitase | kõrge ≥8 / madal ≥8 | `rag_risk_level` trace'ist |
| Retrieval õnnestus / kukkus | mõlemat ≥10 | golden PASS/FAIL + ptk 7 tulemused |

Kihi täitmata jäämine (nt RU-juhtumeid ei teki, sest korpus/marsruutimine ei toeta) märgitakse raportis **katvusauguna** — auk ON tulemus. Puuduvat kihti EI täideta toore produktsioonisisu juhusliku lugemisega (A.2/A.3 piir).

## A.5 Minimaalne väljundskeem (klassifitseerimisrida)

Üks rida = üks juhtum; AINULT järgmised väljad, mitte rohkem:

```json
{
  "sample_id": "<juhuslik, ühekordne; EI tuletata userId-st ega convId-st>",
  "query_kind": "<golden:<id> | catalog:<nr> | pilot:<kood> — päringu LIIK/viide, MITTE tekst>",
  "role": "SOCIAL_WORKER | CLIENT",
  "language": "et | ru | en",
  "planner_mode": "<query_plan.mode>",
  "selected_count": 0,
  "displayed_count": 0,
  "answer_outcome": "answered | refused_no_evidence | degraded_partial | crisis_redirect  (P0-s tuletatakse käsitsi, kuni ptk 3.4 väli puudub)",
  "bucket": "<ptk 2 klass või UNKNOWN>",
  "confidence": "high | medium | low",
  "evidence_ref": "trace_present | trace_missing | corpus_checked | corpus_not_checked",
  "note": "<vaba kommentaar ILMA kasutajasisuta; golden/kataloogi päringut VÕIB tsiteerida (repo-fail), kasutaja oma MITTE>"
}
```

Reegel: kui klassifitseerija tunneb vajadust kirjutada note'i midagi, mida ta luges kasutaja sõnumist — rida jääb `UNKNOWN` + `confidence: low` ja juhtum eskaleeritakse A.3 eraldi-otsuse ootele.

## A.6 Säilitamine ja koristus

| Artefakt | Käitlus |
|---|---|
| Agregaatraport (jaotused, määrad, n≥20) + katvusaukude loend | VÕIB commit'ida (`logs/` või `reports/`) — sisaldab ainult arve ja dimensioone |
| Klassifitseerimisread (A.5 skeem) | VÕIB commit'ida AINULT siis, kui kõik read on golden/kataloogi/piloodi päritolu; muidu lokaalne |
| Golden/kataloogi jooksutulemuste toorjson (sisaldab mudeli VASTUSEID sünteetilistele päringutele) | ainult lokaalselt (`logs/`, gitignore) — vastused võivad tsiteerida korpust üle lühitsitaadi piiri |
| ChatLog'i vahepäringute väljavõtted (kui skript neid üldse materialiseerib) | EI kirjutata kettale — agregeeritakse mälus; kui ajutine fail on vältimatu, kustutatakse sama jooksu lõpus (skripti `finally`-haru) |
| Kasutaja toortekst, userId↔sample_id vastendustabel | EI kirjutata kettale ÜLDSE — P0-s sellist tabelit ei teki (sample_id-d luuakse ainult lubatud allikatele) |
| Ajutised väljavõtted | kustutatakse jooksu lõpus; raportis rida `temp_files_created: 0` (või loend + kinnitus kustutamisest) |

Tõendamine, et raportisse ei jõudnud tundlikku sisu: (a) raporti-generaator läbib **väljundvalidaatori** — regex-kontroll @-märgi (e-post), 11-kohalise numbri (isikukood), `agent::`-prefiksi ja üle-30-tähemärgiliste vabateksti-väärtuste suhtes väljaspool lubatud võtmeid; leid → jooks kukub, raportit ei kirjutata; (b) raporti päises loetletakse KASUTATUD väljad (A.1 „JAH"-loend) — audit võrdleb loendit failiga; (c) sõltumatu pilk (ptk 9.9 auditifookus (a)) enne esimest commit'i.

## A.7 Täpne RAG-QM-P0 jätkamiskäsk (asendab ptk 9.8 versiooni)

> Loe `docs/platvormi arendus/fable-5-rag-kvaliteedi-mootmine-ja-otsingu-arendus.md` (ptk 2, 3.4, 9.7 ja Lisa A — Lisa A on ülimuslik) ja teosta AINULT RAG-QM-P0 kahes astmes:
> 1. **Aste 1:** uus read-only skript `scripts/rag-quality-baseline.mjs` (`rag:qm:baseline`) — ChatLog agregaadid AINULT Lisa A.1 „JAH"-väljadest (event'id `rag_trace`, `rag_search`, `chat_no_external_sources`, `crisis_detected`); loendurid, mitte id-loendite pikkused (12-elemendi kärbe!); rühmad n≥20; userId ainult räsitud kardinaalsuseks; väljundvalidaator A.6(a) järgi; raport `logs/rag-quality-baseline-<kuupäev>.md/json` + katvusaukude loend.
> 2. **Aste 2:** klassifitseerimis-töövihiku mall (A.5 skeem) + selle täitmine AINULT lubatud valimist (golden 37 + ptk 7 kataloogi 35 + piloodi-testkontod; A.3) — ühtegi toorest produktsioonivestlust EI loeta; `ConversationMessage`-ist tohib päringuga puudutada ainult `metadata`-veergu ja sedagi ainult aste-1 agregaatideks.
> Piirangud: EI mingit instrumentatsiooni (ptk 3.4 väljad on eraldi järgmine pakett), EI rakenduskoodi/skeemi/eval-faili muutmist, EI LLM-klassifitseerimist, EI andmete saatmist välistesse teenustesse. Kui mõni kiht (A.4) jääb lubatud allikatest täitmata, raporteeri katvusauguna — ära „täienda" valimit produktsioonisisuga. Baasjoon on TEADLIKULT ebatäielik: raporti esilehel peab olema lause „ämbrijaotus põhineb sünteetilisel valimil; produktsiooni-jaotus vajab eraldi tooteomaniku- ja privaatsusotsust (Lisa A.3)".

*Lisa A lõpp. STATUS: COMPLETE kehtib kogu dokumendile.*

## Lõplik üleandmine RAG-QM-P0 teostajale

- **Lubatud andmed:** ChatLog sündmuste sisuta väljad Lisa A.1 „JAH"-loendist (loendurid, lepingubooleanid, mode/risk/retrieverid, `messageLength`); `ConversationMessage`-ist AINULT `metadata`-veerg agregaatideks; golden/kataloogi/testkontode jooksutulemused.
- **Keelatud andmed:** kasutaja päringu/vastuse toortekst; userId/e-post/nimi väljundis; `agent::`-identifikaatorid ja mistahes stabiilne kasutajapõhine võti raportis; `query_plan.topics`/`planner_reason` raportis; ChatLog'i id-loendid agregaatide alusena (12 elemendini kärbitud); produktsioonivestluste sisuline lugemine ilma Lisa A.3 eraldi otsuseta; LLM-/välisteenus-klassifitseerimine.
- **Esimene teostatav samm:** Lisa A.7 aste 1 — read-only skript `scripts/rag-quality-baseline.mjs` (`rag:qm:baseline`), agregaadid n≥20, raport + katvusaugud.
- **Väljundi privaatsusvalidaator:** enne raporti kirjutamist regex-kontroll (e-post, 11-kohaline number, `agent::`, pikk vabatekst väljaspool lubatud võtmeid) — leid kukutab jooksu (Lisa A.6).
- **Aus piir:** raporti esilehel kohustuslik lause „ämbrijaotus põhineb sünteetilisel valimil; produktsiooni-jaotus kinnitamata (Lisa A.3)".
