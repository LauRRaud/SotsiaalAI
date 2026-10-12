"use client";

import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CareIncidentStatus, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { useSendOnce } from "../client/useSendOnce";
import { formatDateTime, formatTime } from "../homeCareClient";
import { ACTION_LABELS, entryActions, openActivities, openChips, openFacts, openNotes, revisionRows, talkView, trailRows } from "./entryOpen";
import { AssignView, CloseView, EntryOpenView, RetractView, RevisionsView, TrailAddView, TrailView } from "./EntryOpenViews";
import { useEntryActions } from "./useEntryActions";
import { useIncidentTrail } from "./useIncidentTrail";
import { useTalkRequest } from "./useTalkRequest";

/**
 * Avatud päevikukirje kliendi lehel: konksud hoiavad olekut ja päringuid, siin
 * pannakse vaated kokku. Ees on üks vaade korraga: kirje ise või üks selle
 * tegevustest (tühistamine, erijuhtumi sulgemine, varasem sisu, juhtumi käik,
 * täienduse lisamine, vastutaja valik).
 *
 * KIRJET EI KUSTUTATA: parandus ja tühistamine jätavad varasema sisu ajalukku.
 * Tühistamine küsib põhjust ja teist vajutust samal nupul. Erijuhtumi tühistab
 * hooldusjuht. Parandus käib uue kirje sammudel (`onCorrect`; leht avab need).
 *
 * `back`: { label, onBack } viib tagasi päeviku loendisse. `showClient`: kirje on mitme kliendi loendis (erijuhtumite leht,
 * hooldusjuhi ülevaade): kliendi nimi on kirje ülaservas ja parandamine ei käi (see käib kliendi lehel).
 */
export default function EntryOpen({ organizationId, entry, timeZone, canWrite = false, isCoordinator = false, showClient = false, back, onChange, onCorrect }) {
  const { t } = useI18n();
  const rootRef = useRef(null);
  const actions = useEntryActions({ organizationId, entry, canWrite, isCoordinator, showClient, onChange });
  const trail = useIncidentTrail({ organizationId, entry, canWrite, isCoordinator, onEntryChange: onChange });
  const talk = useTalkRequest({ organizationId, clientId: entry.clientId, entryId: entry.id, initial: entry.talk || null });
  /* Juhtumi käigu alavaade: "" (käik ise), "add" või "assign". */
  const [trailPart, setTrailPart] = useState("");
  /* Tühistamise esimene vajutus on tehtud. */
  const [armed, setArmed] = useState(false);
  const [reasonMissing, setReasonMissing] = useState(false);
  /* Teine vajutus päringu ajal ei saada teist päringut (nuppu välja ei lülitata). */
  const once = useSendOnce();

  const { rights, mode } = actions;
  const moment = (value) => formatDateTime(value, timeZone);
  const screen = mode || (trail.open ? `trail:${trailPart}` : "entry");

  /* Vaate vahetusel algab paneel ülalt ja fookus läheb vaate pealkirjale. Esimesel joonistusel fookust ei võeta. */
  const shown = useRef(screen);
  useEffect(() => {
    if (shown.current === screen) return;
    shown.current = screen;
    rootRef.current?.closest(".panel-body")?.scrollTo({ top: 0 });
    rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, [screen]);

  const toEntry = {
    label: t("home_care.entry_steps.back"),
    onBack: () => {
      setArmed(false);
      setReasonMissing(false);
      setTrailPart("");
      trail.hide();
      actions.close();
    }
  };
  const fault = (message) => (message ? { text: message, tone: "risk" } : null);

  if (mode === "retract") {
    const pressRetract = async () => {
      if (!actions.reason.trim()) {
        setReasonMissing(true);
        return;
      }
      if (!armed) {
        setArmed(true);
        return;
      }
      if (await once(actions.retract)) setArmed(false);
    };
    return (
      <div ref={rootRef}>
        <RetractView
          title={t("home_care.entry.retract_title")}
          lead={t("home_care.entry.retract_hint")}
          reason={{
            label: t("home_care.entry.reason_label"),
            value: actions.reason,
            max: HOME_CARE_LIMITS.REASON_MAX,
            onChange: (value) => {
              setArmed(false);
              setReasonMissing(false);
              actions.setReason(value);
            }
          }}
          armed={armed}
          press={{ label: t("home_care.entry.retract_save"), confirm: t("home_care.diary.retract_confirm"), onPress: pressRetract, busy: actions.busy }}
          consequence={t("home_care.diary.retract_note")}
          notice={fault(actions.error) || (reasonMissing ? { text: t("home_care.diary.retract_reason_missing") } : null)}
          back={{ ...toEntry, label: t("home_care.entry.cancel") }}
        />
      </div>
    );
  }

  if (mode === "close") {
    return (
      <div ref={rootRef}>
        <CloseView
          title={t("home_care.incident.close")}
          note={{ label: t("home_care.incident.resolution_label"), value: actions.note, onChange: actions.setNote, max: HOME_CARE_LIMITS.ASSESSMENT_MAX }}
          save={{ label: t("home_care.incident.close"), busy: actions.busy, onSave: () => once(() => actions.setIncidentStatus(CareIncidentStatus.CLOSED, actions.note)) }}
          notice={fault(actions.error)}
          back={{ ...toEntry, label: t("home_care.entry.cancel") }}
        />
      </div>
    );
  }

  if (mode === "history") {
    return (
      <div ref={rootRef}>
        <RevisionsView
          title={t("home_care.entry.history_title")}
          rows={actions.revisions ? revisionRows(actions.revisions, { t, moment }) : null}
          empty={t("home_care.entry.history_empty")}
          busy={actions.busy}
          notice={fault(actions.error)}
          back={toEntry}
        />
      </div>
    );
  }

  if (trail.open) {
    /* Alavaate vahetus võtab eelmise katse vea eest: see käis teise tegevuse kohta. */
    const openPart = (part) => {
      trail.setError("");
      setTrailPart(part);
    };
    const toTrail = { label: t("home_care.diary.to_trail"), onBack: () => openPart("") };
    const canAdd = canWrite && !trail.retracted;
    const canAssign = isCoordinator && canWrite && !trail.retracted && Boolean(trail.assignees);
    if (trailPart === "add" && canAdd) {
      return (
        <div ref={rootRef}>
          <TrailAddView
            title={t("home_care.trail.add")}
            field={{
              label: t("home_care.trail.add_label"),
              hint: isCoordinator ? t("home_care.trail.add_hint_coordinator") : t("home_care.trail.add_hint"),
              value: trail.text,
              onChange: trail.setText,
              max: HOME_CARE_LIMITS.INCIDENT_UPDATE_MAX
            }}
            save={{
              label: t("home_care.trail.add"),
              busy: trail.busy,
              disabled: !trail.text.trim(),
              onSave: async () => {
                if (await once(trail.add)) setTrailPart("");
              }
            }}
            notice={fault(trail.error)}
            back={{ ...toTrail, label: t("home_care.entry.cancel") }}
          />
        </div>
      );
    }
    if (trailPart === "assign" && canAssign) {
      return (
        <div ref={rootRef}>
          <AssignView
            title={t("home_care.trail.assignee_label")}
            pick={{
              label: t("home_care.trail.assignee_label"),
              options: [{ value: "", label: t("home_care.trail.assignee_none") }, ...trail.assignees.map((person) => ({ value: person.membershipId, label: person.name || person.membershipId }))],
              value: trail.assigneeId,
              disabled: trail.busy,
              onChange: async (membershipId) => {
                if (await trail.assign(membershipId)) setTrailPart("");
              }
            }}
            notice={fault(trail.error)}
            back={toTrail}
          />
        </div>
      );
    }
    return (
      <div ref={rootRef}>
        <TrailView
          title={t("home_care.trail.title")}
          lead={isCoordinator ? "" : t("home_care.trail.author_only_note")}
          rows={trail.updates ? trailRows(trail.updates, { t, moment }) : null}
          empty={t("home_care.trail.empty")}
          busy={trail.busy}
          notice={fault(trail.error)}
          assign={canAssign ? { label: t("home_care.trail.assignee_label"), onOpen: () => openPart("assign") } : null}
          add={canAdd ? { label: t("home_care.trail.add"), onOpen: () => openPart("add") } : null}
          back={toEntry}
        />
      </div>
    );
  }

  const press = {
    correct: onCorrect,
    retract: () => actions.setMode("retract"),
    history: actions.openHistory,
    trail: trail.show,
    in_review: () => once(() => actions.setIncidentStatus(CareIncidentStatus.IN_REVIEW)),
    close: () => actions.setMode("close"),
    reopen: () => once(() => actions.setIncidentStatus(CareIncidentStatus.OPEN))
  };
  /* „Soovin sellest rääkida" (K6-k): raske erijuhtumi autor küsib; soovi näevad tema ja hooldusjuht. */
  const wish = entry.incident && !rights.retracted ? talkView(talk.talk, rights, { t, moment }) : null;
  const wishAction = {
    ask: { label: t("home_care.talk.ask"), onPress: () => once(talk.ask) },
    mine: { label: t("home_care.talk.withdraw"), onPress: () => once(talk.withdraw) },
    wants: rights.canHandleTalk ? { label: t("home_care.talk.handled"), onPress: () => once(talk.handle) } : null,
    handled: null
  };

  return (
    <div ref={rootRef}>
      <EntryOpenView
        title={t("home_care.diary.item_title")}
        head={{ when: moment(entry.occurredAt), who: [showClient ? entry.client?.displayName : "", entry.authorName].filter(Boolean).join(" · "), chips: openChips(entry, { t }) }}
        notes={openNotes(entry, { t, moment, isCoordinator })}
        text={rights.retracted ? { value: t("home_care.entry.retracted"), muted: true } : { value: entry.text || "" }}
        facts={openFacts(entry, { t, time: (value) => formatTime(value, timeZone) })}
        activities={{ label: t("home_care.visit.title"), rows: openActivities(entry, { t }), outsideLabel: t("home_care.visit.outside_plan") }}
        talk={
          wish
            ? {
                ...wish,
                wait: wish.state === "wants",
                busy: talk.busy,
                action: wishAction[wish.state],
                hint: wish.state === "ask" ? t("home_care.talk.ask_hint") : "",
                link: { label: t("home_care.talk.covision_link"), href: "/kovisioon" }
              }
            : null
        }
        actions={entryActions(entry, rights).map((key) => ({ key, label: t(ACTION_LABELS[key]), onPress: press[key] }))}
        busy={actions.busy || trail.busy}
        notice={fault(actions.error || talk.error || trail.error)}
        back={back}
      />
    </div>
  );
}
