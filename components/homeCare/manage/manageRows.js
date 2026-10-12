/**
 * Hooldusjuhi osa reeglid ilma joonistamiseta: mis seisab osa ridadel, mis on
 * märkamise, kontrollkõne ja teate real, mis takistab salvestamist ja mis on
 * seisu vormis kohustuslik.
 *
 * Osa koondab hooldusjuhi asjad: ülevaatus (mis on peatatud või lõpetatud kliendi
 * juures lahti), märkamised, kontrollkõne, teated otsustajale, andmete vorm ja
 * seisu vorm. Olek ja päringud on konksudes ./useClientManage.js, vaated on
 * ühised (../client/PartViews.jsx), kokku paneb need ./ClientManage.jsx.
 */

import { CARE_CLIENT_STATUSES, CARE_STATUS_REASONS, CareClientStatus, CareControlCallOutcome, CareEndReason, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { planDayLabel } from "../plan/planRows";

/** Mitu rida on pikas loendis (märkamised, teated, valitavad kirjed) vaates enne nuppu „Näita veel". */
export const MANAGE_PAGE = 4;

/** Üks lehekülg ridu: `{ rows, more }`; `more` ütleb, kas ridu on veel. */
export function managePage(rows, expanded) {
  return { rows: expanded ? rows : rows.slice(0, MANAGE_PAGE), more: !expanded && rows.length > MANAGE_PAGE };
}

/* --- Osa esimene vaade ------------------------------------------------------------ */

/** Üle vaadata pealkiri: peatatud ja lõpetatud kliendi juures on eri küsimus. */
export function reviewTitle(t, ended) {
  return t(ended ? "home_care.review.ended_title" : "home_care.review.away_title");
}

/**
 * Osa read: `[{ key, title, line, tone }]`. Ülevaatus, märkamised, kontrollkõne
 * ja teated ilmuvad ainult siis, kui neil on midagi; andmete ja seisu vormi
 * avab see, kes tohib kirjutada. Märkamine, mis ootab vastust, on tugevama
 * pealkirjaga.
 */
export function manageRows({ t, ended, reviewItems, signals, calls, notices, canWrite, client }) {
  const open = signals?.open?.length || 0;
  const rows = [];
  if (reviewItems.length) rows.push({ key: "review", title: reviewTitle(t, ended), line: t("home_care.parts.count", { count: reviewItems.length }), tone: "risk" });
  if (open || signals?.handled?.length) {
    rows.push({ key: "signals", title: t("home_care.change.signals_title"), line: open ? t("home_care.parts.lines.manage_signals", { count: open }) : "", tone: open ? "risk" : "" });
  }
  if (calls) rows.push({ key: "calls", title: t("home_care.control_call.title"), line: calls.due ? t("home_care.control_call.due") : "", tone: calls.due ? "risk" : "" });
  if (canWrite || notices.length) rows.push({ key: "notices", title: t("home_care.notice.title"), line: notices.length ? t("home_care.parts.count", { count: notices.length }) : "" });
  if (canWrite) {
    rows.push({ key: "details", title: t("home_care.client.edit"), line: "" });
    rows.push({ key: "status", title: t("home_care.client.status_title"), line: t(`home_care.status.${client.status}`) });
  }
  return rows;
}

/* --- Märkamised (K5-a) ------------------------------------------------------------- */

/** Üks rida märkamise kohta: valdkond ja miks see tekkis. Sama tekst kliendi lehel ja tähtaegade lehel. */
export function changeSignalLine(t, signal) {
  return `${t(`home_care.change.areas.${signal.area}`)} · ${t(`home_care.change.reasons.${signal.reason}`)}`;
}

/** Kui kaua märkamine on vastust oodanud. */
export function changeWaitingText(t, signal) {
  return signal.days > 0 ? t("home_care.change.waiting_days", { days: signal.days }) : t("home_care.change.waiting_today");
}

/**
 * Märkamised ridadena: `[{ key, title, line, tone, open }]`. Vastust ootavad on
 * ees ja avatavad, vastatud on loetavad (mida tehti, märkus ja kes vastas).
 */
export function signalRows(signals, { t, moment }) {
  const open = (signals?.open || []).map((signal) => ({ key: signal.id, title: changeSignalLine(t, signal), line: changeWaitingText(t, signal), tone: "risk", open: true }));
  const handled = (signals?.handled || []).map((signal) => ({
    key: signal.id,
    title: changeSignalLine(t, signal),
    lines: [
      `${t(`home_care.change.outcomes.${signal.outcome}`)}${signal.note ? `: ${signal.note}` : ""}`,
      t("home_care.change.answered_by", { name: signal.handledByName || "—", date: moment(signal.handledAt) })
    ],
    open: false
  }));
  return [...open, ...handled];
}

/** Vastus märkamisele vajab tulemust. */
export function answerSignalReady(form) {
  return Boolean(form.outcome);
}

/* --- Kontrollkõne (K6-l) ----------------------------------------------------------- */

/** Kontrollkõne pealkiri: päev ja kuidas läks. */
export function callTitle(t, item) {
  return `${planDayLabel(item.calledOn)} · ${t(`home_care.control_call.outcomes.${item.outcome}`)}`;
}

/** Kontrollkõne read: kellega räägiti, kes märkis ja märkus; tühja rida ei ole. */
export function callLines(t, item) {
  return [[item.spokeWith ? t(`home_care.control_call.parties.${item.spokeWith}`) : null, item.byName].filter(Boolean).join(" · "), item.note].filter(Boolean);
}

/** Kontrollkõned ridadena: `[{ key, title, lines }]`. */
export function callRows(view, { t }) {
  return (view?.items || []).map((item) => ({ key: item.id, title: callTitle(t, item), lines: callLines(t, item) }));
}

/** Millal kontrollkõne oli viimati ja kas on aeg uuesti: üks lause vaate ülaservas. */
export function callsLead(view, { t }) {
  const last = view?.lastReachedOn ? t("home_care.control_call.last_line", { date: planDayLabel(view.lastReachedOn) }) : t("home_care.control_call.never");
  return view?.due ? `${last} ${t("home_care.control_call.due")}` : last;
}

/** Kellega räägiti, küsitakse ainult siis, kui kliendiga ühendus saadi. */
export function callReached(form) {
  return Boolean(form.outcome) && form.outcome !== CareControlCallOutcome.NOT_REACHED;
}

/** Kui kirjas kokku ei lähe, on märkus kohustuslik. */
export function callNoteRequired(form) {
  return form.outcome === CareControlCallOutcome.DIFFERS;
}

/** Mis takistab kontrollkõne salvestamist: tulemus, kellega räägiti (kui ühendus saadi) ja vajalik märkus. */
export function callReady(form) {
  return Boolean(form.outcome) && !(callReached(form) && !form.spokeWith) && !(callNoteRequired(form) && !String(form.note || "").trim());
}

/* --- Teated otsustajale (K5-r) ----------------------------------------------------- */

/** Päeviku kirje lühidalt valiku jaoks. */
export function shortText(text, max = 90) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Teate seis ühe lausena: ootab vastust, vastatud (ja millal uuesti hinnata) või tagasi võetud. */
export function noticeStateLine(t, item) {
  if (item.state === "WITHDRAWN") return t("home_care.notice.withdrawn", { reason: item.withdrawReason || "" });
  if (item.state === "WAITING") return item.waitingDays ? t("home_care.notice.waiting", { days: item.waitingDays }) : t("home_care.notice.waiting_today");
  return [
    t("home_care.notice.answered", { date: planDayLabel(item.answeredOn), answer: t(`home_care.notice.answers.${item.answer}`) }),
    item.reassessBy ? t("home_care.notice.reassess_by", { date: planDayLabel(item.reassessBy) }) : null,
    item.answerNote
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Teate pealkiri: millal, miks ja mis kanalit pidi läks. */
export function noticeTitle(t, item) {
  return t("home_care.notice.line", { date: planDayLabel(item.sentOn), reason: t(`home_care.notice.reasons.${item.reason}`), channel: t(`home_care.notice.channels.${item.channel}`) });
}

/** Teate märk: uuesti hindamise päev on möödas. */
export function noticeChip(t, item) {
  return item.reassessOverdue ? { text: t("home_care.notice.reassess_overdue"), tone: "wait" } : null;
}

/** Teated ridadena: `[{ key, title, chip, lines }]`; saaja ja seis on real. */
export function noticeRows(notices, { t }) {
  return (notices || []).map((item) => ({ key: item.id, title: noticeTitle(t, item), chip: noticeChip(t, item), lines: [item.recipient, noticeStateLine(t, item)].filter(Boolean) }));
}

/** Mida teatega teha tohib: vastust märgib ja teate võtab tagasi see, kes tohib kirjutada, kuni teade ootab vastust. */
export function noticeRights(item, { canEdit }) {
  return { respond: Boolean(canEdit && item.state === "WAITING") };
}

/** Päeviku kirjed, mille hulgast teatele lisada: tagasi võtmata kirjed, kellel on tekst. */
export function pickableEntries(entries) {
  return (entries || []).filter((entry) => !entry.retractedAt && entry.text).slice(0, HOME_CARE_LIMITS.NOTICE_ENTRIES_PICK);
}

/** Kirje valik: valitud kirje läheb ära, uus lisatakse kuni lubatud arvuni. */
export function toggleEntryId(picked, id) {
  if (picked.includes(id)) return picked.filter((value) => value !== id);
  return picked.length >= HOME_CARE_LIMITS.NOTICE_ENTRIES_MAX ? picked : [...picked, id];
}

/** Uue teate esimene vaade on valmis, kui põhjus ja tekst on olemas. */
export function noticeStartReady(form) {
  return Boolean(form.reason) && Boolean(String(form.text || "").trim());
}

/** Uue teate saab salvestada, kui põhjus, tekst ja kanal on olemas. */
export function noticeReady(form) {
  return noticeStartReady(form) && Boolean(form.channel);
}

/** Vastus teatele: tulemus ja, kui hinnatakse uuesti, uue hindamise päev. */
export function noticeAnswerReady(form) {
  return Boolean(form.answer) && (form.answer !== "REASSESS" || Boolean(form.reassessBy));
}

/** Märkus on kohustuslik, kui maht jääb samaks või vastus on muu. */
export function noticeAnswerNoteRequired(form) {
  return form.answer === "VOLUME_STAYS" || form.answer === "OTHER";
}

/** Teate tagasivõtmine vajab põhjust. */
export function withdrawReady(form) {
  return Boolean(String(form.reason || "").trim());
}

/* --- Seis (kava II.6.5) -------------------------------------------------------------- */

/** Seisud valikuna: `[{ value, label }]`. */
export function statusOptions(t) {
  return CARE_CLIENT_STATUSES.map((value) => ({ value, label: t(`home_care.status.${value}`) }));
}

/** Alused, mis valitud seisuga käivad. */
export function reasonOptionsOf(status) {
  return CARE_STATUS_REASONS[status] || [];
}

/** Alused valikuna: `[{ value, label }]`. */
export function reasonChoices(t, status) {
  return reasonOptionsOf(status).map((value) => ({ value, label: t(`home_care.status_reason.${status}.${value}`) }));
}

/** Surm: lõpetatud, alus „suri". Allikas on kohustuslik ja salvestamine käib kahes sammus. */
export function isDeath(form) {
  return form.status === CareClientStatus.ENDED && form.reason === CareEndReason.DIED;
}

/** Mis takistab seisu salvestamist: alus puudub, kui seisul on alused, või surma allikas puudub. */
export function statusReady(form) {
  const options = reasonOptionsOf(form.status);
  const reasonMissing = options.length > 0 && !options.includes(form.reason);
  const sourceMissing = isDeath(form) && !String(form.note || "").trim();
  return !reasonMissing && !sourceMissing;
}
