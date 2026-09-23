# ADR-020 — Täpne omavalitsuse tuvastus, artikli bibliograafia ja aastapõhine perioodivalik

24.09.2026. Teostus Claude Opus 5.5; kood commit'is `fe1101ff`. Serveris aktiveeritud piloodiplaani ega v3 indeksit see ei muuda. Põhjendused ja mõõtmised: [terviklik analüüs](../audits/rag-v2-opus-terviklik-analuus-2026-09-24.md).

## Probleemid

1. `resolveRecordScope()` luges omavalitsuse mainituks, kui kasutaja sõnal ja nimel oli ükskõik milline ühine EstNLTK-termin. Nime muud tähendused ja liitsõnaosad tekitasid valevasteid: „Tahan end tappa” → Tapa vald, „Mulk” → Mulgi vald. „Pärnus” ja „Narvas” märgiti mitmetähenduslikuks Põhja-Pärnumaa ja Narva-Jõesuu tõttu; „Lääne-Harju vallas” jäi tuvastamata.
2. Tõendi bibliograafias olid ainult pealkiri, autorid ja `publication_date`. 892 ajakirja-metaandmest ei ole ülatasemel ühelgi `publication_date`, 848-l on ainult `year`. Mudel ei näinud seega enamiku artiklite aastat, ajakirja, numbrit ega lehekülgi.
3. Avaldamisaja filter nõudis täpset kuupäeva. Aastaga, kuid kuupäevata artikkel jäi seega igast perioodirajast välja (ADR-019). Sama põhjustas vana testi „M2.1-15” punase tulemuse, mida ADR-011 pidas ekslikult andmete triiviks.

## Otsused

- **Omavalitsus:** nime sõna on mainitud ainult siis, kui tema **enda kanooniline kuju** (väiketähtedega nimi) on ühe kasutajasõna EstNLTK pinnavormi või lemma hulgas. Sidekriipsuga nimi vastab ainult sidekriipsuga kasutajasõnale ja vastupidi. Täisnime eelistamine ühise lühinime ees säilib (sõnade võrdlus kanoonilisel kujul). Käsitsi käändevorme ega kohasõnade loendeid ei lisatud.
- **Bibliograafia:** `sourceEntry()` lisab olemasolul `publication_year`, `journal_title`, `issue_label` ja `page_range`. Puuduvat väärtust ei tuletata. Väljad jõuavad mudelikonteksti allikakirjesse.
- **Periood:** aadressiloendi skeem `rag-v2/retrieval-directory-3` lisab `fields.publication_year`. `filtersMatch()` kasutab aastat ainult siis, kui täpne kuupäev puudub. Aastaga allikas sobib vahemikku ainult siis, kui **kogu kalendriaasta** mahub sinna; osaline aasta jääb välja. Katvusraport loendab aastat kuupäeva puudumisel, lisab `publication_year_only_documents` ning `missing_publication_date_documents` tähendab nüüd „ei kuupäeva ega aastat”. Skeemid v1/v2 jäävad loetavaks. Ühine rada nõuab v3 loendit, seega on vaja uut indeksipõlvkonda. Vektorite sisend ei muutu.

## Kontrollitud tõend

- **Omavalitsus:** mõõdetud 78 kanoonilise omavalitsusega (`src/server/data/municipalities.rich.json`). Iga nime kaks kohakäänet (156 lauset) on genereeritud EstNLTK süntesaatoriga.
  - Senine reegel: 106 õiget + 16 õigesti mitmetähenduslikku, 34 valesti mitmetähenduslikku.
  - Uus reegel: 138 + 16 õiget, 0 vale ja 2 tuvastamata („Läänerannas/-l”; tulemuseks täpsustusküsimus).
  - 12 igapäevalausest andis vale piirkonna senise reegliga 5, uuega 3. Järele jäävad sõna-sõnalt samad kujud „kanepi”, „rae” ja „Kiili”, mida ilma pärisnime analüüsita eristada ei saa.
- **Testid, kõik `TZ=UTC`:**
  - uus `tests/rag-v2-record-scope.test.mjs` (2, päris EstNLTK);
  - bibliograafia test `rag-v2-source-structure.test.mjs`-s;
  - aastapõhise perioodi ja v3 loendi test `rag-v2-unified.test.mjs`-s.
  Unit-komplektid (source-structure, selection, unified, rubric, knowledge, search, estnltk, record-scope) läbisid. Kõik kuus RAG-i integratsioonifaili läbisid 45/45 (unified, structured-records, selective, index-jobs, estnltk, ingest-publication) kohaliku PostgreSQL/Qdranti, EstNLTK ja eraldatud M4 andmebaasiga.
- **Vana artiklitest** `rag-v2-search.integration.test.mjs`: 11/13 → 12/13. Avaldamisaja filter läbib põhjendatult. Alles jääb tokenite ootus 12 420 ≠ 12 429, mis on päris signaal: praegune normaliseerimine muudab selle artikli embedding'u sisendit (vt analüüs). Ootust ei muudetud.
- **Kõrvalparandus:** `rag-v2-knowledge.test.mjs` importeri mock oli alates `25d103663` punane (`this.pool` puudus, sest põlvkonna lugemine toimub enne tehingut). Mockile lisati `pool`; väited on muutmata.
- **Päris vektoritega 05.09 võrdlusandmestik:** järjestus on muudatuste järel sama (EstNLTK-hübriid 17/18).
- ESLint ja `git diff --check` läbisid. Tasulisi kutseid 0.

## Piirid

Muudatused kuuluvad piloodi teostusmanifesti ja nõuavad uut plaani kinnitust. Allikapaneeli UI näitab piloodis endiselt ainult pealkirja; autori, aasta, väljaande ja lehekülgede kuvamine on eraldi UI-töö. Perioodi ja kataloogi päris kasutus vajab uut v3 indeksit ning KOV-kataloogi mahuparandust (analüüsi U1).
