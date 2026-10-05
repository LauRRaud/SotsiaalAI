import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECORDED_AUDIO_SOURCE, RECORDING_CONSENT_STATEMENT, SESSION_RECORDING_BITS_PER_SECOND, SESSION_RECORDING_MAX_PARTS,
  SESSION_RECORDING_PART_MAX_BYTES, SESSION_RECORDING_PART_MS, UPLOADED_AUDIO_SOURCE,
  audioSourceMetadata, nextRecordingChunk, pickRecordingMime, readRecordingOrigin, recordedAudioInfo, recordingFileName, recordingSeconds,
} from '../lib/documents/sessionRecording.js';
import { assertAudioSignature, ensureAllowedAudioUpload, serializeAudioSourceDocument } from '../lib/documents/audioWorkflow.js';

// 05.10.2026: the platform made an audio file itself only in a room call and on the field visit screen; a meeting at
// the office was recorded outside the platform and uploaded, with no consent on record.

const SESSION = '0b0e6c3a-7f1d-4a55-9b1e-2f6c8d9e0a11';
const refused = (fields, message, status) => assert.throws(() => readRecordingOrigin(fields), error => error.message === message && error.status === status);

test('a recording made on the platform is not stored without the consent attestation', () => {
  refused({ origin: 'recorded', sessionId: SESSION, part: '1' }, 'documents.errors.recording_consent_required', 409);
  refused({ origin: 'recorded', consent: '0', sessionId: SESSION, part: '1' }, 'documents.errors.recording_consent_required', 409);
  refused({ origin: 'recorded', consent: 'true', sessionId: SESSION, part: '1' }, 'documents.errors.recording_consent_required', 409);
  assert.deepEqual(readRecordingOrigin({ origin: 'recorded', consent: '1', sessionId: SESSION, part: '3' }), { recorded: true, sessionId: SESSION, part: 3 });
});

test('a plain upload stays a plain upload and needs none of the recording fields', () => {
  assert.deepEqual(readRecordingOrigin({}), { recorded: false });
  assert.deepEqual(readRecordingOrigin({ origin: null, consent: null, sessionId: null, part: null }), { recorded: false });
  // The consent of a recording is not carried by an upload that only says so.
  assert.deepEqual(readRecordingOrigin({ origin: 'upload', consent: '1', sessionId: SESSION, part: '1' }), { recorded: false });
  assert.deepEqual(audioSourceMetadata({ recorded: false }, { userId: 'user_1' }), { source: UPLOADED_AUDIO_SOURCE });
});

test('the recording id and the part number are checked', () => {
  for (const sessionId of ['', 'short', '../../etc/passwd', 'a'.repeat(65), `${SESSION} `.repeat(2)]) refused({ origin: 'recorded', consent: '1', sessionId, part: '1' }, 'documents.errors.recording_invalid', 400);
  for (const part of ['0', '-1', '1.5', 'abc', '', String(SESSION_RECORDING_MAX_PARTS + 1)]) refused({ origin: 'recorded', consent: '1', sessionId: SESSION, part }, 'documents.errors.recording_invalid', 400);
  assert.equal(readRecordingOrigin({ origin: 'recorded', consent: '1', sessionId: SESSION, part: String(SESSION_RECORDING_MAX_PARTS) }).part, SESSION_RECORDING_MAX_PARTS);
});

test('the document keeps who attested the consent and when, and the list tells a recording from an upload', () => {
  const now = new Date('2026-10-05T11:00:00.000Z');
  const metadata = audioSourceMetadata({ recorded: true, sessionId: SESSION, part: 2 }, { userId: 'user_1', now });
  assert.deepEqual(metadata, {
    source: RECORDED_AUDIO_SOURCE, recording: { sessionId: SESSION, part: 2 },
    consent: { statement: RECORDING_CONSENT_STATEMENT, attestedByUserId: 'user_1', attestedAt: '2026-10-05T11:00:00.000Z' },
  });
  assert.deepEqual(recordedAudioInfo(metadata), { sessionId: SESSION, part: 2 });
  for (const other of [null, undefined, 'text', { source: UPLOADED_AUDIO_SOURCE }, { source: 'FIELD_VISIT' }]) assert.equal(recordedAudioInfo(other), null);
  const row = { id: 'doc_1', title: 'Kohtumise salvestis', originalName: 'kohtumise-salvestis-osa-2.webm', kind: 'UPLOADED_AUDIO_SOURCE', mime: 'audio/webm;codecs=opus', size: 10, createdAt: now, updatedAt: now };
  assert.deepEqual(serializeAudioSourceDocument({ ...row, metadata }).recording, { sessionId: SESSION, part: 2 });
  assert.equal(serializeAudioSourceDocument({ ...row, metadata: { source: UPLOADED_AUDIO_SOURCE } }).recording, null);
  // A caller that does not select the metadata (the transcription route) gets no recording mark, not an error.
  assert.equal(serializeAudioSourceDocument(row).recording, null);
  // The consent attestation itself does not travel to the browser with the list.
  assert.equal(JSON.stringify(serializeAudioSourceDocument({ ...row, metadata })).includes('attestedByUserId'), false);
});

test('a part stays under the transcription limits: 10 minutes, far below 25 minutes and the upload size limit', () => {
  assert.equal(SESSION_RECORDING_PART_MS, 10 * 60 * 1000);
  // The transcription model takes at most 1500 seconds in one request.
  assert(SESSION_RECORDING_PART_MS / 1000 < 1500);
  const expectedBytes = SESSION_RECORDING_BITS_PER_SECOND / 8 * SESSION_RECORDING_PART_MS / 1000;
  assert(expectedBytes < SESSION_RECORDING_PART_MAX_BYTES / 4, 'a part at the chosen bit rate is far below its own size limit');
  // The server's upload limit on production is 25 MB (TRANSCRIPTION_MAX_FILE_SIZE_MB); a part may not outgrow it.
  assert(SESSION_RECORDING_PART_MAX_BYTES <= 25 * 1024 * 1024);
  assert.equal(recordingSeconds(SESSION_RECORDING_PART_MS * SESSION_RECORDING_MAX_PARTS + 60000), 90 * 60);
  assert.equal(recordingSeconds(-5), 0);
  assert.equal(recordingSeconds(61500), 61);
});

test('a part closes when its size limit is reached, without taking the chunk that would exceed it', () => {
  assert.deepEqual(nextRecordingChunk(0, 1000), { accept: true, totalBytes: 1000, limitReached: false });
  assert.deepEqual(nextRecordingChunk(SESSION_RECORDING_PART_MAX_BYTES - 10, 10), { accept: true, totalBytes: SESSION_RECORDING_PART_MAX_BYTES, limitReached: false });
  assert.deepEqual(nextRecordingChunk(SESSION_RECORDING_PART_MAX_BYTES - 10, 11), { accept: false, totalBytes: SESSION_RECORDING_PART_MAX_BYTES - 10, limitReached: true });
  assert.deepEqual(nextRecordingChunk(90, 20, 100), { accept: false, totalBytes: 90, limitReached: true });
});

test('the recorded file passes the same upload checks as an uploaded audio file', () => {
  assert.equal(pickRecordingMime(candidate => candidate === 'audio/webm'), 'audio/webm');
  assert.equal(pickRecordingMime(candidate => candidate.startsWith('audio/webm')), 'audio/webm;codecs=opus');
  assert.equal(pickRecordingMime(candidate => candidate === 'audio/mp4'), 'audio/mp4');
  assert.equal(pickRecordingMime(() => false), '');
  assert.equal(pickRecordingMime(() => { throw new Error('no'); }), '');
  assert.equal(pickRecordingMime(undefined), '');
  assert.equal(recordingFileName('audio/webm;codecs=opus', 2), 'kohtumise-salvestis-osa-2.webm');
  assert.equal(recordingFileName('audio/mp4', 1), 'kohtumise-salvestis-osa-1.m4a');
  assert.equal(recordingFileName('', 0), 'kohtumise-salvestis-osa-1.webm');
  const env = { TRANSCRIPTION_MAX_FILE_SIZE_MB: '25' };
  for (const mime of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    const file = { name: recordingFileName(mime, 1), type: mime, size: 2_400_000 };
    assert.equal(ensureAllowedAudioUpload(file, env), mime);
  }
  // The first bytes of a WebM and of an MP4 container, as a browser writes them.
  assertAudioSignature(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]), 'audio/webm;codecs=opus', recordingFileName('audio/webm', 1));
  assertAudioSignature(Buffer.from([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]), 'audio/mp4', recordingFileName('audio/mp4', 1));
});
