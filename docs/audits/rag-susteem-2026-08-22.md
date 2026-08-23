# SotsiaalAI RAG-süsteemi tehniline kaart ja kvaliteediseire hetkeseis

Kuupäev: 22.08.2026
Tööharu: `codex/rag-quality-repair-20260822`
Varasem toodangusse viidud RAG-paranduste lähtecommit: `08cbd94ac86597911e22e3731ee812c717f04110`
Praegune brauseris kontrollitud sisulise RAG- ja vestlusloogika baasseis: `815f15f6`; 23.08 jõudlusparanduse runtime-release oli `5796178f`. Hilisem dokumentatsiooni commit ei nimeta runtime-tõendit enda tõendiks.
Põhjusepõhiste paranduste viimane jätk jõudis toodangusse commit'ijadana `15fc81a3` → `8b4f4d69` → `bdaa8afd` → `2b0bd86` → `429469dd` → `56b4a13d` → `d7c35346` → `815f15f6`. V04 ja kümme autorijuhtumit läbisid end-to-end värava; kogu 75 juhtumi lõppvärav ei ole tehtud.
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

Varasema commit'i `08cbd94a` ajal dokumenteeritud 4963-testist täissviiti praeguses repos enam ei ole ning selle ajaloolist rohelist tulemust ei esitata praeguse RAG-i tõendina. Omaniku hilisema selge juhise järgi lisati kitsas püsiv RAG-regressioonikomplekt `tests/rag/rag-regressions.test.mjs`, mida käivitab `npm run test:rag-regression`. See kaitseb ainult tõendatud RAG-lepinguid ega taasta vana üldist testitaristut.

Regressioonikomplektis on 23 deterministlikku kontrolli: allikaviite leheküljevahemikud; faktiküsimuse planner ja tema õigus/KOV/autori/sünteesi negatiivpiirid; uuringudokumendi identiteet ja fail-closed viik; eaka/vanemaealise teemaühtlus; andmeaasta ja allika-aasta eristus; arvsõnade normaliseerimine; eri allikate arvude segamise keeld; kestuse eristus kalendriaastast; mitme faktipesa kontroll; valitud ja kuvatud source ID võrdsus. Uued kontrollid olid enne vastavaid parandusi kahes plokis 4/19 ja 4/23 punased ning parandatud puul 23/23 rohelised.

Deploy'tud kandidaadi kontrollid:

| värav | tulemus |
|---|---:|
| püsiv RAG-regressioonikomplekt | **38/38 PASS** |
| negatiivtõend | esimese lisaploki vana käitumine **4/19 FAIL**; teise lisaploki vana käitumine **4/23 FAIL** |
| i18n | roheline |
| muudetud JavaScripti failide lint | roheline |
| `rag-service/main.py` süntaks | roheline |
| `git diff --check` | roheline |
| `npm run build` | **BLOCKED** enne kompileerimist: Turbopack ei luba eraldatud worktree välisele `node_modules`-symlinkile ligi |
| sama lõpliku puu `next build --webpack` | **roheline** — kompileerimine, TypeScript ja 70 staatilist lehte läbisid |
| serveri ametlik Turbopacki build | **roheline** viimastel RAG-deploy'del |
| skeem/migratsioon | **NOT_APPLICABLE** — Prisma skeemi ei muudetud |

Need tõendavad koodi staatilist ja kompileerimisvalmidust. Need **ei tõenda** otsingu ega mudeli sisulist vastust päris andmete, päris vestlusajaloo ja päris toodanguindeksi vastu.

## 20. Mis on veel tõendamata

- kogu 75 juhtumi otsene kordus praegusel toodangu commit'il `771795e2`;
- sama 75 juhtumi autentitud `/vestlus` kordus;
- ülejäänud 67 põhijuhtumit ühes normaalselt jätkuvas vestluses ilma „Uus vestlus” workaround'ita;
- täpne esimese teksti aeg ülejäänud juhtumites; parafraasiploki lõppajad jäid ligikaudu 7,4–39 sekundi vahele;
- iga vastuse kuvatud allika sisuline toetus;
- allikapaneeli käitumine ja viitetekst kõigi juhtumiklasside päris sisselogitud vastustel;
- laiade sünteeside allikate mitmekesisus;
- autori- ja „millest autor on kirjutanud?” ploki täielik kvaliteet;
- mitteajakirja 15 juhtumi täielik vestlusvärav;
- KOV/teenuse/õigusallika 10 juhtumi eraldi värav;
- pika vestluse ajaloomüra;
- korduva kasutuse tegelik rate-limit;
- 863, 864 ja 877 ajakirjadokumendi loenduste täpne semantiline lepitus;
- kohaliku algmaterjali, registri, failisalvestuse ja Chroma täielik üks-ühele terviklus.

## 21. Jääkriskid

- Mudel võib õige tõendi olemasolul ikkagi anda vale arvuseose: V04 muutis `2% (n=100)` ekslikult 100 inimese valimiks ja väitis sellest tuletatud kahte inimest.
- Praegune faktivalidaator kontrollib arvude olemasolu ja ühe allika piiri, kuid mitte veel täielikku tuplit `protsent + n + sihtrühm + mõõdik + aeg`.
- Registrifakti tugevam kaal võib aidata üht fakti, kuid vale metaandme korral suurendada vale kindlust.
- Laia sünteesi puhul võib üks kõrge skooriga allikas teised välja tõrjuda.
- Vestlusajalugu võib lühikest uut küsimust valesti ankurdada.
- `displayed_sources` olemasolu ei taga väite tasemel jälitatavust.
- Kiire esimene token võib varjata 23–35 sekundi lõppvastust või sisulist viga.
- KOV-i ja õigusallikate kehtivus vajab eraldi ajakohasuse kontrolli.
- Paljudel registrikirjetel puudub uus lifecycle või `source_format`; vana ja uue skeemi kooseksisteerimine raskendab arvestust.
- Repos puuduv redigeeritud env-mall teeb tootmise konfiguratsiooni driftimise raskemini märgatavaks.

## 22. Järgmine kontrollijärjekord

1. **TEHTUD:** allikapaneeli leheküljevahemikud, dialoogipiir, Escape ja fookuse taastamine on kontrollitud; JAWS jääb `NOT_PROVEN`.
2. **TEHTUD:** kõik kaheksa parafraasi läbiti samas autentitud vestluses; 7/8 PASS, V04 FAIL.
3. Parandada V04 põhjuse tasemel: numbriliste ankrutega kandidaadi recall ning struktureeritud protsendi/`n`/sihtrühma faktituplite kontroll.
4. Korrata V04 vähemalt kahe sõnastusega ning nõuda nii õiget sihtlõiku kui semantiliselt õiget vastust.
5. Läbida kümme autorijuhtumit.
6. Läbida kümme laia sünteesi, kontrollides allikate mitmekesisust.
7. Läbida 15 mitteajakirja juhtumit.
8. Läbida kümme KOV/teenuse/õigusjuhtumit eraldi otsingurajana.
9. Uuendada põhimaatriksit ainult sama muutumatu toodangu-SHA tulemustega.

## 23. DONE / PARTIAL / NOT_PROVEN

Need arvud ei ole töökindluse protsent.

| seis | arv | tähendus |
|---|---:|---|
| DONE | **10/75** | J11 faktiküsimus ja parafraas, J17 ning V01, V02, V03, V05, V06, V07 ja V08 läbisid õige tõendi, vastuse ja toetava kuvatud allika värava |
| PARTIAL | **11/75** | kümme juhtumit on tõendatud ainult otsingukihis; V04 otsing, vastus, faktivärav ja kuvatud source ID on õiged, kuid allikapaneeli UI jäi tõendamata |
| FAIL | **0/75** | lõpp-SHA kordusplokis ei ole alles tõendatud valet vastust; mõõtmata juhtumid ei ole seetõttu rohelised |
| NOT_PROVEN | **54/75** | lõpp-SHA ülejäänud otsingu- ja autentitud vestluskordus puudub |

FAIL on eraldi, et vale vastus ei paistaks osalise ega mõõtmata tulemusena. Kõigi olekute summa on 75.

## 24. Lõpphinnang

SotsiaalAI-l on päris hübriidne, versioonitud ja turvapiiridega RAG-süsteem: eraldi FastAPI teenus, Chroma indeks, JSON-register, versioonitud dokumendifailid, mitmekanaliline otsing, planner, kontekstivalik, tõendipaketid, atribuutika ja autentitud vestlusliides.

Süsteemi tehniline olemasolu on tõendatud. Algse kvaliteediseirega on tõendatud mitu süsteemset viga ning nende vastu tehtud P0-parandused on nüüd toodangus lõpp-SHA-l `66355272`. Deploy-järgne kontroll tõendas parafraasiplokis 8/8 sisuliselt õiget vastust; V04 valitud ja kuvatud source ID kattusid, kuid selle allikapaneeli UI jäi automatiseeritud katses avamata. Terviklik sisuline töökindlus on endiselt **NOT_PROVEN**, kuni sama muutumatu commit läbib kogu 75 juhtumi otsese otsingu ja autentitud vestluse ning iga kuvatud allikas toetab vastuse väiteid.

Hetkehinnang: **PARTIAL, mitte 10/10**.

## 25. J11 teine P0-plokk — toodangus tõendatud

22.08 õhtul lisatud süsteemne `specific_research_fact` rada on nüüd toodangus lõpp-SHA-l `735ff8375377071807acb14ea052f47562cefe77`. `origin/main`, server ja autentitud brauser olid kontrolli ajal samal SHA-l; kolm teenust olid aktiivsed ning RAG health näitas 49 727 vektorit ja 6089 dokumenti. Korpust ega indeksit selle paranduse käigus ei muudetud.

Runtime tõendas kaks järjestikust juurpõhjust. Esmalt blokeeris õige Elin Küti artikli dokumendiidentiteedi kolme sama sõnavaraga sotsiaalhoolekande seaduse paragrahvi ühepunktiline skoorivahe. Uuringu faktirežiim välistab nüüd õigusallika uuringudokumendi identiteedi konkurendina, jättes õigusotsingu enda puutumata. Seejärel lükkas faktivärav õige mudelivastuse tagasi, sest `seitse`, `kuus` ja `üks` ei olnud numbrikujudega võrreldavad. Täpne faktivärav normaliseerib nüüd eesti põhiarvsõnu ja käändevorme nii tõendis kui vastuses.

Samas autentitud vestluses ilma „Uus vestlus” workaround'ita vastas lühike küsimus õigesti 7/6/1 intervjuud (esimene sisuline tekst 18 719 ms, lõpp 19 897 ms) ning Elin Küti nimega parafraas samuti õigesti (9942 / 11 143 ms). Lühikese vastuse trace kinnitas kõrge kindlusega sama dokumendi identiteeti ja `all_claims_in_one_rendered_source` tulemust väidetele 7, 6, 1 ja 3. Mõlema ainsaks valitud ja kuvatud allikaks oli Elin Kütt, 2016, „Sotsiaaltöötajate tööalase toetuse kogemused”, Sotsiaaltöö 3/2016, lk 64–68, Uurimus. Algallikas kinnitas ka vastuses nimetatud osalejad.

Kontrollid selles J11 etapis: muudetud JavaScripti lint, i18n ja `git diff --check` rohelised; tollal automaatteste ei olnud ega loodud. Hilisem püsiv RAG-regressioonikomplekt on kirjeldatud peatükkides 19 ja 27. Lokaalne Turbopack jäi enne kompileerimist välise `node_modules`-symlingi taha, kuid serveri ametlik Turbopack-build kompileerus lõppdeploy'l 37,7 sekundiga, TypeScript ja 70 staatilist lehte läbisid ning migratsioone ei olnud.

Lõppseis on endiselt **PARTIAL, mitte 10/10**. J11 kaks vormi on DONE, kuid kogu 75 juhtumi lõpp-SHA kordus, laiad sünteesid, autoriplokk, mitteajakirja materjalid, KOV/õigusrajad ja pika vestluse jõudlus ei ole sama muutumatu puu vastu täielikult tõendatud.

## 26. J17/V06 jääkparandus — toodangus tõendatud

J17 allikapaneeli kontrolli järel kukkus V06 commit'il `d29571bd` uuesti läbi kahe sõnastusega. Loomulik küsimus läks õigesse `specific_research_fact` režiimi ja otsene `/search` tõi õige artikli ette, kuid dokumendiidentiteedi ühepunktiline `9 : 8` vahe kuulutati ebamääraseks. Kompaktne „teema: arv ja aasta?” kuju läks üldrajale; mudeli valed arvud peatas faktivalidaator ning kasutaja nägi vale keeldumist.

Commit `7f3aa503fe5f54a92d4b9c04cf017e8987decae3` lisab kaks üldist lepingut: vähemalt kahe teematermini unikaalne pealkirjaedu võib lahendada ühepunktilise identiteedivahe, kuid päris samaväärne konflikt jääb fail-closed; vähemalt kahe teema- ja kahe faktipesaga kompaktne kuju saab ühe uuringu faktiraja, kui tegu ei ole õigus-, KOV-, teenuse- või toetuspäringuga. Lapse eraldamise sõnu ega arve koodi ei lisatud.

Serveri ametlik Turbopack-build läbis 36,0 sekundiga, migratsioone ei olnud ja indeks jäi muutmata. Järelkontroll tehti samas autentitud vestluses ilma „Uus vestlus” workaround'ita:

| juhtum | tulemus | esimene tekst / lõpp | tõend |
|---|---|---:|---|
| V06 loomulik | `169 / 2018` | 25 202 / 26 718 ms | identiteet `high`, `all_claims_in_one_rendered_source`, üks valitud ja kuvatud Merli Lauri artikkel |
| V06 kompaktne | `169 / 2018`, artikli 2022 aasta õigesti eristatud | 25 534 / 27 092 ms | `compact_single_research_fact_shape`, sama ühe allika faktivärav |
| J17 | `169 / 2018` | 15 935 / 17 492 ms | faktivalidaator PASS, valitud=kuvatud, sama Merli Lauri artikkel |

Kõigi kolme vastuse paneel avati ning põhiline `Escape`-sulgemine töötas; JAWS ja kogu paneeli üldine ligipääsetavus jäävad `NOT_PROVEN`. Selle etapi leheküljenumbrite sorteerimisviga parandati hiljem commit'is `faf6ff14`. Selle peatüki `DONE 4/75` oli vahepealne ajalooline seis, mille asendab peatüki 23 praegune release-arvestus.

## 27. Parafraasiplokk ja püsiv regressioonivärav — SHA `771795e2`

Kaheksa parafraasi läbiti samas autentitud vestluses ilma „Uus vestlus” workaround'ita. V01, V02, V03, V05, V06, V07 ja V08 läbisid õige vastuse ning toetava kuvatud allika värava. V02 ja V05 korrati kahe loomuliku sõnastusega. V04 ebaõnnestus kahel eri viisil: lühivormis ei jõudnud õige 2025. aasta artikkel kandidaatide sekka; pikem vorm leidis õige artikli, kuid vastus tõlgendas `2% (n=100)` valesti 100 inimese valimiks ja tuletas sellest kaks inimest. Faktivalidaator läbis vale vastuse, sest kõik arvutokenid leidusid samas renderdatud allikas.

See on tõendatud süsteemne piir, mitte metaandme- ega sõnastusviga. Järgmine parandus peab modelleerima protsendi, `n`, sihtrühma, mõõdiku ja aja rolle ning eraldi parandama numbriliste ankrutega lühiküsimuse kandidaatide recall. Täpne maatriks, vastused, allikad ja ajad on kvaliteediseirefailis.

Repo sisaldab nüüd omaniku loal kitsast püsivat regressioonikomplekti: `npm run test:rag-regression` läbib 23/23. See kaitseb tõendatud lepinguid, kuid ei ole 75 juhtumi ega päris mudelivastuste asendus. `771795e2` vastu läbisid ka muudetud JavaScripti lint, `git diff --check`, lokaalne Webpacki tootmisbuild ja serveri ametlik Turbopack-build; migratsioone ei olnud.

22.08 kell 20:40:16 UTC mõõdeti käsuga, et kohalik HEAD, `origin/main` ja server olid SHA-l `771795e2c2b3f74ea8362e1cd9bbd4ba8729d3d0`, serveri tööpuu oli puhas, frontend/RAG/research-worker aktiivsed, `/vestlus` vastas 200 ning RAG health oli `ok`, 49 727 vektorit / 6089 dokumenti. Korpust, indeksit, andmebaasi ega serveri keskkonda selles paranduste jadas ei muudetud.

## 28. V04 arvusemantika ja dokumendisisene recall — toodangus sisuliselt tõendatud

V04 varem tõendatud kaks veateed parandati üldiste lepingutega. Uuringu liitsõna ei tohi enam peita teematerminit; kõrge kindlusega tuvastatud dokumendis tehakse küsitud arvuliste ankrute järelotsing; kolme protsendi küsimus nõuab just küsitud protsente; `X% (n=Y)` säilib protsendi ja loenduse paarina ning järgmisse lausesse viidud valimitõlgendus või uus tuletatud inimeste arv lükatakse tagasi. Lühike protsentidega küsimus läbib nüüd samuti faktivalidaatori. V04 sõnu, autoreid ega vastuseid koodi ei hardcode'itud.

Lõpp-SHA `663552723` vastu vastas sama autentitud vestlus ilma „Uus vestlus” workaround'ita õigesti kahel kujul. Lühivorm säilitas 10% = 640, 6% = 227 ja 2% = 100 ning eristas haldusandmed ohvriuuringust (36 269 / 36 289 ms). Pikk loomulik vorm sidus 2023. aasta 10%/640 ja 6%/227 näidud eraldi 2024. aasta ohvriuuringu 2%/100 näidust (33 376 / 33 395 ms). Mõlema trace oli `all_claims_in_one_rendered_source`; valitud, vastuse aluseks olnud ja kuvatud source ID oli sama Anu Lepsi ja Lenne Indovi 2025 artikkel.

Lõppkoodil läbis kitsas püsiv regressioonikomplekt 38/38, lint, i18n, diff-kontroll, lokaalne Webpack-build ja serveri Turbopack-build. Server, kohalik HEAD ja `origin/main` olid samal SHA-l; kolm teenust olid aktiivsed ning health oli 49 727 / 6089. Korpust, indeksit, andmebaasi ega serveri keskkonda ei muudetud.

V04 jääb range release-värava järgi **PARTIAL**, sest nähtav ja aktiivne allikanupp ei avanud automatiseeritud lõppkatses kontrollitavat paneeli, kuigi andmebaasi kuvatud source ID oli õige. Samuti on 33–36 sekundit lühikese faktivastuse jaoks ebamõistlik. Üldseis on **DONE 10/75 · PARTIAL 11/75 · FAIL 0/75 · NOT_PROVEN 54/75**, mitte 10/10.

## 29. Allikapaneel, autorivärav, prompt cache ja külma retrieval'i mõõtmine — SHA `815f15f6`

23.08 jätkus tõendati samas autentitud `/vestlus` vestluses ilma „Uus vestlus” workaround'ita V04 allikapaneel ja kümme autorijuhtumit. Sõnumimulli hover teeb tegevusnupud nähtavaks; klaviatuurifookuse ning aktiveerimise järel avanenud V04 paneel kuvas sama Anu Lepsi ja Lenne Indovi 2025 artiklit, mille source ID oli trace'is valitud, vastuse aluseks ja kuvatud. Source-objekt ja paneeli state olid seega korras; varasem `panelTitleCount=0` kirjeldas puudulikku interaktsiooniteed, mitte puuduvat allikat. V04 viimane vastus läbis `exact_numeric_fact_v2` värava ja säilitas õiged seosed 10%/640, 6%/227, 2%/100 ning 2023/2024. V04 on nüüd **DONE**.

Autoripäringu loomulik täisnimi tuvastatakse planner'is ja suunatakse täpsesse metadata author-välja otsingusse enne üldist semantilist rada; see ei ole chunki vabateksti nimeotsing. Kümme algallikatest koostatud juhtumit Krister Tüllineni, Maarja Krais-Leoski, Kadi Lubi, Ave Rootsi, Jane Soki, Liina Kriiski, Kadri Soo, Merle Kriisa, Heli Raudla ja Judit Strömpli kohta läbisid sisulise vastuse ning avatud toetava allikapaneeli värava. Kaasautorlusega kirje lühisilt võib näidata esimest autorit, kuid metadata ja source-objekt säilitasid küsitud autori täpse vaste. Maarja nime kõrge riskiga õigusrajale saatnud lai `maar*` vaste piirati päris „määr” nimisõna käänetega. Tulemuseks on **10/10 autoriplokk**, mitte kogu RAG-i 10/10.

Iga kasutaja saatmine teeb uue Responses API päringu ja värske RAG-otsingu. Täielik uus küsimus ei päri automaatselt eelmise vastuse teemat; lähiajalugu lisatakse ainult kontekstist sõltuvale lühikesele jätkuküsimusele. Stabiilne süsteemiprompt on nüüd eksplitsiitse cache-breakpoint'i ees, dünaamiline RAG-kontekst selle järel. Toodangus kirjutas esimene päring 1896 cache-tokenit; järgmised sama kasutaja, rolli, keele ja kriisirežiimi võtmega päringud lugesid 1896 ning kirjutasid 0. Cache vähendab seega stabiilse prefiksi sisendikulu, kuid ei taaskasuta vana RAG-vastust ega seo uut autorit vana teemaga.

Markdowni järjestatud loendi parser säilitab nüüd iga lõigu eksplitsiitse algusnumbri. Pesastatud täpploendiga eraldatud A07 ja A10 kolm artiklit renderdusid brauseris `<ol>`, `<ol start="2">`, `<ol start="3">`, mitte kolm korda numbriga 1.

Etapilogimine eristab paralleelsete retrieval-alampäringute summa tegelikust seinakella ajast. V04 viimane voor võttis 13 565 ms: retrieval 11 331 ms, retrieval'iga konteksti koostamine 11 411 ms, mudel 2084 ms, faktivalidaator 10 ms ja salvestus 9 ms. Ka autoriploki esimene voor pärast deploy'd näitas retrieval'i 12–14 s; soojad autorivoorud jäid 1,3–2,1 s retrieval'i vahemikku. Tõendatud jääkpudelikael on külm otsingukiht. Selle järgmine parandus vajab kontrollitud külma/sooja mõõtepaari; mudelit või faktiväravat ei muudeta kiiruse nimel.

AGENTS.md uue korra järgi automaatteste ei loodud ega käivitatud. Muudetud koodifailide lint, i18n, `git diff --check` ja muutumatu lõppkoodi tootmisbuild olid rohelised. Korpust, indeksit, andmebaasi ega serveri keskkonda ei muudetud. Lõppkoodi kontrolli ajal olid kohalik HEAD, `origin/main` ja server SHA-l `815f15f6`; frontend, RAG ja research-worker olid aktiivsed ning health oli 49 727 vektorit / 6089 dokumenti.

Peatüki 23 varasemat release-arvestust asendab:

| seis | arv | tähendus |
|---|---:|---|
| DONE | **21/75** | varasemad kümme DONE juhtumit, V04 ja kümme autorijuhtumit läbisid end-to-end värava |
| PARTIAL | **0/75** | V04 paneel ja autoriploki vastamiskiht on tõendatud |
| FAIL | **0/75** | praeguse kordusploki sees pole alles tõendatud valet vastust |
| NOT_PROVEN | **54/75** | ülejäänud juhtumite sama release'i otsingu- ja autentitud vestluskordus puudub |

Kogu RAG-i sisuline töökindlus on endiselt **NOT_PROVEN**; 21/75 ei ole kvaliteediprotsent ega 10/10 hinnang.

## 30. Külma retrieval'i, deploy-mälu ja ketta põhjusepõhine optimeerimine — runtime-release `5796178f`

Kontrollitud täisdeploy tõendas, et esimese lihtsa autoripäringu 9935 ms retrieval'ist kulus 7837 ms Chroma dense-rajal; vahetu soe kordus oli 1922/229 ms. Ühe tulemusega naiivne startup-päring ei katnud toodangu `n_results=64` ja filtritega rada. Lõplik RAG startup-warmup loeb persisted kogust ühe olemasoleva embedding'u ning teeb 64 kandidaadiga üld- ja dokumendifiltriga kontrollpäringu enne ready-olekut. Ta ei kutsu embedding API-t, ei muuda korpust ega indeksit ega taaskasuta vana kasutajavastust.

Pärast parandust võttis esimene täisdeploy-järgne autoripäring brauseris 7095 ms: retrieval 2433 ms, dense 263 ms, embedding 777 ms ja mudel 3705 ms. Vahetud A/B päringud olid retrieval'is 1848 ja 1700 ms. Seega langes tõendatud külm retrieval 9,94 sekundilt 2,43 sekundile ja täitis praktilise kuni 5 s sihi; sama jada ei ole p50/p95 koormusmõõtmine.

V04 on eraldi kuue dokumendisisese tõendipäringu rada. Ohutu kolme kaupa käivitusega võttis viimane autentitud kordus brauseris 15 696 ms, retrieval 10 491 ms, mudel 3900 ms ja faktivalidaator 8 ms; vastus ning avatud paneeli Anu Lepsi 2025 allikas olid õiged. Kuue korraga päringu katse halvenes retrieval'is 17 056 ms ja brauseris 21 702 ms-ni, sest dense-alampäringute summa kasvas Chroma/SQLite'i konkurentsis 41 810 ms-ni. Katse võeti tagasi commit'is `5796178f`. See välistab edasise „rohkem paralleelsust” lahenduse; järgmine töö peab mõõdetult vähendama dubleerivat päringutööd või kasutama batch'i, säilitades kõik faktid ja allika.

Serveri RAM-i ei suurendatud. Varem oli kernel OOM-is tapnud uvicorn'i umbes 3,38 GiB anonüümse RSS-i juures. Deploy hooldusvärav runtime-maskib frontend'i ning peatab build'i ajaks frontend'i, RAG-i ja research-workeri; mõõdetud vaba mälu tõusis build'i ajal 5,3 GiB-ni. Teenused taastatakse alles valmis build'i ja RAG health'i järel. Nii ei võistle mitme gigabaidine RAG indeks enam Next.js build'iga sama 6,8 GiB RAM-i pärast.

Kettal kasutati algselt 8,5 GiB 105 taastatava `.next` deploy-artefakti hoidmiseks. Omaniku säilitusotsuse järel eemaldati kõik aegunud frontend-artefaktid, neli ajaloolist RAG/Chroma snapshot'i, vana 591 MiB RAG-puu, 768 MiB juulikuu Chroma koopia, Playwrighti 1,3 GiB brausericache, `.next` build-cache'id ning aegunud npm-, pip-, Prisma-, apt-, audit-, hotfix- ja eeldeploy-failid. Aktiivseid `.next` runtime-faile, korpust, indeksit, andmebaase, Dangerzone'i failipuhastust ega LiveKiti/OSRM-i konteinereid ei eemaldatud. 48 GiB juurketta kasutus langes 96%-lt 57%-ni ja vaba ruum kasvas umbes 2 GiB-lt 21 GiB-ni.

Alles on üks terviklikult kontrollitud RAG-snapshot `/var/backups/sotsiaalai-rag-current-20260823T112112Z.tar.zst` (1,4 GiB; zstd-, tar- ja SHA-256 kontroll läbitud) ning üks taasteloendiga kontrollitud värske PostgreSQLi custom-dump iga aktiivse andmebaasiga saidi kohta: SotsiaalAI, RAIO, Avasta ja Beyondframes. Marta Raudsoo muutuvast JSON-sisust on üks terviklik hetkekoopia; Kaljo Simsoni aktiivne sisu on Git-seed, sest serveris eraldi admini local-faili polnud. Journali maht on 486 MiB ja püsiv piir 512 MiB / 14 päeva / vähemalt 5 GiB vaba kettaruumi; PM2 logid roteeruvad iga päev kuni seitsme koopiani. Deploy säilitab edaspidi ühe uusima frontend-artefakti ja ühe uusima build-logi. RAM-i ei suurendatud: madala koormuse ajal oli 6,8 GiB-st 3,8 GiB saadaval ning `vm.swappiness=10` vähendab aktiivsete rakenduslehtede enneaegset swap'i viimist.

Automaatteste ei loodud ega käivitatud. Staatiline värav oli lint, i18n, `git diff --check`, Python compile ja tootmisbuild; runtime-värav oli käsitsi sama autentitud vestlus. Range RAG-seis ei muutunud: **DONE 21/75 · PARTIAL 0/75 · FAIL 0/75 · NOT_PROVEN 54/75**.
