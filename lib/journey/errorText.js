/**
 * Teekonna veateade inimesele.
 *
 * Teekonna API vastab veavõtmega (`journeys.errors.conflict`), mitte lausega.
 * Lehed panid selle võtme otse ekraanile: kui kahes aknas muudeti sama Teekonda,
 * luges inimene „journeys.errors.conflict". Siin tõlgitakse võti lauseks; tundmatu
 * võti ja kõik muu, mis ei ole võti, annab lehe enda üldise teate. Serveri teksti,
 * mida me ei tunne, inimesele ei näidata.
 */
const ERROR_KEY = /^(?:journeys\.errors|api\.common)\.[a-z0-9_]+$/;

export function journeyErrorText(t, message, fallback) {
  const key = typeof message === "string" ? message.trim() : "";
  if (!ERROR_KEY.test(key)) return fallback;
  const text = t(key, fallback);
  return typeof text === "string" && text && text !== key ? text : fallback;
}
