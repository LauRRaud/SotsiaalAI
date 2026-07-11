"use client";

import { useRef } from "react";
import DocumentsDropdown from "@/components/documents/DocumentsDropdown";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { localizePath } from "@/lib/localizePath";
import { formatDateTime } from "../ragAdminShared";

const WEB_FILE_DEFINITIONS = [
  {
    key: "sourcesJson",
    fileName: "{slug}.sources.json",
    shortLabel: "sources.json",
    description: "Allikaregister URL-ide ja sourceKey-dega."
  },
  {
    key: "dataJson",
    fileName: "{slug}.json",
    shortLabel: "json",
    description: "Struktureeritud KOV veebikiht teenuste, toetuste, kontaktide ja vormidega."
  },
  {
    key: "metaJson",
    fileName: "{slug}.meta.json",
    shortLabel: "meta.json",
    description: "KOV veebikihi haldusmeta: checkedAt, coverage, markused ja unresolved issues."
  },
  {
    key: "ragMd",
    fileName: "{slug}.rag.md",
    shortLabel: "rag.md",
    description: "Praktilise KOV veebikihi puhastatud RAG tekst."
  }
];

const RT_FILE_DEFINITIONS = [
  {
    key: "rtXml",
    fileName: "{slug}.rt.xml",
    shortLabel: "rt.xml",
    description: "Riigi Teataja XML algallikas. See on RT kihi ainus canonical source."
  }
];

const FILE_LABEL_BY_KEY = Object.fromEntries(
  [...WEB_FILE_DEFINITIONS, ...RT_FILE_DEFINITIONS].map(file => [file.key, file.shortLabel])
);

function isFocusedFile(remediationFocus, fileKey) {
  if (!remediationFocus || !fileKey) return false;
  return remediationFocus.fileKey === fileKey || remediationFocus.focus === fileKey;
}

function fileStatusLabel(status) {
  if (status === "uploaded") return "uploaded";
  if (status === "replaced") return "replaced";
  return "missing";
}

function validationLabel(validationStatus, et) {
  if (validationStatus === "VALID") return et ? "valid" : "valid";
  if (validationStatus === "INVALID") return et ? "vigane" : "invalid";
  return et ? "puudub" : "missing";
}

function readinessLabel(state, et) {
  if (state === "BOTH_INGESTED") return et ? "Mõlemad kihid ingestitud" : "Both layers ingested";
  if (state === "BOTH_READY") return et ? "Mõlemad kihid valmis" : "Both layers ready";
  if (state === "WEB_READY") return et ? "Ainult KOV veeb valmis" : "Only KOV web ready";
  if (state === "RT_READY") return et ? "Ainult RT valmis" : "Only RT ready";
  return et ? "Kihid pooleli" : "Layers incomplete";
}

function reviewStateLabel(state, et) {
  if (state === "FULL_REVIEW_DUE") return et ? "Täisülevaatus tulekul" : "Full review due";
  if (state === "LIGHT_CHECK_DUE") return et ? "Automaatkontroll tulekul" : "Light check due";
  if (state === "CHANGES_DETECTED") return et ? "Muudatus tuvastatud" : "Changes detected";
  if (state === "CHECKING") return et ? "Kontrollimisel" : "Checking";
  if (state === "NO_CHANGES") return et ? "Kontroll korras" : "No changes";
  if (state === "ERROR") return et ? "Kontrolli viga" : "Check error";
  return et ? "Graafikus" : "On schedule";
}

function lightCheckReasonLabel(reason, et) {
  if (reason === "new_source") return et ? "uus allikas" : "new source";
  if (reason === "source_removed") return et ? "allikas eemaldatud" : "source removed";
  if (reason === "content_changed") return et ? "sisu muutus" : "content changed";
  return reason || "-";
}

function ragDocStatusLabel(doc, et) {
  if (doc?.error) return et ? "Viga" : "Error";
  if (doc?.notIngested) return et ? "Pole ingestitud" : "Not ingested";
  if (doc?.exists && Number(doc?.chunks || 0) > 0) return et ? "Leitud" : "Found";
  if (doc?.exists) return et ? "Registris, 0 chunki" : "In registry, 0 chunks";
  return et ? "Puudub" : "Missing";
}

function renderRagDocCard({ doc, label, et, locale }) {
  const tone = doc?.error
    ? "err"
    : doc?.exists && Number(doc?.chunks || 0) > 0
      ? "ok"
      : "dim";

  return (
    <div className="ra-change" style={{ gap: "0.4rem" }}>
      <div className="ra-card-head">
        <div className="ra-label">{label}</div>
        <span className="ra-chip" data-tone={tone}>
          {ragDocStatusLabel(doc, et)}
        </span>
      </div>
      <div className="ra-kv">
        <div><span>doc_id</span><span className="ra-mono">{doc?.docId || "-"}</span></div>
        <div><span>{et ? "Chunkid" : "Chunks"}</span><span>{Number(doc?.chunks || 0)}</span></div>
        <div><span>{et ? "Pealkiri" : "Title"}</span><span>{doc?.title || "-"}</span></div>
        <div><span>{et ? "Teenuse staatus" : "Service status"}</span><span>{doc?.status || "-"}</span></div>
        <div><span>{et ? "Viimati ingestitud" : "Last ingested"}</span><span>{doc?.lastIngested ? formatDateTime(doc.lastIngested, locale) : "-"}</span></div>
        <div><span>{et ? "Registri uuendus" : "Registry update"}</span><span>{doc?.updatedAt ? formatDateTime(doc.updatedAt, locale) : "-"}</span></div>
      </div>
      {doc?.error ? (
        <div className="ra-td-sub" style={{ color: "var(--status-error)" }}>
          {doc.error}
        </div>
      ) : null}
    </div>
  );
}

function renderLightCheckDiffBlock(summary, { et, title }) {
  if (!summary?.checkedAt) return null;

  const changedSources = Array.isArray(summary.changedSources) ? summary.changedSources : [];
  const removedSources = Array.isArray(summary.removedSources) ? summary.removedSources : [];
  const errorSources = Array.isArray(summary.errorSources) ? summary.errorSources : [];
  const hasItems = changedSources.length || removedSources.length || errorSources.length;

  return (
    <div className="ra-form">
      <div className="ra-label">{title}</div>
      {!hasItems ? (
        <div className="ra-td-sub">
          {summary.mode === "BASELINE_CREATED"
            ? (et ? "Esimene kontroll lõi baasvõrdluse. Järgmised jooksud näitavad diffi." : "The first check created the baseline. Future runs will show a diff.")
            : et ? "Muutunud allikaid ega vigu ei tuvastatud." : "No changed sources or fetch errors were detected."}
        </div>
      ) : null}
      {changedSources.length ? (
        <div className="ra-changes">
          <div className="ra-label">{et ? "Muutunud allikad" : "Changed sources"}</div>
          {changedSources.map((item, index) => (
            <div key={`${item.key || item.url || "changed"}-${index}`} className="ra-change">
              <div>{item.key || item.url || "-"}</div>
              <div>{lightCheckReasonLabel(item.reason, et)}</div>
              {item.url ? <div className="ra-mono">{item.url}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      {removedSources.length ? (
        <div className="ra-changes">
          <div className="ra-label">{et ? "Kadunud allikad" : "Removed sources"}</div>
          {removedSources.map((item, index) => (
            <div key={`${item.key || item.url || "removed"}-${index}`} className="ra-change">
              <div>{item.key || item.url || "-"}</div>
              {item.url ? <div className="ra-mono">{item.url}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      {errorSources.length ? (
        <div className="ra-changes">
          <div className="ra-label">{et ? "Allikad veaga" : "Sources with errors"}</div>
          {errorSources.map((item, index) => (
            <div key={`${item.key || item.url || "error"}-${index}`} className="ra-change">
              <div>{item.key || item.url || "-"}</div>
              {item.url ? <div className="ra-mono">{item.url}</div> : null}
              <div style={{ color: "var(--status-error)" }}>{item.error || "-"}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function updateDraft(setter, patch) {
  setter(current => ({
    ...current,
    ...patch
  }));
}

function renderFileCards({
  entry,
  locale,
  et,
  definitions,
  files,
  fileBusyKey,
  onUploadFile,
  onRemoveFile,
  fileInputRefs,
  remediationFocus
}) {
  return (
    <div className="ra-filelist">
      {definitions.map(file => {
        const state = files?.[file.key] || { status: "missing", version: 0, validationStatus: "MISSING", validationMessage: "" };
        const resolvedFileName = file.fileName.replace("{slug}", entry.slug);
        const busy = fileBusyKey === `${entry.slug}:${file.key}`;
        const isMarkdown = file.key === "ragMd";
        const isXml = file.key === "rtXml";
        const focused = isFocusedFile(remediationFocus, file.key);

        return (
          <div key={file.key} className="ra-filerow" data-focused={focused ? "true" : undefined}>
              <div className="ra-filerow-info">
                <div className="ra-chiprow">
                  <span className="ra-filerow-name ra-mono">{resolvedFileName}</span>
                  {focused ? (
                    <span className="ra-chip" data-tone="warn">
                      {et ? "Quality queue siht" : "Quality queue target"}
                    </span>
                  ) : null}
                </div>
                <div className="ra-chiprow">
                  <span className="ra-chip" data-tone={state.status === "missing" ? "dim" : "ok"}>
                    {et
                      ? state.status === "uploaded"
                        ? "olemas"
                        : state.status === "replaced"
                          ? "asendatud"
                          : "puudu"
                      : fileStatusLabel(state.status)}
                  </span>
                  <span
                    className="ra-chip"
                    data-tone={
                      state.validationStatus === "VALID"
                        ? "ok"
                        : state.validationStatus === "INVALID"
                          ? "err"
                          : "dim"
                    }
                  >
                    {validationLabel(state.validationStatus, et)}
                  </span>
                </div>
                <div className="ra-filerow-meta">
                  {et ? "Nimi" : "Name"}: {state.originalName || "-"} · {et ? "Kiht" : "Layer"}: {file.shortLabel} · {et ? "Versioon" : "Version"}: {state.version || 0}
                </div>
                <div className="ra-filerow-meta">
                  {et ? "Laetud" : "Uploaded"}: {state.uploadedAt ? formatDateTime(state.uploadedAt, locale) : "-"} · {et ? "Valideeritud" : "Validated"}: {state.validatedAt ? formatDateTime(state.validatedAt, locale) : "-"}
                </div>
                <div className="ra-filerow-meta">{file.description}</div>
                {state.validationStatus === "INVALID" && state.validationMessage ? (
                  <div className="ra-filerow-meta" style={{ color: "var(--status-error)" }}>
                    {state.validationMessage}
                  </div>
                ) : null}
              </div>
              <div className="ra-actions">
                <input
                  ref={node => {
                    fileInputRefs.current[file.key] = node;
                  }}
                  type="file"
                  className="hidden"
                  accept={
                    isMarkdown
                      ? ".md,.txt,text/markdown,text/plain"
                      : isXml
                        ? ".xml,application/xml,text/xml"
                        : ".json,application/json"
                  }
                  onChange={event => {
                    const nextFile = event.target.files?.[0];
                    if (nextFile) {
                      onUploadFile(entry.slug, file.key, nextFile);
                    }
                    event.target.value = "";
                  }}
                />
                <Button
                  variant="primary"
                  size="2xs"
                  onClick={() => fileInputRefs.current[file.key]?.click()}
                  disabled={busy}
                >
                  {busy ? "Laen..." : state.status === "missing" ? "Lae üles" : "Asenda fail"}
                </Button>
                {state.downloadUrl ? (
                  <Button
                    variant="primary"
                    size="2xs"
                    onClick={() => window.open(state.downloadUrl, "_blank", "noopener,noreferrer")}
                    disabled={busy}
                  >
                    Laadi alla
                  </Button>
                ) : null}
                {state.status !== "missing" && state.storageKind !== "repository" ? (
                  <Button
                    variant="danger"
                    size="2xs"
                    onClick={() => onRemoveFile(entry.slug, file.key)}
                    disabled={busy}
                  >
                    Eemalda
                  </Button>
                ) : null}
              </div>
          </div>
        );
      })}
    </div>
  );
}

function renderSaveActions({ et, saveBusy, onSave, message, hint }) {
  return (
    <div className="ra-actions">
      <Button
        variant="primary"
        size="sm"
        onClick={() => onSave()}
        disabled={saveBusy}
      >
        {saveBusy ? "Salvestan..." : et ? "Salvesta muudatused" : "Save changes"}
      </Button>
      <span className="ra-td-sub">{hint}</span>
      {message?.text ? (
        <span className="ra-status">
          {message.text}
        </span>
      ) : null}
    </div>
  );
}

export default function KovDetailPanel({
  entry,
  locale,
  et = true,
  statusOptions,
  statusLabel,
  ingestStatusLabel,
  rtStatusOptions,
  rtStatusLabel,
  autoCheckStatusLabel,
  detailDraft,
  onDraftChange,
  ragStatus,
  ragStatusLoading = false,
  ragResetPlan = null,
  remediationFocus = null,
  message,
  onRefreshRagStatus,
  onSave,
  saveBusy,
  onMarkReady: _onMarkReady,
  onResetRagState,
  onIngest: _onIngest,
  onReplaceIngest,
  onIngestRt: _onIngestRt,
  onRevalidateAll: _onRevalidateAll,
  onRevalidateRt: _onRevalidateRt,
  onLightCheck,
  onRtLightCheck,
  onMarkWebReviewNeeded,
  onConfirmWebLightCheck,
  onMarkRtReviewNeeded,
  onConfirmRtLightCheck,
  editingLinks,
  onSetEditingLinks: _onSetEditingLinks,
  onCycleStatus: _onCycleStatus,
  onUploadFile,
  onRemoveFile,
  fileBusyKey,
  revalidateBusy: _revalidateBusy = false,
  revalidateRtBusy: _revalidateRtBusy = false,
  ingestBusy: _ingestBusy = false,
  rtIngestBusy: _rtIngestBusy = false,
  lightCheckBusy = false,
  rtLightCheckBusy = false,
  resetBusy = false
}) {
  const fileInputRefs = useRef({});

  if (!entry) {
    return (
      <div className="ra-empty">
        Vali KOV, et avada detailid.
      </div>
    );
  }

  const resetSummary = ragResetPlan?.summary || null;
  const municipalityId = entry.slug ? entry.slug.replaceAll("-", "_") : "";
  const sourcePackagesHref = localizePath(`/admin/rag/source-packages?municipalityId=${encodeURIComponent(municipalityId)}`);

  const webSummary = entry.webSummary || entry.validationSummary || {};
  const rtSummary = entry.rtSummary || {};
  const webInvalidLabels = (webSummary.invalidKeys || []).map(key => FILE_LABEL_BY_KEY[key] || key);
  const webMissingLabels = (webSummary.missingKeys || []).map(key => FILE_LABEL_BY_KEY[key] || key);
  const rtInvalidLabels = (rtSummary.invalidKeys || []).map(key => FILE_LABEL_BY_KEY[key] || key);
  const rtMissingLabels = (rtSummary.missingKeys || []).map(key => FILE_LABEL_BY_KEY[key] || key);
  const combinedReadiness = entry.combinedReadiness || {};
  const reviewSchedule = entry.reviewSchedule || {};
  const hasWebDiffItems =
    Number(entry.lightCheckSummary?.changedSourceCount || 0) > 0
    || Number(entry.lightCheckSummary?.removedSourceCount || 0) > 0
    || Number(entry.lightCheckSummary?.errorCount || 0) > 0;
  const hasRtDiffItems =
    Number(entry.rtLightCheckSummary?.changedSourceCount || 0) > 0
    || Number(entry.rtLightCheckSummary?.removedSourceCount || 0) > 0
    || Number(entry.rtLightCheckSummary?.errorCount || 0) > 0;
  const webLightCheckDiff = renderLightCheckDiffBlock(entry.lightCheckSummary, {
    et,
    title: et ? "KOV veeb diff" : "KOV web diff"
  });
  const rtLightCheckDiff = renderLightCheckDiffBlock(entry.rtLightCheckSummary, {
    et,
    title: et ? "RT diff" : "RT diff"
  });
  const ragSnapshot = ragStatus || {};
  const focusHint = remediationFocus?.fileKey
    ? `${et ? "Fail" : "File"}: ${FILE_LABEL_BY_KEY[remediationFocus.fileKey] || remediationFocus.fileKey}`
    : remediationFocus?.focus || "";

  return (
    <div className="ra-shell-flow">
      {remediationFocus ? (
        <div className="ra-note">
          <strong>{et ? "Quality queue siht" : "Quality queue target"}:</strong>{" "}
          {focusHint || (et ? "kontrolli selle kirje metadata't" : "review this record metadata")}
        </div>
      ) : null}
      <div className="ra-card">
          <div className="ra-card-head">
            <div>
              <div className="ra-card-title">{entry.displayName}</div>
              <p className="ra-card-sub">KOV veeb ja Riigi Teataja kiht eraldi halduses.</p>
            </div>
            <div className="ra-chiprow">
              <span className="ra-chip" data-tone={combinedReadiness.state === "BOTH_INGESTED" || combinedReadiness.state === "BOTH_READY" ? "ok" : "warn"}>
                {readinessLabel(combinedReadiness.state, et)}
              </span>
              <span className="ra-chip" data-tone="dim">
                {et ? "Valmis kihte" : "Ready layers"}: {combinedReadiness.readyLayerCount || 0}/2
              </span>
            </div>
          </div>

          <div className="ra-kv">
            <div>
              <span>KOV</span>
              <span>{entry.displayName}</span>
            </div>
            <div>
              <span>Slug</span>
              <span className="ra-mono">{entry.slug}</span>
            </div>
            <div>
              <span>Maakond</span>
              <span>{entry.county || "-"}</span>
            </div>
            <div>
              <span>Tuup</span>
              <span>{entry.type === "LINN" ? "Linn" : "Vald"}</span>
            </div>
            <div>
              <span>{et ? "KOV veeb staatus" : "KOV web status"}</span>
              <span>{statusLabel(detailDraft.status || entry.status)}</span>
            </div>
            <div>
              <span>{et ? "RT seis" : "RT status"}</span>
              <span>{rtStatusLabel(detailDraft.rtStatus || entry.rtStatus)}</span>
            </div>
            <div>
              <span>{et ? "KOV ingest" : "Web ingest"}</span>
              <span>{ingestStatusLabel(entry.ingestStatus)}</span>
            </div>
            <div>
              <span>{et ? "RT ingest" : "RT ingest"}</span>
              <span>{ingestStatusLabel(entry.rtIngestStatus)}</span>
            </div>
            <div>
              <span>{et ? "Admin KOV failid" : "Admin KOV files"}</span>
              <span>{entry.fileCount || 0}/4</span>
            </div>
            <div>
              <span>{et ? "Admin RT fail" : "Admin RT file"}</span>
              <span>{entry.rtFileCount || 0}/1</span>
            </div>
          </div>
          <div className="ra-chiprow">
            <span className="ra-chip" data-tone={combinedReadiness.webReady ? "ok" : "dim"}>
              KOV: {combinedReadiness.webReady ? (et ? "valmis" : "ready") : et ? "pooleli" : "pending"}
            </span>
            <span className="ra-chip" data-tone={combinedReadiness.rtReady ? "ok" : "dim"}>
              RT: {combinedReadiness.rtReady ? (et ? "valmis" : "ready") : et ? "pooleli" : "pending"}
            </span>
          </div>

          <div className="ra-form">
            <div className="ra-card-head">
              <div>
                <div className="ra-label">{et ? "RAG dokumendi seis" : "RAG document status"}</div>
                <div className="ra-td-sub">
                  {et
                    ? "Reaalajas kontroll RAG registrist: doc_id, chunkide arv ja viimane ingest."
                    : "Live check from the RAG registry: doc_id, chunk count, and last ingest."}
                </div>
              </div>
              <div className="ra-actions">
                <span className="ra-td-sub">
                  {et ? "Värskendatud" : "Updated"}: {ragSnapshot.checkedAt ? formatDateTime(ragSnapshot.checkedAt, locale) : "-"}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onRefreshRagStatus?.()}
                  disabled={ragStatusLoading}
                >
                  {ragStatusLoading
                    ? et ? "Värskendan..." : "Refreshing..."
                    : et ? "Värskenda RAG seisu" : "Refresh RAG status"}
                </Button>
              </div>
            </div>
            <div className="ra-form-grid">
              {renderRagDocCard({
                doc: ragSnapshot.web || {
                  docId: entry.ragDocId || "",
                  exists: false,
                  chunks: 0,
                  title: "",
                  status: "",
                  updatedAt: null,
                  lastIngested: null,
                  error: ""
                },
                label: et ? "KOV veeb RAG" : "KOV web RAG",
                et,
                locale
              })}
              {renderRagDocCard({
                doc: ragSnapshot.rt || {
                  docId: entry.rtRagDocId || "",
                  exists: false,
                  chunks: 0,
                  title: "",
                  status: "",
                  updatedAt: null,
                  lastIngested: null,
                  error: ""
                },
                label: et ? "RT RAG" : "RT RAG",
                et,
                locale
              })}
            </div>
            <div className="ra-note" data-tone="neutral">
              <div>
                <div className="ra-label">{et ? "Paketipõhine KOV reset" : "Package-level KOV reset"}</div>
                <div className="ra-td-sub">
                  {et
                    ? "Reset eemaldab ainult selle KOV RAG dokumendid, archiveerib aktiivsed SourcePackage snapshotid ja viib admin ingest-state'i tagasi mitte-ingestitud seisu. Repo faile see ei muuda."
                    : "Reset removes only this municipality's RAG documents, archives active SourcePackage snapshots, and returns admin ingest state to not ingested. Repo files are not touched."}
                </div>
              </div>
              {resetSummary ? (
                <div className="ra-kv" style={{ margin: "0.6rem 0" }}>
                  <div><span>{et ? "RAG dokumendid" : "RAG documents"}</span><span>{resetSummary.matched_rag_doc_ids || 0}</span></div>
                  <div><span>{et ? "Aktiivsed snapshotid" : "Active snapshots"}</span><span>{resetSummary.active_snapshot_count || 0}</span></div>
                  <div><span>{et ? "Archiveeritud snapshotid" : "Archived snapshots"}</span><span>{resetSummary.archived_snapshot_count || 0}</span></div>
                  <div><span>{et ? "Admin reset" : "Admin reset"}</span><span>{resetSummary.admin_row_will_reset ? (et ? "jah" : "yes") : (et ? "ei" : "no")}</span></div>
                </div>
              ) : null}
              <div className="ra-actions" style={{ marginTop: "0.5rem" }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onReplaceIngest?.()}
                  disabled={_ingestBusy || entry.ingestSummary?.canIngest !== true}
                >
                  {_ingestBusy
                    ? et ? "Asendan..." : "Replacing..."
                    : et ? "Asenda KOV veeb RAG-is" : "Replace KOV web in RAG"}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onResetRagState?.()}
                  disabled={resetBusy}
                >
                  {resetBusy
                    ? et ? "Valmistan reseti..." : "Preparing reset..."
                    : et ? "Reseti KOV RAG state" : "Reset KOV RAG state"}
                </Button>
                <Button
                  as="a"
                  href={sourcePackagesHref}
                  variant="linkBrand"
                  size="sm"
                >
                  {et ? "Ava source packages" : "Open source packages"}
                </Button>
              </div>
            </div>
          </div>
      </div>

      <div className="ra-card">
          <div className="ra-card-head">
            <div>
              <div className="ra-card-title">{et ? "Hooldusgraafik" : "Review schedule"}</div>
              <p className="ra-card-sub">
                {et ? "Aastane täisülevaatus jaanuari lõpus ja kergem automaatkontroll juuli lõpus." : "Annual full review at the end of January and a lighter automated check at the end of July."}
              </p>
            </div>
            <div className="ra-chiprow">
              <span
                className="ra-chip"
                data-tone={
                  reviewSchedule.state === "CHANGES_DETECTED" || reviewSchedule.state === "ERROR"
                    ? "err"
                    : reviewSchedule.state === "FULL_REVIEW_DUE" || reviewSchedule.state === "LIGHT_CHECK_DUE"
                      ? "warn"
                      : reviewSchedule.state === "NO_CHANGES"
                        ? "ok"
                        : "dim"
                }
              >
                {reviewStateLabel(reviewSchedule.state, et)}
              </span>
            </div>
          </div>

          <div className="ra-kv">
            <div>
              <span>{et ? "Automaatkontroll" : "Auto check"}</span>
              <span>{autoCheckStatusLabel(entry.autoCheckStatus)}</span>
            </div>
            <div>
              <span>{et ? "RT automaatkontroll" : "RT auto check"}</span>
              <span>{autoCheckStatusLabel(entry.rtAutoCheckStatus)}</span>
            </div>
            <div>
              <span>{et ? "Viimane täisülevaatus" : "Last full review"}</span>
              <span>{entry.lastFullReviewAt ? formatDateTime(entry.lastFullReviewAt, locale) : "-"}</span>
            </div>
            <div>
              <span>{et ? "Järgmine täisülevaatus" : "Next full review"}</span>
              <span>{entry.nextFullReviewAt ? formatDateTime(entry.nextFullReviewAt, locale) : "-"}</span>
            </div>
            <div>
              <span>{et ? "Viimane automaatkontroll" : "Last light check"}</span>
              <span>{entry.lastLightCheckAt ? formatDateTime(entry.lastLightCheckAt, locale) : "-"}</span>
            </div>
            <div>
              <span>{et ? "Järgmine automaatkontroll" : "Next light check"}</span>
              <span>{entry.nextLightCheckAt ? formatDateTime(entry.nextLightCheckAt, locale) : "-"}</span>
            </div>
            <div>
              <span>{et ? "Viimane tuvastatud muudatus" : "Last detected change"}</span>
              <span>{entry.lastChangeDetectedAt ? formatDateTime(entry.lastChangeDetectedAt, locale) : "-"}</span>
            </div>
            <div>
              <span>{et ? "Viimane automaatkontrolli kokkuvote" : "Last light check summary"}</span>
              <span>
                {entry.lightCheckSummary?.checkedAt
                  ? (
                    entry.lightCheckSummary.mode === "BASELINE_CREATED"
                      ? (et
                        ? `Loodi baasvõrdlus ${entry.lightCheckSummary.checkedSourceCount || 0} allikast.`
                        : `Created a baseline from ${entry.lightCheckSummary.checkedSourceCount || 0} sources.`)
                      : et
                        ? `${entry.lightCheckSummary.changedSourceCount || 0} muudatust, ${entry.lightCheckSummary.errorCount || 0} veaga allikat.`
                        : `${entry.lightCheckSummary.changedSourceCount || 0} changes, ${entry.lightCheckSummary.errorCount || 0} source errors.`)
                  : "-"}
              </span>
            </div>
            <div>
              <span>{et ? "Viimane RT kontrolli kokkuvote" : "Last RT check summary"}</span>
              <span>
                {entry.rtLightCheckSummary?.checkedAt
                  ? (
                    entry.rtLightCheckSummary.mode === "BASELINE_CREATED"
                      ? (et
                        ? `Loodi RT baasvõrdlus ${entry.rtLightCheckSummary.checkedSourceCount || 0} allikast.`
                        : `Created an RT baseline from ${entry.rtLightCheckSummary.checkedSourceCount || 0} sources.`)
                      : et
                        ? `${entry.rtLightCheckSummary.changedSourceCount || 0} RT muudatust, ${entry.rtLightCheckSummary.errorCount || 0} veaga allikat.`
                        : `${entry.rtLightCheckSummary.changedSourceCount || 0} RT changes, ${entry.rtLightCheckSummary.errorCount || 0} source errors.`)
                  : "-"}
              </span>
            </div>
          </div>

          <div className="ra-actions">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onLightCheck?.()}
              disabled={lightCheckBusy}
            >
              {lightCheckBusy
                ? et ? "Kontrollin..." : "Checking..."
                : et ? "Kontrolli muudatusi" : "Check for changes"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onRtLightCheck?.()}
              disabled={rtLightCheckBusy}
            >
              {rtLightCheckBusy
                ? et ? "Kontrollin RT..." : "Checking RT..."
                : et ? "Kontrolli RT muudatusi" : "Check RT changes"}
            </Button>
          </div>
          {webLightCheckDiff}
          {hasWebDiffItems ? (
            <div className="ra-actions">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onMarkWebReviewNeeded?.()}
              >
                {et ? "Märgi KOV ülevaatuseks" : "Mark KOV for review"}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onConfirmWebLightCheck?.()}
              >
                {et ? "Kinnita KOV kontrollituks" : "Confirm KOV check"}
              </Button>
            </div>
          ) : null}
          {rtLightCheckDiff}
          {hasRtDiffItems ? (
            <div className="ra-actions">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onMarkRtReviewNeeded?.()}
              >
                {et ? "Märgi RT ülevaatuseks" : "Mark RT for review"}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onConfirmRtLightCheck?.()}
              >
                {et ? "Kinnita RT kontrollituks" : "Confirm RT check"}
              </Button>
            </div>
          ) : null}
      </div>

      <div className="ra-split ra-split--even">
      <div className="ra-card">
          <div>
            <div className="ra-card-title">{et ? "KOV veeb" : "KOV web"}</div>
            <p className="ra-card-sub">
              {et ? "Praktiline info: teenused, toetused, kontaktid, blanketid." : "Practical layer: services, benefits, contacts, forms."}
            </p>
          </div>

          <div className="ra-td-sub">
            {et
              ? "Siin hallad KOV veebikihti. Salvesta muudatused = salvesta lingid, märkused ja staatused. Kontrolli muudatusi = vaata, kas allikad on muutunud. Failikaartidel Lae üles = lisa või asenda konkreetne fail."
              : "This section manages the KOV web layer. Save changes stores links, notes, and statuses. Check for changes runs a source check. On file cards, Upload adds or replaces that specific file."}
          </div>

            <div className="ra-form">
            <div className="ra-form-grid">
              <div className="ra-form">
                <label className="ra-label">Ametlik veebileht</label>
                <Input
                  value={detailDraft.officialWebsite || ""}
                  onChange={event => updateDraft(onDraftChange, { officialWebsite: event.target.value })}
                  size="sm"
                  placeholder="https://..."
                  disabled={!editingLinks}
                />
                {!editingLinks ? (
                  <div className="ra-td-sub">See viide kirjeldab KOV veebikihi ametlikku allikat.</div>
                ) : null}
                {detailDraft.officialWebsite ? (
                  <a
                    href={detailDraft.officialWebsite}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {et ? "Ava veeb" : "Open website"}
                  </a>
                ) : null}
              </div>

              <div className="ra-form">
                <label className="ra-label">{et ? "KOV veeb staatus" : "KOV web status"}</label>
                <DocumentsDropdown
                  ariaLabel="KOV veeb staatus"
                  value={detailDraft.status}
                  onChange={nextStatus => updateDraft(onDraftChange, { status: nextStatus })}
                  options={statusOptions}
                />
                <label className="ra-label">{et ? "Viimati kontrollitud" : "Last checked"}</label>
                <Input
                  type="datetime-local"
                  value={detailDraft.checkedAt || ""}
                  onChange={event => updateDraft(onDraftChange, { checkedAt: event.target.value })}
                  size="sm"
                />
                <label className="ra-label">{et ? "Markused" : "Notes"}</label>
                <Textarea
                  value={detailDraft.notes || ""}
                  onChange={event => updateDraft(onDraftChange, { notes: event.target.value })}
                  rows={4}
                  size="sm"
                />
                <label className="ui-checkbox">
                  <input
                    type="checkbox"
                    checked={detailDraft.readyForIngest === true}
                    onChange={event => updateDraft(onDraftChange, { readyForIngest: event.target.checked })}
                  />
                  {et ? "Valmis ingestiks" : "Ready for ingest"}
                </label>
              </div>
            </div>

            {renderSaveActions({
              et,
              saveBusy,
              onSave,
              message,
              hint: et
                ? "Salvestab KOV veebilehe, staatuse, kontrolli aja, märkused ja valmisoleku linnukese."
                : "Saves the KOV website, status, checked time, notes, and ready-for-ingest checkbox."
            })}

            <div className="ra-kv">
              <div>
                <span>{et ? "Kokkuvote" : "Summary"}</span>
                <span>
                  {et
                    ? `${webSummary.presentCount || 0}/4 olemas, ${webSummary.validCount || 0}/4 valid`
                    : `${webSummary.presentCount || 0}/4 present, ${webSummary.validCount || 0}/4 valid`}
                </span>
              </div>
              <div>
                <span>{et ? "Ingest" : "Ingest"}</span>
                <span>
                  {entry.ingestSummary?.canIngest
                    ? et ? "valmis" : "ready"
                    : (entry.ingestSummary?.blockingIssues || []).join("; ") || (et ? "pole valmis" : "not ready")}
                </span>
              </div>
              <div>
                <span>{et ? "Vigased failid" : "Invalid files"}</span>
                <span>{webInvalidLabels.length ? webInvalidLabels.join(", ") : "-"}</span>
              </div>
              <div>
                <span>{et ? "Puuduvad failid" : "Missing files"}</span>
                <span>{webMissingLabels.length ? webMissingLabels.join(", ") : "-"}</span>
              </div>
              <div>
                <span>{et ? "Viimati ingestitud" : "Last ingested"}</span>
                <span>{entry.lastIngestedAt ? formatDateTime(entry.lastIngestedAt, locale) : "-"}</span>
              </div>
              <div>
                <span>RAG doc ID</span>
                <span className="ra-mono">{entry.ragDocId || "-"}</span>
              </div>
              {entry.lastIngestError ? (
                <div>
                  <span>{et ? "Viimane ingest viga" : "Last ingest error"}</span>
                  <span style={{ color: "var(--status-error)" }}>{entry.lastIngestError}</span>
                </div>
              ) : null}
            </div>

            {renderFileCards({
              entry,
              locale,
              et,
              definitions: WEB_FILE_DEFINITIONS,
              files: entry.webFiles,
              fileBusyKey,
              onUploadFile,
              onRemoveFile,
              fileInputRefs,
              remediationFocus
            })}
          </div>
      </div>

      <div className="ra-card">
          <div>
            <div className="ra-card-title">{et ? "Riigi Teataja" : "Riigi Teataja"}</div>
            <p className="ra-card-sub">
              {et ? "Oiguslik ja kinnitav kiht." : "Legal and confirming layer."}
            </p>
          </div>

          <div className="ra-td-sub">
            {et
              ? "Siin hallad Riigi Teataja kihti. XML on siin ainus kanoniline allikas. Ingest parsib RT XML-faili, lisab identiteedi ja ehitab paragrahvi- voi loikepohised chunkid ilma normiteksti umber kirjutamata."
              : "This section manages the Riigi Teataja layer. XML is the only canonical source here. Ingest parses the RT XML file, adds identity, and builds paragraph- or subsection-based chunks without rewriting the legal text."}
          </div>

          <div className="ra-form">
            <div className="ra-form-grid">
              <div className="ra-form">
                <label className="ra-label">{et ? "Riigi Teataja link" : "Riigi Teataja URL"}</label>
                <Input
                  value={detailDraft.riigiTeatajaUrl || ""}
                  onChange={event => updateDraft(onDraftChange, { riigiTeatajaUrl: event.target.value })}
                  size="sm"
                  placeholder="https://..."
                  disabled={!editingLinks}
                />
                {!editingLinks ? (
                  <div className="ra-td-sub">See viide kirjeldab kehtiva korra ametlikku RT allikat.</div>
                ) : null}
                {detailDraft.riigiTeatajaUrl ? (
                  <a
                    href={detailDraft.riigiTeatajaUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {et ? "Ava RT" : "Open RT"}
                  </a>
                ) : null}
              </div>

              <div className="ra-form">
                <label className="ra-label">{et ? "RT seis" : "RT status"}</label>
                <DocumentsDropdown
                  ariaLabel="RT seis"
                  value={detailDraft.rtStatus}
                  onChange={nextStatus => updateDraft(onDraftChange, { rtStatus: nextStatus })}
                  options={rtStatusOptions}
                />
                <label className="ra-label">{et ? "RT kontrollitud" : "RT checked at"}</label>
                <Input
                  type="datetime-local"
                  value={detailDraft.rtCheckedAt || ""}
                  onChange={event => updateDraft(onDraftChange, { rtCheckedAt: event.target.value })}
                  size="sm"
                />
                <label className="ra-label">{et ? "RT markused" : "RT notes"}</label>
                <Textarea
                  value={detailDraft.rtNotes || ""}
                  onChange={event => updateDraft(onDraftChange, { rtNotes: event.target.value })}
                  rows={4}
                  size="sm"
                />
              </div>
            </div>

            {renderSaveActions({
              et,
              saveBusy,
              onSave,
              message,
              hint: et
                ? "Salvestab RT lingi, RT seisu, kontrolli aja ja RT märkused."
                : "Saves the RT link, RT status, checked time, and RT notes."
            })}

            <div className="ra-kv">
              <div>
                <span>{et ? "Kokkuvote" : "Summary"}</span>
                <span>
                  {et
                    ? `${rtSummary.presentCount || 0}/1 olemas, ${rtSummary.validCount || 0}/1 valid`
                    : `${rtSummary.presentCount || 0}/1 present, ${rtSummary.validCount || 0}/1 valid`}
                </span>
              </div>
              <div>
                <span>{et ? "Ingest" : "Ingest"}</span>
                <span>
                  {entry.rtIngestSummary?.canIngest
                    ? et ? "valmis" : "ready"
                    : (entry.rtIngestSummary?.blockingIssues || []).join("; ") || (et ? "pole valmis" : "not ready")}
                </span>
              </div>
              <div>
                <span>{et ? "RT vigased failid" : "RT invalid files"}</span>
                <span>{rtInvalidLabels.length ? rtInvalidLabels.join(", ") : "-"}</span>
              </div>
              <div>
                <span>{et ? "RT puuduvad failid" : "RT missing files"}</span>
                <span>{rtMissingLabels.length ? rtMissingLabels.join(", ") : "-"}</span>
              </div>
              <div>
                <span>{et ? "RT failid" : "RT files"}</span>
                <span>{entry.rtFileCount || 0}/1</span>
              </div>
              <div>
                <span>{et ? "RT kontrollitud" : "RT checked at"}</span>
                <span>{entry.rtCheckedAt ? formatDateTime(entry.rtCheckedAt, locale) : "-"}</span>
              </div>
              <div>
                <span>{et ? "RT automaatkontroll" : "RT light check"}</span>
                <span>{entry.rtLastLightCheckAt ? formatDateTime(entry.rtLastLightCheckAt, locale) : "-"}</span>
              </div>
              <div>
                <span>{et ? "RT viimati ingestitud" : "RT last ingested"}</span>
                <span>{entry.rtLastIngestedAt ? formatDateTime(entry.rtLastIngestedAt, locale) : "-"}</span>
              </div>
              <div>
                <span>RT RAG doc ID</span>
                <span className="ra-mono">{entry.rtRagDocId || "-"}</span>
              </div>
            </div>
            {entry.rtLastIngestError ? (
              <div className="ra-td-sub" style={{ color: "var(--status-error)" }}>
                {et ? "RT viimane ingest viga" : "Last RT ingest error"}: {entry.rtLastIngestError}
              </div>
            ) : (
              <div className="ra-td-sub">
                {et
                  ? "RT plokk ingestitakse nuud XML algallikast. Chunke ei hallata kasitsi, vaid need regenereeritakse kogu akti kaupa."
                  : "The RT block is now ingested from the XML source file. Chunks are not manually maintained and are regenerated for the whole act."}
              </div>
            )}

            {renderFileCards({
              entry,
              locale,
              et,
              definitions: RT_FILE_DEFINITIONS,
              files: entry.rtFiles,
              fileBusyKey,
              onUploadFile,
              onRemoveFile,
              fileInputRefs,
              remediationFocus
            })}
          </div>
      </div>
      </div>
    </div>
  );
}

