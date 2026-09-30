# ADR-060 — Kasutamata versioonide otsinguindeksi koristus

30.09.2026. Teostus Claude Opus 5.5. Omanik 30.09: „korista ära: Qdrantis on alles umbes 9000 vana versiooni punkti, mida ükski indeks enam ei kasuta“. Järgib [ADR-036](adr-036-version-index.md) (versioonide paigutus).

## Probleem

- **Versiooni otsingumaterjali jagavad kõik generatsioonid, mis seda versiooni loetlevad.** Paigutuses `versions-v1` kuuluvad versioonile lõikude read (`rag_v2_version_unit`), pitser (`rag_v2_version_index`) ja Qdranti punktid ühes jagatud kollektsioonis.
- **Generatsiooni kustutamine (`drop-version-generations.mjs`) eemaldab ainult selle loendi.** Kui viimane versiooni loetlev generatsioon kaob, jäävad read, pitser ja punktid alles, kuigi keegi neid ei loe.
- 30.09 oli kollektsioonis 49 347 punkti, aktiivses indeksis umbes 40 000.
- **Pitserit ei tohi jätta ilma punktideta.** Indeksitöö kasutab pitseriga versiooni uuesti ilma punkte kirjutamata. Kui versioon hiljem tagasi tuleb (näiteks sama tekst uuesti), puuduksid tal otsinguvektorid.

## Otsus

`scripts/rag-v2-prune-versions.mjs --tenant T [--execute]` (teek `lib/rag-v2/search/prune-versions.js`):

- **Kandidaat** on versioon, mida ükski rentniku generatsioon ei loetle, olgu generatsiooni olek milline tahes.
- **Ilma `--execute`-ita tööriist ainult loendab:** versioonid, read ja punktid konfiguratsiooni kaupa.
- **Tööriist ei tee midagi, kui mõni rentniku generatsioon või indeksitöö pole valmis** (`prune_index_work_pending`). Seda kontrollitakse enne ja mõlema Postgresi tehingu sees.
- **Kolm sammu:**
  1. Kandidaatide pitserid lähevad tagasi olekusse `staged`. Indeksitöö ei loe neid siis valmis versiooniks ja kirjutaks versiooni vajadusel ise uuesti.
  2. Märgitud versioonide punktid kustutatakse filtriga (rentnik, konfiguratsioon, versioonid) ja loetakse üle; alles ei tohi jääda ühtegi.
  3. Kustutatakse `staged` olekus ja endiselt loetlemata versioonide read ja pitserid. Kui mõni märgitud versioon sai vahepeal loendisse, peatub tööriist (`prune_version_listed_meanwhile`).
- **Katkestus** jätab `staged` pitserid, mida ükski generatsioon ei loetle. Järgmine jooks jätkab neist.
- **Kataloog jääb puutumata** (`rag_v2_version`, `rag_v2_object`, hoidla). Kui versioon tuleb tagasi, kirjutab indeksitöö selle indeksi uuesti.

## Kontroll

`tests/rag-v2-prune-versions.integration.test.mjs` käib kohaliku Postgresi ja Qdrantiga (`node scripts/rag-v2-local.mjs up`):

- versioon, mida generatsioon veel loetleb, jääb;
- loendamine ei muuda midagi;
- ootel indeksitöö korral tööriist keeldub;
- Qdranti kustutamise katkestus jätab pitseri `staged` olekusse ja punktid alles, kordusjooks lõpetab töö;
- kustutatakse ainult kasutamata versiooni read, pitser ja punktid, kataloog jääb;
- loetletud versioonid on otsitavad ja `verifyIndexJob` läbib;
- sama teksti tagasitulek indekseerib versiooni uuesti ja kontroll läbib;
- CLI loendab ilma `--execute`-ita ja nimetab oma vead.

## Serveris 30.09.2026

- **Loendus:** 466 versiooni, 9121 rida ja 9121 punkti, mida ükski generatsioon ei loetle. See on täpselt kollektsiooni (49 610) ja aktiivse indeksi (40 489) vahe.
- **`--execute`:** kustutati 9121 punkti, 9121 rida ja 466 pitserit.
- **Aktiivse indeksi v46 (`5a959000`) tõend** oli enne ja pärast sama: 6470 versiooni, 40 489 rida ja punkti ning samad ridade, pitserite ja punktide räsid. Kollektsioonis on nüüd 40 489 punkti.
- **Järel:** kordusjooks loendab 0; tabelitele tehti `VACUUM ANALYZE`; vestlusplaan on `ready`.
- Tööriist käivitati serveri töökausta koopiast enne ühendamist. Generatsioonid v42–v45 jäid alles, sest need loetlevad ainult versioone, mis on ka v46-s.

## Piirid

- Tööriista käivitab operaator ajal, mil indeksitööd ei käi. Tööriist kontrollib seda, aga Qdranti samm pole tehingu sees. Kui töö algaks kustutamise ajal, peatuks tööriist enne ridade kustutamist, kuid juba kustutatud punktide järel tuleb see töö üle kontrollida (`--mode verify`).
- Kataloogi (`rag_v2_object`, umbes 2,6 GB) tööriist ei puuduta.
