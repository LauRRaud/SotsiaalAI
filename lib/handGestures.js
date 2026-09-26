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
   pöial üles — sõrmed 0,59–0,69, pöial 0,91; pöial alla — pöial 1,2;
   V-märk — 2 sõrme ≥ 2,2, kõverdatud sõrmed alles 1,02–1,1;
   avatud käed — sõrmed 1,6–1,9. Rusika näpistusmõõt on alla näpistuse
   läve, seega eristab neid pöidla asend: rusikas lebab pöial sõrmedel
   (keskmise sõrme aluse lähedal), näpistuses on ta sõrmeotsaga eespool.

   Rusika läved on fotost lõdvemad (omanik 26.09: „rusikas ei töötanud"):
   päris kaamera ees on rusikas harva nii tihe kui näidisfotol — V-märgi
   kõverdatud sõrmed jäid 1,1 juurde. Nimetissõrm peab siiski olema
   peopesas (< 1): näpistuses on tema ots pöidla otsa juures, peopesast
   eespool, ja nii ei saa hoitud näpistus rusikaks muutuda. Pöidla lagi
   0,7 jätab pöial-üles (0,91) ja pöial-alla (1,2) rusikast välja. */
const INDEX_CURLED = 1;
const FINGER_CURLED = 1.15;
const THUMB_ON_FINGERS = 0.7;
const THUMB_TUCKED = 0.45;

/* Treenitud žestimudel (MediaPipe Gesture Recognizer) on rusika koha pealt
   esmane: käsitsi seatud läved said paika ühelt fotolt ja päris kaamera ees
   rusikas ikka ei töötanud (omanik 26.09, kolm korda). Mudel on õppinud
   rusikat eri nurkade alt; näidisfotodel: rusikas Closed_Fist 0,90,
   V-märk Victory 0,91, pöial üles/alla 0,73/0,77, osutamine 0,82, avatud
   käed None. Mõõdud jäävad varuks ainult siis, kui mudel ei ütle midagi. */
const MODEL_FIST = 0.5;
const MODEL_OTHER = 0.6;

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
 * - `fist`: žestimudel ütleb Closed_Fist; kui mudel ei ütle midagi, siis
 *   mõõtude järgi — sõrmed peopessa kõverdatud (ots randmele lähemal kui
 *   sõrme alus; nimetissõrm rangemalt) ja pöial sõrmede peal. Kui mudel on
 *   kindel, et see on muu žest (V-märk, pöial üles …), ei ole see rusikas;
 * - `ratio`: näpistusmõõt, kuid ainult näpistuse poosis (omanik 26.09):
 *   „kaks välja sirutatud sõrme lähevad kokku ja ülejäänud sõrmed on
 *   rusikas" — keskmine, nimeta ja väike sõrm kõverdatud, nimetissõrm
 *   väljas ja pöial väljas, mitte sõrmedel. Avatud käsi (lehvitamine,
 *   OK-märk) ei ole kunagi näpistus. See poos on rusikaga sarnane ja mudel
 *   võib ta rusikaks lugeda; siis on mõlemad tõesed ja otsustab aeg
 *   (lühike = näpistus, hoitud = rusikas, vt tapMaxMs ja holdMs);
 * - `metrics`: mõõdud kalibreerimiseks (HandGestures näitab neid `?kaed`).
 * `gesture` = mudeli parim kategooria `{ categoryName, score }` või null.
 */
export function handShape(landmarks, aspect = 4 / 3, gesture = null) {
  const wrist = landmarks[WRIST];
  const palm = distance3(wrist, landmarks[MIDDLE_MCP], aspect);
  if (!(palm > 1e-6)) return { fist: false, ratio: Number.POSITIVE_INFINITY, metrics: null };
  const curls = FINGERS.map(
    ([base, tip]) => distance3(landmarks[tip], wrist, aspect) / distance3(landmarks[base], wrist, aspect)
  );
  const thumb = distance3(landmarks[THUMB_TIP], landmarks[MIDDLE_MCP], aspect) / palm;
  const pinch = pinchRatio(landmarks, aspect);
  const othersCurled = curls.slice(1).every((c) => c < FINGER_CURLED);
  const label = gesture?.categoryName || "";
  const score = gesture?.score ?? 0;
  let fist = othersCurled && curls[0] < INDEX_CURLED && thumb < THUMB_ON_FINGERS;
  if (label === "Closed_Fist" && score >= MODEL_FIST) fist = true;
  else if (label && label !== "None" && label !== "Closed_Fist" && score >= MODEL_OTHER) fist = false;
  const pinchPose = othersCurled && curls[0] >= INDEX_CURLED && thumb >= THUMB_TUCKED;
  return {
    fist,
    ratio: pinchPose ? pinch : Number.POSITIVE_INFINITY,
    metrics: { curls, thumb, pinch, label, score },
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
  /* Pikem hoitud näpistus ei ava midagi — käsi võib mõelda. Alla rusika
     hoiuaja (FIST_DEFAULTS.holdMs 600): rusikasarnane näpistuse poos on
     lühikesena näpistus, hoituna rusikas. */
  tapMaxMs: 550,
  /* Lühem „näpistus" on hägu: lehvitades lähevad sõrmed kaadriks-paariks
     kokku ja mudel näeb pöidla ja nimetissõrme otsi koos (omanik 26.09:
     „lehvitasin, ta arvas, et ma näpistan"). Tahtlik näpistus kestab
     kauem. */
  minHoldMs: 120,
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
 * või selle järelvaikus, liikuv käsi) tühistab pooleli oleva näpistuse:
 * rusikasse minev ja sellest avanev käsi läbib näpistusekuju, lehvitav käsi
 * samuti.
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
          const held = t - press.t;
          tap = !press.moved && held >= cfg.minHoldMs && held <= cfg.tapMaxMs;
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
  /* Kiirus kaadrilaiustes (-kõrgustes) sekundis. Liigutus algab üle
     startSpeed; käsi loetakse seisvaks alla endSpeed. Tavaline
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
  /* Liigutus on läbi alles siis, kui käsi on nii kaua seisnud. Hoog ja
     löök (või edasi-tagasi) läbivad pöördel nullkiiruse 30–60 ms — see ei
     tohi liigutust pooleks lõigata. */
  restMs: 150,
  /* Suund on selge, kui kiireim tõmme on nii palju kiirem kui kiireim
     vastassuunaline. Muidu otsustab, kuhu käsi lõpuks jõudis; kui ka see
     ei ütle midagi (lehvitamine), ei tehta midagi. */
  clarity: 1.25,
  /* Pärast tõmmet toob käsi end tagasi. Nii kaua ei loe vastassuunaline
     liigutus samal teljel. */
  returnMs: 800,
  /* Pikem liigutus on vehkimine, mitte žest: see lõpeb tühjalt. */
  maxGestureMs: 1500,
  /* Kiiruse silumine on ajas, mitte kaadrites: nõrgem telefon annab 8–10
     kaadrit sekundis, sülearvuti 25–30, ja žest peab mõlemal sama olema. */
  velocityTauMs: 50,
  /* Kiire tõmbe ajal kaotab mudel käe sageli kaadriks-paariks
     (liikumishägu). Nii kaua liigutus jätkub; pikem kadumine (käsi
     langetati kaadrist välja) tühistab selle. */
  lostGraceMs: 400,
  /* Nii väike kaadrinihe on mudeli värin, mitte suunamuutus. */
  jitter: 0.004,
  /* Nii kaua pärast liigutust loetakse käsi veel liikuvaks (vt moving):
     käsi rahuneb, sõrmed alles kogunevad. */
  settleAfterMs: 400,
  /* Sellest kiirem käsi on liikumas, ka kui liigutus ei ole veel žest. */
  movingSpeed: 0.5,
});

/**
 * Käe tõmbed. `update({ t, hand: null | { x, y }, pinched })` tagastab
 * sündmuste loendi:
 *   { type: "swipe", axis: "x" | "y", dir: -1 | 1, travel }
 *   { type: "unclear", axis }  — liigutus oli, aga suund jäi segaseks
 * `dir` on käe liikumise suund ekraanil (x: 1 = paremale, y: 1 = alla).
 *
 * Suund otsustatakse LIIGUTUSE LÕPUS (käsi seisab restMs), mitte esimese
 * kiire kaadri järgi (omanik 26.09: „lehvitan vasakule või paremale, ei saa
 * aru, kas vasakule või paremale"). Inimene võtab enne vasakule lükkamist
 * sageli hoogu paremale; esimese tõmbe järgi otsustades tuli sealt
 * paremale-samm ja tagasilöögi kaitse blokeeris päris liigutuse. Nüüd
 * võidab kiireim tõmme: hoog on aeglasem kui löök, lehvitamises on
 * mõlemad suunad ühesugused ja siis ei tehta midagi.
 */
export function createSwipeTracker(options = {}) {
  const cfg = { ...SWIPE_DEFAULTS, ...options };
  let prev = null; // { x, y, t }
  let vel = { x: 0, y: 0 };
  let since = null;
  let rest = null; // viimane koht, kus käsi seisis
  let gesture = null;
  let hold = null; // { axis, dir, until }
  let lastMotion = Number.NEGATIVE_INFINITY;
  let speedNow = 0;

  const run = () => ({ sign: 0, len: 0, peak: 0 });
  const lose = () => {
    prev = null;
    vel = { x: 0, y: 0 };
    since = null;
    rest = null;
    gesture = null;
  };
  const closeRun = (g, axis) => {
    const r = g.runs[axis];
    const best = g.best[axis][r.sign];
    if (r.sign && (!best || r.peak > best.peak)) g.best[axis][r.sign] = { peak: r.peak, len: r.len };
    g.runs[axis] = run();
  };
  // Üks telg: järjestikused samasuunalised nihked on üks tõmme.
  const track = (g, axis, d, v) => {
    if (Math.abs(d) < cfg.jitter) return;
    const sign = Math.sign(d);
    if (g.runs[axis].sign && g.runs[axis].sign !== sign) closeRun(g, axis);
    const r = g.runs[axis];
    r.sign = sign;
    r.len += Math.abs(d);
    r.peak = Math.max(r.peak, sign * v);
    g.peak[axis] = Math.max(g.peak[axis], Math.abs(v));
  };
  const decide = (g, at) => {
    closeRun(g, "x");
    closeRun(g, "y");
    if (g.tooLong) return null;
    const axis = g.peak.x >= g.peak.y ? "x" : "y";
    const other = axis === "x" ? "y" : "x";
    if (g.peak[axis] < cfg.dominance * g.peak[other]) return null;
    const min = axis === "x" ? cfg.minTravelX : cfg.minTravelY;
    const fwd = g.best[axis][1];
    const back = g.best[axis][-1];
    let dir = 0;
    let travel = 0;
    if (fwd && (!back || fwd.peak >= cfg.clarity * back.peak)) [dir, travel] = [1, fwd.len];
    else if (back && (!fwd || back.peak >= cfg.clarity * fwd.peak)) [dir, travel] = [-1, back.len];
    else {
      const net = at[axis] - g.start[axis];
      if (Math.abs(net) >= min) [dir, travel] = [Math.sign(net), Math.abs(net)];
    }
    if (!dir || travel < min) return { type: "unclear", axis };
    return { type: "swipe", axis, dir, travel };
  };

  return {
    reset() {
      lose();
      hold = null;
      lastMotion = Number.NEGATIVE_INFINITY;
      speedNow = 0;
    },
    /* Kas käsi on liikumas või liikus just — siis ei ole sõrmede kokkuminek
       näpistus. Lehvitamise pöördepunktis on kiirus hetkeks null, aga
       liigutus (gesture) kestab, nii et ka seal on käsi „liikumas". */
    moving(t) {
      return gesture !== null || speedNow >= cfg.movingSpeed || t - lastMotion < cfg.settleAfterMs;
    },
    update({ t, hand, pinched = false }) {
      if (!hand) {
        if (!prev || t - prev.t > cfg.lostGraceMs) lose();
        return [];
      }
      if (since === null) since = t;
      if (!prev) {
        prev = { x: hand.x, y: hand.y, t };
        rest = { x: hand.x, y: hand.y };
        return [];
      }
      const dtMs = Math.max(1, t - prev.t);
      const k = 1 - Math.exp(-dtMs / cfg.velocityTauMs);
      vel = {
        x: vel.x + k * (((hand.x - prev.x) * 1000) / dtMs - vel.x),
        y: vel.y + k * (((hand.y - prev.y) * 1000) / dtMs - vel.y),
      };
      const from = prev;
      prev = { x: hand.x, y: hand.y, t };
      const speed = Math.max(Math.abs(vel.x), Math.abs(vel.y));
      speedNow = speed;
      if (gesture) lastMotion = t;

      if (pinched || t - since < cfg.settleMs) {
        gesture = null;
        if (speed < cfg.endSpeed) rest = { x: hand.x, y: hand.y };
        return [];
      }

      if (!gesture) {
        if (speed < cfg.endSpeed) {
          rest = { x: hand.x, y: hand.y };
          return [];
        }
        if (speed < cfg.startSpeed) return [];
        gesture = {
          t0: t,
          start: rest,
          restSince: null,
          tooLong: false,
          runs: { x: run(), y: run() },
          best: { x: {}, y: {} },
          peak: { x: 0, y: 0 },
        };
        // Liigutus algas seisukohast, mitte läve ületamise kaadrist.
        track(gesture, "x", hand.x - rest.x, vel.x);
        track(gesture, "y", hand.y - rest.y, vel.y);
        return [];
      }

      track(gesture, "x", hand.x - from.x, vel.x);
      track(gesture, "y", hand.y - from.y, vel.y);
      if (t - gesture.t0 > cfg.maxGestureMs) gesture.tooLong = true;
      if (speed >= cfg.endSpeed) {
        gesture.restSince = null;
        return [];
      }
      if (gesture.restSince === null) gesture.restSince = t;
      if (t - gesture.restSince < cfg.restMs) return [];

      const result = decide(gesture, hand);
      gesture = null;
      lastMotion = t;
      rest = { x: hand.x, y: hand.y };
      if (!result) return [];
      if (result.type === "swipe") {
        const returning = hold && t < hold.until && hold.axis === result.axis && hold.dir === -result.dir;
        if (returning) return [];
        hold = { axis: result.axis, dir: result.dir, until: t + cfg.returnMs };
      }
      return [result];
    },
  };
}

export const FIST_DEFAULTS = Object.freeze({
  /* Rusikas peab seisma, enne kui ta midagi teeb: käe langetamine või
     haaramine läbib rusikakuju hetkeks, aga ei hoia seda. Üle näpistuse
     ülempiiri (PINCH_DEFAULTS.tapMaxMs 550): näpistuse poos on rusikaga
     sarnane, ja lühike kokkupanek peab jääma näpistuseks. */
  holdMs: 600,
  /* Üksik mitte-rusika kaader ei lõpeta rusikat (mudeli värin) — ka
     aeglasemal seadmel, kus üks kaader kestab 100–150 ms. */
  releaseMs: 250,
  /* Nii kaua pärast rusika tegu ei loe näpistus ega tõmme: avanev käsi
     läbib näpistusekuju ja võiks muidu kohe uue lehe avada. Enne tegu
     vaikust ei ole — siis võib see veel olla näpistus. */
  quietMs: 600,
});

/**
 * Rusikas = tagasi. `update({ t, hand: null | { fist } })` →
 * `{ fist, back, quiet }`; `back` tuleb üks kord hoitud rusika kohta,
 * uus rusikas vajab vahepeal avatud kätt. `quiet` kestab tegust kuni
 * quietMs pärast rusika lõppu.
 */
export function createFistTracker(options = {}) {
  const cfg = { ...FIST_DEFAULTS, ...options };
  let since = null;
  let openSince = null;
  let fired = false;
  // Viimane kaader, kus käsi oli rusikas PÄRAST tegu.
  let lastFired = Number.NEGATIVE_INFINITY;

  const clear = () => {
    since = null;
    openSince = null;
    fired = false;
  };

  return {
    reset() {
      clear();
      lastFired = Number.NEGATIVE_INFINITY;
    },
    update({ t, hand }) {
      let back = false;
      if (!hand) {
        clear();
      } else if (hand.fist) {
        openSince = null;
        if (since === null) since = t;
        if (!fired && t - since >= cfg.holdMs) {
          fired = true;
          back = true;
        }
        if (fired) lastFired = t;
      } else if (since !== null) {
        if (openSince === null) openSince = t;
        if (t - openSince >= cfg.releaseMs) clear();
      }
      return { fist: since !== null, back, quiet: t - lastFired < cfg.quietMs };
    },
  };
}
