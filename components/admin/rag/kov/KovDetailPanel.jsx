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
  return (
    <div>
      <div>
        <div>{label}</div>
        <span>
          {ragDocStatusLabel(doc, et)}
        </span>
      </div>
      <div>
        <div>doc_id: {doc?.docId || "-"}</div>
        <div>{et ? "Chunkid" : "Chunks"}: {Number(doc?.chunks || 0)}</div>
        <div>{et ? "Pealkiri" : "Title"}: {doc?.title || "-"}</div>
        <div>{et ? "Teenuse staatus" : "Service status"}: {doc?.status || "-"}</div>
        <div>{et ? "Viimati ingestitud" : "Last ingested"}: {doc?.lastIngested ? formatDateTime(doc.lastIngested, locale) : "-"}</div>
        <div>{et ? "Registri uuendus" : "Registry update"}: {doc?.updatedAt ? formatDateTime(doc.updatedAt, locale) : "-"}</div>
        {doc?.error ? (
          <div>
            {doc.error}
          </div>
        ) : null}
      </div>
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
    <div>
      <div>{title}</div>
      {!hasItems ? (
        <div>
          {summary.mode === "BASELINE_CREATED"
            ? (et ? "Esimene kontroll lĆµi baasvĆµrdluse. JĆ¤rgmised jooksud nĆ¤itavad diffi." : "The first check created the baseline. Future runs will show a diff.")
            : et ? "Muutunud allikaid ega vigu ei tuvastatud." : "No changed sources or fetch errors were detected."}
        </div>
      ) : null}
      {changedSources.length ? (
        <div>
          <div>{et ? "Muutunud allikad" : "Changed sources"}</div>
          {changedSources.map((item, index) => (
            <div key={`${item.key || item.url || "changed"}-${index}`}>
              <div>{item.key || item.url || "-"}</div>
              <div>{lightCheckReasonLabel(item.reason, et)}</div>
              {item.url ? <div>{item.url}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      {removedSources.length ? (
        <div>
          <div>{et ? "Kadunud allikad" : "Removed sources"}</div>
          {removedSources.map((item, index) => (
            <div key={`${item.key || item.url || "removed"}-${index}`}>
              <div>{item.key || item.url || "-"}</div>
              {item.url ? <div>{item.url}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      {errorSources.length ? (
        <div>
          <div>{et ? "Allikad veaga" : "Sources with errors"}</div>
          {errorSources.map((item, index) => (
            <div key={`${item.key || item.url || "error"}-${index}`}>
              <div>{item.key || item.url || "-"}</div>
              {item.url ? <div>{item.url}</div> : null}
              <div>{item.error || "-"}</div>
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
    <div>
      {definitions.map(file => {
        const state = files?.[file.key] || { status: "missing", version: 0, validationStatus: "MISSING", validationMessage: "" };
        const resolvedFileName = file.fileName.replace("{slug}", entry.slug);
        const busy = fileBusyKey === `${entry.slug}:${file.key}`;
        const isMarkdown = file.key === "ragMd";
        const isXml = file.key === "rtXml";
        const focused = isFocusedFile(remediationFocus, file.key);

        return (
          <div key={file.key}>
            <div>
              <div>
                <div>
                  <div>{resolvedFileName}</div>
                  {focused ? (
                    <span>
                      {et ? "Quality queue siht" : "Quality queue target"}
                    </span>
                  ) : null}
                </div>
                <div>
                  <div>
                    {et ? "Staatus" : "Status"}:{" "}
                    <span>
                      {et
                        ? state.status === "uploaded"
                          ? "olemas"
                          : state.status === "replaced"
                            ? "asendatud"
                            : "puudu"
                        : fileStatusLabel(state.status)}
                    </span>
                  </div>
                  <div>
                    {et ? "Valideerimine" : "Validation"}:{" "}
                    <span>
                      {validationLabel(state.validationStatus, et)}
                    </span>
                  </div>
                  <div>{et ? "Nimi" : "Name"}: {state.originalName || "-"}</div>
                  <div>{et ? "Kiht" : "Layer"}: {file.shortLabel}</div>
                  <div>{et ? "Versioon" : "Version"}: {state.version || 0}</div>
                  <div>{et ? "Laetud" : "Uploaded"}: {state.uploadedAt ? formatDateTime(state.uploadedAt, locale) : "-"}</div>
                  <div>{et ? "Valideeritud" : "Validated"}: {state.validatedAt ? formatDateTime(state.validatedAt, locale) : "-"}</div>
                  {state.validationStatus === "INVALID" && state.validationMessage ? (
                    <div>
                      {state.validationMessage}
                    </div>
                  ) : null}
                </div>
              </div>
              <div>
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
          </div>
        );
      })}
    </div>
  );
}

function renderSaveActions({ et, saveBusy, onSave, message, hint }) {
  return (
    <div>
      <Button
        variant="primary"
        size="sm"
        onClick={() => onSave()}
        disabled={saveBusy}
      >
        {saveBusy ? "Salvestan..." : et ? "Salvesta muudatused" : "Save changes"}
      </Button>
      <span>{hint}</span>
      {message?.text ? (
        <span>
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
      <div>
        <div>
          <div>Vali KOV, et avada detailid.</div>
        </div>
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
    <div>
      {remediationFocus ? (
        <div>
          <span>{et ? "Quality queue siht" : "Quality queue target"}:</span>{" "}
          {focusHint || (et ? "kontrolli selle kirje metadata't" : "review this record metadata")}
        </div>
      ) : null}
      <div>
        <div>
          <div>
            <div>
              <div>{entry.displayName}</div>
              <div>KOV veeb ja Riigi Teataja kiht eraldi halduses.</div>
            </div>
          </div>

          <div>
            <div>
              <span>KOV</span>
              <span>{entry.displayName}</span>
            </div>
            <div>
              <span>Slug</span>
              <span>{entry.slug}</span>
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
              <span>
                <span>
                  {rtStatusLabel(detailDraft.rtStatus || entry.rtStatus)}
                </span>
              </span>
            </div>
            <div>
              <span>{et ? "KOV ingest" : "Web ingest"}</span>
              <span>
                <span>
                  {ingestStatusLabel(entry.ingestStatus)}
                </span>
              </span>
            </div>
            <div>
              <span>{et ? "RT ingest" : "RT ingest"}</span>
              <span>
                <span>
                  {ingestStatusLabel(entry.rtIngestStatus)}
                </span>
              </span>
            </div>
            <div>
              <span>{et ? "Admin KOV failid" : "Admin KOV files"}</span>
              <span>{entry.fileCount || 0}/4</span>
            </div>
            <div>
              <span>{et ? "Admin RT fail" : "Admin RT file"}</span>
              <span>{entry.rtFileCount || 0}/1</span>
            </div>
            <div>
              <span>{et ? "Koondvalmidus" : "Combined readiness"}</span>
              <span>
                <span>
                  {readinessLabel(combinedReadiness.state, et)}
                </span>
              </span>
            </div>
          </div>
          <div>
            <span>
              {et ? "Valmis kihte" : "Ready layers"}: {combinedReadiness.readyLayerCount || 0}/2
            </span>
            <span>
              KOV: {combinedReadiness.webReady ? (et ? "valmis" : "ready") : et ? "pooleli" : "pending"}
            </span>
            <span>
              RT: {combinedReadiness.rtReady ? (et ? "valmis" : "ready") : et ? "pooleli" : "pending"}
            </span>
          </div>

          <div>
            <div>
              <div>
                <div>{et ? "RAG dokumendi seis" : "RAG document status"}</div>
                <div>
                  {et
                    ? "Reaalajas kontroll RAG registrist: doc_id, chunkide arv ja viimane ingest."
                    : "Live check from the RAG registry: doc_id, chunk count, and last ingest."}
                </div>
              </div>
              <div>
                <span>
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
            <div>
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
            <div>
              <div>
                <div>{et ? "Paketipõhine KOV reset" : "Package-level KOV reset"}</div>
                <div>
                  {et
                    ? "Reset eemaldab ainult selle KOV RAG dokumendid, archiveerib aktiivsed SourcePackage snapshotid ja viib admin ingest-state'i tagasi mitte-ingestitud seisu. Repo faile see ei muuda."
                    : "Reset removes only this municipality's RAG documents, archives active SourcePackage snapshots, and returns admin ingest state to not ingested. Repo files are not touched."}
                </div>
              </div>
              {resetSummary ? (
                <div>
                  <div><span>{et ? "RAG dokumendid" : "RAG documents"}:</span> {resetSummary.matched_rag_doc_ids || 0}</div>
                  <div><span>{et ? "Aktiivsed snapshotid" : "Active snapshots"}:</span> {resetSummary.active_snapshot_count || 0}</div>
                  <div><span>{et ? "Archiveeritud snapshotid" : "Archived snapshots"}:</span> {resetSummary.archived_snapshot_count || 0}</div>
                  <div><span>{et ? "Admin reset" : "Admin reset"}:</span> {resetSummary.admin_row_will_reset ? (et ? "jah" : "yes") : (et ? "ei" : "no")}</div>
                </div>
              ) : null}
              <div>
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
      </div>

      <div>
        <div>
          <div>
            <div>{et ? "Hooldusgraafik" : "Review schedule"}</div>
            <div>
                {et ? "Aastane täisülevaatus jaanuari lõpus ja kergem automaatkontroll juuli lõpus." : "Annual full review at the end of January and a lighter automated check at the end of July."}
            </div>
          </div>

          <div>
            <div>
              <span>{et ? "Seis" : "State"}:</span>{" "}
              <span>
                {reviewStateLabel(reviewSchedule.state, et)}
              </span>
            </div>
            <div>
              <span>{et ? "Automaatkontroll" : "Auto check"}:</span>{" "}
              <span>
                {autoCheckStatusLabel(entry.autoCheckStatus)}
              </span>
            </div>
            <div>
              <span>{et ? "RT automaatkontroll" : "RT auto check"}:</span>{" "}
              <span>
                {autoCheckStatusLabel(entry.rtAutoCheckStatus)}
              </span>
            </div>
            <div>
              <span>{et ? "Viimane täisülevaatus" : "Last full review"}:</span>{" "}
              {entry.lastFullReviewAt ? formatDateTime(entry.lastFullReviewAt, locale) : "-"}
            </div>
            <div>
              <span>{et ? "Järgmine täisülevaatus" : "Next full review"}:</span>{" "}
              {entry.nextFullReviewAt ? formatDateTime(entry.nextFullReviewAt, locale) : "-"}
            </div>
            <div>
              <span>{et ? "Viimane automaatkontroll" : "Last light check"}:</span>{" "}
              {entry.lastLightCheckAt ? formatDateTime(entry.lastLightCheckAt, locale) : "-"}
            </div>
            <div>
              <span>{et ? "Järgmine automaatkontroll" : "Next light check"}:</span>{" "}
              {entry.nextLightCheckAt ? formatDateTime(entry.nextLightCheckAt, locale) : "-"}
            </div>
            <div>
              <span>{et ? "Viimane tuvastatud muudatus" : "Last detected change"}:</span>{" "}
              {entry.lastChangeDetectedAt ? formatDateTime(entry.lastChangeDetectedAt, locale) : "-"}
            </div>
            <div>
              <span>{et ? "Viimane automaatkontrolli kokkuvote" : "Last light check summary"}:</span>{" "}
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
            </div>
            <div>
              <span>{et ? "Viimane RT kontrolli kokkuvote" : "Last RT check summary"}:</span>{" "}
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
            </div>
          </div>

          <div>
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
            <div>
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
            <div>
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
      </div>

      <div>
        <div>

          <div>
            <div>{et ? "KOV veeb" : "KOV web"}</div>
            <div>
              {et ? "Praktiline info: teenused, toetused, kontaktid, blanketid." : "Practical layer: services, benefits, contacts, forms."}
            </div>
          </div>

          <div>
            {et
              ? "Siin hallad KOV veebikihti. Salvesta muudatused = salvesta lingid, märkused ja staatused. Kontrolli muudatusi = vaata, kas allikad on muutunud. Failikaartidel Lae üles = lisa või asenda konkreetne fail."
              : "This section manages the KOV web layer. Save changes stores links, notes, and statuses. Check for changes runs a source check. On file cards, Upload adds or replaces that specific file."}
          </div>

            <div>
            <div>
              <div>
                <label>Ametlik veebileht</label>
                <Input
                  value={detailDraft.officialWebsite || ""}
                  onChange={event => updateDraft(onDraftChange, { officialWebsite: event.target.value })}
                  size="sm"
                  placeholder="https://..."
                  disabled={!editingLinks}
                />
                {!editingLinks ? (
                  <div>See viide kirjeldab KOV veebikihi ametlikku allikat.</div>
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

              <div>
                <label>{et ? "KOV veeb staatus" : "KOV web status"}</label>
                <DocumentsDropdown
                  ariaLabel="KOV veeb staatus"
                  value={detailDraft.status}
                  onChange={nextStatus => updateDraft(onDraftChange, { status: nextStatus })}
                  options={statusOptions}
                />
                <label>{et ? "Viimati kontrollitud" : "Last checked"}</label>
                <Input
                  type="datetime-local"
                  value={detailDraft.checkedAt || ""}
                  onChange={event => updateDraft(onDraftChange, { checkedAt: event.target.value })}
                  size="sm"
                />
                <label>{et ? "Markused" : "Notes"}</label>
                <Textarea
                  value={detailDraft.notes || ""}
                  onChange={event => updateDraft(onDraftChange, { notes: event.target.value })}
                  rows={4}
                  size="sm"
                />
                <label>
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

            <div>
              <div>
                <span>{et ? "Kokkuvote" : "Summary"}:</span>{" "}
                {et
                  ? `${webSummary.presentCount || 0}/4 olemas, ${webSummary.validCount || 0}/4 valid`
                  : `${webSummary.presentCount || 0}/4 present, ${webSummary.validCount || 0}/4 valid`}
              </div>
              <div>
                <span>{et ? "Ingest" : "Ingest"}:</span>{" "}
                {entry.ingestSummary?.canIngest
                  ? et ? "valmis" : "ready"
                  : (entry.ingestSummary?.blockingIssues || []).join("; ") || (et ? "pole valmis" : "not ready")}
              </div>
              <div>
                <span>{et ? "Vigased failid" : "Invalid files"}:</span>{" "}
                {webInvalidLabels.length ? webInvalidLabels.join(", ") : "-"}
              </div>
              <div>
                <span>{et ? "Puuduvad failid" : "Missing files"}:</span>{" "}
                {webMissingLabels.length ? webMissingLabels.join(", ") : "-"}
              </div>
              <div>
                <span>{et ? "Viimati ingestitud" : "Last ingested"}:</span>{" "}
                {entry.lastIngestedAt ? formatDateTime(entry.lastIngestedAt, locale) : "-"}
              </div>
              <div>
                <span>RAG doc ID:</span> {entry.ragDocId || "-"}
              </div>
              {entry.lastIngestError ? (
                <div>
                  <span>{et ? "Viimane ingest viga" : "Last ingest error"}:</span> {entry.lastIngestError}
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
      </div>

      <div>
        <div>
          <div>
            <div>{et ? "Riigi Teataja" : "Riigi Teataja"}</div>
            <div>
              {et ? "Oiguslik ja kinnitav kiht." : "Legal and confirming layer."}
            </div>
          </div>

          <div>
            {et
              ? "Siin hallad Riigi Teataja kihti. XML on siin ainus kanoniline allikas. Ingest parsib RT XML-faili, lisab identiteedi ja ehitab paragrahvi- voi loikepohised chunkid ilma normiteksti umber kirjutamata."
              : "This section manages the Riigi Teataja layer. XML is the only canonical source here. Ingest parses the RT XML file, adds identity, and builds paragraph- or subsection-based chunks without rewriting the legal text."}
          </div>

          <div>
            <div>
              <div>
                <label>{et ? "Riigi Teataja link" : "Riigi Teataja URL"}</label>
                <Input
                  value={detailDraft.riigiTeatajaUrl || ""}
                  onChange={event => updateDraft(onDraftChange, { riigiTeatajaUrl: event.target.value })}
                  size="sm"
                  placeholder="https://..."
                  disabled={!editingLinks}
                />
                {!editingLinks ? (
                  <div>See viide kirjeldab kehtiva korra ametlikku RT allikat.</div>
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

              <div>
                <label>{et ? "RT seis" : "RT status"}</label>
                <DocumentsDropdown
                  ariaLabel="RT seis"
                  value={detailDraft.rtStatus}
                  onChange={nextStatus => updateDraft(onDraftChange, { rtStatus: nextStatus })}
                  options={rtStatusOptions}
                />
                <label>{et ? "RT kontrollitud" : "RT checked at"}</label>
                <Input
                  type="datetime-local"
                  value={detailDraft.rtCheckedAt || ""}
                  onChange={event => updateDraft(onDraftChange, { rtCheckedAt: event.target.value })}
                  size="sm"
                />
                <label>{et ? "RT markused" : "RT notes"}</label>
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

            <div>
              <div>
                <span>{et ? "Kokkuvote" : "Summary"}:</span>{" "}
                {et
                  ? `${rtSummary.presentCount || 0}/1 olemas, ${rtSummary.validCount || 0}/1 valid`
                  : `${rtSummary.presentCount || 0}/1 present, ${rtSummary.validCount || 0}/1 valid`}
              </div>
              <div>
                <span>{et ? "Ingest" : "Ingest"}:</span>{" "}
                {entry.rtIngestSummary?.canIngest
                  ? et ? "valmis" : "ready"
                  : (entry.rtIngestSummary?.blockingIssues || []).join("; ") || (et ? "pole valmis" : "not ready")}
              </div>
              <div>
                <span>{et ? "RT vigased failid" : "RT invalid files"}:</span>{" "}
                {rtInvalidLabels.length ? rtInvalidLabels.join(", ") : "-"}
              </div>
              <div>
                <span>{et ? "RT puuduvad failid" : "RT missing files"}:</span>{" "}
                {rtMissingLabels.length ? rtMissingLabels.join(", ") : "-"}
              </div>
            </div>
            <div>
              <div>
                <span>{et ? "RT failid" : "RT files"}:</span> {entry.rtFileCount || 0}/1
              </div>
              <div>
                <span>{et ? "RT kontrollitud" : "RT checked at"}:</span>{" "}
                {entry.rtCheckedAt ? formatDateTime(entry.rtCheckedAt, locale) : "-"}
              </div>
              <div>
                <span>{et ? "RT automaatkontroll" : "RT light check"}:</span>{" "}
                {entry.rtLastLightCheckAt ? formatDateTime(entry.rtLastLightCheckAt, locale) : "-"}
              </div>
              <div>
                <span>{et ? "RT viimati ingestitud" : "RT last ingested"}:</span>{" "}
                {entry.rtLastIngestedAt ? formatDateTime(entry.rtLastIngestedAt, locale) : "-"}
              </div>
              <div>
                <span>RT RAG doc ID:</span> {entry.rtRagDocId || "-"}
              </div>
              {entry.rtLastIngestError ? (
                <div>
                  <span>{et ? "RT viimane ingest viga" : "Last RT ingest error"}:</span> {entry.rtLastIngestError}
                </div>
              ) : (
                <div>
                  {et
                    ? "RT plokk ingestitakse nuud XML algallikast. Chunke ei hallata kasitsi, vaid need regenereeritakse kogu akti kaupa."
                    : "The RT block is now ingested from the XML source file. Chunks are not manually maintained and are regenerated for the whole act."}
                </div>
              )}
            </div>

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

