"use client";

import { useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import CardTitle from "@/components/ui/CardTitle";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import ModalConfirm from "@/components/ui/ModalConfirm";
import DocumentsDropdown from "@/components/documents/DocumentsDropdown";
import MaterialsAdminSubmissionsPanel from "@/components/materials/MaterialsAdminSubmissionsPanel";
import { localizePath } from "@/lib/localizePath";

import RagAdminAlert from "./RagAdminAlert";
import RagAdminDetailModal from "./RagAdminDetailModal";
import {
  formatDateTime,
  formatPdfRange
} from "./ragAdminShared";

function renderTags(tags) {
  if (!tags || !tags.length) {
    return <span className="ra-td-sub">-</span>;
  }

  const visible = tags.slice(0, 4);
  const extra = tags.length - visible.length;

  return (
    <span className="ra-chiprow">
      {visible.map(tag => (
        <span key={tag} className="ra-chip" data-tone="dim">
          {tag}
        </span>
      ))}
      {extra > 0 ? <span className="ra-chip" data-tone="dim">+{extra}</span> : null}
    </span>
  );
}

function getDocSourceKey(doc) {
  const source = String(doc?.url || doc?.source_url || doc?.source_path || "").trim();
  if (!source) return "NO_SOURCE";

  if (/^https?:\/\//i.test(source)) {
    try {
      return new URL(source).hostname.replace(/^www\./i, "") || "NO_SOURCE";
    } catch {
      return source;
    }
  }

  return "LOCAL_FILE";
}

function formatSourceLabel(value) {
  if (value === "LOCAL_FILE") return "Kohalik fail";
  if (value === "NO_SOURCE") return "Allikas puudub";
  return value;
}

const SOURCE_TYPE_LABELS = {
  application_form: "KOV vorm",
  journal_article: "Ajakirjaartikkel",
  kov_regulation: "KOV maarus",
  kov_service_info: "KOV teenuseinfo",
  municipality_kov: "KOV teenuseinfo",
  official_contact: "KOV kontakt",
  official_guideline: "Juhend",
  policy_analysis: "Poliitikaanaluus",
  research_report: "Uuring",
  uploaded_file: "Ules laaditud fail"
};

const COLLECTION_LABELS = {
  kov_regulations: "KOV RT kiht",
  national_guidelines: "Riiklik juhend",
  research_reports: "Uuringud",
  sotsiaaltoo_articles: "Ajakiri Sotsiaaltoo",
  training_materials: "Oppematerjalid"
};

const KOV_DOC_SOURCE_TYPES = new Set([
  "application_form",
  "kov_regulation",
  "kov_service_info",
  "municipality_kov",
  "official_contact"
]);

function getSemanticSourceType(doc) {
  const sourceType = String(doc?.source_type || "").trim();
  if (sourceType) return sourceType;

  const collectionId = String(doc?.collection_id || "").trim();
  if (collectionId === "sotsiaaltoo_articles") return "journal_article";
  if (collectionId === "kov_regulations") return "kov_regulation";
  return String(doc?.type || "").trim();
}

function getCollectionLabel(doc) {
  const collectionId = String(doc?.collection_id || "").trim();
  return COLLECTION_LABELS[collectionId] || collectionId;
}

function getPrimaryTypeLabel(doc) {
  const semanticType = getSemanticSourceType(doc);
  return SOURCE_TYPE_LABELS[semanticType] || semanticType || String(doc?.type || "").trim();
}

function getTechnicalTypeLabel(doc) {
  const technicalType = String(doc?.type || "").trim();
  if (!technicalType) return "";

  const semanticType = String(doc?.source_type || "").trim();
  if (semanticType && technicalType.toUpperCase() === semanticType.toUpperCase()) return "";
  return technicalType;
}

function normalizeMunicipalitySlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");
}

function getMunicipalitySlug(doc) {
  const municipalityId = normalizeMunicipalitySlug(doc?.municipality_id);
  if (municipalityId) return municipalityId;

  const docId = String(doc?.docId || doc?.id || "").trim().toLowerCase();
  const itemMatch = docId.match(/^kov::([^:]+)::/);
  if (itemMatch?.[1]) return normalizeMunicipalitySlug(itemMatch[1]);

  const rtMatch = docId.match(/^kov-rt-(.+)$/);
  if (rtMatch?.[1]) return normalizeMunicipalitySlug(rtMatch[1]);

  const webMatch = docId.match(/^kov-(.+)$/);
  if (webMatch?.[1]) return normalizeMunicipalitySlug(webMatch[1]);

  return "";
}

function isKovManagedDoc(doc) {
  const sourceType = getSemanticSourceType(doc);
  if (KOV_DOC_SOURCE_TYPES.has(sourceType)) return true;

  const collectionId = String(doc?.collection_id || "").trim();
  if (collectionId === "kov_regulations" || collectionId === "kov_services") return true;

  return Boolean(getMunicipalitySlug(doc));
}

function getKovManageHref(doc) {
  const slug = getMunicipalitySlug(doc);
  const path = slug ? `/admin/rag/kov?slug=${encodeURIComponent(slug)}` : "/admin/rag/kov";
  return localizePath(path);
}

export default function RagAdminDocumentsView({ controller, showMessage = true }) {
  const [showAllTags, setShowAllTags] = useState(false);

  const {
    tr,
    locale,
    localeTag,
    message,
    resetMessage,
    loadingList,
    docMetrics,
    topTags,
    filterTags,
    toggleFilterTag,
    searchQuery,
    setSearchQuery,
    filterSection,
    setFilterSection,
    filterAudience,
    setFilterAudience,
    filterSource,
    setFilterSource,
    filterYear,
    setFilterYear,
    sortBy,
    setSortBy,
    sectionFilterOptions,
    audienceFilterOptions,
    sourceFilterOptions,
    yearFilterOptions,
    sortOptions,
    filterIssue,
    setFilterIssue,
    issueFilterOptions,
    allTags,
    selectedIds,
    handleBulkReindex,
    reindexingId,
    visibleDocs,
    filteredCount,
    toggleSelectAllVisible,
    previewId,
    setPreviewId,
    toggleSelect,
    statusLabels,
    previewDoc,
    getAudienceLabel,
    canEditDocMeta,
    openDetail,
    handleReindex,
    handleDelete,
    deletingId,
    canViewSource,
    viewSource,
    visibleCount,
    setVisibleCount,
    filteredDocs,
    deleteConfirmDocId,
    confirmDelete,
    closeDeleteConfirm,
    normalizedDocs,
    metaTemplates,
    audienceSelectOptions
  } = controller;

  const sourceTypeSummary = useMemo(() => {
    const counts = new Map();

    for (const doc of normalizedDocs) {
      const type = getPrimaryTypeLabel(doc) || "UNKNOWN";
      counts.set(type, (counts.get(type) || 0) + 1);
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [normalizedDocs]);

  const sectionSummary = useMemo(() => {
    const counts = new Map();

    for (const doc of normalizedDocs) {
      if (!doc.section) continue;
      counts.set(doc.section, (counts.get(doc.section) || 0) + 1);
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [normalizedDocs]);

  const sourceLogicSignals = useMemo(
    () => [
      {
        label: "Praegune register",
        value: `${docMetrics.total} dokumenti`
      },
      {
        label: "Peamised allikatüübid",
        value: sourceTypeSummary.length
          ? sourceTypeSummary.map(([type, count]) => `${type} (${count})`).join(", ")
          : "Andmed puuduvad"
      },
      {
        label: "Levinumad sektsioonid",
        value: sectionSummary.length
          ? sectionSummary.map(([section, count]) => `${section} (${count})`).join(", ")
          : "Sektsioonid puuduvad"
      },
      {
        label: "Siltide kiht",
        value: topTags.length ? `${topTags.slice(0, 6).join(", ")}` : "Silte pole veel"
      }
    ],
    [docMetrics.total, sectionSummary, sourceTypeSummary, topTags]
  );

  const settingsSignals = useMemo(
    () => [
      {
        label: "Metadata mallid",
        value: `${metaTemplates.length} aktiivset malli`
      },
      {
        label: "Audience vaikevalikud",
        value: audienceSelectOptions.map(option => option.label).join(", ")
      },
      {
        label: "Meta muutmine",
        value: "FILE dokumentidel detailmodalist"
      },
      {
        label: "Taaskasutus ingestis",
        value: "Mallid ja kontroll voolavad samast admin-loogikast"
      }
    ],
    [audienceSelectOptions, metaTemplates.length]
  );

  const sourceRegistry = useMemo(() => {
    const counts = new Map();

    for (const doc of normalizedDocs) {
      const key = getDocSourceKey(doc);
      const current = counts.get(key) || { key, count: 0, kinds: new Set(), lastSeen: null };
      current.count += 1;
      current.kinds.add(getPrimaryTypeLabel(doc) || "UNKNOWN");
      const syncedAt = doc.insertedAt || doc.lastIngested || doc.updatedAt || doc.createdAt || null;
      if (syncedAt && (!current.lastSeen || new Date(syncedAt) > new Date(current.lastSeen))) {
        current.lastSeen = syncedAt;
      }
      counts.set(key, current);
    }

    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
      .slice(0, 8)
      .map(item => ({
        ...item,
        kinds: [...item.kinds].sort((a, b) => a.localeCompare(b))
      }));
  }, [normalizedDocs]);

  const activeSourceEntry = useMemo(
    () => (filterSource !== "ALL" ? sourceRegistry.find(entry => entry.key === filterSource) || null : null),
    [filterSource, sourceRegistry]
  );

  const activeSourceDocSummary = useMemo(() => {
    if (!activeSourceEntry) return null;

    const docsForSource = normalizedDocs.filter(doc => getDocSourceKey(doc) === activeSourceEntry.key);
    const latestDoc = docsForSource
      .slice()
      .sort((a, b) => new Date(b.insertedAt || b.updatedAt || b.createdAt || 0) - new Date(a.insertedAt || a.updatedAt || a.createdAt || 0))[0];

    return {
      count: docsForSource.length,
      sections: [...new Set(docsForSource.map(doc => doc.section).filter(Boolean))].slice(0, 4),
      audiences: [...new Set(docsForSource.map(doc => doc.audience).filter(Boolean))].slice(0, 4),
      latestTitle: latestDoc?.title || null
    };
  }, [activeSourceEntry, normalizedDocs]);

  const selectedFilterTags = useMemo(
    () => filterTags.filter(tag => allTags.includes(tag)),
    [allTags, filterTags]
  );

  return (
    <div className="ra-shell-flow">
      {showMessage ? <RagAdminAlert message={message} onDismiss={resetMessage} /> : null}

      <div className="ra-modules">
        <button
          type="button"
          className="ra-module"
          onClick={() => document.getElementById("rag-documents-register")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <span className="ra-module-title">Dokumendid</span>
          <span className="ra-module-desc">Olemasolevad dokumendid, detailvaade, meta muutmine, reindex ja source view.</span>
          <span className="ra-module-meta">
            <span className="ra-chip" data-tone="dim">{docMetrics.total} kokku</span>
            <span className="ra-chip" data-tone="dim">{docMetrics.filtered} filtris</span>
          </span>
        </button>

        <button
          type="button"
          className="ra-module"
          onClick={() => document.getElementById("rag-documents-sources")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <span className="ra-module-title">Allikate loogika</span>
          <span className="ra-module-desc">Vaata, millistest failidest, URL-idest ja sisutüüpidest register praegu koosneb.</span>
          <span className="ra-module-meta">
            <span className="ra-chip" data-tone="dim">{sourceTypeSummary.length} peamist tüüpi</span>
            <span className="ra-chip" data-tone="dim">{topTags.length} kiiret silti</span>
          </span>
        </button>

        <button
          type="button"
          className="ra-module"
          onClick={() => document.getElementById("rag-documents-settings")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <span className="ra-module-title">Mallid ja reeglid</span>
          <span className="ra-module-desc">Koht metadata mallide, vaikevalikute ja dokumendihalduse reeglite jaoks.</span>
          <span className="ra-module-meta">
            <span className="ra-chip" data-tone="dim">{metaTemplates.length} malli</span>
            <span className="ra-chip" data-tone="dim">{audienceSelectOptions.length} audience valikut</span>
          </span>
        </button>
      </div>

      <div id="rag-documents-register" className="ra-card">
          <div className="ra-card-head">
            <div>
              <CardTitle className="ra-card-title">{tr("admin.rag.documents.title")}</CardTitle>
              <p className="ra-card-sub">
                {tr("admin.rag.documents.summary", {
                  total: docMetrics.total,
                  filtered: docMetrics.filtered,
                  pending: docMetrics.pending,
                  processing: docMetrics.processing,
                  completed: docMetrics.completed,
                  failed: docMetrics.failed
                })}
              </p>
            </div>
          </div>
          {topTags.length ? (
            <div className="ra-chiprow">
              <span className="ra-label">{tr("admin.rag.documents.quick_tags")}</span>
              {topTags.map(tag => (
                <button
                  type="button"
                  className="ra-chip"
                  data-checked={filterTags.includes(tag) ? "true" : "false"}
                  onClick={() => toggleFilterTag(tag)}
                  key={tag}
                >
                  {tag}
                </button>
              ))}
            </div>
          ) : null}

          <div className="ra-toolbar">
            <div className="ra-toolbar-search">
            <Input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder={tr("admin.rag.documents.search_placeholder")}
            />
            </div>
            <DocumentsDropdown
              ariaLabel={tr("admin.rag.documents.filters.all_sections")}
              value={filterSection}
              onChange={setFilterSection}
              options={sectionFilterOptions}
            />
            <DocumentsDropdown
              ariaLabel={tr("admin.rag.documents.filters.all_audiences")}
              value={filterAudience}
              onChange={setFilterAudience}
              options={audienceFilterOptions}
            />
            <DocumentsDropdown
              ariaLabel="Koik allikad"
              value={filterSource}
              onChange={setFilterSource}
              options={sourceFilterOptions}
            />
            <DocumentsDropdown
              ariaLabel={tr("admin.rag.documents.filters.all_years")}
              value={filterYear}
              onChange={setFilterYear}
              options={yearFilterOptions}
            />
            <DocumentsDropdown
              ariaLabel={tr("admin.rag.documents.sort.recent")}
              value={sortBy}
              onChange={setSortBy}
              options={sortOptions}
            />
          </div>

          <div className="ra-toolbar">
            <DocumentsDropdown
              ariaLabel={tr("admin.rag.documents.filters.all_issues")}
              value={filterIssue}
              onChange={setFilterIssue}
              options={issueFilterOptions}
            />
            {allTags.length ? (
              <div className="ra-form" style={{ flex: "1 1 16rem" }}>
                <div className="ra-form-row">
                  <Button
                    type="button"
                    size="xs"
                    aria-expanded={showAllTags ? "true" : "false"}
                    onClick={() => setShowAllTags(current => !current)}
                  >
                    {showAllTags ? "Peida sildid" : `Kõik sildid (${allTags.length})`}
                  </Button>
                  <span className="ra-td-sub">
                    {selectedFilterTags.length ? `Valitud ${selectedFilterTags.length}` : "Lisasildid on peidetud"}
                  </span>
                </div>
                {selectedFilterTags.length ? (
                  <div aria-label="Valitud sildid" className="ra-chiprow">
                    {selectedFilterTags.map(tag => (
                      <button
                        type="button"
                        className="ra-chip"
                        data-checked="true"
                        key={tag}
                        onClick={() => toggleFilterTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
                {showAllTags ? (
                  <div className="ra-chiprow">
                    {allTags.map(tag => (
                      <button
                        type="button"
                        className="ra-chip"
                        data-checked={filterTags.includes(tag) ? "true" : "false"}
                        key={tag}
                        onClick={() => toggleFilterTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="ra-td-sub">Silte pole saadaval.</div>
            )}
            {selectedIds.size ? (
              <Button
                onClick={handleBulkReindex}
                disabled={reindexingId !== null}
              >
                {tr("admin.rag.documents.reindex_selected", { count: selectedIds.size })}
              </Button>
            ) : null}
          </div>

          <div className="ra-form">
            <div className="ra-bulkbar">
              <Checkbox
                onChange={toggleSelectAllVisible}
                checked={Boolean(visibleDocs.length && visibleDocs.every(doc => selectedIds.has(doc.id)))}
                label={tr("admin.rag.documents.select_visible")}
              />
              <div className="ra-toolbar-meta">
                <span>{tr("admin.rag.documents.total", { total: docMetrics.total })}</span>
                <span aria-hidden="true">|</span>
                <span>{tr("admin.rag.documents.filtered", { count: filteredCount })}</span>
                <span aria-hidden="true">|</span>
                <span>{tr("admin.rag.documents.showing", { count: visibleDocs.length })}</span>
                {selectedIds.size ? <span>{tr("admin.rag.documents.selected", { count: selectedIds.size })}</span> : null}
              </div>
            </div>

            <div className="ra-split">
              <div className="ra-rowlist">
                {visibleDocs.map(doc => {
                  const status = doc.status || "COMPLETED";
                  const syncedAt = doc.insertedAt || doc.lastIngested || doc.updatedAt || doc.createdAt || null;
                  const isSelected = selectedIds.has(doc.id);
                  const isActive = doc.id === previewId;
                  const docType = getPrimaryTypeLabel(doc);
                  const collectionLabel = getCollectionLabel(doc);

                  return (
                    <div
                      key={doc.id || doc._idx}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isActive}
                      className="ra-row"
                      onClick={() => setPreviewId(doc.id)}
                      onKeyDown={event => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setPreviewId(doc.id);
                        }
                      }}
                    >
                      <div onClick={event => event.stopPropagation()}>
                        <Checkbox
                          bare
                          checked={isSelected}
                          onChange={() => toggleSelect(doc.id)}
                          aria-label={doc.title || tr("admin.rag.documents.untitled")}
                        />
                      </div>
                      <div className="ra-row-body">
                        <div className="ra-row-title">{doc.title || tr("admin.rag.documents.untitled")}</div>
                        <div className="ra-chiprow">
                          <span className="ra-chip" data-tone={status === "FAILED" ? "err" : status === "COMPLETED" ? "ok" : "dim"}>
                            {statusLabels[status] || status}
                          </span>
                          {docType ? <span className="ra-chip" data-tone="dim">{docType}</span> : null}
                          {collectionLabel ? <span className="ra-chip" data-tone="dim">{collectionLabel}</span> : null}
                          {doc.section ? <span className="ra-chip" data-tone="dim">{doc.section}</span> : null}
                          {doc.year ? <span className="ra-chip" data-tone="dim">{doc.year}</span> : null}
                          {doc.issueLabel ? (
                            <span className="ra-chip" data-tone="dim">
                              {tr("admin.rag.documents.issue_label", { issue: doc.issueLabel })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {syncedAt ? <div className="ra-row-time">{formatDateTime(syncedAt, localeTag)}</div> : null}
                    </div>
                  );
                })}

                {!visibleDocs.length ? (
                  <div className="ra-empty">
                    {loadingList ? tr("admin.common.loading_data") : tr("admin.rag.documents.no_results")}
                  </div>
                ) : null}
              </div>

              <div className="ra-card ra-card--sticky">
                {previewDoc ? (
                  (() => {
                    const status = previewDoc.status || "COMPLETED";
                    const syncedAt = previewDoc.insertedAt || previewDoc.lastIngested || previewDoc.updatedAt || previewDoc.createdAt || null;
                    const pageLabel = previewDoc.pageRange || formatPdfRange(previewDoc) || "-";
                    const source = previewDoc.url || previewDoc.source_url || previewDoc.source_path || "";
                    const typeLabel = getPrimaryTypeLabel(previewDoc);
                    const technicalTypeLabel = getTechnicalTypeLabel(previewDoc);
                    const collectionLabel = getCollectionLabel(previewDoc);
                    const kovManagedDoc = isKovManagedDoc(previewDoc);
                    const kovManageHref = kovManagedDoc ? getKovManageHref(previewDoc) : "";
                    const canEdit = canEditDocMeta(previewDoc) && !kovManagedDoc;
                    const canView = canViewSource(previewDoc);
                    const canReindex = !kovManagedDoc;
                    const canDelete = !kovManagedDoc;

                    return (
                      <div className="ra-form">
                        <div className="ra-card-head">
                          <div>
                            <div className="ra-row-title">{previewDoc.title || tr("admin.rag.documents.untitled")}</div>
                            {previewDoc.description ? <div className="ra-td-sub">{previewDoc.description}</div> : null}
                          </div>
                          <div className="ra-chiprow">
                            <span className="ra-chip" data-tone={status === "FAILED" ? "err" : status === "COMPLETED" ? "ok" : "dim"}>
                              {statusLabels[status] || status}
                            </span>
                            {syncedAt ? <span className="ra-td-sub">{formatDateTime(syncedAt, localeTag)}</span> : null}
                          </div>
                        </div>
                        <div className="ra-kv">
                          <div>
                            <span>{tr("admin.rag.details.section")}</span>
                            <span>{previewDoc.section || "-"}</span>
                          </div>
                          <div>
                            <span>{tr("admin.rag.details.authors")}</span>
                            <span>{(previewDoc.authors || []).join(", ") || "-"}</span>
                          </div>
                          <div>
                            <span>{tr("admin.rag.details.year_issue")}</span>
                            <span>
                              {previewDoc.year || "-"}
                              {previewDoc.issueLabel ? ` / ${previewDoc.issueLabel}` : ""}
                            </span>
                          </div>
                          <div>
                            <span>{tr("admin.rag.details.audience")}</span>
                            <span>{getAudienceLabel(previewDoc.audience)}</span>
                          </div>
                          <div>
                            <span>{tr("admin.rag.details.page")}</span>
                            <span>{pageLabel}</span>
                          </div>
                          <div>
                            <span>DocId</span>
                            <span className="ra-mono">{previewDoc.docId || previewDoc.id || "-"}</span>
                          </div>
                          {previewDoc.journalTitle ? (
                            <div>
                              <span>{tr("admin.rag.details.issue")}</span>
                              <span>{previewDoc.journalTitle}</span>
                            </div>
                          ) : null}
                          {previewDoc.language ? (
                            <div>
                              <span>{tr("admin.rag.details.language")}</span>
                              <span>{previewDoc.language}</span>
                            </div>
                          ) : null}
                          {typeLabel ? (
                            <div>
                              <span>{tr("admin.rag.details.type")}</span>
                              <span>{typeLabel}</span>
                            </div>
                          ) : null}
                          {collectionLabel ? (
                            <div>
                              <span>Collection</span>
                              <span>{collectionLabel}</span>
                            </div>
                          ) : null}
                          {technicalTypeLabel ? (
                            <div>
                              <span>System type</span>
                              <span>{technicalTypeLabel}</span>
                            </div>
                          ) : null}
                          {previewDoc.articleId ? (
                            <div>
                              <span>ArticleId</span>
                              <span className="ra-mono">{previewDoc.articleId}</span>
                            </div>
                          ) : null}
                        </div>
                        <div className="ra-chiprow">
                          <span className="ra-label">{tr("admin.rag.details.tags")}</span>
                          {renderTags(previewDoc.tags)}
                        </div>
                        {source ? (
                          <div className="ra-kv">
                            <div>
                              <span>{tr("admin.rag.details.source")}</span>
                              <span className="ra-mono">{source}</span>
                            </div>
                          </div>
                        ) : null}
                        {kovManagedDoc ? (
                          <div className="ra-note">
                            KOV seotud RAG read hallatakse paketina KOV vaates. Documents lehel ei kustutata neid uhekaupa.
                          </div>
                        ) : null}
                        <div className="ra-actions">
                          <Button
                            onClick={() => openDetail(previewDoc)}
                            disabled={!canEdit}
                          >
                            {tr("admin.rag.actions.edit")}
                          </Button>
                          <Button
                            onClick={() => handleReindex(previewDoc.id)}
                            disabled={reindexingId === previewDoc.id || !canReindex}
                          >
                            {reindexingId === previewDoc.id ? tr("admin.rag.actions.reindexing") : tr("admin.rag.actions.reindex")}
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => handleDelete(previewDoc.id)}
                            disabled={deletingId === previewDoc.id || !canDelete}
                          >
                            {deletingId === previewDoc.id ? tr("admin.rag.actions.deleting") : tr("admin.rag.actions.delete")}
                          </Button>
                          {kovManageHref ? (
                            <Button
                              as="a"
                              href={kovManageHref}
                            >
                              Halda KOV vaates
                            </Button>
                          ) : null}
                          <Button
                            onClick={() => viewSource(previewDoc)}
                            disabled={!canView}
                          >
                            {tr("admin.rag.actions.view")}
                          </Button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="ra-empty">{tr("admin.rag.details.select_material")}</div>
                )}
              </div>
            </div>
          </div>

          {visibleCount < filteredDocs.length ? (
            <div className="ra-actions" style={{ justifyContent: "center" }}>
              <Button
                onClick={() => setVisibleCount(count => count + 25)}
              >
                {tr("admin.rag.documents.load_more")} {Math.min(25, filteredDocs.length - visibleCount)}
              </Button>
            </div>
          ) : null}
      </div>

      <div className="ra-grid">
        <div id="rag-documents-sources" className="ra-col-6">
          <div className="ra-card">
            <div className="ra-card-head">
              <div>
                <CardTitle className="ra-card-title">Allikate loogika</CardTitle>
                <p className="ra-card-sub">
                  Documents ei ole ainult register. See osa koondab olemasolevast registrist nähtava allikapildi, mille otsa saab hiljem ehitada eraldi source registry.
                </p>
              </div>
            </div>

            <div className="ra-kv">
              {sourceLogicSignals.map(item => (
                <div key={item.label}>
                  <div>{item.label}</div>
                  <div>{item.value}</div>
                </div>
              ))}
            </div>

            <div className="ra-rowlist">
              {sourceRegistry.map(source => {
                const isActive = filterSource === source.key;

                return (
                  <button
                    type="button"
                    className="ra-row"
                    key={source.key}
                    aria-pressed={isActive ? "true" : "false"}
                    data-checked={isActive ? "true" : "false"}
                    onClick={() => setFilterSource(isActive ? "ALL" : source.key)}
                  >
                    <div className="ra-row-body">
                      <div className="ra-row-title">
                        {formatSourceLabel(source.key)}
                      </div>
                      <div className="ra-td-sub">
                        {source.kinds.slice(0, 3).join(", ") || "Tuup teadmata"}
                        {source.lastSeen ? ` | ${formatDateTime(source.lastSeen, localeTag)}` : ""}
                      </div>
                    </div>
                    <span className="ra-chip" data-tone="dim">{source.count}</span>
                  </button>
                );
              })}
            </div>

            {activeSourceEntry && activeSourceDocSummary ? (
              <div className="ra-note" data-tone="neutral">
                <div className="ra-label">Valitud allikas</div>
                <div className="ra-row-title">{formatSourceLabel(activeSourceEntry.key)}</div>
                <div className="ra-td-sub">
                  {activeSourceDocSummary.count} dokumenti
                  {activeSourceDocSummary.sections.length ? ` | sektsioonid: ${activeSourceDocSummary.sections.join(", ")}` : ""}
                  {activeSourceDocSummary.audiences.length ? ` | audience: ${activeSourceDocSummary.audiences.join(", ")}` : ""}
                  {activeSourceDocSummary.latestTitle ? ` | viimane: ${activeSourceDocSummary.latestTitle}` : ""}
                </div>
                <div className="ra-actions" style={{ marginTop: "0.5rem" }}>
                  <Button size="xs" onClick={() => setFilterSource("ALL")}>
                    Eemalda filter
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="ra-td-sub">
              Järgmine samm siinses alas on eraldi allikaregister: millised domeenid, failitüübid ja sisukanalid toidavad dokumentide registrit ning mis seisus need allikad on.
            </div>
          </div>
        </div>

        <div id="rag-documents-settings" className="ra-col-6">
          <div className="ra-card">
            <div className="ra-card-head">
              <div>
                <CardTitle className="ra-card-title">Dokumendihalduse seaded</CardTitle>
                <p className="ra-card-sub">
                  Siia koonduvad metadata mallid, valideerimise piirid ja ingestiga seotud vaikeväärtused. MVP-s näitab see kaart olemasolevat alust, mitte veel eraldi seadistusmoodulit.
                </p>
              </div>
            </div>

            <div className="ra-kv">
              {settingsSignals.map(item => (
                <div key={item.label}>
                  <div>{item.label}</div>
                  <div>{item.value}</div>
                </div>
              ))}
            </div>

            <div className="ra-chiprow">
              {metaTemplates.slice(0, 3).map(template => (
                <span key={template.key} className="ra-chip" data-tone="dim">
                  {template.label} · metadata mall
                </span>
              ))}
            </div>

            <div className="ra-kv">
              <div>
                <div>Registeri vaikevoog</div>
                <div>
                  Uus sisu tuleb siia kas URL ingestist, PDF+metadata voost voi artiklite lisamisest. Registri detailvaade ja meta muutmine kasutavad sama andmekihti.
                </div>
              </div>
              <div>
                <div>Jargmised seadistusastmed</div>
                <div>
                  Source registry, domeenipohised vaikeseaded, tugevamad metadata piirid ja dokumentide halduse reeglid.
                </div>
              </div>
            </div>

            <div className="ra-actions">
              <Button
                as="a"
                href={localizePath("/admin/rag/ingest", locale)}
              >
                Ava ingesti mallid
              </Button>
              <Button
                onClick={() => document.getElementById("rag-documents-register")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                Tagasi registrisse
              </Button>
            </div>
          </div>
        </div>

        <div className="ra-col-12">
          <MaterialsAdminSubmissionsPanel variant="ragAdmin" locale={locale} />
        </div>
      </div>

      {deleteConfirmDocId ? (
        <ModalConfirm
          message={tr("admin.rag.confirm.delete_doc")}
          confirmLabel={tr("admin.rag.actions.delete")}
          cancelLabel={tr("admin.rag.actions.cancel")}
          onConfirm={confirmDelete}
          onCancel={closeDeleteConfirm}
          disabled={deletingId === deleteConfirmDocId}
          busy={deletingId === deleteConfirmDocId}
          busyLabel={tr("admin.rag.actions.deleting")}
        />
      ) : null}

      <RagAdminDetailModal controller={controller} />
    </div>
  );
}
