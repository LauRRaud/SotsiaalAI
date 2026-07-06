"use client";

import Button from "@/components/ui/Button";
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

function stopEvent(event, cb) {
  event.stopPropagation();
  cb?.();
}

export default function KovTable({
  rows,
  locale,
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
    <div>
      <div>
        <div>
          <span>{et ? "Valitud" : "Selected"}:</span> {selectedCount}
        </div>
        <div>
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

      <div className="overflow-x-auto">
      <table>
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

            return (
              <tr
                key={row.slug}
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
                    onClick={event => stopEvent(event, () => onSelect(row.slug))}
                  >
                    <div>{row.displayName}</div>
                    <div>{row.slug}</div>
                  </button>
                </td>
                <td>
                  <div>{row.county || "-"}</div>
                  <div>{row.type === "LINN" ? "Linn" : "Vald"}</div>
                </td>
                <td>
                  <span>{statusLabel(row.status)}</span>
                  {row.readyForIngest ? (
                    <div>
                      {et ? "Valmis" : "Ready"}
                    </div>
                  ) : null}
                  <div>
                    <span>
                      {reviewStateLabel(row.reviewSchedule?.state, et)}
                    </span>
                  </div>
                    <div>
                      {row.reviewSchedule?.nextFullReviewAt
                      ? `${et ? "Järgmine täisülevaatus" : "Next full review"}: ${formatDateTime(row.reviewSchedule.nextFullReviewAt, locale)}`
                      : row.checkedAt ? formatDateTime(row.checkedAt, locale) : "-"}
                  </div>
                  <div>
                    {autoCheckStatusLabel(row.autoCheckStatus)}
                  </div>
                  {(Number(row.lightCheckSummary?.changedSourceCount || 0) > 0 || Number(row.lightCheckSummary?.errorCount || 0) > 0) ? (
                    <div>
                      {et
                        ? `${row.lightCheckSummary?.changedSourceCount || 0} muudatust, ${row.lightCheckSummary?.errorCount || 0} viga`
                        : `${row.lightCheckSummary?.changedSourceCount || 0} changes, ${row.lightCheckSummary?.errorCount || 0} errors`}
                    </div>
                  ) : null}
                </td>
                <td>
                  <div>
                    {webIngested ? (et ? "KOV ingestitud" : "KOV ingested") : `${row.fileCount}/4 KOV`}
                  </div>
                  <div>
                    {rtIngested ? (et ? "RT ingestitud" : "RT ingested") : `${row.rtFileCount || 0}/${rtRequiredCount} RT`}
                  </div>
                  {webIngested && row.fileCount < 4 ? (
                    <div>
                      {et ? "Admin failid" : "Admin files"}: {row.fileCount}/4
                    </div>
                  ) : null}
                  {rtIngested && (row.rtFileCount || 0) < rtRequiredCount ? (
                    <div>
                      {et ? "Admin RT fail" : "Admin RT file"}: {row.rtFileCount || 0}/{rtRequiredCount}
                    </div>
                  ) : null}
                  {!webIngested ? (
                    <div>
                      <span>
                        {allFilesValid
                          ? et ? "Kõik failid korras" : "All files valid"
                          : invalidFiles > 0
                            ? et ? "Sisaldab vigaseid faile" : "Has invalid files"
                            : et ? "Admin failid puuduvad" : "Admin files missing"}
                      </span>
                    </div>
                  ) : null}
                  {!rtIngested ? (
                    <div>
                      <span>
                        {rtMissingCount > 0
                            ? et ? "Admin RT fail puudub" : "Admin RT file missing"
                            : rtInvalidCount > 0
                              ? et ? "RT vigane" : "RT invalid"
                              : rtValidCount === rtRequiredCount
                                ? et ? "RT korras" : "RT valid"
                                : et ? "RT pooleli" : "RT pending"}
                      </span>
                    </div>
                  ) : null}
                  {(Number(row.rtLightCheckSummary?.changedSourceCount || 0) > 0 || Number(row.rtLightCheckSummary?.errorCount || 0) > 0) ? (
                    <div>
                      {et
                        ? `RT: ${row.rtLightCheckSummary?.changedSourceCount || 0} muudatust, ${row.rtLightCheckSummary?.errorCount || 0} viga`
                        : `RT: ${row.rtLightCheckSummary?.changedSourceCount || 0} changes, ${row.rtLightCheckSummary?.errorCount || 0} errors`}
                    </div>
                  ) : null}
                  <div>
                    <span>
                      {row.combinedReadiness?.state === "BOTH_INGESTED"
                        ? et ? "Mõlemad ingestitud" : "Both ingested"
                        : row.combinedReadiness?.state === "BOTH_READY"
                          ? et ? "Mõlemad valmis" : "Both ready"
                          : row.combinedReadiness?.state === "WEB_READY"
                            ? et ? "KOV veeb valmis" : "KOV web ready"
                            : row.combinedReadiness?.state === "RT_READY"
                              ? et ? "Ainult RT valmis" : "Only RT ready"
                              : et ? "Kihid pooleli" : "Layers incomplete"}
                    </span>
                  </div>
                  <div>
                    <span>
                      KOV: {ingestStatusLabel(row.ingestStatus)}
                    </span>
                    <div>
                      {row.lastIngestedAt
                        ? `${et ? "Viimane" : "Last"}: ${formatDateTime(row.lastIngestedAt, locale)}`
                        : row.ingestSummary?.canIngest ? (et ? "Valmis ingestiks" : "Ready") : (et ? "Pole valmis" : "Not ready")}
                    </div>
                  </div>
                  <div>
                    <span>
                      RT: {ingestStatusLabel(row.rtIngestStatus)}
                    </span>
                    <div>
                      {row.rtLastIngestedAt
                        ? `${et ? "Viimane" : "Last"}: ${formatDateTime(row.rtLastIngestedAt, locale)}`
                        : row.rtIngestSummary?.canIngest ? (et ? "Valmis ingestiks" : "Ready") : (et ? "Pole valmis" : "Not ready")}
                    </div>
                  </div>
                  {row.lastIngestError ? (
                    <div>{row.lastIngestError}</div>
                  ) : null}
                  {row.rtLastIngestError ? (
                    <div>{row.rtLastIngestError}</div>
                  ) : null}
                </td>
                <td>
                  <div>
                    <Button
                      variant="primary"
                      size="2xs"
                      onClick={event => stopEvent(event, () => onOpenEditor(row.slug))}
                    >
                      {et ? "Ava" : "Open"}
                    </Button>
                    <Button
                      variant="primary"
                      size="2xs"
                      onClick={event => stopEvent(event, () => onRevalidateRow(row.slug))}
                      disabled={rowBusy}
                    >
                      {rowBusy ? (et ? "Valideerin..." : "Revalidating...") : et ? "Valideeri" : "Revalidate"}
                    </Button>
                    <Button
                      variant="primary"
                      size="2xs"
                      onClick={event => stopEvent(event, () => onRevalidateRtRow(row.slug))}
                      disabled={rtRowBusy}
                    >
                      {rtRowBusy ? (et ? "RT val..." : "RT val...") : et ? "Valideeri RT" : "Validate RT"}
                    </Button>
                    <Button
                      variant="primary"
                      size="2xs"
                      onClick={event => stopEvent(event, () => onIngestRow(row.slug))}
                      disabled={!canIngest || ingestBusy}
                    >
                      {ingestBusy ? (et ? "Saadan..." : "Ingesting...") : et ? "Ingest" : "Ingest"}
                    </Button>
                    <Button
                      variant="primary"
                      size="2xs"
                      onClick={event => stopEvent(event, () => onReplaceIngestRow?.(row.slug))}
                      disabled={!canIngest || ingestBusy}
                      title={et ? "Kustutab enne sama KOV-i vana veebikihi ja ingestib uuesti" : "Remove old web layer for this municipality before ingesting again"}
                    >
                      {ingestBusy ? (et ? "Asendan..." : "Replacing...") : et ? "Asenda" : "Replace"}
                    </Button>
                    <Button
                      variant="primary"
                      size="2xs"
                      onClick={event => stopEvent(event, () => onIngestRtRow(row.slug))}
                      disabled={!canRtIngest || rtIngestBusy}
                    >
                      {rtIngestBusy ? (et ? "RT saadan..." : "RT ingesting...") : "RT ingest"}
                    </Button>
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
