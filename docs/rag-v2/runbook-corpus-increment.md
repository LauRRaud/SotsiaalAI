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
- **Töötav kood on väljalaske kaustas, mitte kaustas `/home/ubuntu/apps/sotsiaalai`** (alates 04.10.2026, [avaldamise audit](../audits/release-build-once-2026-10-04.md)).
  - Teenus `sotsiaalai-frontend` töötab kaustast `/home/ubuntu/apps/sotsiaalai-releases/<commit>` ja loeb ainult selle väljalaske env-faili `/etc/sotsiaalai/releases/<commit>.env` (root). Deploy teeb selle faili paigaldamise hetkel `frontend.env`-ist ja `rag.env`-ist. Hilisem `rag.env`-i muudatus jõuab teenuseni alles järgmise väljalaskega.
  - Töötava väljalaske ütleb teenus ise; sama seis on failis `/home/ubuntu/apps/sotsiaalai-releases/active.json`:

    ```bash
    R=$(systemctl show -p WorkingDirectory --value sotsiaalai-frontend); ENVF=/etc/sotsiaalai/releases/${R##*/}.env
    ```

  - Serveri käsud, mis vajavad rakenduse koodi (plaan, plaani värskus, hindaja), käivad kaustas `$R` env-failiga `$ENVF`. Selle dokumendi näidetes tähendavad `$R` ja `$ENVF` neid kahte.
  - Vana kaust `/home/ubuntu/apps/sotsiaalai` jäi commit'ile `209337bc` ja hoiab jagatud andmeid (`tmp/`, `logs/`, `Andmebaasi/`, `Arhiiv/`); iga väljalase lingib neile. Selle `scripts/` koopiaid ära käivita: plaan tehtaks koodile, mis ei tööta.
  - Väljalaskes ei ole `tests/` ega `docs/rag-v2/` kausta. Vestluse hindajale antakse kataloog ja õigusaktide manifest teega (`--scenarios`, `--legal`).
  - Alles on töötav ja eelmine väljalase. Vanemad kaustad ja nende env-failid kustutab järgmine deploy.
- **Suuri andmeid ei hoita serveris rakenduse kaustas** (`/home/ubuntu/apps/sotsiaalai/`, ka mitte selle `tmp/` all).
  - Next.js (Turbopack) loeb buildi ajal ka `tmp/` kausta, kuigi see on `outputFileTracingExcludes` all.
  - 27.09.2026 oli seal hoidla koopia (48 000 faili) ja hindamiskaustad, mis linkisid kõik rakenduse ülataseme kaustad peale `lib`, `tmp` ja `.git` (sh `node_modules` ja `Andmebaasi`). PR #196 build aegus seetõttu kaks korda 900 s järel (`DEPLOY_BUILD_TIMEOUT_SECONDS`). Server oli mälu otsas, SSH ei vastanud ja deploy keeras ennast tagasi.
  - Pärast kaustade tõstmist õnnestus sama deploy (GitHub Actions: 08:06–08:08 UTC).
- **Serveri töökaust** on `/home/ubuntu/rag-v2-work/rag-v2-v25`. Seal on hoidla koopia, ostetud vektorid, plaanid, kinnitused ja käivitusskriptid.
  - Töökausta `node_modules` on sümlink töötava väljalaske `node_modules`-ile, sest rakenduse kaustast väljas Node pakette muidu ei leia. `rag-v2-corpus-run.sh` seab lingi iga käigu alguses uuesti.
  - `/home/ubuntu/rag-v2-work/node_modules` viitab endiselt vana kausta pakettidele (seis `209337bc`). Seda kasutavad muud tööriistad selles kaustas; `eval-app`-il on oma link samasse kohta.
  - Enne uut käiku kopeeri töökausta töötava väljalaske kood: `cp -r $R/{lib,scripts,package.json} /home/ubuntu/rag-v2-work/rag-v2-v25/`. `rag-v2-corpus-run.sh` teeb seda ise.
- **Ketas:** vana salvestusviisiga (`generation`) võttis iga indeksipõlvkond umbes 0,6 GB Postgres'is ja 0,45 GB Qdrant'is, kokku ~1 GB. Uue viisiga (`versions-v1`, [ADR-036](adr-036-version-index.md)) lisab uus põlvkond ainult uute versioonide read ja punktid ning nimekirja. Hoidla koopia on 4,8 GB. Kontrolli enne `df -h /`. 27.09 suurendati ketas 58 GB-ni.
  - Vanad generatsioonid: `eval-app/drop-version-generations.mjs <rentnik> <prefiks>… --execute` eemaldab loendi. Seejärel `node scripts/rag-v2-prune-versions.mjs --tenant <rentnik> --connections /home/ubuntu/apps/sotsiaalai/tmp/rag-v2-services/connections.json [--execute]` eemaldab versioonide read, pitserid ja punktid, mida ükski generatsioon enam ei loetle ([ADR-060](adr-060-prune-unreferenced-versions.md)). Käivita ainult siis, kui indeksitööd ei käi. Kui koristus katkeb, ei alga ükski indeksitöö (`index_prune_unresolved`), kuni sama käsk `--execute`-iga on töö lõpetanud; enne veendu, et katkenud protsess on lõppenud. Loendus näitab seisu väljal `unresolved`.
- Abiskriptid (`run-v26.sh`, `make-approval-v26.mjs`, `law-check.mjs`, `assist-eval-v26.mjs` jt) on gitist väljas: `tmp/rag-v2-dev-2026-09-27/` ja serveri töökaustas. Nende v26 teed ja nimed tuleb uue käigu jaoks muuta.
  - `run-v26.sh` kasutas veel vana kausta `$A/tmp/rag-v2-v25`. Serveris on see muudetud, aga sülearvuti koopias mitte.

## 0. Kiire rada Riigi Teataja muudatustele ([ADR-059](adr-059-corpus-refresh-path.md))

```bash
node scripts/rag-v2-law-validity.mjs check --manifest docs/rag-v2/legal-acts-in-index.json --out W/check --download W/dl
node scripts/rag-v2-municipal-acts.mjs scan --manifest docs/rag-v2/legal-acts-in-index.json --out W/scan --download W/dl
node scripts/rag-v2-corpus-refresh.mjs register --from W/dl --out W
# plan (--selection W/selection.json), run ja review nagu jaotises 3
node scripts/rag-v2-corpus-refresh.mjs review --draft W/review-draft.json --out W/review.json --reviewer "<kes, kelle korraldusel>"
# publish nagu jaotises 3
node scripts/rag-v2-corpus-refresh.mjs package --store tmp/rag-v2-corpus-store-v25 --policy <eelmine policy.json> --review W/review.json --out W/ship --remove W/scan/municipal-acts-<päev>.json
```

- Serverisse lähevad `W/ship/ship.tgz`, `ship.json` ja `policy.json` nimedega `ship-v<N>.tgz`, `ship-v<N>.json` ja `policy-v<N>.json` töökausta. Seejärel: `sh $R/scripts/rag-v2-corpus-run.sh <N> <eelmine N> /etc/sotsiaalai/m4-corpus-chat-<kuupäev><täht>.json <piir> "<alus et>" "<alus en>"` (`$R` on töötav väljalase, vt „Enne alustamist“).
- Skript leiab töötava väljalaske ise ja võtab sealt koodi ning paketid. Plaani samm hoiab deploy lukku, teeb plaani väljalaske kaustas selle env-failiga, aktiveerib plaani `rag.env`-is ja väljalaske env-failis, kontrollib seda, taaskäivitab teenuse ja trükib, millise plaaniga teenus töötab (`running plan: <fail>`). Põhjused on jaotises 9.
- Rada peatub, kui mõni kirje vajab inimese otsust või kui kaart tuleb uuesti siduda. Siis käib edasi jaotiste 1–7 järgi.
- Katkenud `register` lõpetatakse sama käsuga ja sama `--out W`-ga (ADR-059, R2 30.09). Uus W katkenud töö registrist keeldub (`refresh_register_inconsistent`). Lõpetatud W kordus trükib sama kokkuvõtte ega kirjuta midagi.

## 1. Allikas

Riigi Teataja õigusakti puhul:

- Leia redaktsioonid API-st, näiteks `https://www.riigiteataja.ee/api/oigusakt_otsing/1/otsi?pealkiri=Sotsiaalhoolekande%20seadus&limiit=300`.
  - Tulemuse järjekord muutub iga päringuga. Mitmel lehel tulemusi korduvad ja osa jääb puudu. Kitsenda päringut väljaandjaga (`valjaandja=`) või kasuta kehtivuse kontrolli ([ADR-038](adr-038-law-validity-check.md)): see küsib lehti uuesti, kuni `kokku` täitub.
  - Kuupäevafilter selles API-s ei tööta. Filtreeri tulemust ise: `pealkiri`, `tekst: "terviktekst"`, `kehtivus.algus` ja `kehtivus.lopp`.
- Võta üks redaktsioon korraga: praegu kehtiv või kohe jõustuv. Kaks sama seaduse redaktsiooni teeksid otsingus peaaegu kattuvad lõigud ja võtaksid valikus kohti.
  - v26-s võeti 01.10–30.11.2026 kehtiv tekst `130062026065`. 30.09-ni kehtinud tekstist erines see ainult eriolukorra sätete ja ühe juhtumiplaani lõike poolest.
- Laadi XML alla: `https://www.riigiteataja.ee/et/akt/<id>.xml`. Aadress ilma `/et/` osata annab HTML-lehe.
- **Asendamine:** iga Riigi Teataja redaktsioon on eraldi dokument (`riigiteataja:<globaalID>`), mitte sama dokumendi uus versioon. Uut redaktsiooni lisades eemalda vana dokument indeksi poliitikast (4. samm).

## 2. Register

- Pane fail kausta `Andmebaasi/<kategooria>/`, näiteks `Andmebaasi/oigusaktid/130062026065.xml`.
- Lisa `Andmebaasi/REGISTER.json` kirje: `path`, `category`, `role: "source"`, `sha256` (faili räsi), `original_path` ja `review_status`.
  - `original_path` on tavaliselt `original_path_base` suhtes. Allalaaditud faili puhul kirjutati v26-s teadlikult allika aadress (`riigiteataja.ee/et/akt/<id>.xml`).
- Kui aktist on allikas ainult osa paragrahve (riigieelarve seaduse § 2, [ADR-076](adr-076-act-sections-as-source.md)), lisa registrikirjele `"xml_sections": ["2"]`. Fail jääb Riigi Teataja algfailiks; ilma selle väljata peatub suur akt sisestuses veaga `text_limit`. Sama akti järgmine redaktsioon pärib valiku värskendusrajal ise (sama pealkiri ja väljaandja); uue aasta riigieelarve seadus on uus akt ja vajab välja käsitsi.
- Suurenda `counts.<kategooria>.files` ja `.sources`.
- `Andmebaasi/REGISTER.md` failis uuenda kokkuvõtte tabeli kategooria arv (v26: oigusaktid 104 → 106) ja lisa failirida.
- `Andmebaasi/` on gitis: muudatus läheb PR-iga. See ei muuda rakenduse implementatsiooniräsi ega aegu vestlusplaani.

## 3. Sisestus kohalikku hoidlasse (sülearvutis)

Sisestuse järjekord vajab kohalikku PostgreSQL-i: `node scripts/rag-v2-local.mjs up`, ühendus on failis `tmp/rag-v2-services/connections.json`. Ilma selleta annavad `run`, `review` ja `publish` ainult vea `batch_cli_failed`.

- Kui `docker ps` ei näita Postgres'i juures `127.0.0.1:55432->5432`, on port tõenäoliselt Windowsi Hyper-V reserveeritud vahemikus. See juhtub mõnikord pärast taaskäivitust; kontrolli käsuga `netsh int ipv4 show excludedportrange protocol=tcp`. Omanik vabastab selle administraatori PowerShellis käskudega `net stop winnat` ja `net start winnat`, seejärel käivita uuesti `up`.
- Teist porti kasutada ei saa: kohaliku arenduse kaitse lubab ainult `127.0.0.1:55432` (`local_postgres_required`).

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
- Kui muutus lisab ainult andmeid teksti kõrvale (v47, [ADR-062](adr-062-provision-dates.md), silt `v29` → `v30`), tõenda enne ingest'i, et tekst ei muutu: `node scripts/rag-v2-reader-compare.mjs --store tmp/rag-v2-corpus-store-v25`. Kõik aktid peavad olema identsed (tekst, lõigud, XML-ist loetud väljad ja registri metaandmed), uusi vektorisisendeid 0 ja `registry_xml_differs_from_stored` 0 (muidu lõpeb skript koodiga 1); siis ei osta server ühtegi vektorit. Võrdse skooriga lõikude järjekord võib pärast uut sisestust siiski muutuda: võrdle generatsioone `rag-v2-generation-compare.mjs`-iga, `compared.different` peab olema 0. Järjekorra erinevuseks (`equal_score_order_only`) loeb skript ainult selle, kui kanalid andsid samad lõigud samade skooridega ja tõenduses on samad lõigud teises järjekorras. Sama tõendus teise kontekstisuuruse või ankrutulemusega ja lisandunud või vahetunud lõik on `different`.
- Dokumendi ID ei muutu, seega eelmine indeksi poliitika sobib. Kontrolli, et iga poliitika dokument on hoidla uues peas.
- Serverisse saada ainult uued `versions/<id>/` kaustad, `active.json` ja `publications/` (v27: 197 MB). Tee enne serveri pea varukoopia.
- Serveri koodi kopeerimine töökausta käib pärast deploy'd, sest kood ja paketid tulevad töötavast väljalaskest. Väljalaske kaust püsib, kuni see on töötav või eelmine väljalase: üks deploy käigu ajal linki ei riku, kaks järjestikust kustutavad kausta ja poole peal käivitatud Node'i protsess ei leia pakette.

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

Hinnafail kehtib 24 tundi alates `checked_at` ajast. Vana hinnaga peatub juba plaan (`price_verification_stale`). Sama viga tuleb ka siis, kui `checked_at` on tulevikus: kirjuta aeg serveris käsuga `date -u +%Y-%m-%dT%H:%M:%S.000Z` (04.10.2026 peatus v48 esimene katse selle taga pärast hoidla pea tõstmist; `rag-v2-corpus-run.sh` uuesti käivitamiseks tuli pea ja poliitikafail varukoopiast tagasi panna). Kontrolli hind üle aadressil `https://developers.openai.com/api/docs/models/text-embedding-3-large` ja kirjuta uus fail samas vormis:

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

- **`--indexed`** (koos `--connections /home/ubuntu/apps/sotsiaalai/tmp/rag-v2-services/connections.json`; [ADR-036](adr-036-version-index.md)): dokumendid, mille versioon on indeksis sama seadistusega juba valmis, jäetakse lugemata ja planeerimata. Kasuta sama lippu nii plaanis kui ostus, muidu ost ei vasta kinnitatud plaanile.
- Vektoriarhiive (`--reuse`, `--vectors`) loetakse vajaduse järel: pearaamat kohe, vektorifail siis, kui seda sisendit vaja on.
- `--reuse` peab loetlema **kõik** varem ostetud usage-kaustad, iga ühe oma võtmega (v26 järel v25b `pilot_706b…` ja v26 `pilot_3053…`). Puuduva kausta sisendid läheksid uuesti ostu.
- v26 plaanis oli 29 553 sisendit, neist 29 145 taaskasutatud ja 408 uut: 184 658 tokenit, 0,024 USD, manifest `a444c77e…`.
- `--output` kaust ei tohi olemas olla: nii plaan kui ka ost loovad selle ja kirjutavad failid `wx`-lipuga.

## 7. Kinnitus ja ost

- Kui plaan näitab `external_inputs: 0` (kõik sisendid on vahemälus), jäta kinnitus ja ost vahele. Indeks kasutab olemasolevaid vektoreid ilma uue `--vectors` kaustata (v41, 30.09.2026: 700/700 vahemälust).
- Omavalitsuste uued sotsiaalaktid: `node scripts/rag-v2-municipal-acts.mjs scan --manifest docs/rag-v2/legal-acts-in-index.json --out DIR --download DIR` laeb alla indeksist puuduvad kehtivad aktid ([ADR-058](adr-058-municipal-social-acts.md)). Edasi käib tavaline registreerimine (`original_path: riigiteataja.ee/et/akt/<id>.xml`), ingest ja indeks.
- Kehtetuks tunnistamise märge (RT XML „Kehtetu“, 0 paragrahvi) annab ingest'is `source_text_empty`: võta selle asemel kehtetuks tunnistanud akti grupi kehtiv redaktsioon ([ADR-038](adr-038-law-validity-check.md), v42).
- Omavalitsuse akti uus redaktsioon: kontrolli, kas eelmisel redaktsioonil on lisa ([ADR-053](adr-053-rt-annex-texts.md)). Tuletatud lisa nimetab oma redaktsiooni, seega sama PDF uues redaktsioonis on eraldi allikas: `scripts/rag-v2-rt-annex.mjs --xml <uus XML> …`.

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

- **Salvestusviis** ([ADR-036](adr-036-version-index.md)): vaikimisi `--layout versions-v1`. Selle seadistusega juba indekseeritud versioone ei töödelda uuesti, vaid lisatakse uue põlvkonna nimekirja. Plaani käsk vajab siis ka `--connections` võtit (loeb valmis versioonid) ja näitab `documents_to_index` ning `units_to_index`. Vana viis on `--layout generation`.
- Iga plaan kirjutatakse uude faili (`--manifest`); olemasolevat plaanifaili üle ei kirjutata.
- Täielik hoolduskontroll on `--mode verify` samade võtmetega. See loeb kõik dokumendid läbi, analüüsib morfoloogia uuesti ja võrdleb iga punkti vektoriga. Midagi ei avalda.

- **`--vectors` peab olema antud.** Ilma selleta kasutab töö testvektoreid.
- Võtit ei anta: vektorid tulevad kontrollitud pearaamatust ja väliskutseid on 0.
- Vana viisiga kestis täisehitus v26-s 5998 dokumendiga umbes 33 minutit ja aktiveerimisele eelnev täiskontroll (morfoloogia uuesti) veel umbes 10 minutit; v29 kokku 43,5 minutit. Uue viisiga tehakse täiskontroll iga versiooni valmimisel ilma morfoloogia teise analüüsita ja aktiveerimisel kontrollitakse nimekirja, valmimismärke ja arve.
- **Aktiveerimine** toimub ainult siis, kui kõik dokumendid on töödeldud ja kontrollitud. Väljundis peab olema `"state": "ready"`.
  - Pooleli jäänud töö jätkub sama `run` käsuga ([ADR-012](adr-012-resumable-indexing.md)). `--max-batches` ülempiir on 10 000.
  - Seisu näitab `--mode status` samade võtmetega. v26-s oli tulemus `search_generation_10b4ff…`: 29 591 lõiku, neist 29 183 vahemälust.

## 9. Aktiveerimine ja vestlusplaan

Indeksi töö aktiveerib uue põlvkonna ise. **Vestlusplaan on seotud põlvkonna ID-ga**, seega vestlus ei vasta enne, kui plaan on uuesti ehitatud ja töötav teenus on selle kätte saanud. `rag-v2-corpus-run.sh` teeb ostu, indeksi ja plaani järjest; ainult plaani sammu kordab `RESUME=plan` uue plaanifaili nimega. Käsitsi käib sama töötava väljalaske kaustas, selle env-failiga ja deploy luku all:

```bash
(
  set -e
  exec 9>>/home/ubuntu/apps/sotsiaalai-releases/deploy.lock; flock -w 900 9
  R=$(systemctl show -p WorkingDirectory --value sotsiaalai-frontend); ENVF=/etc/sotsiaalai/releases/${R##*/}.env
  P=/etc/sotsiaalai/<uus unikaalne nimi>.json; cd $R
  N="sudo -n node --env-file=$ENVF --import ./scripts/register-node-source-loader.mjs"
  $N scripts/rag-v2-chat-plan.mjs --tenant sotsiaalai-corpus --profile <profiil> --reasoning medium \
    --template /etc/sotsiaalai/m4-luna6-20260923.json --out $P --budget-usd 4 --basis "<alus>" --activate
  sudo -n chown root:ubuntu $P
  $N scripts/rag-v2-plan-release.mjs activate --plan $P --rag-env $ENVF
  $N scripts/rag-v2-plan-release.mjs ready
  sudo -n systemctl restart sotsiaalai-frontend
)
sudo -n cat /proc/$(systemctl show -p MainPID --value sotsiaalai-frontend)/environ | tr '\0' '\n' | grep '^M4_PILOT_CONFIG='
```

- `<profiil>` on aktiivse plaani `profileId` (04.10.2026: `hybrid-estnltk-chat-v6`).
- **Plaan aktiveeritakse kahes failis.** `--activate` kirjutab plaani `rag.env`-i; sealt saab selle järgmise väljalaske env-fail. Töötav teenus loeb ainult oma väljalaske env-faili, seega teeb `rag-v2-plan-release.mjs activate --rag-env $ENVF` sama aktiveerimise seal. Ilma selleta käivitub teenus vana plaaniga ja lükkab pärast uut indeksit pöörded tagasi (`active_index_mismatch`), kuni järgmine deploy teeb env-faili uuesti.
- `ready` on kontroll, mille deploy teeb enne väljalaske käivitamist: env-failis nimetatud plaan sobib selle koodi ja aktiivse indeksiga. Mudelikutset ei ole.
- Viimane rida loeb taaskäivitatud protsessi keskkonnast, millise plaaniga teenus töötab. See peab olema uus fail.
- **Deploy lukk** (`sotsiaalai-releases/deploy.lock`): deploy loeb `rag.env`-i, kirjutab uue väljalaske env-faili ja vahetab teenuse sama luku all. Lukuta võib plaani samm sattuda deploy keskele ja uus väljalase saab env-faili vana plaaniga.
- Iga aktiveerimine jätab muudetud failist koopia selle kõrvale (`rag.env.before-<plaani id>`, `releases/<commit>.env.before-<plaani id>`; root, sisaldavad saladusi). Deploy kustutab vanade väljalasete env-failid, koopiaid mitte: koristus on käsitsi.

Iga väljalase, mis muudab implementatsiooni manifesti faile (`implementationManifest()`, `lib/rag-v2/pilot/provenance.js`), teeb plaani aegunuks. Deploy uuendab selle ise ([ADR-037](adr-037-release-chat-plan.md)); käsitsi tuleb plaan teha ainult uue põlvkonna, eelarve või mudeli jaoks. Manifestis on:

- `lib/rag-v2/**`, `lib/auth/**`, `app/api/chat/pilot/**`, `app/rag-pilot/**`;
- `lib/chat/m4Pilot*.js`, `app/api/chat/route.js`, `app/vestlus/page.js`, `app/chat-source/page.jsx`;
- vestluse põhikomponendid ja `messages/*.json`;
- `package.json`, `package-lock.json`, `prisma/schema.prisma`, `auth.js` ja mõni muu fail.

Värskust saab kontrollida töötava väljalaske kaustas (`cd $R`), sest skript võrdleb plaani jooksva kausta koodiga:

```bash
sudo -n cat <plaan> | node scripts/rag-v2-plan-freshness.mjs
```

Vastus on `current`, `stale` või `invalid`. Deploy kasutab põhjalikumat kontrolli (`scripts/rag-v2-plan-release.mjs prepare`, vt ADR-037); logis on `[release] Chat plan: current`, `renewed`, `disabled` või `unready` koos hoiatusega `existing chat plan is unready: <kood>`. Vestluse ajalugu on plaani järgi filtreeritud: pärast uut plaani vanemaid pöördumisi enam ei näidata, aga neid ei kustutata.

## 10. Kontroll ja koristus

- Kontrolli, et `rag_v2_head` näitab uut põlvkonda, `systemctl is-active sotsiaalai-frontend` vastab `active` ja teenus töötab uue plaaniga (skript trükib `running plan: <fail>`; käsitsi jaotise 9 viimane käsk).
- Tee üks vestluse pöördumine, mis vajab uut allikat.
  - Esimesed minutid pärast taaskäivitust on aeglased. Esimene vestluspöördumine käivitab taustal kõigi teadmusallikate mälusoojenduse (v26: 1124; omavalitsuse kirjeid ei soojendata).
- Otsingu mõju saab mõõta skriptidega `law-check.mjs` ja `assist-eval-v26.mjs` (serveris `/home/ubuntu/rag-v2-work/eval-*`).
  - Mõõtmine on tasuline: Luna plaan, valik ja päringute vektorid, umbes 0,1 USD 52 küsimuse jooksu kohta. See kuulub omaniku kulupiiri alla.
- Vana põlvkonda ja hoidla koopiat ei kustutata ilma omaniku otsuseta. Varukoopiaid veel ei tehta.
- **Uuenda õigusaktide manifest** ([ADR-038](adr-038-law-validity-check.md)) ja lisa see PR-iga. Muidu kontrollib igakuine töö eelmist korpust. Kontroll on tasuta ja loeb ainult RT avalikke andmeid:

  ```bash
  node scripts/rag-v2-law-validity.mjs manifest --store tmp/rag-v2-corpus-store-v25 --policy tmp/rag-v2-corpus-index-v32/policy.json \n    --input-root Andmebaasi --out docs/rag-v2/legal-acts-in-index.json
  node scripts/rag-v2-law-validity.mjs check --manifest docs/rag-v2/legal-acts-in-index.json --out tmp/law-validity
  ```

  Exit 0: muutusi pole. Exit 10: vaata aruande leide. Exit 20: mõni päring ebaõnnestus. Puuduvate redaktsioonide XML-id saab `--download <kaust>` valikuga; need lähevad sammudest 1–9 läbi nagu iga teine allikas.

## Seotud

- [ADR-012](adr-012-resumable-indexing.md): jätkatav indekseerimine.
- [ADR-036](adr-036-version-index.md): muudatusepõhine indekseerimine (indeksiread kuuluvad dokumendiversioonile).
- [ADR-038](adr-038-law-validity-check.md): õigusaktide kehtivuse igakuine kontroll Riigi Teataja vastu.
- [ADR-030](adr-030-chat-retrieval-at-corpus-scale.md): vestlus kogu korpusel.
- [ADR-031](adr-031-source-level-and-answer-completeness.md): allika tase ja vastuse täielikkus.
- Vastuvõtutest: [`docs/audits/rag-v2-chat-acceptance-2026-09-27.md`](../audits/rag-v2-chat-acceptance-2026-09-27.md).
