# ADR-094 — Püsiv vestlusajalugu vestluse enda sõnumites

06.10.2026. Teostus Claude Opus 5.5. Omanik 06.10: „mul on plaanis platvormile tuua tuhandeid kasutajaid, mul ei tohi paisuda kõvaketta kasutus meeletuks. Peab arvestama, kuidas toimub vestlus, selle talletamine, ajalugu jms.“ Küsimusele, kas alustada püsiva vestlusajaloo ehitamist kehtiva 90 päeva reegli piires, vastas omanik: **„Jah, kogu töö“**: küsimus, vastus ja lühiviited lähevad vestluse sõnumitesse (seni olid seal kohatäited); ajalugu ja jätkuvestlus loevad sealt ega sõltu plaanist; audit aegub ja kustub; vestlus allub 90 päeva reeglile.

See dokument kirjeldab kogu töö viit sammu. **Tehtud on esimene, teine ja kolmas samm.**

## Probleem

Vestlus elas ainult pöörde auditikirjes (`M4PilotTurn`). Vestluse enda sõnumites (`ConversationMessage`) olid teadlikult kohatäited ([ADR-006](adr-006-private-http-pilot.md), 06.09). Sellest tulid kolm asja, mis tuhandete kasutajatega ei sobi:

1. **Auditit ei saa kustutada.** Kui rida kustub, kaob ka vestlus. Seepärast ei aegu praegu miski: plaani `expiresAt` ja `retentionHours` on tühjad ja kõhn rida ([ADR-093](adr-093-lean-turn-record.md), 17,4 KB kettal) jääb alles.
2. **Plaani vahetus peidab vestluse.** Ajalugu ja dialoogi kontekst loevad ainult töötava plaani ridu (`configHash`). Plaan vahetub iga korpuse täiendusega ja iga muudatusega, mis vajab uut plaani.
3. **Üldised rajad näevad kohatäiteid.** Vestluste nimekirja eelvaade, otsing, vastuse eksport failiks ja kasutaja andmete väljavõte loevad sõnumi teksti; pöörde kohta oli seal „[Kaitstud M4 sisepiloodi vastus]“.

## Otsus

**Vestluse püsiv kirje on vestluse enda sõnumid.** Pöörde avaldamisel kirjutatakse samas tehingus:

- kasutaja sõnumisse küsimus;
- assistendi sõnumisse vastus tekstina (nii nagu vestlus seda näitab, viitemärkidega) ja sõnumi metaandmetesse ajalookirje `rag-v2/history-1`.

Auditikirje on tõend seni, kuni ta on olemas. Ajalookirje ei sõltu plaanist, korpuse versioonist ega auditikirjest.

### Mida ajalookirje hoiab

| Osa | Sisu | Keskmiselt (tekstina) |
|---|---|---|
| Vastus | plokid oma viidetega, piirangud, täpsustav küsimus | 1,2 KB |
| Viidatud allikad | ainult need, millele vastus viitab: pealkiri, autorid, aasta, leheküljed, koht allikas, kontrollimise kuupäev, versioon; lisaks dokumendi ja lõigu tunnus ning lõigu teksti räsi | 2,5 KB |
| Vormid | pealkiri, link, vorming | alla 0,1 KB |
| Dialoog | pöörde koht teemas, vestluse olek, fookuses olnud kirjed, mille ja kelle kohta küsiti | 1,3 KB |
| Muu | pöörde tunnus, keel, vastuse versioon, avalik kontekst | 0,3 KB |

**Allika teksti kirjes ei ole.** Allikas elab korpuses ühe korra; kirje hoiab tunnuseid, millega sama lõik uuesti üles leida.

Kirjes ei ole ka: viitamata tõendus, mudelile saadetud kontekst, päringu vektor, otsingu audit, kulu. Need on audit.

### Lugemine

`conversationTurns` (`lib/rag-v2/pilot/history.js`) annab vestluse pöörded:

- pööre, mille rida töötav plaan loeb, tuleb **reast**, viited korpuse vastu kontrollitud nagu enne;
- pööre, mille rida on kustunud või kuulub teisele plaanile, tuleb **kirjest**, sellisena nagu ta siis vastati; uuesti ei tõestata;
- lõpetatud pööre, mille rida enam ei taastu (allikas muutus, ligipääs võeti ära), tuleb samuti kirjest. Kirjeta pöördel jääb viga püsti nagu enne.

Kirjeid loetakse alles pärast seda, kui vestluse omanik on kontrollitud (`store.conversation`).

### Allikavaade

Kirjest näidatud pöörde allikas avaneb nii:

- kui töötav plaan hoiab sama dokumendiversiooni ja korpuses on sama lõik (teksti räsi klapib), näidatakse lõigu teksti nagu ikka;
- muidu teksti ei näidata. Leht ütleb: „Allikas on pärast seda vastust uuenenud. Vastuse koostamise aegset teksti enam ei näidata; ülal on link allika praegusele versioonile.“ Kui dokumenti plaanis enam ei ole või tal ei ole aadressi, siis linki ei ole ja leht ütleb: „Seda allikat ei saa enam avada: see on pärast vastust uuenenud või eemaldatud. Vastuse koostamise aegset teksti ei näidata.“ Nii ei esitata allika praegust versiooni tõendina, et sama tekst kehtis vastuse koostamisel.

Kontaktikirje ligipääsu kontrollitakse nagu iga viite puhul.

### Mis veel muutus

- **Avaldatud pööre märgib vestluse aktiivseks** (`lastActivityAt`). Seni ei muutunud see RAG v2 vestlustel kunagi; säilitusaeg ja nimekirja järjekord käivad selle järgi.
- **Vastuse sõnum on dateeritud millisekund pärast küsimust.** Mõlemad kirjutatakse ühes tehingus; aja järgi lugejad (nimekirja eelvaade, väljavõte) saavad nii kindla järjekorra.
- **Valideeritud vastust ei hoita kirje pärast kinni.** Kui kirjet ei õnnestu koostada, avaldatakse pööre nagu enne, kohatäidetega, ja viga logitakse (`[rag-v2] history record not made`).

### ADR-006 kohatäidete reegel on tagasi võetud

ADR-006 põhjendus oli, et üldisi ekspordi- ja jagamisradu ei peaks piloodi arenduskorpusele avama. Kontrollisin 06.10 kõik kohad, mis `ConversationMessage` sisu loevad: sõnumite päring, vestluste nimekiri, vana vestlusraja ajalugu, vastuse eksport failiks, andmete väljavõte, otsing, arendaja diagnostika (ainult administraator). **Kõik on piiratud vestluse omanikuga.** Teisele kasutajale ükski neist sõnumit ei anna. Omanik näeb oma vastust vestluses niikuinii.

## Mõõdetud (ainult lugedes, 06.10.2026, serveris)

82 lõpetatud päris pöördel koostati kirje mälus (`hs/hs-sim.mjs`, päris ridu ei muudetud; kettamaht mõõdetud ajutises tabelis, mis tehingu lõpus kustub).

| | Keskmine | Mediaan | 90% | Suurim |
|---|---|---|---|---|
| Kaks sõnumit kettal (tekst ja metaandmed) | 4,7 KB | 4,8 KB | 6,3 KB | 6,9 KB |
| Ajalookirje tekstina | 5,5 KB | 5,5 KB | 7,7 KB | 10,5 KB |
| Küsimus ja vastus tekstina | 1,2 KB | 1,0 KB | 2,0 KB | 3,2 KB |

Võrdluseks samad pöörded: terve rida 184,8 KB kettal, kõhn rida 17,4 KB.

**Kõigil 82 pöördel näitab vestlus kirjest sama, mis reast:** vastuse tekst, viidatud allikad oma pealkirjade ja aadressidega, vormid, kontekst. Sama on ka see, mida järgmine pööre võtab: fookuses kirjed, küsitud omavalitsus ja isik, vestluse olek. Kõigil viidatud allikatel on dokumendi ja lõigu tunnus ning räsi.

**Varasem hinnang oli väiksem.** ADR-093 mõõtis „ainult vestluse“ suuruseks 2,6 KB. Päris kirje on 4,7 KB, sest ta hoiab ka seda, mida jätkuvestlus vajab (dialoogi osa, 1,3 KB tekstina), allika koha ja tunnused ning vastust kaks korda (tekstina otsingu ja ekspordi jaoks, plokkidena vestluse jaoks).

### Arvutus

30 000 pööret päevas (3000 aktiivset kasutajat × 10 pööret; koormusstsenaarium, mitte prognoos):

| Vorm | Päevas | 90 päeva |
|---|---|---|
| Terve rida | 5,5 GB | 499 GB |
| Kõhn rida | 0,52 GB | 47 GB |
| Ainult ajalookirje (see otsus, pärast sammu 3) | 0,14 GB | 12,7 GB |

90 päeva veerg eeldab, et iga vestlus elab täpselt 90 päeva. Vestlus, mida kasutatakse edasi, ei aegu ja tema sõnumid kogunevad: reegel loeb aega viimasest aktiivsusest. Tabeli ja indeksite lisakulu ei ole sees; ajutises mõõtetabelis oli see kokku 6,4 KB pöörde kohta, kuid nii väikeses tabelis on lehtede ümardus suur.

**Selle sammuga kettakulu veel ei vähene:** kirje lisandub reale (4,7 KB juurde). Maht väheneb sammuga 3, kui auditirida aegub.

## Kontroll

- Ühiktestid: `tests/rag-v2-history.test.mjs` (7 testi): kirje kuju ja suurus Tallinna-suuruse paketiga (alla 6 KB, pakett üle 500 KB); vestlus näitab pööret kirjest nagu reast; pöörded ridadest ja kirjetest (teise plaani pööre, taastumatu rida, kirjeta viga, üks pööre); allikavaade; pood kirjutab sõnumid ja märgib vestluse aktiivseks; kirjeta avaldamine; korpuse päring päris kimbuga (sama versioon ja räsi annab teksti; teine versioon, teine räsi, puuduv lõik või plaanist puuduv dokument ei anna).
- Kogu ühiktestide komplekt: 741 testi, 722 läbis, 19 vahele jäetud, 0 ebaõnnestus.
- Andmebaasitestid kohalikus eraldatud testandmebaasis: `rag-v2-pilot-store` 43/43 (kaks uut: ajalugu püsib üle plaani vahetuse ja auditiridade kustumise; taastumatu rida näidatakse kirjest), `rag-v2-dialogue-store` 28/28.
- Serveris 82 päris pöördel (ülal), ainult lugedes.

**Kontrollimata:**

- Päris pööre päris lehel, mis kirje kirjutab (tasuline mudelikutse; luba ei ole küsitud).
- Kirjest näidatud vestlus ja uuenenud allika teade brauseris. Päris lehel tekib see olukord alles pärast uut pööret ja plaani vahetust.
- 12 ühendtesti (stsenaariumid, ühendotsing, kirjed) siin arvutis ei käi: 6 vajavad EstNLTK-d, 6 lisaks kohalikku sisendfaili.

## Sammud

| | Samm | Seis |
|---|---|---|
| 1 | Ajalookirje kirjutamine avaldamisel; ajalugu ja allikavaade loevad seda, kui rida ei saa lugeda | tehtud (#410) |
| 2 | Jätkuvestlus kirjest: eelmine vastus, olek, fookus ja küsitud omavalitsus tulevad kirjest, kui rida on kustunud või teise plaani oma. Varem avaldatud pöörded saavad kirje oma reast | tehtud (jaotis „Teine samm“) |
| 3 | Audit on päriselt ajutine ja vestlus allub 90 päeva reeglile: plaanil `retentionHours`; vestluse aegumine tavalise reegli järgi viimasest aktiivsusest; arendusplaani tähtajatu erand ei jõua säilitusajaga plaani kasutajateni; ka katkenud pöörded aeguvad | tehtud (jaotis „Kolmas samm“) |
| 4 | Pöörde suured andmed kirjutatakse üks kord (praegu umbes kümme ülekirjutust pöörde kohta) | tegemata |
| 5 | Mõõdetav koristus ja kasv (kogumaht, päevane juurdekasv, aegunud kirjed, vanim koristamata, vaba ruum) ning vastuvõtt mahukatsega | osaliselt: aruanne tehtud (jaotis „Viies samm“), mahukatse tegemata |

## Teine samm: jätkuvestlus kirjest

**Leid päris lehel pärast esimest sammu (06.10):** vestluste nimekirja 30 vestlust vastasid päringule (200), kuid kõik olid tühjad. Tänased kolm plaanivahetust peitsid kõik varasemad 82 pööret; nende sõnumites olid kohatäited ja kirjet ei olnud. Esimene samm aitab ainult pöördeid, mis avaldatakse pärast seda.

### Mida dialoog pöördest võtab

Jätkuküsimuse vastuvõtmisel (`acceptDialogue`) loeti seni ainult töötava plaani ridu. Nüüd loetakse lisaks vestluse kirjed: iga pööre, mille rida töötav plaan ei loe, tuleb kirjest tehtud reana (`historyRows`). Plaani enda read on endiselt tõend ja neid eelistatakse.

Kirje hoiab selleks kahte asja juurde:

- **teema kasutajapöörded** nii, nagu pööre nendega vastu võeti (`dialogue.userTurns`). Vestluse olek on seotud täpselt nende pööretega (tunnused ja tekst räsina), seega peab loend olema sama;
- **mis täis teema edasi andis** (`dialogue.carried`, ADR-070).

**Vastuseta jäänud pöördel kirjet ei ole**, kuid ta on teema kasutajapööre ja olek on ka temaga seotud. Ta tuleb tagasi hilisema kirje loendist (peatatud pöördena, oma tekstiga, õigel kohal). Viimane vastuseta pööre, mida ükski kirje ei loetle, on kadunud.

### Reeglid

- **Vestluse pea** (viimati vastu võetud pööre) kehtib, kui dialoog seda pööret tunneb, olenemata plaanist. Seni kehtis ta ainult sama plaani piires.
- **Pea, mida dialoog ei tunne** (teise plaani vastuseta pööre): sõnum alustab uut teemat, nagu seni pärast plaanivahetust. Sama plaani tundmatu pea annab endiselt vea `context_unavailable`; koostaja saadab sel juhul ise uue teema.
- **Varasem vastus kirjest** on sama kujuga kui reast (nummerdatud punktid, „ei ole faktide allikas“). Paketti ei ole, seega viiteid uuesti ei kontrollita.
- **Olek kirjest** on järgmise pöörde eelmine olek, kui ta on sama olekuversiooniga ja seotud teema pööretega nii, nagu dialoog neid nüüd loeb. Muidu jätkub pööre ilma olekuta ja mudel loeb teema pöörded uuesti (logitakse `[rag-v2] history state not continued`). Pööret see ei katkesta.
- **Pöörete loendur** (`revision`) jätkub üle plaanide. Vestluse piir 64 pööret loeb nüüd kõiki pöördeid, mida dialoog tunneb, mitte ainult töötava plaani omi.
- Kirje, mille esimene samm kirjutas ilma pöörete loendita, on ajaloos näha, kuid sealt ei jätkata.

### Varem avaldatud pöörded

`scripts/rag-v2-history-backfill.mjs [--dry-run]` annab igale lõpetatud pöördele, millel on auditirida, aga puudub (terve) kirje, kirje tema enda reast, täpselt nii nagu avaldamisel. Üle kirjutatakse ainult kohatäide või pöörde enda tekst; muu sisuga sõnum jääb puutumata. Auditirida ei muudeta, midagi ei kustutata, mudelikutseid ei tehta.

### Mõõdetud (ainult lugedes, 06.10.2026, serveris)

Kõik 83 salvestatud pööret 70 vestluses võeti kirjetest uuesti vastu (`hs2/hs2-sim.mjs`; kirjed tehti mälus, päris ridu ei muudetud) ja tulemust võrreldi sellega, mille pööre omal ajal salvestas:

| | Tulemus |
|---|---|
| Vastuvõtt (kasutajapöörded, teema, isik, valik, allikapöörded) | 83/83 sama |
| Varasem vastus kirjest võrreldes reaga | 13/13 sama |
| Varasem vastus kirjest võrreldes sellega, mis omal ajal mudelile saadeti | 13/13 sama |
| Eelmine olek kirjest võrreldes salvestatuga | 13/13 sama |

Jätkupöördeid on päris andmetes 13; ülejäänud 70 on vestluse esimesed. Täis teema edasiandmist (ADR-070) ja vastuseta pööret teema keskel päris andmetes ei ole: need on kaetud testidega.

Pöörete loend lisab kirjele keskmiselt 0,2 KB (suurim 0,7). Kaks sõnumit kettal: keskmiselt **4,8 KB** (mediaan 4,9; 90% 6,4; suurim 7,0). 30 000 pöörde juures päevas 0,14 GB päevas, 90 päevaga 13,0 GB.

### Kontroll

- Ühiktestid (`tests/rag-v2-history.test.mjs`, kolm uut): järgmine pööre võetakse kirjetest vastu nagu ridadest (koos vastuseta pöördega teema keskel, parandusega ja olekuga); täis teema annab edasi kirjetest nagu ridadest; tundmatu pea alustab uut teemat.
- Andmebaasitestid: pärast plaanivahetust jätkab järgmine sõnum teemat (kasutajapöörded, varasem vastus, olek) ja teeb ühe vastusekutse; dialoog jätkub, kui auditiread on kustutatud, ka vastuseta pöördest mööda; teise olekuversiooniga olek jäetakse kõrvale; aegunud reaga pea jätkub kirjest oma isikuga; kohatäidetega avaldatud pöörded saavad kirje reast ja neid jätkatakse (kuivkäivitus ei kirjuta, muu sisu jääb puutumata, kirje on sama mis avaldamisel).

### Päris lehel (06.10.2026, väljalase `9fd83c37`, #412)

- **Tagasitäide serveris.** Kuivkäivitus: 82 pöördest 82 saaks kirje, vigu 0, muu sisuga sõnumeid 0. Päris käivitus: 82 kirjet tehtud (kokku 467 KB tekstina, suurim 10,7 KB). Kordus: kõik 82 olemas, midagi ei kirjutatud.
- **Brauseris, omaniku kontoga.** Enne tagasitäidet: 30 vestlust, 0 pööret. Pärast: 30 vestlusel 30-l on pöörded, kokku 33 pööret, kõik kirjest; 33 vastust päris tekstiga; kõigil 30 vestlusel on aktiivne teema (koostaja saadab järgmise sõnumi jätkuna). Kaheksa kirjest näidatud pöörde allikavaade: kõik avanesid tekstiga (korpuses sama lõik) ja lingiga. Vestlusaken näitab kahe pöördega vestlust nelja sõnumina, kohatäiteid ja veateateid ei ole.
- **Üks päris pööre päris mudeliga (omaniku luba 06.10; kulu 0,0049 USD plaani hindades).** Jätkuküsimus vestluses, mille kaks pööret avaldati hommikul teise plaani all. Tulemus pöörde kirjest: võeti vastu jätkuna (3 kasutajapööret, loendur 3, `headFromEarlierPlan` puudub); varasem vastus ja olek tulid **kirjest**, eelmine olek jäi alles; sõnumites on küsimus ja vastus tekstina (653 märki) ning kirje (3 kasutajapööret, 5 allikat, 7,5 KB); vastuse sõnum on küsimusest 1 ms hilisem; vestluse viimase aktiivsuse aeg uuenes avaldamisel. Vastus tuli umbes 9 sekundiga.

### Kontrollimata

- Uuenenud allika teade brauseris (kõigil kaheksal vaadatud allikal oli korpuses sama lõik).
- Täis teema edasiandmine ja vastuseta pööre teema keskel päris lehel (testides kaetud).
- 12 ühendtesti siin arvutis ei käi (EstNLTK ja kohalikud sisendfailid), nagu esimeses sammus.

### Tegemata selles sammus

- **Viimane vastuseta pööre pärast rea aegumist** alustas uut teemat. Parandatud kolmandas sammus.
- Ajaloos ei näidata vastuseta pöördeid, mille rida on kadunud.

## Kolmas samm: audit aegub, vestlus elab 90 päeva

Seni sai pöörde auditirida ja vestlus ühe ja sama tähtaja: plaani oma (`pilotExpiry`). Plaan säilitusajaga 24 tundi oleks kustutanud 24 tunni pärast ka vestluse. Seepärast ei olnud säilitusaega võimalik kasutada ja töötav plaan on tähtajatu.

### Mis muutus

- **Vestluse eluiga on avaldatud reegel, mitte plaani oma.** Vestlus luuakse tähtajaga 90 päeva (`CONVERSATION_TTL_DAYS`, sama mis teistel vestlustel) ja iga avaldatud pööre lükkab seda 90 päeva edasi (`conversationExpiry`, `lib/rag-v2/pilot/lifetime.js`). Plaani lõpp ega auditirea säilitusaeg vestlust ei lõpeta.
- **Auditirea eluiga on plaani oma.** Plaani `retentionHours` (1–168 tundi) järel rida kustub; vestlus jääb oma sõnumitesse ja dialoog jätkub kirjetest (teine samm). Sama kehtib vastuseta jäänud pöörete ridade kohta.
- **Erand on ainult plaan, millel ei ole ühtegi tähtaega** (`expiresAt` ja `retentionHours` mõlemad tühjad; praegune arendusplaan): selle vestlused ja read säilivad kustutamiseni nagu seni. Säilitusajaga plaani kasutaja vestlus saab alati 90 päeva tähtaja, ka siis, kui vestlus loodi varem tähtajatu plaani all (järgmisel avaldatud pöördel).
- **Plaani tegemine:** `scripts/rag-v2-chat-plan.mjs --retention-hours <1-168>`; korpuse täiendus kannab väärtuse uude plaani nagu auditi aja.
- **Vestluse pea hoiab teema ja isiku tunnust.** Kui viimane pööre jäi vastuseta ja tema rida on aegunud, jätkab järgmine sõnum teemat, milles see pööre oli, viimasest kirjega pöördest. Pea, mis alustas oma teemat või uut isikut, ei anna midagi jätkata ja vanema isiku juurde tagasi ei minda (`context_unavailable`; koostaja saadab uue teema).

### Soovitus plaanidele

| Plaan | Täisaudit | Rida kustub | Vestlus |
|---|---|---|---|
| Arendus (praegu) | 7 päeva (`auditDays: 7`), siis kõhn | ei kustu (tähtajatu) | säilib kustutamiseni |
| Avamisel | ei hoita (`auditDays: 0`, kohe kõhn) | 7 päeva (`retentionHours: 168`) | 90 päeva viimasest aktiivsusest |

Avamise plaaniga on kettal korraga: kõhnad read 7 päeva (17,4 KB pööre) ja kirjed 90 päeva (4,8 KB pööre). 30 000 pöörde juures päevas on see püsivalt umbes 3,7 GB ridu ja 13,0 GB kirjeid (ilma tabeli lisakuluta). Arvutus, mitte mõõtmine: mahukatse on viies samm.

### Kontroll

- Ühiktestid (kaks uut): vestluse tähtaeg plaani eri seadetega ja plaani säilitusaeg kui kontrollitud, kinnitatud seade; aegunud reaga vastuseta pea jätkab oma teemat, oma teemat alustanud pea mitte. Korpuse täienduse test: uus plaan hoiab säilitusaja.
- Andmebaasitestid (kaks uut): säilitusajaga plaanil saab rida 24 tundi ja vestlus 90 päeva; iga avaldatud pööre uuendab vestluse aega; aegunud rida kustub ja vestlus jätkub kirjetest koos olekuga; vastuseta pöörde aegumise järel jätkab järgmine sõnum sama teemat; tähtajatu plaan vestluse aega ei muuda.
- Kogu ühiktestide komplekt: 754 testi, 735 läbis, 19 vahele jäetud, 0 ebaõnnestus. Andmebaasitestid: 78/78.

### Tegemata ja kontrollimata

- **Töötavat plaani ei muudetud:** arendusplaan on endiselt tähtajatu, seega serveris veel ükski rida ei aegu ja kettakulu ei vähene. Säilitusajaga plaani ei ole päris lehel proovitud.
- **Avamise plaani liiki ei ole.** Plaani `usage` saab praegu olla ainult `development_only`. Kui avamise liik tehakse, peab ta säilitusaega nõudma.
- Olemasolevad 70 arendusvestlust on tähtajata ja jäävad nii.
- Aegunud ridade kustutamine käib iga päringu alguses (`purge`). Suure mahu juures tuleb see viia koristusse; mõõtmine on viies samm.

## Viies samm, esimene osa: kettakulu ja kasvu aruanne

`scripts/rag-v2-chat-storage.mjs` (teek `lib/rag-v2/pilot/storage-report.js`) loeb ainult ja trükib ainult arve; ühtegi küsimust, vastust ega allikateksti aruandes ei ole. Ta ütleb:

- **tabelite suurused** (auditiread, vestluse sõnumid, vestlused, pöörete tunnused) ja andmebaasi kogumahu;
- **auditiread kuju järgi:** terved ja kõhnad, keskmine salvestatud suurus, mitu on ilma tähtajata;
- **juurdekasvu:** viimase päeva ja nädala read ja baidid, eraldi ridadele ja vestluse kirjetele;
- **kirjed vestluse sõnumites:** mitu, keskmine ja suurim, mitu kohatäidet on veel alles;
- **mis ootab koristust:** aegunud read, mida ei ole veel kustutatud (ja vanim neist); terved read, mis on plaani auditi ajast vanemad ja veel kõhnaks tegemata; vestlused, mille tähtaeg on möödas;
- **vaba kettaruumi.**

Kontroll: andmebaasitest (aruanne loeb testi enda read vahena, sest testandmebaasis on teiste testide ridu; aruandes ei ole pöörde teksti).

### Serveris (06.10.2026 kell 11.11 UTC, väljalase `d60943d3`)

| | Arv |
|---|---|
| Vaba kettaruumi | 9,1 GB 61,3 GB-st |
| Andmebaas kokku | 108,9 MB |
| Auditiread | 84 (83 vastusega, 1 vastuseta); kõik terved, kõhnu 0; kõik ilma tähtajata |
| Auditiridade sisu | 15,4 MB (terve rida keskmiselt 184,5 KB) |
| Auditiridade tabelifail | 42,7 MB |
| Vestluse sõnumid | 166, neist 83 kirjega; kohatäiteid 0 |
| Kirjete sisu | 0,40 MB (pöörde kaks sõnumit 4,8 KB; vastus kirjega keskmiselt 4,7 KB, suurim 6,8 KB) |
| Sõnumite tabelifail | 2,2 MB (sellest indeksid 1,4 MB) |
| Vestlusi | 70, kõik ilma tähtajata; pöördeid vestluses keskmiselt 1,2, kõige rohkem 5 |
| Ootab koristust | aegunud ridu 0; auditi ajast (7 päeva) vanemaid terveid ridu 0; tähtaja ületanud vestlusi 0 |
| Viimase päeva juurdekasv | 84 rida, 15,4 MB (kõik andmed on pärast 05.10 puhastust) |

**Kaks tähelepanekut:**

- **Auditiridade tabelifail on 2,8 korda suurem kui ridade sisu** (42,7 MB ja 15,4 MB). Vahe on ülekirjutuste jälg: pöörde rida kirjutatakse pöörde jooksul umbes kümme korda ümber. See on neljanda sammu (ühekordne kirjutamine) mõõdetud põhjus.
- **Miski ei aegu veel:** kõik read ja vestlused on tähtajata, sest töötav arendusplaan on tähtajatu (kolmas samm seda ei muutnud).

**Tegemata:** mahukatse (palju sünteetilisi vestlusi päris teed pidi: avaldamine kirjetega, ridade aegumine ja kustutamine, ajalugu ja jätkuvestlus ilma ridadeta, vestluste aegumine, teine ring ja tegelik kettakulu).

## Vastavus avaldatud tingimustele

- Kasutustingimuste punkt 10 (versioon 2026-07-20) näeb ette vestluste salvestamise ajaloo kuvamiseks ja jätkamiseks. Kirje hoiab just seda.
- Privaatsustingimuste punkt 7.3 (versioon 2026-08-13.1): vestlused säilivad üldjuhul kuni 90 päeva. Säilitusaega see samm ei muuda. Avaldatud pööre uuendab nüüd vestluse viimase aktiivsuse aega, nagu reegel eeldab.
- Vestluse kustutamisel kustuvad sõnumid koos vestlusega (andmebaasi seos), seega ka kirje.

## Tagasipööramise piir

Varasem väljalase loeb ainult ridu ja jätab sõnumid vahele. Selle sammu saab tagasi pöörata nagu iga teise; juba kirjutatud kirjed jäävad sõnumitesse ja neid lihtsalt ei loeta. Alumised piirid on endised: kõhnad read ([ADR-093](adr-093-lean-turn-record.md)) ja kokkupakitud paketid (#403, [ADR-089](adr-089-closest-contact-directory.md)).

## Lahti

- Sammud 3–5.
- Kulu selle töö peale seni: 0,0049 USD (üks päris pööre; omaniku luba 06.10 väikesteks kuludeks, minu ülempiir 0,50 USD).
- Kirje suurus: vastus on kirjes kaks korda ja tunnused (dokument, versioon, lõik, räsi) võtavad allika kohta umbes 0,3 KB. Kui 4,8 KB osutub liiga suureks, on need kohad, kust võtta.
- Vestluse pealkiri: RAG v2 vestlus luuakse pealkirjaga „M4 sisepiloot“.
