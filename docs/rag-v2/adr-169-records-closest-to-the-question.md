# ADR-169 — Kirjete kanal loetleb küsimusele lähimad kirjed, mitte kogu kataloogi (record-catalogue-6)

22.10.2026. Teostus Claude Opus 5.5. Omaniku valik pärast ADR-167 mõõtmist: „Jätta, kärpida, mõõta“. Tööpiirkond jääb ja
vastusesse läheb kataloogist ainult küsimusega seotud kirjed. Õhtul tehakse uus 75 küsimuse jooks samade piiridega.

## Leid (22.10, 75 küsimust, R3)

- **Mis vastusesse läks.** Igal pöördel, millel oli omavalitsus, sai vastus kaasa omavalitsuse kirjete vaate.
  - Vaates oli 50–70 kirjet: kogu kataloogi pealkirjad, 7–13 lähimat kirjet kokkuvõttega, 3 täies sisus, kontaktide
    kataloog ja nende lingid.
  - Kokku oli see umbes 10 000 vastuse sisendtokenit.
  - Spetsialisti ja teenuseosutaja pöördel lisandus see tööpiirkonnaga (ADR-167). Teenuseosutaja vastuse sisendi mediaan
    kasvas 17,6k → 22k tokenit.
- **Millele viidati.** 51 omavalitsusega pöördes viitasid vastused 38 kirjele:
  - 20 täies sisus kirjele;
  - 7 kokkuvõttega kirjele;
  - 3 küsitud kirjele;
  - 8 kontaktile või vormile, millele need lingivad.

  Ainult pealkirjana loetletud kirjele ei viidanud ükski vastus.
- **Kui palju pealkirjad mahust võtsid.** Ainult pealkirjana loetletud kirjed olid ~10% kirjete kanali tekstist. Põhimahu
  moodustavad täiskirjed, kokkuvõtted ja kontaktide kataloog.

## Otsus

- **Mida loetletakse.** Kui omavalitsuses on üle 16 kirje (`RELEVANT_LISTED`) ja küsimus järjestab kirjed, loetleb vaade:
  - küsitud kirjed;
  - 16 lähimat kirjet;
  - lähima kontaktide kataloogi.
- **Kuidas näidatakse.** Pealkirjavaates nagu suur kataloog alati:
  - lähimad kokkuvõttega;
  - kolm lähimat ja kataloog täies sisus koos linkidega.

  Ülejäänud kataloogi ei loetleta. Pakett ütleb seda välja (`completeness: "question_relevant_records_only"`,
  `catalogue_count` jääb kogu kataloogi arvuks).
- **Mis jääb endiseks:**
  - väike omavalitsus (kuni 16 kirjet);
  - pööre, mida küsimus ei järjesta;
  - eelarve ja täiskirjete valik.
- **Vastuse juhis ei muutu.** See ütleb juba, et kataloog pole kunagi omavalitsuse kõik teenused.
- **Versioon.** record-catalogue-6. Väljalase uuendab plaani ise (`approvedScope` ei loe kanali versiooni) ja catalogue-5
  jääb loetavaks.

## Kontroll

- **Kohalik andmebaas.** Sama küsimus läbi HEAD-i (catalogue-5) ja uue koodi, leksikaalne järjestus (kohalikult Qdranti
  pole):

| omavalitsus | küsimus | enne | pärast | vähem |
|---|---|---|---|---:|
| Tartu linn | „Kellele ma Tartus täpselt helistan …“ | 47/47 loetletud, 53 kirjet, 5774 tokenit | 16/47, 22 kirjet, 3999 tokenit | 31% |
| Tartu linn | „Kuidas peaksime teenuse osutamist dokumenteerima …“ | 47/47, 55, 11898 | 16/47, 24, 11342 | 5% |
| Narva linn | „Kas vald saab pere üürivõla ära maksta …“ | 47/47, 52, 9695 | 16/47, 21, 7996 | 18% |
| Viljandi linn | „Mis abi on ette nähtud noorele …“ | 39/39, 42, 3628 | 16/39, 19, 2292 | 37% |

- **Mis jäi alles.** Kõik, mida vana vaade täies sisus või kokkuvõttega näitas, ja kontaktide kataloog on igal juhul alles.
  Järjestuseta pöörde vaade on sama.
- **Oodatav mõju.** Kirjete kanali tokenid vähenevad 5–37%. See on umbes 1–2k vastuse sisendtokenit pöörde kohta.
- **Mõõtmine.** Õhtune 75 küsimuse jooks
  ([eelregistreering](../audits/vestlustest-2026-10-22-piirkond-eelregistreering.json), lisa „R4“).

## Parandus pärast F1 (22.10): 10 kirjet, mitte 16

- F1 jooksus said kõik 16 loetletud kirjet kokkuvõtte. Kirjete tekst kasvas: A19 12 800 märki, R3-s 11 600. Samade
  küsimuste vastuse sisend ei vähenenud.
- `RELEVANT_LISTED` on nüüd 10: kolm kirjet täies sisus ja ülejäänud kokkuvõttega.
- R3-s viidati kokkuvõttega kirjetele 7 korral. Nende järjekohta jälg ei näita, seega võib mõni neist jääda nüüd kümnest
  välja. F2 näitab, kas vastused viitavad kirjetele samamoodi.
- Kohalik andmebaas, 16 → 10 kirjet: kirjete kanal väheneb veel 4–24%. Täiskirjed ja kontaktide kataloog jäävad samaks.
