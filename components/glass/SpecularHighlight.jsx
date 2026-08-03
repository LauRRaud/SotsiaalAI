"use client";

/**
 * SpecularHighlight — vormivälja servahelk, SAMA efekt mis nupul.
 *
 * Shader on täpselt see, mida SpecularButton kasutab (SPECULAR_FRAG:
 * ümarristküliku SDF, gaussi joon servas, nurka juhib kursor). Erineb ainult
 * paigaldus, ja see erinevus on hinna küsimus:
 *
 *   Nupp   — lõuend elab nupu SEES, üks kontekst nupu kohta.
 *   Väljad — ÜKS lõuend kogu dokumendi peale, mis positsioneerib end selle
 *            välja kohale, mille kohal kursor parasjagu on.
 *
 * Miks nii: `<input>` EI SAA pseudoelementi, seega lõuend vajab mähist ümber
 * välja. Mähis iga välja ümber tähendaks üht WebGL-konteksti ja üht igavest
 * rAF-tsüklit VÄLJA KOHTA — PIN-lehel oli neid kolm, ja platvormi vaikeseisuna
 * põrkaks see brauseri konteksti-lakke. Üks jagatud lõuend annab sama pildi
 * ühe konteksti eest, sest kursor saab korraga olla ainult ühe välja kohal.
 *
 * rAF magab, kui helk on hääbunud (bright === 0) — erinevalt SpecularButton'ist,
 * mis renderdab ka siis, kui midagi ei muutu.
 */

import { useEffect } from "react";
import { Renderer, Program, Mesh, Triangle, Color } from "ogl";
import {
  SPECULAR_FRAG,
  SPECULAR_VERT,
} from "@/components/SpecularButton/specularShader";

/* Lõuend ulatub väljast üle, et helk tohiks servast välja hõõguda — sama
   marginaal mis nupul (.specular-button__fx inset: -20px). */
const PAD = 20;

/* Väljad JA valikukaardid. Viimased (`label[data-control-type]` — OptionCard)
   on kasutaja silmis samuti „input lahtrid": ligipääsetavuse lennul ei ole
   ühtki tekstivälja, ainult neid, ja nende kõrval seisev Salvesta-nupp helkis
   üksi (omanik 03.08). OptionCard'i oma `<input>` on `.sr-only` ehk 1×1 px
   peidetud juhtnupp — helk peab käima nähtava KAARDI, mitte tema ümber.

   Päris nupud jäävad välja: nemad joonistavad helgi ise (SpecularButton) ja
   saaksid muidu kaks kihti teineteise peale. `.specular-button` katab needki
   juhud, kus nupul on `role="radio"`. */
const FIELD_SELECTOR = [
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not(.sr-only)',
  "textarea",
  "select",
  ".dd-trigger",
  "label[data-control-type]",
  '[role="radio"]:not(.specular-button)',
].join(",");

/* Nupu vaikeväärtused annavad välja jaoks liiga jämeda joone. Need on need,
   mis olid PIN-lehe .specular-input mähisel — sealt tuli ilme, mida omanik
   nägi ja tellis kõikjale. */
const LINE_COLOR = "#ffffff";
const BASE_COLOR = "#525252";
const INTENSITY = 0.8;
const SHINE_SIZE = 6; // kraadi
const SHINE_FADE = 18; // kraadi
const THICKNESS = 0.9;

export default function SpecularHighlight() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const root = document.documentElement;
    /* Eelistusi loetakse IGA liigutuse ajal, mitte mount'il: kasutaja saab
       ligipääsetavuse paneelis need keset sessiooni sisse lülitada. */
    const suppressed = () =>
      root.dataset.reduceMotion === "1" ||
      root.dataset.contrast === "hc" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let host = null;
    let renderer = null;
    let program = null;
    let mesh = null;
    let dpr = 1;
    let canvasW = 0;
    let canvasH = 0;

    let active = null; // väli, mille kohal kursor on
    let angle = 2.4; // silutud valgusnurk
    let pointerAngle = 2.4; // sihtnurk kursorist
    let bright = 0; // silutud tugevus
    let target = 0; // 1 kursor väljal, 0 lahkumisel
    let raf = 0;
    let last = 0;
    /* Viimane kursori asukoht. Iga kaader kontrollib siit, kas element on
       ikka veel kursori all — vt frame(). */
    let px = -1;
    let py = -1;

    const lineC = new Color();
    const baseC = new Color();

    const ensure = () => {
      if (renderer) return true;
      /* Laisk: leht, kus ükski väli hoveri alla ei satu, ei ava GL-konteksti
         üldse. */
      dpr = window.devicePixelRatio || 1;
      host = document.createElement("span");
      host.className = "specular-rim";
      host.setAttribute("aria-hidden", "true");
      document.body.appendChild(host);

      renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
        dpr,
      });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const geometry = new Triangle(gl);
      if (geometry.attributes.uv) delete geometry.attributes.uv;

      lineC.set(LINE_COLOR);
      baseC.set(BASE_COLOR);
      program = new Program(gl, {
        vertex: SPECULAR_VERT,
        fragment: SPECULAR_FRAG,
        uniforms: {
          uCenter: { value: [0, 0] },
          uHalfSize: { value: [1, 1] },
          uRadius: { value: 0 },
          uAngle: { value: 2.4 },
          uPx: { value: dpr },
          uLineColor: { value: [lineC.r, lineC.g, lineC.b] },
          uBaseColor: { value: [baseC.r, baseC.g, baseC.b] },
          uIntensity: { value: 0 },
          uShineSize: { value: (SHINE_SIZE * Math.PI) / 180 },
          uShineFade: { value: (SHINE_FADE * Math.PI) / 180 },
          uThickness: { value: THICKNESS * dpr },
          uBaseWidth: { value: dpr },
        },
      });
      mesh = new Mesh(gl, { geometry, program });
      host.appendChild(gl.canvas);
      return true;
    };

    const hide = () => {
      if (host) host.style.opacity = "0";
      active = null;
    };

    /* Mõõt JA asukoht tulevad getBoundingClientRect'ist, mitte offsetWidth'ist.
       See on vastupidine SpecularButton'i valikule ja meelega: seal elab lõuend
       elemendi SEES ja liigub tema transformiga kaasa, seega vajab ta
       paigutusmõõtu. Siin elab lõuend body's, VÄLJASPOOL välja transformi —
       tema jaoks on tõde ekraanikoordinaat, ja seda annab just rect. */
    const place = () => {
      const r = active.getBoundingClientRect();
      if (!r.width || !r.height) return false;

      /* Lennuvärav. Jaamalend lükkab plaani sügavusse ja projektsioon
         PLAHVATAB — 300 px kaart mõõdeti kaamerani jõudes üle ekraani laiuse
         ja lõuend joonistas hiiglasliku ristküliku, mis „lendas ise kuhugi"
         (omanik 03.08). Skaala ONGI see näit, mille järgi aru saada, et
         element ei ole enam seal, kus kursor teda puudutas: puhkeasendis on
         ta 1 ümber, lennu ajal jookseb minema. Väljaspool väravat me ei
         joonista — hiiglaslikku lõuendit ei eraldata ka. */
      const layoutW = active.offsetWidth;
      const scale = layoutW > 0 ? r.width / layoutW : 1;
      if (scale < 0.6 || scale > 1.8) return false;

      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w !== canvasW || h !== canvasH) {
        canvasW = w;
        canvasH = h;
        renderer.setSize(w + PAD * 2, h + PAD * 2);
        program.uniforms.uCenter.value = [(PAD + w / 2) * dpr, (PAD + h / 2) * dpr];
        program.uniforms.uHalfSize.value = [(w / 2) * dpr, (h / 2) * dpr];
      }
      host.style.transform = `translate(${r.left - PAD}px, ${r.top - PAD}px)`;

      /* PERSPEKTIIV. Jaamalennu plaanid (.a11f-plane, .rgf-plane) on
         `translateZ`-itud: ekraanil on element SKAALEERITUD, aga
         `borderTopLeftRadius` ja joone paksus tulevad paigutusest ja on
         skaleerimata. Kui neid mitte kaasa venitada, jookseb joon kaardi
         nurgast läbi ja paksus ei klapi — täpselt see, mis nupu kõrval
         katki paistis (nupul on lõuend elemendi SEES ja venib transformiga
         ise kaasa; siin on lõuend väljaspool ja peab ise arvestama).
         Rect on projektsioon, offsetWidth on paigutus — nende suhe ONGI
         skaala (arvutatud ülal, lennuvärava juures). Puhta suurenduse jaoks
         täpne; pööret see ei kata, aga lennud ainult liiguvad sügavuses. */
      const radius = parseFloat(getComputedStyle(active).borderTopLeftRadius) || 0;
      program.uniforms.uRadius.value =
        Math.min(radius * scale, Math.min(w, h) / 2) * dpr;
      program.uniforms.uThickness.value = THICKNESS * scale * dpr;
      program.uniforms.uBaseWidth.value = scale * dpr;
      return true;
    };

    const frame = (now) => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      /* Kas element on IKKA VEEL kursori all? Hover'i lõppu ei anna alati
         `pointermove`: jaamalennul, kerimisel või uuel renderdusel liigub
         element kursori alt ära, ilma et kursor ise liiguks — ja helk jäi
         teda jälitama. Siin ei hääbu ta, vaid kaob KOHE: hääbumine vales
         kohas näeb halvem välja kui kadumine. */
      if (active) {
        const under = px < 0 ? null : document.elementFromPoint(px, py);
        if (!document.contains(active) || under?.closest?.(FIELD_SELECTOR) !== active) {
          bright = 0;
          target = 0;
          hide();
          return;
        }
      }

      bright += (target - bright) * (1 - Math.exp(-dt * 8));
      if (Math.abs(target - bright) < 0.004) bright = target;

      if (active && place()) {
        const diff = ((pointerAngle - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        angle += diff * (1 - Math.exp(-dt * 7));
        program.uniforms.uAngle.value = angle;
        program.uniforms.uIntensity.value = INTENSITY * bright;
        host.style.opacity = "1";
        renderer.render({ scene: mesh });
      }

      if (bright > 0 || target > 0) {
        raf = requestAnimationFrame(frame);
      } else {
        /* Täielikult hääbunud → lõuend seisma ja peitu. Siin rAF MAGAB. */
        hide();
      }
    };

    const wake = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e) => {
      // Puude ei hõlju — helk oleks lühike sähvatus, mitte tagasiside.
      if (e.pointerType === "touch") return;
      px = e.clientX;
      py = e.clientY;
      const hit = suppressed() ? null : e.target?.closest?.(FIELD_SELECTOR) || null;

      if (!hit) {
        target = 0;
        if (active) wake();
        return;
      }
      if (!ensure()) return;
      if (hit !== active) {
        active = hit;
        canvasW = 0; // sunni uus mõõt
        bright = 0; // uus väli süttib nullist, ei päri eelmise heledust
      }
      target = 1;

      const r = active.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      /* Kursor välja SEES: nurk tuleb nurgadiagonaalist + väike kalle
         kursori nihkest (sama valem mis nupul) — muidu hüppaks nurk keskel
         metsikult, sest atan2 on seal määramatu. */
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (inside) {
        const nx = (e.clientX - cx) / (r.width / 2);
        const ny = (cy - e.clientY) / (r.height / 2);
        pointerAngle =
          Math.atan2(2 / r.height, -2 / r.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      wake();
    };

    const onLeave = () => {
      target = 0;
      if (active) wake();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onMove, { passive: true });
    /* Kerimine/mõõdumuutus liigutab välja kursori alt ära, ilma et kursor ise
       liiguks — siis peab helk kaasa tulema (place() jookseb kaadris) või
       kaduma, kui väli enam kursori all ei ole. */
    window.addEventListener("scroll", onLeave, { passive: true, capture: true });
    window.addEventListener("resize", onLeave);
    window.addEventListener("blur", onLeave);
    document.addEventListener("pointercancel", onLeave, { passive: true });

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onMove);
      window.removeEventListener("scroll", onLeave, { capture: true });
      window.removeEventListener("resize", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("pointercancel", onLeave);
      if (raf) cancelAnimationFrame(raf);
      if (renderer) {
        renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
      host?.remove();
    };
  }, []);

  return null;
}
