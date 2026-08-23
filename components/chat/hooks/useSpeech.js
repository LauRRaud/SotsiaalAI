import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import {
  createLatestRequestGate,
  isAbortError,
  withRequestTimeout
} from "@/lib/client/latestRequestGate";
import {
  RECORDING_LIMIT_MS,
  RECORDING_WARNING_MS,
  VOICE_NOTICE_KEYS,
  classifyMicStartError,
  micBlockReason,
  micMessageKey,
  pickBrowserVoice,
  resolveTtsOutcome,
  usesServerTts
} from "@/lib/chat/voiceState";

// Kliendi oma ajapiirid (SOL-VOICE-02). Serveril on omad ja need on lühemad — siin on
// varu võrgu jaoks, mitte teine hinnang provideri kiirusele.
const STT_CLIENT_TIMEOUT_MS = 90_000;
const TTS_CLIENT_TIMEOUT_MS = 30_000;

function createRecordingIntentKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `rec-${crypto.randomUUID()}`;
  }
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getAudioContextClass() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function getSupportedRecorderMimeType() {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") return "";
  if (typeof window.MediaRecorder.isTypeSupported !== "function") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg"
  ];
  return candidates.find(type => window.MediaRecorder.isTypeSupported(type)) || "";
}

function encodeWavBlob(chunks, sampleRate) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const pcm = new Int16Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[i]));
      pcm[offset] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      offset += 1;
    }
  }

  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeString = (position, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(position + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, pcm.length * 2, true);

  for (let i = 0; i < pcm.length; i += 1) {
    view.setInt16(44 + i * 2, pcm[i], true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function useSpeech({
  locale,
  latestAiText,
  onAppendText,
  onTranscribeAudio,
  onError,
  voiceEnabled = true,
  t
}) {
  const [speechReady, setSpeechReady] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingPulse, setRecordingPulse] = useState(false);
  const [recordingError, setRecordingError] = useState(null);
  // Mitte-vea teated (katkestuse KINNITUS, 2,5 min hoiatus, märgistatud
  // brauserihääle varu). Eraldi kanalis, sest need ei ole tõrked.
  const [voiceNotice, setVoiceNotice] = useState(null);
  const synthesisRef = useRef(null);
  const audioRef = useRef(null);
  const recorderRef = useRef(null);
  const recorderKindRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingPulseTimerRef = useRef(null);
  const recordingLevelRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const recordingWarningTimerRef = useRef(null);
  const recordingLimitTimerRef = useRef(null);
  // E4 punkt 1: kui see on püsti, EI jõua salvestus providerini.
  const recordingDiscardRef = useRef(false);
  // Üks salvestus = üks kavatsus = üks tasutav ühik (SOL-VOICE-01). Ilma stabiilse võtmeta
  // tekitab iga korduskatse uue reservatsiooni ja sama salvestuse eest makstakse mitu korda.
  const recordingIntentKeyRef = useRef(null);
  // Üks aktiivne serverisüntees korraga; Stop ja unmount katkestavad ta (SOL-VOICE-03).
  const ttsGateRef = useRef(null);
  if (!ttsGateRef.current) ttsGateRef.current = createLatestRequestGate();
  const audioContextRef = useRef(null);
  const audioMeterTimerRef = useRef(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  const tr = useCallback(key => {
    if (typeof t === "function") {
      const value = t(key);
      if (typeof value === "string" && value.trim()) return value;
    }
    return key;
  }, [t]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    synthesisRef.current = window.speechSynthesis || null;
    const synth = synthesisRef.current;
    function handleVoicesChanged() {
      setSpeechReady(true);
    }
    if (synth) {
      synth.addEventListener("voiceschanged", handleVoicesChanged);
      synth.getVoices();
      setSpeechReady(true);
      return () => synth.removeEventListener("voiceschanged", handleVoicesChanged);
    }
  }, []);
  const clearRecordingTimers = useCallback(() => {
    if (recordingWarningTimerRef.current) {
      clearTimeout(recordingWarningTimerRef.current);
      recordingWarningTimerRef.current = null;
    }
    if (recordingLimitTimerRef.current) {
      clearTimeout(recordingLimitTimerRef.current);
      recordingLimitTimerRef.current = null;
    }
  }, []);
  useEffect(() => () => {
    try {
      synthesisRef.current?.cancel?.();
    } catch {}
    try {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audioRef.current = null;
      }
    } catch {}
    // Lahtivõtmine on ALATI katkestus: pooleli salvestus ei tohi lahkuvalt
    // ekraanilt providerini rännata.
    recordingDiscardRef.current = true;
    try {
      recorderRef.current?.stop?.();
    } catch {}
    try {
      recorderRef.current?.stream?.getTracks?.().forEach(t => t.stop && t.stop());
    } catch {}
  }, []);
  const stopSpeaking = useCallback(() => {
    // Katkestus peab jõudma ka POOLELIOLEVA serverikutseni. Varem tühistas Stop ainult
    // brauseri kõnesünteesi ja juba loodud `Audio` objekti — server sünteesis lõpuni,
    // kvoot kulus ja hiline vastus võis heli hiljem mängima panna, ka pärast lahkumist.
    ttsGateRef.current?.invalidate();
    try {
      synthesisRef.current?.cancel?.();
    } catch {}
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
      } catch {}
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);
  // Tagastab TRUE ainult siis, kui brauserile jõuti kõne päriselt anda.
  // Vale tagastus siin = vaikiv ebaõnnestumine kasutaja jaoks (E4).
  const speakWithBrowser = useCallback(text => {
    if (typeof window === "undefined") return false;
    const synth = synthesisRef.current;
    if (!synth || typeof synth.speak !== "function" || !text) return false;
    if (typeof window.SpeechSynthesisUtterance !== "function") return false;
    try {
      synth.cancel();
      const utterance = new window.SpeechSynthesisUtterance(text);
      const normLocale = (locale || "").toLowerCase();
      const pick = pickBrowserVoice(synth.getVoices?.() || [], normLocale);
      if (pick) {
        utterance.voice = pick;
        utterance.lang = pick.lang || normLocale || "en-US";
      } else {
        utterance.lang = normLocale || "en-US";
      }
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        setVoiceNotice(tr(VOICE_NOTICE_KEYS.tts_unavailable));
      };
      synth.speak(utterance);
      return true;
    } catch {
      setIsSpeaking(false);
      return false;
    }
  }, [locale, tr]);
  const speakText = useCallback(async (textToSpeak) => {
    if (typeof window === "undefined") return false;
    if (isSpeaking) {
      stopSpeaking();
      return false;
    }
    const text = String(textToSpeak || "").trim();
    if (!text) return false;
    stopSpeaking();
    setVoiceNotice(null);
    setIsSpeaking(true);
    // Serveritee AINULT ET-le (omanik 03.08: RU/EN ettelugemine jääb
    // kasutajale tasuta ehk brauserihäälele). RU/EN jaoks on brauserihääl
    // kavatsetud rada, mitte varu — aga tema TÕRGE öeldakse ikka välja.
    const serverRoute = usesServerTts(locale);
    if (serverRoute) {
      // `begin` katkestab eelmise kutse ja annab uue põlvkonna. Otsus „kas ma tohin veel
      // heli teha" tehakse VASTUSE saabudes, mitte kutse alustamisel — vahepeal võis
      // kasutaja Stop'i vajutada või komponent lahti võtta.
      const attempt = ttsGateRef.current.begin(locale);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: text.slice(0, 4500),
            locale
          }),
          signal: withRequestTimeout(attempt.signal, TTS_CLIENT_TIMEOUT_MS)
        });
        const data = await res.json().catch(() => ({}));
        if (!attempt.isCurrent()) return;
        if (res.ok && data?.ok && data?.audioContent) {
          const src = `data:${data.contentType || "audio/mpeg"};base64,${data.audioContent}`;
          const audio = new Audio(src);
          audioRef.current = audio;
          audio.onended = () => {
            audioRef.current = null;
            setIsSpeaking(false);
          };
          audio.onerror = () => {
            audioRef.current = null;
            setIsSpeaking(false);
            setVoiceNotice(tr(VOICE_NOTICE_KEYS.tts_unavailable));
          };
          await audio.play();
          return true;
        }
      } catch (error) {
        // Katkestus ei ole tõrge: Stop on kasutaja enda otsus ja tema järel ei tohi
        // brauserihääl varuna tööle hüpata.
        if (isAbortError(error) || !attempt.isCurrent()) return false;
      }
    }
    stopSpeaking();
    const browserSpoke = speakWithBrowser(text);
    const outcome = resolveTtsOutcome({
      serverSpoke: false,
      browserSpoke,
      browserIsPrimary: !serverRoute
    });
    if (outcome.noticeKey) setVoiceNotice(tr(outcome.noticeKey));
    return browserSpoke;
  }, [isSpeaking, locale, speakWithBrowser, stopSpeaking, tr]);
  const speakLatestReply = useCallback(() => {
    return speakText(latestAiText);
  }, [latestAiText, speakText]);
  const triggerRecordingPulse = useCallback(() => {
    if (recordingPulseTimerRef.current) {
      clearTimeout(recordingPulseTimerRef.current);
    }
    setRecordingPulse(true);
    recordingPulseTimerRef.current = setTimeout(() => {
      setRecordingPulse(false);
      recordingPulseTimerRef.current = null;
    }, 600);
  }, []);
  const stopAudioMeter = useCallback(() => {
    if (audioMeterTimerRef.current) {
      clearInterval(audioMeterTimerRef.current);
      audioMeterTimerRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
  }, []);
  const processRecordingBlob = useCallback(async ({ blob, mimeType, fileName = "audio.webm" }) => {
    setRecording(false);
    stopAudioMeter();
    clearRecordingTimers();
    // E4 punkt 1 — AINUS värav providerini. Katkestatud salvestus lõpeb
    // siin: blob jääb viiteta, `onTranscribeAudio`/`/api/stt` ei kutsuta.
    if (recordingDiscardRef.current) {
      recordingDiscardRef.current = false;
      recordingChunksRef.current = [];
      return;
    }
    triggerRecordingPulse();
    if (!blob?.size) return;
    const durationMs = Math.max(0, Date.now() - recordingStartedAtRef.current);
    const maxLevel = recordingLevelRef.current;
    if (maxLevel < 3.5 && durationMs > 500) {
      setRecordingError(tr("chat.mic.silence"));
      return;
    }
    try {
      if (typeof onTranscribeAudio === "function") {
        const result = await onTranscribeAudio({
          blob,
          mimeType,
          fileName,
          locale: locale || "auto"
        });
        const nextText = String(result?.appendText || "").trim();
        if (nextText) onAppendText?.(nextText);
      } else {
        const fd = new FormData();
        fd.append("audio", blob, fileName);
        fd.append("locale", locale || "auto");
        // Sama salvestus = sama võti, ka korduskatsel: ilma temata tekitab iga kordus uue
        // reservatsiooni ja ühe salvestuse eest kulub mitu ühikut (SOL-VOICE-01).
        if (!recordingIntentKeyRef.current) {
          recordingIntentKeyRef.current = createRecordingIntentKey();
        }
        fd.append("idempotencyKey", recordingIntentKeyRef.current);
        const res = await fetch("/api/stt", {
          method: "POST",
          body: fd,
          signal: withRequestTimeout(null, STT_CLIENT_TIMEOUT_MS)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false || !data?.text) {
          throw new Error(resolveApiMessage({
            payload: data,
            t: key => tr(key),
            fallbackKey: "chat.mic.error",
            fallbackText: tr("chat.mic.error")
          }));
        }
        onAppendText?.(data.text);
        // Tekst on käes — kavatsus on lõpetatud ja järgmine salvestus algab uue võtmega.
        recordingIntentKeyRef.current = null;
      }
    } catch (err) {
      setRecordingError(
        isAbortError(err) ? tr("chat.mic.error") : err?.message || tr("chat.mic.error")
      );
    }
  }, [clearRecordingTimers, locale, onAppendText, onTranscribeAudio, stopAudioMeter, tr, triggerRecordingPulse]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    const recorderKind = recorderKindRef.current;
    recorderRef.current = null;
    recorderKindRef.current = null;
    setRecording(false);
    clearRecordingTimers();
    try {
      recorder?.stop?.();
    } catch {}
    if (recorderKind !== "wave") {
      try {
        recorder?.stream?.getTracks?.().forEach(t => t.stop && t.stop());
      } catch {}
    }
  }, [clearRecordingTimers]);
  // E4 punkt 1: katkesta ja viska ära. Kasutaja saab KINNITUSE, mitte vaikuse.
  const cancelRecording = useCallback(() => {
    if (!recorderRef.current) return;
    recordingDiscardRef.current = true;
    recordingChunksRef.current = [];
    setRecordingError(null);
    setVoiceNotice(tr(VOICE_NOTICE_KEYS.discarded));
    stopRecording();
    stopAudioMeter();
  }, [stopAudioMeter, stopRecording, tr]);
  const startAudioMeter = useCallback(stream => {
    const AudioContextClass = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    if (!AudioContextClass) return;
    try {
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      audioMeterTimerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          sum += Math.abs(data[i] - 128);
        }
        const avg = sum / data.length;
        if (avg > recordingLevelRef.current) recordingLevelRef.current = avg;
      }, 120);
    } catch {}
  }, []);
  const handleMic = useCallback(async () => {
    let stream = null;
    const startWaveRecorder = async activeStream => {
      const AudioContextClass = getAudioContextClass();
      if (!AudioContextClass) {
        throw new Error("UNSUPPORTED_RECORDING");
      }
      const context = new AudioContextClass();
      if (typeof context.resume === "function" && context.state === "suspended") {
        await context.resume().catch(() => {});
      }
      const source = context.createMediaStreamSource(activeStream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const mute = context.createGain();
      mute.gain.value = 0;
      const chunks = [];
      processor.onaudioprocess = event => {
        const input = event.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(input));
      };
      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);
      recorderRef.current = {
        stream: activeStream,
        stop: async () => {
          try {
            processor.disconnect();
          } catch {}
          try {
            source.disconnect();
          } catch {}
          try {
            mute.disconnect();
          } catch {}
          try {
            activeStream.getTracks().forEach(track => track.stop && track.stop());
          } catch {}
          const sampleRate = context.sampleRate || 44100;
          try {
            await context.close();
          } catch {}
          const blob = encodeWavBlob(chunks, sampleRate);
          await processRecordingBlob({
            blob,
            mimeType: "audio/wav",
            fileName: "audio.wav"
          });
        }
      };
      recorderKindRef.current = "wave";
    };
    if (recording) {
      stopRecording();
      stopAudioMeter();
      return;
    }
    setRecordingError(null);
    setVoiceNotice(null);
    if (recordingPulseTimerRef.current) {
      clearTimeout(recordingPulseTimerRef.current);
      recordingPulseTimerRef.current = null;
    }
    setRecordingPulse(false);
    // E4 punkt 4: kolm keeldu on kolm eri teksti. Tellimusnõuet ei tohi
    // esitada "mikrofon ei ole toetatud" ega "ei saanud avada" all.
    const blocked = micBlockReason({
      voiceEnabled,
      mediaDevicesAvailable: Boolean(navigator?.mediaDevices?.getUserMedia)
    });
    if (blocked) {
      setRecordingError(tr(micMessageKey(blocked)));
      return;
    }
    recordingDiscardRef.current = false;
    clearRecordingTimers();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      recordingLevelRef.current = 0;
      recordingStartedAtRef.current = Date.now();
      startAudioMeter(stream);
      recordingChunksRef.current = [];
      if (typeof window.MediaRecorder !== "undefined") {
        try {
          const recorderMimeType = getSupportedRecorderMimeType();
          const rec = recorderMimeType ? new MediaRecorder(stream, { mimeType: recorderMimeType }) : new MediaRecorder(stream);
          recorderRef.current = rec;
          recorderKindRef.current = "media-recorder";
          rec.ondataavailable = e => {
            if (e?.data?.size) recordingChunksRef.current.push(e.data);
          };
          rec.onstop = () => {
            try {
              rec.stream?.getTracks?.().forEach(t => t.stop && t.stop());
            } catch {}
            const mimeType = rec.mimeType || recorderMimeType || "audio/webm";
            const extension = mimeType.includes("wav") ? "wav" : mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
            const blob = new Blob(recordingChunksRef.current, { type: mimeType });
            void processRecordingBlob({
              blob,
              mimeType,
              fileName: `audio.${extension}`
            });
          };
          rec.start();
        } catch {
          recorderRef.current = null;
          recorderKindRef.current = null;
          await startWaveRecorder(stream);
        }
      } else {
        await startWaveRecorder(stream);
      }
      setRecording(true);
      // E4 punkt 2 — 2,5 min pehme piir koos hoiatusega. Piir LÕPETAB
      // salvestuse (ei viska ära): senine kõne läheb transkribeerimisse.
      recordingWarningTimerRef.current = setTimeout(() => {
        recordingWarningTimerRef.current = null;
        setVoiceNotice(tr(VOICE_NOTICE_KEYS.limit_warning));
      }, RECORDING_WARNING_MS);
      recordingLimitTimerRef.current = setTimeout(() => {
        recordingLimitTimerRef.current = null;
        setVoiceNotice(tr(VOICE_NOTICE_KEYS.limit_reached));
        stopRecording();
        stopAudioMeter();
      }, RECORDING_LIMIT_MS);
    } catch (error) {
      try {
        stream?.getTracks?.().forEach(track => track.stop && track.stop());
      } catch {}
      setRecordingError(tr(micMessageKey(classifyMicStartError(error))));
      stopRecording();
      stopAudioMeter();
    }
  }, [clearRecordingTimers, processRecordingBlob, recording, startAudioMeter, stopAudioMeter, stopRecording, tr, voiceEnabled]);
  useEffect(() => {
    return () => {
      if (recordingPulseTimerRef.current) {
        clearTimeout(recordingPulseTimerRef.current);
      }
      clearRecordingTimers();
      stopAudioMeter();
    };
  }, [clearRecordingTimers, stopAudioMeter]);
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);
  return useMemo(() => ({
    speechReady,
    isSpeaking,
    speakText,
    speakLatestReply,
    stopSpeaking,
    recording,
    recordingPulse,
    recordingError,
    voiceNotice,
    handleMic,
    cancelRecording
  }), [speechReady, isSpeaking, speakText, speakLatestReply, stopSpeaking, recording, recordingPulse, recordingError, voiceNotice, handleMic, cancelRecording]);
}
