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
  /* Kiirus kaadrilaiustes (-kõrgustes) sekundis, mõõdetuna ajaaknast, mitte
     kaadrist kaadrisse: mudeli punktid värisevad, ja nõrgem telefon annab
     8–10 kaadrit sekundis, sülearvuti 25–30. Žest peab mõlemal sama olema. */
  velocityWindowMs: 100,
  /* Alla selle on käsi paigal; aeglane triiv ei ole tõmme. */
  restSpeed: 0.2,
  /* Nii kaua peab käsi aeglane olema, et see loeks peatuseks. */
  restHoldMs: 80,
  /* Liigutuse tippkiirus peab olema vähemalt see: tõmme on kiire. Leebe,
     sest „inimesed ei tee seda täiuslikult, isegi osalised liigutused võiks
     lugeda" (omanik 26.09). */
  startSpeed: 0.45,
  /* Minimaalne tõmme kaadri suhtes; ka poolik liigutus loeb. */
  minTravelX: 0.09,
  minTravelY: 0.06,
  /* Põhitelje nihe peab olema nii mitu korda suurem kui teise telje oma.
     Viltune liigutus loeb valdava suuna järgi, diagonaal ei loe. */
  dominance: 1.3,
  /* Sellest pikem horisontaalne liigutus on selge tõmme ja kehtib kohe,
     keset liikumist. Lühem võib olla hoovõtt ja kehtib alles lõigu lõpus. */
  strongTravel: 0.2,
  /* Hoovõtt (omanik 26.09: enne vasakule lükkamist võetakse hoogu paremale)
     on tõmbest palju lühem; käe tagasitoomine on sama pikk või lühem.
     Otsustab PIKKUS, mitte kiirus: tagasitoomine on sageli sama kiire kui
     tõmme, ja kiiruste võrdlus luges siis terve liigutuse lehvitamiseks
     (ei midagi) või vastupidiseks suunaks. Lühike lõik ootab nii kaua. */
  windupRatio: 1.4,
  windupMs: 260,
  /* Pärast tõmmet toob käsi end tagasi: nii kaua ei loe vastassuunaline
     liigutus samal teljel. */
  returnMs: 800,
  /* Pärast tõmmet ei loe ükski liigutus nii kaua. */
  refractoryMs: 200,
  /* Kaadrisse tõstetud käsi peab korra peatuma, enne kui liigutused
     loevad: käe tõstmine ise ei tohi lehte kerida. Küljeservast (edgeX)
     sisse pühkiv käsi tohib kohe horisontaalselt tõmmata. */
  settleMs: 300,
  edgeX: 0.2,
  /* Nii pikk liigutus on triiv, mitte tõmme. */
  maxStrokeMs: 1100,
  /* Kiire tõmbe ajal kaotab mudel käe sageli kaadriks-paariks
     (liikumishägu); nii kaua liigutus jätkub. */
  lostGraceMs: 400,
  /* Kui käsi kaob horisontaalsel pühkimisel (läbi kaadri või hägu), kehtib
     nii pikk tõmme. Vertikaalne kadumine on käe langetamine ega keri. */
  lostSweepX: 0.15,
  /* Nii kaua pärast kiiret liigutust loetakse käsi veel liikuvaks (vt
     moving): käsi rahuneb, sõrmed alles kogunevad. */
  settleAfterMs: 400,
  movingSpeed: 0.5,
});

/**
 * Käe tõmbed. `update({ t, hand: null | { x, y }, pinched })` tagastab
 * sündmuste loendi `{ type: "swipe", axis: "x" | "y", dir: -1 | 1, travel }`.
 * `dir` on käe liikumise suund ekraanil (x: 1 = paremale, y: 1 = alla).
 *
 * Liigutus jaguneb lõikudeks: lõik algab peatusest või pöördepunktist ja
 * lõpeb järgmises. Lõik on tõmme, kui ta on kiire, piisavalt pikk ja ühe
 * telje suunas (omanik 28.09: vana loogika jättis iga tõmbe ootele ja
 * võrdles teda järgmise liigutusega; käe loomulik tagasitoomine tühistas
 * või pööras siis ligi veerandi tõmmetest).
 * - Pikk horisontaalne tõmme kehtib kohe. Lühem kehtib lõigu lõpus, kui
 *   talle ei järgne palju pikemat vastassuunalist lõiku — siis oli ta hoovõtt.
 * - Pärast tõmmet on vastassuunaline liigutus samal teljel käe
 *   tagasitoomine. Pidev edasi-tagasi (lehvitamine) annab ühe sammu: pärast
 *   tagasitoomist vajab uus tõmme peatust.
 * - Üles-alla kehtib ainult lõigu lõpus kaadris: käe langetamine kaob
 *   kaadrist enne, kui ta aeglustub. Kaadrisse tõstetud käsi peab enne
 *   korra peatuma.
 */
export function createSwipeTracker(options = {}) {
  const cfg = { ...SWIPE_DEFAULTS, ...options };
  let trail = []; // viimased asukohad kiiruse akna jaoks
  let lastSeen = null; // viimane nähtud { x, y, t }
  let since = null; // millal käsi kaadrisse ilmus
  let sideEntry = false; // ilmus küljeservast: pühib, mitte ei tõuse
  let armed = false; // käsi on pärast ilmumist korra peatunud
  let restSince = null;
  let seg = null; // { start, t0, far, farLen, way, peak, fired, armed, entry }
  let pending = null; // lühike lõik ootel: { axis, dir, travel, until }
  let lock = null; // viimane tõmme: { axis, dir, until, returned }
  let waving = false; // tagasitoomisele järgnes kohe uus liigutus
  let quietUntil = Number.NEGATIVE_INFINITY;
  let speedNow = 0;
  let lastFast = Number.NEGATIVE_INFINITY;

  const lose = () => {
    trail = [];
    lastSeen = null;
    since = null;
    sideEntry = false;
    armed = false;
    restSince = null;
    seg = null;
    speedNow = 0;
  };

  const measure = (s) => {
    const dx = s.far.x - s.start.x;
    const dy = s.far.y - s.start.y;
    const axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    const main = axis === "x" ? dx : dy;
    const travel = Math.abs(main);
    const ok =
      travel >= (axis === "x" ? cfg.minTravelX : cfg.minTravelY) &&
      travel >= cfg.dominance * Math.abs(axis === "x" ? dy : dx) &&
      s.peak >= cfg.startSpeed;
    return { axis, dir: main < 0 ? -1 : 1, travel, ok };
  };

  /* Tagasitoomine otsustatakse lõigu ALGUSES: kui vastassuunaline lõik
     algas lukuajal, on ta tagasitoomine, kui kaua ta ka ei kestaks. */
  const isReturn = (s, m) => s.after !== null && s.after.axis === m.axis && s.after.dir === -m.dir;
  const blocked = (m, t) => t < quietUntil || waving;

  const lockAt = (t) => (lock !== null && t < lock.until ? lock : null);

  const emit = (events, m, t) => {
    events.push({ type: "swipe", axis: m.axis, dir: m.dir, travel: m.travel });
    lock = { axis: m.axis, dir: m.dir, until: t + cfg.returnMs, returned: false };
    quietUntil = t + cfg.refractoryMs;
    pending = null;
  };

  /* Ootel lõik kehtib alles siis, kui samal teljel ei ole vastassuunaline
     lõik pooleli: tema pikkus otsustab, kas ootel lõik oli hoovõtt või
     järgnes talle käe tagasitoomine (close). */
  const opposing = () => {
    if (!seg || !pending || !seg.way) return false;
    const along = pending.axis === "x" ? seg.way.x : seg.way.y;
    return along * pending.dir < -0.5;
  };
  const flush = (events, t) => {
    if (pending && t >= pending.until && !opposing()) {
      const p = pending;
      pending = null;
      if (!blocked(p, t)) emit(events, p, t);
    }
  };

  /* Lõik on läbi: peatus, pööre, kadumine (`visible: false`) või triiv. */
  const close = (events, t, { visible = true, drift = false } = {}) => {
    const s = seg;
    seg = null;
    if (!s || drift) return;
    const m = measure(s);
    if (isReturn(s, m)) {
      if (s.peak >= cfg.startSpeed) s.after.returned = true;
      return;
    }
    if (s.fired || !m.ok) return;
    if (m.axis === "y" ? !visible || !s.armed : !(s.armed || s.entry)) return;
    if (!visible && m.travel < cfg.lostSweepX) return;
    if (pending && pending.axis === m.axis && pending.dir === -m.dir) {
      if (m.travel < cfg.windupRatio * pending.travel) {
        // Tagasitoomine: ootel lõik oli tõmme, see lõik mitte.
        const p = pending;
        pending = null;
        if (!blocked(p, t)) emit(events, p, t);
        if (lock) lock.returned = true;
        return;
      }
      pending = null; // palju pikem vastassuunaline: ootel lõik oli hoovõtt
    }
    if (blocked(m, t)) return;
    if (m.travel >= cfg.strongTravel || !visible) emit(events, m, t);
    else pending = { ...m, until: t + cfg.windupMs };
  };

  return {
    reset() {
      lose();
      pending = null;
      lock = null;
      waving = false;
      quietUntil = Number.NEGATIVE_INFINITY;
      lastFast = Number.NEGATIVE_INFINITY;
    },
    /* Kas käsi on liikumas või liikus just — siis ei ole sõrmede kokkuminek
       näpistus. Lehvitamise pöördepunktis on kiirus hetkeks null, aga
       lastFast hoiab käe veel „liikuvana". */
    moving(t) {
      return speedNow >= cfg.movingSpeed || (seg !== null && seg.peak >= cfg.startSpeed) || t - lastFast < cfg.settleAfterMs;
    },
    update({ t, hand, pinched = false }) {
      const events = [];
      if (!hand) {
        if (lastSeen && t - lastSeen.t > cfg.lostGraceMs) {
          close(events, t, { visible: false });
          lose();
        }
        flush(events, t);
        return events;
      }
      const pos = { x: hand.x, y: hand.y, t };
      if (!lastSeen) {
        since = t;
        sideEntry = hand.x < cfg.edgeX || hand.x > 1 - cfg.edgeX;
        trail = [pos];
        lastSeen = pos;
        flush(events, t);
        return events;
      }
      trail.push(pos);
      while (trail.length > 2 && t - trail[1].t >= cfg.velocityWindowMs) trail.shift();
      const from = trail[0];
      const dt = Math.max(1, t - from.t) / 1000;
      const vel = { x: (pos.x - from.x) / dt, y: (pos.y - from.y) / dt };
      const speed = Math.hypot(vel.x, vel.y);
      const turnFrom = lastSeen;
      speedNow = speed;
      lastSeen = pos;
      if (speed >= cfg.startSpeed) lastFast = t;

      // Näpistus, rusikas ja nende järelvaikus ei ole tõmme.
      if (pinched) {
        seg = null;
        restSince = null;
        flush(events, t);
        return events;
      }

      if (speed < cfg.restSpeed) {
        if (restSince === null) restSince = t;
        if (t - restSince >= cfg.restHoldMs) {
          close(events, t);
          waving = false;
          if (t - since >= cfg.settleMs) armed = true;
        }
        flush(events, t);
        return events;
      }
      restSince = null;

      if (seg && seg.way && (vel.x * seg.way.x + vel.y * seg.way.y) / speed < 0) {
        // Pööre: lõik on läbi, uus algab pöördepunktist.
        const turnAt = seg.far;
        close(events, t);
        if (lock?.returned && t < lock.until) waving = true;
        seg = { start: turnAt, t0: turnFrom.t, far: pos, farLen: 0, way: null, peak: 0, fired: false, armed, entry: false, after: lockAt(t) };
      } else if (!seg) {
        seg = { start: { x: from.x, y: from.y }, t0: from.t, far: pos, farLen: 0, way: null, peak: 0, fired: false, armed, entry: sideEntry && !armed, after: lockAt(t) };
      }

      seg.peak = Math.max(seg.peak, speed);
      const dx = pos.x - seg.start.x;
      const dy = pos.y - seg.start.y;
      const len = Math.hypot(dx, dy);
      if (len >= seg.farLen) {
        seg.far = pos;
        seg.farLen = len;
      }
      if (len > 0.02) seg.way = { x: dx / len, y: dy / len };

      if (t - seg.t0 > cfg.maxStrokeMs) {
        close(events, t, { drift: true });
      } else if (!seg.fired) {
        // Pikk horisontaalne tõmme kehtib kohe, keset liikumist.
        const m = measure(seg);
        if (m.ok && m.axis === "x" && m.travel >= cfg.strongTravel && (seg.armed || seg.entry)) {
          if (pending && pending.axis === "x" && pending.dir === -m.dir && m.travel >= cfg.windupRatio * pending.travel) {
            pending = null; // ootel lõik oli hoovõtt
          }
          if (isReturn(seg, m)) {
            seg.after.returned = true;
          } else if (!pending && !blocked(m, t)) {
            emit(events, m, t);
            seg.fired = true;
          }
        }
      }
      flush(events, t);
      return events;
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
