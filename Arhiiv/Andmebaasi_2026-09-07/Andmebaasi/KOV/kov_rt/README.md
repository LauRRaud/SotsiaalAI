# KOV RT manifest for Codex / automated ingest

## Purpose

This package gives the system a clean, machine-readable manifest for KOV RT/legal layer ingest.

Use `kov_rt_manifest.json` as the primary source. The local `.xml` files are the current RT source snapshots used for reproducible ingest and update checks.

## Important architecture rule

RT/legal layer is separate from the KOV web package.

- KOV web docId: `kov-<slug>`
- RT docId: `kov-rt-<slug>`
- RT collection: `kov_legal`
- RT source_type: `kov_regulation`
- RT source_format: `xml`
- RT legal_basis: `true`
- Manual `.rt.meta.json` is not required.

## What the ingest script should do

For each entry with `auto_ingest=true`:

1. Locate local XML:
   - `<kov-folder>/<act_reference>.xml`
   - or `<kov-folder>/rt/<act_reference>.xml`
2. Generate RT metadata from `generated_metadata`.
3. Send RT XML content to RAG as separate document:
   - `docId = kov-rt-<slug>`
4. Do not modify the KOV web package metadata.
5. If XML is missing, mark RT ingest as skipped and do not fail KOV web ingest.

## Ambiguity rule

If multiple XML files exist and none matches manifest `xml_file`, do not choose randomly. Mark `needs_review`.

## Summary

- Entries: 78
- auto_ingest=true: 76
- needs_review: 2
