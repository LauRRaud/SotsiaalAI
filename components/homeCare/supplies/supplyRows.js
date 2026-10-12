/**
 * Kliendi varude reeglid ilma joonistamiseta: mis seisab varu real ja mida
 * inimene varuga teha saab.
 *
 * Olek ja päringud on konksus ./useClientSupplies.js, vaated failis
 * ./SuppliesViews.jsx, kokku paneb need ./ClientSupplies.jsx.
 */

/* Seis, mis vajab tähelepanu: lõppev või otsa saanud varu. */
const SHORT = Object.freeze(["LOW", "OUT"]);

/** Varu seisu read: märkus, kes ja millal märkis, kes täiendab. `moment` vormindab ajahetke. */
export function supplyLines(supply, { t, moment }) {
  return [
    supply.stateNote || null,
    supply.checkedAt ? t("home_care.supplies.checked", { name: supply.checkedByName || "—", when: moment(supply.checkedAt) }) : t("home_care.supplies.unchecked"),
    t("home_care.supplies.responsible", { name: supply.responsible })
  ].filter(Boolean);
}

/**
 * Mida inimene varuga teha saab peale seisu märkimise: märkuse saab lisada
 * pärast seisu valimist; jälgimise lõpetab hooldusjuht.
 */
export function supplyRights(supply, { canWrite, canManage }) {
  return { note: Boolean(canWrite && supply.state), untrack: Boolean(canWrite && canManage) };
}

/**
 * Varud loendi ridadena: `[{ key, name, state, chip, line, short, open }]`.
 *  - `chip`  lõppeva või otsa saanud varu märk
 *  - `line`  kogu seis sõnadega (märkus, kes märkis, kes täiendab): neile, kes
 *             seisu märkida ei saa ja kelle real lahtreid ei ole
 *  - `short` üks lühike rida seisu märkijale (märkus või kes ja millal märkis);
 *             terve seis on varu vaates
 *  - `open`  rida avab varu: seisu märkija näeb seal tervet seisu, saab lisada
 *             märkuse ja hooldusjuht lõpetada jälgimise
 */
export function supplyRows(supplies, who, { t, moment }) {
  return (supplies || []).map((supply) => {
    const lines = supplyLines(supply, { t, moment });
    return {
      key: supply.id,
      name: t(`home_care.supplies.kinds.${supply.kind}`),
      state: supply.state || "",
      chip: SHORT.includes(supply.state) ? t(`home_care.supplies.states.${supply.state}`) : "",
      line: lines.join(" · "),
      short: lines[0],
      open: Boolean(who.canWrite)
    };
  });
}
