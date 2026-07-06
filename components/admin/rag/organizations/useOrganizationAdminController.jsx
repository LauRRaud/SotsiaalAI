"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function createDraft(entry) {
  return {
    displayName: entry?.displayName || "",
    type: entry?.type || "PARTNER",
    focus: entry?.focus || "",
    county: entry?.county || "",
    isActive: entry?.isActive !== false,
    officialWebsite: entry?.officialWebsite || "",
    contactEmail: entry?.contactEmail || "",
    contactPhone: entry?.contactPhone || "",
    notes: entry?.notes || "",
    crawlReadiness: entry?.crawlReadiness || "PLANNED"
  };
}

export function useOrganizationAdminController(locale, initialItems = []) {
  const et = String(locale || "").toLowerCase().startsWith("et");
  const searchParams = useSearchParams();
  const remediationQueryKey = searchParams?.toString?.() || "";
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [activity, setActivity] = useState("ACTIVE");
  const [showExamplePlaceholders, setShowExamplePlaceholders] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(initialItems[0]?.slug || null);
  const [selectedSlugs, setSelectedSlugs] = useState(() => new Set());
  const [editing, setEditing] = useState(false);
  const [detailDraft, setDetailDraft] = useState(() => createDraft(initialItems[0] || null));
  const [saveBusy, setSaveBusy] = useState(false);
  const [fileBusyKey, setFileBusyKey] = useState("");
  const [revalidateBusySlug, setRevalidateBusySlug] = useState("");
  const [ingestBusySlug, setIngestBusySlug] = useState("");
  const [bulkIngestBusy, setBulkIngestBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [ragStatus, setRagStatus] = useState({
    doc: null,
    checkedAt: null
  });
  const [ragStatusLoading, setRagStatusLoading] = useState(false);
  const remediationAppliedRef = useRef("");
  const keepEditingForRemediationRef = useRef(false);

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

  const typeOptions = useMemo(() => {
    const values = Array.from(new Set(items.map(item => item.type).filter(Boolean)));
    return [
      { value: "ALL", label: et ? "Koik tuubid" : "All types" },
      ...values.map(value => ({ value, label: value }))
    ];
  }, [et, items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter(item => {
      if (!showExamplePlaceholders && item.isSeedPlaceholder) return false;
      if (type !== "ALL" && item.type !== type) return false;
      if (activity === "ACTIVE" && item.isActive !== true) return false;
      if (activity === "INACTIVE" && item.isActive !== false) return false;
      if (!normalizedQuery) return true;

      return [item.displayName, item.slug, item.focus, item.county, item.notes, item.contactEmail]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activity, items, query, showExamplePlaceholders, type]);

  const selectedEntry = filteredItems.find(item => item.slug === selectedSlug) || filteredItems[0] || null;
  const selectedRagDocId = String(selectedEntry?.ragDocId || "").trim();

  useEffect(() => {
    if (!filteredItems.length) {
      if (selectedSlug !== null) setSelectedSlug(null);
      return;
    }

    if (!selectedSlug || !filteredItems.some(item => item.slug === selectedSlug)) {
      setSelectedSlug(filteredItems[0].slug);
    }
  }, [filteredItems, selectedSlug]);

  useEffect(() => {
    setSelectedSlugs(current => {
      const allowed = new Set(filteredItems.map(item => item.slug));
      const next = new Set([...current].filter(slug => allowed.has(slug)));
      return next;
    });
  }, [filteredItems]);

  useEffect(() => {
    if (!remediationContext || items.length === 0) return;
    if (remediationAppliedRef.current === remediationQueryKey) return;
    remediationAppliedRef.current = remediationQueryKey;

    const candidates = [
      getRemediationIdentifierValue(remediationContext, "organization"),
      getRemediationIdentifierValue(remediationContext, "canonical_item_id"),
      getRemediationIdentifierValue(remediationContext, "source_id"),
      getRemediationIdentifierValue(remediationContext, "document_id"),
      getRemediationIdentifierValue(remediationContext, "source_path")
    ].filter(Boolean);

    const target = findRemediationTargetItem(items, candidates, [
      "officialWebsite",
      "contactEmail",
      "contactPhone"
    ]);

    if (!target) {
      if (candidates[0]) setQuery(candidates[0]);
      return;
    }

    setQuery(target.displayName || target.slug || candidates[0] || "");
    setType("ALL");
    setActivity("ALL");
    setSelectedSlug(target.slug);
    keepEditingForRemediationRef.current = true;
    setEditing(true);
  }, [items, remediationContext, remediationQueryKey]);

  useEffect(() => {
    setDetailDraft(createDraft(selectedEntry));
    if (keepEditingForRemediationRef.current) {
      keepEditingForRemediationRef.current = false;
      setEditing(true);
      return;
    }
    setEditing(false);
  }, [selectedEntry]);

  useEffect(() => {
    let active = true;

    if (!selectedRagDocId) {
      setRagStatus({
        doc: null,
        checkedAt: null
      });
      return undefined;
    }

    if (!shouldFetchRagDocumentStatus(selectedEntry, "web")) {
      setRagStatus({
        doc: buildNotIngestedRagDocumentStatus(selectedRagDocId),
        checkedAt: null
      });
      return undefined;
    }

    setRagStatusLoading(true);
    fetchRagDocumentStatus(selectedRagDocId)
      .then(doc => {
        if (!active) return;
        setRagStatus({
          doc,
          checkedAt: new Date().toISOString()
        });
      })
      .finally(() => {
        if (active) setRagStatusLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedEntry, selectedRagDocId]);

  async function refreshSelectedRagStatus(entryLike = selectedEntry) {
    if (!entryLike?.ragDocId) {
      setRagStatus({
        doc: null,
        checkedAt: null
      });
      return null;
    }

    if (!shouldFetchRagDocumentStatus(entryLike, "web")) {
      const snapshot = {
        doc: buildNotIngestedRagDocumentStatus(entryLike.ragDocId),
        checkedAt: null
      };
      setRagStatus(snapshot);
      return snapshot;
    }

    setRagStatusLoading(true);
    try {
      const doc = await fetchRagDocumentStatus(entryLike.ragDocId);
      const snapshot = {
        doc,
        checkedAt: new Date().toISOString()
      };
      setRagStatus(snapshot);
      return snapshot;
    } finally {
      setRagStatusLoading(false);
    }
  }

  async function saveDetail() {
    if (!selectedEntry?.slug || saveBusy) return;

    setSaveBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/rag/organizations/${encodeURIComponent(selectedEntry.slug)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale || "en"
        },
        body: JSON.stringify(detailDraft)
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok || !payload?.item) {
        throw new Error(payload?.message || (et ? "Salvestamine ebaonnestus." : "Save failed."));
      }

      setItems(current => current.map(item => (item.slug === payload.item.slug ? payload.item : item)));
      setDetailDraft(createDraft(payload.item));
      setEditing(false);
      setMessage({
        type: "ok",
        text: et ? "Organisatsiooni andmed salvestati." : "Organization details were saved."
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: String(error?.message || (et ? "Salvestamine ebaonnestus." : "Save failed."))
      });
    } finally {
      setSaveBusy(false);
    }
  }

  async function uploadFile(slug, role, file) {
    if (!slug || !role || !file) return;
    setFileBusyKey(`${slug}:${role}`);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("role", role);
      formData.append("file", file);

      const response = await fetch(`/api/admin/rag/organizations/${encodeURIComponent(slug)}/files`, {
        method: "POST",
        headers: {
          "x-ui-locale": locale || "en"
        },
        body: formData
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok || !payload?.item) {
        throw new Error(payload?.message || (et ? "Faili uleslaadimine ebaonnestus." : "File upload failed."));
      }

      setItems(current => current.map(item => (item.slug === payload.item.slug ? payload.item : item)));
      if (selectedSlug === payload.item.slug) {
        setDetailDraft(createDraft(payload.item));
      }
      setMessage({
        type: "ok",
        text: et ? "Fail laaditi ules." : "File uploaded."
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: String(error?.message || (et ? "Faili uleslaadimine ebaonnestus." : "File upload failed."))
      });
    } finally {
      setFileBusyKey("");
    }
  }

  async function removeFile(slug, fileId) {
    if (!slug || !fileId) return;
    setFileBusyKey(`${slug}:${fileId}`);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/rag/organizations/${encodeURIComponent(slug)}/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: {
          "x-ui-locale": locale || "en"
        }
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok || !payload?.item) {
        throw new Error(payload?.message || (et ? "Faili eemaldamine ebaonnestus." : "File removal failed."));
      }

      setItems(current => current.map(item => (item.slug === payload.item.slug ? payload.item : item)));
      if (selectedSlug === payload.item.slug) {
        setDetailDraft(createDraft(payload.item));
      }
      setMessage({
        type: "ok",
        text: et ? "Fail eemaldati." : "File removed."
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: String(error?.message || (et ? "Faili eemaldamine ebaonnestus." : "File removal failed."))
      });
    } finally {
      setFileBusyKey("");
    }
  }

  async function revalidateSingle(slug) {
    if (!slug) return;
    setRevalidateBusySlug(slug);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/rag/organizations/${encodeURIComponent(slug)}/revalidate`, {
        method: "POST",
        headers: {
          "x-ui-locale": locale || "en"
        }
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok || !payload?.item) {
        throw new Error(payload?.message || (et ? "Valideerimine ebaonnestus." : "Validation failed."));
      }

      setItems(current => current.map(item => (item.slug === payload.item.slug ? payload.item : item)));
      if (selectedSlug === payload.item.slug) {
        setDetailDraft(createDraft(payload.item));
      }
      setMessage({
        type: "ok",
        text: et ? "Failid valideeriti uuesti." : "Files were revalidated."
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: String(error?.message || (et ? "Valideerimine ebaonnestus." : "Validation failed."))
      });
    } finally {
      setRevalidateBusySlug("");
    }
  }

  async function ingestSingle(slug) {
    if (!slug || ingestBusySlug) return;
    setIngestBusySlug(slug);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/rag/organizations/${encodeURIComponent(slug)}/ingest`, {
        method: "POST",
        headers: {
          "x-ui-locale": locale || "en"
        }
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok || !payload?.item) {
        throw new Error(payload?.debug || payload?.message || (et ? "Ingest ebaonnestus." : "Ingest failed."));
      }

      setItems(current => current.map(item => (item.slug === payload.item.slug ? payload.item : item)));
      if (selectedSlug === payload.item.slug) {
        setDetailDraft(createDraft(payload.item));
        await refreshSelectedRagStatus(payload.item);
      }
      setMessage({
        type: "ok",
        text: et ? "Organisatsiooni sisu saadeti RAG-i." : "Organization content was ingested into RAG."
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: String(error?.message || (et ? "Ingest ebaonnestus." : "Ingest failed."))
      });
    } finally {
      setIngestBusySlug("");
    }
  }

  async function ingestSelected() {
    const ingestableSlugs = new Set(
      items
        .filter(item => selectedSlugs.has(item.slug) && item.ingestSummary?.canIngest === true && !item.isSeedPlaceholder)
        .map(item => item.slug)
    );
    const slugs = [...ingestableSlugs];
    if (!slugs.length || bulkIngestBusy) {
      if (!bulkIngestBusy) {
        setMessage({
          type: "error",
          text: et ? "Valitud kirjete hulgas pole ingestiks valmis organisatsioonipaketti." : "Selected rows do not include an ingest-ready organization package."
        });
      }
      return;
    }
    setBulkIngestBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/rag/organizations/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale || "en"
        },
        body: JSON.stringify({ slugs })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok || !Array.isArray(payload?.items)) {
        throw new Error(payload?.debug || payload?.message || (et ? "Bulk ingest ebaonnestus." : "Bulk ingest failed."));
      }

      const nextBySlug = new Map(payload.items.map(item => [item.slug, item]));
      setItems(current => current.map(item => nextBySlug.get(item.slug) || item));
      if (selectedSlug && nextBySlug.has(selectedSlug)) {
        setDetailDraft(createDraft(nextBySlug.get(selectedSlug)));
        await refreshSelectedRagStatus(nextBySlug.get(selectedSlug));
      }
      setMessage({
        type: "ok",
        text: et ? `RAG-i saadeti ${payload.items.length} organisatsiooni.` : `${payload.items.length} organizations were ingested into RAG.`
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: String(error?.message || (et ? "Bulk ingest ebaonnestus." : "Bulk ingest failed."))
      });
    } finally {
      setBulkIngestBusy(false);
    }
  }

  function resetFilters() {
    setQuery("");
    setType("ALL");
    setActivity("ACTIVE");
  }

  function toggleSelected(slug) {
    const item = items.find(candidate => candidate.slug === slug);
    if (!item || item.isSeedPlaceholder || item.ingestSummary?.canIngest !== true) return;

    setSelectedSlugs(current => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedSlugs(current => {
      const next = new Set(current);
      const visible = filteredItems
        .filter(item => item.ingestSummary?.canIngest === true && !item.isSeedPlaceholder)
        .map(item => item.slug);
      const allSelected = visible.length > 0 && visible.every(slug => next.has(slug));
      if (allSelected) visible.forEach(slug => next.delete(slug));
      else visible.forEach(slug => next.add(slug));
      return next;
    });
  }

  function updateDraft(key, value) {
    setEditing(true);
    setDetailDraft(current => ({
      ...current,
      [key]: value
    }));
  }

  function applyQuickReadiness(value) {
    updateDraft("crawlReadiness", value);
  }

  return {
    et,
    items,
    examplePlaceholderCount: items.filter(item => item.isSeedPlaceholder).length,
    showExamplePlaceholders,
    setShowExamplePlaceholders,
    query,
    setQuery,
    type,
    setType,
    activity,
    setActivity,
    typeOptions,
    filteredItems,
    selectedSlug,
    setSelectedSlug,
    selectedSlugs,
    toggleSelected,
    toggleSelectAllFiltered,
    selectedEntry,
    detailDraft,
    updateDraft,
    editing,
    setEditing,
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
  };
}
