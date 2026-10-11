# ADR-145: iga dokumendi lõik on seotud seadusesättega, mida ta nimetab

Kuupäev: 11.10.2026. Teostus Claude Opus 5.5. Omanik 11.10.2026: „kõik peavad saama meta failid ja graph peab looma seosed jms“. Seis: **mõõdetud, ehitatud, testitud; tasuta otsingukontroll serveris tehtud veel saatmata koodiga (44 küsimust: 0 kadunud, 0 nihkunud). Mudelit ei kutsutud ja midagi ei ostetud.**

## Probleem

Mudeli tehtud teadmiskaardid ja seosed ([ADR-054](adr-054-semantic-graph-pilot.md)) on olemas 7 dokumendil 9769-st; ülejäänute jaoks on see tasuline samm, mis ootab omaniku otsust. Kõigi dokumentide jaoks on vestlusel kolm mudelita seost:

- seaduse enda viited oma paragrahvidele ([ADR-057](adr-057-graph-experiment.md), [ADR-068](adr-068-own-reference-subsections.md));
- säte, mida küsimus ise nimetab ([ADR-135](adr-135-a-provision-the-question-names.md), [ADR-142](adr-142-a-regulation-provision-the-question-names.md));
- valitud lõigus nimetatud teise seaduse säte, **aga ainult siis, kui seaduse pealkiri seisab omastavas käändes vahetult paragrahvimärgi ees** ([ADR-064](adr-064-named-other-act.md): „sotsiaalhoolekande seaduse § 25 lõikes 2“).

Kolmas loeb hästi määrusi, sest määrus kirjutab seaduse nime välja. Juhend, uuring ja veebileht kirjutavad enamasti „SHS § 17 lg 2“ või „(TLS § 88)“. Sellist viidet ei loetud: säte jõudis vastuse tõenditesse ainult siis, kui otsing selle sarnasuse järgi ise leidis.

## Mõõtmine (tasuta, kohalik koopia korpusest v82)

9769 dokumenti, 91 158 lõiku, 38 seadust (igaühel 11.10.2026 täpselt üks kehtiv redaktsioon). Loetud samade reeglitega, millega otsing viiteid järgib; käsk `scripts/rag-v2-provision-relations.mjs`.

| Dokumendid | Dokumente | Lõike | Viiteid kogus olevale seadusele | Neist järgitavad | Lõike, kus on järgitav viide | neist seni lugemata | Dokumente, kus on järgitav viide |
|---|---:|---:|---:|---:|---:|---:|---:|
| Juhendid, uuringud, lehed, artiklid | 9175 | 64 695 | 2522 | 2233 | 1150 | **810** | 312 |
| Valla ja linna määrused | 512 | 9267 | 1323 | 1285 | 847 | 49 | 421 |
| Seadused (viide teisele seadusele) | 78 | 16 487 | 2029 | 1144 | 675 | 0 | 72 |
| Muud riiklikud aktid | 4 | 709 | 7 | 7 | 7 | 0 | 3 |
| Kokku | 9769 | 91 158 | 5881 | 4669 | 2679 | 859 | 808 |

- **Juhendites, uuringutes ja lehtedes luges senine reegel 340 lõiku 1150-st.** Ülejäänud 810 lõigus on seadus nimetatud muul kujul.
- **Kirjaviisid** (2233 järgitavat viidet neis dokumentides): Riigi Teataja lühend 1700 (76%), pealkiri omastavas 425 (19%), pealkiri nii nagu see on („Sotsiaalhoolekande seadus § 26“) 94, omastav kokku või lahku kirjutatult („sotsiaalhoolekandeseaduse“, „lastekaitse seaduse“) 14. Lühend seisab 41% juhtudest sulgudes: „(SHS § 3 lg 1 p 2)“.
- **Kus need on:** veebilehed 661 viidet 331 lõigus (116 lehte), uuringud 654 / 317 (55), ametlikud juhendid 467 / 241 (52), infomaterjalid 233 / 131 (16), ajakirjaartiklid ja muud failid 185 / 110 (60), ühingute lehed 18 / 14 (12), muud 15 / 6 (1). Kontaktidel, teenuseinfol, vormidel ja registrikirjetel (5934 dokumenti) paragrahvimärki ei ole.
- **Kuhu viidatakse:** sotsiaalhoolekande seadus 475, töölepingu seadus 306, lastekaitseseadus 220, perekonnaseadus 160, tsiviilkohtumenetluse seadustik 101, isikuandmete kaitse seadus 99.
- **Kas nimetatud paragrahv on kogus olemas:** 2485 üksikust paragrahviviitest 2329 (94%) nimetab üheselt paragrahvi, mis hoitavas seaduses on. 104 nimetab paragrahvi, mida seal ei ole (enamasti seadus, millest kogus on osa: karistusseadustikust 41 paragrahvi), 52 on mitmetähenduslikud (allikas võib olla ülaindeksi kaotanud: „§ 131“ võib olla § 13¹). Lisaks 37 paragrahvivahemikku.
- **Vana tekst, sama nimega teine seadus:** 96 viidet on tekstis, mis on vanem kui seadus, milleni nimi täna viiks. Näiteks 2014. aasta materjali „SHS § 22“ on 2015. aasta lõpuni kehtinud seaduse paragrahv; tänasel sotsiaalhoolekande seadusel on teine § 22. Sama kehtib ohvriabi seaduse (uus 2023) ja välismaalasele rahvusvahelise kaitse andmise seaduse (uus 2026) kohta.
- **Mida ei saa lugeda ilma arvamata** (4716 paragrahviloendist neis dokumentides 2289): 1420 loendi ees ei seisa ühtki akti („§ 17 lg 2“ üksi; 208 juhul nimetab sama lause üht seadust, 685 juhul ei nimeta lõik ühtegi), 822 nimetab akti, mida kogus ei ole või mida ei saa kindlaks teha (põhiseadus 63 + 55, Saksa õigus 83, pankrotiseadus 42, määrused 58), 46 viitab oma aktile või „samale seadusele“.
- **479 õigusabi artiklit** (juristaitab.ee; mõõtmise ajal ostu ootel, samal päeval korpuses v83; loetud lehe tekstist, mitte lõikudest): paragrahvimärk on 98 artiklis, järgitav viide 54 artiklis (130 viidet; 16 artiklis ainult lühendi või pealkirjaga). Enamik artikleid nimetab seadust ilma paragrahvita.

### Lävend

Enne ehitamist seatud: ehitada tasub, kui (1) uued kirjaviisid vähemalt kahekordistavad juhendi-, uuringu- ja lehelõikude arvu, kust nimetatud säte kätte saadakse, ja (2) vähemalt üheksa kümnest nimetatud paragrahvist on hoitavas seaduses üheselt olemas. Mõõdetud: **3,4 korda (340 → 1150 lõiku)** ja **94%**. Mõlemad täidetud.

## Otsus

**Seos on lõigust sätteni ja see loetakse lõigu enda sõnadest.** Seos on olemas, kui seaduse nimi seisab vahetult paragrahviloendi ees ühel neljast kujust:

1. pealkiri omastavas: „sotsiaalhoolekande seaduse § 25 lõikes 2“ (nagu seni);
2. sama kokku või lahku kirjutatult: „sotsiaalhoolekandeseaduse § 76 lõike 5“, „lastekaitse seaduse § 26“;
3. pealkiri nii nagu see on: „Sotsiaalhoolekande seadus § 26 lg 1“;
4. Riigi Teataja lühend ([ADR-129](adr-129-luna-names-the-provision.md) tabel), täpselt selle kirjapildis, üksi või käändelõpuga, ka sulgudes: „SHS § 17 lg 2“, „(TLS § 88)“, „SHS-i § 15 lõike 1“, „LasteKSi § 27“.

See kehtib iga dokumendi lõigu kohta: juhend, uuring, leht, artikkel, määrus, seadus.

### Midagi ei arvata

Välja jäetakse ja **loetakse kokku koos põhjusega** (pöörde mõõdikus `named_act_references.left_out`):

| Põhjus | Mis see on |
|---|---|
| `range` | paragrahvide vahemik („§-des 131–133“) |
| `section_not_in_act` | sellist paragrahvi hoitavas seaduses ei ole |
| `section_ambiguous` | number sobib seaduse kahele paragrahvile ja viitav tekst võib olla ülaindeksi kaotanud |
| `older_document` | viitav tekst on vanem kui seadus, milleni nimi viiks |
| `undated_document` | seaduse algus on teada, viitava teksti päev mitte |
| `over_limit` | kaks kohta olid juba täis |

Üldse ei loeta: paragrahv ilma akti nimeta selle ees; „sama seaduse“; lauses mujal nimetatud akt; lühend väikeste tähtedega („tms § 5“ ei ole täitemenetluse seadustik); akt, mida kogus ei ole; nimi, mille ees seisab „kehtinud“ („kuni 31.12.2015 kehtinud sotsiaalhoolekande seaduse § 22“: neli sellist loendit kogus, igaüks varasema seaduse oma).

**Teksti päev ja seaduse algus.** Seaduse nimi ja lühend elavad seadusest kauem. Seepärast võrreldakse kaht päeva:

- teksti päev: õigusaktil redaktsiooni kehtivuse algus; muul dokumendil avaldamise päev, ainult aasta korral selle aasta 1. jaanuar; lehel, millel avaldamise päeva ei ole, lugemise päev;
- seaduse algus: seaduse enda jõustumise päev (Riigi Teataja tekstist), selle puudumisel vastuvõtmise päev.

Tekst, mis on seaduse algusest vanem, ei nimeta selle seaduse paragrahvi. Seadust, mille algust ei ole teada, järgitakse nagu enne. See kaitse kehtib nüüd ka seni loetud omastava kuju kohta.

### Kus seos arvutatakse

**Otsingu ajal, valitud lõikude tekstist, nagu seaduse enda viited.** Indeksisse ei salvestata midagi.

- Seos on lõigu teksti, seaduste nimede tabeli ja seaduse paragrahvide loendi funktsioon. Salvestamata on see olemas igal dokumendil kohe, ka igal järgmisel täiendusel (samal päeval lisatud 479 artiklit said selle ilma ühegi lisasammuta), ilma ostu, indeksi ümberehituse ja kettaruumita.
- Viide viib selle redaktsioonini, mis pöörde päeval kehtib. Indeksisse kirjutatud seos osutaks ühele redaktsioonile ja vananeks iga seadusemuudatusega.
- Pöörde jaoks loevad ainult valitud lõikude viited.

Mida indeksisse salvestamine juurde annaks, on vastupidine suund: seadusesätte juurest juhendite ja selgitusteni, mis seda nimetavad (juhendites, uuringutes ja lehtedes nimetatakse umbes 660 eri sätet, neist umbes 50 kümme korda või rohkem). Seda ei ehitatud: selle kasu ei ole mõõdetud ja see nõuab indeksi kuju muutmist.

Kogu korpuse seoseid näitab käsk `scripts/rag-v2-provision-relations.mjs` (tasuta, loeb kohalikku hoidlat): pärast täiendust ütleb see, mitu uut dokumenti viitab seadusele, mis kujul ja mis jäi välja.

### Mitu lisandust pööre saab ja mis eelarvest

Sama mis seni ([ADR-064](adr-064-named-other-act.md)): **kuni kaks lõiku pöörde kohta, kahel omaette kohal (14. ja 15.), tekst akti viidete 3000 tokeni ruumis.** Küsimuses nimetatud säte võtab koha esimesena, siis valitud lõikude viited. **Seni loetud kuju (pealkiri omastavas) hoiab oma järjekorra ja uued kirjaviisid saavad ruumi, mis üle jääb:** pööre saab kõik, mis ta enne sai, ja võib-olla ühe või kaks lõiku juurde. Midagi ei tõrjuta välja. Profiili (`hybrid-estnltk-chat-v6`), plaani ega indeksit ei muudeta: muutub ainult see, milliseid kirjaviise loetakse.

Kaks kohta jäävad sageli kitsaks: juhendite, uuringute ja lehtede seosega lõikudest nimetab umbes 62% üht sätet, 21% kaht ja 17% kolme või enamat. Üle jäänud viited loetakse kokku (`over_limit`). Kohti ei lisatud, sest iga lisandus maksab vastuse mudelile konteksti ja selle kasu saab näidata ainult tasulise vastusekontrolliga.

### Kuidas vastus sätet näitab

Midagi uut ei olnud vaja. Lisatud lõik on seaduse lõik nagu iga teine: see kannab sätte silti („§ 25 lg 2“, [ADR-123](adr-123-provision-label-for-legal-passages.md)) ja selle allikakaardil on seaduse lühend. Vastus nimetab sätet [ADR-129](adr-129-luna-names-the-provision.md) reeglite järgi ja serveri sättekontroll loeb selle üle nagu iga teise.

## Teostus

- `lib/rag-v2/search/legal-references.js`: `namedActLists` loeb nimetatud teise akti loendid nime või lühendi järgi (lühend ainult kirjapildis, sõnana omaette); `namedActReferences` on sama ilma vahemiketa ja töötab küsimuse rajal nagu enne; `lawNames` (kokku ja lahku kirjutatud omastav) toodi siia vastuse kontrollist, et muster oleks ühes kohas; `sectionResolution` ütleb, miks number paragrahvi ei nimeta.
- `lib/rag-v2/search/provision-relations.js` (uus): reeglid, mida otsing ja korpuse loendus jagavad: seaduste nimed ulatuses (`followableNames`), teksti päev, seaduse algus, päevade võrdlus (`dayRefusal`).
- `lib/rag-v2/search/retrieval.js`: valitud lõikude viidete rada loeb kõiki nelja kuju, rakendab päevade võrdlust ja loeb välja jäetu põhjuste kaupa.
- `lib/rag-v2/pilot/provision-check.js`: võtab `lawNames` ühisest kohast; käitumine sama.
- `scripts/rag-v2-provision-relations.mjs` (uus): korpuse loendus.

## Mõõdetud pärast ehitamist

### Ühiktestid

- `tests/rag-v2-legal-references.test.mjs`: lühend üksi, sulgudes, lause algul, käändelõpuga, loendis; pealkiri nii nagu on; teine kirjapilt; kaheksa juhtu, kus lühendit lugeda ei tohi; „kehtinud“; vahemik antakse loendamiseks, aga viiteks ei ole.
- `tests/rag-v2-graph-experiment.test.mjs`: kuus kirjaviisi toovad lõigu, kus nimetatud lõige on, määruse ja juhendi lõigust, otsingukataloogiga ja ilma; neli juhtu, kus midagi lugeda ei tohi; iga väljajätmise põhjus loetakse; kaks kohta, kolmas viide loetakse üle jäänuks; omastav kuju hoiab oma järjekorra lühendi ees; profiil ilma nimetatud aktide kohtadeta ei loe.
- `tests/rag-v2-provision-relations.test.mjs`: nimed ja lühendid ulatuses (kaks sama pealkirjaga dokumenti ei nimeta kumbagi), teksti päeva järjekord, seaduse algus, korpuse loendus väikesel näitel.
- Kolm reeglit tehti ükshaaval katki (omastav ei hoia järjekorda; otsing ei võrdle päevi; lühendeid ei loeta): iga kord kukkus õige test.

### Tasuta otsingukontroll serveris ([ADR-122](adr-122-free-search-gate.md))

Serveris, muudetud kood kattekausta kaudu; kattekaust erines töötavast väljalaskest täpselt nelja faili võrra (kolm muudetud, üks uus). Töö ajal läks serveris käiku korpus v83 (479 õigusabi artiklit; 10 248 dokumenti, indeks `5288f882`), seepärast on mõlemad jooksud tehtud v83 peal. 44 küsimust (33 kindlat kontrollküsimust ja 11 määruse küsimust), otsing ilma valiku mudelita, nii et tõendid on otsingu enda järjekorras.

- **Otsingukontroll:** 31 sama, 13 muutunud, **0 otsustavat lõiku kadunud, 0 nihkunud tahapoole**, 0 viga. Kõik 13 muutust on ühte liiki: tõenditesse tuli üks või kaks lõiku juurde ja ükski ei lahkunud; kandidaadid ja nende järjekord ei muutunud.
- **Tõendite vaatlus samadel küsimustel:**

| | Töötav väljalase | Muudetud kood |
|---|---:|---:|
| Küsimusi, kus lisati nimetatud seaduse säte | 23 | 32 |
| Selliseid lõike kokku | 34 | 51 |
| Küsimusi, kus otsustav lõik on tõendites | 25 | 26 |
| Varem lisatud lõike, mis kadusid | | 0 |

- Juurde tulnud 17 lõiku: sotsiaalhoolekande seadus 10, sotsiaalseadustiku üldosa seadus 5, perekonnaseadus 1, haldusmenetluse seadus 1.
- Juurde tulnud otsustav lõik: Põlva tugiisiku küsimus, kus sotsiaalhoolekande seaduse § 25 jõudis tõenditesse valitud lõigu viite kaudu.
- Hind: kontekst kasvas keskmiselt 235 tokenit küsimuse kohta (13 muutunud küsimuses keskmiselt 794, suurim 1234). Viidete lugemise samm: mediaan 58 → 119 ms, suurim 477 ms.
- **Esimene katse näitas, miks järjekord loeb.** Kui viiteid loeti ainult lõikude järjekorras, tõrjus ühes küsimuses uus viide välja varem lisatud sätte (puuetega inimeste sotsiaaltoetuste seaduse § 2). Sellest tuli reegel, et seni loetud kuju hoiab oma järjekorra; kordusjooksus ei kadunud ühtegi.
- Kogu ühiktestide komplekti arv on saadetise kirjelduses.

Mõõtevahend ja jooksud serveris: `/home/ubuntu/rag-v2-work/w6/` (`rel-diag.mjs`: tasuta vaatlus, mis loeb iga küsimuse tõenditest nimetatud akti lisandused ja otsustava lõigu; `gate-base83.json`, `gate-ov2.json`, `gate-report83b.json`, `diag-base.json`, `diag-ov2.json`).

## Piirid

- **Vastuseid ei ole mõõdetud.** Tasuta kontroll näitab, et säte jõuab tõenditesse ja midagi ei kao. Kas vastus läheb paremaks, näitab ainult tasuline vastusekontroll, mida ei tehtud.
- Viidet loetakse ainult valitud lõikudest. Seadusesätte juurest seda nimetavate juhenditeni seos ei vii.
- Kehtivas tekstis vananenud viidet ei saa eristada, kui sama numbriga paragrahv on ka tänases seaduses (määrus või leht, mida pärast seadusemuudatust ei uuendatud).
- Lehe päev on selle lugemise päev: vana, aga veel üleval olev leht loetakse tänase seaduse kohta käivaks.
- Varasema seaduse ametlikku nime („Eesti Vabariigi töölepingu seadus“) eraldi ei tunta; kogus sellist viidet ei ole ja vanema teksti peatab päevade võrdlus.
- 1420 loendit ilma akti nimeta jäävad lugemata. Osa neist saaks lugeda reegliga „sama lause nimetab üht seadust“ (208), aga see on järeldus, mitte lugemine.
- Seadus, millest kogus on osa (karistusseadustik), ei anna viidatud paragrahvi: 849 viidet kogus viivad paragrahvini, mida ei hoita.

## Tagasivõtmine

Muudatuse tagasipööramine taastab senise lugemise. Indeksit, plaani, profiili ega andmeid ei muudetud.
