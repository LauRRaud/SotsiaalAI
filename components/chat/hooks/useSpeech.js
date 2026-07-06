import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

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
  t
}) {
  const [speechReady, setSpeechReady] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingPulse, setRecordingPulse] = useState(false);
  const [recordingError, setRecordingError] = useState(null);
  const synthesisRef = useRef(null);
  const audioRef = useRef(null);
  const recorderRef = useRef(null);
  const recorderKindRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingPulseTimerRef = useRef(null);
  const recordingLevelRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
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
    try {
      recorderRef.current?.stop?.();
    } catch {}
    try {
      recorderRef.current?.stream?.getTracks?.().forEach(t => t.stop && t.stop());
    } catch {}
  }, []);
  const stopSpeaking = useCallback(() => {
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
  const speakWithBrowser = useCallback(text => {
    if (typeof window === "undefined") return;
    const synth = synthesisRef.current;
    if (!synth || !text) return;
    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices() || [];
      const normLocale = (locale || "").toLowerCase();
      const base = normLocale.split("-")[0] || normLocale;
      const prefs = base === "et" ? [normLocale, "et-ee", "et", "en-us", "en"] : base === "ru" ? [normLocale, "ru-ru", "ru", "en-us", "en", "et-ee", "et"] : base === "en" ? [normLocale, "en-us", "en-gb", "en", "et-ee", "et", "ru-ru", "ru"] : [normLocale, base, "en-us", "en", "et-ee", "et", "ru-ru", "ru"].filter(Boolean);
      const pick = prefs.map(pref => voices.find(v => (v.lang || "").toLowerCase().startsWith(pref))).find(Boolean);
      if (pick) {
        utterance.voice = pick;
        utterance.lang = pick.lang || normLocale || "en-US";
      } else {
        utterance.lang = normLocale || "en-US";
      }
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      synth.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  }, [locale]);
  const speakText = useCallback(async (textToSpeak) => {
    if (typeof window === "undefined") return;
    if (isSpeaking) {
      stopSpeaking();
      return;
    }
    const text = String(textToSpeak || "").trim();
    if (!text) return;
    const base = (locale || "").toLowerCase().split("-")[0];
    if (base === "ru" || base === "en") {
      stopSpeaking();
      speakWithBrowser(text);
      return;
    }
    stopSpeaking();
    setIsSpeaking(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: text.slice(0, 4500),
          locale
        })
      });
      const data = await res.json().catch(() => ({}));
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
        };
        await audio.play();
        return;
      }
    } catch {}
    stopSpeaking();
    speakWithBrowser(text);
  }, [isSpeaking, locale, speakWithBrowser, stopSpeaking]);
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
        const res = await fetch("/api/stt", {
          method: "POST",
          body: fd
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
      }
    } catch (err) {
      setRecordingError(err?.message || tr("chat.mic.error"));
    }
  }, [locale, onAppendText, onTranscribeAudio, stopAudioMeter, tr, triggerRecordingPulse]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    const recorderKind = recorderKindRef.current;
    recorderRef.current = null;
    recorderKindRef.current = null;
    setRecording(false);
    try {
      recorder?.stop?.();
    } catch {}
    if (recorderKind !== "wave") {
      try {
        recorder?.stream?.getTracks?.().forEach(t => t.stop && t.stop());
      } catch {}
    }
  }, []);
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
    if (recordingPulseTimerRef.current) {
      clearTimeout(recordingPulseTimerRef.current);
      recordingPulseTimerRef.current = null;
    }
    setRecordingPulse(false);
    if (!navigator?.mediaDevices?.getUserMedia) {
      setRecordingError(tr("chat.mic.unsupported"));
      return;
    }
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
    } catch (error) {
      try {
        stream?.getTracks?.().forEach(track => track.stop && track.stop());
      } catch {}
      if (String(error?.message || "") === "UNSUPPORTED_RECORDING") {
        setRecordingError(tr("chat.mic.unsupported"));
      } else {
        setRecordingError(tr("chat.mic.cannot_start"));
      }
      stopRecording();
      stopAudioMeter();
    }
  }, [processRecordingBlob, recording, startAudioMeter, stopAudioMeter, stopRecording, tr]);
  useEffect(() => {
    return () => {
      if (recordingPulseTimerRef.current) {
        clearTimeout(recordingPulseTimerRef.current);
      }
      stopAudioMeter();
    };
  }, [stopAudioMeter]);
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
    handleMic
  }), [speechReady, isSpeaking, speakText, speakLatestReply, stopSpeaking, recording, recordingPulse, recordingError, handleMic]);
}
