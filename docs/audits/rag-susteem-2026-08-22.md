# SotsiaalAI RAG-süsteemi tehniline kaart ja kvaliteediseire hetkeseis

Loodud: 22.08.2026
Viimati uuendatud: 25.08.2026
Tööharu: `codex/rag-quality-75`
Aktiivne mõõdetud RAG-koodirelease: `cc9ec8de33de900453183191f1c37edf2778adc6`

Viimases mõõtmises kattusid kohalik HEAD, `origin/main` ja puhas serveri checkout sellel SHA-l;
frontend, RAG ja research-worker olid aktiivsed, `/vestlus` vastas HTTP 200, RAG health oli
`ok=true` (49 727 vektorit / 6089 registrikirjet) ning püsiv FTS5 indeks oli `ready=true`
(49 727 lõiku / 6073 aktiivset registridokumenti). Kontaktikontrolli timer oli aktiivne ja lubatud,
viimane teenuse tulemus `success` ning järgmine käik 30.08.2026.

Release `cc9ec8de` on diagnostiline, mitte 75/75 sertifitseerimisrelease: J08 õige dokument ja
allikakomplekt jõuavad vastuseni, kuid faktivärav blokeerib tulemuse endiselt ekslikult. Ajalooline
kumulatiivne maatriks on **DONE 21/75 · NOT_PROVEN 54/75**; need PASS-id ei kandu uuele SHA-le
automaatselt. Release'ide ajalugu ja tõendipiirid on peatükkides 25–39.

Seis: **PARTIAL — süsteemi ei ole tõendatud 10/10 ega 75/75 töökindlaks**

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
5. **vastuse koostamine ja faktivärav** — valitud tõendi lisamine mudeli konteksti, mudelivastus, täpse fakti kontroll, allikapaketid ja atribuutika;
6. **kasutajaliides** — autentitud sama vestlus, vastuse voogedastus ja kuvatud allikad.

Seetõttu ei tõenda ükski järgmistest eraldi kogu RAG-i töökindlust:

- teenuse `health=ok`;
- õige pealkirja leidmine;
- `partial=false`;
- 49 727 vektorlõigu olemasolu;
- staatilise või ajaloolise regressioonikontrolli roheline tulemus;
- otsese `/search` päringu edu;
- kiire esimene tekst;
- allikakaardi kuvamine.

Töökindluse jaoks peab sama juhtum läbima nii otsingu kui ka autentitud vestluse: õige fakt peab olema valitud kontekstis, vastuses õigesti kasutatud ja kuvatud allikaga toetatud.

## 2. Toodangu tegelik topoloogia

```mermaid
flowchart LR
    U[Autenditud kasutaja /vestlus] --> N[Next.js frontend]
    U --> RT[Realtime transcription<br/>gpt-4o-mini-transcribe]
    RT --> C
    N --> C[/api/chat]
    C --> P[questionPlan, queryPlan ja retrieval orchestration]
    P --> R[RAG FastAPI 127.0.0.1:8000]
    R --> CH[Chroma vektorindeks]
    R --> LX[SQLite FTS5 leksikaalindeks]
    R --> RG[registry.json]
    R --> DS[versioonitud dokumendifailid]
    R --> O[OpenAI embeddings]
    P --> E[Valitud tõendiaknad ja retrieval trace]
    E --> M[OpenAI vastusemudel]
    M --> F[factContract ja sourceAttribution]
    F --> DB[PostgreSQL vestlused, jooksud ja allikapaketid]
    F --> UI[Vastus ja displayed_sources]
    UI --> TTS[TartuNLP kylli<br/>eesti vastus]
    UI --> BST[brauseri speech synthesis<br/>vene/inglise vastus]
    TTS --> U
    BST --> U
```

### 2.1 Serveriprotsessid

| teenus | töökaust | käivitus | konfiguratsioon |
|---|---|---|---|
| `sotsiaalai-frontend.service` | `/home/ubuntu/apps/sotsiaalai` | `/usr/bin/npm run start` | `/etc/sotsiaalai/frontend.env` |
| `sotsiaalai-rag.service` | `/home/ubuntu/apps/sotsiaalai/rag-service` | uvicorn `main:app --host 127.0.0.1 --port 8000 --workers 1` | `/etc/sotsiaalai/rag.env` |
| `sotsiaalai-research-worker.service` | `/home/ubuntu/apps/sotsiaalai` | `/usr/bin/npm run research:worker` | `/etc/sotsiaalai/frontend.env` |

RAG-teenus ei ole avalikult internetti binditud. Frontend pöördub selle poole loopback-aadressil.
Viimases mõõtmises olid frontend, RAG ja research-worker aktiivsed ning avalik `/vestlus` vastas
HTTP 200.

### 2.2 Toodangu mõõdetud seis

| kontroll | tulemus |
|---|---|
| aktiivne RAG-koodirelease | `cc9ec8de33de900453183191f1c37edf2778adc6` |
| kohalik HEAD / `origin/main` / serveri HEAD viimases kontrollis | sama SHA; serveri checkout puhas |
| teenused | frontend, RAG ja research-worker `active` |
| avalik vestlusrada | `/vestlus` HTTP 200 |
| RAG health | `ok=true`, 49 727 vektorit, 6089 registrikirjet |
| püsiv leksikaalindeks | `ready=true`, FTS5 v2, 49 727 lõiku / 6073 aktiivset dokumenti |
| indeksi põlvkond | registri oodatud SHA-256-ga võrdne |
| indeksi fail | 459 132 928 baiti ehk 437,9 MiB |
| kontaktikontrolli timer | `active` + `enabled`; viimane `Result=success`; järgmine käik 30.08.2026 |
| aktiivse release'i sisuline värav | J08 `FAIL`: õige allikas, kuid faktivärava vale `unsupported_numeric_category_relation` |
| aktiivsed vektorlõigud | **49 727** |
| registrikirjeid kokku | **6089** |
| registris `ACTIVE` elutsükkel | **884** |
| registris `DELETED` elutsükkel | **16** |
| vana kirje ilma lifecycle-väljata | **5189** |

`documents=6089` tähendab registrikirjete koguarvu, mitte aktiivsete failide arvu. Seda arvu ei tohi esitada kui „6089 aktiivset dokumenti”.

## 3. Küsimuse teekond

1. Kasutaja saadab küsimuse autentitud `/vestlus` lehel; kliendi vestlushook teeb `POST /api/chat`.
2. `requestBootstrap` kontrollib seanssi, privaatsust, vestluse omandit, rolli, kvooti,
   kasutusreservatsiooni, ajalugu ja kriisipiiri. Dokumendi-, abi- ja puhta tervituse töövood võivad
   siin minna oma kontrollitud harusse.
3. `retrievalContextAssembler` ühendab keele- ja riskiplaani `questionPlanner`-i struktureeritud
   küsimuse-/vastuse-intendiga. `queryPlanner` ja `retrievalStrategySelector` koostavad päringud,
   filtrid, top-k ning kontekstivaliku plaani ja annavad `retrievalOrchestrator`-ile ühe või mitu
   piiratud päringut.
4. Orchestrator kutsub serverisiseselt RAG-i `POST /search`. Python-teenus käivitab lubatud dense-,
   FTS5/BM25-, autori-, pealkirja-, täpse fraasi ja vajadusel registrifakti kanali, fuseerib ning
   hübriidjärjestab lõigukandidaadid.
5. Next.js ühendab mitme päringu kandidaadid, eemaldab duplikaadid, rühmitab need `ragContext.js`-is
   ning rakendab dokumendiidentiteedi, õigus-, kontakti- ja arvutõendi erivaliku. Seejärel valib
   `retrievalContextAssembler` dokumendid, tõendiaknad ja kered kontekstieelarvesse ning talletab
   retrieval'i, identiteedi, kärpimise ja ajastuste trace'i.
6. `mainResponseHandler` saadab küsimuse, lubatud ajaloo, juhised ja täpselt renderdatud
   `RAG_CONTEXT`-i vastusemudelile. Struktureeritud `evidencePackage` lisandub ainult
   `overview_synthesis`, `comparison`, `resource_discovery`, `life_situation_guidance`,
   `thematic_synthesis` ja `broad_multi_source` režiimides. Täpse faktiküsimuse vastus puhverdatakse
   enne kasutajale näitamist ning `factContract` võib selle tõendi suhtes kinnitada või blokeerida.
7. `sourceAttribution` seob kinnitatud vastuse tegelikult valitud/toetavate source-ID-dega, rakendab
   muu hulgas ajaloolise/värske allika piiri ning moodustab `displayed_sources`.
8. `responseFinalizer` salvestab vastuse, jooksu ja allikapaketid ning saadab vastuse kliendile
   JSON-i või SSE-voona.
9. UI näitab vastust. Vastusemulli hoveril ilmub allikanupp, mis avab „Vastuste allikad” paneeli.

See teekond selgitab, miks otsene RAG-otsing võib leida õige fakti, kuid vestlus ikkagi ebaõnnestuda:
viga võib tekkida keele- või riskiplaanis, küsimuse- või päringuplanner'is, retrieval-kanalis,
Next.js rühmitamises, dokumendiidentiteedis, tõendiakna valikus, mudeli sünteesis,
`factContract`-is, värskus-/riskiväravas või atribuutikas. Praegune arhitektuuririsk on see, et planner'i struktureeritud
tähendust ei kanta veel täielikult lõpukihtidesse ning validaator ja atribuutika parsivad osa
toorküsimusest uuesti; peatükk 39 kirjeldab autoriteetse semantilise lepingu sihti.

### 3.1 Häälvestluse sisend- ja väljundrada — 23.08.2026

Häälvestlus ei kasuta eraldi vastusemootorit. Mikrofon avab WebRTC kaudu OpenAI
transkriptsiooniseansi `POST /api/realtime/session` rajal; seansi tüüp on `transcription`, mudel
`gpt-4o-mini-transcribe`, keel `et`, sisendil on eestikeelne täpsusjuhis, `far_field`
müravähendus ja serveripoolne kõnevooru tuvastus 900 ms vaikusepiiriga. Realtime'i ülesanne on
ainult kõne tekstiks muuta — ta ei otsi RAG-ist, ei koosta teist vastust ega loe seda ette.

Valmis transkript saadetakse sama `/api/chat` raja kaudu suletud `inputModality: voice`
märgisega. Sealt edasi kehtivad samad vestluse omandi-, privaatsus-, kriisi-, kvoodi-, planner'i,
RAG-i, tõendivaliku ja kuvatud allikate lepingud nagu kirjutatud küsimusel. Vastuse koostab
seadistatud põhimudel; koodi vaikeseade on `gpt-5.6-luna` ja `OPENAI_MODEL` võib selle üle
kirjutada. Täisvastus ja allikad salvestatakse ning jäävad
tekstivestluses nähtavaks; häälpinnal ei renderdata vastusemulle ega subtiitreid avatari peale.

Eestikeelsest kliendile saabunud vastusest loetakse TartuNLP seadistatud häälega (koodi vaikeseade
`kylli`) ette kuni kolm lauset või 900
märki. `/api/tts` lisab heli ette 300 ms vaikust, et heliseadme ärkamine ei lõikaks esimest silpi;
vene- ja ingliskeelne väljund kasutab esmalt brauseri kõnesünteesi. Kasutaja uue kõnevooru algus
katkestab poolelioleva ettelugemise. Hoiatus käivitub 4 min 15 s pärast seansi algust ehk 45 s enne
lõppu, kuid praegune `VoiceModeSurface` tingimus `remainingMs <= 255 s` teeb loenduri nähtavaks juba
umbes 45 s pärast seansi algust ja hoiab seda nähtaval lõpuni. Lühike ühendamise, kuulamise või RAG-i tööolek paikneb
torso all eraldi kihis, mis ei muuda avatari mõõtu. Ainult iseseisev tervitus võib kasutada kiiret
tervitusvastust; tervitusele lisatud sisuline küsimus läbib kogu RAG-i ja turvatoru.

23.08 päris brauseris töötasid ühendus, chat ja TartuNLP heli, kuid esimene lausung
„tere, kas sa kuuled mind” transkribeeriti enne keele- ja müravähendusparandust kui „platin”.
Parandus on toodangus, kuid parandusejärgne päris mikrofoni täpsus on endiselt **NOT_PROVEN**.
See piir ei muuda RAG-i sisulise kvaliteedi tõendeid: kõnetuvastus, retrieval, vastus ja kuvatud
allikas on neli eraldi kontrollitavat etappi.

## 4. Koodipuu ja failide rollid

Allolev puu näitab praeguse kasutajaraja ja RAG-halduse põhiosi. See on rollikaart, mitte iga
abifaili ammendav loetelu.

```text
SotsiaalAI/
├─ rag-service/                         # eraldi Python/FastAPI RAG-teenus
│  ├─ main.py                           # API, ingest, embeddings, otsing, hübriidjärjestus
│  ├─ lexical_index.py                  # atomaarne SQLite FTS5 täiskorpuse pöördindeks
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
│  ├─ REGISTRY_RECOVERY.md
│  └─ (selles Python-teenuse alamkaustas eraldi testifaile ei ole)
│
├─ app/api/chat/
│  └─ route.js                           # autentitud vestluse põhitee
├─ app/api/realtime/session/route.js     # OpenAI WebRTC transkriptsiooniseansi loomine
├─ app/api/tts/route.js                  # TartuNLP kylli ja heli alguse vaikusepuhver
│
├─ lib/chat/                              # 63 faili; bootstrap, planner, retrieval, vastus ja jälg
│  ├─ requestBootstrap.js                # autentimine, omand, privaatsus, ajalugu ja sisendleping
│  ├─ orchestrationPolicy.js             # töörežiimi valik
│  ├─ languagePlan.js                    # küsimuse, vastuse ja UI keele plaan
│  ├─ questionPlanner.js
│  ├─ queryPlanner.js                    # päringud ja trace'i queryPlan-projektsioon
│  ├─ queryAnchors.js                    # nime-, pealkirja- ja fraasiankrud
│  ├─ retrievalStrategySelector.js
│  ├─ retrievalPlanning.js
│  ├─ retrievalOrchestrator.js
│  ├─ retrievalContextAssembler.js       # dokumendi-, tõendi- ja kontekstivalik
│  ├─ ragContext.js
│  ├─ legalLookup.js
│  ├─ requestContext.js
│  ├─ sourceNeed.js
│  ├─ sourceTrust.js
│  ├─ packageAwareContext.js
│  ├─ sourcePackages.js
│  ├─ sourceAttribution.js
│  ├─ sectionAttribution.js
│  ├─ evidencePackage.js
│  ├─ factContract.js                    # täpse fakti tõendivärav
│  ├─ promptBuilder.js
│  ├─ openaiRuntime.js
│  ├─ requestGeneration.js
│  ├─ mainRouteRuntime.js
│  ├─ mainResponseHandler.js             # mudel, puhverdatud valideerimine ja SSE
│  ├─ responseFinalizer.js               # vastuse, jooksu ja allikapaketi salvestus
│  ├─ realtimeVoice.js                   # häälsisendi serveripoolne leping
│  └─ settings.js
│
├─ lib/rag/                               # 16 faili; RAG kliendid ja shared abiloogika
├─ lib/admin/rag/                         # 29 faili; administraatori töövood
├─ app/api/rag/[...path]/route.js         # kontrollitud admin-proxy Python-teenusele
├─ app/api/rag/selftest/route.js          # administraatori käsitsi RAG-enesetest
├─ app/api/admin/rag/                     # 35 faili; haldus-API rajad
├─ components/admin/rag/                  # 33 faili; RAG haldusliides
├─ components/alalehed/chat/              # 16 faili; vestluse ja allikate UI
│  ├─ ChatMessageItem.jsx
│  ├─ ChatSourcesPanel.jsx
│  ├─ VoiceModeSurface.jsx
│  └─ VoicePointAvatar.jsx                # häälpinna avatar
├─ components/chat/hooks/
│  └─ useRealtimeVoice.js                 # STT-voorud, katkestamine ja TTS taasesitus
│
├─ prisma/schema.prisma                   # vestlused, allikapaketid, tagasiside, graph-lite
├─ scripts/                               # ingest-, audit-, kvaliteedivärava-, deploy- ja hooldusskriptid
├─ tests/rag/rag-regressions.test.mjs     # olemasolev ajalooline kitsas regressioonifail
├─ Andmebaasi/                            # piiratud reposisene lähte- ja metaandmete valik
│  └─ ajakiri/                            # repos olevad ajakirja lähtefailid
├─ docs/internal/rag-sotsiaaltoo-aastate-testipakett.md
│                                         # ajakirja RAG-dokumentatsioon
└─ docs/audits/                           # kvaliteediseire ja süsteemikaart
```

Mõõdetud failihulgad:

| ala | failide arv |
|---|---:|
| `rag-service/` | 13 |
| `lib/chat/` | 63 |
| `lib/rag/` | 16 |
| `lib/admin/rag/` | 29 |
| `app/api/rag/` | 2 |
| `app/api/admin/rag/` | 35 |
| `app/api/chat/` | 8 |
| `components/alalehed/chat/` | 16 |
| `components/admin/rag/` | 33 |
| `tests/` | 1 — `tests/rag/rag-regressions.test.mjs` |
| `scripts/` kokku | 107 |
| skriptid, mille failinimes on literal `rag` | 26 |
| RAG-testifailid | 1 |

`package.json`-is puudub üldine `npm test`; olemasoleva regressioonifaili jaoks on kitsas käsk
`test:rag-regression`, kuid
käesoleva 75 juhtumi töökorra järgi automaatteste ega test-, smoke-, probe-, benchmark- või
E2E-radu ei looda ega käivitata. Faili olemasolu ja varasemad tulemused on ajalooline koodifakt,
mitte aktiivse release'i runtime-tõend. Admini käsitsi käivitatav RAG-enesetest on eraldi
operatiivne tootefunktsioon ja jääb alles.

## 5. Python RAG-teenuse API

Kõik rajad peale `GET /health` nõuavad päist `X-API-Key`.

### Tervise- ja otsingurajad

- `GET /health`
- `GET /lexical-index/status`
- `POST /lexical-index/rebuild` — asünkroonne administraatori rebuild, HTTP 202
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

`POST /search` võtab muu hulgas küsimuse, `top_k`, dokumendifiltri, metaandmete `where` filtri,
kanalivaliku, kaasatavad väljad, `request_id`, kuni 12 `batch_queries` päringut ning 1–12
`journal_chunks_per_document` lõiku dokumendi kohta. `POST /search/agent-documents` piirab lubatud
`doc_ids` hulga 50-ni. Vastus sisaldab kandidaatide kõrval rühmi, kasutatud kanaleid, strateegiat,
kanalistatistikat, `partial/degraded` olekut ning ajastusi. Need väljad on diagnostika, mitte
iseenesest kvaliteedihinne.

## 6. Toodanguindeks ja failisalvestus

RAG-i päris tehniline salvestus asub serveris:

```text
/var/lib/sotsiaalai-rag/
├─ registry.json                 # registri praegune seis
├─ registry.json.last-good       # viimane terve varukoopia
├─ lexical-index.sqlite3         # registripõlvkonnaga seotud taastatav FTS5 indeks
├─ lexical-index.sqlite3.lock    # indeksivahetuse lukk
├─ lexical-index.sqlite3.stale   # ajutine fail-closed vananemismärgis korpuse muutmisel
├─ chroma/
│  ├─ chroma.sqlite3
│  └─ <UUID segment directory>/  # vektorsegmendid
├─ docs/
│  └─ <sha1(doc_id) 12 märki>/
│     ├─ lähtefail
│     └─ versioonid/
└─ .document-locks/              # dokumendipõhised lukud
```

FTS5 fail on taastatav otsingukiirendi, mitte korpuse ega dokumendiregistri tehniline tõde.
Korpuse muutmisel märgitakse see ajutiselt vanaks ja uus põlvkond vahetatakse sisse alles pärast
tervikluskontrolli.

22.08.2026 mõõdetud ajaloolise salvestussnapshot'i suurused ja arvud:

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

Algallikate kontrolliks kasutatud põhikausta värske failisüsteemi snapshot on:

```text
C:\Users\rauds\sotsiaal.ai\Andmebaas/
├─ ajakiri_sotsiaaltoo/        # 2860 faili
├─ tmp/                        # 122 faili
├─ _docx_review/               # 7 töö-/ülevaatusfaili, mitte canonical korpus
├─ .playwright-cli/            # 8 tööriistafaili, mitte canonical korpus
└─ README...                   # 1 fail
```

Kokku mõõdeti 2998 faili. Ajakirjakaustas olid väljaanded 2016. aasta numbritest kuni 2026. aasta
teise numbrini, erinumbrid ja muud ajaloolised kogumid. Failisüsteemi koguarv sisaldab ülevaatus-
ja tööriistakaustu; seda ei tohi esitada canonical artiklite ega korpusedokumentide arvuna.

### 8.2 `ajakiri_sotsiaaltoo` vormingud

| laiend | arv |
|---|---:|
| `.json` | 895 |
| `.txt` | 890 |
| `.pdf` | 649 |
| `.png` | 347 |
| `.md` | 55 |
| `.html` | 21 |
| `.py` | 2 |
| `.zip` | 1 |

Ühe artikli mitu vormingut ei tähenda mitut sisuliselt eri dokumenti. Failide arv, artiklite arv, registrikirjete arv ja aktiivsete indeksikirjete arv on eri mõõdikud.

### 8.3 Repos olev `Andmebaasi/`

Isolatsioonitööpuus mõõdeti 35 faili:

- `Admebaasi-materjali-lisa/` — 11;
- `lisatest/` — 10;
- `uuringud ja juhendid/` — 6;
- `ajakiri/` — 4;
- `organisatsioonid/` — 4.

See repo kaust on piiratud lähte- ja metaandmete valik, mitte toodangu kogu aktiivse korpuse
täielik koopia.

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

### 10.1 Otsingukanalid

Kliendi vaikimisi otsingupäring küsib viis retriever'it:

- `dense` — embedding'u sarnasus;
- `author_match` — registri autori-metaandmete täpsem shortlist;
- `title_match` — pealkirja vaste;
- `exact_phrase` — täpse fraasi vaste;
- `bm25` — leksikaalne vaste, mille lai põhitee kasutab püsivat SQLite FTS5 indeksit.

`registry_fact` ei ole vaikimisi küsitud kuues retriever. RAG-teenus võib selle lisada tingimusliku
spetsialiseeritud kanalina, kui registri faktikirjeldus piirab kandidaadi piisavalt üheselt ühe
dokumendiga. Graph-lite on eraldi lipu taga: see loob seotud üksuste põhjal lisapäringud ja võib
lisada kvoodiga kandidaate, kuid ei kirjuta ise vastust ega möödu tavalisest konteksti-,
faktivalideerimise ega atribuutikateest.

`cc9ec8de` koodi vaikeseaded on:

| seadistus | koodi vaikeväärtus | tähendus |
|---|---:|---|
| `RAG_LEXICAL_SEARCH_ENABLED` | `true` | leksikaalsed kanalid lubatud |
| `RAG_LEXICAL_TOP_K` | `20` | leksikaalse shortlisti lagi |
| `RAG_PERSISTENT_LEXICAL_INDEX_ENABLED` | `true` | persistent FTS5 põhitee lubatud |
| `RAG_PERSISTENT_LEXICAL_INDEX_CANDIDATES` | `320` | FTS5 kandidaadilagi |
| `RAG_RRF_K` | `60` | RRF konstant |
| `RAG_LEXICAL_SCAN_LIMIT` | `2000` | ainult legacy corpus-scan fallbacki lehesuurus |
| `RAG_LEXICAL_MAX_SCAN` | `100000` | ainult legacy corpus-scan fallbacki maksimaalne skann |

Toodangu tegelikud env-väärtused tuleb release'i tõendamisel serverist uuesti mõõta; varasem
`8000/8000` snapshot ei kirjelda `cc9ec8de` aktiivset FTS5 põhiteed.

Hübriidjärjestuse põhivalem koodis on:

```text
dense_score * 0.58
+ lexical_score * 0.34
+ rrf_score * 8.0
+ channel_boost
+ bm25_coverage_boost
```

Kanali kaalud ja boonused ei ole kasutajale nähtav hinne. Need järjestavad kandidaate; autori-,
pealkirja-, täpse fraasi- ja registrifakti ankrud saavad eraldi tugevduse.

### 10.2 Küsimuse plaan ja route

`questionPlanner.js` eristab järgmisi question-plan mode'e:

- `default`;
- `legal_exact`;
- `kov_service_or_benefit`;
- `person_source_lookup`;
- `specific_research_fact`;
- `specific_document_summary`;
- `specific_document_question`;
- `overview_synthesis`;
- `life_situation_guidance`;
- `comparison`;
- `resource_discovery`.

Plaan kannab lisaks mode'ile muu hulgas rolli ja kindlust, isiku- ja dokumendiankruid, mitme allika
vajadust, eelistatud allikate arvu, allikakihte ning vastuse lepingut. `specific_research_fact`
lisab dokumendi teema-, fakti-, liigi- ja aastaväljad ning tõendiperioodi, faasi ja mõõdikupesad;
`specific_document_question` valib nimepidi küsitud dokumendi `source_focus_first` rajal ühe
põhiallikana.

Question-plan ei ole siiski kogu route'i ainus autoriteet. `queryPlanner.js` rakendab lisaks legal-,
source-lookup-, temporal-, KOV-kontakti/teenuse-, riikliku teenuse ja jurisdiction'i route override'e.
Täielik question-plan juhib retrieval'it otse, kuid trace'i `question_planner` projektsioon ei kanna
praegu edasi välju `document_source_years`, `period_role`, `evidence_period_years`,
`evidence_phase_ordinal`, `evidence_metric_terms`, `evidence_metric_slots` ega
`bounded_episode_metric_fact`. `answer_contract` suunab strateegiat ja prompti, kuid ei ole veel
universaalne käivitatav valideerimisleping: faktivalidaator ja atribuutika tõlgendavad osa intent'i
endiselt algsest küsimusetekstist. Seda piirangut ei tohi dokumenteerida planner-authoritative
lõppseisuna.

## 11. Kontekstivalik, vastus ja allikad

### 11.1 Seadistus ja dünaamiline kontekst

Allolev eristus on oluline: env-is mõõdetud runtime-väärtus ja koodi fallback ei ole sama tõend.

| seadistus | varem mõõdetud runtime | `cc9ec8de` koodifallback |
|---|---:|---:|
| `RAG_TOP_K` | `12` | `12` |
| `RAG_CONTEXT_GROUPS_MAX` | `8` | `8` |
| `RAG_CTX_MAX_CHARS` | `8500` | `6000` |
| `RAG_GROUP_BODY_MAX_CHARS` | `1500` | `1100` |
| `RAG_MMR_LAMBDA` | `0.60` | `0.50` |
| `RAG_TIMEOUT_MS` | `30000` | `30000` |
| `RAG_GRAPH_CHANNEL_ENABLED` | `1` | väljas, kuni env on täpselt `1` |
| `RAG_ATTRIBUTION_DECISIONS_ENABLED` | `true` | `true` |
| `RAG_DISPLAYED_SOURCES_ENFORCED` | `true` | `true` |
| `RAG_TRACE_V1_ENABLED` | `true` | `true` |

Mudeliseaded:

| seadistus | varem mõõdetud runtime | `cc9ec8de` koodifallback |
|---|---:|---:|
| `OPENAI_MODEL` | `gpt-5.6-luna` | `gpt-5.6-luna` |
| `OPENAI_REASONING_EFFORT` | `medium` | `low` |
| `OPENAI_TEXT_VERBOSITY` | `medium` | `medium` |
| `OPENAI_MAX_OUTPUT_TOKENS_CLIENT` | `3000` | `900` |
| `OPENAI_MAX_OUTPUT_TOKENS_WORKER` | `3000` | `1200` |

Toodangu runtime-veergu ei tohi kanda järgmisele release'ile kontrollimata. Kontekst ei ole jäigalt
ühe suurusega: laiad sünteesi- ja ressursirajad kasutavad mitme allika valikut ning tavaliselt kuni
kolme keha dokumendi kohta; kitsas nimepidi dokumendi või faktirada võib kasutada kuni kaheksat
keha, kahekordistada baas-eelarvet ning tõsta konteksti dünaamilise lae kuni `16000` märgini.
`specific_document_question` valib kõrgeima asetusega ühe dokumendigrupi;
`specific_research_fact` kinnitab esmalt dokumendi identiteedi ja otsib faktid sama dokumendi seest.

### 11.2 Tõendi-, vastuse- ja allikatee

1. Question-plan ja route override määravad päringud, filtrid, top-k, valikustrateegia ning soovitud
   allikate arvu.
2. Hübriidotsingu kandidaadid rühmitatakse dokumentideks; valik on vastavalt rajale
   MMR/multi-source, ühe nimepidi dokumendi või identity-first uuringufakti valik.
3. Valitud grupid renderdatakse märgieelarvesse. Ainult tegelikult kasutatud `budgeted.used` grupid
   moodustavad tavalise RAG-allikaloendi ning iga allika `evidenceText` on täpselt mudelile
   renderdatud blokk, mitte kärpimata originaaltekst. Trace talletab valitud/kasutatud ID-d, hash'id,
   mahud ja kärpimise.
4. Vastusekoostaja saab renderdatud `RAG_CONTEXT`-i ja route'i lisajuhised.
5. Kui küsimus käivitab täpse fakti lepingu, kontrollib `exact_numeric_fact_v5` vastust enne
   atribuutikat. See kontrollib muu hulgas dokumendi identiteeti, sama renderdatud allika numbreid,
   aasta rolle, protsendi-arvu ja kategooria seoseid ning KOV-kontakti struktuuri; streaming-vastus
   võib ebaõnnestumisel enne salvestamist asenduda tõrketeatega.
6. `sourceAttribution.js` filtreerib valitud allikatest vastust toetava `displayed_sources`
   alamhulga. Otsus on route-spetsiifiline; pelk registriviide ei tohi jääda ainsaks kuvatud allikaks
   ja usaldusmeta ei tohi valikut tagantjärele muuta.
7. UI-s ilmub allikanupp assistendi vestlusmulli hoveril või klaviatuurifookusel ning avab
   `ChatSourcesPanel.jsx` paneeli.

Seetõttu on neli eraldi väravat: retrieval leidis kandidaadi; õige tõend jõudis renderdatud
konteksti; vastus läbis faktilepingu; toetav `displayed_sources` jõudis kasutajani ja paneel avanes.
Ühe värava PASS ei tõenda teisi.

`exact_numeric_fact_v5` kontrollib juba arvulisi väärtusi, protsendi/loenduse paare,
kategooriaseoseid, ajascope'i ja dokumendiidentiteeti, kuid ei ole üldine semantiline
entailment-mootor. J08 `61% leidis, et ...` vale-FAIL näitab, et koma- ja klauslipõhine parser võib
verbi ekslikult kategooriasildiks muuta. Autoriteetse tüübistatud downstream-lepingu siht on §39.1.

Hilisemates autentitud kuldjuhtumites on allikapaneeli avamine tõendatud, kuid see ei ole globaalne
ega release'ideülene tõend. Iga 75 maatriksi `DONE` rida vajab sama muutumatu SHA peal õiget vastust,
trace'i, toetavaid kuvatud allikaid ja avatud hover/focus allikapaneeli.

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

### 12.2 Toodangu 22.08.2026 ajalooline konsolideeritud saladusteta väljavõte

Allolev väljavõte on täpselt 22.08.2026 kell 17:29 +03:00 serverist mõõdetud snapshot, mitte väide
aktiivse `cc9ec8de` protsessikeskkonna värske korduslugemise kohta. Mõõtmise ajal olid
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

### 12.3 `/etc/sotsiaalai/rag.env` — 22.08 snapshot

Tol mõõtmise hetkel kinnitatud ohutud väärtused:

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

### 12.4 `/etc/sotsiaalai/frontend.env` — 22.08 snapshot

Tol mõõtmise hetkel kinnitatud RAG-i ja vastusekoostamise ohutud väärtused:

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

### 12.5 Aktiivse koodi täiendavad vaikeseaded

Need on `cc9ec8de` koodivaikimisi väärtused, mitte väide, et samanimelised võtmed on serveri
env-faili kirjutatud:

| seadistus | koodivaikimisi väärtus |
|---|---|
| `RAG_PERSISTENT_LEXICAL_INDEX_ENABLED` | `1` |
| `RAG_PERSISTENT_LEXICAL_INDEX_PATH` | `$RAG_STORAGE_DIR/lexical-index.sqlite3` |
| `RAG_PERSISTENT_LEXICAL_INDEX_PAGE_SIZE` | `2000` |
| `RAG_PERSISTENT_LEXICAL_INDEX_CANDIDATES` | `320` |
| `RAG_REQUEST_SHARED_READ_CACHE_ENABLED` | `1` |
| `RAG_REQUEST_SHARED_READ_CACHE_TTL_SECONDS` | `30` |
| `RAG_REQUEST_SHARED_READ_CACHE_MAX_ENTRIES` | `48` |
| `RAG_MULTI_QUERY_EMBEDDING_BATCH_ENABLED` | `1` |

## 13. Administraatori RAG-proxy ja õigused

`app/api/rag/[...path]/route.js` ei ole avatud läbipääs:

- nõuab sisselogitud administraatorit ja vastavat `RagAdminCapability` õigust;
- rakendab kiiruspiirangut;
- kontrollib muutvate päringute same-origin tingimust;
- piirab request body mahtu;
- lisab serveris `X-API-Key`;
- lubab vaikimisi ainult lokaalset RAG-hosti;
- kirjutab haldusoperatsiooni auditisse.

`KNOWLEDGE_STEWARD` saab loetleda/lugeda dokumente, lõike, lähtefaili ja FTS5 olekut, laadida
materjale, reindekseerida ning muuta metaandmeid. Kustutamine, URL-ist ingest ja FTS5 rebuild
nõuavad `PLATFORM_ADMIN` õigust. Toores file/text ingest, otsing ja analüüs on server-to-server
rajad, mitte brauseri vaba proxy. Eraldi administraatori `POST /api/rag/selftest` on käsitsi
käivitatav operatiivne tervisekontroll, mitte catch-all proxy ega arenduse automaattestisviit.

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
- FTS5 põlvkond seotakse registri SHA-ga; SQLite `quick_check`, fsync ja atomaarne failivahetus
  takistavad poolikut indeksit aktiivseks nimetamast. Korpuse muutmisel sulgeb `.stale` märgis
  leksikaalse raja kuni uue põlvkonna valmimiseni.
- Leksikaalindeksi rike ei muuda FTS5-t tõeks ega peida degradatsiooni: dense-rada võib jätkata,
  kuid vastus ja trace peavad kandma `partial/degraded` diagnostikat.
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

## 18. 22.08 esimene ajalooline paranduste laine

See peatükk säilitab esimese auditi paranduste ja tollase tõenduse ajaloo. See ei kirjelda
`cc9ec8de` aktiivset validaatorit ega praegust release'i koondit; hilisemad parandused ja runtime-
tõendid on peatükkides 25–39.

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

| P0 plokk | lokaalne muudatus | tolle etapi tõendusseis |
|---|---|---|
| tõendipiir | atribuutika `evidenceText` tuleb nüüd täpselt mudelile renderdatud plokist; trace säilitab konteksti-, algbody- ja renderdatud body hash'id, kärpeoleku ning start/end-offsetid | **CODE_DONE / runtime PARTIAL** — kahel õigel vastusel oli allikanupp, kuid paneel ei avanenud kontrollitavalt |
| mitme päringu järjestus | lisapäringute sundskoorilagi ja `preserveFirstScores` asendati ankurdatud päringuteülese RRF-fusion'iga; täpne lisapäring saab tõusta ainult kontrollitava ankru või päringuteülese kokkulangevuse toel | **CODE_DONE / runtime PARTIAL** — J17/V06 PASS, J11 FAIL |
| faktidokumendi shortlist | pime esimese viie dokumendi piir asendati identiteediskooriga; pealkirja-, autori-, registri- või täpse fraasi ankruga shortlist võib laieneda kuni 12 dokumendini, ankruta varurada jääb viiele | **CODE_DONE / runtime PARTIAL** — täpse pealkirjaga J11 leidis dokumendi kohtadel 1–3, loomulikud parafraasid ei leidnud seda esimese 12 seast |
| arvufakti leping | täpsed arvuküsimused puhverdatakse enne esimese teksti kuvamist; kontroll nõuab arvuliteralide leidumist ühes ja samas renderdatud allikas, eristab küsitud andmeaastat pelgast `source_year` päisest ning kontrollib üldarvu/alamrühma järjekorda | **PARTIAL** — ühiku semantiline samasus ja täielik faktipesade ekstraktsioon puuduvad |

Kandidaat lisas trace'i fusion'i kandidaadid ja põhjused, faktidokumendi shortlist'i
identiteediskoorid, täpselt renderdatud konteksti hash'id ning faktivalidaatori otsuse. Aktiivne
`exact_numeric_fact_v5` on sellest esimesest variandist oluliselt rangem: ta kontrollib juba
protsendi/arvu, kategooria, scope'i ja dokumendiidentiteedi seoseid. Praegune puudujääk ei ole
pelgalt arvuliteralide olemasolu, vaid raw-text heuristika ning autoriteetse tüübistatud
downstream-faktilepingu puudumine (§39).

## 19. Ajaloolised regressiooniväravad ja praegune kontrollikord

Varasema commit'i `08cbd94a` 4963-testist täissviiti praeguses repos enam ei ole. Repos on üks
tracked kitsas fail `tests/rag/rag-regressions.test.mjs` ja käsk `test:rag-regression`; varasem
38/38 tulemus kuulub oma tollasele SHA-le ega ole `cc9ec8de` tõend.

Kehtiva AGENTS.md ja omaniku töökorra järgi selles 75 juhtumi ringis automaatteste ega test-,
smoke-, probe-, benchmark- või E2E-radu ei looda ega käivitata. Praegused lubatud arendusväravad
on puudutatud failide scoped lint, vajadusel i18n-kontroll, `git diff --check` ning enne
push'i/deploy'd tootmisbuild; Prisma kontroll lisandub ainult skeemi või migratsiooni muutmisel.
Administraatori käsitsi RAG-enesetest on operatiivne tootefunktsioon ja ainus nimetatud erand.

Staatiline kontroll ja build tõendavad ainult koodi kuju ning kompileerumist. Need ei tõenda
retrieval'i, valitud konteksti, mudelivastust, faktiväravat, `displayed_sources`-eid ega hover-
paneeli päris korpuse ja autentitud vestluse vastu.

## 20. Mis on veel tõendamata

- J08 uus `unsupported_numeric_category_relation` põhjus teise sõnastusega aktiivsel release'il,
  selle üldine parandus ja kahe sõnastuse täielik autentitud järelkontroll;
- üks külmutatud `FINAL_SHA`, millel kõik J01–J75 läbivad algusest lõpuni vastuse, valitud konteksti,
  trace'i, toetavad kuvatud allikad ja avatava hover-paneeli ilma vahepealse deploy'ta;
- iga juhtumi esimese renderdatud teksti aeg, lõppaeg ning trace'i retrieval/model ajad samal
  lõpprelease'il;
- laia sünteesi allikate mitmekesisus, mitteajakirja materjalid, KOV-toetused ja -teenused,
  kontaktid, õigusallikad, uuringuarvud, meetodid/juhendid, ET/RU/EN ja päris jätkuküsimused samal
  lõpprelease'il;
- pärast 75/75 eraldi ettevalmistamata mitme kategooria juhuküsimused;
- pika vestluse ajaloomüra, korduva kasutuse tegelik rate-limit ning külma/sooja retrieval'i
  hajuvus;
- 863, 864 ja 877 ajakirjadokumendi loenduste täpne semantiline lepitus;
- kohaliku algmaterjali, registri, versioonitud failisalvestuse, FTS5 ja Chroma täielik
  üks-ühele terviklus.

## 21. Jääkriskid

- J08 aktiivne viga näitab, et vastuse `61% leidis, et ...` võib koma ees poolituda ja verb
  `leidis` muutuda ekslikult kategooriasildiks. Sõna stopword'i lisamine peidaks sümptomi, mitte
  ei parandaks klausli struktuuri.
- Planner, route override'id, faktivalidaator ja atribuutika ei tarbi veel üht täielikku
  provenance'iga tüübistatud semantilist lepingut; osa intent'ist tuletatakse toortekstist
  mitmes kihis uuesti.
- Õige dokument ei taga kõigi küsitud faktide jõudmist tõendiakendesse; document recall ja fact
  coverage on eri väravad.
- Registrifakti tugevam kaal võib aidata üht fakti, kuid vale metaandme korral suurendada vale
  kindlust.
- Laia sünteesi puhul võib üks kõrge skooriga allikas teised välja tõrjuda.
- Vestlusajalugu võib lühikest uut küsimust valesti ankurdada.
- `displayed_sources` olemasolu ei taga väite tasemel jälitatavust ega paneeli avatavust.
- Kiire esimene tekst võib varjata pikka retrieval'i/lõppaega või sisulist viga.
- Ajaloolise artikli fakt ja tänane KOV-/õigus-/kriisinõuanne vajavad eri current/historical
  scope'i; värskus ei tohi ajaloolist küsimust ümber kirjutada.
- Paljudel registrikirjetel puudub uus lifecycle või `source_format`; vana ja uue skeemi
  kooseksisteerimine raskendab arvestust.
- Repos puuduv redigeeritud env-mall teeb tootmise konfiguratsiooni driftimise raskemini
  märgatavaks.

V04 `2% (n=100)` segamine on ajalooline, hiljem parandatud ja paneeliga tõendatud juhtum; seda ei
esitata enam aktiivse release'i lahendamata veana.

## 22. Järgmine kontrollijärjekord

1. Reprodutseerida J08 praegune `leidis`-kategooria vale-FAIL teise sõnastusega samal
   `cc9ec8de` release'il.
2. Parandada üldiselt lause põhiverbi ja `et/that/что` komplementlause käsitlus, säilitades päris
   kategoorialoendite komad; küsimust, protsente ega vastust ei hardcode'ita.
3. Läbida lubatud staatilised väravad ja tootmisbuild, commit'ida nimeliselt, push'ida, deploy'da,
   värskendada sama autentitud brauseriakent ning korrata mõlemat J08 sõnastust koos trace'i ja
   hover-paneeliga.
4. Kui veaklasside parandused on lõppenud, külmutada üks `FINAL_SHA` ja läbida J01–J75 algusest
   lõpuni ilma vahepealse deploy'ta.
5. Uuendada maatriksit ainult selle muutumatu SHA täielike vastuse-, trace'i- ja paneelitõenditega.
6. Pärast tõelist 75/75 teha eraldi ettevalmistamata küsimused kõigis põhikategooriates ja kolmes
   keeles.

## 23. DONE / PARTIAL / FAIL / NOT_PROVEN

Need arvud ei ole töökindluse protsent. Kaks vaadet peavad jääma lahku.

**Ajalooline kumulatiivne diagnostikamaatriks** (eri release'idel täielikult tõendatud juhtumid):

| seis | arv | tähendus |
|---|---:|---|
| DONE | **21/75** | juhtum läbis oma mõõdetud release'il vastuse, konteksti, allikad ja paneeli |
| PARTIAL | **0/75** | osatõendit ei loeta DONE-ks |
| FAIL | **0/75** | ajaloolisse kumulatiivsesse koondisse ei kanta aktiivse arendusringi ebaõnnestumist |
| NOT_PROVEN | **54/75** | täielik ajalooline värav puudub |

**Aktiivse `cc9ec8de` range release-vaade**:

| seis | arv | tähendus |
|---|---:|---|
| DONE | **0/75** | varasema SHA PASS ei kandu siia automaatselt |
| PARTIAL | **0/75** | J08 ei ole osaline edu, sest kasutajale läks vale keeldumine |
| FAIL | **1/75** | J08: õige allikas, kuid faktivärava vale `unsupported_numeric_category_relation` |
| NOT_PROVEN | **74/75** | ülejäänud juhtumid ei ole selle SHA täielikul väraval läbinud |

`cc9ec8de` on diagnostiline release, mitte lõplik kandidaat. Pärast järgmist koodimuudatust algab
range release-vaade uuesti uuel SHA-l.

## 24. Lõpphinnang

SotsiaalAI-l on päris hübriidne, versioonitud ja turvapiiridega RAG-süsteem: eraldi FastAPI
teenus, Chroma vektorindeks, püsiv SQLite FTS5 indeks, JSON-register, versioonitud dokumendifailid,
mitmekanaliline otsing, küsimuse- ja päringuplaan, dokumendi- ning tõendivalik,
`exact_numeric_fact_v5`, atribuutika, trace ja autentitud vestlusliides.

Süsteemi tehniline olemasolu ning mitu kitsast kuldväravat on tõendatud, kuid aktiivne
`cc9ec8de` on diagnostiline ja J08 on sellel `FAIL`. Ükski varasem 21 PASS-ist ei muuda seda
release'i 21/75-ks. Terviklik sisuline töökindlus jääb **NOT_PROVEN**, kuni üks külmutatud
`FINAL_SHA` läbib 75/75 ning iga juhtumi õige vastus, valitud kontekst, toetavad kuvatud allikad,
avatud hover-paneel ja trace on koos talletatud.

Hetkehinnang: **PARTIAL, mitte 10/10 ega 75/75**.

Järgmised peatükid 25–38 on kronoloogilised release-snapshot'id. Nendes kasutatud sõnad
„praegune”, „toodangus” ja „lõppseis” kehtivad ainult vastava peatüki nimetatud SHA ning
mõõteakna kohta; aktiivne süsteemiseis tuleb päisest, §2.2-st, §23-st ja kõige uuemast §39-st.

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

Alles on üks terviklikult kontrollitud RAG-snapshot `/var/backups/sotsiaalai-rag-current-20260823T112112Z.tar.zst` (1,4 GiB; zstd-, tar- ja SHA-256 kontroll läbitud) ning üks taasteloendiga kontrollitud värske PostgreSQLi custom-dump iga aktiivse andmebaasiga saidi kohta: SotsiaalAI, RAIO, Avasta ja Beyondframes. Marta Raudsoo muutuvast JSON-sisust on üks terviklik hetkekoopia; Kaljo Simsoni aktiivne sisu on Git-seed, sest serveris eraldi admini local-faili polnud. Journali maht on 486 MiB ja püsiv piir 512 MiB / 14 päeva / vähemalt 5 GiB vaba kettaruumi; PM2 logid roteeruvad iga päev kuni seitsme koopiani. Deploy kasutab varasemat frontend-build'i ainult poolelioleva deploy ajutise rollback-kaitsena, eemaldab selle pärast edu, puhastab npm-, Prisma- ja `.next` build-cache'i ning säilitab ühe tar-loendiga kontrollitud aktiivse SHA frontend-artefakti ja ühe uusima build-logi. RAM-i ei suurendatud: madala koormuse ajal oli 6,8 GiB-st 3,8 GiB saadaval ning `vm.swappiness=10` vähendab aktiivsete rakenduslehtede enneaegset swap'i viimist.

Automaatteste ei loodud ega käivitatud. Staatiline värav oli lint, i18n, `git diff --check`, Python compile ja tootmisbuild; runtime-värav oli käsitsi sama autentitud vestlus. Range RAG-seis ei muutunud: **DONE 21/75 · PARTIAL 0/75 · FAIL 0/75 · NOT_PROVEN 54/75**.

## 31. Püsiv täiskorpuse leksikaalne indeks — runtime-release `d08b25a8`

Vana lai `corpus_scan` varurada luges iga üldküsimuse ajal Chromast kuni 8000 lõigu täisteksti ja skooris read Pythonis. Kontrollitud soojas päringus võttis leksikaalne etapp 5749 ms ning kogu otsene `/search` 6639 ms; tulemus oli `complete=false`, `partial=true`, kuigi aktiivses korpuses oli 49 727 lõiku. Etapiinstrumentatsioon näitas, et probleem ei olnud üksnes Pythonis: kolme mõõtevooru Chroma lugemine võttis 2493–4324 ms ning normaliseerimine ja skoorimine kokku 2575–2670 ms. Mõõdiku `lexical_rows_loaded=8621` sees olid 8000 laia skanni rida ja spetsiaalsete shortlist-radade lisaread; see ei olnud korpuse suurus.

Release-kandidaat asendab ainult laia `corpus_scan` varuraja rakendusega samas protsessis kasutatava SQLite FTS5 BM25-pöördindeksiga. Dense Chroma, graph-lite, planner, author/title/specific-document/fact/exact-phrase rajad, fusion/RRF, kvaliteediboonused, top-k, Luna vastus ja kuvatud allikate leping jäävad muutmata. Indeks tuletatakse `registry.json` aktiivversioonidest ja Chroma aktiivsetest lõikudest ning ei ole uus sisuline tõeallikas. Mõõdetud põlvkond sisaldas 49 727 aktiivset lõiku ja 6073 aktiivset dokumenti; registri 6089 kirjest 16 ei olnud aktiivsed. Indeksi maht oli 459 132 928 baiti ehk 437,9 MiB ning täisehitus kestis 37 791 ms.

Ehitus toimub ajutisse faili, millele tehakse SQLite `quick_check`, faili ja emakausta `fsync` ning alles seejärel atomaarne `os.replace`. Registri põlvkond seotakse kogu registri SHA-256-ga; pooleli või ebaõnnestunud ehitus ei asenda eelmist tervet indeksit. Eraldi atomaarne `.stale` marker sulgeb tee kohe, kui Chroma/registri elutsükkel alustab muutust. Faili- ja tekstiingest, PDF/URL-ingest, artiklipakk, reindex, metaandmete muutmine, aktiivversiooni kinnitamine ning delete/tombstone kasutavad sama jagatud elutsüklit. Täisehitus ei blokeeri enam muutva veebipäringu vastust: pärast andmemuutuse kinnitamist ajastatakse üks taustal töötav koondatud refresh ning mitu lähestikust muudatust ei käivita paralleelseid täisehitusi. Admini rebuild vastab `202 Accepted`; olekurada ja health näitavad nii stale-põhjust kui ka taustatöö seisu. Teenuse startup jätkab sünkroonse kontrolli ja vajadusel ehitusega enne ready-olekut. Chroma õnnestumise ja FTS-i ebaõnnestumise või taasteehituse ajal säilib dense-otsing, kuid diagnostika on `partial=true`, `degraded=true` ja täpse põhjusega; vana põlvkonda ei esitata värske ega täielikuna.

FTS-i SQL-kandidaadivalik rakendab enne järjestamist aktiivversiooni, lifecycle'i, collection'i, doc-ID, audience'i, municipality/KOV scope'i ja agentide dokumendikogumi filtreid; tundmatu väli või operaator sulgub tulemusetult. Põhirada kontrollib kandidaadid pärast SQL-i veel kord olemasoleva täpse metadata- ja aktiivversiooniloogikaga. Käsitsi kontrollis tagastas Kuusalu filter ainult Kuusalu read, `CLIENT` ainult `BOTH` audience'i read, `kov_services` ainult selle kollektsiooni ning synthetic deny-all agent-documents päring null tulemust. Ajutiselt puuduva indeksiga jäi dense tööle ja leksikaaldiagnostika oli `persistent_fts5_unavailable` / `LEXICAL_INDEX_MISSING`; keelatud ega vana lõiku ei lekkinud.

Uue indeksi esimene lai päring võttis leksikaalselt 397 ms ja kokku 1309 ms. Kümne sooja päringu leksikaalse etapi mediaan oli 394 ms ja mõõdetud maksimum 401 ms; kogu otsese `/search` mediaan oli 814 ms ja maksimum 866 ms, embedding'u võrguaeg esitati eraldi. Päring ei lugenud enam Chromast leksikaalseid täistekstilehti, laadis FTS-ist kuni 320 kandidaati ning raporteeris `complete=true`, `partial=false`, `degraded=false`. Eraldi suurt mäluteenust ei lisatud; kontrollprotsessi failipõhine PSS oli 33,1 MiB. Ajutise teise RAG-protsessi sulgemise järel tõusis serveri available-mälu 2,1 GiB-lt 3,4 GiB-ni, seega toodangusse ei kavandata paralleelset indeksiteenust.

Autoripäringu, täpse pealkirja, pika V04 arvuküsimuse ja Kuusalu teenusepäringu põhilised chunk- ja source-ID-d jäid vana ning uue raja võrdluses samaks. Kuusalu parafraasi kaks esimest tulemust jäid samaks ja kolmas muutus, kuid õige Kuusalu tõend püsis ees. Lühike otsene V04 variant „mis olid 10%, 6% ja 2% näidud?” eksis nii vana kui ka uue `/search` rajaga; see ei ole indeksi regressioon, kuid sõnastusvariant jääb lahendamata. Uue SHA vastu pole autentitud `/vestlus` vastust ega allikapaneeli kontrollitud, seega ei pärandata varasemaid 21 DONE-juhtumit automaatselt. Range seis jääb **DONE 21/75 · PARTIAL 0/75 · FAIL 0/75 · NOT_PROVEN 54/75**, uue SHA vestlusvärav `NOT_PROVEN`.

Runtime-release on SHA `d08b25a813be302ecda3d4cff71f12f520e23617`; `origin/main` ja puhas serveri tööpuu olid kontrollis samal SHA-l. Frontend, RAG ning research-worker olid aktiivsed ja `/vestlus` vastas loopbackil ning avalikult 200. Startup ehitas 49 727 lõigu / 6073 aktiivse dokumendi / 459 132 928 baidi indeksi 46 585 ms-ga; health näitas `ready=true`, registri põlvkond ning oodatud põlvkond kattusid ja taustarefresh ei töötanud.

Toodangu laia üldpäringu kolm järjestikust otsest `/search` korda kasutasid kõik `persistent_fts5` strateegiat ning olid `complete=true`, `partial=false`, `degraded=false`. Leksikaalajad olid 517, 512 ja 537 ms, retrieval 841, 811 ja 842 ms ning kogu päring 3198, 1453 ja 1038 ms; esimese korra suurem koguaeg jäi väljapoole leksikaalset rada. Juurkettal oli pärast deploy'd 20 GiB vaba ehk kasutus 59%, serveril 3,4 GiB mälu available ning kogu RAG-protsessi PSS 1 734 352 KiB. Need on hetktõendid, mitte p50/p95 koormustest.

Autenditud in-app brauser avas `/vestlus` vaate ja komposeri ilma loginiväravata, kuid privaatsuse hoidmiseks uut vestlussõnumit ei saadetud ega olemasolevaid vestlusi loetud. Seetõttu on sama SHA vastuse, kuvatud allikapaneeli ning päris ingest/reindex/tombstone taustasünkroonsuse värav endiselt **NOT_PROVEN**. Python compile, scoped ESLint, i18n, `git diff --check` ja lõppkoodi kohalik ning serveri tootmisbuild olid rohelised; Prisma pinda ei muudetud ning automaatteste ega uusi testi-, smoke-, probe-, benchmark- või E2E-faile ei loodud ega käivitatud. Kiire runtime-rollback on `RAG_PERSISTENT_LEXICAL_INDEX_ENABLED=0` ning RAG-teenuse restart; see taastab vana skanni muutmata Chroma korpust, registrit, andmebaasi või kasutajaandmeid. Commit'i rollback on release-commit'ide revert ja tavapärane deploy; FTS-fail võib jääda kasutamata kettale.

## 32. FTS5 release'i autentitud järelkontroll ja üldparandused — SHA-d `914e1452` ja `da2c79c4`

Kontroll tehti samas autentitud `/vestlus` vestluses ilma „Uus vestlus” workaround'ita. Esimese üheksa juhtumi plokk andis kuus PASS-i ja kolm tõendatud viga: V06 uuringudokument kuulutati ühepunktilise identiteedivahe tõttu ekslikult ebamääraseks, Kadri Soo täpses author-meta rajas ei olnud praeguses registris ühtegi vastet ning KOV-i järel esitatud iseseisev üldine koduabi küsimus päris Kuusalu scope'i. Omaniku eraldi brauserikontrollis eksis ka liitküsimuse „Kes on Laur Raudsoo ja mida ta on kirjutanud?” nimeparser, valides nimeks asesõnafraasi „ta on”.

`914e1452` parandab kolm koodipõhist üldlepingut: liitküsimuses võetakse täisnimi enne lihtsamaid mustreid ja asesõnafraas ei saa olla isik; KOV-i ajalugu kantakse üle ainult päriselt kontekstist sõltuvale jätkuküsimusele; konkreetse uuringudokumendi identiteedis eelistatakse täpset pealkirja teemakatvust üldisele chunk'i sisuteksti terminiloendusele. Ühe autori, KOV-i ega uuringu vastust koodi ei lisatud.

Deploy-järgne autentitud sihtkontroll:

| küsimus | brauseri lõppaeg | planner / retrieval | avatud toetav allikas | seis |
|---|---:|---|---|---|
| `Kes on Laur Raudsoo ja mida ta on kirjutanud?` | 15 022 ms | `person_source_lookup`, `person_name=Laur Raudsoo`, retrieval 9457 ms | viis autoriharu kaarti, sh Lauri 2025, 2018 ja 2017 artiklid | **PASS** |
| `Millist abi saab eakas inimene kodus?` kohe Kuusalu küsimuse järel | 12 330 ms | `life_situation_guidance`, KOV ID puudus, retrieval 8465 ms | SHS § 18, § 17 ja § 26; Kuusalu allikat ei kuvatud | **PASS** |
| V06 loomulik `169 / 2018` küsimus | 18 198 ms | `specific_research_fact`, identiteet `high`, retrieval 16 748 ms | Merli Lauri 2022 artikkel | **PASS** |

Kõigi kolme sihtvastuse paneel avati ning valitud ja kuvatud tõend toetas vastust. FTS5 jäi `ready=true`, 49 727 lõigu / 6073 aktiivse dokumendi peale. Korpust, indeksit, andmebaasi ega serveri env-i ei muudetud. Automaatteste ei loodud ega käivitatud; muudetud koodi lint, i18n, diff-kontroll ja lõpliku koodipuu tootmisbuild olid rohelised.

Järelkontroll avas kaks eraldi jääki. Praeguse registri täpne `author`-meta ei sisalda Kadri Soo vastet, kuigi tema nimi esineb chunk'ide sisus; ajaloolist A07 PASS-i ei käsitleta seetõttu uue release'i täpse author-meta tõendina enne allika ja metaandmete kooskõla lahendamist. Lühivorm `Mida sätestab Kuusalu valla koduteenuse määruse § 6?` läks esmalt `municipality_service_benefit_list` rajale ja andis vale keeldumise. Otsene täppisfilter leidis samast aktiivsest korpusest ainsa õige `kov_legal` / `kuusalu_vald` / § 6 „Koduteenus” lõigu; põhjus oli sõnavormi „määruse” puudumine määruse tuvastaja käändevormidest, mitte FTS5 recall ega puuduv õigusallikas.

Release `da2c79c4` lisas määruse tuvastajale kitsad käändevormid. Sama autentitud küsimus vastas 6401 ms-ga § 6 eesmärgi, sisu, abitoimingud ja personaalse hoolduskava õigesti. Trace oli `explicit_paragraph`, municipality ID `kuusalu_vald`, valitud allikaid 1, kuvatud allikaid 1 ning ID-d kattusid. Avatud paneel näitas „Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas § 6 Koduteenus · Koduteenus”.

Kumulatiivne ajalooline arvestus jääb **DONE 21/75 · NOT_PROVEN 54/75**, kuid neid 21 juhtumit ei pärita automaatselt `da2c79c4` kogu-release'i tõendiks. Praeguse release-jada sihtplokk on neli neljast PASS; Kadri meta, päris ingest/reindex/delete sünkroonsus ja ülejäänud maatriks jäävad avatuks. Üldhinnang on **PARTIAL**, mitte 10/10.

## 33. ET/RU/EN keelepõhise RAG-i arhitektuur — kitsas autorirada rakendatud, üldvärav PARTIAL

Lähteversioonis ei olnud üksikut „RAG-i keele” lülitit. `requestBootstrap` andis `uiLocale`-ile vastuse keele valikul eelisõiguse; `questionPlanner` intentsõnavara ja entiteedimustrid olid valdavalt eestikeelsed; sama algne küsimus saadeti nii mitmekeelse `text-embedding-3-large` dense-kanali kui eestikeelse FTS5 BM25 kanali sisendiks. Seetõttu ei piisanud ainult mitmekeelsest embedding'ust.

Lähte-SHA autentitud vene kontroll `Кто такой Лаур Раудсоо и о чём он писал?` võttis brauseris 5332 ms. Dense leidis 36 kandidaati, kuid planner jäi `default` režiimi, `person_name` puudus, BM25 andis 0, kuvatud allikaid oli 0 ning eestikeelse UI tõttu tuli vastus eesti keeles. See tõendas nelja kihi lepinguviga — intentsus, leksikaalne recall, vastuse keel ja atribuutika — mitte toimivat venekeelset RAG-i.

Täieliku keelekihi sihtarhitektuur on endiselt üks ühine RAG eestikeelse korpuse kohal, mitte kolm eraldi indeksit:

1. `interface_language` kannab kasutajaliidese valikut, `query_language` küsimuse tegelikku keelt ja `answer_language` selle vooru vastuse keelt;
2. vastuse keele eelisjärjekord on kasutaja selge voorupõhine soov, kindlalt tuvastatud küsimuse keel ning alles seejärel profiili või UI fallback;
3. nimed, KOV-id, täpsed pealkirjad, aastad, protsendid ja §-viited eraldatakse algsest küsimusest kaitstud entiteetidena ning neid ei tõlgita;
4. vene ja inglise küsimusele koostatakse struktureeritud eestikeelne `retrieval_query_et`;
5. dense-kanal otsib nii algse kui eestikeelse variandiga ning tulemused liidetakse olemasoleva fusion/RRF-i kaudu; FTS5 otsib eestikeelse variandiga;
6. täpne author/title/doc/paragraph metadata rada kasutab kaitstud algentiteete, mitte tõlgitud nime;
7. Luna koostab vastuse `answer_language` keeles, kuid allikate pealkirjad ja tekst jäävad algkeelde;
8. madala kindlusega või puuduva tõlke korral jätkub turvaline algkeele dense-otsing, kuid diagnostika ei tohi väita täielikku hübriidotsingut.

Privaatsust säilitav trace peab talletama ainult keelekoodid, tõlke olemasolu ja kindluse, kanalite kandidaadiarvud ning kestused; küsimuse ega tõlke täisteksti ei logita. Enne tõlkekihi mudeli või lisakutse valikut tuleb mõõta selle latentsus, kulu ja ET/RU/EN samatähenduslike küsimuste source/chunk-pariteet. Mudelit, prompt'i, top-k-d, FTS5 indeksit ega korpust ei muudeta keeleplokis oletuse järgi.

### 33.1 Tootmisrakendus — RAG-loogika SHA `c9672a05`

Esimene rakendus ei ava üldist tõlke-RAG-i. See aktiveerib ainult konservatiivselt tuvastatud vene- või ingliskeelse täisnimega autoriküsimuse. `languagePlan` eristab `interface_language`, `query_language`, `retrieval_language`, soovitud `answer_language` ja vana runtime'i keelevaliku; trace talletab ainult keelekoodid, transliteratsiooni/tõlke olemasolu, kontrollitud teematerminite arvu ning selle, kas kanoniseeritud retrieval oli aktiivne. Küsimuse, kanoniseeritud päringu, nime ega chunk'i teksti `language_plan` sündmusse ei kirjutata.

Toetatud rajal säilib isikunimi runtime'is muutmata, planner saab `person_source_lookup` lepingu ja eestikeelse kanoniseeritud otsinguvariandi. Täpne author-metadata rada, title/exact-phrase, FTS5 BM25 ja dense-kanal jäävad olemasolevasse fusion'i; mudelit, prompt'i, top-k-d, korpust, indeksit ega serveri env-i ei muudetud. Vastuse keel tuleb küsimuse keelest. Runtime-rollback on `RAG_MULTILINGUAL_AUTHOR_RETRIEVAL_ENABLED=0` koos RAG-teenuse restardiga.

Autentitud sama vestluse kontroll:

| küsimus | vastus ja aeg | trace | avatud allikad | seis |
|---|---|---|---|---|
| `Who is Laur Raudsoo and what has he written?` | ingliskeelne isiku- ja artiklikokkuvõte, 13,60 s | `person_source_lookup`; `query=en`, `retrieval=et`, `answer=en`; retrieval 3964 ms; valitud 5 = kuvatud 5 | nupp nähtav; ID-komplektid kattusid | **PASS, kitsas autorirada** |
| `Что писал Лаур Раудсоо о пожилых людях?` enne teemakitsendust | venekeelne Maardu näide, 13,19 s | retrieval 1512 ms; valitud 5 = kuvatud 5 | paneel sisaldas ka üldisi autorallikaid | **PARTIAL — atribuutika liiga lai** |
| sama küsimus SHA-l `c9672a05` | venekeelne AI- ja Padise näidetega vastus, 12,45 s | kontrollitud teematermine 4; retrieval 7934 ms pärast restarti; valitud 3 = kuvatud 3 | Maardu 2019, AI sotsiaaltöös 2025 ja Padise 2017; kaks allikat toetasid vastuses nimetatud näiteid, Maardu artikkel oli küsimuse teemaga seotud lisallikas | **PASS, kitsas teemaga autorirada** |

Lõppversioon kasutab kontrollitud eestikeelseid teematüvesid ainult kandidaadi- ja allikagrupi kitsendamiseks. Need ei ole vastuse hardcode ega üldine masintõlge. Esimese restartijärgse päringu retrieval 7,93 s ja sama raja varasem soe 1,51 s näitavad endiselt külma/sooja hajuvust; keeleplokk ei lisanud warm-up'i ega timeout'i muudatust.

Tõendipiir: see on RU/EN autorimustri sihtvärav, mitte kogu mitmekeelse RAG-i valmimine. Üldised sünteesid, KOV ja teenused, õigusallikad, arvulised uuringufaktid, segakeel, lühikesed jätkuküsimused ning ET/RU/EN samatähenduslike source/chunk-pariteet jäävad `NOT_PROVEN`. Kumulatiivset eestikeelset 75 juhtumi maatriksit need lisakontrollid ei muuda: **DONE 21/75 · NOT_PROVEN 54/75**. Automaatteste ei loodud ega käivitatud; scoped lint, i18n, `git diff --check` ja muutumatu lõppkoodi tootmisbuild olid rohelised.

### 33.2 Keele- ja atribuutikavärava jätk — RAG-loogika SHA `243da993`

14 juhtumiga käsitsi sihtmaatriks avas järgmised üldised veaklassid: pärisnime täpitäht võis küsimuse ekslikult eestikeelseks muuta, kirillitsas sidesõnaga algav ja ladina tähtedega kirjutatud vene küsimus vajas eraldi tuvastust, `ё` transliteratsioon ei kattunud registri `ö`-ga, kaasautoripäring ja kontrollitud teema ei piiranud kuvatavat tõendit ning selge voorupõhine vastusekeele korraldus ei jõudnud alati lõppvastuse ja fallback'ini. Parandused tehti jadana `ab267fd5`, `599e89dc` ja `243da993`; iga põhjuse järel korrati mõjutatud juhtumit, kuid kogu 14 juhtumi plokki ei pärita automaatselt viimase SHA täiskorduseks.

`243da993` käsitsi autentitud lõppväravad samas olemasolevas vestluses, ilma „Uus vestlus” workaround'ita:

| värav | tulemus | allikatõend |
|---|---|---|
| vene kaasautor + laste elulootöö | venekeelne õige vastus 11,453 s-ga | valitud 1 = kuvatud 1; avatud paneelis ainult Ingrid Sindi 2016 otsene artikkel |
| ingliskeelne üldine Kadi Lubi autoriküsimus | ingliskeelne nelja töö ja kaasautorite kokkuvõte 5,614 s-ga | valitud 4 = kuvatud 4; paneelis neli vastavaid töid toetavat kaarti |
| vene UI + eestikeelne küsimus | vastus jäi eesti keelde | trace `interface=ru`, `query=et`, `answer=et`; valitud 2 = kuvatud 2 |
| inglise UI + venekeelne küsimus | vastus tuli vene keeles | trace `interface=en`, `query=ru`, `answer=ru`; valitud 1 = kuvatud 1 |
| inglise UI + vene küsimus koos käsuga vastata eesti keeles | vastus tuli eesti keeles | `answer_language_reason=explicit_turn_instruction`; kahest valitud allikast kuvati üks otseselt toetav, teine filtreeriti välja |

Kaasautori puhul ei piisa enam sellest, et teine sama autorikomplektiga dokument sisaldab üldist rahvastikurühma sõna. Kontrollitud teemas peavad sobima eristavad teematüved; üldised juured nagu `laps` või `sotsiaaltoo` ei saa üksinda tõendit avada. See jättis 2016 otsese töö paneeli ainsaks allikaks. Allikate eraldi `direct/related` UI-rolle ei lisatud: selles kitsas juhtumis sulges põhjusepõhine retrieval'i ja atribuutika piirang üleliigse kaardi enne kuvamist.

UI keel ei määra enam vastuse keelt, kui küsimuse keel või sama vooru selge korraldus on teada. Keelevaliku dialoogis on valik eelvaade; püsiv muutus tekib alles seadete viimases jaamas nupuga „Salvesta”. Kontrolli järel taastati konto UI eesti keelde. Üldine ET/RU/EN RAG, laiad sünteesid, õigus- ja KOV-rajad, arvufaktid ning kogu 14 juhtumi täiskordus viimasel SHA-l jäävad `NOT_PROVEN`. Eestikeelne põhimaatriks jääb **DONE 21/75 · NOT_PROVEN 54/75**.

## 34. Prompt cache'i kasutajapõhise jaotuse eemaldamine — runtime-release `dfc04a29`

23.08 OpenAI dashboardi päevamõõt näitas 587 907 sisendtokenit: 158 528 cache-read, 120 097 cache-write ja 309 282 uncached tokenit. Sama päeva read/write suhe oli umbes 1,32, kuid 22.–23.08 koond jäi varasema suure kirjutusmahu tõttu 0,24 peale. Mõne minuti jooksul kasvas cache-read 4823 tokeni võrra, cache-write jäi muutumatult 120 097 peale; see kinnitas, et sama kasutaja stabiilne prefiks taaskasutus.

Koodianalüüs näitas allesjäänud süsteemset piirangut. `promptBuilder` paigutab eksplitsiitse breakpoint'i stabiilse lokaliseeritud süsteemiprompti lõppu ning kasutab `prompt_cache_options.mode=explicit` ja `ttl=30m`; dünaamiline materjalipakett, RAG-kontekst, grounding, vestlusajalugu, voorupõhised lisajuhised ja kasutaja küsimus asuvad pärast breakpoint'i. Seega ei sisaldanud cache'itav prefiks kasutajaandmeid, kuid `openaiRuntime` lisas võtmesse kasutaja ID ja tekitas identse rolli/keele/kriisivariandi kohta eraldi cache'i iga kasutaja jaoks.

Parandus muudab võtme versioonile `sotsiaalai:chat:v2` ning jätab sellesse ainult prefiksi sisu päriselt muutvad mõõtmed: efektiivne roll, vastuse keel ja kriisirežiim. Kasutaja ID eemaldatakse ainult cache-key'st; see jääb kasutuse-, kulu- ja auditilogide olemasolevasse serveripoolsesse lepingusse. Värske RAG-otsing tehakse endiselt iga saatmisega, vana vastust ega retrieval-tulemust ei taaskasutata ning eri prefiksid saavad cache-hit'i ainult täpse sisukattuvuse korral.

Lahendus järgib [OpenAI prompt caching juhendit](https://developers.openai.com/api/docs/guides/prompt-caching): jagatud pika identse prefiksiga päringud kasutavad sama võtit, muutuv sisu on breakpoint'i järel ning eksplitsiitne režiim väldib muutuvate lõppude cache-write'i. Ühe võtme soovituslik piir on ligikaudu 15 päringut minutis; kui päris liiklus selle ületab, lisatakse rolli/keele/kriisivariandile väike deterministlik ämber, mitte ei taastata kasutajapõhist üks-ühele jaotust.

Runtime-release `dfc04a29` on toodangus: kohalik HEAD, `origin/main` ja puhas server kattusid; frontend, RAG ja research-worker olid aktiivsed, `/vestlus` vastas 200, serverikoodis oli `sotsiaalai:chat:v2` ning vana `userPartition` puudus. RAG health jäi 49 727 vektori / 6089 registrikirje peale ja FTS5 oli `ready=true`. Scoped lint, diff-kontroll, i18n-kontroll ning kohalik ja serveri tootmisbuild olid rohelised. Korpust, Chroma/FTS5 indeksit, planner'it, fusion'it, Luna seadeid, top-k väärtusi, kuvatud allikaid, andmebaasi ega serveri env-i ei muudetud.

Tõendipiir pärast deploy'd: võtme koodirakendus ja teenuste tervis on tõendatud, kuid päris liikluse cache-read/write muutus, mitme kasutaja jagatud tabamus ja latentsus on kuni dashboardi kordusmõõduni `NOT_PROVEN`. Rollback on kitsa `dfc04a29` commit'i revert ja tavaline frontend deploy; olemasolevad cache-kirjed aeguvad 30 minuti jooksul ega vaja serveriandmete puhastamist.

## 35. Täpne allikakomplekt, OSKA arvufakt ja suure juhendmaterjali kontekst — 25.08 release `f9b6fdd4`

Kontroll jätkus samas omaniku autentitud vestluses. Laur Raudsoo jätk „mis on nende artiklite nimed?” läbis kuue artikli värava täpselt: üks piiratud päring, kuus valitud kontekstiallikat, kuus kuvatud source-ID-d ja hover-paneelis kuus nimekirja toetavat kaarti. V04 vastas 10%=640 ja 6%=227 kui 2023. aasta haldusandmed ning 2%=100 kui 2024. aasta ohvriuuringu tulemuse; faktivalidaator oli PASS ja avatud allikas Lepsi/Indovi artikkel.

OSKA 2025 seireküsimus andis ühe dense-päringu ja ühe valitud/kuvatud `Sotsiaaltöö seirearuanne 2025` põhjal 16% palgatõusu, 18% töötajate arvu kasvu, 68% nõuetele vastanud hooldekodusid, 95 koolitust ning ligikaudu 1750 osalejat ajavahemikus 01.01.2025–30.06.2026. `exact_numeric_fact_v4` läbis kõik arvud, dokumendiidentiteet oli `high`, kontekstiallikas ja hover-paneeli PDF kattusid. Saatmisest esimese renderdatud tekstini kulus 3337 ms ja vastuse valmimiseni 29 033 ms; trace'i retrieval oli 20 248 ms, dense 5311 ms, lexical 0 ja mudel 5350 ms. See tõendab õigsust, kuid jätab latentsuse avatuks.

Tarkvanema M07 esmane kordus leidis õige algkoolilapse töölehe esikohal, kuid `resource_discovery` jagas 6000 märgi konteksti kümne allika vahel. Õigest failist jõudis mudelile vaid kaks 236-märgilist alguskatkendit ehk 693 märki koos päisega, mistõttu vastus väitis valesti, et küsimuse esitamise järgne käitumine pole kinnitatud. Üldparandus tunneb nimepidi küsitud dokumendi juhiseküsimuse eraldi `specific_document_question` rajana, kasutab ühe päringu järel `source_focus_first` valikut ja annab ühe põhifaili tervikuna konteksti. Korduses jõudsid mõlemad kehad täies mahus mudelile (1182 + 248 märki, `truncated=false`), vastus soovitas avatud küsimusi, kuulamist, kohalolu ja hinnangutest hoidumist ning avatud paneel näitas ainult `TÖÖLEHT: Abiküsimused vestluseks algkoolilapsega`. Retrieval oli 4587 ms, dense 250 ms, lexical 2522 ms ja mudel 3143 ms.

Rakvere kontrollitud avalikus kontaktikihis oli 11 värskuskõlblikku kontakti; viis kuulus sotsiaaltöö rolliperesse ja kaks lastekaitsesse. Seda ei esitata kogu sotsiaalosakonna ametikohtade koguarvuna. Korpust, Chroma/FTS5 indeksit, andmebaasi ega serveri env-i ei muudetud. Automaatteste ega test-, smoke-, probe-, benchmark- või E2E-faile ei loodud ega käivitatud. Muudetud koodi lint, i18n, diff-kontroll ning kohalik ja serveri tootmisbuild olid rohelised. Lõppkontrollis kattusid kohalik HEAD, `origin/main` ja server SHA-l `f9b6fdd4`; kolm teenust olid aktiivsed, `/vestlus` vastas 200 ning RAG health oli `ok=true`, 49 727 vektorit / 6089 dokumenti ja FTS5 `ready=true`.

Need on kitsad sihtväravad, mitte kogu release'i 75 juhtumi täiskordus. Ajalooline kumulatiivne seis jääb **DONE 21/75 · PARTIAL 0/75 · FAIL 0/75 · NOT_PROVEN 54/75** ja kogu RAG-i hinnang **PARTIAL**.

## 36. Canonical 75 aktiivse release'i värav — 25.08 koodirelease `49b76109`

J01–J02 kordus paljastas ja sulges nimega publikatsiooni arvufakti kavatsuse üldise sõnavaraaugu. Kui küsimus kasutas „kui suur osa” või nimetas allikat „kirjutiseks”, ei aktiveerunud varem `specific_research_fact`; samas pikas vestluses võis retrieval seetõttu eelistada eelmist dokumenti. Planner tunneb nüüd mõlemad loomulikud vormid, jätab üldise allikaliigi dokumendiidentiteedi teematerminitest välja ja märgib raja versiooniga v2.5. Sama „kui suur osa” signaal jõuab ka `exact_numeric_fact_v5` validaatorisse, nii et korrektne retrieval üksi ei saa numeric trace-väravat vahele jätta. Küsimusi, autoreid, pealkirju ega kontrollprotsente koodi ei lisatud.

Release `49b76109` vastu läbisid J01 ja J02 mõlemad täieliku autentitud vastuse-, trace'i- ja hover-paneeli värava. J01 valis ja kuvas ühe Krista Schönbergi MAPPA artikli; J02 ühe Tuuli Ainsaare ja Kersti Ojasuu erihooldekodude artikli. Mõlemal oli dokumendiidentiteet `high`, selected/answer/displayed ID-d kattusid ja arvufakti validaator oli PASS. J01 retrieval oli 22 515 ms ning J02 5760 ms; suur hajuvus jääb jõudlusriskiks.

Range active-release arvestus on **DONE 2/75 · PARTIAL 0/75 · FAIL 0/75 · NOT_PROVEN 73/75**. Varasema release'i 21/75 on ajalooline tõend, mitte selle SHA automaatselt päritav koond. Kohalik HEAD, `origin/main` ja puhas server kattusid SHA-l `49b761094f1ae80f486d13ddae682d0bea2ab72d`; frontend, RAG ja research-worker olid aktiivsed, `/vestlus` vastas 200 ning health oli `ok=true`, 49 727 vektorit / 6089 dokumenti ja FTS5 `ready=true` 49 727 lõigu / 6073 aktiivse registridokumendiga. Kontaktikontrolli timer oli aktiivne ja viimane teenuse tulemus `success`. Korpust, indeksit, DB-d ega env-i ei muudetud; järgmine värav on J03–J22 samas vestluses ja samal muutumatul koodirelease'il.

## 37. J03 kontaktikanalite sidus kontekst — 25.08 koodirelease `caf15cf8`

Kahe loomuliku J03 sõnastuse trace näitas sama põhjust: vaikimisi MMR tõi ühe vastuse konteksti mitu kriisijuhendit, õige 2018. aasta artikkel jäi kärbitud sekundaarallikaks ning mudel ühendas eri allikate telefoninumbreid. Faktivalidaator peatas vastused põhjustega `unsupported_numeric_claim` ja `cross_source_numeric_mix`. Kitsas retrieval-leping tuvastab nüüd kontaktikanali semantilise tunnuse koos vähemalt kahe küsimuses nimetatud koodiga, valib ühe kõiki koode katva allikagrupi ning renderdab ainult selle toetavad kehad. See ei muuda globaalset top-k-d, fusion'i kaale, mudelit, prompt'i, timeout'e ega faktivalidaatori rangust.

Canonical ajalooline J03 küsimus läbis release'il `caf15cf8` täieliku autentitud värava: õige kriisikirjeldus ja numbrid 112/1220; üks valitud, vastust toetav ja kuvatud `sotsiaaltoo_vaimse-tervise-esmaabi-toole-2018`; `exact_numeric_fact_v5` PASS; dokumendiidentiteet `high`; hoveriga avatud ühe kaardiga allikapaneel. Saatmisest vastuseni kulus 28 613 ms, trace'i retrieval 25 918 ms, model 1941 ms ja validation 15 ms.

Ajaloolise artikli riskipiiri ei lõdvendatud. Üldise tänase kriisinõuna kõlanud variandil võis retrieval ja numbriline sama-allika kontroll olla korrektne, kuid atribuutika peitis 2018. aasta artikli põhjusega `historical_source_not_current_evidence`; see on ausalt mitte-PASS. Release'i range seis on seetõttu **DONE 1/75 · PARTIAL 0/75 · FAIL 0/75 · NOT_PROVEN 74/75**. J01/J02 varasema `49b76109` tõend ei kandu uuele koodirelease'ile üle.

## 38. J04–J11 release-eelne ajalooline põhjuslepingute snapshot — runtime `NOT_PROVEN`

Lähte-release `caf15cf8` näitas viit eraldi sõnastustundlikku veaklassi ja igaüks kordus vähemalt kahe sõnastusega. Need ei olnud korpuse puudujäägid: kõigil juhtudel oli õige dokument aktiivses registris ning töötav kitsam sõnastus leidis sama tõendi.

- J04 allikata, kuid nimega mitmeosalise loetelufakti kuju jäi MMR-i. Uus konservatiivne kuju nõuab nimeankrut, vähemalt kaht loendiarvu, loeteluküsimust ja siduvat `ja`/`ning`; oleviku-, KOV-, õigus- ning materjaliavastuse vihjed välistavad selle.
- J05 ajalooline osalemisarv sattus sõna `spetsialist` tõttu kontaktinimekirja rajale. Keskne ET/EN/RU arv + osalemisverbi erand eemaldab kontaktiraja ainult ilma selge olevikuviiteta.
- J07 ühe katseetapi `2018–2020` oli tõendi episood, mitte publikatsiooniaastate filter. Uus roll `evidence_episode` jätab allikaliigi neutraalseks ning surub maha ainult palja perioodi temporal-aktivatsiooni; aastate kaupa, võrdlus ja trend jäävad temporal-rajale.
- J10 õige dokumendi hilisemad tõendikehad jäid välja, sest teematerminite kümnene piir täitus küsimuse grammatika ja palja aastaarvuga. Ainult teematerminitest eemaldatakse paljas arv ja üldised liimsõnad; arv jääb eraldi faktiterminiks ning globaalset top-k-d ei muudeta.
- J11 inflekteeritud `artikli` ei sobinud varasema `artikkel…` allikavihjega ja sõna `sotsiaaltöötajate` käivitas värskete kontaktide validaatori. Allikavihje kasutab nüüd eesti `artikl…` käändetüve ning tunneb ka `kirjutis…` vormi.

Selle snapshot'i hetkel olid muudatused lokaalses tööpuus ning runtime `NOT_PROVEN`; hilisem deploy
ja järelkontroll on §39-s. Lähte-release'i J06/J08/J09 PASS-id ei kandunud järgmisele release'ile
automaatselt. Korpust, indeksit, DB-d, env-i, mudelit, prompt'i, top-k-d, fusion'i kaale ega
timeout'e ei muudetud ning automaatteste või sondifaile ei loodud ega käivitatud.

## 39. J07–J08 faktivärava diagnoos ja autoriteetse semantilise lepingu suund — 25.08

Jaotise 38 release-eelne seis on ajalooline. Järgnevas arendusringis jõudsid üldparandused toodangusse ning aktiivne release liikus esmalt SHA-le `b1b6fe15` ja J08 paranduse käigus SHA-le `cc9ec8de`. Neid tulemusi käsitletakse diagnostilise tõendina; iga koodimuudatus lõpetab eelmise SHA sertifitseerimisakna.

Release'il `b1b6fe15` läbis J07 kahe sõnastusega täieliku autentitud värava. Mõlemad vastused andsid ühe 2018–2020 katseetapi kohta 678 abisaajat, 273 vabatahtlikku, 21 600 töötundi, 12 maakonda ja 43 omavalitsust. Valitud, vastust toetav ja kuvatud allikas oli sama 2022. aasta artikkel „Seltsilised annavad sotsiaalhoolekande teenustele lisaväärtust”; dokumendiidentiteet oli `high`, faktivalidaator PASS ning hover-paneelis avanes õige allikakaart. Parandused normaliseerisid Unicode'i rühmitustühikud ja sidusid ainult kontrollitud tunni- ning maakonnavormid sama semantilise perekonnaga. See oli põhjendatud taktikaline parandus, mitte luba kasvatada faktivalidaatorisse piiramatut sõnapaaride sõnastikku.

J01 MAPPA jäi samal release'il `PARTIAL`: mitu sõnastust ja täpne canonical kordus vastasid õigesti, kuid üks esmane canonical katse ei valinud allikat ning eraldi sõnastus sai faktivalidaatorilt `unsupported_numeric_category_relation`. Need on eri jäljed ja kumbki põhjus ei kordunud veel kahe sõnastusega; seetõttu ei nimetata J01-t DONE-ks ega tehta oletuslikku parandust.

J08 kordus kahel sõnastusel release'il `b1b6fe15` sama vale-FAIL-iga. Õige hoolduskoormuse artikkel oli valitud, kuid `uniform_participant_groups` reegel tõlgendas artikli diskursusfraasi „Eelnevat kokku võttes … 14%” koguarvuks ning vastuse nummerdatud loendi `1.` vastuse koguarvuks. Trace võrdles seetõttu ekslikult `14 != 1` ja asendas vastuse üldise keeldumisega. Commit `82046c92` ankurdas rühmareegli allika päriselt tuvastatud „igas rühmas” seosesse; commit `cc9ec8de` eemaldas mitteaktiivse rühmareegli ekslikud koguarvud ka trace'ist. Sõltumatu staatiline ülevaade kinnitas, et J18-tüüpi „viis inimest igast sihtrühmast, kokku 15” jääb endiselt kontrollitavaks. Lint, i18n, diff-kontroll ja muutumatu lõppkoodi tootmisbuild olid rohelised; automaatteste ega probe-, smoke-, benchmark- või E2E-radu ei käivitatud.

Deploy-järgne J08 canonical kordus SHA-l `cc9ec8de` näitas, et esimene põhjus suleti, kuid juhtum ei ole veel PASS. Uus trace ei käivitanud enam `uniform_participant_groups` koguarvuvõrdlust; vastuse peatas järgmine, eraldi värav põhjusega `unsupported_numeric_category_relation` ja tuvastatud toetamata sildiga `leidis`. Õige dokument, selected/answer/displayed source-ID ja dokumendiidentiteet säilisid. Seega on J08 aktiivsel release'il **FAIL**, parandusring pooleli ning `cc9ec8de` ei ole külmutatud 75/75 kandidaat.

### 39.1 Koodikaardist kinnitatud arhitektuuriline põhjus

Uut paralleelset intent'i parserit ega teist `QueryContract`-i ei ole vaja lisada. `questionPlanner` toodab juba struktureeritud `questionPlan`-i: `mode`, `retrieval_strategy`, `answer_contract`, allikakihid, perioodi roll ja aastad, episoodi faas, meetrikaterminid ja -slotid ning piiratud episoodifakti tunnus. Retrieval kasutab neid välju. Downstream-projektsioon jätab aga just perioodi-, faasi- ja meetrikaslotid osaliselt välja ning `answer_contract` jääb valdavalt trace'i kirjelduseks. `factContract` tuletab seejärel toorküsimusest uuesti arvulise kavatsuse, aasta, publikatsiooniaasta, kategooriajaotuse, koguskoobi ja kontaktikavatsuse. Attribution kasutab mitut struktureeritud välja, kuid parsib toorküsimusest uuesti ankruid, värskusvajadust ja osa isikunime fallback'ist. Nii võivad planner, retrieval, validaator ja attribution anda samale lausele erineva tähenduse.

Pikaajaline siht on olemasoleva `questionPlan`-i versioneeritud autoriteetne downstream-projektsioon, näiteks `answerValidationContract`, mitte uus küsimust ümber tõlgendav parser. Leping peab kirjeldama:

- mida kasutaja küsib: intent, allika- ja dokumendiscope, autor, geograafia, publikatsiooni- ja sündmuseaeg, current/historical režiim ning nõutud faktislotid;
- iga välja päritolu ja kindlus: algteksti span, tuvastuskiht ja -meetod ning confidence;
- millal kasutati struktureeritud välja ja millal nähtavat legacy/raw-text fallback'i.

Planner on autoriteetne **küsimuse tähenduse**, mitte faktilise vastuse suhtes. Ta võib määrata, et kasutaja küsib ajaloolise artikli omavalitsuste arvu, kuid ei tohi anda `municipality_count = 3` kinnitatud tõena. Faktiväärtused tuletatakse valitud tõendist eraldi; vastus jagatakse kontrollitavateks väideteks ning validator võrdleb nõutud slotte tõendist tuletatud faktidega. Nii eristuvad näiteks `1220` telefoninumbrina ja aastana, publikatsiooniaeg ning sündmuseaeg, protsent ja loendi järjekorranumber ning asutuste arv ja osalejate arv. Hilisemad kihid võivad planneri lepingut kontrollida või madala kindluse korral tagasi lükata, kuid ei tohiks algtekstist iseseisvalt uut intent'i leiutada.

Üleminek peab algama shadow-režiimis: praegune validator teeb tootmisotsuse, uus tüübistatud leping logib plaani, provenance'i, tõendifakti, vastuseväite, fallback'i ja tulemuse. Olemasolev 75 juhtumi maatriks saab siis mõõta vana ning uue otsuse lahknevusi ilma tootmisväravat korraga ümber vahetamata.

### 39.2 Diagnostika ja lõplik release'i tõend

Praegune J01–J75 ring on veaklasside avastamine ja käsitsi regressioonivärav, mitte veel lõplik sertifikaat. Pärast viimast koodimuudatust tuleb kõik 75 juhtumit uuesti kontrollida ühe külmutatud `FINAL_SHA` vastu ilma vahepealse deploy'ta. Sõltumatu canonical juhtum vajab kontrollitud konteksti; sama juhtumi A/B-sõnastused peavad jääma samasse juhtumikonteksti ning päris jätkuküsimused kuuluvad teadlikult mitmevoorulisse plokki. Värske vestlus ei tohi olla workaround, millega ühe juhtumi viga peidetakse.

DONE suureneb ainult siis, kui viimasel muutumatul release'il on korraga tõendatud õige vastus, õige valitud kontekst, vastust toetavad kuvatud allikad, avatav „Vastuste allikad” paneel ja trace. Diagnostilise release'i PASS ei kandu järgmisele SHA-le automaatselt. Kogu RAG jääb `PARTIAL`, kuni külmutatud release on päriselt läbinud 75/75 ja sellele järgnevad eraldi ettevalmistamata mitme kategooria juhuküsimused.
