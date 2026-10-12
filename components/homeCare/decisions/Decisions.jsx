"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { decisionSheet } from "../decision/decisionRows";
import { DetailView, FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { formatDateTime } from "../homeCareClient";
import SubPage from "../page/SubPage";
import { DECISIONS_PAGE, decisionChips, decisionMeta, decisionRights, decisionRows, hasSignedState, isContract, kindChoices, periodChoices, signChoices, validityReady } from "./decisionsRows";
import { useDecisions } from "./useDecisions";

/**
 * Kliendi otsuste leht hooldusjuhile: konks hoiab vormi ja päringuid, siin
 * pannakse vaated kokku. Ees on üks vaade korraga: kehtiv otsus ja nupp „Lisa
 * otsus", kõik otsused, üks otsus (muutmine ja tühistamine) ning otsuse vorm
 * neljas vaates (mis otsus; kehtivus ja maht; tasu, originaal ja märkus; lepingu
 * allkiri, ainult halduslepingul).
 *
 * Siia kirjutatakse, mida omavalitsus on otsustanud; otsuse dokument jääb sinna,
 * kus see on. Ekslikult sisestatud otsus tühistatakse, mitte ei kustutata:
 * tühistamine küsib teist vajutust samal lahtril. Leht hoiab kogu vormi, nii et
 * vaate vahetus ei kaota midagi.
 *
 * `initial`: { client, current, decisions, today, canEdit }.
 */
export default function Decisions({ context, initial }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const client = initial.client;
  const canEdit = Boolean(initial.canEdit);
  const state = useDecisions({ organizationId, client, initial });
  /* "" (kehtiv otsus), "all", "decision:<id>", "form1", "form2", "form3" või "form4". */
  const [screen, setScreen] = useState("");
  /* Tühistamise esimene vajutus on tehtud. */
  const [armed, setArmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  /* Vaade, kust otsus avati (kehtiv otsus lauale või kõik otsused): sinna viib „Tagasi". */
  const [from, setFrom] = useState("");
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  const go = (next) => {
    setArmed(false);
    state.setError("");
    setScreen(next);
  };
  const fault = state.error ? { text: state.error, tone: "risk" } : null;
  const moment = (value) => formatDateTime(value, timeZone);
  const back = (target, label = t("home_care.parts.back")) => ({ label, onBack: () => go(target) });
  const [kind, id] = screen.split(":");
  const { form } = state;
  const wrap = (view, { notice = false } = {}) => (
    <SubPage
      context={context}
      label={t("home_care.decision.title")}
      up={{ label: t("home_care.client.page_name"), href: `/org/${organizationId}/koduteenus/kliendid/${client.id}` }}
      onDesk={screen ? () => go("") : undefined}
      notice={notice}
    >
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );

  /* --- Otsuse vorm: neli vaadet --- */
  const editing = state.editing;
  const formTitle = t(editing?.mode === "edit" ? "home_care.decision.edit_title" : "home_care.decision.new_title");
  const leave = () => {
    const target = editing?.mode === "edit" ? `decision:${editing.id}` : "";
    state.close();
    go(target);
  };
  const contract = isContract(form);
  const saveAndLeave = async () => {
    if (validityReady(form) && (await once(state.save))) go("");
  };

  if (screen === "form1" && editing && canEdit) {
    return wrap(
      <FormView
        title={formTitle}
        form={{
          id: `${formId}-1`,
          onSubmit: (event) => {
            event.preventDefault();
            go("form2");
          }
        }}
        fields={[
          { kind: "pick", key: "kind", label: t("home_care.decision.kind_label"), options: kindChoices(t), value: form.kind, onChange: (value) => state.setField("kind", value) },
          { kind: "text", key: "issuer", label: t("home_care.decision.issuer_label"), value: form.issuerName, onChange: (value) => state.setField("issuerName", value), max: HOME_CARE_LIMITS.DECISION_ISSUER_MAX },
          { kind: "note", key: "issuer_hint", text: t("home_care.decision.issuer_hint") },
          { kind: "text", key: "number", label: t("home_care.decision.number_label"), value: form.documentNumber, onChange: (value) => state.setField("documentNumber", value), max: HOME_CARE_LIMITS.DECISION_NUMBER_MAX, size: "name" },
          { kind: "day", key: "decided", label: t("home_care.decision.decided_label"), value: form.decidedOn, onChange: (value) => state.setField("decidedOn", value || "") }
        ]}
        save={{ label: t("home_care.parts.next") }}
        notice={fault}
        back={{ label: t("home_care.decision.cancel"), onBack: leave }}
      />
    );
  }

  if (screen === "form2" && editing && canEdit) {
    return wrap(
      <FormView
        title={formTitle}
        form={{
          id: `${formId}-2`,
          onSubmit: (event) => {
            event.preventDefault();
            if (validityReady(form)) go("form3");
          }
        }}
        fields={[
          { kind: "day", key: "from", label: t("home_care.decision.from_label"), value: form.validFrom, onChange: (value) => state.setField("validFrom", value || ""), required: true },
          { kind: "day", key: "until", label: t("home_care.decision.until_label"), value: form.validUntil, onChange: (value) => state.setField("validUntil", value || "") },
          form.validUntil ? null : { kind: "note", key: "until_hint", text: t("home_care.decision.until_hint") },
          { kind: "text", key: "hours", label: t("home_care.decision.hours_label"), value: form.volumeHours, onChange: (value) => state.setField("volumeHours", value), inputMode: "decimal", max: 7, size: "short" },
          { kind: "note", key: "hours_hint", text: t("home_care.decision.hours_hint") },
          form.volumeHours.trim()
            ? { kind: "pick", key: "period", label: t("home_care.decision.period_label"), options: periodChoices(t), value: form.volumePeriod, onChange: (value) => state.setField("volumePeriod", value) }
            : null
        ].filter(Boolean)}
        save={{ label: t("home_care.parts.next"), disabled: !validityReady(form) }}
        extra={form.validUntil ? [{ key: "clear", label: t("home_care.decision.until_clear"), onPress: () => state.setField("validUntil", "") }] : []}
        notice={fault}
        back={back("form1")}
      />
    );
  }

  if (screen === "form3" && editing && canEdit) {
    return wrap(
      <FormView
        title={formTitle}
        form={{
          id: `${formId}-3`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (contract) go("form4");
            else await saveAndLeave();
          }
        }}
        fields={[
          { kind: "text", key: "fee", label: t("home_care.decision.fee_label"), value: form.feeNote, onChange: (value) => state.setField("feeNote", value), max: HOME_CARE_LIMITS.DECISION_FEE_NOTE_MAX },
          { kind: "note", key: "fee_hint", text: t("home_care.decision.fee_hint") },
          { kind: "text", key: "original", label: t("home_care.decision.original_label"), value: form.originalKept, onChange: (value) => state.setField("originalKept", value), max: HOME_CARE_LIMITS.DECISION_ORIGINAL_MAX },
          { kind: "note", key: "original_hint", text: t("home_care.decision.original_hint") },
          { kind: "area", key: "note", label: t("home_care.decision.note_label"), value: form.note, onChange: (value) => state.setField("note", value), max: HOME_CARE_LIMITS.DECISION_NOTE_MAX }
        ]}
        save={{ label: contract ? t("home_care.parts.next") : t("home_care.decision.save"), busy: state.busy, disabled: !validityReady(form) }}
        notice={fault}
        back={back("form2")}
      />
    );
  }

  /* Lepingu allkirja märge (K6-h): ainult halduslepingul. Platvorm allkirja ei kogu. */
  if (screen === "form4" && editing && canEdit && contract) {
    return wrap(
      <FormView
        title={formTitle}
        form={{
          id: `${formId}-4`,
          onSubmit: async (event) => {
            event.preventDefault();
            await saveAndLeave();
          }
        }}
        fields={[
          { kind: "pick", key: "sign", label: t("home_care.decision.sign_label"), options: [{ value: "", label: t("home_care.decision.sign_missing") }, ...signChoices(t)], value: form.signState, onChange: (value) => state.setField("signState", value) },
          hasSignedState(form) ? { kind: "day", key: "signed_on", label: t("home_care.decision.signed_on_label"), value: form.signedOn, onChange: (value) => state.setField("signedOn", value || "") } : null,
          { kind: "note", key: "sign_hint", text: t("home_care.decision.sign_hint") }
        ].filter(Boolean)}
        save={{ label: t("home_care.decision.save"), busy: state.busy, disabled: !validityReady(form) }}
        notice={fault}
        back={back("form3")}
      />
    );
  }

  /* --- Üks otsus --- */
  const decision = kind === "decision" ? state.decisions.find((item) => item.id === id) || (state.current?.id === id ? state.current : null) : null;
  if (decision) {
    const sheet = decisionSheet(decision, { t });
    const rights = decisionRights(decision, { canEdit });
    return wrap(
      <DetailView
        title={t("home_care.decision.title")}
        question={client.displayName}
        head={{ name: sheet.head, chips: decisionChips(decision, { t }) }}
        notices={[decisionMeta(decision, { t, moment })].filter(Boolean).map((text) => ({ key: text, text }))}
        facts={sheet.facts}
        body={sheet.note}
        cells={[
          rights.edit
            ? {
                key: "edit",
                label: t("home_care.decision.edit"),
                onPress: () => {
                  state.openEdit(decision);
                  go("form1");
                }
              }
            : null,
          rights.retract
            ? {
                key: "retract",
                label: t(armed ? "home_care.decision.retract_confirm" : "home_care.decision.retract"),
                armed,
                /* Tühistamine küsib teist vajutust samal lahtril; otsus ei kustu, see tühistatakse. */
                onPress: async () => {
                  if (!armed) {
                    setArmed(true);
                    return;
                  }
                  setArmed(false);
                  if (await once(() => state.retract(decision))) go(from);
                }
              }
            : null
        ].filter(Boolean)}
        consequence={armed ? t("home_care.decision.retract_note") : ""}
        busy={state.busy}
        notice={fault}
        back={back(from)}
        mark="decision"
      />
    );
  }

  /* --- Kõik otsused --- */
  if (screen === "all") {
    const rows = decisionRows(state.decisions, { t });
    const shown = expanded ? rows : rows.slice(0, DECISIONS_PAGE);
    return wrap(
      <RowsView
        title={t("home_care.decision.title")}
        question={t("home_care.decision.all_title")}
        rows={shown}
        onOpen={(key) => {
          setFrom("all");
          go(`decision:${key}`);
        }}
        empty={t("home_care.decision.none_yet")}
        more={!expanded && rows.length > DECISIONS_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded(true) } : null}
        back={back("")}
        mark="decisions"
      />
    );
  }

  /* --- Kehtiv otsus --- */
  const rows = [
    state.current ? { key: "current", title: t("home_care.decision.current_title"), line: decisionSheet(state.current, { t }).head } : null,
    state.decisions.length ? { key: "all", title: t("home_care.decision.all_title"), line: t("home_care.parts.count", { count: state.decisions.length }) } : null
  ].filter(Boolean);
  const lead = [state.current ? "" : t("home_care.decision.none"), canEdit ? "" : t("home_care.client.read_only")].filter(Boolean).join(" ");
  return wrap(
    <RowsView
      title={t("home_care.decision.title")}
      question={client.displayName}
      lead={lead}
      rows={rows}
      onOpen={(key) => {
        setFrom("");
        go(key === "current" ? `decision:${state.current.id}` : key);
      }}
      hint={state.notice || t("home_care.decision.editor_intro")}
      actions={
        canEdit
          ? [
              {
                key: "add",
                label: t("home_care.decision.add"),
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
      mark="decisions"
    />,
    { notice: true }
  );
}
