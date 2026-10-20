/**
 * Tööheaolu tegurite ja tugevuste sildid lehe keeles.
 *
 * Arvutus annab tegurid koodina (`workload.high`, `hard_case.load.emotional_load`,
 * `strength.recovery`). Eestikeelne silt tuleb kiirkontrolli tegurite
 * sõnastikust või üldsõnastikust (`displayLabels.js`, täpne võti või koodi
 * viimane osa). Liides näitab sama silti tõlkekataloogist:
 *
 *   wellbeing.labels.factors.<kood>   kiirkontrolli tegur (lause kujul)
 *   wellbeing.labels.values.<võti>    üldsõnastiku silt
 *
 * Võtmes on punkt asendatud kahe allkriipsuga (`workload__high`), sest kataloog
 * on pesastatud. Eestikeelne silt on alati varutekst.
 *
 * Valmis tekstid (memod, plaanid) kasutavad `wellbeingLabel`-it otse ja jäävad
 * eesti keelde.
 */

import { WELLBEING_LABELS, wellbeingLabel, wellbeingLabelKey } from "./displayLabels.js";
import { QUICK_CHECK_FACTOR_LABELS } from "./quickCheck.js";

export const encodeLabelKey = (key) => String(key || "").replaceAll(".", "__");

/** `[tõlkevõti, varutekst]` või ainult tekst, kui sildi võtit ei ole. */
export function wellbeingFactorEntry(value) {
  const code = String(value || "").trim();
  if (Object.prototype.hasOwnProperty.call(QUICK_CHECK_FACTOR_LABELS, code)) {
    return [`wellbeing.labels.factors.${encodeLabelKey(code)}`, QUICK_CHECK_FACTOR_LABELS[code]];
  }
  const key = wellbeingLabelKey(code);
  if (key) return [`wellbeing.labels.values.${encodeLabelKey(key)}`, WELLBEING_LABELS[key]];
  return wellbeingLabel(code);
}

/** Teguri silt lehe keeles (`t` on i18n-i tõlkefunktsioon). */
export function wellbeingFactorText(t, value) {
  const entry = wellbeingFactorEntry(value);
  return Array.isArray(entry) ? t(entry[0], entry[1]) : entry;
}
