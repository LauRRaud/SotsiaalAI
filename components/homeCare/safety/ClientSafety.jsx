"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_CRISIS_DEPENDENCIES, CARE_CRISIS_LEVELS, CARE_PRECONDITION_KINDS, CARE_WORK_NATURE_KINDS, CarePreconditionKind, CarePreconditionOutcome, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { useScreenFocus } from "../client/useScreenFocus";
import { cardQuestions, cardSheet, crisisSheet, nextQuestion, preconditionReady, preconditionRow, safetyTopics, topicTitleKey, topicVisible, usualFields, usualRows, workSheet } from "./safetyRows";
import {
  CardBody,
  CardEditView,
  CardQuestionView,
  CrisisBody,
  CrisisEditView,
  CrisisMoreView,
  PreconditionAddView,
  PreconditionItemView,
  PreconditionsBody,
  TopicView,
  TopicsView,
  UsualBody,
  UsualEditView,
  WorkBody,
  WorkEditView
} from "./SafetyViews";
import { useCrisis, usePreconditions, useSafetyCard, useUsualState, useWorkNature } from "./useSafetyParts";

/**
 * Kliendi lehe osa „Ohutus": konksud hoiavad viie teema olekut ja päringuid,
 * siin pannakse vaated kokku. Ees on üks vaade korraga: teemad, ühe teema
 * lugemisvaade või selle vorm.
 *
 * Osa on lehel kogu aja (pooleli vorm ei kao vaate vahetusel) ja joonistatakse
 * siis, kui ta on ees (`active`).
 *
 * `rights`: { coordinator, team } (kes mida muuta tohib);
 * `initial`: { preconditions, safety, usualState, workNature, crisis } lehe andmetest;
 * `onChanged(key, value)`: leht hoiab sama seisu plaadi rea ja vaate „Ukse taga" jaoks.
 */
export default function ClientSafety({ active, organizationId, clientId, title, name, rights, initial, onChanged }) {
  const { t } = useI18n();
  const formId = useId();
  const ids = { organizationId, clientId };
  const preconditions = usePreconditions({ ...ids, initial: initial.preconditions || [], onChanged: (value) => onChanged("preconditions", value) });
  const card = useSafetyCard({ ...ids, initial: initial.safety || null, onChanged: (value) => onChanged("safety", value) });
  const usual = useUsualState({ ...ids, initial: initial.usualState || [], onChanged: (value) => onChanged("usualState", value) });
  const work = useWorkNature({ ...ids, initial: initial.workNature || null, onChanged: (value) => onChanged("workNature", value) });
  const crisis = useCrisis({ ...ids, initial: initial.crisis || null, onChanged: (value) => onChanged("crisis", value) });
  /* "" (teemad), teema nimi, "<teema>_edit", "crisis_more", "precondition:<id>", "precondition_add" või "question:<teema>". */
  const [screen, setScreen] = useState("");
  /* Tegevus, mille esimene vajutus on tehtud (teine vajutus teeb selle ära). */
  const [armed, setArmed] = useState("");
  const rootRef = useScreenFocus(screen);

  if (!active) return null;

  const state = { preconditions: preconditions.items, card: card.card, usual: usual.items, work: work.mark, crisis: crisis.crisis };
  const go = (next) => {
    setArmed("");
    setScreen(next);
  };
  const fault = (message) => (message ? { text: message, tone: "risk" } : null);
  const toTopics = { label: t("home_care.parts.back"), onBack: () => go("") };
  const backTo = (topic, label = t("home_care.parts.back")) => ({ label, onBack: () => go(topic) });
  const submit = (save, done) => async (event) => {
    event?.preventDefault();
    if (await save()) go(done);
  };
  /* Teist vajutust küsiv tegevus: esimene vajutus valmistab ette, teine teeb ära. */
  const twice = (key, run) => async () => {
    if (armed !== key) {
      setArmed(key);
      return;
    }
    setArmed("");
    await run();
  };
  const wrap = (view) => <div ref={rootRef}>{view}</div>;
  const [kind, detail] = screen.split(":");

  /* --- Eeltingimused --- */
  if (kind === "precondition_add" && rights.coordinator) {
    const { form } = preconditions;
    const noteRequired = form.kind === CarePreconditionKind.OTHER;
    return wrap(
      <PreconditionAddView
        title={t("home_care.precondition.add")}
        form={{ id: `${formId}-precondition`, onSubmit: submit(preconditions.save, "preconditions") }}
        kind={{
          label: t("home_care.precondition.kind_label"),
          options: CARE_PRECONDITION_KINDS.map((value) => ({ value, label: t(`home_care.precondition.kinds.${value}`) })),
          value: form.kind,
          onChange: (value) => preconditions.setField("kind", value)
        }}
        note={{
          label: t("home_care.precondition.note_label"),
          hint: noteRequired ? t("home_care.precondition.note_hint") : "",
          value: form.note,
          onChange: (value) => preconditions.setField("note", value),
          max: HOME_CARE_LIMITS.PRECONDITION_NOTE_MAX,
          required: noteRequired
        }}
        responsible={{
          label: t("home_care.precondition.responsible_label"),
          hint: t("home_care.precondition.responsible_hint"),
          value: form.responsible,
          onChange: (value) => preconditions.setField("responsible", value),
          max: HOME_CARE_LIMITS.PRECONDITION_RESPONSIBLE_MAX,
          required: true
        }}
        due={{ label: t("home_care.precondition.due_label"), value: form.dueOn, onChange: (value) => preconditions.setField("dueOn", value || "") }}
        save={{ label: t("home_care.precondition.save"), busy: preconditions.busy, disabled: !preconditionReady(form) }}
        notice={fault(preconditions.error)}
        back={backTo("preconditions", t("home_care.precondition.cancel"))}
      />
    );
  }
  const openItem = kind === "precondition" && rights.coordinator ? preconditions.items.find((item) => item.id === detail) : null;
  if (openItem) {
    const close = (key, outcome) => twice(key, () => preconditions.close(openItem, outcome).then((ok) => ok && setScreen("preconditions")));
    return wrap(
      <PreconditionItemView
        title={t("home_care.precondition.title")}
        row={preconditionRow(openItem, { t })}
        overdue={t("home_care.deadlines.overdue_badge")}
        actions={[
          { key: "done", label: t("home_care.precondition.done"), armed: armed === "done", onPress: close("done", CarePreconditionOutcome.DONE) },
          { key: "drop", label: t("home_care.precondition.drop"), armed: armed === "drop", onPress: close("drop", CarePreconditionOutcome.DROPPED) }
        ]}
        consequence={armed === "done" ? t("home_care.safety_part.done_note") : armed === "drop" ? t("home_care.safety_part.drop_note") : ""}
        busy={preconditions.busy}
        notice={fault(preconditions.error)}
        back={{
          label: t("home_care.parts.back"),
          onBack: () => {
            preconditions.setError("");
            go("preconditions");
          }
        }}
      />
    );
  }
  if ((kind === "preconditions" || kind === "precondition") && topicVisible("preconditions", state, rights)) {
    return wrap(
      <TopicView
        title={t(topicTitleKey("preconditions"))}
        empty={preconditions.items.length ? "" : t("home_care.precondition.none")}
        edit={
          rights.coordinator
            ? {
                label: t("home_care.precondition.add"),
                onEdit: () => {
                  preconditions.start();
                  go("precondition_add");
                }
              }
            : null
        }
        back={toTopics}
      >
        <PreconditionsBody
          waiting={t("home_care.precondition.waiting")}
          rows={preconditions.items.map((item) => preconditionRow(item, { t }))}
          overdue={t("home_care.deadlines.overdue_badge")}
          onOpen={rights.coordinator ? (id) => go(`precondition:${id}`) : null}
        />
      </TopicView>
    );
  }

  /* --- Ohutuskaart --- */
  if (kind === "question" && rights.team && detail in card.form) {
    const cell = card.form[detail];
    const next = nextQuestion(detail);
    return wrap(
      <CardQuestionView
        title={t(`home_care.safety.topics.${detail}`)}
        question={t(`home_care.safety.questions.${detail}`)}
        answer={{
          options: ["YES", "NO"].map((value) => ({ value, label: t(`home_care.safety.answers.${value}`) })),
          value: cell.answer,
          /* Teine vajutus samale vastusele võtab selle maha: küsimus jääb lahti. */
          onChange: (value) => card.setCell(detail, "answer", cell.answer === value ? "" : value)
        }}
        note={
          cell.answer
            ? { label: t("home_care.safety.note_label"), value: cell.note, onChange: (value) => card.setCell(detail, "note", value), max: HOME_CARE_LIMITS.SAFETY_NOTE_MAX }
            : null
        }
        hint={t("home_care.safety.edit_hint")}
        next={next ? { label: t("home_care.safety_part.next_question"), onNext: () => go(`question:${next}`) } : null}
        back={backTo("card_edit", t("home_care.safety_part.all_questions"))}
      />
    );
  }
  if ((kind === "card_edit" || kind === "question") && rights.team) {
    return wrap(
      <CardEditView
        title={t(topicTitleKey("card"))}
        rows={cardQuestions(card.form, { t })}
        answers={{ YES: t("home_care.safety.answers.YES"), NO: t("home_care.safety.answers.NO"), open: t("home_care.safety_part.unanswered") }}
        onOpen={(topic) => go(`question:${topic}`)}
        save={{ label: t("home_care.safety.save"), busy: card.busy, onSave: submit(card.save, "card") }}
        notice={fault(card.error)}
        back={backTo("card", t("home_care.safety.cancel"))}
      />
    );
  }
  if ((kind === "card" || kind === "card_edit") && topicVisible("card", state, rights)) {
    const sheet = cardSheet(card.card, { t });
    return wrap(
      <TopicView
        title={t(topicTitleKey("card"))}
        chip={card.card.reviewDue ? t("home_care.safety.review_due") : ""}
        empty={card.card.items.length ? "" : t("home_care.safety.none")}
        edit={
          rights.team
            ? {
                label: t(card.card.items.length ? "home_care.safety.edit" : "home_care.safety.add"),
                onEdit: () => {
                  card.start();
                  go("card_edit");
                }
              }
            : null
        }
        back={toTopics}
      >
        <CardBody rows={sheet.rows} notes={sheet.notes} />
      </TopicView>
    );
  }

  /* --- Tavaline seis --- */
  if (kind === "usual_edit" && rights.team) {
    return wrap(
      <UsualEditView
        title={t(topicTitleKey("usual"))}
        hint={t("home_care.usual.edit_hint")}
        form={{ id: `${formId}-usual`, onSubmit: submit(usual.save, "usual") }}
        fields={usualFields(usual.form, { t }).map((field) => ({ ...field, onChange: (value) => usual.setArea(field.key, value), max: HOME_CARE_LIMITS.USUAL_STATE_TEXT_MAX }))}
        save={{ label: t("home_care.usual.save"), busy: usual.busy }}
        notice={fault(usual.error)}
        back={backTo("usual", t("home_care.usual.cancel"))}
      />
    );
  }
  if ((kind === "usual" || kind === "usual_edit") && topicVisible("usual", state, rights)) {
    return wrap(
      <TopicView
        title={t(topicTitleKey("usual"))}
        empty={usual.items.length ? "" : t("home_care.usual.none")}
        edit={
          rights.team
            ? {
                label: t(usual.items.length ? "home_care.usual.edit" : "home_care.usual.add"),
                onEdit: () => {
                  usual.start();
                  go("usual_edit");
                }
              }
            : null
        }
        back={toTopics}
      >
        <UsualBody rows={usualRows(usual.items, { t })} />
      </TopicView>
    );
  }

  /* --- Töö iseloom --- */
  if (kind === "work_edit" && rights.coordinator) {
    const { form } = work;
    return wrap(
      <WorkEditView
        title={t(topicTitleKey("work"))}
        form={{ id: `${formId}-work`, onSubmit: submit(work.save, "work") }}
        kinds={{
          label: t("home_care.work_nature.kinds_label"),
          hint: t("home_care.work_nature.kinds_hint"),
          options: CARE_WORK_NATURE_KINDS.map((value) => ({ value, label: t(`home_care.work_nature.kinds.${value}`) })),
          values: form.kinds,
          onToggle: work.toggle
        }}
        reason={{
          label: t("home_care.work_nature.reason_label"),
          hint: t("home_care.work_nature.reason_hint"),
          value: form.reason,
          onChange: (value) => work.setField("reason", value),
          max: HOME_CARE_LIMITS.WORK_NATURE_REASON_MAX,
          required: true
        }}
        review={{ label: t("home_care.work_nature.review_label"), value: form.reviewOn, onChange: (value) => work.setField("reviewOn", value || "") }}
        save={{ label: t("home_care.work_nature.save"), busy: work.busy, disabled: !form.kinds.length || !form.reason.trim() }}
        clear={work.mark ? { label: t("home_care.work_nature.clear"), armed: armed === "work_clear", onPress: twice("work_clear", () => work.clear().then((ok) => ok && setScreen("work"))) } : null}
        consequence={armed === "work_clear" ? t("home_care.safety_part.work_clear_note") : ""}
        notice={fault(work.error)}
        back={backTo("work", t("home_care.work_nature.cancel"))}
      />
    );
  }
  if ((kind === "work" || kind === "work_edit") && topicVisible("work", state, rights)) {
    const sheet = work.mark ? workSheet(work.mark, { t }) : null;
    return wrap(
      <TopicView
        title={t(topicTitleKey("work"))}
        empty={sheet ? "" : t("home_care.work_nature.none")}
        edit={
          rights.coordinator
            ? {
                label: t(work.mark ? "home_care.work_nature.edit" : "home_care.work_nature.add"),
                onEdit: () => {
                  work.start();
                  go("work_edit");
                }
              }
            : null
        }
        back={toTopics}
      >
        {sheet ? <WorkBody chips={sheet.chips} reason={sheet.reason} meta={sheet.meta} /> : null}
      </TopicView>
    );
  }

  /* --- Kriisivalmidus --- */
  /* Hinnang on kahes vaates: kõik korraga ei mahu telefoni ekraanile. */
  if (kind === "crisis_more" && rights.coordinator) {
    const { form } = crisis;
    return wrap(
      <CrisisMoreView
        title={t(topicTitleKey("crisis"))}
        form={{ id: `${formId}-crisis`, onSubmit: submit(crisis.save, "crisis") }}
        helper={{ label: t("home_care.crisis.helper_label"), value: form.helper, onChange: (value) => crisis.setField("helper", value), max: HOME_CARE_LIMITS.CRISIS_HELPER_MAX }}
        note={{ label: t("home_care.crisis.note_label"), value: form.note, onChange: (value) => crisis.setField("note", value), max: HOME_CARE_LIMITS.CRISIS_NOTE_MAX }}
        save={{ label: t("home_care.crisis.save"), busy: crisis.busy, disabled: !form.level }}
        clear={crisis.crisis ? { label: t("home_care.crisis.clear"), armed: armed === "crisis_clear", onPress: twice("crisis_clear", () => crisis.clear().then((ok) => ok && setScreen("crisis"))) } : null}
        consequence={armed === "crisis_clear" ? t("home_care.safety_part.crisis_clear_note") : ""}
        notice={fault(crisis.error)}
        back={backTo("crisis_edit")}
      />
    );
  }
  if (kind === "crisis_edit" && rights.coordinator) {
    const { form } = crisis;
    return wrap(
      <CrisisEditView
        title={t(topicTitleKey("crisis"))}
        level={{
          label: t("home_care.crisis.level_label"),
          options: CARE_CRISIS_LEVELS.map((value) => ({ value, label: t(`home_care.crisis.levels.${value}`) })),
          value: form.level,
          onChange: (value) => crisis.setField("level", value)
        }}
        dependencies={{
          label: t("home_care.crisis.dependencies_label"),
          hint: t("home_care.crisis.dependencies_hint"),
          options: CARE_CRISIS_DEPENDENCIES.map((value) => ({ value, label: t(`home_care.crisis.dependencies.${value}`) })),
          values: form.dependencies,
          onToggle: crisis.toggle
        }}
        next={{ label: t("home_care.parts.next"), disabled: !form.level, onNext: () => go("crisis_more") }}
        back={backTo("crisis", t("home_care.crisis.cancel"))}
      />
    );
  }
  if ((kind === "crisis" || kind === "crisis_edit" || kind === "crisis_more") && topicVisible("crisis", state, rights)) {
    const sheet = crisis.crisis ? crisisSheet(crisis.crisis, { t }) : null;
    return wrap(
      <TopicView
        title={t(topicTitleKey("crisis"))}
        empty={sheet ? "" : t("home_care.crisis.none")}
        edit={
          rights.coordinator
            ? {
                label: t(crisis.crisis ? "home_care.crisis.edit" : "home_care.crisis.add"),
                onEdit: () => {
                  crisis.start();
                  go("crisis_edit");
                }
              }
            : null
        }
        notice={fault(crisis.error)}
        back={toTopics}
      >
        {sheet ? <CrisisBody level={sheet.level} lines={sheet.lines} /> : null}
      </TopicView>
    );
  }

  return wrap(<TopicsView title={title} name={name} rows={safetyTopics(state, rights, { t })} onOpen={go} />);
}
