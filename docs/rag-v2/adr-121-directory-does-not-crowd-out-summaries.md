# ADR-121: kontaktide kirje ei tõrju abi kokkuvõtteid välja

Kuupäev: 09.10.2026. Teostus Claude Opus 5.5. Omanik: „Do this task here: Tallinna üldkataloog ei tõrju kokkuvõtteid välja“. Seis: **serveris alates 09.10.2026 kell 23.20 (väljalase `20e68d52`); mõõdetud tasuta 63 salvestatud pöörde kordusega ja samal ööl 12 päris pöördega (0,0659 USD).**

## Probleem

Kui küsimus järjestab omavalitsuse kirjeid, avatakse kolme lähima kirje kõrval ka lähim kontaktide kirje ([ADR-089](adr-089-closest-contact-directory.md)). Selle ruum tuleb lähimate kirjete **kokkuvõtetelt**. Tallinna küsimusel, mis linnaosa ei nimeta, avati linna üldine kontaktide kirje (12 inimest) ja kokkuvõtteid jäi 1; ilma selleta mahub 9. Tallinna inimene, kes linnaosa ei nimetanud, kuulis seetõttu ühest abi liigist seal, kus teise omavalitsuse inimene kuuleb mitmest. Kirje jäeti seni välja ainult siis, kui see oleks lõiganud pealkirjade loendit, mitte kunagi kaotatud kokkuvõtete pärast (ADR-089, „Lahti“).

## Mõõtmine enne reeglit (tasuta, 09.10.2026)

Et mitte teha reeglit ühe juhtumi põhjal, kordasin serveris testkonto salvestatud pöörete kirjeotsingu: iga pöörde enda salvestatud päringuvektori, sõnumite ja omavalitsusega, mudelit ja vektoriostu kasutamata. 232 lõpetatud pöördest oli omavalitsus 82-l; pärast korduvate küsimuste ühekordset lugemist jäi **63 pööret 15 omavalitsusest**. Töötava koodiga andis kordus igal pöördel sama vaate ja sama kokkuvõtete arvu, mis pöördes salvestatud (63/63), nii et kordus on päris pöördega sama.

Sama kordus koodiga, mis kontaktide kirjet kunagi ei ava:

| | Pöördeid |
|---|---:|
| Kontaktide kirje avati | 59 (14 omavalitsuses) |
| Kirje võttis kokkuvõtteid ära | 59 |
| Kirjega jäi alla 2 kokkuvõtte | 1 |
| Kirjega jäi alla 6 kokkuvõtte | 4 |
| Kirjega jäi alla kolmandiku sellest, mis ilma mahuks | **1** (Tallinn: 1 üheksast) |
| Kirjega jäi alla poole | 5 |

Madalaimad osakaalud pärast Tallinna juhtu: Saaremaa 4 üheteistkümnest ja 5 neljateistkümnest (36%), Tallinn linnaosaga 4 üheksast (44%; see on ADR-089 mõõdetud pööre, kus vastus nimetas õigesti linnaosa osakonna). Üks juhtum eristub selgelt, teised on tihedalt koos.

Varem tegin sama mõõtmise ka sõnaotsinguga üksi (kõik 78 omavalitsust, kolm küsimust). See ei kõlvanud: ilma vektorita on asjakohaseid kirjeid vähe ja kokkuvõtete arv ei sõltu enam ruumist. Jätsin selle kõrvale.

## Otsus

Kirjekanal `record-catalogue-5`: **kui kontaktide kirje kõrvale jääb alla kuue kokkuvõtte, tehakse sama vaade ka ilma kirjeta, ja kirje jääb ainult siis, kui sellega jääb alles vähemalt kolmandik kokkuvõtetest, mis ilma selleta mahuks** (`directoryCrowdsOut`, `lib/rag-v2/search/structured-record-source.js`).

- **Kolmandik**, mitte kindel arv: osakaal kehtib ühtmoodi suure ja väikese kataloogi kohta. Mõõdetud pööretest jääb alla selle üks.
- **Alla kuue**: teine sobitamine võtab pöördelt aega, nii et seda tehakse ainult seal, kus kokkuvõtteid on vähe. Kuue ja enama kokkuvõttega vaadet uuesti ei vaadata.
- Ülejäänu on nagu enne: kirje on esimene, mis välja jääb, kui pealkirjade loend muidu lõigataks; kolm lähimat kirjet ja kõik pealkirjad jäävad; kontakti otsused tehakse ainult näidatud kontaktide kohta ([ADR-086](adr-086-compact-linked-contact.md)).
- Paketi kuju ei muutu; varasem versioon jääb loetavaks.

## Mõõtmine pärast reeglit (tasuta, samad 63 pööret, muudetud kood töötava väljalaske peal)

| | Enne | Pärast |
|---|---:|---:|
| Pöördeid, kus kirje avati | 59 | 58 |
| Muutunud pöördeid | | **1** |
| Tallinn, linnaosata: kokkuvõtteid | 1 | 9 |
| Tallinn, linnaosata: näidatud kontakte | 12 | 0 |
| Tallinn, linnaosata: pealkirju loendis | 85 / 85 | 85 / 85 |
| Kõigi 63 korduse aeg kokku | 49,7 s | 54,1 s |

Ülejäänud 62 pööret on täpselt samad mis enne.

## Mida see ei tee

- **Tallinna linnaosata küsimus ei saa enam üldise kirje kontakte.** Mõõdetud vastus neid ei kasutanud: see ütles, et otsustab tegeliku elukoha linnaosa, ei andnud ühegi linnaosa kontakti ja küsis linnaosa (ADR-089, „Mõõtmine 2“). Linnaosa nimetav küsimus saab oma linnaosa kirje nagu enne.
- Ei vasta küsimusele, kas kokkuvõtete vähenemine üldse jätab vastusest abi liike välja (ADR-089, „Lahti“): reegel püüab kinni ainult äärmuse.

## Kontrollitud

- Ühiktestid: 1257, neist 1235 läbi ja 22 vahele jäetud (enne uut testi); uus test hoiab reeglit mõõdetud arvudel ja piiridel.
- Kohalike teenustega kirjekanali test (`tests/rag-v2-structured-records.integration.test.mjs`): 9/11; ADR-089 test (kirje avatakse, on märgitud, jääb esimesena välja) läbib muutmata. Kaks läbimata testi vajavad eesti keele morfoloogiat, mida selles arvutis ei ole; need ei puuduta kirjekanalit.
- Serveri kordus enne ja pärast (tabelid eespool).

## Mõõdetud päris vastustega (09.10.2026 öösel, omaniku luba testimiseks)

Kaks haru samade küsimustega: töötav väljalase (reegel sees) ja mõõtmiskoopia, kus reegel on välja lülitatud. Vastuseid ei loetud tekstina (vastus võib nimetada ametnikku), vaid loendati kindla sõnaloendi järgi, mitut abi liiki vastus nimetab.

| Küsimus | Haru | Kontaktide kirje | Abi liike vastuses (kaks korda küsitud) |
|---|---|---|---|
| „Elan Tallinnas. Mu ema ei saa enam üksi kodus hakkama. Mis abi on võimalik?“ | reegliga | avati (11 inimest) | 5 ja 1 |
| | reeglita | avati (11 inimest) | 4 ja 3 |
| „Elan Tallinnas ja raha on otsas, toiduks ei jätku. Kust abi saab?“ | reegliga | avati (7 inimest) | 2 ja 3 |
| | reeglita | avati (7 inimest) | 3 ja 2 |
| „Elan Tallinnas ja tahan taotleda toimetulekutoetust. Kelle poole ma pöörduma peaksin?“ | reegliga | **ei avatud** | 1 ja 0 |
| | reeglita | avati (12 inimest) | 1 ja 0 |

- Kahel tavalisel küsimusel reegel ei rakendunud: kirje kõrvale jäi piisavalt kokkuvõtteid ja mõlemad harud käitusid samamoodi. Erinevus abi liikide arvus (11 ja 12 nelja vastuse peale) on mudeli kõikumine.
- Küsimusel, mis vea esile tõi, reegel rakendus mõlemal korral. **Vastustes ei olnud näha ei kahju ega kasu:** kummaski harus ei andnud ükski vastus telefoni ega e-posti ja abi liike nimetati sama palju. See küsimus küsib, kelle poole pöörduda, mitte mis abi on.
- Kokku 12 pööret, 0,0659 USD.

**Järeldus:** reegel teeb kirjekanalis seda, milleks ta tehti (9 kokkuvõtet 1 asemel), ega muuda tavalisi Tallinna küsimusi. Et see teeks vastuse paremaks, ei ole nende pööretega näidatud.

## Kontrollimata

- Omavalitsused, mille kohta salvestatud pöördeid ei ole (63 omavalitsust 78-st): reegel on üldine, kuid mõõdetud on 15.
