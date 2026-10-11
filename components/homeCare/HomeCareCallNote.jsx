"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { newClientActionKey } from "@/components/casework/caseWorkClient";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  CARE_CALL_CALLERS,
  CARE_CALL_TOPICS,
  CareCallCaller,
  CareContactMode,
  CareEntryKind,
  HOME_CARE_LIMITS
} from "@/lib/homeCare/constants";
import { OUTBOX_LIMIT, isUnreachable } from "@/lib/homeCare/outbox";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";
import { getOutboxManager } from "./homeCareOutbox";

const SAVE_TIMEOUT_MS = 25_000;

/**
 * Kõnemärge: klient või lähedane helistas.
 *
 * Kaks puudutust: mille pärast helistati ja „Salvesta". Helistajaks on vaikimisi
 * lähedane, sest enamik kõnesid tuleb neilt. Selgitus on valikuline: kui seda ei
 * kirjutata, pannakse kirje tekstiks valitud helistaja ja teema.
 *
 * Kõnemärge on päeviku kirje (kontakti viis „telefon") ja käitub nagu iga teine:
 * meeskond näeb seda, otsing leiab ja kui server ei vasta, läheb see seadme
 * järjekorda. Hooldusjuhi loendur loeb neid kuu kaupa.
 */
export default function HomeCareCallNote({ organizationId, clientId, clientName = "", viewerMembershipId = null, onSaved }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const attemptRef = useRef(null);
  const device = useMemo(() => getOutboxManager(viewerMembershipId), [viewerMembershipId]);

  const [open, setOpen] = useState(false);
  const [caller, setCaller] = useState(CareCallCaller.RELATIVE);
  const [topic, setTopic] = useState("");
  const [note, setNote] = useState("");
  /* "" | "saved" | "queued" */
  const [done, setDone] = useState("");
  const [sending, setSending] = useState(false);
  /* Ootele jäänud kõnemärke võti: kui seade selle ära saadab, ei tohi teade
     „ootel" ekraanile jääda. */
  const queuedRef = useRef("");

  useEffect(() => {
    if (!device) return undefined;
    return device.onSent((entry, item) => {
      if (!queuedRef.current || item?.clientRequestId !== queuedRef.current) return;
      queuedRef.current = "";
      setDone((current) => (current === "queued" ? "saved" : current));
    });
  }, [device]);

  const reset = () => {
    attemptRef.current = null;
    setCaller(CareCallCaller.RELATIVE);
    setTopic("");
    setNote("");
    setOpen(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (sending || !topic) return;
    setSending(true);
    setDone("");
    try {
      const typed = note.trim();
      const text = typed || `${t(`home_care.call.auto.caller.${caller}`)} ${t(`home_care.call.auto.topic.${topic}`)}`;
      /* Sama sisu uuesti saates jääb võti samaks: server tunneb korduse ära. */
      const signature = JSON.stringify([caller, topic, text]);
      if (attemptRef.current?.signature !== signature) {
        attemptRef.current = {
          signature,
          body: {
            kind: CareEntryKind.NOTE,
            contactMode: CareContactMode.PHONE,
            callCaller: caller,
            callTopic: topic,
            text,
            deviceCreatedAt: new Date().toISOString(),
            clientRequestId: newClientActionKey()
          }
        };
      }
      const body = attemptRef.current.body;
      const result = await call(`${homeCareBase(organizationId)}/kliendid/${clientId}/kirjed`, {
        method: "POST",
        body,
        fallbackKey: "home_care.errors.save_failed",
        timeoutMs: SAVE_TIMEOUT_MS
      });
      if (result.ok) {
        onSaved?.(result.data.entry);
        reset();
        setDone("saved");
        return;
      }
      if (!device || !isUnreachable(result.status)) return;
      const outcome = await device.enqueue({ organizationId, clientId, clientName, body });
      if (outcome.ok) {
        setError("");
        queuedRef.current = body.clientRequestId;
        reset();
        setDone("queued");
      } else if (outcome.reason === "full") {
        setError(t("home_care.outbox.full", { limit: OUTBOX_LIMIT }));
      }
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <div className="hc-field">
        <div className="hc-row">
          <button
            className="hc-btn hc-btn--quiet"
            type="button"
            onClick={() => {
              setDone("");
              setOpen(true);
            }}
          >
            {t("home_care.call.open")}
          </button>
        </div>
        {done ? (
          <p className="hc-ok" role="status">
            {done === "queued" ? t("home_care.entry.queued") : t("home_care.call.saved")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form className="hc-form" onSubmit={submit} inert={sending} aria-busy={sending}>
      <div className="hc-field">
        <span className="hc-label" id={`${fieldId}-caller`}>
          {t("home_care.call.caller_label")}
        </span>
        <div className="hc-chips" role="group" aria-labelledby={`${fieldId}-caller`}>
          {CARE_CALL_CALLERS.map((value) => (
            <button key={value} type="button" className="hc-chip" aria-pressed={caller === value} onClick={() => setCaller(value)}>
              {t(`home_care.call.callers.${value}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="hc-field">
        <span className="hc-label" id={`${fieldId}-topic`}>
          {t("home_care.call.topic_label")}
        </span>
        <div className="hc-chips" role="group" aria-labelledby={`${fieldId}-topic`}>
          {CARE_CALL_TOPICS.map((value) => (
            <button key={value} type="button" className="hc-chip" aria-pressed={topic === value} onClick={() => setTopic(value)}>
              {t(`home_care.call.topics.${value}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-note`}>
          {t("home_care.call.note_label")}
        </label>
        <textarea
          id={`${fieldId}-note`}
          className="hc-textarea hc-textarea--short"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={HOME_CARE_LIMITS.ENTRY_TEXT_MAX}
          rows={2}
        />
        <p className="hc-hint">{t("home_care.call.note_hint")}</p>
      </div>
      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="hc-row">
        <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || sending || !topic}>
          {t("home_care.call.save")}
        </button>
        <button className="hc-btn" type="button" onClick={reset} disabled={busy || sending}>
          {t("home_care.entry.cancel")}
        </button>
      </div>
    </form>
  );
}
