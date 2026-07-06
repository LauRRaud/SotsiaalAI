"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/i18n/I18nProvider";
import IconButton from "@/components/glass/IconButton";
import CloseIcon from "@/components/brand/icons/CloseIcon";
import { getDashboardInfoContent } from "@/lib/dashboardInfoContent";

function InfoIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="12" cy="12" r="7.6" />
      <path d="M12 11.2v4.6" />
      <circle cx="12" cy="8.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const dashboardInfoTriggerCornerClassName = "";

function getFocusable(root) {
  if (!root) return [];
  const nodes = root.querySelectorAll([
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "iframe",
    "object",
    "embed",
    "[contenteditable]",
    "[tabindex]:not([tabindex='-1'])"
  ].join(","));
  return Array.from(nodes).filter((el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
}

function renderDetail(section, extra) {
  return (
    <section key={section.title} className="dashboard-info-detail">
      <h3>{section.title}</h3>
      {section.body ? <p>{section.body}</p> : null}
      {section.items?.length ? (
        <ul>
          {section.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {extra ? <div>{extra}</div> : null}
    </section>
  );
}

function DashboardInfoOverlay({ open, onClose, infoId, label = "Ava info", title, detailExtras }) {
  const [portalRoot, setPortalRoot] = useState(null);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const openerRef = useRef(null);
  const titleId = useId();
  const { t } = useI18n();
  const content = useMemo(() => getDashboardInfoContent(t, infoId), [infoId, t]);
  const displayTitle = title || content?.title;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    let root = document.querySelector('[data-dashboard-info-root="true"]');
    let created = false;
    if (!root) {
      root = document.createElement("div");
      root.setAttribute("data-dashboard-info-root", "true");
      document.body.appendChild(root);
      created = true;
    }
    setPortalRoot(root);
    return () => {
      if (created && root?.parentNode) root.parentNode.removeChild(root);
      setPortalRoot(null);
    };
  }, []);

  useEffect(() => {
    if (!open || typeof document === "undefined" || !portalRoot) return undefined;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = Array.from(document.body.children).filter((el) => el !== portalRoot);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const initialFocusTarget = closeRef.current || panelRef.current;
    try {
      initialFocusTarget?.focus?.({ preventScroll: true });
    } catch {
      initialFocusTarget?.focus?.();
    }

    for (const el of siblings) {
      try {
        el.setAttribute("aria-hidden", "true");
        if ("inert" in el) {
          el.inert = true;
        }
      } catch {}
    }

    const focusTimer = window.setTimeout(() => {
      const target = closeRef.current || panelRef.current;
      try {
        target?.focus?.({ preventScroll: true });
      } catch {
        target?.focus?.();
      }
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      for (const el of siblings) {
        try {
          el.removeAttribute("aria-hidden");
          if ("inert" in el) {
            el.inert = false;
          }
        } catch {}
      }
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) {
        try {
          opener.focus({ preventScroll: true });
        } catch {
          opener.focus();
        }
      }
    };
  }, [open, portalRoot]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable(panelRef.current);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !panelRef.current?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (active === last || !panelRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, open]);

  if (!open || !portalRoot || !content) return null;

  return createPortal(
    <div
      className="glass-modal-layer"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={panelRef}
        className="glass-modal-shell dashboard-info-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={label}
        tabIndex={-1}
      >
        {/* Pealkirja EI kuvata (tellija reegel: info-akendel pole pealkirja);
            jääb ekraanilugejale. × elab oma ribal, et tekst ei keriks
            sellest läbi — sisu lõikub riba alt ja kaardi alaservast. */}
        <h2 className="sr-only" id={titleId}>
          {displayTitle}
        </h2>
        <div className="dashboard-info-top">
          <IconButton
            ref={closeRef}
            layoutClassName="dashboard-info-close"
            aria-label={typeof t === "function" ? t("buttons.close", "Sulge") : "Sulge"}
            onClick={onClose}
          >
            <CloseIcon />
          </IconButton>
        </div>
        <div className="glass-modal-body dashboard-info-body">
          {content.intro ? <p className="dashboard-info-intro">{content.intro}</p> : null}
          {content.details.map((section, index) => renderDetail(section, detailExtras?.[index]))}
        </div>
      </section>
    </div>,
    portalRoot
  );
}

export function DashboardInfoTrigger({
  infoId,
  label = "Ava info",
  className,
  dialogLabel,
  title,
  style,
  detailExtras
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open ? "true" : "false"}
        onClick={() => {
          setOpen(true);
        }}
        layoutClassName={["dashboard-info-trigger", className].filter(Boolean).join(" ")}
        style={style}
      >
        <InfoIcon />
      </IconButton>
      <DashboardInfoOverlay
        open={open}
        onClose={() => setOpen(false)}
        infoId={infoId}
        label={dialogLabel || label}
        title={title}
        detailExtras={detailExtras}
      />
    </>
  );
}
