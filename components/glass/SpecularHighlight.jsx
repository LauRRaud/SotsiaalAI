"use client";

/**
 * SpecularHighlight — kursorit jälgiv specular-läige klaas-pindadel
 * (react-bits Specular Button adaptsioon: canvas-shaderi asemel üks
 * CSS-taustakiht --specular-layer, mida juhib see moodul).
 *
 * Üks passiivne pointermove-kuular kogu dokumendil: leiab kursori all
 * oleva klaaselemendi (nupp/väli), seab tema kohal --spec-x/--spec-y
 * protsendina ja tõstab --spec sujuvalt 1-ni; lahkumisel langeb 0-ni.
 * Materjali/paigutust EI muuda — ainult kolm CSS-muutujat aktiivsel
 * elemendil. Puuteseadmed (hover puudub) ja reduce-motion jäävad välja
 * (viimane ka CSS-tasandil, --spec-peak: 0 kaudu).
 *
 * NB: kirjutame igal kaadril AINULT aktiivsele elemendile ja lerbime
 * --spec ainult liikumise ajal — paigalseisus rAF magab.
 */

import { useEffect } from "react";

const SPEC_SELECTOR = [
  ".glass-btn",
  "button[data-variant]",
  "a[data-variant]",
  ".glass-iconbtn",
  ".login-keypad-btn",
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not(.sr-only)',
  "textarea",
  "select",
].join(",");

export default function SpecularHighlight() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let active = null; // element, mida praegu animeerime
    let target = 0; // soovitud heledus (1 kursor peal, 0 lahkumisel)
    let value = 0; // lerbitud heledus
    let raf = 0;

    const clear = (el) => {
      if (!el) return;
      el.style.removeProperty("--spec");
      el.style.removeProperty("--spec-x");
      el.style.removeProperty("--spec-y");
    };

    const tick = () => {
      raf = 0;
      value += (target - value) * 0.18;
      if (Math.abs(target - value) < 0.004) value = target;
      if (active) active.style.setProperty("--spec", value.toFixed(3));
      if (value !== target) {
        raf = requestAnimationFrame(tick);
      } else if (value === 0) {
        // Täielikult hääbunud → puhasta ja vabasta element.
        clear(active);
        active = null;
      }
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (e) => {
      // Puude ei hõlju — jäta specular vahele (lühike sähvatus muidu).
      if (e.pointerType === "touch") return;
      const hit = e.target?.closest?.(SPEC_SELECTOR) || null;

      if (hit && hit !== active) {
        clear(active); // vana snäpib kohe välja, uus võtab üle
        active = hit;
      }
      if (!hit) {
        target = 0; // kursor läks tühja → hääbu (aktiivne jääb kuni 0)
        wake();
        return;
      }

      target = 1;
      const r = active.getBoundingClientRect();
      if (r.width && r.height) {
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        active.style.setProperty("--spec-x", x.toFixed(1) + "%");
        active.style.setProperty("--spec-y", y.toFixed(1) + "%");
      }
      wake();
    };

    const onLeaveWindow = () => {
      target = 0;
      wake();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("blur", onLeaveWindow);
    document.addEventListener("pointercancel", onLeaveWindow, { passive: true });

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onMove);
      window.removeEventListener("blur", onLeaveWindow);
      document.removeEventListener("pointercancel", onLeaveWindow);
      if (raf) cancelAnimationFrame(raf);
      clear(active);
    };
  }, []);

  return null;
}
