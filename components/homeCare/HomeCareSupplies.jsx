"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_SUPPLY_KINDS, CARE_SUPPLY_STATES, CareSupplyState, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Varud kliendi kodus (K4-e): küttepuud, joogivesi, toit, hügieenitarbed. Seisu märgib
 * ühe puudutusega igaüks, kes kliendi juures käib; mis varusid jälgitakse ja kes neid
 * täiendab, paneb paika hooldusjuht. Märkuse saab lisada pärast seisu valimist.
 */
export default function HomeCareSupplies({ organizationId, clientId, initial = [], timeZone, canWrite = false, canManage = false }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [supplies, setSupplies] = useState(initial || []);
  /* Avatud vorm: `{ mode: "track" }` või `{ mode: "note", supplyId }`. Korraga üks. */
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ kind: "", responsible: "", note: "" });

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/varud`;
  const setField = (name, value) => setForm((previous) => ({ ...previous, [name]: value }));
  const free = CARE_SUPPLY_KINDS.filter((kind) => !supplies.some((supply) => supply.kind === kind));

  const send = async (url, options) => {
    const result = await call(url, { fallbackKey: "home_care.errors.save_failed", ...options });
    if (!result.ok) return false;
    setSupplies(result.data.supplies || []);
    setOpen(null);
    return true;
  };

  const mark = (supply, state, note) => send(`${base}/${encodeURIComponent(supply.id)}`, { method: "PATCH", body: { state, note: note || null } });

  const startTrack = () => {
    setForm({ kind: free[0] || "", responsible: "", note: "" });
    setError("");
    setOpen({ mode: "track" });
  };

  const startNote = (supply) => {
    setForm({ kind: "", responsible: "", note: supply.stateNote || "" });
    setError("");
    setOpen({ mode: "note", supplyId: supply.id });
  };

  if (!supplies.length && !canManage) return null;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.supplies.title")}
      </h2>

      {supplies.length ? (
        <ul className="hc-list hc-list--plain">
          {supplies.map((supply) => {
            const kindName = t(`home_care.supplies.kinds.${supply.kind}`);
            return (
              <li key={supply.id}>
                <span>{kindName}</span>
                {supply.state === CareSupplyState.OUT || supply.state === CareSupplyState.LOW ? (
                  <>
                    {" "}
                    <span className={`hc-badge ${supply.state === CareSupplyState.OUT ? "hc-badge--danger" : "hc-badge--warn"}`}>
                      {t(`home_care.supplies.states.${supply.state}`)}
                    </span>
                  </>
                ) : null}
                <span className="hc-entry__meta">
                  {" "}
                  {[
                    supply.stateNote,
                    supply.checkedAt
                      ? t("home_care.supplies.checked", { name: supply.checkedByName || "—", when: formatDateTime(supply.checkedAt, timeZone) })
                      : t("home_care.supplies.unchecked"),
                    t("home_care.supplies.responsible", { name: supply.responsible })
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {canWrite && !open ? (
                  <>
                    <div className="hc-chips" role="group" aria-label={t("home_care.supplies.state_label", { kind: kindName })}>
                      {CARE_SUPPLY_STATES.map((state) => (
                        <button key={state} type="button" className="hc-chip" aria-pressed={supply.state === state} onClick={() => mark(supply, state)} disabled={busy}>
                          {t(`home_care.supplies.states.${state}`)}
                        </button>
                      ))}
                    </div>
                    <span className="hc-row">
                      {supply.state ? (
                        <button className="hc-btn hc-btn--quiet" type="button" onClick={() => startNote(supply)} disabled={busy}>
                          {t("home_care.supplies.note_button")}
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          className="hc-btn hc-btn--quiet"
                          type="button"
                          onClick={() => send(`${base}/${encodeURIComponent(supply.id)}`, { method: "DELETE" })}
                          disabled={busy}
                        >
                          {t("home_care.supplies.untrack")}
                        </button>
                      ) : null}
                    </span>
                  </>
                ) : null}
                {open?.mode === "note" && open.supplyId === supply.id ? (
                  <form
                    className="hc-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      mark(supply, supply.state, form.note);
                    }}
                    aria-busy={busy}
                  >
                    <div className="hc-field">
                      <label className="hc-label" htmlFor={`${fieldId}-note`}>
                        {t("home_care.supplies.note_label")}
                      </label>
                      <input
                        id={`${fieldId}-note`}
                        className="hc-input"
                        value={form.note}
                        onChange={(event) => setField("note", event.target.value)}
                        maxLength={HOME_CARE_LIMITS.SUPPLY_NOTE_MAX}
                        autoComplete="off"
                      />
                    </div>
                    {error ? (
                      <p className="hc-error" role="alert">
                        {error}
                      </p>
                    ) : null}
                    <div className="hc-row">
                      <button className="hc-btn hc-btn--primary" type="submit" disabled={busy}>
                        {t("home_care.supplies.note_save")}
                      </button>
                      <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setOpen(null)} disabled={busy}>
                        {t("home_care.supplies.cancel")}
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {!supplies.length && !open ? <p className="hc-hint">{t("home_care.supplies.none")}</p> : null}

      {open?.mode === "track" ? (
        <form
          className="hc-form"
          onSubmit={(event) => {
            event.preventDefault();
            send(base, { method: "POST", body: { kind: form.kind, responsible: form.responsible } });
          }}
          aria-busy={busy}
        >
          <div className="hc-field">
            <span className="hc-label">{t("home_care.supplies.kind_label")}</span>
            <div className="hc-chips" role="group" aria-label={t("home_care.supplies.kind_label")}>
              {free.map((kind) => (
                <button key={kind} type="button" className="hc-chip" aria-pressed={form.kind === kind} onClick={() => setField("kind", kind)}>
                  {t(`home_care.supplies.kinds.${kind}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-responsible`}>
              {t("home_care.supplies.responsible_label")}
            </label>
            <input
              id={`${fieldId}-responsible`}
              className="hc-input"
              value={form.responsible}
              onChange={(event) => setField("responsible", event.target.value)}
              maxLength={HOME_CARE_LIMITS.SUPPLY_RESPONSIBLE_MAX}
              autoComplete="off"
              required
            />
            <p className="hc-hint">{t("home_care.supplies.responsible_hint")}</p>
          </div>
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !form.kind || !form.responsible.trim()}>
              {t("home_care.supplies.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setOpen(null)} disabled={busy}>
              {t("home_care.supplies.cancel")}
            </button>
          </div>
        </form>
      ) : canManage && canWrite && !open && free.length ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={startTrack} disabled={busy}>
            {t("home_care.supplies.track")}
          </button>
        </div>
      ) : null}
      {!open && error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
