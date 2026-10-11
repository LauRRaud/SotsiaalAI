"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { SMALL } from "@/components/org/OrgBits";
import StepFlight from "@/components/stage/StepFlight";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import {
  CARE_ACTIVITY_SKIP_REASONS,
  CARE_CHANGE_AREAS,
  CARE_CONTACT_MODES,
  CARE_INCIDENT_ACTIONS,
  CARE_INCIDENT_TYPES,
  CARE_MEDICATION_ACTIONS,
  CARE_PLAN_MODES,
  HOME_CARE_LIMITS
} from "@/lib/homeCare/constants";

import HomeCareDictation from "../HomeCareDictation";
import { formatDateTime } from "../homeCareClient";
import { ENTRY_STEPS, activityRows, changeSummary, entryProblem, entryStepStates, entrySummary, openingStep } from "./entryRules";
import { ActivityView, ChangeView, DoneView, KindView, TextView, TimeView } from "./EntryViews";
import { VISIT_MINUTE_CHOICES, useEntryForm } from "./useEntryForm";

/**
 * Uus kirje sammudena: konks (`./useEntryForm.js`) hoiab vormi olekut, siin
 * pannakse sammud ja vaated kokku.
 *
 * SEE OSA ON LEHEL ALATI (kui inimene tohib kirjet lisada), ka siis, kui ees on
 * teine vaade: pooleli kirje, selle mustand seadmes ja kordussaatmise võti
 * elavad konksus ja ei tohi vaate vahetusel kaduda. Sammud joonistatakse ainult
 * siis, kui osa on ees (`active`): muidu seisaksid need kiirmenüüs ka teiste
 * osade ajal.
 *
 * AVANEMINE. Tavaline käigu kirje avaneb toimingute sammuga (2/4): liik on
 * vaikimisi õige ja hooldaja märgib kõige sagedamini just toiminguid. Kuhu
 * inimene ise liikus, sinna ta tagasi tulles ka satub.
 *
 * PÄRAST SALVESTAMIST on ees üks lause (kirje on päevikus või ootab seadmes) ja
 * kaks teed edasi; uus tühi vorm ei jää ette, nagu poleks midagi juhtunud.
 */
export default function EntryFlow({ active, organizationId, clientId, team = [], viewerMembershipId = null, clientName = "", timeZone, plan = null, usualState = [], onSaved, onQuick, onDiary, onDoor }) {
  const { t } = useI18n();
  const form = useEntryForm({ organizationId, clientId, team, viewerMembershipId, clientName, timeZone, plan, onSaved });
  /* Samm, kuhu inimene ise liikus; tühi sõne tähendab avanemise sammu. */
  const [stepKey, setStepKey] = useState("");
  /* Avatud toiming sammus „Mida tegid"; tühi sõne on loend. */
  const [activityId, setActivityId] = useState("");
  const [areasOpen, setAreasOpen] = useState(false);
  /* Salvestamist on proovitud: alles siis öeldakse, mis on puudu. */
  const [tried, setTried] = useState(false);
  /* "" | "saved" | "queued": kirje läks teele ja ees on lõpu vaade. */
  const [finished, setFinished] = useState("");

  const { saved, queued } = form;
  useEffect(() => {
    if (!saved && !queued) return;
    setFinished(queued ? "queued" : "saved");
    setStepKey("");
    setActivityId("");
    setAreasOpen(false);
    setTried(false);
  }, [saved, queued]);
  /* Lõpu vaatelt mujale minnes on tagasi tulles ees uus kirje, mitte vana teade. */
  useEffect(() => {
    if (!active) setFinished("");
  }, [active]);

  if (!active) return null;

  if (finished) {
    return (
      <StepPanel
        title={t("home_care.entry.new_title")}
        question={t(finished === "queued" ? "home_care.entry.queued" : "home_care.entry.saved")}
        actions={
          <>
            <Button {...SMALL} data-entry="again" onClick={() => setFinished("")}>
              {t("home_care.door.write_entry")}
            </Button>
            {/* Ootel kirje ei ole veel päevikus: see on näha vaates „Ukse taga". */}
            {finished === "queued" ? (
              <Button type="button" size="sm" variant="primary" data-entry="to-door" onClick={onDoor}>
                {t("home_care.door.back")}
              </Button>
            ) : (
              <Button type="button" size="sm" variant="primary" data-entry="to-diary" onClick={onDiary}>
                {t("home_care.entry_steps.to_diary")}
              </Button>
            )}
          </>
        }
      />
    );
  }

  const current = stepKey || openingStep(form);
  const states = entryStepStates(form);
  const steps = ENTRY_STEPS.map((key) => ({ key, label: t(`home_care.entry_steps.names.${key}`), short: t(`home_care.entry_steps.short.${key}`), state: states[key] }));
  const rows = activityRows(form, { t });
  const problem = tried ? entryProblem(form) : null;
  const titleOf = (key) => t(`home_care.entry_steps.names.${key}`);
  const option = (prefix) => (value) => ({ value, label: t(`${prefix}.${value}`) });

  const draft = form.restored
    ? {
        text: form.restored === "-" ? t("home_care.entry.draft_restored") : t("home_care.entry.draft_restored_at", { time: formatDateTime(form.restored, timeZone) }),
        clear: t("home_care.entry.draft_clear"),
        onClear: form.reset
      }
    : null;

  const choiceOf = (id) => form.visitChoices.find((choice) => choice.activityId === id);
  const toggleActivity = (row) => {
    const choice = choiceOf(row.id);
    if (!choice) return;
    form.toggleDone(choice);
    /* Ravimitoiming vajab märget, mida tehti: valik on kohe ees. */
    if (row.medication && row.state !== "done") setActivityId(row.id);
  };

  const save = (event) => {
    setTried(true);
    if (entryProblem(form)) return;
    form.submit(event);
  };

  return (
    <div inert={form.sending} aria-busy={form.sending ? "true" : undefined}>
      <StepFlight
        label={t("home_care.entry_steps.label")}
        steps={steps}
        initialIndex={Math.max(ENTRY_STEPS.indexOf(current), 0)}
        activeKey={current}
        onStepChange={(_index, step) => {
          setStepKey(step?.key || "");
          setActivityId("");
          setAreasOpen(false);
        }}
      >
        {(step) => {
          if (step.key === "kind") {
            return (
              <KindView
                title={titleOf("kind")}
                draft={draft}
                kind={{
                  label: t("home_care.entry_steps.kind_question"),
                  options: form.kindChoices.map(option("home_care.entry.kinds")),
                  value: form.kind,
                  onChange: (value) => {
                    form.touch();
                    form.setKind(value);
                  }
                }}
                contact={{
                  label: t("home_care.entry_steps.contact_question"),
                  options: CARE_CONTACT_MODES.map(option("home_care.entry.contact")),
                  value: form.contactMode,
                  onChange: (value) => {
                    form.touch();
                    form.setContactMode(value);
                  }
                }}
                incident={
                  form.isIncident
                    ? {
                        notice: t("home_care.incident.notice"),
                        label: t("home_care.incident.type_label"),
                        options: CARE_INCIDENT_TYPES.map(option("home_care.incident.types")),
                        value: form.incidentType,
                        onChange: (value) => {
                          form.touch();
                          form.setIncidentType(value);
                        }
                      }
                    : null
                }
                quick={[
                  { key: "call", label: t("home_care.entry_steps.quick_call"), onOpen: () => onQuick("call") },
                  { key: "near_miss", label: t("home_care.near_miss.start"), onOpen: () => onQuick("near_miss") }
                ]}
              />
            );
          }

          if (step.key === "done") {
            const open = activityId ? rows.find((row) => row.id === activityId) : null;
            if (open) {
              const choice = choiceOf(open.id);
              const marked = Boolean(form.done[open.id]);
              return (
                <ActivityView
                  title={titleOf("done")}
                  name={open.name}
                  mode={{
                    label: t("home_care.entry_steps.how_question"),
                    options: CARE_PLAN_MODES.map(option("home_care.visit.modes")),
                    value: form.done[open.id] || "",
                    onChange: (mode) => {
                      /* Tegemata märgitud toiming: märge maha, siis tehtuks selle viisiga. */
                      if (open.id in form.skipped) form.toggleSkipped(choice);
                      form.setDoneMode(open.id, mode);
                    }
                  }}
                  medication={
                    open.medication && marked
                      ? {
                          label: t("home_care.entry_steps.medication_question"),
                          options: CARE_MEDICATION_ACTIONS.map(option("home_care.medication.actions")),
                          value: form.medication[open.id] || "",
                          onChange: (value) => {
                            form.touch();
                            form.setMedication((now) => ({ ...now, [open.id]: value }));
                          }
                        }
                      : null
                  }
                  skip={
                    open.plan
                      ? {
                          label: t("home_care.entry_steps.skip_question"),
                          options: CARE_ACTIVITY_SKIP_REASONS.map(option("home_care.visit.outcomes")),
                          value: form.skipped[open.id] || "",
                          onChange: (reason) => {
                            if (!(open.id in form.skipped)) form.toggleSkipped(choice);
                            form.setSkipReason(open.id, reason);
                          }
                        }
                      : null
                  }
                  hint={open.medication && marked && !form.medication[open.id] ? t("home_care.medication.pick") : ""}
                  clear={
                    open.state
                      ? {
                          label: t("home_care.entry_steps.unmark"),
                          onClear: () => (open.state === "done" ? form.toggleDone(choice) : form.toggleSkipped(choice))
                        }
                      : null
                  }
                  back={{ label: t("home_care.entry_steps.to_list"), onBack: () => setActivityId("") }}
                />
              );
            }
            return (
              <DoneView
                title={titleOf("done")}
                draft={draft}
                visit={
                  form.isVisit
                    ? {
                        question: t("home_care.entry_steps.done_question"),
                        rows,
                        empty: t("home_care.visit.no_plan"),
                        onToggle: toggleActivity,
                        onDetail: (row) => setActivityId(row.id),
                        detailLabel: t("home_care.entry_steps.detail"),
                        doneLabel: t("home_care.visit.outcomes.DONE"),
                        criticalLabel: t("home_care.plan.critical_badge"),
                        rest: form.unmarked.length ? { label: t("home_care.visit.mark_rest", { count: form.unmarked.length }), onRest: form.markRest } : null,
                        other: {
                          label: t("home_care.visit.add_other"),
                          placeholder: t("home_care.visit.other_placeholder"),
                          options: form.otherOptions,
                          loaded: Boolean(form.catalogue),
                          busy: form.catalogueApi.busy,
                          error: form.catalogueApi.error,
                          done: t("home_care.visit.catalogue_done"),
                          onLoad: form.loadCatalogue,
                          onAdd: form.addOther
                        }
                      }
                    : null
                }
                incident={
                  form.isIncident
                    ? {
                        label: t("home_care.incident.actions_label"),
                        options: CARE_INCIDENT_ACTIONS.map(option("home_care.incident.actions")),
                        values: Object.keys(form.actions),
                        onToggle: form.toggleAction
                      }
                    : null
                }
                idle={!form.isVisit && !form.isIncident ? t("home_care.entry_steps.nothing_to_mark") : ""}
              />
            );
          }

          if (step.key === "time") {
            return (
              <TimeView
                title={titleOf("time")}
                draft={draft}
                minutes={
                  form.isVisit
                    ? {
                        label: t("home_care.entry_steps.minutes_question"),
                        options: VISIT_MINUTE_CHOICES.map((value) => ({ value: String(value), label: t("home_care.visit.minutes", { minutes: value }) })),
                        value: form.visitMinutes,
                        onPick: (value) => {
                          form.touch();
                          form.setVisitMinutes(form.visitMinutes === value ? "" : value);
                        },
                        inputLabel: t("home_care.entry_steps.minutes_other"),
                        onInput: (value) => {
                          form.touch();
                          form.setVisitMinutes(value);
                        },
                        max: HOME_CARE_LIMITS.VISIT_MINUTES_MAX
                      }
                    : null
                }
                occurred={{
                  label: t("home_care.entry.occurred_label"),
                  hint: t("home_care.entry.occurred_hint"),
                  value: form.occurredLocal,
                  onChange: (value) => {
                    form.touch();
                    form.setOccurredLocal(value);
                  }
                }}
                companion={
                  form.companionOptions.length > 1
                    ? {
                        label: t("home_care.entry.companion_label"),
                        options: form.companionOptions,
                        value: form.companion,
                        onChange: (value) => {
                          form.touch();
                          form.setCompanion(value);
                        }
                      }
                    : null
                }
              />
            );
          }

          if (areasOpen && form.changed) {
            return (
              <ChangeView
                title={titleOf("text")}
                areas={{
                  label: t("home_care.change.area_label"),
                  options: CARE_CHANGE_AREAS.map(option("home_care.change.areas")),
                  values: form.diffAreas,
                  onToggle: (area) => {
                    form.touch();
                    form.setDiffAreas((now) => (now.includes(area) ? now.filter((item) => item !== area) : [...now, area]));
                  }
                }}
                usual={usualState
                  .filter((item) => form.diffAreas.includes(item.area))
                  .map((item) => ({ key: item.area, text: t("home_care.change.usually", { area: t(`home_care.change.areas.${item.area}`), text: item.text }) }))}
                major={{
                  title: t("home_care.change.major"),
                  checked: form.diffMajor,
                  onChange: () => {
                    form.touch();
                    form.setDiffMajor((now) => !now);
                  }
                }}
                hint={t("home_care.change.yes_hint")}
                back={{ label: t("home_care.entry_steps.areas_done"), onBack: () => setAreasOpen(false) }}
              />
            );
          }

          return (
            <TextView
              title={titleOf("text")}
              draft={draft}
              summary={entrySummary(form, { t })}
              change={
                form.askChange
                  ? {
                      label: t("home_care.change.question"),
                      options: ["NO", "YES"].map(option("home_care.change.answers")),
                      value: form.different,
                      onAnswer: (value) => {
                        form.touch();
                        form.setDifferent(form.different === value ? "" : value);
                        /* Vastus „jah" küsib kohe, mis oli teisiti. */
                        if (value === "YES" && form.different !== "YES") setAreasOpen(true);
                      },
                      line: changeSummary(form, { t }),
                      edit: form.changed ? { label: t("home_care.entry_steps.change_edit"), onEdit: () => setAreasOpen(true) } : null
                    }
                  : null
              }
              text={{
                label: form.isIncident ? t("home_care.incident.text_label") : t("home_care.entry.text_label"),
                hint: form.textRequired ? t("home_care.entry.write_what_you_saw") : t("home_care.visit.text_optional"),
                value: form.text,
                onChange: (value) => {
                  form.touch();
                  form.setText(value);
                },
                max: HOME_CARE_LIMITS.ENTRY_TEXT_MAX
              }}
              dictation={<HomeCareDictation onText={form.addDictated} disabled={form.busy || form.sending} hint={t("home_care.dictation.hint")} />}
              cut={form.dictationCut ? t("home_care.dictation.cut", { limit: HOME_CARE_LIMITS.ENTRY_TEXT_MAX }) : ""}
              assessment={
                form.isIncident
                  ? {
                      label: t("home_care.incident.assessment_label"),
                      value: form.assessment,
                      onChange: (value) => {
                        form.touch();
                        form.setAssessment(value);
                      },
                      max: HOME_CARE_LIMITS.ASSESSMENT_MAX
                    }
                  : null
              }
              visibility={
                form.coordinatorOnly ? t("home_care.entry.visibility_coordinator") : t("home_care.entry.visibility_team", { count: team.filter((member) => member.active).length })
              }
              problem={
                problem
                  ? {
                      text: t(problem.key),
                      fix: problem.step !== "text" ? { label: t("home_care.entry_steps.fix"), onFix: () => setStepKey(problem.step) } : null
                    }
                  : null
              }
              notice={form.error ? { text: form.error, tone: "risk" } : null}
              save={{ label: t("home_care.entry.save"), busy: form.busy || form.sending, onSave: save }}
            />
          );
        }}
      </StepFlight>
    </div>
  );
}
