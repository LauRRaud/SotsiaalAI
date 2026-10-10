/**
 * Kõne tõrke tekst inimesele.
 *
 * Kõne marsruudid vastavad tõrke korral koodiga (`call.participants_full`,
 * `api.common.subscription_required`): `callError` paneb sama koodi nii väljale `messageKey`
 * kui ka väljale `message`. Kõneriba näitas seda koodi otse; lause oli ainult kolmel koodil.
 * Inimene nägi keset kõnet ekraanil „call.not_active".
 *
 * Reegel: ekraanile läheb lause. Kood tõlgitakse; kui koodil oma lauset ei ole, näidatakse
 * üldist kõne tõrke lauset. Sisemised koodid (salvestusteenuse ajalõpud, seadistuse vead)
 * oma lauset ei saagi: inimesel ei ole nendega midagi teha peale uuesti proovimise.
 */

/* Võtme kuju: väiketähega algav punktidega tee ilma tühikuteta. */
const KEY_SHAPE = /^[a-z][a-z0-9_]*(?:\.[A-Za-z0-9_]+)+$/;

/* Koodid, mille lause on kataloogis juba teise nime all. Kaks mahupiiri on meelega eri
   lausega (SOL-CALL-10): „ruumi ei ole" ja „salvestis jäi liiga pikaks" nõuavad inimeselt
   eri tegevust. */
const DIRECT = Object.freeze({
  "call.livekit_not_configured": "calls.not_configured",
  "call.recording_storage_quota_exceeded": "calls.recording_storage_quota_exceeded",
  "call.recording_too_large": "calls.recording_too_large",
  "call.recording_roster_changed": "calls.recording_roster_changed",
  "call.recording_stop_unconfirmed": "calls.recording_stop_unconfirmed"
});

function sentence(t, key) {
  if (typeof t !== "function" || !key) return "";
  const text = t(key);
  return typeof text === "string" && text.trim() && text !== key ? text : "";
}

/**
 * @param {string} error kõne tõrke kood või juba valmis lause
 * @param {(key: string) => string} t tõlkija
 * @returns {string} lause; tühi ainult siis, kui tõrget ei olnud
 */
export function callErrorText(error, t) {
  const value = String(error || "").trim();
  if (!value) return "";
  /* Lause serverilt läheb edasi nagu on. */
  if (!KEY_SHAPE.test(value)) return value;
  const own = value.startsWith("call.") ? `calls.errors.${value.slice("call.".length)}` : value;
  return sentence(t, DIRECT[value]) || sentence(t, own) || sentence(t, "calls.errors.generic");
}
