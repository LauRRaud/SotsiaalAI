import { parseBuffer } from "music-metadata";

function toPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function readAudioDurationSecondsFromBuffer(buffer, mimeType = null) {
  const audioBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!audioBuffer.length) return null;

  try {
    const metadata = await parseBuffer(
      audioBuffer,
      mimeType ? { mimeType: String(mimeType) } : undefined,
      { duration: true, skipCovers: true }
    );
    return toPositiveNumber(metadata?.format?.duration);
  } catch {
    return null;
  }
}

const DEFAULT_MIN_BITRATE_KBPS = 32;

/**
 * SOL-MEET-05: OHUTU ÜLEMPIIR, KUI KESTUST EI ÕNNESTUNUD LUGEDA.
 *
 * `readAudioDurationSecondsFromBuffer()` tagastab iga parse-vea korral `null`. Kutsuja, kes paneb
 * selle asemele fikseeritud arvu (nt 60), ei tee mitte konservatiivset oletust vaid annab
 * kvoodist möödapääsu: sama toetatud MIME-ga fail, mille kestust parser ei tunne, võib olla
 * tunnipikkune.
 *
 * Ainus asi, mida me sellisel juhul TEAME, on failimaht. Madalam eeldatav bitikiirus annab
 * PIKEMA kestuse, seega on ta ohutu suund — ja kuna lõplik arveldus toimub mõõdetud tegeliku
 * mahuga, maksab kasutaja ikkagi ainult tõe eest; suur on ainult ajutine reservatsioon.
 */
export function estimateMaxAudioSecondsFromBytes(byteLength, { minBitrateKbps } = {}) {
  const bytes = Number(byteLength);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const requested = Number(minBitrateKbps ?? process.env.AUDIO_MIN_BITRATE_KBPS ?? DEFAULT_MIN_BITRATE_KBPS);
  const kbps = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_MIN_BITRATE_KBPS;
  return Math.ceil((bytes * 8) / (kbps * 1000));
}

export async function readAudioDurationSecondsFromFile(file) {
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") return null;
  const arrayBuffer = await file.arrayBuffer();
  return readAudioDurationSecondsFromBuffer(Buffer.from(arrayBuffer), file.type || null);
}
