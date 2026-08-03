export function getCompactRoomTitle(roomTitle) {
  const source = String(roomTitle || "").trim();
  if (!source) return "";

  const withoutLocation = source.split(/\s[-–—]\s/)[0]?.trim() || source;
  const compact = withoutLocation.replace(/\s+(soov|pakkumine)\b.*$/iu, "").trim();

  return compact || withoutLocation || source;
}

function readText(t, key, fallback) {
  if (typeof t !== "function") return fallback;
  try {
    const value = t(key);
    return typeof value === "string" && value && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
}

function roomOriginText(t, origin) {
  const type = String(origin?.type || "").trim().toUpperCase();
  const label = String(origin?.label || "").trim();
  const textByType = {
    MANUAL_INVITE: readText(t, "rooms.origin.manualInvite", "Ruum loodi käsitsi kutse kaudu."),
    PRE_INQUIRY: readText(t, "rooms.origin.preInquiry", "Ruum loodi eelpöördumise järel."),
    HELP_MATCH: readText(t, "rooms.origin.helpMatch", "Ruum loodi abisoovi ja abipakkumise sobituse põhjal."),
    SERVICE_PROVIDER_INQUIRY: readText(t, "rooms.origin.serviceProviderInquiry", "Ruum loodi teenusega seotud pöördumise põhjal."),
    JOURNEY: readText(t, "rooms.origin.journey", "Ruum on seotud Teekonna töövooga, kuid privaatset Teekonda ei jagata automaatselt."),
    UNKNOWN: readText(t, "rooms.origin.unknown", "Ruumil ei ole määratud päritolu.")
  };
  return textByType[type] || label || textByType.UNKNOWN;
}

function shouldShowRoomOriginPrivacy(origin) {
  return ["PRE_INQUIRY", "SERVICE_PROVIDER_INQUIRY", "JOURNEY"].includes(String(origin?.type || "").trim().toUpperCase());
}

export function ChatTopNotices({
  t,
  isRoomMode,
  roomTitle,
  roomOrigin,
  hideRoomTitle = false,
  isCrisis,
  crisisText,
  errorBanner
}) {
  const displayRoomTitle = getCompactRoomTitle(roomTitle);
  // Origin: AINULT privaatsustundlikel ruumidel (nende privaatsusmärge on
  // õiguslikult oluline). MANUAL_INVITE jt "loodi X kaudu" informatiivne tekst
  // eemaldatud — omanik EI taha seda ruumi kohal (23.07).
  const showOriginPrivacy = shouldShowRoomOriginPrivacy(roomOrigin);

  return <>
    {isRoomMode && !hideRoomTitle && displayRoomTitle ? <div className="chat-room-header">
      {displayRoomTitle}
    </div> : null}
    {isRoomMode && roomOrigin && showOriginPrivacy ? <div className="chat-room-origin">
      <span>{roomOriginText(t, roomOrigin)}</span>
      <span> {readText(t, "rooms.origin.privacyNote", "Ruumi liikmed näevad ainult ruumis jagatud infot ja kasutaja kinnitatud eelinfot. Privaatset Teekonda ega assistendivestlust ei jagata automaatselt.")}</span>
    </div> : null}
    {isCrisis ? <div role="alert">
      {crisisText}
    </div> : null}
    {errorBanner ? <div role="alert">
      {errorBanner}
    </div> : null}
  </>;
}

// Kaks eri kanalit tahtlikult: viga on `alert` (katkestab ekraanilugeja),
// kinnitus/hoiatus on `status` (ei katkesta). Katkestuse KINNITUS ei ole
// viga ja teda ei tohi vea toonis esitada (T03 E4).
export function ChatRecordingNotice({
  recordingError,
  voiceNotice,
  floating = false
}) {
  void floating;
  if (!recordingError && !voiceNotice) return null;
  return <>
    {recordingError ? <div role="alert">
      {recordingError}
    </div> : null}
    {voiceNotice ? <div role="status" data-voice-notice="true">
      {voiceNotice}
    </div> : null}
  </>;
}
