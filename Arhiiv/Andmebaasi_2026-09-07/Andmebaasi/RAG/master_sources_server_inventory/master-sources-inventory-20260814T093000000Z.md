# Master-listi P8.0 inventuur

- Kontrolliaeg: `2026-08-14T09:30:00.000Z`
- Registri SHA-256: `3ef352d684474218a58806f799d8a0f2f8addd088d2dbe9e88973fd59eabc0d6`
- Registrikirjeid: **323**
- RAG-dokumente sisendis: **5819**
- URL-i järgi kattuvaid kirjeid: **167**
- Tõendatud source_id/document_id seoseid: **167**
- Adopteerimist vajavaid: **167**
- Puuduliku või tundmatu värskusega: **0**
- Puudu: **156**
- P8.0-s tõendatult valmis: **0**

## Seisundid

| Seisund | Arv |
|---|---:|
| `covered_ok` | 0 |
| `covered_by_other_pipeline` | 0 |
| `needs_content_check` | 0 |
| `needs_adoption` | 167 |
| `incomplete` | 0 |
| `stale_match` | 0 |
| `redirected` | 0 |
| `duplicate_content` | 0 |
| `missing` | 156 |
| `invalid_url` | 0 |

## URL- ja inventuurianomaaliad

| Anomaalia | Kirjeid |
|---|---:|
| `legacy_decodes_reserved_percent_encoding` | 11 |
| `legacy_identity_not_network_serialization` | 71 |
| `legacy_trailing_slash_removed` | 19 |
| `rag_match_missing_source_master_identity` | 167 |
| `registry_identity_differs_from_network_key` | 186 |
| `trailing_slash_alias_in_comparison_key` | 19 |
| `www_alias_in_comparison_key` | 147 |

## Mida P8.0 ei tõenda

- P8.0 does not fetch source websites, so URL matches cannot prove current source completeness.
- P8.0 does not ingest, patch or delete RAG documents.
- A missing or stale last_checked value prevents a ready/covered_ok conclusion.
- content_hash is reported as evidence only; legacy master PDF hashes may be identity hashes rather than content hashes.
- P8.0 deliberately keeps covered_ok at zero because it has no independently verified content-completeness evidence.
