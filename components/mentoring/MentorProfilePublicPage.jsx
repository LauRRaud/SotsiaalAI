"use client";

/**
 * Mentori profiil kataloogist: kes ta on, tema tutvustus ja mentorluse taotlus.
 *
 * KUJU (09.10). Leht oli üks veerg klaaspaneeli sees olevas tumedas kaardis.
 * Nüüd on see sammulava (`components/stage/StepFlight.jsx`) osadena: mentor,
 * tutvustus ja taotlus. Osad ei ole sammud (profiili loetakse, mitte ei
 * täideta), seepärast annab leht lavale `parts` ja oma sõnad („Kogu profiil”).
 * Leht avaneb esimeses osas; nupp „Soovi mentorlust” viib taotluse juurde.
 *
 * Vaated on failis ./entry/PublicProfileViews.jsx, profiili jaotab osadeks
 * ./entry/entryRows.js. Siin on andmed, päringud ja see, mis vaateid olekuga
 * seob.
 *
 * Profiil, mida kataloogis enam ei ole (vastus 404), ja laadimise viga on
 * tavaline lause koos teega edasi, mitte kast kastis.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";

import { EntryShell, TextLink } from "./entry/EntryParts";
import { PROFILE_LIMITS, publicParts, publicProfileModel } from "./entry/entryRows";
import { AboutView, RequestView, StoryView } from "./entry/PublicProfileViews";
import styles from "./entry/entry.module.css";

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
      /* Vastus ilma profiilita jättis lehe varem tühjaks: see on sama seis mis
         „profiil pole enam saadaval”. */
      if (!payload?.profile) setUnavailable(true);
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

  const submitRequest = useCallback(async () => {
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
    } catch (error) {
      setFeedback(error?.message || t("mentoring.errors.save_failed"));
    } finally {
      setBusy(false);
    }
  }, [message, profileId, t]);

  const model = useMemo(() => publicProfileModel(profile), [profile]);
  const backHref = localizePath("/mentorlus");
  const parts = publicParts({ t, model, sent });
  const requestIndex = model.viewKeys.indexOf("request");

  const renderView = (step, index, flight) => {
    switch (step.key) {
      case "story":
        return <StoryView t={t} bio={model.bio} experience={model.experience} />;
      case "request":
        return (
          <RequestView
            t={t}
            mode={sent ? "sent" : model.canRequest ? "form" : "full"}
            message={message}
            onMessage={(value) => {
              setMessage(value);
              setFeedback("");
            }}
            maxLength={PROFILE_LIMITS.text}
            busy={busy}
            note={feedback}
            onSubmit={() => void submitRequest()}
            backHref={backHref}
          />
        );
      default: {
        const groupTitles = {
          fields: t("mentoring.profile_public.group.fields"),
          topics: t("mentoring.profile_public.group.topics"),
          languages: t("mentoring.profile_public.group.languages"),
          formats: t("mentoring.profile_public.group.formats")
        };
        const checked = profile?.checkedAt ? new Date(profile.checkedAt) : null;
        const checkedText = checked && Number.isFinite(checked.getTime()) ? formatter.format(checked) : "";
        return (
          <AboutView
            t={t}
            heading={model.heading}
            sub={model.sub}
            chip={
              model.external
                ? { text: t("mentoring.home.external_chip"), tone: "quiet" }
                : model.canRequest
                  ? { text: t("mentoring.home.capacity_open"), tone: "ok" }
                  : { text: t("mentoring.home.capacity_full"), tone: "quiet" }
            }
            groups={model.groups.map((group) => ({ ...group, title: groupTitles[group.key] }))}
            note={
              model.external
                ? checkedText
                  ? t("mentoring.home.external_badge", { date: checkedText })
                  : t("mentoring.profile_public.external_help")
                : t("mentoring.profile_public.self_declared")
            }
            externalLink={model.externalUrl}
            onRequest={model.canRequest && !sent && requestIndex >= 0 ? () => flight.goTo(requestIndex) : null}
            backHref={backHref}
          />
        );
      }
    }
  };

  return (
    <EntryShell
      title={t("mentoring.profile_public.title")}
      loadingText={loading ? t("mentoring.labels.loading") : ""}
      error={loadError}
      retryText={t("mentoring.labels.retry")}
      onRetry={() => {
        setLoading(true);
        void load();
      }}
    >
      {unavailable ? (
        <div className={styles.fault}>
          <p className={styles.quiet}>{t("mentoring.profile_public.unavailable")}</p>
          <TextLink href={backHref}>{t("mentoring.labels.back_to_mentoring")}</TextLink>
        </div>
      ) : null}

      {!loading && !loadError && !unavailable && profile ? (
        <StepFlight
          label={t("mentoring.profile_public.title")}
          steps={parts}
          parts
          texts={{
            all: t("mentoring.profile_public.all_parts"),
            position: (current, total, label) => t("mentoring.labels.part_position", { current, total, label })
          }}
        >
          {renderView}
        </StepFlight>
      ) : null}
    </EntryShell>
  );
}
