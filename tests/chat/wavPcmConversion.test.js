import test from "node:test";
import assert from "node:assert/strict";

import { convertFloat32WavToPcm16 } from "../../lib/audio/wavPcm.js";

// TartuNLP tagastab 32-bitise float WAV-i. Teisendus poolitab mahu ja annab
// formaadikoodi 1, mida iga brauser tunneb — aga ta EI TOHI kunagi heli
// katki teha: iga ootamatus tagastab algse puhvri muutmata.

function buildWav({ audioFormat, bitsPerSample, channels = 1, sampleRate = 22050, samples = [] }) {
  const bytesPerSample = bitsPerSample / 8;
  const payload = Buffer.alloc(samples.length * bytesPerSample);
  samples.forEach((value, i) => {
    if (audioFormat === 3) payload.writeFloatLE(value, i * 4);
    else payload.writeInt16LE(value, i * 2);
  });
  const head = Buffer.alloc(44);
  head.write("RIFF", 0, "ascii");
  head.writeUInt32LE(36 + payload.length, 4);
  head.write("WAVE", 8, "ascii");
  head.write("fmt ", 12, "ascii");
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(audioFormat, 20);
  head.writeUInt16LE(channels, 22);
  head.writeUInt32LE(sampleRate, 24);
  head.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  head.writeUInt16LE(channels * bytesPerSample, 32);
  head.writeUInt16LE(bitsPerSample, 34);
  head.write("data", 36, "ascii");
  head.writeUInt32LE(payload.length, 40);
  return Buffer.concat([head, payload]);
}

test("float32 WAV muutub PCM16-ks ja jääb pool väiksemaks", () => {
  const source = buildWav({ audioFormat: 3, bitsPerSample: 32, samples: [0, 0.5, -0.5, 1, -1] });
  const out = convertFloat32WavToPcm16(source);

  assert.equal(out.readUInt16LE(20), 1, "formaadikood on PCM");
  assert.equal(out.readUInt16LE(34), 16, "16 bitti sämpli kohta");
  assert.equal(out.readUInt16LE(22), 1, "kanalite arv säilib");
  assert.equal(out.readUInt32LE(24), 22050, "sämplisagedus säilib");
  assert.equal(out.readUInt32LE(28), 22050 * 2, "byteRate on uue kuju järgi");
  assert.equal(out.readUInt16LE(32), 2, "blockAlign on uue kuju järgi");

  const payloadBytes = out.readUInt32LE(40);
  assert.equal(payloadBytes, 5 * 2);
  assert.equal(out.length, 44 + payloadBytes);
  assert.ok(out.length < source.length, "tulemus on väiksem kui lähtepuhver");

  assert.equal(out.readInt16LE(44), 0);
  assert.equal(out.readInt16LE(46), Math.round(0.5 * 0x7fff));
  assert.equal(out.readInt16LE(48), Math.round(-0.5 * 0x8000));
  assert.equal(out.readInt16LE(50), 32767, "täisamplituud ei lähe üle");
  assert.equal(out.readInt16LE(52), -32768, "negatiivne täisamplituud ei lähe üle");
});

test("RIFF päis jääb terveks ja pikkusväli on kooskõlas", () => {
  const out = convertFloat32WavToPcm16(buildWav({ audioFormat: 3, bitsPerSample: 32, samples: [0.1, 0.2] }));
  assert.equal(out.toString("ascii", 0, 4), "RIFF");
  assert.equal(out.toString("ascii", 8, 12), "WAVE");
  assert.equal(out.toString("ascii", 12, 16), "fmt ");
  assert.equal(out.toString("ascii", 36, 40), "data");
  assert.equal(out.readUInt32LE(4), out.length - 8, "RIFF pikkus vastab päris pikkusele");
});

test("juba PCM16 heli ei puututa", () => {
  const source = buildWav({ audioFormat: 1, bitsPerSample: 16, samples: [100, -100] });
  const out = convertFloat32WavToPcm16(source);
  assert.ok(out.equals(source), "sama puhver tuleb muutmata tagasi");
});

test("iga ootamatus tagastab algse puhvri, mitte katkise heli", () => {
  for (const [name, input] of [
    ["tühi", Buffer.alloc(0)],
    ["liiga lühike", Buffer.from("RI")],
    ["mitte RIFF", Buffer.concat([Buffer.from("JUNKxxxxWAVE"), Buffer.alloc(40)])],
    ["ilma data-tükita", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE")])],
    ["kärbitud fmt", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(4)])]
  ]) {
    const out = convertFloat32WavToPcm16(input);
    assert.ok(Buffer.isBuffer(out), `${name}: tulemus on puhver`);
    assert.ok(out.equals(Buffer.isBuffer(input) ? input : Buffer.from(input)), `${name}: muutmata`);
  }
});

test("NaN ja lõpmatus ei lase kirjutamisel plahvatada", () => {
  const source = buildWav({ audioFormat: 3, bitsPerSample: 32, samples: [NaN, Infinity, -Infinity, 2, -2] });
  const out = convertFloat32WavToPcm16(source);
  assert.equal(out.readInt16LE(44), 0, "NaN → vaikus");
  assert.equal(out.readInt16LE(46), 32767, "lõpmatus lõigatakse");
  assert.equal(out.readInt16LE(48), -32768);
  assert.equal(out.readInt16LE(50), 32767, "üle ühe lõigatakse");
  assert.equal(out.readInt16LE(52), -32768);
});
