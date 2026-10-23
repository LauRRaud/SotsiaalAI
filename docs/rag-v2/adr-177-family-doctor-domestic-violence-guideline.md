# ADR-177: Korpus v93: lähisuhtevägivalla tegevusjuhend perearstiabile

Kuupäev: 22.10.2026. Teostus Claude Opus 5.5. Seis: **korpus v93 on serveris alates 22.10.2026 kella 17.17 UTC-st. Lisandus üks dokument, 83 lõiku, ost 0,0051 USD. Indeks `ab0ef1d3`: 11 024 dokumenti, 107 810 lõiku. Plaan `m4-corpus-chat-20261022a.json`.**

## Miks

Omanik kontrollis 22.10.2026, kas juhend „Lähisuhtevägivalla käsitlus perearstiabis. Tegevusjuhend 2026“ on andmebaasis. Seda ei olnud kummaski kohas:

- `Andmebaasi/` kaustas oli lähim SKA „Riskihindamine lähisuhtevägivalla juhtumites – tervishoiutöötajatele“;
- tootmise otsingus ei olnud juhendit küsimuse „Kuidas peaks perearst lähisuhtevägivalla juhtumit käsitlema? Kas on olemas tegevusjuhend perearstiabile?“ 21 lühinimekirja allika seas.

Omanik: „see on vaja kindlasti andmebaasi panna“.

## Mis sisse läks

| Dokument | Lk | Sõnu | Lõike | Tokeneid |
|---|---:|---:|---:|---:|
| Lähisuhtevägivalla käsitlus perearstiabis. Tegevusjuhend 2026 | 51 | 13 037 | 83 | 38 946 |

- **Fail:** `Andmebaasi/juhendid_ja_uuringud/justiits_ja_digiministeerium_lahisuhtevagivalla_kasitlus_perearstiabis_tegevusjuhend_2026.pdf`, sha256 `1ebf88a8…`, ja metaandmed kõrvalfailis.
- **Allikas:** Justiits- ja Digiministeeriumi aadress, mille andis omanik: `https://www.justdigi.ee/sites/default/files/documents/2026-10/Impact_LSV_juhend%20v2.0%20KU%CC%88LJENDATUD_16.10.2026_LO%CC%83PLIK.pdf`. Faili nimi ütleb, et see on Impact LSV juhendi v2.0 küljendatud lõplik versioon 16.10.2026. ISBN on 978-9985-4-1526-9.
- **Kes koostas:** juhend on tehtud kuriteoohvrite kaitse projektis IMPACT (Justiits- ja Digiministeerium, Sotsiaalministeerium, Victim Support Europe ja EL). Metoodiline tugi oli Tartu Ülikooli tõenduspõhise praktika keskus.
- **Liik:** `official_guideline`, kogu `national_guidelines`.

## Kohalik kontroll

- Kõigil 51 leheküljel on tekstikiht, pildina lehekülgi ei ole. Seega ei olnud vaja tekstikihiga koopiat ([ADR-152](adr-152-everything-else-laws-pages-slides-and-text-layers.md)).
- Lõikudesse jõudis 87 % faili sõnadest. Puudu on kirjanduse loetelu lk 48–51, sest seda ei tükeldata. Muudel lehekülgedel jõudsid lõikudesse peaaegu kõik sõnad. Erand on kaanelehekülg (71 %), kus „Rahastanud“ ja „Euroopa Liit“ on loetud kokku.
- Kahe veeruga kohtades on lugemisjärjekord osaliselt segi:
  - lk 2: töörühma nimed ja ametid on eraldi plokkides;
  - lisa 1: käsitlusalgoritmi kastid;
  - lisa 2: abi korralduse kast (Hädaabi, Lasteabi, Ohvriabi, KOV, kriisiabikeskus). Kahe veeru read on seal vaheldumisi, kuid sama sisu on ka juhendi peatükis 4.6.
- Lisa 3 kehakaardi vormil on märkeruudud loetud märgina U+A671.
- Ülevaatuse märkus kirjeldab sama ja ütleb, et juhend on tervishoiutöötajatele mõeldud tegevusjuhend, mitte õigusakt.

## Serveris

- **Hind** kontrolliti OpenAI lehel 22.10.2026 kell 17.13 UTC: 0,13 USD miljoni sisendtokeni kohta. Hinnafail on `price-2026-10-22.json`.
- **Jooks:** `rag-v2-corpus-run-guarded.sh 93 92`, ülempiir 83 sisendit, kulupiir 0,10 USD. Kinnitus tsiteerib omaniku sõnumit. Jooks kestis 17.15.57–17.17.47 UTC väljalaskel `9fb0cfb8`.
- **Plaan ja ost:** plaanis oli 83 uut sisendit ja 38 946 tokenit. Ost tegi 83/83 päringut, kulu **0,005063 USD**.
- **Indeks:** `search_generation_ab0ef1d3…`, millest uusi lõike oli 83. `rag_v2_head` näitab seda põlvkonda (`ready`) ja teenus on `active`.
- **Teenus** töötab plaaniga `/etc/sotsiaalai/m4-corpus-chat-20261022a.json`.

**Vestluse kontroll.** Küsimus „Kuidas peaks perearst lähisuhtevägivalla juhtumit käsitlema? Kas on olemas tegevusjuhend perearstiabile?“ esitati omaniku admin-seansist spetsialisti rollis kell 17.18 UTC. Pööre kasutas indeksit `ab0ef1d3`.

- **Kandidaadid:** admini jäljes olid valikumudeli kandidaatide 10 esimest kohta kõik uus juhend, sh lisa 1, peatükk 4.5.6, rolli piirid ja dokumenteerimine. Järgnesid „Vägivald ja naiste tervis“, „Pereõenduse tegevusjuhend“ ja seaduste reserv (ohvriabi seadus, lastekaitseseadus jt).
- **Valik ja vastus:** valikumudel valis 6 juhendi lõiku. Vastus oli `grounded` ja algas nii: „Jah. Perearstiabile on olemas „Lähisuhtevägivalla käsitlus perearstiabis. Tegevusjuhend 2026““. Vastus viitas viiele lõigule.
- **Kulu ja aeg:** pööre maksis 0,0032 USD ja esimene tekst tuli 15,7 s järel.

Sama küsimus kell 17.00 UTC indeksil `48dbc850` (korpus v92) andis vastuse `partial`, ja juhendit selle jäljes ei olnud.

## Lahtine

- **Lõik „TÖÖVERSIOON“:** lisa 4 (WAST-i küsimustiku tööversioon) lehe päis „TÖÖVERSIOON“ loeti pealkirjaks. Sellest tekkis lõik, milles on peale pealkirja ainult see üks sõna. Selle vektor on peaaegu dokumendi pealkirja oma, seega oli lõik kõigis vektorikanalites 1. kohal ja võttis ühe kandidaadi koha. Valikumudel jättis selle välja. Pealkirjata lõikude filter seda ei püüdnud, sest lõigu tekst ei ole pealkiri. Lehe päise ja vesimärgi äratundmine on PDF-lugeja töö, mitte selle korpuse lisandi oma.
- **SKA riskihindamise juhend:** SKA „Riskihindamine lähisuhtevägivalla juhtumites – tervishoiutöötajatele“ on koodihoidlas, kuid mitte RAG-is (`corpus_documents: 0`).
- **Serveri ketas** oli 97–98 % täis. Töökaustas oli 10 hoidla pea varukoopiat (`tmp/store-backup-v83` … `v92`), kokku 6,8 GB. Omanik ütles 23.10.2026: „varukoopiad võib kustutada“. Kõik kümme kustutati. Vaba ruumi oli enne 2,0 GB ja pärast 8,7 GB, ketas on 89 % täis. Hoidla aktiivne pea (v93) jäi puutumata. Järgmine korpuse jooks teeb oma varukoopia `store-backup-v93` uuesti.

Uuesti: sülearvutis `tmp/rag-v2-v93/` (plaan, ülevaatus, `tools/quality.mjs`, `tools/package.mjs`, `run-v93-start.sh`) ja serveris `run-v93.log`.
