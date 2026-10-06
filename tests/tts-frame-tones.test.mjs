import test from 'node:test';
import assert from 'node:assert/strict';
import { frameToneProfileFor, softenFrameTones } from '../lib/audio/frameTones.js';
import { convertFloat32WavToPcm16 } from '../lib/audio/wavPcm.js';

// 06.10.2026: the owner heard a metallic echo in the `kylli` voice. The synthesis leaves a standing tone at every
// multiple of its frame rate (22 050 / 256 Hz); the filter lowers exactly those and nothing else.

const RATE = 22050;
const FRAME_HZ = RATE / 256;
const FORMAT = { sampleRate: RATE, channels: 1 };
const kylli = frameToneProfileFor('kylli');

const tone = (hz, seconds = 2, amplitude = 0.25) =>
  Float32Array.from({ length: RATE * seconds }, (_, n) => amplitude * Math.sin(2 * Math.PI * hz * n / RATE));
const level = (samples, from, to = samples.length) =>
  Math.sqrt(samples.subarray(from, to).reduce((sum, value) => sum + value * value, 0) / (to - from));
// The settled level after the filter, as a share of the level before it.
async function gainAt(hz) {
  const samples = tone(hz);
  const before = level(samples, RATE);
  assert.equal(await softenFrameTones(samples, FORMAT, kylli), true);
  return level(samples, RATE) / before;
}
const within = (value, low, high) => assert.ok(value >= low && value <= high, `${value.toFixed(3)} is outside ${low}–${high}`);

function floatWav(samples, { sampleRate = RATE, channels = 1 } = {}) {
  const wav = Buffer.alloc(44 + samples.length * 4);
  wav.write('RIFF', 0, 'ascii'); wav.writeUInt32LE(36 + samples.length * 4, 4); wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii'); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(3, 20); wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * channels * 4, 28); wav.writeUInt16LE(channels * 4, 32); wav.writeUInt16LE(32, 34);
  wav.write('data', 36, 'ascii'); wav.writeUInt32LE(samples.length * 4, 40);
  samples.forEach((value, index) => wav.writeFloatLE(value, 44 + index * 4));
  return wav;
}
const pcm = wav => Array.from({ length: (wav.length - 44) / 2 }, (_, index) => wav.readInt16LE(44 + index * 2));

test('a tone on a multiple of the synthesis frame rate is lowered, the sound between two multiples is not', async () => {
  // 1–3 kHz, where the owner's ear and the measurement both put most of the tones: about half the amplitude is left.
  within(await gainAt(24 * FRAME_HZ), 0.4, 0.56);
  within(await gainAt(24.5 * FRAME_HZ), 1, 1.3);
  // 3–5 kHz and the top band have their own fitted depth.
  within(await gainAt(50 * FRAME_HZ), 0.45, 0.65);
  within(await gainAt(110 * FRAME_HZ), 0.25, 0.4);
});

test('the range of the voice pitch is left alone, although it holds multiples of the frame rate too', async () => {
  within(await gainAt(2 * FRAME_HZ), 0.98, 1.02);
  within(await gainAt(4 * FRAME_HZ), 0.97, 1.03);
});

test('a clip longer than one work slice is filtered the same way to its end', async () => {
  const samples = tone(24 * FRAME_HZ, 8);
  const before = level(samples, RATE, 2 * RATE);
  await softenFrameTones(samples, FORMAT, kylli);
  const early = level(samples, RATE, 2 * RATE) / before;
  const late = level(samples, 7 * RATE) / before;
  within(late / early, 0.999, 1.001);
});

test('only the fitted voice at its own sample rate is processed', async () => {
  assert.equal(frameToneProfileFor('mari'), null);
  assert.equal(frameToneProfileFor(''), null);
  assert.equal(frameToneProfileFor('__proto__'), null);
  assert.equal(frameToneProfileFor('Kylli'), kylli);

  const untouched = async (format, profile, change) => {
    const samples = tone(24 * FRAME_HZ, 1);
    change?.(samples);
    const copy = Float32Array.from(samples);
    assert.equal(await softenFrameTones(samples, format, profile), false);
    assert.deepEqual(samples, copy);
  };
  await untouched(FORMAT, null);
  // Another sample rate means another frame rate: the dips would sit in the wrong places.
  await untouched({ sampleRate: 24000, channels: 1 }, kylli);
  await untouched({ sampleRate: RATE, channels: 2 }, kylli);
  // One NaN would travel through the feedback into the rest of the clip.
  await untouched(FORMAT, kylli, samples => { samples[500] = Number.NaN; });
});

test('a clip the filter would push past full scale is brought back under it', async () => {
  const samples = tone(24.5 * FRAME_HZ, 2, 0.95);
  await softenFrameTones(samples, FORMAT, kylli);
  const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  within(peak, 0.97, 0.9801);
});

test('the conversion to 16 bits rounds what the processing step left', async () => {
  const wav = floatWav([0, 0.5, -0.5, 1, -1, 2, -2, Number.NaN, Infinity, -Infinity]);
  const plain = [0, 16384, -16384, 32767, -32768, 32767, -32768, 0, 32767, -32768];
  assert.deepEqual(pcm(await convertFloat32WavToPcm16(wav)), plain);

  let seen = null;
  const processed = await convertFloat32WavToPcm16(wav, {
    processSamples: async (samples, format) => { seen = format; await null; samples[1] = 0.25; }
  });
  assert.deepEqual(seen, FORMAT);
  assert.deepEqual(pcm(processed), [0, 8192, ...plain.slice(2)]);

  // A step that fails half-way must not leave half-processed sound.
  const failed = await convertFloat32WavToPcm16(wav, { processSamples: samples => { samples.fill(0); throw new Error('boom'); } });
  assert.deepEqual(pcm(failed), plain);

  // Anything that is not a float WAV still comes back as it was.
  const other = Buffer.from('not a wav');
  assert.equal(await convertFloat32WavToPcm16(other, { processSamples: () => { throw new Error('unused'); } }), other);
});

test('the kylli profile reaches the sound through the conversion', async () => {
  const input = tone(24 * FRAME_HZ);
  const convert = processSamples => convertFloat32WavToPcm16(floatWav(input), { processSamples });
  const dry = pcm(await convert(undefined)).slice(RATE);
  const wet = pcm(await convert((samples, format) => softenFrameTones(samples, format, kylli))).slice(RATE);
  const rms = values => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
  within(rms(wet) / rms(dry), 0.4, 0.56);
});
