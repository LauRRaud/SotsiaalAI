"use client";

/**
 * PanelFrame — avatud paneeli klaasraam (brief §7).
 *
 * Avalehel renderdab lapsed puutumata; igal muul marsruudil mähib
 * sisu mattklaasist paneeli, mille taga hämardub ruum (kaader 7).
 * Sulgemisrist ja Esc viivad tagasi ruumi — karussell taastub
 * samasse kohta (GlassCarousel hoiab asukohta sessionStorage'is).
 * Sisu kerib paneeli SEES vertikaalselt (telgede reegel, brief §3).
 */

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizePath } from "@/lib/localizePath";
import IconButton from "@/components/glass/IconButton";
import CloseIcon from "@/components/brand/icons/CloseIcon";
import MenuIcon from "@/components/brand/icons/MenuIcon";
import { DashboardInfoTrigger } from "@/components/ui/DashboardInfoOverlay";

/* ⓘ akna vasakus ülanurgas (tellija 06.07 öö: peaaegu igal lehel);
   sisu on olemas ainult neil id-del (lib/dashboardInfoContent). */
const PANEL_INFO_IDS = {
  "/teekond": "journey",
  "/documents": "documents",
  "/dokreziim": "document_drafting",
  "/kovisioon": "kovision",
  "/materjalid": "materials",
  "/eelpoordumised": "intake",
  "/teenusekaart": "service_map",
  "/teenuseprofiil": "service_profile",
  /* Tööheaolu ülevaate ⓘ elab PanelFrame'is (püsib layoutis), et Töölaualt
     sisenedes ⓘ EI laeks uuesti — vahetub ainult sisu (tellija 07.07).
     WellbeingPage ülevaade ei renderda enam oma ⓘ-d (topelt vältimine). */
  "/tooheaolu": "wellbeing",
  /* RAG admin: iga leht saab oma juhendi (tellija 10.07) */
  "/admin/rag": "rag_admin",
  "/admin/rag/documents": "rag_admin_documents",
  "/admin/rag/ingest": "rag_admin_ingest",
  "/admin/rag/kov": "rag_admin_kov",
  "/admin/rag/organizations": "rag_admin_organizations",
  "/admin/rag/source-packages": "rag_admin_source_packages",
};

function normalizePathname(pathname) {
  const raw = String(pathname || "/").split("#")[0].split("?")[0] || "/";
  return raw.replace(/^\/(et|ru|en)(?=\/|$)/, "") || "/";
}

/* Töölaualt avatud täis-marsruut (nt /tooheaolu) märgib sisenemise (WorkspacePanel
   markWorkspaceSubpageEntry). Sulge-rist peab siis viima TAGASI TÖÖLAUALE, mitte
   ruumi (tellija 07.07). Restore-lipp paneb /vestlus taasavama töölaua-näo. */
const WORKSPACE_SUBPAGE_ENTRY_STORAGE_KEY = "__SOTSIAALAI_WORKSPACE_SUBPAGE_ENTRY__";
const CHAT_WORKSPACE_RESTORE_STORAGE_KEY = "__SOTSIAALAI_CHAT_WORKSPACE_RESTORE__";

function cameFromWorkspace(normalizedPath) {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_SUBPAGE_ENTRY_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const ts = Number(parsed?.ts || 0);
    const fresh = Number.isFinite(ts) && Date.now() - ts < 30 * 60 * 1000;
    return fresh && parsed?.source === "workspace" && parsed?.path === normalizedPath;
  } catch {
    return false;
  }
}

export default function PanelFrame({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const bodyRef = useRef(null);

  const normalized = normalizePathname(pathname);
  const isHome = normalized === "/";
  const isLogoExport = normalized === "/logo-eksport";
  /* Profiili-hub on karussell (RoomStage); lehe sisu avaneb alles
     sektsiooni valides (?sektsioon=konto). */
  const isProfileHub =
    normalized === "/profiil" && !String(searchParams?.get("sektsioon") || "").trim();
  const isAdmin = normalized.startsWith("/admin");
  const isConversation = normalized.startsWith("/vestlus");
  const isChat = isConversation || normalized.startsWith("/teekond");
  const isCovision = normalized === "/kovisioon";
  /* Suured tööpinnad vajavad laia ja kõrget akent (tellija 06.07 öö):
     teenusekaart = suur kaart */
  const isWide = ["/teenusekaart", "/lopetatud-juhtumid", "/parimad-praktikad"].includes(normalized);
  /* Kovisioon + Teemaseemned = TÄISEKRAANI LÕUEND (tellija 11.07):
     paneel täpselt ekraani suurune, paddinguta ja läbipaistev — sisu
     saab kogu ruumi ega keri; nurga-nupud hõljuvad sisu kohal */
  const isCanvas = normalized === "/kovisioon" || normalized === "/teemaseemned";
  /* ☰ (vestluste sahtel) AINULT vestlusevaates; töölaual ja mujal ⓘ
     (tellija 06.07 öö) */
  const workspaceParam = String(searchParams?.get("workspace") || "").trim();
  const isWorkspaceView = normalized.startsWith("/vestlus") && Boolean(workspaceParam);
  const showConversationsMenu = normalized.startsWith("/vestlus") && !workspaceParam;
  const panelInfoId = isWorkspaceView ? "workspace" : PANEL_INFO_IDS[normalized] || null;
  /* Väikese sisuga lehed avanevad kaardi-mõõtu aknas, mitte üle
     ekraani (tellija otsus; 06.07 öö: ka Ruumid keskmises kaardis). */
  const isCompact =
    normalized === "/uuenda-pin" ||
    normalized === "/uuenda-epost" ||
    normalized === "/ruum" ||
    normalized.startsWith("/taasta-parool");

  const isProfileCardPage = normalized === "/uuenda-pin" || normalized === "/uuenda-epost";
  const isProfileSectionPage =
    normalized === "/profiil" && Boolean(String(searchParams?.get("sektsioon") || "").trim());

  const closePanel = useCallback(() => {
    // pin/e-post sulgub profiili-karusselli
    if (isProfileCardPage || isProfileSectionPage) {
      router.push(localizePath("/profiil", locale));
      return;
    }
    // Töölaualt avatud alamleht (nt /tooheaolu) → TAGASI TÖÖLAUALE, mitte ruumi
    if (cameFromWorkspace(normalized)) {
      try {
        window.sessionStorage.removeItem(WORKSPACE_SUBPAGE_ENTRY_STORAGE_KEY);
        window.sessionStorage.setItem(
          CHAT_WORKSPACE_RESTORE_STORAGE_KEY,
          JSON.stringify({ ts: Date.now(), workspace: true, suppressOpenTransition: true, source: "panel-close" })
        );
      } catch {}
      router.push(localizePath("/vestlus?workspace=1", locale));
      return;
    }
    // muu (sh Ruumid) peavalikusse
    router.push(localizePath("/", locale));
  }, [router, locale, isProfileCardPage, isProfileSectionPage, normalized]);

  useEffect(() => {
    if (isHome || isProfileHub) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.body.classList.contains("modal-open")) return;
      if (document.documentElement.classList.contains("login-modal-open")) return;
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
      if (el?.closest?.("[role='dialog'],[data-esc-scope]")) return;
      closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isHome, isProfileHub, closePanel]);

  /* Kerimiskoha säilitamine paneeli kohta (naasmisel sama koht). */
  useEffect(() => {
    if (isHome) return undefined;
    const el = bodyRef.current;
    if (!el) return undefined;
    const key = `sotsiaalai:panel-scroll:${normalized}`;
    try {
      const saved = window.sessionStorage.getItem(key);
      if (saved != null) el.scrollTop = Number(saved) || 0;
    } catch {}
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try {
          window.sessionStorage.setItem(key, String(el.scrollTop));
        } catch {}
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isHome, normalized]);

  if (isHome || isLogoExport) return children;
  if (isProfileHub) {
    // Sisu jääb monteerituks (seis säilib), aga on peidus ja inertne —
    // nähtav navigatsioon on RoomStage'i profiili-karussell.
    return (
      <div hidden inert>
        {children}
      </div>
    );
  }

  return (
    <div
      className="panel-scrim"
      data-admin={isAdmin ? "1" : "0"}
      data-canvas={isCanvas ? "1" : "0"}
      data-covision={isCovision ? "1" : "0"}
      data-chat={isChat ? "1" : "0"}
      data-conversation={isConversation ? "1" : "0"}
      data-compact={isCompact ? "1" : "0"}
      data-wide={isWide ? "1" : "0"}
    >
      <section className="panel" aria-label={t("room.panel_region")}>
        {showConversationsMenu ? (
          /* Vestluste menüü (ajalugu, uus vestlus) — vasakul üleval,
             AINULT vestlusevaates (pilt 9) */
          <IconButton
            layoutClassName="panel-menu"
            aria-label={t("nav.chats")}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("sotsiaalai:toggle-conversations", { detail: { open: true } })
              )
            }
          >
            <MenuIcon />
          </IconButton>
        ) : panelInfoId ? (
          /* Lehe ⓘ — samas nurgas, avab selgituse klaasmodaalis */
          <DashboardInfoTrigger
            infoId={panelInfoId}
            label={t("room.panel_info_label")}
            className="panel-menu panel-menu--info"
          />
        ) : null}
        {isCovision ? (
          <button
            type="button"
            data-variant
            className="panel-exit"
            aria-label={t("covision.live.exit.aria")}
            onClick={closePanel}
          >
            <span aria-hidden="true">←</span>
            {t("covision.live.exit.label")}
          </button>
        ) : (
          <IconButton
            layoutClassName="panel-close"
            aria-label={t("room.close_panel")}
            onClick={closePanel}
          >
            <CloseIcon />
          </IconButton>
        )}
        <div className="panel-body" ref={bodyRef}>
          {children}
        </div>
      </section>
    </div>
  );
}
