"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardInfoTrigger, dashboardInfoTriggerCornerClassName } from "@/components/ui/DashboardInfoOverlay";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import DocumentsPage from "@/components/documents/DocumentsPage";
import MaterialsPage from "@/components/materials/MaterialsPage";
import CovisionPage from "@/components/covision/CovisionPage";
import AgentModePage from "@/components/agent/AgentModePage";
import JourneyDashboard from "@/components/journey/JourneyDashboard";
import InviteModal from "@/components/invite/InviteModal";
import { localizePath } from "@/lib/localizePath";
import { createWorkspaceDashboardRows, WORKSPACE_ROUTE_PREFETCH_PATHS } from "@/lib/workspaceDashboardCards";
import AdminRoleViewCycleButton from "@/components/workspace/AdminRoleViewCycleButton";
import WorkspaceFeaturePage from "@/components/workspace/WorkspaceFeaturePage";

const EMBEDDED_WORKSPACE_FEATURES = Object.freeze({
  "/documents": "documents",
  "/dokreziim": "document_drafting",
  "/eelpoordumised": "pre_inquiries",
  "/kovisioon": "kovision",
  "/materjalid": "materials",
  "/teekond": "journey",
  "/teenuseprofiil": "service_profile",
  "__invite": "invite"
});
const EMBEDDED_WORKSPACE_FEATURE_VALUES = new Set(Object.values(EMBEDDED_WORKSPACE_FEATURES));
const WORKSPACE_SUBPAGE_ENTRY_STORAGE_KEY = "__SOTSIAALAI_WORKSPACE_SUBPAGE_ENTRY__";
const EMBEDDED_WORKSPACE_HEADER_META = Object.freeze({
  documents: {
    titleKey: "documents.page_title",
    fallback: "Dokumendid",
    infoId: "documents"
  },
  document_drafting: {
    titleKey: "chat.tools.agent_mode",
    fallback: "Dokumendi koostamine",
    infoId: "document_drafting"
  },
  pre_inquiries: {
    titleKey: "workspace_feature_pages.pre_inquiries.title",
    fallback: "Eelpoordumine",
    infoId: "intake"
  },
  kovision: {
    titleKey: "chat.workspace.cards.kovision.title",
    fallback: "Kovisioon",
    infoId: "kovision"
  },
  materials: {
    titleKey: "materials_page.title",
    fallback: "Materjalid",
    infoId: "materials"
  },
  journey: {
    titleKey: "journey.title",
    fallback: "Teekond",
    infoId: "journey"
  },
  service_profile: {
    titleKey: "workspace_feature_pages.service_profile.title",
    fallback: "Teenuseprofiil",
    infoId: "service_profile"
  },
  invite: {
    titleKey: "invite.eyebrow",
    fallback: "Grupivestlus",
    infoId: "invites"
  }
});
const DASHBOARD_VIEW_ROLES = Object.freeze([
  "CLIENT",
  "SOCIAL_WORKER",
  "SERVICE_PROVIDER"
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wheelDeltaToPixels(event, scrollEl) {
  const factor =
    event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scrollEl.clientHeight : 1;
  return {
    left: (event.deltaX || 0) * factor,
    top: (event.deltaY || 0) * factor
  };
}

function canScrollFurther(node, deltaTop, deltaLeft) {
  if (!(node instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(node);
  const scrollableY =
    /(auto|scroll|overlay)/.test(style.overflowY) &&
    node.scrollHeight > node.clientHeight + 1;
  const scrollableX =
    /(auto|scroll|overlay)/.test(style.overflowX) &&
    node.scrollWidth > node.clientWidth + 1;

  if (scrollableY && deltaTop > 0 && node.scrollTop < node.scrollHeight - node.clientHeight - 1) return true;
  if (scrollableY && deltaTop < 0 && node.scrollTop > 1) return true;
  if (scrollableX && deltaLeft > 0 && node.scrollLeft < node.scrollWidth - node.clientWidth - 1) return true;
  if (scrollableX && deltaLeft < 0 && node.scrollLeft > 1) return true;
  return false;
}

function shouldPreserveNestedWheel(target, panel, deltaTop, deltaLeft) {
  if (!(target instanceof Element)) return false;
  if (target.closest(".leaflet-container")) return true;

  let node = target;
  while (node && node !== panel) {
    if (canScrollFurther(node, deltaTop, deltaLeft)) return true;
    node = node.parentElement;
  }
  return false;
}
function DashboardCardIcon({ type }) {
  const serviceMapId = useId().replaceAll(":", "");
  const preInquiryPencilMaskId = `${serviceMapId}-pre-inquiry-pencil`;
  const serviceMapMarkerMaskId = `${serviceMapId}-service-map-marker`;

  if (type === "document") {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M6.85 3.35h6.35l5.55 5.55v9.35a2.18 2.18 0 0 1-2.18 2.18H6.85a2.18 2.18 0 0 1-2.18-2.18V5.53a2.18 2.18 0 0 1 2.18-2.18Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.2 3.35v3.82a1.78 1.78 0 0 0 1.78 1.78h3.77" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.05 12.1h7.4M8.05 14.7h7.4M8.05 17.3h5.55" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

if (type === "compose") {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M5.15 17.75 5.8 14l8.92-8.92a2.05 2.05 0 0 1 2.9 0l1.3 1.3a2.05 2.05 0 0 1 0 2.9L10 18.2l-3.75.65a.96.96 0 0 1-1.1-1.1Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.35 6.45 4.2 4.2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

if (type === "help-request") {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 21.2c-.9 0-1.85-.48-2.5-1.25C6.35 16.2 4.3 12.35 4.3 9.65a7.7 7.7 0 0 1 15.4 0c0 2.7-2.05 6.55-5.2 10.3-.65.77-1.6 1.25-2.5 1.25Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.45 8.45a1.95 1.95 0 1 1 2.85 1.72c-.9.47-1.3 1.03-1.3 1.92v.42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 15.25h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

if (type === "help-offer") {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 21.2c-.9 0-1.85-.48-2.5-1.25C6.35 16.2 4.3 12.35 4.3 9.65a7.7 7.7 0 0 1 15.4 0c0 2.7-2.05 6.55-5.2 10.3-.65.77-1.6 1.25-2.5 1.25Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 6.8v6M9 9.8h6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

if (type === "journey") {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="5.9" cy="18.1" r="2.2" stroke="currentColor" strokeWidth="3" />
      <circle cx="18.1" cy="5.3" r="2.2" stroke="currentColor" strokeWidth="3" />
      <path
        d="M8.9 18.1h6.3a3.2 3.2 0 0 0 0-6.4H8.8a3.2 3.2 0 0 1 0-6.4h6.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

if (type === "mailbox") {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect
        x="3.9"
        y="5.7"
        width="16.2"
        height="12.6"
        rx="2"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m6.2 8.4 5.8 4.3 5.8-4.3"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

if (type === "pre-inquiry") {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <mask id={preInquiryPencilMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#fff" />

          <path
            d="M10.85 17.45 11.55 14.35l6.18-6.18a1.31 1.31 0 0 1 1.86 0l.9.9a1.31 1.31 0 0 1 0 1.86l-6.18 6.18-3.1.7a.3.3 0 0 1-.36-.36Z"
            fill="#000"
            stroke="#000"
            strokeWidth="6.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d="m17.08 9.02 2.48 2.48"
            stroke="#000"
            strokeWidth="6.2"
            strokeLinecap="round"
          />
        </mask>
      </defs>

      <g mask={`url(#${preInquiryPencilMaskId})`}>
        <path
          d="M5.85 3.35h7.35l4.6 4.6v10.3a2.18 2.18 0 0 1-2.18 2.18H5.85a2.18 2.18 0 0 1-2.18-2.18V5.53a2.18 2.18 0 0 1 2.18-2.18Z"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M13.2 3.35v3.42a1.55 1.55 0 0 0 1.55 1.55h3.05"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle
          cx="8.6"
          cy="7.85"
          r="1.35"
          stroke="currentColor"
          strokeWidth="2.1"
        />

        <path
          d="M6.65 12.65c.42-1.18 1.06-1.78 1.95-1.78s1.53.6 1.95 1.78"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

<path
  d="M7.05 15.05h7.25M7.05 17.45h6.15"
  stroke="currentColor"
  strokeWidth="2.1"
  strokeLinecap="round"
/>
      </g>

      <path
        d="M10.85 17.45 11.55 14.35l6.18-6.18a1.31 1.31 0 0 1 1.86 0l.9.9a1.31 1.31 0 0 1 0 1.86l-6.18 6.18-3.1.7a.3.3 0 0 1-.36-.36Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="m17.08 9.02 2.48 2.48"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

if (type === "map") {
  return (
    <svg viewBox="0 0 34.12 32.89" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <mask id={serviceMapMarkerMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="34.12" height="32.89">
          <rect width="34.12" height="32.89" fill="#fff" />
          <path
            d="M19.8 19.68c-.66 0-1.34-.34-1.82-.91-2.32-2.75-3.84-5.6-3.84-7.58 0-3.13 2.54-5.66 5.66-5.66 3.12 0 5.66 2.53 5.66 5.66 0 1.98-1.52 4.83-3.84 7.58-.48.57-1.16.91-1.82.91Z"
            fill="#000"
            stroke="#000"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>

      <g mask={`url(#${serviceMapMarkerMaskId})`}>
        <path
          d="M25.07 29.15c-.51.01-1.09-.72-1.14-.79-1.3-1.66-2.07-2.01-3.39-2.74-.87-.56-1.65-.45-2.73-.1-1.22.52-2.07 1.02-1.57-.74.13-.5.29-1.31-.02-1.68-.32-.46-1.39.29-2.16-.26-.6-.41-1.12-1.14-1.24-1.87-.12-.33.16-1.01.22-1.42-.01-.39-.47-.66-.39-1.11.15-.61-.13-1.37.15-2.05.51-.82 1.7-.88 2.38-1.46.28-.19.57-.4.89-.53 1.22-.39 2.07-.61 3.32-.62.67-.02 1.19-.36 1.68-.63 2.69-.43 5.69 1.47 8.46 1.2.63 0 1.72-.07 1.1.88-.43.68-.84 1.72-1.58 2.15-1.52.58-2.69.73-1.91 2.72.74 1.84 1.38 3.99 2.24 5.75.49.98-.34 1.57-.75 2.39-.46.78-1.56.07-2.21.45-.46.27-.95.35-1.26.43l-.09.02Z"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <path
        d="M19.8 19.68c-.66 0-1.34-.34-1.82-.91-2.32-2.75-3.84-5.6-3.84-7.58 0-3.13 2.54-5.66 5.66-5.66 3.12 0 5.66 2.53 5.66 5.66 0 1.98-1.52 4.83-3.84 7.58-.48.57-1.16.91-1.82.91Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19.85 12.25v2.75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M19.8 9.15h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

      <path
        d="M5.34 23.68c-.81.85-.03 2.26.79.86.28-.52.41-1.22.84-1.49.42-.29 1.03-.07 1.45-.22.8-.26 1.36-1.1 2.13-1.45.16-.11.43-.24.29-.48-.47-.71-1.35-1.18-2.24-1.13-.47-.08-.87-.16-1.38.07-.44.14-.91.46-1.3.63-.32.13-.79-.08-.97.06-.23.25.39.96 0 1.25-.27.32-.22.64.15.98.3.26.85.61.29.87l-.06.05Z"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.52 18.64c-.64-.19-.17-1.53-.97-1.54-.74-.01-1.5-.88-.19-.76.53.05.95-.27 1.22-.67.12-.18.24-.41.44-.39.27 0 .39.43.54.61.14.17.39.2.57.31.32.21.71.8.56 1.14-.04.09-.25.3-.43.41-.18.11-.27.19-.46.21-.19.02-.38.11-.54.29-.18.19-.4.35-.64.41h-.09Z"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

if (type === "service-profile") {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M5.85 4.45h12.3a1.75 1.75 0 0 1 1.75 1.75v11.6a1.75 1.75 0 0 1-1.75 1.75H5.85A1.75 1.75 0 0 1 4.1 17.8V6.2a1.75 1.75 0 0 1 1.75-1.75Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="8.45" cy="8.85" r="1.35" stroke="currentColor" strokeWidth="2.1" />

      <path
        d="M6.45 13.85c.42-1.12 1.08-1.75 2-1.75s1.58.63 2 1.75"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M12.7 8.65h4.45M12.7 11.75h4.45M12.7 14.85h3.25"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

if (type === "room") {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M6.8 14h4.8c1.9 0 3.35.9 3.9 2.35.45 1.15.35 2.25.18 3.05-.45 1.8-2.6 2.35-6.48 2.35s-6.03-.55-6.48-2.35c-.17-.8-.27-1.9.18-3.05C3.45 14.9 4.9 14 6.8 14Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.2" cy="6.7" r="3.65" stroke="currentColor" strokeWidth="3" />
      <path d="M21.1 18.9v-1.7c0-1.55-1.35-2.9-3.3-3.3M15.3 3.9a3.2 3.2 0 0 1-.08 6.4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

if (type === "materials") {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M6.85 3.35h6.35l5.55 5.55v9.35a2.18 2.18 0 0 1-2.18 2.18H6.85a2.18 2.18 0 0 1-2.18-2.18V5.53a2.18 2.18 0 0 1 2.18-2.18Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.2 3.35v3.82a1.78 1.78 0 0 0 1.78 1.78h3.77" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 15.08v-4.75" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="m9.25 13.08 2.75-2.75 2.75 2.75" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.85 15.28v2.12h8.3v-2.12" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

if (type === "wellbeing") {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 1.85c2.72 1.72 5.45 2.38 8.05 1.95v6.25c0 5.08-2.96 8.82-8.05 11.35-5.09-2.53-8.05-6.27-8.05-11.35V3.8c2.6.43 5.33-.23 8.05-1.95Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(5.65 4.55) scale(0.53)">
        <path d="M9.3 15H14.7C16.8 15 18.4 16 19 17.6C19.5 18.9 19.4 20.1 19.2 21C18.7 23 16.3 23.6 12 23.6C7.7 23.6 5.3 23 4.8 21C4.6 20.1 4.5 18.9 5 17.6C5.6 16 7.2 15 9.3 15Z" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

return (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M8.3 14.15h7.4c2.25 0 4.05 1.8 4.05 4.05v.35c0 1.2-.97 2.17-2.17 2.17H6.42c-1.2 0-2.17-.97-2.17-2.17v-.35c0-2.25 1.8-4.05 4.05-4.05Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="7.55" r="4.15" stroke="currentColor" strokeWidth="3" />
    <path d="M16.95 9.1h3.9M18.9 7.15v3.9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
}

function text(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function normalizeDashboardRole(role, fallback = "SOCIAL_WORKER") {
  const normalized = String(role || "").trim().toUpperCase();
  return DASHBOARD_VIEW_ROLES.includes(normalized) ? normalized : fallback;
}

function formatDashboardCardAriaLabel(card) {
  const title = String(card?.title || "").trim();
  const badgeLabel = String(card?.badge?.label || "").trim();
  if (!title) return badgeLabel || undefined;
  return badgeLabel ? `${title}: ${badgeLabel}` : title;
}

function markWorkspaceSubpageEntry(path) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      WORKSPACE_SUBPAGE_ENTRY_STORAGE_KEY,
      JSON.stringify({
        ts: Date.now(),
        path,
        source: "workspace"
      })
    );
    const url = new URL(window.location.href);
    if (url.pathname.endsWith("/vestlus")) {
      url.searchParams.set("workspace", "1");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {}
}

function dispatchWorkspaceEvent(eventName, detail = {}) {
  if (typeof window === "undefined") return false;
  try {
    const CustomEventCtor = window.CustomEvent;
    if (typeof CustomEventCtor === "function") {
      return window.dispatchEvent(new CustomEventCtor(eventName, { detail }));
    }
    if (typeof document !== "undefined" && typeof document.createEvent === "function") {
      const event = document.createEvent("CustomEvent");
      event.initCustomEvent(eventName, false, false, detail);
      return window.dispatchEvent(event);
    }
    const event = new Event(eventName);
    Object.defineProperty(event, "detail", { value: detail });
    return window.dispatchEvent(event);
  } catch {
    return false;
  }
}

export default function WorkspacePanel({
  t,
  locale = "et",
  userRole = "",
  userActualRole = "",
  isAdmin = false,
  subActive = false,
  onClose,
  onOpenHelpListings,
  embeddedPanelNode = null,
  embeddedPanelMeta = null,
  onEmbeddedPanelBack = null,
  dashboardBadges = null,
  visible = true
}) {
  const router = useRouter();
  const panelRef = useRef(null);
  const cardActivationGuardRef = useRef({ key: "", ts: 0 });
  const defaultDashboardRole = useMemo(() => {
    const actualRole = String(userActualRole || "").trim().toUpperCase();
    const currentRole = String(userRole || "").trim().toUpperCase();
    if (DASHBOARD_VIEW_ROLES.includes(actualRole)) return actualRole;
    if (DASHBOARD_VIEW_ROLES.includes(currentRole)) return currentRole;
    return "SOCIAL_WORKER";
  }, [userActualRole, userRole]);
  const [dashboardRole, setDashboardRole] = useState(defaultDashboardRole);
  const [activeEmbeddedFeature, setActiveEmbeddedFeature] = useState("");
  const syncEmbeddedFeatureFromUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const feature = new URL(window.location.href).searchParams.get("workspace") || "";
      setActiveEmbeddedFeature(EMBEDDED_WORKSPACE_FEATURE_VALUES.has(feature) ? feature : "");
    } catch {
      setActiveEmbeddedFeature("");
    }
  }, []);

  const navigateTo = useCallback(
    path => {
      const embeddedFeature = EMBEDDED_WORKSPACE_FEATURES[path];
      if (embeddedFeature) {
        setActiveEmbeddedFeature(embeddedFeature);
        if (typeof window !== "undefined") {
          try {
            const url = new URL(window.location.href);
            url.searchParams.set("workspace", embeddedFeature);
            window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
          } catch {}
        }
        return;
      }
      const href = localizePath(path, locale);
      try {
        router.prefetch?.(href);
      } catch {}
      markWorkspaceSubpageEntry(path);
      router.push(href);
    },
    [locale, router]
  );

  const handleWorkspaceBack = useCallback(() => {
    if (activeEmbeddedFeature) {
      setActiveEmbeddedFeature("");
      if (typeof window !== "undefined") {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("workspace");
          window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
        } catch {}
      }
      return;
    }
    onClose?.();
  }, [activeEmbeddedFeature, onClose]);

  useEffect(() => {
    syncEmbeddedFeatureFromUrl();
    if (typeof window === "undefined") return undefined;
    window.addEventListener("popstate", syncEmbeddedFeatureFromUrl);
    return () => window.removeEventListener("popstate", syncEmbeddedFeatureFromUrl);
  }, [syncEmbeddedFeatureFromUrl]);

  const openHelpPanel = useCallback(
    panelKey => {
      if (typeof onOpenHelpListings === "function") {
        onOpenHelpListings(panelKey, "workspace");
        return;
      }
      dispatchWorkspaceEvent("sotsiaalai:open-help-listings", { panelKey, source: "workspace" });
    },
    [onOpenHelpListings]
  );

  const handleEmbeddedPanelWheelCapture = useCallback(event => {
    const panel = panelRef.current;
    if (!panel || !(embeddedPanelNode || activeEmbeddedFeature)) return;
    if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;

    const maxTop = Math.max(0, panel.scrollHeight - panel.clientHeight);
    const maxLeft = Math.max(0, panel.scrollWidth - panel.clientWidth);
    if (maxTop <= 1 && maxLeft <= 1) return;

    const { top, left } = wheelDeltaToPixels(event, panel);
    if (!top && !left) return;
    if (shouldPreserveNestedWheel(event.target, panel, top, left)) return;

    event.preventDefault();
    if (top) panel.scrollTop = clamp(panel.scrollTop + top, 0, maxTop);
    if (left) panel.scrollLeft = clamp(panel.scrollLeft + left, 0, maxLeft);
  }, [activeEmbeddedFeature, embeddedPanelNode]);

  const openInvite = useCallback(() => {
    setActiveEmbeddedFeature("invite");
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("workspace", "invite");
        window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      } catch {}
    }
  }, []);

  const activateDashboardCard = useCallback(cardKey => {
    const routeByCardKey = {
      documents: "/documents",
      document_drafting: "/dokreziim",
      journey: "/teekond",
      kovision: "/kovisioon",
      materials: "/materjalid",
      pre_inquiries: "/eelpoordumised",
      service_map: "/teenusekaart",
      service_profile: "/teenuseprofiil",
      wellbeing: "/tooheaolu"
    };

    if (cardKey === "help_requests" || cardKey === "help_offers") {
      openHelpPanel(cardKey);
      return;
    }
    if (cardKey === "add_person") {
      openInvite();
      return;
    }

    const route = routeByCardKey[cardKey];
    if (route) navigateTo(route);
  }, [navigateTo, openHelpPanel, openInvite]);

  const handleCardDirectClick = useCallback(event => {
    const card = event.currentTarget;
    const cardKey = card?.dataset?.workspaceCardKey || "";
    if (!cardKey || card?.disabled || card?.getAttribute?.("aria-disabled") === "true") return;

    event.preventDefault();
    event.stopPropagation();

    const guard = cardActivationGuardRef.current;
    if (guard.key === cardKey && Date.now() - guard.ts < 350) return;
    cardActivationGuardRef.current = { key: cardKey, ts: Date.now() };
    activateDashboardCard(cardKey);
  }, [activateDashboardCard]);

  const handleCardDirectPointerUp = useCallback(event => {
    if (event.button != null && event.button !== 0) return;
    const card = event.currentTarget;
    const cardKey = card?.dataset?.workspaceCardKey || "";
    if (!cardKey || card?.disabled || card?.getAttribute?.("aria-disabled") === "true") return;

    event.preventDefault();
    event.stopPropagation();

    cardActivationGuardRef.current = { key: cardKey, ts: Date.now() };
    activateDashboardCard(cardKey);
  }, [activateDashboardCard]);

  useEffect(() => {
    setDashboardRole(defaultDashboardRole);
  }, [defaultDashboardRole]);

  useEffect(() => {
    if (!visible || typeof router.prefetch !== "function") return;
    for (const path of WORKSPACE_ROUTE_PREFETCH_PATHS) {
      try {
        router.prefetch(localizePath(path, locale));
      } catch {}
    }
  }, [locale, router, visible]);

  const handleDashboardRoleChanged = useCallback((user = {}) => {
    setDashboardRole(normalizeDashboardRole(user?.effectiveRole || user?.adminViewRole));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onKeyDown = event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handleWorkspaceBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleWorkspaceBack]);

  const activeRole = isAdmin
    ? dashboardRole
    : normalizeDashboardRole(userActualRole || userRole || "", "CLIENT");
  const hasPaidAccess = Boolean(isAdmin || subActive);

  const cardRows = useMemo(() => createWorkspaceDashboardRows({
    activeRole,
    hasPaidAccess,
    t,
    navigateTo,
    openHelpPanel,
    openInvite,
    dashboardBadges
  }), [activeRole, dashboardBadges, hasPaidAccess, navigateTo, openHelpPanel, openInvite, t]);
  const activeEmbeddedMeta = useMemo(() => {
    if (!activeEmbeddedFeature) return null;
    const meta = EMBEDDED_WORKSPACE_HEADER_META[activeEmbeddedFeature] || null;
    if (!meta) return null;
    return {
      ...meta,
      title: text(t, meta.titleKey, meta.fallback)
    };
  }, [activeEmbeddedFeature, t]);
  const activeTitleId = embeddedPanelNode
    ? "chat-workspace-embedded-panel-title"
    : activeEmbeddedFeature
    ? `chat-workspace-${activeEmbeddedFeature}-title`
    : "chat-workspace-title";
  const embeddedPanelTitle = embeddedPanelMeta?.title || "";
  const embeddedPanelInfoId = embeddedPanelMeta?.infoId || "workspace";

  /* S/P/T vaatelülitid elavad pealkirjareal (mitte body-portalis —
     stiilimata portal jättis lehele nähtamatuid artefakte) */
  const showRoleMenu = isAdmin && activeEmbeddedFeature !== "journey";
  const roleMenu = showRoleMenu ? (
    <AdminRoleViewCycleButton
      t={t}
      locale={locale}
      value={dashboardRole}
      onRoleChanged={handleDashboardRoleChanged}
      ariaLabel={text(t, "chat.workspace.view_role.label", "Töölaua vaade")}
    />
  ) : null;

  return (
    <>
      <section
        ref={panelRef}
        className="workspace-dashboard-panel"
        data-visible={visible ? "true" : "false"}
        data-embedded-active={embeddedPanelNode || activeEmbeddedFeature ? "true" : "false"}
        role="region"
        aria-labelledby={activeTitleId}
        onWheelCapture={handleEmbeddedPanelWheelCapture}
      >
      {embeddedPanelNode ? (
        <>
          <SubpageHeader
            onBack={onEmbeddedPanelBack || handleWorkspaceBack}
            backAriaLabel={text(t, "workspace_feature_pages.back_to_workspace", "Tagasi toolauale")}
            anchorBack={false}
            holdPressedVisualDisabled
            titleId={activeTitleId}
            rightSlot={
              <DashboardInfoTrigger
                infoId={embeddedPanelInfoId}
                title={embeddedPanelTitle || text(t, "chat.workspace.title", "Toolaud")}
                className={dashboardInfoTriggerCornerClassName}
              />
            }
          >
            {embeddedPanelTitle || text(t, "chat.workspace.title", "Toolaud")}
          </SubpageHeader>
          <div>
            {embeddedPanelNode}
          </div>
        </>
      ) : activeEmbeddedFeature ? (
        <>
          <SubpageHeader
            onBack={handleWorkspaceBack}
            backAriaLabel={text(t, "workspace_feature_pages.back_to_workspace", "Tagasi toolauale")}
            anchorBack={false}
            holdPressedVisualDisabled
            titleId={activeTitleId}
            rightSlot={
              <DashboardInfoTrigger
                infoId={activeEmbeddedMeta?.infoId || "workspace"}
                title={activeEmbeddedMeta?.title || text(t, "chat.workspace.title", "Toolaud")}
                className={dashboardInfoTriggerCornerClassName}
              />
            }
          >
            {activeEmbeddedMeta?.title || text(t, "chat.workspace.title", "Toolaud")}
          </SubpageHeader>
          <div>
            {activeEmbeddedFeature === "documents" ? (
              <DocumentsPage
                embedded
                hideHeader
                onBack={handleWorkspaceBack}
              />
            ) : activeEmbeddedFeature === "document_drafting" ? (
              <AgentModePage
                embedded
                hideHeader
                onBack={handleWorkspaceBack}
              />
            ) : activeEmbeddedFeature === "kovision" ? (
              <CovisionPage
                embedded
                hideHeader
                onBack={handleWorkspaceBack}
              />
            ) : activeEmbeddedFeature === "materials" ? (
              <MaterialsPage
                locale={locale}
                embedded
                hideHeader
                onBack={handleWorkspaceBack}
              />
            ) : activeEmbeddedFeature === "journey" ? (
              <JourneyDashboard
                embedded
                hideHeader
                onBack={handleWorkspaceBack}
                roleOverride={isAdmin ? "CLIENT" : ""}
              />
            ) : activeEmbeddedFeature === "invite" ? (
              <InviteModal
                embedded
                hideHeader
                onBack={handleWorkspaceBack}
              />
            ) : (
              <WorkspaceFeaturePage
                feature={activeEmbeddedFeature}
                embedded
                hideHeader
                onBack={handleWorkspaceBack}
              />
            )}
          </div>
        </>
      ) : (
        <>
      {/* Juurvaade: pealkirja EI kuvata (kastidele rohkem ruumi, tellija
          06.07 öö) — sr-only h1 jääb ariale; ⓘ elab akna nurgas
          (PanelFrame); admini S/P/T lülitid paneeli ülanurgas paremal */}
      <h1 id="chat-workspace-title" className="sr-only">
        {text(t, "chat.workspace.title", "Töölaud")}
      </h1>
      {roleMenu}

      <div>
        {cardRows.map((row, index) => (
          <div key={`row-${index + 1}`}>
            {row.map(card => (
              <button
                key={card.key}
                type="button"
                className="workspace-dashboard-card"
                data-workspace-card-key={card.key}
                onClick={card.disabled ? undefined : handleCardDirectClick}
                onPointerUp={card.disabled ? undefined : handleCardDirectPointerUp}
                disabled={card.disabled}
                aria-label={formatDashboardCardAriaLabel(card)}
                aria-disabled={card.disabled ? "true" : "false"}
              >
                <span data-workspace-card-icon={card.icon} aria-hidden="true">
                  <DashboardCardIcon type={card.icon} />
                </span>
                <span>
                  <span>{card.title}</span>
                </span>
                {card.badge ? (
                  <span data-badge-type={card.badge.type} aria-hidden="true">
                    <span>{card.badge.value}</span>
                    {card.badge.tooltip ? <span>{card.badge.tooltip}</span> : null}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </div>
        </>
      )}
      </section>
    </>
  );
}
