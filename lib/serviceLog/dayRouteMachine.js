/**
 * TEENUSPÄEVIK E2c — PÄEVATEEKONNA OLEKUMASIN.
 *
 * PUHAS: ei Prismat, ei i18n-i, ei kellaaega väljastpoolt sisse andmata. Kogu
 * „mis tohib millele järgneda" elab siin, sest just see on koht, kus vaikne
 * viga muutub valeks arveks — ja seda peab saama testida ilma andmebaasita.
 *
 * MIKS OLEKUMASIN NELJA MÄRKE ASEMEL.
 *
 * OSA I voog oli [LÄKSIN]→[KOHAL]→[LAHKUSIN]→[TAGASI]. Ta eeldas, et külastus
 * algab kontorist ja lõpeb kontoris. Koduhooldaja tööpäev EI OLE selline: kuus
 * klienti järjest, tagasi ei minda. Töötaja valik oli seni kas jätta [TAGASI]
 * vajutamata (kaob sõidulõik) või märkida midagi, mida ei juhtunud.
 *
 * Päevateekonnal on **järgmise töö `EN_ROUTE→ARRIVED` eelmise lahkumise
 * sõidulõik**. Fiktiivset tagasitulekut ei ole vaja, sest ta ei ole enam ainus
 * viis sõiduaega kirja saada.
 *
 * KOLM REEGLIT, MIS EI OLE LÄBIRÄÄGITAVAD:
 *
 * 1. AEG EI LIIGU TAGASI. Tagasiliikuv tempel ei ole näpuviga, vaid negatiivne
 *    kestus arve alusdokumendis.
 *
 * 2. LÕPETATUD KÜLASTUS ON LÕPETATUD. `COMPLETED` on lõppseis; parandus käib
 *    `NEEDS_CORRECTION` kaudu ja jätab jälje, mitte vaikse ülekirjutuse.
 *
 * 3. ÄRAJÄÄMINE VAJAB PÕHJUST. `CANCELLED` ja `NOT_DONE` ilma põhjuseta on
 *    number, mille tähendust keegi kuu pärast ei tea — ja just neid ridu
 *    küsib KOV kõige tõenäolisemalt üle.
 */

export const VISIT_STATUS = Object.freeze({
  PLANNED: "PLANNED",
  EN_ROUTE: "EN_ROUTE",
  ARRIVED: "ARRIVED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NOT_DONE: "NOT_DONE",
  NEEDS_CORRECTION: "NEEDS_CORRECTION"
});

export const VISIT_STATUSES = Object.freeze(Object.values(VISIT_STATUS));

export const ROUTE_STATUS = Object.freeze({ OPEN: "OPEN", CLOSED: "CLOSED" });

/** Külastus on „käigus": ta hoiab tööpäeva lahti ja teda ei tohi vahele jätta. */
export const ACTIVE_VISIT_STATUSES = Object.freeze([VISIT_STATUS.EN_ROUTE, VISIT_STATUS.ARRIVED]);

/** Lõppseisud: siit edasi liigub ainult parandus. */
export const TERMINAL_VISIT_STATUSES = Object.freeze([
  VISIT_STATUS.COMPLETED,
  VISIT_STATUS.CANCELLED,
  VISIT_STATUS.NOT_DONE
]);

export const VISIT_ACTION = Object.freeze({
  DEPART: "depart",
  ARRIVE: "arrive",
  COMPLETE: "complete",
  CANCEL: "cancel",
  NOT_DONE: "not_done",
  FLAG_CORRECTION: "flag_correction",
  RESOLVE_CORRECTION: "resolve_correction"
});

/**
 * LUBATUD ÜLEMINEKUD.
 *
 * `PLANNED → ARRIVED` on TAHTLIKULT lubatud ilma `EN_ROUTE`-ta: töötaja võib
 * olla juba kohal (kõrvalmaja, jalgsi, unustas vajutada). Sundida teda
 * vajutama „läksin teele" pärast kohalejõudmist tähendaks õpetada talle, et
 * nupud on formaalsus. Sõidulõik jääb siis lihtsalt mõõtmata — see on aus
 * tulemus, erinevalt väljamõeldud lõigust.
 */
const TRANSITIONS = Object.freeze({
  [VISIT_STATUS.PLANNED]: Object.freeze({
    [VISIT_ACTION.DEPART]: VISIT_STATUS.EN_ROUTE,
    [VISIT_ACTION.ARRIVE]: VISIT_STATUS.ARRIVED,
    [VISIT_ACTION.CANCEL]: VISIT_STATUS.CANCELLED,
    [VISIT_ACTION.NOT_DONE]: VISIT_STATUS.NOT_DONE
  }),
  [VISIT_STATUS.EN_ROUTE]: Object.freeze({
    [VISIT_ACTION.ARRIVE]: VISIT_STATUS.ARRIVED,
    /* Teel olles võib selguda, et klienti ei ole kodus. See EI OLE ärajäänud
       plaan (`CANCELLED`), vaid tegemata jäänud töö — ja sõiduaeg on ikka
       tehtud töö, mille eest tuleb tasu. */
    [VISIT_ACTION.NOT_DONE]: VISIT_STATUS.NOT_DONE,
    [VISIT_ACTION.CANCEL]: VISIT_STATUS.CANCELLED
  }),
  [VISIT_STATUS.ARRIVED]: Object.freeze({
    [VISIT_ACTION.COMPLETE]: VISIT_STATUS.COMPLETED,
    [VISIT_ACTION.NOT_DONE]: VISIT_STATUS.NOT_DONE
  }),
  /* Lõpetatud külastust ei „muudeta tagasi". Ainus tee edasi on märkida ta
     parandust vajavaks — nii jääb jälg sellest, ET parandati. */
  [VISIT_STATUS.COMPLETED]: Object.freeze({
    [VISIT_ACTION.FLAG_CORRECTION]: VISIT_STATUS.NEEDS_CORRECTION
  }),
  [VISIT_STATUS.CANCELLED]: Object.freeze({
    [VISIT_ACTION.FLAG_CORRECTION]: VISIT_STATUS.NEEDS_CORRECTION
  }),
  [VISIT_STATUS.NOT_DONE]: Object.freeze({
    [VISIT_ACTION.FLAG_CORRECTION]: VISIT_STATUS.NEEDS_CORRECTION
  }),
  [VISIT_STATUS.NEEDS_CORRECTION]: Object.freeze({
    [VISIT_ACTION.RESOLVE_CORRECTION]: VISIT_STATUS.COMPLETED,
    [VISIT_ACTION.CANCEL]: VISIT_STATUS.CANCELLED,
    [VISIT_ACTION.NOT_DONE]: VISIT_STATUS.NOT_DONE
  })
});

/** Millised toimingud vajavad PÕHJUST (vt faili päise reegel 3). */
export const REASON_REQUIRED_ACTIONS = Object.freeze([
  VISIT_ACTION.CANCEL,
  VISIT_ACTION.NOT_DONE,
  VISIT_ACTION.FLAG_CORRECTION
]);

/** Millise ajatempli toiming kirjutab. `null` = ei kirjuta ühtegi. */
export const ACTION_TIMESTAMP = Object.freeze({
  [VISIT_ACTION.DEPART]: "enRouteAt",
  [VISIT_ACTION.ARRIVE]: "arrivedAt",
  [VISIT_ACTION.COMPLETE]: "completedAt",
  [VISIT_ACTION.CANCEL]: "cancelledAt",
  [VISIT_ACTION.NOT_DONE]: "cancelledAt",
  [VISIT_ACTION.FLAG_CORRECTION]: null,
  [VISIT_ACTION.RESOLVE_CORRECTION]: null
});

/**
 * Templite ajaline järjekord. Tema järgi otsustatakse, kumb pool peab olema
 * varasem — mitte „eelmine olek", sest vahepealne tempel võib puududa.
 *
 * `cancelledAt` ON SIIN LÕPUS ja tema puudumine oli viga: `indexOf` andis −1,
 * mistõttu kontroll nõudis, et tühistamine toimuks ENNE saabumist. Päris
 * juhtum, mis oleks selle peale kukkunud: töötaja jõuab kohale, klienti ei ole
 * kodus, ta märgib „tegemata" — ja süsteem oleks öelnud „aeg liigub tagasi".
 */
const STAMP_ORDER = ["enRouteAt", "arrivedAt", "completedAt", "cancelledAt"];

export function isVisitStatus(value) {
  return VISIT_STATUSES.includes(String(value || ""));
}

export function nextStatus(status, action) {
  return TRANSITIONS[status]?.[action] || null;
}

export function allowedActions(status) {
  return Object.keys(TRANSITIONS[status] || {});
}

export function isActiveVisit(status) {
  return ACTIVE_VISIT_STATUSES.includes(status);
}

export function isTerminalVisit(status) {
  return TERMINAL_VISIT_STATUSES.includes(status);
}

function toTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

/**
 * Kas üleminek on lubatud JA kas templid jäävad kasvavaks.
 *
 * @returns `{ ok: true, status, timestampField }` või `{ ok: false, reason }`.
 *   Vastus on objekt, mitte visatud viga: kutsuja teab veakoodi järgi, kas
 *   vastata 400 või 409-ga, ilma et peaks veateksti lugema.
 */
export function evaluateTransition(visit, action, { at, reason } = {}) {
  const status = String(visit?.status || "");
  if (!isVisitStatus(status)) return { ok: false, reason: "unknown_status" };

  const target = nextStatus(status, action);
  if (!target) return { ok: false, reason: "transition_not_allowed" };

  if (REASON_REQUIRED_ACTIONS.includes(action) && !String(reason || "").trim()) {
    return { ok: false, reason: "reason_required" };
  }

  const field = ACTION_TIMESTAMP[action] ?? null;
  if (field) {
    const stamp = toTime(at);
    if (stamp === null) return { ok: false, reason: "timestamp_invalid" };

    /* AEG EI LIIGU TAGASI. Kontrollime KÕIGI juba olemasolevate templite
       vastu, mitte ainult eelmise vastu: puuduv vahepealne tempel (nt
       `enRouteAt` jäi vajutamata) ei tohi lubada hilisemal templil varasemast
       ettepoole hiilida. */
    for (const existing of STAMP_ORDER) {
      if (existing === field) continue;
      const other = toTime(visit?.[existing]);
      if (other === null) continue;
      const existingIsEarlier = STAMP_ORDER.indexOf(existing) < STAMP_ORDER.indexOf(field);
      if (existingIsEarlier && stamp < other) return { ok: false, reason: "timestamp_backwards" };
      if (!existingIsEarlier && stamp > other) return { ok: false, reason: "timestamp_backwards" };
    }
  }

  return { ok: true, status: target, timestampField: field };
}

/**
 * SÕIDULÕIK. `enRouteAt → arrivedAt` ja mitte midagi muud.
 *
 * See funktsioon on kogu paranduse tuum ühe reana: eelmise külastuse lahkumine
 * ei vaja enam „tagasi" märget, sest järgmise külastuse teeleasumine ONGI
 * selle sõidu algus.
 */
export function travelMinutesOf(visit) {
  const from = toTime(visit?.enRouteAt);
  const to = toTime(visit?.arrivedAt);
  if (from === null || to === null) return null;
  const minutes = (to - from) / 60000;
  return minutes > 0 ? Math.round(minutes) : null;
}

/** Teenuse kestus kohapeal: `arrivedAt → completedAt`. */
export function serviceMinutesOf(visit) {
  const from = toTime(visit?.arrivedAt);
  const to = toTime(visit?.completedAt);
  if (from === null || to === null) return null;
  const minutes = (to - from) / 60000;
  return minutes > 0 ? Math.round(minutes) : null;
}

/**
 * PÄEVA KOOND. Pausi minutid tulevad teekonnalt ja neid EI arvestata tööajaks
 * (leping E12: „tööväline paus ei lähe arvestusse").
 */
export function summarizeRoute(visits = [], { breakMinutes = 0 } = {}) {
  let travel = 0;
  let service = 0;
  const counts = {};
  for (const visit of visits) {
    counts[visit.status] = (counts[visit.status] || 0) + 1;
    travel += travelMinutesOf(visit) || 0;
    /* Ärajäänud külastuse SÕIT loeb — töötaja sõitis päriselt. Teenuse kestust
       tal ei ole, sest teenust ei osutatud. */
    if (visit.status === VISIT_STATUS.COMPLETED) service += serviceMinutesOf(visit) || 0;
  }
  return {
    visits: visits.length,
    counts,
    travelMinutes: travel,
    serviceMinutes: service,
    breakMinutes: Math.max(0, Number(breakMinutes) || 0)
  };
}

/**
 * TURVASIGNAALI SULGUR (leping E2c). Pooleli `EN_ROUTE`/`ARRIVED` üle
 * kokkulepitud kontrollaja vajab kontrolli.
 *
 * See EI OLE jälgimine: me ei tea, kus inimene on, ja me ei küsi. Me teame
 * ainult, et üks nupp jäi vajutamata kauemaks, kui ükski külastus kestab —
 * ja see on täpselt see signaal, mille puudumine tegi vana neljamärke voo
 * turvalisuse lubaduse tühjaks.
 */
export const DEFAULT_STALE_VISIT_MINUTES = 240;

export function staleVisits(visits = [], { now = new Date(), minutes = DEFAULT_STALE_VISIT_MINUTES } = {}) {
  const limit = toTime(now) - minutes * 60000;
  return visits.filter((visit) => {
    if (!isActiveVisit(visit.status)) return false;
    const since = toTime(visit.arrivedAt) ?? toTime(visit.enRouteAt);
    return since !== null && since < limit;
  });
}
