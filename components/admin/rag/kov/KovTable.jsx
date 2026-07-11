"use client";

import Button from "@/components/ui/Button";
import RagRowMenu from "../RagRowMenu";
import { formatDateTime } from "../ragAdminShared";

function reviewStateLabel(state, et) {
  if (state === "FULL_REVIEW_DUE") return et ? "Täisülevaatus tulekul" : "Full review due";
  if (state === "LIGHT_CHECK_DUE") return et ? "Automaatkontroll tulekul" : "Light check due";
  if (state === "CHANGES_DETECTED") return et ? "Muudatus tuvastatud" : "Changes detected";
  if (state === "CHECKING") return et ? "Kontrollimisel" : "Checking";
  if (state === "NO_CHANGES") return et ? "Kontroll korras" : "No changes";
  if (state === "ERROR") return et ? "Kontrolli viga" : "Check error";
  return et ? "Graafikus" : "On schedule";
}

function reviewStateTone(state) {
  if (state === "CHANGES_DETECTED" || state === "ERROR") return "err";
  if (state === "FULL_REVIEW_DUE" || state === "LIGHT_CHECK_DUE") return "warn";
  if (state === "NO_CHANGES") return "ok";
  return "dim";
}

function readinessTone(state) {
  if (state === "BOTH_INGESTED") return "ok";
  if (state === "BOTH_READY") return "ok";
  if (state === "WEB_READY" || state === "RT_READY") return "warn";
  return "dim";
}

function stopEvent(event, cb) {
  event.stopPropagation();
  cb?.();
}

export default function KovTable({
  rows,
  locale,
  selectedSlug,
  selectedSlugs,
  selectedCount,
  allVisibleSelected,
  onSelect,
  onToggleSelected,
  onClearSelected,
  onSelectAllVisible,
  statusLabel,
  ingestStatusLabel,
  autoCheckStatusLabel,
  onLightCheckSelected,
  onLightCheckRtSelected,
  onRevalidateRow,
  onRevalidateRtRow,
  onRevalidateSelected,
  onRevalidateRtSelected,
  onIngestSelected,
  onIngestRtSelected,
  onIngestRow,
  onReplaceIngestRow,
  onIngestRtRow,
  onOpenEditor,
  revalidateBusySlug,
  revalidateRtBusySlug,
  bulkRevalidateBusy,
  bulkRevalidateRtBusy,
  bulkWebIngestBusy,
  bulkRtIngestBusy,
  bulkLightCheckBusy,
  bulkRtLightCheckBusy,
  ingestBusySlug,
  rtIngestBusySlug,
  et
}) {
  return (
    <div className="ra-card">
      <div className="ra-bulkbar">
        <div className="ra-bulkbar-count">
          {et ? "Valitud" : "Selected"}: <strong>{selectedCount}</strong>
        </div>
        <div className="ra-actions">
          <Button
            variant="primary"
            size="sm"
            onClick={allVisibleSelected ? onClearSelected : onSelectAllVisible}
          >
            {allVisibleSelected ? (et ? "Tühjenda valik" : "Clear selection") : (et ? "Vali nähtavad" : "Select visible")}
          </Button>
          {selectedCount > 0 ? (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={onLightCheckSelected}
                disabled={bulkLightCheckBusy}
              >
                {bulkLightCheckBusy
                  ? et ? "Kontrollin..." : "Checking..."
                  : et ? "Kontrolli KOV muudatusi" : "Check KOV changes"}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onLightCheckRtSelected}
                disabled={bulkRtLightCheckBusy}
              >
                {bulkRtLightCheckBusy
                  ? et ? "Kontrollin RT..." : "Checking RT..."
                  : et ? "Kontrolli RT muudatusi" : "Check RT changes"}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onRevalidateSelected}
                disabled={bulkRevalidateBusy}
              >
                {bulkRevalidateBusy
                  ? et ? "Valideerin..." : "Revalidating..."
                  : et ? "Valideeri KOV" : "Revalidate municipalities"}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onRevalidateRtSelected}
                disabled={bulkRevalidateRtBusy}
              >
                {bulkRevalidateRtBusy
                  ? et ? "Valideerin RT..." : "Revalidating RT..."
                  : et ? "Valideeri RT" : "Revalidate RT"}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onIngestSelected}
                disabled={bulkWebIngestBusy}
              >
                {bulkWebIngestBusy
                  ? et ? "Saadan..." : "Ingesting..."
                  : et ? "Ingest KOV" : "Ingest KOV web"}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onIngestRtSelected}
                disabled={bulkRtIngestBusy}
              >
                {bulkRtIngestBusy
                  ? et ? "Saadan RT..." : "Ingesting RT..."
                  : "RT ingest"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="ra-tablewrap">
      <table className="ra-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() => (allVisibleSelected ? onClearSelected() : onSelectAllVisible())}
                aria-label={et ? "Vali kõik nähtavad" : "Select all visible"}
              />
            </th>
            <th>KOV</th>
            <th>Maakond</th>
            <th>Staatus</th>
            <th>Valmidus</th>
            <th>Tegevused</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const isSelected = selectedSlugs.includes(row.slug);
            const invalidFiles = Number(row.validationSummary?.invalidCount || 0);
            const allFilesValid = row.validationSummary?.allFilesValid === true;
            const rowBusy = revalidateBusySlug === row.slug;
            const rtRowBusy = revalidateRtBusySlug === row.slug;
            const ingestBusy = ingestBusySlug === row.slug;
            const rtIngestBusy = rtIngestBusySlug === row.slug;
            const canIngest = row.ingestSummary?.canIngest === true && row.ingestStatus !== "INGESTING";
            const canRtIngest = row.rtIngestSummary?.canIngest === true && row.rtIngestStatus !== "INGESTING";
            const webIngested = row.ingestStatus === "INGESTED";
            const rtIngested = row.rtIngestStatus === "INGESTED";
            const rtRequiredCount = Math.max(1, Number(row.rtSummary?.requiredCount || 1));
            const rtMissingCount = Number(row.rtSummary?.missingCount || 0);
            const rtInvalidCount = Number(row.rtSummary?.invalidCount || 0);
            const rtValidCount = Number(row.rtSummary?.validCount || 0);
            const reviewState = row.reviewSchedule?.state;
            const readinessState = row.combinedReadiness?.state;

            return (
              <tr
                key={row.slug}
                data-selected={isSelected || selectedSlug === row.slug ? "true" : undefined}
                onClick={() => onSelect(row.slug)}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={event => stopEvent(event, () => onToggleSelected(row.slug))}
                    aria-label={`${et ? "Vali" : "Select"} ${row.displayName}`}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="ra-rowlink"
                    onClick={event => stopEvent(event, () => onSelect(row.slug))}
                  >
                    <div className="ra-td-main">{row.displayName}</div>
                    <div className="ra-td-sub ra-mono">{row.slug}</div>
                  </button>
                </td>
                <td>
                  <div>{row.county || "-"}</div>
                  <div className="ra-td-sub">{row.type === "LINN" ? "Linn" : "Vald"}</div>
                </td>
                <td>
                  <div className="ra-td-stack">
                    <div className="ra-chiprow">
                      <span className="ra-chip">{statusLabel(row.status)}</span>
                      {row.readyForIngest ? (
                        <span className="ra-chip" data-tone="ok">
                          {et ? "Valmis" : "Ready"}
                        </span>
                      ) : null}
                      <span className="ra-chip" data-tone={reviewStateTone(reviewState)}>
                        {reviewStateLabel(reviewState, et)}
                      </span>
                    </div>
                    <div className="ra-td-sub">
                      {row.reviewSchedule?.nextFullReviewAt
                        ? `${et ? "Järgmine täisülevaatus" : "Next full review"}: ${formatDateTime(row.reviewSchedule.nextFullReviewAt, locale)}`
                        : row.checkedAt ? formatDateTime(row.checkedAt, locale) : "-"}
                    </div>
                    {autoCheckStatusLabel(row.autoCheckStatus) !== reviewStateLabel(reviewState, et) ? (
                      <div className="ra-td-sub">
                        {autoCheckStatusLabel(row.autoCheckStatus)}
                      </div>
                    ) : null}
                    {(Number(row.lightCheckSummary?.changedSourceCount || 0) > 0 || Number(row.lightCheckSummary?.errorCount || 0) > 0) ? (
                      <span className="ra-chip" data-tone="warn">
                        {et
                          ? `${row.lightCheckSummary?.changedSourceCount || 0} muudatust, ${row.lightCheckSummary?.errorCount || 0} viga`
                          : `${row.lightCheckSummary?.changedSourceCount || 0} changes, ${row.lightCheckSummary?.errorCount || 0} errors`}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <div className="ra-td-stack">
                    <div className="ra-chiprow">
                      <span
                        className="ra-chip"
                        data-tone={webIngested ? "ok" : invalidFiles > 0 ? "err" : allFilesValid ? "ok" : "dim"}
                        title={
                          webIngested
                            ? row.fileCount < 4
                              ? `${et ? "Admin failid" : "Admin files"}: ${row.fileCount}/4`
                              : undefined
                            : allFilesValid
                              ? et ? "Kõik failid korras" : "All files valid"
                              : invalidFiles > 0
                                ? et ? "Sisaldab vigaseid faile" : "Has invalid files"
                                : et ? "Admin failid puuduvad" : "Admin files missing"
                        }
                      >
                        {webIngested ? (et ? "KOV ingestitud" : "KOV ingested") : `${row.fileCount}/4 KOV`}
                      </span>
                      <span
                        className="ra-chip"
                        data-tone={
                          rtIngested
                            ? "ok"
                            : rtInvalidCount > 0
                              ? "err"
                              : rtValidCount === rtRequiredCount
                                ? "ok"
                                : rtMissingCount > 0
                                  ? "dim"
                                  : "warn"
                        }
                        title={
                          rtIngested
                            ? (row.rtFileCount || 0) < rtRequiredCount
                              ? `${et ? "Admin RT fail" : "Admin RT file"}: ${row.rtFileCount || 0}/${rtRequiredCount}`
                              : undefined
                            : rtMissingCount > 0
                              ? et ? "Admin RT fail puudub" : "Admin RT file missing"
                              : rtInvalidCount > 0
                                ? et ? "RT vigane" : "RT invalid"
                                : rtValidCount === rtRequiredCount
                                  ? et ? "RT korras" : "RT valid"
                                  : et ? "RT pooleli" : "RT pending"
                        }
                      >
                        {rtIngested ? (et ? "RT ingestitud" : "RT ingested") : `${row.rtFileCount || 0}/${rtRequiredCount} RT`}
                      </span>
                    </div>
                    {(Number(row.rtLightCheckSummary?.changedSourceCount || 0) > 0 || Number(row.rtLightCheckSummary?.errorCount || 0) > 0) ? (
                      <span className="ra-chip" data-tone="warn">
                        {et
                          ? `RT: ${row.rtLightCheckSummary?.changedSourceCount || 0} muudatust, ${row.rtLightCheckSummary?.errorCount || 0} viga`
                          : `RT: ${row.rtLightCheckSummary?.changedSourceCount || 0} changes, ${row.rtLightCheckSummary?.errorCount || 0} errors`}
                      </span>
                    ) : null}
                    <span
                      className="ra-chip"
                      data-tone={readinessTone(readinessState)}
                      title={`KOV: ${ingestStatusLabel(row.ingestStatus)}${row.lastIngestedAt ? ` (${formatDateTime(row.lastIngestedAt, locale)})` : ""} · RT: ${ingestStatusLabel(row.rtIngestStatus)}${row.rtLastIngestedAt ? ` (${formatDateTime(row.rtLastIngestedAt, locale)})` : ""}`}
                    >
                      {readinessState === "BOTH_INGESTED"
                        ? et ? "Mõlemad ingestitud" : "Both ingested"
                        : readinessState === "BOTH_READY"
                          ? et ? "Mõlemad valmis" : "Both ready"
                          : readinessState === "WEB_READY"
                            ? et ? "KOV veeb valmis" : "KOV web ready"
                            : readinessState === "RT_READY"
                              ? et ? "Ainult RT valmis" : "Only RT ready"
                              : et ? "Kihid pooleli" : "Layers incomplete"}
                    </span>
                    {row.lastIngestError ? (
                      <div className="ra-td-sub" style={{ color: "var(--status-error)" }}>{row.lastIngestError}</div>
                    ) : null}
                    {row.rtLastIngestError ? (
                      <div className="ra-td-sub" style={{ color: "var(--status-error)" }}>{row.rtLastIngestError}</div>
                    ) : null}
                  </div>
                </td>
                <td>
                  <div className="ra-actions" style={{ flexWrap: "nowrap" }}>
                    <Button
                      variant="primary"
                      size="2xs"
                      onClick={event => stopEvent(event, () => onOpenEditor(row.slug))}
                    >
                      {et ? "Ava" : "Open"}
                    </Button>
                    <RagRowMenu
                      ariaLabel={et ? `Toimingud: ${row.displayName}` : `Actions: ${row.displayName}`}
                      items={[
                        {
                          key: "revalidate",
                          label: rowBusy ? (et ? "Valideerin..." : "Revalidating...") : et ? "Valideeri KOV failid" : "Revalidate KOV files",
                          onSelect: () => onRevalidateRow(row.slug),
                          disabled: rowBusy
                        },
                        {
                          key: "revalidate-rt",
                          label: rtRowBusy ? (et ? "Valideerin RT..." : "Revalidating RT...") : et ? "Valideeri RT fail" : "Validate RT file",
                          onSelect: () => onRevalidateRtRow(row.slug),
                          disabled: rtRowBusy
                        },
                        {
                          key: "ingest",
                          label: ingestBusy ? (et ? "Saadan..." : "Ingesting...") : et ? "Ingest KOV veeb" : "Ingest KOV web",
                          onSelect: () => onIngestRow(row.slug),
                          disabled: !canIngest || ingestBusy
                        },
                        {
                          key: "replace",
                          label: ingestBusy ? (et ? "Asendan..." : "Replacing...") : et ? "Asenda veebikiht RAG-is" : "Replace web layer in RAG",
                          onSelect: () => onReplaceIngestRow?.(row.slug),
                          disabled: !canIngest || ingestBusy,
                          title: et ? "Kustutab enne sama KOV-i vana veebikihi ja ingestib uuesti" : "Remove old web layer for this municipality before ingesting again"
                        },
                        {
                          key: "ingest-rt",
                          label: rtIngestBusy ? (et ? "RT saadan..." : "RT ingesting...") : "RT ingest",
                          onSelect: () => onIngestRtRow(row.slug),
                          disabled: !canRtIngest || rtIngestBusy
                        }
                      ]}
                    />
                    {(rowBusy || rtRowBusy || ingestBusy || rtIngestBusy) ? (
                      <span className="ra-chip" data-tone="warn">
                        {et ? "Töös..." : "Busy..."}
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
