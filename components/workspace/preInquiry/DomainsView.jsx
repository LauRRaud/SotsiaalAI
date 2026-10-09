"use client";

/**
 * DomainsView — eluvaldkondade küsimused, üks korraga.
 *
 * Eelkaardistuses on 7 eluvaldkonda ja 21 küsimust. Varem olid need kõik ühes
 * avatavas plokis üksteise all, igaühel viis valikukaarti ja lisaküsimuste
 * tekstiväljad. Siin on ees üks küsimus: vastus on üks puudutus ja järgmine
 * küsimus tuleb ise ette (kui vastus lisaküsimusi ei too). Kerimine liigub
 * küsimuselt küsimusele; viimaselt küsimuselt edasi kerides vahetub samm.
 *
 * Riba näitab, millises valdkonnas inimene on; sellele vajutades avaneb
 * valdkondade ülevaade, kust saab otse hüpata.
 *
 * Olekut (vastuseid) vaade ei hoia: need tulevad lehelt. Vaate enda olek on
 * ainult see, milline küsimus on ees.
 *
 * Kujundus: DomainsView.module.css.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import ChoiceRow from "@/components/stage/ChoiceRow";
import { ancestorCanScroll, isTypingTarget } from "@/components/stage/scroll";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";

import styles from "./DomainsView.module.css";

const ADVANCE_DELAY_MS = 340;
const WHEEL_COOLDOWN_MS = 420;
const WHEEL_INTENT = 40;

function Chevron({ direction }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "left" ? "M14.5 6l-6 6 6 6" : "M9.5 6l6 6-6 6"} />
    </svg>
  );
}

export default function DomainsView({ tr, definitions, domains, path, screenOptions, followUpsOf, onAnswer, onFollowUp }) {
  const flat = useMemo(
    () =>
      definitions.flatMap((definition) =>
        definition.primaryQuestions.map((question, position) => ({ definition, question, position }))
      ),
    [definitions]
  );
  const [index, setIndex] = useState(0);
  const [overview, setOverview] = useState(false);
  const rootRef = useRef(null);
  const indexRef = useRef(index);
  const overviewRef = useRef(overview);
  const advanceRef = useRef(0);
  indexRef.current = index;
  overviewRef.current = overview;

  const answerOf = (definitionId, questionId) =>
    domains.find((item) => item.id === definitionId)?.primaryAnswers?.find((answer) => answer.id === questionId) || {};
  const answeredIn = (definition) => definition.primaryQuestions.filter((question) => answerOf(definition.id, question.id).screenAnswer).length;

  const current = flat[Math.min(index, flat.length - 1)];
  const answer = answerOf(current.definition.id, current.question.id);
  const followUps = followUpsOf(current.question, path, answer.screenAnswer);
  const chosen = screenOptions.find((option) => option.value === answer.screenAnswer);

  const go = (next) => {
    window.clearTimeout(advanceRef.current);
    setOverview(false);
    setIndex(Math.max(0, Math.min(flat.length - 1, next)));
  };

  useEffect(() => () => window.clearTimeout(advanceRef.current), []);

  /* Rull liigub küsimuselt küsimusele. Esimeselt tagasi ja viimaselt edasi
     kerides jääb sündmus sammulavale, mis vahetab siis sammu. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const state = { until: 0, sum: 0 };
    const onWheel = (event) => {
      if (overviewRef.current || event.ctrlKey || Math.abs(event.deltaY) < 4) return;
      if (ancestorCanScroll(event.target, event.deltaY)) return;
      const direction = event.deltaY > 0 ? 1 : -1;
      const target = indexRef.current + direction;
      if (target < 0 || target > flat.length - 1) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.timeStamp < state.until) return;
      state.sum += event.deltaY;
      if (Math.abs(state.sum) < WHEEL_INTENT) return;
      state.sum = 0;
      state.until = event.timeStamp + WHEEL_COOLDOWN_MS;
      window.clearTimeout(advanceRef.current);
      setIndex(target);
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [flat.length]);

  const choose = (value) => {
    onAnswer(current.definition.id, current.question.id, value);
    window.clearTimeout(advanceRef.current);
    /* Kui vastus lisaküsimusi ei too, tuleb järgmine küsimus ise ette. */
    if (!followUpsOf(current.question, path, value).length && index < flat.length - 1) {
      advanceRef.current = window.setTimeout(() => setIndex((value_) => Math.min(flat.length - 1, value_ + 1)), ADVANCE_DELAY_MS);
    }
  };

  const onKeyDown = (event) => {
    if (isTypingTarget(event.target) || overview) return;
    if (event.key === "ArrowRight" && event.altKey) go(index + 1);
    if (event.key === "ArrowLeft" && event.altKey) go(index - 1);
  };

  return (
    <StepPanel title={tr("views.domains.title", "Eluvaldkonnad")}>
      <div className={styles.domains} ref={rootRef} onKeyDown={onKeyDown}>
        <div className={styles.bar}>
          <button
            type="button"
            className={styles.arrow}
            disabled={index === 0 || overview}
            aria-label={tr("views.domains.previous", "Eelmine küsimus")}
            onClick={() => go(index - 1)}
          >
            <Chevron direction="left" />
          </button>
          <button type="button" className={styles.where} aria-expanded={overview} onClick={() => setOverview((value) => !value)}>
            <span className={styles.whereDomain}>{current.definition.title}</span>
            <span className={styles.whereCount}>
              {overview ? tr("views.domains.all", "Kõik valdkonnad") : `${current.position + 1}/${current.definition.primaryQuestions.length}`}
            </span>
          </button>
          <button
            type="button"
            className={styles.arrow}
            disabled={index === flat.length - 1 || overview}
            aria-label={tr("views.domains.next", "Järgmine küsimus")}
            onClick={() => go(index + 1)}
          >
            <Chevron direction="right" />
          </button>
        </div>

        {overview ? (
          <div className={styles.overview} role="group" aria-label={tr("views.domains.all", "Kõik valdkonnad")}>
            {definitions.map((definition) => {
              const done = answeredIn(definition);
              const total = definition.primaryQuestions.length;
              return (
                <button
                  key={definition.id}
                  type="button"
                  className={styles.domain}
                  data-state={done === 0 ? "empty" : done === total ? "done" : "partial"}
                  aria-current={definition.id === current.definition.id ? "true" : undefined}
                  onClick={() => go(flat.findIndex((item) => item.definition.id === definition.id))}
                >
                  <span className={styles.domainTitle}>{definition.title}</span>
                  <span className={styles.domainCount}>
                    {done}/{total}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.question} key={`${current.definition.id}:${current.question.id}`}>
            <p className={styles.topic}>{current.question.title}</p>
            <ChoiceRow
              label={current.question.question}
              options={screenOptions.map((option) => ({ value: option.value, label: option.label }))}
              value={answer.screenAnswer || null}
              columns={screenOptions.length}
              onChange={choose}
            />
            {chosen?.helperText ? <p className={styles.helper}>{chosen.helperText}</p> : null}
            {followUps.map((question) => (
              <TextAreaField
                key={question}
                label={question}
                value={answer.followUpAnswers?.[question] || ""}
                rows={2}
                maxLength={2000}
                onChange={(value) => onFollowUp(current.definition.id, current.question.id, question, value)}
              />
            ))}
          </div>
        )}
      </div>
    </StepPanel>
  );
}
