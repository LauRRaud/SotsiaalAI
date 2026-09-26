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
  /* Kiirus kaadrilaiustes (-kõrgustes) sekundis. Tõmme algab üle
     startSpeed; alla endSpeed on käsi paigal. Omanik 26.09: „inimesed ei
     tee seda täiuslikult, isegi osalised liigutused võiks lugeda" —
     seepärast on läved leebed (0,8 → 0,45). */
  startSpeed: 0.45,
  endSpeed: 0.2,
  /* Tõmme on läbi, kui käsi aeglustub alla selle osa tippkiirusest või
     pöörab suunda — MITTE alles siis, kui käsi jääb seisma. Päris inimene
     ei külmu pärast tõmmet paigale: käsi laskub alla või triivib edasi,
     ja seismist ootav loogika ei lõpetanud liigutust kunagi (omanik
     26.09: „vasakule ja paremale, üles ja alla ei tööta"). */
  endRatio: 0.35,
  endHoldMs: 30,
  /* Nii palju (kosinus) võib kiirus tõmbe suunast (tippkiiruse hetke
     suunast) kõrvale pöörata: kaar (küünarnukk on pöördetelg, otstes
     ~45°) mahub sisse, tagasipööre ja tõmbelt käe langetamisse üleminek
     (90°) mitte. */
  turnCos: 0.5,
  /* Tõmbe nihe põhiteljel peab olema nii mitu korda suurem kui teisel.
     Viltune liigutus loeb valdava suuna järgi; ainult peaaegu täpne
     diagonaal ei loe (1,3 → 1,15). */
  dominance: 1.15,
  /* Minimaalne tõmme kaadri suhtes: ka poolik liigutus loeb (0,12/0,08 →
     0,08/0,06). */
  minTravelX: 0.08,
  minTravelY: 0.06,
  /* Kaadrisse tõstetud käsi peab hetke paigal olema, enne kui liigutused
     loevad: käe tõstmine ise ei tohi lehte kerida. */
  settleMs: 300,
  /* Lõppenud tõmme ootab nii kaua (ja kuni järgmine tõmme lõpeb), enne
     kui ta kehtib: enne vasakule lükkamist võetakse sageli hoogu
     paremale, ja kiirem vastassuunaline tõmme kirjutab hoo üle. */
  confirmMs: 200,
  /* Kui ootel tõmbele järgnes käe tagasitoomine, oodatakse kauem: kui käsi
     läheb uuesti samas suunas, oli see lehvitamine. Lehvitamise pöördes on
     käsi hetkeks aeglane ja lühike ootus jõudis selle ajaga läbi. */
  returnWaitMs: 250,
  /* Nii palju kiirem peab tõmme olema vastassuunalisest, et üks neist
     oleks selge suund (hoog vs löök, löök vs käe tagasitoomine). Sama kiire
     edasi-tagasi on lehvitamine. */
  clarity: 1.15,
  /* Pärast tõmmet toob käsi end tagasi. Nii kaua ei loe vastassuunaline
     tõmme samal teljel. */
  returnMs: 800,
  /* Nii pikk „tõmme" on triiv, mitte žest. */
  maxStrokeMs: 1000,
  /* Tõmme on eraldiseisev kiire liigutus: enne teda ei tohi nii kaua
     olnud teist kiiret liigutust. Kätega rääkiv käsi teeb pidevalt väikesi
     kiireid ringe — need ei ole tõmbed. Aeglane hoog enne lööki ei ole
     kiire, nii et ta lööki ei blokeeri. Erandid: servast sisse pühkiv
     käsi, ootel tõmbele järgnev tõmme ja chainMs jooksul pärast
     eraldiseisvat tõmmet (kiire hoog → löök). */
  isolationMs: 350,
  fastGapMs: 100,
  chainMs: 300,
  /* Lehvitamise järel (suund segane) on tõmbed vait, kuni käsi on nii
     kaua tõmmeteta olnud. */
  muteMs: 600,
  /* Kiirus mõõdetakse selle ajaakna nihkest, mitte kaadrist kaadrisse:
     mudeli punktid värisevad ja kaadripõhine kiirus hüppaks üle leebe
     läve. Aken on ajas, mitte kaadrites: nõrgem telefon annab 8–10
     kaadrit sekundis, sülearvuti 25–30, ja žest peab mõlemal sama olema. */
  velocityWindowMs: 100,
  /* Kiire tõmbe ajal kaotab mudel käe sageli kaadriks-paariks
     (liikumishägu). Nii kaua tõmme jätkub; pikem kadumine (käsi
     langetati kaadrist välja) tühistab pooleli oleva tõmbe. */
  lostGraceMs: 400,
  /* Nii kaua pärast liigutust loetakse käsi veel liikuvaks (vt moving):
     käsi rahuneb, sõrmed alles kogunevad. */
  settleAfterMs: 400,
  /* Sellest kiirem käsi on liikumas, ka kui liigutus ei ole veel tõmme. */
  movingSpeed: 0.5,
  /* Lehvitamise aken: kaadri keskosa. Omanik pühib kätt läbi — tuleb
     ühest servast, läheb teisest välja (26.09: „et saaks aru, kummalt
     poolt käsi tuleb" … „siis peab lehvitamise aken väiksem olema").
     Kogu kaamera vaatest välja ei pea kätt viima: akna servast
     (edgeX/edgeY kaadri servast) väljumine loeb samamoodi. Kaamerapaan
     näitab akent raamina. Servast sisenev käsi tohib kohe tõmmata. */
  edgeX: 0.25,
  edgeY: 0.2,
  /* Kiire pühkimine võib käe hägu tõttu tuvastusest kaotada ka keset
     kaadrit. Kui horisontaalne tõmme oli selleks ajaks nii pikk, kehtib
     ta ikkagi (vertikaalne mitte: see on käe langetamine). */
  lostSweepX: 0.18,
});

/**
 * Käe tõmbed. `update({ t, hand: null | { x, y }, pinched })` tagastab
 * sündmuste loendi:
 *   { type: "swipe", axis: "x" | "y", dir: -1 | 1, travel }
 *   { type: "unclear", axis }  — edasi-tagasi sama kiiresti (lehvitamine)
 * `dir` on käe liikumise suund ekraanil (x: 1 = paremale, y: 1 = alla).
 *
 * Tõmme = kiire liigutus seisust kuni aeglustumise või suunapöördeni —
 * või läbi kaadri: servast sisse ja/või vastasservast välja. Suund on nihe
 * algusest kaugeima punktini (kaar ei sega). Üles-alla läbi kaadri loeb
 * ainult servast servani, sest käe tõstmine kaadrisse ja langetamine
 * välja on samasugused liigutused. Lõppenud tõmme jääb
 * ootele (confirmMs, ja kuni järgmine tõmme on läbi): kui järgneb kiirem
 * vastassuunaline tõmme, oli esimene hoog ja kehtib teine (omanik 26.09:
 * lehvitades ei saanud suunast aru); aeglasem vastassuunaline on käe
 * tagasitoomine; sama kiire on lehvitamine — siis ei kehti kumbki.
 */
export function createSwipeTracker(options = {}) {
  const cfg = { ...SWIPE_DEFAULTS, ...options };
  let prev = null; // { x, y, t }
  let vel = { x: 0, y: 0 };
  let trail = []; // viimased asukohad kiiruse akna jaoks
  let since = null;
  let rest = null; // viimane koht, kus käsi seisis
  let stroke = null; // { t0, start, far, farLen, path, peak, way, slowSince, entry }
  let entry = null; // serv, kust käsi kaadrisse tuli ("left" | "right" | "top" | "bottom")
  let sweptIn = false; // käsi ilmus servast — ta on pühkimas, mitte tõusmas
  let pending = null; // { axis, dir, travel, peak, until }
  let hold = null; // { axis, dir, until }
  let muteUntil = Number.NEGATIVE_INFINITY;
  let lastMotion = Number.NEGATIVE_INFINITY;
  let speedNow = 0;
  let lastFastAt = Number.NEGATIVE_INFINITY; // viimane kiire kaader
  let isolated = true; // praegune kiire lõik algas pärast pikka vaikust
  let chainUntil = Number.NEGATIVE_INFINITY;

  const lose = () => {
    prev = null;
    vel = { x: 0, y: 0 };
    trail = [];
    since = null;
    rest = null;
    stroke = null;
    entry = null;
    sweptIn = false;
    speedNow = 0;
  };
  // Mis pool lehvitamise aknast väljas see punkt on (või null — aknas).
  const edgeOf = (p) =>
    p.x < cfg.edgeX ? "left" : p.x > 1 - cfg.edgeX ? "right" : p.y < cfg.edgeY ? "top" : p.y > 1 - cfg.edgeY ? "bottom" : null;
  const opposite = { left: "right", right: "left", top: "bottom", bottom: "top" };
  /* Serv, millest käsi liikumise suunas välja läks. Nurgas on käsi mitme
     serva taga — valib selle, kuhu ta rohkem liikus: paremas alanurgas
     langetatud käsi läks alt välja, mitte paremalt. */
  const exitOf = (p, v) => {
    const sides = [
      ["left", p.x < cfg.edgeX ? -v.x : 0],
      ["right", p.x > 1 - cfg.edgeX ? v.x : 0],
      ["top", p.y < cfg.edgeY ? -v.y : 0],
      ["bottom", p.y > 1 - cfg.edgeY ? v.y : 0],
    ].filter(([, toward]) => toward > 0);
    sides.sort((a, b) => b[1] - a[1]);
    return sides.length ? sides[0][0] : null;
  };

  const emit = (events, p, t) => {
    events.push({ type: "swipe", axis: p.axis, dir: p.dir, travel: p.travel });
    hold = { axis: p.axis, dir: p.dir, until: t + cfg.returnMs };
  };

  const flush = (events, t) => {
    if (pending && !stroke && t >= pending.until) {
      emit(events, pending, t);
      pending = null;
    }
  };

  /* `exit` = serv, kust käsi tõmbe ajal kaadrist välja läks; "lost" =
     kadus pikal horisontaalsel pühkimisel keset kaadrit; või null. */
  const finish = (events, t, exit = null) => {
    const s = stroke;
    stroke = null;
    lastMotion = t;
    if (s.calm) chainUntil = t + cfg.chainMs;
    /* Lõpp = tõmbe enda suunas (tippkiiruse suund) kaugeim punkt, mitte
       praegune ega algusest kaugeim: pööre tuvastub kaadri-paari võrra
       hiljem ja selleks ajaks on käsi juba tagasi- või allateel (käe
       langetamine pärast külgtõmmet muutis lühikese tõmbe viltuseks). */
    let end = s.far;
    if (s.way) {
      let best = Number.NEGATIVE_INFINITY;
      for (const p of s.path) {
        const along = (p.x - s.start.x) * s.way.x + (p.y - s.start.y) * s.way.y;
        if (along > best) {
          best = along;
          end = p;
        }
      }
    }
    rest = end;
    const dx = end.x - s.start.x;
    const dy = end.y - s.start.y;
    const axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    const main = axis === "x" ? dx : dy;
    const other = axis === "x" ? dy : dx;
    const min = axis === "x" ? cfg.minTravelX : cfg.minTravelY;
    if (t < muteUntil) muteUntil = t + cfg.muteMs; // ka poolik liigutus lehvitamise ajal hoiab vaikust
    if (Math.abs(main) < min || Math.abs(main) < cfg.dominance * Math.abs(other)) return;
    if (axis === "y") {
      /* Üles-alla: käe tõstmine kaadrisse ja langetamine välja ei keri.
         Kaadrisse ilmunud või kaadrist kadunud käe vertikaalne tõmme kehtib
         ainult servast servani. Nähtavaks jääv käsi võib tõmmata ka akna
         serva taha — tema lõpetas tõmbe, mitte ei langetanud kätt. */
      const vertical = (side) => (side === "top" || side === "bottom" ? side : null);
      const from = vertical(s.entry) || (exit ? vertical(edgeOf(s.start)) : null);
      const to = vertical(exit);
      if ((from || to) && !(from && to && to === opposite[from])) return;
    }
    const cand = { axis, dir: Math.sign(main), travel: Math.abs(main), peak: s.peak };
    if (t < muteUntil) {
      muteUntil = t + cfg.muteMs;
      return;
    }
    if (hold && t < hold.until && hold.axis === axis && hold.dir === -cand.dir) return;
    if (!pending) {
      pending = { ...cand, until: t + cfg.confirmMs };
      return;
    }
    if (pending.axis === axis && pending.dir === -cand.dir) {
      if (cand.peak >= cfg.clarity * pending.peak) {
        pending = { ...cand, until: t + cfg.confirmMs }; // hoog — kehtib see tõmme
      } else if (pending.peak < cfg.clarity * cand.peak) {
        pending = null; // lehvitamine
        muteUntil = t + cfg.muteMs;
        events.push({ type: "unclear", axis });
      } else {
        pending.returns = (pending.returns || 0) + 1; // käe tagasitoomine
        pending.until = t + cfg.returnWaitMs;
      }
      return;
    }
    if (pending.axis === axis && pending.returns) {
      /* Edasi, tagasi ja jälle edasi: see on lehvitamine, ükskõik kui
         erineva kiirusega pooled olid. */
      pending = null;
      muteUntil = t + cfg.muteMs;
      events.push({ type: "unclear", axis });
      return;
    }
    if (pending.axis === axis) {
      // Sama suund kohe otsa: üks tõmme, mille kiirus vahepeal notsus.
      pending.travel += cand.travel;
      pending.peak = Math.max(pending.peak, cand.peak);
      pending.until = t + cfg.confirmMs;
      return;
    }
    /* Teine telg kohe otsa: käsi teeb ringe (kätega rääkimine), mitte
       tõmbeid. Kumbki ei kehti ja tõmbed on hetke vait — ilma teateta,
       sest see ei olnud katse midagi teha. */
    pending = null;
    muteUntil = t + cfg.muteMs;
  };

  return {
    reset() {
      lose();
      pending = null;
      hold = null;
      muteUntil = Number.NEGATIVE_INFINITY;
      lastMotion = Number.NEGATIVE_INFINITY;
    },
    /* Kas käsi on liikumas või liikus just — siis ei ole sõrmede kokkuminek
       näpistus. Lehvitamise pöördepunktis on kiirus hetkeks null, aga
       lastMotion hoiab käe veel „liikuvana". */
    moving(t) {
      return stroke !== null || speedNow >= cfg.movingSpeed || t - lastMotion < cfg.settleAfterMs;
    },
    update({ t, hand, pinched = false }) {
      const events = [];
      if (!hand) {
        // Tõmme viis käe servast välja: see on läbi kaadri pühkimine.
        if (stroke && prev) {
          const exit = exitOf(prev, vel);
          if (exit) finish(events, t, exit);
        }
        if (!prev || t - prev.t > cfg.lostGraceMs) {
          if (stroke) {
            const dx = stroke.far.x - stroke.start.x;
            const dy = stroke.far.y - stroke.start.y;
            if (Math.abs(dx) >= cfg.lostSweepX && Math.abs(dx) >= cfg.dominance * Math.abs(dy)) finish(events, t, "lost");
          }
          lose();
        }
        flush(events, t);
        return events;
      }
      if (since === null) {
        since = t;
        entry = edgeOf(hand);
        sweptIn = entry !== null;
      }
      if (!prev) {
        prev = { x: hand.x, y: hand.y, t };
        trail = [prev];
        rest = { x: hand.x, y: hand.y };
        flush(events, t);
        return events;
      }
      prev = { x: hand.x, y: hand.y, t };
      trail.push(prev);
      while (trail.length > 2 && t - trail[1].t >= cfg.velocityWindowMs) trail.shift();
      // Vanim asukoht akna sees; kui aken on ühest kaadrist lühem, eelmine.
      const within = (ms) => trail.find((p, i) => i === trail.length - 2 || t - p.t < ms + 1) || trail[0];
      const from = within(cfg.velocityWindowMs);
      const dtMs = Math.max(1, t - from.t);
      vel = { x: ((hand.x - from.x) * 1000) / dtMs, y: ((hand.y - from.y) * 1000) / dtMs };

      const pos = { x: hand.x, y: hand.y };
      const speed = Math.hypot(vel.x, vel.y);
      speedNow = speed;
      if (speed >= cfg.startSpeed) {
        // Uus kiire lõik, kui eelmisest on möödas üle fastGapMs.
        if (t - lastFastAt > cfg.fastGapMs) isolated = t - lastFastAt >= cfg.isolationMs;
        lastFastAt = t;
      }

      /* Servast sisenev käsi on pühkimas, mitte tõusmas: settleMs teda ei
         oota (tõmme pärast servalt sisenemist on `entry`-märgisega). */
      const settling = t - since < cfg.settleMs && !sweptIn;
      if (pinched || settling) {
        stroke = null;
        if (speed < cfg.endSpeed) rest = pos;
        flush(events, t);
        return events;
      }

      if (!stroke) {
        if (speed < cfg.endSpeed) rest = pos;
        // Servast tulek aegub, kui käsi on kaadris juba tükk aega olnud.
        if (entry && t - since > 2 * cfg.settleMs) entry = null;
        // Tõmme algas seisukohast, mitte läve ületamise kaadrist.
        const chained = t < chainUntil;
        if (speed >= cfg.startSpeed && t < muteUntil) muteUntil = t + cfg.muteMs; // lehvitab edasi
        if (speed >= cfg.startSpeed && (isolated || chained || entry || pending)) {
          const start = rest || pos;
          const calmStart = isolated || chained;
          stroke = { t0: t, start, far: pos, farLen: 0, path: [], peak: 0, way: null, slowSince: null, entry, calm: calmStart };
          entry = null;
        }
      }
      if (stroke) {
        /* Pööre tippkiiruse suuna suhtes: sujuv üleminek tõmbelt
           langetamisse pööraks ka nihke suuna kaasa ja jääks märkamata.
           Enne suuna uuendamist — muidu kirjutab kiirem tagasiliikumine
           suuna üle ja edasi-tagasi sulandub üheks (aeglasel kaameral
           mahub pööre ühte kaadrisse). */
        const cos = stroke.way && speed > 1e-6 ? (vel.x * stroke.way.x + vel.y * stroke.way.y) / speed : 1;
        if (speed >= stroke.peak && cos >= cfg.turnCos) {
          stroke.peak = speed;
          stroke.way = { x: vel.x / speed, y: vel.y / speed };
        }
        lastMotion = t;
        stroke.path.push(pos);
        const dx = pos.x - stroke.start.x;
        const dy = pos.y - stroke.start.y;
        const len = Math.hypot(dx, dy);
        if (len >= stroke.farLen) {
          stroke.far = pos;
          stroke.farLen = len;
        }
        if (t - stroke.t0 > cfg.maxStrokeMs) {
          stroke = null;
          rest = pos;
        } else if (speed >= cfg.endSpeed && cos < cfg.turnCos) {
          finish(events, t);
        } else if (speed < Math.max(cfg.endSpeed, cfg.endRatio * stroke.peak)) {
          if (stroke.slowSince === null) stroke.slowSince = t;
          if (t - stroke.slowSince >= cfg.endHoldMs) finish(events, t);
        } else {
          stroke.slowSince = null;
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
