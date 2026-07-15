# RAG-P8.0 Codexi teostuse progress

STATUS: COMPLETE

## Tööpiir

Teostatud on ainult pakett P8.0: URL-i kaks eraldi lepingut, read-only master-listi inventuur, CLI ja raport, atomaarne keskkonnaspetsiifilise seisundisnapshoti kirjutaja, skeem, deterministlik fixture ning regressioonitestid.

P8.0 ei teinud allikaveebi fetch'i, ingest'i, RAG-i patch/delete-kutseid, registrimuudatusi, migratsioone, scheduler'it ega deploy'd. Päris produktsiooni snapshot ja toores RAG-dump jäid gitignore'iga kaetud lokaalseks auditisisendiks ning neid ei versioonihaldata.

## Lähteolek ja eraldatus

- Lähtecommit: `890124bdbef17f899ba15c11c93450ef17875fac` (värskelt fetch'itud `origin/main`).
- Haru: `codex/rag-p8-0-master-inventory`.
- Worktree: `C:\Users\rauds\Desktop\SotsiaalAI-rag-p8-0-master-inventory`.
- Põhitööpuu määrdunud seis ei blokeerinud eraldi worktree'd. P8.0 teostus ei muutnud ega stage'inud põhitööpuu faile.
- `master_sources_final.json` SHA-256 jäi enne ja pärast inventuuri samaks: `3ef352d684474218a58806f799d8a0f2f8addd088d2dbe9e88973fd59eabc0d6`.

## Alusdokumentide kopeerimise kontroll

Kaks põhitööpuus jälgimata olnud alusdokumenti kopeeriti uude worktree'sse bait-baidilt muutmata kujul. SHA-256 oli lähtefailil ja koopial identne:

- `fable-5-rag-materjalide-elutsukkel-ja-automaatne-allikavarskus.md`: `9aa433806479c8502b0d3ffd8f5e1871b8d63ca0054d9b5198d66bca37b33427`.
- `fable-5-rag-p8-url-korje-tehniline-tooplaan.md`: `1db931272b9670c6c888f4b2e06bfea89894e9fc55d55e77ea98d67c126b8a65`.

Need dokumendid kuuluvad P8.0 haru commit'i, et teostus- ja auditijälg ei sõltuks põhitööpuu jälgimata failidest.

## URL-i kaks lepingut

### Registri identiteet: `registry_identity_v1`

Kõigi 323 registrikirje andmetest tõendatud legacy-reegel on:

1. ümbritseva tühiruumi eemaldamine;
2. kogu URL-stringi `decodeURIComponent`;
3. lõpuslaši eemaldamine ainult siis, kui dekodeeritud URL-i path ei ole juur `/`.

See reegel reprodutseerib kõik 323 olemasolevat `normalized_url` väärtust bait-baidilt. Registri identiteedile ei lisatud `www` eemaldamist, path'i väiketähestamist, query sortimist, fragmentide eemaldamist ega pordireegleid. Tööplaani üldised võrgu-URL-i soovitused ei kirjelda registri legacy-identiteeti; vastuolu parandati teostuslepingus ja dokumenteeriti, registrit muutmata.

### Võrgu-URL: `network_url_v1`

Standardne võrgu-URL-i leping annab eraldi:

- `canonical_url` / `fetch_url`: WHATWG serialiseering, skeemi ja hosti väiketähestamine, default-pordi ja fragmendi eemaldamine, percent-encoding'u korrastus, tracking-query eemaldamine ning query deterministlik sortimine;
- `comparison_key`: tehniline võrdlusvõti, kus lisaks käsitletakse `www` ja mittejuur-path'i lõpuslaši aliasena.

Fetch-URL säilitab path'i tõstutundlikkuse, `www` hosti, mitte-default-pordi, path'i topeltslash'id ning lõpuslaši. Registri identiteedi ja võrguvõtme lahknevus on anomaalia, mitte registri automaatparandus.

## P8.0 teostus

- `scripts/lib/url-canonical.mjs`: kaks nimega URL-lepingut, struktureeritud vead ja anomaaliad.
- `scripts/lib/master-sources-inventory.mjs`: RAG-dump/live `GET /documents` normaliseerimine, konservatiivne vastete klassifitseerimine, saladus- ja tekstivaba tõendus, raportid ning fail-closed atomaarne snapshotikirjutus.
- `scripts/inventory-master-sources.mjs`: CLI, inim- ja JSON-väljund ning eristatavad väljumiskoodid.
- `Andmebaasi/Admebaasi-materjali-lisa/master_sources.state.schema.json`: P8.0 snapshoti skeem; see ei ole kanooniline register ega scheduler'i runtime-leping.
- `tests/fixtures/rag-master-inventory-dump.json`: deterministlik kaheksa dokumendiga sisendfixture.
- `tests/scripts/urlCanonical.test.js` ja `tests/scripts/inventoryMasterSources.test.js`: 323-kirje regressioon, URL-tabelid, konservatiivsed seisundid, ainult-GET live-leping, saladuste/teksti välistamine, korruptsiooni ja registry-hash'i fail-closed kontroll ning atomaarse kirjutuse veasimulatsioon.
- `.gitignore`: täpne reegel ainult genereeritavale `master_sources.state.json` failile; `logs/` oli juba ignoreeritud.

Kirjutaja valideerib nii uue kui olemasoleva snapshoti täieliku v1 lepingu. Katkist JSON-i, vale registriräsi, tundmatuid välju/seisundeid või sisemiselt vastuolulisi loendureid ei kirjutata vaikides üle. Uus fail kirjutatakse eksklusiivsesse ajutisse faili, sünkroniseeritakse ja nimetatakse sihtfailiks ümber; veal eemaldatakse ainult selle protsessi ajutine fail.

## Päris read-only inventuur

Inventuur tehti 2026-07-15 produktsiooni RAG-registri vastu autentitud, lehekülgede kaupa ainult `GET /documents` päringutega. Allikaveebe ei fetch'itud. Sisendis oli 5824 RAG-dokumenti; dump seoti praeguse registriga `registry_sha256` kaudu.

| Mõõdik | Arv |
|---|---:|
| Master-registri kirjeid | 323 |
| RAG-dokumente | 5824 |
| URL-i järgi vasteid | 167 |
| Tõendatud source-identiteedi seoseid | 167 |
| `needs_adoption` | 160 |
| `incomplete` | 7 |
| `missing` | 156 |
| `covered_ok` | 0 |

P8.0 ei kasutanud sisutervikluse tõendamiseks veebifetch'i, mistõttu `covered_ok = 0` on teadlik konservatiivne tulemus. URL-vaste ei tähenda automaatselt, et dokument on täielik, ajakohane või õige pipeline'i metaandmetega.

Olulisemad koondanomaaliad:

- registri identiteedi ja võrguvõtme erinevus: 186;
- `www` võrdlusalias: 147;
- RAG-vastel puuduv master-identiteedi omistus: 160;
- legacy-identiteet ei ole võrgu serialiseering: 71;
- legacy lõpuslaši eemaldus: 19;
- võrguvõtme lõpuslaši alias: 19;
- legacy reserveeritud percent-encoding'u dekodeerimine: 11;
- mitu RAG-vastet: 5.

Päris snapshoti ja raportite turvakontroll leidis 0 keelatud `text`, `content`, `body`, võtme-, salasõna-, tokeni- või secret-välja. Produktsiooni toordumpi, snapshoti ega raporteid commit'i ei lisata; progressidokki jäävad ainult koondarvud.

## Kontrollid

- P8.0 sihttestid: 15/15 läbitud.
- Kogu repo testikomplekt: 1237/1237 läbitud.
- P8.0 failide ESLint: 0 viga ja 0 hoiatust.
- Kogu repo ESLint: 0 viga; 358 olemasolevat hoiatust väljaspool P8.0 puutepinda.
- `knowledge:validate -- --root "Andmebaasi\lisatest"`: 5 lähtefaili, 5 metadatafaili, 5 ingest-ready, 0 viga.
- `organization:audit-metadata -- --slug astangu`: `ok=true`, metadata validne, ingest-ready.
- Master-PDF kuivplaani väljund lähtepuus ja P8.0 harus: bait-baidilt identne, SHA-256 `5fdec9b44dd7c8f0c6a90b4d97d470dcd3ad32191d14d2813031fd07fd2d8494`.
- Deterministliku fixture'i seisundijaotus: `covered_by_other_pipeline=1`, `needs_content_check=1`, `needs_adoption=1`, `incomplete=1`, `stale_match=1`, `redirected=1`, `duplicate_content=1`, `missing=316`, `covered_ok=0`.
- Produktsiooni inventuuris tehtud RAG-toimingud: ainult `GET /documents`; ingest/patch/delete kutsed 0.
- Prisma skeemi, migratsioonide, RAG-service'i ja rakenduse runtime-koodi muudatusi: 0.

## Hilisemaks jäetud otsused

- P8.5 scheduler'i püsiseisu kandja, lukustus ja runtime-tõeallikas otsustatakse eraldi; P8.0 ei lukusta neid repo JSON-failiks.
- Sisuline fetch, ekstraktsioon, dedupe, ingest, supersessioon, cleanup ja scheduler ei kuulu P8.0-sse.
- `needs_adoption`, `incomplete` ja `missing` on järgmiste pakettide tööjärjekord, mitte P8.0 automaatse paranduse käsk.
