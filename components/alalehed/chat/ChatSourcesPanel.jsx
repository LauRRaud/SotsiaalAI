"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import CloseIcon from "@/components/brand/icons/CloseIcon";
import IconButton from "@/components/glass/IconButton";
import { pilotSourceRef } from "@/lib/chat/pilotSourceRef";
import { inertOutside } from "@/lib/inertOutside";
import { SOURCE_FEEDBACK_CATEGORIES, SOURCE_FEEDBACK_NOTE_MAX } from "@/lib/sourceFeedbackReasons";

import FeedbackForm from "./FeedbackForm";
import reportStyles from "./ChatSourceReport.module.css";

const SOURCES_DIALOG_TITLE_ID = "chat-sources-title";
const ChatSourcesPanel = memo(function ChatSourcesPanel({
  open,
  t,
  locale = "et",
  conversationSources,
  latestAnswerSources,
  allConversationSources,
  convId = null,
  onClose,
  returnFocusRef
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const prevFocusRef = useRef(null);
  const [activeScope, setActiveScope] = useState("latest");
  // Allika veateade („Teata veast"): milline allikas on avatud ja milliste kohta on teade juba saadetud
  // (võti „<pööre>/<viide>", väärtus teate olek).
  const [reportingKey, setReportingKey] = useState("");
  const [ownReports, setOwnReports] = useState({});
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
    const releaseInert = inertOutside(root);
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
      releaseInert();
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

  // Vastab FeedbackForm-ile { ok, messageKey }: serveri keeldumise lause on kataloogis võtmega api.source_feedback.*.
  const submitReport = useCallback(async (target, { category, note }) => {
    try {
      const response = await fetch("/api/source-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convId, turnId: target.turnId, ref: target.ref, category, note })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        return { ok: false, messageKey: typeof payload?.message === "string" ? payload.message : null };
      }
      setOwnReports(current => ({ ...current, [`${target.turnId}/${target.ref}`]: payload.item?.status || "OPEN" }));
      return { ok: true };
    } catch {
      return { ok: false, messageKey: null };
    }
  }, [convId]);

  useEffect(() => {
    if (!open) return undefined;
    setReportingKey("");
    const controller = new AbortController();
    fetch("/api/source-feedback", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        if (!payload?.ok || !Array.isArray(payload.items)) return;
        const byAnswerSource = {};
        for (const item of payload.items) {
          const key = `${item?.turnId}/${item?.sourceRef}`;
          if (item?.turnId && item?.sourceRef && !byAnswerSource[key]) byAnswerSource[key] = item.status;
        }
        setOwnReports(current => ({ ...current, ...byAnswerSource }));
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
      aria-labelledby={SOURCES_DIALOG_TITLE_ID}
      onClick={onClose}
      tabIndex={-1}
    >
      <div className="chat-sources-dialog" onClick={e => e.stopPropagation()}>
        <div className="chat-sources-header">
          <h2 id={SOURCES_DIALOG_TITLE_ID}>
            {t("chat.sources.heading")}
          </h2>
          <IconButton
            layoutClassName="chat-sources-close"
            ref={closeRef}
            onClick={onClose}
            aria-label={t("buttons.close")}
          >
            <CloseIcon />
          </IconButton>
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
                // Veast saab teatada vastuse allika kohta, mille pööre ja viide on teada.
                const reportTarget = convId ? pilotSourceRef(src) : null;
                const reportStatus = reportTarget ? ownReports[`${reportTarget.turnId}/${reportTarget.ref}`] : null;
                const reporting = !!reportTarget && !reportStatus && reportingKey === src.key;
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
                              target={src.sourceType === 'm4_pilot' || src.source_type === 'm4_pilot' ? '_self' : '_blank'}
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
                      {reportTarget ? (
                        reportStatus ? (
                          <span className={reportStyles.status} role="status">
                            {reportStatus === "RESOLVED" ? t("chat.sources.report_resolved") : t("chat.sources.report_sent")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={reportStyles.trigger}
                            aria-expanded={reporting}
                            onClick={() => setReportingKey(current => current === src.key ? "" : src.key)}
                          >
                            {t("chat.sources.report_action")}
                          </button>
                        )
                      ) : null}
                      {reporting ? (
                        <div className={reportStyles.report}>
                          <FeedbackForm
                            t={t}
                            title={t("chat.sources.report_category")}
                            columns={3}
                            noteRows={2}
                            noteMax={SOURCE_FEEDBACK_NOTE_MAX}
                            reasons={SOURCE_FEEDBACK_CATEGORIES.map(category => ({ value: category, label: t(`chat.sources.report_${category}`) }))}
                            texts={{
                              noteLabel: t("chat.sources.report_note_label"),
                              notePlaceholder: t("chat.sources.report_note"),
                              send: t("chat.sources.report_send"),
                              sending: t("chat.sources.report_sending"),
                              cancel: t("chat.sources.report_cancel"),
                              chooseReason: t("chat.sources.report_choose"),
                              failed: t("chat.sources.report_failed")
                            }}
                            errorPrefix="api.source_feedback."
                            onSubmit={data => submitReport(reportTarget, data)}
                            onDone={() => setReportingKey("")}
                            onCancel={() => setReportingKey("")}
                          />
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
