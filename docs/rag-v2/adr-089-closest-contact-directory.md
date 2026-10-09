# ADR-089 — Lähim kontaktide kirje avatakse lähimate kirjete kõrval

05.10.2026. Teostus Claude Opus 5.5. Omanik 05.10: „teeme need tugevaks“ (viiest tööst teine ja esimene: Tallinna ja Narva kontaktid; mõõtmata muudatused). Lähtekoht: töö lõpu mõõtejooks ([tõend](../audits/evidence/strengthening-measured-2026-10-05.json)), [ADR-085](adr-085-contacts-from-the-register.md), [ADR-086](adr-086-compact-linked-contact.md).

**Töös alates #385. Kontrollitud mudelita (jaotis „Kontroll“) ja mõõdetud mudeliga 14 pöördega (jaotised „Mõõtmine“ ja „Mõõtmine 2“): Tallinnas ja Narvas annab vastus nüüd kontakti ja kanalid on selle inimese omad. Lahti: Luna pakub kontakti nüüd peaaegu igas omavalitsuse vastuses, ka küsimata (omaniku otsus); Tallinna üldine kirje jätab ruumi ühele kokkuvõttele; kohmakas lisalause ameti kohta.**

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
- **Mida need viis pööret ei näita:** kokkuvõtete vähenemise mõju teistele vastustele; Tallinna küsimus, mis linnaosa ei nimeta. Mõlemad mõõdeti samal õhtul (järgmine jaotis).

## Mõõtmine 2 (05.10 õhtu, omaniku korraldus „tee teised mõõtmised“; üheksa pööret sellest reeglist, versioon `add0624c`)

[Tõend](../audits/evidence/open-points-measured-2026-10-05.json); kontakti nimetavad vastused on tõendist välja jäetud ja loetud serveris nimesid näitamata. Kõik üheksa pööret läbisid kataloogi kontrollid.

- **Tallinn ilma linnaosata** (`scenarios-strengthening-2`): avati linna üldine kontaktide kirje (12 inimest). Vastus ütles, et otsustab tegeliku elukoha linnaosa, **ei andnud ühegi linnaosa kontakti** ja küsis linnaosa. Kirje võttis aga peaaegu kogu kokkuvõtete ruumi: kokkuvõtteid jäi 1 (linnaosaga küsimuses enne reeglit 9, reegliga 4).
- **Viis igapäevaküsimust** (`scenarios-municipal-tone-1`; Tartu vald, Kose, Harku): iga vastus nimetab ühe või kaks sotsiaaltöö spetsialisti telefoni või e-postiga. Kolmes küsiti, kuhu pöörduda või kellele helistada; kahes ei küsitud („raha on otsas ja toiduks ei jätku“, „vajan emale kodus abi“) ja kontakt anti esimese sammuna. Summad ja tingimused on vastustes alles (koduteenuse tunnihind, toidupank, vältimatu abi).
- **Sama vestlus enne ja pärast** (Nõo → Maardu → Nõo; võrdlus sama päeva esimese jooksuga enne reeglit). Kokkuvõtteid 24, 42, 24 → 20, 30, 20. Teine ja kolmas vastus ütlevad sama palju või rohkem (kolmas kirjeldab nüüd teenust, enne andis ainult lehe aadressi). **Esimene vastus nimetab kaks abi liiki vähem** (toimetulekutoetust ja vältimatut sotsiaalabi enam ei mainita). Üks jooks kummastki: kas see on reegli mõju või juhus, ei saa selle põhjal öelda.
- **Kanalid:** kõigis kaheksas kontaktiga vastuses kuulub iga telefon ja e-post inimesele, keda vastus nimetab (pöördekirjest). Nimetatud ametid on sotsiaaltöö spetsialistid; koduhooldustöötajat ega muud teenuse osutajat seekord ei valitud.
- **Kokkuvõte:** reegel teeb seda, milleks ta tehti, ja rohkemgi: Luna lõpetab nüüd peaaegu iga omavalitsuse vastuse nimelise ametniku kontaktiga, ka siis, kui seda ei küsitud.

## Lahti

- **Juhise täpsustus** (omaniku otsus): kas Luna pakub kontakti ainult siis, kui inimene küsib, kelle poole pöörduda, või ka esimese sammuna (praegu peaaegu alati); lisalause ärajätmine; ameti valik (pigem see, kes taotlusi vastu võtab või otsustab, või üksuse üldkontakt). Vajab juhise uut versiooni ja paari pöörde mõõtmist.
- ~~**Kontaktide kirje maht suures omavalitsuses:** Tallinna üldine kirje jättis ruumi ühele kokkuvõttele.~~ Lahendatud 09.10.2026: kirje jääb ainult siis, kui sellega jääb alles vähemalt kolmandik kokkuvõtetest ([ADR-121](adr-121-directory-does-not-crowd-out-summaries.md)).
- Kas kokkuvõtete vähenemine jätab vastusest abi liike välja (üks kolmest võrdlusest viitab sellele), vajab mitut jooksu samal küsimusel.

## Auditipaketi piir (06.10.2026)

**Leid päris lehel:** küsimus „Mu eakas isa elab Tallinnas ega saa enam üksi hakkama. Kuhu pöörduda ja mis abi on võimalik?“ lõppes 7,9 sekundiga veaga `audit_packet_too_large`, enne kui vastust küsiti. Leitud 06.10 vestlusaknas mõõtes.

- Pöörde salvestatav pakett tohtis olla kuni 512 000 baiti.
- Tallinna kirjete kanal üksi võtab 461 055 baiti: 98 kirjet (71 teenust, 14 kontaktide kirjet, 11 kontakti, 2 vormi). Kontaktide kirjed ja kontaktid lisandusid korpusega v57 ([ADR-086](adr-086-compact-linked-contact.md)) ja lähima kirje avamisega (see ADR).
- Viie teadmislõiguga oli pakett 519 264 baiti. Mõõdetud tasuta kordusega sama pöörde salvestatud päringu ja vektoriga, mudelit kutsumata.
- Seega katkes Tallinnas iga pööre, kus teadmiskanal andis rohkem kui paar lõiku. 05.10 mõõdetud Tallinna pöörded mahtusid napilt alla piiri.

**Parandus:** piir on 1 000 000 baiti (`AUDIT_PACKET_BYTES`). See peab mahutama suurima omavalitsuse kirjed ja teadmiskanali selle kõrval; teadmis- ja perioodikanal lisavad oma piiride juures umbes 180 000 baiti. Piir on kaitse lahti jooksnud paketi vastu; mudelile mineval kontekstil on omad mahupiirid, mida see ei muuda.

**Lahti (lahendatud allpool):** pakett kannab iga kirje kohta palju korduvat. Salvestatava kuju kokkusurumine oli eraldi töö.

## Paketi kokkupakitud salvestuskuju ja piiri regressioonitest (06.10.2026)

Omaniku korraldus 06.10 („teeb need ära?“ sõltumatu ülevaatuse kahe tehnilise soovituse kohta): Tallinna paketi regressioonikontroll ja salvestusvormi korduste vähendamine.

**Mis paketis kordub** (mõõdetud 06.10 suurimal salvestatud paketil: Tallinn, 98 kirjet ja 6 teadmislõiku, 543 578 baiti):

| Osa | Baite | Mis seal kordub |
|---|---|---|
| Tõendikirjed (`evidence`) | 279 670 | iga kirje lõikude ja asukohtade loend, päritolumärked |
| Viitekaart (`reference_map`) | 172 614 | sama kirje tunnused, lõigud ja asukohad teist korda |
| Mudeli kontekst (`model_context`) | 51 010 | iga lõigu tekst teist korda |
| Kirjete kontekst (`record_context`) | 33 261 | |

**Otsus:** pakett salvestatakse kokkupakitult (`lib/rag-v2/pilot/packed-json.js`). Iga korduv osa (alampuu või pikk tekst) on tabelis üks kord ja tema asemel seisab viide. Midagi ei jäeta välja ega kirjutata ümber: lahtipakkimine annab täpselt sama paketi. Viitekaarti ei arvutata lugemisel uuesti, vaid see taastub salvestatust; nii ei sõltu vana pöörde auditeeritavus hilisemast koodist.

- **Kaks astet.** #403: rakenduse lugemisteed (pood, vestluse marsruut, kontekstikordus, hindaja) avavad paketi enne lugemist (`openTurn`), salvestus jäi samaks. See muudatus: pood kirjutab paketi kokkupakitult. Kirjutava väljalaske saab tagasi pöörata väljalaskele, mis kokkupakitud kuju loeb. **Alumine piir on #403 (`edde1119`):** sellest vanem väljalase ei loe pärast 06.10 salvestatud pakette, ja juurutuse tagasipööramine andmebaasi tagasi ei pööra. Serveri abiskriptid kaustas `st/` ei kuulu rakenduse lugemisteede hulka (vt „Lahti“). Enne 06.10 salvestatud pöörded on pakkimata ja loetakse nagu enne.
- **Piir loeb paketti nii, nagu pööre selle tegi**, mitte kokkupakitult. Lahti jooksnud pakett ei pääse läbi sellepärast, et ta pakituna piiri alla mahub.
- **Mida see ei muuda:** mudelile minev kontekst, päring ja kõik kontrollid loevad pakkimata paketti. Pöörde reas on peale paketi veel saadetud päring (umbes 68 000 baiti pöörde kohta) ja ülejäänud väljad, sealhulgas päringu vektor (kokku umbes 74 000); need jäid samaks. Päringu sees on kontekst tekstina; seda ei saa paketiga ühiseks teha, sest andmebaas järjestab paketi võtmed ümber ja päringu täpne tekst peab säilima.

**Mõõdetud ainult lugedes, 06.10 mõõtmise 45 lõpetatud pöördel serveris:**

| Mis | Enne | Kokkupakitult |
|---|---|---|
| 45 paketti kokku | 9,31 MB | 5,41 MB (42% vähem) |
| Tallinna pakett | 543 578 baiti | 351 099 baiti (35% vähem) |
| Iga pakett pärast lahtipakkimist sama | | jah, kõik 45 |
| Pikim pakkimine / lahtipakkimine | | 33 ms / 6 ms |

Pöörde terve rida oli nendel pööretel kokku 16,3 MB; pakkimine võtab sellest umbes 3,9 MB.

**Regressioonitest.** `tests/fixtures/rag-v2-municipal-packet.mjs` teeb Tallinna paketi kuju ja suurusega sünteetilise paketi (samad võtmed, 98 kirjet ja 6 lõiku, tunnused sama pikad; kontekst ja viitekaart tehakse päris projektsiooniga; ühtegi päris nime ega teksti selles ei ole). See on 572 345 baiti: üle vana piiri (512 000), alla praeguse.

- Andmebaasitest (`tests/rag-v2-pilot-store.test.mjs`, kohalik testandmebaas): selline pakett läbib terve pöörde (mahukontroll, viidete kontroll, vastusekutse, salvestus), on reas kokkupakitult, avaneb täpselt samana ja sama päringu kordus taastab pöörde salvestatust. Kahekordse kirjete arvuga pakett (1 069 165 baiti) peatab pöörde veaga `audit_packet_too_large` enne vastusekutset, kuigi pakituna oleks ta piiri all.
- Ühiktestid (`tests/rag-v2-packed-json.test.mjs`, käivad tavalises testikomplektis): pakkimine on kadudeta ka pärast andmebaasi võtmete ümberjärjestust; iga tee, mida mööda rida poest väljub, annab avatud paketi; pood kirjutab paketi kokkupakitult; vigane pakitud väärtus annab vea, mitte vale paketi.

**Kontrollimata:** päris pööre päris lehel pärast teist astet (tasuline; luba ei ole küsitud). Kaks integratsioonitesti faili, mis vajavad EstNLTK-d, ei käinud kohalikus keskkonnas (`morphology_unavailable`); nende ridade lugemine on muudetud sama avamise peale.

**Lahti:** saadetud päring ja päringu vektor on nüüd koos pöörde rea suurim osa (mõõdetud 06.10: päring 72 KB, vektor 64 KB pöörde kohta). Need ja viitamata tõenduse laseb lahti kõhn pöördekirje, [ADR-093](adr-093-lean-turn-record.md). Serveri lugemisskriptid (`st/`) lugesid paketti otse; 06.10 viidi 16 skripti ühisele kliendile (`st/st-prisma.mjs`), mis avab iga pöörde rea nagu rakenduse lugejad (`openTurn`). Kontrollitud: klient annab viimased viis pööret ja ühe tunnuse järgi loetud pöörde avatud paketiga.
