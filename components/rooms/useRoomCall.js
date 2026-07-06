"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function callPath(roomId, suffix = "", basePath = "") {
  if (basePath) return `${basePath}${suffix}`;
  return `/api/rooms/${encodeURIComponent(String(roomId || ""))}/calls${suffix}`;
}

async function readPayload(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    const error = new Error(payload?.message || payload?.messageKey || "call.request_failed");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function useRoomCall(roomId, userId, { basePath = "" } = {}) {
  const [call, setCall] = useState(null);
  const [config, setConfig] = useState({ provider: "mock", providerAvailable: true, maxParticipants: 8 });
  const [canModerate, setCanModerate] = useState(false);
  const [joined, setJoined] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connectionState, setConnectionState] = useState("idle");
  const roomRef = useRef(null);
  const audioTrackRef = useRef(null);
  const remoteAudioElsRef = useRef(new Map());
  const joinedCallIdRef = useRef("");

  const activeSpeakRequest = useMemo(() => {
    if (!call || !userId) return null;
    return (call.speakRequests || []).find(request => request.userId === userId && request.status === "ACTIVE") || null;
  }, [call, userId]);

  const joinedParticipant = useMemo(() => {
    if (!call || !userId) return null;
    return (call.participants || []).find(participant => participant.userId === userId && !participant.leftAt) || null;
  }, [call, userId]);

  const cleanupLiveKit = useCallback(async () => {
    remoteAudioElsRef.current.forEach(element => {
      try {
        element.remove();
      } catch {}
    });
    remoteAudioElsRef.current = new Map();
    const track = audioTrackRef.current;
    audioTrackRef.current = null;
    try {
      track?.stop?.();
    } catch {}
    const liveRoom = roomRef.current;
    roomRef.current = null;
    try {
      await liveRoom?.disconnect?.();
    } catch {}
    setConnectionState("idle");
  }, []);

  const load = useCallback(async () => {
    if (!roomId) return;
    try {
      const payload = await fetch(callPath(roomId, "", basePath), { cache: "no-store" }).then(readPayload);
      setCall(payload.call || null);
      setConfig(payload.config || { provider: "mock", providerAvailable: true, maxParticipants: 8 });
      setCanModerate(payload.canModerate === true);
      setError("");
      if (!payload.call || joinedCallIdRef.current && payload.call.id !== joinedCallIdRef.current) {
        setJoined(false);
        setMicMuted(false);
        joinedCallIdRef.current = "";
        await cleanupLiveKit();
      }
    } catch (err) {
      setError(err.message || "call.load_failed");
    }
  }, [basePath, cleanupLiveKit, roomId]);

  useEffect(() => {
    setCall(null);
    setJoined(false);
    setMicMuted(false);
    joinedCallIdRef.current = "";
    void cleanupLiveKit();
    if (!roomId) return;
    void load();
    const timer = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(timer);
  }, [cleanupLiveKit, load, roomId]);

  useEffect(() => () => {
    void cleanupLiveKit();
  }, [cleanupLiveKit]);

  const postAction = useCallback(async (suffix, body = {}) => {
    const payload = await fetch(callPath(roomId, suffix, basePath), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(readPayload);
    if ("call" in payload) setCall(payload.call || null);
    return payload;
  }, [basePath, roomId]);

  const connectLiveKit = useCallback(async ({ token, url }) => {
    if (!token || !url) return;
    const livekit = await import("livekit-client");
    const liveRoom = new livekit.Room({
      adaptiveStream: false,
      dynacast: false,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    roomRef.current = liveRoom;
    setConnectionState("connecting");
    const attachRemoteAudio = (track, publication, participant) => {
      if (track?.kind !== "audio") return;
      const key = `${participant?.identity || "remote"}:${publication?.trackSid || publication?.sid || track.sid || Date.now()}`;
      if (remoteAudioElsRef.current.has(key)) return;
      const element = track.attach();
      element.autoplay = true;
      element.controls = false;
      element.dataset.sotsiaalaiCallAudio = "remote";
      element.style.display = "none";
      document.body.appendChild(element);
      remoteAudioElsRef.current.set(key, element);
    };
    const detachRemoteAudio = (track, publication, participant) => {
      const prefix = `${participant?.identity || "remote"}:${publication?.trackSid || publication?.sid || track?.sid || ""}`;
      for (const [key, element] of remoteAudioElsRef.current.entries()) {
        if (key.startsWith(prefix) || element.srcObject === track?.mediaStream) {
          try {
            track?.detach?.(element);
          } catch {}
          try {
            element.remove();
          } catch {}
          remoteAudioElsRef.current.delete(key);
        }
      }
    };
    liveRoom.on(livekit.RoomEvent.Disconnected, () => {
      setConnectionState("disconnected");
    });
    liveRoom.on(livekit.RoomEvent.Reconnecting, () => {
      setConnectionState("reconnecting");
    });
    liveRoom.on(livekit.RoomEvent.Reconnected, () => {
      setConnectionState("connected");
    });
    liveRoom.on(livekit.RoomEvent.TrackSubscribed, attachRemoteAudio);
    liveRoom.on(livekit.RoomEvent.TrackUnsubscribed, detachRemoteAudio);
    await liveRoom.connect(url, token, { autoSubscribe: true });
    const track = await livekit.createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    });
    audioTrackRef.current = track;
    await liveRoom.localParticipant.publishTrack(track, {
      source: livekit.Track.Source.Microphone
    });
    setConnectionState("connected");
  }, []);

  const start = useCallback(async () => {
    if (!roomId || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = await postAction("/start");
      setCall(payload.call || null);
      if (payload.call?.id) {
        const joinPayload = await postAction("/join", { callSessionId: payload.call.id });
        setCall(joinPayload.call || null);
        if (joinPayload.call?.provider === "LIVEKIT_SELF_HOSTED") {
          await connectLiveKit({ token: joinPayload.token, url: joinPayload.livekitUrl });
        }
        joinedCallIdRef.current = joinPayload.call?.id || payload.call.id;
        setJoined(true);
        setMicMuted(false);
      }
    } catch (err) {
      setError(err.message || "call.start_failed");
    } finally {
      setBusy(false);
    }
  }, [busy, connectLiveKit, postAction, roomId]);

  const join = useCallback(async () => {
    if (!roomId || !call?.id || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = await postAction("/join", { callSessionId: call.id });
      setCall(payload.call || null);
      if (payload.call?.provider === "LIVEKIT_SELF_HOSTED") {
        await connectLiveKit({ token: payload.token, url: payload.livekitUrl });
      }
      joinedCallIdRef.current = payload.call?.id || call.id;
      setJoined(true);
      setMicMuted(false);
    } catch (err) {
      setError(err.message || "call.join_failed");
    } finally {
      setBusy(false);
    }
  }, [busy, call?.id, connectLiveKit, postAction, roomId]);

  const leave = useCallback(async () => {
    if (!roomId || !call?.id || busy) return;
    setBusy(true);
    setError("");
    try {
      await cleanupLiveKit();
      const payload = await postAction("/leave", { callSessionId: call.id });
      setCall(payload.call || null);
      setJoined(false);
      setMicMuted(false);
      joinedCallIdRef.current = "";
    } catch (err) {
      setError(err.message || "call.leave_failed");
    } finally {
      setBusy(false);
    }
  }, [busy, call?.id, cleanupLiveKit, postAction, roomId]);

  const end = useCallback(async () => {
    if (!roomId || !call?.id || busy) return;
    setBusy(true);
    setError("");
    try {
      await cleanupLiveKit();
      const payload = await postAction("/end", { callSessionId: call.id });
      setCall(payload.call || null);
      setJoined(false);
      setMicMuted(false);
      joinedCallIdRef.current = "";
    } catch (err) {
      setError(err.message || "call.end_failed");
    } finally {
      setBusy(false);
    }
  }, [busy, call?.id, cleanupLiveKit, postAction, roomId]);

  const setMuted = useCallback(async nextMuted => {
    if (!roomId || !call?.id) return;
    setError("");
    try {
      if (nextMuted) await audioTrackRef.current?.mute?.();
      else await audioTrackRef.current?.unmute?.();
      const payload = await fetch(callPath(roomId, `/${encodeURIComponent(call.id)}/mute`, basePath), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ micMuted: nextMuted })
      }).then(readPayload);
      setCall(payload.call || null);
      setMicMuted(nextMuted);
    } catch (err) {
      setError(err.message || "call.mute_failed");
    }
  }, [basePath, call?.id, roomId]);

  const toggleSpeakRequest = useCallback(async () => {
    if (!roomId || !call?.id) return;
    setError("");
    try {
      const url = callPath(roomId, `/${encodeURIComponent(call.id)}/speak-requests${activeSpeakRequest ? "/me" : ""}`, basePath);
      const payload = await fetch(url, {
        method: activeSpeakRequest ? "DELETE" : "POST"
      }).then(readPayload);
      setCall(payload.call || null);
    } catch (err) {
      setError(err.message || "call.speak_request_failed");
    }
  }, [activeSpeakRequest, basePath, call?.id, roomId]);

  const resolveSpeakRequest = useCallback(async requestId => {
    if (!roomId || !call?.id || !requestId) return;
    setError("");
    try {
      const payload = await fetch(callPath(roomId, `/${encodeURIComponent(call.id)}/speak-requests/${encodeURIComponent(requestId)}/resolve`, basePath), {
        method: "PATCH"
      }).then(readPayload);
      setCall(payload.call || null);
    } catch (err) {
      setError(err.message || "call.speak_resolve_failed");
    }
  }, [basePath, call?.id, roomId]);

  const requestRecordingConsent = useCallback(async ({ purpose, purposeText } = {}) => {
    if (!roomId || !call?.id) return;
    setBusy(true);
    setError("");
    try {
      const payload = await fetch(callPath(roomId, `/${encodeURIComponent(call.id)}/recording/request`, basePath), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, purposeText })
      }).then(readPayload);
      setCall(payload.call || null);
    } catch (err) {
      setError(err.message || "call.recording_request_failed");
    } finally {
      setBusy(false);
    }
  }, [basePath, call?.id, roomId]);

  const respondRecordingConsent = useCallback(async (recordingRequestId, decision) => {
    if (!roomId || !call?.id || !recordingRequestId) return;
    const action = decision === "CONSENTED" ? "consent" : decision === "WITHDRAWN" ? "withdraw" : "decline";
    setBusy(true);
    setError("");
    try {
      const payload = await fetch(callPath(roomId, `/${encodeURIComponent(call.id)}/recording/${encodeURIComponent(recordingRequestId)}/${action}`, basePath), {
        method: "POST"
      }).then(readPayload);
      setCall(payload.call || null);
    } catch (err) {
      setError(err.message || "call.recording_consent_failed");
    } finally {
      setBusy(false);
    }
  }, [basePath, call?.id, roomId]);

  const cancelRecordingRequest = useCallback(async recordingRequestId => {
    if (!roomId || !call?.id || !recordingRequestId) return;
    setBusy(true);
    setError("");
    try {
      const payload = await fetch(callPath(roomId, `/${encodeURIComponent(call.id)}/recording/${encodeURIComponent(recordingRequestId)}/cancel`, basePath), {
        method: "POST"
      }).then(readPayload);
      setCall(payload.call || null);
    } catch (err) {
      setError(err.message || "call.recording_cancel_failed");
    } finally {
      setBusy(false);
    }
  }, [basePath, call?.id, roomId]);

  const startRecording = useCallback(async recordingRequestId => {
    if (!roomId || !call?.id || !recordingRequestId) return;
    setBusy(true);
    setError("");
    try {
      const payload = await fetch(callPath(roomId, `/${encodeURIComponent(call.id)}/recording/${encodeURIComponent(recordingRequestId)}/start`, basePath), {
        method: "POST"
      }).then(readPayload);
      setCall(payload.call || null);
    } catch (err) {
      setError(err.message || "call.recording_start_failed");
    } finally {
      setBusy(false);
    }
  }, [basePath, call?.id, roomId]);

  const stopRecording = useCallback(async recordingRequestId => {
    if (!roomId || !call?.id || !recordingRequestId) return;
    setBusy(true);
    setError("");
    try {
      const payload = await fetch(callPath(roomId, `/${encodeURIComponent(call.id)}/recording/${encodeURIComponent(recordingRequestId)}/stop`, basePath), {
        method: "POST"
      }).then(readPayload);
      setCall(payload.call || null);
    } catch (err) {
      setError(err.message || "call.recording_stop_failed");
    } finally {
      setBusy(false);
    }
  }, [basePath, call?.id, roomId]);

  return {
    call,
    config,
    canModerate,
    joined: joined || Boolean(joinedParticipant),
    micMuted: micMuted || joinedParticipant?.micMuted === true,
    activeSpeakRequest,
    busy,
    error,
    connectionState,
    start,
    join,
    leave,
    end,
    setMuted,
    toggleSpeakRequest,
    resolveSpeakRequest,
    requestRecordingConsent,
    respondRecordingConsent,
    cancelRecordingRequest,
    startRecording,
    stopRecording,
    reload: load
  };
}
