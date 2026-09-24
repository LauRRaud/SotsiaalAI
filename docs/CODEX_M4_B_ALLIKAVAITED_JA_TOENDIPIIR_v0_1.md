# M4-B täpsustus: allikaväited ja tõendusmaterjali piirid

Versioon: 0.1 · 06.09.2026

**Töö eesmärk:** teha olemasoleva M4 vastuselepingu väike, versioonitud täpsustus, et kasulik allikapõhine osavastus ja aus selgitus tõendusmaterjali piirist saaksid koos väljenduda. Allikaväidete viitenõuet ei lõdvendata. See on sama M4-B töö jätk, mitte uus RAG-arhitektuur või kogu M4 vastuvõtt.

## 1. Alus ja tõendite piir

Loe projekti kehtivaid juhiseid ja uusimat `docs/platvormi arendus/SotsiaalAI.md` S1.0 kirjet. Säilita kasutaja muud tööd. Aktiivne tööseis jääb sinna, mitte sellesse ülesandefaili.

Aluseks on `docs/audits/rag-v2-m4-b-pilot-2026-09-06.md` jaotis „06.09.2026 parandatud M4-B pärisregressioon — enne ja pärast”. Vestlusse lisatud aruandekoopia SHA-256 on `1428e4d3ec79f59a60bad7af3364c2a832cc0d5d2d0ee012b19833426850ab69`; repositooriumi aruanne võib uute lisanduste tõttu sellest erineda.

Aruandes kirjeldatud paigalduscommit: `e7532b8bab6913cd8b85b3c84b1f259a5cc9bd79`. Ülesande koostamisel loeti selle commit'i kahte faili:

- `lib/rag-v2/pilot/contracts.js`, Git blob `a468fede9707c9cb44f59366edf662437a81b185`;
- `lib/rag-v2/pilot/presentation.js`, Git blob `27ead86e6cfa2bc74ed7519ad18567c9b0a83734`.

See oli kitsas lähtekoodilugemine, mitte serveri, kogu repositooriumi ega käivitatud testide sõltumatu kontroll. Tegelikud pärisvastused ja mustandid pole käesoleva ülesande koostamisel uuesti läbi loetud. Codex peab kasutama nende lubatud kohalikke artefakte, mitte taastama tekste aruande parafraasidest.

### Aruandest tulenev lähtekoht

Kaheksast uuest vastamiskatsest avaldati kuus, kaks peatati. Mõlemad EN vastused olid nüüd ingliskeelsed, toored/dubleeritud viited kadusid ja kaheksa küsimust koos kahe veapöördega taastusid värskendamisel. Uusi embedding-kutseid oli null. Seitse võrreldavat vana ja uut allikapaketti olid samad. Need on ühe regressioonijooksu tulemused, mitte üldine kvaliteedigarantii.

Küsimus 4 peatati väljal `$.blocks[1].refs`, küsimus 7 väljal `$.blocks[2].refs`: mõlemas oli `factual=true` ja `refs=[]`. Aruande järgi kirjeldasid need plokid antud tõendusmaterjali piiri. Uue jooksu mustandid, paketid ja valideerimispõhjused on säilinud. Algse esimese jooksu neljandat puuduvat mustandit ei ole taastatud.

Küsimuse 4 paketis pole ministeeriumi põhikäsitlus võrdluseks piisavalt esindatud. Viitevormingu parandamine ei too puuduvat põhiteksti paketti: selle küsimuse aus väljund võib jääda osaliseks.

### Koodist nähtav täpsustus

Praeguses lepingus on juba `kind`, `blocks`, `limitations` ja `clarification`. Plokis on `text`, `factual` ja `refs`. Viitenõue kontrollib `factual=true` korral mittetühja viiteloendit.

Lisaks nõuab `validateAnswer()` praegu vähemalt ühte plokki kõigi `kind` väärtuste korral, kuigi skeemis on ka `clarification` ja `unsupported`. See pole nende kahe konkreetse peatamise tõendatud põhjus, kuid kuulub sama lepingu kooskõla kontrolli: puhas täpsustusküsimus ei tohi vajada väljamõeldud faktiplokki. Praegune renderdaja ühendab plokid, piirangud ja täpsustuse eraldi, seega põhiesituse osi ei pea uuesti leiutama.

## 2. Teostuse ulatus

Teosta kohalik väljundilepingu, prompti, versioonikäsitluse ja sihttestide täpsustus. Vajaduse korral kohanda sama lepingu HTTP-/renderdusühendust. Ära lisa uut andmebaasi, indeksit, automaatset hindamisagenti ega korpuse piisavuse otsustajat.

Enne muutmist ava kaitstud regressiooniartefaktidest kahe peatatud katse **kõik** plokid koos allikapakettidega. Kinnita, milline tekst on allikaväide ja milline valitud tõendite piirang. Ühe vea parandamine ei kinnita automaatselt ülejäänud mustandi sisu.

## 3. Uue versiooni semantiline leping

Kasuta olemasolevat jaotust; uut paralleelset vastuseandmemudelit pole vaja.

| Osa | Lubatud tähendus | Viite ja kontrolli alus |
| --- | --- | --- |
| `blocks` | Allikast toetatud väide või allikate selgelt piiritletud süntees. | Vähemalt üks sama paketi lubatud viide; viite olemasolu ei tõenda veel semantilist tuge. |
| `limitations` | Mida ei saa selle vastuse jaoks antud väljavõtete põhjal piisavalt kinnitada või võrrelda. | Puudumise kohta ei leiutata dokumendiviidet. Ulatus piirdub valitud materjaliga, mitte kogu artikli, andmebaasi või maailmaga. |
| `clarification` | Vastamiseks vajalik küsimus puuduva kasutajaasjaolu kohta. | Küsimus ise ei vaja allikaviidet. Sellesse ei peideta uut fakti, eeldust, hinda ega menetlusreeglit. |

**Uues versioonis on `blocks` allikaväidete koht.** Ühilduvuse huvides võib `factual` välja alles jätta, kuid siin peab selle väärtus olema `true`; mudeli vabalt valitud `false` ei ole allikaväidete viitekontrollist möödumise viis. Vestluslik üleminekulause võib kuuluda allikaplokki koos tõendatud sisuga, kuid ainult üleminekulause jaoks ei lisata näilist viidet. Puhas piirang või küsimus läheb vastavasse eraldi välja.

Täpsusta ka `kind` ja sisu kooskõla uue versiooni puhul:

- `grounded`: vähemalt üks allikaplokk; nimetus on mudeli hinnang, mitte serveri tõendatud täielikkus.
- `partial`: vähemalt üks allikaplokk ning sisuline piirang või vajalik täpsustusküsimus.
- `clarification`: sisuline täpsustusküsimus; `blocks=[]` on lubatud. Asjakohane viidatud üldinfo võib olla plokkides, kuid pole kohustuslik.
- `unsupported`: `blocks=[]` ja sisuline materjalipiiri selgitus; vajaduse korral täpsustusküsimus. Kui allikapõhist põhivastust tegelikult antakse, kasuta `partial`, mitte `unsupported`.
- Tervikuna tühi või tühikutest koosnev nähtav vastus ei ole üheski harus lubatud.

Väljundskeem, serverivalideerija, prompt ja renderdaja peavad kirjeldama sama lepingut. Säilita olemasolevad pikkuse-, ühikute-, viite- ja õigusepiirid. Ära nimeta JSON-vormi kontrolli loomuliku keele tõesuse kontrolliks.

### Piirangu õige ulatus

Vastuse näidisvorm, mitte valmis hinnang konkreetsele mustandile:

> „Selles vastuses kasutatud väljavõtted ei anna piisavat alust ministeeriumi rõhuasetuste võrdlemiseks.”

See ei võrdu väitega „artiklis pole ministeeriumi kommentaari”. Samuti ei võrdu „nende materjalide põhjal ei saa siduvat üldreeglit kinnitada” väitega „sellist õiguslikku alust ei eksisteeri”. Esimesed väljendavad piiratud tõendi seisundit; teised on laiemad faktiväited ja vajavad oma tõendit.

Allika enda väide, nt et kindel faktileht ei täpsusta teenuse hinda, on allikaväide ja võib olla viidatud plokis. Vastaja ebapiisav teadmine ei ole allikatsitaat. Ära sunni mõlemat sama viitereegli alla.

`limitations` ei ole kontrollimata faktide kõrvaluks. Kui lause sisaldab soovituse kõrval väidet kehtiva õiguse, tegeliku sündmuse, terve dokumendi sisu või allika antud garantii kohta, tuleb see eraldada viidatud allikaväitena või jätta põhjendamata osa lisamata. Mõne lubamatu väljendi tehniline tõrje ei ole ammendav semantiline filter. Selle piiri tegelikku toimimist hinnatakse ka vastuse lugemisel.

## 4. Keelatud kiirparandused

Ära lisa puuduvale viitele vaikimisi `S1`, kõiki S-viiteid või uut näilist „paketiviidet”. Ära lülita vigasel plokil automaatselt `factual=false` ega liiguta tundmatut vabateksti regexi abil piirangutesse. Ära kustuta lihtsalt viiteta lõiku ja avalda ülejäänut: välja võib kaduda vastuse mõtet muutev tingimus.

Ära lisa teist genereerivat paranduskutset, tõlkeagenti, varumudelit ega automaatset kordust. Ära kirjuta tootmises ajaloolist `answer_rejected` pööret ümber edukaks vastuseks. Katse taastamine ei ole uue vastuse tellimine.

## 5. Allika rolli ja ulatuse täpsus

Täpsusta sama üldist prompti, mitte kaheksa küsimuse põhiseid erandeid. Fikseeritud vastuseid, sobivaid lehekülgi ega hindaja märgendeid runtime'i ei anta.

Arendusnäidetena kasuta aruandes allesjäänud puudusi: eesmärgi „toob kokku” muutumine juba toimunud sündmuseks, õppefaktilehe esitamine üldise praeguse menetlusreeglina, täpse adressaadi üldistamine ja küsitu suhtes kõrvalised piirangud. Järeldus peab säilitama viidatud allika rolli ja aja. Sama ploki sündmusväide vajab selle sündmuse allikat, mitte vaid teise paketiüksuse olemasolu.

Need on sisulise kontrolli juhtumid, mitte lubadus, et uus prompt need kõik kõrvaldab. Ära saavuta paremat avaldamismäära põhifaktide, vajalike erisuste või oluliste piirangute eemaldamisega. Asjatu keeldumine täieliku toe korral on samuti kvaliteediviga.

## 6. Versioonid ja ajalooline taasesitus

Lisa uuele lepingule ja promptile eristatavad versioonid. Säilita eraldi seniste `m4-text-refs-1` ja `m4-text-refs-2` lugemine, valideerimise tähendus ja esitus; ühe `LEGACY_ANSWER_VERSION` väärtuse pime asendamine ei tohi versiooni 2 tuge kaotada.

Uue versiooni erandid ei rakendu vanadele vastustele tagasiulatuvalt. Juba avaldatud vastuseid või peatatud mustandeid ei muudeta uue lepinguga ajaloos automaatselt. Algmustandid, paketid ja katseloendurid säilivad muutmata oma kehtivate säilitus- ja juurdepääsureeglite piires.

Audit seob ka kohaliku taasesituse sisendiräsi, tõelise algversiooni, kasutatud kontrolliversiooni ning tulemuse. Uue lepingu käsitsi koostatud oodatud väljund on eraldi testandmestik, mitte päris Luna algväljund.

## 7. Kohalikud vastuvõtukontrollid

Käivita mõjutatud olemasolevad testid ja lisa vähemalt järgnevad juhtumid. Täpne testide arv tuleneb teostusest; ära esita nõuete loetelu läbinud testidena.

| Kontroll | Oodatav tulemus |
| --- | --- |
| Kahe tegeliku peatatud mustandi muutmata taasesitus nende vana lepinguga | Kordub dokumenteeritud viiteviga; algtekst ja ajalooline otsus ei muutu. |
| Eraldi käsitsi märgistatud oodatud osavastus sama paketiga | Viidatud põhisisu ja paketipiir `limitations` väljal läbivad uue tehnilise lepingu; semantiline sobivus kirjeldatakse eraldi. |
| Positiivne allikaväide tühja viiteloendiga või `factual=false` uues plokis | Tagasilükkamine; ei teki automaatset ümberklassifitseerimist. |
| Tundmatu viide, teise pöörde/allika/versiooni või teise kasutaja viide | Senine range tõrje säilib. |
| Tõendita täpsustusküsimus ja materjalipiir koos `blocks=[]` | Läbivad vastavas `kind` harus ning on kasutajale nähtavad; näilist allikaviidet ei teki. |
| Tühi `grounded`, sisuta `unsupported`, küsimuseta `clarification` | Tagasilükkamine. |
| Täieliku toe positiivne näidis | Kasulik viidatud vastus säilib; paranduseks ei asendata kõike piirangu ega keeldumisega. |
| Piirangu-välja väärkasutamise sisulised näited | Vastandatakse lubatud paketipiir ja põhjendamatu üldväide. Raportis eristatakse automaatset vormikontrolli ning assistendi/inimese sisulist otsust. |
| ET/EN/RU põhivastus, piirang ja küsimus | Õige sihtkeele leping ning senine puhas viiteesitus säilivad testtranspordis. |
| Varasemate versioonide vastused ja peatamised | Versiooniteadlik esitus ja õige terminalne seis säilivad. |
| Brauseris partial, clarification/unsupported ning tõeline/sünteetiline viiteviga | Refresh, allikalt naasmine ja mobiilikuva taastavad kõik pöörded õiges järjekorras, ilma uute teenusekutseteta. |
| Õiguste tühistamine, aegumine, sama võtme kordus, paketisalvestuse tõrge | Senised auditist ja ledgerist tulenevad kaitsed säilivad. |

Privaatsed pärisandmetega fixture'id jäävad lubatud aeguvasse kohalikku hoidlasse, mitte avalikku testi või Git-commit'i. Aegunud artefakti asemel kasuta selgelt sünteetilist juhtumit; ära nimeta seda pärisvastuse taasesituseks.

## 8. Mida selles plokis ei muudeta

Säilita `vector-ranked-first-v1`, korpus, tükeldus, põlvkond, embedding-ruum ja vastamismudel. M2/M2.3 kinnitusi ega seitset lahtist semantilist juhtumit uuesti ei avata. M3 sõltuvusgraafi, M5 ajalist rada ega pikaajalist mälu ei lisata.

Välismudelikutseid selles töövoorus: **0**. Push, deploy ja avaliku vastamise avamine ei kuulu sellesse juhisesse. Seniste pärisjooksude katselaed on täis; ülejäänud raha ei anna uusi katseid. Säilitusaja või loa lõppu ei pikendata vaikimisi.

## 9. Väljund ja järgmine otsus

Esita üks kohalik parandus ning raport: mida muudeti, miks olemasolev leping ei sobinud, vana ja uue lepingu näited, tegelikud pass/fail/skip tulemused, muutmata ajaloofailide kontroll ning allesjäänud semantilised piirid. Näita, et küsimus 4 saab väljendada ainult toetatud osa, mitte puuduva ministeeriumikäsitluse väljamõeldud võrdlust.

Valmista ette järgmise piiratud päriskatse ulatus muutunud lepingule: kaks peatunud juhtumit, täieliku toe kontroll ja puuduliku toe/täpsustuse kontroll, vajaduse korral keelte katvusega. Ära käivita automaatselt uut kaheksa küsimuse häälestusringi. Täpne küsimustik, kvoot ja kulupiir kuuluvad järgmisse heakskiidetud plaani. Uued parafraasid ei ole pärast nende järgi prompti häälestamist puutumatu kontroll.

Kohaliku testi edu tõendab tehnilist väljendus- ja kontrollirada. Mudeli õige rollivalik, semantiline allikatugi ja kasutaja saadava vastuse kasulikkus vajavad päristulemust. M4 ei muutu selle faili või kohaliku testiga tervikuna vastuvõetuks.
