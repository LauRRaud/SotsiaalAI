/**
 * Graafiku osa (`/org/<id>/graafik`) reeglid ilma joonistamiseta: töötaja rida,
 * tema päeva read ja külastused, töö määramise vorm ja teisele andmine.
 *
 * TAHVEL NÄITAB OLEKUT JA HILINEMIST. Asukohaandmeid ega märkuste sisu siin ei
 * ole: ainus „kus ta on" küsimus, millele vastatakse, on „ei ole veel alustanud".
 *
 * MÄÄRAMINE ON PLAAN, MITTE TEHTUD TÖÖ. Juht loob plaanitud külastuse;
 * kohalejõudmise ja teenuse märgib see, kes päriselt kohal käis. Alustatud tööd
 * ei saa teisele anda: asendus tähendab „mine sina selle asemel", mitte „kirjuta
 * tema tehtud töö enda nimele".
 *
 * Leht (`../OrgDispatchBoard.jsx`) hoiab olekut ja teeb päringud, vaated
 * (`./DispatchViews.jsx`) joonistavad. Test: `tests/org-dispatch-views.test.mjs`.
 */

/** Tühi määramise vorm. */
export const EMPTY_ASSIGN = Object.freeze({ assignTo: "", client: "", address: "", startAt: "" });

/** Kliendi nime ja aadressi piirid (server lõikab samade kohtade pealt). */
export const CLIENT_LIMIT = 200;
export const ADDRESS_LIMIT = 300;

/** Teisele andmise põhjuse piir. */
export const REASON_LIMIT = 500;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Kellaaeg inimese keeles (`09.30` või `09:30`, nagu keel ette näeb). Vigane väärtus annab tühja sõne. */
export function timeOf(value, locale = "et") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale || "et", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

/** Töötaja päeva seis ühe lausena: ei ole alustanud, päev algas või lõppes; paus; külastused ja sõiduaeg. */
export function dayLine(worker, { t, locale }) {
  const status =
    worker?.routeStatus === null || worker?.routeStatus === undefined
      ? t("org.board.not_started")
      : worker.routeStatus === "CLOSED"
        ? t("org.board.day_closed", { time: timeOf(worker.endedAt, locale) })
        : t("org.board.day_open", { time: timeOf(worker.startedAt, locale) });
  return [
    status,
    worker?.onBreak ? t("org.board.on_break") : "",
    t("org.board.day_summary", { visits: String(worker?.summary?.visits ?? 0), travel: String(worker?.summary?.travelMinutes ?? 0) })
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Töötaja rida: nimi (ja ametinimetus), selle all päeva seis; märgid ütlevad,
 * mitu külastust hilineb ja mitu vajab kontrolli.
 */
export function workerRow(worker, { t, locale }) {
  const late = Array.isArray(worker?.late) ? worker.late.length : 0;
  const check = Array.isArray(worker?.needsCheck) ? worker.needsCheck.length : 0;
  return {
    id: String(worker?.membershipId || ""),
    title: [text(worker?.name), text(worker?.jobTitle)].filter(Boolean).join(" · ") || t("org.inbox.unnamed_worker"),
    sub: dayLine(worker, { t, locale }),
    chips: [late ? t("org.board.late_count", { count: String(late) }) : "", check ? t("org.board.check_count", { count: String(check) }) : ""].filter(Boolean)
  };
}

/** Tahvli kokkuvõte: mitu töötajat, mitu päeva käimas, hilinemised ja kontrolli vajavad. */
export function totalsLine(board, { t }) {
  const totals = board?.totals || {};
  return [
    t("org.board.totals", { workers: String(totals.workers ?? 0), open: String(totals.open ?? 0) }),
    totals.late ? t("org.board.late_count", { count: String(totals.late) }) : "",
    totals.needsCheck ? t("org.board.check_count", { count: String(totals.needsCheck) }) : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Hoiatused töötaja kohta: hilinevad ja kaua lahti olevad külastused lausetena. */
export function workerWarnings(worker, { t }) {
  const client = (item) => text(item?.client) || t("org.board.client_unnamed");
  return [
    ...(Array.isArray(worker?.late) ? worker.late : []).map((item) => ({ id: `late:${item.id}`, text: t("org.board.late_line", { client: client(item), minutes: String(item.minutesLate) }) })),
    ...(Array.isArray(worker?.needsCheck) ? worker.needsCheck : []).map((item) => ({ id: `check:${item.id}`, text: t("org.board.check_line", { client: client(item) }) }))
  ];
}

/**
 * Külastuse seisu sõna. Seisu, millel kataloogis sõna ei ole, ei näidata toore
 * nimena: siis on real üldsõna.
 */
export function visitStatusLabel(status, { t }) {
  const key = `service_log.route.status.${String(status || "").toLowerCase()}`;
  const label = t(key);
  return label && label !== key ? label : t("org.board.status_other");
}

/**
 * Töötaja külastused: klient, seis, kohalejõudmise aeg ja põhjus („tegemata"
 * ilma põhjuseta on number, mille tähendust juht kuu pärast ei tea). Teisele
 * anda saab ainult plaanis olevat külastust ja ainult siis, kui on, kellele anda.
 */
export function visitRows(worker, { t, locale, workerCount = 0 }) {
  /* `workerCount`: mitu TEIST töötajat on, kellele anda. */
  return (Array.isArray(worker?.visits) ? worker.visits : []).map((visit) => ({
    id: String(visit.id),
    title: text(visit.client) || t("org.board.client_unnamed"),
    sub: [
      visitStatusLabel(visit.status, { t }),
      /* Plaanis oleval tööl on plaanitud algus, käidud tööl kohalejõudmise aeg. */
      visit.status === "PLANNED" && timeOf(visit.plannedStartAt, locale) ? t("org.board.planned_at", { time: timeOf(visit.plannedStartAt, locale) }) : "",
      timeOf(visit.arrivedAt, locale) ? t("org.board.arrived_at", { time: timeOf(visit.arrivedAt, locale) }) : "",
      text(visit.outcomeReason)
    ]
      .filter(Boolean)
      .join(" · "),
    canReassign: visit.status === "PLANNED" && workerCount > 0
  }));
}

/**
 * Töötajate valikud määramiseks: nimi ja ametinimetus. `exceptMembershipId`
 * jätab välja selle, kelle käes töö praegu on (iseendale teisele anda ei saa).
 */
export function workerOptions(workers, { t, exceptMembershipId = "" } = {}) {
  return (Array.isArray(workers) ? workers : [])
    .filter((worker) => worker?.userId && (!exceptMembershipId || worker.membershipId !== exceptMembershipId))
    .map((worker) => ({ value: worker.userId, label: [text(worker.name) || t("org.inbox.unnamed_worker"), text(worker.jobTitle)].filter(Boolean).join(" · ") }));
}

/** Mis töö määramiseks puudu on: võti või tühi sõne. Töötaja ja klient on kohustuslikud. */
export function assignProblemKey(form) {
  if (!text(form?.assignTo)) return "org.board.need_worker";
  if (!text(form?.client)) return "org.board.need_client";
  return "";
}

/** Määramise päringu keha: plaanitud algus ISO kujul või puudub. */
export function assignPayload(form) {
  const start = text(form?.startAt) ? new Date(form.startAt) : null;
  return {
    action: "assign",
    workerUserId: form.assignTo,
    clientDisplayName: form.client,
    address: form.address,
    plannedStartAt: start && !Number.isNaN(start.getTime()) ? start.toISOString() : null
  };
}

/** Mis teisele andmiseks puudu on: võti või tühi sõne. Põhjus jääb kirja ja on kohustuslik. */
export function reassignProblemKey({ workerUserId, reason } = {}) {
  if (!text(workerUserId)) return "org.board.need_worker";
  if (!text(reason)) return "org.board.need_reason";
  return "";
}
