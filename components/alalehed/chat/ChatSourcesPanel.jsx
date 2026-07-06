"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
const ChatSourcesPanel = memo(function ChatSourcesPanel({
  open,
  t,
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
      <div onClick={e => e.stopPropagation()}>
        <div>
          <h2>
            {t("chat.sources.heading")}
          </h2>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label={t("buttons.close")}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div>
          {showScopeSwitch ? (
            <div role="tablist" aria-label={t("chat.sources.scope_label")}>
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
            <ol>
              {selectedSources.map((src, idx) => {
                const pageText = String(src.pageText || "").trim();
                const showPageText =
                  pageText &&
                  !/^0+(?:\s*[-,]\s*0+)*$/.test(pageText) &&
                  !`${src.label}`.toLowerCase().includes("lk");
                return (
                  <li key={src.key || idx}>
                    <div>{src.label}</div>
                    {src.occurrences > 1 ? (
                      <div>
                        {t("chat.sources.used_multiple").replace(
                          "{count}",
                          String(src.occurrences)
                        )}
                      </div>
                    ) : null}

                    {showPageText ? (
                      <div>
                        {t("chat.sources.pages").replace(
                          "{pages}",
                          pageText
                        )}
                      </div>
                    ) : null}
                    {src.allUrls && src.allUrls.length ? (
                      <div>
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
