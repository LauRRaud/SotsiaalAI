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

## Codexi ülevaatuse parandus R1 (30.09.2026): koristus ja indekseerimine välistavad teineteist

- **Viga ([Codexi raport](../audits/rag-v2-pr283-288-review-2026-09-30.md), P1):** kontroll „midagi ei käi“ oli hetkeseis. Indeksitöö, mis algas pitserite märkimise ja Qdranti kustutamise vahel, indekseeris märgitud versiooni uuesti, pitseeris ja aktiveeris selle. Koristus kustutas seejärel uued punktid. Aktiivne indeks jäi `qdrant_count_mismatch`-iga katki ning ei koristuse ega indeksitöö kordus parandanud seda.
- **Nüüd:** rentniku Postgresi nõuandev lukk (`PRUNE_LOCK`, `lib/rag-v2/search/postgres.js`).
  - `--execute` võtab luku ühes seansis enne esimest kontrolli ja hoiab seda kogu töö: märkimine, iga Qdranti kustutus ja ridade kustutus käivad selles seansis. Kui lukk on võetud, keeldub tööriist (`prune_index_work_pending`).
  - `beginGeneration` võtab sama luku jagatult oma tehingu ajaks. Koristuse ajal ei alga ükski generatsioon (`index_prune_running`; tööd saab pärast korrata). Varem alanud generatsioon ei ole valmis, seega koristus keeldub.
  - Enne iga Qdranti kustutust tõendab päring luku seansis, et lukk on alles. Kadunud seanss peatab töö ja klient hävitatakse, mitte ei lähe tagasi kogumisse.
  - Loendamine lukku ei võta. Mõlema tehingu kontroll „midagi ei käi“ jääb alles.
- **`beginGeneration` on ainus generatsioonide looja** (`runIndexJob` → `enqueueIndex` ja vana paigutuse `indexSnapshot`). Loendiridu kirjutavad ainult `importSnapshot` ja `attachSealed` oma generatsioonile.
- **Testid:**
  - Codexi põimitud stsenaarium: Qdranti kustutuse ajal alustatud indeksitöö keeldub ega jäta ühtegi rida. Teine koristus keeldub, koristus lõpeb. Pärast seda indekseerib sama töö versiooni uuesti ja `verifyIndexJob` läbib.
  - Luku ajal ootel generatsiooniga koristus keeldub.
  - Seanss lõpetatakse (`pg_terminate_backend`) esimese kustutuse ajal: töö peatub enne teist kustutust, pitserid jäävad `staged` ja järgmine koristus lõpetab töö.
  - Vana koodiga uus test kukub (indeksitöö jõuab lõpuni), nagu Codexi sond näitas.

## Piirid

- Tööriista käivitab operaator ajal, mil indeksitööd ei käi. Lukk ei lase koristuse ajal uuel generatsioonil alata ja keeldub, kui mõni on pooleli.
- Indeksitöö rida (`rag_v2_index_job`) lisatakse pärast `beginGeneration`-i tehingut. Valmis generatsioon, millelt on töörida käsitsi kustutatud, võiks koristuse ajal uuesti loendiridu saada. Tavarada seda seisu ei tekita.
- Kataloogi (`rag_v2_object`, umbes 2,6 GB) tööriist ei puuduta.
