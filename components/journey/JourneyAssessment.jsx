"use client";

import { useEffect, useRef, useState } from "react";

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import { AssessmentChange, JOURNEY_ASSESSMENT_LEVELS, JOURNEY_ASSESSMENT_LIMITS } from "@/lib/journey/assessmentRules";
import { journeyErrorText } from "@/lib/journey/errorText";
import { todayInEstonia } from "@/lib/journey/stepRules";

import { SMALL, TwoPress, blockRepeatEnter, footNote, useStageRemeasure, useSwapFocus } from "./detail/DeskBits";
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

function newActionId() {
  return globalThis.crypto?.randomUUID?.() || `assess-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Inimese enda hinnang muutusele.
 *
 * Esimene märge on algseis; iga järgmise juures on näha, kas võrreldes algusega on
 * läinud paremaks, samaks või raskemaks. Skaala on sõnades. See on inimese hinnang:
 * spetsialisti oma on teine asi ja siia ei tule.
 *
 * KUJU (10.10). Laua osa, mille sees vahetuvad kolm vaadet: seis (algus, viimane
 * märge ja muutus), uus märge (viis sõna ühelaiuste lahtritena ja märkus) ning
 * kõik märked. Märget ei muudeta; vale märge kustutatakse ja see küsib teist
 * vajutust (vanal lehel kustus märge ühe vajutusega).
 *
 * `desk`: { glow, setDirty(dirty) } lavalt ja lehelt.
 */
export default function JourneyAssessment({ journey, onAssessmentsChange, t, desk = {} }) {
  const journeyId = journey?.id || "";
  const picture = journey?.assessments || { baseline: null, latest: null, change: null, items: [] };
  const items = Array.isArray(picture.items) ? picture.items : [];
  const archived = journey?.status === "ARCHIVED";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("read");
  const [level, setLevel] = useState("");
  const [note, setNote] = useState("");
  const actionRef = useRef("");
  const busyRef = useRef(false);
  const shownAt = useRef(0);

  const base = `/api/journeys/${encodeURIComponent(journeyId)}/assessments`;
  const levelWord = (value) => t(`journey.assessment.levels.${value}`, String(value));

  const send = async (url, method, body) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setError(journeyErrorText(t, payload.message, t("journey.assessment.failed", "Märke salvestamine ei õnnestunud. Proovi uuesti.")));
        return false;
      }
      onAssessmentsChange(payload.assessments);
      return true;
    } catch {
      setError(t("journey.assessment.failed", "Märke salvestamine ei õnnestunud. Proovi uuesti."));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const toRead = () => {
    setView("read");
    setLevel("");
    setNote("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (pressTooSoon(shownAt.current)) return;
    if (!level) {
      setError(t("journey.desk.feeling.need_level"));
      return;
    }
    /* Sama katse uuesti saates jääb võti samaks: server ei tee teist märget. */
    if (!actionRef.current) actionRef.current = newActionId();
    if (await send(base, "POST", { level: Number(level), note, clientActionId: actionRef.current })) {
      actionRef.current = "";
      toRead();
    }
  };

  const changeSentence = {
    [AssessmentChange.BETTER]: t("journey.assessment.summary_better", "Võrreldes algusega on läinud paremaks."),
    [AssessmentChange.SAME]: t("journey.assessment.summary_same", "Võrreldes algusega on jäänud samaks."),
    [AssessmentChange.HARDER]: t("journey.assessment.summary_harder", "Võrreldes algusega on läinud raskemaks.")
  };

  /* Kõrvale pandud Teekonnale märget ei lisata; tühjaks jäänud ajalugu viib tagasi seisu juurde. */
  const shown = archived && view === "add" ? "read" : view === "history" && !items.length ? "read" : view;
  const dirty = shown === "add" && Boolean(level || note.trim());
  const setDirty = desk.setDirty;
  useEffect(() => {
    setDirty?.(dirty);
    return () => setDirty?.(false);
  }, [dirty, setDirty]);

  useStageRemeasure(`${shown}:${items.length}:${error}`);
  const rootRef = useSwapFocus(shown);
  useEffect(() => {
    shownAt.current = Date.now();
    setError("");
  }, [shown]);

  const title = t("journey.assessment.title", "Kuidas sul läheb");
  const errorNote = error ? { text: error, tone: "risk" } : null;
  const glow = desk.glow !== false;

  let body;
  if (shown === "add") {
    body = (
      <Form className={styles.form} validate={false} onSubmit={submit} onKeyDown={blockRepeatEnter}>
        <StepPanel
          title={title}
          note={footNote(errorNote)}
          actions={
            <>
              <Button {...SMALL} onClick={toRead}>
                {t("journey.actions.decline", "Loobu")}
              </Button>
              <Button type="submit" size="sm" variant="primary" glow={glow} aria-busy={busy ? "true" : undefined}>
                {t("journey.assessment.save", "Salvesta märge")}
              </Button>
            </>
          }
        >
          <div className={styles.fields}>
            <ChoiceRow
              label={t("journey.assessment.question", "Kuidas sa praegu oma olukorraga toime tuled?")}
              options={JOURNEY_ASSESSMENT_LEVELS.map((value) => ({ value: String(value), label: levelWord(value) }))}
              value={String(level)}
              onChange={(value) => {
                setLevel(String(value));
                setError("");
              }}
              columns={5}
              keepColumns
            />
            <TextAreaField
              label={t("journey.assessment.note_label", "Mis on muutunud? (võid jätta tühjaks)")}
              value={note}
              onChange={setNote}
              rows={3}
              maxLength={JOURNEY_ASSESSMENT_LIMITS.note}
            />
          </div>
        </StepPanel>
      </Form>
    );
  } else if (shown === "history") {
    body = (
      <StepPanel
        title={title}
        note={footNote(errorNote, archived ? t("journey.assessment.archived") : t("journey.desk.feeling.delete_note"))}
        actions={
          <Button {...SMALL} onClick={toRead}>
            {t("journey.desk.back")}
          </Button>
        }
      >
        <ul className={shared.rows} aria-busy={busy ? "true" : undefined}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.plainRow}>
                <span className={shared.rowTitle}>{[dayLabel(item.createdAt), levelWord(item.level)].filter(Boolean).join(" · ")}</span>
                <span className={styles.rowText}>{[t(`journey.assessment.change.${item.change}`, ""), item.note].filter(Boolean).join(" · ")}</span>
              </span>
              {!archived ? (
                <TwoPress
                  compact
                  danger
                  label={t("journey.assessment.delete", "Kustuta märge")}
                  confirmLabel={t("journey.desk.confirm_delete")}
                  cancelLabel={t("journey.actions.decline", "Loobu")}
                  busy={busy}
                  onConfirm={() => send(`${base}/${encodeURIComponent(item.id)}`, "DELETE")}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </StepPanel>
    );
  } else {
    body = (
      <StepPanel
        title={title}
        note={footNote(errorNote, archived ? t("journey.assessment.archived") : t("journey.desk.feeling.private"))}
        actions={
          <>
            {items.length ? (
              <Button {...SMALL} onClick={() => setView("history")}>
                {t("journey.assessment.history_title", { count: items.length }, "Kõik märked ({count})")}
              </Button>
            ) : null}
            {!archived ? (
              <Button type="button" size="sm" variant="primary" glow={glow} data-add-mark="1" onClick={() => setView("add")}>
                {picture.baseline ? t("journey.assessment.add", "Märgi, kuidas praegu on") : t("journey.assessment.add_first", "Märgi algseis")}
              </Button>
            ) : null}
          </>
        }
      >
        <div className={shared.stack}>
          {!picture.baseline ? (
            <>
              <p className={shared.quiet}>{t("journey.assessment.empty", "Sa ei ole veel märkinud, kuidas sul läheb.")}</p>
              <p className={shared.small}>{t("journey.desk.feeling.first_hint")}</p>
            </>
          ) : (
            <>
              {picture.latest ? <p className={styles.strong}>{changeSentence[picture.change]}</p> : null}
              <div className={shared.facts}>
                <p className={shared.fact}>
                  <span className={shared.factValue}>
                    {t("journey.assessment.baseline_line", { date: dayLabel(picture.baseline.createdAt), level: levelWord(picture.baseline.level) }, "Algseis {date}: {level}.")}
                  </span>
                </p>
                {picture.latest ? (
                  <p className={shared.fact}>
                    <span className={shared.factValue}>
                      {t("journey.assessment.latest_line", { date: dayLabel(picture.latest.createdAt), level: levelWord(picture.latest.level) }, "Viimane märge {date}: {level}.")}
                    </span>
                  </p>
                ) : null}
              </div>
              {picture.latest && picture.change === AssessmentChange.HARDER ? <p className={shared.quiet}>{t("journey.assessment.harder_hint")}</p> : null}
            </>
          )}
        </div>
      </StepPanel>
    );
  }

  return (
    <div className={styles.swap} ref={rootRef}>
      {body}
    </div>
  );
}
