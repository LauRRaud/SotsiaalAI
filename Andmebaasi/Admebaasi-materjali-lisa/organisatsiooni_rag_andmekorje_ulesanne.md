# TÖÖÜLESANNE: Organisatsiooni / asutuse RAG-andmekorje SotsiaalAI jaoks

## Kontekst

Koostan SotsiaalAI RAG-andmebaasi jaoks organisatsioonide, asutuste, teenuseosutajate, partnerite ja teemaveebide teadmuspakkette.

See töö **EI OLE** KOV teenuste/toetuste korje.  
See töö **EI OLE** Riigi Teataja õigusakti korje.  
See töö **EI OLE** PDF/DOC/DOCX-failide täielik sisuingest, kui seda eraldi ei paluta.  
See töö **EI OLE** kogu veebilehe automaatne kopeerimine RAG-i.

## Eesmärk

Koosta ühe organisatsiooni kohta kontrollitud RAG-organisatsioonipakett, mis annab SotsiaalAI assistendile usaldusväärse ülevaate:

- mis organisatsiooniga on tegu;
- kellele see on mõeldud;
- milliseid teenuseid, programme, juhendeid, materjale või töövahendeid see pakub;
- millised on kontaktid ja kasutuskanalid;
- millised veebilehed on ametlikud allikad;
- millised PDF/DOC/DOCX materjalid tuleks hiljem eraldi knowledge-doc dokumendina ingestida.

## Töö tulemus

Koosta 4 tuumfaili:

1. `<slug>.sources.json`
2. `<slug>.json`
3. `<slug>.meta.json`
4. `<slug>.rag.md`

Kui leiad organisatsiooni enda koostatud PDF/DOC/DOCX juhendeid, käsiraamatuid, blankette, aruandeid, metoodilisi materjale, infomaterjale või koolitusmaterjale, siis ära pane nende täisteksti organisatsiooni põhipaketti.

Lisa need eraldi `materials` / `relatedMaterials` nimekirja koos allikalingiga, et neid saaks hiljem eraldi knowledge-doc metadata skeemiga töödelda.

## Sisend

```text
ORGANISATSIOONI_NIMI: <organisatsiooni nimi>
SLUG: <slug>
ORGANISATSIOONI_TÜÜP: <nt avalik asutus / teenuseosutaja / MTÜ / sihtasutus / teemaveeb / partnerorganisatsioon>
FOOKUS: <nt puudega inimesed, vaimne tervis, lapsed ja pered, ohvriabi, rehabilitatsioon, sotsiaalteenused>
AMETLIK_VEEB: <URL>
CHECKED_AT: <YYYY-MM-DD>
```

Vajadusel kasuta ka masterlisti, kui see on antud:

- kui masterlistis on sama organisatsiooni veebilehed või PDF/DOC/DOCX materjalid juba olemas, ära dubleeri neid;
- kasuta olemasolevat `source_id` väärtust, kui see on olemas;
- märgi, kas leitud allikas oli masterlistis juba olemas või on uus leid;
- ära lisa juhuslikke dubleeritud URL-e;
- eelista canonical URL-i;
- kontrolli URL-e `normalized_url` alusel.

## Oluline arhitektuuripõhimõte

Organisatsiooni pakett peab jääma eraldi KOV ja RT kihist.

Organisatsiooni profiil ei ole õigusallikas.  
Organisatsiooni profiil ei kinnita iseseisvalt inimese õiguslikku õigust teenusele, toetusele, summale, tähtajale ega KOV otsusele.

`<slug>.meta.json` failis peab olema:

```json
"legal_basis": false
```

ning `disallowed_claim_types` peab sisaldama vähemalt:

- `legal_entitlement`
- `benefit_amount`
- `municipal_service_availability`
- `application_deadline`
- `legal_basis`
- `medical_diagnosis_or_treatment`
- `municipal_decision`

Kui organisatsiooni lehel on viide seadusele, määrusele või Riigi Teatajale, siis ära tõsta seda organisatsioonipaketi õiguslikuks aluseks. Märgi see vajadusel `related_reference` või `notes` alla, kuid RT/legal layer tuleb töödelda eraldi.

Kui organisatsioon kirjeldab enda teenust, võib see toetada selle organisatsiooni teenusekirjeldust ja pöördumiskanalit. See ei tähenda automaatselt, et inimesel on õigus teenusele avaliku teenusena või et KOV peab seda teenust tagama.

## Ära tee

- ära lisa Riigi Teataja määrust organisatsiooni põhipaketi sisse;
- ära kinnita organisatsiooni info põhjal inimese õiguslikku õigust toetusele või teenusele;
- ära kinnita KOV teenuse olemasolu, summat, tähtaega või vormi, kui allikas ei ole vastav ametlik KOV/RT allikas;
- ära kopeeri PDF/DOC/DOCX materjalide täisteksti;
- ära loo väljamõeldud teenuseid, kontakte, sihtrühmi ega järeldusi;
- ära kasuta navigeerimismenüüd faktiallikana, kui tegelik sisuleht puudub;
- ära kasuta aegunud või katkiseid lehti ilma `source_status = "needs_review"` või `review_notes` märkuseta;
- ära märgi organisatsiooni profiili `legal_basis=true`;
- ära märgi juhendit, metoodikamaterjali, uuringut või organisatsiooni infot automaatselt õiguslikuks aluseks;
- ära märgi organisatsiooni enda vormi KOV ametlikuks taotlusvormiks, kui allikas ei ole vastav KOV ametlik leht või e-teenus.

## Organisatsiooni info võib toetada

- organisatsiooni kirjeldust;
- teenusekirjeldust;
- organisatsiooni rolli ja fookust;
- kontaktide ja pöördumiskanalite kirjeldust;
- juhendite ja materjalide leidmist;
- metoodilist või praktilist taustainfot;
- partnerteenuse või teemaveebi selgitust;
- spetsialistile või abivajajale suunatud ressursiloendit.

## Organisatsiooni info EI TOHI üksi kinnitada

- `legal_entitlement`;
- `benefit_amount`;
- `municipal_service_availability`;
- `application_deadline`;
- `legal_basis`;
- `medical_diagnosis_or_treatment`;
- `municipal_decision`;
- ametlikku KOV otsust või õigust.

---

## 1. Korje ulatus

Ava organisatsiooni ametlik veebileht ja leia vähemalt järgmised alamlehed, kui olemas:

- avaleht;
- meist / organisatsioonist;
- teenused;
- sihtrühmad;
- programmid / projektid;
- materjalid / väljaanded / juhendid;
- koolitused / nõustamine;
- kontakt;
- abi saamise kanalid;
- spetsialistidele mõeldud info;
- korduma kippuvad küsimused;
- ligipääsetavus / keeleinfo, kui asjakohane.

Kui organisatsioon on avalik asutus või riiklik teenusekanal, kontrolli ka:

- teenuste kirjeldused;
- taotlemise või pöördumise kanalid;
- e-teenused;
- ametlikud kontaktid;
- allasutused või seotud teenuseosutajad;
- juhendid ja vormid;
- kasutajale või spetsialistile mõeldud töövahendid.

Kui organisatsioon on teemaveeb, kompetentsikeskus või infoportaal, erista:

- põhileht / topic hub;
- sisulised juhendlehed;
- töövahendid;
- allalaaditavad materjalid;
- koolitus- või nõustamisinfo;
- kontakt või vastutav organisatsioon.

---

## 2. Sources fail

Loo fail:

```text
<slug>.sources.json
```

See peab sisaldama kõiki kasutatud ametlikke veebiallikaid ja eraldi tuvastatud materjalilinke.

Iga URL-i puhul lisa võimalusel:

- `source_id`;
- `title`;
- `url`;
- `url_canonical`;
- `normalized_url`;
- `source_type`;
- `source_format`;
- `authority`;
- `language`;
- `source_status`;
- `masterlist_status: existing | new_candidate | not_checked`;
- `used_for`.

Soovituslik struktuur:

```json
{
  "schemaVersion": "organization-sources-v1",
  "organization_id": "<slug>",
  "organization_name": "<nimi>",
  "checked_at": "<YYYY-MM-DD>",
  "official_homepage": "<url>",
  "sources": [
    {
      "source_id": "<slug>_homepage",
      "title": "Avaleht",
      "url": "...",
      "url_canonical": "...",
      "normalized_url": "...",
      "source_type": "organization_homepage",
      "source_format": "html",
      "authority": "organization_official",
      "language": "et",
      "source_status": "active",
      "masterlist_status": "existing | new_candidate | not_checked",
      "used_for": ["organization_overview"]
    }
  ],
  "materials": [
    {
      "material_id": "<slug>_material_<short-name>",
      "title": "...",
      "url": "...",
      "url_canonical": "...",
      "normalized_url": "...",
      "source_format": "pdf | doc | docx | html | other",
      "material_type": "guideline | form | manual | report | training_material | methodology_material | information_material | other",
      "publisher": "<organisatsioon>",
      "year": null,
      "source_status": "active | stale | needs_review",
      "ingest_status": "referenced_only | ingest_candidate | needs_review",
      "recommended_pipeline": "knowledge_doc_pipeline",
      "needs_separate_knowledge_doc": true,
      "legal_basis": false,
      "masterlist_status": "existing | new_candidate | not_checked",
      "notes": "Seda faili ei pandud organisatsiooni põhipaketi täistekstina sisse; sobib hilisemaks knowledge-doc ingestiks."
    }
  ]
}
```

---

## 3. Organisatsiooni andmefail

Loo fail:

```text
<slug>.json
```

See on struktureeritud organisatsiooni tõefail.

Soovituslik struktuur:

```json
{
  "schemaVersion": "organization-profile-v1",
  "organization_id": "<slug>",
  "slug": "<slug>",
  "name": "<nimi>",
  "type": "<organization_type>",
  "status": "active | inactive | unclear | needs_review",
  "summary": "...",
  "focus": "...",
  "target_groups": [],
  "service_areas": [],
  "geographic_scope": {
    "country": "EE",
    "coverage": "national | regional | local | online | unclear",
    "municipality_ids": [],
    "county": null,
    "notes": null
  },
  "roles": [
    "service_provider",
    "information_provider",
    "methodology_provider"
  ],
  "services": [
    {
      "id": "<slug>_service_<name>",
      "title": "...",
      "service_type": "counselling | rehabilitation | training | support_service | information_service | crisis_support | advocacy | coordination | other",
      "summary": "...",
      "target_groups": [],
      "access": {
        "channels": [],
        "referral_required": null,
        "self_referral_possible": null,
        "pricing": null,
        "notes": null
      },
      "contacts": [],
      "source_ids": []
    }
  ],
  "contacts": [
    {
      "id": "<slug>_contact_main",
      "label": "Üldkontakt",
      "email": null,
      "phone": null,
      "address": null,
      "url": null,
      "source_ids": []
    }
  ],
  "materials": [],
  "related_organizations": [],
  "source_ids": [],
  "limitations": [
    "Organisatsiooni info ei kinnita iseseisvalt inimese õiguslikku õigust teenusele või toetusele.",
    "KOV teenuse, toetuse, summa, tähtaja või vormi kinnitamiseks tuleb kasutada vastavat KOV või RT allikat.",
    "Meditsiinilise diagnoosi või raviotsuse kinnitamiseks ei tohi kasutada organisatsiooniprofiili iseseisva allikana."
  ]
}
```

Kui info puudub, kasuta `null`, tühi massiiv või `"not_published"`.  
Ära mõtle infot välja.

---

## 4. Metadata fail

Loo fail:

```text
<slug>.meta.json
```

Soovituslik struktuur:

```json
{
  "schemaVersion": "organization-meta-v1",
  "docId": "organization-<slug>",
  "organization_id": "<slug>",
  "title": "<organisatsiooni nimi>",
  "collection_id": "organizations",
  "document_kind": "organization_profile",
  "resource_type": "partner_service_info",
  "source_type": "organization_profile",
  "source_format": "html_summary",
  "source_origin_type": "web",
  "authority_level": "organization_official",
  "publisher": "<organisatsiooni nimi>",
  "publisher_type": "organization",
  "language": "et",
  "country": "EE",
  "jurisdiction_level": "ORGANIZATION",
  "audience": "BOTH",
  "audiences": ["SOCIAL_WORKER", "CLIENT"],
  "checked_at": "<YYYY-MM-DD>",
  "source_status": "active",
  "historical": false,
  "legal_basis": false,
  "allowed_claim_types": [
    "organization_description",
    "service_description",
    "contact",
    "methodology_background",
    "communication_guidance",
    "training_material",
    "resource_listing",
    "partner_service_info"
  ],
  "disallowed_claim_types": [
    "legal_entitlement",
    "benefit_amount",
    "municipal_service_availability",
    "application_deadline",
    "legal_basis",
    "medical_diagnosis_or_treatment",
    "municipal_decision"
  ],
  "ingest": {
    "docId": "organization-<slug>",
    "collection_id": "organizations",
    "chunking_strategy": "section_aware",
    "display_full_text": false
  },
  "quality": {
    "metadata_complete": true,
    "needs_manual_review": false,
    "review_notes": []
  }
}
```

Kui mõni oluline väli on ebakindel, kasuta:

```json
"needs_manual_review": true
```

ja lisa `review_notes` alla põhjus.

---

## 5. RAG tekstifail

Loo fail:

```text
<slug>.rag.md
```

See peab olema puhas, lühike ja RAG-ile sobiv kokkuvõte, mitte veebilehe koopia.

Struktuur:

```markdown
# <Organisatsiooni nimi>

## Ülevaade

Lühike kirjeldus, mis organisatsioon see on ja millega tegeleb.

## Sihtrühmad

- ...

## Põhitegevused ja teenused

### <Teenuse/tegevuse nimi>

Kirjeldus.  
Kellele.  
Kuidas pöörduda.  
Olulised piirangud.

## Kontakt ja pöördumiskanalid

- üldkontakt;
- veebileht;
- e-post;
- telefon;
- aadress;
- e-teenus või kontaktivorm, kui olemas.

## Materjalid ja juhendid

Loetle ainult pealkirjad ja lingid.  
Ära kopeeri PDF/DOC/DOCX materjalide täisteksti.

Näide:

- “<materjali pealkiri>” — PDF, vajab eraldi knowledge-doc ingest’i.
- “<vormi pealkiri>” — vorm / blankett.
- “<juhendi pealkiri>” — juhend, sobib hilisemaks knowledge-doc dokumendiks.

## Olulised piirangud

- See organisatsiooniprofiil kirjeldab organisatsiooni ja tema avaldatud infot.
- See ei kinnita iseseisvalt inimese õigust KOV teenusele, toetusele, summale või tähtajale.
- Õigusliku aluse kontrollimiseks tuleb kasutada RT/legal layer’it.
- KOV konkreetse teenuse, vormi või tähtaja kinnitamiseks tuleb kasutada vastavat KOV allikat.
- Meditsiinilise diagnoosi või raviotsuse kinnitamiseks tuleb kasutada sobivat tervishoiuallikat, mitte organisatsiooniprofiili.

## Allikad

Lisa kasutatud source_id ja URL loetelu.
```

Iga oluline fakt peab olema tagantjärele seotud `source_id`-ga kas teenuse, kontakti, materjali või allikaloendi kaudu.

Ei ole vaja lisada iga lause lõppu viidet, kuid iga oluline objekt või sektsioon peab olema allikani jälgitav.

---

## 6. Materjalide käsitlus

Kui leiad PDF/DOC/DOCX materjale:

### A. Kui see on lihtsalt organisatsiooni infolehe lisamaterjal

- lisa `materials` nimekirja;
- ära tee eraldi täistekstiga knowledge-doc metadata’t, kui kasutaja ei palu;
- märgi `ingest_status = "referenced_only"` või `"needs_review"`.

### B. Kui see on sisuline juhend, käsiraamat, metoodika, uuring, infomaterjal või koolitusmaterjal

- märgi `needs_separate_knowledge_doc = true`;
- märgi `ingest_status = "ingest_candidate"`;
- märgi `recommended_pipeline = "knowledge_doc_pipeline"`;
- soovita hiljem eraldi `knowledge-doc-v1` metadata faili;
- ära kopeeri täisteksti organisatsiooni `rag.md` sisse.

### C. Kui see on vorm/blankett

- märgi `material_type = "form"`;
- lisa `source_type = "application_form"` või `"organization_form"`, kui kasutad seda väljana;
- märgi `needs_separate_knowledge_doc` vastavalt sisule;
- see võib toetada dokumentide koostamist või teenusekirjeldust, kuid ei kinnita õiguslikku õigust;
- ära märgi seda KOV ametlikuks taotlusvormiks, kui allikas ei ole vastav KOV ametlik leht või e-teenus.

### D. Kui materjal on aegunud, katkise lingiga või ebaselge staatusega

- märgi `source_status = "needs_review"` või `"stale"`;
- lisa `review_notes`;
- ära märgi seda `ingest_ready`.

---

## 7. Kvaliteedinõuded

- Kasuta ainult ametlikke allikaid.
- Eelista organisatsiooni enda ametlikku veebilehte.
- Iga oluline fakt peab olema `source_id` kaudu jälgitav.
- Kui info puudub, kirjuta `null`, tühi massiiv või `"not_published"`, mitte ära mõtle välja.
- Kui leht on ebaselge, kirjuta `needs_review`.
- Kui allikas on vana, märgi `historical` või `source_status = "stale" / "needs_review"`.
- Kui organisatsioon pakub teenust ainult projektipõhiselt või piiratud sihtrühmale, märgi see selgelt.
- Kui organisatsioon suunab teenusele teise asutuse kaudu, märgi referral/partner info eraldi.
- Kui teenuse hind, rahastus või kättesaadavus on ebaselge, ära tee järeldust.
- Kui sama URL esineb mitmel kujul, kasuta canonical/normalized URL-i.
- Kui allikas oli masterlistis olemas, kasuta olemasolevat `source_id`-d.
- Kui allikas puudus masterlistist, märgi `masterlist_status = "new_candidate"`.
- Kui masterlisti ei antud, märgi `masterlist_status = "not_checked"`.

---

## 8. Väljund

Tagasta neli faili sisuna eraldi plokkides:

```text
--- FILE: <slug>.sources.json ---
<json>

--- FILE: <slug>.json ---
<json>

--- FILE: <slug>.meta.json ---
<json>

--- FILE: <slug>.rag.md ---
<markdown>
```

Kui leidsid olulisi PDF/DOC/DOCX materjale, lisa lõppu eraldi:

```text
--- MATERIALS_FOR_SEPARATE_KNOWLEDGE_DOCS ---
- title
- url
- source_format
- material_type
- recommended_collection_id
- ingest_status
- notes
```

Kui mõni vajalik asi jäi leidmata, lisa:

```text
--- OPEN_QUESTIONS / NEEDS_REVIEW ---
- ...
```

Lõpuks lisa lühike kontrollkokkuvõte:

```text
--- COLLECTION_SUMMARY ---
- kasutatud ametlike HTML-allikate arv;
- leitud PDF/DOC/DOCX materjalide arv;
- mitu materjali vajab eraldi knowledge-doc ingest’i;
- kas masterlisti kontroll tehti;
- kas mõni allikas vajab käsitsi ülevaatust;
- kas organisatsioonipakett jäi eraldi KOV ja RT kihist.
```
