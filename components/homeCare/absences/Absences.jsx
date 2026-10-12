"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { DetailView, FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import SubPage from "../page/SubPage";
import { ABSENCES_PAGE, absenceLine, absenceReady, absenceRights, absenceRows, kindChoices, workerChoices } from "./absenceRows";
import { useAbsences } from "./useAbsences";

/**
 * Töötajate puudumiste leht hooldusjuhile: konks hoiab vormi ja päringuid, siin
 * pannakse vaated kokku. Ees on üks vaade korraga: puudumised ridadena (kehtiv
 * puudumine on märgitud), üks puudumine (muutmine ja kustutamine) ning puudumise
 * vorm (töötaja, päevad ja liik).
 *
 * Põhjust ei küsita ja vaba teksti välja ei ole. Päevaplaan tõstab puudumise põhjal
 * esile käigud, mille tegija puudub. Puudumise kustutamine küsib teist vajutust samal
 * lahtril. Leht hoiab kogu vormi, nii et vaate vahetus ei kaota midagi.
 *
 * `initial`: { absences, careWorkers, today, canEdit }.
 */
export default function Absences({ context, initial }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const state = useAbsences({ organizationId, initial });
  const workers = initial.careWorkers || [];
  const rights = absenceRights({ canEdit: initial.canEdit }, workers);
  /* "" (puudumised), "absence:<id>" või "form". */
  const [screen, setScreen] = useState("");
  /* Kustutamise esimene vajutus on tehtud. */
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
  const [kind, id] = screen.split(":");
  const { form, editing } = state;
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.absences.title")} onDesk={screen ? () => go("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );

  /* --- Puudumise vorm --- */
  if (screen === "form" && editing && rights.edit) {
    return wrap(
      <FormView
        title={editing.mode === "edit" ? t("home_care.absences.edit_title", { name: editing.name || "—" }) : t("home_care.absences.new_title")}
        form={{
          id: `${formId}-form`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (absenceReady(editing, form) && (await once(state.save))) go("");
          }
        }}
        fields={[
          editing.mode === "add"
            ? { kind: "pick", key: "worker", label: t("home_care.absences.worker_label"), options: workerChoices(workers), value: form.membershipId, onChange: (value) => state.setField("membershipId", value) }
            : null,
          { kind: "day", key: "from", label: t("home_care.absences.from_label"), value: form.fromDay, onChange: (value) => state.setField("fromDay", value || ""), required: true },
          { kind: "day", key: "to", label: t("home_care.absences.to_label"), value: form.toDay, onChange: (value) => state.setField("toDay", value || ""), required: true },
          { kind: "pick", key: "kind", label: t("home_care.absences.kind_label"), options: kindChoices(t), value: form.kind, onChange: (value) => state.setField("kind", value) }
        ].filter(Boolean)}
        hint={t("home_care.absences.kind_hint")}
        save={{ label: t("home_care.absences.save"), busy: state.busy, disabled: !absenceReady(editing, form) }}
        notice={fault}
        back={{
          label: t("home_care.absences.cancel"),
          onBack: () => {
            const target = editing.mode === "edit" ? `absence:${editing.id}` : "";
            state.close();
            go(target);
          }
        }}
      />
    );
  }

  /* --- Üks puudumine --- */
  const absence = kind === "absence" ? state.absences.find((item) => item.id === id) : null;
  if (absence && rights.edit) {
    const row = absenceRows([absence], { t })[0];
    return wrap(
      <DetailView
        title={t("home_care.absences.title")}
        head={{ name: row.title, chip: row.chip }}
        notices={[{ key: "line", text: absenceLine(t, absence) }]}
        cells={[
          {
            key: "edit",
            label: t("home_care.absences.edit"),
            onPress: () => {
              state.openEdit(absence);
              go("form");
            }
          },
          {
            key: "remove",
            label: t(armed ? "home_care.absences.remove_confirm" : "home_care.absences.remove"),
            armed,
            /* Kustutamine küsib teist vajutust samal lahtril; päevaplaan ei pea töötajat siis enam puuduvaks. */
            onPress: async () => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setArmed(false);
              if (await once(() => state.remove(absence))) go("");
            }
          }
        ]}
        consequence={armed ? t("home_care.absences.remove_note") : ""}
        busy={state.busy}
        notice={fault}
        back={{ label: t("home_care.parts.back"), onBack: () => go("") }}
        mark="absence"
      />
    );
  }

  /* --- Puudumised --- */
  const rows = absenceRows(state.absences, { t }).map((row) => ({ ...row, open: rights.edit }));
  const shown = expanded ? rows : rows.slice(0, ABSENCES_PAGE);
  return wrap(
    <RowsView
      title={t("home_care.absences.title")}
      question={t("home_care.absences.list_title")}
      lead={[rights.edit ? "" : t("home_care.client.read_only"), rights.noWorkers ? t("home_care.absences.no_workers") : ""].filter(Boolean).join(" ")}
      rows={shown}
      onOpen={(key) => go(`absence:${key}`)}
      empty={t("home_care.absences.none")}
      hint={state.notice || t("home_care.absences.intro")}
      more={!expanded && rows.length > ABSENCES_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded(true) } : null}
      actions={
        rights.add
          ? [
              {
                key: "add",
                label: t("home_care.absences.add"),
                primary: true,
                onPress: () => {
                  state.openAdd();
                  go("form");
                }
              }
            ]
          : []
      }
      busy={state.busy}
      notice={fault}
      mark="absences"
    />
  );
}
