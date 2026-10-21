# ADR-165 — Valik hoiab lõigu ka kasutaja kirjeldatud asjaolu kohta (search-assist-17)

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

Plaani juhis ei muutu.

## Kontroll

- Sama küsimus uues vestluses: kas valik võtab ravikindlustamata inimeste tervishoiu lõigu või vältimatu abi sätte ning
  kas vastus ütleb, kust abi saab.
- Kuus kolme juhtumi küsimust: valitud lõikude arv, aeg ja vastuse kuju võrreldes ADR-162 jooksuga.
