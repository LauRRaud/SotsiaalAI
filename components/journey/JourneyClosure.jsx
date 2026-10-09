"use client";

import { useId, useState } from "react";

import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import { JOURNEY_ASSESSMENT_LEVELS } from "@/lib/journey/assessmentRules";
import { JOURNEY_CLOSURE_LIMITS, JOURNEY_CLOSURE_OUTCOMES, JourneyClosureKind } from "@/lib/journey/closureRules";
import { journeyErrorText } from "@/lib/journey/errorText";
import { todayInEstonia } from "@/lib/journey/stepRules";

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
 * Märgistus on lihtne nagu ülejäänud Teekonna lehel; kujundus tuleb eraldi.
 */
export default function JourneyClosure({ journey, busy: pageBusy = false, onClosed, onReopen, t }) {
  const journeyId = journey?.id || "";
  const archived = journey?.status === "ARCHIVED";
  const current = journey?.closure?.current || null;
  const history = Array.isArray(journey?.closure?.history) ? journey.closure.history : [];
  const fieldId = useId();

  const [mode, setMode] = useState("");
  const [note, setNote] = useState("");
  const [resumeOn, setResumeOn] = useState("");
  const [outcome, setOutcome] = useState("");
  const [level, setLevel] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const busy = pageBusy || sending;

  const outcomeWord = (value) => t(`journey.closure.outcomes.${value}`, value);
  const failed = () => t("journey.closure.failed", "Salvestamine ei õnnestunud. Proovi uuesti.");

  const reset = () => {
    setMode("");
    setNote("");
    setResumeOn("");
    setOutcome("");
    setLevel("");
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!mode || (mode === JourneyClosureKind.FINISHED && !outcome)) return;
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
      setSending(false);
    }
  };

  const noteField = (label) => (
    <div>
      <label htmlFor={`${fieldId}-note`}>{label}</label>
      <textarea id={`${fieldId}-note`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={JOURNEY_CLOSURE_LIMITS.note} />
    </div>
  );

  const cancelButton = (
    <Button type="button" variant="linkBrand" disabled={busy} onClick={reset}>
      {t("journey.actions.decline", "Loobu")}
    </Button>
  );

  return (
    <section id="teekond-paus" aria-busy={busy}>
      <h2>{t("journey.closure.title", "Paus ja lõpetamine")}</h2>

      {error ? <p role="alert">{error}</p> : null}

      {archived ? (
        <>
          {current?.kind === JourneyClosureKind.PAUSED ? (
            <>
              <p>{t("journey.closure.paused_line", { date: dayLabel(current.closedAt) }, "Teekond on pausil alates {date}.")}</p>
              {current.resumeOn ? (
                <p>
                  {t("journey.closure.resume_line", { date: plainDayLabel(current.resumeOn) }, "Plaanisid jätkata {date}.")}
                  {current.resumeDue ? ` ${t("journey.closure.resume_due", "See päev on käes.")}` : ""}
                </p>
              ) : null}
            </>
          ) : current?.kind === JourneyClosureKind.FINISHED ? (
            <p>
              {t(
                "journey.closure.finished_line",
                { date: dayLabel(current.closedAt), outcome: outcomeWord(current.outcome) },
                "Teekond on lõpetatud {date}: {outcome}."
              )}
            </p>
          ) : (
            <p>{t("journey.closure.archived_line", "Teekond on arhiveeritud.")}</p>
          )}
          {current?.note ? <p>{current.note}</p> : null}
          <p>{t("journey.closure.closed_hint", "Kõrvale pandud Teekonda saab vaadata, mitte muuta. Uuesti avades jätkad samast kohast.")}</p>
          <div>
            <Button type="button" variant="primary" disabled={busy} onClick={onReopen}>
              {current?.kind === JourneyClosureKind.PAUSED
                ? t("journey.closure.resume", "Jätka Teekonda")
                : t("journey.closure.reopen", "Ava Teekond uuesti")}
            </Button>
          </div>
        </>
      ) : mode === JourneyClosureKind.PAUSED ? (
        <Form onSubmit={submit}>
          <h3>{t("journey.closure.pause_title", "Teekonna pausile panemine")}</h3>
          {noteField(t("journey.closure.pause_note_label", "Miks paned pausile? (võid jätta tühjaks)"))}
          <div>
            <label htmlFor={`${fieldId}-resume`}>{t("journey.closure.resume_label", "Millal plaanid jätkata? (võid jätta tühjaks)")}</label>
            <input
              id={`${fieldId}-resume`}
              type="date"
              min={todayInEstonia()}
              value={resumeOn}
              onChange={(event) => setResumeOn(event.target.value)}
              aria-describedby={`${fieldId}-resume-hint`}
            />
            <p id={`${fieldId}-resume-hint`}>{t("journey.closure.resume_hint", "Kuupäev on sulle endale. Platvorm seda päeva meelde ei tuleta.")}</p>
          </div>
          <div>
            <Button type="submit" variant="primary" disabled={busy}>
              {t("journey.closure.pause", "Pane pausile")}
            </Button>
            {cancelButton}
          </div>
        </Form>
      ) : mode === JourneyClosureKind.FINISHED ? (
        <Form onSubmit={submit}>
          <h3>{t("journey.closure.finish_title", "Teekonna lõpetamine")}</h3>
          <fieldset>
            <legend>{t("journey.closure.outcome_question", "Kuidas see Teekond sinu jaoks lõppes?")}</legend>
            {JOURNEY_CLOSURE_OUTCOMES.map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name={`${fieldId}-outcome`}
                  value={value}
                  checked={outcome === value}
                  onChange={() => setOutcome(value)}
                  required
                />{" "}
                {outcomeWord(value)}
              </label>
            ))}
          </fieldset>
          {outcome === "UNRESOLVED" ? (
            <p>{t("journey.closure.unresolved_hint", "Kui mure jäi lahenduseta, saad Teekonna hiljem uuesti avada ja koostada uue eelpöördumise.")}</p>
          ) : null}
          <fieldset>
            <legend>{t("journey.closure.level_question", "Kuidas sa praegu oma olukorraga toime tuled? (võid jätta vastamata)")}</legend>
            {JOURNEY_ASSESSMENT_LEVELS.map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name={`${fieldId}-level`}
                  value={value}
                  checked={String(level) === String(value)}
                  onChange={() => setLevel(String(value))}
                />{" "}
                {t(`journey.assessment.levels.${value}`, String(value))}
              </label>
            ))}
            <label>
              <input type="radio" name={`${fieldId}-level`} value="" checked={level === ""} onChange={() => setLevel("")} />{" "}
              {t("journey.closure.level_none", "ei soovi vastata")}
            </label>
          </fieldset>
          {noteField(t("journey.closure.finish_note_label", "Soovi korral lisa paar sõna"))}
          <div>
            <Button type="submit" variant="primary" disabled={busy || !outcome}>
              {t("journey.closure.finish", "Lõpeta Teekond")}
            </Button>
            {cancelButton}
          </div>
        </Form>
      ) : (
        <>
          <p>{t("journey.closure.intro", "Teekonna võid igal ajal pausile panna või lõpetada. Midagi ei kustu ja saad selle alati uuesti avada.")}</p>
          <div>
            <Button type="button" disabled={busy} onClick={() => setMode(JourneyClosureKind.PAUSED)}>
              {t("journey.closure.pause", "Pane pausile")}
            </Button>
            <Button type="button" disabled={busy} onClick={() => setMode(JourneyClosureKind.FINISHED)}>
              {t("journey.closure.finish", "Lõpeta Teekond")}
            </Button>
          </div>
        </>
      )}

      {history.length ? (
        <details>
          <summary>{t("journey.closure.history_title", { count: history.length }, "Varasemad pausid ja lõpetamised ({count})")}</summary>
          <ul>
            {history.map((item) => (
              <li key={item.id}>
                <p>
                  {item.kind === JourneyClosureKind.FINISHED
                    ? t(
                        "journey.closure.history_finished",
                        { from: dayLabel(item.closedAt), to: dayLabel(item.reopenedAt), outcome: outcomeWord(item.outcome) },
                        "{from} kuni {to}: lõpetatud, {outcome}"
                      )
                    : t(
                        "journey.closure.history_paused",
                        { from: dayLabel(item.closedAt), to: dayLabel(item.reopenedAt) },
                        "{from} kuni {to}: pausil"
                      )}
                </p>
                {item.note ? <p>{item.note}</p> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
