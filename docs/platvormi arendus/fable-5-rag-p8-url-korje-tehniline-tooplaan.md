# RAG-P8: master-listi URL-korje tehniline verifitseerimine ja tööplaan

STATUS: COMPLETE

> Koostatud: 2026-07-15 · aktiivse `main`-i vastu (HEAD 890124bd)
> Piirang: see dokument EI muuda rakenduskoodi, skeemi, migratsioone, andmebaasi ega kanoonilist master-listi. Ühtegi kandidaati ei ingest'ita.

## Sisukord

1. [Alus ja lähtefaktid](#1-alus-ja-lähtefaktid)
2. [Aktiivse tehnilise seisu verifitseerimine](#2-aktiivse-tehnilise-seisu-verifitseerimine)
3. [Peatüki 14 eelduste kontroll](#3-peatüki-14-eelduste-kontroll)
4. [URL-korje tehniline leping](#4-url-korje-tehniline-leping)
5. [Turva- ja kvaliteedipiirid](#5-turva--ja-kvaliteedipiirid)
6. [Coworki 38 kandidaadi kasutamine — proovipakk](#6-coworki-38-kandidaadi-kasutamine--proovipakk)
7. [Migratsiooni- ja mudeliotsus](#7-migratsiooni--ja-mudeliotsus)
8. [Testi- ja eval-programm](#8-testi--ja-eval-programm)
9. [Rakenduspaketid](#9-rakenduspaketid)
10. [Lõppväljund](#10-lõppväljund)

---

## 1. Alus ja lähtefaktid

### 1.1 Loetud alus (täielikult)

1. `docs/platvormi arendus/fable-5-rag-materjalide-elutsukkel-ja-automaatne-allikavarskus.md` (649 rida; ptk 14 = RAG-P8 lähtekoht)
2. `Andmebaasi/Admebaasi-materjali-lisa/source_master_package_README_FINAL.md`
3. `Andmebaasi/Admebaasi-materjali-lisa/master_sources_agent_rules_final.md`
4. `Andmebaasi/Admebaasi-materjali-lisa/master_sources_final.json` (323 kirjet; struktuur + täisstatistika kontrollitud programmaatiliselt)
5. `Andmebaasi/Admebaasi-materjali-lisa/master_sources_final_validation_report.json`
6. `Andmebaasi/Admebaasi-materjali-lisa/sotsiaalai_rag_masterlist_andmekorje_selgitus.md`
7. `Andmebaasi/Admebaasi-materjali-lisa/organisatsiooni_rag_andmekorje_ulesanne.md`
8. `Andmebaasi/Admebaasi-materjali-lisa/master_sources_lisakorje_report.md` (Cowork, 15.07, 38 kandidaati)
9. `Andmebaasi/Admebaasi-materjali-lisa/master_sources_lisakorje_candidates.json` (38 kirjet; top-10 täiskirjed ekstraheeritud)

### 1.2 Lähtefaktid (fikseeritud, ei vaidlustata)

- master-listi PDF on RAG-is dokumendina **olemas** — selle re-ingest ei lahenda midagi;
- register ise on `user_facing_knowledge:false` + `registry_role:"dedupe_seed_and_ingest_planning"` **kõigil 323 kirjel** (kontrollitud) — register ei ole vastuse sisuallikas;
- master-listi veebilehtede üldist automaatkorjet **ei ole**; olemasolev toru (`knowledge:source-master:*`) töötleb AINULT PDF-kandidaate ja deklareerib seda ise ([ingest-source-master-pdfs.mjs:52](scripts/ingest-source-master-pdfs.mjs:52));
- Cowork leidis 38 uut kandidaati; sisuline lõpp-deduplikatsioon on tegemata;
- selle ülesande käigus **ei ingest'ita ühtegi kandidaati** ega muudeta kanoonilist master-listi.

### 1.3 Registri tegelik seis (verifitseeritud 15.07 programmaatiliselt)

`master_sources_final.json` = **JSON-massiiv** (mitte objekt), 323 kirjet, iga kirje 35–37 välja:

| Mõõde | Väärtused |
|---|---|
| `ingest_status` | ingest_candidate 172 · referenced_only 137 · needs_review 14 |
| `source_type` | information_material 88 · organization_profile 58 · research_report 51 · web_page 50 · official_guideline 41 · registry 16 · journal_article 11 · policy_analysis 6 · social_media_page 2 |
| `source_format` | pdf 180 · html 143 |
| `ingest_priority` | medium 173 · low 116 · high 34 |
| `recommended_pipeline` | knowledge_doc_pipeline 186 · organization_collection_agent 60 · html_or_topic_pipeline 50 · registry_reference 16 · journal_layer 11 |
| `link_check_status` | täidetud 121/323 (OK 89 · Search-confirmed 24 · Redirect 5 · OK,Corrected 1 · Search-confirmed,Corrected 1 · Review 1); tühi 202 |

Elutsükliväljad (`last_checked`, `next_check_at`, `web_content_sha256`, `rag_doc_id`, `rag_ingested_at`) registris **puuduvad** — väljade olemasolu kontrollitud kõigi 323 kirje peale.

### 1.4 Uus leid: valideerimisraport on registri suhtes AEGUNUD

`master_sources_final_validation_report.json` (genereeritud 2026-04-29) väidab: research_report 36, information_material 102, official_guideline 40, policy_analysis 7, methodology_material 1, ingest_status ainult {referenced_only 137, ingest_candidate 186}. Tegelik fail (kontrollitud täna): research_report **51**, information_material **88**, official_guideline **41**, policy_analysis **6**, methodology_material **0**, ingest_status {172, 137, **needs_review 14**}. Registrit on pärast raporti genereerimist muudetud, raportit mitte.

**Järeldus, mis kannab kogu tööplaani:** registri kõrvale käsitsi/ühekordselt genereeritud tuletisvaated lähevad vaikselt valeks. RAG-P8 seisundiandmed (kattuvus, kontrolliajad, rag_doc_id sidumised) peavad olema (a) masinloetavas failis, (b) genereeritud korratava skriptiga, (c) kanoonilise registri räsi külge ankurdatud — mitte kunagi „raport, mis tehti üks kord valmis".

### 1.5 Elutsükli dokumendi ptk 14 kokkuvõte (mida verifitseerime)

Ptk 14 ettepanek: master-list saab kanooniliseks lingiregistriks (14.1: versiooniväljad + elutsükliväljad + tüübimäpp + `master:<source_id>` identiteet); enne korjet URL-võrdlus RAG-iga (14.2); puuduvad → korjekandidaadid (14.3); korje `recommended_pipeline` kaupa, sh puuduv `html_or_topic` toru (14.4); dedupe kolmel tasandil (14.5); sama olekumasin seireks (14.6); automaatika piir (14.7); päritolumeta (14.8); kattuvuse 4-kontrolli protokoll (14.9); pakett RAG-P8 sõltuvustega P1+P2 (14.10). Peatükis 3 kontrollin iga eelduse koodi vastu ja parandan, kus vaja.

## 2. Aktiivse tehnilise seisu verifitseerimine

Kontrollitud aktiivse `main`-i (HEAD 890124bd) vastu, failiviidetega. Ainult see, millest RAG-P8 sõltub või mida ta võib regressida; RAG-P0…P7 täisauditit ei korratud.

### 2.1 Prisma mudelid (allikas/materjal/versioon/RAG/ingest/audit)

| Mudel | Koht | RAG-P8 seisukohalt oluline |
|---|---|---|
| `RagDocument` | [schema.prisma:1053](prisma/schema.prisma:1053) | Peaaegu surnud peegel (kasutus: analytics + freshness `--db`). `remoteId @unique`, `type RagSourceType`, `metadata Json`. **Versiooniväljad puuduvad. EI sobi P8 seisundi tõeallikaks** — ta pole sünkroonis tegeliku (rag-service'i JSON) registriga. |
| `SourcePackageSnapshot` | [schema.prisma:1112](prisma/schema.prisma:1112) | Ainus päris versioonihoidla repos: `@@unique([packageId, version])`, `@@unique([packageId, packageHash])`, reviewStatus + reviewEvents. **Muster, mitte kandja** P8 jaoks. |
| `DataDeletionJob` | [schema.prisma:1458](prisma/schema.prisma:1458) | Üldine retry-kandja: `action` (RAG_DELETE/RAG_INGEST), `resourceType`, `resourceId`, `externalRef`, `nextAttemptAt`, `maxAttempts`, `lastErrorCode`, indeks `[action, status, nextAttemptAt]`. **Taaskasutatav P8 ingest/delete järjekorraks ilma migratsioonita** (resourceType on vaba string). |
| `ResearchJob` | [schema.prisma:1486](prisma/schema.prisma:1486) | Lease-põhine worker-muster (`workerId`, `leaseUntil`) — pretsedent, kui P8 vajaks pikka jooksvat töödejärjekorda (ei vaja esimeses faasis). |
| `DataAuditLog` | [schema.prisma:1416](prisma/schema.prisma:1416) | Üldine auditikirje (actor/action/resourceType/meta) — P8 auditisündmused mahuvad siia. |
| `SourceFeedback` | [schema.prisma:1434](prisma/schema.prisma:1434) | dedupeKey + staatus; kasutajapoolne veakanal on olemas, P8 ei pea uut looma. |
| `MaterialSubmission` | [schema.prisma:3157](prisma/schema.prisma:3157) | Kinnitus: `ragDocId`/õiguste väljad PUUDUVAD (RAG-P4 teema, mitte P8). |
| `RagEntity`/`RagRelation`/`RagChunkEntity` | [schema.prisma:3232](prisma/schema.prisma:3232) | Graph-lite faas 1 (offline builderid). P8 ei puuduta; ainult teadmiseks, et `externalKey @unique` muster on olemas. |
| Master-listi DB-mudel | — | **PUUDUB.** Register on failipõhine; DB-s pole ühtegi allikaregistri tabelit. |

### 2.2 `sourceMetadata` tüübi- ja usaldusleping (v2.5)

- Kanooniline tüübinimistu `RAG_SOURCE_TYPES` (31 väärtust, [sourceMetadata.js:3](lib/rag/sourceMetadata.js:3)) **ei sisalda** master-listi väärtusi `registry`, `web_page`, `topic_hub`, `organization_profile`, `social_media_page`.
- Range validaator lükkab tundmatu tüübi VEANA tagasi ([sourceMetadata.js:802](lib/rag/sourceMetadata.js:802)).
- Samas *klassifitseerimis*-komplektid tunnevad `organization_profile` ja `social_media_page` ära ([ORGANIZATION_SOURCE_TYPES, sourceMetadata.js:125](lib/rag/sourceMetadata.js:125)) ja riskipoliitika taustaklass sisaldab `organization_profile` ([riskPolicy.js BACKGROUND_SOURCE_TYPES](lib/rag/riskPolicy.js)). St `organization_profile` on korpuses de facto kasutusel (org-toru meta), aga de jure lepingust väljas — olemasolev ebakõla, mida P8 ei tohi süvendada.
- `normalizeSourceType` aliasmäpid on olemas (article→journal_article, municipal_regulation→kov_regulation, research→research_report, analysis→policy_analysis; [sourceMetadata.js:370](lib/rag/sourceMetadata.js:370)) — master-tüüpidele aliast EI ole.
- Kohustuslikud väljad: `source_id`, `document_id`, `title`, `source_type`, `authority`, `language`, `audience`, `last_checked`, `historical`, `source_status` ([sourceMetadata.js:63](lib/rag/sourceMetadata.js:63)); soovituslikud sh `content_hash`, `url_canonical`.
- Värskuspoliitika ([sourceFreshness.js:36](lib/rag/sourceFreshness.js:36)) katab 26 tüüpi; master-listi tüüpidel (`web_page`, `registry`, `organization_profile`, `topic_hub`) poliitikat **ei ole** → nad kukuksid vaikekäitumisse, mitte teadlikku klassi.

### 2.3 Olemasolevad ingest-torud (mida P8 taaskasutab või peab vältima)

| Toru | Endpoint | P8 jaoks oluline omadus |
|---|---|---|
| Master-listi PDF-id (`knowledge:source-master:plan/ingest`) | Node laeb PDF-i ise alla → `/ingest/pdf-with-metadata` | Filtreerib AINULT `source_format=pdf` + `recommended_pipeline=knowledge_doc_pipeline` + `ingest_status=ingest_candidate` ([source-master-knowledge-docs.mjs:232](scripts/lib/source-master-knowledge-docs.mjs:232)). `docId = source_id` (ILMA versioonisufiksita). `--skip-existing` on VALIKULINE lipp ([ingest-source-master-pdfs.mjs:311](scripts/ingest-source-master-pdfs.mjs:311)). Järjestikune tsükkel, retry'ta, registrisse tagasikirjutuseta. Allalaadimine: paljas `fetch`, redirect'e ei valideerita, mahupiiri ei ole; ainus sisukontroll on `%PDF-` magic-bytes ([ingest-source-master-pdfs.mjs:177](scripts/ingest-source-master-pdfs.mjs:177)). |
| Meta-mäpper master-kirjest | [source-master-knowledge-docs.mjs:241](scripts/lib/source-master-knowledge-docs.mjs:241) | **Juba olemas ja rikas:** `source_master` päritoluplokk (registry_role, dedupe_key, duplicate_group_id, ingest_priority, link_check_status), `user_facing_knowledge:true` (sisudokil, õigesti ümber pööratud), `copyright_status:"restricted_citation_summary_only"`, `display_full_text:false`, `allow_excerpts:"short_only"`. **AGA:** `content_hash` = sha256 registri identiteediväljadest (source_id/title/url/tüübid), MITTE sisust ([source-master-knowledge-docs.mjs:257](scripts/lib/source-master-knowledge-docs.mjs:257)) — sisuduplikaadi kontrolliks kasutuskõlbmatu. |
| KOV veeb | Node ekstraktib → `/ingest/text` ([ingest-kov-rag.mjs:448](scripts/ingest-kov-rag.mjs:448)) | Muster „ekstrakti Node'is, saada täismeta tekstina" — see on ka html_or_topic adapteri õige kuju. |
| Organisatsioonid | `<slug>.rag.md` → `/ingest/text`; paketi PDF-id → `/ingest/pdf-with-metadata` ([ingest-organization-rag-folder.mjs:291,566](scripts/ingest-organization-rag-folder.mjs:291)) | 4-tuumfaili leping; korje = paketi loomine, mitte toorlehe ingest. |
| Ajakiri | `rag:ingest:ajakiri` + artikli-endpointid | Marsruut `journal_layer` (11 kirjet) — olemas. |
| Materjalid (MaterialSubmission) | — | RAG-sild puudub (RAG-P4); P8 ei sõltu. |
| Praktikad | `RAG_INGEST`/`RAG_DELETE` järjekord + drain + fail-closed värav ([effectivePractices.js](lib/effectivePractices.js), [practiceDeployGate.js](lib/practiceDeployGate.js)) | Kanooniline elutsükli eeskuju (backoff 1min·2ⁿ, max 8; crash-guard). |
| `/ingest/url` (rag-service) | [main.py:3778](rag-service/main.py:3778) | **EI SOBI P8-le praegusel kujul:** kirjutab `source_type:"url"` kõvakodeeritult ([main.py:3820](rag-service/main.py:3820)) — pole lepinguline tüüp; ekstraktib KOGU lehe teksti (nav+jalus kaasa, [main.py:983](rag-service/main.py:983)); ei kirjuta `content_hash`/`last_checked`/`historical`. Turvaline fetch on tal aga õige (vt 2.5). |

### 2.4 URL-i normaliseerimine ja deduplikatsioon

- **Päris URL-kanoniseerijat repos EI OLE.** Mõlemad `normalizeUrl` funktsioonid on trim-abilised: [kov/service.js:26](lib/admin/rag/kov/service.js:26), [organizations/service.js:159](lib/admin/rag/organizations/service.js:159).
- Registri `normalized_url` + `dedupe_key` on eelarvutatud registrifailis (välise tööriistaga); nende reeglid on pöördprojekteeritavad väärtustest: skeem+host lowercase, `www.` maha, **kogu URL lowercase (sh path'i percent-kodeering, nt `%C3%9C`→`%c3%9c`)**, juurtee lõpu-`/` säilib.
- Sisufingerprint HTML-ile on olemas: `normalizePageText` (stripTags + kuupäevamustrite eemaldus + `toLocaleLowerCase("et")`, [kovSourceMonitor/service.js:72](lib/admin/rag/kovSourceMonitor/service.js:72)) ja `buildPageSnapshot` ({finalUrl, title, contentHash sha256, contentLength, sample 420 tm}, [kovSourceMonitor/service.js:137](lib/admin/rag/kovSourceMonitor/service.js:137)).
- Sisu-hash'i võrdlust ÜLE dokumentide (sama sisu eri doc_id all) ei tee ükski kood; `content_hash` on metas olemas (backfill 5547/5547), aga master-PDF-idel on see identiteedi-, mitte sisuhash (2.3).

### 2.5 Turvaline fetch (olemas teenuses, puudub Node-skriptides)

- rag-service: `_assert_safe_fetch_url` ([main.py:909](rag-service/main.py:909)) — ainult http/https; `_host_resolves_to_non_public_ip` ([main.py:879](rag-service/main.py:879)) blokeerib localhost'i, privaat-/link-local-/mitteglobaalsed IP-d **DNS-lahenduse tasandil**; iga redirect-hüpe valideeritakse uuesti (`allow_redirects=False` + max 5 tsüklit, [main.py:924](rag-service/main.py:924)); mahupiir `URL_FETCH_MAX_BYTES` voogedastusega ([main.py:938](rag-service/main.py:938)); timeout 30 s; env-lüliti `RAG_ALLOW_PRIVATE_URL_FETCH`.
- Node-poolsed allalaadijad (master-PDF `downloadPdf`, KOV-monitori `fetchWithTimeout`) seda kaitset EI oma — paljas `fetch`, vaikimisi redirect-järgimine, mahupiirita.

### 2.6 Scheduler, job'id, advisory-lock, retry, dead-letter

- RAG-iga seotud taimerit/cron'i repos **ei ole** (kõik kontrollid käsitsi; RAG-P2 lisab).
- Advisory-lock muster olemas: `pg_advisory_xact_lock(hashtext(<key>))` ([effectivePractices.js:957](lib/effectivePractices.js:957)); kasutusel 9 failis.
- Retry + dead-letter: `DataDeletionJob` (`nextAttemptAt` backoff, `maxAttempts`, `lastErrorCode`) + drain-skriptid (`practices:rag:drain`, `--verify-only`).
- Failipõhine CAS: check→kandidaat→apply fingerprint-kaitse + bak-failid kolmel registril (kontaktid, KOV-veeb, KOV-RT) — muster, mida P8 seisundifail järgib.

### 2.7 RAG-dokumendi loomine, supersessioon, kustutus, jäägikoristus

- Loomine: `_replace_document_vectors` = delete-where-doc_id + insert ([main.py:2336](rag-service/main.py:2336)) — sama doc_id ülekirjutus, versioonihoidlata.
- Kustutus: `DELETE /documents/{id}` **neelab Chroma vea vaikides ja tagastab ok:true** ([main.py:4418–4421](rag-service/main.py:4418)) — RAG-P0 leid kehtib muutmata kujul; kviteering on `{ok, deleted, hadEntry}` ilma chunk-arvuta.
- Supersessioon: kolm mehhanismi (vaikne ülekirjutus; praktikate RAG_DELETE `superseded_ingest_cleanup`; RT `is_current_version=false`). Teenus tunneb `is_current_version` välja: chunk-meta lubatud võtmete loendis ([main.py:2396](rag-service/main.py:2396)), `/ingest/text` võtab vastu ([main.py:3573](rag-service/main.py:3573)) ja `_derive_historical`/`_derive_source_status` tuletavad sellest `historical`/`archived` ([main.py:1403–1427](rag-service/main.py:1403)).
- Jäägikoristus: ainult praktikate järjekord + KOV cleanup/reset skriptid; üldist orbdokumentide koristust ei ole.

### 2.8 Aktiivse versiooni valik retrieval'is

- `/search` EI rakenda ühtegi vaikefiltrit ([main.py:4439](rag-service/main.py:4439)); `historical` läbib ainult siis, kui kutsuja saadab ([main.py:4466](rag-service/main.py:4466)).
- Runtime-kutsuja ehitab audience-filtri ALATI ([retrievalContextAssembler.js:1174](lib/chat/retrievalContextAssembler.js:1174)), aga `historical`-välja kasutab ainult tulemuste MÄRGISTAMISEKS (`historical: source.historical === true ? true : undefined`, [retrievalContextAssembler.js:354](lib/chat/retrievalContextAssembler.js:354)) — üldretrieval'is `historical/is_current_version` VÄLISTAVAT where-filtrit ei ole.
- **Järeldus P8-le:** vana versiooni ei tohi jätta „lipuga maha surutuks" — see jääks leitavaks. Supersessioon peab vana versiooni füüsiliselt kustutusjärjekorda panema, kuni RAG-P1 current-filter jõustub.

### 2.9 Tsitaatide ja usalduse serialiseerimine

- `serializeDisplayedSourceTrust` ([sourceTrust.js:82](lib/chat/sourceTrust.js:82)) lisab kuvatavale allikale `source_trust_type`, `source_checked_at`, `source_freshness`, `source_warning`.
- `evidence_role` on runtime'is PÄRISELT loetav väli: evidence-pakett kannab seda iga allika kohta ([evidencePackage.js:177](lib/chat/evidencePackage.js:177)) ja sektsiooni-attributsioon tarbib ([sectionAttribution.js](lib/chat/sectionAttribution.js)) — **registriviite allasurumisreeglil on olemasolev kinnituspunkt** (ei vaja uut andmevälja, vaja on reeglit).
- Displayed ⊆ selected leping on koodis ([sourceAttribution.js:929–958](lib/chat/sourceAttribution.js:929)).

### 2.10 Admini/retsensendi tööjärjekorrad

- Admin-API perekonnad olemas: `app/api/admin/rag/{contact-registry, kov, kov-source-monitor, national-rt, organizations, rt-registry, source-packages, document-status, [...path], selftest}`. Kolm check→apply registrit + staatuseteenused loevad raportifaile.
- Master-listi järjekorda/vaadet EI ole üheski admin-vaates; MaterialSubmission (`/materjalid`) on eraldi toru.

### 2.11 Testid, deploy-väravad, operatiivskriptid

- `npm test` = node:test, ilma elava DB-ta (fake-prisma); päris DB → `db:migrate:check`; kõik RAG-i elusad kontrollid (smoke'id, golden eval 37) on käsitsi + sessiooniküpsise taga.
- `deploy-server.mjs` käivitab AINULT `prisma migrate deploy` + build/restart ([deploy-server.mjs:130](scripts/deploy-server.mjs:130)) — ühtegi RAG-väravat deploy's ei jookse; `practices:deploy-gate` on eraldi käsk.
- Read-only inventuuritööriistad olemas: `rag:list:docs`, `rag:audit:freshness`, `rag:inventory:kov`, `knowledge:validate`, `organization:audit-metadata`.

## 3. Peatüki 14 eelduste kontroll

Iga küsimus: otsus + kooditõend + parandus tööplaanis, kui ptk 14 eeldus aktiivse koodiga täielikult ei klapi.

### K1. Kas `master_sources_final.json` sobib kanooniliseks lingiregistriks või peab runtime-tõeallikas olema DB-mudel?

**Otsus: fail sobib ja jääb kanooniliseks; DB-mudelit EI vaja; ptk 14.1.2 vajab ÜHTE parandust.**

- Failipõhine register on repo tõestatud muster (KOV `sources.json`, kontaktiregister, RT-manifest — kõik fingerprint+bak kaitsega). DB-alternatiiv `RagDocument` on tõendatult mittesünkroonis peegel (2.1) — sinna ehitamine tähendaks kahte tõde.
- **Parandus (14.1.2 vastu):** elutsükliväljad (`last_checked`, `next_check_at`, `check_status`, `web_content_sha256`/`pdf_sha256`, `rag_doc_id`, `rag_ingested_at`, `rag_match`, `superseded_by`) EI lähe kanoonilisse faili, vaid **eraldi masinhallatud seisundifaili** `master_sources.state.json` (võti `source_id`, päises kanoonilise registri sha256-fingerprint + `state_schema_version` + `updated_at`). Põhjendus:
  1. kanooniline fail on käsitsi kureeritud, 22 693 rida — iga masinkirjutus teeks hiiglasliku diffi ja git-müra;
  2. fail on väliste korjeagentide (Cowork) dedupe-seeme — masinkirjutuse churn lõhuks nende eeldused;
  3. valideerimisraporti drift (1.4) näitab, mis juhtub, kui tuletisandmed elavad registri „sees/kõrval" ilma ankruta — seisundifail on ankurdatud registri räsiga: kui register muutub, on seisund tuvastatavalt aegunud (sama fingerprint-kaitse nagu `apply-check`);
  4. käesolev ülesanne ise keelab master-listi muutmise — see on õige püsireegel, mitte ühekordne piirang: registrimuudatus = kureeritud otsus, seisundimuudatus = masina oma. Kaks eri omanikku ⇒ kaks eri faili.
- Registri enda versioonivälju (`registry_version`, bak-rotatsioon) on vaja alles siis, kui registrit hakatakse apply-vooga muutma (lisakorje merge) — see on eraldi kureerimisotsus, mitte P8 eeldus.

### K2. Mis jääb failipõhiseks, mis peab olema DB-s?

| Andmestik | Kandja | Põhjendus |
|---|---|---|
| Allika identiteet, klassifikatsioon, marsruut (323 kirjet) | `master_sources_final.json` (kanooniline, käsitsi kureeritud) | olemasolev; K1 |
| Korje/seire seisund kirje kohta | UUS `master_sources.state.json` (masinhallatud, fingerprint-ankruga) | K1; sama klass nagu `*.sources.kontroll.json` |
| Korjekandidaadid (fetch-snapshot'id inimotsuseks) | UUS `master_sources.korje.json` + raport | täpselt KOV check→kandidaat→apply muster |
| Ingest/delete retry | OLEMASOLEV `DataDeletionJob` (action RAG_INGEST/RAG_DELETE, `resourceType="master_source"`, `externalRef=doc_id`) | kandja on üldine (2.1); migratsiooni ei vaja |
| Auditikirjed | OLEMASOLEV `DataAuditLog` | üldine kandja olemas |
| RAG-dokumendi sisu+meta | rag-service register+Chroma (nagu praegu) | tegelik tõeallikas |
| Admin-järjekorravaade | failide pealt lugev staatuse-teenus (nagu `getKovWebSourcesStatus`) | RAG-P7 teema; DB-stumine alles siis, kui vaja mitme kasutaja transaktsioonilist review-voogu — praegu ei ole |

### K3. Kuidas mäppida `registry`, `web_page`, `social_media_page` (ja teised registri tüübid) meta-lepingu vastu?

Kontrollitud: ükski neist pole `RAG_SOURCE_TYPES`-is (2.2). Mäpitabel:

| Registri `source_type` | Arv | Saatus P8-s | RAG-i `source_type` (kui ingest'itakse) | `evidence_role` |
|---|---|---|---|---|
| `information_material` | 88 | html/pdf adapter | `information_material` (olemas) | background / practical_guidance |
| `official_guideline` | 41 | knowledge-doc toru | `official_guideline` (olemas) | practice_guidance |
| `research_report` | 51 | knowledge-doc toru | `research_report` (olemas) | research_evidence |
| `policy_analysis` | 6 | knowledge-doc toru | `policy_analysis` (olemas) | policy_context |
| `journal_article` | 11 | ajakirjatoru | `journal_article` (olemas) | background |
| `web_page` | 50 | html-adapter kirje kaupa | **mäpitakse sisuklassi järgi** (vaikimisi `information_material`; kirje `evidence_role`/`collection_hint` võib tõsta `state_guide`/`official_guideline`) — `web_page` on vorming, mitte tõendiklass | kirje järgi |
| `organization_profile` | 58 | organisatsiooni korjeagendi JÄRJEKORDA (4 tuumfaili), MITTE html-adapterisse | org-toru oma leping | organization_background |
| `registry` | 16 | **EI korjata sisuna.** Jäävad `referenced_only`; kui mõni on juba RAG-is, saab patch-meta `evidence_role=registry_reference` | — | registry_reference |
| `social_media_page` | 2 | korjest väljas (`manual_check_required`) | — | — |

Topic-hub'id (lisakorje kandidaatides; master-listis `web_page` all): hub-avaleht = `referenced_only`; korjatakse sisulised alamlehed html-knowledge-doc'idena (selgituse dok §5.4 kinnitab sama).

### K4. Kas tüüpe laiendada või olemasolevateks teisendada?

**Otsus: teisendada (adapteri tasandil), mitte laiendada.** P8 ei lisa `RAG_SOURCE_TYPES`-i ühtegi uut väärtust, sest kogu ingest'itav sisu mäpitakse olemasolevatesse tüüpidesse (K3) — nii ei teki uut `unknown`-klassi meta, mille backfill just koristati.

Kaks piiritletud erandit (mõlemad OLEMASOLEVA korpuse legaliseerimine, mitte uus tüüp):

1. `sourceFreshness.js` poliitikatabelisse tuleb lisada rida `organization_profile`-le (nt maxAge 365 p, medium) — tüüp on korpuses juba täna (org-toru), aga poliitikata (2.2). Väike additiivne muudatus.
2. `evidence_role="registry_reference"` — evidence_role EI ole validaatoris suletud nimistu (runtime normaliseerib vabalt, [sourceMetadata.js:399](lib/rag/sourceMetadata.js:399)), seega uue rolli väärtus ei nõua lepingu laiendust; küll tuleb see lisada `source-master-knowledge-docs.mjs` `chooseEvidenceRole` lubatud loendisse, kui seda hakatakse sealt läbi juhtima.

`RAG_SOURCE_TYPES`-i `organization_profile` lisamine (de facto/de jure ebakõla, 2.2) on omaette pisiparandus — kuulub org-toru omanikule, mitte P8 kriitilisele teele; märgitud järelkontrolli (ptk 10.6).

### K5. Kas `html_or_topic_pipeline` on üks toru või tüübiadapteritega orkestreerija?

**Otsus: orkestreerija + üksainus UUS adapter.** Kontrollitud kood näitab, et „üks üldine kraabits" oleks vale ja tarbetu:

- PDF-id (186) — toru OLEMAS (`knowledge:source-master:*`);
- organisatsioonid (60) — toru OLEMAS (4-faili pakett); korje = paketi mustandi loomine, inimene kinnitab;
- ajakiri (11) — toru OLEMAS;
- registry (16) + social (2) — EI korjata;
- **AINUS puuduv kood** on html-knowledge-doc adapter (50 web_page + topic-hub alamlehed): Node ekstraktib põhisisu → `/ingest/text` TÄISMETAGA (KOV-toru muster, [ingest-kov-rag.mjs:448](scripts/ingest-kov-rag.mjs:448)).

**Parandus/karmistus:** `/ingest/url` on html-adapteri jaoks KEELATUD praegusel kujul — kirjutab lepinguvälise `source_type:"url"` ([main.py:3820](rag-service/main.py:3820)), ei kirjuta `content_hash`/`last_checked` ja ekstraktib nav+jaluse kaasa ([main.py:983](rag-service/main.py:983)). Adapter kasutab `/ingest/text` + kanoonilist meta-ehitajat. (Rag-teenust ennast EI muudeta — kooskõlas 14.10 piiranguga.)

### K6. Kuidas võrrelda 323 registri URL-i olemasoleva RAG-sisuga nii, et 167 kattuvat ei loeta valmis allikateks?

Kolmeastmeline read-only võrdlus (14.2 kinnitatud, ÜKS parandus):

1. **Parandus (14.2.1 vastu):** „sama normaliseerija tuleb rakendada RAG-i kirjetele" eeldab, et normaliseerija on olemas — **repos seda EI OLE** (2.4; mõlemad `normalizeUrl` on trim). Registri `normalized_url` arvutas väline tööriist. P8 esimene ehitustükk on jagatud kanoniseerija `scripts/lib/url-canonical.mjs`, mille reeglid pöördprojekteeritakse registri väärtustest (host+skeem lowercase, `www.` maha, kogu URL-i lowercase sh percent-kodeering, juurtee `/` säilib, fragment maha, tracking-query maha). **Aktsepteerimistest on mõõdetav:** funktsioon peab taastootma kõigi 323 kirje salvestatud `normalized_url` väärtuse; iga lahknevus on kas koodiviga või registri anomaalia — mõlemad raporteeritakse.
2. Võrdlus: (a) täpne normaliseeritud URL — ainus, mis loeb „kattuvuseks"; (b) sama host+path-prefiks — vihje; (c) `dedupe_key`/pealkirja sarnasus — vihje. RAG-i pool loetakse `GET /documents` registrist (`rag:list:docs` klass; väljad `url`/`source_url`/`url_canonical` on registrikirjetes olemas).
3. Tulemus kirjutatakse SEISUNDIFAILI (`rag_match = {doc_id, matched_by, collection_id, source_type, last_ingested} | null`), mitte kanoonilisse registrisse (K1).

Kattuvus ≠ valmis: iga vaste käib läbi 14.9 nelja kontrolli (päritolu / täielikkus / värskus / meta-leping) — vt K7. 167 on ülempiir; esimene aus number tuleb P8.0 raportist.

### K7. Kuidas eristada vaste seisundid?

Seisundid elavad seisundifaili väljal `match_status` (olekumasin 5.3/14.6 laiendus); tuvastusreeglid:

| Seisund | Tuvastus (mehaaniline) | Edasine tee |
|---|---|---|
| `covered_ok` (täielik ja värske vaste) | täpne URL-vaste + chunks>0 + meta-leping korras + `last_checked` klassi piires + teksti pikkus ≥50% värske fetch'i omast | märgi `rag_doc_id`, seire tavagraafikus |
| `covered_by_other_pipeline` | vaste doc_id kuulub KOV/org/ajakirja mustrisse (`collection_id`/doc_id prefiks) | master EI korja; ainult viide (14.5.1) |
| `needs_adoption` | vaste on juhuslik üksik-ingest ilma lepingulise metata (puudub `canonical_source_id`/`source_master` plokk) | patch-meta „adopteerimine", mitte re-ingest |
| `incomplete` (osaline sisu) | chunk-arv 0 VÕI teksti pikkus <50% värske fetch'i omast VÕI registri kirje viitab alamlehele, vaste ainult avalehele (path-täpsusega võrdlus) | korjekandidaat |
| `stale_match` (aegunud versioon) | `last_checked` puudub või ületab tüübi stale-after'i ([sourceFreshness.js:36](lib/rag/sourceFreshness.js:36)); VÕI värske fetch'i sisuhash ≠ salvestatud hash | re-check → muutuse kandidaat |
| `redirected` | fetch'i finalUrl ≠ registri URL (301 püsiv) | URL-i uuenduskandidaat inimesele; domeenivahetus = kõrge risk |
| `duplicate_content` (sisuduplikaat teisel URL-il) | värske sisu-sha256 == mõne TEISE doc_id sisu-sha (NB: master-PDF-ide praegune `content_hash` on identiteedihash, 2.3 — võrdlus vajab värskelt arvutatud sisuhash'e, mis kogutakse seisundifaili) | duplikaadijärjekord, EI ingest'ita |
| `missing` (puuduolev allikas) | ühtegi vastet üheski astmes | korjekandidaat prioriteedi järjekorras |

### K8. Kuidas vältida paralleelseid dubleerivaid korjeid (scheduler / mitu worker'it)?

Kolm kihti, kõik olemasolevatel mustritel:

1. **Üks sisenemispunkt:** korje/seire jookseb ühe systemd-timeri alt (RAG-P2 otsus; sagedused ptk 7 riskitabelist), concurrency=1. Skript võtab käivituse alguses **advisory-locki** `pg_advisory_xact_lock(hashtext('rag:source-master-collector'))` (muster [effectivePractices.js:957](lib/effectivePractices.js:957)) — ka käsitsi käivitus samal ajal timeriga ei dubleeri.
2. **Seisundifaili fingerprint-CAS:** iga kirjutus valideerib enne, et faili päises olev registri-fingerprint + seisundifaili enda `updated_at`/räsi vastavad loetule (sama kaitse nagu `apply-check` kandidaadifailidel); lahknevus → katkesta, ära kirjuta. Failikirjutus pole protsessiülene atomaarne — sellepärast ongi kiht 1 kohustuslik; kiht 2 püüab inimvea (kaks käsitsi terminali).
3. **Idempotentsusvõti allika tasandil:** doc_id on deterministlik (`master:<source_id>:v<N>`); enne ingest'i kohustuslik registry-GET (praegune `--skip-existing` käitumine muutub adapteris vaikimisi-sisselülitatuks) + sisu-sha võrdlus → sama sisu teistkordne ingest = no-op, mõõdetav „0 uut embeddingut".

### K9. Kuidas peab supersessioon kustutama/eemaldama otsingust vana RAG-sisu?

**Verifitseeritud piirang, mis muudab 14.6 rakendust:** üldretrieval EI filtreeri `historical`/`is_current_version` järgi (2.8) — lipp üksi EI eemalda vana sisu otsingust. Teenus küll tuletab `is_current_version=false` → `historical=true`/`archived` ([main.py:1403](rag-service/main.py:1403)), aga filter on kutsuja kohustus, mida üldrada ei täida.

P8 aktiveerimistehing (ptk 4.1 lepingu adaptsioon, kuni RAG-P1 current-filter jõustub):

1. ingest `master:<source_id>:v<N+1>` (uus doc_id, MITTE ülekirjutus);
2. kontrolli `GET /documents/{id}/chunks` > 0;
3. seisundifail: `current_doc_id=v<N+1>`, `superseded=v<N>`;
4. **pane v<N> `RAG_DELETE` järjekorda** (`DataDeletionJob`, resourceType `master_source`) — füüsiline eemaldus, mitte lipp;
5. kustutuse järelkontroll chunks==0 — sest DELETE-kviteering valetab täna (`except: pass`, [main.py:4418](rag-service/main.py:4418); RAG-P0 parandab kviteeringu, P8 ei tohi seda oodata pimesi).

Kui samm 1–2 kukub, jääb v<N> aktiivseks (fail-closed). Esmakorjel (v1) supersessiooni pole; juba-RAG-is olevad master-PDF-id (paljad `source_id` doc_id-d, 2.3) loetakse `v0`-ks ja supersede'itakse esimesel tegelikul uuendusel — kooskõlas ptk 4.1 v0-reegliga, mass-migratsioonita.

### K10. Kuidas takistada master-listi registrikirje või registri PDF-i kasutamist vastuse ainsa sisulise allikana?

**Kinnituspunkt on olemas ega vaja uut andmevälja (2.9):** `evidence_role` liigub evidence-paketis iga allikaga kaasa ([evidencePackage.js:177](lib/chat/evidencePackage.js:177)) ja `serializeDisplayedSourceTrust` serialiseerib usalduse kuvatavale allikale ([sourceTrust.js:82](lib/chat/sourceTrust.js:82)). Rakendus kahes tükis:

1. **Meta:** patch-meta master-listi PDF-dokumendile (ja tulevikus igale registry-tüüpi dokumendile): `evidence_role=registry_reference` (+ `resource_type=registry_index`). Patch-meta endpoint on olemas ([main.py:4364](rag-service/main.py:4364)); rakenduskoodi ei muudeta, see on operatiivtoiming.
2. **Runtime-reegel (väike, testitav):** attributsiooni/evidence-paketi filtris — kui küsimus nõuab sisulist tõendit ja kuvatavate allikate hulgas on AINULT `evidence_role=registry_reference` allikad, siis (a) registriviide ei tohi olla ainus displayed-source; (b) rada degradeerub `insufficient_evidence` käitumisele (mehhanism on olemas — sama klass nagu „ajakirjaartikkel ei kinnita vormi" riskipoliitika piir). Registriviide JÄÄB lubatuks täiendava „kust otsida edasi" viitena sisulise allika kõrval.

Ühiktest: mock-vasted ainult registry_reference rolliga → displayed=0 + insufficient-rada; registry + sisuline allikas → registriviide lubatud teisena. Golden-eval kaasus: „milliseid materjale on X kohta?" ei tohi tsiteerida registrit ainsa allikana.

### Paranduste koondloend (ptk 14 → tööplaan)

1. **14.1.2 parandatud:** elutsükliväljad → eraldi seisundifail `master_sources.state.json`, MITTE kanoonilisse registrisse (K1; tõend 1.4 drift + git-churn + väliste agentide leping).
2. **14.2.1 parandatud:** URL-kanoniseerijat ei ole olemas — see tuleb ehitada ja aktsepteerida 323 kirje reprodutseerimistestiga (K6; tõend 2.4).
3. **14.4.3 karmistatud:** html-adapter EI kasuta `/ingest/url` (lepinguväline meta); kasutab `/ingest/text` + kanooniline meta (K5; tõend main.py:3820).
4. **14.5.2 parandatud:** olemasolevate master-PDF-ide `content_hash` on identiteedi-, mitte sisuhash — sisuduplikaadi kontroll vajab värskelt arvutatud sisuhash'e seisundifailis (K7; tõend source-master-knowledge-docs.mjs:257).
5. **14.6 täpsustatud:** supersessioon = füüsiline delete-järjekord + järelkontroll, mitte lipp — üldretrieval ei filtreeri historical'i (K9; tõend 2.8).
6. **14.10 sõltuvused täpsustatud:** P8.0–P8.2 (normaliseerija, inventuur, kandidaadid, allasurumisreegel) EI sõltu RAG-P1/P2-st ja on kohe alustatavad; P1 on vajalik alles versioonivahetuse-faasiks (P8.4+), P2 seire-faasiks (P8.5), P0 kustutuse-järelkontrolli usaldusväärsuseks (K9).
7. **14.7 karmistatud (soovitus):** proovipakis inimkinnitus KÕIGILE (ka AUTO_CANDIDATE), sest auto-ingest'i eeltingimused (päris sisuhash, normaliseerija, deploy-värav) pole veel täidetud; automaatika avaneb alles pärast P8.5 mõõdikuid (valepositiivide määr).

## 4. URL-korje tehniline leping

Iga etapp: **Sisend → Väljund · Omanik · Tehingupiir · Idempotentsusvõti · Retry · Fail-closed · Audit · Kohustuslik test.** Omanikud: `collector` (uus orkestreerija-skript), `toimetaja` (inimene), `rag-service`, `queue` (DataDeletionJob + drain). Läbiv põhimõte: etapid 1–12 on automaatsed ja kirjutavad AINULT seisundi-/kandidaadifaile; etapp 13 on inimotsus; alles 14+ puudutab RAG-i.

**E1. URL-i kanoniseerimine.**
Sisend: registri `url`. Väljund: kanooniline URL + võrdlusvõti (`url-canonical.mjs`). Omanik: collector. Tehingupiir: puhas funktsioon, kõrvalmõjuta. Idempotentsus: sama sisend → sama väljund (referentsiaalselt läbipaistev). Retry: ei kohaldu. Fail-closed: parsimatu URL → `check_status=invalid_url`, allikas korjest väljas. Audit: anomaaliad P8.0 raportisse. Test: ühiktest — 323 registri kirje `normalized_url` reprodutseerimine + tabelipõhised juhtumid (www, trailing-slash, percent-kodeering, query, fragment).

**E2. Redirect'i kontroll.**
Sisend: kanooniline URL. Väljund: `finalUrl` + redirect-ahel seisundifailis. Omanik: collector (fetch teenuse turvamustri järgi — iga hüpe eraldi valideeritud, max 5; [main.py:924](rag-service/main.py:924)). Tehingupiir: ainult seisundifail. Idempotentsus: kirjutus on „viimane võidab" sama käivituse piires; käivituste vahel fingerprint-CAS (K8.2). Retry: võrguviga → backoff 2 katset; redirect-silmus → katkesta. Fail-closed: 301 teisele DOMEENILE → `redirected` + kõrge risk, sisu EI laeta enne inimotsust; 302 → logi, korje jätkub algsel URL-il. Audit: vana→uus URL paar raportis. Test: fixture-server 301/302/silmus/ristdomeeni juhtumitega.

**E3. Robots- ja rate-limit-poliitika.**
Sisend: sihtdomeeni robots.txt (vahemälu 24 h) + domeeni viisakusviive. Väljund: luba/keeld + viivitusgraafik. Omanik: collector. Tehingupiir: fetch-järjekord domeeni kaupa (≥1 s viive; UA `SotsiaalAI source-master collector/1.0 (+https://sotsiaal.ai)` — sama konventsioon nagu KOV-monitoril). Idempotentsus: robots-vahemälu võti = domeen+päev. Retry: robots'i fetch'i viga → luba EI eeldata, 1 kordus, siis `manual_check_required`. Fail-closed: Disallow → allikas `manual_check_required`, mitte kunagi vaikimisi korje. Audit: keeldude loend raportis. Test: ühiktest robots-parseri + keeldumisraja kohta.

**E4. HTML-i või faili allalaadimine.**
Sisend: lubatud URL. Väljund: toorsisu (bait) + HTTP-meta seisundifaili snapshot'is. Omanik: collector — **jagatud turvalise fetch'i helperiga** (SSRF-kontroll + mahupiir + timeout; teenuse `_assert_safe_fetch_url` semantika Node'is, vt ptk 5). Tehingupiir: kettale kirjutatakse ainult kandidaadi-snapshot, mitte RAG-i. Idempotentsus: sama URL + sama sisu-sha → snapshot ei muutu. Retry: timeout/5xx → backoff 2 katset ERI ajahetkel; võrguviga EI ole kunagi „muutus" (olemasolev KOV-monitori reegel). Fail-closed: mahupiir/timeout ületatud → `fetch_failed(n)`, sisu ei salvestata. Audit: staatus+kestus+maht raportis. Test: integratsioonitest mahupiiri, timeout'i ja 5xx-backoff'iga.

**E5. Sisu tüübi tuvastamine.**
Sisend: HTTP `Content-Type` + baidid. Väljund: `detected_format` (html/pdf/docx/muu). Omanik: collector. Tehingupiir: seisundifail. Idempotentsus: deterministlik funktsiooni väljund. Retry: ei kohaldu. Fail-closed: deklareeritud ≠ tegelik (nt `text/html` päis, `%PDF-` sisu) → `format_mismatch`, inimjärjekorda; tundmatu formaat → EI ingest'ita. Audit: mismatch-raport. Test: ühiktestid magic-bytes komplektiga (PDF/HTML/ZIP/tühi).

**E6. Põhisisu eraldamine navigatsioonist ja jalusest.**
Sisend: HTML. Väljund: põhisisu tekst (main/article eelistus; nav/footer/küpsisebänner maha). Omanik: collector (laiendab `normalizePageText` klassi; PRAEGUNE teenusepoolne `_extract_text_from_html` võtab kõik, [main.py:983](rag-service/main.py:983) — sellepärast ekstraktitakse Node'is). Tehingupiir: puhas funktsioon. Idempotentsus: sama HTML → sama tekst. Retry: ei kohaldu. Fail-closed: põhisisu < läve (nt 350 tm) → `thin_content`, inimjärjekorda (maandumisleht/koondleht, vt E8). Audit: teksti pikkus snapshot'is. Test: fixture-lehed (nav-raske KOV-stiilis leht; artikkel; küpsisebänner) — ekstrakti stabiilsus.

**E7. JavaScript'iga renderdatava lehe käsitlus.**
Sisend: E6 tulemus. Väljund: otsus `static_ok` / `needs_js_rendering`. Omanik: collector. Reegel: kui staatiline ekstrakt on alla läve JA leht viitab SPA-müstikale (tühi `<main>`, ainult skriptid), märgi `needs_js_rendering` + inimjärjekord. **P8 EI ehita headless-brauserit** — see on teadlik piirang; selliseid lehti käsitletakse käsitsi (või org-agent teeb kokkuvõtte). Idempotentsus/Retry: nagu E6. Fail-closed: JS-leht ei lähe kunagi poolikuna ingest'i. Audit: `needs_js_rendering` loend raportis. Test: fixture tühja main'iga → õige märgistus.

**E8. Failide, maandumislehtede ja koondlehtede eristamine.**
Sisend: registri kirje (`resource_type`, `recommended_pipeline`) + E5/E6 tulemus. Väljund: marsruut — `pdf → knowledge-doc toru`, `sisuleht → html-adapter`, `topic_hub/koondleht → alamlehtede korjeplaan (mitte ingest)`, `maandumisleht → referenced_only või org-pakett`. Omanik: collector (reeglid) + toimetaja (kaheldavad). Tehingupiir: seisundifail. Idempotentsus: marsruut on deterministlik kirje+snapshot'i funktsioonina. Retry: ei kohaldu. Fail-closed: ebaselge marsruut → `needs_review`, mitte vaikimisi ingest. Audit: marsruudiotsus kirje kohta. Test: ühiktestid marsruutimisreeglitele (K3 tabel).

**E9. Sisu normaliseerimine.**
Sisend: põhisisu tekst. Väljund: normaliseeritud tekst fingerprint'iks (lowercase, kuupäevamustrid maha, whitespace kokku — OLEMASOLEV `normalizePageText`, [kovSourceMonitor/service.js:72](lib/admin/rag/kovSourceMonitor/service.js:72)) + ingest'i-tekst (normaliseerimata, loetav). Omanik: collector. NB: fingerprint-tekst ja ingest-tekst on ERI artefaktid — fingerprint on võrdluseks, ingest säilitab algteksti. Idempotentsus: deterministlik. Test: ühiktest — sama leht kahe kuupäevastampiga → sama fingerprint.

**E10. Sisuräsi ja semantilise duplikaadi kontroll.**
Sisend: normaliseeritud teksti sha256 (html) / baiti-sha256 (pdf). Väljund: `duplicate_of` või puhas. Omanik: collector. Kontrollid: (a) sama räsi seisundifailis teise source_id all; (b) sama räsi RAG-i värskete sisuhash'ide seas (kogutakse P8.0 inventuuris — olemasolev meta `content_hash` EI kõlba master-PDF-idel, K7); (c) registri `duplicate_group_id` — grupist ainult esinduskirje. Semantiline lähiduplikaat (sama sisu, eri vorming — nt IASSW HTML vs PDF) = inimotsus kandidaadivaates, MITTE automaatne. Tehingupiir: seisundifail. Idempotentsus: räsi ise. Fail-closed: duplikaat EI lähe ingest'i; läheb duplikaadijärjekorda. Audit: duplikaadipaarid raportis. Test: ühiktest (a)–(c) + „sama PDF kahe URL-i all" fixture.

**E11. Metaandmete ja päritolu salvestamine.**
Sisend: registri kirje + snapshot. Väljund: kanooniline meta (`buildKnowledgeMetadataFromSourceMasterRecord` laiendus html-ile): `canonical_source_id=master:<source_id>`, `source_master` plokk (olemas, [source-master-knowledge-docs.mjs:317](scripts/lib/source-master-knowledge-docs.mjs:317)), `url_canonical`, `content_hash` = **PÄRIS sisuhash** (parandus K7), `last_checked`, `source_type` K3 mäpist, `audience`, `evidence_role`, `is_current_version=true`. Omanik: collector. Tehingupiir: meta valmib kandidaadifailis ENNE ingest'i. Idempotentsus: meta on kirje+snapshot'i deterministlik funktsioon. Fail-closed: `validateRagSourceMetadataContract` viga → kandidaat `invalid_metadata`, ei ingest'ita ([sourceMetadata.js:761](lib/rag/sourceMetadata.js:761)). Audit: meta kandidaadifailis. Test: static-payload testid (olemasolev `ragServiceIngestPayloadStatic` klass) + validaatoritest.

**E12. Riskiklassi määramine.**
Sisend: registri tüüp + sihtsisu klass. Väljund: `risk_class` (elutsükli dok ptk 7 maatriks): `official_guideline`/`policy_analysis`/õigus-, kontakti-, vormi- või toetusesisu → kõrge/keskmine (inimene); `information_material`/`research_report` mitte-KOV → madal. Omanik: collector (reegel) — proovipakis KÕIK inimkinnitusega (parandus 14.7, K-loend p7). Idempotentsus: deterministlik. Fail-closed: määramatu klass → kõrge. Audit: klass kandidaadis. Test: ühiktest klassireeglitele.

**E13. Inimese ülevaatus.**
Sisend: kandidaadifail (snapshot + meta + risk + duplikaadiinfo). Väljund: otsus `approve` / `reject` (müra; baseline uuendatakse versioonita) / `defer`. Omanik: toimetaja. Tehingupiir: apply-skript fingerprint-kaitsega (täpselt `kov:*:apply-check` muster). Idempotentsus: kandidaadi fingerprint — teistkordne apply samale kandidaadile on no-op/viga. Retry: ei kohaldu (inimotsus). Fail-closed: ilma kinnituseta EI liigu midagi edasi; kandidaat aegub, kui registri kirje vahepeal muutus (fingerprint ei klapi). Audit: kes/millal/otsus (apply-raport + bak; lisada „kes" — sama lünk on teistel apply'del). Test: apply-kaitsete ühiktestid (vale fingerprint, topelt-apply).

**E14. Ingest.**
Sisend: kinnitatud kandidaat. Väljund: RAG-dokument `master:<source_id>:v<N>`; seisundifailis `rag_doc_id` + `rag_ingested_at`. Omanik: collector → rag-service (`/ingest/text` html; `/ingest/pdf-with-metadata` pdf). Tehingupiir: üks dokument = üks ingest-kutse; registri-GET enne (kohustuslik skip-existing) + chunks>0 järel. Idempotentsusvõti: doc_id + sisu-sha (sama sha → skip, mõõdik „0 uut embeddingut"). Retry: ebaõnnestumine → `DataDeletionJob` RAG_INGEST rida (backoff-muster nagu praktikatel), MITTE lõputu tsükkel skriptis. Fail-closed: chunks==0 või HTTP-viga → seisund `ingest_failed`, current-viidet EI uuendata. Audit: job-rida + DataAuditLog. Test: integratsioonitest lokaalse rag-service'iga (ingest → chunks>0 → search leiab); katkestuse test (teenus maas → job-rida tekib).

**E15. Versioonivahetus ja supersessioon.**
Sisend: muutunud sisu kinnitatud kandidaat, olemasolev `current_doc_id`. Väljund: uus versioon current, vana kustutusjärjekorras. Omanik: collector + queue. Tehingupiir ja järjekord: K9 viiesammuline aktiveerimistehing (ingest v<N+1> → chunks>0 → seisundifaili current → RAG_DELETE v<N> → chunks==0 järelkontroll). Idempotentsus: versiooninumber seisundifailist; sama versiooni topelt-aktiveerimine on no-op. Retry: delete-järjekorra oma (`nextAttemptAt`). Fail-closed: iga katkestus jätab VANA versiooni aktiivseks; „pool-dokument" pole võimalik, sest current-viide liigub alles pärast chunks>0. Audit: supersede-kirje (vana→uus doc_id, räsid). Test: v1→v2 tsükkel + SIGKILL keskel (NIGHTLY klass; elutsükli dok testikihid 10.2/10.3/10.6).

**E16. Perioodiline värskuskontroll.**
Sisend: seisundifail (`next_check_at` möödas; sagedus riskitabelist: vormid/kontaktid ei kuulu master-torusse; `official_guideline` 1×/kvartal; `information_material`/`research_report` harvem; PDF baiti-sha 1×/kvartal). Väljund: `unchanged` (ainult `last_checked` uueneb) / muutuse kandidaat / `fetch_failed(n)`. Omanik: collector timeri alt (RAG-P2). Tehingupiir: seisundifail + kandidaadifail; RAG-i EI puudutata. Idempotentsus: kontrolli võti = source_id + kuupäev. Retry: E4 reeglid. Fail-closed: kontrolli viga EI muuda allika seisundit peale `fetch_failed` loenduri. Audit: kontrollraport (nagu `kov:web-sources:check` oma). Test: fixture-sait muutumatu/muutunud/kadunud lehega.

**E17. Kadunud või vigase allika käsitlus.**
Sisend: `fetch_failed(n)` ajalugu. Väljund: `gone_candidate` alles pärast 3 järjestikust ebaõnnestumist ≥48 h jooksul eri kellaaegadel (olemasolev 5.3 reegel); inimotsus → `archived` (RAG-dokument saab `source_status=archived` patch-meta + RAG_DELETE VÕI teadlik säilitus `historical=true`) või uus URL (E2 rada). Omanik: collector (loendur) + toimetaja (otsus). Tehingupiir: patch-meta/delete alles inimotsuse järel. Idempotentsus: loendur seisundifailis. Fail-closed: üksik 404 ei muuda MIDAGI; arhiveerimine ilma inimeseta on keelatud. Audit: gone-otsuse kirje (kes/millal/põhjus). Test: 404-seeria ühiktest (1×, 2×, 3× <48h, 3× ≥48h) → õiged üleminekud.

**E18. Audit ja operatiivne taastamine.**
Sisend: kõik ülaltoodud sündmused. Väljund: (a) iga seisundimuutus raportifailis (git-ajalugu = auditijälg, nagu KOV-registritel) + kirjutavad RAG-toimingud `DataAuditLog`-is; (b) taastamine: seisundifaili bak + registri git-ajalugu + versioonide doc_id-d → rollback = eelmise versiooni re-ingest säilitatud snapshot'ist või current-viite tagasitõst enne koristusjärjekorra jooksmist. Omanik: collector + ops. Fail-closed: seisundifaili korruptsioon (räsi ei klapi) → korje seiskub, EI kirjuta üle; taastatakse bak'ist. Test: seisundifaili korruptsiooni test (katkine JSON, vale fingerprint) → skript keeldub; bak-taaste test.

## 5. Turva- ja kvaliteedipiirid

Fikseeritud piirid; iga rida on jõustatav mehhanism, mitte soovitus.

1. **SSRF-kaitse.** Kogu väline fetch (HTML JA PDF, seire JA korje) käib läbi ÜHE jagatud turvahelperi, mille semantika on rag-teenuse oma: skeemid ainult http/https; hosti DNS-lahenduse kontroll mitteglobaalse IP vastu ([main.py:879](rag-service/main.py:879)); env-erand ainult testiks. Praegune lünk: Node-poolsed allalaadijad (`downloadPdf` master-torus, KOV-monitori fetch) on kaitseta (2.5) — P8 sulgeb selle vähemalt master-toru jaoks; KOV-monitori kõvendus on järelkontrolli soovitus, mitte P8 kriitiline tee.
2. **Private/local IP, localhost, metadata-endpoint'id, keelatud skeemid.** Sama helper blokeerib: `localhost`, loopback, privaatvõrgud, link-local (sh 169.254.169.254 metadata), `file:`/`ftp:`/`data:` skeemid (ainult http/https lubatud). DNS-rebinding'i vastu: kontroll toimub lahendatud IP-de peal iga päringu eel (teenuse mustris juba nii).
3. **Redirect-ahela uuesti valideerimine.** Iga hüpe valideeritakse eraldi (`allow_redirects=False` tsükkel, max 5; [main.py:924](rag-service/main.py:924)) — redirect privaatvõrku katkeb keset ahelat. Ristdomeeni 301 = kõrge riski kandidaat, mitte automaatne järgimine (E2).
4. **Allalaadimismahu ja aja piir.** Voogedastusega mahupiir (`URL_FETCH_MAX_BYTES` muster, [main.py:938](rag-service/main.py:938)) + timeout; Node-helperis samad piirid (PDF-idele suurem, nt 50 MB / 300 s nagu praegune `RAG_INGEST_REQUEST_TIMEOUT_MS` vaikeväärtus). Ületus → `fetch_failed`, mitte poolik sisu.
5. **MIME vs tegelik sisu.** Deklareeritud Content-Type + magic-bytes kontroll (olemasolev `%PDF-` kontroll [ingest-source-master-pdfs.mjs:177](scripts/ingest-source-master-pdfs.mjs:177) üldistatakse); mismatch → `format_mismatch`, inimjärjekord (E5). Ei parsita kunagi formaadis, mida baidid ei kinnita.
6. **Pahatahtlik HTML / prompt-injektsioon.** Veebisisu on ANDMED, mitte juhised: (a) ekstrakt eemaldab skriptid/atribuudid (tekst ainult); (b) ingest'i-tekst läheb korpusesse muutmata kujul, aga vastuse koostaja käsitleb chunk'e tsiteeritava allikana — injektsioonikaitse invariant on OLEMASOLEV eval-nõue (elutsükli dok testikiht 10.14: „injection ei muuda vastuse juhiseid") ja laieneb master-fixture'itele; (c) kandidaadivaates näidatakse toimetajale sample'it — kahtlane juhiste-stiilis sisu on tagasilükkamise alus. XSS: pealkirjad/meta escape'itakse UI-s nagu seni; uusi renderdusradu P8 ei lisa.
7. **Kogemata korjatud isikuandmed.** Ametlikud juhendid/portaalid on madala PII-riskiga, aga mitte null: kandidaadi snapshot'ile jookseb kerge PII-heuristika (isikukoodi muster, eraisiku-meili muster) → leid tõstab riskiklassi ja nõuab inimotsust; kinnitatud PII-ga leht kas ei lähe korpusesse või läheb redigeeritud kujul (toimetaja otsus, auditikirjega). Kustutusrada on olemas (`RAG_DELETE` + retry) — PII-intsident = kohene delete-järjekord, mitte ootamine.
8. **Autoriõigus ja täieliku sisu talletamise piir.** Olemasolev master-meta juba fikseerib: `copyright_status="restricted_citation_summary_only"`, `display_full_text=false`, `allow_excerpts="short_only"` ([source-master-knowledge-docs.mjs:312](scripts/lib/source-master-knowledge-docs.mjs:312)) — html-adapter kannab SAMA lepingu. Snapshot'i sample on 420 tm (olemasolev formaat); täisteksti hoitakse ainult ingest'i lähtefailina (nagu teenus teeb `source.html`-iga), mitte kasutajale kuvatavana. Riigi/KOV ametlik info on üldjuhul vabalt kasutatav; era-/MTÜ-materjalil (nt omastehooldus.eu käsiraamatud) otsustab toimetaja allika kaupa.
9. **Allika usaldustaseme säilitamine.** `authority`/`publisher` tulevad registrist ja EI tohi ingest'is lahjeneda; usaldus serialiseerub vastusesse olemasoleva `serializeDisplayedSourceTrust` kaudu (2.9). Master-korje dokument ei või kunagi esineda kõrgema autoriteedina kui registri kirje ütleb (nt MTÜ-portaal ≠ PRIMARY_OFFICIAL).
10. **Kõrge riskiga sisu (õigus, toetused, kriis, kontaktid) — inimese kontroll.** K3/E12: õigus- ja toetusesisu EI ole master-toru omand (RT-toru/KOV-toru); kui master-listi leht sisaldab kontakte/vorme/summasid, siis need EI saa `currentEvidence` õigust — `disallowed_claim_types` (legal_entitlement, benefit_amount, municipal_service_availability, application_deadline, medical_diagnosis_or_treatment) on juba meta-ehitajas ([source-master-knowledge-docs.mjs:301](scripts/lib/source-master-knowledge-docs.mjs:301)) ja riskipoliitika taustaklass ([riskPolicy.js](lib/rag/riskPolicy.js)) hoiab neid vormide/kontaktide kinnitamisest eemal. Kriisikontaktide staatiline nimekiri ei tule kunagi RAG-ist (olemasolev reegel).
11. **Registriviide ei ole vastuse ainus tõend.** K10 reegel: `evidence_role=registry_reference` ei või olla ainus displayed-source; jõustatakse evidence-paketi/attributsiooni filtris + patch-meta master-PDF-ile; ühiktest + golden-kaasus.
12. **Aegunud või kontrollimata allikas ei osale aktiivses retrieval'is.** Kolm kihti: (a) korje eeldusena `last_checked` kohustuslik (validaator, [sourceMetadata.js:790](lib/rag/sourceMetadata.js:790)); (b) supersessioon füüsilise eemaldusega (K9), kuni current-filter (RAG-P1) jõustub; (c) `stale_match`/`gone` seisund väljastab freshness-auditi rea — ja vastuse pool kannab `source_freshness`/`source_warning` möönet (olemas, [sourceTrust.js:82](lib/chat/sourceTrust.js:82)). „Kontrollimata" (NEEDS_VERIFICATION / needs_review) allikas ei sisene kunagi proovipakki ega auto-ingest'i.

## 6. Coworki 38 kandidaadi kasutamine — proovipakk

Piirid: uut veebiotsingut ei tehtud; ühtegi kandidaati ei ingest'ita; kõiki 38 EI kuulutata ingest-valmis. Proovipakk = **raporti punkti 4 tabeli esikümme** (prioriteedi järjekorras; täiskirjed kontrollitud `master_sources_lisakorje_candidates.json`-ist). Kontrollisin: **ükski esikümnest ei kanna `NEEDS_VERIFICATION` märget** — need kolm (`esta_eetikakasiraamat`, `kutsestandard_volanoustaja_tase6`, `kutseregister_…kutseala`) jäävad proovipakist väljas, nagu nõutud.

**Eeltingimus, mis EI ole P8 automaatika osa:** kõik 10 on master-listist PUUDUVAD allikad — enne mistahes korjet peab toimuma kureeritud registri-uuendus (lisakorje→master merge koos lõpp-deduplikatsiooniga; eraldi inimotsus, sest kanooniline fail on käsitsi kureeritud, K1). Proovipakk planeerib voo registri-järgse seisu jaoks; `canonical_source_id` allpool eeldab merge'i tehtud olevat.

### 6.1 Esikümme: marsruut, korje, risk, kinnitus, dedupe, värskus

| # | Allikas | Toru/adapter | Mida korjatakse | Riskiklass | Inimkinnitus | Duplikaadikontroll | Värskuskontroll |
|---|---|---|---|---|---|---|---|
| 1 | ESTA (eswa.ee) | **organisatsiooni korjeagent** (4 tuumfaili), MITTE html-adapter | mustandpakett: profiil + teenused + kontaktid + `documents[]`; avalehte EI ingest'ita toorelt | keskmine (kutseandja; avalehe uudisvoog osalt 2020–2021) | **JAH** (kandidaadis `HUMAN_REVIEW_REQUIRED`) | domeen eswa.ee registris 0 vastet (raport §5); merge'il normalized_url + pealkirjakontroll | org-paketi re-check 2×/aastas; alamlehtede linkide elusus 1×/kvartal |
| 2 | EVNL (evnl.ee) | organisatsiooni korjeagent | mustandpakett; väärtuslikud alamlehed kirjas kandidaadi notes'is (teenuse-korraldus, eetikakoodeks, võlanõustajad) | keskmine | **JAH** | evnl.ee 0 vastet; sisuline paar SKA võlanõustamisjuhendiga = TÄIENDavad, mitte duplikaadid (raport §5) | nagu #1 |
| 3 | narko.ee (TAI) | topic-hub: hub `referenced_only`; sisulised alamlehed html-adapteriga (nt „Mis on kahjude vähendamine" on juba eraldi kandidaat, AUTO_CANDIDATE) | alamlehtede HTML-põhisisu → `/ingest/text` | hub madal; alamlehed madal-keskmine (sõltuvusteema — meditsiiniväited keelatud claim-types'iga) | **JAH** (hub-valik = toimetaja otsus, milliseid alamlehti) | narko.ee 0 vastet registris; alamlehtede sisu-sha vs korpus | alamlehed 1×/kvartal (HTML-fingerprint) |
| 4 | omastehooldusest.ee | topic-hub: hub `referenced_only`; alamlehed html-adapteriga (nt „Spetsialistile: juhendmaterjalid") | alamlehtede HTML-põhisisu | madal-keskmine (TRUSTED_NGO, mitte riiklik) | **JAH** | 0 vastet ('omastehooldus'/'hooldaja'); NB eristada omastehooldus.**eu**-st (eraldi kandidaat #13, vanad 2007–2012 materjalid — EI kuulu proovipakki) | 1×/kvartal |
| 5 | SKA Eluruumi tagamise teenuse juhend (PDF, 04.2024) | **olemasolev** knowledge-doc toru (`knowledge:source-master:*` klass) | PDF-fail (baiti-sha + sektsioonianalüüs); maandumisleht EI ole eraldi sihtmärk | keskmine (official_guideline → 14.7 järgi inimene) | **JAH** (proovipaki reegel: ka AUTO_CANDIDATE kinnitatakse; parandus ptk 3 p7) | failinime/pealkirja kontroll tehtud (raport §5: KOV-teenusejuhendid registris puuduvad); fetch'il baiti-sha vs korpus | PDF baiti-sha 1×/kvartal; SKA koondlehe (`ska_kov_noustamine_hub`, REFERENCE_ONLY) seire annab uute versioonide signaali |
| 6 | SKA Täisealise abi- ja toetusvajaduse hindamise juhend 2025 (PDF) | knowledge-doc toru | PDF | keskmine | **JAH** | nagu #5; NB registri „üldjuhend"-vaste on AKI oma (nimekokkusattumus dokumenteeritud raportis §5) — pealkirjavaste ÜKSI ei ole duplikaat | nagu #5 |
| 7 | SKA Üldjuhend KOV sotsiaalteenuse korraldamiseks (PDF, 01.2023) | knowledge-doc toru | PDF | keskmine-kõrge (KOV-teenuste korraldus — piirneb KOV-toru omandiga, aga on RIIKLIK metoodika, mitte KOV-spetsiifiline info → jääb master-torusse; `municipal_service_availability` on keelatud claim) | **JAH** | nagu #6 | nagu #5 |
| 8 | SKA Varjupaigateenuse juhend (PDF, 07.01.2026) | knowledge-doc toru | PDF | keskmine | **JAH** | nagu #5 | nagu #5; värske dokument (2026) — järgmine versioon tõenäoline, seire oluline |
| 9 | SKA Võlanõustamisteenuse juhend (PDF, 2023) | knowledge-doc toru | PDF | keskmine | **JAH** | nagu #5; sisuline seos EVNL-iga (täiendavad) | nagu #5 |
| 10 | SM Heaolu arengukava 2023–2030 | knowledge-doc toru | **mõlemad, eri rollides:** põhiteksti PDF (`sm.ee/media/2840/download`) = sisu-ingest; maandumisleht `sm.ee/heaolu-arengukava-2023-2030` = `url_canonical` + seirepunkt (`referenced_only`) | madal (poliitikakontekst; ei kinnita üksikisiku õigusi — kandidaadi notes ütleb sama) | **JAH** | 'heaolu arengukava' 0 vastet (registris on TAI/EPIK arengukavad — eri dokumendid) | maandumislehe HTML-fingerprint 2×/aastas (programmiperioodi uuendused); PDF baiti-sha 1×/kvartal |

### 6.2 Oodatav RAG-dokumendi päritolumeta (ühine muster)

Kõigil kümnel (näitena #5):

```json
{
  "docId": "master:ska_eluruumi_tagamise_teenuse_juhend_2024:v1",
  "canonical_source_id": "master:ska_eluruumi_tagamise_teenuse_juhend_2024",
  "source_id": "ska_eluruumi_tagamise_teenuse_juhend_2024",
  "title": "Eluruumi tagamise teenuse juhend (15.04.2024)",
  "source_type": "official_guideline",
  "collection_id": "national_guidelines",
  "evidence_role": "practice_guidance",
  "authority": "Sotsiaalkindlustusamet",
  "audience": "SOCIAL_WORKER",
  "language": "et",
  "url_canonical": "https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-04/…pdf",
  "content_hash": "<PÄRIS sisu-sha256 (pdf: baidid; html: normaliseeritud tekst)>",
  "last_checked": "<korje kuupäev>",
  "historical": false,
  "is_current_version": true,
  "source_status": "active",
  "legal_basis": false,
  "copyright_status": "restricted_citation_summary_only",
  "display_full_text": false,
  "allow_excerpts": "short_only",
  "disallowed_claim_types": ["legal_entitlement", "benefit_amount", "municipal_service_availability", "application_deadline", "medical_diagnosis_or_treatment"],
  "source_master": {
    "source_master_file": "Andmebaasi/Admebaasi-materjali-lisa/master_sources_final.json",
    "dedupe_key": "<registrist merge'i järel>",
    "ingest_priority": "high",
    "recommended_pipeline": "knowledge_doc_pipeline",
    "collected_by": "source-master-collector/P8-pilot"
  }
}
```

Erisused: #1–#2 org-paketi meta-leping (`collection_id=organizations`, `jurisdiction_level=ORGANIZATION`, org-tuumfailide docId `organization-<slug>`, master-seos `sourceKeys`/`masterlist_status` kaudu — organisatsiooni korjeülesande dok §2); #3–#4 alamlehed `source_type=information_material`, `evidence_role=background`, audience kirje järgi (BOTH/SOCIAL_WORKER); #10 `source_type=policy_analysis`, `collection_id=policy_analyses`, `evidence_role=policy_context`.

### 6.3 Mida proovipakk mõõdab (edu kriteeriumid)

1. Iga adapteri (org / topic-hub / pdf / poliitika-PDF+maandumisleht) täisring kandidaat→kinnitus→ingest→retrieval töötab vähemalt ühe allikaga.
2. Dedupe ei anna valepositiive („üldjuhend" nimekonflikt on teadaolev kontrolljuhtum — pealkirjavaste ei tohi blokeerida, URL/sisu-sha otsustab).
3. Registriviite allasurumisreegel: „milliseid materjale on X kohta?" päring EI tsiteeri master-PDF-i ainsa allikana, kui proovipaki sisu on olemas.
4. Freshness-audit läbib kümne uue dokumendiga puhtalt (meta-leping täidetud).
5. `rag_doc_id` on seisundifailis kõigil kümnel; „mitu allikat on päriselt korpuses" raport suureneb täpselt 10 võrra (või dokumenteeritud erinevusega, nt hub-lehed viidetena).

## 7. Migratsiooni- ja mudeliotsus

**Otsus: RAG-P8 EI vaja Prisma migratsiooni ega skeemimuudatust.** Olemasolevad mudelid kannavad nõutud lepingu; puuduv seisund elab failides (K1/K2). Skeemiettepanekut seetõttu ei koostata — allpool on täpne taaskasutuskaart ja piirid, millal see otsus ümber vaadatakse.

### 7.1 Olemasolevad väljad, mida taaskasutatakse (migratsioonita)

| Vajadus | Olemasolev kandja | Väljad |
|---|---|---|
| Ingest/delete retry + dead-letter | `DataDeletionJob` ([schema.prisma:1458](prisma/schema.prisma:1458)) | `action` ("RAG_INGEST"/"RAG_DELETE"), `resourceType` (uus VÄÄRTUS "master_source" — string, mitte enum, migratsiooni ei vaja), `resourceId` (=source_id), `externalRef` (=doc_id), `status`, `attempts`, `nextAttemptAt`, `maxAttempts`, `lastErrorCode` |
| Järjekorra drain-indeks | sama mudel | `@@index([action, status, nextAttemptAt])` ([schema.prisma:1483](prisma/schema.prisma:1483)) + `@@index([resourceType, resourceId])` — piisavad |
| Auditikirjed | `DataAuditLog` ([schema.prisma:1416](prisma/schema.prisma:1416)) | `action` (nt "MASTER_SOURCE_INGEST"), `resourceType`, `resourceId`, `meta` |
| Konkurentsikaitse | Postgres advisory lock | `pg_advisory_xact_lock(hashtext('rag:source-master-collector'))` — muster [effectivePractices.js:957](lib/effectivePractices.js:957) |

### 7.2 Uued nullable/additiivsed väljad: EI OLE VAJA

Ainus kaalutud kandidaat oli `RagDocument`-i seisundiväljad — tagasi lükatud, sest mudel pole tegeliku registriga sünkroonis (2.1); sinna kirjutamine looks kolmanda tõe.

### 7.3 Uued mudelid: EI OLE VAJA (koos ümbervaatamise lävega)

DB-mudel (`MasterSourceState` vms) muutub õigustatuks alles siis, kui täitub mõni neist: (a) mitu toimetajat vajab samaaegset transaktsioonilist review-voogu (failipõhine CAS + üks timer ei kata); (b) admini järjekorravaade vajab SQL-agregeerimist üle tuhandete ridade SLA-mõõdikutega; (c) register ise otsustatakse DB-sse viia (tooteotsus, mitte P8 oma). Kuni selleta: failid + olemasolevad kandjad.

### 7.4 Väljad, mida EI TOHI kahes kohas tõeallikana hoida

| Väli | Ainuomanik | Keelatud koopia |
|---|---|---|
| allika identiteet, tüüp, marsruut, prioriteet | `master_sources_final.json` | seisundifail EI kopeeri (join `source_id` kaudu); job-rida kannab ainult id-sid, mitte URL-e/pealkirju |
| `last_checked`, `next_check_at`, hash-baseline'id, `check_status`, `rag_match` | `master_sources.state.json` | EI kirjutata kanoonilisse registrisse ega DB-sse |
| `rag_doc_id` ↔ allika seos | seisundifail | RAG-meta kannab peegelina `canonical_source_id` (OK — see on viide registrisse, mitte teine omanik); `RagDocument.remoteId` EI hakka seost kandma |
| dokumendi sisu + kanooniline meta | rag-service register + Chroma | seisundifail hoiab ainult doc_id-d ja räsisid |
| `next_check_at` | register/seisundifail (ajakava omanik) | RAG-metasse EI lähe (14.8 reegel — kinnitatud) |

### 7.5 Uniqueness- ja CAS-lepingud (failitasand, sest DB-d ei lisandu)

1. Seisundifaili päis: `{state_schema_version, registry_file, registry_sha256, updated_at}` — iga kirjutus valideerib `registry_sha256` enne (registri muutus → seisund aegunud, korje seiskub kuni P8.0 re-inventuurini).
2. Kirje tasand: `source_id` unikaalne (massiiv → map source_id järgi); `version` kasvab ainult aktiveerimistehingus.
3. Kandidaadi apply: kandidaadi-fingerprint peab klappima (olemasolev `apply-check` semantika) — topelt-apply ja vahepealse muutuse race välistatud.
4. Järjekorra tasand: enne RAG_INGEST/RAG_DELETE rea loomist `findFirst(action, resourceType, resourceId, status in [pending])` sama tehingu advisory-locki all — DB-unique'i pole, aus märkus: ilma lockita on topeltrida teoreetiliselt võimalik; lock on seetõttu kohustuslik samm, mitte optimeering.

### 7.6 Rollback / forward-fix

- **Seisundifail:** bak-fail iga kirjutuse eel (KOV-muster) + git-ajalugu → rollback = bak'i taastamine.
- **Vale ingest:** forward-fix — patch-meta (meta-viga) VÕI supersede/RAG_DELETE järjekord (sisu-viga); doc_id versioonimuster teeb „vale versiooni" eemalduse sihipäraseks, mitte „kustuta ja loodame".
- **Vale registrimuudatus (merge'i järel):** registri git-ajalugu; seisundifail märkab fingerprint-muutust ja nõuab re-inventuuri — vale seisund ei saa vaikselt edasi elada.
- **Migratsioonirollback:** ei kohaldu (migratsioone ei tehta) — see ON osa otsuse väärtusest: P8 esimesed paketid on puhtalt failid+skriptid, deploy-riskita.

## 8. Testi- ja eval-programm

Neli taset olemasoleva test-infra peal: **ÜHIK** = `npm test` (node:test, fake-prisma, fixture'id; jookseb igal PR-il); **INTEG** = lokaalne rag-service tmp-kaustaga + fixture-veebiserver (elutsükli dok NIGHTLY klass); **PÄRIS-DB** = `db:migrate:check` klass (P8-l migratsioone pole → ainult DataDeletionJob-ridade käitumine olemasolevate testide laiendusena, fake-prismaga ÜHIK + päris drain INTEG-is); **RAG-EVAL** = elav keskkond, golden-eval + smoke klass (käsitsi/PRE-DEPLOY).

| # | Klass (ülesandest) | Test | Tase |
|---|---|---|---|
| 1 | URL-i normaliseerimine | tabelipõhised juhtumid (www/slash/percent/query/fragment) + **323 kirje `normalized_url` reprodutseerimine** (K6) | ÜHIK |
| 2 | Redirect ja SSRF | fixture-server: 301 sama domeen / 301 ristdomeen / 302 / silmus / redirect privaat-IP-le / localhost / metadata-IP / `file:` skeem → õiged keeldumised | ÜHIK (helper) + INTEG (fixture-server) |
| 3 | Sama sisu eri URL-idel | kaks fixture-URL-i sama tekstiga → teine saab `duplicate_of`, ingest'i EI toimu | ÜHIK (räsiloogika) + INTEG |
| 4 | Sama URL-i muutunud sisu | fixture muudab teksti → muutuse kandidaat tekib; kuupäevastampi muutus ÜKSI → ei teki (normaliseerija sööb) | ÜHIK |
| 5 | Paralleelne scheduler ja worker | kaks samaaegset collector-käivitust → teine blokeerub advisory-lockil; seisundifaili fingerprint-race → kirjutus keeldub | INTEG (+ ÜHIK CAS-loogikale) |
| 6 | Retry pärast osalist ebaõnnestumist | ingest kukub (teenus maas) → RAG_INGEST job-rida `nextAttemptAt`-iga; teenus tagasi → drain viib lõpuni; current-viide liigub alles õnnestumisel | ÜHIK (fake-prisma job-olekud) + INTEG (päris teenus) |
| 7 | Superseded RAG-dokumendi cleanup | v1→v2 aktiveerimistehing → v1 chunks==0 pärast draini; otsing v1 tekstiga ei too v1 doc_id-d | INTEG |
| 8 | Kadunud allikas | 404-seeria: 1×/2×/3×<48h → EI mingit muutust; 3×≥48h → `gone_candidate`; arhiveerimine ainult inimotsuse rajal | ÜHIK |
| 9 | Vigane või ülemõõduline sisu | mahupiiri ületus, timeout, `text/html` päis + PDF-baidid, tühi sisu, katkine kodeering → `fetch_failed`/`format_mismatch`/`thin_content`, MITTE ingest | ÜHIK + INTEG |
| 10 | Prompt-injektsioon veebilehes | fixture-leht „ignoreeri juhiseid…" tekstiga → ekstrakt säilitab (andmed), kandidaadi sample näitab; ingest'i järel vastuse juhised ei muutu (elutsükli testikiht 10.14 master-fixture'iga) | INTEG + RAG-EVAL |
| 11 | Registriviide ei jõua ainsa tsitaadina vastusesse | mock-vasted ainult `registry_reference` → displayed=0 + insufficient-rada; registry + sisuallikas → registry lubatud teisena (K10) | ÜHIK (attributsioon) + RAG-EVAL (golden-kaasus) |
| 12 | Vana versioon ei osale retrieval'is | pärast supersessiooni v<N> tekst ei ilmu otsingus (füüsiline eemaldus, K9); kui RAG-P1 current-filter jõustub, lisandub lipupõhine variant | INTEG |
| 13 | Kõrge riski allikas ei aktiveeru ülevaatuseta | `official_guideline`/kõrge klass ilma apply-kirjeta → collector keeldub ingest'ist; apply vale fingerprint'iga → keeldub | ÜHIK |
| 14 | Olemasolevate torude regressioon | (a) `knowledge:validate`, `organization:audit-metadata`, KOV static-payload testid jooksevad muutmata kujul rohelisena; (b) master-PDF-toru plan-režiim annab sama plaani enne/pärast P8 teeke (snapshot-võrdlus); (c) `practices:rag:verify` puutumata | ÜHIK + olemasolevad käsud |
| 15 | Esimese kümne allika dry-run | proovipaki 10 allikat läbi collector'i `--dry-run`: marsruudid == ptk 6.1 tabel; 0 ingest-kutset; kandidaadifailid + raport genereeritud; NEEDS_VERIFICATION kirjed ei sisene | INTEG (fixture'itega) + käsitsi päris-URL-idega (read-only fetch) |
| 16 | Päris retrieval'i ja tsitaatide eval pärast ingest'i | pärast proovipaki PÄRIS ingest'i (eraldi otsustatav samm, mitte selle ülesande osa): golden-evali laiendus ~5 kaasust (võlanõustamine, varjupaik, eluruum, omastehooldus, eetika) — õige allikas tsiteeritud, registriviide mitte ainsana, `source_checked_at` kuvatav | RAG-EVAL |
| 17 | Seisundifaili korruptsioon (lisaklass) | katkine JSON / vale registry_sha256 → collector seiskub, bak-taaste töötab (E18) | ÜHIK |

Jooksutamisreeglid: ÜHIK-klassid lisanduvad `npm test` alla (kiired, deterministlikud); INTEG-komplekt on üks käsk (nt `rag:master:test:integration`), mis tõstab lokaalse rag-service'i tmp-kaustaga (RAG-P5 NIGHTLY-harness'i esimene reaalne kasutaja); RAG-EVAL kaasused lähevad golden-setti alles pärast proovipaki päris-ingesti otsust.

## 9. Rakenduspaketid

Väikesed, järjestatud; ükski pakett ei nõua Prisma migratsiooni. Kirjete kuju: eesmärk → puutepind → skeemi/UI mõju → testid → valmis-kriteerium → sõltuvused → teadlikult ei tee.

### P8.0 — URL-kanoniseerija ja ohutu inventuur (ESIMENE; dry-run, read-only)

- **Eesmärk:** aus vastus küsimusele „mitu master-listi allikat on päriselt korpuses" + seisundifaili sünd. EI aktiveeri ühtegi allikat retrieval'isse, EI kirjuta RAG-i ega registrisse.
- **Puutepind:** UUS `scripts/lib/url-canonical.mjs`; UUS `scripts/inventory-master-sources.mjs` (loeb `master_sources_final.json` + rag-service `GET /documents` registrit read-only; kirjutab `master_sources.state.json` + raporti `logs/master-sources-inventory-<kuupäev>.json/md`); `package.json` skriptikirjed (`rag:master:inventory`). Rakenduse runtime-koodi EI puututa.
- **Skeemi/UI mõju:** puudub.
- **Testid:** ptk 8 #1 (323 reprodutseerimist), #17 (korruptsioon), #14a (olemasolevad validaatorid rohelised).
- **Valmis:** iga 323 kirje on täpselt ühes `match_status` seisundis (K7 tabel); raport annab ühe numbri „päriselt korras"; normaliseerija lahknevused (kui on) loetletud anomaaliatena.
- **Sõltuvused:** puuduvad (sh EI sõltu RAG-P0/P1/P2 — parandus ptk 3 p6).
- **Ei tee:** fetch'e välisveebist (võrdlus käib olemasoleva RAG-registri ja registrifaili vahel; värske-fetch'i täielikkuse kontroll (K7 `incomplete` osa) lükkub P8.2-te), kandidaate, ingest'i, patch-meta.

### P8.1 — Registriviite allasurumisreegel (sõltumatu, väike)

- **Eesmärk:** master-listi PDF (ja iga registry-roll) ei saa olla vastuse ainus sisuline allikas (K10; fakt 14.0.4 runtime'is).
- **Puutepind:** `lib/chat` attributsiooni/evidence-paketi filter (üks reegel + konstandid); ühiktestid; ops-juhis patch-meta käivituseks master-PDF-dokumendile (patch-meta ise on API-toiming, mitte koodimuudatus).
- **Skeemi/UI mõju:** puudub (UI võib hiljem kuvada „registriviide" märgist — ei kuulu P8.1-te).
- **Testid:** ptk 8 #11 ühikosa; golden-kaasuse definitsioon (jookseb päriselt alles P8.6 järel).
- **Valmis:** mock-testid rohelised mõlemas suunas (ainult-registry → surutud; registry+sisu → lubatud teisena); patch-meta käsk dokumenteeritud.
- **Sõltuvused:** puuduvad.
- **Ei tee:** teiste evidence_role'ide poliitika muutmist; retrieval-järjestuse muutmist.

### P8.2 — Turvaline fetch + korjekandidaatide generaator

- **Eesmärk:** `missing`/`incomplete`/`stale_match` kirjetest fetch-snapshot'iga kandidaadid inimotsuseks (E1–E12); esimene laine high-prioriteet (34).
- **Puutepind:** UUS `scripts/lib/safe-fetch.mjs` (SSRF+redirect+maht+timeout, ptk 5.1–5.4; teenuse semantika Node'is); UUS `scripts/check-master-sources.mjs` (kandidaadifail `master_sources.korje.json` + raport; robots-vahemälu; domeeni-viive); fixture-veebiserver testideks.
- **Skeemi/UI mõju:** puudub.
- **Testid:** ptk 8 #2, #3, #4, #8, #9, #10 (ekstrakti osa).
- **Valmis:** high-laine kandidaadid genereeritud dry-run'is; 0 ingest-kutset; robots-keeldude ja redirect'ide raport olemas; valepositiivide esmamõõt (müra-kandidaatide osakaal) kirjas.
- **Sõltuvused:** P8.0 (seisundifail).
- **Ei tee:** ingest'i; JS-renderdust (E7 piirang); social_media/KOV-domeenide fetch'e.

### P8.3 — html-knowledge-doc adapter + apply→ingest (inimkinnituse taga)

- **Eesmärk:** puuduv `html_or_topic` võimekus: kinnitatud kandidaat → `/ingest/text` kanoonilise metaga → `master:<source_id>:v1` + seisundifaili `rag_doc_id` (E13–E14).
- **Puutepind:** `scripts/lib/source-master-knowledge-docs.mjs` laiendus (html-meta ehitaja + PÄRIS sisu-hash — parandus ptk 3 p4); UUS `scripts/apply-master-sources-check.mjs` (fingerprint-kaitsega apply, KOV-muster); ingest-samm `check-master-sources` skripti `--ingest-approved` režiimina; `DataDeletionJob` RAG_INGEST integratsiooni helper (olemasolev kandja).
- **Skeemi/UI mõju:** skeem — puudub; admin näeb tulemusi failiraportitest (vaade = P8.7).
- **Testid:** ptk 8 #5, #6, #13; static-payload testid html-metale; INTEG täisring ühe fixture-allikaga.
- **Valmis:** fixture-allikas läbib kandidaat→apply→ingest→search täisringi lokaalses INTEG-is; ilma apply-kirjeta ingest on võimatu; topeltkäivitus = no-op.
- **Sõltuvused:** P8.0, P8.2. (RAG-P0/P1 EI blokeeri: v1-ingest ei kustuta midagi.)
- **Ei tee:** versioonivahetust (v2+); produktsiooni-ingest'i (see on P8.6 otsus); rag-service'i muudatusi.

### P8.4 — PDF-toru kõvendus + versioonivahetus/supersessioon

- **Eesmärk:** olemasolev master-PDF-toru saab turvalise allalaadija (safe-fetch), päris sisu-hash'i, kohustusliku skip-existing'u ja seisundifaili tagasikirjutuse; E15 aktiveerimistehing (v<N>→v<N+1> + RAG_DELETE järjekord + chunks==0 järelkontroll); olemasolevad paljad `source_id` doc_id-d adopteeritakse v0-na.
- **Puutepind:** `scripts/ingest-source-master-pdfs.mjs` + `scripts/lib/source-master-knowledge-docs.mjs`; drain-integratsiooni väike laiendus (master_source ressursitüüp).
- **Skeemi/UI mõju:** puudub.
- **Testid:** ptk 8 #7, #12; #14b snapshot-võrdlus (plan-väljund ei muutu ootamatult).
- **Valmis:** v1→v2 tsükkel + SIGKILL-test rohelised INTEG-is; vana versioon pole otsitav pärast draini.
- **Sõltuvused:** P8.3; **RAG-P0 soovitav** (aus delete-kviteering) — kuni selleta kompenseerib chunks==0 järelkontroll; RAG-P1 current-filter asendab tulevikus füüsilise kustutuse kiireloomulisuse, aga EI ole eeldus.
- **Ei tee:** vanade dokumentide mass-re-ingest'i (v0-reegel).

### P8.5 — Seire samale olekumasinale (timer)

- **Eesmärk:** E16–E17: perioodiline re-check (`next_check_at`), gone-loendur, redirect-kandidaadid; sagedused ptk 6.1/riskitabelist.
- **Puutepind:** `check-master-sources.mjs` re-check režiim; systemd-timeri kirje (ops; RAG-P2 ühine scheduler); raportid samasse formaati.
- **Skeemi/UI mõju:** puudub.
- **Testid:** ptk 8 #4, #8 laiendus; nädalane kuiv-jooks ilma inim-käivituseta.
- **Valmis:** timer jookseb nädala ilma sekkumiseta; kandidaadid ilmuvad ainult päris muutustest (valepositiivide määr < kokkulepitav lävi, nt 10%).
- **Sõltuvused:** P8.2 (kontrollskript), RAG-P2 (timer-taristu; kui P2 pole valmis, jookseb käsitsi käivitusena — funktsionaalsus ei blokeeru).
- **Ei tee:** auto-avaldamist; sageduste tõstmist enne valepositiivide mõõtu.

### P8.6 — Proovipakk (ptk 6; eraldi ingest-otsus)

- **Eesmärk:** 10 allika täisring päris keskkonnas KÕIK inimkinnitusega; golden-evali laiendus; „aus number" +10.
- **Puutepind:** ainult andmed/ops (kandidaadid, apply'd, ingest'id, eval-kaasused) — koodi ei lisandu, kui P8.0–P8.4 on valmis.
- **Skeemi/UI mõju:** puudub.
- **Testid:** ptk 8 #15 (enne), #16 (pärast).
- **Valmis:** ptk 6.3 viis kriteeriumi täidetud.
- **Sõltuvused:** P8.3 (+P8.4 PDF-idele) JA **blokeeriv tooteotsus** — lisakorje→master merge (ptk 10.3).
- **Ei tee:** ülejäänud 28 kandidaadi ingest'i; NEEDS_VERIFICATION kirjeid.

### P8.7 — Admini järjekorravaade (viimane; võib liituda RAG-P7-ga)

- **Eesmärk:** master-korje seisund admin-UI-s (loeb seisundifaili+raporteid, nagu KOV-monitori staatuseteenus).
- **Puutepind:** üks list-API + ra-* vaade; toimingud kutsuvad olemasolevaid skripte/API-sid.
- **Sõltuvused:** P8.0–P8.3; RAG-P7 raamistik.
- **Ei tee:** uut DB-mudelit (7.3 lävi kehtib).

## 10. Lõppväljund

### 10.1 Kas RAG-P8 peatükk 14 on aktiivse koodi vastu rakendusvalmis?

**Jah — suund ja arhitektuur kinnitatud, seitsme parandusega (10.2).** Ptk 14 põhiteesid pidasid koodikontrollile vastu: register on õige kujuga dedupe-seeme; marsruudid `recommended_pipeline` kaupa vastavad olemasolevatele torudele; ainus puuduv ehitustükk on html-adapter + orkestreerija + seisundikiht; check→kandidaat→apply muster on kolmel registril tõestatud ja üldistub. Ükski leid ei nõua ptk 14 tagasipööramist — ainult täpsustusi.

### 10.2 Millised parandused tööplaani tegin (ptk 3 koondloendi kokkuvõte)

1. Elutsükliväljad eraldi seisundifaili, MITTE kanoonilisse registrisse (tõend: valideerimisraporti drift 1.4).
2. URL-kanoniseerija tuleb ehitada — repos pole ühtegi (tõend: mõlemad `normalizeUrl` on trim; 2.4); aktsepteerimistest = 323 `normalized_url` reprodutseerimine.
3. html-adapter EI kasuta `/ingest/url` (lepinguväline `source_type:"url"`, main.py:3820) — kasutab `/ingest/text` + kanooniline meta.
4. Sisuduplikaadi kontroll ei saa toetuda olemasolevale `content_hash`-ile master-PDF-idel (identiteedihash, mitte sisuhash; source-master-knowledge-docs.mjs:257).
5. Supersessioon = füüsiline RAG_DELETE järjekord + chunks==0 järelkontroll; lipp üksi ei eemalda vana sisu otsingust (üldretrieval ei filtreeri `historical`-i; 2.8).
6. Sõltuvused lõdvendatud: P8.0–P8.2 alustatavad KOHE (ei sõltu RAG-P0/P1/P2); P1/P2/P0 muutuvad oluliseks alles P8.4/P8.5 faasis.
7. Proovipakis inimkinnitus KÕIGILE (ka AUTO_CANDIDATE); auto-ingest avaneb alles P8.5 valepositiivide mõõdiku järel.

### 10.3 Blokeerivad toote- ja turvaotsused (enne P8.6; P8.0–P8.5 ei blokeeri)

1. **Lisakorje→master merge:** kes ja millal kureerib 38 kandidaadi liitmise kanoonilisse registrisse (lõpp-dedupe kaasa arvatud). Ilma selleta proovipakk ei käivitu.
2. **Raporti lahtised küsimused tooteomanikule** (lisakorje raport §9): eetikakoodeks üksik-doc vs ESTA-paketi osa; IASSW HTML vs PDF (üks kahest); tooelu.ee ulatus (ainult tööheaolu-vaade?); omastehooldus.eu vanade käsiraamatute saatus; SKA teenusejuhendite seire sagedus; kutsestandardite versioonipoliitika; ajakirja TAI→SKA kolimise mõju olemasolevale kihile.
3. **Automaatika piir:** kinnitus, et madala riski auto-ingest EI avane enne P8.5 mõõdikuid (soovitus 10.2.7) — see on teadlik karmistus ptk 14.7 suhtes.
4. **Korje-etikett:** robots.txt austamise + UA-stringi + domeeni-viivituse poliitika ametlik kinnitus (ptk 4 E3) — puudutab väliseid osapooli.
5. **Patch-meta master-PDF-ile** (registry_reference roll): ops-toiming admin-API võtmega — vajab käivitusloa otsust (väike, aga kirjutav toiming produktsiooni RAG-is).

### 10.4 Esimene teostatav pakett

**P8.0 — URL-kanoniseerija ja ohutu inventuur** (ptk 9): kaks uut skripti + testid, read-only, migratsioonita, ei ingest'i midagi, ei kirjuta RAG-i ega registrisse. Väljund: `master_sources.state.json` + aus kattuvusraport (167 on seni ainult ülempiir). Sõltuvusi pole; iseseisvalt väärtuslik ka siis, kui järgmisi pakette edasi lükatakse.

### 10.5 Täpne jätkamiskäsk järgmisele koodi kirjutavale aknale

> Loe `docs/platvormi arendus/fable-5-rag-p8-url-korje-tehniline-tooplaan.md` (eriti ptk 3 K6/K7, ptk 4 E1, ptk 9 P8.0) ja teosta AINULT pakett P8.0:
> 1. `scripts/lib/url-canonical.mjs` — kanoniseerija, mille aktsepteerimistest on `master_sources_final.json` kõigi 323 kirje `normalized_url` täpne reprodutseerimine (`url` → `normalized_url`); lahknevused raporteeri anomaaliatena, ära „paranda" registrit.
> 2. `scripts/inventory-master-sources.mjs` — read-only inventuur: registri 323 kirjet vs rag-service `GET /documents` registridump (lokaalselt: elus teenus või salvestatud dump-fail `--rag-dump <path>`); väljund `Andmebaasi/Admebaasi-materjali-lisa/master_sources.state.json` (päises `state_schema_version`, `registry_sha256`, `updated_at`) + raport `logs/`-i; iga kirje saab `match_status` ptk 3 K7 tabeli järgi (ilma värske-fetch'i kontrollita — `incomplete` piirdub chunk-count/path-täpsusega).
> 3. `package.json`: `rag:master:inventory` (+ `--json`); ühiktestid `npm test` alla (tabelijuhtumid + 323 reprodutseerimine + seisundifaili korruptsioonitest).
> Piirangud: EI mingit ingest'i, EI kirjuta RAG-i, EI muuda `master_sources_final.json`-i, EI Prisma muudatusi, EI rag-service'i muudatusi. Valmis = ptk 9 P8.0 valmis-kriteerium.

### 10.6 Sõltumatu auditi fookus (pärast teostust)

1. Kanoniseerija vs registri anomaaliad: kas lahknevused on koodivead või registri andmevead (kumbki ei tohi vaikida).
2. Seisundifaili CAS: kaks paralleelset protsessi (timer + käsitsi) — kas advisory-lock + fingerprint päriselt välistavad topeltkirjutuse; failikirjutuse mitteatomaarsuse jääkrisk.
3. Dedupe valepositiivid: kas K7 reeglid ei blokeeri õigustatud korjet („üldjuhend" nimekonflikt on valmis kontrolljuhtum).
4. Allasurumisreegli ülekate: registry+sisu segapaketis EI tohi reegel sisulist allikat maha suruda.
5. Safe-fetch helper: DNS-rebinding TOCTOU aken Node'is (resolve-kontrolli ja tegeliku ühenduse vahel) — kas aktsepteeritud jääkrisk on dokumenteeritud; redirect privaat-IP-le keset ahelat.
6. Prompt-injektsiooni eval master-fixture'iga (ptk 8 #10) päriselt jookseb, mitte ainult ei eksisteeri.
7. Kõrvalleid (mitte P8, aga üles märgitud): `organization_profile` puudub `RAG_SOURCE_TYPES`-ist ja värskuspoliitikast, kuigi on korpuses kasutusel (2.2) — org-toru omanikule.

### 10.7 Deploy-eelne kontrollnimekiri (kui P8 kood jõuab deploy'ni)

- [ ] `npm test` roheline (sh uued ühikklassid ptk 8 #1, #4, #8, #9, #13, #17)
- [ ] INTEG-komplekt ühe käsuga roheline lokaalse rag-service'iga (#2, #3, #5, #6, #7, #12)
- [ ] Prisma migratsioone EI ole lisandunud (`prisma migrate status` puhas) — P8 lubadus
- [ ] Olemasolevate torude regressioon: `knowledge:validate`, `organization:audit-metadata`, KOV static-testid, `practices:rag:verify` muutumata rohelised (#14)
- [ ] Master-PDF-toru plan-snapshot enne/pärast identne (#14b)
- [ ] `rag:master:inventory` jookseb produktsiooni dump'i vastu ja seisundifail on värske (registry_sha256 klapib)
- [ ] Patch-meta (registry_reference) tehtud JA allasurumisreegli ühiktest roheline (#11)
- [ ] Freshness-audit uute dokumentidega puhas (kui P8.6 ingest toimus); golden-eval ≥ kokkulepitud lävi
- [ ] Seisundifaili + kandidaadifailide bak'id olemas; rollback-juhis (ptk 7.6) käeulatuses
- [ ] Ükski NEEDS_VERIFICATION / needs_review kirje ei ole ingest'itud (kontroll raportist)

---

*Verifitseerimise ja tööplaani koostas Fable 5, 2026-07-15, aktiivse `main`-i (890124bd) vastu. Rakenduskoodi, skeemi, migratsioone, andmebaasi ega kanoonilist master-listi ei muudetud; ühtegi ingest'i ei käivitatud.*
