# ADR-127: liitsõna osa ei ole omavalitsuse nimi

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5 (kavandasid, ehitasid ja vaatasid üle agendid kolmes ringis; kolmanda ringi kaks viimast reeglit, serveri mõõtmised, otsused ja kontroll minult). Omanik 10.10.2026: „need on vist üsna olulised asjad?“ ja „tee iseseisvalt edasi“. Seis: **kood ja testid tehtud; mõõdetud tasuta serveris päris keeleanalüüsiga; mudeliga mõõtmata.**

## Probleem

Vestluse kohalugemine võrdleb omavalitsuse nime sõnu kasutaja sõna lugemitega. Keeleanalüüs annab liitsõnale peale sõna enda ja lemma ka selle osad: „Raekülas“ on `raekülas, raeküla, rae, küla`. Kohalugemine võttis iga lugemi sõna enda eest, nii et sõna osa valis omavalitsuse.

Mõõdetud serveris päris keeleanalüüsiga (10.10.2026), töötava koodiga:

| Kasutaja kirjutas | Loeti |
|---|---|
| „Elan Raekülas“ (Pärnu linnaosa) | Rae vald, elukohana |
| „Käisin raekojas abi küsimas“ | Rae vald |
| „Elan Pärnumaal“, „Elan Järvamaal“, „Elan Valgamaal“ | Pärnu linn, Järva vald, Valga vald |
| „Ema elab Tartumaal“, „Elame Viljandimaal“ | kaks varianti: linn või vald |
| „Tartumaa valdades on teenus erinev“ | Tartu vald |
| „Kasvatan tõrvalilli“, „Ostsin kanepiõli“, „Elan Kosejõe ääres“ | Tõrva vald, Kanepi vald, Kose vald |

Sama viga oli asulate lugemises ([ADR-103](adr-103-settlement-names.md)): „Harjumaal“ salvestati Hiiumaa vallaks (küla Harju kaudu) ja „Virumaal“ Rõuge vallaks (Viru küla kaudu).

## Otsus

**Sõna osa ei ole sõna enda lugem.** Lugem on liitsõna osa, kui sama sõna mõni teine lugem on kokku kirjutatav kahest või enamast sama sõna lühemast lugemist, see lugem nende seas (rae + küla = raeküla). Omavalitsuse nime sõna sobib kasutaja sõnaga ainult selle enda lugemite kaudu (`ownTerms`, `lib/rag-v2/pilot/record-scope.js`). Sama kehtib asulate lugemises. Sidekriips ühendab sõnu, mitte osi, ja sidekriipsuga nimede reegel jääb samaks.

Omavalitsuse enda nimi, mis on ise liitsõna, jääb alles: „Saaremaal“, „Sillamäel“, „Märjamaal“, „Rakveres“ on nimi ise, mitte selle osa.

**Kaks asja hoitakse meelega töös:**

- **Muhumaa ja Kihnumaa** on saar, mis ongi Muhu ja Kihnu vald. Need on nüüd valla enda nimed vestluse kohaloendis (`lib/rag-v2/adapters/municipal-directory.js`), nii et „Elan Muhumaal“ loetakse täpselt nagu „Elan Muhus“.
- **Linnaosa üksi:** Annelinn, Supilinn, Tammelinn ja Karlova (Tartu linn) ning Raeküla (Pärnu linn; sama nimega küla on ka Väike-Maarja vallas) on kohanimede loendis (`lib/help/locationAliases.js`), mida vestlus loeb enne ametlikke asustusüksusi. Üksi nimetatud linnaosa annab linna, kui otsinguplaan selle inimesega seostab.

**Proovitud ja välja võetud:** reegel, mis valis kahe sama nimega omavalitsuse vahel samas lauseosas nimetatud linnaosa järgi („Elan Tartus Annelinnas“ → Tartu linn). Sõltumatu kontrollija leidis, et see salvestab vale valla: „Elan Tartus Annelinnas ja töötan Tartu vallas“ andis elukohaks Tartu valla, „Elan Tartus mitte Annelinnas“ Tartu linna ja „Elan Tartus Kesklinnas“ plaani ühesõnalise seostusega Tallinna. Vale vald on halvem kui üks küsimus, seega jääb selline lause täpsustava küsimusega.

**Kaks väikest reeglit, et selline lause tõesti küsiks.** Liitsõna osa „linn“ sõnas „Annelinnas“ pani vana koodi juhuslikult küsima (see tegi nime „Tartu linn“ kõrvale teise kodu). Kui osad kadusid, oleks kaks vana rada salvestanud valla seal, kus enne küsiti. Seepärast:

- **Elamist tähendav tegusõna ütleb „elab“ ainult esimese koha kohta pärast seda** (`livingInClause`, `record-scope.js`). „Elan Nõos ja töötan Tartus“: kodu on Nõo, Tartu on muu koht. Enne ulatus „elan“ kõigi sama lauseosa kohtadeni, nii et „Elan Tartus ja töötan Tartu vallas“ salvestas elukohaks Tartu valla.
- **Lahtist jagatud nime ei jäeta kõrvale sellepärast, et sama sõnum annab teise kodu** (`checkedTurnPlaces`, `person-places.js`). „Elan Tartus Kesklinnas“, kui otsinguplaan tsiteerib ainult linnaosa: kohanimede loend annab Kesklinna Tallinnale, ja ilma selle reeglita salvestataks Tallinn. Nüüd küsib Luna üle.

## Mõõdetud (tasuta, serveris, päris keeleanalüüs)

- **Ükski omavalitsuse enda nimevorm ei kadunud:** 76 nimesõna 705 käändevormi (keeleanalüüsi enda sünteesitud) loetakse nagu enne.
- **861 teksti (need vormid, 177 proovisõna, 75 lauset) vana ja uue koodiga:** 66 loetakse teisiti, kõik oodatud kohtades: 34 liitsõna ja maakonnanime ei vali enam omavalitsust, 14 palvelauset loetakse nüüd küsimuseks ([ADR-128](adr-128-request-without-a-question.md)), ülejäänud on samade sõnade laused.
- **184 salvestatud testküsimusest 182, mis olid olemas ka enne, loetakse täpselt samamoodi** (0 erinevust).
- Päris keeleanalüüsiga testifail serveris: 5 testi 5-st.
- Pöörde tasemel (koha lugemine koos otsinguplaani kohtadega, salvestatud lugemitega): 334 pööret 109 lausest töötava koodi vastu. 214 annavad sama tulemuse, 67 lõpevad nüüd küsimusega või jäävad lahtiseks, 53 annavad teise kindla tulemuse; need 53 lugesin üle (liitsõnad ja maakonnad, palvelaused, Raeküla, linnaosad üksi, kodu ja töökoht ühes lauses).
- Ühiktestid jooksevad igas masinas salvestatud päris lugemitega (`tests/fixtures/rag-v2-recorded-terms.mjs`, 104 sõna).

## Hind ja piirid

- **Maakond ühe sõnana ei vali enam midagi:** „Elan Pärnumaal“ lõpeb täpsustava küsimusega. See on õigem kui Pärnu linn (inimene võib elada Tori vallas), aga on üks küsimus rohkem.
- „Sauevallas“ ja „Tartuvallas“ ühe sõnana ei loeta; kahe sõnana loetakse nagu enne.
- **Linn koos linnaosaga lõpeb täpsustava küsimusega:** „Elan Tartus Annelinnas“ loeti enne Tartu linnaks juhuslikult (osa „linn“ sõnast „Annelinnas“ täiendas nime „Tartu linn“). Nüüd küsib Luna, kas linn või vald, nagu ta küsis juba enne lause „Elan Tartus Karlovas“ peale. Sama kehtib Viljandi, Võru ja Rakvere kohta.
- **Linnaosa, mida plaan tsiteerib üksi linna nime kõrval, küsib samuti:** „Elan Tartus Annelinnas“ sellisel kujul lõpeb küsimusega, kuigi linnaosa on selle linna oma. See on teise reegli hind.
- **Kaks kodu ühes lauses ilma komata:** „Elan Nõos ja Elvas“ salvestab esimese (enne küsiti). See on esimese reegli hind; „Elan Nõos ja töötan Tartus“ on palju sagedasem.
- **Lahtine, mitte lahendatud:** kui plaan tsiteerib ühe koduna terve lause „Elan Tartus ja töötan Tartu vallas“, salvestatakse Tartu vald, sest täisnimi varjab samas sõnumis jagatud nime (see reegel loeb õigesti „Elan Tartus, täpsemalt Tartu vallas“). Nii oli see ka enne. Test hoiab seda kirjas piirina, mitte eesmärgina.
- Pooleli vestlus, mis salvestas valla liitsõna järgi, hoiab seda edasi.

## Kontrollimata

- Kas päris otsinguplaan seostab neid kohti nii, nagu testid eeldavad (vajab tasulisi pöördeid).
