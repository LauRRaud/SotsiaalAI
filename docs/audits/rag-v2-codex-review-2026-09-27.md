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

## 10. PR #224 ajamõõdikud ja mälukaitse katse eelkontroll (28.09)

Codex kontrollis PR #224 koodi (`de02dfb84`, merge `94d68afb6`) ja luges serveri
cgroup'i metaandmeid 28.09 kell 08:15 UTC. Serveri seadeid ei muudetud, päris
vestluspöördeid ega tasulisi kutseid ei tehtud. Opuse nelja pöörde ajatabelit
ei loetud sõltumatult andmebaasist ega korratud.

- **Qdranti enda aeg on nüüd eristatav.** `QdrantIndex.query()` kannab vastuse
  `time` sekunditest millisekunditesse (`server_ms`); `retrieve()` säilitab selle
  kanali `*_server` väljal ja piloot salvestab radade ajad `timings.search` alla.
  8-sekundiline `vector_server` paigutab viivituse Qdranti päringu teenindusse.
  See ei erista iseenesest kettalugemist, protsessori tööd ega ooteaega.
  Neli paralleelset 8-sekundilist päringut ei tähenda 32-sekundilist faasi.
- **`rerank` miinus mudelikutse ei võrdu PostgreSQLi kettalugemise ajaga.**
  Vahemikku kuuluvad kandidaatide koostamine, `postgres.units()`, teksti ja
  tervikluse kontrollid ning hook'i õiguste/raamatupidamise sammud. `units()`
  loeb kandidaatide dokumentide kõik tekstiosad ning kontrollib esmakordselt
  loetud või muudetud ridade morfoloogiat (`search/postgres.js:350–371`). Uue
  sõnastuse valitud uued dokumendid võivad käivitada selle töö. Võrdluskatses
  tuleb hoida otsingusisend/ulatus samana ja mõõta lugemine ning kontroll eraldi.
- **Tegelik hierarhia:** cgroup v2, kernel 6.8.0-142-generic,
  mount-valik `memory_recursiveprot`; mõlemad konteinerid asuvad otse
  `/system.slice/docker-<ID>.scope` all. `memory.low=0` nii vanemal kui ka
  Qdrantil/PostgreSQLil; `memory.high` ja `memory.max` on piiramatud.
  Qdranti `memory.current` oli 399 425 536 B, sellest `file` 350 646 272 B;
  PostgreSQLi `file` oli 3 917 017 088 B. Saadaolev RAM oli 6 819 656 KiB
  ja jooksva mälusurve keskmised nullid. Need on hetkenäidud, mitte tõend
  varasema päringu oleku kohta. Lehevigade/I/O loendurid on kumulatiivsed.
- **Pakutud käsud sobivad pööratavaks katseks, kuid ei isoleeri ainult Qdranti.**
  `system.slice MemoryLow=1500M` kaitseb vanemgruppi ja aktiivse
  `memory_recursiveprot` tõttu võivad sellest kasu saada ka teised lapsed.
  Qdranti eraldi `MemoryLow=1G` määrab talle täiendava selgesõnalise kaitse,
  kuid väide „PostgreSQL jääb kaitseta ja aeglaseks” ei ole tagatud.
  [Kerneli lepingu kirjeldus](https://www.kernel.org/doc/html/v6.8/admin-guide/cgroup-v2.html#mounting).
- **Katse protokoll:** fikseerida väljalase/PID-id ja algsed kaitseväärtused;
  soojendada sama otsing, oodata vähemalt 15 minutit ning korrata seda ilma
  otsingut vahele jätva tulemuste taaskasutuseta. Võrrelda `vector_server` aega
  ning sama akna `io.stat rbytes`, `pgmajfault`, `workingset_refault_file` ja
  PSI muutusi. Üksnes RSS-i langus või kasutatud swap ei tõenda põhjuslikkust.
- **Väljalase oli kontrolli ajaks muutunud:** serveri HEAD `88adf2564` (#225),
  teenus aktiivne, viimane käivitus 11:04:22 EEST. #224 mõõtmistele järgneva
  katse puhul tuleb arvestada seda uut käivitust.

Ettevalmistatud ajutine seadistus (ei käivitatud):

```bash
qdrant_scope="docker-$(sudo docker inspect -f '{{.Id}}' sotsiaalai-rag-v2-qdrant-1).scope"
systemctl show system.slice "$qdrant_scope" -p ControlGroup -p MemoryLow
sudo systemctl set-property --runtime system.slice MemoryLow=1500M
sudo systemctl set-property --runtime "$qdrant_scope" MemoryLow=1G
systemctl show system.slice "$qdrant_scope" -p MemoryLow
```

Tagasipööre juhul, kui vahetult enne katset on mõlemad algväärtused endiselt null:

```bash
sudo systemctl set-property --runtime "$qdrant_scope" MemoryLow=0
sudo systemctl set-property --runtime system.slice MemoryLow=0
```

Katse ei vaja teenuse/konteineri taaskäivitust. Runtime-seadistus ei jää üle
serveri taaskäivituse ning konteineri taasloomisel tekib uus scope. Püsiv
seadistus ja PostgreSQLi puhvri muutmine on eraldi sammud.

## 11. Ajutise mälukaitse võrdluskatse #225 peal (28.09)

Omanik kinnitas järjekorra: Opus küsib sama algse sõnastusega küsimuse, kordab
seda vähemalt 15 min jõudeoleku järel; Codex salvestab loendurid ning rakendab
alles seejärel ajutise kaitse. Seejärel korratakse sama kaitsega. Päris
vestluspöörded teeb Opus; Codex loeb ainult operatiivseid ajamõõdikuid.

**Mõõtmismeetod.** Alates 08:23:24.634 UTC (11:23 EEST) loetakse iga sekund
Qdranti ja RAG-PostgreSQLi cgroup'ide `memory.stat`, `memory.current`,
`memory.swap.current`, `memory.events`, `cpu.stat`, `io.stat`, mälu/I/O PSI
ning kaitseväärtused; kord minutis kontrollitakse väljalaset ja teenuse PID-d.
Tulemused salvestatakse sülearvutisse
`tmp/rag-v2-memory-protection-20260928/cgroup-samples.jsonl`. Jõudeoleku baasis
püsis #225 `88adf2564`, frontend PID `2641170` ja samad konteinerid.
Pöörde auditist loetakse ainult ID, ajad, olek ja numbrilised mõõdikud.
Ajatsoonita Prisma veerud teisendatakse SQL-is `AT TIME ZONE 'UTC'` abil;
serveri kohaliku ajavööndi järgi tõlgendamine annaks ekslikult kolm tundi varasema aja.

### Kaitseta baas

| Mõõdik | Soojendus | Pärast jõudeolekut |
| --- | --- | --- |
| M4PilotTurn ID | `60e915fb-b877-4796-9681-1692e26c5351` | `420f38ec-8f2c-4c73-bfc6-347b95bf89c8` |
| Algus UTC | 08:24:02.784 | 08:40:13.354 |
| Vastuse salvestus UTC | 08:24:21.583 | 08:40:33.687 |
| Otsing ise (`since_start_ms.merged`) | 4089 ms | 3416 ms |
| Põhiotsingu Qdranti serveriaeg | 202–234 ms | 183–229 ms |
| Sõnaline otsing | 1265 ms | 1202 ms |
| `rerank` / selle mudelikutse | 2257 / 1887 ms | 1570 / 1288 ms |
| Qdranti kettalugemine pöördeaknas | 280 KiB | 24 KiB |
| PostgreSQLi kettalugemine pöördeaknas | 124 KiB | 40 KiB |
| Qdranti / PostgreSQLi `pgmajfault` kasv | 29 / 6 | 5 / 0 |
| Qdranti / PostgreSQLi `workingset_refault_file` kasv | 0 / 18 | 0 / 4 |

Paus esimese salvestusest teise alguseni oli **15 min 51,771 s**. Jõudeaknas
(08:24:21.637–08:40:12.637 UTC) oli Qdranti `file` kogu aeg 350 646 272 B;
mõlema RAG-konteineri kettalugemine, faililehtede refault ja `pgscan` ei kasvanud.
Mõlema päringuakna memory PSI kasv oli null. Väljalase/PID püsisid samad ja
salvestuse suurim intervall oli 1,001 s. Loendurid hõlmavad kogu konteineri
tööd vastavas aknas, mitte üksiku SQL-päringu eraldatud kulu.

**Baasi järeldus:** sellel katsel ei põhjustanud ≥15 min jõudeolek aeglustumist
ega RAG-i failivahemälu kadu. Varasem väide automaatsest külmaks muutumisest
jõudeoleku tõttu ei leidnud kinnitust. See ei tõenda veel, milline deploy samm
või muu koormus varasema aeglustumise põhjustas.

### Kaitse rakendamine

**08:41:04.418 UTC** (11:41:04 EEST) rakendas Codex omaniku kinnitatud
runtime-seadistuse pärast baaspöörde lõppu:

- `system.slice memory.low`: 0 → **1 572 864 000 B** (`1500M`);
- Qdranti scope `memory.low`: 0 → **1 073 741 824 B** (`1G`);
- PostgreSQLi enda `memory.low`: **0**, muutmata;
- #225, frontend PID ja mõlema konteineri ID püsisid samad; restarti ei tehtud.

Rakendusskript kontrollis enne muutmist algväärtusi, väljalaset ja PID-sid ning
valideeris pärast tegelikke cgroup'i väärtusi; tõrke korral oleks taastanud
algse nullkaitse. Enne/pärast tõend on
`tmp/rag-v2-memory-protection-20260928/protection-apply.jsonl`.
Omanik muutis pärast sooja jõudeolekubaasi järgmise etapi väljalaskejärgseks
katseks: kaitse peab säilima deploy ajal, seejärel sama küsimus 6–8 min pärast
teenuse käivitust ja alles pärast algsoojenduse lõppu. Kaitsega jõudeoleku
kahte lisapööret ei tehtud.

### #226 deploy kaitse olemasolul

Taustal töötanud salvestaja kattis juba järgmise väljalaske #226 (`5d371a30c`),
[deploy 36400433684](https://github.com/LauRRaud/SotsiaalAI/actions/runs/36400433684).
Codex seda väljalaset ei käivitanud. Mõlema konteineri scope/ID ja seatud kaitse
säilisid; muutus frontend PID `2747238`-ks. Teenuse käivitus **08:59:02 UTC**;
algsoojendus algas 08:59:05.563 UTC.

| Etapp / UTC | Qdranti `file` | PostgreSQLi `file` |
| --- | --- | --- |
| Enne sõltuvuste paigaldust, 08:57:40.637 | 334,4 MiB | 3735,5 MiB |
| Ehituse eel, 08:58:08.637 | 277,5 MiB | 2729,0 MiB |
| Ehituse järel, 08:58:53.637 | 10,6 MiB | 134,5 MiB |
| Pärast käivitust, 08:59:59.637 | 10,6 MiB | 728,0 MiB |

Deploy logi: `npm ci` algus 08:57:41.014, build'i logi algus 08:58:09.882,
kompileerimine lõppes 08:58:47.610, järgnev migratsioonieelkontroll algas
08:58:53.646. Qdranti esimene suur faililehtede langus oli 08:57:57.637;
suurem kadu jätkus ehituse ajal. Konkreetsete alamkäskude eraldatud põhjuslikkust
see üks mõõtmisaken ei tõenda.

08:57:39.637–08:59:14.637 UTC aknas:

- Qdranti `file` vähenes **339 550 208 B** ehk **323,8 MiB** (~96,8%).
  `pgsteal` +84 698, `pgscan` +88 863, **`memory.events.low` +119**.
  `memory.low` oli kõikides proovides 1 GiB ja `system.slice` kaitse 1500 MiB.
- PostgreSQLi `file` miinimum oli 140 910 592 B (~134,4 MiB);
  mõõtmisakna lõpuks hakkas algsoojendus seda juba taastama. `pgsteal` +921 954.
- Proovide suurim vahe oli 1,002 s. OOM-/OOM-kill-loendurid ei kasvanud.
- [Kerneli definitsiooni](https://www.kernel.org/doc/html/v6.8/admin-guide/cgroup-v2.html#memory-interface-files)
  järgi näitab `memory.events.low` tagasivõtmist ka allpool kaitsepiiri.
  See on otsene tõend, et **1500M/1G best-effort-kaitse ei säilitanud selle
  deploy ajal Qdranti faililehti**. Algpõhjus, miks efektiivne kaitse ei piisanud,
  on eraldi uurimise küsimus; suurem `memory.low` või `memory.min` pole rakendatud.

Arvutatud loendurivahed: `tmp/rag-v2-memory-protection-20260928/deploy-226-counters.json`;
deploy ajamärgid: samas kaustas `deploy-226-markers.txt`.

**Algsoojendus lõppes 09:04:11.172 UTC**: 1152 allikat, 306 s
(`deploy-226-warmup.json`). Kell 09:07:33 UTC oli Qdranti `file` endiselt
10,6 MiB ning pärast soojenduse lõppu uusi suuri kettalugemisi polnud.

### Kolmas pööre: külm Qdrant pärast kaitsega deploy'd

Opuse sama küsimuse pööre `f141e02c-d43a-4195-9bcb-116d29175776` algas
**09:14:07.819 UTC**, vastus salvestati **09:14:38.374 UTC**, olek `completed`.
Codex kontrollis ajad ja arvulised mõõdikud pöörde auditist küsimust/vastust lugemata.
**Kõrvalekalle protokollist:** pööre algas 15 min 5,8 s pärast teenuse käivitust
ja 9 min 56,6 s pärast algsoojenduse lõppu, väljaspool kavandatud 6–8 minuti akent.
Väljalase oli kogu pöördeaknas #226; konteinerid ja kaitseväärtused püsisid samad.

| Mõõdik | Kolmas pööre, kaitsega pärast deploy'd |
| --- | --- |
| Otsing ise (`since_start_ms.merged`) | **12 595 ms** |
| Põhiotsingu Qdranti serveriajad | **8428 / 8420 / 8407 / 8409 ms** |
| Sõnaline otsing | 1167 ms |
| `rerank` / selle mudelikutse | 2692 / 2441 ms |
| Qdranti kettalugemine | **320 868 352 B (306,0 MiB)** |
| Qdranti `file` | **10,6 → 316,5 MiB** |
| Qdranti `pgmajfault` / `workingset_refault_file` kasv | **92 122 / 75 659** |
| Qdranti I/O PSI `some` / `full` kasv | **6,395 / 5,798 s** |
| PostgreSQLi kettalugemine / I/O PSI `some` kasv | 17,4 MiB / 0,037 s |
| Qdranti / PostgreSQLi CPU-aeg | 3,33 / 4,42 s |

Loendurite aken on 09:14:07.637–09:14:38.637 UTC, 32 proovi, vahe 1 s.
Need on konteineri koguloendurid kogu pöördeaknas; PSI ei ole üksiku päringu
eraldatud kestus ja nelja paralleelse vektorpäringu aegu ei summeerita.
Pöörde ajal `pgscan`, `pgsteal` ega `memory.events.low` enam ei kasvanud:
Qdrant luges varem eemaldatud lehed tagasi. PostgreSQLi `rerank`-jääk pärast
mudelikutset oli umbes 251 ms, mis ei viita selle pöörde varasemale mitmesekundilisele
allikate laadimise/kontrollimise viivitusele.

**Järeldus:** selle deploy järel oli Qdrant vaatamata 1500M/1G kaitsele külm.
Kettalugemine, failivahemälu taastumine, lehevead ja I/O-ooted toetavad nüüd
otseselt vahemälust eemaldatud vektorite tagasilugemise seletust. Kaitseta soojades
pööretes oli Qdranti serveriaeg 0,18–0,23 s; kaitsega deploy järel 8,41–8,43 s.
See katse ei tõenda, et suurem swap või teine kaitsepiir ei saaks aidata;
nende mõju ei mõõdetud. Samuti ei tõenda üks soe jõudeolekukatse, et muu
taustakoormuse ajal ei saaks vahemälu tühjeneda.

Arvulised auditiväljad: `tmp/rag-v2-memory-protection-20260928/protected-postdeploy-turn.json`;
loendurivahed: samas kaustas `protected-postdeploy-counters.json`;
kolme pöörde võrdlus on korratav skriptiga `compare.mjs`.

### Järgmine katse ja ajutise kaitse lõpetamine

Opus valmistab ette ADR-033 algsoojenduse täiendust olemasoleva salvestatud
Qdranti vektoriga, mudelikutset tegemata. Praegune
`warmKnowledgeSources` soojendab PostgreSQLi allikaid ja tekstiosi, kuid ei
tee Qdranti päringut. Teostuses tuleb kontrollida:

- lähtevektor ja otsingu ulatus on kinnitatud plaani ning aktiivse põlvkonna
  dokumentide versioonide ühisosas; jagatud kollektsiooni vanad versioonid
  jäävad välja;
- täpne otsing katab plaani vajaliku dokumentide ulatuse, mitte ainult
  lähtevektori dokumenti või üht punkti;
- Qdranti soojendus toimub pärast PostgreSQLi soojendust ning selle lõpp,
  kestus ja tõrge on eraldi tuvastatavad; taustatöö ei tähenda, et enne selle
  lõppu saabunud kasutaja päring oleks juba soe;
- tõrge ei takista vestlust ega märgi ebaõnnestunud soojendust lõplikult tehtuks;
  olemasolev korduskatse ja sama töö paralleelsete käivituste vältimine säilivad.

Selles etapis oli koodiparanduse tulemus veel `NOT_PROVEN`; #228 väljalaske
järgnev kontroll on §12 all. Vastuvõtutõendiks valiti tegelik esimene
kasutajapööre pärast algsoojendust, mitte ainult soojenduspäringu edu.

Ajutise kaitse tagasivõtmine on ajastatud **28.09 kell 10:24 UTC / 13:24 EEST**,
pärast salvestaja kavandatud lõppu 10:23:25 UTC. Ühekordne Codexi järeltegevus
`rag-ajutise-m-lukaitse-tagasiv-tmine` käivitab ette valmistatud
`tmp/rag-v2-memory-protection-20260928/rollback-protection.py --apply`.
Skript taastab ainult kahe muudetud `memory.low` välja algse nullväärtuse,
kontrollides aega, konteinerite identiteete ja oodatud kaitseväärtusi.
Lugemiskontroll 09:28:05.936 UTC läbis. **Tagasivõtmine tehtud 28.09 kell
10:24:52.511 UTC / 13:24:52.511 EEST**: sysfs kinnitas `system.slice memory.low`
**1 572 864 000 → 0 B** ja Qdranti scope'i `memory.low` **1 073 741 824 → 0 B**.
PostgreSQLi enda `memory.low` jäi nulliks. Konteinerite identiteedid vastasid
katsele ning frontend PID `2913323` ja töökoopia `ab5c7c2b2` jäid muutmise
ajal samaks; tagasivõtmine restarti ei teinud. SSH väljumiskood oli 0.
Enne/pärast tõend: `tmp/rag-v2-memory-protection-20260928/protection-rollback.jsonl`.

Salvestaja lõpetas ise väljumiskoodiga 0: viimane proov `sequence=7199`
(7200 proovi kokku) oli **10:23:23.637 UTC**. Salvestusfaili maht
17 982 848 B ja muutmisaeg püsisid enne/pärast tagasivõtmist samad.
Swap'i, PostgreSQLi seadistust ega püsiseadeid ei muudetud. Katse on lõpetatud.

## 12. PR #228: Qdranti algsoojenduse järelkontroll (28.09)

Serverist kontrollitud väljalase `f4025522a9fd25a4b883ca22ecf34d4e165e6341`,
frontend PID `2843358`, käivitus **09:45:49 UTC**. Kohalik ülevaadatud
teostuscommit `958dc2169`; [PR #228](https://github.com/LauRRaud/SotsiaalAI/pull/228).
Teenus oli kontrolli ajal aktiivne; Codex väljalaset ega vestluspööret ei käivitanud.

### Kettalugemine toimus enne küsimust

Serveri journal kinnitab järjestust: 1152 allika soojendus lõppes
**09:50:54.156571 UTC** (301 s); 6026 allika vektorite soojendus lõppes
**09:51:05.200953 UTC** (11 s). Vektorisoojenduse loenduriaknas
09:50:53.637–09:51:05.637 UTC luges Qdrant kettalt **416,5 MiB** ning selle
`file` kasvas **9,3 → 424,9 MiB**; I/O PSI `some` kasvas 8,10 s.
Järgmise 610 sekundi proovides, kuni küsimuse alguseni, püsis `file`
445 566 976 B juures ja Qdranti kettalugemise loendur ei kasvanud.

Opuse sama küsimuse pööre `e187b7f1-a746-4a87-9bf8-f49328ba22ac` oli `completed`.
Auditi **`createdAt` on 10:01:15.478 UTC**; kasutajaliidese saatmise ajamärk
oli Opuse teatel umbes 10:01:13 UTC. Vastus salvestati **10:01:36.565 UTC**.
Algsoojenduse lõpust auditi pöörde alguseni oli 10 min 10,3 s.

| Mõõdik | #226, vektorisoojenduseta | #228, pärast vektorisoojendust |
| --- | --- | --- |
| Otsing ise (`since_start_ms.merged`) | 12 595 ms | **5001 ms** |
| Põhiotsingu Qdranti serveriajad | 8407–8428 ms | **80–123 ms** |
| Qdranti kettalugemine pöördeaknas | 306,0 MiB | **192 KiB** |
| Qdranti I/O PSI `some` kasv | 6395 ms | **1,412 ms** |
| Qdranti faililehtede refault | 75 659 | **0** |
| Sõnaline otsing | 1167 ms | 1219 ms |
| `rerank` | 2692 ms | 2535 ms |
| `rerank`-mudelikutse | 2441 ms | **2209 ms** |
| `rerank`-jääk väljaspool mudelikutset | 251 ms | **326 ms** |

#228 pöörde loenduriaken on 10:01:14.637–10:01:36.637 UTC, 23 proovi.
PostgreSQL luges 19,8 MiB, I/O PSI `some` kasv oli 53 ms. Mõlemas võrdluses
olid ajutised kaitseväärtused veel 1500M/1G. Soojenduse ajal toimunud lugemine
ja järgnenud soe küsimus kinnitavad paranduse toimimist selles katses;
soojendusejärgset püsimist ilma kaitseta pole siin veel eraldi mõõdetud.

**Ulatus:** tõendatud on esimene mõõdetud küsimus pärast algsoojenduse lõppu.
Soojendus töötab taustal ja ei sulge vestlust umbes 5 min 16 s kestnud käivituse
ettevalmistuse ajaks; enne lõppu saabuv küsimus võib endiselt oodata külma
otsingu või konkureeriva soojenduse järel. Väide, et soojendus jõuab alati
valmis enne ühtegi küsimust, ei tulene teostusest. Ka 2,54 s `rerank`-aeg ei
tähenda 1–1,5 s kohalikku kitsaskohta: selles pöördes kulus mudelile 2,21 s.

### Koodiülevaatus: üks taastumise puudus

**[P2] Ebaõnnestunud vektorisoojendus jääb tehtuks märgituks.**
`lib/rag-v2/pilot/retrieval.js:46` püüab `qdrant.warm()` tõrke kinni ja
lõpetab edukalt. Seetõttu ei käivitu `warmKnowledgeSources` veakäsitluse
`warming.delete(generationId)`: sama põlvkonna järgmine `warmPilotAtStart`
tagastab `false`. Ka `preflight` ei anna vektorisoojenduse callback'i kaasa.
Ajutine Qdranti timeout või ühendusviga jätab seega vektorite soojenduse selle
protsessi jaoks korduseta ja esimene tegelik küsimus võib taas teha külma lugemise.
Vestluse sisulist tulemust see ei blokeeri. Parandada tuleb vektorisoojenduse
eraldi ebaõnnestumise/korduskatse rada, säilitades taustatöö ja korduvkäivituse piiri.

Kohalik võrguta sond `tmp/rag-v2-memory-protection-20260928/probe-vector-retry.mjs`
kasutas päris `warmPilotAtStart` funktsiooni ja testadaptereid: esimene käivitus
`true`, sünteetiline Qdranti tõrge, teine käivitus `false`, vektorisoojenduse
katseid **1**. Muudatus ei sisalda selle juhu testi. Olemasolev
`tests/rag-v2-pool-reserve.test.mjs` läbis UTC all **6/6**; integratsioonitesti
Codex selles järelkontrollis uuesti ei käivitanud. Tootekoodi ei muudetud.

Arvulised auditiväljad ja loendurid on kaustas
`tmp/rag-v2-memory-protection-20260928/`: `vector-warmup-turn.json`,
`vector-warmup-counters.json`, `deploy-228-vector-warmup-counters.json`,
`deploy-228-warmed-gap-counters.json`, `deploy-228-warmup.txt`.
Sõnalise otsingu järgmine mahukatse peab kasutama vestluse tegelikke filtreid;
60 000 tekstiosa piiri tõstmist see üksik pööre veel ei tõenda.

## 13. 40 vestluspöörde aruande ja kuupäevadiagnoosi ülevaatus (28.09)

Loetud `tmp/rag-v2-dev-2026-09-28/conversations/conversation-eval.md` ja JSON,
hindaja ning jooksu kataloog. Algne automaatne tulemus on **31/40**:
1 otsingu-, 6 vastuse- ja 2 olekuviga; aruande hinnanguline kulu **0,1915 USD**.
Opuse käsitsi ümberhindamise **34/40** tuleb säilitada eraldi algtulemusest
koos iga muudetud hinnangu põhjendusega. Codex ei teinud uut tasulist jooksu
ega kinnitanud siin kõigi 40 vastuse sisulist õigsust.

**Kuupäevaparandus on põhjendatud esimene suund, kuid nimetatud algpõhjus
vajab täpsustust.** `retrievalPlan` lisab `basis: unspecified` arvulised
kandidaadid juba `legalPeriods` hulka. Võrguta kontroll päris funktsioonidega
`retrievalPlan`, `legalReference` ja `legalValidityScope` näitas:

- „1. märtsil 2027” muutub perioodiks **2027-01-01…2027-12-31**;
- „2027. aasta jaanuaris” muutub samuti kogu aastaks;
- sünteetilised tänane, 2027. aasta veebruari–märtsi ja aprilli redaktsioon
  jäävad kõik lubatuks. Märgistus `numeric_candidates_not_confirmed_intent`
  ei lülita küsitud aastat õigusakti filtrist välja.

Seetõttu ei piisa seletusest „kasutati ainult tänast kuupäeva, sest kandidaat
polnud kinnitatud”. Täpne päev/kuu jääb tõesti eristamata, kuid tegelike
allikaversioonidega tuleb jälgida rada **lubatud redaktsioon → otsingukandidaadid
→ rerank'i valik → mudeli tõend**. „Praegu” varasema perioodi tühistamist kood
eraldi ei käsitle; ilma uue arvulise kandidaadi või correction-režiimita võetakse
eelmine mudeli periood. Need on eraldi kontrollitavad käitumised.

**Hindaja `valid_on` ei erista ajaloolist võrdlusviidet valest kehtivusväitest.**
`lib/rag-v2/pilot/conversation-eval.js:51` kontrollib kõigi viidatud õigusaktide
kehtivust ühe kuupäeva vastu ega vaata, millise ajavahemiku kohta vastus
neid kasutab. `law-on-dates` neljas vastus ütleb varasema redaktsiooni
lõpukuupäeva ja tunnistab 31.10 kohta tõendi puudumist, kuid saab ikkagi sama
kehtivusvea. See vajab eraldi sisulist hinnangut; seda ei saa üksnes praeguse
kontrolli põhjal lugeda valeks väiteks 31.10 kehtinud õiguse kohta.
Ka allika pealkirja leidmine ei tõenda õige redaktsiooni jõudmist tõendisse.

Kuupäevaraja vastuvõtukontroll peab hõlmama esimeses pöördes täpset päeva ja
kuuvahemikku, tagasipöördumist tänasesse („praegu kehtiva seaduse järgi”),
kuupäeva parandust ja kahe perioodi võrdlust. Sünnikuupäev, kohtumise kuupäev
ja allika avaldamisaasta ei tohi automaatselt saada küsitud õiguse kuupäevaks.
Puuduva redaktsiooni korral peab vastus puudujääki tunnistama; oodatud teksti
puudumist ei parandata testi lihtsalt lõdvendades. Esmase käitumise saab
tõendada kohalike testadapteritega; tasuline kordusjooks ei ole arenduse eeltingimus.

## 14. PR-ide #236–#240 järelkontroll (28.09)

Üle vaadatud kohalik vahemik `11f6882bb..6c3665624`, Opuse aruanne ja
kataloogi v2 tootmisjooks. **38/40 on hindaja tulemus, mitte sõltumatu kinnitus
38 vastuse sisulisele õigsusele.** V1 ja v2 ootusi muudeti, mistõttu 31/40 → 38/40
ei ole muutumatu mõõdikuga võrdlus. Codex ei teinud uut tasulist jooksu.

Serveri ainult lugemise kontroll **15:49 UTC** kinnitas #240 väljalaske
`7f1291238af802ed52a2be2a3ac72902c5750024`, aktiivse plaani
`m4-sotsiaalai-corpus-chat-20260928-1342`, v33 põlvkonna ja vastuse piiri
**8192 tokenit**. Qdranti ja `system.slice` runtime `memory.low` on mõlemal **0**.
Viimsi katsepöörde `e21d921f-9012-42c1-ba64-58c3f32fb957` arvulised väljad
kinnitavad lõpetatud vastuse: 4177 väljundtokenit, neist 2924 arutlust.
See üks vastus ületas varasema 4096 piiri; sama küsimuse iga korduse täpset
tokenivajadust sellest ei järeldu.

### Kolm kohalikult korratud puudust

1. **[P2] Eitusreegel eemaldab ka jaatatud omavalitsuse.**
   `lib/rag-v2/pilot/record-scope.js:48–50` käsitleb iga kolme eelneva sõna
   sees olevat eitust kohanime eitusena. „Ma ei saa Tallinnas abi.” ja
   „Ma ei tea. Elan Tallinnas.” annavad `region_required_after_negation`,
   `region: null`; „Elan Tallinnas.” annab Tallinna. Esimeses näites eitatakse
   abi saamist, teises on eitus teises lauses. Kaob omavalitsuse kataloog ja
   teadmiste raja KOV-ulatus; query-plan'i asukohavaru seda olekut ei paranda.
   Parandus peab eristama koha eitamist tegevuse eitamisest ning säilitama
   lausepiirid. Sond kasutas äratuntud kohanimedega morfoloogia testadapterit;
   päris EstNLTK rada ei korratud, sest kohalikus Pythonis moodul puudub.
2. **[P2] Punktidega kuupäevavahemik muutub kaheks üksikuks päevaks.**
   `lib/rag-v2/pilot/retrieval-plan.js:46–52` korjab ja maskeerib kuupäevad
   enne vahemike käsitlemist. „Mis muutus 01.01.2027–31.03.2027?” lubab
   ainult 01.01 ja 31.03, seega jääb üksnes veebruaris kehtiv redaktsioon
   välja. Sama küsimuse ISO-vahemik `2027-01-01–2027-03-31` lubab selle
   redaktsiooni. Vahemik tuleb tuvastada enne üksikkuupäevi; sihttest peab
   kontrollima ka vahemiku keskel kehtivat redaktsiooni.
3. **[P2] Hindaja kuupäevakontroll võib läbida vale seaduseredaktsiooniga.**
   `lib/rag-v2/pilot/conversation-eval.js:58–64` seob kuupäeva suvalise
   leitud/viidatud õigusaktiga, mitte sama aktiga, mille pealkirja oodatakse.
   Sondis olid oodatud SHS-i vale, 2026. aasta redaktsioon ning teine,
   2027. aastal kehtiv seadus: nii `evidence`, `cited`, `found_valid_on` kui
   ka `valid_on` läbisid. Vajalik on akti identiteedi ja küsitud kehtivuse
   ühine kontroll. See ei tõenda viga jooksu 3 konkreetses kuupäevavastuses:
   aruandes on seal sobiv SHS-i/RLS-i redaktsioon.

Lisaks läbib RLS-i puuduva redaktsiooni praeguse `must`-mustri sünteetiline,
väljamõeldud tasuga tekst „31. oktoobril on tasu 999 eurot. Sinu pensioni suurust
ei saa kinnitada.” Muster leiab teisest lausest ebakindluse, kuid ei kontrolli,
kas see käib küsitud õigusliku tõendi puudumise kohta. See on hindaja
negatiivne kontrollnäide, mitte tegelik vastus ega väide tasu suuruse kohta.

### Eelarvekirjeldus ei vasta arvestusele

Omaniku täpsustus selle ülevaatuse ajal: kulu ei ole töö jätkamise takistus.
Paranduste järjekorra määrab vastuste õigsus.

**ADR-043 väide „broneering vabaneb pärast kutset” on vale.**
`lib/rag-v2/pilot/store.js:141–156` säilitab konservatiivse broneeringu;
kasutus lisab üksnes võimalikku ülekulu, automaatset tagastust ei ole.
Serveris oli aktiivse plaani 40 pöörde hinnanguline kasutus **0,19613405 USD**,
reservatsioonide summa ja kulupäevik mõlemad **0,86897155 USD** (160 kutset).
Need on eri arvestused, mitte teenusepakkuja arve sõltumatu kontroll.
Suurem väljundipiir võib seega sama kinnitatud rahapiiri juures lubada vähem
pöördeid ka siis, kui vastuste hinnanguline kulu on väike. Parandada tuleb
ADR-i selgitus; reservatsiooni vabastamine oleks eraldi käitumismuudatus,
mis peab arvestama teadmata tulemusega kutseid.

### Kontaktide järgmine samm

Kood toetab Opuse **varianti B**: siduda eksport stabiilse ID, revisjoni ja
kontaktisisu kontrollsummaga, jättes üksnes vaatlusaja sellest sidumisest välja.
Praegu sisaldub `checked_at` nii otseses võrdluses kui ka projektsiooni räsis;
ühe võrdluse eemaldamisest ei piisa. Sondis muutis ainult kontrollkuupäeva
värskendamine sama revisjoni ja sisuga kontakti seose kehtetuks.
Registri jooksva värskuse, avaldamisloa, tühistamise ja omavalitsuse kontrollid
peavad säilima; ekspordi ajalooline kontrollaeg tuleb neist eristada.

Serverisse salvestatud kandidaatide fail kinnitas 384 ühest nimevastet,
20 mitmest vastet ja 404 vasteta kontakti; 164 ühisel vastel oli ka sama URL.
Need on ülevaadatavad kandidaadid, mitte lubatud kontaktiseosed. Enne eksporti
tuleb kontrollida ametlikku allikat ja kontakti sobivust teenusega. Kogu
808 kontakti autoriseerimist Codex uuesti ei käivitanud; 0/808 on Opuse
aruande mõõtmine. Automaatset nimede järgi avaldamist see ülevaatus ei õigusta.

### Kontrolli ulatus

UTC all läbisid **46/46** testi failides `rag-v2-legal-scope`, `rag-v2-unified`,
`rag-v2-conversation-eval`, `rag-v2-pool-reserve`, `rag-v2-search-assist`,
`rag-v2-chat-plan` ja `rag-v2-pilot-config`. Võrguta sondid ja arvulised
serveriväljavõtted asuvad kohalikus ignoreeritud kaustas
`tmp/rag-v2-review-236-240/` (`probes.mjs`, `probes.json`, `server-status.json`,
`answer-metrics.json`). Sondide käsk:
`node --import ./scripts/register-node-source-loader.mjs tmp/rag-v2-review-236-240/probes.mjs`.
Tootekoodi ja tootmisseadeid ei muudetud, tasulisi kutseid ega uusi vestluspöördeid
ei tehtud. Dokumentatsioonile kontrolliti `git diff --check`.
