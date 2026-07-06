import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAudioSignature,
  ensureAllowedAudioUpload,
  getTranscriptionConfig,
  isSupportedAudioFile,
  serializeAudioSourceDocument,
  transcriptKindForAudioSource
} from "../../lib/documents/audioWorkflow.js";

function makeFile({ name = "test.webm", type = "audio/webm", size = 1024 } = {}) {
  return { name, type, size };
}

test("audio upload accepts audio files and rejects non-audio files", () => {
  assert.equal(isSupportedAudioFile(makeFile()), true);
  assert.equal(isSupportedAudioFile(makeFile({ name: "note.txt", type: "text/plain" })), false);
  assert.equal(ensureAllowedAudioUpload(makeFile(), { TRANSCRIPTION_MAX_FILE_SIZE_MB: "1" }), "audio/webm");
  assert.throws(
    () => ensureAllowedAudioUpload(makeFile({ name: "note.txt", type: "text/plain" })),
    /documents\.errors\.audio_mime_not_allowed/
  );
});

test("audio upload enforces transcription file size limit", () => {
  assert.throws(
    () => ensureAllowedAudioUpload(makeFile({ size: 2 * 1024 * 1024 }), { TRANSCRIPTION_MAX_FILE_SIZE_MB: "1" }),
    /documents\.errors\.audio_file_too_large/
  );
});

test("audio signature validation recognizes webm and rejects text payloads", () => {
  assert.doesNotThrow(() => assertAudioSignature(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]), "audio/webm", "voice.webm"));
  assert.throws(
    () => assertAudioSignature(Buffer.from("not audio"), "audio/webm", "voice.webm"),
    /documents\.errors\.audio_signature_invalid/
  );
});

test("transcription config defaults to disabled and supports mock/openai providers", () => {
  assert.equal(getTranscriptionConfig({}).provider, "disabled");
  assert.equal(getTranscriptionConfig({ TRANSCRIPTION_ENABLED: "true", TRANSCRIPTION_PROVIDER: "mock" }).provider, "mock");
  assert.equal(getTranscriptionConfig({ TRANSCRIPTION_ENABLED: "true", TRANSCRIPTION_PROVIDER: "openai" }).model, "gpt-4o-mini-transcribe");
});

test("transcript kind follows the audio source kind", () => {
  assert.equal(transcriptKindForAudioSource("CALL_AUDIO_RECORDING"), "CALL_TRANSCRIPT");
  assert.equal(transcriptKindForAudioSource("UPLOADED_AUDIO_SOURCE"), "AUDIO_TRANSCRIPT");
});

test("audio source serialization exposes latest transcript preview without widening ownership", () => {
  const source = serializeAudioSourceDocument({
    id: "audio-1",
    title: "Call",
    originalName: "call.ogg",
    kind: "CALL_AUDIO_RECORDING",
    mime: "audio/ogg",
    size: 42,
    createdAt: new Date("2026-05-24T10:00:00Z"),
    updatedAt: new Date("2026-05-24T10:00:00Z"),
    derivedDocuments: [{
      id: "transcript-1",
      title: "Transcript",
      kind: "CALL_TRANSCRIPT",
      sourceDocumentId: "audio-1",
      content: "a".repeat(1300),
      createdAt: new Date("2026-05-24T10:01:00Z"),
      updatedAt: new Date("2026-05-24T10:01:00Z")
    }],
    callRecordingFiles: []
  });

  assert.equal(source.transcript.id, "transcript-1");
  assert.equal(source.transcript.sourceDocumentId, "audio-1");
  assert.equal(source.transcript.preview.length, 1200);
  assert.equal(source.ownerId, undefined);
});
