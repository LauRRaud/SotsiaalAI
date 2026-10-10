"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import DateField from "@/components/ui/DateField";
import {
  CARE_DECISION_KINDS,
  CARE_SIGNED_STATES,
  CARE_SIGN_STATES,
  CARE_VOLUME_PERIODS,
  CareDecisionKind,
  CareDecisionState,
  CareVolumePeriod,
  HOME_CARE_LIMITS
} from "@/lib/homeCare/constants";

import HomeCareDecisionView from "./HomeCareDecisionView";
import HomeCareOutbox from "./HomeCareOutbox";
import { planDayLabel } from "./HomeCarePlanView";
import { formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/** Minutid tundidena sisestusväljale: 390 → „6,5", 380 → „6,33". */
function hoursText(minutes) {
  if (!minutes) return "";
  return String(Math.round((minutes / 60) * 100) / 100).replace(".", ",");
}

function emptyForm(today) {
  return {
    kind: CareDecisionKind.ACT,
    issuerName: "",
    documentNumber: "",
    decidedOn: "",
    validFrom: today || "",
    validUntil: "",
    volumeHours: "",
    volumePeriod: CareVolumePeriod.WEEK,
    feeNote: "",
    note: "",
    signState: "",
    signedOn: "",
    originalKept: ""
  };
}

function formFrom(decision) {
  return {
    kind: decision.kind,
    issuerName: decision.issuerName || "",
    documentNumber: decision.documentNumber || "",
    decidedOn: decision.decidedOn || "",
    validFrom: decision.validFrom,
    validUntil: decision.validUntil || "",
    volumeHours: hoursText(decision.volumeMinutes),
    volumePeriod: decision.volumePeriod || CareVolumePeriod.WEEK,
    feeNote: decision.feeNote || "",
    note: decision.note || "",
    signState: decision.signState || "",
    signedOn: decision.signedOn || "",
    originalKept: decision.originalKept || ""
  };
}

/**
 * Kliendi otsused hooldusjuhile: mille alusel ja kui palju abi klient saab.
 *
 * Siia kirjutatakse, mida omavalitsus on otsustanud; otsuse dokument jääb sinna, kus
 * see on. Ekslikult sisestatud otsus tühistatakse, mitte ei kustutata.
 */
export default function HomeCareDecisions({ context, initial }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const client = initial.client;
  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(client.id)}/otsused`;
  const clientHref = `/org/${organizationId}/koduteenus/kliendid/${client.id}`;
  const canEdit = Boolean(initial.canEdit);

  const [current, setCurrent] = useState(initial.current || null);
  const [decisions, setDecisions] = useState(initial.decisions || []);
  /* Avatud vorm: `{ mode: "add" }` või `{ mode: "edit", id, version }`. Korraga üks. */
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => emptyForm(initial.today));
  const [confirmRetract, setConfirmRetract] = useState(null);
  const [notice, setNotice] = useState("");

  const apply = (data) => {
    setCurrent(data.current || null);
    setDecisions(data.decisions || []);
  };
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const openAdd = () => {
    setForm(emptyForm(initial.today));
    setEditing({ mode: "add" });
    setNotice("");
    setConfirmRetract(null);
  };
  const openEdit = (decision) => {
    setForm(formFrom(decision));
    setEditing({ mode: "edit", id: decision.id, version: decision.version });
    setNotice("");
    setConfirmRetract(null);
  };

  const save = async (event) => {
    event.preventDefault();
    /* Allkirja märge käib ainult halduslepinguga ja päev ainult allkirjastatud seisuga: muu jäetakse saatmata. */
    const signState = form.kind === CareDecisionKind.CONTRACT ? form.signState || null : null;
    const body = {
      ...form,
      validUntil: form.validUntil || null,
      decidedOn: form.decidedOn || null,
      signState,
      signedOn: CARE_SIGNED_STATES.includes(signState) ? form.signedOn || null : null
    };
    const result =
      editing.mode === "edit"
        ? await call(`${base}/${encodeURIComponent(editing.id)}`, {
            method: "PATCH",
            body: { ...body, version: editing.version },
            fallbackKey: "home_care.errors.save_failed"
          })
        : await call(base, { method: "POST", body, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return;
    apply(result.data);
    setEditing(null);
    setNotice(t("home_care.decision.saved"));
  };

  const retract = async (decision) => {
    const result = await call(`${base}/${encodeURIComponent(decision.id)}`, {
      method: "DELETE",
      body: { version: decision.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    apply(result.data);
    setConfirmRetract(null);
    setNotice(t("home_care.decision.retracted_notice"));
  };

  const formBlock = editing ? (
    <form className="hc-form" onSubmit={save} aria-busy={busy}>
      <h3 className="hc-section-title">{t(editing.mode === "edit" ? "home_care.decision.edit_title" : "home_care.decision.new_title")}</h3>

      <div className="hc-field">
        <span className="hc-label">{t("home_care.decision.kind_label")}</span>
        <div className="hc-chips" role="group" aria-label={t("home_care.decision.kind_label")}>
          {CARE_DECISION_KINDS.map((value) => (
            <button key={value} type="button" className="hc-chip" aria-pressed={form.kind === value} onClick={() => setField("kind", value)}>
              {t(`home_care.decision.kinds.${value}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-issuer`}>
          {t("home_care.decision.issuer_label")}
        </label>
        <input
          id={`${fieldId}-issuer`}
          className="hc-input"
          value={form.issuerName}
          onChange={(event) => setField("issuerName", event.target.value)}
          maxLength={HOME_CARE_LIMITS.DECISION_ISSUER_MAX}
          autoComplete="off"
        />
        <p className="hc-hint">{t("home_care.decision.issuer_hint")}</p>
      </div>
      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-number`}>
          {t("home_care.decision.number_label")}
        </label>
        <input
          id={`${fieldId}-number`}
          className="hc-input"
          value={form.documentNumber}
          onChange={(event) => setField("documentNumber", event.target.value)}
          maxLength={HOME_CARE_LIMITS.DECISION_NUMBER_MAX}
          autoComplete="off"
        />
      </div>
      <div className="hc-field">
        <span className="hc-label">{t("home_care.decision.decided_label")}</span>
        <DateField
          name="decidedOn"
          value={form.decidedOn}
          onChange={(value) => setField("decidedOn", value || "")}
          ariaLabel={t("home_care.decision.decided_label")}
        />
      </div>

      <div className="hc-field">
        <span className="hc-label">{t("home_care.decision.from_label")}</span>
        <DateField
          name="validFrom"
          value={form.validFrom}
          onChange={(value) => setField("validFrom", value || "")}
          ariaLabel={t("home_care.decision.from_label")}
          required
        />
      </div>
      <div className="hc-field">
        <span className="hc-label">{t("home_care.decision.until_label")}</span>
        <DateField
          name="validUntil"
          value={form.validUntil}
          onChange={(value) => setField("validUntil", value || "")}
          ariaLabel={t("home_care.decision.until_label")}
        />
        {form.validUntil ? (
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setField("validUntil", "")}>
            {t("home_care.decision.until_clear")}
          </button>
        ) : (
          <p className="hc-hint">{t("home_care.decision.until_hint")}</p>
        )}
      </div>

      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-hours`}>
          {t("home_care.decision.hours_label")}
        </label>
        <input
          id={`${fieldId}-hours`}
          className="hc-input"
          inputMode="decimal"
          value={form.volumeHours}
          onChange={(event) => setField("volumeHours", event.target.value)}
          maxLength={7}
          autoComplete="off"
        />
        <p className="hc-hint">{t("home_care.decision.hours_hint")}</p>
        {form.volumeHours.trim() ? (
          <div className="hc-chips" role="group" aria-label={t("home_care.decision.period_label")}>
            {CARE_VOLUME_PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                className="hc-chip"
                aria-pressed={form.volumePeriod === value}
                onClick={() => setField("volumePeriod", value)}
              >
                {t(`home_care.decision.periods.${value}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-fee`}>
          {t("home_care.decision.fee_label")}
        </label>
        <input
          id={`${fieldId}-fee`}
          className="hc-input"
          value={form.feeNote}
          onChange={(event) => setField("feeNote", event.target.value)}
          maxLength={HOME_CARE_LIMITS.DECISION_FEE_NOTE_MAX}
          autoComplete="off"
        />
        <p className="hc-hint">{t("home_care.decision.fee_hint")}</p>
      </div>
      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-note`}>
          {t("home_care.decision.note_label")}
        </label>
        <textarea
          id={`${fieldId}-note`}
          className="hc-textarea hc-textarea--short"
          value={form.note}
          onChange={(event) => setField("note", event.target.value)}
          maxLength={HOME_CARE_LIMITS.DECISION_NOTE_MAX}
        />
      </div>

      {/* Lepingu allkirja märge (K6-h): ainult halduslepingul. Platvorm allkirja ei kogu. */}
      {form.kind === CareDecisionKind.CONTRACT ? (
        <div className="hc-field">
          <span className="hc-label">{t("home_care.decision.sign_label")}</span>
          <div className="hc-chips" role="group" aria-label={t("home_care.decision.sign_label")}>
            {CARE_SIGN_STATES.map((value) => (
              <button
                key={value}
                type="button"
                className="hc-chip"
                aria-pressed={form.signState === value}
                onClick={() => setField("signState", form.signState === value ? "" : value)}
              >
                {t(`home_care.decision.sign_states.${value}`)}
              </button>
            ))}
          </div>
          <p className="hc-hint">{t("home_care.decision.sign_hint")}</p>
        </div>
      ) : null}
      {form.kind === CareDecisionKind.CONTRACT && CARE_SIGNED_STATES.includes(form.signState) ? (
        <div className="hc-field">
          <span className="hc-label">{t("home_care.decision.signed_on_label")}</span>
          <DateField name="signedOn" value={form.signedOn} onChange={(value) => setField("signedOn", value || "")} ariaLabel={t("home_care.decision.signed_on_label")} />
        </div>
      ) : null}
      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-original`}>
          {t("home_care.decision.original_label")}
        </label>
        <input
          id={`${fieldId}-original`}
          className="hc-input"
          value={form.originalKept}
          onChange={(event) => setField("originalKept", event.target.value)}
          maxLength={HOME_CARE_LIMITS.DECISION_ORIGINAL_MAX}
          autoComplete="off"
        />
        <p className="hc-hint">{t("home_care.decision.original_hint")}</p>
      </div>

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="hc-row">
        <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !form.validFrom}>
          {t("home_care.decision.save")}
        </button>
        <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setEditing(null)} disabled={busy}>
          {t("home_care.decision.cancel")}
        </button>
      </div>
    </form>
  ) : null;

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />
      <HomeCareOutbox ownerId={context.membership?.id || ""} timeZone={timeZone} />

      <div className="hc-head">
        <Link className="hc-back" href={clientHref} prefetch={false}>
          {t("home_care.plan.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.decision.editor_title", { name: client.displayName })}</h2>
        <p className="hc-sub">{t("home_care.decision.editor_intro")}</p>
      </div>

      {current ? (
        <section className="hc-section hc-section--card" aria-labelledby={`${fieldId}-current`}>
          <h3 className="hc-section-title" id={`${fieldId}-current`}>
            {t("home_care.decision.current_title")}
          </h3>
          <HomeCareDecisionView decision={current} />
        </section>
      ) : (
        <p className="hc-notice">{t("home_care.decision.none")}</p>
      )}

      {notice ? (
        <p className="hc-ok" role="status">
          {notice}
        </p>
      ) : null}
      {!editing && error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}

      {editing?.mode === "add" ? formBlock : null}
      {canEdit && !editing ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--primary" type="button" onClick={openAdd} disabled={busy}>
            {t("home_care.decision.add")}
          </button>
        </div>
      ) : null}
      {!canEdit ? <p className="hc-notice">{t("home_care.client.read_only")}</p> : null}

      <section className="hc-section" aria-labelledby={`${fieldId}-all`}>
        <h3 className="hc-section-title" id={`${fieldId}-all`}>
          {t("home_care.decision.all_title")}
        </h3>
        {decisions.length === 0 ? (
          <p className="hc-sub">{t("home_care.decision.none_yet")}</p>
        ) : (
          <ul className="hc-list hc-list--plain">
            {decisions.map((decision) =>
              editing?.mode === "edit" && editing.id === decision.id ? (
                <li key={decision.id}>{formBlock}</li>
              ) : (
                <li key={decision.id}>
                  <HomeCareDecisionView decision={decision} />
                  <p className="hc-hint">
                    {[
                      decision.decidedOn ? t("home_care.decision.decided_on", { date: planDayLabel(decision.decidedOn) }) : null,
                      decision.createdByName ? t("home_care.decision.created_by", { name: decision.createdByName }) : null,
                      decision.retractedAt
                        ? t("home_care.decision.retracted_by", {
                            name: decision.retractedByName || "",
                            date: formatDateTime(decision.retractedAt, timeZone)
                          })
                        : null
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {canEdit && !editing && decision.state !== CareDecisionState.RETRACTED ? (
                    <span className="hc-row">
                      <button className="hc-btn hc-btn--quiet" type="button" onClick={() => openEdit(decision)} disabled={busy}>
                        {t("home_care.decision.edit")}
                      </button>
                      {confirmRetract === decision.id ? (
                        <button className="hc-btn hc-btn--danger" type="button" onClick={() => retract(decision)} disabled={busy}>
                          {t("home_care.decision.retract_confirm")}
                        </button>
                      ) : (
                        <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setConfirmRetract(decision.id)} disabled={busy}>
                          {t("home_care.decision.retract")}
                        </button>
                      )}
                    </span>
                  ) : null}
                </li>
              )
            )}
          </ul>
        )}
      </section>
    </section>
  );
}
