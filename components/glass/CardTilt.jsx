"use client";

/**
 * CardTilt — kursorit jälgiv kalle karussellikaardil (react-bits
 * TiltedCard adaptsioon: motion-springide asemel kaks CSS-muutujat).
 *
 * MIKS mitte TiltedCard ise: see komponent on ehitatud PILDI ümber
 * (`figure` + `img` + `imageSrc`) ja toob oma kesta. Meie kaardid on
 * klaaspinnad ikooni ja sildiga — komponendi sissetoomine tähendaks
 * kaardi kujunduse väljavahetamist. Efekt on see, mida taheti, mitte
 * kest: võtame kalde ja jätame klaasi.
 *
 * Üks passiivne pointermove kogu dokumendil leiab kursori all oleva
 * `.gc-card`-i ja seab tema kohal --tilt-x/--tilt-y. Reacti olekut ei
 * puudutata (karussellis on iga kaart oma komponent — olek tähendaks
 * renderdust iga hiirekaadri kohta).
 *
 * Karussell ise pöörab juba `.gc-item`-i (asend real). Kalle läheb
 * seetõttu SISEMISELE `.gc-card`-ile: kaks transformi kahel elemendil
 * liituvad, üks ei kirjuta teist üle.
 */

import { useEffect } from "react";

/* 10° oli liiga tugev (omanik 01.08) — kaart pöördus, selle asemel et
   kursorile järele anda. 4,5° on nihe, mida märkab, aga mis ei tõmba
   pilku sisult ära. */
const AMPLITUDE = 4.5; // kraadi kaardi servas
const HOVER_SCALE = 1.015;

export default function CardTilt() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active = null;

    const clear = el => {
      if (!el) return;
      el.style.removeProperty("--tilt-x");
      el.style.removeProperty("--tilt-y");
      el.style.removeProperty("--tilt-scale");
    };

    const onMove = e => {
      /* Puude ei hõlju: kalle vilksataks korraks ja jääks kinni. */
      if (e.pointerType === "touch" || reduceMotion.matches) return;
      const hit = e.target?.closest?.(".gc-card") || null;

      if (hit !== active) {
        clear(active);
        active = hit;
      }
      if (!hit) return;

      const r = hit.getBoundingClientRect();
      if (!r.width || !r.height) return;
      /* Nihe keskpunktist, −1…1 mõlemal teljel. */
      const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      /* KURSOR TÕMBAB, EI LÜKKA (omanik 01.08): serv kursori all tuleb
         ETTE, vastasserv vajub taha — kaart annab käele järele. Varem oli
         mõlemal teljel vastupidine märk ja kaart pages kursori eest.
         Märkide tuletus (CSS-i pöörlemissuunad):
           rotateX+ viib ÜLAserva taha  → ülal (dy<0) on vaja miinust → dy
           rotateY+ toob VASAKserva ette → paremal (dx>0) vaja miinust → -dx */
      hit.style.setProperty("--tilt-x", `${(dy * AMPLITUDE).toFixed(2)}deg`);
      hit.style.setProperty("--tilt-y", `${(-dx * AMPLITUDE).toFixed(2)}deg`);
      hit.style.setProperty("--tilt-scale", String(HOVER_SCALE));
    };

    const release = () => {
      clear(active);
      active = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", release, { passive: true });
    document.addEventListener("pointercancel", release, { passive: true });
    window.addEventListener("blur", release);

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", release);
      document.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      clear(active);
    };
  }, []);

  return null;
}
