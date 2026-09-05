# RAG-süsteemi master: seis ja seosed

## RAG-i seis 05.09.2026

**Uue RAG-i M0–M2.2 tehniline rada töötab kohalikult ja serveris ning piiratud pärisembedding'u piloot on läbitud. Platvormi kasutajale allikapõhiselt vastav RAG ei ole veel taastatud.** Haldaja üks päris PDF/JSON näidis liigub eraldatud PostgreSQL-i ja Qdranti kaudu `text-embedding-3-large` vektoritega hübriidotsingusse ning kompaktseks, kanooniliselt lahendatavaks tõendusmaterjaliks. Luna vastamist, platvormi HTTP-autentimist, tootmise nõusoleku-/kustutusrada ja kogu korpuse kvaliteeti pole veel teostatud ega tõendatud.

See on omaniku soovil lisatud kuupäevastatud koond. Aktiivne tööots ja järgmise töö juhtimine jäävad [SotsiaalAI.md S1.0-sse](../platvormi%20arendus/SotsiaalAI.md). Allpool säilib kasutajafunktsioonide ja ühenduskohtade kaart; vana RAG-i arhitektuuri ei taastata.

### Etappide seis

| Etapp | Seis | Mis on olemas / mis puudub |
| --- | --- | --- |
| M0 — lähtepuu ja arhitektuur | Teostatud | Repositooriumi, autentimise, vestluse, allikavaate ja säilinud ühenduskohtade kaart; eraldatav Node/JavaScript tuum. |
| M1 — PDF/JSON-i sissevõtt | Teostatud ja lokaalselt ning serveris kontrollitud | Muutmatud algfailid, püsiv artikli identiteet, versioonid, `legacy_metadata`, väljade päritolu, täpsed allikakohad, lõigud/peatükid, tekstiosad ja struktuursed seosed. Näidis: 13 PDF-lehte, 16 tekstiosa ja 485 seost. Kordusimport, ressursipiirid ja katkestusest taastumine töötavad. |
| M2.1 — kohalik otsingutaristu | Teostatud ja päristeenustega kontrollitud | PostgreSQL `simple` + Qdranti vektorid + RRF; lubatud dokumentide filtrid, tokenipiir, põlvkonna fikseerimine, õiguse tühistamise järelkontroll, Qdranti sisu kontroll ja piiratud struktuurne laiendus. CLI tagastab täieliku auditi või kompaktse vastamiskonteksti. |
| M2.2 — päris embedding ja otsingukvaliteet | Teostatud; piiratud piloot läbitud | Kinnitatud 16 tekstiosa ja 9 küsimust saadeti ühe katsega sisendi kohta mudelile `text-embedding-3-large`. Kõik 25 katset õnnestusid; 12 420 sisendtokeni arvestuslik kulu oli 0,001614600 USD. Kuue ET/EN/RU sisuküsimuse vajalik tugi oli hübriidraja lõppkontekstis 6/6. |
| M2 tervikuna | Tehniline rada vastu võetud piiratud ulatuses | Ühe artikli piloot tõendab pärisvektori, mitmekeelse hübriidotsingu ja tõendipaketi tervikrada. See ei ole üldine täpsusprotsent ega tõenda mitme dokumendi eristamist, kogu korpust või lõppvastuse kvaliteeti. |
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

Järgmine sidus plokk laiendab M2 kvaliteedikatset mitmele eraldi lubatud pärisartiklile, lisab sarnase sõnastusega eksitavad allikad ja katab artiklite teised peatükid. Selle järel saab M4-s ühendada serverisessioonist tuletatud tenant'i ja õigused, kanoonilise viitelahenduse, allikavaate ning ühe eraldi kinnitatud Luna vastamiskatse. Iga uus välissaatmise sisu, mudel või kulupiir vajab oma manifesti ja luba; esimese piloodi luba ei laiene automaatselt.

Teostuse ja käivitamise detailid: [M0–M2.2 audit](rag-v2-m2-2-audit-2026-09-05.md), [README](../rag-v2/README.md), [M0 repositooriumi audit](../rag-v2/repository-audit.md), [ADR-001: sissevõtt](../rag-v2/adr-001-local-ingestion.md), [ADR-002: hübriidotsing](../rag-v2/adr-002-local-hybrid-search.md) ja [ADR-003: kinnitatud embedding'u piloot](../rag-v2/adr-003-approved-embedding-pilot.md). Leheteed allpool on keeleprefiksita; ligipääs sõltub rollist ja õigustest.

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
