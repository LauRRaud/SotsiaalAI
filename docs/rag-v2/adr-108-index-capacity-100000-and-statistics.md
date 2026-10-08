# ADR-108: indeksi mahupiir 80 000 → 100 000 lõiku; uue põlvkonna statistika värskendatakse aktiveerimisel

Kuupäev: 08.10.2026. Seotud: ADR-036 (mahupiir ja selle tõstmise tingimus), ADR-100 (60 000 → 80 000). Seis: kood tehtud, serveris mõõdetud ilma mudeli- ja embedding-kutseta; statistika on serveris käsitsi värskendatud. Päris vestluspöördega pärast parandust mõõtmata.

## Miks

Omanik: „esmalt vist suurendada veel indeksi mahtu 100 000 peale, siis jätka“. Korpus v69 on 8337 dokumenti ja 68 408 lõiku ehk 86% senisest piirist; ruumi oli 11 592 lõigule. ADR-100 lubas järgmist tõstmist uue mõõtmisega sama skriptiga.

## Mõõtmine

Tasuta, 08.10.2026 serveris, üks protsess, soojalt, samad sisendid igal põlvkonnal nagu ADR-100-s: kõigi dokumentide kataloog, kaks päringuteksti sõnalise otsinguga üle kõigi dokumentide (piir 80) ja üks salvestatud päringuvektor täpse vektoriotsinguga (piir 80). Mediaan kolmest kuni viiest kordusest.

| Põlvkond | Dokumente | Lõike | Kataloog | Sõnaline, tekst 1 | Sõnaline, tekst 2 | Vektoriotsing |
|---|---:|---:|---:|---:|---:|---:|
| `34fe1590` | 6470 | 40 489 | 38 ms | 2919 ms | 3583 ms | 128 ms |
| `7d209c63` (v64) | 8001 | 45 596 | 44 ms | 3076 ms | 3752 ms | 145 ms |
| `de3e160f` (v66) | 8179 | 57 860 | 48 ms | 3664 ms | 4329 ms | 180 ms |
| `9120d524` | 8209 | 61 819 | 49 ms | 3802 ms | 4392 ms | 184 ms |
| `c49c1d5c` (v68) | 8258 | 67 799 | 55 ms | 4086 ms | 4620 ms | 200 ms |
| `8b1e1008` (v69, töös) | 8337 | 68 408 | 48 ms | 4055 ms | 4634 ms | 200 ms |

Kolm suuremat rida on mõõdetud pärast statistika värskendamist (vt allpool). Joon peab: sõnaline otsing 0,38–0,41 s iga 10 000 lõigu kohta (ADR-100-s 0,4 s), vektoriotsing 26 ms iga 10 000 kohta (seal 30 ms).

**Sama joon 100 000 lõiguni** (46% üle suurima mõõdetud põlvkonna): sõnaline mõõtepäring umbes 5,3 ja 5,8 s, vektoriotsing umbes 280 ms, kataloog umbes 60 ms. Andmebaasi päringu ajapiir on 15 s. Päris pöörde sõnaline rada oli v68 juures 1,8 s (15 pööret, mediaan); sama suhtega on see 100 000 lõigu juures umbes 2,3 s ehk koos vektoriotsinguga umbes 0,6 s rohkem pöörde kohta kui praegu. Pööre kestab 10–19 s.

**Mälu ja ketas.** Täpne vektoriotsing loeb põlvkonna vektorid: 100 000 × 3072 × 4 baiti on 1,2 GB; serveril on 8,9 GB mälu, sellest vaba 6,4 GB. Üks lõik võtab kettal umbes 380 KB: 31 592 lisalõiku on umbes 12 GB, vaba on 25 GB.

## Leid: töötav põlvkond oli joonest kolm korda aeglasem

Esimeses mõõtmises võttis esimene tekst töötaval põlvkonnal (68 408 lõiku) 13,8 s ja teine katkes iga kord ajapiiriga (`57014`), samal ajal kui 609 lõigu võrra väiksemal põlvkonnal olid samad päringud 4,1 ja 4,6 s. Kordus andis sama.

Põhjus on andmebaasi planeerija statistika, mitte maht. `rag_v2_generation_document` oli viimati automaatselt analüüsitud 07.10 kell 15:33 (UTC), v69 read lisati kell 19:30. Uue põlvkonna read on mõni protsent tabelist, vähem kui osa, mille juures Postgres statistikat ise värskendab. Planeerija arvas, et töötaval põlvkonnal on **1** dokument (tegelikult 8337), ja valis tee, mis loeb iga versiooni kõik lõigud ja kontrollib sõnu rida-realt, selle asemel et kasutada tekstiindeksit. Eelmistel põlvkondadel arvas ta 4274 ja 8873 dokumenti ja kasutas indeksit.

Päris pöörete kirjed sobivad sellega: sõnaline rada oli v69 ajal 3,7 s (96 pööret, mediaan), v68 ajal 1,8 s (15 pööret). Ka varasemad „uus põlvkond on aeglane“ näidud (v65 2,3 s, `9120d524` 2,9 s kohe pärast täiendust) sobivad sama põhjusega; tagantjärele seda tõestada ei saa.

**Serveris parandatud 08.10 kell 17:36:** `ANALYZE` kolmele tabelile (kokku 3,6 s). Pärast seda arvab planeerija töötaval põlvkonnal 8024 dokumenti ja mõõtepäringud on 4,1 ja 4,6 s.

## Otsus

1. **Lõikude piir on 100 000** (`INDEX_CAPACITY.units`), dokumentide piir jääb 10 000 (kasutusel 8337, ruumi 1663 dokumendile).
2. **Põlvkonna aktiveerimine värskendab statistika** (`PostgresCatalog.activate`): pärast lõikude arvu kontrolli ja enne, kui põlvkond saab valmis ja pea liigub, tehakse `ANALYZE` tabelitele, mida otsing põlvkonna järgi loeb (`GENERATION_TABLES`). Kui see ebaõnnestub, jääb otsing õigeks, aga aeglaseks: viga logitakse ja aktiveerimine jätkub.
3. Järgmine tõstmine nõuab jälle mõõtmist sama skriptiga.

## Kontrollitud

- Ühiktestid, sealhulgas uus test aktiveerimise kohta: statistika värskendatakse õiges kohas, ebaõnnestunud värskendus ei peata aktiveerimist ja vale lõikude arv peatab selle enne.
- Serveris: tabel ülal; planeerija hinnang ja päringuplaan enne ja pärast `ANALYZE`-i.

## Kontrollimata

- 100 000 lõiguga põlvkonda ei ole; selle kulu on joone jätk.
- Päris vestluspööre pärast statistika värskendamist: kas sõnaline rada on tagasi 1,8 s juures, näitab esimene päris pööre (tasuline).
- Uus aktiveerimise samm päris andmebaasis: see käivitub esimest korda järgmise korpuse täiendusega. Andmebaasiga ühendtestid selles masinas ei käi.

## Tegemata

- Mõõteskriptid (`cap-bench.mjs`, `cap-bench2.mjs`, `cap-explain.mjs`, `cap-analyze.mjs`, `w4-captime.mjs`) on serveri töökaustas `/home/ubuntu/rag-v2-work/w4/`, mitte koodihoidlas.
- Dokumentide piir (10 000) võib väikeste lehtede lisamisel täis saada enne lõikude piiri.
