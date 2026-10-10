# ADR-123: seadusesätte silt õiguslõigu juures — ehitatud, mõõdetud, kasutusele ei võetud

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5 (ehitas agent, üle vaatas teine agent, mõõtmised ja otsus minult). Omanik 09.10.2026 õhtul: kuue tunni töö RAG-i valmisoleku nimel, luba testimiseks raha kulutada. Seis: **serveris ei ole; kood on valmis ja testitud, kuid mõõtmine ei näidanud kasu.**

## Probleem, nagu see kaardistuses paistis

Riigi Teataja akti paragrahv, mis on lõigatud mitmeks lõiguks, kannab numbrit „§ N“ ainult oma esimeses lõigus. Pealkirjatee nimetab paragrahvi, kuid seda loevad ainult otsing ja valik; vastuse mudeli sisendis on lõigu tekst ja asukohatee (`…/paragrahv[3]`), millest paragrahvi number ei selgu. Kui teine lõik viitab „käesoleva seaduse § 133 lõikes 5 nimetatud kuludele“ ([ADR-068](adr-068-own-reference-subsections.md) toob sihtlõigu meelega kaasa), peab mudel arvama, milline lõik see on.

Mõõdetud 32 pöördel: õiguslõikudest, mis vastuse mudelini jõudsid, **ei olnud 157-st 89-l (57%) oma paragrahvi numbrit tekstis**; viidatud lõikudest 59-st 32-l. Eeldus peab seega paika.

## Mis ehitati

- `legalPlace(bundle, chunk)` (`lib/rag-v2/search/legal-place.js`): lõigu koht aktis, loetud ainult allikast, ilma mudelita ja iga päringu jaoks sama. Paragrahv pealkirjateest (sama lugemine kui ristviidetel), lõiked paragrahvi enda tekstist (sama lugemine kui redaktsioonide võrdlusel). `provisionLabel` teeb sellest sildi: „§ 133“, „§ 133 lg 5“, „§ 133 lg 5–7“. Punkte ei nimetata.
- Mudeli sisendi kuju `model-context-json-5`: õiguslõigu juures väli `provision` enne teksti. Oma piir 300 tokenit üle kogu sisendi, väljaspool kõiki eelarveid ja valikuid, nagu akti kuupäevad ([ADR-062](adr-062-provision-dates.md)): tõendid valitakse täpselt nagu ilma sildita.
- Testid: koha lugemine (üks lõik, lõigete vahemik, ülaindeksiga number, lõike ja punkti kaupa loetud allikad, preambul, PDF), sisendi kuju, piir, eelarve ja salvestatud pöörde kuju.

## Mõõtmine

1. **Otsing ei muutu (tasuta, [ADR-122](adr-122-free-search-gate.md)):** 33 kontrollküsimust sildi koodiga lähteseisu vastu: 33/33 sama.
2. **Vastused, sildiga ja sildita (tasuline, 0,1316 USD):** 8 sotsiaalhoolekande seaduse küsimust pöörduja rollis (seitse toimetulekutoetusest, üks erihoolekandest), igaüht kaks korda mõlema koodiga, kokku 32 pööret, vigu 0.

| | Sildiga | Sildita |
|---|---:|---:|
| Pöördeid | 16 | 16 |
| Õiguslõike sisendis | 85 | 72 |
| Neist sildiga | 85 | 0 |
| Vastuseid, mis nimetavad paragrahvi („§“) | **0** | **0** |
| Vastuse liik: täielik / osaline | 7 / 9 | 8 / 8 |
| Hind | 0,0711 USD | 0,0605 USD |

Õiguslõikude arvu ja hinna vahe tuleb otsinguplaanist, mitte sildist: plaani kirjutab mudel ja selle päringud erinesid peaaegu igal jooksul (32 pöördel 30 erinevat päringukomplekti); silt arvutatakse alles pärast otsingut ega jõua plaani ega valikuni.

3. **Kas Luna üldse nimetab paragrahve (tasuta loendus):** testkonto 14 päeva salvestatud pööretest oli vastus 234-l, neist 153-l õiguslõikudega. **Paragrahvi nimetas üks vastus.** See on kooskõlas vastuse stiiliga: Luna räägib oma häälega ja allikad on viidete all.

## Otsus

**Silti serverisse ei saadeta.** Viga, mida see pidi parandama (vastus nimetab vale või tõendamata sätet), vastustes ei esine, sest vastused sätteid ei nimeta. Teine võimalik kasu (mudel saab viite sihtlõigust paremini aru) jäi mõõtmata: 32 pöördel ei erinenud vastuste liik ega viidete arv rohkem, kui need erinevad sama koodi kahe jooksu vahel. Muudatus, mille kasu ei ole näha, ei ole väärt uut sisendi kuju ja kuni 300 lisatokenit pöörde kohta.

Kood ei ole repos. See on hoiul omaniku arvutis põhikausta `tmp/adr-123-provision-label/` all (muudetud failide vahe, `legal-place.js` ja selle testid), alus `20e68d52`.

## Millal uuesti vaadata

- Kui vastuse stiil muutub nii, et spetsialistile nimetatakse sätteid (siis on vale sätte oht päris ja silt selle vastu otsene abi).
- Kui allikate paneel peaks näitama, milline säte lõik on: `legalPlace` annab selle ilma mudelita.
- Kui kullaga küsimustik näitab, et mudel ajab viite sihtlõigu segi. Selleks on vaja küsimusi, kus vastuse õigsus sõltub just viidatud lõikest, ja vastuste lugemist; ühe mudelijooksu põhjal seda otsustada ei saa.

## Kontrollitud ja kontrollimata

- Kontrollitud: ühiktestid koos öö teiste muudatustega (1337, neist 1315 läbi, 22 vahele jäetud); otsingukontroll 33/33; 32 päris pööret; salvestatud vastuste loendus.
- Kontrollimata: spetsialisti rolli vastused sildiga; küsimused, kus viite sihtlõik otsustab vastuse.
