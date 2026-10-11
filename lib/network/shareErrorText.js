/**
 * Võrgustikujagamise keeldumine sõnadega.
 *
 * Jagamise marsruudid vastavad keeldumisel koodiga (`network_share.not_editable`),
 * mitte lausega. Vaated lahendasid selle üldise abilisega, mis tagastas koodi enda,
 * ja töötaja nägi ekraanil toorest koodi. Siin on kood → lause: lause on tõlgetes
 * `network_share.errors.<kood>` all.
 *
 * Tundmatu kood, võõras tekst ja puuduv tõlge annavad varuteksti: serveri sõnumit
 * ennast ekraanile ei lasta.
 */
const SHARE_CODE = /^network_share\.([a-z0-9_]+)$/;
const COMMON_KEY = /^api\.common\.[a-z0-9_]+$/;

export function networkShareErrorText(t, message, fallback) {
  const code = typeof message === "string" ? message.trim() : "";
  const match = SHARE_CODE.exec(code);
  const key = match ? `network_share.errors.${match[1]}` : COMMON_KEY.test(code) ? code : "";
  if (!key || typeof t !== "function") return fallback;
  const text = t(key);
  return typeof text === "string" && text.trim() && text !== key ? text : fallback;
}
