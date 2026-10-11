/**
 * API vastuse sõnum inimesele näitamiseks.
 *
 * Marsruudid vastavad kolmel moel: `messageKey` (tõlkevõti) koos lausega või ilma,
 * `message` lausena, või `message` VÕTMENA ilma `messageKey`-ta (nt
 * `network_share.not_editable`, `journeys.errors.archived`). Viimasel juhul tagastas
 * see abiline varem sõnumi enda ja inimene nägi ekraanil toorest võtit.
 *
 * Reegel: ekraanile läheb lause. Võtme kujuga sõnum tõlgitakse; kui tõlget ei ole,
 * kasutatakse varuteksti. Toores võti jõuab ekraanile ainult siis, kui tõlkijat ega
 * ühtegi varuteksti ei ole üldse olemas.
 *
 * Lause kohatäited (`kuni {limit} rida`) täidetakse vastuse `details` väljalt. Ilma
 * selleta nägi inimene ekraanil toorest `{limit}`: server saatis arvu kaasa, aga
 * siin ei andnud seda keegi tõlkijale edasi.
 */

/* Võtme kuju: väiketähega algav punktidega tee ilma tühikuteta (`api.common.forbidden`).
   Lauses on tühik või see ei sisalda punkti keset sõna; lõpupunktiga üksik sõna ei sobi. */
const KEY_SHAPE = /^[a-z][a-z0-9_]*(?:\.[A-Za-z0-9_]+)+$/;

const DETAIL_TEXT_MAX = 80;

/** Ainult arvud ja lühikesed tekstid: objekt või pikk tekst lausesse ei lähe. */
function detailVars(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  const vars = {};
  for (const [name, value] of Object.entries(details)) {
    if (typeof value === "number" && Number.isFinite(value)) vars[name] = value;
    else if (typeof value === "string" && value.length <= DETAIL_TEXT_MAX && !/[{}]/.test(value)) vars[name] = value;
  }
  return Object.keys(vars).length ? vars : undefined;
}

function translated(t, key, vars) {
  if (typeof t !== "function" || !key) return "";
  const text = vars ? t(key, vars) : t(key);
  return typeof text === "string" && text.trim() && text !== key ? text : "";
}

export function resolveApiMessage({
  payload,
  t,
  fallbackKey,
  fallbackText = ""
}) {
  const key = typeof payload?.messageKey === "string" ? payload.messageKey.trim() : "";
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";

  const vars = detailVars(payload?.details);

  const fromKey = translated(t, key, vars);
  if (fromKey) return fromKey;

  if (message && message !== key) {
    /* Lause serverilt läheb edasi nagu enne. */
    if (!KEY_SHAPE.test(message)) return message;
    /* Võti sõnumi väljal: tõlgi, ära näita. */
    const fromMessage = translated(t, message, vars);
    if (fromMessage) return fromMessage;
  }

  const fromFallback = translated(t, fallbackKey);
  if (fromFallback) return fromFallback;
  if (fallbackText) return fallbackText;

  /* Kutsuja ei andnud kasutatavat varuteksti: üldine lause on parem kui võti. */
  const general = translated(t, "api.common.server_error");
  if (general) return general;
  return key || message || fallbackKey || "";
}
