"use client";

/**
 * RoomStage — hämarikuruumi lavastus (visuaalne brief v1.1).
 *
 * Elab root-layoutis KÕIGI marsruutide taga, et navigeerimine ei
 * laadiks ruumi uuesti. Kolm režiimi (html[data-room-mode]):
 *  - "walk"  — avaleht, saabumiskõnd: kerimine juhib kaadreid 1→6→7
 *  - "room"  — avaleht, lõppseis: kaader 7 + karussell (+ mikroelu)
 *  - "panel" — iga muu marsruut: kaader 7 hämardatuna paneeli taga
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
} from "@/components/brand/icons/CardIcons";
import { ROOM_FRAMES, ROOM_FRAME_WIDTH, ROOM_FRAME_HEIGHT } from "@/lib/room-frames";
import GlassCarousel from "@/components/room/GlassCarousel";
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

/* Tellija otsus: saabumiskõnd toimub IGAL platvormi laadimisel —
 * mitte mingit "olen näinud" salvestust. Ainult sama laadimise sees
 * (paneeli avamine ja sulgemine) kõndi ei korrata. */
let walkDoneThisLoad = false;

/* Kaadrisegmendid: [algus, lõpp, suumAlgus, suumLõpp] progressi teljel.
   Tellija 06.07: kaadrivahetused SUJUVAMAD (tõksud maha) — ülekate
   ~19% segmendist, sisenev kaader settib madalamalt (1.035), haripunktis
   õrn fookus-blur. Kaader 7 EI kuulu kõndi — süttib käivitusega (⏻). */
const SEGS = [
  [0.0, 0.185, 1.0, 1.78], // 1 — ukseava: piidad servadest välja
  [0.185, 0.36, 1.0, 1.1], // 2 — ruum avaneb
  [0.36, 0.54, 1.0, 1.1], // 3 — kõnd
  [0.54, 0.72, 1.0, 1.1], // 4 — tool suurelt ees
  [0.72, 0.86, 1.0, 1.09], // 5 — tooli juures
  [0.86, 1.0, 1.05, 1.0], // 6 — istun: settimine; lõpus TERAV ruum
];
const BLEND = 0.034; // ~19% segmendist — pikem, pehmem ristsulandus
const SIT_BLEND = 0.045; // 5→6 pööre veel veidi pikem
const ENTER_SCALE = 1.035; // sisenev kaader settib segmendi algusesse
const BLEND_BLUR_PX = 5; // fookus-blur sulanduse haripunktis
const STANDBY_FROM = 0.958; // ooterežiimi elemendid pärast kaadri 6 teksti

/* Tekstipeatused (sotsiaalai-teekonna-tekstid.md sõnastused; tellija
   06.07 õhtu korrektuurid: kaadripaarid KOOS ühes mullis (pikem
   ekraaniaeg), tervitus KESKEL, küljed sissepoole toodud). */
/* Mitmelauseline peatus = ERALDI mullid, üks vasakul ja teine paremal
   (tellija 07.07); mõlemad kuvatakse samal ajal. Kohad on CSS-is
   data-stop kaupa (room.css: kaadripõhine häälestus). */
const TEXT_STOPS = [
  { keys: ["walk_1"], sides: ["left"], from: 0.035, to: 0.165 },
  { keys: ["walk_2a", "walk_2b"], sides: ["center", "right"], from: 0.2, to: 0.35 },
  { keys: ["walk_3a", "walk_3b"], sides: ["right", "left"], from: 0.372, to: 0.528 },
  { keys: ["walk_4a", "walk_4b"], sides: ["left", "right"], from: 0.552, to: 0.708 },
  { keys: ["walk_5a", "walk_5b"], sides: ["left", "right"], from: 0.732, to: 0.85 },
  { keys: ["walk_6"], sides: ["center"], from: 0.875, to: 0.945 },
];
/* Lame mullide loend: iga lause = oma mull oma kohaga (data-stop=võti) */
const WALK_BUBBLES = TEXT_STOPS.flatMap((stop) =>
  stop.keys.map((key, j) => ({
    key,
    side: stop.sides[j],
    from: stop.from,
    to: stop.to,
  }))
);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t) => t * t * (3 - 2 * t); // smoothstep
const seglerp = (a, b, t) => a + (b - a) * t;

/* Sulanduse aken kaadri i ja i+1 vahel → järgmise kihi opacity. */
function blendAmount(i, p) {
  const boundary = SEGS[i][1];
  const w = i === 4 ? SIT_BLEND : BLEND;
  return ease(clamp01((p - (boundary - w)) / w));
}

/* Kaadri suum: oma segmendis z0→z1; ENNE segmenti (sulanduse ajal)
   settib ENTER_SCALE → z0 ("silm fokuseerib sammul uuesti"). */
function frameZoom(i, p) {
  const [from, to, z0, z1] = SEGS[i];
  if (p < from && i > 0) {
    const tb = blendAmount(i - 1, p);
    return seglerp(ENTER_SCALE, z0, tb);
  }
  const t = clamp01((p - from) / (to - from));
  return seglerp(z0, z1, t);
}

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

export default function RoomStage() {
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
  const isCarouselRoute = isHome || isProfileHub || !!cardPageKey;
  const isAuthed = status === "authenticated" && !!session;
  const isAdmin = useMemo(() => {
    const u = session?.user;
    const role = typeof u?.role === "string" ? u.role.toLowerCase() : "";
    const perms = Array.isArray(u?.permissions) ? u.permissions : [];
    return Boolean(u?.isAdmin || u?.is_admin || role === "admin" || perms.includes("admin"));
  }, [session]);

  /* --- režiim --- */
  const [mode, setMode] = useState(isHome ? "walk" : "panel");
  const [veil, setVeil] = useState(isHome ? "shown" : "gone");
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
  const [power, setPower] = useState(isHome ? "standby" : "on");

  const stageRef = useRef(null);
  const frameRefs = useRef([]);
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
  const [cardsReady, setCardsReady] = useState(false);
  /* Käivituse vahepala: pärast klaaside teket sähvatab keskele animeeritud
     SAI-monogramm, alles siis laetakse kaartidele sisu (tellija 06.07) */
  const [introSai, setIntroSai] = useState(false);
  /* Metalli "valmis"-olek: loori metallik-AI (WebGL) tuuakse SUJUVALT sisse
     alles kui muster on renderdatud — enne pole tühja/musta alust näha
     (tellija 06.07). NB: vahepala monogramm on nüüd AINULT pöörlev S,
     ilma AI-ta (tellija 07.07). */
  const [veilMetalReady, setVeilMetalReady] = useState(false);

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
    const layers = frameRefs.current;
    if (!layers.length) return;

    // Milline segment on aktiivne?
    let active = 0;
    for (let i = 0; i < SEGS.length; i++) {
      if (p >= SEGS[i][0]) active = i;
    }

    // Sulanduse haripunkti fookus-blur (0 → max → 0 üle akna)
    const boundary = SEGS[active][1];
    const bw = active === 4 ? SIT_BLEND : BLEND;
    const blendT = active < SEGS.length - 1 ? clamp01((p - (boundary - bw)) / bw) : 0;
    const focusBlur = reducedRef.current
      ? 0
      : Math.sin(Math.PI * blendT) * BLEND_BLUR_PX;

    for (let i = 0; i < layers.length; i++) {
      const el = layers[i];
      if (!el) continue;
      // Kaader 7 ei osale kõnnis — teda juhib käivitus (⏻)
      if (i === 6) continue;
      let opacity = 0;
      let scale = 1;
      let x = 0;
      let y = 0;
      let blur = 0;

      if (i === active) {
        opacity = 1;
        scale = frameZoom(i, p);
        blur = focusBlur;
      } else if (i === active + 1) {
        opacity = blendAmount(active, p);
        scale = frameZoom(i, p);
        blur = focusBlur;
      } else if (i === active - 1) {
        // Eelmine püsib all kuni sulandus katab (järgmine on peal)
        opacity = blendAmount(i, p) < 1 ? 1 : 0;
        scale = frameZoom(i, p);
      }

      // Istumise pööre 5→6: nihe + laskumine (brief §5)
      if (i === 4 || i === 5) {
        const sit = blendAmount(4, p);
        if (sit > 0 && sit < 1.0001) {
          if (i === 4) {
            x = -9 * sit;
            y = -2.4 * sit;
          } else {
            x = 7 * (1 - sit);
            y = 2.6 * (1 - sit);
          }
        }
      }

      if (opacity <= 0.0001) {
        if (el.style.opacity !== "0") el.style.opacity = "0";
        continue;
      }
      el.style.opacity = String(opacity);
      el.style.transform = `translate3d(${x}%, ${y}%, 0) scale(${scale})`;
      el.style.filter = blur > 0.25 ? `blur(${blur.toFixed(1)}px)` : "";
    }

    // Tekstipeatused: korraga nähtav üks peatus; mitmelauselise peatuse
    // laused on ERALDI mullid (vasak + parem) ja hajuvad koos. Keskne
    // (walk_6) on erand, mis hajub täielikult enne käivituselemente.
    for (let s = 0; s < WALK_BUBBLES.length; s++) {
      const el = textRefs.current[s];
      if (!el) continue;
      const bubble = WALK_BUBBLES[s];
      const alpha = fadeWindow(p, bubble.from, bubble.to, 0.022);
      if (alpha <= 0.001) {
        if (el.style.opacity !== "0") el.style.opacity = "0";
        continue;
      }
      const drift = clamp01((p - bubble.from) / (bubble.to - bubble.from));
      const xBase = bubble.side === "center" ? "-50%" : "0px";
      el.style.opacity = String(alpha);
      el.style.transform = `translate3d(${xBase}, ${(1 - alpha) * 12 - drift * 8}px, 0)`;
      el.style.filter = alpha >= 0.999 ? "none" : `blur(${(1 - alpha) * 4}px)`;
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
      next = walkDoneThisLoad || reducedRef.current ? "room" : "walk";
    }
    setMode(next);
  }, [isCarouselRoute, isHome, readReduced]);

  /* Kaader 7 kuulub käivitusele: sujuv süttimine/kustumine WAAPI-ga. */
  const setFrame7 = useCallback((visible, animate = true) => {
    const el = frameRefs.current[6];
    if (!el) return;
    const to = visible ? "1" : "0";
    el.style.transform = "translate3d(0, 0, 0) scale(1)";
    if (!animate || reducedRef.current || typeof el.animate !== "function") {
      el.style.opacity = to;
      return;
    }
    const from = el.style.opacity || "0";
    el.style.opacity = to;
    el.animate([{ opacity: from }, { opacity: to }], {
      duration: visible ? 700 : 550,
      easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
    });
  }, []);

  /* Käivitus: sähvatus → kaader 6→7 → klaasid (faas 1) → sisu (faas 2).
     CSS lavastab faasid [data-power] atribuudi järgi. Käivitusega
     lõpeb ka kõnd LÕPLIKULT (mode → room): kerimisruum kaob ja vanu
     teekonnatekste ei saa kaartide all tagasi kerida (tellija 06.07). */
  const igniteOn = useCallback(() => {
    if (powerRef.current === "on" || powerRef.current === "igniting") return;
    if (reducedRef.current) {
      setFrame7(true, false);
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
    window.setTimeout(() => setFrame7(true), 200);
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
  }, [setFrame7]);


  /* Kiirkäskude riba "OFF": LOGI VÄLJA + seade tagasi ooterežiimi (⏻)
     (tellija 07.07: OFF = logout, sama mis profiili "Välja"). Kodus
     rakendub standby kohe; mujalt karussellilt naaseb koju ja maandub
     standby'sse (pendingStandby). */
  const powerOff = useCallback(() => {
    setAdminHub(false);
    setInfoHub(false);
    if (isAuthed) {
      signOut({ redirect: false }).catch(() => {});
    }
    if (!isHome) {
      pendingStandbyRef.current = true;
      router.push(localizePath("/", locale));
      return;
    }
    setFrame7(false, false);
    setPower("standby");
    setCardsReady(false);
    setIntroSai(false);
    if (standbyRef.current) {
      standbyRef.current.style.opacity = "";
      standbyRef.current.style.pointerEvents = "";
    }
    window.scrollTo(0, 0);
  }, [isHome, isAuthed, router, locale, setFrame7]);

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
      setFrame7(false, false);
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
          setFrame7(true, false);
          setPower("on");
          setCardsReady(true);
        }
        // pendingStandby ("Välja") rakendub allpool isHome-efektis —
        // room→room üleminekul see efekt uuesti ei jookse.
      }
      if (mode === "panel") {
        setFrame7(true, false);
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
  }, [mode, cardPageKey, applyScene, wake, setFrame7]);

  /* "Välja" (profiilikaardilt) → kodu PUHKESEISUS. Elab pathname'i,
     mitte mode'i küljes: profiililt (room) koju (room) tulles mode ei
     muutu ja mode-efekt ei jookse. Nähtavuse annab CSS-reegel
     .room[data-mode="room"][data-power="standby"] .room-standby. */
  useEffect(() => {
    if (!isHome || !pendingStandbyRef.current) return;
    pendingStandbyRef.current = false;
    setFrame7(false, false);
    setPower("standby");
    setCardsReady(false);
    setIntroSai(false);
    if (standbyRef.current) {
      // Kustuta kõnni-aegne inline-jälg, et CSS-reegel kehtiks
      standbyRef.current.style.opacity = "";
      standbyRef.current.style.pointerEvents = "";
    }
    window.scrollTo(0, 0);
  }, [isHome, setFrame7]);

  /* ---------- loor (laadimisekraan) ----------
     Tellija otsus: loor püsib, kuni kasutaja ISE vajutab "Sisenen" —
     nupp ilmub, kui esimene kaader on dekodeeritud. */
  useEffect(() => {
    if (!isHome || veil !== "shown" || veilReady) return undefined;
    let cancelled = false;
    const firstFrame = readReduced() ? 6 : 0; // reduced-motion ootab kaadrit 7
    const ready = () => !cancelled && setVeilReady(true);
    const img = frameRefs.current[firstFrame]?.querySelector("img");
    if (img?.decode) {
      const guard = window.setTimeout(ready, 2600); // LQIP katab, kui võrk venib
      img
        .decode()
        .catch(() => {})
        .finally(() => {
          window.clearTimeout(guard);
          ready();
        });
    } else {
      ready();
    }
    return () => {
      cancelled = true;
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
    window.setTimeout(() => setVeil("gone"), 900);
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

  /* Ülejäänud kaadrite eeldekodeerimine (brief §9: enne teekonda). */
  useEffect(() => {
    if (veil !== "gone" || mode === "panel") return undefined;
    let cancelled = false;
    (async () => {
      for (const layer of frameRefs.current) {
        if (cancelled) break;
        const img = layer?.querySelector("img");
        if (img?.decode) {
          try {
            await img.decode();
          } catch {}
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [veil, mode]);

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
      { key: "ruumid", label: t("nav.rooms"), href: "/ruum", icon: <RoomsCardIcon /> },
      { key: "toolaud", label: t("nav.workspace"), href: "/vestlus?workspace=avatud", icon: <WorkspaceCardIcon /> },
      { key: "vestlus", label: t("nav.chat"), href: "/vestlus", icon: <ChatCardIcon /> },
      { key: "profiil", label: t("nav.profile"), href: "/profiil", icon: <ProfileCardIcon /> },
    ];
    if (isAdmin) {
      items.push({ key: "haldus", label: t("room.admin_card"), action: "haldus", icon: <AdminSlidersIcon /> });
    }
    return items;
  }, [t, isAdmin]);

  /* Halduse alamkomplekt — avaneb "Haldus" kaardilt, "Tagasi" viib
     peakomplekti (sama muster mis profiili "Tagasi") */
  const adminItems = useMemo(
    () => [
      { key: "analytics", label: t("room.admin_analytics"), href: "/admin/analytics", icon: <AnalyticsIcon /> },
      { key: "rag", label: t("room.admin_rag"), href: "/admin/rag", icon: <RagDbIcon /> },
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
      { key: "tellimus", label: t("profile.manage_subscription"), href: "/tellimus", icon: <SubscriptionEuroIcon /> },
      { key: "teave", label: t("room.info_card"), action: "teave", icon: <AboutInfoIcon /> },
      { key: "valja", label: t("room.exit_card"), action: "valja", icon: <PowerIcon /> },
      { key: "tagasi", label: t("room.back_card"), action: "tagasi", icon: <BackArrowIcon /> },
    ],
    [t]
  );

  const isProfileContext = isProfileHub || isProfileCardPage;
  const isAdminHub = adminHub && isAdmin && !isProfileContext;
  const isInfoHub = infoHub && isProfileHub;
  const carouselSet = isProfileContext
    ? isInfoHub
      ? "info"
      : "profile"
    : isAdminHub
      ? "admin"
      : isAuthed
        ? "work"
        : "public";
  const carouselItems = isProfileContext
    ? isInfoHub
      ? teaveItems
      : profileItems
    : isAdminHub
      ? adminItems
      : isAuthed
        ? workItems
        : publicItems;
  const initialKey =
    cardPageKey ||
    (isProfileHub
      ? isInfoHub
        ? "meist"
        : "pin"
      : isAdminHub
        ? "rag"
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
    [router, locale, a11y]
  );

  const showCarouselUi = isCarouselRoute;

  return (
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
      {/* Lavastus: kaadrid */}
      <div className="room-stage" ref={stageRef} aria-hidden="true">
        {ROOM_FRAMES.map((frame, i) => {
          const initialVisible = mode === "walk" ? i === 0 : i === 6;
          return (
            <div
              key={frame.n}
              className={`room-frame room-frame--${frame.n}`}
              ref={(el) => {
                frameRefs.current[i] = el;
              }}
              style={{
                opacity: initialVisible ? 1 : 0,
                backgroundImage: `url(${frame.lqip})`,
              }}
            >
              <img
                src={frame.src}
                alt=""
                width={ROOM_FRAME_WIDTH}
                height={ROOM_FRAME_HEIGHT}
                loading="eager"
                fetchPriority={i === 0 || i === 6 ? "high" : "low"}
                decoding="async"
                draggable={false}
              />
            </div>
          );
        })}
        <div className="room-vignette" />
        <div className="room-dim" />
      </div>
      <div className="grain-veil" aria-hidden="true" />

      {showCarouselUi ? (
        <>
          {isHome ? (
            <>
              {/* Tekstipeatused (kinnitatud sõnastused) — visuaalne kiht;
                  sisuline tekst on lehel sr-only. Iga lause = oma mull
                  (vasak + parem koos, tellija 07.07); walk_6 ainus keskel. */}
              <div className="room-texts" aria-hidden="true" data-room-ui>
                {WALK_BUBBLES.map((bubble, i) => (
                  <JourneyText
                    key={bubble.key}
                    position={bubble.side}
                    data-stop={bubble.key}
                    ref={(el) => {
                      textRefs.current[i] = el;
                    }}
                  >
                    {t(`room.${bubble.key}`)}
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

          {/* Ülaserva kiirriba — vaikimisi PEIDUS, aga nuppude ALASERVAD
              PIILUVAD servast välja: nähtav vihje, et siin on juhtnupud (mitte
              enam eksitav allanool, mis viitas alla kaartidele). Klõps/hover
              tõmbab riba täies pikkuses alla. Koondab: heli sisse/välja,
              järgmine lugu, keel & ligipääsetavus, ooterežiim (OFF). */}
          <div className="room-topbar" data-room-ui data-open={topbarOpen ? "1" : "0"} ref={topbarRef}>
            {/* Püüdeala katab kogu riba: KLÕPS avab/sulgeb (töötab
                puuteseadmetel), hover/fookus avab töölaual. Sees STAATILINE
                vihjenool (ei vilgu) — näha vaikimisi, kaob AINULT siis kui
                nupud tulevad välja (riba avatud). */}
            <button
              type="button"
              className="room-topbar-arrow"
              aria-label={t(topbarOpen ? "room.quickbar_close" : "room.quickbar_open")}
              aria-expanded={topbarOpen}
              onClick={() => setTopbarOpen((v) => !v)}
            />
            <div
              className="room-quickbar"
              onClick={(e) => {
                /* Hiireklõps ei tohi jätta nuppu fookusesse: :focus-within
                   hoiaks paneeli lahti ka pärast hiire lahkumist ("paneel ei
                   taha kinni minna"). Klaviatuur (e.detail === 0) jääb
                   puutumata — seal on fookus vajalik. */
                if (e.detail > 0) {
                  const btn = e.target.closest?.(".room-quick-btn");
                  if (btn) requestAnimationFrame(() => btn.blur());
                }
              }}
            >
            {/* Nool on ehitatud paneeli SISSE — istub paneeli alaserval ja
                liigub paneeliga koos (tellija 07.07). Kaob paneeli avanedes. */}
            <span className="room-quickbar-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
            <IconButton
              layoutClassName="room-quick-btn"
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
                layoutClassName="room-quick-btn"
                aria-label={t("room.sound_next")}
                onClick={nextAmbient}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 6.5 15 12 7 17.5V6.5Z" />
                  <path d="M17.5 6.6v10.8" />
                </svg>
              </IconButton>
            ) : null}
            <IconButton
              layoutClassName="room-quick-btn"
              aria-label={t("room.settings_open")}
              onClick={() => a11y?.openModal?.()}
            >
              <LanguageAccessIcon />
            </IconButton>
            <IconButton
              layoutClassName="room-quick-btn"
              aria-label={t("room.power_off")}
              onClick={powerOff}
            >
              <PowerIcon />
            </IconButton>
            </div>
          </div>

          {/* Karussell — süttib käivitusega (faas 1 klaasid, faas 2 sisu).
              Väljalülitus elab profiilikarusselli "Välja" kaardil (tellija);
              nurga-⏻ eemaldatud. */}
          <div className="room-carousel-wrap" ref={carouselWrapRef} data-room-ui>
            <GlassCarousel
              key={carouselSet}
              items={carouselItems}
              initialKey={initialKey}
              setKey={carouselSet}
              forceInitial={!!cardPageKey}
              onSelect={handleSelect}
              t={t}
            />
          </div>

          {/* Käivituse vahepala (tellija 07.07): AINULT valge S keskel, mis
              teeb ÜHE aeglase täispöörde (SMIL, v-metalbase.svg). Metallik-AI
              on siit EEMALDATUD — S pöörleb üksi, ilma AI-ta. (Alus-SVG AI on
              nagunii fill="none", nii et jääb nähtamatuks.) */}
          {introSai ? (
            <div className="room-intro-sai" aria-hidden="true">
              <div className="room-intro-sai-mono">
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
        data-metal-ready={veilMetalReady ? "1" : "0"}
        aria-hidden={veil === "gone"}
      >
        <div className="room-veil-logo">
          <img
            src="/logo/sotsiaalai-h-valge.svg"
            alt="SotsiaalAI"
            width={264}
            height={50}
            decoding="async"
          />
          {veil !== "gone" ? (
            <div className="room-veil-logo-metal" aria-hidden="true">
              {/* Tähed = platina (jahe hõbe-valge põhitoon: light/dark);
                  liikuv sära = šampanja/kuld (tintColor) — tellija 06.07.
                  chromaticSpread ~0: RGB-kanalite lahknemine tegi ROHELISI
                  servi; blur/sharpness/noise pehmemaks (sujuvam helk).
                  Alus-AI on LÄBIPAISTEV; metall tuleb SUJUVALT sisse alles
                  kui muster on renderdatud (onReady → data-metal-ready). */}
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
              />
            </div>
          ) : null}
        </div>
        <p className="room-veil-line">{t("room.loading_line")}</p>
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
  );
}
