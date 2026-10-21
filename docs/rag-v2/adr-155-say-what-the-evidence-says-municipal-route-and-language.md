# ADR-155 — Vastus ütleb, mida tõendid ütlevad; omavalitsuse tee enne osutajat; keelekontroll

21.10.2026. Teostus Claude Opus 5.5. Omanik 21.10: „„ei saa kindlalt määrata“ ei ole vastus“.

## Leiud

- **Teabe olemasolul jäeti asi lahtiseks.**
  - N01, juhis 44: Töötukassa lehe 378,40 eurot oli tõendites, kuid vastus pani selle piirangusse („ei saa kinnitada
    kehtiva ülempiirina“).
  - E9: vastus ütles, et kohustuslikke teenuseid on 13, ja jättis lahtiseks, kas päevakeskus on nende hulgas.
- **E7:** küsimusele parima koduteenuse osutaja kohta vastati osutaja lehe ja uuringuga. Tartu korra koduteenuse
  paragrahv oli tõendites, kuid vastus ei öelnud, et teenust korraldab linn ja kuidas seda saada.
- **Keel:** G04 „Kui su isa 70-aastasel isal…“ ja G42 „peab sa elama“.

## Otsus: juhis `m4-grounded-dialogue-46`

Lisandub kolm lõiku. Ükski neist ei nimeta allikat, teenust ega juhtumit.

1. **`MUNICIPAL_ROUTE_INSTRUCTIONS`** (teenuseosutaja reegli järel). Küsimus võib olla teenuse leidmise, valiku või
   saamise kohta. Kui tõendites on omavalitsuse enda reegel, kord või kirje selle teenuse kohta, öeldakse see esimesena
   koos viidetega: kuidas inimene teenuse omavalitsuse kaudu saab. Osutaja lehekülg seda kunagi ei asenda.
2. **`COMMIT_INSTRUCTIONS`** (juhise lõpus).
   - Kui tõendid annavad küsitud arvu, reegli, tingimuse, loetelu või fakti, öeldakse see vastusena välja.
   - Piirangut „ei saa kinnitada“, „võib olla muutunud“ või „otsustab keegi teine“ ei lisata. Erand on, kui tõendid
     ise nii ütlevad või kui küsimus on otsuse kohta inimese enda asjas.
   - Arvu kuupäev jääb lausesse, nagu ajareeglid nõuavad.
   - Kui otsus kuulub asutusele, öeldakse siiski, mida esitatud asjaolud tsiteeritud tingimuse järgi tähendavad
     („nende asjaolude korral tingimus ei ole täidetud“), ja otsustaja nimetatakse üks kord.
   - Kui tõendid annavad loetelu, on see vastus küsimusele, kas asi on loetelus: loetelu nimetatakse ja öeldakse, kas
     küsitu on selles.
   - Piirang on lünga jaoks, mis muudab vastust, mitte vastuse asemel.
3. **`LANGUAGE_CHECK_INSTRUCTIONS`** (juhise lõpus). Enne vastamist loetakse iga lause üle nii, nagu emakeelne lugeja
   seda loeks: tegusõna ühildub alusega („sa pead“, „ta peab“, mitte „peab sa“), sõna või fraasi ei korrata ekslikult
   ja iga lause on terviklik.

`PROMPT_VERSION` ei muutu (vestlusplaan on dialoogiplaan). `m4-grounded-dialogue-45` on loetav. Väljalase uuendab
plaani koodi väljad ise.

## Hindamine edaspidi

Omaniku põhimõte kehtib ka tõenduskatsetes. Vastus „ei saa kindlalt öelda“ on FAIL, kui tõendid (või korpus, mille
otsing oleks pidanud leidma) annavad vastuse. Varasemad PASS-hinnangud, mis tuginesid ainult sellele, et „kindlat
õigust ei lubatud“, vaadatakse üle selle mõõdupuuga.

## Kontroll

Päringu kokkupanek kontrolliti ilma mudelita. Mudeli käitumine mõõdetakse serveris eelregistreeritud kordustestiga
(`docs/audits/vestlustest-2026-10-21-juhis46-eelregistreering.json`). Iga pöörde jälg loetakse ADR-154 vaatest.
