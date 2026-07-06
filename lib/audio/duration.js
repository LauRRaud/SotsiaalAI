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

export async function readAudioDurationSecondsFromFile(file) {
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") return null;
  const arrayBuffer = await file.arrayBuffer();
  return readAudioDurationSecondsFromBuffer(Buffer.from(arrayBuffer), file.type || null);
}
