/**
 * Kuu kokkuvõtte reeglid ilma joonistamiseta: mis seisab kuu, kliendi, töötaja ja
 * ära jäänud käigu real, mis on kuu lahtised asjad ja mis ütleb kuu lukk.
 *
 * Kuu kokkuvõte hooldusjuhile: kolm loendit ühest ja samast kirjete hulgast
 * (kliendi kaupa, töötaja kaupa, ära jäänud käigud). Lukustatud kuu (K5-p) arvud
 * tulevad hetktõmmisest; kliendil, keda enam nimekirjas ei ole, on nime asemel
 * selgitus ja linki ei ole. Olek ja päringud on konksudes ./useMonth.js, vaated on
 * ühised (../client/PartViews.jsx), kokku paneb need ./Month.jsx.
 */

import { decisionVolumeLabel, minutesLabel } from "../decision/decisionRows";
import { clientHref } from "../homeCareClient";
import { planDayLabel } from "../plan/planRows";

/** Mitu rida on loendis vaates enne nuppu „Näita veel". */
export const MONTH_PAGE = 4;

/** `AAAA-KK` → `KK.AAAA`. Käsitsi, et server ja brauser annaksid sama kuju. */
export function monthLabel(month) {
  const [year, number] = String(month || "").split("-");
  return year && number ? `${number}.${year}` : "";
}

/** Kuu on lukus. */
export function isLocked(data) {
  return data.lock?.state === "LOCKED";
}

/** Kuu kokkuvõte ühe lausena ja märkamiste vastamise näit (K5-x), kui märkamisi oli. */
export function monthLead(t, data) {
  const totals = t("home_care.month.totals", { visits: data.totals.visits, amount: minutesLabel(t, data.totals.minutes), without: data.totals.withoutLength, missed: data.totals.missed });
  const stats = data.signalStats;
  const signals = stats?.opened
    ? `${t("home_care.month.signals_line", { opened: stats.opened, handled: stats.handled, waiting: stats.waiting })}${stats.medianDays === null ? "" : ` ${stats.medianDays === 0 ? t("home_care.month.signals_median_same_day") : t("home_care.month.signals_median", { days: stats.medianDays })}`}`
    : "";
  return [totals, signals].filter(Boolean).join(" ");
}

/** Laused kuu all servas: lukus, jooksev kuu ja katkestatud vastus; üks lause. */
export function monthNotes(t, data) {
  return [
    isLocked(data) ? (data.lock.snapshotShown ? t("home_care.month_lock.locked_banner") : t("home_care.month_lock.locked_banner_unit")) : null,
    data.untilDay && data.untilDay === data.today ? t("home_care.month.until_today", { date: planDayLabel(data.untilDay) }) : null,
    data.truncated ? t("home_care.deadlines.truncated", { count: data.clients.length }) : null
  ]
    .filter(Boolean)
    .join(" ");
}

/** Kliendi rida: käigud ja aeg, otsustatud aeg ja maht, kestuseta, ära jäänud, ära jäetud, ära päevi, tegemata, ravimid. */
export function clientMeta(t, row) {
  return [
    t("home_care.month.client_line", { visits: row.visits, amount: minutesLabel(t, row.minutes) }),
    row.expectedMinutes === null ? t("home_care.month.expected_none") : t("home_care.month.expected", { amount: minutesLabel(t, row.expectedMinutes) }),
    decisionVolumeLabel(t, row) ? t("home_care.month.decision_volume", { volume: decisionVolumeLabel(t, row) }) : null,
    row.withoutLength ? t("home_care.provided.without_length", { count: row.withoutLength }) : null,
    row.missed ? t("home_care.month.missed_count", { count: row.missed }) : null,
    row.cancelled ? t("home_care.month.cancelled_count", { count: row.cancelled }) : null,
    row.awayDays ? t("home_care.month.away_days", { count: row.awayDays }) : null,
    row.notDone && row.notDone.REFUSED + row.notDone.NOT_NEEDED + row.notDone.COULD_NOT > 0 ? t("home_care.month.not_done", { refused: row.notDone.REFUSED, notNeeded: row.notDone.NOT_NEEDED, couldNot: row.notDone.COULD_NOT }) : null,
    /* Ravimitoimingud (K5-i): arvud ümardamata; märkimata ja tegemata on eraldi näha. */
    row.medication ? t("home_care.month.medication", { reminded: row.medication.reminded, sawTaken: row.medication.sawTaken, gave: row.medication.gave, unmarked: row.medication.unmarked, notDone: row.medication.notDone }) : null
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Kliendi link või, kui klienti nimekirjas enam ei ole, loetav rida: `{ title, href }`. */
function clientTarget(t, organizationId, client, name) {
  return client.displayName === null ? { title: t("home_care.month_lock.client_gone") } : { title: name, href: clientHref(organizationId, client.id) };
}

/** Kliendid kuu kaupa ridadena (lingid kliendi lehele ei eellaadi): `[{ key, title, chips, line, href }]`. */
export function clientRows(data, { t, organizationId }) {
  return data.clients.map((row) => ({
    key: row.client.id,
    ...clientTarget(t, organizationId, row.client, row.client.displayName),
    chips: [
      row.client.status && row.client.status !== "ACTIVE" ? { text: t(`home_care.status.${row.client.status}`), tone: "wait" } : null,
      data.complete && row.expectedMinutes !== null && row.minutes > row.expectedMinutes ? { text: t("home_care.month.over_badge"), tone: "" } : null
    ].filter(Boolean),
    line: clientMeta(t, row)
  }));
}

/** Töötajad ridadena: `[{ key, title, line }]`; real on käigud ja aeg, rasked käigud, kaasas käigud ja kilomeetrid. */
export function workerRows(data, { t }) {
  return data.workers.map((row) => ({
    key: row.membershipId || row.name,
    title: row.name || "—",
    line: [
      row.visits ? t("home_care.month.worker_line", { visits: row.visits, amount: minutesLabel(t, row.minutes) }) : null,
      row.heavy ? t("home_care.work_nature.heavy_visits", { count: row.heavy }) : null,
      row.companionVisits ? t("home_care.month.worker_companion", { visits: row.companionVisits, amount: minutesLabel(t, row.companionMinutes) }) : null,
      /* Sõidupäeviku kilomeetrid (K6-b). */
      row.km ? t("home_care.month.worker_km", { km: row.km, ownKm: row.ownKm || 0 }) : null
    ]
      .filter(Boolean)
      .join(" · ")
  }));
}

/** Ära jäänud käigud ridadena: `[{ key, title, href, line }]`. */
export function missedRows(data, { t, organizationId, moment }) {
  return data.missed.map((row) => ({
    key: row.entryId,
    ...clientTarget(t, organizationId, row.client, row.client.displayName),
    line: `${moment(row.occurredAt)} · ${t(`home_care.incident.types.${row.type}`)}`
  }));
}

/**
 * Kuu lahtised asjad (K5-j): mida enne kuu numbrite saatmist üle vaadata. Read: `[{ key, title, href }]`
 * (kirjeta käigud on kliendi lehe lingiga, erijuhtumid ja märkamised viivad oma lehele). `clear` ütleb, et lahtist ei ole.
 */
export function openItemRows(open, { t, organizationId }) {
  const rows = [
    open.missingCount ? { key: "missing", title: t("home_care.month_open.missing", { count: open.missingCount }) } : null,
    open.openIncidents ? { key: "incidents", title: t("home_care.month_open.incidents", { count: open.openIncidents }), href: `/org/${organizationId}/koduteenus/erijuhtumid` } : null,
    open.openSignals ? { key: "signals", title: t("home_care.month_open.signals", { count: open.openSignals }), href: `/org/${organizationId}/koduteenus/tahtajad` } : null,
    open.medicationUnmarked ? { key: "medication", title: t("home_care.month_open.medication", { count: open.medicationUnmarked }) } : null,
    ...open.missing.map((item) => ({
      key: `${item.day}-${item.startTime}-${item.client.id}`,
      title: item.client.displayName,
      href: clientHref(organizationId, item.client.id),
      line: t("home_care.month_open.missing_line", { date: planDayLabel(item.day), time: item.startTime })
    }))
  ].filter(Boolean);
  return rows;
}

/** Lahtiste asjade lõpp: lause, kui kirjeta käike on rohkem kui näidatud. */
export function openItemsMore(open, { t }) {
  return open.missingCount > open.missing.length ? t("home_care.month_open.missing_more", { shown: open.missing.length, count: open.missingCount }) : "";
}

/* --- Kuu lukk (K5-p) ---------------------------------------------------------------- */

const DRIFT_TEXT = Object.freeze({ visits: "visits", minutes: "minutes", withoutLength: "without_length", missed: "missed", cancelled: "cancelled", notDone: "not_done" });

/** Mille poolest praegune seis lukustatust erineb: üks lause või tühi. */
export function driftList(t, lock) {
  const signedMinutes = (value) => `${value > 0 ? "+" : "−"}${minutesLabel(t, Math.abs(value))}`;
  const signed = (value) => (value > 0 ? `+${value}` : `−${Math.abs(value)}`);
  return lock.drift
    ? Object.keys(DRIFT_TEXT)
        .filter((key) => lock.drift[key])
        .map((key) => t(`home_care.month_lock.drift_${DRIFT_TEXT[key]}`, { delta: key === "minutes" ? signedMinutes(lock.drift[key]) : signed(lock.drift[key]) }))
        .join(", ")
    : "";
}

/**
 * Luku laused: `[{ key, text }]`. Lukustamata kuu: selgitus, miks ei saa, ja lahtiste asjade hoiatus.
 * Lukustatud kuu: kes ja millal lukustas, lahtised asjad lukustamise hetkel, mille poolest praegune seis erineb ja
 * mis on pärast lukustamist lisatud või muudetud.
 */
export function lockNotices(t, lock, { moment }) {
  if (lock.state === "OPEN") {
    return [
      { key: "intro", text: t("home_care.month_lock.intro") },
      lock.blocked === "NOT_OVER" ? { key: "not_over", text: t("home_care.month_lock.not_over") } : null,
      lock.blocked === "SCOPE" ? { key: "scope", text: t("home_care.month_lock.scope_only") } : null,
      lock.canLock && lock.openItemCount ? { key: "warning", text: t("home_care.month_lock.open_warning", { count: lock.openItemCount }) } : null
    ].filter(Boolean);
  }
  const list = driftList(t, lock);
  const after = lock.after;
  return [
    { key: "line", text: t("home_care.month_lock.locked_line", { name: lock.lockedByName || "—", date: moment(lock.lockedAt) }) },
    lock.openItemCount ? { key: "open", text: t("home_care.month_lock.locked_open", { count: lock.openItemCount }) } : null,
    lock.snapshotShown ? { key: "drift", text: list ? t("home_care.month_lock.drift", { list }) : t("home_care.month_lock.no_drift") } : { key: "unit", text: t("home_care.month_lock.unit_hint") },
    after?.total ? { key: "after", text: `${t("home_care.month_lock.after_title")}: ${t("home_care.month_lock.after_counts", { added: after.added, corrected: after.corrected, retracted: after.retracted, plan: after.planChanged })}` } : null,
    after?.total && after.added + after.corrected + after.retracted > after.items.length ? { key: "after_more", text: t("home_care.month_lock.after_more", { shown: after.items.length, count: after.added + after.corrected + after.retracted }) } : null,
    after?.total && lock.canReopen ? { key: "after_hint", text: t("home_care.month_lock.after_hint") } : null
  ].filter(Boolean);
}

/** Pärast lukustamist lisatud ja muudetud kirjed link-ridadena: `[{ key, title, href, line }]`. */
export function afterRows(lock, { t, organizationId, moment }) {
  return (lock.after?.items || []).map((item) => ({
    key: item.key,
    title: item.client.displayName,
    href: clientHref(organizationId, item.client.id),
    line: `${t(`home_care.month_lock.after_kinds.${item.kind}`)} · ${item.actorName || "—"} · ${moment(item.at)} · ${t("home_care.month_lock.after_occurred", { when: moment(item.occurredAt) })}`
  }));
}

/** Varasemad lukustamised: üks lause igaühe kohta. */
export function lockHistory(t, lock, { moment }) {
  return (lock.history || []).map((row) => ({
    key: row.id,
    text: t("home_care.month_lock.history_line", { lockedBy: row.lockedByName || "—", lockedAt: moment(row.lockedAt), reopenedBy: row.reopenedByName || "—", reopenedAt: moment(row.reopenedAt), reason: row.reopenReason })
  }));
}

/** Uuesti avamine vajab põhjust. */
export function reopenReady(reason) {
  return Boolean(String(reason || "").trim());
}
