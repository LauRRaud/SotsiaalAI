"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { newClientActionKey } from "@/components/casework/caseWorkClient";
import { useI18n } from "@/components/i18n/I18nProvider";
import { CareEntryKind, CareIncidentType, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";
import { composeNoAnswerText } from "@/lib/homeCare/noAnswerText";
import { OUTBOX_LIMIT, isUnreachable } from "@/lib/homeCare/outbox";

import { formatTime, homeCareBase, useHomeCareApi } from "./homeCareClient";
import { getOutboxManager } from "./homeCareOutbox";

const SAVE_TIMEOUT_MS = 25_000;

/**
 * „Kui uks ei avane" (K4-f): kliendiga ette kokku lepitud sammud ja nupp „Ei saa sisse".
 *
 * Ukse taga puudutab hooldaja samme, mille ta tegi; igale puudutusele jääb kellaaeg ja
 * kirjutama ei pea midagi. Salvestamisel saab neist erijuhtumi kirje (liik „uks ei
 * avanenud") tavalise kirje teed pidi: hooldusjuht saab teate ja kui server ei vasta,
 * läheb kirje seadme järjekorda nagu iga teine.
 *
 * Sammude loendit muudavad meeskond ja hooldusjuht: iga samm eraldi real.
 */
export default function HomeCareNoAnswer({
  organizationId,
  clientId,
  clientName = "",
  viewerMembershipId = null,
  timeZone,
  initial = [],
  canEdit = false,
  canRecord = false,
  onSaved
}) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const attemptRef = useRef(null);
  const queuedRef = useRef("");
  const device = useMemo(() => getOutboxManager(viewerMembershipId), [viewerMembershipId]);

  const [steps, setSteps] = useState(initial || []);
  /* "" | "edit" | "run" */
  const [mode, setMode] = useState("");
  const [draft, setDraft] = useState("");
  const [taps, setTaps] = useState({});
  const [note, setNote] = useState("");
  /* "" | "saved" | "queued" */
  const [done, setDone] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!device) return undefined;
    return device.onSent((entry, item) => {
      if (!queuedRef.current || item?.clientRequestId !== queuedRef.current) return;
      queuedRef.current = "";
      setDone((current) => (current === "queued" ? "saved" : current));
    });
  }, [device]);

  const close = () => {
    attemptRef.current = null;
    setTaps({});
    setNote("");
    setMode("");
  };

  const startEdit = () => {
    setDraft(steps.map((step) => step.text).join("\n"));
    setError("");
    setDone("");
    setMode("edit");
  };

  const saveSteps = async (event) => {
    event.preventDefault();
    const result = await call(`${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/uksesammud`, {
      method: "PUT",
      body: { steps: draft.split("\n") },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setSteps(result.data.doorSteps || []);
    setMode("");
  };

  const startRun = () => {
    attemptRef.current = null;
    setTaps({});
    setNote("");
    setError("");
    setDone("");
    setMode("run");
  };

  /* Puudutus paneb sammule praeguse kellaaja asutuse ajavööndis; teine puudutus võtab selle ära. */
  const tap = (step) =>
    setTaps((previous) => {
      const next = { ...previous };
      if (next[step.id]) delete next[step.id];
      else next[step.id] = formatTime(new Date().toISOString(), timeZone);
      return next;
    });

  const record = async (event) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const text = composeNoAnswerText(t, steps, taps, note).slice(0, HOME_CARE_LIMITS.ENTRY_TEXT_MAX);
      /* Sama sisu uuesti saates jääb võti samaks: server tunneb korduse ära. */
      if (attemptRef.current?.signature !== text) {
        attemptRef.current = {
          signature: text,
          body: {
            kind: CareEntryKind.INCIDENT,
            incidentType: CareIncidentType.DOOR_NOT_OPENED,
            text,
            deviceCreatedAt: new Date().toISOString(),
            clientRequestId: newClientActionKey()
          }
        };
      }
      const body = attemptRef.current.body;
      const result = await call(`${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/kirjed`, {
        method: "POST",
        body,
        fallbackKey: "home_care.errors.save_failed",
        timeoutMs: SAVE_TIMEOUT_MS
      });
      if (result.ok) {
        onSaved?.(result.data.entry);
        close();
        setDone("saved");
        return;
      }
      if (!device || !isUnreachable(result.status)) return;
      const outcome = await device.enqueue({ organizationId, clientId, clientName, body });
      if (outcome.ok) {
        setError("");
        queuedRef.current = body.clientRequestId;
        close();
        setDone("queued");
      } else if (outcome.reason === "full") {
        setError(t("home_care.outbox.full", { limit: OUTBOX_LIMIT }));
      }
    } finally {
      setSending(false);
    }
  };

  if (!steps.length && !canEdit && !canRecord) return null;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.no_answer.title")}
      </h2>

      {mode === "" ? (
        <>
          {steps.length ? (
            <ol className="hc-list hc-list--plain">
              {steps.map((step) => (
                <li key={step.id}>
                  {step.position}. {step.text}
                </li>
              ))}
            </ol>
          ) : (
            <p className="hc-hint">{t("home_care.no_answer.none")}</p>
          )}
          {done ? (
            <p className="hc-ok" role="status">
              {done === "queued" ? t("home_care.entry.queued") : t("home_care.no_answer.recorded")}
            </p>
          ) : null}
          <div className="hc-row">
            {canRecord ? (
              <button className="hc-btn" type="button" onClick={startRun} disabled={busy}>
                {t("home_care.no_answer.start")}
              </button>
            ) : null}
            {canEdit ? (
              <button className="hc-btn hc-btn--quiet" type="button" onClick={startEdit} disabled={busy}>
                {t(steps.length ? "home_care.no_answer.edit" : "home_care.no_answer.add")}
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {mode === "edit" ? (
        <form className="hc-form" onSubmit={saveSteps} aria-busy={busy}>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-steps`}>
              {t("home_care.no_answer.steps_label")}
            </label>
            <textarea
              id={`${fieldId}-steps`}
              className="hc-textarea"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={6}
              maxLength={HOME_CARE_LIMITS.DOOR_STEPS_MAX * (HOME_CARE_LIMITS.DOOR_STEP_TEXT_MAX + 1)}
            />
            <p className="hc-hint">{t("home_care.no_answer.steps_hint", { limit: HOME_CARE_LIMITS.DOOR_STEPS_MAX })}</p>
          </div>
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy}>
              {t("home_care.no_answer.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setMode("")} disabled={busy}>
              {t("home_care.no_answer.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {mode === "run" ? (
        <form className="hc-form" onSubmit={record} inert={sending} aria-busy={sending}>
          <p className="hc-notice hc-notice--warn">
            {t("home_care.no_answer.emergency")}{" "}
            <a className="hc-entry__link" href="tel:112">
              {t("home_care.no_answer.call_112")}
            </a>
          </p>
          <p className="hc-hint">{steps.length ? t("home_care.no_answer.run_hint") : t("home_care.no_answer.text_no_steps")}</p>
          {steps.length ? (
            <div className="hc-field" role="group" aria-label={t("home_care.no_answer.title")}>
              {steps.map((step) => (
                <button key={step.id} type="button" className="hc-chip" aria-pressed={Boolean(taps[step.id])} onClick={() => tap(step)}>
                  {step.position}. {step.text}
                  {taps[step.id] ? ` · ${t("home_care.no_answer.done_at", { time: taps[step.id] })}` : ""}
                </button>
              ))}
            </div>
          ) : null}
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-note`}>
              {t("home_care.no_answer.note_label")}
            </label>
            <textarea
              id={`${fieldId}-note`}
              className="hc-textarea hc-textarea--short"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || sending}>
              {t("home_care.no_answer.record")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={close} disabled={busy || sending}>
              {t("home_care.no_answer.cancel")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
