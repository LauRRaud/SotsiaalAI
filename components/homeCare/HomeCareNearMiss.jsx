"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { newClientActionKey } from "@/components/casework/caseWorkClient";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { CARE_NEAR_MISS_KINDS, CareEntryKind, CareIncidentType, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";
import { composeNearMissText } from "@/lib/homeCare/nearMissText";
import { OUTBOX_LIMIT, isUnreachable } from "@/lib/homeCare/outbox";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";
import { getOutboxManager } from "./homeCareOutbox";

const SAVE_TIMEOUT_MS = 25_000;

/**
 * „Peaaegu juhtus" (K5-h, kava II.6.4): hooldaja märgib kahe puudutusega olukorra, kus
 * midagi oleks võinud juhtuda (libisesin trepil, koer ründas). Omaette väike vaade.
 *
 * Sellest saab erijuhtumi kirje (liik „peaaegu juhtus") tavalise kirje teed pidi:
 * hooldusjuht saab teate ja kui server ei vasta, läheb kirje seadme järjekorda nagu iga
 * teine. Pärast salvestamist tuletatakse meelde lisada oht püsikaardile, kui see võib
 * korduda.
 *
 * `back`: { label, onBack } viib tagasi sinna, kust tuldi (uue kirje esimene samm).
 */
export default function HomeCareNearMiss({ organizationId, clientId, clientName = "", viewerMembershipId = null, onSaved, title, back }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const attemptRef = useRef(null);
  const queuedRef = useRef("");
  const device = useMemo(() => getOutboxManager(viewerMembershipId), [viewerMembershipId]);

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

  const reset = () => {
    attemptRef.current = null;
    setKind("");
    setNote("");
  };

  const record = async () => {
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

  /* Märge läks teele: üks lause (ja meeldetuletus püsikaardi kohta) ning tee tagasi. */
  if (done) {
    return (
      <StepPanel
        title={title}
        question={done === "queued" ? t("home_care.entry.queued") : t("home_care.near_miss.recorded")}
        actions={
          <Button type="button" size="sm" variant="primary" data-back="1" onClick={leave}>
            {back.label}
          </Button>
        }
      />
    );
  }

  return (
    <StepPanel
      title={title}
      note={footNote(error ? { text: error, tone: "risk" } : null, t("home_care.near_miss.hint"))}
      actions={
        <>
          <Button {...SMALL} data-back="1" onClick={leave} disabled={sending}>
            {t("home_care.near_miss.cancel")}
          </Button>
          <Button type="button" size="sm" variant="primary" data-near-miss="save" disabled={!kind} aria-busy={busy || sending ? "true" : undefined} onClick={record}>
            {t("home_care.near_miss.save")}
          </Button>
        </>
      }
    >
      <div className={shared.stack} inert={sending} aria-busy={sending ? "true" : undefined}>
        <ChoiceRow
          label={t("home_care.near_miss.kind_label")}
          options={CARE_NEAR_MISS_KINDS.map((value) => ({ value, label: t(`home_care.near_miss.kinds.${value}`) }))}
          value={kind}
          onChange={setKind}
          columns={2}
        />
        <label className={shared.line} htmlFor={`${fieldId}-note`}>
          <span className={shared.fieldLabel}>{t("home_care.near_miss.note_label")}</span>
          <Input id={`${fieldId}-note`} className={shared.input} value={note} onChange={(event) => setNote(event.target.value)} maxLength={HOME_CARE_LIMITS.NEAR_MISS_NOTE_MAX} autoComplete="off" />
        </label>
      </div>
    </StepPanel>
  );
}
