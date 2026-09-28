/* PIN-akna (LoginModal) ja kinnituslingi lehe ühine leping.

   Kui kinnituslink avaneb samas brauseris, kus PIN sisestati, lõpetab
   sisselogimise kinnitusleht (omanik 28.09). Mobiilis magab PIN-i aken taustal
   ja ei saa seda ise teha. Kaks asja peavad seepärast brauseri sees üle minema:

   - PIN-akna valik „jäta seade meelde“, seadme nimi ja sihtleht. Need on ainult
     PIN-aknas ja jõuavad kinnituslehele sama päritolu localStorage'i kaudu. Kui
     neid ei ole, kinnitusleht sisse ei logi ja lõpetamine jääb PIN-aknale.
   - Teade kanalis, et teine aken lõpetab sisselogimist. Kui PIN-aken on ärkvel
     (lauaarvuti), ootab ta selle ära ega hakka sama katset paralleelselt
     lõpetama. Lõpuks laeb ta end sisselogituna uuesti.

   Valikutega kaasas on katse märgis: PIN-akna tokeni algus. Kinnitusleht
   logib sisse ainult siis, kui märgis klapib tema tokeniga. Siis on kindel, et
   selles brauseris sisestati PIN just sellele katsele meie enda lehel. Võõras
   sait küpsist ja localStorage'it koos istutada ei saa. */
export const LOGIN_TAB_CHANNEL = "sotsiaalai-login";
export const LOGIN_HANDOFF_PREFS_KEY = "sotsiaalai:login:handoff";
export const LOGIN_HANDOFF_ATTEMPT_MARKER_LENGTH = 12;

export function loginAttemptMarker(tempLoginToken) {
  return String(tempLoginToken || "").slice(0, LOGIN_HANDOFF_ATTEMPT_MARKER_LENGTH);
}
export const LOGIN_HANDOFF_MESSAGE = Object.freeze({
  finishing: "login-finishing",
  complete: "login-complete",
  failed: "login-handoff-failed"
});
