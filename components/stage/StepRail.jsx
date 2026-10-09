"use client";

/**
 * StepRail — sammud kiirmenüüs.
 *
 * Numbritega sammud ühel ribal: aktiivse sammu nimi on välja kirjutatud, tehtud
 * samm on täidetud ringiga. Riba joonistatakse alumisse kiirmenüüsse lehe nime
 * kõrvale (`DockSteps`); lehel, kus kiirmenüüd ei ole, seisab ta omaette pillina
 * samas kohas ekraani all. Klaaspaneeli sisse sammuriba ei käi.
 *
 * Kannab kiirmenüü klasse (`gc-shortcut-*`, carousel.css), et näeks välja ja
 * liiguks nagu dokk ise.
 *
 * `steps`: [{ key, label, short?, state?: "empty" | "partial" | "done" }]
 * `activeIndex`: aktiivne samm või -1, kui ükski samm ei ole ees (lai vaade).
 * `end`: lisanupp riba lõpus (nt „Kõik sammud").
 *
 * Kujundus: StepRail.module.css.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import useQuickMenuMotion, { useQuickMenuIndex } from "@/components/ui/useQuickMenuMotion";

import { useDockStepsSlot } from "./DockSteps";
import styles from "./StepRail.module.css";

/** Sammu number ringis; sama märk on ka vaate „Kõik sammud" plaatidel. */
export function StepNumber({ index, state = "empty" }) {
  return (
    <span className={styles.num} data-state={state}>
      {index + 1}
    </span>
  );
}

export default function StepRail({ steps, activeIndex, onSelect, label, stepLabel, end = null, hidden = false }) {
  const { slot, hasDock } = useDockStepsSlot();
  const trackRef = useRef(null);
  /* Sihtkoht jõuab enne nähtavale, kui riba esiletõst vahetub (sama võte mis dokil). */
  const shownIndex = useQuickMenuIndex(activeIndex, 240);
  useQuickMenuMotion(trackRef, shownIndex);

  /* Kitsal ekraanil ei mahu kõik sammud ribale: aktiivne samm keritakse nähtavale. */
  useEffect(() => {
    const track = trackRef.current;
    if (!track || shownIndex < 0) return undefined;
    const reveal = () => {
      const active = track.querySelector('[data-on="1"]');
      if (!active || track.scrollWidth <= track.clientWidth) return;
      const item = active.getBoundingClientRect();
      const bounds = track.getBoundingClientRect();
      const left = track.scrollLeft + item.left - bounds.left + item.width / 2 - track.clientWidth / 2;
      const reduced =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        document.documentElement.dataset.reduceMotion === "1";
      track.scrollTo({ left: Math.max(0, left), behavior: reduced ? "auto" : "smooth" });
    };
    reveal();
    /* Uuesti pärast seda, kui aktiivse sammu silt on oma laiuseni avanenud. */
    const timer = window.setTimeout(reveal, 340);
    return () => window.clearTimeout(timer);
  }, [shownIndex, slot]);

  if (hidden) return null;

  const rail = (
    <>
      <span className={`${styles.lead} gc-shortcut-divider`} aria-hidden="true" />
      <div className={`${styles.track} gc-shortcut-track`} role="group" aria-label={label} ref={trackRef}>
        {steps.map((step, index) => (
          <button
            key={step.key}
            type="button"
            className={`${styles.step} gc-shortcut`}
            data-on={index === shownIndex ? "1" : "0"}
            aria-current={index === activeIndex ? "step" : undefined}
            aria-label={stepLabel ? stepLabel(step, index) : step.label}
            title={step.label}
            onClick={() => onSelect?.(index)}
          >
            <span className="gc-shortcut-icon" aria-hidden="true">
              <StepNumber index={index} state={step.state || "empty"} />
            </span>
            <span className="gc-shortcut-text" aria-hidden="true">
              {step.short || step.label}
            </span>
          </button>
        ))}
      </div>
      {end ? (
        <>
          <span className="gc-shortcut-divider" aria-hidden="true" />
          {end}
        </>
      ) : null}
    </>
  );

  /* Dokiga lehel elab riba dokis; kuni dokk on peidus (modaal lahti), ei joonista midagi. */
  if (hasDock) return slot ? createPortal(rail, slot) : null;

  /* Dokita lehel: omaette pill samas kohas, kus dokk muidu seisab. */
  return (
    <div className={styles.own}>
      <div className={`${styles.ownMenu} gc-shortcut-menu`}>{rail}</div>
    </div>
  );
}
