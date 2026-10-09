"use client";

import { useId, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import { AssessmentChange, JOURNEY_ASSESSMENT_LEVELS, JOURNEY_ASSESSMENT_LIMITS } from "@/lib/journey/assessmentRules";
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
 * Märgistus on lihtne nagu ülejäänud Teekonna lehel; kujundus tuleb eraldi.
 */
export default function JourneyAssessment({ journey, onAssessmentsChange, t }) {
  const journeyId = journey?.id || "";
  const picture = journey?.assessments || { baseline: null, latest: null, change: null, items: [] };
  const archived = journey?.status === "ARCHIVED";
  const groupId = useId();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [level, setLevel] = useState("");
  const [note, setNote] = useState("");
  const actionRef = useRef("");

  const base = `/api/journeys/${encodeURIComponent(journeyId)}/assessments`;
  const levelWord = (value) => t(`journey.assessment.levels.${value}`, String(value));

  const send = async (url, method, body) => {
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
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!level) return;
    /* Sama katse uuesti saates jääb võti samaks: server ei tee teist märget. */
    if (!actionRef.current) actionRef.current = newActionId();
    if (await send(base, "POST", { level: Number(level), note, clientActionId: actionRef.current })) {
      actionRef.current = "";
      setLevel("");
      setNote("");
      setAdding(false);
    }
  };

  const changeSentence = {
    [AssessmentChange.BETTER]: t("journey.assessment.summary_better", "Võrreldes algusega on läinud paremaks."),
    [AssessmentChange.SAME]: t("journey.assessment.summary_same", "Võrreldes algusega on jäänud samaks."),
    [AssessmentChange.HARDER]: t("journey.assessment.summary_harder", "Võrreldes algusega on läinud raskemaks.")
  };

  return (
    <section id="teekond-hinnang" aria-busy={busy}>
      <h2>{t("journey.assessment.title", "Kuidas sul läheb")}</h2>
      <p>
        {t("journey.assessment.intro", "See on sinu enda hinnang ja ainult sinu näha. Esimene märge on algseis; hiljem näed, kas on läinud paremaks.")}
      </p>

      {error ? <p role="alert">{error}</p> : null}

      {!picture.baseline ? (
        <p>{t("journey.assessment.empty", "Sa ei ole veel märkinud, kuidas sul läheb.")}</p>
      ) : (
        <>
          <p>
            {t(
              "journey.assessment.baseline_line",
              { date: dayLabel(picture.baseline.createdAt), level: levelWord(picture.baseline.level) },
              "Algseis {date}: {level}."
            )}
          </p>
          {picture.latest ? (
            <>
              <p>
                {t(
                  "journey.assessment.latest_line",
                  { date: dayLabel(picture.latest.createdAt), level: levelWord(picture.latest.level) },
                  "Viimane märge {date}: {level}."
                )}
              </p>
              <p>
                <strong>{changeSentence[picture.change]}</strong>
              </p>
              {picture.change === AssessmentChange.HARDER ? (
                <p>
                  {t("journey.assessment.harder_hint", "Kui on läinud raskemaks, tasub sellest rääkida inimesega, kes sind aitab, või koostada uus eelpöördumine.")}
                </p>
              ) : null}
            </>
          ) : null}
        </>
      )}

      {archived ? (
        <p>{t("journey.assessment.archived", "Kõrvale pandud Teekonna märkeid saab vaadata, mitte lisada.")}</p>
      ) : adding ? (
        <Form onSubmit={submit}>
          <fieldset>
            <legend id={`${groupId}-legend`}>{t("journey.assessment.question", "Kuidas sa praegu oma olukorraga toime tuled?")}</legend>
            {JOURNEY_ASSESSMENT_LEVELS.map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name={`${groupId}-level`}
                  value={value}
                  checked={String(level) === String(value)}
                  onChange={() => setLevel(String(value))}
                  required
                />{" "}
                {levelWord(value)}
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor={`${groupId}-note`}>{t("journey.assessment.note_label", "Mis on muutunud? (võid jätta tühjaks)")}</label>
            <textarea
              id={`${groupId}-note`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={JOURNEY_ASSESSMENT_LIMITS.note}
            />
          </div>
          <div>
            <Button type="submit" disabled={busy || !level}>
              {t("journey.assessment.save", "Salvesta märge")}
            </Button>
            <Button
              type="button"
              variant="linkBrand"
              disabled={busy}
              onClick={() => {
                setAdding(false);
                setLevel("");
                setNote("");
              }}
            >
              {t("journey.actions.decline", "Loobu")}
            </Button>
          </div>
        </Form>
      ) : (
        <div>
          <Button type="button" variant="primary" disabled={busy} onClick={() => setAdding(true)}>
            {picture.baseline
              ? t("journey.assessment.add", "Märgi, kuidas praegu on")
              : t("journey.assessment.add_first", "Märgi algseis")}
          </Button>
        </div>
      )}

      {picture.items.length ? (
        <details>
          <summary>{t("journey.assessment.history_title", { count: picture.items.length }, "Kõik märked ({count})")}</summary>
          <ul>
            {picture.items.map((item) => (
              <li key={item.id}>
                <p>
                  {[dayLabel(item.createdAt), levelWord(item.level), t(`journey.assessment.change.${item.change}`, item.change)].filter(Boolean).join(" · ")}
                </p>
                {item.note ? <p>{item.note}</p> : null}
                {!archived ? (
                  <Button
                    type="button"
                    variant="linkBrand"
                    disabled={busy}
                    onClick={() => send(`${base}/${encodeURIComponent(item.id)}`, "DELETE")}
                  >
                    {t("journey.assessment.delete", "Kustuta märge")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
