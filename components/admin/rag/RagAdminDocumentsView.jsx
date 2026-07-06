"use client";

import { useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import CardTitle from "@/components/ui/CardTitle";
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
    return <span>-</span>;
  }

  const visible = tags.slice(0, 4);
  const extra = tags.length - visible.length;

  return (
    <div>
      {visible.map(tag => (
        <span key={tag}>
          {tag}
        </span>
      ))}
      {extra > 0 ? <span>+{extra}</span> : null}
    </div>
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
    <div>
      {showMessage ? <RagAdminAlert message={message} onDismiss={resetMessage} /> : null}

      <div>
        <button
          type="button"
          onClick={() => document.getElementById("rag-documents-register")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <span>Register</span>
          <div>
            <div>Dokumendid</div>
            <div>Olemasolevad dokumendid, detailvaade, meta muutmine, reindex ja source view.</div>
          </div>
          <div>
            <span>{docMetrics.total} kokku</span>
            <span>{docMetrics.filtered} filtris</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => document.getElementById("rag-documents-sources")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <span>Allikad</span>
          <div>
            <div>Allikate loogika</div>
            <div>Vaata, millistest failidest, URL-idest ja sisutüüpidest register praegu koosneb.</div>
          </div>
          <div>
            <span>{sourceTypeSummary.length} peamist tüüpi</span>
            <span>{topTags.length} kiiret silti</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => document.getElementById("rag-documents-settings")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <span>Seaded</span>
          <div>
            <div>Mallid ja reeglid</div>
            <div>Koht metadata mallide, vaikevalikute ja dokumendihalduse reeglite jaoks.</div>
          </div>
          <div>
            <span>{metaTemplates.length} malli</span>
            <span>{audienceSelectOptions.length} audience valikut</span>
          </div>
        </button>
      </div>

      <div id="rag-documents-register">
        <div>
          <div>
            <div>
              <CardTitle>{tr("admin.rag.documents.title")}</CardTitle>
              <div>
                {tr("admin.rag.documents.summary", {
                  total: docMetrics.total,
                  filtered: docMetrics.filtered,
                  pending: docMetrics.pending,
                  processing: docMetrics.processing,
                  completed: docMetrics.completed,
                  failed: docMetrics.failed
                })}
              </div>
            </div>
          </div>
          {topTags.length ? (
            <div>
              <span>{tr("admin.rag.documents.quick_tags")}</span>
              {topTags.map(tag => (
                <button
                  type="button"
                  onClick={() => toggleFilterTag(tag)}
                  key={tag}
                >
                  {tag}
                </button>
              ))}
            </div>
          ) : null}

          <div>
            <Input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder={tr("admin.rag.documents.search_placeholder")}
            />
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

          <div>
            <DocumentsDropdown
              ariaLabel={tr("admin.rag.documents.filters.all_issues")}
              value={filterIssue}
              onChange={setFilterIssue}
              options={issueFilterOptions}
            />
            {allTags.length ? (
              <div>
                <div>
                  <Button
                    type="button"
                    aria-expanded={showAllTags ? "true" : "false"}
                    onClick={() => setShowAllTags(current => !current)}
                  >
                    {showAllTags ? "Peida sildid" : `Kõik sildid (${allTags.length})`}
                  </Button>
                  <span>
                    {selectedFilterTags.length ? `Valitud ${selectedFilterTags.length}` : "Lisasildid on peidetud"}
                  </span>
                </div>
                {selectedFilterTags.length ? (
                  <div aria-label="Valitud sildid">
                    {selectedFilterTags.map(tag => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleFilterTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
                {showAllTags ? (
                  <div>
                    <div>
                      {allTags.map(tag => (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => toggleFilterTag(tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div>Silte pole saadaval.</div>
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

          <div>
            <div>
              <label>
                <input
                  type="checkbox"
                  onChange={toggleSelectAllVisible}
                  checked={Boolean(visibleDocs.length && visibleDocs.every(doc => selectedIds.has(doc.id)))}
                />
                <span>{tr("admin.rag.documents.select_visible")}</span>
              </label>
              <div>
                <span>{tr("admin.rag.documents.total", { total: docMetrics.total })}</span>
                <span aria-hidden="true">|</span>
                <span>{tr("admin.rag.documents.filtered", { count: filteredCount })}</span>
                <span aria-hidden="true">|</span>
                <span>{tr("admin.rag.documents.showing", { count: visibleDocs.length })}</span>
                {selectedIds.size ? <span>{tr("admin.rag.documents.selected", { count: selectedIds.size })}</span> : null}
              </div>
            </div>

            <div>
              <div>
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
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(doc.id)}
                        />
                      </div>
                      <div>
                        <div>{doc.title || tr("admin.rag.documents.untitled")}</div>
                        <div>
                          <span>{statusLabels[status] || status}</span>
                          {docType ? <span>{docType}</span> : null}
                          {collectionLabel ? <span>{collectionLabel}</span> : null}
                          {doc.section ? <span>{doc.section}</span> : null}
                          {doc.year ? <span>{doc.year}</span> : null}
                          {doc.issueLabel ? (
                            <span>
                              {tr("admin.rag.documents.issue_label", { issue: doc.issueLabel })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {syncedAt ? <div>{formatDateTime(syncedAt, localeTag)}</div> : null}
                    </div>
                  );
                })}

                {!visibleDocs.length ? (
                  <div>
                    {loadingList ? tr("admin.common.loading_data") : tr("admin.rag.documents.no_results")}
                  </div>
                ) : null}
              </div>

              <div>
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
                      <div>
                        <div>
                          <div>
                            <div>{previewDoc.title || tr("admin.rag.documents.untitled")}</div>
                            {previewDoc.description ? <div>{previewDoc.description}</div> : null}
                          </div>
                          <div>
                            <span>{statusLabels[status] || status}</span>
                            {syncedAt ? <span>{formatDateTime(syncedAt, localeTag)}</span> : null}
                          </div>
                        </div>
                        <div>
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
                            <span>{previewDoc.docId || previewDoc.id || "-"}</span>
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
                              <span>{previewDoc.articleId}</span>
                            </div>
                          ) : null}
                        </div>
                        <div>
                          <span>{tr("admin.rag.details.tags")}</span>
                          {renderTags(previewDoc.tags)}
                        </div>
                        {source ? (
                          <div>
                            <span>{tr("admin.rag.details.source")}</span>
                            <span>{source}</span>
                          </div>
                        ) : null}
                        {kovManagedDoc ? (
                          <div>
                            KOV seotud RAG read hallatakse paketina KOV vaates. Documents lehel ei kustutata neid uhekaupa.
                          </div>
                        ) : null}
                        <div>
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
                  <div>{tr("admin.rag.details.select_material")}</div>
                )}
              </div>
            </div>
          </div>

          {visibleCount < filteredDocs.length ? (
            <div>
              <Button
                onClick={() => setVisibleCount(count => count + 25)}
              >
                {tr("admin.rag.documents.load_more")} {Math.min(25, filteredDocs.length - visibleCount)}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <div id="rag-documents-sources">
          <div>
            <div>
              <div>
                <CardTitle>Allikate loogika</CardTitle>
                <div>
                  Documents ei ole ainult register. See osa koondab olemasolevast registrist nähtava allikapildi, mille otsa saab hiljem ehitada eraldi source registry.
                </div>
              </div>
            </div>

            <div>
              {sourceLogicSignals.map(item => (
                <div key={item.label}>
                  <div>{item.label}</div>
                  <div>{item.value}</div>
                </div>
              ))}
            </div>

            <div>
              {sourceRegistry.map(source => {
                const isActive = filterSource === source.key;

                return (
                  <button
                    type="button"
                    key={source.key}
                    data-checked={isActive ? "true" : "false"}
                    onClick={() => setFilterSource(isActive ? "ALL" : source.key)}
                  >
                    <div>
                      <div>
                        {formatSourceLabel(source.key)}
                      </div>
                      <div>
                        {source.kinds.slice(0, 3).join(", ") || "Tuup teadmata"}
                        {source.lastSeen ? ` | ${formatDateTime(source.lastSeen, localeTag)}` : ""}
                      </div>
                    </div>
                    <span>{source.count}</span>
                  </button>
                );
              })}
            </div>

            {activeSourceEntry && activeSourceDocSummary ? (
              <div>
                <div>
                  <div>Valitud allikas</div>
                  <div>{formatSourceLabel(activeSourceEntry.key)}</div>
                  <div>
                    {activeSourceDocSummary.count} dokumenti
                    {activeSourceDocSummary.sections.length ? ` | sektsioonid: ${activeSourceDocSummary.sections.join(", ")}` : ""}
                    {activeSourceDocSummary.audiences.length ? ` | audience: ${activeSourceDocSummary.audiences.join(", ")}` : ""}
                    {activeSourceDocSummary.latestTitle ? ` | viimane: ${activeSourceDocSummary.latestTitle}` : ""}
                  </div>
                </div>
                <Button
                  onClick={() => setFilterSource("ALL")}
                >
                  Eemalda filter
                </Button>
              </div>
            ) : null}

            <div>
              Järgmine samm siinses alas on eraldi allikaregister: millised domeenid, failitüübid ja sisukanalid toidavad dokumentide registrit ning mis seisus need allikad on.
            </div>
          </div>
        </div>

        <div id="rag-documents-settings">
          <div>
            <div>
              <div>
                <CardTitle>Dokumendihalduse seaded</CardTitle>
                <div>
                  Siia koonduvad metadata mallid, valideerimise piirid ja ingestiga seotud vaikeväärtused. MVP-s näitab see kaart olemasolevat alust, mitte veel eraldi seadistusmoodulit.
                </div>
              </div>
            </div>

            <div>
              {settingsSignals.map(item => (
                <div key={item.label}>
                  <div>{item.label}</div>
                  <div>{item.value}</div>
                </div>
              ))}
            </div>

            <div>
              {metaTemplates.slice(0, 3).map(template => (
                <div key={template.key}>
                  <span>{template.label}</span>
                  <span>metadata mall</span>
                </div>
              ))}
            </div>

            <div>
              <div>
                <div>
                  <div>Registeri vaikevoog</div>
                  <div>
                    Uus sisu tuleb siia kas URL ingestist, PDF+metadata voost voi artiklite lisamisest. Registri detailvaade ja meta muutmine kasutavad sama andmekihti.
                  </div>
                </div>
              </div>
              <div>
                <div>
                  <div>Jargmised seadistusastmed</div>
                  <div>
                    Source registry, domeenipohised vaikeseaded, tugevamad metadata piirid ja dokumentide halduse reeglid.
                  </div>
                </div>
              </div>
            </div>

            <div>
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

        <MaterialsAdminSubmissionsPanel variant="ragAdmin" locale={locale} />
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
