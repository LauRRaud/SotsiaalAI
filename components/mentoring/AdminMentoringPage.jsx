"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import styles from "./MentoringPage.module.css";

const REVIEW_REASONS = ["incomplete", "misleading", "out_of_scope", "abuse", "duplicate", "other"];
const CONSENT_STATUSES = ["PENDING_CONSENT", "CONSENTED", "DECLINED_CONSENT", "STALE"];

export default function AdminMentoringPage() {
  const { t, locale } = useI18n();
  const [queue, setQueue] = useState([]);
  const [counters, setCounters] = useState(null);
  const [external, setExternal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [reasonByProfile, setReasonByProfile] = useState({});
  const [consentByProfile, setConsentByProfile] = useState({});

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium" }),
    [locale]
  );
  const formatDate = useCallback((value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? formatter.format(date) : "";
  }, [formatter]);

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const [queueResponse, externalResponse] = await Promise.all([
        fetch("/api/admin/mentoring", { cache: "no-store", signal }),
        fetch("/api/admin/mentoring/external", { cache: "no-store", signal })
      ]);
      const queuePayload = await queueResponse.json().catch(() => ({}));
      const externalPayload = await externalResponse.json().catch(() => ({}));
      if (!queueResponse.ok || queuePayload?.ok === false) {
        throw new Error(resolveApiMessage({ payload: queuePayload, t, fallbackKey: "mentoring.errors.load_failed" }));
      }
      setQueue(queuePayload?.queue || []);
      setCounters(queuePayload?.counters || null);
      setExternal(externalResponse.ok ? externalPayload?.records || [] : []);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(error?.message || t("mentoring.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const act = useCallback(async (url, body, doneKey) => {
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.save_failed" }));
      }
      if (doneKey) setFeedback(t(doneKey));
      await load();
      return payload;
    } catch (error) {
      setFeedback(error?.message || t("mentoring.errors.save_failed"));
      return null;
    } finally {
      setBusy(false);
    }
  }, [load, t]);

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor="">
        <SubpageHeader title={t("mentoring.admin.title")} />
        <p className={styles.lead}>{t("mentoring.admin.lead")}</p>
        <p aria-live="polite" className={styles.liveRegion} role="status" tabIndex={-1}>
          {feedback}
        </p>

        {loading ? <p className={styles.loading}>{t("mentoring.labels.loading")}</p> : null}
        {loadError ? (
          <div className={styles.loadError}>
            <p>{loadError}</p>
            <Button onClick={() => { setLoading(true); void load(); }} variant="secondary">
              {t("mentoring.labels.retry")}
            </Button>
          </div>
        ) : null}

        {!loading && !loadError ? (
          <>
            {counters ? (
              <section className={styles.section}>
                <div className={styles.cards}>
                  <div className={styles.card}>
                    <p className={styles.cardTitle}>{counters.activeProfiles}</p>
                    <p className={styles.cardMeta}>{t("mentoring.admin.counter_active")}</p>
                  </div>
                  <div className={styles.card}>
                    <p className={styles.cardTitle}>{counters.pendingReview}</p>
                    <p className={styles.cardMeta}>{t("mentoring.admin.counter_pending")}</p>
                  </div>
                  <div className={styles.card}>
                    <p className={styles.cardTitle}>{counters.consentedExternal}/{counters.externalRecords}</p>
                    <p className={styles.cardMeta}>{t("mentoring.admin.counter_external")}</p>
                  </div>
                  <div className={styles.card}>
                    <p className={styles.cardTitle}>{counters.openRelations}</p>
                    <p className={styles.cardMeta}>{t("mentoring.admin.counter_relations")}</p>
                  </div>
                </div>
              </section>
            ) : null}

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <h2>{t("mentoring.admin.queue_title")}</h2>
                <p>{t("mentoring.admin.queue_help")}</p>
              </div>
              {queue.length ? (
                queue.map((profile) => (
                  <div key={profile.id} className={styles.noteItem}>
                    <p className={styles.cardTitle}>{profile.displayName}</p>
                    <p className={styles.cardMeta}>
                      {[profile.title, profile.organization].filter(Boolean).join(" · ")}
                    </p>
                    {profile.bioShort ? <p className={styles.cardMeta}>{profile.bioShort}</p> : null}
                    <div className={styles.inlineForm}>
                      <Button
                        disabled={busy}
                        onClick={() => act(`/api/admin/mentoring/${encodeURIComponent(profile.id)}`, {
                          action: "review",
                          decision: "APPROVE"
                        }, "mentoring.admin.approved_feedback")}
                        size="sm"
                      >
                        {t("mentoring.admin.approve")}
                      </Button>
                      <Dropdown
                        ariaLabel={t("mentoring.admin.reason_label")}
                        onChange={(next) => setReasonByProfile((prev) => ({ ...prev, [profile.id]: next }))}
                        value={reasonByProfile[profile.id] || "incomplete"}
                        options={REVIEW_REASONS.map((reason) => ({
                          value: reason,
                          label: t(`mentoring.review_reason.${reason}`)
                        }))}
                      />
                      <Button
                        disabled={busy}
                        onClick={() => act(`/api/admin/mentoring/${encodeURIComponent(profile.id)}`, {
                          action: "review",
                          decision: "REJECT",
                          reasonKey: reasonByProfile[profile.id] || "incomplete"
                        }, "mentoring.admin.rejected_feedback")}
                        size="sm"
                        variant="secondary"
                      >
                        {t("mentoring.admin.reject")}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className={styles.empty}>{t("mentoring.admin.queue_empty")}</p>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <h2>{t("mentoring.admin.external_title")}</h2>
                <p>{t("mentoring.admin.external_help")}</p>
              </div>
              <div className={styles.actions}>
                <Button
                  disabled={busy}
                  onClick={() => act("/api/admin/mentoring", { action: "import_seed" }, "mentoring.admin.import_done_feedback")}
                  variant="secondary"
                >
                  {t("mentoring.admin.import_seed")}
                </Button>
              </div>
              {external.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.adminTable}>
                    <thead>
                      <tr>
                        <th>{t("mentoring.admin.col_name")}</th>
                        <th>{t("mentoring.admin.col_consent")}</th>
                        <th>{t("mentoring.admin.col_checked")}</th>
                        <th>{t("mentoring.admin.col_actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {external.map((record) => (
                        <tr key={record.id}>
                          <td>
                            {record.displayName}
                            {record.externalProfileUrl ? (
                              <>
                                {" "}
                                <a href={record.externalProfileUrl} rel="noopener noreferrer" target="_blank">
                                  {t("mentoring.admin.source_link")}
                                </a>
                              </>
                            ) : null}
                          </td>
                          <td>
                            <span className={styles.badge}>
                              {t(`mentoring.consent_status.${String(record.consentStatus || "PENDING_CONSENT").toLowerCase()}`)}
                            </span>
                          </td>
                          <td>{formatDate(record.checkedAt)}</td>
                          <td>
                            <div className={styles.inlineForm}>
                              <Dropdown
                                ariaLabel={t("mentoring.admin.consent_label")}
                                onChange={(next) => setConsentByProfile((prev) => ({ ...prev, [record.id]: next }))}
                                value={consentByProfile[record.id] || record.consentStatus || "PENDING_CONSENT"}
                                options={CONSENT_STATUSES.map((status) => ({
                                  value: status,
                                  label: t(`mentoring.consent_status.${status.toLowerCase()}`)
                                }))}
                              />
                              <Button
                                disabled={busy}
                                onClick={() => act(`/api/admin/mentoring/${encodeURIComponent(record.id)}`, {
                                  action: "consent",
                                  consentStatus: consentByProfile[record.id] || record.consentStatus || "PENDING_CONSENT",
                                  refreshCheckedAt: true
                                }, "mentoring.admin.consent_saved_feedback")}
                                size="sm"
                                variant="secondary"
                              >
                                {t("mentoring.admin.consent_save")}
                              </Button>
                              <Button
                                disabled={busy}
                                onClick={() => act(`/api/admin/mentoring/${encodeURIComponent(record.id)}`, {
                                  action: "delete_external"
                                }, "mentoring.admin.deleted_feedback")}
                                size="sm"
                                variant="secondary"
                              >
                                {t("mentoring.admin.delete_external")}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.empty}>{t("mentoring.admin.external_empty")}</p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
