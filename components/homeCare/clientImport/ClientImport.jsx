"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CLIENT_IMPORT_MAX_ROWS, ClientImportStatus } from "@/lib/homeCare/clientTable";

import { DetailView, FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import SubPage from "../page/SubPage";
import { IMPORT_PAGE, previewRows, sameNameChecks, statusRows, textReady, unitChoices, willCreate } from "./importRows";
import { useClientImport } from "./useClientImport";

/**
 * Klientide sissetoomise leht hooldusjuhile: konks hoiab teksti, eelvaadet ja
 * päringuid, siin pannakse vaated kokku. Ees on üks vaade korraga: sissejuhatus,
 * tabel (kleebitud tekst või fail), üksus (kui asutusel on üksusi), eelvaade (mitu rida
 * on uusi ja millised on probleemsed), ühe oleku read, sama nimega ridade kinnitus ja
 * lõpus tulemus.
 *
 * „Kontrolli" ei salvesta midagi. „Too üle" loob kliendid; server loeb sama teksti
 * uuesti, seega eelvaade ja tulemus ei saa lahku minna. Teksti või üksuse muutmine
 * tühistab eelvaate. Kui nimekiri muutub vahepeal (409), kehtib eelvaade enam ei ja
 * leht viib tagasi tabeli juurde, kus viga on kirjas.
 *
 * `unitOptions`: { units, unitRequired }.
 */
export default function ClientImport({ context, unitOptions }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const units = unitOptions?.units || [];
  const unitRequired = Boolean(unitOptions?.unitRequired);
  const state = useClientImport({ organizationId, units, unitRequired });
  const { preview } = state;
  /* "" (sissejuhatus), "table", "unit", "preview", "list:<olek>", "same_name" või "done". */
  const [screen, setScreen] = useState("");
  const [expanded, setExpanded] = useState({});
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  const go = (next) => {
    state.clearError();
    setScreen(next);
  };
  const fault = state.error ? { text: state.error, tone: "risk" } : null;
  const back = (target, label = t("home_care.parts.back")) => ({ label, onBack: () => go(target) });
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.import.title")} onDesk={screen ? () => go("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const unitMissing = unitRequired && !state.unitId;
  const checkReady = textReady(state.text) && !unitMissing;
  /* Kontroll: eelvaade tuleb, vea korral jääb vaade samaks. */
  const runCheck = async () => {
    if (await once(state.runCheck)) go("preview");
  };
  const [kind, status] = screen.split(":");

  /* --- Tulemus --- */
  if (screen === "done" && state.done) {
    return wrap(
      <DetailView
        title={t("home_care.import.title")}
        notices={[{ key: "done", text: t("home_care.import.done", { count: state.done.created }) }]}
        actions={[{ key: "to_clients", label: t("home_care.import.to_clients"), href: `/org/${organizationId}/koduteenus`, primary: true }]}
        mark="import-done"
      />
    );
  }

  /* --- Sama nimega ridade kinnitus --- */
  if (screen === "same_name" && preview) {
    return wrap(
      <FormView
        title={t("home_care.import.title")}
        question={t("home_care.import.count_same_name", { count: preview.summary.sameName })}
        form={{
          id: `${formId}-same`,
          onSubmit: (event) => {
            event.preventDefault();
            go("preview");
          }
        }}
        fields={sameNameChecks(t, preview, state.confirmed, state.toggleConfirmed)}
        save={{ label: t("home_care.parts.done"), disabled: false }}
        notice={fault}
        back={back("preview")}
      />
    );
  }

  /* --- Ühe oleku read --- */
  if (kind === "list" && preview) {
    const rows = statusRows(t, preview, status);
    const shown = expanded[status] ? rows : rows.slice(0, IMPORT_PAGE);
    const title = previewRows(t, preview).find((row) => row.key === status)?.title || "";
    return wrap(
      <RowsView
        title={t("home_care.import.title")}
        question={title}
        rows={shown}
        more={!expanded[status] && rows.length > IMPORT_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [status]: true })) } : null}
        back={back("preview")}
        mark="import-list"
      />
    );
  }

  /* --- Eelvaade --- */
  if (screen === "preview" && preview) {
    const count = willCreate(preview, state.confirmed);
    return wrap(
      <RowsView
        title={t("home_care.import.title")}
        question={t("home_care.import.preview_title", { total: preview.summary.total })}
        rows={previewRows(t, preview)}
        onOpen={(key) => go(key === ClientImportStatus.SAME_NAME ? "same_name" : `list:${key}`)}
        hint={[preview.ignoredHeaders.length > 0 ? t("home_care.import.ignored_columns", { columns: preview.ignoredHeaders.join(", ") }) : "", context.writable ? "" : t("home_care.client.read_only")].filter(Boolean).join(" ")}
        actions={[
          {
            key: "apply",
            label: t("home_care.import.apply", { count }),
            primary: true,
            busy: state.busy,
            disabled: state.busy || count === 0 || !context.writable,
            onPress: async () => {
              /* Nimekiri muutus vahepeal: eelvaade ei kehti enam, tabeli juures on viga kirjas. */
              const result = await once(state.runApply);
              if (result === "done") setScreen("done");
              else if (result === "conflict") setScreen("table");
            }
          }
        ]}
        busy={state.busy}
        notice={fault}
        back={back("table")}
        mark="import-preview"
      />
    );
  }

  /* --- Üksus --- */
  if (screen === "unit" && units.length > 0) {
    return wrap(
      <FormView
        title={t("home_care.import.title")}
        question={t("home_care.client.unit")}
        form={{
          id: `${formId}-unit`,
          onSubmit: (event) => {
            event.preventDefault();
            if (checkReady) runCheck();
          }
        }}
        fields={[{ kind: "select", key: "unit", label: t("home_care.client.unit"), options: unitChoices(t, units, unitRequired), value: state.unitId, onChange: state.changeUnit }]}
        save={{ label: t("home_care.import.check"), busy: state.busy, disabled: state.busy || !checkReady }}
        notice={fault}
        back={back("table")}
      />
    );
  }

  /* --- Tabel --- */
  if (screen === "table") {
    return wrap(
      <FormView
        title={t("home_care.import.title")}
        question={t("home_care.import.text_label")}
        form={{
          id: `${formId}-table`,
          onSubmit: (event) => {
            event.preventDefault();
            if (!textReady(state.text)) return;
            if (units.length > 0) go("unit");
            else if (checkReady) runCheck();
          }
        }}
        fields={[
          { kind: "area", key: "text", label: t("home_care.import.text_label"), value: state.text, onChange: state.changeText, rows: 5, spellCheck: false },
          { kind: "file", key: "file", label: t("home_care.import.file_label"), accept: ".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values", onChange: state.readFile }
        ]}
        hint={state.fileNote ? "" : t("home_care.import.text_hint")}
        save={{ label: t(units.length > 0 ? "home_care.parts.next" : "home_care.import.check"), busy: state.busy, disabled: state.busy || !textReady(state.text) || (units.length === 0 && unitMissing) }}
        notice={fault || (state.fileNote ? { text: state.fileNote, tone: "risk" } : null)}
        back={back("")}
      />
    );
  }

  /* --- Sissejuhatus --- */
  return wrap(
    <DetailView
      title={t("home_care.import.title")}
      notices={[
        { key: "intro", text: t("home_care.import.intro") },
        { key: "columns", text: t("home_care.import.columns_hint", { limit: CLIENT_IMPORT_MAX_ROWS }) }
      ]}
      actions={[{ key: "start", label: t("home_care.parts.next"), primary: true, onPress: () => go("table") }]}
      mark="import"
    />
  );
}
