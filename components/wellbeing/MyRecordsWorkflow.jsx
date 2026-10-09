"use client";

/**
 * Tööheaolu „Minu kirjed": töötaja enda varasemad kirjed ja pooleli tekstid.
 *
 * KUJU (09.10). Leht oli üks pikk veerg, kus kirje detail avanes loendi rea
 * sees. Nüüd on see sammulava (`components/stage/StepFlight.jsx`) vaadetena:
 * kirjete loend; avatud kirje juures kirje ise, järgmine samm ja mustandid;
 * lõpus pooleli jäänud tekstid. Vaated on failis ./records/RecordsViews.jsx,
 * kujundus selle kõrval. Siin on andmed, päringud ja see, mis vaateid olekuga
 * seob.
 *
 * Kirje kustutamine on jäädav, seepärast küsib nupp teist vajutust.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import Button from "@/components/ui/Button";
import { wellbeingLabel } from "@/lib/wellbeing/displayLabels";
import { CHECKPOINT_FOLLOW_UP_STATES, describeWellbeingCheckpoint } from "@/lib/wellbeing/checkpointState";

import { NextStepView, RecordDraftsView, RecordsListView, RecordView, UnfinishedView } from "./records/RecordsViews";

/* Töövoo-tüüpide sildivõtmed. Kuvasõna tuleb i18n-st (t), fallback on ET.
   Sisu (tegurid, signaalid) läbib olemasoleva `wellbeingLabel`-i (ET-only
   sõnastik — sama piir mis Ülevaates; EN/RU sõnastik on väljaspool T14-t). */
const WORKFLOW_LABELS = {
  "quick-check": ["wellbeing.my_records.workflow.quick_check", "Kiirkontroll"],
  overview: ["wellbeing.my_records.workflow.overview", "Ülevaade"],
  "hard-case": ["wellbeing.my_records.workflow.hard_case", "Raske juhtum"],
  "workplace-violence": ["wellbeing.my_records.workflow.workplace_violence", "Töövägivald"],
  recovery: ["wellbeing.my_records.workflow.recovery", "Taastumine"],
  "work-boundaries": ["wellbeing.my_records.workflow.work_boundaries", "Tööpiirid"],
  interruptions: ["wellbeing.my_records.workflow.interruptions", "Katkestused"],
  "work-processes": ["wellbeing.my_records.workflow.work_processes", "Tööprotsessid"],
  "role-boundaries": ["wellbeing.my_records.workflow.role_boundaries", "Rollipiirid"],
  "starter-support": ["wellbeing.my_records.workflow.starter_support", "Alustaja tugi"]
};

const SIGNAL_LABELS = {
  green: ["wellbeing.my_records.signal_level.green", "Roheline"],
  yellow: ["wellbeing.my_records.signal_level.yellow", "Kollane"],
  red: ["wellbeing.my_records.signal_level.red", "Punane"],
  insufficient_data: ["wellbeing.my_records.signal_level.insufficient_data", "Andmeid vähe"]
};

const PERIOD_PRESETS = {
  all: { key: "all", dayCount: null },
  week: { key: "week", dayCount: 7 },
  month: { key: "month", dayCount: 30 }
};

const SIGNAL_TONES = { green: "ok", yellow: "wait", red: "risk", insufficient_data: "quiet" };
const VIEWS_KEY = "wellbeing.my_records.views";
/* Teine vajutus kustutamiseks peab tulema selle aja sees. */
const CONFIRM_MS = 8000;

function normalizeSignalLevel(signal) {
  const level = String(signal || "").trim();
  if (level === "green" || level === "yellow" || level === "red") return level;
  return "insufficient_data";
}

function readDraftFocusFromUrl() {
  if (typeof window === "undefined") return "";
  try {
    return String(new URLSearchParams(window.location.search).get("draft") || "").trim();
  } catch {
    return "";
  }
}

export default function MyRecordsWorkflow({ onNavigate, locale = "et" }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("loading");
  const [records, setRecords] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState("idle");
  const [deleteStatus, setDeleteStatus] = useState("idle");
  const [recordsCursor, setRecordsCursor] = useState(null);
  const [draftsCursor, setDraftsCursor] = useState(null);
  const [moreStatus, setMoreStatus] = useState("idle");
  const [openedDraft, setOpenedDraft] = useState(null);
  const [openDraftStatus, setOpenDraftStatus] = useState("idle");
  const [focusDraftId, setFocusDraftId] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  // Nähtud töövoo-tüübid akumuleeruvad, et filtri nupud ei kaoks filtreerimisel
  // (filtreeritud loend sisaldab ainult üht tüüpi).
  const [knownWorkflowTypes, setKnownWorkflowTypes] = useState([]);
  const [view, setView] = useState("list");
  /* Kustutamine küsib teist vajutust: `record`, `record-drafts` või mustandi id. */
  const [confirming, setConfirming] = useState("");
  const confirmTimer = useRef(0);
  const armConfirm = useCallback((key) => {
    window.clearTimeout(confirmTimer.current);
    setConfirming(key);
    confirmTimer.current = window.setTimeout(() => setConfirming(""), CONFIRM_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);
  /* Avatud on ainult see kirje, mille detail on päriselt kohal (mitte eelmise kirje oma). */
  const openedRecord = selectedId && detail?.record?.id === selectedId ? detail.record : null;
  const plan = useRecordPlan(openedRecord, () => setReloadToken((token) => token + 1));

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === "et" ? "et-EE" : locale, { dateStyle: "medium" }),
    [locale]
  );
  const formatDate = useCallback((value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
  }, [dateFormatter]);

  const workflowLabel = useCallback((workflowType) => {
    const entry = WORKFLOW_LABELS[workflowType];
    return entry ? t(entry[0], entry[1]) : workflowType;
  }, [t]);

  const signalLabel = useCallback((signal) => {
    const entry = SIGNAL_LABELS[normalizeSignalLevel(signal)];
    return t(entry[0], entry[1]);
  }, [t]);

  useEffect(() => {
    setFocusDraftId(readDraftFocusFromUrl());
  }, []);

  // Kirjete + mustandite loend. Periood/töövoo filter läheb serverisse
  // records-päringus; mustandid tulevad täies mahus (naasmispunkt).
  useEffect(() => {
    let alive = true;
    async function load() {
      // Taustavärskendus (reloadToken) ei tohi listi kokku kukutada: „Laadin…"
      // ainult esmalaadimisel, muidu jääb olemasolev list nähtavaks ja avatud
      // detail ei sulgu badge'i värskenduse ajaks.
      setStatus((current) => (current === "ready" ? current : "loading"));
      try {
        const params = new URLSearchParams();
        if (workflowFilter !== "all") params.set("workflowType", workflowFilter);
        const preset = PERIOD_PRESETS[periodFilter] || PERIOD_PRESETS.all;
        if (preset.dayCount) {
          const end = new Date();
          const start = new Date(end.getTime() - preset.dayCount * 24 * 60 * 60 * 1000);
          params.set("periodStart", start.toISOString());
          params.set("periodEnd", end.toISOString());
        }
        const [recordsResponse, draftsResponse] = await Promise.all([
          fetch(`/api/wellbeing/records?${params.toString()}`, { headers: { Accept: "application/json" } }),
          fetch("/api/wellbeing/output-drafts", { headers: { Accept: "application/json" } })
        ]);
        const recordsPayload = await recordsResponse.json().catch(() => ({}));
        const draftsPayload = await draftsResponse.json().catch(() => ({}));
        if (!recordsResponse.ok || !recordsPayload?.ok) {
          throw new Error(recordsPayload?.message || "wellbeing.errors.records_failed");
        }
        if (alive) {
          setRecords(Array.isArray(recordsPayload.records) ? recordsPayload.records : []);
          /* SOL-WB-15: „kas on veel" tuleb serverilt, mitte ei arvata pikkusest. */
          setRecordsCursor(recordsPayload.hasMore ? recordsPayload.nextCursor : null);
          setDrafts(draftsResponse.ok && draftsPayload?.ok && Array.isArray(draftsPayload.drafts)
            ? draftsPayload.drafts
            : []);
          setDraftsCursor(draftsPayload?.hasMore ? draftsPayload.nextCursor : null);
          setStatus("ready");
        }
      } catch {
        if (alive) setStatus("error");
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [workflowFilter, periodFilter, reloadToken]);

  // Valitud kirje detail (vastused, signaal, soovitused, seotud mustandid,
  // handoff-ajalugu). Server liidab seotud mustandid omanik-skoobis.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailStatus("idle");
      return undefined;
    }
    let alive = true;
    async function loadDetail() {
      setDetailStatus("loading");
      setDeleteStatus("idle");
      try {
        const response = await fetch(`/api/wellbeing/records/${encodeURIComponent(selectedId)}`, {
          headers: { Accept: "application/json" }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.message || "wellbeing.errors.records_failed");
        }
        if (alive) {
          setDetail(payload);
          setDetailStatus("ready");
        }
      } catch {
        if (alive) setDetailStatus("error");
      }
    }
    loadDetail();
    return () => {
      alive = false;
    };
  }, [selectedId, reloadToken]);

  useEffect(() => {
    if (records.length === 0) return;
    setKnownWorkflowTypes((previous) => {
      const merged = new Set(previous);
      for (const record of records) merged.add(record.workflowType);
      return merged.size === previous.length ? previous : [...merged];
    });
  }, [records]);

  const workflowOptions = useMemo(
    () => ["all", ...Object.keys(WORKFLOW_LABELS).filter((type) => knownWorkflowTypes.includes(type))],
    [knownWorkflowTypes]
  );

  /* SOL-WB-15: „laadi veel" jätkab kursorilt, ei alusta otsast peale. Uued
     read LISATAKSE, sest kasutaja loeb parasjagu vanemaid. */
  async function loadMoreRecords() {
    if (!recordsCursor || moreStatus === "loading") return;
    setMoreStatus("loading");
    try {
      const params = new URLSearchParams();
      if (workflowFilter !== "all") params.set("workflowType", workflowFilter);
      params.set("cursor", recordsCursor);
      const response = await fetch(`/api/wellbeing/records?${params.toString()}`, {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.records_failed");
      setRecords((current) => [...current, ...(Array.isArray(payload.records) ? payload.records : [])]);
      setRecordsCursor(payload.hasMore ? payload.nextCursor : null);
      setMoreStatus("idle");
    } catch {
      setMoreStatus("error");
    }
  }

  async function loadMoreDrafts() {
    if (!draftsCursor || moreStatus === "loading") return;
    setMoreStatus("loading");
    try {
      const response = await fetch(`/api/wellbeing/output-drafts?cursor=${encodeURIComponent(draftsCursor)}`, {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.output_drafts_failed");
      setDrafts((current) => [...current, ...(Array.isArray(payload.drafts) ? payload.drafts : [])]);
      setDraftsCursor(payload.hasMore ? payload.nextCursor : null);
      setMoreStatus("idle");
    } catch {
      setMoreStatus("error");
    }
  }

  /* SOL-WB-16: mustandi AVAMINE — tekst tuleb tagasi, mitte ainult tema
     olemasolu fakt. */
  async function openDraft(draftId) {
    setOpenDraftStatus("loading");
    try {
      const response = await fetch(`/api/wellbeing/output-drafts/${encodeURIComponent(draftId)}`, {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.output_draft_not_found");
      setOpenedDraft(payload.draft);
      setOpenDraftStatus("ready");
    } catch {
      setOpenDraftStatus("error");
    }
  }

  /* SOL-WB-16: mustandi KUSTUTAMINE. Üleantud mustandi puhul ütleb vastus, et
     jagatud koopia jääb kovisiooni juhtumisse — seda ei varjata. */
  async function deleteDraft(draftId) {
    setOpenDraftStatus("deleting");
    try {
      const response = await fetch(`/api/wellbeing/output-drafts/${encodeURIComponent(draftId)}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.output_draft_not_found");
      setOpenedDraft(null);
      setConfirming("");
      setOpenDraftStatus(payload.handedOff ? "deleted_handed_off" : "deleted");
      setReloadToken((token) => token + 1);
    } catch {
      setOpenDraftStatus("error");
    }
  }

  async function deleteRecord(recordId, { deleteDrafts = false } = {}) {
    if (!recordId || deleteStatus === "deleting") return;
    setDeleteStatus("deleting");
    try {
      /* SOL-WB-16: mustandite saatus on teadlik valik ja ta läheb serverile
         kaasa — vaikimisi jäävad nad alles. */
      const query = deleteDrafts ? "?drafts=delete" : "";
      const response = await fetch(`/api/wellbeing/records/${encodeURIComponent(recordId)}${query}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "wellbeing.errors.record_delete_failed");
      }
      setDeleteStatus("deleted");
      setSelectedId(null);
      setDetail(null);
      setConfirming("");
      setView("list");
      setReloadToken((token) => token + 1);
    } catch {
      setDeleteStatus("error");
    }
  }

  const unconfirmedDrafts = drafts.filter((draft) => draft.status === "draft" && draft.userConfirmed === false);
  const record = openedRecord;
  const relatedDrafts = record && Array.isArray(detail.drafts) ? detail.drafts : [];
  const checkpointState = record ? describeWellbeingCheckpoint(record) : null;
  const openRecord = (id) => {
    setSelectedId(id);
    setConfirming("");
    setView("record");
  };

  const viewKeys = ["list", ...(selectedId ? ["record", "next", "drafts"] : []), "unfinished"];
  const viewState = {
    list: "empty",
    record: record ? "done" : "empty",
    next: record?.checkpoint ? (checkpointState?.needsFollowUp ? "partial" : "done") : "empty",
    drafts: relatedDrafts.length ? "done" : "empty",
    unfinished: unconfirmedDrafts.length ? "partial" : "empty"
  };
  const viewSummary = {
    record: record ? `${workflowLabel(record.workflowType)} · ${formatDate(record.createdAt)}` : "",
    next: record?.checkpoint?.nextStep ? String(record.checkpoint.nextStep).slice(0, 90) : ""
  };
  const steps = viewKeys.map((key) => ({
    key,
    label: t(`${VIEWS_KEY}.${key}.title`, key),
    short: t(`${VIEWS_KEY}.${key}.short`, key),
    state: viewState[key],
    summary: viewSummary[key] || undefined,
    /* Loendid võivad olla pikad, ja kirje, kus kõik tegurid on märgitud, samuti:
       nende järgi ühist kõrgust ei võeta. */
    free: key !== "drafts"
  }));

  const deleteNotice = deleteStatus === "deleted"
    ? { text: t("wellbeing.my_records.deleted", "Kirje kustutati.") }
    : deleteStatus === "error"
      ? { text: t("wellbeing.my_records.delete_failed", "Kirje kustutamine ebaõnnestus."), tone: "risk" }
      : null;
  const draftNotice = openDraftStatus === "deleted_handed_off"
    ? { text: t("wellbeing.my_records.draft_deleted_handed_off", "Mustand kustutati. Kovisiooni juba üle antud koopia jääb kovisiooni juhtumisse alles.") }
    : openDraftStatus === "deleted"
      ? { text: t("wellbeing.my_records.draft_deleted", "Mustand kustutati.") }
      : openDraftStatus === "error"
        ? { text: t("wellbeing.my_records.draft_action_failed", "Mustandi toiming ebaõnnestus."), tone: "risk" }
        : null;
  const confirmText = t(`${VIEWS_KEY}.confirm_delete`, "Vajuta uuesti, et kustutada");

  const renderView = (step) => {
    switch (step.key) {
      case "record": {
        const groups = record
          ? [
              ["load", "load_factors", "no_load_factors", record.loadFactors, "Koormustegurid", "Koormustegureid ei märgitud."],
              ["resource", "resource_factors", "no_resource_factors", record.resourceFactors, "Ressursid ja tugevused", "Ressursitegureid ei märgitud."],
              ["risk", "risk_markers", "no_risk_markers", record.riskMarkers, "Riskimärgid", "Riskimärke ei märgitud."]
            ].map(([key, titleKey, emptyKey, values, title, empty]) => ({
              key,
              title: t(`wellbeing.my_records.${titleKey}`, title),
              empty: t(`wellbeing.my_records.${emptyKey}`, empty),
              items: factorList(values).map((value) => ({ key: value, label: wellbeingLabel(value) }))
            }))
          : [];
        const links = record
          ? [
              record.supersededBy
                ? {
                    key: "corrected",
                    text: t("wellbeing.correction.corrected_badge", "Parandatud"),
                    action: t("wellbeing.correction.open_correction", "Ava parandus"),
                    onClick: () => openRecord(record.supersededBy.id)
                  }
                : null,
              record.supersedesRecordId
                ? {
                    key: "original",
                    text: t("wellbeing.correction.supersedes_note", "See kirje parandab varasemat kirjet."),
                    action: t("wellbeing.correction.open_original", "Ava parandatud kirje"),
                    onClick: () => openRecord(record.supersedesRecordId)
                  }
                : null
            ].filter(Boolean)
          : [];
        const deleting = deleteStatus === "deleting";
        return (
          <RecordView
            t={t}
            loading={detailStatus === "loading" && !record}
            failed={detailStatus === "error" || (detailStatus === "ready" && !record)}
            heading={record ? `${workflowLabel(record.workflowType)} · ${formatDate(record.createdAt)}` : ""}
            signal={{
              text: signalLabel(record?.computedSignal?.signalLevel),
              tone: SIGNAL_TONES[normalizeSignalLevel(record?.computedSignal?.signalLevel)]
            }}
            links={links}
            groups={groups}
            note={deleteNotice?.tone === "risk" ? deleteNotice.text : ""}
            actions={
              record ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={deleting}
                    onClick={() => (confirming === "record" ? deleteRecord(record.id) : armConfirm("record"))}
                  >
                    {deleting ? t("wellbeing.my_records.deleting", "Kustutan…") : confirming === "record" ? confirmText : t("wellbeing.my_records.delete", "Kustuta kirje")}
                  </Button>
                  {/* SOL-WB-16: mustandite saatus on TEADLIK valik. Vaikimisi jäävad nad
                      alles — mustand on eraldi kirjutatud tekst, mitte kirje tuletis. */}
                  {relatedDrafts.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={deleting}
                      onClick={() => (confirming === "record-drafts" ? deleteRecord(record.id, { deleteDrafts: true }) : armConfirm("record-drafts"))}
                    >
                      {confirming === "record-drafts" ? confirmText : t("wellbeing.my_records.delete_with_drafts", "Kustuta koos mustanditega")}
                    </Button>
                  ) : null}
                </>
              ) : null
            }
          />
        );
      }
      case "next": {
        const actions = record && Array.isArray(record.recommendedActions) ? record.recommendedActions : [];
        return (
          <NextStepView
            t={t}
            failed={plan.cpStatus === "error" || plan.followStatus === "error" || plan.recStatus === "error"}
            recBusy={plan.recStatus === "saving"}
            recommended={actions.map((action) => ({
              key: action.workflowType || action.label,
              label: action.label || workflowLabel(action.workflowType),
              reason: action.reason || "",
              done: Boolean(action.doneAt),
              onToggle: action.workflowType ? () => plan.toggleRecommendation(action.workflowType, !action.doneAt) : null
            }))}
            /* E2 kontrollpunkt: „järgmine samm + kontrollkuupäev", „kas pidas?" ja
               eemaldus. Elab eraldi väljadel (checkpoint/checkpointDueOn), MITTE
               vastuste sees — vastuste plokk jääb pärast salvestamist muutumatuks
               (TO-1 piir). */
            plan={
              record?.checkpoint
                ? {
                    step: record.checkpoint.nextStep,
                    due: t("wellbeing.checkpoint.due_on", "Kontrollkuupäev {date}", { date: formatDate(record.checkpointDueOn) }),
                    needsFollowUp: Boolean(checkpointState?.needsFollowUp),
                    answer: checkpointState?.followUpState && !checkpointState.needsFollowUp
                      ? `${t(`wellbeing.checkpoint.follow_up.${checkpointState.followUpState}`, checkpointState.followUpState)}${
                          record.checkpoint.followUp?.notedAt
                            ? ` · ${t("wellbeing.checkpoint.answered", "Vastatud {date}", { date: formatDate(record.checkpoint.followUp.notedAt) })}`
                            : ""
                        }`
                      : "",
                    answers: CHECKPOINT_FOLLOW_UP_STATES.map((state) => ({
                      key: state,
                      label: t(`wellbeing.checkpoint.follow_up.${state}`, state),
                      onClick: () => plan.submitFollowUp(state)
                    })),
                    busy: plan.cpStatus === "saving" || plan.followStatus === "saving",
                    onClear: plan.clearCheckpoint
                  }
                : null
            }
            form={{
              step: plan.checkpointStep,
              onStep: plan.setCheckpointStep,
              due: plan.checkpointDue,
              onDue: plan.setCheckpointDue,
              disabled: !record || plan.cpStatus === "saving" || !plan.checkpointStep.trim() || !plan.checkpointDue,
              onSave: plan.saveCheckpoint
            }}
          />
        );
      }
      case "drafts":
        return (
          <RecordDraftsView
            t={t}
            drafts={relatedDrafts.map((draft) => ({
              id: draft.id,
              title: workflowLabel(draft.sourceWorkflowType),
              date: formatDate(draft.updatedAt),
              status: t(`wellbeing.my_records.draft_status.${draft.status}`, draft.status)
            }))}
            handoffs={relatedDrafts
              .filter((draft) => draft.covisionCaseId || draft.handedOffAt)
              .map((draft) => ({
                id: `handoff-${draft.id}`,
                text: t("wellbeing.my_records.handoff_covision", "Viidi Kovisiooni"),
                date: formatDate(draft.handedOffAt || draft.updatedAt),
                onOpen: draft.covisionCaseId ? () => onNavigate?.(`/kovisioon?case=${encodeURIComponent(draft.covisionCaseId)}`) : null
              }))}
          />
        );
      case "unfinished":
        return (
          <UnfinishedView
            t={t}
            loading={status === "loading"}
            notice={draftNotice}
            more={draftsCursor ? { onClick: loadMoreDrafts, busy: moreStatus === "loading" } : null}
            rows={unconfirmedDrafts.map((draft) => ({
              id: draft.id,
              title: workflowLabel(draft.sourceWorkflowType),
              date: formatDate(draft.updatedAt),
              current: focusDraftId === draft.id,
              /* SOL-WB-16: mustandit sai varem ainult NÄHA, mitte avada ega
                 kustutada — tundlik tekst jäi kättesaamatuks. */
              text: openedDraft?.id === draft.id ? openedDraft.editedText || openedDraft.generatedText : "",
              busy: openDraftStatus === "loading" || openDraftStatus === "deleting",
              onOpen: () => openDraft(draft.id),
              onOpenRecord: draft.sourceRecordId ? () => openRecord(draft.sourceRecordId) : null,
              deleteLabel: confirming === draft.id ? confirmText : t("wellbeing.my_records.delete_draft", "Kustuta mustand"),
              onDelete: () => (confirming === draft.id ? deleteDraft(draft.id) : armConfirm(draft.id))
            }))}
          />
        );
      default:
        return (
          <RecordsListView
            t={t}
            status={status}
            notice={deleteNotice}
            workflow={{
              value: workflowFilter,
              onChange: setWorkflowFilter,
              options: workflowOptions.map((option) => ({
                value: option,
                label: option === "all" ? t("wellbeing.my_records.filter_workflow_all", "Kõik töövood") : workflowLabel(option)
              }))
            }}
            period={{
              value: periodFilter,
              onChange: setPeriodFilter,
              options: ["all", "week", "month"].map((option) => ({
                value: option,
                label: t(`wellbeing.my_records.filter_period_${option}`, option === "all" ? "Kõik" : option === "week" ? "Nädal" : "Kuu")
              }))
            }}
            more={recordsCursor ? { onClick: loadMoreRecords, busy: moreStatus === "loading" } : null}
            rows={records.map((item) => ({
              id: item.id,
              title: workflowLabel(item.workflowType),
              date: formatDate(item.createdAt),
              signal: signalLabel(item?.computedSignal?.signalLevel),
              tone: SIGNAL_TONES[normalizeSignalLevel(item?.computedSignal?.signalLevel)],
              /* Märk = „siin ootab sinu vastus" (E2, ilma U1-ta). Sama otsustaja
                 mis U1 taimer: describeWellbeingCheckpoint. */
              badge: describeWellbeingCheckpoint(item).needsFollowUp ? t("wellbeing.checkpoint.badge", "Kontrollpunkt ootab vastust") : "",
              selected: item.id === selectedId,
              onOpen: () => openRecord(item.id)
            }))}
          />
        );
    }
  };

  return (
    /* Vaadete loend muutub, kui kirje avatakse või suletakse: siis ehitatakse
       lava uuesti ja see avaneb vaatel, kuhu töötaja läks. */
    <StepFlight
      key={viewKeys.join("|")}
      label={t("wellbeing.my_records.title", "Minu kirjed")}
      steps={steps}
      initialIndex={Math.max(0, viewKeys.indexOf(view))}
      activeKey={viewKeys.includes(view) ? view : "list"}
      onStepChange={(index, step) => {
        if (step) setView(step.key);
      }}
    >
      {renderView}
    </StepFlight>
  );
}

function factorList(values) {
  return (Array.isArray(values) ? values : []).filter(Boolean);
}

/**
 * Avatud kirje kontrollpunkt ja soovituste märked.
 *
 * Kõik mutatsioonid järgivad sama rada: POST/PUT/DELETE, olekulipp, ja
 * õnnestumisel `onChanged` (leht värskendab detaili + loendi märgi). Vastuseid
 * ei muudeta kunagi — need marsruudid puudutavad ainult kontrollpunkti ja
 * soovituse välju.
 */
function useRecordPlan(record, onChanged) {
  const [checkpointStep, setCheckpointStep] = useState("");
  const [checkpointDue, setCheckpointDue] = useState("");
  const [cpStatus, setCpStatus] = useState("idle");
  const [followStatus, setFollowStatus] = useState("idle");
  const [recStatus, setRecStatus] = useState("idle");
  const recordId = record?.id || "";

  /* Teise kirje avamisel ei tohi eelmise kirje pooleli tekst kaasa tulla. */
  useEffect(() => {
    setCheckpointStep("");
    setCheckpointDue("");
    setCpStatus("idle");
    setFollowStatus("idle");
    setRecStatus("idle");
  }, [recordId]);

  async function runAction(setStatus, request) {
    setStatus("saving");
    try {
      const response = await request();
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "wellbeing.errors.records_failed");
      }
      setStatus("idle");
      onChanged?.();
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }

  async function saveCheckpoint() {
    if (cpStatus === "saving" || !record) return;
    const ok = await runAction(setCpStatus, () =>
      fetch(`/api/wellbeing/records/${encodeURIComponent(record.id)}/checkpoint`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ nextStep: checkpointStep, dueOn: checkpointDue })
      }));
    if (ok) {
      setCheckpointStep("");
      setCheckpointDue("");
    }
  }

  async function clearCheckpoint() {
    if (cpStatus === "saving" || !record) return;
    await runAction(setCpStatus, () =>
      fetch(`/api/wellbeing/records/${encodeURIComponent(record.id)}/checkpoint`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      }));
  }

  async function submitFollowUp(state) {
    if (followStatus === "saving" || !record) return;
    await runAction(setFollowStatus, () =>
      fetch(`/api/wellbeing/records/${encodeURIComponent(record.id)}/checkpoint/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        /* SOL-WB-09: vastus käib SELLE kokkuleppe kohta, mida ekraan näitab.
           Kui plaan on vahepeal välja vahetatud, ütleb server 409, mitte ei
           kirjuta vana vastust uue plaani külge. */
        body: JSON.stringify({ state, expectedCheckpointId: record?.checkpoint?.id || undefined })
      }));
  }

  async function toggleRecommendation(workflowType, done) {
    if (recStatus === "saving" || !record) return;
    await runAction(setRecStatus, () =>
      fetch(`/api/wellbeing/records/${encodeURIComponent(record.id)}/recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ workflowType, done })
      }));
  }

  return {
    checkpointStep,
    setCheckpointStep,
    checkpointDue,
    setCheckpointDue,
    cpStatus,
    followStatus,
    recStatus,
    saveCheckpoint,
    clearCheckpoint,
    submitFollowUp,
    toggleRecommendation
  };
}
