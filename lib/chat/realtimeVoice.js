// Kõnevoorud tulevad Realtime transkriptsiooni WebRTC ühenduse kaudu, kuid
// vastuse heli teeb platvormi olemasolev TTS-rada.
export const REALTIME_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

export const VOICE_SESSION_LIMIT_MS = 5 * 60_000;
export const VOICE_SESSION_WARNING_MS = 4 * 60_000 + 15_000;
export const VOICE_IDLE_LIMIT_MS = 90_000;
export const VOICE_SESSION_LIMIT_SECONDS = Math.ceil(VOICE_SESSION_LIMIT_MS / 1000);
export const VOICE_SESSION_SPEECH_CHAR_LIMIT = 3000;

const SUPPORTED_TRANSCRIPTION_LANGUAGES = new Set(["et", "en", "ru"]);

function normalizeVoiceLanguage(locale) {
  const base = String(locale || "").trim().toLowerCase().split("-")[0];
  return SUPPORTED_TRANSCRIPTION_LANGUAGES.has(base) ? base : undefined;
}

export function clampVoiceUsageSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 1;
  return Math.min(VOICE_SESSION_LIMIT_SECONDS, Math.max(1, Math.ceil(numeric)));
}

export function voiceReplyExcerpt(value, { maxSentences = 3, maxChars = 900 } = {}) {
  const text = String(value || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#>`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  const sentenceLimit = Math.max(1, Number(maxSentences) || 3);
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const excerpt = sentences.slice(0, sentenceLimit).map(sentence => sentence.trim()).join(" ").trim();
  if (excerpt.length <= maxChars) return excerpt;
  const clipped = excerpt.slice(0, Math.max(1, maxChars - 1)).trimEnd();
  return `${clipped}…`;
}

export function clampVoiceSpeechChars(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.min(VOICE_SESSION_SPEECH_CHAR_LIMIT, Math.floor(numeric));
}

/**
 * Realtime tuvastab ja transkribeerib kõnevoorud. Ta ei koosta ega renderda
 * vastust: transkript läheb olemasolevasse chat/RAG/safety torusse ning valmis
 * vastuse loeb ette platvormi TTS-rada (eesti keeles TartuNLP).
 */
export function buildRealtimeSessionConfig({
  locale,
  transcriptionModel = REALTIME_TRANSCRIPTION_MODEL
} = {}) {
  const language = normalizeVoiceLanguage(locale);
  return {
    type: "transcription",
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: {
          model: transcriptionModel,
          ...(language ? { language } : {})
        },
        // Eesti kõneleja teeb lause sees pause. 650 ms lõikas ühe küsimuse
        // mitmeks vooruks ja esimene kild läks vastuseahelasse üksinda —
        // nii sündiski ühesõnaline jaba. Madalam lävi püüab ka vaikse alguse.
        turn_detection: {
          type: "server_vad",
          threshold: 0.42,
          prefix_padding_ms: 400,
          silence_duration_ms: 900
        }
      }
    }
  };
}
