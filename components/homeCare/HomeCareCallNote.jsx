"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { newClientActionKey } from "@/components/casework/caseWorkClient";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SMALL, footNote } from "@/components/org/OrgBits";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
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
 * Kõnemärge: klient või lähedane helistas. Omaette väike vaade.
 *
 * Kaks puudutust: mille pärast helistati ja „Salvesta". Helistajaks on vaikimisi
 * lähedane, sest enamik kõnesid tuleb neilt. Selgitus on valikuline: kui seda ei
 * kirjutata, pannakse kirje tekstiks valitud helistaja ja teema.
 *
 * Kõnemärge on päeviku kirje (kontakti viis „telefon") ja käitub nagu iga teine:
 * meeskond näeb seda, otsing leiab ja kui server ei vasta, läheb see seadme
 * järjekorda. Hooldusjuhi loendur loeb neid kuu kaupa.
 *
 * Vaade avaneb kahest kohast: kliendi lehel uue kirje esimesest sammust ja
 * koduteenuse avalehel otsingu tulemuse realt. `back`: { label, onBack } viib
 * tagasi sinna, kust tuldi; `more`: { label, onOpen } on tee edasi pärast
 * salvestamist (kliendi lehel päevikusse), kui see on olemas.
 */
export default function HomeCareCallNote({ organizationId, clientId, clientName = "", viewerMembershipId = null, onSaved, title, back, more = null }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const attemptRef = useRef(null);
  const device = useMemo(() => getOutboxManager(viewerMembershipId), [viewerMembershipId]);

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
  };

  const submit = async () => {
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

  const leave = () => {
    reset();
    setDone("");
    setError("");
    back.onBack();
  };

  /* Märge läks teele: üks lause ja tee tagasi (ja kliendi lehel päevikusse). */
  if (done) {
    return (
      <StepPanel
        title={title}
        question={done === "queued" ? t("home_care.entry.queued") : t("home_care.call.saved")}
        actions={
          <>
            {more && done === "saved" ? (
              <Button {...SMALL} data-call="more" onClick={more.onOpen}>
                {more.label}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="primary" data-back="1" onClick={leave}>
              {back.label}
            </Button>
          </>
        }
      />
    );
  }

  const option = (prefix) => (value) => ({ value, label: t(`${prefix}.${value}`) });
  return (
    <StepPanel
      title={title}
      question={clientName}
      note={footNote(error ? { text: error, tone: "risk" } : null)}
      actions={
        <>
          <Button {...SMALL} data-back="1" onClick={leave} disabled={sending}>
            {t("home_care.entry.cancel")}
          </Button>
          <Button type="button" size="sm" variant="primary" data-call="save" disabled={!topic} aria-busy={busy || sending ? "true" : undefined} onClick={submit}>
            {t("home_care.call.save")}
          </Button>
        </>
      }
    >
      <div inert={sending} aria-busy={sending ? "true" : undefined}>
        <ChoiceRow label={t("home_care.call.caller_label")} options={CARE_CALL_CALLERS.map(option("home_care.call.callers"))} value={caller} onChange={setCaller} columns={3} keepColumns />
        <ChoiceRow label={t("home_care.call.topic_label")} options={CARE_CALL_TOPICS.map(option("home_care.call.topics"))} value={topic} onChange={setTopic} columns={4} keepColumns />
        <TextAreaField label={t("home_care.call.note_label")} hint={t("home_care.call.note_hint")} value={note} onChange={setNote} rows={2} maxLength={HOME_CARE_LIMITS.ENTRY_TEXT_MAX} />
      </div>
    </StepPanel>
  );
}
