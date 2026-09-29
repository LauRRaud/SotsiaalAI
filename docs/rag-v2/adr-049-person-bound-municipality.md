# ADR-049 — Omavalitsus kuulub inimesele, olek ei kao sildi pärast

29.09.2026. Teostus Claude Opus 5.5 omaniku päevaplaani järgi: „Seo omavalitsus inimesega, mitte viimase mainimisega. Naabri Kose vald ei tohi jääda kasutaja enda küsimuse kataloogiks.“

## Mis juhtus

Omaniku aknakatse 28.09:

1. „Elan Tartu vallas …“ → kataloog Tartu vald.
2. „… naabrimees … elab Kose vallas“ → kataloog Kose vald. See oli naabri küsimuse jaoks õige.
3. „Teine asi: mul pole täna kusagil magada“ → **kataloog Kose vald**. Kasutaja enda küsimus sai naabri omavalitsuse.

Põhjus salvestatud pööretest (loeti ainult olekuid, piirkondade ID-sid ja kontrollide koode):

- **2. pöörde olek lükati tagasi** (`invalid_dialogue_state`, põhjus `previous_fact_dropped`). Mudel kirjutas ainult naabri faktid ja jättis kasutaja 1. pöörde faktid välja. Alles jäi 1. pöörde olek.
- **3. pöördes luges `resolveRecordScope` uuesti kõik pöörded, mida olek ei katnud:** 3. pöördes kohta polnud, 2. pöördes oli Kose, ja viimane mainimine võitis.
- Ka kehtiva oleku korral poleks piisanud: olekus on **üks** `region`. 2. pöörde mustandis oli see naabri Kose vald, sest päring oli naabri kohta. 3. pöörde otsingu ajal teadis olek ainult Kose valda.

Laiem pilt 28.09 pööretest:

- 147 jätkupöördest 48-l (33%) lükati mudeli olek tagasi ja pöörde uus teave (ka uus omavalitsus või periood) läks kaotsi.
- 35 korral oli põhjus `previous_fact_dropped`. 42 kadunud eelmisest faktist 33 olid alles sama isiku ja sama tsitaadiga, **ainult teema silt oli ümber nimetatud**. 4 fakti jäeti välja, ülejäänud muutsid tsitaati, isikut või jagunesid.
- Muud põhjused: `fact_superseded_by` 6, `unknowns_based_on` 4, `needs_based_on` 1.

## Otsus

### Olek v3 (`m4-dialogue-state-3`)

- **Üks `region` asendub isikutega:** `people` (kuni 3) on `{ person, region }`. `person: "user"` on kasutaja ise; teised on lühike silt kasutaja sõnadega („naabrimees“, „ema“). Iga isiku `region` on sama kujuga ja sama kontrolliga nagu seni: ID kataloogist ja tsitaat, mis seda omavalitsust mainib. `validateStateRegion` kontrollib iga isiku oma.
- **`focus`** ütleb, kelle kohta viimane päring oli: „user“, üks `people` isikutest või „unclear“.
- **Server kannab edasi, mida mudel võib ainult korrata:**
  - eelmine fakt sama isiku ja samade tsitaatidega saab tagasi oma eelmise teema;
  - välja jäetud kehtiv (`current`) fakt lisatakse muutmata lõppu, kui ruumi on ja selle tsitaati pole teises faktis kasutatud;
  - välja jäetud isik lisatakse koos oma omavalitsusega.
  - **Endiselt kukub läbi:** välja jäetud asendatud (`superseded`) fakt, muudetud isik või tsitaat, asendatud fakti taaselustamine.
- v2 reegel jääb v2 ridade jaoks rangeks. Nii kordub salvestatud tagasilükkamine taastamisel samamoodi (`checkDialogueState`).

### Otsinguplaan `rag-v2/search-assist-3`

- Plaan saab eelmise oleku isikute sildid (`people`, alati koos „user“-iga) ja ütleb **`person`**: kelle kohta praegune sõnum on. Valik on skeemi `enum`: „user“, teadaolev isik, „other“ (keegi uus) või „unclear“.
- Juhis: hoia päringutes selle isiku kohta, kelle kohta päring on; ära pane teise inimese kohta päringusse.
- Keeletuvastus (`search-assist-2`) jääb samaks.

### Omavalitsuse valik (`resolveRecordScope`)

Järjekord, kui olek on v3:

1. **Praeguses sõnumis nimetatud koht** võidab nagu seni (ka eitus ja parandus).
2. **Plaani nimetatud isik, kelle omavalitsust olek teab** → see omavalitsus (`person_region`).
3. **Plaani järgi keegi uus** („other“) → omavalitsust pole (`region_required`), mitte kellegi teise oma.
4. Muidu nagu seni:
   - varasem pööre, mida olek ei katnud;
   - siis isiku omavalitsus, kelle kohta vestlus oli (`dialogue_region`, nüüd koos `person`-iga).

Punktis 4 on ka teadaolev isik, kelle omavalitsust pole teada. Näiteks „Kellele ma helistan?“ ema koduabi asjus võib plaanile paista kasutaja enda küsimusena; kataloog ei kao siis ära.

### Prompt ja plaan

- **Dialoogi prompt `m4-grounded-dialogue-15`** selgitab `people` ja `focus`:
  - ühe inimese omavalitsus ei laiene teisele;
  - parandus seab isiku omavalitsuse tundmatuks;
  - `records.scope.person` ütleb, kelle omavalitsuse kataloog see on.
- **Plaani leping** (`codeContract`) nõuab olekut v3. Väljalase uuendab plaani ise (ADR-037), uut käsitsi plaani pole vaja. v2 plaanid jäävad ainult loetavaks.

## Piirid

- Plaani `person` on mudeli tõlgendus. Kui see eksib, on tagajärg sama mis enne: eelmise isiku omavalitsus. Omavalitsus pole kunagi kinnitatud elukoht.
- Sõnum, mis nimetab kaks omavalitsust („naaber Kosel, mina Tartu vallas“), on endiselt `ambiguous_region`.
- Kui olek lükatakse muul põhjusel tagasi, loetakse katmata pöördeid endiselt viimase mainimise järgi. Plaani nimetatud teadaolev isik on nüüd aga enne neid.
- Parandusi eraldi ei loendata. Mudeli mustand on auditis alles, nii et need on sealt tuletatavad.

## Kontroll

- `tests/rag-v2-person-scope.test.mjs` (EstNLTK-ta, kohaliku analüsaatoriga):
  - omaniku vestlus: kasutaja küsimus saab Tartu valla, naabri oma Kose valla;
  - „other“ ei saa kellegi teise omavalitsust; „unclear“ ja vana plaan käituvad nagu enne, `person`-iga;
  - „Kellele ma helistan?“ ema asjus jääb ema omavalitsusele;
  - praeguse sõnumi koht võidab; isik on enne katmata pööret; v2 olekut isik ei muuda;
  - v3 kontroll, isiku kandmine, ankurdamine, teema taastamine, välja jäetud fakti kandmine, v2 range reegel.
- `tests/rag-v2-search-assist.test.mjs`: plaani `people` ja `person`-i valik, vana plaan isikut ei anna.
- `tests/rag-v2-dialogue-config.test.mjs`: v3 plaan käivitub, v2 ühtse otsingu plaan ainult loetav.
- `npm test`: 374 läbis, 0 ebaõnnestus, 17 vahele jäetud.
- Serveris `eval-full` koopias enne PR-i: sihtkataloog `scenarios-two-people-1.json` enne ja pärast ning terve kataloog v4 pärast (tulemused allpool).
