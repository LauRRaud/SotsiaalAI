import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";

/**
 * ISIKUANDMETE HOIATUSE TEKST INIMESE KEELES.
 *
 * Tuvastaja (`piiFilter.js`) nimetab leitud andmeliigid ja koostab hoiatuse lause eesti keeles.
 * Vastus `409 privacy.confirmation_required` kandis need sõnad lehele muutmata, seega nägi
 * inglise ja vene lehe kasutaja hoiatuse sees eestikeelset lauset. Siin tõlgitakse lause ja
 * liikide nimed vastuse sees ümber; tuvastaja enda väljund ja varjatud tekst ei muutu.
 */

const TYPE_KEYS = Object.freeze({
  email: "privacy_guard.types.email",
  phone: "privacy_guard.types.phone",
  estonian_personal_code: "privacy_guard.types.estonian_personal_code",
  address: "privacy_guard.types.address"
});

/**
 * Lehe keel. Keelevalik hoiab seda küpsises `NEXT_LOCALE`; päring päist `x-ui-locale` alati
 * kaasa ei pane ja brauseri keel ei ole lehe keel. Kui kumbagi ei ole, on keel eesti keel.
 */
export function privacyLocaleFromRequest(request) {
  const fromJar = request?.cookies?.get?.("NEXT_LOCALE")?.value;
  const fromHeader = /(?:^|;\s*)NEXT_LOCALE=([^;]+)/u.exec(String(request?.headers?.get?.("cookie") || ""))?.[1];
  return (
    normalizeServerLocale(fromJar || fromHeader) ||
    normalizeServerLocale(request?.headers?.get?.("x-ui-locale")) ||
    "et"
  );
}

/** Tõlgib kinnitusküsimuse vastuses hoiatuse lause ja liikide nimed. Muu vastus jääb samaks. */
export function localizePrivacyPayload(payload, locale) {
  if (!payload || typeof payload !== "object") return {};
  if (!payload.needsPrivacyConfirmation) return payload;
  const labelOf = (item) => {
    const key = TYPE_KEYS[item?.type];
    return key ? serverT(locale, key, undefined, item?.label || "") : item?.label || "";
  };
  return {
    ...payload,
    findings: (Array.isArray(payload.findings) ? payload.findings : []).map((finding) => ({
      ...finding,
      label: labelOf(finding)
    })),
    spans: (Array.isArray(payload.spans) ? payload.spans : []).map((span) => ({ ...span, label: labelOf(span) })),
    /* Lause ei korda leitud liike: lehed näitavad neid `findings` järgi omal real. */
    warning: serverT(locale, "privacy_guard.warning", undefined, payload.warning || "")
  };
}
