/**
 * Häälavatari punktipilve ehitaja.
 *
 * Sisend on omaniku renderdus (public/voice/Torso-läbipaistev.png), väljund
 * binaarne punktipilv, mida brauser joonistab. Pilti ennast avatarina EI
 * kasutata — temast võetakse ainult TÄPID: nende asukoht, värv ja heledus.
 *
 * Sügavus (z) ei ole pildis olemas, seega tuletatakse ta siluetist:
 *   1. alfamaskist kaugusteisendus (mitu pikslit servani),
 *   2. rea kohalik maksimum annab selle lõike "poollaiuse",
 *   3. z = sügavustegur * sqrt(1 - (1 - n)^2), kus n on normaliseeritud kaugus.
 * See on ellipsi profiil: servas z=0, keskel maksimum. Sügavustegur sõltub
 * kehaosast — pea on laiusest sügavam, rindkere selgelt lamedam.
 *
 * Käivitus:  node scripts/voice/build-avatar-cloud.mjs
 */

import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE = join(ROOT, "public", "voice", "Torso-läbipaistev.png");
const TARGET = join(ROOT, "public", "voice", "avatar-cloud.bin");

/* Mõõdetud lähtefaili alfakanalist (1536x1024) — vt build-logi. */
const LANDMARK = {
  crownY: 24,
  headWidestY: 274,
  chinY: 470,
  neckY: 504,
  shoulderY: 700,
  bottomY: 1023,
  centerX: 769,
  /* Suu: Loomise proportsioon lagipea-lõug vahemikus (~0.79). Nägu on tühi,
     seega valgusvõnked süttivad SIIN olevates täppides. */
  mouthY: 375,
  /* Pöördetelg: kolju alus, veidi näotasandist tagapool. */
  pivotY: 482,
  pivotZ: 0.12
};

const PEAK_THRESHOLD = 0.085;

/**
 * Siluett tuleb täppidest KINNI ehitada. Lähtepilt on hõre punktimmuster:
 * alfamask on täppide kogum, mitte täidetud keha, ja kaugusteisendus mõõdaks
 * iga üksiku täpi sisemust (mõõdetud: z jäi 0..0.135 pea-kõrgust, õige on
 * kordades rohkem). Sulgemine = paisuta R võrra, täida sisemised augud,
 * kahanda R võrra tagasi.
 */
function closeSilhouette(dots, w, h, radius) {
  const near = distanceTransform(invert(dots, w, h), w, h);
  const grown = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) grown[i] = near[i] <= radius ? 1 : 0;

  // Ujutus servadest: kõik, kuhu taust ei ulatu, on keha sisemus.
  const outside = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (outside[i] || grown[i]) continue;
    outside[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  const filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) filled[i] = outside[i] ? 0 : 1;

  // Kahandus: kaugus taustast peab olema vähemalt sama, mis paisutus.
  const back = distanceTransform(filled, w, h);
  const result = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) result[i] = back[i] >= radius ? 1 : 0;
  return result;
}

function invert(mask, w, h) {
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = mask[i] ? 0 : 1;
  return out;
}

/** Kahekäiguline chamfer-kaugusteisendus: kui kaugel on piksel maski servast. */
function distanceTransform(mask, w, h) {
  const INF = 1e9;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = mask[i] ? INF : 0;
  const D1 = 1, D2 = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
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
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
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

/** Kehaosa sügavus laiuse suhtes: pea sügav, kael ümar, rindkere lame. */
function depthFactor(y) {
  // z mõõdetakse siluetitasandist, seega tegur on POOLsügavus laiuse suhtes.
  // 1.25 andis peale 0,55 pea-kõrgust paksu koonu; inimese pea poolsügavus
  // on ligikaudu laiusega võrdne, seega ~0.9.
  const stops = [
    [LANDMARK.crownY, 0.85],
    [LANDMARK.headWidestY, 0.95],
    [LANDMARK.chinY, 0.85],
    [LANDMARK.neckY, 0.8],
    [LANDMARK.shoulderY, 0.5],
    [1024, 0.34]
  ];
  if (y <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (y <= stops[i][0]) {
      const [y0, v0] = stops[i - 1];
      const [y1, v1] = stops[i];
      const t = (y - y0) / (y1 - y0);
      return v0 + (v1 - v0) * t;
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * Pea järgib kursorit, õlad mitte. Kaal langeb lõuast õlgadeni nullini —
 * järsk piir lõikaks kaela pöördel katki.
 */
function rigWeight(y) {
  if (y <= LANDMARK.chinY) return 1;
  if (y >= LANDMARK.shoulderY) return 0;
  const t = (y - LANDMARK.chinY) / (LANDMARK.shoulderY - LANDMARK.chinY);
  return Math.max(0, 1 - t * t * (3 - 2 * t));
}

export async function buildAvatarCloud({ source = SOURCE, target = TARGET, quiet = false } = {}) {
  const log = (...args) => { if (!quiet) console.log(...args); };

  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;

  const lum = new Float32Array(w * h);
  const mask = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += ch) {
    const a = data[p + 3] / 255;
    lum[i] = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255 * a;
    // Täpp = selgelt läbipaistmatu piksel. Halo on poolläbipaistev, mitte keha.
    mask[i] = a > 0.42 ? 1 : 0;
  }

  const body = closeSilhouette(mask, w, h, 9);
  let bodyPixels = 0;
  for (let i = 0; i < w * h; i++) bodyPixels += body[i];
  log(`siluett suletud: ${(bodyPixels / (w * h) * 100).toFixed(1)}% lõuendist`);
  const dist = distanceTransform(body, w, h);

  // Rea kohalik "poollaius": maksimaalne kaugus servast selles reas. Pehmendus
  // hoiab ära, et üks kitsas rida (nt kõrvade kohal) annaks järsu sügavushüppe.
  const rowMax = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let m = 0;
    for (let x = 0; x < w; x++) {
      const d = dist[y * w + x];
      if (d > m) m = d;
    }
    rowMax[y] = m;
  }
  const rowSmooth = new Float32Array(h);
  const R = 12;
  for (let y = 0; y < h; y++) {
    let sum = 0, n = 0;
    for (let k = -R; k <= R; k++) {
      const yy = y + k;
      if (yy < 0 || yy >= h) continue;
      sum += rowMax[yy];
      n++;
    }
    rowSmooth[y] = sum / n;
  }

  // Rea keskjoon: normaal osutab keskteljelt väljapoole. Ilma normaalideta
  // ei saa eristada esi- ja tagakülge ning pöörav pea loeb lameda maskina.
  const rowCenter = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let min = -1, max = -1;
    for (let x = 0; x < w; x++) {
      if (!body[y * w + x]) continue;
      if (min < 0) min = x;
      max = x;
    }
    rowCenter[y] = min < 0 ? LANDMARK.centerX : (min + max) / 2;
  }

  const positions = [];
  const normals = [];
  const colors = [];
  const rigs = [];
  const sizes = [];
  let warmCount = 0;
  let backCount = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = lum[i];
      if (v < PEAK_THRESHOLD) continue;

      // Kohalik maksimum = ühe täpi kese. Võrdsete naabrite puhul võidab
      // ainult üks suund, muidu loeks sama täpi mitu korda.
      let isPeak = true;
      for (let dy = -1; dy <= 1 && isPeak; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const n = lum[i + dy * w + dx];
          if (n > v || (n === v && (dy < 0 || (dy === 0 && dx < 0)))) { isPeak = false; break; }
        }
      }
      if (!isPeak) continue;

      const half = Math.max(1, rowSmooth[y]);
      const normalized = Math.min(1, dist[i] / half);
      const profile = Math.sqrt(Math.max(0, 1 - (1 - normalized) * (1 - normalized)));
      const depth = half * depthFactor(y) * profile;

      // Värv EI tule tipp-pikslist: täpi kese on lähtepildis peaaegu valge ja
      // iseloomulik sinine elab tema ümber hõõguses. Tipust võetud värv andis
      // valge pilve (mõõdetud sinisus B-R 5, lähtepildil 37). Seepärast
      // heledusega kaalutud keskmine 5x5 aknast.
      let sr = 0, sg = 0, sb = 0, sw = 0;
      for (let ny = -2; ny <= 2; ny++) {
        for (let nx = -2; nx <= 2; nx++) {
          const j = i + ny * w + nx;
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
      const cr = Math.round(sr / denom);
      const cg = Math.round(sg / denom);
      const cb = Math.round(sb / denom);

      const localX = x - rowCenter[y];
      const rig = rigWeight(y);
      const size = Math.min(1, v * 1.8);
      // Ristlõige on täispuhutud ellips, seega väljapoole osutab (x, 0, z).
      const nLen = Math.hypot(localX, depth) || 1;
      const nx = localX / nLen;
      const nz = depth / nLen;

      positions.push(x - LANDMARK.centerX, y, depth);
      normals.push(nx, 0, nz);
      colors.push(cr, cg, cb);
      rigs.push(rig);
      sizes.push(size);
      if (cr > cb + 12) warmCount += 1;

      // Tagakoor AINULT pea ja kaela jaoks: seal käib pööre ja ainult seal
      // paistab õõnsus välja. Rindkere tagakülge ei näe kunagi, tema täpid
      // oleksid puhas raiskamine.
      if (rig > 0.02) {
        // Kukal on näotasandist täidlasem, seepärast 1.05.
        positions.push(x - LANDMARK.centerX, y, -depth * 1.05);
        normals.push(nx, 0, -nz);
        // Tagakülg on ühtlaselt jahe: kuldsed jooned on keha EES.
        const cool = Math.round((cr + cg + cb) / 3 * 0.62);
        colors.push(Math.round(cool * 0.82), Math.round(cool * 0.92), cool);
        rigs.push(rig);
        sizes.push(size * 0.85);
        backCount += 1;
      }
    }
  }

  const count = positions.length / 3;
  if (!count) throw new Error("punktipilv jäi tühjaks — kontrolli läve ja lähtefaili");

  // Normaliseeri: pikkusühik = pea kõrgus (lagipeast lõuani), null keskel.
  const unit = LANDMARK.chinY - LANDMARK.crownY;
  const midY = (LANDMARK.crownY + LANDMARK.bottomY) / 2;
  let extent = 0;
  const world = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const wx = positions[i * 3] / unit;
    // Pildi y kasvab alla, maailma y üles.
    const wy = (midY - positions[i * 3 + 1]) / unit;
    const wz = positions[i * 3 + 2] / unit;
    world[i * 3] = wx;
    world[i * 3 + 1] = wy;
    world[i * 3 + 2] = wz;
    extent = Math.max(extent, Math.abs(wx), Math.abs(wy), Math.abs(wz));
  }

  // Suu sügavus loetakse sama sügavusväljaga, mis täppidelgi — nii ei saa
  // võnked näost sisse ega välja jääda.
  const mouthIndex = LANDMARK.mouthY * w + LANDMARK.centerX;
  const mouthHalf = Math.max(1, rowSmooth[LANDMARK.mouthY]);
  const mouthNorm = Math.min(1, dist[mouthIndex] / mouthHalf);
  const mouthDepth = mouthHalf * depthFactor(LANDMARK.mouthY)
    * Math.sqrt(Math.max(0, 1 - (1 - mouthNorm) * (1 - mouthNorm)));

  const scale = extent;
  const header = Buffer.alloc(32);
  header.write("SAV3", 0, "ascii");
  header.writeUInt32LE(count, 4);
  header.writeFloatLE(scale, 8);
  header.writeFloatLE(0, 12);                                   // suu x (keskjoonel)
  header.writeFloatLE((midY - LANDMARK.mouthY) / unit, 16);     // suu y
  header.writeFloatLE(mouthDepth / unit, 20);                   // suu z
  header.writeFloatLE((midY - LANDMARK.pivotY) / unit, 24);     // pöördetelje y
  header.writeFloatLE(LANDMARK.pivotZ, 28);                     // pöördetelje z

  const pos = new Int16Array(count * 3);
  for (let i = 0; i < count * 3; i++) pos[i] = Math.round(world[i] / scale * 32767);
  const nrm = new Int8Array(count * 3);
  for (let i = 0; i < count * 3; i++) nrm[i] = Math.max(-127, Math.min(127, Math.round(normals[i] * 127)));
  const col = Uint8Array.from(colors);
  const rig = Uint8Array.from(rigs.map(r => Math.round(r * 255)));
  const size = Uint8Array.from(sizes.map(s => Math.round(s * 255)));

  const blob = Buffer.concat([
    header,
    Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength),
    Buffer.from(nrm.buffer, nrm.byteOffset, nrm.byteLength),
    Buffer.from(col.buffer, col.byteOffset, col.byteLength),
    Buffer.from(rig.buffer, rig.byteOffset, rig.byteLength),
    Buffer.from(size.buffer, size.byteOffset, size.byteLength)
  ]);
  writeFileSync(target, blob);

  log(`täppe: ${count} (esikoor ${count - backCount}, tagakoor ${backCount}, soojad ${warmCount})`);
  log(`suu: y ${((midY - LANDMARK.mouthY) / unit).toFixed(3)}, z ${(mouthDepth / unit).toFixed(3)}`
      + ` | pöördetelg y ${((midY - LANDMARK.pivotY) / unit).toFixed(3)}`);
  log(`ulatus: ${scale.toFixed(3)} pea-kõrgust | fail: ${(blob.length / 1024).toFixed(0)} KB`);
  log(`kirjutatud: ${target}`);
  return { count, scale, bytes: blob.length, world, colors, rigs, sizes };
}

/* Windowsil on `import.meta.url` ja argv[1] eri kujul — võrdlus tuleb teha
   pathToFileURL kaudu, muidu ei käivitu skript kunagi (vt mälu). */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildAvatarCloud();
}
