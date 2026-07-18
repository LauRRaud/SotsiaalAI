"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";
import styles from "./MentoringPage.module.css";

const CLOSE_REASONS = ["completed", "changed_mentor", "other"];

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

export default function MentoringRelationPage({ relationId }) {
  const { t, locale } = useI18n();
  const [relation, setRelation] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const [goalDraft, setGoalDraft] = useState("");
  const [agreementDraft, setAgreementDraft] = useState("");
  const [meetingForm, setMeetingForm] = useState({ occurredAt: "", mode: "EXTERNAL", topicSummary: "" });
  const [summaryDraft, setSummaryDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [handoffCandidates, setHandoffCandidates] = useState([]);
  const [closePreview, setClosePreview] = useState(null);
  const [closeReason, setCloseReason] = useState("completed");
  const [closeConfirmed, setCloseConfirmed] = useState(false);
  const [shareConfirmed, setShareConfirmed] = useState(false);

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium", timeStyle: "short" }),
    [locale]
  );
  const formatDate = useCallback((value) => {
    if (!value) return t("mentoring.labels.unknown_time");
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? formatter.format(date) : t("mentoring.labels.unknown_time");
  }, [formatter, t]);

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const response = await fetch(`/api/mentoring/relations/${encodeURIComponent(relationId)}`, {
        cache: "no-store",
        signal
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.load_failed" }));
      }
      const next = payload?.relation || null;
      setRelation(next);
      setGoalDraft(next?.goalSummary || "");
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(error?.message || t("mentoring.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [relationId, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (relation?.position !== "mentee" || !relation?.can?.handoffPreparation) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/mentoring/relations/${encodeURIComponent(relationId)}/preparation`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload?.ok !== false) setHandoffCandidates(payload?.candidates || []);
      } catch {
        /* valikute laadimise viga ei blokeeri suhtevaadet */
      }
    })();
    return () => controller.abort();
  }, [relation?.position, relation?.can?.handoffPreparation, relationId]);

  const call = useCallback(async (url, body, doneKey = null) => {
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

  const relationUrl = `/api/mentoring/relations/${encodeURIComponent(relationId)}`;

  const loadClosePreview = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch(relationUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close_preview" })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.ok !== false) setClosePreview(payload);
    } finally {
      setBusy(false);
    }
  }, [relationUrl]);

  if (notFound) {
    return (
      <main className={styles.page}>
        <div className={styles.shell} data-glass-back-anchor="">
          <SubpageHeader title={t("mentoring.relation.title")} />
          <div className={styles.empty}>
            <p>{t("mentoring.relation.not_found")}</p>
            <Button as="a" href={localizePath("/mentorlus")} variant="secondary">
              {t("mentoring.labels.back_to_mentoring")}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const closed = relation?.status === "CLOSED";
  const confirmedSummaries = (relation?.summaries || []).filter((summary) => summary.status === "CONFIRMED");
  const workingSummaries = (relation?.summaries || []).filter(
    (summary) => summary.status === "DRAFT" || summary.status === "PENDING_CONFIRM"
  );
  const otherName = relation?.position === "mentor"
    ? relation?.mentee?.name || (relation?.mentee?.deleted ? t("mentoring.labels.deleted_user") : "")
    : relation?.mentor?.name || (relation?.mentor?.deleted ? t("mentoring.labels.deleted_user") : "");

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor="">
        <SubpageHeader title={t("mentoring.relation.title")} />
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

        {relation ? (
          <>
            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <h2>
                  {relation.position === "mentor"
                    ? t("mentoring.home.relation_as_mentor", { name: otherName || t("mentoring.labels.deleted_user") })
                    : t("mentoring.home.relation_as_mentee", { name: otherName || t("mentoring.labels.deleted_user") })}
                </h2>
              </div>
              <p className={styles.statusLine}>
                <span className={styles.badge}>{t(`mentoring.relation_status.${relation.status.toLowerCase()}`)}</span>
                {closed && relation.closeReasonKey ? (
                  <span> {t(`mentoring.close_reason.${relation.closeReasonKey}`)}</span>
                ) : null}
              </p>
              <p className={styles.statusLine}>
                {t("mentoring.relation.progress_line", {
                  meetings: (relation.meetings || []).filter((meeting) => meeting.status === "HELD").length,
                  summaries: confirmedSummaries.length,
                  date: formatDate(relation.lastActivityAt)
                })}
              </p>
              {relation.status === "DRAFT" ? (
                <p className={styles.statusLine}>{t("mentoring.relation.draft_hint")}</p>
              ) : null}
            </section>

            {!closed ? (
              <Section help={t("mentoring.relation.goal_help")} title={t("mentoring.relation.goal_title")}>
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void call(relationUrl, {
                      action: "goal",
                      goalSummary: goalDraft,
                      expectedVersion: relation.version
                    }, "mentoring.relation.goal_saved");
                  }}
                >
                  <label>
                    <span>{t("mentoring.relation.goal_label")}</span>
                    <Textarea
                      disabled={!relation.can.editShared || busy}
                      maxLength={4000}
                      onChange={(event) => setGoalDraft(event.target.value)}
                      rows={3}
                      value={goalDraft}
                    />
                    <span className={styles.fieldHint}>{t("mentoring.relation.no_client_data")}</span>
                  </label>
                  <div className={styles.actions}>
                    <Button disabled={!relation.can.editShared || busy} size="sm" type="submit" variant="secondary">
                      {t("mentoring.relation.goal_save")}
                    </Button>
                  </div>
                </form>
              </Section>
            ) : null}

            <Section
              help={closed ? null : t("mentoring.relation.agreement_help")}
              title={t("mentoring.relation.agreement_title")}
            >
              {relation.agreementText ? (
                <div className={styles.card}>
                  <p className={styles.noteText}>{relation.agreementText}</p>
                  <p className={styles.statusLine}>
                    {t("mentoring.relation.agreement_version", { version: relation.agreementVersion })}
                    {" · "}
                    {relation.myAgreementAccepted
                      ? t("mentoring.relation.agreement_accepted_me")
                      : t("mentoring.relation.agreement_pending_me")}
                    {" · "}
                    {relation.otherAgreementAccepted
                      ? t("mentoring.relation.agreement_accepted_other")
                      : t("mentoring.relation.agreement_pending_other")}
                  </p>
                  {relation.can.acceptAgreement ? (
                    <div className={styles.actions}>
                      <Button
                        disabled={busy}
                        onClick={() => call(`${relationUrl}/agreement`, {
                          action: "accept",
                          agreementVersion: relation.agreementVersion
                        }, "mentoring.relation.agreement_accepted_feedback")}
                        size="sm"
                      >
                        {t("mentoring.relation.agreement_accept")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                !closed ? <p className={styles.empty}>{t("mentoring.relation.agreement_empty")}</p> : null
              )}
              {relation.can.proposeAgreement ? (
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void call(`${relationUrl}/agreement`, {
                      action: "propose",
                      agreementText: agreementDraft,
                      expectedVersion: relation.version
                    }, "mentoring.relation.agreement_proposed_feedback").then((ok) => {
                      if (ok) setAgreementDraft("");
                    });
                  }}
                >
                  <label>
                    <span>{t("mentoring.relation.agreement_new")}</span>
                    <Textarea
                      maxLength={4000}
                      onChange={(event) => setAgreementDraft(event.target.value)}
                      rows={5}
                      value={agreementDraft}
                    />
                    <span className={styles.fieldHint}>{t("mentoring.relation.agreement_hint")}</span>
                  </label>
                  <div className={styles.actions}>
                    <Button disabled={busy || !agreementDraft.trim()} size="sm" type="submit" variant="secondary">
                      {t("mentoring.relation.agreement_propose")}
                    </Button>
                  </div>
                </form>
              ) : null}
            </Section>

            <Section
              help={closed ? null : t("mentoring.relation.meetings_help")}
              title={t("mentoring.relation.meetings_title")}
            >
              {(relation.meetings || []).length ? (
                <div className={styles.timeline}>
                  {relation.meetings.map((meeting) => (
                    <div key={meeting.id} className={styles.noteItem}>
                      <p className={styles.noteText}>
                        {formatDate(meeting.occurredAt)}
                        {" · "}
                        {t(`mentoring.meeting_mode.${meeting.mode.toLowerCase()}`)}
                        {meeting.topicSummary ? ` · ${meeting.topicSummary}` : ""}
                      </p>
                      <p className={styles.statusLine}>
                        <span className={styles.badge}>{t(`mentoring.meeting_status.${meeting.status.toLowerCase()}`)}</span>
                        {meeting.roomId ? (
                          <Button
                            as="a"
                            href={localizePath(`/vestlus?roomId=${encodeURIComponent(meeting.roomId)}`)}
                            size="sm"
                            variant="ghost"
                          >
                            {t("mentoring.relation.open_room")}
                          </Button>
                        ) : null}
                      </p>
                      {!closed && meeting.status === "PLANNED" ? (
                        <div className={styles.actions}>
                          <Button
                            disabled={busy}
                            onClick={() => call(`${relationUrl}/meetings/${encodeURIComponent(meeting.id)}`, {
                              action: "held",
                              expectedVersion: meeting.version
                            }, "mentoring.relation.meeting_held_feedback")}
                            size="sm"
                            variant="secondary"
                          >
                            {t("mentoring.relation.meeting_mark_held")}
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() => call(`${relationUrl}/meetings/${encodeURIComponent(meeting.id)}`, {
                              action: "cancel",
                              expectedVersion: meeting.version
                            }, "mentoring.relation.meeting_cancelled_feedback")}
                            size="sm"
                            variant="secondary"
                          >
                            {t("mentoring.relation.meeting_cancel")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>{t("mentoring.relation.meetings_empty")}</p>
              )}
              {relation.can.createMeeting ? (
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void call(`${relationUrl}/meetings`, {
                      occurredAt: meetingForm.occurredAt,
                      mode: meetingForm.mode,
                      topicSummary: meetingForm.topicSummary
                    }, "mentoring.relation.meeting_created_feedback").then((ok) => {
                      if (ok) setMeetingForm({ occurredAt: "", mode: "EXTERNAL", topicSummary: "" });
                    });
                  }}
                >
                  <label>
                    <span>{t("mentoring.relation.meeting_time")}</span>
                    <Input
                      onChange={(event) => setMeetingForm((prev) => ({ ...prev, occurredAt: event.target.value }))}
                      required
                      type="datetime-local"
                      value={meetingForm.occurredAt}
                    />
                  </label>
                  <label>
                    <span>{t("mentoring.relation.meeting_mode")}</span>
                    <select
                      onChange={(event) => setMeetingForm((prev) => ({ ...prev, mode: event.target.value }))}
                      value={meetingForm.mode}
                    >
                      <option value="EXTERNAL">{t("mentoring.meeting_mode.external")}</option>
                      <option value="PLATFORM_ROOM">{t("mentoring.meeting_mode.platform_room")}</option>
                    </select>
                    <span className={styles.fieldHint}>{t("mentoring.relation.meeting_mode_hint")}</span>
                  </label>
                  <label>
                    <span>{t("mentoring.relation.meeting_topic")}</span>
                    <Input
                      maxLength={4000}
                      onChange={(event) => setMeetingForm((prev) => ({ ...prev, topicSummary: event.target.value }))}
                      value={meetingForm.topicSummary}
                    />
                  </label>
                  <div className={styles.actions}>
                    <Button disabled={busy || !meetingForm.occurredAt} size="sm" type="submit" variant="secondary">
                      {t("mentoring.relation.meeting_create")}
                    </Button>
                  </div>
                </form>
              ) : null}
            </Section>

            <Section
              help={closed ? t("mentoring.relation.summaries_closed_help") : t("mentoring.relation.summaries_help")}
              title={t("mentoring.relation.summaries_title")}
            >
              {confirmedSummaries.length || workingSummaries.length ? (
                <div className={styles.timeline}>
                  {[...workingSummaries, ...confirmedSummaries].map((summary) => (
                    <div key={summary.id} className={styles.noteItem}>
                      <p className={styles.noteText}>{summary.content}</p>
                      <p className={styles.statusLine}>
                        <span className={styles.badge}>{t(`mentoring.summary_status.${summary.status.toLowerCase()}`)}</span>
                        {summary.supersededById ? <span> {t("mentoring.relation.summary_superseded")}</span> : null}
                        {summary.confirmedAt ? <span> {formatDate(summary.confirmedAt)}</span> : null}
                      </p>
                      {!closed ? (
                        <div className={styles.actions}>
                          {summary.status === "DRAFT" && summary.createdByMe ? (
                            <Button
                              disabled={busy}
                              onClick={() => call(`${relationUrl}/summaries/${encodeURIComponent(summary.id)}`, {
                                action: "submit",
                                expectedVersion: summary.version
                              }, "mentoring.relation.summary_submitted_feedback")}
                              size="sm"
                              variant="secondary"
                            >
                              {t("mentoring.relation.summary_submit")}
                            </Button>
                          ) : null}
                          {summary.status === "PENDING_CONFIRM" && !summary.myConfirmation ? (
                            <Button
                              disabled={busy}
                              onClick={() => call(`${relationUrl}/summaries/${encodeURIComponent(summary.id)}`, {
                                action: "confirm"
                              }, "mentoring.relation.summary_confirmed_feedback")}
                              size="sm"
                            >
                              {t("mentoring.relation.summary_confirm")}
                            </Button>
                          ) : null}
                          {summary.status === "PENDING_CONFIRM" && summary.myConfirmation ? (
                            <span className={styles.statusLine}>{t("mentoring.relation.summary_waiting_other")}</span>
                          ) : null}
                          {(summary.status === "DRAFT" || summary.status === "PENDING_CONFIRM") ? (
                            <Button
                              disabled={busy}
                              onClick={() => call(`${relationUrl}/summaries/${encodeURIComponent(summary.id)}`, {
                                action: "discard"
                              }, "mentoring.relation.summary_discarded_feedback")}
                              size="sm"
                              variant="secondary"
                            >
                              {t("mentoring.relation.summary_discard")}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>{t("mentoring.relation.summaries_empty")}</p>
              )}
              {relation.can.createSummary ? (
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void call(`${relationUrl}/summaries`, { content: summaryDraft }, "mentoring.relation.summary_created_feedback")
                      .then((ok) => { if (ok) setSummaryDraft(""); });
                  }}
                >
                  <label>
                    <span>{t("mentoring.relation.summary_new")}</span>
                    <Textarea
                      maxLength={4000}
                      onChange={(event) => setSummaryDraft(event.target.value)}
                      rows={4}
                      value={summaryDraft}
                    />
                  </label>
                  <div className={styles.actions}>
                    <Button disabled={busy || !summaryDraft.trim()} size="sm" type="submit" variant="secondary">
                      {t("mentoring.relation.summary_create")}
                    </Button>
                  </div>
                </form>
              ) : null}
            </Section>

            {(relation.preparations || []).length || relation.can.handoffPreparation ? (
              <Section
                help={relation.position === "mentee"
                  ? t("mentoring.relation.preparation_help_mentee")
                  : t("mentoring.relation.preparation_help_mentor")}
                title={t("mentoring.relation.preparation_title")}
              >
                {(relation.preparations || []).filter(Boolean).map((preparation) => (
                  <div key={preparation.id} className={styles.noteItem}>
                    {preparation.own ? (
                      <>
                        <p className={styles.noteText}>{preparation.content}</p>
                        <p className={styles.statusLine}>
                          {preparation.sharedAt && !preparation.recalledAt
                            ? (preparation.openedAt
                              ? t("mentoring.relation.preparation_opened", { date: formatDate(preparation.openedAt) })
                              : t("mentoring.relation.preparation_shared", { date: formatDate(preparation.sharedAt) }))
                            : t("mentoring.relation.preparation_private")}
                        </p>
                        <div className={styles.actions}>
                          {preparation.canShare ? (
                            <>
                              <label className={styles.inlineForm}>
                                <Checkbox
                                  checked={shareConfirmed}
                                  onChange={(event) => setShareConfirmed(event.target.checked)}
                                />
                                <span className={styles.fieldHint}>{t("mentoring.relation.preparation_confirm_no_clients")}</span>
                              </label>
                              <Button
                                disabled={busy || !shareConfirmed}
                                onClick={() => call(`${relationUrl}/preparation`, {
                                  action: "share",
                                  noteId: preparation.id,
                                  confirmedNoClientData: shareConfirmed
                                }, "mentoring.relation.preparation_shared_feedback")}
                                size="sm"
                                variant="secondary"
                              >
                                {t("mentoring.relation.preparation_share")}
                              </Button>
                            </>
                          ) : null}
                          {preparation.canRecall ? (
                            <Button
                              disabled={busy}
                              onClick={() => call(`${relationUrl}/preparation`, {
                                action: "recall",
                                noteId: preparation.id
                              }, "mentoring.relation.preparation_recalled_feedback")}
                              size="sm"
                              variant="secondary"
                            >
                              {t("mentoring.relation.preparation_recall")}
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className={styles.noteText}>{preparation.sharedContent}</p>
                        <p className={styles.statusLine}>
                          {preparation.openedAt
                            ? t("mentoring.relation.preparation_opened", { date: formatDate(preparation.openedAt) })
                            : t("mentoring.relation.preparation_new_from_mentee")}
                        </p>
                        {!preparation.openedAt && relation.position === "mentor" ? (
                          <div className={styles.actions}>
                            <Button
                              disabled={busy}
                              onClick={() => call(`${relationUrl}/preparation`, {
                                action: "open",
                                noteId: preparation.id
                              }, "mentoring.relation.preparation_open_feedback")}
                              size="sm"
                              variant="secondary"
                            >
                              {t("mentoring.relation.preparation_mark_opened")}
                            </Button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ))}
                {relation.can.handoffPreparation && handoffCandidates.length ? (
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle}>{t("mentoring.relation.handoff_title")}</h3>
                    <p className={styles.cardMeta}>{t("mentoring.relation.handoff_help")}</p>
                    {handoffCandidates.map((candidate) => (
                      <div key={candidate.id} className={styles.noteItem}>
                        <p className={styles.noteText}>{candidate.preview}</p>
                        <div className={styles.actions}>
                          <Button
                            disabled={busy}
                            onClick={() => call(`${relationUrl}/preparation`, {
                              action: "handoff",
                              draftId: candidate.id,
                              expectedUpdatedAt: candidate.updatedAt
                            }, "mentoring.relation.handoff_done_feedback").then(() => {
                              setHandoffCandidates((prev) => prev.filter((item) => item.id !== candidate.id));
                            })}
                            size="sm"
                            variant="secondary"
                          >
                            {t("mentoring.relation.handoff_action")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {relation.position === "mentee" && relation.can.handoffPreparation && !handoffCandidates.length && !(relation.preparations || []).length ? (
                  <p className={styles.empty}>{t("mentoring.relation.handoff_empty")}</p>
                ) : null}
              </Section>
            ) : null}

            <Section title={t("mentoring.relation.notes_title")}>
              <div className={styles.privatePanel}>
                <span className={styles.privateBadge}>{t("mentoring.relation.notes_private_badge")}</span>
                {(relation.notes || []).length ? (
                  relation.notes.map((note) => (
                    <div key={note.id} className={styles.noteItem}>
                      <p className={styles.noteText}>{note.content}</p>
                      <p className={styles.statusLine}>{formatDate(note.updatedAt)}</p>
                    </div>
                  ))
                ) : (
                  <p className={styles.empty}>{t("mentoring.relation.notes_empty")}</p>
                )}
                {relation.can.addNote ? (
                  <form
                    className={styles.form}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void call(`${relationUrl}/notes`, { content: noteDraft }, "mentoring.relation.note_added_feedback")
                        .then((ok) => { if (ok) setNoteDraft(""); });
                    }}
                  >
                    <label>
                      <span>{t("mentoring.relation.note_new")}</span>
                      <Textarea
                        maxLength={4000}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        rows={3}
                        value={noteDraft}
                      />
                    </label>
                    <div className={styles.actions}>
                      <Button disabled={busy || !noteDraft.trim()} size="sm" type="submit" variant="secondary">
                        {t("mentoring.relation.note_add")}
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            </Section>

            {!closed ? (
              <div className={styles.dangerZone}>
                <div className={styles.sectionHeading}>
                  <h2>{t("mentoring.relation.lifecycle_title")}</h2>
                </div>
                <div className={styles.actions}>
                  {relation.can.pause ? (
                    <Button
                      disabled={busy}
                      onClick={() => call(relationUrl, { action: "pause" }, "mentoring.relation.paused_feedback")}
                      variant="secondary"
                    >
                      {t("mentoring.relation.pause")}
                    </Button>
                  ) : null}
                  {relation.can.resume ? (
                    <Button
                      disabled={busy}
                      onClick={() => call(relationUrl, { action: "resume" }, "mentoring.relation.resumed_feedback")}
                      variant="secondary"
                    >
                      {t("mentoring.relation.resume")}
                    </Button>
                  ) : null}
                  <Button
                    disabled={busy}
                    onClick={() => call(relationUrl, { action: "alive" }, "mentoring.relation.alive_feedback")}
                    variant="secondary"
                  >
                    {t("mentoring.relation.mark_alive")}
                  </Button>
                  {!closePreview ? (
                    <Button disabled={busy} onClick={loadClosePreview} variant="secondary">
                      {t("mentoring.relation.close_start")}
                    </Button>
                  ) : null}
                </div>

                {closePreview ? (
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle}>{t("mentoring.relation.close_gate_title")}</h3>
                    <div className={styles.keepPurgeGrid}>
                      <div>
                        <strong>{t("mentoring.relation.close_keeps")}</strong>
                        <ul className={styles.keepList}>
                          <li>{t("mentoring.relation.close_keep_summaries", { count: closePreview.keeps?.confirmedSummaries ?? 0 })}</li>
                          <li>{t("mentoring.relation.close_keep_meetings", { count: closePreview.keeps?.meetingFacts ?? 0 })}</li>
                          <li>{t("mentoring.relation.close_keep_agreements")}</li>
                          <li>{t("mentoring.relation.close_keep_notes", { count: closePreview.keeps?.myPrivateNotes ?? 0 })}</li>
                        </ul>
                      </div>
                      <div>
                        <strong>{t("mentoring.relation.close_purges")}</strong>
                        <ul className={styles.purgeList}>
                          <li>{t("mentoring.relation.close_purge_drafts", { count: closePreview.purges?.unconfirmedSummaries ?? 0 })}</li>
                          <li>{t("mentoring.relation.close_purge_goal")}</li>
                          <li>{t("mentoring.relation.close_purge_topics")}</li>
                        </ul>
                      </div>
                    </div>
                    <label>
                      <span>{t("mentoring.relation.close_reason")}</span>
                      <select onChange={(event) => setCloseReason(event.target.value)} value={closeReason}>
                        {CLOSE_REASONS.map((reason) => (
                          <option key={reason} value={reason}>{t(`mentoring.close_reason.${reason}`)}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.inlineForm}>
                      <Checkbox
                        checked={closeConfirmed}
                        onChange={(event) => setCloseConfirmed(event.target.checked)}
                      />
                      <span>{t("mentoring.relation.close_confirm_label")}</span>
                    </label>
                    <div className={styles.actions}>
                      <Button
                        disabled={busy || !closeConfirmed}
                        onClick={() => call(relationUrl, {
                          action: "close",
                          reasonKey: closeReason,
                          confirmed: closeConfirmed
                        }, "mentoring.relation.closed_feedback")}
                      >
                        {t("mentoring.relation.close_confirm_action")}
                      </Button>
                      <Button disabled={busy} onClick={() => setClosePreview(null)} variant="secondary">
                        {t("mentoring.labels.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {relation.position === "mentee" ? (
                  <p className={styles.fieldHint}>{t("mentoring.relation.change_mentor_hint")}</p>
                ) : null}
              </div>
            ) : (
              <Section title={t("mentoring.relation.after_view_title")}>
                <p className={styles.cardMeta}>
                  {t("mentoring.relation.after_view_help", {
                    date: formatDate(relation.closedAt),
                    by: relation.closedByMe ? t("mentoring.relation.closed_by_me") : otherName || t("mentoring.labels.deleted_user")
                  })}
                </p>
              </Section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
