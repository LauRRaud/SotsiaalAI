"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import Form from "@/components/ui/Form";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";
import styles from "./MentoringPage.module.css";

const ESTA_MENTORS_URL = "https://eswa.ee/arendus/mentorlus/";

function Section({ title, help, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2>{title}</h2>
        {help ? <p>{help}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function MentoringHomePage() {
  const { t, locale } = useI18n();
  const [overview, setOverview] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [filters, setFilters] = useState({ field: "", topic: "", language: "" });

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
      const [overviewResponse, catalogResponse] = await Promise.all([
        fetch("/api/mentoring/overview", { cache: "no-store", signal }),
        fetch("/api/mentoring/catalog", { cache: "no-store", signal })
      ]);
      const overviewPayload = await overviewResponse.json().catch(() => ({}));
      const catalogPayload = await catalogResponse.json().catch(() => ({}));
      if (!overviewResponse.ok || overviewPayload?.ok === false) {
        throw new Error(resolveApiMessage({
          payload: overviewPayload,
          t,
          fallbackKey: "mentoring.errors.load_failed"
        }));
      }
      setOverview(overviewPayload);
      setCatalog(catalogResponse.ok ? catalogPayload?.profiles || [] : []);
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

  const applyFilters = useCallback(async (event) => {
    event?.preventDefault?.();
    const params = new URLSearchParams();
    if (filters.field) params.set("field", filters.field);
    if (filters.topic) params.set("topic", filters.topic);
    if (filters.language) params.set("language", filters.language);
    try {
      const response = await fetch(`/api/mentoring/catalog?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.ok !== false) setCatalog(payload?.profiles || []);
    } catch {
      /* filtriviga ei asenda juba laetud kataloogi */
    }
  }, [filters]);

  const respond = useCallback(async (requestId, decision) => {
    setBusyKey(`respond:${requestId}`);
    setFeedback("");
    try {
      const response = await fetch(`/api/mentoring/requests/${encodeURIComponent(requestId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "respond", decision })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.save_failed" }));
      }
      setFeedback(decision === "ACCEPT"
        ? t("mentoring.home.request_accepted_feedback")
        : t("mentoring.home.request_declined_feedback"));
      await load();
    } catch (error) {
      setFeedback(error?.message || t("mentoring.errors.save_failed"));
    } finally {
      setBusyKey("");
    }
  }, [load, t]);

  const cancelRequest = useCallback(async (requestId) => {
    setBusyKey(`cancel:${requestId}`);
    setFeedback("");
    try {
      const response = await fetch(`/api/mentoring/requests/${encodeURIComponent(requestId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.save_failed" }));
      }
      setFeedback(t("mentoring.home.request_cancelled_feedback"));
      await load();
    } catch (error) {
      setFeedback(error?.message || t("mentoring.errors.save_failed"));
    } finally {
      setBusyKey("");
    }
  }, [load, t]);

  const relations = overview?.relations || [];
  const myRequests = overview?.myRequests || [];
  const incomingRequests = overview?.incomingRequests || [];
  const profile = overview?.profile || null;
  const openRelations = relations.filter((relation) => relation.status !== "CLOSED");
  const closedRelations = relations.filter((relation) => relation.status === "CLOSED");

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor="">
        <SubpageHeader title={t("mentoring.home.title")} />
        <p className={styles.lead}>{t("mentoring.home.lead")}</p>
        <p aria-live="polite" className={styles.liveRegion} role="status" tabIndex={-1}>
          {feedback}
        </p>

        {loading ? <p className={styles.loading}>{t("mentoring.labels.loading")}</p> : null}
        {loadError ? (
          <div className={styles.loadError}>
            <p>{loadError}</p>
            <Button variant="secondary" onClick={() => { setLoading(true); void load(); }}>
              {t("mentoring.labels.retry")}
            </Button>
          </div>
        ) : null}

        {!loading && !loadError ? (
          <>
            {!openRelations.length && !myRequests.length && !incomingRequests.length ? (
              <Section
                help={t("mentoring.home.empty_help")}
                title={t("mentoring.home.empty_title")}
              >
                <p className={styles.cardMeta}>{t("mentoring.home.boundary_note")}</p>
              </Section>
            ) : null}

            {openRelations.length ? (
              <Section title={t("mentoring.home.my_relations")}>
                <div className={styles.cards}>
                  {openRelations.map((relation) => (
                    <article key={relation.id} className={styles.card}>
                      <h3 className={styles.cardTitle}>
                        {relation.position === "mentor"
                          ? t("mentoring.home.relation_as_mentor", { name: relation.mentee?.name || t("mentoring.labels.deleted_user") })
                          : t("mentoring.home.relation_as_mentee", { name: relation.mentor?.name || t("mentoring.labels.deleted_user") })}
                      </h3>
                      <span className={styles.badge}>{t(`mentoring.relation_status.${relation.status.toLowerCase()}`)}</span>
                      <p className={styles.cardMeta}>
                        {t("mentoring.home.last_activity", { date: formatDate(relation.lastActivityAt) })}
                      </p>
                      <div className={styles.actions}>
                        <Button as="a" href={localizePath(`/mentorlus/suhe/${relation.id}`, locale)} size="sm" variant="secondary">
                          {t("mentoring.home.open_relation")}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </Section>
            ) : null}

            {incomingRequests.length ? (
              <Section
                help={t("mentoring.home.incoming_help")}
                title={t("mentoring.home.incoming_requests")}
              >
                <div className={styles.cards}>
                  {incomingRequests.map((request) => (
                    <article key={request.id} className={styles.card}>
                      <h3 className={styles.cardTitle}>{request.menteeName || t("mentoring.labels.deleted_user")}</h3>
                      {request.message ? <p className={styles.cardMeta}>{request.message}</p> : null}
                      <p className={styles.statusLine}>
                        {t("mentoring.home.request_expires", { date: formatDate(request.expiresAt) })}
                      </p>
                      <div className={styles.actions}>
                        <Button
                          disabled={busyKey === `respond:${request.id}`}
                          onClick={() => respond(request.id, "ACCEPT")}
                          size="sm"
                        >
                          {t("mentoring.home.accept")}
                        </Button>
                        <Button
                          disabled={busyKey === `respond:${request.id}`}
                          onClick={() => respond(request.id, "DECLINE")}
                          size="sm"
                          variant="secondary"
                        >
                          {t("mentoring.home.decline")}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </Section>
            ) : null}

            {myRequests.length ? (
              <Section title={t("mentoring.home.my_requests")}>
                <div className={styles.cards}>
                  {myRequests.map((request) => (
                    <article key={request.id} className={styles.card}>
                      <h3 className={styles.cardTitle}>{request.mentorDisplayName || t("mentoring.labels.deleted_user")}</h3>
                      <span className={styles.badge}>{t(`mentoring.request_status.${request.status.toLowerCase()}`)}</span>
                      {request.status === "PENDING" ? (
                        <p className={styles.statusLine}>
                          {t("mentoring.home.request_expires", { date: formatDate(request.expiresAt) })}
                        </p>
                      ) : null}
                      {request.canCancel ? (
                        <div className={styles.actions}>
                          <Button
                            disabled={busyKey === `cancel:${request.id}`}
                            onClick={() => cancelRequest(request.id)}
                            size="sm"
                            variant="secondary"
                          >
                            {t("mentoring.home.cancel_request")}
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </Section>
            ) : null}

            <Section
              help={t("mentoring.home.mentor_view_help")}
              title={t("mentoring.home.mentor_view")}
            >
              {profile ? (
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>{profile.displayName}</h3>
                  <span className={styles.badge}>{t(`mentoring.profile_status.${profile.status.toLowerCase()}`)}</span>
                  <p className={styles.cardMeta}>
                    {t(`mentoring.capacity.${(profile.capacity || "OPEN").toLowerCase()}`)}
                  </p>
                  <div className={styles.actions}>
                    <Button as="a" href={localizePath("/mentorlus/profiil", locale)} size="sm" variant="secondary">
                      {t("mentoring.home.manage_profile")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={styles.actions}>
                  <Button as="a" href={localizePath("/mentorlus/profiil", locale)} variant="secondary">
                    {t("mentoring.home.become_mentor")}
                  </Button>
                </div>
              )}
            </Section>

            <Section
              help={t("mentoring.home.catalog_help")}
              title={t("mentoring.home.catalog")}
            >
              <Form className={styles.filters} onSubmit={applyFilters}>
                <Input
                  aria-label={t("mentoring.home.filter_field")}
                  onChange={(event) => setFilters((prev) => ({ ...prev, field: event.target.value }))}
                  placeholder={t("mentoring.home.filter_field")}
                  value={filters.field}
                />
                <Input
                  aria-label={t("mentoring.home.filter_topic")}
                  onChange={(event) => setFilters((prev) => ({ ...prev, topic: event.target.value }))}
                  placeholder={t("mentoring.home.filter_topic")}
                  value={filters.topic}
                />
                <Input
                  aria-label={t("mentoring.home.filter_language")}
                  onChange={(event) => setFilters((prev) => ({ ...prev, language: event.target.value }))}
                  placeholder={t("mentoring.home.filter_language")}
                  value={filters.language}
                />
                <Button size="sm" type="submit" variant="secondary">
                  {t("mentoring.home.filter_apply")}
                </Button>
              </Form>
              {catalog.length ? (
                <div className={styles.cards}>
                  {catalog.map((mentor) => (
                    <article key={mentor.id} className={styles.card}>
                      <h3 className={styles.cardTitle}>{mentor.displayName}</h3>
                      {mentor.external ? (
                        <span className={`${styles.badge} ${styles.badgeExternal}`}>
                          {t("mentoring.home.external_badge", { date: formatDate(mentor.checkedAt) })}
                        </span>
                      ) : null}
                      {mentor.title || mentor.organization ? (
                        <p className={styles.cardMeta}>
                          {[mentor.title, mentor.organization].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      {mentor.bioShort ? <p className={styles.cardMeta}>{mentor.bioShort}</p> : null}
                      {mentor.fields?.length ? (
                        <div className={styles.tagRow}>
                          {mentor.fields.slice(0, 5).map((field) => (
                            <span key={field} className={styles.tag}>{field}</span>
                          ))}
                        </div>
                      ) : null}
                      <p className={styles.statusLine}>
                        {mentor.capacity === "FULL"
                          ? t("mentoring.home.capacity_full")
                          : t("mentoring.home.capacity_open")}
                      </p>
                      <div className={styles.actions}>
                        {mentor.external ? (
                          <Button
                            as="a"
                            href={mentor.externalProfileUrl || ESTA_MENTORS_URL}
                            rel="noopener noreferrer"
                            size="sm"
                            target="_blank"
                            variant="secondary"
                          >
                            {t("mentoring.home.view_external_profile")}
                          </Button>
                        ) : (
                          <Button as="a" href={localizePath(`/mentorlus/mentor/${mentor.id}`, locale)} size="sm" variant="secondary">
                            {t("mentoring.home.view_profile")}
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>{t("mentoring.home.catalog_empty")}</p>
              )}
              <div className={styles.externalLinkBlock}>
                <h3 className={styles.cardTitle}>{t("mentoring.home.esta_title")}</h3>
                <p className={styles.cardMeta}>{t("mentoring.home.esta_help")}</p>
                <p>
                  <a href={ESTA_MENTORS_URL} rel="noopener noreferrer" target="_blank">
                    {t("mentoring.home.esta_link")}
                  </a>
                </p>
              </div>
            </Section>

            {closedRelations.length ? (
              <Section title={t("mentoring.home.closed_relations")}>
                <div className={styles.cards}>
                  {closedRelations.map((relation) => (
                    <article key={relation.id} className={styles.card}>
                      <h3 className={styles.cardTitle}>
                        {relation.position === "mentor"
                          ? t("mentoring.home.relation_as_mentor", { name: relation.mentee?.name || t("mentoring.labels.deleted_user") })
                          : t("mentoring.home.relation_as_mentee", { name: relation.mentor?.name || t("mentoring.labels.deleted_user") })}
                      </h3>
                      <span className={styles.badge}>{t("mentoring.relation_status.closed")}</span>
                      <div className={styles.actions}>
                        <Button as="a" href={localizePath(`/mentorlus/suhe/${relation.id}`, locale)} size="sm" variant="secondary">
                          {t("mentoring.home.open_archive")}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </Section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
