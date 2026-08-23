"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  VOICE_IDLE_LIMIT_MS,
  VOICE_SESSION_LIMIT_MS,
  VOICE_SESSION_SPEECH_CHAR_LIMIT,
  VOICE_SESSION_WARNING_MS,
  voiceReplyExcerpt
} from "@/lib/chat/realtimeVoice";

function createVoiceSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `voice_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

function stopMediaStream(stream) {
  try {
    stream?.getTracks?.().forEach(track => track.stop());
  } catch {}
}

export function useRealtimeVoice({
  enabled = true,
  locale,
  latestAiText,
  isGenerating,
  isSpeaking,
  speakText,
  stopSpeaking,
  onTranscript,
  onStopResponse,
  t
}) {
  const [status, setStatus] = useState("idle");
  const [caption, setCaption] = useState("");
  const [partialCaption, setPartialCaption] = useState("");
  const [errorKey, setErrorKey] = useState("");
  const [noticeKey, setNoticeKey] = useState("");
  const [muted, setMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [remainingMs, setRemainingMs] = useState(VOICE_SESSION_LIMIT_MS);

  const mountedRef = useRef(true);
  const statusRef = useRef(status);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const meterFrameRef = useRef(null);
  const settlementTokenRef = useRef("");
  const settlementStartedAtRef = useRef(0);
  const sessionStartedAtRef = useRef(0);
  const lastActivityAtRef = useRef(0);
  const warningTimerRef = useRef(null);
  const limitTimerRef = useRef(null);
  const clockTimerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const awaitingReplyRef = useRef(null);
  const ttsActiveRef = useRef(false);
  const spokenCharsRef = useRef(0);
  const isGeneratingRef = useRef(isGenerating);
  const isSpeakingRef = useRef(isSpeaking);
  const latestAiTextRef = useRef(latestAiText);
  const onTranscriptRef = useRef(onTranscript);
  const onStopResponseRef = useRef(onStopResponse);
  const speakTextRef = useRef(speakText);
  const stopSpeakingRef = useRef(stopSpeaking);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { isGeneratingRef.current = isGenerating; }, [isGenerating]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { latestAiTextRef.current = latestAiText; }, [latestAiText]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onStopResponseRef.current = onStopResponse; }, [onStopResponse]);
  useEffect(() => { speakTextRef.current = speakText; }, [speakText]);
  useEffect(() => { stopSpeakingRef.current = stopSpeaking; }, [stopSpeaking]);

  const tr = useCallback((key, fallback = key) => {
    const value = typeof t === "function" ? t(key) : "";
    return typeof value === "string" && value.trim() && value !== key ? value : fallback;
  }, [t]);

  const clearTimers = useCallback(() => {
    for (const ref of [warningTimerRef, limitTimerRef, clockTimerRef, idleTimerRef]) {
      if (ref.current) clearTimeout(ref.current);
      ref.current = null;
    }
  }, []);

  const stopMeter = useCallback(() => {
    if (meterFrameRef.current) cancelAnimationFrame(meterFrameRef.current);
    meterFrameRef.current = null;
    try { audioContextRef.current?.close?.(); } catch {}
    audioContextRef.current = null;
    if (mountedRef.current) setAudioLevel(0);
  }, []);

  const cleanupConnection = useCallback(() => {
    clearTimers();
    stopMeter();
    try { dataChannelRef.current?.close?.(); } catch {}
    dataChannelRef.current = null;
    try { peerConnectionRef.current?.close?.(); } catch {}
    peerConnectionRef.current = null;
    stopMediaStream(mediaStreamRef.current);
    mediaStreamRef.current = null;
  }, [clearTimers, stopMeter]);

  const settleVoiceUsage = useCallback((token, speechChars = 0) => {
    const settlementToken = String(token || "");
    if (!settlementToken) return;
    const seconds = Math.max(1, Math.ceil((Date.now() - settlementStartedAtRef.current) / 1000));
    void fetch("/api/realtime/session/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: settlementToken,
        seconds,
        speechChars
      }),
      keepalive: true
    }).catch(() => {});
  }, []);

  const endSession = useCallback((reason = "ended", { silent = false } = {}) => {
    statusRef.current = reason === "error" ? "error" : "ended";
    const token = settlementTokenRef.current;
    const speechChars = spokenCharsRef.current;
    settlementTokenRef.current = "";
    ttsActiveRef.current = false;
    cleanupConnection();
    try { stopSpeakingRef.current?.(); } catch {}
    awaitingReplyRef.current = null;
    spokenCharsRef.current = 0;
    settleVoiceUsage(token, speechChars);
    if (!silent && mountedRef.current) {
      setStatus(reason === "error" ? "error" : "ended");
      if (reason === "limit") setNoticeKey("chat.voice.limit_reached");
      if (reason === "speech_limit") setNoticeKey("chat.voice.speech_limit_reached");
      if (reason === "idle") setNoticeKey("chat.voice.idle_reached");
      setRemainingMs(0);
      setMuted(false);
    }
  }, [cleanupConnection, settleVoiceUsage]);

  const touchActivity = useCallback(() => {
    lastActivityAtRef.current = Date.now();
  }, []);

  const startMeter = useCallback((stream) => {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const context = new AudioContextClass();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.74;
      source.connect(analyser);
      audioContextRef.current = context;
      const data = new Uint8Array(analyser.fftSize);
      let lastPaint = 0;
      const paint = (time) => {
        if (!audioContextRef.current) return;
        analyser.getByteTimeDomainData(data);
        if (time - lastPaint > 80) {
          let sum = 0;
          for (const sample of data) {
            const centered = (sample - 128) / 128;
            sum += centered * centered;
          }
          const rms = Math.sqrt(sum / data.length);
          setAudioLevel(Math.min(1, rms * 7.5));
          lastPaint = time;
        }
        meterFrameRef.current = requestAnimationFrame(paint);
      };
      meterFrameRef.current = requestAnimationFrame(paint);
    } catch {}
  }, []);

  const handleRealtimeEvent = useCallback((event) => {
    let payload;
    try { payload = JSON.parse(event.data); } catch { return; }
    const type = String(payload?.type || "");

    if (type === "input_audio_buffer.speech_started") {
      touchActivity();
      setNoticeKey("");
      setPartialCaption("");
      if (ttsActiveRef.current || isSpeakingRef.current) {
        ttsActiveRef.current = false;
        stopSpeakingRef.current?.();
      }
      if (isGeneratingRef.current) {
        stopSpeakingRef.current?.();
        onStopResponseRef.current?.();
        awaitingReplyRef.current = null;
      }
      setStatus("listening");
      return;
    }

    if (type === "input_audio_buffer.speech_stopped") {
      touchActivity();
      setStatus("thinking");
      return;
    }

    if (type === "conversation.item.input_audio_transcription.delta") {
      touchActivity();
      setPartialCaption(previous => `${previous}${String(payload?.delta || "")}`.slice(-420));
      return;
    }

    if (type === "conversation.item.input_audio_transcription.failed") {
      // Põhjus jõuab ainult siia. Ilma temata oli 22.08 võimatu öelda, kas
      // transkriptsioon kukkus mudeli, sõnavaravihje või heli pärast — ja
      // mikrofoni ei saa arendusmasinast katsetada.
      if (process.env.NODE_ENV !== "production") {
        console.warn("[voice] transcription failed", payload?.error || payload);
      }
      setPartialCaption("");
      setErrorKey("chat.voice.transcription_failed");
      setStatus("listening");
      return;
    }

    if (type === "conversation.item.input_audio_transcription.completed") {
      const text = String(payload?.transcript || "").trim();
      setPartialCaption("");
      if (!text) {
        setStatus("listening");
        return;
      }
      touchActivity();
      setCaption(text);
      setStatus("thinking");
      setErrorKey("");
      awaitingReplyRef.current = { before: String(latestAiTextRef.current || "") };
      void Promise.resolve(onTranscriptRef.current?.(text)).then(result => {
        if (result === false || result?.ok === false) {
          awaitingReplyRef.current = null;
          if (result?.reason === "privacy") {
            setErrorKey("chat.voice.privacy_review");
          } else {
            setErrorKey("chat.voice.send_failed");
          }
          setStatus("listening");
        }
      }).catch(() => {
        awaitingReplyRef.current = null;
        setErrorKey("chat.voice.send_failed");
        setStatus("listening");
      });
      return;
    }

    if (type === "error") {
      setErrorKey("chat.voice.connection_failed");
      endSession("error");
    }
  }, [endSession, touchActivity]);

  const startSession = useCallback(async () => {
    if (statusRef.current === "connecting" || statusRef.current === "listening") return false;
    if (!enabled) {
      statusRef.current = "error";
      setErrorKey("chat.voice.requires_subscription");
      setStatus("error");
      return false;
    }
    statusRef.current = "connecting";
    setStatus("connecting");
    setErrorKey("");
    setNoticeKey("");
    setCaption("");
    setPartialCaption("");
    setRemainingMs(VOICE_SESSION_LIMIT_MS);
    ttsActiveRef.current = false;
    spokenCharsRef.current = 0;

    let stream = null;
    try {
      if (!navigator?.mediaDevices?.getUserMedia || !globalThis.RTCPeerConnection) {
        throw new Error("unsupported");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      mediaStreamRef.current = stream;
      startMeter(stream);

      const peer = new RTCPeerConnection();
      peerConnectionRef.current = peer;
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      const channel = peer.createDataChannel("oai-events");
      dataChannelRef.current = channel;
      channel.addEventListener("message", handleRealtimeEvent);
      channel.addEventListener("open", () => {
        touchActivity();
        statusRef.current = "listening";
        setStatus("listening");
      });
      channel.addEventListener("error", () => {
        setErrorKey("chat.voice.connection_failed");
        endSession("error");
      });
      peer.addEventListener("connectionstatechange", () => {
        if (["failed", "closed"].includes(peer.connectionState) && settlementTokenRef.current) {
          setErrorKey("chat.voice.connection_failed");
          endSession("error");
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdp: offer.sdp,
          locale,
          sessionId: createVoiceSessionId()
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.sdp || !data?.settlementToken) {
        const error = new Error(data?.messageKey || "chat.voice.connection_failed");
        error.messageKey = data?.messageKey;
        throw error;
      }

      settlementTokenRef.current = data.settlementToken;
      settlementStartedAtRef.current = Date.now();
      await peer.setRemoteDescription({ type: "answer", sdp: data.sdp });

      const startedAt = Date.now();
      sessionStartedAtRef.current = startedAt;
      lastActivityAtRef.current = startedAt;
      warningTimerRef.current = setTimeout(() => {
        setNoticeKey("chat.voice.limit_warning");
      }, VOICE_SESSION_WARNING_MS);
      limitTimerRef.current = setTimeout(() => endSession("limit"), VOICE_SESSION_LIMIT_MS);
      const updateClock = () => {
        const left = Math.max(0, VOICE_SESSION_LIMIT_MS - (Date.now() - sessionStartedAtRef.current));
        setRemainingMs(left);
        if (left > 0) clockTimerRef.current = setTimeout(updateClock, 1000);
      };
      updateClock();
      const checkIdle = () => {
        if (Date.now() - lastActivityAtRef.current >= VOICE_IDLE_LIMIT_MS) {
          endSession("idle");
          return;
        }
        idleTimerRef.current = setTimeout(checkIdle, 1000);
      };
      idleTimerRef.current = setTimeout(checkIdle, 1000);
      return true;
    } catch (error) {
      const token = settlementTokenRef.current;
      const speechChars = spokenCharsRef.current;
      settlementTokenRef.current = "";
      cleanupConnection();
      settleVoiceUsage(token, speechChars);
      setErrorKey(
        error?.name === "NotAllowedError"
          ? "chat.voice.permission_denied"
          : error?.messageKey === "api.common.rate_limited"
            ? "chat.voice.rate_limited"
            : error?.messageKey === "api.common.subscription_required"
              ? "chat.voice.requires_subscription"
              : "chat.voice.connection_failed"
      );
      setStatus("error");
      stopMediaStream(stream);
      return false;
    }
  }, [cleanupConnection, enabled, endSession, handleRealtimeEvent, locale, settleVoiceUsage, startMeter, touchActivity]);

  const toggleMuted = useCallback(() => {
    const next = !muted;
    mediaStreamRef.current?.getAudioTracks?.().forEach(track => { track.enabled = !next; });
    setMuted(next);
    touchActivity();
  }, [muted, touchActivity]);

  useEffect(() => {
    const waiting = awaitingReplyRef.current;
    const answer = String(latestAiText || "").trim();
    if (!waiting || isGenerating || !answer || answer === waiting.before) return;
    awaitingReplyRef.current = null;
    touchActivity();
    const remainingChars = VOICE_SESSION_SPEECH_CHAR_LIMIT - spokenCharsRef.current;
    if (remainingChars <= 0) {
      endSession("speech_limit");
      return;
    }
    const spokenText = voiceReplyExcerpt(answer, {
      maxChars: Math.min(900, remainingChars)
    });
    const speak = speakTextRef.current;
    if (!spokenText || typeof speak !== "function") {
      setErrorKey("chat.voice.send_failed");
      setStatus("listening");
      return;
    }
    spokenCharsRef.current = Math.min(
      VOICE_SESSION_SPEECH_CHAR_LIMIT,
      spokenCharsRef.current + spokenText.length
    );
    ttsActiveRef.current = true;
    void Promise.resolve(speak(spokenText)).then(started => {
      if (!ttsActiveRef.current || !mountedRef.current) return;
      if (!started) {
        ttsActiveRef.current = false;
        setErrorKey("chat.tts.unavailable");
        setStatus("listening");
        return;
      }
      touchActivity();
      setStatus("speaking");
    }).catch(() => {
      if (!ttsActiveRef.current || !mountedRef.current) return;
      ttsActiveRef.current = false;
      setErrorKey("chat.voice.send_failed");
      setStatus("listening");
    });
  }, [endSession, isGenerating, latestAiText, touchActivity]);

  useEffect(() => {
    // useSpeech seab isSpeaking=false alles päris heli lõpus. Nii saab
    // häälvestlus kuulamise juurde tagasi minna ilma Realtime audioeventideta.
    if (isSpeaking || !ttsActiveRef.current || statusRef.current !== "speaking") return;
    ttsActiveRef.current = false;
    touchActivity();
    setStatus("listening");
  }, [isSpeaking, touchActivity]);

  useEffect(() => {
    const closeOnPageExit = () => endSession("ended", { silent: true });
    const closeWhenHidden = () => {
      if (
        document.visibilityState === "hidden" &&
        (settlementTokenRef.current || peerConnectionRef.current)
      ) endSession("ended");
    };
    window.addEventListener("pagehide", closeOnPageExit);
    document.addEventListener("visibilitychange", closeWhenHidden);
    return () => {
      window.removeEventListener("pagehide", closeOnPageExit);
      document.removeEventListener("visibilitychange", closeWhenHidden);
    };
  }, [endSession]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      endSession("ended", { silent: true });
    };
  }, [endSession]);

  const stateLabel = tr(`chat.voice.state_${status}`, status);
  return useMemo(() => ({
    status,
    stateLabel,
    caption,
    partialCaption,
    error: errorKey ? tr(errorKey) : "",
    notice: noticeKey ? tr(noticeKey) : "",
    muted,
    audioLevel,
    remainingMs,
    active: Boolean(settlementTokenRef.current),
    startSession,
    endSession,
    toggleMuted
  }), [audioLevel, caption, endSession, errorKey, muted, noticeKey, partialCaption, remainingMs, startSession, stateLabel, status, toggleMuted, tr]);
}
