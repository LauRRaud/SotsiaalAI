"use client";

import { useCallback, useRef } from "react";

import RagAdminAlert from "./RagAdminAlert";
import KovDetailPanel from "./kov/KovDetailPanel";
import KovEmptyState from "./kov/KovEmptyState";
import KovFilters from "./kov/KovFilters";
import KovSummaryCards from "./kov/KovSummaryCards";
import KovTable from "./kov/KovTable";
import { useKovAdminController } from "./kov/useKovAdminController";

export default function RagAdminKovView({ locale, initialItems = [] }) {
  const controller = useKovAdminController(locale, initialItems);
  const detailPanelRef = useRef(null);

  const {
    et,
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
  const scrollToDetailPanel = useCallback((behavior = "smooth") => {
    const node = detailPanelRef.current;
    if (!node) return;

    const offset = 92;
    const top = Math.max(0, node.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({
      top,
      behavior
    });
  }, []);

  const openEditor = useCallback(
    slug => {
      selectEntry(slug);
      setEditingLinks(true);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          scrollToDetailPanel("smooth");
        });
      });

      window.setTimeout(() => scrollToDetailPanel("smooth"), 180);
    },
    [scrollToDetailPanel, selectEntry, setEditingLinks]
  );

  return (
    <div>
      <RagAdminAlert message={message} onDismiss={() => setMessage(null)} />

      <KovSummaryCards cards={summaryCards} />

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

      <div>
        <div>
          <div>
            {et ? "Kuidas see vaade töötab" : "How this view works"}
          </div>
          <div>
            {et
              ? "Vali nimekirjast KOV. Rea nupud tähendavad: Ava = ava selle KOV detail, Valideeri = kontrolli KOV veebikihi failid uuesti, Ingest = saada KOV veebikiht RAG-i. Detailis saad muuta linke ja staatuseid, laadida faile üles ning hallata eraldi KOV veebi ja Riigi Teataja kihti."
              : "Choose a municipality from the list. Row actions mean: Open = open that municipality detail, Revalidate = run file validation again for the KOV web layer, Ingest = send the KOV web layer into RAG. In the detail you can edit links and statuses, upload files, and manage the KOV web and Riigi Teataja layers separately."}
          </div>
        </div>
      </div>

      {loading ? (
        <div>
          <div>
            <div>{et ? "Laen KOV andmeid..." : "Loading municipality admin data..."}</div>
          </div>
        </div>
      ) : null}

      <div>
        <div ref={detailPanelRef} className="[overflow-anchor:none]">
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
        {filteredItems.length ? (
          <KovTable
            rows={filteredItems}
            locale={locale}
            selectedSlug={selectedSlug}
            selectedSlugs={selectedSlugs}
            selectedCount={selectedCount}
            allVisibleSelected={allVisibleSelected}
            onSelect={selectEntry}
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
      </div>
    </div>
  );
}
