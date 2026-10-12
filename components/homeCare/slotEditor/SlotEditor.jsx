"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { DetailView, FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import SubPage from "../page/SubPage";
import { SLOTS_PAGE, minuteChoices, priorityChoices, slotRights, slotRows, weekdayChoices, weekdaysReady, workerOptions } from "./slotEditorRows";
import { useSlotEditor } from "./useSlotEditor";

/**
 * Kliendi käigumustri leht hooldusjuhile: konks hoiab vormi ja päringuid, siin
 * pannakse vaated kokku. Ees on üks vaade korraga: käigud nädalapäevade
 * järjekorras, üks käik (muutmine ja lõpetamine) ning käigu vorm kolmes vaates
 * (nädalapäevad ja algus; kestus ja tähtsus; töötaja ja märkus).
 *
 * Uus käik lisatakse korraga mitmele nädalapäevale. Muudatus kehtib tänasest:
 * juba alanud käik lõpetatakse eilse päevaga ja selle asemele tekib uus rida,
 * nii et möödunud päevade plaan jääb nii, nagu see oli. Käigu lõpetamine küsib
 * teist vajutust samal lahtril. Leht hoiab kogu vormi, nii et vaate vahetus ei
 * kaota midagi.
 *
 * `initial`: { client, slots, team, today, canEdit }.
 */
export default function SlotEditor({ context, initial }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const client = initial.client;
  const state = useSlotEditor({ organizationId, client, initial });
  const rights = slotRights({ canEdit: initial.canEdit });
  /* "" (käigud), "slot:<id>", "form1", "form2" või "form3". */
  const [screen, setScreen] = useState("");
  /* Lõpetamise esimene vajutus on tehtud. */
  const [armed, setArmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  const go = (next) => {
    setArmed(false);
    state.setError("");
    setScreen(next);
  };
  const fault = state.error ? { text: state.error, tone: "risk" } : null;
  const back = (target, label = t("home_care.parts.back")) => ({ label, onBack: () => go(target) });
  const [kind, id] = screen.split(":");
  const { form, editing } = state;
  const wrap = (view, { notice = false } = {}) => (
    <SubPage
      context={context}
      label={t("home_care.slots.title")}
      up={{ label: t("home_care.client.page_name"), href: `/org/${organizationId}/koduteenus/kliendid/${client.id}` }}
      onDesk={screen ? () => go("") : undefined}
      notice={notice}
    >
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );

  /* --- Käigu vorm: kolm vaadet --- */
  const formTitle = editing?.mode === "edit" ? t("home_care.slots.edit_title", { weekday: t(`home_care.slots.weekdays_long.${editing.weekday}`) }) : t("home_care.slots.new_title");
  const leave = () => {
    const target = editing?.mode === "edit" ? `slot:${editing.id}` : "";
    state.close();
    go(target);
  };

  if (screen === "form1" && editing && rights.edit) {
    return wrap(
      <FormView
        title={formTitle}
        form={{
          id: `${formId}-1`,
          onSubmit: (event) => {
            event.preventDefault();
            if (weekdaysReady(editing, form)) go("form2");
          }
        }}
        fields={[
          editing.mode === "add"
            ? { kind: "multi", key: "weekdays", label: t("home_care.slots.weekdays_label"), options: weekdayChoices(t), value: form.weekdays, onChange: state.toggleDay }
            : { kind: "note", key: "edit_hint", text: t("home_care.slots.edit_hint") },
          { kind: "time", key: "time", label: t("home_care.slots.time_label"), value: form.startTime, onChange: (value) => state.setField("startTime", value), required: true }
        ]}
        save={{ label: t("home_care.parts.next"), disabled: !weekdaysReady(editing, form) }}
        notice={fault}
        back={{ label: t("home_care.slots.cancel"), onBack: leave }}
      />
    );
  }

  if (screen === "form2" && editing && rights.edit) {
    return wrap(
      <FormView
        title={formTitle}
        form={{
          id: `${formId}-2`,
          onSubmit: (event) => {
            event.preventDefault();
            go("form3");
          }
        }}
        fields={[
          {
            kind: "text",
            key: "minutes",
            label: t("home_care.slots.minutes_label"),
            value: form.plannedMinutes,
            onChange: (value) => state.setField("plannedMinutes", value),
            type: "number",
            inputMode: "numeric",
            min: HOME_CARE_LIMITS.SLOT_MINUTES_MIN,
            maxValue: HOME_CARE_LIMITS.SLOT_MINUTES_MAX,
            required: true,
            size: "short"
          },
          { kind: "pick", key: "minutes_quick", label: t("home_care.visit.minutes_quick"), options: minuteChoices(t), value: form.plannedMinutes, onChange: (value) => state.setField("plannedMinutes", value), columns: 5 },
          { kind: "pick", key: "priority", label: t("home_care.priority.label"), options: priorityChoices(t), value: form.priority, onChange: (value) => state.setField("priority", value) }
        ]}
        hint={t("home_care.priority.hint")}
        save={{ label: t("home_care.parts.next") }}
        notice={fault}
        back={back("form1")}
      />
    );
  }

  if (screen === "form3" && editing && rights.edit) {
    return wrap(
      <FormView
        title={formTitle}
        form={{
          id: `${formId}-3`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (weekdaysReady(editing, form) && (await once(state.save))) go("");
          }
        }}
        fields={[
          { kind: "pick", key: "worker", label: t("home_care.slots.worker_label"), options: workerOptions(state.team, state.slots, form, { t }), value: form.workerMembershipId, onChange: (value) => state.setField("workerMembershipId", value) },
          state.team.length === 0 ? { kind: "note", key: "team_empty", text: t("home_care.slots.team_empty") } : null,
          { kind: "text", key: "note", label: t("home_care.slots.note_label"), value: form.note, onChange: (value) => state.setField("note", value), max: HOME_CARE_LIMITS.SLOT_NOTE_MAX }
        ].filter(Boolean)}
        save={{ label: t("home_care.slots.save"), busy: state.busy, disabled: !weekdaysReady(editing, form) }}
        notice={fault}
        back={back("form2")}
      />
    );
  }

  /* --- Üks käik --- */
  const slot = kind === "slot" ? state.slots.find((item) => item.id === id) : null;
  if (slot && rights.edit) {
    const row = slotRows([slot], initial.today, { t })[0];
    return wrap(
      <DetailView
        title={t("home_care.slots.title")}
        question={client.displayName}
        head={{ name: row.title, chip: row.chip }}
        notices={[{ key: "line", text: row.line }]}
        cells={[
          {
            key: "edit",
            label: t("home_care.slots.edit"),
            onPress: () => {
              state.openEdit(slot);
              go("form1");
            }
          },
          {
            key: "end",
            label: t(armed ? "home_care.slots.end_confirm" : "home_care.slots.end"),
            armed,
            /* Lõpetamine küsib teist vajutust samal lahtril; möödunud päevade plaan jääb alles. */
            onPress: async () => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setArmed(false);
              if (await once(() => state.end(slot))) go("");
            }
          }
        ]}
        consequence={armed ? t("home_care.slots.end_note") : ""}
        busy={state.busy}
        notice={fault}
        back={back("")}
        mark="slot"
      />
    );
  }

  /* --- Käigud --- */
  const rows = slotRows(state.slots, initial.today, { t }).map((row) => ({ ...row, open: rights.edit }));
  const shown = expanded ? rows : rows.slice(0, SLOTS_PAGE);
  return wrap(
    <RowsView
      title={t("home_care.slots.title")}
      question={client.displayName}
      lead={rights.edit ? "" : t("home_care.client.read_only")}
      rows={shown}
      onOpen={(key) => go(`slot:${key}`)}
      empty={t("home_care.slots.none")}
      hint={state.notice || t("home_care.slots.editor_intro")}
      more={!expanded && rows.length > SLOTS_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded(true) } : null}
      actions={
        rights.edit
          ? [
              {
                key: "add",
                label: t("home_care.slots.add"),
                primary: true,
                onPress: () => {
                  state.openAdd();
                  go("form1");
                }
              }
            ]
          : []
      }
      busy={state.busy}
      notice={fault}
      mark="slots"
    />,
    { notice: true }
  );
}
