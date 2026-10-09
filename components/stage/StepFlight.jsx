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
 * SAMM ON KIIRMENÜÜS, mitte klaaspaneeli sees: all kiirmenüüs lehe nime kõrval
 * (`StepRail`, `DockSteps`). Paneel on ainult sisu jaoks.
 *
 * KERIMINE VAHETAB SISU KOHAPEAL. Sammud on tehtud nii, et üks samm mahub
 * paneeli ära; siis viib sisse kerimine järgmise sammu juurde ja välja kerimine
 * eelmise juurde (esimeselt sammult välja kerides avaneb „Kõik sammud"). Kui
 * mõni samm on siiski paneelist pikem, kerib kõigepealt kogu paneeli sisu ja
 * samm vahetub alles lõpus.
 *
 * PANEEL EI HÜPLE. Lava hoiab kõigil sammudel sama kõrgust (kõrgeima sammu
 * oma, kuni see paneeli mahub).
 *
 * EDASI LIIGUTAKSE KIIRMENÜÜST. Paneelis ei ole „Edasi" nuppu ega kerimise
 * vihjet (omanik 09.10: need klaaskasti juurde ei sobi). Kiirmenüüs on
 * „3/12 sammu nimi" ja nool „Järgmine samm", mis süttib, kui ees olev samm on
 * tehtud. Sammude rida seal ei seisa (see venitas kiirmenüü liiga pikaks):
 * vajutus sammu nimele avab kõik sammud kiirmenüüs ja valik tõmbab selle
 * tagasi lühikeseks. Leht võib ka ise edasi viia (`flight.next()`), kui vaade
 * sai vastatud.
 *
 * KASUTUS.
 *   <StepFlight label="Kiirkontrolli sammud" steps={steps}>
 *     {(step, index, flight) => <StepPanel …>…</StepPanel>}
 *   </StepFlight>
 * `steps`: [{ key, label, short?, state?: "empty" | "partial" | "done", summary?, free? }]
 *   (`state` on sammu numbri heledus, `summary` üks-kaks rida vaates „Kõik sammud",
 *   `free` märgib vaate, mis võib olla pikk ja mille järgi ühist kõrgust ei võeta)
 * `flight`: { index, count, isActive, goTo(index), next(), prev() }
 *
 * LAUD, MITTE SAMMUD. Sama lava kannab ka lehte, mille osad ei ole järjestikused
 * sammud, vaid ühe laua osad (Juhtumitöö laud): `parts` ütleb seda. Siis ei ole
 * osadel numbreid (ei plaatidel ega kiirmenüüs) ega noolt „järgmine": kiirmenüüs
 * on nupp laia vaate juurde ja avatud osa nimi. `startWide` avab lehe laias
 * vaates (kõik osad korraga), `texts` annab lehe enda sõnad (`all`: laia vaate
 * nimi, `position(current, total, label)`: ekraanilugeja teade) ja `wideLead`
 * on laia vaate sissejuhatus plaatide kohal.
 *
 * JUHITUD KASUTUS. Kui lehe enda olek otsustab, milline samm on ees (nt pärast
 * salvestamist „mine eelvaatesse"), anna `activeKey` (sammu võti) ja kuula
 * `onStepChange(index, step)`. Võtme muutus lennutab selle sammu juurde;
 * kerimine ja kiirmenüü teatavad uuest sammust tagasi.
 *
 * Kujundus: StepFlight.module.css (selle faili kõrval).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import useStationFlight from "@/components/register/useStationFlight";
import { usePanelInfoView } from "@/components/ui/PanelInfoSlot";

import { ancestorCanScroll, isTypingTarget } from "./scroll";
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

export default function StepFlight({ steps, children, label, initialIndex = 0, activeKey, onStepChange, startWide = false, parts = false, texts = null, wideLead = null }) {
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
  const [wide, setWide] = useState(Boolean(startWide));
  const allText = texts?.all || t("stage.all_steps");
  const positionText = useCallback(
    (index, step) =>
      texts?.position
        ? texts.position(index + 1, count, step?.label || "")
        : t("stage.step_position", { current: index + 1, total: count, label: step?.label || "" }),
    [count, t, texts]
  );
  const [stageHeight, setStageHeight] = useState(null);
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

  /* Teatame sammu vahetusest ainult siis, kui samm päriselt vahetus: muidu
     kirjutaks esimene joonistus lehe oleku üle. */
  const reportedRef = useRef(activeIndex);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  useEffect(() => {
    if (reportedRef.current === activeIndex) return;
    reportedRef.current = activeIndex;
    onStepChange?.(activeIndex, stepsRef.current[activeIndex]);
  }, [activeIndex, onStepChange]);

  /* Lehe olek juhib sammu: võtme muutus lennutab selle sammu juurde. */
  useEffect(() => {
    if (activeKey === undefined || activeKey === null) return;
    const index = stepsRef.current.findIndex((step) => step.key === activeKey);
    if (index < 0 || (index === activeRef.current && !wideRef.current)) return;
    goTo(index, { user: true, arrive: true });
  }, [activeKey, goTo]);

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
      /* Ühine kõrgus tuleb tavalistest vaadetest. Vaade, mis võib olla pikk
         (loend, lugemine; kirjelduses `free`), ei tee teisi enda kõrguseks. */
      let tallest = 0;
      planesRef.current.forEach((plane, index) => {
        if (stepsRef.current[index]?.free) return;
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
    if (wide) return allText;
    return positionText(activeIndex, steps[activeIndex] || steps[0]);
  }, [activeIndex, allText, positionText, steps, wide]);

  return (
    <div className={styles.root} ref={rootRef} onKeyDown={onKeyDown}>
      <p className="sr-only" aria-live="polite">
        {position}
      </p>

      <StepRail
        steps={steps}
        activeIndex={activeIndex}
        wide={wide}
        hidden={infoOpen}
        label={label ? `${label}: ${t("stage.rail_label")}` : t("stage.rail_label")}
        allLabel={allText}
        stepLabel={(step, index) => positionText(index, step)}
        onSelect={(index) => goTo(index, { user: true, arrive: true })}
        onOverview={openWide}
        parts={parts}
        next={parts ? null : {
          label: t("stage.next_step"),
          disabled: !wide && activeIndex >= count - 1,
          ready: !wide && steps[activeIndex]?.state === "done",
          onClick: () => (wide ? goTo(hoverRef.current ?? activeIndex, { user: true, arrive: true }) : goTo(activeIndex + 1, { user: true }))
        }}
      />

      {/* Telefonis on kiirmenüüs ainult „3/12"; lehe ja sammu nime ütleb
          siis see rida. Ekraanilugeja kuuleb sama ülalolevast teatest. */}
      <p className={styles.kicker} aria-hidden="true">
        {label ? `${label} · ` : ""}
        {wide ? allText : `${steps[activeIndex]?.short || steps[activeIndex]?.label || ""}${parts ? "" : ` · ${activeIndex + 1}/${count}`}`}
      </p>

      <div
        className={styles.stage}
        ref={stageRef}
        data-mode={mode}
        data-wide={wide ? "1" : "0"}
        style={!wide && stageHeight ? { "--step-stage-h": `${stageHeight}px` } : undefined}
      >
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

        {wide && wideLead ? <div className={styles.wideLead}>{wideLead}</div> : null}
        {wide ? (
          <ol className={styles.overview} aria-label={allText}>
            {steps.map((step, index) => (
              <li key={step.key}>
                <button
                  type="button"
                  className={styles.tile}
                  data-current={index === activeIndex && !parts ? "1" : "0"}
                  data-state={step.state || "empty"}
                  data-parts={parts ? "1" : undefined}
                  onPointerEnter={() => {
                    hoverRef.current = index;
                  }}
                  onFocus={() => {
                    hoverRef.current = index;
                  }}
                  onClick={() => goTo(index, { user: true, arrive: true })}
                >
                  <span className={styles.tileTop}>
                    {parts ? null : <StepNumber index={index} state={step.state || "empty"} />}
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
