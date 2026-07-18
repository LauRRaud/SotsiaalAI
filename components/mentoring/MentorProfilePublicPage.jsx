"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";
import styles from "./MentoringPage.module.css";

export default function MentorProfilePublicPage({ profileId }) {
  const { t, locale } = useI18n();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium" }),
    [locale]
  );

  const load = useCallback(async (signal) => {
    setLoadError("");
    setUnavailable(false);
    try {
      const response = await fetch(`/api/mentoring/catalog/${encodeURIComponent(profileId)}`, {
        cache: "no-store",
        signal
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 404) {
        setUnavailable(true);
        return;
      }
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.load_failed" }));
      }
      setProfile(payload?.profile || null);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(error?.message || t("mentoring.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [profileId, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const submitRequest = useCallback(async (event) => {
    event?.preventDefault?.();
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/mentoring/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorProfileId: profileId, message })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.save_failed" }));
      }
      setSent(true);
      setFeedback(t("mentoring.profile_public.request_sent"));
    } catch (error) {
      setFeedback(error?.message || t("mentoring.errors.save_failed"));
    } finally {
      setBusy(false);
    }
  }, [message, profileId, t]);

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor="">
        <SubpageHeader title={t("mentoring.profile_public.title")} />
        <p aria-live="polite" className={styles.liveRegion} role="status" tabIndex={-1}>
          {feedback}
        </p>

        {loading ? <p className={styles.loading}>{t("mentoring.labels.loading")}</p> : null}

        {unavailable ? (
          <div className={styles.empty}>
            <p>{t("mentoring.profile_public.unavailable")}</p>
            <Button as="a" href={localizePath("/mentorlus")} variant="secondary">
              {t("mentoring.labels.back_to_mentoring")}
            </Button>
          </div>
        ) : null}

        {loadError ? (
          <div className={styles.loadError}>
            <p>{loadError}</p>
            <Button onClick={() => { setLoading(true); void load(); }} variant="secondary">
              {t("mentoring.labels.retry")}
            </Button>
          </div>
        ) : null}

        {!loading && profile ? (
          <>
            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <h2>{profile.displayName}</h2>
                {profile.title || profile.organization ? (
                  <p>{[profile.title, profile.organization].filter(Boolean).join(" · ")}</p>
                ) : null}
              </div>
              {profile.external ? (
                <p className={`${styles.badge} ${styles.badgeExternal}`}>
                  {t("mentoring.home.external_badge", {
                    date: profile.checkedAt ? formatter.format(new Date(profile.checkedAt)) : ""
                  })}
                </p>
              ) : (
                <p className={styles.statusLine}>{t("mentoring.profile_public.self_declared")}</p>
              )}
              {profile.bioFull || profile.bioShort ? (
                <p className={styles.cardMeta}>{profile.bioFull || profile.bioShort}</p>
              ) : null}
              {profile.experienceSummary ? (
                <p className={styles.cardMeta}>{profile.experienceSummary}</p>
              ) : null}
              {profile.fields?.length ? (
                <div className={styles.tagRow}>
                  {profile.fields.map((field) => <span key={field} className={styles.tag}>{field}</span>)}
                </div>
              ) : null}
              {profile.topics?.length ? (
                <div className={styles.tagRow}>
                  {profile.topics.map((topic) => <span key={topic} className={styles.tag}>{topic}</span>)}
                </div>
              ) : null}
              {profile.languages?.length ? (
                <p className={styles.statusLine}>
                  {t("mentoring.profile_public.languages", { languages: profile.languages.join(", ") })}
                </p>
              ) : null}
              {profile.formats?.length ? (
                <p className={styles.statusLine}>
                  {t("mentoring.profile_public.formats", { formats: profile.formats.join(", ") })}
                </p>
              ) : null}
            </section>

            {profile.canRequest && !sent ? (
              <section className={styles.section}>
                <div className={styles.sectionHeading}>
                  <h2>{t("mentoring.profile_public.request_title")}</h2>
                  <p>{t("mentoring.profile_public.request_help")}</p>
                </div>
                <form className={styles.form} onSubmit={submitRequest}>
                  <label>
                    <span>{t("mentoring.profile_public.request_message")}</span>
                    <Textarea
                      maxLength={4000}
                      onChange={(event) => setMessage(event.target.value)}
                      required
                      rows={5}
                      value={message}
                    />
                    <span className={styles.fieldHint}>{t("mentoring.profile_public.no_client_data")}</span>
                  </label>
                  <div className={styles.actions}>
                    <Button disabled={busy || !message.trim()} type="submit">
                      {t("mentoring.profile_public.request_submit")}
                    </Button>
                  </div>
                </form>
              </section>
            ) : null}

            {!profile.canRequest && !profile.external ? (
              <p className={styles.empty}>{t("mentoring.profile_public.capacity_full_note")}</p>
            ) : null}

            {sent ? (
              <div className={styles.actions}>
                <Button as="a" href={localizePath("/mentorlus")} variant="secondary">
                  {t("mentoring.labels.back_to_mentoring")}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
