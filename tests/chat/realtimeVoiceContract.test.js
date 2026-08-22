import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REALTIME_MODEL,
  REALTIME_VOICE,
  VOICE_IDLE_LIMIT_MS,
  VOICE_RESPONSE_MAX_OUTPUT_TOKENS,
  VOICE_SESSION_SPEECH_CHAR_LIMIT,
  VOICE_SESSION_LIMIT_MS,
  VOICE_SESSION_WARNING_MS,
  buildRealtimeSessionConfig,
  buildRealtimeSpeechResponse,
  clampVoiceSpeechChars,
  clampVoiceUsageSeconds,
  voiceReplyExcerpt
} from "../../lib/chat/realtimeVoice.js";
import {
  createVoiceSettlementToken,
  verifyVoiceSettlementToken
} from "../../lib/chat/realtimeVoiceToken.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const hook = readFileSync(join(root, "components/chat/hooks/useRealtimeVoice.js"), "utf8");
const surface = readFileSync(join(root, "components/alalehed/chat/VoiceModeSurface.jsx"), "utf8");
const composer = readFileSync(join(root, "components/alalehed/chat/ChatComposer.jsx"), "utf8");
const route = readFileSync(join(root, "app/api/realtime/session/route.js"), "utf8");
const settleRoute = readFileSync(join(root, "app/api/realtime/session/settle/route.js"), "utf8");

test("Realtime transcribes and voices the approved answer without becoming a second answer engine", () => {
  assert.equal(REALTIME_MODEL, "gpt-realtime-2.1-mini");
  assert.equal(VOICE_SESSION_LIMIT_MS, 5 * 60_000);
  assert.ok(VOICE_SESSION_WARNING_MS < VOICE_SESSION_LIMIT_MS);
  assert.ok(VOICE_SESSION_LIMIT_MS - VOICE_SESSION_WARNING_MS >= 30_000);
  assert.equal(VOICE_IDLE_LIMIT_MS, 90_000);

  const session = buildRealtimeSessionConfig({ locale: "et-EE" });
  assert.equal(session.model, REALTIME_MODEL);
  assert.equal(session.audio.input.transcription.model, "gpt-4o-mini-transcribe");
  assert.equal(session.audio.input.transcription.language, "et");
  assert.equal(session.audio.input.turn_detection.create_response, false);
  assert.equal(session.audio.input.turn_detection.interrupt_response, true);
  assert.equal(session.audio.output.voice, REALTIME_VOICE);
  assert.deepEqual(session.output_modalities, ["audio"]);
  assert.equal(session.max_output_tokens, VOICE_RESPONSE_MAX_OUTPUT_TOKENS);
  assert.match(session.instructions, /do not answer/i);
});

test("settlement can never charge above the hard session cap", () => {
  assert.equal(clampVoiceUsageSeconds(0), 1);
  assert.equal(clampVoiceUsageSeconds(12.1), 13);
  assert.equal(clampVoiceUsageSeconds(9999), 300);
  assert.equal(clampVoiceUsageSeconds(Number.NaN), 1);
  assert.equal(clampVoiceSpeechChars(-1), 0);
  assert.equal(clampVoiceSpeechChars(1200.9), 1200);
  assert.equal(clampVoiceSpeechChars(9999), VOICE_SESSION_SPEECH_CHAR_LIMIT);
});

test("spoken answer is a concise core while the full sourced answer remains in chat", () => {
  const answer = "Esimene lause. Teine lause! Kolmas lause? Neljas lause.";
  assert.equal(voiceReplyExcerpt(answer), "Esimene lause. Teine lause! Kolmas lause?");
  assert.equal(voiceReplyExcerpt("[Allikas](https://example.test) **vastus**."), "Allikas vastus.");

  const speech = buildRealtimeSpeechResponse(answer, { locale: "et-EE" });
  assert.equal(REALTIME_VOICE, "marin");
  assert.equal(VOICE_SESSION_SPEECH_CHAR_LIMIT, 3000);
  assert.equal(speech.type, "response.create");
  assert.equal(speech.response.conversation, "none");
  assert.deepEqual(speech.response.output_modalities, ["audio"]);
  assert.equal(speech.response.audio.output.voice, REALTIME_VOICE);
  assert.equal(speech.response.max_output_tokens, VOICE_RESPONSE_MAX_OUTPUT_TOKENS);
  assert.match(speech.response.instructions, /read.*verbatim/i);
  assert.match(speech.response.input[0].content[0].text, /Esimene lause/);
});

test("settlement token is user-bound, expiring and tamper evident", () => {
  const secret = "test-secret";
  const token = createVoiceSettlementToken({
    userId: "user-a",
    idempotencyKey: "realtime.voice:abc",
    ttsIdempotencyKey: "realtime.voice.tts:abc",
    startedAt: 1_000,
    expiresAt: 20_000
  }, secret);
  const claim = verifyVoiceSettlementToken(token, { userId: "user-a", secret, now: 10_000 });
  assert.equal(claim?.key, "realtime.voice:abc");
  assert.equal(claim?.ttsKey, "realtime.voice.tts:abc");
  assert.equal(verifyVoiceSettlementToken(token, { userId: "user-b", secret, now: 10_000 }), null);
  assert.equal(verifyVoiceSettlementToken(token, { userId: "user-a", secret, now: 30_000 }), null);
  assert.equal(verifyVoiceSettlementToken(`${token}x`, { userId: "user-a", secret, now: 10_000 }), null);
});

test("client closes every paid resource on limit, idle, navigation and unmount", () => {
  assert.match(hook, /VOICE_SESSION_LIMIT_MS/);
  assert.match(hook, /VOICE_IDLE_LIMIT_MS/);
  assert.match(hook, /pagehide/);
  assert.match(hook, /visibilitychange/);
  assert.match(hook, /getTracks\?\.\(\).*track\.stop/s);
  assert.match(hook, /peerConnectionRef\.current\?\.close/);
  assert.match(hook, /remoteAudioRef\.current/);
  assert.match(hook, /settleVoiceUsage/);
});

test("avatar voice uses the Realtime remote track and never the TartuNLP speech hook", () => {
  assert.match(hook, /output_audio_buffer\.started/);
  assert.match(hook, /output_audio_buffer\.stopped/);
  assert.match(hook, /output_audio_buffer\.clear/);
  assert.match(hook, /buildRealtimeSpeechResponse/);
  assert.match(hook, /peer\.addEventListener\("track"/);
  assert.doesNotMatch(hook, /speakTextRef|voiceReplyExcerpt/);
});

test("the server reserves the full capped duration before opening Realtime", () => {
  assert.match(route, /metric: "STT_SECONDS"/);
  assert.match(route, /amount: VOICE_SESSION_LIMIT_SECONDS/);
  assert.match(route, /metric: "TTS_CHARS"/);
  assert.match(route, /amount: VOICE_SESSION_SPEECH_CHAR_LIMIT/);
  assert.match(route, /usageHandle\.reused/);
  assert.match(route, /releaseUsageForRequest/);
  assert.match(route, /OpenAI-Safety-Identifier/);
  assert.match(settleRoute, /clampVoiceUsageSeconds/);
  assert.match(settleRoute, /commitUsageForRequest/);
  assert.match(settleRoute, /VOICE_SESSION_SPEECH_CHAR_LIMIT/);
});

test("voice mode is explicit, captioned and always exposes an end control", () => {
  assert.match(surface, /data-voice-mode/);
  assert.match(surface, /voice\.start/);
  assert.match(surface, /voice\.end/);
  assert.match(surface, /aria-live="polite"/);
  assert.match(surface, /VoicePointAvatar/);
});

test("an empty chat draft turns the single primary send control into voice mode", () => {
  assert.match(composer, /const canOpenVoiceMode = !isRoomMode && !hasActiveWorkflowMode && Boolean\(onOpenVoiceMode\);/);
  assert.match(composer, /hasInput \? <button type="submit"[^>]+chat\.send\.send[\s\S]+: canOpenVoiceMode \? <button type="submit"[^>]+chat\.voice\.open/);
  assert.doesNotMatch(composer, /type="button"\s+className="conv-voice-mode-trigger"/);
});
