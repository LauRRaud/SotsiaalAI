"use client";

/**
 * StepFlight — sammudega töövoog lennulaval.
 *
 * MIKS. Pikk vorm, mida inimene alla kerib, näitab korraga kõike ja ei ütle,
 * kus ta parajasti on. Siin on töövoog jagatud sammudeks: ekraanil on ÜKS samm,
 * järgmine tuleb sügavusest lähemale (sama liikumine mis keele ja
 * ligipääsetavuse vaates) ning „Kõik sammud" näitab tervikut korraga.
 *
 * MIDA TAASKASUTAB. Lend on platvormi oma mootor (`useStationFlight`: jaamad
 * eri sügavustel, kaamera lendab nende vahel, vähendatud liikumisel ristsulandus).
 * Uut 3D-süsteemi siin ei ole.
 *
 * SAMMURIBA ei ole klaaspaneeli sees: sammud seisavad all kiirmenüüs lehe nime
 * kõrval (`StepRail`, `DockSteps`). Paneel on ainult sisu jaoks.
 *
 * KERIMINE VAHETAB SISU KOHAPEAL. Sammud on tehtud nii, et üks samm mahub
 * paneeli ära; siis viib sisse kerimine järgmise sammu juurde ja välja kerimine
 * eelmise juurde (esimeselt sammult välja kerides avaneb „Kõik sammud"). Kui
 * mõni samm on siiski paneelist pikem, kerib kõigepealt kogu paneeli sisu ja
 * samm vahetub alles lõpus.
 *
 * PANEEL EI HÜPLE. Lava hoiab kõigil sammudel sama kõrgust (kõrgeima sammu
 * oma, kuni see paneeli mahub), nii et pealkiri ja „Edasi" on igal sammul
 * samas kohas (`StepPanel` kinnitab tegevusrea alla).
 *
 * KASUTUS.
 *   <StepFlight label="Kiirkontrolli sammud" steps={steps}>
 *     {(step, index, flight) => <StepPanel …>…</StepPanel>}
 *   </StepFlight>
 * `steps`: [{ key, label, short?, state?: "empty" | "partial" | "done", summary? }]
 *   (`state` on numbriringi täide, `summary` üks-kaks rida vaates „Kõik sammud")
 * `flight`: { index, count, isActive, goTo(index), next(), prev() }
 *
 * Kujundus: StepFlight.module.css (selle faili kõrval).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import useStationFlight from "@/components/register/useStationFlight";
import { usePanelInfoView } from "@/components/ui/PanelInfoSlot";

import StepRail, { StepNumber } from "./StepRail";
import styles from "./StepFlight.module.css";

/* Ooteaeg ≥ lennu kestus: järgmine kerimisnõks ei tohi pooleli lendu katkestada
   (sama põhjendus mis AccessibilityModal'is). */
const FLIGHT_COOLDOWN_MS = 560;
/* Pärast lehe kerimist jääb rull hetkeks lehe omaks: üks pikk kerimisliigutus ei
   tohi lehe lõppu jõudes kohe ka sammu vahetada. */
const SETTLE_AFTER_SCROLL_MS = 280;
const WHEEL_INTENT = 48;
const SWIPE_MIN = 56;

/** Kas mõni kerivkast sihtmärgi ja dokumendi vahel saab selles suunas veel kerida? */
function ancestorCanScroll(start, delta) {
  let node = start instanceof Element ? start : null;
  while (node && node !== document.documentElement) {
    if (node.scrollHeight > node.clientHeight + 1) {
      const overflowY = window.getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        if (delta < 0 && node.scrollTop > 0) return true;
        if (delta > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

function closestScroller(start) {
  let node = start?.parentElement || null;
  while (node && node !== document.documentElement) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

/** Kui kõrge võib lava olla, et paneeli sisu ei peaks kerima. */
function fitHeight(stage) {
  const scroller = closestScroller(stage);
  const frame = scroller?.parentElement;
  if (!scroller || !frame) return Infinity;
  const max = parseFloat(window.getComputedStyle(frame).maxHeight);
  if (!Number.isFinite(max)) return Infinity;
  const chrome = frame.offsetHeight - scroller.clientHeight;
  const others = scroller.scrollHeight - stage.offsetHeight;
  return Math.max(0, max - chrome - others);
}

/** Sammu sisu enda kõrgus: ilma venituseta, mille `StepPanel` lisab lava täitmiseks. */
function naturalHeight(plane) {
  let height = plane.offsetHeight;
  plane.querySelectorAll("[data-step-spacer]").forEach((spacer) => {
    height -= spacer.offsetHeight;
  });
  return height;
}

function isTypingTarget(target) {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function WideIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}

export default function StepFlight({ steps, children, label, initialIndex = 0, onStepChange }) {
  const { t } = useI18n();
  const count = steps.length;
  const { dollyRef, planeProps, activeIndex, mode, flyTo } = useStationFlight({
    count,
    initialIndex,
    /* Pehmem läbiliikumine nagu ligipääsetavuse vaates: lahkuv samm hajub
       pikemalt, enne kui kaamera temani jõuab. */
    fadeLength: 420,
    smoothFade: true,
    durationScale: 1.1
  });
  const [wide, setWide] = useState(false);
  const [stageHeight, setStageHeight] = useState(null);
  /* „Keri" vihje on näha, kuni inimene on korra sammu vahetanud (sama reegel
     mis keele ja ligipääsetavuse vaates): et oleks aru saada, et kerimine
     vahetab siin sammu, mitte ei keri lehte. */
  const [moved, setMoved] = useState(false);
  const infoOpen = usePanelInfoView().open;

  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const planesRef = useRef(new Map());
  const activeRef = useRef(activeIndex);
  const wideRef = useRef(wide);
  const hoverRef = useRef(null);
  const focusPendingRef = useRef(false);
  activeRef.current = activeIndex;
  wideRef.current = wide;

  /* `user`: inimene valis sammu ise (riba, plaat, nupp). Siis läheb fookus uue
     sammu pealkirjale, sest eelmine samm muutub `inert`-iks. Kerimisel fookust
     ei liigutata. */
  const goTo = useCallback(
    (index, { user = false, arrive = false } = {}) => {
      const next = Math.max(0, Math.min(count - 1, index));
      const wasWide = wideRef.current;
      if (wasWide) setWide(false);
      if (next === activeRef.current && !wasWide && !arrive) return;
      focusPendingRef.current = user;
      /* Laiast vaatest tulles triivib samm õrnalt kohale (sisse suumimise tunne),
         mitte ei mängi tervet lendu läbi kõigi vahepealsete sammude. */
      flyTo(next, wasWide ? { drift: true } : undefined);
    },
    [count, flyTo]
  );
  const openWide = useCallback(() => {
    hoverRef.current = null;
    setWide(true);
  }, []);

  useEffect(() => {
    onStepChange?.(activeIndex);
  }, [activeIndex, onStepChange]);

  useEffect(() => {
    if (activeIndex !== initialIndex || wide) setMoved(true);
  }, [activeIndex, initialIndex, wide]);

  /* Lava kõrgus. Jaamad on absoluutselt paigutatud ega anna lavale ise
     kõrgust, seega mõõdame. Lava on nii kõrge kui kõrgeim samm (et paneel sammu
     vahetudes ei hüpleks), aga mitte kõrgem, kui paneeli kerimata mahub; sellest
     pikem samm saab oma kõrguse ja siis kerib kogu paneeli sisu. */
  useLayoutEffect(() => {
    if (wide) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;
    const apply = () => {
      const active = planesRef.current.get(activeRef.current);
      if (!active) return;
      let tallest = 0;
      planesRef.current.forEach((plane) => {
        tallest = Math.max(tallest, naturalHeight(plane));
      });
      const steady = Math.min(tallest, fitHeight(stage));
      setStageHeight(Math.ceil(Math.max(naturalHeight(active), steady)));
    };
    apply();
    window.addEventListener("resize", apply);
    let observer = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(apply);
      planesRef.current.forEach((plane) => observer.observe(plane));
    }
    return () => {
      window.removeEventListener("resize", apply);
      observer?.disconnect();
    };
  }, [activeIndex, wide, count]);

  /* Fookus uue sammu pealkirjale. Saabuv samm on lennu alguses veel peidus
     (mootor lülitab ta nähtavaks, kui kaamera läheneb) ja peidetud elementi
     fokuseerida ei saa, seepärast proovime kaadrite kaupa, kuni see õnnestub. */
  useEffect(() => {
    if (wide || !focusPendingRef.current) return undefined;
    focusPendingRef.current = false;
    const heading = planesRef.current.get(activeIndex)?.querySelector("[data-step-heading]");
    if (!heading) return undefined;
    let frame = 0;
    const deadline = performance.now() + 1500;
    const tryFocus = () => {
      heading.focus({ preventScroll: true });
      if (document.activeElement === heading || performance.now() > deadline) return;
      frame = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, wide]);

  /* Rull ja svaip. Kuulajad lisatakse käsitsi, sest `wheel` peab olema
     mitte-passiivne (preventDefault), mida Reacti onWheel ei luba. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const state = { until: 0, lastScroll: 0, sum: 0 };

    const fly = (direction, stamp) => {
      if (stamp < state.until) return;
      if (wideRef.current) {
        if (direction > 0) {
          goTo(hoverRef.current ?? activeRef.current, { arrive: true });
          state.until = stamp + FLIGHT_COOLDOWN_MS;
        }
        return;
      }
      const next = activeRef.current + direction;
      if (next > count - 1) return;
      if (next < 0) openWide();
      else goTo(next);
      state.until = stamp + FLIGHT_COOLDOWN_MS;
    };

    const onWheel = (event) => {
      if (event.ctrlKey || Math.abs(event.deltaY) < 4 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (ancestorCanScroll(event.target, event.deltaY)) {
        state.lastScroll = event.timeStamp;
        state.sum = 0;
        return;
      }
      if (event.timeStamp - state.lastScroll < SETTLE_AFTER_SCROLL_MS) {
        state.lastScroll = event.timeStamp;
        return;
      }
      event.preventDefault();
      state.sum += event.deltaY;
      if (Math.abs(state.sum) < WHEEL_INTENT) return;
      const direction = state.sum > 0 ? 1 : -1;
      state.sum = 0;
      fly(direction, event.timeStamp);
    };

    let start = null;
    const onTouchStart = (event) => {
      const touch = event.touches[0];
      start = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY, target: event.target } : null;
    };
    const onTouchEnd = (event) => {
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const dy = start.y - touch.clientY;
      const dx = start.x - touch.clientX;
      const target = start.target;
      start = null;
      if (Math.abs(dy) < SWIPE_MIN || Math.abs(dx) > Math.abs(dy)) return;
      if (isTypingTarget(target) || ancestorCanScroll(target, dy)) return;
      fly(dy > 0 ? 1 : -1, event.timeStamp);
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchend", onTouchEnd);
    };
  }, [count, goTo, openWide]);

  const onKeyDown = (event) => {
    if (isTypingTarget(event.target)) return;
    if (event.key === "PageDown") {
      event.preventDefault();
      if (wide) goTo(hoverRef.current ?? activeIndex, { user: true, arrive: true });
      else if (activeIndex < count - 1) goTo(activeIndex + 1, { user: true });
    } else if (event.key === "PageUp") {
      event.preventDefault();
      if (wide) return;
      if (activeIndex > 0) goTo(activeIndex - 1, { user: true });
      else openWide();
    }
  };

  const position = useMemo(() => {
    const step = steps[activeIndex] || steps[0];
    if (wide) return t("stage.all_steps");
    return t("stage.step_position", { current: activeIndex + 1, total: count, label: step?.label || "" });
  }, [activeIndex, count, steps, t, wide]);

  return (
    <div className={styles.root} ref={rootRef} onKeyDown={onKeyDown}>
      <p className="sr-only" aria-live="polite">
        {position}
      </p>

      <StepRail
        steps={steps}
        activeIndex={wide ? -1 : activeIndex}
        hidden={infoOpen}
        label={label ? `${label}: ${t("stage.rail_label")}` : t("stage.rail_label")}
        stepLabel={(step, index) => t("stage.step_position", { current: index + 1, total: count, label: step.label })}
        onSelect={(index) => goTo(index, { user: true, arrive: true })}
        end={
          <button
            type="button"
            className={`${styles.wideToggle} gc-shortcut`}
            data-on={wide ? "1" : "0"}
            aria-pressed={wide}
            aria-label={t("stage.all_steps")}
            title={t("stage.all_steps")}
            onClick={() => (wide ? goTo(activeIndex, { user: true, arrive: true }) : openWide())}
          >
            <span className="gc-shortcut-icon" aria-hidden="true">
              <WideIcon />
            </span>
          </button>
        }
      />

      {/* Telefonis ei mahu lehe nimi sammude kõrvale kiirmenüüsse; siis ütleb
          selle leht ise. Ekraanilugeja kuuleb sama ülalolevast teatest. */}
      <p className={styles.kicker} aria-hidden="true">
        {label ? `${label} · ` : ""}
        {wide ? t("stage.all_steps") : `${activeIndex + 1}/${count}`}
      </p>

      <div
        className={styles.stage}
        ref={stageRef}
        data-mode={mode}
        data-wide={wide ? "1" : "0"}
        style={!wide && stageHeight ? { "--step-stage-h": `${stageHeight}px` } : undefined}
      >
        {!wide && !moved && count > 1 ? (
          <div className={styles.hint} aria-hidden="true">
            <span className="scroll-frames" />
            <span className={styles.hintLabel}>{t("room.scroll_label")}</span>
          </div>
        ) : null}
        <div className={styles.dolly} ref={dollyRef}>
          {steps.map((step, index) => {
            const { ref: registerPlane, ...plane } = planeProps(index);
            return (
              <section
                key={step.key}
                {...plane}
                ref={(element) => {
                  registerPlane(element);
                  if (element) planesRef.current.set(index, element);
                  else planesRef.current.delete(index);
                }}
                className={styles.plane}
                aria-label={step.label}
              >
                {children(step, index, {
                  index,
                  count,
                  isActive: !wide && index === activeIndex,
                  goTo: (target) => goTo(target, { user: true }),
                  next: () => goTo(index + 1, { user: true }),
                  prev: () => goTo(index - 1, { user: true })
                })}
              </section>
            );
          })}
        </div>

        {wide ? (
          <ol className={styles.overview} aria-label={t("stage.all_steps")}>
            {steps.map((step, index) => (
              <li key={step.key}>
                <button
                  type="button"
                  className={styles.tile}
                  data-current={index === activeIndex ? "1" : "0"}
                  onPointerEnter={() => {
                    hoverRef.current = index;
                  }}
                  onFocus={() => {
                    hoverRef.current = index;
                  }}
                  onClick={() => goTo(index, { user: true, arrive: true })}
                >
                  <span className={styles.tileTop}>
                    <StepNumber index={index} state={step.state || "empty"} />
                    <span className={styles.tileTitle}>{step.label}</span>
                  </span>
                  {step.summary ? <span className={styles.tileSummary}>{step.summary}</span> : null}
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
