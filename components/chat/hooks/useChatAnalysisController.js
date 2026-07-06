import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  buildAnalyzeAcceptAttr,
  DEFAULT_ANALYZE_ALLOWED_MIME_CSV,
  DEFAULT_ANALYZE_MAX_UPLOAD_MB,
  readAnalyzeMaxUploadMb
} from "@/lib/chat/analyzeFileConfig";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
export function useChatAnalysisController({
  t,
  locale: _locale,
  sessionUserId,
  userRole = "CLIENT",
  chatWindowRef,
  visibleMessagesCount,
  isGeneratingRef
}) {
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadedMaterials, setUploadedMaterials] = useState([]);
  const [uploadUsage, setUploadUsage] = useState(null);
  const [docOnlyMode, setDocOnlyMode] = useState(true);
  const [analysisPanelOpen, setAnalysisPanelOpen] = useState(false);
  const [analysisCollapsed, setAnalysisCollapsed] = useState(false);
  const [_analysisPanelInline, setAnalysisPanelInline] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const fileInputRef = useRef(null);
  const analysisPanelRef = useRef(null);
  const pageScrollRef = useRef(null);
  const normalizedRole = useMemo(
    () => (String(userRole || "").trim().toUpperCase() === "CLIENT" ? "CLIENT" : "SOCIAL_WORKER"),
    [userRole]
  );
  const uploadFileLimit = useMemo(
    () => (normalizedRole === "CLIENT" ? 2 : 10),
    [normalizedRole]
  );
  const uploadPreview = useMemo(
    () => (uploadedMaterials.length ? uploadedMaterials[uploadedMaterials.length - 1] : null),
    [uploadedMaterials]
  );
  const uploadedFileNames = useMemo(
    () =>
      uploadedMaterials
        .map(item => String(item?.fileName || "").trim())
        .filter(Boolean),
    [uploadedMaterials]
  );
  const uploadedFilesCount = uploadedFileNames.length;
  const ephemeralChunks = useMemo(
    () =>
      uploadedMaterials.flatMap(item =>
        Array.isArray(item?.chunks)
          ? item.chunks.filter(chunk => typeof chunk === "string" && chunk.trim())
          : []
      ),
    [uploadedMaterials]
  );
  const ephemeralSource = useMemo(() => {
    if (!uploadedFileNames.length) return null;
    if (uploadedFileNames.length === 1) {
      return {
        fileName: uploadedFileNames[0],
        fileNames: uploadedFileNames
      };
    }
    return {
      fileName: `${uploadedFileNames[0]} +${uploadedFileNames.length - 1}`,
      fileNames: uploadedFileNames
    };
  }, [uploadedFileNames]);
  const hasAnalysisContent = !!(uploadedMaterials.length || uploadBusy);
  const hasAnyAnalysisState = !!(uploadedMaterials.length || uploadBusy || uploadError);
  const showAnalysisPanel = analysisPanelOpen || hasAnyAnalysisState;
  const previewText = useMemo(() => {
    if (uploadPreview?.fullText && uploadPreview.fullText.trim()) return uploadPreview.fullText;
    if (uploadPreview?.preview && uploadPreview.preview.trim()) return uploadPreview.preview;
    return "";
  }, [uploadPreview]);
  const isAnalysisExpanded = Boolean(previewText && !analysisCollapsed);
  const analysisPanelMode = isAnalysisExpanded
    ? "expanded"
    : showAnalysisPanel && !uploadPreview
    ? "overlay"
    : "inline";
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobileViewport(!!mq.matches);
    update();
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const ensureOpen = () => {
      if (!uploadPreview) return;
      setAnalysisPanelOpen(true);
    };
    document.addEventListener("visibilitychange", ensureOpen);
    window.addEventListener("focus", ensureOpen);
    return () => {
      document.removeEventListener("visibilitychange", ensureOpen);
      window.removeEventListener("focus", ensureOpen);
    };
  }, [uploadPreview]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const shouldLockPageScroll = isMobileViewport && showAnalysisPanel && !!uploadPreview;
    if (!shouldLockPageScroll) return;
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("chat-analysis-scroll-open");
    body.classList.add("chat-analysis-scroll-open");
    return () => {
      root.classList.remove("chat-analysis-scroll-open");
      body.classList.remove("chat-analysis-scroll-open");
    };
  }, [isMobileViewport, showAnalysisPanel, uploadPreview]);
  const scrollAnalysisPanelIntoView = useCallback((options = {}) => {
    requestAnimationFrame(() => {
      try {
        const panel = analysisPanelRef.current;
        if (!panel) return;
        const mode = panel.dataset?.analysisMode;
        const force = !!options.force;
        if (!force) {
          if (!panel.closest(".chat-container")) return;
          if (!mode) return;
          if (mode === "overlay" || mode === "expanded") return;
        }
        panel.scrollIntoView({
          behavior: options.behavior || "smooth",
          block: options.block || "nearest"
        });
      } catch {}
    });
  }, []);
  const capturePageScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    const scroller = document.scrollingElement || document.documentElement;
    pageScrollRef.current = scroller ? scroller.scrollTop : window.scrollY;
  }, []);
  const preservePageScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    const scroller = document.scrollingElement || document.documentElement;
    const y = typeof pageScrollRef.current === "number" ? pageScrollRef.current : scroller ? scroller.scrollTop : window.scrollY;
    const restore = () => {
      if (scroller) {
        scroller.scrollTop = y;
      } else {
        window.scrollTo({
          top: y,
          behavior: "auto"
        });
      }
    };
    requestAnimationFrame(restore);
    setTimeout(restore, 0);
    setTimeout(restore, 80);
    setTimeout(restore, 200);
    setTimeout(restore, 350);
  }, []);
  const ensureAnalysisPanelVisible = useCallback(() => {
    capturePageScroll();
    preservePageScroll();
    setAnalysisCollapsed(false);
    setAnalysisPanelOpen(true);
    scrollAnalysisPanelIntoView();
  }, [capturePageScroll, preservePageScroll, scrollAnalysisPanelIntoView]);
  const toggleAnalysisCollapse = useCallback(() => {
    if (!hasAnalysisContent) return;
    setAnalysisCollapsed(prev => !prev);
    scrollAnalysisPanelIntoView({
      force: true,
      behavior: "auto",
      block: "start"
    });
    setTimeout(() => scrollAnalysisPanelIntoView({
      force: true,
      behavior: "auto",
      block: "start"
    }), 120);
    setTimeout(() => scrollAnalysisPanelIntoView({
      force: true,
      behavior: "auto",
      block: "start"
    }), 260);
  }, [hasAnalysisContent, scrollAnalysisPanelIntoView]);
  const closeAnalysisPanel = useCallback(() => {
    setAnalysisPanelOpen(false);
    setAnalysisCollapsed(false);
    setUploadBusy(false);
  }, []);
  useEffect(() => {
    if (hasAnyAnalysisState) {
      if (!uploadPreview) {
        capturePageScroll();
        preservePageScroll();
      }
      setAnalysisCollapsed(false);
      setAnalysisPanelOpen(true);
      if (uploadPreview) {
        scrollAnalysisPanelIntoView({
          force: true,
          block: "start"
        });
      } else {
        scrollAnalysisPanelIntoView();
      }
    } else {
      setAnalysisCollapsed(false);
    }
  }, [hasAnyAnalysisState, uploadPreview, capturePageScroll, preservePageScroll, scrollAnalysisPanelIntoView]);
  useLayoutEffect(() => {
    if (!showAnalysisPanel) return;
    if (uploadPreview) return;
    preservePageScroll();
  }, [showAnalysisPanel, uploadPreview, preservePageScroll]);
  useLayoutEffect(() => {
    if (isMobileViewport || !showAnalysisPanel || isAnalysisExpanded) {
      setAnalysisPanelInline(false);
      return;
    }
    const node = chatWindowRef?.current;
    if (!node) return;
    const updateLayout = () => {
      const hasOverflow = node.scrollHeight - node.clientHeight > 8;
      setAnalysisPanelInline(prev => {
        const next = !hasOverflow;
        return prev === next ? prev : next;
      });
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(updateLayout);
      ro.observe(node);
    }
    return () => {
      window.removeEventListener("resize", updateLayout);
      ro?.disconnect?.();
    };
  }, [isMobileViewport, showAnalysisPanel, isAnalysisExpanded, visibleMessagesCount, chatWindowRef]);
  const MAX_UPLOAD_MB = useMemo(() => {
    return readAnalyzeMaxUploadMb(process.env.NEXT_PUBLIC_RAG_MAX_UPLOAD_MB, DEFAULT_ANALYZE_MAX_UPLOAD_MB);
  }, []);
  const MAX_ANALYZE_CHUNKS = useMemo(() => {
    const v = Number(process.env.NEXT_PUBLIC_CHAT_ANALYZE_MAX_CHUNKS || 80);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 80;
  }, []);
  const RAW_ALLOWED_MIME = String(process.env.NEXT_PUBLIC_RAG_ALLOWED_MIME || DEFAULT_ANALYZE_ALLOWED_MIME_CSV);
  const ALLOWED_MIME_LIST = useMemo(() => {
    const out = RAW_ALLOWED_MIME.split(",").map(s => s.trim()).filter(Boolean);
    return out.length ? out : ["application/pdf"];
  }, [RAW_ALLOWED_MIME]);
  const acceptAttr = useMemo(() => buildAnalyzeAcceptAttr(ALLOWED_MIME_LIST), [ALLOWED_MIME_LIST]);
  const refreshUsage = useCallback(async () => {
    if (!sessionUserId) return;
    try {
      const res = await fetch("/api/chat/analyze-usage", {
        cache: "no-store"
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        setUploadUsage({
          used: typeof data.used === "number" ? data.used : 0,
          limit: typeof data.limit === "number" ? data.limit : 0
        });
      }
    } catch {}
  }, [sessionUserId]);
  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);
  const onPickFile = useCallback(() => {
    if (uploadBusy) return;
    if (isGeneratingRef?.current) return;
    if (uploadedFilesCount >= uploadFileLimit) {
      setUploadError(t("chat.upload.limit_reached").replace("{limit}", String(uploadFileLimit)));
      return;
    }
    setUploadError(null);
    try {
      fileInputRef.current?.click?.();
      preservePageScroll();
    } catch {}
  }, [isGeneratingRef, preservePageScroll, t, uploadBusy, uploadedFilesCount, uploadFileLimit]);
  const onFileChange = useCallback(async e => {
    const files = Array.from(e.target?.files || []);
    if (!files.length) return;
    setUploadError(null);
    setDocOnlyMode(true);
    const remainingSlots = Math.max(0, uploadFileLimit - uploadedFilesCount);
    if (!remainingSlots) {
      setUploadError(t("chat.upload.limit_reached").replace("{limit}", String(uploadFileLimit)));
      e.target.value = "";
      return;
    }
    const filesToProcess = files.slice(0, remainingSlots);
    const limitError =
      files.length > remainingSlots
        ? t("chat.upload.limit_reached").replace("{limit}", String(uploadFileLimit))
        : "";
    const nextMaterials = [];
    let latestError = "";
    try {
      setUploadBusy(true);
      for (const file of filesToProcess) {
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > MAX_UPLOAD_MB) {
          latestError = t("chat.upload.error_size").replace("{size}", sizeMB.toFixed(1)).replace("{limit}", String(MAX_UPLOAD_MB));
          continue;
        }
        try {
          const fd = new FormData();
          fd.append("file", file, file.name || "file");
          fd.append("mimeType", file.type || "");
          fd.append("maxChunks", String(MAX_ANALYZE_CHUNKS));
          const res = await fetch("/api/chat/analyze-file", {
            method: "POST",
            body: fd
          });
          const data = await res.json().catch(() => ({
            ok: false
          }));
          if (!res.ok || !data?.ok) {
            const statusError = resolveApiMessage({
              payload: data,
              t,
              fallbackKey: "chat.upload.error_status",
              fallbackText: t("chat.upload.error_status")
            }).replace("{status}", String(res.status));
            const statusErr = new Error("chat.upload.error_status");
            statusErr.userMessage = statusError;
            throw statusErr;
          }
          const chunksArray = Array.isArray(data.chunks) ? data.chunks : [];
          nextMaterials.push({
            fileName: data.fileName || file.name,
            sizeMB: typeof data.sizeMB === "number" ? data.sizeMB : Number(sizeMB.toFixed(2)),
            mimeType: data.mimeType || file.type,
            preview: data.preview || "",
            fullText:
              typeof data.fullText === "string" && data.fullText.trim()
                ? data.fullText
                : chunksArray.length
                  ? chunksArray.join("\n\n")
                  : data.preview || "",
            chunksCount: chunksArray.length,
            chunks: chunksArray
          });
        } catch (err) {
          latestError = err?.userMessage || t("chat.upload.error_generic");
        }
      }
      if (nextMaterials.length) {
        setUploadedMaterials(prev => [...prev, ...nextMaterials]);
        scrollAnalysisPanelIntoView({
          force: true,
          block: "start"
        });
        setTimeout(() => scrollAnalysisPanelIntoView({
          force: true,
          block: "start"
        }), 120);
        setTimeout(() => scrollAnalysisPanelIntoView({
          force: true,
          block: "start"
        }), 260);
        refreshUsage();
      }
      setUploadError(latestError || limitError || null);
    } catch (err) {
      const genericError = t("chat.upload.error_generic");
      setUploadError(err?.userMessage || genericError);
      setUploadedMaterials([]);
      setDocOnlyMode(true);
    } finally {
      setUploadBusy(false);
      e.target.value = "";
    }
  }, [
    MAX_ANALYZE_CHUNKS,
    MAX_UPLOAD_MB,
    refreshUsage,
    scrollAnalysisPanelIntoView,
    t,
    uploadedFilesCount,
    uploadFileLimit
  ]);

  const setUploadPreview = useCallback(nextPreview => {
    if (!nextPreview) {
      setUploadedMaterials([]);
      return;
    }
    setUploadedMaterials([nextPreview]);
  }, []);

  const setEphemeralChunks = useCallback(nextChunks => {
    const chunks = Array.isArray(nextChunks)
      ? nextChunks.filter(chunk => typeof chunk === "string" && chunk.trim())
      : [];
    if (!chunks.length) {
      setUploadedMaterials([]);
      return;
    }
    setUploadedMaterials([
      {
        fileName: "chat-uploaded-material",
        preview: "",
        fullText: chunks.join("\n\n"),
        chunksCount: chunks.length,
        chunks
      }
    ]);
  }, []);
  return {
    analysisPanelRef,
    fileInputRef,
    uploadPreview,
    uploadedFilesCount,
    uploadedFileNames,
    uploadFileLimit,
    uploadBusy,
    uploadError,
    uploadUsage,
    previewText,
    docOnlyMode,
    setDocOnlyMode,
    ephemeralChunks,
    ephemeralSource,
    setEphemeralChunks,
    analysisCollapsed,
    showAnalysisPanel,
    analysisPanelMode,
    ensureAnalysisPanelVisible,
    toggleAnalysisCollapse,
    closeAnalysisPanel,
    onPickFile,
    onFileChange,
    setUploadPreview,
    setUploadError,
    acceptAttr
  };
}
