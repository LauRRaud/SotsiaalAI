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

**Tehtud 27.09.2026 (korpus v29, [ADR-035](../rag-v2/adr-035-record-links-and-shs-versions.md)):** nii A kui B lisati korpusesse. Uusi sisendeid oli 83 (46 777 tokenit), kulu 0,006 USD.

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

## 4. Commit'ide #209–#211 kohalik ülevaatus: versioonipõhine indeks

27.09.2026. Vaadatud kohalik vahemik `2769c706b..3282a44d0`: dokumentatsioon
`891712b4e`, indeksi muudatus `1b69078a5` ja kaks registreeritud õigusteksti
`3282a44d0`. Serverit ega `origin/main`-i selles ülevaatuses ei mõõdetud.

**Järeldus:** vaadatud muudatuses uut kinnitatud käitumisviga ei leitud.
`versions-v1` teeb indeksi kirjutamise dokumendiversioonipõhiseks. Terve
sisestus-/ostu-/indekseerimisvoo ajakulu ei sõltu veel ainult lisatud tekstist.

### Kontrollitud

- `tests/rag-v2-version-index.integration.test.mjs`: 5/5 päris kohaliku PostgreSQL-i
  ja Qdrantiga. Lisamine, eemaldamine, versioonide eraldatus, katkestusest
  jätkamine, rikutud punkti/valmimismärgi tuvastus ning CLI. Selle faili
  morfoloogiaprofiil on `MORPHOLOGY_LEXICAL`, mitte EstNLTK.
- `tests/rag-v2-index-jobs.integration.test.mjs`: 11/11 ja
  `tests/rag-v2-knowledge.test.mjs`: 7/7. Esimesel käivitamisel peatusid kaks
  CLI-testi veaga `morphology_unavailable`; olemasoleva keskkonna
  `tmp/rag-v2-estnltk-env/Scripts/python.exe` määramise järel läbisid mõlemad.
- Täiendav sõltumatu kontroll päris EstNLTK-ga:
  `tmp/rag-v2-commit-review-2026-09-27/version-index-probe.test.mjs`, 1/1.
  Kolme sünteetilise dokumendi vana ja uue salvestusviisi tekstiosad olid võrdsed;
  kolm fikseeritud päringut andsid identsed sõnalised ning vektortulemused koos
  skooridega. Uue indeksi ehitamisel analüüsiti morfoloogiat üks kord.
  Kahe dokumendi / kahe tekstiosa lisamisel oli vanade dokumentide
  `importSnapshot`-kutseid **0**, vanade punktide `upsert`-kirjutusi **0**,
  uusi dokumendiimporte **2** ning morfoloogia sisendtekste **6**
  (pealkiri, sisu ja otsinguabi iga uue tekstiosa kohta).
- Kokku 24 eristuvat testi; ajavöönd `TZ=UTC`. Kõik vektorid olid testadapterist
  või sünteetilisest salvestatud pearaamatust. Väliseid mudelikutseid **0**.
- Muudetud JS/MJS-failide sihtlint, `prisma validate --schema prisma/rag-v2/schema.prisma`
  ja commit'ide `git diff --check` läbisid.
- Kahe uue XML-i failiräsid vastavad registrile. XML-i metaandmed vastavad
  commit'i kirjeldatud kehtivusvahemikele: SHS 01.01–31.01.2027, HMS alates
  01.01.2027. Väline õiguslik sisukontroll ei olnud selle koodiülevaatuse ulatuses.

### Alles jäävad piirid (ei ole uued regressioonid)

1. **Ostu ettevalmistus loeb endiselt kogu valiku.**
   `buildCorpusEmbeddingPlan` (`lib/rag-v2/search/multi-source-plan.js`) laeb
   iga poliitikasse kuuluva dokumendi ja koostab selle embedding-sisendid uuesti.
   Nii ostuskript kui ka indeksi CLI laadivad `reusableEmbeddingCatalog` kaudu
   kõik etteantud arhiivide vektorifailid mällu enne muudatuste töötlemist.
   Seega vanu indeksiridu ja punkte ei kirjutata, kuid kogu käsureavoo käivituskulu
   ning mälukulu kasvavad endiselt arhiivi/valiku mahuga. Edasi on vaja
   muudatusepõhist ostuplaani ja vajaduspõhist vektoriarhiivi lugemist.
2. **Mahupiir on 10 000 dokumenti / 60 000 tekstiosa terve põlvkonna kohta.**
   `lib/rag-v2/search/capacity.js` ei muutunud. Vestluses toodud näide
   300 × 250 = 75 000 uuest tekstiosast ei mahu praeguse piiriga indeksisse;
   väiksemate portsjonitena avaldamine ei tõsta kogu põlvkonna ülempiiri.
3. **Avaldamise järel vajab vestlus endiselt uut plaani ja taaskäivitust.**
   Automaatne taustatöö ning katkestuseta vestlusse kasutuselevõtt on ADR-036-s
   õigesti märgitud järgmiste etappidena; see commit neid ei teosta.

Serveri v30/v31 tulemused, tegeliku korpuse otsingu võrdsus, lisamise kiirus ja
kettaruumi vabastamine on selles ülevaatuses `NOT_PROVEN`. Väikese valimi
testvektorite võrdsus tõendab salvestus- ja otsingumehhanismi, mitte pärismudeli
semantilist kvaliteeti. Rakenduse koodi, tootmisandmeid ja serveriseadistust ei
muudetud.

### Hilisem serveritõend (lisatud 27.09 õhtul, Claude)

Ülaltoodud järeldus ja `NOT_PROVEN` kehtivad selle kohaliku ülevaatuse ulatuses. Serveris mõõdeti
hiljem ([ADR-036, „Mõõtmine serveris“](../rag-v2/adr-036-version-index.md#mõõtmine-serveris-27092026)):

- v30 (v29 korpus esimese `versions-v1` põlvkonnana) andis v29-ga identsed sõnalised ja vektortulemused
  koos skooridega (4 + 3 päringut ja 200 dokumendi tekstiosad).
- v31 lisas kaks õigusteksti: indeksi töö 47 s (6000 dokumenti nimekirja, 2 töödeldud).
  v30 tekstiosa ridade, valmimismärkide ja punktide räsid olid enne ja pärast samad.
  Vestlus vastas töö ajal v30-lt.
- Vanad põlvkonnad kustutati omaniku loal; vaba kettaruum 8,2 → 12 GB.
- Piir 1 (ettevalmistus) on PR #212-s parandatud: vektoriarhiive loetakse vajaduse järel ja ostuplaan
  jätab indeksis valmis versioonid välja. Mõõdetud: ostuplaan 2 min → 4,4 s, indeksi plaan 39 s → 4,7 s
  (v31 korpus, midagi uut). PR #212 vajab veel eraldi koodiülevaatust ja ostu/indeksi töö aega uute
  dokumentidega.
- Piirid 2 (60 000 tekstiosa) ja 3 (vestlusplaani vahetus) kehtivad endiselt.

## 5. PR #212 koodiülevaatus ja väljalaskeraja puudus

27.09.2026, Codex. Üle vaadatud `3282a44d0..da69c0eaa` koodimuudatused:
vektorite vajaduspõhine lugemine (`pilot-runner.js`), valmis versioonide
väljajätmine ostuplaanist (`multi-source-plan.js`) ja ostukäsu `--indexed` rada.
Serverisse selles kontrollis ei ühendutud; serveri ajad ja katkestuse ajavahemik
on omaniku edastatud tööaruandest ning ADR-036-st.

**Koodimuudatuse järeldus:** uut kinnitatud regressiooni ei leitud.
Vektorifaili sisu ja räsi kontrollitakse esimesel kasutusel; eri arhiivide
kattuvad vektorid võrreldakse endiselt. Välja jäetavad versioonid küsitakse
tenant'i ja sihtseadistuse järgi `ready` kirjetest; nende arv ja loendi räsi
kuuluvad kinnitatava manifesti identiteeti. Muutunud manifest ei saa kasutada
vana ostukinnitust. Ostu CLI vajab `--indexed` lippu nii plaanis kui täitmises.

**Kohalikud kontrollid:**

- `tests/rag-v2-pilot.test.mjs`, `tests/rag-v2-admin-intake.test.mjs` ja
  `tests/rag-v2-index-jobs.integration.test.mjs`: kokku **50/50**, sh
  vajaduspõhine lugemine, kasutusel avastatav rikutud vektor, muutumatu
  pearaamatu korduskasutus, kulu-/kinnituspiirid, ligipääsu tagasivõtmine,
  indekseerimise jätkamine ja sünteetiliste pärisrežiimi vektorite CLI.
- `TZ=UTC`; EstNLTK jaoks olemasolev
  `tmp/rag-v2-estnltk-env/Scripts/python.exe`; integratsioonitestidel päris
  kohalik PostgreSQL ja Qdrant. Väliseid mudelikutseid **0**.
- Nelja muudetud JS/MJS-faili sihtlint ja commit'i `git diff --check` läbisid.

4,4 s / 4,7 s mõõdavad muutusteta korpuse ostu- ja indeksiplaani. #212 järel
uute dokumentidega ostu ja indeksi töö serveriaeg jääb eraldi mõõtmiseks;
testadapterite läbimine seda ei tõenda.

**Oluline olemasolev väljalaskeraja puudus (ei tekkinud PR #212-s):**

- `scripts/deploy-server.mjs:277–288` tuvastab aegunud/vigase vestlusplaani,
  kuid väljastab ainult hoiatuse ja jätkab väljalaset.
- `lib/rag-v2/pilot/config.js:98–101` keeldub uue vastuse käivitamisest, kui
  plaani `implementationHash` ei vasta jooksvale koodile.
- `.github/workflows/deploy.yml:92–96` kontrollib ainult `/api/health`-i ja
  avalehe HTTP-edu. `/api/health` kontrollib põhiandmebaasi `SELECT 1` päringut,
  mitte vestlusplaani sobivust. Seetõttu võib deploy olla roheline ajal, mil
  vestlus ei vasta.

Omaniku aruande järgi oli pärast #212 väljalaset umbes 21:08–21:27 Eesti aja
järgi vestlus ilma sobiva plaanita, sest väline jälgimisskript ei märganud
deploy lõppu. Ajad ei ole selles ülevaatuses sõltumatult mõõdetud, kuid koodis
kirjeldatud puudus on kinnitatud. Pelgalt jälgimisskripti parandamine ei seo
uut koodi ja sobivat plaani üheks kontrollitud väljalaskeks.

Järgmine töö: kontrollida kinnitatud plaani, koodi ja aktiivse indeksi
kooskõla mudelikutseta ning teha see kasutuselevõtu kohustuslikuks kontrolliks.
Sobiva plaani puudumisel peab säilima töötav koodi/plaani/indeksi komplekt;
kontroll tuleb siduda olemasoleva tingimusliku tagasipöördumisrajaga ja tõendada
vana komplekti taastumine. Ainult hoiatuse muutmine veateateks ei ole selle
vastuvõtutõend. Kinnituse ulatust ja kulupiiri ei nõrgendata. Käesolev ülevaatus
seda parandust ei teosta.

## 6. PR #214–#216: plaani uuendus ja õigusaktide värskendus

27.09.2026, Codex. Kontrollitud #214 (`6f9461638`, kohalik sama koodiga
`9ca966755`), #215 (`cad6ef67f`) ja #216 (`c5f5657da`). `origin/main` toodi
üle ja kontrolli hetkel osutas see `c5f5657da`-le. Kohalikku haru ei vahetatud.
Serverisse ei ühendutud; #214 eduka deploy ja vestluspöörde kohta on omaniku
edastatud aruanne. v32 ostu/indeksi töö tulemus ja serveris kasutuselevõtt
on selle ülevaatuse ulatuses **NOT_PROVEN**.

**P1 — automaatne uuendus taastab juba kasutatud eelarve.**

- `lib/rag-v2/pilot/chat-plan.js:68` annab uuendusele uue `id`, kuid kopeerib
  eelmise plaani kogu eelarve. `PilotStore.reserve` (`store.js:102–117`)
  otsib kulupäevikut selle uue id järgi ja alustab puuduva päeviku korral
  nullist. `renewedFrom` ei kanna kulu ega reserveeringuid edasi.
- Sõltumatu katse käivitas päris `renewChatPlan`-i ja `PilotStore.reserve`-i
  mälus oleva andmebaasiadapteriga: vana plaani 4 USD piir oli ammendatud
  ja uus 1 USD broneering lükati õigesti tagasi. Automaatse uuenduse järel
  sama broneering lubati: kahe päeviku summa **5 USD**, kinnitatud piir
  endiselt **4 USD**. Väliseid kutseid 0; tegu pole serveri tegeliku kuluga.
- Arvulise eelarve võrdsus (`approvedScope`) ei tõenda allesjäänud eelarve
  säilimist. Vajalik on uuenduste ühine eelarvearvestus või varasemate kulude
  ja pooleliolevate broneeringute ülekandmine. Üksnes vana id säilitamine
  pole piisav, sest päevik kontrollib ka muutuvat `configHash`-i.
- Korratav sond: `tmp/rag-v2-commit-review-2026-09-27/release-budget-probe.mjs`
  (kohalik ignoreeritud kontrollifail, mitte tootekoodi muudatus).

**P2 — RLS-i lisatavas redaktsioonireas puudub 31.10.2026 katvus.**

- Lisatud `111072026166.xml:24` lõpeb `2026-10-30`; järgmine,
  `111072026167`, algab `2026-11-01`. Sama tagastasid kontrollimisel RT
  ametlikud [esimese](https://www.riigiteataja.ee/et/akt/111072026166.xml)
  ja [järgmise](https://www.riigiteataja.ee/et/akt/111072026167.xml) redaktsiooni
  XML-id (HTTP 200). See on allikaandmete lahknevus, mitte tõend vale impordi kohta.
- Päris `legalValidityScope` sai sisendiks v32 kohaliku ülevaatuse
  `oigusaktid-b/review.json` viis RLS-i dokumenti: 30.10 jääb üks,
  **31.10 jääb null**, 01.11 jääb üks redaktsioon. Aruandes kavandatud
  viiel kuupäeval on selles partiis igaühel üks sobiv RLS-i tekst;
  need kuupäevad ei tuvasta vahele jäävat päeva.
- Enne pideva katvuse kinnitamist tuleb selgitada 31.10 ametlik redaktsioon
  ning lisada piiripäevade kontroll. XML-i lõppkuupäeva ei tohi tõendita
  pikendada. Kõik registrifailid ei võrdu aktiivse korpusega: registris on
  ka vana sama akti-ID-ga koopia; seda ei kasutatud partii katvuse tõendina.

**Tagasipöörde täpsustus.** #214 taastab vana koodi, buildi ja muutmata
`rag.env`-i plaani eelkontrolli vea korral enne põhiandmebaasi migratsiooni.
Pärast migratsiooni/taaskäivitust ebaõnnestuv `ready` annab exit 9, kuid jätab
uue koodi ja plaani serverisse. Samuti jätkab `unready active_index_mismatch`
deploy'd hoiatusega. Need on ADR-037-s dokumenteeritud piirid, mitte selles
ülevaatuses avastatud uued regressioonid. Üldväide „iga vea korral taastub
eelmine töötav komplekt” ei vasta koodile.

**Läbinud kontrollid.**

- #214 kolm testifaili: **10/10**, sh päris kohaliku PostgreSQL/Qdranti ja
  EstNLTK-ga uuendamine ning tegelik deploy-skript asendatud süsteemikäskudega.
  Esimene deploy-testide käivitus kasutas ekslikult WSL-i Bashi; Git Bashi
  asetamine PATH-is esimeseks kõrvaldas `/c/...` rajavea, kõik neli läbivad.
- Seitsme JS/MJS-faili sihtlint ja commitivahemiku `git diff --check` läbisid.
- #215: **39/39 XML-i** räsi ja akti-ID vastavad registrile; 17 muudetud
  faili normaliseeritud `sisu`-tekst on varasemaga sama, 22 uut faili
  sisaldavad sisulisi paragrahve. Õigusaktide loendur on 132.
- #216: registrifaili räsi vastab `REGISTER.json`-ile; päris
  `registeredSource` seob kõik partii 27 KOV-i teksti omavalitsusega ja
  jätab 12 riiklikku teksti KOV-ita. Mõlemad Jõhvi tekstid on `johvi_vald`,
  nimi „Jõhvi vald”, seose alus `issuer_name`.
- Andme- ja piiripäevade sondid on samas kohalikus kontrollikaustas:
  `legal-data-probe.py`, `legal-runtime-probe.mjs`. Tasulisi mudelikutseid 0.

### Parandused ja serveritulemus pärast ülevaatust (lisatud 27.09 õhtul, Claude)

Ülaltoodud leiud ja `NOT_PROVEN` kehtivad selle ülevaatuse ulatuses.

- **P1 parandatud:** uuendatud plaan nimetab kinnitatud plaani kulupäeviku (`budgetLedger`) ning `PilotStore`
  broneerib, lukustab ja arvestab selle järgi ([ADR-037](../rag-v2/adr-037-release-chat-plan.md)). Test kordab
  ülevaatuse sondi: 3 USD kulutatud kinnitatud plaanil → uuendus saab broneerida 1 USD samasse päevikusse ja
  siis mitte midagi; võõras plaan päevikut kasutada ei saa.
- **P2:** 31.10.2026 katmata RLS-i päev on RT ametlikes andmetes (vt ülal). v32 kehtivuskontroll lisab
  piiripäevad 30.10, 31.10 ja 01.11: 31.10 pole ühtki RLS-i teksti, teistel päevadel üks. Lõppkuupäeva ei pikendata;
  RT kontrollitakse enne 31.10 uuesti.
- **Deploy-testid** valivad Windowsis nüüd Git Bashi ka siis, kui PATH-is on esimesena WSL-i `bash`.
- **v32 serveris** ([ADR-036](../rag-v2/adr-036-version-index.md#mõõtmine-serveris-27092026)): ostuplaan 6,5 s,
  ost 79 s (303 sisendit, 0,016 USD), indeksi plaan 6,0 s, indeksi töö 61 s (5985 dokumenti nimekirja, 39 uut);
  v31 räsid muutumata; Tallinna küsimus tsiteeris 01.07.2026 määrasid.

## 7. PR #217 eelarveparanduse järelkontroll

27.09.2026, Codex. Kontrollitud liidetud commit `89948b43d`; kohalik
`13a54a50f` on kontrollitud koodi ja testide osas sama. Serverisse ei ühendutud.

**Varasem P1 on kontrollitud paranduse ulatuses lahendatud.** `renewChatPlan`
kannab `budgetLedger`-iga edasi algse kinnitatud plaani päeviku ka teise
uuenduse järel. `PilotStore` kasutab sama võtit lukustamiseks, broneerimiseks,
piiride kontrolliks ja broneeringut ületava tegeliku kulu arvestuseks.

- `rag-v2-chat-plan.test.mjs` ja `deploy-plan-release.test.mjs`: **9/9**.
  Kuluarvestuse test lubab 3 USD kasutuse järel samasse päevikusse 1 USD
  ning lükkab järgmise broneeringu tagasi; uuendused jagavad lukuvõtit.
- Algse sõltumatu sondi järelkontroll: 4 USD ammendatud eelarve korral
  keelduvad algne plaan, esimene uuendus ja teine uuendus uutest
  broneeringutest. Alles on **üks päevik ja 4 USD**; väliseid kutseid 0.
  Sond: `tmp/rag-v2-commit-review-2026-09-27/release-budget-fixed-probe.mjs`.
- Kuue muudetud JS/MJS-faili sihtlint ja commitivahemiku diff-kontroll läbisid.
  Uut kinnitatud regressiooni ei leitud. Päris andmebaasi samaaegsete uuendatud
  plaanide koormuskatset selles järelkontrollis ei tehtud.

Omaniku edastatud serveriaruandes uuendas #217 plaani automaatselt,
`ready` läbis ja vestluspöörde kulu läks v32 kinnitatud plaani `…-1937`
päevikusse (0,0201 → 0,0357 USD), uut päevikut ei tekkinud. Need on
edastatud serveritõendid, mitte selle järelkontrolli sõltumatu serverimõõtmine.

RLS-i 31.10.2026 katvuse leid jääb avatuks. Järgmine põhjendatud töö on
aktiivse korpuse akti-ID-de ja kehtivuste korratav võrdlus RT-ga, järglaste
leidmine kõigilt tulemuselehtedelt ning redaktsioonide piiripäevade ja
vahele jäävate päevade raport. RT päringu tõrge või leidmata järglane peab
jääma eristatavaks kinnitatud muutumatusest. Ajastus ja allikamuudatuste
avaldamine ei ole selle ülevaatuse käigus teostatud.

### Hilisem töö (lisatud 27.09 hilisõhtul, Claude)

Selle järelkontrolli ulatus ei muutu. Kehtivuskontroll on tehtud [ADR-038](../rag-v2/adr-038-law-validity-check.md)-ga ja ootab koodiülevaatust.

- **Tööriist:** manifest aktiivse korpuse 87 aktist 64 grupis. Kontroll võrdleb iga akti praegust kehtivust, grupi kõiki redaktsioone ja kehtetuks tunnistamise märkeid, lünki ja kattuvusi päeva täpsusega.
- **Otsingu-API lehed pole stabiilsed:** 521 tulemuse teine leht kordas 20 esimese lehe akti. Kontroll küsib lehti uuesti, kuni `kokku` täitub. Kui see ei täitu, on tulemus tõrge, mitte muutumatus.
- **Ajastus:** omanik otsustas, et kontroll käib kord kuus. GitHub Actions jookseb 25. kuupäeval, järgmine jooks on 25.10, enne RLS-i 31.10. Leiud lähevad issue'sse, tõrge teeb töö punaseks.
- **Esimene jooks v32 peal:** 62/64 gruppi muutumata ja 0 päringutõrget. Leitud olid RLS-i 31.10.2026 lünk ning SHS-i 2027. aasta redaktsioonid alates 01.02, mida korpuses pole.

## 8. PR #218 kehtivuskontrolli koodiülevaatus

27.09.2026, Codex. Kontrollitud liidetud commit `556d6c067`; kohalik
`7af66c592` on kontrollitud koodi, testide ja workflow osas sama. PR on
`origin/main`-is. Avalikke RT päringuid, GitHubi workflow käivitamist ega
issue kirjutamist selles ülevaatuses ei tehtud. Esimese pärisjooksu 62/64
tulemus on teostaja aruanne, mitte siin korratud mõõtmine.

**P1 — korpuses olev võimalik asendaja vaigistab lõppeva grupi hoiatuse.**

- `lib/rag-v2/law-validity.js:70–72` loeb kõik `in_corpus` kandidaadid
  tõendatud asendajateks. Nende kandidaadiks saamiseks piisab samast
  väljaandjast, otsingusõnast ja algusest vana grupi lõpu lähedal
  (`scripts/rag-v2-law-validity.mjs:128–142`); ametlikku asendusseost pole vaja.
- Sõltumatus katses lõppes sotsiaalabi kord 26.09 ja korpuses oli 27.09
  alanud teise grupi sotsiaalosakonna töökorralduse akt. `analyseGroup`
  andis `unchanged`, tühja `review` ja märkuse `replaced_in_corpus`.
  Kui muid leide pole, ei ava selline tulemus issue't või sulgeb olemasoleva.
- Võimalik asendaja peab jääma inimese ülevaatusele ka siis, kui fail on
  juba korpuses. Hoiatuse vaigistamiseks on vaja kinnitatud seost, näiteks
  ametlikku viidet või ülevaatuse tulemust. Ka praeguse ühiktesti vastav
  ootus kinnitab liiga nõrka tingimust ja vajab muutmist.

**P2 — täiendav otsing muudab tuvastatud kehtetuks tunnistamise kirje tavaliseks tekstiks.**

- `scripts/rag-v2-law-validity.mjs:118–119` lisab puuduvale tühjale RT kirjele
  `repealed`/`repealed_by`. Kui kehtetuks tunnistanud akti korpuses pole,
  järgneb asendajate otsing. Rida 133 asendab sama akti `version(act)`
  objektiga ja kaotab need tunnused, sealhulgas vahemälust saadud otsingul.
- CLI katse kohaliku HTTP-serveriga: vana tekst lõpeb 26.09, 27.09 algab
  tühi `Kehtetu` kirje viitega korpuses puuduvale aktile. Tulemuseks on
  tühja kirje kohta `missing_version`, **puudub `group_repealed`** ja
  ülevaatuse nimekiri on tühi. Nii võib allalaadimiseks soovitatud tekst
  olla just see tühi kirje, mida tööriist pidi eristama.
- Otsingutulemuste liitmine peab säilitama kontrollitud XML-ist saadud
  tunnused või tuleb lõplik liikmete loend uuesti klassifitseerida.

**P2 — kõiki 404 vastuseid ei märgita päringutõrkeks.**

- Puuduva avaldatud redaktsiooni XML-i 404 annab `currentText`-ist `null`,
  mille read 118–119 jätavad tõrketa. Otsingu 404 muutub real 66 nulli
  valikulise lugemise tõttu täielikuks nulltulemuseks. Indekseeritud akti
  enda 404 käsitletakse samas õigesti real 108.
- Mõlemad CLI katsed läbisid: puuduva redaktsiooni XML-i 404 andis
  `changed`, otsingu 404 andis `review`; **mõlemal exit 10 ja `errors: []`**.
  Workflow jätab exit 10 korral töö roheliseks. See ei täida lubadust,
  et ebaõnnestunud päring annab `fetch_failed` ja exit 20.
- 404 tuleb käsitleda kutsuja kontekstis ning otsingu vastuse struktuur
  valideerida enne selle tühjaks täielikuks tulemuseks lugemist.

**Kontrollid ja piirid:**

- Uue faili `tests/rag-v2-law-validity.test.mjs` **3/3 testi** läbisid,
  sealhulgas 503 ja mittetäielike lehtede tõrkerajad. Need ei kata ülaltoodut.
- Kolme muudetud JS/MJS-faili sihtlint ja commitivahemiku diff-kontroll läbisid.
- Sõltumatu sond `tmp/rag-v2-commit-review-2026-09-27/law-monitor-probe.mjs`
  kordab nelja juhtu: tõendamata kandidaat, kadunud `repealed`, XML-i 404
  ja otsingu 404. JSON-raportid on sama kausta `law-monitor-fixtures/` all.
  Sisendid on sünteetilised, võrk piirdus kohaliku HTTP-serveriga.
- Git-manifestis on 87 akti, 64 gruppi, puuduv akti-ID 0 ja puuduv grupi-ID 1
  (eraldi akti rada). Ajakava on iga kuu 25. päeval 04:15 UTC.
  Ajastatud töö ja GitHubi teavituse tegelik käivitumine on siin `not_run`.
- Kord kuus töötamine ja manifesti käsitsi uuendamine on dokumenteeritud
  valikud. Kuine kontroll saab hinnata selle käivitumise ajaks avaldatud
  muudatusi; hiljem avaldatud redaktsioon ei pruugi jõustumise eel nähtavale jõuda.

### Parandused pärast ülevaatust (lisatud 27.09 öösel, Claude)

Ülaltoodud leiud kehtivad commit'i `556d6c067` kohta. Parandused on [ADR-038](../rag-v2/adr-038-law-validity-check.md#parandused-pärast-codexi-ülevaatust-218)-s ja järgmises PR-is.

- **P1:** märkuse `replaced_in_corpus` annab ainult RT kehtetuks tunnistamise märke viide korpuses olevale aktile. Korpuses olev lähedane kandidaat jääb ülevaatusele. Ühiktesti ootus on muudetud.
- **P2 (kehtetuks tunnistamise märge):** asendajate otsing ei kirjuta juba loetud redaktsiooni üle. Uued redaktsioonid loetakse XML-ist samamoodi.
- **P2 (404):** avaldatud redaktsiooni või kandidaadi XML-i 404, otsingu 404 ja vastus ilma `kokku`/`aktid` väljadeta annavad `fetch_failed` ja exit 20. `--download` tõrked jõuavad aruandesse.
- **Testid:** sõltumatu sondi neli juhtu on nüüd `tests/rag-v2-law-validity.test.mjs`-is. Vana koodiga annab sama test Codexi tulemused: P1 `unchanged` märkusega, P2 `missing_version:451`, 404 ilma tõrgeteta. Uue koodiga on tulemused `review`, `group_repealed` ja `fetch_failed` (`not_found`, `not_found`, `invalid_response`).
- **Pärisjooks v32 peal pärast parandust:** 62/64 muutumata, 2 muutunud, 0 päringutõrget. Kolm märkust põhinevad RT ametlikul viitel.

## 9. Otsingu ajamõõtmise ja mäluväidete kontroll (28.09)

Codex, kohalik `main` `784737c77` (#222). Loetud praegust otsingurada ja
kohalikku `tmp/rag-v2-dev-2026-09-28/qdrant-scale-bench.mjs` sondi. Serveri
mäluseadeid ega andmeid ei muudetud; uusi koormuskatseid ei käivitatud.
Edastatud serverimõõtmiste sõltumatu kordus on `not_run`.

- **Kanalite ajad on olemas, kuid kaovad enne salvestamist.**
  `search/retrieval.js` täidab `measurements.timings_ms`-i. `mergeUnifiedPackets`
  (`search/unified.js:137–141`) jätab need välja ja tagastab mudeliprojektsiooni
  mõõdikud. `pilot/service.js:210–213` ei kopeeri `measurements` välja
  salvestatavasse paketti. Vajalik on ajad edasi kanda otsinguradade kaupa ning
  salvestada need tehnilisse auditisse. Ajad ei pea jõudma mudeli sisendisse.
- **Praegused kanaliajad pole ainult andmebaasi täitmisaeg.** Vektori mõõtmine
  hõlmab ka päringuvektori lugemist, filtrite koostamist, serialiseerimist,
  transporti ja vastuse töötlemist; leksikaalne mõõtmine ka morfoloogiat.
  Kanalid jooksevad paralleelselt, seega nende aegu ei liideta pöörde kestuseks.
- **ID-loendi eemaldamine vajab samaväärset piirangut.** Dokumentide ja
  versioonide piirid on eraldi SQL-i/Qdranti filtrites; `eligibleIds` välistab
  lisaks `document_label`, `record_binding` ja `record_links` rolliga tükid.
  Lihtne loendi eemaldamine võib muuta kandidaate või anda
  `channel_result_outside_scope`. Kohalik mahusond lubab kõiki valitud
  dokumentide tükke, seega ei tõenda selle kahe päringu võrdsus päris korpuse
  samaväärsust. Võimalik katse: sama ulatuse sees väiksem välistatud ID-de loend,
  filtreerides endiselt enne kandidaatide `LIMIT`-it.
- **`exact: true` ei kasuta int8 kvantimist.** Seda kinnitab
  [Qdrant 1.19.1 lähtekood](https://github.com/qdrant/qdrant/blob/v1.19.1/lib/segment/src/index/vector_index_search_common.rs#L15-L24).
- **`memory.low` on parima võimaliku kaitse piir, mitte RAM-i reserveerimine
  ega andmete eellaadimine.** Toime sõltub ülemistest cgroup'idest;
  `memory_recursiveprot` korral saab alampuu kaitset pärida ilma iga lehe
  eraldi piirita. Väide, et mõlemad väärtused peavad alati olema mittenullid,
  vajab serveri tegeliku hierarhia ja mount-valikute täpsustust.
  [Linuxi dokumentatsioon](https://www.kernel.org/doc/html/v6.12/admin-guide/cgroup-v2.html#memory-interface-files).
- **128 MB `shared_buffers` võrreldes 653 MB tabeliga ei tõenda I/O-pudelikaela.**
  PostgreSQL kasutab lisaks operatsioonisüsteemi vahemälu
  ([dokumentatsioon](https://www.postgresql.org/docs/current/runtime-config-resource.html#GUC-SHARED-BUFFERS)).
  1,7 GB vaba mälu võimalikku mõju tuleb hinnata sama päringu ajal mõõdetud
  kanalite aegade, I/O, lehevigade ja mälusurvega; sülearvuti 1×/2×/4× katse
  näitab selle masina skaleerumist, mitte serveri külma päringu kindlat aega.

### 9.1. Opuse 1×/2×/4× mõõtmisaruande järelkontroll (28.09)

Loetud lisatud mõõtmisaruanne ja kohalik
`tmp/rag-v2-dev-2026-09-28/lexical/lexical-scale-bench.mjs`. Ajatabel on
Opuse edastatud tulemus; mõõtmisi ei korratud. Käituskoodi ja serveriseadeid ei muudetud.

- Aruande järgi annab Qdranti ID-loendi eemaldamine 1× mahul 92 → 64 ms ja
  4× mahul 209 → 100 ms: vastavalt 28 ja 109 ms. See ei selgita üksi kirjeldatud
  mitmesekundilist aeglustumist. Sõnaline päring on soojas katses kulukam
  (1× umbes 1 s, 4× umbes 3 s). Mälu kui külma päringu põhjuse tõend jääb lahtiseks.
- Sõnaline sond kasutab tootmisega sama `ts_rank` + 0,35 morfoloogiakaalu ning
  samu kolme paralleeltöötaja planeerimisseadeid. Dokumendivalik on aga
  `HAVING count(*) > 1`; päris rada kasutab `record_kind`, õigusi, kehtivust ja
  piirkonda ning tõendikõlblike tekstiosade loendit. Seega ei ole see kogu
  vestluse otsingurada täpselt kordav katse.
- `matched_rows_long_query` loetakse kogu katsetabelist, ilma ajastatud päringu
  dokumendi- ja tekstiosafiltrita. Väidet „91% vestluspäringu ulatusest” tuleb
  kontrollida sama ulatuse lugeja ja nimetajaga. Sond ajastab päringud järjest;
  ühe päringu paralleeltöötajad ei tõenda mitme samaaegse pöörde jõudlust.
- `shared_buffers=1GB` on katsetatav seadistus, mitte 653 MB tabelimahust
  järelduv vajadus. See suurendab puhvrit 896 MiB võrra, kuid kogu PostgreSQLi
  mälu sisaldab ka muud; Qdranti `memory.low` omakorda ei eralda uut gigabaiti.
  Mõju tuleb võrrelda samade päringutega enne ja pärast iga eraldi muudatust.
- Piirid on koodis kinnitatud: indeks 10 000 dokumenti / 60 000 tekstiosa,
  ühine kataloog 10 000 dokumenti, reservpäring kuni 100 dokumenti
  (`search/capacity.js`, `search/unified.js`, `search/ranking.js`). Ainult
  tekstiosade piiri tõstmine ei nõua kataloogi dokumendipiiri tõstmist.
  34 405 tekstiosa ja 6026 dokumendi korral mahub arvuliselt juurde 500 × 40
  tekstiosa (kokku 54 405 / 6526); see ei ole uue mahu latentsuse garantii.
- Soovitatud järjekord: säilitada kanalite ajad auditis, korrata katse päris
  filtritega ja päringuaegse I/O/mälumõõtmisega, katsetada mäluseadeid eraldi,
  seejärel optimeerida sõnalist kandidaatide valikut ning tõsta tõendatud piiri.
  Sagedaste sõnade eemaldamine muudab leitavaid kandidaate ja vajab ka
  olemasoleva mitmekeelse otsinguvalimi tulemuste kontrolli.
