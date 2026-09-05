# RAG-i seosed kasutajafunktsioonide ja lehtedega

See kaart kirjeldab, milliste platvormi võimalustega oli vana RAG ühendatud. See on uue süsteemi kavandamise sisend: vana arhitektuur, arendusplaanid ja testiraportid on siit eemaldatud. Leheteed on esitatud ilma keeleprefiksita; ligipääs sõltub kasutaja rollist ja õigustest.

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
