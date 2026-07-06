# SotsiaalAI RAG allikaregistri ja andmekorje töövoog

**Dokumendi eesmärk:** selgitada, kuidas kasutada SotsiaalAI master-listi, mida andmekorjeagent peab korjama, kuidas eri tüüpi allikaid käsitleda ning mida arenduses arvestada, et RAG-süsteem ei muutuks juhuslike linkide kogumiks, vaid kontrollitud teadmuskihiks.

**Fookus:** master-list, organisatsioonid, PDF/DOCX/HTML materjalid, teemaportaalid, registrid ja RAG-ingest’i loogika.

**Mitte eesmärk:** see dokument ei kirjelda KOV SourcePackage arenduse tehnilisi samme detailides. KOV moodul on eraldi teema.

---

## 1. Põhimõte: master-list ei ole veel teadmuskorpus

Master-list on **allikaregister**, mitte lõplik RAG-sisu.

See tähendab:

```text
master_sources_clean.json = teadaolevate allikate register
RAG ingest = allika sisu tegelik tekst + metadata + chunkid
```

Master-list vastab küsimusele:

```text
Millised allikad on meil teada?
```

RAG-teadmuskorpus vastab küsimusele:

```text
Mida need allikad sisuliselt ütlevad ja kuidas neid vastustes kasutada?
```

Seega master-listi ei peaks käsitlema lõppkasutajale nähtava sisuna. See on sisemine töövahend:

- dubleeringute vältimiseks;
- usaldusväärsete allikate prioriseerimiseks;
- andmekorjeagentidele lähteallikate andmiseks;
- ingest-kandidaatide valimiseks;
- allika tüübi ja tõendusrolli määramiseks.

---

## 2. Master-listi roll RAG töövoos

Master-listi kasutusloogika:

```text
1. Allikas on master-listis teada.
2. Allikale antakse tüüp ja staatus.
3. Vajadusel korjab agent sisu või süsteem genereerib metadata.
4. Validator kontrollib metadata.
5. Ainult kinnitatud allikas läheb RAG-i.
```

Master-listis võiks igal allikal olla vähemalt:

```json
{
  "source_id": "ska_hoolekandeteenuste_kvaliteedi_juhend_2024",
  "title": "Hoolekandeteenuste kvaliteedi juhendmaterjal",
  "url": "https://...",
  "normalized_url": "https://...",
  "source_format": "pdf",
  "source_type": "official_guideline",
  "resource_type": "best_practice_guidance",
  "publisher": "Sotsiaalkindlustusamet",
  "collection_hint": "national_guidelines",
  "evidence_role": "practice_guidance",
  "ingest_status": "ingest_candidate",
  "ingest_priority": "high",
  "notes": ""
}
```

---

## 3. Allikate põhiklassid

SotsiaalAI RAG-is ei tohiks kõiki allikaid käsitleda ühe “dokumendi” liigina. Vaja on eristada vähemalt järgmisi mooduleid.

### 3.1 Source Master ehk allikaregister

**Mis see on:** keskne allikate register.

**Näited:**

- organisatsiooni koduleht;
- PDF-juhend;
- uuring;
- registri link;
- teemaportaali avaleht;
- infomaterjal;
- ajakirja või arhiivi leht.

**Kas läheb otse RAG-i?** Üldjuhul ei.

**Eesmärk:** teada, mis allikad on olemas ja mida peaks hiljem korjama või ingestima.

---

### 3.2 KOV moodul

**Mis see on:** kohaliku omavalitsuse teenuste, toetuste, vormide, kontaktide ja KOV-spetsiifilise info kiht.

**Failid:**

```text
<slug>.sources.json
<slug>.json
<slug>.meta.json
<slug>.rag.md
```

**Näide:**

```text
harku-vald.sources.json
harku-vald.json
harku-vald.meta.json
harku-vald.rag.md
```

**Vastab küsimusele:**

```text
Mida konkreetne omavalitsus pakub?
```

**Oluline piirang:** KOV veebikiht ja RT/legal layer peavad olema eraldi. KOV veebikorje ei tohi ise õiguslikke järeldusi teha ega õigusakti sisu veebipaketti segada.

---

### 3.3 Organisatsioonide ja asutuste moodul

**Mis see on:** ühe organisatsiooni, teenuseosutaja, MTÜ, asutuse või teemaveebi profiil.

**Näited:**

- Astangu Kutserehabilitatsiooni Keskus;
- EPIKoda;
- Lastekaitse Liit;
- Peaasi.ee;
- Dementsuse Kompetentsikeskus;
- abivahendikeskus või teenusepakkuja.

**Failid:**

```text
<slug>.sources.json
<slug>.json
<slug>.meta.json
<slug>.rag.md
```

**Vastab küsimusele:**

```text
Kes see organisatsioon on?
Mida ta teeb?
Kellele see on suunatud?
Millised teenused, ressursid ja kontaktid tal on?
Milliseid olulisi materjale ta avaldab?
```

**Oluline:** organisatsiooni profiil ei ole KOV teenuseinfo ega õigusakt. See võib kinnitada organisatsiooni enda teenusekirjeldust ja kontakte, kuid ei tohi kinnitada inimese seaduslikku õigust toetusele, KOV teenuse olemasolu ega toetuse summat.

---

### 3.4 Knowledge-doc moodul

**Mis see on:** üksik PDF, DOCX, HTML-juhend, raport, uuring, käsiraamat, infomaterjal või koolitusmaterjal.

**Näited:**

- SKA hoolekandeteenuste kvaliteedi juhendmaterjal;
- OSKA sotsiaaltöö seirearuanne;
- Õiguskantsleri abivajavast lapsest teatamise juhend;
- Terviseameti hoolekandeasutuste nakkustõrje juhend;
- Astangu INDIVERSO metoodikamaterjal;
- EPIKoja käsiraamat.

**Failid:**

```text
dokumendi-fail.pdf
dokumendi-metadata.json
```

või remote URL puhul:

```json
{
  "source_url": "https://...",
  "source_path": null,
  "source_format": "pdf"
}
```

**Oluline:** PDF/DOCX ei vaja organisatsiooni 4 tuumfaili. See vajab korrektset knowledge-doc metadata’t.

---

### 3.5 Teemapakettide moodul

**Mis see on:** teemaportaal või veebilehtede kogum, mis ei ole ühe organisatsiooni profiil, kuid on sisuliselt oluline.

**Näited:**

- ligipääsetavuse teemaportaal;
- võrdse kohtlemise teemalehed;
- vaimse tervise teemaportaal;
- digiligipääsetavuse juhised;
- kriisivalmiduse juhendite kogum.

**Võimalikud failid:**

```text
<topic>.sources.json
<topic>.json
<topic>.meta.json
<topic>.rag.md
```

või olulised alamlehed eraldi HTML knowledge-doc’idena:

```text
ligipaasetavus-mis-on-ligipaasetavus.json
ligipaasetavus-lihtne-keel.json
ligipaasetavus-universaalne-disain.json
```

**Vastab küsimusele:**

```text
Mida see valdkondlik teema tähendab?
Millised põhimõisted, juhised ja praktilised soovitused on allikas avaldanud?
```

**Näide:** Kompetentsikeskuse ligipääsetavuse põhileht on pigem `topic_hub`, mitte organisatsiooniprofiil. RAG-i jaoks on väärtuslikumad selle alamlehed.

---

### 3.6 Registrite ja kataloogide moodul

**Mis see on:** otsingud, registrid, kataloogid ja andmebaasid.

**Näited:**

- MTR;
- Medre;
- SKA teenusepakkujad;
- SKA teenuskohad;
- e-Äriregister;
- abivahendite otsimootor.

**Kas ingestida tavalise RAG-tekstina?** Üldjuhul mitte.

**Soovitus:** esialgu `referenced_only` või `registry_source`. Tulevikus võib vaja minna eraldi connector’it või struktureeritud andmepäringut.

---

### 3.7 Ajakirjaartiklite moodul

**Mis see on:** ajakirja Sotsiaaltöö artiklite ja muude erialaste artiklite kiht.

**Olemasolev kiht:**

```text
collection_id = sotsiaaltoo_articles
source_type = journal_article
```

**Kasutus:** taust, metoodika, praktikanäited, professionaalne refleksioon.

**Ei tohi kinnitada:** tänast õigust, KOV teenuse olemasolu, vormi, kontakti, summat ega tähtaega.

---

## 4. Allikatüübi otsustusreegel

Kasuta järgmist lihtsat otsustuspuud.

```text
Kas see on KOV teenuse/toetuse info?
→ KOV moodul

Kas see on konkreetse organisatsiooni või asutuse koduleht?
→ Organisatsioonide moodul

Kas see on PDF/DOCX/üksik HTML juhend, uuring või raport?
→ Knowledge-doc moodul

Kas see on teemaportaal või mitme alamlehega valdkondlik kogum?
→ Teemapaketi moodul

Kas see on register, otsing või kataloog?
→ Registry/reference moodul

Kas see on ajakirjaartikkel?
→ Journal moodul
```

---

## 5. Mida andmekorjeagent peab korjama?

### 5.1 Organisatsiooni või asutuse koduleht

Kui allikas on konkreetne organisatsioon, peab agent koostama 4 tuumfaili.

**Agent peab koguma:**

- organisatsiooni ametlik nimi;
- slug;
- tüüp;
- fookus;
- piirkond/ulatus;
- ametlik veeb;
- sihtrühmad;
- teenused;
- ressursid;
- kontaktid;
- olulised lisamaterjalid;
- allikad;
- ebaselgused.

**Väljund:**

```text
<slug>.sources.json
<slug>.json
<slug>.meta.json
<slug>.rag.md
```

**Lisamaterjalid:**

Kõiki PDF-e ei muudeta automaatselt eraldi metadata failideks. Need lisatakse esmalt `documents[]` plokki staatusega:

```text
referenced_only
ingest_candidate
ingest_ready
needs_review
```

Eraldi knowledge-doc metadata JSON tehakse ainult valitud olulistele dokumentidele.

---

### 5.2 PDF või Word dokument

PDF/DOCX on valmis dokument. Selle puhul pole vaja koostada `.rag.md` faili.

**Vajalik:**

```text
source_url või source_path
metadata JSON
```

Süsteem võib:

```text
1. laadida PDF/DOCX URL-ist või failist;
2. võtta teksti välja;
3. jagada teksti chunkideks;
4. lisada chunkidele metadata;
5. ingestida RAG-i.
```

**Metadata on siiski kohustuslik**, sest see ütleb, mida dokument võib ja ei või vastuses tõendada.

---

### 5.3 Üksik HTML juhend või artikkel

Kui tegemist on ühe sisuka HTML-lehega, võib seda käsitleda knowledge-doc’ina.

**Näited:**

- “Mis on ligipääsetavus?”
- “Mis on lihtne keel?”
- “Ligipääsetava ürituse korraldamine”
- “Kuidas projektis tagada ligipääsetavus?”

**Vajalik:**

```text
source_url
knowledge-doc metadata
HTML sisu parse/chunk
```

---

### 5.4 Teemaportaal

Kui leht on teemaportaal, ei tohiks agent kõike pimesi ingestida.

**Agent peab:**

1. tuvastama, et põhileht on `topic_hub`;
2. kaardistama olulised alamlehed;
3. valima sisuliselt väärtuslikud lehed;
4. koostama kas teemapaketi või eraldi HTML knowledge-doc’id.

**Näide: ligipääsetavus**

Põhileht:

```text
source_type = topic_hub
resource_type = topic_index
ingest_status = referenced_only
```

Alamlehed:

```text
source_type = official_guidance_page
resource_type = guidance_article
collection_id = accessibility_guidance
evidence_role = definition / practice_guidance / background
```

---

## 6. PDF/DOCX parsing ja metadata

### 6.1 PDF/DOCX puhul ei pea formaati käsitsi muutma

PDF või Word fail võib minna RAG-i otse chunkidena. Ei ole vaja teha `.md` kokkuvõtet, kui eesmärk on dokumendi enda sisu RAG-i panna.

Õige töövoog:

```text
PDF/DOCX/URL
→ text extraction
→ chunking
→ metadata
→ RAG ingest
```

### 6.2 Metadata on kohustuslik

Dokument peab saama metadata, näiteks:

```json
{
  "schemaVersion": "knowledge-doc-v1",
  "docId": "ska-hoolekandeteenuste-kvaliteedi-juhend-2024",
  "title": "Hoolekandeteenuste kvaliteedi juhendmaterjal",
  "document_kind": "guideline",
  "source_type": "official_guideline",
  "resource_type": "best_practice_guidance",
  "collection_id": "national_guidelines",
  "evidence_role": "practice_guidance",
  "publisher": "Sotsiaalkindlustusamet",
  "source_url": "https://...",
  "source_path": null,
  "source_format": "pdf",
  "language": "et",
  "source_status": "active",
  "historical": false,
  "legal_basis": false,
  "allowed_claim_types": [
    "practice_recommendation",
    "methodology_background",
    "professional_guidance",
    "background"
  ],
  "disallowed_claim_types": [
    "legal_entitlement",
    "benefit_amount",
    "municipal_service_availability",
    "application_deadline",
    "medical_diagnosis_or_treatment"
  ]
}
```

### 6.3 Remote URL on lubatud

PDF ei pea tingimata olema lokaalselt alla laaditud.

Lubatud on:

```json
{
  "source_url": "https://...",
  "source_path": null,
  "source_format": "pdf"
}
```

Validator ei tohi seda veaks lugeda.

### 6.4 Automaatne metadata generator

Suure hulga PDF-ide puhul ei ole mõistlik teha metadata’t käsitsi ükshaaval. Vaja on generaatorit:

```text
master source või URL
→ metadata draft
→ validator
→ manual review ainult ebakindlatele
```

Metadata generator peaks määrama vähemalt:

- docId;
- title;
- document_kind;
- source_type;
- resource_type;
- collection_id;
- evidence_role;
- publisher/source_organization;
- source_url/source_path;
- source_format;
- language;
- checked_at;
- source_status;
- historical;
- legal_basis;
- allowed_claim_types;
- disallowed_claim_types;
- metadata_confidence;
- needs_manual_review.

### 6.5 Ebakindlad juhtumid

Kui süsteem pole kindel, peab ta määrama:

```json
{
  "metadata_confidence": "medium",
  "needs_manual_review": true
}
```

Näited, mis peaksid minema review’sse:

- hinnakirjad;
- voldikud;
- aegunud materjalid;
- sarnased dubleerivad PDF-id;
- failid, mille avaldaja või aasta pole selge;
- dokumendid, mis võivad sisaldada õigusinfot, kuid ei ole primaarne õigusallikas.

---

## 7. Lisadokumendid organisatsioonide juures

Organisatsiooni andmekorje puhul võib leida palju PDF-e.

Kõiki ei tohi automaatselt muuta eraldi RAG dokumentideks.

### 7.1 Organisatsiooni documents[] plokk

Organisatsiooni `<slug>.json` failis peaks olema `documents[]` plokk.

Näide:

```json
{
  "id": "astangu_doc_general_brochure",
  "title": "Astangu Keskuse üldvoldik 2024",
  "document_kind": "information_material",
  "source_format": "pdf",
  "source_url": "https://...",
  "evidence_role": "information_material",
  "document_status": "referenced_only",
  "metadata_file": null,
  "sourceKeys": ["general_brochure_pdf"]
}
```

### 7.2 Millal teha eraldi metadata fail?

Tee eraldi knowledge-doc metadata ainult siis, kui dokument on iseseisvalt RAG-is väärtuslik.

Näited:

- metoodiline abimaterjal;
- käsiraamat;
- juhend;
- uuring;
- koolitusmaterjal;
- oluline praktiline infomaterjal.

Ära tee eraldi metadata faili igale:

- väikesele reklaamvoldikule;
- dubleerivale PDF-ile;
- aegunud või ebaselgele failile;
- juhuslikule failile, mille sisu ei anna iseseisvat väärtust.

---

## 8. Claim-type ja tõenduspiirid

Igal allikal peab olema selge, mida ta võib vastuses tõendada.

### 8.1 Organisatsiooniallikas võib kinnitada

- organisatsiooni enda teenusekirjeldust;
- organisatsiooni enda kontakte;
- organisatsiooni enda juhendeid;
- praktilist või metoodilist taustateadmist;
- pöördumise või suunamise üldinfot.

### 8.2 Organisatsiooniallikas ei tohi kinnitada

- inimese seaduslikku õigust toetusele;
- KOV teenuse olemasolu;
- KOV toetuse summat;
- KOV taotlustähtaega;
- KOV ametlikku vormi;
- meditsiinilist diagnoosi või raviotsust;
- õiguslikku kohustust, kui allikas ei ole õigusakt.

### 8.3 Knowledge-doc võib kinnitada vastavalt tüübile

Juhend:

```text
practice_recommendation
methodology_background
professional_guidance
background
```

Uuring:

```text
research_evidence
policy_context
background
```

Infomaterjal:

```text
background
practical_guidance
information_material
```

Õigusakt või määrus:

```text
legal_basis
legal_obligation
legal_entitlement
```

Aga õigusaktide puhul peab olema eraldi legal layer. Juhend ei muutu legal_basis allikaks ainult sellepärast, et ta viitab seadusele.

---

## 9. Master-listi kasutamine andmekorjes

Andmekorjeagent peab enne uue allika lisamist kontrollima master-listi.

### 9.1 Kui allikas on juba olemas

Agent peab:

```text
- mitte looma uut dubleerivat source kirjet;
- kasutama existing_master_source_id;
- siduma allika uue paketiga sourceKeys kaudu;
- märkima vajadusel relation_context;
- mitte tegema uut metadata faili, kui olemasolev allikas on juba ingestitud või ingest_candidate.
```

### 9.2 Kui allikas on uus

Agent peab:

```text
- lisama source kandidaatkirjena;
- määrama source_type;
- määrama ingest_status;
- määrama ingest_priority;
- märkima new_candidate;
- tegema eraldi metadata ainult siis, kui allikas valitakse ingest_ready staatusesse.
```

### 9.3 URL normaliseerimine

Dubleeringute vältimiseks tuleb normaliseerida:

- http vs https;
- www vs ilma www;
- lõpus `/` või mitte;
- URL-encoded tähed;
- tracking query parameetrid;
- sama PDF erinevate failinimekujudega.

---

## 10. Soovitatavad ingest-staatused

```text
referenced_only
```

Allikas on teada ja võib olla viidatud, kuid seda ei ingestita veel.

```text
ingest_candidate
```

Allikas võib olla väärtuslik, kuid vajab ülevaatust.

```text
ingest_ready
```

Allika metadata on korras ja see võib minna ingest’i.

```text
ingested
```

Allika sisu on RAG-is.

```text
needs_review
```

Link, sisu, allikatüüp, kehtivus või metadata vajab ülevaatust.

```text
archived
```

Allikas või vana versioon on arhiivis.

```text
duplicate
```

Allikas on sama mis mõni teine kirje.

---

## 11. Soovitatavad moodulid adminis

### 11.1 Source Master

- kõik teadaolevad allikad;
- filtrid source_type, format, publisher, status, priority järgi;
- dedupe kontroll;
- “mark as ingest_ready”;
- “send to knowledge-doc metadata generator”;
- “send to organization collection agent”;
- “send to topic collection agent”.

### 11.2 KOV

- KOV paketid;
- KOV failid;
- KOV RAG status;
- RT/legal layer eraldi;
- SourcePackage audit.

### 11.3 Organizations

- organisatsiooni 4 tuumfaili;
- teenused, kontaktid, ressursid;
- lisadokumendid;
- remote URL materjalid;
- organisatsiooni profiili ingest ühe RAG dokumendina.

### 11.4 Knowledge Docs

- PDF/DOCX/HTML juhendid ja raportid;
- metadata generator;
- validator;
- chunking;
- ingest.

### 11.5 Topic Packs

- teemaportaalide korje;
- alamlehtede valik;
- teema allikaregister;
- teema RAG kokkuvõte.

### 11.6 Registries

- registri ja kataloogi tüüpi allikad;
- esialgu pigem referenced_only;
- hiljem connector/structured lookup.

### 11.7 Journal

- Sotsiaaltöö artiklid;
- erialased artiklid;
- taust/praktika/metoodika, mitte kehtiva õiguse tõend.

---

## 12. Näide: Astangu

Astangu puhul õige mudel:

```text
Astangu = organisatsioon / teenuseosutaja
Astangu veebilehed = organisatsiooni ametlik info
Astangu PDF-id = lisadokumendid / knowledge-doc kandidaadid
```

Organisatsiooni tuumfailid:

```text
astangu.sources.json
astangu.json
astangu.meta.json
astangu.rag.md
```

Lisamaterjalid `astangu.json` failis:

```text
referenced_only
ingest_candidate
needs_review
```

Eraldi knowledge-doc metadata tehakse ainult valitud dokumentidele, näiteks:

```text
astangu-indiverso.json
astangu-koostoolepe-rehabilitatsiooni-teenuse-osutamiseks.json
```

Organisatsiooni profiili ingest peab looma ühe RAG dokumendi:

```text
docId = organization-astangu
collection_id = organizations
legal_basis = false
```

PDF-id ei tohi minna automaatselt eraldi RAG dokumentideks ainult seetõttu, et nad on `documents[]` loendis.

---

## 13. Näide: ligipääsetavuse teemaportaal

URL:

```text
https://kompetentsikeskus.sm.ee/et/vordsed-voimalused/ligipaasetavus
```

Õige klassifikatsioon:

```text
source_type = topic_hub
resource_type = topic_index
collection_hint = accessibility_guidance
evidence_role = background
ingest_status = referenced_only
```

RAG-i jaoks korjata sisulised alamlehed, näiteks:

- mis on ligipääsetavus;
- lihtne keel;
- veebi ligipääsetavus;
- universaalne disain;
- liikumispuue;
- kuulmispuue;
- nägemispuue;
- ligipääsetav füüsiline keskkond;
- ligipääsetav kommunikatsioon;
- ligipääsetav sündmus.

Need võivad minna:

```text
HTML knowledge-doc’idena
```

või:

```text
ligipaasetavus teemapaketina
```

Õigusaktide ülevaatelehti tuleb käsitleda taustana, mitte primaarse legal_basis allikana. Täpne kehtiv õigus peab tulema Riigi Teatajast või EL õigusakti tekstist.

---

## 14. Arenduse soovitatud järjekord

Ära ehita kõike korraga.

Soovitatav järjekord:

```text
1. KOV moodul lõpuni korda.
2. Organisatsioonide moodul Astangu peal production-kõlbulikuks.
3. Knowledge-doc metadata generator PDF/DOCX/HTML jaoks.
4. Source Master adminivaade ja dedupe workflow.
5. Teemapaketi moodul ligipääsetavuse näitel.
6. Registrid jätta esialgu referenced_only kihiks.
7. Hiljem lisada registry connectorid.
```

---

## 15. Codexile selgitatav arendusülesanne

Kui seda dokumenti kasutada Codexile taustana, siis põhisõnum on:

```text
SotsiaalAI RAG ei ole üks üldine dokumendilaadija.

Süsteem peab eristama:
- source master ehk allikaregister;
- KOV paketid;
- organisatsiooniprofiilid;
- knowledge-doc dokumendid;
- teemapaketid;
- registrid;
- ajakirjaartiklid.

PDF/DOCX dokumendid võivad minna otse RAG-i chunkidena, kui metadata on korras.
Organisatsiooni veebilehed vajavad andmekorjeagenti ja 4 tuumfaili.
Teemaportaalid vajavad teemapaketi või HTML knowledge-doc korjet.
Registrid ei ole tavalised RAG tekstidokumendid.
```

---

## 16. Kontrollküsimused enne allika ingestimist

Enne kui allikas RAG-i läheb, küsi:

1. Mis tüüpi allikas see on?
2. Kas see on organisatsioon, PDF, teemaportaal, register või KOV?
3. Kas metadata on olemas?
4. Kas `source_type`, `collection_id` ja `evidence_role` on õiged?
5. Kas allikas võib kinnitada neid väiteid, mida assistent sellest kasutaks?
6. Kas allikas on aktiivne ja ajakohane?
7. Kas see on juba master-listis olemas?
8. Kas see on duplikaat?
9. Kas see peab olema `referenced_only`, `ingest_candidate` või `ingest_ready`?
10. Kas kasutajale nähtavad allikad saavad hiljem päriselt vastuse sisulist tuge pakkuda?

---

## 17. Lühikokkuvõte

Master-list on kaart. RAG-teadmuskorpus on sisu.

```text
Master-list → mida meil on
Metadata → mis tüüpi allikas see on
Andmekorjeagent → struktureerib veebilehed ja teemaportaalid
Parser → võtab PDF/DOCX/HTML sisu välja
Validator → kontrollib metadata ja tõenduspiire
RAG ingest → paneb kinnitatud sisu teadmuskorpusesse
```

Õige tööjaotus:

```text
KOV → KOV moodul
Organisatsioon → 4 tuumfaili
PDF/DOCX → knowledge-doc metadata + chunk ingest
Teemaportaal → teemapakett või HTML knowledge-doc’id
Register → registry/reference moodul
Ajakiri → journal moodul
```

Kõige olulisem arenduspõhimõte:

```text
Ära ingesti kõike ühtemoodi.
Allika tüüp määrab metadata, tõendusrolli, ingest-raja ja selle, kuidas assistent võib seda vastustes kasutada.
```
