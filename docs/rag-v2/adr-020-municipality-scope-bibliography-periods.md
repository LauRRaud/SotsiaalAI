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

## Codexi commit-ülevaatus 24.09.2026

Ulatus: `995b0990b..82404cfb4`, st koodiparandus `fe1101ffa` ja analüüside salvestus `82404cfb4`. Ka kasutaja kleebitud töökäik on läbi vaadatud. See on ülevaatus; allolevaid koodiparandusi ei ole selles ringis tehtud.

Kohanimede kitsam vaste, olemasolevate bibliograafiaväljade edastamine ning aastatäpsusega allikate kaasamine terve aasta perioodi on põhjendatud parandused. Täpset avaldamiskuupäeva ei mõelda välja. Importeri testimocki parandus vastab tegelikule transaktsioonieelsele lugemisele ega nõrgenda testi väiteid.

### Parandamist vajavad leiud

1. **P2 — v2 ühise vestluspaketi taastamine katkeb koodi uuendamisega.** `search/discovery.js` vahetab `DISCOVERY_SCHEMA` v3-ks, kuid `search/unified.js:108` kutsub ka ajaloolise paketi kontrollis sama ainult uusimat skeemi lubavat `unifiedDirectory()` funktsiooni. Varasema `995b0990b` koodiga v2 loendist loodud pakett läbis vana kontrolli; sama pakett ja sama loend andsid uues koodis `unified_directory_required`. Indeksipõlvkond ega õigused ei muutunud. Uute otsingute v3 nõue on põhjendatud, kuid ajaloolise paketi lugemine peab kontrollima tema algset skeemi ja räsi. Praegune v1/v2 loetavuse lubadus kehtib madalama taseme loendi lugemisele, mitte kogu ühise vestluse taastamisrajale. Vajalik regressioonitest peab säilitama päriselt v2 lepingu, mitte kasutama uut `DISCOVERY_SCHEMA` konstanti.

2. **P2 — perioodi katvus segab eri ulatusi.** `search/unified.js:34` arvutab `publication_year_only_documents` kogu ajakirjaloendist, samal ajal kui `indexed_documents` ja aastate jaotus kasutavad perioodi filtrit. Kahe allikaga (2016 ja 2021, mõlemal ainult aasta) andis 2016. aasta raport `indexed_documents: 1`, `publication_year_only_documents: 2`, aastate jaotus `{2016: 1}`. See jõuab mudelile ühe perioodi katvuse all ilma eraldi ulatuse märgiseta. Aastaga dokumentide arvu saab erinevalt täiesti dateerimata allikatest perioodile omistada: loenda `eligible` hulgast või nimeta/märgista üldkorpuse näitaja eraldi. Praegune uus test kinnistab ekslikult arvu 2.

3. **P2 — analüüsi naabriprofiilidest loobumise soovitus ületab katse tõendit.** Tervikanalüüsi §2.1/§5 võrdlus kasutas ajaloolist `topK=3 + naabrid` valikut. `search/profiles.js` praegune `hybrid-ranked-first-neighbors-v2` jätab alles viis algtulemust ja lubab kuni seitse lõppkatkendit; vaikimisi EstNLTK-profiil kasutab omakorda allikalisi sõltuvusi. Halvem tulemus ei erista naabrite mõju kahe algtulemuse eemaldamise mõjust ega tõenda kõigi naabri-/graafiprofiilide kahjulikkust. Soovitus tuleb piirata mõõdetud ajaloolise valikuga; praegust varianti saab võrrelda samade salvestatud vektoritega võrdse algtulemuste kvoodiga.

Väiksem tehniline tähelepanek: v3 `cachedIndexVector()` otsib puuduva rea korral ainult vana v1 nimeruumi. Kohalikus adapterikatses oli sama sisendi v2 vektor olemas, kuid v2 nimeruumi ei loetud ja tulemuseks jäi vahemälumöödumine. See ei tõenda tasulist lisakutset: päris indekseerimine nõuab endiselt salvestatud vektori adapterit. V2 → v3 ülemineku vahemälutaaskasutust tasub testida eraldi, sest olemasolev läbiv katse tõendab v1 → uusimat üleminekut.

### Analüüsi hinnang ja piir

Opuse mõõtmised toovad põhjendatult ettepoole päris KOV-kataloogi mahu ja päris allikate kohaliku vastuvõtu. Sünteetiliste testide läbimist ei saa pidada päris korpuse kasutatavuse tõendiks. Minu varasema ploki 69 testi seda samuti ei tõendanud. Kataloogi piiride tõstmine üksi ei lahenda konteksti dubleerimist; kompaktne projektsioon ja selgelt märgitud osaline tulemus vajavad säilivaid allikaviiteid.

Seisu vea korral kogu vastuse kaotamise vähendamine on hea eesmärk, kuid soovitust „säilita eelmine seis” ei tohiks rakendada pimesi. Kui uus kasutajapööre parandab valda või asjaolu, peab see jääma järgmisesse tõlgendusse ka vigase uue seisukirje korral. Avaliku vastuse allika-/õiguskontrollid ning vana seisu vananemise märgistus peavad säilima. Sama kehtib kontaktivärava kohta osalise kataloogitulemuse korral.

Kordasin 47 olemasolevat sihttesti `TZ=UTC` all: `record-scope` 2, `unified` 7, `source-structure` 22, `knowledge` 7 ning `unified.integration` 2 ja `structured-records.integration` 7. Kõik läbisid, sealhulgas päris kohaliku EstNLTK/PostgreSQL/Qdranti ja eraldatud vestlusandmebaasi katsed. Lisaks kolm sünteetilist lugevat taasesitust eespool: v2 taastamine, perioodi loendus ja v2 vahemälurida. Tasulisi kutseid 0. Opuse 17/18 järjestuskatset, 156 nimevormi täielikku katset ega KOV-ide täpseid tokenimahte selles ülevaatuses uuesti ei mõõdetud; need arvud jäävad tema raporteeritud tõendiks. Serverit ja `origin/main`-i ei mõõdetud. Käituskoodi ei muudetud.
