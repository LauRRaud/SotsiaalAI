# Praeguste metaandmete näited

Serverist loetud: 2026-09-05T09:23:59.079935+00:00. Allikas: `/var/lib/sotsiaalai-rag/registry.json`. Registris oli 6089 kirjet. Need on failides tegelikult salvestatud väärtused; allikate praegust sisulist kehtivust veebist ei kontrollitud. PostgreSQL-i ega vektorandmebaasi ei päritud.

## Kust andmed tulid

- `*.registry.json`: kaheksa täielikku kirjet serveri RAG-registrist. Ümbris `example / registry_key / metadata` lisati ekspordiks; algne registrikirje on muutmata `metadata` all.
- `ajakiri.algfail.json`, `riigi-juhend.algfail.json`, `organisatsioon.algfail.meta.json`: kohaliku põhikausta algsed JSON-failid, kopeeritud muutmata.
- `kov-alutaguse.algfail.meta.json`: serverisse üles laaditud Alutaguse KOV-paketi algne metafail. Serveritee: `/var/lib/sotsiaalai/documents/kov/alutaguse-vald/8e23e109-06a4-4db2-9d49-945e049d2b9f.json`.
- `serveri-registri-naited.json`: kõik kaheksa näidet koos registri kirjete arvu, tüüpide jaotuse, lugemisaja ja lähtefaili kontrollsummaga.

## Näited ja väljad

| Näide | Pealkiri | Allikatüüp | Täielik kirje |
| --- | --- | --- | --- |
| ajakiri | Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid | `journal_article` | [JSON](ajakiri.registry.json) |
| kov-maarus | Sotsiaalhoolekandelise abi andmise kord Jõgeva vallas | `kov_regulation` | [JSON](kov-maarus.registry.json) |
| kov-teenus | Jõgeva vald sotsiaalteenused ja toetused | `kov_service_info` | [JSON](kov-teenus.registry.json) |
| kov-kontakt | Aime Meltsas | `official_contact` | [JSON](kov-kontakt.registry.json) |
| kov-vorm | Eestkostetoetuse taotlus | `application_form` | [JSON](kov-vorm.registry.json) |
| riigi-juhend | Terviseprobleemiga laste ja nende perede toetamise hea tava | `official_guideline` | [JSON](riigi-juhend.registry.json) |
| organisatsioon | Astangu Kutserehabilitatsiooni Keskus | `organization_profile` | [JSON](organisatsioon.registry.json) |
| uuring | Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte | `research_report` | [JSON](uuring.registry.json) |

### ajakiri

Valitud väljad täielikust registrikirjest:

```json
{
  "docId": "sotsiaaltoo-2-2025-tehisintellekt-sotsiaaltoos-praktika-kaalutlused-ja-vaartuspohised-piirid-2025-2",
  "title": "Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid",
  "source_type": "journal_article",
  "collection_id": "sotsiaaltoo_articles",
  "year": 2025,
  "authors": [
    "Laur Raudsoo"
  ],
  "journalTitle": "Sotsiaaltöö",
  "issueLabel": "2/2025",
  "articleId": "tehisintellekt-sotsiaaltoos-praktika-kaalutlused-ja-vaartuspohised-piirid-2025-2",
  "pageRange": "1–13",
  "jurisdiction_level": "UNKNOWN",
  "last_checked": "2026-04-26",
  "source_status": "active",
  "historical": true,
  "lastIngested": "2026-08-21T23:36:27.022560+00:00"
}
```

### kov-maarus

Valitud väljad täielikust registrikirjest:

```json
{
  "docId": "kov-rt-jogeva-vald",
  "title": "Sotsiaalhoolekandelise abi andmise kord Jõgeva vallas",
  "source_type": "kov_regulation",
  "collection_id": "kov_legal",
  "authors": [],
  "municipality_name": "Jõgeva vald",
  "municipality_id": "jogeva_vald",
  "jurisdiction_level": "MUNICIPALITY",
  "issuer": "Jõgeva Vallavolikogu",
  "canonical_source_id": "riigiteataja:406112024020",
  "effective_start": "2025-01-01",
  "is_current_version": true,
  "checked_at": "2026-05-01",
  "lastIngested": "2026-05-01T16:39:11.160003+00:00"
}
```

### kov-teenus

Valitud väljad täielikust registrikirjest:

```json
{
  "docId": "kov::jogeva-vald::bundle",
  "title": "Jõgeva vald sotsiaalteenused ja toetused",
  "source_type": "kov_service_info",
  "collection_id": "kov_services",
  "authors": [],
  "municipality_name": "Jõgeva vald",
  "municipality_id": "jogeva_vald",
  "jurisdiction_level": "MUNICIPALITY",
  "resource_type": "municipality_service_package",
  "checked_at": "2026-04-11",
  "lastIngested": "2026-05-20T06:05:43.889280+00:00"
}
```

### kov-kontakt

Valitud väljad täielikust registrikirjest:

```json
{
  "docId": "kov::jogeva-vald::item::jogeva_vald_contact_aime_meltsas",
  "title": "Aime Meltsas",
  "source_type": "official_contact",
  "collection_id": "kov_services",
  "authors": [],
  "municipality_name": "Jõgeva vald",
  "municipality_id": "jogeva_vald",
  "jurisdiction_level": "MUNICIPALITY",
  "resource_type": "contact",
  "checked_at": "2026-04-11",
  "lastIngested": "2026-05-20T06:05:57.251364+00:00"
}
```

### kov-vorm

Valitud väljad täielikust registrikirjest:

```json
{
  "docId": "kov::jogeva-vald::item::jogeva_vald_form_eestkostetoetuse_taotlus",
  "title": "Eestkostetoetuse taotlus",
  "source_type": "application_form",
  "collection_id": "kov_services",
  "authors": [],
  "municipality_name": "Jõgeva vald",
  "municipality_id": "jogeva_vald",
  "jurisdiction_level": "MUNICIPALITY",
  "resource_type": "form",
  "checked_at": "2026-04-11",
  "lastIngested": "2026-05-20T06:06:02.946926+00:00"
}
```

### riigi-juhend

Valitud väljad täielikust registrikirjest:

```json
{
  "docId": "sm-terviseprobleemiga-laste-perede-hea-tava-2025",
  "title": "Terviseprobleemiga laste ja nende perede toetamise hea tava",
  "source_type": "official_guideline",
  "collection_id": "national_guidelines",
  "year": 2025,
  "authors": [],
  "pageRange": "1–64",
  "jurisdiction_level": "NATIONAL",
  "source_status": "active",
  "historical": false,
  "lastIngested": "2026-05-03T11:44:10.115274+00:00"
}
```

### organisatsioon

Valitud väljad täielikust registrikirjest:

```json
{
  "docId": "organization-astangu",
  "title": "Astangu Kutserehabilitatsiooni Keskus",
  "source_type": "organization_profile",
  "collection_id": "organizations",
  "authors": [],
  "jurisdiction_level": "UNKNOWN",
  "resource_type": "organization_profile",
  "checked_at": "2026-04-29",
  "lastIngested": "2026-05-03T12:39:34.414702+00:00"
}
```

### uuring

Valitud väljad täielikust registrikirjest:

```json
{
  "docId": "epikoda-taisealiste-psuuhikahairega-eestkostetavate-uuring-2026",
  "title": "Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte",
  "source_type": "research_report",
  "collection_id": "research_reports",
  "year": 2026,
  "authors": [
    "Kristi Rekand",
    "Kristi Kähär",
    "Tauno Asuja"
  ],
  "pageRange": "1–75",
  "jurisdiction_level": "NATIONAL",
  "source_status": "active",
  "historical": false,
  "lastIngested": "2026-06-11T02:09:25.380285+00:00"
}
```

## Algfaili ja registri erinevus

Võrdlus näitab ainult nende kahe JSON-kihi välju. Puudumine registrist ei tõenda, et sama info puudus indeksi lõikudest või muudest andmekihtidest.

**ajakiri:** algfailis on 24 ja registrikirjes 51 ülataseme välja. Algfaili väljad, mida registris sama nimega ei ole: `pdf_start_page`, `pdf_end_page`, `source_path`.

**riigi-juhend:** algfailis on 44 ja registrikirjes 48 ülataseme välja. Algfaili väljad, mida registris sama nimega ei ole: `schemaVersion`, `canonical_source_id`, `publisher`, `source_organization`, `publisher_type`, `authority_level`, `contributors`, `publication_date`, `checked_at`, `document_kind`, `resource_type`, `source_origin_type`, `source_format`, `sector`, `domain`, `audiences`, `secondary_audiences`, `evidence_role`, `allowed_claim_types`, `disallowed_claim_types`, `topics`, `target_groups`, `conditions_or_target_groups`, `source_path`, `source_url`, `copyright_status`, `display_full_text`, `allow_excerpts`, `ingest`, `quality`, `sectionIndex`.

KOV-i algne metafail kirjeldab terve paketi katvust, allikate arvu, kontrolliaega, hoiatusi ja valmisolekut. Registris on selle kõrval eraldi teenuse-, kontakti-, vormi- ja määrusekirjed. Organisatsiooni algne metafail kirjeldab samuti paketi valmisolekut; `organization-astangu` registrikirje kirjeldab indekseeritud organisatsiooniprofiili.

Välju `checkedAt`, `checked_at`, `last_checked` ja `lastIngested` tuleb eristada: allika kontroll ja indekseerimise aeg pole sama sündmus. Registri `active` või `is_current_version` on salvestatud märge, mitte tänase kehtivuse uus kinnitus.
