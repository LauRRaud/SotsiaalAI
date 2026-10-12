"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { doneLine, noAnswerRights, stepRows, tapRows } from "./noAnswerRows";
import { NoAnswerView, RecordView, RunView, StepsView } from "./NoAnswerViews";
import { useNoAnswer } from "./useNoAnswer";

/* Märkuse tekstiala pikkus märkides (sama piir, mis enne). */
const NOTE_MAX = 1000;

/**
 * Kliendi lehe „Kui uks ei avane": konks hoiab sammude, märkimise ja seadme
 * järjekorra olekut ning päringuid, siin pannakse vaated kokku. Ees on üks
 * vaade korraga: kokkulepitud sammud, sammude muutmine, märkimise esimene
 * vaade (puuduta samme, mille tegid) või teine (märkus ja salvestamine).
 *
 * Osa on lehel kogu aja (pooleli märkimine ei kao vaate vahetusel ega siis, kui
 * luba lõpeb) ja joonistatakse siis, kui ta on ees (`active`). Kui kokkulepitud
 * samme ei ole, algab märkimine otse teisest vaatest.
 *
 * `canEdit`: sammude loendit muudab see, kellel on kaardi muutmise õigus;
 * `canRecord`: erijuhtumi märgib see, kes tohib kirje teha; `onSaved(entry)`: leht võtab kirje päevikusse;
 * `back`: { label, onBack } (tagasi ukse taha).
 */
export default function ClientNoAnswer({
  active,
  organizationId,
  clientId,
  clientName = "",
  viewerMembershipId = null,
  timeZone,
  initial = [],
  canEdit = false,
  canRecord = false,
  onSaved,
  title,
  back
}) {
  const { t } = useI18n();
  const formId = useId();
  const state = useNoAnswer({ organizationId, clientId, clientName, viewerMembershipId, timeZone, initial, onSaved });
  /* "" (sammud), "edit", "run" (puuduta samme) või "record" (märkus ja salvestamine). */
  const [screen, setScreen] = useState("");
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut ega teist kirjet. */
  const once = useSendOnce();

  if (!active) return null;

  const go = (next) => {
    state.setError("");
    setScreen(next);
  };
  const fault = state.error ? { text: state.error, tone: "risk" } : null;
  const wrap = (view) => <div ref={rootRef}>{view}</div>;
  const rights = noAnswerRights({ canEdit, canRecord });
  const hasSteps = state.steps.length > 0;
  const emergency = { text: t("home_care.no_answer.emergency"), call: t("home_care.no_answer.call_112") };
  const cancel = { label: t("home_care.no_answer.cancel"), onBack: () => go("") };

  if (screen === "edit" && rights.edit) {
    return wrap(
      <StepsView
        title={t(hasSteps ? "home_care.no_answer.edit" : "home_care.no_answer.add")}
        form={{
          id: `${formId}-steps`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (await once(state.saveSteps)) go("");
          }
        }}
        steps={{
          label: t("home_care.no_answer.steps_label"),
          value: state.draft,
          onChange: state.setDraft,
          max: HOME_CARE_LIMITS.DOOR_STEPS_MAX * (HOME_CARE_LIMITS.DOOR_STEP_TEXT_MAX + 1),
          rows: 6
        }}
        hint={t("home_care.no_answer.steps_hint", { limit: HOME_CARE_LIMITS.DOOR_STEPS_MAX })}
        save={{ label: t("home_care.no_answer.save"), busy: state.busy }}
        notice={fault}
        back={cancel}
      />
    );
  }

  if (screen === "run" && rights.record && hasSteps) {
    return wrap(
      <RunView
        title={t("home_care.no_answer.title")}
        lead={t("home_care.no_answer.run_hint")}
        rows={tapRows(state.steps, state.taps, { t })}
        onTap={(key) => state.tap(state.steps.find((step) => step.id === key))}
        emergency={emergency}
        next={{ label: t("home_care.parts.next"), onNext: () => go("record") }}
        notice={fault}
        /* Loobumine võtab märgitud sammud ära. */
        back={{
          label: t("home_care.no_answer.cancel"),
          onBack: () => {
            state.close();
            go("");
          }
        }}
      />
    );
  }

  if (screen === "record" && rights.record) {
    return wrap(
      <RecordView
        title={t("home_care.no_answer.title")}
        lead={hasSteps ? "" : t("home_care.no_answer.text_no_steps")}
        form={{
          id: `${formId}-record`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (await once(state.record)) go("");
          }
        }}
        note={{ label: t("home_care.no_answer.note_label"), value: state.note, onChange: state.setNote, max: NOTE_MAX, rows: 3 }}
        emergency={emergency}
        save={{ label: t("home_care.no_answer.record"), busy: state.sending }}
        notice={fault}
        /* Sammudega tagasi samme puudutama (märgitu jääb alles); sammudeta loobumine. */
        back={
          hasSteps
            ? { label: t("home_care.parts.back"), onBack: () => go("run") }
            : {
                label: t("home_care.no_answer.cancel"),
                onBack: () => {
                  state.close();
                  go("");
                }
              }
        }
      />
    );
  }

  return wrap(
    <NoAnswerView
      title={title}
      rows={stepRows(state.steps)}
      empty={t(rights.edit ? "home_care.no_answer.none" : "home_care.no_answer.none_readonly")}
      status={doneLine(state.done, { t })}
      edit={
        rights.edit
          ? {
              label: t(hasSteps ? "home_care.no_answer.edit" : "home_care.no_answer.add"),
              onEdit: () => {
                state.startEdit();
                go("edit");
              }
            }
          : null
      }
      start={
        rights.record
          ? {
              label: t("home_care.no_answer.start"),
              onStart: () => {
                state.startRun();
                go(hasSteps ? "run" : "record");
              }
            }
          : null
      }
      busy={state.busy || state.sending}
      notice={fault}
      back={back}
    />
  );
}
