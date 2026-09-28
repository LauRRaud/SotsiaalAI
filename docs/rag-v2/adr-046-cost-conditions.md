# ADR-046 — Kulu mõjutav tingimus otsingus, valikus ja vastuses

28.09.2026. Teostus Claude Opus 5.5. Codexi palve: käsitle piirhinna puudumist sisulise veana, lisa sihttest, kontrolli, miks tõendis olev kasutaja kulu mõjutav tingimus vastusest kadus, ja paranda üldiselt, mitte ainult kuuldeaparaadi jaoks.

## Mis juhtus

Küsimusele „Ema kuulmine halveneb ja pensionist ei jätku kuuldeaparaadi ostmiseks. Kust alustada?“ ei maininud ükski vastus piirhinda. Kaotuse koht oli käivitustel erinev:

- **Jooks 2:** tõendis oli teatmiku lõik „Piirhinna suurendamiseks … kui abivahendi hind on suurem loetelus märgitud piirhinnast“, aga vastus jättis selle välja.
  - v9 täielikkuse reegel nõudis numbri juurde alust ja lage ainult numbri enda tsiteeritud lõikudest.
- **Jooks 3:** tõendis polnud piirhinda üldse.
- **Sihtkataloogi baas** (vana kood, 2 korda): kuuldeaparaat 0/2, ratastool 1/2. Lapse prillid, toimetulekutoetus ja hooldekodu läbisid.
- **Põhjuste ahel:**
  1. **Otsinguplaan** tegi päringuid „soodustus“ ja „omaosalus“ kohta, aga mitte selle kohta, kuidas summa kujuneb. Seepärast ei jõudnud kandidaatide hulka lõigud, mis reegli otse sõnastavad:
     - artikkel „Abivahendite teenus muutub paindlikumaks …“: „Kui abivahendi hind ületab piirhinda, … inimene maksab lisaks omaosalusele … piirhinna ja abivahendi maksumuse vahe“;
     - SHS-i piirhindade säte.
  2. **Rerank'il** polnud reeglit hoida lõike, mis summa kujunemise määravad.
  3. **Vastus** ei viinud teisest lõigust pärit tingimust numbri juurde (vt eespool).
- **Allikalünk:** määruse seadmete tabel koos iga abivahendi piirhinna ja piirmääraga on lisa, mida XML-tekst ei sisalda. Seega pole kuuldeaparaadi enda piirhinda korpuses.

## Otsus

Kolm üldist reeglit, mis kehtivad iga toetuse ja teenuse kohta:

- **Otsinguplaan** (`search-assist.js`): kui küsitakse, mis midagi maksab, mida inimene maksab või saab, või kui inimene ei jõua maksta, teeb plaan ühe päringu selle kohta, kuidas summa ametlike terminitega kujuneb: alus, hinna- või summalagi, omaosalus ja erandid.
- **Rerank:** sama küsimuse korral hoitakse lõike, mis summa kujunemise määravad: alus, lagi, omaosalus ja erandid.
- **Vastus** (dialoogi prompt `m4-grounded-dialogue-12`): numbri, osa või määra juurde pannakse samasse plokki see, millest see arvutatakse, lagi (näiteks piirhind), inimese enda makstav osa, periood, otsustaja ja erandid, kui mõni tõendi lõik neid ütleb.
  - Iga tingimus viidatakse lõigule, mis selle ütleb.
  - Kulu või saadavat summat muutvat tingimust ei jäeta välja, kui mõni tõendi lõik seda ütleb.
  - v9 reegel piirdus numbri enda tsiteeritud lõikudega.

Mudelikutseid ei lisandu. `search-assist-2` jääb, sest väljundi kuju ei muutu. Uue prompti versiooni võtab väljalaske plaaniuuendus (ADR-037) ise üle.

## Kontroll

- **Sihtkataloog** [`scenarios-cost-conditions-1.json`](../../tests/evaluation/dialogue/scenarios-cost-conditions-1.json) on kirjutatud enne käivitusi. Selles on viis erineva toetuse või teenuse kulutingimust: kuuldeaparaat, ratastool, lapse prillid, toimetulekutoetus ja hooldekodu. Tulemused on allpool.
- **Ühiktestid:**
  - `tests/rag-v2-answer-prompt.test.mjs`: v12 fraasid, v11 jääb loetavaks;
  - `tests/rag-v2-search-assist.test.mjs`: rerank'i reegel.
- **Mõõtmised** tehti enne PR-i eraldi terviklikus koopias (`eval-full`) aktiveerimata plaaniga. Koopial on oma `node_modules` ja kood, seega omaniku samaaegsed väljalasked seda ei häiri.

## Tulemus

Sihtkataloog, 5 pööret käivituse kohta, kuuldeaparaat (KA) ja ratastool (RT):

| Kood | Käivitused | KA | RT | Prillid, toimetulekutoetus, hooldekodu |
|---|---|---:|---:|---|
| enne (tootmine, dialogue-11) | 3/5, 4/5 | 0/2 | 1/2 | kõik läbisid |
| vastuse- ja rerank'i reegel | 3/5, 4/5 | 0/2 | 1/2 | kõik läbisid |
| kõik kolm reeglit | 4/5, 4/5, 3/5 | 0/3 | 2/3 | kõik läbisid |

- **Otsingu mõju on tõendatud.**
  - Plaaniga reegli järel tegi otsinguplaan kõigil neljal kuuldeaparaadi käivitusel päringu, kus on „omaosalus“ ja „piirhind“. Enne ei teinud ühelgi kolmest.
  - Tõendisse jõudsid SHS-i piirhinna säte („piirhinna arvutamisel lähtutakse … müügihinnast; … üks kolmandik … oleksid piirhinnast kallimad“) või määruse piirhinna tõstmise reegel.
- **Vastuse mõju pole tõendatud.**
  - Vastus annab esimese sammu, 30 dB tingimuse, osaluse „loetelus määratud määra järgi“, SKA erandi ja isegi keelu osta enne soodustuse vormistamist.
  - Osalust piirhinnaga ei seo aga ükski vastus, ka siis mitte, kui SHS-i piirhinna säte on tõendis.
  - Kuuldeaparaat läbis 0/7 korral kõigis mõõtmistes.
- **Terve kataloog v4 uue koodiga: 38/40**, sama mis jooksul 4. Järele jäid kontaktisik ja kuuldeaparaadi piirhind. Regressiooni ei olnud.
  - v3 luges ühe ausa 31.10 vastuse valeks: kahtluse ja päeva vahel oli 85 märki, v3 lubas 80. v4 laiendab akent, v3 jääb nagu jooksutatud.
- **Kulu:** umbes 0,5 USD. Ühe käivituse katkestas omaniku UI väljalase. Kaks käivitust ühendatud testikoopias katkesid väljalasete tõttu, seepärast tehti terviklik koopia.

## Piirid ja järgmine samm

- **Sihtjuhtum ei ole parandatud.** Reeglid jäävad, sest need on üldised ja otsingu mõju on mõõdetud. Vastusereegel eemaldab run 2-s leitud piirangu („ainult numbri tsiteeritud lõigud“), aga selle mõju ei ole tõendatud.
- **Korpuses pole praegu kehtivat ametlikku lauset,** et riigi osa arvutatakse piirhinnast ja piirhinnast kallima aparaadi korral maksab inimene vahe ise. Sõnaselgelt ütleb seda vaid ajakirja artikkel, mida rerank eelistab uuemate ametlike lõikude ees vähem. Seadmete tabel on määruse lisa, mida korpuses pole.
- **Omaniku või Codexi otsuseks on kaks varianti:**
  1. **Allikas:** lisada määruse lisa (abivahendite loetelu piirhinna ja piirmääraga) või SKA ametlik selgitus piirhinna kohta. Uued dokumendid ootavad Codexi kava järgi.
  2. **Vastuse kontroll ilma teise mudelikutseta:** kui tõend nimetab piirhinda ja vastus annab osaluse ilma selleta, märgib hindaja selle ja vastus saab piirangulause. See vajab eraldi kavandamist, sest lisatav tekst peab tulema tõendist.
