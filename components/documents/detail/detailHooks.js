"use client";

/**
 * Detaililehtede ühised konksud: teine vajutus, all hoitud klahvi tõke ja
 * fookus vaate pealkirjale.
 *
 * MIKS. Kustutamine, kinnitamine ja ruumi jagamine ei ole tagasi võetavad:
 * kustutatud tekst ei tule tagasi, kinnitatud teksti ei saa enam muuta ja
 * ruumi postitatud kokkuvõtet on ruumi liikmed juba näinud. Need küsivad teist
 * vajutust. Reegel ise (`pressOutcome`) on failis ./detailModel.js, et seda
 * saaks testida; siin on ainult olek ja taimer.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { TWO_PRESS_HOLD_MS, isHeldActivation, pressOutcome } from "./detailModel";

/**
 * Tegevused, mis küsivad teist vajutust. `action(võti, { label, armedLabel,
 * note, run })` annab nupu kirjelduse samal kujul, mida ootab dokumentide lehe
 * avatud dokumendi vaade (`danger`): esimene vajutus muudab nupu sõnad ja toob
 * selgituse, teine (kuni kaheksa sekundi jooksul, mitte topeltklõpsuna) teeb
 * töö ära. Korraga on relvastatud üks tegevus.
 */
export function useTwoPress() {
  const [armedKey, setArmedKey] = useState("");
  const timer = useRef(0);
  const armedAt = useRef(0);

  const disarm = useCallback(() => {
    window.clearTimeout(timer.current);
    setArmedKey("");
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const action = (key, { label, armedLabel, note, run }) => {
    const armed = armedKey === key;
    return {
      label: armed ? armedLabel : label,
      armed,
      note: armed ? note : "",
      onClick: () => {
        const outcome = pressOutcome({ armed, armedAt: armedAt.current, now: Date.now() });
        if (outcome === "wait") return undefined;
        window.clearTimeout(timer.current);
        if (outcome === "arm") {
          armedAt.current = Date.now();
          setArmedKey(key);
          timer.current = window.setTimeout(() => setArmedKey(""), TWO_PRESS_HOLD_MS);
          return undefined;
        }
        setArmedKey("");
        return run();
      }
    };
  };

  return { action, disarm };
}

/**
 * All hoitud Enter kordab nupuvajutust nii kaua, kuni klahv all on: esimene
 * kordus relvastaks ja järgmine kinnitaks. Lehe juurel püütakse klahvikordus
 * kinni enne, kui see nupuni jõuab. Tekstiväljas jääb all hoitud Enter tööle.
 */
export function blockHeldPress(event) {
  if (!isHeldActivation(event)) return;
  if (event.target instanceof Element && event.target.closest("button, a[href]")) event.preventDefault();
}

/**
 * Fookus ees oleva vaate pealkirjale. Kui lava ehitatakse uuesti (mustand sai
 * kinnitatud ja osade loend muutus) või vaate sees kaob väli, millel fookus
 * oli (ümbernimetamine), ei tohi klaviatuuriga töötaja jääda lehe algusesse.
 * Saabuv vaade võib esimestel kaadritel veel peidus olla, seepärast proovitakse
 * kaadrite kaupa (sama võte mis StepFlight-il).
 */
export function useHeadingFocus(pageRef) {
  return useCallback(() => {
    let frame = 0;
    const deadline = performance.now() + 1200;
    const tryFocus = () => {
      const root = pageRef.current;
      const heading = root?.querySelector('[data-active="1"] [data-step-heading]') || root?.querySelector("[data-step-heading]");
      heading?.focus({ preventScroll: true });
      if ((heading && window.document.activeElement === heading) || performance.now() > deadline) return;
      frame = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(frame);
  }, [pageRef]);
}
