/**
 * VORMIVEA TEKST — üks koht kogu platvormil.
 *
 * MIKS ta olemas on. Brauseri natiivne valideerimine jookseb ENNE `onSubmit`-i
 * ja näitab teadet BRAUSERI liidesekeeles: eestikeelsel lehel ilmus
 * ingliskeelses Chrome'is „Please fill out this field" ja lehe enda eestikeelne
 * kontroll ei jõudnud kunagi ekraanile (leitud e-posti uuendamise vormilt).
 * Seetõttu on kõigil vormidel `noValidate` (vt components/ui/Form.jsx).
 *
 * `noValidate` lülitab välja ainult brauseri TEATE, mitte kontrolli ennast:
 * `field.validity` töötab edasi. Nii jäävad `required`, `type="email"`,
 * `minlength` jt atribuudid alles seal, kus nad juba on — ainult teksti keel
 * vahetub meie omaks. See on teadlik valik: ükski väli ei kaota kontrolli
 * seetõttu, et keegi unustas talle käsitsi kontrolli juurde kirjutada.
 *
 * Funktsioonid ei eelda DOM-i: nad loevad ainult `validity`-kujulist objekti
 * ja paari atribuuti, seega saab neid testida ilma brauserita.
 */

/* Järjekord LOEB: väli võib korraga rikkuda mitut reeglit ja inimesele
   öeldakse ÜKS asi. Puuduv väärtus tuleb enne vorminguviga — tühjale väljale
   „vale vorming" ütlemine on lihtsalt vale. */
const RULES = Object.freeze([
  ["valueMissing", "forms.error.required"],
  ["badInput", "forms.error.badInput"],
  ["typeMismatch", null],
  ["patternMismatch", "forms.error.pattern"],
  ["tooShort", "forms.error.tooShort"],
  ["tooLong", "forms.error.tooLong"],
  ["rangeUnderflow", "forms.error.rangeUnderflow"],
  ["rangeOverflow", "forms.error.rangeOverflow"],
  ["stepMismatch", "forms.error.step"]
]);

const TYPE_MISMATCH_KEYS = Object.freeze({
  email: "forms.error.email",
  url: "forms.error.url",
  tel: "forms.error.tel"
});

/**
 * Milline reegel katki on ja mis muutujad tema teatesse käivad.
 * Tagastab `null`, kui väli on korras.
 */
export function validationRule(field) {
  const validity = field?.validity;
  if (!validity || validity.valid) return null;
  for (const [flag, key] of RULES) {
    if (!validity[flag]) continue;
    if (flag === "typeMismatch") {
      const type = String(field?.type || "").toLowerCase();
      return { key: TYPE_MISMATCH_KEYS[type] || "forms.error.invalid", vars: {} };
    }
    return { key, vars: ruleVars(flag, field) };
  }
  /* Tundmatu lipp (uus brauserireegel) — parem üldine teade kui vaikus. */
  return { key: "forms.error.invalid", vars: {} };
}

function ruleVars(flag, field) {
  switch (flag) {
    case "tooShort":
      return { min: field?.minLength };
    case "tooLong":
      return { max: field?.maxLength };
    case "rangeUnderflow":
      return { min: field?.min };
    case "rangeOverflow":
      return { max: field?.max };
    default:
      return {};
  }
}

/**
 * Välja NÄHTAV nimi. Teade „See väli on kohustuslik" ei ütle pikas vormis, MIS
 * väli — silt ütleb. Võtame ta sealt, kus ta juba on: seotud `<label>`-ist,
 * `aria-label`-ist või kohatäitest.
 */
export function fieldLabel(field) {
  const fromLabel = field?.labels?.[0]?.textContent;
  const raw = fromLabel || field?.getAttribute?.("aria-label") || field?.placeholder || "";
  return String(raw).replace(/\s+/g, " ").trim();
}

/**
 * Valmis teade ühe välja kohta. `t` on I18nProvideri tõlkefunktsioon.
 */
export function validationMessage(field, t) {
  const rule = validationRule(field);
  if (!rule) return "";
  const message = t(rule.key, rule.vars, "");
  const label = fieldLabel(field);
  return label ? t("forms.error.field", { label, message }, `${label}: ${message}`) : message;
}

/**
 * Esimene vigane väli vormis — SELLE juurde viiakse fookus. Peidetud ja
 * väljalülitatud väljad jäävad välja: nendeni ei saa inimene liikuda ja
 * fookuse saatmine nende peale jätaks vormi vaikselt seisma.
 *
 * `display: none` all olev väli jääb samuti välja. Astmelistel vormidel on
 * järgmiste sammude väljad sageli juba DOM-is olemas; ilma selle kontrollita
 * blokeeriks esimene samm end ära välja pärast, mida ekraanil ei ole.
 */
export function firstInvalidField(form) {
  const elements = form?.elements ? Array.from(form.elements) : [];
  return (
    elements.find(element => {
      if (!element?.validity || element.validity.valid) return false;
      if (element.disabled || element.type === "hidden") return false;
      if (element.willValidate === false) return false;
      return isRendered(element);
    }) || null
  );
}

/* `offsetParent === null` tähendab `display: none` (või position: fixed —
   sellepärast on `getClientRects` teine küsimus). Kui elementi ei ole, ei ole
   ka mõõtu. */
function isRendered(element) {
  if (typeof element.offsetParent === "undefined") return true;
  if (element.offsetParent !== null) return true;
  return Boolean(element.getClientRects?.().length);
}
