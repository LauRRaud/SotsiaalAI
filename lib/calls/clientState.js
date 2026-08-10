/**
 * SOL-CALL-11/12/13 — kõnekliendi otsused, mis ei tohi elada hooki sees.
 *
 * MIKS OMAETTE FAIL. Kolm auditileidu elasid kõik `components/rooms/useRoomCall.js`-is:
 * katkenud liitumine jättis mikrofoni ja fantoom-osaluse, teise vahekaardi
 * vaigistusnupp valetas, ja vana ruumi vastus kirjutas uue ruumi vaate üle. Ükski
 * senine värav ei näinud neist ühtegi — testijooksja ei renderda React-hooke ja
 * teenusekihi sviit ei tea pinnast midagi. Sama õppetund tuli JTA E2-st (laua
 * sektsiooni olek): otsus, mis on puhas funktsioon, saab testi ja negatiivkontrolli;
 * otsus, mis elab `useCallback`-i sees, saab ainult tekstivaste.
 *
 * Siin ei ole ühtegi importi ega brauseri-API-d. See on tahtlik: fail peab jooksma
 * nii kliendipaketis kui `node --test` all ilma transformita.
 */

export const MIC_CONTROL_AVAILABLE = "available";
export const MIC_CONTROL_NOT_IN_CALL = "not_in_call";
export const MIC_CONTROL_OTHER_TAB = "other_tab";
export const MIC_CONTROL_NO_AUDIO = "no_audio";

/**
 * Millisel provideril tähendab „vaigista" päris track'i puudutamist. Mock-provideril
 * ei publitseeri brauser midagi — seal ON andmebaasi lipp kogu tõde ja nupp tohib
 * töötada ilma track'ita. LiveKiti puhul on vastupidi: ilma kohaliku track'ita ei ole
 * vaigistusel ühtegi jõustajat, ainult väide.
 */
export function providerNeedsLocalTrack(provider) {
  return String(provider || "").trim().toUpperCase() === "LIVEKIT_SELF_HOSTED";
}

/**
 * SOL-CALL-12 — kes tohib vaigistusnuppu pakkuda.
 *
 * Vana teostus luges „kõnes olemist" nii: `joined || Boolean(serveriosalus)`. See
 * tähendas, et TEISES vahekaardis loodud serveriosalus pani ka selle vahekaardi
 * „liitunud" olekusse, kus mute-klikk kutsus `audioTrackRef.current?.mute?.()` —
 * `null` peal vaikne no-op — ja kirjutas seejärel andmebaasi `micMuted: true`.
 * Inimene nägi kinnitust „mikrofon väljas" samal ajal, kui teine vahekaart heli edasi
 * saatis.
 *
 * Kaks küsimust on nüüd lahus: SERVERIOSALUS (kas ma olen kõnes) ja SELLE VAHEKAARDI
 * PROVIDERIÜHENDUS (kas ma saan mikrofoni siit päriselt juhtida). Nupp kuulub teisele.
 */
export function resolveMicControl({
  provider = "",
  joinedHere = false,
  hasServerParticipant = false,
  audioOwner = false
} = {}) {
  if (!joinedHere) {
    return {
      available: false,
      reason: hasServerParticipant ? MIC_CONTROL_OTHER_TAB : MIC_CONTROL_NOT_IN_CALL
    };
  }
  if (providerNeedsLocalTrack(provider) && !audioOwner) {
    // Liitumine käis siit, aga track'i ei ole: ühendus kukkus või katkes. Vaigistus
    // ilma track'ita oleks sama vale väide, ainult teise põhjusega.
    return { available: false, reason: MIC_CONTROL_NO_AUDIO };
  }
  return { available: true, reason: MIC_CONTROL_AVAILABLE };
}

/**
 * SOL-CALL-13 — kas see vastus tohib veel ekraanile jõuda.
 *
 * `load()` fetchis roomId closure'i alusel ja kirjutas tulemuse ALATI state'i. Ruumi
 * vahetus nullis vaate ja käivitas uue laadimise, aga vana päringut ei katkestanud —
 * ruumi A hiline vastus võis kirjutada ruumi B vaate üle ja (kui callId erines)
 * kutsuda `cleanupLiveKit()`, mis katkestas ruumi B PÄRIS heliühenduse.
 *
 * Kaks tingimust, mitte üks: põlvkond (sama ruumi vana poll ei tohi uuemat üle
 * kirjutada) JA ruumi identiteet (closure'i ruum peab olema see, mida praegu
 * vaadatakse). Ainult põlvkonnast ei piisa, sest ruumi vahetusel võib loendur
 * juhtumisi klappida, kui vahepeal ühtegi uut laadimist ei alustatud.
 */
export function shouldApplyCallSnapshot({
  requestGeneration,
  currentGeneration,
  requestRoomId,
  currentRoomId
} = {}) {
  if (!Number.isFinite(requestGeneration) || !Number.isFinite(currentGeneration)) return false;
  if (requestGeneration !== currentGeneration) return false;
  const requested = String(requestRoomId || "");
  if (!requested) return false;
  return requested === String(currentRoomId || "");
}

/**
 * Kas värske seisupilt tähendab, et meie kohalik ühendus tuleb vabastada. Vastus on
 * „jah" ainult siis, kui me OLIME liitunud ja see kõne on kadunud või asendunud
 * teisega. Ilma esimese tingimuseta koristaks iga tühja vastusega poll ühendust, mida
 * ta ei loonud.
 */
export function shouldReleaseLocalCall({ snapshotCallId, joinedCallId } = {}) {
  const joined = String(joinedCallId || "");
  if (!joined) return false;
  return String(snapshotCallId || "") !== joined;
}
