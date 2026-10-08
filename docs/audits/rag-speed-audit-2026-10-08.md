# RAG-i kiirusaudit: tegelik ooteahel ja mõõtmiste piirid

08.10.2026. Ulatus: omaniku esitatud 12,9-sekundilise kiire režiimi hinnangu, 100 000 lõigu mahupiiri ning optimeerimisettepanekute kontroll koodi ja säilinud tõenditega. Käituskoodi, mudelit, allikavalikut ega serveri konfiguratsiooni selles töös ei muudetud.

**Järeldus:** kiirendamisvõimalusi on, kuid „kolm järjestikust Luna-kutset on peamine parandatav probleem” on liiga kitsas diagnoos. PostgreSQL-i statistika viga on eraldi väljalaskes juba parandatud; otsingukanalid on juba paralleelsed. Allikavaliku kohaliku osa ja katseprotsessi soojenduse eristamata jätmine peidab olulist aega. 5–7 s esimese teksti ja 8–10 s lõppvastuse sihid jäävad kontrollimata eesmärkideks.

**Omanik peatas testid auditi ajal.** Enne sõnumit alanud tasuta lugemisproov peatati SIGTERM-iga; rakenduse teenust ei peatatud. Proov ei väljastanud täielikku tulemust ja seda ei kasutata statistika paranduse järelmõõtmisena. Pärast korraldust ei käivitatud teste ega serveri mõõtmisi. Edasi tehti ainult olemasolevate failide analüüs. Uusi tasulisi kutseid 0; senine kogukulu **0,629070650 USD / 1 USD** ei muutunud.

## Kontrollitud seis ja tõendid

- Kohalik `HEAD`: `0ef1ac33`; selle ees on avaldamata `ca5970f9` ja `7e4315e4`.
- `git ls-remote` ja `git fetch` kinnitasid `origin/main`-i `18f5cf256c9e82db35ba86587c47056d8fa8869b`.
- 08.10 kell 14:52:59 UTC näitas `systemctl` aktiivse frontendi töökaustaks sama SHA väljalaset. Uus commit #456 lisab 100 000 lõigu piiri ja aktiveerimisaegse `ANALYZE`-i; kohalikus kolmes commit'is seda veel pole.
- [Seisu ja katkestuse tõend](evidence/rag-speed-audit-state-2026-10-08.json).
- [Olemasoleva 60 katsepöörde tasuta ümberarvutus](evidence/rag-speed-audit-offline-2026-10-08.json): 59 lõpetatud pöördel on täielikud ajad; üks ebaõnnestunud pööre ei kuulu latentsikoondisse. Kõik need katsed toimusid **enne** 08.10 kell 14:36 UTC statistika parandust ning eraldi sünteetilistes mõõteprotsessides. Küsimusi ega vastuseid sellest auditist tootmiskasutajatelt ei loetud.
- [Ümberarvutuse skript](rag-speed-audit-2026-10-08-analyze.mjs) loeb ainult nelja kohalikku olemasolevat tõendifaili, säilitab nende räsid ega käivita teste, andmebaase ega mudeleid.
- Uue väljalaske mõõtmise ja koodi allikas: [ADR-108 konkreetsel SHA-l](https://github.com/LauRRaud/SotsiaalAI/blob/18f5cf256c9e82db35ba86587c47056d8fa8869b/docs/rag-v2/adr-108-index-capacity-100000-and-statistics.md). Selle varasemaid mõõtmisi ei nimetata siin uuesti tehtud mõõtmisteks.

## Leiud ja prioriteet

### K1 — P1: statistika parandus on tootmises; selle tervikmõju on mõõtmata

ADR-108 leidis töötaval 68 408 lõiguga põlvkonnal planeerija hinnangu **1 dokument**, tegelikult **8337**. See valis sõnalise indeksi asemel iga dokumendiversiooni ridade lugemise. Käsitsi `ANALYZE` muutis hinnangu 8024-ks; sama laia mõõtepäringu kestus oli enne 13,8 s ja pärast umbes 4,1 s. Teine päring jõudis enne 15 s ajapiirini, pärast umbes 4,6 sekundini. Uus aktiveerimisrada värskendab statistikat enne aktiivse põlvkonna vahetust.

See on tugev põhjendus statistika parandusele. **4,1/4,6 s ei ole praeguse vestluse sõnalise kanali järelmõõtmine** (vt K2). Ka prognoos 11,5 s tervele pöördele ei ole kinnitatud. Audit ei käivitanud uut `ANALYZE`-i ega muutnud statistika seadeid. Valmistatud järelproov katkestati omaniku palvel.

**Järgmine töö:** pärast omaniku määratud pausi võrrelda tegeliku vestlusprofiili sama sõnalist päringut, dokumentide/ühikute ulatust ja `EXPLAIN (ANALYZE, BUFFERS)`-it. Säilitada hinnangulised ja tegelikud read, indeksitee, töötajad ja puhvriarvestus. Üksnes kontroll, et indeks on olemas, ei tõenda selle kasutamist.

### K2 — P1: mahukatse kasutab teistsugust järjestust kui vestlus

Serveri `cap-bench.mjs` ja `cap-bench2.mjs` kutsuvad `postgres.lexical(..., text, 80)` ilma järjestuse argumendita. `PostgresCatalog.lexical` vaikimisi järjestus on **`ts_rank_cd`**. Vestluse profiil `hybrid-estnltk-chat-v6` kasutab **`ts_rank`**, eemaldab määratud stoppsõnad ning rakendab tõendikõlblike ühikute ja allikate piiranguid. Mahukatse otsib üle kõigi dokumentide; ka nende päringutekstid ei ole samad mis vestluse liidetud küsimus ja planeeritud variandid.

Seetõttu ei saa raske mõõtepäringu 0,4 s / 10 000 lõigu kasvu otse vestluse ajale üle kanda. Ka varasema põlvkonna ja hilisema põlvkonna erinevate kasutajapöörete mediaanide suhe ei ole kontrollitud skaleerumiskatse.

Omaniku toodud aritmeetika on õige: **(100 000 − 68 408) / 10 000 × 0,4 s = 1,26368 s**. See on sama raske mõõtepäringu joone pikendus. ADR-108 umbes 0,6 s hinnang päris pöördele kasutab teist, suhtelist ülekannet; kumbki ei ole 100 000 lõiguga vestluse mõõtmine. Korpuses on ADR-108 järgi 68 408 lõiku, **100 000 on lubatud piir**, mitte mõõdetud indeksi suurus.

**Järgmine töö:** mahusõltuvust mõõta pärisprofiiliga, sama ulatusega, soojuse ja parallelismi seisuga; vajadusel näidata eraldi vana mahutesti ajaloolist rida. Valmistatud skript eristab kaht järjestust, kuid jääb laia ulatusega mikrokatseks, mitte tervikvestluse asenduseks.

### K3 — P1: „allikavalik” sisaldab märkimisväärset mudelivälist aega

15-pöördelise viimase paranduskandidaadi olemasolevast tõendist:

| Mõõdik | Mediaan | Keskmine | p95 |
|---|---:|---:|---:|
| Planeerimise API-kutse | 3,970 s | 3,653 s | 7,771 s |
| Embedding'u API-kutse | 0,322 s | 0,376 s | 0,562 s |
| Sõnaline põhikanal | 4,062 s | 4,218 s | 4,973 s |
| Vektori põhikanali serveriaeg | 0,823 s | 0,987 s | 2,970 s |
| Luna allikavaliku API-kutse | 2,048 s | 2,480 s | 4,751 s |
| **Kogu allikavaliku etapp** | **4,456 s** | **6,774 s** | **23,376 s** |
| **Etapi ja API-kutse vahe sama pöörde sees** | **1,948 s** | **4,294 s** | **22,366 s** |
| Vastuse API-kutse | 9,367 s | 10,405 s | 18,597 s |
| Esimene serverist väljastatud vastusetekst | 20,006 s | 21,560 s | 35,001 s |
| Vastuse mudeli töö lõpetatud | 26,017 s | 26,865 s | 36,976 s |

Need pole uus tootmismõõtmine ega omaniku 12,9-sekundilise kiire režiimi valim. Viimase katse tõend ei salvesta arutlustaset eraldi; seda ei omistata tagantjärele kindlalt `low`- ega `medium`-režiimile.

Vahe arvutati **iga pöörde sees**, alles siis leiti mediaan. 4,456 − 2,048 ei ole vahe mediaan. p95 kasutab nearest-rank reeglit; 15 näite korral on see maksimum, mitte stabiilne tootmise sabalatentsi hinnang.

`search/retrieval.js` alustab `rerank` kella enne kandidaatide koondamist, `postgres.units` lugemist ja kontrolli; selle sees on ka `hooks.rerank` koos reservi, ligipääsukontrolli ning kulukirje tasaarvestusega. `postgres.units` loeb kandidaadi **kõigi dokumendilõikude** read ning seni kontrollimata dokumendi korral analüüsib morfoloogia uuesti. Kella lõpp on pärast valikut. Seega ei tohi näiteks 23,376 sekundit nimetada Luna allikavaliku ajaks: selle pöörde API-kutse kestis **1,010 s**.

**Katseprotsessi eripära:** paranduskandidaadi mõõteskript käivitab `runtimeAdapters`/`PilotService` otse. Ta ei käivita frontendi startup-rada, mille `warmPilotAtStart` loeb `inheritVerified` abil varasemad kontrollimärgid. Ettevalmistus käivitab küll allikate soojenduse, kuid uue protsessi esimesed kontrollid võivad sattuda pöörde kriitilisele teele. See muudab külmade katsete ja sooja teenuse võrdlemise ebausaldusväärseks. Ilma etapi alamajastusteta ei saa kogu 22,366 s vahet omistada just morfoloogiale või andmebaasile.

**Järgmine töö:** lisada mõõtmisel eraldi ajad `pool_units`, kandidaatide koostamine, reserv/õiguse kontroll, mudelikutse ja tasaarvestus. Võrrelda eraldi külma protsessi, päritud kontrollimärkidega protsessi ja sooja kordust. Optimeerida alles kinnitatud osa; tõendite tervikluse kontrolli väljalülitamine ei ole lahendus. Võimalik järgnev lahendus on kontrollitud dokumendi kandidaatide kitsam laadimine, säilitades tervikluse garantii.

### K4 — P2: pakutud põhiparalleelsus on juba olemas

Koodi kontroll:

- `pilot/service.js`: pärast planeerimist algavad embedding ja otsingu ettevalmistus `Promise.allSettled` kaudu koos; vektorit vajav osa ootab vektori lubadust.
- `search/retrieval.js`: sõnaline ja vektorotsing algavad `Promise.allSettled` kaudu koos. Variandid, riikliku õiguse reserv ja redaktsioonimuutuse reserv käivad `Promise.all` kaudu paralleelselt.
- `pilot/retrieval.js`: teadmusotsing ja kohalike teenuste kataloog töötavad koos.
- **Alles järjestikune osa:** ajakirja avaldamisperioodide kuni kaks lisarada käivitatakse alles põhiteadmiste/kataloogi järel ja omavahel järjestikku. Nende varasem või paralleelne käivitamine on võimalik eraldi optimeerimiskandidaat. Siinne 59 lõpetatud pöörde ajastusvalim seda rada ei kasuta, seega mõju nendele pööretele oleks null.

Sõnalise ja vektori põhikanali kestusi ei liideta pöörde ajaks. `vector` sisaldab ka embedding'u ootamist ja transporti; `vector_server` on Qdranti enda aeg. Need ei ole vahetatavad mõõdikud. Rohkem paralleelsust võib suurema koormuse korral hoopis halvendada p95: PostgreSQL-i kliendipool on viis ühendust ja sõnaline päring võib küsida kolm paralleeltöötajat. Samaaegsete kasutajate koormus on **NOT_RUN**.

### K5 — P2: planeerimise ja valiku ühendamine ei ole üks lihtne sammu eemaldus

Planeerimine annab päringud ja isiku/koha seose; nende põhjal leitakse kandidaadid; alles siis saab valija kandidaatide tekste hinnata. Sama sisendi ja käitumise säilitamisel on nende vahel tegelik andmesõltuvus. Üks mudelisessioon tööriistakutsega võib endiselt nõuda kahte mudeli tööetappi.

Planeerimise vahelejätt lihtsal esmapöördel on eraldi kvaliteedihüpotees, mille puhul tuleb kontrollida mitut inimest, omavalitsusi, parandusi, võõrkeeli ja formaalseid õigusnõudeid. See ei ole auditi esimene soovitus. Tervituste lühitee on juba olemas. Planeerimise umbes 3% rahaline osakaal ei võrdu tema ajalise osakaaluga, kuid ka kalli etapi eemaldamine ei õigusta sisuvigu.

Vastuse arutlustaseme mõju on juba mõõdetud [06.10 eraldi valimis](evidence/reasoning-choice-measured-2026-10-06.json): kiire režiimi keskmine koguaeg oli kahes komplektis 9,977 ja 9,657 s ning esimene tekst 7,462 ja 7,266 s; põhjalikus režiimis 18,468 ja 15,560 s. See oli teine põlvkond ja teised küsimused, tõendid polnud paarides alati samad. Kiire režiim on olemasolev funktsioon, mitte siin lisatud optimeerimine. Seda ei muudeta vaikimisi kvaliteediparanduse asemel.

### K6 — P2: ajastuste tähendused ja režiimid tuleb enne võrdlust fikseerida

- Teenuse `phases` kell algab **pärast pöörde hõivamist**; autentimine ja sellele eelnev töö jäävad välja.
- `firstDataMs` tähendab pakkuja esimesi baite, mitte kasutajale loetavat vastust. `firstTextMs` tähendab pakkuja tekstideltat; teenuse `first_text` tähendab vastuseteksti callback'i. Brauseri esimene nähtav tekst vajab eraldi mõõdikut.
- `answered` märgitakse enne vastuse valideerimist ja püsivat avaldamist. See ei ole kogu HTTP-/UI-tegevuse lõpp.
- Vana paranduskandidaadi skripti `elapsedMs` sisaldab pärast vastust ka DB lugemist ja sama võtmega korduspäringu kontrolli. Siinne kiirusaudit jätab selle latentsimõõdikuna välja.
- Omaniku tabeli 2,6 + 2,1 + 3,8 = 8,5 s ning 8,5 / 12,9 = 65,9% on aritmeetiliselt õiged. Algandmeteta pole tõendatud, et need on sama valimi liidetavad keskmised. Neljas säilinud paranduskatses moodustas kolme mudelikutse aja summa lõpetatud pöörete `answered` aegade summast **57,7–61,7%**, kuid need on teised ja statistika paranduse eelsed katsed.

Järeldus: ei piisa lausest „12,9 → 11,5 sekundit”. Vajalikud on sama valim ja režiim, esimese nähtava teksti ja avaldatud lõppvastuse eraldi piirid ning külma/sooja protsessi eristus.

### K7 — P2: mälu ja Qdranti kohta pole alust koheseks ümbertegemiseks

14:52:59 UTC lühivaatlus näitas 8936 MiB RAM-i, 5981 MiB saadaolevat mälu ja 1645 MiB kasutatud swap'i. Kahel ühe sekundi intervallil oli swap-in 0; teisel swap-out 624 KiB/s. Mälu PSI `some/full avg10` oli 0,02. **Kasutatud swap ei tõenda iseenesest aktiivset mälupudelikaela**, kuid ka see lühivaatlus ei tõenda koormuse all piisavat mälu.

`QdrantIndex.ensure` loob kasutatavate `tenant`, `generation_id`, `document_id`, `version_id`, `config_id` väljade keyword-indeksid. Praeguse kollektsiooni tegelik payload-skeem jäi katkestatud proovis kinnitamata. Vestlus kasutab **`exact: true`**: HNSW ligikaudsele otsingule üleminek muudab kandidaate ning vajab oma kvaliteedikontrolli; see ei ole ohutu lüliti üksnes kiiruse nimel.

Qdranti [`/profiler/slow_requests`](https://qdrant.tech/documentation/ops-monitoring/slow-request-log/) on dokumentatsiooni järgi saadaval alates 1.16.0 beetaversioonist. Paigaldatud versioon jäi siin kinnitamata. Logi sisaldab ka päringu täielikku keha; seda ei loetud ega ole vaja auditi raportisse kopeerida. [Payload-indeksite juhend](https://qdrant.tech/documentation/search/low-latency-search/) toetab nende kontrollimist, kuid ei tõenda, et need selles rakenduses puuduvad. PostgreSQL-i [`ANALYZE` juhend](https://www.postgresql.org/docs/current/sql-analyze.html) selgitab kasutatud statistika eesmärki.

RAM-i ostu ega korpuse kärpimist see audit ei põhjenda. 100 000 lõigu tegelik kulu ning samaaegsete kasutajate piir on endiselt **NOT_PROVEN**.

## Ettevalmistatud järgmine töö, käivitamata

1. **Säilitada #456 parandus enne mis tahes avaldamist.** Kohalik `main` ja `origin/main` lahknevad. Tuleb ühendada ajalugu tavapärase merge'iga, säilitades `capacity.js` ja `postgres.js` statistika täienduse ning teiste poolelioleva töö. Selles auditifaasis merge'i, push'i ega deploy'd ei tehtud. Eelmise kandidaadi Q1–Q3 kvaliteedipuudused jäävad samuti kehtima.
2. **Omanik peatab serveris töö.** Valmistatud [käivitaja](rag-speed-audit-2026-10-08-run.py) nõuab selgesõnalist `--server-work-paused` argumenti ning kontrollib, et frontend on peatatud. Ta ei peata ega käivita teenust ise. PostgreSQL ja Qdrant peavad mõõtmise ajal töötama.
3. **Tasuta mikroproov:** [lugemisskript](rag-speed-audit-2026-10-08-read.mjs) on seotud SHA-ga `18f5cf25`; teise väljalaske korral keeldub käivitaja. PostgreSQL-i ühendused on vaikimisi read-only, üks ühendus, 15 s päringu- ja 1 s lukuajapiir. Lubatud on ainult kohalik võrk. Proov loeb ajastuste kitsast projektsiooni, kontrollib statistika hinnanguid ja indekseid, võrdleb kaht järjestust kahe sünteetilise tekstiga ning kasutab vektorotsinguks olemasolevat sünteetilist vektorit. Ei tee uusi embedding-/Luna-kutseid, `ANALYZE`-i ega andmekirjutusi. **Skripti praegune pausikaitse ja täielik lõpuni jooks on NOT_RUN.**
4. **Täpne allikavaliku alamajastus** tuleb ette valmistada esimese jõudlusparanduse juurde: piirata mõõtmine olemasolevate sünteetiliste sisenditega ja eristada allikate laadimine, kontroll, mudel ning arvestus. Salvestatud mudelivalikuid saab kasutada tasuta taasesituseks; see tõendab tehnilist käitumist, mitte uue mudelivastuse sisulist kvaliteeti.
5. **Alles tõendi järel valida muudatus.** Esmalt SQL-i tegelik plaan ja kandidaaditekstide laadimise/kontrolli tee; seejärel vajadusel perioodiradade paralleelsus. Mudeli planeerimise eemaldamine ja korpuse mahu vähendamine pole esimesed sammud.

Sobivad sihttestid pärast omaniku lubatud testiakna algust: `rag-v2-generation-statistics.test.mjs` (origin/main), `rag-v2-capacity.test.mjs`, `rag-v2-pilot-core.test.mjs`, `rag-v2-pilot-retrieval.test.mjs`, `rag-v2-search-assist.test.mjs`, `rag-v2-answer-stream.test.mjs`; tegeliku SQL-/allikalaadimise muudatuse korral eraldatud DB-integratsioonitest. **Ühtegi neist selles auditis ei käivitatud.** Täislint ja build pole auditi nõuded.

30–50 uut tasulist vestluspöördumist ei ole selle töö kohustuslik värav ega siin kavandatud automaatne järgmine samm. Kulu jääk 0,370929350 USD ei ole luba ületada omaniku praegust testipausi. Tulevase lubatud tervikvõrdluse puhul tuleb hoida sama küsimuste valim kõigis kolmes rollis, külm/soe algseis, arutlustase, tõendite kvaliteet, rahakulu, esimene tekst ja avaldatud lõppvastus eraldi.

## Lõppseis

Audit ja mõõtmise ettevalmistus valmis. Pärast testipausi kasutati ainult kohalikke olemasolevaid tõendeid; serveri uut kiirust ega optimeerimisvõitu ei kinnitata. Rakenduse käitumine on muutmata, tasuline kulu muutumata, testid ja avaldamine käivitamata. Dokumendi vormistuse kontroll: `git diff --check`.
