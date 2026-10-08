// Owner's final listening choice, 08.10.2026: Meelis and these ten EQ bands.
// Same peaking filters as the listening page (W3C Audio EQ Cookbook, linear Q).
// No extra low-pass, comb filter, output gain or loudness normalization.
const MEELIS = Object.freeze({
  sampleRate: 22050,
  q: 1.2,
  bands: Object.freeze([
    [80, -5], [160, -4.5], [315, -4], [630, -4.5], [1000, -6],
    [1600, -6], [2500, -8.5], [4000, -7.5], [6300, -8], [9000, -7]
  ].map(band => Object.freeze(band)))
});
const SLICE = 1 << 15;
const designs = new WeakMap();

export function voiceEqualizerProfileFor(speaker) {
  return String(speaker || "").trim().toLowerCase() === "meelis" ? MEELIS : null;
}

function design(profile) {
  let coefficients = designs.get(profile);
  if (coefficients) return coefficients;
  coefficients = profile.bands.map(([frequency, gainDb]) => {
    const a = 10 ** (gainDb / 40);
    const w = 2 * Math.PI * frequency / profile.sampleRate;
    const alpha = Math.sin(w) / (2 * profile.q);
    const a0 = 1 + alpha / a;
    return [(1 + alpha * a) / a0, -2 * Math.cos(w) / a0, (1 - alpha * a) / a0,
      -2 * Math.cos(w) / a0, (1 - alpha / a) / a0];
  });
  designs.set(profile, coefficients);
  return coefficients;
}

/** In-place float processing; unsupported formats and invalid input stay untouched. */
export async function applyVoiceEqualizer(samples, { sampleRate, channels = 1 } = {}, profile) {
  if (!profile || !(samples instanceof Float32Array)) return false;
  if (sampleRate !== profile.sampleRate || channels !== 1) return false;
  // Validate before writing: a late NaN must not leave an already-filtered prefix.
  for (let from = 0; from < samples.length; from += SLICE) {
    if (from > 0) await new Promise(resolve => setImmediate(resolve));
    for (let n = from; n < Math.min(samples.length, from + SLICE); n += 1) {
      if (!Number.isFinite(samples[n])) return false;
    }
  }
  const coefficients = design(profile);
  // Request-local, double-precision filter state survives work slices, not requests.
  const state = new Float64Array(coefficients.length * 2);
  for (let from = 0; from < samples.length; from += SLICE) {
    if (from > 0) await new Promise(resolve => setImmediate(resolve));
    const to = Math.min(samples.length, from + SLICE);
    for (let n = from; n < to; n += 1) {
      let value = samples[n];
      for (let i = 0; i < coefficients.length; i += 1) {
        const [b0, b1, b2, a1, a2] = coefficients[i];
        const output = b0 * value + state[2 * i];
        state[2 * i] = b1 * value - a1 * output + state[2 * i + 1];
        state[2 * i + 1] = b2 * value - a2 * output;
        value = output;
      }
      samples[n] = value;
      // The WAV converter restores the original input if processing throws.
      if (!Number.isFinite(samples[n])) throw new Error("Non-finite equalizer output");
    }
  }
  return true;
}
