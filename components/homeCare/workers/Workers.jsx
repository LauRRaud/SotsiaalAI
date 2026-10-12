"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { DetailView, FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import SubPage from "../page/SubPage";
import { WORKERS_PAGE, expiredChip, isTraining, kindChoices, kindReady, recordReady, recordRows, workerRecordLine, workerRows } from "./workerRows";
import { useWorkers } from "./useWorkers";

/**
 * Töötajate kaartide leht kogu asutuse hooldusjuhile: konks hoiab kaarte ja vormi,
 * siin pannakse vaated kokku. Ees on üks vaade korraga: töötajad ridadena
 * (taustakontrolli rea puudumine on märk nime kõrval), ühe töötaja read, üks rida
 * (eemaldamine) ja uue rea vorm kahes vaates (liik ja koolituse teema, siis kuupäevad).
 *
 * Taustakontrolli juures on ainult kuupäev: tulemust ega sisu siin ei hoita. Rea
 * eemaldamine küsib teist vajutust samal lahtril. Leht hoiab kogu vormi, nii et vaate
 * vahetus ei kaota midagi.
 *
 * `initial`: { workers, today, canEdit }.
 */
export default function Workers({ context, initial }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const state = useWorkers({ organizationId, initial });
  const { cards, form } = state;
  const canEdit = Boolean(cards.canEdit);
  /* "" (töötajad), "worker:<id>", "record:<töötaja>:<id>", "form" või "form2". */
  const [screen, setScreen] = useState("");
  /* Eemaldamise esimene vajutus on tehtud. */
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
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.workers.title")} onDesk={screen ? () => go("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const [kind, workerId, recordId] = screen.split(":");
  const worker = cards.workers.find((item) => item.membershipId === (kind === "form" || kind === "form2" ? state.adding : workerId));

  /* --- Uus rida, esimene samm: liik ja koolituse teema --- */
  if (screen === "form" && worker && canEdit) {
    return wrap(
      <FormView
        title={t("home_care.workers.title")}
        question={`${t("home_care.workers.add")} · ${worker.name}`}
        form={{
          id: `${formId}-form`,
          onSubmit: (event) => {
            event.preventDefault();
            if (kindReady(form)) go("form2");
          }
        }}
        fields={[
          { kind: "pick", key: "kind", label: t("home_care.workers.kind_label"), options: kindChoices(t), value: form.kind, onChange: (value) => state.setField("kind", value), columns: 2 },
          isTraining(form) ? { kind: "text", key: "title", label: t("home_care.workers.title_label"), value: form.title, onChange: (value) => state.setField("title", value), max: HOME_CARE_LIMITS.WORKER_RECORD_TITLE_MAX, required: true } : null
        ].filter(Boolean)}
        hint={form.kind === "BACKGROUND_CHECK" ? t("home_care.workers.background_hint") : ""}
        save={{ label: t("home_care.parts.next"), disabled: !kindReady(form) }}
        notice={fault}
        back={{
          label: t("home_care.workers.cancel"),
          onBack: () => {
            state.close();
            go(`worker:${worker.membershipId}`);
          }
        }}
      />
    );
  }

  /* --- Uus rida, teine samm: kuupäevad --- */
  if (screen === "form2" && worker && canEdit) {
    return wrap(
      <FormView
        title={t("home_care.workers.title")}
        question={`${t("home_care.workers.add")} · ${worker.name}`}
        form={{
          id: `${formId}-form2`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (recordReady(form) && (await once(state.save))) go(`worker:${worker.membershipId}`);
          }
        }}
        fields={[
          { kind: "day", key: "done", label: t("home_care.workers.done_label"), value: form.doneOn, onChange: (value) => state.setField("doneOn", value || ""), required: true },
          { kind: "day", key: "valid", label: t("home_care.workers.valid_label"), value: form.validUntil, onChange: (value) => state.setField("validUntil", value || "") }
        ]}
        save={{ label: t("home_care.workers.save"), busy: state.busy, disabled: !recordReady(form) }}
        notice={fault}
        back={back("form")}
      />
    );
  }

  /* --- Üks rida --- */
  const record = kind === "record" && worker ? worker.records.find((item) => item.id === recordId) : null;
  if (record && canEdit) {
    return wrap(
      <DetailView
        title={t("home_care.workers.title")}
        head={{ name: worker.name, chip: expiredChip(t, record) }}
        notices={[{ key: "line", text: workerRecordLine(t, record) }]}
        cells={[
          {
            key: "remove",
            label: t(armed ? "home_care.workers.remove_confirm" : "home_care.workers.remove"),
            armed,
            /* Eemaldamine küsib teist vajutust samal lahtril. */
            onPress: async () => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setArmed(false);
              if (await once(() => state.remove(record))) go(`worker:${worker.membershipId}`);
            }
          }
        ]}
        consequence={armed ? t("home_care.workers.remove_note") : ""}
        busy={state.busy}
        notice={fault}
        back={back(`worker:${worker.membershipId}`)}
        mark="record"
      />
    );
  }

  /* --- Ühe töötaja read --- */
  if (kind === "worker" && worker) {
    return wrap(
      <RowsView
        title={t("home_care.workers.title")}
        question={worker.name}
        lead={worker.backgroundMissing ? t("home_care.workers.background_missing") : ""}
        rows={recordRows(t, worker, { canEdit })}
        onOpen={(key) => go(`record:${worker.membershipId}:${key}`)}
        empty={t("home_care.workers.no_records")}
        actions={
          canEdit
            ? [
                {
                  key: "add",
                  label: t("home_care.workers.add"),
                  primary: true,
                  onPress: () => {
                    state.start(worker.membershipId);
                    go("form");
                  }
                }
              ]
            : []
        }
        back={back("")}
        busy={state.busy}
        notice={fault}
        mark="worker"
      />
    );
  }

  /* --- Töötajad --- */
  const rows = workerRows(t, cards.workers);
  return wrap(
    <RowsView
      title={t("home_care.workers.title")}
      question={t("home_care.workers.title")}
      lead={t("home_care.workers.intro")}
      rows={expanded ? rows : rows.slice(0, WORKERS_PAGE)}
      onOpen={(key) => go(`worker:${key}`)}
      empty={t("home_care.workers.empty")}
      more={!expanded && rows.length > WORKERS_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded(true) } : null}
      busy={state.busy}
      notice={fault}
      mark="workers"
    />
  );
}
