import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyVoiceEqualizer, voiceEqualizerProfileFor } from '../lib/audio/voiceEqualizer.js';
import { prepareTartuNlpWav } from '../lib/audio/tartuNlpWav.js';
import { convertFloat32WavToPcm16, prependWavSilence } from '../lib/audio/wavPcm.js';
import { DEFAULT_TARTUNLP_SPEAKER, normalizeTartuNlpSpeaker, tartuNlpSupportsLocale } from '../lib/chat/voiceState.js';

const FORMAT = { sampleRate: 22050, channels: 1 };
const profile = voiceEqualizerProfileFor('meelis');
const raw = await readFile(new URL('./fixtures/audio/meelis-oues-float32.wav', import.meta.url));
// Independent SciPy rendering of the owner's accepted 08.10.2026 EQ.
const reference = await readFile(new URL('./fixtures/audio/meelis-oues-owner-eq-pcm16.wav', import.meta.url));
const pcm = wav => Array.from({ length: (wav.length - 44) / 2 }, (_, i) => wav.readInt16LE(44 + i * 2));

test('Estonian TTS defaults to Meelis; explicit speaker overrides and locale gating remain', () => {
  assert.equal(DEFAULT_TARTUNLP_SPEAKER, 'meelis');
  for (const value of [undefined, '', 'invalid voice', '/tmp/voice']) {
    assert.equal(normalizeTartuNlpSpeaker(value), 'meelis');
  }
  assert.equal(normalizeTartuNlpSpeaker(' KyLli '), 'kylli');
  assert.equal(normalizeTartuNlpSpeaker(' Mari '), 'mari');
  assert.equal(normalizeTartuNlpSpeaker(null, 'albert'), 'albert');
  assert.equal(tartuNlpSupportsLocale('et-EE'), true);
  assert.equal(tartuNlpSupportsLocale('en'), false);
  assert.equal(tartuNlpSupportsLocale('ru'), false);
});

test('production WAV matches the accepted float EQ within one PCM16 step, after the existing 300 ms silence', async () => {
  const rendered = await prepareTartuNlpWav(raw, 'meelis');
  assert.equal(rendered.readUInt16LE(20), 1);
  assert.equal(rendered.readUInt16LE(22), 1);
  assert.equal(rendered.readUInt32LE(24), FORMAT.sampleRate);
  assert.equal(rendered.readUInt16LE(34), 16);
  const actual = pcm(rendered), expected = pcm(reference);
  const padding = Math.round(FORMAT.sampleRate * .3);
  assert.equal(actual.length, expected.length + padding);
  assert(actual.slice(0, padding).every(value => value === 0));
  let maxError = 0, peak = 0;
  for (let i = 0; i < expected.length; i++) {
    maxError = Math.max(maxError, Math.abs(actual[i + padding] - expected[i]));
    peak = Math.max(peak, Math.abs(actual[i + padding]));
  }
  assert(maxError <= 1, `PCM error ${maxError}`);
  assert(peak > 1000 && peak < 32767);
});

test('EQ runs on floats before rounding and only on Meelis', async () => {
  const wet = await convertFloat32WavToPcm16(raw, {
    processSamples: (samples, format) => applyVoiceEqualizer(samples, format, profile)
  });
  assert.deepEqual(await prepareTartuNlpWav(raw, 'MEELIS'), prependWavSilence(wet, 300));
  assert.deepEqual(await prepareTartuNlpWav(raw, 'mari'), prependWavSilence(await convertFloat32WavToPcm16(raw), 300));
  assert.equal(voiceEqualizerProfileFor(' Kylli '), null);
  assert.equal(voiceEqualizerProfileFor('__proto__'), null);
  assert.equal(voiceEqualizerProfileFor(' Meelis '), profile);
});

test('unsupported formats and late invalid samples remain untouched', async () => {
  for (const kind of ['rate', 'channels', 'profile', 'nan', 'infinity']) {
    const samples = new Float32Array(100000).fill(.1);
    if (kind === 'nan') samples[99999] = NaN;
    if (kind === 'infinity') samples[99999] = Infinity;
    const copy = samples.slice();
    const format = { ...FORMAT, ...(kind === 'rate' ? { sampleRate: 24000 } : {}), ...(kind === 'channels' ? { channels: 2 } : {}) };
    assert.equal(await applyVoiceEqualizer(samples, format, kind === 'profile' ? null : profile), false);
    assert.deepEqual(samples, copy);
  }
  const malformed = Buffer.from('not audio');
  assert.equal(await prepareTartuNlpWav(malformed, 'meelis'), malformed);
});

test('long and overlapping requests yield without sharing filter state', async () => {
  const input = Float32Array.from({ length: FORMAT.sampleRate * 8 }, (_, i) => .2 * Math.sin(2 * Math.PI * 1600 * i / FORMAT.sampleRate));
  const first = input.slice(), second = input.slice(), silent = new Float32Array(input.length);
  let yielded = false;
  setImmediate(() => { yielded = true; });
  await Promise.all([applyVoiceEqualizer(first, FORMAT, profile), applyVoiceEqualizer(second, FORMAT, profile), applyVoiceEqualizer(silent, FORMAT, profile)]);
  assert.equal(yielded, true);
  assert.deepEqual(first, second);
  assert(silent.every(value => value === 0));
  const rms = (x, from, to) => Math.sqrt(x.subarray(from, to).reduce((sum, value) => sum + value*value, 0) / (to - from));
  const rate = FORMAT.sampleRate;
  const early = rms(first, rate, 2*rate), late = rms(first, 7*rate, 8*rate);
  assert(Math.abs(late / early - 1) < 1e-5);
});
