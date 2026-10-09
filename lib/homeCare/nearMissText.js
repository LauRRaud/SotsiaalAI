/**
 * KODUTEENUS K5-h — „peaaegu juhtus" kirje tekst (kava II.6.4).
 *
 * Hooldaja valib, mis peaaegu juhtus, ja soovi korral lisab ühe rea. Tekst pannakse
 * kokku siin, et see oleks päevikus alati sama kujuga. Puhas funktsioon: tõlkefunktsioon
 * ja valikud tulevad sisse, tekst läheb välja.
 */
export function composeNearMissText(t, kind, note) {
  const what = t(`home_care.near_miss.kinds.${kind}`);
  const extra = String(note || "").replace(/\s+/g, " ").trim();
  return extra ? t("home_care.near_miss.text_with_note", { what, note: extra }) : t("home_care.near_miss.text", { what });
}
