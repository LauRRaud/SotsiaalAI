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

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizePath } from "@/lib/localizePath";
import { readRoomHubPath } from "@/lib/roomHubReturn";
import {
  isCanvasRoute,
  isWideRoute,
  panelDockRecedesAnywhere,
  panelHasOwnExit,
  panelHasRoomDock
} from "@/lib/roomDock";
import { PanelExitProvider } from "@/components/room/PanelExit";
import IconButton from "@/components/glass/IconButton";
import CloseIcon from "@/components/brand/icons/CloseIcon";
import MenuIcon from "@/components/brand/icons/MenuIcon";
import { DashboardInfoBody, DashboardInfoTrigger } from "@/components/ui/DashboardInfoOverlay";
import {
  usePanelInfoSlotValue,
  usePanelInfoView,
  usePublishPanelInfo
} from "@/components/ui/PanelInfoSlot";

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

/* Kui kaua tohib aken sisu oodata, enne kui ta ennast igal juhul näitab.
   Pikem ootamine teeks aeglase võrgu puhul tühja ekraani; lühem laseks
   tavapärase päringu (~100–300 ms) tagasi kahe liigutuse peale. Üle selle
   piiri jõudnud sisu ei hüppa, vaid kasvab (panel.css height-transition). */
const PANEL_SETTLE_MAX_MS = 450;

/* Ootamine käib AINULT kaardilt avamise (kliendipoolse navigatsiooni) kohta.
   Esimesel laadimisel on serveri joonistatud aken juba ekraanil — selle
   peitmine tähendaks, et F5 või otselink näitaks tühja ruumi, kuni JS
   kohale jõuab. Väravat "laetakse" alles siis, kui PanelFrame on korra
   monteeritud ehk hüdreerimine läbi. Serveris jääb ta alati laadimata
   (moodulimuutuja elab Node'is üle päringute — vt window-kontroll). */
let panelGateArmed = false;

/* Aken avaneb alles siis, kui tema kast on oma päris mõõdus.
   Märk, et mõõt on veel tulemas, on üksainus ja usaldusväärne: laadiv
   leht renderdab tühja kesta, mis jääb TÄPSELT min-height'i peale. Kui
   kast on sellest juba kõrgem, on sisu kohal ja oodata pole midagi —
   nii ei maksa serverirenderdatud lehed (Meist, tingimused, juhend)
   selle ootamise eest sentigi. */
function usePanelSettled(panelRef) {
  const [settled, setSettled] = useState(() =>
    typeof window === "undefined" ? true : !panelGateArmed
  );
  useEffect(() => {
    if (settled) return undefined;
    const el = panelRef.current;
    if (!el) {
      setSettled(true);
      return undefined;
    }
    let reduced = false;
    try {
      reduced =
        document.documentElement.dataset.reduceMotion === "1" ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    } catch {}
    if (reduced || typeof ResizeObserver === "undefined") {
      setSettled(true);
      return undefined;
    }
    const floor = Number.parseFloat(window.getComputedStyle(el).minHeight);
    if (!Number.isFinite(floor) || el.getBoundingClientRect().height > floor + 1) {
      setSettled(true);
      return undefined;
    }
    let cap = 0;
    let ro = null;
    /* Esimene ResizeObserver-teade on alati praegune mõõt (see on
       vaatlemise osa, mitte muutus) — sealt saame lähtepunkti. Sama
       kastiga mõõtmine (contentRect mõlemal pool) hoiab ääre ja polstri
       arvestusest väljas. */
    let base = null;
    const done = () => {
      window.clearTimeout(cap);
      ro?.disconnect();
      setSettled(true);
    };
    ro = new ResizeObserver((entries) => {
      const h = entries[entries.length - 1]?.contentRect?.height;
      if (!Number.isFinite(h)) return;
      if (base === null) {
        base = h;
        return;
      }
      if (Math.abs(h - base) > 1) done();
    });
    ro.observe(el);
    cap = window.setTimeout(done, PANEL_SETTLE_MAX_MS);
    return () => {
      window.clearTimeout(cap);
      ro.disconnect();
    };
  }, [panelRef, settled]);
  return settled;
}

/* Klaasraam ise. Eraldi komponent EI ole kosmeetika: ta monteeritakse
   siis, kui aken avaneb, ja lahti siis, kui minnakse karusselli-hubi.
   Nii lähtestub ootamise seis iseenesest — PanelFrame elab layoutis ja
   tema oma seis ei kaoks kunagi. */
function PanelSurface({ label, controls, bodyRef, children }) {
  const panelRef = useRef(null);
  const settled = usePanelSettled(panelRef);
  return (
    <section
      className="panel"
      aria-label={label}
      ref={panelRef}
      data-enter={settled ? "1" : "0"}
    >
      {controls}
      <div className="panel-body" ref={bodyRef}>
        {children}
      </div>
    </section>
  );
}

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
  /* Tagasikutse-viide, MITTE useRef: akna keha tekib ja kaob ilma et
     `normalized` muutuks. /profiil on hub (paneelikest puudub üldse) ja
     /profiil?sektsioon=kasutus on aken — mõlema normaliseeritud tee on
     „/profiil". Kerimiskuulajad sõltusid `normalized`-ist, seega hubist
     sektsiooni minnes EI käivitunud nad uuesti ja `bodyRef.current` oli
     nende jaoks igavesti null: dokk ei taandunud ega kerimiskoht ei
     taastunud (omanik 26.07: „menüü katab teksti, alla kerides peaks see
     ära kaduma"). Sõlmest endast sõltuvus paneb nad tööle alati, kui keha
     päriselt olemas on. */
  const [bodyEl, setBodyEl] = useState(null);
  const bodyRef = useCallback((node) => setBodyEl(node), []);

  /* Hüdreerimine läbi → edaspidised akna-avamised on kaardilt tulek ja
     tohivad sisu ära oodata (vt panelGateArmed). */
  useEffect(() => {
    panelGateArmed = true;
  }, []);

  const normalized = normalizePathname(pathname);
  const isHome = normalized === "/";
  const isLogoExport = normalized === "/logo-eksport";
  /* Profiili-hub on karussell (RoomStage); lehe sisu avaneb alles
     sektsiooni valides (?sektsioon=konto). */
  const isProfileHub =
    normalized === "/profiil" && !String(searchParams?.get("sektsioon") || "").trim();
  /* Töölaud koos alamkomplektidega (/toolaud/tooheaolu, /toolaud/kovisioon)
     on karussell (RoomStage), mitte paneel — lehed ise on ainult marsruudi-
     markerid sr-only sisuga (omanik 21.07, vt app/toolaud/page.jsx). */
  const isWorkspaceHub = normalized === "/toolaud" || normalized.startsWith("/toolaud/");
  const isAdmin = normalized.startsWith("/admin");
  const isConversation = normalized.startsWith("/vestlus");
  const workspaceParam = String(searchParams?.get("workspace") || "").trim();
  const isWorkspaceView = isConversation && Boolean(workspaceParam);
  const isConversationSurface = isConversation && !isWorkspaceView;
  const isChat = isConversation || normalized.startsWith("/teekond");
  const isCovision = normalized === "/kovisioon";
  /* Suured tööpinnad vajavad laia ja kõrget akent (tellija 06.07 öö):
     teenusekaart = suur kaart.
     Kovisioon + Teemaseemned + Registreerimine + Hinnastus = TÄISEKRAANI
     LÕUEND (tellija 11.07; registreerimine 16.07 jaamalennuna): paneel
     täpselt ekraani suurune, paddinguta ja läbipaistev.
     Mõlemad loendid elavad lib/roomDock.js-is, sest RoomStage peab samast
     allikast teadma, millised aknad dokki EI kanna. */
  const isWide = isWideRoute(normalized);
  const isCanvas = isCanvasRoute(normalized);
  /* Dokiga aknal EI OLE nurga-risti: väljapääs on ruumi dokis, ühes ja
     samas kohas (omanik 26.07). Esc jääb tööle igal juhul. */
  const hasRoomDock = panelHasRoomDock(normalized, { workspace: workspaceParam });
  /* Lõuend, mille oma dokk kannab tagasi-noolt (Hinnastus): rist kaob
     sealtki, aga sulgemisloogika jääb SIIA — leht kutsub teda
     PanelExitProvider'i kaudu. */
  const hasOwnExit = panelHasOwnExit(normalized);
  /* ☰ (vestluste sahtel) AINULT vestlusevaates; töölaual ja mujal ⓘ
     (tellija 06.07 öö) */
  const showConversationsMenu = normalized.startsWith("/vestlus") && !workspaceParam;
  /* Lehe registreeritud ⓘ-sisu võidab staatilise marsruudikaardi: nii saavad
     rollipõhised (/eelpoordumised), dünaamilised (?workspace=X) ja kaardis
     puuduvad (/teekond/[id], /tooheaolu/[tool]) pinnad õige sisu ILMA teist
     ikooni renderdamata. Vt components/ui/PanelInfoSlot. */
  const infoSlot = usePanelInfoSlotValue();
  const fallbackInfoId = isWorkspaceView ? "workspace" : PANEL_INFO_IDS[normalized] || null;
  const panelInfoId = infoSlot?.infoId || fallbackInfoId;
  /* Dokiga aknal kannab ⓘ-d KIIRMENÜÜ (lehe nime kõrval), mitte akna nurk
     — nagu väljapääsgi (omanik 26.07). Vajutus ei ava modaali, vaid
     vahetab akna sisu info vastu. Dokita pinnad (vestlus, lõuendid,
     admin) hoiavad senise nurga-ⓘ modaali. */
  const infoInDock = hasRoomDock && Boolean(panelInfoId);
  usePublishPanelInfo({
    infoId: infoInDock ? panelInfoId : null,
    title: infoSlot?.title,
    label: infoSlot?.label,
    detailExtras: infoSlot?.detailExtras
  });
  const { open: infoViewOpen, close: closeInfoView } = usePanelInfoView();
  const showInfoView = infoInDock && infoViewOpen;
  /* Väikese sisuga lehed avanevad kaardi-mõõtu aknas, mitte üle
     ekraani (tellija otsus; 06.07 öö: ka Ruumid keskmises kaardis). */
  const isCompact =
    normalized === "/uuenda-pin" ||
    normalized === "/uuenda-epost" ||
    normalized === "/ruum" ||
    normalized.startsWith("/taasta-parool");

  const isProfileCardPage = normalized === "/uuenda-pin" || normalized === "/uuenda-epost";
  /* Konto-pere aknad (Konto seaded, Minu kasutus, Tellimus) on ÜKS ja
     seesama kast (omanik 26.07: "konto seaded ja minu kasutus peab olema
     sama suur kui tellimuse lehel; tellimuse laius selliseks nagu on
     minu kasutus lehel"). Kolm kõrvutiseisvat kaarti samas komplektis ei
     tohi kolme eri mõõtu akent avada — laius tuleb kitsaimalt (40rem,
     sisu on kõigil kolmel kitsas keskveerg), kõrguse otsustab sisu. */
  const isProfileSectionPage =
    (normalized === "/profiil" && Boolean(String(searchParams?.get("sektsioon") || "").trim())) ||
    normalized === "/tellimus";

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
    // muu (sh Ruumid) tagasi sellesse karusselli-hubi, kust leht avati:
    // töölaualt avatud leht → /toolaud, mujalt → avaleht.
    router.push(localizePath(readRoomHubPath("/"), locale));
  }, [router, locale, isProfileCardPage, isProfileSectionPage, normalized]);

  useEffect(() => {
    if (isHome || isProfileHub || isWorkspaceHub) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.body.classList.contains("modal-open")) return;
      if (document.documentElement.classList.contains("login-modal-open")) return;
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
      if (el?.closest?.("[role='dialog'],[data-esc-scope]")) return;
      /* Info-leht on akna sees, mitte akna asemel: Esc viib esimesena
         lehe juurde tagasi ja alles teine kord ruumi. */
      if (showInfoView) {
        closeInfoView();
        return;
      }
      closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isHome, isProfileHub, isWorkspaceHub, closePanel, showInfoView, closeInfoView]);

  /* Kerimiskoha säilitamine paneeli kohta (naasmisel sama koht). */
  useEffect(() => {
    if (isHome) return undefined;
    const el = bodyEl;
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
  }, [isHome, normalized, bodyEl]);

  /* Dokk taandub, kui lugeja süveneb (omanik 26.07). VR-loogika: dokk on
     RUUMI ese, mitte ekraanikleeps — kui pilk läheb tekstitahvlile, jääb
     ta taha, hämardub ja läheb fookusest välja; tahvel ise kasvab vabaks
     jäänud ruumi. Tagasi tuleb ta kohe, kui pilk tõuseb (kerid üles) või
     kui lugemine on läbi (jõuad põhja) — väljapääsu ei tohi otsida.

     Olek elab <html> data-atribuudil, mitte Reacti olekus: teda vajavad
     KAKS eri puud (dokk elab RoomStage'is, aken siin) ja üleminek on
     puhas CSS. Reacti kaudu tähendaks see konteksti läbi terve puu ja
     iga kerimiskaadri renderdust. */
  useEffect(() => {
    if (isHome || !hasRoomDock) return undefined;
    const el = bodyEl;
    const root = document.documentElement;
    if (!el || !root) return undefined;

    /* Lävi on müravaigisti: puuteplaadi hoog annab ±1 px kaadreid, mis
       ilma selleta paneksid doki edasi-tagasi võbelema. */
    const NOISE = 6;
    const TOP_ZONE = 48;
    const END_ZONE = 24;
    let last = el.scrollTop;
    let raf = 0;
    let bound = false;

    const apply = () => {
      raf = 0;
      const top = el.scrollTop;
      const delta = top - last;
      if (Math.abs(delta) < NOISE) return;
      last = top;
      const max = el.scrollHeight - el.clientHeight;
      const atEnd = max - top <= END_ZONE;
      const nearTop = top <= TOP_ZONE;
      const hide = delta > 0 && !atEnd && !nearTop;
      root.dataset.dockRecessed = hide ? "1" : "0";
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    };

    /* KAKS reeglit, mitte üks (omanik 26.07):
       — LUGEMISLEHED (Teave-alamkomplekt, lib/roomDock READING_ROUTES):
         dokk taandub igal ekraanil. Seal on pikk proosa, lugeja süveneb
         ja tahvel kasvab doki asemele — see ongi selle lehetüübi keel.
       — KÕIK MUU: ainult mobiilil („see peaks olema ainult mobiilis nii,
         sest katab seal aknas teksti"). Laual on aken dokist kitsam ja
         tema kohal, seega dokk ei kata midagi ja tema kadumine oleks
         lihtsalt väljapääsu peitmine.
       Piir 768px = sama, mis paneeli enda mobiilireeglitel (panel.css). */
    const alwaysRecedes = panelDockRecedesAnywhere(normalized);
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => {
      const want = alwaysRecedes || mq.matches;
      if (want === bound) return;
      bound = want;
      if (want) {
        last = el.scrollTop;
        el.addEventListener("scroll", onScroll, { passive: true });
        return;
      }
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      delete root.dataset.dockRecessed;
    };
    sync();
    mq.addEventListener?.("change", sync);

    return () => {
      mq.removeEventListener?.("change", sync);
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      /* Lehelt lahkudes EI tohi dokk taandunuks jääda — järgmine aken
         avaneks ilma väljapääsuta. */
      delete root.dataset.dockRecessed;
    };
  }, [isHome, hasRoomDock, normalized, bodyEl]);

  /* Töölaud: sr-only marker jääb DOM-i (ekraanilugeja, robotid), paneelikesta
     EI teki — nähtav navigatsioon on RoomStage'i töölaua-karussell. */
  if (isHome || isLogoExport || isWorkspaceHub) return children;
  if (isProfileHub) {
    // Sisu jääb monteerituks (seis säilib), aga on peidus ja inertne —
    // nähtav navigatsioon on RoomStage'i profiili-karussell.
    return (
      <div hidden inert>
        {children}
      </div>
    );
  }

  const panelControls = (
    <>
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
      ) : panelInfoId && !infoInDock ? (
        /* Platvormi AINUS lehe-ⓘ: paremas ülanurgas, sulgemisristist
           vahetult vasakul, ristiga sama mõõtu. Leht ei renderda oma
           ikooni — ta annab sisu usePanelInfoSlot'i kaudu. */
        <DashboardInfoTrigger
          key={panelInfoId}
          infoId={panelInfoId}
          title={infoSlot?.title}
          label={infoSlot?.label || t("room.panel_info_label")}
          detailExtras={infoSlot?.detailExtras}
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
      ) : hasRoomDock || hasOwnExit ? null : (
        <IconButton
          layoutClassName="panel-close"
          aria-label={t("room.close_panel")}
          onClick={closePanel}
        >
          <CloseIcon />
        </IconButton>
      )}
    </>
  );

  return (
    <div
      className="panel-scrim"
      data-admin={isAdmin ? "1" : "0"}
      data-canvas={isCanvas ? "1" : "0"}
      data-covision={isCovision ? "1" : "0"}
      data-chat={isChat ? "1" : "0"}
      data-conversation={isConversationSurface ? "1" : "0"}
      data-compact={isCompact ? "1" : "0"}
      data-wide={isWide ? "1" : "0"}
      data-dock={hasRoomDock ? "1" : "0"}
      data-narrow={isProfileSectionPage ? "1" : "0"}
      data-info={showInfoView ? "1" : "0"}
    >
      <PanelSurface
        label={t("room.panel_region")}
        controls={panelControls}
        bodyRef={bodyRef}
      >
        {/* Info-lehe ajaks jääb leht MONTEERITUKS, ainult peidetuks: pooleli
            täidetud väli, laetud loend ja kerimiskoht peavad tagasi tulles
            alles olema. Modaali siin ei ole — info ON leht.

            Peitmine käib `hidden`-iga ehk leht kaob MÕÕDUST — konto-pere
            aknad ei tohi sellest kõikuma hakata, aga nad ei kõigugi:
            nende kõrgus on lukus (panel.css `[data-narrow]`, omanik 26.07:
            „info leht oli juba õige", konto seaded peab tema mõõtu
            kahanema). Teistel dokiga akendel jääb kõrgus sisu järgi. */}
        {showInfoView ? (
          <section className="panel-info-view" aria-label={t("room.panel_info_label")}>
            <DashboardInfoBody
              infoId={panelInfoId}
              detailExtras={infoSlot?.detailExtras}
            />
          </section>
        ) : null}
        {/* Mähis tuleb AINULT siis, kui sellel aknal on info-leht. Laiad
            ja lõuend-pinnad stiilivad `.panel-body > *` otse — nendel
            dokki ei ole, aga tingimusteta mähis lõhuks nad ära. */}
        {infoInDock ? (
          <div className="panel-info-page" hidden={showInfoView} inert={showInfoView || undefined}>
            <PanelExitProvider close={closePanel}>{children}</PanelExitProvider>
          </div>
        ) : (
          <PanelExitProvider close={closePanel}>{children}</PanelExitProvider>
        )}
      </PanelSurface>
    </div>
  );
}
