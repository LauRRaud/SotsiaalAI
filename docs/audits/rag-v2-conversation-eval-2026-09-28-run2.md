# Vestluste hindamine 2026-09-28, kataloog v2 (ADR-042 kood enne PR-i)

Kataloog `tests/evaluation/dialogue/scenarios-corpus-2.json`, indeks v33 (`search_generation_62a42e84…`), mudel `gpt-6-luna` (`medium`).
Muudetud kood jooksis eraldi koopias kahe aktiveerimata plaaniga:

- **Osa 1:** plaan `m4-sotsiaalai-corpus-chat-20260928-1310`, 0,1067 USD.
  - Selle 0,5 USD piir on arvestatud halvima juhu broneeringutena. Piir täitus pärast 22 pööret, nii et hilisemad pöörded said `pilot_budget_exhausted` või `pilot_rate_limit`.
  - Siia on võetud osa 1 esimesed seitse vestlust (20 pööret).
- **Osa 2:** plaan `m4-sotsiaalai-corpus-chat-20260928-1320`, 0,1006 USD, ülejäänud üheksa vestlust (20 pööret).

| Tulemus | Pöördeid |
|---|---:|
| passed | 37 |
| search | 0 |
| answer | 2 |
| state | 1 |

Iga vestluse all on automaatne tulemus nagu käivitusaruandes. Vastused ja allikad on muutmata.

## Raha otsas → vald → toimetulekutoetus → kontakt (`money-harku-contact`)

Allikas: scenarios-1.json. Vestlus: `cmul9nur00000dzkm3n2w0cux`.

### 1. [new] Mul on raha otsas ja toiduks ei jätku. — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 16246 ms, kokku 29656 ms, 0.0040 USD
- Leitud allikad (4): Sotsiaalhoolekande seadus; Arendame koos valmisolekut kriisiolukordadeks; Kas sotsiaalabi on (turva)võrk või hüppelaud? Kuidas aidata inimesed kiiresti taas jalule; Isikliku abistaja teenuse reguleerimine kohaliku omavalitsuse õigusaktides
- Viidatud: Sotsiaalhoolekande seadus; Isikliku abistaja teenuse reguleerimine kohaliku omavalitsuse õigusaktides
- OK answer/completed: completed
- OK state/region: region null, expected null

> Kui elatusvahendite puudumise tõttu oled sattunud sotsiaalselt abitusse olukorda, tuleb sulle osutada vältimatut sotsiaalabi. See peab tagama vähemalt toidu, riietuse ja ajutise majutuse ning kestma, kuni sa enam sellises olukorras ei ole. [S1]
>
> Võta abi küsimiseks ühendust oma valla või linna sotsiaaltöötajaga. Pöörduda saab ka suuliselt; pärast sinu abisoovi avaldamist tuleb sinu abivajadust täpsemalt hinnata ja abi korraldada. [S4]
>
> Ma ei saa sinu kohaliku sotsiaaltöötaja kontaktandmeid anda, sest sa pole öelnud, millises vallas või linnas abi vajad.
>
> Mis vallas või linnas sa abi vajad, ja kas sul on täna midagi süüa?

### 2. [same] Elan Harku vallas. — **passed**

- Piirkond harku_vald (olek -), vastuse liik partial, täpsustus true; otsing 6074 ms, kokku 25754 ms, 0.0053 USD
- Leitud allikad (45): Sotsiaalhoolekande seadus; Sotsiaalhoolekandelise abi andmise kord; Hooldajatoetus; Jõulutoetus; Koolitoetus eestkostel või peres hooldamisel olevale lapsele; Koolitoetus põhikooli või gümnaasiumi lõpetamisel; Koolitoetus peredele, kus õpib vähemalt kaks last; Koolitoetus peredele, kus õpib vähemalt üks laps; Koolitoetus kultuuri- ja spordiüritustel osalemiseks; Küttetoetus; Laagritoetus; Matusetoetus …
- Viidatud: Sotsiaalhoolekande seadus; Sotsiaalhoolekandelise abi andmise kord; Toidupank; Toidutoetus vähekindlustatud peredele
- OK answer/completed: completed
- OK state/region: region harku_vald, expected harku_vald
- OK state/service_summary: summaries: Hooldajatoetus, Jõulutoetus, Koolitoetus peredele, kus õpib vähemalt üks laps, Koolitoetus kultuuri- ja spordiüritustel osalemiseks, Matusetoetus, Rimi toidukaart, Toidutoetus vähekindlustatud peredele, Toimetulekutoetus, Ühekordne toetus, Pere tulust sõltuva toetuse taotlus, Toimetulekutoetuse taotlus, Harku Sotsiaalkeskus, Eluruumi teenus, Koduteenus, Sotsiaaltransporditeenus, Toidupank, Üldhooldusteenus väljaspool kodu, Võlanõustamisteenus

> Kui elatusvahendite puudumine on viinud sind sotsiaalselt abitusse olukorda, tuleb sulle osutada vältimatut sotsiaalabi, mis tagab vähemalt toidu. Harku vallas otsustab valla eelarvest rahastatava vältimatu abi osakond, hinnates sinu või pere toimetulekuvõimet ja valla eelarvelisi võimalusi. [S1, S2]
>
> Üks võimalus on Harku valla Toidupanga toiduabi. Kui sotsiaalhoolekandespetsialist hindab, et vajad abi, saad toidupaki hindamise kuul ja sellele järgneval kolmel kuul; pikema vajaduse korral hinnatakse olukorda uuesti. Taotluse saad esitada vabas vormis digiallkirjastatult e-postiga või paberkandjal Harku Vallavalitsuses. [S43]
>
> Kui sinu netosissetulek pereliikme kohta jääb alla Harku valla toimetulekupiiri, võib sobida ka toidutoetus. Esita digiallkirjastatud avaldus e-postiga või iseteeninduses ning lisa viimase kolme kuu pangaväljavõtted ja kuludokumendid. [S23]
>
> Harku valla toiduabi andmed on kogutud 2026. aasta aprillis; ma ei saa nende põhjal kinnitada, kas kirjeldatud korraldus on praegu muutumatuna kehtiv.
>
> Kas sul on täna midagi süüa?

### 3. [same] Kellele ma saan helistada? — **state**

- Piirkond harku_vald (olek -), vastuse liik partial, täpsustus true; otsing 6318 ms, kokku 16557 ms, 0.0045 USD
- Leitud allikad (46): Sotsiaalhoolekandelise abi andmise kord; Sotsiaalhoolekande seadus; Hooldajatoetus; Jõulutoetus; Koolitoetus eestkostel või peres hooldamisel olevale lapsele; Koolitoetus põhikooli või gümnaasiumi lõpetamisel; Koolitoetus peredele, kus õpib vähemalt kaks last; Koolitoetus peredele, kus õpib vähemalt üks laps; Koolitoetus kultuuri- ja spordiüritustel osalemiseks; Küttetoetus; Laagritoetus; Matusetoetus …
- Viidatud: Toidupank
- OK answer/completed: completed
- OK state/region: region harku_vald, expected harku_vald
- OK state/details: details: Toidutoetus vähekindlustatud peredele, Toidupank
- **VIGA** state/contacts: contact persons 0

> Harku valla toidupanga abi saamiseks esita digiallkirjastatud vabas vormis taotlus e-postiga või paberkandjal Harku Vallavalitsuses. Sotsiaalhoolekandespetsialist hindab siis sinu abivajadust. [S42]
>
> Ma ei saa siin kinnitada Harku valla sotsiaalhoolekande spetsialisti telefoninumbrit.
>
> Kas sul on täna midagi süüa?

## Emale abi kodus → Kose → parandus: Harku (`mother-kose-corrected-harku`)

Allikas: scenarios-1.json. Vestlus: `cmul9peqi000adzkm85cawokb`.

### 1. [new] Vajan emale kodus abi igapäevaste toimingutega. — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 16665 ms, kokku 25835 ms, 0.0038 USD
- Leitud allikad (2): Koduteenuste korraldus; Sotsiaalhoolekande seadus
- Viidatud: Sotsiaalhoolekande seadus; Koduteenuste korraldus
- OK answer/completed: completed
- OK state/region: region null, expected null

> Kui su ema on täisealine ja terviseseisundi, toimetuleku või elukeskkonna tõttu ei saa mõne vajaliku igapäevatoiminguga üksi hakkama, võib talle sobida koduteenus. Selle käigus saab abi näiteks kütmisel, toidu valmistamisel, kodu ja riiete korrastamisel ning poes või asjaajamisel käimisel. Omavalitsus hindab iga inimese kõrvalabi vajadust eraldi. [S2, S3]
>
> Järgmise sammuna võta ühendust ema elukohajärgse omavalitsuse sotsiaaltöötajaga ja kirjelda, milliste igapäevatoimingutega ta abi vajab. [S1]
>
> Ma ei saa praegu öelda, millised on ema elukohajärgse omavalitsuse täpsemad tingimused ega kuidas seal teenust taotleda.
>
> Mis omavalitsuses su ema elab ja kas ta on täisealine?

### 2. [same] Ema elab Kose vallas. — **passed**

- Piirkond kose_vald (olek kose_vald), vastuse liik partial, täpsustus true; otsing 9914 ms, kokku 24220 ms, 0.0061 USD
- Leitud allikad (55): Koduteenuste korraldus; Sotsiaalhoolekande seadus; Koduteenuse korraldamise probleeme kohalikes omavalitsustes; Eakate tähtpäeva toetus; Eluasemekulude toetus; Erakorraline sotsiaalabi toetus; Esmakordselt kooli mineva lapse toetus; Hooldajatoetus puudega lapse hooldajale; Hooldajatoetus täisealise isiku hooldajale; Huvihariduse ja huvitegevuse toetus paljulapselistele ja vähekindlustatud peredele; Koduse lapse toetus; Kutseõppeasutuses õppiva õpilase toetus …
- Viidatud: Koduteenus
- OK answer/completed: completed
- OK state/region: region kose_vald, expected kose_vald
- OK state/service_summary: summaries: Erakorraline sotsiaalabi toetus, Tervisetoetus, Toimetulekutoetus, Avaldus koduteenuse taotlemiseks, Automaatne ravimikarp helialarmiga, Hädaabinumber, Kose Sotsiaal- ja Hariduse Tugiteenuste Keskus, Lasteabi, Ohvriabi, Omastehoolduse infopunkt, Asendushooldusteenus, Isikliku abistaja teenus, Isikukeskne hoolekandeteenus, Kodunupp, Koduteenus, Lapsehoiuteenus, Nõustamisteenused omastehooldajatele, Päevakeskuse teenus, Täisealise isiku hooldus, Trepironija teenus, Tugiisikuteenus lapsele, Tugiisikuteenus tööealisele isikule, Väljaspool isiku kodu osutatav üldhooldusteenus

> Kui su ema on täisealine ja vajab kodus igapäevatoimingutes kõrvalabi, võib talle sobida Kose valla koduteenus. Abi võib hõlmata näiteks kütmist, toidu valmistamist, kodu ja riiete korrastamist ning poes käimist. Teenust osutab Kose Sotsiaalkeskus. [S45]
>
> Järgmise sammuna täida koduteenuse taotlus, digiallkirjasta see ja saada vallavalitsusele või esita kohapeal. Kose vallas selgitatakse teenuse vajadus välja kodukülastusel; teenuse osutamiseks sõlmitakse leping ja koostatakse hooldusplaan. [S45]
>
> Kose koduteenuse kohta käiv kogutud teave kontrolliti 29. aprillil 2026; praegust teenuse kättesaadavust ei ole selle põhjal kinnitatud.
>
> Kas su ema on täisealine?

### 3. [correction] Vabandust, tegelikult elab ema Harkus. — **passed**

- Piirkond harku_vald (olek harku_vald), vastuse liik partial, täpsustus true; otsing 4689 ms, kokku 16693 ms, 0.0050 USD
- Leitud allikad (43): Sotsiaalhoolekandelise abi andmise kord; Hooldajatoetus; Jõulutoetus; Koolitoetus eestkostel või peres hooldamisel olevale lapsele; Koolitoetus põhikooli või gümnaasiumi lõpetamisel; Koolitoetus peredele, kus õpib vähemalt kaks last; Koolitoetus peredele, kus õpib vähemalt üks laps; Koolitoetus kultuuri- ja spordiüritustel osalemiseks; Küttetoetus; Laagritoetus; Matusetoetus; Nägemise parandamise toetus (alla 16‑aastastele) …
- Viidatud: Koduteenus
- OK answer/completed: completed
- OK state/region: region harku_vald, expected harku_vald
- OK state/service_summary: summaries: Hooldajatoetus, Jõulutoetus, Puudega isiku transporditoetus, Toidutoetus vähekindlustatud peredele, Toimetulekutoetus, Ühekordne toetus, Pere tulust mittesõltuva toetuse taotlus, Eakate päevakeskus, Harku Sotsiaalkeskus, Viipekeele tõlketeenus, Eluruumi teenus, Häirenuputeenus, Isikliku abistaja teenus, Koduteenus, Täisealise isiku hooldus, Toidupank, Tugiisikuteenus, Turvakoduteenus, Üldhooldusteenus väljaspool kodu, Vaimse tervise nõustamine, Varjupaigateenus

> Harku vallas on koduteenus eakatele ja puuetega inimestele, kes vajavad igapäevatoimingutes kõrvalabi. Abi vajadust hindab sotsiaalhoolekandespetsialist. Taotluse saab esitada vabas vormis digiallkirjastatult e-postiga või paberkandjal Harku Vallavalitsusele. [S37]
>
> Koduteenuse kirjeldus on kogutud 11. aprillil 2026 ja selle põhjal ei saa kinnitada teenuse praegust kättesaadavust.
>
> Kas su ema on täisealine?

## Isa Tallinnas → uus isik: enda võlad → Kose (`father-tallinn-then-own-debts-kose`)

Allikas: scenarios-1.json. Vestlus: `cmul9quob000kdzkmlitosjd0`.

### 1. [new] Mu eakas isa ei saa enam üksi hakkama, kuhu pöörduda? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 9439 ms, kokku 28073 ms, 0.0046 USD
- Leitud allikad (5): Koduteenuste korraldus; Väljaspool kodu osutatav üldhooldusteenus; Kohaliku omavalitsuse väljakutsed sotsiaalteenuste osutamisel; Täisealise inimese abivajaduse hindamine – uued võimalused STAR-is; Heade praktikate kogumik
- Viidatud: Koduteenuste korraldus; Täisealise inimese abivajaduse hindamine – uued võimalused STAR-is; Väljaspool kodu osutatav üldhooldusteenus; Kohaliku omavalitsuse väljakutsed sotsiaalteenuste osutamisel
- OK answer/completed: completed
- OK state/region: region null, expected null

> Alusta pöördumisest isa kohaliku omavalitsuse sotsiaaltöötaja poole. Omavalitsus selgitab välja, millist abi isa vajab. Sina saad tema olukorrast omavalitsusele teada anda. [S1, S4]
>
> Kui isa vajab abi kodus igapäevatoimingutega, võib sobida koduteenus, näiteks abi toidu valmistamisel või asjaajamisel. Kui muud teenused tema toimetulekut enam ei taga, võib kaaluda väljaspool kodu osutatavat üldhooldusteenust. Sobiv abi selgub vajaduse hindamisel. [S1, S2, S3]
>
> Ma ei saa isa kohaliku omavalitsuse konkreetset kontakti nimetada, sest tema elukoha omavalitsus pole teada.
>
> Mis vallas või linnas isa elab? Siis saan aidata leida õige pöördumiskoha.

### 2. [same] Isa elab Tallinnas. — **passed**

- Piirkond tallinn (olek tallinn), vastuse liik partial, täpsustus false; otsing 5456 ms, kokku 18779 ms, 0.0055 USD
- Leitud allikad (76): Koduteenuste korraldus; Väljaspool kodu osutatav üldhooldusteenus; Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte; Eluruumide kohandamise kulude hüvitamine; Hooldajatoetus täisealise inimese hooldajale; Imikupakk; Juhtkoera pidamise toetus; Matusetoetus; Mittetulundustegevuse toetamine sotsiaalhoolekande valdkonnas; Pensionilisa; Puudega lapse hooldajatoetus; Puudega lapse toetus …
- Viidatud: Koduteenuste korraldus; Koduteenus
- OK answer/completed: completed
- OK state/region: region tallinn, expected tallinn
- OK state/service_summary: summaries: Puudega lapse hooldajatoetus, Sotsiaalhoolekandelise abi taotluse vorm PDF, Sotsiaalhoolekandelise abi taotluse vorm RTF, Perepesa, Tallinna Sotsiaaltöö Keskuse teenusega seotud ressursid, Tugi lahkuminevatele vanematele, Vanemlike oskuste edendamine, Eestkostjaks saamine, Eluruumi tagamise teenus, Erivajadusega inimese päevahoid, Isiklik abistaja, Järelhooldusteenus, Koduteenus, Lapse mentor-tugiisik, Laste turvakodu, Omastehooldaja asendamine, Ööpäevane üldhooldus, Psüühikahäirega inimese tugiteenus, Raske ja sügava puudega lapse hoiukodu, Sotsiaal- ja majutusteenus, Sotsiaalvalveteenus ehk Häirenupp, Täisealise inimese hooldamine, Toetatud elamine, Toetav pereteenus, Toimetulekunõustamine, Tugiisik täisealisele inimesele, Vanema ja lapse turvakodu

> Alusta Tallinna linnalt isa abivajaduse hindamise küsimisest. Koduteenuse soovist võib teada anda ka lähedane. Hindamise teeb tavaliselt omavalitsuse sotsiaaltöötaja. Koduteenus võib sobida, kui isa vajab kodus igapäevatoimingutes abi või juhendamist. [S1, S41]
>
> Ma ei saa siin nimetada isa linnaosa sotsiaalhoolekande osakonna konkreetset kontakti ega kinnitada praegust taotluskanalit.

### 3. [new_person] Mul on suured võlad, kes aitab? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 5021 ms, kokku 13542 ms, 0.0037 USD
- Leitud allikad (3): Sotsiaalhoolekande seadus; Uusi teadmisi võlanõustamise koolituselt; Võlanõustamisteenuse arendamisest
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK state/region: region null, expected null
- OK state/previous_state_cleared: previous person's state

> Sind saab aidata kohaliku omavalitsuse korraldatav võlanõustamisteenus. Võlanõustaja aitab sinu varalist olukorda selgitada, võlausaldajatega läbirääkimisi pidada ja võlgnevusega seotud probleeme lahendada. Võta ühendust oma valla või linna sotsiaaltöötajaga ja küsi võlanõustamist. [S1]
>
> Ma ei saa sinu omavalitsust teadmata öelda, kelle poole seal täpselt pöörduda.
>
> Mis vallas või linnas sa elad? Siis saan aidata leida kohaliku pöördumiskoha.

### 4. [same] Elan Kose vallas. — **passed**

- Piirkond kose_vald (olek kose_vald), vastuse liik partial, täpsustus false; otsing 4092 ms, kokku 16358 ms, 0.0055 USD
- Leitud allikad (58): Uusi teadmisi võlanõustamise koolituselt; Sotsiaalhoolekande seadus; Võlanõustamisteenuse arendamisest; Põhja-Pärnumaa võlanõustamiskogemus; Pikaajalised toimetulekutoetuse saajad vajavad rohkem tuge; Eakate tähtpäeva toetus; Eluasemekulude toetus; Erakorraline sotsiaalabi toetus; Esmakordselt kooli mineva lapse toetus; Hooldajatoetus puudega lapse hooldajale; Hooldajatoetus täisealise isiku hooldajale; Huvihariduse ja huvitegevuse toetus paljulapselistele ja vähekindlustatud peredele …
- Viidatud: Sotsiaalhoolekande seadus; Võlanõustamisteenus
- OK answer/completed: completed
- OK state/region: region kose_vald, expected kose_vald
- OK state/service_summary: summaries: Eluasemekulude toetus, Erakorraline sotsiaalabi toetus, Lasteaia toiduraha ja kohamaksutoetus, Lasteaia toidutoetus suurele perele, Tervisetoetus, Toimetulekutoetus, Üldhariduskooli toiduraha toetus, Sotsiaalhoolekandelise abi taotlemise avaldus, Kose valla SPOKU e-taotluste keskkond, Automaatne ravimikarp helialarmiga, Hädaabinumber, Kose Sotsiaal- ja Hariduse Tugiteenuste Keskus, Lasteabi, Ohvriabi, Eluruumi tagamine, Isikliku abistaja teenus, Isikukeskne hoolekandeteenus, Koduteenus, Nõustamisteenused omastehooldajatele, Tugiisikuteenus tööealisele isikule, Väljaspool isiku kodu osutatav üldhooldusteenus, Võlanõustamisteenus

> Mul on kahju, et sul on suur võlamure. Kose vallas saad küsida võlanõustamisteenust: see aitab sul oma rahaasjad selgeks saada, võlausaldajatega läbi rääkida ja uusi võlgu vältida. [S2, S59]
>
> Võta ühendust Kose valla sotsiaalosakonna ametnikuga telefoni, e-posti teel või kohapeal ja küsi võlanõustamist. Ametnik hindab sinu abivajadust ja teenuse esialgset mahtu ning võib vajadusel suunamiskirja väljastada. Vallavalitsuse otsusega teenusele suunatud inimesele on teenus tasuta. [S59]
>
> Mul pole siin sotsiaalosakonna ametniku nime ega telefoni- või e-posti aadressi. Kose valla teenuseinfo oli kontrollitud 29.04.2026, seega ei saa ma kinnitada, kas teenuse korraldus on praegu sama.

## Toimetulek → kriisilause → Tallinn (`crisis-then-help-tallinn`)

Allikas: scenarios-1.json. Vestlus: `cmul9sii7000xdzkmkuwv7ex8`.

### 1. [new] Olen üksi kodus, raske on toimetulek, tööd ei ole. — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 4643 ms, kokku 25679 ms, 0.0051 USD
- Leitud allikad (3): Sotsiaalhoolekande seadus; Kas sotsiaalabi on (turva)võrk või hüppelaud? Kuidas aidata inimesed kiiresti taas jalule; Töötaja saab edaspidi töötuskindlustusest suurema kaitse
- Viidatud: Sotsiaalhoolekande seadus; Kas sotsiaalabi on (turva)võrk või hüppelaud? Kuidas aidata inimesed kiiresti taas jalule
- OK answer/completed: completed
- OK state/region: region null, expected null
- OK state/crisis: crisis false

> Kui sinu või sinu leibkonna rahast esmavajadusteks ei piisa ja kuu netosissetulek jääb pärast arvesse võetavate eluasemekulude mahaarvamist alla toimetulekupiiri, võib sul olla õigus toimetulekutoetusele. See on ajutine abi esmavajaduste katmiseks. [S1]
>
> Toetust saad taotleda tegeliku elukoha järgse kohaliku omavalitsuse kaudu. Jooksva kuu toetuse taotlus tuleb esitada hiljemalt kuu viimasel tööpäeval. Lisa eelmise kuu sissetulekuid tõendavad dokumendid; kui soovid, et arvesse läheksid eluasemekulud, lisa ka nende ja eluruumi kasutamise õiguse tõendid. [S2]
>
> Lisaks rahalisele toetusele tasub paluda omavalitsusel hinnata, kas vajad näiteks toiduabi, võlanõustamist või tuge eluruumiga. Kohalik abipakett sõltub sinu vajadustest. [S3, S4]
>
> Ma ei saa sinu toetuse saamise õigust praegu kindlaks teha. Selleks on vaja teada leibkonna sissetulekuid ja arvesse võetavaid eluasemekulusid; samuti pole selge, kas elad üksi või olid lihtsalt sel hetkel kodus üksi.
>
> Mis vallas või linnas sa elad? Kas elad päriselt üksi või jagad kodu kellegagi?

### 2. [same] Vahel tunnen, et tahan end tappa. — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 9441 ms, kokku 25353 ms, 0.0045 USD
- Leitud allikad (5): Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte; Kas sotsiaalabi on (turva)võrk või hüppelaud? Kuidas aidata inimesed kiiresti taas jalule; Sotsiaalhoolekande seadus; Toimetulekutoetuse kui riikliku sotsiaalabi korraldus; TÖÖLEHT: Tugevate tunnetega toimetulek
- Viidatud: Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte
- OK answer/completed: completed
- OK state/region: region null, expected null
- OK state/crisis: crisis true

> Mul on kahju, et sul nii raske on. Eestis saab erakorralist psühhiaatrilist abi psühhiaatriakliinikutes ööpäev läbi. Kui tunned, et võid endale kohe viga teha, pöördu sinna viivitamata. [S1]
>
> Ma ei saa selle info põhjal öelda, milline psühhiaatriakliinik on sulle lähim ega anda selle täpset kontakti.
>
> Kas sul on praegu plaan või vahendid endale viga teha või tunned, et võid seda kohe teha?

### 3. [same] Elan Tallinnas. — **passed**

- Piirkond tallinn (olek tallinn), vastuse liik partial, täpsustus true; otsing 6150 ms, kokku 21439 ms, 0.0056 USD
- Leitud allikad (78): Sotsiaalhoolekandelise abi andmise kord; Sotsiaalhoolekande seadus; Sotsiaaltoetuste maksmise tingimused ja kord; Sotsiaaltoetuste määrad; Kas sotsiaalabi on (turva)võrk või hüppelaud? Kuidas aidata inimesed kiiresti taas jalule; Eluruumide kohandamise kulude hüvitamine; Hooldajatoetus täisealise inimese hooldajale; Imikupakk; Juhtkoera pidamise toetus; Matusetoetus; Mittetulundustegevuse toetamine sotsiaalhoolekande valdkonnas; Pensionilisa …
- Viidatud: Kriisiabi nõustamine; Sotsiaalhoolekande seadus; Sotsiaaltoetuste maksmise tingimused ja kord
- OK answer/completed: completed
- OK state/region: region tallinn, expected tallinn
- OK state/service_summary: summaries: Eluruumide kohandamise kulude hüvitamine, Matusetoetus, Puudega lapse hooldajatoetus, Toimetulekutoetus, Sotsiaalhoolekandelise abi taotluse vorm PDF, Sotsiaalhoolekandelise abi taotluse vorm RTF, Soovitusi kodu kohandamistööde kavandamisel, Omastehoolduse infopunkt veebis, Tallinna Sotsiaaltöö Keskuse teenusega seotud ressursid, Eluruumi tagamise teenus, Järelhooldusteenus, Koduteenus, Kogemusnõustamine psüühikahäirega inimesele, Kriisiabi nõustamine, Majandamisnõustamine, Omastehooldaja asendamine, Ööpäevane üldhooldus, Psühhosotsiaalne nõustamine nägemispuudega lastele ja täiskasvanutele, Psüühikahäirega inimese tugiteenus, Sotsiaal- ja majutusteenus, Sotsiaalvalveteenus ehk Häirenupp, Täisealise inimese hooldamine, Toetatud elamine, Toetav pereteenus, Toimetulekunõustamine, Toimetulekuõpe, Tugiisik täisealisele inimesele

> Tallinnas on kriisiabi nõustamine lühiajaline psühholoogiline abi ka vaimse tervise probleemide korral. Nõustamine toimub kohapeal või telefoni teel ning on Tallinna elanikele tasuta, konfidentsiaalne ja anonüümne. [S46]
>
> Kui sinu rahalistest vahenditest ei piisa ja kuu netosissetulek jääb pärast arvestatavate eluasemekulude mahaarvamist alla toimetulekupiiri, võib sul olla õigus toimetulekutoetusele. Tallinnas menetleb seda tegeliku elukoha järgse linnaosa sotsiaalhoolekande osakond; vajadusel võib toetuse määrata koos sotsiaalteenustega. [S2, S3]
>
> Ma ei saa siin kinnitada kriisiabi telefoninumbrit ega anda kinnitatud teavet ööpäevaringse erakorralise abi kohta. Sinu toetuse saamise õigust ei saa nende andmete põhjal kindlaks teha.
>
> Kas oled praegu vahetus ohus või on sul plaan või vahendid endale viga teha?

## Arsti juurde sõit → Kose (`transport-kose`)

Allikas: scenarios-1.json. Vestlus: `cmul9u2um0017dzkmigyoqion`.

### 1. [new] Arsti juurde on raske sõita, kas on transporti? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 3591 ms, kokku 12245 ms, 0.0045 USD
- Leitud allikad (5): Sotsiaalhoolekande seadus; Sotsiaaltransporditeenuse arendamisest; Sotsiaalne transport Eestis ühiskondliku ja eraelu sidujana; Sotsiaaltranspordi katseprojekt; Kohaliku omavalitsuse väljakutsed sotsiaalteenuste osutamisel
- Viidatud: Sotsiaalhoolekande seadus; Sotsiaaltransporditeenuse arendamisest
- OK answer/completed: completed
- OK state/region: region null, expected null

> Sotsiaaltransport on kohaliku omavalitsuse korraldatav teenus puudega inimesele, kui puue takistab tal isikliku või ühissõiduki kasutamist. Teenusega saab sõita avalikke teenuseid kasutama. Arsti külastamine on toodud ühe sellise sõidu näitena. [S1, S2]
>
> Ma ei saa selle info põhjal öelda, kuidas sinu vallas või linnas teenust korraldatakse või kust seda küsida.
>
> Kas sul on puue, mis takistab isikliku või ühissõiduki kasutamist, ja mis vallas või linnas sa elad?

### 2. [same] Elan Kose vallas. — **passed**

- Piirkond kose_vald (olek kose_vald), vastuse liik partial, täpsustus true; otsing 4834 ms, kokku 24110 ms, 0.0067 USD
- Leitud allikad (57): Sotsiaalhoolekande seadus; Sotsiaaltranspordi katseprojekt; Sotsiaalne transport Eestis ühiskondliku ja eraelu sidujana; Sotsiaaltransporditeenuse arendamisest; Eakate tähtpäeva toetus; Eluasemekulude toetus; Erakorraline sotsiaalabi toetus; Esmakordselt kooli mineva lapse toetus; Hooldajatoetus puudega lapse hooldajale; Hooldajatoetus täisealise isiku hooldajale; Huvihariduse ja huvitegevuse toetus paljulapselistele ja vähekindlustatud peredele; Koduse lapse toetus …
- Viidatud: Sotsiaaltransporditeenus; Sotsiaalhoolekande seadus; Sotsiaaltransporditeenuse arendamisest
- OK answer/completed: completed
- OK state/region: region kose_vald, expected kose_vald
- OK state/service_summary: summaries: Erakorraline sotsiaalabi toetus, Kutseõppeasutuses õppiva õpilase toetus, Tervisetoetus, Sotsiaalhoolekandelise abi taotlemise avaldus, Kose valla SPOKU e-taotluste keskkond, Automaatne ravimikarp helialarmiga, Hädaabinumber, Kose Sotsiaal- ja Hariduse Tugiteenuste Keskus, Omastehoolduse infopunkt, Perearsti nõuandeliin 1220, Puudega inimese sõiduki parkimiskaart, Isikliku abistaja teenus, Isikukeskne hoolekandeteenus, Koduteenus, Nõustamisteenused omastehooldajatele, Päevakeskuse teenus, Sotsiaaltransporditeenus, Trepironija teenus, Tugiisikuteenus tööealisele isikule, Väljaspool isiku kodu osutatav üldhooldusteenus, Võlanõustamisteenus

> Kose vallas on sotsiaaltransporditeenus inimesele, kelle puue takistab isikliku või ühissõiduki kasutamist. Teenusega saab sõita avalikke teenuseid kasutama; tervishoiuteenuse, näiteks arsti külastamise, kohta on toodud sellise sõidu näide. [S49, S1, S4]
>
> Teenust saad taotleda suuliselt või kirjalikult sotsiaalosakonna ametnikult. Kirjelda, mis takistab ühissõiduki kasutamist, miks sõitu vajad ning mis ajal ja kuhu soovid sõita. Ametnik hindab abivajadust ja annab teenuse osutamisest või mitteosutamisest teada hiljemalt viie tööpäeva jooksul. [S49]
>
> Ma ei saa kinnitada, kas Kose valla teenuse kirjeldus ja korraldus on praegu samad; see info oli kontrollitud 29.04.2026.
>
> Kas sul on puue, mis takistab isikliku auto või ühissõiduki kasutamist?

## Tulekahju → Harku (`fire-harku`)

Allikas: scenarios-1.json. Vestlus: `cmul9uv70001edzkmi0yep9o3`.

### 1. [new] Tulekahju hävitas kodu, kas vald aitab rahaga? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 3276 ms, kokku 17627 ms, 0.0035 USD
- Leitud allikad (4): Sotsiaalhoolekande seadus; Arendame koos valmisolekut kriisiolukordadeks; Sotsiaalkiirabi või pigem sotsiaal- ja kriisiabi? Soome kogemus; Eesti inimeste toetamine majandusliku olukorra muutumisel
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK state/region: region null, expected null

> Mul on kahju, et tulekahju kodu hävitas. Kui tulekahju tõttu oled elatusvahenditest ilma jäänud ja sattunud sotsiaalselt abitusse olukorda, peab vältimatu sotsiaalabi tagama vähemalt toidu, riided ja ajutise majutuse. [S1]
>
> Rahalist abi võib anda ka toimetulekutoetusena, kui sinu või su pere rahast ei piisa toimetulekuks ning kuu netosissetulek jääb pärast arvesse võetavate eluasemekulude mahaarvamist alla kehtiva toimetulekupiiri. See sõltub sinu pere sissetulekutest ja arvesse minevatest eluasemekuludest. [S5]
>
> Ma ei saa siinse info põhjal kinnitada, kas sinu vald annab tulekahju järel eraldi rahalist toetust või kas sul on õigus toimetulekutoetusele.
>
> Millise valla abi sa silmas pead ja kas sul on praegu ajutine ööbimiskoht?

### 2. [same] Olen Harkus. — **passed**

- Piirkond harku_vald (olek harku_vald), vastuse liik partial, täpsustus true; otsing 3248 ms, kokku 22614 ms, 0.0051 USD
- Leitud allikad (44): Sotsiaalhoolekandelise abi andmise kord; Sotsiaalhoolekande seadus; Hooldajatoetus; Jõulutoetus; Koolitoetus eestkostel või peres hooldamisel olevale lapsele; Koolitoetus põhikooli või gümnaasiumi lõpetamisel; Koolitoetus peredele, kus õpib vähemalt kaks last; Koolitoetus peredele, kus õpib vähemalt üks laps; Koolitoetus kultuuri- ja spordiüritustel osalemiseks; Küttetoetus; Laagritoetus; Matusetoetus …
- Viidatud: Sotsiaalhoolekandelise abi andmise kord; Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK state/region: region harku_vald, expected harku_vald
- OK state/service_summary: summaries: Jõulutoetus, Koolitoetus kultuuri- ja spordiüritustel osalemiseks, Küttetoetus, Matusetoetus, Toidutoetus vähekindlustatud peredele, Toimetulekutoetus, Ühekordne toetus, Pere tulust mittesõltuva toetuse taotlus, Harku Sotsiaalkeskus, Eluruumi teenus, Häirenuputeenus, Isikliku abistaja teenus, Koduteenus, Toidupank, Turvakoduteenus, Üldhooldusteenus väljaspool kodu, Vaimse tervise nõustamine, Varjupaigateenus, Võlanõustamisteenus

> Jah. Harku vallas saab tulekahju järel taotleda ühekordset toetust, kui tulekahju tõttu oled sattunud raskesse majanduslikku olukorda. Vallavalitsus otsustab toetuse andmise ja suuruse eraldi, seega ei ole toetus automaatne. [S1]
>
> Esita Harku Vallavalitsusele kirjalik taotlus ja lisa taotlust põhjendavad dokumendid. Nõuetekohase taotluse kohta tehakse otsus kümne tööpäeva jooksul. [S2]
>
> Kui tulekahju tõttu oled elatusvahenditeta ja sotsiaalselt abitus olukorras, peab vältimatu sotsiaalabi tagama vähemalt toidu, riided ja ajutise majutuse. [S7]
>
> Kas oled Harku valla elanik ja kas sul on praegu ajutine ööbimiskoht?

## Keeldumine → vaide tähtaeg → tähtaja algus (`appeal-follow-up`)

Allikas: acceptance B9: the deadline and when it starts were not said. Vestlus: `cmul9vqiz001ldzkmf8ld5k9r`.

### 1. [new] Omavalitsus keeldus mulle koduteenust andmast. Mida saan teha, kui ma otsusega ei nõustu? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 4247 ms, kokku 18748 ms, 0.0045 USD
- Leitud allikad (7): Sotsiaalseadustiku üldosa seadus; Koduteenuse korraldamise probleeme kohalikes omavalitsustes; Vana inimene igatseb koju tagasi; Omavalitsuste tegevus erivajadustega inimeste toetamisel; Kuidas vastata inimese pöördumisele; Haldusmenetluse seadus; Kuidas hinnata abivajadust ja pakkuda sotsiaalhoolekandelist abi?
- Viidatud: Vana inimene igatseb koju tagasi; Kuidas hinnata abivajadust ja pakkuda sotsiaalhoolekandelist abi?; Sotsiaalseadustiku üldosa seadus; Kuidas vastata inimese pöördumisele; Haldusmenetluse seadus
- OK answer/completed: completed
- OK state/region: region null, expected null
- OK search/evidence: /Haldusmenetluse seadus/ among 7 found sources
- OK answer/cited: /Haldusmenetluse seadus/ among cited: Vana inimene igatseb koju tagasi, Kuidas hinnata abivajadust ja pakkuda sotsiaalhoolekandelist abi?, Sotsiaalseadustiku üldosa seadus, Kuidas vastata inimese pöördumisele, Haldusmenetluse seadus
- OK answer/must: /vaie|vaide/ in the answer
- OK answer/valid_on: cited for 2026-09-28: Sotsiaalseadustiku üldosa seadus 2026-01-09..2026-09-30; Haldusmenetluse seadus 2024-01-01..2026-12-31

> Kui sul ei ole keeldumise kohta kirjalikku põhjendatud otsust, küsi see omavalitsuselt. Sotsiaalteenuse otsus peab selgitama, miks abi ei anta, ja kuidas saad selle vaidlustada. [S3, S7]
>
> Kui sul on otsus ja sa ei nõustu sellega, saad esitada vaide otsuse teinud asutusele. Vaides saad paluda otsuse tühistamist või asutust tegutsema kohustada. Vaie lahendatakse üldjuhul 30 päeva jooksul pärast esitamist. [S1, S5]
>
> Kui vaie jäetakse rahuldamata või sinu õigusi rikutakse vaide menetlemisel, võid pöörduda halduskohtusse seaduses sätestatud tingimustel ja korras. [S6]
>
> Siin viidatud seadusesäte ütleb, kui kiiresti vaie lahendatakse, kuid ma ei saa selle põhjal kinnitada vaide esitamise tähtaega. Vaata otsusel olevat vaidlustamisviidet ja tegutse esimesel võimalusel.
>
> Kas said keeldumise kohta kirjaliku otsuse või öeldi keeldumine ainult suuliselt?

### 2. [same] Mis tähtaja jooksul pean vaide esitama? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus false; otsing 4589 ms, kokku 15120 ms, 0.0041 USD
- Leitud allikad (2): Haldusmenetluse seadus; Sotsiaalseadustiku üldosa seadus
- Viidatud: Haldusmenetluse seadus; Sotsiaalseadustiku üldosa seadus
- OK answer/completed: completed
- OK search/evidence: /Haldusmenetluse seadus/ among 2 found sources
- OK answer/cited: /Haldusmenetluse seadus/ among cited: Haldusmenetluse seadus, Sotsiaalseadustiku üldosa seadus
- OK answer/must: /30 päeva/ in the answer
- OK answer/valid_on: cited for 2026-09-28: Haldusmenetluse seadus 2024-01-01..2026-12-31; Sotsiaalseadustiku üldosa seadus 2026-01-09..2026-09-30

> Vaie tuleb üldjuhul esitada 30 päeva jooksul päevast, mil said vaidlustatavast otsusest teada või pidid sellest teada saama. Seadus võib ette näha teisiti. [S1]
>
> Sotsiaalkaitse korraldamisel tehtud otsuse vaie esita otsuse teinud haldusorganile, kui seadus ei sätesta teisiti. [S2]
>
> Ma ei saa sinu konkreetset viimast esitamise kuupäeva arvutada, sest sa pole öelnud, millal keeldumisest teada said. Pane see kuupäev paika ja esita vaie esimesel võimalusel.

### 3. [same] Mis päevast see tähtaeg hakkab kulgema? — **passed**

- Piirkond - (olek -), vastuse liik grounded, täpsustus false; otsing 3135 ms, kokku 11871 ms, 0.0036 USD
- Leitud allikad (3): Haldusmenetluse seadus; Sotsiaalseadustiku üldosa seadus; Kuidas vastata inimese pöördumisele
- Viidatud: Haldusmenetluse seadus
- OK answer/completed: completed
- OK answer/cited: /Haldusmenetluse seadus/ among cited: Haldusmenetluse seadus
- OK answer/must: /teada/ in the answer
- OK answer/valid_on: cited for 2026-09-28: Haldusmenetluse seadus 2024-01-01..2026-12-31

> Vaide esitamise 30 päeva hakkavad kulgema päevast, mil said vaidlustatavast otsusest teada või oleksid pidanud sellest teada saama. [S1]

## Hooldekodu omaosalus → numbrid → parandus (`care-home-correction`)

Allikas: acceptance B4/G11: the municipality's share and cap were left out. Vestlus: `cmul9zsng0000likmxtxkvezw`.

### 1. [new] Kui palju pean ise hooldekodu koha eest maksma? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 14867 ms, kokku 29185 ms, 0.0050 USD
- Leitud allikad (2): Sotsiaalhoolekande seadus; Hooldekodude rahastamise põhimõtted muutuvad
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK search/evidence: /Sotsiaalhoolekande seadus/ among 2 found sources
- OK answer/cited: /Sotsiaalhoolekande seadus/ among cited: Sotsiaalhoolekande seadus
- OK answer/must: /hoolduskulu|hoolduse kulu|hooldusteenuse|hooldustöötaja/ in the answer
- OK answer/valid_on: cited for 2026-09-28: Sotsiaalhoolekande seadus 2026-06-12..2026-09-30

> Kui omavalitsus on inimese ööpäevaringse üldhooldusteenuse vajaduse kindlaks teinud, maksab inimene teenuskoha hinnast majutuse ja toitlustuse ning muud teenusega seotud kulud. Omavalitsus rahastab hooldustöötajate ja abihooldustöötajate nimetatud tööga seotud kulusid. [S1]
>
> Kui sinu seaduses arvestatav sissetulek on väiksem kui eelarveaastale eelnenud aasta teise kvartali keskmine vanaduspension, katab omavalitsus osa sinu tasutavatest kuludest. Katmisel on seaduses ülempiir, mis sõltub keskmise vanaduspensioni ja sinu sissetuleku vahest. Teenuseosutaja peab avalikustama teenuskoha hinna ning hooldustöötajate tegelike kulude hinna ühe inimese kohta. [S1]
>
> Ma ei saa sinu makstavat summat nende andmete põhjal välja arvutada: selleks on vaja teada hooldekodu teenuskoha hinda, sinu arvestatavat sissetulekut ja rahvastikuregistrijärgset omavalitsust.
>
> Kui soovid, et aitaksin summat hinnata, mis omavalitsuses on sinu rahvastikuregistrijärgne elukoht, millist hooldekodu ja selle kuutasu kaalud ning kui suur on sinu arvestatav kuusissetulek?

### 2. [same] Hooldekodu maksab 1600 eurot kuus, sellest hoolduskulu on 600 eurot. Minu pension on 500 eurot. — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 5651 ms, kokku 22740 ms, 0.0053 USD
- Leitud allikad (3): Sotsiaalhoolekande seadus; Hooldekodude rahastamise põhimõtted muutuvad; Abivajaja omaosalus sotsiaalteenuse eest tasumisel
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK answer/cited: /Sotsiaalhoolekande seadus/ among cited: Sotsiaalhoolekande seadus
- OK answer/must_not: /kindlasti ainult (sinu |oma )?pension/ not in the answer
- OK answer/valid_on: cited for 2026-09-28: Sotsiaalhoolekande seadus 2026-06-12..2026-09-30

> Kui 600 € on omavalitsuse rahastatav hoolduskulu, jääb 1600 € kuutasust enne võimalikku lisahüvitist 1000 €. Kui sinu seaduses arvestatav sissetulek on keskmisest vanaduspensionist väiksem, peab omavalitsus katma tasutavate kulude ja sissetuleku vahe, kuid mitte rohkem kui keskmise vanaduspensioni ja sissetuleku vahe. Arvestatav sissetulek võib hõlmata ka kogumispensioni, töövõimetoetust ja maksustatavat tulu. [S1]
>
> Küsi arvutust oma rahvastikuregistrijärgselt omavalitsuselt. See omavalitsus rahastab üldhooldusteenust ja saab kehtestada hooldustöötajate kuludele piirmäära. [S1]
>
> Ma ei saa sinu lõplikku omaosalust nende andmete põhjal välja arvutada: siin pole keskmise vanaduspensioni suurust ega sinu rahvastikuregistrijärgset omavalitsust. Samuti ei selgu, kas 600 € on kogu omavalitsuse rahastatav hoolduskulu või kas 500 € pension on sinu ainus arvestatav sissetulek.
>
> Millises omavalitsuses on sinu rahvastikuregistrijärgne elukoht, ja kas 500 € pension on sinu ainus sissetulek?

### 3. [correction] Vabandust, pension on hoopis 700 eurot. — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 16284 ms, kokku 35962 ms, 0.0056 USD
- Leitud allikad (2): Sotsiaalhoolekande seadus; Hooldekodude rahastamise põhimõtted muutuvad
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK answer/must: /700/ in the answer
- OK answer/valid_on: cited for 2026-09-28: Sotsiaalhoolekande seadus 2026-06-12..2026-09-30

> Kui omavalitsus on sinu vajaduse ööpäevaringse üldhooldusteenuse järele välja selgitanud, rahastab sinu rahvastikuregistrijärgne omavalitsus hooldustöötajate ja abihooldustöötajate loetletud kulusid. Omavalitsus võib nende kulude tasumisele seada piirmäära. Sina tasud majutuse, toitlustuse ja muud teenusega seotud kulud. Kui sinu arvestatav sissetulek jääb alla seaduses nimetatud keskmise vanaduspensioni, katab omavalitsus tasutavate kulude ja sissetuleku vahe, kuid hüvitis ei või olla suurem keskmise vanaduspensioni ja sinu sissetuleku vahest. [S1]
>
> Ma ei saa praegu sinu lõplikku omaosalust arvutada: ma ei tea sinu rahvastikuregistrijärgset omavalitsust ega seda, kas sul on pensionile lisaks muud arvestatavat sissetulekut. Samuti ei saa kinnitada, kas nimetatud 600 eurot vastab omavalitsuse kaetavatele kuludele ja selle võimalikule piirmäärale.
>
> Selge, arvestan paranduseks pensioni 700 eurot, mitte 500 eurot. Millise omavalitsuse rahvastikuregistrijärgne elukoht sul on? Kas 700 eurot on sinu ainus arvestatav sissetulek, sealhulgas kogumispension, töövõimetoetus või sotsiaalmaksuga maksustatav tulu?

## Toimetulekutoetus → Tallinn → kolimine Rae valda (`income-support-move`)

Allikas: a change of municipality within one topic. Vestlus: `cmula1owd000alikmera63320`.

### 1. [new] Kuidas saada toimetulekutoetust? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 5302 ms, kokku 22845 ms, 0.0056 USD
- Leitud allikad (1): Sotsiaalhoolekande seadus
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK state/region: region null, expected null
- OK search/evidence: /Sotsiaalhoolekande seadus/ among 1 found sources
- OK answer/valid_on: cited for 2026-09-28: Sotsiaalhoolekande seadus 2026-06-12..2026-09-30

> Toimetulekutoetust võib saada üksi elav inimene või pere, kelle rahast ei piisa toimetulekuks ja kelle kuu netosissetulek jääb pärast arvesse võetavate eluasemekulude mahaarvamist alla kehtestatud toimetulekupiiri. [S2]
>
> 2026. aasta 28. septembri seisuga esita jooksva kuu taotlus hiljemalt kuu viimasel tööpäeval sellele omavalitsusele, mille territooriumil on sinu tegelik elukoht. Tegelik elukoht võib olla rahvastikuregistrisse kantud elukoht, lisa-aadress või viibimiskoht, samuti muu elukoht. Varasemate kuude eest toetust tagasiulatuvalt ei määrata. [S1, S4]
>
> Lisa taotlusele nende inimeste nimed, isikukoodid või sünniajad ja sotsiaalsed seisundid, keda toetuse arvestamisel arvesse võetakse. Lisa dokumendid eelmise kuu netosissetulekute, makstud elatise ja täitemenetluses kinni peetud summade kohta. Kui mõne sissetuleku suurust ei saa dokumendiga tõendada, kinnita see allkirjaga. [S1]
>
> Kui soovid, et arvesse läheksid ka eluasemekulud, lisa eluruumi kasutamise õigust tõendav dokument esmakordsel taotlemisel või selle õigusliku aluse muutumisel ning jooksva kuu eluasemekulusid tõendavad dokumendid. Esmakordsel taotlemisel või vara koosseisu muutumisel lisa ka kirjalik loetelu enda ja pere omandis olevatest vallasasjadest, eluruumidest ja väärtpaberitest. Kui sul või pereliikmel on arveldus-, ettevõtlus- või hoiukonto, esita eelmise ja jooksva kuu sissetulekuid kajastavad kontoväljavõtted. [S1, S5]
>
> Omavalitsus määrab toetuse viie tööpäeva jooksul pärast kõigi dokumentide esitamist. Määratud summa maksab ta välja kolme tööpäeva jooksul otsuse tegemisest. [S4, S6]
>
> Ma ei saa öelda, millise veebilehe või esituskanali kaudu sinu omavalitsus taotlusi vastu võtab, sest sa pole omavalitsust nimetanud. Siin esitatud lõigud ei anna ka kehtiva toimetulekupiiri summat.
>
> Millises omavalitsuses on sinu tegelik elukoht? Siis saan aidata leida, kuhu taotlus esitada.

### 2. [same] Elan Tallinnas. — **passed**

- Piirkond tallinn (olek tallinn), vastuse liik partial, täpsustus false; otsing 5184 ms, kokku 22111 ms, 0.0060 USD
- Leitud allikad (75): Sotsiaalhoolekande seadus; Sotsiaaltoetuste maksmise tingimused ja kord; Eluruumide kohandamise kulude hüvitamine; Hooldajatoetus täisealise inimese hooldajale; Imikupakk; Juhtkoera pidamise toetus; Matusetoetus; Mittetulundustegevuse toetamine sotsiaalhoolekande valdkonnas; Pensionilisa; Puudega lapse hooldajatoetus; Puudega lapse toetus; Sissetulekust sõltuv toetus toimetuleku tagamiseks …
- Viidatud: Sotsiaalhoolekande seadus; Toimetulekutoetus
- OK answer/completed: completed
- OK state/region: region tallinn, expected tallinn
- OK state/service_summary: summaries: Eluruumide kohandamise kulude hüvitamine, Hooldajatoetus täisealise inimese hooldajale, Juhtkoera pidamise toetus, Matusetoetus, Pensionilisa, Puudega lapse hooldajatoetus, Sissetulekust sõltuv toetus toimetuleku tagamiseks, Sünnitoetus Tallinna elanikule, Toimetulekutoetus, Sotsiaalhoolekandelise abi taotluse vorm PDF, Sotsiaalhoolekandelise abi taotluse vorm RTF, Eluruumi tagamise teenus, Järelhooldusteenus, Sotsiaal- ja majutusteenus, Toetatud elamine, Toimetulekunõustamine, Toimetulekuõpe

> Toimetulekutoetust võib saada inimene või pere, kelle kuu netosissetulek jääb pärast arvestatavate eluasemekulude mahaarvamist alla kehtestatud toimetulekupiiri. Tallinna puhul esita jooksva kuu taotlus hiljemalt kuu viimasel tööpäeval selle linnaosa sotsiaalhoolekande osakonnale, mille territooriumil sa tegelikult elad. [S2, S1, S17]
>
> Lisa taotlusele arvesse võetavate inimeste nimed ja isikukoodid või sünniajad ning eelmise kuu netosissetulekuid tõendavad dokumendid. Lisa ka tõendid makstud elatise ja täitemenetluses kinni peetud summade kohta. Kui soovid, et arvestataks eluasemekulusid, lisa eluruumi kasutamise õigust tõendav dokument esmakordsel taotlemisel või selle aluse muutumisel ning jooksva kuu eluasemekulude dokumendid. [S1]
>
> Kui kõik vajalikud dokumendid on esitatud, määratakse toetus viie tööpäeva jooksul. Määratud summa makstakse välja kolme tööpäeva jooksul pärast otsust. [S4]
>
> Tallinna taotluse vastuvõtu täpne kanal ja kohaliku taotlusvormi kehtivus pole siin kinnitatud; kohalikku teenuseinfot kontrolliti viimati 21.05.2026.

### 3. [same] Kolisin just Rae valda. Kuhu pean nüüd pöörduma? — **passed**

- Piirkond rae_vald (olek rae_vald), vastuse liik partial, täpsustus false; otsing 4072 ms, kokku 20618 ms, 0.0064 USD
- Leitud allikad (55): Sotsiaalhoolekande seadus; Sotsiaalteenuste osutamise kord Rae vallas; Asendushooldusteenusel oleva lapse või noore sünnipäeva-, jõulu-, koolilõpu- ja elluastumise toetus; Dokumenditoetus; Eaka tähtpäevatoetus; Suurpere, eestkostepere ja puudega lapse vanema emadepäeva toetus; Erivajadusega inimese küttekulude toetus; Invatehnilise abivahendi toetus; Suurpere, eestkostepere ja puudega lapse vanema jõulutoetus; Matusetoetus; Muu toimetulekut soodustav toetus; Pensionäri prillitoetus …
- Viidatud: Sotsiaalhoolekande seadus; Toimetulekutoetus; Toimetulekutoetuse taotlemise avaldus
- OK answer/completed: completed
- OK state/region: region rae_vald, expected rae_vald
- OK state/service_summary: summaries: Asendushooldusteenusel oleva lapse või noore sünnipäeva-, jõulu-, koolilõpu- ja elluastumise toetus, Dokumenditoetus, Eaka tähtpäevatoetus, Invatehnilise abivahendi toetus, Suurpere, eestkostepere ja puudega lapse vanema jõulutoetus, Matusetoetus, Muu toimetulekut soodustav toetus, Ravikindlustuseta isiku ravikulude toetus, Sünnitoetus, Täisealise isiku hooldajatoetus, Toimetulekutoetus, Kinnipidamisasutusest vabanenud isiku ühekordne toetus, Vältimatu sotsiaalabi toetus, Vanemliku hoolitsuseta jäänud lapse ülalpidamis- ja koolituskulude toetus, Toimetulekutoetuse taotlemise avaldus, Ühekordse sotsiaaltoetuse e-taotlus, Ühekordse toetuse taotluse blankett, Toiduabi, Eluruumi tagamine, Erihoolekandeteenus, Kriisiabi, sh laste leinalaagris osalemine, Tugiisikuteenus, Tugirühmades ja tugiprogrammides osalemine, Vältimatu sotsiaalabi teenus

> Kui sinu tegelik elukoht on Rae vallas, esita toimetulekutoetuse taotlus Rae vallavalitsusele. Rae valla taotlusteave nimetab esitamise viisidena kohale minekut või e-posti. Jooksva kuu toetuse taotlus tuleb esitada hiljemalt kuu viimasel tööpäeval. [S1, S20]
>
> Rae vallal on toimetulekutoetuse taotlusblankett. Taotlusele lisa eelmise kuu netosissetulekut tõendavad dokumendid. Kui soovid, et eluasemekulud arvestataks toetuse hulka, lisa ka eluruumi kasutamise õiguse tõend ja jooksva kuu eluasemekulude dokumendid. [S1, S25]
>
> Rae valla taotlusteave ja blanketi andmed on kontrollitud 29.04.2026, kuid nende praegust kehtivust ei ole kinnitatud. Mul pole siin Rae vallavalitsuse täpset aadressi ega e-posti aadressi.

## Seaduse tekst eri kuupäevadel (`law-on-dates`)

Allikas: legal validity: SHS versions of 2027, RLS in 2027 and the RT gap of 31.10.2026. Vestlus: `cmula348y000klikmpjbk9sjw`.

### 1. [new] Mida ütleb sotsiaalhoolekande seadus koduteenuse kohta 1. märtsil 2027? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus false; otsing 6213 ms, kokku 14912 ms, 0.0041 USD
- Leitud allikad (1): Sotsiaalhoolekande seadus
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK search/evidence: /Sotsiaalhoolekande seadus/ among 1 found sources
- OK answer/cited: /Sotsiaalhoolekande seadus/ among cited: Sotsiaalhoolekande seadus
- OK search/found_valid_on: found legal texts for 2027-03-01: Sotsiaalhoolekande seadus 2027-02-01..2027-03-31
- OK answer/valid_on: cited for 2027-03-01: Sotsiaalhoolekande seadus 2027-02-01..2027-03-31

> 1. märtsil 2027 kehtiva redaktsiooni järgi on koduteenus kohaliku omavalitsuse korraldatav sotsiaalteenus täisealisele inimesele. Selle eesmärk on aidata tal kodus iseseisvalt ja turvaliselt toime tulla ning hoida või parandada elukvaliteeti. Abi võib hõlmata näiteks kütmist, toiduvalmistamist, eluruumi ja riiete korrastamist ning poes käimist või muud asjaajamist, kui inimene ei suuda neid terviseseisundi, tegevusvõime või elukeskkonna tõttu kõrvalabita teha ja need on kodus elamiseks vajalikud. [S1]
>
> Kohalik omavalitsus hindab iga inimese kõrvalabi vajadust eraldi. Teenuse saaja ja teenuseosutajaga koostöös koostatakse teenuse osutamise haldusakt või haldusleping. Selles määratakse muu hulgas kindlaks vajalikud toimingud, et inimene saaks kodus iseseisvalt toime tulla. [S2]
>
> Valdkonna eest vastutav minister võib kehtestada määrusega täpsemaid nõudeid koduteenuse eesmärgi ja sisu kohta, sealhulgas teenuse eesmärgi saavutamiseks vajalike tegevuste kohta. [S1]
>
> Saan selle teabe põhjal kirjeldada koduteenuse kohta §-des 17–18 toodut; muid võimalikke koduteenuse sätteid siin esitatud tekst ei kata.

### 2. [same] Aga praegu kehtiva seaduse järgi? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus false; otsing 8320 ms, kokku 25741 ms, 0.0047 USD
- Leitud allikad (1): Sotsiaalhoolekande seadus
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK answer/cited: /Sotsiaalhoolekande seadus/ among cited: Sotsiaalhoolekande seadus
- OK search/found_valid_on: found legal texts for 2026-09-28: Sotsiaalhoolekande seadus 2026-06-12..2026-09-30
- OK answer/valid_on: cited for 2026-09-28: Sotsiaalhoolekande seadus 2026-06-12..2026-09-30

> Praegu, 28. septembril 2026, kehtiva seaduseteksti järgi on koduteenus kohaliku omavalitsuse korraldatav sotsiaalteenus täisealisele inimesele. Selle eesmärk on toetada iseseisvat ja turvalist toimetulekut kodus ning hoida või parandada elukvaliteeti. Abi võib olla vajalik näiteks kütmisel, toiduvalmistamisel, eluruumi ja riiete korrastamisel ning ostude või asjaajamise juures, kui inimene ei saa terviseseisundi, tegevusvõime või elukeskkonna tõttu neid toiminguid kõrvalabita teha ja need on kodus elamiseks vajalikud. [S1]
>
> Kohalik omavalitsus hindab inimese kõrvalabi vajadust eraldi. Kui vajadus teenuse ajal tegevusvõime või elukeskkonna tõttu muutub, tuleb seda uuesti hinnata. Omavalitsus koostab teenuse saaja ja teenuseosutajaga haldusakti või halduslepingu, milles määratakse muu hulgas kindlaks kodus toimetulekuks vajalikud toimingud. [S2]
>
> Saan nende andmete põhjal vastata praegu kehtiva redaktsiooni kohta, kuid mitte kinnitada, milline seaduse redaktsioon kehtib 1. märtsil 2027.

### 3. [new] Kui suur on riigilõiv isikutunnistuse (ID-kaardi) väljaandmise eest 2027. aasta jaanuaris? — **passed**

- Piirkond - (olek -), vastuse liik grounded, täpsustus false; otsing 21335 ms, kokku 33386 ms, 0.0035 USD
- Leitud allikad (1): Riigilõivuseadus
- Viidatud: Riigilõivuseadus
- OK answer/completed: completed
- OK search/evidence: /Riigilõivuseadus/ among 1 found sources
- OK answer/cited: /Riigilõivuseadus/ among cited: Riigilõivuseadus
- OK search/found_valid_on: found legal texts for 2027-01-15: Riigilõivuseadus 2027-01-01..2027-06-30
- OK answer/valid_on: cited for 2027-01-15: Riigilõivuseadus 2027-01-01..2027-06-30

> 2027. aasta jaanuaris on ID-kaardi taotluse läbivaatamise riigilõiv tavaliselt 45 eurot. Politsei- ja Piirivalveameti iseteeninduses taotledes on see 35 eurot. Alla 18-aastasele, keskmise, raske või sügava puudega inimesele ning üldtingimustel Eesti vanaduspensioniikka jõudnud inimesele on lõiv 20 eurot või iseteeninduses 15 eurot. Välisesinduses taotledes on tavapärane lõiv 75 eurot. [S1]

### 4. [same] Ja kui taotlen selle 31. oktoobril 2026? — **passed**

_Riigi Teataja has no RLS text for 31.10.2026: the answer says it cannot confirm the fee that day (an honest limit), whichever version it shows beside it._

- Piirkond - (olek -), vastuse liik unsupported, täpsustus false; otsing 4138 ms, kokku 12594 ms, 0.0034 USD
- Leitud allikad (0): -
- Viidatud: -
- OK answer/completed: completed
- OK answer/must: /kinnitada ei saa|ei saa[^.]{0,60}kinnita|puudub|ei ole[^.]{0,40}(tekst|redaktsioon)/ in the answer

> Ma ei saa siin kinnitada, kui suur oleks ID-kaardi taotlemise riigilõiv 31. oktoobril 2026. Ka eelmises vastuses nimetatud tasusid ei saa selle teabe põhjal kinnitada.

## Ebamäärane küsimus → asjaolud (`vague-then-details`)

Allikas: a missing circumstance. Vestlus: `cmula4zm8000xlikmz5ziwokq`.

### 1. [new] Kas mulle on mingi toetus ette nähtud? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 6212 ms, kokku 17150 ms, 0.0043 USD
- Leitud allikad (3): Sotsiaalhoolekande seadus; Kas sotsiaalabi on (turva)võrk või hüppelaud? Kuidas aidata inimesed kiiresti taas jalule; Toimetulekutoetuse kui riikliku sotsiaalabi korraldus
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK state/region: region null, expected null
- OK answer/clarification: asks for a circumstance: true

> Üks võimalik riiklik abi on toimetulekutoetus. Selle saamise õigus võib olla siis, kui sinu või sinu pere rahast ei piisa ning netosissetulek pärast arvesse võetavate eluasemekulude mahaarvamist jääb alla kehtestatud toimetulekupiiri. Toetuse saamise otsustab sinu elukohajärgne omavalitsus. [S1, S2, S3]
>
> Toimetulekutoetust taotledes hindab omavalitsus ka seda, kas sina või su pereliikmed vajate muud sotsiaalabi. [S2]
>
> Ma ei saa praegu öelda, kas sul on õigus toetusele: see sõltub sinu leibkonnast, sissetulekust ja eluasemekuludest. Sinu kohaliku omavalitsuse muid toetusi ma siit hinnata ei saa.
>
> Mis olukorras sa toetust vajad ja millises vallas või linnas sa elad? Kui küsimus puudutab toimetulekutoetust, kirjuta võimalusel ka, mitmekesi te koos elate ning millised on leibkonna igakuised sissetulekud ja eluasemekulud.

### 2. [same] Olen 67-aastane, elan üksi Viimsi vallas ja pension on 600 eurot kuus. — **answer**

- Piirkond viimsi_vald (olek -), vastuse liik -, täpsustus false; otsing 6337 ms, kokku - ms, 0.0072 USD
- Leitud allikad (46): Sotsiaalhoolekande seadus; Ühekordne toetus eakatele; I klassi mineva lapse toetus; Lasteaia ja lastehoiu kohatasu toetus; Matusetoetus; Puudega isiku tasuta sõidu õigus; Puudega isiku transporditoetus; Ravimitoetus; Riiklik toimetulekutoetus; Sünnitoetus; Suurpere toetus; Tähtpäevatoetus eakatele …
- Viidatud: -
- **VIGA** answer/completed: provider_incomplete
- OK state/region: region viimsi_vald, expected viimsi_vald

> (vastust pole: provider_incomplete)

## Laps üksi kodus → Tartu linn (`child-alone-report`)

Allikas: LasteKS: reporting a child in need. Vestlus: `cmula64ux0012likmrzo71poh`.

### 1. [new] Naabri väike laps on tihti öösiti üksi kodus ja nutab. Mida ma peaksin tegema? — **passed**

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 4486 ms, kokku 12212 ms, 0.0038 USD
- Leitud allikad (3): Lastekaitseseadus; Juhend: abivajavast lapsest teatamine ja andmekaitse; Lapse heaolu hindamise käsiraamat
- Viidatud: Lastekaitseseadus; Juhend: abivajavast lapsest teatamine ja andmekaitse; Lapse heaolu hindamise käsiraamat
- OK answer/completed: completed
- OK search/evidence: /Lastekaitseseadus/ among 3 found sources
- OK answer/cited: /Lastekaitseseadus/ among cited: Lastekaitseseadus, Juhend: abivajavast lapsest teatamine ja andmekaitse, Lapse heaolu hindamise käsiraamat
- OK answer/must: /teata|teavita/ in the answer
- OK answer/valid_on: cited for 2026-09-28: Lastekaitseseadus 2025-01-10..2026-09-30

> Kui laps on praegu ohus või sul on põhjust arvata, et ta pole turvaliselt kaitstud, teata sellest kohe hädaabinumbril 112. [S2, S3]
>
> Kui vahetut ohtu ei paista, teata oma tähelepanekust viivitamata kohaliku omavalitsuse lastekaitsetöötajale või lasteabitelefonil 116 111. Kahtluse korral võid nõu küsida lasteabitelefonilt. Teatamisel võid jääda anonüümseks. Kirjelda, mida oled ise märganud ja millal; ütle ka, kas tead, kus laps praegu viibib. [S1, S3, S5, S7]
>
> Sinu kirjelduse põhjal ei saa ma hinnata, kas laps on praegu vahetus ohus.
>
> Kas laps on praegu üksi ja sinu hinnangul vahetus ohus?

### 2. [same] Me elame Tartu linnas. — **passed**

- Piirkond tartu_linn (olek -), vastuse liik partial, täpsustus true; otsing 3835 ms, kokku 15170 ms, 0.0051 USD
- Leitud allikad (52): Lastekaitseseadus; Juhend: abivajavast lapsest teatamine ja andmekaitse; Lapse heaolu hindamise käsiraamat; Eluruumi kohandamise toetus; Erakorraline tervisetoetus; Erakorraline toetus; Hooldajatoetus täisealise isiku hooldamise eest; Hooldajatoetus puudega lapse hooldajale; Lasteaia osalustasu ja toidukulu toetus; Matusetoetus; Tartu linna täiendav sünnitoetus; Toimetulekutoetus …
- Viidatud: Lastekaitseseadus; Juhend: abivajavast lapsest teatamine ja andmekaitse
- OK answer/completed: completed
- OK state/region: region tartu_linn, expected tartu_linn

> Kui naabrilaps on praegu olukorras, mis ohustab tema elu või tervist, teata sellest kohe hädaabinumbril 112. [S2, S3]
>
> Kui laps vajab abi, kuid vahetut ohtu ei paista, teata sellest viivitamata kohaliku omavalitsuse lastekaitsetöötajale või lasteabitelefonil 116 111. [S1, S3]
>
> Kas laps on praegu üksi ja kas miski viitab sellele, et tema elu või tervis on vahetus ohus?

## Tartu vald, mitte Tartu linn (`tartu-parish-not-city`)

Allikas: acceptance G8: the parish/city distinction. Vestlus: `cmula6q9i0019likmyr718ud4`.

### 1. [new] Elan Tartu vallas, mitte Tartu linnas. Kuhu pöörduda sotsiaaltranspordi saamiseks? — **passed**

- Piirkond tartu_vald (olek tartu_vald), vastuse liik partial, täpsustus false; otsing 3310 ms, kokku 12436 ms, 0.0051 USD
- Leitud allikad (44): Kes aitab ja kuhu pöörduda, kui sul on tuvastatud puude raskusaste?; Õigus saada sotsiaalteenuseid võrdsetel alustel; Sotsiaalhoolekande seadus; Erakorraliste kulude hüvitamine; Hapniku tootmiseks vajaliku elektri kompenseerimine; Koolisõidutoetus; Koolitoetus; Kriisiabi; Küttetoetus; Lapse toiduraha katmise toetus; Lasteaia kohatasu vahe hüvitamise toetus; Lastega perede toetus …
- Viidatud: Sotsiaaltransporditeenus; Sotsiaaltranspordi teenuse avaldus
- OK answer/completed: completed
- OK state/region: region tartu_vald, expected tartu_vald
- OK state/service_summary: summaries: Erakorraliste kulude hüvitamine, Koolisõidutoetus, Raske majandusliku olukorra toetus, Toimetulekutoetus, Sotsiaaltoetuse ja -teenuse avaldus, Sotsiaaltranspordi teenuse avaldus, Erivajadusega lapse info, Noorte tugiteenused, Sotsiaalteenuste Keskus, SPOKU Tartu valla iseteenindus, Eluruumi tagamine, Hooldusteenus väljaspool kodu, Koduteenus, Sotsiaalkiirabi, Sotsiaaltransporditeenus, Turvakoduteenus, Vaimse tervise teenus, Vältimatu sotsiaalabi teenus, Varjupaigateenus, Võlanõustamisteenus

> Pöördu Tartu Vallavalitsuse sotsiaalosakonda. Sotsiaaltranspordi taotlemiseks täida sotsiaaltranspordi teenuse avaldus ja saada see e-postiga või vii sotsiaalosakonda. Teenus on mõeldud Tartu valla puudega elanikele, kelle puue takistab isikliku või ühistranspordi kasutamist, näiteks tööle, õppeasutusse või avalikke teenuseid kasutama sõitmiseks. [S37, S21]
>
> Mul ei ole siin täpset e-posti aadressi ega telefoninumbrit. Kogutud teenuseinfo kontrolliti 30.04.2026, seega ei saa ma kinnitada, kas teenus ja taotlemise kontaktid on praegu samad.

## Ema Raasikul → uus isik: tädi Sauel, „vajab sama“ (`new-person-same-need`)

Allikas: acceptance E1.2/E3.2. Vestlus: `cmula6zzz001dlikmgoficwfd`.

### 1. [new] Mu ema vajab kodus abi igapäevaste toimingutega. Ta elab Raasiku vallas. — **passed**

- Piirkond raasiku_vald (olek raasiku_vald), vastuse liik partial, täpsustus false; otsing 4365 ms, kokku 21435 ms, 0.0055 USD
- Leitud allikad (41): Raasiku valla sotsiaalhoolekandelise abi osutamise kord; Sotsiaalhoolekande seadus; Eluruumi kohandamise toetus; Erakorraline toetus; Esimesse klassi mineva lapse toetus; Hooldusperetoetus; Lastega perede toetus; Matusetoetus; Suurenenud hooldus- ja abivajadusega lapse hooldajatoetus; Sünnitoetus; Tähtpäevatoetus; Täisealise isiku hooldajatoetus …
- Viidatud: Raasiku valla sotsiaalhoolekandelise abi osutamise kord; Koduteenus; Sotsiaalteenuse taotlemise avaldus
- OK answer/completed: completed
- OK state/region: region raasiku_vald, expected raasiku_vald
- OK state/service_summary: summaries: Eluruumi kohandamise toetus, Erakorraline toetus, Hooldusperetoetus, Lastega perede toetus, Matusetoetus, Suurenenud hooldus- ja abivajadusega lapse hooldajatoetus, Täisealise isiku hooldajatoetus, Tervisetoetus, Toimetulekutoetus, Sotsiaalteenuse taotlemise avaldus, Abi- ja infotelefonid, Erivajadusega laps, Hädaohus ja abivajav laps, Muud abivõimalused ja tugiliinid, Ohvriabi info, Perekeskus Männikäbi, Eluruumi tagamise teenus, Isikliku abistaja teenus, Järelhooldusteenus, Koduteenus, Lapsehoiuteenus suure hooldus- ja abivajadusega lapsele, Väljaspool kodu osutatav päevahoiuteenus täisealisele, Sotsiaaltransporditeenus, Täisealise isiku hooldus, Tugiisikuteenus, Turvakoduteenus, Väljaspool kodu osutatav ööpäevaringne üldhooldusteenus, Vaimse tervise teenus, Vältimatu sotsiaalabi

> Raasiku valla koduteenus võib sobida, kui su ema on täisealine ja vajab kodus iseseisvaks toimetulekuks kõrvalabi. Teenus võib hõlmata näiteks ostude ja ravimite koju toomist, asjaajamises abistamist ning enesehooldustoimingutes füüsilist abi. [S1, S33]
>
> Järgmise sammuna esita vallavalitsusele sotsiaalteenuse taotlus. Ema võib taotleda teenust ise või saad sina seda teha tema volitatud esindajana. Avalduse vormi saab esitada vallamajas paberkandjal või digiallkirjastatult e-postiga. Kirjelda, millistes igapäevatoimingutes ema abi vajab. Vallavalitsus hindab vajaduse eraldi ning võib vajadusel teha kodukülastuse. Pärast abivajaduse tuvastamist tehakse otsus hiljemalt 10 tööpäeva jooksul nõuetekohase taotluse esitamisest või viimase vajaliku dokumendi saamisest; otsuseks peab ema olema andnud nõusoleku teenuse saamiseks. [S2, S3, S4, S19]
>
> Raasiku valla kord kehtib inimesele, kelle rahvastikuregistrijärgne elukoht on Raasiku vald. Koduteenus on osaliselt tasuline, kuid omaosalust saab juhtumipõhiselt vähendada. [S5, S1]
>
> Ma ei saa siin kinnitada, kas teenus on praegu kättesaadav ega ette öelda, millise otsuse abivajaduse hindamine su ema puhul annab.

### 2. [new_person] Minu tädi elab Saue vallas ja vajab sama. — **passed**

_A new person starts without the mother's circumstances; asking what 'sama' means is acceptable._

- Piirkond saue_vald (olek saue_vald), vastuse liik partial, täpsustus true; otsing 3451 ms, kokku 11598 ms, 0.0049 USD
- Leitud allikad (46): Saue valla sotsiaalhoolekandelise abi andmise kord; Sotsiaalhoolekande seadus; Eestkostetava toetus; Erakorraline ühekordne toetus; Esmakordselt koolimineva lapse toetus; Hooldajatoetus; Hoolduspere lapse ja hoolduspere täiendavad toetused; Hoolduspere toetus; Hoolekandeasutuse teenuse toetus; Koduse lapse toetus; Koolitranspordi toetus puudega lapsele; Lapse ühekordne vajaduspõhine toetus …
- Viidatud: Saue valla sotsiaalhoolekandelise abi andmise kord
- OK answer/completed: completed
- OK state/region: region saue_vald, expected saue_vald
- OK state/previous_state_cleared: previous person's state

> Kui su tädi vajab Saue vallas sotsiaalabi, hinnatakse tema olukorda ja selle põhjal selgitatakse välja sobiv abi. Ta võib ise taotluse esitada või võib seda tema nõusolekul teha pereliige. [S1, S3]
>
> Mida sa mõtled „sama“ all — millist abi su tädi vajab?

## Kuuldeaparaat ja riigi osalus (`hearing-aid-cap`)

Allikas: acceptance C9: the 95% share without the price cap. Vestlus: `cmula7ps9001klikm5x34spho`.

### 1. [new] Ema kuulmine halveneb ja pensionist ei jätku kuuldeaparaadi ostmiseks. Kust alustada? — **answer**

_The device table with the price caps is an annex of the regulation that the XML text does not carry; the aids guide (teatmik) gives the cap._

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 4550 ms, kokku 24820 ms, 0.0053 USD
- Leitud allikad (3): Abivahendite teatmik 2025; Abivahendite loetelu, tasu maksmise kohustuse ülevõtmise tingimused ning abivahendi tõendi ja kaardi andmed; Sotsiaalhoolekande seadus
- Viidatud: Abivahendite teatmik 2025
- OK answer/completed: completed
- OK search/evidence: /Abivahendi/ among 3 found sources
- OK answer/cited: /Abivahendi/ among cited: Abivahendite teatmik 2025
- **VIGA** answer/must: /piirhin/ in the answer

> Alusta sellest, et ema laseb kuulmist hinnata audioloogil või nina-kõrva-kurguarstil. Kuuldeabivahendi vajaduse hindamisel arvestatakse muu hulgas kuulmislanguse ulatust. Kui kuulmislangus on vähemalt 30 dB, saab kuulmisabivahendi puhul rakendada riigi osalust abivahendite loetelus määratud määra järgi. [S1, S2]
>
> Kui omaosalus jääb talle liiga suureks, võib ta taotleda Sotsiaalkindlustusametilt omaosaluse vähendamise erandit. Üks võimalik alus on see, kui pärast abivahendi ostu ja muude vältimatute tervisekulude arvestamist jääks talle kätte alla toimetulekupiiri. Taotlus tuleb esitada enne ostu. Vaja on abivahendi vajaduse tõendit ja kahe eri ettevõtte hinnapakkumisi; kui sobivat abivahendit pakub ainult üks ettevõte, tuleb see taotluses märkida. Taotluse saab esitada SKAIS2 iseteeninduses või e-postiga aadressil info@sotsiaalkindlustusamet.ee. [S4, S5, S6]
>
> Ma ei saa nende andmete põhjal öelda, kui suur oleks ema omaosalus või kas tema taotlus vastaks erandi tingimustele.
>
> Ema omavalitsuse võimalikku kohalikku tuge ei saa täpsustada, sest elukoha omavalitsus pole teada.
>
> Mis vallas või linnas ema elab? Siis saan vaadata, kas tema omavalitsuse kohta on asjakohast infot.

## Täna öösel pole kuskil magada (`shelter-tonight`)

Allikas: acceptance C7: a first step before the clarification. Vestlus: `cmula891y001olikmjk210gqy`.

### 1. [new] Mul pole täna öösel kusagil magada ega raha toidu ostmiseks. Kust saan kohe abi? — **passed**

_The first step (the local government of residence) should come before any clarifying question._

- Piirkond - (olek -), vastuse liik partial, täpsustus true; otsing 5268 ms, kokku 19346 ms, 0.0042 USD
- Leitud allikad (3): Sotsiaalhoolekande seadus; Vaesus Eestis; Kuidas hinnata abivajadust ja pakkuda sotsiaalhoolekandelist abi?
- Viidatud: Sotsiaalhoolekande seadus
- OK answer/completed: completed
- OK answer/must: /omavalitsus|vald|linn/ in the answer

> Kui sul puuduvad elatusvahendid ja oled seetõttu sattunud sotsiaalselt abitusse olukorda, tuleb sulle osutada vältimatut sotsiaalabi. See peab tagama vähemalt toidu, riietuse ja ajutise majutuse ning kestma seni, kuni sa enam selles olukorras ei ole. [S1]
>
> Kui oled täisealine ega suuda endale ööbimiskohta leida, on varjupaigateenuse eesmärk pakkuda ajutist ööbimiskohta. Selle teenuse korraldab omavalitsus, kus sa abi vajaduse tekkimise ajal viibid. [S2, S3]
>
> Võta kohe ühendust selle omavalitsusega, kus sa praegu viibid. Ütle, et sul pole täna ööseks ööbimiskohta ega raha toidu ostmiseks, ja küsi vältimatut sotsiaalabi ning ajutist ööbimiskohta. [S1, S3]
>
> Ma ei saa praegu anda sinu asukoha omavalitsuse täpset kontakti, sest sa pole öelnud, kus viibid.
>
> Mis linnas või vallas sa praegu viibid?

### 2. [same] Olen Narvas. — **passed**

- Piirkond narva_linn (olek -), vastuse liik partial, täpsustus false; otsing 3941 ms, kokku 21281 ms, 0.0058 USD
- Leitud allikad (51): Sotsiaalhoolekande seadus; Narva sotsiaaltöös keskendutakse teenuste kvaliteedile ja koostööle; Narva linna Sotsiaalabiameti põhimäärus; Elluastumistoetus; Eluruumi kohandamise toetus; Erakorraline toetus; Esmakordselt kooli mineva lapse toetus; Haridusliku erivajadusega õpilase transporditoetus; Hooldajatoetus; Jõulupakitoetus; Koolimineku toetus; Koolitoetus ehk esimesse klassi mineva lapse toetus …
- Viidatud: Sotsiaalhoolekande seadus; Varjupaigateenus
- OK answer/completed: completed
- OK state/region: region narva_linn, expected narva_linn

> Kui elatusvahendite puudumise tõttu oled sattunud sotsiaalselt abitusse olukorda, tuleb sulle osutada vältimatut sotsiaalabi. See peab tagama vähemalt toidu ja ajutise majutuse. [S1]
>
> Kui oled täisealine ja Narva linna elanik ning sul pole võimalik ise ööbimiskohta leida, pakub Narva varjupaigateenus ajutist ööbimist. Pöördu kohe Narva Sotsiaalabiameti või Narva Sotsiaaltöökeskuse poole ja ütle, et sul pole täna ööseks kohta ega raha toidu ostmiseks. Varjupaigateenuse sotsiaalmaja asub aadressil Karja 6a. [S51]
>
> Sa pole öelnud, kas oled täisealine või Narva linna elanik, seega ei saa ma kinnitada, kas varjupaigateenus sulle kehtib.
>
> Ma ei saa kinnitada, kas teenus on praegu kohapeal saadaval; selle kirjeldus koguti 29. aprillil 2026.
