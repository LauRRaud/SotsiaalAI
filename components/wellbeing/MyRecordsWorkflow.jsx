"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import { wellbeingLabel } from "@/lib/wellbeing/displayLabels";
import { CHECKPOINT_FOLLOW_UP_STATES, describeWellbeingCheckpoint } from "@/lib/wellbeing/checkpointState";

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
      setReloadToken((token) => token + 1);
    } catch {
      setDeleteStatus("error");
    }
  }

  const unconfirmedDrafts = drafts.filter((draft) => draft.status === "draft" && draft.userConfirmed === false);

  return (
    <div>
      <section aria-labelledby="my-records-heading">
        <div>
          <h2 id="my-records-heading">{t("wellbeing.my_records.title", "Minu kirjed")}</h2>
          <p>
            {t(
              "wellbeing.my_records.intro",
              "Siit näed oma varasemaid tööheaolu kirjeid ja pooleli jäänud mustandeid. Kirjed on privaatsed ja neid saab jätkata või kustutada."
            )}
          </p>
        </div>
      </section>

      <section aria-labelledby="my-records-drafts-heading">
        <h3 id="my-records-drafts-heading">
          {t("wellbeing.my_records.drafts_heading", "Pooleli jäänud mustandid")}
        </h3>
        {unconfirmedDrafts.length > 0 ? (
          <ul aria-label={t("wellbeing.my_records.drafts_heading", "Pooleli jäänud mustandid")}>
            {unconfirmedDrafts.map((draft) => (
              <li key={draft.id} aria-current={focusDraftId === draft.id ? "true" : undefined}>
                <span>{workflowLabel(draft.sourceWorkflowType)}</span>
                <span>{formatDate(draft.updatedAt)}</span>
                {draft.sourceRecordId ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setSelectedId(draft.sourceRecordId)}
                  >
                    {t("wellbeing.my_records.open_related_record", "Ava seotud kirje")}
                  </Button>
                ) : null}
                {/* SOL-WB-16: mustandit sai varem ainult NÄHA, mitte avada ega
                    kustutada — tundlik tekst jäi kättesaamatuks. */}
                <Button type="button" size="sm" onClick={() => openDraft(draft.id)}>
                  {t("wellbeing.my_records.open_draft", "Ava mustand")}
                </Button>
                <Button type="button" size="sm" onClick={() => deleteDraft(draft.id)}>
                  {t("wellbeing.my_records.delete_draft", "Kustuta mustand")}
                </Button>
                {openedDraft?.id === draft.id ? (
                  <p>{openedDraft.editedText || openedDraft.generatedText}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {status === "loading"
              ? t("wellbeing.my_records.loading", "Laadin…")
              : t("wellbeing.my_records.drafts_empty", "Pooleli jäänud mustandeid ei ole.")}
          </p>
        )}
        {draftsCursor ? (
          <Button type="button" size="sm" onClick={loadMoreDrafts} disabled={moreStatus === "loading"}>
            {t("wellbeing.my_records.load_more", "Laadi veel")}
          </Button>
        ) : null}
        {openDraftStatus === "deleted_handed_off" ? (
          <p role="status">
            {t(
              "wellbeing.my_records.draft_deleted_handed_off",
              "Mustand kustutati. Kovisiooni juba üle antud koopia jääb kovisiooni juhtumisse alles."
            )}
          </p>
        ) : openDraftStatus === "deleted" ? (
          <p role="status">{t("wellbeing.my_records.draft_deleted", "Mustand kustutati.")}</p>
        ) : openDraftStatus === "error" ? (
          <p role="status">{t("wellbeing.my_records.draft_action_failed", "Mustandi toiming ebaõnnestus.")}</p>
        ) : null}
      </section>

      <div aria-label={t("wellbeing.my_records.filters_label", "Kirjete filtrid")}>
        <div aria-label={t("wellbeing.my_records.filter_workflow_label", "Töövoog")}>
          {workflowOptions.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              aria-pressed={workflowFilter === option}
              onClick={() => setWorkflowFilter(option)}
            >
              {option === "all"
                ? t("wellbeing.my_records.filter_workflow_all", "Kõik töövood")
                : workflowLabel(option)}
            </Button>
          ))}
        </div>
        <div aria-label={t("wellbeing.my_records.filter_period_label", "Periood")}>
          {["all", "week", "month"].map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              aria-pressed={periodFilter === option}
              onClick={() => setPeriodFilter(option)}
            >
              {t(`wellbeing.my_records.filter_period_${option}`, option === "all" ? "Kõik" : option === "week" ? "Nädal" : "Kuu")}
            </Button>
          ))}
        </div>
      </div>

      <section aria-labelledby="my-records-list-heading">
        <h3 id="my-records-list-heading">{t("wellbeing.my_records.records_heading", "Kirjete kronoloogia")}</h3>
        {status === "error" ? (
          <p role="status">{t("wellbeing.my_records.load_failed", "Kirjete laadimine ebaõnnestus.")}</p>
        ) : status === "loading" ? (
          <p role="status">{t("wellbeing.my_records.loading", "Laadin…")}</p>
        ) : records.length === 0 ? (
          <p>{t("wellbeing.my_records.records_empty", "Selle filtriga kirjeid ei ole veel.")}</p>
        ) : (
          <ul aria-label={t("wellbeing.my_records.records_heading", "Kirjete kronoloogia")}>
            {records.map((record) => (
              <li key={record.id}>
                <button
                  type="button"
                  className="workspace-dashboard-card"
                  aria-expanded={selectedId === record.id}
                  onClick={() => setSelectedId((current) => (current === record.id ? null : record.id))}
                >
                  <span>{workflowLabel(record.workflowType)}</span>
                  <span>{formatDate(record.createdAt)}</span>
                  <span>{signalLabel(record?.computedSignal?.signalLevel)}</span>
                  {/* Badge = „siin ootab sinu vastus" (E2, ilma U1-ta). Sama
                      otsustaja mis U1 taimer: describeWellbeingCheckpoint. */}
                  {describeWellbeingCheckpoint(record).needsFollowUp ? (
                    <span className="wellbeing-checkpoint-badge">
                      {t("wellbeing.checkpoint.badge", "Kontrollpunkt ootab vastust")}
                    </span>
                  ) : null}
                </button>
                {selectedId === record.id ? (
                  <RecordDetail
                    detail={detail}
                    detailStatus={detailStatus}
                    deleteStatus={deleteStatus}
                    onDelete={() => deleteRecord(record.id)}
                    onDeleteWithDrafts={() => deleteRecord(record.id, { deleteDrafts: true })}
                    onClose={() => setSelectedId(null)}
                    onChanged={() => setReloadToken((token) => token + 1)}
                    onOpenRecord={(id) => setSelectedId(id)}
                    workflowLabel={workflowLabel}
                    signalLabel={signalLabel}
                    formatDate={formatDate}
                    onNavigate={onNavigate}
                    t={t}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {recordsCursor ? (
          <Button type="button" size="sm" onClick={loadMoreRecords} disabled={moreStatus === "loading"}>
            {t("wellbeing.my_records.load_more", "Laadi veel")}
          </Button>
        ) : null}
        {deleteStatus === "deleted" ? (
          <p role="status">{t("wellbeing.my_records.deleted", "Kirje kustutati.")}</p>
        ) : deleteStatus === "error" ? (
          <p role="status">{t("wellbeing.my_records.delete_failed", "Kirje kustutamine ebaõnnestus.")}</p>
        ) : null}
      </section>

      <p>
        {t(
          "wellbeing.my_records.privacy",
          "Kirjed on vaikimisi privaatsed. Ainult sina näed neid; kustutamine eemaldab kirje ka anonüümsest koondist."
        )}
      </p>
    </div>
  );
}

function factorList(values) {
  return (Array.isArray(values) ? values : []).filter(Boolean);
}

function RecordDetail({
  detail, detailStatus, deleteStatus, onDelete, onDeleteWithDrafts, onClose, onChanged, onOpenRecord,
  workflowLabel, signalLabel, formatDate, onNavigate, t
}) {
  const record = detail?.record || null;
  const [checkpointStep, setCheckpointStep] = useState("");
  const [checkpointDue, setCheckpointDue] = useState("");
  const [cpStatus, setCpStatus] = useState("idle");
  const [followStatus, setFollowStatus] = useState("idle");
  const [recStatus, setRecStatus] = useState("idle");

  /* Kõik kontrollpunkti-mutatsioonid järgivad sama rada: POST/PUT/DELETE,
     olekulipp, ja õnnestumisel `onChanged` (vanem värskendab detaili + listi
     badge'i). Vastuseid ei muudeta kunagi — need marsruudid puudutavad ainult
     kontrollpunkti/soovituse välju. */
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

  async function saveCheckpoint(event) {
    event.preventDefault();
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

  if (detailStatus === "loading") {
    return <p role="status">{t("wellbeing.my_records.loading", "Laadin…")}</p>;
  }
  if (detailStatus === "error" || !record) {
    return <p role="status">{t("wellbeing.my_records.detail_failed", "Kirje avamine ebaõnnestus.")}</p>;
  }

  const relatedDrafts = Array.isArray(detail.drafts) ? detail.drafts : [];
  const handoffDrafts = relatedDrafts.filter((draft) => draft.covisionCaseId || draft.handedOffAt);
  const loadFactors = factorList(record.loadFactors);
  const resourceFactors = factorList(record.resourceFactors);
  const riskMarkers = factorList(record.riskMarkers);
  const recommendedActions = Array.isArray(record.recommendedActions) ? record.recommendedActions : [];
  const checkpointState = describeWellbeingCheckpoint(record);

  return (
    <div aria-label={t("wellbeing.my_records.detail_heading", "Kirje detail")}>
      {/* TO-1 ahela kuva mõlemas suunas: parandatud kirje viitab parandusele,
          parandus viitab tagasi originaalile. Kumbki link avab teise kirje. */}
      {record.supersededBy ? (
        <p role="status">
          <strong>{t("wellbeing.correction.corrected_badge", "Parandatud")}</strong>
          {" · "}
          <button type="button" onClick={() => onOpenRecord?.(record.supersededBy.id)}>
            {t("wellbeing.correction.open_correction", "Ava parandus")}
          </button>
        </p>
      ) : null}
      {record.supersedesRecordId ? (
        <p>
          {t("wellbeing.correction.supersedes_note", "See kirje parandab varasemat kirjet.")}
          {" · "}
          <button type="button" onClick={() => onOpenRecord?.(record.supersedesRecordId)}>
            {t("wellbeing.correction.open_original", "Ava parandatud kirje")}
          </button>
        </p>
      ) : null}

      <dl>
        <div>
          <dt>{t("wellbeing.my_records.created_at", "Loodud")}</dt>
          <dd>{formatDate(record.createdAt)}</dd>
        </div>
        <div>
          <dt>{t("wellbeing.my_records.workflow_label", "Töövoog")}</dt>
          <dd>{workflowLabel(record.workflowType)}</dd>
        </div>
        <div>
          <dt>{t("wellbeing.my_records.signal", "Signaal")}</dt>
          <dd>{signalLabel(record?.computedSignal?.signalLevel)}</dd>
        </div>
      </dl>

      <DetailFactorList
        title={t("wellbeing.my_records.load_factors", "Koormustegurid")}
        items={loadFactors}
        emptyText={t("wellbeing.my_records.no_load_factors", "Koormustegureid ei märgitud.")}
      />
      <DetailFactorList
        title={t("wellbeing.my_records.resource_factors", "Ressursid ja tugevused")}
        items={resourceFactors}
        emptyText={t("wellbeing.my_records.no_resource_factors", "Ressursitegureid ei märgitud.")}
      />
      <DetailFactorList
        title={t("wellbeing.my_records.risk_markers", "Riskimärgid")}
        items={riskMarkers}
        emptyText={t("wellbeing.my_records.no_risk_markers", "Riskimärke ei märgitud.")}
      />

      <div>
        <h4>{t("wellbeing.my_records.recommended", "Soovitatud järgmised sammud")}</h4>
        {recommendedActions.length > 0 ? (
          <ul>
            {recommendedActions.map((action) => (
              <li key={action.workflowType || action.label}>
                {action.label || workflowLabel(action.workflowType)}
                {action.reason ? <small> — {action.reason}</small> : null}
                {action.workflowType ? (
                  <Button
                    type="button"
                    size="sm"
                    aria-pressed={Boolean(action.doneAt)}
                    disabled={recStatus === "saving"}
                    onClick={() => toggleRecommendation(action.workflowType, !action.doneAt)}
                  >
                    {action.doneAt
                      ? t("wellbeing.correction.recommendation_undo", "Võta märge tagasi")
                      : t("wellbeing.correction.recommendation_done", "Tehtud")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("wellbeing.my_records.no_recommended", "Eraldi soovitusi ei tekkinud.")}</p>
        )}
      </div>

      {/* E2 kontrollpunkt: „järgmine samm + kontrollkuupäev", „kas pidas?" ja
          eemaldus. Elab eraldi väljadel (checkpoint/checkpointDueOn), MITTE
          vastuste sees — vastuste plokk jääb pärast salvestamist muutumatuks
          (TO-1 piir). */}
      <div aria-label={t("wellbeing.checkpoint.title", "Järgmine samm ja kontrollkuupäev")}>
        <h4>{t("wellbeing.checkpoint.title", "Järgmine samm ja kontrollkuupäev")}</h4>
        <p>{t("wellbeing.checkpoint.description", "Pane kirja, mida kavatsed teha, ja millal tahad seda üle vaadata. See jääb ainult sinule.")}</p>

        {record.checkpoint ? (
          <div>
            <p>{t("wellbeing.checkpoint.planned", "Kokkulepe: {step}", { step: record.checkpoint.nextStep })}</p>
            <p>{t("wellbeing.checkpoint.due_on", "Kontrollkuupäev {date}", { date: formatDate(record.checkpointDueOn) })}</p>
            {checkpointState.needsFollowUp ? (
              <div role="group" aria-label={t("wellbeing.checkpoint.ask", "Kas said selle sammu tehtud?")}>
                <p>{t("wellbeing.checkpoint.ask", "Kas said selle sammu tehtud?")}</p>
                {CHECKPOINT_FOLLOW_UP_STATES.map((state) => (
                  <Button
                    key={state}
                    type="button"
                    size="sm"
                    disabled={followStatus === "saving"}
                    onClick={() => submitFollowUp(state)}
                  >
                    {t(`wellbeing.checkpoint.follow_up.${state}`, state)}
                  </Button>
                ))}
              </div>
            ) : checkpointState.followUpState ? (
              <p role="status">
                {t(`wellbeing.checkpoint.follow_up.${checkpointState.followUpState}`, checkpointState.followUpState)}
                {record.checkpoint.followUp?.notedAt
                  ? ` · ${t("wellbeing.checkpoint.answered", "Vastatud {date}", { date: formatDate(record.checkpoint.followUp.notedAt) })}`
                  : ""}
              </p>
            ) : null}
            <Button type="button" size="sm" onClick={clearCheckpoint} disabled={cpStatus === "saving"}>
              {t("wellbeing.checkpoint.clear", "Eemalda kontrollpunkt")}
            </Button>
          </div>
        ) : (
          <p>{t("wellbeing.checkpoint.none", "Kontrollpunkti ei ole seatud.")}</p>
        )}

        <Form onSubmit={saveCheckpoint}>
          <label>
            <span>{t("wellbeing.checkpoint.next_step_label", "Järgmine samm")}</span>
            <Input
              type="text"
              value={checkpointStep}
              maxLength={500}
              onChange={(event) => setCheckpointStep(event.target.value)}
            />
          </label>
          <label>
            <span>{t("wellbeing.checkpoint.due_label", "Kontrollkuupäev")}</span>
            <Input
              type="date"
              value={checkpointDue}
              onChange={(event) => setCheckpointDue(event.target.value)}
            />
          </label>
          <Button
            type="submit"
            size="sm"
            disabled={cpStatus === "saving" || !checkpointStep.trim() || !checkpointDue}
          >
            {t("wellbeing.checkpoint.save", "Salvesta kontrollpunkt")}
          </Button>
          {cpStatus === "error" ? (
            <p role="status">{t("wellbeing.errors.checkpoint_failed", "Kontrollpunkti salvestamine ebaõnnestus.")}</p>
          ) : null}
        </Form>
      </div>

      <div>
        <h4>{t("wellbeing.my_records.related_drafts", "Seotud mustandid")}</h4>
        {relatedDrafts.length > 0 ? (
          <ul>
            {relatedDrafts.map((draft) => (
              <li key={draft.id}>
                {workflowLabel(draft.sourceWorkflowType)} · {formatDate(draft.updatedAt)}
                {" · "}
                {t(`wellbeing.my_records.draft_status.${draft.status}`, draft.status)}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("wellbeing.my_records.no_related_drafts", "Selle kirjega ei ole seotud mustandeid.")}</p>
        )}
      </div>

      {handoffDrafts.length > 0 ? (
        <div>
          <h4>{t("wellbeing.my_records.handoff_history", "Üleandmise ajalugu")}</h4>
          <ul>
            {handoffDrafts.map((draft) => (
              <li key={`handoff-${draft.id}`}>
                {draft.covisionCaseId ? (
                  <button type="button" onClick={() => onNavigate?.(`/kovisioon?case=${encodeURIComponent(draft.covisionCaseId)}`)}>
                    {t("wellbeing.my_records.handoff_covision", "Viidi Kovisiooni")} · {formatDate(draft.handedOffAt || draft.updatedAt)}
                  </button>
                ) : (
                  <span>{t("wellbeing.my_records.handoff_covision", "Viidi Kovisiooni")} · {formatDate(draft.handedOffAt || draft.updatedAt)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <Button type="button" size="sm" onClick={onClose}>
          {t("wellbeing.my_records.close_detail", "Sulge")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onDelete}
          disabled={deleteStatus === "deleting"}
        >
          {deleteStatus === "deleting"
            ? t("wellbeing.my_records.deleting", "Kustutan…")
            : t("wellbeing.my_records.delete", "Kustuta kirje")}
        </Button>
        {/* SOL-WB-16: mustandite saatus on TEADLIK valik. Vaikimisi jäävad nad
            alles — mustand on eraldi kirjutatud tekst, mitte kirje tuletis. */}
        {(detail?.drafts || []).length > 0 ? (
          <Button
            type="button"
            size="sm"
            onClick={onDeleteWithDrafts}
            disabled={deleteStatus === "deleting"}
          >
            {t("wellbeing.my_records.delete_with_drafts", "Kustuta koos mustanditega")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DetailFactorList({ title, items, emptyText }) {
  return (
    <div>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => <li key={item}>{wellbeingLabel(item)}</li>)}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}
