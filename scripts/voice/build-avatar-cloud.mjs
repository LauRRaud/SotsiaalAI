/**
 * Häälavatari punktipilve ehitaja.
 *
 * Sisendid on omaniku eest- ja külgvaate renderdused. Eestvaatest võetakse
 * ainult TÄPID: nende asukoht, värv ja heledus. Külgvaade ei lisa ühtegi
 * nähtavat täppi, vaid annab otsmiku, nina, huulte ja lõua sügavuskõvera.
 *
 * Sügavus (z) ei ole pildis olemas ja tuleb tuletada. Esikoor on KÕRGUSVÄLI
 * z = D(x, y), seega tulevad normaalid otse selle välja gradiendist — nii
 * kannavad nad ka näo vormi (silmakoopad, ninaselg), mitte ainult ristlõiget.
 *
 * Kolm asja, mille esimene versioon valesti tegi (omanik 22.08, pööratud pea):
 *   1. KÕRVAD said suure ristlõike sügavuse (~70 px) ja lugesid koljulõiguna.
 *      Kõrv on lest: mõõdetud vöönd y 250..382, |x-kesk| > 186, sügavus
 *      lukustatud õhukeseks.
 *   2. TAGAKOOR andis pöördel teise paralleelse siluetikontuuri. Ta on nüüd
 *      täielikult eemaldatud — vt selgitust täpiemitteri juures.
 *   3. PEA sügavus oli reaLAIUSEGA võrdeline: lõua juures kitsenes rida ja
 *      nägu vajus alt ära, ülal jäi puhas pall. Nüüd on peal OMA sügavuskõver
 *      (kraniaal → silmad → lõug) ja näole eraldi vormistus.
 *
 * Käivitus:  node scripts/voice/build-avatar-cloud.mjs
 */

import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE = join(ROOT, "public", "voice", "Torsonägu.png");
const PROFILE_SOURCE = join(ROOT, "public", "voice", "Nägukülg.png");
const TARGET = join(ROOT, "public", "voice", "avatar-cloud.bin");

/* Kõik mõõdetud uue eestvaate alfakanalist (1448x1086). */
const LANDMARK = {
  crownY: 22,
  browY: 278,
  eyeY: 307,
  chinY: 558,
  neckY: 590,
  shoulderY: 710,
  bottomY: 1085,
  /* Uus renderdus ulatub rinnal madalamale kui avataripind vajab. Lõige on
     samas õla-rindkere vöötmes nagu Opus 5 algpilvel, mitte PNG alumises
     servas; nii ei tee lisandunud torso nägu ekraanil väiksemaks. */
  cropY: 1020,
  centerX: 718,
  /* Kõrvamügar on uuel eestvaatel y 238..392; kolju enda poollaius on seal
     ~185 px ja kõrvade välimine serv ~216 px. */
  earTopY: 238,
  earBottomY: 392,
  earInnerX: 188,
  eyeOffsetX: 94,
  noseTopY: 326,
  noseTipY: 415,
  mouthY: 472,
  pivotY: 576,
  pivotZ: 0.12,
  /* Vana pilve 1.186 ulatus hoiab uue, suhteliselt kitsama torso ekraanil
     sama mõõtu ega lase näol kaadrit vallutada. */
  frameExtent: 1.1861,
  centerYInHeadUnits: 1.12
};

/* Külgvaade on samal 1448x1086 lõuendil ja vaatab paremale. Läbipaistva
   halo asemel loetakse ainult vähemalt 60% alfaga keha serv. x=720 on
   renderduse sagitaaltelg: sellest paremale jääv serv on näo eesprofiil. */
const PROFILE = {
  centerX: 720,
  crownY: 5,
  chinY: 524,
  alphaThreshold: 0.6,
  smoothRadius: 28
};

const PEAK_THRESHOLD = 0.085;
const FACIAL_DETAIL = {
  topY: 320,
  bottomY: 535,
  halfWidth: 125,
  minSpacing: 3,
  noseSpacing: 4
};
/* Keha hõrendus. PUHTJUHUSLIK kustutus rebib lähtepildi voojooned katki —
   need jooned ON keha vorm, ja auk keskel loeb rebendina (omanik 22.08
   „keha on mitmest kohast katki, nagu ära rebitud"). Seepärast: heledad
   täpid (= jooned) jäävad ALATI alles ja hõrendatakse ainult tuhmi täidet.
   Mõõdetud heledusjaotus keha täppidel: p25 0.191, p45 0.394, p50 0.447. */
const BODY_LINE_LUM = 0.33;
const BODY_FILL_KEEP = 0.45;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Lineaarne interpolatsioon sõlmpunktide tabelist. */
function curve(stops, x) {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    if (x <= stops[i][0]) {
      const [x0, v0] = stops[i - 1];
      const [x1, v1] = stops[i];
      return v0 + (v1 - v0) * ((x - x0) / (x1 - x0));
    }
  }
  return stops[stops.length - 1][1];
}

/** Deterministlik räsi: hõrendus peab olema iga ehituse järel sama. */
function hash01(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/** Kahekäiguline chamfer-kaugusteisendus: kui kaugel on piksel maski servast. */
function distanceTransform(mask, w, h) {
  const INF = 1e9;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) dist[i] = mask[i] ? INF : 0;
  const D1 = 1;
  const D2 = Math.SQRT2;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (dist[i] === 0) continue;
      let best = dist[i];
      if (x > 0) best = Math.min(best, dist[i - 1] + D1);
      if (y > 0) best = Math.min(best, dist[i - w] + D1);
      if (x > 0 && y > 0) best = Math.min(best, dist[i - w - 1] + D2);
      if (x < w - 1 && y > 0) best = Math.min(best, dist[i - w + 1] + D2);
      dist[i] = best;
    }
  }
  for (let y = h - 1; y >= 0; y -= 1) {
    for (let x = w - 1; x >= 0; x -= 1) {
      const i = y * w + x;
      if (dist[i] === 0) continue;
      let best = dist[i];
      if (x < w - 1) best = Math.min(best, dist[i + 1] + D1);
      if (y < h - 1) best = Math.min(best, dist[i + w] + D1);
      if (x < w - 1 && y < h - 1) best = Math.min(best, dist[i + w + 1] + D2);
      if (x > 0 && y < h - 1) best = Math.min(best, dist[i + w - 1] + D2);
      dist[i] = best;
    }
  }
  return dist;
}

function invert(mask, w, h) {
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) out[i] = mask[i] ? 0 : 1;
  return out;
}

/**
 * Siluett tuleb täppidest KINNI ehitada. Lähtepilt on hõre punktimuster:
 * alfamask on täppide kogum, mitte täidetud keha, ja kaugusteisendus mõõdaks
 * iga üksiku täpi sisemust (mõõdetud: z jäi 0..0.135 pea-kõrgust, õige on
 * kordades rohkem). Sulgemine = paisuta R võrra, täida sisemised augud,
 * kahanda R võrra tagasi.
 */
function closeSilhouette(dots, w, h, radius) {
  const near = distanceTransform(invert(dots, w, h), w, h);
  const grown = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) grown[i] = near[i] <= radius ? 1 : 0;

  const outside = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x += 1) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += 1) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (outside[i] || grown[i]) continue;
    outside[i] = 1;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  const filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) filled[i] = outside[i] ? 0 : 1;

  const back = distanceTransform(filled, w, h);
  const result = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) result[i] = back[i] >= radius ? 1 : 0;
  return result;
}

/**
 * Pea POOLsügavus pea-kõrguse ühikutes. Ei sõltu rea laiusest: laiusega
 * seotud sügavus kitsenes lõua poole ja nägu vajus alt ära, ülal jäi pall.
 */
/* Kolju ja näokülje stabiilne põhisügavus. Külgvaate nina, huuled ja lõug
   lisatakse sellele keskjoone ümber; profiili kogu rea peale kandmine tegi
   nina asemel terve näorea ettepoole paisuvaks. */
const HEAD_DEPTH = [
  [0.0, 0.24],
  [0.18, 0.38],
  [0.45, 0.42],
  [0.68, 0.4],
  [0.85, 0.33],
  [1.0, 0.25]
];

/** Kaela ja keha sügavus on endiselt laiusega võrdeline. */
const BODY_DEPTH = [
  [LANDMARK.chinY, 0.86],
  [LANDMARK.neckY, 0.8],
  [LANDMARK.shoulderY, 0.5],
  [LANDMARK.bottomY, 0.34]
];

/**
 * Näo vorm. Ühtegi joont ega täppi juurde EI joonistata — muutub ainult
 * sügavus, seega otsevaates ei ole "jooniseid" näha ja täpimuster jääb
 * omaniku renderduseks. Vorm ilmub varjutuse kaudu.
 *
 * Orientiirid on Loomise proportsioonidest, pea kõrgus 446 px:
 * kulm 0.40, silmad 0.50, ninaalus 0.72, suu 0.79, lõug 1.00.
 * Tagastab sügavuse muutuse pikslites.
 */
function blob(dx, dy, rx, ry, amount) {
  const t = 1 - (dx * dx) / (rx * rx) - (dy * dy) / (ry * ry);
  return t > 0 ? amount * t * t : 0;
}

function faceSculpt(x, y, unit) {
  const dx = x - LANDMARK.centerX;
  let d = 0;

  for (const side of [-1, 1]) {
    const ex = dx - side * LANDMARK.eyeOffsetX;

    // Kulmuluu on tähtsam kui koobas ise: näo loeb välja tema ALLA jääv vari.
    d += blob(ex, y - LANDMARK.browY, unit * 0.16, unit * 0.052, unit * 0.02);
    /* Eestvaates on silmakoopa täpid juba olemas ja külgvaade annab kogu
       näopinna taandumise. Vana faceless-pilve tugev koobas tõmbas pöördel
       silma kõrgusel terve näopoole järsult sisse. Siin on ainult lokaalne,
       madal lohk — silm loeb valgusest, mitte kolju astmest. */
    d -= blob(ex, y - LANDMARK.eyeY, unit * 0.12, unit * 0.09, unit * 0.026);

    /* Külgvaade annab oimukoha taandumise juba ise. Eraldi lohk tegi
       pöördel kõrva kohal otsmiku ja näo vahele teise sügavusastme. */

    // Põsesarn ja selle all lohk — üksi ei loe kumbki.
    d += blob(dx - side * unit * 0.22, y - (LANDMARK.noseTipY - unit * 0.10), unit * 0.125, unit * 0.09, unit * 0.03);
    d -= blob(dx - side * unit * 0.19, y - (LANDMARK.mouthY - unit * 0.07), unit * 0.105, unit * 0.085, unit * 0.023);

    // Ninatiib on kitsas; suurem kaksikmügar tegi ninaotsa raskeks.
    d += blob(dx - side * unit * 0.055, y - LANDMARK.noseTipY, unit * 0.045, unit * 0.04, unit * 0.012);

    // Lõuanurk jääb loetav, kuid ei paisuta kõrvaalust tagumist lõuga.
    d += blob(dx - side * unit * 0.25, y - (LANDMARK.chinY - unit * 0.08), unit * 0.065, unit * 0.075, unit * 0.006);
  }

  /* Keskjoone kuju tuleb nüüd päris külgvaatest. Siia jäävad ainult väikesed
     kahepoolse vormi täpsustused, mida üks profiil ei saa anda. */
  // Nina juurest tipuni kulgev kitsas selg püüab valguse ka otsevaates.
  d += blob(dx, y - (LANDMARK.noseTopY + unit * 0.055), unit * 0.048, unit * 0.14, unit * 0.018);
  d -= blob(dx, y - (LANDMARK.noseTipY + unit * 0.015), unit * 0.085, unit * 0.026, unit * 0.018);
  d += blob(dx, y - (LANDMARK.mouthY - unit * 0.018), unit * 0.12, unit * 0.028, unit * 0.012);
  d -= blob(dx, y - LANDMARK.mouthY, unit * 0.13, unit * 0.018, unit * 0.016);
  d += blob(dx, y - (LANDMARK.mouthY + unit * 0.026), unit * 0.115, unit * 0.03, unit * 0.013);

  return d;
}

function ellipseOutline(dx, dy, rx, ry, inner = 0.08, outer = 0.28) {
  const radial = Math.hypot(dx / rx, dy / ry);
  return 1 - smoothstep(inner, outer, Math.abs(radial - 1));
}

/** Olemasolevate täppide soe anatoomiline aktsent, mitte lisatud joon. */
function facialAccentWeight(x, y, unit) {
  const dx = x - LANDMARK.centerX;
  let eyes = 0;
  for (const side of [-1, 1]) {
    eyes = Math.max(eyes, ellipseOutline(
      dx - side * LANDMARK.eyeOffsetX,
      y - LANDMARK.eyeY,
      unit * 0.115,
      unit * 0.038
    ));
  }

  const bridge = smoothstep(LANDMARK.eyeY - 8, LANDMARK.eyeY + 18, y)
    * (1 - smoothstep(LANDMARK.noseTipY - 38, LANDMARK.noseTipY - 8, y))
    * (1 - smoothstep(unit * 0.02, unit * 0.065, Math.abs(dx)));
  const tip = ellipseOutline(
    dx,
    y - LANDMARK.noseTipY,
    unit * 0.07,
    unit * 0.04,
    0.08,
    0.3
  );
  const mouth = ellipseOutline(
    dx,
    y - LANDMARK.mouthY,
    unit * 0.13,
    unit * 0.036,
    0.08,
    0.32
  );

  return clamp(Math.max(eyes * 0.72, bridge * 0.62, tip * 0.52, mouth * 0.68), 0, 1);
}

/**
 * Nina ja suu lähtepildis on tugeva helenduse sees mitu peaaegu kõrvuti
 * lokaalset maksimumi. Kõigi nende eraldi täpiks muutmine teeb näo pudruseks.
 * Valime heledamad maksimumid enne ja jätame neile kindla minimaalse vahe;
 * silmad, põsed, kõrvad ning ülejäänud torso seda hõrendust ei kasuta.
 */
function buildFacialFeaturePeakMask(lum, w, h) {
  const candidates = [];
  const minX = Math.max(1, LANDMARK.centerX - FACIAL_DETAIL.halfWidth);
  const maxX = Math.min(w - 2, LANDMARK.centerX + FACIAL_DETAIL.halfWidth);
  const minY = Math.max(1, FACIAL_DETAIL.topY);
  const maxY = Math.min(h - 2, FACIAL_DETAIL.bottomY);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const i = y * w + x;
      const value = lum[i];
      if (value < PEAK_THRESHOLD) continue;
      let isPeak = true;
      for (let dy = -1; dy <= 1 && isPeak; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const neighbour = lum[i + dy * w + dx];
          if (neighbour > value || (neighbour === value && (dy < 0 || (dy === 0 && dx < 0)))) {
            isPeak = false;
            break;
          }
        }
      }
      if (isPeak) candidates.push(i);
    }
  }

  candidates.sort((a, b) => lum[b] - lum[a] || a - b);
  const accepted = new Uint8Array(w * h);
  let acceptedCount = 0;
  for (const i of candidates) {
    const x = i % w;
    const y = (i / w) | 0;
    const inNose = y >= LANDMARK.noseTopY - 6
      && y <= LANDMARK.noseTipY + 34
      && Math.abs(x - LANDMARK.centerX) <= LANDMARK.eyeOffsetX;
    const radius = inNose ? FACIAL_DETAIL.noseSpacing : FACIAL_DETAIL.minSpacing;
    let blocked = false;
    for (let dy = -radius; dy <= radius && !blocked; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy > radius * radius) continue;
        if (accepted[i + dy * w + dx]) {
          blocked = true;
          break;
        }
      }
    }
    if (!blocked) {
      accepted[i] = 1;
      acceptedCount += 1;
    }
  }

  return { accepted, acceptedCount, candidates: candidates.length };
}

function readRightProfile(data, info) {
  const { width, height, channels } = info;
  const edge = new Float32Array(height);
  edge.fill(Number.NaN);
  const threshold = Math.round(PROFILE.alphaThreshold * 255);

  for (let y = 0; y < height; y += 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      if (data[(y * width + x) * channels + 3] < threshold) continue;
      edge[y] = x;
      break;
    }
  }

  // Üksik läbipaistev rida ei tohi teha sügavusse astet: täida vahed
  // lähimate mõõdetud servade lineaarse interpolatsiooniga.
  let previous = -1;
  for (let y = 0; y < height; y += 1) {
    if (!Number.isFinite(edge[y])) continue;
    if (previous >= 0 && y - previous > 1) {
      const from = edge[previous];
      const to = edge[y];
      for (let q = previous + 1; q < y; q += 1) {
        edge[q] = from + (to - from) * ((q - previous) / (y - previous));
      }
    }
    previous = y;
  }
  return edge;
}

function smoothProfile(values, radius) {
  const result = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    let sum = 0;
    let weightSum = 0;
    for (let d = -radius; d <= radius; d += 1) {
      const q = clamp(i + d, 0, values.length - 1);
      const value = values[q];
      if (!Number.isFinite(value)) continue;
      const weight = radius + 1 - Math.abs(d);
      sum += value * weight;
      weightSum += weight;
    }
    result[i] = weightSum ? sum / weightSum : 0;
  }
  return result;
}

function buildFaceProfile(edge, unit, height) {
  const raw = new Float32Array(height);
  const profileUnit = PROFILE.chinY - PROFILE.crownY;
  const scale = unit / profileUnit;

  for (let y = 0; y < height; y += 1) {
    const headT = clamp((y - LANDMARK.crownY) / unit, 0, 1);
    const profileY = Math.round(PROFILE.crownY + headT * profileUnit);
    const frontX = edge[clamp(profileY, PROFILE.crownY, PROFILE.chinY)];
    raw[y] = clamp((frontX - PROFILE.centerX) * scale, unit * 0.02, unit * 0.56);
  }

  return { raw, smooth: smoothProfile(raw, PROFILE.smoothRadius) };
}

/**
 * Pea järgib kursorit, õlad mitte. Kaal langeb lõuast õlgadeni nullini —
 * järsk piir lõikaks kaela pöördel katki.
 */
function rigWeight(y) {
  if (y <= LANDMARK.chinY) return 1;
  if (y <= LANDMARK.neckY) {
    const t = (y - LANDMARK.chinY) / (LANDMARK.neckY - LANDMARK.chinY);
    // Pea pöördub täies ulatuses, kaela ülaserv jõuab sujuvalt 45% peale.
    return 1 - 0.55 * smoothstep(0, 1, t);
  }
  if (y >= LANDMARK.shoulderY) return 0;
  const t = (y - LANDMARK.neckY) / (LANDMARK.shoulderY - LANDMARK.neckY);
  return 0.45 * (1 - smoothstep(0, 1, t));
}

export async function buildAvatarCloud({
  source = SOURCE,
  profileSource = PROFILE_SOURCE,
  target = TARGET,
  quiet = false
} = {}) {
  const log = (...args) => { if (!quiet) console.log(...args); };

  const [frontImage, profileImage] = await Promise.all([
    sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(profileSource).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ]);
  const { data, info } = frontImage;
  const { width: w, height: h, channels: ch } = info;
  const unit = LANDMARK.chinY - LANDMARK.crownY;
  if (w <= LANDMARK.centerX || h <= LANDMARK.bottomY) {
    throw new Error(`eestvaate mõõt ${w}x${h} ei kata mõõdetud orientiire`);
  }

  const profileEdge = readRightProfile(profileImage.data, profileImage.info);
  const faceProfile = buildFaceProfile(profileEdge, unit, h);

  const lum = new Float32Array(w * h);
  const dotMask = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < w * h; i += 1, p += ch) {
    const a = data[p + 3] / 255;
    lum[i] = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255 * a;
    dotMask[i] = a > 0.42 ? 1 : 0;
  }

  const body = closeSilhouette(dotMask, w, h, 9);
  const dist = distanceTransform(body, w, h);
  const facialFeaturePeaks = buildFacialFeaturePeakMask(lum, w, h);

  // Rea poollaius ja keskjoon.
  const rowHalf = new Float32Array(h);
  const rowCenter = new Float32Array(h);
  for (let y = 0; y < h; y += 1) {
    let min = -1;
    let max = -1;
    for (let x = 0; x < w; x += 1) {
      if (!body[y * w + x]) continue;
      if (min < 0) min = x;
      max = x;
    }
    rowHalf[y] = min < 0 ? 0 : (max - min) / 2;
    rowCenter[y] = min < 0 ? LANDMARK.centerX : (min + max) / 2;
  }

  // Kolju poollaius: kõrvamügar interpoleeritakse välja, muidu arvab mudel,
  // et pea on kõrvade kohal 20 px laiem ja annab kõrvale koljusügavuse.
  const skullHalf = Float32Array.from(rowHalf);
  const above = rowHalf[LANDMARK.earTopY - 2];
  const below = rowHalf[LANDMARK.earBottomY + 2];
  for (let y = LANDMARK.earTopY; y <= LANDMARK.earBottomY; y += 1) {
    const t = (y - LANDMARK.earTopY) / (LANDMARK.earBottomY - LANDMARK.earTopY);
    skullHalf[y] = above + (below - above) * t;
  }

  const earMaskAt = (x, y) => {
    if (y < LANDMARK.earTopY - 8 || y > LANDMARK.earBottomY + 8) return 0;
    const band = smoothstep(LANDMARK.earTopY - 8, LANDMARK.earTopY + 6, y)
      * (1 - smoothstep(LANDMARK.earBottomY - 6, LANDMARK.earBottomY + 8, y));
    // Üleminek on LAI (70 px). Kitsas lukustus jättis sügavusvälja järsu
    // serva ja normaalid pöördusid seal külili — kuumkoht ei kadunud, vaid
    // nihkus koos maski servaga (mõõdetud: kõrval 47,8% -> 0%, aga kolju
    // küljel 4,7% -> 21,4%). Sile üleminek ei tekita seda kuskil.
    return band * smoothstep(LANDMARK.earInnerX - 56, LANDMARK.earInnerX + 14, Math.abs(x - LANDMARK.centerX));
  };

  // Sügavusväli kogu keha kohta. Normaalid tulevad tema gradiendist, seega
  // peab ta olema olemas ka täppide vahel.
  const depthField = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const reference = Math.max(1, y <= LANDMARK.earBottomY ? skullHalf[y] : rowHalf[y]);
    // Pea- ja kehamudel SEGATAKSE lõuavöötmes, mitte ei vahetu järsult.
    // Järsk vahetus andis lõuajoonele 13,5 px sügavusastme ühe rea peal;
    // kuna normaal tuleb sügavusvälja gradiendist, pöördus normaal seal
    // peaaegu külili ja lõua alla tekkis hele kaar (omanik 22.08).
    /* Lõuajoon on näo eesmine serv, mitte kaela esimene rida. Vana segu
       algas 50 px enne lõuga ja tõmbas lõua 38% ulatuses kaela sügavusse.
       Nüüd püsib lõug külgvaatest saadud sügavusel ning kael taandub tema
       all pika, normaale mitte murdva üleminekuga. */
    const toBody = smoothstep(LANDMARK.chinY + 2, LANDMARK.neckY + 50, y);
    const headT = clamp((y - LANDMARK.crownY) / unit, 0, 1);
    const headHalf = unit * curve(HEAD_DEPTH, headT);
    const bodyHalf = reference * curve(BODY_DEPTH, Math.max(y, LANDMARK.chinY));
    const halfDepth = headHalf + (bodyHalf - headHalf) * toBody;
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (!body[i]) continue;
      const n = Math.min(1, dist[i] / reference);
      let depth = halfDepth * Math.sqrt(Math.max(0, 1 - (1 - n) * (1 - n)));
      if (toBody < 1) {
        /* Profiili peen kuju (nina, huuled, lõug) peab jääma keskjoonele,
           mitte paisutama sama y-rea põski. Laius muutub näo kõrgusega:
           nina on kõige kitsam, lõug ja laup laiemad. */
        const featureWidth = unit * curve([
          [0, 0.31],
          [0.48, 0.3],
          [0.62, 0.24],
          [0.72, 0.105],
          [0.84, 0.18],
          [1, 0.17]
        ], headT);
        const centerWeight = Math.exp(-Math.pow(Math.abs(x - LANDMARK.centerX) / Math.max(1, featureWidth), 4));
        /* Sile külgprofiil kujundab ainult näo keskosa. Keskjoonel jõuab
           sügavus täpselt renderduse profiilini; põskede ja oimu poole
           hajub ta kolju põhisügavusse. Nii ulatub nina eraldi ette. */
        const profileShape = clamp(faceProfile.smooth[y] - headHalf, -unit * 0.05, unit * 0.18);
        const profileDetail = clamp(faceProfile.raw[y] - faceProfile.smooth[y], -unit * 0.05, unit * 0.12);
        depth += profileShape * centerWeight * n * (1 - toBody);
        depth += profileDetail * centerWeight * n * (1 - toBody);
        depth += faceSculpt(x, y, unit) * n * (1 - toBody);
      }
      const ear = earMaskAt(x, y);
      if (ear > 0) {
        // Kõrv on lest, mitte koljulõik.
        depth = depth + (Math.min(depth, unit * 0.05) - depth) * ear;
      }
      depthField[i] = Math.max(0, depth);
    }
  }

  // Kerge silumine: normaal tuleb gradiendist, seega üksik ebaühtlane rida
  // paistaks heleda joonena. Kolm käiku 3x3 keskmistamist keha sees.
  for (let pass = 0; pass < 6; pass += 1) {
    const copy = Float32Array.from(depthField);
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = y * w + x;
        if (!body[i]) continue;
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const j = i + dy * w + dx;
            if (!body[j]) continue;
            sum += copy[j];
            n += 1;
          }
        }
        if (n) depthField[i] = sum / n;
      }
    }
  }

  const sampleDepth = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return depthField[y * w + x];
  };

  const positions = [];
  const normals = [];
  const colors = [];
  const rigs = [];
  const sizes = [];
  let warmCount = 0;
  let facialWarmCount = 0;
  let bodyDropped = 0;

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const v = lum[i];
      if (v < PEAK_THRESHOLD) continue;
      if (!body[i]) continue;

      let isPeak = true;
      for (let dy = -1; dy <= 1 && isPeak; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const n = lum[i + dy * w + dx];
          if (n > v || (n === v && (dy < 0 || (dy === 0 && dx < 0)))) { isPeak = false; break; }
        }
      }
      if (!isPeak) continue;

      const inFacialDetail = y >= FACIAL_DETAIL.topY
        && y <= FACIAL_DETAIL.bottomY
        && Math.abs(x - LANDMARK.centerX) <= FACIAL_DETAIL.halfWidth;
      if (inFacialDetail && !facialFeaturePeaks.accepted[i]) continue;

      if (y > LANDMARK.cropY) continue;

      const rig = rigWeight(y);
      if (rig <= 0.001 && v < BODY_LINE_LUM && hash01(x, y) > BODY_FILL_KEEP) {
        bodyDropped += 1;
        continue;
      }

      // Värv EI tule tipp-pikslist: täpi kese on peaaegu valge ja iseloomulik
      // sinine elab tema ümber hõõguses (mõõdetud sinisus B-R 5 vs 37).
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sw = 0;
      for (let ny = -2; ny <= 2; ny += 1) {
        for (let nx2 = -2; nx2 <= 2; nx2 += 1) {
          const j = i + ny * w + nx2;
          if (j < 0 || j >= w * h) continue;
          const q = j * ch;
          const weight = data[q + 3] / 255;
          if (weight <= 0) continue;
          sr += data[q] * weight;
          sg += data[q + 1] * weight;
          sb += data[q + 2] * weight;
          sw += weight;
        }
      }
      const denom = sw || 1;
      let cr = Math.round(sr / denom);
      let cg = Math.round(sg / denom);
      let cb = Math.round(sb / denom);

      const accent = facialAccentWeight(x, y, unit) * smoothstep(0.12, 0.38, v);
      if (accent > 0.04) {
        const blend = accent * 0.72;
        cr = Math.round(cr + (242 - cr) * blend);
        cg = Math.round(cg + (170 - cg) * blend);
        cb = Math.round(cb + (86 - cb) * blend);
        facialWarmCount += 1;
      }

      // Lõua all olid vaid mõned soojad külgmised punktid, kuid nad lugesid
      // koos laia kuldse lõuajoonena. Hoia soojus kaelas, mitte lõua servas.
      const jawWarmBand = smoothstep(LANDMARK.chinY - 55, LANDMARK.chinY - 32, y)
        * (1 - smoothstep(LANDMARK.chinY + 5, LANDMARK.chinY + 22, y));
      const jawLateral = smoothstep(unit * 0.08, unit * 0.14, Math.abs(x - LANDMARK.centerX));
      const jawWarmGuard = jawWarmBand * jawLateral;
      if (jawWarmGuard > 0 && cr > cb + 12) {
        const coolBlend = jawWarmGuard * 0.78;
        cr = Math.round(cr + (72 - cr) * coolBlend);
        cg = Math.round(cg + (154 - cg) * coolBlend);
        cb = Math.round(cb + (244 - cb) * coolBlend);
      }

      const depth = depthField[i];
      let size = Math.min(1, v * 1.8);
      const adx = Math.abs(x - LANDMARK.centerX);

      // Nina ja suu valitud detailtäpid jäävad eraldi loetavateks, mitte
      // suurteks kattuvateks helenduslaikudeks.
      if (inFacialDetail) size *= 0.9;

      // Nina juure olemasolevad tuhmimad täpid jäävad nähtavaks; ninaotsa
      // eriti heledad punktid on veidi väiksemad ja loevad õrnema tipuna.
      const bridgeBand = smoothstep(LANDMARK.browY + 4, LANDMARK.eyeY + 14, y)
        * (1 - smoothstep(LANDMARK.noseTopY + 30, LANDMARK.noseTipY - 18, y))
        * (1 - smoothstep(unit * 0.025, unit * 0.085, adx));
      size = Math.min(1, size * (1 + 0.48 * bridgeBand));
      const noseTipBand = smoothstep(LANDMARK.noseTipY - 42, LANDMARK.noseTipY - 8, y)
        * (1 - smoothstep(LANDMARK.noseTipY + 8, LANDMARK.noseTipY + 36, y))
        * (1 - smoothstep(unit * 0.06, unit * 0.15, adx));
      size *= 1 - 0.16 * noseTipBand;
      const sharpTipBand = smoothstep(LANDMARK.noseTipY - 18, LANDMARK.noseTipY - 4, y)
        * (1 - smoothstep(LANDMARK.noseTipY + 8, LANDMARK.noseTipY + 22, y))
        * (1 - smoothstep(unit * 0.015, unit * 0.045, adx));
      size = Math.min(1, size * (1 + 0.55 * sharpTipBand));

      // Lähtepildi väga hele koljukontuur luges suure täpisuurusega kiivri
      // servana. Kontuur jääb alles, kuid on läbi oimukoha selgelt peenem.
      if (y < LANDMARK.noseTopY) {
        const reference = Math.max(1, y <= LANDMARK.earBottomY ? skullHalf[y] : rowHalf[y]);
        const inset = Math.min(1, dist[i] / reference);
        const scalpRim = 1 - smoothstep(0.015, 0.075, inset);
        const scalpBand = 1 - smoothstep(LANDMARK.browY - 8, LANDMARK.noseTopY, y);
        const helmetRim = scalpRim * scalpBand;
        // Servatäpid jäävad kõik alles; tumedam toon vähendab kiivrihelki
        // ilma kõrva või pealae kontuuri „hammustatud“ aukudeta.
        cr = Math.round(cr * (1 - 0.34 * helmetRim));
        cg = Math.round(cg * (1 - 0.34 * helmetRim));
        cb = Math.round(cb * (1 - 0.28 * helmetRim));
        size *= 1 - 0.76 * helmetRim;
      }

      // Esikoor on kõrgusväli z = D(x, y), seega normaal = (-dD/dx, -dD/dy, 1).
      // Nii kannab ta ka silmakoopa ja ninaselja vormi, mitte ainult ristlõiget.
      const gx = (sampleDepth(x + 2, y) - sampleDepth(x - 2, y)) / 4;
      const gy = (sampleDepth(x, y + 2) - sampleDepth(x, y - 2)) / 4;
      const nLen = Math.hypot(-gx, gy, 1) || 1;

      positions.push(x - LANDMARK.centerX, y, depth);
      normals.push(-gx / nLen, gy / nLen, 1 / nLen);
      colors.push(cr, cg, cb);
      rigs.push(rig);
      sizes.push(size);
      if (cr > cb + 12) warmCount += 1;

      /* TAGAKOORT EI OLE — ja see on mõõdetud otsus, mitte tegemata töö.
         Ta lisati selleks, et pööratud pea ei paistaks õõnsana. Aga kuna
         sügavustesti ei ole, jäi tagakoore SILUETT nähtavaks: pöördel läks
         ta esikoore siluetist lahku ja pea kõrvale tekkis teine paralleelne
         hele kontuur (omanik 22.08 kolm korda järjest: „tagumine kõrv",
         „topelt kõrvad, kael ja pea", „mina näen topelt").
         A/B-renderdus sama pilve peal: tagakoorega kaks kontuuri, ilma
         temata üks — ja pea EI lähe lamedaks, sest vormi kannavad
         täppide tihenemine serva poole ja sügavusväljast tulevad normaalid.
         13760 -> 9269 täppi, 188 -> 126 KB. */
    }
  }

  /* SILMI EGA TEISI NÄOJOONI EI JOONISTATA KOODIGA. Uue eestvaate silmad,
     nina ja suu tulevad tema enda täppidest; külgvaade annab neile ainult
     ruumilise sügavuse. Nii ei kleebita näole võõrast protseduurset maski. */

  const count = positions.length / 3;
  if (!count) throw new Error("punktipilv jäi tühjaks — kontrolli läve ja lähtefaili");

  const midY = LANDMARK.crownY + unit * LANDMARK.centerYInHeadUnits;
  const cropWorldY = (midY - LANDMARK.cropY) / unit;
  let extent = 0;
  const world = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const wx = positions[i * 3] / unit;
    // Pildi y kasvab alla, maailma y üles.
    const wy = (midY - positions[i * 3 + 1]) / unit;
    const wz = positions[i * 3 + 2] / unit;
    world[i * 3] = wx;
    world[i * 3 + 1] = wy;
    world[i * 3 + 2] = wz;
    extent = Math.max(extent, Math.abs(wx), Math.abs(wy), Math.abs(wz));
  }

  const mouthIndex = LANDMARK.mouthY * w + LANDMARK.centerX;
  const mouthDepth = depthField[mouthIndex];

  const scale = Math.max(extent, LANDMARK.frameExtent);
  const header = Buffer.alloc(32);
  header.write("SAV3", 0, "ascii");
  header.writeUInt32LE(count, 4);
  header.writeFloatLE(scale, 8);
  header.writeFloatLE(0, 12);
  header.writeFloatLE((midY - LANDMARK.mouthY) / unit, 16);
  header.writeFloatLE(mouthDepth / unit, 20);
  header.writeFloatLE((midY - LANDMARK.pivotY) / unit, 24);
  header.writeFloatLE(LANDMARK.pivotZ, 28);

  const pos = new Int16Array(count * 3);
  for (let i = 0; i < count * 3; i += 1) pos[i] = Math.round(world[i] / scale * 32767);
  const nrm = new Int8Array(count * 3);
  for (let i = 0; i < count * 3; i += 1) {
    nrm[i] = Math.max(-127, Math.min(127, Math.round(normals[i] * 127)));
  }
  const col = Uint8Array.from(colors);
  const rig = Uint8Array.from(rigs.map(value => Math.round(value * 255)));
  const size = Uint8Array.from(sizes.map(value => Math.round(value * 255)));

  const blob = Buffer.concat([
    header,
    Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength),
    Buffer.from(nrm.buffer, nrm.byteOffset, nrm.byteLength),
    Buffer.from(col.buffer, col.byteOffset, col.byteLength),
    Buffer.from(rig.buffer, rig.byteOffset, rig.byteLength),
    Buffer.from(size.buffer, size.byteOffset, size.byteLength)
  ]);
  writeFileSync(target, blob);

  log(`täppe: ${count} (üks koor, soojad ${warmCount})`);
  log(`näosügavus: ${profileSource}`);
  log(`keha hõrendus: ${bodyDropped} tuhmi täidetäppi välja, jooned puutumata`);
  log(`näodetail: ${facialFeaturePeaks.candidates} lähest maksimumist jäi ${facialFeaturePeaks.acceptedCount}`);
  log(`näoaktsent: ${facialWarmCount} olemasolevat täppi soojas struktuuris`);
  log("pealae kontuur: kõik servatäpid alles, kiivrihelk tumedam");
  log(`suu: y ${((midY - LANDMARK.mouthY) / unit).toFixed(3)}, z ${(mouthDepth / unit).toFixed(3)}`
    + ` | pöördetelg y ${((midY - LANDMARK.pivotY) / unit).toFixed(3)}`);
  log(`lõige: maailma-y ${cropWorldY.toFixed(3)} (pildirida ${LANDMARK.cropY})`);
  log(`ulatus: ${scale.toFixed(3)} pea-kõrgust | fail: ${(blob.length / 1024).toFixed(0)} KB`);
  log(`kirjutatud: ${target}`);
  return { count, scale, bytes: blob.length };
}

/* Windowsil on `import.meta.url` ja argv[1] eri kujul — võrdlus tuleb teha
   pathToFileURL kaudu, muidu ei käivitu skript kunagi (vt mälu). */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildAvatarCloud();
}
