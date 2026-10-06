# ADR-094 — Püsiv vestlusajalugu vestluse enda sõnumites

06.10.2026. Teostus Claude Opus 5.5. Omanik 06.10: „mul on plaanis platvormile tuua tuhandeid kasutajaid, mul ei tohi paisuda kõvaketta kasutus meeletuks. Peab arvestama, kuidas toimub vestlus, selle talletamine, ajalugu jms.“ Küsimusele, kas alustada püsiva vestlusajaloo ehitamist kehtiva 90 päeva reegli piires, vastas omanik: **„Jah, kogu töö“**: küsimus, vastus ja lühiviited lähevad vestluse sõnumitesse (seni olid seal kohatäited); ajalugu ja jätkuvestlus loevad sealt ega sõltu plaanist; audit aegub ja kustub; vestlus allub 90 päeva reeglile.

See dokument kirjeldab kogu töö viit sammu. **Tehtud on esimene samm.**

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
| 1 | Ajalookirje kirjutamine avaldamisel; ajalugu ja allikavaade loevad seda, kui rida ei saa lugeda | **see muudatus** |
| 2 | Jätkuvestlus kirjest: eelmine vastus, olek, fookus ja küsitud omavalitsus tulevad kirjest, kui rida on kustunud või teise plaani oma | tegemata |
| 3 | Audit on päriselt ajutine ja vestlus allub 90 päeva reeglile: tootmisplaanil `retentionHours`; vestluse aegumine tavalise reegli järgi viimasest aktiivsusest; arendusplaani tähtajatu erand ei jõua tootmiskasutajateni; ka katkenud pöörded aeguvad. Enne seda saavad olemasolevad pöörded kirje oma reast | tegemata |
| 4 | Pöörde suured andmed kirjutatakse üks kord (praegu umbes kümme ülekirjutust pöörde kohta) | tegemata |
| 5 | Mõõdetav koristus ja kasv (kogumaht, päevane juurdekasv, aegunud kirjed, vanim koristamata, vaba ruum) ning vastuvõtt mahukatsega | tegemata |

Pärast sammu 1 on plaani vahetuse järel varasemad pöörded vestluses näha. **Jätkuküsimus alustab siis veel uut teemat** (nagu seni, `headFromEarlierPlan`): dialoog ei tea varasemast. Selle parandab samm 2.

Enne seda väljalaset avaldatud pööretel on sõnumites kohatäited ja kirjet ei ole. Neid näidatakse reast nagu enne; plaani vahetusel kaovad nad vestlusest nagu enne. Samm 3 annab neile kirje enne, kui read aeguma hakkavad.

## Vastavus avaldatud tingimustele

- Kasutustingimuste punkt 10 (versioon 2026-07-20) näeb ette vestluste salvestamise ajaloo kuvamiseks ja jätkamiseks. Kirje hoiab just seda.
- Privaatsustingimuste punkt 7.3 (versioon 2026-08-13.1): vestlused säilivad üldjuhul kuni 90 päeva. Säilitusaega see samm ei muuda. Avaldatud pööre uuendab nüüd vestluse viimase aktiivsuse aega, nagu reegel eeldab.
- Vestluse kustutamisel kustuvad sõnumid koos vestlusega (andmebaasi seos), seega ka kirje.

## Tagasipööramise piir

Varasem väljalase loeb ainult ridu ja jätab sõnumid vahele. Selle sammu saab tagasi pöörata nagu iga teise; juba kirjutatud kirjed jäävad sõnumitesse ja neid lihtsalt ei loeta. Alumised piirid on endised: kõhnad read ([ADR-093](adr-093-lean-turn-record.md)) ja kokkupakitud paketid (#403, [ADR-089](adr-089-closest-contact-directory.md)).

## Lahti

- Sammud 2–5.
- Päris pööre päris lehel (tasuline; luba küsimata).
- Kirje suurus: vastus on kirjes kaks korda ja tunnused (dokument, versioon, lõik, räsi) võtavad allika kohta umbes 0,3 KB. Kui 4,7 KB osutub liiga suureks, on need kohad, kust võtta.
- Vestluse pealkiri: RAG v2 vestlus luuakse pealkirjaga „M4 sisepiloot“.
