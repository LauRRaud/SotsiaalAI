# SotsiaalAI Tööheaolu moodul: 10 funktsiooni ja arendusloogika

**Dokumendi eesmärk:** kirjeldada SotsiaalAI spetsialisti vaates arendatava Tööheaolu mooduli 10 lukustatud põhifunktsiooni, nende eesmärki, sisuelemente, töövooge, väljundeid, andmestiku nõudeid, privaatsusloogikat ja edasist ehitusloogikat.

**Põhimõte:** Tööheaolu ei ole meeleoluäpp, eneseabivorm ega töötaja hindamise tööriist. See on professionaalne töötoe, töökoormuse, tööprotsesside ja töökorralduse otsustustugi sotsiaalvaldkonna spetsialistile.

---

## 1. Üldine tootepõhimõte

Tööheaolu mooduli iga funktsioon peab töötama loogikaga:

```text
sisend → struktureerimine → signaal/muster → praktiline väljund → kasutaja kontroll → vajadusel suunamine olemasolevasse SotsiaalAI moodulisse
```

Iga funktsioon peab andma kasutajale praktilise tööalase väljundi, näiteks:

- töökoormuse signaal;
- nädala või kuu kokkuvõte;
- juhiga jagatav memo;
- 24h järelplaan;
- 24–72h taastumisplaan;
- tööpiiride kokkuleppe mustand;
- fookusaja kokkulepe;
- tööprotsessi audit;
- rolliselgitus;
- kovisiooni sisend;
- 100 päeva töötoe plaan.

Tööheaolu moodul **ei tohi dubleerida** SotsiaalAI olemasolevaid põhifunktsioone:

- kovisioon;
- dokumentide koostamine;
- vestlusruumid;
- dokumendid;
- materjalid;
- üldine vestlusassistent.

Kui Tööheaolu töövoog vajab kovisiooni, dokumenti või vestlusruumi, tuleb luua **sisend olemasolevasse moodulisse** või suunav nupp, mitte uus dubleeritud moodul.

---

## 2. Lukustatud 10 põhifunktsiooni

Tööheaolu mooduli põhifunktsioonide nimekiri on lukustatud. Uusi põhikaarte praegu ei lisata.

1. **Kiirkontroll**  
   Töökoormuse radar ja roheline/kollane/punane signaal.

2. **Ülevaade**  
   Nädala ja kuu mustrid, töö nõudmised vs tööressursid, kokkuvõtted ja juhiga jagatav memo.

3. **Raske juhtum**  
   24 tunni järelplaan, juhiga arutelu memo ja kovisiooni sisend.

4. **Töövägivald**  
   Ohusignaal, neutraalne juhtumikirjeldus, turvalisuse kokkuleppe sisend ja kovisiooni sisend.

5. **Taastumine**  
   24–72 tunni taastumise, prioriseerimise ja töö ümberkorraldamise plaan.

6. **Tööpiirid**  
   Tööaja, kättesaadavuse, pauside, asenduste ja kriisiolukorra erandite kokkulepped.

7. **Katkestused**  
   Tööpäeva killustatuse diagnostika, fookusaja ja suhtluskanalite kokkulepped.

8. **Tööprotsessid**  
   Ajaröövlite audit, dokumenteerimise lihtsustamine ja info liikumise kokkuvõte.

9. **Rollipiirid**  
   Ootuste, vastutuse ja koostööpiiride analüüs ning rolliselgitused.

10. **Alustaja tugi**  
   Esimese nädala, esimese kuu ja 100 päeva töötoe plaan alustavale spetsialistile.

---

## 3. Mida mitte lisada eraldi funktsioonina

Järgmised teemad ei ole eraldi Tööheaolu põhikaardid:

- **Kovisioon** — olemas juba eraldi põhifunktsioonina.
- **Kolleegitugi** — väljund või suunamine raske juhtumi, töövägivalla, taastumise või alustaja toe seest.
- **Raportid** — kuuluvad Ülevaate alla.
- **Meeskond** — pigem memo, kokkuleppe või arutelu väljund, mitte eraldi kaart.
- **Selgitused** — kuuluvad Rollipiiride või Dokumentide koostamise alla.
- **Supervisioon** — suund või soovitus, mitte eraldi Tööheaolu kaart.
- **Juhend** — avaneb i-ikooni alt, mitte eraldi kaardina.

---

## 4. Läbiv professionaalne andmeraamistik

Kõik 10 funktsiooni peavad kasutama ühist andmeloogikat. Eesmärk on, et andmed oleksid hiljem töödeldavad, eksporditavad ja KOVide või organisatsioonide vahel võrreldavad.

### 4.1 Töö nõudmised

Need kirjeldavad, mis koormust tekitab:

- töömaht;
- juhtumite keerukus;
- emotsionaalne koormus;
- dokumenteerimise koormus;
- katkestused;
- töövälise kättesaadavuse mõju;
- kiireloomulisus;
- rollikonflikt;
- töövägivald;
- moraalne või eetiline pinge;
- traumaga kokkupuude.

### 4.2 Tööressursid

Need kirjeldavad, mis aitab koormust juhtida:

- kolleegitugi;
- juhitugi;
- kovisioon või supervisioon;
- otsustusruum;
- prioriteetide selgus;
- tööpiiride selgus;
- taastumisvõimalus;
- tööprotsesside selgus;
- rolliselgus;
- juhendamise või mentorluse olemasolu.

### 4.3 Riskisündmused

Need on sündmused või olukorrad, mis vajavad eraldi tähelepanu:

- raske juhtum;
- töövägivald;
- ähvardus või agressioon;
- eetiline dilemma;
- sekundaarse traumaatilise stressi risk;
- vahetu ohu olukord;
- juhtum, mida ei peaks üksi kandma;
- alustava spetsialisti kõrge toe vajadus.

### 4.4 Töökorralduslikud väljundid

Need on kasutaja kontrollitavad väljundid:

- isiklik kokkuvõte;
- juhiga jagatav memo;
- 24h järelplaan;
- 24–72h taastumisplaan;
- tööpiiride kokkuleppe mustand;
- fookusaja kokkulepe;
- tööprotsessi kaart;
- ajaröövlite audit;
- rolliselgitus;
- kovisiooni sisend;
- 100 päeva töötoe plaan.

---

## 5. Standardväljad ja eksporditavus

Kõik salvestatavad Tööheaolu töövood peavad sisaldama standardseid tehnilisi välju.

```ts
schemaVersion
scoringVersion
workflowType
createdAt
period
roleGroup
standardizedFields
computedSignal
loadFactors
resourceFactors
riskMarkers
recommendedActions
visibility
aggregationEligible
```

### 5.1 Standardväärtuste näited

```ts
workloadLevel: "low" | "moderate" | "high" | "critical"

caseComplexityLevel: "routine" | "moderate" | "complex" | "very_complex"

emotionalLoad: "low" | "moderate" | "high" | "very_high"

documentationLoad: "low" | "moderate" | "high" | "very_high"

interruptionsLevel: "low" | "moderate" | "high" | "very_high"

recoveryLevel: "sufficient" | "partial" | "low" | "none"

afterHoursImpact: "none" | "low" | "moderate" | "high"

supportAvailability: "available" | "partial" | "unclear" | "not_available"

decisionControl: "high" | "moderate" | "low" | "none"

priorityClarity: "clear" | "partly_clear" | "unclear"

signalLevel: "green" | "yellow" | "red"
```

Oluline: olulised võrdlusandmed ei tohi jääda ainult vabateksti.

---

## 6. Anonüümne koondandmestik ja KOVide võrreldavus

Tööheaolu andmestik peab tulevikus olema eksporditav ja võrreldav KOVide, organisatsioonide, üksuste, rolligruppide ja perioodide lõikes.

Toetada tuleb vähemalt:

- CSV;
- XLSX;
- JSON.

Võrdlevasse andmestikku ei tohi minna:

- kasutaja nimi;
- e-post;
- vabatekstid;
- kliendiandmed;
- juhtumite detailid;
- otseselt või kaudselt tuvastavad andmed.

Lisa miinimumgrupi põhimõte:

```ts
minimumGroupSize = 3 // piloodi vaikeväärtus, keskkonnamuutujaga muudetav
```

Kui grupis on alla miinimumi, ei tohi andmeid kuvada ega eksportida selliselt, et inimene oleks tuvastatav. Piloodi alguses võib lävi olla 3, suuremas kasutuses saab sama reegli tõsta näiteks 5 peale.

---

## 7. Võrreldavad koondnäitajad

Tulevikus peab saama arvutada vähemalt järgmisi näitajaid:

- kiirkontrollide arv;
- roheliste/kollaste/punaste signaalide osakaal;
- kõrge dokumenteerimise koormuse osakaal;
- kõrgete katkestuste osakaal;
- vähese või puuduva taastumise osakaal;
- töövälise kättesaadavuse kõrge mõju osakaal;
- raske juhtumi märkimiste arv;
- töövägivalla märkimiste arv;
- tööpiiride kokkuleppe vajadus;
- rollipiiride probleemide sagedus;
- tööprotsesside lihtsustamise vajadus;
- toe või kovisiooni vajadus;
- juhitoe või kolleegitoe puudumise osakaal;
- prioriteetide ebaselguse osakaal;
- otsustusruumi vähesuse osakaal.

Võrdlus ei tohi tähendada töötajate hindamist. Võrreldakse töökorralduse koormustegureid, mitte inimesi.

---

## 8. Ühtne privaatsusloogika

Kõik Tööheaolu sisestused ja mustandid on vaikimisi privaatsed.

```ts
visibility = "private"
```

Ei tohi olla automaatset jagamist:

- juhile;
- tööandjale;
- kolleegile;
- teenuseosutajale;
- kovisiooni;
- vestlusruumi;
- dokumentide koostamisse.

Kui kasutaja soovib midagi jagada, peab süsteem looma eraldi jagatava versiooni:

```ts
shareableVersion
userReviewed = false
userConfirmed = false
```

Toorandmeid ei jagata. Jagatav memo või kokkuvõte on eraldi tekst, mille kasutaja vaatab üle ja kinnitab.

---

## 9. Ühine väljundite mudel

Soovitatav on luua või kasutada ühist mudelit Tööheaolu väljundite jaoks.

```prisma
model WellbeingOutputDraft {
  id              String   @id @default(cuid())
  userId          String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workflowType    String
  outputType      String
  sourceRecordId  String?

  generatedText   String
  editedText      String?

  visibility      String   @default("private")
  status          String   @default("draft")

  schemaVersion   String   @default("1.0")
}
```

Väljunditüübid:

```ts
"personal_summary"
"manager_memo"
"action_plan_24h"
"recovery_plan_72h"
"boundary_agreement"
"focus_time_agreement"
"process_audit"
"role_explanation"
"covision_input"
"starter_100_day_plan"
```

---

## 10. Ühine koondandmete mudel

Lisa tulevikukindel abstraktsioon anonüümsete koondnäitajate jaoks.

```prisma
model WellbeingAggregateMetric {
  id                String   @id @default(cuid())
  createdAt         DateTime @default(now())

  schemaVersion     String
  scoringVersion    String

  periodStart       DateTime
  periodEnd         DateTime

  municipalityId    String?
  organizationId    String?
  orgUnitHash       String?
  roleGroup         String?

  metricKey         String
  metricValue       Float
  sampleSize        Int

  aggregationLevel  String
  exportEligible    Boolean @default(false)
}
```

Näited `metricKey` väärtustest:

```ts
"signal.green.share"
"signal.yellow.share"
"signal.red.share"
"load.documentation.high_share"
"load.interruptions.high_share"
"recovery.low_or_none_share"
"after_hours.high_share"
"risk.difficult_case.count"
"risk.workplace_violence.count"
"resource.support_unclear.share"
"resource.priority_unclear.share"
"resource.decision_control_low.share"
"role_boundary.problem_share"
"process.simplification_needed.share"
```

---

## 11. Ekspordi ettevalmistus

Lisa esialgne eksporditeenuse struktuur, isegi kui UI-s eksporti veel ei kuvata.

Soovituslikud helperid:

```ts
buildWellbeingExportDataset(filters)
exportWellbeingCsv(dataset)
exportWellbeingXlsx(dataset)
exportWellbeingJson(dataset)
```

Filtrid:

```ts
periodStart
periodEnd
municipalityId
organizationId
roleGroup
workflowType
aggregationLevel
```

Igas ekspordis peab olema:

```ts
schemaVersion
scoringVersion
generatedAt
filters
minimumGroupSize
```

Kui `sampleSize < minimumGroupSize`, tuleb väärtus varjata või koondada kõrgemale tasemele.

---

# 12. Funktsioonid

## 12.1 Kiirkontroll

### Kirjeldus

Kiirkontroll on Tööheaolu mooduli töökoormuse radar. See aitab paari minutiga hinnata, kas töökoormus on hetkel juhitav, vajab tähelepanu või võib vajada kiiremat töökorralduslikku arutelu.

Kiirkontroll ei küsi ainult enesetunnet, vaid mõõdab tööolukorra tegureid: töömahtu, juhtumite keerukust, emotsionaalset koormust, dokumenteerimist, katkestusi, taastumisvõimalust ja tööressursse.

### Mida funktsioon sisaldab

Standardväljad:

- töömaht;
- juhtumite keerukus;
- emotsionaalne koormus;
- dokumenteerimise koormus;
- katkestused;
- taastumisvõimalus;
- töövälise kättesaadavuse mõju;
- otsustusruum töö üle;
- prioriteetide selgus;
- juhilt või kolleegilt toe kättesaadavus;
- kovisiooni/supervisiooni vajadus;
- tööpiiride selgus;
- raske juhtumi märge;
- toe vajadus.

### Signaal

Kiirkontroll annab:

- roheline;
- kollane;
- punane.

Signaal peab põhinema standardväljade punktisüsteemil ja erireeglitel. Näiteks taastumise puudumine koos kriitilise töömahuga peab viima punasele signaalile.

### Väljundid

- töökoormuse signaal;
- peamised koormustegurid;
- puudu jäänud tööressursid;
- soovitatud järgmine töövoog;
- salvestatav kiirkontroll;
- sisend Ülevaatesse.

### Soovitatud seosed

- kõrge dokumenteerimine → **Tööprotsessid**;
- palju katkestusi → **Katkestused**;
- taastumine puudub → **Taastumine**;
- tööväline kättesaadavus kõrge → **Tööpiirid**;
- roll ebaselge → **Rollipiirid**;
- raske juhtum → **Raske juhtum**.

### Ehitamise märkus

Kiirkontroll tuleb ehitada esimesena, sest see loob andmepõhja Ülevaatele, trendidele, raportitele ja koondandmestikule.

---

## 12.2 Ülevaade

### Kirjeldus

Ülevaade koondab kasutaja tööheaolu sisestused ning aitab näha nädala ja kuu lõikes mustreid: töö nõudmisi, tööressursse, riskisündmusi ja korduvaid koormustegureid.

Ülevaade ei ole tööandja dashboard ega töötaja hindamise tööriist. See on kasutaja enda töökoormuse ja tööressursside tõlgendusvaade.

### Mida funktsioon sisaldab

Plokid:

- perioodi signaal;
- kiirkontrollide arv;
- töö nõudmised;
- tööressursid;
- korduvad koormustegurid;
- taastumise muster;
- riskisündmused;
- soovitatud töökorralduslikud sammud;
- nädala kokkuvõte;
- kuu kokkuvõte;
- juhiga jagatav memo.

### Signaal

Ülevaade annab perioodi signaali:

- roheline;
- kollane;
- punane;
- andmeid vähe.

### Väljundid

- isiklik nädalakokkuvõte;
- isiklik kuukokkuvõte;
- juhiga jagatav töökorralduslik memo;
- soovitatud järgmine töövoog;
- anonüümsete koondnäitajate sisend.

### Oluline piirang

Juhiga jagatav memo peab kasutama ainult koondatud ja üldistatud andmeid. Vabatekste ei tohi automaatselt memo sisse panna.

---

## 12.3 Raske juhtum

### Kirjeldus

Raske juhtumi töövoog aitab pärast emotsionaalselt, eetiliselt või töökorralduslikult rasket olukorda koostada 24 tunni järelplaani ja tööalase kokkuvõtte.

See ei ole teraapia ega kriisiabi. See on tööalane korrastamise ja järeltegevuse tööriist.

### Mida funktsioon sisaldab

Markerid:

- juhtumi tüüp;
- vahetu ohu olemasolu;
- üldistatud kirjeldus;
- kasutaja tööalane roll;
- mis jäi koormama;
- eetiline pinge;
- moraalse stressi tunne;
- traumaga kokkupuude;
- rolli või vastutuse ebaselgus;
- juhtum, mida ei peaks üksi kandma;
- järgmise 24 tunni vajadused;
- kovisiooni sisendi vajadus;
- taastumise vajadus.

### Signaal

- puudub vahetu oht;
- vajab tähelepanu;
- kiire tähelepanu vajalik.

Vahetu ohu korral peab nähtavale tulema ohutustekst.

### Väljundid

- 24h järelplaan;
- neutraalne kokkuvõte;
- juhiga arutelu memo;
- kovisiooni sisend;
- taastumise suund.

### Seosed

- kovisiooni vajadus → olemasolev **Kovisioon**;
- taastumise vajadus → **Taastumine**;
- tööpiiri probleem → **Tööpiirid**;
- rollikonflikt → **Rollipiirid**.

---

## 12.4 Töövägivald

### Kirjeldus

Töövägivalla töövoog on mõeldud olukordadeks, kus spetsialist on kogenud ähvardust, agressiooni, solvamist, hirmutamist, jälitamist, füüsilist ohtu või muud tööalast vägivalla vormi.

Fookus on ohutusel, neutraalsel dokumenteerimisel ja töökorralduslikul järeltegevusel.

### Mida funktsioon sisaldab

Eristatavad olukorrad:

- solvamine või alandamine;
- agressioon;
- ähvardus;
- füüsiline oht;
- jälitamine või hirmutamine;
- korduv ahistav suhtlus;
- ähvardav sõnum või e-kiri;
- kodukülastuse või üksinda töötamise risk;
- oht praegu kestab / ei kesta / pole kindel.

Lisaväljad:

- toimumise koht või kanal;
- kas olukord on dokumenteeritud;
- mõju tööle või turvatundele;
- järgmise sammu vajadus.

### Signaal

- puudub vahetu oht;
- vajab tähelepanu;
- kiire tähelepanu vajalik.

Kui oht kestab praegu või keegi võib saada viga, peab nähtavale tulema ohutustekst.

### Väljundid

- neutraalne juhtumikirjeldus;
- turvalisuse kokkuleppe sisend;
- juhiga arutelu memo;
- kovisiooni sisend;
- töökorralduse muutmise soovitus.

---

## 12.5 Taastumine

### Kirjeldus

Taastumine on 24–72 tunni töökorralduslik plaan raske nädala, raske juhtumi, töövägivalla kogemuse või pikaajalise ülekoormuse järel.

See ei ole tervisehindamine ega ravi soovitus. Eesmärk on aidata prioriseerida, edasi lükata, ümber jagada ja tuge küsida.

### Mida funktsioon sisaldab

Mõõdikud:

- taastumise põhjus;
- taastumisvõimalus;
- töövõime tunnetus järgmise 24–72h vaates;
- peamised koormustegurid;
- vältimatud ülesanded;
- edasilükatavad ülesanded;
- ümberjagatavad ülesanded;
- vajalik tugi;
- järgmine kontrollpunkt.

### Signaal

- juhitav;
- vajab prioriseerimist;
- vajab töökorralduslikku tuge.

### Väljundid

- 24–72h taastumisplaan;
- prioriseerimise loend;
- juhiga memo;
- töö ümberjagamise ettepanek.

### Seosed

- raske juhtum → **Raske juhtum**;
- töövägivalla kogemus → **Töövägivald**;
- töövälise kättesaadavuse surve → **Tööpiirid**;
- katkestused → **Katkestused**;
- kovisiooni vajadus → olemasolev **Kovisioon**.

---

## 12.6 Tööpiirid

### Kirjeldus

Tööpiiride tööriist aitab koostada tööaja, kättesaadavuse, pauside, asenduste, fookusaja ja kriisiolukorra erandite kokkuleppeid.

See ei määra töökorraldust ise. See koostab mustandi, mida kasutaja saab arutada juhi, kolleegi, meeskonna või partneriga.

### Mida funktsioon sisaldab

Kokkuleppe tüübid:

- töövälise kättesaadavuse kokkulepe;
- tööaja piirid;
- õhtuste sõnumite ja kõnede kokkulepe;
- pauside kokkulepe;
- asenduste kokkulepe;
- kriisiolukorra erandite kokkulepe;
- fookusaja kokkulepe;
- kiireloomuliste pöördumiste kokkulepe.

Lisaväljad:

- praegune mure;
- kokkuleppe osapool;
- soovitud põhimõte;
- erandid;
- kokkuleppe jälgimine;
- ülevaatamise aeg.

### Signaal

- piir on pigem selge;
- vajab täpsustamist;
- vajab kokkulepet või töökorralduslikku arutelu.

### Väljundid

- tööpiiride kokkuleppe mustand;
- töövälise kättesaadavuse kokkulepe;
- juhiga memo;
- kriisiolukorra erandite mustand;
- dokumentide koostamise sisend.

---

## 12.7 Katkestused

### Kirjeldus

Katkestuste tööriist on tööpäeva killustatuse diagnostika. See aitab eristada vältimatud katkestused nendest, mida saab kokkulepete, kanalite või töövoogudega vähendada.

### Mida funktsioon sisaldab

Katkestuste klassifikatsioon:

- vältimatu;
- kokkulepitav;
- edasi lükatav;
- valest kanalist tulev;
- rollipiiridest tulenev;
- dokumenteerimise või infosüsteemi probleemist tulenev;
- koostööpartneri protsessist tulenev.

Lisaväljad:

- katkestuse allikad;
- sagedus;
- mõju tööle;
- mis vajab kohe reageerimist;
- mis võiks oodata;
- vajalik kokkulepe;
- kokkuleppe osapool.

### Signaal

- katkestused on juhitavad;
- vajab töövoo täpsustamist;
- vajab kokkulepet või ümberkorraldust.

### Väljundid

- katkestuste kaart;
- fookusaja kokkulepe;
- suhtluskanalite kokkulepe;
- juhiga memo.

### Seosed

- tööväline kättesaadavus → **Tööpiirid**;
- dokumenteerimise katkestused → **Tööprotsessid**;
- taastumise puudus → **Taastumine**.

---

## 12.8 Tööprotsessid

### Kirjeldus

Tööprotsessid on ajaröövlite ja töövoogude audit. Funktsioon aitab kaardistada, mis tööpäevas või töövoos aega ja tähelepanu võtab ning millised tegevused suurendavad koormust ilma piisavat väärtust loomata.

### Mida funktsioon sisaldab

Kategooriad:

- väärtust loov klienditöö;
- vajalik, kuid koormav töö;
- dubleeriv sisestamine;
- dokumenteerimine;
- info otsimine;
- partneritega kooskõlastamine;
- ootamine;
- korduvtegevused;
- tegevused, mis ei loo piisavalt väärtust.

Lisaväljad:

- analüüsi fookus;
- peamised ajakulu allikad;
- vähese väärtusega või dubleerivad tegevused;
- info liikumise takistused;
- mis jääb pooleli;
- mis võiks lihtsustada;
- tööprotsessi mõju.

### Signaal

- töövoog on pigem juhitav;
- vajab lihtsustamist;
- vajab töökorralduslikku muutust.

### Väljundid

- tööprotsessi kaart;
- kolm suurimat ajaröövlit;
- dokumenteerimise lihtsustamise ettepanek;
- info liikumise kokkuvõte;
- töökorralduse arutelu memo.

### Seosed

- katkestused → **Katkestused**;
- ebaselged kokkulepped → **Tööpiirid**;
- rolli või vastutuse segadus → **Rollipiirid**;
- vormistamise vajadus → **Dokumentide koostamine**.

---

## 12.9 Rollipiirid

### Kirjeldus

Rollipiiride tööriist aitab analüüsida ootusi, vastutust ja koostööpiire. See ei ole ainult kirja kirjutamise tööriist, vaid aitab enne sõnastamist selgitada, kes ootab mida, mis kuulub spetsialisti rolli ja mis vajab teise osapoole panust.

### Mida funktsioon sisaldab

Markerid:

- kes esitab ootuse;
- mida oodatakse;
- mis on minu roll;
- mis ei ole minu roll;
- kelle vastutus või panus on vajalik;
- kas ootus tekitab rollikonflikti;
- kas vaja on partnerile selgitust;
- kas vaja on juhiga arutelu.

### Signaal

- roll on pigem selge;
- vajab selgitamist;
- vajab töökorralduslikku või võrgustiku arutelu.

### Väljundid

- rollipiiride analüüs;
- kliendile selgitus;
- partnerile rolliselgitus;
- “mida saan / mida ei saa teha” tekst;
- juhiga memo.

### Seosed

- pidev kättesaadavus → **Tööpiirid**;
- rollide ebaselgus töövoos → **Tööprotsessid**;
- korduvad katkestused → **Katkestused**;
- eetiline keerukus → olemasolev **Kovisioon**.

---

## 12.10 Alustaja tugi

### Kirjeldus

Alustaja tugi on alustava sotsiaalvaldkonna spetsialisti 100 päeva töötoe teekond. See ei ole lihtsalt sisseelamisjuhend, vaid tööriist, mis aitab kaardistada toe vajadust, küsimusi juhile või mentorile, kovisiooni vajadust ja tööpiire.

### Mida funktsioon sisaldab

Mõõdikud:

- töökogemuse etapp;
- rollivaldkond;
- ebaselged teemad;
- olemasolev tugi;
- puuduv tugi;
- juhtumid, mida ei tohiks üksi kanda;
- kovisiooni vajaduse märgid;
- mentori või juhiga arutelu vajadus.

### Signaal

- tugi on pigem olemas;
- vajab selgemat töötoe plaani;
- vajab kiiremat toe kokkulepet.

### Väljundid

- esimese nädala plaan;
- esimese kuu fookused;
- 100 päeva töötoe plaan;
- küsimused juhile või mentorile;
- kovisiooni vajaduse kontroll;
- alustaja tööpiiride mustand.

### Seosed

- roll või vastutus ebaselge → **Rollipiirid**;
- töökorraldus või dokumenteerimine ebaselge → **Tööprotsessid**;
- tööpiirid vajavad kokkulepet → **Tööpiirid**;
- keerulisi juhtumeid ei peaks üksi kandma → olemasolev **Kovisioon**.

---

## 13. Info-ikoonide täiendamine

Kõigi 10 funktsiooni info-overlay tekstid peavad ütlema:

- funktsioon on töökorralduslik tööriist;
- sisestus on vaikimisi privaatne;
- tööriist ei hinda töötaja töösooritust;
- tööriist ei asenda juhti, supervisiooni, kriisiabi ega tööandja vastutust;
- vajadusel luuakse eraldi jagatav versioon, mille kasutaja kinnitab;
- koondandmeid võib kasutada ainult anonüümselt ja piisava grupisuuruse korral.

Raske juhtumi ja Töövägivalla lehtedel peab vahetu ohu korral olema nähtav ohutustekst, mitte ainult i-ikooni all.

---

## 14. Mida selles etapis mitte teha

Ära ehita:

- tööandja dashboard’i;
- juhi vaadet üksiktöötaja sisestustele;
- automaatset jagamist;
- automaatset e-kirja saatmist;
- kasutaja kalendri, e-kirjade või kõnede jälgimist;
- meditsiinilist või psühholoogilist hindamist;
- automaatset kriisiriskide AI-klassifitseerimist vabateksti põhjal;
- kovisiooni, dokumentide koostamise või vestlusruumide dubleeritud mooduleid;
- avalikku KOVide edetabelit.

---

## 15. Kontrollnimekiri

Pärast muudatusi kontrolli:

- kõik 10 funktsiooni kasutavad standardiseeritud välju;
- vabatekst ei ole ainus oluline andmeallikas;
- igal töövool on `schemaVersion`;
- igal signaalil on `scoringVersion`;
- iga sisestus on vaikimisi privaatne;
- iga töövoog annab praktilise väljundi;
- Ülevaade eristab töö nõudmisi ja tööressursse;
- Kiirkontroll suudab soovitada järgmist töövoogu;
- raske juhtumi ja töövägivalla töövood kuvavad ohutustekstid;
- Tööprotsessid ja Katkestused toodavad võrreldavaid töökorralduse kategooriaid;
- Rollipiirid toodab rollikonflikti ja ootuste andmeid;
- Alustaja tugi toodab 100 päeva töötoe plaani;
- ekspordi ettevalmistuseks vajalikud väljad on olemas;
- koondandmete mudel ei sisalda vabatekste ega isikuandmeid;
- väikese grupi andmeid ei saa ekslikult eksportida;
- olemasolevad SotsiaalAI põhifunktsioonid ei lähe katki.

---

## 16. Lõpptulemus

Pärast seda täiendust peab Tööheaolu moodul olema tugevam kolmes mõttes:

1. **Kasutajale kasulik**  
   Iga funktsioon annab konkreetse tööalase väljundi.

2. **Andmepõhiselt võrreldav**  
   Tööheaolu mustreid saab tulevikus anonüümselt võrrelda KOVide, üksuste ja perioodide lõikes.

3. **Usaldusväärne ja privaatsust hoidev**  
   Üksiktöötaja sisestused jäävad privaatseks ning jagamine toimub ainult kasutaja kinnitusega.

Lühike arendusprintsiip:

> Tööheaolu mooduli 10 põhifunktsiooni on lukustatud. Edasine arendus ei lisa uusi põhikaarte, vaid täiendab olemasolevate funktsioonide standardvälju, signaaliloogikat, töövoogude väljundeid, privaatsusloogikat, anonüümset koondandmestikku ja eksporditavust.
