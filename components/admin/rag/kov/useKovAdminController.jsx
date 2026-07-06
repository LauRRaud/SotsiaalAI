"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  buildRemediationContext,
  findRemediationTargetItem,
  getRemediationIdentifierValue
} from "@/components/admin/rag/remediationContext";
import {
  buildNotIngestedRagDocumentStatus,
  fetchRagDocumentStatus,
  shouldFetchRagDocumentStatus
} from "@/components/admin/rag/ragDocumentStatusClient";
import { KOV_FILE_ROLE_META } from "@/lib/admin/rag/kov/shared";

const STATUS_LABELS = {
  NOT_STARTED: { et: "Alustamata", en: "Not started" },
  DRAFT: { et: "Mustand", en: "Draft" },
  READY_FOR_INGEST: { et: "Valmis järgmiseks sammuks", en: "Ready for next step" },
  INGESTED: { et: "Ingested", en: "Ingested" },
  NEEDS_REVIEW: { et: "Vajab ülevaatust", en: "Needs review" }
};

const INGEST_STATUS_LABELS = {
  NOT_INGESTED: { et: "Pole ingestitud", en: "Not ingested" },
  READY: { et: "Valmis", en: "Ready" },
  INGESTING: { et: "Ingestimisel", en: "Ingesting" },
  INGESTED: { et: "Ingestitud", en: "Ingested" },
  ERROR: { et: "Viga", en: "Error" }
};

const RT_STATUS_LABELS = {
  NOT_STARTED: { et: "Alustamata", en: "Not started" },
  DRAFT: { et: "Mustand", en: "Draft" },
  NEEDS_REVIEW: { et: "Vajab ülevaatust", en: "Needs review" },
  READY: { et: "Valmis kontrolliks", en: "Ready for review" }
};

const AUTO_CHECK_STATUS_LABELS = {
  IDLE: { et: "Graafikus", en: "On schedule" },
  DUE: { et: "Kontroll tulekul", en: "Check due" },
  CHECKING: { et: "Kontrollimisel", en: "Checking" },
  CHANGES_DETECTED: { et: "Muudatus leitud", en: "Changes detected" },
  NO_CHANGES: { et: "Muudatusi pole", en: "No changes" },
  ERROR: { et: "Kontrolli viga", en: "Check error" }
};

const STATUS_FLOW = ["NOT_STARTED", "DRAFT", "NEEDS_REVIEW", "READY_FOR_INGEST", "INGESTED"];

function isEstonian(locale) {
  return String(locale || "").toLowerCase().startsWith("et");
}

function toDatetimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function nextStatus(current) {
  const index = STATUS_FLOW.indexOf(current);
  if (index === -1) return STATUS_FLOW[0];
  return STATUS_FLOW[(index + 1) % STATUS_FLOW.length];
}

function hasAllFilesValid(entry) {
  return entry?.validationSummary?.allFilesValid === true;
}

function buildDraft(entry) {
  return {
    officialWebsite: entry?.officialWebsite || "",
    riigiTeatajaUrl: entry?.riigiTeatajaUrl || "",
    status: entry?.status || "NOT_STARTED",
    checkedAt: toDatetimeLocalValue(entry?.checkedAt),
    notes: entry?.notes || "",
    readyForIngest: entry?.readyForIngest === true,
    rtStatus: entry?.rtStatus || "NOT_STARTED",
    rtCheckedAt: toDatetimeLocalValue(entry?.rtCheckedAt),
    rtNotes: entry?.rtNotes || ""
  };
}

function remediationNeedsLinkEditing(context) {
  const values = new Set([
    context?.action,
    ...(context?.fields || []),
    ...(context?.recommendedFields || [])
  ].filter(Boolean));
  return [
    "add_or_link_form_source",
    "add_or_link_official_contact_source",
    "fix_source_url",
    "application_form",
    "official_contact",
    "contact_page",
    "url"
  ].some(value => values.has(value));
}

export function useKovAdminController(locale, initialItems = []) {
  const et = isEstonian(locale);
  const searchParams = useSearchParams();
  const remediationQueryKey = searchParams?.toString?.() || "";

  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [query, setQuery] = useState("");
  const [county, setCounty] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [activity, setActivity] = useState("ACTIVE");
  const [packageState, setPackageState] = useState("ALL");
  const [sort, setSort] = useState("NAME_ASC");
  const [selectedSlug, setSelectedSlug] = useState(initialItems[0]?.slug || null);
  const [selectedSlugs, setSelectedSlugs] = useState([]);
  const [editingLinks, setEditingLinks] = useState(false);
  const [message, setMessage] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [fileBusyKey, setFileBusyKey] = useState("");
  const [revalidateBusySlug, setRevalidateBusySlug] = useState("");
  const [revalidateRtBusySlug, setRevalidateRtBusySlug] = useState("");
  const [bulkRevalidateBusy, setBulkRevalidateBusy] = useState(false);
  const [bulkRevalidateRtBusy, setBulkRevalidateRtBusy] = useState(false);
  const [bulkWebIngestBusy, setBulkWebIngestBusy] = useState(false);
  const [bulkRtIngestBusy, setBulkRtIngestBusy] = useState(false);
  const [bulkLightCheckBusy, setBulkLightCheckBusy] = useState(false);
  const [bulkRtLightCheckBusy, setBulkRtLightCheckBusy] = useState(false);
  const [ingestBusySlug, setIngestBusySlug] = useState("");
  const [rtIngestBusySlug, setRtIngestBusySlug] = useState("");
  const [lightCheckBusySlug, setLightCheckBusySlug] = useState("");
  const [rtLightCheckBusySlug, setRtLightCheckBusySlug] = useState("");
  const [resetBusySlug, setResetBusySlug] = useState("");
  const [ragResetPlan, setRagResetPlan] = useState(null);
  const [detailDraft, setDetailDraft] = useState(buildDraft(initialItems[0] || null));
  const [ragStatus, setRagStatus] = useState({
    web: null,
    rt: null,
    checkedAt: null
  });
  const [ragStatusLoading, setRagStatusLoading] = useState(false);
  const remediationAppliedRef = useRef("");

  const remediationContext = useMemo(
    () => buildRemediationContext(searchParams, locale),
    [locale, searchParams]
  );
  const remediationFocus = useMemo(
    () => remediationContext
      ? {
        action: remediationContext.action || "",
        fields: remediationContext.fields || [],
        recommendedFields: remediationContext.recommendedFields || [],
        focus: remediationContext.focus || "",
        fileKey: remediationContext.fileKey || "",
        sourceFileType: getRemediationIdentifierValue(remediationContext, "source_file_type")
      }
      : null,
    [remediationContext]
  );

  const statusLabel = useCallback(
    status => STATUS_LABELS[status]?.[et ? "et" : "en"] || status,
    [et]
  );

  const ingestStatusLabel = useCallback(
    status => INGEST_STATUS_LABELS[status]?.[et ? "et" : "en"] || status,
    [et]
  );

  const rtStatusLabel = useCallback(
    status => RT_STATUS_LABELS[status]?.[et ? "et" : "en"] || status,
    [et]
  );

  const autoCheckStatusLabel = useCallback(
    status => AUTO_CHECK_STATUS_LABELS[status]?.[et ? "et" : "en"] || status,
    [et]
  );

  const applyServerItem = useCallback(item => {
    if (!item?.slug) return;
    setItems(prev => {
      const exists = prev.some(entry => entry.slug === item.slug);
      if (!exists) return [...prev, item];
      return prev.map(entry => (entry.slug === item.slug ? item : entry));
    });
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/rag/kov", {
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || "KOV admin load failed");
      }
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems(nextItems);
      setSelectedSlug(prev => prev || nextItems[0]?.slug || null);
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.message || (et ? "KOV andmete laadimine ebaõnnestus." : "Failed to load municipality admin data.")
      });
    } finally {
      setLoading(false);
    }
  }, [et]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const nextItems = items.filter(item => {
      if (county !== "ALL" && item.county !== county) return false;
      if (type !== "ALL" && item.type !== type) return false;
      if (activity === "ACTIVE" && item.isActive !== true) return false;
      if (activity === "INACTIVE" && item.isActive !== false) return false;
      if (packageState === "VALID" && item?.validationSummary?.allFilesValid !== true) return false;
      if (packageState === "INVALID" && Number(item?.validationSummary?.invalidCount || 0) < 1) return false;
      if (packageState === "MISSING" && Number(item?.validationSummary?.missingCount || 0) < 1) return false;
      if (packageState === "WEB_READY" && item?.combinedReadiness?.webReady !== true) return false;
      if (packageState === "RT_READY" && item?.combinedReadiness?.rtReady !== true) return false;
      if (packageState === "BOTH_READY" && item?.combinedReadiness?.state !== "BOTH_READY" && item?.combinedReadiness?.state !== "BOTH_INGESTED") return false;
      if (packageState === "INGESTED_ANY" && item?.ingestStatus !== "INGESTED" && item?.rtIngestStatus !== "INGESTED") return false;
      if (packageState === "BOTH_INGESTED" && item?.combinedReadiness?.state !== "BOTH_INGESTED") return false;
      if (!normalizedQuery) return true;
      return [item.displayName, item.slug, item.county, item.type, item.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
    return [...nextItems].sort((left, right) => {
      if (sort === "NAME_ASC") {
        return String(left.displayName || "").localeCompare(String(right.displayName || ""), "et");
      }
      if (sort === "CHECKED_DESC") {
        return new Date(right.checkedAt || 0).getTime() - new Date(left.checkedAt || 0).getTime();
      }
      return (
        String(left.county || "").localeCompare(String(right.county || ""), "et")
        || String(left.displayName || "").localeCompare(String(right.displayName || ""), "et")
      );
    });
  }, [activity, county, items, packageState, query, sort, type]);

  useEffect(() => {
    if (!filteredItems.length) return;
    if (!filteredItems.some(item => item.slug === selectedSlug)) {
      setSelectedSlug(filteredItems[0].slug);
    }
  }, [filteredItems, selectedSlug]);

  useEffect(() => {
    const slugFromQuery = String(searchParams?.get("slug") || "").trim().toLowerCase();
    if (!slugFromQuery) return;
    if (!items.some(item => item.slug === slugFromQuery)) return;

    setQuery(slugFromQuery);
    setCounty("ALL");
    setType("ALL");
    setActivity("ALL");
    setPackageState("ALL");
    setSort("NAME_ASC");
    setSelectedSlug(slugFromQuery);
  }, [items, searchParams]);

  useEffect(() => {
    if (!remediationContext || items.length === 0) return;
    if (remediationAppliedRef.current === remediationQueryKey) return;
    remediationAppliedRef.current = remediationQueryKey;

    const candidates = [
      getRemediationIdentifierValue(remediationContext, "municipality"),
      getRemediationIdentifierValue(remediationContext, "canonical_item_id"),
      getRemediationIdentifierValue(remediationContext, "source_id"),
      getRemediationIdentifierValue(remediationContext, "document_id"),
      getRemediationIdentifierValue(remediationContext, "source_path")
    ].filter(Boolean);

    const target = findRemediationTargetItem(items, candidates, [
      "officialWebsite",
      "riigiTeatajaUrl"
    ]);

    if (!target) {
      if (candidates[0]) setQuery(candidates[0]);
      return;
    }

    setQuery(target.displayName || target.slug || candidates[0] || "");
    setCounty("ALL");
    setType("ALL");
    setActivity("ALL");
    setPackageState("ALL");
    setSort("NAME_ASC");
    setSelectedSlug(target.slug);
    setEditingLinks(remediationNeedsLinkEditing(remediationContext));
  }, [items, remediationContext, remediationQueryKey]);

  useEffect(() => {
    setSelectedSlugs(prev => prev.filter(slug => items.some(item => item.slug === slug)));
  }, [items]);

  const selectedEntry = useMemo(() => {
    if (!filteredItems.length) return null;
    return filteredItems.find(item => item.slug === selectedSlug) || filteredItems[0] || null;
  }, [filteredItems, selectedSlug]);

  useEffect(() => {
    setDetailDraft(buildDraft(selectedEntry));
  }, [selectedEntry]);

  useEffect(() => {
    if (!ragResetPlan) return;
    if (ragResetPlan?.municipality?.slug === selectedSlug) return;
    setRagResetPlan(null);
  }, [ragResetPlan, selectedSlug]);

  const fetchEntryRagStatus = useCallback(async entryLike => {
    if (!entryLike) {
      return {
        web: null,
        rt: null,
        checkedAt: null
      };
    }

    const fetchWebStatus = shouldFetchRagDocumentStatus(entryLike, "web");
    const fetchRtStatus = shouldFetchRagDocumentStatus(entryLike, "rt");

    const [web, rt] = await Promise.all([
      fetchWebStatus
        ? fetchRagDocumentStatus(entryLike.ragDocId)
        : Promise.resolve(buildNotIngestedRagDocumentStatus(entryLike.ragDocId)),
      fetchRtStatus
        ? fetchRagDocumentStatus(entryLike.rtRagDocId)
        : Promise.resolve(buildNotIngestedRagDocumentStatus(entryLike.rtRagDocId))
    ]);

    return {
      web,
      rt,
      checkedAt: fetchWebStatus || fetchRtStatus ? new Date().toISOString() : null
    };
  }, []);

  const refreshSelectedRagStatus = useCallback(
    async entryLike => {
      const target = entryLike || selectedEntry;
      if (!target) {
        setRagStatus({
          web: null,
          rt: null,
          checkedAt: null
        });
        return null;
      }

      setRagStatusLoading(true);
      try {
        const snapshot = await fetchEntryRagStatus(target);
        setRagStatus(snapshot);
        return snapshot;
      } finally {
        setRagStatusLoading(false);
      }
    },
    [fetchEntryRagStatus, selectedEntry]
  );

  useEffect(() => {
    let active = true;

    if (!selectedEntry) {
      setRagStatus({
        web: null,
        rt: null,
        checkedAt: null
      });
      return undefined;
    }

    setRagStatusLoading(true);
    fetchEntryRagStatus(selectedEntry)
      .then(snapshot => {
        if (active) {
          setRagStatus(snapshot);
        }
      })
      .finally(() => {
        if (active) {
          setRagStatusLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchEntryRagStatus, selectedEntry]);

  const countyOptions = useMemo(() => {
    const counties = Array.from(new Set(items.map(item => item.county).filter(Boolean))).sort((a, b) => a.localeCompare(b, "et"));
    return [{ value: "ALL", label: et ? "Kõik maakonnad" : "All counties" }, ...counties.map(value => ({ value, label: value }))];
  }, [et, items]);

  const typeOptions = useMemo(
    () => [
      { value: "ALL", label: et ? "Kõik tüübid" : "All types" },
      { value: "LINN", label: et ? "Linn" : "City" },
      { value: "VALD", label: et ? "Vald" : "Parish" }
    ],
    [et]
  );

  const activityOptions = useMemo(
    () => [
      { value: "ACTIVE", label: et ? "Ainult aktiivsed" : "Active only" },
      { value: "INACTIVE", label: et ? "Ainult mitteaktiivsed" : "Inactive only" },
      { value: "ALL", label: et ? "Kõik" : "All" }
    ],
    [et]
  );

  const statusOptions = useMemo(
    () => STATUS_FLOW.map(value => ({ value, label: statusLabel(value) })),
    [statusLabel]
  );

  const rtStatusOptions = useMemo(
    () => Object.keys(RT_STATUS_LABELS).map(value => ({ value, label: rtStatusLabel(value) })),
    [rtStatusLabel]
  );

  const packageStateOptions = useMemo(
    () => [
      { value: "ALL", label: et ? "Kõik paketid" : "All packages" },
      { value: "VALID", label: et ? "Ainult valiidse paketiga" : "Valid packages only" },
      { value: "INVALID", label: et ? "Ainult vigased paketid" : "Invalid packages only" },
      { value: "MISSING", label: et ? "Ainult puuduvate failidega" : "Missing files only" },
      { value: "WEB_READY", label: et ? "KOV veeb valmis" : "KOV web ready" },
      { value: "RT_READY", label: et ? "RT valmis" : "RT ready" },
      { value: "BOTH_READY", label: et ? "Mõlemad kihid valmis" : "Both layers ready" },
      { value: "INGESTED_ANY", label: et ? "Vähemalt üks kiht ingestitud" : "At least one layer ingested" },
      { value: "BOTH_INGESTED", label: et ? "Mõlemad kihid ingestitud" : "Both layers ingested" }
    ],
    [et]
  );

  const sortOptions = useMemo(
    () => [
      { value: "NAME_ASC", label: et ? "Nimi A-Z" : "Name A-Z" },
      { value: "COUNTY_ASC", label: et ? "Maakond A-Z" : "County A-Z" },
      { value: "CHECKED_DESC", label: et ? "Viimati kontrollitud enne" : "Recently checked first" }
    ],
    [et]
  );

  const hasActiveFilters =
    query.trim().length > 0 || county !== "ALL" || type !== "ALL" || activity !== "ACTIVE" || packageState !== "ALL" || sort !== "NAME_ASC";

  const resetFilters = useCallback(() => {
    setQuery("");
    setCounty("ALL");
    setType("ALL");
    setActivity("ACTIVE");
    setPackageState("ALL");
    setSort("NAME_ASC");
  }, []);

  const summaryCards = useMemo(() => {
    const visible = filteredItems.length;
    const ingestedAny = filteredItems.filter(item => item.ingestStatus === "INGESTED" || item.rtIngestStatus === "INGESTED").length;
    const needsAttention = filteredItems.filter(
      item =>
        item?.combinedReadiness?.state !== "BOTH_INGESTED"
        && (
          ["NOT_STARTED", "DRAFT", "NEEDS_REVIEW"].includes(item.status)
          || item?.combinedReadiness?.state !== "BOTH_READY"
        )
    ).length;
    const completeFiles = filteredItems.filter(item => item?.validationSummary?.allFilesValid === true).length;
    return [
      {
        key: "visible",
        label: et ? "Nähtavad KOV-id" : "Visible municipalities",
        value: visible,
        hint: et ? "Tulemused pärast otsingut ja filtreid." : "Results after search and filters.",
        tone: "neutral"
      },
      {
        key: "attention",
        label: et ? "Vajavad toimetamist" : "Needs work",
        value: needsAttention,
        hint: et ? "Alustamata, mustandis või ülevaatust vajavad kirjed." : "Not started, draft, or review-needed entries.",
        tone: needsAttention > 0 ? "warn" : "neutral"
      },
      {
        key: "files",
        label: et ? "KOV failid valid" : "KOV files valid",
        value: completeFiles,
        hint: et ? "Admini või repo allikapakett; see ei ole sama mis RAG ingest staatus." : "Admin or repository source package; this is separate from RAG ingest status.",
        tone: completeFiles > 0 ? "success" : "neutral"
      },
      {
        key: "ingested",
        value: ingestedAny,
        label: et ? "RAG ingestitud" : "RAG ingested",
        hint: et ? "KOV-id, millel on vähemalt üks RAG kiht juba ingestitud." : "Municipalities with at least one RAG layer already ingested.",
        tone: ingestedAny > 0 ? "success" : "neutral"
      },
      {
        key: "bothReady",
        label: et ? "Mõlemad kihid valmis" : "Both layers ready",
        value: filteredItems.filter(item => item?.combinedReadiness?.state === "BOTH_READY" || item?.combinedReadiness?.state === "BOTH_INGESTED").length,
        hint: et ? "KOV veeb ja RT kiht on koos valmis või juba ingestitud." : "Both KOV web and RT are ready or already ingested.",
        tone: "success"
      }
    ];
  }, [et, filteredItems]);

  const selectEntry = useCallback(slug => {
    setSelectedSlug(slug);
    setEditingLinks(false);
  }, []);

  const toggleSelectedSlug = useCallback(slug => {
    setSelectedSlugs(prev => (prev.includes(slug) ? prev.filter(item => item !== slug) : [...prev, slug]));
  }, []);

  const clearSelectedSlugs = useCallback(() => {
    setSelectedSlugs([]);
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedSlugs(filteredItems.map(item => item.slug));
  }, [filteredItems]);

  const patchEntry = useCallback(
    async (slug, patch, successText) => {
      setSaveBusy(true);
      try {
        const response = await fetch(`/api/admin/rag/kov/${encodeURIComponent(slug)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(patch)
        });
        const payload = await response.json();
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || "KOV update failed");
        }
        applyServerItem(payload.item);
        if (successText) {
          setMessage({ type: "success", text: successText });
        }
        return payload.item;
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.message || (et ? "KOV andmete uuendamine ebaõnnestus." : "Failed to update municipality admin data.")
        });
        return null;
      } finally {
        setSaveBusy(false);
      }
    },
    [applyServerItem, et]
  );

  const saveDetail = useCallback(async () => {
    if (!selectedEntry) return;
    const patch = {
      officialWebsite: detailDraft.officialWebsite,
      riigiTeatajaUrl: detailDraft.riigiTeatajaUrl,
      status: detailDraft.status,
      checkedAt: detailDraft.checkedAt ? new Date(detailDraft.checkedAt).toISOString() : null,
      notes: detailDraft.notes,
      rtStatus: detailDraft.rtStatus,
      rtCheckedAt: detailDraft.rtCheckedAt ? new Date(detailDraft.rtCheckedAt).toISOString() : null,
      rtNotes: detailDraft.rtNotes,
      readyForIngest: detailDraft.readyForIngest === true
    };
    const updated = await patchEntry(
      selectedEntry.slug,
      patch,
      et ? "KOV andmed salvestati." : "Municipality admin details saved."
    );
    if (updated) {
      setDetailDraft(buildDraft(updated));
      setEditingLinks(false);
    }
  }, [detailDraft, et, patchEntry, selectedEntry]);

  const cycleStatus = useCallback(async () => {
    if (!selectedEntry) return;
    const updated = await patchEntry(
      selectedEntry.slug,
      {
        status: nextStatus(selectedEntry.status),
        checkedAt: new Date().toISOString()
      },
      et ? "KOV staatus uuendati." : "Municipality status updated."
    );
    if (updated) {
      setDetailDraft(buildDraft(updated));
    }
  }, [et, patchEntry, selectedEntry]);

  const markReady = useCallback(
    async slug => {
      const entry = items.find(item => item.slug === slug);
      if (!entry || !hasAllFilesValid(entry)) return;
      const updated = await patchEntry(
        slug,
        {
          status: entry.status === "INGESTED" ? "INGESTED" : "READY_FOR_INGEST",
          readyForIngest: true,
          checkedAt: new Date().toISOString()
        },
        et ? "KOV margiti ingestiks valmis." : "Municipality marked ready for ingest."
      );
      if (updated && selectedEntry?.slug === slug) {
        setDetailDraft(buildDraft(updated));
      }
    },
    [et, items, patchEntry, selectedEntry]
  );

  const resetRagState = useCallback(
    async slug => {
      if (!slug) return null;

      setResetBusySlug(slug);
      try {
        const dryRunResponse = await fetch(`/api/admin/rag/kov/${encodeURIComponent(slug)}/reset-rag-state`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        });
        const dryRunPayload = await dryRunResponse.json();
        if (!dryRunResponse.ok || dryRunPayload?.ok === false) {
          throw new Error(dryRunPayload?.message || "KOV RAG reset dry-run failed");
        }

        setRagResetPlan(dryRunPayload);

        const summary = dryRunPayload?.summary || {};
        const confirmText = [
          et ? `Resetin ${slug} KOV RAG state'i?` : `Reset RAG state for ${slug}?`,
          et ? `RAG dokumendid: ${summary.matched_rag_doc_ids || 0}` : `RAG documents: ${summary.matched_rag_doc_ids || 0}`,
          et ? `Aktiivsed source package'id: ${summary.active_snapshot_count || 0}` : `Active source packages: ${summary.active_snapshot_count || 0}`,
          et ? `Admin state reset: ${summary.admin_row_will_reset ? "jah" : "ei"}` : `Admin state reset: ${summary.admin_row_will_reset ? "yes" : "no"}`,
          et ? "Repo faile see ei puuduta." : "This does not touch repo files."
        ].join("\n");

        if (!window.confirm(confirmText)) {
          return {
            ok: false,
            cancelled: true,
            dryRun: dryRunPayload
          };
        }

        const writeResponse = await fetch(`/api/admin/rag/kov/${encodeURIComponent(slug)}/reset-rag-state`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ confirmReset: true })
        });
        const writePayload = await writeResponse.json();
        if (!writeResponse.ok || writePayload?.ok === false) {
          throw new Error(writePayload?.message || "KOV RAG reset failed");
        }

        setRagResetPlan(writePayload);
        await loadItems();
        setSelectedSlug(slug);
        setEditingLinks(false);
        setMessage({
          type: "success",
          text: et
            ? "KOV RAG state resetiti paketina. Documents üksikuid ridu ei pea eraldi kustutama."
            : "KOV RAG state was reset package-wise. No individual document deletes are needed."
        });
        return writePayload;
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.message || (et ? "KOV RAG state reset ebaõnnestus." : "KOV RAG state reset failed.")
        });
        return null;
      } finally {
        setResetBusySlug("");
      }
    },
    [et, loadItems]
  );

  const uploadFile = useCallback(
    async (slug, fileKey, file) => {
      if (!file) return;
      const roleMeta = KOV_FILE_ROLE_META[fileKey];
      if (!roleMeta) return;
      const busyKey = `${slug}:${fileKey}`;
      setFileBusyKey(busyKey);
      try {
        const formData = new FormData();
        formData.append("role", roleMeta.paramRole);
        formData.append("file", file);
        const response = await fetch(`/api/admin/rag/kov/${encodeURIComponent(slug)}/files`, {
          method: "POST",
          body: formData
        });
        const payload = await response.json();
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || "KOV file upload failed");
        }
        applyServerItem(payload.item);
        if (selectedEntry?.slug === slug) {
          setDetailDraft(buildDraft(payload.item));
        }
        setMessage({
          type: "success",
          text: et ? "KOV fail laeti edukalt üles." : "Municipality file uploaded successfully."
        });
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.message || (et ? "KOV faili üleslaadimine ebaõnnestus." : "Failed to upload municipality file.")
        });
      } finally {
        setFileBusyKey("");
      }
    },
    [applyServerItem, et, selectedEntry]
  );

  const removeFile = useCallback(
    async (slug, fileKey) => {
      const roleMeta = KOV_FILE_ROLE_META[fileKey];
      if (!roleMeta) return;
      const busyKey = `${slug}:${fileKey}`;
      setFileBusyKey(busyKey);
      try {
        const response = await fetch(
          `/api/admin/rag/kov/${encodeURIComponent(slug)}/files/${encodeURIComponent(roleMeta.paramRole)}`,
          { method: "DELETE" }
        );
        const payload = await response.json();
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || "KOV file delete failed");
        }
        applyServerItem(payload.item);
        if (selectedEntry?.slug === slug) {
          setDetailDraft(buildDraft(payload.item));
        }
        setMessage({
          type: "success",
          text: et ? "KOV fail eemaldati." : "Municipality file removed."
        });
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.message || (et ? "KOV faili eemaldamine ebaõnnestus." : "Failed to remove municipality file.")
        });
      } finally {
        setFileBusyKey("");
      }
    },
    [applyServerItem, et, selectedEntry]
  );

  const revalidateSingle = useCallback(
    async slug => {
      if (!slug) return null;
      setRevalidateBusySlug(slug);
      try {
        const response = await fetch(`/api/admin/rag/kov/${encodeURIComponent(slug)}/revalidate`, {
          method: "POST"
        });
        const payload = await response.json();
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || "KOV revalidation failed");
        }
        applyServerItem(payload.item);
        setMessage({
          type: "success",
          text: et ? "KOV failid valideeriti uuesti." : "Municipality files were revalidated."
        });
        return payload.item;
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.message || (et ? "KOV failide uuesti valideerimine ebaõnnestus." : "Failed to revalidate municipality files.")
        });
        return null;
      } finally {
        setRevalidateBusySlug("");
      }
    },
    [applyServerItem, et]
  );

  const revalidateSelected = useCallback(async () => {
    if (!selectedSlugs.length) return [];
    setBulkRevalidateBusy(true);
    try {
      const response = await fetch("/api/admin/rag/kov/revalidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slugs: selectedSlugs
        })
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || "Bulk KOV revalidation failed");
      }
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      nextItems.forEach(applyServerItem);
      setMessage({
        type: "success",
        text: et
          ? `Valideerisin uuesti ${nextItems.length} KOV-i failid.`
          : `Revalidated files for ${nextItems.length} municipalities.`
      });
      return nextItems;
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.message || (et ? "Valitud KOV-ide uuesti valideerimine ebaõnnestus." : "Failed to revalidate selected municipalities.")
      });
      return [];
    } finally {
      setBulkRevalidateBusy(false);
    }
  }, [applyServerItem, et, selectedSlugs]);

  const revalidateRtSingle = useCallback(
    async slug => {
      if (!slug) return null;
      setRevalidateRtBusySlug(slug);
      try {
        const response = await fetch(`/api/admin/rag/kov/${encodeURIComponent(slug)}/revalidate-rt`, {
          method: "POST"
        });
        const payload = await response.json();
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || "KOV RT revalidation failed");
        }
        applyServerItem(payload.item);
        setMessage({
          type: "success",
          text: et ? "RT failid valideeriti uuesti." : "RT files were revalidated."
        });
        return payload.item;
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.message || (et ? "RT failide uuesti valideerimine ebaõnnestus." : "Failed to revalidate RT files.")
        });
        return null;
      } finally {
        setRevalidateRtBusySlug("");
      }
    },
    [applyServerItem, et]
  );

  const revalidateRtSelected = useCallback(async () => {
    if (!selectedSlugs.length) return [];
    setBulkRevalidateRtBusy(true);
    try {
      const response = await fetch("/api/admin/rag/kov/revalidate-rt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slugs: selectedSlugs
        })
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || "Bulk KOV RT revalidation failed");
      }
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      nextItems.forEach(applyServerItem);
      setMessage({
        type: "success",
        text: et
          ? `Valideerisin uuesti ${nextItems.length} KOV-i RT failid.`
          : `Revalidated RT files for ${nextItems.length} municipalities.`
      });
      return nextItems;
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.message || (et ? "Valitud KOV-ide RT failide uuesti valideerimine ebaõnnestus." : "Failed to revalidate RT files for selected municipalities.")
      });
      return [];
    } finally {
      setBulkRevalidateRtBusy(false);
    }
  }, [applyServerItem, et, selectedSlugs]);

  const ingestSingle = useCallback(
    async (slug, options = {}) => {
      if (!slug) return null;
      const replaceExisting = options.replaceExisting === true;
      if (replaceExisting) {
        const confirmed = window.confirm(
          et
            ? [
                `Asendan ${slug} KOV veebikihi RAG-is?`,
                "See kustutab enne sama KOV-i vanad veebidokumendid ja archiveerib aktiivsed SourcePackage snapshotid.",
                "RT kihti ega repo faile see ei muuda."
              ].join("\n")
            : [
                `Replace ${slug} KOV web layer in RAG?`,
                "This first removes old web documents for this municipality and archives active SourcePackage snapshots.",
                "RT layer and repo files are not changed."
              ].join("\n")
        );
        if (!confirmed) return null;
      }
      setIngestBusySlug(slug);
      try {
        const response = await fetch(`/api/admin/rag/kov/${encodeURIComponent(slug)}/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(
            replaceExisting
              ? { replaceExisting: true, confirmCleanup: true }
              : {}
          )
        });
        const payload = await response.json();
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || "KOV ingest failed");
        }
        applyServerItem(payload.item);
        if (selectedEntry?.slug === slug) {
          await refreshSelectedRagStatus(payload.item);
        }
        setMessage({
          type: "success",
          text: replaceExisting
            ? et ? "KOV veebikiht asendati RAG-is edukalt." : "Municipality web layer was replaced in RAG."
            : et ? "KOV saadeti RAG-i edukalt." : "Municipality was ingested into RAG."
        });
        return payload.item;
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.message || (et ? "KOV ingest ebaõnnestus." : "Municipality ingest failed.")
        });
        return null;
      } finally {
        setIngestBusySlug("");
      }
    },
    [applyServerItem, et, refreshSelectedRagStatus, selectedEntry]
  );

  const replaceIngestSingle = useCallback(
    slug => ingestSingle(slug, { replaceExisting: true }),
    [ingestSingle]
  );

  const ingestSelected = useCallback(async () => {
    if (!selectedSlugs.length) return [];
    setBulkWebIngestBusy(true);
    try {
      const response = await fetch("/api/admin/rag/kov/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slugs: selectedSlugs
        })
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || "Bulk KOV ingest failed");
      }
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      nextItems.forEach(applyServerItem);
      setMessage({
        type: "success",
        text: et
          ? `Saatsin RAG-i ${nextItems.length} KOV-i veebikihi.`
          : `Ingested KOV web layers for ${nextItems.length} municipalities into RAG.`
      });
      return nextItems;
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.message || (et ? "Valitud KOV veebikihtide ingest ebaõnnestus." : "Failed to ingest selected KOV web layers.")
      });
      return [];
    } finally {
      setBulkWebIngestBusy(false);
    }
  }, [applyServerItem, et, selectedSlugs]);

  const ingestRtSingle = useCallback(
    async slug => {
      if (!slug) return null;
      setRtIngestBusySlug(slug);
      try {
        const response = await fetch(`/api/admin/rag/kov/${encodeURIComponent(slug)}/ingest-rt`, {
          method: "POST"
        });
        const payload = await response.json();
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || "KOV RT ingest failed");
        }
        applyServerItem(payload.item);
        if (selectedEntry?.slug === slug) {
          await refreshSelectedRagStatus(payload.item);
        }
        setMessage({
          type: "success",
          text: et ? "RT kiht saadeti RAG-i edukalt." : "RT layer was ingested into RAG."
        });
        return payload.item;
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.message || (et ? "RT ingest ebaõnnestus." : "RT ingest failed.")
        });
        return null;
      } finally {
        setRtIngestBusySlug("");
      }
    },
    [applyServerItem, et, refreshSelectedRagStatus, selectedEntry]
  );

  const ingestRtSelected = useCallback(async () => {
    if (!selectedSlugs.length) return [];
    setBulkRtIngestBusy(true);
    try {
      const response = await fetch("/api/admin/rag/kov/ingest-rt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slugs: selectedSlugs
        })
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || "Bulk KOV RT ingest failed");
      }
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      nextItems.forEach(applyServerItem);
      setMessage({
        type: "success",
        text: et
          ? `Saatsin RAG-i ${nextItems.length} KOV-i RT kihi.`
          : `Ingested RT layers for ${nextItems.length} municipalities into RAG.`
      });
      return nextItems;
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.message || (et ? "Valitud RT kihtide ingest ebaõnnestus." : "Failed to ingest selected RT layers.")
      });
      return [];
    } finally {
      setBulkRtIngestBusy(false);
    }
  }, [applyServerItem, et, selectedSlugs]);

  const lightCheckSingle = useCallback(
    async slug => {
      if (!slug) return null;
      setLightCheckBusySlug(slug);
      try {
        const response = await fetch(`/api/admin/rag/kov/${encodeURIComponent(slug)}/light-check`, {
          method: "POST"
        });
        const payload = await response.json();
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || "KOV light check failed");
        }
        applyServerItem(payload.item);
        setMessage({
          type: "success",
          text: et
            ? "KOV allikad kontrolliti uuesti ja muutuse seis uuendati."
            : "Municipality sources were checked and the change status was updated."
        });
        return payload.item;
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.message || (et ? "KOV automaatkontroll ebaõnnestus." : "Municipality light check failed.")
        });
        return null;
      } finally {
        setLightCheckBusySlug("");
      }
    },
    [applyServerItem, et]
  );

  const lightCheckRtSingle = useCallback(
    async slug => {
      if (!slug) return null;
      setRtLightCheckBusySlug(slug);
      try {
        const response = await fetch(`/api/admin/rag/kov/${encodeURIComponent(slug)}/light-check-rt`, {
          method: "POST"
        });
        const payload = await response.json();
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || "KOV RT light check failed");
        }
        applyServerItem(payload.item);
        setMessage({
          type: "success",
          text: et
            ? "RT allikad kontrolliti uuesti ja muutuse seis uuendati."
            : "RT sources were checked and the change status was updated."
        });
        return payload.item;
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.message || (et ? "RT automaatkontroll ebaõnnestus." : "RT light check failed.")
        });
        return null;
      } finally {
        setRtLightCheckBusySlug("");
      }
    },
    [applyServerItem, et]
  );

  const markWebReviewNeeded = useCallback(
    async slug => {
      const entry = items.find(item => item.slug === slug);
      if (!entry) return null;
      const updated = await patchEntry(
        slug,
        {
          status: "NEEDS_REVIEW",
          autoCheckStatus: entry.autoCheckStatus === "ERROR" ? "ERROR" : "CHANGES_DETECTED",
          checkedAt: new Date().toISOString()
        },
        et ? "KOV veeb märgiti ülevaatuseks." : "KOV web layer marked for review."
      );
      if (updated && selectedEntry?.slug === slug) {
        setDetailDraft(buildDraft(updated));
      }
      return updated;
    },
    [et, items, patchEntry, selectedEntry]
  );

  const confirmWebLightCheck = useCallback(
    async slug => {
      const updated = await patchEntry(
        slug,
        {
          autoCheckStatus: "NO_CHANGES",
          checkedAt: new Date().toISOString()
        },
        et ? "KOV veeb muutusekontroll kinnitati." : "KOV web change check confirmed."
      );
      if (updated && selectedEntry?.slug === slug) {
        setDetailDraft(buildDraft(updated));
      }
      return updated;
    },
    [et, patchEntry, selectedEntry]
  );

  const markRtReviewNeeded = useCallback(
    async slug => {
      const entry = items.find(item => item.slug === slug);
      if (!entry) return null;
      const updated = await patchEntry(
        slug,
        {
          rtStatus: "NEEDS_REVIEW",
          rtAutoCheckStatus: entry.rtAutoCheckStatus === "ERROR" ? "ERROR" : "CHANGES_DETECTED",
          rtCheckedAt: new Date().toISOString()
        },
        et ? "RT kiht märgiti ülevaatuseks." : "RT layer marked for review."
      );
      if (updated && selectedEntry?.slug === slug) {
        setDetailDraft(buildDraft(updated));
      }
      return updated;
    },
    [et, items, patchEntry, selectedEntry]
  );

  const confirmRtLightCheck = useCallback(
    async slug => {
      const updated = await patchEntry(
        slug,
        {
          rtAutoCheckStatus: "NO_CHANGES",
          rtCheckedAt: new Date().toISOString()
        },
        et ? "RT muutusekontroll kinnitati." : "RT change check confirmed."
      );
      if (updated && selectedEntry?.slug === slug) {
        setDetailDraft(buildDraft(updated));
      }
      return updated;
    },
    [et, patchEntry, selectedEntry]
  );

  const lightCheckSelected = useCallback(async () => {
    if (!selectedSlugs.length) return [];
    setBulkLightCheckBusy(true);
    try {
      const response = await fetch("/api/admin/rag/kov/light-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slugs: selectedSlugs
        })
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || "Bulk KOV light check failed");
      }
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      nextItems.forEach(applyServerItem);
      setMessage({
        type: "success",
        text: et
          ? `Kontrollisin ${nextItems.length} KOV-i veebiallikad.`
          : `Checked KOV web sources for ${nextItems.length} municipalities.`
      });
      return nextItems;
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.message || (et ? "Valitud KOV-ide muutusekontroll ebaõnnestus." : "Failed to check selected KOV web sources.")
      });
      return [];
    } finally {
      setBulkLightCheckBusy(false);
    }
  }, [applyServerItem, et, selectedSlugs]);

  const lightCheckRtSelected = useCallback(async () => {
    if (!selectedSlugs.length) return [];
    setBulkRtLightCheckBusy(true);
    try {
      const response = await fetch("/api/admin/rag/kov/light-check-rt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slugs: selectedSlugs
        })
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || "Bulk RT light check failed");
      }
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      nextItems.forEach(applyServerItem);
      setMessage({
        type: "success",
        text: et
          ? `Kontrollisin ${nextItems.length} KOV-i RT allikad.`
          : `Checked RT sources for ${nextItems.length} municipalities.`
      });
      return nextItems;
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.message || (et ? "Valitud RT allikate kontroll ebaõnnestus." : "Failed to check selected RT sources.")
      });
      return [];
    } finally {
      setBulkRtLightCheckBusy(false);
    }
  }, [applyServerItem, et, selectedSlugs]);

  const allVisibleSelected = filteredItems.length > 0 && filteredItems.every(item => selectedSlugs.includes(item.slug));
  const selectedCount = selectedSlugs.length;

  return {
    et,
    loading,
    items,
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
    confirmRtLightCheck,
    loadItems
  };
}
