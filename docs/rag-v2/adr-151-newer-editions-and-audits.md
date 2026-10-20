# ADR-151: Uuemad väljaanded ja Riigikontrolli sotsiaalvaldkonna auditid

Kuupäev: 20.10.2026. Teostus Claude Opus 5.5. Seis: **korpus v90: serveris alates 20.10.2026 kell 15.01 UTC: 22 uuemat väljaannet ja auditit; ost 1586 sisendiga, 1 093 225 tokenit, 0,1421 USD (lagi 0,16). Indeks e05a23fa: 10 953 dokumenti, 105 052 lõiku. Järgmised korpused v91 ja v92 ([ADR-152](adr-152-everything-else-laws-pages-slides-and-text-layers.md)) tulid samal päeval.**

## Miks

Uudiskirja kogu uuemate väljaannete kontroll (`Andmebaasi/Sotsiaaltöö uudiskiri/Uuemad väljaanded 2026-10-20.txt`) võrdles 256 PDF-i väljaandjate praeguste loenditega ja leidis 22 dokumenti, mis RAG-ist puudusid. Need olid sarjade uuemad väljaanded ja Riigikontrolli sotsiaalvaldkonna auditid.

Omaniku sõnad:

- „Do this task here: Uuemate väljaannete kandidaadid RAG-i“.
- Küsimusele, kas laadin paki serverisse ja valmistan ostu ette laega 0,16 USD ning kontrollpöörded laega 0,05 USD: „inglisekeelseid materjale me ei lisa. Kõik muu pane“.
- Käivitamise kohta: „käivita ise, olen autos“.

Vanemaid väljaandeid ei eemaldatud. Need jäävad ajaloolise allikana ja metaandmetes on nende aasta.

## Mis sisse läks

| Väljaandja | Dokumente |
|---|---:|
| Riigikontroll: auditid (erivajadustega inimeste toetamine, laste tervis, töötute tööle aitamine, töövõimereformi ettevalmistus, eestkostel olevate laste elatisraha ja selle järelaudit, üürimajade programm, vanglasüsteem, KOV-ide asutuste võrk) ja kriminaalhoolduse tulemuslikkuse märgukiri koos kahe lisaga | 13 |
| Tervise Arengu Instituut: suitsiidide statistika (2000–2023 ja 2025), „Imelised aastad“ 2023, VEPA 2025/2026 | 4 |
| Justiits- ja Digiministeerium: elatise arvutamise korra muutmise rakenduspraktika, alaealiste menetlus- ja karistuspraktika 2024, alaealiste rasked vägivallateod | 3 |
| Eesti Inimõiguste Keskus: Inimõigused Eestis 2024 | 1 |
| Sotsiaalkindlustusamet: elanikkonna hoiakud ja teadlikkus seksuaalvägivallast | 1 |
| Sotsiaalministeerium: soolise võrdõiguslikkuse monitooring 2021 | 1 |
| **kokku** | **22** (1588 lõiku) |

Iga fail laaditi väljaandja ametlikult aadressilt (`Andmebaasi/Sotsiaaltöö uudiskiri/Uuemad väljaanded 2026-10-20/`, iga PDF-i kõrval sama nimega JSON). Ülevaatus tehti reegliga (`scripts/rag-v2-review-by-rule.mjs`, liik `document`), probleeme oli 0.

## Kohalik kontroll enne ostu

Faili sõnadest jõudis lõikudesse üle 85 % kõigil peale ühe: „Alaealiste rasked vägivallateod: põhjused, riskitegurid ja ennetus“ 80 % sõnadest (viidete loendit ei tükeldata). Kohalik arvestus: 1588 lõiku, 1 093 321 tokenit ehk 0,1421 USD.

## Kontroll serveris

**Otsinguvärav (tasuta):** tehti üks kord pärast korpust v92, nii et see katab v90, v91 ja v92 korraga. Tulemus on [ADR-152](adr-152-everything-else-laws-pages-slides-and-text-layers.md) jaotises „Kontroll serveris“.

**Tasuline kontroll:** 6 pööret laega 0,05 USD, **0,0240 USD**. Kõik pöörded lõppesid ja valideerusid. Kõik 5 spetsialisti küsimust viitasid v90 uuele dokumendile: erivajadustega inimeste toetamise audit, elatise arvutamise korra rakenduspraktika, alaealiste rasked vägivallateod, „Imelised aastad“ 2023 ja elatisraha järelaudit. Kliendi elatiseküsimus viitas olemasolevatele juhislehtedele ja perekonnaseadusele. Kaks vastust olid osalised („partial“): elatise korra rakenduspraktika ja vägivallategude riskitegurid.
