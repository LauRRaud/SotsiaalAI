"use client";

import { useState } from "react";

import ChevronIcon from "@/components/brand/icons/ChevronIcon";

const RECORDING_PURPOSE_OPTIONS = [
  ["GENERAL_SUMMARY", "kokkuvõtte koostamine"],
  ["CASE_SUMMARY", "juhtumikokkuvõtte mustand"],
  ["PRE_ASSESSMENT_SUMMARY", "eelpöördumise kokkuvõte"],
  ["STAR_HELPER", "STAR-i sisestamise abimaterjal"],
  ["COVISION_SUMMARY", "kovisiooni kokkuvõte"],
  ["MENTORING_SUMMARY", "mentorluskohtumise kokkuvõte"],
  ["OTHER", "muu eesmärk"]
];

function text(t, key, fallback, values = undefined) {
  if (typeof t !== "function") return fallback;
  return values ? t(key, values, fallback) : t(key, fallback);
}

function pluralSpeak(t, count) {
  if (count === 1) return text(t, "calls.speak.one", "1 soovib sõna");
  return text(t, "calls.speak.many", `${count} soovivad sõna`, { count });
}

// E5b (5 K4): salvestuse staatusesildid võti+keel taha — varem kõvakodeeritud ET,
// nüüd renderdatakse i18n-võtmest (fallback jääb ET-ks turvavõrguks).
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
  return "";
}

// E5b (4 K5): salvestuse eesmärgi silt võti+keel taha. Standardeesmärgid tulevad
// i18n-võtmest; OTHER vabatekst jääb kasutaja sisestatud kujul (ei tõlgita).
function resolveRecordingPurposeLabel(t, recording) {
  if (!recording) return "";
  const purpose = String(recording.purpose || "GENERAL_SUMMARY").trim();
  if (purpose === "OTHER" && recording.purposeText) return recording.purposeText;
  return text(t, `calls.recording_purpose_${purpose.toLowerCase()}`, recording.purposeLabel || "");
}

// 14 K1: riba on puhas esitlus — useRoomCall'i omanik on leht (ChatBody), kes
// annab hoogi tagastuse `session` propina. Nii ei katkesta näovahetus (töölaud/
// profiil), mis selle komponendi unmount'ib, LiveKit-ühendust ega polli.
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
  const [expanded, setExpanded] = useState(false);
  const [recordingPurpose, setRecordingPurpose] = useState("GENERAL_SUMMARY");
  const [recordingPurposeText, setRecordingPurposeText] = useState("");

  if (!roomId || !session) return null;

  const {
    call,
    config,
    canModerate,
    joined,
    micMuted,
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
  const isMock = config.provider === "mock";

  return (
    <section aria-label="Helikõne">
      <div>
        <div>
          <div>
          {call ? text(t, "calls.active", "Helikõne aktiivne") : text(t, "calls.title", "Helikõne")}
          </div>
          <div>
            {unavailable
              ? text(t, "calls.not_configured", "Helikõne teenus ei ole veel seadistatud.")
              : call
                ? `${participants.length}/${call.maxParticipants || config.maxParticipants || 8} ${text(t, "calls.participants_short", "osalejat")}${speakCount ? `, ${pluralSpeak(t, speakCount)}` : ""}${recordingStatus ? `, ${recordingStatus}` : ""}`
                : text(t, "calls.start_audio", "Alusta helikõnet")}
            {isMock && process.env.NODE_ENV === "development" ? ` · ${text(t, "calls.mock_mode", "mock mode")}` : ""}
          </div>
        </div>

        {!call ? (
          <button type="button" onClick={start} disabled={busy || unavailable}>
            <span>{text(t, "calls.start", "Alusta")}</span>
          </button>
        ) : joined ? (
          <>
            <button type="button" onClick={() => setMuted(!micMuted)} disabled={busy}>
              <span>{micMuted ? text(t, "calls.mic_off", "Mikrofon väljas") : text(t, "calls.mic_on", "Mikrofon sees")}</span>
            </button>
            <button type="button" onClick={toggleSpeakRequest} disabled={busy}>
              <span>{activeSpeakRequest ? text(t, "calls.cancel_short", "Tühista") : text(t, "calls.request_to_speak", "Soovin sõna")}</span>
            </button>
            <button type="button" onClick={leave} disabled={busy}>
              <span>{text(t, "calls.leave", "Lahku")}</span>
            </button>
          </>
        ) : (
          <button type="button" onClick={join} disabled={busy || unavailable}>
            <span>{text(t, "calls.join", "Liitu")}</span>
          </button>
        )}

        {call ? (
          <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
            <ChevronIcon direction={expanded ? "up" : "down"} width={12} height={7} />
            <span className="sr-only">{text(t, "calls.open_details", "Ava helikõne detailid")}</span>
          </button>
        ) : null}
      </div>

      {error ? (
        <div>
          {error === "call.livekit_not_configured" ? text(t, "calls.not_configured", "Helikõne teenus ei ole veel seadistatud.") : error}
        </div>
      ) : null}

      {joined && connectionState && connectionState !== "idle" && connectionState !== "connected" ? (
        <div>
          {text(t, "calls.connection", "Ühendus")}: {connectionState}
        </div>
      ) : null}

      {recordingControlsEnabled && recording?.status === "REQUESTED" ? (
        <div>
          {text(t, "calls.recording_consent_pending", "Salvestamise nõusolekut küsitakse")} · {recordingStatus}
        </div>
      ) : null}

      {recordingControlsEnabled && recording?.status === "DECLINED" ? (
        <div>
          {text(t, "calls.recording_declined", "Salvestamist ei alustatud, sest kõik osapooled ei nõustunud.")}
        </div>
      ) : null}

      {recordingControlsEnabled && recording?.status === "READY_TO_RECORD" ? (
        <div>
          {text(t, "calls.recording_ready", "Salvestus on valmis käivitamiseks")}
        </div>
      ) : null}

      {recordingControlsEnabled && recording?.status === "ACTIVE" ? (
        <div>
          {text(t, "calls.recording_active", "Salvestamine käib")}
        </div>
      ) : null}

      {recordingControlsEnabled && recording?.status === "COMPLETED" ? (
        <div>
          {text(t, "calls.recording_completed", "Salvestamine lõpetati")}
        </div>
      ) : null}

      {recordingControlsEnabled && recording?.status === "FAILED" ? (
        <div>
          {text(t, "calls.recording_failed", "Salvestus ebaõnnestus")}
        </div>
      ) : null}

      {recordingControlsEnabled && showConsentDialog ? (
        <div>
          <p>{text(t, "calls.recording_consent_intro", `${requesterName} soovib selle helikõne salvestada.`, { requesterName })}</p>
          <p>{text(t, "calls.recording_consent_purpose", `Salvestust kasutatakse ainult märgitud eesmärgil: ${recordingPurposeShown}.`, { recordingPurpose: recordingPurposeShown })}</p>
          <p>
            {text(t, "calls.recording_consent_body", "Salvestus võib sisaldada isikuandmeid või tundlikku infot. Salvestus tehakse kättesaadavaks ainult õigustatud kasutajatele SotsiaalAI dokumentide vaates. Salvestust ei transkribeerita ega kasutata kokkuvõtte koostamiseks automaatselt; need tegevused käivitatakse eraldi kasutaja toiminguna.")}
          </p>
          <p>{text(t, "calls.recording_consent_question", "Kas nõustud selle kõne salvestamisega?")}</p>
          <div>
            <button type="button" disabled={busy} onClick={() => respondRecordingConsent(recording.id, "CONSENTED")}>
              {text(t, "calls.recording_consent_yes", "Nõustun salvestamisega")}
            </button>
            <button type="button" disabled={busy} onClick={() => respondRecordingConsent(recording.id, "DECLINED")}>
              {text(t, "calls.recording_consent_no", "Ei nõustu")}
            </button>
          </div>
        </div>
      ) : null}

      {expanded && call ? (
        <div>
          <div>
            <div>{text(t, "calls.participants", "Osalejad")}</div>
            <div>
              {participants.length ? participants.map(participant => (
                <div key={participant.id || participant.userId}>
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
          </div>

          <div>
            <div>{text(t, "calls.speak_requests", "Sõnasoovid")}</div>
            <div>
              {speakRequests.length ? speakRequests.map((request, index) => (
                <div key={request.id}>
                  <span>{index + 1}. {request.displayName || text(t, "calls.participant", "Osaleja")}</span>
                  {canModerate ? (
                    <button type="button" onClick={() => resolveSpeakRequest(request.id)}>
                      <span>{text(t, "calls.resolve", "Lahenda")}</span>
                    </button>
                  ) : null}
                </div>
              )) : (
                <div>{text(t, "calls.no_speak_requests", "Sõnasoove pole.")}</div>
              )}
            </div>
            {canModerate ? (
              <button type="button" onClick={end} disabled={busy}>
                <span>{text(t, "calls.end", "Lõpeta kõne")}</span>
              </button>
            ) : null}
          </div>

          <div>
            {!recordingControlsEnabled ? (
              <span>
                {text(
                  t,
                  contextType === "COVISION" ? "covision.room.audio_no_recording" : "calls.covision_no_recording",
                  "Kovisiooni helivestlust ei salvestata, ei transkribeerita ja heli ei saadeta AI-le."
                )}
              </span>
            ) : null}
            {recordingControlsEnabled ? (
              <>
            <span>{text(t, "calls.recording_notice", "Kõne ei salvestu vaikimisi. Salvestamine vajab kõigi nõutud osapoolte nõusolekut.")}</span>
            {recording ? (
              <div>
                <span>{recordingStatus || recording.status}</span>
                <span>{text(t, "calls.recording_purpose", "Eesmärk")}: {recordingPurposeShown}</span>
                {recording.consents?.length ? (
                  <div>
                    {recording.consents.map(consent => (
                      <span key={consent.id || consent.userId}>
                        {(consent.displayName || text(t, "calls.participant", "Osaleja"))}: {consent.status}
                      </span>
                    ))}
                  </div>
                ) : null}
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
                {/* E5b (5 K1 c): iga nõustunud osaleja saab ACTIVE ajal nõusoleku
                    tagasi võtta — server peatab egress'i ja kustutab seni salvestatu. */}
                {myRecordingConsent?.status === "CONSENTED" && recording.status === "ACTIVE" ? (
                  <div>
                    <button type="button" disabled={busy} onClick={() => respondRecordingConsent(recording.id, "WITHDRAWN")}>
                      {text(t, "calls.recording_withdraw", "Võta nõusolek tagasi")}
                    </button>
                    <span>{text(t, "calls.recording_withdraw_hint", "Salvestus peatub ja seni salvestatu kustutatakse.")}</span>
                  </div>
                ) : null}
              </div>
            ) : canModerate ? (
              <div>
                <select
                  value={recordingPurpose}
                  onChange={event => setRecordingPurpose(event.target.value)}
                >
                  {RECORDING_PURPOSE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <input
                  value={recordingPurposeText}
                  onChange={event => setRecordingPurposeText(event.target.value)}
                  placeholder={text(t, "calls.recording_purpose_text", "Eesmärgi täpsustus")}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => requestRecordingConsent({ purpose: recordingPurpose, purposeText: recordingPurposeText })}
                >
                  <span>{text(t, "calls.request_recording_consent", "Taotle salvestamise nõusolekut")}</span>
                </button>
              </div>
            ) : (
              <span>{text(t, "calls.recording_moderator_only", "Salvestamise nõusolekut saab küsida host või moderaator.")}</span>
            )}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
