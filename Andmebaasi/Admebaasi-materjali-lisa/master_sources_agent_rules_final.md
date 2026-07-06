# SotsiaalAI source master – andmekorjeagendi reeglid

**Versioon:** final  
**Kuupäev:** 2026-04-29

## 1. Põhireegel

Enne uue allika lisamist kontrolli `master_sources_final.json` registrit `normalized_url` alusel.

Kui allikas on juba olemas:

- ära loo uut dubleerivat source-kirjet;
- kasuta olemasolevat `source_id`;
- seo allikas uue organisatsiooni, teemapaketi või knowledge-doc töövooga;
- ära tee uut knowledge-doc metadata faili automaatselt, kui sama allikas on juba olemas või ingest-kandidaadina märgitud.

Kui allikas puudub:

- lisa see uue kandidaadina;
- määra `source_type`, `resource_type`, `collection_hint`, `evidence_role`;
- määra `ingest_status`;
- ära märgi automaatselt `ingest_ready`, kui tüüp või tõendusroll on ebakindel.

## 2. Allikatüübi otsustus

```text
KOV teenus/toetus/vorm/kontakt → KOV moodul
Organisatsiooni või asutuse koduleht → organisatsiooni 4 tuumfaili
PDF/DOCX/juhend/uuring/raport → knowledge-doc metadata + parsing/chunk ingest
Üksik HTML juhend/artikkel → HTML knowledge-doc
Teemaportaal → topic hub; korja sisulised alamlehed
Register/kataloog/otsing → registry_reference
Ajakirjaartikkel → journal layer
```

## 3. Organisatsiooni veebileht

Organisatsiooni puhul tee 4 tuumfaili:

```text
<slug>.sources.json
<slug>.json
<slug>.meta.json
<slug>.rag.md
```

Ära tee igale leitud PDF-ile eraldi metadata faili. Pane PDF-id esmalt `<slug>.json` `documents[]` plokki staatusega:

```text
referenced_only
ingest_candidate
ingest_ready
needs_review
```

Eraldi knowledge-doc metadata tee ainult valitud olulistele juhenditele, metoodikamaterjalidele, uuringutele või käsiraamatutele.

## 4. PDF/DOCX

PDF/DOCX ei vaja `.rag.md` kokkuvõtet, kui dokument ise läheb RAG-i.

Vajalik on:

```text
source_url või source_path
knowledge-doc metadata
validator
parser/chunk ingest
```

Remote URL on lubatud:

```json
{
  "source_url": "https://...",
  "source_path": null,
  "source_format": "pdf"
}
```

## 5. Teemaportaal

Põhileht märgi tavaliselt:

```text
source_type = topic_hub
resource_type = topic_index
ingest_status = referenced_only
```

RAG-i jaoks korja sisulised alamlehed teemapaketina või HTML knowledge-doc’idena.

## 6. Tõenduspiirid

Ära määra juhendile, uuringule, organisatsiooni infole või teemalehele automaatselt `legal_basis=true`.

Vaikimisi peab juhendi/organisatsiooni/metoodikamaterjali puhul olema:

```json
"legal_basis": false
```

ja disallowed claim types peavad keelama vähemalt:

```text
legal_entitlement
benefit_amount
municipal_service_availability
application_deadline
medical_diagnosis_or_treatment
```

## 7. Kui oled ebakindel

Määra:

```json
{
  "ingest_status": "needs_review",
  "metadata_confidence": "medium",
  "needs_manual_review": true
}
```

Ära leiuta allika tüüpi ega tõendusrolli.
