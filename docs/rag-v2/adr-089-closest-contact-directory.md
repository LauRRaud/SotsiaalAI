# ADR-089 — Lähim kontaktide kirje avatakse lähimate kirjete kõrval

05.10.2026. Teostus Claude Opus 5.5. Omanik 05.10: „teeme need tugevaks“ (viiest tööst teine ja esimene: Tallinna ja Narva kontaktid; mõõtmata muudatused). Lähtekoht: töö lõpu mõõtejooks ([tõend](../audits/evidence/strengthening-measured-2026-10-05.json)), [ADR-085](adr-085-contacts-from-the-register.md), [ADR-086](adr-086-compact-linked-contact.md).

**Töös alates #385. Kontrollitud mudelita (jaotis „Kontroll“) ja mõõdetud mudeliga viie pöördega (jaotis „Mõõtmine“): Tallinnas ja Narvas annab vastus nüüd kontakti ja kanalid on selle inimese omad. Kaks nõrka kohta jäi: kohmakas lisalause ameti kohta ja kontakti pakkumine seal, kus seda ei küsitud.**

## Mida mõõtmine näitas

Töö lõpu jooksus (15 pööret, 0,080 USD) küsiti kontakti kolmes omavalitsuses.

| Küsimus | Näidatud kontakte | Vastus |
|---|---|---|
| Antsla: „kellega saan sotsiaaltoetuste asjus ühendust võtta?“ | 8 | andis telefonid ja e-posti; kõik üheksa kanalit on kontekstis olemas |
| Tallinn, Lasnamäe: „tahan taotleda toimetulekutoetust, kelle poole pöörduda?“ | 0 | nimetas osakonna, kontakti ei andnud |
| Narva: „ema vajab koduteenust, kellele helistada?“ | 0 | nimetas ameti ja ütles, et telefoninumbrit tal ei ole |

Põhjus on pöördekirjetes näha.

- Kontaktide kirje inimesi näidatakse ainult siis, kui kirje on avatud, ja avatakse küsimusele kolm lähimat kirjet.
- Kontaktide kirje tekst on nimed ja ametid. Teenuse kohta küsides on kolm lähimat alati teenused: õige kontaktide kirje oli asjakohasuse järjestuses Tallinnas 21. (Lasnamäe) ja Narvas 22. (Sotsiaalabiamet), Nõos 32.
- Antslas küsiti kontakti otse ja kirje oli teisel kohal.
- Kontaktide kirjete endi seas oli õige kirje mõlemas pöördes esimene.

[ADR-086](adr-086-compact-linked-contact.md) tõi Tallinna kontaktid vestluse andmetesse ja tegi kontakti odavamaks; päris küsimuses jäid nad ikka näitamata.

## Otsus

1. **Kirjekanal `record-catalogue-4`:** kui küsimus järjestas kirjeid, avatakse kolme lähima kirje kõrval ka **lähim kontaktide kirje** (allika liik `municipal_contact_directory`, nagu registri eksport selle märgib). Kirje, mis on juba kolme lähima seas või küsitud detailina, jääb selleks, mis ta on.
2. **Märgis `contact_directory`.** Avatud kontaktide kirje ei ole „üks lähimatest kirjetest“ ja seda ei nimetata nii.
3. **Esimesena välja.** Kui vaade koos kontaktide kirjega lõikaks pealkirjade loendit, proovitakse uuesti ilma selleta; alles siis vähem täiskirjeid.
4. **Dialoogi juhis 27** (ainult kirjetega): `contact_directory` on omavalitsuse kontaktide loend, avatud selleks, et vastusel oleks kedagi nimetada, kui inimene peab teadma, kelle poole pöörduda; inimene valitakse ameti järgi ja kellegi kohta ei öelda, et ta selle asjaga tegeleb, kui amet seda ei ütle.

### Miks nii

- **Üldine reegel, mitte sõnade järgi.** Server ei otsusta küsimuse sõnade põhjal, kas inimene tahab kontakti. Kirje on kontekstis; kas ja keda nimetada, otsustab vastuse mudel ameti järgi.
- **Õige kirje valib sama järjestus.** Lasnamäe küsimusele oli lähim Lasnamäe kirje, Narva koduteenuse küsimusele Sotsiaalabiameti oma.
- **Kontakti otsused jäävad näidatud kontaktidele** (ADR-086): avatud kirje inimesed otsustatakse, teised mitte.

### Hind

Kontaktid mahuvad samasse 12 000 tokeni sisse, mis enne; ruum tuleb lähimate kirjete **kokkuvõtetelt**. Pealkirjad ja kolm täiskirjet jäävad.

## Kontroll

- `tests/rag-v2-structured-records.integration.test.mjs` (kohalikud teenused, 11/11): teenuse küsimus avab kolm teenust ja kontaktide kirje kahe inimesega; mudel näeb märgist, inimeste nime ja ametit ning kanaleid tõenditekstis; kirje, mis on ise lähimate seas, on tavaline täiskirje; kitsama mahu korral jääb kontaktide kirje esimesena välja ja kolm täiskirjet koos kõigi pealkirjadega jäävad.
- `tests/rag-v2-answer-prompt.test.mjs`: juhis 27 erineb 26-st ühe lausega ja ainult kirjetega.
- Kogu testikomplekt (680 läbis, 0 kukkus).
- **Päris andmed, mudelita** (05.10, korpus v58): seitsme mõõdetud pöörde kirjeotsing korrati pöörde enda salvestatud päringuvektoriga. Töötava versiooni koodiga andis kordus sama, mis mõõdetud pööre (samad kolm täiskirjet, sama arv kontakte). Muudetud koodiga:

| Pööre | Kontakte enne → pärast | Avatud kontaktide kirje (koht järjestuses) | Kokkuvõtteid enne → pärast | Aeg ms enne → pärast |
|---|---|---|---|---|
| Tallinn, Lasnamäe | 0 → 11 | Lasnamäe Linnaosa Valitsus (21.) | 9 → 4 | 2135 → 2379 |
| Narva | 0 → 7 | Sotsiaalabiamet (22.) | 12 → 8 | 1095 → 1168 |
| Antsla | 8 → 8 | (oli juba lähimate seas) | 12 → 12 | 928 → 855 |
| Nõo, „kust abi saan“ | 1 → 7 | Nõo vald (32.) | 24 → 20 | 763 → 862 |
| Maardu | 0 → 10 | Maardu linn (43.) | 42 → 30 | 803 → 936 |
| Nõo, „minu vallas“ | 1 → 7 | Nõo vald (40.) | 24 → 20 | 476 → 574 |
| Põhja-Sakala, „mis muutub“ | 0 → 9 | Põhja-Sakala vald (10.) | 14 → 9 | 852 → 940 |

Kõigis seitsmes jäid kõik pealkirjad loendisse ja kontekst 12 000 tokeni sisse.

## Mõõtmine (05.10, omaniku loal; viis pööret, 0,028 USD, ülempiir 0,05)

Töötaval versioonil `3e2ac388` ([tõend](../audits/evidence/contact-directory-measured-2026-10-05.json); kontakti nimetavad vastused on tõendist välja jäetud ja loetud serveris nimesid näitamata). Kõik viis pööret läbisid kataloogi kontrollid.

| Pööre | Näidatud kontakte | Vastus |
|---|---|---|
| Tallinn, Lasnamäe, toimetulekutoetus | 11 (Lasnamäe kirje) | nimetab linnaosa sotsiaalhoolekande osakonna ja ühe sotsiaaltöö spetsialisti telefoni ja e-postiga |
| Narva, koduteenus | 7 (Sotsiaalabiamet) | annab ameti sekretäri kahe telefoninumbriga ja lisab lause, et ametinimetuse põhjal ei saa öelda, kas sekretär ise taotlusi menetleb |
| Antsla, sotsiaaltoetused | 8 | nagu enne: peaspetsialist ja spetsialist kanalitega |
| Põhja-Sakala, „mis muutub“ (kontakti ei küsitud) | 9 | **kontakti ei nimeta**; võrdleb muudatusi kujul „varem … nüüd“ |
| Tartu vald, „kuidas saada koduteenust?“ (kontakti ei küsitud) | 10 | kirjeldab taotlemist ja lõpetab kontaktiga: koduhooldustöötaja telefon ja e-post |

- **Kanalid:** igas vastuses on iga telefon ja e-post kontekstis olemas ja kuulub inimesele, keda vastus nimetab (kontrollitud pöördekirjest, mitte silma järgi).
- **Nõrk koht 1, lisalause (Narva):** juhise lause „ära ütle, et inimene asjaga tegeleb, kui amet seda ei ütle“ jõudis vastusesse piiranguna. See on juhise sõnastuse tagajärg.
- **Nõrk koht 2, küsimata kontakt ja ameti valik (Tartu vald):** vastus pakkus kontakti, kuigi seda ei küsitud, ja valis koduhooldustöötaja, kuigi sama vastus ütleb, et teenuse määrab sotsiaaltöö spetsialist. Kas esimese sammuna kontakti pakkumine on soovitud, on omaniku otsus; ameti valik on küsitav.
- **Mida need viis pööret ei näita:** kokkuvõtete vähenemise mõju teistele vastustele; Tallinna küsimus, mis linnaosa ei nimeta.

## Lahti

- **Juhise täpsustus** (omaniku otsus): kas Luna pakub kontakti ainult siis, kui inimene küsib, kelle poole pöörduda, või ka esimese sammuna; lisalause ärajätmine; ameti valik (pigem see, kes taotlusi vastu võtab või otsustab, või üksuse üldkontakt). Vajab juhise uut versiooni ja paari pöörde mõõtmist.
- Kontaktide kirje, mille tekst küsimusele kõige lähemal on, ei pruugi olla õige üksus, kui küsimus linnaosa ega teemat ei nimeta (Tallinnas 14 kirjet).
