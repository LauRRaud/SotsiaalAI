"use client";

import { useRef } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ORGANIZATION_CORE_FILE_KEYS, ORGANIZATION_FILE_ROLE_META } from "@/lib/admin/rag/organizations/shared";

import RagAdminAlert from "./RagAdminAlert";
import { formatDateTime } from "./ragAdminShared";
import { useOrganizationAdminController } from "./organizations/useOrganizationAdminController";

const TYPE_LABELS = {
  ASSOCIATION: "MTU / uhendus",
  FOUNDATION: "Sihtasutus",
  SERVICE_PROVIDER: "Teenuseosutaja",
  PARTNER: "Partner",
  THEMATIC_SITE: "Teemaveeb",
  PUBLIC_BODY: "Avalik asutus"
};

function ragDocStatusLabel(doc, et) {
  if (doc?.error) return et ? "Viga" : "Error";
  if (doc?.notIngested) return et ? "Pole ingestitud" : "Not ingested";
  if (doc?.exists && Number(doc?.chunks || 0) > 0) return et ? "Leitud" : "Found";
  if (doc?.exists) return et ? "Registris, 0 chunki" : "In registry, 0 chunks";
  return et ? "Puudub" : "Missing";
}

function readinessLabel(value, et) {
  if (value === "READY") return et ? "Valmis jargmiseks sammuks" : "Ready for next step";
  if (value === "REVIEW") return et ? "Vajab ulevaatust" : "Needs review";
  return et ? "Planeeritud" : "Planned";
}

function packageLabel(value, et) {
  if (value === "READY") return et ? "Pakett valmis" : "Package ready";
  if (value === "FILES_READY") return et ? "Failid koos" : "Files complete";
  if (value === "INVALID") return et ? "Vigased failid" : "Invalid files";
  if (value === "PARTIAL") return et ? "Osaline pakett" : "Partial package";
  return et ? "Tuumfailid puudu" : "Core files missing";
}

function ingestLabel(value, et) {
  if (value === "READY") return et ? "Ingestiks valmis" : "Ready";
  if (value === "INGESTING") return et ? "Ingest kaib" : "Ingesting";
  if (value === "INGESTED") return et ? "Ingestitud" : "Ingested";
  if (value === "ERROR") return et ? "Ingesti viga" : "Error";
  return et ? "Pole ingestitud" : "Not ingested";
}

function validationLabel(value, et) {
  if (value === "VALID") return et ? "valid" : "valid";
  if (value === "INVALID") return et ? "vigane" : "invalid";
  return et ? "puudub" : "missing";
}

function isFocusedFile(remediationFocus, fileKey) {
  if (!remediationFocus || !fileKey) return false;
  return remediationFocus.fileKey === fileKey || remediationFocus.focus === fileKey;
}

export default function RagAdminOrganizationsView({ locale, initialItems = [] }) {
  const controller = useOrganizationAdminController(locale, initialItems);
  const {
    et,
    query,
    setQuery,
    type,
    setType,
    activity,
    setActivity,
    examplePlaceholderCount,
    showExamplePlaceholders,
    setShowExamplePlaceholders,
    typeOptions,
    filteredItems,
    setSelectedSlug,
    selectedSlugs,
    toggleSelected,
    toggleSelectAllFiltered,
    selectedEntry,
    detailDraft,
    updateDraft,
    editing,
    saveBusy,
    fileBusyKey,
    revalidateBusySlug,
    ingestBusySlug,
    bulkIngestBusy,
    saveDetail,
    message,
    setMessage,
    ragStatus,
    ragStatusLoading,
    remediationFocus,
    refreshSelectedRagStatus,
    resetFilters,
    applyQuickReadiness,
    uploadFile,
    removeFile,
    revalidateSingle,
    ingestSingle,
    ingestSelected
  } = controller;

  const attachmentInputRef = useRef(null);
  const attachmentsFocused = isFocusedFile(remediationFocus, "attachment");
  const focusHint = remediationFocus?.fileKey
    ? `${et ? "Fail" : "File"}: ${ORGANIZATION_FILE_ROLE_META[remediationFocus.fileKey]?.label || remediationFocus.fileKey}`
    : remediationFocus?.focus || "";

  return (
    <div className="ra-shell-flow">
      <RagAdminAlert message={message} onDismiss={() => setMessage(null)} />

      <div className="ra-note">
        <strong>{et ? "Ettevalmistuskiht." : "Preparation layer."}</strong>{" "}
        {et
          ? "Organisatsioonide RAG haldus on vanem paketipohine toovoog. KOV, RT ja knowledge-doc kihid on sellest eraldi ning see vaade ei tohiks naidata naidisridu pariselt ingestitud allikatena."
          : "Organization RAG admin is an older package-based workflow. KOV, RT, and knowledge-doc layers are separate, and this view must not present example rows as real ingested sources."}
      </div>

      <div className="ra-card">
        <div className="ra-toolbar">
          <div className="ra-toolbar-search">
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={et ? "Otsi nime, fookuse voi marksona jargi" : "Search by name, focus, or keyword"}
              size="sm"
            />
          </div>
          <select value={type} onChange={event => setType(event.target.value)}>
            {typeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {TYPE_LABELS[option.value] || option.label}
              </option>
            ))}
          </select>
          <select value={activity} onChange={event => setActivity(event.target.value)}>
            <option value="ACTIVE">{et ? "Ainult aktiivsed" : "Active only"}</option>
            <option value="INACTIVE">{et ? "Ainult mitteaktiivsed" : "Inactive only"}</option>
            <option value="ALL">{et ? "Koik" : "All"}</option>
          </select>
        </div>

        <div className="ra-toolbar">
          <span className="ra-chip" data-tone="dim">
            {et ? `Kirjeid: ${filteredItems.length}` : `Entries: ${filteredItems.length}`}
          </span>
          <div className="ra-toolbar-meta">
            <span>
              {et
                ? "Naidisorganisatsioonid on vaikimisi peidetud. Ingest on lubatud ainult valmis paketile."
                : "Example organizations are hidden by default. Ingest is available only for ready packages."}
            </span>
          </div>
          <div className="ra-actions">
            {examplePlaceholderCount ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowExamplePlaceholders(!showExamplePlaceholders)}
              >
                {showExamplePlaceholders
                  ? et ? "Peida naidised" : "Hide examples"
                  : et ? `Naita naidiseid (${examplePlaceholderCount})` : `Show examples (${examplePlaceholderCount})`}
              </Button>
            ) : null}
            {selectedSlugs.size ? (
              <Button
                variant="primary"
                size="sm"
                onClick={ingestSelected}
                disabled={bulkIngestBusy}
              >
                {bulkIngestBusy
                  ? et ? "Saadan valitud RAG-i..." : "Ingesting selected..."
                  : et ? `Ingest valitud (${selectedSlugs.size})` : `Ingest selected (${selectedSlugs.size})`}
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              onClick={resetFilters}
            >
              {et ? "Nulli filtrid" : "Reset filters"}
            </Button>
          </div>
        </div>
      </div>

      <div className="ra-split">
        <div className="ra-card">
          <div className="ra-tablewrap">
              <table className="ra-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={Boolean(filteredItems.length && filteredItems.every(item => selectedSlugs.has(item.slug)))}
                        onChange={toggleSelectAllFiltered}
                        aria-label={et ? "Vali koik" : "Select all"}
                      />
                    </th>
                    <th>{et ? "Organisatsioon" : "Organization"}</th>
                    <th>{et ? "Tuup" : "Type"}</th>
                    <th>{et ? "Fookus" : "Focus"}</th>
                    <th>{et ? "Valmisolek" : "Readiness"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const canSelect = item.ingestSummary?.canIngest === true && !item.isSeedPlaceholder;
                    return (
                      <tr
                        key={item.slug}
                        data-selected={selectedEntry?.slug === item.slug ? "true" : undefined}
                        onClick={() => setSelectedSlug(item.slug)}
                      >
                        <td onClick={event => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedSlugs.has(item.slug)}
                            disabled={!canSelect}
                            onChange={() => toggleSelected(item.slug)}
                            aria-label={et ? "Vali organisatsioon" : "Select organization"}
                          />
                        </td>
                        <td>
                          <div className="ra-td-main">{item.displayName}</div>
                          <div className="ra-td-sub ra-mono">{item.slug}</div>
                        </td>
                        <td>{TYPE_LABELS[item.type] || item.type}</td>
                        <td>{item.focus || "-"}</td>
                        <td>
                          <div className="ra-chiprow">
                            {item.isSeedPlaceholder ? (
                              <span className="ra-chip" data-tone="dim">{et ? "Naidis" : "Example"}</span>
                            ) : null}
                            <span className="ra-chip" data-tone={item.crawlReadiness === "READY" ? "ok" : item.crawlReadiness === "REVIEW" ? "warn" : "dim"}>
                              {readinessLabel(item.crawlReadiness, et)}
                            </span>
                            <span
                              className="ra-chip"
                              data-tone={
                                item.packageSummary?.state === "READY" || item.packageSummary?.state === "FILES_READY"
                                  ? "ok"
                                  : item.packageSummary?.state === "INVALID"
                                    ? "err"
                                    : item.packageSummary?.state === "PARTIAL"
                                      ? "warn"
                                      : "dim"
                              }
                            >
                              {packageLabel(item.packageSummary?.state, et)}
                            </span>
                            <span
                              className="ra-chip"
                              data-tone={
                                item.ingestStatus === "INGESTED"
                                  ? "ok"
                                  : item.ingestStatus === "ERROR"
                                    ? "err"
                                    : item.ingestStatus === "READY" || item.ingestStatus === "INGESTING"
                                      ? "warn"
                                      : "dim"
                              }
                            >
                              {ingestLabel(item.ingestStatus, et)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        </div>

        <div className="ra-card">
          <div className="ra-form">
            {selectedEntry ? (
              <>
                {remediationFocus ? (
                  <div className="ra-note">
                    <strong>{et ? "Quality queue siht" : "Quality queue target"}:</strong>{" "}
                    {focusHint || (et ? "kontrolli selle kirje metadata't" : "review this record metadata")}
                  </div>
                ) : null}

                <div className="ra-card-head">
                  <div>
                    <div className="ra-card-title">{selectedEntry.displayName}</div>
                    <p className="ra-card-sub">
                      {selectedEntry.isSeedPlaceholder
                        ? et ? "Vanast seedist parit naidisrida. Lisa parispaketi failid voi kasuta uut knowledge-doc/KOV kihti vastavalt allikatubile."
                          : "Old seeded example row. Add a real package or use the KOV/knowledge-doc layer according to source type."
                        : et ? "Pusiandmed, tuumfailid ja lisafailid." : "Persistent data, core files, and attachments."}
                    </p>
                  </div>
                  <span className="ra-chip">{packageLabel(selectedEntry.packageSummary?.state, et)}</span>
                </div>

                <div className="ra-kv">
                  <div>
                    <span>Slug</span>
                    <span className="ra-mono">{selectedEntry.slug}</span>
                  </div>
                  <div>
                    <span>{et ? "Tuup" : "Type"}</span>
                    <span>{TYPE_LABELS[selectedEntry.type] || selectedEntry.type}</span>
                  </div>
                  <div>
                    <span>{et ? "Maakond / ulatus" : "County / scope"}</span>
                    <span>{selectedEntry.county || "-"}</span>
                  </div>
                  <div>
                    <span>{et ? "Koik failid" : "All files"}</span>
                    <span>{selectedEntry.fileCount || 0}</span>
                  </div>
                  <div>
                    <span>{et ? "Tuumfailid" : "Core files"}</span>
                    <span>
                      {(selectedEntry.packageSummary?.presentCount || 0)}/{selectedEntry.packageSummary?.totalCount || 4}
                    </span>
                  </div>
                  <div>
                    <span>{et ? "Ingest" : "Ingest"}</span>
                    <span>{ingestLabel(selectedEntry.ingestStatus, et)}</span>
                  </div>
                </div>

                <div className="ra-form">
                  <div className="ra-form-grid">
                    <Input
                      value={detailDraft.displayName}
                      onChange={event => updateDraft("displayName", event.target.value)}
                      placeholder={et ? "Organisatsiooni nimi" : "Organization name"}
                      size="sm"
                    />
                    <select value={detailDraft.type} onChange={event => updateDraft("type", event.target.value)}>
                      {Object.entries(TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={detailDraft.focus}
                      onChange={event => updateDraft("focus", event.target.value)}
                      placeholder={et ? "Fookus" : "Focus"}
                      size="sm"
                    />
                    <Input
                      value={detailDraft.county}
                      onChange={event => updateDraft("county", event.target.value)}
                      placeholder={et ? "Maakond voi ulatus" : "County or scope"}
                      size="sm"
                    />
                    <Input
                      value={detailDraft.officialWebsite}
                      onChange={event => updateDraft("officialWebsite", event.target.value)}
                      placeholder={et ? "Ametlik veeb" : "Official website"}
                      size="sm"
                    />
                    <Input
                      value={detailDraft.contactEmail}
                      onChange={event => updateDraft("contactEmail", event.target.value)}
                      placeholder={et ? "Kontakt e-post" : "Contact email"}
                      size="sm"
                    />
                    <Input
                      value={detailDraft.contactPhone}
                      onChange={event => updateDraft("contactPhone", event.target.value)}
                      placeholder={et ? "Kontakt telefon" : "Contact phone"}
                      size="sm"
                    />
                    <select
                      value={detailDraft.crawlReadiness}
                      onChange={event => updateDraft("crawlReadiness", event.target.value)}
                    >
                      <option value="PLANNED">{et ? "Planeeritud" : "Planned"}</option>
                      <option value="REVIEW">{et ? "Vajab ulevaatust" : "Needs review"}</option>
                      <option value="READY">{et ? "Valmis jargmiseks sammuks" : "Ready for next step"}</option>
                    </select>
                    <select
                      value={detailDraft.isActive ? "ACTIVE" : "INACTIVE"}
                      onChange={event => updateDraft("isActive", event.target.value === "ACTIVE")}
                    >
                      <option value="ACTIVE">{et ? "Aktiivne" : "Active"}</option>
                      <option value="INACTIVE">{et ? "Mitteaktiivne" : "Inactive"}</option>
                    </select>
                  </div>

                  <textarea
                    value={detailDraft.notes}
                    onChange={event => updateDraft("notes", event.target.value)}
                    placeholder={et ? "Markused organisatsiooni kohta" : "Notes about the organization"}
                    rows={5}
                  />

                  <div className="ra-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => applyQuickReadiness("REVIEW")}
                    >
                      {et ? "Margi ulevaatuseks" : "Mark for review"}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => applyQuickReadiness("READY")}
                    >
                      {et ? "Margi valmis" : "Mark ready"}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={saveDetail}
                      disabled={saveBusy || !editing}
                    >
                      {saveBusy ? (et ? "Salvestan..." : "Saving...") : et ? "Salvesta muudatused" : "Save changes"}
                    </Button>
                  </div>
                </div>

                <div className="ra-form">
                  <div className="ra-card-head">
                    <div className="ra-label">{et ? "Paketi valmidus" : "Package readiness"}</div>
                    <span className="ra-chip">{packageLabel(selectedEntry.packageSummary?.state, et)}</span>
                  </div>
                  <div className="ra-td-sub">
                    {et ? `Tuumfailid: ${selectedEntry.packageSummary?.presentCount || 0}/${selectedEntry.packageSummary?.totalCount || 4}.`
                      : `Core files: ${selectedEntry.packageSummary?.presentCount || 0}/${selectedEntry.packageSummary?.totalCount || 4}.`}
                    {" "}
                    {et ? `Valid: ${selectedEntry.packageSummary?.validCount || 0}/${selectedEntry.packageSummary?.totalCount || 4}.`
                      : `Valid: ${selectedEntry.packageSummary?.validCount || 0}/${selectedEntry.packageSummary?.totalCount || 4}.`}
                  </div>
                  <div className="ra-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => revalidateSingle(selectedEntry.slug)}
                      disabled={revalidateBusySlug === selectedEntry.slug}
                    >
                      {revalidateBusySlug === selectedEntry.slug
                        ? et ? "Valideerin..." : "Revalidating..."
                        : et ? "Valideeri tuumfailid uuesti" : "Revalidate core files"}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => ingestSingle(selectedEntry.slug)}
                      disabled={ingestBusySlug === selectedEntry.slug || selectedEntry.ingestSummary?.canIngest !== true}
                    >
                      {ingestBusySlug === selectedEntry.slug
                        ? et ? "Saadan RAG-i..." : "Ingesting..."
                        : et ? "Ingest RAG-i" : "Ingest to RAG"}
                    </Button>
                  </div>
                  <div className="ra-form">
                    <div className="ra-chiprow">
                      <span
                        className="ra-chip"
                        data-tone={
                          selectedEntry.ingestStatus === "INGESTED"
                            ? "ok"
                            : selectedEntry.ingestStatus === "ERROR"
                              ? "err"
                              : "dim"
                        }
                      >
                        {ingestLabel(selectedEntry.ingestStatus, et)}
                      </span>
                      {selectedEntry.ragDocId ? <span className="ra-mono">{selectedEntry.ragDocId}</span> : null}
                    </div>
                    {selectedEntry.lastIngestedAt ? (
                      <div className="ra-td-sub">
                        {et ? "Viimati ingestitud" : "Last ingested"}: {formatDateTime(selectedEntry.lastIngestedAt, locale)}
                      </div>
                    ) : null}
                    {selectedEntry.lastIngestError ? (
                      <div className="ra-td-sub" style={{ color: "var(--status-error)" }}>{selectedEntry.lastIngestError}</div>
                    ) : null}
                    {selectedEntry.ingestSummary?.blockingIssues?.length ? (
                      <div className="ra-td-sub" style={{ color: "var(--status-error)" }}>
                        {selectedEntry.ingestSummary.blockingIssues.join(". ")}
                      </div>
                    ) : null}
                  </div>
                </div>

                {selectedEntry.packageValidation ? (
                  <div className="ra-form">
                    <div className="ra-card-head">
                      <div>
                        <div className="ra-label">{et ? "Organisatsiooni metadata audit" : "Organization metadata audit"}</div>
                        <div className="ra-td-sub">
                          {et ? "Kontrollib 4 tuumfaili, sourceKeys viiteid ja remote URL materjale." : "Checks the 4 core files, sourceKeys references, and remote URL materials."}
                        </div>
                      </div>
                      <div className="ra-chiprow">
                        <span className="ra-chip" data-tone={selectedEntry.packageValidation.ok ? "ok" : "err"}>
                          {selectedEntry.packageValidation.ok ? (et ? "Validation OK" : "Validation OK") : (et ? "Validation viga" : "Validation error")}
                        </span>
                        <span className="ra-chip" data-tone={selectedEntry.packageValidation.ingest_ready ? "ok" : "dim"}>
                          ingestReady: {selectedEntry.packageValidation.ingest_ready ? "true" : "false"}
                        </span>
                      </div>
                    </div>
                    <div className="ra-kv">
                      <div>
                        <span>RAG docId</span>
                        <span className="ra-mono">{selectedEntry.packageValidation.rag_doc_id}</span>
                      </div>
                      <div>
                        <span>sourceCount</span>
                        <span>{selectedEntry.packageValidation.sourceKeys?.length || 0}</span>
                      </div>
                      <div>
                        <span>{et ? "Remote URL" : "Remote URL"}</span>
                        <span>{selectedEntry.packageValidation.remote_source_url_supported ? "supported" : "-"}</span>
                      </div>
                    </div>
                    {selectedEntry.packageValidation.errors?.length ? (
                      <div className="ra-td-sub" style={{ color: "var(--status-error)" }}>{selectedEntry.packageValidation.errors.join(". ")}</div>
                    ) : null}
                    {selectedEntry.packageValidation.warnings?.length ? (
                      <div className="ra-td-sub" style={{ color: "var(--dusk-glow)" }}>{selectedEntry.packageValidation.warnings.join(". ")}</div>
                    ) : null}
                  </div>
                ) : null}

                {selectedEntry.packageDocuments?.items?.length ? (
                  <div className="ra-form">
                    <div className="ra-card-head">
                      <div>
                        <div className="ra-label">{et ? "Viidatud lisamaterjalid" : "Referenced materials"}</div>
                        <div className="ra-td-sub">
                          {et
                            ? "Need on organisatsioonipaketi documents[] viited. Neid ei ingestita siin eraldi RAG dokumentidena."
                            : "These are organization package documents[] references. They are not ingested here as separate RAG documents."}
                        </div>
                      </div>
                      <span className="ra-chip" data-tone="dim">{selectedEntry.packageDocuments.total || 0}</span>
                    </div>
                    <div className="ra-filelist">
                      {selectedEntry.packageDocuments.items.map(document => (
                        <div key={document.id || document.title} className="ra-filerow">
                          <div className="ra-filerow-info">
                            <div className="ra-filerow-name">{document.title || document.id}</div>
                            <div className="ra-filerow-meta">
                              {document.source_url ? (et ? "remote URL" : "remote URL") : (et ? "kohalik fail" : "local file")} - {document.source_format || "-"}
                            </div>
                            {document.source_url ? (
                              <div className="ra-filerow-meta ra-mono">{document.source_url}</div>
                            ) : null}
                          </div>
                          <div className="ra-chiprow">
                            <span className="ra-chip" data-tone="dim">{document.document_status}</span>
                            {document.source_url ? <span className="ra-chip" data-tone="dim">URL</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="ra-form">
                  <div className="ra-card-head">
                    <div>
                      <div className="ra-label">{et ? "RAG dokumendi seis" : "RAG document status"}</div>
                      <div className="ra-td-sub">
                        {et ? "Reaalajas kontroll RAG registrist." : "Live check from the RAG registry."}
                      </div>
                    </div>
                    <div className="ra-actions">
                      <span className="ra-td-sub">
                        {et ? "Värskendatud" : "Updated"}: {ragStatus?.checkedAt ? formatDateTime(ragStatus.checkedAt, locale) : "-"}
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => refreshSelectedRagStatus()}
                        disabled={ragStatusLoading}
                      >
                        {ragStatusLoading
                          ? et ? "Värskendan..." : "Refreshing..."
                          : et ? "Värskenda RAG seisu" : "Refresh RAG status"}
                      </Button>
                    </div>
                  </div>

                  <div className="ra-chiprow">
                    <span
                      className="ra-chip"
                      data-tone={
                        ragStatus?.doc?.error
                          ? "err"
                          : ragStatus?.doc?.exists && Number(ragStatus?.doc?.chunks || 0) > 0
                            ? "ok"
                            : "dim"
                      }
                    >
                      {ragDocStatusLabel(ragStatus?.doc, et)}
                    </span>
                    {selectedEntry.ragDocId ? <span className="ra-mono">{selectedEntry.ragDocId}</span> : null}
                  </div>
                  <div className="ra-kv">
                    <div>
                      <span>{et ? "Chunkid" : "Chunks"}</span>
                      <span>{Number(ragStatus?.doc?.chunks || 0)}</span>
                    </div>
                    <div>
                      <span>{et ? "Pealkiri" : "Title"}</span>
                      <span>{ragStatus?.doc?.title || "-"}</span>
                    </div>
                    <div>
                      <span>{et ? "Teenuse staatus" : "Service status"}</span>
                      <span>{ragStatus?.doc?.status || "-"}</span>
                    </div>
                    <div>
                      <span>{et ? "Viimati ingestitud" : "Last ingested"}</span>
                      <span>{ragStatus?.doc?.lastIngested ? formatDateTime(ragStatus.doc.lastIngested, locale) : "-"}</span>
                    </div>
                    <div>
                      <span>{et ? "Registri uuendus" : "Registry update"}</span>
                      <span>{ragStatus?.doc?.updatedAt ? formatDateTime(ragStatus.doc.updatedAt, locale) : "-"}</span>
                    </div>
                  </div>
                  {ragStatus?.doc?.error ? (
                    <div className="ra-td-sub" style={{ color: "var(--status-error)" }}>{ragStatus.doc.error}</div>
                  ) : null}
                </div>

                <div className="ra-form">
                  <div className="ra-label">{et ? "Tuumfailid" : "Core files"}</div>
                  <div className="ra-td-sub">
                    {et ? "Need 4 faili moodustavad pohipaketi." : "These 4 files form the core package."}
                  </div>

                  <div className="ra-filelist">
                    {ORGANIZATION_CORE_FILE_KEYS.map(key => {
                      const file = selectedEntry.coreFiles?.[key];
                      const roleMeta = ORGANIZATION_FILE_ROLE_META[key];
                      const busy = fileBusyKey === `${selectedEntry.slug}:${roleMeta.paramRole}`;
                      const inputId = `${selectedEntry.slug}-${roleMeta.paramRole}`;
                      const resolvedName = roleMeta.fileNamePattern.replace("{slug}", selectedEntry.slug);
                      const focused = isFocusedFile(remediationFocus, key);

                      return (
                        <div key={key} className="ra-filerow" data-focused={focused ? "true" : undefined}>
                          <div className="ra-filerow-info">
                            <div className="ra-filerow-name ra-mono">{resolvedName}</div>
                            {focused ? (
                              <span className="ra-chip" data-tone="warn">{et ? "Quality queue siht" : "Quality queue target"}</span>
                            ) : null}
                            <div className="ra-filerow-meta">
                              {file?.status === "missing"
                                ? et ? "Puudub" : "Missing"
                                : `${file.originalName} • ${(file.size / 1024).toFixed(1)} KB • ${file.uploadedAt ? formatDateTime(file.uploadedAt, locale) : "-"}`}
                            </div>
                            <div className="ra-chiprow">
                              <span
                                className="ra-chip"
                                data-tone={
                                  file?.validationStatus === "VALID"
                                    ? "ok"
                                    : file?.validationStatus === "INVALID"
                                      ? "err"
                                      : "dim"
                                }
                              >
                                {validationLabel(file?.validationStatus, et)}
                              </span>
                            </div>
                            {file?.validationStatus === "INVALID" && file?.validationMessage ? (
                              <div className="ra-filerow-meta" style={{ color: "var(--status-error)" }}>{file.validationMessage}</div>
                            ) : null}
                          </div>
                          <div className="ra-actions">
                              <input
                                id={inputId}
                                type="file"
                                className="hidden"
                                accept={roleMeta.accept}
                                onChange={event => {
                                  const nextFile = event.target.files?.[0];
                                  if (nextFile) uploadFile(selectedEntry.slug, roleMeta.paramRole, nextFile);
                                  event.target.value = "";
                                }}
                              />
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => document.getElementById(inputId)?.click()}
                                disabled={busy}
                              >
                                {busy ? (et ? "Laen..." : "Uploading...") : file?.status === "missing" ? (et ? "Lae ules" : "Upload") : (et ? "Asenda" : "Replace")}
                              </Button>
                              {file?.downloadUrl ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => window.open(file.downloadUrl, "_blank", "noopener,noreferrer")}
                                >
                                  {et ? "Laadi alla" : "Download"}
                                </Button>
                              ) : null}
                              {file?.id ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => removeFile(selectedEntry.slug, file.id)}
                                >
                                  {et ? "Eemalda" : "Remove"}
                                </Button>
                              ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="ra-form">
                  <div className="ra-card-head">
                    <div>
                      <div className="ra-label">
                        {et ? "Lisafailid" : "Additional files"}
                        {attachmentsFocused ? (
                          <span className="ra-chip" data-tone="warn" style={{ marginLeft: "0.5em" }}>
                            {et ? "Quality queue siht" : "Quality queue target"}
                          </span>
                        ) : null}
                      </div>
                      <div className="ra-td-sub">
                        {et ? "Muud toofailid ja lisadokumendid." : "Other working files and supporting documents."}
                      </div>
                    </div>
                    <span className="ra-chip" data-tone="dim">
                      {et ? `Lisafaile: ${selectedEntry.files?.length || 0}` : `Attachments: ${selectedEntry.files?.length || 0}`}
                    </span>
                  </div>

                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="hidden"
                    accept={ORGANIZATION_FILE_ROLE_META.attachment.accept}
                    onChange={event => {
                      const nextFile = event.target.files?.[0];
                      if (nextFile) uploadFile(selectedEntry.slug, "attachment", nextFile);
                      event.target.value = "";
                    }}
                  />

                  <div className="ra-filepick">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={fileBusyKey === `${selectedEntry.slug}:attachment`}
                    >
                      {fileBusyKey === `${selectedEntry.slug}:attachment`
                        ? et ? "Laen..." : "Uploading..."
                        : et ? "Vali fail" : "Choose file"}
                    </Button>
                    <span className="ra-filepick-name">
                      {et ? "Toetatud: JSON, MD, TXT, PDF, DOCX, CSV" : "Supported: JSON, MD, TXT, PDF, DOCX, CSV"}
                    </span>
                  </div>

                  <div className="ra-filelist">
                    {selectedEntry.files?.length ? (
                      selectedEntry.files.map(file => {
                        const busy = fileBusyKey === `${selectedEntry.slug}:${file.id}`;
                        return (
                          <div key={file.id} className="ra-filerow">
                            <div className="ra-filerow-info">
                              <div className="ra-filerow-name">{file.originalName}</div>
                              <div className="ra-filerow-meta">
                                {file.mime} • {(file.size / 1024).toFixed(1)} KB • {file.uploadedAt ? formatDateTime(file.uploadedAt, locale) : "-"}
                              </div>
                            </div>
                            <div className="ra-actions">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => window.open(file.downloadUrl, "_blank", "noopener,noreferrer")}
                                disabled={busy}
                              >
                                {et ? "Laadi alla" : "Download"}
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => removeFile(selectedEntry.slug, file.id)}
                                disabled={busy}
                              >
                                {busy ? (et ? "Eemaldan..." : "Removing...") : et ? "Eemalda" : "Remove"}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="ra-empty">
                        {et ? "Selle organisatsiooni juures ei ole veel lisafaile." : "There are no additional files on this organization yet."}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="ra-empty">
                {examplePlaceholderCount && !showExamplePlaceholders
                  ? et ? "Aktiivseid parispakette ei ole. Vanad naidisread on peidetud."
                    : "No active real packages. Old example rows are hidden."
                  : et ? "Filtritega ei leitud uhtegi organisatsiooni." : "No organizations matched the current filters."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
