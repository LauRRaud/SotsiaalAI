# ADR-135: küsimuses nimetatud säte tuuakse otse kohale

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5. Omanik 10.10.2026: platvormil hakatakse testima, kas assistent oskab täpselt nimetada „SHS § 133 lg 5 järgi …“. Seis: **kood ja testid tehtud; tasuta mõõdetud serveris; päris vestluses kontrollitakse ühe proovipöördega pärast serverisse jõudmist.**

## Probleem

Pärast [ADR-129](adr-129-luna-names-the-provision.md) serverisse jõudmist küsisin päris vestluses „Mida ütleb SHS § 133 lg 5?“. Vastus: „Mul ei ole siin SHS § 133 lõike 5 teksti, seega ei saa öelda, mida see säte ütleb.“ Luna ei mõelnud midagi välja, aga see on just küsimus, millega platvormi testitakse.

Neljast katsest (kolm tasulise kontrolli ringi ja üks päris pööre) tõi otsing õige lõigu kohale kahel. Põhjus: seaduselõigu tekst algab sageli keset paragrahvi ega sisalda ei paragrahvi numbrit ega seaduse nime, nii et otsing leiab selle ainult sisu sarnasuse kaudu, ja küsimuses „Mida ütleb SHS § 133 lg 5?“ sisu ei ole.

## Otsus

**Kui küsimus ise nimetab seaduse ja paragrahvi, tuuakse see lõik kohale akti struktuuri järgi, mitte otsingu sarnasuse järgi** (`lib/rag-v2/search/retrieval.js`, nimetatud aktide rada).

- Seadust loetakse nii, nagu inimene seda kirjutab: pealkiri omastavas („sotsiaalhoolekande seaduse § 133 lg 5“), pealkiri nimetavas, Riigi Teataja lühend („SHS § 133 lg 5“, „SHS-i § 133 lõige 5“). Lühendid tulevad tabelist `act-abbreviations.json` (ADR-129).
- „paragrahv 133 lõige 5“ loetakse nagu „§ 133 lg 5“.
- Lõige leitakse sama lugejaga, mis järgib seaduse enda viiteid ([ADR-064](adr-064-named-other-act.md)): kui lõige on nimetatud, tuuakse lõik, mis seda lõiget sisaldab; kui ainult paragrahv, selle esimene lõik.
- Need lõigud võtavad nimetatud aktide kaks kohta enne lõikude enda viiteid, sest küsimus küsib just neid.
- Midagi ei tooda, kui akti ei ole nimetatud, kui seda akti kogus ei ole, kui aktil sellist paragrahvi ei ole või kui kaks kogu akti jagavad sama nime. Otsing käib siis nagu enne.

## Mõõdetud

- Ühiktest (`tests/rag-v2-graph-experiment.test.mjs`, „ADR-135“): seitse kirjaviisi („SHS § 25 lg 2“, „SHS-i § 25 lõige 2“, pealkiri omastavas ja nimetavas, „§25“, „paragrahv 25 lõige 2“, koos punktiga) toovad lõigu, mis seda lõiget sisaldab; paragrahv üksi toob selle esimese lõigu; kaks sätet toovad mõlemad; viis juhtu, kus midagi tuua ei tohi, ei too midagi; lõikude enda viidete rada töötab nagu enne.
- Kogu ühiktestide komplekt: 1809 testi, 0 viga.
- Tasuta otsingukontroll serveris veel saatmata koodiga (ADR-122): 33 kindlat küsimust valivad täpselt samad lõigud (ükski neist ei nimeta sätet märgiga, nii et rada neid ei puuduta).
- Päris vestluses enne muudatust: „Mida ütleb SHS § 133 lg 5?“ → „mul ei ole selle sätte teksti“ (10.10.2026). Pärast: üks proovipööre omaniku loal, tulemus käsiraamatu sissekandes.

## Piirid

- Loetakse ainult üleriigilisi õigusakte, mille pealkiri on otsinguulatuses üks (kehtiv redaktsioon). Omavalitsuse määrust nii ei tooda: 60 määruse pealkirja 286-st on mitmel omavalitsusel sama.
- Vaja on märki „§“ või sõna „paragrahv“. „SHS 133 lg 5“ ilma märgita ei loeta.
- Kaks kohta: kolmas küsimuses nimetatud säte jääb otsingu leida.
- Punkti („p 2“) ei eristata; tuuakse lõige.
