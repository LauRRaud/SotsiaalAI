# ADR-053 — Omavalitsuse akti lisa tekst allikaks

29.09.2026. Teostus Claude Opus 5.5 Codexi süsteemianalüüsi tööjärjekorra punkti 6 põhjal: puuduvate tabelite ja lisade katvus ([audit](../audits/rag-v2-system-analysis-2026-09-29.md)). Omanik 29.09: „jätka arendustööd“; taotlusvormide kohta: „taotlusvormid jms ei ole aegunud“. Järgib [ADR-050](adr-050-rt-annex-tables.md)-t.

## Probleem

- **Lisa sisu jäi vestlusele nähtamatuks.** Riigi Teataja XML kannab akti lisasid base64-kodeeritud PDF-idena (`<fail>`). Akti tekstiparser jätab need välja, seega nägi teadmusrada ainult akti teksti.
- **Registreeritud 134 aktist on lisadega 15.** Pärast ADR-050-t puudusid veel:
  - **Harku** sotsiaalhoolekandelise abi andmise kord (kehtiv): valla toetuste määrad ja valla toimetulekupiir, 600 eurot kuus pereliikme kohta;
  - **Kose** kord (kehtis 01.07.2025–02.05.2026): toetuste määrad;
  - **Luunja** kord (2021–2022): toetuste määrad;
  - **Jõelähtme** kord (kehtiv): sotsiaalhoolekandelise abi taotluse vorm;
  - **Peipsiääre** teenuste kord (kehtiv): hooldusvajaduse hindamisinstrument ja kliendi tagasiside küsimustik;
  - **Tori** kord (2016–2017): kolm taotlusvormi;
  - Riigilõivuseaduse kuus redaktsiooni: lõivutabelid.
- **PDF-i tekstikiht tükeldab numbreid.** Kose „600“ on kaks elementi („6“ ja „00 eurot“) ilma vaheta. Tavaline tekstiväljavõte annab „6 00 eurot“.

## Otsus

- **Uus tekstilisa vorming** (`rag-v2/rt-annex-text-1`, `annexText`, `annexTextDocument`).
  - Lisa loetakse lehekülgede kaupa. Rida pannakse kokku elementide asukoha järgi: tühik lisatakse ainult siis, kui elementide vahel on tegelik vahe, seega tükeldatud number jääb üheks sõnaks.
  - Iga lehekülg on eraldi kirje (`lk-N`).
- **Pealkiri on lisa enda sõnad.** Lugeja annab lisa pealkirja (`--heading`) ja kood kontrollib, et see esineb lisa tekstis. Vormi lüngad (`___`) loetakse tühikuks.
  - Dokumendi pealkiri on kujul: „‹lisa pealkiri›: ‹väljaandja› määruse „‹akti pealkiri›“ lisa“.
- **Päritolu ja kehtivus nagu ADR-050-s.**
  - Metaandmed nimetavad XML-i ja PDF-i räsi. Registriadapter kontrollib ingest'is uuesti XML-i registreeringut, lisa räsi, akti viidet ja kehtivust.
  - Kehtiv versioon ilma lõputa annab lisale avatud lõpu.
- **Jurisdiktsioon tuleb aktilt.** Tekstilisa metaandmetes jurisdiktsiooni pole. Ingest annab lisale sama omavalitsuse, mis registreeritud XML-ile (`source_register_hash`), nii et lisa ei saa kunagi teise valla allikaks.
- **Aegunud versioonid jäävad ajalooks.** Kõik omavalitsuste lisad loetakse sisse, ka taotlusvormid (omanik 29.09). Aegunud versiooni lisa saab akti kehtivuse, nagu teised aegunud versioonid korpuses, ja rerank valib kehtiva versiooni (ADR-042).
- **Riigilõivuseaduse lisad jäävad välja.** Riigilõivude tabelid ei ole sotsiaalhoolekande küsimuste allikas. Need saab sama vorminguga hiljem lisada.

## Andmed

- `Andmebaasi/oigusaktid/lisad/`:
  - üheksa allikat (`<akt>-lisa*.json`) ja nende metaandmed;
  - `review_status: derived_annex_text_checked`;
  - REGISTER: `oigusaktid` 145 allikat ja 156 faili.
- **Korpus v37** (29.09.2026):
  - kohalik ingest: 9 dokumenti, 21 tükki, 0 blokeerijat;
  - store'i pea `189ef281`, 6040 dokumenti;
  - serveris 21 embeddingut (plaani hinnangul 0,0014 USD);
  - indeks `c5c32ff9`: 6037 dokumenti, 34 327 tükki, v36 tõend muutumatu, kogu jooks 43 s;
  - vestlusplaan `m4-corpus-chat-20260929b.json` (…-1256).
- `docs/rag-v2/legal-acts-in-index.json` on uuendatud (89 akti; v36 ajal jäi see tegemata).

## Töötluse sõrmejälg

`rt-annex.js` ja `registered-source.js` muutusid, töötlussildid mitte.

- **Olemasolevate allikate metaandmed on muutumatud.** HEAD-koodi ja uue koodi registriadapteri väljund kõigi 136 varasema `oigusaktid` allika kohta on baitide kaupa identne. Uus haru käivitub ainult siis, kui lisal pole oma jurisdiktsiooni. Kahel ADR-050 tabelilisal see on.
- **Tabelilisa väljavõte on muutumatu.** Test `the committed derived sources are exactly…` läbib.
- **Seetõttu salvestati ainult uus sõrmejälg.**

## Kontroll

`tests/rag-v2-rt-annex.test.mjs`:

- iga lisa on täpselt see, mida väljavõtja XML-ist loeb;
- Kose „1.1 sünnitoetus 600 eurot;“, Harku „(1) Toimetuleku piirmäär … 600 eurot“ ja „1) sünnitoetus - 500 eurot;“;
- iga lehekülg on eraldi kirje;
- vale ja puuduv pealkiri lükatakse tagasi;
- ingest registriga annab Harku omavalitsuse, avatud lõpu ja tüki toimetulekupiiriga.

Serveris mõõdab lisade sihtkataloog `tests/evaluation/dialogue/scenarios-annex-1.json` (kirjutatud enne jooksu) ja kataloog v4 plaaniga v37 peal. Tulemused on allpool.

### Tulemused serveris, 29.09.2026

Mõõdetud aktiveerimata plaaniga o korpusel v37, koos dialoogi promptiga 17.

| Kataloog | Tulemus |
|---|---:|
| `scenarios-annex-1` (kirjutatud enne jooksu) | 4/4 |
| Kataloog v4 | 40/40, olek tagasi lükatud 0/21, omavalitsused samad mis plaanil m |

Mida vastused lisadest kasutasid:

- **Harku sünnitoetus:** 500 eurot koos taotlemise tingimustega.
- **Harku toimetulekupiir:** alla 600 euro kuus pereliikme kohta, kolme kuu keskmisena, koos märkusega, et piir üksi toetust ei taga.
- **Jõelähtme:** mida taotlusvorm küsib, sh perekonnaliikmete sissetulekud.
- **Peipsiääre:** mida hindamisinstrument vaatab (liikumine, hügieen, ravimid, mälu, võrgustik, eluruum).

## Täiendus 30.09.2026: sama lisa uues redaktsioonis

Omanik 30.09: „jätka arendust“.

### Probleem

- **Kose määrad olid otsingust väljas alates 03.05.2026.** Korpuses oli lisa ainult redaktsioonist 403042025042 (kehtis kuni 02.05.2026). Kehtiv redaktsioon 430042026009 kannab sama lisa PDF-i (sama räsi).
- **Kehtivat lisa ei saanud lisada.** Tuletatud allikas oli baithaaval sama mis eelmises redaktsioonis. Avaldamine hoiab ühe aktiivse dokumendi ühe allikabaitide kohta ja lükkas selle tagasi (`duplicate_asset_identity_conflict`).
- **Kehtivust ei saa ka lihtsalt pikendada.** Lisa kehtivus peab olema täpselt tema akti oma (`rt_annex_act_mismatch`).

### Otsus

- **Tuletatud allikas nimetab oma akti redaktsiooni** (`act_reference`, `items`-ist väljaspool). Sama lisa kahes redaktsioonis on kaks allikat, kumbki oma redaktsiooni kehtivusega. Vana jääb ajaloo jaoks, nagu teised aegunud redaktsioonid.
- **Registriadapter kontrollib, et allika nimi vastab metaandmete redaktsioonile.** Vale või puuduv nimi annab `rt_annex_act_mismatch`.
- **Lõigud ei muutu.** Tekstiks loetakse ainult `items`, seega embeddingu sisendid on samad ja vektorid tulevad vahemälust.
- **Kõik 11 lisa loodi uuesti.** Igas failis on üks rida juures, metaandmed on samad. Väljavõtja sildid (`rt-annex-table-1`, `rt-annex-text-1`) ei muutunud, sest loetud tekst on sama.
- **Harku lisa teadmiskaart seoti uute baitidega.** Selleks sai `scripts/rag-v2-knowledge-reanchor.mjs` võtme `--previous-root`.
  - Skript loeb eelmised baidid (kaardi `source_sha256`) ja nõuab, et iga lõik loeks sama. Alles siis seob ta kaardi uute baitidega.
  - Ettevalmistuse kirjesse läheb `reanchored: source_bytes_same_text` ja eelmine räsi.
  - Kui tekst muutus, skript peatub (`knowledge_source_text_changed`).
- **Töötluse sõrmejälg.** Muutus ainult `registered-source.js` (uus kontroll, kehtiva sisendi väljund on sama), seega sildid jäid samaks ja salvestati uus sõrmejälg (`621bbd50`).
- **Kaalutud ja jäetud:** avaldamise identiteedi kontrolli leevendamine (redaktsioon identiteedi osaks kataloogis). See muudaks kataloogi skeemi, kuigi probleem on selles, et tuletatud allikas ei ütle, kust ta tuli.

### Andmed ja tulemus

- REGISTER: `oigusaktid` 148 allikat ja 160 faili (Kose kehtiva redaktsiooni lisa `430042026009-lisa.json`).
- **Korpus v41** (30.09.2026):
  - kohalik ingest: 12 dokumenti, 701 lõiku, 0 blokeerijat, avaldamine konfliktita;
  - embedding: 700/700 sisendit vahemälust, 0 USD;
  - indeks `5457e6e0`: 6040 dokumenti, 34 404 lõiku, kõik 701 vahemälust, v40 tõend muutumatu, indeks 24 s;
  - vestlusplaan `m4-corpus-chat-20260930c.json`, seaded samad mis eelmisel.
- **Päris vestlus** (üks küsimus, 30.09): „Elame Kose vallas ja meil sündis laps. Kui suur on sünnitoetus?“ Vastus: 600 eurot alates 03.05.2026, koos taotlemise tingimustega. Enne 03.05 sündinud lapse kohta vastus summat ei kinnitanud, sest aegunud redaktsioon on tänase kuupäevaga otsingust väljas.

### Kontroll

- `tests/rag-v2-rt-annex.test.mjs`:
  - Kose kaks redaktsiooni: sama PDF, samad kirjed, erinev `act_reference`, erinevad baidid ja kehtivus;
  - registriadapter lükkab tagasi teise redaktsiooni nime ja puuduva nime;
  - kõik 12 lisa on täpselt see, mida väljavõtja loeb.
- `tests/rag-v2-knowledge-reanchor.test.mjs`:
  - kaart järgib uusi baite ainult eelmiste baitide ja sama teksti korral;
  - muutunud tekst peatab skripti ka siis, kui kaardi enda tsitaat on sama.

### Avatud

- Luunja ja Tori lisad on vanadest redaktsioonidest (2021–2022 ja 2016–2017). Tuleb kontrollida, kas kehtivates kordades on lisad.
- Kehtivuskontroll (ADR-038) vaatab ainult XML-akte. Tuletatud lisa järgib oma XML-i: kui RT annab XML-ile lõpu, tuleb uuendada nii XML kui ka lisa metaandmed (`xml_sha256`, `valid_to`).
