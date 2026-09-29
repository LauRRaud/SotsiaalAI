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

- Plaan saab eelmise oleku isikute sildid (`people`, alati koos „user“-iga) ja ütleb **`person`**: kelle olukorra või abivajaduse kohta praegune sõnum on. See on abivajaja, mitte alati kirjutaja: ema hoolduse vestluses on „Kellele ma helistan?“ ema kohta. Valik on skeemi `enum`: „user“, teadaolev isik, „other“ (keegi uus) või „unclear“.
- Juhis: hoia päringutes selle isiku kohta, kelle kohta päring on; ära pane teise inimese kohta päringusse.
- Keeletuvastus (`search-assist-2`) jääb samaks.

### Omavalitsuse valik (`resolveRecordScope`)

Järjekord, kui olek on v3:

1. **Praeguses sõnumis nimetatud koht** võidab nagu seni (ka eitus ja parandus). Üks erand:
   - plaani nimetatud isiku omavalitsus on teada ja sõnumis on teine koht;
   - kui plaani päringutest leitud omavalitsus on isiku oma, jääb isiku oma.

   Näide: „Naabri omavalitsus on Kose vald. Millist abi saan mina oma vallast?“ jääb Harku vallaks. Kolimise korral on uus koht plaani päringutes, nii et mainimine võidab.
2. **Plaani nimetatud isik:**
   - kui olek teab tema omavalitsust, saab ta selle (`person_region`);
   - muidu omavalitsust pole (`region_required`) ja kataloog jääb tühjaks, mitte kellegi teise oma.
   - Kui olek pole tema omavalitsust teadnud, võib varasem katmata pööre veel öelda, kus ta on.
3. **„unclear“ või vana plaan** käitub nagu seni:
   - varasem pööre, mida olek ei katnud;
   - siis isiku omavalitsus, kelle kohta vestlus oli (`dialogue_region`, nüüd koos `person`-iga).

### Omavalitsuse ankurdamine lauses

`validateStateRegion` loeb tsitaadi kogu lauset kasutaja sõnumist, mitte ainult tsitaati. Tsitaat „Kose vald“ lausest „Minu elukoht ei ole Kose vald.“ ei ankurda Kose valda, sest eitus loetakse samuti. Kaks omavalitsust ühes lauses („Elan Harkus, ema elab Kosel.“) ankurdavad kumbagi.

### Prompt ja plaan

- **Dialoogi prompt `m4-grounded-dialogue-15`** selgitab `people` ja `focus`:
  - `focus` on abivajaja;
  - ühe inimese omavalitsus ei laiene teisele;
  - parandus seab isiku omavalitsuse tundmatuks;
  - `records.scope.person` ütleb, kelle omavalitsuse kataloog see on.
- **Plaani leping** (`codeContract`) nõuab olekut v3. Väljalase uuendab plaani ise (ADR-037), uut käsitsi plaani pole vaja. v2 plaanid jäävad ainult loetavaks.

## Codexi ülevaatus (29.09)

Codex vaatas poolelioleva v3 läbi ([süsteemianalüüs](../audits/rag-v2-system-analysis-2026-09-29.md), jaotis 6) ja leidis sünteetiliste olekutega neli veateed:

| Juhtum | Enne parandust | Nüüd |
|---|---|---|
| Ema Kose vallas, kasutaja koht teadmata: „Kust saan mina enda elukohas abi?“ | Kose (ema fookus) | omavalitsus puudub (`region_required`) |
| Kasutaja Harku vallas nimetab praeguses sõnumis naabri Kose valda | Kose | Harku, kui plaani päringud hoiavad kasutaja kohta |
| Eitav lause, mudel tsiteerib ainult „Kose vald“ | olek läbis kontrolli | ei ankurda |
| Mudel omistab ema lause kasutajale | olek läbis kontrolli | **lahendamata**, vt piirid |

Kolm esimest on sihttestides ja teises sihtkataloogis (`scenarios-two-people-2.json`).

## Piirid

- **Kuuluvus.** Tsitaadikontroll tõendab, et kasutaja lause nimetab omavalitsust ja ei eita seda. See ei tõenda, kelle kohta lause on. Kui mudel omistab „Minu ema omavalitsus on Kose vald.“ kasutajale, läbib see kontrolli. Selleks on vaja semantilist kuuluvuskontrolli, mitte suuremat skeemi.
- **Plaani `person`** on mudeli tõlgendus. Kui see eksib, jääb isikul pigem omavalitsus puudu, mitte ei saa ta teise oma. Omavalitsus pole kunagi kinnitatud elukoht.
- **Faktide elutsükkel.** Kõik varasemad faktid peavad säilima ja piir on 12. 13. fakti ei saa lisada, vana välja jätmine lükkab oleku tagasi. v3 parandab ainult sildi ümbernimetamise ja välja jäetud kehtiva fakti. Vaja on serveri fakti-ID-sid, lisamist, asendamist ja tagasivõtmist ning aktiivset vaadet eraldi ajaloost (Codex F3).
- **Teadmusotsing ja kataloog** võivad endiselt saada eri omavalitsuse, kui koha leiab ainult plaani päring (Codex F4). Mõlemad peaksid kasutama sama isikuga seotud otsust. See on eraldi muudatus.
- **Hindaja** kontrollib kataloogi omavalitsust, mitte oleku omavalitsust ega oleku tagasilükkamist (Codex F5). Raport näitab nüüd `person` ja `scopePerson` väärtust. Ootusi neile veel pole.
- Sõnum, mis nimetab kaks omavalitsust („naaber Kosel, mina Tartu vallas“), on endiselt `ambiguous_region`.
- Parandusi eraldi ei loendata. Mudeli mustand on auditis alles, nii et need on sealt tuletatavad.

## Kontroll

- `tests/rag-v2-person-scope.test.mjs` (EstNLTK-ta, kohaliku analüsaatoriga):
  - omaniku vestlus: kasutaja küsimus saab Tartu valla, naabri oma Kose valla;
  - „other“ ja teadmata omavalitsusega isik ei saa kellegi teise omavalitsust; „unclear“ ja vana plaan käituvad nagu enne, `person`-iga;
  - Codexi kolm juhtumit, kolimine ja „Kellele ma helistan?“ ema asjus;
  - praeguse sõnumi koht võidab; teadaolev isik on enne katmata pööret; v2 olekut isik ei muuda;
  - v3 kontroll, isiku kandmine, lause ankurdamine, teema taastamine, välja jäetud fakti kandmine, v2 range reegel;
  - v3 olek on järgmise pöörde eelmine olek.
- `tests/rag-v2-dialogue-store.test.mjs` (päris andmebaas): kolm v3 pööret teenuse kaudu. Ümbernimetatud teema ja välja jäetud isik kanduvad edasi.
  - See test lisati pärast esimest `eval-full` jooksu. Seal peatusid kõik jätkupöörded (`dialogue_state_scope_mismatch`), sest `previousStateFor` ei tundnud v3 versiooni.
- `tests/rag-v2-search-assist.test.mjs`: plaani `people` ja `person`-i valik, vana plaan isikut ei anna.
- `tests/rag-v2-dialogue-config.test.mjs`: v3 plaan käivitub, v2 ühtse otsingu plaan ainult loetav.
- `npm test`: 376 läbis, 0 ebaõnnestus, 17 vahele jäetud. Kohalikult:
  - `rag-v2-record-scope` 3/3 (EstNLTK);
  - `rag-v2-dialogue-store` 17/17, `rag-v2-pilot-store` 28/28, `rag-v2-unified` 4/4, `rag-v2-structured-records` 9/9.
  - `rag-v2-dialogue-scenarios` ei jõua käivituseni: kohalikud KOV-andmed ei vasta ostetud vektoritele (`scenario_unit_vector_missing`). Tõrge tekib andmete ettevalmistuses enne muudetud koodi, nii et see test jäi käivitamata.
- **Serveris `eval-full` koopias enne PR-i** (plaan `medium`):
  - `scenarios-two-people-1.json`: tootmiskoodil **5/8**. Kõik kolm viga on omavalitsuses: kasutaja küsimus sai Kose, naabri ja ema küsimus vale omavalitsuse.
  - Esimese v3 versiooniga (enne Codexi parandusi) **8/8**. Plaan nimetas isikud õigesti: kasutaja → Tartu, naabrimees → Kose, ema → Harku.
  - **Lõplik kood** (Codexi parandustega, plaanid `…-0848` ja `…-0849`):

    | Kataloog | Tootmiskood (v2) | Lõplik v3 |
    |---|---:|---:|
    | `scenarios-two-people-1.json` | 5/8 | **8/8** |
    | `scenarios-two-people-2.json` (Codexi juhtumid) | 3/5 | **5/5** |
    | terve kataloog v4 | 39/40 (päeva baas) | 38/40 |

    - Plaan valis isikud õigesti. „Kellele ma helistan?“ ema asjus → ema (Kose). „Kust saan mina oma elukohas abi?“ → kasutaja, omavalitsust pole. Naabri Kose mainimine kasutaja küsimuses → kasutaja Harku.
    - v4-s oli omavalitsus kõigis 40 pöördes sama mis baasjooksus.
    - Kaks läbikukkumist:
      - kuuldeaparaadi piirhind (ADR-046 allikalünk);
      - `care-home-correction` 3: vastus ei nimetanud parandatud pensioni 700.
    - Hooldekodu stsenaarium korrati: baaskoodil 3/3 ja lõplikul koodil 5/6 kasutasid kasutaja numbreid; üks kordus katkes plaani broneeringulae tõttu (`pilot_budget_exhausted`). See oli kõikumine, mitte regressioon.
  - **Olek jäi alles sagedamini:**
    - v2 plaanidel lükati täna tagasi 15/50 jätkupööret (30%), v3 plaanidel 4/39 (10%).
    - v3 ülejäänud põhjused: `fact_superseded_by`, `needs_based_on` ja üks `previous_fact_dropped`. Need kuuluvad faktide elutsükli avatud töö juurde.
  - Kulu: umbes 0,5 USD. Kõik mõõtmised 29.09 kokku umbes 1,0 USD.
