"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { newClientActionKey } from "@/components/casework/caseWorkClient";
import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_NEAR_MISS_KINDS, CareEntryKind, CareIncidentType, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";
import { composeNearMissText } from "@/lib/homeCare/nearMissText";
import { OUTBOX_LIMIT, isUnreachable } from "@/lib/homeCare/outbox";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";
import { getOutboxManager } from "./homeCareOutbox";

const SAVE_TIMEOUT_MS = 25_000;

/**
 * „Peaaegu juhtus" (K5-h, kava II.6.4): hooldaja märgib kahe puudutusega olukorra, kus
 * midagi oleks võinud juhtuda (libisesin trepil, koer ründas). Sellest saab erijuhtumi
 * kirje (liik „peaaegu juhtus") tavalise kirje teed pidi: hooldusjuht saab teate ja kui
 * server ei vasta, läheb kirje seadme järjekorda nagu iga teine. Pärast salvestamist
 * tuletatakse meelde lisada oht püsikaardile, kui see võib korduda.
 */
export default function HomeCareNearMiss({ organizationId, clientId, clientName = "", viewerMembershipId = null, onSaved }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const attemptRef = useRef(null);
  const queuedRef = useRef("");
  const device = useMemo(() => getOutboxManager(viewerMembershipId), [viewerMembershipId]);

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("");
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

  const start = () => {
    attemptRef.current = null;
    setKind("");
    setNote("");
    setError("");
    setDone("");
    setOpen(true);
  };

  const close = () => {
    attemptRef.current = null;
    setOpen(false);
  };

  const record = async (event) => {
    event.preventDefault();
    if (sending || !kind) return;
    setSending(true);
    try {
      const text = composeNearMissText(t, kind, note).slice(0, HOME_CARE_LIMITS.ENTRY_TEXT_MAX);
      /* Sama sisu uuesti saates jääb võti samaks: server tunneb korduse ära. */
      if (attemptRef.current?.signature !== text) {
        attemptRef.current = {
          signature: text,
          body: {
            kind: CareEntryKind.INCIDENT,
            incidentType: CareIncidentType.NEAR_MISS,
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

  if (!open) {
    return (
      <div className="hc-row">
        <button className="hc-btn hc-btn--quiet" type="button" onClick={start} disabled={busy}>
          {t("home_care.near_miss.start")}
        </button>
        {done ? (
          <p className="hc-ok" role="status">
            {done === "queued" ? t("home_care.entry.queued") : t("home_care.near_miss.recorded")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form className="hc-form" onSubmit={record} aria-busy={sending} inert={sending}>
      <div className="hc-field">
        <span className="hc-label">{t("home_care.near_miss.kind_label")}</span>
        <div className="hc-chips" role="group" aria-label={t("home_care.near_miss.kind_label")}>
          {CARE_NEAR_MISS_KINDS.map((value) => (
            <button key={value} type="button" className="hc-chip" aria-pressed={kind === value} onClick={() => setKind(value)}>
              {t(`home_care.near_miss.kinds.${value}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-note`}>
          {t("home_care.near_miss.note_label")}
        </label>
        <input
          id={`${fieldId}-note`}
          className="hc-input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={HOME_CARE_LIMITS.NEAR_MISS_NOTE_MAX}
          autoComplete="off"
        />
      </div>
      <p className="hc-hint">{t("home_care.near_miss.hint")}</p>
      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="hc-row">
        <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || sending || !kind}>
          {t("home_care.near_miss.save")}
        </button>
        <button className="hc-btn hc-btn--quiet" type="button" onClick={close} disabled={sending}>
          {t("home_care.near_miss.cancel")}
        </button>
      </div>
    </form>
  );
}
