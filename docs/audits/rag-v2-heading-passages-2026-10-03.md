# Ainult pealkirjast koosnevad lõigud otsingus — mõõtmine 03.10.2026

Teostus Claude Opus 5.5. Omanik 03.10: „tegutse“ ettepanekule mõõta M3 viimane kandidaat tasuta. Taust: [ADR-065](../rag-v2/adr-065-pool-limit-per-document.md) märkis, et pikad juhendid jagunevad lühikesteks tükkideks (pealkiri, sõna „JUHEND“), mis tulevad liidetud järjestuses kõrgele; dokumendi piir (kuni kümme lõiku) vähendas nende kohti, aga ei eemaldanud neid.

**Otsus (omanik 03.10.2026): pealkirjafiltrit praegu ei ehitata.**

Soovitus, millele otsus toetus: parandust praegu mitte ehitada.

- **Vaadeldud pööretes neid lõike tõendites ei olnud.** 93 salvestatud hindamispöörde tõendites ei olnud ühtegi sellist lõiku (0 lõiku 498-st). **Üldine mõju vastustele ei ole sellega tõendatud:** need on hindaja kataloogiküsimused, mitte kasutajate küsimused, ja mõõtmata on, kas kandidaadikohtade kaotus teeb mõne vastuse halvemaks.
- **Mõõdetud küsimustes otsustava sätte koht ei muutunud.** 33 küsimuses, kus otsustav lõik on teada, on see nende lõikudega ja ilma täpselt samal kohal.
- **Kulu on kandidaadikohad.** 49 küsimusest üheksas võtab selline lõik eelvaliku 30 kohast vähemalt ühe, halvimal juhul seitse.

Mõõtmine oli tasuta ja ainult luges: serveris, korpus v47 (indeks `34fe1590`, 40 489 lõiku), ilma mudelikutseta ja ilma embedding'u päringuta. Skript: [rag-v2-heading-passages-2026-10-03-probes.mjs](rag-v2-heading-passages-2026-10-03-probes.mjs); tulemused: [evidence/heading-passages-2026-10-03/](evidence/heading-passages-2026-10-03/).

## 1. Kust need lõigud tulevad

- Tükeldus teeb igast jaotisest vähemalt ühe lõigu (`lib/rag-v2/chunking.js`). Jaotis, millel on pealkiri, aga oma teksti ei ole, saab lõiguks, mille tekst on ainult see pealkiri. Nii juhtub kaanelehe ridadega, peatüki pealkirjaga vahetult alapealkirja kohal ning PDF-is pealkirjaks loetud leheküljenumbri või joonise sildiga.
- Otsing näeb lõiku kujul „dokumendi pealkiri > jaotise tee“ ja selle all sisu. Kui sisu on üks sõna, on kogu otsitav tekst sisuliselt dokumendi pealkiri, ja see on dokumendi teemat puudutavale küsimusele vektorotsingus väga lähedal.
- Pealkiri ise ei läheks sellise lõigu väljajätmisel kaduma: alajaotiste lõigud kannavad seda oma pealkirjatees.

Mõõtmises on „ainult pealkirjast koosnev lõik“ lõik, mille sisu kordab oma pealkirjatee lõppu (suurtähti ja tühikuid arvestamata).

## 2. Loendus

| Allika liik | Dokumente | Lõike | Ainult pealkiri | Osa lõikudest | Dokumente, kus neid on |
|---|---:|---:|---:|---:|---:|
| Juhendid ja uuringud | 171 | 12 638 | 490 | 3,9% | 73 |
| Ajakirja artiklid | 892 | 8 224 | 12 | 0,1% | 11 |
| Riiklikud õigusaktid | 23 | 5 193 | 9 | 0,2% | 8 |
| Valdade ja linnade määrused | 510 | 9 179 | 0 | 0 | 0 |
| Kataloogikirjed (teenused, toetused, vormid, kontaktid) | 4 874 | 5 255 | 0 | 0 | 0 |
| **Kokku** | 6 470 | 40 489 | **511** | **1,3%** | **92** |

- **Peaaegu kõik on juhendites.** 511 lõigust 490 on juhendites ja uuringutes; neid on 73 dokumendis 171-st.
- **Need on koondunud vähestesse dokumentidesse.** Viies dokumendis on neid 20 või rohkem, 11-s kümme või rohkem:
  - „Võin olla puudega – laste piltsõnastik puuetest“: 80 lõiku 214-st;
  - „Harjutuste kogu“: 63 lõiku 353-st;
  - „Inimkaubanduse ennetamine: metodoloogia tööks noortega“: 41 lõiku 348-st;
  - „Mul on õigus 2025“: 31 lõiku 38-st;
  - „Seksuaalsest ahistamisest vaba ööelu juhend“: 23 lõiku 50-st.
- **Mis neis on.** Leheküljenumbrid („3“, „21“, „37“), „Märkmed“, „Eessõna“, „Viidatud allikad“, „1. etapp“, joonise sildid („46%“, „83%“). Riiklikes aktides on need lõigud, kus on ainult paragrahvi number („§ 115.“).
- **Need on väga lühikesed.** 288 on alla 20 tähemärgi, 508 alla 100. Kokku 20 515 tokenit.

### Muud lühikesed lõigud

Peale nende on indeksis 1856 alla 100 tähemärgi pikkust lõiku, mis ei ole ainult pealkiri. Need on eri asjad:

| Allika liik | Lõike | Mis need on |
|---|---:|---|
| Kataloogikirjed | 534 | kirje väljad; teine otsinguharu, tahtlikult lühikesed |
| Valdade ja linnade määrused | 533 | lühikesed sätted: „Määrus kehtestatakse … alusel“, „Määrus jõustub 01.01.2024“ |
| Juhendid ja uuringud | 307 | fotoviited, kaanelehe read, töölehtede read |
| Ajakirja artiklid | 274 | autori nimi ja amet, märksõnade rida, „Foto: …“ |
| Riiklikud õigusaktid | 208 | lühikesed sätted, kehtetuks tunnistatud paragrahvid |

Pikkus üksi ei erista sisutut lõiku sisukast: lühike säte on sisu, autori rida ei ole.

## 3. Otsingukatse: 49 küsimust

- **Seade.** Tootmisprofiil v6: liidetud sõnaline ja vektorotsing, kuni kümme lõiku dokumendist, riikliku õiguse varukohad. Eelvaliku mudelit ei kutsutud; otsing salvestas kandidaadid, mida mudel loeks.
- **Küsimused.** 30 rasket küsimust (kataloogid 1–3), kolm valdade küsimust ja 16 igapäevast küsimust (`scenarios-corpus-4.json` esimesed pöörded). Kõigi päringute vektorid olid varasematest katsetest salvestatud.
- **Kaks haru.** Praegune otsing ja sama otsing, kus ainult pealkirjast koosnevad lõigud on mõlemast kanalist väljas.

### Kui palju neid kandidaatide seas on

| Küsimused | Küsimusi | Küsimusi, kus selline lõik on 30 kandidaadi seas | Kohti kokku |
|---|---:|---:|---:|
| Rasked (kataloogid 1–3) | 30 | 4 | 6 |
| Valdade lühendiküsimused | 3 | 0 | 0 |
| Igapäevased | 16 | 5 | 19 |
| **Kokku** | 49 | **9** | **25** (1470 kohast 1,7%) |

- **Enamasti ei ole ühtegi.** 40 küsimuses 49-st ei ole kandidaatide seas ühtegi sellist lõiku. Keskmine on 0,5 kohta 30-st.
- **Üksikutes küsimustes on palju.** Tulekahju küsimuses (`fire-harku`) seitse, kõik dokumendist „Päästeameti meelespea kohalikule omavalitsusele“: „16662“, „WWW.RESCUE.EE FACEBOOK.COM/PAASTEAMET/“, „TULEOHUTUSE MEELESPEA“, „1220“. Öömaja küsimuses (`shelter-tonight`) kuus.
- **Mõnes on need päris ees.** Kolmes küsimuses on selline lõik kohal 1 või 2:
  - treeneri küsimus: „Abivajavast lapsest teatamine ja andmekaitse“ (koht 1) ja „JUHEND“ (koht 2);
  - raha küsimus Harkus: „Harjutuste kogu“ lõik kohal 1;
  - kuuldeaparaadi küsimus: piltsõnastiku „K Kuuldeaparaat“ kohal 2.
- **Need toob vektorotsing.** 25 kohast 23 leidis ainult vektorkanal, kaks mõlemad kanalid, sõnaline üksi mitte ühtegi.
- **Muud lühikesed lõigud** (alla 100 tähemärgi) võtavad 54 kohta 30 küsimuses, samuti vektorkanali kaudu (52 kohta 54-st). 30 on ajakirja autori- ja märksõnaread, 20 juhendite fotoviited ja kaaneread, neli lühikesed sätted.
- **Mõlemad koos:** 33 küsimuses 49-st on vähemalt üks, keskmiselt 1,6 kohta 30-st, kõige rohkem kümme.

### Mida väljajätmine muudab

| | Praegu | Ilma nende lõikudeta |
|---|---:|---:|
| Otsustav lõik kandidaatide seas (33 küsimust) | 29 | 29 |
| Otsustav lõik 30 liidetud kandidaadi seas | 26 | 26 |
| Otsustava lõigu keskmine koht | 8,07 | 8,07 |
| Otsustav lõik mudelita lõppvalikus | 30 | 30 |
| Ainult pealkirjast koosnevaid lõike mudelita lõppvalikus | 10 (viies küsimuses) | 0 |
| Keskmine kontekst, tokenit | 8416 | 8412 |

- **Ükski küsimus ei võida ega kaota otsustavat lõiku.**
- Kandidaadid muutuvad 12 küsimuses: vabanenud kohtadele tuleb kokku 36 järgmist lõiku, neist 13 tulekahju küsimuses.
- Mudelita lõppvalik muutub kaheksas küsimuses.

## 4. Päris vestlus: 93 salvestatud pööret

Otsingukatse ei ütle, mida eelvaliku mudel nende kandidaatidega teeb. Seda näitavad vestluse hindaja varem tehtud pöörded; uuesti ei käivitatud midagi.

- **Mis loeti.** 19 hindamisjooksu alates korpuse v47 kasutuselevõtust (01.10 õhtu kuni 02.10; profiilid v4–v6). Raportites on 97 pööret, neist 93 tõenditega. Loeti ainult hindaja enda raportites nimetatud pöördeid ja ainult siis, kui vestluse on teinud hindaja.
- **Kõigis 93 pöördes valis lõigud eelvaliku mudel.**
- **Tõendites oli 498 teadmuslõiku. Ainult pealkirjast koosnevaid nende seas: 0. Muid alla 100 tähemärgi lõike: 0.** Ühelegi sellisele lõigule ei viidatud.

Järeldus piirdub vaadelduga: nendes 93 pöördes jättis eelvaliku mudel sellised lõigud välja ja vastuse mudel neid ei näinud. See ei tõenda, et nii on iga küsimusega, ega seda, et need lõigud vastuseid ei mõjuta:

- pöörded on hindaja kataloogide küsimused, mitte kasutajate küsimused;
- 93 pöörde seas ei ole teada, mitmes oli selline lõik üldse kandidaatide seas (salvestatud pööre hoiab kandidaatide pealkirju, mitte lõike);
- mõõtmata on, kas kandidaadikohta võttev sisutu lõik tõrjub välja lõigu, mis oleks vastust parandanud.

Lisaks on olukord, kus eelvaliku mudel ei vasta ja otsing jääb liidetud järjestuse peale. Siis kehtib mudelita valik, kus viies küsimuses 49-st oleks üheksa lähtelõigu seas üks kuni kolm sellist lõiku. 93 pöörde seas seda olukorda ei olnud.

## 5. Mida parandus nõuaks

- **Eelvaliku reegel otsingus (uus profiil).** Kandidaatide võtmisel jäetakse vahele lõik, mille tekst kordab ainult oma pealkirjateed, nagu dokumendi piir jätab vahele üheteistkümnenda lõigu. Uut indeksit ei ole vaja. Vaja on muudatust otsingu tuumas, uut vestlusplaani ja tasulist kontrolli enne ühendamist (hinnanguliselt umbes 0,06 USD plaani hindade järgi, nagu ADR-065 sama liiki kontroll). Katab mõõdetud 25 kohta.
- **Lõigu roll indeksis.** Samamoodi, nagu dokumendi silt on juba tõenditest väljas (`structural-role.js`). Roll on osa salvestatud kataloogist, mida otsing iga kord allika vastu kontrollib, seega nõuab see koodi lugemise järgi uut kataloogi versiooni ja uut indeksi põlvkonda. Seda rada ei proovitud.
- **Tükelduse muutmine.** Pealkirjaga jaotis liidetakse järgmisega. Nõuab dokumentide uuesti töötlemist ja muudab nende lõikude tunnused. Seda rada ei proovitud.

Autoriread ja fotoviited ei ole pealkirjad, nii et kaks esimest varianti neid ei kata. Pikkuse järgi neid välja jätta ei saa, sest sama lühike on ka säte „Määrus jõustub 01.01.2024“.

## 6. Soovitus

**Praegu mitte ehitada.** Omanik otsustas 03.10 samamoodi.

- Mõju vastustele ei ole tõendatud kummaski suunas. Vaadeldud 93 hindamispöörde tõendites neid lõike ei olnud (0 lõiku 498-st) ja 33 küsimuses on otsustav lõik samal kohal; kas vabanenud kandidaadikohad teeksid mõne vastuse paremaks, on mõõtmata.
- Mõõdetud kulu on kandidaadikohad: keskmiselt 0,5 kohta 30-st, halvimal juhul seitse.
- Odavaim parandus (eelvaliku reegel) vabastaks need kohad, aga ühtegi küsimust, kus see tulemust muudaks, ei leitud.

**Mis soovitust muudaks:**

- päris küsimus, kus vajalik lõik jääb napilt 30 kandidaadi taha ja sisutud lõigud on nende seas;
- eelvaliku mudeli sage vastamata jäämine, sest siis jõuaksid need lõigud vastuse mudelini.

**Kui otsinguprofiili muudetakse muul põhjusel**, tasub eelvaliku reegel samasse muudatusse kaasa võtta: siis ei lisandu eraldi plaani ega eraldi kontrolli kulu.

Sellega on 02.10 nimetatud kolm M3 kandidaati läbi mõõdetud: oma seaduse lõike viited on tehtud ([ADR-068](../rag-v2/adr-068-own-reference-subsections.md)), lühendiviidete reeglit ei ehitatud ([mõõtmine](rag-v2-abbreviation-references-2026-10-02.md)) ja siinne on kolmas.

## Piirid

- Otsingukatse on mudelita ja kasutab kataloogi päringuid; päris vestluses kirjutab otsinguplaan oma päringud.
- 16 igapäevasel küsimusel ei ole otsustavat lõiku määratud. Nende puhul on mõõdetud ainult kandidaatide koosseis, mitte see, kas vabanenud kohtadele tulev lõik oleks kasulik.
- 93 päris pööret on hindaja pöörded kataloogide küsimustega, mitte kasutajate küsimused, ja need on tehtud kolme eri profiiliga (v4–v6).
- Tunnus „sisu kordab pealkirjatee lõppu“ võib jätta vahele pealkirja, mille read on lõigus ja pealkirjatees eri moodi kokku pandud. Muude lühikeste lõikude piir (100 tähemärki) on valitud, mitte mõõdetud.
- Katses jäeti lõigud välja mõlemast otsingukanalist; eelvaliku reegel jätaks need välja alles kandidaatide võtmisel. Tulemus on lähedane, mitte sama.

## Tõendid

- [census.json](evidence/heading-passages-2026-10-03/census.json): loendus allika liigi ja dokumendi järgi, sagedasemad tekstid.
- [search.json](evidence/heading-passages-2026-10-03/search.json): 49 küsimust, mõlemad harud, iga sellise kandidaadi koht, tekst ja kanal.
- [turns.json](evidence/heading-passages-2026-10-03/turns.json): 93 salvestatud pöörde arvud.
- Kulu: 0. Mudelikutseid ega embedding'u päringuid ei tehtud; serveris midagi ei muudetud.
