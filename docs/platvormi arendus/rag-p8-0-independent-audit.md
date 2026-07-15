# RAG-P8.0 sõltumatu sihitud audit

## Lõppverdikt

**OPUS HEAKS KIIDETUD**

Auditeeritud commit `4c3fceb5aeb5ea203e77f749c4dcce24e1ab7c66` täidab kinnitatud P8.0 skoobi. P0- ja P1-leide ei ole. Üks P2 auditimärkus puudutab muutmata alusdokumendi olemasolevat trailing-space'i; see ei ole P8.0 koodiviga ega parandusnõue, sest alusdokument pidi jääma lähtefailiga bait-baidilt identseks.

## Auditi alus ja eraldatus

- Auditeeritav haru: `codex/rag-p8-0-master-inventory`.
- Auditeeritav commit: `4c3fceb5aeb5ea203e77f749c4dcce24e1ab7c66`.
- Lähtecommit: `890124bdbef17f899ba15c11c93450ef17875fac`.
- Audit tehti detached-worktree's `C:\Users\rauds\Desktop\SotsiaalAI-rag-p8-0-independent-audit`.
- Lähtecommit'i regressioonid kontrolliti eraldi detached-worktree's `C:\Users\rauds\Desktop\SotsiaalAI-rag-p8-0-base-audit`.
- Auditeeritav haru jäi kogu auditi ajal puhtaks ja track'is muutmata remote-haru.
- Audit ei teinud ingest-, patch-, delete-, migratsiooni- ega deploy-toiminguid. Produktsiooni vastu tehtud RAG-kontroll oli ainult read-only `GET /documents`; DB-validaator tegi ainult `count` päringuid.

Täielikult loeti:

1. `docs/platvormi arendus/fable-5-rag-p8-url-korje-tehniline-tooplaan.md` — 650 rida;
2. `docs/platvormi arendus/rag-p8-0-codex-progress.md` — 108 rida.

## Leiud prioriteedi järgi

### P0

Leide ei ole.

### P1

Leide ei ole.

### P2 — muutmata alusdokumendi whitespace-erand

`git diff --check 890124bd..4c3fceb5` lõpetab koodiga 2 ja näitab üht trailing-space'i failis `fable-5-rag-materjalide-elutsukkel-ja-automaatne-allikavarskus.md:526`.

See ei ole P8.0 teostuse tekitatud sisuline viga:

- lähtefaili ja commit'i faili SHA-256 on mõlemal `9aa433806479c8502b0d3ffd8f5e1871b8d63ca0054d9b5198d66bca37b33427`;
- failid on bait-baidilt identsed;
- trailing-space'i eemaldamine rikuks siduvat nõuet kopeerida alusdokument muutmata kujul.

P8.0 enda koodi, skeemi, fixture'i, testide ja progressidokumendi scoped `git diff --check` on puhas. Parandust ei nõuta.

## 15 kontrollpunkti

### 1. Kõigi 323 legacy-identiteedi reprodutseerimine — PASS

`normalizeRegistryIdentityUrl` rakendab eraldi `registry_identity_v1` lepingut (`scripts/lib/url-canonical.mjs:125–186`): trim, kogu stringi `decodeURIComponent` ja lõpuslaši eemaldamine ainult mittejuur-path'il.

Kolm omavahel sõltumatut tõendit:

- repo sihttest `tests/scripts/urlCanonical.test.js:99–114` läbis kõik 323 kirjet;
- auditi eraldiseisev sama andmereegli arvutus andis `independent_legacy_mismatches=0`;
- teostuse funktsioon andis `implementation_mismatches=0`.

`master_sources_final.json` jäi kontrolli ajal bait-baidilt muutmata.

### 2. Registri identiteet ja võrgu-URL on lahutatud — PASS

- Registrileping on `registry_identity_v1` (`url-canonical.mjs:125–186`).
- Võrguleping on eraldi `network_url_v1` (`url-canonical.mjs:188–240`).
- Võrguleping eristab `canonical_url`/`fetch_url` ja ainult võrdluseks mõeldud `comparison_key` (`url-canonical.mjs:191–199, 231–238`).
- Inventuur ehitab eraldi `byNetwork` ja `byRegistry` indeksid (`master-sources-inventory.mjs:553–566`).
- Võrdlus toimub ainult network-võti ↔ network-indeks ning registry-võti ↔ registry-indeks (`master-sources-inventory.mjs:569–579, 776–785`). Ristlepingulist võrdlust ei ole.

Kõigist 323 kirjest erinesid registry identity ja network comparison key 186 juhul. Lahknevused raporteeriti `registry_identity_differs_from_network_key` anomaaliana, kumbagi väärtust muutmata.

### 3. Anomaaliad ei muuda kanoonilist registrit — PASS

Registri laadija kasutab ainult `fs.readFile` (`master-sources-inventory.mjs:401–433`). URL-funktsioonid on puhtad; anomaaliad lähevad snapshoti `sources[*].anomalies` ja koondisse (`master-sources-inventory.mjs:694–723, 799–845`). Registrile puudub ükski kirjutustee.

Sihttest loeb registri enne ja pärast kõigi URL-ide töötlemist ning võrdleb baite (`urlCanonical.test.js:99–114`). Auditi sõltumatu kontroll kinnitas `registry_bytes_unchanged=true`.

### 4. Inventuur on päriselt read-only — PASS

Live-sisendi ainus võrgukutse on:

- tee `/documents` (`master-sources-inventory.mjs:509–512`);
- meetod `GET` (`master-sources-inventory.mjs:513–517`).

Moodul ei impordi ingest-, patch- ega delete-kliente. Staatiline endpoint-scan ei leidnud koodist `/ingest`, `patch-meta`, `update-meta`, POST-, PUT-, PATCH- ega DELETE-kutset. Testi fetch-spy kinnitas ainult ühe `GET /documents` kutse ja API-võtme mittelekkimise (`inventoryMasterSources.test.js:119–138`).

### 5. 167 URL-vastet jagunevad 160 + 7 — PASS

Raporteeritud produktsioonidumpi SHA-256 on `4ba8e8f9a49560cb2782ef465a4e8b18553e77dd23a4e9e3766007bbfabc8385`; dump sisaldab 5824 dokumenti ja on seotud registriräsiga.

Sama dumpi vastu uuesti käivitatud audit andis:

| Seisund | Arv |
|---|---:|
| `needs_adoption` | 160 |
| `incomplete` | 7 |
| `missing` | 156 |
| kõik muud seisundid, sh `covered_ok` | 0 |

Kõik 167 `evidence.url_match=true` kirjet jagunesid ainult `needs_adoption=160` ja `incomplete=7`. Kõigil seitsmel `incomplete` kirjel oli valitud RAG-dokumendi `chunks=0`. Jaotuse summa on 167.

### 6. `missing=156` kanoniseerimise valenegatiivid — PASS

Auditi sõltumatu analüüs luges 5824 RAG-dokumendist 9438 URL-väärtust. Produktsioonivastuses esinesid ainult neli URL-välja, mida teostus kõiki tunneb: `url_canonical`, `sourceUrl`, `source_url`, `source_urls`.

Sõltumatu network- ja legacy-indeks andis mõlemal täpselt 167 vastet ning nende union oli samuti 167. Kõigi 156 `missing` kirje vastu prooviti lisaks:

- path'i väiketähestamist;
- http/https skeemi ignoreerimist;
- query eemaldamist;
- legacy täisdekodeerimist.

Lisavasteid saadi kõigis neljas diagnostilises variandis 0. Seega ei sisalda `missing` kanoniseerimise tõttu tekkinud valenegatiivseid.

Kahel `missing` kirjel on ainult normaliseeritud pealkirja vihje ajakirjakihi dokumendile:

- `tartu_ulikooli_repositoorium_info_ja_kommunikatsioonitehnoloogia_kasutamine_sotsiaaltoos`;
- `tartu_ulikooli_repositoorium_lastekaitsetooga_kokku_puutunud_laste_ja_lahedaste_vaade_las`.

Nende URL-id ei ole ühegi kontrollitud lepingu ega diagnostilise aliase järgi võrdsed. Need on võimalikud sisulise dedupe'i vihjed, mitte URL-kanoniseerimise valenegatiivid; P8.0 jätab need õigesti tõendamata `missing` seisundisse.

### 7. `covered_ok=0` on konservatiivne leping — PASS

Klassifitseerija kontrollib esmalt duplikaati, redirect'i, null-chunke, omandi/metakvaliteeti, värskust ja teist pipeline'i (`master-sources-inventory.mjs:668–688`). Kui need kõik läbivad, tagastab P8.0 teadlikult `needs_content_check`, sest värsket allikaveebi fetch'i ei tehta (`master-sources-inventory.mjs:690–691`).

Piirang on masinloetavas väljundis sõnaselgelt kirjas (`master-sources-inventory.mjs:94–100`). `covered_ok` ei jää nulli kõrvalise klassifitseerimisvea tõttu, vaid P8.0 tõendusläve tõttu.

### 8. Räsi, atomaarne kirjutamine ja fail-closed — PASS

- Registri SHA-256 arvutatakse loetud baitidest (`master-sources-inventory.mjs:401–433`).
- Dumpi deklareeritud registriräsi peab klappima (`master-sources-inventory.mjs:436–466`).
- Olemasoleva snapshoti vale räsi, katkine JSON, tundmatud väljad, valed seisundid ja sisemiselt vastuolulised loendurid lükatakse tagasi (`master-sources-inventory.mjs:849–943, 986–995`).
- Kirjutus kasutab eksklusiivset ajutist faili, `fsync`-i, sulgemist ja rename'i; veal eemaldatakse ainult temp-fail (`master-sources-inventory.mjs:955–982`).

Sihttestid kinnitasid katkise faili säilimise, vale registriräsi keeldumise, vastuoluliste loendurite keeldumise ja simuleeritud rename-eelse vea puhul vana faili bait-baidilt säilimise (`inventoryMasterSources.test.js:140–213`).

P8.0 snapshot ei ole scheduler'i runtime-tõeallikas. Protsessiülene CAS/lukustus on siduvalt jäetud P8.5 otsuseks; selle puudumine ei ole P8.0 regressioon.

### 9. Produktsiooni artefaktid on gitist väljas — PASS

- `logs/` on ignoreeritud (`.gitignore:28`).
- Ainult genereeritav `master_sources.state.json` on täpse juurreegliga ignoreeritud (`.gitignore:29`).
- `git ls-files` ei leidnud snapshoti, produktsiooniraportit ega toordumpi.
- `git check-ignore -v` kinnitas snapshoti, raporti ja dumpi ignoreerimisreeglid.

Versioonihalduses on ainult skeem, kirjutaja, sünteetiline fixture, testid ja koondarvud progressidokis.

### 10. JSON-skeem vastab päris väljundile — PASS

Produktsioonidumpist uuesti loodud 323-kirjeline `master_sources.state.json` valideerus `ajv-cli 5` draft-2020 režiimis skeemi `master_sources.state.schema.json` vastu. Struktuurivigu oli 0. Ajv CLI-l puudus `date-time` formaadiplugin, kuid kirjutaja enda v1-validaator kontrollib `updated_at` väärtust parsitava kuupäevana (`master-sources-inventory.mjs:863`) ning snapshoti väärtus läbis selle kontrolli enne kirjutamist.

### 11. JSON-väljund, väljumiskoodid ja saladused — PASS

Auditi eraldi CLI-maatriks kinnitas:

| Juhtum | Exit | Veakood | JSON parsitav | Saladuse/teksti leke |
|---|---:|---|---|---|
| edu | 0 | — | jah | ei |
| CLI sisendiviga | 2 | `unknown_option` | jah | ei |
| registrilepingu viga | 3 | `registry_invalid_shape` | jah | ei |
| live-teenuse viga | 4 | `rag_service_api_key_missing` | jah | ei |
| URL-i credential'i keeld | 4 | `rag_service_forbidden_url` | jah | ei |
| väljundi kirjutusviga | 5 | `report_write_failed` | jah | ei |

Kontrollis kasutati API-võtme, URL-parooli, dokumenditeksti ja fixture-secret'i sentinel-väärtusi. Ükski neist ei jõudnud stdout'i ega stderr'i. Produktsiooni snapshoti ja raporti rekursiivne väljakontroll leidis 0 `text`, `content`, `body`, `api_key`, `secret`, `password` või `token` välja.

### 12. Fixture'i andmeohutus — PASS

Fixture sisaldab kaheksat sünteetilist RAG-kirjet:

- ükski fixture'i document ID ei kattu produktsiooni 5824 dokumendi ID-ga;
- 0 e-posti aadressi, 0 Eesti isikukoodi mustrit ja 0 UUID-d;
- hash'id, chunk-arvud, kuupäevad ja RAG-identiteedid on testväärtused;
- teksti ja API-võtme väljad sisaldavad ainult selgelt nimetatud sentinel'e lekketestiks.

Kaks URL-i ja kaks pealkirja kattuvad avaliku, repos juba versioonitud master-registri viiteandmetega ning seetõttu ka produktsioonis nähtava avaliku allikametaga. Need ei ole produktsioonidumpist kopeeritud RAG-dokumendid: document ID kattuvus on 0 ning fixture ei sisalda kasutajasisu ega produktsiooni dokumentide teksti/metakirjeid.

### 13. Alusdokumentide baitidentiteet — PASS

- Elutsükli dokumendi lähte- ja commit-räsi: `9aa433806479c8502b0d3ffd8f5e1871b8d63ca0054d9b5198d66bca37b33427`.
- P8 tööplaani lähte- ja commit-räsi: `1db931272b9670c6c888f4b2e06bfea89894e9fc55d55e77ea98d67c126b8a65`.

Mõlemal juhul kinnitas otsene blobivõrdlus `byte_identical=true`.

### 14. Keelatud puutepind on muutmata — PASS

Lähte- ja sihtcommit'i Git tree objektid on identsed järgmistes kohtades:

- `master_sources_final.json`;
- `package-lock.json`;
- `prisma/` ja `prisma/migrations/`;
- `app/`, `components/`, `lib/`;
- `rag-service/`.

Registri SHA-256 on `3ef352d684474218a58806f799d8a0f2f8addd088d2dbe9e88973fd59eabc0d6`. Commit muutis ainult 12 dokumentatsiooni-, CLI-, helperi-, skeemi-, fixture'i-, testi- ja gitignore/package-script faili.

### 15. Testiarvu võrdlus lähtecommitiga — PASS

Mõlemad commit'id käivitati eraldi detached-worktree's sama muutmata `package-lock.json` sõltuvustega:

| Commit | Teste | Läbitud | Ebaõnnestunud | Skipped/todo |
|---|---:|---:|---:|---:|
| `890124bd` | 1222 | 1222 | 0 | 0 |
| `4c3fceb5` | 1237 | 1237 | 0 | 0 |

Kasv on täpselt +15, mis võrdub P8.0 kahe uue testifaili 15 testiga. `git diff --diff-filter=D -- tests` ei leidnud eemaldatud teste ning `package.json` olemasolev `npm test` käsk ei muutunud; lisandus ainult `rag:master:inventory` skript.

## Käivitatud kontrollid

| Kontroll | Tulemus |
|---|---|
| P8.0 sihttestid | 15/15 PASS |
| Audititava commit'i `npm test` | 1237/1237 PASS |
| Lähtecommit'i `npm test` | 1222/1222 PASS |
| P8.0 failide ESLint | 0 viga, 0 hoiatust |
| Audititava commit'i kogu lint | 0 viga, 358 hoiatust |
| Lähtecommit'i kogu lint | 0 viga, samad 358 hoiatust |
| `knowledge:validate -- --root "Andmebaasi\lisatest"` | 5/5 ingest-ready, 0 viga |
| `organization:audit-metadata -- --slug astangu` | `ok=true`, metadata validne, ingest-ready |
| KOV static-payload testid | 2/2 PASS |
| Master-PDF dry-run lähte vs siht | bait-baidilt identne, SHA-256 `5fdec9b44dd7c8f0c6a90b4d97d470dcd3ad32191d14d2813031fd07fd2d8494` |
| `practices:rag:verify` lähte ja siht | mõlemad PASS: jääke 0, stale viiteid 0 |
| JSON Schema vs produktsiooniväljund | VALID |
| `git diff --check` | ainult üks muutmata alusdokumendi whitespace-erand; P8 scoped diff puhas |

`practices:rag:verify` nõudis desktop-Node'is `NODE_OPTIONS=--conditions=react-server`, sest tingimuseta käivitamisel laadis sõltuvusahel `server-only` viskemooduli. Sama käitumine ja sama edukas tingimuslik käivitus kehtisid lähte- ja sihtcommit'is; P8.0 ei muutnud seda koodi ega package-scripti.

## Jääkriskid ja teadlikud piirid

1. P8.0 ei fetch'i allikaveebe ega tõenda sisuterviklust; seetõttu on `covered_ok=0` nõutud konservatiivne tulemus.
2. Kaks pealkirjavihjet võivad P8.2 sisudedupe'is osutuda teise pipeline'i katvuseks, kuid P8.0-l pole URL-i ega sisuhash'i tõendit nende ümberklassifitseerimiseks.
3. Snapshot ei ole scheduler'i runtime-tõeallikas. Protsessiülene lukustus/CAS ja püsiseisu kandja otsustatakse P8.5-s.
4. Täielik `git diff --check` jääb mitt nulliks seni, kuni bait-baidilt kopeeritud alusdokumendi lähtefailis on trailing-space; P8 koodidiff on puhas.

Need piirid on dokumenteeritud, ei peida P8.0 viga ega nõua auditeeritava commit'i parandamist.

## Kinnitus

P8.0 teostus on skoobipuhas, read-only, andmetest reprodutseeritav, fail-closed, testidega kaetud ning lähtecommit'i suhtes regressioonivaba.

**OPUS HEAKS KIIDETUD**
