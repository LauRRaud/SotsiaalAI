/**
 * Avatud päevikukirje reeglid ilma joonistamiseta: kes mida teha tohib, mis
 * märgid ja sõnade read kirjel on, mis tegevused on vaates ees ja mida ütlevad
 * varasema sisu, juhtumi käigu ja rääkimise soovi read.
 *
 * Olek ja päringud on konksudes (./useEntryActions.js, ./useIncidentTrail.js,
 * ./useTalkRequest.js), vaated failis ./EntryOpenViews.jsx; kokku paneb need
 * ./EntryOpen.jsx.
 */

import { CARE_TALK_INCIDENT_TYPES } from "@/lib/homeCare/constants";

import { entryChips } from "./diaryRows";

/**
 * Kes mida kirjega teha tohib. `showClient`: kirje on mitme kliendi loendis
 * (erijuhtumite leht, hooldusjuhi ülevaade), kus parandamine ei käi: see käib
 * kliendi lehel, kus on olemas kaart ja meeskond.
 *
 * Erijuhtumi tühistab hooldusjuht: autori tühistus võtaks lahtise juhtumi
 * registrist vaikselt maha. Juhtumi käiku näevad hooldusjuht ja autor (autor
 * ainult oma täiendusi). Server keelab sama.
 */
export function entryRights(entry, { canWrite = false, isCoordinator = false, showClient = false }) {
  const retracted = Boolean(entry.retractedAt);
  const incident = entry.incident;
  const canEdit = canWrite && !showClient && (entry.isMine || isCoordinator);
  return {
    retracted,
    canEdit,
    canRetract: canEdit && (!incident || isCoordinator),
    canSeeHistory: !showClient && (entry.isMine || isCoordinator) && entry.revision > 1,
    canSetIncident: Boolean(canWrite && isCoordinator && incident && !retracted),
    canSeeTrail: Boolean(incident) && (isCoordinator || entry.isMine),
    /* „Soovin sellest rääkida": küsib raske juhtumi autor, vastab hooldusjuht. */
    canAskTalk: Boolean(canWrite && entry.isMine && incident && !retracted && CARE_TALK_INCIDENT_TYPES.includes(incident.type)),
    canHandleTalk: Boolean(canWrite && isCoordinator)
  };
}

/**
 * Tegevused avatud kirje all selles järjekorras, nagu need vaates on:
 * `["correct", "retract", "history", "trail", "in_review", "close", "reopen"]` seast need, mis on lubatud.
 */
export function entryActions(entry, rights) {
  const status = entry.incident?.status;
  return [
    rights.canEdit && !rights.retracted ? "correct" : null,
    rights.canRetract && !rights.retracted ? "retract" : null,
    rights.canSeeHistory ? "history" : null,
    rights.canSeeTrail ? "trail" : null,
    rights.canSetIncident && status === "OPEN" ? "in_review" : null,
    rights.canSetIncident && status !== "CLOSED" ? "close" : null,
    rights.canSetIncident && status === "CLOSED" ? "reopen" : null
  ].filter(Boolean);
}

/** Tegevuse sõna võti. */
export const ACTION_LABELS = Object.freeze({
  correct: "home_care.entry.correct",
  retract: "home_care.entry.retract",
  history: "home_care.entry.history",
  trail: "home_care.trail.toggle",
  in_review: "home_care.incident.set_in_review",
  close: "home_care.incident.close",
  reopen: "home_care.incident.reopen"
});

/**
 * Avatud kirje märgid: samad mis loendi real (liik, kontakt, erijuhtumi seis)
 * ja lisaks see, kuidas kirje päevikusse jõudis.
 */
export function openChips(entry, { t }) {
  return [
    ...entryChips(entry, { t }),
    entry.call ? { key: "call", text: `${t(`home_care.call.callers.${entry.call.caller}`)} · ${t(`home_care.call.topics.${entry.call.topic}`)}` } : null,
    entry.coordinatorOnly ? { key: "coordinator_only", text: t("home_care.entry.coordinator_only") } : null,
    entry.writtenLater ? { key: "written_later", text: t("home_care.entry.written_later") } : null,
    entry.sentLater ? { key: "sent_later", text: t("home_care.entry.sent_later") } : null,
    entry.corrected ? { key: "corrected", text: t("home_care.entry.corrected") } : null
  ].filter(Boolean);
}

/**
 * Vaiksed read kirje ülaserva all: millal server kirje sai (hiljem kohale
 * jõudnud kirjel: sündmuse aeg on inimese või seadme väide, see aeg on serveri
 * oma) ja kas teadet järgmisele on loetud (autorile ja hooldusjuhile).
 */
export function openNotes(entry, { t, moment, isCoordinator }) {
  const retracted = Boolean(entry.retractedAt);
  return [
    (entry.writtenLater || entry.sentLater) && entry.createdAt ? t("home_care.entry.arrived_at", { time: moment(entry.createdAt) }) : null,
    entry.kind === "HANDOVER" && !retracted && (entry.isMine || isCoordinator)
      ? entry.readCount > 0
        ? t("home_care.entry.read_count", { count: entry.readCount })
        : t("home_care.entry.unread")
      : null
  ].filter(Boolean);
}

/**
 * Käigul tehtud toimingud (K2-d): `[{ key, name, line, wait, outside }]`.
 * `line`: kuidas tehti või miks jäi tegemata, ravimitoimingul ka mida tehti;
 * `wait`: toiming jäi tegemata; `outside`: toiming ei olnud kavas.
 */
export function openActivities(entry, { t }) {
  return (entry.visit?.activities || []).map((activity) => {
    const skipped = Boolean(activity.outcome && activity.outcome !== "DONE");
    return {
      key: activity.id,
      name: activity.name,
      line: [
        skipped ? t(`home_care.visit.outcomes.${activity.outcome}`) : t(`home_care.visit.modes.${activity.mode}`),
        activity.medication ? t(`home_care.medication.actions.${activity.medication}`) : null
      ]
        .filter(Boolean)
        .join(" · "),
      wait: skipped,
      outside: Boolean(activity.outsidePlan)
    };
  });
}

/**
 * Sõnade read avatud kirjes: `[{ key, label, value, chip }]`. Tühistatud
 * erijuhtumil hinnangut ja tehtud samme ei näidata (tekst on tühistatud), mida
 * tehti ja kes vastutab jäävad. `time` vormindab kellaaja.
 */
export function openFacts(entry, { t, time }) {
  const retracted = Boolean(entry.retractedAt);
  const incident = entry.incident;
  const change = entry.change?.answer === "YES" ? entry.change : null;
  return [
    incident ? { key: "type", label: t("home_care.incident.type_label"), value: t(`home_care.incident.types.${incident.type}`) } : null,
    entry.visit?.minutes ? { key: "minutes", label: t("home_care.entry.contact.VISIT"), value: t("home_care.visit.minutes", { minutes: entry.visit.minutes }) } : null,
    /* „Kas midagi oli teisiti?" (K5-a): ainult vastus „jah" on päevikus rida. */
    change
      ? {
          key: "change",
          label: t("home_care.change.area_label"),
          value: change.areas.map((area) => t(`home_care.change.areas.${area}`)).join(", "),
          chip: change.major ? t("home_care.change.major_badge") : ""
        }
      : null,
    incident && !retracted && incident.assessment ? { key: "assessment", label: t("home_care.incident.assessment_label"), value: incident.assessment } : null,
    incident && !retracted && incident.actions.length > 0
      ? {
          key: "actions",
          label: t("home_care.incident.actions_label"),
          value: incident.actions.map((action) => `${t(`home_care.incident.actions.${action.code}`)} ${time(action.at)}`.trim()).join("; ")
        }
      : null,
    incident && incident.resolutionNote ? { key: "resolution", label: t("home_care.incident.resolution_label"), value: incident.resolutionNote } : null,
    incident && incident.assignee
      ? { key: "assignee", label: t("home_care.trail.assignee_label"), value: incident.assignee.name || "—", chip: entry.assigneeStale ? t("home_care.incident.assignee_stale") : "" }
      : null,
    entry.companionName ? { key: "companion", label: t("home_care.entry.companion_label"), value: entry.companionName } : null
  ].filter(Boolean);
}

/**
 * Varasema sisu read (parandused ja tühistus): `[{ key, kind, meta, reason, text, visit }]`.
 * `moment` vormindab ajahetke.
 */
export function revisionRows(revisions, { t, moment }) {
  return (revisions || []).map((revision) => ({
    key: revision.id,
    kind: t(`home_care.entry.revision_kind.${revision.kind}`),
    meta: [revision.actorName, moment(revision.createdAt)].filter(Boolean).join(" · "),
    reason: `${t("home_care.entry.reason_label")}: ${revision.reason}`,
    text: revision.text || "",
    visit: revision.visit
      ? [
          revision.visit.minutes ? t("home_care.visit.lasted", { minutes: revision.visit.minutes }) : null,
          ...(revision.visit.activities || []).map(
            (activity) =>
              `${activity.name} · ${activity.outcome && activity.outcome !== "DONE" ? t(`home_care.visit.outcomes.${activity.outcome}`) : t(`home_care.visit.modes.${activity.mode}`)}`
          )
        ]
          .filter(Boolean)
          .join("; ")
      : ""
  }));
}

/** Juhtumi käigu read: `[{ key, kind, who, when, meta, text }]`. Seisu rida ütleb, mis seisust mis seisu; vastutaja rida, kes vastutab. */
export function trailRows(updates, { t, moment }) {
  const describe = (update) => {
    if (update.kind === "STATUS") {
      const change = `${t(`home_care.incident.status.${update.fromStatus || "OPEN"}`)} → ${t(`home_care.incident.status.${update.toStatus}`)}`;
      return update.text ? `${change}. ${update.text}` : change;
    }
    if (update.kind === "ASSIGNED") return update.assigned ? t("home_care.trail.assigned_to", { name: update.assigneeName || "—" }) : t("home_care.trail.unassigned");
    return update.text || "";
  };
  return (updates || []).map((update) => ({
    key: update.id,
    kind: t(`home_care.trail.kind.${update.kind}`),
    who: update.actorName || "",
    when: moment(update.createdAt),
    meta: [update.actorName, moment(update.createdAt)].filter(Boolean).join(" · "),
    text: describe(update)
  }));
}

/**
 * Rääkimise soovi seis vaate jaoks: `{ state, line }` või null (midagi ei ole
 * näha). `state`: "ask" (autor saab küsida), "mine" (minu soov on saadetud),
 * "wants" (keegi soovib rääkida), "handled" (räägitud).
 */
export function talkView(talk, rights, { t, moment }) {
  if (!talk) return rights.canAskTalk ? { state: "ask", line: "" } : null;
  if (talk.state === "HANDLED") return { state: "handled", line: t("home_care.talk.handled_line", { date: moment(talk.handledAt), name: talk.handledByName || "—" }) };
  if (talk.mine) return { state: "mine", line: t("home_care.talk.sent_line", { date: moment(talk.requestedAt) }) };
  return { state: "wants", line: t("home_care.talk.wants_line", { name: talk.requesterName || "—", date: moment(talk.requestedAt) }) };
}
