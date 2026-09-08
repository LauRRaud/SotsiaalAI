# Uue RAG-süsteemi master

See on SotsiaalAI-s arendatava GraphRAG-i tehniline põhikaart: süsteemi eesmärk, tegelik arhitektuur, andmevoog, failipuu, iga mooduli vastutus, hoidlad, kasutajaliidese ühendused, käitamine ja vastuvõtu piirid. Koodikaart on kontrollitud **08.09.2026 kohaliku main-tööpuu** järgi; M1 sisendiplokk ning ühendusparandused on kohalikus koodicommit'is `ad44c302e`. Aktiivne tööots ja järgmise töö juhtimine jäävad [SotsiaalAI.md S1.0 ja S2](../platvormi%20arendus/SotsiaalAI.md) alla. Siinne seis on dateeritud tehniline ülevaade.

Serveri algfailide mõõtmised on **07.09.2026** omad; aktiivse indeksi, M4 konfiguratsiooni ja admini aegumise kooskõla mõõdeti uuesti **08.09.2026 kell 07:00 UTC**. [Väljalaske- ja ühendusraport](rag-v2-release-integration-2026-09-08.md) eristab kohalikke tõendeid tootmisest. Algfailide olemasolu, kohalik sissevõtt, aktiivne otsinguindeks ja vestluse valitud põlvkond on neli eraldi asja.

- [1. Eesmärk, piirid ja tegelik valmisolek](#1-eesmärk-piirid-ja-tegelik-valmisolek)
- [2. Kuidas andmed süsteemis liiguvad](#2-kuidas-andmed-süsteemis-liiguvad)
- [3. Failipuu ja tuuma failid](#3-failipuu-ja-tuuma-failid)
- [4. Otsing ja indekseerimine](#4-otsing-ja-indekseerimine)
- [5. Vastamine ja vestluse olek](#5-vastamine-ja-vestluse-olek)
- [6. Haldus ja SotsiaalAI ühendused](#6-haldus-ja-sotsiaalai-ühendused)
- [7. Andmelepingud ja hoidlad](#7-andmelepingud-ja-hoidlad)
- [8. Korpus ja allikate päritolu](#8-korpus-ja-allikate-päritolu)
- [9. Seadistus, käivitamine ja taastamine](#9-seadistus-käivitamine-ja-taastamine)
- [10. Kontrollid, lepingud ja tõendid](#10-kontrollid-lepingud-ja-tõendid)
- [11. Lahtised võimed ja arenduses navigeerimine](#11-lahtised-võimed-ja-arenduses-navigeerimine)
- [12. Varasemad katsed ja ühenduste ajalugu](#12-varasemad-katsed-ja-ühenduste-ajalugu)

## 1. Eesmärk, piirid ja tegelik valmisolek

Toode peab võtma organisatsiooni lubatud materjalid vastu, säilitama nende päritolu, leidma küsimuse jaoks vajalikud tekstikohad ja allikas põhjendatud sõltuvused ning koostama kontrollitavate viidetega vastuse. SotsiaalAI on esimene klient ja päriskasutuse keskkond. Teise organisatsiooni materjalid, õigused, valdkonnaprofiil ja mudeliseadistus peavad kasutama sama tuuma.

| Kiht | Vastutus | Praegune eraldatavuse piir |
| --- | --- | --- |
| GraphRAG-tuum | Allikad, muutumatud versioonid, tekstiosad, allikakohad, indeks, otsing, sõltuvused ja tõendipakett. | Põhiosa on Node/JavaScript-i moodulites. Eraldi paigaldatav pakett ja stabiilne avalik kliendiliides on veel tegemata. |
| Kliendiseadistus ja allikaadapterid | Tenant/korpus, lubatud dokumendid, failivormingu tähendus, valdkonnaprofiil, mudel ja hoidlad. | Riigi Teataja XML-i ning kogutud KOV-/organisatsiooni JSON-i kuju on adapterites. Admini vaikimisi profiil on SotsiaalAI oma. |
| SotsiaalAI adapter | Sisselogimine, rollid, adminivaade, vestluse püsistus, allikapaneel ja HTTP-rajad. | M4 püsistus kasutab platvormi Conversation/ChatTurn tabeleid; see osa ei ole veel üldine kliendiadapter. |

Müüdava terviku vahe-eesmärk on teise organisatsiooni piiratud piloot sama väljalaske ning eraldi korpuse ja õigustega. Selleks vajatakse dokumenteeritud paigaldust/ühendamist, uuendamist, taastamist, kasutuse/kulu arvestust ja toe kokkulepet. Majutus- ja müügimudelit praegune tehniline teostus ei lukusta. Kogu M5 ajalooline süntees ei pea eelnema esimesele piiratud piloodile.

| Etapp | 08.09 tehniline seis | Mida tõend veel ei kata |
| --- | --- | --- |
| M0 — tuuma eraldamine | Sissevõtu ja otsingu loogika paikneb eraldi moodulites; ühendused on allpool kaardistatud. | Valmis jaotatav toode, teise kliendi ühendus ja versioonitud avalik API. |
| M1 — allikate ettevalmistus | PDF/HTML/XML/JSON-i kohalik sisendiplokk on seitsme pärisallika ulatuses vastu võetud. Täpsed viited, metaandmete päritolu ja plokipõhine jaotus säilivad. | Kogu korpus, OCR, keerukad paigutused ja nelja vormingu pärismudelirada tootmises. Kohalik päris indeks testvektoritega ja eraldi testadapteri brauserirada on kontrollitud. Admini vastuvõtt on PDF-i jaoks. |
| M2 — indeks ja otsing | PostgreSQL-i leksikaalne kanal, Qdranti pärisvektorid, versioonitud otsinguprofiilid, kanoonilised viited ja struktuurne laiendus töötavad piiratud korpusel. 07.09 serveris mõõdeti 8 dokumenti / 69 tekstiosa. | Suur korpus, jätkatav mahutöötlus ja ainult vajaliku osa lugemine päringu ajal. |
| M3 — sisulised sõltuvused | Ankurdatud väited/sõltuvused, indeksiobjektid, piiratud graafiotsing ning haldaja teadmismustandi koostamine ja valik on teostatud. Ühe dokumendi pärisrada avaldas 13 väidet ja ühe QUALIFIES seose. | Mitme dokumendi automaatne seostamine, sisuline kinnitamine, kasutajafaktide/ajapiiride rakendamine ja mahuka koostamise jätkamine. |
| M4 — vastamine | Piiratud Luna vastamisrada, allikaviited, taastamine ja juhitud jätkuvestlus on teostatud ning katsetatud. | Vaba tootmiskasutuse ja kogu korpuse vastuste kvaliteedi vastuvõtt. 07.09 vestluse konfiguratsioon osutas aktiivsest indeksist erinevale põlvkonnale. |
| M5 — ajaline ja kogu korpuse süntees | Eraldi edasine etapp. | Perioodikatvus, kümnendi teemade muutumise tõendamine ja kogu korpuse süntees. |
| M6 — haldus ja käitamine | Piiratud adminivoog, teenuste paigaldus, reserveeringud ja osaline taastamine on olemas. | Korpuse terviklik elutsükkel, kliendiõigused, varunduse/taastamise ja koormuse täielik vastuvõtt. |

Kaks graafikihti on eraldi. Parseri BELONGS_TO, PARENT_SECTION ja NEXT_SPAN kirjeldavad dokumendi ehitust. REQUIRES, EXCEPTION_TO, DEFINES, QUALIFIES ja teised teadmisseosed kirjeldavad allikaga ankurdatud sisulisi kandidaate. Naabrus, sama teema ega õnnestunud tsitaadivaste ei kinnita seose semantilist õigsust. Praeguste teadmiskirjete olek on source_anchored_unreviewed ka pärast haldaja valikut ja indeksi avaldamist.

Omaniku kinnitatud tootmisvaates ei kuvata vastuse sõnumimulli tekstis viitemärke. Allikad avanevad eraldi **„Vastuste allikad”** paneelis: autor, aasta, pealkiri, väljaanne, leheküljed ning allikaveast teatamine. Väite ja allika seos säilib andmetes. Piiratud katsevaates võivad tekstisisesed viited tõendamise jaoks alles jääda; allpool kirjeldatud praegune M4 esitus ei ole selle tootmisnõude täieliku vastuvõtu kinnitus.

## 2. Kuidas andmed süsteemis liiguvad

~~~mermaid
flowchart TD
  A[Algfail ja metaandmed] --> B[Registri- või adminiadapter]
  B --> C[M1: parseerimine, päritolu ja plokid]
  C --> D[Muutumatu allikaversioon]
  D --> E[M3: teadmismustand ja haldaja valik]
  E --> D2[Uus allikaversioon teadmiskirjetega]
  D --> F[M2: kontrollitud indeksi avaldamine]
  D2 --> F
  V[Salvestatud ja räsiga kontrollitud vektorid] --> F
  F --> G[PostgreSQL: allikad, objektid ja leksikaalne indeks]
  F --> H[Qdrant: vektorid]
  Q[Autenditud kasutaja küsimus ja lubatud korpus] --> R[Otsing ja piiratud sõltuvuste lisamine]
  G --> R
  H --> R
  R --> S[Tõendipakett ja kanoonilised allikaviited]
  S --> T[M4: vastuse koostamine ja kontroll]
  T --> U[Vestlus, allikavaade ja taastamine]
~~~

**Allika vastuvõtt.** Registriadapter või adminivoog annab ingestile algfaili, metaandmed, tenant'i, profiili ja kasutusõiguse. Parser loeb teksti, normaliseerija säilitab väljade päritolu ning chunkimine moodustab allikastruktuuri järgivad tekstiosad. Algfaili ei kirjutata ümber. Faili-, metaandme- või töötlusmuutus loob uue versiooni; vana viide jääb vana versiooni külge.

**Teadmiskihi koostamine.** Valikuline mudelipäring saab ühe dokumendi täpsed tekstifragmendid. Tulemuse tsitaadid kontrollitakse allika vastu. Haldaja saab valida väited ja seosed; valikust luuakse uus muutumatu versioon. Puuduvat seose sihti kirjeldatakse lüngana. Mudeli oletus ei muutu selle protsessiga kinnitatud algtekstiks.

**Indeksi avaldamine.** Lubatud dokumentidest võetakse üks versioonipilt. Tekstid, struktuur ja teadmiskirjed lähevad PostgreSQL-i; sobivad salvestatud vektorid Qdranti. Uus põlvkond aktiveeritakse alles tervikluse ja loenduste kontrolli järel. Indekseerimise enda funktsioon ei telli pärisembedding'uid: vajalikud vektorid valmistatakse eraldi lubatud ja eelarvestatud tööga.

**Küsimus ja vastus.** SotsiaalAI adapter kontrollib kasutajat ning M4 konfiguratsioon lubatud korpust ja plaani. Päring kasutab kindlat indeksipõlvkonda, leksikaalset/vektorkanalit ja versioonitud kontekstiprofiili. Tõendipakett seob iga S1/S2-tüüpi viite konkreetse dokumendi, versiooni, tekstiosa ja allikakohaga. Vastus avaldatakse pärast skeemi ja viidete kontrolli. Taastamine kontrollib allikaseoseid ning ligipääsu uuesti.

## 3. Failipuu ja tuuma failid

~~~text
Andmebaasi/                      algmaterjalid, metaandmed ja REGISTER.json
Arhiiv/Andmebaasi_2026-09-07/     korrastuseelne taastatav materjal
lib/rag-v2/                     uus ingest, teadmus, otsing, M4 ja admini teenused
lib/admin/rag/v2Server.js        SotsiaalAI admini autentimisadapter
lib/chat/m4Pilot*.js             SotsiaalAI vestluse adapterid
app/api/admin/rag/v2/intake/     admini HTTP-sissepääs
app/api/chat/                    tavalise vestluse ja piiratud M4 rajad
app/admin/rag/ingest/            uue PDF-vastuvõtu leht
app/rag-pilot/                   eraldi M4 katsevaade
app/chat-source/                 versiooniga seotud allikavaade
components/admin/rag/           admini tööpind, teadmismustand, tekstid ja kujundus
components/chat/                 vestluskonteksti juhtimine ja allikate ühendused
prisma/rag-v2/                  eraldi otsinguandmebaasi skeem ja migratsioon
prisma/schema.prisma            platvormi vestlused ja M4 eraandmed/kululeger
deploy/rag-v2/compose.yml        eraldi PostgreSQL ja Qdrant
scripts/rag-v2*.mjs              sissevõtu, käitamise ja katseplaanide CLId
tests/rag-v2*.test.mjs            piiritletud lepingute/regressioonide testid
tests/evaluation/                küsimused, korpuseseosed ja ankrurühmad
docs/rag-v2/                    ADR-id, käitusjuhised ja mõõtmistõendid
docs/audits/rag-susteem-master.md käesolev tehniline põhikaart
~~~

Järgnev puu sisaldab kõiki 08.09 olemasolevaid lib/rag-v2 faile; platvormi sissepääsude failivastutused on peatükis 6.

<details>
<summary>lib/rag-v2 täielik failipuu</summary>

~~~text
lib/rag-v2/
├── admin/
│   ├── auth.js
│   ├── config.js
│   ├── http-body.js
│   ├── intake.js
│   └── knowledge-jobs.js
├── catalog.js
├── chunking.js
├── contracts.js
├── domain-profiles/
│   └── sotsiaalai.json
├── evaluation/
│   └── rubric-v2.js
├── ingestion.js
├── knowledge-preparation.js
├── knowledge.js
├── metadata-adapter.js
├── normalize.js
├── parser.js
├── pdf-layout.js
├── pdf-worker.js
├── pilot/
│   ├── config.js
│   ├── contracts.js
│   ├── dialogue.js
│   ├── evidence-draft.js
│   ├── evidence-segments.js
│   ├── fixed-packet.js
│   ├── lifetime.js
│   ├── presentation.js
│   ├── provenance.js
│   ├── provider.js
│   ├── retrieval.js
│   ├── service.js
│   ├── store.js
│   └── test-transport.js
├── registered-source.js
├── search/
│   ├── artifact-provenance.js
│   ├── dependencies.js
│   ├── embedding.js
│   ├── evaluation-plan.js
│   ├── evaluator.js
│   ├── export.js
│   ├── indexing.js
│   ├── local-config.js
│   ├── model-context.js
│   ├── multi-source-plan.js
│   ├── openai-embedding.js
│   ├── pilot-manifest.js
│   ├── pilot-report.js
│   ├── pilot-runner.js
│   ├── policy.js
│   ├── postgres.js
│   ├── profiles.js
│   ├── qdrant.js
│   ├── ranking.js
│   ├── retrieval.js
│   ├── snapshot.js
│   ├── structural-role.js
│   └── types.d.ts
├── source-locations.js
├── text-source.js
└── types.d.ts
~~~

</details>

### Sisend, versioonid ja teadmiskirjed

| Fail | Mida teeb |
| --- | --- |
| [contracts.js](../../lib/rag-v2/contracts.js) | Ühine skeemiversioon, deterministlikud ID-d/räsid, sisendi ressursipiirid ning metaandmete ja bundle-kuju käitusaegne valideerimine. |
| [types.d.ts](../../lib/rag-v2/types.d.ts) | Salvestatud dokumendi, versiooni, allikakoha, tekstiosa, teadmiskirje ja sõltuvuse TypeScripti leping; eristab rag-v2/1 ja rag-v2/2 kuju. |
| [ingestion.js](../../lib/rag-v2/ingestion.js) | Ühe allika töö peamine korraldaja: loeb ja kontrollib sisendid, määrab identiteedi, käivitab parseri, normaliseerib, salvestab ning avaldab failiregistri versiooni. |
| [catalog.js](../../lib/rag-v2/catalog.js) | Privaatne failihoidla: lubatud failitee lugemine, üks kirjutajalukk, active.json, muutumatud versioonid, SHA-256 manifesti kontroll ja inimloetav report.html. |
| [registered-source.js](../../lib/rag-v2/registered-source.js) | Seob Andmebaasi/REGISTER.json kirje algfaili ja metaandmekihtidega; valib KOV-i üksikkirje ning loeb akti identiteedi XML-i sisust. |
| [metadata-adapter.js](../../lib/rag-v2/metadata-adapter.js) | Viib eri metaandmekujud ühistele väljadele, säilitades algsed väärtused, väljade päritolu ja vastuolulised kandidaadid. |
| [parser.js](../../lib/rag-v2/parser.js) | PDF-parseri tööprotsessi käivitamine ja piiramine; PDF-elementidest tekst, lehed, read, pealkirjad, plokid, allikakohad ning servateksti eemaldamise jälg. |
| [pdf-worker.js](../../lib/rag-v2/pdf-worker.js) | Eraldi Node-tööprotsessis pdfjs-dist väljakutse; tagastab teksti, koordinaadid, pöörde ja PDF-metaandmed piiratud mahus. |
| [pdf-layout.js](../../lib/rag-v2/pdf-layout.js) | Määrab PDF-elementide lugemisjärjekorra: püsiv kahe veeru vahe, üle veergude ulatuvad read ja pööratud tekst. |
| [text-source.js](../../lib/rag-v2/text-source.js) | HTML-i sisuplokid, Riigi Teataja XML-i normid ja KOV-/organisatsiooni JSON-väljad koos täpsete DOM-/XML-/JSON Pointeri asukohtadega. Skripte ega väliseid XML-olemeid ei käivitata. |
| [source-locations.js](../../lib/rag-v2/source-locations.js) | Vormingu ja algvara nimi, ühised lähteüksused, allikavahemike moodustamine/kontroll ning Unicode-i säilitav pika teksti jaotus. |
| [chunking.js](../../lib/rag-v2/chunking.js) | Moodustab struktuursetest plokkidest piiratud suurusega tekstiosad; säilitab kirjegrupid, allikavahemikud, pealkirjakonteksti ja lubatud naabrid. |
| [normalize.js](../../lib/rag-v2/normalize.js) | Koostab canonical bundle’i: eraldi bibliograafia/kehtivus/kogumisaeg, päritolu, algsed metaandmed, tekstiosad, struktuursed seosed ja nähtavad piirangud. |
| [knowledge.js](../../lib/rag-v2/knowledge.js) | Valideerib teadmiskandidaadid ja täpsed tsitaadiankrud; loob väite-, sõltuvus- ja lüngaobjektid ning kontrollib nende seost allikaversiooniga. |
| [knowledge-preparation.js](../../lib/rag-v2/knowledge-preparation.js) | Valmistab ühe allika mudelipäringu ja eelarveplaani; sisaldab koostamise prompt’i/skeemi ning lahendab mudeli fragmentide/tsitaatide vasted tagasi algtekstile. |
| [domain-profiles/sotsiaalai.json](../../lib/rag-v2/domain-profiles/sotsiaalai.json) | SotsiaalAI deklaratiivne profiil: kuunimed, kategooriasildid ja varem üle vaadatud failiräside auditimärkused. Teise kliendi profiil antakse sama tuuma sisendiks. |

Tuumas ei tehta artikli nime, ID ega küsimuse täpse sõnastuse järgi otsingu- või vastuseerandeid. Konkreetse allikaliigi väljade tähendus asub adapteris; kliendi kuunimed, kategooriad ja kontrollmärkused profiilis. Imporditud kirjeldus ja märksõnad jäävad otsinguabiks. Allikakoht viitab alati algtekstist tuletatud täpsele tekstivahemikule.

## 4. Otsing ja indekseerimine

### Otsingu- ja katsemoodulid

| Fail kaustas lib/rag-v2/search | Mida teeb |
| --- | --- |
| [snapshot.js](../../lib/rag-v2/search/snapshot.js) | Laeb lubatud dokumentide aktiivse failiversioonipildi; kontrollib manifeste, originaalide räsisid, versiooni-/tenant-seoseid ja allikavahemikke. |
| [indexing.js](../../lib/rag-v2/search/indexing.js) | Koostab otsingukonfiguratsiooni ja uue põlvkonna, impordib andmed, kontrollib vektoreid ning aktiveerib põlvkonna. Praegu kehtib 5000 tekstiosa piir. |
| [postgres.js](../../lib/rag-v2/search/postgres.js) | PostgreSQL-i adapter: põlvkonnad ja aktiivne viit, bundle’id/objektid, indeksikirjed, leksikaalne otsing, vektorivahemälu ja kanoonilise viite kontroll. |
| [qdrant.js](../../lib/rag-v2/search/qdrant.js) | Qdranti adapter: kollektsiooninimed, vektorite lisamine, loenduse/sisu kontroll ja lubatud dokumentidega piiratud vektorotsing. |
| [embedding.js](../../lib/rag-v2/search/embedding.js) | Embedding-ruumi leping, tokenizer/tokenipiir, vektori kontroll, indeksikirje ja vahemälu võti; sisaldab deterministlikku MockEmbedding testiadapterit. |
| [openai-embedding.js](../../lib/rag-v2/search/openai-embedding.js) | Piiratud OpenAI embedding-transpordi ja vastuse kuju/mudeli/tokeniarvu kontroll. |
| [retrieval.js](../../lib/rag-v2/search/retrieval.js) | Päringu põhivoog: õigused ja põlvkond, leksikaalne/vektorkanal, RRF, tekstiosade valik, struktuur/sõltuvused, lõplik õiguste korduskontroll ja tõendipakett. |
| [ranking.js](../../lib/rag-v2/search/ranking.js) | RRF-kanalifusioon, metaandmefiltrite sobitamine ning päringu ja piirangute valideerimine. |
| [profiles.js](../../lib/rag-v2/search/profiles.js) | Nimetatud muutumatud otsinguprofiilid; seob meetodi, struktuuri/sõltuvuste lülitid ja konteksti mahu. |
| [structural-role.js](../../lib/rag-v2/search/structural-role.js) | Eristab bibliograafilisi või dokumendieelseid silte sisutõendina kasutatavatest tekstiosadest. |
| [dependencies.js](../../lib/rag-v2/search/dependencies.js) | Laiendab valitud allikatest ankurdatud sisulisi sõltuvusi piiratud sammude kaupa; säilitab suuna, all/any tähenduse, tsüklipiiri ja nähtavad lüngad. |
| [model-context.js](../../lib/rag-v2/search/model-context.js) | Muudab täieliku tõendipaketi kompaktseks mudelikontekstiks, arvutab selle mahu ning seob S-viited kanoonilise allika ja tekstiräsiga. |
| [policy.js](../../lib/rag-v2/search/policy.js) | FilePolicy ja LocalPolicy: lubatud dokumentide nimekiri tenant’i ning operaatori/kasutaja kaupa. See liides saab õigused kliendiadapterilt. |
| [local-config.js](../../lib/rag-v2/search/local-config.js) | Lubab arenduse PostgreSQL/Qdranti ühenduseks ainult kindlad loopback-sihtkohad; ei asenda riket tootmise ühendusega. |
| [export.js](../../lib/rag-v2/search/export.js) | Loetav evidence.html: valitud tekst, bibliograafia, allikakohad, valiku põhjused ja piirangud. |
| [types.d.ts](../../lib/rag-v2/search/types.d.ts) | Otsingupäringu, embedding-seadistuse, tõendipaketi, mudelikonteksti ja kanoonilise allikaviite tüübid. |
| [evaluation-plan.js](../../lib/rag-v2/search/evaluation-plan.js) | Koostab ühe valimi küsimuste/allikateksti tokeni- ja kuluhinnangu ilma väliskutseteta. |
| [multi-source-plan.js](../../lib/rag-v2/search/multi-source-plan.js) | Koostab mitme allika väljasaatmis-/taaskasutusplaani ja püsiva kululegeri asukoha. |
| [pilot-manifest.js](../../lib/rag-v2/search/pilot-manifest.js) | Külmutatud embedding-manifest, hinna ja loa kontroll, nanodollarites kuluarvestus ning pärisembedding’u konfiguratsioon. |
| [pilot-runner.js](../../lib/rag-v2/search/pilot-runner.js) | Käivitab lubatud embedding-partii reserveeringute ja püsiva ledger’iga; kontrollib salvestatud vektoreid ning pakub nende taaskasutuse adaptereid. |
| [evaluator.js](../../lib/rag-v2/search/evaluator.js) | Lahendab etalonankrud allikasse ja võrdleb otsingumeetodite katvust; ei võrdsusta tehnilist vastet kogu vastuse sisulise õigsusega. |
| [pilot-report.js](../../lib/rag-v2/search/pilot-report.js) | Embedding’u/otsingukatse HTML-raport koos meetodite, mahu ja kulu võrdlusega. |
| [artifact-provenance.js](../../lib/rag-v2/search/artifact-provenance.js) | Seob katseartefakti koodi, sisendite, indeksi, hindamiskomplekti ja kasutatud vektorite päritoluga. |

Päring seotakse ühe aktiivse põlvkonnaga. Õigused määravad lubatud dokumendid enne kanalipäringuid ja uuesti enne tulemuse tagastamist. Praegune teostus loeb nähtavad bundle’id ja nende indeksikirjed tervikuna mällu ning kontrollib enesekooskõla; see on üks suure korpuse järgmisi paranduspunkte.

Leksikaalne kanal kasutab PostgreSQL-i simple-tekstindeksit, vektorirada sama kinnitatud embedding-ruumi vektoreid. RRF ühendab järjestused; pealkiri/autor/otsinguabi ja algtekst on eraldi väljad. Seejärel rakendatakse konteksti tokenipiiri, ühe dokumendi limiiti, duplikaatide kõrvaldamist ja vajadusel graafilaiendust. Mudel saab kompaktse tõendipaketi; täielik valikujälg jääb auditiandmetesse.

### Versioonitud profiilid

Kõigil alltoodud profiilidel on 5 algset järjestatud valikut, kuni 40 kanalitulemust ja 6000 tokeni kontekstipiir. Täpse lepingu määrab profiles.js; vanu profiile ei muudeta uue katse nimel vaikimisi.

| Profiil | Kanal ja lisa | Lõplik tekstiosade piir |
| --- | --- | ---: |
| hybrid-ranked-first-v1 | Hübriid, ilma graafilaienduseta; vaikeprofiil. | 5 |
| vector-ranked-first-v1 | Ainult vektor, ilma graafilaienduseta. | 5 |
| hybrid-ranked-first-neighbors-v1 | Ajalooline hübriid koos struktuurinaabritega sama mahu sees. | 5 |
| hybrid-ranked-first-neighbors-v2 | Hübriid, kuni 2 lisanaabrit eraldi mahus. | 7 |
| vector-ranked-first-neighbors-v1 | Vektor, kuni 2 lisanaabrit eraldi mahus. | 7 |
| hybrid-source-dependencies-v1 | Hübriid, kuni 4 sisulise sõltuvuse lisandust ja 16 sõltuvussammu. | 9 |
| vector-source-dependencies-v1 | Vektor, sama piiratud sisuliste sõltuvuste laiendus. | 9 |

Graaf võib tuua kaugema tekstikoha, erandi või tingimuse, kuid säilitab selle allika ja kontrollimata staatuse. all tähendab kõiki tingimusi, any lubatud alternatiive. Ligipääsuta/puuduva sihi, tsükli või mahu ületamise korral jääb puuduv kontekst nähtavaks; seda ei täideta oletusega.

## 5. Vastamine ja vestluse olek

| Fail kaustas lib/rag-v2/pilot | Mida teeb |
| --- | --- |
| [config.js](../../lib/rag-v2/pilot/config.js) | Loeb lubatud kasutajate M4 plaani; kontrollib mudelit, indeksipõlvkonda, profiili, teostus-/skeemiräsisid, tähtaegu, eelarvet ning lugemise/käivitamise õigust. |
| [contracts.js](../../lib/rag-v2/pilot/contracts.js) | Küsimuse, vastuse ja mudelipäringu lepingud; prompt, range vastuseskeem, viidete/väitekuju kontroll ning reservatsiooni ja vastuse auditi helperid. |
| [service.js](../../lib/rag-v2/pilot/service.js) | M4 töö põhivoog: idempotentne algus, kontekst, päringuvektor, otsing, mudelikutse, vastuse/viidete kontroll, avaldamine ja taastamine. |
| [retrieval.js](../../lib/rag-v2/pilot/retrieval.js) | Ühendab M4 teenuse päris PostgreSQL/Qdranti/poliitikaga; preflight, otsing ja kanooniliste viidete lahendamine. Sisaldab eraldatud testtranspordi rada. |
| [provider.js](../../lib/rag-v2/pilot/provider.js) | Responses/Embeddings HTTP-kutse, tähtaeg, vastuse suuruse/kuju, mudeli ja kasutusarvestuse kontroll; annab edasi mõõtmised ja tundmatu tulemuse. |
| [store.js](../../lib/rag-v2/pilot/store.js) | SotsiaalAI Prisma-püsistus: Conversation/ChatTurn/M4PilotTurn, samal intentsioonil topelttöö vältimine, ühine kululeger, avaldamise tehing, vahemälu ja aegunud sisu koristus. |
| [lifetime.js](../../lib/rag-v2/pilot/lifetime.js) | Aegumise ja säilitusaja arvutamine ning kehtivate ridade filter; null tähendab selgesõnaliselt seadistatud ajapiiri puudumist. |
| [dialogue.js](../../lib/rag-v2/pilot/dialogue.js) | Piiratud jätkuvestlus: teema/inimese ulatus, parandused, valitud varasem vastusepunkt, otsingupäring ja eraldi dialoogikontekst. |
| [presentation.js](../../lib/rag-v2/pilot/presentation.js) | Versioonitud vastuse renderdamine ja tekstisiseste viitemärkide reeglid; säilitab varem talletatud vastuseversioonide lugemise. |
| [provenance.js](../../lib/rag-v2/pilot/provenance.js) | Moodustab M4 teostusmanifesti ja räsi, mille külge käivitusplaan seotakse. |
| [fixed-packet.js](../../lib/rag-v2/pilot/fixed-packet.js) | Lubatud külmutatud tõendipaketi lugemine piiratud katses; seob paketi räsi ja küsimuse plaaniga. |
| [evidence-draft.js](../../lib/rag-v2/pilot/evidence-draft.js) | Valikuline tõendiga seotud vastusemustandi leping: tsitaadid või serveri segmendi-ID-d, nende kontroll ja tavapärasesse vastusekujusse teisendus. |
| [evidence-segments.js](../../lib/rag-v2/pilot/evidence-segments.js) | Annab olemasolevale tõenditekstile serveri loodud segmendid ja tunnused, mida mustand saab valida täpse allikaseosega. |
| [test-transport.js](../../lib/rag-v2/pilot/test-transport.js) | Deterministlik arenduse vastuseadapter; ei tee tasulist mudelikutset ega tõenda semantilist kvaliteeti. |

M4 pärisraja praegune konfiguratsioon lubab koodis mudelit gpt-5.6-luna ning Responses API ranget struktureeritud vastust. Päringuvektor kasutab text-embedding-3-large mudelit ja 3072 mõõdet. Need on olemasoleva teostuse piirangud; master ei määra mudeli hetkehinda. Teadmismustandi mudel on eraldi adminiseadistuse osa.

Vastus on plokkidena, millel on tekst, väite liik ja viited. Allikast võetud fakt, piiratud järeldus ja täpsustust vajav osa peavad jääma eristatavaks. Kood kontrollib kuju, lubatud viiteid ja võimaliku tõendimustandi täpseid vasteid. Tsitaadi olemasolu või skeemi läbimine ei tõenda iseseisvalt, et vastuse kogu mõte tuleneb allikast.

### Püsistus ja katkestused

| Olek või sündmus | Tähendus |
| --- | --- |
| claimed | Sama kasutaja intentsioon on vastu võetud; kordus leiab sama töö. |
| embedding_reserved / answer_reserved | Katse, tokenid ja kulu on enne väliskutset püsivalt reserveeritud. |
| embedding_sent / answer_sent | Kutse saatmine on märgitud; tulemus võib olla teadmata. |
| needs_recovery | Valideeritud vastusemustand on salvestatud, kuid vestlusse avaldamine vajab taastamist. |
| completed | Vastus ja seosed on avaldatud; lugemine kontrollib viiteid ning õigusi uuesti. |
| unknown / stopped / answer_rejected | Tulemus jäi teadmata või kontroll peatati. Automaatne uus tasuline katse ei tohi seda varjata. |

M4PilotTurn hoiab privaatset küsimust, tõendipaketti, vastust ja auditit. Tavalistesse ConversationMessage kirjetesse kirjutatakse kaitstud piloodi kohatäide ja M4 tunnus. Sisu taastatakse õigustega piiratud M4 raja kaudu. M4PilotLedger sisaldab ühiseid sisuta reserveeringuid; vestluse kustutamine ei lähtesta kasutatud eelarvet. Aegunud/arhiivitud vestluse payload ja päringuvektor eemaldatakse eraldi piloodikoristuses.

Jätkuvestlus eristab uut teemat, sama teemat, parandust ja uut inimest. Varasema assistendivastuse valitud punkt on dialoogi osa; see tuleb uuesti allikatega põhjendada. Varasem vastus ei muutu iseseisvaks faktiallikaks. Konteksti mahu ületamisel säilitatavat parandust ei lõigata vaikselt ära.

## 6. Haldus ja SotsiaalAI ühendused

### Admini sissevõtt ja teadmismustand

| Fail | Mida teeb |
| --- | --- |
| [lib/rag-v2/admin/config.js](../../lib/rag-v2/admin/config.js) | Lubatud adminid/dokumendid, privaatsed kaustad, tähtajad, faili-/API-/tokeni-/kulupiirid ja valikuline teadmiskoostamise seadistus. |
| [lib/rag-v2/admin/auth.js](../../lib/rag-v2/admin/auth.js) | Kontrollib värske sessiooni ja kasutajakirje adminiõigust, peatamist ning sessiooniversiooni kooskõla. |
| [lib/rag-v2/admin/http-body.js](../../lib/rag-v2/admin/http-body.js) | Sama päritolu nõue, voogedastatud päringukeha mahu piir ja turvaline multipart/JSON vastuvõtt. |
| [lib/rag-v2/admin/intake.js](../../lib/rag-v2/admin/intake.js) | PDF-i ettevalmistus, töö vastuvõtukviitung, failide/teksti vaatamine, teadmismustandi valiku rakendamine, avaldamisplaan, kulureserv ja indeksi avaldamine. |
| [lib/rag-v2/admin/knowledge-jobs.js](../../lib/rag-v2/admin/knowledge-jobs.js) | Mudelist teadmismustandi püsiv töö- ja kululeger; kordusklikk ei telli sama plaani uuesti ning tundmatu vastus jääb peatuseks. |
| [lib/admin/rag/v2Server.js](../../lib/admin/rag/v2Server.js) | Seob NextAuth/Prisma kasutaja uue IntakeService’iga; teeb sessiooni ja konfiguratsiooni korduskontrolli ning määrab PDF-worker’i asukoha. |
| [app/api/admin/rag/v2/intake/route.js](../../app/api/admin/rag/v2/intake/route.js) | POST: PDF+metadata ettevalmistus, prepareKnowledge, applyKnowledge ja publish. GET: seadistuse/töö seis ja lubatud tööartefaktid. |
| [app/admin/rag/ingest/page.jsx](../../app/admin/rag/ingest/page.jsx) | Uue vastuvõtu admini leht; rollikontroll ja tööpinna avamine. |
| [components/admin/rag/RagAdminIntakeWorkspace.jsx](../../components/admin/rag/RagAdminIntakeWorkspace.jsx) | Üleslaadimine, metaandmete ülevaatus, teksti/hoiatuste kuvamine, teadmismustandi toimingud ja läbivaadatud plaani avaldamine. |
| [components/admin/rag/RagAdminKnowledgePanel.jsx](../../components/admin/rag/RagAdminKnowledgePanel.jsx) | Väite-/sõltuvuskandidaatide, tsitaatide ja lünkade ülevaatus ning haldaja valik. |
| [components/admin/rag/ragV2Metadata.js](../../components/admin/rag/ragV2Metadata.js) | Admini metaandmevormi ja JSON-impordi teisendus; ei asenda tuuma metadata-adapter.js kontrolli. |
| [components/admin/rag/ragV2IntakeCopy.js](../../components/admin/rag/ragV2IntakeCopy.js) | Uue vastuvõtu eesti/inglise/vene tekstid ning tehniliste veakoodide kasutajale arusaadav esitus. |
| [components/admin/rag/ragV2Intake.module.css](../../components/admin/rag/ragV2Intake.module.css) | Vastuvõtu ja teadmismustandi tööpinna kujundus. |

Admini praegune rada on: lubatud PDF ja metaandmed → allika kasutamise kinnitus → ingest → teksti/päritolu ülevaatus → valikuline teadmismustand → haldaja valik → külmutatud avaldamisplaani ülevaatus → vektorid ja uus indeks. Faili töötlemine, teadmismustandi mudelikutse ning indeksi avaldamine on eri toimingud. Koostamise või avaldamise nupud ei tohi kasutada piiramata automaatset korpusejooksu.

Seadistus lubab konkreetseid admini kasutajaid ja dokumendiidentiteete. Muutunud allikaversioon või läbivaatamata plaan peatab avaldamise; ebaõnnestunud indeksi avaldamist saab salvestatud vektoritega jätkata. Uus põlvkond ei tohi olemasolevaid aktiivseid dokumente juhuslikult välja jätta. Täpsed piirid ja kviitungid kuuluvad teenuse, mitte brauseri usalduse alla.

### Vestlus, allikad ja katsevaade

| Fail | Mida teeb |
| --- | --- |
| [app/api/chat/route.js](../../app/api/chat/route.js) | Autentimine ja päringupiir; x-rag-pilot päisega pöördumine antakse M4 adapterile. Tavaline uue genereerimise rada tagastab endiselt RAG_RETIRED. |
| [app/api/chat/pilot/route.js](../../app/api/chat/pilot/route.js) | M4 tööde lugemise, konteksti ja taastamise halduse HTTP-wrapper. |
| [lib/chat/m4PilotServer.js](../../lib/chat/m4PilotServer.js) | Seob HTTP, kasutaja sessiooni, Prisma, M4 seadistuse, teenuse ning vestluse/allikaviite GET-vastused. |
| [lib/chat/m4PilotClientContract.js](../../lib/chat/m4PilotClientContract.js) | Teisendab valminud M4 vastuse ja allikad tavavestluse sõnumi-/allikakujusse, säilitades ajaloo olekud ja source_locations väljad. |
| [lib/chat/m4PilotIntent.js](../../lib/chat/m4PilotIntent.js) | Salvestab kliendis sisuta intentsiooni ja kontekstivaliku tunnused, et värskendamine ei saadaks sama tööd uuesti. |
| [app/vestlus/page.js](../../app/vestlus/page.js) | Lubab määratud kasutajale seadistatud piloodirežiimi ning annab selle ChatBody ja külgpaneeli sisendiks; ruumivestluses see haru ei rakendu. |
| [components/chat/hooks/useChatStream.js](../../components/chat/hooks/useChatStream.js) | Ühendab tavavestluse saatmise M4 päiste, intentsiooni ja lõpliku piloodivastusega. |
| [components/chat/hooks/usePilotDialogue.js](../../components/chat/hooks/usePilotDialogue.js) | Loeb/hoiab piiratud vestluskonteksti ning taastab kasutaja kontekstivaliku. |
| [components/chat/PilotContextControls.jsx](../../components/chat/PilotContextControls.jsx) | Teema, paranduse, uue inimese ja vastusepunkti kontekstivalikud. |
| [components/chat/PilotContextControls.module.css](../../components/chat/PilotContextControls.module.css) | Kontekstijuhikute kujundus. |
| [components/alalehed/chat/ChatBodyView.jsx](../../components/alalehed/chat/ChatBodyView.jsx) | Üldine vestluse tööpind; kuvab piloodirežiimi ja sellega seotud juhikud. |
| [components/alalehed/chat/ChatSourcesPanel.jsx](../../components/alalehed/chat/ChatSourcesPanel.jsx) | Olemasolev „Vastuste allikad” paneel ning allika/veateate kasutajaliides. |
| [components/chat/hooks/useConversationSources.js](../../components/chat/hooks/useConversationSources.js) | Vestluse allikaloendi kogumine/hoidmine. |
| [components/chat/utils/sources.js](../../components/chat/utils/sources.js) | Allikakirjete normaliseerimise ja identiteedi abifunktsioonid. |
| [app/chat-source/page.jsx](../../app/chat-source/page.jsx) | Kuvab õigusega piiratud, konkreetse vastuseviite algteksti ja versiooni; PDF-il päris lehed, muudel vormingutel allikakohad. |
| [app/rag-pilot/page.jsx](../../app/rag-pilot/page.jsx) | Eraldi piiratud M4 katselehe serveripoolne sissepääs ja konfiguratsioonikontroll. |
| [app/rag-pilot/pilot-client.jsx](../../app/rag-pilot/pilot-client.jsx) | Katsevaate küsimused, taastamine, mõõtmised ja allikad. |
| [app/rag-pilot/pilot.module.css](../../app/rag-pilot/pilot.module.css) | Eraldi piloodivaate kujundus. |

Brauseri diagnostika krüptograafiata lepingud: [questionRequirementsContract.js](../../lib/chat/questionRequirementsContract.js), [responsePolicyContract.js](../../lib/chat/responsePolicyContract.js) ja [sourceSelectionContract.js](../../lib/chat/sourceSelectionContract.js). Nende serverimoodulid säilitavad räside loomise ja valideerimise; eristus väldib `node:crypto` jõudmist kliendipakki.

Päis x-rag-pilot ei ole iseseisev ligipääsuluba: server kontrollib kasutajat, konfiguratsiooni, dokumentide õigusi ja plaani. GET /api/chat tagastab praegu tavalise genereerimisraja generationAvailable=false; see ei kirjelda eraldi lubatud M4 haru puudumist. Uue indeksipõlvkonna avaldamine ei vaheta automaatselt vestluse kinnitatud generationId ja documents valikut.

### Platvormi tugimoodulid ja teostusmanifest

Need failid ühendavad M4 olemasoleva rakendusega ning kuuluvad teostusmanifesti. Nende muutmine võib muuta kinnitatud käivitusplaani räsi ka siis, kui lib/rag-v2 faile ei muudeta.

| Fail | Vastutus ühenduses |
| --- | --- |
| [auth.js](../../auth.js) ja [lib/auth](../../lib/auth) | Platvormi sessioon ja autentimise abimoodulid; kasutaja identiteet jõuab M4 serveriadapterisse. |
| [lib/prisma.js](../../lib/prisma.js) | Platvormi andmebaasi ühendus vestluse ning M4 püsistuse jaoks. |
| [lib/chat/routeServerUtils.js](../../lib/chat/routeServerUtils.js) | Vestluse HTTP-raja ühised abifunktsioonid, sealhulgas vahemälu keelavad vastusepäised. |
| [lib/chat-api-rate-limit.js](../../lib/chat-api-rate-limit.js) | Vestluse päringusageduse piiramine ja piirangu HTTP-vastus. |
| [components/alalehed/ChatBody.jsx](../../components/alalehed/ChatBody.jsx) | Seob vestluse oleku, saatmise ja piloodijuhikud nähtava tööpinnaga. |
| [components/chat/hooks/useChatConversationState.js](../../components/chat/hooks/useChatConversationState.js) | Vestluse laadimine ja taastamine ning kliendis hoitav vestlusolek. |
| [components/ChatSidebar.jsx](../../components/ChatSidebar.jsx) | Vestluste loend ja valimine; piloodis vestluse loomine/leidmine M4 HTTP-raja kaudu. |
| [lib/retention.js](../../lib/retention.js) | Platvormi säilitustöö ühendus PilotStore'i aegumise koristusega. |
| [package.json](../../package.json), [package-lock.json](../../package-lock.json), [prisma/schema.prisma](../../prisma/schema.prisma) ja [messages](../../messages) | Käivitusleping, sõltuvused, platvormi andmemudel ning manifesti kaasatud et/en/ru sõnumikataloogid. |

Manifesti täpne failivalik asub [pilot/provenance.js](../../lib/rag-v2/pilot/provenance.js): nimetatud platvormifailidele lisatakse lib/rag-v2, lib/auth, app/api/chat/pilot ja app/rag-pilot kaustade JS/JSX/JSON/CSS-failid. Tüübid, hindamisfailid ja inimeste vastuvõtuotsused ei kuulu sellesse runtime-manifesti. Räsi seob plaani teostusega; see ei tõenda ise käitumise õigsust ega serverisse jõudmist.

### Säilinud platvormifunktsioonid ja edasised ühendused

| Pind | Seos uue RAG-iga |
| --- | --- |
| /admin/rag ja [RagAdminLandingWorkspace.jsx](../../components/admin/rag/RagAdminLandingWorkspace.jsx) | Halduskeskus, kontaktiregister ja kasutaja käivitatav enesetest. Uue vastuvõtu leht on /admin/rag/ingest. |
| [app/api/rag/selftest/route.js](../../app/api/rag/selftest/route.js) | Käsitsi enesetesti sissepääs on säilinud; praegune kood tagastab ausa retired oleku ja 503, ilma mudelikutseta. Uue terviserajaga ühendamine on eraldi töö. |
| /admin/rag/kov, /admin/rag/organizations ja /api/admin/rag/contact-registry | Kogutud algfailide ja registrite haldus. Nende olemasolu ei tähenda, et kogu sisu oleks RAG v2 indeksis. |
| /admin/rag/documents, /admin/rag/source-packages | Säilinud varasema süsteemi halduspinnad; uue v2 korpuse täielikku haldust need veel ei tõenda. |
| /admin/rag/source-feedback; /api/source-feedback; /api/admin/source-feedback | Salvestatud allikate ja vastuste tagasiside. Uus kanooniline viide peab siin säilitama oma versiooni ja õigused. |
| /documents, /documents/artifacts, /materjalid | Faili omand, hoidmine, nõusolek, ülevaatus, muutmine ja kustutamine on platvormi funktsioonid. Uue korpuse elutsükliga sidumine tuleb eraldi vastu võtta. |
| /api/chat/analyze-file; /api/documents/artifacts/generate ja refine; /api/research/jobs | Failianalüüsi, dokumendiloome ja süvauuringu võimalikud uued ühendused; v2 M4 piloot ei tähenda nende kõigi taastamist. |
| Kovisioon, praktikad, teenuseprofiilid ja teenuspäeviku mustand | Rakenduse teised teadmustoe tarbijad; nende omandit, töövoogu ja kasutajaandmete piire ei viida RAG-tuuma. |

## 7. Andmelepingud ja hoidlad

### Olulised mõisted

| Objekt/väli | Tähendus |
| --- | --- |
| tenant | Eraldi korpuse/õiguste ruum; kliendiadapter peab siduma selle päris organisatsiooni õigustega. |
| document.id | Allika püsiv dokumendiidentiteet. Ühel JSON-paketil võib olla mitu eraldi dokumendiks valitud kirjet. |
| version.id | Konkreetne muutumatu algfaili, metaandmete, töötluse ja profiili tulemus. Teadmiskirjete muutus loob uue versiooni. |
| source_hash / metadata_hash | Algfaili ja metaandmevara SHA-256. Ainult failiräsi ei otsusta eri kirjete semantilist identiteeti. |
| source_units | Allikast eraldatud tekstiüksused koos täpse asukohaga: PDF-leht, DOM-i element, XML-i element või JSON Pointer. |
| spans | Täpsed UTF-16 algus-/lõppvahemikud lähteüksuses; PDF-il lisaks koordinaadid ja tegelik leht. |
| blocks / sections | Lõik, pealkiri, loendi element, tabelirida, õigusnorm või kirje koos dokumendistruktuuriga. |
| chunks | Otsingutekstiosad: algtekst, eraldi pealkirjakontekst, span-ID-d, allikakohad, kirjegrupp ja lubatud naabrid. |
| relations | Parseri kontrollitud struktuurseosed. Need ei ole semantiline tõestus. |
| knowledge_cards / dependencies / knowledge_gaps | Ankurdatud teadmiskandidaadid, suunatud sisulised sõltuvused ning lahendamata lüngad. |
| source_generation | Kohaliku failiregistri dokument→versioon pilt. |
| search_generation | Selle allikapildi, otsingukonfiguratsiooni ja vektoriruumi põhjal loodud avaldatav indeksipõlvkond. |
| evidence / reference_map | Päringus valitud algtekst ning selle kanoonilised seosed dokumendi, versiooni, chunk’i, span’ide ja allikakohtadega. |
| rights / provenance / search_aids | Kasutuspiir, väärtuse päritolu ja algtekstist eristatud otsinguabi. Tundmatu väärtus jääb tundmatuks. |

Praegune failikuju on rag-v2/2; varasem PDF-i rag-v2/1 jääb loetavaks. Veebi-/XML-/JSON-kirjetele ei tekitata PDF-lehti. Trükilehekülg, PDF-lehekülg, avaldamisaeg, kogumise/kontrollimise aeg ja õiguslik kehtivus on eraldi väärtused. Olemasolev õiguste leping on local_private + development_only; see ei ole veel üldine tootmise litsentsi- ja nõusolekumudel.

### Failihoidla

~~~text
<store>/tenant_<hash>/
├── active.json                 dokumentide aktiivsed muutumatud versioonid
├── writer.lock                 selle hoidla ühe kirjutaja lukk
├── jobs/<attempt>.json          ühe ingesti töö olekud ja vead
├── staging-<id>/                veel avaldamata kirjutus
└── versions/version_<hash>/
    ├── original.pdf|html|xml|json  täpselt üks muutmata algvara
    ├── metadata.json           säilitatud metaandmevara
    ├── bundle.json             kogu normaliseeritud allikaversioon
    ├── provenance.json         väljade päritolu
    ├── spans.json              täpsed tekstivahemikud
    ├── chunks.json             otsingutekstiosad
    ├── report.html             kohalik läbivaatuse aruanne
    └── manifest.json           kõigi versioonifailide kontrollsummad
~~~

Admini workRoot sisaldab eraldi tööde kviitungeid, külmutatud plaane, mudelivastuseid ning budget.json/knowledge-budget.json kululegereid. Embedding-piloodi usage kataloog säilitab sisendi manifesti, reserveeringud ja räsiga kontrollitavad vektorifailid. Need võivad sisaldada algteksti; neid ei majutata public/ all ega lisata vaikimisi Git-repositooriumi.

### Andmebaasid

| Hoidla/tabel | Vastutus |
| --- | --- |
| Eraldi RAG-i PostgreSQL: rag_v2_document | Tenant’i dokumendid ja välised tunnused. |
| rag_v2_version | Muutumatud bundle’id, nende räsid ja algvarade kirjeldused. |
| rag_v2_object | Versiooni struktuuri- ja teadmiskihi objektid/seosed. Graafi andmed paiknevad siin ning bundle’is. |
| rag_v2_generation | Indeksipõlvkonna allikapilt, konfiguratsioon, Qdranti kollektsioon, olek ja oodatud maht. |
| rag_v2_head | Tenant’i aktiivse põlvkonna viit ja avaldamisjärjekord. |
| rag_v2_generation_document | Põlvkonna konkreetne dokument→versioon vastendus. |
| rag_v2_unit | Leksikaalse otsingu indeksikirje, pealkiri, autorid, algtekst, otsinguabi ja tsvector. |
| rag_v2_vector_cache | Tenant’i/konfiguratsiooni/sisendiräsiga seotud vektorite taaskasutus. |
| Qdrant | Tenant’i ja põlvkonna kaupa eraldi kollektsioonid; vektorid ja kontrollitavad dokumendi-/versiooni-/sisenditunnused. |
| Platvormi Prisma: Conversation, ConversationMessage, ChatTurn | SotsiaalAI kasutaja vestlus, sõnumite identiteet ja töö elutsükkel. |
| M4PilotTurn | Kaitstud M4 küsimus, vastus, tõendid, audit ja aegumine. |
| M4PilotLedger | Sisuta ühine API-kulu/katsete reserveering, mis säilib vestluse kustutamisel. |

| Skeemi/käitamise fail | Vastutus |
| --- | --- |
| [prisma/rag-v2/schema.prisma](../../prisma/rag-v2/schema.prisma) | Eraldatud otsinguandmebaasi mudelid. |
| [prisma/rag-v2/prisma.config.mjs](../../prisma/rag-v2/prisma.config.mjs) | Eraldi migratsioonikonfiguratsioon RAG_V2_DATABASE_URL jaoks; puudub varuühendus platvormi DATABASE_URL peale. |
| [202609050001_local_search/migration.sql](../../prisma/rag-v2/migrations/202609050001_local_search/migration.sql) | Otsingu tabelid, SQL-i terviklusreeglid ja tekstindeks. |
| [migration_lock.toml](../../prisma/rag-v2/migrations/migration_lock.toml) | Selle migratsioonipuu PostgreSQL-i pakkuja lukk. |
| [prisma/schema.prisma](../../prisma/schema.prisma) | Platvormi skeem koos M4 pilooditabelitega; vanade RagDocument/RagEntity tabelite olemasolu ei tähenda, et uus tuum neid kasutaks. |
| [20260906000100_m4_private_pilot/migration.sql](../../prisma/migrations/20260906000100_m4_private_pilot/migration.sql) | M4 eraandmete ja kululegeri tabelid platvormis. |
| [20260907000100_m4_optional_expiry/migration.sql](../../prisma/migrations/20260907000100_m4_optional_expiry/migration.sql) | M4 tähtaja ja säilitusaja selgesõnalise puudumise tugi. |
| [deploy/rag-v2/compose.yml](../../deploy/rag-v2/compose.yml) | Digestiga määratud PostgreSQL/Qdrant konteinerid, loopback-pordid, võtmed/paroolid ja eraldi andmeköited. |

## 8. Korpus ja allikate päritolu

Sisendi lähtekoht on [Andmebaasi/REGISTER.md](../../Andmebaasi/REGISTER.md) ja [REGISTER.json](../../Andmebaasi/REGISTER.json). 07.09 korrastatud registris on 2529 failikirjet; arvud allpool pärinevad registrist. See ei ole aktiivse indeksi dokumentide arv.

| Kaust | Sisend ja tähendus |
| --- | --- |
| Andmebaasi/ajakiri_sotsiaaltoo/ | 892 artikli metaandmed ja allikad: 849 PDF-i ning 43 HTML-i. Ajakirja bibliograafia alus on omaniku kinnitatud serverihoidla; parandatud artiklifailid on seotud vastava kirjeldusega. |
| Andmebaasi/juhendid_ja_uuringud/ | 185 eri PDF-i koos metaandmetega; serveri võrdlusvalimi kõik 170 juhendifaili on kohalikult räsiga vastendatud. |
| Andmebaasi/KOV/ | 78 kogutud KOV-paketti koos päritolu ja kontrollmetaandmetega. Pakett sisaldab mitut teenust/soodustust/kontakti; üks fail ei võrdu tingimata ühe sisulise dokumendiga. |
| Andmebaasi/oigusaktid/ | 104 eri XML-faili. Identiteet ja redaktsioon loetakse XML-i sisust; failinimi või vana is_current_version märge ei tõenda tänast kehtivust. |
| Andmebaasi/organisatsioonid/ | Astangu organisatsioonipakett, eraldi teenuse-, ressursi-, kontakti- ja dokumendikirjed. |
| Andmebaasi/kontaktid/ | Kontaktide lookup-sisend, sh varasem 1130 kirjega koond. Roll on reference_lookup; automaatne lisamine väidete põhikorpusesse ei ole sama toiming. |
| Andmebaasi/taastatud_allikad/ | 22 taastatud võrdlusallikat rolliga review_source; tuleb enne põhikorpusega liitmist vastendada. |
| Andmebaasi/register/ | Allika-/korjeplaani registrid; need kirjeldavad allikaid, ei ole ise teadmusdokumendid. |
| Arhiiv/Andmebaasi_2026-09-07/ | Kõik 2711 korrastuseelset faili ja taastatav eelnev struktuur; seal säilivad ka 5011 vana indeksi tekstikirje taastatud lõigud. |

Omaniku artiklitöö **docs/ajakiri/_sotsiaaltoo/** jääb sellest korpusetööst välja. Üldist uut veebikorjet ei eeldata: kogutud KOV-sisu, kontaktid ja serveri algfailid on olemas. Uut korjet on vaja konkreetse tõendatud lünga või ajakohastamise jaoks.

Uues impordis säilivad algfail, URL, autor, väljaandja, aasta, geograafia, varasemad tunnused ja kontrollmärkused koos päritoluga. Tekstiosad, ankrud, teadmiskandidaadid ja indeks luuakse kontrollitud uue lepingu järgi. Vektor taaskasutatakse ainult sobiva sisendi, mudeli, seadistuse ja õiguse korral. Vana tekstilõik või KOV-kirjeldus ei muutu ümbernimetamisega ametliku veebilehe sõnasõnaliseks tsitaadiks.

Konfliktne metaandmepakett, XML-i failinime ja aktiviite erinevus ning varem taastatud lisakirjed vajavad vastendamist. Registri source-kirje, metadata-kirje, source_register ja source_planning_register rollid on eraldi. Täpne sisendiarvestus ja impordiotsus: [ADR-009](../rag-v2/adr-009-corpus-rebuild.md).

**07.09 serverimõõtmine:** uus aktiivne indeks sisaldas 8 dokumenti / 69 tekstiosa. Vana RAG-teenus oli peatatud, algfailihoidla säilis ning vestluse konfiguratsioon viitas vanemale põlvkonnale. Adminiseadistus oli ajutine. Mõõtmine kirjeldab seda kuupäeva; uue M1 plokiga serverit, vana korpust ega konfiguratsiooni ei muudetud. [Mõõtmistulemus](../rag-v2/ingest-runtime-snapshot-2026-09-07.json).

**08.09 kooskõla kordusmõõtmine:** server oli endiselt `9780dee9c`, allikaregister vastas 8 dokumendi / 69 tekstiosa aktiivsele indeksile `cce615ab…`; M4 plaan valis `386d5177…` ning kaks varasemat dokumendiversiooni. Tegelik preflight andis `active_index_mismatch`. Adminiseadistus aegus 08.09 kell 00:00 UTC. Serverit ei muudetud; kooskõlastatud uue plaani ja hooldus-rollback'i sammud on [raportis](rag-v2-release-integration-2026-09-08.md).

## 9. Seadistus, käivitamine ja taastamine

### CLId ja nende ulatus

| Fail | Mida teeb |
| --- | --- |
| [scripts/rag-v2-ingest.mjs](../../scripts/rag-v2-ingest.mjs) | Ühe allika ingest antud sisendjuure ja metaandmefaili järgi; ei tee väliseid mudelikutseid. |
| [scripts/rag-v2-ingest-registered.mjs](../../scripts/rag-v2-ingest-registered.mjs) | Üksikallika ingest REGISTER.json kaudu; valikuline --item piirab KOV-/JSON-paketi kirje. |
| [scripts/rag-v2-local.mjs](../../scripts/rag-v2-local.mjs) | Eraldatud kohalike PostgreSQL/Qdranti teenuste up, migrate, validate ja stop; loob kohaliku privaatse ühendusseadistuse. |
| [scripts/rag-v2-search.mjs](../../scripts/rag-v2-search.mjs) | CLI indeksipildi avaldamiseks või päringuks kohaliku õiguspoliitika ja ühendustega. Päringu väljund on tõendipakett. |
| [scripts/rag-v2-evaluation-plan.mjs](../../scripts/rag-v2-evaluation-plan.mjs) | Algse M2.2 valimi allikate, küsimuste ja tokenite kulupõhine prooviplaan. |
| [scripts/rag-v2-pilot.mjs](../../scripts/rag-v2-pilot.mjs) | M2.2 embedding-piloodi kuivjooks; --execute kasutab eraldi kinnitatud manifesti, luba ja hinnakirjet. |
| [scripts/rag-v2-multi-source.mjs](../../scripts/rag-v2-multi-source.mjs) | M2 mitme allika ettevalmistus/taaskasutusplaan; eraldi --mechanics testvektoritega päristeenustele ning --execute lubatud pärisvektoritele. |
| [scripts/rag-v2-selection-compare.mjs](../../scripts/rag-v2-selection-compare.mjs) | Kordab salvestatud kandidaatide valikut olemasoleva järjestus-/kontekstiloogikaga; ei telli uusi embedding’uid. |
| [scripts/rag-v2-regrade.mjs](../../scripts/rag-v2-regrade.mjs) | Rubriigi ja käsitsi läbivaatuse alusel olemasolevate katsetulemuste kordushindamine. |
| [scripts/lib/rag-v2-rubric-proposal.mjs](../../scripts/lib/rag-v2-rubric-proposal.mjs) | Selle hindamiskomplekti rubriigiettepaneku andmed. Need ei lähe runtime-otsingusse. |
| [scripts/rag-v2-pilot-plan.mjs](../../scripts/rag-v2-pilot-plan.mjs) | M4 piiratud küsimus-/materjali-/mudeliplaani koostamine varasema valimi põhjal; ei aktiveeri pilooti ega anna väliskutse luba. |
| [scripts/rag-v2-m4-regression-plan.mjs](../../scripts/rag-v2-m4-regression-plan.mjs) | M4 regressioonikatse külmutatud sisendite ja plaaniartefaktide koostamine. |

Käitus-/ingesti käsud kasutavad ühist tuuma. Mitmed hindamis- ja piloodiplaani skriptid viitavad ajaloolisele valimile ning selle tmp-artefaktidele; need ei ole veel üldine kogu korpuse partiitöötleja. Hindamisküsimused ja etalonid ei kuulu runtime-prompt’i ega otsingureeglite sisse.

### Seadistuse asukohad

| Seadistus | Vastutus |
| --- | --- |
| DEFAULT_CONFIG contracts.js failis | M1 vaikepiirid: algfail 20 MiB, metaandmed 1 MiB, kuni 250 PDF-lehte, 2 000 000 tekstimärki, 2200 märki tekstiosa kohta; parseri-/normaliseerimise-/chunkimise versioonid. |
| Valdkonnaprofiili JSON | Kliendi kuunimed, sildid ja kontrollitud failide auditimärkused. |
| FilePolicy JSON | Tenant → subject → lubatud document-ID-d. HTTP-kasutaja seose lahendab SotsiaalAI adapter. |
| Kohalik connections.json | PostgreSQL-i ja Qdranti privaatne ühendusseadistus; kohalik CLI loob selle tmp/rag-v2-services alla. |
| RAG_V2_ADMIN_ENABLED ja RAG_V2_ADMIN_CONFIG | Admini uue vastuvõtu lüliti ning absoluutne tee valideeritavale serverikonfiguratsioonile. |
| Admini konfiguratsiooni knowledgePreparation | Ühe dokumendi teadmismustandi mudel, mahud, hinnad ja eraldi koondkulu piir. Puudumisel mudeliga koostamine ei käivitu. |
| M4_PILOT_ENABLED ja M4_PILOT_CONFIG | M4 lüliti ning kasutajaid, dokumente, põlvkonda, profiili, küsimusi, mudelit, tähtaegu ja eelarvet siduv plaan. |
| OPENAI_API_KEY / OPENAI_MODEL | Päris mudeliraja serveriseadistus. Võtit ei kirjutata dokumentatsiooni, kliendikoodi ega loakirjesse. |
| RAG_V2_DATABASE_URL | Eraldi RAG-i Prisma migratsiooni ühendus; platvormi DATABASE_URL kasutatakse SotsiaalAI enda püsistuses. |

Koodis määratud kohalikud teenused on PostgreSQL 16.13 aadressil 127.0.0.1:55432 ning Qdrant 1.15.5 aadressil 127.0.0.1:56333. Compose määrab eraldi köited ja digestiga lukustatud pildid. See kirjeldab repositooriumi konfiguratsiooni; teenuste hetkeaktiivsust tuleb mõõta. Rakenduse dev-käsk on projekti juhiste järgi npm run dev.

### Ühe registreeritud allika kohalik vastuvõtt

Järgmine käsk kirjutab ainult privaatsesse arendushoidlasse ega telli mudelit/vektoreid. PowerShellis repositooriumi juurest:

~~~powershell
node scripts/rag-v2-ingest-registered.mjs --registry Andmebaasi/REGISTER.json --source 'oigusaktid/401112019012.xml' --tenant local-review --store tmp/rag-v2-local-review --development-only
~~~

KOV-paketi ühe kirje valimiseks lisatakse --item koos selles paketis oleva ID-ga. --profile lubab anda teise kliendi deklaratiivse profiili. Sisendjuur, source_path, õigused ja metadata kontrollitakse tuumas. Kõigi toetatud vormingute kohalik näidisvastuvõtt: [ADR-010](../rag-v2/adr-010-source-structure-and-chunking.md).

Kohalike eraldatud teenuste käivitamine ja skeemi paigaldamine on eraldi toimingud:

~~~powershell
node scripts/rag-v2-local.mjs up
node scripts/rag-v2-local.mjs migrate
node scripts/rag-v2-local.mjs validate
~~~

Täpsemad otsingu, lubatud embedding-katse ja ajalooliste katseartefaktide käitusnäited on [README-s](../rag-v2/README.md). Käesoleva masteri koostamiseks neid teenuse-/mudelikäske ei käivitatud.

### Avaldamine, kulu ja taastamine

Failiregistri avaldamine, otsinguindeksi aktiveerimine ja vestluse generationId valik on eraldi sammud. Uue allika failide olemasolust ei järeldu selle kättesaadavus vestluses. Uut indeksit aktiveerides säilib eelmine põlvkond kuni kontrollitud asenduseni; vanu versioone ega kollektsioone automaatselt ei kustutata.

Mudelitöö reserveerib katse, tokenid ja kululae enne saatmist. Tundmatu tulemuse korral ei tehta automaatset kordust. Sama manifesti uus väljundkaust ega vestluse kustutamine ei nulli kululegerit. Tegelik kasutus ja konservatiivne reserv on eraldi näidud. Praegune kogu korpuse tasuline jooks vajab tegeliku teksti mahu järgi koostatud eelarvet; varasema ühe dokumendi või katse luba ei laiene sellele automaatselt.

CLI tavavea järel saab sama sisendi uuesti käivitada ning taaskasutada kontrollitud muutumatut versiooni. catalog_busy puhul tuleb kontrollida konkreetse writer.lock PID-d ja töö olemasolu; tundmatut protsessi ei lõpetata. Varunduses tuleb säilitada tenant’i manifest, versioonid, algfailid ja tööjäljed koos. Taastamisel kontrollitakse räsid enne aktiivseks võtmist. M4 valideeritud mustandi taastamine ei vaja uut genereerimist. Täielik eri hoidlaid hõlmav tootmise taastamiskatse jääb M6 vastuvõttu.

## 10. Kontrollid, lepingud ja tõendid

### Kontrollide failikaart

Tabel ütleb, milline fail katab millist riski. See ei ole korraldus käivitada kõiki teste. Iga arendusplokk valib väikseima vajaliku kontrolli; teenuste ja mudelitega pärisrada eristatakse asendajatega testist.

| Fail kaustas tests | Mida kontrollib |
| --- | --- |
| [rag-v2-source-structure.test.mjs](../../tests/rag-v2-source-structure.test.mjs) | Uus PDF/HTML/XML/JSON-leping, veerud, Unicode, metaandmete päritolu, kirjepiirid ja täpsed üldised allikaviited. |
| [rag-v2-ingest.test.mjs](../../tests/rag-v2-ingest.test.mjs) | Algfail, identiteet, normaliseerimine, versioonid, kordusimport, ressursi-/failitee piirid ja katkestusest jätkamine. |
| [rag-v2-knowledge.test.mjs](../../tests/rag-v2-knowledge.test.mjs) | Teadmiskirjete ankrud, sõltuvused, indeksisse kandmine, graafilaiendus ja ligipääsu järelkontroll. |
| [rag-v2-knowledge-preparation.test.mjs](../../tests/rag-v2-knowledge-preparation.test.mjs) | Mudeli teadmismustandi plaan, täpsed tsitaadid, haldaja valik, kordus, eelarve ja muutunud allika tõrjumine. |
| [rag-v2-admin-intake.test.mjs](../../tests/rag-v2-admin-intake.test.mjs) | Admini konfiguratsioon, õigused, päringumahu piir, allikaversioon, kulu ja indeksi avaldamise taastamine. |
| [rag-v2-search.test.mjs](../../tests/rag-v2-search.test.mjs) | Otsingu, õiguste, kanalite, tokenite, põlvkonna ja viidete põhilepingud testiadapteritega. |
| [rag-v2-search.integration.test.mjs](../../tests/rag-v2-search.integration.test.mjs) | Eraldi kohaliku päris PostgreSQL/Qdranti indeks ja viidete/vektorite terviklus. Vajab neid teenuseid. |
| [rag-v2-selection.test.mjs](../../tests/rag-v2-selection.test.mjs) | Järjestatud valik, dokumendisildid, kontekstieelarve ja struktuurnaabrite lisamine. |
| [rag-v2-pilot.test.mjs](../../tests/rag-v2-pilot.test.mjs) | M2 embedding-piloodi manifest, luba, ledger, vektorite püsistus/taaskasutus ja kontrollitud kulupiir. |
| [rag-v2-rubric.test.mjs](../../tests/rag-v2-rubric.test.mjs) | Hindamisrubriigi, ankrute, läbivaatamisotsuste ja kordushindamise leping. |
| [rag-v2-pilot-core.test.mjs](../../tests/rag-v2-pilot-core.test.mjs) | M4 küsimuse/vastuse põhileping ja töövoo piirid. |
| [rag-v2-pilot-config.test.mjs](../../tests/rag-v2-pilot-config.test.mjs) | M4 käivitus-/lugemisplaani, kasutajate, mudeli, teostuse ja eelarve valideerimine. |
| [rag-v2-pilot-http.test.mjs](../../tests/rag-v2-pilot-http.test.mjs) | M4 HTTP-sissepääsu, autentimise ja päringukuju piirid. |
| [rag-v2-pilot-provider.test.mjs](../../tests/rag-v2-pilot-provider.test.mjs) | Mudelitranspordi vastuse, veaseisude, mahu ja kasutusarvestuse kontroll. |
| [rag-v2-pilot-store.test.mjs](../../tests/rag-v2-pilot-store.test.mjs) | M4 püsistuse, tehingute, reserveeringu ja õigusega piiratud avaldamise leping. |
| [rag-v2-pilot-replay.test.mjs](../../tests/rag-v2-pilot-replay.test.mjs) | Salvestatud M4 töö korduse/taastamise ja ajaloolise tulemuse lugemise piir. |
| [rag-v2-pilot-limit-replay.test.mjs](../../tests/rag-v2-pilot-limit-replay.test.mjs) | Eelarve ja etapikatsete piiride säilimine korduse korral. |
| [rag-v2-pilot-answer-v3.test.mjs](../../tests/rag-v2-pilot-answer-v3.test.mjs) | Vastuse v3 allikaväidete ja viidete leping. |
| [rag-v2-pilot-answer-v4.test.mjs](../../tests/rag-v2-pilot-answer-v4.test.mjs) | Vastuse v4 väiteliikide, piiri ja viidete leping. |
| [rag-v2-evidence-draft.test.mjs](../../tests/rag-v2-evidence-draft.test.mjs) | Tõendimustandi tsitaadi-/segmendivalik ja täpse allikaseose kontroll. |
| [rag-v2-dialogue.test.mjs](../../tests/rag-v2-dialogue.test.mjs) | Teema/inimese kontekst, parandused, otsingutekst ja varasema vastuse kasutamise piir. |
| [rag-v2-dialogue-config.test.mjs](../../tests/rag-v2-dialogue-config.test.mjs) | Jätkuvestluse plaani ning ajaloolise/aktiivse lepingu sobivus. |
| [rag-v2-dialogue-store.test.mjs](../../tests/rag-v2-dialogue-store.test.mjs) | Jätkuvestluse konteksti valik, püsistus ja ulatuste eraldatus. |
| [rag-v2-pilot-chat-adapter.test.mjs](../../tests/rag-v2-pilot-chat-adapter.test.mjs) | M4 tulemuse sidumine tavavestluse sõnumite, allikate ja taastatava intentsiooniga. |

[lib/rag-v2/evaluation/rubric-v2.js](../../lib/rag-v2/evaluation/rubric-v2.js) valmistab ette ja kontrollib allikaankrutega hindamisrubriigi, ülevaatuspaketi ning inimotsused; selle järgi arvutatakse olemasoleva tulemuse sisutoe hinnang. [tests/evaluation/](../../tests/evaluation) sisaldab küsimusi, korpuse vastendusi, ankruid ning arendus-/kontrolljaotusi. Küsimuse oodatud vastus ei tohi kujundada konkreetse artikli runtime-erandit. Korpuse semantilise hindamise uus ring on eraldi töö.

### Lepingute register

| Fail kaustas docs/rag-v2 | Mille jaoks lugeda |
| --- | --- |
| [repository-audit.md](../rag-v2/repository-audit.md) | M0 lähterepositooriumi ja säilinud platvormi ühenduste ajalooline kaart. |
| [adr-001-local-ingestion.md](../rag-v2/adr-001-local-ingestion.md) | M1 algne PDF-i sissevõtu, identiteedi ja muutumatu versiooni leping. |
| [adr-002-local-hybrid-search.md](../rag-v2/adr-002-local-hybrid-search.md) | M2.1 eraldatud indeks, hübriidotsing, õigused ja põlvkonnad. |
| [adr-003-approved-embedding-pilot.md](../rag-v2/adr-003-approved-embedding-pilot.md) | M2.2 pärisembedding’u piiratud loa/kulu ja kompaktse tõendikonteksti leping. |
| [adr-004-multi-source-evaluation.md](../rag-v2/adr-004-multi-source-evaluation.md) | Mitme allika hindamine, ankrurühmad ja vektorite taaskasutus. |
| [adr-005-ranked-first-profiles.md](../rag-v2/adr-005-ranked-first-profiles.md) | M2.3 järjestatud valik ja versioonitud otsinguprofiilid. |
| [adr-006-private-http-pilot.md](../rag-v2/adr-006-private-http-pilot.md) | M4 privaatne HTTP-ühendus, vastuse-/vestlusleping ja katsete piirid. |
| [adr-007-source-dependencies.md](../rag-v2/adr-007-source-dependencies.md) | M3 ankurdatud väited, sisuliste seoste suund, all/any ja lüngad. |
| [adr-008-source-knowledge-preparation.md](../rag-v2/adr-008-source-knowledge-preparation.md) | Ühe dokumendi teadmismustandi koostamine, haldaja valik ja 07.09 pärisraja tõend. |
| [adr-009-corpus-rebuild.md](../rag-v2/adr-009-corpus-rebuild.md) | Korpuse päritolu, failivõrdlused, korrastus, impordiotsus ja mahuploki piir. |
| [adr-010-source-structure-and-chunking.md](../rag-v2/adr-010-source-structure-and-chunking.md) | Ühine nelja vormingu M1 leping ja 08.09 kohaliku valimi vastuvõtt. |
| [README.md](../rag-v2/README.md) | CLI ja ajalooliste piiratud katsete käitusjuhised; uue süsteemi üldkaart on käesolev master. |

[Algne M1–M6 arendusteekaart](../SOTSIAALAI_RAG_GRAPH_ARENDUSTEEKAART_v0_1.md) kannab tootesuunda; selle 05.09 seisu kirjeldavad lõigud on ajaloolised. Täpse hilisema etapi leping ja dateeritud vastuvõtt määravad teostuse tõendi, aktiivse järgmise ploki SotsiaalAI.md.

### Olulisemad mõõdetud tulemused

| Tõend | Tulemus ja piir |
| --- | --- |
| [08.09 M1 kohalik vastuvõtt](../rag-v2/m1-source-acceptance-2026-09-08.json) | 7 pärisallikat, 194 tekstiosa; algfaili-/manifestiräsid, 204 HTML/XML/JSON asukohta ja metaandmete päritolu kontrollitud. 18 uut ning 32 valitud regressioonijuhtu, lint, tüübikontroll, i18n, diff-kontroll ja üks tootmisbuild läbisid. Uute vormingute serveri-/brauserirada on NOT_PROVEN. |
| [08.09 ühendus ja väljalaskekood](rag-v2-release-integration-2026-09-08.md) | 4 dokumenti / 52 tekstiosa kohalikus PostgreSQL/Qdrantis mock-vektoritega; täpsed viited, katkestus ja ajalooline allikas säilisid. Nelja vormingu testadapteri brauserirada läbis. F01/F02 parandused, Turbopack ja Webpack rohelised; tootmise kooskõla on enne lubatud väljalaset lahti. |
| [07.09 M3 ühe dokumendi pärisrada](../rag-v2/adr-008-source-knowledge-preparation.md#ühe-dokumendi-päriskontroll-0709) | Üks Luna koostamine, brauseri läbivaatus, 13 väidet ja üks QUALIFIES seos uues versioonis, PostgreSQL/Qdrant avaldamine ja leksikaalne sõltuvuskontekst. 0 uut embedding-kutset. See ei tõenda mitme dokumendi automaatset seostamist ega hübriidvestluse vastust. |
| [07.09 tegelik käituspilt](../rag-v2/ingest-runtime-snapshot-2026-09-07.json) | Serveri teenuse-, indeksi- ja konfiguratsioonimõõtmine; ei ole hilisema hetke seisugarantii. |
| [07.09 serveri/kohalike allikate võrdlus](../rag-v2/server-corpus-comparison-2026-09-07.json) | Algfailide ja korpuseregistrite räsipõhine võrdlus. |
| [Ajakirja bibliograafia võrdlus](../rag-v2/journal-metadata-comparison-2026-09-07.md) | Metaandmete erinevused ja omaniku kinnitatud lähtealus. |
| [Ajakirja artikliallikate parandus](../rag-v2/journal-source-repair-2026-09-07.md) | Artiklipiiride taastamine, PDF-/HTML-asendused, varukoopia ja vana TXT-kihi eemaldamise tõend. |
| [M0–M2.2 audit](rag-v2-m2-2-audit-2026-09-05.md) | Algne piiratud pärisvektori katse ning selle turvaparandused; kuupäev ja valim piiravad üldistamist. |
| [Mitme allika ettevalmistus](rag-v2-multi-source-preparation-2026-09-05.md) | Mitme allika hindamise sisendid, parserileiud ja katseartefaktid. |

Staatiline kontroll tõendab ainult oma pinda. Lint ei tõenda ligipääsu, build ei tõenda pärisbrauserit, tsitaadivaste ei tõenda õiguslikku rakenduvust ning üks katse ei tõenda kogu korpuse kvaliteeti. Kuupäevapõhised sihttestid ja peatüki build tehakse UTC-s. Admini kasutaja käivitatav enesetest jääb tootefunktsiooniks; seda ei asendata arendussviidiga.

## 11. Lahtised võimed ja arenduses navigeerimine

### Kinnitatud suund

Omanik lubab olemasoleva kaardistatud korpuse uut ingesti ja metaandmete uuesti loomist. Materjalid on olemas; üldist uut veebikorjet ei eeldata. Tasuline kogu korpuse jooks vajab tegeliku teksti järgi mõõdetud eelarvet. Varasemad algfailid, indeks ja versioonid säilivad kuni kontrollitud asenduseni. Detailne arendusjärjestus on järgmine; aktiivne konkreetne tööots loetakse SotsiaalAI.md-st.

1. **Jätkatav mahutöötlus.** Deterministlik partiinimekiri, üksikallika seis, katkestusest jätkamine, vastendamata/konfliktse sisendi läbivaatus ning teksti, teadmiskandidaatide ja vektorite eraldi mahu/kulu arvestus. Praeguse 5000 tekstiosa piiri tõstmine eeldab mahutöötluse lahendust.
2. **Päringu valikuline lugemine.** Laadida vajalikud indeksiüksused, versioonid ja sõltuvused, säilitades õiguste ja viite tervikluse. Praegune lubatud korpuse tervikuna lugemine ei sobi suure mahu lõppteostuseks.
3. **Kontrollitud väljalase ja pärismudelirada.** Kohalik nelja vormingu indeks testvektoritega ning eraldi testadapteri allikavaade/vestluse taastamine on 08.09 kontrollitud. Enne mahutööd tuleb serveri konfiguratsioon viia teadlikult vastu võetud valmis põlvkonnale; pärisvektorite valimil on mõõdetud sisend, tasuline käivitus vajab sobivat luba.
4. **M3 sisuline jätk.** Mitme dokumendi kandidaatide seostamine, parandamine ja sisuline kinnitamine; kasutajafaktide ja ajapiiride rakendamine, lünkade käsitlemine ning mahuka teadmiskoostamise jätkamine.
5. **M1/M4/M5 järelejäänud võimed.** Keerukad PDF-paigutused/OCR, allikate eraldi tootmisesitus, vastuste ja vestluse täielik vastuvõtt ning perioodi/kogu korpuse katvus ja ajaline süntees.
6. **Müüdava toote käitamine.** Stabiilne kliendiühendus, paigaldus/uuendus, õiguste eraldatus, nõusoleku/kustutuse/säilituse tervik, varunduse taastamine, koormus, kasutuse/kulu arvestus ja tugi. Korduvkasutatav tuum peab säilima iga konkreetse võime arendamisel.

Uut semantilist hindamisringi või varasema üksikküsimuse korduskatset ei käivitata automaatselt arendusploki asemel. Vajalik väike regressioonikontroll kuulub muudatuse tõendamisse.

### Millisest failist alustada

| Vajadus või sümptom | Esmased failid |
| --- | --- |
| Uus algfailivorming või vigane metaandmekuju | registered-source.js, metadata-adapter.js, text-source.js; leping contracts.js ja types.d.ts. |
| PDF-i veerud, taanded või kadunud/sassi läinud tekst | pdf-worker.js, pdf-layout.js, parser.js; seejärel chunking.js ja source-locations.js. |
| Vale avaldamisaeg, kehtivus, bibliograafia või väljade päritolu | metadata-adapter.js, normalize.js ning source_metadata adapter. |
| Allikaversioon ei lae või vana viide muutus | catalog.js, search/snapshot.js, source-locations.js ja search/postgres.js. |
| Sobiv allikas on korpuses, kuid ei jõua tõendikonteksti | search/retrieval.js, ranking.js, profiles.js, structural-role.js; vaata raw_rankings ja selection_trace. |
| Vajalik tingimus või erand jääb puudu | knowledge.js, knowledge-preparation.js ja search/dependencies.js; vaata allikaankrut, suunda ja unresolved põhjust. |
| Mudel lisab toetamata väite või vale viite | pilot/contracts.js, evidence-draft.js, evidence-segments.js ning search/model-context.js; erista otsingu puudujääk vastamise puudujäägist. |
| Jätkuvestlus segab inimesi või ignoreerib parandust | pilot/dialogue.js, pilot/store.js, usePilotDialogue.js ja PilotContextControls.jsx. |
| Kordusklikk/taastamine tekitab uue tasulise katse | admin/knowledge-jobs.js, admin/intake.js, search/pilot-runner.js või pilot/store.js vastavalt etapile. |
| Haldaja ei saa dokumenti avaldada | admin/config.js, admin/auth.js, lib/admin/rag/v2Server.js, admin/intake.js; kontrolli lubatud dokumendi ID-d ja külmutatud plaani. |
| Uus indeks on olemas, vestlus seda ei kasuta | rag_v2_head, pilot/config.js ning M4 plaani generationId/documents/profileId; indeks ja vestluse plaan on eraldi. |
| Teise organisatsiooni kasutuselevõtt | domain-profiles, search/policy.js ja ühendusseadistus; eralda SotsiaalAI autentimise/vestluspüsistuse adapterid samast tuumast. |

## 12. Varasemad katsed ja ühenduste ajalugu

Allolev 05.09 tekst säilitab toonaste katsete tulemused, kulud, auditiviited ja vana süsteemi ühenduskaardi. Seal kirjeldatud „järgmine samm”, puuduv M3/M4, vana ingesti vaade ja serveriseis kuuluvad sellesse kuupäeva. Uue süsteemi 08.09 arhitektuur ja ühendused on peatükkides 1–11.

<details>
<summary>05.09.2026 katsete koond ja varasem ühenduskaart</summary>

## Ajalooline katsete koond — 05.09.2026

Järgmised alapeatükid kirjeldavad 05.09 seisu ja tolleaegset järgmist sammu. Uuem koond on ülal; siin esitatud M3/M4 puudumine ei kirjelda 08.09 teostust.

**Uue RAG-i M0–M2.2 tehniline rada töötab kohalikult ja serveris ning piiratud pärisembedding'u piloot on läbitud. Platvormi kasutajale allikapõhiselt vastav RAG ei ole veel taastatud.** Haldaja üks päris PDF/JSON näidis liigub eraldatud PostgreSQL-i ja Qdranti kaudu `text-embedding-3-large` vektoritega hübriidotsingusse ning kompaktseks, kanooniliselt lahendatavaks tõendusmaterjaliks. Luna vastamist, platvormi HTTP-autentimist, tootmise nõusoleku-/kustutusrada ja kogu korpuse kvaliteeti pole veel teostatud ega tõendatud.

See on omaniku soovil lisatud kuupäevastatud koond. Aktiivne tööots ja järgmise töö juhtimine jäävad [SotsiaalAI.md S1.0-sse](../platvormi%20arendus/SotsiaalAI.md). Allpool säilib kasutajafunktsioonide ja ühenduskohtade kaart; vana RAG-i arhitektuuri ei taastata.

### Etappide seis

| Etapp | Seis | Mis on olemas / mis puudub |
| --- | --- | --- |
| M0 — lähtepuu ja arhitektuur | Teostatud | Repositooriumi, autentimise, vestluse, allikavaate ja säilinud ühenduskohtade kaart; eraldatav Node/JavaScript tuum. |
| M1 — PDF/JSON-i sissevõtt | Teostatud ja lokaalselt ning serveris kontrollitud | Muutmatud algfailid, püsiv artikli identiteet, versioonid, `legacy_metadata`, väljade päritolu, täpsed allikakohad, lõigud/peatükid, tekstiosad ja struktuursed seosed. Näidis: 13 PDF-lehte, 16 tekstiosa ja 485 seost. Kordusimport, ressursipiirid ja katkestusest taastumine töötavad. |
| M2.1 — kohalik otsingutaristu | Teostatud ja päristeenustega kontrollitud | PostgreSQL `simple` + Qdranti vektorid + RRF; lubatud dokumentide filtrid, tokenipiir, põlvkonna fikseerimine, õiguse tühistamise järelkontroll, Qdranti sisu kontroll ja piiratud struktuurne laiendus. CLI tagastab täieliku auditi või kompaktse vastamiskonteksti. |
| M2.2 — päris embedding ja otsingukvaliteet | Teostatud; piiratud piloot läbitud | Kinnitatud 16 tekstiosa ja 9 küsimust saadeti ühe katsega sisendi kohta mudelile `text-embedding-3-large`. Kõik 25 katset õnnestusid; 12 420 sisendtokeni arvestuslik kulu oli 0,001614600 USD. Kuue ET/EN/RU sisuküsimuse vajalik tugi oli hübriidraja lõppkontekstis 6/6. |
| M2 tervikuna | Tehniline rada teostatud; kvaliteediparandus lahti | Pärisvektori, mitmekeelse otsingu ja tõendipaketi tervikrada töötab ka 8 dokumendiga. Järelkatse näitas, et praegune hübriidfusioon ja struktuurivalik kaotavad osa puhta vektori leitud toest; enne M4 on vaja piiratud järjestusparandust ja uut kontrollosa. |
| M2 mitme allika järelkatse | Teostatud ja serveris kontrollitud | 8 pärisallikat, 15 uut perekonda / 21 küsimust ja 9 regressiooniküsimust. 73/73 uut embedding'ut õnnestus. Vektor 15/18, hübriid 13/18, struktuur 11/18 ja leksikaalne 7/18 täieliku sisutoe juhtumit; tulemus näitas konkreetset fusiooni- ja kontekstivaliku parandustööd. |
| M3 — semantilised sõltuvused | Teostamata | `REQUIRES`, `EXCEPTION_TO` ja tingimusliku konteksti kaasamine. Praegune naabrus/peatükigraaf ei ole semantiline põhjendusgraaf. |
| M4 — Luna ja platvormi ühendus | Teostamata | Päris vastamisadapter, kinnitatud mudeli-ID, vestluse voog, viidete kasutajavaade ning uue otsingu sidumine platvormi autentimisega. |
| M5 — ajaline ja kogu korpuse rada | Teostamata | Kümne aasta ülevaateks vajalik korpus, katvuse arvestus ja allikapõhine süntees. Üks artikkel ei ole ajalooline korpus. |
| M6 — toote kasutuselevõtt | Teostamata | Tootmise juurutus, varundus/taastamiskatse, täielik kustutus- ja säilitusleping, koormuskatse ning päriskliendi piloot. |

### Mis praegu päriselt töötab

Haldaja PDF/JSON → M1 aktiivne versioonipilt → PostgreSQL-i põhiregister ja leksikaalne indeks → Qdranti pärisvektorite indeks → operaatori CLI-päring → algteksti, PDF-lehtede, allikakohtade, päritolu ja valiku põhjusega audit → piiratud kompaktne vastamiskontekst.

- Algallika, metaandmete ning töötlemiskonfiguratsiooni identiteedid säilivad. Otsinguks lisatud pealkiri ja vana kirjeldus on algteksti tsitaadist eraldi.
- Uus indeks aktiveeritakse alles pärast PostgreSQL-i ja Qdranti andmete kontrolli. Katkestus säilitab vana aktiivse põlvkonna; vanem töö ei saa uuemat aktiivset seisu üle kirjutada.
- Päring kasutab mõlemas kanalis sama põlvkonda ning tenant'i/lubatud dokumentide ulatust. Enne tulemuse tagastamist kontrollitakse kehtivat kohalikku poliitikat uuesti.
- Qdranti punkti identiteedi, mõõtmete ja normaliseeritud vektorisisu kõrvalekalle katkestab aktiveerimise. Tühi leid, teenuse tõrge ja leksikaalne varurada on eristatavad.
- Mudelikontekst ei usalda viitepaketi enesekooskõla: lühiviide lahendatakse sama valmis põlvkonna kanoonilise PostgreSQL-i üksuse, tekstiosa ja spanide vastu. Allikatunnused kannavad väärtust, päritolu ja ülevaatuse seisundit.
- Faili või allika sisu ei käivita käske. PDF-i dekodeeritud elementidel, metaandmetel, esitusel ja indeksil on eraldi ressursipiirid.

Kohaliku poliitika kontroll ei tõenda veel platvormi HTTP-autentimist, organisatsiooni/omandi/nõusoleku tervikrada ega tootmiskasutaja ligipääsu. Need ühendused tuleb enne kasutajatele avamist eraldi teostada ja kontrollida.

### Pärisembedding'u piloot

| Näitaja | Tegelik tulemus |
| --- | ---: |
| Mudel / mõõtmed | `text-embedding-3-large` / 3072 |
| Dokumenditekstid / küsimused | 16 / 9 |
| API-katsed; õnnestunud / teadmata / ebaõnnestunud | 25; 25 / 0 / 0 |
| Lokaalne / API raporteeritud sisendtokenite arv | 12 420 / 12 420 |
| Arvestuslik kulu hinnaga 0,13 USD / miljon tokenit | 0,001614600 USD |
| Genereerivad ja Luna kutsed | 0 |
| Võrdlusread | 36 (9 küsimust × 4 meetodit) |

Kuue sisuküsimuse puhul sai PostgreSQL `simple` kogu vajaliku toe lõppkonteksti 4/6, pärisvektor 6/6 ja hübriid RRF 6/6 korral. Hübriidi vajalik tugi oli kõigis kuues juhtumis juba top-1-s. Struktuurne laiendus käivitus kõigi üheksa küsimuse puhul, kuid ei lisanud selles valimis vajalikku tõendit, mida hübriidseeme juba ei sisaldanud. Autoriküsimus lahendas päritoluga autoriandme; kaks korpuses vastuseta küsimust jäid ausalt märgituks kui `required_evidence_absent_by_dataset`.

Täieliku varasema tõendipaketi 5614 tokenist sai päritolu ja `review_state` järel 1788-tokenine kompaktne esitus ehk 68% vähendus. Esitus säilitab muutmata algteksti, bibliograafia, ajad/piirangud ja lokaalselt lahendatavad lühiviited; tehnilised räsid, pikad span-loendid, järjestusskoorid ja kontrollimata vana kirjeldus jäävad auditisse.

### Koodi, teenuste ja kontrollide alus

M0–M2.2 teostus, serveri parseriparandus ja vana RAG-i teenusesõltuvuse eemaldus jõudsid `main`-i commit'ides `6df73027f`, `b0703d526` ja `75e38d190`. Codex Security Standard Scan leidis auditeeritud `lib/rag-v2` pinnalt kaks keskmise ja ühe madala raskusega probleemi: PDF-elementide ressursipiiri, metaandmete võimenduse ja enesekooskõla usaldava viitepaketi. Kõik kolm parandati commit'is **`682d2a6e4`**. Skanni lähte-SHA, otsused ja paranduste tõendid on [M0–M2.2 auditis](rag-v2-m2-2-audit-2026-09-05.md).

Lõplik M0–M2.2 sihtkomplekt läbis kohalikult ja serveris **57 testi, 0 ebaõnnestumist, 0 skip'i**. Muudetud failide lint, `git diff --check`, eraldatud Prisma skeemi valideerimine/migratsioon, i18n-kontroll ja üks lõplik tootmisbuild läbisid. Pärast turvaparandusi andis päris näidis uuesti 13 lehte, 16 tekstiosa ja 485 seost; kõik 16 embedding-teksti olid byte-for-byte võrdsed piloodi sisenditega ning pärisvektoreid ei tellitud uuesti.

Mitme allika töö lisas 4 testi ehk mõjutatud RAG-i lõplik komplekt on nüüd **61/0/0**; ledger'i paranduse 15-testine sihtkomplekt läbis. Lint, diff-kontroll, i18n ja tootmisbuild läbisid. Kood on GitHubis ja serveris; 69 pärisvektori indeksiüksust on aktiivsed. Kasutaja käitus jäi suletuks.

Serveris töötavad uus PostgreSQL ja Qdrant eraldatud Docker-köidetel ning ainult loopback-portidel `55432` ja `56333`; Qdrant kasutab teenusevõtit. `sotsiaalai-frontend.service` on aktiivne. Vana `sotsiaalai-rag.service` ja `sotsiaalai-research-worker.service` on `inactive/disabled` ning frontend ei sõltu neist. Avaleht vastab HTTPS 200 ja `/api/chat` GET annab `generationAvailable=false`, mis on õige kuni M4 ühenduseni.

Privaatsed arendusväljundid põhikaustas (ignoreeritud `tmp/` all, ei kuulu commit'i):

- Sissevõtu aktiivne register ja muutmatud versioonid: `tmp/rag-v2-sample/`.
- [Tegeliku päringu HTML-vaade](../../tmp/rag-v2-query/evidence.html) ja [masinloetav tõenduspakett](../../tmp/rag-v2-query/evidence.json).
- [Kontrollide kirje](../../tmp/rag-v2-query/verification.json) ja [ET/EN/RU tokenizer'i näited](../../tmp/rag-v2-query/tokenizer-examples.json).
- [M2.2 prooviplaan](../../tmp/rag-v2-query/m2-2-plan.json).
- [M2.2 piloodi HTML-raport](../../tmp/rag-v2-m2-2/server/pilot-report.html) ja [masinloetav tulemus](../../tmp/rag-v2-m2-2/server/pilot-results.json).

### Mida platvormi kasutaja praegu kasutada saab

Uus RAG ei ole veel vestluse, failianalüüsi ega AI-dokumendiloome külge ühendatud. Kohaliku koodi `/api/chat` vastamisrada tagastab endiselt `RAG_RETIRED` (503) ning GET ütleb `generationAvailable: false`. Admini käsitsi RAG-enesetest on alles ja raporteerib `retired` olekut (503); see ei tähenda, et uus kohalik CLI-otsing puuduks.

Säilinud failihaldus, ajalugu, inimeste koostöö, kontaktiregister ja käsitsi dokumenditöö on RAG-ist eraldi funktsioonid. Alljärgnevad seosetabelid kirjeldavad vana RAG-i ühendusi ja uue süsteemi tulevasi ühenduskohti, **mitte kinnitust, et need on juba uue mootoriga tööle pandud**.

### Järgmine samm

Mitme allika pärisjooks on lõpetatud: manifest `9526a80539a84e497226e48575ef1828f979c24dd3fcc41876c4909025e40592`, 73/73 uut katset, 23 554 tegelikku tokenit ja 0,003062020 USD. Kõige tugevam oli puhas vektorirada; praegune võrdsete kaaludega RRF kaotas kaks vektori õnnestumist ning struktuurilaiendus parandas ühe ja halvendas kolme juhtumit. Järgmine soovitatud plokk parandab M2.3-s fusiooni ja dokumendidiversiteeti ainult arendusosal, jätab struktuuri vaikimisi välja ning kinnitab muutuse uue puutumatu kontrollosaga enne M4 piiratud ühendust.

Teostuse ja käivitamise detailid: [M0–M2.2 audit](rag-v2-m2-2-audit-2026-09-05.md), [mitme allika ettevalmistuse audit](rag-v2-multi-source-preparation-2026-09-05.md), [README](../rag-v2/README.md), [M0 repositooriumi audit](../rag-v2/repository-audit.md), [ADR-001: sissevõtt](../rag-v2/adr-001-local-ingestion.md), [ADR-002: hübriidotsing](../rag-v2/adr-002-local-hybrid-search.md), [ADR-003: kinnitatud embedding'u piloot](../rag-v2/adr-003-approved-embedding-pilot.md) ja [ADR-004: mitme allika hindamine](../rag-v2/adr-004-multi-source-evaluation.md). Leheteed allpool on keeleprefiksita; ligipääs sõltub rollist ja õigustest.

## Kasutajale nähtavad seosed

| Leht või vaade | Kasutaja tegevus | Vana RAG-i roll | Mis peab olema RAG-ist eristatav |
| --- | --- | --- | --- |
| Vestlus — `/vestlus` | Sotsiaalvaldkonna küsimused, jätkuküsimused, allika või artikli valimine; kirjalik või tekstiks teisendatud sisend | Teadmusbaasist sobivate allikate leidmine ning nende põhjal vastamine. Kasutaja teema, keel ja eelnev vestlus mõjutasid otsingut. | Vestluste loend, ajalugu ja sõnumite lugemine on eraldi andmefunktsioonid. Kõnetuvastus ja ettelugemine ei ole iseenesest RAG. |
| Vestluse allikapaneel ja vastuse aruanne | Vastuse allika avamine, päritolu kontrollimine, vastuse kohta tagasiside andmine | Otsingutulemuste sidumine vastuse väidete ja kuvatavate allikatega; vastuse diagnostika päritoluandmed. | Salvestatud allikaviidete identiteet, avamisõigused ja ajaloolise tagasiside säilimine. |
| Vestluse failianalüüs — `/vestlus` | Lisatud faili kohta küsimine või selle analüüsimine | Failisisu kasutamine analüüsi- ja vastusevoos; vana analüüs kuulus sama assistendisüsteemi juurde. | Faili üleslaadimine, privaatsuskontroll ja algfaili haldamine ei tohi sõltuda uue RAG-vastuse õnnestumisest. |
| Dokumendi koostamine — `/dokreziim` | AI abil mustandi koostamine ja täiendamine | Vajaduspõhise allikakonteksti kasutamine dokumendiloome töövoos. | Käsitsi kirjutamine, kinnitamine, salvestamine ja eksport. |
| Dokumendid — `/documents`, `/documents/[id]`, `/documents/artifacts/[id]` | Oma failide, analüüside, mustandite ja uuringutulemuste avamine | Üleslaaditud dokumentide indekseerimine ja nende sisust otsimine; assistendi loodud tulemuste sidumine lähtefailidega. | Omand, organisatsiooni ligipääs, algfaili allalaadimine, kustutamine ja olemasoleva teksti muutmine. Transkriptsioon ja transkripti kokkuvõte on eraldi AI-rajad. |
| Süvauuring — vestluse tööriist ja dokumentide uuringute loend | Pikema uurimisküsimuse esitamine, edenemise jälgimine, tulemuse ja tõendite avamine | Teadmusbaasi otsingud, allikate koondamine ja raporti koostamine taustatööna. | Varasema uuringu lugemine ja kustutamine ning töö oleku korrektne kuvamine. Eraldi `/research` lehte ei olnud. |
| Materjalid — `/materjalid` | Materjali lisamine, ülevaatamine ja teadmusbaasis kasutamise lubamine | Heaks kiidetud ja sobiva nõusolekuga materjali lisamine otsingusse; uuendamise ja eemaldamise sidumine allikaga. | Materjali algfail, ülevaatuse otsus, omand ja nõusolek. Nõusoleku tagasivõtmine peab eemaldama ka otsingus kasutatava koopia. |
| Kovisioon — `/kovisioon`, `/toolaud/kovisioon` | Juhtumi arutelu juurde teadmiste või varasemate praktikate toe küsimine | Juhtumikontekstist otsinguküsimuse moodustamine ja lubatud tugimaterjalide leidmine. | Arutelu, osalejate õigused, juhtumi sisu ja inimeste koostöö. |
| Lõpetatud juhtumid ja parimad praktikad — `/lopetatud-juhtumid`, `/parimad-praktikad` | Juhtumist jagatava praktika loomine, avaldamine, kasutamine ja nõusoleku muutmine | Avaldatava praktika teadmusbaasi koopia loomine, uuendamine ja eemaldamine; selle leidmine kovisiooni toest. | Juhtumi lõpetamine ja praktika tavaloend ei tähenda automaatselt luba privaatse juhtumi sisu indekseerida. |
| Teenuseprofiil — `/teenuseprofiil`, `/org/[orgId]/teenusprofiil` | Avaliku teenusekirjelduse muutmine ja avaldamine | Avaldatud profiili sünkroonimine teadmusbaasi, et assistent leiaks teenuse infot; avaldamise lõpetamisel koopia eemaldamine. | Profiili põhikirje, avaldamisõigused ja teenuste käsitsi haldamine. |
| Teenusekaart — `/teenusekaart` | Sobiva teenuse, KOV-i, kontakti või vormi leidmine | Kaudne seos: teenusekaardi andmeid ja kontrollitud kontakte kasutati vestluse teenusevastustes; vana RAG-i andmetest tehti ka sünkroonimisi. | Teenusekaardi registriotsing, kontaktide haldamine ja teenuste kuvamine on eraldi funktsioonid. |
| Teenuspäevik — `/teenuspaevik` | AI abil teenusekirjelduse mustandi loomine | Kasutas ühist dokumendigenereerimise rada, mis oli vana RAG/AI töövooga seotud. | Päevikukirje käsitsi koostamine, parandamine ja lugemine. See seos ei tähenda, et iga mustand tegi eraldi RAG-otsingu. |
| Ruumid — `/rooms`, `/room/[roomId]`, `/ruum` | Ühises arutelus assistendi poole pöördumine | Assistendile edastatud küsimus jõudis samasse vastamise API-sse. | Inimestevahelised sõnumid, osalejad, kõned ja ruumi õigused. |
| Konto ja privaatsustoimingud — `/profiil` ning faili/materjali kustutamise vaated | Konto või sisu kustutamine, jagamise ja nõusoleku muutmine | RAG-is oleva koopia kustutamine ja poolelioleva kustutuse jälgimine. | Kustutus ei tohi olla lõpetatuks märgitud, kui väline koopia on alles; ligipääsuõigused peavad piirama ka allika avamist ja kasutamist. |

## Administraatori lehed

| Leht | Seotud tegevus |
| --- | --- |
| `/admin/rag` | Teadmusbaasi halduse avaleht ja administraatori käsitsi käivitatav enesetest; kontaktiregistri haldus. |
| `/admin/rag/kov` | KOV-i algfailide, allikate ja kontaktide haldamine, allikavärskuse kontroll ning vana indekseerimise käivitamine. |
| `/admin/rag/organizations` | Organisatsiooni algfailide ja allikaandmete haldamine ning vana indekseerimise käivitamine. |
| `/admin/rag/ingest` | Vana materjalide teadmusbaasi lisamise vaade. |
| `/admin/rag/documents` | Vana indekseeritud dokumentide loend, oleku kontroll ja eemaldamine. |
| `/admin/rag/source-packages` | Vana allikapakettide ülevaatus ja nende põhjal teadmuskorpuse täiendamine. |
| `/admin/rag/source-feedback` | Kasutajate allikatagasiside, probleemse viite ja vastuse päritolu ülevaatamine. |
| `/admin/analytics` | Kaudne seos: assistendi kasutus ja kulud ning ebaõnnestunud andmekustutuste haldamine. Need hõlmavad ka RAG-ist sõltumatuid platvormitoiminguid. |

## Seoste tehnilised sissepääsud

Need on ühenduskohad, mille järgi saab uut süsteemi platvormiga siduda, mitte vana teostuse juhend.

| Valdkond | API või säilinud ühenduskoht |
| --- | --- |
| Vestlus ja failianalüüs | `/api/chat`, `/api/chat/analyze-file` |
| Allikad ja tagasiside | `/api/source-feedback`, `/api/admin/source-feedback`; salvestatud vastuste allikametaandmed |
| Dokumendid ja mustandid | `/api/documents`, `/api/documents/artifacts`, `/api/documents/artifacts/generate`, `/api/documents/artifacts/refine` |
| Süvauuring | `/api/research/jobs` ja töö lugemise, voo, peatamise ning kustutamise alamrajad |
| Materjalide elutsükkel | `/api/materials`; `lib/materials/ragLifecycle.js` |
| Kovisiooni teadmustugi ja praktikad | `/api/covision/assist`, `/api/effective-practices`; `lib/covisionKnowledge.js` |
| Teenuseprofiilid | `/api/service-provider/profile`, `/api/org/[orgId]/teenusprofiil` |
| Teenuspäeviku AI-mustand | `/api/service-narratives/draft` |
| Admini algfailid ja allikad | `/api/admin/rag/kov`, `/api/admin/rag/organizations`, `/api/admin/rag/contact-registry` |
| Admini enesetest | `/api/rag/selftest` |
| Kustutamise korduskatsed | `/api/admin/usage/deletion-jobs`; `lib/privacy/deletionJobRetryService.js` |

## Piir uue süsteemi jaoks

Kasutaja roll, sisu omanik, organisatsioon, jagamisõigus ja nõusolek peavad piirama nii indekseerimist, otsingut kui ka leitud allika avamist. Uus RAG peab suutma allika uuenduse ja kustutuse siduda sama algkirjega. Failihaldus, vestlusajalugu, inimeste koostöö, kontaktiregister ja käsitsi koostatud dokumendid on omaette platvormifunktsioonid.

Aktiivset teostusseisu ja järgmist tööd kannab ainult [SotsiaalAI.md](../platvormi%20arendus/SotsiaalAI.md). Vana süsteemi kirjeldus ja arendusmaterjalid on leitavad Git-ajaloost taastamissildi `before-rag-rebuild` juurest.

</details>
