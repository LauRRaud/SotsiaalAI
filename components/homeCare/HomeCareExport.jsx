"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import { CARE_EXPORT_REASONS } from "@/lib/homeCare/constants";
import { HOME_CARE_EXPORT_EXCLUSIONS } from "@/lib/homeCare/exportFormat";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

import HomeCareOutbox from "./HomeCareOutbox";
import { formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/** Üle selle suuruse brauser kontrollsummat ei arvuta: fail oleks mälus kaks korda. */
const VERIFY_MAX_BYTES = 256 * 1024 * 1024;

function fileNameFrom(disposition) {
  const match = /filename="([^"]+)"/.exec(String(disposition || ""));
  return match ? match[1].replace(/[^A-Za-z0-9._-]/g, "") : "";
}

async function sha256Hex(blob) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || blob.size > VERIFY_MAX_BYTES) return "";
  const digest = await subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Koduteenuse täielik väljavõte: kõik andmed ühe failina asutuse enda nupust.
 *
 * Kaks sammu, sest fail sisaldab kõigi klientide andmeid: põhjus ja „Koosta",
 * siis kinnitus. Brauser arvutab alla laaditud faili kontrollsumma ise üle ja
 * salvestab faili ainult siis, kui see klapib serveri omaga.
 */
export default function HomeCareExport({ context, initial }) {
  const { t, locale } = useI18n();
  const { call } = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";

  const [data, setData] = useState(initial);
  const [reason, setReason] = useState("");
  /* "" | "confirm" | "working" */
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  /* Topeltklõps ei tohi teha kahte väljavõtet: olek uueneb alles järgmisel joonistusel. */
  const runningRef = useRef(false);

  const size = (bytes) => {
    if (!Number.isFinite(bytes)) return "";
    if (bytes < 1024 * 1024) return t("home_care.export.size_kb", { n: Math.max(1, Math.round(bytes / 1024)) });
    const megabytes = bytes / (1024 * 1024);
    const text = megabytes >= 10 ? String(Math.round(megabytes)) : megabytes.toFixed(1).replace(".", t("home_care.export.decimal_mark"));
    return t("home_care.export.size_mb", { n: text });
  };

  const download = async () => {
    if (runningRef.current || !reason) return;
    runningRef.current = true;
    setStep("working");
    setError("");
    setDone(null);
    try {
      const response = await fetch(`${homeCareBase(organizationId)}/valjavote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        cache: "no-store",
        body: JSON.stringify({ reasonCode: reason })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(resolveApiMessage({ payload, t, fallbackKey: "home_care.errors.export_failed" }));
        return;
      }
      const blob = await response.blob();
      const expected = response.headers.get("X-Home-Care-Export-Sha256") || "";
      const actual = await sha256Hex(blob);
      if (expected && actual && expected !== actual) {
        setError(t("home_care.export.mismatch"));
        return;
      }
      saveBlob(blob, fileNameFrom(response.headers.get("Content-Disposition")) || "koduteenus-valjavote.json");
      setDone({ rows: Number(response.headers.get("X-Home-Care-Export-Rows")) || 0, bytes: blob.size, sha: expected });
      setReason("");
      const fresh = await call(`${homeCareBase(organizationId)}/valjavote`, { quiet: true });
      if (fresh.ok) setData(fresh.data);
    } catch {
      setError(t("home_care.errors.export_failed"));
    } finally {
      runningRef.current = false;
      setStep("");
    }
  };

  const counts = data.counts;
  const working = step === "working";

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />
      <HomeCareOutbox ownerId={context.membership?.id || ""} timeZone={timeZone} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.client.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.export.title")}</h2>
        <p className="hc-sub">{t("home_care.export.intro")}</p>
        <p className="hc-hint">{t("home_care.export.who_hint")}</p>
      </div>

      <section className="hc-section">
        <h3 className="hc-section-title">{t("home_care.export.contents_title")}</h3>
        <ul className="hc-list hc-list--plain">
          <li className="hc-entry__meta">{t("home_care.export.count.clients", { count: counts.clients })}</li>
          <li className="hc-entry__meta">{t("home_care.export.count.entries", { count: counts.entries })}</li>
          <li className="hc-entry__meta">{t("home_care.export.count.access", { count: counts.accessLog })}</li>
          <li className="hc-entry__meta">{t("home_care.export.count.histories", { count: counts.importedHistories })}</li>
          <li className="hc-entry__meta">{t("home_care.export.count.releases", { count: counts.chronologyReleases })}</li>
        </ul>
        <p className="hc-hint">{t("home_care.export.contents_more")}</p>
      </section>

      <section className="hc-section">
        <h3 className="hc-section-title">{t("home_care.export.excluded_title")}</h3>
        <ul className="hc-list hc-list--plain">
          {HOME_CARE_EXPORT_EXCLUSIONS.map((item) => (
            <li key={item.key} className="hc-entry__meta">
              {t(`home_care.export.excluded.${item.key}`)}
            </li>
          ))}
        </ul>
      </section>

      <section className="hc-section hc-section--card" aria-busy={working}>
        <h3 className="hc-section-title">{t("home_care.export.make_title")}</h3>
        <div className="hc-field" inert={step !== ""}>
          <span className="hc-label" id={`${fieldId}-reason`}>
            {t("home_care.export.reason_label")}
          </span>
          <div className="hc-chips" role="group" aria-labelledby={`${fieldId}-reason`}>
            {CARE_EXPORT_REASONS.map((value) => (
              <button key={value} type="button" className="hc-chip" aria-pressed={reason === value} onClick={() => setReason(value)}>
                {t(`home_care.export.reasons.${value}`)}
              </button>
            ))}
          </div>
          <p className="hc-hint">{t("home_care.export.reason_hint")}</p>
        </div>

        {error ? (
          <p className="hc-error" role="alert">
            {error}
          </p>
        ) : null}

        {step === "" ? (
          <div className="hc-row">
            <button
              className="hc-btn hc-btn--primary"
              type="button"
              disabled={!reason}
              onClick={() => {
                setError("");
                setStep("confirm");
              }}
            >
              {t("home_care.export.start")}
            </button>
          </div>
        ) : null}

        {step === "confirm" ? (
          <>
            <p className="hc-notice hc-notice--warn">{t("home_care.export.confirm_notice")}</p>
            <div className="hc-row">
              <button className="hc-btn hc-btn--primary" type="button" onClick={download}>
                {t("home_care.export.confirm")}
              </button>
              <button className="hc-btn" type="button" onClick={() => setStep("")}>
                {t("home_care.entry.cancel")}
              </button>
            </div>
          </>
        ) : null}

        {working ? (
          <p className="hc-notice" role="status">
            {t("home_care.export.working")}
          </p>
        ) : null}

        {done ? (
          <div role="status">
            <p className="hc-ok">{t("home_care.export.done", { rows: done.rows, size: size(done.bytes) })}</p>
            {done.sha ? <p className="hc-entry__meta">{t("home_care.export.checksum", { sha: done.sha })}</p> : null}
            <p className="hc-hint">{t("home_care.export.checksum_hint")}</p>
          </div>
        ) : null}
      </section>

      <section className="hc-section">
        <h3 className="hc-section-title">{t("home_care.export.recent_title")}</h3>
        {data.recent.length === 0 ? (
          <p className="hc-hint">{t("home_care.export.recent_empty")}</p>
        ) : (
          <ul className="hc-list hc-list--plain">
            {data.recent.map((row) => (
              <li key={row.id}>
                <p className="hc-sub">
                  {[
                    formatDateTime(row.createdAt, timeZone),
                    row.byName,
                    row.reasonCode ? t(`home_care.export.reasons.${row.reasonCode}`) : "",
                    row.rowCount === null ? "" : t("home_care.export.rows", { count: row.rowCount }),
                    size(row.byteCount)
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {row.contentSha256 ? (
                  <p className="hc-entry__meta">{t("home_care.export.recent_checksum", { sha: row.contentSha256 })}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
