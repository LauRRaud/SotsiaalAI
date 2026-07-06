# SotsiaalAI Source Master Registry – final package

**Versioon:** final  
**Kuupäev:** 2026-04-29

## Eesmärk

See pakk on SotsiaalAI keskne **allikaregister**. See ei ole lõppkasutajale nähtav teadmuskorpus. Registri eesmärk on:

- vältida dubleerimist;
- anda andmekorjeagentidele teadaolevate allikate alus;
- eristada organisatsioone, PDF-e, juhendeid, uuringuid, teemaportaale, registreid ja artikleid;
- planeerida, millised allikad liiguvad hiljem RAG ingest’i.

## Põhifailid

- `master_sources_final.json` – masinloetav lõplik allikaregister.
- `master_sources_final.tsv` – tabeliversioon Exceli/Sheetsi jaoks.
- `sotsiaalai_masterlist_puhastatud.final.meta.json` – registripaki metadata.
- `master_sources_final_validation_report.json` – kontrolliraport.
- `master_sources_agent_rules_final.md` – andmekorjeagendi reeglid.
- `sotsiaalai_rag_masterlist_andmekorje_selgitus.md` – pikem arhitektuuri- ja töövooselgitus.

## Kokkuvõte

- Sisendkirjeid: 398
- Unikaalseid allikaid: 323
- Ühendatud duplikaate: 75
- HTML/veebilehti: 143
- PDF-e: 180

## Oluline põhimõte

```text
Master-list = kaart
RAG teadmuskorpus = sisu
```

Master-listi ei tohi käsitleda kasutajale nähtava sisulise allikana. Lõppkasutajale kasulik sisu tekib alles siis, kui konkreetne allikas läbib sobiva töövoo:

```text
organisatsioon → 4 tuumfaili
PDF/DOCX → knowledge-doc metadata + parser/chunk ingest
teemaportaal → teemapakett või HTML knowledge-doc’id
register → registry/reference kiht
KOV → KOV SourcePackage moodul
ajakirjaartikkel → journal layer
```

## Kasutus andmekorjes

Andmekorjeagent peab enne uue allika lisamist kontrollima `master_sources_final.json` registrit `normalized_url` järgi.

Kui URL on olemas:

- kasuta olemasolevat `source_id`;
- ära loo uut dubleeritud allikat;
- seo allikas vajadusel uue organisatsiooni, teemapaketi või knowledge-doc töövooga.

Kui URL puudub:

- lisa uus allikakandidaat;
- määra tüüp ja ingest-staatus;
- ära märgi seda automaatselt ingest-ready, kui metadata või tõendusroll pole kindel.

## Soovitatud ingest-staatused

- `referenced_only` – teadaolev allikas, ei lähe veel RAG-i.
- `ingest_candidate` – potentsiaalselt väärtuslik, vajab ülevaatust.
- `ingest_ready` – metadata korras, sobib ingestiks.
- `ingested` – sisu on RAG-is.
- `needs_review` – vajab käsitsi kontrolli.
- `duplicate` – sama allikas on juba olemas.

## Codexile oluline

RAG-süsteemi arenduses ei tohiks teha ühte üldist “lae kõik lingid sisse” töövoogu. Allika tüüp määrab ingest-raja:

- PDF/DOCX võib minna chunkidena RAG-i, kui metadata on korras.
- Organisatsiooni koduleht vajab andmekorjeagenti ja 4 tuumfaili.
- Teemaportaal vajab alamlehtede korjet.
- Register ei ole tavaline RAG tekstidokument.
- Master-list on dedupe ja ingest-planeerimise alus, mitte lõppkasutaja teadmussisu.
