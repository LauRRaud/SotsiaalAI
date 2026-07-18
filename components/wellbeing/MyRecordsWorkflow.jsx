"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { wellbeingLabel } from "@/lib/wellbeing/displayLabels";

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
      setStatus("loading");
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
          setDrafts(draftsResponse.ok && draftsPayload?.ok && Array.isArray(draftsPayload.drafts)
            ? draftsPayload.drafts
            : []);
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
  }, [selectedId]);

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

  async function deleteRecord(recordId) {
    if (!recordId || deleteStatus === "deleting") return;
    setDeleteStatus("deleting");
    try {
      const response = await fetch(`/api/wellbeing/records/${encodeURIComponent(recordId)}`, {
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
                </button>
                {selectedId === record.id ? (
                  <RecordDetail
                    detail={detail}
                    detailStatus={detailStatus}
                    deleteStatus={deleteStatus}
                    onDelete={() => deleteRecord(record.id)}
                    onClose={() => setSelectedId(null)}
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
  detail, detailStatus, deleteStatus, onDelete, onClose,
  workflowLabel, signalLabel, formatDate, onNavigate, t
}) {
  if (detailStatus === "loading") {
    return <p role="status">{t("wellbeing.my_records.loading", "Laadin…")}</p>;
  }
  if (detailStatus === "error" || !detail?.record) {
    return <p role="status">{t("wellbeing.my_records.detail_failed", "Kirje avamine ebaõnnestus.")}</p>;
  }

  const record = detail.record;
  const relatedDrafts = Array.isArray(detail.drafts) ? detail.drafts : [];
  const handoffDrafts = relatedDrafts.filter((draft) => draft.covisionCaseId || draft.handedOffAt);
  const loadFactors = factorList(record.loadFactors);
  const resourceFactors = factorList(record.resourceFactors);
  const riskMarkers = factorList(record.riskMarkers);
  const recommendedActions = Array.isArray(record.recommendedActions) ? record.recommendedActions : [];

  return (
    <div aria-label={t("wellbeing.my_records.detail_heading", "Kirje detail")}>
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
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("wellbeing.my_records.no_recommended", "Eraldi soovitusi ei tekkinud.")}</p>
        )}
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
