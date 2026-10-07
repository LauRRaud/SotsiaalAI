# ADR-100 — Indeksi mahupiir 60 000 → 80 000 lõiku, mõõtmise järgi

Kuupäev: 07.10.2026. Seotud: ADR-036 (versioonipõhine indeks ja mahupiir), ADR-099 (uudiskirja dokumendid, korpus v66).

## Probleem

Ühe indeksipõlvkonna mahupiir on koodis (`lib/rag-v2/search/capacity.js`): 10 000 dokumenti ja 60 000 lõiku. Piir seati 25.09.2026, kui korpuses oli 29 103 lõiku, ja jättis ruumi umbes kahekordseks kasvuks. Korpus v66 on 8179 dokumenti ja **57 860 lõiku** ehk 96% piirist. Esimene v66 katse 104 dokumendiga (61 819 lõiku) sai serveri tasuta plaanilt keeldumise `local_index_limit`; 30 uuringut jäi seetõttu korpusest välja (ADR-099).

ADR-036 ütleb, millal piiri tohib tõsta: „Piiri tõstmiseks tuleb mõõta vestluspöörde kulu suurema põlvkonnaga: kataloog, sõnaline päring ja täpne vektoriotsing (`exact: true`) kasvavad põlvkonna suurusega.“

## Mõõtmine

Tasuta, ilma mudeli- ja embedding-kutseta, 07.10.2026 serveris.

**1. Salvestatud pöörete kirjed** (`timings.search`, 118 lõpetatud pööret 05.–07.10, üheksa põlvkonda). Suurusest sõltuvad osad pöörde kohta, mediaan:

| Põlvkond | Lõike | Pöördeid | Kataloog | Sõnaline otsing | Vektoriotsing serveris |
|---|---:|---:|---:|---:|---:|
| `2e4b3572` (v59) | 42 154 | 52 | 68 ms | 1131 ms | 332 ms |
| `d058d90b` (v62) | 43 558 | 5 | 63 ms | 1083 ms | 272 ms |
| `7d209c63` (v64) | 45 596 | 16 | 62 ms | 1097 ms | 279 ms |
| `33a3cb2a` (v65) | 50 379 | 3 | 65 ms | 2444 ms | 1310 ms |
| `de3e160f` (v66) | 57 860 | 3 | 84 ms | 1541 ms | 442 ms |

Kahe suurema põlvkonna kohta on ainult kolm pööret, kõik vahetult pärast teenuse taaskäivitust. Nendest kirjetest kasvu järeldada ei saa; sellepärast teine mõõtmine.

**2. Samad sisendid eri suurusega põlvkondadel.** Andmebaasis ja vektorihoidlas on alles 20 põlvkonda (40 489 kuni 57 860 lõiku). Üks protsess, soojalt, igal põlvkonnal samad sisendid: kõigi dokumentide kataloog, kaks päringuteksti sõnalise otsinguga üle kõigi dokumentide (piir 80) ja üks salvestatud päringuvektor täpse vektoriotsinguga (piir 80). Mediaan kolmest kuni viiest kordusest pärast ühte soojenduskutset.

| Põlvkond | Dokumente | Lõike | Kataloog (pöörde kohta) | Kataloog (esimene lugemine) | Sõnaline, tekst 1 | Sõnaline, tekst 2 | Vektoriotsing |
|---|---:|---:|---:|---:|---:|---:|---:|
| `34fe1590` | 6470 | 40 489 | 40 ms | 426 ms | 2853 ms | 3439 ms | 137 ms |
| `7d209c63` (v64) | 8001 | 45 596 | 50 ms | 460 ms | 2937 ms | 3579 ms | 190 ms |
| `33a3cb2a` (v65) | 8105 | 50 379 | 52 ms | 556 ms | 3243 ms | 3910 ms | 201 ms |
| `de3e160f` (v66) | 8179 | 57 860 | 63 ms | 606 ms | 3559 ms | 4201 ms | 188 ms |

Lõike on 43% rohkem (40 489 → 57 860); sõnaline otsing kasvas 22–25%, vektoriotsing 37–47%, kataloog 58% (dokumente 26% rohkem). Kasv on sirgjooneline: sõnaline otsing umbes 0,4 s iga 10 000 lõigu kohta nende tekstide puhul, vektoriotsing umbes 30 ms.

Selle mõõtmise sõnaline päring on raskem kui päris pöördes: siin otsiti üle kõigi dokumentide, päris pöörde kogu sõnaline rada on 1,1–1,5 s. Mõõtmisest võtan kasvu kiiruse, mitte kulu enda.

**3. Mälu ja ketas.** Täpne vektoriotsing loeb põlvkonna kõik vektorid: 57 860 × 3072 × 4 baiti on 0,7 GB, 80 000 lõigu juures 1,0 GB; serveril on 10 GB mälu, millest 6,3 GB vaba. Indeksi töö on täienduse suurune (v66: 7481 lõiku kuue minutiga). **Ketas saab täis enne:** üks lõik võtab serveris umbes 380 KB (ADR-099) ja vaba on 7,2 GB.

## Otsus

1. **Lõikude piir on 80 000**, dokumentide piir jääb 10 000 (kasutusel 8179).
2. Põhjendus: sama joont jätkates on suurusest sõltuvad osad 80 000 lõigu juures veerandi kuni kolmandiku võrra kallimad kui 57 860 juures, pöörde kohta umbes 0,5–0,7 s. Pööre kestab 10–13 s, millest suurem osa on mudeli vastus.
3. **Mis on mõõdetud ja mis mitte:** mõõdetud on neli põlvkonda 40 489 kuni 57 860 lõiguga. 80 000 lõigu kulu on joone jätk 38% võrra üle suurima mõõdetud põlvkonna; sellise suurusega põlvkonda ei ole ja seda ei saa mõõta enne, kui korpus sinna kasvab.
4. **Järgmine tõstmine** nõuab uut mõõtmist sama skriptiga, kui korpus on jõudnud 70 000 lõiguni. Piiri muutmise testis (`tests/rag-v2-capacity.test.mjs`) seisavad arvud sõna-sõnalt, et muutus ei sünniks kogemata.
5. Mahupiir ei ole enam esimene takistus; see on serveri ketas. Ruumikulu vähendamine lõigu kohta on eraldi töö.

## Tegemata

- Mõõtmise skriptid (`cap-timings.mjs`, `cap-bench.mjs`) on serveri töökaustas `/home/ubuntu/rag-v2-work/w4/`, mitte koodihoidlas.
- Esimene mõõtmiskatse oli liiga raske: neli pikka päringuteksti kõigi põlvkondade vastu koormas RAG-andmebaasi kümme minutit (koormus 4 neljal tuumal) ja ma katkestasin selle. Leht vastas sel ajal 0,08 sekundiga; vestluspöörde aega ma sel ajal ei mõõtnud.
- Päris pöörde sõnalise raja kulu suurema põlvkonnaga on mõõdetud ainult kolme pöördega; järgmise mõõtmise juures tasub küsida sama küsimuste komplekt uuesti (tasuline, umbes 0,05 USD).
- Vanade põlvkondade read ja punktid (20 põlvkonda) on alles; nende koristus on tegemata (ADR-036).
