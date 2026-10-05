// A meeting in person (office, case work meeting) is recorded in the browser and kept as ordinary audio documents.
// Until 05.10.2026 the platform made an audio file itself only in a room call and on the field visit screen; any other
// session with a client had to be recorded outside the platform and uploaded, with no consent on record.
//
// PARTS. The transcription model takes at most 25 minutes of audio in one request, so a long meeting is recorded as
// parts of 10 minutes (the field visit's limit); each part is a whole audio file of its own and is saved when it
// closes, so a closed browser loses at most the open part.
//
// CONSENT. Same rule as on the field visit: no recording without a consent on record. Here the worker attests it
// before the microphone opens; the server refuses a recording without the attestation and keeps who attested and when.

export const SESSION_RECORDING_PART_MS = 10 * 60 * 1000
export const SESSION_RECORDING_MAX_PARTS = 9
export const SESSION_RECORDING_PART_MAX_BYTES = 20 * 1024 * 1024
// Speech needs no more. Measured 05.10.2026 in Chrome: WebM (Opus) kept the asked rate (10 minutes = 2.4 MB); MP4 (AAC)
// came out at about 100 kbit/s for a two-channel stream although 64 was asked, so count 10 minutes as about 7.5 MB.
export const SESSION_RECORDING_AAC_BITS_PER_SECOND = 64000
export const SESSION_RECORDING_BITS_PER_SECOND = 32000

export const RECORDED_AUDIO_SOURCE = "DOCUMENT_AUDIO_RECORDING"
export const UPLOADED_AUDIO_SOURCE = "DOCUMENT_AUDIO_UPLOAD"
export const RECORDING_CONSENT_STATEMENT = "participants_agreed_v1"

// MP4 with AAC opens on every phone and computer and is what Safari records anyway; WebM stays for a browser that
// cannot record MP4 (owner 05.10.2026: "proovime mp4").
const RECORDING_MIME_CANDIDATES = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"]
const SESSION_ID = /^[a-z0-9][a-z0-9-]{7,63}$/i

function recordingError(message, status) {
  const error = new Error(message)
  error.status = status
  return error
}

/** The first container the browser can record; an empty string leaves the choice to the browser. */
export function pickRecordingMime(isTypeSupported) {
  if (typeof isTypeSupported !== "function") return ""
  return RECORDING_MIME_CANDIDATES.find((candidate) => {
    try {
      return Boolean(isTypeSupported(candidate))
    } catch {
      return false
    }
  }) || ""
}

/** AAC needs about twice the bits of Opus for the same speech. */
export function recordingBitsPerSecond(mime) {
  return String(mime || "").toLowerCase().includes("mp4") ? SESSION_RECORDING_AAC_BITS_PER_SECOND : SESSION_RECORDING_BITS_PER_SECOND
}

/** The name carries the container the server checks by signature; the device's own file name is never used. */
export function recordingFileName(mime, part) {
  const extension = String(mime || "").toLowerCase().includes("mp4") ? "m4a" : "webm"
  return `kohtumise-salvestis-osa-${Math.max(1, Number(part) || 1)}.${extension}`
}

export function nextRecordingChunk(totalBytes, chunkBytes, maxBytes = SESSION_RECORDING_PART_MAX_BYTES) {
  const current = Math.max(0, Number(totalBytes) || 0)
  const next = current + Math.max(0, Number(chunkBytes) || 0)
  return {
    accept: next <= maxBytes,
    totalBytes: next <= maxBytes ? next : current,
    limitReached: next > maxBytes
  }
}

export function recordingSeconds(elapsedMs) {
  const limit = Math.floor((SESSION_RECORDING_PART_MS * SESSION_RECORDING_MAX_PARTS) / 1000)
  return Math.max(0, Math.min(Math.floor((Number(elapsedMs) || 0) / 1000), limit))
}

/**
 * Reads what the upload says about itself. A plain upload says nothing and stays a plain upload. A recording made on
 * the platform must carry the consent attestation, the recording's id and its part number.
 */
export function readRecordingOrigin({ origin, consent, sessionId, part } = {}) {
  if (String(origin || "").trim() !== "recorded") return { recorded: false }
  if (String(consent || "").trim() !== "1") throw recordingError("documents.errors.recording_consent_required", 409)
  const id = String(sessionId || "").trim()
  const number = Number(part)
  if (!SESSION_ID.test(id) || !Number.isInteger(number) || number < 1 || number > SESSION_RECORDING_MAX_PARTS) {
    throw recordingError("documents.errors.recording_invalid", 400)
  }
  return { recorded: true, sessionId: id, part: number }
}

/** What the document keeps about where its audio came from. */
export function audioSourceMetadata(origin, { userId, now = new Date() } = {}) {
  if (!origin?.recorded) return { source: UPLOADED_AUDIO_SOURCE }
  return {
    source: RECORDED_AUDIO_SOURCE,
    recording: { sessionId: origin.sessionId, part: origin.part },
    consent: { statement: RECORDING_CONSENT_STATEMENT, attestedByUserId: String(userId || ""), attestedAt: now.toISOString() }
  }
}

/** The part of the metadata a list shows; a document that was not recorded here gives null. */
export function recordedAudioInfo(metadata) {
  if (!metadata || typeof metadata !== "object" || metadata.source !== RECORDED_AUDIO_SOURCE) return null
  const part = Number(metadata.recording?.part)
  return {
    sessionId: String(metadata.recording?.sessionId || ""),
    part: Number.isInteger(part) && part > 0 ? part : 1
  }
}
