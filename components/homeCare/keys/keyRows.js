/**
 * Kliendi võtmete reeglid ilma joonistamiseta: mis seisab võtme real, kes mida
 * teha tohib ja kellele võtit saab üle anda.
 *
 * Olek ja päringud on konksus ./useClientKeys.js, vaated failis ./KeysViews.jsx,
 * kokku paneb need ./ClientKeys.jsx. Võtme nime ja hoidja sõnu kasutavad ka
 * hooldaja päev, päevaplaan ja võtmeraamat.
 */

/** „nr 17 (välisuks)": ripatsi number ja, kui on, mille võti. */
export function keyName(t, key) {
  return key.label ? t("home_care.keys.name_with_label", { tag: key.tag, label: key.label }) : t("home_care.keys.name", { tag: key.tag });
}

/** Kelle käes võti on; hoidjata võti on kontoris. */
export function keyHolderText(t, key) {
  return key.holder ? t("home_care.keys.held_by", { name: key.holder.name || "—" }) : t("home_care.keys.in_office");
}

/** „võti: Anu Hooldaja käes, kontoris": kus kliendi võtmed on, kui käigu tegijal võtit ei ole. */
export function keyWhere(t, note) {
  const places = [...note.holders.map((name) => t("home_care.keys.held_by", { name })), ...(note.office ? [t("home_care.keys.in_office")] : [])];
  return t("home_care.keys.elsewhere", { where: places.join(", ") });
}

/** Kas võti on vaataja enda käes. */
export function keyMine(key, myMembershipId) {
  return Boolean(myMembershipId) && key.holder?.membershipId === myMembershipId;
}

/**
 * Mida inimene võtmega teha tohib. Üle annab hooldusjuht või see, kelle käes
 * võti parajasti on; võtme lisab ja lõpetab (tagastatud, kadunud) hooldusjuht.
 */
export function keyRights(key, { canManage, canWrite, myMembershipId }) {
  const mine = keyMine(key, myMembershipId);
  return { handOver: Boolean(canWrite && (canManage || mine)), end: Boolean(canWrite && canManage) };
}

/**
 * Võtmed loendi ridadena: `[{ key, title, line, open }]`. `open`: rida avab
 * võtme (inimene saab sellega midagi teha); muidu on rida lugemiseks.
 */
export function keyRows(keys, who, { t }) {
  return (keys || []).map((key) => ({
    key: key.id,
    title: keyName(t, key),
    line: keyMine(key, who.myMembershipId) ? t("home_care.keys.held_by_me") : keyHolderText(t, key),
    open: keyRights(key, who).handOver
  }));
}

/** Kellele võtit saab anda: kontor ja töötajad; praegune hoidja jääb välja. */
export function receiverOptions(receivers, exceptId, { t }) {
  return [
    { value: "", label: t("home_care.keys.office_option") },
    ...(receivers || []).filter((worker) => worker.membershipId !== exceptId).map((worker) => ({ value: worker.membershipId, label: worker.name || "—" }))
  ];
}
