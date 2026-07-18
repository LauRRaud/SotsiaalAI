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
   16.07); ta ilmub alles lennu ajal lähenedes. */
const FADE_IN_START = -1350;
const FADE_IN_LEN = 600;
const FADE_OUT_START = 260;
const FADE_OUT_LEN = 380;
const VISIBLE_MIN = -1420;
const VISIBLE_MAX = 680;
const LERP = 0.11;
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

export default function useStationFlight({ count, initialIndex = 0 }) {
  const dollyRef = useRef(null);
  const planesRef = useRef(new Map());
  const camRef = useRef(Math.max(0, initialIndex * STATION_DEPTH - ARRIVAL_DRIFT));
  const targetRef = useRef(initialIndex * STATION_DEPTH);
  const frameRef = useRef(0);
  const runningRef = useRef(false);
  const modeRef = useRef("3d");
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [mode, setMode] = useState("3d");

  const tick = useCallback(() => {
    const dolly = dollyRef.current;
    if (!dolly || modeRef.current !== "3d") {
      runningRef.current = false;
      return;
    }
    const target = targetRef.current;
    let cam = camRef.current + (target - camRef.current) * LERP;
    if (Math.abs(target - cam) < 0.2) cam = target;
    camRef.current = cam;
    dolly.style.setProperty("--cam", cam.toFixed(2) + "px");

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

    if (cam === target) {
      runningRef.current = false;
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const wake = useCallback(() => {
    if (runningRef.current || modeRef.current !== "3d") return;
    runningRef.current = true;
    frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const flyTo = useCallback(
    (index, { instant = false, drift = false } = {}) => {
      const next = Math.max(0, index);
      targetRef.current = next * STATION_DEPTH;
      if (instant) camRef.current = targetRef.current;
      /* drift: hüppa sihi lähedale ja lase viimane ARRIVAL_DRIFT
         õrnalt kohale triivida (nt detourist naasmine) — kogu lendu
         uuesti ei mängita. */
      if (drift) camRef.current = Math.max(0, targetRef.current - ARRIVAL_DRIFT);
      setActiveIndex(next);
      wake();
    },
    [wake],
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
