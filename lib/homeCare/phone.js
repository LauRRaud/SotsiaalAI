/**
 * KODUTEENUS — telefoninumber helistamise lingina. Puhas fail ilma serveri sõltuvusteta,
 * et seda saaks kasutada nii teenusekihis kui ka brauseris.
 */

/** Number helistamise lingi jaoks: ainult numbrid ja algav pluss; alla kolme numbri ei ole number. */
export function phoneHref(phone) {
  const text = String(phone || "").trim();
  const digits = text.replace(/[^0-9]/g, "");
  return digits.length >= 3 ? `tel:${text.startsWith("+") ? "+" : ""}${digits}` : null;
}
