"use client";

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";

const BASIS_MIN = 5;
const BASIS_MAX = 300;

function dateText(value, locale) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export default function AdminServiceRepresentationClient() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [basis, setBasis] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/service-representation", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || t("admin.service_representation.errors.load_failed"));
      setRows(Array.isArray(payload?.rows) ? payload.rows : []);
    } catch (loadError) {
      setRows([]);
      setError(loadError?.message || t("admin.service_representation.errors.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(row, action) {
    if (busyId) return;
    const note = String(basis[row.id] || "").trim();
    setMessage("");
    setError("");
    if (action === "confirm" && (note.length < BASIS_MIN || note.length > BASIS_MAX)) {
      setError(t("admin.service_representation.errors.basis_required", { min: BASIS_MIN, max: BASIS_MAX }));
      return;
    }
    setBusyId(row.id);
    try {
      const response = await fetch("/api/admin/service-representation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, profileId: row.id, registryCode: row.registryCode, basis: note })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        /* Sõnum tuleb võtmest, et kohatäited ({min}, {max}) saaksid väärtuse. */
        const text = payload?.messageKey ? t(payload.messageKey, payload?.details || {}) : "";
        throw new Error(text || payload?.message || t("admin.service_representation.errors.action_failed"));
      }
      const next = payload?.row;
      if (next?.id) setRows((current) => current.map((item) => (item.id === next.id ? next : item)));
      setBasis((current) => ({ ...current, [row.id]: "" }));
      setMessage(t(
        action === "confirm"
          ? "admin.service_representation.confirmed_message"
          : row.status === "PUBLISHED"
            ? "admin.service_representation.revoked_hidden_message"
            : "admin.service_representation.revoked_message",
        { name: row.organizationName }
      ));
    } catch (actionError) {
      setError(actionError?.message || t("admin.service_representation.errors.action_failed"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="space-y-6 py-8" aria-labelledby="service-representation-admin-title">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
          {t("admin.service_representation.eyebrow")}
        </p>
        <h1 id="service-representation-admin-title" className="text-3xl font-semibold">
          {t("admin.service_representation.title")}
        </h1>
        <p className="max-w-3xl text-sm opacity-80">{t("admin.service_representation.lead")}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="button" onClick={() => void load()} disabled={loading}>{t("admin.common.refresh")}</Button>
        </div>
      </header>

      {message ? <p role="status" className="rounded-xl border border-emerald-700 bg-emerald-50 p-3 text-stone-900">{message}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-red-700 bg-red-50 p-3 text-stone-900">{error}</p> : null}

      {loading ? <p role="status">{t("admin.common.loading_data")}</p> : rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-stone-300 bg-white/90 text-stone-900 shadow-sm">
          <table className="w-full border-collapse text-left text-sm text-stone-900">
            <caption className="sr-only">{t("admin.service_representation.table_caption")}</caption>
            <thead className="bg-stone-100/90">
              <tr className="border-b border-stone-300">
                <th scope="col" className="p-3" style={{ color: "#292524" }}>{t("admin.service_representation.columns.organization")}</th>
                <th scope="col" className="p-3" style={{ color: "#292524" }}>{t("admin.service_representation.columns.owner")}</th>
                <th scope="col" className="p-3" style={{ color: "#292524" }}>{t("admin.service_representation.columns.profile")}</th>
                <th scope="col" className="p-3" style={{ color: "#292524" }}>{t("admin.service_representation.columns.state")}</th>
                <th scope="col" className="p-3" style={{ color: "#292524" }}>{t("admin.service_representation.columns.action")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const busy = busyId === row.id;
                const fieldId = `representation-basis-${row.id}`;
                return (
                  <tr key={row.id} className="border-b border-stone-200 align-top last:border-0">
                    <td className="p-3"><strong style={{ color: "#292524" }}>{row.organizationName}</strong><br /><span>{row.registryCode}</span></td>
                    <td className="p-3">{row.ownerEmail || "-"}</td>
                    <td className="p-3">{t(`admin.service_representation.profile_status.${row.status}`, {}, row.status)}</td>
                    <td className="p-3">
                      {row.confirmed
                        ? t(row.method === "EMAIL_LINK" ? "admin.service_representation.state_confirmed_link" : "admin.service_representation.state_confirmed", { date: dateText(row.confirmedAt, locale) })
                        : row.stale
                          ? t("admin.service_representation.state_stale", { code: row.confirmedRegistryCode || "-" })
                          : t("admin.service_representation.state_unconfirmed")}
                      {row.confirmed && row.basis ? (
                        <><br /><span>{t("admin.service_representation.basis_shown", { basis: row.basis })}</span></>
                      ) : null}
                    </td>
                    <td className="p-3">
                      {row.confirmed ? (
                        <Button type="button" onClick={() => void act(row, "revoke")} disabled={Boolean(busyId)}>
                          {busy ? t("admin.service_representation.working") : t("admin.service_representation.revoke")}
                        </Button>
                      ) : (
                        <div className="flex min-w-[16rem] flex-col gap-2">
                          <label htmlFor={fieldId} className="text-xs font-semibold">{t("admin.service_representation.basis_label")}</label>
                          <textarea
                            id={fieldId}
                            rows={2}
                            maxLength={BASIS_MAX}
                            className="w-full rounded-lg border border-stone-400 bg-white p-2 text-sm text-stone-900"
                            placeholder={t("admin.service_representation.basis_placeholder")}
                            value={basis[row.id] || ""}
                            onChange={(event) => setBasis((current) => ({ ...current, [row.id]: event.target.value }))}
                          />
                          <Button type="button" onClick={() => void act(row, "confirm")} disabled={Boolean(busyId)}>
                            {busy ? t("admin.service_representation.working") : t("admin.service_representation.confirm")}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p>{t("admin.service_representation.empty")}</p>}

      <p className="text-sm opacity-75">{t("admin.service_representation.revoke_note")}</p>
    </main>
  );
}
