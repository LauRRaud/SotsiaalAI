"use client";

/**
 * StepRail — samm kiirmenüüs: kus ma olen, nool edasi ja soovi korral kõik sammud.
 *
 * LÜHIKE KUJU (tavaline). Kiirmenüüs on „3/12 Kelle kohta" ja nool „Järgmine
 * samm". Sammude rida seal ei seisa: kaksteist numbrit venitas kiirmenüü liiga
 * pikaks (omanik 09.10). Laias vaates seisab sammu asemel laia vaate nimi
 * („Kõik sammud", Juhtumitöö laual „Kogu laud").
 *
 * PIKK KUJU (vajutusel). Vajutus sammu nimele avab kõik sammud samas
 * kiirmenüüs: numbrite rida, kus aktiivne samm on nimega. Sammu valimine viib
 * sinna ja tõmbab kiirmenüü tagasi lühikeseks; sama teeb sammu vahetumine
 * (kerimine, nool), vajutus aktiivsele sammule, vajutus mujale ja Esc.
 *
 * Pika kuju esimene nupp avab laia vaate („Kõik sammud" paneelis), kui leht
 * selle annab (`onOverview`). Lühikeses kujus seda ei ole: kiirmenüü jääb lühike.
 *
 * LAUA OSAD (`parts`). Kui osad ei ole sammud (Juhtumitöö laud), ei ole
 * kiirmenüüs numbreid ega avatavat rida: seal on nupp laia vaate juurde
 * („Kogu laud") ja avatud osa nimi. Kõik on kohe näha (omanik 09.10: vajutuse
 * taha peidetud valikutest ei saanud aru).
 *
 * Aktiivse sammu nupp on mõlemas kujus SAMA element (lühikeses „3/12 nimi",
 * pikas „3 nimi"): nii ei kao klaviatuuri fookus, kui rida avaneb või sulgub.
 *
 * Numbrite ümber ei ole rõngast (omanik 09.10): tehtud samm on heledam, ootel
 * samm tuhmim. Nool „Järgmine samm" on ainus „edasi" nupp (paneelis seda ei
 * ole) ja süttib, kui ees olev samm on tehtud.
 *
 * Telefonis on lühikeses kujus ainult „3/12" (doki üldreegel peidab seal
 * teksti); sammu nime ütleb siis rida paneeli ülaservas (StepFlight).
 *
 * Joonistatakse alumisse kiirmenüüsse lehe nime kõrvale (`DockSteps`); lehel,
 * kus kiirmenüüd ei ole, seisab omaette pillina samas kohas ekraani all.
 * Kannab kiirmenüü klasse (`gc-shortcut-*`, carousel.css).
 *
 * `steps`: [{ key, label, short?, state?: "empty" | "partial" | "done" }]
 * `next`: { label, disabled, ready, onClick }.
 *
 * Kujundus: StepRail.module.css.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { NextArrowIcon, OverviewGridIcon } from "@/components/brand/icons/CardIcons";
import useQuickMenuMotion from "@/components/ui/useQuickMenuMotion";

import { useDockStepsSlot } from "./DockSteps";
import styles from "./StepRail.module.css";

/** Sammu number ringis: vaate „Kõik sammud" plaatidel. */
export function StepNumber({ index, state = "empty" }) {
  return (
    <span className={styles.num} data-state={state}>
      {index + 1}
    </span>
  );
}

/* Täisnimi, kui see mahub kiirmenüüsse lõikamata (umbes 18 tähte); muidu lühinimi. */
const nameOf = (step) => (String(step?.label || "").length <= 18 ? step?.label : step?.short || step?.label);

export default function StepRail({ steps, activeIndex, wide = false, parts = false, onSelect, onOverview, label, allLabel, stepLabel, next = null, hidden = false }) {
  const { slot, hasDock } = useDockStepsSlot();
  const trackRef = useRef(null);
  /* Rida on lahti selle sammu jaoks, mille pealt see avati: kui samm vahetub
     (valik, kerimine, nool), on kiirmenüü jälle lühike. */
  const [openedAt, setOpenedAt] = useState(null);
  const opened = openedAt === activeIndex;
  /* Pikk kuju tuleb ainult vajutusest. Ka laias vaates („Kõik sammud"
     paneelis) on kiirmenüü lühike: seal seisab laia vaate nimi. */
  const open = opened;
  useQuickMenuMotion(trackRef, open ? `open:${activeIndex}` : activeIndex);

  /* Pikas kujus keritakse aktiivne samm nähtavale (kitsal ekraanil ei mahu kõik). */
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !open) return undefined;
    const reveal = () => {
      const active = track.querySelector('[data-current="1"]');
      if (!active || track.scrollWidth <= track.clientWidth) return;
      const item = active.getBoundingClientRect();
      const bounds = track.getBoundingClientRect();
      track.scrollTo({ left: Math.max(0, track.scrollLeft + item.left - bounds.left + item.width / 2 - track.clientWidth / 2) });
    };
    reveal();
    const timer = window.setTimeout(reveal, 340);
    return () => window.clearTimeout(timer);
  }, [activeIndex, open, slot]);

  /* Vajutus mujale tõmbab rea kokku: kiirmenüü on pikk ainult valimise ajaks. */
  useEffect(() => {
    if (!opened) return undefined;
    const onPointerDown = (event) => {
      if (!trackRef.current?.contains(event.target)) setOpenedAt(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [opened]);

  /* Esc sulgeb ainult rea, mitte lehte (`data-esc-scope`, vt PanelFrame). Fookus
     läheb aktiivsele sammule, sest teised nupud kaovad. */
  const onKeyDown = (event) => {
    if (!opened || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    trackRef.current?.querySelector('[data-current="1"]')?.focus({ preventScroll: true });
    setOpenedAt(null);
  };

  if (hidden) return null;

  const current = steps[activeIndex] || steps[0];
  const rail = parts ? (
    <>
      <span className={`${styles.lead} gc-shortcut-divider`} aria-hidden="true" />
      <div className={`${styles.track} gc-shortcut-track`} data-open="0" role="group" aria-label={label} ref={trackRef}>
        <button
          type="button"
          className={`${styles.where} gc-shortcut`}
          data-on={wide ? "1" : "0"}
          aria-pressed={wide}
          aria-label={allLabel}
          title={allLabel}
          onClick={() => {
            if (!wide) onOverview?.();
          }}
        >
          <span className="gc-shortcut-icon" aria-hidden="true">
            <OverviewGridIcon />
          </span>
          <span className="gc-shortcut-text" aria-hidden="true">
            {allLabel}
          </span>
        </button>
        {wide ? null : (
          <span className={`${styles.part} gc-shortcut`} data-on="1" aria-current="step" aria-label={stepLabel(current, activeIndex)}>
            <span className="gc-shortcut-text" aria-hidden="true">
              {nameOf(current)}
            </span>
          </span>
        )}
      </div>
    </>
  ) : (
    <>
      <span className={`${styles.lead} gc-shortcut-divider`} aria-hidden="true" />
      <div
        className={`${styles.track} gc-shortcut-track`}
        data-open={open ? "1" : "0"}
        data-esc-scope={opened ? "" : undefined}
        role="group"
        aria-label={label}
        ref={trackRef}
        onKeyDown={onKeyDown}
      >
        {/* Lai vaade: lühikeses kujus on see ainus kirje („Kogu laud"), pikas
            kujus rea esimene nupp. Sama element mõlemas, et fookus ei kaoks. */}
        {(open && onOverview) || (!open && wide) ? (
          <button
            key="__all"
            type="button"
            className={`${open ? styles.all : styles.where} gc-shortcut`}
            data-on={open && wide ? "1" : "0"}
            data-current={wide ? "1" : "0"}
            aria-pressed={open ? wide : undefined}
            aria-expanded={open ? undefined : false}
            aria-label={allLabel}
            title={allLabel}
            onClick={() => {
              if (!open) {
                setOpenedAt(activeIndex);
                return;
              }
              setOpenedAt(null);
              if (!wide) onOverview?.();
            }}
          >
            <span className="gc-shortcut-icon" aria-hidden="true">
              <OverviewGridIcon />
            </span>
            <span className="gc-shortcut-text" aria-hidden="true">
              {allLabel}
            </span>
          </button>
        ) : null}
        {steps.map((item, index) => {
          const current = index === activeIndex;
          if (!open && (!current || wide)) return null;
          /* Laias vaates ei ole ükski samm ees: seal on kõik võrdsed. */
          const active = current && !wide;
          return (
            <button
              key={item.key}
              type="button"
              className={`${open ? styles.step : styles.where} gc-shortcut`}
              data-on={open && active ? "1" : "0"}
              data-current={current && !wide ? "1" : "0"}
              data-state={item.state || "empty"}
              aria-current={open && active ? "step" : undefined}
              aria-expanded={current && !wide ? opened : undefined}
              aria-label={current && !open ? `${stepLabel(item, index)}. ${allLabel}` : stepLabel(item, index)}
              title={open ? item.label : allLabel}
              onClick={() => {
                if (!open) {
                  setOpenedAt(activeIndex);
                  return;
                }
                setOpenedAt(null);
                if (!active) onSelect?.(index);
              }}
            >
              <span className={open ? styles.digit : styles.count} aria-hidden="true">
                {open ? index + 1 : `${index + 1}/${steps.length}`}
              </span>
              <span className="gc-shortcut-text" aria-hidden="true">
                {nameOf(item)}
              </span>
            </button>
          );
        })}
      </div>
      {next ? (
        <button
          type="button"
          className={`${styles.next} gc-shortcut`}
          data-on="0"
          data-ready={next.ready ? "1" : "0"}
          aria-label={next.label}
          title={next.label}
          disabled={next.disabled}
          onClick={next.onClick}
        >
          <span className="gc-shortcut-icon" aria-hidden="true">
            <NextArrowIcon />
          </span>
        </button>
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
