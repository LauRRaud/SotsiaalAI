"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

import {
  AUDIENCE_LABEL_KEYS,
  AUDIENCE_VALUES,
  DOCS_FETCH_LIMIT,
  MAX_DOCS_FETCH_PAGES,
  META_TEMPLATES,
  PAGE_SIZE,
  POLL_MS,
  STATUS_LABEL_KEYS,
  buildDetailFormFromDoc,
  createEmptyDetailForm,
  deriveDocType,
  deriveStatus,
  deriveSyncedAt,
  formatI18n,
  normalizeDoc,
  splitAuthors,
  splitTags,
  toLocaleTag,
  validateMeta
} from "./ragAdminShared";
import {
  buildRemediationContext,
  buildRemediationMetadataStub
} from "./remediationContext";

export function useRagAdminController() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const localeTag = useMemo(() => toLocaleTag(locale), [locale]);
  const tr = useCallback(
    (key, values) => {
      const raw = t(key);
      const template = typeof raw === "string" && raw.trim() ? raw : key;
      return formatI18n(template, values);
    },
    [t]
  );

  const statusLabels = useMemo(
    () => ({
      PENDING: tr(STATUS_LABEL_KEYS.PENDING),
      PROCESSING: tr(STATUS_LABEL_KEYS.PROCESSING),
      COMPLETED: tr(STATUS_LABEL_KEYS.COMPLETED),
      FAILED: tr(STATUS_LABEL_KEYS.FAILED)
    }),
    [tr]
  );

  const audienceLabels = useMemo(() => {
    const out = {};
    for (const value of AUDIENCE_VALUES) {
      out[value] = tr(AUDIENCE_LABEL_KEYS[value]);
    }
    return out;
  }, [tr]);

  const audienceSelectOptions = useMemo(
    () =>
      AUDIENCE_VALUES.map(value => ({
        value,
        label: audienceLabels[value] || value
      })),
    [audienceLabels]
  );

  const metaTemplates = useMemo(
    () =>
      META_TEMPLATES.map(template => ({
        ...template,
        label: tr(template.labelKey)
      })),
    [tr]
  );

  const [docs, setDocs] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [message, setMessage] = useState(null);
  const [selftestBusy, setSelftestBusy] = useState(false);
  const [selftestSteps, setSelftestSteps] = useState(null);
  const [pdfMetaAudience, setPdfMetaAudience] = useState("BOTH");
  const [pdfMetaBusy, setPdfMetaBusy] = useState(false);
  const [pdfMetaResult, setPdfMetaResult] = useState(null);
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfMetaFileName, setPdfMetaFileName] = useState("");
  const [pdfMetaText, setPdfMetaText] = useState("");
  const [rtXmlFileName, setRtXmlFileName] = useState("");
  const [rtXmlBusy, setRtXmlBusy] = useState(false);
  const [rtXmlResult, setRtXmlResult] = useState(null);
  const [metaCheck, setMetaCheck] = useState(null);
  const [showMetaGuide, setShowMetaGuide] = useState(false);
  const [activeMetaTemplateKey, setActiveMetaTemplateKey] = useState(META_TEMPLATES[0]?.key || "base");
  const [activeMetaTemplateContent, setActiveMetaTemplateContent] = useState("");
  const [articlesDocId, setArticlesDocId] = useState("");
  const [articlesJson, setArticlesJson] = useState("");
  const [articlesJsonFileName, setArticlesJsonFileName] = useState("");
  const [articlesBusy, setArticlesBusy] = useState(false);
  const [articlesResult, setArticlesResult] = useState(null);
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlAudience, setUrlAudience] = useState("BOTH");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlDescription, setUrlDescription] = useState("");
  const [urlTags, setUrlTags] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSection, setFilterSection] = useState("ALL");
  const [filterAudience, setFilterAudience] = useState("ALL");
  const [filterSource, setFilterSource] = useState("ALL");
  const [filterYear, setFilterYear] = useState("ALL");
  const [filterIssue, setFilterIssue] = useState("ALL");
  const [filterTags, setFilterTags] = useState([]);
  const [sortBy, setSortBy] = useState("recent");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [previewId, setPreviewId] = useState(null);
  const [detailDoc, setDetailDoc] = useState(null);
  const [detailForm, setDetailForm] = useState(createEmptyDetailForm);
  const [reindexingId, setReindexingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirmDocId, setDeleteConfirmDocId] = useState(null);

  const urlFormRef = useRef(null);
  const pdfFormRef = useRef(null);
  const pdfFileInputRef = useRef(null);
  const pdfMetaFileInputRef = useRef(null);
  const rtXmlFormRef = useRef(null);
  const rtXmlFileInputRef = useRef(null);
  const articlesFileInputRef = useRef(null);
  const articlesFormRef = useRef(null);
  const fetchAbortRef = useRef(null);
  const remediationAppliedRef = useRef("");

  const resetMessage = useCallback(() => setMessage(null), []);
  const getAudienceLabel = useCallback(value => audienceLabels[value] || (value ? value : "-"), [audienceLabels]);
  const showError = useCallback(text => setMessage({ type: "error", text }), []);
  const showOk = useCallback(text => setMessage({ type: "success", text }), []);
  const resolveErrorText = useCallback(
    (payload, fallbackKey) =>
      resolveApiMessage({
        payload,
        t: key => tr(key),
        fallbackKey,
        fallbackText: tr(fallbackKey)
      }),
    [tr]
  );

  const remediationContext = useMemo(
    () => buildRemediationContext(searchParams, locale),
    [locale, searchParams]
  );

  useEffect(() => {
    if (!remediationContext) return;
    const key = searchParams?.toString?.() || JSON.stringify(remediationContext);
    if (remediationAppliedRef.current === key) return;
    remediationAppliedRef.current = key;

    const searchHint = remediationContext.identifiers.find(([name]) =>
      ["source_id", "document_id", "canonical_item_id", "source_path"].includes(name)
    )?.[1];
    if (searchHint) setSearchQuery(searchHint);

    const metadataStub = buildRemediationMetadataStub(remediationContext);
    if (metadataStub) {
      setPdfMetaText(metadataStub);
      setShowMetaGuide(true);
    }
  }, [remediationContext, searchParams]);

  const fetchDocuments = useCallback(async () => {
    fetchAbortRef.current?.abort?.();
    const ac = new AbortController();
    fetchAbortRef.current = ac;
    setLoadingList(true);

    try {
      const allDocs = [];

      for (let pageIndex = 0; pageIndex < MAX_DOCS_FETCH_PAGES; pageIndex += 1) {
        const offset = pageIndex * DOCS_FETCH_LIMIT;
        const res = await fetch(`/api/rag/documents?limit=${DOCS_FETCH_LIMIT}&offset=${offset}`, {
          cache: "no-store",
          signal: ac.signal
        });
        const raw = await res.text();
        let data = null;

        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          throw new Error(tr("admin.rag.errors.invalid_documents_json"));
        }

        if (!res.ok) {
          throw new Error(resolveErrorText(data, "admin.rag.errors.documents_load_failed"));
        }

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.documents)
            ? data.documents
            : Array.isArray(data?.docs)
              ? data.docs
              : [];

        allDocs.push(...list);
        if (list.length < DOCS_FETCH_LIMIT) break;
      }

      setDocs(allDocs);
    } catch (err) {
      if (err?.name !== "AbortError") {
        showError(err?.message || tr("admin.rag.errors.documents_load_failed"));
      }
    } finally {
      setLoadingList(false);
    }
  }, [resolveErrorText, showError, tr]);

  useEffect(() => {
    fetchDocuments();
    return () => fetchAbortRef.current?.abort?.();
  }, [fetchDocuments]);

  useEffect(() => {
    const hasWork = docs.some(doc => {
      const status = deriveStatus(doc);
      return status === "PENDING" || status === "PROCESSING";
    });

    if (!hasWork) return undefined;

    let timer = null;

    const start = () => {
      if (!document.hidden && !timer) {
        fetchDocuments();
        timer = setInterval(fetchDocuments, POLL_MS);
      }
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [docs, fetchDocuments]);

  const handlePdfMetaSubmit = useCallback(
    async event => {
      event.preventDefault();
      resetMessage();
      setPdfMetaResult(null);
      setMetaCheck(null);

      const form = event.currentTarget;
      const pdfFile = form.pdfWithMetaFile?.files?.[0];
      const metaFile = form.pdfMetaFile?.files?.[0];
      const metaText = form.pdfMetaText?.value?.trim();

      if (!pdfFile) {
        showError(tr("admin.rag.errors.pdf_required"));
        return;
      }

      if (!metaFile && !metaText) {
        showError(tr("admin.rag.errors.meta_required"));
        return;
      }

      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("audience", pdfMetaAudience);
      if (metaFile) formData.append("metadata", metaFile);
      else if (metaText) formData.append("metadata_text", metaText);

      setPdfMetaBusy(true);

      try {
        const res = await fetch("/api/rag/ingest/pdf-with-metadata", {
          method: "POST",
          body: formData
        });
        const raw = await res.text();
        const data = raw ? JSON.parse(raw) : {};

        if (!res.ok || data?.ok === false) {
          throw new Error(resolveErrorText(data, "admin.rag.errors.pdf_ingest_failed"));
        }

        const docId = data?.docId || data?.docID || data?.doc?.docId || data?.doc?.id || data?.doc?.remoteId || null;
        const shortRef = data?.shortRef || data?.short_ref || null;

        if (shortRef) showOk(tr("admin.rag.success.added_with_ref", { ref: shortRef }));
        else if (docId) showOk(tr("admin.rag.success.pdf_ingest_with_doc_id", { docId }));
        else showOk(tr("admin.rag.success.pdf_ingest"));

        setPdfMetaResult({
          docId,
          fileName: data?.fileName,
          shortRef,
          pageRange: data?.pageRange || data?.page_range || null,
          inserted: data?.inserted
        });

        if (docId) setArticlesDocId(docId);
        setPdfMetaAudience("BOTH");
        setPdfFileName("");
        setPdfMetaFileName("");
        setPdfMetaText("");
        form.reset();
        await fetchDocuments();
      } catch (err) {
        showError(err?.message || tr("admin.rag.errors.pdf_ingest_failed"));
      } finally {
        setPdfMetaBusy(false);
      }
    },
    [fetchDocuments, pdfMetaAudience, resetMessage, resolveErrorText, showError, showOk, tr]
  );

  const handleMetaCheck = useCallback(async () => {
    const form = pdfFormRef.current;
    if (!form) return;

    const metaFile = form.pdfMetaFile?.files?.[0];
    const metaText = form.pdfMetaText?.value?.trim();
    let raw = metaText;

    if (!raw && metaFile) {
      try {
        raw = await metaFile.text();
      } catch {
        raw = "";
      }
    }

    if (!raw) {
      setMetaCheck({ type: "error", text: tr("admin.rag.errors.meta_required") });
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setMetaCheck({ type: "error", text: tr("admin.rag.errors.meta_json_invalid") });
      return;
    }

    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      setMetaCheck({ type: "error", text: tr("admin.rag.errors.meta_json_must_be_object") });
      return;
    }

    const { missingRequired, missingRecommended } = validateMeta(parsed);

    if (!missingRequired.length && !missingRecommended.length) {
      setMetaCheck({ type: "ok", text: tr("admin.rag.success.meta_looks_valid") });
      return;
    }

    const parts = [];
    if (missingRequired.length) {
      parts.push(tr("admin.rag.meta.missing_required", { fields: missingRequired.join(", ") }));
    }
    if (missingRecommended.length) {
      parts.push(tr("admin.rag.meta.missing_recommended", { fields: missingRecommended.join(", ") }));
    }

    setMetaCheck({
      type: "warn",
      text: parts.join(" | ")
    });
  }, [tr]);

  const handleRtXmlSubmit = useCallback(
    async event => {
      event.preventDefault();
      resetMessage();
      setRtXmlResult(null);

      const form = event.currentTarget;
      const xmlFile = form.rtXmlFile?.files?.[0];

      if (!xmlFile) {
        showError(tr("admin.rag.errors.rt_xml_required"));
        return;
      }

      const formData = new FormData();
      formData.append("file", xmlFile);

      setRtXmlBusy(true);

      try {
        const res = await fetch("/api/admin/rag/national-rt", {
          method: "POST",
          body: formData
        });
        const raw = await res.text();
        const data = raw ? JSON.parse(raw) : {};

        if (!res.ok || data?.ok === false) {
          throw new Error(resolveErrorText(data, "admin.rag.errors.rt_xml_ingest_failed"));
        }

        const docId = data?.docId || data?.doc_id || "";
        showOk(tr("admin.rag.success.rt_xml_ingested", { docId }));
        setRtXmlResult({
          docId,
          title: data?.title || "",
          actReference: data?.actReference || "",
          inserted: data?.inserted ?? null,
          sourceUrl: data?.sourceUrl || ""
        });
        setRtXmlFileName("");
        form.reset();
        await fetchDocuments();
      } catch (err) {
        showError(err?.message || tr("admin.rag.errors.rt_xml_ingest_failed"));
      } finally {
        setRtXmlBusy(false);
      }
    },
    [fetchDocuments, resetMessage, resolveErrorText, showError, showOk, tr]
  );

  const handleUrlSubmit = useCallback(
    async event => {
      event.preventDefault();
      resetMessage();
      const form = event.currentTarget;
      const urlValue = form.url?.value?.trim();

      if (!urlValue) {
        showError(tr("admin.rag.errors.url_required"));
        return;
      }

      const payload = {
        url: urlValue,
        audience: urlAudience
      };
      const tagArr = splitTags(urlTags);
      if (tagArr.length) payload.tags = tagArr;
      if (urlTitle.trim()) payload.title = urlTitle.trim();
      if (urlDescription.trim()) payload.description = urlDescription.trim();

      setUrlBusy(true);

      try {
        const res = await fetch("/api/rag/ingest/url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        const raw = await res.text();
        const data = raw ? JSON.parse(raw) : {};

        if (!res.ok) {
          throw new Error(resolveErrorText(data, "admin.rag.errors.url_ingest_failed"));
        }

        showOk(tr("admin.rag.success.url_sent"));
        setUrlAudience("BOTH");
        setUrlTitle("");
        setUrlDescription("");
        setUrlTags("");
        form.reset();
        await fetchDocuments();
      } catch (err) {
        showError(err?.message || tr("admin.rag.errors.url_ingest_failed"));
      } finally {
        setUrlBusy(false);
      }
    },
    [fetchDocuments, resetMessage, resolveErrorText, showError, showOk, tr, urlAudience, urlDescription, urlTags, urlTitle]
  );

  const handleArticlesSubmit = useCallback(
    async event => {
      event.preventDefault();
      resetMessage();
      setArticlesResult(null);

      const form = event.currentTarget;
      const docIdInput = (articlesDocId || form.articlesDocId?.value || "").trim();
      const jsonFile = form.articlesJsonFile?.files?.[0];
      const jsonText = form.articlesJsonText?.value?.trim();
      let raw = jsonText || "";

      if (!raw && jsonFile) {
        try {
          raw = await jsonFile.text();
        } catch {
          raw = "";
        }
      }

      if (!raw) {
        showError(tr("admin.rag.errors.articles_json_required"));
        return;
      }

      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        showError(tr("admin.rag.errors.articles_json_invalid"));
        return;
      }

      let payloadDocId = docIdInput;
      let articles = null;

      if (Array.isArray(parsed)) {
        articles = parsed;
      } else if (parsed && typeof parsed === "object") {
        if (!payloadDocId) payloadDocId = parsed.docId || parsed.doc_id || "";
        if (Array.isArray(parsed.articles)) articles = parsed.articles;
      }

      if (!payloadDocId) {
        showError(tr("admin.rag.errors.doc_id_required"));
        return;
      }

      if (!Array.isArray(articles) || !articles.length) {
        showError(tr("admin.rag.errors.articles_array_required"));
        return;
      }

      const invalid = articles.find(article => {
        if (!article || typeof article !== "object") return true;
        if (!article.title) return true;
        const hasRange = Boolean(article.pageRange) || (Number.isFinite(article.startPage) && Number.isFinite(article.endPage));
        return !hasRange;
      });

      if (invalid) {
        showError(tr("admin.rag.errors.article_item_invalid"));
        return;
      }

      setArticlesBusy(true);

      try {
        const res = await fetch("/api/rag/ingest/articles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            docId: payloadDocId,
            articles
          })
        });
        const rawRes = await res.text();
        const data = rawRes ? JSON.parse(rawRes) : {};

        if (!res.ok || data?.ok === false) {
          throw new Error(resolveErrorText(data, "admin.rag.errors.articles_ingest_failed"));
        }

        showOk(tr("admin.rag.success.articles_added_with_doc_id", { docId: payloadDocId }));
        setArticlesResult({
          docId: payloadDocId,
          count: data?.count ?? null,
          inserted: Array.isArray(data?.inserted) ? data.inserted : []
        });
        setArticlesJson("");
        setArticlesJsonFileName("");
        form.reset();
        await fetchDocuments();
      } catch (err) {
        showError(err?.message || tr("admin.rag.errors.articles_ingest_failed"));
      } finally {
        setArticlesBusy(false);
      }
    },
    [articlesDocId, fetchDocuments, resetMessage, resolveErrorText, showError, showOk, tr]
  );

  const handleReindex = useCallback(
    async docId => {
      resetMessage();
      setReindexingId(docId);

      try {
        const res = await fetch(`/api/rag/documents/${docId}/reindex`, {
          method: "POST"
        });
        const raw = await res.text();
        const data = raw ? JSON.parse(raw) : {};

        if (!res.ok) {
          throw new Error(resolveErrorText(data, "admin.rag.errors.reindex_failed"));
        }

        showOk(tr("admin.rag.success.reindex_started"));
        setDocs(prev => prev.map(doc => (doc.id === docId ? { ...doc, ...data.doc } : doc)));
        await fetchDocuments();
      } catch (err) {
        showError(err?.message || tr("admin.rag.errors.reindex_failed"));
      } finally {
        setReindexingId(null);
      }
    },
    [fetchDocuments, resetMessage, resolveErrorText, showError, showOk, tr]
  );

  const handleBulkReindex = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    for (const id of ids) {
      await handleReindex(id);
    }
  }, [selectedIds, handleReindex]);

  const handleDelete = useCallback(
    docId => {
      resetMessage();
      if (!docId || deletingId) return;
      setDeleteConfirmDocId(docId);
    },
    [deletingId, resetMessage]
  );

  const closeDeleteConfirm = useCallback(() => {
    if (deletingId) return;
    setDeleteConfirmDocId(null);
  }, [deletingId]);

  const confirmDelete = useCallback(async () => {
    const docId = deleteConfirmDocId;
    if (!docId) return;

    resetMessage();
    setDeletingId(docId);

    try {
      const res = await fetch(`/api/rag/documents/${docId}`, {
        method: "DELETE"
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!res.ok) {
        throw new Error(resolveErrorText(data, "admin.rag.errors.delete_failed"));
      }

      showOk(tr("admin.rag.success.document_deleted"));
      setDocs(prev => prev.filter(doc => doc.id !== docId));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    } catch (err) {
      showError(err?.message || tr("admin.rag.errors.delete_failed"));
    } finally {
      setDeletingId(null);
      setDeleteConfirmDocId(null);
    }
  }, [deleteConfirmDocId, resetMessage, resolveErrorText, showError, showOk, tr]);

  const normalizedDocs = useMemo(
    () =>
      docs.map((doc, index) => ({
        ...normalizeDoc(doc),
        _idx: index
      })),
    [docs]
  );

  const sectionOptions = useMemo(
    () => Array.from(new Set(normalizedDocs.map(doc => doc.section).filter(Boolean))).sort(),
    [normalizedDocs]
  );
  const audienceOptions = useMemo(
    () => Array.from(new Set(normalizedDocs.map(doc => doc.audience).filter(Boolean))),
    [normalizedDocs]
  );
  const yearOptions = useMemo(
    () =>
      Array.from(new Set(normalizedDocs.map(doc => String(doc.year || "").trim()).filter(Boolean))).sort((a, b) =>
        b.localeCompare(a)
      ),
    [normalizedDocs]
  );
  const issueOptions = useMemo(
    () => Array.from(new Set(normalizedDocs.map(doc => doc.issueLabel).filter(Boolean))).sort(),
    [normalizedDocs]
  );

  const sectionFilterOptions = useMemo(
    () => [{ value: "ALL", label: tr("admin.rag.documents.filters.all_sections") }, ...sectionOptions.map(value => ({ value, label: value }))],
    [sectionOptions, tr]
  );
  const audienceFilterOptions = useMemo(
    () => [{ value: "ALL", label: tr("admin.rag.documents.filters.all_audiences") }, ...audienceOptions.map(value => ({ value, label: getAudienceLabel(value) }))],
    [audienceOptions, getAudienceLabel, tr]
  );
  const yearFilterOptions = useMemo(
    () => [{ value: "ALL", label: tr("admin.rag.documents.filters.all_years") }, ...yearOptions.map(value => ({ value, label: value }))],
    [tr, yearOptions]
  );
  const sortOptions = useMemo(
    () => [
      { value: "recent", label: tr("admin.rag.documents.sort.recent") },
      { value: "title", label: tr("admin.rag.documents.sort.title") },
      { value: "section", label: tr("admin.rag.documents.sort.section") },
      { value: "year", label: tr("admin.rag.documents.sort.year") },
      { value: "issue", label: tr("admin.rag.documents.sort.issue") }
    ],
    [tr]
  );
  const issueFilterOptions = useMemo(
    () => [{ value: "ALL", label: tr("admin.rag.documents.filters.all_issues") }, ...issueOptions.map(value => ({ value, label: value }))],
    [issueOptions, tr]
  );
  const sourceOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        normalizedDocs
          .map(doc => {
            const source = String(doc.url || doc.source_url || doc.source_path || "").trim();
            if (!source) return "NO_SOURCE";
            if (/^https?:\/\//i.test(source)) {
              try {
                return new URL(source).hostname.replace(/^www\./i, "") || "NO_SOURCE";
              } catch {
                return source;
              }
            }
            return "LOCAL_FILE";
          })
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return [
      { value: "ALL", label: "Koik allikad" },
      ...values.map(value => ({
        value,
        label: value === "LOCAL_FILE" ? "Kohalik fail" : value === "NO_SOURCE" ? "Allikas puudub" : value
      }))
    ];
  }, [normalizedDocs]);

  const allTags = useMemo(
    () =>
      Array.from(new Set(normalizedDocs.flatMap(doc => doc.tags || [])))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [normalizedDocs]
  );

  const topTags = useMemo(() => {
    const counts = new Map();

    normalizedDocs.forEach(doc => {
      (doc.tags || []).forEach(tag => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [normalizedDocs]);

  const activeMetaTemplate = useMemo(() => {
    const found = metaTemplates.find(template => template.key === activeMetaTemplateKey);
    return found || metaTemplates[0];
  }, [activeMetaTemplateKey, metaTemplates]);

  useEffect(() => {
    let cancelled = false;

    const loadTemplate = async () => {
      const file = activeMetaTemplate?.file;
      if (!file) {
        setActiveMetaTemplateContent("");
        return;
      }

      try {
        const response = await fetch(file, { cache: "no-store" });
        const text = await response.text();
        if (cancelled) return;
        setActiveMetaTemplateContent(text || "");
      } catch {
        if (cancelled) return;
        setActiveMetaTemplateContent("");
      }
    };

    loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [activeMetaTemplate]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const tagSet = new Set(filterTags);

    const list = normalizedDocs.filter(doc => {
      if (filterSection !== "ALL" && doc.section !== filterSection) return false;
      if (filterAudience !== "ALL" && doc.audience !== filterAudience) return false;
      if (filterSource !== "ALL") {
        const source = String(doc.url || doc.source_url || doc.source_path || "").trim();
        const sourceBucket = !source
          ? "NO_SOURCE"
          : /^https?:\/\//i.test(source)
            ? (() => {
                try {
                  return new URL(source).hostname.replace(/^www\./i, "") || "NO_SOURCE";
                } catch {
                  return source;
                }
              })()
            : "LOCAL_FILE";
        if (sourceBucket !== filterSource) return false;
      }
      if (filterYear !== "ALL" && String(doc.year || "") !== filterYear) return false;
      if (filterIssue !== "ALL" && doc.issueLabel !== filterIssue) return false;

      if (tagSet.size) {
        const docTags = doc.tags || [];
        for (const tag of tagSet) {
          if (!docTags.includes(tag)) return false;
        }
      }

      if (!q) return true;

      const haystack = [
        doc.title,
        doc.description,
        doc.section,
        doc.issueLabel,
        doc.issueId,
        doc.year,
        doc.docId,
        doc.articleId,
        doc.journalTitle,
        doc.language,
        doc.source_path,
        doc.source_url,
        doc.url,
        (doc.authors || []).join(" "),
        (doc.tags || []).join(" ")
      ]
        .filter(Boolean)
        .join(" | ")
        .toLowerCase();

      return haystack.includes(q);
    });

    return list.sort((a, b) => {
      if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
      if (sortBy === "section") return (a.section || "").localeCompare(b.section || "");
      if (sortBy === "year") return String(b.year || "").localeCompare(String(a.year || ""));
      if (sortBy === "issue") return (a.issueLabel || "").localeCompare(b.issueLabel || "");
      const aDate = deriveSyncedAt(a);
      const bDate = deriveSyncedAt(b);
      return new Date(bDate || 0) - new Date(aDate || 0);
    });
  }, [normalizedDocs, searchQuery, filterSection, filterAudience, filterSource, filterYear, filterIssue, filterTags, sortBy]);

  const filteredCount = filteredDocs.length;

  const docMetrics = useMemo(() => {
    let pending = 0;
    let processing = 0;
    let failed = 0;
    let completed = 0;

    normalizedDocs.forEach(doc => {
      const status = deriveStatus(doc);
      if (status === "PENDING") pending += 1;
      else if (status === "PROCESSING") processing += 1;
      else if (status === "FAILED") failed += 1;
      else completed += 1;
    });

    return {
      total: normalizedDocs.length,
      filtered: filteredCount,
      pending,
      processing,
      failed,
      completed,
      selected: selectedIds.size
    };
  }, [normalizedDocs, filteredCount, selectedIds.size]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, filterSection, filterAudience, filterSource, filterYear, filterIssue, filterTags, sortBy]);

  const visibleDocs = filteredDocs.slice(0, visibleCount);

  const previewDoc = useMemo(
    () => (previewId ? visibleDocs.find(doc => doc.id === previewId) || null : visibleDocs[0] || null),
    [previewId, visibleDocs]
  );

  useEffect(() => {
    if (!visibleDocs.length) {
      if (previewId !== null) setPreviewId(null);
      return;
    }

    if (!previewId || !visibleDocs.some(doc => doc.id === previewId)) {
      setPreviewId(visibleDocs[0].id);
    }
  }, [visibleDocs, previewId]);

  const toggleSelect = useCallback(id => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleFilterTag = useCallback(tag => {
    setFilterTags(prev => {
      if (prev.includes(tag)) return prev.filter(entry => entry !== tag);
      return [...prev, tag];
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const ids = visibleDocs.map(doc => doc.id).filter(Boolean);
      const allOn = ids.every(id => next.has(id));
      if (allOn) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }, [visibleDocs]);

  const openDetail = useCallback(doc => {
    if (!doc) return;
    if (deriveDocType(doc) !== "FILE") return;
    setDetailDoc(doc);
    setDetailForm(buildDetailFormFromDoc(doc));
  }, []);

  const closeDetail = useCallback(() => setDetailDoc(null), []);

  const saveDetail = useCallback(async () => {
    if (!detailDoc) return;

    if (deriveDocType(detailDoc) !== "FILE") {
      showError(tr("admin.rag.errors.meta_update_failed"));
      return;
    }

    resetMessage();

    const payload = {
      title: detailForm.title?.trim() || null,
      description: detailForm.description?.trim() || null,
      authors: splitAuthors(detailForm.authors),
      tags: splitTags(detailForm.tags),
      section: detailForm.section?.trim() || null,
      issueId: detailForm.issueId?.trim() || null,
      issueLabel: detailForm.issueLabel?.trim() || null,
      articleId: detailForm.articleId?.trim() || null,
      audience: detailForm.audience || null,
      pageRange: detailForm.pageRange?.trim() || null,
      journalTitle: detailForm.journalTitle?.trim() || null
    };

    const year = detailForm.year?.trim();
    if (year) payload.year = Number.isNaN(Number(year)) ? year : Number(year);

    const startPage = detailForm.pdf_start_page?.trim();
    const endPage = detailForm.pdf_end_page?.trim();
    if (startPage) payload.pdf_start_page = Number(startPage);
    if (endPage) payload.pdf_end_page = Number(endPage);

    try {
      const res = await fetch(`/api/rag/documents/${detailDoc.id}/update-meta`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!res.ok || data?.ok === false) {
        throw new Error(resolveErrorText(data, "admin.rag.errors.meta_update_failed"));
      }

      showOk(tr("admin.rag.success.meta_saved"));
      setDocs(prev =>
        prev.map(doc =>
          doc.id === detailDoc.id
            ? {
                ...doc,
                ...payload,
                metadata: {
                  ...(doc.metadata || {}),
                  ...payload
                }
              }
            : doc
        )
      );
      closeDetail();
      await fetchDocuments();
    } catch (err) {
      showError(err?.message || tr("admin.rag.errors.meta_update_failed"));
    }
  }, [closeDetail, detailDoc, detailForm, fetchDocuments, resetMessage, resolveErrorText, showError, showOk, tr]);

  const handleSelftest = useCallback(async () => {
    if (selftestBusy) return;

    setSelftestBusy(true);
    setSelftestSteps(null);
    resetMessage();

    try {
      const res = await fetch("/api/rag/selftest", {
        method: "POST",
        cache: "no-store"
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!res.ok || data?.ok === false) {
        throw new Error(resolveErrorText(data, "admin.rag.errors.selftest_failed"));
      }

      setSelftestSteps(Array.isArray(data?.steps) ? data.steps : []);
      setMessage({
        type: "success",
        text: tr("admin.rag.success.selftest_finished")
      });
      await fetchDocuments();
    } catch (err) {
      setMessage({
        type: "error",
        text: err?.message || tr("admin.rag.errors.selftest_aborted")
      });
    } finally {
      setSelftestBusy(false);
    }
  }, [fetchDocuments, resetMessage, resolveErrorText, selftestBusy, tr]);

  const canEditDocMeta = useCallback(doc => deriveDocType(doc) === "FILE", []);
  const canViewSource = useCallback(doc => {
    const docType = deriveDocType(doc);
    if (docType === "FILE") return Boolean(doc?.id);
    if (docType === "URL") return Boolean(doc?.url || doc?.source_url);
    return false;
  }, []);

  const viewSource = useCallback(doc => {
    const docType = deriveDocType(doc);
    const href =
      docType === "FILE"
        ? `/api/rag/documents/${encodeURIComponent(doc?.id || "")}/source`
        : doc?.url || doc?.source_url;

    if (!href) return;
    window.open(href, "_blank", "noopener,noreferrer");
  }, []);

  const hasIngestAside = Boolean(showMetaGuide || (Array.isArray(selftestSteps) && selftestSteps.length));

  return {
    tr,
    locale,
    localeTag,
    docs,
    loadingList,
    message,
    selftestBusy,
    selftestSteps,
    pdfMetaAudience,
    setPdfMetaAudience,
    pdfMetaBusy,
    pdfMetaResult,
    pdfFileName,
    setPdfFileName,
    pdfMetaFileName,
    setPdfMetaFileName,
    pdfMetaText,
    setPdfMetaText,
    rtXmlFileName,
    setRtXmlFileName,
    rtXmlBusy,
    rtXmlResult,
    metaCheck,
    showMetaGuide,
    setShowMetaGuide,
    activeMetaTemplateKey,
    setActiveMetaTemplateKey,
    activeMetaTemplate,
    activeMetaTemplateContent,
    articlesDocId,
    setArticlesDocId,
    articlesJson,
    setArticlesJson,
    articlesJsonFileName,
    setArticlesJsonFileName,
    articlesBusy,
    articlesResult,
    urlBusy,
    urlAudience,
    setUrlAudience,
    urlTitle,
    setUrlTitle,
    urlDescription,
    setUrlDescription,
    urlTags,
    setUrlTags,
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
    filterIssue,
    setFilterIssue,
    filterTags,
    sortBy,
    setSortBy,
    selectedIds,
    visibleCount,
    setVisibleCount,
    previewId,
    setPreviewId,
    detailDoc,
    detailForm,
    setDetailForm,
    reindexingId,
    deletingId,
    deleteConfirmDocId,
    urlFormRef,
    pdfFormRef,
    pdfFileInputRef,
    pdfMetaFileInputRef,
    rtXmlFormRef,
    rtXmlFileInputRef,
    articlesFileInputRef,
    articlesFormRef,
    resetMessage,
    getAudienceLabel,
    showError,
    showOk,
    resolveErrorText,
    fetchDocuments,
    statusLabels,
    audienceSelectOptions,
    metaTemplates,
    handlePdfMetaSubmit,
    handleMetaCheck,
    handleRtXmlSubmit,
    handleUrlSubmit,
    handleArticlesSubmit,
    handleReindex,
    handleBulkReindex,
    handleDelete,
    closeDeleteConfirm,
    confirmDelete,
    normalizedDocs,
    sectionFilterOptions,
    audienceFilterOptions,
    sourceFilterOptions: sourceOptions,
    yearFilterOptions,
    sortOptions,
    issueFilterOptions,
    allTags,
    topTags,
    filteredDocs,
    filteredCount,
    docMetrics,
    visibleDocs,
    previewDoc,
    toggleSelect,
    toggleFilterTag,
    toggleSelectAllVisible,
    openDetail,
    closeDetail,
    saveDetail,
    handleSelftest,
    canEditDocMeta,
    canViewSource,
    viewSource,
    hasIngestAside
  };
}
