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
    <div>
      <RagAdminAlert message={message} onDismiss={() => setMessage(null)} />

      <div>
        <div>
          <div>
            <span>{et ? "Ettevalmistuskiht." : "Preparation layer."}</span>{" "}
            {et
              ? "Organisatsioonide RAG haldus on vanem paketipohine toovoog. KOV, RT ja knowledge-doc kihid on sellest eraldi ning see vaade ei tohiks naidata naidisridu pariselt ingestitud allikatena."
              : "Organization RAG admin is an older package-based workflow. KOV, RT, and knowledge-doc layers are separate, and this view must not present example rows as real ingested sources."}
          </div>

          <div>
            <div>
              {et ? `Kirjeid: ${filteredItems.length}` : `Entries: ${filteredItems.length}`}
            </div>
          </div>

          <div>
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={et ? "Otsi nime, fookuse voi marksona jargi" : "Search by name, focus, or keyword"}
              size="sm"
            />
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

          <div>
            <div>
              {et
                ? "Naidisorganisatsioonid on vaikimisi peidetud. Ingest on lubatud ainult valmis paketile."
                : "Example organizations are hidden by default. Ingest is available only for ready packages."}
            </div>
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

      <div>
        <div>
          <div>
            <div>
              <table>
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
                          <div>{item.displayName}</div>
                          <div>{item.slug}</div>
                        </td>
                        <td>{TYPE_LABELS[item.type] || item.type}</td>
                        <td>{item.focus || "-"}</td>
                        <td>
                          <div>
                            {item.isSeedPlaceholder ? (
                              <span>{et ? "Naidis" : "Example"}</span>
                            ) : null}
                            <span>{readinessLabel(item.crawlReadiness, et)}</span>
                            <span>{packageLabel(item.packageSummary?.state, et)}</span>
                            <span>{ingestLabel(item.ingestStatus, et)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div>
            {selectedEntry ? (
              <>
                {remediationFocus ? (
                  <div>
                    <span>{et ? "Quality queue siht" : "Quality queue target"}:</span>{" "}
                    {focusHint || (et ? "kontrolli selle kirje metadata't" : "review this record metadata")}
                  </div>
                ) : null}

                <div>
                  <div>
                    <div>{selectedEntry.displayName}</div>
                    <div>
                      {selectedEntry.isSeedPlaceholder
                        ? et ? "Vanast seedist parit naidisrida. Lisa parispaketi failid voi kasuta uut knowledge-doc/KOV kihti vastavalt allikatubile."
                          : "Old seeded example row. Add a real package or use the KOV/knowledge-doc layer according to source type."
                        : et ? "Pusiandmed, tuumfailid ja lisafailid." : "Persistent data, core files, and attachments."}
                    </div>
                  </div>
                  <span>{packageLabel(selectedEntry.packageSummary?.state, et)}</span>
                </div>

                <div>
                  <div>
                    <span>Slug</span>
                    <span>{selectedEntry.slug}</span>
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

                <div>
                  <div>
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

                  <div>
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

                <div>
                  <div>
                    <div>{et ? "Paketi valmidus" : "Package readiness"}</div>
                    <span>{packageLabel(selectedEntry.packageSummary?.state, et)}</span>
                  </div>
                  <div>
                    {et ? `Tuumfailid: ${selectedEntry.packageSummary?.presentCount || 0}/${selectedEntry.packageSummary?.totalCount || 4}.`
                      : `Core files: ${selectedEntry.packageSummary?.presentCount || 0}/${selectedEntry.packageSummary?.totalCount || 4}.`}
                  </div>
                  <div>
                    {et ? `Valid: ${selectedEntry.packageSummary?.validCount || 0}/${selectedEntry.packageSummary?.totalCount || 4}.`
                      : `Valid: ${selectedEntry.packageSummary?.validCount || 0}/${selectedEntry.packageSummary?.totalCount || 4}.`}
                  </div>
                  <div>
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
                  <div>
                    <div>
                      <span>{ingestLabel(selectedEntry.ingestStatus, et)}</span>
                      {selectedEntry.ragDocId ? <span>{selectedEntry.ragDocId}</span> : null}
                    </div>
                    {selectedEntry.lastIngestedAt ? (
                      <div>
                        {et ? "Viimati ingestitud" : "Last ingested"}: {formatDateTime(selectedEntry.lastIngestedAt, locale)}
                      </div>
                    ) : null}
                    {selectedEntry.lastIngestError ? (
                      <div>{selectedEntry.lastIngestError}</div>
                    ) : null}
                    {selectedEntry.ingestSummary?.blockingIssues?.length ? (
                      <div>
                        {selectedEntry.ingestSummary.blockingIssues.join(". ")}
                      </div>
                    ) : null}
                  </div>
                </div>

                {selectedEntry.packageValidation ? (
                  <div>
                    <div>
                      <div>
                        <div>{et ? "Organisatsiooni metadata audit" : "Organization metadata audit"}</div>
                        <div>
                          {et ? "Kontrollib 4 tuumfaili, sourceKeys viiteid ja remote URL materjale." : "Checks the 4 core files, sourceKeys references, and remote URL materials."}
                        </div>
                      </div>
                      <div>
                        <span>
                          {selectedEntry.packageValidation.ok ? (et ? "Validation OK" : "Validation OK") : (et ? "Validation viga" : "Validation error")}
                        </span>
                        <span>
                          ingestReady: {selectedEntry.packageValidation.ingest_ready ? "true" : "false"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div>
                        <span>RAG docId</span>
                        <span>{selectedEntry.packageValidation.rag_doc_id}</span>
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
                      <div>{selectedEntry.packageValidation.errors.join(". ")}</div>
                    ) : null}
                    {selectedEntry.packageValidation.warnings?.length ? (
                      <div>{selectedEntry.packageValidation.warnings.join(". ")}</div>
                    ) : null}
                  </div>
                ) : null}

                {selectedEntry.packageDocuments?.items?.length ? (
                  <div>
                    <div>
                      <div>
                        <div>{et ? "Viidatud lisamaterjalid" : "Referenced materials"}</div>
                        <div>
                          {et
                            ? "Need on organisatsioonipaketi documents[] viited. Neid ei ingestita siin eraldi RAG dokumentidena."
                            : "These are organization package documents[] references. They are not ingested here as separate RAG documents."}
                        </div>
                      </div>
                      <span>{selectedEntry.packageDocuments.total || 0}</span>
                    </div>
                    <div>
                      {selectedEntry.packageDocuments.items.map(document => (
                        <div key={document.id || document.title}>
                          <div>
                            <div>
                              <div>{document.title || document.id}</div>
                              <div>
                                {document.source_url ? (et ? "remote URL" : "remote URL") : (et ? "kohalik fail" : "local file")} - {document.source_format || "-"}
                              </div>
                            </div>
                            <div>
                              <span>{document.document_status}</span>
                              {document.source_url ? <span>URL</span> : null}
                            </div>
                          </div>
                          {document.source_url ? (
                            <div>{document.source_url}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <div>
                    <div>
                      <div>{et ? "RAG dokumendi seis" : "RAG document status"}</div>
                      <div>
                        {et ? "Reaalajas kontroll RAG registrist." : "Live check from the RAG registry."}
                      </div>
                    </div>
                    <div>
                      <span>
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

                  <div>
                    <div>
                      <span>{ragDocStatusLabel(ragStatus?.doc, et)}</span>
                      {selectedEntry.ragDocId ? <span>{selectedEntry.ragDocId}</span> : null}
                    </div>
                    <div>
                      {et ? "Chunkid" : "Chunks"}: {Number(ragStatus?.doc?.chunks || 0)}
                    </div>
                    <div>
                      {et ? "Pealkiri" : "Title"}: {ragStatus?.doc?.title || "-"}
                    </div>
                    <div>
                      {et ? "Teenuse staatus" : "Service status"}: {ragStatus?.doc?.status || "-"}
                    </div>
                    <div>
                      {et ? "Viimati ingestitud" : "Last ingested"}: {ragStatus?.doc?.lastIngested ? formatDateTime(ragStatus.doc.lastIngested, locale) : "-"}
                    </div>
                    <div>
                      {et ? "Registri uuendus" : "Registry update"}: {ragStatus?.doc?.updatedAt ? formatDateTime(ragStatus.doc.updatedAt, locale) : "-"}
                    </div>
                    {ragStatus?.doc?.error ? (
                      <div>{ragStatus.doc.error}</div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div>{et ? "Tuumfailid" : "Core files"}</div>
                  <div>
                    {et ? "Need 4 faili moodustavad pohipaketi." : "These 4 files form the core package."}
                  </div>

                  <div>
                    {ORGANIZATION_CORE_FILE_KEYS.map(key => {
                      const file = selectedEntry.coreFiles?.[key];
                      const roleMeta = ORGANIZATION_FILE_ROLE_META[key];
                      const busy = fileBusyKey === `${selectedEntry.slug}:${roleMeta.paramRole}`;
                      const inputId = `${selectedEntry.slug}-${roleMeta.paramRole}`;
                      const resolvedName = roleMeta.fileNamePattern.replace("{slug}", selectedEntry.slug);
                      const focused = isFocusedFile(remediationFocus, key);

                      return (
                        <div key={key}>
                          <div>
                            <div>
                              <div>
                                <div>{resolvedName}</div>
                                {focused ? (
                                  <span>{et ? "Quality queue siht" : "Quality queue target"}</span>
                                ) : null}
                              </div>
                              <div>
                                {file?.status === "missing"
                                  ? et ? "Puudub" : "Missing"
                                  : `${file.originalName} • ${(file.size / 1024).toFixed(1)} KB • ${file.uploadedAt ? formatDateTime(file.uploadedAt, locale) : "-"}`}
                              </div>
                              <div>
                                <span>{validationLabel(file?.validationStatus, et)}</span>
                              </div>
                              {file?.validationStatus === "INVALID" && file?.validationMessage ? (
                                <div>{file.validationMessage}</div>
                              ) : null}
                            </div>
                            <div>
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
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div>
                    <div>
                      <div>
                        <div>{et ? "Lisafailid" : "Additional files"}</div>
                        {attachmentsFocused ? (
                          <span>{et ? "Quality queue siht" : "Quality queue target"}</span>
                        ) : null}
                      </div>
                      <div>
                        {et ? "Muud toofailid ja lisadokumendid." : "Other working files and supporting documents."}
                      </div>
                    </div>
                    <div>
                      {et ? `Lisafaile: ${selectedEntry.files?.length || 0}` : `Attachments: ${selectedEntry.files?.length || 0}`}
                    </div>
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

                  <div>
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
                    <span>
                      {et ? "Toetatud: JSON, MD, TXT, PDF, DOCX, CSV" : "Supported: JSON, MD, TXT, PDF, DOCX, CSV"}
                    </span>
                  </div>

                  <div>
                    {selectedEntry.files?.length ? (
                      selectedEntry.files.map(file => {
                        const busy = fileBusyKey === `${selectedEntry.slug}:${file.id}`;
                        return (
                          <div key={file.id}>
                            <div>
                              <div>
                                <div>{file.originalName}</div>
                                <div>
                                  {file.mime} • {(file.size / 1024).toFixed(1)} KB • {file.uploadedAt ? formatDateTime(file.uploadedAt, locale) : "-"}
                                </div>
                              </div>
                              <div>
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
                          </div>
                        );
                      })
                    ) : (
                      <div>
                        {et ? "Selle organisatsiooni juures ei ole veel lisafaile." : "There are no additional files on this organization yet."}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div>
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
