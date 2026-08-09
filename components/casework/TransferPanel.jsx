"use client";

/**
 * JTA-V1 (E6) — „Kopeeri STAR2 jaoks" ja ülekandeajalugu.
 *
 * L16 JÄRJEKORD ELAB `transferFlow.js`-is, mitte siin, ja see on tahtlik: ainus
 * koht, kus on teada, kas lõikelauale kirjutus õnnestus, on brauser — aga
 * JSX-failis ei saaks seda otsust ühegi testiga tõendada. Siin on ainult see,
 * mis on päriselt liides: nupud, teated ja olek.
 *
 * KAKS TÕRGET SAAVAD ERI TEATE ja teine neist on tahtlikult ebamugav:
 *
 *   lõikelaud ei võtnud vastu   → „ei õnnestunud kopeerida" + plokk kuvatakse,
 *                                 et inimene saaks ta ise valida
 *   lõikelaud võttis, audit ei  → „kopeeritud, AGA jälge ei salvestatud"
 *
 * L8 järgi on audit tõend, ja vaikne tõendi kadu on halvem kui nähtav.
 */

import { useCallback, useEffect, useState } from "react";

import ConfirmButton from "./ConfirmButton";
import { caseWorkRequest, newClientActionKey } from "./caseWorkClient";
import { COPY_PHASE, flushPendingAudits, queuePendingAudit, runCopyForStar2 } from "./transferFlow";

const HISTORY_PAGE_SIZE = 25;

async function writeClipboard(text) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function TransferActions({ caseId, draft, locale, disabled, t, onChanged }) {
  const [phase, setPhase] = useState(null);
  const [block, setBlock] = useState(null);
  const [errorKey, setErrorKey] = useState(null);
  const [busy, setBusy] = useState(false);
  /* Ootel auditid HOIAVAD OMA VÕTIT (L22) — „proovi uuesti" ei tohi teha uut.
     JÄRJEKORD, mitte üks pesa (SOL-CW-05): uus kopeerimine ei tohi eelmise
     kirjutamata jälge üle kirjutada, sest mõlemad teod toimusid päriselt. */
  const [pendingAudits, setPendingAudits] = useState([]);

  const postCopyEvent = useCallback(
    ({ fieldKeys, clientActionId }) =>
      caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/drafts/${encodeURIComponent(draft.id)}/copy-events`, {
        method: "POST",
        locale,
        body: { fieldKeys, clientActionId }
      }),
    [caseId, draft.id, locale]
  );

  /** Korduskatse SAMA võtmetega (L22) — uus võti oleks andmebaasi jaoks teine tegu. */
  const retryAudit = useCallback(async () => {
    if (!pendingAudits.length) return;
    setBusy(true);
    try {
      const { remaining, flushed, errorKey: failureKey } = await flushPendingAudits(pendingAudits, postCopyEvent);
      setPendingAudits(remaining);
      setErrorKey(remaining.length ? failureKey : null);
      if (!remaining.length) setPhase(COPY_PHASE.COPIED);
      if (flushed > 0) onChanged?.();
    } finally {
      setBusy(false);
    }
  }, [onChanged, pendingAudits, postCopyEvent]);

  const copyForStar2 = useCallback(async () => {
    setBusy(true);
    setErrorKey(null);
    setBlock(null);
    try {
      const result = await runCopyForStar2({
        createActionKey: newClientActionKey,
        loadBlock: async () => {
          const body = await caseWorkRequest(
            `/cases/${encodeURIComponent(caseId)}/drafts/${encodeURIComponent(draft.id)}/star2-block`,
            { locale }
          );
          return body?.block || null;
        },
        writeClipboard,
        recordCopy: postCopyEvent
      });

      setPhase(result.phase);
      setBlock(result.block);
      setErrorKey(result.errorKey);
      /* LISAB, ei asenda: eelmise kopeerimise kirjutamata jälg jääb alles. */
      setPendingAudits((queue) => queuePendingAudit(queue, result.pendingAudit));
      if (result.phase === COPY_PHASE.COPIED) onChanged?.();
    } finally {
      setBusy(false);
    }
  }, [caseId, draft.id, locale, onChanged, postCopyEvent]);

  const markTransferred = useCallback(async () => {
    setBusy(true);
    setErrorKey(null);
    try {
      await caseWorkRequest(
        `/cases/${encodeURIComponent(caseId)}/drafts/${encodeURIComponent(draft.id)}/mark-transferred`,
        {
          method: "POST",
          locale,
          /* `expectedFrom` tuleb AVATUD elemendi seisust: vahepealne muutus annab
             ausa 409, mitte vaikse ülekirjutuse. */
          body: { expectedFrom: draft.transferState }
        }
      );
      setPhase(null);
      onChanged?.();
    } catch (error) {
      setErrorKey(error?.messageKey || "casework.errors.unexpected");
    } finally {
      setBusy(false);
    }
  }, [caseId, draft.id, draft.transferState, locale, onChanged]);

  const working = disabled || busy;
  const purged = Boolean(draft.contentPurgedAt);

  return (
    <div className="cw-transfer">
      <h4 className="cw-section-title">{t("casework.transfer.actions_title", "")}</h4>

      {purged ? <p className="cw-notice">{t("casework.transfer.content_purged", "")}</p> : null}

      <button className="cw-button" type="button" disabled={working || purged} onClick={copyForStar2}>
        {t("casework.transfer.copy", "")}
      </button>

      {/* „Märgi üle kantuks" on OMA TEGU (L9) ja ta ei sünni kopeerimisest.
          Ta on nähtav ainult `VALMIS_ULEKANDEKS` juures, sest ainult sealt viib
          olekumasinas tee edasi — ja ta on kaheastmeline, sest `ULE_KANTUD` on
          terminaalne ja käivitab säilituskella. */}
      {draft.transferState === "VALMIS_ULEKANDEKS" ? (
        <ConfirmButton
          className="cw-button"
          label={t("casework.transfer.mark_transferred", "")}
          confirmLabel={t("casework.transfer.confirm_mark_transferred", "")}
          cancelLabel={t("casework.transfer.cancel", "")}
          disabled={working}
          onConfirm={markTransferred}
        />
      ) : null}

      {phase === COPY_PHASE.COPIED && !pendingAudits.length ? (
        <p className="cw-notice">{t("casework.transfer.copy_ok", "")}</p>
      ) : null}

      {phase === COPY_PHASE.CLIPBOARD_FAILED ? (
        <div className="cw-transfer-fallback">
          <p className="cw-error" role="alert">
            {t("casework.transfer.copy_failed", "")}
          </p>
          {/* Tekst on TEKST: sisu tuleb `value`-na, mitte HTML-ina. */}
          <textarea className="cw-input" readOnly rows={8} value={block?.text || ""} />
        </div>
      ) : null}

      {/* Hoiatust juhib JÄRJEKORD, mitte viimane faas (SOL-CW-05): pärast uut
          õnnestunud kopeerimist läheb `phase` väärtusele `COPIED`, aga eelmise
          teo jälg on endiselt salvestamata ja seda ei tohi ekraanilt kaotada. */}
      {pendingAudits.length ? (
        <div className="cw-transfer-fallback">
          <p className="cw-error" role="alert">
            {t("casework.transfer.copy_audit_failed", "")}
            {pendingAudits.length > 1 ? ` (${pendingAudits.length})` : ""}
          </p>
          <button className="cw-button" type="button" disabled={working} onClick={retryAudit}>
            {t("casework.transfer.retry_audit", "")}
          </button>
        </div>
      ) : null}

      {errorKey && phase !== COPY_PHASE.CLIPBOARD_FAILED && !pendingAudits.length ? (
        <p className="cw-error" role="alert">
          {t(errorKey, "")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Juhtumi ülekandeajalugu.
 *
 * SISU SIIN EI OLE — read kannavad tegu, aega ja VÄLJADE VÕTMEID (L8).
 * Kopeeritud teksti auditis ei ole ja seepärast ei saa teda siit ka lugeda;
 * ajalugu on tõend selle kohta, MIS juhtus, mitte teine koopia sellest, MIDA
 * kopeeriti.
 */
export function TransferHistory({ caseId, locale, t, refreshToken }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [errorKey, setErrorKey] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async ({ next = null, append = false } = {}) => {
      setBusy(true);
      try {
        const params = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
        if (next) params.set("cursor", next);
        const body = await caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/transfer-events?${params.toString()}`,
          { locale }
        );
        setItems((previous) => (append ? [...previous, ...(body.items || [])] : body.items || []));
        setCursor(body.nextCursor || null);
        setErrorKey(null);
      } catch (error) {
        setErrorKey(error?.messageKey || "casework.errors.unexpected");
      } finally {
        setBusy(false);
      }
    },
    [caseId, locale]
  );

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  return (
    <div className="cw-transfer-history">
      <h4 className="cw-section-title">{t("casework.transfer.history_title", "")}</h4>
      <p className="cw-hint">{t("casework.transfer.history_hint", "")}</p>

      {errorKey ? (
        <p className="cw-error" role="alert">
          {t(errorKey, "")}
        </p>
      ) : null}

      {!items.length && !errorKey ? <p className="cw-empty">{t("casework.transfer.history_empty", "")}</p> : null}

      <ul className="cw-list">
        {items.map((event) => (
          <li className="cw-item" key={event.id}>
            <span className="cw-item-text">
              {t(`casework.transfer.kind_${event.kind}`, "")} — {t(`casework.draft.type_${event.draftType}`, "")}
            </span>
            <span className="cw-item-meta">
              <span className="cw-badge">
                {new Date(event.createdAt).toLocaleString(locale || "et", {
                  dateStyle: "short",
                  timeStyle: "short"
                })}
              </span>
              {event.fieldKeys?.length ? (
                <span className="cw-muted">
                  {t("casework.transfer.fields_label", "")}: {event.fieldKeys.join(", ")}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {cursor ? (
        <button className="cw-button" type="button" disabled={busy} onClick={() => load({ next: cursor, append: true })}>
          {t("casework.transfer.load_more", "")}
        </button>
      ) : null}
    </div>
  );
}
