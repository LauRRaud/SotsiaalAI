// TartuNLP tagastab 32-bitise float WAV-i (formaadikood 3). See on kaks
// korda suurem kui vaja ja formaadikood 3 ei ole kõigis brauserites sama
// kindel kui kood 1 (PCM). Teisendus lahendab mõlemad korraga ega vaja ühtki
// sõltuvust.
//
// Teisendus on FAIL-SAFE: iga ootamatuse korral tagastatakse algne puhver
// muutmata. Katkine heli on halvem kui suur heli.

function readChunks(buf) {
  if (buf.length < 12) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buf.toString("ascii", 8, 12) !== "WAVE") return null;
  const chunks = {};
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (!chunks[id]) {
      chunks[id] = { start, end: Math.min(start + size, buf.length) };
    }
    // Tükid on paarisarvulise joondusega.
    offset = start + size + (size % 2);
  }
  return chunks;
}

/**
 * 32-bitine float WAV → 16-bitine PCM WAV. Pool mahtu, universaalselt
 * mängitav formaadikood. Kõik muu (juba PCM, tundmatu kuju, katkine päis)
 * tuleb tagasi muutmata.
 */
export function convertFloat32WavToPcm16(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input || []);
  let chunks = null;
  try {
    chunks = readChunks(buf);
  } catch {
    return buf;
  }
  const fmt = chunks?.["fmt "];
  const data = chunks?.data;
  if (!fmt || !data) return buf;
  if (fmt.end - fmt.start < 16) return buf;

  const audioFormat = buf.readUInt16LE(fmt.start);
  const channels = buf.readUInt16LE(fmt.start + 2);
  const sampleRate = buf.readUInt32LE(fmt.start + 4);
  const bitsPerSample = buf.readUInt16LE(fmt.start + 14);
  // Ainult float32 vajab teisendust.
  if (audioFormat !== 3 || bitsPerSample !== 32) return buf;
  if (!channels || !sampleRate) return buf;

  const sampleCount = Math.floor((data.end - data.start) / 4);
  if (sampleCount <= 0) return buf;

  const payloadBytes = sampleCount * 2;
  const out = Buffer.alloc(44 + payloadBytes);
  out.write("RIFF", 0, "ascii");
  out.writeUInt32LE(36 + payloadBytes, 4);
  out.write("WAVE", 8, "ascii");
  out.write("fmt ", 12, "ascii");
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(channels, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * channels * 2, 28);
  out.writeUInt16LE(channels * 2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36, "ascii");
  out.writeUInt32LE(payloadBytes, 40);

  for (let i = 0; i < sampleCount; i += 1) {
    const raw = buf.readFloatLE(data.start + i * 4);
    // NaN-il ei ole amplituudi → vaikus. Lõpmatus on täisamplituud, mitte
    // vaikus: `Number.isFinite` mõlema peale annaks valjust kohta tühja koha.
    const sample = Number.isNaN(raw) ? 0 : raw;
    const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
    out.writeInt16LE(Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff), 44 + i * 2);
  }
  return out;
}
