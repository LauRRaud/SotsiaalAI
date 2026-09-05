# RAG-süsteemi master: seis ja seosed

## RAG-i seis 05.09.2026

**Uue RAG-i failide sissevõtt ja kohalik otsingutaristu töötavad. Platvormi kasutajale allikapõhiselt vastav RAG ei ole veel taastatud.** PostgreSQL-i leksikaalne otsing töötab päris tekstiga; Qdranti ühendus on kontrollitud deterministlike testvektoritega (`embedding_mode=mock`). Päris embedding-mudeli tähendusliku otsingu kvaliteeti ega Luna vastuseid pole veel kontrollitud.

See on omaniku soovil lisatud kuupäevastatud koond. Aktiivne tööots ja järgmise töö juhtimine jäävad [SotsiaalAI.md S1.0-sse](../platvormi%20arendus/SotsiaalAI.md). Allpool säilib kasutajafunktsioonide ja ühenduskohtade kaart; vana RAG-i arhitektuuri ei taastata.

### Etappide seis

| Etapp | Seis | Mis on olemas / mis puudub |
| --- | --- | --- |
| M0 — lähtepuu ja arhitektuur | Teostatud | Repositooriumi, autentimise, vestluse, allikavaate ja säilinud ühenduskohtade kaart; eraldatav Node/JavaScript tuum. |
| M1 — PDF/JSON-i sissevõtt | Teostatud ja lokaalselt kontrollitud | Muutmatud algfailid, püsiv artikli identiteet, versioonid, `legacy_metadata`, väljade päritolu, täpsed allikakohad, lõigud/peatükid, tekstiosad ja struktuursed seosed. Näidis: 13 PDF-lehte, 16 tekstiosa. Kordusimport ja katkestusest taastumine töötavad. |
| M2.1 — kohalik otsingutaristu | Teostatud ja päristeenustega kontrollitud | PostgreSQL `simple` + Qdranti **testvektorid** + RRF; lubatud dokumentide filtrid, tokenipiir, põlvkonna fikseerimine, õiguse tühistamise järelkontroll ja piiratud struktuurne laiendus. CLI tagastab tõenduspaketi. |
| M2.2 — päris embedding ja otsingukvaliteet | Ette valmistatud, käivitamata | Artiklipõhised ET/EN/RU küsimused, allikakohtade ootused ja tokenipõhine prooviplaan on olemas. Päris mudelikutseks puuduvad kinnitatud materjalide väljasaatmise luba ning kulupiir. |
| M2 tervikuna | Veel vastu võtmata | Taristu töötab, aga päris mudeliga semantiline ja mitmekeelne kvaliteet on `NOT_PROVEN`. |
| M3 — semantilised sõltuvused | Teostamata | `REQUIRES`, `EXCEPTION_TO` ja tingimusliku konteksti kaasamine. Praegune naabrus/peatükigraaf ei ole semantiline põhjendusgraaf. |
| M4 — Luna ja platvormi ühendus | Teostamata | Päris vastamisadapter, kinnitatud mudeli-ID, vestluse voog, viidete kasutajavaade ning uue otsingu sidumine platvormi autentimisega. |
| M5 — ajaline ja kogu korpuse rada | Teostamata | Kümne aasta ülevaateks vajalik korpus, katvuse arvestus ja allikapõhine süntees. Üks artikkel ei ole ajalooline korpus. |
| M6 — toote kasutuselevõtt | Teostamata | Tootmise juurutus, varundus/taastamiskatse, täielik kustutus- ja säilitusleping, koormuskatse ning päriskliendi piloot. |

### Mis praegu päriselt töötab

Haldaja PDF/JSON → M1 aktiivne versioonipilt → PostgreSQL-i põhiregister ja leksikaalne indeks → Qdranti testvektorite indeks → kohaliku operaatori CLI-päring → algteksti, PDF-lehtede, allikakohtade ja valiku põhjusega tõenduspakett.

- Algallika, metaandmete ning töötlemiskonfiguratsiooni identiteedid säilivad. Otsinguks lisatud pealkiri ja vana kirjeldus on algteksti tsitaadist eraldi.
- Uus indeks aktiveeritakse alles pärast PostgreSQL-i ja Qdranti andmete kontrolli. Katkestus säilitab vana aktiivse põlvkonna; vanem töö ei saa uuemat aktiivset seisu üle kirjutada.
- Päring kasutab mõlemas kanalis sama põlvkonda ning tenant'i/lubatud dokumentide ulatust. Enne tulemuse tagastamist kontrollitakse kehtivat kohalikku poliitikat uuesti.
- Tühi leid, teenuse tõrge ja leksikaalne varurada on eristatavad. Faili või allika sisu ei käivita käske.

Kohaliku poliitika kontroll ei tõenda veel platvormi HTTP-autentimist, organisatsiooni/omandi/nõusoleku tervikrada ega tootmiskasutaja ligipääsu. Need ühendused tuleb enne kasutajatele avamist eraldi teostada ja kontrollida.

### Koodi, teenuste ja kontrollide alus

Kontrollitud kood on kohalikus põhikausta `main`-harus: M0/M1 commit `6b2db9b94`, M2.1 commit **`2577100af`**. Selle kokkuvõtte koostamisel andis `git ls-remote origin refs/heads/main` kaugusharu SHA-ks `ef184d4a410ba42b3153b15a2afa8c561a047e38`; uusi RAG-i commit'e pole sinna saadetud. Uut süsteemi pole nende töövoorudega tootmisse paigaldatud. Serveri praegust teenuseseisu selles dokumendiuuenduses ei kontrollitud.

05.09 Docker-kontrollis töötasid eraldatud kohalikud **PostgreSQL 16.13** (`127.0.0.1:55432`) ja **Qdrant 1.15.5** (`127.0.0.1:56333`). Need on uue RAG-i arendusteenused; platvormi olemasolevat andmebaasi nende seadistamisega ei muudetud.

| Kontroll | Läbitud | Ebaõnnestunud | Vahele jäetud |
| --- | ---: | ---: | ---: |
| M1 regressioonid päris näidis-PDF-iga | 22 | 0 | 0 |
| M2.1 ühiktestid | 7 | 0 | 0 |
| M2.1 päris PostgreSQL-i/Qdranti integratsioonitestid | 11 | 0 | 0 |

Viimase koodiploki lint, eraldatud kohaliku Prisma migratsioon ja skeemi valideerimine, tõlkekontroll ning tootmisbuild läbisid. M1 korduskontrollis avastatud Windowsi parserikrahh parandati PDF-parseri eraldi lapsprotsessi viimisega. **Väliseid embedding-kutseid ja genereerivaid mudelikutseid oli 0.** Dokumentatsiooni uuendamiseks samu teste ega build'i uuesti ei käivitatud.

Salvestatud tegelik „OTT” päring sai oleku `ok`, leidis leksikaalses kanalis ühe õige tekstiosa PDF-lehelt 3 ning tagastas hübriidpaketis kolm katkendit. Kestus oli ligikaudu **237 ms**, kontekst 5614 tokenit (Windows x64, Node 24.18.0). See on üks kohalik mõõtmine, mitte p95 või semantilise kvaliteedi tõend; teised testvektoritega valitud katkendid ei tõenda küsimusele kasulikku tuge.

Privaatsed arendusväljundid põhikaustas (ignoreeritud `tmp/` all, ei kuulu commit'i):

- Sissevõtu aktiivne register ja muutmatud versioonid: `tmp/rag-v2-sample/`.
- [Tegeliku päringu HTML-vaade](../../tmp/rag-v2-query/evidence.html) ja [masinloetav tõenduspakett](../../tmp/rag-v2-query/evidence.json).
- [Kontrollide kirje](../../tmp/rag-v2-query/verification.json) ja [ET/EN/RU tokenizer'i näited](../../tmp/rag-v2-query/tokenizer-examples.json).
- [M2.2 prooviplaan](../../tmp/rag-v2-query/m2-2-plan.json).

### Mida platvormi kasutaja praegu kasutada saab

Uus RAG ei ole veel vestluse, failianalüüsi ega AI-dokumendiloome külge ühendatud. Kohaliku koodi `/api/chat` vastamisrada tagastab endiselt `RAG_RETIRED` (503) ning GET ütleb `generationAvailable: false`. Admini käsitsi RAG-enesetest on alles ja raporteerib `retired` olekut (503); see ei tähenda, et uus kohalik CLI-otsing puuduks.

Säilinud failihaldus, ajalugu, inimeste koostöö, kontaktiregister ja käsitsi dokumenditöö on RAG-ist eraldi funktsioonid. Alljärgnevad seosetabelid kirjeldavad vana RAG-i ühendusi ja uue süsteemi tulevasi ühenduskohti, **mitte kinnitust, et need on juba uue mootoriga tööle pandud**.

### Järgmine samm

M2.2 kontrollib tegeliku `text-embedding-3-large` mudeliga leksikaalset, vektori- ja hübriidotsingut ning struktuurse laienduse mõju. Praegune ettevalmistatud plaan kasutab 3072 mõõdet, näidise 16 tekstiosa ja üheksat küsimust: kuni **12 420 sisendtokenit ja 25 API-katset**, üks katse sisendi kohta, automaatsete korduskatseteta. Rahaline hind on seadistamata ja hinnanguline kulu teadmata. Materjalide välisele teenusele saatmise luba ning konkreetne kulupiir tuleb omanikul enne käivitust kinnitada.

Teostuse ja käivitamise detailid: [README](../rag-v2/README.md), [M0 repositooriumi audit](../rag-v2/repository-audit.md), [ADR-001: sissevõtt](../rag-v2/adr-001-local-ingestion.md), [ADR-002: hübriidotsing](../rag-v2/adr-002-local-hybrid-search.md). Leheteed allpool on keeleprefiksita; ligipääs sõltub rollist ja õigustest.

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
