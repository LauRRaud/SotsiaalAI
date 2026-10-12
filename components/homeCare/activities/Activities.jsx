"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { DetailView, FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import SubPage from "../page/SubPage";
import { ACTIVITIES_PAGE, activityReady, activityRights, activityRows, archivedRows, domainOfGroup, domainRows, groupChoices, groupLabel, groupRows, isGroup, splitActivities } from "./activityRows";
import { useActivities } from "./useActivities";

/**
 * Asutuse toimingute kataloogi leht: konks hoiab loendit ja vormi, siin pannakse
 * vaated kokku. Ees on üks vaade korraga: pooled (koduabi, isikuabi) ja arhiiv,
 * ühe poole rühmad, ühe rühma toimingud, üks toiming (muutmine ja arhiveerimine) ning
 * toimingu vorm.
 *
 * Ülemine tase on määruse nr 40 kuusteist rühma ja seda ei muudeta. Loevad kõik
 * hooldajad; lisab, muudab ja arhiveerib hooldusjuht. Arhiveerimine küsib teist
 * vajutust samal lahtril; taastamine ei küsi. Leht hoiab kogu vormi, nii et vaate
 * vahetus ei kaota midagi.
 *
 * `initial`: { activities, canEdit }.
 */
export default function Activities({ context, initial }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const state = useActivities({ organizationId, initial });
  const rights = activityRights({ canEdit: initial?.canEdit, writable: context.writable });
  const { active, archived } = splitActivities(state.activities);
  /* "" (pooled), "domain:<pool>", "group:<rühm>", "activity:<id>", "archived" või "form". */
  const [screen, setScreen] = useState("");
  /* Arhiveerimise esimene vajutus on tehtud. */
  const [armed, setArmed] = useState(false);
  const [expanded, setExpanded] = useState({});
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
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.activities.title")} onDesk={screen ? () => go("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const pageOf = (key, rows) => {
    const shown = expanded[key] ? rows : rows.slice(0, ACTIVITIES_PAGE);
    const more = !expanded[key] && rows.length > ACTIVITIES_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [key]: true })) } : null;
    return { rows: shown, more };
  };
  const [kind, id] = screen.split(":");
  const { form } = state;

  /* --- Toimingu vorm --- */
  if (screen === "form" && form && rights.edit) {
    return wrap(
      <FormView
        title={t("home_care.activities.title")}
        question={t(form.mode === "edit" ? "home_care.activities.edit" : "home_care.activities.add")}
        form={{
          id: `${formId}-form`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (!activityReady(state.name)) return;
            const saved = await once(state.save);
            if (saved) go(`group:${saved.group}`);
          }
        }}
        fields={[
          form.mode === "add" ? { kind: "note", key: "group_note", text: groupLabel(t, form.group) } : null,
          { kind: "text", key: "name", label: t("home_care.activities.name"), value: state.name, onChange: state.setName, max: HOME_CARE_LIMITS.ACTIVITY_NAME_MAX, required: true },
          { kind: "text", key: "note", label: t("home_care.activities.note"), value: state.note, onChange: state.setNote, max: HOME_CARE_LIMITS.ACTIVITY_NOTE_MAX },
          form.mode === "edit" ? { kind: "select", key: "group", label: t("home_care.activities.group"), options: groupChoices(t), value: state.group, onChange: state.setGroup, required: true } : null
        ].filter(Boolean)}
        save={{ label: t("home_care.activities.save"), busy: state.busy, disabled: !activityReady(state.name) }}
        notice={fault}
        back={{
          label: t("home_care.client.cancel"),
          onBack: () => {
            const target = form.mode === "edit" ? `activity:${form.id}` : `group:${form.group}`;
            state.closeForm();
            go(target);
          }
        }}
      />
    );
  }

  /* --- Üks toiming --- */
  const item = kind === "activity" ? state.activities.find((row) => row.id === id) : null;
  if (item && rights.edit) {
    const isArchived = Boolean(item.archivedAt);
    return wrap(
      <DetailView
        title={t("home_care.activities.title")}
        head={{ name: item.name }}
        notices={[{ key: "group", text: groupLabel(t, item.group) }, item.note ? { key: "note", text: item.note } : null].filter(Boolean)}
        cells={
          isArchived
            ? [
                {
                  key: "restore",
                  label: t("home_care.activities.restore"),
                  onPress: async () => {
                    if (await once(() => state.setArchived(item, false))) go(archived.length > 1 ? "archived" : "");
                  }
                }
              ]
            : [
                {
                  key: "edit",
                  label: t("home_care.activities.edit"),
                  onPress: () => {
                    state.openEdit(item);
                    go("form");
                  }
                },
                {
                  key: "archive",
                  label: t(armed ? "home_care.activities.archive_confirm" : "home_care.activities.archive"),
                  armed,
                  /* Arhiveerimine küsib teist vajutust samal lahtril; toimingut ei saa siis enam valida, vanad kirjed jäävad. */
                  onPress: async () => {
                    if (!armed) {
                      setArmed(true);
                      return;
                    }
                    setArmed(false);
                    if (await once(() => state.setArchived(item, true))) go(`group:${item.group}`);
                  }
                }
              ]
        }
        consequence={armed ? t("home_care.activities.archive_note") : ""}
        busy={state.busy}
        notice={fault}
        back={back(isArchived ? "archived" : `group:${item.group}`)}
        mark="activity"
      />
    );
  }

  /* --- Arhiveeritud toimingud --- */
  if (screen === "archived" && rights.edit && archived.length) {
    const page = pageOf("archived", archivedRows(archived, { t }));
    return wrap(
      <RowsView
        title={t("home_care.activities.title")}
        question={t("home_care.activities.archived_title")}
        rows={page.rows}
        onOpen={(key) => go(`activity:${key}`)}
        more={page.more}
        back={back("")}
        busy={state.busy}
        notice={fault}
        mark="activities-archived"
      />
    );
  }

  /* --- Ühe rühma toimingud --- */
  if (kind === "group" && isGroup(id)) {
    const items = active.filter((row) => row.group === id);
    const page = pageOf(`group:${id}`, activityRows(items, { canEdit: rights.edit }));
    return wrap(
      <RowsView
        title={t("home_care.activities.title")}
        question={groupLabel(t, id)}
        rows={page.rows}
        onOpen={(key) => go(`activity:${key}`)}
        empty={t("home_care.activities.group_empty")}
        more={page.more}
        actions={
          rights.edit
            ? [
                {
                  key: "add",
                  label: t("home_care.activities.add"),
                  primary: true,
                  onPress: () => {
                    state.openAdd(id);
                    go("form");
                  }
                }
              ]
            : []
        }
        back={back(`domain:${domainOfGroup(id)}`)}
        busy={state.busy}
        notice={fault}
        mark="activities-group"
      />
    );
  }

  /* --- Ühe poole rühmad --- */
  if (kind === "domain" && id) {
    const page = pageOf(`domain:${id}`, groupRows(id, active, { t }));
    return wrap(
      <RowsView
        title={t("home_care.activities.title")}
        question={t(`home_care.activities.domains.${id}`)}
        rows={page.rows}
        onOpen={(key) => go(`group:${key}`)}
        hint={t("home_care.activities.source")}
        more={page.more}
        back={back("")}
        busy={state.busy}
        notice={fault}
        mark="activities-domain"
      />
    );
  }

  /* --- Pooled --- */
  const empty = state.activities.length === 0;
  const rows = empty
    ? []
    : [...domainRows(active, { t }), rights.edit && archived.length ? { key: "archived", title: t("home_care.activities.archived_title"), line: t("home_care.activities.count", { count: archived.length }) } : null].filter(Boolean);
  return wrap(
    <RowsView
      title={t("home_care.activities.title")}
      question={t("home_care.activities.title")}
      lead={t("home_care.activities.intro")}
      rows={rows}
      onOpen={(key) => go(key === "archived" ? "archived" : `domain:${key}`)}
      empty={t(rights.edit ? "home_care.activities.empty_editor" : "home_care.activities.empty")}
      actions={
        empty && rights.edit
          ? [
              {
                key: "seed",
                label: t("home_care.activities.seed"),
                primary: true,
                busy: state.busy,
                onPress: () => once(state.seed)
              }
            ]
          : []
      }
      busy={state.busy}
      notice={fault}
      mark="activities"
    />
  );
}
