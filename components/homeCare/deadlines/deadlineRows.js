/**
 * Tähtaegade reeglid ilma joonistamiseta: mis nimekirjad hooldusjuhil on, mis
 * seisab ühe kliendi real ja kuhu rida viib.
 *
 * Tähtajad on nimekirjad, mida muidu peab hooldusjuht ise meeles pidama: otsus
 * lõpeb, kehtivat otsust või kava ei ole, kava ootab ülevaatamist, märkamised ja
 * teated ootavad vastust, esmakäigud, transpordi soovid, kuud, kuhu on hiljem
 * lisatud, töötajate kaardid ja palju muud. Nimekiri, milles midagi ei ole,
 * esimeses vaates ridana ei ole. Olek ja päring (rääkimise soovid) on konksus
 * ./useTalkRequests.js, vaated on ühised (../client/PartViews.jsx), kokku paneb
 * need ./Deadlines.jsx.
 */

import { daysLabel, minutesLabel } from "../decision/decisionRows";
import { workerRecordLine } from "../workers/workerRows";
import { clientHref } from "../homeCareClient";
import { changeSignalLine, changeWaitingText } from "../manage/manageRows";
import { euroText } from "../money/moneyRows";
import { planDayLabel } from "../plan/planRows";
import { preconditionLine } from "../safety/safetyRows";

/** Mitu rida on nimekirjas vaates enne nuppu „Näita veel". */
export const DEADLINES_PAGE = 4;

const warn = (text) => ({ text, tone: "wait" });

/**
 * Nimekirjad selles järjekorras, nagu hooldusjuht neid vajab; ainult need, milles midagi on.
 * Nimekiri: `{ key, title, items }`; rida: `{ key, title, chips, line, href }`. Rida viib kliendi lehele
 * (ei eellaadi), välja arvatud esmakäik (selle päeva plaan), muudetud kuu (selle kuu kokkuvõte) ja töötaja kaart (töötajate leht).
 */
export function deadlineSections(deadlines, { t, locale, organizationId, moment }) {
  /* Üks kliendi rida: nimi (ja märk, kui klient on ajutiselt ära), mis on lahti ja märk, kui see on kiire. */
  const client = (item, meta, badge, key = item.client.id) => ({
    key,
    title: item.client.displayName,
    chips: [item.client.status === "AWAY" ? warn(t("home_care.status.AWAY")) : null, badge].filter(Boolean),
    line: meta || "",
    href: clientHref(organizationId, item.client.id)
  });
  const overdue = (item) => (item.overdue ? warn(t("home_care.deadlines.overdue_badge")) : null);
  const monthText = (month) => month.split("-").reverse().join(".");

  const lists = [
    ["changes_open", deadlines.changesOpen, (item) => client(item, `${changeSignalLine(t, item)} · ${changeWaitingText(t, item)}`, null, item.id)],
    [
      "decisions_ending",
      deadlines.decisionsEnding,
      (item) => client(item, t("home_care.deadlines.ends_on", { date: planDayLabel(item.validUntil), when: daysLabel(t, item.daysLeft) }), item.soon ? warn(t("home_care.deadlines.soon_badge")) : null)
    ],
    [
      "no_decision",
      deadlines.noDecision,
      (item) =>
        client(
          item,
          [item.lastEndedOn ? t("home_care.deadlines.last_ended", { date: planDayLabel(item.lastEndedOn) }) : t("home_care.deadlines.never"), item.nextFrom ? t("home_care.deadlines.next_from", { date: planDayLabel(item.nextFrom) }) : null].filter(Boolean).join(" · ")
        )
    ],
    /* Kehtivad halduslepingud, mille allkiri on märkimata või ebakindel (K6-h). */
    [
      "contracts_unsigned",
      deadlines.contractsUnsigned,
      (item) =>
        client(
          item,
          t(item.noRepresentative ? "home_care.deadlines.contracts_unsigned_no_representative" : item.unsure ? "home_care.deadlines.contracts_unsigned_unsure" : "home_care.deadlines.contracts_unsigned_line", { date: planDayLabel(item.validFrom) }),
          null,
          `${item.client.id}:${item.validFrom}:${item.noRepresentative ? "r" : "s"}`
        )
    ],
    ["plans_due", deadlines.plansDue, (item) => client(item, t("home_care.deadlines.review_on", { date: planDayLabel(item.reviewOn), when: daysLabel(t, item.daysLeft) }), overdue(item))],
    ["no_plan", deadlines.noPlan, (item) => client(item, null)],
    ["preconditions_open", deadlines.preconditionsOpen, (item) => client(item, preconditionLine(t, item), overdue(item), item.id)],
    ["money_open", deadlines.moneyOpen, (item) => client(item, t("home_care.money.open_line", { name: item.holderName || "—", amount: euroText(item.balanceCents, locale), date: planDayLabel(item.lastOn) }), null, item.key)],
    ["safety_due", deadlines.safetyDue, (item) => client(item, item.state === "OLD" ? t("home_care.deadlines.safety_old", { date: planDayLabel(item.assessedOn) }) : t("home_care.deadlines.safety_none"))],
    /* Kvartali kontrollkõne tegemata (K6-l): hooldusjuht helistab kliendile ise. */
    ["control_calls", deadlines.controlCallsDue, (item) => client(item, item.lastReachedOn ? t("home_care.deadlines.control_calls_line", { date: planDayLabel(item.lastReachedOn) }) : t("home_care.deadlines.control_calls_never"))],
    /* Esindusõigused, mille tähtaeg on möödas või lõpeb varsti (K6-i). */
    [
      "representatives_due",
      deadlines.representativesDue,
      (item) =>
        client(
          item,
          t(item.expired ? "home_care.deadlines.representatives_due_expired" : "home_care.deadlines.representatives_due_line", { name: item.name, date: planDayLabel(item.validUntil) }),
          item.expired ? warn(t("home_care.deadlines.overdue_badge")) : null,
          item.id
        )
    ],
    [
      "relatives_due",
      deadlines.relativesDue,
      (item) => {
        const name = item.relation ? `${item.name} (${item.relation})` : item.name;
        return client(item, item.doubt ? t("home_care.deadlines.relatives_doubt_line", { name, by: item.doubtByName || "—" }) : t("home_care.deadlines.relatives_line", { name, date: planDayLabel(item.agreedOn) }), null, item.key);
      }
    ],
    ["risk_lines_due", deadlines.riskLinesDue, (item) => client(item, t("home_care.deadlines.risk_lines_line", { count: item.lines, date: planDayLabel(item.oldestOn) }))],
    /* Esmakäigud lähipäevil, mille kohta kliendile ei ole teatatud (K6-c); rida viib selle päeva plaani, kus teatamine märgitakse. */
    [
      "first_visits",
      deadlines.firstVisitsAhead,
      (item) => ({
        key: item.key,
        title: item.client.displayName,
        chips: [],
        line: t(item.notReached ? "home_care.deadlines.first_visits_not_reached" : "home_care.deadlines.first_visits_line", { date: planDayLabel(item.day), time: item.startTime, name: item.workerName || "—" }),
        href: `/org/${organizationId}/koduteenus/paev?paev=${item.day}`
      })
    ],
    /* Transpordi soovid, mis ootavad korraldamist (K5-w). */
    [
      "transport_open",
      deadlines.transportOpen,
      (item) =>
        client(
          item,
          t("home_care.deadlines.transport_open_line", {
            date: item.wantedTime ? t("home_care.transport.when_time", { date: planDayLabel(item.wantedOn), time: item.wantedTime }) : planDayLabel(item.wantedOn),
            destination: item.destination,
            name: item.requestedByName || "—"
          }),
          null,
          item.key
        )
    ],
    /* Teated otsustajale (K5-r): vastuseta teated ja lubatud uus hindamine, mille päev on möödas. */
    [
      "notices_waiting",
      deadlines.noticesWaiting,
      (item) => client(item, t("home_care.deadlines.notices_waiting_line", { reason: t(`home_care.notice.reasons.${item.reason}`), date: planDayLabel(item.sentOn), days: item.days }), null, item.key)
    ],
    ["reassess_overdue", deadlines.reassessOverdue, (item) => client(item, t("home_care.deadlines.reassess_overdue_line", { date: planDayLabel(item.reassessBy), days: item.days }), null, item.key)],
    /* Koju tulnud kliendid, kelle juures ei ole pärast naasmist käidud (K6-f). */
    [
      "homecomings",
      deadlines.homecomingsOpen,
      (item) => client(item, [item.reason ? t(`home_care.status_reason.AWAY.${item.reason}`) : null, t("home_care.deadlines.homecomings_line", { date: planDayLabel(item.returnedOn), from: planDayLabel(item.awayFrom) })].filter(Boolean).join(" · "))
    ],
    /* Abi rohkem kui kavas (K6-d): käigul märgitud viis on olnud kava reast suurem. */
    ["help_drift", deadlines.helpDriftDue, (item) => client(item, t("home_care.deadlines.help_drift_line", { more: item.more, total: item.total }))],
    /* Osutatud aeg kolm lukustatud kuud järjest üle otsustatu (K5-q): põhjus otsustajale teada anda. */
    [
      "over_volume",
      deadlines.overVolumeStreak,
      (item) =>
        client(item, t("home_care.deadlines.over_volume_line", { list: item.months.map((month) => `${monthText(month.month)} +${minutesLabel(t, month.minutes - month.expectedMinutes)}`).join(" · ") }))
    ],
    /* Lukustatud kuud, kuhu on hiljem lisatud või muudetud (K5-p); rida viib selle kuu kokkuvõttesse. */
    [
      "month_changed",
      deadlines.monthLocksChanged,
      (item) => ({ key: item.month, title: monthText(item.month), chips: [], line: t("home_care.deadlines.month_changed_line", { count: item.changes }), href: `/org/${organizationId}/koduteenus/kuu?kuu=${item.month}` })
    ],
    /* Töötajate kaardid (K5-e): ainult kogu asutuse hooldusjuhile; rida viib töötajate lehele. */
    [
      "workers_due",
      deadlines.workerRecordsDue,
      (item) => ({ key: item.key, title: item.worker.name, chips: item.expired ? [warn(t("home_care.workers.expired"))] : [], line: workerRecordLine(t, item), href: `/org/${organizationId}/koduteenus/tootajad` })
    ],
    [
      "away_long",
      deadlines.awayLong,
      (item) => client(item, [item.reason ? t(`home_care.status_reason.AWAY.${item.reason}`) : null, t("home_care.deadlines.away_since", { date: planDayLabel(item.since), days: item.days })].filter(Boolean).join(" · "))
    ],
    [
      "supplies_open",
      deadlines.suppliesOpen,
      (item) =>
        client(
          item,
          t("home_care.supplies.open_line", { kind: t(`home_care.supplies.kinds.${item.kind}`), state: t(`home_care.supplies.states.${item.state}`), name: item.responsible, when: moment(item.checkedAt) }),
          item.state === "OUT" ? warn(t("home_care.supplies.states.OUT")) : null,
          item.id
        )
    ],
    /* Tagasiside (K4-d): kellelt on aeg küsida. Kirja pannakse see kliendi päevikusse. */
    ["feedback_overdue", deadlines.feedbackOverdue, (item) => client(item, item.lastOn ? t("home_care.deadlines.feedback_last", { date: planDayLabel(item.lastOn) }) : t("home_care.deadlines.feedback_never"))],
    ["feedback_at_end", deadlines.feedbackAtEnd, (item) => client(item, t("home_care.deadlines.feedback_ended_on", { date: planDayLabel(item.endedOn) }))],
    ["work_nature_due", deadlines.workNatureDue, (item) => client(item, t("home_care.deadlines.review_on", { date: planDayLabel(item.reviewOn), when: daysLabel(t, item.daysLeft) }), overdue(item))]
  ];
  return lists
    .map(([key, items, build]) => ({ key, title: t(`home_care.deadlines.${key}_title`), items: (items || []).map(build) }))
    .filter((section) => section.items.length);
}

/** Nimekirjad esimese vaate ridadena: `[{ key, title }]`; pealkirjas on ridade arv. */
export function sectionRows(sections) {
  return sections.map((section) => ({ key: section.key, title: `${section.title} · ${section.items.length}` }));
}

/** Rääkimise soovid esimese vaate real: `{ key, title }`; inimene ootab, seepärast on see ees. */
export function talkRow(items, { t }) {
  return items.length ? { key: "talk", title: `${t("home_care.talk.list_title")} · ${items.length}`, tone: "risk" } : null;
}

/** Rääkimise soovid ridadena: `[{ key, title, line }]`; real on kes soovib, mis juhtumi järel ja mis ajast. */
export function talkRows(items, { t, moment }) {
  return items.map((item) => ({
    key: item.id,
    title: item.client.displayName,
    line: t("home_care.talk.list_line", { name: item.requesterName || "—", type: item.incidentType ? t(`home_care.incident.types.${item.incidentType}`) : "—", date: moment(item.requestedAt) })
  }));
}
