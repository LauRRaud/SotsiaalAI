"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import {
  resolveMicControl,
  shouldApplyCallSnapshot,
  shouldReleaseLocalCall
} from "@/lib/calls/clientState";

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
  // Salvestuse nõusolek kirjutatakse serveris SELLES keeles, mida kasutaja
  // parasjagu näeb — seepärast käib liidese keel iga nõusolekupäringuga kaasas.
  // `accept-language` ei kõlba: brauseri keel ja valitud liidese keel lahknevad.
  const { locale } = useI18n();
  const [call, setCall] = useState(null);
  const [config, setConfig] = useState({ provider: "mock", providerAvailable: true, maxParticipants: 8 });
  const [canModerate, setCanModerate] = useState(false);
  const [joined, setJoined] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connectionState, setConnectionState] = useState("idle");
  // SOL-CALL-12: „selles vahekaardis on publitseeritud kohalik heli" on OMAETTE tõde,
  // mitte serveriosaluse tuletis. Ta peab olema state (mitte ref), sest vaigistusnupp
  // sõltub temast ja ref'i muutus ei renderda.
  const [audioOwner, setAudioOwner] = useState(false);
  const roomRef = useRef(null);
  const audioTrackRef = useRef(null);
  const remoteAudioElsRef = useRef(new Map());
  const joinedCallIdRef = useRef("");
  // SOL-CALL-13: iga laadimine saab kasvava numbri ja ainus rakendatav vastus on
  // uusima numbriga oma. `roomIdRef` kannab seda, mida PRAEGU vaadatakse — closure'i
  // roomId on see, mida küsiti.
  const loadGenerationRef = useRef(0);
  const loadAbortRef = useRef(null);
  const roomIdRef = useRef(roomId);

  const activeSpeakRequest = useMemo(() => {
    if (!call || !userId) return null;
    return (call.speakRequests || []).find(request => request.userId === userId && request.status === "ACTIVE") || null;
  }, [call, userId]);

  const joinedParticipant = useMemo(() => {
    if (!call || !userId) return null;
    return (call.participants || []).find(participant => participant.userId === userId && !participant.leftAt) || null;
  }, [call, userId]);

  // SOL-CALL-12: serveriosalus („ma olen kõnes") ja selle vahekaardi provideriühendus
  // („ma saan siit mikrofoni juhtida") on kaks eri küsimust. Vaigistusnupp kuulub
  // teisele; otsus ise elab `lib/calls/clientState.js`-is, et tal oleks test.
  const micControl = useMemo(() => resolveMicControl({
    provider: call?.provider,
    joinedHere: joined,
    hasServerParticipant: Boolean(joinedParticipant),
    audioOwner
  }), [audioOwner, call?.provider, joined, joinedParticipant]);

  const cleanupLiveKit = useCallback(async () => {
    remoteAudioElsRef.current.forEach(element => {
      try {
        element.remove();
      } catch {}
    });
    remoteAudioElsRef.current = new Map();
    const track = audioTrackRef.current;
    audioTrackRef.current = null;
    setAudioOwner(false);
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
    // SOL-CALL-13: number ENNE päringut, kontroll PÄRAST vastust. Korraga on lennus
    // ainult üks laadimine — eelmine katkestatakse, sest tema vastus ei saa enam
    // ühtegi küsimust vastata, millele uuem juba vastab.
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    const requestRoomId = roomId;
    try {
      loadAbortRef.current?.abort?.();
    } catch {}
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    loadAbortRef.current = controller;
    const fresh = () => shouldApplyCallSnapshot({
      requestGeneration: generation,
      currentGeneration: loadGenerationRef.current,
      requestRoomId,
      currentRoomId: roomIdRef.current
    });
    try {
      const payload = await fetch(callPath(requestRoomId, "", basePath), {
        cache: "no-store",
        ...(controller ? { signal: controller.signal } : {})
      }).then(readPayload);
      // Aegunud vastus ei tohi kirjutada state'i EGA koristada ühendust, mille lõi
      // keegi teine — teine pool on see, mis vanas koodis katkestas ruumi B heli.
      if (!fresh()) return;
      setCall(payload.call || null);
      setConfig(payload.config || { provider: "mock", providerAvailable: true, maxParticipants: 8 });
      setCanModerate(payload.canModerate === true);
      setError("");
      if (!payload.call || shouldReleaseLocalCall({
        snapshotCallId: payload.call.id,
        joinedCallId: joinedCallIdRef.current
      })) {
        setJoined(false);
        setMicMuted(false);
        joinedCallIdRef.current = "";
        await cleanupLiveKit();
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      if (!fresh()) return;
      setError(err.message || "call.load_failed");
    }
  }, [basePath, cleanupLiveKit, roomId]);

  // 14 K1: teardown (ruumivahetus, unmount, ligipääsu kadu) peab serverile
  // leave'i saatma, muidu jääb fantoom-osaleja ja viimase lahkuja auto-lõpp
  // ei käivitu. Fire-and-forget: vastus ei huvita, kirje serveris küll.
  const sendLeaveSignal = useCallback((targetRoomId, callSessionId) => {
    if (!targetRoomId || !callSessionId) return;
    const url = callPath(targetRoomId, "/leave", basePath);
    const body = JSON.stringify({ callSessionId });
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        if (navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
      }
    } catch {}
    try {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {});
    } catch {}
  }, [basePath]);

  useEffect(() => {
    // SOL-CALL-13: ruumi vahetus katkestab vana päringu JA aegub tema põlvkonna.
    // Kaks sammu, sest abort ei ole garantii: juba lahendunud fetch jõuab `then`-i
    // ka pärast `abort()`-i, ja siis on ainus kaitse number.
    roomIdRef.current = roomId;
    loadGenerationRef.current += 1;
    try {
      loadAbortRef.current?.abort?.();
    } catch {}
    loadAbortRef.current = null;
    setCall(null);
    setJoined(false);
    setMicMuted(false);
    joinedCallIdRef.current = "";
    void cleanupLiveKit();
    if (!roomId) return undefined;
    void load();
    const timer = setInterval(() => {
      void load();
    }, 5000);
    return () => {
      clearInterval(timer);
      loadGenerationRef.current += 1;
      try {
        loadAbortRef.current?.abort?.();
      } catch {}
      loadAbortRef.current = null;
      const callSessionId = joinedCallIdRef.current;
      joinedCallIdRef.current = "";
      if (callSessionId) sendLeaveSignal(roomId, callSessionId);
    };
  }, [cleanupLiveKit, load, roomId, sendLeaveSignal]);

  useEffect(() => () => {
    void cleanupLiveKit();
  }, [cleanupLiveKit]);

  // Tab'i sulgemine ja kõva navigatsioon ei jooksuta React-cleanup'e —
  // sendBeacon on seal ainus usaldusväärne kanal. Ref'i ei nullita: pagehide
  // võib olla bfcache'i minek; naasel sünkroonib 5 s poll ausa seisu.
  useEffect(() => {
    if (typeof window === "undefined" || !roomId) return undefined;
    const handlePageHide = () => {
      const callSessionId = joinedCallIdRef.current;
      if (callSessionId) sendLeaveSignal(roomId, callSessionId);
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [roomId, sendLeaveSignal]);

  const postAction = useCallback(async (suffix, body = {}) => {
    const payload = await fetch(callPath(roomId, suffix, basePath), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(readPayload);
    if ("call" in payload) setCall(payload.call || null);
    return payload;
  }, [basePath, roomId]);

  const openLiveKitSession = useCallback(async ({ token, url }) => {
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
    // SOL-CALL-12: alles PUBLITSEERITUD track teeb sellest vahekaardist mikrofoni
    // omaniku. Enne seda ei tohi vaigistusnuppu pakkuda — tal ei oleks jõustajat.
    setAudioOwner(true);
    setConnectionState("connected");
  }, []);

  /**
   * SOL-CALL-11 — connect/create/publish on ÜKS fail-closed plokk.
   *
   * Vanas koodis ei olnud selle jada sees ühtegi catch'i: kui `connect()` õnnestus ja
   * `publishTrack()` viskas, jäi juba loodud mikrofoni-track elama (brauseris põleb
   * salvestusmärk) ja LiveKit Room jäi ühendatuks. Väline catch pani ainult
   * veateate — see on nähtav tõrge, mille taga mikrofon töötab edasi.
   */
  const connectLiveKit = useCallback(async ({ token, url }) => {
    if (!token || !url) return;
    try {
      await openLiveKitSession({ token, url });
    } catch (error) {
      await cleanupLiveKit();
      throw error;
    }
  }, [cleanupLiveKit, openLiveKitSession]);

  /**
   * SOL-CALL-11 — katkenud liitumine ei tohi jätta ei mikrofoni ega SERVERIOSALUST.
   *
   * Serveri `/join` (ja `/start`) loob osalusrea ENNE, kui klient providerini jõuab.
   * Kui provider kukub, jääb kasutaja serveri silmis kõnesse: koht on hõivatud,
   * viimase lahkuja auto-lõpp ei käivitu ja salvestuse nõusolekuring ootab inimest,
   * keda kõnes ei ole. Seepärast on liitumis-ID kirjas ENNE providerikutset ja see
   * funktsioon on ainus koht, kus ta maha võetakse.
   */
  const releaseFailedJoin = useCallback(async callSessionId => {
    await cleanupLiveKit();
    setJoined(false);
    setMicMuted(false);
    if (!callSessionId) return;
    if (joinedCallIdRef.current === callSessionId) joinedCallIdRef.current = "";
    try {
      await postAction("/leave", { callSessionId });
    } catch {
      // Serveri leave võib ise kukkuda (võrk, aegunud kõne). Beacon ei oota vastust
      // ega saa siin enam midagi rikkuda — parem üks lisakatse kui fantoom.
      sendLeaveSignal(roomId, callSessionId);
    }
  }, [cleanupLiveKit, postAction, roomId, sendLeaveSignal]);

  const start = useCallback(async () => {
    if (!roomId || busy) return;
    setBusy(true);
    setError("");
    // Serveri `/start` lisab alustaja KOHE HOST-osalejaks, seega osalus on olemas
    // juba enne join'i — ja iga edasine tõrge peab ta maha võtma.
    let claimedCallId = "";
    try {
      const payload = await postAction("/start");
      setCall(payload.call || null);
      if (payload.call?.id) {
        claimedCallId = payload.call.id;
        joinedCallIdRef.current = claimedCallId;
        const joinPayload = await postAction("/join", { callSessionId: payload.call.id });
        setCall(joinPayload.call || null);
        claimedCallId = joinPayload.call?.id || claimedCallId;
        joinedCallIdRef.current = claimedCallId;
        if (joinPayload.call?.provider === "LIVEKIT_SELF_HOSTED") {
          await connectLiveKit({ token: joinPayload.token, url: joinPayload.livekitUrl });
        }
        setJoined(true);
        setMicMuted(false);
      }
    } catch (err) {
      await releaseFailedJoin(claimedCallId);
      setError(err.message || "call.start_failed");
    } finally {
      setBusy(false);
    }
  }, [busy, connectLiveKit, postAction, releaseFailedJoin, roomId]);

  const join = useCallback(async () => {
    if (!roomId || !call?.id || busy) return;
    setBusy(true);
    setError("");
    let claimedCallId = "";
    try {
      const payload = await postAction("/join", { callSessionId: call.id });
      setCall(payload.call || null);
      // SOL-CALL-11: ID kirja ENNE providerit — muidu ei tea ei teardown ega
      // veakäsitlus, millisest kõnest tuleb lahkuda.
      claimedCallId = payload.call?.id || call.id;
      joinedCallIdRef.current = claimedCallId;
      if (payload.call?.provider === "LIVEKIT_SELF_HOSTED") {
        await connectLiveKit({ token: payload.token, url: payload.livekitUrl });
      }
      setJoined(true);
      setMicMuted(false);
    } catch (err) {
      await releaseFailedJoin(claimedCallId);
      setError(err.message || "call.join_failed");
    } finally {
      setBusy(false);
    }
  }, [busy, call?.id, connectLiveKit, postAction, releaseFailedJoin, roomId]);

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

  /**
   * SOL-CALL-12 — vaigistus on käsk provideri poole, mitte kirje andmebaasis.
   *
   * Kaks asja on siin tahtlikult sellises järjekorras. Esiteks: kui see vahekaart
   * mikrofoni ei juhi, EI KIRJUTATA andmebaasi midagi — vana kood tegi `?.mute?.()`
   * `null`-i peal (vaikne no-op) ja kirjutas siis `micMuted: true`, mille peale nii
   * see kasutaja kui kõik teised nägid „mikrofon väljas" ajal, mil teine vahekaart
   * heli edasi saatis. Teiseks: track peab pärast käsku ISE kinnitama uut seisu;
   * alles siis tohib lipp andmebaasi minna. Lipp on vastuse, mitte kavatsuse kirje.
   */
  const setMuted = useCallback(async nextMuted => {
    if (!roomId || !call?.id) return;
    setError("");
    if (!micControl.available) {
      setError("call.mic_not_controlled_here");
      return;
    }
    try {
      const track = audioTrackRef.current;
      if (track) {
        if (nextMuted) await track.mute();
        else await track.unmute();
        if (typeof track.isMuted === "boolean" && track.isMuted !== nextMuted) {
          throw new Error("call.mic_not_applied");
        }
      }
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
  }, [basePath, call?.id, micControl.available, roomId]);

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
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        body: JSON.stringify({ purpose, purposeText })
      }).then(readPayload);
      setCall(payload.call || null);
    } catch (err) {
      setError(err.message || "call.recording_request_failed");
    } finally {
      setBusy(false);
    }
  }, [basePath, call?.id, locale, roomId]);

  const respondRecordingConsent = useCallback(async (recordingRequestId, decision) => {
    if (!roomId || !call?.id || !recordingRequestId) return;
    const action = decision === "CONSENTED" ? "consent" : decision === "WITHDRAWN" ? "withdraw" : "decline";
    setBusy(true);
    setError("");
    try {
      const payload = await fetch(callPath(roomId, `/${encodeURIComponent(call.id)}/recording/${encodeURIComponent(recordingRequestId)}/${action}`, basePath), {
        method: "POST",
        headers: { "x-ui-locale": locale || "et" }
      }).then(readPayload);
      setCall(payload.call || null);
    } catch (err) {
      setError(err.message || "call.recording_consent_failed");
    } finally {
      setBusy(false);
    }
  }, [basePath, call?.id, locale, roomId]);

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
    // Pind peab eristama „olen kõnes" ja „saan siit mikrofoni juhtida" — vt SOL-CALL-12.
    micControl,
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
