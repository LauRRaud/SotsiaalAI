"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import DateField from "@/components/ui/DateField";
import { CARE_WORKER_RECORD_KINDS, CareWorkerRecordKind, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { daysLabel } from "./HomeCareDecisionView";
import { planDayLabel } from "./HomeCarePlanView";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/** Üks rida töötaja kaardilt: mis, millal ja kaua kehtib. Sama tekst kaardil ja tähtaegade lehel. */
export function workerRecordLine(t, record) {
  const name =
    record.kind === CareWorkerRecordKind.TRAINING
      ? `${t("home_care.workers.kinds.TRAINING")}: ${record.title}`
      : record.kind === "MISSING_BACKGROUND"
        ? t("home_care.workers.background_missing")
        : t(`home_care.workers.kinds.${record.kind}`);
  return [
    name,
    record.doneOn ? t("home_care.workers.done_on", { date: planDayLabel(record.doneOn) }) : null,
    record.validUntil ? t("home_care.workers.valid_until", { date: planDayLabel(record.validUntil), when: daysLabel(t, record.daysLeft) }) : null
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Töötajate kaardid (K5-e): iga hooldaja taustakontrolli ja koolituste read. Ainult kogu
 * asutuse hooldusjuhile. Taustakontrolli juures on ainult kuupäev: tulemust ega sisu siin
 * ei hoita.
 */
export default function HomeCareWorkers({ context, initial }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const [cards, setCards] = useState(initial);
  const [adding, setAdding] = useState("");
  const [form, setForm] = useState({ kind: "", title: "", doneOn: "", validUntil: "" });

  const base = `${homeCareBase(organizationId)}/tootajad`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const start = (membershipId) => {
    setForm({ kind: "", title: "", doneOn: cards.today, validUntil: "" });
    setError("");
    setAdding(membershipId);
  };

  const save = async (event) => {
    event.preventDefault();
    const result = await call(base, {
      method: "POST",
      body: { membershipId: adding, kind: form.kind, title: form.title, doneOn: form.doneOn, validUntil: form.validUntil || null },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setCards(result.data);
    setAdding("");
  };

  const remove = async (record) => {
    const result = await call(`${base}/${encodeURIComponent(record.id)}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setCards(result.data);
  };

  const isTraining = form.kind === CareWorkerRecordKind.TRAINING;

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.client.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.workers.title")}</h2>
        <p className="hc-sub">{t("home_care.workers.intro")}</p>
      </div>

      {cards.workers.length === 0 ? <p className="hc-sub">{t("home_care.workers.empty")}</p> : null}

      {cards.workers.map((worker) => (
        <section className="hc-section" aria-labelledby={`${fieldId}-${worker.membershipId}`} key={worker.membershipId}>
          <h3 className="hc-section-title" id={`${fieldId}-${worker.membershipId}`}>
            {worker.name}
            {worker.backgroundMissing ? (
              <>
                {" "}
                <span className="hc-badge hc-badge--warn">{t("home_care.workers.background_missing")}</span>
              </>
            ) : null}
          </h3>
          {worker.records.length ? (
            <ul className="hc-list hc-list--plain">
              {worker.records.map((record) => (
                <li key={record.id}>
                  <span>{workerRecordLine(t, record)}</span>
                  {record.expired ? (
                    <>
                      {" "}
                      <span className="hc-badge hc-badge--danger">{t("home_care.workers.expired")}</span>
                    </>
                  ) : null}
                  {cards.canEdit && adding !== worker.membershipId ? (
                    <span className="hc-row">
                      <button className="hc-btn hc-btn--quiet" type="button" onClick={() => remove(record)} disabled={busy}>
                        {t("home_care.workers.remove")}
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hc-hint">{t("home_care.workers.no_records")}</p>
          )}

          {adding === worker.membershipId ? (
            <form className="hc-form" onSubmit={save} aria-busy={busy}>
              <div className="hc-field">
                <span className="hc-label">{t("home_care.workers.kind_label")}</span>
                <div className="hc-chips" role="group" aria-label={t("home_care.workers.kind_label")}>
                  {CARE_WORKER_RECORD_KINDS.map((kind) => (
                    <button key={kind} type="button" className="hc-chip" aria-pressed={form.kind === kind} onClick={() => setField("kind", kind)}>
                      {t(`home_care.workers.kinds.${kind}`)}
                    </button>
                  ))}
                </div>
                {form.kind === CareWorkerRecordKind.BACKGROUND_CHECK ? <p className="hc-hint">{t("home_care.workers.background_hint")}</p> : null}
              </div>
              {isTraining ? (
                <div className="hc-field">
                  <label className="hc-label" htmlFor={`${fieldId}-title`}>
                    {t("home_care.workers.title_label")}
                  </label>
                  <input
                    id={`${fieldId}-title`}
                    className="hc-input"
                    value={form.title}
                    onChange={(event) => setField("title", event.target.value)}
                    maxLength={HOME_CARE_LIMITS.WORKER_RECORD_TITLE_MAX}
                    autoComplete="off"
                    required
                  />
                </div>
              ) : null}
              <div className="hc-field">
                <span className="hc-label">{t("home_care.workers.done_label")}</span>
                <DateField name="workerRecordDoneOn" value={form.doneOn} onChange={(value) => setField("doneOn", value || "")} ariaLabel={t("home_care.workers.done_label")} />
              </div>
              <div className="hc-field">
                <span className="hc-label">{t("home_care.workers.valid_label")}</span>
                <DateField
                  name="workerRecordValidUntil"
                  value={form.validUntil}
                  onChange={(value) => setField("validUntil", value || "")}
                  ariaLabel={t("home_care.workers.valid_label")}
                />
              </div>
              {error ? (
                <p className="hc-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="hc-row">
                <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !form.kind || !form.doneOn || (isTraining && !form.title.trim())}>
                  {t("home_care.workers.save")}
                </button>
                <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setAdding("")} disabled={busy}>
                  {t("home_care.workers.cancel")}
                </button>
              </div>
            </form>
          ) : cards.canEdit ? (
            <div className="hc-row">
              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => start(worker.membershipId)} disabled={busy}>
                {t("home_care.workers.add")}
              </button>
            </div>
          ) : null}
        </section>
      ))}
      {!adding && error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
