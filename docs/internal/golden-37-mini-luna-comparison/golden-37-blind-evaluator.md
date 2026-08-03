# Golden-37 pimehindamispakett

Mudelid ja konfiguratsioonid on siit failist teadlikult eemaldatud. Hinda mõlemad vastused enne eraldi võtmefaili avamist. Küsimuse täistekst, fikseeritud vestlusajalugu ja olemasolevad Golden-ootused on lisatud, et ülesandespetsiifiline hindamine oleks võimalik.

## Hindamine

Anna kummalegi vastusele kuus hinnet skaalal 0–3: (1) faktiline ja õiguslik täpsus; (2) katvus ja küsimusele vastamine; (3) fakti, hinnangu, praktika, uuringu ja ettepaneku eristus; (4) ebakindluse ja allikapiiride ausus; (5) praktiline kasutatavus; (6) selgus, struktuur, terviklikkus ja proportsionaalne pikkus. Kriitiline viga piirab faktitäpsuse maksimaalselt ühele punktile.

Kontrolli eraldi allikate asjakohasust, väidete ja allikate vastavust, inimese õigusi/autonoomiat, põhjendamata oletusi, riskide seost maandamisega ja allikate jälgitavust. `task_expectations` on fikseeritud automaatkontrolli alus, mitte täielik sisuhinne.

## 1. kov_kuusalu_koduteenus

**Küsimus:** Millised on Kuusalu valla koduteenuse tingimused?

**Ülesandespetsiifilised ootused:**

```json
{
  "mode": "municipality_service_benefit_list",
  "package_aware": true,
  "displayed_min": 1,
  "displayed_must_include": [
    "koduteenus"
  ],
  "answer_must_include": [
    "koduteenus"
  ]
}
```

### Vastus A — G86a070bc1b3ded38

Kuusalu valla koduteenus on mõeldud inimese toetamiseks tema kodus, kui ta vajab igapäevatoimingutes kõrvalabi ega tule nendega iseseisvalt piisavalt toime. Teenuse täpne sisu ja ulatus kujundatakse inimese abivajaduse põhjal.

Põhitingimused:

- hinnatakse inimese abivajadust ja toimetulekut;
- teenus on Kuusalu valla korraldatav sotsiaalteenus;
- teenuse sisu määratakse vastavalt sellele, millist abi inimene kodus vajab;
- taotlemiseks tuleb pöörduda Kuusalu valla sotsiaalteenistuse poole või esitada taotlus valla e-teeninduses/paberil vastavalt valla juhistele.

Õiguslik alus on Kuusalu valla „Sotsiaalhoolekandelise abi andmise kord“ § 6 „Koduteenus“ ehk KOV-i määrus.

Teenuse ametlik info ja taotlemise juhised: https://www.kuusalu.ee/koduteenus

Lisainfo saamiseks võib pöörduda Kuusalu valla sotsiaalteenistuse poole:

- Aigi Reinomägi, hoolekandespetsialist: 606 6381 või 5191 4206, aigi.reinomagi@kuusalu.ee
- Alvi Karp, juhtiv hoolekandespetsialist: 606 6382 või 5196 8482, alvi.karp@kuusalu.ee

Aadress: Mõisa tee 17, Kiiu alevik, Kuusalu vald. Kontaktide leht: https://www.kuusalu.ee/kontaktid1

Kasutatud allikates ei täpsustata eraldi teenuse tasu ega menetlustähtaega.

Kuvatud allikad:

- Koduteenus — https://www.kuusalu.ee/koduteenus
- Koduteenus — https://www.kuusalu.ee/koduteenus
- Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas § 6 Koduteenus — https://www.riigiteataja.ee/akt/406062023041?leiaKehtiv

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G2cf7d96a10a44807

Kuusalu valla koduteenus on mõeldud inimesele, kes vajab abi kodus igapäevaeluga toimetulekuks. Teenuse eesmärk on toetada inimese kodust toimetulekut, kui tervislik seisund, vanus või muu abivajadus teeb koduste toimingutega hakkama saamise raskeks.

Tingimused on allikate põhjal kirjeldatud üldiselt, mitte väga detailselt. Kinnitatud alus annab mõista, et teenus on abivajaduspõhine ja selle vajadust hinnatakse enne teenuse määramist.

Oluline õiguslik alus:
- Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas, § 6 „Koduteenus“

Taotlemine:
- avaldus esitatakse Kuusalu valla kodulehe kaudu või paberavaldusena
- teenuse vajadusest saab ka teatada telefoni teel

Kui soovid, võin samast allikast kohe välja tuua ka, kuidas koduteenust taotletakse ja kelle poole Kuusalu vallas pöörduda.

Kuvatud allikad:

- Koduteenus — https://www.kuusalu.ee/koduteenus
- Koduteenus — https://www.kuusalu.ee/koduteenus
- Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas § 6 Koduteenus — https://www.riigiteataja.ee/akt/406062023041?leiaKehtiv

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 2. kov_harku_sotsiaaltransport

**Küsimus:** Kuidas taotleda Harku vallas sotsiaaltransporditeenust?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "displayed_must_not_include": [
    "kuusalu"
  ],
  "answer_must_include_any": [
    "sotsiaaltransport",
    "transporditeenus",
    "transpordi"
  ]
}
```

### Vastus A — Ga3caf85a991c83a6

Harku vallas sotsiaaltransporditeenuse taotlemiseks:

1. Esita põhjendatud taotlus digiallkirjastatud e-postiga või paberkandjal Harku Vallavalitsuses.
2. Taotluses kirjelda, miks vajad transporti ja kuhu sõidud on vajalikud – näiteks tööle, kooli, arsti juurde, vallavalitsusse või muu avaliku teenuse kasutamiseks.
3. Abivajadust hindab sotsiaaltöötaja ning otsus tehakse üldjuhul 10 tööpäeva jooksul.
4. Regulaarse transpordi puhul on soovitatav taotlus esitada vähemalt 30 päeva enne teenuse algust. Üksiksõidu ehk tellimussõidu vajadusest tuleb teatada vähemalt 3 tööpäeva ette.

Teenusele võivad taotleda Harku valla elanikud, kellel on liikumisraskus või puue ning kes vajavad transporti tööle, kooli, arsti juurde või avalike teenuste kasutamiseks. Regulaarne sõit on tasuta; nõudepõhise sõidu korral tuleb tasuda 0,30 eurot kilomeetri kohta ja 4 eurot tunnis.

Taotluse esitamise ja teenuse kohta saab nõu küsida Harku valla sotsiaalhoolekandespetsialist Meeli Vaarpuult:
telefon 5552 0232  
e-post meeli.vaarpuu@harku.ee  
aadress Teenuste 2, Tabasalu  

Ametlik kontaktileht: https://www.harku.ee/pere-sotsiaal-ja-tervishoid/kontakt/sotsiaal-ja-tervishoiuosakonna-kontaktid  
Teenuse info: https://harku.ee/pere-sotsiaal-ja-tervishoid/erivajadus-ja-igapaevaelu/teenused-erivajadusega-inimesele

Kuvatud allikad:

- Asendushooldusteenus — https://harku.ee/pere-sotsiaal-ja-tervishoid/pere-ja-lapsed/vanemlus-ja-paarisuhe
- Täisealise isiku hooldus — https://harku.ee/pere-sotsiaal-ja-tervishoid/erivajadus-ja-igapaevaelu/teenused-erivajadusega-inimesele
- Üldhooldusteenus väljaspool kodu — https://harku.ee/pere-sotsiaal-ja-tervishoid/toimetulek/eakate-toimetulek

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G181625c539b097f6

Harku vallas taotletakse sotsiaaltransporditeenust nii, et esitad põhjendatud taotluse Harku Vallavalitsusele kas digiallkirjastatult e-postiga või paberkandjal kohapeal. Teenuse saamiseks hinnatakse abivajadus ja otsus tehakse 10 tööpäeva jooksul. Regulaartranspordi taotlus on soovitatav esitada 30 päeva enne teenuse algust ning tellimussõidust tuleb teada anda vähemalt 3 tööpäeva ette.

Teenuse sisu järgi on see mõeldud liikumisraskustega või puudega Harku valla elanikele, kellel on vaja transporti tööle, kooli, arsti juurde või avalike teenuste kasutamiseks. Regulaarne sõit on tasuta; nõudepõhise sõidu puhul on tasu 0,30 eurot kilomeetri kohta ja 4 eurot tunnis.

Taotlemiseks:
- esita põhjendatud taotlus
- digiallkirjastatult e-postiga või paberkandjal Harku Vallavalitsuses
- vajadusel pöördu Harku valla sotsiaal- ja tervishoiuosakonna poole

Sobiv kontakt teenuse asjus on Meeli Vaarpuu, sotsiaalhoolekandespetsialist, tel 5552 0232, e-post meeli.vaarpuu@harku.ee. Aadress on Teenuste 2, Tabasalu. Teenuse ametlik leht on https://harku.ee/pere-sotsiaal-ja-tervishoid/erivajadus-ja-igapaevaelu/teenused-erivajadusega-inimesele

Kui soovid, võin järgmise sammuna kirjutada sulle valmis taotluse mustandi.

Kuvatud allikad:

- Asendushooldusteenus — https://harku.ee/pere-sotsiaal-ja-tervishoid/pere-ja-lapsed/vanemlus-ja-paarisuhe
- Täisealise isiku hooldus — https://harku.ee/pere-sotsiaal-ja-tervishoid/erivajadus-ja-igapaevaelu/teenused-erivajadusega-inimesele
- Üldhooldusteenus väljaspool kodu — https://harku.ee/pere-sotsiaal-ja-tervishoid/toimetulek/eakate-toimetulek

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 3. kov_kuusalu_vormid

**Küsimus:** Millised vormid on seotud koduteenusega Kuusalu vallas?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "answer_must_include": [
    "vorm"
  ]
}
```

### Vastus A — Gd1e4bfdd516f4705

Kuusalu valla koduteenusega seotud konkreetset vormi või vormilinki ei ole praegu kasutatud allikates kinnitatud.

Koduteenuse ametlik teenuseleht: https://www.kuusalu.ee/koduteenus

Vormi või taotlemise täpse viisi kohta saab küsida Kuusalu valla sotsiaalteenistusest:
- Aigi Reinomägi, hoolekandespetsialist
- telefon 606 6381 või 5191 4206
- e-post aigi.reinomagi@kuusalu.ee
- kontaktide leht: https://www.kuusalu.ee/kontaktid1

Kuvatud allikad:

- Koduteenus — https://www.kuusalu.ee/koduteenus
- Koduteenus — https://www.kuusalu.ee/koduteenus
- Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas § 6 Koduteenus — https://www.riigiteataja.ee/akt/406062023041?leiaKehtiv

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G0acdff7acfcbf92d

Kuusalu valla koduteenusega ei ole kinnitatud ühtegi eraldi vormi.

Teenuse taotlemine käib Kuusalu valla koduteenuse lehe kaudu, kuid vormi linki allikad ei kinnita. Õiguslik alus on Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas § 6 „Koduteenus“.

Kui sul on vaja teenuse kohta edasi pöörduda, on sobiv kontakt Kuusalu valla sotsiaalteenistuses näiteks:
- Aigi Reinomägi, hoolekandespetsialist, 606 6381 / 5191 4206, aigi.reinomagi@kuusalu.ee
- Alvi Karp, juhtiv hoolekandespetsialist, 606 6382 / 5196 8482, alvi.karp@kuusalu.ee

Kui soovid, saan järgmise sammuna kokku võtta ka koduteenuse sisu ja taotlemise korra.

Kuvatud allikad:

- Koduteenus — https://www.kuusalu.ee/koduteenus
- Koduteenus — https://www.kuusalu.ee/koduteenus
- Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas § 6 Koduteenus — https://www.riigiteataja.ee/akt/406062023041?leiaKehtiv

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 4. kov_leakage_guard_narva

**Küsimus:** Millised on Narva linna koduteenuse tingimused?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_must_not_include": [
    "kuusalu",
    "harku",
    "anija"
  ],
  "answer_must_not_include": [
    "kuusalu vald",
    "harku vald"
  ]
}
```

### Vastus A — Ga3a63e974dc4abf9

Narva linna koduteenus on mõeldud inimesele, kes vajab kodus igapäevaeluga toimetulekuks abi. Teenuse eesmärk on toetada inimese hakkamasaamist oma elukohas.

Kasutatud allikate põhjal on teenuse tingimused kirjeldatud üldiselt, kuid eraldi abikõlblikkuse kriteeriume seal täpselt lahti ei kirjutata. Taotlemine käib kirjaliku avaldusega.

Kontakt, kuhu pöörduda:
Narva linna Sotsiaalabiamet
tel 356 9600
e-post sotsiaalabiamet@narva.ee
aadress Malmi tänav 5a, Narva
veeb https://www.narva.ee/narva-linna-sotsiaalabiamet

Kui soovid, võin järgmise sammuna anda ka koduteenuse taotlemise praktilise käigu või aidata koostada lühikese avalduse mustandi.

Kuvatud allikad:

- Koduteenus — https://www.narva.ee/sotsiaalteenused/-/asset_publisher/J8TOJukj0wfP/content/koduteenus
- Koduteenus — https://www.narva.ee/sotsiaalteenused/-/asset_publisher/J8TOJukj0wfP/content/koduteenus

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G1738c046e4c2b105

Narva linna koduteenus on mõeldud inimese toetamiseks kodus, kui ta vajab kõrvalabi igapäevatoimingutes ega tule nendega iseseisvalt toime. Teenuse täpne sisu ja ulatus määratakse inimese abivajaduse hindamise põhjal.

Taotlemine toimub kirjaliku taotlusega Narva linna Sotsiaalabiametile. Taotlus vaadatakse läbi ning hinnatakse, millist abi inimene kodus vajab ja millises mahus saab teenust korraldada.

Teenuse leht ja taotlemise juhis:  
https://www.narva.ee/sotsiaalteenused/-/asset_publisher/J8TOJukj0wfP/content/koduteenus

Üldkontakt:
Narva linna Sotsiaalabiamet  
telefon 356 9600  
e-post sotsiaalabiamet@narva.ee  
aadress Malmi tänav 5a, Narva  
https://www.narva.ee/narva-linna-sotsiaalabiamet

Kasutatud allikates ei täpsustata eraldi teenustasu ega menetlustähtaega.

Kuvatud allikad:

- Koduteenus — https://www.narva.ee/sotsiaalteenused/-/asset_publisher/J8TOJukj0wfP/content/koduteenus
- Koduteenus — https://www.narva.ee/sotsiaalteenused/-/asset_publisher/J8TOJukj0wfP/content/koduteenus

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 5. legal_shs_42

**Küsimus:** Mis ütleb SHS § 42?

**Ülesandespetsiifilised ootused:**

```json
{
  "mode": "explicit_paragraph",
  "evidence_package": false,
  "displayed_min": 1,
  "displayed_must_include": [
    "§ 42"
  ]
}
```

### Vastus A — G911cb7c5dcbebad6

Sotsiaalhoolekande seaduse § 42 pealkiri on „Puudega isikule eluruumi tagamine“.

See säte ütleb sisuliselt, et kohaliku omavalitsuse üksus abistab inimest, kellel on puudest tingituna raskusi eluruumis liikumise, endaga toimetuleku või suhtlemisega, eluruumi kohandamisel või sobivama eluruumi saamisel.

Samuti on seal põhimõte, et eluruumi kasutamise võimaluse kindlustamisel tuleb lähtuda eesmärgist, et puudega inimene saaks võimalikult kaua elada koduses keskkonnas.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 42 Puudega isikule eluruumi tagamine — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Gf53a265e953302bb

SHS § 42 „Puudega isikule eluruumi tagamine” sätestab, et kohaliku omavalitsuse üksus abistab puudega inimest:

- eluruumi kohandamisel või
- sobivama eluruumi saamisel,

kui puudest tingituna on tal raskusi eluruumis liikumise, enesega toimetuleku või suhtlemisega.

Eluruumi kasutamise võimaluse tagamisel tuleb lähtuda põhimõttest, et puudega inimene saaks võimalikult kaua elada koduses keskkonnas.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 42 Puudega isikule eluruumi tagamine — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 6. legal_shs_17

**Küsimus:** Mis ütleb SHS § 17?

**Ülesandespetsiifilised ootused:**

```json
{
  "mode": "explicit_paragraph",
  "displayed_min": 1,
  "displayed_must_include": [
    "§ 17"
  ]
}
```

### Vastus A — G14cae24b07d4370c

Sotsiaalhoolekande seaduse § 17 pealkiri on „Koduteenuse eesmärk ja sisu“.

Selle sätte järgi on koduteenus kohaliku omavalitsuse üksuse korraldatav sotsiaalteenus, mille eesmärk on täisealise isiku iseseisva ja turvalise toimetuleku tagamine kodustes tingimustes ning tema elukvaliteedi säilitamine ja parandamine.

Teenuse osutamisel abistatakse inimest toimingutes, mida ta terviseseisundist, tegevusvõimest või elukeskkonnast tulenevatel põhjustel ei suuda ilma kõrvalabita teha, kuid mis on vajalikud kodus elamiseks. Näidetena on nimetatud kütmine, toiduvalmistamine, eluruumi ja riiete korrastamine ning väljaspool eluruumi toiduainete ja majapidamistarvete ostmine ning muu asjaajamine.

Kui soovid, võin sama paragrahvi ka lihtsas keeles lahti seletada või aidata eristada koduteenust ja teisi KOV teenuseid.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 17 Koduteenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Ge151b952ca03af11

SHS § 17 „Koduteenuse eesmärk ja sisu” sätestab, et koduteenus on kohaliku omavalitsuse korraldatav sotsiaalteenus täisealisele inimesele. Selle eesmärk on toetada inimese iseseisvat ja turvalist toimetulekut kodus ning säilitada või parandada tema elukvaliteeti.

Koduteenuse raames abistatakse toimingutes, millega inimene ei saa terviseseisundi, tegevusvõime või elukeskkonna tõttu iseseisvalt hakkama, kuid mis on kodus elamiseks vajalikud. Näidetena on nimetatud:

- kütmine;
- toidu valmistamine;
- eluruumi ja riiete korrastamine;
- toiduainete ja majapidamistarvete ostmine väljaspool kodu;
- muu asjaajamine.

Seega reguleerib § 17 eelkõige koduteenuse eesmärki ja sisu; teenuse praktiline korraldus toimub kohaliku omavalitsuse kaudu.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 17 Koduteenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 7. legal_inflected_paragraph

**Küsimus:** Mida ütleb sotsiaalhoolekande seaduse paragrahv 23?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "displayed_must_include": [
    "§ 23"
  ]
}
```

### Vastus A — G81929f627300fe49

Sotsiaalhoolekande seaduse § 23 „Tugiisikuteenuse eesmärk ja sisu” sätestab, et:

- tugiisikuteenus on kohaliku omavalitsuse korraldatav sotsiaalteenus;
- teenuse eesmärk on toetada inimese iseseisvat toimetulekut, kui ta vajab sotsiaalsete, majanduslike, psühholoogiliste või terviseprobleemide tõttu olulisel määral kõrvalabi;
- kõrvalabi tähendab eelkõige juhendamist, motiveerimist ning iseseisvuse ja omavastutuse arendamist;
- last kasvatavale isikule osutades toetab teenus lapse hooldamist ning turvalise ja toetava kasvukeskkonna tagamist;
- lapsele osutades toetab tugiisik lapse arengut, igapäevast toimetulekut ja suhtlemist; puudega lapse puhul võib teenus hõlmata ka hooldustoimingutes abistamist.

Täpsem teenuse sisu ja tegevused võivad olla täpsustatud valdkonna eest vastutava ministri määrusega.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 23 Tugiisikuteenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Ge8023f321b236a43

Sotsiaalhoolekande seaduse § 23 „Tugiisikuteenuse eesmärk ja sisu“ ütleb, et tugiisikuteenus on kohaliku omavalitsuse korraldatav sotsiaalteenus, mille eesmärk on toetada inimese iseseisvat toimetulekut siis, kui ta vajab sotsiaalsete, majanduslike, psühholoogiliste või tervislike probleemide tõttu oma kohustuste täitmisel ja õiguste teostamisel olulisel määral kõrvalabi.

Paragrahv täpsustab ka, et kõrvalabi tähendab juhendamist, motiveerimist ning inimese suurema iseseisvuse ja vastutuse võime arendamist.

Lisaks sätestab § 23:
- last kasvatavale isikule on teenuse eesmärk toetada lapse hooldamist ning turvalise ja toetava kasvukeskkonna tagamist;
- lapsele teenuse osutamisel on eesmärk lapse arengu toetamine koostöös last kasvatava isikuga, vajadusel ka puudega lapse hooldustoimingutes abistamine;
- tugiisik aitab last arendavates tegevustes, juhendab ja motiveerib igapäevaelus toime tulema ning toetab suhtlemisel perekonnaga või väljaspool kodu.

Kui soovid, saan selle sama paragrahvi ka lihtsas keeles lahti seletada.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 23 Tugiisikuteenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 8. ajakiri_overview_lastekaitse

**Küsimus:** Mis on murekohad lastekaitses?

**Ülesandespetsiifilised ootused:**

```json
{
  "mode": "overview_synthesis",
  "evidence_package": true,
  "displayed_min": 3,
  "answer_must_include": [
    "lastekaitse"
  ]
}
```

### Vastus A — G8a729a096bab2f57

Lastekaitse murekohad on selles valdkonnas eelkõige seotud sellega, et abivajavat last tuleb märgata, hinnata ja aidata kiiresti, aga töökorraldus ja ressursid ei toeta seda alati piisavalt.

Peamised murekohad, mida valitud allikad esile toovad, on need:

1. Töökorralduse ebaühtlus KOV-ides  
Erinevates kohalikes omavalitsustes on lastekaitsetöö korraldus ja kvaliteet ebaühtlane. See tähendab, et lapse abivajaduse hindamine, juhtumite käsitlemine ja teenuste pakkumine võivad piirkonniti väga erineda.

2. Liiga suur koormus ja keerukamad juhtumid  
Spetsialistid puutuvad järjest sagedamini kokku keeruliste, mitme probleemiga juhtumitega. See teeb töö ajamahukaks ja nõuab rohkem pädevusi kui tavapärane juhtumitöö.

3. Võrgustikutöö sõltuvus teiste asutuste vastustest  
Lastekaitse otsused vajavad sageli infot koolilt, perearstilt, psühhiaatrilt või teistelt võrgustikuliikmetelt. Kui vastused venivad, pidurdab see juhtumi dokumenteerimist ja otsustamist.

4. Ajakriitiline dokumenteerimine  
Lastekaitseseaduse järgi tuleb juhtumimenetluse algatamise või mittealgatamise otsus teha 10 päeva jooksul. Praktikas teeb see tähtaja pingeliseks, eriti kui samal ajal tuleb koguda palju infot ja suhelda võrgustikuga.

5. Spetsialistide võimestamise vajadus  
Üks valitud allikas rõhutab, et praegune korraldus ei anna piisavalt lahendusi lastekaitsetöötajate võimestamiseks ega kvaliteedi ühtlustamiseks.

6. Teenuste arendamise keerukus  
Murekohtadena nimetatakse nii ennetavate kui sihitatud teenuste arendamist ja osutamist. Ehk probleem ei ole ainult juhtumi lahendamises, vaid ka selles, kas perel ja lapsel on üldse sobivad tugiteenused olemas.

Üldisemalt: lastekaitse suurim pingekoht on tasakaal märkamise, hindamise, dokumenteerimise, võrgustikutöö ja tegeliku abistamise vahel. Kui töökoormus, koostöö ja kohaliku tasandi korraldus ei püsi samas tempos, kannatab nii menetluse kiirus kui ka abi sisuline kvaliteet.

Kui soovid, võin järgmises vastuses panna need murekohad ka kaheks plokiks: “süsteemsed probleemid” ja “igapäevatöö probleemid”.

Kuvatud allikad:

- Sotsiaalministeerium otsib koos partneritega võimalusi laste heaolu suurendamiseks, lk 10-14
- Hea töö ei sünni Excelis – lastekaitsetöötajad ootavad järelevalvelt selgust ja tuge, lk 4-5, 7-8
- Distantsõppe korraldus HEV-õpilastele Keila Koolis, lk 49-53
- Juhend: abivajavast lapsest teatamine ja andmekaitse — https://www.oiguskantsler.ee/sites/default/files/JUHEND%20-%20abivajavast%20lapsest%20teatamine%20ja%20andmekaitse%20%28jaanuar%202021%29.pdf, lk 7

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G7e3afbece1bb7ff2

Valitud materjalide põhjal on lastekaitses peamised murekohad järgmised:

1. Töö korralduse ja kvaliteedi ebaühtlus

Lastekaitsetöö sõltub palju kohaliku omavalitsuse suurusest, võimekusest ja korraldusest. See võib põhjustada erinevusi nii tööpraktikates, spetsialistide koormuses kui ka selles, milliseid teenuseid lapsele ja perele tegelikult pakkuda saab. Probleemina on esile toodud ka vajadust lastekaitsetöötajaid rohkem võimestada ning parandada keerukate juhtumite lahendamise tuge.

2. Juhtumite keerukuse kasv ja spetsialistide toe puudulikkus

Spetsialistide hinnangul jõuavad lastekaitsesse üha keerulisemate probleemidega lapsed ja pered. Keerukamad juhtumid nõuavad rohkem aega, eriteadmisi ja eri valdkondade koostööd, kuid kõigil omavalitsustel ei pruugi olla piisavalt spetsialiste või võimalust kaasata vajalikku tuge. Ühe võimaliku lahendusena on arutatud suuremat riiklikku tuge keerukamate juhtumite korral ning tiimipõhisemat või piirkondlikku töökorraldust.

3. Ennetavate ja sihitatud teenuste vähesus või ebaühtlane kättesaadavus

Murekoht ei ole ainult reageerimine juba tekkinud probleemidele, vaid ka ennetavate teenuste arendamine ja kättesaadavus. Samuti võib puudu jääda konkreetse lapse või pere vajadustele sobivatest sihitatud teenustest. Lastekaitsetöötaja saab abivajadust hinnata ja abi korraldada, kuid teenuse olemasolu ning praktiline kättesaadavus sõltub sageli KOV-i võimalustest ja koostööpartneritest.

4. Võrgustikutöö ja info liikumise aeglus

Lapse abivajaduse hindamine eeldab tervikpilti lapse emotsionaalsest, sotsiaalsest, hariduslikust, majanduslikust ja tervislikust olukorrast ning vanemlikest oskustest. Selleks on vaja infot näiteks koolilt, perearstilt, psühhiaatrilt või tugiisikult. Kui vastused ja vajalikud andmed viibivad, võib see takistada nii hindamist, dokumenteerimist kui ka põhjendatud otsuse tegemist.

5. Suur dokumenteerimis- ja menetluskoormus

Lastekaitsetöötajad peavad lisaks vahetule tööle lapse ja perega dokumenteerima vestlused, kohtumised, päringud ja muud toimingud. 2025. aasta käsitluses toodi esile, et dokumenteerimiskohustus võib vähendada aega, mida spetsialist saab kasutada sisuliseks tööks. Samuti peab lastekaitsetöötaja lastekaitseseaduse kohaselt otsustama kümne päeva jooksul, kas juhtumimenetlus algatada või mitte, kuigi vajaliku info kogumine ei pruugi selle aja jooksul olla spetsialisti kontrolli all.

6. Lapse ja pere kaasamise keerukus

Abivajaduse hindamisel tuleb arvestada lapse enda seisukohta ning kaasata last kasvatav isik ja vajaduse korral lapsega seotud asutus. Praktikas võib olla keeruline saada eri osapooltelt piisavalt usaldusväärset infot, tasakaalustada lapse huve vanemate vaadetega ning teha otsus olukorras, kus andmed on puudulikud või osalised.

7. Riigi ja KOV-i rollijaotus

Lastekaitse põhikorraldus on seotud kohaliku omavalitsusega, kuid keerukamate juhtumite puhul võib vaja olla tugevamat riiklikku tuge. Valdkonnas on arutatud, kas suurendada Sotsiaalkindlustusameti rolli või koondada laste heaolu korraldust piirkondlikesse keskustesse. Need on korralduslikud arutelud, mitte kirjeldus ühest praegu kehtivast ühtsest mudelist.

Kokkuvõttes on keskne probleem tasakaalu leidmine: lastekaitsetöötajalt oodatakse põhjalikku lapse abivajaduse hindamist, kiiret otsustamist ja tihedat võrgustikutööd, kuid samal ajal võivad teda piirata suur menetluskoormus, aeglane infovahetus, ebaühtlane teenuste kättesaadavus ja vähene tugi keerukate juhtumite korral. Valitud allikabaas on üsna kitsas ja kirjeldab eelkõige korralduslikke ning tööpraktilisi murekohti, mitte kogu lastekaitse olukorda Eestis.

Kuvatud allikad:

- Sotsiaalministeerium otsib koos partneritega võimalusi laste heaolu suurendamiseks, lk 10-14
- Hea töö ei sünni Excelis – lastekaitsetöötajad ootavad järelevalvelt selgust ja tuge, lk 4-5, 7-8
- Distantsõppe korraldus HEV-õpilastele Keila Koolis, lk 49-53
- Juhend: abivajavast lapsest teatamine ja andmekaitse — https://www.oiguskantsler.ee/sites/default/files/JUHEND%20-%20abivajavast%20lapsest%20teatamine%20ja%20andmekaitse%20%28jaanuar%202021%29.pdf, lk 7

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 9. ajakiri_overview_omastehooldus

**Küsimus:** Mis raskused on omastehooldajatel?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 2,
  "answer_must_include": [
    "hoold"
  ]
}
```

### Vastus A — Gaa0c80648846b2e8

Omastehooldajate raskused on peamiselt seotud järgmiste valdkondadega:

- Igapäevane hooldamine: abi võib olla vaja pesemisel, tualeti kasutamisel, söömisel, voodist tõusmisel ja liikumisel. Eriti keeruline on inimese tõstmine ja hooldamine, kui hooldatav on suure kaaluga või vähese liikumisvõimega.
- Elukorraldus ja eluruumid: raskusi tekitavad trepid, transport, kütmine ning väikese või kohandamata eluruumi korraldamine ratastoolikasutajale. Vajalik hooldustehnika, näiteks pesemisel abivahendid, ei pruugi olla kättesaadav või sobituda koju.
- Töö ja majandus: hooldus võib sundida pereliiget töölt lahkuma või töötamist vähendama. Sellega võivad kaasneda sissetuleku vähenemine, majandusliku toimetuleku raskused ja hilisem keeruline tööturule naasmine. Hooldusteenuse tasu võib mõjutada pere valikuid, eriti kui eeldatakse, et pereliikmed korraldavad hoolduse ise.
- Vastutuse ja abi korraldamine: hooldaja peab sageli ise koordineerima teenuseid, transporti, abivahendeid ja igapäevast hooldust. Hooldatava ja hooldaja hinnang inimese tegelikule abivajadusele võivad ka erineda, mistõttu ei pruugi abi vajadus alati kohe õigesti nähtav olla.
- Hoolduse lõppemine: hooldatava surm tähendab hooldaja jaoks suure elukorralduse muutust. Pärast hooldusperioodi lõppu võivad tekkida küsimused sissetuleku, tööle naasmise ja uue eluviisiga kohanemise kohta.

KOV-i vaates tähendab see, et omastehooldaja olukorda tuleks hinnata koos hooldatava abivajadusega ning regulaarselt üle vaadata, kas koduteenus, abivahendid, transport või muu tugi on endiselt piisav. Valitud allikad käsitlevad eelkõige praktilisi ja majanduslikke raskusi; omastehooldajate vaimse koormuse kohta need allikad piisavalt täpset ülevaadet ei anna.

Kuvatud allikad:

- Omastehooldus. Perekonna ja ühiskonna liit?, lk 58-67
- Koduteenuste korraldus — https://www.riigikontroll.ee/sites/default/files/documents/2025-11/19294_RKTR_6564_2-1.4_2312_002-2.pdf, lk 14, 42
- SKA ja KOVid – lõppraport — https://centar.ee/pdf/ee/2023_SKA%20ja%20KOVid_Loppraport_avaldamiseks.pdf, lk 10
- Lapsendamise ja hooldusperre paigutamise järgne hindamine / lõpparuanne — https://www.praxis.ee/uploads/2020/12/Lo%CC%83pparuanne_20.11.20.pdf, lk 67

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G11729a4d9b50012a

Omastehooldajate peamised raskused on seotud nii igapäevase hoolduskoormuse kui ka oma elu korraldamisega.

Olulisemad mured, mida allikad esile toovad:
- füüsiliselt rasked tegevused, näiteks inimese tõstmine, pesemine, treppidel liikumine ja transport;
- kodune keskkond, kus hooldatava vajadusi on raske turvaliselt ja mugavalt toetada, eriti kui eluruum on väike või kohandusi teha ei saa;
- hooldustehnika ja olme korraldamine, sealhulgas kütmine, ruumide kohandamine ja ratastooliga inimese igapäevane toimetamine;
- ajakasutus ja elukorralduse muutumine, mis võib viia töölt eemaldumiseni või töötamise vähenemiseni;
- sellest tulenevad majanduslikud probleemid ja raskused hiljem tööturule naasmisel;
- hoolduse lõppemisega seotud keeruline olukord, eriti kui hooldatav sureb.

Lisaks näitavad allikad, et hooldusvajaduse tase ei ole alati üheselt hinnatav: hooldajad ja hooldatavad kirjeldavad sageli olukorda erinevalt. Näiteks mõnes igapäevatoimingus hindavad hooldajad hooldatava iseseisvust suuremaks kui hooldatavad ise, mis teeb abivajaduse täpse tajumise ja toetuse kavandamise keerulisemaks.

Kui soovid, saan järgmise sammuna koondada need raskused ka rühmadena: füüsilised, vaimsed, majanduslikud ja teenuste korraldusega seotud.

Kuvatud allikad:

- Omastehooldus. Perekonna ja ühiskonna liit?, lk 58-67
- Koduteenuste korraldus — https://www.riigikontroll.ee/sites/default/files/documents/2025-11/19294_RKTR_6564_2-1.4_2312_002-2.pdf, lk 14, 42
- Lapsendamise ja hooldusperre paigutamise järgne hindamine / lõpparuanne — https://www.praxis.ee/uploads/2020/12/Lo%CC%83pparuanne_20.11.20.pdf, lk 67
- SKA ja KOVid – lõppraport — https://centar.ee/pdf/ee/2023_SKA%20ja%20KOVid_Loppraport_avaldamiseks.pdf, lk 10

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 10. ajakiri_ai_eetika

**Küsimus:** Kas tehisintellektiga seotud eetilised küsimused on sotsiaalvaldkonnas oluline teema?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "displayed_must_include": [
    "tehisintellekt"
  ],
  "answer_must_include_any": [
    "eetili",
    "eetika",
    "väärtus",
    "vastutus"
  ]
}
```

### Vastus A — G98b2627a74287ea0

Jah, tehisintellektiga seotud eetilised küsimused on sotsiaalvaldkonnas oluline teema, sest tehnoloogia mõjutab otseselt inimeste heaolu, autonoomiat, privaatsust ja õiglast kohtlemist.

Sotsiaaltöös on eriti tähtsad:

- inimkeskne ja kontekstitundlik kasutamine – sama lahendus ei pruugi sobida kõigile inimestele ega olukordadele;
- kasutaja autonoomia – tehisintellekt peaks toetama inimese iseseisvat toimetulekut, mitte tema eest põhjendamatult otsustama;
- läbipaistvus ja vastutus – peab olema arusaadav, kuidas süsteemi kasutatakse ja kes vastutab selle mõju eest;
- õiglus – tehnoloogia ei tohiks suurendada ebavõrdsust ega kohelda mõnda rühma ebasoodsamalt;
- usaldus ja suhtluse kvaliteet – eriti emotsionaalset tuge pakkuvate virtuaalsete või füüsiliste süsteemide puhul mõjutavad usaldust ka suhtlusstiil, hääl ja käitumine.

Sotsiaalvaldkonnas ei ole küsimus ainult selles, mida tehisintellekt suudab teha, vaid ka selles, kelle jaoks ja milliste väärtuste nimel seda kasutatakse. Tehisintellekt võib toetada sotsiaaltööd, kuid see ei asenda professionaalset kaalutlust, inimese ärakuulamist ega vastutustundlikku otsustamist.

Kuvatud allikad:

- Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid — https://www.tai.ee/et/sotsiaaltoo/tehisintellekt-sotsiaaltoos-praktika-kaalutlused-ja-vaartuspohised-piirid, lk 1-13

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Gb20d1e71070c875c

Jah, tehisintellektiga seotud eetilised küsimused on sotsiaalvaldkonnas oluline teema.

See puudutab eelkõige seda, kuidas tehnoloogia toetab või mõjutab inimese autonoomiat, privaatsust, väärikust ja osalust otsustes. Sotsiaalvaldkonnas ei ole küsimus ainult selles, kas tööriist töötab, vaid ka selles, kelle jaoks see töötab ja milliste väärtuste järgi see tegutseb.

Oluliseks on peetud ka seda, et:
- tehnoloogia oleks inimkeskne ja kontekstitundlik;
- kasutaja iseseisvust toetataks, mitte ei asendataks;
- sotsiaalset isolatsiooni ei suurendataks, vaid pigem vähendataks;
- lahendused oleksid läbipaistvad ja õiglaselt kasutatavad.

Kui soovid, võin tuua ka konkreetseid näiteid, millistes sotsiaalvaldkonna tööolukordades need eetilised küsimused kõige rohkem esile tulevad.

Kuvatud allikad:

- Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid — https://www.tai.ee/et/sotsiaaltoo/tehisintellekt-sotsiaaltoos-praktika-kaalutlused-ja-vaartuspohised-piirid, lk 1-13

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 11. ajakiri_sloveenia_hooldus

**Küsimus:** Mida kirjutab ajakiri Sotsiaaltöö pikaajalisest hooldusest Sloveenias?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "displayed_must_include": [
    "sloveenia"
  ],
  "answer_must_include": [
    "sloveenia"
  ]
}
```

### Vastus A — Gfd0c50710cec99e5

Ajakirja Sotsiaaltöö 1/2021 artiklis „Pikaajaline hooldus Sloveenias: probleemid ja tulevikusuunad“ käsitletakse Sloveenia pikaajalise hoolduse korraldust, selle kitsaskohti ja liikumist kogukonnapõhisema hoolduse poole.

Põhisõnumid on järgmised:

- Eesmärk peaks olema võimaldada inimesel elada võimalikult kaua oma kodus ja tuttavas keskkonnas.
- Koduhooldus ei tähenda ainult isiklikku abistamist, näiteks riietumisel, pesemisel, söömisel või abivahendite kasutamisel. See hõlmab ka koduabi, nagu toidu valmistamine ja koju toomine, nõude pesemine ning koristamine.
- Sloveenias võib hooldekodu olla sageli ainus kogukonnas kättesaadav hooldusvorm, kuid kohti ei pruugi kohe saada.
- Kui inimese kodust toimetulekut piisavalt ei toetata, võib ta lõpuks olla sunnitud hooldekodusse minema, kuigi kodune ja kogukonnapõhine abi võiks seda edasi lükata või vältida.
- Artiklis tuuakse esile vajadus paremini siduda koduhoolduse pakkujad, hooldekodud, teenusmajad, haiglad ja teised eakate hooldusega seotud asutused.
- Hooldekodude töötajate kogemuse põhjal on oluline, et kodus elamist toetavad teenused oleksid tegelikult kättesaadavad ja toimiksid enne hooldekodusse suunamist.

Artikkel seostub laiemalt deinstitutsionaliseerimise mõttega: hooldus ei peaks keskenduma üksnes asutusekohale, vaid inimese vajadustele, kodusele abile ja kogukonna teenustele. Tegemist on 2021. aastal avaldatud käsitlusega Sloveenia olukorrast; see ei ole tänapäevase Sloveenia hooldussüsteemi täielik ülevaade.

Kuvatud allikad:

- Pikaajaline hooldus Sloveenias: probleemid ja tulevikusuunad — https://www.tai.ee/et/valjaanded/ajakiri-sotsiaaltoo/sotsiaaltoeoe-2021-1/pikaajaline-hooldus-sloveenias-probleemid-ja-tulevikusuunad, lk 70-77
- Tegevustest pikaajalise hoolduse vallas, lk 13-15
- Kuidas algas ajakirja Sotsiaaltöö teekond?, lk 10-12
- Pikaajalise hoolduse praegused probleemid ja võimalikud lahendused, lk 12-14
- Pikaajaline hooldus seisab muutuste lävel, lk 16-20

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Gbb2b36873062cac9

Ajakirja Sotsiaaltöö 2021. aasta artiklis käsitletakse Sloveenia pikaajalise hoolduse korraldust ja selle kitsaskohti ning vaadatakse tulevikusuundadele. Fookuses on see, kuidas toetada inimest nii, et ta saaks võimalikult kaua koduses keskkonnas elada.

Peamised punktid, millele selles artiklis rõhutatakse:
- koduhooldus ja muud kodus elamist toetavad teenused on väga olulised;
- hooldekodu ei ole alati kohe kättesaadav ja sageli nähakse seda kogukonnas ainuvõimaliku hooldusvormina;
- hooldus peaks olema paremini lõimitud sotsiaal- ja tervishoiu vahel;
- oluline on arendada kogukonnapõhiseid teenuseid, et toetada nii hooldusvajadusega inimest kui ka hoolduskoormusega lähedasi;
- rõhutatakse ka kohalike omavalitsuste rolli teenuste arendamisel ja pakkumisel.

Kui soovid, saan selle sama artikli põhjal teha ka lühikese 3–5 lauselise kokkuvõtte või tuua välja ainult koduhoolduse ja hooldekodu osa.

Kuvatud allikad:

- Pikaajaline hooldus Sloveenias: probleemid ja tulevikusuunad — https://www.tai.ee/et/valjaanded/ajakiri-sotsiaaltoo/sotsiaaltoeoe-2021-1/pikaajaline-hooldus-sloveenias-probleemid-ja-tulevikusuunad, lk 70-77
- Tegevustest pikaajalise hoolduse vallas, lk 13-15
- Pikaajalise hoolduse praegused probleemid ja võimalikud lahendused, lk 12-14
- Kuidas algas ajakirja Sotsiaaltöö teekond?, lk 10-12
- Pikaajaline hooldus seisab muutuste lävel, lk 16-20

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 12. pdf_hea_tava_terviseprobleemiga_laps

**Küsimus:** Kuidas toetada terviseprobleemiga lapse peret?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "displayed_must_include": [
    "terviseprobleemiga"
  ],
  "answer_must_include": [
    "pere"
  ]
}
```

### Vastus A — G5a155dade040577a

Terviseprobleemiga lapse pere toetamine tähendab korraga lapse heaolu, vanema toimetuleku ja kogu pere igapäevaelu märkamist. Oluline on pakkuda tuge järjepidevalt, mitte ainult kriisi ajal.

1. Alusta pere vajaduste ja tugevuste mõistmisest

- Kuula vanemat hinnanguvabalt ning tunnusta tema kogemust.
- Uuri, millised on lapse ja pere kõige kiireloomulisemad vajadused: tervis, uni, hooldus, transport, majanduslik toimetulek, suhted, haridus või lastehoid.
- Arvesta, et lapsevanem võib olla aastaid kestnud leina-, kohanemis- ja hakkamasaamise protsessis.
- Ära eelda, et pere vajab üksnes lapsega seotud abi – sageli vajab tuge ka vanema vaimne ja füüsiline tervis.

2. Toeta vanema hooldusvõimet

Terviseprobleemiga lapse vanem on sageli lapse peamine hooldaja ja igapäevane tugi. Vanema toetamine aitab seega otseselt kaasa ka lapse kodus elamisele ja heaolule.

Praktiliselt võib see tähendada:

- vanema ärakuulamist ja emotsionaalset tuge;
- abi teenuste ning spetsialistide leidmisel ja koordineerimisel;
- võimalust saada puhkust või hoolduskoormuse leevendust;
- tähelepanu unevõlale, läbipõlemise ohule ja vanema enda tervisemuredele;
- pere kaasamist otsustesse, mitte nende eest otsustamist.

3. Vähenda asjaajamise ja süsteemide koormust

Pidevad taotlused, hindamised, arstivisiidid ja erinevate asutustega suhtlemine võivad peret tugevalt kurnata. Spetsialist saab aidata:

- koondada pere jaoks olulise info arusaadavaks tegevusplaaniks;
- selgitada, millise küsimusega pöörduda tervishoiu-, haridus- või sotsiaalvaldkonda;
- vältida sama info korduvat küsimist, kui see on võimalik;
- korraldada eri spetsialistide koostööd;
- kontrollida, et pere ei jääks teenuste vahel ise vastutajaks ja koordinaatoriks.

Kohalikul tasandil tuleks hinnata, millist abi saab korraldada omavalitsus, näiteks pere nõustamist, hoolduskoormuse leevendamist või muid sotsiaalteenuseid. Täpne abi sõltub lapse ja pere vajadustest ning omavalitsuse korraldusest.

4. Märka lapse ja pere turvalisust

Toetav suhtumine ei tähenda probleemide eiramist. Spetsialist peab oskama märgata, kui lapsel ei ole kodus turvaline olla või kui vanema koormus on kasvanud nii suureks, et lapse vajadused võivad jääda katmata. Sellisel juhul tuleb tegutseda lapse heaolu ja turvalisuse nimel ning kaasata vajalikud lastekaitse-, sotsiaal- või tervishoiuspetsialistid.

5. Paku abi võimalikult vara ja järjepidevalt

Tugi on tulemuslikum, kui pere jõuab abini enne kriisi süvenemist. Sobivad võivad olla:

- regulaarsed kontaktid ühe kindla spetsialistiga;
- koduvisiidid, mille käigus hinnatakse pere tegelikku igapäevast toimetulekut;
- abi lapse arengu ja suhtlemise toetamisel;
- info sotsiaal- ja tervishoiuteenuste kohta;
- vanemate tugigrupid või kogukondlikud tegevused, mis vähendavad üksijäämist.

Koduvisiitide või muu regulaarse kontakti puhul ei peaks keskenduma ainult lapse diagnoosile, vaid ka sellele, kuidas pere tegelikult magab, puhkab, liigub, suhtleb ja igapäevaseid toiminguid korraldab.

6. Hoia koostööd valdkondade vahel

Lapse pere jaoks peaks abi moodustama terviku:

- tervishoid tegeleb lapse ravivajaduse ja tervise jälgimisega;
- haridusasutus toetab lapse arengut, õppimist ja osalemist;
- kohaliku omavalitsuse sotsiaal- ja lastekaitsetöö hindab pere sotsiaalset toimetulekut, turvalisust ja teenusevajadust;
- perega töötav võtmespetsialist aitab kokkuleppeid siduda ja perele arusaadavaks teha.

2025. aasta hea tava rõhutab, et lapsevanemat tuleb toetada kui lapse peamist hooldajat, samal ajal säilitades tähelepanu lapse turvalisusele. Varasemad käsitlused lisavad, et koduvisiidid ja vanematele suunatud ühistegevused võivad vähendada üksijäämist ning aidata perel leida sobivaid sotsiaal- ja tervishoiuteenuseid.

Valitud materjalid annavad eelkõige üldised põhimõtted; konkreetsete teenuste, toetuste ja vastutava asutuse määramiseks on vaja teada lapse elukoha omavalitsust ning pere täpsemat olukorda.

Kuvatud allikad:

- Terviseprobleemiga laste ja nende perede toetamise hea tava, lk 3, 11, 16-17, 34-37, 43, 48, 52, 56, 58-59, 61
- Sotsiaalministeerium otsib koos partneritega võimalusi laste heaolu suurendamiseks, lk 10-14
- Riiklik perelepitusteenus, lk 16-22
- Pandeemia mõju laste vaimsele tervisele ja kuidas neid toetada. 1. osa, lk 70-76

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G9ed79ff47747d28b

Terviseprobleemiga lapse peret toetatakse kõige paremini nii, et abi ei keskendu ainult lapse diagnoosile, vaid kogu pere igapäevasele toimetulekule. Uuem juhendmaterjal rõhutab eriti, et lapsevanem on sageli lapse peamine hooldaja ja tugi ning tema vaimne ja füüsiline heaolu mõjutab otseselt ka lapse kodus elamise võimalust, turvalisust ja heaolu. Vanem võib olla pikalt väga haavatavas olukorras, sest hooldus, öised ärkamised, bürokraatia ja pidev ärevus kurnavad tugevalt.

Praktiliselt tähendab see tavaliselt nelja asja.

1. Toeta vanemat kui peamist hooldajat
Kuula hinnanguid andmata, tunnusta koormust ja aita vanemal sõnastada, mis on kõige raskem: hooldus, uni, töö, transport, õed-vennad, rahaline surve või suhtlus ametiasutustega. Väga oluline on mitte vähendada muret ega eeldada, et vanem “saab ise hakkama”.

2. Märka pere tervikvajadust, mitte ainult lapse sümptomit
Kui lapse tervisemure on püsiv või keeruline, mõjutab see sageli kogu pere toimimist: töö- ja hoolduskoormust, vaimset tervist, suhteid ja igapäevast logistikat. Hea tava järgi tuleb tähele panna ka seda, kas kodune olukord on turvaline, millist lisaabi pere vajab ja kas abi puudumine võib viia kriisini.

3. Aita luua ühendus sobivate teenustega
Terviseprobleemiga laste perede puhul on sageli vaja siduda kokku tervishoid, sotsiaalhoolekanne ja haridus/hoolekanne. Praktikas tähendab see pere suunamist või kaasamist vajadusel näiteks:
- sotsiaaltöötaja või lastekaitsetöötaja juurde
- rehabilitatsiooni ja toetavate teenuste juurde
- vaimse tervise toe juurde vanemale või lapsele
- kohaliku omavalitsuse teenuste juurde, kui vaja on kodust abi, transporti, hoolekande tuge või hoolduskoormuse leevendamist

4. Toeta vanema taastumist ja hingamisruumi
Juhendmaterjal rõhutab, et vanema hea tervis on lapse heaolu seisukohalt ülioluline. Seetõttu on oluline vaadata, kas perel on võimalus puhata, saada asendustuge, kasutada kogukonna abi või leida praktilisi lahendusi, mis vähendavad pidevat koormust. Mõnikord on kõige tõhusam abi väga konkreetne: aitamine suhtluses ametitega, info koondamine ühte kohta või perele sobiva kontaktisiku leidmine.

Kui tahad, saan selle sama teema lahti kirjutada ka sotsiaaltöötaja töövõtete kaupa: mida öelda esimesel kohtumisel, mida hinnata ja millal pere edasi suunata.

Kuvatud allikad:

- Terviseprobleemiga laste ja nende perede toetamise hea tava, lk 3, 11, 16-17, 34-37, 43, 48, 52, 56, 58-59, 61
- Riiklik perelepitusteenus, lk 16-22
- Sotsiaalministeerium otsib koos partneritega võimalusi laste heaolu suurendamiseks, lk 10-14
- Pandeemia mõju laste vaimsele tervisele ja kuidas neid toetada. 1. osa, lk 70-76

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 13. pdf_eestkoste_uuring

**Küsimus:** Millised on psüühikahäirega inimeste eestkoste peamised kitsaskohad?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "displayed_must_include": [
    "eestkoste"
  ],
  "answer_must_include": [
    "eestkoste"
  ]
}
```

### Vastus A — G8d17e268c2898143

Psüühikahäirega inimeste eestkoste peamised kitsaskohad on valitud uuringute põhjal järgmised:

- Eestkoste kohta puudub piisavalt järjepidev avalik statistika. Puudulikult on teada eestkoste seadmiste arv, eestkoste ulatus ja kestus, eestkostjate taust ning see, kui paljud eestkostetavad on tunnistatud valimisõiguse teostamisel teovõimetuks. See raskendab sihtrühma olukorra hindamist ja süsteemsete muudatuste kavandamist.

- Eestkoste võib liiga kergesti asendada inimese toetamise tema enda otsuste tegemisel. Uuringutes rõhutatakse vajadust toetada inimese iseseisvat otsustusõigust ning vältida olukorda, kus eestkoste ulatus on laiem kui inimese tegelik abivajadus.

- Eestkoste vajadust ja ulatust ei pruugita piisavalt individuaalselt hinnata. Psüühikahäire diagnoos iseenesest ei kirjelda veel seda, millistes konkreetsetes küsimustes inimene abi vajab. Oluline on hinnata inimese tegelikku toimetulekut, otsustusvõimet ja olemasolevaid tugivõimalusi valdkondade kaupa.

- Abi- ja teenustesüsteem on killustunud. Eestkostetav, eestkostja või lähedased peavad sageli ise korraldama suhtlust kohaliku omavalitsuse, tervishoiu-, rehabilitatsiooni- ja teiste teenuste vahel. Juhtumikorraldus ei ole alati järjepidev ning eri osapoolte koostöö võib olla ebapiisav.

- Vastutus abi korraldamise eest langeb sageli inimesele või tema lähedastele. See võib olla eriti koormav siis, kui eestkostjal puuduvad teadmised psüühikahäire, sotsiaalteenuste või inimese õiguste kohta või kui eestkostja on ise eakas või väheste tugivõimalustega.

- Inimestel ja nende lähedastel ei ole alati piisavalt arusaadavat teavet oma õiguste ja abivõimaluste kohta. Keeruline süsteem, ebaühtlane infoliikumine ja korduv asjaajamine võivad vähendada inimese võimalust oma eestkostet ja teenuseid sisuliselt mõjutada.

Kokkuvõttes ei seisne probleem ainult eestkostja määramises, vaid selles, kas eestkoste on proportsionaalne, inimese vajadustest lähtuv ja tema õigusi toetav. Eestkoste peaks olema üks osa laiemast tugikorraldusest, kuhu kuuluvad vajadusel juhtumikorraldus, kohandatud suhtlus, sotsiaalteenused ja toetatud otsustamise võimalused. Valitud allikabaas on siiski suhteliselt kitsas ning see kirjeldab eeskätt süsteemseid kitsaskohti, mitte kõigi eestkostejuhtumite õiguslikku tulemust.

Kuvatud allikad:

- Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte, lk 3, 7, 10, 16, 18-19, 32-33, 35, 38-39, 41, 44-45, 48-49, 51, 63, 65, 69, 71-72
- Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu lühikokkuvõte, lk 2-3
- Kuidas MTÜ Ambla Kihelkonna Tugiteenused oma kliente toetab, lk 37-39
- Inimeste teadlikkus vaimse tervise säilitamisest ja psüühikahäiretest, lk 50-52

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G71eaa37019362ebc

Psüühikahäirega inimeste eestkoste peamised kitsaskohad on eelkõige seotud sellega, et süsteem ei toeta piisavalt inimese iseseisvat otsustusõigust ega anna alati vajaduspõhist abi.

Peamised probleemid on järgmised:

- Teenused on killustunud. Abi korraldamine langeb sageli inimese enda või tema lähedaste õlule ning juhtumikorraldus ei ole järjepidev.
- Koostöö eri osapoolte vahel on ebapiisav. Teenuseosutajate, ametkondade ja lähedaste vahel ei liigu info sujuvalt.
- Süsteemis on raske orienteeruda. Inimestel ja lähedastel on keeruline mõista, millist abi ja kust saab.
- Õiguste ja abivõimaluste teadlikkus on ebaühtlane. See teeb keerulisemaks nii abi küsimise kui ka oma õiguste kaitsmise.
- Teenused ei ole piisavalt inimese vajadustest lähtuvad. Süsteem on pigem üles ehitatud teenuste kaupa, mitte inimese tegeliku olukorra järgi.
- Abi on sageli liiga reaktsiooniline. Uuringud rõhutavad, et tugi tuleb sageli alles tagajärgedega tegelemisena, mitte varase märkamisena.
- Bürokratia on keeruline. Vajadus on lihtsama asjaajamise, arusaadava suhtluse ja dubleerivate hindamiste vähendamise järele.
- Puudub piisav järjepidev statistika eestkoste kohta. Üks rõhutatud kitsaskoht on see, et eestkoste seadmise, ulatuse, tähtaja ja eestkostjate kohta ei koguta ega avaldata piisavalt järjepidevalt andmeid, mistõttu on keeruline olukorda hinnata ja arendusi planeerida.

Oluline üldine suund, mida uurimused rõhutavad, on see, et eestkoste ja tugisüsteem peaks paremini toetama inimese iseseisvat otsustusõigust ning olema varasem, paindlikum ja arusaadavam.

Kui soovid, saan järgmise sammuna koondada need kitsaskohad ka üheks lühikeseks punktloendiks, mida saab kasutada näiteks ettekandes või analüüsis.

Kuvatud allikad:

- Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte, lk 3, 7, 10, 16, 18-19, 32-33, 35, 38-39, 41, 44-45, 48-49, 51, 63, 65, 69-72
- Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu lühikokkuvõte, lk 2-3
- Kuidas MTÜ Ambla Kihelkonna Tugiteenused oma kliente toetab, lk 37-39
- Inimeste teadlikkus vaimse tervise säilitamisest ja psüühikahäiretest, lk 50-52

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 14. pdf_vaimne_tervis_koolis

**Küsimus:** Mis materjale on laste vaimse tervise kohta koolis?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "displayed_must_include": [
    "vaimne tervis"
  ]
}
```

### Vastus A — Gd1cff8659019bfb3

Koolis laste ja noorte vaimse tervise toetamiseks on järgmised materjalid:

1. „Koolilaste ja noorte vaimne tervis“

Praktiline koondmaterjal õpetajatele. See käsitleb:

- milliseid muutusi lapse käitumises ja heaolus märgata;
- mida õpetaja saab teha õpilase mure märkamisel;
- kuidas lapsega, kolleegi ja lapsevanemaga rääkida;
- kuidas toetada keskendumis- ja suhtlemisraskustega õpilast;
- kuidas toimida agressiivse käitumise korral;
- kuidas aidata pinge ja ärevusega õpilast.

Materjal sobib eelkõige õpetajatele ja teistele koolis töötavatele spetsialistidele.

2. Peaasi.ee hariduse suund ja kooli heaolu materjalid

Peaasi.ee haridusvaldkonna materjalid on suunatud kogu haridusasutusele. Eesmärk on kujundada õpi- ja töökeskkond, mis toetab laste, noorte, õpetajate ja teiste koolitöötajate vaimset tervist ning heaolu.

Need aitavad vaadata vaimset tervist mitte ainult üksiku õpilase probleemi, vaid ka koolikeskkonna, turvalisuse, suhete ja õppimise korralduse kaudu. Materjalide hulgas on ka haridusasutuste heaolu ja vaimse tervise mudel ning praktilisi tööriistu kooli igapäevatööks.

3. „Vaimse tervise hoidmine“ 4.–7. klassile

Tegemist on tunnimaterjaliga, mida saab kasutada klassijuhatajatunnis või muu õppetöö osana. Materjal sisaldab näiteks:

- tunni eesmärgi ja turvalise arutelu kokkuleppeid;
- arutelu selle üle, mille järgi märgata head vaimset tervist;
- grupitöid ja ajurünnakuid;
- soovitusi lapsevanemate kaasamiseks;
- tegevusi, mis aitavad õpilastel oma mõtteid ja tundeid märgata ning väljendada.

Oluline on, et õpetaja looks aruteluks turvalise õhkkonna: õpilasi kuulatakse, eriarvamusi väljendatakse viisakalt ning igaühel on õigus oma arvamusele.

Need materjalid toetavad eelkõige ennetust ja koolikeskkonna kujundamist. Kui õpilasel on tõsisem või püsiv vaimse tervise mure, tuleb lisaks õppematerjalidele kaasata kooli tugispetsialistid, lapsevanem ja vajaduse korral lastekaitse või tervishoiutöötaja.

Kuvatud allikad:

- Koolilaste ja noorte vaimne tervis — https://peaasi.ee/wp-content/uploads/2014/11/Laste-vaimne-tervis-koolis.pdf, lk 1, 10, 12-14
- Vaimse tervise hoidmine (4.–7. klass) — https://peaasi.ee/wp-content/uploads/2018/11/Tunnikava-4-7kl-vaimne-tervis.pdf, lk 2-4
- Peaasi.ee Haridus — https://peaasi.ee/wp-content/uploads/2023/10/Peaasi.ee-Haridus.pdf, lk 1
- Vaimse tervise probleemiga inimeste elu pärast elukohavahetust, lk 58-65
- Pagulaste vaimne tervis vajab rohkem tähelepanu, lk 86-91

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Ga58468811c597e2e

Koolis laste vaimse tervise kohta on valikus eelkõige need materjalid:

1. Peaasi.ee hariduse suund
See on riikliku tasandi vaimse tervise ja heaolu materjal haridusasutustele. Fookus on alates 2022. aastast haridusasutustel, et toetada laste ja noorte õpikeskkonda ning õpetajate ja teiste koolis töötavate inimeste töökeskkonda vaimset tervist toetavaks. Materjalid ja tööriistad on mõeldud igapäevaseks kasutamiseks haridusasutuses.

2. “Koolilaste ja noorte vaimne tervis”
See on koondmaterjal noorte vaimse tervise portaali Peaasi.ee alajaotusest NIPID. Materjal käsitleb muu hulgas:
- mida märgata lapse või noore vaimse tervise puhul,
- mida teha, kui õpilase käitumine muutub,
- kuidas rääkida lapsega, kolleegiga ja lapsevanemaga,
- kuidas toetada ärevuse, pinge, keskendumis- ja suhtlemisraskustega õpilast,
- kuidas toime tulla agressiivse käitumisega.

Materjal on koostatud MTÜ Peaasjad ja Eesti Õpetajate Liidu koostöös.

3. “Vaimse tervise hoidmine (4.–7. klass)”
See on tunnimaterjal, mis sobib vaimse tervise teema käsitlemiseks põhikooli keskmises kooliastmes. Seal on tunnikava, arutelu- ja grupitöö ülesanded ning rõhk on sellele, et õpilased õpiksid tundma hea suhtlemise tavasid, tunnete ja mõtete jagamist ning seda, kuidas vaimset heaolu märgata ja hoida.

Kui soovid, saan need materjalid ka eraldi jagada vanuse järgi:
- 1.–3. klass
- 4.–7. klass
- põhikool / gümnaasium
- õpetajale või kooli tugimeeskonnale sobivad materjalid.

Kuvatud allikad:

- Koolilaste ja noorte vaimne tervis — https://peaasi.ee/wp-content/uploads/2014/11/Laste-vaimne-tervis-koolis.pdf, lk 1, 10, 12-14
- Vaimse tervise hoidmine (4.–7. klass) — https://peaasi.ee/wp-content/uploads/2018/11/Tunnikava-4-7kl-vaimne-tervis.pdf, lk 2-4
- Peaasi.ee Haridus — https://peaasi.ee/wp-content/uploads/2023/10/Peaasi.ee-Haridus.pdf, lk 1
- Pagulaste vaimne tervis vajab rohkem tähelepanu, lk 86-91
- Vaimse tervise probleemiga inimeste elu pärast elukohavahetust, lk 58-65

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 15. pdf_tarkvanem_tooleht

**Küsimus:** Kas on abiküsimuste töölehti vestluseks algkoolilapsega?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "answer_must_include_any": [
    "tööleht",
    "abiküsimus"
  ]
}
```

### Vastus A — G9ffa7050303e1548

Jah. Olemas on tööleht „Abiküsimused vestluseks algkoolilapsega“, mis on praktiline juhend lapsevanemale ja sobib ka spetsialistile vestluse toetamiseks.

Tööleht aitab:
- alustada lapsega loomulikku vestlust;
- uurida tema rõõme, muresid, suhteid ja koolikogemust;
- kasutada avatud küsimusi, mis annavad lapsele võimaluse vabalt vastata;
- kuulata last hinnanguid andmata ning olla vestluses kohal.

Näited küsimustest:
- „Mis sulle koolis kõige rohkem meeldib?”
- „Kes on su parim sõber?”
- „Mida sulle meeldib koos minuga teha?”
- „Mis on kõige vastikum asi, mida sa mäletad?”
- „Mida sa oled alati tahtnud küsida, aga ei ole küsinud?”

Materjal on varasem, 2018. aasta praktiline juhend „Tarkvanem.ee“ kaudu. Lisaks on uuemates, 2024. ja 2026. aasta peredega töötamise materjalides rõhutatud lapsega keerulistest teemadest rääkimist, jagatud mõistmise loomist ja lapse valmisoleku arvestamist.

Kuvatud allikad:

- TÖÖLEHT: Abiküsimused vestluseks algkoolilapsega — https://tarkvanem.ee/wp-content/uploads/2018/05/Tark_Vanem_tooleht_abikysimused_vestluseks_algkoolilapsega.pdf, lk 1
- Kuressaare Hoolekanne ja selle uuendusmeelne meeskond, lk 87-90
- Räägime Lastest logiraamat tööks peredega: 5–12-aastane laps — https://peaasi.ee/wp-content/uploads/2026/02/9.-Logiraamat-spetsialistile_5%E2%80%9312-aastane-laps-TAIDETAV.pdf, lk 9, 17
- Koolilaste ja noorte vaimne tervis — https://peaasi.ee/wp-content/uploads/2014/11/Laste-vaimne-tervis-koolis.pdf, lk 4
- Räägime Lastest praktikutele: 12–18-aastaste lastega perede nõustamiseks — https://peaasi.ee/wp-content/uploads/2024/08/10.-Logiraamat-praktikutele-vanus-12-18.docx.pdf, lk 13, 15

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G324006b80555d769

Jah, on küll. Algkoolilapsega vestluseks on olemas abiküsimuste tööleht, mis on mõeldud eelkõige lapsega kontakti loomiseks ja vestluse avamiseks.

Selle mõte on kasutada avatud küsimusi, sest need aitavad lapsel end vabamalt väljendada. Näiteks sobivad sellised küsimused nagu:
- Mis sulle nalja teeb?
- Mis on sinu lemmiktegevus?
- Mis sulle ema ja isa juures kõige rohkem meeldib?
- Kes on su parim sõber?
- Kelleks sa tahad saada, kui suureks saad?

Juhise järgi on oluline pärast küsimuse esitamist lihtsalt kuulata, olla kohal ja hoiduda hinnangutest.

Kui soovid, võin need abiküsimused ka sinu jaoks lihtsalt loetavaks vestlusleheks kokku panna.

Kuvatud allikad:

- TÖÖLEHT: Abiküsimused vestluseks algkoolilapsega — https://tarkvanem.ee/wp-content/uploads/2018/05/Tark_Vanem_tooleht_abikysimused_vestluseks_algkoolilapsega.pdf, lk 1
- Kuressaare Hoolekanne ja selle uuendusmeelne meeskond, lk 87-90
- Räägime Lastest praktikutele: 12–18-aastaste lastega perede nõustamiseks — https://peaasi.ee/wp-content/uploads/2024/08/10.-Logiraamat-praktikutele-vanus-12-18.docx.pdf, lk 13, 15
- Räägime Lastest logiraamat tööks peredega: 5–12-aastane laps — https://peaasi.ee/wp-content/uploads/2026/02/9.-Logiraamat-spetsialistile_5%E2%80%9312-aastane-laps-TAIDETAV.pdf, lk 9, 17
- Koolilaste ja noorte vaimne tervis — https://peaasi.ee/wp-content/uploads/2014/11/Laste-vaimne-tervis-koolis.pdf, lk 4

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 16. org_astangu

**Küsimus:** Mida Astangu Keskus pakub?

**Ülesandespetsiifilised ootused:**

```json
{
  "mode": "resource_discovery",
  "displayed_min": 1,
  "displayed_must_include": [
    "astangu"
  ],
  "displayed_url_required": true
}
```

### Vastus A — G80a3fbe177fcc8bd

Astangu Kutserehabilitatsiooni Keskus pakub eelkõige kutserehabilitatsiooni ehk teenuseid ja tegevusi, mis aitavad erivajadusega inimesel jõuda sobiva õppimise, töö ja võimalikult iseseisva igapäevaeluni.

Selle põhjal, mis on selle asutuse kohta teada, pakutakse seal muu hulgas:
- kutserehabilitatsiooni ja selle raames nõustamist
- tööalase rehabilitatsiooni teenuseid
- töötamise toetamise teenust
- tugiteenuseid ja tugispetsialistide panust
- praktilisi töötoasid ja tegevusi, sh tööharjutuse laadseid tegevusi
- infot ja abi sobiva teenuse leidmisel

Lisaks on neil avalikustatud ka tööalase rehabilitatsiooni hinnakiri ning erinevate tugispetsialistide rollide kirjeldusi.

Kui vajad, saan järgmise sammuna öelda ka:
- kellele Astangu teenused sobivad
- kuidas nendega ühendust võtta
- mis vahe on kutserehabilitatsioonil ja tööalusel rehabilitatsioonil

Kuvatud allikad:

- Astangu Kutserehabilitatsiooni Keskus — https://www.astangu.ee/et
- Haridusliku erivajadusega noorte kutseõpingute ja tööturule jõudmise toetamine — https://www.riigikontroll.ee/sites/default/files/documents/2025-11/19750_RKTR_6598_2-1.4_2344_003-2.pdf, lk 19

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Gd8d90f23dcc92213

Astangu Kutserehabilitatsiooni Keskus toetab erivajadusega inimesi õppimisel, töö leidmisel ja igapäevaelus iseseisvamalt toime tulemisel. Keskuse tegevus ühendab sotsiaal-, haridus- ja tööturuteenuseid.

Peamised tegevussuunad on:

- kutseõpe haridusliku erivajadusega noortele koostöös Haapsalu Kutsehariduskeskusega;
- tööalane rehabilitatsioon, mille käigus toetatakse tööks vajalike oskuste ja toimetuleku arendamist;
- töötamise toetamine ja abi sobiva töö leidmisel või tööl püsimisel;
- töötoad, kus tehakse näiteks puutööd ning lihtsamaid voltimis-, pakendamis- ja kleepimistöid;
- tugispetsialistide, näiteks eripedagoogi, kaasamine;
- nõustamine, koolitused ja metoodiliste lahenduste arendamine erivajadusega inimeste toetamiseks.

Teenuse täpne sisu ja maht sõltuvad inimese vajadustest. Sobiva teenuse kohta saab küsida Astangu teenuste konsultandilt Epp Viilaselt telefonil 687 7231 või e-posti aadressil epp.viilas@astangu.ee. Keskuse üldkontakt on astangu@astangu.ee ja aadress Astangu 27, Tallinn.

Kuvatud allikad:

- Astangu Kutserehabilitatsiooni Keskus — https://www.astangu.ee/et
- Haridusliku erivajadusega noorte kutseõpingute ja tööturule jõudmise toetamine — https://www.riigikontroll.ee/sites/default/files/documents/2025-11/19750_RKTR_6598_2-1.4_2344_003-2.pdf, lk 19

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 17. org_puudega_inimese_abi

**Küsimus:** Millised organisatsioonid või materjalid aitavad puudega inimest?

**Ülesandespetsiifilised ootused:**

```json
{
  "mode": "resource_discovery",
  "evidence_package": true,
  "displayed_min": 2,
  "displayed_must_not_include": [
    "sotsiaalhoolekande seadus"
  ]
}
```

### Vastus A — G046395b40a7b0eec

Puudega inimest toetavad Eestis mitu eri tasandi organisatsiooni ja abiallikat.

Organisatsioonid

- Sotsiaalkindlustusamet (SKA) – tegeleb puude tuvastamisega seotud küsimustega, maksab puudega inimese sotsiaaltoetusi ning korraldab muu hulgas abivahendite hüvitamist. SKA kaudu võib saada ka puudega isiku kaardi.
- Kohalik omavalitsus (vald või linn) – hindab inimese abivajadust ja korraldab või vahendab sotsiaalteenuseid. Võimalikud teenused on näiteks invatransport, tugiisikuteenus, koduteenus, isikliku abistaja teenus ja päevakeskuse teenused. Teenuste valik ja tingimused võivad omavalitsuseti erineda.
- Tervisekassa – hüvitab meditsiiniseadmeid. See erineb sotsiaalhoolekande abivahenditest, mida hüvitab SKA.
- Puudega inimeste kojad, liidud ja muud vabaühendused – näiteks Eesti Kurtide Liit, Eesti Pimedate Liit ja Eesti Vaegkuuljate Liit. Need organisatsioonid pakuvad nõustamist, huvikaitset, kogemuslikku tuge, koolitusi ja puudespetsiifilisi teenuseid.
- Tugi- ja rehabilitatsioonikeskused ning teenuseosutajad – võivad pakkuda sotsiaalset rehabilitatsiooni, erihoolekandeteenuseid, nõustamist ja igapäevaelus juhendamist. Erihoolekandeteenused on mõeldud inimestele, kes vajavad vaimse tervise tõttu juhendamist, kõrvalabi või järelevalvet.

Praktilised materjalid

- „Kes aitab ja kuhu pöörduda, kui sul on tuvastatud puude raskusaste?” – lühijuhend, mis selgitab SKA, abivahendite, sotsiaalse rehabilitatsiooni, erihoolekandeteenuste ning nägemis- ja kuulmislangusega inimestele mõeldud teenuste seoseid.
- „Puuetega inimeste töötamist toetavad meetmed” – materjal, mis käsitleb puuetega inimeste töövõimalusi, koolitusi, töökoha kohandamist ja eri puudeliikidega seotud takistusi.
- „Puudega inimeste sotsiaalne lõimumine” – varasem ülevaade, mis kirjeldab sotsiaalteenuste, päevakeskuste, kohalike omavalitsuste ja vabaühenduste rolli ning sotsiaalse isolatsiooni vähendamist.
- 2026. aasta uuring täisealiste puudega inimeste puude tuvastamise, abivajaduse hindamise ja toetamise süsteemist – uuem taustamaterjal, mis käsitleb riigi ja kohalike omavalitsuste rollijaotust ning abivajaduse hindamist.

Kui inimene vajab konkreetset abi, on tavaliselt mõistlik alustada oma elukohajärgsest vallast või linnast, sest just KOV saab hinnata kohapealset abivajadust ja selgitada, milliseid teenuseid seal pakutakse. Puudega seotud toetuste, puude tuvastamise ja abivahendite küsimustes on keskne asutus SKA. KOV-i täpsemate teenuste kohta saab öelda rohkem siis, kui on teada, millises vallas või linnas inimene elab.

Kuvatud allikad:

- Kes aitab ja kuhu pöörduda, kui sul on tuvastatud puude raskusaste? — https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-02/puudega-tooealisele.pdf, lk 1-2
- Puuetega inimeste töötamist toetavad meetmed — https://www.sm.ee/sites/default/files/content-editors/Ministeerium_kontaktid/Uuringu_ja_analuusid/Sotsiaalvaldkond/pittm_1ja2etapp_kokku_2_.pdf, lk 5, 32, 37-38
- Puudega inimeste sotsiaalne lõimumine — https://www.stat.ee/sites/default/files/2020-07/Puudega_inimeste_sotsiaalne_loimumine.pdf, lk 88, 92
- Uuring täisealiste puudega inimeste puude tuvastamise, abivajaduse hindamise ja toetamise süsteemist — https://www.sm.ee/sites/default/files/documents/2026-03/Puuetega%20inimeste%20uuringu%20l%C3%B5ppraport.pdf, lk 6, 20, 191

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G73479c47305f50a3

Puudega inimest aitavad eelkõige need organisatsioonid ja materjalid:

Sotsiaalkindlustusamet
- Maksab puudega inimese sotsiaaltoetusi.
- Abistab puudega inimese kaardi väljastamisel.
- Suunab ka eriteenuste juurde, näiteks juhtkoer, kaugtõlge ja kirjutustõlge, erihoolekandeteenused ning sotsiaalse rehabilitatsiooni teenus.

Kohalik omavalitsus
- Võib pakkuda lisateenuseid lisaks riiklikele teenustele.
- Allikad toovad välja näiteks tugiisikuteenuse, invatranspordi ja töökoha kohandamisega seotud toe.
- Mitmes paigas on abiks ka päevakeskused, mis toetavad igapäevaeluga toimetulekut ja aitavad vältida sotsiaalset isolatsiooni.

Vabaühendused ja tugiorganisatsioonid
- Puudega inimeste kojad, liidud ja muud mittetulundusühingud aitavad konkreetse puude spetsiifikaga seotud probleemide lahendamisel ning sotsiaalsel kaasamisel.
- Allikates on eraldi mainitud näiteks Eesti Kurtide Liit, Eesti Pimedate Liit ja Eesti Vaegkuuljate Liit.
- Mõned MTÜ-d osutavad sotsiaalteenuseid projektipõhiselt KOV-idega sõlmitud lepingute alusel.

Praktilised materjalid ja tugivahendid
- Info puude raskusastmega inimesele sobivate teenuste kohta: sotsiaaltoetused, puude isiku kaart, juhtkoer, kaugtõlge, kirjutustõlge, erihoolekanne ja rehabilitatsioon.
- Abivahendite kohta on oluline vaadata, kes neid hüvitab: meditsiiniseadmeid hüvitab Tervisekassa, abivahendeid Sotsiaalkindlustusamet.
- Töötamist toetavate meetmete hulgas on välja toodud ka koolitused, tekstilugemistarkvara, heliraamatud ja töökoha kohandamise vajadus.

Kui soovid, saan järgmises vastuses panna need ka lühikesse praktilisse nimekirja: “kelle poole pöörduda esimesena”, “mida kust küsida” ja “millise teenuse jaoks”.

Kuvatud allikad:

- Puudega inimeste sotsiaalne lõimumine — https://www.stat.ee/sites/default/files/2020-07/Puudega_inimeste_sotsiaalne_loimumine.pdf, lk 88, 92
- Kes aitab ja kuhu pöörduda, kui sul on tuvastatud puude raskusaste? — https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-02/puudega-tooealisele.pdf, lk 1-2
- Puuetega inimeste töötamist toetavad meetmed — https://www.sm.ee/sites/default/files/content-editors/Ministeerium_kontaktid/Uuringu_ja_analuusid/Sotsiaalvaldkond/pittm_1ja2etapp_kokku_2_.pdf, lk 5, 32, 37-38
- Uuring täisealiste puudega inimeste puude tuvastamise, abivajaduse hindamise ja toetamise süsteemist — https://www.sm.ee/sites/default/files/documents/2026-03/Puuetega%20inimeste%20uuringu%20l%C3%B5ppraport.pdf, lk 6, 20, 191

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 18. life_raha_uur_toit

**Küsimus:** Mul pole raha üüri ja toidu jaoks, mida teha?

**Ülesandespetsiifilised ootused:**

```json
{
  "mode": "life_situation_guidance",
  "evidence_package": true,
  "displayed_min": 1,
  "answer_must_include_any": [
    "vältimatu",
    "sotsiaalosakon"
  ]
}
```

### Vastus A — G050652acc09b7c04

Kui sul puudub raha üüri ja toidu jaoks, tee kohe järgmist:

1. Võta ühendust oma kohaliku omavalitsuse sotsiaalosakonna või sotsiaaltöötajaga ja ütle selgelt, et oled elatusvahenditeta ning vajad vältimatut sotsiaalabi. Vältimatu abi peab tagama vähemalt toidu, riietuse ja ajutise majutuse ning seda osutatakse seni, kuni sa ei ole enam sellises abitus olukorras.

2. Palu hinnata kohe:
- toiduabi või muud kiiret materiaalset abi;
- ajutist majutust, kui elukoht on kaotamisel või sul ei ole kusagil ööbida;
- abi eluasemekulude või võlgnevuse lahendamisel;
- muid kohaliku omavalitsuse toetusi ja teenuseid.

3. Kui sul on täna ööseks koht puudu või toit on otsas, ütle seda kohe telefonis või kohale minnes — ära piirdu üldise toimetulekutoetuse küsimisega, vaid kasuta sõnastust „vajan vältimatut sotsiaalabi“.

Kui kirjutad, millises linnas või vallas sa elad ja kas sul on täna ööbimiskoht olemas, saan juhendada järgmise konkreetse sammu osas.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 8 Vältimatu sotsiaalabi — https://www.riigiteataja.ee/akt/130122025029
- Sotsiaalhoolekande seadus § 135 Riigieelarvest makstav täiendav sotsiaaltoetus — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G6fd26a876e546e60

Kui sul ei ole raha toidu ja üüri jaoks, siis esimene samm on pöörduda oma kohaliku omavalitsuse sotsiaaltöö poole ja küsida vältimatut sotsiaalabi.

Selle õiguse järgi osutatakse inimesele, kes on sattunud elatusvahendite kaotuse või puudumise tõttu sotsiaalselt abitusse olukorda, vähemalt toidu, riietuse ja ajutise majutuse abi. Abi antakse seni, kuni sa ei ole enam selle puuduse tõttu abitus olukorras.

Praktiliselt tee kohe nii:
1. Võta täna ühendust oma valla või linna sotsiaalosakonnaga.
2. Ütle otse, et sul ei ole raha toidu ega eluasemekulude jaoks ja vajad vältimatut sotsiaalabi.
3. Kui sul on täna kriitiline olukord, küsi ka ajutise majutuse ja toiduabi kohta.
4. Kui sa ei tea, kuhu pöörduda, ütle mulle oma omavalitsus või linn ja ma aitan sul täpselt välja kirjutada, kelle poole minna.

Kui tahad, võin kohe koostada sulle lühikese sõnumi või telefonijutu, millega sotsiaaltöötajale ühendust võtta.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 8 Vältimatu sotsiaalabi — https://www.riigiteataja.ee/akt/130122025029
- Sotsiaalhoolekande seadus § 135 Riigieelarvest makstav täiendav sotsiaaltoetus — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 19. life_eakas_kodus

**Küsimus:** Ema ei saa enam üksi kodus hakkama, kuhu pöörduda?

**Ülesandespetsiifilised ootused:**

```json
{
  "mode": "life_situation_guidance",
  "displayed_min": 1,
  "answer_must_include_any": [
    "koduteenus",
    "abivajaduse hindami"
  ]
}
```

### Vastus A — G8ce99b36cdc0915d

Pöörduge ema elukohajärgse kohaliku omavalitsuse sotsiaalosakonna või sotsiaaltöötaja poole. KOV ülesanne on hinnata ema abivajadust ja korraldada sobiv abi.

Praktiliselt:

1. Võtke sotsiaalosakonnaga ühendust telefoni või e-posti teel ning kirjeldage, milliste toimingutega ema enam hakkama ei saa – näiteks söögi tegemine, pesemine, ravimite võtmine, liikumine või asjaajamine.
2. Paluge korraldada abivajaduse hindamine. Selle põhjal saab KOV otsustada sobiva toe, näiteks koduteenuse, tugiisiku või vajaduse korral väljaspool kodu osutatava üldhooldusteenuse üle.
3. Kui ema vajab abi oma õiguste teostamisel ja kohustuste täitmisel puude tõttu, võib kõne alla tulla ka täisealise isiku hoolduse seadmine. Hooldaja määratakse ema nõusolekul ja tema ülesanded pannakse täpselt paika.
4. Kui olukord on kohe ohtlik – näiteks ema on kukkunud, ei saa hingata, on segaduses või ei saa endaga turvaliselt hakkama –, helistage 112.

KOV-i poole pöördumiseks ei pea enne ise teadma, millist teenust ta vajab. Oluline on kirjeldada tegelikku igapäevast toimetulekut. Millises omavalitsuses ema elab?

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 26 Täisealise isiku hoolduse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Gcdd405d03884052a

Pöörduge esmalt ema elukohajärgsesse kohaliku omavalitsuse sotsiaalosakonda või valla/linnavalitsuse sotsiaaltöötaja poole. Kohalik omavalitsus hindab abivajaduse ja korraldab vajadusel sobiva abi.

Kui inimene ei saa enam kodus üksi hakkama, võivad esimesed lahendused olla näiteks koduteenus, tugiisik, isiklik abistaja või vajadusel väljaspool kodu osutatav üldhooldusteenus. Täisealise isiku hooldust saab seada siis, kui inimene vajab vaimse või kehalise puude tõttu abi oma õiguste teostamiseks ja kohustuste täitmiseks; hooldus seatakse inimese taotluse ja nõusoleku alusel.

Kui ütlete, millises omavalitsuses ema elab, saan täpsustada, kuhu täpselt pöörduda.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 26 Täisealise isiku hoolduse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 20. comparison_kodu_tugiisik

**Küsimus:** Mis vahe on koduteenusel ja tugiisikuteenusel?

**Ülesandespetsiifilised ootused:**

```json
{
  "mode": "comparison",
  "evidence_package": true,
  "displayed_must_include": [
    "§ 17",
    "§ 23"
  ],
  "displayed_must_not_include": [
    "§ 44",
    "§ 45"
  ]
}
```

### Vastus A — G1b588d7260d8afae

Koduteenus ja tugiisikuteenus on mõlemad kohaliku omavalitsuse korraldatavad sotsiaalteenused, kuid nende eesmärk ja abi sisu on erinevad.

Koduteenus on mõeldud täisealise inimese iseseisva ja turvalise toimetuleku tagamiseks kodustes tingimustes. Selle käigus abistatakse inimest toimingutes, mida ta oma terviseseisundi, tegevusvõime või elukeskkonna tõttu ei suuda ise teha, näiteks kütmine, toiduvalmistamine, eluruumi ja riiete korrastamine ning väljaspool kodu toiduainete ja majapidamistarvete ostmine ning muu asjaajamine.

Tugiisikuteenus on laiemalt iseseisva toimetuleku toetamine olukorras, kus inimene vajab sotsiaalsete, majanduslike, psühholoogiliste või tervislike probleemide tõttu oma kohustuste täitmisel ja õiguste teostamisel olulisel määral kõrvalabi. Abi sisu on eelkõige juhendamine, motiveerimine ning iseseisvuse ja omavastutuse võime arendamine, mitte igapäevaste koduste toimingute ise ära tegemine.

Lühidalt:
- koduteenus = praktiline abi kodus ja igapäevastes majapidamistoimingutes;
- tugiisikuteenus = nõustav, juhendav ja motiveeriv tugi iseseisvuse tugevdamiseks.

Oluline erinevus on ka sihtrühmas:
- koduteenus on seaduse järgi täisealisele isikule;
- tugiisikuteenust saab osutada nii täiskasvanule kui ka lapse kasvatamise ja lapse arengu toetamise eesmärgil lapsele või last kasvatavale isikule.

Kui soovid, saan sellest teha ka väga lühikese võrdlustabeli või aidata hinnata, kumma teenuse jaoks inimene võiks pigem sobida.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 23 Tugiisikuteenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029
- Sotsiaalhoolekande seadus § 17 Koduteenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G854eeb5c83ad6370

Koduteenus ja tugiisikuteenus on mõlemad kohaliku omavalitsuse korraldatavad sotsiaalteenused, kuid nende põhieesmärk on erinev.

| Teenus | Põhieesmärk | Milles abi seisneb? |
|---|---|---|
| Koduteenus | Tagada täisealise inimese iseseisev ja turvaline toimetulek kodus | Abi igapäevastes kodustes toimingutes, mida inimene ei suuda terviseseisundi, tegevusvõime või elukeskkonna tõttu iseseisvalt teha |
| Tugiisikuteenus | Toetada inimese iseseisvust, kohustuste täitmist ja õiguste teostamist | Juhendamine, motiveerimine ning igapäevaeluga toimetuleku ja omavastutuse arendamine |

Koduteenuse puhul võib abi olla näiteks:

- kütmisel;
- toidu valmistamisel;
- eluruumi või riiete korrastamisel;
- toiduainete ja majapidamistarvete ostmisel;
- muus asjaajamises väljaspool kodu.

Koduteenus on seaduse järgi suunatud täisealisele isikule ja toimub eelkõige kodustes tingimustes.

Tugiisikuteenus ei tähenda üldjuhul kodutööde tegemist, vaid inimese kõrval olemist ja tema juhendamist. Tugiisik võib aidata näiteks igapäevatoimingute korraldamisel, suhtlemisel, kohustuste täitmisel või iseseisvuse suurendamisel. Teenust võib osutada täiskasvanule, last kasvatavale isikule või lapsele. Lapse puhul toetab tugiisik lapse arengut, igapäevaelus toimetulekut ja suhtlemist ning vajaduse korral võib puudega lapse puhul aidata ka hooldustoimingutes.

Lihtsustatult:

- kui inimene vajab abi kodu ja igapäevaste vajalike toimingutega hakkama saamisel, on küsimus pigem koduteenuses;
- kui inimene vajab juhendamist, motiveerimist või tuge oma kohustuste täitmisel ja iseseisvamaks muutumisel, on küsimus pigem tugiisikuteenuses.

Täpne teenuse sisu, maht ja korraldus sõltuvad ka inimese abivajaduse hindamisest ning kohaliku omavalitsuse korraldusest.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 23 Tugiisikuteenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029
- Sotsiaalhoolekande seadus § 17 Koduteenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 21. comparison_kodu_isiklik_abistaja

**Küsimus:** Kuidas eristada koduteenust ja isikliku abistaja teenust?

**Ülesandespetsiifilised ootused:**

```json
{
  "mode": "comparison",
  "displayed_min": 1,
  "answer_must_include": [
    "isiklik"
  ]
}
```

### Vastus A — G41022066e5090752

Koduteenus ja isikliku abistaja teenus on mõlemad kohaliku omavalitsuse korraldatavad sotsiaalteenused, kuid nende eesmärk ja sihtrühm on erinevad.

Koduteenus on mõeldud täisealisele inimesele, kelle iseseisev ja turvaline toimetulek kodustes tingimustes vajab tuge terviseseisundist, tegevusvõimest või elukeskkonnast tulenevatel põhjustel. Selle sisuks on abi igapäevastes kodustes toimingutes, mida inimene ise kõrvalabita teha ei suuda, näiteks kütmine, toiduvalmistamine, eluruumi ja riiete korrastamine ning väljaspool kodu toiduainete ja majapidamistarvete ostmine ning muu asjaajamine.

Isikliku abistaja teenus on mõeldud täisealisele puude tõttu füüsilist kõrvalabi vajavale inimesele. Selle eesmärk on suurendada inimese iseseisvat toimetulekut ja osalemist kõigis eluvaldkondades ning vähendada seadusjärgsete hooldajate hoolduskoormust. Abistamine keskendub tegevustele, kus inimene vajab puude tõttu füüsilist kõrvalabi, näiteks liikumisel, söömisel, toidu valmistamisel, riietumisel, hügieenitoimingutes ja muudes sarnastes tegevustes.

Lihtsalt eristades:
- koduteenus = abi kodu- ja majapidamistoimingutes, et inimene saaks kodus turvaliselt toime tulla;
- isikliku abistaja teenus = vahetu füüsiline abi inimese igapäevategevustes, kui takistus tuleneb puudest.

Praktiline vahe on ka see, et isikliku abistaja teenus on seaduse järgi suunatud just puude tõttu füüsilist kõrvalabi vajavale täisealisele inimesele, samas kui koduteenuse alus on laiemalt inimese toimetulekuprobleem kodustes tingimustes.

Kui soovid, võin teha ka lühikese võrdlustabeli või aidata hinnata, kumb teenus sobiks konkreetse olukorra puhul.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 27 Isikliku abistaja teenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029
- Sotsiaalhoolekande seadus § 17 Koduteenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029
- Sotsiaalhoolekande seadus § 29 Nõuded teenust vahetult osutavale isikule — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G462743fcf5bb7437

Koduteenus ja isikliku abistaja teenus on mõlemad kohaliku omavalitsuse korraldatavad sotsiaalteenused, kuid nende põhifookus on erinev.

| Võrdlus | Koduteenus | Isikliku abistaja teenus |
|---|---|---|
| Peamine eesmärk | Tagada täisealise inimese iseseisev ja turvaline toimetulek kodus | Suurendada puudega täisealise inimese iseseisvust ja osalemist kõigis eluvaldkondades |
| Abivajaduse põhjus | Terviseseisund, vähenenud tegevusvõime või elukeskkond takistab koduste vajalike toimingute tegemist | Puude tõttu vajab inimene füüsilist kõrvalabi |
| Abi sisu | Kütmine, toidu valmistamine, eluruumi ja riiete korrastamine, toiduainete ja majapidamistarvete ostmine ning muu asjaajamine | Liikumine, söömine, toidu valmistamine, riietumine, hügieen, majapidamine ja muud tegevused, milles inimene vajab kõrvalabi või juhendamist |
| Abi seos inimesega | Teenuseosutaja teeb vajalikke koduse toimetuleku toiminguid või aitab neid teha | Isiklik abistaja aitab inimest tema enda tegevustes; teenuse saaja juhised on teenuse osutamisel olulised |
| Laiem mõju | Võimaldab inimesel kodus edasi elada | Võimaldab inimesel aktiivsemalt osaleda ka väljaspool kodu ning vähendab seadusjärgsete hooldajate hoolduskoormust |

Lihtsustatult:

- Koduteenus keskendub eelkõige sellele, et inimese kodu ja igapäevane kodune elu oleksid korraldatud.
- Isikliku abistaja teenus keskendub inimesele endale ja tema füüsilisele abistamisele, et ta saaks oma elu ise korraldada ning osaleda tööl, õpingutes, asjaajamises ja ühiskonnaelus.

Näide: kui inimene ei suuda tervise tõttu ise küttepuid tuua, süüa valmistada või eluruumi korrastada, võib sobiv teenus olla koduteenus. Kui puudega inimene vajab abi riietumisel, liikumisel, hügieenitoimingutes või kodust väljaspool liikumisel, et ta saaks ise oma päeva ja tegevusi korraldada, võib sobivam olla isikliku abistaja teenus.

Piir ei ole alati absoluutne, sest mõlema teenuse raames võib esineda näiteks toidu valmistamist või majapidamisabi. Otsustav erinevus on see, kas abi eesmärk on peamiselt koduse toimetuleku tagamine või inimese füüsilise kõrvalabi vajaduse katmine tema enda tegevustes ja osalemisel. Konkreetne teenuse sisu ja maht määratakse kohaliku omavalitsuse korralduses inimese individuaalse abivajaduse põhjal; seetõttu võivad praktilised tingimused omavalitsuseti erineda.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 27 Isikliku abistaja teenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029
- Sotsiaalhoolekande seadus § 17 Koduteenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029
- Sotsiaalhoolekande seadus § 29 Nõuded teenust vahetult osutavale isikule — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 22. edge_inflected_tugiisikuteenusel

**Küsimus:** Kas tugiisikuteenusel on omaosalus?

**Ülesandespetsiifilised ootused:**

```json
{
  "mode": "national_service_benefit",
  "answer_must_include": [
    "tugiisik"
  ],
  "answer_must_include_any": [
    "omavalitsus",
    "kov",
    "omaosalus"
  ]
}
```

### Vastus A — Gd0a002d470718af5

Ma ei leidnud praeguse otsinguga sellele piisavalt täpset õiguslikku allikakinnitust. Praegu kinnitavad allikad tugiisikuteenuse puhul eelkõige seda, et kõrvalabi vajadus hinnatakse iga inimese puhul eraldi ning KOV korraldab teenuse osutamise ja teenuseosutaja valiku (§ 24 „Kohaliku omavalitsuse üksuse kohustused“), kuid omaosaluse küsimust need detailid ei kinnita.

Kui soovid, saan edasi vaadata konkreetse omavalitsuse järgi, sest omaosaluse kord sõltub sageli KOV-i teenusekorraldusest.

Kuvatud allikad:

- puuduvad

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Gc62196261461a020

Tugiisikuteenuse omaosaluse kohta ei saa praegu kasutatud õigusallikate põhjal anda üleriigilist kindlat vastust. Sotsiaalhoolekande seaduse § 24 „Kohaliku omavalitsuse üksuse kohustused“ sätestab teenuse vajaduse hindamise, teenuseosutaja valiku ja teenuse korraldamise, kuid omaosaluse kohta selles sättes infot ei ole.

Praktikas võib omaosaluse kord sõltuda kohaliku omavalitsuse kehtestatud korrast. Millise omavalitsuse tugiisikuteenusest on küsimus?

Kuvatud allikad:

- puuduvad

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 23. edge_crisis

**Küsimus:** Ma ei jaksa enam elada, mida teha?

**Ülesandespetsiifilised ootused:**

```json
{
  "crisis": true,
  "answer_must_include_any": [
    "112",
    "kriis",
    "abi"
  ]
}
```

### Vastus A — G11836073f370e816

Helista kohe 112.

Kui saad, mine kohe inimese juurde, kes saab sinuga olla, ja pane enda lähedalt ära kõik, millega võiksid endale haiget teha. Kui oled üksi, ava uks või mine lähimasse turvalisse kohta.

Kuvatud allikad:

- puuduvad

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Gb203f45c4d9b284d

Helista kohe 112 ja ütle, et kardad endale viga teha. Ära jää üksi: mine lähedase või naabri juurde ning eemalda enda juurest ravimid, relvad ja muud vahendid, millega võiksid end vigastada.

Kuvatud allikad:

- puuduvad

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 24. pdf_abivajav_laps_andmekaitse

**Küsimus:** Kas abivajavast lapsest teatamine rikub andmekaitsenõudeid?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "displayed_must_include": [
    "abivajavast lapsest"
  ],
  "answer_must_include_any": [
    "teatami",
    "andmekaitse"
  ]
}
```

### Vastus A — G6bbd4f08bf48a36e

Ei, abivajavast lapsest teatamine ei ole iseenesest andmekaitsenõuete rikkumine.

Selle info põhjal on teataja isikuandmete ja teatamise fakti avalikustamine üldreeglina keelatud, välja arvatud süüteomenetluses. Teataja võib enda või perekonna kaitseks jätta ka oma andmed avaldamata. Seega on süsteem mõeldud just selleks, et lapsest saaks ohutult teada anda ilma teatajat põhjendamatult paljastamata.

Oluline täpsustus: täielikku anonüümsust ei saa alati garanteerida, sest iga teabenõuet hinnatakse juhtumipõhiselt ja teataja teadmisvajadust tuleb põhjendada. Kui aga tegu on ametisiku poolt asutuse esindajana tehtud ametliku teatamisega, siis asutuse esindaja andmetele üldjuhul piirangut seada ei saa.

Kui soovid, saan selgitada ka, kuidas see praktikas lastekaitsele teatamisel või teabenõuetele vastamisel toimib.

Kuvatud allikad:

- Juhend: abivajavast lapsest teatamine ja andmekaitse — https://www.oiguskantsler.ee/sites/default/files/JUHEND%20-%20abivajavast%20lapsest%20teatamine%20ja%20andmekaitse%20%28jaanuar%202021%29.pdf, lk 1-4, 6-13
- Isikuandmed sotsiaalhoolekande- ja tervishoiusektoris — https://www.aki.ee/sites/default/files/dokumendid/isikuandmed_sotsiaalhoolekande-_ja_tervishoiusektoris.pdf, lk 13

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Gffa4646fcee6018b

Ei. Abivajavast lapsest teatamine ei riku iseenesest andmekaitsenõudeid – see on lapse kaitseks ette nähtud õiguslikult lubatud tegevus ning teatud juhtudel ka kohustus.

Oluline on, et:

- teave edastatakse pädevale asutusele, näiteks kohaliku omavalitsuse lastekaitsele;
- edastatakse lapse olukorra hindamiseks vajalikud andmed, mitte kõrvaline info;
- teataja isikut ja teatamise fakti üldjuhul ei avalikustata, välja arvatud süüteomenetluses;
- teataja isikuandmetele võib juurdepääsu piirata, kui see on vajalik näiteks tema eraelu või turvalisuse kaitseks;
- kui teatatakse asutuse nimel ja teataja on dokumentidest tuvastatav asutuse esindajana, ei pruugi tema andmetele samal viisil juurdepääsupiirangut saada.

Seega ei ole probleem tavaliselt teatamises endas, vaid selles, kui lapse või teataja andmeid avaldatakse põhjendamatult, liiga laiale ringile või rohkem, kui juhtumi lahendamiseks vaja.

Kuvatud allikad:

- Juhend: abivajavast lapsest teatamine ja andmekaitse — https://www.oiguskantsler.ee/sites/default/files/JUHEND%20-%20abivajavast%20lapsest%20teatamine%20ja%20andmekaitse%20%28jaanuar%202021%29.pdf, lk 1-4, 6-13
- Isikuandmed sotsiaalhoolekande- ja tervishoiusektoris — https://www.aki.ee/sites/default/files/dokumendid/isikuandmed_sotsiaalhoolekande-_ja_tervishoiusektoris.pdf, lk 13

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 25. pdf_opilase_toetamine_koolis

**Küsimus:** Millised juhendmaterjalid aitavad õpilast koolis toetada?

**Ülesandespetsiifilised ootused:**

```json
{
  "mode": "resource_discovery",
  "displayed_min": 1,
  "displayed_must_include": [
    "kool"
  ],
  "answer_must_include_any": [
    "õpilas",
    "kool",
    "tugi"
  ]
}
```

### Vastus A — G55c0d74abb327ab3

Õpilase koolis toetamiseks on praktiliselt kasutatavad eelkõige järgmised juhendmaterjalid:

1. „Koolitöötajad jms toetav süsteemne lähenemine“

See materjal aitab koolil korraldada õpilase toe vajaduse väljaselgitamist ja toetamise protsessi samm-sammult. Selles on:

- küsimused kooli seniste praktikate läbimõtlemiseks;
- töölehed tegevuste, kokkulepete ja olulise info dokumenteerimiseks;
- juhised tugimeeskonna ning koolisiseste ja -väliste spetsialistide koostöö korraldamiseks;
- käsitlus Rajaleidja rollist haridusasutuse koostööpartnerina.

Materjal ei paku üht kohustuslikku mudelit, vaid aitab koolil kujundada oma vajadustele sobiva tugisüsteemi.

2. „Õpilase toetamine koolis“

See juhend annab ülevaate õpilase toetamise võimalustest koolis, sealhulgas erinevatest meetmetest, teenustest ja rollidest. Käsitletud on näiteks:

- kaasava hariduse põhimõtted;
- õpilasele sobivate õppekorralduslike kohanduste tegemine;
- üld-, tõhustatud ja eritoe rakendamise üldine raamistik;
- tugispetsialistide roll;
- koduõppega seotud teema.

Praktiliste näidetena soovitatakse kohandada ülesannete juhiseid, jagada tegevused väiksemateks etappideks, tuua õppematerjalis oluline esile, võimaldada puhkepause või lisaaega ning kasutada abimaterjale, näiteks skeeme, näidiseid ja sõnaraamatuid.

3. „Erinevate õppijate toetamine õpetaja ja tugispetsialisti koostöös“

See materjal keskendub õpetaja ja tugispetsialisti koostööle ning erinevate õppijate vajadustega arvestamisele. See sobib toetama:

- õpilase vajaduste märkamist ja analüüsimist;
- sobivate õppimise ja osalemise toetamise viiside kavandamist;
- õpetaja, tugispetsialisti ja teiste lapse toetamisega seotud osaliste koostööd;
- lapse individuaalse toe sidumist üldise koolikorraldusega.

Selle materjali juures on kasutatud ka lapse heaolu hindamise käsiraamatut ning kaasava hariduse ja haridusliku erivajadusega õpilaste toetamise käsitlusi.

4. „Distantsõppe korraldus HEV-õpilastele Keila Koolis“

See on varasem, konkreetse kooli kogemust kirjeldav ajakirjaartikkel, mitte üldine riiklik juhend. See võib olla kasulik näitena, kuidas korraldada hariduslike erivajadustega õpilaste toetamist muutuvas õppevormis. Artiklis kirjeldatakse muu hulgas tugispetsialistide, näiteks logopeedi, sotsiaalpedagoogi, psühholoogi ja eripedagoogi kaasamist ning vajadust hoida õppetöö keskkond õpilase jaoks kindla ja turvalisena.

Kõige praktilisemalt tasub neid materjale kasutada koos: esmalt selgitada välja õpilase toe vajadus, seejärel kavandada sobivad õppe- ja tugimeetmed ning leppida selgelt kokku õpetaja, tugispetsialistide, pere ja vajadusel väliste partnerite rollid. Praegu kättesaadav materjalivalik annab sellest teemast kasuliku lähtekoha, kuid ei moodusta täielikku ülevaadet kõigist Eestis kasutatavatest juhenditest.

Kuvatud allikad:

- Distantsõppe korraldus HEV-õpilastele Keila Koolis, lk 49-53
- Õpilase toetamine koolis (varasem versioon) — https://harno.ee/sites/default/files/documents/2022-02/Juhendmaterjal_6pilase_toetamiseks_22.pdf, lk 1-3, 6, 17, 27
- Koolitöötajad jms toetav süsteemne lähenemine — https://harno.ee/sites/default/files/documents/2022-01/Koolitootajad%20jms%20toetav%20s%C3%BCsteemne%20lahenemine_abimaterjal_kujundatud.pdf, lk 4-5
- Erinevate õppijate toetamine õpetaja ja tugispetsialisti koostöös — https://harno.ee/sites/default/files/documents/2022-01/ErinevateOppijateToetamine_2021.pdf, lk 1, 45-46

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G1ce0c6aac30a3ae2

Õpilase toetamiseks koolis on kasutusel mitu juhend- ja abimaterjali, mis keskenduvad nii õpilase toe vajaduse väljaselgitamisele kui ka koostööle koolis.

Praktilised juhendmaterjalid:
- „Koolitöötajad jms toetav süsteemne lähenemine“ – see annab etapilise ülevaate, kuidas õpilase toe vajadust välja selgitada ja kuidas teda toetada. Materjal rõhutab, et abi ei ole ette antud ühe kindla mudelina, vaid see tuleb kujundada kooli olukorra ja koostöö järgi. Seal on ka töölehti ja suunavaid küsimusi, mis aitavad tugimeeskonnal oma tööd analüüsida ning koostööd korraldada nii koolisiseselt kui ka väljaspool kooli. Samuti on seal kirjeldatud Rajaleidja rolli koostööpartnerina.

- „Õpilase toetamine koolis“ – see materjal selgitab üldist, tõhustatud ja erituge ning tutvustab koolis kasutatavaid meetmeid ja tugitegevusi. See sobib hästi siis, kui on vaja üle vaadata, millised võimalused on õpilase toetamiseks koolikorralduse tasandil.

- „Erinevate õppijate toetamine õpetaja ja tugispetsialisti koostöös“ – see toetab õpetaja ja tugispetsialisti ühist tööd ning aitab mõista, kuidas erinevate õppijate vajadusi arvestada igapäevases õppetöös ja toe korraldamisel.

Taustaks oli leitud ka kogemuslugu distantsõppe korraldusest HEV-õpilastele Keila Koolis, mis annab praktilise näite, kuidas koolis tuge korraldada eri olukordades. See ei ole üldine juhend, aga võib aidata näha, kuidas tugisüsteem reaalses koolielus toimib.

Kui soovid, võin neist teha ka lühikese võrdluse: mis sobib kooli tugimeeskonnale, mis õpetajale ja mis klassijuhatajale.

Kuvatud allikad:

- Distantsõppe korraldus HEV-õpilastele Keila Koolis, lk 49-53
- Õpilase toetamine koolis (varasem versioon) — https://harno.ee/sites/default/files/documents/2022-02/Juhendmaterjal_6pilase_toetamiseks_22.pdf, lk 1-3, 6, 17, 27
- Koolitöötajad jms toetav süsteemne lähenemine — https://harno.ee/sites/default/files/documents/2022-01/Koolitootajad%20jms%20toetav%20s%C3%BCsteemne%20lahenemine_abimaterjal_kujundatud.pdf, lk 4-5
- Erinevate õppijate toetamine õpetaja ja tugispetsialisti koostöös — https://harno.ee/sites/default/files/documents/2022-01/ErinevateOppijateToetamine_2021.pdf, lk 1, 45-46

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 26. pdf_marac_mudel

**Küsimus:** Mis on MARAC mudel ja kuidas seda lähisuhtevägivalla juhtumites kasutatakse?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "displayed_must_include": [
    "MARAC"
  ],
  "answer_must_include": [
    "MARAC"
  ]
}
```

### Vastus A — Gfc8292fefe545e86

MARAC on võrgustikupõhine juhtumikorralduse mudel, mida kasutatakse suure lähisuhtevägivalla riskiga täiskasvanud ohvrite abistamiseks. Selle eesmärk on tuvastada kõrge riskiga juhtumid, kindlustada ohvri kaitse mitme asutuse koostöös ning vähendada vägivalla kordumist ja raskeid tagajärgi.

Kuidas seda kasutatakse:
1. Riski tuvastamine ja hindamine  
   Lähisuhtevägivallaga tegelev spetsialist hindab juhtumi riski ohvriga vesteldes ja riskitegureid kaardistades. Kõrge risk tähendab, et ohvri elu või tervis võib olla ohus; see võib hõlmata ka tapmis- või suitsiidiohtu.

2. Juhtumi suunamine MARACi  
   Kui risk on kõrge, suunatakse juhtum MARACi. Eestis kasutatakse seda mudelit täiskasvanud perevägivalla ohvrite puhul.

3. Mitme asutuse koostöö  
   MARACi ümber koondub võrgustik, kuhu kuuluvad tavapäraselt ohvriabi, politsei, prokuratuur, KOV ja naiste tugikeskused. Lastega seotud juhtumites on oluline ka lastekaitse kaasamine.

4. Individuaalne turvalisuse plaan  
   Koosolekul luuakse ohvrile konkreetne turvalisuse plaan, mille täitmisel on igal osaleval asutusel oma roll ja vastutus.

5. Järeltegevus ja mõju hindamine  
   Võrgustik jälgib, kas kokkulepitud tegevused on tehtud ja kas need vähendavad riski.

Praktiliselt tähendab see, et MARAC ei ole üks teenus, vaid koostöömudel, mis ühendab eri asutused üheks kiireks ja konfidentsiaalseks juhtumikorralduseks. See on mõeldud just siis, kui tavaline abi ei pruugi olla piisav ja oht on väga suur.

Kui soovid, võin selgitada ka, kuidas MARAC erineb tavapärasest juhtumikorraldusest või milline on KOV-i lastekaitse roll MARACis.

Kuvatud allikad:

- Elude päästmine võrgustikutöös MARACi abil, lk 40-46
- MARAC-i juhendmaterjal — https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/MARAC-i%20juhendmaterjal.pdf, lk 4-8

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Ga0bd964938d7974d

MARAC on võrgustikupõhine juhtumikorralduse mudel, mille eesmärk on tuvastada suure lähisuhtevägivalla riskiga täiskasvanud ohvrid ning korraldada tema ja tema laste kaitse mitme asutuse koostöös. MARAC tähistab ingliskeelset mõistet Multi-Agency Risk Assessment Conference.

MARACi kasutatakse eelkõige juhtumites, kus vägivallast tulenev oht elule või tervisele on kõrge. See võib hõlmata näiteks korduvat vägivalda, kägistamist, tapmisähvardusi, ahistavat jälitamist, seksuaalset või majanduslikku vägivalda ning ähvardusi võtta ohvrilt lapsed. Kõrge riski hindab lähisuhtevägivallaga tegelev spetsialist vestluse ja riskitegurite kaardistamise põhjal.

MARACi tööprotsess sisaldab tavaliselt järgmisi samme:

1. Kõrge riski tuvastamine ja juhtumi suunamine MARACi.
2. Ohvrile MARACi vabatahtliku toe pakkumine.
3. Juhtumi konfidentsiaalne arutamine võrgustikukoosolekul.
4. Individuaalse turvalisusplaani koostamine.
5. Ülesannete jagamine osalevate asutuste vahel.
6. Tegevuste ja tulemuste jälgimine ning vajaduse korral plaani kohandamine.

Eestis võivad MARACi võrgustikku kuuluda politsei, prokuratuur, ohvriabi, kohalik omavalitsus, naiste tugikeskus ning juhtumipõhiselt näiteks lastekaitse-, tervishoiu-, haridus- või kriminaalhoolduse spetsialistid. MARACi meeskonnad tegutsevad maakondlikult ja juhendi kohaselt kohtuvad tavapäraselt kord kuus. Meeskonda juhib Politsei- ja Piirivalveameti esindaja ning MARACi koordineerib Sotsiaalkindlustusameti ohvriabi ja ennetusteenuste osakond.

Lastekaitse vaates on oluline, et hädaohus täiskasvanud perevägivalla ohvri kasvatatav laps võib olla abivajav või hädaohus olev laps. Seetõttu ei keskendu MARAC ainult ohvri kaitsele, vaid aitab kavandada ka laste turvalisuse, heaolu ja vajaliku abi korraldamist.

MARAC ei ole üksikteenus ega pelgalt koosolek. See on kokkulepitud juhtumikorralduse viis, kus iga võrgustiku liige võtab konkreetse vastutuse turvalisusplaani elluviimise eest ning tegevusi jälgitakse ühiselt.

Kuvatud allikad:

- Elude päästmine võrgustikutöös MARACi abil, lk 40-46
- MARAC-i juhendmaterjal — https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2023-02/MARAC-i%20juhendmaterjal.pdf, lk 4-8

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 27. pdf_vaesus_statistika

**Küsimus:** Mida näitavad andmed vaesuse kohta Eestis?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "answer_must_include_any": [
    "vaesus",
    "vaesuse",
    "suhteline vaesus",
    "toimetulek"
  ]
}
```

### Vastus A — G68f304ba43b18132

Andmed näitavad, et vaesus Eestis ei ole ühesugune nähtus, vaid jaguneb eri sügavusega kihtideks.

Üldiselt eristatakse:
- otsest vaesust, kus sissetulek on kuni 80% vaesuspiirist ja see seab ohtu esmavajaduste, eriti toidu ja eluaseme katmise;
- toimetulekut ohustavat vaesust, kus sissetulek on 81–100% vaesuspiirist ning miinimumvajadused võivad olla küll kaetud, kuid tavapärane majanduslik toimetulek ja osalemine ühiskonnas on tugevalt pärsitud;
- vaesuse riskipiirkonda, kus sissetulek on 101–125% vaesuspiirist ja inimene ei ole veel vaene, kuid on juba kõrges vaesumisriskis.

See tähendab, et vaesus ei ole ainult küsimus “kas inimene on vaene või mitte”, vaid ka sellest, kui lähedal ta on vaesuspiirile ja kui haavatav ta on ootamatute elusündmuste suhtes.

Eestis on oluline ka see, et vaesus ja sellega seotud toimetulekuraskused mõjutavad otseselt sotsiaalset ja majanduslikku osalemist. Eriti haavatavad on inimesed, kelle sissetulek jääb vaesuspiiri lähedale, sest väikegi muutus sissetulekus või kuludes võib nad kiiresti keerulisemasse olukorda viia.

Kui soovid, saan sellest teha ka lühikese ülevaate sellest, kuidas vaesust Eestis tavaliselt mõõdetakse ja mida need näitajad praktikas tähendavad.

Kuvatud allikad:

- Vaesus Eestis — https://www.stat.ee/sites/default/files/2020-07/Vaesus_Eestis_sisu.pdf, lk 6-7, 9-10, 14-18, 31, 47, 51, 53, 57, 65, 77-78, 81-82, 96, 130, 151, 156, 195
- Pikaajalise hoolduse olukord Eestis ja riigi väljakutsed omastehooldajate koormuse vähendamisel, lk 8-11
- Puuetega inimeste sotsiaalse rehabilitatsiooni vajaduse eelhindamine ja rehabilitatsiooniteenuste sisu kujundamine Eestis, lk 43-51
- Sotsiaalhoolekande seadus § 142 Sotsiaalteenuste ja -toetuste andmeregistri andmed — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G984f7af42efe8ad3

Eestis ei ole vaesus ühesugune nähtus. Andmed näitavad, et inimesi võib eristada vaesuse sügavuse järgi:

- otsene vaesus – sissetulek on kuni 80% vaesuspiirist ning põhivajaduste, eelkõige toidu ja eluaseme, katmine võib olla ohus;
- toimetulekut ohustav vaesus – sissetulek jääb 81–100% vaesuspiirist; esmased vajadused võivad olla kaetud, kuid majanduslik toimetulek ja ühiskonnaelus osalemine on tugevalt piiratud;
- vaesusriski piirkond – sissetulek on 101–125% vaesuspiirist. Need inimesed ei pruugi veel olla vaesed, kuid üks negatiivne sündmus – näiteks töökaotus, haigus või suur eluasemekulu – võib nende olukorda kiiresti halvendada.

Seega näitavad andmed eelkõige seda, et vaesust tuleb vaadata astmeliselt, mitte ainult jaotusega „vaene“ ja „mittevaene“. Sissetuleku lähedus vaesuspiirile mõjutab inimese toimetuleku kindlust, eluaseme- ja toidukulude katmist ning võimalust ühiskonnaelus osaleda.

Sotsiaaltöö vaates tähendab see, et abi vajaduse hindamisel ei piisa ainult sissetuleku vaatamisest. Olulised on ka eluasemekulud, leibkonna koosseis, tervis, töövõime, hoolduskoormus ja muud toimetulekut mõjutavad asjaolud.

Praegu kasutatud andmed ei anna piisavalt täpset alust Eesti vaesuses elavate inimeste tänapäevase osakaalu või piirkondliku jaotuse nimetamiseks.

Kuvatud allikad:

- Vaesus Eestis — https://www.stat.ee/sites/default/files/2020-07/Vaesus_Eestis_sisu.pdf, lk 6-7, 9-10, 14-18, 31, 47, 51, 53, 57, 65, 77-78, 81-82, 96, 130, 151, 156, 195
- Pikaajalise hoolduse olukord Eestis ja riigi väljakutsed omastehooldajate koormuse vähendamisel, lk 8-11
- Puuetega inimeste sotsiaalse rehabilitatsiooni vajaduse eelhindamine ja rehabilitatsiooniteenuste sisu kujundamine Eestis, lk 43-51
- Sotsiaalhoolekande seadus § 142 Sotsiaalteenuste ja -toetuste andmeregistri andmed — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 28. pdf_lapse_heaolu_hindamine

**Küsimus:** Kuidas hinnata lapse heaolu ja abivajadust?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "displayed_must_include": [
    "lapse heaolu"
  ],
  "answer_must_include_any": [
    "hindami",
    "heaolu"
  ]
}
```

### Vastus A — Geaf6918f2f6a338a

Lapse heaolu ja abivajadust hinnatakse terviklikult, vaadates nii riske, vajadusi kui ka seda, kui sobivad on planeeritavad meetmed lapsele ja perele.

Praktiliselt tähendab see kolme sammu:

1. Kogutakse teave
Vaadatakse lapse olukorda eri eluvaldkondades: füüsiline tervis, vaimne tervis, emotsionaalne ja sotsiaalne toimetulek, areng, õppimine, pereolud, majanduslik olukord ja turvalisus. Abivajadus võib avalduda näiteks puudest, õpiraskustest, käitumis- või sõltuvusprobleemidest, väärkohtlemise või hooletusse jätmise kahtlusest või sellest, et vanemad ei suuda tagada vajalikku hooldust ja arengut toetavat keskkonda.

2. Hinnatakse riski ja kaitsetegureid
Riski hindamisel vaadatakse, kui palju on eri valdkondades riskitegureid ja kui vähe on kaitsetegureid. Mida rohkem riske ja vähem kaitsetegureid, seda kõrgem on tervikrisk ning seda intensiivsemaid ja ulatuslikumaid meetmeid võib vaja minna.

3. Selgitatakse vajadused ja meetmete sobivus
Vajaduste hindamisel valitakse välja need riskitegurid, mida on kõige olulisem esmajärjekorras muuta ja mille mõjutamisel oleks lapse heaolule kõige suurem kasu. Seejärel hinnatakse, millised abinõud on lapsele ja perele kõige sobivamad, arvestades nende soove, võimalusi ja motivatsiooni.

Lastekaitsetöös tähendab see ka seda, et hinnang ei põhine ainult ühel juhtumil või ühel vestlusel, vaid kogutud teavet tuleb analüüsida koos lapse olukorra eri külgi mõjutavate teguritega. Oluline on vaadata ka, kuidas ühe valdkonna probleemid mõjutavad teisi valdkondi, näiteks kuidas perepinged mõjutavad lapse emotsionaalset heaolu või koolis hakkamasaamist.

Kui soovid, saan selle sama teema kohta anda ka praktilise hindamisküsimuste loetelu lastekaitsetööks.

Kuvatud allikad:

- Lapse heaolu hindamise käsiraamat — https://www.sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-11/k%C3%A4siraamat.pdf, lk 2-3, 8, 12-13, 16, 19, 23-27, 32, 64-65, 67-68
- Lapse heaolu hindamise käsiraamatust, lk 71-76

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Gfd093ebc785bae89

Lapse heaolu ja abivajadust hinnatakse tervikuna: vaadatakse nii lapse arenguvajadusi, tema igapäevast elukeskkonda ja vanemate suutlikkust kui ka riski- ja kaitsetegureid. Eesmärk ei ole ainult probleemi tuvastada, vaid mõista, millist abi laps ja pere vajavad ning millised meetmed parandaksid lapse heaolu kõige tõhusamalt.

1. Selgita välja, kas laps vajab täiendavat abi

Abivajav laps on laps, kelle heaolu on ohustatud või kelle puhul on tekkinud kahtlus väärkohtlemisele, hooletusse jätmisele või muule lapse õigusi rikkuvale olukorrale. Abivajadus võib avalduda näiteks lapse:

- füüsilises või vaimses tervises;
- emotsionaalses ja psühholoogilises seisundis;
- sotsiaalsetes suhetes ja käitumises;
- kognitiivses ja hariduslikus arengus;
- majanduslikus olukorras;
- igapäevases hoolduses ja turvalisuses.

Arvesse tuleb võtta ka puuet, hariduslikku erivajadust, õpiraskusi, käitumis- või sõltuvusprobleeme ning vanemate raskusi lapse hooldamisel ja arengut toetava keskkonna tagamisel.

2. Kogu teavet mitmest allikast

Eelhindamisel antakse esmane hinnang lapse arenguvajadustele ja olukorrale. Teavet kogutakse võimalusel:

- vestlusest lapsega, arvestades tema vanust ja arengutaset;
- vestlusest vanemate või teiste hooldajatega;
- lapse vaatluse kaudu;
- õppeasutusest, tervishoiu- ja teistelt lapsega tegelevatelt spetsialistidelt;
- pere ja lähivõrgustiku kohta;
- varasemate toetuste, teenuste ja juhtumite kohta.

Üksik vestlus või üks tähelepanek ei pruugi anda lapse olukorrast piisavat pilti. Eriti oluline on hinnata lapse sotsiaalset ja emotsionaalset heaolu, sest need probleemid ei pruugi lühikese kohtumise jooksul nähtavaks saada.

3. Hinda lapse olukorda eri heaoluvaldkondades

Tervikpildi saamiseks tuleks vaadelda vähemalt järgmisi küsimusi:

- Kas lapse füüsilised ja tervisega seotud vajadused on kaetud?
- Kas laps on kodus, koolis ja muus keskkonnas turvaline?
- Kas lapsel on stabiilsed ja toetavad suhted?
- Kuidas laps emotsionaalselt toime tuleb?
- Kuidas kulgeb tema areng ja õppimine?
- Kas lapse käitumine ohustab teda ennast või teisi?
- Kas laps saab vajalikku hooldust, järelevalvet ja abi?
- Millised on pere majanduslikud, eluaseme- ja toimetulekuraskused?
- Kas vanemad mõistavad lapse vajadusi ja suudavad neile vastata?
- Milline on pere valmisolek koostööks ja muutusteks?

Kui lapsel on puue või muu erivajadus, tuleb hinnata ka tegevuspiiranguid, keskkonna sobivust ning võimalikke abivahendeid ja tugiteenuseid. Abivahendivajadust saab hinnata näiteks rehabilitatsioonimeeskond, kes vaatleb lapse liikumist ja toimetulekut ning teeb vajadusel vastavad soovitused.

4. Kaardista riski- ja kaitsetegurid

Riski- ja kaitsetegureid tuleb hinnata koos, mitte eraldi.

Riskitegurid võivad olla näiteks:

- väärkohtlemine või hooletusse jätmine;
- vanema tervise-, sõltuvus- või vaimse tervise probleemid;
- püsivad konfliktid ja ebaturvalised suhted;
- lapse arengulised või käitumuslikud raskused;
- vaesus, eluasemeprobleemid või sotsiaalne isoleeritus;
- vanema vähene suutlikkus või valmisolek lapse vajadustele vastata.

Kaitsetegurid võivad olla näiteks:

- lapsele turvaline ja hooliv täiskasvanu;
- toetavad peresuhted või muu lähivõrgustik;
- lapse enda tugevused ja toimetulekuoskused;
- koostöövalmidus;
- toimiv side kooli, lasteaia, tervishoiu või teiste spetsialistidega;
- sobivad teenused ja järjepidev tugi.

Seejärel tuleb analüüsida, kuidas tegurid üksteist mõjutavad. Näiteks võib vanema terviseprobleem mõjutada lapse hooldamist, lapse käitumisraskused suurendada perestressi ning sotsiaalse toe puudumine süvendada mõlemat probleemi.

5. Määra riski tase ja esmatähtsad vajadused

Riski hindamisel tuleb vaadata, kui palju riskitegureid esineb, kui tõsised need on, kui kiiresti olukord võib halveneda ning millised kaitsetegurid riski vähendavad. Mida rohkem on eri valdkondades riskitegureid ja mida vähem kaitsetegureid, seda ulatuslikumad ja intensiivsemad meetmed võivad olla vajalikud.

Kõiki probleeme ei pruugi olla võimalik korraga lahendada. Vajaduste hindamisel tuleb valida need riskitegurid, mille muutmine parandaks lapse heaolu kõige tõenäolisemalt ja kõige rohkem.

6. Kaasa laps ja pere

Lapse ja pere arvamused, soovid, võimalused ning motivatsioon tuleb välja selgitada ja meetmete kavandamisel arvesse võtta. Lapse kaasamine peab vastama tema vanusele ja arengutasemele. Samal ajal ei tähenda pere soovidega arvestamine seda, et lapse turvalisust või õigusi võiks ohtu jätta.

7. Vali sobivad ja proportsionaalsed meetmed

Meetmete intensiivsus ja ulatus peavad vastama hinnatud riski tasemele. Eelistada tuleb lapsele ja perele sobivaid lahendusi, mis aitavad vähendada konkreetseid riske ja tugevdada kaitsetegureid. Võimalikud meetmed võivad sõltuvalt olukorrast olla näiteks:

- nõustamine ja vanemluse toetamine;
- lapse psühholoogiline või muu vaimse tervise tugi;
- hariduslikud tugimeetmed;
- rehabilitatsioon ja abivahendid;
- pere sotsiaalne nõustamine või muu KOV-i korraldatav abi;
- võrgustikutöö kooli, tervishoiu ja teiste spetsialistidega;
- intensiivsem juhtumikorraldus, kui lapse abivajadus on ulatuslik või püsiv.

Meetmed peaksid olema seotud selgelt sõnastatud eesmärkidega: mida soovitakse lapse või pere olukorras muuta, kes mida teeb ja mille järgi hinnatakse edasiminekut.

8. Hinda mõju uuesti

Hindamine ei lõpe abi määramisega. Tuleb jälgida, kas lapse heaolu paraneb, kas riskitegurid vähenevad ja kas valitud meetmed on lapsele ning perele sobivad. Vajaduse korral tuleb tegevusplaani muuta, abi suurendada või vähendada.

Kokkuvõttes koosneb hea hindamine neljast põhiosast: lapse olukorra ja vajaduste kirjeldamine, riski- ja kaitsetegurite analüüs, lapse ja pere kaasamine ning sobivate ja proportsionaalsete meetmete kavandamine. Seda lähenemist toetab ka 2025. aasta „Lapse heaolu hindamise käsiraamat“.

Kuvatud allikad:

- Lapse heaolu hindamise käsiraamat — https://www.sotsiaalkindlustusamet.ee/sites/default/files/documents/2025-11/k%C3%A4siraamat.pdf, lk 2-3, 8, 12-13, 16, 19, 23-27, 32, 64-65, 67-68
- Lapse heaolu hindamise käsiraamatust, lk 71-76

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 29. edge_followup_paragraph

**Küsimus:** Räägi sellest paragrahvist lähemalt

**Fikseeritud vestlusajalugu:**

- user: Mis ütleb SHS § 23?
- assistant: SHS § 23 sätestab tugiisikuteenuse eesmärgi ja sisu.
  - allikad: Sotsiaalhoolekande seadus § 23 Tugiisikuteenuse eesmärk ja sisu

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "answer_must_include": [
    "tugiisik"
  ]
}
```

### Vastus A — G617ccc4d5b75b5cb

SHS § 23 räägib tugiisikuteenuse eesmärgist ja sisust.

See on kohaliku omavalitsuse korraldatav sotsiaalteenus, mille eesmärk on toetada inimese iseseisvat toimetulekut olukorras, kus ta vajab sotsiaalsete, majanduslike, psühholoogiliste või tervislike probleemide tõttu oma kohustuste täitmisel ja õiguste teostamisel olulisel määral kõrvalabi. Kõrvalabi tähendab siin eelkõige juhendamist, motiveerimist ning inimese suurema iseseisvuse ja omavastutuse arendamist.

Kui teenust osutatakse last kasvatavale isikule, on lisaks eesmärk tagada lapse hooldamine ning turvaline ja toetav kasvukeskkond. Lapse puhul on tugiisikuteenuse eesmärk koostöös last kasvatava isikuga lapse arengu toetamine. Vajaduse korral võib see hõlmata ka puudega lapse hooldustoimingute tegemist. Tugiisik aitab last arendavates tegevustes, juhendab ja motiveerib igapäevaelus toime tulema ning abistab suhtlemisel perekonnaliikmetega või väljaspool kodu.

Oluline eristus on see, et tugiisikuteenuse põhirõhk ei ole lihtsalt praktilisel abistamisel, vaid inimese toimetulekuvõime kasvatamisel. Ehk teenus on mõeldud pigem arendava ja juhendava toena kui täieliku asendamisena.

Kui soovid, võin järgmise sammuna selgitada ka, kuidas tugiisikuteenus erineb täisealise isiku hooldusest või asendushooldusest.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 23 Tugiisikuteenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G014a445a05609933

Sotsiaalhoolekande seaduse § 23 käsitleb tugiisikuteenuse eesmärki ja sisu. See on kohaliku omavalitsuse korraldatav sotsiaalteenus, mille eesmärk on toetada inimese iseseisvat toimetulekut.

Põhisisu on järgmine:

1. Täisealise või muu abi vajava isiku toetamine

Tugiisikuteenust võib vajada inimene, kellel on sotsiaalsed, majanduslikud, psühholoogilised või tervisega seotud probleemid ning kes vajab oma kohustuste täitmisel või õiguste teostamisel olulisel määral kõrvalabi.

Tugiisiku abi seisneb eelkõige:

- juhendamises;
- motiveerimises;
- igapäevase toimetuleku toetamisel;
- inimese iseseisvuse ja omavastutuse arendamisel.

Tugiisik ei tegutse inimese eest üldjuhul lihtsalt ära, vaid aitab inimesel vajalikke tegevusi paremini mõista, kavandada ja võimaluse korral ise teha.

2. Last kasvatava isiku toetamine

Kui teenust osutatakse last kasvatavale isikule, on täiendav eesmärk:

- toetada lapse hooldamist;
- aidata tagada lapse turvaline ja toetav kasvukeskkond.

See võib olla oluline näiteks olukorras, kus lapsevanem või muu last kasvatav isik vajab juhendamist lapse eest hoolitsemisel või pere igapäevaelu korraldamisel.

Seadus täpsustab, et asendushooldusteenust vahetult osutavat isikut ei loeta selle sätte tähenduses last kasvatavaks isikuks.

3. Lapsele osutatav tugiisikuteenus

Lapse puhul toimub teenus koostöös last kasvatava isikuga. Eesmärk on toetada lapse arengut ja igapäevast toimetulekut.

Tugiisik võib last:

- abistada arendavates tegevustes;
- juhendada ja motiveerida igapäevatoimingutes;
- toetada suhtlemisel pereliikmetega;
- abistada väljaspool kodu suhtlemisel ja asjaajamisel;
- puudega lapse puhul vajaduse korral aidata hooldustoimingute tegemisel.

Seega võib lapse tugiisikuteenuse praktiline sisu olla näiteks lapse toetamine õppimisel, suhtlemisel, tegevustes osalemisel või kodust väljaspool liikumisel. Teenuse täpne korraldus sõltub lapse ja pere vajadustest ning kohaliku omavalitsuse tehtavast hindamisest ja otsusest.

Oluline on eristada kolme tasandit: § 23 sätestab riikliku õigusliku raamistiku, kohaliku omavalitsuse ülesanne on teenus oma territooriumil korraldada ning konkreetne tugiisik osutab kokkulepitud abi vastavalt teenuse eesmärgile ja inimese vajadustele.

Paragrahvi lõige 4 lubab valdkonna eest vastutaval ministril kehtestada määrusega täpsemaid nõudeid tugiisikuteenuse eesmärgile, sisule ja tegevustele. Praegu kasutatud allikas ei täpsusta teenuse taotlemise korda, rahastamist, mahtu ega konkreetseid hindamiskriteeriume; need võivad sõltuda ka kohaliku omavalitsuse korraldusest.

Kuvatud allikad:

- Sotsiaalhoolekande seadus § 23 Tugiisikuteenuse eesmärk ja sisu — https://www.riigiteataja.ee/akt/130122025029

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 30. edge_no_corpus_answer_v2

**Küsimus:** Kui suur on hooldekodu koha maksumus Saksamaal?

**Ülesandespetsiifilised ootused:**

```json
{
  "answer_must_include_any": [
    "ei leia",
    "ei leidnud",
    "ei ole",
    "pole",
    "ei sisalda",
    "ei saa",
    "puudub",
    "Eesti"
  ],
  "answer_must_not_include": [
    "maksab täpselt"
  ]
}
```

### Vastus A — Gace8564797085424

Ma ei leidnud praeguse otsinguga sellele piisavalt täpset vastust Saksamaa hooldekodu koha maksumuse kohta.

Kui soovid, saan aidata Sul koostada täpse päringu või võrrelda Saksamaa hooldekodu kulusid hooldusvajaduse, liidumaa või teenusetüübi järgi.

Kuvatud allikad:

- puuduvad

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Gcc5d552b835630ef

Saksamaal ei ole hooldekodu kohale ühtset hinda. Maksumus sõltub liidumaast, hooldusvajaduse tasemest, hooldekodust ja toa liigist. Arvestada tuleb tavaliselt nelja osaga:

- hoolduse ja toetamise tasu;
- majutus ja toitlustus;
- hoone või investeerimiskulud;
- elaniku omaosalus pärast hoolduskindlustuse panust.

Ma ei leidnud praeguse otsinguga Saksamaa kohta piisavalt täpset ja ajakohast hinnainfot, et nimetada usaldusväärset summat. Täpse maksumuse hindamiseks on vaja teada vähemalt Saksamaa liidumaad, hooldusvajaduse taset ja seda, kas küsitakse ühe- või kahese toa hinda.

Kuvatud allikad:

- puuduvad

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 31. pdf_inimkaubandus_ennetus

**Küsimus:** Kuidas ennetada inimkaubandust noortega töötamisel?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "displayed_must_include": [
    "inimkaubandus"
  ],
  "answer_must_include": [
    "inimkaubandus"
  ]
}
```

### Vastus A — G458f12dad4e06c9f

Inimkaubanduse ennetamisel noortega töötamisel on keskne suurendada noore teadlikkust ohtudest ja anda talle praktilised oskused enda kaitsmiseks. Oluline on rääkida teemast viisil, mis ei hirmuta ega süüdista noort, vaid aitab tal teha teadlikke otsuseid ja abi küsida.

Praktilised põhimõtted:

1. Arutlege, kuidas inimkaubandus võib avalduda

Selgitage, et inimkaubandus ei pruugi alguses paista vägivalla või sundimisena. Noort võidakse meelitada:

- välismaale tööle või õppima;
- modelli- või meelelahutustööle;
- noorsoovahetusse või praktikasse;
- interneti- ja jututoa kaudu tehtud pakkumisega;
- näiliselt usaldusväärse töövahendusfirma kaudu.

Rõhutage, et oht võib peituda pettuses, tegelikest tingimustest erinevas pakkumises, võlas, dokumentide äravõtmises või olukorras, kus noor ei saa vabalt lahkuda.

2. Õpetage töö- ja reisipakkumist kontrollima

Noor peaks enne välismaale tööle või õppima minekut:

- kontrollima tööandja ja vahendaja tausta;
- nõudma kirjalikku lepingut, kus on kirjas tööülesanded, töötasu, tööaeg, elukoht ja muud olulised tingimused;
- hoiduma ainult suulisest kokkuleppest;
- võrdlema pakkumises lubatut tegelike tingimustega;
- uurima, kelle poole saab probleemide korral pöörduda;
- jätma lepingu ja reisiandmete koopiad usaldusväärsele lähedasele.

Selgitage, et ebamäärane tööpakkumine, surve kiiresti otsustada või lubadus teenida ebarealistlikult palju võib olla ohumärk.

3. Rääkige noore õigustest ja enesekaitsest

Koolituses võiks siduda inimkaubanduse teema Eesti tööturu põhitõdedega: millised andmed peavad töötingimuste kohta olema arusaadavad, miks kirjalik leping on oluline ja miks noor ei peaks loobuma oma dokumentidest või nõustuma tingimustega, mida talle enne ei tutvustatud.

Harjutage läbi olukordi, kus noor peab:

- ütlema pakkumisele „ei”;
- küsima täpsustavaid küsimusi;
- katkestama vestluse või lahkuma ebaturvalisest olukorrast;
- pöörduma täiskasvanu või spetsialisti poole;
- toetama kaaslast, kes võib olla sattunud ohtu.

4. Looge turvaline võimalus abi küsimiseks

Noor ei pruugi ohust rääkida, kui ta kardab hukkamõistu, pahandust või seda, et teda ei usuta. Seetõttu tasub:

- küsida rahulikult ja hinnanguvabalt;
- mitte süüdistada noort tehtud otsustes;
- võtta tema juttu tõsiselt;
- selgitada, milliseid samme saab teha;
- kaasata sobivad spetsialistid vastavalt olukorra kiireloomulisusele.

Kui noor viibib parasjagu ohustavas olukorras, tuleb esmalt hinnata tema vahetut turvalisust ja korraldada abi. Täpne edasine tegevus sõltub juhtumist ning sellest, kas tegemist on alaealise, välismaal viibiva noore või võimaliku vägivalla ja sundimisega.

5. Kasutage arutelusid ja praktilisi ülesandeid

Noortega sobivad näiteks:

- töö- ja reisikuulutuste analüüsimine;
- „ohumärkide” äratundmise harjutused;
- rollimäng, kus kontrollitakse tööpakkumist;
- arutelu selle üle, milline on turvaline ja milline kahtlane kokkulepe;
- tegevusplaan juhuks, kui sõber ei saa tööandjaga ühendust või tema tingimused muutuvad.

Oluline on käsitleda lisaks ennetamisele ka seda, kuidas toimida siis, kui probleem on juba tekkinud, ning kuidas aidata hättasattunud kaaslast. Eesmärk ei ole õpetada noort kõiki olukordi ise lahendama, vaid aidata tal ohumärke märgata, riski vähendada ja õigel ajal abi kaasata.

Kuvatud allikad:

- Inimkaubanduse ennetamine: metodoloogia tööks noortega — https://sm.ee/sites/default/files/content-editors/eesmargid_ja_tegevused/Sooline_vordoiguslikkus/Inimkaubandus_ja_prostitusioon/inimkaubanduse_ennetamine_metodoloogia_tooks_noortega.pdf, lk 4, 6, 11, 28, 36, 55-56, 59, 62-65, 67-68, 75-76, 81-84, 89, 102-103

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G079dc2879126c0d8

Noortega töötamisel aitab inimkaubandust ennetada eelkõige see, kui noortele antakse selge ja praktiline teadmine riskidest ning nende enda õigustest.

Olulised ennetusvõtted on:
- selgitada, kuidas inimkaubandus võib varjatud kujul välja näha, mitte ainult kui „äärmuslik” kuritegu
- rääkida turvalistest viisidest välismaale tööle või õppima minemiseks
- õpetada, et töö- ja elutingimused, leping ja kokkulepped peavad olema arusaadavad ning kontrollitavad
- tutvustada noortele Eesti tööturu regulatsioone ja seda, kuidas oma õiguste eest seista
- arutada läbi riskisituatsioone, näiteks kahtlased tööpakkumised, väga head lubadused, surve kiiresti otsustada või dokumentide ära andmine
- anda noortele oskus märgata ohumärke ja teada, kuidas abi otsida, kui endal või kaaslasel tekib probleem
- rääkida ka sellest, kuidas hättasattunud kaaslast toetada ja kelle poole pöörduda

Koolitusmaterjalide põhjal on eriti oluline, et noored ei näeks ohtu ainult „teiste probleemina”, vaid oskaksid seostada seda ka enda võimalike õppimise, tööle mineku või ajutise välismaal viibimise plaanidega.

Kui soovid, võin selle põhjal teha ka lühikese noortele mõeldud ennetussõnumi või töötoa kava.

Kuvatud allikad:

- Inimkaubanduse ennetamine: metodoloogia tööks noortega — https://sm.ee/sites/default/files/content-editors/eesmargid_ja_tegevused/Sooline_vordoiguslikkus/Inimkaubandus_ja_prostitusioon/inimkaubanduse_ennetamine_metodoloogia_tooks_noortega.pdf, lk 4, 6, 11, 28, 36, 55-56, 59, 62-65, 67-68, 75-76, 81-84, 89, 102-103

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 32. pdf_kubervagivald_ohver

**Küsimus:** Kuidas aidata kübervägivalla ohvrit?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "answer_must_include_any": [
    "küber",
    "ohvr",
    "vägival"
  ]
}
```

### Vastus A — G0797db53d2cc2210

Kübervägivalla ohvri aitamisel on esmane eesmärk vähendada vahetut ohtu, taastada turvatunne ja ühendada inimene sobiva abiga.

1. Hinda vahetut ohtu

- Küsi rahulikult, kas vägivallatseja ähvardab ohvrit, jälitab teda, levitab intiimset materjali või võib ohustada tema elu ja tervist.
- Kui elu või tervis on ohus, helista 112.
- Kui ohvriks on laps või juhtum puudutab last, saab nõu ja abi lasteabitelefonilt 116 111 ning veebilehelt lasteabi.ee.
- Ära eelda, et veebis toimuv on „vähem tõsine“ – digikanalid võivad võimaldada pidevat jälitamist, ähvardamist ja kontrollimist.

2. Kuula ja usu ohvrit

- Ütle selgelt, et juhtunu ei ole tema süü.
- Ära süüdista teda selles, miks ta sõnumeid avas, vastas, pilte saatis või suhtlust varem ei lõpetanud.
- Lase ohvril otsustada, millises tempos ta tegutseb, välja arvatud olukorras, kus on vahetu tõsine oht.
- Arvesta, et häbi, hirm ja pidev valvelolek võivad takistada abi otsimist.

3. Koostage turvaplaan

Aidake läbi mõelda:

- millised kontod, seadmed ja suhtluskanalid võivad olla ohustatud;
- kes on usaldusväärne inimene, kelle poole saab kiiresti pöörduda;
- kuidas vähendada kontakti vägivallatsejaga nii, et see ei suurendaks ohtu;
- kus hoitakse tõendeid ja kes aitab neid süstematiseerida;
- mida teha, kui ähvardused või jälitamine jätkuvad.

Tõendeid võib olla oluline säilitada: sõnumid, kasutajanimed, kuupäevad, veebilingid, ekraanipildid ja ähvarduste kirjeldused. Neid ei peaks levitama rohkem kui abi saamiseks vajalik.

4. Suuna sobiva abi juurde

- Ohvriabi kriisitelefon 116 006 pakub ööpäevaringset kriisinõustamist; välismaalt saab helistada numbril +372 614 7393.
- Nõu saab ka palunabi.ee tekstivestluses.
- Naistevastase vägivalla korral saab pöörduda naiste tugikeskusesse, kus pakutakse terviklikku abi ka kübervägivalla puhul.
- Veebipolitseinikult saab küsida nõu internetis toimunud juhtumi kohta.
- Vaimse tervise veebinõustamisele saab registreeruda Sotsiaalkindlustusameti iseteeninduses.
- Kui ohver on vägivallatseja ise või kardetakse vägivaldset käitumist, saab abi vägivallast loobumise tugiliinilt 660 6077 tööpäeviti kell 10–16.

Spetsialistina dokumenteerige ohvri kirjeldus võimalikult täpselt, vältige süüdistavat keelt ning leppige kokku konkreetne järgmine samm: näiteks turvaplaani täiendamine, ohvriabiga ühenduse võtmine või politseile pöördumise kaalumine.

Kuvatud allikad:

- Juhendmaterjal kübervägivallast ohvritega töötavatele spetsialistidele — https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-10/Juhendmaterjal%20k%C3%BCberv%C3%A4givallast%20ohvritega%20t%C3%B6%C3%B6tavatele%20spetsialistidele.pdf, lk 1-5, 7-10, 14-19, 21-22, 24-25

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — Ga506042f78bde981

Kübervägivalla ohvri aitamisel on oluline tegutseda kiiresti, rahulikult ja ohvri kontrolli säilitamist toetavalt.

1. Hinda vahetut ohtu
Kui on oht elule või tervisele, helista kohe 112.

2. Kuula ja usu
Anna inimesele selge sõnum, et juhtunu on tõsine ja tema ei ole süüdi. Ära suru peale otsuseid ega küsi süüdistavalt.

3. Aita turvalisust suurendada
Soovita lõpetada otsene kontakt vägivallatsejaga, muuta vajadusel paroolid, vaadata üle sotsiaalmeedia privaatsusseaded ja säilitada tõendid, näiteks ekraanipildid, sõnumid ja kuupäevad.

4. Suuna sobiva abini
Abi ja nõu saab:
- 116 006 – Sotsiaalkindlustusameti ohvriabi kriisitelefon, kriisinõustamine ööpäevaringselt
- 116 111 – lasteabitelefon
- 660 6077 – vägivallast loobumise tugiliin tööpäeviti kell 10.00–16.00
- palunabi.ee – saab nõu ka tekstivestluses
- lasteabi.ee – saab nõu ka tekstivestluses
- vaimse tervise veebinõustamine – tasuta teenus, millele saab registreeruda iseteenindusest
- naiste tugikeskused – kui tegemist on naistevastase vägivallaga, sh kübervägivald

5. Kui on laps või noor, kaasake lasteabi
Lapse puhul on oluline kiiresti kasutada lasteabi telefoni või veebinõustamist.

6. Vajadusel paku järgnevat tuge
Aita ohvril jõuda ohvriabitöötaja, kriisinõustamise või muu spetsialisti juurde ning jälgi, et ta ei jääks juhtunuga üksi.

Kui soovid, võin sellest teha ka lühikese tegutsemisplaani spetsialistile või kliendiga kasutamiseks.

Kuvatud allikad:

- Juhendmaterjal kübervägivallast ohvritega töötavatele spetsialistidele — https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-10/Juhendmaterjal%20k%C3%BCberv%C3%A4givallast%20ohvritega%20t%C3%B6%C3%B6tavatele%20spetsialistidele.pdf, lk 1-5, 7-10, 14-19, 21-22, 24-25

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 33. pdf_hoolekande_kvaliteet

**Küsimus:** Millised on hoolekandeteenuste kvaliteedi põhimõtted?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "displayed_must_include": [
    "kvaliteed"
  ],
  "answer_must_include": [
    "kvaliteed"
  ]
}
```

### Vastus A — G85342d8671026e8f

Hoolekandeteenuste kvaliteedi üheksa põhimõtet on:

1. Isikukesksus – teenus lähtub inimese vajadustest, soovidest, võimetest ja eesmärkidest.
2. Võimestav iseloom – teenus toetab inimese iseseisvust, arengut ja võimalust oma elu puudutavates otsustes kaasa rääkida.
3. Tulemustele orienteeritus – teenusel peavad olema inimese jaoks tähenduslikud ja jälgitavad tulemused.
4. Vajaduspõhine lähenemine – abi korraldatakse tegeliku abivajaduse, mitte ainult teenuseosutaja olemasolevate võimaluste järgi.
5. Terviklik lähenemine – arvestatakse inimese elu eri valdkondade ja vajaduste omavahelisi seoseid.
6. Isiku õiguste kaitse – austatakse inimese väärikust, enesemääramist, privaatsust ja muid õigusi.
7. Kaasamine – inimene kaasatakse tema kohta tehtavatesse otsustesse ning võimalusel ka teenuse arendamisse.
8. Töötaja pädevus ja eetika – teenust osutavad piisavate teadmiste, oskuste ja eetilise vastutustundega töötajad.
9. Organisatsiooni hea töökorraldus ja kvaliteetne juhtimine – teenuseosutaja korraldab töö läbimõeldult, hindab teenuse kvaliteeti ja arendab seda pidevalt.

Praktikas tähendab see, et kvaliteet ei seisne ainult teenuse olemasolus, vaid selles, kas teenus aitab konkreetsel inimesel võimalikult iseseisvalt toime tulla, osaleda kogukonnaelus ja saavutada talle olulisi eesmärke. Kvaliteedi tagamine on pidev arendusprotsess, sest muutuvad nii inimeste vajadused kui ka sobivad tööviisid.

Kuvatud allikad:

- Hoolekandeteenuste kvaliteedi juhendmaterjal — https://www.sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/hoolekandeteenuste_kvaliteedi_juhendmaterjal.pdf, lk 4-9, 32, 35, 38

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G2a3e2f8ede1c67d0

Hoolekandeteenuste kvaliteedi põhimõtted on üldjoontes need, mille järgi teenus peab olema inimesekeskne ja toimima nii, et see päriselt toetab abivajaja toimetulekut.

Allikate põhjal on kinnitust saanud järgmised põhimõtted:
- isikukesksus
- võimestav lähenemine
- tulemustele orienteeritus
- vajaduspõhine lähenemine
- terviklik lähenemine
- isiku õiguste kaitse
- kaasamine
- töötaja pädevus ja eetika
- organisatsiooni hea töökorraldus ja kvaliteetne juhtimine

Oluline mõte on ka see, et kvaliteet ei ole kunagi „valmis“ – teenuse kvaliteedi tagamine tähendab pidevat arendamist ja muutmist vastavalt inimeste vajadustele.

Kui soovid, võin need põhimõtted lahti selgitada ka ühe kaupa praktiliste näidetega sotsiaalteenuse kontekstis.

Kuvatud allikad:

- Hoolekandeteenuste kvaliteedi juhendmaterjal — https://www.sotsiaalkindlustusamet.ee/sites/default/files/documents/2024-02/hoolekandeteenuste_kvaliteedi_juhendmaterjal.pdf, lk 4-9, 32, 35, 38

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 34. pdf_toovoime_reform

**Küsimus:** Mida näitavad uuringud töövõimereformi mõju kohta?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "answer_must_include": [
    "töövõime"
  ]
}
```

### Vastus A — G591d017281aae069

Uuringud näitavad peamiselt seda, et töövõimereformiga kaasnes vähenenud töövõimega inimeste tööturul osalemise kasv ja töötamise suhtes pigem positiivsem hoiak.

Peamised punktid, millele praegused allikad kinnitust annavad:
- vähenenud töövõimega inimeste tööhõive kasvas reformi järel;
- reformi sihtrühmas ja ka tööandjate seas paranes hinnang reformi tulemuslikkusele;
- mittetöötavate vähenenud töövõimega inimeste ja töövõimetuspensionäride seas oli huvi tasustatud töö vastu üsna suur, umbes pooltel;
- töö leidmise võimalused paranesid, kuigi tööotsing võis võtta nende seas keskmiselt rohkem aega kui täieliku töövõimega inimestel;
- reformi mõju ei olnud ühesugune kõigis rühmades, vaid sõltus ka inimeste olukorrast ja tööjõunõudlusest;
- reformi ajal mõjutas tööturukäitumist lisaks poliitikareeglite muutusele ka soodne majanduslik olukord ja tööjõunõudluse kasv.

Üks oluline sisuline järeldus on ka see, et reformi üks keskseid mõjusid oli töötamise võimaldamine ka osalise või puuduva töövõimega inimestele. See tuli uuringutes välja kui suur pluss, sest varem oli töö ja toetuse kombinatsioon piiratum.

Kui soovid, saan selle lahti võtta veel ka nii, et eristan:
- mõju tööhõivele,
- mõju hoiakutele,
- mõju tööandjatele,
- ja mida uuringud ütlevad reformi piiride kohta.

Kuvatud allikad:

- Teadlikkus ja hoiakud vähenenud töövõimega inimeste ning töövõimereformi teemal — https://mkm.ee/sites/default/files/documents/2023-07/2017_tvr_koondraport.pdf, lk 16, 29, 109-111, 114-115, 118-120, 122, 126
- Töövõime toetamise süsteemi loomise ja juurutamise makromajandusliku mõju hindamine — https://www.mkm.ee/sites/default/files/documents/2023-07/T%C3%B6%C3%B6v%C3%B5ime%20toetamise%20s%C3%BCsteemi%20loomise%20ja%20juurutamise%20makromajandusliku%20m%C3%B5ju%20hindamine%20l%C3%B5pparuanne%20%282%29.pdf, lk 6-7, 9, 22-23, 131, 177, 197, 214-215, 229, 249-251, 255, 257
- Töövõime toetamise skeemi loomise ja juurutamise vahehindamise lõpparuanne — https://mkm.ee/sites/default/files/documents/2023-07/T%C3%B6%C3%B6v%C3%B5ime%20toetamise%20skeemi%20loomise%20ja%20juurutamise%20vahehindamise%20l%C3%B5pparuanne.pdf, lk 70
- Pandeemia mõju laste vaimsele tervisele ja kuidas neid toetada. 1. osa, lk 70-76

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G7725e5cd3f559ecc

Uuringud näitavad, et töövõimereformiga on kaasnenud vähenenud töövõimega inimeste tööhõive kasv ja suurem osalemine tööturul. Samas ei saa seda mõju täielikult omistada ainult reformile, sest samal ajal mõjutasid tulemusi ka soodne majandusolukord, suurenenud tööjõunõudlus ja tööturuteenused.

Peamised uuringutes kinnitust leidnud järeldused on järgmised:

- Reformi sihtrühmas suurenes tasustatud tööga hõivatute osakaal varasema uuringuga võrreldes 46%-lt 53%-ni. Statistikaameti andmetel kasvas vähenenud töövõimega inimeste tööhõive samas võrdluses ligikaudu 48,7%-lt 50,4%-ni.
- Pikema ajavahemiku vaates suurenes vähenenud töövõimega hõivatute osakaal 32%-lt 2010. aastal 50%-ni 2017. aastal.
- Tööturule liikumist toetasid lisaks reformi reeglitele ka töövahendus, tööle asumise tugi ja aktiivsusnõuded. Uuringud rõhutavad, et reformi ja majandusolukorra mõju toimisid koos.
- Reform suurendas mõne inimese kindlustunnet töötamise suhtes. Oluliseks peeti seda, et ka osalise või puuduva töövõimega inimesel on võimalik töötada, kui tervis ja töötingimused seda võimaldavad.
- Huvi töötamise vastu on sihtrühmas suhteliselt suur, kuid töö leidmise suhtes ollakse sageli pessimistlikud. Vähenenud töövõimega tööotsijal võib töö leidmine võtta kauem aega kui täieliku töövõimega inimesel.
- Tulemused ei ole kõigi rühmade puhul ühesugused ning mõju hindamist raskendab asjaolu, et samal ajal muutusid nii toetuse maksmise reeglid, tööturupoliitika kui ka majandusolukord.

Kokkuvõttes viitavad uuringud sellele, et reform aitas suurendada vähenenud töövõimega inimeste tööturul osalemist ja töötamist, kuid tegemist ei olnud ühe teguri mõjuga. Praegu kasutatud uuringukatked ei anna piisavalt täpset alust hinnata reformi mõju näiteks eri vanuserühmade, omavalitsuste või konkreetsete teenuste lõikes.

Kuvatud allikad:

- Töövõime toetamise süsteemi loomise ja juurutamise makromajandusliku mõju hindamine — https://www.mkm.ee/sites/default/files/documents/2023-07/T%C3%B6%C3%B6v%C3%B5ime%20toetamise%20s%C3%BCsteemi%20loomise%20ja%20juurutamise%20makromajandusliku%20m%C3%B5ju%20hindamine%20l%C3%B5pparuanne%20%282%29.pdf, lk 6-7, 9, 22-23, 131, 177, 197, 214-215, 229, 249-251, 255, 257
- Teadlikkus ja hoiakud vähenenud töövõimega inimeste ning töövõimereformi teemal — https://mkm.ee/sites/default/files/documents/2023-07/2017_tvr_koondraport.pdf, lk 16, 29, 109-111, 114-115, 118-120, 122, 126
- Töövõime toetamise skeemi loomise ja juurutamise vahehindamise lõpparuanne — https://mkm.ee/sites/default/files/documents/2023-07/T%C3%B6%C3%B6v%C3%B5ime%20toetamise%20skeemi%20loomise%20ja%20juurutamise%20vahehindamise%20l%C3%B5pparuanne.pdf, lk 70
- Pandeemia mõju laste vaimsele tervisele ja kuidas neid toetada. 1. osa, lk 70-76

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 35. graph_kov_vormid_kontaktid

**Küsimus:** Mis vorme on koduteenuse taotlemiseks Kuusalu vallas vaja ja kelle poole pöörduda?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "answer_must_include_any": [
    "avaldus",
    "vorm",
    "taotlus"
  ],
  "answer_must_not_include": [
    "ei oska öelda"
  ]
}
```

### Vastus A — Gab683f973b907a07

Kuusalu valla koduteenuse taotlemiseks tuleb esitada taotlus. Taotleda saab:

- elektrooniliselt SPOKU kaudu;
- paberil avaldusega Kuusalu Vallavalitsusele.

Praegu kasutatud allikad ei kinnita eraldi allalaaditava vormi linki ega täpset vorminimetust. Seetõttu tasub paberavalduse vormi saamiseks küsida see vallavalitsuse sotsiaalteenistuselt.

Koduteenuse eesmärk on toetada täisealist inimest, kes vajab kodus igapäevatoimingutes abi. Teenuse täpne vajadus ja sisu selgitatakse abivajaduse hindamisel.

Pöörduda võib Kuusalu valla sotsiaalteenistuse poole, näiteks:

- Aigi Reinomägi, hoolekandespetsialist  
  telefon 606 6381 või 5191 4206  
  e-post aigi.reinomagi@kuusalu.ee
- Alvi Karp, juhtiv hoolekandespetsialist  
  telefon 606 6382 või 5196 8482  
  e-post alvi.karp@kuusalu.ee

Aadress: Mõisa tee 17, Kiiu alevik, 74604 Kuusalu vald. Kõik kontaktid on Kuusalu valla kontaktide lehel: https://www.kuusalu.ee/kontaktid1

Teenuse info ja taotlemise põhisuund: https://www.kuusalu.ee/koduteenus

Õiguslik alus on Kuusalu valla „Sotsiaalhoolekandelise abi andmise kord“ § 6 „Koduteenus“.

Kuvatud allikad:

- Koduteenus — https://www.kuusalu.ee/koduteenus
- Koduteenus — https://www.kuusalu.ee/koduteenus
- Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas § 6 Koduteenus — https://www.riigiteataja.ee/akt/406062023041?leiaKehtiv

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G3615634ebdfffe24

Kuusalu vallas on koduteenuse jaoks taotlemise info olemas, kuid eraldi taotlusvormi linki või vorminime kasutatud allikad ei kinnita. Seega saab öelda vaid nii palju, et taotlemine käib valla koduteenuse lehe kaudu ning õiguslik alus on Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas, § 6 „Koduteenus“.

Pöörduda tasub Kuusalu valla sotsiaalteenistuse poole. Sobivad kontaktid on näiteks:

- Aigi Reinomägi, hoolekandespetsialist  
  tel 606 6381, 5191 4206  
  aigi.reinomagi@kuusalu.ee

- Kristiina-Raivi Vilepaju, hoolekandespetsialist  
  tel 615 0504, 5305 2804  
  kristiina-raivi.vilepaju@kuusalu.ee

- Alvi Karp, juhtiv hoolekandespetsialist  
  tel 606 6382, 5196 8482  
  alvi.karp@kuusalu.ee

- Ene Rebane, sotsiaaltoetuste spetsialist  
  tel 606 6378, 5349 9503  
  ene.rebane@kuusalu.ee

Kõigi kontaktide ühine aadress on Mõisa tee 17, Kiiu alevik, 74604 Kuusalu vald.  

Kui soovid, võin järgmise sammuna sõnastada sulle ka lühikese taotluse teksti või aidata koostada pöördumise sotsiaalteenistusele.

Kuvatud allikad:

- Koduteenus — https://www.kuusalu.ee/koduteenus
- Koduteenus — https://www.kuusalu.ee/koduteenus
- Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas § 6 Koduteenus — https://www.riigiteataja.ee/akt/406062023041?leiaKehtiv

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 36. ajakiri_integreeritud_teenused

**Küsimus:** Mida kirjutab ajakiri Sotsiaaltöö integreeritud teenustest?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "answer_must_include": [
    "integreeritud"
  ]
}
```

### Vastus A — G3257f71200c674ba

Ajakiri Sotsiaaltöö käsitleb integreeritud teenuseid eelkõige lapse ja pere vajadustest lähtuva koostööna, kus tervishoiu-, haridus- ja sotsiaalvaldkond ning riigi ja kohaliku omavalitsuse tasand ei tegutse eraldi, vaid korraldavad toe koordineeritult.

Peamised mõtted on järgmised:

- Lapse abivajadust tuleks märgata võimalikult vara. Olulised märkajad ja toetajad on vanemad, perearstid, lapsehoidjad, õpetajad ning teised spetsialistid.
- Erivajadusega lapse perel on sageli keeruline abi leida, sest teenused on killustunud eri valdkondade ja asutuste vahel.
- Integreeritud korralduse eesmärk on vähendada pere asjaajamise koormust ning jõuda vajaliku abini kiiremini ja lihtsamalt.
- Koostöö eeldab, et ametnikud ja spetsialistid tunnevad teiste valdkondade võimalusi ja piiranguid ning oskavad abivajadust märgata.
- Lapse ja pere toetamisel tuleb arvestada inimese vaba tahtega ning õigusega abist keelduda, ka keerulistes olukordades.
- Kohalikele omavalitsustele on sellise koostöö korraldamisel toodud toeks piirkondlikud Rajaleidja keskused.

2019. aasta käsitlus selgitab peamiselt, miks integreeritud teenuseid vaja on ja millised takistused tulenevad teenuste killustatusest. 2020. aasta artikkel annab esimese tagasiside laste integreeritud tugiteenuste pilootprojektile ning rõhutab ametkondade koostöö, teadlikkuse suurendamise ja abivajaduse märkamise olulisust. Tegemist on ajakirjas kirjeldatud varasemate käsitluste ja piloodiga; nende väljavõtete põhjal ei saa teha järeldust kogu praeguse teenusekorralduse kohta.

Kuvatud allikad:

- Integreeritud teenused – kellele ja milleks?, lk 81-84
- Ajakiri Sotsiaaltöö – Laur Raudsoo vaade ajakirja arengule, lk 3-5
- Kuidas algas ajakirja Sotsiaaltöö teekond?, lk 10-12
- Integreeritud tugiteenused lastele – esimene tagasiside pilootprojektile, lk 53-56

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G849de6a024613cf0

Ajakiri Sotsiaaltöö kirjutab integreeritud teenustest eeskätt laste ja perede toetamise vaates. Põhiidee on, et abi peaks jõudma lapseni võimalikult vara ja koostöös eri valdkondade vahel, mitte olema killustunud.

Nendes artiklites rõhutatakse eriti:
- lapse abivajaduse varajast märkamist
- pere, õpetajate, perearstide ja teiste spetsialistide rolli
- sotsiaal-, haridus- ja tervishoiuvaldkonna koostööd
- seda, et kohalikele omavalitsustele on toeks piirkondlikud Rajaleidja keskused
- asjaolu, et teenused on sageli keerukad ja eri süsteemides jagunenud, mis teeb abi saamise peredele raskeks

Ühes artiklis käsitletakse ka pilootprojekti tagasisidet ning seda, kuidas ametkondade koostöö ja üksteise valdkonna eripärade tundmine aitab paremini abi korraldada.

Kui soovid, võin sama teema kohta teha ka lühikese kokkuvõtte eraldi artiklite kaupa.

Kuvatud allikad:

- Integreeritud teenused – kellele ja milleks?, lk 81-84
- Ajakiri Sotsiaaltöö – Laur Raudsoo vaade ajakirja arengule, lk 3-5
- Kuidas algas ajakirja Sotsiaaltöö teekond?, lk 10-12
- Integreeritud tugiteenused lastele – esimene tagasiside pilootprojektile, lk 53-56

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---

## 37. ajakiri_kinnise_lasteasutuse_alternatiiv

**Küsimus:** Mida kirjutab ajakiri Sotsiaaltöö kinnise lasteasutuse teenuse alternatiividest?

**Ülesandespetsiifilised ootused:**

```json
{
  "displayed_min": 1,
  "answer_must_include_any": [
    "tugevdatud toetus",
    "kinnise lasteasutuse",
    "KLAT"
  ]
}
```

### Vastus A — G32f7144c92dcfbb8

Ajakirja „Sotsiaaltöö“ kättesaadavad katkendid ei anna piisavalt täpset ülevaadet kinnise lasteasutuse teenuse alternatiividest ega loetle neid süstemaatiliselt.

Selgelt tuleb esile kaks mõtet:

- kinnise lasteasutuse teenus on mõeldud viimase abinõuna lapsele, kelle käitumine ohustab tõsiselt tema enda või teiste elu, tervist või arengut;
- enne või selle kõrval tuleb arendada mõjusamaid ja vähem piiravaid sekkumisi. 2018. aasta käsitluses märgitakse, et Sotsiaalkindlustusamet pidi analüüsima teenuse puudujääke, sealhulgas katmata sihtrühmi, ning otsustama tänapäevaste teadmiste alusel kõige mõjusama sekkumise üle.

2021. aasta artiklis käsitletakse kinnise lasteasutuse teenusele suunatud noorte toetamist mitteformaalse õppega. See on pigem teenuse sees või sellega seotud toetav lähenemine, mitte kinnise teenuse alternatiiv.

Seega võib ajakirjas avaldatud käsitluste põhjal öelda, et alternatiivide suund on seotud ennetuse, varasema sekkumise, lapse vajadustele vastava toe ja vähem piiravate teenustega, kuid praegu kasutatud allikad ei kinnita konkreetset alternatiivteenuste nimekirja.

Kuvatud allikad:

- Kinnise lasteasutuse teenus, lk 41-43
- Kinnise lasteasutuse teenusele suunatud noorte toetamine mitteformaalse õppega, lk 65-72

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

### Vastus B — G869a388df6af7b10

Ajakiri Sotsiaaltöö ei kirjelda nende allikate põhjal kinnise lasteasutuse teenusele selgeid konkreetseid alternatiive, vaid rõhutab pigem, et teenus on viimane abinõu lapsele, kelle käitumine ohustab tõsiselt tema enda või teiste elu, tervist või arengut.

Küll aga on seal kaks olulist suunda, mis sisuliselt puudutavad alternatiive:
1. Sotsiaalkindlustusamet töötas välja ühtse suunamisjuhise, et teenusele jõudmine oleks selgem ja kiirem.
2. Ameti töögrupp pidi analüüsima teenuse puudujääke, sh seda, millised sihtgrupid on veel katmata, ning otsustama, milline sekkumine oleks tänapäevaste teadmiste alusel mõjusaim.

Teisisõnu: Sotsiaaltöö artiklite põhjal räägitakse pigem vajadusest leida teenusele paremini sobivaid ja mõjusamaid sekkumisi kui nimetatakse valmis alternatiivteenuseid. Ma ei leidnud nende allikate põhjal piisavalt täpset loetelu konkreetsetest alternatiividest.

Kuvatud allikad:

- Kinnise lasteasutuse teenus, lk 41-43
- Kinnise lasteasutuse teenusele suunatud noorte toetamine mitteformaalse õppega, lk 65-72

Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __

Kriitiline viga: jah / ei. Kommentaar: ____________________

Paarieelistus: A / B / võrdne. Põhjendus: ____________________

---
