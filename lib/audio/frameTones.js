// TartuNLP häälemudel paneb heli kokku 256 näidise pikkustest kaadritest ja
// jätab iga kaadrisageduse kordse (22 050 / 256 = 86,13 Hz) juurde paigalseisva
// tooni. Hääle kõrgus liigub, need toonid mitte — kõrv kuuleb seda metalse
// kajana (omanik 06.10). Toonid kõiguvad koos kõnega, nii et iga toon on umbes
// 12 Hz laiune kühm, mitte joon. Kaks lihtsamat teed proovis omanik kuulates
// läbi ja kaja jäi alles: kõrgete helide kärpimine ei puuduta 1–5 kHz riba ja
// kitsas sälk võtab ainult kühmu keskkoha.
//
// Filter on summutatud pöördkamm, mille lohk järgib kühmu mõõdetud kuju:
//   y[n] = x[n] − (B ∗ x)[n − N] + (A ∗ y)[n − N]
// A ja B on sümmeetrilised FIR-id silmuses (viide kokku täpselt N), nii et lohu
// sügavus sõltub sagedusest ja lohud jäävad täpselt kordsetele. Alla ~0,8 kHz
// on mõlemad null: seal toone ei ole ja lohk istuks hääle põhitooni peal.

// Profiil on HÄÄLE oma: `a` ja `b` on sobitatud kahe kylli lause volditud
// spektriga (sobituse jääk 0,2–0,8 dB). Teise hääle toonid on teise tugevusega
// (mari 1–5 kHz ribas mitu korda nõrgemad), seega profiilita häält ei töödelda.
const PROFILES = {
  kylli: {
    sampleRate: 22050,
    period: 256,
    firHalf: 31,
    // [riba algus Hz, a, b] — b määrab lohu laiuse, a ja b vahe sügavuse.
    bands: [
      [0, 0, 0],
      [1000, 0.58, 0.71],
      [3000, 0.69, 0.77],
      [5000, 0.70, 0.75],
      [8000, 0.59, 0.77]
    ],
    // 1 tasandab kühmu ümbritseva heliga; 2 teeb lohu detsibellides kaks korda
    // sügavamaks. Omanik valis kuulamisproovis 2 („H on üsna hea").
    depth: 2
  }
};

const BAND_RAMP_HZ = 300;
const DESIGN_GRID = 1024;
const HISTORY = 512; // > period + firHalf, kahe aste
// Umbes 6 s heli ehk paarkümmend millisekundit tööd; siis saavad teised
// päringud vahele. 5 minutit heli võtab kokku üle poole sekundi.
const SLICE = 1 << 17;
// Lohkude vahel tõuseb tase 2–3 dB, nii et tipp võib kasvada (mõõdetud kuni
// +1,5 dB ja üle täisamplituudi). Sel juhul tuuakse kogu lõik veidi alla.
const PEAK_CEILING = 0.98;

const designCache = new Map();

export function frameToneProfileFor(speaker) {
  const key = String(speaker || "").trim().toLowerCase();
  return Object.hasOwn(PROFILES, key) ? PROFILES[key] : null;
}

// Astmeline tabel pehmete üleminekutega (tõstetud koosinus enne riba algust).
function bandValue(bands, hz, column) {
  let value = bands[0][column];
  for (let i = 1; i < bands.length; i += 1) {
    const t = Math.min(1, Math.max(0, (hz - (bands[i][0] - BAND_RAMP_HZ)) / BAND_RAMP_HZ));
    value += (bands[i][column] - bands[i - 1][column]) * (0.5 - 0.5 * Math.cos(Math.PI * t));
  }
  return value;
}

function loopGains(profile, hz) {
  const a = bandValue(profile.bands, hz, 1);
  const b = bandValue(profile.bands, hz, 2);
  if (profile.depth === 1 || b <= 0) return { a, b };
  return { a: 1 - (1 - b) * ((1 - a) / (1 - b)) ** profile.depth, b };
}

// Null-faasiga FIR sagedusproovidest, Hann-aknaga.
function designFir(sampleRate, half, gainAt) {
  const taps = new Float64Array(2 * half + 1);
  for (let j = -half; j <= half; j += 1) {
    let sum = 0;
    for (let k = 0; k <= DESIGN_GRID; k += 1) {
      const w = Math.PI * k / DESIGN_GRID;
      const edge = k === 0 || k === DESIGN_GRID ? 0.5 : 1;
      sum += edge * gainAt(w * sampleRate / (2 * Math.PI)) * Math.cos(w * j);
    }
    taps[j + half] = (sum / DESIGN_GRID) * (0.5 + 0.5 * Math.cos(Math.PI * j / (half + 1)));
  }
  return taps;
}

function designFor(profile) {
  let design = designCache.get(profile);
  if (!design) {
    design = {
      feedback: designFir(profile.sampleRate, profile.firHalf, hz => loopGains(profile, hz).a),
      feedforward: designFir(profile.sampleRate, profile.firHalf, hz => loopGains(profile, hz).b)
    };
    designCache.set(profile, design);
  }
  return design;
}

/**
 * Pehmendab sünteesi kaadritoone KOHAPEAL. Tagastab `true`, kui heli töödeldi.
 *
 * Iga ootamatus jätab näidised puutumata: teine diskreetimissagedus tähendab
 * teist kaadrisagedust (lohud satuksid valesse kohta), mitu kanalit põimitud
 * näidiseid, ja üks NaN läheks tagasiside kaudu kogu ülejäänud helisse.
 */
export async function softenFrameTones(samples, { sampleRate, channels = 1 } = {}, profile) {
  if (!profile || !(samples instanceof Float32Array)) return false;
  if (sampleRate !== profile.sampleRate || channels !== 1) return false;
  for (let n = 0; n < samples.length; n += 1) {
    if (!Number.isFinite(samples[n])) return false;
  }

  const { feedback, feedforward } = designFor(profile);
  const tapCount = feedback.length;
  const base = profile.period - profile.firHalf;
  const mask = HISTORY - 1;
  // Väljund kirjutatakse sisendi peale; filter vajab aga ka sisendi ajalugu.
  const dry = new Float32Array(HISTORY);

  let peak = 0;
  for (let from = 0; from < samples.length; from += SLICE) {
    if (from > 0) await new Promise(resolve => setImmediate(resolve));
    const to = Math.min(samples.length, from + SLICE);
    for (let n = from; n < to; n += 1) {
      const input = samples[n];
      let output = input;
      const start = n - base;
      if (start >= 0) {
        const last = Math.min(tapCount - 1, start);
        for (let j = 0; j <= last; j += 1) {
          output += feedback[j] * samples[start - j] - feedforward[j] * dry[(start - j) & mask];
        }
      }
      dry[n & mask] = input;
      samples[n] = output;
      const level = output < 0 ? -output : output;
      if (level > peak) peak = level;
    }
  }
  if (peak > PEAK_CEILING) {
    const gain = PEAK_CEILING / peak;
    for (let n = 0; n < samples.length; n += 1) samples[n] *= gain;
  }
  return true;
}
