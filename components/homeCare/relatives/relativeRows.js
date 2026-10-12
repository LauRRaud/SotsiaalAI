/**
 * Kliendi lähedaste ja esindusõiguse reeglid ilma joonistamiseta: mis seisab
 * lähedase ja esindaja real, kes mida teha tohib ja mis takistab salvestamist.
 *
 * Lähedased ja jagamisaste (K5-k): kellele ja mida klient on lubanud rääkida.
 * Esindusõigus (K6-i): kes tohib kliendi eest otsustada ja alla kirjutada.
 * Olek ja päringud on konksudes ./useClientRelatives.js, vaated failis
 * ./RelativesViews.jsx, kokku paneb need ./ClientRelatives.jsx.
 */

import { phoneHref } from "@/lib/homeCare/phone";

import { planDayLabel } from "../plan/planRows";

/* --- Lähedased ------------------------------------------------------------------- */

/** „Mari Tamm (tütar)": nimi ja, kui on kirjas, kes ta kliendile on. */
export function relativeName(item) {
  return item.relation ? `${item.name} (${item.relation})` : item.name;
}

/** Lähedase märk: `{ text, tone }` või null. Kahtlus on ees: siis kehtib kõige kitsam aste. */
export function relativeChip(item, { t }) {
  if (item.doubt) return { text: t("home_care.relatives.doubt_chip"), tone: "wait" };
  if (item.reviewDue) return { text: t("home_care.relatives.review_due"), tone: "wait" };
  return null;
}

/**
 * Mida inimene lähedase kirjega teha tohib. Muudab ja eemaldab hooldusjuht
 * (`canEdit`); kahtluse („klient ei mäleta, et lubas") märgib meeskond või
 * hooldusjuht (`canFlag`), kuni seda ei ole juba märgitud.
 */
export function relativeRights(item, { canEdit, canFlag }) {
  return { edit: Boolean(canEdit), remove: Boolean(canEdit), flag: Boolean(canFlag && !item.doubt) };
}

/**
 * Lähedased loendi ridadena: `[{ key, title, lines, chip }]`. Real on, mida
 * talle rääkida võib ja millest mitte: see peab olema ees ilma rida avamata.
 */
export function relativeRows(items, { t }) {
  return (items || []).map((item) => ({
    key: item.id,
    title: relativeName(item),
    lines: [t(`home_care.relatives.levels.${item.level}`), item.noTell ? t("home_care.relatives.no_tell_line", { text: item.noTell }) : null].filter(Boolean),
    chip: relativeChip(item, { t })
  }));
}

/** Avatud lähedase vaade: telefon lingina, aste, millest mitte rääkida, millal kinnitati ja kahtluse lause. */
export function relativeSheet(item, { t }) {
  return {
    name: relativeName(item),
    chip: relativeChip(item, { t }),
    phone: item.phone ? { text: item.phone, href: phoneHref(item.phone) || undefined } : null,
    level: t(`home_care.relatives.levels.${item.level}`),
    noTell: item.noTell ? t("home_care.relatives.no_tell_line", { text: item.noTell }) : "",
    agreed: t("home_care.relatives.agreed_on", { date: planDayLabel(item.agreedOn) }),
    doubt: item.doubt ? t("home_care.relatives.doubt_line", { name: item.doubt.byName || "—" }) : ""
  };
}

/** Kes ta on: nimi on kohustuslik. */
export function relativeWhoReady(form) {
  return Boolean(String(form.name || "").trim());
}

/** Mis takistab salvestamist: nimi ja jagamisaste on kohustuslikud. */
export function relativeReady(form) {
  return relativeWhoReady(form) && Boolean(form.level);
}

/* --- Esindusõigus ------------------------------------------------------------------- */

/** Kehtivus ühe reana: „kehtib kuni 31.12.2026", „kehtib alates 01.11.2026", „tähtajatu". */
export function representativePeriod(t, item) {
  if (item.validFrom && item.validUntil) return t("home_care.representative.period_both", { from: planDayLabel(item.validFrom), until: planDayLabel(item.validUntil) });
  if (item.validUntil) return t("home_care.representative.period_until", { until: planDayLabel(item.validUntil) });
  if (item.validFrom) return t("home_care.representative.period_from", { from: planDayLabel(item.validFrom) });
  return t("home_care.representative.period_open");
}

/** Esindusõiguse märk: `{ text, tone }` või null (kehtiv õigus märki ei vaja). Möödunud tähtaeg on tugevam. */
export function representativeChip(item, { t }) {
  if (item.state === "VALID") return null;
  return { text: t(`home_care.representative.states.${item.state}`), tone: item.state === "EXPIRED" ? "wait" : "" };
}

/** Esindajad loendi ridadena: `[{ key, title, line, chip }]`. */
export function representativeRows(items, { t }) {
  return (items || []).map((item) => ({
    key: item.id,
    title: item.name,
    line: [t(`home_care.representative.bases.${item.basis}`), representativePeriod(t, item)].join(" · "),
    chip: representativeChip(item, { t })
  }));
}

/**
 * Esindusõiguse rida lähedaste vaates: `{ title, line, chip }` või null, kui
 * inimesel ei ole seal midagi näha ega teha (kirjet ei ole ja ta ei saa lisada).
 */
export function representationRow(items, { canEdit }, { t }) {
  const list = items || [];
  if (!list.length && !canEdit) return null;
  const [first] = list;
  const expired = list.find((item) => item.state === "EXPIRED");
  const line = !first
    ? t("home_care.representative.row_none")
    : list.length > 1
      ? t("home_care.parts.lines.team_more", { name: first.name, count: list.length - 1 })
      : `${first.name} · ${t(`home_care.representative.bases.${first.basis}`)}`;
  return { title: t("home_care.representative.title"), line, chip: expired ? representativeChip(expired, { t }) : null };
}

/** Avatud esindaja vaade: alus, ulatus, kehtivus, telefon, koopia asukoht ja kes dokumenti nägi. */
export function representativeSheet(item, { t }) {
  return {
    name: item.name,
    chip: representativeChip(item, { t }),
    basis: t(`home_care.representative.bases.${item.basis}`),
    scope: item.scope || "",
    period: representativePeriod(t, item),
    phone: item.phone ? { text: item.phone, href: phoneHref(item.phone) || undefined } : null,
    lines: [
      item.copyKept ? t("home_care.representative.copy_line", { place: item.copyKept }) : null,
      t("home_care.representative.checked_line", { date: planDayLabel(item.checkedOn), name: item.checkedByName || "—" })
    ].filter(Boolean)
  };
}

/** Kes ja mille alusel: nimi, alus ja ulatus on kohustuslikud. */
export function representativeReady(form) {
  return Boolean(String(form.name || "").trim() && form.basis && String(form.scope || "").trim());
}
