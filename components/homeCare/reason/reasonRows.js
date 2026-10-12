/**
 * Põhjuse küsimise reeglid ilma joonistamiseta.
 *
 * Meeskonda mittekuuluv hooldaja ei näe kliendi kohta midagi, enne kui ta on
 * põhjuse andnud: leht avaneb põhjuse vaatega (sisu asemel) ja juba lahti oleval
 * lehel, kui päevane luba lõppes või inimene eemaldati meeskonnast, ilmub sama
 * vaade avatud vaate kohale. Olek ja päring on konksus ./useReason.js, vaade
 * on ühine (../client/PartViews.jsx), kokku paneb need ./ClientReason.jsx.
 */

import { CARE_ACCESS_REASONS, CareAccessReason } from "@/lib/homeCare/constants";

/** Põhjus, mis on vormis ette valitud. */
export const DEFAULT_REASON_CODE = CareAccessReason.COVERING;

/** Põhjuste valik: `[{ value, label }]`. */
export function reasonCodes(t) {
  return CARE_ACCESS_REASONS.map((value) => ({ value, label: t(`home_care.reason.codes.${value}`) }));
}

/** Põhjuse annab see, kes tohib kirjutada: lugeja näeb ainult lauset, miks ta seda teha ei saa. */
export function reasonRights({ writable }) {
  return { submit: Boolean(writable) };
}
