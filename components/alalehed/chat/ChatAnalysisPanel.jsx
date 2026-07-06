"use client";

import { createPortal } from "react-dom";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import OptionCard from "@/components/ui/OptionCard";

function normalizePreviewTextForDisplay(value = "") {
  const text = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n\n");

  const lines = text.split("\n").map((line) => line.replace(/[ \t]+$/g, ""));
  const compactLines = [];
  let previousWasBlank = false;

  for (const line of lines) {
    if (!line.trim()) {
      if (!previousWasBlank) {
        compactLines.push("");
      }
      previousWasBlank = true;
      continue;
    }

    compactLines.push(line);
    previousWasBlank = false;
  }

  return compactLines.join("\n").trim();
}

const ChatAnalysisPanel = memo(function ChatAnalysisPanel({
  t,
  analysisPanelRef,
  analysisPanelMode,
  uploadPreview,
  _uploadedFilesCount,
  _uploadedFileNames,
  uploadFileLimit,
  uploadBusy,
  uploadError,
  uploadUsage,
  previewText,
  analysisCollapsed,
  toggleAnalysisCollapse,
  docOnlyMode,
  setDocOnlyMode,
  extendedLabel,
  contextHint,
  inputRef,
  chatWindowRef,
  isMobileViewport,
  onPickFile,
  setUploadPreview,
  setUploadError,
  setEphemeralChunks,
  closeAnalysisPanel,
  isGenerating,
  prettifyFileName
}) {
  const previewRef = useRef(null);
  const scrollTrackRef = useRef(null);
  const contextHintWrapRef = useRef(null);
  const contextHintPopoverRef = useRef(null);
  const isDraggingScroll = useRef(false);
  const touchStartYRef = useRef(null);
  const [previewScroll, setPreviewScroll] = useState(0);
  const [contextHintOpen, setContextHintOpen] = useState(false);
  const [contextHintPlacement, setContextHintPlacement] = useState(null);
  const displayPreviewText = useMemo(
    () => normalizePreviewTextForDisplay(previewText),
    [previewText]
  );
  useEffect(() => {
    function updateScrollFromClientY(clientY) {
      const track = scrollTrackRef.current;
      const node = previewRef.current;
      if (!track || !node) return;
      const rect = track.getBoundingClientRect();
      const ratio = (clientY - rect.top) / rect.height;
      const clamped = Math.max(0, Math.min(1, ratio));
      const max = node.scrollHeight - node.clientHeight;
      if (max <= 0) return;
      setPreviewScroll(clamped);
      node.scrollTo({
        top: clamped * max,
        behavior: "auto"
      });
    }
    function handleMouseMove(e) {
      if (!isDraggingScroll.current) return;
      e.preventDefault();
      updateScrollFromClientY(e.clientY);
    }
    function handleMouseUp() {
      isDraggingScroll.current = false;
    }
    function handleTouchMove(e) {
      if (!isDraggingScroll.current) return;
      const touch = e.touches?.[0];
      if (!touch) return;
      e.preventDefault();
      updateScrollFromClientY(touch.clientY);
    }
    function handleTouchEnd() {
      isDraggingScroll.current = false;
    }
    const passiveFalse = {
      passive: false
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, passiveFalse);
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove, passiveFalse);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);
  useEffect(() => {
    if (!contextHintOpen) return undefined;
    function handlePointerDown(event) {
      const node = contextHintWrapRef.current;
      const popover = contextHintPopoverRef.current;
      if (node?.contains(event.target) || popover?.contains(event.target)) return;
      setContextHintOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setContextHintOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextHintOpen]);
  useLayoutEffect(() => {
    if (!contextHintOpen || typeof window === "undefined") {
      setContextHintPlacement(null);
      return undefined;
    }

    const updatePlacement = () => {
      const trigger = contextHintWrapRef.current;
      const popover = contextHintPopoverRef.current;
      if (!trigger || !popover) return;

      const margin = 12;
      const gap = 10;
      const rect = trigger.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(
        popRect.width || 0,
        Math.max(0, viewportWidth - margin * 2)
      );
      const centerX = rect.left + rect.width / 2;
      const left = Math.min(
        Math.max(centerX, margin + width / 2),
        viewportWidth - margin - width / 2
      );
      const spaceBelow = viewportHeight - rect.bottom - gap - margin;
      const spaceAbove = rect.top - gap - margin;
      const fitsBelow = spaceBelow >= popRect.height;
      const fitsAbove = spaceAbove >= popRect.height;
      const placeAbove = fitsAbove || !fitsBelow;
      const top = placeAbove
        ? Math.max(rect.top - gap - popRect.height, margin)
        : Math.min(rect.bottom + gap, viewportHeight - margin - popRect.height);

      setContextHintPlacement({
        top,
        left,
        width
      });
    };

    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(updatePlacement);
    });

    const onScroll = () => {
      window.requestAnimationFrame(updatePlacement);
    };
    const onResize = () => {
      window.requestAnimationFrame(updatePlacement);
    };

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [contextHintOpen, isMobileViewport]);
  const handlePreviewTouchStart = event => {
    const touch = event.touches?.[0];
    touchStartYRef.current = touch?.clientY ?? null;
  };
  const handlePreviewTouchMove = event => {
    if (isMobileViewport) return;
    const touch = event.touches?.[0];
    const startY = touchStartYRef.current;
    const node = previewRef.current;
    const chatNode = chatWindowRef?.current;
    if (!touch || startY == null || !node || !chatNode) return;
    const deltaY = touch.clientY - startY;
    const atTop = node.scrollTop <= 0;
    if (!atTop || deltaY <= 0) return;
    if (chatNode.scrollTop <= 0) return;
    event.preventDefault();
    chatNode.scrollTop = Math.max(0, chatNode.scrollTop - deltaY);
    touchStartYRef.current = touch.clientY;
  };
  const handlePreviewTouchEnd = () => {
    touchStartYRef.current = null;
  };
  const contextHintPopover =
    contextHintOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={contextHintPopoverRef}
            role="dialog"
            aria-modal="false"
            aria-label={contextHint}
            style={
              contextHintPlacement
                ? {
                    position: "fixed",
                    top: `${contextHintPlacement.top}px`,
                    left: `${contextHintPlacement.left}px`,
                    width: `${contextHintPlacement.width}px`,
                    transform: "translateX(-50%)"
                  }
                : {
                    position: "fixed",
                    top: "-10000px",
                    left: "-10000px",
                    transform: "translateX(-50%)"
                  }
            }
          >
            {contextHint}
          </div>,
          document.body
        )
      : null;
  const handleClose = () => {
    setUploadPreview(null);
    setUploadError(null);
    setEphemeralChunks([]);
    setDocOnlyMode(true);
    closeAnalysisPanel();
  };
  return (
    <section
      ref={analysisPanelRef}
      role="region"
      aria-live="polite"
      aria-label={t("chat.upload.summary")}
      data-analysis-mode={analysisPanelMode}
    >
      <div>
        <button
          type="button"
          onClick={handleClose}
          aria-label={t("buttons.close")}
        >
          x
        </button>
        <header>
              {uploadPreview ? (
                <div>
                  <div>
                    {prettifyFileName(uploadPreview.fileName)}
                  </div>
                </div>
              ) : null}
        </header>
        <div>
          {uploadBusy ? (
            <div>{t("chat.upload.busy")}</div>
          ) : null}
          {uploadError ? (
            <div>{uploadError}</div>
          ) : null}
          {uploadPreview ? (
            <>
              <div>
                <div>
                  <OptionCard
                    type="checkbox"
                    name="chat-doc-mode"
                    checked={!docOnlyMode}
                    onChange={e => setDocOnlyMode(!e.target.checked)}
                  >
                    {extendedLabel}
                  </OptionCard>
                <div ref={contextHintWrapRef}>
                  <Button
                    type="button"
                    size="md"
                    variant="primary"
                    onClick={() => setContextHintOpen(prev => !prev)}
                    aria-label={contextHint}
                    aria-pressed={contextHintOpen ? "true" : "false"}
                    aria-expanded={contextHintOpen ? "true" : "false"}
                    aria-describedby={contextHintOpen ? "chat-upload-context-hint" : undefined}
                    title={contextHint}
                  >
                    ?
                  </Button>
                </div>
              </div>
              </div>
              <p id="chat-upload-context-hint" className="sr-only">
                {contextHint}
              </p>
              {contextHintPopover}
              {displayPreviewText ? (
                <div>
                  <Button
                    type="button"
                    size="md"
                    variant="primary"
                    onClick={() => {
                      inputRef.current?.focus();
                      inputRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                      });
                    }}
                    aria-label={t("chat.upload.jump_to_chat")}
                    title={t("chat.upload.jump_to_chat")}
                  >
                    {t("chat.upload.jump_to_chat")}
                  </Button>
                  <Button
                    type="button"
                    size="md"
                    variant="primary"
                    onClick={toggleAnalysisCollapse}
                  >
                    {analysisCollapsed
                      ? t("chat.upload.summary_show")
                      : t("chat.upload.summary_hide")}
                  </Button>
                </div>
              ) : null}

              {!analysisCollapsed && displayPreviewText ? (
                <div>
                  <div
                    ref={previewRef}
                    tabIndex={0}
                    aria-label={t("chat.upload.preview")}
                    onTouchStart={handlePreviewTouchStart}
                    onTouchMove={handlePreviewTouchMove}
                    onTouchEnd={handlePreviewTouchEnd}
                    onTouchCancel={handlePreviewTouchEnd}
                    onScroll={() => {
                      const node = previewRef.current;
                      if (!node) return;
                      const max = node.scrollHeight - node.clientHeight;
                      if (max <= 0) {
                        setPreviewScroll(0);
                        return;
                      }
                      setPreviewScroll(node.scrollTop / max);
                    }}
                  >
                    {displayPreviewText}
                  </div>
                  <div
                    ref={scrollTrackRef}
                    onClick={event => {
                      const track = scrollTrackRef.current;
                      const node = previewRef.current;
                      if (!track || !node) return;
                      const rect = track.getBoundingClientRect();
                      const ratio = (event.clientY - rect.top) / rect.height;
                      const max = node.scrollHeight - node.clientHeight;
                      if (max <= 0) return;
                      const clamped = Math.max(0, Math.min(1, ratio));
                      setPreviewScroll(clamped);
                      node.scrollTo({
                        top: clamped * max,
                        behavior: "smooth"
                      });
                    }}
                    onMouseDown={event => {
                      const track = scrollTrackRef.current;
                      const node = previewRef.current;
                      if (track && node) {
                        const rect = track.getBoundingClientRect();
                        const ratio = (event.clientY - rect.top) / rect.height;
                        const max = node.scrollHeight - node.clientHeight;
                        if (max > 0) {
                          const clamped = Math.max(0, Math.min(1, ratio));
                          setPreviewScroll(clamped);
                          node.scrollTo({
                            top: clamped * max,
                            behavior: "auto"
                          });
                        }
                      }
                      isDraggingScroll.current = true;
                      event.preventDefault();
                    }}
                    onTouchStart={event => {
                      const track = scrollTrackRef.current;
                      const node = previewRef.current;
                      const touch = event.touches?.[0];
                      if (track && node && touch) {
                        const rect = track.getBoundingClientRect();
                        const ratio = (touch.clientY - rect.top) / rect.height;
                        const max = node.scrollHeight - node.clientHeight;
                        if (max > 0) {
                          const clamped = Math.max(0, Math.min(1, ratio));
                          setPreviewScroll(clamped);
                          node.scrollTo({
                            top: clamped * max,
                            behavior: "auto"
                          });
                        }
                      }
                      isDraggingScroll.current = true;
                      event.preventDefault();
                    }}
                    aria-hidden="true"
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: `calc(${previewScroll * 100}% + 0.3rem)`
                      }}
                      onMouseDown={event => {
                        const track = scrollTrackRef.current;
                        const node = previewRef.current;
                        if (track && node) {
                          const rect = track.getBoundingClientRect();
                          const ratio = (event.clientY - rect.top) / rect.height;
                          const max = node.scrollHeight - node.clientHeight;
                          if (max > 0) {
                            const clamped = Math.max(0, Math.min(1, ratio));
                            setPreviewScroll(clamped);
                            node.scrollTo({
                              top: clamped * max,
                              behavior: "auto"
                            });
                          }
                        }
                        isDraggingScroll.current = true;
                        event.preventDefault();
                      }}
                      onTouchStart={event => {
                        const track = scrollTrackRef.current;
                        const node = previewRef.current;
                        const touch = event.touches?.[0];
                        if (track && node && touch) {
                          const rect = track.getBoundingClientRect();
                          const ratio = (touch.clientY - rect.top) / rect.height;
                          const max = node.scrollHeight - node.clientHeight;
                          if (max > 0) {
                            const clamped = Math.max(0, Math.min(1, ratio));
                            setPreviewScroll(clamped);
                            node.scrollTo({
                              top: clamped * max,
                              behavior: "auto"
                            });
                          }
                        }
                        isDraggingScroll.current = true;
                        event.preventDefault();
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={onPickFile}
                disabled={uploadBusy || isGenerating}
              >
                {t("chat.upload.aria")}
              </Button>
              {uploadUsage || uploadFileLimit ? (
                <div>
                  {t("chat.upload.usage")
                    .replace("{used}", String(uploadUsage?.used ?? 0))
                    .replace("{limit}", String(uploadUsage?.limit ?? uploadFileLimit ?? 0))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
});
export default ChatAnalysisPanel;
