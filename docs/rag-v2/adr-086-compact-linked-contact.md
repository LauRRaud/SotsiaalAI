# ADR-086 — Viidatud kontakt on kirjekontekstis kompaktne; otsus tehakse ainult näidatava kontakti kohta

05.10.2026. Teostus Claude Opus 5.5. Omanik 05.10: „teeme need tugevaks“ (viiest tööst teine: Tallinna kontaktid on vestlusest väljas, Narva ei andnud ühtki). Täiendab [ADR-085](adr-085-contacts-from-the-register.md) ja [ADR-025](adr-025-compact-record-model-context.md).

**Kood on kontrollitud kohalike testide ja päris andmete tasuta mõõtmisega (kirjekanal serveris, sõnaline järjestus, mudelita). Mudeliga mõõtmata.** Tallinna kontaktid jõuavad vestlusse alles järgmise ekspordi ja indeksiga (embedding'u ost).

## Lähteseis (mõõdetud 05.10 korpusel v56, ainult lugemine)

Küsimus „Kes on sotsiaaltöö spetsialist ja mis on tema telefon?“, kirjekanali kontekst 12 000 tokenit.

- **Näidatud kontakt võttis umbes 295 tokenit** (Narva, 18 kontakti): kirje väljad 154 (seitse välja, igaühel oma viide), tõenditekst 83 (samad väärtused teist korda, lisaks lehe aadress ja kontrolli aeg), allikakaart 32 (igal kontaktil oma, sama sisuga), seos 26 (iga viide eraldi reana).
- **Iga kirje allikakaart oli omaette**, kuigi ühe paketi teenustel ja ühe kontrolli kontaktidel on kaardil samad väärtused: Narvas 69 kaarti ja 1977 tokenit, Pärnus 75 kaarti ja 2095 tokenit.
- **Iga pööre otsustas omavalitsuse kõik kontaktid** (Tartus 80, Narvas 38), kuigi näidati kolme kirje omad.
- Kolme küsimusele lähima kontaktide kirje asemel mahtus seetõttu üks või kaks: Narvas 18 kontakti, Tartus 9, Pärnus 8. Tallinna (125 kontakti) eksport jättis välja ([ADR-085](adr-085-contacts-from-the-register.md)).
- **Narva „0 kontakti“ ei olnud andmeviga.** Varasem kontrollküsimus kasutas liitsõna „sotsiaaltööspetsialist“; Narva ametitekstides seda ei ole („spetsialist“, „vanemspetsialist“) ja tasuta kontroll järjestab kirjeid sõnade järgi, nii et kontaktide kirjed ei tulnud ette. Küsimusega „sotsiaaltöö spetsialist“ näitas sama indeks Narvas 18 kontakti. Päris vestlus järjestab kirjeid küsimuse vektori järgi; seda ei ole mõõdetud.

## Otsus

1. **Viidatud kontakti kuju** (`lib/rag-v2/search/structured-record-source.js`, kirjekanali leping `rag-v2/record-catalogue-3`). Kontakt, mis on kontekstis ainult teise kirje viite sihtmärgina, näidatakse ilma lehe aadressi ja kontrolli ajata: aadress on viitava kirje enda oma ja kontrolli aeg on kontakti allikakaardil. Tõenditekstis on ainult näidatud väljad: nimi, amet, osakond, telefon, e-post.
2. **Mudeli kontekst** (`lib/rag-v2/search/model-context.js`, `rag-v2/model-context-json-4`):
   - kontakti kirje nimetab inimese ja ameti; osakond, telefon ja e-post on tõenditekstis, millele kirje viitab (seesama tekst, mida kasutaja näeb allikana);
   - kirjed, mille allikakaardil on samad väärtused, jagavad ühte kaarti; muu tõendi kaart (artikkel, seadus) jääb dokumendi omaks;
   - ühe kirje viited mitmele kirjele on üks seos kõigi sihtmärkidega; kättesaamatud viited on üks rida arvuga.
   - Auditipakett hoiab kõik väljad ja viited nagu enne; muu kui kirjete tõendi kuju ei muutunud (test võrdleb varasema väljundiga bait-baidilt).
3. **Kontaktiotsus ainult näidatavale.** Kontakti luba küsitakse registrist siis, kui vaade teda näitaks (avatud kirje viite sihtmärk), üks kord pöörde jooksul ja teist korda enne paketi väljastamist nagu enne. Kokkuvõttevaadet, mis näitab kõigi kirjete kontakte, mõõdetakse kõigepealt ilma kontaktideta: kui see ei mahu, ei mahu see ka kontaktidega ja ühtki ei otsustata.
4. **Dialoogi juhis 25:** kirjete juhises üks lause juurde: kontakti kirje nimetab inimese ja ameti, osakond, telefon ja e-post on viidatud tõenditekstis. Ilma kirjeteta on juhis sama mis 24.
5. **Ekspordi piir 150** (oli 100; `LARGE_MUNICIPALITY`, `municipal-contact-export.js`). Piir tuleb kirjekanali enda piirist: see loeb ühe omavalitsuse kohta kuni 300 kirjet ja katkestab suurema juures kogu omavalitsuse raja, seega peavad kontaktid ja nende kirjed jätma ruumi teenustele (suurimates umbes sada: Tallinn 99, Pärnu 97, Narva 92).

## Mõõtmine päris andmetel (05.10, korpus v56, sama küsimus, mudelita)

Vana ja uus kirjekanal samal indeksil; uus kood käivitati serveris väljalaske peale laotud failidega, midagi kirjutamata.

| Omavalitsus | Näidatud kontakte | Kontaktiotsuseid | Kontekst, tokenit |
|---|---|---|---|
| Narva | 18 → 27 | 56 → 54 | 11 638 → 11 695 |
| Tartu | 9 → 31 | 89 → 62 | 11 667 → 11 839 |
| Pärnu | 8 → 25 | 65 → 50 | 11 847 → 11 791 |
| Tallinn (kontakte indeksis ei ole) | 0 | 0 | 11 766 → 11 332 |

- Kõigis kolmes mahuvad nüüd kõigi kolme lähima kontaktide kirje inimesed. Uued otsuste arvud on täpselt kaks näidatud kontakti kohta (otsus ja kordus enne väljastamist).
- **Näidatud kontakt võtab umbes 105 tokenit** (Narva: kirje 45, tõenditekst 55, seos ja kaart kokku umbes 5).
- Allikakaarte on Narvas 3 (enne 69), Pärnus 6 (enne 75).
- Kontekst on endiselt piiri lähedal, sest pealkirjade vaade täidab vaba ruumi küsimusele lähimate kirjete kokkuvõtetega; vabanenud ruum läks neile (Narvas toetuste kirjete osa 618 → 1348 tokenit).

**Kõik 78 omavalitsust** (sama indeks; iga omavalitsus küsimuseta ja sama küsimusega):

| | Vana kood | Uus kood |
|---|---|---|
| Vigu | 0 | 0 |
| Üle 12 000 tokeni | 0 | 0 (suurim 11 989) |
| Küsimusega: näidatud kontakte | 735 (75 omavalitsuses) | 844 (75 omavalitsuses) |
| Küsimusega: kontaktiotsuseid | 2120 | 1781 |
| Küsimuseta: näidatud kontakte | 11 (1 omavalitsuses) | 37 (3 omavalitsuses) |
| Küsimuseta: kontaktiotsuseid | 1396 | 148 |

Küsimuseta pöördes ei ava pealkirjade vaade ühtki kirjet, seega ei otsustata seal nüüd ühtki kontakti; 148 otsust on kolme omavalitsuse kokkuvõttevaate kontaktid.

## Testid

- `tests/rag-v2-record-catalogue-compact.test.mjs`: ühine kaart samade väärtuste korral ja oma kaart erineva korral; kontakti kirje ja seoste kuju; pakett hoiab kõik väljad.
- `tests/rag-v2-structured-records.integration.test.mjs` (kohalik Postgres ja Qdrant): kontakti tõenditekst ja kirje; otsuste arv kolmes vaates (kokkuvõte, pealkirjad ilma avatud kirjeta, pealkirjad küsimusega). Kaks selle faili testi olid aegunud alates #367-st (adapter loeb kontrollireeglit viieks sekundiks) ja on parandatud testi kellaga.
- `tests/rag-v2-register-contact-export.test.mjs`: 125 kontaktiga omavalitsus eksporditakse, 151-ga jäetakse välja.
- `tests/rag-v2-legal-dates.test.mjs`: seaduste ja artiklite kontekst on sama mis enne, ainult versioonisilt muutus.

## Piirid

- **Mudeliga mõõtmata.** Kas Luna loeb telefoni tõenditekstist kindlalt, näitab töö lõpu mõõtmisjooks.
- **Tallinna tegelik mahtumine on mõõtmata**, kuni tema kontaktid on indeksis. Arvutuslikult: 71 kirjet, umbes 27 kontaktide kirje pealkirja ja kolme avatud kirje kuni 36 kontakti mahuvad 12 000 tokeni sisse.
- Tasuta kontroll järjestab kirjeid sõnade järgi; päris vestluse vektorjärjestus võib avada teised kirjed.
- Auditipaketis on viidatud kontaktil kaks välja vähem kui enne (lehe aadress, kontrolli aeg); varasemate pöörete paketid loetakse nagu enne (`record-catalogue-2` on loetav leping).
