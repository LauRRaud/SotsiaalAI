"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Dropdown from "@/components/ui/Dropdown";
import { CareKeyOutcome, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/** „nr 17 (välisuks)": ripatsi number ja, kui on, mille võti. */
export function keyName(t, key) {
  return key.label ? t("home_care.keys.name_with_label", { tag: key.tag, label: key.label }) : t("home_care.keys.name", { tag: key.tag });
}

/** Kelle käes võti on; hoidjata võti on kontoris. */
export function keyHolderText(t, key) {
  return key.holder ? t("home_care.keys.held_by", { name: key.holder.name || "—" }) : t("home_care.keys.in_office");
}

/** „võti: Anu Hooldaja käes, kontoris": kus kliendi võtmed on, kui käigu tegijal võtit ei ole. */
export function keyWhere(t, note) {
  const places = [...note.holders.map((name) => t("home_care.keys.held_by", { name })), ...(note.office ? [t("home_care.keys.in_office")] : [])];
  return t("home_care.keys.elsewhere", { where: places.join(", ") });
}

/**
 * Kliendi võtmed (K4-b): mis võtmed asutuse käes on ja kelle käes iga võti praegu on.
 * Loeb igaüks, kes lehte näeb. Võtme lisab ja lõpetab hooldusjuht; üle annab hooldusjuht
 * või see, kelle käes võti parajasti on.
 */
export default function HomeCareKeys({ organizationId, clientId, initial = [], receivers = [], canManage = false, canWrite = false, myMembershipId = null }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [keys, setKeys] = useState(initial || []);
  /* Avatud vorm: `{ mode: "add" }` või `{ mode: "handover", keyId }`. Korraga üks. */
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ tag: "", label: "", holder: "" });

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/votmed`;
  const setField = (name, value) => setForm((previous) => ({ ...previous, [name]: value }));
  const receiverOptions = (exceptId) => [
    { value: "", label: t("home_care.keys.office_option") },
    ...receivers.filter((worker) => worker.membershipId !== exceptId).map((worker) => ({ value: worker.membershipId, label: worker.name || "—" }))
  ];

  const startAdd = () => {
    setForm({ tag: "", label: "", holder: "" });
    setError("");
    setOpen({ mode: "add" });
  };

  const startHandover = (key) => {
    setForm({ tag: "", label: "", holder: "" });
    setError("");
    setOpen({ mode: "handover", keyId: key.id });
  };

  const add = async (event) => {
    event.preventDefault();
    const result = await call(base, {
      method: "POST",
      body: { tag: form.tag, label: form.label, holderMembershipId: form.holder || null },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setKeys(result.data.keys || []);
    setOpen(null);
  };

  const patch = async (key, body) => {
    const result = await call(`${base}/${encodeURIComponent(key.id)}`, { method: "PATCH", body, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return;
    setKeys(result.data.keys || []);
    setOpen(null);
  };

  if (!keys.length && !canManage) return null;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.keys.title")}
      </h2>

      {keys.length ? (
        <ul className="hc-list hc-list--plain">
          {keys.map((key) => {
            const mine = Boolean(myMembershipId) && key.holder?.membershipId === myMembershipId;
            const handing = open?.mode === "handover" && open.keyId === key.id;
            return (
              <li key={key.id}>
                <span>{keyName(t, key)}</span>
                <span className="hc-entry__meta"> {mine ? t("home_care.keys.held_by_me") : keyHolderText(t, key)}</span>
                {canWrite && !open && (canManage || mine) ? (
                  <span className="hc-row">
                    <button className="hc-btn hc-btn--quiet" type="button" onClick={() => startHandover(key)} disabled={busy}>
                      {t("home_care.keys.hand_over")}
                    </button>
                    {canManage ? (
                      <>
                        <button className="hc-btn hc-btn--quiet" type="button" onClick={() => patch(key, { outcome: CareKeyOutcome.RETURNED })} disabled={busy}>
                          {t("home_care.keys.returned")}
                        </button>
                        <button className="hc-btn hc-btn--quiet" type="button" onClick={() => patch(key, { outcome: CareKeyOutcome.LOST })} disabled={busy}>
                          {t("home_care.keys.lost")}
                        </button>
                      </>
                    ) : null}
                  </span>
                ) : null}
                {handing ? (
                  <form
                    className="hc-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      patch(key, { toMembershipId: form.holder || null });
                    }}
                    aria-busy={busy}
                  >
                    <div className="hc-field">
                      <span className="hc-label">{t("home_care.keys.to_label")}</span>
                      <Dropdown
                        value={form.holder}
                        onChange={(value) => setField("holder", value)}
                        ariaLabel={t("home_care.keys.to_label")}
                        options={receiverOptions(key.holder?.membershipId || null)}
                      />
                    </div>
                    {error ? (
                      <p className="hc-error" role="alert">
                        {error}
                      </p>
                    ) : null}
                    <div className="hc-row">
                      <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || (form.holder || null) === (key.holder?.membershipId || null)}>
                        {t("home_care.keys.hand_over_save")}
                      </button>
                      <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setOpen(null)} disabled={busy}>
                        {t("home_care.keys.cancel")}
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {!keys.length && !open ? <p className="hc-hint">{t("home_care.keys.none")}</p> : null}

      {open?.mode === "add" ? (
        <form className="hc-form" onSubmit={add} aria-busy={busy}>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-tag`}>
              {t("home_care.keys.tag_label")}
            </label>
            <input
              id={`${fieldId}-tag`}
              className="hc-input"
              value={form.tag}
              onChange={(event) => setField("tag", event.target.value)}
              maxLength={HOME_CARE_LIMITS.KEY_TAG_MAX}
              autoComplete="off"
              required
            />
            <p className="hc-hint">{t("home_care.keys.tag_hint")}</p>
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-label`}>
              {t("home_care.keys.label_label")}
            </label>
            <input
              id={`${fieldId}-label`}
              className="hc-input"
              value={form.label}
              onChange={(event) => setField("label", event.target.value)}
              maxLength={HOME_CARE_LIMITS.KEY_LABEL_MAX}
              autoComplete="off"
            />
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.keys.holder_label")}</span>
            <Dropdown value={form.holder} onChange={(value) => setField("holder", value)} ariaLabel={t("home_care.keys.holder_label")} options={receiverOptions(null)} />
          </div>
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !form.tag.trim()}>
              {t("home_care.keys.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setOpen(null)} disabled={busy}>
              {t("home_care.keys.cancel")}
            </button>
          </div>
        </form>
      ) : canManage && canWrite && !open ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={startAdd} disabled={busy}>
            {t("home_care.keys.add")}
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
