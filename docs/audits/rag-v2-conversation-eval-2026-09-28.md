# Terviklike vestluste hindamine, 28.09.2026

Teostus Claude Opus 5.5 omaniku ülesandel. Codexi kava samm 1: kontrollida terviklikke vestlusi olemasoleva korpusega.

## Mida mõõdeti

- **Kataloog:** [`tests/evaluation/dialogue/scenarios-corpus-1.json`](../../tests/evaluation/dialogue/scenarios-corpus-1.json), 16 vestlust ja 40 pööret, kirjutatud enne käivitamist.
  - 6 vestlust on `scenarios-1.json`-ist muutmata.
  - 10 uut käsitlevad jätkuküsimust, parandust, omavalitsuse vahetust, eri kuupäevade õigust, puuduvat asjaolu, uut isikut ja 27.09 vastuvõtutesti nõrku kohti.
- **Käivitus:** `scripts/rag-v2-conversation-eval.mjs` kasutab päris vestlusteenust (otsing, mudel ja kontrollid nagu tootmises).
  - Plaan `…-1048-r15c5ddd34`, korpus v33, mudel `gpt-6-luna` (`medium`).
  - Iga stsenaarium on omaniku kontol eraldi vestlus „Hindamine …“.
  - Aeg 28.09 11:11–11:22 UTC, hinnanguline kulu 0,19 USD.
- **Iga pöörde kontrollid** on masinloetavad ja jagunevad kolmeks:
  - `search`: õige allikas jõudis tõendisse;
  - `answer`: viidatud allikas, kohustuslik või keelatud tekst, täpsustus ja kuupäeval kehtiv tekst;
  - `state`: omavalitsus, kataloogi teenus, kontakt, kriis ja uue isiku puhas algus.
- Kõik pöörded koos vastuste, allikate ja kontrollidega on [käivitusaruandes](rag-v2-conversation-eval-2026-09-28-run1.md).

## Toortulemus (automaatne, muutmata)

| Tulemus | Pöördeid |
|---|---:|
| passed | **31** |
| search | 1 |
| answer | 6 |
| state | 2 |

## Käsitsi ümberhinnang (eraldi, põhjendustega)

Codexi ülevaatuse järgi jääb toortulemus 31/40 kehtima. Ümberhinnang on eraldi hinnang: kontroll oli kataloogis liiga kitsas, aga vastus ise õige.

| Pööre | Automaatne | Vastus | Hinnang |
|---|---|---|---|
| `mother-kose-corrected-harku` 3 | answer (`must_not: Kose`) | „Selge, arvestan nüüd Harku vallaga, mitte Kose vallaga.“ | õige: parandust kinnitav mainimine on lubatud |
| `appeal-follow-up` 3 | answer (`must`) | „…päevast, mil said keeldumisotsusest teada või oleksid pidanud teada saama. Tähtaja arvestamine algab järgmisel päeval.“ | õige (B9 parandatud): muster ei arvestanud sõnajärge |
| `care-home-correction` 1 | answer (`must`) | Omavalitsus katab hooldustöötajate töö kulud; sissetulekust sõltuv hüvitis | õige (B4 parem): muster oli liiga kitsas |
| `law-on-dates` 4 | answer (`valid_on`) | „31. oktoobril 2026 kehtinud tasu ma selle teabe põhjal kinnitada ei saa …“ | aus puudujäägi tunnistamine, mitte vale kehtiva õiguse esitamine. Codex: `valid_on` ei saa seda automaatselt veaks lugeda |

Ümberhinnangu järgi on õigeid pöördeid **35/40**. Kataloogi järgmises versioonis need kontrollid parandatakse. Esimene versioon jääb muutmata, et toortulemust saaks korrata.

## Päris vead ja põhjused

1. **Kuupäev küsimuses** (`law-on-dates` 1 ja 3).
   - `dateCandidates` tundis ainult ISO-kuupäevi ja aastaid. Lausest „1. märtsil 2027“ jäi alles aasta 2027.
   - Kehtivusreegel lubas seetõttu SHS-ist tänase ja kõik 2027. aasta redaktsioonid, kokku neli peaaegu samasugust teksti.
   - Mudel sai tänase ja aprilli–detsembri 2027 redaktsiooni, aga mitte 1.3.2027 kehtivat.
   - Tuvastatud periood jõudis kohale alles järgmises pöördes mudeli olekust ja jäi kehtima ka küsimusele „Aga praegu?“.
   - **Parandus:** [ADR-041](../rag-v2/adr-041-exact-dates.md).
2. **Tartu vald, mitte Tartu linn** (`tartu-parish-not-city` 1).
   - Piirkonna tuvastus nägi mõlemat nime (`ambiguous_region`), seega kataloogi ei kasutatud.
   - Eitust „mitte Tartu linnas“ see ei arvesta. Vastuvõtutestis oli sama viga G8.
3. **Abivahendi määrus** (`hearing-aid-cap` 1).
   - Tänasel kuupäeval kehtiv „Abivahendite loetelu …“ (01.09.2025–30.09.2026) ei jõudnud tõendisse. Tõendis oli ainult kaks allikat: abivahendite teatmik 2025 ja SHS.
   - Vastuses puudub piirhind, nagu vastuvõtutesti C9-s.
   - Kaotuse koht, kas kandidaatide järjestus või rerank'i valik, on veel välja selgitamata.
4. **Kellele helistada** (`money-harku-contact` 3).
   - Eelmine vastus valis mõistlikult toidupanga. Toidupanga kirjel pole kataloogis kontaktisikut ja vastus ütles seda ausalt.
   - Parem oleks anda omavalitsuse sotsiaalvaldkonna üldkontakt.
   - Kataloogi ootus („Toimetulekutoetus“) oli liiga kitsas.

## Mis töötas

- Parandus Kose → Harku.
- Uus isik ilma eelmise isiku andmeteta.
- Kriisiteade.
- Kolimine Tallinnast Rae valda.
- Täpsustus ebamäärasele küsimusele.
- Lastekaitseseaduse teatamiskohustus.
- Esimene samm enne täpsustust inimesele, kel pole ööbimiskohta.
- Vaide tähtaeg ja selle algus.
- Hooldekodu omaosaluse põhimõte.

## Järgmised sammud

1. ADR-041 (kuupäevad) ja seejärel `law-on-dates` kordamine.
2. Tartu eitus.
3. Abivahendi määruse kaotuse koht kandidaatides või rerank'is.
4. Omavalitsuse üldkontakt.
5. Kataloogi 2. versioon ja kogu vestluste komplekti kordamine.
