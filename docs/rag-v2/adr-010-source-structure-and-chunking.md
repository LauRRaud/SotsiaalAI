# ADR-010: allika struktuur, metaandmed ja tekstiosad

Kuupäev: 07.09.2026. Seotud sisend: [ADR-009](./adr-009-corpus-rebuild.md).

## Leping

Algfail jääb muutumatuks. Tema vorming, kontrollsumma, päritolu ja kasutusõigused kuuluvad allikaversiooni. Parsitud tekst ja otsingu tekstiosad on sellest failist tuletatud andmed. Uue parseri, chunkimise või metaandmete korral tekib uus muutumatu versioon.

Ühine allikakoht kirjeldab tekstiplokki ja täpset UTF-16 vahemikku selle tekstis. PDF-il lisanduvad päris lehekülg ja koordinaadid; HTML-il DOM-i asukoht; XML-il elemendi asukoht; JSON-il JSON Pointer. Veebilehele ega JSON-kirjele ei omistata PDF-lehekülge. Iga tekstiosa säilitab oma algteksti vahemikud ja allikaversiooni.

Metaandmed eristavad dokumendi identiteeti, bibliograafiat, avaldamise aega, kogumise/kontrollimise aega, kehtivust, geograafiat ja kasutusõigusi. Tundmatu väärtus jääb tundmatuks. Õigusakti või teenuse kehtivus ei tulene artikli ilmumisaastast. Imporditud kirjeldus ja märksõnad on otsinguabi, mitte algteksti tõend. Kohaliku failiregistri metaandmevariandid säilivad teisenduse päritolus; vastuolu ei lahendata vaikse ülekirjutamisega.

Teksti jaotus järgib allika struktuuri: peatükk, lõik, loendi element, tabelirida, õigusnorm või eraldi teenuse/kontakti kirje. Terviklik sobiva suurusega plokk säilib. Pikk plokk jagatakse lause või sõnavahe juures, säilitades vahemikud ning jätku seose. Pealkiri antakse tekstiosale kontekstiks; seda ei esitata iga kord uue algtekstina. Naabrus ja ühine teema ei tõenda sisulist sõltuvust.

## Tuuma ja adapteri piir

Tuuma kuuluvad failide terviklus, allikakohad, struktuursete plokkide jaotus, muutumatud versioonid ning nende kontroll. Riigi Teataja XML-i ja kohaliku KOV-/organisatsioonipaketi väljade tähendus kuulub allikatüübi adapterisse. Artikli nime, ID või küsimuse järgi erandeid ei lisata.

## Vastuvõtt

- Ühe- ja mitmeveerulise PDF-i lugemisjärjekord säilib toetatud paigutuses; ebaselge paigutus peab andma nähtava piirangu.
- HTML-i sisutekst eraldatakse skripte käivitamata; navigeerimine ja küpsisetekst ei kuulu artiklisse.
- XML-i ja JSON-i tekstiosadele saab tagasi leida täpse algse elemendi või välja. Väliseid XML-olemeid ei lahendata.
- Tekstiosa ei ühenda eri teenuse/kontakti kirjeid ega eri õigusnorme. Pika ploki jaotus ei kaota teksti ega lõhu Unicode'i märki.
- Bibliograafia, trükileheküljed, tegelikud PDF-leheküljed, kehtivus ja kogumisaeg säilivad eraldi koos päritoluga.
- Varem salvestatud PDF-versioonid on jätkuvalt kontrollitavad. Uus tekst või metaandmed muudavad versiooni tunnust; algfail jääb samaks.

Vastuvõtt on kohalik ja tasuliste mudelikutseteta. Kogu korpuse indekseerimine, päringu mahuparandused ning serveri konfiguratsiooni vahetus järgivad eraldi järgmistes plokkides. Vana korpuse kustutamine ei kuulu sellesse plokki.

## Kohalik vastuvõtt 08.09.2026

Sisendiplokk on teostatud ja kohalikult kontrollitud alloleva valimi ulatuses. Töö tehti main-tööpuus, algfailide koopiad ja tuletatud versioonid kirjutati ajutisse arendushoidlasse. Mudeli- ega embedding'u kutseid ei tehtud. [Mõõtmistulemus](m1-source-acceptance-2026-09-08.json) sisaldab lähtefailide ja kontrollitud koodi räsisid, versioonitunnuseid, metaandmeid, hoiatusi ning käivitatud kontrollide käske. See on kuupäevastatud tõend; aktiivne seis jääb SotsiaalAI.md faili.

| Pärisallikas | Vorming ja struktuur | Tekstiosi | Vastuvõtu tähelepanek |
| --- | --- | ---: | --- |
| „Lastekaitse juhtumikorraldusest sotsiaalteenuste ja -toetuste andmeregistris”, 2016/1 | 4 PDF-lehte, kahel veerul | 10 | Kõigil lehtedel tuvastati kaks veergu. Esimese kahe lehe renderdust võrreldi parsitud tekstiga; põhitekst järgib vasakut ja seejärel paremat veergu. Trükilehed 3–6 jäävad PDF-lehtedest 1–4 eraldi. |
| „Tehisintellekt sotsiaaltöös”, 2025/2 | 13 PDF-lehte, üks veerg | 16 | Bibliograafia säilis. Esilehe tekstist leitud kuupäev jäi kandidaadiks ega asendanud tundmatut avaldamiskuupäeva. |
| „Hoolekande- ja tervishoiuasutuste tuleohutus” | 17 PDF-lehte, üks veerg | 13 | Juhendi metaandmekihtide variandid ja vastuolud säilisid koos päritoluga. |
| „Nad on ju vanad…” / eakate seksuaalne eneseteostus hooldekodudes | HTML, 58 sisuosa | 7 | Kõik 58 DOM-i asukohta lahenevad algfailis. Autor, avaldamiskuupäev 25.09.2024 ja kogumise aeg säilivad eraldi; PDF-lehti pole. |
| Sotsiaalhoolekandelise abi andmise kord, XML 401112019012 | 26 õigusnormi ja preambul | 29 | Kõik 27 sisukohta ning seitse metaandmeviidet lahenevad XML-is. Akti identiteet ja kehtivus tulevad XML-i sisust; eri normide tekstiosi ega naabrusseoseid ei ühendata. |
| Alutaguse asendushooldusteenus | JSON Pointer /items/0, kuus välja | 6 | Ainult valitud teenus; kanooniline URL, sihtrühmade loend ning 12.04.2026 kontrollimise/kogumise kuupäevad säilivad. |
| Astangu Kutserehabilitatsiooni Keskuse pakett | JSON, 14 eraldi kirjegruppi | 113 | Kõik 113 väljakohaviidet lahenevad. Organisatsiooni, teenuse, ressursi, kontakti ja dokumendi kirjegrupid püsivad lahus. |

Kõigi seitsme allika originaali, registri ja salvestatud koopia SHA-256 kattus; manifesti kontroll ja lubatud dokumentide snapshot'i laadimine läbisid. Kõik 204 HTML/XML/JSON-i asukohta vastasid algsele elemendile või JSON-väärtusele. Metaandmete 111 JSON-viidet ning seitse XML-viidet lahenesid. Kõik tekstivahemikud vastasid oma salvestatud lähteüksuse UTF-16 tekstile. Ükski 194 tekstiosast ei ületanud 2200 märki; suurim oli 2199. HTML-i, XML-i ja JSON-i viidetes PDF-lehti ei ole. XML-i ajavööndiga kuupäeva algne kirjakuju säilib päritolus ning kehtivusfilter saab allika kalendrikuupäeva; praegust õiguslikku kehtivust veebist ei kontrollitud.

Püsiva veeruvahe tuvastus arvestab kitsast vahet ja eristab pööratud küljeservateksti lugemisjärjekorrast. Sõna/lause juures jagamine säilitab märgivahemikud ja Unicode'i; sobiv tervikplokk ei jagune eelmise tekstiosa täitmiseks. Algallikakoha vahemik ei ulatu üle eemaldatud sisuteksti. Pika JSON-välja või õigusnormi jaotamisel säilib sama kirje identiteet.

Vana rag-v2/1 kuju ühilduvus kontrolliti nii sihttestis kui ka varem salvestatud 13-lehelise PDF-versiooni (16 tekstiosa) ning kaheksa dokumendiga kohaliku snapshot'i lugemisel. Uus kuju on rag-v2/2; selle allikakohad liiguvad teadmiskirjete ankrutesse, otsingu kanoonilistesse viidetesse, M4 taastamis-/vestlusadapterisse ja HTML-eksporti. Allikavaate kood kuvab muude vormingute puhul vormingu ja detailides allikakoha, säilitades teksti ohutu esituse.

### Käivitatud kontrollid

- Uue allika-/plokilepingu 18 sihttesti läbisid: veerud ja taanded, Unicode ja vahemikud, HTML-i peidetud sisu/tabel/loend, XML-i struktuur/välisolemite keeld/kuupäevad, JSON-i kirjepiirid, päritolu, muutumatud varad, teadmiskirje ankur ning võltsitud viite ja naabruse tagasilükkamine.
- Olemasolevate teadmiskirjete ja vestlusadapteri 12 regressioonijuhtu ning valitud admini/teadmismustandi seitse juhtu läbisid. Teenused ja mudelid on neis asendatud testiadapteriga.
- Valitud 13 ingesti regressioonijuhtu läbivad kontrollitud lepingut. Algne jooks läbis 12 juhtu; I-03 ootas veel tekstist leitud kuupäeva automaatset eelistamist. Ootus viidi käesoleva lepingu järgi kandidaadiks säilitamisele ja eraldi I-03 kordus läbis. Puudu olnud ajalooline sisend võeti muutumatust kohalikust PDF-versioonist; lõplikes käivitatud juhtudes sisendipuudusest vahelejätmisi ei olnud.
- Muudetud JavaScripti failide ESLint, kahe deklaratsioonifaili TypeScripti kontroll, tõlkekontroll, git diff --check ning üks lõplik npm run build läbisid. Testid ja build jooksid UTC-s. Prisma skeemi ega migratsioone ei muudetud.

Sihttestid tõendavad nende juhtude lepingut; need ei ole kogu korpuse kvaliteedihinnang. Kontrollide üksikasjalikud käsud ja failipiir on mõõtmistulemuse JSON-is.

### Piirang ja järgmise pärisraja kontroll

OCR, keerukad tabelid, joonealuste märkuste/päiste täielik eraldamine ja ebakorrapärased paigutused ei ole vastu võetud. Näidis-PDF-i pööratud DIGAR-servatekst jääb algteksti alles ning eemaldamine otsingutekstist on auditeeritav; kogu lehekülje tüpograafia semantilist taastamist see ei tõenda. PDF-aruanded annavad layout_coverage_limit hoiatuse. HTML-i piltide/jooniste sisu ei eraldatud. KOV-/organisatsioonipaketi tekst tähendab varem korjatud sisu, mitte värskelt kontrollitud veebilehe sõnasõnalist tsitaati. Vastuoluliste metaandmete ülevaatus jääb partiide vastuvõttu.

Uute vormingute PostgreSQL/Qdranti pärisrada ja autenditud brauseri allikavaade on selle ploki jaoks NOT_PROVEN. Admini brauserivastuvõtt on endiselt PDF-i jaoks. Kohaliku CLI käivitamine ei muuda serverit, aktiivset indeksit ega vestluse konfiguratsiooni. Kogu korpust ei imporditud; commit'i, push'i ega deploy'd ei tehtud.

Järgmise indeksi- ja ühendusploki käsitsi vastuvõtus tuleb avaldada väike nelja vorminguga partii eraldatud olemasolevasse keskkonda, kontrollida otsingust kanoonilise allikakohani ulatuvat rada ning avada viited autenditud vestluses ka pärast selle taastamist. Muudel vormingutel ei tohi tekkida PDF-lehti; vana versiooni viide peab jääma kontrollitavaks ja ligipääsu tühistamine peab peatama lugemise. Jätkatav mahutöötlus ja tegeliku mahu/kulu arvestus peavad valmima enne 5000 tekstiosa piiri muutmist ning tasulist korpusejooksu.
