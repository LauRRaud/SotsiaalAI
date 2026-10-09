"use client";

import { useRef, useState } from "react";

import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import { journeyErrorText } from "@/lib/journey/errorText";
import { JOURNEY_STEP_LIMITS, JourneyStepState, todayInEstonia } from "@/lib/journey/stepRules";

/** `2026-10-15` → `15.10.2026`. Käsitsi, et server ja brauser annaksid sama kuju. */
function dayLabel(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""));
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

function newActionId() {
  return globalThis.crypto?.randomUUID?.() || `step-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

const EMPTY_FORM = Object.freeze({ title: "", doer: "", dueOn: "" });

/**
 * Teekonna järgmised sammud: mida tehakse, kes teeb, mis ajaks ja kas tehtud.
 *
 * Sammud on inimese enda omad ja ainult talle näha. Tehtuks märkides saab lisada,
 * mis juhtus („helistasin, lubati tagasi helistada"); ära jäetud samm jääb alles,
 * et oleks näha, mis otsustati. Platvormi pakutud tekstirea saab võtta sammuks.
 *
 * Märgistus on lihtne nagu ülejäänud Teekonna lehel; kujundus tuleb eraldi.
 */
export default function JourneySteps({ journey, onStepsChange, t }) {
  const journeyId = journey?.id || "";
  const steps = Array.isArray(journey?.steps) ? journey.steps : [];
  const archived = journey?.status === "ARCHIVED";
  const open = steps.filter((step) => step.state === JourneyStepState.TODO);
  const closed = steps.filter((step) => step.state !== JourneyStepState.TODO);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  /* { id, mode: "close" | "edit", state?, title?, doer?, dueOn?, note? } */
  const [panel, setPanel] = useState(null);
  const actionRef = useRef("");

  const base = `/api/journeys/${encodeURIComponent(journeyId)}/steps`;

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
        setError(journeyErrorText(t, payload.message, t("journey.own_steps.failed", "Sammu salvestamine ei õnnestunud. Proovi uuesti.")));
        return false;
      }
      onStepsChange(payload.steps || []);
      return true;
    } catch {
      setError(t("journey.own_steps.failed", "Sammu salvestamine ei õnnestunud. Proovi uuesti."));
      return false;
    } finally {
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
    if (await add({ title: form.title, doer: form.doer, dueOn: form.dueOn || null })) {
      setForm(EMPTY_FORM);
      setAdding(false);
    }
  };

  const submitPanel = async (event) => {
    event.preventDefault();
    if (!panel) return;
    const body =
      panel.mode === "close"
        ? { state: panel.state, note: panel.note }
        : { title: panel.title, doer: panel.doer, dueOn: panel.dueOn || null, note: panel.note };
    if (await send(`${base}/${encodeURIComponent(panel.id)}`, "PATCH", body)) setPanel(null);
  };

  const today = todayInEstonia(new Date());
  const taken = new Set(steps.map((step) => step.title.trim().toLocaleLowerCase("et")));
  const suggestions = (Array.isArray(journey?.suggestedActions) ? journey.suggestedActions : [])
    .map((item) => (typeof item === "string" ? item : item?.title || "").trim())
    .filter((title) => title && title.length <= JOURNEY_STEP_LIMITS.title && !taken.has(title.toLocaleLowerCase("et")));

  const meta = (step) =>
    [
      step.doer ? t("journey.own_steps.doer_value", { name: step.doer }, "Teeb: {name}") : "",
      step.dueOn ? t("journey.own_steps.due_value", { date: dayLabel(step.dueOn) }, "Tähtaeg: {date}") : "",
      step.state === JourneyStepState.TODO && step.dueOn && step.dueOn < today ? t("journey.own_steps.overdue", "tähtaeg on möödas") : ""
    ]
      .filter(Boolean)
      .join(" · ");

  const fields = (value, change, idPrefix, { withNote = false } = {}) => (
    <>
      <div>
        <label htmlFor={`${idPrefix}-title`}>{t("journey.own_steps.title_label", "Mida on vaja teha")}</label>
        <Input
          id={`${idPrefix}-title`}
          value={value.title}
          onChange={(event) => change({ ...value, title: event.target.value })}
          maxLength={JOURNEY_STEP_LIMITS.title}
          required
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-doer`}>{t("journey.own_steps.doer_label", "Kes teeb (võid jätta tühjaks)")}</label>
        <Input
          id={`${idPrefix}-doer`}
          value={value.doer || ""}
          onChange={(event) => change({ ...value, doer: event.target.value })}
          maxLength={JOURNEY_STEP_LIMITS.doer}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-due`}>{t("journey.own_steps.due_label", "Mis ajaks (võid jätta tühjaks)")}</label>
        <input
          id={`${idPrefix}-due`}
          type="date"
          value={value.dueOn || ""}
          onChange={(event) => change({ ...value, dueOn: event.target.value })}
        />
      </div>
      {withNote ? (
        <div>
          <label htmlFor={`${idPrefix}-note`}>{t("journey.own_steps.note_label", "Märkus (võid jätta tühjaks)")}</label>
          <textarea
            id={`${idPrefix}-note`}
            value={value.note || ""}
            onChange={(event) => change({ ...value, note: event.target.value })}
            maxLength={JOURNEY_STEP_LIMITS.note}
          />
        </div>
      ) : null}
    </>
  );

  return (
    <section id="teekond-sammud" aria-busy={busy}>
      <h2>{t("journey.own_steps.title", "Järgmised sammud")}</h2>
      <p>{t("journey.own_steps.intro", "Pane kirja, mida on vaja teha, kes seda teeb ja mis ajaks. Sammud on ainult sinu näha.")}</p>

      {error ? <p role="alert">{error}</p> : null}

      {open.length === 0 ? (
        <p>{t("journey.own_steps.empty", "Ühtegi tegemata sammu ei ole kirjas.")}</p>
      ) : (
        <ol aria-label={t("journey.own_steps.open_list", "Tegemata sammud")}>
          {open.map((step) => (
            <li key={step.id}>
              <p>
                <strong>{step.title}</strong>
              </p>
              {meta(step) ? <p>{meta(step)}</p> : null}
              {step.note ? <p>{step.note}</p> : null}

              {panel?.id === step.id && panel.mode === "close" ? (
                <Form onSubmit={submitPanel}>
                  <label htmlFor={`step-${step.id}-what`}>
                    {t("journey.own_steps.what_happened", "Mis juhtus? (võid jätta tühjaks)")}
                  </label>
                  <textarea
                    id={`step-${step.id}-what`}
                    value={panel.note || ""}
                    onChange={(event) => setPanel({ ...panel, note: event.target.value })}
                    maxLength={JOURNEY_STEP_LIMITS.note}
                  />
                  <div>
                    <Button type="submit" disabled={busy}>
                      {panel.state === JourneyStepState.DONE
                        ? t("journey.own_steps.confirm_done", "Märgi tehtuks")
                        : t("journey.own_steps.confirm_dropped", "Jäta samm ära")}
                    </Button>
                    <Button type="button" variant="linkBrand" onClick={() => setPanel(null)} disabled={busy}>
                      {t("journey.actions.decline", "Loobu")}
                    </Button>
                  </div>
                </Form>
              ) : null}

              {panel?.id === step.id && panel.mode === "edit" ? (
                <Form onSubmit={submitPanel}>
                  {fields(panel, setPanel, `step-${step.id}`, { withNote: true })}
                  <div>
                    <Button type="submit" disabled={busy}>
                      {t("journey.own_steps.save", "Salvesta samm")}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={busy}
                      onClick={async () => {
                        if (await send(`${base}/${encodeURIComponent(step.id)}`, "DELETE")) setPanel(null);
                      }}
                    >
                      {t("journey.own_steps.delete", "Kustuta samm")}
                    </Button>
                    <Button type="button" variant="linkBrand" onClick={() => setPanel(null)} disabled={busy}>
                      {t("journey.actions.decline", "Loobu")}
                    </Button>
                  </div>
                </Form>
              ) : null}

              {!archived && panel?.id !== step.id ? (
                <div>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={busy}
                    onClick={() => setPanel({ id: step.id, mode: "close", state: JourneyStepState.DONE, note: step.note || "" })}
                  >
                    {t("journey.own_steps.done", "Tehtud")}
                  </Button>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => setPanel({ id: step.id, mode: "close", state: JourneyStepState.DROPPED, note: step.note || "" })}
                  >
                    {t("journey.own_steps.drop", "Jätan ära")}
                  </Button>
                  <Button
                    type="button"
                    variant="linkBrand"
                    disabled={busy}
                    onClick={() =>
                      setPanel({ id: step.id, mode: "edit", title: step.title, doer: step.doer || "", dueOn: step.dueOn || "", note: step.note || "" })
                    }
                  >
                    {t("journey.own_steps.edit", "Muuda")}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {!archived ? (
        adding ? (
          <Form onSubmit={submitNew}>
            {fields(form, setForm, "step-new")}
            <div>
              <Button type="submit" disabled={busy}>
                {t("journey.own_steps.add", "Lisa samm")}
              </Button>
              <Button
                type="button"
                variant="linkBrand"
                disabled={busy}
                onClick={() => {
                  setAdding(false);
                  setForm(EMPTY_FORM);
                }}
              >
                {t("journey.actions.decline", "Loobu")}
              </Button>
            </div>
          </Form>
        ) : (
          <div>
            <Button type="button" variant="primary" disabled={busy} onClick={() => setAdding(true)}>
              {t("journey.own_steps.add", "Lisa samm")}
            </Button>
          </div>
        )
      ) : (
        <p>{t("journey.own_steps.archived", "Arhiveeritud Teekonna samme saab vaadata, mitte muuta.")}</p>
      )}

      {!archived && suggestions.length ? (
        <div>
          <h3>{t("journey.own_steps.suggested_title", "Platvormi pakutud sammud")}</h3>
          <p>{t("journey.own_steps.suggested_hint", "Need on ettepanekud. Sammuks saab ettepanek alles siis, kui sa selle võtad.")}</p>
          <ul>
            {suggestions.map((title) => (
              <li key={title}>
                <span>{title}</span>{" "}
                <Button type="button" variant="linkBrand" disabled={busy} onClick={() => add({ title })}>
                  {t("journey.own_steps.take", "Võta sammuks")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {closed.length ? (
        <details>
          <summary>{t("journey.own_steps.closed_title", { count: closed.length }, "Lõpetatud sammud ({count})")}</summary>
          <ul>
            {closed.map((step) => (
              <li key={step.id}>
                <p>
                  <strong>{step.title}</strong>
                </p>
                <p>
                  {[
                    t(`journey.own_steps.states.${step.state}`, step.state),
                    step.doneAt ? dayLabel(todayInEstonia(new Date(step.doneAt))) : "",
                    step.doer ? t("journey.own_steps.doer_value", { name: step.doer }, "Teeb: {name}") : ""
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {step.note ? <p>{step.note}</p> : null}
                {!archived ? (
                  <Button
                    type="button"
                    variant="linkBrand"
                    disabled={busy}
                    onClick={() => send(`${base}/${encodeURIComponent(step.id)}`, "PATCH", { state: JourneyStepState.TODO })}
                  >
                    {t("journey.own_steps.reopen", "Ava uuesti")}
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
