# RAG v2 enne embeddingute ostu: külmutus, pealkirjad, kontrollitase ja 14 allika parandused

25.09.2026, Claude Opus 5.5. Omaniku korraldus: ostuks ega push'iks/PR-iks luba ei ole; enne ostu
külmutada seis sõltumatuks järelkontrolliks, vaadata pealkirjad sisuliselt üle, eristada
kontrollitasemed ja kontrollida 14 allika faktid dokumentidest. Järelkontrolli ajal ei muudetud
külmutatud koodi ega ostuplaani (`verify.mjs` → „freeze intact“ ka selle raporti lõpus).

## 1. Külmutatud seis

Kaust `tmp/rag-v2-freeze-v12-2026-09-25/` (tmp on git'ist väljas; midagi pole commit'itud):

- `freeze.json` — kõigi muudetud/uute koodifailide räsid, diffi räsi, töötluse sõrmejälg,
  ostuplaani failid, store'i ja indeksi generatsioon, tõendifailide räsid;
- `snapshot/` — iga muudetud/uue faili koopia; `code.patch` — `git diff HEAD` muudetud failidele;
- `evidence/` — testide ja mahumõõtmiste logid; `verify.mjs` — kordab kontrolli, `make-freeze.mjs` — tegi külmutuse.

Kontroll: `node tmp/rag-v2-freeze-v12-2026-09-25/verify.mjs`

| Mis | Väärtus |
|---|---|
| Git | `main` @ `5ab30c02d`, muudatused tööpuus (commit'imata) |
| Koodi ulatus | 39 faili (32 muudetud, 7 uut), `scope_sha256` `8973ab70…`, `patch_sha256` `f4fcab2b…` |
| Töötlus | `source-structure-v12` / `structure-blocks-v6`, pdf.js 5.4.296, sõrmejälg `31657607…` |
| Store | `sotsiaalai-corpus`, generatsioon `generation_0bc532eb…`, 5985 dokumenti |
| Ostuplaan | `tmp/rag-v2-corpus-embeddings/plan-1`, egress-manifest `cbcdc858…`, 29 051 sisendit, 14 682 957 tokenit, 1,908784 USD, hind 0,13 USD/1M kontrollitud 25.09 09:28 UTC; kinnitamata, käivitamata |
| Katseindeks | `search_generation_34360dd9…` (katsevektorid, EstNLTK) |

### Muudetud ja uued failid

| Fail | Muutus | Read |
|---|---|---|
| `app/rag-pilot/pilot-client.jsx` | muudetud | +24 / −6 |
| `lib/rag-v2/admin/config.js` | muudetud | +6 / −2 |
| `lib/rag-v2/admin/intake.js` | muudetud | +9 / −2 |
| `lib/rag-v2/catalog.js` | muudetud | +14 / −1 |
| `lib/rag-v2/chunking.js` | muudetud | +125 / −15 |
| `lib/rag-v2/contracts.js` | muudetud | +4 / −4 |
| `lib/rag-v2/ingest-batch.js` | muudetud | +3 / −1 |
| `lib/rag-v2/metadata-adapter.js` | muudetud | +36 / −4 |
| `lib/rag-v2/metadata-values.js` | muudetud | +17 / −1 |
| `lib/rag-v2/normalize.js` | muudetud | +40 / −9 |
| `lib/rag-v2/parser.js` | muudetud | +215 / −21 |
| `lib/rag-v2/pdf-layout.js` | muudetud | +216 / −39 |
| `lib/rag-v2/pdf-worker.js` | muudetud | +93 / −6 |
| `lib/rag-v2/processing-implementation.json` | uus | 24 rida |
| `lib/rag-v2/registered-source.js` | muudetud | +69 / −1 |
| `lib/rag-v2/search/artifact-provenance.js` | muudetud | +9 / −3 |
| `lib/rag-v2/search/capacity.js` | uus | 20 rida |
| `lib/rag-v2/search/discovery.js` | muudetud | +4 / −1 |
| `lib/rag-v2/search/index-jobs.js` | muudetud | +6 / −5 |
| `lib/rag-v2/search/indexing.js` | muudetud | +2 / −1 |
| `lib/rag-v2/search/model-context.js` | muudetud | +8 / −1 |
| `lib/rag-v2/search/multi-source-plan.js` | muudetud | +66 / −21 |
| `lib/rag-v2/search/pilot-runner.js` | muudetud | +124 / −39 |
| `lib/rag-v2/search/ranking.js` | muudetud | +5 / −1 |
| `lib/rag-v2/search/structured-record-source.js` | muudetud | +2 / −2 |
| `lib/rag-v2/search/unified.js` | muudetud | +1 / −1 |
| `lib/rag-v2/text-source.js` | muudetud | +30 / −10 |
| `lib/rag-v2/types.d.ts` | muudetud | +5 / −4 |
| `scripts/rag-v2-corpus-embeddings.mjs` | uus | 89 rida |
| `scripts/rag-v2-processing-fingerprint.mjs` | uus | 38 rida |
| `scripts/rag-v2-selection-compare.mjs` | muudetud | +7 / −4 |
| `tests/rag-v2-capacity.test.mjs` | uus | 22 rida |
| `tests/rag-v2-ingest.test.mjs` | muudetud | +23 / −4 |
| `tests/rag-v2-pilot-client-intent.test.mjs` | uus | 57 rida |
| `tests/rag-v2-pilot.test.mjs` | muudetud | +76 / −5 |
| `tests/rag-v2-processing-version.test.mjs` | uus | 16 rida |
| `tests/rag-v2-record-catalogue-compact.test.mjs` | muudetud | +5 / −4 |
| `tests/rag-v2-search.integration.test.mjs` | muudetud | +10 / −5 |
| `tests/rag-v2-source-structure.test.mjs` | muudetud | +282 / −0 |

Aruanded (`docs/audits/rag-v2-claude-ingest-audit-2026-09-25.md`, Codexi audit) on külmutuses räsiga eraldi.

### Tõendid (`evidence/`)

| Kontroll | Tulemus |
|---|---|
| `npm test` | 228 läbis, 0 kukkus, 17 vahele (teenuse- ja päris-allika komplektid) |
| Päris-artikli vastuvõtt (`RAG_V2_INPUT_ROOT`) | 27/27 |
| Kohalike teenuste integratsioon (EstNLTK, morfoloogia, indeksitööd, partii, avaldamine, valikuline otsing, otsing) | 56/56 |
| Ostujooksja 3000 sünteetilise sisendiga | 24,9 s, lineaarne |
| Kogu korpuse indeks (katsevektorid) | 64 min, 6072 partiid, 29 051 vektorit |
| Kataloog / vektoripäring | 0,30 s / 0,08–0,14 s |
| Sõnaline päring | 12,9 s paralleelselt, 36,5 s keskmiselt ühe ühendusega (60 küsimust) |
| Ühise raja pööre | katkeb `lexical_service_failed` (vt ADR-029) |

## 2. Kahtlased pealkirjad

Kõik 10 045 PDF-sektsiooni pealkirja (1023 dokumenti) sorteeriti mustri järgi ja kahtlased loeti
läbi; täpse reegli tuvastamiseks parsiti 74 dokumenti instrumenteeritud koopiaga (`tmp/`), mis
taastas talletatud pealkirjad 74/74 täpselt.

| Muster | Pealkirju | Dokumente | Hinnang (käsitsi) |
|---|---:|---:|---|
| küsimus | 743 | 293 | ehtsad (intervjuu- ja küsimuspealkirjad) |
| täppidega lõik | 187 | 3 | kõik valed: paksus kirjas põhiteksti lõigud |
| proosataoline | 160 | 62 | 42 ehtsat, 14 pealkiri + esimene sisurida, 6 piiripealset, 98 valet |
| joonise/tabeli allkiri | 64 | 8 | valed |
| sisukorra rida | 40 | 10 | valed |

**Põhiteksti haarab 299 pealkirja**: 187 täpilõiku, 98 muud sisurida (sh viidete kirjed, tabeli
legend 43 korda ühes aruandes, küljekastid) ja 14 ehtsat pealkirja, mis võtsid kaasa oma esimese
sisurea. Lisaks on 104 valet pealkirja allkirjad ja sisukord. Peamine allikas on suurteksti reegel
(kuni 4 rida ja 250 märki suuremat kirja loetakse pealkirjaks).

**Mõju `retrieval_text`-ile ja tükkide piiridele: jah.** Pealkiri alustab sektsiooni (tüki piir) ja
läheb tüki eesliitesse, mitte sisusse. Prototüübi reeglid (ainult koopias):
täpi- ja kastirida, allkiri ja punktiirjuhtjoonega sisukorra rida ei ole pealkiri; suur algustäht
proosarea ees on initsiaal; rida, mis lõpeb poolitusega või komaga või sisaldab lõpetatud lauset
ja jätkub väiketähega sisureal, on sisu.

| Tulemus käsitsi siltide vastu | |
|---|---|
| valed pealkirjad eemaldatud | 361 / 389 (93%) |
| ehtsad kaotatud | 1 / 42 (tähesammuga „H indamisteema 6 .“) |
| küsimuspealkirjad kaotatud | 0 / 743 |
| muud pealkirjad muutusid | 4 (kõik komaga lõppevad) |
| alles jäänud valed | 28, paigutusjäägid ~6 dokumendis (kaks veergu ühel real, ABC-raamat) |

Mõju embeddingusisendile (kõik 1053 avaldatud PDF-i, täisettevalmistus koopiaga): **39 dokumenti
muutub, neist 38 tükipiirides**; tükke 20 783 → 20 528; 664 teksti kaob ja 424 tuleb juurde
(20 104 jääb samaks); tokeneid 12,53 M → 12,52 M. Seega tuleb parandus teha enne ostu:
järelkontrolli järel `source-structure-v13` testidega, kogu korpuse uus ettevalmistus ja uus
ostuplaan (hind praktiliselt sama). Prototüüp ja skriptid: `tmp/rag-v2-heading-prototype/`.

## 3. Kontrollitase

| Tase | Allikaid |
|---|---:|
| ainult automaatne värav (ette valmistatud, konfliktiblokeerijaid pole, hoiatused kirjas) | 5882 |
| lisaks nimetatud osaline käsitsi kontroll (alamread kattuvad osaliselt) | 103 |
| &nbsp;&nbsp;pealkirjade sildid (kahtlaste pealkirjadega PDF-id) | 69 |
| &nbsp;&nbsp;OCR-artiklite sektsioonipealkirjad | 22 |
| &nbsp;&nbsp;pealkiri vs esilehe tekst | 12 |
| &nbsp;&nbsp;õigusakti jurisdiktsiooni ja kehtivuse väljad | 4 |
| &nbsp;&nbsp;M1 artikli vastuvõtutestid (struktuur, lehed, metaandmed) | 1 |
| **sisu käsitsi täielikult kontrollitud** | **0** |

Parandus varasemale: avaldatud ülevaatuse märkused ütlevad „Included after the v12 corpus
review“. See tähendab automaatset väravat ja korpuse tasemel kontrolle, mitte iga dokumendi
lugemist. Külmutatud ülevaatusi ei muudetud; edasised märkused nimetavad taseme sõnaselgelt.
Allikate nimekiri tasemetega: `tmp/rag-v2-corpus/review-levels.json`.

## 4. 14 kõrvale jäetud allika faktid dokumentidest

| Allikas | Väli: praegu → ettepanek | Allikakoht |
|---|---|---|
| Riigikontroll: Koduteenuste korraldus | aasta 2025 → 2023; kuupäev → 2023-11-22 | lk 1: „Riigikontrolli aruanne Riigikogule, Tallinn, 22. november 2023“ |
| Riigikontroll: Omavalitsuste tegevus erivajadustega inimeste toetamisel | 2025 → 2024; 2024-05-16 | lk 1: „Tallinn, 16. mai 2024“ (lk 46 „xx. aprill 2024“ on mustandi jääk) |
| Riigikontroll: Toimetulekutoetuse kui riikliku sotsiaalabi korraldus | 2025 → 2023; 2023-01-16 | lk 1: „Tallinn, 16. jaanuar 2023“ |
| Riigikontroll: Töövõime vähenemise ennetamine | 2025 → 2023; 2023-09-25 | lk 1: „Tallinn, 25. september 2023“ |
| SKA: Rehabilitatsiooni teenuseosutajate infopäeva materjal | 2024 → 2020; 2020-10-16 | lk 1: „16. oktoober 2020“ |
| Võrdõigusvolinik: Arvamus töövõimetuslehe teemal | 2023 → 2016; 2016-01-18 | lk 1: „Tallinn 18. jaanuar 2016“; sisu viitab muudatustele alates 01.07.2016 |
| Sotsiaaltöö 1/2025: „Lapse õigus kasvada peres“ | aasta 2025 kinnitada; veebikuupäev jääb kandidaadiks | lk 5: „Artikkel ilmus ajakirjas Sotsiaaltöö 1/2025“; lk 1: „Metoodika 11. detsember 2024“ |
| Sotsiaaltöö 1/2025: „Võlanõustamisteenus aastatel 2018–2023“ | sama | lk 5: sama lause; lk 1: „Uurimus/analüüs 09. detsember 2024“ |
| HARNO: Õpitulemuste vähendamine, asendamine ja vabastamine | väljaandja „HARNO“ (mitte „Haridus- ja Noorteamet“); kogu → `national_guidelines`; aasta 2022 dokumendis puudub | lk 2: „Väljaandja: Harno“; 10 muud HARNO dokumenti kasutavad „HARNO“ ja 9 neist `national_guidelines` |
| Päästeamet: Hoolekande- ja tervishoiuasutuste tuleohutus | **uus leid: aasta 2024 → 2020, kuupäev 2024-03-03 eemaldada**; autor Jaak Jaanso; kogu → `national_guidelines` | lk 1: „Koostas: Jaak Jaanso, nõunik, Lääne päästekeskus, Pärnu 2020“; 7/10 Päästeameti dokumenti `national_guidelines` |
| Peaasi: Koolilaste ja noorte vaimne tervis | kogu → `organization_materials`; aasta 2014 dokumendis puudub | lk 1: „Materjal on koostatud MTÜ Peaasjad ja Eesti Õpetajate Liidu koostöös“ |
| Tark Vanem: TÖÖLEHT: Abiküsimused vestluseks algkoolilapsega | tüüp → `information_material`, kogu → `organization_guidelines`; väljaandja jääb „Tarkvanem“ | lk 1: „Praktiline nõu lapsevanemale – tarkvanem.ee“; 11/11 Tarkvanema dokumenti on `information_material`, 7/11 `organization_guidelines` |
| Tallinn: Õigusnõustamine vähekindlustatud Tallinna elanikele | `url_canonical` „…elanikule“ → „…elanikele“ | `KOV/tallinn/tallinn.json` `items[45]`; 25.09 kontrollitud: „…elanikele“ töötab, „…elanikule“ on 404 |
| EPIKoda: „ÜRO … konventsioon ja fakultatiivprotokoll“ | pealkiri → „ÜRO puuetega inimeste õiguste konventsioon ja puuetega inimeste õigused Eestis“; aasta 2025 → 2013; väljaandja „Eesti Puuetega Inimeste Koda“; koostaja Karin Hanga | lk 1: pealkiri ja „Eesti Puuetega Inimeste Koda, 2013“; lk 2: „Väljaandja: …, 2013; Koostaja: Karin Hanga“ |

Kogumärgend (`collection_id`) talletatakse ainult: otsing, kataloog ega mudelivaade seda ei kasuta;
ettepanek järgib sama väljaandja enamust. Allika tüüp jõuab mudelini.

Omaniku sisulised valikud:

1. **EPIKoda 2013** (2013. aasta toetussummad): kaasata ajaloolisena (`historical: true`) või jätta välja.
2. **Võrdõigusvolinik 2016** (töövõimereformi eelne olukord): sama valik.
3. Soovi korral: tarkvanem.ee lehel on Sotsiaalkindlustusameti logo ja kontaktaadress, kuid otsest
   väljaandja lauset pole. Kas muuta kõigi 12 Tarkvanema dokumendi väljaandja Sotsiaalkindlustusametiks?

Rakendamine pärast otsust ja järelkontrolli: väärtused metaandmefailidesse koos
`metadata_confirmations` kirjega (kes, millal, alus = ülaltoodud allikakoht), Tallinna väli
allikapaketis, REGISTER.json räsid ja nende allikate partii sama ülevaatusega.

## 5. Sõnaline otsing

Ettepanek [ADR-029](../rag-v2/adr-029-lexical-ranking-at-corpus-scale.md). **Muudab ainult
otsinguindeksit ja järjestamist, mitte embeddingusisendit**; ostetud vektorid jäävad kehtima.
Soovitus: BM25 Postgres'i termitabeliga koos keelepõhiste tüvedega, hinnata hübriidtulemust päris
vektoritega.

## 6. Järjekord enne ostu

1. Sõltumatu järelkontroll külmutatud koodile ja ostuplaanile.
2. Omaniku valikud 1–3.
3. `source-structure-v13`: pealkirjareeglid testidega ja metaandmete parandused; kogu korpuse uus
   ettevalmistus ja avaldamine; uus ostuplaan.
4. Ostu kinnitus (manifest ja kululagi).

## 7. Omaniku otsused ja ettevalmistus järelkontrolli ajal (25.09 õhtu)

Omaniku otsused: v12 külmutus jääb järelkontrolli lõpuni muutumatuks; pealkirjaparandus tuleb enne
ostu; Tark Vanemat ei omistata logo põhjal Sotsiaalkindlustusametile; EPIKoda 2013 ja
Võrdõigusvoliniku 2016 materjal jäävad korpusesse parandatud metaandmete ja ajaloolise staatusega,
kuid aktiivsest ostuvalikust esialgu välja. Ostu-, push'i- ega PR-luba ei ole.

Külmutus on endiselt terve (`verify.mjs` → „freeze intact“); Andmebaasi pole muudetud.

### Järelkontrolli juhis (neli ala)

| Ala | Kood | Testid ja tõendid |
|---|---|---|
| Ostujooksja | `lib/rag-v2/search/pilot-runner.js`: `runPilot`, `readJournal`, `StoredEmbedding.load`; `pilot-manifest.js` `validateApproval`/`validatePrice` | `tests/rag-v2-pilot.test.mjs` E-02…E-06; `evidence/purchase-runner-scale-3000.log` |
| Katkestusest taastumine | `readJournal` (katkenud viimane rida lõigatakse; `reserved` ilma tulemuseta → `stopped_unknown`, uuesti ei saadeta); vana `ledger.json` ainult lõpetatuna | E-04/13 „append-only journal…“, E-05 „reservation synced before a crash…“, E-04/13 „tampered, reordered…“, „earlier complete ledger.json…“ |
| Ostuplaani koostamine | `lib/rag-v2/search/multi-source-plan.js`: `buildCorpusEmbeddingPlan`, ühine `purchasePlan`; `scripts/rag-v2-corpus-embeddings.mjs` | „M2 corpus plan: … exact multi-source plan“ (voogplaan = senine plaan); `plan-1` failid külmutuses |
| Pealkirjaparanduse prototüüp | `tmp/rag-v2-heading-prototype/` (v1) ja `tmp/rag-v2-heading-prototype-v2/` (v2): ainult `parser.js` erineb v12-st, reeglid lipu `HEADING_FIX=1` taga | kirjed `tmp/rag-v2-heading-prototype-record/record.json`, `record-v2.json`; kontroll `node tmp/rag-v2-heading-prototype-record/record.mjs --verify` ja `record-v2.mjs --verify` |

### Kaotatud ehtne pealkiri ja 28 allesjäänud valet

- **„H indamisteema 6 . Vähenenud töövõimega inimese …“** kadus, sest tähesammuga „H i…“ näis
  initsiaalina ja „6 . V“ loeti lause lõpuks. Tagajärg oleks olnud halb: pealkirjaks jäänuks
  teine rida ja esimene rida oleks läinud eelmise sektsiooni sisse. v2-s loetakse lause lõpuks
  ainult punkt väiketähe järel — pealkiri säilib.
- **28 valet** jagunesid: 11 täpp rea keskel (tabelirida + täpiveerg), 1 viitekirje, 1 sisukorra
  rida viiteloendi pealkirja reegli kaudu, 1 poolitusega rida, mille jätk on teises veerus,
  2 lehekülje numbrit lauserea ees, 1 pikk komadega kõrvallauserida ja 11 puhast
  paigutusjääki (ühendatud kastid, ABC-raamat, voldik). v2 lisab reeglid: täpp kõikjal real,
  viitekirje (ka organisatsioon autorina), sisukorra rida ei saa viiteloendi pealkirjaks,
  poolitus ilma järgneva pealkirjareata, lehekülje number + lause, ≥2 koma + väiketähega jätk.

| v2 käsitsi siltide vastu | v1 | v2 |
|---|---:|---:|
| valed eemaldatud | 361/389 | 377/389 (97%) |
| ehtsad kaotatud | 1/42 | 0/42 |
| küsimuspealkirjad kaotatud | 0/743 | 0/743 |
| pealkiri + sisurida: lühendatud / muutmata / eemaldatud | 5 / 4 / 5 | 5 / 3 / 6 |
| muud muutunud pealkirjad | 4 | 28 (kõik läbi loetud: sisuread, infograafika, initsiaalilised lugude algused, joonise märkused) |

Allesjäänud 12 valet on paigutusjäägid viies dokumendis (Inimkaubanduse ennetamine, OSKA lühiversioon,
„Võin olla puudega“, Seksuaalsest ahistamisest vaba, Lapse osalemise põhimõtted); neid pealkirjareegel
ei paranda. Eemaldatud 6 „pealkiri + sisurida“ on ühe rea sees kokku sulanud kujundussõnad
(„VESTLUSEKS …“, „TUNNUSTA …“, voldiku read); tekst jääb sisuks alles.

Mõju embeddingusisendile (v2, 1053 PDF-i): **50 dokumenti muutub, 49 tükipiirides**; tükke
20 783 → 20 495; 756 teksti kaob, 483 tuleb; tokeneid 12,533 M → 12,520 M. Soovitus: v13 kasutab
v2 reegleid.

### Faktiparandused ettevalmistatud, mitte rakendatud

`tmp/rag-v2-corrections-v13/corrections.json`: 13 metaandmefaili ja Tallinna paketi üks väli, igaühel
allikakoht; kinnitaja „Claude Opus 5.5, allikakontroll dokumendist (omaniku korraldus 25.09.2026)“.
`validate.mjs` rakendab need **koopiale** ja valmistab allikad külmutatud v12 koodiga ette: kõik 14
blokeerijat kaovad, väärtused vastavad ja väljad on `confirmed`.

- Tark Vanem: väljaandjaks jääb tõendatud allikanimi „Tarkvanem“; kinnituse aluses on kirjas, et
  organisatsiooni seos on kontrollimata (SKA logo ja kontaktaadress, otsest lauset pole).
- EPIKoda ja Võrdõigusvolinik: parandatud pealkiri/aasta/väljaandja/koostaja ja `historical: true`;
  loetletud `purchase_selection_exclusions` all — ostu ja indeksi õiguste failist välja.
- Päästeamet: kuupäev 2024-03-03 dokumendis puudub, dokumendis on ainult aasta (Pärnu 2020).
  Praegune kinnitusmehhanism ei oska „täpne kuupäev teadmata“ öelda; v13 vajab selleks
  kinnitatud puudumise võimalust (väli tühi, kandidaadid asendatud), mitte väljamõeldud kuupäeva.
- Tallinn: paketi muutus annab kõigile Tallinna kirjetele uue lähteräsi ja versiooni; nende tekst
  ja embeddingusisend ei muutu.

### v13 järjekord pärast järelkontrolli

1. Pealkirjareeglid (v2) koodi koos testidega (sh käsitsi siltidest regressioonikomplekt).
2. Kinnitatud puudumine metaandmekinnitustes.
3. Paranduste rakendamine Andmebaasi (+ REGISTER.json räsid) omaniku nähes.
4. `source-structure-v13`: kogu korpuse ettevalmistus, ülevaatus (kontrollitase sõnaselgelt),
   avaldamine; ostu- ja indeksiõigustest välja EPIKoda ja Võrdõigusvolinik.
5. Uus ostuplaan ja selle järelkontroll; siis ostu kinnituse küsimus.

## 8. Codexi järelkontrolli leiud V01–V07 ja v13 (25.09 hilisõhtu)

Codexi järelkontroll ([raport](rag-v2-codex-ingest-audit-2026-09-25.md), 223 testi, ostuplaan kordus
täpselt) leidis ühe P1 ja kuus P2 leidu. Järelkontroll on lõppenud; v12 külmutus jääb ajalooliseks
kirjeks (`verify.mjs` ei läbi enam, sest kood on edasi läinud) ja kõik parandused on v13-s.

| Leid | Mis oli | Parandus v13-s | Test (kukub v12-l, läbib v13-l) |
|---|---|---|---|
| V01 (P1) | Pealkirjaprototüüp v2 jättis ühe kogumiku nelja artikli algusest 49 rida otsingust välja: järgmise artikli pealkiri oli 1,44× kirjas, jäi pealkirjareeglite vahele ja tekst sattus eelmise `Kirjandus`-sektsiooni, mis jäeti tervikuna välja. Minu mõjuanalüüs võrdles tekste, mitte sisukatvust, ja ei märganud. | (1) Teise kirja alapealkirja reegel kehtib kuni suure pealkirja suuruseni — suuruste vahel lünka pole. (2) Viiteloendist jäetakse välja ainult loend ise: see lõpeb viimase loendilaadse rea järel, kui järgneb ≥3 rida ja ≥150 märki muud teksti, ja esimesel suurel kuvareal, mille järel ei tule uusi kirjeid (jooksev päis loendi sees seda ei lõpeta). | „a reference list ends at the next article's display title…“, „list items, captions, … are not headings; real ones stay“ |
| V02 | Viskav edenemisteade muutis salvestatud edu `unknown`-iks ja päevik muutus loetamatuks. | Edu kirjutatakse pärast tasulist kutset ja vektori salvestamist, edenemisteade tuleb viimasena ja väljaspool; eduka rea kirjutamise tõrge peatab jooksu, reserveering jääb. | „failing progress report …“ |
| V03 | Järsk protsessi lõpp jättis luku, jätkamine andis `pilot_busy`. | Lukk võetakse üle ainult siis, kui omaniku protsess on samas masinas tõendatult kadunud; ülevõtt käib eraldi eksklusiivse markeriga (kaks käivitust ei jookse korraga). Tundmatu tulemusega reserveeringut ei saadeta uuesti. | „hard stop after a reservation …“ (päris lapsprotsess lõpetab end pärast reserveeringut) |
| V04 | Puuduva paariga päeviku sai lugeda lõpetatuks. | `complete` nõuab igale manifesti sisendile täpselt ühte õnnestunud kirjet sama räsi ja tokenitega; sama vana `ledger.json` taaskasutusel koos vektorite kontrolliga. | „a complete journal must cover every manifest input“ |
| V05 | URL-i täielik dekodeerimine võrdsustas `%2F`/`/`, `%26`/`&`, `%2B`/`+`. | Teekonnas dekodeeritakse kõik peale `/ ? # %`; päringus ja fragmendis ainult reserveerimata märgid ja mitte-ASCII tekst; host tõstutundetu; NFC. „SAK UA+bleed3mm.pdf“ = „SAK%20UA%2Bbleed3mm.pdf“ jääb kehtima. | URL-test (neli eraldaja paari annavad konflikti) |
| V06 | Kinnitatud puudumine oli rakendamata; valideerija positiivne lõpurida ei arvestanud lahendamata olekut; Peaasi aasta polnud kontrollitud. | `metadata_confirmations` toetab `absent: true` (väli tühi, kandidaadid asendatud, kohustuslikel väljadel keelatud); valideerija lõpetab veaga, kui midagi on lahendamata, ja loetleb kontrollimata väljad (Peaasi aasta). | „a confirmed absence empties a field …“ |
| V07 | Jooksja kasutas kutsuja objekte; tagasikutse sai järgmise sisendi teksti muuta. | Jooksja teeb plaanist, kinnitusest ja hinnast privaatsed koopiad enne kontrolli. | „changes to the caller's plan during a run cannot change what is sent“ |

Kogu korpuse sisukatvuse kontroll (`tmp/rag-v2-v13-check/coverage.mjs`, uus): iga v12-s tükeldatud
rida, mida v13 ei tükelda, peab olema pealkiri või viiteloendi rida — **kaotatud sisu 0**, V01 neli
algust olemas. Sama kontroll näitas, et v12 jättis välja ka päris sisu (nt „Pikk COVID esmatasandil“
peatükk „4.9. Tromboos pika covidi korral“ oli `Viited`-sektsiooni all); v13 toob selle tagasi.
Kontroll tabab V01 ka v2-l (kõik neli algust puudu). v13 pealkirjareeglid käsitsi siltide vastu:
377/389 valet eemaldatud, 42/42 ehtsat ja 743/743 küsimuspealkirja alles.

Testid: `npm test` 235 läbis (17 teenuse/päris-allika komplekti vahele), päris-artikkel 27/27,
kohalikud integratsioonikomplektid 56/56, lint puhas (3 vana vendor-hoiatust).

Metaandmeparandused on rakendatud Andmebaasi töötuppa (commit'imata): 13 metaandmefaili, Tallinna
paketi üks väli ja nende 14 räsi REGISTER.json-is (`tmp/rag-v2-corrections-v13/apply-record.json`).
Kõik 1077 metaandmeviidet klapivad registriga; 14 parandatud allikat valmistuvad ette blokeerijateta.

### v13 korpus ja ostuplaan

Uus store `tmp/rag-v2-corpus-store-v13` (v12 store jääb kirjeks): **5999 dokumenti**, kõik partiid
blokeerijateta (õigusaktid 59, juhendid 174, ajakiri 892, KOV 4874; ettevalmistuses 0 tõrget).
Ülevaatuse märkused nimetavad taseme: „automaatne värav läbitud; sisu käsitsi kontrollimata“, 13
parandatud allikal „metaandmed parandatud ja allikast kontrollitud“, kahel „ajalooline; ostu- ja
indeksivalikust esialgu välja“.

| | v12 plaan | v13 plaan |
|---|---:|---:|
| dokumente | 5985 | 5997 (5999 − EPIKoda 2013 − Võrdõigusvolinik 2016) |
| sisendeid | 29 051 | 29 452 |
| tokeneid | 14 682 957 | 14 982 779 |
| hind (0,13 USD/1M, kontrollitud 25.09 09:28 UTC) | 1,908784 USD | 1,947761 USD |
| egress-manifest | `cbcdc858…` | `372d4954…` |

v12 kinnitust v13 jaoks kasutada ei saa. Hind tuleb enne käivitamist uuesti kontrollida, kui
kontrollist on möödas üle 24 tunni.

Järelkontrolliks külmutatud: `tmp/rag-v2-freeze-v13-2026-09-25/` (39 koodifaili, Andmebaasi
parandused andmerühmana, ostupoliitika ja välistused, tõendid); kontroll
`node tmp/rag-v2-freeze-v13-2026-09-25/verify.mjs`.

Lahtine: sõnaline järjestus kogu korpusel (ADR-029) — ostu see ei takista, kogu korpuse piloot ootab
selle lahendust.

## 9. Codexi v13 järelkontrolli leiud N01–N06 ja v14 (25.09 öö)

Codexi v13 järelkontroll ([raport](rag-v2-codex-ingest-audit-2026-09-25.md), 230 testi, ostuplaan kordus
täpselt, 629 638 tekstiankrut vigadeta) leidis kolm otsinguteksti viga, katvuskontrolli mõõtmisvea ja
vana päevikuformaadi duplikaadiaugu. Järelkontroll on lõppenud; v13 külmutus jääb ajalooliseks kirjeks.
Kõik parandused on v14-s (`source-structure-v14` / `structure-blocks-v8`, teostuse sõrmejälg
`63666234…`).

| Leid | Mis oli | Parandus v14-s | Test |
|---|---|---|---|
| N01 | Viiteloendi järel taastatud tekst päris loendi sektsiooni („> Allikad“, „> Viited“). Laiem põhjus: loend lõppes alles viimase loendilaadse rea järel, nii et üks viitelaadne rida järgmises peatükis („juhend nr 5“, „2016. Uuring“) vedas loendi peatüki lõpuni; siis kukkus kogu sektsioon 30% bibliograafiatestist läbi ja läks koos kirjandusega tükkideks „Viited“ nime all. **v13-s oli viiteloendi nimega sektsioonis 1049 tükki 112 dokumendis.** | (1) Struktuur jagatakse enne tükeldamist: loendi järel olev tekst saab oma sektsiooni — tõendatud järgmise pealkirja all (kuvasuurus või teine kiri vähemalt põhiteksti suuruses, ≤4 rida, ≤150 märki; autorid ja asutus jäävad tekstiks), muidu loendi vanemtee all ilma loendi nimeta. (2) Proosa enne esimest kirjet (lehe teine veerg, mida loeti pärast esimese veeru jalamile jäänud pealkirja) läheb tagasi sektsiooni, mida ta jätkab. (3) Loend lõpeb seal, kus algab proosa (≥3 mitte-loendilaadset rida, ≥150 märki, pärast seda alla 30% loendilaadseid ridu); väike või lühike jooksev päis vahetult enne järgmise artikli kuvapealkirja jääb loendi juurde. (4) 30% arvestatakse loendi enda ridadelt; bibliograafiaks loetakse ka nummerdatud „[12] “, „et al.“, „vol.“ ja Chicago „2009. „Pealkiri“; veebiartikli joonealune „[2] (#_ftnref2)“ ei ole kirje; üks lühike kirje, mille järel tuleb proosa, on loend. **v14-s on selliseid tükke 62** (märksõnaread, sisukorrafragmendid, mõni tundmatu viitestiil, õiged „Materjalid“-sektsioonid). | „a reference list ends at the next article's display title…“ (sektsioonitee + hoiatus), „text after a reference list starts at a chapter title…“ (sh „nr 5“ ja nummerdatud loend), „prose read between a list heading and its first entry…“ |
| N02 | Astangu käsiraamatu korduv päis (15,96 pt, veidi allpool 10% servaala) sai v13 laiendatud alapealkirjareegliga pealkirjaks ja tõi lehe 40 kirjanduse otsingusse. | Päis tuntakse ära asukoha järgi: sama rida (tähed, numbrid otstes ei loe) ±2 pt samal kõrgusel ≥60% lehtedel (vähemalt 3), kuni kahekordse servaala sügavusel, välimine rida, üks kummalgi serval, mitte lehe ainus rida → `repeated_running_head`. Sama tekst mujal lehel jääb pealkirjaks (kaanepealkiri lk 1). Korpuses eemaldus 62 rida. | „a running head just below the margin zone is not a heading…“ |
| N03 | Häkatoni artikli infokasti kolm veergu ja nelja piirkonna kontaktid põimusid ridade kaupa ühte teksti. | Ühe veeruga lehel otsitakse kõrvuti veergude kasti: ≥3 järjestikust rida, mida lõhestavad samad vahed (≥0,5 em, kõigis ridades vabad; ≥2 vahet või üks ≥1,5 em), iga vahe joondatud (lahtrite algus, lõpp või kese ühel x-il — sõnavahede „jõgi“ joondust ei anna). Lahtri kaupa loetakse ainult siis, kui veerg jookseb edasi (sidekriips, koma või sidesõna rea lõpus, „@“ või väiketähega algus täis rea all ≥⅓ paaridest); numbritega veeruga andmetabel loetakse edasi ridade kaupa. Üks ühes veerus asuv rida kahe lõhestatud rea vahel jääb kasti. Hoiatus `pdf_text_box_read_by_cell`. | „a box of side-by-side columns in single-column text reads cell by cell; a table of entries reads row by row“ |
| N04 | Katvuskontrolli võti `pdf_page:start:end` põrkus HTML-is (199 kollisiooni) ja väljajätte hinnati sama tootmisotsusega. | Uus kontroll `tmp/rag-v2-v14-check/coverage.mjs`: võti = allikaüksus + nihked + tekstiräsi, unikaalsus ja tekstivastavus kontrollitakse; iga v13 kehast kadunud rida peab olema seletatud kontrolli **enda** tõendiga (sama üksuse sõnad teises järjekorras, pealkiri jõudis prefiksisse, jooksev päis samal kõrgusel ≥3 lehel, oma mustri järgi viitekirje või kahe kirje vahel, käsitsi läbi loetud ja märgistatud rida); nimetatud regressioonid (V01, N01 ×3, N02, N03) ja kõik muud vead annavad väljumiskoodi 1. | — (kontroll ise) |
| N05 | Vana `ledger.json` taaskasutus lubas duplikaadiga võltslõpetatust. | `complete` nõuab, et kirjete sisendi-ID-de hulk võrduks täpselt manifesti hulgaga (duplikaat ei asenda puuduvat). | E-04/13 laiendus: dubleeritud esimene kirje → `pilot_ledger_integrity_failed`, 0 kutset |
| N06 | Viiteloendi hoiatus loendas kogu sektsiooni, mitte väljajäetud ridu. | Hoiatus loeb tegelikke väljajäetud ridu ja nimetab sektsioonid, kus tekst jätkub (`continued_section_ids`) või kuhu ta naasis (`returned_section_ids`). | sama N01 test |

### Kogu korpuse kontroll (v13 store → v14)

`coverage.mjs` läbis (väljumiskood 0, 5999 dokumenti, 303 s): võtmekollisioone 0, tekstivastavuse vigu 0,
kadunud sisu 0, seletamata ridu 0, kõik nimetatud kontrollid läbisid.

| Mõõdik | Arv |
|---|---:|
| Muutunud dokumente | 207 |
| Tükke v13 → v14 | 29 585 → 29 491 |
| Sisendiräsid eemaldatud / lisandunud | 1614 / 1520 |
| Tokenid (kõik 5999 dokumenti) | 15 036 775 → 14 985 884 |
| v13 kehast välja jäänud read kokku | 4813 |
| — sama üksuse sõnad teises järjekorras (kast loetud lahtri kaupa) | 2106 + 28 |
| — viitekirjed (kontrolli muster / kahe kirje vahel / loendi nimi / käsitsi märgistatud) | 1896 / 534 / 22 / 20 |
| — jooksev päis (eemaldatud / loendi juures) | 36 / 36 |
| — pealkiri, mille tekst on prefiksis | 52 |
| — eemaldatud tsitaadikoopia (tähed jäävad kehasse) | 14 + 69 |
| Uusi ridu kehas | 5553 |
| Viiteloendi tükeldused (pealkirjaga / pealkirjata või tagasi) | 116 (55 / 61) |
| Kastiga lehti | 362 lehte 150 dokumendis |

Kastide lugemisjärjekorda mõõdeti eraldi (`box-quality.mjs`): rea sisse jäänud poolitussidekriipsud ja
poolitatud rea järel mittejätkuv rida, sama lehe v13 ja v14 võrdluses. **91 lehte paremad, 267 sama
skooriga, 4 lehel üks viga rohkem; kokku 368 → 187.** Käsitsi valim näitas, et „sama skooriga“ lehed on
enamasti kahe veeru artiklitekst ja tsitaadikastid, mis v13-s olid ridade kaupa läbisegi ning v14-s
loetakse veerg veeru järel; arvuliste tabelite reaseos jääb alles (numbriveeru reegel). Keerulised tabelid
ja skeemid pole ikka modelleeritud.

Pealkirjad käsitsi siltide vastu (sama komplekt, mis v13 puhul): **380/389 valet eemaldatud** (v13: 377),
**42/42 ehtsat ja 743/743 küsimuspealkirja alles**. Siltideta v12 pealkirjadest kadus v13-ga võrreldes 14
rohkem — enamasti veergude põimumisest tekkinud segapealkirjad; üks päris alapealkiri („Tugev side
kogukonnaga toetab eluga hakkamasaamist“) on nüüd kehatekst, tekst ise on otsingus alles.

Testid: `npm test` 239 läbis (17 teenuse/päris-allika komplekti vahele), päris-artikkel 27/27, kohalikud
integratsioonikomplektid 56/56, lint 0 viga (3 vana hoiatust).

### v14 korpus ja ostuplaan

Uus store `tmp/rag-v2-corpus-store-v14` (v13 store jääb kirjeks): **5999 dokumenti**, samad dokumendi-ID-d
mis v13-s, kõik kaheksa partiid ette valmistatud ilma tõrgete ja review-vajaduseta ning avaldatud.
Ülevaatuse märkused nimetavad kontrollitaseme nagu v13-s (`fill-review-v14.mjs`; uus töötlusmärkus
`pdf_text_box_read_by_cell` ei jõua mudelini). Ostupoliitika on sama nimekiri mis v13-s (5997 = 5999 −
EPIKoda 2013 − Võrdõigusvolinik 2016).

| | v13 plaan | v14 plaan |
|---|---:|---:|
| dokumente | 5997 | 5997 |
| sisendeid | 29 452 | 29 358 |
| tokeneid | 14 982 779 | 14 931 888 |
| hind (0,13 USD/1M, kontrollitud 25.09 09:28 UTC) | 1,947761 USD | 1,941145 USD |
| egress-manifest | `372d4954…` | `c5907736…` |

v13 kinnitust v14 jaoks kasutada ei saa. Hind tuleb enne käivitamist uuesti kontrollida, kui kontrollist on
möödas üle 24 tunni (26.09 09:28 UTC).

Järelkontrolliks külmutatud: `tmp/rag-v2-freeze-v14-2026-09-25/` (koodifailid, Andmebaasi parandused,
ostupoliitika, tõendid: testilogid, `coverage-final.json`, `box-quality-2.json`, `reviewed-exclusions.json`,
`heading-labels-v14.json`); kontroll `node tmp/rag-v2-freeze-v14-2026-09-25/verify.mjs` („freeze intact: 39
code files, plan c5907736c63b, generation d4893c82df82“). v13 külmutusega võrreldes muutus 10 faili:
`chunking.js`, `contracts.js`, `normalize.js`, `parser.js`, `pdf-layout.js`, `processing-implementation.json`,
`search/pilot-runner.js`, `text-source.js` ning testid `rag-v2-pilot.test.mjs` ja
`rag-v2-source-structure.test.mjs`. Andmebaasi parandused on v13-ga baidivõrdsed.

Lahtine: sõnaline järjestus kogu korpusel (ADR-029); keerukad tabelid ja skeemid; viiteloendi järel
jäävad autori-, tõlkija- ja tänuread (≤2 rida) endiselt välja nagu v13-s.

## 10. Codexi v14 järelkontrolli leiud M01–M05 ja v15 (25.–26.09 öö)

Codexi v14 järelkontroll ([raport](rag-v2-codex-ingest-audit-2026-09-25.md), 234 testi, 17 värsket
parsimist, ostuplaan kordus täpselt) leidis viis P2 leidu. Kõik on v15-s parandatud
(`source-structure-v15` / `structure-blocks-v9`). Iga uus regressioonitest kukub v14 koodiga läbi ja läbib
v15-ga (kontrollitud v14 koodikoopiaga).

| Leid | Põhjus | Parandus v15-s | Test |
|---|---|---|---|
| M01 | Sotsiaaltrendid 6 lk 85: sõnahaaval trükitud rööpjoondatud teksti laiad sõnavahed langesid kokku graafiku aastaarvude vahedega; kasti reeglid (≥3 rida, vahed kõigis ridades, joondus) said täidetud. | Kasti vahe peab igas reas olema ≥1,5 korda laiem kui ükski vahe sama lahtri sõnade vahel. | päris lehe koordinaadid: lause loetakse terve, kasti pole |
| M02 | Häkatoni bibliograafias oli Medar jt kirje kolmel jätkureal aasta ja link puudu; neile järgnev pikk infokast vähendas ülejäänud sektsiooni viitetihedust ja loend „lõppes“ kirje keskel (33 rida otsingusse). | Proosajooks lõpetab loendi ainult siis, kui ka järgmises 10 reas on alla 30% viitelaadseid ridu (pluss senine kogu saba tingimus). | kirje ilma aasta-/lingita jätkuridadega, järel neli kirjet ja pikk kast |
| M03 | Ühe kirjega lühike loend oli loend ainult tingimusel, et järgneb proosa; pärast jagamist proosat enam polnud ja tükeldamine otsustas uuesti. | `splitReferenceLists` märgib tuvastatud loendi sektsioonile `role: 'reference_list'`; tükeldamine ja hoiatus kasutavad seda. Rada kehtib ka HTML/XML/JSON-ile. | HTML läbi kogu ingest'i: kirje jääb välja, järgnev proosa sisse, hoiatus olemas |
| M04 | „Tugev side kogukonnaga toetab eluga hakkamasaamist“ (ühe kirjaga dokument) sõltus geomeetrilise reegli piirist 0,45 × tüüpiline rea pikkus. v13-s tõstsid tüüpilist pikkust ridade kaupa põimitud kahe veeru read; v14 kast lk 4 muutis seda statistikat ja 22-märgine rida jäi piiri taha. | (1) Kastis lahtri kaupa loetud read tüüpilist pikkust ei määra. (2) Vähemalt 2,5 rea suuruse vahe järel loetakse lühikeseks rida kuni 0,6 × tüüpiline pikkus. | 22 ja 27 märgi pikkune kaherealine vahepealkiri, tüüpiline rida 47 |
| M05 | Katvuskontroll: täpselt sobinud rida ei kulutanud oma sõnu, puuduv rida võis neid laenata. | Täpne vaste kulutab ka oma sõnad; kontroll alustab **enesetestiga** (kustutatud lause ja muudetud summa peavad olema kadu, kaheks lahtriks jagatud rida mitte) ja katkestab ebaõnnestumisel. | enesetest igas jooksus |

Lisaks sama vooru käigus:
- **Loendimärkide veerg** (valimi lehekontrollis leitud regressioon): täppide/kriipsude/numbrite veerg ei ole kasti veerg, vaid kuulub kõrvalolevale tekstile — täpploend jääb loendiks, harjutuste tabelis jääb iga kriips oma küsimuse juurde.
- **Sisukorra „Kasutatud kirjandus“** (Codexi näide pereõenduse juhendist): väikeses kirjas viiteloendi nimi ei ole pealkiri, kui nelja järgmise rea seas on paljas leheküljenumber ja mitte ühtki kirjet. Veebiartiklite „Viidatud allikad“, mille järel tuleb esmalt teise veeru tekst, jääb pealkirjaks.
- **Kaotatud pealkirjade kontroll**: iga v13 sektsioonipealkiri, mis v15-s enam pealkiri pole, loetletakse ja kukutab kontrolli, kui seda pole käsitsi üle vaadatud. Leitud 14 (kõik ridade põimumisest tekkinud segapealkirjad või tabelipäised) on märgistatud failis `reviewed-headings.json`.

### Kogu korpuse kontroll (v13 store → v15)

`tmp/rag-v2-v15-check/coverage.mjs` läbis (väljumiskood 0, 5999 dokumenti, 390 s): enesetest läbis;
kadunud sisu 0, seletamata ridu 0, üle vaatamata kaotatud pealkirju 0, võtmekollisioone ja tekstivastavuse
vigu 0; kõik nimetatud kontrollid (V01, N01 ×3, N02, N03, M01–M04) läbisid. Käsitsi märgistatud
bibliograafiaridu on 22 (v14 20 + Võrdõiguslikkus Eestis 2024 üks kahe reaga kirje).

| Mõõdik | v13 → v15 |
|---|---:|
| Muutunud dokumente | 193 |
| Tükke | 29 585 → 29 477 |
| Sisendiräsid eemaldatud / lisandunud | 1570 / 1462 |
| Tokenid (kõik 5999 dokumenti) | 15 036 775 → 14 985 587 |
| Viiteloendi nimega tükke (v13: 1049) | 59 |
| Kastiga lehti | 279 lehte 136 dokumendis (v14: 362) |

**Kastide kontroll ei tugine enam ainult poolitusskoorile.** Skoor: 84 lehte paremad, 190 sama, 5 ühe
veaga halvemad (kokku 341 → 175). Lisaks loeti läbi 20 lehte, mis skoori järgi ei paranenud, fikseeritud
juhujärjestusega (`SHA256("claude-v15:" + dokument + ":" + leht)`, fail `box-sample-review.json`):
**14 paremad, 3 osaliselt (keerukas tabel, kahe servaga külgmärkus, ühe andmereaga segatabel), 2 sama,
1 halvem → parandatud** (täpploend, vt loendimärkide veerg).

Pealkirjad käsitsi siltide vastu: **42/42 ehtsat ja 743/743 küsimuspealkirja alles**, 379/389 valet
eemaldatud (v14: 380 — üks vale jääb suurema vahe reegli tõttu alles).

Testid: `npm test` 243 läbis (17 teenuse/päris-allika komplekti vahele), päris-artikkel 27/27, kohalikud
integratsioonikomplektid 56/56, lint 0 viga (3 vana hoiatust).

Codexi N01 jäägist jäävad avatuks sisukorrast tulnud pealkirjad üldiselt (pereõenduse mõistete tabel
kannab nüüd sisukorra pealkirja „HAIGUSEGA PATSIENTIDELE“, mitte „Kasutatud kirjandus“) ja „Erivajaduste
alase teadlikkuse tõstmine“ lk 40–41 kahe reaga saba ühe kirjega loendi järel (küsimustiku algus
„Kasutatud kirjandus“ all). Need ei ole v14/v15 regressioonid; ostuvalikus saab need jätta või
dokumendi põhjendatult välja arvata.

### v15 korpus ja ostuplaan

Uus store `tmp/rag-v2-corpus-store-v15`: **5999 dokumenti**, samad ID-d, kõik kaheksa partiid ette
valmistatud ilma tõrgete ja review-vajaduseta ning avaldatud (`fill-review-v15.mjs`, kontrollitase nagu
varem). Ostupoliitika on sama nimekiri mis v14-s (5997 dokumenti).

| | v14 plaan | v15 plaan |
|---|---:|---:|
| dokumente | 5997 | 5997 |
| sisendeid | 29 358 | 29 344 |
| tokeneid | 14 931 888 | 14 931 591 |
| hind (0,13 USD/1M, kontrollitud 25.09 09:28 UTC) | 1,941145 USD | 1,941107 USD |
| egress-manifest | `c5907736…` | `6a371ab5…` |

v14 kinnitust v15 jaoks kasutada ei saa. **Hinnakontroll aegub 26.09 09:28 UTC**; enne ostu tuleb hind
uuesti kontrollida.

Järelkontrolliks külmutatud: `tmp/rag-v2-freeze-v15-2026-09-25/` (koodifailid, Andmebaasi parandused,
ostupoliitika; tõendid: testilogid, `coverage-final.json` koos enesetestiga, `box-quality-final.json`,
`box-sample-review.json`, `reviewed-exclusions.json`, `reviewed-headings.json`, `heading-labels-v15.json`);
kontroll `node tmp/rag-v2-freeze-v15-2026-09-25/verify.mjs` („freeze intact: 39 code files, plan
6a371ab54aba, generation 2d6618a962ad“). v14 külmutusega võrreldes muutus 7 faili: `chunking.js`,
`contracts.js`, `parser.js`, `pdf-layout.js`, `processing-implementation.json`, `types.d.ts` ja test
`rag-v2-source-structure.test.mjs`; Andmebaasi parandused on v14-ga baidivõrdsed. Teostuse sõrmejälg
`2cf99a60…`.

## 11. Codexi v15 järelkontrolli leiud R01–R03 ja v22 (26.09)

Codexi v15 järelkontroll ([raport](rag-v2-codex-ingest-audit-2026-09-25.md)) leidis kolm P2 leidu. Kõik on
parandatud ja töötlus on nüüd `source-structure-v22` / `structure-blocks-v16`. Muutus ainult `chunking.js`
(pluss sildid, sõrmejälg ja testid); `parser.js`, `pdf-layout.js` ja Andmebaasi parandused on v15-ga
baidivõrdsed. Iga uue reegli test kukub ilma selle reeglita läbi (kontrollitud reegli ajutise
väljalülitamisega).

| Leid | Põhjus | Parandus | Kontroll |
|---|---|---|---|
| R01 | Viiteloendi lõpupiir eemaldas kommentaari ja kaks infokasti. | Kaheksa rida või 600 märki proosat lõpetab loendi sõltumata järgnevast (kast, mille viimane rida on veebiaadress). Kontaktiplokk („Politsei 112“, „116006 (24/7)“) koos oma pealkirjareaga lõpetab loendi. Loendi-eelne tekst läheb tagasi eelmisse sektsiooni ainult siis, kui see on murtud proosa. | test „a box or comment after a list…“; nimelised kontrollid `r01_*` |
| R02 | Püsiv loendiroll kinnistas selgitava veebijoonealuse bibliograafiana. | Veebijoonealune „[n] (#_ftnrefn)“ koos järgnevate ridadega on selgitus, kui see ei alga nagu kirje; trükitud joonealune „7 …“ ilma viitemärkideta samuti. Selgitus pärast viimast kirjet lõpetab loendi ega loe 30% hulka. | sama test; `r02_*` |
| R03 | Kontroll võrdles ainult v13-ga ning URL või aastaarv kehtis bibliograafia tõendina. | Kontroll käib v15, v14 ja v13 store'i vastu. Bibliograafiaks loetakse rida ainult tugeva tõendiga (kirje algus, DOI, köide ja number, „et al.“, juurdepääsumärge, RT või ≤3 rea kaugusel sellisest); URL või aasta üksi ei tõenda midagi, veebijoonealune mitte kunagi. Iga välja jäetud rida auditeeritakse, ka see, mis polnud varem otsingus. Tõendamata rida kukutab jooksu, kui seda pole käsitsi märgistatud. | enesetest (kustutatud lause, muudetud summa, kaotatud täpiga punkt → kadu; lahtriteks jagatud rida, rea külge liitunud täpp → mitte) |

### Rangema kontrolli leitud uued vead (v19–v22)

Uus kontroll ja kogu korpuse skannimine (iga viiteloendi nimega sektsioon, mis jääb otsingusse) leidsid
viiteloendeid, mis olid otsingus juba v15-s või mille v15-kood lõpetas liiga vara:

| Dokument | Viga | Parandus |
|---|---|---|
| Pereõenduse tegevusjuhend lk 58–60 | numbrilised kirjed ilma aasta ja lingita („117. Butcher, H. K., …“) | „Perekonnanimi, I.“ algus ka numbriga; „(2018: 187)“; kirjealgus proosajooksus teeb jooksu loendi osaks |
| Ella Kirsipuu elu kutse lk 7 | arhiivi- ja ajaleheviited („Tartu teated. 7.11.1936.“) — kogu loend otsingus | kuupäevaga ajaleheartikkel on bibliograafiline rida |
| Võrdõiguslikkus Eestis 2024 lk 89 | kirjete link eraldi „Kättesaadav:“ real; kolm lingita kirjet järjest lõpetasid loendi | juurdepääsurida järgmise kuue rea seas jätkab loendit |
| Täiskasvanud erivajadusega inimeste abivajaduse hindamine lk 70–85; Narkootikumide tarvitamise olukord lk 19–20; Infektsioonikontrollialane toimepidevus lk 60–61 | Vancouveri stiil (aasta lõpus, „[Internet]“, „2020;6(1):17“, „Tallinn: Kirjastus; 2021“) — terved loendid otsingus | need märgid on bibliograafilised; Vancouveri autorid („Abel-Ollo K, Riikoja A,“) on kirje read |
| Tugevustele suunatud mõtteviis lk 6 | lõputänu, mille lause lõpeb veebiaadressiga | lõpetav proosa võib lõppeda oma lingiga; „Ajakiri, 31, 189–203.“ on kirje rida |
| Kuidas vastata inimese pöördumisele lk 5; Sotsiaalabi piirid lk 6 | seaduste ja kohtulahendite loendid — ühelgi real pole aastat sulgudes | loend kvalifitseerub ka siis, kui ≥60% ridadest on viitelaadsed |
| Tuleohutuspaigaldised lk 61 ja teised tuleohutusjuhendid | numbriline loend „1. Tuleohutuse seadus.“; puuduv ligatuur tegi sõnast „tulekustu�tele“ kontaktimärgi „tel“; „10.Jose“ ilma tühikuta | 1-st nummerdatud loend kahe viitelaadse reaga kvalifitseerub; kontaktisõna peab olema eraldi sõna; loendi järgmine number jooksus või kuue rea sees jätkab loendit |
| Lapse õiguste kaitse suhtluskorra kohtulahendis lk 6 (vanad ajakirjanumbrid) | veebiaadressidest ja kuupäevadest on punktid kadunud („www just ee/…“, „(26 08 2019)“) | need kujud on viitelaadsed |
| Sotsiaaltöö seirearuanne 2025 lk 20; KLAT (HTML) | üks kirje sektsiooni lõpus; ilmumismärge ja märksõnad pärast kirjeid lahjendasid osakaalu | kirjena algav üksikkirje on loend; osakaalu arvestatakse viimase viitelaadse reani |

Skannimine: v21 koodiga oli otsingus 44 viiteloendi nimega sektsiooni (391 rida), v22-ga 25 (86 rida).
Ülejäänud on õigesti otsingus: veebijoonealused selgitused, märksõnaread, kommentaar, ilmumismärkused ja
teisest veerust loetud tekst. Päris lekkeid jääb umbes 20 rida: tuleohutuskoolituse lk 163 semikoolonitega
loend, evakuatsioonijuhi koolituse kaks kirjet koos aadressiga, Tööampsu viitena kirjutatud veebijoonealune
ja „Erivajaduste alase teadlikkuse tõstmise“ ühe kirjega loend.

### Kogu korpuse kontroll (v22 vs v15 / v14 / v13)

`tmp/rag-v2-v16-check/coverage.mjs` läbis kõigi kolme võrdlusbaasi vastu (väljumiskood 0, 5999
dokumenti, ~580 s jooksu kohta). Enesetest läbis. Kadunud sisu 0, kontrollimata ridu 0, tõendamata
välja jäetud ridu 0, võtmekollisioone ja tekstivastavuse vigu 0. Kõik 23 nimelist kontrolli läbisid
(V01, N01–N03, M01–M04, R01, R02 ja v19–v22 loendid).

| Mõõdik | v15 → v22 | v14 → v22 | v13 → v22 |
|---|---:|---:|---:|
| Muutunud dokumente | 47 | 116 | 217 |
| Tükke | 29 477 → 29 478 | 29 491 → 29 478 | 29 585 → 29 478 |
| Tokenid (kõik 5999 dokumenti) | 14 985 587 → 14 976 431 | 14 985 884 → 14 976 431 | 15 036 775 → 14 976 431 |
| Sisendiräsid eemaldatud / lisandunud | 40 / 41 | 355 / 342 | 1597 / 1490 |
| Käsitsi märgistatud ridu kasutati | 116 | 116 | 214 |
| Sõnadeta read (täpp liitus oma punkti reaga) | 0 | 294 | 0 |
| Märgistatud kaotatud pealkirju | 0 | 4 | 14 |

Viiteloendina jääb välja 13 132 rida; viiteloendi nimega tükke on 31 (v15: 61); loendi järel jagatud
sektsioone 133, neist 65 oma pealkirjaga. Kastiga lehti on 279, sama palju kui v15-s, sest parser ei
muutunud. Pealkirjad käsitsi siltide vastu on samad mis v15-s: **42/42 ehtsat ja 743/743
küsimuspealkirja alles, 379/389 valet eemaldatud**.

**Käsitsi märgistus.** `reviewed-exclusions.json` sisaldab 550 rida: 22 on v14–v15 ajast, 528 lisandus
v19–v22-s. Iga rida on loetud oma lehe kontekstis (`evidence/read-by-hand.txt`):

| Mis rida on | Ridu |
|---|---:|
| kirje rida või osa kirjest (pealkiri, kirjastus, koht, kuupäev, link, number) | 511 |
| alapealkiri loendis („Arhiiviallikad“, „Internetiallikad“) | 11 |
| märksõnad või lehe metaandmed loendi järel | 8 |
| leheküljenumber loendi sees | 5 |
| artikli enda ilmumis- või rahastusmärge | 5 |
| tõlkija märge | 5 |
| joonealused loendi järel, teisel viitemärk (teadaolev piirang) | 2 |
| järgmise artikli rubriik, lisa pealkiri pildilehel, tagakaane asutuse nimi (kontaktiplokk jääb) | 3 |

Ükski neist ei ole dokumendi põhitekst. Kaotatud pealkirjade silte on 19 (`reviewed-headings.json`), neist
2 on märgitud **REAL**: need on päris pealkirjad, mis on kadunud veergude segunemise tõttu (vt piirangud).

Testid: `npm test` 260 läbis (3 päris-allika testi jäid vahele), päris artikkel 27/27, kohalikud
integratsioonikomplektid 56/56, lint 0 viga (3 vana hoiatust).

### v22 korpus ja ostuplaan

Uus store `tmp/rag-v2-corpus-store-v22`: **5999 dokumenti**, samad ID-d. Kõik kaheksa partiid valmistati
ette ilma tõrgete ja review-vajaduseta ning avaldati (`fill-review-v22.mjs`, kontrollitase nagu varem).
Ostupoliitika on sama nimekiri mis v15-s: 5997 dokumenti, EPIKoda 2013 ja Võrdõigusvolinik 2016 on väljas.

| | v15 plaan | v22 plaan |
|---|---:|---:|
| dokumente | 5997 | 5997 |
| sisendeid | 29 344 | 29 345 |
| tokeneid | 14 931 591 | 14 922 435 |
| hind (0,13 USD/1M) | 1,941107 USD | **1,939917 USD** |
| egress-manifest | `6a371ab5…` | `01ed2dd2…` |

v15 kinnitust v22 jaoks kasutada ei saa. **Hinnakontroll (25.09 09:28 UTC) aegus 26.09 09:28 UTC**;
enne ostu tuleb hind uuesti kontrollida.

Järelkontrolliks külmutatud: `tmp/rag-v2-freeze-v22-2026-09-26/`. Tõendites on:
- testilogid ja `lint.log`;
- `coverage-final-vs-v15/v14/v13.json` koos kontrolli skriptiga;
- `reviewed-exclusions.json`, `reviewed-headings.json` ja `read-by-hand.txt`;
- `unlisted-references-v21/v22.json`;
- `heading-labels-v22.json`, `box-quality-final.json` ja v15 kasti valimi ülevaatus;
- parandusandmete kirjed.

Kontroll `node tmp/rag-v2-freeze-v22-2026-09-26/verify.mjs` annab tulemuse „freeze intact: 39 code files,
plan 01ed2dd22cb9, generation 21f249a7de42“. v15 külmutusega võrreldes muutus 4 faili: `chunking.js`,
`contracts.js`, `processing-implementation.json` ja test `rag-v2-source-structure.test.mjs`. Teostuse
sõrmejälg on `d92d9b67…`, `scope_sha256` `45b0256f…`.

### Lahtised piirangud

- **Tööjõu vajadus sotsiaaltöö valdkonnas lk 5:** pealkiri „Viidatud allikad“ on veeru allservas; selle all
  on teise veeru tekst ning viis kirjet loetakse OSKA kasti sektsiooni. Kirjed on otsingus (ka v15-s).
- **Veergude segunemine kolmel lehel (v15-st alates, M01 kastireegli tõttu):** „Ülimitmekesisus“ lk 5
  („… vastasti- Lõpetuseks“), „Kuidas anda vaimse tervise probleemide korral…“ lk 4 kasti pealkiri ja
  „Lapse osalemise põhimõtted“ lk 1 plakat. Sõnad on otsingus alles, kuid lugemisjärjekord on halvem.
  Kaks päris pealkirja on kadunud ja plakati paneeli pealkiri on sulandunud teise pealkirja sisse.
  Kasti kontroll: 5 lehte on halvemad kui v13-s (sama mis v15-s).
- **Kommentaari kaks allikarida** („Personaalne peegeldus…“ lk 6) on otsingus. v15-s oli kogu kommentaar
  koos allikatega väljas.
- **Loendi järel olevad joonealused viitemärgiga** („Interprofessionaalne meeskonnatöö“ lk 6) jäävad loendiga välja.
- Varasemad piirangud jäävad: sisukorrast tulnud pealkirjad, keerukad tabelid, ADR-029 sõnalise otsingu kiirus.

## 12. Codexi v22 järelkontroll ja v25 (26.09 õhtu)

Codexi v22 järelkontroll ([raport](rag-v2-codex-ingest-audit-2026-09-25.md)) sulges R01 ja R02. **R03 jäi
avatuks kontrolli loogika osas**: kontrollskripti `tail` reegel lubas URL-iga rea bibliograafiaks, kui kuni
kolm rida eespool oli tugev viitemärk. Seejuures polnud vahel olevatel otsingusse jäänud ridadel,
sektsioonil ega leheküljel tähtsust, nii et kustutatud sisuline lause „Abi saab ka ilma saatekirjata.
Täpsem teave https://…“ andis tulemuseks „kadu 0“. Ka kastiga enesetest nõudis ainult koguarvu, mitte
konkreetse sisurea tuvastamist. Lisaks aegus hinnakontroll ning Codex märkis hilisemad piirangud L01–L04.

### Kontrolli parandus (R03)

`tmp/rag-v2-v16-check/coverage.mjs`:
- **Tõendit hinnatakse välja jäetud ridade katkematus jadas lugemisjärjekorras.** Otsingusse jäänud rida,
  pealkiri või teine sektsioon katkestab jada. Lehe- või veeruvahetus alustab uue jada; sellega võivad
  eelmise lõpu külge liituda ainult selle kolm esimest, sabakujulist rida (sama kirje jätk).
- **Kirje saba peab olema sabakujuline:** väiketähe, numbri, sulu või lingiga algav rida, „Koht: Kirjastus“,
  lõpus leheküljed või köide, või kuni kolm sõna. Suurtähega algav neljasõnaline või pikem lause ei ole
  kirje saba, olgu seal milline aadress tahes.
- **Enesetestid kontrollivad konkreetseid ridu:**
  - Codexi kaks vastunäidet (samas allikaüksuses ning teises üksuses, lehel ja sektsioonis) peavad
    näitama kustutatud lauset kaona;
  - kasti URL-iga sisurida peab olema tõendamata;
  - kontrollnäited: kirje saba jääb tõendatuks ka üle lehekülje, järgmise lehe URL-iga proosa aga mitte.
- **Codexi enda vastunäite skript** annab uue võrdlusfunktsiooniga mõlemal juhul `lost=1` (varem 0).

### Mida parandatud kontroll leidis ja mis v23–v25-s parandati

v22 põhjustatud uut kadu ei leitud. Nähtavale tulid aga juba v13-st välja jäänud selgitavad read:
ajakirja lehe joonealused, mis on trükitud viiteloendi alla kirjete vahele, ja kaks lõpumärkust, mille
lause lõpeb veebiaadressiga. Parandused on ainult `chunking.js`-is:

| Dokument | Mis nüüd otsingus on |
|---|---|
| Laste väärkohtlemise märkamine lk 5 | joonealune „2 Nt NICE (2009) ravijuhend annab soovitusi … tuleks kahtlustada väärkohtlemist.“ |
| Quo vadis, tõendus? lk 6 | „2 Sotsiaalse või ühiskondliku mõju võlakirjadest on kirjutanud … Heateo Sihtasutus.“ |
| Miks on keelatud lapse kehaline karistamine lk 5 | „3 Uuringute andmetel on stressi ja depressiooni all kannatavatel emadel suurem risk …“ |
| Erik Allardti heaoluteooria lk 7 | „5 Siinses analüüsis me ei pööranud tähelepanu … hinnetele.“ |
| COVID kui võimaluste aken lk 7 | „2 „It's the economy, stupid” on fraas … „It's the planet, stupid!”“ (3 rida) |
| Interprofessionaalne meeskonnatöö lk 6; Õigus loomupärasele väärikusele lk 7 | joonealune koos lingiga lõppeva jätkureaga |
| Koos kainema ja tervema Eesti poole lk 1 | lõpumärkus „Perelepitusest saate rohkem lugeda … Ühingu kodulehel www.lepitus.ee.“ |

Reeglid:
- **Selgitav joonealune** jääb loendi sektsiooni, kuid läheb tükki. Tingimused:
  - see algab pärast lõppenud rida;
  - numbrile järgneb suurtähega sõna;
  - esimesel real pole linki;
  - pärast numbrit ei alga kirje („1 AS Turu-uuringud (2018). …“ on allikas ja jääb välja);
  - koos lause jätkuridadega on vähemalt kuus sõna.

  Jätkuread võivad lõppeda veebiaadressiga, kuid muid viitemärke neis olla ei tohi.
- **Lõpumärkus** võib lõppeda reaga, mille teeb viitelaadseks ainult selle veebiaadress.
- **v24 valepositiivsed:** v24-s leidis kontroll ise kaks valet joonealust. Need olid murtud kirjeread
  („… Yale COVID-“ / „19 Cardiovascular Registry) …“ ja „… Väljataga, S“ / „15 Ajalugu ja tänane päev …“),
  millest teine võttis kaasa järgmise kirje. v25-s alustab joonealune ainult lõppenud rea järel ja
  jätkurida tohib olla viitelaadne ainult lingi tõttu.

Iga reegli test kukub ilma selle reeglita läbi. Nimelised kontrollid on nüüd 31 dokumendil (v22-s 23):
lisandusid v23–v25 joonealused, lõpumärkus ja kaks valepositiivset.

### Codexi L01–L04

- **L03:** COVID-juhendi lk 9 algoritm on sisuline otsustuspuu **ilma tekstikihita**. Parandasin märgenduse:
  skeemi sisu korpuses pole (OCR-i piirang), välja jääb ainult lisa pealkiri.
- **L01, L02 ja L04 jäävad kirjeldatud piiranguteks:**
  - ~20 rida bibliograafialekkeid ja 31 viiteloendi nimega tüki prefiksit, millest osa on õigesti
    säilinud sisu;
  - kolm keeruka paigutusega lehte;
  - harjutusemalli silt „Harjutus 0.0“.

**Hind:** manifest ei sõltu hinnast, sest hind antakse alles käivitamisel (`--price`) ja see peab olema alla
24 tunni vana. Järjekord on:
1. Omanik kinnitab manifesti ja kulupiiri.
2. Hind kontrollitakse vahetult enne ostu.
3. Ost käivitatakse 24 tunni jooksul pärast hinnakontrolli.

### Kogu korpuse kontroll parandatud kontrolliga (v25 vs v15 / v14 / v13)

Kontroll läbis kõigi kolme võrdlusbaasi vastu (väljumiskood 0, 5999 dokumenti, ~620 s jooksu kohta).
Enesetest läbis, ka Codexi vastunäited ja kontrollnäited. Kadunud sisu 0, kontrollimata ridu 0, tõendamata
välja jäetud ridu 0, võtmekollisioone ja tekstivastavuse vigu 0. Nimelised kontrollid läbisid kõigil 31
dokumendil.

| Mõõdik | v15 → v25 | v14 → v25 | v13 → v25 |
|---|---:|---:|---:|
| Muutunud dokumente | 55 | 124 | 225 |
| Tükke | 29 477 → 29 487 | 29 491 → 29 487 | 29 585 → 29 487 |
| Tokenid (kõik 5999 dokumenti) | 14 985 587 → 14 977 230 | 14 985 884 → 14 977 230 | 15 036 775 → 14 977 230 |
| Sisendiräsid eemaldatud / lisandunud | 40 / 50 | 355 / 351 | 1597 / 1499 |
| Käsitsi märgistatud ridu kasutati | 125 | 125 | 232 |

Viiteloendina jääb välja 13 114 rida. Viiteloendi nimega tükke on 38: seitse neist on nüüd säilinud
joonealused, mille tüki teekond on „… > Viidatud allikad“. Pealkirjad käsitsi siltide vastu on samad mis
v15-s (42/42 ehtsat, 743/743 küsimuspealkirja, 379/389 valet eemaldatud). Kastiga lehti on 279.

**Käsitsi märgistus:** 652 rida (v22-s 550, parandatud kontroll lisas 102):

| Mis rida on | Ridu |
|---|---:|
| kirje rida või osa kirjest | 602 |
| leheküljenumber loendis | 13 |
| alapealkiri loendis | 11 |
| märksõnad või lehe metaandmed | 8 |
| artikli ilmumis- või rahastusmärge | 7 |
| tõlkija märge | 5 |
| muud (lisa pealkiri pildilehel, tagakaane asutuse nimi, rubriik, ingliskeelse kokkuvõtte viide, 2 viitemärgiga joonealust) | 6 |

Testid: `npm test` 261 läbis (3 päris-allika testi jäid vahele), päris artikkel 27/27, kohalikud
integratsioonikomplektid 56/56, lint 0 viga (3 vana hoiatust).

### v25 korpus ja ostuplaan

Store `tmp/rag-v2-corpus-store-v25`: **5999 dokumenti**. Kõik kaheksa partiid valmistati ette ilma
tõrgete ja review-vajaduseta ning avaldati (`fill-review-v25.mjs`). Ostupoliitika on sama: 5997 dokumenti.

| | v22 plaan | v25 plaan |
|---|---:|---:|
| dokumente | 5997 | 5997 |
| sisendeid | 29 345 | 29 354 |
| tokeneid | 14 922 435 | 14 923 234 |
| hind 0,13 USD/1M juures | 1,939917 USD | **1,940020 USD** |
| egress-manifest | `01ed2dd2…` | `17d3ffa5…` |

Plaan on koostatud **ilma hinnafailita**. Viimane kontrollitud hind (0,13 USD/1M, 25.09 09:28 UTC) on
aegunud ja plaanikoostaja keeldub aegunud hinnast (`price_verification_stale`). Seetõttu on kulu arvutatud
sama hinnaga, kuid seda ei ole uuesti kontrollitud.

Külmutatud: `tmp/rag-v2-freeze-v25-2026-09-26/`. Kontroll `node tmp/rag-v2-freeze-v25-2026-09-26/verify.mjs`
annab „freeze intact: 39 code files, plan 17d3ffa5e910, generation 18f457dc8970“. v22 külmutusega võrreldes
muutusid `chunking.js`, `contracts.js`, `processing-implementation.json` ja test; parser ja Andmebaasi
parandused on samad. Sõrmejälg on `aa9b917b…`.

Tõendites on lisaks:
- parandatud kontrolliskript;
- Codexi vastunäite kordus uue võrdlusfunktsiooniga (`codex-adversarial-new-checker.*`);
- kõik käsitsi loetud read (`read-by-hand.txt`).

v22 külmutus jääb alles, sest Codex vaatas selle üle.
