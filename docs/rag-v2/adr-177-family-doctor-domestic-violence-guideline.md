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

## Korpus v94: Sotsiaalministeeriumi infopäeva slaidid (23.10.2026)

Tõenduskatsete sessioon palus korpusesse lisada Sotsiaalministeeriumi infopäeva 9.12.2025 slaidid „Infopäev sotsiaalhoolekande seaduse muudatustest toimetulekutoetuse vaatest“. Põhjus on tõenduskatse G09 (parandusnimekirja punkt 11): üür sugulasele, SHS § 133 lg 8. Omanik ütles 23.10.2026 tõenduskatsete lahtiste punktide kohta: „muidugi kontrollide asi paranda ka“. Selle jooksu kohta ütles ta: „ok“.

- **Fail:** `Andmebaasi/juhendid_ja_uuringud/sotsiaalministeerium_infopaev_sotsiaalhoolekande_seaduse_muudatustest_toimetulekutoetuse_vaatest_2025.pdf`, 61 slaidi, liik `information_material`.
- **Kohalik sisestus:** 58 lõiku, lõikudesse jõudis 99 % sõnadest. Slaid 54 (§ 132 lg 5 ja § 133 lg 8, vana ja uus sõnastus) on üks lõik.
- **Tekstita slaid:** slaid 41 on Riigikogu eelnõu 732 SE lehe kuvatõmmis ilma tekstikihita. Seda üles ei kirjutatud, sest et seadus on vastu võetud, ütleb tekstina juba slaid 33.
- **Server:** jooks 23.10.2026 kell 09.54.52–09.56.24 UTC, kulupiir 0,05 USD. Ost tegi 58/58 päringut, kulu 0,002337 USD.
- **Indeks ja plaan:** indeks `search_generation_d0945950…` sisaldab 11 025 dokumenti ja 107 868 lõiku. Teenus töötab plaaniga `m4-corpus-chat-20261023a.json`.
- **Kontrolli tingimus:** G09 jooksu esimene katse peatus, sest automaatrežiimi kontroll keelas teise sessiooni palvel tehtava tootmise jooksu. Jooks tehti pärast seda, kui omanik andis loa siin sessioonis ja lülitas automaatrežiimi välja.

**G09 kordus kliendi vaates (FAIL).** Küsimus oli „Üürin korterit oma emalt ja maksan talle iga kuu üüri. Kas see üür läheb toimetulekutoetuse arvestamisel arvesse?“.

- **Vastus:** „Seega sõltub sinu olukorras sellest, kas sina ja su ema elate samas eluruumis“.
- **Valik:** slaidi 54 lõik oli valikumudeli 36 kandidaadi seas 7. kohal, kuid seda ei valitud.
- **Pakett:** paketis olid seadus ise (§ 133 lg 8 ja § 131 lg 7) ning Sotsiaalministeeriumi toimetulekutoetuse leht.
- **Miks vastus nii luges:** § 133 lg 8 viitab „§ 131 lõike 7 punktis 1 või 2 nimetatud isikutele“. § 131 lg 7 algab sõnadega „samas eluruumis elavad ühise majapidamisega“, ja vastus järgib seda viidet.
- **Mida slaid ütleb:** slaid näitab vana sõnastust, milles kooselu tingimust ei olnud, ja pealkirja „Välistatakse lähedastega seotud üürilepingud“. Seda, et uus sõnastus jätab kooselu tingimuse välja, slaid ise ei ütle.
- **Otsus:** tõlgendus jääb omaniku ja spetsialisti otsustada, nagu parandusnimekirja punkt 11 ütleb.
- **Tõend:** `docs/audits/evidence/sol-proof-20261014-01/server-rag-chat-g09-v94.json`.

Uuesti: sülearvutis `tmp/rag-v2-v94/` ja serveris `run-v94.log`.

## Korpus v95: eelnõu seletuskiri ja VIPS-spetsialistide baasõpe (23.10.2026)

Omanik 23.10.2026 tõenduskatsete lahtiste punktide kohta: „muidugi kontrollide asi paranda ka“, ja selle töö kohta: „mõtle ise, tegutse“. Jooksu tegi aruande sessioon, mitte tõenduskatsete sessioon.

- **G09 allikas:** „Sotsiaalhoolekande seaduse ja teiste seaduste muutmise seaduse eelnõu seletuskiri“ (Sotsiaalministeerium, faili kuupäev 23.09.2025, 44 lk), alla laaditud Riigikogu eelnõude infosüsteemist `https://api.riigikogu.ee/api/files/64c0f7db-d45f-4914-a1d9-dac73ef84029/download`. Eelnõust tuli muudatus RT I, 30.12.2025, 3. Lk 17 ütleb, et eelnõu § 1 p 13 **täiendab** SHS § 133 lg 8: kehtiv reegel jätab üüri arvestamata abikaasade, registreeritud elukaaslaste ja esimese ja teise astme sugulaste vahel, ja muudatus lisab äriühingu. Fail `Andmebaasi/juhendid_ja_uuringud/sotsiaalministeerium_shs_ja_teiste_seaduste_muutmise_eelnou_seletuskiri_2025.pdf`, liik `policy_analysis`. Sisestus: 81 lõiku, lõikudesse jõudis 98 % sõnadest. Lk 17 selgitus on üks lõik. PDF-i tekstikihis on mõnes sõnas tühik („üleneja d“), ja lõikude jaotisepealkiri on mitmel pool vale („Lisaks muudetakse sotsiaalmaksuseaduses …“).
- **U01 allikas:** VIPS-spetsialistide baasõppeprogrammi tekst (24 EAP, viis moodulit, piloot orienteeruvalt 2026. aasta lõpust 2027. aasta lõpuni). Omanik kopeeris selle 20.10.2026 (`Andmebaasi/Uut juurde/VIPS-spetsialist.txt`). Veebiaadressi ei leitud: tõenduskatsete sessioon otsis sm.ee lehekaardist ja saidiotsingust, TAI lehekaardist ja lehelt „Sekkumised“, vaimnetervis.ee-st ning veebiotsingust, ja 23.10 ka see sessioon sm.ee astmelise abi lehelt ja veebiotsingust. Allikaks võeti teksti esimene osa HTML-failina `vips_spetsialistide_baasoppeprogramm_koopia_2026-10-20.html`, ilma veebiaadressita; igakuine veebilehtede uuendus seda ei loe. Teine osa (VIPS-i pakkujad) jäi välja, sest Sotsiaalministeeriumi pakkujate leht on korpuses alates v91. Sisestus: 3 lõiku.
- **Ülevaatus:** esimesel avaldamisel said mõlemad kirjed seletuskirja märkuse. Hoidla pea pandi varukoopiast tagasi, vale kviitung tõsteti kõrvale (`tmp/rag-v2-v95/discarded/`) ja rühm avaldati uuesti õigete märkustega. Pea põlvkond oli mõlemal korral sama (`generation_c0af7c15…`), sest see sõltub ainult dokumentidest.
- **Server:** jooks 23.10.2026 kell 11.57.25–11.59.16 UTC, kulupiir 0,05 USD. Ost tegi 84/84 päringut, kulu 0,008556 USD. Indeks `search_generation_1bab8b41…` sisaldab 11 027 dokumenti ja 107 952 lõiku. Teenus töötab plaaniga `m4-corpus-chat-20261023b.json`.

**G09 kordus v95-l (FAIL).** Kell 12.09 UTC pöörduja vaates, uues vestluses, jälg `3b3cf31a-fc96-417c-8ff9-0dba95ae1e9c`:

- **Vastus:** „Kui sina ja su ema elate samas eluruumis ning teil on ühine majapidamine, siis üüri … arvesse ei võeta.“ ja küsimus, kas elatakse koos.
- **Kandidaadid:** seletuskirja lõik ei olnud valikumudeli 36 kandidaadi seas. Slaidi 54 lõik oli 3. kohal, valikumudel valis selle teisena ja see oli paketis (S2), kuid vastus sellele ei viidanud. SKA KKK lõik (üüripind lapse isalt, „teise ja esimese astme üleneja ja alaneja“ leping ei ole eluruumi kasutamise alus) oli 5. kohal, aga seda ei valitud.
- **Järeldus:** tõendeid suhtepõhise lugemise kohta on paketis piisavalt. Vastus loeb seaduse viidet „§ 131 lõike 7 punktis 1 või 2 nimetatud isikud“ koos lõike 7 sissejuhatusega. Parandus on vastuse juhises: [ADR-181](adr-181-a-reference-to-a-point-reads-the-point.md).

Uuesti: sülearvutis `tmp/rag-v2-v95/` ja serveris `run-v95.log`.
