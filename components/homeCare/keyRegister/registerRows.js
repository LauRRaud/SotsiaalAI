/**
 * Võtmeraamatu reeglid ilma joonistamiseta: mis seisab esimese vaate ja võtme
 * real.
 *
 * Võtmeraamat hooldusjuhile (K4-b): kõik asutuse käes olevad võtmed kliendi kaupa ja
 * eraldi lõppenud teenusega klientide tagastamata võtmed. Võtme annab üle või
 * lõpetab kliendi lehel; siin on ülevaade. Päringuid ei ole. Vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./KeyRegister.jsx.
 */

import { clientHref } from "../homeCareClient";
import { keyHolderText, keyName } from "../keys/keyRows";

/** Mitu rida on loendis vaates enne nuppu „Näita veel". */
export const REGISTER_PAGE = 4;

/** Esimene vaade: tagastamata võtmed (tugevama pealkirjaga, kui neid on) ja kõik võtmed. */
export function registerMainRows(t, register) {
  const unreturned = register.unreturned.length;
  const all = register.keys.length;
  return [
    {
      key: "unreturned",
      title: t("home_care.keys.unreturned_title"),
      line: unreturned ? t("home_care.parts.count", { count: unreturned }) : t("home_care.keys.unreturned_empty"),
      tone: unreturned ? "risk" : ""
    },
    { key: "register", title: t("home_care.keys.register_title"), line: all ? t("home_care.parts.count", { count: all }) : t("home_care.keys.register_empty") }
  ];
}

/** Võtmed link-ridadena kliendi lehele (lingid ei eellaadi): `[{ key, title, chip, line, href }]`. */
export function keyLinks(items, { t, organizationId }) {
  return items.map((key) => ({
    key: key.id,
    title: key.client.displayName,
    chip: key.holderInactive ? { text: t("home_care.keys.holder_inactive"), tone: "wait" } : null,
    line: [keyName(t, key), keyHolderText(t, key)].join(" · "),
    href: clientHref(organizationId, key.client.id)
  }));
}
