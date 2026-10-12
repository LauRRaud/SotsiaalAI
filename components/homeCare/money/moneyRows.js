/**
 * Kliendi raha reeglid ilma joonistamiseta: mis seisab arvestuse real, mitu
 * rida on vaates korraga ja mis takistab rea salvestamist.
 *
 * See on arvestus, mitte makse: kirjas on sularaha, mille klient hooldajale
 * andis, ja mida sellega tehti. Olek ja päringud on konksus ./useClientMoney.js,
 * vaated failis ./MoneyViews.jsx, kokku paneb need ./ClientMoney.jsx. Summa
 * sõnu kasutavad ka avaleht ja tähtaegade leht.
 */

import { planDayLabel } from "../plan/planRows";

/**
 * Mitu arvestuse rida on vaates enne nuppu „Näita veel". Neli rida mahub koos
 * jäägi ja töötajate ridadega nii arvuti paneeli kui ka telefoni ekraanile;
 * pikendatud loend kerib tervet paneeli.
 */
export const MONEY_PAGE = 4;

/** Sendid eurodeks keele kombel („12,50 €"). */
export function euroText(cents, locale) {
  try {
    return new Intl.NumberFormat(locale === "en" ? "en-IE" : locale || "et", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} EUR`;
  }
}

/** Kas osas on sellele inimesele midagi: ta saab rea lisada või tal on midagi vaadata. */
export function moneyVisible(money, canWrite) {
  return Boolean(canWrite || money?.entries?.length || money?.holders?.length);
}

/** Jäägi lause vaate ülaservas: `{ text, held }`; `held` on tõene, kui raha on vaataja käes. */
export function balanceLine(money, { t, euro }) {
  const held = (money?.balanceCents || 0) > 0;
  return { text: held ? t("home_care.money.balance", { amount: euro(money.balanceCents) }) : t("home_care.money.balance_none"), held };
}

/** Kelle käes selle kliendi raha on (hooldusjuhile): `[{ key, text }]`. */
export function holderRows(money, { t, euro }) {
  return (money?.holders || []).map((holder) => ({
    key: holder.membershipId,
    text: t("home_care.money.holder_line", { name: holder.name || "—", amount: euro(holder.balanceCents), date: planDayLabel(holder.lastOn) })
  }));
}

/**
 * Arvestuse read: `[{ key, title, line, amount, retract }]`. Hooldusjuht näeb
 * ka, kelle rida see on. `retract`: rea saab tühistada (oma värske rida).
 */
export function moneyRows(money, { t, euro, isCoordinator, canWrite }) {
  return (money?.entries || []).map((entry) => ({
    key: entry.id,
    title: `${planDayLabel(entry.occurredOn)} ${t(`home_care.money.kinds.${entry.kind}`)}`,
    line: [isCoordinator ? entry.holderName : null, entry.note].filter(Boolean).join(" · "),
    amount: euro(entry.amountCents),
    retract: Boolean(canWrite && entry.canRetract)
  }));
}

/** Üks lehekülg ridu: `{ rows, more }`; `more` ütleb, kas ridu on veel. */
export function moneyPage(rows, expanded) {
  return { rows: expanded ? rows : rows.slice(0, MONEY_PAGE), more: !expanded && rows.length > MONEY_PAGE };
}

/** Mis takistab rea salvestamist: liik ja summa on kohustuslikud, kulutuse juures ka see, mille peale raha läks. */
export function moneyReady(form) {
  return Boolean(form.kind && form.amount.trim() && (form.kind !== "SPENT" || form.note.trim()));
}
