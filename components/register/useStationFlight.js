"use client";

/**
 * useStationFlight — jaamalennu mootor (flight-effect.md adaptsioon).
 *
 * Fikseeritud 3D-vaateava, milles vormijaamad seisavad eri sügavustel
 * (--z = -i × STATION_DEPTH) ja kaamera (--cam) lendab jaamast jaama.
 * Kaamera siht = AKTIIVSE JAAMA indeks, MITTE scrollY — edasi liigub
 * kasutaja valikuga, mitte kerimisega.
 *
 * Kriitilised reeglid (public/room/flight-effect.md §3–§5):
 * - perspective on plaanide OTSESEL vanemal (dolly); pesastatud
 *   preserve-3d ahelat EI ehitata (iOS Safari lamendab selle).
 * - kaamera käib CSS-muutujana igal kaadril; React state uueneb AINULT
 *   jaamavahetusel (fookus/inert) — setState keset lendu viskab kaadreid.
 * - z-index määratakse ÜKS kord jaama indeksi järgi (sügavusjärjekord
 *   on konstantne); iga-kaadri z-index churn paneks teksti võbelema.
 * - --o kirjutatakse plaanile ainult tegeliku muutuse korral.
 * - rAF magab, kui kaamera on sihil; visibilitychange äratab.
 * - perspectiveWorks-proov + prefers-reduced-motion → flat-režiim
 *   (sama jaamamudel, ainult ristsulandus; juurel data-mode="flat").
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const STATION_DEPTH = 1400;

/* Ümbriku aknad kaameraühikutes (vt flight-effect.md §6 häälestustabel).
   Paigalseisus on järgmine jaam (rel = -STATION_DEPTH) TÄIESTI peidus —
   poolläbipaistvast klaasist ei tohi taga elemente paista (tellija
   16.07); ta ilmub alles lennu ajal lähenedes.

   Lahkumisaken. Kaks vastandlikku kaebust on sama akna kaks otsa:
   „liiga kähku kõik suureneb minust läbi" (25.07) tuli LAIAST aknast —
   lahkuv jaam elas kuni 2,35× suuruseni, sest rel > 0 juures paisutab
   skaala P/(P−rel) teda kiiresti. Aken tõmmati 180 peale ja siis tuli
   „koledalt kaovad nupud ära kerides" (25.07) — 180 ühikut läbitakse
   lennu ALGUSES, kus kaamera on kõige kiirem, ehk ~4 kaadriga: jaam ei
   sulandunud, vaid plõksas ära.
   Lahendus on kahes osas: aken 320-ni tagasi (lahkuv jaam kaob ammu enne
   1,5× suurust) JA kaamera ajastus ease-in-out'iks (allpool), mis teeb
   lennu alguse aeglaseks — just seal, kus ristsulandus toimub. Koos
   kestab üleminek ~0,25 s ~0,07 s asemel.
   Saabuva jaama aken on TÄPSELT komplementaarne (nihe = STATION_DEPTH),
   seega o_lahkuv(rel) + o_saabuv(rel − 1400) = 1 igal hetkel — üleminek
   ei tumene ega heleda kummaski suunas. FADE_IN_START = −1360 jätab
   paigalseisvale järgmisele jaamale (rel = −1400) 40 ühikut varu, et ta
   oleks TÄIESTI peidus. */
const FADE_OUT_START = 40;
const FADE_OUT_LEN = 320;
const FADE_IN_START = FADE_OUT_START - STATION_DEPTH;
const FADE_IN_LEN = FADE_OUT_LEN;
const VISIBLE_MIN = -1420;
const VISIBLE_MAX = FADE_OUT_START + FADE_OUT_LEN + 40;
/* Kaamera ajastus (omanik 25.07: „lendamise efekt … ei ole sujuv" ja
   „koledalt kaovad nupud ära kerides").
   Ajalugu: kaadripõhine lerp (kiirus suurim ESIMESEL kaadril → nõks) →
   kriitiliselt sumbunud vedru (start pehme, aga tipp-kiirus juba 0,12 s
   juures: 60% teekonnast oli 0,25 s-ga läbi ja ristsulandus jäi mitme
   kaadri sisse).
   Nüüd: AJAPÕHINE tween ease-in-out kuupfunktsiooniga. Kiiruse tipp on
   teekonna KESKEL, algus ja lõpp on aeglased — algus on täpselt see koht,
   kus lahkuv jaam kaob ja uus tuleb. Positsioon tuleb kellast, mitte
   kaadrisammust → kaadrisagedus (60/120Hz) ei mõjuta kiirust. */
/* TEMPO (omanik 02.08: „kerimine või siis menüüst läbi lendamine on liiga
   uimane ja aeglane"). Naabrijaama lend 758 → 508 ms, doki pikk hüpe üle
   seitsme jaama 1500 → 980 ms.
   ALLPOOLE EI TOHI MINNA ILMA AKENT MUUTMATA, ja see on arvutatav, mitte
   maitse: ristsulandus toimub esimese ~360 ühiku sees (FADE_OUT_START +
   FADE_OUT_LEN) ehk 26% teekonnast, mille ease-in-out läbib 40% KESTUSEST.
   508 ms → üleminek ~0,20 s. Just see arv on kord juba 0,07 s peale kukkunud
   ja tulemus oli omaniku „koledalt kaovad nupud ära kerides" (25.07). Kui
   tempot veel tõsta, tuleb FADE_OUT_LEN koos sellega kasvatada. */
const FLIGHT_BASE_MS = 340;
const FLIGHT_PER_UNIT_MS = 0.12;
const FLIGHT_MIN_MS = 400;
const FLIGHT_MAX_MS = 980;
/* Katkestus keset lendu (dokiklõps, kiire keris): uus tween algab käimas-
   olevast kiirusest (ease-out, mille algkiirus = 3·teekond/kestus), nii et
   suunamuutus ei tee kiirusauku. */
const RESUME_MIN_MS = 260;
const MOVING_VEL = 60;
/* Kaadrid pärast pausi (tab taustal, GC-pikk kaader) ei tohi kiiruse-
   hinnangut lõhkuda — dt on lakke pandud ~33 ms peale. */
const MAX_DT = 1 / 30;

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const clampRange = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/* Parallaks: kui palju kadumispunkt kõige servani viidud hiirega nihkub
   ja kui pehmelt ta järele tuleb. Väike amplituud on tahtlik — see on
   ruumivihje, mitte kiik. PARALLAX_RANGE on VAIKE-amplituud (täisleht,
   nt /registreerimine); jaamalennu tarbija võib selle üle kirjutada
   `parallaxRange`-iga (väiksem pind = rahulikum nihe). */
const PARALLAX_RANGE = 34;
const PARALLAX_LERP = 0.07;
/* Sisse-triiv: mount'il alustab kaamera sihist veidi tagapool, et leht
   avaneks õrna edasiliikumisega (mitte staatilise kaadrina). */
const ARRIVAL_DRIFT = 120;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function envelope(rel) {
  const fadeIn = clamp01((rel - FADE_IN_START) / FADE_IN_LEN);
  const fadeOut = 1 - clamp01((rel - FADE_OUT_START) / FADE_OUT_LEN);
  return fadeIn * fadeOut;
}

/* iOS-i lamenduskontroll (flight-effect.md §5.1): kui translateZ ei
   kahanda proovikasti laiust, 3D ei tööta → flat. */
function perspectiveWorks(dolly) {
  if (!dolly) return false;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;width:100px;height:100px;" +
    "transform:translateZ(-1100px);visibility:hidden";
  dolly.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  return w < 80;
}

export default function useStationFlight({
  count,
  initialIndex = 0,
  parallax = false,
  parallaxRange = PARALLAX_RANGE,
}) {
  const dollyRef = useRef(null);
  const planesRef = useRef(new Map());
  const camRef = useRef(Math.max(0, initialIndex * STATION_DEPTH - ARRIVAL_DRIFT));
  const velRef = useRef(0);
  const lastTsRef = useRef(0);
  /* Käimasolev lend: { from, to, start, dur, ease } või null (paigal). */
  const tweenRef = useRef(null);
  const targetRef = useRef(initialIndex * STATION_DEPTH);
  const frameRef = useRef(0);
  const runningRef = useRef(false);
  const modeRef = useRef("3d");
  /* Parallaks (omanik 21.07: „liigutan hiirt, siis elemendid ekraani keskel
     liiguvad"): hiir nihutab kadumispunkti, mistõttu sügavamal seisvad
     jaamad liiguvad rohkem kui lähedal olev — päris ruumitunne, mitte
     ühtlane libisemine. Väärtused elavad kaadrisilmuses koos kaameraga,
     et rAF ärkaks ja magaks ühe reegli järgi. */
  const parRef = useRef({ x: 0, y: 0 });
  const parTargetRef = useRef({ x: 0, y: 0 });
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [mode, setMode] = useState("3d");

  const tick = useCallback((ts) => {
    const dolly = dollyRef.current;
    if (!dolly || modeRef.current !== "3d") {
      runningRef.current = false;
      return;
    }
    /* Ajasamm sekundites — vajalik AINULT kiiruse hindamiseks (katkestus)
       ja parallaksi järelejõudmiseks. Kaamera positsioon tuleb kellast. */
    const now = typeof ts === "number" ? ts : performance.now();
    const dt = lastTsRef.current
      ? Math.min((now - lastTsRef.current) / 1000, MAX_DT)
      : 1 / 60;
    lastTsRef.current = now;

    const tween = tweenRef.current;
    let cam = camRef.current;
    let camSettled = true;
    if (tween) {
      const p = clamp01((now - tween.start) / tween.dur);
      cam = tween.from + (tween.to - tween.from) * tween.ease(p);
      if (p >= 1) {
        cam = tween.to;
        tweenRef.current = null;
      } else {
        camSettled = false;
      }
    }
    /* Kiirus mõõdetakse tegelikust liikumisest — nii saab katkestav lend
       sellega otse haakuda, olenemata sellest, millise easing'uga käidi. */
    velRef.current = dt > 0 ? (cam - camRef.current) / dt : 0;
    if (camSettled) velRef.current = 0;
    camRef.current = cam;
    dolly.style.setProperty("--cam", cam.toFixed(2) + "px");

    /* Parallaks järgneb eksponentsiaalselt, kuid samuti AJA järgi — muidu
       liigub 120Hz ekraanil kaks korda kiiremini kui 60Hz-l. */
    let parSettled = true;
    if (parallax) {
      const cur = parRef.current;
      const aim = parTargetRef.current;
      const follow = 1 - Math.pow(1 - PARALLAX_LERP, dt * 60);
      for (const axis of ["x", "y"]) {
        let v = cur[axis] + (aim[axis] - cur[axis]) * follow;
        if (Math.abs(aim[axis] - v) < 0.02) v = aim[axis];
        else parSettled = false;
        cur[axis] = v;
      }
      dolly.style.setProperty("--par-x", (cur.x * parallaxRange).toFixed(2) + "px");
      dolly.style.setProperty("--par-y", (cur.y * parallaxRange).toFixed(2) + "px");
    }

    for (const entry of planesRef.current.values()) {
      const rel = entry.z + cam;
      if (rel < VISIBLE_MIN || rel > VISIBLE_MAX) {
        if (entry.visible !== false) {
          entry.visible = false;
          entry.el.style.visibility = "hidden";
        }
        continue;
      }
      if (entry.visible !== true) {
        entry.visible = true;
        entry.el.style.visibility = "visible";
      }
      const o = envelope(rel);
      if (Math.abs(o - entry.lastO) > 0.002) {
        entry.lastO = o;
        entry.el.style.setProperty("--o", o.toFixed(3));
      }
    }

    if (camSettled && parSettled) {
      runningRef.current = false;
      lastTsRef.current = 0;
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  }, [parallax, parallaxRange]);

  const wake = useCallback(() => {
    if (runningRef.current || modeRef.current !== "3d") return;
    runningRef.current = true;
    lastTsRef.current = 0;
    frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  /* Uue lennu algatus. Paigalseisust = ease-in-out (pehme start, pehme
     maandumine). Keset lendu = ease-out, mille kestus valitakse nii, et
     tema ALGKIIRUS (3·teekond/kestus) võrduks praeguse kiirusega — nii ei
     teki suunamuutusel kiirusauku ega nõksu. */
  const startFlight = useCallback((to) => {
    const from = camRef.current;
    const dist = Math.abs(to - from);
    if (dist < 0.5) {
      tweenRef.current = null;
      return;
    }
    const vel = Math.abs(velRef.current);
    const moving = tweenRef.current !== null && vel > MOVING_VEL;
    const normalDur = clampRange(
      FLIGHT_BASE_MS + dist * FLIGHT_PER_UNIT_MS,
      FLIGHT_MIN_MS,
      FLIGHT_MAX_MS,
    );
    /* Kiiruse järgi arvutatud kestus võib aeglase katkestuse korral venida
       absurdselt pikaks (lennu lõpus on kiirus väike) — lagi hoiab lennu
       tempos, põrand ei lase tal nõksuks kokku tõmbuda. */
    const dur = moving
      ? clampRange(
          ((3 * dist) / vel) * 1000,
          RESUME_MIN_MS,
          Math.min(FLIGHT_MAX_MS, normalDur * 1.5),
        )
      : normalDur;
    tweenRef.current = {
      from,
      to,
      start: performance.now(),
      dur,
      ease: moving ? easeOutCubic : easeInOutCubic,
    };
  }, []);

  const flyTo = useCallback(
    (index, { instant = false, drift = false } = {}) => {
      const next = Math.max(0, index);
      targetRef.current = next * STATION_DEPTH;
      /* Hüppel (instant/drift) EI kanta kiirust edasi — uus lend algaks
         muidu teleportatsiooni järel vana hooga. */
      if (instant) {
        camRef.current = targetRef.current;
        velRef.current = 0;
        tweenRef.current = null;
      } else {
        /* drift: hüppa sihi lähedale ja lase viimane ARRIVAL_DRIFT
           õrnalt kohale triivida (nt detourist naasmine) — kogu lendu
           uuesti ei mängita. */
        if (drift) {
          camRef.current = Math.max(0, targetRef.current - ARRIVAL_DRIFT);
          velRef.current = 0;
          tweenRef.current = null;
        }
        startFlight(targetRef.current);
      }
      setActiveIndex(next);
      wake();
    },
    [startFlight, wake],
  );

  /* Režiimivalik üks kord mount'il: reduced-motion või lame 3D → flat.
     NB! tühi deps on teadlik — HMR-il tee täislaadimine (spec §5.8). */
  useLayoutEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const works = !reduced && perspectiveWorks(dollyRef.current);
    const nextMode = works ? "3d" : "flat";
    modeRef.current = nextMode;
    setMode(nextMode);
    if (nextMode === "3d") {
      dollyRef.current?.style.setProperty("--cam", camRef.current.toFixed(2) + "px");
      /* Sisse-triiv (camRef algab ARRIVAL_DRIFT võrra tagapool) vajab nüüd
         oma lendu — ilma selleta jääks kaamera igaveseks sihist maha. */
      startFlight(targetRef.current);
      wake();
    }
    return () => {
      cancelAnimationFrame(frameRef.current);
      /* StrictMode/HMR: ilma lipuvabastuseta arvaks järgmine wake(),
         et silmus juba käib, ja tick ei jookseks enam kunagi. */
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* rAF ei käi peidetud tabis — ilma selleta ärkab leht segaduses
     (spec §5.6). */
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(frameRef.current);
      else {
        runningRef.current = false;
        wake();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [wake]);

  /* Uus jaam võib renderduda pärast flyTo sihti (nt edu-jaam) — ärata
     silmus, et tema ümbrik/nähtavus kohe arvutataks. */
  useEffect(() => {
    wake();
  }, [count, wake]);

  /* Hiireparallaks: kadumispunkt järgib osutit. AINULT 3D-režiimis —
     flat on liikumist vähendava kasutaja rada ja peab jääma paigal.
     Puutega seadmel pointermove'i sisuliselt ei tule; pointerleave viib
     lava rahulikult keskele tagasi. */
  useEffect(() => {
    if (!parallax || mode !== "3d" || typeof window === "undefined") return undefined;
    const aim = (x, y) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      parTargetRef.current = {
        x: Math.max(-1, Math.min(1, (x - w / 2) / (w / 2))),
        y: Math.max(-1, Math.min(1, (y - h / 2) / (h / 2))),
      };
      wake();
    };
    const onMove = (e) => {
      if (e.pointerType === "touch") return;
      aim(e.clientX, e.clientY);
    };
    const onLeave = () => {
      parTargetRef.current = { x: 0, y: 0 };
      wake();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [parallax, mode, wake]);

  const registerPlane = useCallback((index, el) => {
    const planes = planesRef.current;
    if (!el) {
      planes.delete(index);
      return;
    }
    planes.set(index, {
      el,
      z: -(index * STATION_DEPTH),
      lastO: -1,
      visible: null,
    });
  }, []);

  /* Plaani staatilised propid: --z ja z-index määratakse siin ÜKS kord
     (sügavusjärjekord ei muutu); inert + aria-hidden peidavad
     mitteaktiivsed jaamad nii fookuse kui puute eest. */
  const planeProps = useCallback(
    (index) => {
      const isActive = index === activeIndex;
      return {
        ref: (el) => registerPlane(index, el),
        className: "rgf-plane",
        style: {
          "--z": `${-(index * STATION_DEPTH)}px`,
          zIndex: 4000 - index * 300,
        },
        "data-active": isActive ? "1" : "0",
        inert: !isActive,
        "aria-hidden": isActive ? undefined : "true",
      };
    },
    [activeIndex, registerPlane],
  );

  return { dollyRef, planeProps, activeIndex, mode, flyTo };
}
