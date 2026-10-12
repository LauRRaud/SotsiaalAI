"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { formatDateTime } from "../homeCareClient";
import SubPage from "../page/SubPage";
import { PlanView } from "../plan/PlanViews";
import { planSheet } from "../plan/planRows";
import { PICK_PAGE, chosenCount, domainRows, editorButtons, editorRights, frequencyChoices, historyRows, lineReady, lineRows, modeChoices, needsCount, pickRows } from "./planEditorRows";
import { usePlanEditor } from "./usePlanEditor";

/**
 * Hoolduskava koostamise leht hooldusjuhile: konks hoiab mustandit ja päringuid,
 * siin pannakse vaated kokku. Ees on üks vaade korraga: kava read, kehtiv kava,
 * varasemad kavad, eesmärgid, kavas olevad toimingud, toimingute valimine
 * (valdkond ja selle toimingud) ning ühe toimingu kaks vaadet (sagedus; viis,
 * märkus ja kriitilisus).
 *
 * Muudetakse MUSTANDIT; kehtiv kava jääb samaks, kuni mustand kehtestatakse.
 * Kehtestamine ja mustandi äraviskamine küsivad teist vajutust samal nupul ja
 * tagajärg on lause all servas. Leht hoiab kogu vormi: vaate vahetus ei kaota midagi.
 *
 * `initial`: { client, activities, active, draft, history, canEdit }.
 */
export default function PlanEditor({ context, initial }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const client = initial.client;
  const activities = initial.activities || [];
  const editor = usePlanEditor({ organizationId, client, activities, initial });
  const rights = editorRights({ canEdit: initial.canEdit, activities });
  /* "" (kava read), "active", "history", "goals", "lines", "domains", "domain:<d>", "line:<id>" või "line_how:<id>". */
  const [screen, setScreen] = useState("");
  const [expanded, setExpanded] = useState({});
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  const go = (next) => setScreen(next);
  const fault = editor.error ? { text: editor.error, tone: "risk" } : null;
  const back = (target, label = t("home_care.parts.back")) => ({ label, onBack: () => go(target) });
  const [kind, id] = screen.split(":");
  const { form } = editor;

  const pageOf = (key, rows, size) => {
    const shown = expanded[key] ? rows : rows.slice(0, size);
    const more = !expanded[key] && rows.length > size ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [key]: true })) } : null;
    return { rows: shown, more };
  };
  const wrap = (view, { notice = false } = {}) => (
    <SubPage
      context={context}
      label={t("home_care.plan.title")}
      up={{ label: t("home_care.client.page_name"), href: `/org/${organizationId}/koduteenus/kliendid/${client.id}` }}
      onDesk={screen ? () => go("") : undefined}
      notice={notice}
    >
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );

  /* --- Kehtiv kava ja varasemad kavad --- */
  if (screen === "active" && editor.active) {
    return wrap(
      <PlanView
        title={t("home_care.plan.active_title")}
        name={client.displayName}
        sheet={planSheet(editor.active, { t })}
        labels={{ goals: t("home_care.plan.goals"), must: t("home_care.plan.critical_badge") }}
        empty={t("home_care.plan.none_yet")}
        signals={[]}
        edit={null}
        back={back("")}
      />
    );
  }

  if (screen === "history" && editor.history.length) {
    const page = pageOf("history", historyRows(editor.history, { t, moment: (value) => formatDateTime(value, timeZone) }), PICK_PAGE);
    return wrap(<RowsView title={t("home_care.plan.title")} question={t("home_care.plan.history_title")} rows={page.rows} more={page.more} back={back("")} mark="history" />);
  }

  /* --- Mustand: eesmärgid, ülevaatus ja märkus --- */
  if (screen === "goals" && rights.edit) {
    return wrap(
      <FormView
        title={t("home_care.plan.goals")}
        form={{
          id: `${formId}-goals`,
          onSubmit: (event) => {
            event.preventDefault();
            go("");
          }
        }}
        fields={[
          { kind: "area", key: "goals", label: t("home_care.plan.goals_label"), value: form.goals, onChange: (value) => editor.setField("goals", value), max: HOME_CARE_LIMITS.PLAN_GOALS_MAX },
          { kind: "day", key: "review_on", label: t("home_care.plan.review_label"), value: form.reviewOn, onChange: (value) => editor.setField("reviewOn", value || "") },
          { kind: "area", key: "note", label: t("home_care.plan.note_label"), value: form.note, onChange: (value) => editor.setField("note", value), max: HOME_CARE_LIMITS.PLAN_NOTE_MAX }
        ]}
        save={{ label: t("home_care.parts.done") }}
        back={back("")}
      />
    );
  }

  /* --- Mustand: toimingud --- */
  if (screen === "lines" && rights.edit) {
    const page = pageOf("lines", lineRows(form, activities, { t }), PICK_PAGE);
    return wrap(
      <RowsView
        title={t("home_care.plan.title")}
        question={t("home_care.activities.title")}
        rows={page.rows}
        onOpen={(key) => go(`line:${key}`)}
        empty={t("home_care.plan.chosen", { count: 0 })}
        more={page.more}
        actions={[{ key: "add", label: t("home_care.activities.add"), primary: true, onPress: () => go("domains") }]}
        back={back("")}
        mark="lines"
      />
    );
  }

  if (screen === "domains" && rights.edit) {
    return wrap(
      <RowsView
        title={t("home_care.plan.title")}
        question={t("home_care.activities.add")}
        rows={domainRows(form, activities, { t })}
        onOpen={(key) => go(`domain:${key}`)}
        back={back("lines")}
        mark="domains"
      />
    );
  }

  if (kind === "domain" && rights.edit) {
    const page = pageOf(screen, pickRows(id, form, activities, { t }), PICK_PAGE);
    return wrap(
      <RowsView
        title={t("home_care.plan.title")}
        question={t(`home_care.activities.domains.${id}`)}
        rows={page.rows}
        onOpen={(key) => editor.toggleLine(key)}
        hint={t("home_care.plan.chosen", { count: chosenCount(form) })}
        more={page.more}
        back={back("domains")}
        mark="pick"
      />
    );
  }

  const activity = kind === "line" || kind === "line_how" ? activities.find((item) => item.id === id) : null;
  const line = activity ? form.lines[activity.id] : null;

  if (kind === "line" && activity && line && rights.edit) {
    return wrap(
      <FormView
        title={activity.name}
        question={activity.name}
        form={{
          id: `${formId}-line`,
          onSubmit: (event) => {
            event.preventDefault();
            if (lineReady(line)) go(`line_how:${activity.id}`);
          }
        }}
        fields={[
          { kind: "pick", key: "frequency", label: t("home_care.plan.frequency_label"), options: frequencyChoices(t), value: line.frequencyKind, onChange: (value) => editor.setLine(activity.id, { frequencyKind: value }) },
          needsCount(line)
            ? {
                kind: "text",
                key: "count",
                label: t("home_care.plan.count_label"),
                value: line.frequencyCount,
                onChange: (value) => editor.setLine(activity.id, { frequencyCount: value }),
                type: "number",
                inputMode: "numeric",
                min: 1,
                maxValue: HOME_CARE_LIMITS.PLAN_FREQUENCY_MAX,
                required: true,
                size: "short"
              }
            : null,
          { kind: "text", key: "frequency_note", label: t("home_care.plan.frequency_note"), value: line.frequencyNote, onChange: (value) => editor.setLine(activity.id, { frequencyNote: value }), max: HOME_CARE_LIMITS.PLAN_FREQUENCY_NOTE_MAX }
        ].filter(Boolean)}
        save={{ label: t("home_care.parts.next"), disabled: !lineReady(line) }}
        back={back("lines")}
      />
    );
  }

  if (kind === "line_how" && activity && line && rights.edit) {
    return wrap(
      <FormView
        title={activity.name}
        question={activity.name}
        form={{
          id: `${formId}-line-how`,
          onSubmit: (event) => {
            event.preventDefault();
            go("lines");
          }
        }}
        fields={[
          { kind: "pick", key: "mode", label: t("home_care.plan.mode_label"), options: modeChoices(t), value: line.mode, onChange: (value) => editor.setLine(activity.id, { mode: value }) },
          { kind: "check", key: "critical", label: t("home_care.plan.critical"), value: line.critical, onChange: (value) => editor.setLine(activity.id, { critical: value }) },
          { kind: "text", key: "note", label: t("home_care.plan.line_note"), value: line.note, onChange: (value) => editor.setLine(activity.id, { note: value }), max: HOME_CARE_LIMITS.PLAN_LINE_NOTE_MAX }
        ]}
        save={{ label: t("home_care.parts.done") }}
        back={back(`line:${activity.id}`)}
      />
    );
  }

  /* --- Kava read --- */
  const rows = [
    editor.active ? { key: "active", title: t("home_care.plan.active_title"), line: planSheet(editor.active, { t }).foot } : null,
    rights.edit
      ? {
          key: "goals",
          title: t("home_care.plan.goals"),
          chip: { text: editor.draft ? t("home_care.plan.draft_title", { number: editor.draft.number }) : t("home_care.plan.new_title"), tone: "" }
        }
      : null,
    rights.edit ? { key: "lines", title: t("home_care.activities.title"), line: t("home_care.plan.chosen", { count: chosenCount(form) }) } : null,
    editor.history.length ? { key: "history", title: t("home_care.plan.history_title"), line: t("home_care.parts.count", { count: editor.history.length }) } : null
  ].filter(Boolean);
  const buttons = editorButtons({ form, draft: editor.draft, dirty: editor.dirty, busy: editor.busy });
  const confirm = editor.confirm;
  const actions = rights.edit
    ? [
        { key: "save", label: t("home_care.plan.save_draft"), disabled: buttons.save.disabled, onPress: () => once(editor.save) },
        {
          key: "activate",
          label: t(confirm === "activate" ? (editor.active ? "home_care.plan.activate_confirm_replace" : "home_care.plan.activate_confirm") : "home_care.plan.activate"),
          primary: true,
          disabled: buttons.activate.disabled,
          /* Kehtestamine küsib teist vajutust samal nupul; tagajärje lause on all servas. */
          onPress: async () => {
            if (confirm !== "activate") {
              editor.setConfirm("activate");
              return;
            }
            await once(editor.activate);
          }
        },
        buttons.discard.visible
          ? {
              key: "discard",
              label: t(confirm === "discard" ? "home_care.plan.discard_confirm" : "home_care.plan.discard"),
              disabled: buttons.discard.disabled,
              onPress: async () => {
                if (confirm !== "discard") {
                  editor.setConfirm("discard");
                  return;
                }
                await once(editor.discard);
              }
            }
          : null
      ].filter(Boolean)
    : [];
  const lead = [editor.active ? "" : t("home_care.plan.none_yet"), initial.canEdit ? "" : t("home_care.client.read_only"), rights.catalogueEmpty && initial.canEdit ? t("home_care.plan.catalogue_empty") : ""].filter(Boolean).join(" ");
  return wrap(
    <RowsView
      title={t("home_care.plan.title")}
      question={client.displayName}
      lead={lead}
      rows={rows}
      onOpen={(key) => go(key)}
      links={rights.catalogueEmpty ? [{ key: "activities", title: t("home_care.activities.link"), href: `/org/${organizationId}/koduteenus/toimingud` }] : []}
      hint={confirm === "activate" ? t("home_care.plan.activate_note") : confirm === "discard" ? t("home_care.plan.discard_note") : editor.notice || (rights.edit ? t("home_care.plan.editor_intro") : "")}
      actions={actions}
      busy={editor.busy}
      notice={fault}
      mark="plan"
    />,
    { notice: true }
  );
}
