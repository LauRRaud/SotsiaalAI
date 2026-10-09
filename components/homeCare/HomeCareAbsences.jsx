"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import DateField from "@/components/ui/DateField";
import Dropdown from "@/components/ui/Dropdown";
import { CARE_ABSENCE_KINDS, CareAbsenceKind } from "@/lib/homeCare/constants";

import HomeCareOutbox from "./HomeCareOutbox";
import { planDayLabel } from "./HomeCarePlanView";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Töötajate puudumised hooldusjuhile.
 *
 * Puudumine on töötaja, päevad ja liik (plaaniline või ootamatu). Põhjust ei küsita ja
 * vaba teksti välja ei ole. Päevaplaan tõstab puudumise põhjal esile käigud, mille tegija
 * puudub, ega paku puudujat asendajaks.
 */
export default function HomeCareAbsences({ context, initial }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const base = `${homeCareBase(organizationId)}/puudumised`;
  const canEdit = Boolean(initial.canEdit);
  const emptyForm = { membershipId: "", fromDay: initial.today, toDay: initial.today, kind: CareAbsenceKind.SUDDEN };

  const [absences, setAbsences] = useState(initial.absences || []);
  const workers = initial.careWorkers || [];
  /* Avatud vorm: `{ mode: "add" }` või `{ mode: "edit", id, version, name }`. Korraga üks. */
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [notice, setNotice] = useState("");

  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const openAdd = () => {
    setForm(emptyForm);
    setEditing({ mode: "add" });
    setNotice("");
    setConfirmRemove(null);
  };
  const openEdit = (absence) => {
    setForm({ membershipId: absence.membershipId, fromDay: absence.fromDay, toDay: absence.toDay, kind: absence.kind });
    setEditing({ mode: "edit", id: absence.id, version: absence.version, name: absence.name });
    setNotice("");
    setConfirmRemove(null);
  };

  const save = async (event) => {
    event.preventDefault();
    const body = { fromDay: form.fromDay, toDay: form.toDay, kind: form.kind };
    const result =
      editing.mode === "edit"
        ? await call(`${base}/${encodeURIComponent(editing.id)}`, {
            method: "PATCH",
            body: { ...body, version: editing.version },
            fallbackKey: "home_care.errors.save_failed"
          })
        : await call(base, { method: "POST", body: { ...body, membershipId: form.membershipId }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return;
    setAbsences(result.data.absences || []);
    setEditing(null);
    setNotice(t("home_care.absences.saved"));
  };

  const remove = async (absence) => {
    const result = await call(`${base}/${encodeURIComponent(absence.id)}`, {
      method: "DELETE",
      body: { version: absence.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setAbsences(result.data.absences || []);
    setConfirmRemove(null);
    setNotice(t("home_care.absences.removed"));
  };

  const line = (absence) =>
    [
      absence.fromDay === absence.toDay
        ? planDayLabel(absence.fromDay)
        : t("home_care.absences.period", { from: planDayLabel(absence.fromDay), to: planDayLabel(absence.toDay), days: absence.days }),
      t(`home_care.absences.kinds.${absence.kind}`)
    ].join(" · ");

  const formBlock = editing ? (
    <form className="hc-form" onSubmit={save} aria-busy={busy}>
      <h3 className="hc-section-title">
        {editing.mode === "edit" ? t("home_care.absences.edit_title", { name: editing.name || "—" }) : t("home_care.absences.new_title")}
      </h3>
      {editing.mode === "add" ? (
        <div className="hc-field">
          <span className="hc-label">{t("home_care.absences.worker_label")}</span>
          <Dropdown
            value={form.membershipId}
            onChange={(value) => setField("membershipId", value)}
            ariaLabel={t("home_care.absences.worker_label")}
            placeholder={t("home_care.absences.worker_placeholder")}
            options={workers.map((worker) => ({ value: worker.membershipId, label: worker.name || "—" }))}
            required
          />
        </div>
      ) : null}
      <div className="hc-field">
        <span className="hc-label">{t("home_care.absences.from_label")}</span>
        <DateField name="fromDay" value={form.fromDay} onChange={(value) => setField("fromDay", value || "")} ariaLabel={t("home_care.absences.from_label")} required />
      </div>
      <div className="hc-field">
        <span className="hc-label">{t("home_care.absences.to_label")}</span>
        <DateField name="toDay" value={form.toDay} onChange={(value) => setField("toDay", value || "")} ariaLabel={t("home_care.absences.to_label")} required />
      </div>
      <div className="hc-field">
        <span className="hc-label">{t("home_care.absences.kind_label")}</span>
        <div className="hc-chips" role="group" aria-label={t("home_care.absences.kind_label")}>
          {CARE_ABSENCE_KINDS.map((value) => (
            <button key={value} type="button" className="hc-chip" aria-pressed={form.kind === value} onClick={() => setField("kind", value)}>
              {t(`home_care.absences.kinds.${value}`)}
            </button>
          ))}
        </div>
        <p className="hc-hint">{t("home_care.absences.kind_hint")}</p>
      </div>
      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="hc-row">
        <button
          className="hc-btn hc-btn--primary"
          type="submit"
          disabled={busy || !form.fromDay || !form.toDay || (editing.mode === "add" && !form.membershipId)}
        >
          {t("home_care.absences.save")}
        </button>
        <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setEditing(null)} disabled={busy}>
          {t("home_care.absences.cancel")}
        </button>
      </div>
    </form>
  ) : null;

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />
      <HomeCareOutbox ownerId={context.membership?.id || ""} timeZone={timeZone} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus/paev`}>
          {t("home_care.absences.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.absences.title")}</h2>
        <p className="hc-sub">{t("home_care.absences.intro")}</p>
      </div>

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
        workers.length > 0 ? (
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="button" onClick={openAdd} disabled={busy}>
              {t("home_care.absences.add")}
            </button>
          </div>
        ) : (
          <p className="hc-hint">{t("home_care.absences.no_workers")}</p>
        )
      ) : null}
      {!canEdit ? <p className="hc-notice">{t("home_care.client.read_only")}</p> : null}

      <section className="hc-section" aria-labelledby={`${fieldId}-list`}>
        <h3 className="hc-section-title" id={`${fieldId}-list`}>
          {t("home_care.absences.list_title")}
        </h3>
        {absences.length === 0 ? (
          <p className="hc-sub">{t("home_care.absences.none")}</p>
        ) : (
          <ul className="hc-list hc-list--plain">
            {absences.map((absence) =>
              editing?.mode === "edit" && editing.id === absence.id ? (
                <li key={absence.id}>{formBlock}</li>
              ) : (
                <li key={absence.id}>
                  <span>{absence.name || "—"}</span>
                  {absence.current ? (
                    <>
                      {" "}
                      <span className="hc-badge hc-badge--warn">{t("home_care.absences.current_badge")}</span>
                    </>
                  ) : null}
                  <span className="hc-entry__meta"> {line(absence)}</span>
                  {canEdit && !editing ? (
                    <span className="hc-row">
                      <button className="hc-btn hc-btn--quiet" type="button" onClick={() => openEdit(absence)} disabled={busy}>
                        {t("home_care.absences.edit")}
                      </button>
                      {confirmRemove === absence.id ? (
                        <button className="hc-btn hc-btn--danger" type="button" onClick={() => remove(absence)} disabled={busy}>
                          {t("home_care.absences.remove_confirm")}
                        </button>
                      ) : (
                        <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setConfirmRemove(absence.id)} disabled={busy}>
                          {t("home_care.absences.remove")}
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
