"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import IconButton from "@/components/glass/IconButton";
import CloseIcon from "@/components/brand/icons/CloseIcon";

import RagAdminAlert from "./RagAdminAlert";
import KovCountyMap from "./kov/KovCountyMap";
import KovDetailPanel from "./kov/KovDetailPanel";
import KovEmptyState from "./kov/KovEmptyState";
import KovFilters from "./kov/KovFilters";
import KovSummaryCards from "./kov/KovSummaryCards";
import KovTable from "./kov/KovTable";
import { useKovAdminController } from "./kov/useKovAdminController";

export default function RagAdminKovView({ locale, initialItems = [] }) {
  const controller = useKovAdminController(locale, initialItems);
  const searchParams = useSearchParams();
  /* Detail elab sahtlis: avaneb AINULT selgel soovil (rea klikk, "Ava",
     ?slug= süvalink või quality-queue suunamine) — mitte lehe laadimisel,
     kus kontroller valib esimese kirje automaatselt. */
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    et,
    items,
    loading,
    query,
    setQuery,
    county,
    setCounty,
    countyOptions,
    type,
    setType,
    typeOptions,
    activity,
    setActivity,
    activityOptions,
    packageState,
    setPackageState,
    packageStateOptions,
    sort,
    setSort,
    sortOptions,
    hasActiveFilters,
    resetFilters,
    summaryCards,
    filteredItems,
    selectedEntry,
    selectedSlug,
    selectedSlugs,
    selectedCount,
    allVisibleSelected,
    selectEntry,
    toggleSelectedSlug,
    clearSelectedSlugs,
    selectAllVisible,
    statusLabel,
    ingestStatusLabel,
    rtStatusLabel,
    autoCheckStatusLabel,
    statusOptions,
    rtStatusOptions,
    editingLinks,
    setEditingLinks,
    message,
    setMessage,
    detailDraft,
    setDetailDraft,
    ragStatus,
    ragStatusLoading,
    ragResetPlan,
    remediationFocus,
    refreshSelectedRagStatus,
    saveBusy,
    saveDetail,
    cycleStatus,
    markReady,
    resetRagState,
    uploadFile,
    removeFile,
    fileBusyKey,
    revalidateBusySlug,
    revalidateRtBusySlug,
    bulkRevalidateBusy,
    bulkRevalidateRtBusy,
    bulkWebIngestBusy,
    bulkRtIngestBusy,
    bulkLightCheckBusy,
    bulkRtLightCheckBusy,
    revalidateSingle,
    revalidateSelected,
    revalidateRtSingle,
    revalidateRtSelected,
    ingestBusySlug,
    rtIngestBusySlug,
    lightCheckBusySlug,
    rtLightCheckBusySlug,
    resetBusySlug,
    ingestSingle,
    replaceIngestSingle,
    ingestSelected,
    ingestRtSingle,
    ingestRtSelected,
    lightCheckSingle,
    lightCheckRtSingle,
    lightCheckSelected,
    lightCheckRtSelected,
    markWebReviewNeeded,
    confirmWebLightCheck,
    markRtReviewNeeded,
    confirmRtLightCheck
  } = controller;

  const resultsLabel = count => (et ? `Tulemusi: ${count}` : `Results: ${count}`);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const openEntry = useCallback(
    slug => {
      selectEntry(slug);
      setDrawerOpen(true);
    },
    [selectEntry]
  );

  const openEditor = useCallback(
    slug => {
      selectEntry(slug);
      setEditingLinks(true);
      setDrawerOpen(true);
    },
    [selectEntry, setEditingLinks]
  );

  /* Süvalink (?slug=) ja quality-queue suunamine avavad sahtli ise. */
  const slugParam = String(searchParams?.get("slug") || "").trim();
  useEffect(() => {
    if (slugParam || remediationFocus) setDrawerOpen(true);
  }, [slugParam, remediationFocus]);

  /* Esc sulgeb sahtli ENNE, kui PanelFrame kogu paneeli kinni paneb
     (capture-faas + preventDefault; PanelFrame austab defaultPrevented).
     Body-klass peidab paneeli oma sulgemisristi, et kaks X-i ei kuhjuks. */
  useEffect(() => {
    if (!drawerOpen) return undefined;
    document.body.classList.add("ra-drawer-open");
    const onKey = event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.classList.remove("ra-drawer-open");
      window.removeEventListener("keydown", onKey, true);
    };
  }, [drawerOpen]);

  return (
    <div className="ra-shell-flow">
      <RagAdminAlert message={message} onDismiss={() => setMessage(null)} />

      <KovSummaryCards cards={summaryCards} />

      <KovCountyMap items={items} county={county} onCountyChange={setCounty} et={et} />

      <KovFilters
        et={et}
        query={query}
        onQueryChange={setQuery}
        county={county}
        onCountyChange={setCounty}
        countyOptions={countyOptions}
        type={type}
        onTypeChange={setType}
        typeOptions={typeOptions}
        activity={activity}
        onActivityChange={setActivity}
        activityOptions={activityOptions}
        packageState={packageState}
        onPackageStateChange={setPackageState}
        packageStateOptions={packageStateOptions}
        sort={sort}
        onSortChange={setSort}
        sortOptions={sortOptions}
        resultCount={filteredItems.length}
        searchPlaceholder={et ? "Otsi KOV nime, slugi voi marksona jargi" : "Search by municipality name, slug, or keyword"}
        resultsLabel={resultsLabel}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="ra-note" data-tone="neutral">
        <strong>{et ? "Kuidas see vaade töötab: " : "How this view works: "}</strong>
        {et
          ? "Klikk real või nupul Ava avab KOV detaili sahtlis. Rea ⋯ menüüst leiad valideerimise ja ingesti; detailis saad muuta linke ja staatuseid, laadida faile üles ning hallata eraldi KOV veebi ja Riigi Teataja kihti."
          : "Clicking a row or Open opens the municipality detail in a drawer. The row ⋯ menu holds validation and ingest actions; in the detail you can edit links and statuses, upload files, and manage the KOV web and Riigi Teataja layers separately."}
      </div>

      {loading ? (
        <div className="ra-empty">{et ? "Laen KOV andmeid..." : "Loading municipality admin data..."}</div>
      ) : null}

      {filteredItems.length ? (
        <KovTable
          rows={filteredItems}
          locale={locale}
          selectedSlug={selectedSlug}
          selectedSlugs={selectedSlugs}
          selectedCount={selectedCount}
          allVisibleSelected={allVisibleSelected}
          onSelect={openEntry}
          onToggleSelected={toggleSelectedSlug}
          onClearSelected={clearSelectedSlugs}
          onSelectAllVisible={selectAllVisible}
          statusLabel={statusLabel}
          ingestStatusLabel={ingestStatusLabel}
          autoCheckStatusLabel={autoCheckStatusLabel}
          onLightCheckSelected={lightCheckSelected}
          onLightCheckRtSelected={lightCheckRtSelected}
          onRevalidateRow={revalidateSingle}
          onRevalidateRtRow={revalidateRtSingle}
          onRevalidateSelected={revalidateSelected}
          onRevalidateRtSelected={revalidateRtSelected}
          onIngestSelected={ingestSelected}
          onIngestRtSelected={ingestRtSelected}
          onIngestRow={ingestSingle}
          onReplaceIngestRow={replaceIngestSingle}
          onIngestRtRow={ingestRtSingle}
          onOpenEditor={openEditor}
          revalidateBusySlug={revalidateBusySlug}
          revalidateRtBusySlug={revalidateRtBusySlug}
          bulkRevalidateBusy={bulkRevalidateBusy}
          bulkRevalidateRtBusy={bulkRevalidateRtBusy}
          bulkWebIngestBusy={bulkWebIngestBusy}
          bulkRtIngestBusy={bulkRtIngestBusy}
          bulkLightCheckBusy={bulkLightCheckBusy}
          bulkRtLightCheckBusy={bulkRtLightCheckBusy}
          ingestBusySlug={ingestBusySlug}
          rtIngestBusySlug={rtIngestBusySlug}
          et={et}
        />
      ) : (
        <KovEmptyState et={et} hasActiveFilters={hasActiveFilters} onReset={resetFilters} />
      )}

      {drawerOpen && selectedEntry ? (
        <>
          <div className="ra-drawer-scrim" onClick={closeDrawer} aria-hidden="true" />
          <aside
            className="ra-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={selectedEntry.displayName}
            data-esc-scope
          >
            <div className="ra-drawer-head">
              <span className="ra-label">
                {et ? "KOV detail" : "Municipality detail"} · {selectedEntry.displayName}
              </span>
              <IconButton
                aria-label={et ? "Sulge detail" : "Close detail"}
                onClick={closeDrawer}
              >
                <CloseIcon />
              </IconButton>
            </div>
            <div className="ra-drawer-body">
              <KovDetailPanel
                entry={selectedEntry}
                locale={locale}
                et={et}
                statusOptions={statusOptions}
                statusLabel={statusLabel}
                ingestStatusLabel={ingestStatusLabel}
                rtStatusLabel={rtStatusLabel}
                autoCheckStatusLabel={autoCheckStatusLabel}
                rtStatusOptions={rtStatusOptions}
                detailDraft={detailDraft}
                onDraftChange={setDetailDraft}
                ragStatus={ragStatus}
                ragStatusLoading={ragStatusLoading}
                ragResetPlan={ragResetPlan && ragResetPlan?.municipality?.slug === selectedEntry?.slug ? ragResetPlan : null}
                remediationFocus={remediationFocus}
                message={message}
                onRefreshRagStatus={() => refreshSelectedRagStatus()}
                editingLinks={editingLinks}
                onSetEditingLinks={setEditingLinks}
                onSave={saveDetail}
                saveBusy={saveBusy}
                onCycleStatus={cycleStatus}
                onMarkReady={() => selectedEntry && markReady(selectedEntry.slug)}
                onResetRagState={() => selectedEntry && resetRagState(selectedEntry.slug)}
                onIngest={() => selectedEntry && ingestSingle(selectedEntry.slug)}
                onReplaceIngest={() => selectedEntry && replaceIngestSingle(selectedEntry.slug)}
                onIngestRt={() => selectedEntry && ingestRtSingle(selectedEntry.slug)}
                onRevalidateAll={() => selectedEntry && revalidateSingle(selectedEntry.slug)}
                onRevalidateRt={() => selectedEntry && revalidateRtSingle(selectedEntry.slug)}
                onLightCheck={() => selectedEntry && lightCheckSingle(selectedEntry.slug)}
                onRtLightCheck={() => selectedEntry && lightCheckRtSingle(selectedEntry.slug)}
                onMarkWebReviewNeeded={() => selectedEntry && markWebReviewNeeded(selectedEntry.slug)}
                onConfirmWebLightCheck={() => selectedEntry && confirmWebLightCheck(selectedEntry.slug)}
                onMarkRtReviewNeeded={() => selectedEntry && markRtReviewNeeded(selectedEntry.slug)}
                onConfirmRtLightCheck={() => selectedEntry && confirmRtLightCheck(selectedEntry.slug)}
                onUploadFile={uploadFile}
                onRemoveFile={removeFile}
                fileBusyKey={fileBusyKey}
                revalidateBusy={revalidateBusySlug === selectedEntry?.slug}
                revalidateRtBusy={revalidateRtBusySlug === selectedEntry?.slug}
                ingestBusy={ingestBusySlug === selectedEntry?.slug}
                rtIngestBusy={rtIngestBusySlug === selectedEntry?.slug}
                lightCheckBusy={lightCheckBusySlug === selectedEntry?.slug}
                rtLightCheckBusy={rtLightCheckBusySlug === selectedEntry?.slug}
                resetBusy={resetBusySlug === selectedEntry?.slug}
              />
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
