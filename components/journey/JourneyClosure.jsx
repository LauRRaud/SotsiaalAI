"use client";

import { useEffect, useRef, useState } from "react";

import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import { JOURNEY_ASSESSMENT_LEVELS } from "@/lib/journey/assessmentRules";
import { JOURNEY_CLOSURE_LIMITS, JOURNEY_CLOSURE_OUTCOMES, JourneyClosureKind } from "@/lib/journey/closureRules";
import { journeyErrorText } from "@/lib/journey/errorText";
import { todayInEstonia } from "@/lib/journey/stepRules";

import { Cells, LineField, SMALL, blockRepeatEnter, footNote, ignoreKeyRepeat, useStageRemeasure, useSwapFocus } from "./detail/DeskBits";
import styles from "./detail/detail.module.css";
import { pressTooSoon } from "./detail/journeyDesk";
import shared from "./journey.module.css";

/** ISO hetk → `15.10.2026` Eesti kalendripäevana. Käsitsi, et server ja brauser annaksid sama kuju. */
function dayLabel(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const [year, month, day] = todayInEstonia(date).split("-");
  return `${day}.${month}.${year}`;
}

/** Kalendripäev `2026-10-15` → `15.10.2026`. */
function plainDayLabel(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""));
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

/**
 * Paus ja lõpetamine.
 *
 * Paus on „praegu ma sellega ei tegele"; lõpetamine on „see on minu jaoks läbi" koos
 * inimese enda sõnaga, kuidas see lõppes. Mõlemal juhul jääb kõik alles ja Teekonna
 * saab uuesti avada. Uuesti avamise teeb lehe enda käsitleja (`onReopen`).
 *
 * KUJU (10.10). Laua osa, mille sees vahetuvad vaated kohapeal: valik (paus või
 * lõpetamine kahe kaardina), pausi vorm, lõpetamise vorm kahes osas (kuidas
 * lõppes; lisa) ja varasemad pausid. Kõrvale pandud Teekonnal on siin selle seis
 * ja tee tagasi.
 *
 * `desk`: { glow, setDirty(dirty) } lavalt ja lehelt. `reopenError`: lehe päringu viga.
 */
export default function JourneyClosure({ journey, busy: pageBusy = false, reopenError = "", onClosed, onReopen, t, desk = {} }) {
  const journeyId = journey?.id || "";
  const archived = journey?.status === "ARCHIVED";
  const current = journey?.closure?.current || null;
  const history = Array.isArray(journey?.closure?.history) ? journey.closure.history : [];

  const [mode, setMode] = useState("");
  const [note, setNote] = useState("");
  const [resumeOn, setResumeOn] = useState("");
  const [outcome, setOutcome] = useState("");
  const [level, setLevel] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [finishPart, setFinishPart] = useState("outcome");
  const [showHistory, setShowHistory] = useState(false);
  const sendingRef = useRef(false);
  const shownAt = useRef(0);
  const busy = pageBusy || sending;

  const outcomeWord = (value) => t(`journey.closure.outcomes.${value}`, "");
  const failed = () => t("journey.closure.failed", "Salvestamine ei õnnestunud. Proovi uuesti.");

  const reset = () => {
    setMode("");
    setNote("");
    setResumeOn("");
    setOutcome("");
    setLevel("");
    setError("");
    setFinishPart("outcome");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (sendingRef.current || pressTooSoon(shownAt.current)) return;
    if (!mode) return;
    if (mode === JourneyClosureKind.FINISHED && !outcome) {
      setError(t("journey.desk.closure.need_outcome"));
      setFinishPart("outcome");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(journeyId)}/closure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          kind: mode,
          note,
          ...(mode === JourneyClosureKind.PAUSED ? { resumeOn: resumeOn || null } : { outcome, level: level ? Number(level) : null }),
          expectedUpdatedAt: journey.updatedAt
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setError(journeyErrorText(t, payload.message, failed()));
        return;
      }
      reset();
      onClosed(payload.journey, mode);
    } catch {
      setError(failed());
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const view = archived ? (showHistory && history.length ? "history" : "closed") : showHistory && history.length ? "history" : mode === JourneyClosureKind.PAUSED ? "pause" : mode === JourneyClosureKind.FINISHED ? "finish" : "choose";
  const dirty = !archived && Boolean(mode) && Boolean(note.trim() || resumeOn || outcome || level);
  const setDirty = desk.setDirty;
  useEffect(() => {
    setDirty?.(dirty);
    return () => setDirty?.(false);
  }, [dirty, setDirty]);

  useStageRemeasure(`${view}:${finishPart}:${outcome}:${error}:${reopenError}`);
  const rootRef = useSwapFocus(view);
  useEffect(() => {
    shownAt.current = Date.now();
  }, [view]);

  const title = t("journey.closure.title", "Paus ja lõpetamine");
  const errorNote = error ? { text: error, tone: "risk" } : null;
  const glow = desk.glow !== false;
  const historyButton = history.length ? (
    <Button {...SMALL} onClick={() => setShowHistory(true)}>
      {t("journey.closure.history_title", { count: history.length }, "Varasemad pausid ja lõpetamised ({count})")}
    </Button>
  ) : null;

  let body;
  if (view === "history") {
    body = (
      <StepPanel
        title={title}
        question={t("journey.desk.closure.history_question")}
        actions={
          <Button {...SMALL} onClick={() => setShowHistory(false)}>
            {t("journey.desk.back")}
          </Button>
        }
      >
        <ul className={shared.rows}>
          {history.map((item) => (
            <li key={item.id} className={shared.rowItem}>
              <span className={styles.plainRow}>
                <span className={shared.rowTitle}>
                  {item.kind === JourneyClosureKind.FINISHED
                    ? t("journey.closure.history_finished", { from: dayLabel(item.closedAt), to: dayLabel(item.reopenedAt), outcome: outcomeWord(item.outcome) }, "{from} kuni {to}: lõpetatud, {outcome}")
                    : t("journey.closure.history_paused", { from: dayLabel(item.closedAt), to: dayLabel(item.reopenedAt) }, "{from} kuni {to}: pausil")}
                </span>
                {item.note ? <span className={styles.rowText}>{item.note}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </StepPanel>
    );
  } else if (view === "closed") {
    body = (
      <StepPanel
        title={title}
        /* Uuesti avamise teeb leht: selle viga seisab siin, nupu juures. */
        note={footNote(reopenError ? { text: reopenError, tone: "risk" } : null, t("journey.closure.closed_hint"))}
        actions={
          <>
            {historyButton}
            <Button type="button" size="sm" variant="primary" glow={glow} data-reopen="1" aria-busy={busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={onReopen}>
              {current?.kind === JourneyClosureKind.PAUSED ? t("journey.closure.resume", "Jätka Teekonda") : t("journey.closure.reopen", "Ava Teekond uuesti")}
            </Button>
          </>
        }
      >
        <div className={shared.stack}>
          <p className={styles.strong}>
            {current?.kind === JourneyClosureKind.PAUSED
              ? t("journey.closure.paused_line", { date: dayLabel(current.closedAt) }, "Teekond on pausil alates {date}.")
              : current?.kind === JourneyClosureKind.FINISHED
                ? t("journey.closure.finished_line", { date: dayLabel(current.closedAt), outcome: outcomeWord(current.outcome) }, "Teekond on lõpetatud {date}: {outcome}.")
                : t("journey.closure.archived_line", "Teekond on arhiveeritud.")}
          </p>
          {current?.kind === JourneyClosureKind.PAUSED && current.resumeOn ? (
            <p className={shared.quiet}>
              {t("journey.closure.resume_line", { date: plainDayLabel(current.resumeOn) }, "Plaanisid jätkata {date}.")}
              {current.resumeDue ? ` ${t("journey.closure.resume_due", "See päev on käes.")}` : ""}
            </p>
          ) : null}
          {current?.note ? <p className={shared.own}>{current.note}</p> : null}
        </div>
      </StepPanel>
    );
  } else if (view === "pause") {
    body = (
      <Form className={styles.form} validate={false} onSubmit={submit} onKeyDown={blockRepeatEnter}>
        <StepPanel
          title={title}
          question={t("journey.closure.pause_title", "Teekonna pausile panemine")}
          note={footNote(errorNote, t("journey.desk.closure.keeps"))}
          actions={
            <>
              <Button {...SMALL} onClick={reset}>
                {t("journey.actions.decline", "Loobu")}
              </Button>
              <Button type="submit" size="sm" variant="primary" glow={glow} aria-busy={busy ? "true" : undefined}>
                {t("journey.closure.pause", "Pane pausile")}
              </Button>
            </>
          }
        >
          <div className={styles.fields}>
            <div data-autofocus="">
              <TextAreaField
                label={t("journey.closure.pause_note_label", "Miks paned pausile? (võid jätta tühjaks)")}
                value={note}
                onChange={setNote}
                rows={3}
                maxLength={JOURNEY_CLOSURE_LIMITS.note}
              />
            </div>
            <LineField
              t={t}
              label={t("journey.closure.resume_label", "Millal plaanid jätkata? (võid jätta tühjaks)")}
              hint={t("journey.closure.resume_hint", "Kuupäev on sulle endale. Platvorm seda päeva meelde ei tuleta.")}
              size="sm"
              type="date"
              min={todayInEstonia()}
              value={resumeOn}
              onChange={setResumeOn}
            />
          </div>
        </StepPanel>
      </Form>
    );
  } else if (view === "finish") {
    body = (
      <Form className={styles.form} validate={false} onSubmit={submit} onKeyDown={blockRepeatEnter}>
        <StepPanel
          title={title}
          note={footNote(errorNote, t("journey.desk.closure.keeps"))}
          actions={
            <>
              <Button {...SMALL} onClick={reset}>
                {t("journey.actions.decline", "Loobu")}
              </Button>
              <Button type="submit" size="sm" variant="primary" glow={glow} aria-busy={busy ? "true" : undefined}>
                {t("journey.closure.finish", "Lõpeta Teekond")}
              </Button>
            </>
          }
        >
          <div className={shared.stack}>
            <Cells
              label={t("journey.closure.finish_title", "Teekonna lõpetamine")}
              options={[
                { value: "outcome", label: t("journey.desk.closure.finish_tabs.outcome") },
                { value: "more", label: t("journey.desk.closure.finish_tabs.more") }
              ]}
              value={finishPart}
              onChange={setFinishPart}
            />
            {finishPart === "outcome" ? (
              <>
                <ChoiceRow
                  label={t("journey.closure.outcome_question", "Kuidas see Teekond sinu jaoks lõppes?")}
                  options={JOURNEY_CLOSURE_OUTCOMES.map((value) => ({ value, label: outcomeWord(value) }))}
                  value={outcome}
                  onChange={(value) => {
                    setOutcome(value);
                    setError("");
                  }}
                  columns={2}
                />
                {outcome === "UNRESOLVED" ? <p className={shared.quiet}>{t("journey.closure.unresolved_hint")}</p> : null}
              </>
            ) : (
              <div className={styles.fields}>
                <ChoiceRow
                  label={t("journey.closure.level_question", "Kuidas sa praegu oma olukorraga toime tuled? (võid jätta vastamata)")}
                  options={[
                    ...JOURNEY_ASSESSMENT_LEVELS.map((value) => ({ value: String(value), label: t(`journey.assessment.levels.${value}`, String(value)) })),
                    { value: "", label: t("journey.closure.level_none", "ei soovi vastata") }
                  ]}
                  value={String(level)}
                  onChange={(value) => setLevel(String(value))}
                  columns={3}
                  keepColumns
                />
                <TextAreaField
                  label={t("journey.closure.finish_note_label", "Soovi korral lisa paar sõna")}
                  value={note}
                  onChange={setNote}
                  rows={2}
                  maxLength={JOURNEY_CLOSURE_LIMITS.note}
                />
              </div>
            )}
          </div>
        </StepPanel>
      </Form>
    );
  } else {
    body = (
      <StepPanel title={title} lead={t("journey.closure.intro")} note={footNote(errorNote)} actions={historyButton}>
        <ActionCardGrid label={title}>
          <ActionCard title={t("journey.closure.pause", "Pane pausile")} description={t("journey.desk.closure.pause_note")} disabled={busy} onClick={() => setMode(JourneyClosureKind.PAUSED)} />
          <ActionCard title={t("journey.closure.finish", "Lõpeta Teekond")} description={t("journey.desk.closure.finish_note")} disabled={busy} onClick={() => setMode(JourneyClosureKind.FINISHED)} />
        </ActionCardGrid>
      </StepPanel>
    );
  }

  return (
    <div className={styles.swap} ref={rootRef}>
      {body}
    </div>
  );
}
