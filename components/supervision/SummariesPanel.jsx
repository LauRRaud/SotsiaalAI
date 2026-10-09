"use client";

/**
 * Protsessi laua osa „Kokkuvõtted" (Q2.6 vaade 7): olek ja päringud.
 *
 * Lugemisvaade ees, kinnitus lõpus. Mustandit näeb AINULT superviisor (server
 * ei serialiseeri seda teistele) ja märgis ütleb seda ka nähtavalt.
 * Kinnitamist ootav kokkuvõte kannab „ootab N/M kinnitust"; kui server on
 * vahepeal jõudnud kinnitatud seisu, sulandub 409 lihtsalt värskeks olekuks.
 *
 * KUJU (09.10). Paneel oli üks veerg: iga kokkuvõte kõrge kaardina (toores seis
 * `PENDING_APPROVAL` märgil), muutmise vorm kaardi sees ja uue kokkuvõtte vorm
 * kahe rippvalikuga lõpus. Nüüd on osas üks asi korraga: loend, avatud
 * kokkuvõte, muutmine või uus kokkuvõte (enne valik, mille kohta see on, siis
 * tekst). Vaade on failis ./process/WorkViews.jsx.
 *
 * OTSELINK. `?summary=<id>` (teavitus, „Jätka siit", sulgemise eelvaate
 * takistus) avab selle kokkuvõtte kohe; vana paneel keris selle vaatevälja.
 *
 * VÄRSKENDAMINE. Kinnitused on grupitöö: kuni osa on ees ja leht nähtaval,
 * küsitakse seisu mõõdukalt uuesti; taustal ja suletud protsessis päringuid ei
 * tehta ning lehele naasmine sünkroonib seisu kohe (vanal lehel tegi sama
 * protsessi leht ise, kui kokkuvõtete sakk oli lahti).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { SummariesView } from "./process/WorkViews";
import { isClosed, newSummaryChoices, newSummaryTitle, summariesLead, summariesMode, summaryDraft, summaryRows } from "./process/processRows";
import usePartRequest from "./process/usePartRequest";

const REFRESH_MS = 10_000;
const NEW_DRAFT = Object.freeze({ kind: "", meetingId: "", body: "" });

export default function SummariesPanel({ process, onReload, onConflict, selectedSummaryId, active, glow }) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState("list");
  const [openId, setOpenId] = useState("");
  const [draft, setDraft] = useState(NEW_DRAFT);
  const [editing, setEditing] = useState(null);
  const { busy, message, setMessage, run } = usePartRequest({ t, onReload, onConflict });

  const canCreate = Boolean(process.capabilities?.canCreateSummary);
  const closed = isClosed(process);
  const rows = useMemo(() => summaryRows(process, { t, locale }), [locale, process, t]);
  const choices = useMemo(() => newSummaryChoices(process, { t }), [process, t]);
  const opened = rows.find((row) => row.id === openId) || null;

  /* Otselingi kokkuvõte avatakse üks kord selle tunnuse kohta: pärast seda
     liigub inimene ise ja värskendus ei tohi teda sama kokkuvõtte juurde tagasi tuua. */
  const linkedRef = useRef("");
  const hasLinked = Boolean(selectedSummaryId) && rows.some((row) => row.id === selectedSummaryId);
  useEffect(() => {
    if (!hasLinked || linkedRef.current === selectedSummaryId) return;
    linkedRef.current = selectedSummaryId;
    setOpenId(selectedSummaryId);
    setMode("summary");
  }, [hasLinked, selectedSummaryId]);

  useEffect(() => {
    if (!active || closed) return undefined;
    let inFlight = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      try {
        await onReload?.();
      } finally {
        inFlight = false;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(() => {
      void refresh();
    }, REFRESH_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active, closed, onReload]);

  /* Valimata liik tähendab esimest võimalikku: kui lõpukokkuvõte on juba
     olemas, on ainus valik kohtumise kokkuvõte. */
  const kind = choices.kinds.some((option) => option.value === draft.kind) ? draft.kind : choices.kinds[0]?.value || "";
  const meetingId = kind === "MEETING" && choices.meetings.some((option) => option.value === draft.meetingId) ? draft.meetingId : "";
  const shownDraft = { kind, meetingId, body: draft.body };
  const payload = summaryDraft(shownDraft);
  const draftTitle = newSummaryTitle(process, shownDraft, t);

  const create = useCallback(async () => {
    if (!payload) return;
    const ok = await run("create", `/api/supervision/processes/${encodeURIComponent(process.id)}/summaries`, { body: payload });
    if (!ok) return;
    setDraft(NEW_DRAFT);
    setMode("list");
  }, [payload, process.id, run]);

  const saveDraft = useCallback(async () => {
    if (!editing || !opened || editing.id !== opened.id) return;
    const body = editing.body.trim();
    if (!body) return;
    const ok = await run(`save:${opened.id}`, `/api/supervision/summaries/${encodeURIComponent(opened.id)}`, {
      method: "PATCH",
      body: { body, expectedVersion: opened.version }
    });
    if (!ok) return;
    setEditing(null);
    setMode("summary");
  }, [editing, opened, run]);

  const submit = useCallback(
    (summaryId) => {
      const summary = rows.find((row) => row.id === summaryId);
      if (!summary) return undefined;
      return run(`submit:${summaryId}`, `/api/supervision/summaries/${encodeURIComponent(summaryId)}/submit`, {
        body: { expectedVersion: summary.version }
      });
    },
    [rows, run]
  );

  const approve = useCallback(
    (summaryId) => run(`approve:${summaryId}`, `/api/supervision/summaries/${encodeURIComponent(summaryId)}/approve`),
    [run]
  );

  const discard = useCallback(
    async (summaryId) => {
      const ok = await run(`discard:${summaryId}`, `/api/supervision/summaries/${encodeURIComponent(summaryId)}`, { method: "DELETE" });
      if (!ok) return;
      /* Kõrvale jäetud kokkuvõtet server enam ei anna: ees on jälle loend. */
      setEditing(null);
      setOpenId("");
      setMode("list");
    },
    [run]
  );

  return (
    <SummariesView
      t={t}
      glow={glow}
      mode={summariesMode({
        mode,
        canCreate,
        anyChoice: choices.any,
        hasTarget: Boolean(draftTitle),
        hasSummary: Boolean(opened),
        canEdit: Boolean(opened?.canEdit),
        hasEditing: Boolean(editing)
      })}
      rows={rows}
      summary={opened}
      canCreate={canCreate}
      lead={summariesLead(process, t)}
      note={message}
      choices={choices}
      draft={shownDraft}
      onDraft={setDraft}
      draftTitle={draftTitle}
      canSaveDraft={Boolean(payload)}
      editing={editing}
      onEditing={setEditing}
      busy={Boolean(busy)}
      onMode={(next) => {
        setMessage("");
        if (next === "edit" && opened) setEditing({ id: opened.id, body: opened.body });
        if (next !== "edit") setEditing(null);
        setMode(next);
      }}
      onOpen={(summaryId) => {
        setMessage("");
        setOpenId(summaryId);
        setMode("summary");
      }}
      onCreate={create}
      onSave={saveDraft}
      onSubmit={submit}
      onApprove={approve}
      onDiscard={discard}
    />
  );
}
