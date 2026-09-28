# Vestluste hindamine 2026-09-28

Plaan m4-sotsiaalai-corpus-chat-20260928-1048-r15c5ddd34, indeks search_generation_62a42e84ad2ba74a6a43fb9b6f464f7026550469b6c8551d0bb10306c14039ae, mudel gpt-6-luna (medium). Hinnanguline kulu 0.1915 USD.

| Tulemus | Pöördeid |
|---|---:|
| passed | 31 |
| search | 1 |
| answer | 6 |
| state | 2 |

## Raha otsas → vald → toimetulekutoetus → kontakt (`money-harku-contact`)

Allikas: scenarios-1.json. Vestlus: `cmul5csw70000e0kmtitkz0fi`.

### 1. [new] Mul on raha otsas ja toiduks ei jätku. — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 21988 ms, kokku 33854 ms, 0.0042 USD
- Leitud allikad (3): Sotsiaalhoolekande seadus; Toimetulekutoetuse kui riikliku sotsiaalabi korraldus; Kas sotsiaalabi on (turva)võrk või hüppelaud? Kuidas aidata inimesed kiiresti taas jalule
- Viidatud: Sotsiaalhoolekande seadus; Toimetulekutoetuse kui riikliku sotsiaalabi korraldus
- OK answer/completed: completed
- OK state/region: region null, expected null

> Mul on kahju, et sul on praegu toiduga raske. Kui elatusvahendite puudumise tõttu oled sotsiaalselt abitus olukorras, tuleb sulle osutada vältimatut sotsiaalabi. See peab tagama vähemalt toidu, riietuse ja ajutise majutuse. [S1]
>
> Toimetulekutoetust võib saada üksi elav inimene või pere, kelle raha ei kata toimetulekut ning kelle kuu netosissetulek pärast arvesse võetavate eluasemekulude mahaarvamist jääb alla toimetulekupiiri. Toetuse taotlemiseks pöördu elukohajärgse kohaliku omavalitsuse poole. [S2, S3]
>
> Ma ei saa sinu omavalitsuse kontakti ega kohaliku abi korraldust täpsustada, sest sa pole oma linna või valda öelnud.
>
> Mis linnas või vallas sa elad?

### 2. [same] Elan Harku vallas. — **passed**

- Piirkond harku_vald (olek harku_vald), vastuse liik partial, täpsustus false; otsing 6157 ms, kokku 22066 ms, 0.0054 USD
- Leitud allikad (45): Sotsiaalhoolekande seadus; Sotsiaalhoolekandelise abi andmise kord; Hooldajatoetus; Jõulutoetus; Koolitoetus eestkostel või peres hooldamisel olevale lapsele; Koolitoetus põhikooli või gümnaasiumi lõpetamisel; Koolitoetus peredele, kus õpib vähemalt kaks last; Koolitoetus peredele, kus õpib vähemalt üks laps; Koolitoetus kultuuri- ja spordiüritustel osalemiseks; Küttetoetus; Laagritoetus; Matusetoetus …
- Viidatud: Sotsiaalhoolekande seadus; Toidupank
- OK answer/completed: completed
- OK state/region: region harku_vald, expected harku_vald
- OK state/service_summary: summaries: Hooldajatoetus, Jõulutoetus, Koolitoetus peredele, kus õpib vähemalt üks laps, Koolitoetus kultuuri- ja spordiüritustel osalemiseks, Matusetoetus, Rimi toidukaart, Toidutoetus vähekindlustatud peredele, Toimetulekutoetus, Ühekordne toetus, Pere tulust sõltuva toetuse taotlus, Toimetulekutoetuse taotlus, Harku Sotsiaalkeskus, Eluruumi teenus, Koduteenus, Sotsiaaltransporditeenus, Toidupank, Üldhooldusteenus väljaspool kodu, Võlanõustamisteenus

> Kui elatusvahendite puudumise tõttu oled sattunud sotsiaalselt abitusse olukorda, tuleb sulle osutada vältimatut sotsiaalabi. See peab tagama vähemalt toidu, riietuse ja ajutise majutuse. [S1]
>
> Harku vallas saad taotleda Toidupanga toiduabi. Esita vabas vormis digiallkirjastatud avaldus e-postiga või paberkandjal Harku Vallavalitsusele. Sotsiaalhoolekandespetsialist hindab su olukorda ja abivajadust ning otsustab abi andmise. [S44]
>
> Ma ei saa selle info põhjal kinnitada, kas Toidupanga abi on praegu kohe saadaval; teenuseinfo ajakohasust pole praegu kontrollitud.

### 3. [same] Kellele ma saan helistada? — **state**

- Piirkond harku_vald (olek harku_vald), vastuse liik partial, täpsustus false; otsing 5730 ms, kokku 15358 ms, 0.0043 USD
- Leitud allikad (45): Sotsiaalhoolekande seadus; Sotsiaalhoolekandelise abi andmise kord; Hooldajatoetus; Jõulutoetus; Koolitoetus eestkostel või peres hooldamisel olevale lapsele; Koolitoetus põhikooli või gümnaasiumi lõpetamisel; Koolitoetus peredele, kus õpib vähemalt kaks last; Koolitoetus peredele, kus õpib vähemalt üks laps; Koolitoetus kultuuri- ja spordiüritustel osalemiseks; Küttetoetus; Laagritoetus; Matusetoetus …
- Viidatud: Toidupank
- OK answer/completed: completed
- OK state/region: region harku_vald, expected harku_vald
- **VIGA** state/details: details: Toidupank
- **VIGA** state/contacts: contact persons 0

> Harku vallas saad toiduabi taotlemiseks esitada digiallkirjastatud vabas vormis avalduse e-postiga või paberkandjal vallavalitsusele. Sotsiaalhoolekandespetsialist hindab sinu abivajadust ja otsustab abi andmise. [S42]
>
> Ma ei saa siin kinnitatud telefoninumbrit anda ega kinnitada, kas toiduabi on praegu saadaval. Teenuseinfo kontrolliti 2026. aasta aprillis.

## Emale abi kodus → Kose → parandus: Harku (`mother-kose-corrected-harku`)

Allikas: scenarios-1.json. Vestlus: `cmul5ecl0000ae0kmpg23337d`.

### 1. [new] Vajan emale kodus abi igapäevaste toimingutega. — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 19528 ms, kokku 31267 ms, 0.0042 USD
- Leitud allikad (2): Koduteenuste korraldus; Sotsiaalhoolekande seadus
- Viidatud: Sotsiaalhoolekande seadus; Koduteenuste korraldus
- OK answer/completed: completed
- OK state/region: region null, expected null

> Kui ema on täisealine ja ta ei saa terviseseisundi, tegevusvõime või elukeskkonna tõttu kodus vajalike toimingutega kõrvalabita hakkama, võib talle sobida koduteenus. Abi võib hõlmata näiteks kütmist, toidu valmistamist, eluruumi ja riiete korrastamist ning poes käimist või muud asjaajamist. Kohalik omavalitsus korraldab teenust ja hindab iga inimese kõrvalabi vajadust eraldi. [S2, S3]
>
> Võta ühendust ema kohaliku omavalitsusega ja küsi koduteenuse vajaduse hindamise kohta. Abi saamiseks võib omavalitsuse poole pöörduda abivajaja või tema seaduslik esindaja. [S1]
>
> Ma ei saa nende andmete põhjal öelda, millised on ema omavalitsuse kohalikud taotlemise tingimused või teenuse tasu.
>
> Millises omavalitsuses ema elab?

### 2. [same] Ema elab Kose vallas. — **passed**

- Piirkond kose_vald (olek kose_vald), vastuse liik partial, täpsustus true; otsing 6157 ms, kokku 16481 ms, 0.0059 USD
- Leitud allikad (54): Koduteenuste korraldus; Sotsiaalhoolekande seadus; Eakate tähtpäeva toetus; Eluasemekulude toetus; Erakorraline sotsiaalabi toetus; Esmakordselt kooli mineva lapse toetus; Hooldajatoetus puudega lapse hooldajale; Hooldajatoetus täisealise isiku hooldajale; Huvihariduse ja huvitegevuse toetus paljulapselistele ja vähekindlustatud peredele; Koduse lapse toetus; Kutseõppeasutuses õppiva õpilase toetus; Lapsehoiuteenuse toetus …
- Viidatud: Koduteenus
- OK answer/completed: completed
- OK state/region: region kose_vald, expected kose_vald
- OK state/service_summary: summaries: Erakorraline sotsiaalabi toetus, Tervisetoetus, Toimetulekutoetus, Avaldus koduteenuse taotlemiseks, Automaatne ravimikarp helialarmiga, Hädaabinumber, Kose Sotsiaal- ja Hariduse Tugiteenuste Keskus, Lasteabi, Ohvriabi, Omastehoolduse infopunkt, Asendushooldusteenus, Isikliku abistaja teenus, Isikukeskne hoolekandeteenus, Kodunupp, Koduteenus, Lapsehoiuteenus, Nõustamisteenused omastehooldajatele, Päevakeskuse teenus, Täisealise isiku hooldus, Trepironija teenus, Tugiisikuteenus lapsele, Tugiisikuteenus tööealisele isikule, Väljaspool isiku kodu osutatav üldhooldusteenus

> Kui ema on täisealine, võib koduteenus sobida, kui ta vajab kodus toimingutes kõrvalabi. Kose vallas osutab seda teenust Kose Sotsiaalkeskus. Vajadus selgitatakse välja kodukülastusel ning teenuse saamiseks koostatakse hooldusplaan ja sõlmitakse leping. Taotluseks täida koduteenuse avaldus, digiallkirjasta see ja saada vallavalitsusele või esita kohapeal. [S44]
>
> Kas ema on täisealine?

### 3. [correction] Vabandust, tegelikult elab ema Harkus. — **answer**

- Piirkond harku_vald (olek harku_vald), vastuse liik partial, täpsustus true; otsing 4425 ms, kokku 18676 ms, 0.0053 USD
- Leitud allikad (43): Sotsiaalhoolekandelise abi andmise kord; Hooldajatoetus; Jõulutoetus; Koolitoetus eestkostel või peres hooldamisel olevale lapsele; Koolitoetus põhikooli või gümnaasiumi lõpetamisel; Koolitoetus peredele, kus õpib vähemalt kaks last; Koolitoetus peredele, kus õpib vähemalt üks laps; Koolitoetus kultuuri- ja spordiüritustel osalemiseks; Küttetoetus; Laagritoetus; Matusetoetus; Nägemise parandamise toetus (alla 16‑aastastele) …
- Viidatud: Sotsiaalhoolekandelise abi andmise kord; Koduteenus
- OK answer/completed: completed
- OK state/region: region harku_vald, expected harku_vald
- OK state/service_summary: summaries: Hooldajatoetus, Jõulutoetus, Puudega isiku transporditoetus, Toidutoetus vähekindlustatud peredele, Toimetulekutoetus, Ühekordne toetus, Pere tulust mittesõltuva toetuse taotlus, Eakate päevakeskus, Harku Sotsiaalkeskus, Viipekeele tõlketeenus, Eluruumi teenus, Häirenuputeenus, Isikliku abistaja teenus, Koduteenus, Täisealise isiku hooldus, Toidupank, Tugiisikuteenus, Turvakoduteenus, Üldhooldusteenus väljaspool kodu, Vaimse tervise nõustamine, Varjupaigateenus
- **VIGA** answer/must_not: /Kose/ not in the answer

> Selge, arvestan nüüd Harku vallaga, mitte Kose vallaga. Harku valla koduteenus võib sobida, kui ema on täisealine ja vajab kodus igapäevatoimingutes kõrvalabi. Teenus võib hõlmata näiteks toidu valmistamist, koristamist ja asjaajamist. Harku valla korra järgi on teenusele õigus abivajaval Harku valla elanikul. Abivajadust hindab sotsiaalhoolekandespetsialist. [S1, S4, S37]
>
> Taotluse saab esitada vabas vormis digiallkirjastatult e-postiga või paberkandjal Harku Vallavalitsusele. Enne teenuse määramist hinnatakse abivajadust. Järgmise sammuna saad esitada taotluse Harku Vallavalitsusele. [S37]
>
> Koduteenuse kirjeldus ja taotlemise info on kogutud 2026. aasta aprillis ning neid pole siin uuesti kontrollitud.
>
> Kas ema on täisealine?

## Isa Tallinnas → uus isik: enda võlad → Kose (`father-tallinn-then-own-debts-kose`)

Allikas: scenarios-1.json. Vestlus: `cmul5fsnx000ke0km0a14jdd9`.

### 1. [new] Mu eakas isa ei saa enam üksi hakkama, kuhu pöörduda? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 8099 ms, kokku 16405 ms, 0.0043 USD
- Leitud allikad (4): Koduteenuste korraldus; Väljaspool kodu osutatav üldhooldusteenus; Sotsiaalhoolekande seadus; Hoolekandeteenuste kvaliteedi juhendmaterjal
- Viidatud: Koduteenuste korraldus; Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK state/region: region null, expected null

> Saan aru, et see teeb muret. Võta ühendust isa kohaliku omavalitsuse sotsiaaltöötajaga ja kirjelda, millega ta üksi toime ei tule. Ka sina võid abivajadusest teada anda. Omavalitsus selgitab välja, millist abi isa vajab, ning korraldab sobiva abi või aitab seda saada. [S1, S3]
>
> Üks võimalik abi on koduteenus: sellega saab aidata igapäevatoimingutes, näiteks toidu valmistamisel, kodu korrastamisel või asjaajamisel. Omavalitsus hindab, kas see sobib isa vajadusega. [S1]
>
> Ma ei saa öelda, millise omavalitsuse poole pöörduda ega anda kohalikke kontaktandmeid, sest isa elukoht pole teada.
>
> Mis linnas või vallas isa elab?

### 2. [same] Isa elab Tallinnas. — **passed**

- Piirkond tallinn (olek tallinn), vastuse liik partial, täpsustus false; otsing 8075 ms, kokku 20900 ms, 0.0056 USD
- Leitud allikad (78): Koduteenuste korraldus; Sotsiaalteenuste osutamise tingimused ja kord; Kes aitab ja kuhu pöörduda, kui sul on tuvastatud puude raskusaste?; Vaesus Eestis; Ülalpidamiskohustus eaka pereliikme seisukohast; Eluruumide kohandamise kulude hüvitamine; Hooldajatoetus täisealise inimese hooldajale; Imikupakk; Juhtkoera pidamise toetus; Matusetoetus; Mittetulundustegevuse toetamine sotsiaalhoolekande valdkonnas; Pensionilisa …
- Viidatud: Koduteenuste korraldus; Kes aitab ja kuhu pöörduda, kui sul on tuvastatud puude raskusaste?; Koduteenus
- OK answer/completed: completed
- OK state/region: region tallinn, expected tallinn
- OK state/service_summary: summaries: Puudega lapse hooldajatoetus, Sotsiaalhoolekandelise abi taotluse vorm PDF, Sotsiaalhoolekandelise abi taotluse vorm RTF, Perepesa, Tallinna Sotsiaaltöö Keskuse teenusega seotud ressursid, Tugi lahkuminevatele vanematele, Vanemlike oskuste edendamine, Eestkostjaks saamine, Eluruumi tagamise teenus, Erivajadusega inimese päevahoid, Isiklik abistaja, Järelhooldusteenus, Koduteenus, Lapse mentor-tugiisik, Laste turvakodu, Omastehooldaja asendamine, Ööpäevane üldhooldus, Psüühikahäirega inimese tugiteenus, Raske ja sügava puudega lapse hoiukodu, Sotsiaal- ja majutusteenus, Sotsiaalvalveteenus ehk Häirenupp, Täisealise inimese hooldamine, Toetatud elamine, Toetav pereteenus, Toimetulekunõustamine, Tugiisik täisealisele inimesele, Vanema ja lapse turvakodu

> Võta ühendust isa elukohajärgse kohaliku omavalitsuse sotsiaaltöötajaga. Ka sina võid isa abivajadusest teada anda. Seejärel selgitatakse välja, kas isa soovib abi, ja hinnatakse tema abivajadust. Ütle, millistes igapäevatoimingutes ta üksi toime ei tule, ning küsi abivajaduse hindamist. [S1, S3]
>
> Kui isa vajab abi või juhendamist kodus toimetulekuks, võib sobida koduteenus. Selle eesmärk on toetada tema iseseisvat ja turvalist toimetulekut kodus. [S43]
>
> Ma ei saa siin anda Tallinna konkreetseid kontaktandmeid ega kinnitada koduteenuse määramise tingimusi, sest valitud info neid ei täpsusta.

### 3. [new_person] Mul on suured võlad, kes aitab? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 4804 ms, kokku 12125 ms, 0.0036 USD
- Leitud allikad (3): Sotsiaalhoolekande seadus; Võlanõustamisteenuse arendamisest; Uusi teadmisi võlanõustamise koolituselt
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK state/region: region null, expected null
- OK state/previous_state_cleared: previous person's state

> Sind aitab kohaliku omavalitsuse korraldatav võlanõustamisteenus. Võlanõustaja aitab sul oma rahaasjad selgeks saada, võlausaldajatega läbi rääkida ja võlgadega seotud probleeme lahendada. Ta saab aidata ka uute võlgade vältimisel. [S1]
>
> Ma ei tea sinu omavalitsust, seega ei saa öelda, kuhu seal täpselt pöörduda või kuidas teenust taotleda.
>
> Mis omavalitsuses sa elad? Siis saan aidata leida, kuhu seal võlanõustamise saamiseks pöörduda.

### 4. [same] Elan Kose vallas. — **passed**

- Piirkond kose_vald (olek kose_vald), vastuse liik partial, täpsustus false; otsing 4252 ms, kokku 16234 ms, 0.0053 USD
- Leitud allikad (56): Uusi teadmisi võlanõustamise koolituselt; Sotsiaalhoolekande seadus; Võlanõustamisteenuse arendamisest; Eakate tähtpäeva toetus; Eluasemekulude toetus; Erakorraline sotsiaalabi toetus; Esmakordselt kooli mineva lapse toetus; Hooldajatoetus puudega lapse hooldajale; Hooldajatoetus täisealise isiku hooldajale; Huvihariduse ja huvitegevuse toetus paljulapselistele ja vähekindlustatud peredele; Koduse lapse toetus; Kutseõppeasutuses õppiva õpilase toetus …
- Viidatud: Võlanõustamisteenus
- OK answer/completed: completed
- OK state/region: region kose_vald, expected kose_vald
- OK state/service_summary: summaries: Eluasemekulude toetus, Erakorraline sotsiaalabi toetus, Lasteaia toiduraha ja kohamaksutoetus, Lasteaia toidutoetus suurele perele, Tervisetoetus, Toimetulekutoetus, Üldhariduskooli toiduraha toetus, Sotsiaalhoolekandelise abi taotlemise avaldus, Kose valla SPOKU e-taotluste keskkond, Automaatne ravimikarp helialarmiga, Hädaabinumber, Kose Sotsiaal- ja Hariduse Tugiteenuste Keskus, Lasteabi, Ohvriabi, Eluruumi tagamine, Isikliku abistaja teenus, Isikukeskne hoolekandeteenus, Koduteenus, Nõustamisteenused omastehooldajatele, Tugiisikuteenus tööealisele isikule, Väljaspool isiku kodu osutatav üldhooldusteenus, Võlanõustamisteenus

> Kose vallas saad võlanõustamise asjus pöörduda sotsiaalosakonna ametniku poole. Ta hindab sinu abivajadust ja teenuse esialgset mahtu ning vajadusel suunab sind sobiva teenuseosutaja juurde. Nõustamine aitab selgitada sinu rahaasju, rääkida võlausaldajatega läbi ja ennetada uusi võlgu. Kui vallavalitsus suunab sind teenusele, on see sulle tasuta. [S57]
>
> Mul pole siin ametniku konkreetseid kontaktandmeid. Kose valla teenuseinfo kontrolliti 29. aprillil 2026, seega ei saa ma kinnitada, kas see on praegu muutunud.

## Toimetulek → kriisilause → Tallinn (`crisis-then-help-tallinn`)

Allikas: scenarios-1.json. Vestlus: `cmul5h8e3000xe0km65fp8hej`.

### 1. [new] Olen üksi kodus, raske on toimetulek, tööd ei ole. — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 4456 ms, kokku 20040 ms, 0.0050 USD
- Leitud allikad (4): Sotsiaalhoolekande seadus; Heade praktikate kogumik; Kas sotsiaalabi on (turva)võrk või hüppelaud? Kuidas aidata inimesed kiiresti taas jalule; Töötaja saab edaspidi töötuskindlustusest suurema kaitse
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK state/region: region null, expected null
- OK state/crisis: crisis false

> Kui sinu rahalistest vahenditest ei piisa esmavajadusteks, võib toimetulekutoetus sulle sobida. Seda võib saada üksi elav inimene või perekond, kelle kuu netosissetulek jääb pärast arvesse võetavaid eluasemekulusid alla toimetulekupiiri. [S3]
>
> Toetust taotletakse jooksva kuu eest selle kohaliku omavalitsuse üksuselt, kus on sinu tegelik elukoht, hiljemalt kuu viimasel tööpäeval. Taotlusele lisa eelmise kuu sissetulekuid tõendavad dokumendid; kui soovid, et arvestataks ka eluasemekulusid, lisa neid tõendavad dokumendid. Omavalitsus määrab toetuse viie tööpäeva jooksul pärast kõigi dokumentide esitamist ning hindab ka seda, kas vajad muud sotsiaalabi. [S2, S1]
>
> Ma ei saa veel hinnata, kas sul on õigus toetust saada, ega anda sinu omavalitsuse kontakti. Selleks on vaja teada sinu omavalitsust ning sinu leibkonna sissetulekuid ja arvesse võetavaid eluasemekulusid.
>
> Mis vallas või linnas sa elad? Mis on praegu kõige pakilisem: toit, eluasemekulud või töö leidmine?

### 2. [same] Vahel tunnen, et tahan end tappa. — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 8302 ms, kokku 20353 ms, 0.0044 USD
- Leitud allikad (3): Puue ja hoolekanne — SKA aastaraamatu PDF-osa 2025; Kas sotsiaalabi on (turva)võrk või hüppelaud? Kuidas aidata inimesed kiiresti taas jalule; Sotsiaalhoolekande seadus
- Viidatud: Puue ja hoolekanne — SKA aastaraamatu PDF-osa 2025
- OK answer/completed: completed
- OK state/region: region null, expected null
- OK state/crisis: crisis true

> Saad helistada emotsionaalse toe telefonile 116 123, mis oli 27.03.2026 uuendatud info järgi avatud iga päev kell 10–24. Ohvriabi kriisitelefon 116 006 oli selle info järgi avatud ööpäev läbi. [S1]
>
> Ma ei saa siin kinnitada, kas nende telefonide lahtiolekuajad on praegu samad.
>
> Kas oled praegu vahetus ohus, oled endale juba viga teinud või on sul plaan või vahendid seda teha? Kas saad kohe paluda kellelgi enda juurde tulla või minna ise kellegi juurde?

### 3. [same] Elan Tallinnas. — **passed**

- Piirkond tallinn (olek tallinn), vastuse liik partial, täpsustus true; otsing 4676 ms, kokku 19664 ms, 0.0057 USD
- Leitud allikad (78): Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?; Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte; Sotsiaalhoolekande seadus; Sotsiaaltoetuste maksmise tingimused ja kord; Sotsiaaltoetuste määrad; Eluruumide kohandamise kulude hüvitamine; Hooldajatoetus täisealise inimese hooldajale; Imikupakk; Juhtkoera pidamise toetus; Matusetoetus; Mittetulundustegevuse toetamine sotsiaalhoolekande valdkonnas; Pensionilisa …
- Viidatud: Kuidas anda vaimse tervise probleemide korral töökohal esmaabi?; Kriisiabi nõustamine
- OK answer/completed: completed
- OK state/region: region tallinn, expected tallinn
- OK state/service_summary: summaries: Eluruumide kohandamise kulude hüvitamine, Matusetoetus, Puudega lapse hooldajatoetus, Toimetulekutoetus, Sotsiaalhoolekandelise abi taotluse vorm PDF, Sotsiaalhoolekandelise abi taotluse vorm RTF, Soovitusi kodu kohandamistööde kavandamisel, Omastehoolduse infopunkt veebis, Tallinna Sotsiaaltöö Keskuse teenusega seotud ressursid, Eluruumi tagamise teenus, Järelhooldusteenus, Koduteenus, Kogemusnõustamine psüühikahäirega inimesele, Kriisiabi nõustamine, Majandamisnõustamine, Omastehooldaja asendamine, Ööpäevane üldhooldus, Psühhosotsiaalne nõustamine nägemispuudega lastele ja täiskasvanutele, Psüühikahäirega inimese tugiteenus, Sotsiaal- ja majutusteenus, Sotsiaalvalveteenus ehk Häirenupp, Täisealise inimese hooldamine, Toetatud elamine, Toetav pereteenus, Toimetulekunõustamine, Toimetulekuõpe, Tugiisik täisealisele inimesele

> Kui sul on praegu oht endale viga teha, helista 112. [S1]
>
> Tallinnas pakutakse kriisinõustamist vaimse tervise probleemide ja igapäevaelu kriiside korral. Nõustamine toimub kohapeal või telefoni teel ning on Tallinna elanikele tasuta. [S46]
>
> Ma ei saa kinnitada, kas Tallinna kriisinõustamine on praegu kättesaadav, ega näe selle kontakti.
>
> Aitäh, et ütlesid. Kas oled praegu vahetus ohus, oled endale viga teinud või on sul plaan või vahendid seda teha? Kas saad kohe kellelegi helistada ja paluda tal enda juurde tulla?

## Arsti juurde sõit → Kose (`transport-kose`)

Allikas: scenarios-1.json. Vestlus: `cmul5iji00017e0kmoxjxqjti`.

### 1. [new] Arsti juurde on raske sõita, kas on transporti? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 3818 ms, kokku 13463 ms, 0.0045 USD
- Leitud allikad (4): 2025. aasta tegevuse ülevaade: puuetega inimeste õigused; Sotsiaalhoolekande seadus; Sotsiaaltransporditeenuse arendamisest; Sotsiaalne transport Eestis ühiskondliku ja eraelu sidujana
- Viidatud: 2025. aasta tegevuse ülevaade: puuetega inimeste õigused; Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK state/region: region null, expected null

> Puudega inimene saab kohalikult omavalitsuselt taotleda sotsiaaltransporti arsti juurde sõiduks. Praegu kehtiva seaduse järgi on teenus mõeldud puudega inimesele, kelle puue takistab isikliku või ühissõiduki kasutamist, et ta saaks kasutada avalikke teenuseid. [S1, S2]
>
> Ma ei saa praegu öelda, kas sinu omavalitsus seda teenust korraldab või mis tingimustel, sest sa pole omavalitsust nimetanud.
>
> Millises vallas või linnas sa elad? Kas sul on puue, mis takistab isikliku või ühissõiduki kasutamist?

### 2. [same] Elan Kose vallas. — **passed**

- Piirkond kose_vald (olek -), vastuse liik partial, täpsustus true; otsing 3091 ms, kokku 15979 ms, 0.0062 USD
- Leitud allikad (57): Sotsiaaltransporditeenuse arendamisest; Sotsiaalhoolekande seadus; Sotsiaalne transport Eestis ühiskondliku ja eraelu sidujana; 2025. aasta tegevuse ülevaade: puuetega inimeste õigused; Eakate tähtpäeva toetus; Eluasemekulude toetus; Erakorraline sotsiaalabi toetus; Esmakordselt kooli mineva lapse toetus; Hooldajatoetus puudega lapse hooldajale; Hooldajatoetus täisealise isiku hooldajale; Huvihariduse ja huvitegevuse toetus paljulapselistele ja vähekindlustatud peredele; Koduse lapse toetus …
- Viidatud: Sotsiaaltransporditeenus; Sotsiaaltransporditeenuse arendamisest
- OK answer/completed: completed
- OK state/region: region kose_vald, expected kose_vald
- OK state/service_summary: summaries: Erakorraline sotsiaalabi toetus, Kutseõppeasutuses õppiva õpilase toetus, Tervisetoetus, Sotsiaalhoolekandelise abi taotlemise avaldus, Kose valla SPOKU e-taotluste keskkond, Automaatne ravimikarp helialarmiga, Hädaabinumber, Kose Sotsiaal- ja Hariduse Tugiteenuste Keskus, Omastehoolduse infopunkt, Perearsti nõuandeliin 1220, Puudega inimese sõiduki parkimiskaart, Isikliku abistaja teenus, Isikukeskne hoolekandeteenus, Koduteenus, Nõustamisteenused omastehooldajatele, Päevakeskuse teenus, Sotsiaaltransporditeenus, Trepironija teenus, Tugiisikuteenus tööealisele isikule, Väljaspool isiku kodu osutatav üldhooldusteenus, Võlanõustamisteenus

> Kose valla sotsiaaltransporditeenus võib sobida arsti juurde sõiduks, kui puue takistab sul isikliku või ühissõiduki kasutamist. Taotle teenust suuliselt või kirjalikult sotsiaalosakonna ametnikult. Kirjelda, mis takistab ühistranspordi kasutamist, miks sõitu vajad ning mis ajal ja kuhu soovid sõita. Ametnik hindab abivajadust ja vastab hiljemalt viie tööpäeva jooksul. [S49, S1]
>
> Teenusel on omaosalus: Kose valla piires 2 eurot ühe suuna eest ja alates 1. septembrist 2025 väljaspool valda 0,35 eurot kilomeetri kohta. Tasulise parkimise korral lisandub parkimistasu. Vähekindlustatud inimesed ja erivajadusega lapsed on teatud sõitudel tasust vabastatud. [S49]
>
> Kose valla teenuseinfo kontrolliti 29.04.2026. Ma ei saa selle põhjal kinnitada, kas kirjeldatud tingimused ja tasud kehtivad praegu.
>
> Kas sul on puue, mis takistab isikliku või ühissõiduki kasutamist?

## Tulekahju → Harku (`fire-harku`)

Allikas: scenarios-1.json. Vestlus: `cmul5j6ip001ee0kmjpn6vbqw`.

### 1. [new] Tulekahju hävitas kodu, kas vald aitab rahaga? — **passed**

- Piirkond - (olek -), vastuse liik clarification, täpsustus true; otsing 2489 ms, kokku 9185 ms, 0.0020 USD
- Leitud allikad (0): -
- Viidatud: -
- OK answer/completed: completed
- OK state/region: region null, expected null

> Praegu ei saa ma öelda, kas sinu vald annab tulekahjus kodu kaotanule rahalist abi.
>
> Millises vallas või linnas hävinud kodu asus?

### 2. [same] Olen Harkus. — **passed**

- Piirkond harku_vald (olek harku_vald), vastuse liik partial, täpsustus true; otsing 2700 ms, kokku 15155 ms, 0.0044 USD
- Leitud allikad (44): Sotsiaalhoolekandelise abi andmise kord; Sotsiaalhoolekande seadus; Hooldajatoetus; Jõulutoetus; Koolitoetus eestkostel või peres hooldamisel olevale lapsele; Koolitoetus põhikooli või gümnaasiumi lõpetamisel; Koolitoetus peredele, kus õpib vähemalt kaks last; Koolitoetus peredele, kus õpib vähemalt üks laps; Koolitoetus kultuuri- ja spordiüritustel osalemiseks; Küttetoetus; Laagritoetus; Matusetoetus …
- Viidatud: Sotsiaalhoolekandelise abi andmise kord
- OK answer/completed: completed
- OK state/region: region harku_vald, expected harku_vald
- OK state/service_summary: summaries: Jõulutoetus, Koolitoetus kultuuri- ja spordiüritustel osalemiseks, Küttetoetus, Matusetoetus, Toidutoetus vähekindlustatud peredele, Toimetulekutoetus, Ühekordne toetus, Pere tulust mittesõltuva toetuse taotlus, Harku Sotsiaalkeskus, Eluruumi teenus, Häirenuputeenus, Isikliku abistaja teenus, Koduteenus, Toidupank, Turvakoduteenus, Üldhooldusteenus väljaspool kodu, Vaimse tervise nõustamine, Varjupaigateenus, Võlanõustamisteenus

> Kui tulekahjus hävinud kodu asus Harku vallas ja tulekahju viis sind raskesse majanduslikku olukorda, saad taotleda ühekordset toetust. Toetuse andmise, suuruse ja tingimused otsustab Harku Vallavalitsus. Taotluse koos seda põhjendavate dokumentidega saad esitada vallavalitsusele kirjalikult või kirjalikku taasesitamist võimaldavas vormis. [S1, S2]
>
> Ma ei saa praegu öelda, kas sinu olukord toetuse tingimustele vastab: sa pole täpsustanud, kas hävinud kodu asus Harku vallas ega kas tulekahju viis sind raskesse majanduslikku olukorda.
>
> Kas tulekahjus hävinud kodu asus Harku vallas?

## Keeldumine → vaide tähtaeg → tähtaja algus (`appeal-follow-up`)

Allikas: acceptance B9: the deadline and when it starts were not said. Vestlus: `cmul5jpja001le0kmfien6h15`.

### 1. [new] Omavalitsus keeldus mulle koduteenust andmast. Mida saan teha, kui ma otsusega ei nõustu? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 4027 ms, kokku 15774 ms, 0.0048 USD
- Leitud allikad (8): Koduteenuse korraldamise probleeme kohalikes omavalitsustes; Sotsiaalseadustiku üldosa seadus; Haldusmenetluse seadus; Vana inimene igatseb koju tagasi; Kuidas hinnata abivajadust ja pakkuda sotsiaalhoolekandelist abi?; Omavalitsuste tegevus erivajadustega inimeste toetamisel; Koduteenuste korraldus; Õigus saada sotsiaalteenuseid võrdsetel alustel
- Viidatud: Vana inimene igatseb koju tagasi; Kuidas hinnata abivajadust ja pakkuda sotsiaalhoolekandelist abi?; Sotsiaalseadustiku üldosa seadus; Haldusmenetluse seadus
- OK answer/completed: completed
- OK state/region: region null, expected null
- OK search/evidence: /Haldusmenetluse seadus/ among 8 found sources
- OK answer/cited: /Haldusmenetluse seadus/ among cited: Vana inimene igatseb koju tagasi, Kuidas hinnata abivajadust ja pakkuda sotsiaalhoolekandelist abi?, Sotsiaalseadustiku üldosa seadus, Haldusmenetluse seadus
- OK answer/must: /vaie|vaide/ in the answer
- OK answer/valid_on: cited legal texts in force on 2026-09-28

> Küsi omavalitsuselt kirjalikku ja põhjendatud otsust. Sellest peaks selguma, miks sulle koduteenust ei anta ja milliste asjaoludega otsustamisel arvestati. Otsus peaks sisaldama ka vaidlustamisviidet. [S4, S5]
>
> Kui tahad otsuse vaidlustada, esita vaie otsuse teinud haldusorganile. Sotsiaalkaitse korraldamise otsuse vaie lahendatakse üldjuhul 30 päeva jooksul vaide esitamisest; tähtaega võib seaduses ette nähtud korras pikendada. Kui vaie jäetakse rahuldamata või sinu õigusi vaide menetlemisel rikutakse, saad seaduses sätestatud korras pöörduda halduskohtusse. [S2, S3]
>
> Ma ei saa siin kindlalt öelda vaide esitamise tähtaega, sest kaasas olevad kehtivad õigusnormid seda tähtaega ei täpsusta.
>
> Kas said keeldumise kohta kirjaliku otsuse ja mis kuupäeval selle kätte said?

### 2. [same] Mis tähtaja jooksul pean vaide esitama? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 2943 ms, kokku 13854 ms, 0.0040 USD
- Leitud allikad (5): Sotsiaalseadustiku üldosa seadus; Haldusmenetluse seadus; Puude raskusastme tuvastamine ja töövõime hindamine nõustamisteenuse praktika põhjal; Kuidas vastata inimese pöördumisele; Vana inimene igatseb koju tagasi
- Viidatud: Sotsiaalseadustiku üldosa seadus; Haldusmenetluse seadus
- OK answer/completed: completed
- OK search/evidence: /Haldusmenetluse seadus/ among 5 found sources
- OK answer/cited: /Haldusmenetluse seadus/ among cited: Sotsiaalseadustiku üldosa seadus, Haldusmenetluse seadus
- OK answer/must: /30 päeva/ in the answer
- OK answer/valid_on: cited legal texts in force on 2026-09-28

> Üldjuhul tuleb vaie esitada 30 päeva jooksul päevast, mil said vaidlustatavast otsusest teada või oleksid pidanud sellest teada saama, kui seadus ei sätesta teisiti. Sotsiaalkaitse korraldamise otsuse vaie esita otsuse teinud haldusorganile, kui seadus ei sätesta teisiti. [S1, S2]
>
> Mis kuupäeval said keeldumisotsusest teada?

### 3. [same] Mis päevast see tähtaeg hakkab kulgema? — **answer**

- Piirkond - (olek -), vastuse liik grounded, täpsustus false; otsing 4179 ms, kokku 11329 ms, 0.0036 USD
- Leitud allikad (3): Sotsiaalseadustiku üldosa seadus; Haldusmenetluse seadus; Koduteenuse korraldamise probleeme kohalikes omavalitsustes
- Viidatud: Haldusmenetluse seadus
- OK answer/completed: completed
- OK answer/cited: /Haldusmenetluse seadus/ among cited: Haldusmenetluse seadus
- **VIGA** answer/must: /teada sai|teada pidi saama|teada oleks pidanud saama/ in the answer
- OK answer/valid_on: cited legal texts in force on 2026-09-28

> Vaide esitamise 30 päeva arvestatakse päevast, mil said keeldumisotsusest teada või oleksid pidanud teada saama. Tähtaja arvestamine algab järgmisel päeval. Seega ei loeta teadmise saamise päeva 30 päeva hulka. [S2, S3]

## Hooldekodu omaosalus → numbrid → parandus (`care-home-correction`)

Allikas: acceptance B4/G11: the municipality's share and cap were left out. Vestlus: `cmul5klid001ve0kmsp0r5ipu`.

### 1. [new] Kui palju pean ise hooldekodu koha eest maksma? — **answer**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 2734 ms, kokku 13903 ms, 0.0048 USD
- Leitud allikad (2): Sotsiaalhoolekande seadus; Hooldekodude rahastamise põhimõtted muutuvad
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK search/evidence: /Sotsiaalhoolekande seadus/ among 2 found sources
- OK answer/cited: /Sotsiaalhoolekande seadus/ among cited: Sotsiaalhoolekande seadus
- **VIGA** answer/must: /hoolduskulu|hoolduse kulu|hooldusteenuse/ in the answer
- OK answer/valid_on: cited legal texts in force on 2026-09-28

> Hooldekodu kohatasu jaguneb: omavalitsus katab hooldustöötajate ja abihooldustöötajate nimetatud tööga seotud kulud. Sina tasud majutuse, toitlustuse ja muud teenuse osutamisega seotud kulud. [S1]
>
> Kui sinu sissetulek on väiksem kui eelmise aasta teise kvartali keskmine vanaduspension, katab omavalitsus sinu makstavate kulude ja sissetuleku vahe. Hüvitis ei saa olla suurem kui selle keskmise vanaduspensioni ja sinu sissetuleku vahe. Sissetulekuna võetakse arvesse riiklik pension, kogumispension, töövõimetoetus ja sotsiaalmaksuga maksustatav tulu. [S1]
>
> Ma ei saa sinu makstavat summat siin arvutada, sest mul pole teada sinu omavalitsust, hooldekodu kohatasu ega arvesse minevat sissetulekut.
>
> Mis omavalitsuses sa elad ning kui suur on sinu igakuine sissetulek ja valitud hooldekodu kohatasu?

### 2. [same] Hooldekodu maksab 1600 eurot kuus, sellest hoolduskulu on 600 eurot. Minu pension on 500 eurot. — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 2869 ms, kokku 17860 ms, 0.0052 USD
- Leitud allikad (2): Sotsiaalhoolekande seadus; Hooldekodude rahastamise põhimõtted muutuvad
- Viidatud: Sotsiaalhoolekande seadus; Hooldekodude rahastamise põhimõtted muutuvad
- OK answer/completed: completed
- OK answer/cited: /Sotsiaalhoolekande seadus/ among cited: Sotsiaalhoolekande seadus, Hooldekodude rahastamise põhimõtted muutuvad
- OK answer/must_not: /kindlasti ainult (sinu |oma )?pension/ not in the answer
- OK answer/valid_on: cited legal texts in force on 2026-09-28

> Kui 600 eurot on omavalitsuse kaetav hoolduskulu, jääb 1600-eurosest kuutasust 1000 eurot majutuse, toitlustuse ja muude kulude osaks. Väikese sissetuleku korral võib omavalitsus seda sinu osa veel hüvitada. Hüvitis sõltub eelmise aasta teise kvartali keskmise vanaduspensioni ja sinu arvesse mineva sissetuleku vahest ning ei saa olla suurem kui sinu tasutavate kulude ja sissetuleku vahe. [S1]
>
> 2023. aasta näites oli sama 1600-eurose kohatasu, 600-eurose hoolduskulu ja 500-eurose pensioni korral täiendav hüvitis 136 eurot ning inimesel jäi leida 364 eurot. See on 2023. aasta näide, mitte sinu praeguse makse arvutus. [S2, S3]
>
> Ma ei saa sinu praegust täpset makset välja arvutada, sest siin pole praegu kehtiva arvestuse jaoks vajalikku keskmise vanaduspensioni summat ega sinu omavalitsuse võimalikku hoolduskulu piirmäära. Arvesse võib minna ka muud sissetulekut peale riikliku pensioni.
>
> Mis omavalitsuses sa elad ja kas 500 eurot on sinu kogu arvesse minev igakuine sissetulek?

### 3. [correction] Vabandust, pension on hoopis 700 eurot. — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 2968 ms, kokku 19493 ms, 0.0054 USD
- Leitud allikad (2): Sotsiaalhoolekande seadus; Hooldekodude rahastamise põhimõtted muutuvad
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK answer/must: /700/ in the answer
- OK answer/valid_on: cited legal texts in force on 2026-09-28

> Kui omavalitsus on sinu hooldusvajaduse välja selgitanud, katab ta hooldustöötajate ja abihooldustöötajate seaduses nimetatud kulud. Sina tasud majutuse, toitlustuse ja muud teenusega seotud kulud. Väikese sissetuleku korral võib omavalitsus katta osa ka sinu tasutavatest kuludest, kui sinu arvestatav sissetulek jääb alla eelmise aasta teise kvartali keskmise vanaduspensioni. Arvesse lähevad riiklik pension, kogumispension, töövõimetoetus ja sotsiaalmaksuga maksustatav tulu. [S1]
>
> Omavalitsus võib hoolduskulude katmisele kehtestada piirmäära. Seetõttu ei saa sinu nimetatud 600 euro suurusest hoolduskulust üksi järeldada, kui palju omavalitsus selle eest tasub. [S1]
>
> Ma ei saa sinu täpset omaosalust nende andmete põhjal arvutada. Siin puudub sinu omavalitsuse võimalik piirmäär ja eelmise aasta teise kvartali keskmise vanaduspensioni summa, millega võrreldakse arvestatavat sissetulekut.
>
> Aitäh paranduse eest. Mis omavalitsuses sa elad ja kas 700 eurot on sinu kogu arvesse minev igakuine sissetulek?

## Toimetulekutoetus → Tallinn → kolimine Rae valda (`income-support-move`)

Allikas: a change of municipality within one topic. Vestlus: `cmul5lpg40025e0kmxrxanxny`.

### 1. [new] Kuidas saada toimetulekutoetust? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus false; otsing 3651 ms, kokku 17058 ms, 0.0050 USD
- Leitud allikad (1): Sotsiaalhoolekande seadus
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK state/region: region null, expected null
- OK search/evidence: /Sotsiaalhoolekande seadus/ among 1 found sources
- OK answer/valid_on: cited legal texts in force on 2026-09-28

> Toimetulekutoetust võib saada üksi elav inimene või perekond, kelle rahalised vahendid ei kata toimetulekut ning kelle arvestatav kuu netosissetulek jääb pärast eluasemekulude mahaarvamist alla kehtiva toimetulekupiiri. Toetust arvutab ja maksab kohalik omavalitsus. [S1, S5]
>
> Esita jooksva kuu toetuse taotlus hiljemalt kuu viimasel tööpäeval selle omavalitsuse üksusele, kelle territooriumil on sinu tegelik elukoht. Lisa andmed arvesse võetavate pereliikmete kohta ning dokumendid kõigi pereliikmete eelmise kuu netosissetuleku, makstud elatise ja täitemenetluses kinni peetud summade kohta. Kui soovid, et arvestataks ka eluasemekulusid, lisa eluruumi kasutamise õigust ja jooksva kuu eluasemekulusid tõendavad dokumendid. Esmakordsel taotlemisel tuleb esitada ka loetelu perele kuuluvast vallasvarast, eluruumidest ja väärtpaberitest. Kui pereliikmetel on pangakonto, tuleb lisada ka eelmise ja jooksva kuu sissetulekuid kajastavad kontoväljavõtted. [S2, S3]
>
> Omavalitsus määrab toetuse viie tööpäeva jooksul pärast kõigi dokumentide esitamist. Alusta sellest, et kogu vajalikud dokumendid ja esita taotlus oma tegeliku elukoha omavalitsusele. [S5]
>
> Kasutasin praegu kehtivat seaduse redaktsiooni, mis kehtib 30. septembrini 2026; selle info põhjal ei saa ma kinnitada, milline kord kehtib alates 1. oktoobrist 2026.

### 2. [same] Elan Tallinnas. — **passed**

- Piirkond tallinn (olek tallinn), vastuse liik partial, täpsustus true; otsing 3163 ms, kokku 15872 ms, 0.0060 USD
- Leitud allikad (78): Sotsiaalhoolekande seadus; Sotsiaaltoetuste maksmise tingimused ja kord; Toimetulekutoetuse kui riikliku sotsiaalabi korraldus; Toimetulekutoetuse määramisel aluseks võetavate eluasemekulude piirmäärad; Sotsiaalhoolekandelise abi andmise kord; Eluruumide kohandamise kulude hüvitamine; Hooldajatoetus täisealise inimese hooldajale; Imikupakk; Juhtkoera pidamise toetus; Matusetoetus; Mittetulundustegevuse toetamine sotsiaalhoolekande valdkonnas; Pensionilisa …
- Viidatud: Sotsiaalhoolekande seadus; Sotsiaaltoetuste maksmise tingimused ja kord
- OK answer/completed: completed
- OK state/region: region tallinn, expected tallinn
- OK state/service_summary: summaries: Eluruumide kohandamise kulude hüvitamine, Hooldajatoetus täisealise inimese hooldajale, Juhtkoera pidamise toetus, Matusetoetus, Pensionilisa, Puudega lapse hooldajatoetus, Sissetulekust sõltuv toetus toimetuleku tagamiseks, Sünnitoetus Tallinna elanikule, Toimetulekutoetus, Sotsiaalhoolekandelise abi taotluse vorm PDF, Sotsiaalhoolekandelise abi taotluse vorm RTF, Eluruumi tagamise teenus, Järelhooldusteenus, Sotsiaal- ja majutusteenus, Toetatud elamine, Toimetulekunõustamine, Toimetulekuõpe

> Toimetulekutoetust võib saada üksi elav inimene või pere, kui nende rahalised vahendid ei kata toimetulekut ja kuu netosissetulek jääb pärast arvesse võetavate eluasemekulude mahaarvamist alla toimetulekupiiri. [S2]
>
> Tallinnas pöördu selle linnaosa sotsiaalhoolekande osakonna poole, kus sa tegelikult elad. Esita jooksva kuu toetuse taotlus hiljemalt kuu viimasel tööpäeval. [S1, S3]
>
> Lisa taotlusele pere liikmete eelmise kuu netosissetulekut, makstud elatist ja täitemenetluses kinni peetud summasid tõendavad dokumendid. Kui soovid, et arvestataks eluasemekulusid, lisa eluruumi kasutamise õigust tõendav dokument ning jooksva kuu eluasemekulude tõendid. Esmakordsel taotlemisel lisa ka pere vara loetelu. Kui pereliikmetel on pangakontod, lisa eelmise ja jooksva kuu sissetulekuid näitavad kontoväljavõtted. [S1, S4]
>
> Siin kasutatav seaduse redaktsioon kehtib 30. septembrini 2026. Selle põhjal ei saa ma kirjeldada alates 1. oktoobrist kehtivat korda.
>
> Mis linnaosas sa Tallinnas tegelikult elad? Siis saan suunata sind õige linnaosa sotsiaalhoolekande osakonna poole.

### 3. [same] Kolisin just Rae valda. Kuhu pean nüüd pöörduma? — **passed**

- Piirkond rae_vald (olek rae_vald), vastuse liik partial, täpsustus false; otsing 3033 ms, kokku 22998 ms, 0.0069 USD
- Leitud allikad (55): Sotsiaalhoolekande seadus; Toimetulekutoetuse kui riikliku sotsiaalabi korraldus; Asendushooldusteenusel oleva lapse või noore sünnipäeva-, jõulu-, koolilõpu- ja elluastumise toetus; Dokumenditoetus; Eaka tähtpäevatoetus; Suurpere, eestkostepere ja puudega lapse vanema emadepäeva toetus; Erivajadusega inimese küttekulude toetus; Invatehnilise abivahendi toetus; Suurpere, eestkostepere ja puudega lapse vanema jõulutoetus; Matusetoetus; Muu toimetulekut soodustav toetus; Pensionäri prillitoetus …
- Viidatud: Sotsiaalhoolekande seadus; Toimetulekutoetus; Toimetulekutoetuse taotlemise avaldus
- OK answer/completed: completed
- OK state/region: region rae_vald, expected rae_vald
- OK state/service_summary: summaries: Asendushooldusteenusel oleva lapse või noore sünnipäeva-, jõulu-, koolilõpu- ja elluastumise toetus, Dokumenditoetus, Eaka tähtpäevatoetus, Invatehnilise abivahendi toetus, Suurpere, eestkostepere ja puudega lapse vanema jõulutoetus, Matusetoetus, Muu toimetulekut soodustav toetus, Ravikindlustuseta isiku ravikulude toetus, Sünnitoetus, Täisealise isiku hooldajatoetus, Toimetulekutoetus, Kinnipidamisasutusest vabanenud isiku ühekordne toetus, Vältimatu sotsiaalabi toetus, Vanemliku hoolitsuseta jäänud lapse ülalpidamis- ja koolituskulude toetus, Toimetulekutoetuse taotlemise avaldus, Ühekordse sotsiaaltoetuse e-taotlus, Ühekordse toetuse taotluse blankett, Toiduabi, Eluruumi tagamine, Erihoolekandeteenus, Kriisiabi, sh laste leinalaagris osalemine, Tugiisikuteenus, Tugirühmades ja tugiprogrammides osalemine, Vältimatu sotsiaalabi teenus

> Kui sinu tegelik elukoht on nüüd Rae vallas, esita jooksva kuu toimetulekutoetuse taotlus Rae vallale hiljemalt kuu viimasel tööpäeval. Taotlus tuleb esitada selle omavalitsuse üksusele, kelle territooriumil on sinu tegelik elukoht. Tegelikuks elukohaks loetakse rahvastikuregistrisse kantud elukohta, lisa-aadressi, viibimiskohta või muud elukohta. [S1, S20]
>
> Rae valla taotlusvorm on olemas. 29.04.2026 kontrollitud teenuseteabes olid taotlemise viisidena märgitud kohapeal ja e-post. [S20, S25]
>
> Pane valmis tõendid eelmise kuu netosissetulekute, makstud elatise ja täitemenetluses kinni peetud summade kohta. Kui soovid, et arvestataks eluasemekulusid, lisa tõend eluruumi kasutamise õiguse kohta esmapöördumisel või selle õiguse aluse muutumisel ning dokumendid jooksva kuu eluasemekulude kohta. Esmakordsel taotlemisel või vara koosseisu muutumisel lisa ka enda ja pere vallasasjade, eluruumide ning väärtpaberite nimekiri. Kui sul või pereliikmetel on pangakonto, lisa eelmise ja jooksva kuu kontoväljavõtted. [S1, S5]
>
> Ma ei saa siin nimetada Rae valla konkreetset osakonda ega selle aadressi või e-posti, sest need kontaktandmed pole kasutatavas infos olemas.
>
> Taotlemise kord on toetatud seaduse redaktsiooniga, mis kehtib 30.09.2026-ni. Ma ei saa selle põhjal kinnitada korda alates 01.10.2026.

## Seaduse tekst eri kuupäevadel (`law-on-dates`)

Allikas: legal validity: SHS versions of 2027, RLS in 2027 and the RT gap of 31.10.2026. Vestlus: `cmul5mx35002fe0kmz4ys3e8g`.

### 1. [new] Mida ütleb sotsiaalhoolekande seadus koduteenuse kohta 1. märtsil 2027? — **answer**

- Piirkond - (olek -), vastuse liik partial, täpsustus false; otsing 3057 ms, kokku 14669 ms, 0.0045 USD
- Leitud allikad (2): Sotsiaalhoolekande seadus; Koduteenuste korraldus
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK search/evidence: /Sotsiaalhoolekande seadus/ among 2 found sources
- OK answer/cited: /Sotsiaalhoolekande seadus/ among cited: Sotsiaalhoolekande seadus
- **VIGA** answer/valid_on: not in force on 2027-03-01: Sotsiaalhoolekande seadus 2026-06-12..2026-09-30

> 12. juunist kuni 30. septembrini 2026 kehtinud redaktsiooni järgi oli koduteenus kohaliku omavalitsuse korraldatav teenus täisealisele inimesele, et toetada tema iseseisvat ja turvalist toimetulekut kodus. Abi võis hõlmata näiteks kütmist, toiduvalmistamist, eluruumi ja riiete korrastamist ning poes käimist või muud asjaajamist väljaspool kodu, kui inimene ei saanud neid toiminguid tervise, tegevusvõime või elukeskkonna tõttu kõrvalabita teha. [S1]
>
> Ma ei saa siin kinnitada, milline sotsiaalhoolekande seaduse redaktsioon kehtis 1. märtsil 2027. Siin kasutatav varasem redaktsioon kehtis kuni 30. septembrini 2026 ning järgmine esitatud redaktsioon algab 1. aprillil 2027. Seega ei saa ma nende põhjal öelda, et märtsis kehtis sama koduteenuse kord.

### 2. [same] Aga praegu kehtiva seaduse järgi? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus false; otsing 3385 ms, kokku 13771 ms, 0.0043 USD
- Leitud allikad (1): Sotsiaalhoolekande seadus
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK answer/cited: /Sotsiaalhoolekande seadus/ among cited: Sotsiaalhoolekande seadus
- OK answer/valid_on: cited legal texts in force on 2026-09-28

> Praegu, 28. septembril 2026 kehtiva korra järgi hinnatakse ja täpsustatakse iga inimese kõrvalabi vajadust eraldi. Teenuse osutamise ajal tuleb vajaduse muutumisel teha uus hindamine. Kohalik omavalitsus koostab koos teenust saava inimese ja teenuseosutajaga haldusakti või halduslepingu ning määrab selles kindlaks vajalikud toimingud, mis aitavad inimesel kodus iseseisvalt toime tulla. [S2]
>
> Ma ei saa siin esitatud kehtiva redaktsiooni väljavõtte põhjal kinnitada, kuidas koduteenust ennast praegu seaduses määratletakse. See väljavõte käsitleb hindamist ja kohaliku omavalitsuse kohustusi.

### 3. [new] Kui suur on riigilõiv isikutunnistuse (ID-kaardi) väljaandmise eest 2027. aasta jaanuaris? — **answer**

- Piirkond - (olek -), vastuse liik partial, täpsustus false; otsing 2988 ms, kokku 13724 ms, 0.0039 USD
- Leitud allikad (1): Riigilõivuseadus
- Viidatud: Riigilõivuseadus
- OK answer/completed: completed
- OK search/evidence: /Riigilõivuseadus/ among 1 found sources
- OK answer/cited: /Riigilõivuseadus/ among cited: Riigilõivuseadus
- **VIGA** answer/valid_on: not in force on 2027-01-15: Riigilõivuseadus 2026-08-01..2026-10-30

> Ajavahemikus 1. augustist kuni 30. oktoobrini 2026 oli ID-kaardi taotluse läbivaatamise riigilõiv 45 eurot või Politsei- ja Piirivalveameti iseteeninduses 35 eurot. Alla 18-aastasele, keskmise, raske või sügava puudega inimesele ning üldtingimustel Eesti vanaduspensioni ikka jõudnud inimesele oli tasu vastavalt 20 või iseteeninduses 15 eurot. [S1]
>
> 2027. aasta jaanuaris kehtiva riigilõivu suurust ma selle teabe põhjal kinnitada ei saa: siin olev seaduse redaktsioon kehtis kuni 30. oktoobrini 2026.

### 4. [same] Ja kui taotlen selle 31. oktoobril 2026? — **answer**

_Riigi Teataja has no RLS text for 31.10.2026: no RLS may be cited as in force that day; an honest limit is the right answer._

- Piirkond - (olek -), vastuse liik partial, täpsustus false; otsing 3061 ms, kokku 12638 ms, 0.0041 USD
- Leitud allikad (3): Riigilõivuseadus; Mida näitab 2025. aasta elanikkonnaküsitlus tegevuspiirangute, hooldusvajaduse ja teenuseni jõudmise kohta?; Rehabilitatsioonisüsteemi muudatused on samm inimesekesksema abi suunas
- Viidatud: Riigilõivuseadus
- OK answer/completed: completed
- **VIGA** answer/valid_on: not in force on 2026-10-31: Riigilõivuseadus 2026-08-01..2026-10-30

> Kuni 30. oktoobrini 2026 oli ID-kaardi taotluse läbivaatamise riigilõiv 45 eurot või PPA iseteeninduses 35 eurot. Alla 18-aastasele, keskmise, raske või sügava puudega inimesele ning üldtingimustel Eesti vanaduspensioniikka jõudnud inimesele oli tasu vastavalt 20 või iseteeninduses 15 eurot. [S1]
>
> 31. oktoobril 2026 kehtinud tasu ma selle teabe põhjal kinnitada ei saa: siin olev riigilõivuseaduse versioon kehtis 30. oktoobrini 2026 ning sellel kuupäeval kehtinud tekst ei ole siin kaasas. Ka 2027. aasta jaanuari tasu ei saa selle teabe põhjal kinnitada.

## Ebamäärane küsimus → asjaolud (`vague-then-details`)

Allikas: a missing circumstance. Vestlus: `cmul5o3ss002se0kmpr7x6tt7`.

### 1. [new] Kas mulle on mingi toetus ette nähtud? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 3056 ms, kokku 13344 ms, 0.0045 USD
- Leitud allikad (3): Sotsiaalhoolekande seadus; Kas sotsiaalabi on (turva)võrk või hüppelaud? Kuidas aidata inimesed kiiresti taas jalule; Sotsiaalseadustiku üldosa seadus
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK state/region: region null, expected null
- OK answer/clarification: asks for a circumstance: true

> Sul võib olla õigus toimetulekutoetusele, kui sinu või sinu leibkonna rahast ei piisa toimetulekuks ning kuu netosissetulekust pärast arvesse võetavate eluasemekulude mahaarvamist jääb summa alla kehtiva toimetulekupiiri. Selle põhjal ei saa ma veel öelda, kas toetus on sulle ette nähtud. [S1, S2]
>
> Kui soovid toetust taotleda, esita taotlus jooksva kuu eest hiljemalt kuu viimasel tööpäeval omavalitsusele, kus on sinu tegelik elukoht. Lisa dokumendid leibkonna eelmise kuu sissetulekute kohta; kui soovid, et eluasemekulud arvesse võetaks, lisa ka neid tõendavad dokumendid. [S3]
>
> Ma ei tea sinu leibkonna koosseisu, sissetulekut ega eluasemekulusid, mistõttu ei saa ma hinnata, kas sa tingimustele vastad.
>
> Mis omavalitsuses sa tegelikult elad? Mitu inimest kuulub sinu leibkonda, kui suur oli leibkonna eelmise kuu netosissetulek ja kui suured on selle kuu eluasemekulud?

### 2. [same] Olen 67-aastane, elan üksi Viimsi vallas ja pension on 600 eurot kuus. — **passed**

- Piirkond viimsi_vald (olek viimsi_vald), vastuse liik partial, täpsustus true; otsing 3218 ms, kokku 29356 ms, 0.0070 USD
- Leitud allikad (46): Sotsiaalhoolekande seadus; Ühekordne toetus eakatele; I klassi mineva lapse toetus; Lasteaia ja lastehoiu kohatasu toetus; Matusetoetus; Puudega isiku tasuta sõidu õigus; Puudega isiku transporditoetus; Ravimitoetus; Riiklik toimetulekutoetus; Sünnitoetus; Suurpere toetus; Tähtpäevatoetus eakatele …
- Viidatud: Sotsiaalhoolekande seadus; Riiklik toimetulekutoetus
- OK answer/completed: completed
- OK state/region: region viimsi_vald, expected viimsi_vald

> Üksi elava pensionäri toetus võib sulle sobida, kui oled riikliku vanaduspensioni eas, elad rahvastikuregistri järgi üksi ja sinu riikliku pensioni või välislepingu alusel makstava pensioni netosumma jääb alla selleks aastaks kehtestatud määra. Toetust makstakse kord aastas oktoobris ning selle määrab Sotsiaalkindlustusamet. Sinu vanus ja 600-eurone pension üksi ei näita, kas tingimused on täidetud. [S1, S2]
>
> Viimsi 2026. aasta teabes on üksiku või pere esimese liikme toimetulekupiirina märgitud 220 eurot. Toimetulekutoetust saab, kui pärast arvesse võetavate eluasemekulude mahaarvamist jääb kuu netosissetulek alla kehtiva piiri. Seega ei piisa õiguse hindamiseks üksnes sinu 600-eurosest pensionist. Viimsi teabe järgi esitatakse esmakordne taotlus kohapeal ning lisatakse pangakontode väljavõtted ja eluasemekulude dokumendid; vajadusel ka varade ülevaade. [S3, S4, S12]
>
> Siin kasutatud seadusetekst ei anna üksi elava pensionäri toetuse selle aasta maksemäära, nii et ma ei saa sinu 600-eurose pensioni põhjal selle toetuse õigust kinnitada.
>
> Viimsi toimetulekutoetuse teave on kogutud 2026. aasta 29. aprillil ega ole siin värskelt üle kontrollitud.
>
> Kas rahvastikuregistris on sinu elukoht märgitud nii, et elad üksi? Kui suured on sinu jooksva kuu arvesse võetavad eluasemekulud?

## Laps üksi kodus → Tartu linn (`child-alone-report`)

Allikas: LasteKS: reporting a child in need. Vestlus: `cmul5p10p002ze0kmgqpvdssb`.

### 1. [new] Naabri väike laps on tihti öösiti üksi kodus ja nutab. Mida ma peaksin tegema? — **passed**

- Piirkond - (olek -), vastuse liik grounded, täpsustus true; otsing 3411 ms, kokku 12295 ms, 0.0038 USD
- Leitud allikad (3): Juhend: abivajavast lapsest teatamine ja andmekaitse; Lastekaitseseadus; Lapse heaolu hindamise käsiraamat
- Viidatud: Juhend: abivajavast lapsest teatamine ja andmekaitse; Lastekaitseseadus
- OK answer/completed: completed
- OK search/evidence: /Lastekaitseseadus/ among 3 found sources
- OK answer/cited: /Lastekaitseseadus/ among cited: Juhend: abivajavast lapsest teatamine ja andmekaitse, Lastekaitseseadus
- OK answer/must: /teata|teavita/ in the answer
- OK answer/valid_on: cited legal texts in force on 2026-09-28

> Kui laps on praegu üksi ja kardad, et tema elu või tervis on ohus, helista kohe 112. Hädaohus olevast lapsest tuleb viivitamata teada anda hädaabinumbril. [S1, S2]
>
> Kirjeldatu võib viidata sellele, et laps vajab abi. Abivajavast lapsest tuleb viivitamata teatada kohaliku omavalitsuse üksusele või lasteabitelefonil 116 111. Sa võid teatamisel enda andmed avaldamata jätta. [S3]
>
> Kas laps on praegu üksi või kardad, et tal on vahetu oht?

### 2. [same] Me elame Tartu linnas. — **passed**

- Piirkond tartu_linn (olek tartu_linn), vastuse liik partial, täpsustus true; otsing 3563 ms, kokku 14573 ms, 0.0052 USD
- Leitud allikad (52): Lastekaitseseadus; Juhend: abivajavast lapsest teatamine ja andmekaitse; Lapse heaolu hindamise käsiraamat; Eluruumi kohandamise toetus; Erakorraline tervisetoetus; Erakorraline toetus; Hooldajatoetus täisealise isiku hooldamise eest; Hooldajatoetus puudega lapse hooldajale; Lasteaia osalustasu ja toidukulu toetus; Matusetoetus; Tartu linna täiendav sünnitoetus; Toimetulekutoetus …
- Viidatud: Lastekaitseseadus; Juhend: abivajavast lapsest teatamine ja andmekaitse
- OK answer/completed: completed
- OK state/region: region tartu_linn, expected tartu_linn

> Tartu linnas saad abivajavast lapsest teada anda kohaliku omavalitsuse üksusele või lasteabitelefonil 116 111. Teate võib edastada ka siis, kui sa pole kindel, kuidas lapse olukorda hinnata. Kui laps on praegu vahetus ohus, helista 112. [S1, S2, S3]
>
> Kas tead, kas laps on praegu üksi või vahetus ohus?

## Tartu vald, mitte Tartu linn (`tartu-parish-not-city`)

Allikas: acceptance G8: the parish/city distinction. Vestlus: `cmul5pm1r0036e0km26haw8ho`.

### 1. [new] Elan Tartu vallas, mitte Tartu linnas. Kuhu pöörduda sotsiaaltranspordi saamiseks? — **state**

- Piirkond - (olek -), vastuse liik partial, täpsustus false; otsing 3400 ms, kokku 13609 ms, 0.0041 USD
- Leitud allikad (2): Omavalitsuste jaoks loodud nõustamisüksus; Sotsiaalne transport Eestis ühiskondliku ja eraelu sidujana
- Viidatud: Omavalitsuste jaoks loodud nõustamisüksus
- OK answer/completed: completed
- **VIGA** state/region: region null, expected tartu_vald
- **VIGA** state/service_summary: summaries: -

> Kagu-Eesti sotsiaaltranspordi pilootkorralduses hindas kohalik omavalitsus inimese abivajadust ja otsustas teenuse andmise üle. Võid alustada pöördumisest Tartu valla sotsiaalvaldkonna poole ning küsida, kuidas sinu sotsiaaltranspordi vajadust hinnatakse. [S1]
>
> Ma ei saa siinse info põhjal kinnitada Tartu valla praegust kontaktisikut ega taotlemise korda.

## Ema Raasikul → uus isik: tädi Sauel, „vajab sama“ (`new-person-same-need`)

Allikas: acceptance E1.2/E3.2. Vestlus: `cmul5pwnd003ae0kmsgyuldjc`.

### 1. [new] Mu ema vajab kodus abi igapäevaste toimingutega. Ta elab Raasiku vallas. — **passed**

- Piirkond raasiku_vald (olek raasiku_vald), vastuse liik partial, täpsustus false; otsing 2858 ms, kokku 18597 ms, 0.0051 USD
- Leitud allikad (40): Raasiku valla sotsiaalhoolekandelise abi osutamise kord; Eluruumi kohandamise toetus; Erakorraline toetus; Esimesse klassi mineva lapse toetus; Hooldusperetoetus; Lastega perede toetus; Matusetoetus; Suurenenud hooldus- ja abivajadusega lapse hooldajatoetus; Sünnitoetus; Tähtpäevatoetus; Täisealise isiku hooldajatoetus; Tervisetoetus …
- Viidatud: Raasiku valla sotsiaalhoolekandelise abi osutamise kord; Koduteenus
- OK answer/completed: completed
- OK state/region: region raasiku_vald, expected raasiku_vald
- OK state/service_summary: summaries: Eluruumi kohandamise toetus, Erakorraline toetus, Hooldusperetoetus, Lastega perede toetus, Matusetoetus, Suurenenud hooldus- ja abivajadusega lapse hooldajatoetus, Täisealise isiku hooldajatoetus, Tervisetoetus, Toimetulekutoetus, Sotsiaalteenuse taotlemise avaldus, Abi- ja infotelefonid, Erivajadusega laps, Hädaohus ja abivajav laps, Muud abivõimalused ja tugiliinid, Ohvriabi info, Perekeskus Männikäbi, Eluruumi tagamise teenus, Isikliku abistaja teenus, Järelhooldusteenus, Koduteenus, Lapsehoiuteenus suure hooldus- ja abivajadusega lapsele, Väljaspool kodu osutatav päevahoiuteenus täisealisele, Sotsiaaltransporditeenus, Täisealise isiku hooldus, Tugiisikuteenus, Turvakoduteenus, Väljaspool kodu osutatav ööpäevaringne üldhooldusteenus, Vaimse tervise teenus, Vältimatu sotsiaalabi

> Kui su ema on täisealine, võib talle sobida Raasiku valla koduteenus. See aitab inimesel kodus iseseisvalt ja turvaliselt toime tulla ning võib hõlmata näiteks toidu või ravimite toomist, asjaajamist ning abi enesehoolduses. [S1, S32]
>
> Järgmise sammuna saab ema ise või tema seaduslik või volitatud esindaja esitada vallavalitsusele suulise või kirjaliku taotluse. Kirjaliku taotluse saab esitada ka Raasiku valla iseteeninduses. Kirjelda taotluses, millistes igapäevatoimingutes ema abi vajab. Vallavalitsuse töötaja hindab abivajadust ja võib vajaduse korral tulla kodu külastama. [S2, S3]
>
> Koduteenus on osaliselt tasuline. Tasu sõltub teenuse mahust ja hinnast ning ema ja tema pere majanduslikust olukorrast; vallavalitsus võib asjaolusid arvestades tasu osaliselt või täielikult vähendada. [S1, S5]
>
> Ma ei saa nende andmete põhjal kinnitada, kas ema koduteenust saab või kui suureks tema tasu kujuneb. Tasu ja abivajadus selguvad juhtumipõhiselt hindamisel. Konkreetset teenuse hinda siin esitatud teave ei anna.

### 2. [new_person] Minu tädi elab Saue vallas ja vajab sama. — **passed**

_A new person starts without the mother's circumstances; asking what 'sama' means is acceptable._

- Piirkond saue_vald (olek saue_vald), vastuse liik partial, täpsustus true; otsing 2799 ms, kokku 14595 ms, 0.0053 USD
- Leitud allikad (45): Saue valla sotsiaalhoolekandelise abi andmise kord; Eestkostetava toetus; Erakorraline ühekordne toetus; Esmakordselt koolimineva lapse toetus; Hooldajatoetus; Hoolduspere lapse ja hoolduspere täiendavad toetused; Hoolduspere toetus; Hoolekandeasutuse teenuse toetus; Koduse lapse toetus; Koolitranspordi toetus puudega lapsele; Lapse ühekordne vajaduspõhine toetus; Lasteasutuse toetus …
- Viidatud: Saue valla sotsiaalhoolekandelise abi andmise kord
- OK answer/completed: completed
- OK state/region: region saue_vald, expected saue_vald
- OK state/previous_state_cleared: previous person's state

> Kui su tädi on Saue valla elanik ja vajab toimetulekuks kõrvalabi, võib ta Saue vallas sotsiaalteenust taotleda. Taotluse koos asjakohaste lisadokumentidega saab esitada tädi ise või tema nõusolekul pereliige. Abi hindamisel arvestatakse tema tegelikku toimetulekut ja kõrvalabi vajadust. [S1, S2]
>
> Ma ei saa aru, millist abi sa mõtled sõnaga „sama“, sest selles vestluses pole varasemat abi kirjeldatud.
>
> Millist abi su tädi vajab või millisele varasemale abile viitad?

## Kuuldeaparaat ja riigi osalus (`hearing-aid-cap`)

Allikas: acceptance C9: the 95% share without the price cap. Vestlus: `cmul5qmmo003he0kmcfk9prrd`.

### 1. [new] Ema kuulmine halveneb ja pensionist ei jätku kuuldeaparaadi ostmiseks. Kust alustada? — **search**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 4525 ms, kokku 25238 ms, 0.0051 USD
- Leitud allikad (2): Abivahendite teatmik 2025; Sotsiaalhoolekande seadus
- Viidatud: Abivahendite teatmik 2025; Sotsiaalhoolekande seadus
- OK answer/completed: completed
- **VIGA** search/evidence: /Abivahendite loetelu/ among 2 found sources
- **VIGA** answer/cited: /Abivahendite loetelu/ among cited: Abivahendite teatmik 2025, Sotsiaalhoolekande seadus
- **VIGA** answer/must: /piirhin/ in the answer

> Alustage audioloogi või nina-kõrva-kurguarsti juurest, kes saab hinnata kuulmisabivahendi vajadust. Kõrvataguse kuuldeaparaadi väljastamiseks on vaja audiogrammi. [S2]
>
> Kui ema on vanaduspensioniealine, saab ta abivahendite loetelu alusel riigi osalust. Vähemalt 30 dB kuulmislanguse korral kehtib kuulmisabivahenditele loetelus märgitud riigi osaluse määr. Abivahendi müüjale tuleb esitada isikut tõendav dokument ja arsti või spetsialisti tõend, kus on kirjas vajatav abivahend. [S1, S3]
>
> Kui omaosalus jääb liiga suureks, võib Sotsiaalkindlustusamet erandkorras otsustada selle vähendamise üle. Erandi taotlus tuleb esitada Sotsiaalkindlustusametile enne abivahendi ostmist. [S3, S4, S5]
>
> Siin oleva info põhjal ei saa öelda riigi osaluse täpset määra ega seda, kas ema sellele vastab. Määr sõltub abivahendite loetelust ning ema vanaduspensioniea staatus ja kuulmislanguse mõõdetud tase pole teada.
>
> Mis omavalitsuses ema elab? Seda on vaja, kui soovid uurida ka kohaliku abi võimalusi.

## Täna öösel pole kuskil magada (`shelter-tonight`)

Allikas: acceptance C7: a first step before the clarification. Vestlus: `cmul5r69t003le0km9lr63lga`.

### 1. [new] Mul pole täna öösel kusagil magada ega raha toidu ostmiseks. Kust saan kohe abi? — **passed**

_The first step (the local government of residence) should come before any clarifying question._

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 4283 ms, kokku 13702 ms, 0.0036 USD
- Leitud allikad (2): Sotsiaalhoolekande seadus; Arendame koos valmisolekut kriisiolukordadeks
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK answer/must: /omavalitsus|vald|linn/ in the answer

> Mul on kahju, et oled täna sellises olukorras. Kui sul puuduvad elatusvahendid ja oled seetõttu sotsiaalselt abitus olukorras, tuleb sulle osutada vältimatut sotsiaalabi, mis tagab vähemalt toidu ja ajutise majutuse. Kui oled täisealine ega suuda endale ööbimiskohta leida, korraldab varjupaigateenust omavalitsus, kus sa abi vajaduse tekkimisel viibid. [S1, S2, S3]
>
> Võta kohe ühendust selle omavalitsusega, kus sa praegu viibid. Ütle, et sul pole täna ööseks ööbimiskohta ega raha toiduks, ning küsi vältimatut sotsiaalabi ja varjupaigateenust. [S1, S2, S3]
>
> Ma ei saa sinu asukoha põhjal öelda, millise omavalitsuse kontaktiga ühendust võtta.
>
> Mis linnas või vallas sa praegu viibid?

### 2. [same] Olen Narvas. — **passed**

- Piirkond narva_linn (olek narva_linn), vastuse liik partial, täpsustus true; otsing 4006 ms, kokku 15814 ms, 0.0049 USD
- Leitud allikad (50): Sotsiaalhoolekande seadus; Narva sotsiaaltöös keskendutakse teenuste kvaliteedile ja koostööle; Elluastumistoetus; Eluruumi kohandamise toetus; Erakorraline toetus; Esmakordselt kooli mineva lapse toetus; Haridusliku erivajadusega õpilase transporditoetus; Hooldajatoetus; Jõulupakitoetus; Koolimineku toetus; Koolitoetus ehk esimesse klassi mineva lapse toetus; Laste suvepuhkuse toetus …
- Viidatud: Varjupaigateenus; Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK state/region: region narva_linn, expected narva_linn

> Narva varjupaigateenus pakub täisealisele ajutist ööbimiskohta. Pöördu Narva Sotsiaalabiameti või Narva Sotsiaaltöökeskuse poole; teenust korraldatakse sotsiaalmaja kaudu aadressil Karja 6a. Narva elanikule, kellel pole piisavalt raha ööbimiskoha leidmiseks, on teenus tasuta. [S50]
>
> Kui elatusvahendite puudumine on pannud su sotsiaalselt abitusse olukorda, tuleb sulle osutada vältimatut sotsiaalabi, mis tagab vähemalt toidu ja ajutise majutuse. Ütle pöördudes, et sul pole täna ööseks kohta ega raha toidu ostmiseks, ja küsi vältimatut sotsiaalabi. [S1]
>
> Ma ei saa siin kinnitada, kas teenust saab täna kohe kasutada, ega anda kontrollitud telefoninumbrit.
>
> Kas oled 18-aastane või vanem?
