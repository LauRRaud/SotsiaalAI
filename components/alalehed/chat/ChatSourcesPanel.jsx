"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Dropdown from "@/components/ui/Dropdown";
import Form from "@/components/ui/Form";
const ChatSourcesPanel = memo(function ChatSourcesPanel({
  open,
  t,
  locale = "et",
  conversationSources,
  latestAnswerSources,
  allConversationSources,
  onClose,
  returnFocusRef
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const prevFocusRef = useRef(null);
  const [activeScope, setActiveScope] = useState("latest");
  const [reportingKey, setReportingKey] = useState("");
  const [reportCategory, setReportCategory] = useState("outdated");
  const [reportNote, setReportNote] = useState("");
  const [reportState, setReportState] = useState({});
  const [ownFeedback, setOwnFeedback] = useState({});
  const latestSources = Array.isArray(latestAnswerSources)
    ? latestAnswerSources
    : Array.isArray(conversationSources)
      ? conversationSources
      : [];
  const historySources = Array.isArray(allConversationSources)
    ? allConversationSources
    : Array.isArray(conversationSources)
      ? conversationSources
      : [];
  const hasLatestSources = latestSources.length > 0;
  const hasHistorySources = historySources.length > 0;
  const showScopeSwitch = hasHistorySources && (
    !hasLatestSources ||
    latestSources.length !== historySources.length ||
    latestSources.some((source, index) => source?.key !== historySources[index]?.key)
  );
  const selectedScope = activeScope === "all" ? "all" : "latest";
  const selectedSources = selectedScope === "all" ? historySources : latestSources;
  const emptyText = selectedScope === "latest" && hasHistorySources
    ? t("chat.sources.latest_empty")
    : t("chat.sources.empty");
  const getFocusables = useCallback(root => {
    if (!root) return [];
    const nodes = root.querySelectorAll(["a[href]", "area[href]", "button:not([disabled])", "input:not([disabled]):not([type='hidden'])", "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])"].join(","));
    return Array.from(nodes).filter(el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }, []);
  useEffect(() => {
    if (!open) return;
    setActiveScope("latest");
    try {
      prevFocusRef.current = document.activeElement;
    } catch {}
    const root = dialogRef.current;
    const fallbackFocus = returnFocusRef?.current;
    const initial = closeRef.current || getFocusables(root)[0] || root;
    setTimeout(() => initial?.focus?.(), 0);
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key === "Tab") {
        const focusables = getFocusables(root);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !root.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const prev = prevFocusRef.current;
      setTimeout(() => {
        const target = prev && typeof prev.focus === "function" ? prev : fallbackFocus;
        if (target && typeof target.focus === "function") {
          try {
            target.focus();
          } catch {}
        }
      }, 0);
    };
  }, [open, getFocusables, onClose, returnFocusRef]);
  const scopeOptions = useMemo(() => [
    {
      key: "latest",
      label: t("chat.sources.latest_scope"),
      count: latestSources.length
    },
    {
      key: "all",
      label: t("chat.sources.all_scope"),
      count: historySources.length
    }
  ], [historySources.length, latestSources.length, t]);

  const formatCheckedAt = useCallback(value => {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const dateLocale = locale === "et" ? "et-EE" : locale === "ru" ? "ru-RU" : "en-GB";
    return new Intl.DateTimeFormat(dateLocale, {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  }, [locale]);

  const submitReport = useCallback(async source => {
    if (!source?.messageId || !source?.sourceId) return;
    const key = String(source.key || source.sourceId);
    setReportState(current => ({ ...current, [key]: "sending" }));
    try {
      const response = await fetch("/api/source-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: source.messageId,
          sourceId: source.sourceId,
          category: reportCategory,
          note: reportNote.trim()
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error("feedback_failed");
      setReportState(current => ({ ...current, [key]: "sent" }));
      setOwnFeedback(current => ({ ...current, [source.sourceId]: payload.item }));
      setReportingKey("");
      setReportNote("");
    } catch {
      setReportState(current => ({ ...current, [key]: "failed" }));
    }
  }, [reportCategory, reportNote]);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    fetch("/api/source-feedback", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        if (!payload?.ok || !Array.isArray(payload.items)) return;
        const bySource = {};
        for (const item of payload.items) {
          if (item?.sourceId && !bySource[item.sourceId]) bySource[item.sourceId] = item;
        }
        setOwnFeedback(bySource);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      id="chat-sources-panel"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("chat.sources.dialog_label")}
      onClick={onClose}
      tabIndex={-1}
    >
      <div className="chat-sources-dialog" onClick={e => e.stopPropagation()}>
        <div className="chat-sources-header">
          <h2>
            {t("chat.sources.heading")}
          </h2>
          <button
            type="button"
            className="chat-sources-close"
            ref={closeRef}
            onClick={onClose}
            aria-label={t("buttons.close")}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div className="chat-sources-content">
          {showScopeSwitch ? (
            <div className="chat-sources-scope" role="tablist" aria-label={t("chat.sources.scope_label")}>
              {scopeOptions.map(option => {
                const isActive = selectedScope === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive ? "true" : "false"}
                    onClick={() => setActiveScope(option.key)}
                  >
                    {option.label} ({option.count})
                  </button>
                );
              })}
            </div>
          ) : null}

          {selectedSources.length === 0 ? (
            <p>
              {emptyText}
            </p>
          ) : (
            <ol className="chat-sources-list">
              {selectedSources.map((src, idx) => {
                const pageText = String(src.pageText || "").trim();
                const checkedAtText = formatCheckedAt(src.checkedAt);
                const showPageText =
                  pageText &&
                  !/^0+(?:\s*[-,]\s*0+)*$/.test(pageText) &&
                  !`${src.label}`.toLowerCase().includes("lk");
                return (
                  <li key={src.key || idx} data-source-trust={src.freshness || "unknown"}>
                    <div className="chat-source-title">{src.label}</div>
                    {checkedAtText || src.warning ? (
                      <div className="chat-source-trust-row">
                        {checkedAtText ? (
                          <span>
                            {t("chat.sources.checked_at").replace("{date}", checkedAtText)}
                          </span>
                        ) : null}
                      {src.warning ? (
                        <span role="status" className="chat-source-warning">
                          {t(`chat.sources.warning_${src.warning}`)}
                        </span>
                      ) : null}
                      </div>
                    ) : null}
                    {src.occurrences > 1 ? (
                      <div className="chat-source-meta">
                        {t("chat.sources.used_multiple").replace(
                          "{count}",
                          String(src.occurrences)
                        )}
                      </div>
                    ) : null}

                    {showPageText ? (
                      <div className="chat-source-meta">
                        {t("chat.sources.pages").replace(
                          "{pages}",
                          pageText
                        )}
                      </div>
                    ) : null}
                    <div className="chat-source-actions">
                      {src.allUrls && src.allUrls.length ? (
                        <div className="chat-source-links">
                          {src.allUrls.map((url, urlIdx) => (
                            <a
                              key={`${src.key || idx}-url-${urlIdx}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {src.allUrls.length > 1
                                ? t("chat.sources.open_indexed").replace(
                                    "{index}",
                                    String(urlIdx + 1)
                                  )
                                : t("chat.sources.open_single")}
                            </a>
                          ))}
                        </div>
                      ) : null}
                      {src.messageId && src.sourceId ? (
                        <div className="chat-source-feedback">
                          {ownFeedback[src.sourceId] ? (
                            <span className="chat-source-feedback-status">
                              {ownFeedback[src.sourceId].status === "RESOLVED"
                                ? t("chat.sources.report_resolved")
                                : t("chat.sources.report_open")}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            aria-expanded={reportingKey === src.key}
                            onClick={() => {
                              setReportingKey(current => current === src.key ? "" : src.key);
                              setReportState(current => ({ ...current, [src.key]: "idle" }));
                            }}
                          >
                            {t("chat.sources.report_action")}
                          </button>
                        {reportingKey === src.key ? (
                          <Form onSubmit={event => {
                            event.preventDefault();
                            submitReport(src);
                          }}>
                            <label>
                              <span>{t("chat.sources.report_category")}</span>
                              <Dropdown
                                value={reportCategory}
                                onChange={setReportCategory}
                                ariaLabel={t("chat.sources.report_category")}
                                options={["outdated", "wrong_content", "broken_link", "wrong_source", "other"].map(category => ({
                                  value: category,
                                  label: t(`chat.sources.report_${category}`)
                                }))}
                              />
                            </label>
                            <label>
                              <span>{t("chat.sources.report_note")}</span>
                              <textarea
                                value={reportNote}
                                onChange={event => setReportNote(event.target.value)}
                                maxLength={500}
                                rows={3}
                              />
                            </label>
                            <button type="submit" disabled={reportState[src.key] === "sending"}>
                              {reportState[src.key] === "sending"
                                ? t("chat.sources.report_sending")
                                : t("chat.sources.report_send")}
                            </button>
                          </Form>
                        ) : null}
                        <span role="status" aria-live="polite">
                          {reportState[src.key] === "sent"
                            ? t("chat.sources.report_sent")
                            : reportState[src.key] === "failed"
                              ? t("chat.sources.report_failed")
                              : ""}
                        </span>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
});
export default ChatSourcesPanel;
