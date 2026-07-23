"use client";

/**
 * RoomStage — hämarikuruumi lavastus (visuaalne brief v1.1).
 *
 * Elab root-layoutis KÕIGI marsruutide taga, et navigeerimine ei
 * laadiks ruumi uuesti. Kolm režiimi (html[data-room-mode]):
 *  - "walk"  — avaleht, saabumiskõnd: kerimine juhib 12 loogilist kaadrit
 *  - "room"  — avaleht, lõppseis: lõppkaader + karussell (+ mikroelu)
 *  - "panel" — iga muu marsruut: lõppkaader hämardatuna paneeli taga
 *
 * Kõik kaadri-transformid käivad imperatiivselt rAF+lerp silmusega
 * (transform/opacity/filter ainult), React uuendab vaid diskreetseid
 * seisundeid (režiim, loor, karusselli komplekt).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider";
import { localizePath } from "@/lib/localizePath";
import { rememberRoomHubPath } from "@/lib/roomHubReturn";
import IconButton from "@/components/glass/IconButton";
import {
  GuideBookIcon,
  TermsDocIcon,
  PrivacyShieldIcon,
  PricingTagIcon,
  InstallIcon,
  ContactMailIcon,
  LoginKeyIcon,
  AnalyticsIcon,
  RagDbIcon,
  AcceptShieldIcon,
  LanguageAccessIcon,
  AccountGearIcon,
  PinLockIcon,
  PowerIcon,
  SparkleIcon,
  ChatCardIcon,
  RoomsCardIcon,
  WorkspaceCardIcon,
  ProfileCardIcon,
  SubscriptionEuroIcon,
  BackArrowIcon,
  AdminSlidersIcon,
  AboutInfoIcon,
  HelpRequestIcon,
  HelpOfferIcon,
  DocumentsIcon,
  ComposeDocIcon,
  InquiryIcon,
  InvitePersonIcon,
  KovisionIcon,
  WellbeingIcon,
  MaterialsIcon,
  ServiceMapIcon,
  JourneyPathIcon,
  KovisionRoomIcon,
  TopicSeedIcon,
  BestPracticeIcon,
  SearchIcon,
  SupervisionIcon,
  MentorIcon,
  FieldIcon,
  ReflectionIcon,
  ServiceProfileIcon,
} from "@/components/brand/icons/CardIcons";
import { wellbeingTools } from "@/lib/wellbeingTools";
import GlassCarousel from "@/components/room/GlassCarousel";
import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import PendingInviteBanner from "@/components/invites/PendingInviteBanner";
import RoomQuickbar from "@/components/room/RoomQuickbar";
import VeilArt, { VEIL_EFFECTS } from "@/components/room/VeilArt";
import GlassButton from "@/components/glass/GlassButton";
import JourneyText from "@/components/glass/JourneyText";
import MetallicPaint from "@/components/brand/MetallicPaint";
import {
  getAmbientMode,
  setAmbientMode,
  AMBIENT_MODES,
  AMBIENT_START_EVENT,
} from "@/components/room/AmbientAudio";

const LoginModal = dynamic(() => import("@/components/LoginModal"), {
  ssr: false,
  loading: () => null,
});
const GlassModal = dynamic(() => import("@/components/glass/GlassModal"), {
  ssr: false,
  loading: () => null,
});
const InstallAppLink = dynamic(() => import("@/components/pwa/InstallAppLink"), {
  ssr: false,
  loading: () => null,
});

/* Kerimisruumi pikkus tuleb CSS-ist (--walk-vh, room.css spacer). */
const LERP = 0.11;
const LERP_SKIP = 0.17;
const ROOM_ARRIVAL_COMPLETE_COOKIE = "sotsiaalai_room_arrival_complete";

/* Tellija otsus: saabumiskõnd toimub IGAL platvormi laadimisel —
 * mitte mingit "olen näinud" salvestust. Ainult sama laadimise sees
 * (paneeli avamine ja sulgemine) kõndi ei korrata. */
let walkDoneThisLoad = false;

const STANDBY_FROM = 0.958; // ooterežiimi elemendid pärast viimast teksti

/* Tekstipeatused püsivad ühes kompaktses fookusväljas. Mitmelauselise
   peatuse read ei lenda enam eri ekraaniservadesse. Iga peatus "lendab
   läbi" kaamera ees (flight-effect: vt public/room/flight-effect.md) —
   depth on translateZ-i lõppväärtus peatuse tsooni lõpus. */
const TEXT_STOPS = [
  { keys: ["walk_1"], from: 0.035, to: 0.165, depth: 620 },
  { keys: ["walk_2a", "walk_2b"], from: 0.2, to: 0.35, depth: 620 },
  { keys: ["walk_3a", "walk_3b"], from: 0.372, to: 0.528, depth: 620 },
  { keys: ["walk_4a", "walk_4b"], from: 0.552, to: 0.708, depth: 620 },
  { keys: ["walk_5a", "walk_5b"], from: 0.732, to: 0.85, depth: 620 },
  { keys: ["walk_6"], from: 0.875, to: 0.945, depth: 620 },
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t) => t * t * (3 - 2 * t); // smoothstep

/* Teksti sisse/välja hajumine: [from,to] aknas, pehme servaga. */
function fadeWindow(p, from, to, edge = 0.035) {
  const a = clamp01((p - from) / edge);
  const b = clamp01((to - p) / edge);
  return Math.min(a, b);
}

function normalizePathname(pathname) {
  const raw = String(pathname || "/").split("#")[0].split("?")[0] || "/";
  return raw.replace(/^\/(et|ru|en)(?=\/|$)/, "") || "/";
}

export default function RoomStage({ initiallyCompletedArrival = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const { data: session, status } = useSession();
  const a11y = useAccessibility();

  const normalized = normalizePathname(pathname);
  const isHome = normalized === "/";
  /* Profiil on samuti karussell: sektsioonikaardid (Konto seaded,
     Uuenda PIN jt); avatud sektsioon on tavaline paneel. */
  const isProfileHub =
    normalized === "/profiil" && !String(searchParams?.get("sektsioon") || "").trim();
  /* Kaardi-lehed: väikese sisuga lehed ilmuvad KESKMISE KAARDI sisse,
     küljekaardid jäävad konteksti (tellija otsus; 06.07 öö: ka Ruumid). */
  const CARD_PAGE_KEYS = { "/uuenda-pin": "pin", "/uuenda-epost": "epost", "/ruum": "ruumid" };
  const cardPageKey = CARD_PAGE_KEYS[normalized] || null;
  /* pin/epost elavad profiilikarusselli kontekstis; ruumid töökomplektis */
  const isProfileCardPage = cardPageKey === "pin" || cardPageKey === "epost";
  /* Töölaud koos alamkomplektidega on PÄRIS marsruut (omanik 21.07), mitte
     olekulüliti: URL muutub, järjehoidja/F5/tagasi-nupp töötavad. Ruum elab
     root-layoutis, seega marsruudivahetus EI remonteeri lava → ekraan ei vilgu,
     vahetub ainult karusselli kaardikomplekt.
     Alamkomplektid elavad töölaua ALL (/toolaud/tooheaolu), sest /tooheaolu ja
     /kovisioon on juba päris lehed — kaardimenüü ja tööruum ei mahu ühe URL-i
     alla (omanik 21.07: "tööheaolu lehel ei ole ka /tööheaolu näha"). */
  const isWellbeingRoute = normalized === "/toolaud/tooheaolu";
  const isKovisionRoute = normalized === "/toolaud/kovisioon";
  const isWorkspaceRoute = normalized === "/toolaud" || isWellbeingRoute || isKovisionRoute;
  const isCarouselRoute = isHome || isProfileHub || isWorkspaceRoute || !!cardPageKey;
  const isAuthed = status === "authenticated" && !!session;
  /* Saabumisloor on seansipõhine, mitte sisselogimispõhine: ka pikalt
     sisselogitud inimene näeb seda uues seansis ühe korra, kuid mitte iga
     lehe värskendusega pärast kaartide avanemist. */
  const [arrivalCompleted, setArrivalCompleted] = useState(() =>
    Boolean(initiallyCompletedArrival)
  );
  const shouldResumeHome = isHome && arrivalCompleted;
  const isAdmin = useMemo(() => {
    const u = session?.user;
    const role = typeof u?.role === "string" ? u.role.toLowerCase() : "";
    const perms = Array.isArray(u?.permissions) ? u.permissions : [];
    return Boolean(u?.isAdmin || u?.is_admin || role === "admin" || perms.includes("admin"));
  }, [session]);

  /* Ootel sponsorkutse — hub-teade + RUUMID-kaardi badge (omanik 23.07:
     teade kuulub platvormi hub'i, MITTE eellaadimisstseeni külge; RUUMID
     kaardil peab olema märge lisaks). Pärime üks kord; sama seis toidab nii
     PendingInviteBanner'i kui badge'i. */
  const [pendingInvite, setPendingInvite] = useState(null);
  const [pendingNeedsVerify, setPendingNeedsVerify] = useState(false);
  useEffect(() => {
    if (!isAuthed) {
      setPendingInvite(null);
      setPendingNeedsVerify(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/invites/pending", {
          headers: { Accept: "application/json" }
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const first = Array.isArray(data?.invites) ? data.invites[0] : null;
        if (first) {
          setPendingInvite(first);
          setPendingNeedsVerify(false);
        } else if (data?.emailVerified === false && data?.hasPending) {
          setPendingInvite(null);
          setPendingNeedsVerify(true);
        } else {
          setPendingInvite(null);
          setPendingNeedsVerify(false);
        }
      } catch {
        // vaikne — teade on abistav lisa
      }
    })();
    return () => {
      cancelled = true;
    };
    // pathname deps: värskenda navigeerimisel (nt pärast liitumist kaob teade).
  }, [isAuthed, pathname]);
  const hasPendingInvite = Boolean(pendingInvite) || pendingNeedsVerify;
  /* Töölaua kaardikomplekt sõltub vaate-rollist: tavakasutaja näeb oma
     rolli kaarte, admin saab S/P/T-lülitiga vaadet vahetada (effectiveRole).
     refreshEffectiveRole juhtmestatakse doki lülitile, et vahetus muudaks
     kaarte KOHE (RoomStage on klientkomponent, router.refresh üksi ei
     värskenda seda hooki). */
  const { effectiveRole, refresh: refreshEffectiveRole } = useEffectiveRole();

  /* --- režiim ---
     Algseis peab kokku langema režiimi-efekti tulemusega, muidu maalib
     esimene kaader karusselli-marsruudil (nt /toolaud järjehoidjast või
     F5-ga) korraks PANEELI — ruum häguneb ja teravneb kohe tagasi, mis
     ongi see vilkumine, mida omanik ei taha (21.07). Sama arvutus mõlemal
     pool → ka SSR ja hüdreerimine langevad kokku. */
  const [mode, setMode] = useState(() =>
    isHome ? (shouldResumeHome ? "room" : "walk") : isCarouselRoute ? "room" : "panel"
  );
  const [veil, setVeil] = useState(() =>
    isHome && !shouldResumeHome ? "shown" : "gone"
  );
  const [veilReady, setVeilReady] = useState(false);
  const [walkDone, setWalkDone] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [openInfoModal, setOpenInfoModal] = useState(null); // "kontakt" | "paigalda"
  /* Ülariba avatakse KLÕPSUST (mitte ainult hoverist) — puuteseadmetel
     on hover kättesaamatu. Nool on päris nupp; väljast-klõps/Esc sulgeb. */
  const [topbarOpen, setTopbarOpen] = useState(false);
  const topbarRef = useRef(null);
  /* Admini tööriistad elavad "Haldus" kaardi all eraldi kaardikomplektina
     (tellija 06.07) — mitte peakomplekti lõpus. */
  const [adminHub, setAdminHub] = useState(false);
  /* Avalikud infokaardid elavad sisselogitule profiili "Teave" kaardi all */
  const [infoHub, setInfoHub] = useState(false);
  /* Töölaud ja Tööheaolu = kaardikomplektid SAMAS karussellis (tellija
     10.07: "kaartide keritav rivi, mitte üks paneel väikeste nuppudega") —
     sama muster mis Haldus. Tööheaolu ja Kovisioon avanevad Töölaua seest
     (viimane annab kolm valikut: Kovisiooni ruum, Teemaseemned, Parimad
     praktikad).
     21.07: nende kolme OLEK on kustutatud — ainus tõeallikas on marsruut
     (isWorkspaceRoute / isWellbeingRoute / isKovisionRoute). Kaks tõeallikat
     (olek + pathname) oleksid omavahel võidelnud: tagasi-nupp muudaks URL-i,
     aga olek jätaks kaardid ette. */
  /* Taustaheli juhtnupud "ukse peal" ehk KÕNNIS (tellija 06.07 öö):
     vaigista/taasta + järgmine lugu. Viimane valitud lugu jääb meelde,
     et vaigistus→taastus ei viskaks alati Meloodia I peale. */
  const [ambientOn, setAmbientOn] = useState(true);
  const lastAmbientRef = useRef("a");
  useEffect(() => {
    const m = getAmbientMode();
    setAmbientOn(m !== "off");
    if (m !== "off") lastAmbientRef.current = m;
  }, []);
  const toggleAmbient = useCallback(() => {
    setAmbientOn((prev) => {
      const next = !prev;
      setAmbientMode(next ? lastAmbientRef.current || "a" : "off");
      return next;
    });
  }, []);
  /* Järgmine lugu: a→b→c→d→a (vaikusest → esimene). Eraldi nupp, et
     mitte segi ajada vaigista/play-lülitiga. */
  const nextAmbient = useCallback(() => {
    const order = AMBIENT_MODES;
    const cur = getAmbientMode();
    const next = order[(order.indexOf(cur) + 1) % order.length];
    lastAmbientRef.current = next;
    setAmbientMode(next);
    setAmbientOn(true);
  }, []);
  /* Muusika EI alga loorilt (tellija 07.07: "vale koht") — hoiame
     žest-käivituse kinni, kuni loor hajub (kasutaja astub uksele),
     siis vabastame ja saadame stardisignaali. Alalehtedel (loorita)
     algab endiselt esimesest žestist. */
  const ambientStartSent = useRef(false);
  useEffect(() => {
    if (!isHome) return undefined;
    const root = document.documentElement;
    if (veil === "shown") {
      root.setAttribute("data-ambient-hold", "1");
      return () => root.removeAttribute("data-ambient-hold");
    }
    root.removeAttribute("data-ambient-hold");
    if (!ambientStartSent.current) {
      ambientStartSent.current = true;
      try {
        window.dispatchEvent(new Event(AMBIENT_START_EVENT));
      } catch {}
    }
    return undefined;
  }, [isHome, veil]);
  /* Käivitus (teekonna-tekstid §Käivitus): "standby" = ooterežiim (⏻),
     "igniting" = süttimine, "on" = klaasid sees. OFF ≠ logout. */
  const [power, setPower] = useState(() =>
    isHome && !shouldResumeHome ? "standby" : "on"
  );

  const stageRef = useRef(null);
  const textRefs = useRef([]);
  const hintRef = useRef(null);
  const skipRef = useRef(null);
  const soundRef = useRef(null);
  const carouselWrapRef = useRef(null);
  const standbyRef = useRef(null);
  const powerRef = useRef(power);
  powerRef.current = power;
  /* "Välja" kaart profiililt → koju ooterežiimi (mitte kaartidele) */
  const pendingStandbyRef = useRef(false);
  /* Interaktiivsus avaneb alles pärast käivituse MÕLEMAT faasi */
  const [cardsReady, setCardsReady] = useState(() => shouldResumeHome);
  /* Käivituse vahepala: pärast klaaside teket sähvatab keskele animeeritud
     SAI-monogramm, alles siis laetakse kaartidele sisu (tellija 06.07) */
  const [introSai, setIntroSai] = useState(false);
  /* Loori logo ilmub ühe tervikuna alles siis, kui nii sõnamärgi SVG kui
     metallik-AI esimene WebGL-kaader on valmis. Vahepealseid kihte ei näidata. */
  const [veilMetalReady, setVeilMetalReady] = useState(false);
  const [veilWordmarkReady, setVeilWordmarkReady] = useState(false);
  const veilLogoReady = veilMetalReady && veilWordmarkReady;

  const displayed = useRef(0);
  const target = useRef(0);
  const rafId = useRef(0);
  const lerpK = useRef(LERP);
  const tiltTarget = useRef({ x: 0, y: 0 });
  const tiltCur = useRef({ x: 0, y: 0 });
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const reducedRef = useRef(false);
  const walkDoneRef = useRef(false);

  const readReduced = useCallback(() => {
    if (typeof window === "undefined") return false;
    const attr = document.documentElement.getAttribute("data-reduce-motion") === "1";
    let media = false;
    try {
      media = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}
    return attr || media;
  }, []);

  /* ---------- stseeni arvutus ja rakendamine ---------- */
  const applyScene = useCallback((p) => {
    if (!stageRef.current) return;

    // Tekstipeatused: üks kompaktne fookusplokk korraga, "lennates" läbi
    // kaadri ees (flight-effect: vt public/room/flight-effect.md §3-4).
    // drift 0→1 peatuse tsoonis: z liigub kaugelt (-depth/2) läbi kaamera
    // (0, täisnähtavus) edasi (+depth/2), nagu tekst lendaks vaatajast läbi.
    for (let s = 0; s < TEXT_STOPS.length; s++) {
      const el = textRefs.current[s];
      if (!el) continue;
      const stop = TEXT_STOPS[s];
      const alpha = fadeWindow(p, stop.from, stop.to, 0.022);
      if (alpha <= 0.001) {
        if (el.style.opacity !== "0") el.style.opacity = "0";
        continue;
      }
      const drift = clamp01((p - stop.from) / (stop.to - stop.from));
      const flightT = ease(drift);
      const z = (flightT - 0.5) * stop.depth;
      const scale = 0.96 + flightT * 0.08;
      el.style.opacity = String(alpha);
      el.style.transform = `translate3d(-50%, calc(-50% + ${(1 - alpha) * 10 - drift * 5}px), ${z.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      el.style.filter = "none";
    }

    // Kerimisvihje ainult alguses
    if (hintRef.current) {
      hintRef.current.style.opacity = String(clamp01((0.03 - p) / 0.03));
    }
    if (skipRef.current) {
      skipRef.current.style.opacity = p < 0.94 ? "" : "0";
      skipRef.current.style.pointerEvents = p < 0.94 ? "" : "none";
    }
    if (soundRef.current) {
      soundRef.current.style.opacity = p < 0.94 ? "" : "0";
      soundRef.current.style.pointerEvents = p < 0.94 ? "" : "none";
    }

    // Ooterežiim (⏻) ilmub alles siis, kui keskne tekst on hajunud;
    // room-režiimis (nt "Välja" järel) on ta kohe täies jõus
    if (standbyRef.current) {
      let sb = 0;
      if (powerRef.current === "standby") {
        sb =
          modeRef.current === "room"
            ? 1
            : ease(clamp01((p - STANDBY_FROM) / (1 - STANDBY_FROM)));
      }
      standbyRef.current.style.opacity = String(sb);
      standbyRef.current.style.pointerEvents = sb > 0.9 ? "auto" : "none";
    }

    // Kõnni läbimine → selle laadimise piires meelde (paneelilt naastes
    // ei korrata; värske laadimine alustab alati pimedusest)
    if (p > 0.995 && !walkDoneRef.current) {
      walkDoneRef.current = true;
      walkDoneThisLoad = true;
      setWalkDone(true);
    }
  }, []);

  /* ---------- rAF silmus ---------- */
  const tick = useCallback(() => {
    rafId.current = 0;
    let busy = false;

    if (modeRef.current === "walk") {
      const d = target.current - displayed.current;
      if (Math.abs(d) > 0.00035) {
        displayed.current += d * lerpK.current;
        busy = true;
      } else if (displayed.current !== target.current) {
        displayed.current = target.current;
        lerpK.current = LERP;
        busy = true;
      }
      applyScene(displayed.current);
    }

    // Kursorikalle (max mõni piksel; brief §6) — AINULT lõppseisus.
    // Paneelirežiimis omab transformi CSS (blur + scale).
    const stage = stageRef.current;
    if (stage && !reducedRef.current && modeRef.current === "room") {
      const tx = tiltTarget.current;
      const tc = tiltCur.current;
      const dx = tx.x - tc.x;
      const dy = tx.y - tc.y;
      if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) {
        tc.x += dx * 0.06;
        tc.y += dy * 0.06;
        busy = true;
      }
      // Kaamera liigub kursori SUUNAS (nagu pea pööramine istudes):
      // kursor paremale → vaade paremale → stseen nihkub vasakule.
      // Tellija 06.07 öö: liikumisruumi rohkem ("saab pead liigutada").
      stage.style.transform = `translate3d(${tc.x * -9}px, ${tc.y * -7}px, 0) rotateX(${tc.y * 0.5}deg) rotateY(${tc.x * -0.55}deg)`;
    }

    if (busy) {
      rafId.current = requestAnimationFrame(tick);
    }
  }, [applyScene]);

  const wake = useCallback(() => {
    if (!rafId.current) rafId.current = requestAnimationFrame(tick);
  }, [tick]);

  /* ---------- kerimine (walk) ---------- */
  const readTarget = useCallback(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? clamp01(window.scrollY / max) : 0;
  }, []);

  useEffect(() => {
    if (mode !== "walk") return undefined;
    const onScroll = () => {
      target.current = readTarget();
      wake();
    };
    const onResize = onScroll;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        displayed.current = target.current = readTarget();
        applyScene(displayed.current);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [mode, readTarget, wake, applyScene]);

  /* ---------- režiimi valik + algseis ---------- */
  useEffect(() => {
    reducedRef.current = readReduced();
    let next;
    if (!isCarouselRoute) {
      next = "panel";
    } else if (!isHome) {
      next = "room"; // profiili-karussell: ruum fookuses, ilma kõnnita
    } else {
      next = shouldResumeHome || walkDoneThisLoad || reducedRef.current
        ? "room"
        : "walk";
    }
    setMode(next);
  }, [isCarouselRoute, isHome, readReduced, shouldResumeHome]);

  /* Märgi saabumine lõpetatuks alles siis, kui avalehe kaardid on päriselt
     nähtavad. Ilma Max-Age'ta cookie kaob brauseri seansi lõpus ning on
     järgmisel seansil taas esimese külastuse loor. */
  useEffect(() => {
    if (!isHome || mode !== "room" || power !== "on" || !cardsReady || arrivalCompleted) return;
    try {
      document.cookie = `${ROOM_ARRIVAL_COMPLETE_COOKIE}=1; Path=/; SameSite=Lax`;
    } catch {}
    setArrivalCompleted(true);
  }, [arrivalCompleted, cardsReady, isHome, mode, power]);

  const clearCompletedArrival = useCallback(() => {
    setArrivalCompleted(false);
    try {
      document.cookie = `${ROOM_ARRIVAL_COMPLETE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    } catch {}
  }, []);

  /* Käivitus: sama lukustatud maalivaade → klaasid (faas 1) → sisu (faas 2).
     CSS lavastab faasid [data-power] atribuudi järgi. Käivitusega
     lõpeb ka kõnd LÕPLIKULT (mode → room): kerimisruum kaob ja vanu
     teekonnatekste ei saa kaartide all tagasi kerida (tellija 06.07). */
  const igniteOn = useCallback(() => {
    if (powerRef.current === "on" || powerRef.current === "igniting") return;
    if (reducedRef.current) {
      setPower("on");
      setCardsReady(true);
      setMode("room");
      return;
    }
    // Aeglane rituaal (tellija): klaasid faasis 1, tekstid faasis 2,
    // ja alles SIIS avaneb kerimine/klikkimine.
    // Alusta ALATI puhtalt: kaardi-sisu peidus ja vahepala maas, kuni
    // taimerid need õiges järjekorras avavad. Muidu jääks cardsReady
    // eelmisest tsüklist (või dev-HMR-ist) true → ikoonid ilmuks kohe
    // S-i peale (tellija 07.07).
    setCardsReady(false);
    setIntroSai(false);
    setPower("igniting");
    setMode("room");
    window.setTimeout(() => setPower("on"), 900);      // klaaskaardid (kestad) tekivad
    // Vahepala (tellija 06.07): SAI-monogramm mount'ib, teeb münt-pöörde
    // (SMIL 1.7 s, freeze), pööre SEISAB ja logo hoiab end veel ~2 s
    // liikumatuna; alles SIIS laeme kaartidele sisu — nii ei jõua kaardi-
    // ikoonid vahepalaga kattuda. Sujuv fade in/out elab CSS-is.
    // Viivitus pärast klaaside teket (900 ms) enne kui SAI-logo ilmub —
    // tellija 06.07: logo tekkis ON-vajutusest liiga kähku. Aken 3.3 s
    // (tellija 07.07: paigalseisu-hoidu kokku ~2 s lühemaks — S kaob
    // kohe pärast 3 s pööret).
    window.setTimeout(() => setIntroSai(true), 1900);
    window.setTimeout(() => setIntroSai(false), 5200);
    // Väike paus pärast logo kadumist enne kaardisisu (tellija 06.07)
    window.setTimeout(() => setCardsReady(true), 5900);
  }, []);


  /* Kiirkäskude riba "OFF": LOGI VÄLJA + seade tagasi ooterežiimi (⏻)
     (tellija 07.07: OFF = logout, sama mis profiili "Välja"). Kodus
     rakendub standby kohe; mujalt karussellilt naaseb koju ja maandub
     standby'sse (pendingStandby). */
  const powerOff = useCallback(() => {
    setAdminHub(false);
    setInfoHub(false);
    clearCompletedArrival();
    if (isAuthed) {
      signOut({ redirect: false }).catch(() => {});
    }
    if (!isHome) {
      pendingStandbyRef.current = true;
      router.push(localizePath("/", locale));
      return;
    }
    setPower("standby");
    setCardsReady(false);
    setIntroSai(false);
    if (standbyRef.current) {
      standbyRef.current.style.opacity = "";
      standbyRef.current.style.pointerEvents = "";
    }
    window.scrollTo(0, 0);
  }, [clearCompletedArrival, isHome, isAuthed, router, locale]);

  useEffect(() => {
    const root = document.documentElement;
    // Kaardi-lehel (pin/e-post) peab main jääma klikitavaks (paneeli
    // vorm elab seal), kuigi lava on room-seisus — eraldi html-olek.
    root.setAttribute("data-room-mode", cardPageKey ? "card" : mode);
    if (mode === "walk") {
      // Kõnd algab ALATI pimedusest (mitte brauseri taastatud
      // kerimiskohalt): iga laadimine on saabumine.
      try {
        window.history.scrollRestoration = "manual";
      } catch {}
      window.scrollTo(0, 0);
      displayed.current = target.current = 0;
      setPower("standby");
      applyScene(0);
      wake();
    } else {
      displayed.current = target.current = 1;
      applyScene(1);
      if (mode === "room") {
        window.scrollTo(0, 0);
        if (powerRef.current === "igniting") {
          // Käivituse rituaal käib (kõnni lõpust) — ära katkesta faase
        } else if (!pendingStandbyRef.current) {
          // Profiili-hub / sessioonisisene naasmine: seade on juba sees
          setPower("on");
          setCardsReady(true);
        }
        // pendingStandby ("Välja") rakendub allpool isHome-efektis —
        // room→room üleminekul see efekt uuesti ei jookse.
      }
      if (mode === "panel") {
        setPower("on");
        if (stageRef.current) {
          // CSS omab paneelirežiimi transformi (hägu + kerge suum)
          stageRef.current.style.transform = "";
          tiltCur.current = { x: 0, y: 0 };
          tiltTarget.current = { x: 0, y: 0 };
        }
      }
    }
    return () => {};
  }, [mode, cardPageKey, applyScene, wake]);

  /* "Välja" (profiilikaardilt) → kodu PUHKESEISUS. Elab pathname'i,
     mitte mode'i küljes: profiililt (room) koju (room) tulles mode ei
     muutu ja mode-efekt ei jookse. Nähtavuse annab CSS-reegel
     .room[data-mode="room"][data-power="standby"] .room-standby. */
  useEffect(() => {
    if (!isHome || !pendingStandbyRef.current) return;
    pendingStandbyRef.current = false;
    setPower("standby");
    setCardsReady(false);
    setIntroSai(false);
    if (standbyRef.current) {
      // Kustuta kõnni-aegne inline-jälg, et CSS-reegel kehtiks
      standbyRef.current.style.opacity = "";
      standbyRef.current.style.pointerEvents = "";
    }
    window.scrollTo(0, 0);
  }, [isHome]);

  /* ---------- loor (laadimisekraan) ----------
     Tellija otsus: loor püsib, kuni kasutaja ISE vajutab "Sisenen" —
     nupp ilmub pärast osakestest lause kujunemist. */
  useEffect(() => {
    if (!isHome || veil !== "shown" || veilReady) return undefined;
    let cancelled = false;
    const reduced = readReduced();
    /* Tavarežiimis ilmub SISENEN alles pärast osakestest lause
       kujunemist. Liikumist vähendavas režiimis ei sunnita kasutajat
       kunstilise lavastuse järel ootama. */
    const revealTimer = window.setTimeout(() => {
      if (!cancelled) setVeilReady(true);
    }, reduced ? 650 : 5200);
    return () => {
      cancelled = true;
      window.clearTimeout(revealTimer);
    };
  }, [isHome, veil, veilReady, readReduced]);

  const enterRoom = useCallback(() => {
    // Saabumine algab ALATI pimedusest — ka siis, kui brauser jõudis
    // vahepeal vana kerimiskoha taastada.
    window.scrollTo(0, 0);
    target.current = 0;
    displayed.current = 0;
    applyScene(0);
    setVeil("fading");
    // Esmalt hajub jaluse logo (420 ms), seejärel loor ise (900 ms).
    window.setTimeout(() => setVeil("gone"), 1320);
  }, [applyScene]);

  /* Loori all ei saa kerida (kõnd algab alles sisenemisel) */
  useEffect(() => {
    if (!isHome) return undefined;
    const root = document.documentElement;
    if (veil !== "gone") {
      const prev = root.style.overflow;
      root.style.overflow = "hidden";
      return () => {
        root.style.overflow = prev;
      };
    }
    return undefined;
  }, [isHome, veil]);

  /* ---------- vahelejätt (klahv viib lõppseisu) ----------
     Tellija 06.07: kogemata hiireklõps EI tohi kõndi läbi kerida —
     vahelejätuks on selgesõnaline "Jäta vahele" nupp (room-skip) ja
     klaviatuur. Aknataseme klikipüüdjat enam ei ole. */
  const skipToEnd = useCallback(() => {
    if (modeRef.current !== "walk") return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    lerpK.current = LERP_SKIP;
    window.scrollTo({ top: max, behavior: "auto" });
    target.current = 1;
    wake();
  }, [wake]);

  useEffect(() => {
    if (mode !== "walk") return undefined;
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) return;
      if (["Enter", " ", "End", "Escape"].includes(e.key)) {
        if (displayed.current < 0.985) {
          e.preventDefault();
          skipToEnd();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [mode, skipToEnd]);

  /* ---------- kursorikalle (ainult lõppseisus, mitte puutel) ---------- */
  useEffect(() => {
    if (mode !== "room") return undefined;
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia?.("(pointer: coarse)").matches) return undefined;
    const onMove = (e) => {
      if (reducedRef.current) return;
      tiltTarget.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
      wake();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mode, wake]);

  useEffect(() => () => rafId.current && cancelAnimationFrame(rafId.current), []);

  /* Karussell on klaviatuurile/fookusele avatud alles siis, kui
     käivituse MÕLEMAD faasid on läbi (tellija: enne ei saa kerida) */
  useEffect(() => {
    const el = carouselWrapRef.current;
    if (!el) return;
    const open = power === "on" && cardsReady;
    if (el.inert !== !open) el.inert = !open;
  }, [power, cardsReady, mode]);

  /* Brauseri enda kerimistaastus välja — saabumine juhib ise. */
  useEffect(() => {
    try {
      window.history.scrollRestoration = "manual";
    } catch {}
  }, []);

  /* ---------- ülariba: väljast-klõps / Esc sulgeb ---------- */
  useEffect(() => {
    if (!topbarOpen) return undefined;
    const onDown = (e) => {
      if (!topbarRef.current?.contains(e.target)) setTopbarOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setTopbarOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [topbarOpen]);
  /* Marsruudivahetusel (karussell elab kõigi lehtede taga) sulge riba */
  useEffect(() => {
    setTopbarOpen(false);
  }, [pathname]);

  /* /toolaud on sisselogitu pind: väljalogitult (või pärast "Välja")
     naaseb ruum avalehele, kus avalik komplekt pakub "Logi sisse".
     replace, mitte push — väljalogitud töölaud ei jää ajalukku. */
  useEffect(() => {
    if (!isWorkspaceRoute || status !== "unauthenticated") return;
    router.replace(localizePath("/", locale));
  }, [isWorkspaceRoute, status, router, locale]);

  /* Jäta viimane karusselli-HUBI marsruut meelde: PanelFrame'i sulgemisrist
     naaseb sinna, kust paneel avati (töölaualt avatud leht → töölauale,
     mitte avalehele). Kaardi-lehti (/ruum, /uuenda-pin) ei salvestata —
     vt lib/roomHubReturn.js. */
  useEffect(() => {
    if (isHome) rememberRoomHubPath("/");
    else if (isWellbeingRoute) rememberRoomHubPath("/toolaud/tooheaolu");
    else if (isKovisionRoute) rememberRoomHubPath("/toolaud/kovisioon");
    else if (isWorkspaceRoute) rememberRoomHubPath("/toolaud");
    else if (isProfileHub) rememberRoomHubPath("/profiil");
  }, [isHome, isWorkspaceRoute, isWellbeingRoute, isKovisionRoute, isProfileHub]);

  /* ---------- login-modali kest ---------- */
  useEffect(() => {
    const root = document.documentElement;
    document.body.classList.toggle("modal-open", isLoginOpen);
    root.classList.toggle("modal-open", isLoginOpen);
    return () => {
      document.body.classList.remove("modal-open");
      root.classList.remove("modal-open");
    };
  }, [isLoginOpen]);

  /* ---------- karusselli komplektid ---------- */
  const publicItems = useMemo(
    () => [
      { key: "voimalused", label: t("about.links.features"), href: "/voimalused", icon: <SparkleIcon /> },
      { key: "juhend", label: t("about.guide.jump_link"), href: "/kasutusjuhend", icon: <GuideBookIcon /> },
      { key: "login", label: t("nav.login"), action: "login", icon: <LoginKeyIcon /> },
      { key: "tingimused", label: t("about.links.terms"), href: "/kasutustingimused", icon: <TermsDocIcon /> },
      { key: "privaatsus", label: t("about.links.privacy"), href: "/privaatsustingimused", icon: <PrivacyShieldIcon /> },
      { key: "hinnastus", label: t("about.links.pricing"), href: "/hinnastus", icon: <PricingTagIcon /> },
      { key: "paigalda", label: t("room.install_card"), action: "paigalda", icon: <InstallIcon /> },
      { key: "kontakt", label: t("about.contact.title"), action: "kontakt", icon: <ContactMailIcon /> },
      { key: "meist", label: t("meist.title"), href: "/meist", icon: <AboutInfoIcon /> },
    ],
    [t]
  );

  /* "Teave" alamkomplekt (profiililt): kõik avalikud infokaardid
     sisselogitule ühe kaardi all (tellija 06.07 öö) */
  const teaveItems = useMemo(
    () => [
      { key: "meist", label: t("meist.title"), href: "/meist", icon: <AboutInfoIcon /> },
      { key: "juhend", label: t("about.guide.jump_link"), href: "/kasutusjuhend", icon: <GuideBookIcon /> },
      { key: "voimalused", label: t("about.links.features"), href: "/voimalused", icon: <SparkleIcon /> },
      { key: "tingimused", label: t("about.links.terms"), href: "/kasutustingimused", icon: <TermsDocIcon /> },
      { key: "privaatsus", label: t("about.links.privacy"), href: "/privaatsustingimused", icon: <PrivacyShieldIcon /> },
      { key: "hinnastus", label: t("about.links.pricing"), href: "/hinnastus", icon: <PricingTagIcon /> },
      { key: "paigalda", label: t("room.install_card"), action: "paigalda", icon: <InstallIcon /> },
      { key: "kontakt", label: t("about.contact.title"), action: "kontakt", icon: <ContactMailIcon /> },
      { key: "raamleping", label: t("room.framework_card"), href: "/tooalase-kasutuse-raamistik", icon: <AcceptShieldIcon /> },
      { key: "tagasi", label: t("room.back_card"), action: "teave-tagasi", icon: <BackArrowIcon /> },
    ],
    [t]
  );
  const workItems = useMemo(() => {
    const items = [
      {
        key: "ruumid",
        label: t("nav.rooms"),
        href: "/ruum",
        icon: <RoomsCardIcon />,
        // Ootel-kutse märge RUUMID kaardil (omanik 23.07).
        badge: hasPendingInvite ? t("pendingInvite.badge") : null
      },
      { key: "toolaud", label: t("nav.workspace"), href: "/toolaud", icon: <WorkspaceCardIcon /> },
      { key: "vestlus", label: t("nav.chat"), href: "/vestlus", icon: <ChatCardIcon /> },
      { key: "profiil", label: t("nav.profile"), href: "/profiil", icon: <ProfileCardIcon /> },
    ];
    if (isAdmin) {
      items.push({ key: "haldus", label: t("room.admin_card"), action: "haldus", icon: <AdminSlidersIcon /> });
    }
    return items;
  }, [t, isAdmin, hasPendingInvite]);

  /* Töölaua komplekt — rollipõhine (vt HinnastusBody rolliväravad +
     workspaceDashboardCards ajalugu). Tavakasutaja näeb oma rolli kaarte;
     admin vahetab vaadet doki S/P/T-lülitiga (effectiveRole). Süvalingid
     avavad tööriista vestluspinnal (/vestlus?workspace=<võti>). */
  const workspaceItems = useMemo(() => {
    const role = String(effectiveRole || "CLIENT").toUpperCase();
    const isClient = role === "CLIENT";
    const ALL = "CLIENT SOCIAL_WORKER SERVICE_PROVIDER".split(" ");
    const SPECIALIST = ["SOCIAL_WORKER", "SERVICE_PROVIDER"];
    const all = [
      { key: "teekond", roles: ["CLIENT"], label: t("chat.workspace.cards.journey.title", "Teekond"), href: "/vestlus?workspace=journey", icon: <JourneyPathIcon /> },
      { key: "teenusekaart", roles: ALL, label: t("chat.workspace.cards.service_map.title", "Teenusekaart"), href: "/teenusekaart", icon: <ServiceMapIcon /> },
      { key: "otsi", roles: ALL, label: t("personal_search.title", "Minu otsing"), href: "/otsi", icon: <SearchIcon /> },
      { key: "abisoovid", roles: ALL, label: t("chat.workspace.cards.help_requests.title", "Abisoovid"), href: "/vestlus?workspace=help_requests", icon: <HelpRequestIcon /> },
      { key: "abipakkumised", roles: ALL, label: t("chat.workspace.cards.help_offers.title", "Abipakkumised"), href: "/vestlus?workspace=help_offers", icon: <HelpOfferIcon /> },
      { key: "poordumised", roles: ALL, label: isClient ? t("chat.workspace.cards.pre_inquiries.title_client", "Eelpöördumine") : t("chat.workspace.cards.pre_inquiries.title_staff", "Pöördumised"), href: "/vestlus?workspace=pre_inquiries", icon: <InquiryIcon /> },
      { key: "koosta", roles: ALL, label: t("chat.workspace.cards.document_drafting.title", "Koosta dokument"), href: "/vestlus?workspace=document_drafting", icon: <ComposeDocIcon /> },
      { key: "lisa", roles: ALL, label: t("chat.workspace.cards.add_person.title", "Kutsu osaleja"), href: "/vestlus?workspace=invite", icon: <InvitePersonIcon /> },
      { key: "dokumendid", roles: SPECIALIST, label: t("chat.workspace.cards.documents.title", "Dokumendid"), href: "/vestlus?workspace=documents", icon: <DocumentsIcon /> },
      { key: "materjalid", roles: SPECIALIST, label: t("chat.workspace.cards.materials.title", "Materjalid"), href: "/vestlus?workspace=materials", icon: <MaterialsIcon /> },
      { key: "teenuseprofiil", roles: ["SERVICE_PROVIDER"], label: t("chat.workspace.cards.service_profile.title", "Teenuseprofiil"), href: "/teenuseprofiil", icon: <ServiceProfileIcon /> },
      { key: "supervisioon", roles: SPECIALIST, label: t("supervision.meta.title", "Supervisioon"), href: "/supervisioon", icon: <SupervisionIcon /> },
      { key: "mentorlus", roles: SPECIALIST, label: t("chat.workspace.cards.mentoring.title", "Mentorlus"), href: "/mentorlus", icon: <MentorIcon /> },
      { key: "valitoo", roles: SPECIALIST, label: t("field.meta.title", "Välitöö"), href: "/valitoo", icon: <FieldIcon /> },
      { key: "kovisioon", roles: ["SOCIAL_WORKER"], label: t("chat.workspace.cards.kovision.title", "Kovisioon"), href: "/toolaud/kovisioon", icon: <KovisionIcon /> },
      { key: "tooheaolu", roles: ["SOCIAL_WORKER"], label: t("chat.workspace.cards.wellbeing.title", "Tööheaolu"), href: "/toolaud/tooheaolu", icon: <WellbeingIcon /> },
      { key: "refleksioon", roles: ["SOCIAL_WORKER"], label: t("reflection.meta.title", "Meetodipeegel"), href: "/refleksioon", icon: <ReflectionIcon /> },
    ];
    const cards = all.filter((card) => card.roles.includes(role));
    cards.push({ key: "tagasi", label: t("room.back_card"), action: "toolaud-tagasi", icon: <BackArrowIcon /> });
    return cards;
  }, [t, effectiveRole]);

  /* Tööheaolu komplekt — tööriistad otse marsruutidele */
  const wellbeingItems = useMemo(
    () => [
      ...wellbeingTools.map((tool) => ({
        key: tool.id,
        label: tool.title,
        href: tool.route,
        icon: <WellbeingIcon />,
      })),
      { key: "tagasi", label: t("room.back_card"), action: "tooheaolu-tagasi", icon: <BackArrowIcon /> },
    ],
    [t]
  );

  /* Kovisiooni komplekt — töövoo päris põhilehed + tagasi. */
  const kovisionItems = useMemo(
    () => [
      { key: "ruum", label: t("room.kovision_room_card", "Kovisiooni ruum"), href: "/kovisioon", icon: <KovisionRoomIcon /> },
      { key: "teemaseemned", label: t("room.kovision_seeds_card", "Teemaseemned"), href: "/teemaseemned", icon: <TopicSeedIcon /> },
      { key: "lopetatud", label: t("room.kovision_completed_card", "Lõpetatud juhtumid"), href: "/lopetatud-juhtumid", icon: <DocumentsIcon /> },
      {
        key: "praktikad",
        label: t("room.kovision_practices_card", "Parimad praktikad"),
        href: "/parimad-praktikad",
        icon: <BestPracticeIcon />,
      },
      { key: "tagasi", label: t("room.back_card"), action: "kovisioon-tagasi", icon: <BackArrowIcon /> },
    ],
    [t]
  );

  /* Halduse alamkomplekt — avaneb "Haldus" kaardilt, "Tagasi" viib
     peakomplekti (sama muster mis profiili "Tagasi") */
  const adminItems = useMemo(
    () => [
      { key: "analytics", label: t("room.admin_analytics"), href: "/admin/analytics", icon: <AnalyticsIcon /> },
      { key: "rag", label: t("room.admin_rag"), href: "/admin/rag", icon: <RagDbIcon /> },
      { key: "service-availability", label: t("room.admin_service_availability"), href: "/admin/service-availability", icon: <ServiceMapIcon /> },
      { key: "kinnitused", label: t("room.admin_acceptances"), href: "/admin/framework-acceptances", icon: <AcceptShieldIcon /> },
      { key: "tagasi", label: t("room.back_card"), action: "haldus-tagasi", icon: <BackArrowIcon /> },
    ],
    [t]
  );

  /* Profiili sektsioonikaardid — sildid rakenduse i18n-ist.
     "Tagasi" kaart asendab nurga-× (tellija 06.07); "Välja" = puhkeseis. */
  const profileItems = useMemo(
    () => [
      { key: "keel", label: t("profile.preferences.title"), action: "a11y", icon: <LanguageAccessIcon /> },
      { key: "epost", label: t("profile.update_email_cta"), href: "/uuenda-epost", icon: <ContactMailIcon /> },
      { key: "konto", label: t("profile.account_settings"), href: "/profiil?sektsioon=konto", icon: <AccountGearIcon /> },
      { key: "pin", label: t("profile.change_password_cta"), href: "/uuenda-pin", icon: <PinLockIcon /> },
      { key: "kasutus", label: t("profile.usage.title"), href: "/profiil?sektsioon=kasutus", icon: <AnalyticsIcon /> },
      { key: "tellimus", label: t("profile.manage_subscription"), href: "/tellimus", icon: <SubscriptionEuroIcon /> },
      { key: "teave", label: t("room.info_card"), action: "teave", icon: <AboutInfoIcon /> },
      { key: "valja", label: t("room.exit_card"), action: "valja", icon: <PowerIcon /> },
      { key: "tagasi", label: t("room.back_card"), action: "tagasi", icon: <BackArrowIcon /> },
    ],
    [t]
  );

  const isProfileContext = isProfileHub || isProfileCardPage;
  /* Haldus jääb olekuks (avalehe alamkomplekt) — marsruut võidab oleku, et
     /toolaud näitaks alati töölauda, ka siis kui haldus jäi lahti. */
  const isAdminHub = adminHub && isAdmin && !isProfileContext && !isWorkspaceRoute;
  const isInfoHub = infoHub && isProfileHub;
  const isWorkspaceHub = isWorkspaceRoute && isAuthed;
  const isWellbeingHub = isWellbeingRoute && isWorkspaceHub;
  const isKovisionHub = isKovisionRoute && isWorkspaceHub;
  const carouselSet = isProfileContext
    ? isInfoHub
      ? "info"
      : "profile"
    : isAdminHub
      ? "admin"
      : isWellbeingHub
        ? "wellbeing"
        : isKovisionHub
          ? "kovision"
          : isWorkspaceHub
            ? "workspace"
            : isAuthed
              ? "work"
              : "public";
  const carouselItems = isProfileContext
    ? isInfoHub
      ? teaveItems
      : profileItems
    : isAdminHub
      ? adminItems
      : isWellbeingHub
        ? wellbeingItems
        : isKovisionHub
          ? kovisionItems
          : isWorkspaceHub
            ? workspaceItems
            : isAuthed
              ? workItems
              : publicItems;
  /* Tagasi ei ole enam karussellikaart. Eraldame selle ühe läbimisega
     püsivaks alumise riba otseteeks; kaardiloend jääb puhas ja grid ei
     reserveeri Tagasi jaoks kohta. */
  const { carouselCards, carouselBackItem } = useMemo(() => {
    let backItem = null;
    const cards = [];
    carouselItems.forEach((item) => {
      if (item.key === "tagasi") backItem = item;
      else cards.push(item);
    });
    return { carouselCards: cards, carouselBackItem: backItem };
  }, [carouselItems]);
  const initialKey =
    cardPageKey ||
    (isProfileHub
      ? isInfoHub
        ? "meist"
        : "pin"
      : isAdminHub
        ? "rag"
        : isWellbeingHub
          ? "quick-check"
        : isKovisionHub
          ? "ruum"
          : isWorkspaceHub
              ? "teekond"
              : isAuthed
                ? "vestlus"
                : "login");

  const handleSelect = useCallback(
    (item) => {
      if (item.action === "login") {
        /* Esmakülastaja a11y-modal võib olla lahti (auto-avanev
           keelevalik) — sulge enne, muidu kaks akent virnas */
        a11y?.closeModal?.();
        setIsLoginOpen(true);
        return;
      }
      if (item.action === "a11y") {
        a11y?.openModal?.();
        return;
      }
      if (item.action === "kontakt" || item.action === "paigalda") {
        a11y?.closeModal?.();
        setOpenInfoModal(item.action);
        return;
      }
      if (item.action === "valja") {
        // "Välja" = LOGI VÄLJA + seade puhkeseisu (tellija 06.07 öö;
        // tühistab varasema "OFF ≠ logout" otsuse): ⏻ vajutusel avaneb
        // AVALIK komplekt, keskel "Logi sisse".
        pendingStandbyRef.current = true;
        setAdminHub(false);
        setInfoHub(false);
        clearCompletedArrival();
        signOut({ redirect: false }).catch(() => {});
        router.push(localizePath("/", locale));
        return;
      }
      if (item.action === "tagasi") {
        // "Tagasi" profiililt = peavaliku kaardid (seade jääb sisse)
        setAdminHub(false);
        setInfoHub(false);
        router.push(localizePath("/", locale));
        return;
      }
      if (item.action === "haldus") {
        setAdminHub(true);
        return;
      }
      if (item.action === "haldus-tagasi") {
        setAdminHub(false);
        return;
      }
      /* Töölaud ja selle alamkomplektid on marsruudid → "Tagasi" on
         navigatsioon, mitte oleku nullimine (omanik 21.07). */
      if (item.action === "toolaud-tagasi") {
        router.push(localizePath("/", locale));
        return;
      }
      if (item.action === "tooheaolu-tagasi" || item.action === "kovisioon-tagasi") {
        router.push(localizePath("/toolaud", locale));
        return;
      }
      if (item.action === "teave") {
        setInfoHub(true);
        return;
      }
      if (item.action === "teave-tagasi") {
        setInfoHub(false);
        return;
      }
      if (item.href) {
        router.push(localizePath(item.href, locale));
      }
    },
    [router, locale, a11y, clearCompletedArrival]
  );

  const showCarouselUi = isCarouselRoute;
  /* Avastseeni/kõnni ajal jäävad kasutusse alumised heli- ja
     vahelejätmisjuhikud. Püsiv ülariba ilmub alles töötavas ruumis:
     karussellis pärast käivitust, paneelidel kohe. */
  const showQuickbar =
    !isLoginOpen &&
    (mode === "panel" || (mode === "room" && power === "on" && cardsReady));

  return (
    <>
      <div
        className="room"
        data-mode={mode}
        data-veil={veil}
        data-power={power}
        data-walk-done={walkDone ? "1" : "0"}
        data-login-open={isLoginOpen ? "1" : "0"}
        data-info-open={openInfoModal ? "1" : "0"}
        data-a11y-open={a11y?.isModalOpen ? "1" : "0"}
        data-card-page={cardPageKey ? "1" : "0"}
        data-cards-ready={cardsReady ? "1" : "0"}
      >
      {/* Ootel-kutse teade — kuulub hub'i (omanik 23.07): ilmub kui kaardid
          on valmis (power on + cardsReady), MITTE eellaadimisstseeni ajal,
          ja z-index (85) on laadimisloori (80) kohal. AINULT hub-karussellil
          (isCarouselRoute + mitte kaardileht) — nii ei kata see /join ega
          muude lehtede sisu (omanik 23.07). */}
      {isAuthed && hasPendingInvite && !isLoginOpen && power === "on" && cardsReady && isCarouselRoute && !cardPageKey ? (
        <PendingInviteBanner
          invite={pendingInvite}
          needsVerify={pendingNeedsVerify}
          sessionEmail={session?.user?.email || ""}
        />
      ) : null}
      {/* Lavastus: rahulik tume taust ilma tähistaevata */}
      <div className="room-stage" ref={stageRef} aria-hidden="true">
        <div className="room-vignette" />
        <div className="room-dim" />
      </div>
      <div className="grain-veil" aria-hidden="true" />

      {showCarouselUi ? (
        <>
          {isHome ? (
            <>
              {/* Tekstipeatused — üks kompaktne keskne fookusplokk korraga;
                  sisuline tekst on lehel sr-only. */}
              <div className="room-texts" aria-hidden="true" data-room-ui>
                {TEXT_STOPS.map((stop, i) => (
                  <JourneyText
                    key={stop.keys.join("-")}
                    position="center"
                    data-stop={`stop-${i + 1}`}
                    ref={(el) => {
                      textRefs.current[i] = el;
                    }}
                  >
                    {stop.keys.map((key) => (
                      <span className="room-text-line" key={key}>
                        {t(`room.${key}`)}
                      </span>
                    ))}
                  </JourneyText>
                ))}
              </div>

              {/* Kerimisvihje: peen joon + libisev täpp + mikrosilt */}
              <div className="room-hint" ref={hintRef} aria-hidden="true">
                <span className="room-hint-track">
                  <span className="room-hint-dot" />
                </span>
                <span className="room-hint-label">{t("room.scroll_label")}</span>
              </div>

              {/* Vahelejätt */}
              <GlassButton
                layoutClassName="room-skip"
                data-room-ui
                ref={skipRef}
                onClick={skipToEnd}
                hidden={mode !== "walk"}
              >
                {t("room.skip")}
              </GlassButton>

              {/* Taustaheli juhtnupud elavad KÕNNIS "ukse peal" (tellija
                  07.07: muusika algab uksekaadrist, mitte loorilt):
                  vaigista/taasta + järgmine lugu. Meloodiavalik ka Keel ja
                  ligipääsetavus modalis. soundRef hajutab klastri kõnni
                  lõpus (p ≥ 0.94). */}
              <div
                className="room-walk-audio"
                data-room-ui
                ref={soundRef}
                hidden={mode !== "walk"}
              >
                <IconButton
                  layoutClassName="room-walk-sound"
                  aria-label={t(ambientOn ? "room.sound_off" : "room.sound_on")}
                  aria-pressed={ambientOn}
                  data-on={ambientOn ? "1" : "0"}
                  onClick={toggleAmbient}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4.6 9.4v5.2h3.2l4.6 3.8V5.6L7.8 9.4H4.6Z" />
                    {ambientOn ? (
                      <>
                        <path d="M15.6 9.2a4 4 0 0 1 0 5.6" />
                        <path d="M18 6.8a7.4 7.4 0 0 1 0 10.4" />
                      </>
                    ) : (
                      <path d="m15.4 9.6 4.8 4.8m0-4.8-4.8 4.8" />
                    )}
                  </svg>
                </IconButton>
                {ambientOn ? (
                  <IconButton
                    layoutClassName="room-walk-next"
                    aria-label={t("room.sound_next")}
                    onClick={nextAmbient}
                  >
                    {/* Järgmine lugu — skip-forward (kolmnurk + latt), MITTE
                        paljas play-kolmnurk; latt ja aria-label eristavad. */}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 6.5 15 12 7 17.5V6.5Z" />
                      <path d="M17.5 6.6v10.8" />
                    </svg>
                  </IconButton>
                ) : null}
              </div>

              {/* OOTEREŽIIM: toitelüliti ÜLEVAL, tekst selle ALL (tellija),
                  ilma klaasita ja ilma kumata. Ilma logout-linkita (tellija 06.07). */}
              <div className="room-standby" ref={standbyRef} data-room-ui>
                <IconButton
                  layoutClassName="room-power"
                  aria-label={t("room.power_on")}
                  onClick={igniteOn}
                >
                  <PowerIcon />
                </IconButton>
                <p className="room-standby-line">{t("room.standby_connect")}</p>
              </div>
            </>
          ) : null}
          {/* Ekraninurga sulgemisristi EI OLE üheski karusselliseisus
              (tellija 06.07): profiililt viib "Tagasi" kaart, kaardi-lehe
              (pin/e-post) sulgeb kaardisisene × + Esc (PanelFrame). */}

          {/* Karussell — süttib käivitusega (faas 1 klaasid, faas 2 sisu).
              Väljalülitus elab profiilikarusselli "Välja" kaardil (tellija);
              nurga-⏻ eemaldatud. */}
          <div className="room-carousel-wrap" ref={carouselWrapRef} data-room-ui>
            <GlassCarousel
              key={carouselSet}
              items={carouselCards}
              backItem={carouselBackItem}
              initialKey={initialKey}
              setKey={carouselSet}
              forceInitial={
                !!cardPageKey || carouselSet === "workspace" || carouselSet === "wellbeing"
              }
              onSelect={handleSelect}
              onRoleChanged={refreshEffectiveRole}
              t={t}
              /* Töölaud ja tööheaolu: rollipõhine keritav ruudustik.
                 Küljenooled jäävad alles ja kerivad lehe kaupa (omanik 21.07). */
              grid={carouselSet === "workspace" || carouselSet === "wellbeing"}
            />
          </div>

          {/* Käivituse vahepala (tellija 07.07): AINULT valge S keskel, mis
              teeb ÜHE aeglase täispöörde (SMIL, v-metalbase.svg). Metallik-AI
              on siit EEMALDATUD — S pöörleb üksi, ilma AI-ta. (Alus-SVG AI on
              nagunii fill="none", nii et jääb nähtamatuks.) */}
          {introSai ? (
            <div className="room-intro-sai" aria-hidden="true">
              <div className="room-intro-sai-mono">
                {/* eslint-disable-next-line @next/next/no-img-element -- staatiline SVG SMIL-animatsiooniga; next/image ei lisa midagi */}
                <img
                  key="intro-sai"
                  src="/logo/sotsiaalai-v-metalbase.svg"
                  alt=""
                  width={140}
                  height={328}
                  decoding="async"
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Laadimisloor — ootab kasutaja sisenemist. Logo alaservas:
          UUS sõnamärk (Exo 2 + originaal-AI, tellija 07.07); "AI" saab
          MetallicPaint kihi AI enda kastis (ai-mark.svg + CSS-piirkond
          .room-veil-logo-metal) — voolamisväli nagu kinnitatud näidisel. */}
      <div
        className="room-veil"
        data-state={veil}
        data-logo-ready={veilLogoReady ? "1" : "0"}
        role="dialog"
        aria-modal={veil !== "gone" ? "true" : undefined}
        aria-labelledby="room-veil-message"
        aria-hidden={veil === "gone"}
      >
        {/* „Selguse väli“: hajus info koguneb lauseks ja muutub kasutaja
            kutsel läveks. Kunstikiht ei püüa sündmusi; päris tekst ja
            nupp jäävad selle kohal ligipääsetavaks. */}
        {veil !== "gone" ? <VeilArt effect={VEIL_EFFECTS.DIRECT} /> : null}
        <div
          className="room-veil-logo"
          /* Critical pre-CSS guard: SSR must never expose the default canvas
             rectangle while the stylesheet and WebGL texture are loading. */
          style={veilLogoReady ? undefined : { opacity: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG sõnamärk ref/complete-loogikaga; next/image lõhuks laadimisvärava */}
          <img
            ref={image => {
              // Cached SVG can already be complete before React receives onLoad.
              // In that case mark it ready immediately, while the parent stays
              // fully transparent until the metallic canvas is ready as well.
              if (image?.complete && image.naturalWidth > 0) {
                setVeilWordmarkReady(true);
              }
            }}
            src="/logo/sotsiaalai-h-valge.svg"
            alt="SotsiaalAI"
            width={264}
            height={50}
            decoding="async"
            onLoad={() => setVeilWordmarkReady(true)}
          />
          {veil !== "gone" ? (
            <div className="room-veil-logo-metal" aria-hidden="true">
              {/* Tähed = platina (jahe hõbe-valge põhitoon: light/dark);
                  liikuv sära = šampanja/kuld (tintColor) — tellija 06.07.
                  chromaticSpread ~0: RGB-kanalite lahknemine tegi ROHELISI
                  servi; blur/sharpness/noise pehmemaks (sujuvam helk).
                  Kogu sõnamärk püsib LÄBIPAISTEV, kuni metall on renderdatud;
                  seejärel ilmuvad SVG ja metall ühe tervikuna. */}
              <MetallicPaint
                imageSrc="/logo/ai-mark.svg"
                onReady={() => setVeilMetalReady(true)}
                seed={7}
                scale={3}
                speed={0.11}
                brightness={1.42}
                contrast={0.6}
                liquid={0.38}
                waveAmplitude={0.65}
                refraction={0.012}
                chromaticSpread={0}
                blur={0.026}
                patternSharpness={0.55}
                noiseScale={0.3}
                distortion={0.55}
                lightColor="#e5e2db"
                darkColor="#464a55"
                tintColor="#e6d3c0"
                tintPulse={0.6}
                radial={3.5}
                preserveDrawingBuffer
              />
            </div>
          ) : null}
        </div>
        <p id="room-veil-message" className="room-veil-line">
          {/* Iga sõna oma span'is: töölaual voolavad inline ühte ritta,
              mobiilis muutuvad plokk-ridadeks (keskmine nihkes) ja
              VeilArt-sampler joonistab osakesed sõnakastide järgi. */}
          {t("room.loading_line")
            .split(/\s+/)
            .filter(Boolean)
            .flatMap((word, index) => [
              index > 0 ? " " : null,
              <span key={`${index}-${word}`} className="room-veil-word">
                {word}
              </span>,
            ])}
        </p>
        <GlassButton
          layoutClassName="room-veil-enter"
          data-ready={veilReady ? "1" : "0"}
          disabled={!veilReady}
          onClick={enterRoom}
        >
          {t("room.enter")}
        </GlassButton>
        {/* Taustaheli lüliti kolis kõnni uksekaadrisse (tellija 07.07) */}
      </div>

      {isLoginOpen ? (
        <LoginModal
          open={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          suppressRedirect
          onAuthSuccess={() => setIsLoginOpen(false)}
        />
      ) : null}

      {/* Kontakt — olemasolev info klaaskaardis */}
      <GlassModal
        open={openInfoModal === "kontakt"}
        onClose={() => setOpenInfoModal(null)}
        title={t("about.contact.title")}
        closeLabel={t("room.close_panel")}
      >
        <p>{t("about.contact.company")}</p>
        <p>{t("about.contact.registry_value")}</p>
        <p>{t("about.contact.address_value")}</p>
        <p>
          <a href={`mailto:${t("about.contact.email_value")}`}>
            {t("about.contact.email_value")}
          </a>
        </p>
      </GlassModal>

      {/* Paigalda — olemasolev PWA-juhis klaaskaardis */}
      <GlassModal
        open={openInfoModal === "paigalda"}
        onClose={() => setOpenInfoModal(null)}
        title={t("room.install_card")}
        closeLabel={t("room.close_panel")}
      >
        <InstallAppLink />
      </GlassModal>
      </div>
      <RoomQuickbar
        ambientOn={ambientOn}
        containerRef={topbarRef}
        onNextAmbient={nextAmbient}
        onOpenAccessibility={() => a11y?.openModal?.()}
        onPowerOff={powerOff}
        onToggleAmbient={toggleAmbient}
        onToggleOpen={() => setTopbarOpen((value) => !value)}
        open={topbarOpen}
        t={t}
        visible={showQuickbar}
      />
    </>
  );
}
