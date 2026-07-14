"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import WorkspaceContinuity from "@/components/workspace/WorkspaceContinuity";

const EMBEDDED_WORKSPACE_FEATURES = Object.freeze({
  "/documents": "documents",
  "/dokreziim": "document_drafting",
  "/eelpoordumised": "pre_inquiries",
  /* /kovisioon EI ole enam paneeli-sisene feature (tellija 10.07:
     kovisioon kasutab tervet ekraani) — navigateTo teeb täislehe push'i. */
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
    fallback: "Kutsu osaleja",
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
  const preferenceRequestRef = useRef(0);
  const defaultDashboardRole = useMemo(() => {
    const actualRole = String(userActualRole || "").trim().toUpperCase();
    const currentRole = String(userRole || "").trim().toUpperCase();
    if (DASHBOARD_VIEW_ROLES.includes(actualRole)) return actualRole;
    if (DASHBOARD_VIEW_ROLES.includes(currentRole)) return currentRole;
    return "SOCIAL_WORKER";
  }, [userActualRole, userRole]);
  const [dashboardRole, setDashboardRole] = useState(defaultDashboardRole);
  const [activeEmbeddedFeature, setActiveEmbeddedFeature] = useState("");
  const [continuity, setContinuity] = useState({
    status: "idle",
    items: [],
    badges: {}
  });
  const [notificationPreference, setNotificationPreference] = useState(null);
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
    if (!visible || activeEmbeddedFeature) return undefined;
    const controller = new AbortController();
    setContinuity((current) => ({ ...current, status: "loading" }));
    Promise.all([
      fetch("/api/workspace/continuity", {
        cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" }
      }),
      fetch("/api/notifications/preferences", {
        cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" }
      })
    ])
      .then(async ([continuityResponse, preferenceResponse]) => {
        const [payload, preferencePayload] = await Promise.all([
          continuityResponse.json().catch(() => ({})),
          preferenceResponse.json().catch(() => ({}))
        ]);
        if (!continuityResponse.ok || payload?.ok !== true) throw new Error("continuity_failed");
        setContinuity({
          status: "ready",
          items: Array.isArray(payload.items) ? payload.items.slice(0, 7) : [],
          badges: payload.badges && typeof payload.badges === "object" ? payload.badges : {}
        });
        if (preferenceResponse.ok && preferencePayload?.ok === true) {
          setNotificationPreference({ status: "ready", ...preferencePayload.preference });
        }
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setContinuity({ status: "error", items: [], badges: {} });
      });
    return () => controller.abort();
  }, [activeEmbeddedFeature, visible]);

  const updateEmailPreference = useCallback(async (emailEnabled) => {
    if (!notificationPreference || notificationPreference.status === "saving") return;
    const requestId = ++preferenceRequestRef.current;
    const expectedVersion = notificationPreference.version;
    setNotificationPreference((current) => ({ ...current, emailEnabled, status: "saving" }));
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ emailEnabled, expectedVersion })
      });
      const payload = await response.json().catch(() => ({}));
      if (requestId !== preferenceRequestRef.current) return;
      if (!response.ok || payload?.ok !== true) throw new Error("preference_failed");
      setNotificationPreference({ status: "ready", ...payload.preference });
    } catch {
      if (requestId !== preferenceRequestRef.current) return;
      setNotificationPreference((current) => ({
        ...current, emailEnabled: !emailEnabled, status: "error", version: expectedVersion
      }));
    }
  }, [notificationPreference]);

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

  const resolvedDashboardBadges = useMemo(() => {
    const fetched = continuity.badges || {};
    if (typeof dashboardBadges === "function") {
      return (input) => fetched[input.cardKey] || dashboardBadges(input);
    }
    return { ...(dashboardBadges || {}), ...fetched };
  }, [continuity.badges, dashboardBadges]);
  const cardRows = useMemo(() => createWorkspaceDashboardRows({
    activeRole,
    hasPaidAccess,
    t,
    navigateTo,
    openHelpPanel,
    openInvite,
    dashboardBadges: resolvedDashboardBadges
  }), [activeRole, hasPaidAccess, navigateTo, openHelpPanel, openInvite, resolvedDashboardBadges, t]);
  const openContinuityItem = useCallback((href) => {
    const normalized = String(href || "").trim();
    if (!normalized.startsWith("/")) return;
    router.push(localizePath(normalized, locale));
  }, [locale, router]);
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
              activeEmbeddedFeature === "kovision" ? null : (
                <DashboardInfoTrigger
                  infoId={activeEmbeddedMeta?.infoId || "workspace"}
                  title={activeEmbeddedMeta?.title || text(t, "chat.workspace.title", "Toolaud")}
                  className={dashboardInfoTriggerCornerClassName}
                />
              )
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

      <WorkspaceContinuity
        t={t}
        locale={locale}
        status={continuity.status}
        items={continuity.items}
        onOpen={openContinuityItem}
        preference={notificationPreference}
        onPreferenceChange={updateEmailPreference}
      />

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
