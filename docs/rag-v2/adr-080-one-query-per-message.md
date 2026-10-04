# ADR-080 — Plaan, mis kirjutab päringu igale sõnumile, otsib ainult praeguse sõnumi päringuga

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10 õhtul: „sa toimeta edasi, kuni vigu ei ole. võid teha teste, raha pole probleem.“ Lähtekoht: [ADR-079](adr-079-plan-list-duty-query-and-reserved-places.md) mõõtmine.

**Reegel ise on mõõtmata.** Pärast avaldamist tehtud jooksus (jaotis „Mõõtmine“) kirjutas plaan kolmandas pöördes ise ühe päringu ja reegel ei rakendunud. Tõend on kohalikud testid salvestatud plaanidega.

## Probleem

Viie sidumata õigusküsimuse vestluse kolmas pööre sai neljas jooksus (hommikune küsimustik, ADR-077, ADR-078, ADR-079) sama plaani:

| Sõnum | Plaani päring |
|---|---|
| 1. Kui suur on toimetulekupiir …? | toimetulekupiir toimetulekutoetuse arvutamine … |
| 2. Kes peab teatama abivajavast lapsest …? | abivajavast lapsest teatamise kohustus … |
| 3. Mis vahe on eestkostel ja toetatud otsustamisel? | eestkoste ja toetatud otsustamise erinevus |

- Kolm sõnumit, kolm päringut, igale sõnumile oma, sõnumite järjekorras. Nelja ja viie sõnumiga pöördes plaan seda ei teinud.
- Kaks juhiserida (search-assist-7 „varasemad küsimused on vastatud“, search-assist-8 „üks päring piisab“) seda ei muutnud.
- Eelvalik neid lõike mõõtmistes ei hoidnud ja vastus oli teemakohane; viga raiskab otsingut ja kandidaatide kohti.

## Otsus

Server loeb mustri sõnadest ja jätab alles ainult praeguse sõnumi päringu.

- **Muster:** päringuid on sama palju kui vestluskontekstis kasutajasõnumeid (vähemalt kaks) ja iga päring jagab oma sõnumiga rohkem sõnu kui ühegi teisega (vähemalt ühe). Sõnu võrreldakse algusosa järgi (vähemalt neli tähte, kuni kuus), ilma keeleanalüüsita.
- **Erandid:** kui praegune sõnum viitab tagasi („see“, „seda“, „sealt“; ADR-074 reegel) või on lühem kui neli sõna, on see jätk ja plaan jääb puutumata.
- **Kõik muu jääb puutumata:** plaan, mille päringute arv ei võrdu sõnumite arvuga, või mille mõni päring sobib praeguse sõnumiga sama hästi.
- Kirjes on välja jäetud päringud (`searchAssist.droppedQueries`); hindaja raport näitab neid.
- See on serveri reegel; juhiseid ja versioone ei muudetud.

## Kontrollid

- `tests/rag-v2-search-assist.test.mjs`: neli salvestatud kolmanda pöörde plaani annavad kõik ühe päringu; hommikused neljanda ja viienda pöörde plaanid, jätkuküsimuse plaanid ja lühike vastus jäävad puutumata; kahe sõnumi vestluses jäetakse varasema palve päring välja.
- `tests/rag-v2-dialogue-store.test.mjs` (päris hoidla): pööre sellise plaaniga salvestab ühe päringu ja välja jäetud päringud.

## Piirid

- **Sõnade võrdlus on jäme.** Päring, mis kasutab ametlikku terminit ega jaga praeguse sõnumiga ühtegi sõna, ei täida mustrit ja jääb alles (kaitse ei rakendu); vastupidine viga (õige päring jäetakse välja) nõuab, et kõik päringud sobiksid täpselt eri sõnumitega.
- **Olukorra kirjeldus kahes sõnumis** („Mu ema elab üksi Kose vallas.“ ja siis „Kuidas koduteenust taotleda?“): kui plaan kirjutab ühe päringu kummagi sõnumi kohta, jääb alles ainult teine. Koha otsustab olek, mitte päringu tekst, nii et otsingu vald ei muutu.
- Teisi plaani vigu (teema liitmine praegusesse päringusse) see ei puuduta.

## Mõõtmine (04.10.2026, pärast avaldamist)

Samad kolm kataloogi, töötavalt väljalaskelt `9aabbf6f`. Kulu 0,0552 USD plaanihindades. [Tõendifail](../audits/evidence/plan-guard-measured-2026-10-04.json).

| Kataloog | Pöördeid | Läbis | Enne (ADR-079) |
|---|---:|---:|---:|
| Viis sidumata küsimust | 5 | 5 | 3 |
| Mis muutub | 1 | 1 | 1 |
| Jätkuküsimus | 4 | 3 | 4 |

- **Reegel ei rakendunud.** Ühelgi pöördel ei ole välja jäetud päringuid: kolmanda pöörde plaan kirjutas seekord ise ühe päringu (neljas varasemas jooksus kolm). Viie küsimuse tulemus 5/5 ei ole selle reegli tõend.
- **Esimene pööre andis summad** esimest korda nelja jooksu jooksul: 220, 176 ja 264 eurot. Riigieelarve seaduse kandidaat oli seekord § 2 teine lõik (summaga). Kontrollitud hoidla tekstide vastu: riigieelarve seaduses „toimetulekupiir 220 eurot kalendrikuus“, sotsiaalhoolekande seaduses 80 ja 120 protsenti. Kas see lõik kandidaadiks saab, sõltub plaani päringust; § 2 on endiselt lõigatud pikkuse järgi.
- **Viies pööre leidis perekonnaseaduse sätted:** eelvalik hoidis § 97, § 99 ja § 103 ning vastus viitab neile. Vastuse esimese lõigu kolm lauset on võrreldud nende paragrahvide tekstiga (§ 97 p 3, § 99 lg 1, § 103 lg 1). § 96 kandidaatide hulgas ei olnud. Päring oli „täisealise lapse ülalpidamiskohustus vanema suhtes tingimused“; eelmise jooksu päring („… vanema hoolduskulude tasumisel“) neid sätteid ei toonud. Leitavus sõltub päringu sõnastusest.
- **Mis muutub:** eelvalik hoidis § 3–6 mõlemas redaktsioonis. Vastuse väited erinevuste kohta (§ 4 lg 2 ja lg 6, § 5 lg 1 ja lg 3 p 4) on võrreldud mõlema tekstiga lõigete kaupa ja peavad paika.
- **Jätkuküsimuse kolmas pööre ebaõnnestus** („Ja mis see maksab?“ pärast Maardu küsimust): plaan kirjutas ühe päringu ilma valla nimeta („Isikliku abistaja teenuse tasu kujunemine inimese omaosalus“) ja otsing läks Nõo valda. Serveri reegel nõudis jätku puhul, et päring nimetaks küsitud valda; kolmes varasemas jooksus plaan nimetas. Parandus: [ADR-081](adr-081-follow-up-without-a-named-municipality.md).

Üks jooks kataloogi kohta. „Läbis“ tähendab kataloogi kontrolle; allikaga on võrreldud ainult see, mis ülal nimetatud.
