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

const WARM = { r: 229, g: 207, b: 170 };
const GOLD = { r: 218, g: 171, b: 94 };
const IVORY = { r: 248, g: 240, b: 223 };
const BRONZE = { r: 163, g: 119, b: 72 };

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
    /* Puuteseadmel ei ole hõljumist ega kursorinoolt: lause imendub alles
       SISENEN-i vajutusel ja sihiks on nupu enda tekst. */
    const coarsePointer =
      window.matchMedia?.("(pointer: coarse)")?.matches === true;
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
    let gateLatched = false;
    let flowPhase = "phrase";
    let nextTextGlowAt = 5.05;

    const pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      seen: false,
    };
    const gate = { x: 0, y: 0, width: 0, height: 0, ready: false };
    const gateSink = { x: 0, y: 0, ready: false, shape: "cursor" };
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
      if (!nextInteractive && !gateLatched) {
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
      gateSink.shape = "cursor";
      gateSink.ready = true;
      gateTarget = 1;
      veil.dataset.invite = "1";
    }

    /* Puutevajutus lukustab neeldumise: sõrm tõuseb kohe ekraanilt ja
       järgnev pointerleave ei tohi lauset tagasi laiali saata. Sihiks on
       kogu SISENEN-i kast, sest kursorinoolt puuteseadmel ei ole. */
    function latchGate() {
      syncGateInteractivity();
      if (!gateInteractive || gateLatched) return;
      gateNeedsReentry = false;
      gateSink.x = gate.x;
      gateSink.y = gate.y;
      gateSink.shape = "gate";
      gateSink.ready = true;
      gateLatched = true;
      gateTarget = 1;
      veil.dataset.invite = "1";
    }

    function deactivateGate() {
      if (gateLatched) return;
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
      /* Mobiilis jaguneb lause sõna-plokkideks (keskmine nihkes). Iga
         sõna joonistatakse tema enda DOM-kasti keskele; ühel real annavad
         sõnakastid sama tulemuse kui terve rea keskele joonistamine. */
      const words = Array.from(line.querySelectorAll(".room-veil-word"));
      if (words.length) {
        words.forEach((word) => {
          const wordText = (word.textContent || "").trim();
          if (!wordText) return;
          const wordRect = localRect(word);
          sampleCtx.fillText(
            wordText,
            wordRect.left - rect.left + padding + wordRect.width / 2,
            wordRect.top - rect.top + padding + wordRect.height / 2,
          );
        });
      } else {
        sampleCtx.fillText(text, sample.width / 2, sample.height / 2);
      }

      const pixels = sampleCtx.getImageData(0, 0, sample.width, sample.height).data;
      let step = 2;
      let points = [];
      const collect = () => {
        const next = [];
        for (let y = 0; y < sample.height; y += step) {
          for (let x = 0; x < sample.width; x += step) {
            if (pixels[(y * sample.width + x) * 4 + 3] > 165) next.push([x, y]);
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
        /* Vedelkursori nool algab tipust (0,0) ning laieneb allapoole.
           Iga osake saab noole sees oma neeldumispunkti, mitte ühist pikslit. */
        const directEndY = 3 + Math.random() * 22;
        const directEndX =
          1 + Math.random() * Math.min(18, 2 + directEndY * 0.72);
        textParticles.push({
          x: startX,
          y: startY,
          startX,
          startY,
          vx: 0,
          vy: 0,
          size: 0.58 + Math.random() * 0.58,
          alpha: 0.62 + Math.random() * 0.34,
          phase: Math.random() * Math.PI * 2,
          glowStartedAt: Number.NEGATIVE_INFINITY,
          glowDuration: 0,
          streamAt: Number.POSITIVE_INFINITY,
          streamDuration: 0.55 + Math.random() * 0.35,
          streamCurve: (Math.random() - 0.5) * 0.9,
          streamEndX: (Math.random() - 0.5) * 5,
          streamEndY: (Math.random() - 0.5) * 3,
          directEndX,
          directEndY,
          /* Puutevajutuse siht: normeeritud koht SISENEN-i kastis
             (−0.5…0.5), millest saab neeldumispunkt sõna enda sees. */
          gateEndX: Math.random() - 0.5,
          gateEndY: (Math.random() - 0.5) * 0.78,
          directDriftX: (Math.random() - 0.5) * 18,
          directApproachX: (Math.random() - 0.5) * 46,
          directApproachLift: 54 + Math.random() * 38,
          scatterX: 0,
          scatterY: 0,
          scatterVx: 0,
          scatterVy: 0,
          scatterReturnAt: 0,
          scatterHitAt: Number.NEGATIVE_INFINITY,
          scatterMass: 0.82 + Math.random() * 0.55,
          scatterCurl: (Math.random() - 0.5) * 1.15,
          scatterBrakeDuration: 0.18 + Math.random() * 0.14,
          scatterReturnDuration: 0.28 + Math.random() * 0.18,
        });
      });

      /* Ring-lavastus kasutab segatud osakeste järjekorda. Otse-lavastuses
         liigub laine SISENEN-i kohalt loomulikult lause välisservade poole. */
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
        textParticles.forEach((particle, particleIndex) => {
          const target = textTargets[particleIndex];
          const cascade =
            0.5 +
            Math.sin(target.x * 0.038 + particle.phase * 0.65) * 0.5;
          particle.streamAt =
            0.04 + cascade * 0.42 + Math.random() * 0.55;
          particle.streamDuration = 0.78 + Math.random() * 0.28;
          particle.streamCurve = (Math.random() - 0.5) * 0.7;
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
          size: 0.72 + Math.random() * 0.86,
          alpha: 0.28 + Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
          tone: Math.random() < 0.82 ? 0 : 1,
          driftAngle,
          driftSpeed: 0.14 + Math.random() * 0.42,
          flashEligible: Math.random() < 0.12,
          flashRate: 0.38 + Math.random() * 0.34,
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

    function applyTextScatterBoundary(particle, dt, softDistance = 58) {
      const distance = Math.hypot(particle.scatterX, particle.scatterY);
      if (distance <= softDistance) return;
      const normalX = particle.scatterX / distance;
      const normalY = particle.scatterY / distance;
      const outwardSpeed =
        particle.scatterVx * normalX + particle.scatterVy * normalY;
      if (outwardSpeed > 0) {
        /* Kauguse kasvades suureneb pidurdus pidevalt; asukohta ei lõigata
           kunagi ühe kaadriga piirile ja seetõttu ei teki nähtavat jõnksu. */
        const excess = distance - softDistance;
        const edgeDamping = 1 - Math.exp(-(2 + excess * 0.16) * dt);
        particle.scatterVx -= normalX * outwardSpeed * edgeDamping;
        particle.scatterVy -= normalY * outwardSpeed * edgeDamping;
        const edgePull = Math.min(60, excess * 5);
        particle.scatterVx -= normalX * edgePull * dt;
        particle.scatterVy -= normalY * edgePull * dt;
      }
    }

    function sweepTextWithPointer(x, y, deltaX, deltaY) {
      /* Vedelkursori tegelik nool on 24 × 28 px ja selle ankur on tipus.
         Kolm kattuvat väikest keha järgivad noole kuju tipust kannani;
         nende pühitud trajektoor tabab ka kiire liigutuse ajal ainult neid
         osakesi, millest noole kuju päriselt läbi läheb. */
      if (elapsed < 5 || gateTime > 0.001) return;
      const moveSpeed = Math.hypot(deltaX, deltaY);
      if (moveSpeed < 0.2) return;

      const previousX = x - deltaX;
      const previousY = y - deltaY;
      const directionX = deltaX / moveSpeed;
      const directionY = deltaY / moveSpeed;
      const cursorBodies = [
        { x: 1.5, y: 2.5, radius: 3.8 },
        { x: 6.5, y: 11.5, radius: 6.5 },
        { x: 11, y: 20.5, radius: 9.5 },
      ];

      textParticles.forEach((particle, index) => {
        const target = textTargets[index];
        if (!target) return;
        if (elapsed - particle.scatterHitAt < 0.065) return;
        let collision = null;

        for (const body of cursorBodies) {
          const startX = previousX + body.x;
          const startY = previousY + body.y;
          const endX = x + body.x;
          const endY = y + body.y;
          const segmentX = endX - startX;
          const segmentY = endY - startY;
          const segmentLengthSq = segmentX * segmentX + segmentY * segmentY;
          const along = segmentLengthSq
            ? clamp01(
                ((particle.x - startX) * segmentX +
                  (particle.y - startY) * segmentY) /
                  segmentLengthSq,
              )
            : 1;
          const closestX = startX + segmentX * along;
          const closestY = startY + segmentY * along;
          const offsetX = particle.x - closestX;
          const offsetY = particle.y - closestY;
          const distance = Math.hypot(offsetX, offsetY);
          const contactRadius = body.radius + particle.size;
          if (distance >= contactRadius) continue;
          const penetration = 1 - distance / contactRadius;
          if (!collision || penetration > collision.penetration) {
            collision = { offsetX, offsetY, distance, penetration };
          }
        }

        if (!collision) return;
        const fallbackSide = Math.sin(particle.phase + index * 0.37) < 0 ? -1 : 1;
        const normalX =
          collision.distance > 0.35
            ? collision.offsetX / collision.distance
            : -directionY * fallbackSide;
        const normalY =
          collision.distance > 0.35
            ? collision.offsetY / collision.distance
            : directionX * fallbackSide;
        const contact = collision.penetration ** 0.72;
        const massFactor = 1 / particle.scatterMass;
        const normalImpulse =
          Math.min(92, 26 + moveSpeed * 1.8) * contact * massFactor;
        const forwardImpulse =
          Math.min(24, moveSpeed * 0.52) * contact * massFactor;
        const edgeSlip = particle.scatterCurl * Math.min(11, moveSpeed * 0.26) * contact;

        /* Liikuva noole serv lükkab punkti peamiselt enda kõrvale ja annab
           vaid veidi liikumissuunalist hoogu. Punkt ei kleepu kursori külge. */
        particle.scatterVx +=
          normalX * normalImpulse +
          directionX * forwardImpulse -
          directionY * edgeSlip;
        particle.scatterVy +=
          normalY * normalImpulse +
          directionY * forwardImpulse +
          directionX * edgeSlip;
        particle.scatterX += normalX * contact * 1.2;
        particle.scatterY += normalY * contact * 1.2;
        particle.scatterHitAt = elapsed;
        particle.scatterReturnAt =
          elapsed + 1.4 + particle.scatterBrakeDuration;
      });
    }

    function resize() {
      const rect = veil.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));
      if (nextWidth === width && nextHeight === height && canvas.width > 1) return;

      width = nextWidth;
      height = nextHeight;
      /* Telefonil (dpr 3) muutis kunagine 1.25-lagi osakesed häguseks
         puruks ja lause oli loetamatu. Lagi tuleb pindalaeelarvest:
         3,24M sisepikslit = endine 1080p×1.25 maht, seega väike ekraan
         saab terava dpr 2, suur monitor jääb endise kulu juurde. */
      dpr = Math.max(
        1,
        Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(3240000 / (width * height)),
        ),
      );
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
          /* Füüsika kasutab päris kursori koordinaati. Silutud pointer.x/y
             jäi nähtavast SVG-kursorist maha ja tekitas vale neeldumiskoha. */
          const dx = pointer.targetX - mote.x;
          const dy = pointer.targetY - mote.y;
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
        const tone = mote.tone === 0 ? WARM : BRONZE;
        /* Üksikud punktid vilguvad aeg-ajalt kuldseks. Punkti mõõt ei
           muutu ja selle ümber ei joonistata halo ega lisakihti. */
        const flashWave = mote.flashEligible
          ? clamp01(
              (Math.sin(elapsed * mote.flashRate + mote.phase) - 0.68) / 0.32,
            )
          : 0;
        const flashTone = {
          r: Math.round(tone.r + (GOLD.r - tone.r) * flashWave),
          g: Math.round(tone.g + (GOLD.g - tone.g) * flashWave),
          b: Math.round(tone.b + (GOLD.b - tone.b) * flashWave),
        };
        ctx.fillStyle = rgba(
          flashTone,
          clamp01(mote.alpha * twinkle + flashWave * 0.34),
        );
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function updateAndDrawText(dt) {
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

      /* Üks-kaks juhuslikku tekstipunkti süttivad korraga pehmelt ning
         kustuvad enne, kui järgmised juhuslikud punktid nende koha võtavad. */
      if (
        formationProgress >= 1 &&
        gateTime <= 0.001 &&
        elapsed >= nextTextGlowAt &&
        textParticles.length
      ) {
        const glowCount = Math.random() < 0.22 ? 2 : 1;
        let activated = 0;
        let attempts = 0;
        while (activated < glowCount && attempts < 16) {
          attempts += 1;
          const particle =
            textParticles[Math.floor(Math.random() * textParticles.length)];
          if (
            elapsed - particle.glowStartedAt < particle.glowDuration + 0.4
          ) {
            continue;
          }
          particle.glowStartedAt = elapsed;
          particle.glowDuration = 1.05 + Math.random() * 0.85;
          activated += 1;
        }
        nextTextGlowAt = elapsed + 0.45 + Math.random() * 1.15;
      }

      let absorbedThisFrame = 0;
      textParticles.forEach((particle, index) => {
        const target = textTargets[index];
        if (!target) return;
        const previousDrawX = particle.x;
        const previousDrawY = particle.y;

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
          /* Otse-neeldumine alustab vaikselt ja kiireneb noole lähedal.
             Ring-variant säilitab oma varasema ease-out liikumise. */
          const travel = ringEffect
            ? ease(streamProgress)
            : streamProgress ** 3 *
              (streamProgress * (streamProgress * 6 - 15) + 10);
          /* Otse-efekti neeldumispunkt on kursori tegelik asukoht
             SISENEN-alal. Klaviatuurifookuse või puuduva kursori korral
             jääb turvaliseks sihiks läve keskpunkt. Ringivariant säilitab
             oma varasema keskmesse voolamise. */
          const intoGate = gateSink.shape === "gate";
          const directSinkX = gateSink.ready ? gateSink.x : gate.x;
          const directSinkY = gateSink.ready ? gateSink.y : gate.y;
          const endX = ringEffect
            ? gate.x + particle.streamEndX
            : intoGate
              ? directSinkX + particle.gateEndX * gate.width * 0.84
              : directSinkX + particle.directEndX;
          const endY = ringEffect
            ? gate.y + particle.streamEndY
            : intoGate
              ? directSinkY + particle.gateEndY * gate.height * 0.7
              : directSinkY + particle.directEndY;
          sinkX = endX;
          sinkY = endY;
          const pathX = endX - startTargetX;
          const pathY = endY - startTargetY;
          const pathDistance = Math.hypot(pathX, pathY) || 1;
          const curveAmount = ringEffect
            ? ringY * particle.streamCurve
            : Math.min(36, pathDistance * 0.12) * particle.streamCurve;
          const middleX = ringEffect
            ? (startTargetX + endX) / 2 - Math.sin(ringAngle) * curveAmount
            : (startTargetX + endX) / 2 - (pathY / pathDistance) * curveAmount;
          const middleY = ringEffect
            ? (startTargetY + endY) / 2 + Math.cos(ringAngle) * curveAmount
            : (startTargetY + endY) / 2 + (pathX / pathDistance) * curveAmount;
          const oneMinus = 1 - travel;
          if (ringEffect) {
            activeTargetX =
              oneMinus * oneMinus * startTargetX +
              2 * oneMinus * travel * middleX +
              travel * travel * endX;
            activeTargetY =
              oneMinus * oneMinus * startTargetY +
              2 * oneMinus * travel * middleY +
              travel * travel * endY;
          } else {
            const control1X =
              startTargetX + particle.directDriftX;
            const control1Y =
              startTargetY + pathY * 0.34;
            const control2X =
              startTargetX + particle.directApproachX * 0.3;
            const control2Y =
              directSinkY - particle.directApproachLift;
            activeTargetX =
              oneMinus ** 3 * startTargetX +
              3 * oneMinus * oneMinus * travel * control1X +
              3 * oneMinus * travel * travel * control2X +
              travel ** 3 * endX;
            activeTargetY =
              oneMinus ** 3 * startTargetY +
              3 * oneMinus * oneMinus * travel * control1Y +
              3 * oneMinus * travel * travel * control2Y +
              travel ** 3 * endY;
          }
        }

        /* Liikumisel on kolm loetavat faasi: pikem vaba triiv, selle lõpus
           lühike pidurdus ning seejärel nullist kiirenev tagasitulek. */
        const brakeStartsAt =
          particle.scatterReturnAt - particle.scatterBrakeDuration;
        const brakeProgress = clamp01(
          (elapsed - brakeStartsAt) / particle.scatterBrakeDuration,
        );
        const returnProgress = clamp01(
          (elapsed - particle.scatterReturnAt) / particle.scatterReturnDuration,
        );
        const returnStrength = returnProgress * returnProgress * (3 - 2 * returnProgress);
        const isReturning = elapsed >= particle.scatterReturnAt;
        const scatterSpring = 26 * returnStrength;

        /* Väike osakesepõhine pöördenurk murrab ühtlase sirgjoonelise rea,
           kuid säilitab hoo — tegemist on triivi, mitte juhusliku värinaga. */
        if (!isReturning) {
          /* Ka trajektoorikaar hääbub pidurduse jooksul sujuvalt. */
          const turn = particle.scatterCurl * 0.58 * (1 - brakeProgress) * dt;
          const cosine = Math.cos(turn);
          const sine = Math.sin(turn);
          const nextVx = particle.scatterVx * cosine - particle.scatterVy * sine;
          particle.scatterVy = particle.scatterVx * sine + particle.scatterVy * cosine;
          particle.scatterVx = nextVx;
        }
        if (isReturning) {
          /* Kriitiliselt summutatud vedru ei ületa sihtpunkti. Alguses
             säilib pidurdusfaasi summutus, seejärel läheb see pidevalt üle
             vedru enda kriitiliseks summutuseks. */
          const criticalDamping = 2 * Math.sqrt(scatterSpring);
          const returnDamping =
            9 * (1 - returnStrength) + criticalDamping * returnStrength;
          particle.scatterVx +=
            (-particle.scatterX * scatterSpring -
              particle.scatterVx * returnDamping) *
            dt;
          particle.scatterVy +=
            (-particle.scatterY * scatterSpring -
              particle.scatterVy * returnDamping) *
            dt;
        } else {
          const scatterFriction = 0.3 + brakeProgress * 8.7;
          const scatterDamping = Math.exp(-scatterFriction * dt);
          particle.scatterVx *= scatterDamping;
          particle.scatterVy *= scatterDamping;
        }
        particle.scatterX += particle.scatterVx * dt;
        particle.scatterY += particle.scatterVy * dt;
        applyTextScatterBoundary(particle, dt);

        const finalDistance = Math.hypot(
          particle.scatterX,
          particle.scatterY,
        );
        const finalSpeed = Math.hypot(
          particle.scatterVx,
          particle.scatterVy,
        );
        if (isReturning && finalDistance < 0.06 && finalSpeed < 0.08) {
          particle.scatterX = 0;
          particle.scatterY = 0;
          particle.scatterVx = 0;
          particle.scatterVy = 0;
        }

        const targetX = streaming
          ? activeTargetX
          : target.x + driftX + particle.scatterX;
        const targetY = streaming
          ? activeTargetY
          : target.y + driftY + particle.scatterY;

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
          if (gateTarget < 0.5) {
            /* Hoverilt lahkudes jääb kaugem tagasitee nähtamatuks. Punktid
               ilmuvad uuesti alles oma tähe viimase kohaliku lõigu sees. */
            const localReturnVisibility = clamp01(
              (0.24 - streamProgress) / 0.18,
            );
            streamAlpha *= ease(localReturnVisibility);
          }
          if (streamProgress >= 0.985) absorbedThisFrame += 1;
        }

        /* Ainult mõni üksik tekstiosake kannab kuldset kuma. Ülejäänud
           jäävad väikesteks soojadeks punktideks, et lause ei muutuks
           ühtlaseks neoonkirjaks. */
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
        const sparkleSize = particle.size * (1.04 + glint * 0.34);
        const frameMoveX = particle.x - previousDrawX;
        const frameMoveY = particle.y - previousDrawY;
        const frameMove = Math.hypot(frameMoveX, frameMoveY);
        if (
          !ringEffect &&
          streaming &&
          streamProgress > 0.62 &&
          index % 7 === 0 &&
          frameMove > 0.35
        ) {
          ctx.strokeStyle = rgba(GOLD, alpha * 0.12);
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(previousDrawX, previousDrawY);
          ctx.lineTo(particle.x, particle.y);
          ctx.stroke();
        }
        const glowAge = elapsed - particle.glowStartedAt;
        const glowProgress = particle.glowDuration
          ? glowAge / particle.glowDuration
          : -1;
        const glowPresence =
          glowProgress >= 0 && glowProgress <= 1
            ? Math.sin(glowProgress * Math.PI) ** 0.72
            : 0;
        if (glowPresence > 0.01 && alpha > 0.025) {
          const glowRadius = sparkleSize * 5.2;
          const glow = ctx.createRadialGradient(
            particle.x,
            particle.y,
            0,
            particle.x,
            particle.y,
            glowRadius,
          );
          glow.addColorStop(0, rgba(GOLD, alpha * glowPresence * 0.46));
          glow.addColorStop(0.24, rgba(GOLD, alpha * glowPresence * 0.25));
          glow.addColorStop(0.62, rgba(GOLD, alpha * glowPresence * 0.075));
          glow.addColorStop(1, rgba(GOLD, 0));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = rgba(
          glowPresence > 0.01 ? GOLD : index % 17 === 0 ? IVORY : WARM,
          clamp01(alpha * 1.08),
        );
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
        ctx.fillStyle = rgba(mote.tone === 0 ? WARM : BRONZE, mote.alpha * 0.45);
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
          gateTime + (gateTarget > 0.5 ? dt * 1.18 : -dt * 1.35),
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
      updateAndDrawText(dt);
      updateAndDrawRipples(dt);
      ctx.globalCompositeOperation = "source-over";
    }

    function onPointerMove(event) {
      const rect = veil.getBoundingClientRect();
      const nextX = event.clientX - rect.left;
      const nextY = event.clientY - rect.top;
      let deltaX = 0;
      let deltaY = 0;
      if (pointer.seen) {
        deltaX = nextX - pointer.targetX;
        deltaY = nextY - pointer.targetY;
      }
      pointer.seen = true;
      pointer.targetX = nextX;
      pointer.targetY = nextY;
      /* Lukustatud neeldumise ajal ei tohi sõrme libisemine lauset enam
         laiali lükata ega läve tühistada. */
      if (gateLatched) return;
      sweepTextWithPointer(nextX, nextY, deltaX, deltaY);
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
      /* Puude tekitab samuti pointerenter'i, kuid seal ei ole hõljumist —
         seal ootame vajutust (latchGate). */
      if (event?.pointerType === "touch" || coarsePointer) return;
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
    /* Lukustus käib KLÕPSUST, mitte pointerdown'ist: alla vajutatud ja
       kõrvale libistatud sõrm jätaks muidu lause nupu sisse ilma et
       sisenemine käivituks. Klaviatuuri-Enter töölaual jääb varasemale
       fookuse-rajale (kursorikujuline neeldumine), et lend ei hüppaks. */
    const gatePress = (event) => {
      const touchLike =
        event?.pointerType === "touch" ||
        (coarsePointer && event?.pointerType !== "mouse");
      if (!touchLike) return;
      latchGate();
    };

    button?.addEventListener("pointerenter", inviteOn);
    button?.addEventListener("pointerleave", inviteOff);
    button?.addEventListener("click", gatePress);
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
      button?.removeEventListener("click", gatePress);
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
