/**
 * Toe osa (`/org/<id>/tugi`) reeglid ilma joonistamiseta: kellele saab saata,
 * saatmise sammud ja mis saatmiseks puudu on, saadud ja saadetud avalduste read.
 *
 * SAAJA SILT EI TOHI KUNAGI olla ainult kriips. Kui inimene ei saa aru, KELLELE
 * ta oma tööheaolu kokkuvõtte saadab, ei ole tema nõusolek teadlik. Server
 * saadab e-posti ainult siis, kui nimi puudub, seega silt ei lekita
 * kontaktandmeid nimega liikmete kohta.
 *
 * Leht (`../OrgSupportClient.jsx`) hoiab olekut ja teeb päringud, vaated
 * (`./SupportViews.jsx`) joonistavad. Test: `tests/org-work-views.test.mjs`.
 */

import { dayOf } from "../orgRules.js";

/** Saatmise sammud lehe järjekorras. */
export const SEND_STEPS = Object.freeze(["who", "what", "confirm"]);

/** Loendi vaated lahtritena: saadud ja saadetud avaldused ning mida asutus pakub. */
export const LIST_TABS = Object.freeze(["received", "sent", "measures"]);

/** Tühi avaldus. Kinnitus on eraldi TEGU, mitte vaikimisi eeldus (§5.8). */
export const EMPTY_SHARE = Object.freeze({ recipientMembershipId: "", summary: "", needs: "", confirmed: false });

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Inimese silt: nimi, selle puudumisel ametinimetus, siis e-post, siis üldnimi. */
export function personLabel(entry, { t }) {
  const name = [text(entry?.firstName), text(entry?.lastName)].filter(Boolean).join(" ");
  return name || text(entry?.jobTitle) || text(entry?.email) || t("org.support.unnamed");
}

/** Tugitee liigi võti: otsene juht, turvakontakt või alternatiivne tugikontakt. */
export function contactTypeKey(contactType) {
  if (contactType === "DIRECT_MANAGER") return "org.support.directManager";
  if (contactType === "SAFETY_CONTACT") return "org.support.safety";
  return "org.support.alternate";
}

/**
 * Saajate valikud: nimi ja mis tugitee see on. Sama inimene võib olla mitu
 * tugiteed (nt otsene juht ja turvakontakt): ta on valikus ÜKS kord ja tema
 * teed on loetletud koos (kaks sama väärtusega valikut ei ole eristatavad).
 */
export function recipientOptions(recipients, { t }) {
  const byMember = new Map();
  for (const entry of Array.isArray(recipients) ? recipients : []) {
    if (!entry?.membershipId) continue;
    const kind = t(contactTypeKey(entry.contactType));
    const known = byMember.get(entry.membershipId);
    if (!known) byMember.set(entry.membershipId, { name: personLabel(entry, { t }), kinds: [kind] });
    else if (!known.kinds.includes(kind)) known.kinds.push(kind);
  }
  return [...byMember].map(([value, row]) => ({ value, label: `${row.name} · ${row.kinds.join(", ")}` }));
}

/** Kas vormi on midagi kirjutatud, valitud või kinnitatud. */
export function shareDirty(form) {
  return Boolean(text(form?.recipientMembershipId) || text(form?.summary) || text(form?.needs) || form?.confirmed);
}

/**
 * Mis saatmiseks puudu on: `{ key, step }` või null. Saaja ja lühikokkuvõte on
 * kohustuslikud; kinnitus on omaette samm (vanal vormil hoidis kinnitamata
 * vorm nuppu hallina, põhjust ütlemata).
 */
export function shareProblem(form) {
  if (!text(form?.recipientMembershipId)) return { key: "org.support.need_recipient", step: "who" };
  if (!text(form?.summary)) return { key: "org.support.need_summary", step: "what" };
  if (!form?.confirmed) return { key: "org.support.need_confirm", step: "confirm" };
  return null;
}

/** Sammu numbri heledus kiirmenüüs. */
export function sendStepStates(form) {
  return {
    who: text(form?.recipientMembershipId) ? "done" : "empty",
    what: text(form?.summary) ? "done" : text(form?.needs) ? "partial" : "empty",
    confirm: form?.confirmed ? "done" : "empty"
  };
}

/** Viimase vaate kokkuvõte: kellele ja mis läheb. */
export function sendSummary(form, recipients, { t }) {
  const to = recipientOptions(recipients, { t }).find((option) => option.value === form?.recipientMembershipId);
  const needs = text(form?.needs).split("\n").map((line) => line.trim()).filter(Boolean);
  return [
    { key: "to", label: t("org.support.sentTo"), value: to?.label || "" },
    { key: "summary", label: t("org.support.summary"), value: text(form?.summary) },
    { key: "needs", label: t("org.support.needs"), value: needs.join("; ") }
  ].filter((row) => row.value);
}

/**
 * Saadud avalduse rida: kellelt, selle all saatmise päev ja periood; märk on
 * seis. Avamata avaldus on tähelepanu vajav.
 */
export function receivedRow(share, { t }) {
  const status = String(share?.status || "").toUpperCase();
  return {
    id: String(share?.id || ""),
    title: personLabel(share?.sender || {}, { t }),
    sub: [dayOf(share?.sentAt), text(share?.snapshot?.periodLabel)].filter(Boolean).join(" · "),
    chip: status ? t(`org.supportShareStatus.${status}`) : "",
    attention: status === "SENT"
  };
}

/**
 * Avatud saadud avaldus: kas sisu on käes või tuleb see enne avada (avamine on
 * eraldi teadlik samm), mis sisu sees on ja kas avalduse saab sulgeda.
 */
export function receivedDetail(share, { t, writable = true } = {}) {
  const snapshot = share?.snapshot || null;
  const status = String(share?.status || "").toUpperCase();
  return {
    from: personLabel(share?.sender || {}, { t }),
    facts: [
      { key: "status", label: t("org.support.status"), value: status ? t(`org.supportShareStatus.${status}`) : "" },
      { key: "sent", label: t("org.support.sentAt"), value: dayOf(share?.sentAt) },
      { key: "period", label: t("org.support.period"), value: text(snapshot?.periodLabel) }
    ].filter((row) => row.value),
    opened: Boolean(snapshot),
    canOpen: !snapshot && status === "SENT",
    summary: text(snapshot?.summary),
    requested: text(snapshot?.supportRequested),
    needs: Array.isArray(snapshot?.needs) ? snapshot.needs.map((need) => text(need)).filter(Boolean) : [],
    canClose: Boolean(writable) && (status === "SENT" || status === "OPENED")
  };
}

/**
 * Saadetud avalduse rida: kellele, selle all saatmise päev; märk on seis. Tagasi
 * võtta saab ainult enne avamist.
 */
export function sentRow(share, { t, writable = true } = {}) {
  const status = String(share?.status || "").toUpperCase();
  return {
    id: String(share?.id || ""),
    title: personLabel(share?.recipient || {}, { t }),
    sub: dayOf(share?.sentAt),
    chip: status ? t(`org.supportShareStatus.${status}`) : "",
    canRecall: Boolean(writable) && status === "SENT" && !share?.openedAt
  };
}

/** Milline loend on ees: inimese valik, kui see on päris vaade. */
export function shownList(wanted) {
  return LIST_TABS.includes(wanted) ? wanted : "received";
}
