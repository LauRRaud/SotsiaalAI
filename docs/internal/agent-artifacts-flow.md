# Agent Outputs Implementation Contract

> Status: historical document.
>
> This file describes the earlier agent-artifact contract and parts of it are no
> longer the source of truth for the current implementation.
>
> The current architecture is documented in `docs/assistant-agent-RAG-overview.md`.
> In particular, the current agent implementation is retrieval-first and uses
> the Python RAG service for indexing and retrieval of selected user documents.
> It also predates the current plain-language mode-confirmation layer in the
> main `/vestlus` chat.

## Current implementation overlay

The current code adds a chat-native document workflow on top of the older
artifact model:

- `/vestlus` can now create document drafts through a locked slot-filling flow
  after one plain-language confirmation
- chat-session file uploads are attached through the composer paperclip and are
  scoped only to the active chat document flow
- chat document flow does not inherit `agentAllowed` selections from
  `/documents` or `/dokreziim`
- role-based file limits in chat:
  - `CLIENT`: `2`
  - `SOCIAL_WORKER`: `10`

Current result surfaces are role-based even though persistence stays in the same
`AgentArtifact` model:

- `SOCIAL_WORKER`
  - sees chat-generated drafts under `/documents` results and artifact detail
    pages
- `CLIENT`
  - sees chat-generated drafts in `/dokreziim`

Current download rule:

- `DRAFT`
  - visible in chat and in result surfaces
  - not downloadable
- `FINAL`
  - exposes DOCX and PDF download URLs

Current list/detail payload rule:

- artifact list endpoints return lightweight rows by default
- full `content` is fetched on demand from the artifact detail route when the UI
  needs copy or full-detail actions
- this keeps `/documents` and `/dokreziim` result lists lighter while keeping
  detail behavior unchanged

## Assumptions

- Export storage approach: `Approach A`
  - Approved artifacts stay in PostgreSQL as the source of truth.
  - DOCX and PDF files are rendered on-demand from approved content.
  - `AGENT_STORAGE_DIR` remains reserved for future snapshot-based exports.
- Supported user upload types remain `pdf`, `docx`, and `txt`.
- Download formats in this phase:
  - `DOCX` is implemented now.
  - `PDF` is implemented now.
- Multi-document report limits:
  - maximum selected source documents per draft: `10`
  - maximum draft content length accepted by API: `120000` characters
- Template support in this phase:
  - template selection is stored on `AgentArtifact.templateId`
  - only `DOCX` templates are usable for export
  - template filling is placeholder-based, not a general DOCX automation engine
  - supported placeholders:
    - `{{TITLE}}`
    - `{{APPROVED_AT}}`
    - `{{ARTIFACT_TYPE}}`
    - `{{CONTENT_BLOCK}}`
    - `{{SOURCES_BLOCK}}`
  - placeholders are matched in `word/document.xml`
  - common Word run/text splits for these placeholders are normalized before replacement
  - arbitrary complex template logic is still out of scope; this is not a general DOCX automation engine
  - if a selected template cannot be processed, export falls back to the standard SotsiaalAI DOCX template so approval always remains downloadable

## Historical Out of Scope

The items below reflect the earlier implementation contract, not the current
live behavior.

- no OCR
- no RAG indexing or retrieval over uploaded documents
- no coupling with the separate `Document analysis` mode
- no room-scoped documents
- no ACL-based sharing
- access remains owner-based through `ownerId`

## Flow

- `UserDocument` remains the input model for uploaded user files.
- `AgentArtifact` remains the output model for generated work artifacts.
- `Document analysis` remains fully separate and does not share storage or persistence logic with this feature.

### Draft to final

1. A work-mode draft is created as `AgentArtifact.status = DRAFT`.
2. The draft is stored immediately in PostgreSQL together with:
   - `type`
   - `title`
   - `content`
   - optional `templateId`
   - linked source documents
3. While status is `DRAFT`, the user may:
   - edit content manually
   - rename the draft
   - use a refine stub in the UI
   - view the full draft immediately in chat if it was generated from
     `/vestlus`
4. When the user approves the draft:
   - status becomes `FINAL`
   - `approvedAt` is stored
   - content becomes immutable
   - the API returns stable DOCX and PDF download URLs immediately
5. Download is a representation of the approved artifact, never the only copy.

## Data model

### UserDocument

- `id`
- `ownerId`
- `title`
- `originalName`
- `kind`
- `templateFor`
- `agentAllowed`
- `mime`
- `size`
- `sha256`
- `storagePath`
- `createdAt`
- `updatedAt`

### AgentArtifact

- `id`
- `ownerId`
- `type`
- `title`
- `status: DRAFT | FINAL`
- `content`
- `approvedAt`
- `templateId` nullable
- `createdAt`
- `updatedAt`

### AgentArtifactSourceDocument

- `artifactId`
- `documentId`

This join table is the traceability layer for multi-document reports.

## UX guarantees

- Approve returns an immediate success payload with stable DOCX and PDF download URLs.
- The artifact detail page shows an approval notice with a direct download action right away.
- The approved artifact remains re-downloadable later from:
  - `/documents`
  - `/documents/artifacts/[id]`
  - optional download action in the artifacts list row
- Re-download works after refresh or a later login because the approved text persists in PostgreSQL.

## Security

- All document and artifact endpoints require server-side auth.
- All object access uses `ownerId` checks.
- `storagePath` never leaves the server.
- Downloads use sanitized filenames only.
- Agent workflows may only use documents where `agentAllowed = true`.
- Mutating and download endpoints are rate-limited server-side.
- Audit events are persisted in the `DocumentAudit` table.
- Structured server logs remain as a fallback diagnostic layer if audit persistence fails.
