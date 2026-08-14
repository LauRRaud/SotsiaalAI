# RAG Server Repair and Local Database Consolidation Implementation Plan

> **For Codex:** Execute this plan in order. Do not push, deploy application code, or commit. Server deletion is allowed only after the retained document has been proved usable.

**Goal:** Repair confirmed broken RAG documents on the server, remove only byte-proven duplicate source records, and consolidate all local RAG/source material under one ignored `docs/Andmebaas` folder without losing unique files.

**Architecture:** Treat the live RAG registry as operational data and the local folders as an offline source archive. On the server, create OCR-searchable derivatives for image-only PDFs, verify document/chunk/search behavior, and then delete only duplicate IDs whose retained and removed source PDFs have identical SHA-256 hashes. Locally, move complete source trees into a single root, deduplicate by SHA-256, preserve a manifest, and update local utilities to the new paths.

**Tech Stack:** PowerShell, Node.js, Python, Tesseract OCR, Poppler, FastAPI RAG API, Chroma registry, JSON/CSV/Markdown reports.

---

### Task 1: Freeze the baseline and prepare rollback evidence

**Files:**
- Create: `docs/Andmebaas/RAG/server_repair_2026-08-14/baseline.json`
- Create: `docs/Andmebaas/RAG/server_repair_2026-08-14/README.md`

**Step 1: Record the current server document count and service health**

Run the authenticated registry checks without printing the API key. Record the server commit, service state, registry document count, chunk count for the seven broken IDs, and both sides of the five duplicate pairs.

**Step 2: Back up affected source files and public metadata**

Download the twelve retained/affected source PDFs and the five duplicate source PDFs to the maintenance folder. Save `/documents/{id}` and `/documents/{id}/chunks` responses so every operational change is reversible.

**Step 3: Verify the backup**

Require every PDF to start with `%PDF-`, save SHA-256 and size, and require every JSON file to parse.

### Task 2: OCR and repair the seven zero-chunk PDFs

**Files:**
- Create: `docs/Andmebaas/RAG/server_repair_2026-08-14/ocr/`
- Create: `docs/Andmebaas/RAG/server_repair_2026-08-14/repair-results.json`

**Step 1: Prove the old behavior**

For all seven canonical IDs, require `chunks = 0` and prove that `pypdf` extracts zero text characters. Stop if either assumption differs.

**Step 2: Build OCR-searchable PDFs**

Render pages with Poppler, OCR with the document language (`est`, `eng`, `fin`, `rus`, or `ukr`), and combine the page PDFs. Keep the original PDF in the baseline backup.

**Step 3: Validate OCR output before ingestion**

Require `%PDF-`, at least one page, at least 100 extracted text characters, and a nonempty OCR text sample hash. Do not ingest a failed derivative.

**Step 4: Ingest under the canonical document ID**

Use metadata derived from the source master and upload each OCR PDF to `/ingest/pdf-with-metadata`. Process one document at a time.

**Step 5: Verify each repair immediately**

Require HTTP success, `chunks > 0`, nonempty chunk text, canonical metadata, and a filtered search result for distinctive OCR text. If any check fails, restore the original document from the backup and stop before deleting duplicates.

### Task 3: Remove five byte-proven duplicate server IDs

**Files:**
- Modify: `docs/Andmebaas/RAG/server_repair_2026-08-14/repair-results.json`

**Step 1: Recheck duplicate proof**

For every pair, require identical source SHA-256 and size. Require the retained ID to have chunks; for the Estonian crisis-centre pair, require the canonical OCR repair from Task 2 first.

**Step 2: Delete only the noncanonical ID**

Delete the five hyphenated legacy IDs through `DELETE /documents/{doc_id}` one at a time.

**Step 3: Verify after each deletion**

The versioned delete contract intentionally keeps an audit tombstone. Require the removed ID to return `status = DELETED`, zero chunks, and 404 from its source endpoint; require the retained ID to return 200 with the expected positive chunk count. Record the response and timestamp.

### Task 4: Consolidate the local archive under `docs/Andmebaas`

**Files:**
- Move: `docs/Andmebaasi/**` → `docs/Andmebaas/**`
- Move: `docs/ajakiri_sotsiaaltoo/**` → `docs/Andmebaas/ajakiri_sotsiaaltoo/**`
- Move: `docs/KOV/**` → `docs/Andmebaas/KOV/**`
- Move: `docs/Seadused_rt/**` → `docs/Andmebaas/Seadused_rt/**`
- Move: `docs/RAG andmebaas/**` → `docs/Andmebaas/RAG/**`
- Create: `docs/Andmebaas/local-file-manifest.json`

**Step 1: Build a pre-move hash manifest**

Record every source path, relative path, size, SHA-256, and duplicate group. Prove that every planned source resolves below `C:\Users\rauds\Desktop\SotsiaalAI\docs` and that the destination resolves to `C:\Users\rauds\Desktop\SotsiaalAI\docs\Andmebaas`.

**Step 2: Move complete source trees without overwriting**

Preserve `ajakiri_sotsiaaltoo`, `KOV`, and `Seadused_rt` as named collections. Rename `RAG andmebaas` to `RAG`, and rename the old master package folder to `allikaregister`. Preserve unique organization and research material.

**Step 3: Deduplicate by content hash**

For identical hashes, retain one canonical file in the most complete collection. Remove only the redundant copy after checking size and hash again. Move unique legacy metadata into the matching collection or `lisamaterjalid`; remove obsolete `ajakiri` and `lisatest` directories only after they are empty.

**Step 4: Verify the post-move manifest**

Require every unique source-material hash to occur at least once after the move. Permit only two documented classes of changed pre-move hashes: regenerated reports and transport archives removed after verified extraction. Require no unexpected missing hash, no old source root, and no `.part` file.

### Task 5: Update local utility paths and ignore the archive

**Files:**
- Modify: `.gitignore`
- Modify: `scripts/lib/source-master-pdf-download.mjs`
- Modify: `scripts/compare-rag-server-local.mjs`
- Modify: `scripts/build-rag-gap-report.mjs`
- Modify: `tests/scripts/downloadSourceMasterPdfs.test.js`

**Step 1: Add the ignore rule**

Add the root-anchored rule `/docs/Andmebaas/` so no local source files or maintenance backups are uploaded to Git.

**Step 2: Update utility defaults**

Point source-master, download, server export, comparison, and gap-report defaults at `docs/Andmebaas` while leaving production/server ingestion defaults unchanged.

**Step 3: Run targeted checks**

Run the downloader tests, syntax checks for the comparison and gap scripts, scoped ESLint, and `git diff --check`.

### Task 6: Final server and local verification

**Files:**
- Create: `docs/Andmebaas/RAG/server_repair_2026-08-14/final-summary.json`

**Step 1: Re-export the server inventory**

Require the RAG service active, seven formerly empty canonical IDs with positive chunks, five legacy duplicate IDs absent, and all other registry documents unchanged except for the expected net document-count change.

**Step 2: Rebuild local comparison reports**

Run the server/local comparison and missing/broken report from their new paths. Record remaining missing files and `NOT_PROVEN` identity/freshness fields honestly.

**Step 3: Confirm Git protection and scope**

Run `git check-ignore -v docs/Andmebaas/local-file-manifest.json`, inspect `git status --short`, and confirm no unrelated user changes were modified. Do not stage, commit, push, or deploy.
