"use client";

/**
 * Selguse väli
 *
 * Avakuva ainus suur žest: hajusad valgusosakesed kogunevad lauseks
 * „Kõik algab selgusest.“. Kui kasutaja läheneb sõnale SISENEN,
 * liiguvad lause osakesed väikese juhusliku ajavahega otse lävel oleva
 * kursori sisse. Varasem pöörleva ringi lavastus on säilitatud valitava
 * „laadimine-ring“ efektina.
 * Kursor avab väljas pehme valgusruumi; klõps tühjal alal saadab läbi
 * ruumi ühe vaevu nähtava laine.
 *
 * Lõuend ei püüa sündmusi. Nupp ja ligipääsetav DOM-tekst jäävad selle
 * kohal päriselt kasutatavaks. Liikumise vähendamisel või kõrgkontrastis
 * jääb lause tavaliseks DOM-tekstiks ning kunstikiht on staatiline.
 */

import { useEffect, useRef } from "react";

const WARM = { r: 236, g: 206, b: 158 };
const IVORY = { r: 255, g: 247, b: 230 };
const COOL = { r: 154, g: 177, b: 199 };

const TEXT_LIMIT = 780;
const AMBIENT_COUNT = 112;

export const VEIL_EFFECTS = Object.freeze({
  DIRECT: "laadimine-otse",
  RING: "laadimine-ring",
});

function rgba(color, alpha) {
  return `rgba(${color.r},${color.g},${color.b},${alpha})`;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function ease(value) {
  const x = clamp01(value);
  return 1 - (1 - x) ** 3;
}

function shouldBeStill() {
  if (typeof window === "undefined") return true;
  const root = document.documentElement;
  return (
    root.getAttribute("data-reduce-motion") === "1" ||
    root.getAttribute("data-contrast") === "hc" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ||
    false
  );
}

export default function VeilArt({ effect = VEIL_EFFECTS.DIRECT, textLimit = TEXT_LIMIT }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const veil = canvas?.parentElement;
    if (!canvas || !ctx || !veil) return undefined;

    const still = shouldBeStill();
    canvas.dataset.mode = still ? "still" : "live";
    if (!still) veil.dataset.artText = "1";
    document.documentElement.classList.add("veil-cursor-pending");

    let width = 1;
    let height = 1;
    let dpr = 1;
    let raf = 0;
    let running = !still;
    let cancelled = false;
    let lastTime = performance.now();
    let elapsed = 0;
    let gateTarget = 0;
    let gateTime = 0;
    let gateDuration = 1;
    let gateInteractive = false;
    let gateNeedsReentry = false;
    let flowPhase = "phrase";

    const pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      seen: false,
    };
    const gate = { x: 0, y: 0, width: 0, height: 0, ready: false };
    const gateSink = { x: 0, y: 0, ready: false };
    const textTargets = [];
    const textParticles = [];
    const motes = [];
    const ripples = [];
    const button = veil.querySelector(".room-veil-enter");

    function localRect(element) {
      const outer = veil.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left - outer.left,
        top: rect.top - outer.top,
        width: rect.width,
        height: rect.height,
      };
    }

    function measureGate() {
      if (!button) {
        gate.ready = false;
        return;
      }
      const rect = localRect(button);
      gate.x = rect.left + rect.width / 2;
      gate.y = rect.top + rect.height / 2;
      gate.width = rect.width;
      gate.height = rect.height;
      gate.ready = rect.width > 20 && rect.height > 10;
    }

    function pointIsOverGate(x, y) {
      return (
        gate.ready &&
        x >= gate.x - gate.width / 2 &&
        x <= gate.x + gate.width / 2 &&
        y >= gate.y - gate.height / 2 &&
        y <= gate.y + gate.height / 2
      );
    }

    function syncGateInteractivity() {
      const nextInteractive = Boolean(
        gate.ready &&
          button?.dataset.ready === "1" &&
          !button.disabled,
      );
      if (nextInteractive && !gateInteractive) {
        /* Kui nupp ilmub juba kursori alla, ei loeta seda teadlikuks
           sisenemiseks. Kasutaja peab esmalt alast väljuma ja uuesti
           lähenema; nii ei käivitu lause nähtamatu hitbox'i tõttu. */
        gateNeedsReentry =
          pointer.seen && pointIsOverGate(pointer.targetX, pointer.targetY);
      }
      if (!nextInteractive) {
        gateTarget = 0;
        gateNeedsReentry = false;
        delete veil.dataset.invite;
      }
      gateInteractive = nextInteractive;
    }

    function activateGate(x, y) {
      if (!gateInteractive || gateNeedsReentry) return;
      gateSink.x = x;
      gateSink.y = y;
      gateSink.ready = true;
      gateTarget = 1;
      veil.dataset.invite = "1";
    }

    function deactivateGate() {
      gateTarget = 0;
      document.documentElement.classList.remove("veil-cursor-gold");
      delete veil.dataset.invite;
    }

    function buildTextTargets() {
      textTargets.length = 0;
      const line = veil.querySelector(".room-veil-line");
      if (!line) return;

      const rect = localRect(line);
      const text = (line.textContent || "").trim();
      if (!text || rect.width < 20 || rect.height < 8) return;

      const styles = getComputedStyle(line);
      const padding = 12;
      const sample = document.createElement("canvas");
      sample.width = Math.ceil(rect.width) + padding * 2;
      sample.height = Math.ceil(rect.height) + padding * 2;
      const sampleCtx = sample.getContext("2d");
      if (!sampleCtx) return;

      sampleCtx.font = `${styles.fontStyle} ${styles.fontWeight} ${
        Number.parseFloat(styles.fontSize) || 24
      }px ${styles.fontFamily}`;
      if (styles.letterSpacing !== "normal" && "letterSpacing" in sampleCtx) {
        sampleCtx.letterSpacing = styles.letterSpacing;
      }
      sampleCtx.textAlign = "center";
      sampleCtx.textBaseline = "middle";
      sampleCtx.fillStyle = "#fff";
      sampleCtx.fillText(text, sample.width / 2, sample.height / 2);

      const pixels = sampleCtx.getImageData(0, 0, sample.width, sample.height).data;
      let step = 2;
      let points = [];
      const collect = () => {
        const next = [];
        for (let y = 0; y < sample.height; y += step) {
          for (let x = 0; x < sample.width; x += step) {
            if (pixels[(y * sample.width + x) * 4 + 3] > 120) next.push([x, y]);
          }
        }
        return next;
      };
      points = collect();
      if (points.length > textLimit) {
        const stride = points.length / textLimit;
        points = Array.from(
          { length: textLimit },
          (_, index) => points[Math.floor(index * stride)],
        );
      }

      const offsetX = rect.left - padding;
      const offsetY = rect.top - padding;
      points.forEach(([x, y], index) => {
        textTargets.push({
          x: offsetX + x,
          y: offsetY + y,
          angle: (index / Math.max(1, points.length)) * Math.PI * 2,
        });
      });
      canvas.dataset.targets = String(textTargets.length);
    }

    function seedText() {
      textParticles.length = 0;
      textTargets.forEach((target, index) => {
        const angle = target.angle * 2.7 + index * 0.19;
        const distance = 125 + Math.random() * Math.min(440, width * 0.32);
        const startX = target.x + Math.cos(angle) * distance;
        const startY = target.y + Math.sin(angle) * distance * 0.72;
        textParticles.push({
          x: startX,
          y: startY,
          startX,
          startY,
          vx: 0,
          vy: 0,
          size: 0.75 + Math.random() * 0.85,
          alpha: 0.52 + Math.random() * 0.4,
          phase: Math.random() * Math.PI * 2,
          streamAt: Number.POSITIVE_INFINITY,
          streamDuration: 0.55 + Math.random() * 0.35,
          streamCurve: (Math.random() - 0.5) * 0.9,
          streamEndX: (Math.random() - 0.5) * 5,
          streamEndY: (Math.random() - 0.5) * 3,
        });
      });

      /* Mõlemad lavastused kasutavad segatud osakeste järjekorda.
         „laadimine-ring“ säilitab varasema pika ükshaaval voolamise;
         „laadimine-otse“ käivitab kogu välja 20–240 ms aknas, nii et
         liikumine tundub peaaegu ühine, kuid mitte mehaaniliselt samaaegne. */
      const streamOrder = textParticles.map((_, index) => index);
      for (let index = streamOrder.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [streamOrder[index], streamOrder[swapIndex]] = [
          streamOrder[swapIndex],
          streamOrder[index],
        ];
      }
      if (effect === VEIL_EFFECTS.RING) {
        let nextStart = 1.02;
        streamOrder.forEach((particleIndex) => {
          nextStart += 0.015 + Math.random() * 0.035;
          textParticles[particleIndex].streamAt = nextStart;
        });
      } else {
        streamOrder.forEach((particleIndex) => {
          const particle = textParticles[particleIndex];
          particle.streamAt = 0.02 + Math.random() * 0.22;
          particle.streamDuration = 0.46 + Math.random() * 0.24;
          particle.streamCurve = (Math.random() - 0.5) * 0.36;
        });
      }
      gateDuration = Math.max(
        0.1,
        ...textParticles.map(
          (particle) => particle.streamAt + particle.streamDuration,
        ),
      );
      gateTime = Math.min(gateTime, gateDuration);
    }

    function seedMotes() {
      motes.length = 0;
      const count = still ? 12 : AMBIENT_COUNT;
      for (let index = 0; index < count; index += 1) {
        const driftAngle = Math.random() * Math.PI * 2;
        motes.push({
          /* Kõik punktid sünnivad nähtavas alas. Varasem ellipsikülv
             paigutas laiekraanil suure osa neist tegelikult ekraanist
             välja, kuigi massiivi osakeste arv oli suur. */
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(driftAngle) * (0.12 + Math.random() * 0.18),
          vy: Math.sin(driftAngle) * (0.1 + Math.random() * 0.15),
          size: 0.95 + Math.random() * 1.2,
          alpha: 0.38 + Math.random() * 0.36,
          phase: Math.random() * Math.PI * 2,
          tone: Math.random() < 0.82 ? 0 : 1,
          driftAngle,
          driftSpeed: 0.14 + Math.random() * 0.42,
          orbitDirection: Math.random() < 0.5 ? -1 : 1,
          orbitMode: "free",
          orbitAge: 0,
          orbitDuration: 2.1 + Math.random() * 1.8,
          orbitCooldown: 0,
        });
      }
    }

    function respawnMote(mote) {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) {
        mote.x = 2;
        mote.y = Math.random() * height;
      } else if (side === 1) {
        mote.x = width - 2;
        mote.y = Math.random() * height;
      } else if (side === 2) {
        mote.x = Math.random() * width;
        mote.y = 2;
      } else {
        mote.x = Math.random() * width;
        mote.y = height - 2;
      }
      mote.vx = 0;
      mote.vy = 0;
      mote.orbitMode = "free";
      mote.orbitAge = 0;
      mote.orbitCooldown = 1.2 + Math.random() * 1.5;
      mote.orbitDuration = 2.1 + Math.random() * 1.8;
    }

    function resize() {
      const rect = veil.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));
      if (nextWidth === width && nextHeight === height && canvas.width > 1) return;

      width = nextWidth;
      height = nextHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!pointer.seen) {
        pointer.x = pointer.targetX = width / 2;
        pointer.y = pointer.targetY = height / 2;
      }
      measureGate();
      buildTextTargets();
      seedText();
      seedMotes();
      if (still) drawStill();
    }

    function updateAndDrawMotes(dt) {
      let orbitingNow = 0;
      for (const mote of motes) {
        /* Püsiv aeglane lend üle ekraani. Suund lainetab, kuid ei kao
           hõõrdumise tõttu nulli nagu eelmises variandis. */
        const heading =
          mote.driftAngle + Math.sin(elapsed * 0.18 + mote.phase) * 0.42;
        const desiredVx = Math.cos(heading) * mote.driftSpeed;
        const desiredVy = Math.sin(heading) * mote.driftSpeed * 0.78;
        const driftBlend = Math.min(1, dt * 0.9);
        mote.vx += (desiredVx - mote.vx) * driftBlend;
        mote.vy += (desiredVy - mote.vy) * driftBlend;
        mote.orbitCooldown = Math.max(0, mote.orbitCooldown - dt);

        if (pointer.seen) {
          const dx = pointer.x - mote.x;
          const dy = pointer.y - mote.y;
          const distance = Math.hypot(dx, dy) || 1;
          const influenceRadius = 220;
          const orbitRadius = 22;
          const engaged = mote.orbitMode !== "free";
          const mayEngage =
            engaged ||
            (distance < influenceRadius &&
              mote.orbitCooldown <= 0 &&
              orbitingNow < 8);

          if (mayEngage) {
            orbitingNow += 1;
            if (!engaged) mote.orbitMode = "orbit";

            if (mote.orbitMode === "orbit") {
              mote.orbitAge += dt;
              /* Osake läheneb rahulikult väikesele orbiidile. Orbiidi
                 sees pole vastassuunalist tõuget, seega ei teki põrget. */
              const radialError =
                Math.max(0, distance - orbitRadius) / influenceRadius;
              const radialForce = radialError * 3.2;
              const tangentForce =
                Math.max(0, 1 - distance / influenceRadius) *
                0.42 *
                mote.orbitDirection;
              mote.vx +=
                ((dx / distance) * radialForce +
                  (-dy / distance) * tangentForce) *
                dt;
              mote.vy +=
                ((dy / distance) * radialForce +
                  (dx / distance) * tangentForce) *
                dt;
              const orbitDamping = Math.exp(-0.9 * dt);
              mote.vx *= orbitDamping;
              mote.vy *= orbitDamping;

              if (mote.orbitAge >= mote.orbitDuration) {
                mote.orbitMode = "sink";
                mote.orbitAge = 0;
              }
            } else {
              /* Pärast lühikest tiiru vajub osake aeglaselt kursori
                 sisse ja sünnib seejärel mujal serval uuesti. */
              const sinkForce = 2.5 + Math.min(1, distance / 80) * 1.5;
              mote.vx += (dx / distance) * sinkForce * dt;
              mote.vy += (dy / distance) * sinkForce * dt;
              const sinkDamping = Math.exp(-1.05 * dt);
              mote.vx *= sinkDamping;
              mote.vy *= sinkDamping;

              if (distance < 6) respawnMote(mote);
            }
          }
        }

        /* Ainult kerge summutus: baaskiirus taastub ülal igal kaadril,
           samas hiire tõmbejõud ei jää pärast kursori lahkumist külge. */
        mote.vx *= Math.exp(-0.34 * dt);
        mote.vy *= Math.exp(-0.34 * dt);
        mote.x += mote.vx;
        mote.y += mote.vy;

        if (mote.x < -12) mote.x = width + 10;
        if (mote.x > width + 12) mote.x = -10;
        if (mote.y < -12) mote.y = height + 10;
        if (mote.y > height + 12) mote.y = -10;

        const twinkle = 0.74 + Math.sin(elapsed * 0.45 + mote.phase) * 0.26;
        ctx.fillStyle = rgba(mote.tone === 0 ? WARM : COOL, mote.alpha * twinkle);
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function updateAndDrawText() {
      /* Logo saab esmalt ruumi. Lause kogunemine algab hiljem ning
         kestab ligi neli sekundit, et kaugemalt saabuvad osakesed oleksid
         päriselt jälgitavad, mitte ei ilmuks juba valmis tekstina. */
      const formationProgress = clamp01((elapsed - 1.2) / 3.8);
      /* Tasakaalus smoothstep: erinevalt varasemast ease-out'ist ei
         kuluta animatsioon pikka lõpuosa peaaegu paigal seismisele. */
      const formed =
        formationProgress * formationProgress * (3 - 2 * formationProgress);
      const ringX = Math.max(132, gate.width * 0.72);
      const ringY = Math.max(48, gate.height * 0.82);
      const ringEffect = effect === VEIL_EFFECTS.RING;
      /* Ring-efektis saab ring enne tervikuna kohal olla. Otse-efektis
         on lähtepunkt osakese koht lauses ja vahepealset ringi ei teki. */

      let absorbedThisFrame = 0;
      textParticles.forEach((particle, index) => {
        const target = textTargets[index];
        if (!target) return;

        const ringAngle =
          target.angle - Math.PI / 2 + (ringEffect ? elapsed * 0.045 : 0);
        const startTargetX = ringEffect
          ? gate.x + Math.cos(ringAngle) * ringX
          : target.x;
        const startTargetY = ringEffect
          ? gate.y + Math.sin(ringAngle) * ringY
          : target.y;
        /* Lause ei tardu pärast moodustumist: iga punkt triivib oma
           faasis imevähe eri suunas. Liikumine kaob hoveri ajal, et
           neeldumine kursori sisse jääks selge ja sihipärane. */
        const driftX = Math.sin(elapsed * 0.9 + particle.phase) * 1.55;
        const driftY = Math.cos(elapsed * 0.74 + particle.phase * 1.37) * 1.15;
        let activeTargetX = startTargetX;
        let activeTargetY = startTargetY;
        let streamAlpha = 1;
        let sinkX = gate.x;
        let sinkY = gate.y;
        let streaming = false;
        let streamProgress = 0;

        if (gateTime >= particle.streamAt) {
          streaming = true;
          streamProgress = clamp01(
            (gateTime - particle.streamAt) / particle.streamDuration,
          );
          const travel = ease(streamProgress);
          /* Otse-efekti neeldumispunkt on kursori tegelik asukoht
             SISENEN-alal. Klaviatuurifookuse või puuduva kursori korral
             jääb turvaliseks sihiks läve keskpunkt. Ringivariant säilitab
             oma varasema keskmesse voolamise. */
          const directEndX = gateSink.ready ? gateSink.x : gate.x;
          const directEndY = gateSink.ready ? gateSink.y : gate.y;
          const endX = ringEffect
            ? gate.x + particle.streamEndX
            : directEndX;
          const endY = ringEffect
            ? gate.y + particle.streamEndY
            : directEndY;
          sinkX = endX;
          sinkY = endY;
          const middleX =
            (startTargetX + endX) / 2 - Math.sin(ringAngle) * ringY * particle.streamCurve;
          const middleY =
            (startTargetY + endY) / 2 + Math.cos(ringAngle) * ringY * particle.streamCurve;
          const oneMinus = 1 - travel;
          activeTargetX =
            oneMinus * oneMinus * startTargetX +
            2 * oneMinus * travel * middleX +
            travel * travel * endX;
          activeTargetY =
            oneMinus * oneMinus * startTargetY +
            2 * oneMinus * travel * middleY +
            travel * travel * endY;
        }
        const targetX = streaming ? activeTargetX : target.x + driftX;
        const targetY = streaming ? activeTargetY : target.y + driftY;

        if (formationProgress < 1 && gateTime <= 0.001) {
          /* Esimene moodustumine järgib üht katkematut trajektoori
             lähtepunktist täpsesse tähepunkti. Siin ei kasutata vedru,
             seega ei teki udust vahepeatust ega hilist korrektsiooni. */
          particle.x =
            particle.startX + (targetX - particle.startX) * formed;
          particle.y =
            particle.startY + (targetY - particle.startY) * formed;
          particle.vx = 0;
          particle.vy = 0;
        } else {
          /* Neeldumine ja tagasitulek kasutavad täpselt sama Bezier'
             trajektoori vastassuunas. Eraldi vedru ei lisa tagasiteele
             teist efekti ega kuhja osakesi kursori juurde heledaks klombiks. */
          particle.x = targetX;
          particle.y = targetY;
          particle.vx = 0;
          particle.vy = 0;
        }

        if (streaming) {
          /* Kustumine sõltub osakese päris kaugusest, mitte trajektoori
             taimerist. Hajumine algab alles viimases lähenemisosas ja
             lõpeb kursori kujusse jõudes. */
          const distanceToSink = Math.hypot(
            particle.x - sinkX,
            particle.y - sinkY,
          );
          /* Suur hulk osakesi koondub samasse väikesesse punkti. Alusta
             lineaarset hajumist 72 px kauguselt, et lõppu ei tekiks
             läbipõlenud valget klompi, kuid teekond jääks endiselt näha. */
          const proximityFade = clamp01((72 - distanceToSink) / 68);
          const convergenceDim =
            0.58 + 0.42 * clamp01(distanceToSink / 90);
          /* Läbipaistvus sõltub samast trajektoori progressist nii sisse-
             kui väljaliikumisel. Seetõttu süttivad punktid tagasi tulles
             järk-järgult juba kursori juurest eemaldumise ajal. */
          streamAlpha = (1 - proximityFade * ease(streamProgress)) * convergenceDim;
          if (streamProgress >= 0.985) absorbedThisFrame += 1;
        }

        /* Eri faasis sätendus muudab lause elavaks ilma osakeste ümber
           eraldi halo joonistamata. Harvad elevandiluukarva punktid
           annavad lühikese tugevama valgussähvatuse. */
        const shimmer = 0.72 + Math.sin(elapsed * 1.35 + particle.phase) * 0.22;
        const glint =
          index % 17 === 0
            ? Math.max(0, Math.sin(elapsed * 2.3 + particle.phase * 1.8)) * 0.32
            : 0;
        const alpha = clamp01(
          formed *
            particle.alpha *
            (shimmer + glint + streamProgress * 0.04) *
            streamAlpha,
        );
        const sparkleSize = particle.size * (1 + glint * 0.28);
        ctx.fillStyle = rgba(index % 17 === 0 ? IVORY : WARM, alpha);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, sparkleSize, 0, Math.PI * 2);
        ctx.fill();
      });

      /* Laadimislehel süttib kursori kuld alles siis, kui nähtav laine
         lauseosakesi on päriselt kursori kujusse jõudnud. */
      const goldThreshold = Math.max(18, Math.ceil(textParticles.length * 0.04));
      const cursorHasReceivedText =
        gateTarget > 0.5 && absorbedThisFrame >= goldThreshold;
      document.documentElement.classList.toggle(
        "veil-cursor-gold",
        cursorHasReceivedText,
      );
      canvas.dataset.absorbed = String(absorbedThisFrame);
    }

    function updateAndDrawRipples(dt) {
      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        ripple.age += dt;
        ripple.radius += 82 * dt;
        const life = 1 - ripple.age / ripple.duration;
        if (life <= 0) {
          ripples.splice(index, 1);
          continue;
        }
        ctx.strokeStyle = rgba(WARM, life * 0.075);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawStill() {
      ctx.clearRect(0, 0, width, height);
      elapsed = 4;
      for (const mote of motes) {
        ctx.fillStyle = rgba(mote.tone === 0 ? WARM : COOL, mote.alpha * 0.45);
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function render(now) {
      if (!running) return;
      raf = requestAnimationFrame(render);
      const dt = Math.min(0.034, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      elapsed += dt;
      pointer.x += (pointer.targetX - pointer.x) * Math.min(1, dt * 5.2);
      pointer.y += (pointer.targetY - pointer.y) * Math.min(1, dt * 5.2);
      syncGateInteractivity();
      gateTime = Math.max(
        0,
        Math.min(
          gateDuration,
          gateTime + (gateTarget > 0.5 ? dt : -dt),
        ),
      );
      const nextFlowPhase =
        gateTime > (effect === VEIL_EFFECTS.RING ? 1.05 : 0.06)
          ? "inward"
          : gateTime > 0.001 && effect === VEIL_EFFECTS.RING
            ? "ring"
            : "phrase";
      if (nextFlowPhase !== flowPhase) {
        flowPhase = nextFlowPhase;
        canvas.dataset.flow = flowPhase;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      updateAndDrawMotes(dt);
      updateAndDrawText();
      updateAndDrawRipples(dt);
      ctx.globalCompositeOperation = "source-over";
    }

    function onPointerMove(event) {
      const rect = veil.getBoundingClientRect();
      pointer.seen = true;
      pointer.targetX = event.clientX - rect.left;
      pointer.targetY = event.clientY - rect.top;
      syncGateInteractivity();
      const overGate = pointIsOverGate(pointer.targetX, pointer.targetY);
      if (gateNeedsReentry) {
        if (!overGate) gateNeedsReentry = false;
        deactivateGate();
        return;
      }
      if (overGate && gateInteractive) {
        activateGate(pointer.targetX, pointer.targetY);
      } else {
        deactivateGate();
      }
    }

    function onPointerDown(event) {
      if (event.target?.closest?.(".room-veil-enter")) return;
      const rect = veil.getBoundingClientRect();
      ripples.push({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        radius: 10,
        age: 0,
        duration: 1.8,
      });
      if (ripples.length > 3) ripples.shift();
    }

    function onVisibilityChange() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!still && !running) {
        running = true;
        lastTime = performance.now();
        raf = requestAnimationFrame(render);
      }
    }

    const inviteOn = (event) => {
      syncGateInteractivity();
      if (!gateInteractive || gateNeedsReentry) return;
      const rect = veil.getBoundingClientRect();
      const x = Number.isFinite(event?.clientX)
        ? event.clientX - rect.left
        : gate.x;
      const y = Number.isFinite(event?.clientY)
        ? event.clientY - rect.top
        : gate.y;
      activateGate(x, y);
    };
    const inviteOff = () => {
      if (gateInteractive) gateNeedsReentry = false;
      deactivateGate();
    };
    const focusOn = () => {
      syncGateInteractivity();
      if (!gateInteractive) return;
      gateNeedsReentry = false;
      activateGate(gate.x, gate.y);
    };

    button?.addEventListener("pointerenter", inviteOn);
    button?.addEventListener("pointerleave", inviteOff);
    button?.addEventListener("focus", focusOn);
    button?.addEventListener("blur", inviteOff);

    resize();
    canvas.dataset.flow = flowPhase;
    document.fonts?.ready?.then?.(() => {
      if (cancelled) return;
      buildTextTargets();
      seedText();
      measureGate();
      if (still) drawStill();
    });

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(veil);
    window.addEventListener("resize", resize);

    if (!still) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("visibilitychange", onVisibilityChange);
      raf = requestAnimationFrame(render);
    }

    return () => {
      cancelled = true;
      running = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      button?.removeEventListener("pointerenter", inviteOn);
      button?.removeEventListener("pointerleave", inviteOff);
      button?.removeEventListener("focus", focusOn);
      button?.removeEventListener("blur", inviteOff);
      delete veil.dataset.artText;
      delete veil.dataset.invite;
      delete canvas.dataset.flow;
      delete canvas.dataset.absorbed;
      document.documentElement.classList.remove("veil-cursor-gold");
      document.documentElement.classList.remove("veil-cursor-pending");
    };
  }, [effect, textLimit]);

  return <canvas ref={canvasRef} className="room-veil-art" aria-hidden="true" />;
}
