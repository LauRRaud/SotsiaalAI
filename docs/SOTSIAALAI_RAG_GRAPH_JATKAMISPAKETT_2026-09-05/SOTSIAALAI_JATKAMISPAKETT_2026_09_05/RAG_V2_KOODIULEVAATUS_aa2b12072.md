# SotsiaalAI RAG v2: lähtekoodi ülevaatus

**Kuupäev:** 2026-09-05  
**Repositoorium:** `LauRRaud/SotsiaalAI`  
**Vaadatud commit:** `aa2b120721f066233c4d77770dcd49fd9a0713a0`  
**Ulatus:** lugemine ja eraldatud kohalik diagnostika; repositooriumis muudatusi ei tehtud.

See on ühe koodiversiooni ülevaatus, mitte uus elav master, täielik turvaaudit ega tootmisse lubamine. Aktiivse töö allikaks jääb projekti `docs/platvormi arendus/SotsiaalAI.md` S1.0. Kõik allpool nimetatud koodifailid käivad ülaltoodud commit'i kohta.

## Kokkuvõte

Senist RAG-i ei ole põhjust uuesti alustada. Lähtekoodis on eristatavad sissevõtt, muutmatud versioonid, PostgreSQL-i põhiregister, Qdranti otsing, õiguste kontroll, vastamiskontekst ja hindaja. Välismudeli kasutamine on piloodis eksplitsiitne; agentide ahelat selles otsinguteostuses ei ole.

Ülevaatuse kõige olulisemad järeldused:

1. Kahe programmiallika küsimuse puhul oli eelmise vestluse võimalik hindamisvea kahtlus põhjendamatu: täpne küsimus nõuab Tehnopoli ja EKA materjale. Seda v1 juhtumit ei tohi ainuüksi EKA allika sisulise kattuvuse tõttu õigeks ümber märkida.
2. Hindaja mõõdab ettemääratud allikafraaside jõudmist konteksti. See pole keelemudel ega kõigi võimalike sisuliselt samaväärsete vastuste kontrollija.
3. Praegune RRF annab 40 kandidaadi ja konstandi 60 korral igale mõlemas kanalis esinevale kandidaadile suurema skoori kui üksnes ühes kanalis esimesel kohal olevale kandidaadile. See on valemi omadus, mitte tõestatud programmeerimisviga.
4. Struktuuriraja katse asendab viie järjestatud seemne valiku kolme seemne ja kuni kahe naabriga. See ei ole viis parimat tulemust pluss tasuta lisakontekst.
5. Iga päring loeb ja valideerib enne otsingut kogu kasutajale lubatud aktiivse korpuse detailandmed. See on suure korpuse jaoks oluline skaleerimisrisk; serveri tegelikku suure koormuse jõudlust siin ei mõõdetud.
6. Pärisembedding'u rada on praegu kinnitatud sisendite korduskasutuspiloot, mitte suvaliste uute kasutajapäringute teenus. M4 vajab selleks eraldi lubatud päringuadapterit.
7. Hindamises kasutatav profiil ja `retrieve()` vaikeprofiil erinevad. Tulevase vastaja ühendamisel tuleb kasutada eksplitsiitset, hinnatud profiili.

## Kontrolli alus ja piir

GitHubi `main` kontrolliti ülevaatuse alguses ja lõpus: mõlemal korral oli haru viide ülaltoodud SHA-l. See ei kinnita kohaliku arvuti ega serveri tööpuu seisu.

Lähtekoodist loeti muu hulgas:

- `lib/rag-v2/contracts.js`, `normalize.js`;
- `lib/rag-v2/search/retrieval.js`, `ranking.js`, `postgres.js`, `qdrant.js`;
- `indexing.js`, `embedding.js`, `structural-role.js`, `model-context.js`;
- `evaluator.js`, `multi-source-plan.js`, `pilot-runner.js`;
- `tests/evaluation/multi-source/questions.json`, `anchor-groups.json`;
- `tests/rag-v2-search.test.mjs`, `tests/rag-v2-pilot.test.mjs`;
- `scripts/rag-v2-search.mjs`, `app/api/chat/route.js`;
- ADR-004, README asjakohased osad ning SotsiaalAI.md S1.0.

Kõiki repositooriumi faile, kogu PDF-parserit ja iga sõltuvust ei auditeeritud. Kõigi kaheksa alg-PDF-i täielikku uut ülevaatust ei tehtud. Varasemad kasutaja lisatud raportid olid võrdlusmaterjal, mitte uus serverikäivitus.

Algset 61-testi komplekti, PostgreSQL-i/Qdranti integratsiooni ja tootmisbuild'i siin uuesti ei käivitatud.

## A. Kahe allika küsimus: kahtlus on täpsustatud

**Allikad:** `tests/evaluation/multi-source/questions.json` ja `anchor-groups.json`.

`wellbeing-two-source-roles-et` tegelik küsimus:

> Kes viivad Tehnopoli kirjelduse järgi heaolutehnoloogiate programmi ellu ja millist rolli kirjeldab EKA enda materjal?

Ankur `implementers` nõuab Tehnopoli PDF-i esimesel lehel asuvat elluviijate fraasi. Ankur `eka-role` lubab EKA PDF-i kahte alternatiivset allikakohta.

Seega on kaks allikat küsimuse tegelik osa. EKA tekst võib nimetada samu elluviijaid, kuid ainult selle põhjal ei ole esitatud nõutud Tehnopoli allikalist alust. Varasem tähelepanek alternatiivsest sisutoest jääb üldise elluviijate küsimuse jaoks asjakohaseks, mitte põhjuseks seda konkreetset v1 tulemust muuta.

**Otsus:** selle juhtumi allikanõue on põhjendatud. Ära muuda v1 silti ega leevenda ankrut tulemuse parandamiseks. Üldise küsimuse ja kahe allika küsimuse võib hiljem teha eraldi katsejuhtumiteks, kuid neid ei tohi ajalooliselt samastada.

## B. Inimsuhete ja arendustingimuste küsimus jääb sisulise rubriigi küsimuseks

**Allikad:** sama küsimuste- ja ankrufail; varem lisatud algartikli PDF.

Täpne küsimus küsib artikli piiri inimsuhetes ning arendustingimusi, mille korral AI saab sotsiaaltööd toetada. `development-conditions` nõuab 12. lehe fraasi „arendusprotsess on läbipaistev, väärtuspõhine ja kaasav”.

Varasema raporti hübriidkontekst sisaldab lehekülgede 7–8 kultuuritausta, kasutajate osaluse ja suhetekesksuse käsitlust. Need teemad kattuvad, kuid ei ole ilma täiendava sisulise otsuseta samaväärsed.

**Otsus:** hindaja käitumine on lähtekoodist seletatav; see ei tuvastanud nõutud fraasi. Koodi põhjal ei saa otsustada, et teine tekst on küsimusele täielik sisuline alternatiiv. Enne rubriigi laiendamist tuleb sõnastada vajalikud mõtted ja kinnitada nende alternatiivne tugi. Praegust ebaõnnestumist ei tohi automaatselt õigeks ega hindajat vigaseks nimetada.

## C. Hindaja: mida ta kontrollib ja mida mitte

**Allikas:** `lib/rag-v2/search/evaluator.js`, `resolveAnchorGroups()` ja `anchorCoverage()`.

Enne otsingut lahendatakse ankur PDF-räsi, lehe ja tekstifraasi kaudu konkreetseks dokumendiks, versiooniks ja span-loendiks. Katvuse kontroll nõuab korraga:

- dokumendi ja versiooni vastavust;
- oodatud PDF-lehe olemasolu;
- vähemalt ühe nõutud span-ID olemasolu;
- `source_text.includes(anchor.contains)` vastet.

Ühe rühma alternatiivide vahel on VÕI; täieliku toe jaoks peavad vajalikud rühmad kõik kaetud olema. `evaluateRetrieval()` annab otsingule küsimuse, keele ja otsinguseaded, mitte õigeid dokumendi-ID-sid ega ankruid.

See on kasulik deterministlik regressioonikontroll. Ühiktest kontrollib, et õige ID/leht ilma fraasita ei annaks tabamust, ning et defineeritud alternatiiv aktsepteeritaks.

**Piir:** `full` tähistab selles mõõdikus kõigi defineeritud ankrurühmade katvust. See ei tõesta iseseisvalt kõigi vastuseks vajalike väidete, eelduste, negatsioonide, summade või alternatiivsete allikate täielikku sisulist katvust. Samuti ei hinnata Luna lõppvastust.

**Soovitus:** säilita deterministlik ankrumõõdik ning erista sellest sisuline ülevaatus ja eksplitsiitse allikanõude täitmine. Ära asenda hindajat automaatselt teise keelemudeli arvamusega.

## D. RRF-i konkreetne omadus

**Allikad:** `ranking.js:rrf()`, `indexing.js:searchConfig()`, `evaluator.js`.

Praegune valem on `sum(1/(60+rank))`; katse lubab 40 kandidaati kanali kohta. Seega:

| Kandidaadi asukoht | RRF-skoor |
| --- | ---: |
| Ainult vektoris kohal 1 | 1/61 = 0,01639344262295082 |
| Mõlemas kanalis kohal 40 | 1/100 + 1/100 = 0,02 |

Järelikult kõigi nende piirides mõlemas kanalis esinevate kandidaatide skoor ületab iga ainult ühes kanalis esineva kandidaadi skoori. Kauguse/toorskoori tugevus seda ei muuda, sest teostus kasutab ainult järke.

`postgres.js:lexical()` kasutab `pg_catalog.simple` päringut ning muudab AND-ühendused OR-ühendusteks. Seetõttu võib kanali olemasoluvastus tulla ka mõne üksiku sõna kattuvusest. Millist tegelikku juhtumit see kahjustas, tuleb näidata salvestatud kanalijärkude ja konkreetse teksti abil.

**Staatus:** valemi käitumine on kinnitatud. Üksiku sisulise vea täielik põhjus ei ole ainuüksi selle arvutusega tõendatud. Puudub alus panna praegu suvalist uut kaalu või piirmäära tootmiskoodi.

## E. Struktuuriraja eelarve

**Allikad:** `evaluator.js:methods`, `retrieval.js:add()/neighbors()`.

Katse seab:
- tavalisele hübriidile `topK=5`, `graph=false`;
- struktuurirajale `topK=3`, `graph=true`, kuni 2 lisandust;
- mõlemale `finalLimit=5`, `perDocument=5` ja 6000 tokenit.

Seemned võetakse järjestuse algusest. Naabrid valitakse dokumendi struktuursete servade ja järjekorra alusel; need ei läbi eraldi semantilist sobivushindamist. Järjestuse neljas ja viies tulemus ei ole struktuuriraja jaoks kaitstud seemned. Kui lisandusi ei leita, puudub praeguses harus eraldi parimate ülejäänud seemnetega täitmine.

See selgitab, kuidas vajalik viies tulemus saab lõppkontekstist kaduda, ilma et indeks või algallikas oleks rikutud. Käitumine vastab ADR-004 katse seadistusele.

**Soovitus:** ära lülita praegust laiendust vaikimisi sisse. Edasine katse peab võrdlema konteksti valikupoliitikaid võrdse mahu ja samade sisukriteeriumidega, mitte eeldama, et igal päringul peab olema täpselt kaks naabrit. M3 semantilised tingimus- ja erandiseosed pole sama mehhanism.

## F. Kogu korpuse korduv lugemine päringu ajal

**Allikad:** `retrieval.js:retrieve()`, `postgres.js:bundles()/units()`, `embedding.js:indexUnit()`, `qdrant.js:query()`.

Enne kanalite otsingut:
1. loetakse lubatud dokumentide täielikud bundle'id;
2. kontrollitakse bundle'i räsid ja andmeobjektide vastavus;
3. loetakse kõik filtreeritud dokumentide indeksiüksused;
4. rekonstrueeritakse iga üksus `indexUnit()` abil, mis muu hulgas tokeniseerib selle embedding-teksti;
5. arvutatakse struktuurne roll ja koostatakse lubatud üksuste ID-loend.

Qdranti päring saab kõik sobivad üksuse-ID-d `has_id` filtris ning kasutab `params: { exact: true }`. `indexSnapshot()` seab praegu ka 5000 indeksiüksuse ülempiiri.

**Järeldus:** küsimuse-eelne töö kasvab korpuse mahuga, mitte ainult tagastatavate kandidaatide arvuga. Otsingu 69 üksusega katse ei näita veel suure korpuse kiirust. Tegelikku p95/koormust siin ei mõõdetud.

**Edasine tööjaotuse suund, mitte kohene patch:** suured tervikluskontrollid indeksi ettevalmistamisse ja valideeritud põlvkonna laadimisse; päringu ajal õiguste ning põlvkonna kontroll, kandidaatide otsing ja ainult kasutatavate tõendite kanooniline laadimine/kontroll. Säilita fail-closed käitumine ja õiguste tühistamise kontroll. Ära lahenda jõudlust lihtsalt kaitseid eemaldades või exact-otsingut mõõtmata välja lülitades.

## G. Piloodirada ei ole veel uue kasutajapäringu rada

**Allikad:** `pilot-runner.js:StoredEmbedding/CombinedStoredEmbedding`, `retrieval.js`, `scripts/rag-v2-search.mjs`, `app/api/chat/route.js`.

Pärisrežiimi retrieve nõuab `embedding.source === 'persisted_vectors'`. Salvestatud adapter otsib täisteksti räsi järgi vektorit ning annab puudumisel `stored_embedding_missing`. Välismudeliga kinnitatud piloot teeb oma saatmised eraldi.

Üldine `rag-v2-search.mjs` CLI loob praegu alati `MockEmbedding` objekti. Selle kasutamine aktiivse pärisindeksi vastu ei ole automaatne pärisotsing: konfiguratsioonikontroll peab selle sobimatuse tagasi lükkama.

`/api/chat` POST säilitab autentimise ja päringupiirangu ning tagastab `RAG_RETIRED` 503. GET annab `generationAvailable=false`.

**Otsus:** need on praeguse etapi ausad piirid, mitte varjatud Luna-vastamine. M4 vajab uue lubatud küsimuse embedding'u adapterit, serverisessiooni põhist õigust, privaatsuse/kvoodi käsitlust ning üht vastamisadapterit. Agentide lisamine ei ole selle eeltingimus. Piloodi käsitsi kinnitatud sisendiloendi põhimõtet ei peaks vaikimisi muutma tootmiskasutaja iga küsimuse käsitsi lubamise nõudeks; tootmisrada vajab oma eksplitsiitset kasutuspoliitikat.

## H. Hinnatud profiil erineb tuuma vaikeprofiilist

**Allikad:** `ranking.js:validateQuery()` ja `evaluator.js:evaluateRetrieval()`.

| Seade | Tuuma vaikeväärtus | Mitme allika katse |
| --- | --- | --- |
| `contextMode` | `audit` | `compact` |
| `includeDocumentLabels` | `true` | `false` |
| `perDocument` | 3 | 5 |
| `finalLimit` | `topK + graphAdditions` ehk tavaliselt 7 | 5 |
| Struktuur | välja lülitatud | sõltub võrdlusrajast |

Vaikimisi 7 ei tähenda, et graafita päring tegelikult tagastaks 7 seemet: `topK` jääb 5-ks. Erinevused on siiski olulised nii tokenieelarve kui allikate valiku jaoks.

**Soovitus:** M4 kasutab teadlikult kinnitatud ja versioonitud otsinguprofiili. Testi head tulemust ei kanta vaikimisi üle teisele parameetrikomplektile. Ülevaatus ise ei muuda neid vaikeväärtusi.

## I. Enne KOV-i ja ajakäsitluse kasutust vajab ingest järgmisi andmelepinguid

**Allikad:** `normalize.js`, `ranking.js:filtersMatch()`.

Praegune normaliseerija alustab `valid_from`, `valid_to` ja `described_period` välju teadmata väärtusega ning ei kaardista `regions` välja. Avaldamiskuupäeva tuvastamine otsib esimese lehe tekstist profiili kuunimedega kindlat mustrit. JSON-i täielik sisu säilib `legacy_metadata` all, kuid see ei tähenda, et kõik seal olevad väljad töötaksid otsingufiltrina.

`filtersMatch()` eeldab piirkonna ja kehtivuse jaoks vastavaid kanoonilisi välju. Seetõttu pole piirkonna- ja kehtivusfiltrite olemasolu koodis veel nende terviklik ingest-ist vastuseni toimimise tõend.

**Otsus:** enne vastavaid KOV-/ajalugu käsitlevaid katseid täienda konkreetsete allikaliikide andmelepingut ja testsisendeid. Ära järelda puuduvaid kuupäevi ega piirkonda automaatselt. Artiklite piiratud vastamispiloot ei pea ootama kogu normimudeli valmimist.

## J. Mis tuleks säilitada

- Ingest'i algtekst, versioonid ja päritolu jäävad indeksitest eristatavaks.
- Qdranti päringufiltrid ja PostgreSQL-i valikud piiratakse lubatud tenant'i/põlvkonna/dokumentidega; enne tagastamist loetakse poliitika uuesti.
- `resolveModelReference()` nõuab kanoonilist lahendajat, mitte ainult paketi enesekooskõla.
- `modelProjection()` säilitab valitud algteksti ning lühiviited on auditist lahendatavad.
- Tõrge, tühi tulemus ja lubatud leksikaalne varurada on eristatavad.
- Piloodi kulureserveering salvestatakse enne saatmist ning teadmata tulemuse järel puudub automaatne kordus.
- Testikood kontrollib tegelikke vigaseid vektoreid, puuduvaid fraase, alternatiivankruid ja ligipääsu tühistamist; neid katseid ei nimetata semantilise kvaliteedi tõendiks.

Need tähelepanekud on lähtekoodipõhised. Need ei asenda serveri seadistuse, kõigi ründeolukordade või täieliku privaatsusraja kontrolli.

## Kohaliku diagnostika ulatus

Käivitus Node `v22.16.0` keskkonnas. Kasutati GitHubist loetud `ranking.js` muutmata koopiat, mille Git blob SHA kontrolliti võrdseks:

`ecd1d7cbd4b90af51973fbf1c3444e6cc17bf13a`

Ainsaks sõltuvuseks anti minimaalne `fail()` abifunktsioon; kogu repositooriumi ei paigaldatud. Kaks diagnostilist kontrolli läbisid:

1. mõlema kanali 40. koha skoor 0,02 ületab ühe kanali esikoha skoori 0,01639344262295082;
2. `validateQuery()` vaikeparameetrid vastavad eespool toodud tabelile.

See ei olnud projekti algne automaattestikomplekt ega pärisotsingu uus käivitus. Embedding- ja genereerimiskutseid selles diagnostikas oli 0.

## Järgmine otsus

M2.3 kontrollivoor saab nüüd olla kitsam: kahe allika juhtumi allikanõue on lahendatud, struktuuriraja eelarvemehhanism ja RRF-i kaalumispõhimõte on koodist kinnitatud. Alles jäänud sisulised rubriigierinevused kinnitatakse küsimuse ja teksti kaupa, seejärel võrreldakse väikseimat põhjendatud valikumuudatust sama baasiga.

Ei ole põhjust vahetada selle ülevaatuse alusel Qdranti, embedding-mudelit või kogu arhitektuuri. Samuti ei ole eesmärk panna hübriidi iga hinna eest võitma. Skaalaprobleem tuleb planeerida eraldi enne suure korpuse teenindamist, ja M4-sse ei kanta kogemata piloodist erinevat konfiguratsiooni.

See dokument ei autoriseeri koodi muutmist, väljasaatmist, push'i ega juurutamist.
