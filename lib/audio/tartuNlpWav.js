import { frameToneProfileFor, softenFrameTones } from "./frameTones";
import { applyVoiceEqualizer, voiceEqualizerProfileFor } from "./voiceEqualizer";
import { convertFloat32WavToPcm16, prependWavSilence } from "./wavPcm";

// Both read-aloud and voice conversations use this through /api/tts.
export async function prepareTartuNlpWav(raw, speaker) {
  const equalizer = voiceEqualizerProfileFor(speaker);
  const frameTones = equalizer ? null : frameToneProfileFor(speaker);
  const processSamples = equalizer
    ? (samples, format) => applyVoiceEqualizer(samples, format, equalizer)
    : frameTones
      ? (samples, format) => softenFrameTones(samples, format, frameTones)
      : undefined;
  // Process the float signal before rounding. Keep the existing device-start silence.
  return prependWavSilence(await convertFloat32WavToPcm16(raw, { processSamples }), 300);
}
