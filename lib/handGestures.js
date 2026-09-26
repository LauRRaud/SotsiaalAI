/**
 * Käežestide puhas loogika.
 *
 * Kaamera ja MediaPipe elavad HandGestures.jsx-is; siin on ainult see, mis
 * teeb 21 käepunktist ruumi käsu. Ilma DOM-ita, et grammatikat saaks
 * testida ilma kaamerata.
 *
 * Grammatika (omanik 26.09):
 * - käsi vasakule / paremale → menüü kaardid liiguvad käe suunas;
 * - käsi alla / üles → avatud akna tekst kerib alla / üles;
 * - näpistus (pöial + nimetissõrm) → avab fookuses oleva kaardi;
 * - hoitud rusikas → tagasi / välja (sama mis Esc või doki tagasi-nool).
 *
 * Liigutus loeb alles siis, kui see on selge tõmme (kiire, ühe telje
 * suunas, piisavalt pikk). Aeglane triiv, käe kaadrisse tõstmine ja
 * tagasiliikumine pärast tõmmet ei tee midagi — muidu viiks iga käe
 * lõdvestamine kaardi tagasi.
 */

/** Ruumi aknasündmus, mille kaudu käsi karussellile käsu annab. */
export const HAND_EVENT = "room:hand";

// MediaPipe Hand Landmarker'i punktid
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;

const distance = (a, b, aspect) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
// z on MediaPipe'is x-iga samas mõõdus (kaadri laius)
const distance3 = (a, b, aspect) =>
  Math.hypot((a.x - b.x) * aspect, a.y - b.y, ((a.z || 0) - (b.z || 0)) * aspect);

const FINGERS = [
  [5, 8], // nimetissõrm: alus, ots
  [9, 12],
  [13, 16],
  [17, 20],
];

/* Kalibreeritud MediaPipe'i näidisfotodel (26.09):
   rusikas — sõrmed 0,80–0,88, pöial 0,25, näpistusmõõt 0,19 (!);
   pöial üles — sõrmed 0,59–0,69, pöial 0,91; V-märk — 2 sõrme ≥ 2,2;
   avatud käed — sõrmed 1,6–1,9. Rusika näpistusmõõt on alla näpistuse
   läve, seega eristab neid pöidla asend: rusikas lebab pöial sõrmedel
   (keskmise sõrme aluse lähedal), näpistuses on ta sõrmeotsaga eespool. */
const CURLED = 1;
const THUMB_TUCKED = 0.45;

/**
 * Pöidla- ja nimetissõrmeotste kaugus peopesa pikkuse (ranne → keskmise
 * sõrme alus) suhtes. Suhe ei sõltu sellest, kui kaugel käsi kaamerast on.
 * `aspect` = kaadri laius / kõrgus: punktid on normaliseeritud eraldi
 * laiuse ja kõrguse järgi, ilma selleta oleks näpistus viltu.
 */
export function pinchRatio(landmarks, aspect = 4 / 3) {
  const palm = distance(landmarks[WRIST], landmarks[MIDDLE_MCP], aspect);
  if (!(palm > 1e-6)) return Number.POSITIVE_INFINITY;
  return distance(landmarks[THUMB_TIP], landmarks[INDEX_TIP], aspect) / palm;
}

/**
 * Käe kuju ühest kaadrist:
 * - `fist`: kõik neli sõrme peopessa kõverdatud (ots randmele lähemal kui
 *   sõrme alus) ja pöial sõrmede peal;
 * - `ratio`: näpistusmõõt, kuid ainult siis, kui pöial EI ole sõrmede peal —
 *   muidu on see rusikas või sellesse minev käsi, mitte näpistus.
 */
export function handShape(landmarks, aspect = 4 / 3) {
  const wrist = landmarks[WRIST];
  const palm = distance3(wrist, landmarks[MIDDLE_MCP], aspect);
  if (!(palm > 1e-6)) return { fist: false, ratio: Number.POSITIVE_INFINITY };
  const curled = FINGERS.every(
    ([base, tip]) =>
      distance3(landmarks[tip], wrist, aspect) < CURLED * distance3(landmarks[base], wrist, aspect)
  );
  const tucked = distance3(landmarks[THUMB_TIP], landmarks[MIDDLE_MCP], aspect) / palm < THUMB_TUCKED;
  return {
    fist: curled && tucked,
    ratio: tucked ? Number.POSITIVE_INFINITY : pinchRatio(landmarks, aspect),
  };
}

/**
 * Käe asukoht kaadris (0..1): keskmise sõrme alus. Sõrmede liikumine
 * (näpistus) seda punkti peaaegu ei nihuta, seega näpistus ei loe tõmbeks.
 * Esikaamera pilt on peegelpilt: `mirror` teeb nii, et käsi paremale =
 * x kasvab, nagu kasutaja seda näeb.
 */
export function palmPoint(landmarks, { mirror = true } = {}) {
  const base = landmarks[MIDDLE_MCP];
  return { x: mirror ? 1 - base.x : base.x, y: base.y };
}

export const PINCH_DEFAULTS = Object.freeze({
  /* Hüsterees: sisse alla 0,3, välja üle 0,45. Üks lävi väriseks piiril
     sisse-välja ja iga värin oleks uus vajutus. */
  pinchOn: 0.3,
  pinchOff: 0.45,
  /* Mitu järjestikust kaadrit peab uus olek kestma (~30 kaadrit/s). */
  confirmFrames: 2,
  /* Pikem hoitud näpistus ei ava midagi — käsi võib mõelda. */
  tapMaxMs: 700,
  /* Kui käsi näpistuse ajal nii palju liigub, ei ole see vajutus. */
  moveLimit: 0.06,
  /* Näpistades varjab sõrm sageli iseennast ja mudel kaotab käe mõneks
     kaadriks. Selle aja jooksul olek püsib. */
  lostGraceMs: 220,
});

/**
 * Näpistus. `update({ t, hand: null | { x, y, ratio }, blocked })` →
 * `{ pinched, tap }`; `tap` on tõsi selles kaadris, kus lühike paigal
 * näpistus vabanes. Vabastamisel, mitte sulgemisel: nii saab näpistust
 * hoida ja sõrmed lahti lasta ilma, et midagi avaneks. `blocked` (rusikas
 * või selle järelvaikus) tühistab pooleli oleva näpistuse: rusikasse
 * minev ja sellest avanev käsi läbib näpistusekuju.
 */
export function createPinchTracker(options = {}) {
  const cfg = { ...PINCH_DEFAULTS, ...options };
  let pinched = false;
  let streak = 0;
  let press = null; // { x, y, t, moved }
  let lastSeen = null;

  const clear = () => {
    pinched = false;
    streak = 0;
    press = null;
    lastSeen = null;
  };

  return {
    reset: clear,
    update({ t, hand, blocked = false }) {
      if (!hand) {
        if (lastSeen !== null && t - lastSeen <= cfg.lostGraceMs) return { pinched, tap: false };
        clear();
        return { pinched: false, tap: false };
      }
      lastSeen = t;
      let tap = false;
      if (blocked && press) press.moved = true;
      const wants = !blocked && (pinched ? hand.ratio < cfg.pinchOff : hand.ratio < cfg.pinchOn);
      streak = wants === pinched ? 0 : streak + 1;
      if (streak >= cfg.confirmFrames) {
        streak = 0;
        pinched = wants;
        if (pinched) {
          press = { x: hand.x, y: hand.y, t, moved: false };
        } else if (press) {
          tap = !press.moved && t - press.t <= cfg.tapMaxMs;
          press = null;
        }
      }
      if (pinched && press && Math.hypot(hand.x - press.x, hand.y - press.y) >= cfg.moveLimit) {
        press.moved = true;
      }
      return { pinched, tap };
    },
  };
}

export const SWIPE_DEFAULTS = Object.freeze({
  /* Kiirus kaadrilaiustes (-kõrgustes) sekundis. Tõmme algab üle
     startSpeed ja lõpeb, kui käsi aeglustub alla endSpeed. Tavaline
     käeliigutus vestluse ajal jääb enamasti alla algusläve. */
  startSpeed: 0.8,
  endSpeed: 0.25,
  /* Põhitelg peab olema nii mitu korda kiirem kui teine — diagonaal ei
     ole ei kaardivahetus ega kerimine. */
  dominance: 1.5,
  /* Minimaalne tõmme kaadri suhtes. */
  minTravelX: 0.12,
  minTravelY: 0.08,
  /* Kaadrisse tõstetud käsi peab hetke paigal olema, enne kui liigutused
     loevad: käe tõstmine ise ei tohi lehte kerida. */
  settleMs: 300,
  /* Tõmbe järel liigub käsi loomulikult tagasi. Nii kaua on lubatud
     ainult samasuunaline uus tõmme. */
  returnMs: 650,
  /* Nii pikk „tõmme" on juba triiv, mitte žest. */
  maxStrokeMs: 1200,
  /* Kiiruse silumine ja tõmbe lõpp on ajas, mitte kaadrites: nõrgem
     telefon annab 8–10 kaadrit sekundis, sülearvuti 25–30, ja žest peab
     mõlemal sama olema. */
  velocityTauMs: 50,
  endHoldMs: 30,
  /* Kiire tõmbe ajal kaotab mudel käe sageli kaadriks-paariks
     (liikumishägu). Nii kaua jätkub tõmme sealt, kus käsi viimati oli;
     pikem kadumine (käsi langetati kaadrist välja) tühistab tõmbe. */
  lostGraceMs: 400,
});

/**
 * Käe tõmbed. `update({ t, hand: null | { x, y }, pinched })` tagastab
 * sündmuste loendi: `{ type: "swipe", axis: "x" | "y", dir: -1 | 1, travel }`.
 * `dir` on käe liikumise suund ekraanil (x: 1 = paremale, y: 1 = alla),
 * `travel` tõmbe pikkus kaadri suhtes. Sündmus tuleb tõmbe LÕPUS, kui käsi
 * on veel pildis: käe langetamine kaadrist välja ei keri lehte.
 */
export function createSwipeTracker(options = {}) {
  const cfg = { ...SWIPE_DEFAULTS, ...options };
  let prev = null; // { x, y, t }
  let vel = { x: 0, y: 0 };
  /* Viimane koht, kus käsi selle telje suunas seisis. Tõmbe pikkus mõõdetakse
     sealt, mitte kohast, kus kiirus alles läve ületas — muidu jääks tõmbe
     esimene kolmandik arvestamata. */
  let rest = null; // { x, y, t }
  let since = null;
  let stroke = null; // { axis, dir, from, t0, slowSince, travel }
  let hold = null; // { axis, dir, until }

  const lose = () => {
    prev = null;
    vel = { x: 0, y: 0 };
    rest = null;
    since = null;
    stroke = null;
  };

  return {
    reset() {
      lose();
      hold = null;
    },
    update({ t, hand, pinched = false }) {
      if (!hand) {
        if (!prev || t - prev.t > cfg.lostGraceMs) lose();
        return [];
      }
      if (since === null) since = t;
      if (!prev) {
        prev = { x: hand.x, y: hand.y, t };
        rest = { x: hand.x, y: hand.y, t };
        return [];
      }
      const dtMs = Math.max(1, t - prev.t);
      const k = 1 - Math.exp(-dtMs / cfg.velocityTauMs);
      vel = {
        x: vel.x + k * (((hand.x - prev.x) * 1000) / dtMs - vel.x),
        y: vel.y + k * (((hand.y - prev.y) * 1000) / dtMs - vel.y),
      };
      prev = { x: hand.x, y: hand.y, t };
      if (!stroke) {
        if (Math.abs(vel.x) < cfg.endSpeed) rest = { ...rest, x: hand.x, t };
        if (Math.abs(vel.y) < cfg.endSpeed) rest = { ...rest, y: hand.y, t };
      }
      if (pinched || t - since < cfg.settleMs) {
        stroke = null;
        return [];
      }

      if (!stroke) {
        const axis = Math.abs(vel.x) >= Math.abs(vel.y) ? "x" : "y";
        const other = axis === "x" ? "y" : "x";
        const speed = Math.abs(vel[axis]);
        const dir = Math.sign(vel[axis]);
        const held = hold && t < hold.until && (hold.axis !== axis || hold.dir !== dir);
        if (!held && speed >= cfg.startSpeed && speed >= cfg.dominance * Math.abs(vel[other])) {
          stroke = { axis, dir, from: rest[axis], t0: rest.t, slowSince: null, travel: 0 };
        }
        return [];
      }

      if (t - stroke.t0 > cfg.maxStrokeMs) {
        stroke = null;
        return [];
      }
      // Kaugeim punkt: kui käsi juba tagasi pöörab, on tõmme ikka see, mis ta oli.
      stroke.travel = Math.max(stroke.travel, stroke.dir * (hand[stroke.axis] - stroke.from));
      const along = stroke.dir * vel[stroke.axis];
      if (along >= cfg.endSpeed) {
        stroke.slowSince = null;
        return [];
      }
      if (stroke.slowSince === null) stroke.slowSince = t;
      if (t - stroke.slowSince < cfg.endHoldMs) return [];

      const events = [];
      const { travel } = stroke;
      const min = stroke.axis === "x" ? cfg.minTravelX : cfg.minTravelY;
      if (travel >= min) {
        events.push({ type: "swipe", axis: stroke.axis, dir: stroke.dir, travel });
        hold = { axis: stroke.axis, dir: stroke.dir, until: t + cfg.returnMs };
      }
      stroke = null;
      return events;
    },
  };
}

export const FIST_DEFAULTS = Object.freeze({
  /* Rusikas peab seisma, enne kui ta midagi teeb: käe langetamine või
     haaramine läbib rusikakuju hetkeks, aga ei hoia seda. */
  holdMs: 400,
  /* Üksik mitte-rusika kaader ei lõpeta rusikat (mudeli värin). */
  releaseMs: 150,
  /* Nii kaua pärast rusikat ei loe näpistus ega tõmme: avanev käsi läbib
     näpistusekuju ja võiks muidu kohe uue lehe avada. */
  quietMs: 600,
});

/**
 * Rusikas = tagasi. `update({ t, hand: null | { fist } })` →
 * `{ fist, back, quiet }`; `back` tuleb üks kord hoitud rusika kohta,
 * uus rusikas vajab vahepeal avatud kätt.
 */
export function createFistTracker(options = {}) {
  const cfg = { ...FIST_DEFAULTS, ...options };
  let since = null;
  let openSince = null;
  let fired = false;
  let lastFist = Number.NEGATIVE_INFINITY;

  const clear = () => {
    since = null;
    openSince = null;
    fired = false;
  };

  return {
    reset() {
      clear();
      lastFist = Number.NEGATIVE_INFINITY;
    },
    update({ t, hand }) {
      let back = false;
      if (!hand) {
        clear();
      } else if (hand.fist) {
        openSince = null;
        lastFist = t;
        if (since === null) since = t;
        if (!fired && t - since >= cfg.holdMs) {
          fired = true;
          back = true;
        }
      } else if (since !== null) {
        if (openSince === null) openSince = t;
        if (t - openSince >= cfg.releaseMs) clear();
      }
      return { fist: since !== null, back, quiet: t - lastFist < cfg.quietMs };
    },
  };
}
