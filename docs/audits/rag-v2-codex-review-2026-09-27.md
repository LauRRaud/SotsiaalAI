# RAG v2: Codexi kontrolli leiud ja parandused (27.09.2026)

Teostus Claude Opus 5.5, 27.09.2026. Aluseks aktiivne korpus v27 (`search_generation_23e445…`), `main` `1e1f2e4a` ja vestlusplaan `m4-corpus-chat-20260927o`. Selle töö käigus uusi tasulisi mudeli- ega embedding-kutseid ei tehtud. Võrdlus kasutas salvestatud vektoreid.

## 1. Õigusaktide kehtivus

**Olukord (kinnitatud):**
- Aktiivses korpuses on üks Sotsiaalhoolekande seaduse (SHS) redaktsioon: RT 130062026065, kehtivus 01.10.2026–30.11.2026. 27.09.2026 see veel ei kehti. Täna kehtiv redaktsioon (RT 103062026023, 12.06–30.09.2026) korpuses puudub.
- Vestluse teadmusrada otsis ilma kehtivusfiltrita (`filters: {}`, `lib/rag-v2/pilot/retrieval.js`). Riikliku õiguse reserv võttis kõik 7 riiklikku akti kehtivust vaatamata.
- Mõõteskript `law-check.mjs` luges akti kehtivaks, kui lõppkuupäev puudus või oli ≥ 27.09. Algust see ei vaadanud, seega loeti tulevane SHS kehtivaks.
- v27 mõõtmises (`law-reserve-v27.json`) oli SHS 12-st küsimusest 9-l tõendis: B1, B4, B6, B8, C9, F3, F4, G11 ja A9. See on **valikuviga**: tulevane tekst pakuti kui kehtiv õigus.
- Kas lõppvastus esitas selle kui 27.09 kehtivat reeglit, pole süsteemselt kontrollitud. Elav B9 (27.09, v27) SHS-i ei tsiteerinud.

**Parandus** (`lib/rag-v2/search/legal-validity.js`, `rag-v2/legal-validity-1`):
- **Kellele kehtib:** allikale, millel on kehtivusandmed (`valid_from`, `valid_to` või tõendatud tähtajatus `open_end`). Selles korpuses on need 61 õigusakti: 54 omavalitsuse korda ja 7 riiklikku akti. Artiklitel, juhenditel ja aruannetel kehtivusandmeid pole ja neid ei filtreerita.
- **Mis loetakse kehtivaks:**
  - redaktsioon jääb tõendiks, kui see kehtib viitekuupäeval, st `valid_from ≤ D ≤ valid_to` (mõlemad piiripäevad kaasa arvatud) või algus on ≤ D ja lõpp on tõendatult avatud;
  - puuduv algus, või puuduv lõpp ilma tõendatud tähtajatuseta, on `unknown_validity`, mitte kehtiv.
- **Viitekuupäev:**
  - vaikimisi Eesti tänane kuupäev (Europe/Tallinn);
  - lisaks kasutaja küsitud periood: küsimuses olev aasta või kuupäev või vestluse seisu periood, mille alus pole `publication`.
  - Redaktsioon jääb, kui see kehtib tänasel päeval või mõnel küsitud perioodil. Nii saab küsimus 2023 kohta ka 2023. aasta redaktsiooni, aga küsimuses olev aasta (nt sünniaasta) ei eemalda kunagi tänast õigust.
- **Kus kehtib:** teadmusrajas ja riikliku õiguse reservis sama reegel.
- **Puudujääk:**
  - välja jäänud riiklikud redaktsioonid (pealkiri, kehtivus, seis) ja välja jäänud omavalitsuse aktide arv on `evidence.retrieval.scope.legal_validity` all ja jõuavad vastusemudelini;
  - juhis `m4-grounded-dialogue-11` ütleb: kui tõendis pole küsitud kuupäeval kehtivat redaktsiooni, öelda, et see tekst puudub kogus, ja nimetada välja jäänud redaktsioon koos kuupäevadega; teist redaktsiooni ega mälu kehtiva reeglina mitte esitada.
- **Mõõteskript:** `law-check.mjs` kasutab sama reeglit (`AS_OF`, vaikimisi täna) ja annab välja `validity` seisu.

**Tõendid:**
- `tests/rag-v2-legal-scope.test.mjs`:
  - tulevane, lõppenud, tähtajatu, alguseta ja lõputa redaktsioon;
  - piiripäevad 30.09 / 01.10 / 30.11 / 01.12;
  - Tallinna ja UTC kuupäeva vahe keskööl;
  - ajaloolise küsimuse periood;
  - avaldamisperiood ei mõjuta kehtivust;
  - väljaspool ulatust olev tõend peatab vastuse (`unified_lane_scope_mismatch`).
- 52 küsimuse komplektis pole ühtegi ankrut tulevases SHS-is; reegel mõõdikut ei moonuta.

**Kontrollimata:**
- Õigusakti, millel pole ühtegi kehtivusvälja, kataloogist ära ei tunne: kataloogis pole `source_type`-i. Praeguses korpuses on 61/61 aktil algus ning lõpp või tõendatud tähtajatus.
- Suhtelist aega („eelmisel aastal“, „1. oktoobrist“) praeguses sõnumis enne vastust ei tuvastata. Vestluse seisu periood tuleb eelmisest vastusest.
- Uusi vastuseid tasulise kutsega ei kontrollitud.

**Tagajärg pärast deploy'd:**
- 27.–30.09 on SHS tõendist väljas ja vastus peab ütlema, et täna kehtivat redaktsiooni kogus pole.
- 01.10 tuleb sama redaktsioon ise tagasi.
- Kui uut redaktsiooni enne 30.11 ei lisata, on SHS alates 01.12 jälle väljas.
- HMS ja Riigilõivuseadus kehtivad kuni 31.12.2026.

**Puuduva redaktsiooni lisamise plaan** ([runbook](../rag-v2/runbook-corpus-increment.md)):

| | A: RT 103062026023 (12.06–30.09) | B: SHS redaktsioon alates 01.12.2026 |
|---|---|---|
| Kasu | 3 päeva (28.–30.09) | vajalik enne 30.11 |
| Allikas | `https://www.riigiteataja.ee/et/akt/103062026023.xml` | RT API-st, kui avaldatud |
| Sammud | register → 1 XML sisestus (`source-structure-v26`) → poliitika +1 → hoidla muutunud osa serverisse → vektoriplaan (`--reuse` v25b, v26, v27) → ost → indeks (~50 min, tasuta) → plaan | sama |
| Uued sisendid | ainult muutunud tükid: tekst erineb 01.10 redaktsioonist eriolukorra sätete ja ühe lõike poolest, hinnanguliselt ≤ 20 tükki, ≤ 15 000 tokenit | sõltub muudatustest; kogu SHS ~250 tükki, ~130 000 tokenit |
| Eeldatav kulu | ≤ 0,002 USD | ≤ 0,02 USD (halvimal juhul, kui kõik tükid muutuvad) |

Kehtivusreegel valib hiljem õige redaktsiooni kuupäeva järgi ise; vana redaktsiooni pole vaja käsitsi eemaldada. A tasub teha ainult siis, kui SHS-i on vaja enne 01.10.

## 2. Õige omavalitsuse allikad

**Etapp:**
- v27 mõõtmises (`law-reserve-v27.json`, küsimus F3 vene keeles „…в Нарве…“) jõudis valikusse Narva-Jõesuu „Sotsiaaltoetuste maksmise … kord“.
- Teadmusrajal polnud omavalitsuse piirangut üldse. Kohalikud korrad on teadmusdokumendid (`regions`) ja pääsesid kandidaatideks sõnalise („Narva“ on osa sõnast „Narva-Jõesuu“) ja vektorkanali kaudu. Valija jättis korra alles.
- Kataloogirada kasutas `resolveRecordScope`-i, mis Narva ja Narva-Jõesuu eristab, kuid kirillitsas nime ei loe.

**Lõppvastus:**
- 27.09 vastuvõtutestis (v25/v26) hinnati F3 vastus õigeks: kasutati Narva artiklit, Narva-Jõesuu korda mitte.
- Vale allikas valikus on tõendatud (v27 mõõtmine). Viga lõppvastuses on tõendamata: v27-l F3 vastust ei genereeritud.

**Parandus** (üldine, `municipalScope` ja `knowledgeRegionScope`):
- Teadmusraja omavalitsuse tekstid (`regions`) jäävad alles ainult vestluses nimetatud omavalitsuse kohta. Sama lahendus kehtib nii kataloogile kui teadmusrajale.
- Mitmetähenduslik nimi („Tartus“) jätab kandidaadid, `candidates: [tartu_linn, tartu_vald]`, kolmandat mitte. Kui ühtegi omavalitsust pole nimetatud, ei jää ühegi omavalitsuse teksti.
- Riiklikud aktid, artiklid ja juhendid ei muutu.
- Kui kasutaja sõnadest nime ei leia (kirillitsa, muu kirjaviis), loetakse sama reegliga otsinguabi eestikeelseid päringuid. Plaan hoiab kasutaja nimetatud kohad („Narva-Jõesuu koolitoetuse taotlemine“). Parandusega kustutatud kohta nii tagasi ei tooda.
- Seis on `evidence.retrieval.scope.municipality` all ja juhis ütleb, et ühe omavalitsuse reeglist ei üldistata.

**Tõendid:**
- `tests/rag-v2-legal-scope.test.mjs`:
  - Narva vs Narva-Jõesuu;
  - Tartu vallas vs Tartus;
  - nimeta küsimus;
  - kirillitsas nimi plaani kaudu;
  - parandus ei too kohta tagasi.
- 52 küsimuse komplektis on omavalitsuse tekstis 7 ankrut, kõik küsimustes, mis nimetavad omavalitsust:
  - `laws-06` (vene keeles) lahendub plaani kaudu;
  - `laws-09` („Jõhvi vald või Jõgeva vald“) jätab mõlemad.
- Olemasolevad `resolveRecordScope` testid (EstNLTK-iga) katavad nime eristuse.

**Kontrollimata:**
- Mõju elavatele vastustele (tasuline).
- Kas plaan hoiab kohanime alati; eraldi mõõtmata.
- Üldküsimus, mis võrdleb omavalitsusi neid nimetamata, ei saa enam kohalikke kordi. See on teadlik: kohalik reegel ei tõenda üldist.
- Kataloogirada kirillitsas nime endiselt ei loe; teda ei muudetud.

## 3. v26 ja v27 kvaliteedivõrdlus

**ADR-034 järeldus parandati:** põhjust polnud eristatud, „müra piires“ ei olnud tõendatud.

**Olemasolevad tulemused, `laws-03`:**
- Kõigis neljas jooksus (v26 × 2, v27 × 2) valiti samad 3 dokumenti: Lastekaitseseadus ja kaks juhendit.
- Plaani päringud olid igas jooksus erinevad (4 eri sõnastust).
- v27 jooksudes puudus lõppvalikust üks kolmest ankrust. Kandidaatide hulka ei salvestatud.

**Korratav võrdlus** (`scripts/rag-v2-generation-compare.mjs`, mudelikutseid 0, embedding-kutseid 0):
- Sama kood, samad 48 vastatavat küsimust ja üks salvestatud jooksu plaan mõlemale põlvkonnale.
- Sõnaline kanal loeb küsimust ja plaani päringuid, vektorkanal ainult salvestatud küsimuse vektorit. Plaani päringute vektoreid polnud salvestatud.
- Mõõdetakse ankruid valija 30 + reservi hulgas ja sulandatud top-9-s ilma mudelita.

| Plaan | v26 hulk (kõik / mõni) | v27 hulk | v26 top-9 (kõik / mõni) | v27 top-9 |
|---|---:|---:|---:|---:|
| v26 jooksu 1 plaan | 32 / 43 | 32 / 43 | 28 / 34 | 28 / 34 |
| v27 jooksu 1 plaan | 32 / 43 | 32 / 43 | 26 / 35 | 28 / 37 |

- Valija hulga ankrukatvus on mõlemas põlvkonnas sama. Erinevused on mõne koha nihked (`laws-05`, `laws-07`, `laws-11`, `guides-*`, `journal-b-08`). v27 plaaniga on v27 top-9 isegi parem.
- `laws-03` on nelja salvestatud plaaniga mõlemas põlvkonnas identne:
  - § 27 (kaks ankrut) on hulgas kohal 13 või 20;
  - § 28 („Hädaohus olevast lapsest … 112“) ei jõua hulka ilma plaani päringute vektoriteta.
- **Järeldus:** fikseeritud sisendiga korpuse mõju ankrukatvusele ei ilmnenud. Otsast lõpuni jooksude vahe (38/35 vs 33/34) tuleb tõenäoliselt jooksuti muutuvatest plaani päringutest, nende vektoritest ja valija otsustest. Tõendamata jääb plaani päringute vektorkanal, sest neid vektoreid polnud salvestatud.
- **Edasi:** `assist-eval-v26.mjs` salvestab nüüd plaani vektorid (`PLAN_VECTORS_OUT`) ja võrdlus võtab need `--plan-vectors` kaudu. Järgmine hindamisjooks on seega täielikult korratav ilma uue ostuta. Otsingut testküsimuste ega oodatud dokumendi-ID-de järgi ei kohandatud.

**Failid:** `tmp/rag-v2-dev-2026-09-27/compare-plans-v26.json`, `compare-plans-v27.json`, `compare-laws03-*.json` (ka serveris `/home/ubuntu/rag-v2-work/eval-files/`).

## Serveri kontroll pärast deploy'd (PR #205, plaan `m4-corpus-chat-20260927p`)

Deploy `f0a8e8ab`, plaan `…-1230` (`m4-grounded-dialogue-11`, värskus `current`), soojendus 279 s. Kontroll oli ainult lugemine (`scope-check.mjs`): päris indeks v27, päris omavalitsuste register ja EstNLTK, mudeli- ja embedding-kutseid 0.

| Kontroll | Tulemus |
|---|---|
| Kehtivus 27.09.2026 | 1124 teadmusdokumendist jääb 1123; välja jääb ainult Sotsiaalhoolekande seadus 2026-10-01..2026-11-30 (`not_yet_in_force`) |
| Kehtivus 01.10.2026 | välja ei jää midagi |
| Täna + küsitud 2023 | sama mis täna; tänast õigust ei eemaldata |
| „Mu isa elab Narvas …“ | `narva_linn`; omavalitsuse tekstidest jääb ainult Narva oma, 53 teise omavalitsuse korda välja |
| „Ta elab Narva-Jõesuus.“ | `narva_joesuu_linn`; ainult Narva-Jõesuu oma |
| „Ema elab Tartus.“ | `ambiguous_region` [`tartu_linn`, `tartu_vald`]; korpuses pole kummagi korda, seega ei jää ühtegi |
| „Elan Tartu vallas.“ | `tartu_vald`; korda pole, seega ei jää ühtegi |
| Omavalitsust nimetamata küsimus | ühtegi omavalitsuse korda |
| F3 vene keeles, plaani päring „Narva eakate koduteenus ja hooldus“ | `search_plan_region` `narva_linn`; Narva-Jõesuu kord jääb välja |

F3 plaani päring oli selles kontrollis käsitsi antud. Päris plaani kirjutab otsinguabi; kas see nime alati hoiab, on mõõtmata (vt 2).
