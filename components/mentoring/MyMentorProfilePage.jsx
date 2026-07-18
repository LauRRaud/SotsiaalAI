"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import styles from "./MentoringPage.module.css";

const EMPTY_FORM = Object.freeze({
  displayName: "",
  title: "",
  organization: "",
  fields: "",
  topics: "",
  languages: "",
  formats: "",
  bioShort: "",
  bioFull: "",
  experienceSummary: ""
});

function toForm(profile) {
  if (!profile) return { ...EMPTY_FORM };
  return {
    displayName: profile.displayName || "",
    title: profile.title || "",
    organization: profile.organization || "",
    fields: (profile.fields || []).join(", "),
    topics: (profile.topics || []).join(", "),
    languages: (profile.languages || []).join(", "),
    formats: (profile.formats || []).join(", "),
    bioShort: profile.bioShort || "",
    bioFull: profile.bioFull || "",
    experienceSummary: profile.experienceSummary || ""
  };
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function MyMentorProfilePage() {
  const { t } = useI18n();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const response = await fetch("/api/mentoring/profile", { cache: "no-store", signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.load_failed" }));
      }
      setProfile(payload?.profile || null);
      setForm(toForm(payload?.profile));
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

  const save = useCallback(async (event) => {
    event?.preventDefault?.();
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/mentoring/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          title: form.title,
          organization: form.organization,
          fields: splitList(form.fields),
          topics: splitList(form.topics),
          languages: splitList(form.languages),
          formats: splitList(form.formats),
          bioShort: form.bioShort,
          bioFull: form.bioFull,
          experienceSummary: form.experienceSummary,
          expectedVersion: profile?.version
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.save_failed" }));
      }
      setProfile(payload?.profile || null);
      setForm(toForm(payload?.profile));
      setFeedback(t("mentoring.my_profile.saved"));
    } catch (error) {
      setFeedback(error?.message || t("mentoring.errors.save_failed"));
    } finally {
      setBusy(false);
    }
  }, [form, profile, t]);

  const runAction = useCallback(async (action, extra = {}) => {
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/mentoring/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.save_failed" }));
      }
      setProfile(payload?.profile || null);
      setForm(toForm(payload?.profile));
      setFeedback(t(`mentoring.my_profile.action_done.${action}`));
    } catch (error) {
      setFeedback(error?.message || t("mentoring.errors.save_failed"));
    } finally {
      setBusy(false);
    }
  }, [t]);

  const status = profile?.status || null;

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor="">
        <SubpageHeader title={t("mentoring.my_profile.title")} />
        <p className={styles.lead}>{t("mentoring.my_profile.lead")}</p>
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
            {status ? (
              <p className={styles.statusLine}>
                <span className={styles.badge}>{t(`mentoring.profile_status.${status.toLowerCase()}`)}</span>
                {status === "REJECTED" && profile?.reviewReasonKey ? (
                  <span> {t(`mentoring.review_reason.${profile.reviewReasonKey}`)}</span>
                ) : null}
              </p>
            ) : (
              <p className={styles.statusLine}>{t("mentoring.my_profile.not_created")}</p>
            )}
            <p className={styles.statusLine}>{t("mentoring.my_profile.moderation_note")}</p>

            <form className={styles.form} onSubmit={save}>
              <label>
                <span>{t("mentoring.my_profile.display_name")}</span>
                <Input
                  maxLength={600}
                  onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  required
                  value={form.displayName}
                />
              </label>
              <label>
                <span>{t("mentoring.my_profile.job_title")}</span>
                <Input
                  maxLength={600}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  value={form.title}
                />
              </label>
              <label>
                <span>{t("mentoring.my_profile.organization")}</span>
                <Input
                  maxLength={600}
                  onChange={(event) => setForm((prev) => ({ ...prev, organization: event.target.value }))}
                  value={form.organization}
                />
                <span className={styles.fieldHint}>{t("mentoring.my_profile.organization_hint")}</span>
              </label>
              <label>
                <span>{t("mentoring.my_profile.fields")}</span>
                <Input
                  onChange={(event) => setForm((prev) => ({ ...prev, fields: event.target.value }))}
                  value={form.fields}
                />
                <span className={styles.fieldHint}>{t("mentoring.my_profile.list_hint")}</span>
              </label>
              <label>
                <span>{t("mentoring.my_profile.topics")}</span>
                <Input
                  onChange={(event) => setForm((prev) => ({ ...prev, topics: event.target.value }))}
                  value={form.topics}
                />
              </label>
              <label>
                <span>{t("mentoring.my_profile.languages")}</span>
                <Input
                  onChange={(event) => setForm((prev) => ({ ...prev, languages: event.target.value }))}
                  value={form.languages}
                />
              </label>
              <label>
                <span>{t("mentoring.my_profile.formats")}</span>
                <Input
                  onChange={(event) => setForm((prev) => ({ ...prev, formats: event.target.value }))}
                  value={form.formats}
                />
                <span className={styles.fieldHint}>{t("mentoring.my_profile.formats_hint")}</span>
              </label>
              <label>
                <span>{t("mentoring.my_profile.bio_short")}</span>
                <Textarea
                  maxLength={600}
                  onChange={(event) => setForm((prev) => ({ ...prev, bioShort: event.target.value }))}
                  rows={3}
                  value={form.bioShort}
                />
              </label>
              <label>
                <span>{t("mentoring.my_profile.bio_full")}</span>
                <Textarea
                  maxLength={4000}
                  onChange={(event) => setForm((prev) => ({ ...prev, bioFull: event.target.value }))}
                  rows={5}
                  value={form.bioFull}
                />
              </label>
              <label>
                <span>{t("mentoring.my_profile.experience")}</span>
                <Textarea
                  maxLength={4000}
                  onChange={(event) => setForm((prev) => ({ ...prev, experienceSummary: event.target.value }))}
                  rows={4}
                  value={form.experienceSummary}
                />
              </label>
              <div className={styles.actions}>
                <Button disabled={busy || !form.displayName.trim()} type="submit">
                  {t("mentoring.my_profile.save")}
                </Button>
                {status === "DRAFT" || status === "REJECTED" ? (
                  <Button disabled={busy} onClick={() => runAction("submit")} variant="secondary">
                    {t("mentoring.my_profile.submit_review")}
                  </Button>
                ) : null}
              </div>
            </form>

            {status ? (
              <div className={styles.dangerZone}>
                <div className={styles.actions}>
                  {status === "ACTIVE" ? (
                    <>
                      <Button
                        disabled={busy}
                        onClick={() => runAction("capacity", { capacity: profile?.capacity === "OPEN" ? "FULL" : "OPEN" })}
                        variant="secondary"
                      >
                        {profile?.capacity === "OPEN"
                          ? t("mentoring.my_profile.set_full")
                          : t("mentoring.my_profile.set_open")}
                      </Button>
                      <Button disabled={busy} onClick={() => runAction("pause")} variant="secondary">
                        {t("mentoring.my_profile.pause")}
                      </Button>
                    </>
                  ) : null}
                  {status === "PAUSED" ? (
                    <Button disabled={busy} onClick={() => runAction("resume")} variant="secondary">
                      {t("mentoring.my_profile.resume")}
                    </Button>
                  ) : null}
                  {status !== "RETIRED" && status !== "REVOKED" ? (
                    <Button disabled={busy} onClick={() => runAction("retire")} variant="secondary">
                      {t("mentoring.my_profile.retire")}
                    </Button>
                  ) : null}
                </div>
                <p className={styles.fieldHint}>{t("mentoring.my_profile.retire_hint")}</p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
