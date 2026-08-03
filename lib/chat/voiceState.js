// Hääleraja otsused ühes kohas — T03 E4/E5 punktid 1–4.
//
// Miks eraldi moodul: need neli asja on kõik "mis juhtub, kui midagi läheb
// valesti" ja neid ei saa brauserita tõendada, kui nad elavad hooki sees.
// Hook kutsub siit; testid tõendavad siit.

/** Hoiatus enne pehmet piiri (2 min). */
export const RECORDING_WARNING_MS = 120_000;

/** Pehme piir — salvestus lõpetatakse ise ära (2,5 min, E4 leping). */
export const RECORDING_LIMIT_MS = 150_000;

/**
 * Mikrofoni kolm keeldu + kaks täpsustust. Iga seis on ERALDI tekst — "ei
 * saanud avada" ei tohi katta tellimusnõuet ega brauseri loakeeldu.
 */
export const MIC_MESSAGE_KEYS = {
  subscription: "chat.mic.requires_subscription",
  permission: "chat.mic.permission_denied",
  no_device: "chat.mic.no_device",
  unsupported: "chat.mic.unsupported",
  technical: "chat.mic.cannot_start"
};

export const VOICE_NOTICE_KEYS = {
  discarded: "chat.mic.discarded",
  limit_warning: "chat.mic.limit_warning",
  limit_reached: "chat.mic.limit_reached",
  tts_browser_fallback: "chat.tts.browser_fallback",
  tts_unavailable: "chat.tts.unavailable"
};

/**
 * Miks mikrofon ei ole kasutatav ENNE klikki. `null` = on kasutatav.
 * Tellimuseta kasutaja ei näe tummalt halli nuppu, vaid saab põhjuse.
 */
export function micBlockReason({ voiceEnabled = true, mediaDevicesAvailable = true } = {}) {
  if (!voiceEnabled) return "subscription";
  if (!mediaDevicesAvailable) return "unsupported";
  return null;
}

/**
 * getUserMedia / MediaRecorder tõrke liik. Brauseri loakeeld on OMA seis,
 * mitte "tehniline viga" — kasutaja peab teadma, et parandus on brauseri
 * seadetes, mitte meie pool.
 */
export function classifyMicStartError(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || "");
  if (message === "UNSUPPORTED_RECORDING") return "unsupported";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "permission";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
    return "no_device";
  }
  if (name === "NotSupportedError") return "unsupported";
  return "technical";
}

/** Tõrke liik → tõlkevõti. */
export function micMessageKey(reason) {
  return MIC_MESSAGE_KEYS[reason] || MIC_MESSAGE_KEYS.technical;
}

/**
 * Brauserihääle valik locale'i järgi. Tagastab `null`, kui ükski hääl ei
 * sobi — see `null` ON kogu mõte: ilma selleta jääb RU/EN kasutaja
 * vaikivasse ebaõnnestumisse (E4).
 */
export function pickBrowserVoice(voices, locale) {
  const list = Array.isArray(voices) ? voices.filter(v => v && typeof v.lang === "string") : [];
  if (!list.length) return null;
  const normLocale = String(locale || "").toLowerCase();
  const base = normLocale.split("-")[0] || normLocale;
  const chains = {
    et: [normLocale, "et-ee", "et", "en-us", "en"],
    ru: [normLocale, "ru-ru", "ru", "en-us", "en", "et-ee", "et"],
    en: [normLocale, "en-us", "en-gb", "en", "et-ee", "et", "ru-ru", "ru"]
  };
  const prefs = (chains[base] || [normLocale, base, "en-us", "en", "et-ee", "et", "ru-ru", "ru"]).filter(Boolean);
  for (const pref of prefs) {
    const hit = list.find(v => v.lang.toLowerCase().startsWith(pref));
    if (hit) return hit;
  }
  return null;
}

/**
 * TTS kolm ausat lõppu. Vaikus ei ole nende hulgas.
 *
 * - server kõneles → märget ei ole
 * - brauser kõneles PLATVORMI HÄÄLE ASEMEL → märgistatud varu (kasutaja peab
 *   teadma, et kuuleb muud häält kui tavaliselt)
 * - brauser kõneles kavatsetud rajana (RU/EN) → märget ei ole, sest see EI
 *   ole varu; iga kord märkust näidata oleks müra
 * - kumbki ei kõnelenud → aus viga
 */
export function resolveTtsOutcome({ serverSpoke = false, browserSpoke = false, browserIsPrimary = false } = {}) {
  if (serverSpoke) return { ok: true, provider: "server", noticeKey: null };
  if (browserSpoke) {
    return {
      ok: true,
      provider: "browser",
      noticeKey: browserIsPrimary ? null : VOICE_NOTICE_KEYS.tts_browser_fallback
    };
  }
  return { ok: false, provider: null, noticeKey: VOICE_NOTICE_KEYS.tts_unavailable };
}

/**
 * Kas locale läheb serveriteele? AINULT ET (omaniku otsus 03.08).
 *
 * `/api/tts` oskaks ka RU/EN-i, aga serveritee kulutab `TTS_CHARS` kvooti ja
 * omanik otsustas, et RU/EN ettelugemine peab jääma kasutajale tasuta. See
 * on teadlik vahetus: kvaliteedierinevus (VEST-L8) jääb sisse, vaikiv
 * ebaõnnestumine EI jää — brauserihääle tõrge öeldakse välja.
 */
export function serverTtsLocales() {
  return ["et"];
}

export function usesServerTts(locale) {
  const base = String(locale || "").toLowerCase().split("-")[0];
  return serverTtsLocales().includes(base || "et");
}

/**
 * TartuNLP hääled katavad ainult eesti ja võro keelt (12 + 2 häält) — RU/EN
 * sinna ei lähe. Serveripoolne valik, aga elab siin, sest ta on sama
 * otsuste-pere liige.
 */
export function tartuNlpSupportsLocale(locale) {
  const base = String(locale || "").toLowerCase().split("-")[0];
  return base === "et";
}

/**
 * Kõnelejanimed on puhtalt tähestikulised (albert, mari, kylli, vesta …).
 * Piirame mustriga, et ei env ega admini valik ei saaks päringukehasse
 * midagi muud smugeldada. Vigane väärtus kukub vaikeväärtusele.
 */
export function normalizeTartuNlpSpeaker(value, fallback = "mari") {
  const raw = String(value || "").trim().toLowerCase();
  return /^[a-z]{2,20}$/.test(raw) ? raw : fallback;
}
