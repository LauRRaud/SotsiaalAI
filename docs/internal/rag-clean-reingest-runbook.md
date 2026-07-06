# RAG Clean Canonical Reingest Runbook

## 1. Eesmärk

See runbook kirjeldab productionis käsitsi tehtavat töövoogu:

`backup -> clean storage -> canonical reingest -> smoke -> rollback`

Eesmärk on teha puhas canonical reingest ilma legacy/canonical metadata seguta ja ilma production storage'it automaatselt hävitamata.

## 2. Millal seda kasutada

Kasuta seda runbooki:

- enne suuremat mass-ingesti;
- pärast canonical metadata contract'i muutust;
- kui olemasolev `registry.json` või Chroma storage sisaldab legacy/canonical segu;
- enne V3 `SourcePackage` töö alustamist.

## 3. Eeltingimused

Enne production sammu kontrolli:

- `npm run rag:smoke:v2 -- --legal-exact` läbib;
- `npm run rag:smoke:v2 -- --chat --legal-exact` läbib;
- readiness audit `blocked = 0` või kõik blokkerid on teadlikult lahendatud;
- `RAG_SERVICE_API_KEY` on olemas;
- `/var/lib/sotsiaalai-rag` ligipääs on olemas;
- backup kaust on olemas või loodav;
- sisendallikad on taastatavad;
- käsud jooksutatakse õiges serveris ja õiges repo kaustas.

## 4. Readiness Audit

Dry-run readiness audit:

```bash
npm run rag:reingest:readiness -- --root <INPUT_ROOT> --json logs/rag-reingest-readiness.json
```

Olemasolev metadata backfill plaan, kui tahad eraldi kontrolli:

```bash
npm run rag:plan:metadata -- --root <INPUT_ROOT> --json logs/rag-metadata-backfill-plan.json
```

Tõlgendus:

- `ready`: sisend on canonical reingestiks valmis.
- `backfill_required`: canonical normalizer suudab väljad tuletada, aga sisend ei ole veel algkujul puhas.
- `blocked`: clean reingest ei ole valmis; enne tuleb lahendada required canonical väljad või profile-spetsiifilised vastuolud.

Soovituslikud juured:

```bash
npm run rag:reingest:readiness -- --root KOV --json logs/rag-reingest-readiness.kov.json
npm run rag:reingest:readiness -- --root imports/ajakiri_sotsiaaltoo --json logs/rag-reingest-readiness.ajakiri.json
```

## 5. Backup

Productionis tee backup enne ühtegi storage muutust:

```bash
sudo systemctl stop sotsiaalai-rag.service

sudo mkdir -p /var/backups/sotsiaalai-rag

sudo tar -czf /var/backups/sotsiaalai-rag-before-canonical-$(date +%F-%H%M).tar.gz \
  /var/lib/sotsiaalai-rag

sudo systemctl start sotsiaalai-rag.service
```

Kontroll:

```bash
ls -lh /var/backups/sotsiaalai-rag/
```

## 6. Clean Storage Ettevalmistus

See samm on käsitsi. Ükski skript ei tohi productionis seda automaatselt teha.

```bash
sudo systemctl stop sotsiaalai-rag.service

sudo mv /var/lib/sotsiaalai-rag /var/lib/sotsiaalai-rag.legacy.$(date +%F-%H%M)

sudo mkdir -p /var/lib/sotsiaalai-rag/docs
sudo chown -R ubuntu:ubuntu /var/lib/sotsiaalai-rag

sudo systemctl start sotsiaalai-rag.service
sudo systemctl status sotsiaalai-rag.service --no-pager
```

Märkus:

- ära kustuta vana storage'it;
- hoia legacy storage alles kuni smoke'id on rohelised.

## 7. Reingest Järjekord

Soovituslik ingest järjekord:

1. `national RT / national_regulations`
2. `KOV RT / kov_regulations`
3. `KOV services`
4. `Ajakiri Sotsiaaltöö`
5. `organisatsioonid`
6. `templates / methodology`

Kui ingest on kallis või aeglane, alusta väikese kontrollitud subsetiga.

Näited:

```bash
npm run rag:ingest:rt-national -- KOV/130122025029.xml \
  --doc-id national-rt-130122025029 \
  --source-url https://www.riigiteataja.ee/akt/130122025029

npm run rag:ingest:rt-national -- KOV/Jogeva/jogeva-vald/406112024020.xml \
  --doc-id jogeva-vald-rt-406112024020 \
  --source-url https://www.riigiteataja.ee/akt/406112024020

npm run rag:ingest:kov
npm run rag:ingest:ajakiri -- --all --concurrency 2
```

## 8. Post-Reingest Smoke

Jooksuta pärast ingest'i:

```bash
npm run rag:smoke:v2 -- --legal-exact
npm run rag:smoke:v2 -- --chat --legal-exact
npm run rag:smoke:legal-exact -- --all
npm run rag:smoke:v2
npm run rag:smoke:v2 -- --chat
```

Kui V1 smoke on samuti vajalik:

```bash
npm run rag:smoke:v1
npm run rag:smoke:v1 -- --stream
```

## 9. Metadata Kvaliteedi Kontroll

Kontrolli admin analytics vaates või smoke JSON väljundis vähemalt neid välju:

- `metadataCompletenessRate`
- `missingRequiredFields`
- `missingRecommendedFields`
- `metadataByCollection`
- `metadataByFileType`
- `highRiskIssues`
- `sourceQualityIssues`

Eesmärk pärast clean canonical reingest'i:

- missing required fields = `0` või teadlikult põhjendatud erand;
- `unknown_source_type = 0`;
- freshness reasons kontrollitud;
- `displayedSourcePrecision = 1` legal exact küsimustes;
- `legalExact.ok = true`.

## 10. Rollback

Kui clean reingest või smoke ebaõnnestub:

```bash
sudo systemctl stop sotsiaalai-rag.service

sudo mv /var/lib/sotsiaalai-rag /var/lib/sotsiaalai-rag.failed.$(date +%F-%H%M)

sudo mv /var/lib/sotsiaalai-rag.legacy.<TIMESTAMP> /var/lib/sotsiaalai-rag

sudo systemctl start sotsiaalai-rag.service

npm run rag:smoke:v2 -- --legal-exact
npm run rag:smoke:v2 -- --chat --legal-exact
```

Rollbacki eeltingimus on see, et legacy storage jäi alles.

## 11. Safety Rules

- ära kustuta `/var/lib/sotsiaalai-rag` ilma backup'ita;
- ära automatiseeri destructive clean storage sammu ilma eraldi `--confirm` kaitseta;
- ära prindi `RAG_SERVICE_API_KEY` väärtust;
- ära salvesta session cookie't dokumenti;
- productionis tee käsud ainult serveris ja õiges kaustas;
- hoia legacy storage alles kuni smoke'id on rohelised;
- ükski ETAPP 8 skript ei tohi vaikimisi storage'it liigutada, tühjendada ega kustutada.

## 12. Post-Reingest Checklist

### RAG-service direct

1. `SHS §132`
- `paragraph_number = "132"`
- ainult `national_law`
- mitte `journal_article`

2. `SHS §140`
- `paragraph_number = "140"`
- mitte `§160`
- mitte `§70`
- mitte `§130`

### Chat

3. `SHS §140`
- `legalLookupPlan.enabled = true`
- `mode = explicit_paragraph`
- `paragraphRefs = ["140"]`
- `selection_strategy = legal_exact` või `legal_exact_paragraph`
- `selected_context_details` ainult `paragraph_number = "140"`
- `displayed_sources` ei sisalda vale paragrahvi

4. History override
- esimene küsimus: toimetulekutoetuse SHS paragrahvid
- teine küsimus: `SHS §140`
- teine vastus kasutab ainult `§140`
- ei päri `§131-135` ankrut kaasa

5. `SHS §132`
- selected/displayed ainult `§132`
- `journal_article` ei ole current legal source

6. Exact missing
- `SHS §999` ei asendu sarnase paragrahviga
- trace või vastus näitab ebapiisavat täpset õiguslikku allikatuge

### KOV

7. KOV määrus
- näide: `Jõgeva valla kord §5`
- `source_type = kov_regulation`
- `collection_id = kov_regulations`
- `municipality_id` sobib
- `paragraph_number = "5"`

8. KOV teenus / toetus / vorm / kontakt
- õige `municipality_id`
- official service info
- vormi küsimuses `application_form` / `web_form` / `pdf_form`
- kontaktiküsimuses `official_contact` / `contact_page`

### Ajakiri

9. Ajakirjaartikkel
- `source_type = journal_article`
- sobib taustaks
- ei kinnita tänast kehtivat õigust, toetust, vormi ega kontakti

### Admin

10. Metadata quality
- missing required fields = `0` või põhjendatud erand
- `unknown source type = 0`
- freshness reasons kontrollitud
- `metadataByCollection` ja `metadataByFileType` nähtavad
