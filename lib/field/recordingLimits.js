export const FIELD_RECORDING_MAX_MS = 10 * 60 * 1000;
export const FIELD_RECORDING_MAX_BYTES = 25 * 1024 * 1024;

export function nextFieldRecordingChunk(totalBytes, chunkBytes) {
  const current = Math.max(0, Number(totalBytes) || 0);
  const chunk = Math.max(0, Number(chunkBytes) || 0);
  const next = current + chunk;
  return {
    accept: next <= FIELD_RECORDING_MAX_BYTES,
    totalBytes: next <= FIELD_RECORDING_MAX_BYTES ? next : current,
    limitReached: next > FIELD_RECORDING_MAX_BYTES
  };
}

export function fieldRecordingSeconds(elapsedMs) {
  return Math.max(0, Math.min(
    Math.floor((Number(elapsedMs) || 0) / 1000),
    Math.floor(FIELD_RECORDING_MAX_MS / 1000)
  ));
}
