"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { newClientActionKey } from "@/components/casework/caseWorkClient";
import { useI18n } from "@/components/i18n/I18nProvider";
import { CareEntryKind, CareIncidentType, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";
import { composeNoAnswerText } from "@/lib/homeCare/noAnswerText";
import { OUTBOX_LIMIT, isUnreachable } from "@/lib/homeCare/outbox";

import { formatTime, homeCareBase, useHomeCareApi } from "../homeCareClient";
import { getOutboxManager } from "../homeCareOutbox";

const SAVE_TIMEOUT_MS = 25_000;

/**
 * „Kui uks ei avane" (K4-f): olek ja päringud. Vaated on failis
 * ./NoAnswerViews.jsx, kokku paneb need ./ClientNoAnswer.jsx.
 *
 * Kliendiga ette kokku lepitud sammud ja nupp „Ei saa sisse". Ukse taga puudutab
 * hooldaja samme, mille ta tegi; igale puudutusele jääb kellaaeg ja kirjutama ei
 * pea midagi. Salvestamisel saab neist erijuhtumi kirje (liik „uks ei avanenud")
 * tavalise kirje teed pidi: hooldusjuht saab teate ja kui server ei vasta, läheb
 * kirje seadme järjekorda nagu iga teine.
 *
 * Sammude loendit muudavad meeskond ja hooldusjuht: iga samm eraldi real.
 */
export function useNoAnswer({ organizationId, clientId, clientName = "", viewerMembershipId = null, timeZone, initial = [], onSaved }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const attemptRef = useRef(null);
  const queuedRef = useRef("");
  const device = useMemo(() => getOutboxManager(viewerMembershipId), [viewerMembershipId]);

  const [steps, setSteps] = useState(initial || []);
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

  /* Märgitud sammud ja märkus kaovad (loobumine või salvestatud kirje). */
  const close = () => {
    attemptRef.current = null;
    setTaps({});
    setNote("");
  };

  const startEdit = () => {
    setDraft(steps.map((step) => step.text).join("\n"));
    setError("");
    setDone("");
  };

  const saveSteps = async () => {
    const result = await call(`${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/uksesammud`, {
      method: "PUT",
      body: { steps: draft.split("\n") },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setSteps(result.data.doorSteps || []);
    return true;
  };

  const startRun = () => {
    attemptRef.current = null;
    setTaps({});
    setNote("");
    setError("");
    setDone("");
  };

  /* Puudutus paneb sammule praeguse kellaaja asutuse ajavööndis; teine puudutus võtab selle ära. */
  const tap = (step) =>
    setTaps((previous) => {
      const next = { ...previous };
      if (next[step.id]) delete next[step.id];
      else next[step.id] = formatTime(new Date().toISOString(), timeZone);
      return next;
    });

  /* Tagastab true, kui kirje on salvestatud või seadme järjekorras (märkimine on lõppenud), muidu false (tõrge jääb vaatesse). */
  const record = async () => {
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
        return true;
      }
      if (!device || !isUnreachable(result.status)) return false;
      const outcome = await device.enqueue({ organizationId, clientId, clientName, body });
      if (outcome.ok) {
        setError("");
        queuedRef.current = body.clientRequestId;
        close();
        setDone("queued");
        return true;
      }
      if (outcome.reason === "full") setError(t("home_care.outbox.full", { limit: OUTBOX_LIMIT }));
      return false;
    } finally {
      setSending(false);
    }
  };

  return { steps, draft, setDraft, taps, tap, note, setNote, done, sending, startEdit, saveSteps, startRun, record, close, busy, error, setError };
}
