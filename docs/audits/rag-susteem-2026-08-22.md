# SotsiaalAI RAG-süsteemi tehniline kaart ja kvaliteediseire hetkeseis

Kuupäev: 22.08.2026
Tööharu: `codex/rag-quality-repair-20260822`
Varasem toodangusse viidud RAG-paranduste commit: `08cbd94ac86597911e22e3731ee812c717f04110`
Praegune toodangu `HEAD` ja `origin/main`: `9cad5105fc30d68f1df7bb084f79a59e68b110d7` (mõõdetud 22.08.2026 pärast seire ajal toimunud järgmist deploy'd)
P0-parandused jõudsid toodangusse commit'iga `73d381a7febd017bc32d2a8976da60b2b9c9d42a`; deploy-järgne autentitud RAG-kontroll tehti selle SHA vastu. Hilisem `9cad5105` muutis ainult hääleavatari faile ja sisaldab RAG-paranduse commit'i esivanemana. 75 juhtumi lõppvärav ei ole tehtud.
Seis: **PARTIAL — süsteemi ei ole tõendatud 10/10 töökindlaks**

See dokument vastab neljale eri küsimusele:

1. milline SotsiaalAI RAG-süsteem tehniliselt on;
2. millised failid, andmeallikad, indeksid ja keskkonnaseaded sellesse kuuluvad;
3. mida on sisuliselt proovitud, milliseid vigu parandatud ja millised riskid on alles;
4. mida tuleb veel päris toodanguindeksi ja autentitud `/vestlus` kaudu tõendada.

75 juhtumi detailne maatriks, algallikad, päringud, vastused ja ajad on failis
[rag-kvaliteediseire-2026-08-22.md](./rag-kvaliteediseire-2026-08-22.md). Käesolev fail on süsteemikaart ja seire üleandmisdokument, mitte selle maatriksi asendus.

## 1. Lühikokkuvõte

SotsiaalAI RAG ei ole üks otsingukäsk ega üks vektorandmebaas. See koosneb vähemalt kuuest eraldi kihist:

1. **algmaterjalid** — ajakiri Sotsiaaltöö, uuringud, juhendid, töölehed, ametlikud infomaterjalid, KOV-i teenused ja õigusallikad;
2. **korje ja registrikiht** — dokumendi fail, metaandmed, elutsükli olek ja versioonid;
3. **indeks** — Chroma vektorindeks ning tekstilised otsingukanalid;
4. **otsingu planeerimine ja järjestus** — küsimusetüübi tuvastamine, kanalite valik, hübriidotsing, rühmitamine ja kontekstivalik;
5. **vastuse koostamine** — valitud tõendi lisamine mudeli konteksti, allikapaketid, atribuutika ja lõppvastus;
6. **kasutajaliides** — autentitud sama vestlus, vastuse voogedastus ja kuvatud allikad.

Seetõttu ei tõenda ükski järgmistest eraldi kogu RAG-i töökindlust:

- teenuse `health=ok`;
- õige pealkirja leidmine;
- `partial=false`;
- 49 727 vektorlõigu olemasolu;
- automaattestide roheline tulemus;
- otsese `/search` päringu edu;
- kiire esimene tekst;
- allikakaardi kuvamine.

Töökindluse jaoks peab sama juhtum läbima nii otsingu kui ka autentitud vestluse: õige fakt peab olema valitud kontekstis, vastuses õigesti kasutatud ja kuvatud allikaga toetatud.

## 2. Toodangu tegelik topoloogia

```mermaid
flowchart LR
    U[Autenditud kasutaja /vestlus] --> N[Next.js frontend]
    N --> C[/api/chat]
    C --> P[Planner ja retrieval orchestration]
    P --> R[RAG FastAPI 127.0.0.1:8000]
    R --> CH[Chroma vektorindeks]
    R --> RG[registry.json]
    R --> DS[versioonitud dokumendifailid]
    R --> O[OpenAI embeddings]
    C --> M[OpenAI vastusemudel]
    C --> DB[PostgreSQL vestlused, jooksud ja allikapaketid]
    M --> UI[Vastus ja displayed_sources]
```

### 2.1 Serveriprotsessid

| teenus | töökaust | käivitus | konfiguratsioon |
|---|---|---|---|
| `sotsiaalai-frontend.service` | `/home/ubuntu/apps/sotsiaalai` | `/usr/bin/npm run start` | `/etc/sotsiaalai/frontend.env` |
| `sotsiaalai-rag.service` | `/home/ubuntu/apps/sotsiaalai/rag-service` | uvicorn `main:app --host 127.0.0.1 --port 8000 --workers 1` | `/etc/sotsiaalai/rag.env` |
| `sotsiaalai-research-worker.service` | `/home/ubuntu/apps/sotsiaalai` | `/usr/bin/npm run research:worker` | `/etc/sotsiaalai/frontend.env` |

RAG-teenus ei ole avalikult internetti binditud. Frontend pöördub selle poole loopback-aadressil. Viimases mõõtmises olid frontend ja RAG aktiivsed ning avalik `/vestlus` vastas HTTP 200.

### 2.2 Toodangu mõõdetud seis

| kontroll | tulemus |
|---|---|
| serveri HEAD | `9cad5105fc30d68f1df7bb084f79a59e68b110d7` |
| `origin/main` | sama SHA |
| RAG health | `{"ok":true,"status":"ok","vectors":49727,"documents":6089}` |
| aktiivsed vektorlõigud | **49 727** |
| registrikirjeid kokku | **6089** |
| registris `ACTIVE` elutsükkel | **884** |
| registris `DELETED` elutsükkel | **16** |
| vana kirje ilma lifecycle-väljata | **5189** |

`documents=6089` tähendab registrikirjete koguarvu, mitte aktiivsete failide arvu. Seda arvu ei tohi esitada kui „6089 aktiivset dokumenti”.

## 3. Küsimuse teekond

1. Kasutaja kirjutab küsimuse autentitud `/vestlus` lehel.
2. `app/api/chat/route.js` kontrollib seanssi, privaatsust, vestluse omandit, piiranguid ja kvooti.
3. Küsimuse planner määrab küsimusetüübi ja otsinguplaani.
4. Retrieval-orchestrator koostab otsingupäringud ja kutsub serverisiseselt RAG-i `POST /search`.
5. Python-teenus käivitab valitud tiheda ja tekstilise otsingu kanalid, ühendab kandidaadid, järjestab ja rühmitab need.
6. Next.js kontekstivalik valib rühmad ja lõigud mudeli konteksti.
7. Vastusekoostaja annab mudelile küsimuse, vestlusajaloo, juhised ja tõendipaketi.
8. Lõppvastuse järel moodustatakse `displayed_sources`.
9. UI näitab vastust ning avab „Vastuste allikad” paneeli.

See teekond selgitab, miks otsene RAG-otsing võib leida õige fakti, kuid vestlus vastata valesti: viga võib tekkida pärast otsingut planner'is, järjestuses, kontekstivalikus, ajaloo käsitluses, prompt'is, mudeli sünteesis või allika atribuutikas.

## 4. Koodipuu ja failide rollid

Allolev puu näitab RAG-i käitumist määravaid põhiosi. See ei loetle iga testi nime, kuid annab täieliku komponentide kaardi.

```text
SotsiaalAI/
├─ rag-service/                         # eraldi Python/FastAPI RAG-teenus
│  ├─ main.py                           # API, ingest, embeddings, otsing, hübriidjärjestus
│  ├─ auth_config.py                    # API võtme ja no-auth režiimi fail-closed reeglid
│  ├─ document_versions.py              # dokumendiversioonid, staging, activeVersion
│  ├─ registry_store.py                 # registry.json lugemine ja turvaline salvestus
│  ├─ storage_paths.py                  # failiteed ja containment-kontroll
│  ├─ parser_worker.py                  # eraldatud/katkestatav parsersisend
│  ├─ pinned_fetch.py                    # URL-i korje kinnitatud IP/hosti reeglitega
│  ├─ request_limits.py                  # päringu- ja failimahupiirid
│  ├─ upload_limits.py                   # üleslaadimise piirangud
│  ├─ search_security.py                 # otsingu sisendi turvakontroll
│  ├─ requirements.txt
│  ├─ RECOVERY.md
│  └─ (testifaile praegusel main-harul ei ole)
│
├─ app/api/chat/
│  └─ route.js                           # autentitud vestluse põhitee
│
├─ lib/chat/                              # 59 faili; planner, retrieval ja vastus
│  ├─ questionPlanner.js
│  ├─ queryPlanner.js
│  ├─ retrievalStrategySelector.js
│  ├─ retrievalPlanning.js
│  ├─ retrievalOrchestrator.js
│  ├─ retrievalContextAssembler.js
│  ├─ ragContext.js
│  ├─ legalLookup.js
│  ├─ requestContext.js
│  ├─ sourcePackages.js
│  ├─ sourceAttribution.js
│  ├─ sectionAttribution.js
│  ├─ evidencePackage.js
│  ├─ promptBuilder.js
│  ├─ openaiRuntime.js
│  ├─ mainResponseHandler.js
│  ├─ responseFinalizer.js
│  └─ settings.js
│
├─ lib/rag/                               # 16 faili; RAG kliendid ja shared abiloogika
├─ lib/admin/rag/                         # 28 faili; administraatori töövood
├─ app/api/rag/[...path]/route.js         # kontrollitud admin-proxy Python-teenusele
├─ app/api/admin/rag/                     # 35 faili; haldus-API rajad
├─ components/admin/rag/                  # 33 faili; RAG haldusliides
├─ components/alalehed/chat/              # 15 faili; vestluse ja allikate UI
│  ├─ ChatMessageItem.jsx
│  └─ ChatSourcesPanel.jsx
│
├─ prisma/schema.prisma                   # vestlused, allikapaketid, tagasiside, graph-lite
├─ scripts/                               # ingest, audit, smoke, deploy ja hooldusskriptid
├─ tests/                                 # praegusel main-harul puudub
├─ Andmebaasi/                            # repos olev väike valik/testmaterjal
├─ docs/ajakiri_sotsiaaltoo/              # ajakirja puudutav dokumentatsioon
└─ docs/audits/                           # kvaliteediseire ja süsteemikaart
```

Mõõdetud failihulgad:

| ala | failide arv |
|---|---:|
| `rag-service/` | 31 |
| `lib/chat/` | 59 |
| `lib/rag/` | 16 |
| `lib/admin/rag/` | 28 |
| `app/api/rag/` | 2 |
| `app/api/admin/rag/` | 35 |
| `app/api/chat/` | 8 |
| `components/alalehed/chat/` | 15 |
| `components/admin/rag/` | 33 |
| `tests/` | 0 — kataloog ja `npm test` skript puuduvad praegusel `origin/main`-il |
| nime järgi RAG-iga seotud skriptid | 79 |
| nime järgi RAG-iga seotud testid | 72 |

## 5. Python RAG-teenuse API

Kõik rajad peale `GET /health` nõuavad päist `X-API-Key`.

### Tervise- ja otsingurajad

- `GET /health`
- `POST /search`
- `POST /search/agent-documents`
- `POST /analyze`

### Korje- ja üleslaadimisrajad

- `POST /ingest/file`
- `POST /ingest/text`
- `POST /upload`
- `POST /ingest/pdf-with-metadata`
- `POST /ingest/url`
- `POST /ingest/articles`
- `POST /ingest/articles/{doc_id}`

### Dokumendi haldusrajad

- `GET /documents`
- `GET /documents/{doc_id}`
- `GET /documents/{doc_id}/chunks`
- `GET /documents/{doc_id}/source`
- `POST /documents/{doc_id}/reindex`
- `POST /documents/{doc_id}/update-meta`
- `POST /documents/{doc_id}/patch-meta`
- `DELETE /documents/{doc_id}`

`POST /search` võtab muu hulgas küsimuse, `top_k`, dokumendifiltri, metaandmete `where` filtri, kanalivaliku, kaasatavad väljad ja `request_id`. Vastus sisaldab kandidaatide kõrval rühmi, kasutatud kanaleid, strateegiat, kanalistatistikat, `partial/degraded` olekut ning ajastusi. Need väljad on diagnostika, mitte iseenesest kvaliteedihinne.

## 6. Toodanguindeks ja failisalvestus

RAG-i päris tehniline salvestus asub serveris:

```text
/var/lib/sotsiaalai-rag/
├─ registry.json                 # registri praegune seis
├─ registry.json.last-good       # viimane terve varukoopia
├─ chroma/
│  ├─ chroma.sqlite3
│  └─ <UUID segment directory>/  # vektorsegmendid
├─ docs/
│  └─ <sha1(doc_id) 12 märki>/
│     ├─ lähtefail
│     └─ versioonid/
└─ .document-locks/              # dokumendipõhised lukud
```

Mõõdetud suurused ja arvud:

| objekt | tulemus |
|---|---:|
| kogu salvestus | umbes 2,7 GB |
| `chroma/` | umbes 2,1 GB |
| `docs/` | umbes 549 MB |
| `.document-locks/` | umbes 324 KB |
| `registry.json` | 14 214 880 baiti |
| registri muutmisaeg mõõtmisel | 22.08.2026 02:36:37 +03:00 |
| hashitud dokumendikaustu | 1062 |
| lähtefaile neis | 1062 |
| versioonikaustu | 397 |
| lukufaile | 1764 |

Chroma vaikekollektsioon on `sotsiaalai`. Dokumendi uue versiooni korje toimub staging'u kaudu ja `activeVersion` vahetatakse alles õnnestunud lõppfaasis. Kustutamisel kasutatakse registri elutsükli olekut/tombstone'i; registri kirje ja vektorid ei ole sama asi.

## 7. Registri tegelik sisu

### 7.1 Kollektsioonid ja elutsükkel

| kollektsioon | kokku | ACTIVE | DELETED | vana/puuduv lifecycle |
|---|---:|---:|---:|---:|
| `kov_services` | 4931 | 0 | 0 | 4931 |
| `sotsiaaltoo_articles` | 903 | 877 | 11 | 15 |
| `national_guidelines` | 93 | 6 | 0 | 87 |
| `kov_legal` | 78 | 0 | 0 | 78 |
| `research_reports` | 31 | 0 | 0 | 31 |
| `organization_materials` | 28 | 0 | 4 | 24 |
| `organization_guidelines` | 15 | 1 | 0 | 14 |
| `policy_analyses` | 7 | 0 | 0 | 7 |
| `national_regulations` | 1 | 0 | 0 | 1 |
| `organizations` | 1 | 0 | 0 | 1 |
| `training_materials` | 1 | 0 | 1 | 0 |
| **kokku** | **6089** | **884** | **16** | **5189** |

Ajakirjakollektsiooni eraldi mõõtmine: 903 registrikirjet, neist 877 `ACTIVE`, 11 `DELETED` ja 15 vana elutsüklita kirjet. See ei ole sama arv nagu varasem 863 või 864 „aktiivset Sotsiaaltöö dokumenti”. Loenduste semantika tuleb enne ametliku arvu kasutamist ühtlustada.

### 7.2 Allikatüübid

| source_type | arv |
|---|---:|
| `kov_service_info` | 2346 |
| `partner_service_info` | 904 |
| `journal_article` | 903 |
| `application_form` | 863 |
| `official_contact` | 817 |
| `information_material` | 88 |
| `kov_regulation` | 78 |
| `research_report` | 47 |
| `official_guideline` | 33 |
| `policy_analysis` | 6 |
| `municipality_kov` | 1 |
| `national_law` | 1 |
| `organization_profile` | 1 |
| `training_material` | 1 |

### 7.3 Vormingud

| MIME | arv |
|---|---:|
| `text/markdown` | 4930 |
| `application/pdf` | 824 |
| `text/plain` | 254 |
| `application/xml` | 79 |
| puudub | 2 |

`source_format` on täidetud ainult osal kirjetest: XML 79, Markdown 78, veebitekst 43 ning 5889 kirjel puudub see väli. See on metaandmete kvaliteedirisk, kuid ei seleta üksi vestluse valesid vastuseid.

## 8. Algmaterjalid ja kohalik failikorpus

### 8.1 Põhiline kohalik andmebaas

Algallikate kontrolliks kasutatud põhikaust on:

```text
C:\Users\rauds\sotsiaal.ai\Andmebaas/
├─ ajakiri_sotsiaaltoo/        # 2840 faili
├─ tmp/                        # 122 faili
└─ README...                   # 1 fail
```

Kokku mõõdeti 2963 faili. Ajakirjakaustas olid väljaanded 2016. aasta numbritest kuni 2026. aasta teise numbrini, erinumbrid ja muud ajaloolised kogumid.

### 8.2 `ajakiri_sotsiaaltoo` vormingud

| laiend | arv |
|---|---:|
| `.json` | 896 |
| `.txt` | 890 |
| `.pdf` | 648 |
| `.png` | 327 |
| `.md` | 71 |
| `.html` | 6 |
| `.py` | 2 |

Ühe artikli mitu vormingut ei tähenda mitut sisuliselt eri dokumenti. Failide arv, artiklite arv, registrikirjete arv ja aktiivsete indeksikirjete arv on eri mõõdikud.

### 8.3 Repos olev `Andmebaasi/`

Isolatsioonitööpuus mõõdeti 35 faili:

- `Admebaasi-materjali-lisa/` — 11;
- `lisatest/` — 10;
- `uuringud ja juhendid/` — 6;
- `ajakiri/` — 4;
- `organisatsioonid/` — 4.

See repo kaust on väike arendus-/testmaterjalide valik, mitte toodangu kogu aktiivne korpus.

Selles worktree's ei olnud eraldi `KOV/` ega `imports/` failipuud. Toodanguregistris on KOV-i kollektsioonid olemas, kuid nende algse serveripoolse failipuu täielikku võrdlust ei ole käesolevas auditis tehtud. `master_sources_final.json` on dedupeerimis- ja planeerimiskaart, mitte aktiivse korpuse tõend.

## 9. Korje, tükeldamine ja reindekseerimine

Toodangu RAG-teenuse ohutud tegelikud tükeldusseaded:

| seadistus | väärtus |
|---|---|
| `RAG_ALWAYS_CHUNK` | `1` |
| `RAG_CHUNK_MODE` | `tokens` |
| `RAG_CHUNK_TOKENS` | `700` |
| `RAG_CHUNK_TOKENS_OVERLAP` | `120` |
| `RAG_SINGLE_CHUNK_TOKEN_LIMIT` | `1200` |
| `RAG_EMBED_MODEL` | `text-embedding-3-large` |
| `RAG_SERVER_MAX_MB` | `25` |

Korje põhietapid:

1. sisendi autoriseerimine, mahu- ja MIME-kontroll;
2. faili või teksti turvaline parsimine;
3. dokumendi metaandmete normaliseerimine;
4. tükeldamine 700-tokenisteks kattuvateks lõikudeks;
5. embedding'ute loomine;
6. Chroma staging/uuendus;
7. dokumendifaili versiooni ja registri `activeVersion` atomaarne kinnitamine;
8. ebaõnnestumisel vana aktiivse versiooni säilitamine.

Selle auditi ja parandusploki ajal korpust ega indeksit ei muudetud ja reindekseerimist ei tehtud.

## 10. Otsing, kanalid ja järjestus

### 10.1 Vaikimisi otsingukanalid

- `dense` — embedding'u sarnasus;
- `author_match` — autori nime vaste;
- `title_match` — pealkirja vaste;
- `exact_phrase` — täpne fraas;
- `bm25` — tekstiline leksikaalne vaste;
- `registry_fact` — registri struktureeritud faktikandidaat, kui küsimus ja dokument on piisavalt üheselt seotud.

Toodangu leksikaalsed seaded:

| seadistus | väärtus |
|---|---|
| `RAG_LEXICAL_SEARCH_ENABLED` | `true` |
| `RAG_LEXICAL_TOP_K` | `20` |
| `RAG_LEXICAL_MAX_SCAN` | `8000` |
| `RAG_LEXICAL_SCAN_LIMIT` | `8000` |
| `RAG_RRF_K` | `60` |

Hübriidjärjestuse põhivalem koodis:

```text
dense_score * 0.58
+ lexical_score * 0.34
+ rrf_score * 8.0
+ channel_boost
+ bm25_coverage_boost
```

Kanali kaalud/boonused ei ole kasutajale nähtav hinne. Need mõjutavad ainult kandidaatide järjestust. Eraldi tugevdatakse tuvastatud autori, pealkirja ja registrifakti vasteid.

### 10.2 Planner'i küsimusetüübid

Planner eristab muu hulgas järgmisi radu:

- `legal_exact`;
- `kov_service_or_benefit`;
- `specific_document_summary`;
- `person_source_lookup`;
- `overview_synthesis`;
- `life_situation_guidance`;
- `comparison`;
- `resource_discovery`.

See klassifikatsioon on oluline, sest autoripäring, lai süntees, KOV-i teenuse küsimus ja ühe uuringu arvuline fakt ei tohi kasutada täpselt sama retrieval-strateegiat.

## 11. Kontekstivalik, vastus ja allikad

Frontend kasutab mõõdetud seadistusi:

| seadistus | väärtus |
|---|---|
| `RAG_TOP_K` | `12` |
| `RAG_CONTEXT_GROUPS_MAX` | `8` |
| `RAG_CTX_MAX_CHARS` | `8500` |
| `RAG_GROUP_BODY_MAX_CHARS` | `1500` |
| `RAG_MMR_LAMBDA` | `0.60` |
| `RAG_TIMEOUT_MS` | `30000` |
| `RAG_GRAPH_CHANNEL_ENABLED` | `1` |
| `RAG_ATTRIBUTION_DECISIONS_ENABLED` | `true` |
| `RAG_DISPLAYED_SOURCES_ENFORCED` | `true` |
| `RAG_TRACE_V1_ENABLED` | `true` |

Mudeliseaded:

| seadistus | väärtus |
|---|---|
| `OPENAI_MODEL` | `gpt-5.6-luna` |
| `OPENAI_REASONING_EFFORT` | `medium` |
| `OPENAI_TEXT_VERBOSITY` | `medium` |
| `OPENAI_MAX_OUTPUT_TOKENS_CLIENT` | `3000` |
| `OPENAI_MAX_OUTPUT_TOKENS_WORKER` | `3000` |

Allikate teekond:

1. otsingutulemusest moodustatakse tõendipakett;
2. vastusekoostaja kasutab valitud lõike;
3. atribuutikakiht seob vastuse tõendiga;
4. `displayed_sources` läheb UI-le;
5. `ChatMessageItem.jsx` avab `ChatSourcesPanel.jsx`.

Viimases UI-paranduses vahetati allikapaneeli sulgemine sama jagatud `IconButton` + `CloseIcon` lahenduse vastu, mida kasutab vestlus, eemaldati päise alajoon ning seoti number visuaalselt allikakaardi sisse. „Kontrollimise aeg teadmata” ei ole tavakasutajale sobiv tekst ja see eemaldati kuvatavast kaardist. Visuaalne lõppkontroll viimase deploy järel autentitud aknas on siiski veel `NOT_PROVEN`.

## 12. Keskkonnafailid serveris

### 12.1 Kus failid asuvad

Serveris on päris keskkonnafailid:

```text
/etc/sotsiaalai/
├─ rag.env          # Python RAG-teenuse konfiguratsioon ja saladused
└─ frontend.env     # Next.js, vestlus, RAG-klient, mudel ja worker
```

Systemd loeb need failid teenuste käivitamisel. Need ei ole repos ning nende salajasi väärtusi ei tohi dokumentatsiooni, logisse ega chatti kopeerida.

Repos ei leitud mõõtmise ajal `.env`, `.env.example` ega muud terviklikku keskkonnamalli. See on dokumenteeritav konfiguratsioonidrifti risk: tootmise võtmete lepingut saab praegu tervikuna näha ainult serveris või koodist kokku lugeda.

### 12.2 Töötava toodangu konsolideeritud saladusteta väljavõte

Väljavõte mõõdeti serverist 22.08.2026 kell 17:29 +03:00. Mõõtmise ajal olid
`sotsiaalai-frontend.service` ja `sotsiaalai-rag.service` olekus `active` ning
serveri `HEAD` ja `origin/main` olid mõlemad
`2c142000841fe630aa1baf92aaf524be7e64d0ac`. Väärtused kontrolliti lisaks
keskkonnafailidele ka mõlema parajasti töötava põhiprotsessi tegelikust
`/proc/<pid>/environ` keskkonnast; kõik 15 väärtust kattusid.

```dotenv
# /etc/sotsiaalai/frontend.env
RAG_TOP_K=12
RAG_CONTEXT_GROUPS_MAX=8
RAG_CTX_MAX_CHARS=8500
RAG_GROUP_BODY_MAX_CHARS=1500
RAG_MMR_LAMBDA=0.60
RAG_TIMEOUT_MS=30000
RAG_GRAPH_CHANNEL_ENABLED=1
RAG_ATTRIBUTION_DECISIONS_ENABLED=true
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=medium

# /etc/sotsiaalai/rag.env
RAG_LEXICAL_TOP_K=20
RAG_LEXICAL_MAX_SCAN=8000
RAG_RRF_K=60
RAG_CHUNK_TOKENS=700
RAG_CHUNK_TOKENS_OVERLAP=120
```

See plokk ei sisalda API võtmeid, paroole, ühendusstringe, projektitunnuseid ega muid saladusi.

### 12.3 `/etc/sotsiaalai/rag.env`

Ohutud tegelikud väärtused:

```dotenv
RAG_ALWAYS_CHUNK=1
RAG_CHUNK_MODE=tokens
RAG_CHUNK_TOKENS=700
RAG_CHUNK_TOKENS_OVERLAP=120
RAG_COLLECTION=sotsiaalai
RAG_EMBED_MODEL=text-embedding-3-large
RAG_LEXICAL_MAX_SCAN=8000
RAG_LEXICAL_SCAN_LIMIT=8000
RAG_LEXICAL_SEARCH_ENABLED=true
RAG_LEXICAL_TOP_K=20
RAG_RRF_K=60
RAG_SERVER_MAX_MB=25
RAG_SINGLE_CHUNK_TOKEN_LIMIT=1200
RAG_STORAGE_DIR=/var/lib/sotsiaalai-rag
```

Failis olemas olevad võtmenimed:

```text
OPENAI_API_KEY
OPENAI_PROJECT
RAG_ALLOWED_MIME
RAG_ALLOWED_ORIGINS
RAG_ALWAYS_CHUNK
RAG_CHUNK_MODE
RAG_CHUNK_TOKENS
RAG_CHUNK_TOKENS_OVERLAP
RAG_COLLECTION
RAG_COST_MIRROR_SECRET
RAG_COST_MIRROR_URL
RAG_EMBED_MODEL
RAG_LEXICAL_MAX_SCAN
RAG_LEXICAL_SCAN_LIMIT
RAG_LEXICAL_SEARCH_ENABLED
RAG_LEXICAL_TOP_K
RAG_RRF_K
RAG_SERVER_MAX_MB
RAG_SERVICE_API_KEY
RAG_SINGLE_CHUNK_TOKEN_LIMIT
RAG_STORAGE_DIR
```

Saladused või turvatundlikud väärtused, mida siia tahtlikult ei kopeerita: `OPENAI_API_KEY`, `RAG_SERVICE_API_KEY`, `RAG_COST_MIRROR_SECRET` ning vajaduse järgi projekti-/origin-väärtused.

### 12.4 `/etc/sotsiaalai/frontend.env`

RAG-i ja vastusekoostamise ohutud tegelikud väärtused:

```dotenv
CHAT_PROMPT_TOKEN_AUDIT=0
NEXT_PUBLIC_RAG_MAX_UPLOAD_MB=25
OPENAI_MAX_OUTPUT_TOKENS_CLIENT=3000
OPENAI_MAX_OUTPUT_TOKENS_WORKER=3000
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=medium
OPENAI_TEXT_VERBOSITY=medium
RAG_API_BASE=http://127.0.0.1:8000
RAG_ATTRIBUTION_DECISIONS_ENABLED=true
RAG_CONTEXT_GROUPS_MAX=8
RAG_CTX_MAX_CHARS=8500
RAG_DISPLAYED_SOURCES_ENFORCED=true
RAG_GRAPH_CHANNEL_ENABLED=1
RAG_GROUP_BODY_MAX_CHARS=1500
RAG_INTERNAL_HOST=http://127.0.0.1:8000
RAG_MAX_UPLOAD_MB=25
RAG_MMR_LAMBDA=0.60
RAG_TIMEOUT_MS=30000
RAG_TOP_K=12
RAG_TRACE_V1_ENABLED=true
```

Frontend-failis on lisaks järgmiste rühmade võtmed:

- OpenAI konto, mudeli ja runtime'i võtmed;
- `RAG_SERVICE_API_KEY` ning cost-mirror URL/secret;
- RAG-i lubatud MIME-id, üleslaadimise ja kustutamise reeglid;
- lexical-search ning konteksti/ranking'u seaded;
- `AGENT_*` seaded;
- `RESEARCH_*` workeri seaded;
- rakenduse andmebaasi-, autentimise- ja muud frontend-võtmed.

Nende kõigi **nimesid ja lepingut** tuleks tulevikus hoida redigeeritud `.env.example` failis. Päris väärtused peavad jääma ainult serveri salajasse konfiguratsiooni. Käesolev audit ei muuda serveri `.env` faile.

## 13. Administraatori RAG-proxy ja õigused

`app/api/rag/[...path]/route.js` ei ole avatud läbipääs:

- nõuab sisselogitud administraatorit ja vastavat `RagAdminCapability` õigust;
- rakendab kiiruspiirangut;
- kontrollib muutvate päringute same-origin tingimust;
- piirab request body mahtu;
- lisab serveris `X-API-Key`;
- lubab vaikimisi ainult lokaalset RAG-hosti;
- kirjutab haldusoperatsiooni auditisse.

`KNOWLEDGE_STEWARD` saab loetleda/lugeda dokumente, lõike ja lähtefaili, laadida materjale, reindekseerida ning muuta metaandmeid. Kustutamine ja URL-ist ingest nõuavad `PLATFORM_ADMIN` õigust. Toores file/text ingest, otsing ja analüüs on server-to-server rajad, mitte brauseri vaba proxy.

## 14. Andmebaasi RAG-iga seotud mudelid

PostgreSQL ei ole vektorindeksi tehniline tõde, kuid hoiab kasutus- ja auditiandmeid. `prisma/schema.prisma` sisaldab muu hulgas:

- `RagDocument` — administraatori töövoo metaandmed;
- `SourcePackageSnapshot` ja sündmused — kasutatud allikapaketi jälg;
- `SourceFeedback` — allikavigade tagasiside;
- vestlused, sõnumid ja `ConversationRun` — autentitud chat'i käigud;
- `RagEntity`, `RagRelation`, `RagChunkEntity` — graph-lite seosed;
- agentide artefaktide ja lähtedokumentide seosed.

Registri `registry.json`, Chroma indeks, versioonitud lähtefail ning Prisma kirje on eri andmekihid. Ühe olemasolu ei tõenda automaatselt teiste kooskõla.

## 15. Turvapiirid

- RAG teenuse API võti on vähemalt 32 märki ja puuduv konfiguratsioon sulgeb teenuse turvaliselt.
- Võtmeta režiim on lubatav ainult selge `RAG_ALLOW_INSECURE_NO_AUTH=1` seadistuse ja loopback-bind'i kombinatsioonis.
- Faili- ja päringumahud on piiratud.
- MIME kontroll ei usalda ainult faililaiendit.
- PDF/ZIP parsersisenditel on piirid ning parserit saab katkestada.
- URL-ist korje kasutab pinned host/IP reegleid.
- Salvestusteed kontrollitakse, et vältida etteantud juurkaustast väljumist.
- Katkine register ei tohi vaikides muutuda tühjaks registriks; kasutatakse fail-closed/last-good rada.
- Dokumendiversiooni vahetus on etapiline, et ebaõnnestunud ingest ei asendaks töötavat versiooni.
- Agendid tohivad otsida ainult oma lubatud dokumendikogumist.

## 16. Mida on kvaliteedis proovitud

Algne 75 juhtumi kihiline valim:

| plokk | arv |
|---|---:|
| ajakirja faktiküsimused 2016–2026 | 22 |
| sama fakti sõnastusvariandid | 8 |
| autori-/teemapäringud | 10 |
| laiad mitme allika sünteesid | 10 |
| mitteajakirja materjalid | 15 |
| KOV/teenuse/õigusallikad | 10 |
| **kokku** | **75** |

Algse mõõteakna otsene RAG-otsing:

| tulemus | arv |
|---|---:|
| PASS | 51 |
| PARTIAL | 6 |
| FAIL | 18 |

Algse autentitud vestluse 50 sisuliselt hinnatud vastust:

| tulemus | arv |
|---|---:|
| õige | 21 |
| osaline | 3 |
| vale | 26 |

Lisaks tabas viis katset rate-limit'i; ülejäänud 20 juhtumit ei olnud selle mõõteakna jooksul vestluses lõpetatud. Need arvud on algse veaolukorra lähtejoon, mitte viimase deploy tulemus.

## 17. Tõendatud veaklassid

- õige otsing, kuid vestlus jätab tõendi kasutamata;
- sõnastustundlikkus: täpne pikk küsimus töötab, loomulik lühike variant kukub;
- õige dokument, vale lõik;
- arvude segamine eri allikatest või eri uurimustest;
- autori nime ja autori kirjutatud teemade halb järjestus;
- ühe allika domineerimine laias sünteesis;
- vestlusajaloo müra uue küsimuse tõlgendamisel;
- vale või puuduv atribuutika;
- kuvatud allikas ei toeta vastuse konkreetset väidet;
- timeout, `partial` või ebamõistlik lõppvastuse viivitus;
- rate-limit sama autentitud vestluse korduskatsel;
- ajaloolise ja praeguse rolli segamine.

### Kordustõendid

**Lapse perekonnast eraldamine.** Algallika õige arv oli 169 otsust 2018. aastal. Lühike loomulik variant tõi vale arvu 21/2022; täpsem ankurdatud variant leidis 169/2018. See tõendas sõnastustundlikkuse, järjestuse ja vastusekoostamise probleemi.

**Töötamise toetamise uuring.** Õige fakt oli seitse intervjuud: kuus individuaal- ja üks rühmaintervjuu. Üldine küsimus vastas valesti 55; täpsem variant vastas õigesti. Õige registrifakt oli enne parandust alles 23. kohal.

**Laur Raudsoo.** Vastus esitas ajaloolise tegevtoimetaja rolli praeguse identiteedina. Õige sõnastus peab ütlema, et ta oli kunagi ajakirja Sotsiaaltöö tegevtoimetaja, mitte et ta on seda praegu.

## 18. Tehtud parandused

Parandusjada:

- `a478c439`
- `47467f28`
- `75c685a0`
- `5fe14199`
- `da543de4`
- `08cbd94a`

Parandused puudutasid süsteemseid kihte, mitte ühe küsimuse hardcode'i:

- isiku-, autori- ja pealkirjavihjete eristamine;
- registrifakti kandidaadi kasutamine üheselt tuvastatud uuringu puhul;
- hübriidjärjestuse kaalud ja kanaliotsused;
- valitud tõendipaketi säilitamine vastusekoostamiseni;
- ajaloolise rolli ettevaatlikum atribuutika;
- allikate kuvamise sidumine tegelikult kasutatud tõendiga;
- allikapaneeli kujunduse viimine vestluse disainisüsteemiga kooskõlla.

Need parandused ei tähenda veel, et 75/75 juhtumit on toodangus õiged.

### 18.1 Deploy'tud P0-parandused ja esimene autentitud järelkontroll

Pärast koodipõhist juurpõhjuse analüüsi tehti eraldatud worktree's üldised P0-parandused. Need commit'iti SHA-ga `73d381a7febd017bc32d2a8976da60b2b9c9d42a`, lükati omaniku otsese loa alusel `origin/main`-i ja deploy'ti. `origin/main`, serveri HEAD ja autentitud brauseri kasutatud toodang olid järelkontrolli ajal samal SHA-l.

Parandused ei teinud RAG-i 10/10 töökindlaks. Esimene nelja päringu autentitud sama vestluse kontroll andis kaks õiget ja kaks valet tulemust: lapse eraldamise `169 / 2018` fakt säilis kahes sõnastuses, kuid Elin Küti intervjuude küsimus andis ühe vale keeldumise ja ühe enesekindla vale `17 + 6` vastuse.

| P0 plokk | lokaalne muudatus | tõendusseis |
|---|---|---|
| tõendipiir | atribuutika `evidenceText` tuleb nüüd täpselt mudelile renderdatud plokist; trace säilitab konteksti-, algbody- ja renderdatud body hash'id, kärpeoleku ning start/end-offsetid | **CODE_DONE / runtime PARTIAL** — kahel õigel vastusel oli allikanupp, kuid paneel ei avanenud kontrollitavalt |
| mitme päringu järjestus | lisapäringute sundskoorilagi ja `preserveFirstScores` asendati ankurdatud päringuteülese RRF-fusion'iga; täpne lisapäring saab tõusta ainult kontrollitava ankru või päringuteülese kokkulangevuse toel | **CODE_DONE / runtime PARTIAL** — J17/V06 PASS, J11 FAIL |
| faktidokumendi shortlist | pime esimese viie dokumendi piir asendati identiteediskooriga; pealkirja-, autori-, registri- või täpse fraasi ankruga shortlist võib laieneda kuni 12 dokumendini, ankruta varurada jääb viiele | **CODE_DONE / runtime PARTIAL** — täpse pealkirjaga J11 leidis dokumendi kohtadel 1–3, loomulikud parafraasid ei leidnud seda esimese 12 seast |
| arvufakti leping | täpsed arvuküsimused puhverdatakse enne esimese teksti kuvamist; kontroll nõuab arvuliteralide leidumist ühes ja samas renderdatud allikas, eristab küsitud andmeaastat pelgast `source_year` päisest ning kontrollib üldarvu/alamrühma järjekorda | **PARTIAL** — ühiku semantiline samasus ja täielik faktipesade ekstraktsioon puuduvad |

Kandidaat lisab trace'i fusion'i kandidaadid ja põhjused, faktidokumendi shortlist'i identiteediskoorid, täpselt renderdatud konteksti hash'id ning faktivalidaatori otsuse. Nii saab järgmises runtime-katses eristada korje, järjestuse, kontekstivaliku ja vastusekoostamise viga ilma küsimuse sõnu koodi hardcode'imata.

## 19. Automaatväravad ja nende tähendus

Varasema commit'i `08cbd94a` ajal dokumenteeritud automaatväravad olid 50/50 Pythoni sihttesti, 34/34 JavaScripti sihttesti ja 4963/4963 täissviit. Neid faile ega `npm test` skripti praegusel `origin/main`-il enam ei ole. Seetõttu ei esitata vanu rohelisi numbreid praeguse kandidaadi tõendina ning uusi teste, negatiivkontrolle, fixture'e ega probe'e ei loodud.

Deploy'tud kandidaadi kontrollid:

| värav | tulemus |
|---|---:|
| automaattestid | **NOT_RUN / puuduvad** |
| i18n | roheline |
| muudetud JavaScripti failide lint | roheline |
| `rag-service/main.py` süntaks | roheline |
| `git diff --check` | roheline |
| `npm run build` | **BLOCKED** enne kompileerimist: Turbopack ei luba eraldatud worktree välisele `node_modules`-symlinkile ligi |
| sama lõpliku puu `next build --webpack` | **roheline** — kompileerimine, TypeScript ja 70 staatilist lehte läbisid |
| serveri ametlik Turbopacki build | **roheline**, 35,2 s |
| skeem/migratsioon | **NOT_APPLICABLE** — Prisma skeemi ei muudetud |

Need tõendavad koodi staatilist ja kompileerimisvalmidust. Need **ei tõenda** otsingu ega mudeli sisulist vastust päris andmete, päris vestlusajaloo ja päris toodanguindeksi vastu.

## 20. Mis on veel tõendamata

- kogu 75 juhtumi otsene kordus praegusel toodangu commit'il `73d381a7`;
- sama 75 juhtumi autentitud `/vestlus` kordus;
- ülejäänud 72 põhijuhtumit ühes normaalselt jätkuvas vestluses ilma „Uus vestlus” workaround'ita;
- täpne esimese teksti aeg: arvufakti puhverdus näitas ainult lõpptulemust, mis saabus mõõdetud J17/V06 juhtudel umbes 36–41 sekundiga;
- iga vastuse kuvatud allika sisuline toetus;
- allikapaneeli viimane visuaalne kuju päris sisselogitud aknas;
- laiade sünteeside allikate mitmekesisus;
- autori- ja „millest autor on kirjutanud?” ploki täielik kvaliteet;
- mitteajakirja 15 juhtumi täielik vestlusvärav;
- KOV/teenuse/õigusallika 10 juhtumi eraldi värav;
- pika vestluse ajaloomüra;
- korduva kasutuse tegelik rate-limit;
- 863, 864 ja 877 ajakirjadokumendi loenduste täpne semantiline lepitus;
- kohaliku algmaterjali, registri, failisalvestuse ja Chroma täielik üks-ühele terviklus.

## 21. Jääkriskid

- Mudel võib õige tõendi olemasolul ikkagi valida vale arvu või teha liiga kindla järelduse.
- Registrifakti tugevam kaal võib aidata üht fakti, kuid vale metaandme korral suurendada vale kindlust.
- Laia sünteesi puhul võib üks kõrge skooriga allikas teised välja tõrjuda.
- Vestlusajalugu võib lühikest uut küsimust valesti ankurdada.
- `displayed_sources` olemasolu ei taga väite tasemel jälitatavust.
- Kiire esimene token võib varjata 23–35 sekundi lõppvastust või sisulist viga.
- KOV-i ja õigusallikate kehtivus vajab eraldi ajakohasuse kontrolli.
- Paljudel registrikirjetel puudub uus lifecycle või `source_format`; vana ja uue skeemi kooseksisteerimine raskendab arvestust.
- Repos puuduv redigeeritud env-mall teeb tootmise konfiguratsiooni driftimise raskemini märgatavaks.

## 22. Järgmine kontrollijärjekord

1. Kontrollida autentitud aknas allikapaneeli kujundust ja ühe avatud allika tegelikku viiteteksti.
2. **TEHTUD esimese väravana:** lapse eraldamise ja töötamise toetamise küsimus kumbki kahe loomuliku sõnastusega; tulemused vastavalt 2 PASS ja 2 FAIL.
3. Mõõta otsing ja vestlus eraldi: dokument, lõik, kanalid, `partial`, otsinguaeg, esimene tekst, lõppvastus ja koguaeg.
4. Läbida kõik kaheksa parafraasi ning kümme autorijuhtumit.
5. Läbida kümme laia sünteesi, kontrollides allikate mitmekesisust.
6. Läbida 15 mitteajakirja juhtumit.
7. Läbida kümme KOV/teenuse/õigusjuhtumit eraldi otsingurajana.
8. Iga vea puhul korrata vähemalt kahe sõnastusega ja määrata kiht: korje, planner, järjestus, kontekstivalik, vastuse koostamine või atribuutika.
9. Uuendada põhimaatriksit ainult sama muutumatu toodangu-SHA tulemustega.

## 23. DONE / PARTIAL / NOT_PROVEN

Need arvud ei ole töökindluse protsent.

| seis | arv | tähendus |
|---|---:|---|
| DONE | **2/75** | J17 ja V06 vastasid viimase deploy järel õigesti; kuvatud atribuutika on eraldi NOT_PROVEN |
| PARTIAL | **15/75** | 14 muud juhtumit on tõendatud ainult kandidaadi otsingukihis; J11 mõõdeti end-to-end ja kukkus läbi |
| NOT_PROVEN | **58/75** | viimase commit'i ülejäänud otsingu- ja vestluskordus puudub |

## 24. Lõpphinnang

SotsiaalAI-l on päris hübriidne, versioonitud ja turvapiiridega RAG-süsteem: eraldi FastAPI teenus, Chroma indeks, JSON-register, versioonitud dokumendifailid, mitmekanaliline otsing, planner, kontekstivalik, tõendipaketid, atribuutika ja autentitud vestlusliides.

Süsteemi tehniline olemasolu on tõendatud. Algse kvaliteediseirega on tõendatud mitu süsteemset viga ning nende vastu tehtud P0-parandused on nüüd toodangus commit'il `73d381a7`. Deploy-järgne kontroll tõendas lapse eraldamise fakti paranemist, kuid Elin Küti juhtum paljastas endiselt loomuliku parafraasi korje-, planner'i- ja kontekstivaliku vea. Terviklik sisuline töökindlus on seetõttu **NOT_PROVEN**, kuni sama muutumatu commit läbib nii otsese otsingu kui ka autentitud vestluse ning allikad toetavad vastuse väiteid.

Hetkehinnang: **PARTIAL, mitte 10/10**.
