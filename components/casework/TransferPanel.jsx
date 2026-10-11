"use client";

/**
 * JTA-V1 (E6) — „Kopeeri STAR2 jaoks" ja ülekandeajalugu.
 *
 * L16 JÄRJEKORD ELAB `transferFlow.js`-is, mitte siin, ja see on tahtlik: ainus
 * koht, kus on teada, kas lõikelauale kirjutus õnnestus, on brauser — aga
 * JSX-failis ei saaks seda otsust ühegi testiga tõendada. Siin on päringud ja
 * olek; nupud ja teated joonistab ./sections/DraftViews.jsx.
 *
 * KAKS TÕRGET SAAVAD ERI TEATE ja teine neist on tahtlikult ebamugav:
 *
 *   lõikelaud ei võtnud vastu   → „ei õnnestunud kopeerida" + plokk kuvatakse,
 *                                 et inimene saaks ta ise valida
 *   lõikelaud võttis, audit ei  → „kopeeritud, AGA jälge ei salvestatud"
 *
 * L8 järgi on audit tõend, ja vaikne tõendi kadu on halvem kui nähtav.
 *
 * KUJU (09.10). Ülekandeteod olid avatud elemendi lõpus oma paneelina; nüüd on
 * need elemendi üks vaade („STAR2-sse viimine") ja ajalugu on juhtumi lava oma
 * osa. Teod elavad konksus (`useTransferActions`), mitte vaates: vaade vahetub
 * saki vahetusega, aga kopeerimise seis ei tohi sellega kaduda.
 */

import { useCallback, useMemo, useRef, useState } from "react";

import { caseWorkRequest, newClientActionKey } from "./caseWorkClient";
import { TransferHistoryView } from "./sections/DraftViews";
import { transferRows } from "./sections/sectionRows";
import { useCaseList, useSectionRun } from "./sections/useSectionData";
import { COPY_PHASE, flushPendingAudits, queuePendingAudit, runCopyForStar2 } from "./transferFlow";

async function writeClipboard(text) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Avatud elemendi ülekandeteod: kopeerimine, jälje korduskatse ja ülekantuks
 * märkimine.
 *
 * `pendingAudits` ja `setPendingAudits` tulevad sektsioonist (`DraftSection`),
 * mitte ei ela siin. Ootel auditid HOIAVAD OMA VÕTIT (L22) ja varem kadusid
 * need koos avatud elemendi sulgemisega: kopeerimine oli toimunud, jälg
 * salvestamata ja hoiatus läinud. Sektsiooni käes elab järjekord üle elemendi
 * sulgemise ja teise elemendi avamise.
 *
 * @returns vaate mudel (vt `DraftTransferView`)
 */
export function useTransferActions({ caseId, draft, locale, disabled, copyDisabled = disabled, pendingAudits, setPendingAudits, onChanged, t }) {
  const [phase, setPhase] = useState(null);
  const [block, setBlock] = useState(null);
  const [errorKey, setErrorKey] = useState(null);
  const [busy, setBusy] = useState(false);
  /* Teine vajutus samal ajal ei tee teist kopeerimist ega teist auditirida. */
  const busyRef = useRef(false);
  const queue = useMemo(() => (Array.isArray(pendingAudits) ? pendingAudits : []), [pendingAudits]);

  const postCopyEvent = useCallback(
    ({ fieldKeys, clientActionId, contentHash }) =>
      caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/drafts/${encodeURIComponent(draft.id)}/copy-events`, {
        method: "POST",
        locale,
        body: { fieldKeys, clientActionId, contentHash }
      }),
    [caseId, draft.id, locale]
  );

  const guarded = useCallback(async (task) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  /** Korduskatse SAMA võtmetega (L22) — uus võti oleks andmebaasi jaoks teine tegu. */
  const retryAudit = useCallback(() => {
    if (!queue.length) return undefined;
    return guarded(async () => {
      const { remaining, flushed, errorKey: failureKey } = await flushPendingAudits(queue, postCopyEvent);
      setPendingAudits(() => remaining);
      setErrorKey(remaining.length ? failureKey : null);
      if (!remaining.length) setPhase(COPY_PHASE.COPIED);
      if (flushed > 0) onChanged?.();
    });
  }, [guarded, onChanged, postCopyEvent, queue, setPendingAudits]);

  const copyForStar2 = useCallback(
    () =>
      guarded(async () => {
        setErrorKey(null);
        setBlock(null);
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
        setPendingAudits((current) => queuePendingAudit(current, result.pendingAudit));
        if (result.phase === COPY_PHASE.COPIED) onChanged?.();
      }),
    [caseId, draft.id, guarded, locale, onChanged, postCopyEvent, setPendingAudits]
  );

  const markTransferred = useCallback(
    () =>
      guarded(async () => {
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
        }
      }),
    [caseId, draft.id, draft.transferState, guarded, locale, onChanged]
  );

  const clipboardFailed = phase === COPY_PHASE.CLIPBOARD_FAILED;
  return {
    working: disabled || busy,
    /* Kopeerimine on lugemistegu ja server lubab seda ka kirjutuskaitstud
       juhtumis (lib/casework/caseWorkTransfer.js): selle lukk on eraldi. */
    copyBlocked: copyDisabled || busy,
    purged: Boolean(draft.contentPurgedAt),
    canMark: draft.transferState === "VALMIS_ULEKANDEKS",
    copied: phase === COPY_PHASE.COPIED && !queue.length,
    clipboardFailed,
    blockText: block?.text || "",
    pendingCount: queue.length,
    /* Üldine tõrge on näha siis, kui kumbki erijuht (lõikelaud, ootel jälg)
       oma teadet ei kanna. */
    errorText: errorKey && !clipboardFailed && !queue.length ? t(errorKey, "") : "",
    onCopy: copyForStar2,
    onMark: markTransferred,
    onRetry: retryAudit
  };
}

/**
 * Juhtumi ülekandeajalugu.
 *
 * SISU SIIN EI OLE — read kannavad tegu, aega ja VÄLJADE VÕTMEID (L8).
 * Kopeeritud teksti auditis ei ole ja seepärast ei saa teda siit ka lugeda;
 * ajalugu on tõend selle kohta, MIS juhtus, mitte teine koopia sellest, MIDA
 * kopeeriti.
 *
 * LAVA OSA (09.10): ajalugu on juhtumi lava oma osa (`CaseWorkDetail.jsx`).
 * Siin on laadimine; vaade on failis ./sections/DraftViews.jsx.
 * `refreshToken` muutub iga ülekandeteo järel: ajalugu on TÕEND ja vananenud
 * ajalugu ütleks, et jälge ei tekkinud.
 */
export function TransferHistory({ caseId, locale, t, refreshToken, onListLoaded }) {
  const { busy, errorKey, setErrorKey, run } = useSectionRun();

  /* Juhtumi ülevaade näitab selle osa esimest rida. Õnnestunud täislaadimine
     võtab maha ka eelmise katse teate. Funktsioon võib iga joonistusega uus
     olla: loend hoiab teda viitena ega laadi selle pärast uuesti. */
  const onLoaded = (rows) => {
    setErrorKey(null);
    onListLoaded?.(rows);
  };

  const { items, cursor, status, load, retry } = useCaseList({
    path: `/cases/${encodeURIComponent(caseId)}/transfer-events`,
    locale,
    reloadKey: refreshToken,
    onLoaded,
    onError: setErrorKey
  });

  const rows = useMemo(() => transferRows(items, { t, locale }), [items, locale, t]);

  return (
    <TransferHistoryView
      t={t}
      title={t("casework.page.parts.transfer.title", "")}
      status={status}
      rows={rows}
      errorText={errorKey ? t(errorKey, "") : ""}
      more={cursor ? { busy, onClick: () => run(() => load({ cursor, append: true })) } : null}
      onRetry={() => {
        setErrorKey(null);
        retry();
      }}
    />
  );
}
