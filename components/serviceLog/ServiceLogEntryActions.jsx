"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import DateField from "@/components/ui/DateField";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import { PROVENANCES, SERVICE_UNITS } from "@/lib/serviceLog/constants";

function errorMessage(body, t) {
  return body?.message || t("service_log.errors.invalid_input", "");
}

export default function ServiceLogEntryActions({ entry, onChanged }) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [corrections, setCorrections] = useState(null);
  const [form, setForm] = useState({
    date: entry.date || "",
    quantity: entry.quantity ?? "",
    unit: entry.unit || "HOUR",
    workerName: entry.workerName || "",
    moneyAmount: entry.moneyAmount ?? "",
    moneyNote: entry.moneyNote || "",
    note: entry.note || "",
    noteProvenance: entry.noteProvenance || "TOOTAJA_TAHELEPANEK",
    reason: ""
  });

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const request = useCallback(
    async (url, options) => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...(options?.body ? { "Content-Type": "application/json" } : {}),
            "x-ui-locale": locale || "et"
          }
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(errorMessage(body, t));
          return null;
        }
        return body;
      } catch {
        setError(t("service_log.errors.invalid_input", ""));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [locale, t]
  );

  const save = async (event) => {
    event.preventDefault();
    const body = await request(`/api/service-entries/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        expectedUpdatedAt: entry.updatedAt,
        date: form.date,
        quantity: form.quantity,
        unit: form.unit,
        workerName: form.workerName,
        moneyAmount: form.moneyAmount === "" ? null : form.moneyAmount,
        moneyNote: form.moneyNote,
        note: form.note,
        noteProvenance: form.noteProvenance,
        ...(entry.status === "FINAL" ? { reason: form.reason } : {})
      })
    });
    if (body) {
      setEditing(false);
      await onChanged?.();
    }
  };

  const removeDraft = async () => {
    if (!window.confirm(t("service_log.entry_actions.delete_confirm", ""))) return;
    const body = await request(`/api/service-entries/${entry.id}`, { method: "DELETE" });
    if (body) await onChanged?.();
  };

  const voidFinal = async () => {
    const reason = window.prompt(t("service_log.entry_actions.void_reason", ""), "")?.trim();
    if (!reason) return;
    const body = await request(`/api/service-entries/${entry.id}/lifecycle`, {
      method: "POST",
      body: JSON.stringify({ action: "void", reason })
    });
    if (body) await onChanged?.();
  };

  const loadHistory = async () => {
    const nextOpen = !historyOpen;
    setHistoryOpen(nextOpen);
    if (!nextOpen) return;
    const body = await request(`/api/service-entries/${entry.id}/corrections`, { method: "GET" });
    if (body) setCorrections(Array.isArray(body.corrections) ? body.corrections : []);
  };

  return (
    <div className="sl-entry-tools">
      <div className="sl-entry-actions">
        {entry.status !== "VOID" ? (
          <button type="button" className="sl-entry-btn" disabled={busy} onClick={() => setEditing((v) => !v)}>
            {t("service_log.entry_actions.edit", "")}
          </button>
        ) : null}
        {entry.status === "DRAFT" ? (
          <button type="button" className="sl-entry-btn is-danger" disabled={busy} onClick={removeDraft}>
            {t("service_log.entry_actions.delete", "")}
          </button>
        ) : null}
        {entry.status === "FINAL" ? (
          <button type="button" className="sl-entry-btn is-danger" disabled={busy} onClick={voidFinal}>
            {t("service_log.entry_actions.void", "")}
          </button>
        ) : null}
        <button type="button" className="sl-entry-btn" disabled={busy} onClick={loadHistory}>
          {t("service_log.entry_actions.history", "")}
        </button>
      </div>

      {editing ? (
        <form className="sl-entry-editor" onSubmit={save}>
          <div className="sl-row">
            <label className="sl-field">
              <span className="sl-label">{t("service_log.form.date", "")}</span>
              <DateField name="entryDate" value={form.date} onChange={(value) => change("date", value)} />
            </label>
            <label className="sl-field">
              <span className="sl-label">{t("service_log.form.quantity", "")}</span>
              <Input type="number" step="0.01" min="0.01" value={form.quantity} onChange={(event) => change("quantity", event.target.value)} />
            </label>
            <label className="sl-field">
              <span className="sl-label">{t("service_log.form.unit", "")}</span>
              <Dropdown value={form.unit} onChange={(value) => change("unit", value)} ariaLabel={t("service_log.form.unit", "")} options={SERVICE_UNITS.map((value) => ({ value, label: t(`service_log.units.${value.toLowerCase()}`, value) }))} />
            </label>
          </div>
          <label className="sl-field">
            <span className="sl-label">{t("service_log.entry_actions.worker", "")}</span>
            <Input value={form.workerName} onChange={(event) => change("workerName", event.target.value)} />
          </label>
          <label className="sl-field">
            <span className="sl-label">{t("service_log.form.note", "")}</span>
            <textarea className="sl-input sl-textarea" rows={3} value={form.note} onChange={(event) => change("note", event.target.value)} />
          </label>
          <label className="sl-field">
            <span className="sl-label">{t("service_log.form.note_provenance", "")}</span>
            <Dropdown value={form.noteProvenance} onChange={(value) => change("noteProvenance", value)} ariaLabel={t("service_log.form.note_provenance", "")} options={PROVENANCES.map((value) => ({ value, label: t(`service_log.provenance.${value}`, value) }))} />
          </label>
          <div className="sl-row">
            <label className="sl-field">
              <span className="sl-label">{t("service_log.entry_actions.money", "")}</span>
              <Input type="number" step="0.01" min="0" value={form.moneyAmount} onChange={(event) => change("moneyAmount", event.target.value)} />
            </label>
            <label className="sl-field">
              <span className="sl-label">{t("service_log.entry_actions.money_note", "")}</span>
              <Input value={form.moneyNote} onChange={(event) => change("moneyNote", event.target.value)} />
            </label>
          </div>
          {entry.status === "FINAL" ? (
            <label className="sl-field">
              <span className="sl-label">{t("service_log.entry_actions.reason", "")}</span>
              <Input required value={form.reason} onChange={(event) => change("reason", event.target.value)} />
            </label>
          ) : null}
          <div className="sl-entry-actions">
            <button type="submit" className="sl-entry-btn is-primary" disabled={busy}>{t("service_log.entry_actions.save", "")}</button>
            <button type="button" className="sl-entry-btn" onClick={() => setEditing(false)}>{t("service_log.entry_actions.cancel", "")}</button>
          </div>
        </form>
      ) : null}

      {historyOpen ? (
        <div className="sl-entry-history">
          <strong>{t("service_log.entry_actions.history_title", "")}</strong>
          {corrections === null ? <p>{t("service_log.entry_actions.loading", "")}</p> : corrections.length ? (
            <ol>{corrections.map((item) => <li key={item.id}><span>{item.reason}</span><small>{item.createdAt ? new Date(item.createdAt).toLocaleString(locale || "et") : ""} · {item.changedFields.join(", ")}</small></li>)}</ol>
          ) : <p>{t("service_log.entry_actions.history_empty", "")}</p>}
        </div>
      ) : null}
      {error ? <p className="sl-error" role="alert">{error}</p> : null}
    </div>
  );
}
