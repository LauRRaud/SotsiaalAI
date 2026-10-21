# ADR-165 — Plaan ja valik katavad ka kasutaja kirjeldatud asjaolu (search-assist-17 ja 18)

21.10.2026. Teostus Claude Opus 5.5. Omaniku pööre serveris: „Elan tabasalus, tervisekassat ei ole, toimetulek on raske.
Kas saan pöörduda kohaliku omavalitsuse sotsiaaltöötaja poole?“ ja omaniku märkus „kahju, et välja jättis“.

## Leid

- Plaan kirjutas päringu „Ravikindlustuseta inimesele kohaliku omavalitsuse abi“, ja otsing leidis vajalikud lõigud.
  Kandidaatide seas olid:
  - P20, narko.ee lehe lõik „Tervishoiuteenused ravikindlustamata inimestele“;
  - P35 ja P36, tervishoiuteenuste korraldamise seaduse vältimatu abi ja ravikindlustusega hõlmamata isikute sätted.
- Valikumudel võttis sama lehe teise lõigu (P5, „Toimetulekutoetus“), mitte P20-t, ja jättis seaduse sätted välja.
- Vastus ütles seega õigesti: „Ma ei saa nende andmete põhjal öelda, millist abi saad just ravikindlustuse
  puudumise tõttu.“
- Juhise reegel „Cover every part of the request“ räägib küsimuse osadest. Ravikindlustuse puudumine oli sõnumis
  kirjeldatud asjaolu, mitte küsimus.

## Otsus

Valikumudeli juhisesse lisandub pärast seda reeglit üldine reegel (`RERANK_CIRCUMSTANCE_INSTRUCTIONS`):
- Kasutaja kirjeldatud asjaolu, mis loob omaette vajaduse, on osa päringust ka siis, kui sõnum küsib muud. Näited on
  asjaolu liigid: ravikindlustus puudub, sissetulekut pole, elukohta pole, võlad, haigus või puue.
- Kui lõik ütleb, mis abi või reegel sellisel juhul kehtib, jääb see alles küsitud asja lõikude kõrval.
- Sama dokumendi eri pealkirjade all olevad lõigud on eri lõigud. Neid valitakse oma teksti järgi, mitte dokumendi
  pealkirja järgi.

### search-assist-18: sama reegel plaanis

- Esimene kontroll (search-assist-17, sama küsimus uues vestluses): plaan kirjutas ainult kaks päringut. Ravikindlustuse
  päring oli „ravikindlustuseta inimese sotsiaalabi kohaliku omavalitsuse abi“.
- Kandidaatide seas ei olnud siis ravikindlustamata inimeste tervishoiu lõiku ega vältimatu abi sätet. Valikul polnud
  midagi alles jätta, ja vastus jättis ravikindlustuse mainimata.
- Plaani juhisesse lisandub pärast muretseva sõnumi reeglit `PLAN_CIRCUMSTANCE_INSTRUCTIONS`: omaette vajadusega
  asjaolu saab oma päringu selle asjaolu abi või reegli kohta, ametlikes terminites, ka siis, kui sõnum küsib muud.

## Kontroll

- Sama küsimus uues vestluses: kas valik võtab ravikindlustamata inimeste tervishoiu lõigu või vältimatu abi sätte ning
  kas vastus ütleb, kust abi saab.
- Kuus kolme juhtumi küsimust: valitud lõikude arv, aeg ja vastuse kuju võrreldes ADR-162 jooksuga.

### m4-grounded-answer-14 ja m4-grounded-dialogue-48: sama reegel vastuses

- Kolm kordust search-assist-18-ga, sama küsimus eraldi vestlustes:
  - plaan kirjutas igas ravikindlustuse päringu;
  - kandidaatide seas oli 5–12 ravikindlustuse lõiku;
  - valik võttis igas lõigu „Tervishoiuteenused ravikindlustamata inimestele“, mis räägib vältimatust abist (perearst,
    EMO, 112) ja tasuta vältimatust hambaravist.
- Vastus seda lõiku ei kasutanud. Juhis „Offer a small number of relevant supported options, usually one to three“
  jättis ravikindlustuse neljandaks: alles jäid pöördumine, kontaktid ja toimetulekutoetus.
- Vastuse juhise A GOOD ANSWER osasse lisandub: omaette vajadusega asjaolu saab oma lühikese ploki, kui tõendid ütlevad,
  mis abi või reegel kehtib, ka siis, kui küsimus on muu kohta. See ei loe nende ühe kuni kolme võimaluse hulka.
