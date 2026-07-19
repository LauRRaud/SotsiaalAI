"use client";

import { useCallback, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import styles from "./SupervisionPage.module.css";
import { isConflict, supervisionMessage, supervisionRequest } from "./supervisionClient";

const STATUS_KEYS = { PLANNED: "planned", HELD: "held", CANCELLED: "cancelled" };

/**
 * Vaade 6 „Kohtumised" (Q2.6). Kaardiloend, mitte tabel. HELD on LÕPLIK
 * (faktijälg) — seepärast küsib „Märgi toimunuks" enne kinnitust ja server
 * keeldub hiljem olekut tagasi pööramast (409).
 */
export default function MeetingsPanel({ process, onReload, onConflict }) {
  const { t, locale } = useI18n();
  const [plannedAt, setPlannedAt] = useState("");
  const [noteDraft, setNoteDraft] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const canPlan = Boolean(process.capabilities?.canPlanMeeting);
  const meetings = process.meetings || [];

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium", timeStyle: "short" }),
    [locale]
  );
  const formatDate = useCallback((value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? formatter.format(date) : "";
  }, [formatter]);

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

  const plan = useCallback(async (event) => {
    event?.preventDefault?.();
    const ok = await run(
      "plan",
      `/api/supervision/processes/${encodeURIComponent(process.id)}/meetings`,
      { plannedAt: plannedAt ? new Date(plannedAt).toISOString() : null }
    );
    if (ok) setPlannedAt("");
  }, [plannedAt, process.id, run]);

  const markHeld = useCallback((meeting) => {
    if (typeof window !== "undefined" && !window.confirm(t("supervision.meetings.heldConfirm"))) return;
    void run(
      `held:${meeting.id}`,
      `/api/supervision/meetings/${encodeURIComponent(meeting.id)}`,
      { status: "HELD", expectedVersion: meeting.version },
      "PATCH"
    );
  }, [run, t]);

  const saveNote = useCallback(async (meeting) => {
    if (!noteDraft || noteDraft.id !== meeting.id) return;
    const ok = await run(
      `note:${meeting.id}`,
      `/api/supervision/meetings/${encodeURIComponent(meeting.id)}`,
      { note: noteDraft.note.trim() || null, expectedVersion: meeting.version },
      "PATCH"
    );
    if (ok) setNoteDraft(null);
  }, [noteDraft, run]);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2>{t("supervision.meetings.title")}</h2>
      </div>

      <p aria-live="polite" className={styles.liveRegion} role="status" tabIndex={-1}>
        {message}
      </p>

      {!meetings.length ? <p className={styles.empty}>{t("supervision.meetings.empty")}</p> : null}

      {meetings.length ? (
        <div className={styles.itemList}>
          {meetings.map((meeting) => (
            <article key={meeting.id} className={styles.item}>
              <div className={styles.badgeRow}>
                <span className={styles.badge}>{t("supervision.meetings.meetingN", { n: meeting.seq })}</span>
                <span className={styles.badge}>{t(`supervision.meetings.${STATUS_KEYS[meeting.status]}`)}</span>
              </div>
              {meeting.plannedAt ? (
                <p className={styles.cardMeta}>
                  {t("supervision.meetings.plannedAt")}
                  {": "}
                  {formatDate(meeting.plannedAt)}
                </p>
              ) : null}
              {meeting.heldAt ? (
                <p className={styles.cardMeta}>
                  {t("supervision.meetings.held")}
                  {": "}
                  {formatDate(meeting.heldAt)}
                </p>
              ) : null}

              {noteDraft?.id === meeting.id ? (
                <div className={styles.form}>
                  <label>
                    {t("supervision.meetings.note")}
                    <textarea
                      maxLength={20000}
                      onChange={(event) => setNoteDraft((prev) => ({ ...prev, note: event.target.value }))}
                      value={noteDraft.note}
                    />
                  </label>
                  <div className={styles.actions}>
                    <Button disabled={busy === `note:${meeting.id}`} onClick={() => saveNote(meeting)} size="sm">
                      {t("supervision.common.save")}
                    </Button>
                    <Button onClick={() => setNoteDraft(null)} size="sm" variant="secondary">
                      {t("supervision.common.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {meeting.note ? <p className={styles.itemBody}>{meeting.note}</p> : null}
                  <div className={styles.actions}>
                    {canPlan ? (
                      <Button
                        onClick={() => setNoteDraft({ id: meeting.id, note: meeting.note || "" })}
                        size="sm"
                        variant="secondary"
                      >
                        {t("supervision.meetings.note")}
                      </Button>
                    ) : null}
                    {canPlan && meeting.status !== "HELD" ? (
                      <Button
                        disabled={busy === `held:${meeting.id}`}
                        onClick={() => markHeld(meeting)}
                        size="sm"
                      >
                        {t("supervision.meetings.markHeld")}
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      ) : null}

      {canPlan ? (
        <form className={styles.form} onSubmit={plan}>
          <label>
            {t("supervision.meetings.plannedAt")}
            <Input
              onChange={(event) => setPlannedAt(event.target.value)}
              type="datetime-local"
              value={plannedAt}
            />
          </label>
          <div className={styles.actions}>
            <Button disabled={busy === "plan"} type="submit">
              {t("supervision.meetings.plan")}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
