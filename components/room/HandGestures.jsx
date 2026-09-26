"use client";

/**
 * HandGestures — kaamera kui vabatahtlik ruumiline sisend
 * (ruumilise-kogemuse-lahtekoht §9.3, grammatika omanik 26.09).
 *
 * Sülearvuti või telefoni esikaamera tuvastab käe (MediaPipe Gesture
 * Recognizer, brauseris: käepunktid + treenitud žestiotsus):
 * - käsi vasakule / paremale → menüü kaardid liiguvad käe suunas;
 * - näpistus → avab fookuses oleva kaardi;
 * - käsi alla / üles → avatud akna tekst kerib alla / üles;
 * - hoitud rusikas → tagasi / välja (modaal, avatud leht, alammenüü).
 *
 * Piirid, mis ei ole maitseasi:
 * - käivitub ainult kasutaja lülitist, luba küsib brauser;
 * - kaadrid ei lahku seadmest, mudel ja wasm tulevad omalt päritolult
 *   (public/vendor/mediapipe) — ükski päring ei lähe kolmandale osapoolele;
 * - kaamera töötab ainult nähtaval vahelehel ja nurgas on alati näha, et
 *   ta töötab (eelvaade + väljalülitus);
 * - žest ainult liigub, kerib, avab menüükaardi ja läheb tagasi — ükski
 *   žest ei saada, kustuta ega kinnita midagi; kõik jääb tehtavaks ka
 *   hiire, puute ja klaviatuuriga.
 */

import { useEffect, useRef, useState } from "react";
import {
  HAND_EVENT,
  createFistTracker,
  createPinchTracker,
  createSwipeTracker,
  handShape,
  palmPoint,
} from "@/lib/handGestures";

const VENDOR = "/vendor/mediapipe";
/* Käe tõmbe ja lehe kerimise suhe: veerandi kaadri kõrgune tõmme kerib
   umbes poole akna jagu. Üks tõmme ei keri kunagi rohkem kui ühe akna. */
const SCROLL_GAIN = 2.2;
/* Tuvastus kuni ~25 korda sekundis: tõmbe jaoks piisab, ja protsessorile
   jääb ruumi karusselli animatsiooniks. */
const DETECT_MS = 40;

let visionPromise = null;
function loadVision() {
  if (window.Vision?.GestureRecognizer) return Promise.resolve(window.Vision);
  if (!visionPromise) {
    visionPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${VENDOR}/vision_bundle.js`;
      script.async = true;
      script.onload = () =>
        window.Vision?.GestureRecognizer ? resolve(window.Vision) : reject(new Error("vision_missing"));
      script.onerror = () => reject(new Error("vision_load_failed"));
      document.head.appendChild(script);
    }).catch((error) => {
      visionPromise = null;
      throw error;
    });
  }
  return visionPromise;
}

/* Mudel laetakse lehe eluea jooksul üks kord: väljalülitus peatab kaamera,
   aga uuesti sisselülitamine ei pea wasm'i ja mudelit uuesti kompileerima. */
let recognizerPromise = null;
function loadRecognizer() {
  if (!recognizerPromise) {
    recognizerPromise = loadVision()
      .then((Vision) => {
        const fileset = {
          wasmLoaderPath: `${VENDOR}/vision_wasm_internal.js`,
          wasmBinaryPath: `${VENDOR}/vision_wasm_internal.wasm`,
        };
        /* CPU (XNNPACK), mitte GPU. GPU-delegaat tarkvaralise WebGL-i peal
           (SwiftShader — sinna langeb Chrome ka musta nimekirja GPU korral)
           ei visanud viga, vaid tagastas igas kaadris „kätt ei ole":
           kaamera töötaks, aga žestid oleksid vaikselt surnud. CPU leidis
           samalt kaadrilt käe. Kaadrisagedus on piiratud (DETECT_MS).
           Gesture Recognizer, mitte ainult Hand Landmarker: sama käepunktide
           mudel on tema sees, lisaks treenitud žestiotsus — rusikas ei
           sõltu siis enam ühe foto järgi seatud lävedest (omanik 26.09). */
        return Vision.GestureRecognizer.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: `${VENDOR}/gesture_recognizer.task`, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      })
      .catch((error) => {
        recognizerPromise = null;
        throw error;
      });
  }
  return recognizerPromise;
}

function sendHand(detail) {
  window.dispatchEvent(new CustomEvent(HAND_EVENT, { detail }));
}

/* Keritav aken: lähim keritav vanem ekraani keskel olevast elemendist —
   avatud paneel, vestlus või modaal. Kui ükski ei keri, siis leht ise.
   Karusselli vaates ei keri miski ja tõmme ei tee midagi. */
function scrollTarget() {
  let el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  while (el && el !== document.body && el !== document.documentElement) {
    const { overflowY } = window.getComputedStyle(el);
    if (/(auto|scroll|overlay)/.test(overflowY) && el.scrollHeight > el.clientHeight + 1) return el;
    el = el.parentElement;
  }
  const root = document.scrollingElement;
  return root && root.scrollHeight > root.clientHeight + 1 ? root : null;
}

/* Rusikas = tagasi, ja ainult juba olemasolevaid väljapääse pidi:
   1) info-modaali dokk (Kontakt/Paigalda) — tal on oma tagasi-nool;
   2) muu modaal või avatud leht — Esc. Esc saadetakse lehele (body), mitte
      fookuses elemendile: vestluses on tekstikast kohe fookuses ja leht
      eirab Esc'i kirjutamise ajal, nii et rusikas ei teinud seal midagi
      (omanik 26.09: „rusikas ei töötanud"). Hoitud rusikas on tahtlik
      žest, mitte kogemata vajutatud klahv. Pooleli teksti see siiski ei
      viska: kui fookuses väljas on tekst, jääb leht lahti;
   3) alammenüü (Töölaud, Profiil jne) — karusselli tagasi-nool.
   Peamenüüs ei tee rusikas midagi: välja logimine ei ole žest.
   Tagastab, mis juhtus — paan ütleb selle kasutajale. */
function goBack() {
  const overModal = document.querySelector('.room-dock-wrap[data-over-modal="1"] .gc-shortcut--back');
  if (overModal) {
    overModal.click();
    return "back";
  }
  const room = document.querySelector(".room");
  const layered =
    room?.dataset.loginOpen === "1" ||
    room?.dataset.a11yOpen === "1" ||
    document.documentElement.getAttribute("data-room-mode") === "panel";
  if (layered) {
    const el = document.activeElement;
    const field = el?.matches?.("input:not([type=hidden]), textarea") || el?.isContentEditable;
    const draft = field && (el.isContentEditable ? el.textContent : el.value)?.trim();
    if (draft && room?.dataset.loginOpen !== "1") return "draft";
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true })
    );
    return "back";
  }
  const wrap = document.querySelector(".room-carousel-wrap");
  const back = wrap && !wrap.inert ? wrap.querySelector(".gc-shortcut--back") : null;
  if (!back) return "none";
  back.click();
  return "back";
}

function scrollBy(dir, travel) {
  const target = scrollTarget();
  if (!target) return;
  const view = target === document.scrollingElement ? window.innerHeight : target.clientHeight;
  const reduced = document.documentElement.dataset.reduceMotion === "1";
  target.scrollBy({
    top: dir * Math.min(view * 0.9, travel * SCROLL_GAIN * view),
    behavior: reduced ? "auto" : "smooth",
  });
}

export default function HandGestures({ onStop, t }) {
  const videoRef = useRef(null);
  // starting | loading | ready | denied | unavailable | unsupported
  const [status, setStatus] = useState("starting");
  const [handSeen, setHandSeen] = useState(false);
  /* Mis kuju käsi parajasti on ("pinch" | "fist" | "") ja mis viimane rusikas
     tegi. Ilma selleta ei saanud kasutaja teada, kas rusikat üldse nähti
     (omanik 26.09: „rusikas ei töötanud"). */
  const [gesture, setGesture] = useState("");
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(0);
  /* `?kaed` aadressireal näitab mõõte — läve saab päris kaamera ees
     kalibreerida ilma arendustööriistadeta. Komponent sünnib alati kliendis
     (lüliti vajutusest), seega võib aadressi lugeda kohe. */
  const [debug] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("kaed")
  );
  const [metrics, setMetrics] = useState(null);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden"
  );

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    if (!pageVisible) return undefined;
    const video = videoRef.current;
    let cancelled = false;
    let stream = null;
    let frameId = 0;
    let lastVideoTime = -1;
    let lastDetect = 0;
    let lastMetrics = 0;
    let seen = false;
    let shape = "";
    const say = (key) => {
      setNotice(key);
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(null), 1800);
    };
    const pinch = createPinchTracker();
    const swipe = createSwipeTracker();
    const fist = createFistTracker();

    const stopStream = () => {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      if (video) video.srcObject = null;
    };

    const run = (recognizer) => {
      const tick = () => {
        frameId = requestAnimationFrame(tick);
        const now = performance.now();
        if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
        if (now - lastDetect < DETECT_MS) return;
        lastVideoTime = video.currentTime;
        lastDetect = now;
        let landmarks = null;
        let gesture = null;
        try {
          const result = recognizer.recognizeForVideo(video, now);
          landmarks = result?.landmarks?.[0] || null;
          gesture = result?.gestures?.[0]?.[0] || null;
        } catch {
          return;
        }
        let hand = null;
        if (landmarks) {
          const aspect = (video.videoWidth || 4) / (video.videoHeight || 3);
          hand = { ...palmPoint(landmarks), ...handShape(landmarks, aspect, gesture) };
        }
        const closed = fist.update({ t: now, hand });
        if (closed.back) {
          const outcome = goBack();
          say(outcome === "none" ? "room.hands_no_back" : outcome === "draft" ? "room.hands_kept_draft" : "room.hands_did_back");
        }
        /* Liikuv käsi ei näpista: lehvitades lähevad sõrmed hetkeks kokku ja
           see avas kaarte (omanik 26.09). `moving` tuleb eelmisest kaadrist —
           tõmme omakorda vajab selle kaadri näpistust, et näpistades mitte
           kerida. */
        const moving = swipe.moving(now);
        const { pinched, tap } = pinch.update({ t: now, hand, blocked: closed.quiet || moving });
        const nextShape = closed.fist ? "fist" : pinched ? "pinch" : "";
        if (nextShape !== shape) {
          shape = nextShape;
          setGesture(shape);
        }
        if (debug && hand?.metrics && now - lastMetrics > 200) {
          lastMetrics = now;
          setMetrics(hand.metrics);
        }
        if (tap) sendHand({ action: "open" });
        // Rusikas ja tema järelvaikus ei ole tõmme: käsi ainult sulgub/avaneb.
        const still = pinched || closed.quiet;
        for (const event of swipe.update({ t: now, hand, pinched: still })) {
          /* Paan ütleb, mis suund tuvastati — nii näeb kasutaja kohe, kas
             kaamera sai liigutusest aru (omanik 26.09: „ei saa aru, kas
             vasakule või paremale"). */
          if (event.type === "unclear") {
            say("room.hands_unclear");
          } else if (event.axis === "x") {
            /* Kaardid liiguvad käe suunas: käsi vasakule → rida nihkub
               vasakule ja paremalt tuleb järgmine kaart (nagu näpuga vedu). */
            sendHand({ action: "step", dir: -event.dir });
            say(event.dir < 0 ? "room.hands_swipe_left" : "room.hands_swipe_right");
          } else {
            scrollBy(event.dir, event.travel);
            say(event.dir > 0 ? "room.hands_swipe_down" : "room.hands_swipe_up");
          }
        }
        if (Boolean(landmarks) !== seen) {
          seen = Boolean(landmarks);
          setHandSeen(seen);
        }
      };
      frameId = requestAnimationFrame(tick);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        return;
      }
      setStatus("starting");
      // Mudel laeb samal ajal, kui brauser luba küsib.
      const model = loadRecognizer();
      model.catch(() => {});
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 30 },
          },
        });
      } catch (error) {
        if (cancelled) return;
        const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
        setStatus(denied ? "denied" : "unavailable");
        return;
      }
      if (cancelled) {
        stopStream();
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {}
      setStatus("loading");
      let recognizer;
      try {
        recognizer = await model;
      } catch {
        if (cancelled) return;
        stopStream();
        setStatus("unsupported");
        return;
      }
      if (cancelled) return;
      setStatus("ready");
      run(recognizer);
    };

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      stopStream();
      pinch.reset();
      swipe.reset();
      fist.reset();
      setGesture("");
    };
  }, [pageVisible, debug]);

  const live = status === "starting" || status === "loading" || status === "ready";
  const message = notice
    ? t(notice)
    : status === "ready"
      ? t(handSeen ? "room.hands_hint" : "room.hands_show")
      : t(`room.hands_${status}`);

  return (
    <div
      className="hand-cam"
      data-room-ui
      data-status={status}
      data-live={live ? "1" : "0"}
      data-hand={status === "ready" && handSeen ? "1" : "0"}
    >
      <video ref={videoRef} className="hand-cam-video" muted playsInline aria-hidden="true" />
      <div className="hand-cam-body">
        <p className="hand-cam-title">
          <span className="hand-cam-dot" aria-hidden="true" />
          {t("room.hands_camera")}
          {gesture ? <span className="hand-cam-gesture">{t(`room.hands_gesture_${gesture}`)}</span> : null}
        </p>
        <p className="hand-cam-text" role="status">
          {message}
        </p>
        {debug && metrics ? (
          <p className="hand-cam-note" data-debug="1">
            {metrics.label || "–"} {metrics.score.toFixed(2)} ·{" "}
            {metrics.curls.map((c) => c.toFixed(2)).join(" ")} · {metrics.thumb.toFixed(2)} ·{" "}
            {metrics.pinch.toFixed(2)}
          </p>
        ) : (
          <p className="hand-cam-note">{t("room.hands_local")}</p>
        )}
      </div>
      <button
        type="button"
        className="hand-cam-stop"
        aria-label={t("room.hands_off")}
        title={t("room.hands_off")}
        onClick={onStop}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M7 7l10 10M17 7 7 17" />
        </svg>
      </button>
    </div>
  );
}
