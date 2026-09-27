# Korpuse täiendamine ja indeksi uuendamine (runbook)

Koostatud 27.09.2026 v26 põhjal: korpusesse lisati Sotsiaalhoolekande seadus ja Haldusmenetluse seadus. Sama käik sobib iga lisatud või asendatud allika jaoks, näiteks:

- seaduse järgmine terviktekst (Sotsiaalhoolekande seaduse praegune tekst kehtib 30.11.2026-ni);
- ajakirja uus number;
- parandatud KOV kirjed.

Näidetes on v26 väärtused. Mõisted:

- **hoidla**: kohalik korpuse store, muutumatud versioonid ja aktiivne pea;
- **ost**: embeddingute ost;
- **indeks**: otsingupõlvkond Postgres'is ja Qdrant'is;
- **plaan**: vestluse kinnitatud pilootplaan.

## Enne alustamist

- Vektorid ostetakse ainult serveris, serveri võtmega. Sülearvutisse võtit ei panda.
- Omaniku kulupiir kehtib kogu tööle. Iga ostu kinnitus tsiteerib omaniku sõnumit.
- **Suuri andmeid ei hoita serveris rakenduse kaustas** (`/home/ubuntu/apps/sotsiaalai/`, ka mitte selle `tmp/` all).
  - Next.js (Turbopack) loeb buildi ajal ka `tmp/` kausta, kuigi see on `outputFileTracingExcludes` all.
  - 27.09.2026 oli seal hoidla koopia (48 000 faili) ja hindamiskaustad, mis linkisid kõik rakenduse ülataseme kaustad peale `lib`, `tmp` ja `.git` (sh `node_modules` ja `Andmebaasi`). PR #196 build aegus seetõttu kaks korda 900 s järel (`DEPLOY_BUILD_TIMEOUT_SECONDS`). Server oli mälu otsas, SSH ei vastanud ja deploy keeras ennast tagasi.
  - Pärast kaustade tõstmist õnnestus sama deploy (GitHub Actions: 08:06–08:08 UTC).
- **Serveri töökaust** on `/home/ubuntu/rag-v2-work/rag-v2-v25`. Seal on hoidla koopia, ostetud vektorid, plaanid, kinnitused ja käivitusskriptid.
  - `/home/ubuntu/rag-v2-work/node_modules` on sümlink rakenduse `node_modules`-ile, sest rakenduse kaustast väljas Node seda muidu ei leia.
  - Enne uut käiku kopeeri töökausta rakenduse praegune kood: `cp -r /home/ubuntu/apps/sotsiaalai/{lib,scripts,package.json} /home/ubuntu/rag-v2-work/rag-v2-v25/`.
- **Ketas:** uus indeksipõlvkond võtab umbes 0,6 GB Postgres'is ja 0,45 GB Qdrant'is, seega iga alles jäetud põlvkond umbes 1 GB. Hoidla koopia on 4,8 GB. Kontrolli enne `df -h /`. 27.09 suurendati ketas 58 GB-ni.
- Abiskriptid (`run-v26.sh`, `make-approval-v26.mjs`, `law-check.mjs`, `assist-eval-v26.mjs` jt) on gitist väljas: `tmp/rag-v2-dev-2026-09-27/` ja serveri töökaustas. Nende v26 teed ja nimed tuleb uue käigu jaoks muuta.
  - `run-v26.sh` kasutas veel vana kausta `$A/tmp/rag-v2-v25`. Serveris on see muudetud, aga sülearvuti koopias mitte.

## 1. Allikas

Riigi Teataja õigusakti puhul:

- Leia redaktsioonid API-st, näiteks `https://www.riigiteataja.ee/api/oigusakt_otsing/1/otsi?pealkiri=Sotsiaalhoolekande%20seadus&limiit=300`.
  - Kuupäevafilter selles API-s ei tööta. Filtreeri tulemust ise: `pealkiri`, `tekst: "terviktekst"`, `kehtivus.algus` ja `kehtivus.lopp`.
- Võta üks redaktsioon korraga: praegu kehtiv või kohe jõustuv. Kaks sama seaduse redaktsiooni teeksid otsingus peaaegu kattuvad lõigud ja võtaksid valikus kohti.
  - v26-s võeti 01.10–30.11.2026 kehtiv tekst `130062026065`. 30.09-ni kehtinud tekstist erines see ainult eriolukorra sätete ja ühe juhtumiplaani lõike poolest.
- Laadi XML alla: `https://www.riigiteataja.ee/et/akt/<id>.xml`. Aadress ilma `/et/` osata annab HTML-lehe.
- **Asendamine:** iga Riigi Teataja redaktsioon on eraldi dokument (`riigiteataja:<globaalID>`), mitte sama dokumendi uus versioon. Uut redaktsiooni lisades eemalda vana dokument indeksi poliitikast (4. samm).

## 2. Register

- Pane fail kausta `Andmebaasi/<kategooria>/`, näiteks `Andmebaasi/oigusaktid/130062026065.xml`.
- Lisa `Andmebaasi/REGISTER.json` kirje: `path`, `category`, `role: "source"`, `sha256` (faili räsi), `original_path` ja `review_status`.
  - `original_path` on tavaliselt `original_path_base` suhtes. Allalaaditud faili puhul kirjutati v26-s teadlikult allika aadress (`riigiteataja.ee/et/akt/<id>.xml`).
- Suurenda `counts.<kategooria>.files` ja `.sources`.
- `Andmebaasi/REGISTER.md` failis uuenda kokkuvõtte tabeli kategooria arv (v26: oigusaktid 104 → 106) ja lisa failirida.
- `Andmebaasi/` on gitis: muudatus läheb PR-iga. See ei muuda rakenduse implementatsiooniräsi ega aegu vestlusplaani.

## 3. Sisestus kohalikku hoidlasse (sülearvutis)

Sisestuse järjekord vajab kohalikku PostgreSQL-i: `node scripts/rag-v2-local.mjs up`, ühendus on failis `tmp/rag-v2-services/connections.json`. Ilma selleta annavad `run`, `review` ja `publish` ainult vea `batch_cli_failed`.

Tee enne hoidla aktiivse pea varukoopia:

```bash
T=tmp/rag-v2-corpus-store-v25/tenant_<räsi>
cp $T/active.json <varukaust>/
cp -r $T/publications <varukaust>/
```

Seejärel sisestusrühm:

```bash
D=tmp/rag-v2-corpus-batches-v26/oigusaktid; mkdir -p $D
echo '[{"source":"oigusaktid/<id>.xml"}]' > $D/selection.json
node scripts/rag-v2-ingest-batch.mjs --mode plan --development-only --registry Andmebaasi/REGISTER.json --selection $D/selection.json --tenant sotsiaalai-corpus --manifest $D/plan.json
node scripts/rag-v2-ingest-batch.mjs --mode run --development-only --manifest $D/plan.json --input-root Andmebaasi --store tmp/rag-v2-corpus-store-v25
node scripts/rag-v2-ingest-batch.mjs --mode review --development-only --manifest $D/plan.json --store tmp/rag-v2-corpus-store-v25 --review $D/review-draft.json
```

- KOV paketi kirje (JSON `items`) vajab valikus ka `item` võtit: `{"source":"KOV/<kaust>/<fail>.json","item":"<id>"}`.
- `--max-items` piirab ühe käivituse kirjeid (vaikimisi 100). Suurema rühma puhul korda `run` käsku, kuni `--mode status` näitab kõik kirjed ette valmistatuks.

Ülevaatus:

1. Vaata töötluse tulemust: lõikude arv, hoiatused ja kirje aruanne `report_path` (`versions/<version>/report.html`).
2. Täida ülevaade:
   - igale kirjele `decision`, mis on `include` või `exclude`;
   - `note` on kohustuslik välja jätmisel ja hoiatustega kirjel;
   - ülevaatusele `reviewed_by`.

   Muid välju muuta ei tohi (`batch_review_changed`). Kirjuta tulemus uude faili `review.json`.
3. Avalda:

```bash
node scripts/rag-v2-ingest-batch.mjs --mode publish --development-only --manifest $D/plan.json --store tmp/rag-v2-corpus-store-v25 --review $D/review.json
```

Avaldamine teeb hoidlasse uue allikapõlvkonna. v26-s oli see `generation_d54d29…` ja rühmas 408 lõiku. Uute dokumentide ID-d on `review.json` kirjete väljal `document_id`.

### Töötluse muutus, mis puudutab ainult üht vormingut

Näide v27 ([ADR-034](adr-034-riigi-teataja-xml-cleanup.md)): Riigi Teataja XML-i adapteri muutus, silt `source-structure-v25` → `v26`.

- Uued versioonid on vaja ainult dokumentidele, mille väljund muutub. Otsing ja indeks töötlussilte ei kontrolli; iga versioon kannab oma silte.
- Vali ainult need allikad. v27-s tuli valik v25 partii `oigusaktid/plan.json` kirjete `metadata_json.source_path` väljast pluss v26 `selection.json`: 61 akti.
- Dokumendi ID ei muutu, seega eelmine indeksi poliitika sobib. Kontrolli, et iga poliitika dokument on hoidla uues peas.
- Serverisse saada ainult uued `versions/<id>/` kaustad, `active.json` ja `publications/` (v27: 197 MB). Tee enne serveri pea varukoopia.
- Serveri koodi kopeerimine töökausta käib pärast deploy'd: deploy'i `npm ci` vahetab `node_modules`-i, millele töökausta sümlink viitab, ja poole peal käivitatud Node'i protsess ei leia pakette.

## 4. Indeksi poliitika

- Uus poliitika on eelmine poliitika pluss uute dokumentide ID-d, sorteeritult. Näiteks `tmp/rag-v2-corpus-index-v26/policy.json` sai 5998 dokumenti.
- Asendatud allika vana ID eemalda ja kirjuta põhjusega `policy-exclusions.json`-i.
- Kontrolli, et iga poliitika dokument on hoidla aktiivses peas. Välja jäetud dokumendid jäävad välja.

## 5. Hoidla serverisse

Kui serveris hoidlat pole, kopeeri see tervikuna. 4,8 GB võttis 27.09 umbes 21 minutit:

```bash
tar cf - tmp/rag-v2-corpus-store-v25 tmp/rag-v2-corpus-index-v26 | gzip -1 | ssh sotsiaalai 'cd /home/ubuntu/rag-v2-work/rag-v2-v25 && tar xzf -'
```

- Kui hoidla on serveris juba olemas, piisab muutunud osast, sest versioonid on muutumatud: `active.json`, `publications/` ja uued `versions/<id>/` kaustad.
- Ära muuda serveri hoidlat indeksi töö ajal. Töö kontrollib enne aktiveerimist hoidla aktiivset pead (`index_source_generation_changed`).

## 6. Tasuta vektoriplaan

Hinnafail kehtib 24 tundi alates `checked_at` ajast. Vana hinnaga peatub juba plaan (`price_verification_stale`). Kontrolli hind üle aadressil `https://developers.openai.com/api/docs/models/text-embedding-3-large` ja kirjuta uus fail samas vormis:

```json
{ "input_per_million": "0.13", "currency": "USD", "version": "openai-text-embedding-3-large-standard-<kuupäev>",
  "source": "https://developers.openai.com/api/docs/models/text-embedding-3-large", "checked_at": "<ISO aeg>" }
```

Plaan jookseb serveri töökaustas:

```bash
cd /home/ubuntu/rag-v2-work/rag-v2-v25
node scripts/rag-v2-corpus-embeddings.mjs --mode plan --development-only --store tmp/rag-v2-corpus-store-v25 --tenant sotsiaalai-corpus --subject operator \
  --policy tmp/rag-v2-corpus-index-v26/policy.json --price tmp/rag-v2-corpus-embeddings/prices/<hinnafail>.json \
  --reuse "$(ls -d tmp/rag-v2-corpus-embeddings/usage/pilot_706b7844*)" --reuse "$(ls -d tmp/rag-v2-corpus-embeddings/usage/pilot_3053*)" \
  --output tmp/rag-v2-corpus-embeddings/plan-<uus>
```

- `--reuse` peab loetlema **kõik** varem ostetud usage-kaustad, iga ühe oma võtmega (v26 järel v25b `pilot_706b…` ja v26 `pilot_3053…`). Puuduva kausta sisendid läheksid uuesti ostu.
- v26 plaanis oli 29 553 sisendit, neist 29 145 taaskasutatud ja 408 uut: 184 658 tokenit, 0,024 USD, manifest `a444c77e…`.
- `--output` kaust ei tohi olemas olla: nii plaan kui ka ost loovad selle ja kirjutavad failid `wx`-lipuga.

## 7. Kinnitus ja ost

1. Kinnitus: `tmp/rag-v2-dev-2026-09-27/make-approval-v26.mjs` eeskujul. Selle `plan-v26` ja `approval-v26` teed on sisse kirjutatud ja tuleb muuta.
   - Skript kontrollib, et manifest on sama, hind on värske ja piir (kujul `0.10`) on vähemalt kulu.
   - Olemasolevat faili ta üle ei kirjuta.
2. Ost: võti tuleb juurkasutaja env-failist toru kaudu ega satu kettale ega käsureale. Kasuta samu `--reuse` kaustu nagu plaanis:

```bash
sudo -n grep "^OPENAI_API_KEY=" /etc/sotsiaalai/frontend.env | node --env-file=/dev/stdin scripts/rag-v2-corpus-embeddings.mjs --mode execute --development-only \
  --store tmp/rag-v2-corpus-store-v25 --tenant sotsiaalai-corpus --subject operator --policy tmp/rag-v2-corpus-index-v26/policy.json \
  --reuse "$(ls -d tmp/rag-v2-corpus-embeddings/usage/pilot_706b7844*)" --reuse "$(ls -d tmp/rag-v2-corpus-embeddings/usage/pilot_3053*)" \
  --baseline tmp/rag-v2-corpus-embeddings/plan-<uus>/embedding-plan.json --approval <kinnitus>.json \
  --price tmp/rag-v2-corpus-embeddings/prices/<hinnafail>.json --output tmp/rag-v2-corpus-embeddings/run-<uus>
```

- **Lõks:** ilma `--reuse`-ta ei ühti uuesti arvutatud plaan kinnitatuga (`approved_unchanged_baseline_required`). Siis ei osteta midagi, aga `--output` kaust on juba loodud ja järgmine katse vajab uut nime.
- Kontrolli `<output>/run.json`: seal peab olema `"state": "complete"` ja `usage.succeeded` peab võrduma plaani uute sisendite arvuga. Uue usage-kausta tee on väljal `vectors`. v26-s oli see `pilot_3053…`.

## 8. Indeksi ehitus

```bash
env -u OPENAI_API_KEY RAG_V2_ESTNLTK_PYTHON=/opt/sotsiaalai/rag-v2-estnltk-1.7.5/bin/python node scripts/rag-v2-index-batch.mjs --mode plan --development-only \
  --tenant sotsiaalai-corpus --subject operator --policy tmp/rag-v2-corpus-index-v26/policy.json --store tmp/rag-v2-corpus-store-v25 \
  --manifest tmp/rag-v2-corpus-index-v26/index-plan.json --vectors <iga usage-kaust eraldi --vectors võtmega>
```

Sama käsk `--mode run` lisavõtmetega `--connections /home/ubuntu/apps/sotsiaalai/tmp/rag-v2-services/connections.json --batch-size 100 --max-batches 10000`.

- **`--vectors` peab olema antud.** Ilma selleta kasutab töö testvektoreid.
- Võtit ei anta: vektorid tulevad kontrollitud pearaamatust ja väliskutseid on 0.
- v26-s kestis import 5998 dokumendiga umbes 33 minutit. Aktiveerimisele eelnev täiskontroll analüüsib morfoloogia uuesti ja võttis umbes 10 minutit.
- **Aktiveerimine** toimub ainult siis, kui kõik dokumendid on töödeldud ja kontrollitud. Väljundis peab olema `"state": "ready"`.
  - Pooleli jäänud töö jätkub sama `run` käsuga ([ADR-012](adr-012-resumable-indexing.md)). `--max-batches` ülempiir on 10 000.
  - Seisu näitab `--mode status` samade võtmetega. v26-s oli tulemus `search_generation_10b4ff…`: 29 591 lõiku, neist 29 183 vahemälust.

## 9. Aktiveerimine ja vestlusplaan

Indeksi töö aktiveerib uue põlvkonna ise. **Vestlusplaan on seotud põlvkonna ID-ga**, seega vestlus ei vasta enne, kui plaan on uuesti ehitatud. v26 käivitusskript tegi ostu, indeksi ja plaani järjest. Uus plaan ehitatakse rakenduse kaustas:

```bash
cd /home/ubuntu/apps/sotsiaalai
sudo -n node --env-file=/etc/sotsiaalai/frontend.env --env-file=/etc/sotsiaalai/rag.env --import ./scripts/register-node-source-loader.mjs \
  scripts/rag-v2-chat-plan.mjs --tenant sotsiaalai-corpus --profile hybrid-estnltk-chat-v1 --reasoning medium \
  --template /etc/sotsiaalai/m4-luna6-20260923.json --out /etc/sotsiaalai/<uus unikaalne nimi>.json --budget-usd 4 --basis "<alus>" --activate
sudo -n chown root:ubuntu /etc/sotsiaalai/<uus unikaalne nimi>.json
sudo -n systemctl restart sotsiaalai-frontend
```

Plaan aegub ka iga deployga, mis muudab implementatsiooni manifesti faile (`implementationManifest()`, `lib/rag-v2/pilot/provenance.js`). Nende hulgas on:

- `lib/rag-v2/**`, `lib/auth/**`, `app/api/chat/pilot/**`, `app/rag-pilot/**`;
- `lib/chat/m4Pilot*.js`, `app/api/chat/route.js`, `app/vestlus/page.js`, `app/chat-source/page.jsx`;
- vestluse põhikomponendid ja `messages/*.json`;
- `package.json`, `package-lock.json`, `prisma/schema.prisma`, `auth.js` ja mõni muu fail.

Värskust saab kontrollida rakenduse kaustas, sest skript võrdleb plaani jooksva kausta koodiga:

```bash
sudo -n cat <plaan> | node scripts/rag-v2-plan-freshness.mjs
```

Vastus on `current`, `stale` või `invalid`. Deploy teeb sama kontrolli ja kirjutab tulemuse logisse. Vestluse ajalugu on plaani järgi filtreeritud: pärast uut plaani vanemaid pöördumisi enam ei näidata, aga neid ei kustutata.

## 10. Kontroll ja koristus

- Kontrolli, et `rag_v2_head` näitab uut põlvkonda ja `systemctl is-active sotsiaalai-frontend` vastab `active`.
- Tee üks vestluse pöördumine, mis vajab uut allikat.
  - Esimesed minutid pärast taaskäivitust on aeglased. Esimene vestluspöördumine käivitab taustal kõigi teadmusallikate mälusoojenduse (v26: 1124; omavalitsuse kirjeid ei soojendata).
- Otsingu mõju saab mõõta skriptidega `law-check.mjs` ja `assist-eval-v26.mjs` (serveris `/home/ubuntu/rag-v2-work/eval-*`).
  - Mõõtmine on tasuline: Luna plaan, valik ja päringute vektorid, umbes 0,1 USD 52 küsimuse jooksu kohta. See kuulub omaniku kulupiiri alla.
- Vana põlvkonda ja hoidla koopiat ei kustutata ilma omaniku otsuseta. Varukoopiaid veel ei tehta.

## Seotud

- [ADR-012](adr-012-resumable-indexing.md): jätkatav indekseerimine.
- [ADR-030](adr-030-chat-retrieval-at-corpus-scale.md): vestlus kogu korpusel.
- [ADR-031](adr-031-source-level-and-answer-completeness.md): allika tase ja vastuse täielikkus.
- Vastuvõtutest: [`docs/audits/rag-v2-chat-acceptance-2026-09-27.md`](../audits/rag-v2-chat-acceptance-2026-09-27.md).
