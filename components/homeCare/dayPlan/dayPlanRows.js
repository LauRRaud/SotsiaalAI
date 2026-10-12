/**
 * Hooldusjuhi päevaplaani reeglid ilma joonistamiseta: mis rühmad päeval on, mis
 * seisab käigu real, mida käiguga teha tohib ja mis lause on päeva kohta.
 *
 * Päevaplaan on käigumuster koos selle päeva eranditega. Käigud on töötaja
 * kaupa, määramata käigud kõige ees (need vajavad otsust). Käigu saab üheks
 * päevaks ümber tõsta (teine töötaja ja/või kellaaeg) või ära jätta põhjusega;
 * muster ise ei muutu. Käigu seis tuleb käigu kirjetest, käsitsi seda siin ei
 * märgita. Olek ja päringud on konksus ./useDayPlan.js, vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./DayPlan.jsx.
 */

import { CARE_FIRST_VISIT_OUTCOMES, CARE_VISIT_CANCEL_REASONS, CarePlannedState } from "@/lib/homeCare/constants";
import { continuityImpact } from "@/lib/homeCare/continuityImpact";

import { minutesLabel } from "../decision/decisionRows";
import { keyWhere } from "../keys/keyRows";
import { planDayLabel } from "../plan/planRows";
import { rideText } from "../transport/transportRows";

/** Mitu rida on loendis vaates enne nuppu „Näita veel". */
export const DAY_PAGE = 4;

/** Päeva nimi: nädalapäev ja kuupäev. */
export function dayTitle(t, data) {
  return `${t(`home_care.slots.weekdays_long.${data.weekday}`)} ${planDayLabel(data.day)}`;
}

/** Päeva kokkuvõte ühe lausena. */
export function totalsLine(t, data) {
  return t("home_care.day.totals", {
    planned: data.totals.planned,
    amount: minutesLabel(t, data.totals.minutes),
    done: data.totals.done,
    missing: data.totals.missing,
    cancelled: data.totals.cancelled,
    unassigned: data.totals.unassigned,
    uncovered: data.totals.uncovered || 0
  });
}

/** Takistuse rida: kes, mis takistas ja mis kell teatas. */
export function obstacleLine(t, obstacle, name, time) {
  return t("home_care.day.obstacle_line", { name: name || "—", kind: t(`home_care.obstacle.kinds_about.${obstacle.kind}`), time: time(obstacle.reportedAt) });
}

/** Päeval ei ole midagi. */
export function dayEmpty(data) {
  return (data.uncovered || []).length === 0 && (data.obstacles || []).length === 0 && data.unassigned.length === 0 && data.workers.length === 0 && data.away.length === 0;
}

/**
 * Päeva rühmad selles järjekorras, nagu hooldusjuht neid vajab: tegija puudub,
 * takistused, määramata, töötajad, klient on ära. Rühm: `{ key, title, visits, hint, sheetOf, obstacles }`;
 * `sheetOf` on töötaja, kelle päevalehe saab trükkida (null: kõigi leht).
 */
export function dayGroups(data, { t, time }) {
  const groups = [];
  const uncovered = data.uncovered || [];
  const obstacles = data.obstacles || [];
  if (uncovered.length) groups.push({ key: "uncovered", title: t("home_care.day.uncovered_title"), visits: uncovered, hint: t("home_care.day.uncovered_hint"), risk: true });
  if (obstacles.length) groups.push({ key: "obstacles", title: t("home_care.day.obstacles_title"), visits: [], obstacles, hint: t("home_care.day.obstacles_hint"), risk: true });
  if (data.unassigned.length) groups.push({ key: "unassigned", title: t("home_care.day.unassigned_title"), visits: data.unassigned, hint: "", risk: true });
  for (const worker of data.workers) {
    groups.push({
      key: `w-${worker.membershipId}`,
      title: worker.name || "—",
      visits: worker.visits,
      hint: worker.obstacle ? t("home_care.day.obstacle_seen", { line: obstacleLine(t, worker.obstacle, worker.name, time) }) : "",
      sheetOf: worker.membershipId,
      risk: false
    });
  }
  if (data.away.length) groups.push({ key: "away", title: t("home_care.day.away_title"), visits: data.away, hint: t("home_care.day.away_hint"), risk: false });
  return groups;
}

/** Rühmad esimese vaate ridadena: `[{ key, title, tone }]`; pealkirjas on käikude arv (takistuste rühmas takistuste arv). */
export function groupRows(groups) {
  return groups.map((group) => ({ key: group.key, title: `${group.title} · ${group.obstacles ? group.obstacles.length : group.visits.length}`, tone: group.risk ? "risk" : "" }));
}

/** Käigu märgid: seis, ravim, tähtsus, puuduv töötaja, ümber tõstetud, aeg muudetud ja töötaja, kes ei ole enam aktiivne; `[{ text, tone }]`. */
export function visitChips(visit, { t }) {
  const medicationWarn = visit.medication === "UNMARKED" || visit.medication === "NOT_DONE" || visit.medication === "MISSED";
  return [
    {
      text: t(`home_care.day.states.${visit.state}`),
      tone: visit.state === CarePlannedState.MISSING || visit.state === CarePlannedState.CANCELLED ? "wait" : visit.state === CarePlannedState.DONE ? "ok" : ""
    },
    visit.medication ? { text: t(`home_care.medication.states.${visit.medication}`), tone: medicationWarn ? "wait" : "" } : null,
    visit.workerAbsent || visit.priority === "A" ? { text: t(`home_care.priority.short.${visit.priority}`), tone: "" } : null,
    visit.workerAbsent ? { text: t("home_care.day.absent_worker", { name: visit.worker?.name || "—" }), tone: "wait" } : null,
    visit.change?.workerChanged ? { text: t("home_care.day.changed_worker"), tone: "" } : null,
    visit.change?.timeChanged ? { text: t("home_care.day.changed_time"), tone: "" } : null,
    visit.worker && !visit.worker.active ? { text: t("home_care.slots.worker_inactive"), tone: "wait" } : null
  ].filter(Boolean);
}

/** Käigu rida: kestus, aadress, märkus, ära jätmise põhjus, muudatuse märkus, võti, sõit; üks lause. */
export function visitLine(visit, { t }) {
  const cancelled = visit.state === CarePlannedState.CANCELLED;
  const done = visit.state === CarePlannedState.DONE;
  return [
    minutesLabel(t, visit.plannedMinutes),
    visit.client.address,
    visit.note,
    cancelled && visit.change?.reason ? t(`home_care.day.cancel_reasons.${visit.change.reason}`) : null,
    visit.change?.note,
    /* Võti (K4-b): tegemata käigul, mille tegijal selle kliendi võtit ei ole. */
    visit.key && !visit.key.held && !cancelled && !done ? keyWhere(t, visit.key) : null,
    /* Sõit (K5-w): kliendil on sel päeval korraldatud sõit. */
    visit.ride ? rideText(t, visit.ride) : null
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Käigu laused: kojutulek (K6-f) ja esmakäik (K5-v); `[string]`. */
export function visitNotices(visit, { t }) {
  return [
    visit.homecoming ? t("home_care.homecoming.day_line", { date: planDayLabel(visit.homecoming.returnedOn) }) : null,
    visit.firstVisit
      ? `${t("home_care.first_visit.day_line", { name: visit.worker?.name || "—" })} ${visit.firstVisit.outcome ? t(`home_care.first_visit.outcomes.${visit.firstVisit.outcome}`) : t("home_care.first_visit.not_marked")}`
      : null
  ].filter(Boolean);
}

/** Käigud loendi ridadena: `[{ key, title, chips, lines, tone }]`. */
export function visitRows(visits, { t }) {
  return visits.map((visit) => ({
    key: visit.slotId,
    title: `${visit.startTime} ${visit.client.displayName}`,
    chips: visitChips(visit, { t }),
    lines: [visitLine(visit, { t }), ...visitNotices(visit, { t })].filter(Boolean)
  }));
}

/** Käigu leidmine päeva andmetest. */
export function findVisit(data, slotId) {
  const lists = [data.uncovered || [], data.unassigned || [], data.away || [], ...data.workers.map((worker) => worker.visits), ...(data.obstacles || []).map((obstacle) => obstacle.visits || [])];
  for (const list of lists) {
    const found = list.find((visit) => visit.slotId === slotId);
    if (found) return found;
  }
  return null;
}

/**
 * Mida inimene käiguga teha tohib: tõstab ümber (ei ole ära jäetud, ei ole tehtud, päev ei ole möödas),
 * jätab ära (ei ole ära jäetud ega tehtud), võtab muudatuse tagasi (kui on muudatus) ja märgib esmakäigu.
 */
export function visitRights(visit, data, { canEdit }) {
  const cancelled = visit.state === CarePlannedState.CANCELLED;
  const done = visit.state === CarePlannedState.DONE;
  return {
    move: Boolean(canEdit && !cancelled && !done && data.day >= data.today),
    cancel: Boolean(canEdit && !cancelled && !done),
    restore: Boolean(canEdit && visit.change),
    mark: Boolean(canEdit && visit.firstVisit)
  };
}

/** Vorm käigu ümbertõstmiseks: puuduvat töötajat valikus ei ole, ümbertõstmine algab seisust „määramata". */
export function moveForm(visit) {
  return { workerMembershipId: visit.workerAbsent ? "" : visit.worker?.membershipId || "", startTime: visit.startTime, reason: "", note: "" };
}

/** Kellele saab selle käigu tõsta: kliendi meeskonna liikmed ees (nemad tunnevad klienti), sel päeval puudujaid ei pakuta. */
export function workerChoices(visit, data, { t }) {
  const team = new Set(data.teams?.[visit.client.id] || []);
  const present = (data.careWorkers || []).filter((worker) => !worker.absent);
  return [
    { value: "", label: t("home_care.day.worker_none") },
    ...present.filter((worker) => team.has(worker.membershipId)).map((worker) => ({ value: worker.membershipId, label: t("home_care.day.team_option", { name: worker.name || "—" }) })),
    ...present.filter((worker) => !team.has(worker.membershipId)).map((worker) => ({ value: worker.membershipId, label: worker.name || "—" }))
  ];
}

/** Püsivus (K5-x): valitud töötaja ei ole viimasel neljal nädalal selle kliendi juures käinud; lause või tühi. */
export function continuityNote(visit, data, workerMembershipId, { t }) {
  if (workerMembershipId === (visit.worker?.membershipId || "")) return "";
  const impact = continuityImpact(data.recentWorkers?.[visit.client.id], workerMembershipId);
  return impact ? t("home_care.day.continuity_impact", { count: impact.count }) : "";
}

/** Ära jätmise põhjused: `[{ value, label }]`. */
export function cancelChoices(t) {
  return CARE_VISIT_CANCEL_REASONS.map((value) => ({ value, label: t(`home_care.day.cancel_reasons.${value}`) }));
}

/** Esmakäigu märkimise valikud: `[{ value, label }]`. */
export function firstVisitChoices(t) {
  return CARE_FIRST_VISIT_OUTCOMES.map((value) => ({ value, label: t(`home_care.first_visit.mark.${value}`) }));
}

/** Nädala päevad ridadena: `[{ key, title, line, chip, tone }]`; „!" tähendab, et päeval on midagi lahti. */
export function weekRows(data, { t }) {
  return data.week.map((item) => ({
    key: item.day,
    title: `${t(`home_care.slots.weekdays_long.${item.weekday}`)} ${planDayLabel(item.day)}`,
    line: t("home_care.day.week_day", {
      weekday: t(`home_care.slots.weekdays_long.${item.weekday}`),
      date: planDayLabel(item.day),
      planned: item.planned,
      unassigned: item.unassigned,
      missing: item.missing,
      uncovered: item.uncovered || 0
    }),
    chip: item.day === data.day ? { text: t("home_care.parts.picked"), tone: "ok" } : null,
    tone: item.unassigned || item.missing || item.uncovered ? "risk" : ""
  }));
}
