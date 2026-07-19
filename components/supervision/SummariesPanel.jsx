"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import PrivacyBadge from "./PrivacyBadge";
import styles from "./SupervisionPage.module.css";
import { isConflict, supervisionMessage, supervisionRequest } from "./supervisionClient";

/**
 * Vaade 7 „Kokkuvõte ja kinnitamine" (Q2.6). Lugemisvaade ees, kinnitus lõpus.
 * DRAFT näeb AINULT superviisor (server ei serialiseeri seda teistele) —
 * märgis ütleb seda ka nähtavalt. PENDING kannab „ootab N/M kinnitust";
 * kui server on vahepeal APPROVED-i jõudnud, sulandub 409 lihtsalt värskeks
 * olekuks, mitte veaks.
 */
export default function SummariesPanel({ process, onReload, onConflict, participantCount, selectedSummaryId }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState({ kind: "FINAL", meetingId: "", body: "" });
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const selectedRef = useRef(null);

  const canCreate = Boolean(process.capabilities?.canCreateSummary);
  const canApprove = Boolean(process.capabilities?.canApproveSummary);
  const summaries = process.summaries || [];

  // `?summary=` on otselingitav olek (U2 „Jätka siit") — too see vaatevälja.
  useEffect(() => {
    if (selectedSummaryId && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [selectedSummaryId]);

  const run = useCallback(async (key, url, body, method = "POST") => {
    setBusy(key);
    setMessage("");
    try {
      const { ok, status, payload } = await supervisionRequest(url, { method, body });
      if (!ok) {
        if (isConflict(status)) {
          await onConflict?.();
          return false;
        }
        setMessage(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
        return false;
      }
      await onReload?.();
      return true;
    } catch {
      setMessage(t("supervision.errors.save_failed"));
      return false;
    } finally {
      setBusy("");
    }
  }, [onConflict, onReload, t]);

  const create = useCallback(async (event) => {
    event?.preventDefault?.();
    const body = draft.body.trim();
    if (!body) return;
    const ok = await run(
      "create",
      `/api/supervision/processes/${encodeURIComponent(process.id)}/summaries`,
      draft.kind === "MEETING"
        ? { kind: "MEETING", meetingId: draft.meetingId, body }
        : { kind: "FINAL", body }
    );
    if (ok) setDraft({ kind: "FINAL", meetingId: "", body: "" });
  }, [draft, process.id, run]);

  const saveDraft = useCallback(async (summary) => {
    if (!editing || editing.id !== summary.id) return;
    const ok = await run(
      `save:${summary.id}`,
      `/api/supervision/summaries/${encodeURIComponent(summary.id)}`,
      { body: editing.body.trim(), expectedVersion: summary.version },
      "PATCH"
    );
    if (ok) setEditing(null);
  }, [editing, run]);

  const submit = useCallback((summary) => run(
    `submit:${summary.id}`,
    `/api/supervision/summaries/${encodeURIComponent(summary.id)}/submit`,
    { expectedVersion: summary.version }
  ), [run]);

  const approve = useCallback((summary) => run(
    `approve:${summary.id}`,
    `/api/supervision/summaries/${encodeURIComponent(summary.id)}/approve`,
    undefined
  ), [run]);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2>{t("supervision.summaries.title")}</h2>
      </div>

      <p aria-live="polite" className={styles.liveRegion} role="status" tabIndex={-1}>
        {message}
      </p>

      {!summaries.length ? <p className={styles.empty}>{t("supervision.summaries.empty")}</p> : null}

      {summaries.length ? (
        <div className={styles.itemList}>
          {summaries.map((summary) => (
            <article
              key={summary.id}
              ref={summary.id === selectedSummaryId ? selectedRef : null}
              className={styles.item}
            >
              <div className={styles.badgeRow}>
                <span className={styles.badge}>
                  {t(`supervision.summaries.${summary.kind === "FINAL" ? "final" : "meeting"}`)}
                </span>
                <span className={styles.badge}>{summary.status}</span>
              </div>

              {summary.status === "DRAFT" ? (
                <span className={`${styles.privacy} ${styles.privacyPrivate}`} data-privacy="draft">
                  {t("supervision.summaries.draftOnlyYou")}
                </span>
              ) : null}
              {summary.status === "PENDING_APPROVAL" ? (
                <p className={styles.statusLine}>
                  {t("supervision.summaries.waitingApprovals", {
                    done: summary.approvals?.length || 0,
                    total: participantCount
                  })}
                </p>
              ) : null}
              {summary.status === "APPROVED" ? <PrivacyBadge scope="persistent" /> : null}

              {editing?.id === summary.id ? (
                <div className={styles.form}>
                  <label>
                    {t("supervision.summaries.bodyLabel")}
                    <textarea
                      maxLength={50000}
                      onChange={(event) => setEditing((prev) => ({ ...prev, body: event.target.value }))}
                      value={editing.body}
                    />
                  </label>
                  <div className={styles.actions}>
                    <Button disabled={busy === `save:${summary.id}`} onClick={() => saveDraft(summary)} size="sm">
                      {t("supervision.common.save")}
                    </Button>
                    <Button onClick={() => setEditing(null)} size="sm" variant="secondary">
                      {t("supervision.common.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={styles.itemBody}>{summary.body}</p>
                  <div className={styles.actions}>
                    {canCreate && summary.status === "DRAFT" ? (
                      <Button
                        onClick={() => setEditing({ id: summary.id, body: summary.body })}
                        size="sm"
                        variant="secondary"
                      >
                        {t("supervision.common.edit")}
                      </Button>
                    ) : null}
                    {canCreate && summary.status === "DRAFT" ? (
                      <Button disabled={busy === `submit:${summary.id}`} onClick={() => submit(summary)} size="sm">
                        {t("supervision.summaries.submit")}
                      </Button>
                    ) : null}
                    {canApprove && summary.status === "PENDING_APPROVAL" ? (
                      <Button disabled={busy === `approve:${summary.id}`} onClick={() => approve(summary)} size="sm">
                        {t("supervision.summaries.approve")}
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      ) : null}

      {canCreate ? (
        <form className={styles.form} onSubmit={create}>
          <div className={styles.sectionHeading}>
            <h3>{t(`supervision.summaries.${draft.kind === "FINAL" ? "newFinal" : "meeting"}`)}</h3>
          </div>
          <label>
            {t("supervision.summaries.title")}
            <select
              onChange={(event) => setDraft((prev) => ({ ...prev, kind: event.target.value }))}
              value={draft.kind}
            >
              <option value="FINAL">{t("supervision.summaries.final")}</option>
              <option value="MEETING">{t("supervision.summaries.meeting")}</option>
            </select>
          </label>
          {draft.kind === "MEETING" ? (
            <label>
              {t("supervision.meetings.title")}
              <select
                onChange={(event) => setDraft((prev) => ({ ...prev, meetingId: event.target.value }))}
                value={draft.meetingId}
              >
                <option value="">{""}</option>
                {(process.meetings || []).map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {t("supervision.meetings.meetingN", { n: meeting.seq })}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            {t("supervision.summaries.bodyLabel")}
            <textarea
              maxLength={50000}
              onChange={(event) => setDraft((prev) => ({ ...prev, body: event.target.value }))}
              value={draft.body}
            />
          </label>
          <div className={styles.actions}>
            <Button
              disabled={busy === "create" || !draft.body.trim() || (draft.kind === "MEETING" && !draft.meetingId)}
              type="submit"
            >
              {t("supervision.common.save")}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
