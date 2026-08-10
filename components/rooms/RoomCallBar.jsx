"use client";

import { useState } from "react";

import ChevronIcon from "@/components/brand/icons/ChevronIcon";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";

// Eesti tekst on ainult varuväärtus. Sildid tulevad `calls.recording_purpose_*`
// võtmetest — samadest, millest server ehitab salvestatava nõusolekuteksti, et
// valitud eesmärk oleks rippmenüüs ja nõusolekukirjes sama sõnastusega.
const RECORDING_PURPOSE_OPTIONS = [
  ["GENERAL_SUMMARY", "kokkuvõtte koostamine"],
  ["CASE_SUMMARY", "juhtumikokkuvõtte mustand"],
  ["PRE_ASSESSMENT_SUMMARY", "eelpöördumise kokkuvõte"],
  ["STAR_HELPER", "STAR-i sisestamise abimaterjal"],
  ["COVISION_SUMMARY", "kovisiooni kokkuvõte"],
  ["MENTORING_SUMMARY", "mentorluskohtumise kokkuvõte"],
  ["OTHER", "muu eesmärk"]
];

function recordingPurposeOptions(t) {
  return RECORDING_PURPOSE_OPTIONS.map(([value, fallback]) => ({
    value,
    label: text(t, `calls.recording_purpose_${value.toLowerCase()}`, fallback)
  }));
}

function text(t, key, fallback, values = undefined) {
  if (typeof t !== "function") return fallback;
  return values ? t(key, values, fallback) : t(key, fallback);
}

function pluralSpeak(t, count) {
  if (count === 1) return text(t, "calls.speak.one", "1 soovib sõna");
  return text(t, "calls.speak.many", `${count} soovivad sõna`, { count });
}

function recordingStatusText(t, recording) {
  if (!recording) return "";
  if (recording.status === "DECLINED") return text(t, "calls.recording_status_declined", "Salvestamist ei alustatud");
  if (recording.status === "READY_TO_RECORD") return text(t, "calls.recording_status_ready", "Salvestus on valmis käivitamiseks");
  if (recording.status === "ACTIVE") return text(t, "calls.recording_status_active", "Salvestamine käib");
  if (recording.status === "COMPLETED") return text(t, "calls.recording_status_completed", "Salvestamine lõpetati");
  if (recording.status === "FAILED") return text(t, "calls.recording_status_failed", "Salvestus ebaõnnestus");
  if (recording.status === "REQUESTED") {
    const consented = recording.consentedCount || 0;
    const required = recording.requiredCount || 0;
    return text(t, "calls.recording_status_requested", `Ootame nõusolekuid: ${consented}/${required}`, { consented, required });
  }
  if (recording.status === "STOPPED") return text(t, "calls.recording_status_stopped", "Salvestamise taotlus tühistati");
  /* SOL-CALL-01 — kinnitamata peatumine peab olema NÄHTAV. Kui need kaks siit puuduks,
     langeks salvestus tagasi tühja stringi peale ja riba ei ütleks midagi täpselt sel
     hetkel, mil inimene peab teadma, et mikrofon ei pruugi veel vaikida. */
  if (recording.status === "STARTING") return text(t, "calls.recording_status_starting", "Käivitame salvestust…");
  if (recording.status === "STOPPING") return text(t, "calls.recording_status_stopping", "Peatame salvestust…");
  if (recording.status === "STOP_FAILED") {
    return text(t, "calls.recording_status_stop_failed", "Salvestuse peatumine ei ole kinnitatud — kontrollime");
  }
  return "";
}

function resolveRecordingPurposeLabel(t, recording) {
  if (!recording) return "";
  const purpose = String(recording.purpose || "GENERAL_SUMMARY").trim();
  if (purpose === "OTHER" && recording.purposeText) return recording.purposeText;
  return text(t, `calls.recording_purpose_${purpose.toLowerCase()}`, recording.purposeLabel || "");
}

/* Glüüfide MÕÕT elab CSS-is (.room-call-controls, chat.css), mitte siin:
   need ikoonid seisavad composeri mikri ja saada-noole kõrval samas reas ja
   peavad nendega ühte kaalu olema — ruumikestas kasvavad naabrid 1.5rem →
   2rem ja need pidid kasvama koos (omanik 26.07: "kuidagi väikesed
   ikoonid"). Atribuut on ainult mõistlik varuväärtus, kui CSS-i pole.
   Joone paksus tuleb samuti CSS-ist, et suuremas mõõdus ei muutuks glüüf
   tikuks — composeri mask-glüüfid teevad sedasama. */
function PhoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6.4 3.5h2.9l1.3 3.25-1.65 1.25a11 11 0 0 0 5 5l1.25-1.65 3.25 1.3v2.9a1.55 1.55 0 0 1-1.7 1.55A15.2 15.2 0 0 1 4.95 5.2 1.55 1.55 0 0 1 6.4 3.5z" />
    </svg>
  );
}

function MicGlyph({ muted }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.6" />
      {muted ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

// 14 K1: riba on puhas esitlus — useRoomCall'i omanik on leht (ChatBody), kes
// annab hoogi tagastuse `session` propina. 23.07 (omanik): endine "riba" asendatud
// KOMPAKTSE ikoon-kontrolliga composeri ikoonireas — 📞 lüliti (alusta/liitu =
// sama, uuesti = lahku), + vaigista + "kõne detailid" (▾) popover kui kõnes.
export default function RoomCallBar({
  roomId,
  userId,
  isLightTheme: _isLightTheme,
  t,
  session,
  contextType = "ROOM",
  allowRecordingControls = true,
  recordingAllowed = true
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [recordingPurpose, setRecordingPurpose] = useState("GENERAL_SUMMARY");
  const [recordingPurposeText, setRecordingPurposeText] = useState("");

  if (!roomId || !session) return null;

  const {
    call,
    config,
    canModerate,
    joined,
    micMuted,
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
    stopRecording
  } = session;

  const unavailable = config.provider === "livekit" && config.providerAvailable === false;
  const participants = call?.participants || [];
  const speakRequests = call?.speakRequests || [];
  const recording = call?.recording || null;
  const recordingControlsEnabled = allowRecordingControls && recordingAllowed && call?.recordingAllowed !== false && contextType !== "COVISION";
  const requesterName = recording?.requesterName || text(t, "calls.recording_requester_fallback", "Kõne osaleja");
  const myRecordingConsent = recording?.myConsent || (recording?.consents || []).find(consent => consent.userId === userId) || null;
  const showConsentDialog = joined && recording?.status === "REQUESTED" && myRecordingConsent?.status === "REQUESTED";
  const recordingStatus = recordingStatusText(t, recording);
  const recordingPurposeShown = resolveRecordingPurposeLabel(t, recording);
  const speakCount = speakRequests.length;

  const inCall = joined;
  /* SOL-CALL-12: nupp, mis ei jõua mikrofonini, ei tohi olla vajutatav. Serveriosalus
     võib tulla teisest vahekaardist (või olla üle elanud lehe taaslaadimise) — siis on
     see riba kõnes, aga mikrofon on mujal. Vaikne no-op oli vanas koodis kõige
     halvem variant: inimene vajutas, liides kinnitas ja heli läks edasi. */
  const micControlBlocked = inCall && micControl?.available === false;
  const micBlockedTitle = micControl?.reason === "no_audio"
    ? text(t, "calls.mic_control_no_audio", "Mikrofon ei ole selles vahekaardis ühendatud")
    : text(t, "calls.mic_control_other_tab", "Mikrofoni juhib see vahekaart, kust kõnega liituti");
  const micTitle = micControlBlocked
    ? micBlockedTitle
    : micMuted
      ? text(t, "calls.mic_off", "Mikrofon väljas")
      : text(t, "calls.mic_on", "Mikrofon sees");
  // "Alusta" = "Liitu" (omanik 23.07): kõne olemas → liitu; kõnet pole → alusta;
  // kõnes → lahku (host jaoks lõpetab, kui viimane).
  const handleToggle = () => {
    if (busy || unavailable) return;
    if (inCall) leave();
    else if (call) join();
    else start();
  };
  const toggleTitle = unavailable
    ? text(t, "calls.not_configured", "Helikõne teenus ei ole veel seadistatud.")
    : inCall
      ? text(t, "calls.leave", "Lahku")
      : call
        ? text(t, "calls.join", "Liitu")
        : text(t, "calls.start_audio", "Alusta helikõnet");
  // Salvestuse nõusolekut küsitakse → detailinupul märge (ja popover avaneb).
  const needsAttention = showConsentDialog;
  const showDetails = inCall && (detailsOpen || needsAttention);

  return (
    <div className="room-call-controls">
      <button
        type="button"
        className="room-call-icon"
        data-active={inCall ? "true" : undefined}
        onClick={handleToggle}
        disabled={busy || unavailable}
        title={toggleTitle}
        aria-label={toggleTitle}
        aria-pressed={inCall ? "true" : "false"}
      >
        <PhoneGlyph />
      </button>

      {inCall ? (
        <>
          <button
            type="button"
            className="room-call-mute"
            data-muted={micMuted ? "true" : undefined}
            data-mic-elsewhere={micControlBlocked ? "true" : undefined}
            onClick={() => setMuted(!micMuted)}
            disabled={busy || micControlBlocked}
            title={micTitle}
            aria-label={micTitle}
            aria-pressed={micMuted ? "true" : "false"}
          >
            <MicGlyph muted={micMuted} />
          </button>
          <button
            type="button"
            className="room-call-details-btn"
            data-badge={needsAttention ? "true" : undefined}
            onClick={() => setDetailsOpen(value => !value)}
            aria-expanded={showDetails}
            title={text(t, "calls.open_details", "Ava helikõne detailid")}
            aria-label={text(t, "calls.open_details", "Ava helikõne detailid")}
          >
            <ChevronIcon direction={showDetails ? "down" : "up"} width={14} height={8} strokeWidth={1.35} />
          </button>
        </>
      ) : null}

      {showDetails ? (
        <div className="room-call-details" role="dialog" aria-label={text(t, "calls.active", "Helikõne aktiivne")}>
          <div className="room-call-details-status">
            {call
              ? `${participants.length}/${call.maxParticipants || config.maxParticipants || 8} ${text(t, "calls.participants_short", "osalejat")}${speakCount ? `, ${pluralSpeak(t, speakCount)}` : ""}${recordingStatus ? `, ${recordingStatus}` : ""}`
              : ""}
          </div>

          {error ? (
            <div className="room-call-error">
              {error === "call.livekit_not_configured"
                ? text(t, "calls.not_configured", "Helikõne teenus ei ole veel seadistatud.")
                : error === "call.mic_not_controlled_here"
                  ? micBlockedTitle
                  : error}
            </div>
          ) : null}

          {joined && connectionState && connectionState !== "idle" && connectionState !== "connected" ? (
            <div>{text(t, "calls.connection", "Ühendus")}: {connectionState}</div>
          ) : null}

          {/* SOL-CALL-12: kinni nupp ilma põhjuseta on omaette viga — inimene peab
              teadma, KUS mikrofon on, mitte ainult seda, et siin ta ei tööta. */}
          {micControlBlocked ? (
            <div className="room-call-mic-elsewhere">{micBlockedTitle}</div>
          ) : null}

          <div className="room-call-actions-row">
            <button type="button" onClick={toggleSpeakRequest} disabled={busy}>
              {activeSpeakRequest ? text(t, "calls.cancel_short", "Tühista") : text(t, "calls.request_to_speak", "Soovin sõna")}
            </button>
            {canModerate ? (
              <button type="button" onClick={end} disabled={busy}>
                {text(t, "calls.end", "Lõpeta kõne")}
              </button>
            ) : null}
          </div>

          {recordingControlsEnabled && showConsentDialog ? (
            <div className="room-call-consent">
              <p>{text(t, "calls.recording_consent_intro", `${requesterName} soovib selle helikõne salvestada.`, { requesterName })}</p>
              <p>{text(t, "calls.recording_consent_purpose", `Salvestust kasutatakse ainult märgitud eesmärgil: ${recordingPurposeShown}.`, { recordingPurpose: recordingPurposeShown })}</p>
              <p>{text(t, "calls.recording_consent_body", "Salvestus võib sisaldada isikuandmeid või tundlikku infot. Salvestus tehakse kättesaadavaks ainult õigustatud kasutajatele SotsiaalAI dokumentide vaates. Salvestust ei transkribeerita ega kasutata kokkuvõtte koostamiseks automaatselt; need tegevused käivitatakse eraldi kasutaja toiminguna.")}</p>
              <p>{text(t, "calls.recording_consent_question", "Kas nõustud selle kõne salvestamisega?")}</p>
              <div className="room-call-actions-row">
                <button type="button" disabled={busy} onClick={() => respondRecordingConsent(recording.id, "CONSENTED")}>
                  {text(t, "calls.recording_consent_yes", "Nõustun salvestamisega")}
                </button>
                <button type="button" disabled={busy} onClick={() => respondRecordingConsent(recording.id, "DECLINED")}>
                  {text(t, "calls.recording_consent_no", "Ei nõustu")}
                </button>
              </div>
            </div>
          ) : null}

          <div className="room-call-section">
            <div className="room-call-section-title">{text(t, "calls.participants", "Osalejad")}</div>
            {participants.length ? participants.map(participant => (
              <div key={participant.id || participant.userId} className="room-call-participant">
                <span>{participant.displayName || text(t, "calls.participant", "Osaleja")}</span>
                <span>
                  {participant.micMuted ? text(t, "calls.mic_off", "Mikrofon väljas") : text(t, "calls.mic_on", "Mikrofon sees")}
                  {" · "}
                  {participant.role === "HOST" ? text(t, "calls.host", "host") : text(t, "calls.participant_lower", "osaleja")}
                </span>
              </div>
            )) : (
              <div>{text(t, "calls.no_participants", "Osalejaid pole.")}</div>
            )}
          </div>

          {speakRequests.length ? (
            <div className="room-call-section">
              <div className="room-call-section-title">{text(t, "calls.speak_requests", "Sõnasoovid")}</div>
              {speakRequests.map((request, index) => (
                <div key={request.id} className="room-call-participant">
                  <span>{index + 1}. {request.displayName || text(t, "calls.participant", "Osaleja")}</span>
                  {canModerate ? (
                    <button type="button" onClick={() => resolveSpeakRequest(request.id)} disabled={busy}>
                      {text(t, "calls.resolve", "Lahenda")}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {recordingControlsEnabled ? (
            <div className="room-call-section">
              <span>{text(t, "calls.recording_notice", "Kõne ei salvestu vaikimisi. Salvestamine vajab kõigi nõutud osapoolte nõusolekut.")}</span>
              {recording ? (
                <div className="room-call-recording">
                  <span>{recordingStatus || recording.status}</span>
                  <span>{text(t, "calls.recording_purpose", "Eesmärk")}: {recordingPurposeShown}</span>
                  {canModerate && ["REQUESTED", "READY_TO_RECORD"].includes(recording.status) ? (
                    <button type="button" disabled={busy} onClick={() => cancelRecordingRequest(recording.id)}>
                      {text(t, "calls.recording_cancel", "Tühista salvestamise taotlus")}
                    </button>
                  ) : null}
                  {canModerate && recording.status === "READY_TO_RECORD" ? (
                    <button type="button" disabled={busy} onClick={() => startRecording(recording.id)}>
                      {text(t, "calls.recording_start", "Alusta salvestamist")}
                    </button>
                  ) : null}
                  {canModerate && recording.status === "ACTIVE" ? (
                    <button type="button" disabled={busy} onClick={() => stopRecording(recording.id)}>
                      {text(t, "calls.recording_stop", "Lõpeta salvestamine")}
                    </button>
                  ) : null}
                  {myRecordingConsent?.status === "CONSENTED" && recording.status === "ACTIVE" ? (
                    <button type="button" disabled={busy} onClick={() => respondRecordingConsent(recording.id, "WITHDRAWN")}>
                      {text(t, "calls.recording_withdraw", "Võta nõusolek tagasi")}
                    </button>
                  ) : null}
                </div>
              ) : canModerate ? (
                <div className="room-call-recording">
                  <Dropdown
                    value={recordingPurpose}
                    onChange={setRecordingPurpose}
                    ariaLabel={text(t, "calls.recording_purpose", "Salvestamise eesmärk")}
                    options={recordingPurposeOptions(t)}
                  />
                  <Input
                    value={recordingPurposeText}
                    onChange={event => setRecordingPurposeText(event.target.value)}
                    placeholder={text(t, "calls.recording_purpose_text", "Eesmärgi täpsustus")}
                  />
                  <button type="button" disabled={busy} onClick={() => requestRecordingConsent({ purpose: recordingPurpose, purposeText: recordingPurposeText })}>
                    {text(t, "calls.request_recording_consent", "Taotle salvestamise nõusolekut")}
                  </button>
                </div>
              ) : (
                <span>{text(t, "calls.recording_moderator_only", "Salvestamise nõusolekut saab küsida host või moderaator.")}</span>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
