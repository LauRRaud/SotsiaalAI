"use client";

import { useEffect, useRef, useState } from "react";

import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import { journeyErrorText } from "@/lib/journey/errorText";
import { JOURNEY_STEP_LIMITS, JourneyStepState, todayInEstonia } from "@/lib/journey/stepRules";

import { Cells, LineField, SMALL, TwoPress, blockRepeatEnter, footNote, ignoreKeyRepeat, useStageRemeasure, useSwapFocus } from "./detail/DeskBits";
import styles from "./detail/detail.module.css";
import { plainDayLabel, pressTooSoon, stepGroups, stepMeta, stepSuggestions } from "./detail/journeyDesk";
import shared from "./journey.module.css";

function newActionId() {
  return globalThis.crypto?.randomUUID?.() || `step-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

const EMPTY_FORM = Object.freeze({ title: "", doer: "", dueOn: "" });

/** Lõpetamise hetk Eesti kalendripäevana: sama päev, mille annab server ja paberleht. */
function doneDay(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : plainDayLabel(todayInEstonia(date));
}

/**
 * Teekonna järgmised sammud: mida tehakse, kes teeb, mis ajaks ja kas tehtud.
 *
 * Sammud on inimese enda omad ja ainult talle näha. Tehtuks märkides saab lisada,
 * mis juhtus („helistasin, lubati tagasi helistada"); ära jäetud samm jääb alles,
 * et oleks näha, mis otsustati. Platvormi pakutud tekstirea saab võtta sammuks.
 *
 * KUJU (10.10). See on avatud Teekonna laua üks osa ja selle sees vahetuvad
 * väikesed vaated kohapeal: loend (tegemata, pakutud, lõpetatud ühelaiuste
 * lahtrite taga), avatud samm, lõpetamise märkus, muutmine ja uus samm. Rea
 * kõrval on „Tehtud" (kõige sagedasem tegu); kõik muu on avatud sammus.
 * Kustutamine küsib teist vajutust.
 *
 * `desk`: { glow, setDirty(dirty) } lavalt ja lehelt.
 */
export default function JourneySteps({ journey, onStepsChange, t, desk = {} }) {
  const journeyId = journey?.id || "";
  const steps = Array.isArray(journey?.steps) ? journey.steps : [];
  const archived = journey?.status === "ARCHIVED";
  const { open, closed } = stepGroups(journey);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  /* { id, mode: "open" | "close" | "edit", state?, title?, doer?, dueOn?, note? } */
  const [panel, setPanel] = useState(null);
  const [tab, setTab] = useState("open");
  const actionRef = useRef("");
  const busyRef = useRef(false);
  const shownAt = useRef(0);

  const base = `/api/journeys/${encodeURIComponent(journeyId)}/steps`;

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
        setError(journeyErrorText(t, payload.message, t("journey.own_steps.failed", "Sammu salvestamine ei õnnestunud. Proovi uuesti.")));
        return false;
      }
      onStepsChange(payload.steps || []);
      return true;
    } catch {
      setError(t("journey.own_steps.failed", "Sammu salvestamine ei õnnestunud. Proovi uuesti."));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const add = async (fields) => {
    /* Sama katse uuesti saates jääb võti samaks: server ei tee teist sammu. */
    if (!actionRef.current) actionRef.current = newActionId();
    const ok = await send(base, "POST", { ...fields, clientActionId: actionRef.current });
    if (ok) actionRef.current = "";
    return ok;
  };

  const submitNew = async (event) => {
    event.preventDefault();
    /* Loendi „Lisa samm" ja vormi „Lisa samm" seisavad samas kohas: topeltklõps ei lisa tühja sammu. */
    if (pressTooSoon(shownAt.current)) return;
    if (!form.title.trim()) {
      setError(t("journey.desk.steps.need_title"));
      return;
    }
    if (await add({ title: form.title, doer: form.doer, dueOn: form.dueOn || null })) {
      setForm(EMPTY_FORM);
      setAdding(false);
    }
  };

  const submitPanel = async (event) => {
    event.preventDefault();
    if (!panel || pressTooSoon(shownAt.current)) return;
    if (panel.mode === "edit" && !String(panel.title || "").trim()) {
      setError(t("journey.desk.steps.need_title"));
      return;
    }
    const body =
      panel.mode === "close"
        ? { state: panel.state, note: panel.note }
        : { title: panel.title, doer: panel.doer, dueOn: panel.dueOn || null, note: panel.note };
    if (await send(`${base}/${encodeURIComponent(panel.id)}`, "PATCH", body)) setPanel(null);
  };

  const today = todayInEstonia(new Date());
  /* Kõrvale pandud Teekonnal on pakutud read näha, aga sammuks neid võtta ei saa. */
  const suggestions = stepSuggestions(journey, JOURNEY_STEP_LIMITS.title);
  const current = panel ? steps.find((step) => step.id === panel.id) || null : null;
  /* Avatud samm kadus (kustutati teises aknas): tagasi loendisse. */
  const view = adding ? "add" : panel && current ? panel.mode : "list";

  const tabs = [
    { value: "open", label: t("journey.desk.steps.tabs.open") },
    ...(suggestions.length ? [{ value: "suggested", label: t("journey.desk.steps.tabs.suggested") }] : []),
    ...(closed.length ? [{ value: "closed", label: t("journey.desk.steps.tabs.closed") }] : [])
  ];
  const shownTab = tabs.some((item) => item.value === tab) ? tab : "open";

  /* Muudetud tekst hoiab lahkumise kinni: uus samm, muudetav samm või märkus,
     mis erineb sammust endast. */
  const dirty =
    (adding && Boolean(form.title.trim() || form.doer.trim() || form.dueOn)) ||
    (panel?.mode === "edit" && current
      ? panel.title !== current.title || (panel.doer || "") !== (current.doer || "") || (panel.dueOn || "") !== (current.dueOn || "") || (panel.note || "") !== (current.note || "")
      : false) ||
    (panel?.mode === "close" && current ? (panel.note || "") !== (current.note || "") : false);
  const setDirty = desk.setDirty;
  useEffect(() => {
    setDirty?.(dirty);
    return () => setDirty?.(false);
  }, [dirty, setDirty]);

  /* Teekond pandi kõrvale ajal, mil siin oli vorm lahti: vorm sulgub (avatud
     samm jääb lugemiseks ette). */
  useEffect(() => {
    if (!archived) return;
    setAdding(false);
    setForm(EMPTY_FORM);
    setPanel((current) => (current && current.mode !== "open" ? { id: current.id, mode: "open" } : current));
  }, [archived]);

  const viewKey = `${view}:${panel?.id || ""}:${shownTab}`;
  useStageRemeasure(`${viewKey}:${steps.length}:${error}`);
  const rootRef = useSwapFocus(viewKey);
  useEffect(() => {
    shownAt.current = Date.now();
    setError("");
  }, [viewKey]);

  const toList = () => {
    setPanel(null);
    setAdding(false);
    setForm(EMPTY_FORM);
  };
  const note = footNote(error ? { text: error, tone: "risk" } : null);
  const title = t("journey.own_steps.title", "Järgmised sammud");
  const glow = desk.glow !== false;

  let body;
  if (view === "add") {
    body = (
      <Form className={styles.form} validate={false} onSubmit={submitNew} onKeyDown={blockRepeatEnter}>
        <StepPanel
          title={title}
          question={t("journey.desk.steps.add_question")}
          note={note}
          actions={
            <>
              <Button {...SMALL} onClick={toList}>
                {t("journey.actions.decline", "Loobu")}
              </Button>
              <Button type="submit" size="sm" variant="primary" glow={glow} aria-busy={busy ? "true" : undefined}>
                {t("journey.own_steps.add", "Lisa samm")}
              </Button>
            </>
          }
        >
          <div className={styles.fields}>
            <LineField t={t} label={t("journey.own_steps.title_label")} size="lg" value={form.title} max={JOURNEY_STEP_LIMITS.title} autoFocus onChange={(value) => setForm({ ...form, title: value })} />
            <div className={styles.fieldPair}>
              <LineField t={t} label={t("journey.own_steps.doer_label")} value={form.doer} max={JOURNEY_STEP_LIMITS.doer} onChange={(value) => setForm({ ...form, doer: value })} />
              <LineField t={t} label={t("journey.own_steps.due_label")} size="sm" type="date" value={form.dueOn} onChange={(value) => setForm({ ...form, dueOn: value })} />
            </div>
          </div>
        </StepPanel>
      </Form>
    );
  } else if (view === "close") {
    const done = panel.state === JourneyStepState.DONE;
    body = (
      <Form className={styles.form} validate={false} onSubmit={submitPanel} onKeyDown={blockRepeatEnter}>
        <StepPanel
          title={title}
          question={current.title}
          note={note}
          actions={
            <>
              <Button {...SMALL} onClick={toList}>
                {t("journey.actions.decline", "Loobu")}
              </Button>
              <Button type="submit" size="sm" variant="primary" glow={glow} aria-busy={busy ? "true" : undefined}>
                {done ? t("journey.own_steps.confirm_done", "Märgi tehtuks") : t("journey.own_steps.confirm_dropped", "Jäta samm ära")}
              </Button>
            </>
          }
        >
          <div data-autofocus="">
            <TextAreaField
              label={t("journey.own_steps.what_happened", "Mis juhtus? (võid jätta tühjaks)")}
              value={panel.note || ""}
              onChange={(value) => setPanel({ ...panel, note: value })}
              rows={4}
              maxLength={JOURNEY_STEP_LIMITS.note}
            />
          </div>
        </StepPanel>
      </Form>
    );
  } else if (view === "edit") {
    body = (
      <Form className={styles.form} validate={false} onSubmit={submitPanel} onKeyDown={blockRepeatEnter}>
        <StepPanel
          title={title}
          note={note}
          actions={
            <>
              <Button {...SMALL} onClick={() => setPanel({ id: current.id, mode: "open" })}>
                {t("journey.actions.decline", "Loobu")}
              </Button>
              <Button type="submit" size="sm" variant="primary" glow={glow} aria-busy={busy ? "true" : undefined}>
                {t("journey.own_steps.save", "Salvesta samm")}
              </Button>
            </>
          }
        >
          <div className={styles.fields}>
            <LineField t={t} label={t("journey.own_steps.title_label")} size="lg" value={panel.title || ""} max={JOURNEY_STEP_LIMITS.title} autoFocus onChange={(value) => setPanel({ ...panel, title: value })} />
            <div className={styles.fieldPair}>
              <LineField t={t} label={t("journey.own_steps.doer_label")} value={panel.doer || ""} max={JOURNEY_STEP_LIMITS.doer} onChange={(value) => setPanel({ ...panel, doer: value })} />
              <LineField t={t} label={t("journey.own_steps.due_label")} size="sm" type="date" value={panel.dueOn || ""} onChange={(value) => setPanel({ ...panel, dueOn: value })} />
            </div>
            <TextAreaField
              label={t("journey.own_steps.note_label", "Märkus (võid jätta tühjaks)")}
              value={panel.note || ""}
              onChange={(value) => setPanel({ ...panel, note: value })}
              rows={2}
              maxLength={JOURNEY_STEP_LIMITS.note}
            />
          </div>
        </StepPanel>
      </Form>
    );
  } else if (view === "open") {
    const meta = stepMeta(current, { t, today });
    const isOpen = current.state === JourneyStepState.TODO;
    body = (
      <StepPanel
        title={title}
        question={current.title}
        note={note}
        actions={
          <>
            <Button {...SMALL} onClick={toList}>
              {t("journey.desk.back_to_list")}
            </Button>
            {!archived && isOpen ? (
              <>
                <Button {...SMALL} onClick={() => setPanel({ id: current.id, mode: "edit", title: current.title, doer: current.doer || "", dueOn: current.dueOn || "", note: current.note || "" })}>
                  {t("journey.own_steps.edit", "Muuda")}
                </Button>
                <Button {...SMALL} onClick={() => setPanel({ id: current.id, mode: "close", state: JourneyStepState.DROPPED, note: current.note || "" })}>
                  {t("journey.own_steps.drop", "Jätan ära")}
                </Button>
                <Button type="button" size="sm" variant="primary" glow={glow} onClick={() => setPanel({ id: current.id, mode: "close", state: JourneyStepState.DONE, note: current.note || "" })}>
                  {t("journey.own_steps.done", "Tehtud")}
                </Button>
              </>
            ) : null}
            {!archived && !isOpen ? (
              <Button
                {...SMALL}
                onKeyDown={ignoreKeyRepeat}
                onClick={async () => {
                  if (await send(`${base}/${encodeURIComponent(current.id)}`, "PATCH", { state: JourneyStepState.TODO })) setPanel(null);
                }}
              >
                {t("journey.own_steps.reopen", "Ava uuesti")}
              </Button>
            ) : null}
          </>
        }
      >
        <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
          <p className={shared.quiet}>
            {[
              isOpen ? "" : t(`journey.own_steps.states.${current.state}`),
              !isOpen && current.doneAt ? doneDay(current.doneAt) : "",
              meta
            ]
              .filter(Boolean)
              .join(" · ") || t("journey.desk.steps.no_details")}
          </p>
          {current.note ? <p className={shared.own}>{current.note}</p> : null}
          {!archived && isOpen ? (
            <TwoPress
              danger
              label={t("journey.own_steps.delete", "Kustuta samm")}
              confirmLabel={t("journey.desk.confirm_delete")}
              cancelLabel={t("journey.actions.decline", "Loobu")}
              note={t("journey.desk.steps.delete_note")}
              busy={busy}
              onConfirm={async () => {
                if (await send(`${base}/${encodeURIComponent(current.id)}`, "DELETE")) setPanel(null);
              }}
            />
          ) : null}
        </div>
      </StepPanel>
    );
  } else {
    const rows = shownTab === "closed" ? closed : open;
    body = (
      <StepPanel title={title} note={footNote(error ? { text: error, tone: "risk" } : null, archived ? t("journey.own_steps.archived") : t("journey.desk.steps.private"))}>
        <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
          <div className={styles.bar}>
            <Cells label={t("journey.desk.steps.tabs.label")} options={tabs} value={shownTab} onChange={setTab} />
            {!archived ? (
              <Button type="button" size="sm" variant="primary" glow={glow} data-add-step="1" onClick={() => setAdding(true)}>
                {t("journey.own_steps.add", "Lisa samm")}
              </Button>
            ) : null}
          </div>

          {shownTab === "suggested" ? (
            <>
              <p className={shared.small}>{t("journey.own_steps.suggested_hint")}</p>
              <ul className={shared.rows}>
                {suggestions.map((suggestion) => (
                  <li key={suggestion} className={styles.item}>
                    <span className={styles.plainRow}>
                      <span className={shared.rowTitle}>{suggestion}</span>
                    </span>
                    {archived ? null : (
                      <Button {...SMALL} className={styles.aside} onKeyDown={ignoreKeyRepeat} onClick={() => add({ title: suggestion })}>
                        {t("journey.own_steps.take", "Võta sammuks")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : rows.length ? (
            <ul className={shared.rows} aria-label={shownTab === "closed" ? t("journey.desk.steps.tabs.closed") : t("journey.own_steps.open_list", "Tegemata sammud")}>
              {rows.map((step) => {
                const isOpen = step.state === JourneyStepState.TODO;
                const sub = isOpen
                  ? [stepMeta(step, { t, today }), step.note].filter(Boolean).join(" · ")
                  : [t(`journey.own_steps.states.${step.state}`), step.doneAt ? doneDay(step.doneAt) : "", step.note].filter(Boolean).join(" · ");
                return (
                  <li key={step.id} className={styles.item}>
                    <button type="button" className={shared.row} data-step={step.id} onClick={() => setPanel({ id: step.id, mode: "open" })}>
                      <span className={shared.rowMain}>
                        <span className={shared.rowTitle}>{step.title}</span>
                        {sub ? <span className={shared.rowSub}>{sub}</span> : null}
                      </span>
                      {isOpen && step.dueOn && step.dueOn < today ? (
                        <span className={shared.rowMeta}>
                          <span className={shared.chip} data-tone="wait">
                            {plainDayLabel(step.dueOn)}
                          </span>
                        </span>
                      ) : null}
                    </button>
                    {!archived && isOpen ? (
                      <Button {...SMALL} className={styles.aside} data-done={step.id} onClick={() => setPanel({ id: step.id, mode: "close", state: JourneyStepState.DONE, note: step.note || "" })}>
                        {t("journey.own_steps.done", "Tehtud")}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={shared.quiet}>{t("journey.own_steps.empty", "Ühtegi tegemata sammu ei ole kirjas.")}</p>
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
