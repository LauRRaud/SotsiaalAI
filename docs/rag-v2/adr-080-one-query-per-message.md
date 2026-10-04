# ADR-080 — Plaan, mis kirjutab päringu igale sõnumile, otsib ainult praeguse sõnumi päringuga

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10 õhtul: „sa toimeta edasi, kuni vigu ei ole. võid teha teste, raha pole probleem.“ Lähtekoht: [ADR-079](adr-079-plan-list-duty-query-and-reserved-places.md) mõõtmine.

**Mõõtmata selle kirjutamise hetkel.** Tõend on kohalikud testid salvestatud plaanidega. Mõõtmise tulemus lisatakse jaotisesse „Mõõtmine“.

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

## Mõõtmine

Tegemata selle kirjutamise hetkel; lisatakse pärast jooksu.
