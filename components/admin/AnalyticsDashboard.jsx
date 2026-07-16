"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import BackButton from "@/components/ui/BackButton";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";
import Button from "@/components/ui/Button";
import CardTitle from "@/components/ui/CardTitle";
import DocumentsDropdown from "@/components/documents/DocumentsDropdown";

// Dekoratiivsed className-konstandid on strip'itud (Fable 5 annab kujunduse hiljem).
// Nimed on säilinud, et kõik JSX-viited resolvuksid; väärtused on tühjad.
const pageClassName = "";
const pageHeaderClassName = "";
const pageHeaderSurfaceClassName = "";
const pageTitleClassName = "";
const pageHeaderSubtitleClassName = "";
const pageHeaderMetaRowClassName = "";
const pageHeaderMetaClassName = "";
const pageHeaderToolbarClassName = "";
const pageHeaderDividerClassName = "";
const sectionNavClassName = "";
const sectionNavLinkClassName = "";
const headerPillClassName = "";
const headerPillLabelClassName = "";
const headerPillValueClassName = "";
const cardClassName = "";
const cardBodyClassName = "";
const kpiGridClassName = "";
const topKpiGridClassName = "";
const platformGridClassName = "";
const docsGridClassName = "";
const billingSummaryGridClassName = "";
const billingPipelineGridClassName = "";
const usersSummaryGridClassName = "";
const sectionHeadClassName = "";
const sectionSubClassName = "";
const kpiValueClassName = "";
const kpiMetaClassName = "";
const statRowClassName = "";
const statRowMainClassName = "";
const statRowValueWrapClassName = "";
const metricGroupClassName = "";
const barClassName = "";
const tableHeaderClassName = "";
const tableScrollHintClassName = "";
const tableDesktopWrapClassName = "";
const tableWrapClassName = "";
const tableClassName = "";
const tableHeadCellClassName = "";
const tableCellClassName = "";
const cellSubClassName = "";
const toolbarPrimaryClassName = "";
const logsToolbarClassName = "";
const usersSelectBarClassName = "";
const usersSelectActionsClassName = "";
const usersSelectCountClassName = "";
const emailSendBarClassName = "";
const emailSendHeadClassName = "";
const emailSendHintClassName = "";
const dropdownClassName = "";
const compactDropdownClassName = "";
const inputClassName = "";
const textAreaClassName = "";
const alertErrorClassName = "";
const alertInfoClassName = "";
const alertWarnClassName = "";
const alertCriticalClassName = "";
const alertSuccessClassName = "";
const refreshButtonClassName = "";
const actionButtonClassName = "";
const resetActionGridClassName = "";
const resetActionButtonClassName = "";
const backButtonClassName = "";
const metricListClassName = "";
const metricRowClassName = "";
const metricRowStackedClassName = "";
const metricValueClassName = "";
const metricValueStackedClassName = "";
const summaryDeckClassName = "";
const summaryPanelClassName = "";
const summaryPanelBodyClassName = "";
const mobileListClassName = "";
const mobileRowCardClassName = "";
const mobileRowHeadClassName = "";
const mobileRowTitleClassName = "";
const mobileRowSubClassName = "";
const mobileFieldGridClassName = "";
const mobileFieldClassName = "";
const mobileFieldLabelClassName = "";
const mobileFieldValueClassName = "";
const compactMetricGridClassName = "";
const compactMetricRowClassName = "";
const compactMetricLabelClassName = "";
const compactMetricValueClassName = "";
const compactMetricLeadValueClassName = "";
const checkboxClassName = "";

const EVENT_OPTIONS = [
  { value: "chat_request", labelKey: "admin.analytics.events.chat_request" },
  { value: "rag_search", labelKey: "admin.analytics.events.rag_search" },
  { value: "rag_trace", labelKey: "admin.analytics.events.rag_trace", fallbackLabel: "RAG trace" },
  { value: "no_context", labelKey: "admin.analytics.events.no_context" },
  { value: "crisis_detected", labelKey: "admin.analytics.events.crisis_detected" },
  { value: "stt_request", labelKey: "admin.analytics.events.stt_request" },
  { value: "tts_request", labelKey: "admin.analytics.events.tts_request" },
  { value: "rag_error", labelKey: "admin.analytics.events.rag_error" },
  { value: "rag_optional_search_error", labelKey: "admin.analytics.events.rag_optional_search_error", fallbackLabel: "RAG optional search error" },
  { value: "openai_error", labelKey: "admin.analytics.events.openai_error" },
  { value: "openai_usage", labelKey: "admin.analytics.events.openai_usage", fallbackLabel: "OpenAI usage" },
  { value: "rag_cost_usage", labelKey: "admin.analytics.events.rag_cost_usage", fallbackLabel: "RAG cost usage" },
  { value: "tts_cost_usage", labelKey: "admin.analytics.events.tts_cost_usage", fallbackLabel: "TTS cost usage" },
  { value: "stt_cost_usage", labelKey: "admin.analytics.events.stt_cost_usage", fallbackLabel: "STT cost usage" },
  { value: "subscription_init_started", labelKey: "admin.analytics.events.subscription_init_started" },
  { value: "subscription_init_checkout_created", labelKey: "admin.analytics.events.subscription_init_checkout_created" },
  { value: "subscription_init_failed", labelKey: "admin.analytics.events.subscription_init_failed" },
  { value: "subscription_callback_redirect", labelKey: "admin.analytics.events.subscription_callback_redirect" },
  { value: "subscription_webhook_processed", labelKey: "admin.analytics.events.subscription_webhook_processed" },
  { value: "subscription_webhook_failed", labelKey: "admin.analytics.events.subscription_webhook_failed" },
  { value: "subscription_webhook_owner_email_sent", labelKey: "admin.analytics.events.subscription_webhook_owner_email_sent" },
  { value: "subscription_webhook_owner_email_failed", labelKey: "admin.analytics.events.subscription_webhook_owner_email_failed" },
  { value: "subscription_webhook_owner_email_skipped", labelKey: "admin.analytics.events.subscription_webhook_owner_email_skipped" },
  { value: "payment_alert_dispatch_dry_run", labelKey: "admin.analytics.events.payment_alert_dispatch_dry_run" },
  { value: "payment_alert_dispatched", labelKey: "admin.analytics.events.payment_alert_dispatched" },
  { value: "payment_alert_dispatch_failed", labelKey: "admin.analytics.events.payment_alert_dispatch_failed" }
];

const PRELAUNCH_RESET_ACTIONS = [
  { value: "clear_logs", labelKey: "admin.analytics.reset.actions.clear_logs" },
  { value: "clear_conversations", labelKey: "admin.analytics.reset.actions.clear_conversations" },
  { value: "clear_rooms", labelKey: "admin.analytics.reset.actions.clear_rooms" },
  { value: "clear_auth_tokens", labelKey: "admin.analytics.reset.actions.clear_auth_tokens" },
  { value: "clear_usage_metrics", labelKey: "admin.analytics.reset.actions.clear_usage_metrics" },
  { value: "clear_billing", labelKey: "admin.analytics.reset.actions.clear_billing" }
];

const STATUS_LABEL_KEYS = {
  PENDING: "admin.analytics.status.pending",
  PROCESSING: "admin.analytics.status.processing",
  COMPLETED: "admin.analytics.status.completed",
  FAILED: "admin.analytics.status.failed"
};

const AUDIENCE_LABEL_KEYS = {
  SOCIAL_WORKER: "admin.analytics.audience.social_worker",
  CLIENT: "admin.analytics.audience.client",
  BOTH: "admin.analytics.audience.both"
};

function toLocaleTag(locale) {
  const normalized = String(locale || "en").toLowerCase();
  if (normalized.startsWith("et")) return "et-EE";
  if (normalized.startsWith("ru")) return "ru-RU";
  return "en-US";
}

function toNumber(value) {
  const n = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatCount(value, localeTag) {
  try {
    return new Intl.NumberFormat(localeTag).format(toNumber(value));
  } catch {
    return String(toNumber(value));
  }
}

function formatPercent(value, localeTag, digits = 0) {
  try {
    return new Intl.NumberFormat(localeTag, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(toNumber(value));
  } catch {
    return String(toNumber(value));
  }
}

function formatDecimal(value, localeTag, digits = 2) {
  try {
    return new Intl.NumberFormat(localeTag, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(toNumber(value));
  } catch {
    return String(toNumber(value));
  }
}

function formatStorageSize(value, localeTag, digits = 1) {
  const size = toNumber(value);
  if (size >= 1024 * 1024 * 1024) {
    return `${formatDecimal(size / (1024 * 1024 * 1024), localeTag, digits)} GB`;
  }
  if (size >= 1024 * 1024) {
    return `${formatDecimal(size / (1024 * 1024), localeTag, digits)} MB`;
  }
  if (size >= 1024) {
    return `${formatDecimal(size / 1024, localeTag, digits)} KB`;
  }
  return `${formatCount(size, localeTag)} B`;
}

function formatMinutes(value, localeTag, digits = 2) {
  return `${formatDecimal(value, localeTag, digits)} min`;
}

function formatDays(value, localeTag) {
  if (value == null || value === "") return "-";
  return `${formatCount(value, localeTag)} d`;
}

function formatMoney(amount, currency = "EUR", localeTag = "en-US") {
  try {
    return new Intl.NumberFormat(localeTag, {
      style: "currency",
      currency
    }).format(toNumber(amount));
  } catch {
    return `${toNumber(amount).toFixed(2)} ${currency}`;
  }
}

function formatDate(value, localeTag = "en-US") {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(localeTag, {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function joinCounts(map = {}, labels = {}, localeTag = "en-US", order = []) {
  const source = map && typeof map === "object" ? map : {};
  const keys = order.length ? order : Object.keys(source);
  const parts = [];
  for (const key of keys) {
    if (source[key] == null) continue;
    parts.push(`${labels[key] || key}: ${formatCount(source[key], localeTag)}`);
  }
  return parts.join(" | ");
}

function progressToneClassName() {
  // Dekoratiivne gradient-toon strip'itud.
  return "";
}

function SectionAlert({ tone = "info", message }) {
  if (!message) return null;
  const className =
    tone === "success"
      ? alertSuccessClassName
      : tone === "warn"
        ? alertWarnClassName
        : tone === "critical"
          ? alertCriticalClassName
          : tone === "error"
            ? alertErrorClassName
            : alertInfoClassName;
  return <div className={className}>{message}</div>;
}

function HeaderPill({ label, value }) {
  return (
    <div className={headerPillClassName}>
      <span className={headerPillLabelClassName}>{label}</span>
      <span className={headerPillValueClassName}>{value}</span>
    </div>
  );
}

function KpiCard({ title, value, meta, children }) {
  return (
    <div className={statRowClassName}>
      <div className={statRowMainClassName}>
        <CardTitle>
          {title}
        </CardTitle>
        {meta ? <div className={kpiMetaClassName}>{meta}</div> : null}
      </div>
      <div className={statRowValueWrapClassName}>
        {value != null ? <div className={kpiValueClassName}>{value}</div> : null}
        {children}
      </div>
    </div>
  );
}

function MobileInfoField({ label, value }) {
  return (
    <div className={mobileFieldClassName}>
      <div className={mobileFieldLabelClassName}>{label}</div>
      <div className={mobileFieldValueClassName}>{value}</div>
    </div>
  );
}

function CompactMetricGrid({ items }) {
  return (
    <div className={compactMetricGridClassName}>
      {items.map(item => (
        <div key={item.label} className={compactMetricRowClassName}>
          <span className={compactMetricLabelClassName}>{item.label}</span>
          <span className={compactMetricValueClassName}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function MetricListCard({ title, items, stacked = false }) {
  return (
    <div className={metricGroupClassName}>
      <CardTitle>
        {title}
      </CardTitle>
      <div className={metricListClassName}>
        {items.map(item => (
          <div key={item.label} className={stacked ? metricRowStackedClassName : metricRowClassName}>
            <span className={cellSubClassName}>{item.label}</span>
            <span className={stacked ? metricValueStackedClassName : metricValueClassName}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsageBar({ value }) {
  // Dekoratiivne edenemisriba: struktuur säilib, kujundus strip'itud.
  return (
    <div className={barClassName}>
      <span className={progressToneClassName(value)} />
    </div>
  );
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const localeTag = useMemo(() => toLocaleTag(locale), [locale]);

  const eventLabels = useMemo(() => {
    const out = {};
    for (const entry of EVENT_OPTIONS) {
      out[entry.value] = t(entry.labelKey, entry.fallbackLabel || entry.value);
    }
    return out;
  }, [t]);

  const statusLabels = useMemo(
    () => ({
      PENDING: t(STATUS_LABEL_KEYS.PENDING, "Pending"),
      PROCESSING: t(STATUS_LABEL_KEYS.PROCESSING, "Processing"),
      COMPLETED: t(STATUS_LABEL_KEYS.COMPLETED, "Completed"),
      FAILED: t(STATUS_LABEL_KEYS.FAILED, "Failed")
    }),
    [t]
  );

  const freshnessStatusLabels = useMemo(
    () => ({
      ok: t("admin.analytics.rag_docs.freshness.ok", "OK"),
      due_soon: t("admin.analytics.rag_docs.freshness.due_soon", "Due soon"),
      stale: t("admin.analytics.rag_docs.freshness.stale", "Stale"),
      missing_last_checked: t("admin.analytics.rag_docs.freshness.missing_last_checked", "Missing last_checked"),
      expired: t("admin.analytics.rag_docs.freshness.expired", "Expired"),
      inactive: t("admin.analytics.rag_docs.freshness.inactive", "Inactive"),
      archived: t("admin.analytics.rag_docs.freshness.archived", "Archived"),
      unknown_type: t("admin.analytics.rag_docs.freshness.unknown_type", "Unknown type"),
      invalid_last_checked: t("admin.analytics.rag_docs.freshness.invalid_last_checked", "Invalid last_checked"),
      not_yet_valid: t("admin.analytics.rag_docs.freshness.not_yet_valid", "Not yet valid"),
      historical: t("admin.analytics.rag_docs.freshness.historical", "Historical"),
      invalid_url: t("admin.analytics.rag_docs.freshness.invalid_url", "Invalid URL"),
      missing_url: t("admin.analytics.rag_docs.freshness.missing_url", "Missing URL"),
      contact_not_official_source: t("admin.analytics.rag_docs.freshness.contact_not_official_source", "Contact not official"),
      kov_service_missing_form_source: t("admin.analytics.rag_docs.freshness.kov_service_missing_form_source", "Service missing form source"),
      kov_service_missing_official_contact_source: t("admin.analytics.rag_docs.freshness.kov_service_missing_official_contact_source", "Service missing official contact source"),
      canonical_item_municipality_conflict: t("admin.analytics.rag_docs.freshness.canonical_item_municipality_conflict", "Canonical item KOV conflict")
    }),
    [t]
  );

  const freshnessSeverityLabels = useMemo(
    () => ({
      error: t("admin.analytics.rag_docs.freshness.error", "Error"),
      warning: t("admin.analytics.rag_docs.freshness.warning", "Warning"),
      info: t("admin.analytics.rag_docs.freshness.info", "Info")
    }),
    [t]
  );

  const highRiskSourceLayerLabels = useMemo(
    () => ({
      answer: t("admin.analytics.rag_docs.high_risk_layer.answer", "Answer source"),
      displayed: t("admin.analytics.rag_docs.high_risk_layer.displayed", "Displayed source"),
      claim: t("admin.analytics.rag_docs.high_risk_layer.claim", "Claim source")
    }),
    [t]
  );

  const collectionFamilyLabels = useMemo(
    () => ({
      kov_web: t("admin.analytics.rag_docs.collection.kov_web", "KOV web"),
      kov_rt: t("admin.analytics.rag_docs.collection.kov_rt", "KOV RT"),
      national_rt: t("admin.analytics.rag_docs.collection.national_rt", "National RT"),
      ajakiri_sotsiaaltoo: t("admin.analytics.rag_docs.collection.ajakiri_sotsiaaltoo", "Ajakiri Sotsiaaltoo"),
      organizations: t("admin.analytics.rag_docs.collection.organizations", "Organizations"),
      unknown: t("admin.analytics.rag_docs.collection.unknown", "Unknown")
    }),
    [t]
  );

  const sourceFileTypeLabels = useMemo(
    () => ({
      kov_data_item: t("admin.analytics.rag_docs.file_type.kov_data_item", "KOV data item"),
      rag_md: t("admin.analytics.rag_docs.file_type.rag_md", "RAG markdown"),
      rt_xml: t("admin.analytics.rag_docs.file_type.rt_xml", "RT XML"),
      rt_json: t("admin.analytics.rag_docs.file_type.rt_json", "RT JSON"),
      rt_md: t("admin.analytics.rag_docs.file_type.rt_md", "RT markdown"),
      sources_json: t("admin.analytics.rag_docs.file_type.sources_json", "sources.json"),
      meta_json: t("admin.analytics.rag_docs.file_type.meta_json", "meta.json"),
      data_json: t("admin.analytics.rag_docs.file_type.data_json", "data.json"),
      article_ingest: t("admin.analytics.rag_docs.file_type.article_ingest", "Article ingest"),
      xml: t("admin.analytics.rag_docs.file_type.xml", "XML"),
      unknown: t("admin.analytics.rag_docs.file_type.unknown", "Unknown")
    }),
    [t]
  );

  const remediationActionLabels = useMemo(
    () => ({
      fill_required_metadata_fields: t("admin.analytics.rag_docs.remediation.fill_required_metadata_fields", "Fill required metadata"),
      fill_recommended_metadata_fields: t("admin.analytics.rag_docs.remediation.fill_recommended_metadata_fields", "Fill recommended metadata"),
      map_source_type: t("admin.analytics.rag_docs.remediation.map_source_type", "Map source type"),
      fix_source_url: t("admin.analytics.rag_docs.remediation.fix_source_url", "Fix source URL"),
      refresh_last_checked: t("admin.analytics.rag_docs.remediation.refresh_last_checked", "Refresh last_checked"),
      review_validity_window: t("admin.analytics.rag_docs.remediation.review_validity_window", "Review validity dates"),
      add_or_link_form_source: t("admin.analytics.rag_docs.remediation.add_or_link_form_source", "Add or link form source"),
      add_or_link_official_contact_source: t("admin.analytics.rag_docs.remediation.add_or_link_official_contact_source", "Add or link official contact"),
      review_source_metadata: t("admin.analytics.rag_docs.remediation.review_source_metadata", "Review source metadata")
    }),
    [t]
  );

  const audienceLabels = useMemo(
    () => ({
      SOCIAL_WORKER: t(AUDIENCE_LABEL_KEYS.SOCIAL_WORKER, "Social worker"),
      CLIENT: t(AUDIENCE_LABEL_KEYS.CLIENT, "Client"),
      BOTH: t(AUDIENCE_LABEL_KEYS.BOTH, "Both")
    }),
    [t]
  );
  const sectionLinks = useMemo(
    () => [
      { href: "#analytics-overview", label: t("admin.analytics.title", "Analytics") },
      { href: "#analytics-platform", label: t("admin.analytics.platform.title", "Platform overview") },
      { href: "#analytics-storage", label: t("admin.analytics.storage.title", "Salvestusruumi ülevaade") },
      { href: "#analytics-rag-docs", label: t("admin.analytics.rag_docs.title", "RAG documents") },
      { href: "#analytics-billing", label: t("admin.analytics.billing.title", "Subscriptions and payments") },
      { href: "#analytics-users", label: t("admin.analytics.users.title", "Users, costs and limits") },
      { href: "#admin-usage-controls", label: t("admin.usage.title", "Packages and limits") },
      { href: "#admin-deletion-jobs", label: t("admin.usage.deletion_jobs_title", "Deletion jobs") },
      { href: "#analytics-ai-costs", label: t("admin.analytics.ai_costs.title", "AI kuluaktiivsus") },
      { href: "#analytics-logs", label: t("admin.analytics.logs.title", "Logs") }
    ],
    [t]
  );
  const emailTargetOptions = useMemo(
    () => [
      { value: "selected", label: t("admin.analytics.users.actions.email_selected", "Selected users") },
      { value: "all", label: t("admin.analytics.users.actions.email_all", "All users") }
    ],
    [t]
  );
  const eventFilterOptions = useMemo(
    () => [
      { value: "all", label: t("admin.analytics.logs.filter.all_events", "All events") },
      ...EVENT_OPTIONS.map(item => ({ value: item.value, label: eventLabels[item.value] || item.value }))
    ],
    [eventLabels, t]
  );
  const crisisFilterOptions = useMemo(
    () => [
      { value: "all", label: t("admin.analytics.logs.filter.crisis_all", "Crisis: all") },
      { value: "true", label: t("admin.analytics.logs.filter.crisis_yes", "Crisis: yes") },
      { value: "false", label: t("admin.analytics.logs.filter.crisis_no", "Crisis: no") }
    ],
    [t]
  );

  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [usersAnalytics, setUsersAnalytics] = useState(null);
  const [aiCosts, setAiCosts] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingAiCosts, setLoadingAiCosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [eventFilter, setEventFilter] = useState("all");
  const [isCrisisFilter, setIsCrisisFilter] = useState("all");
  const [usersQueryDraft, setUsersQueryDraft] = useState("");
  const [usersQuery, setUsersQuery] = useState("");
  const [pageError, setPageError] = useState("");
  const [usersNotice, setUsersNotice] = useState(null);
  const [logsNotice, setLogsNotice] = useState(null);
  const [resetNotice, setResetNotice] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [deletingUsers, setDeletingUsers] = useState(false);
  const [deletingLogs, setDeletingLogs] = useState(false);
  const [runningResetAction, setRunningResetAction] = useState("");
  const [sendingUsersEmail, setSendingUsersEmail] = useState(false);
  const [emailTarget, setEmailTarget] = useState("selected");
  const [bulkEmailSubject, setBulkEmailSubject] = useState("");
  const [bulkEmailText, setBulkEmailText] = useState("");
  const [bulkEmailReason, setBulkEmailReason] = useState("");
  const [bulkEmailPreview, setBulkEmailPreview] = useState(null);
  const [bulkEmailConfirmation, setBulkEmailConfirmation] = useState("");
  const [logsReason, setLogsReason] = useState("");
  const [logsPreview, setLogsPreview] = useState(null);
  const [logsConfirmation, setLogsConfirmation] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [resetPreview, setResetPreview] = useState(null);
  const [resetConfirmation, setResetConfirmation] = useState("");

  const invalidateBulkEmailPreview = useCallback(() => {
    setBulkEmailPreview(null);
    setBulkEmailConfirmation("");
  }, []);

  const invalidateLogsPreview = useCallback(() => {
    setLogsPreview(null);
    setLogsConfirmation("");
  }, []);

  const invalidateResetPreview = useCallback(() => {
    setResetPreview(null);
    setResetConfirmation("");
  }, []);

  const requestJson = useCallback(
    async (url, options = {}, fallbackKey) => {
      const headers = {
        ...(options.headers || {})
      };
      if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      const res = await fetch(url, {
        cache: "no-store",
        ...options,
        headers
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(
          resolveApiMessage({
            payload,
            t,
            fallbackKey,
            fallbackText: t(fallbackKey, "Request failed")
          })
        );
      }
      return payload || {};
    },
    [t]
  );

  const getRoleLabel = useCallback(
    (role, isAdmin) => {
      if (isAdmin || String(role || "").toUpperCase() === "ADMIN") {
        return t("profile.role_short.admin", "Admin");
      }
      if (String(role || "").toUpperCase() === "SOCIAL_WORKER") {
        return t("profile.role_short.worker", "Worker");
      }
      if (String(role || "").toUpperCase() === "CLIENT") {
        return t("profile.role_short.client", "Client");
      }
      return role || "-";
    },
    [t]
  );

  const getThresholdLabel = useCallback(
    value => {
      const normalized = String(value || "").trim().toLowerCase();
      if (normalized === "exceeded") return t("admin.analytics.ai_costs.threshold.exceeded", "Ületatud");
      if (normalized === "high") return t("admin.analytics.ai_costs.threshold.high", "Kõrge");
      if (normalized === "warning") return t("admin.analytics.ai_costs.threshold.warning", "Hoiatus");
      return t("admin.analytics.ai_costs.threshold.normal", "Tavaline");
    },
    [t]
  );

  const getCoverageLabel = useCallback(
    value => (value ? t("admin.analytics.ai_costs.coverage.complete", "Täielik") : t("admin.analytics.ai_costs.coverage.partial", "Osaline")),
    [t]
  );

  const getAiCoverageNote = useCallback(
    note => {
      const raw = String(note || "").trim();
      if (!raw || raw.includes("not yet included") || raw.includes("has not been mirrored")) {
        return t(
          "admin.analytics.ai_costs.coverage.note_excluded",
          "RAG-i ja embeddingu kulu ei ole veel kaasatud, sest rag_cost_usage ei ole veel ChatLogi peegeldatud."
        );
      }
      if (raw.includes("included from mirrored rag_cost_usage")) {
        return t(
          "admin.analytics.ai_costs.coverage.note_included",
          "RAG-i ja embeddingu kulu on kaasatud ChatLogi peegeldatud rag_cost_usage sündmustest."
        );
      }
      return raw;
    },
    [t]
  );

  const getAiUnitModelNote = useCallback(
    note => {
      const raw = String(note || "").trim();
      if (!raw || raw.includes("internal_usage_units are normalized")) {
        return t(
          "admin.analytics.ai_costs.unit_model_note",
          "internal_usage_units on sisemine normaliseeritud analüütikaühik eelarve jälgimiseks. See ei ole täpne teenusepakkuja arveldus."
        );
      }
      return raw;
    },
    [t]
  );

  const summarizeEventMeta = useCallback(
    data => {
      const meta = data && typeof data === "object" ? data : {};
      const parts = [];
      if (typeof meta.ragMatchCount === "number") {
        parts.push(`${t("admin.analytics.meta.hits", "hits")}: ${formatCount(meta.ragMatchCount, localeTag)}`);
      }
      if (typeof meta.groupCount === "number") {
        parts.push(`${t("admin.analytics.meta.groups", "groups")}: ${formatCount(meta.groupCount, localeTag)}`);
      }
      if (typeof meta.chosenGroupCount === "number") {
        parts.push(`${t("admin.analytics.meta.chosen", "chosen")}: ${formatCount(meta.chosenGroupCount, localeTag)}`);
      }
      if (typeof meta.retrieved_count === "number") {
        parts.push(`${t("admin.analytics.meta.retrieved", "retrieved")}: ${formatCount(meta.retrieved_count, localeTag)}`);
      }
      if (typeof meta.selected_context_count === "number") {
        parts.push(`${t("admin.analytics.meta.selected_context", "selected")}: ${formatCount(meta.selected_context_count, localeTag)}`);
      }
      if (Array.isArray(meta.retrievers_used) && meta.retrievers_used.length) {
        parts.push(`${t("admin.analytics.meta.retrievers", "retrievers")}: ${meta.retrievers_used.join(", ")}`);
      }
      if (Array.isArray(meta.displayed_source_ids)) {
        parts.push(`${t("admin.analytics.meta.displayed_sources", "displayed")}: ${formatCount(meta.displayed_source_ids.length, localeTag)}`);
      }
      if (Array.isArray(meta.filtered_out_source_ids)) {
        parts.push(`${t("admin.analytics.meta.filtered_sources", "filtered")}: ${formatCount(meta.filtered_out_source_ids.length, localeTag)}`);
      }
      if (Array.isArray(meta.attribution_decisions)) {
        const displayCount = meta.attribution_decisions.filter(item => item?.decision === "display").length;
        const hideCount = meta.attribution_decisions.filter(item => item?.decision === "hide").length;
        parts.push(
          `${t("admin.analytics.meta.attribution", "attribution")}: ${formatCount(displayCount, localeTag)}/${formatCount(hideCount, localeTag)}`
        );
      }
      if (typeof meta.retrieval_trace_level === "string" && meta.retrieval_trace_level) {
        parts.push(`${t("admin.analytics.meta.trace_level", "trace")}: ${meta.retrieval_trace_level}`);
      }
      const queryPlan = meta.query_plan && typeof meta.query_plan === "object" ? meta.query_plan : null;
      const queryPlanMode = typeof queryPlan?.mode === "string" && queryPlan.mode
        ? queryPlan.mode
        : typeof meta.queryPlanMode === "string" && meta.queryPlanMode
          ? meta.queryPlanMode
          : "";
      const queryPlanOrder = typeof queryPlan?.query_order === "string" && queryPlan.query_order
        ? queryPlan.query_order
        : typeof meta.queryPlanQueryOrder === "string" && meta.queryPlanQueryOrder
          ? meta.queryPlanQueryOrder
          : "";
      const queryPlanStrategy = typeof queryPlan?.selection_strategy === "string" && queryPlan.selection_strategy
        ? queryPlan.selection_strategy
        : typeof meta.queryPlanSelectionStrategy === "string" && meta.queryPlanSelectionStrategy
          ? meta.queryPlanSelectionStrategy
          : "";
      if (queryPlanMode) {
        parts.push(`${t("admin.analytics.meta.query_plan_mode", "planner")}: ${queryPlanMode}`);
      }
      if (queryPlanOrder) {
        parts.push(`${t("admin.analytics.meta.query_plan_order", "query order")}: ${queryPlanOrder}`);
      }
      if (queryPlanStrategy) {
        parts.push(`${t("admin.analytics.meta.query_plan_strategy", "selection")}: ${queryPlanStrategy}`);
      }
      if (typeof queryPlan?.query_count === "number") {
        parts.push(`${t("admin.analytics.meta.query_plan_queries", "queries")}: ${formatCount(queryPlan.query_count, localeTag)}`);
      }
      if (typeof queryPlan?.rag_top_k === "number") {
        parts.push(`rag_top_k: ${formatCount(queryPlan.rag_top_k, localeTag)}`);
      }
      const hybridRetrieval = meta.hybrid_retrieval && typeof meta.hybrid_retrieval === "object" ? meta.hybrid_retrieval : null;
      const mergeStrategy = hybridRetrieval?.merge_strategy && typeof hybridRetrieval.merge_strategy === "object"
        ? hybridRetrieval.merge_strategy
        : null;
      if (typeof mergeStrategy?.strategy === "string" && mergeStrategy.strategy) {
        parts.push(`merge: ${mergeStrategy.strategy}`);
      }
      if (typeof mergeStrategy?.rrf_k === "number") {
        parts.push(`rrf_k: ${formatCount(mergeStrategy.rrf_k, localeTag)}`);
      }
      if (hybridRetrieval?.channel_counts && typeof hybridRetrieval.channel_counts === "object") {
        const channelCounts = Object.entries(hybridRetrieval.channel_counts)
          .filter(([, value]) => Number.isFinite(Number(value)))
          .map(([key, value]) => `${key}:${formatCount(Number(value), localeTag)}`)
          .join(", ");
        if (channelCounts) parts.push(`channels: ${channelCounts}`);
      }
      if (typeof hybridRetrieval?.top_hybrid_score === "number") {
        parts.push(`top_hybrid: ${formatDecimal(hybridRetrieval.top_hybrid_score, localeTag, 3)}`);
      }
      if (typeof meta.rag_risk_level === "string" && meta.rag_risk_level) {
        parts.push(`${t("admin.analytics.meta.rag_risk", "risk")}: ${meta.rag_risk_level}`);
      }
      if (typeof meta.rag_required_evidence === "string" && meta.rag_required_evidence) {
        parts.push(`${t("admin.analytics.meta.required_evidence", "evidence")}: ${meta.rag_required_evidence}`);
      }
      if (typeof meta.grounding === "string" && meta.grounding) {
        parts.push(`${t("admin.analytics.meta.grounding", "grounding")}: ${meta.grounding}`);
      }
      if (typeof meta.isCrisis === "boolean") {
        parts.push(
          `${t("admin.analytics.meta.crisis", "crisis")}: ${meta.isCrisis ? t("admin.common.yes", "Yes") : t("admin.common.no", "No")}`
        );
      }
      if (typeof meta.hasHistory === "boolean") {
        parts.push(
          `${t("admin.analytics.meta.history", "history")}: ${meta.hasHistory ? t("admin.common.yes", "Yes") : t("admin.common.no", "No")}`
        );
      }
      if (typeof meta.paymentState === "string" && meta.paymentState) {
        parts.push(`${t("admin.analytics.meta.payment_state", "payment state")}: ${meta.paymentState}`);
      }
      if (typeof meta.resultStatus === "string" && meta.resultStatus) {
        parts.push(`${t("admin.analytics.meta.result_status", "result status")}: ${meta.resultStatus}`);
      }
      if (typeof meta.subscriptionAction === "string" && meta.subscriptionAction) {
        parts.push(`${t("admin.analytics.meta.subscription_action", "subscription action")}: ${meta.subscriptionAction}`);
      }
      if (typeof meta.code === "string" && meta.code) {
        parts.push(`${t("admin.analytics.meta.alert_code", "alert code")}: ${meta.code}`);
      }
      if (typeof meta.fileSizeBytes === "number") {
        parts.push(`audio: ${formatCount(meta.fileSizeBytes, localeTag)} B`);
      }
      if (typeof meta.textLength === "number") {
        parts.push(`chars: ${formatCount(meta.textLength, localeTag)}`);
      }
      if (typeof meta.route === "string" && meta.route) {
        parts.push(`route: ${meta.route}`);
      }
      if (typeof meta.stage === "string" && meta.stage) {
        parts.push(`stage: ${meta.stage}`);
      }
      if (typeof meta.optional === "boolean") {
        parts.push(`optional: ${meta.optional ? t("admin.common.yes", "Yes") : t("admin.common.no", "No")}`);
      }
      if (typeof meta.error_message === "string" && meta.error_message) {
        parts.push(`error: ${meta.error_message.slice(0, 160)}`);
      }
      if (typeof meta.model === "string" && meta.model) {
        parts.push(`model: ${meta.model}`);
      }
      if (typeof meta.upstream_route === "string" && meta.upstream_route) {
        parts.push(`upstream route: ${meta.upstream_route}`);
      }
      if (typeof meta.upstream_stage === "string" && meta.upstream_stage) {
        parts.push(`upstream stage: ${meta.upstream_stage}`);
      }
      if (typeof meta.userId === "string" && meta.userId) {
        parts.push(`userId: ${meta.userId}`);
      }
      if (typeof meta.role === "string" && meta.role) {
        parts.push(`role: ${meta.role}`);
      }
      if (typeof meta.input_tokens === "number") {
        parts.push(`in: ${formatCount(meta.input_tokens, localeTag)}`);
      }
      if (typeof meta.cached_tokens === "number") {
        parts.push(`cached: ${formatCount(meta.cached_tokens, localeTag)}`);
      }
      if (typeof meta.output_tokens === "number") {
        parts.push(`out: ${formatCount(meta.output_tokens, localeTag)}`);
      }
      if (typeof meta.reasoning_tokens === "number") {
        parts.push(`reasoning: ${formatCount(meta.reasoning_tokens, localeTag)}`);
      }
      if (typeof meta.prompt_tokens === "number") {
        parts.push(`prompt: ${formatCount(meta.prompt_tokens, localeTag)}`);
      }
      if (typeof meta.total_tokens === "number") {
        parts.push(`total: ${formatCount(meta.total_tokens, localeTag)}`);
      }
      if (typeof meta.text_chars === "number") {
        parts.push(`chars: ${formatCount(meta.text_chars, localeTag)}`);
      }
      if (typeof meta.embedding_calls === "number") {
        parts.push(`embedding calls: ${formatCount(meta.embedding_calls, localeTag)}`);
      }
      if (typeof meta.embedding_input_count === "number") {
        parts.push(`embedding inputs: ${formatCount(meta.embedding_input_count, localeTag)}`);
      }
      if (typeof meta.chunk_count === "number") {
        parts.push(`chunks: ${formatCount(meta.chunk_count, localeTag)}`);
      }
      if (typeof meta.result_count === "number") {
        parts.push(`results: ${formatCount(meta.result_count, localeTag)}`);
      }
      if (typeof meta.top_k === "number") {
        parts.push(`top_k: ${formatCount(meta.top_k, localeTag)}`);
      }
      if (typeof meta.duration_seconds === "number") {
        parts.push(`sec: ${formatPercent(meta.duration_seconds, localeTag, 2)}`);
      }
      if (typeof meta.latency_ms === "number") {
        parts.push(`latency: ${formatDecimal(meta.latency_ms, localeTag, 2)} ms`);
      }
      if (typeof meta.conversation_id === "string" && meta.conversation_id) {
        parts.push(`conversation: ${meta.conversation_id}`);
      }
      if (typeof meta.artifact_id === "string" && meta.artifact_id) {
        parts.push(`artifact: ${meta.artifact_id}`);
      }
      if (typeof meta.research_job_id === "string" && meta.research_job_id) {
        parts.push(`research job: ${meta.research_job_id}`);
      }
      if (typeof meta.cost_estimation_basis === "string" && meta.cost_estimation_basis) {
        parts.push(`estimated: ${meta.cost_estimation_basis}`);
      }
      if (parts.length) return parts.join(" | ");
      const fallback = JSON.stringify(meta);
      return fallback && fallback !== "{}" ? fallback.slice(0, 160) : "-";
    },
    [localeTag, t]
  );

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await requestJson(
        `/api/admin/analytics/summary?locale=${encodeURIComponent(locale || "en")}`,
        undefined,
        "admin.analytics.errors.summary_fetch_failed"
      );
      setSummary(data);
      setPageError("");
    } catch (error) {
      setPageError(error?.message || t("admin.analytics.errors.summary_fetch_failed", "Summary fetch failed."));
    } finally {
      setLoadingSummary(false);
    }
  }, [locale, requestJson, t]);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      params.set("locale", locale || "en");
      if (eventFilter !== "all") params.set("event", eventFilter);
      if (isCrisisFilter === "true" || isCrisisFilter === "false") params.set("isCrisis", isCrisisFilter);
      const data = await requestJson(
        `/api/admin/analytics/events?${params.toString()}`,
        undefined,
        "admin.analytics.errors.events_fetch_failed"
      );
      setEvents(Array.isArray(data.items) ? data.items : []);
      setPageError("");
    } catch (error) {
      setPageError(error?.message || t("admin.analytics.errors.events_fetch_failed", "Events fetch failed."));
    } finally {
      setLoadingEvents(false);
    }
  }, [eventFilter, isCrisisFilter, locale, requestJson, t]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      params.set("days", "30");
      params.set("locale", locale || "en");
      if (usersQuery) params.set("q", usersQuery);
      const data = await requestJson(
        `/api/admin/analytics/users?${params.toString()}`,
        undefined,
        "admin.analytics.errors.users_fetch_failed"
      );
      setUsersAnalytics(data);
      setPageError("");
    } catch (error) {
      setPageError(error?.message || t("admin.analytics.errors.users_fetch_failed", "Users analytics fetch failed."));
    } finally {
      setLoadingUsers(false);
    }
  }, [locale, requestJson, t, usersQuery]);

  const loadAiCosts = useCallback(async () => {
    setLoadingAiCosts(true);
    try {
      const params = new URLSearchParams();
      params.set("days", "30");
      params.set("locale", locale || "en");
      const data = await requestJson(
        `/api/admin/analytics/ai-costs?${params.toString()}`,
        undefined,
        "admin.analytics.errors.summary_fetch_failed"
      );
      setAiCosts(data);
      setPageError("");
    } catch (error) {
      setPageError(error?.message || t("admin.analytics.errors.summary_fetch_failed", "AI cost analytics fetch failed."));
    } finally {
      setLoadingAiCosts(false);
    }
  }, [locale, requestJson, t]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSummary(), loadEvents(), loadUsers(), loadAiCosts()]);
    setRefreshing(false);
  }, [loadAiCosts, loadEvents, loadSummary, loadUsers]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadAiCosts();
  }, [loadAiCosts]);

  const visibleUserRows = useMemo(() => usersAnalytics?.items || [], [usersAnalytics]);
  const visibleUserIds = useMemo(() => visibleUserRows.map(row => row.userId), [visibleUserRows]);
  const visibleUserIdSet = useMemo(() => new Set(visibleUserIds), [visibleUserIds]);
  const selectedVisibleCount = useMemo(
    () => selectedUserIds.filter(id => visibleUserIdSet.has(id)).length,
    [selectedUserIds, visibleUserIdSet]
  );
  const allVisibleSelected = visibleUserIds.length > 0 && selectedVisibleCount === visibleUserIds.length;
  const canDeleteFilteredLogs = eventFilter !== "all" || isCrisisFilter !== "all";

  useEffect(() => {
    setSelectedUserIds(prev => prev.filter(id => visibleUserIdSet.has(id)));
  }, [visibleUserIdSet]);

  const groundingSummary = useMemo(() => {
    const dist = summary?.averages?.groundingDistribution;
    if (!dist) return null;
    const total = toNumber(dist.weak) + toNumber(dist.ok) + toNumber(dist.strong);
    if (!total) return null;
    return {
      weak: Math.round((100 * toNumber(dist.weak)) / total),
      ok: Math.round((100 * toNumber(dist.ok)) / total),
      strong: Math.round((100 * toNumber(dist.strong)) / total)
    };
  }, [summary]);

  const retrieverSummary = useMemo(
    () => joinCounts(summary?.averages?.retrieverDistribution, {}, localeTag),
    [localeTag, summary]
  );
  const queryPlannerSummary = useMemo(
    () => joinCounts(summary?.averages?.queryPlannerModeDistribution, {}, localeTag),
    [localeTag, summary]
  );
  const queryPlannerStrategySummary = useMemo(
    () => joinCounts(summary?.averages?.queryPlannerSelectionStrategyDistribution, {}, localeTag),
    [localeTag, summary]
  );

  const requestSplit = useMemo(() => {
    const total = toNumber(summary?.totalRequests);
    if (!total) return null;
    return {
      rag: Math.round((100 * toNumber(summary?.ragSearchCount)) / total),
      noContext: Math.round((100 * toNumber(summary?.noContextCount)) / total),
      stt: Math.round((100 * toNumber(summary?.chat?.sttRequests30d)) / total),
      tts: Math.round((100 * toNumber(summary?.chat?.ttsRequests30d)) / total)
    };
  }, [summary]);

  const helpStatusSummary = useMemo(
    () => joinCounts(summary?.help?.matchesByStatus30d, {}, localeTag),
    [localeTag, summary]
  );

  const documentActions = summary?.documents?.actions30d || {};
  const downloadCount = toNumber(documentActions.DOWNLOAD);
  const artifactDownloadCount = toNumber(documentActions.ARTIFACT_DOWNLOAD);
  const paymentPipeline = summary?.billing?.paymentPipeline30d || {};
  const paymentAlerts = Array.isArray(summary?.billing?.paymentAlerts30d) ? summary.billing.paymentAlerts30d : [];
  const documentStorage = summary?.documents?.storage || null;
  const ragFreshness = useMemo(() => summary?.ragDocs?.freshness || null, [summary]);
  const ragSourceQuality = useMemo(() => summary?.ragDocs?.sourceQuality?.summary || {}, [summary]);
  const ragFreshnessSummary = useMemo(() => ragFreshness?.summary || {}, [ragFreshness]);
  const ragMetadataQuality = useMemo(() => ragFreshnessSummary?.metadata_quality || {}, [ragFreshnessSummary]);
  const ragMetadataByCollection = useMemo(
    () => ragMetadataQuality?.by_collection || {},
    [ragMetadataQuality]
  );
  const ragMetadataByFileType = useMemo(
    () => ragMetadataQuality?.by_file_type || {},
    [ragMetadataQuality]
  );
  const ragQualityReasons = ragFreshnessSummary?.reasons || {};
  const ragHighRiskFreshness = ragFreshness?.highRisk || {};
  const ragFreshnessIssues = Array.isArray(ragFreshness?.issues) ? ragFreshness.issues : [];
  const ragHighRiskIssues = Array.isArray(ragFreshness?.highRiskIssues) ? ragFreshness.highRiskIssues : [];
  const ragMetadataCollectionSummary = useMemo(() => {
    const rows = Object.entries(ragMetadataByCollection)
      .map(([family, item]) => ({
        family,
        label: collectionFamilyLabels[family] || family,
        total: toNumber(item?.total),
        incomplete: toNumber(item?.incomplete)
      }))
      .filter(item => item.total > 0)
      .sort((left, right) => right.incomplete - left.incomplete || right.total - left.total)
      .slice(0, 4);
    return rows.map(item => `${item.label}: ${formatCount(item.incomplete, localeTag)}/${formatCount(item.total, localeTag)}`).join(" | ");
  }, [collectionFamilyLabels, localeTag, ragMetadataByCollection]);
  const ragMetadataFileTypeSummary = useMemo(() => {
    const rows = Object.entries(ragMetadataByFileType)
      .map(([fileType, item]) => ({
        fileType,
        label: sourceFileTypeLabels[fileType] || fileType,
        total: toNumber(item?.total),
        incomplete: toNumber(item?.incomplete)
      }))
      .filter(item => item.total > 0)
      .sort((left, right) => right.incomplete - left.incomplete || right.total - left.total)
      .slice(0, 4);
    return rows.map(item => `${item.label}: ${formatCount(item.incomplete, localeTag)}/${formatCount(item.total, localeTag)}`).join(" | ");
  }, [localeTag, ragMetadataByFileType, sourceFileTypeLabels]);
  const formatRemediationTarget = useCallback(
    (item = {}) => {
      const target = item.remediation?.target || {};
      const family = collectionFamilyLabels[target.collection_family || item.collection_family] || target.collection_family || item.collection_family || "-";
      const fileType = sourceFileTypeLabels[target.source_file_type || item.source_file_type] || target.source_file_type || item.source_file_type || "-";
      return `${family} / ${fileType}`;
    },
    [collectionFamilyLabels, sourceFileTypeLabels]
  );
  const formatRemediationAction = useCallback(
    (item = {}) => {
      const action = item.remediation?.action || "review_source_metadata";
      const label = remediationActionLabels[action] || action;
      const fields = Array.isArray(item.remediation?.fields) && item.remediation.fields.length
        ? `: ${item.remediation.fields.slice(0, 4).join(", ")}`
        : "";
      return `${label}${fields}`;
    },
    [remediationActionLabels]
  );
  const openRemediationTarget = useCallback(
    (item = {}) => {
      const href = item.remediation?.target?.admin_href;
      if (!href) return;
      router.push(localizePath(href, locale));
    },
    [locale, router]
  );

  const platformCards = useMemo(
    () => [
      {
        title: t("admin.analytics.platform.chat.title", "Chat and voice"),
        items: [
          {
            label: t("admin.analytics.platform.chat.conversations_total", "Conversations total"),
            value: formatCount(summary?.chat?.conversationsTotal || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.chat.active_conversations_30d", "Active conversations (30d)"),
            value: formatCount(summary?.chat?.activeConversations30d || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.chat.ai_errors_30d", "AI errors (30d)"),
            value: formatCount(
              toNumber(summary?.chat?.ragErrors30d) + toNumber(summary?.chat?.openAiErrors30d),
              localeTag
            )
          },
          {
            label: t("admin.analytics.platform.chat.rag_optional_errors_30d", "RAG optional errors (30d)"),
            value: formatCount(summary?.chat?.ragOptionalSearchErrors30d || 0, localeTag)
          }
        ]
      },
      {
        title: t("admin.analytics.platform.help.title", "Help flow"),
        items: [
          {
            label: t("admin.analytics.platform.help.open_requests", "Open requests"),
            value: formatCount(summary?.help?.openRequests || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.help.open_offers", "Open offers"),
            value: formatCount(summary?.help?.openOffers || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.help.matches_30d", "Matches (30d)"),
            value: formatCount(summary?.help?.matches30d || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.help.match_statuses_30d", "Match statuses (30d)"),
            value: helpStatusSummary || "-"
          }
        ]
      },
      {
        title: t("admin.analytics.platform.collaboration.title", "Rooms and invites"),
        items: [
          {
            label: t("admin.analytics.platform.collaboration.rooms_total", "Rooms total"),
            value: formatCount(summary?.collaboration?.roomsTotal || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.collaboration.active_rooms_30d", "Active rooms (30d)"),
            value: formatCount(summary?.collaboration?.activeRooms30d || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.collaboration.room_messages_30d", "Room messages (30d)"),
            value: formatCount(summary?.collaboration?.roomMessages30d || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.collaboration.pending_invites", "Pending invites"),
            value: formatCount(summary?.collaboration?.pendingInvites || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.collaboration.sponsored_invites_30d", "Sponsored invites (30d)"),
            value: formatCount(summary?.collaboration?.sponsoredInvites30d || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.collaboration.active_sponsored_members", "Active sponsored members"),
            value: formatCount(summary?.collaboration?.activeSponsoredMembers || 0, localeTag)
          }
        ]
      },
      {
        title: t("admin.analytics.platform.documents.title", "Documents and agent"),
        items: [
          {
            label: t("admin.analytics.platform.documents.total", "Documents total"),
            value: formatCount(summary?.documents?.total || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.documents.uploaded_30d", "Uploaded (30d)"),
            value: formatCount(summary?.documents?.uploaded30d || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.documents.draft_artifacts", "Draft artifacts"),
            value: formatCount(summary?.documents?.draftArtifacts || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.documents.final_artifacts", "Final artifacts"),
            value: formatCount(summary?.documents?.finalArtifacts || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.documents.created_30d", "Created (30d)"),
            value: formatCount(summary?.documents?.created30d || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.documents.approved_30d", "Approved (30d)"),
            value: formatCount(summary?.documents?.approved30d || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.documents.downloads_30d", "Document downloads (30d)"),
            value: formatCount(downloadCount, localeTag)
          },
          {
            label: t("admin.analytics.platform.documents.artifact_downloads_30d", "Artifact downloads (30d)"),
            value: formatCount(artifactDownloadCount, localeTag)
          },
          {
            label: t("admin.analytics.platform.documents.framework_acceptances_30d", "Framework acceptances (30d)"),
            value: formatCount(summary?.documents?.frameworkAcceptances?.accepted30d || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.documents.framework_signed_30d", "Framework agreement downloads (30d)"),
            value: formatCount(summary?.documents?.frameworkAcceptances?.signedDownloaded30d || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.documents.storage_total", "Stored files"),
            value: formatStorageSize(documentStorage?.totalBytes || 0, localeTag)
          },
          {
            label: t("admin.analytics.platform.documents.storage_free", "Free disk"),
            value: documentStorage?.volume ? formatStorageSize(documentStorage.volume.freeBytes || 0, localeTag) : "-"
          }
        ]
      }
    ],
    [artifactDownloadCount, documentStorage, downloadCount, helpStatusSummary, localeTag, summary, t]
  );

  const headerStats = useMemo(() => {
    const loadingLabel = t("admin.common.loading", "Loading...");
    return [
      {
        label: t("admin.analytics.platform.help.open_requests", "Open requests"),
        value: loadingSummary ? loadingLabel : formatCount(summary?.help?.openRequests || 0, localeTag)
      },
      {
        label: t("admin.analytics.billing.active_subscriptions", "Active subscriptions"),
        value: loadingSummary ? loadingLabel : formatCount(summary?.billing?.activeSubscriptions || 0, localeTag)
      },
      {
        label: t("admin.analytics.users.summary.users", "Users in table"),
        value: loadingUsers ? loadingLabel : formatCount(visibleUserRows.length, localeTag)
      },
      {
        label: t("admin.analytics.logs.title", "Logs"),
        value: loadingEvents ? loadingLabel : formatCount(events.length, localeTag)
      }
    ];
  }, [events.length, loadingEvents, loadingSummary, loadingUsers, localeTag, summary, t, visibleUserRows.length]);

  const liveSnapshotItems = useMemo(() => {
    const loadingLabel = t("admin.common.loading", "Loading...");
    const aiErrors = toNumber(summary?.chat?.ragErrors30d) + toNumber(summary?.chat?.openAiErrors30d);
    return [
      {
        label: t("admin.analytics.platform.help.open_offers", "Open offers"),
        value: loadingSummary ? loadingLabel : formatCount(summary?.help?.openOffers || 0, localeTag)
      },
      {
        label: t("admin.analytics.platform.collaboration.pending_invites", "Pending invites"),
        value: loadingSummary ? loadingLabel : formatCount(summary?.collaboration?.pendingInvites || 0, localeTag)
      },
      {
        label: t("admin.analytics.platform.documents.uploaded_30d", "Uploaded (30d)"),
        value: loadingSummary ? loadingLabel : formatCount(summary?.documents?.uploaded30d || 0, localeTag)
      },
      {
        label: t("admin.analytics.billing.paid_amount_30d", "Paid amount (30d)"),
        value: loadingSummary ? loadingLabel : formatMoney(summary?.billing?.paidAmount30d || 0, "EUR", localeTag)
      },
      {
        label: t("admin.analytics.platform.chat.ai_errors_30d", "AI errors (30d)"),
        value: loadingSummary ? loadingLabel : formatCount(aiErrors, localeTag)
      },
      {
        label: t("admin.analytics.platform.help.matches_30d", "Matches (30d)"),
        value: loadingSummary ? loadingLabel : formatCount(summary?.help?.matches30d || 0, localeTag)
      }
    ];
  }, [loadingSummary, localeTag, summary, t]);

  const aiCostCards = useMemo(
    () => [
      {
        title: t("admin.analytics.ai_costs.cards.total", "AI kulusündmused"),
        value: loadingAiCosts ? t("admin.common.loading", "Loading...") : formatCount(aiCosts?.summary?.total_events || 0, localeTag),
        meta: t("admin.analytics.ai_costs.cards.total_meta", "ChatLogi-põhised jälgitavuse sündmused")
      },
      {
        title: t("admin.analytics.ai_costs.cards.direct", "Otsese kasutuse sündmused"),
        value: loadingAiCosts ? t("admin.common.loading", "Loading...") : formatCount(aiCosts?.summary?.direct_usage_events || 0, localeTag),
        meta: t("admin.analytics.ai_costs.cards.direct_meta", "Kasutus, mille tagastavad otse teenusepakkuja API-d")
      },
      {
        title: t("admin.analytics.ai_costs.cards.estimated", "Hinnangulise kasutuse sündmused"),
        value: loadingAiCosts ? t("admin.common.loading", "Loading...") : formatCount(aiCosts?.summary?.estimated_usage_events || 0, localeTag),
        meta: t("admin.analytics.ai_costs.cards.estimated_meta", "Sündmused, mille kulu hinnatakse päringu mahu või teksti pikkuse järgi")
      },
      {
        title: t("admin.analytics.ai_costs.cards.users", "AI aktiivsusega kasutajad"),
        value: loadingAiCosts ? t("admin.common.loading", "Loading...") : formatCount(aiCosts?.summary?.unique_users || 0, localeTag),
        meta: t("admin.analytics.ai_costs.cards.users_meta", "Kasutajad praeguses AI jälgitavuse aknas")
      },
      {
        title: t("admin.analytics.ai_costs.cards.approx_eur", "Ligikaudne AI kulu"),
        value:
          loadingAiCosts
            ? t("admin.common.loading", "Loading...")
            : formatMoney(aiCosts?.summary?.approximate_cost_eur?.total || 0, "EUR", localeTag),
        meta: t(
          "admin.analytics.ai_costs.cards.approx_eur_meta",
          `Approximate provider-cost-equivalent over ${formatCount(aiCosts?.periodDays || 0, localeTag)} days`
        )
      }
    ],
    [aiCosts, loadingAiCosts, localeTag, t]
  );

  const aiCostAverageItems = useMemo(
    () => [
      {
        label: t("admin.analytics.ai_costs.avg.openai_input", "OpenAI sisendtokenid / vastus"),
        value:
          loadingAiCosts || aiCosts?.summary?.averages?.openai_per_response?.input_tokens == null
            ? loadingAiCosts
              ? t("admin.common.loading", "Loading...")
              : "-"
            : formatPercent(aiCosts.summary.averages.openai_per_response.input_tokens, localeTag, 1)
      },
      {
        label: t("admin.analytics.ai_costs.avg.openai_output", "OpenAI väljundtokenid / vastus"),
        value:
          loadingAiCosts || aiCosts?.summary?.averages?.openai_per_response?.output_tokens == null
            ? loadingAiCosts
              ? t("admin.common.loading", "Loading...")
              : "-"
            : formatPercent(aiCosts.summary.averages.openai_per_response.output_tokens, localeTag, 1)
      },
      {
        label: t("admin.analytics.ai_costs.avg.tts_chars", "TTS minutid / töö"),
        value:
          loadingAiCosts || aiCosts?.summary?.averages?.tts_per_job?.duration_seconds == null
            ? loadingAiCosts
              ? t("admin.common.loading", "Loading...")
              : "-"
            : formatMinutes(aiCosts.summary.averages.tts_per_job.duration_seconds / 60, localeTag, 2)
      },
      {
        label: t("admin.analytics.ai_costs.avg.stt_tokens", "STT tokenid kokku / töö"),
        value:
          loadingAiCosts || aiCosts?.summary?.averages?.stt_per_job?.total_tokens == null
            ? loadingAiCosts
              ? t("admin.common.loading", "Loading...")
              : "-"
            : formatPercent(aiCosts.summary.averages.stt_per_job.total_tokens, localeTag, 1)
      },
      {
        label: t("admin.analytics.ai_costs.avg.stt_duration", "STT minutid / töö"),
        value:
          loadingAiCosts || aiCosts?.summary?.averages?.stt_per_job?.duration_seconds == null
            ? loadingAiCosts
              ? t("admin.common.loading", "Loading...")
              : "-"
            : formatMinutes(aiCosts.summary.averages.stt_per_job.duration_seconds / 60, localeTag, 2)
      }
    ],
    [aiCosts, loadingAiCosts, localeTag, t]
  );

  const aiApproxCostItems = useMemo(
    () => {
      const approx = aiCosts?.summary?.approximate_cost_eur;
      const loadingLabel = t("admin.common.loading", "Loading...");
      return [
        {
          label: t("admin.analytics.ai_costs.approx.total", "Kokku"),
          value: loadingAiCosts ? loadingLabel : formatMoney(approx?.total || 0, "EUR", localeTag)
        },
        {
          label: t("admin.analytics.ai_costs.approx.direct", "Otsene"),
          value: loadingAiCosts ? loadingLabel : formatMoney(approx?.direct || 0, "EUR", localeTag)
        },
        {
          label: t("admin.analytics.ai_costs.approx.estimated", "Hinnanguline"),
          value: loadingAiCosts ? loadingLabel : formatMoney(approx?.estimated || 0, "EUR", localeTag)
        },
        {
          label: t("admin.analytics.ai_costs.approx.openai", "Tekst"),
          value: loadingAiCosts ? loadingLabel : formatMoney(approx?.openai || 0, "EUR", localeTag)
        },
        {
          label: t("admin.analytics.ai_costs.approx.rag", "RAG"),
          value: loadingAiCosts ? loadingLabel : formatMoney(approx?.rag || 0, "EUR", localeTag)
        },
        {
          label: t("admin.analytics.ai_costs.approx.tts_stt", "TTS + STT"),
          value: loadingAiCosts ? loadingLabel : formatMoney((approx?.tts || 0) + (approx?.stt || 0), "EUR", localeTag)
        }
      ];
    },
    [aiCosts, loadingAiCosts, localeTag, t]
  );

  const aiCostBreakdownCards = useMemo(
    () => [
      {
        title: t("admin.analytics.ai_costs.breakdown.role", "Rolli järgi"),
        items: (aiCosts?.breakdowns?.by_role || []).slice(0, 5).map(row => ({
          label: row.label || row.key || "-",
          value: formatCount(row.events || 0, localeTag)
        }))
      },
      {
        title: t("admin.analytics.ai_costs.breakdown.package", "Paketi järgi"),
        items: (aiCosts?.breakdowns?.by_package || []).slice(0, 5).map(row => ({
          label: row.label || row.key || "-",
          value: formatCount(row.events || 0, localeTag)
        }))
      },
      {
        title: t("admin.analytics.ai_costs.breakdown.model", "Mudeli järgi"),
        items: (aiCosts?.breakdowns?.by_model || []).slice(0, 5).map(row => ({
          label: row.label || row.key || "-",
          value: formatCount(row.events || 0, localeTag)
        }))
      }
    ],
    [aiCosts, localeTag, t]
  );

  const aiAttributionItems = useMemo(
    () => {
      const completeness = aiCosts?.summary?.attribution_completeness;
      const loadingLabel = t("admin.common.loading", "Loading...");
      const totalEvents = completeness?.openai_usage_events || 0;
      const userIdPct = completeness?.pct_with_userId;
      const rolePct = completeness?.pct_with_role;
      const excludedRoutes = Array.isArray(completeness?.excluded_internal_routes)
        ? completeness.excluded_internal_routes.filter(Boolean).join(", ")
        : "";

      return [
        {
          label: t("admin.analytics.ai_costs.attribution.scope", "Ulatus"),
          value:
            loadingAiCosts
              ? loadingLabel
              : t("admin.analytics.ai_costs.attribution.scope_value", "Kasutajale suunatud tavalised openai_usage tekstisündmused")
        },
        {
          label: t("admin.analytics.ai_costs.attribution.events", "Kaasatud sündmused"),
          value: loadingAiCosts ? loadingLabel : formatCount(totalEvents, localeTag)
        },
        {
          label: t("admin.analytics.ai_costs.attribution.user_id", "Read kasutaja ID-ga"),
          value:
            loadingAiCosts
              ? loadingLabel
              : userIdPct == null
                ? "-"
                : `${formatPercent(userIdPct, localeTag, 1)}% (${formatCount(completeness?.with_userId || 0, localeTag)})`
        },
        {
          label: t("admin.analytics.ai_costs.attribution.role", "Read rolliga"),
          value:
            loadingAiCosts
              ? loadingLabel
              : rolePct == null
                ? "-"
                : `${formatPercent(rolePct, localeTag, 1)}% (${formatCount(completeness?.with_role || 0, localeTag)})`
        },
        {
          label: t("admin.analytics.ai_costs.attribution.excluded", "Välja jäetud sisemised marsruudid"),
          value: loadingAiCosts ? loadingLabel : excludedRoutes || "-"
        }
      ];
    },
    [aiCosts, loadingAiCosts, localeTag, t]
  );

  const aiThresholdCards = useMemo(
    () => [
      {
        title: t("admin.analytics.ai_costs.threshold.users_70", "Kasutajad >= 70%"),
        value:
          loadingAiCosts
            ? t("admin.common.loading", "Loading...")
            : formatCount(aiCosts?.summary?.threshold_counts?.users_at_or_above_70_pct || 0, localeTag)
      },
      {
        title: t("admin.analytics.ai_costs.threshold.users_85", "Kasutajad >= 85%"),
        value:
          loadingAiCosts
            ? t("admin.common.loading", "Loading...")
            : formatCount(aiCosts?.summary?.threshold_counts?.users_at_or_above_85_pct || 0, localeTag)
      },
      {
        title: t("admin.analytics.ai_costs.threshold.users_100", "Kasutajad >= 100%"),
        value:
          loadingAiCosts
            ? t("admin.common.loading", "Loading...")
            : formatCount(aiCosts?.summary?.threshold_counts?.users_at_or_above_100_pct || 0, localeTag)
      },
      {
        title: t("admin.analytics.ai_costs.threshold.packages_85", "Paketid >= 85%"),
        value:
          loadingAiCosts
            ? t("admin.common.loading", "Loading...")
            : formatCount(aiCosts?.summary?.threshold_counts?.packages_at_or_above_85_pct || 0, localeTag)
      }
    ],
    [aiCosts, loadingAiCosts, localeTag, t]
  );

  const aiAdminGuideItems = useMemo(
    () => [
      {
        label: t("admin.analytics.ai_costs.guide.includes", "Praegu kaasatud"),
        value: "openai_usage, rag_cost_usage, tts_cost_usage, stt_cost_usage"
      },
      {
        label: t("admin.analytics.ai_costs.guide.units", "internal_usage_units"),
        value: t(
          "admin.analytics.ai_costs.guide.units_value",
          "Normaliseeritud sisemised kasutusühikud võrdlemiseks ja lävendite jälgimiseks, mitte täpne teenusepakkuja arveldus."
        )
      },
      {
        label: t("admin.analytics.ai_costs.guide.approx_eur", "Ligikaudne EUR"),
        value: t(
          "admin.analytics.ai_costs.guide.approx_eur_value",
          "Ligikaudne EUR on teenusepakkuja kuluga võrreldav haldusvaade. See aitab toote- ja hinnastusotsuseid teha, kuid ei ole arve täpsusega arveldus."
        )
      },
      {
        label: t("admin.analytics.ai_costs.guide.thresholds", "Lävendid"),
        value: t("admin.analytics.ai_costs.guide.thresholds_value", "Tavaline <70%, hoiatus >=70%, kõrge >=85%, ületatud >=100%.")
      },
      {
        label: t("admin.analytics.ai_costs.guide.breakdowns", "Jaotused"),
        value: t(
          "admin.analytics.ai_costs.guide.breakdowns_value",
          "Marsruut/etapp näitab, kus kasutus tekib, roll/pakett näitab, kellele see langeb, ja mudel näitab kasutust vedavat mudeliperekonda."
        )
      },
      {
        label: t("admin.analytics.ai_costs.guide.top", "Suurimad kasutajad ja funktsioonid"),
        value: t(
          "admin.analytics.ai_costs.guide.top_value",
          "Jälgi kasutuse koondumist, korduvaid raskeid etappe ning suuri erinevusi otsese ja hinnangulise kasutuse vahel."
        )
      },
      {
        label: t("admin.analytics.ai_costs.guide.coverage", "Kaetus"),
        value: t(
          "admin.analytics.ai_costs.guide.coverage_value",
          "Osa kasutusest tuleb otse teenusepakkuja vastustest, osa on hinnanguline. Käsitle seda töövaatena, mitte arvena."
        )
      },
      {
        label: t("admin.analytics.ai_costs.guide.actions", "Tööalane kasutus"),
        value: t(
          "admin.analytics.ai_costs.guide.actions_value",
          "Enne hinnastuse või limiitide muutmist kontrolli kaetust, marsruudi/etapi koondumist, kasutaja/paketi lävendi olekut ja seda, kas suur kasutus on ootuspärane."
        )
      }
    ],
    [t]
  );

  const toggleUserSelection = useCallback(userId => {
    invalidateBulkEmailPreview();
    setSelectedUserIds(prev => (prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]));
  }, [invalidateBulkEmailPreview]);

  const toggleAllVisibleUsers = useCallback(() => {
    invalidateBulkEmailPreview();
    setSelectedUserIds(prev => {
      if (allVisibleSelected) return prev.filter(id => !visibleUserIdSet.has(id));
      const merged = new Set(prev);
      for (const id of visibleUserIds) merged.add(id);
      return Array.from(merged);
    });
  }, [allVisibleSelected, invalidateBulkEmailPreview, visibleUserIdSet, visibleUserIds]);

  const handleUsersSearch = useCallback(
    event => {
      event.preventDefault();
      setUsersQuery(usersQueryDraft.trim());
    },
    [usersQueryDraft]
  );

  const handleUsersSearchClear = useCallback(() => {
    setUsersQueryDraft("");
    setUsersQuery("");
  }, []);

  const handleDeleteSelectedUsers = useCallback(async () => {
    if (!selectedUserIds.length || deletingUsers) return;
    const confirmed = window.confirm(
      t("admin.analytics.users.actions.delete_confirm", { count: selectedUserIds.length }, "Delete selected users?")
    );
    if (!confirmed) return;

    setDeletingUsers(true);
    setUsersNotice(null);
    try {
      const data = await requestJson(
        "/api/admin/analytics/users",
        {
          method: "DELETE",
          body: JSON.stringify({
            locale,
            userIds: selectedUserIds
          })
        },
        "admin.analytics.errors.users_delete_failed"
      );

      const blockedAdmins = Array.isArray(data?.blocked?.admins) ? data.blocked.admins.length : 0;
      const blockedSelf = data?.blocked?.self ? 1 : 0;
      const deletedIds = Array.isArray(data?.deletedIds) ? data.deletedIds : [];
      setSelectedUserIds(prev => prev.filter(id => !deletedIds.includes(id)));
      setUsersNotice({
        tone: "success",
        message: t(
          "admin.analytics.users.actions.delete_done",
          {
            deleted: toNumber(data?.deletedCount || 0),
            blocked: blockedAdmins + blockedSelf
          },
          "Users deleted."
        )
      });
      await Promise.all([loadSummary(), loadUsers()]);
    } catch (error) {
      setUsersNotice({
        tone: "error",
        message: error?.message || t("admin.analytics.errors.users_delete_failed", "Failed to delete selected users.")
      });
    } finally {
      setDeletingUsers(false);
    }
  }, [deletingUsers, loadSummary, loadUsers, locale, requestJson, selectedUserIds, t]);

  const handlePreviewBulkEmail = useCallback(async () => {
    if (sendingUsersEmail) return;
    const subject = bulkEmailSubject.trim();
    const text = bulkEmailText.trim();
    if (!subject || !text) {
      setUsersNotice({
        tone: "error",
        message: t("admin.analytics.errors.users_email_invalid_payload", "Email subject and message are required.")
      });
      return;
    }
    if (emailTarget === "selected" && !selectedUserIds.length) {
      setUsersNotice({
        tone: "warn",
        message: t("admin.analytics.users.actions.select_users_first", "Select users first.")
      });
      return;
    }

    setSendingUsersEmail(true);
    setUsersNotice(null);
    try {
      const data = await requestJson(
        "/api/admin/analytics/users",
        {
          method: "POST",
          body: JSON.stringify({
            locale,
            target: emailTarget,
            userIds: emailTarget === "selected" ? selectedUserIds : [],
            subject,
            text,
            reason: bulkEmailReason,
            dryRun: true
          })
        },
        "admin.analytics.errors.users_email_send_failed"
      );
      setBulkEmailPreview(data);
      setBulkEmailConfirmation("");
      setUsersNotice({
        tone: "warn",
        message: t(
          "admin.analytics.dangerous.impact",
          { count: toNumber(data?.recipientCount || 0) },
          "Affected records: {count}."
        )
      });
    } catch (error) {
      setUsersNotice({
        tone: "error",
        message: error?.message || t("admin.analytics.errors.users_email_send_failed", "Failed to send bulk email.")
      });
    } finally {
      setSendingUsersEmail(false);
    }
  }, [bulkEmailReason, bulkEmailSubject, bulkEmailText, emailTarget, locale, requestJson, selectedUserIds, sendingUsersEmail, t]);

  const handleSendBulkEmail = useCallback(async () => {
    if (sendingUsersEmail || !bulkEmailPreview) return;
    setSendingUsersEmail(true);
    setUsersNotice(null);
    try {
      const data = await requestJson(
        "/api/admin/analytics/users",
        {
          method: "POST",
          body: JSON.stringify({
            locale,
            target: emailTarget,
            userIds: emailTarget === "selected" ? selectedUserIds : [],
            subject: bulkEmailSubject.trim(),
            text: bulkEmailText.trim(),
            reason: bulkEmailReason,
            confirmation: bulkEmailConfirmation,
            previewToken: bulkEmailPreview.previewToken,
            dryRun: false
          })
        },
        "admin.analytics.errors.users_email_send_failed"
      );

      setUsersNotice({
        tone: toNumber(data?.failedCount) > 0 ? "warn" : "success",
        message: t(
          "admin.analytics.users.actions.email_done",
          { sent: toNumber(data?.sentCount || 0), failed: toNumber(data?.failedCount || 0) },
          "Bulk email finished."
        )
      });
      if (!toNumber(data?.failedCount || 0)) {
        setBulkEmailSubject("");
        setBulkEmailText("");
        setBulkEmailReason("");
      }
      invalidateBulkEmailPreview();
    } catch (error) {
      setUsersNotice({
        tone: "error",
        message: error?.message || t("admin.analytics.errors.users_email_send_failed", "Failed to send bulk email.")
      });
    } finally {
      setSendingUsersEmail(false);
    }
  }, [
    bulkEmailConfirmation,
    bulkEmailPreview,
    bulkEmailReason,
    bulkEmailSubject,
    bulkEmailText,
    emailTarget,
    invalidateBulkEmailPreview,
    locale,
    requestJson,
    selectedUserIds,
    sendingUsersEmail,
    t
  ]);

  const handlePreviewLogDeletion = useCallback(
    async deleteAll => {
      if (deletingLogs) return;
      setDeletingLogs(true);
      setLogsNotice(null);
      try {
        const data = await requestJson(
          "/api/admin/analytics/events",
          {
            method: "DELETE",
            body: JSON.stringify({
              locale,
              all: deleteAll,
              event: deleteAll || eventFilter === "all" ? "" : eventFilter,
              isCrisis: deleteAll ? "all" : isCrisisFilter,
              reason: logsReason,
              dryRun: true
            })
          },
          "admin.analytics.errors.logs_delete_failed"
        );
        setLogsPreview({ ...data, all: deleteAll });
        setLogsConfirmation("");
        setLogsNotice({
          tone: "warn",
          message: t(
            "admin.analytics.dangerous.impact",
            { count: toNumber(data?.count || 0) },
            "Affected records: {count}."
          )
        });
      } catch (error) {
        setLogsNotice({
          tone: "error",
          message: error?.message || t("admin.analytics.errors.logs_delete_failed", "Failed to delete logs.")
        });
      } finally {
        setDeletingLogs(false);
      }
    },
    [deletingLogs, eventFilter, isCrisisFilter, locale, logsReason, requestJson, t]
  );

  const handleDeleteLogs = useCallback(
    async () => {
      if (deletingLogs || !logsPreview) return;
      setDeletingLogs(true);
      setLogsNotice(null);
      try {
        const data = await requestJson(
          "/api/admin/analytics/events",
          {
            method: "DELETE",
            body: JSON.stringify({
              locale,
              all: logsPreview.all,
              event: logsPreview.all || eventFilter === "all" ? "" : eventFilter,
              isCrisis: logsPreview.all ? "all" : isCrisisFilter,
              reason: logsReason,
              confirmation: logsConfirmation,
              previewToken: logsPreview.previewToken,
              dryRun: false
            })
          },
          "admin.analytics.errors.logs_delete_failed"
        );
        setLogsNotice({
          tone: "success",
          message: t(
            "admin.analytics.logs.actions.delete_done",
            { count: toNumber(data?.deletedCount || 0) },
            "Logs deleted."
          )
        });
        invalidateLogsPreview();
        setLogsReason("");
        await refreshAll();
      } catch (error) {
        setLogsNotice({
          tone: "error",
          message: error?.message || t("admin.analytics.errors.logs_delete_failed", "Failed to delete logs.")
        });
      } finally {
        setDeletingLogs(false);
      }
    },
    [
      deletingLogs,
      eventFilter,
      invalidateLogsPreview,
      isCrisisFilter,
      locale,
      logsConfirmation,
      logsPreview,
      logsReason,
      refreshAll,
      requestJson,
      t
    ]
  );

  const handlePreviewReset = useCallback(
    async action => {
      if (!action || runningResetAction) return;
      const actionLabel = t(`admin.analytics.reset.actions.${action}`, action);
      setRunningResetAction(action);
      setResetNotice(null);
      try {
        const dryRun = await requestJson(
          "/api/admin/analytics/reset",
          {
            method: "POST",
            body: JSON.stringify({
              locale,
              action,
              dryRun: true,
              reason: resetReason
            })
          },
          "admin.analytics.errors.reset_failed"
        );
        setResetPreview({ ...dryRun, action, actionLabel });
        setResetConfirmation("");
        setResetNotice({
          tone: dryRun?.executionAllowed === false ? "error" : "warn",
          message: t(
            dryRun?.executionAllowed === false
              ? "admin.analytics.reset.production_disabled"
              : "admin.analytics.dangerous.impact",
            { count: toNumber(dryRun?.total || 0) },
            dryRun?.executionAllowed === false
              ? "Reset execution is disabled in production."
              : "Affected records: {count}."
          )
        });
      } catch (error) {
        setResetNotice({
          tone: "error",
          message: error?.message || t("admin.analytics.errors.reset_failed", "Failed to run reset action.")
        });
      } finally {
        setRunningResetAction("");
      }
    },
    [locale, requestJson, resetReason, runningResetAction, t]
  );

  const handleRunReset = useCallback(
    async () => {
      if (!resetPreview || runningResetAction || resetPreview.executionAllowed === false) return;
      setRunningResetAction(resetPreview.action);
      setResetNotice(null);
      try {
        const result = await requestJson(
          "/api/admin/analytics/reset",
          {
            method: "POST",
            body: JSON.stringify({
              locale,
              action: resetPreview.action,
              dryRun: false,
              reason: resetReason,
              confirmation: resetConfirmation,
              previewToken: resetPreview.previewToken
            })
          },
          "admin.analytics.errors.reset_failed"
        );
        setResetNotice({
          tone: "success",
          message: t(
            "admin.analytics.reset.done",
            { action: resetPreview.actionLabel, count: toNumber(result?.total || 0) },
            "Reset completed."
          )
        });
        invalidateResetPreview();
        setResetReason("");
        await refreshAll();
      } catch (error) {
        setResetNotice({
          tone: "error",
          message: error?.message || t("admin.analytics.errors.reset_failed", "Failed to run reset action.")
        });
      } finally {
        setRunningResetAction("");
      }
    },
    [
      invalidateResetPreview,
      locale,
      refreshAll,
      requestJson,
      resetConfirmation,
      resetPreview,
      resetReason,
      runningResetAction,
      t
    ]
  );

  return (
    <div className={pageClassName}>
      <div className={pageHeaderClassName} id="analytics-overview">
        <BackButton
          onClick={() => router.push(localizePath("/", locale))}
          ariaLabel={t("admin.common.back", "Back")}
          className={backButtonClassName}
        />
        <div className={pageHeaderSurfaceClassName}>
          <h1 className={pageTitleClassName}>{t("admin.analytics.title", "Analytics")}</h1>
          <div className={pageHeaderSubtitleClassName}>
            {t(
              "admin.analytics.platform.subtitle",
              "Overview of chat, help, collaboration, documents, payments and platform limits."
            )}
          </div>
          <div className={pageHeaderMetaRowClassName}>
            <div className={pageHeaderMetaClassName}>
              {headerStats.map(item => (
                <HeaderPill key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
            <div className={pageHeaderToolbarClassName}>
              <Button
                variant="primary"
                className={refreshButtonClassName}
                onClick={refreshAll}
                disabled={refreshing || loadingSummary || loadingEvents || loadingUsers || loadingAiCosts}
              >
                {refreshing ? t("admin.common.loading_data", "Loading...") : t("admin.common.refresh", "Refresh")}
              </Button>
            </div>
          </div>
          <div className={pageHeaderDividerClassName} />
          <div className={sectionNavClassName}>
            {sectionLinks.map(item => (
              <a key={item.href} href={item.href} className={sectionNavLinkClassName}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <SectionAlert tone="error" message={pageError} />

      <div className={summaryPanelClassName}>
        <div className={summaryPanelBodyClassName}>
          <div className={summaryDeckClassName}>
            <div className={topKpiGridClassName}>
              <KpiCard
                title={t("admin.analytics.kpis.requests_30d.title", "Requests (30d)")}
                value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.totalRequests || 0, localeTag)}
                meta={t("admin.analytics.kpis.requests_30d.meta", "Total chat requests")}
              />
              <KpiCard
                title={t("admin.analytics.kpis.rag_searches.title", "RAG searches")}
                value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.ragSearchCount || 0, localeTag)}
                meta={
                  requestSplit
                    ? t("admin.analytics.kpis.share", { percent: requestSplit.rag }, "Share {percent}%")
                    : t("admin.analytics.kpis.share_missing", "Share unavailable")
                }
              />
              <KpiCard
                title={t("admin.analytics.kpis.rag_traces.title", "RAG traces")}
                value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.ragTraceCount || 0, localeTag)}
                meta={t("admin.analytics.kpis.rag_traces.meta", "Attribution trace events")}
              />
              <KpiCard
                title={t("admin.analytics.kpis.no_context.title", "No context")}
                value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.noContextCount || 0, localeTag)}
                meta={
                  requestSplit
                    ? t("admin.analytics.kpis.share", { percent: requestSplit.noContext }, "Share {percent}%")
                    : t("admin.analytics.kpis.share_missing", "Share unavailable")
                }
              />
              <KpiCard
                title={t("admin.analytics.kpis.crisis.title", "Crisis")}
                value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.totalCrisis || 0, localeTag)}
                meta={t("admin.analytics.kpis.crisis.meta", "Detected crisis risk")}
              />
              <KpiCard
                title={t("admin.analytics.kpis.stt_requests.title", "STT requests")}
                value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.chat?.sttRequests30d || 0, localeTag)}
                meta={
                  requestSplit
                    ? t("admin.analytics.kpis.stt_requests.meta", { percent: requestSplit.stt }, "Voice input share {percent}%")
                    : t("admin.analytics.kpis.share_missing", "Share unavailable")
                }
              />
              <KpiCard
                title={t("admin.analytics.kpis.tts_requests.title", "TTS requests")}
                value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.chat?.ttsRequests30d || 0, localeTag)}
                meta={
                  requestSplit
                    ? t("admin.analytics.kpis.tts_requests.meta", { percent: requestSplit.tts }, "Voice output share {percent}%")
                    : t("admin.analytics.kpis.share_missing", "Share unavailable")
                }
              />
            </div>
            <MetricListCard title={t("admin.analytics.snapshot.title", "Live snapshot")} items={liveSnapshotItems} />
          </div>
        </div>
      </div>

      <div className={summaryPanelClassName}>
        <div className={summaryPanelBodyClassName}>
          <div className={kpiGridClassName}>
            <KpiCard
              title={t("admin.analytics.kpis.rag_averages.title", "Averages (RAG)")}
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : t(
                      "admin.analytics.kpis.rag_averages.meta",
                      {
                        hits: formatPercent(summary?.averages?.avgRagMatchCount || 0, localeTag, 1),
                        groups: formatPercent(summary?.averages?.avgGroupCount || 0, localeTag, 1),
                        chosen: formatPercent(summary?.averages?.avgChosenGroupCount || 0, localeTag, 1),
                        displayed: formatPercent(summary?.averages?.avgDisplayedSourceCount || 0, localeTag, 1),
                        filtered: formatPercent(summary?.averages?.avgFilteredOutSourceCount || 0, localeTag, 1)
                      },
                      "Hits {hits}, groups {groups}, chosen {chosen}, displayed {displayed}, filtered {filtered}"
                    )
              }
            />
            <KpiCard title={t("admin.analytics.kpis.grounding.title", "Grounding")}>
              {groundingSummary ? (
                <>
                  <UsageBar value={100} />
                  <div className={kpiMetaClassName}>
                    {t(
                      "admin.analytics.kpis.grounding.meta",
                      {
                        strong: groundingSummary.strong,
                        ok: groundingSummary.ok,
                        weak: groundingSummary.weak
                      },
                      "Strong {strong}% | OK {ok}% | Weak {weak}%"
                    )}
                  </div>
                </>
              ) : (
                <div className={kpiMetaClassName}>{loadingSummary ? t("admin.common.loading", "Loading...") : "-"}</div>
              )}
            </KpiCard>
            <KpiCard
              title={t("admin.analytics.kpis.retrievers.title", "Retrievers")}
              meta={loadingSummary ? t("admin.common.loading", "Loading...") : retrieverSummary || "-"}
            />
            <KpiCard
              title={t("admin.analytics.kpis.query_planner.title", "Query planner")}
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : queryPlannerSummary
                    ? `${queryPlannerSummary}${queryPlannerStrategySummary ? ` | ${queryPlannerStrategySummary}` : ""}`
                    : "-"
              }
            />
          </div>
        </div>
      </div>

      <div className={cardClassName} id="analytics-platform">
        <div className={cardBodyClassName}>
          <div className={sectionHeadClassName}>
            <div>
              <CardTitle>{t("admin.analytics.platform.title", "Platform overview")}</CardTitle>
            </div>
          </div>
          <div className={platformGridClassName}>
            {platformCards.map(card => (
              <MetricListCard key={card.title} title={card.title} items={card.items} />
            ))}
          </div>
        </div>
      </div>

      <div className={cardClassName} id="analytics-storage">
        <div className={cardBodyClassName}>
          <div className={sectionHeadClassName}>
            <div>
              <CardTitle>{t("admin.analytics.storage.title", "Salvestusruumi ülevaade")}</CardTitle>
              <div className={sectionSubClassName}>
                {t(
                  "admin.analytics.storage.subtitle",
                  "Serveripoolne failimaht dokumentide, RAG admini üleslaadimiste, materjalide ja agendi salvestuse jaoks."
                )}
              </div>
            </div>
          </div>
          <div className={docsGridClassName}>
            <KpiCard
              title={t("admin.analytics.storage.total", "Salvestatud faile kokku")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatStorageSize(documentStorage?.totalBytes || 0, localeTag)}
              meta={t("admin.analytics.storage.total_meta", "Rakenduse jälgitav failisalvestuse kasutus.")}
            />
            <KpiCard
              title={t("admin.analytics.storage.docs_uploads", "Dokumentide üleslaadimised")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatStorageSize(documentStorage?.docsUploadsBytes || 0, localeTag)}
              meta={t("admin.analytics.storage.docs_uploads_meta", "Kasutajate dokumendid ja loodud kinnituskirjed.")}
            />
            <KpiCard
              title={t("admin.analytics.storage.rag_admin", "RAG admini failid")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatStorageSize(documentStorage?.ragAdminBytes || 0, localeTag)}
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : `${t("admin.analytics.storage.rag_admin_meta", "KOV ja organisatsioonide adminifailid.")} ${formatStorageSize(documentStorage?.kovBytes || 0, localeTag)} / ${formatStorageSize(documentStorage?.organizationBytes || 0, localeTag)}`
              }
            />
            <KpiCard
              title={t("admin.analytics.storage.materials", "Materjalide üleslaadimised")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatStorageSize(documentStorage?.materialsBytes || 0, localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.storage.agent", "Agendi salvestus")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatStorageSize(documentStorage?.agentBytes || 0, localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.storage.free_disk", "Vaba kettaruum salvestusmahul")}
              value={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : documentStorage?.volume
                    ? formatStorageSize(documentStorage.volume.freeBytes || 0, localeTag)
                    : "-"
              }
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : documentStorage?.volume
                    ? `${t("admin.analytics.storage.disk_total", "Kettamaht kokku")}: ${formatStorageSize(documentStorage.volume.totalBytes || 0, localeTag)} | ${t("admin.analytics.storage.disk_used", "Kasutatud")}: ${formatPercent(documentStorage.volume.usedPct || 0, localeTag, 1)}%`
                    : t("admin.analytics.storage.disk_unavailable", "Salvestusmahu hetkeseis ei ole saadaval.")
              }
            />
          </div>
          {!loadingSummary && Array.isArray(documentStorage?.issues) && documentStorage.issues.length ? (
            <SectionAlert
              tone="warn"
              message={t("admin.analytics.storage.issues", "Mõnda salvestusteed ei saanud mõõta.")}
            />
          ) : null}
        </div>
      </div>

      <div className={cardClassName} id="analytics-framework-acceptances">
        <div className={cardBodyClassName}>
          <div className={sectionHeadClassName}>
            <div>
              <CardTitle>{t("admin.analytics.framework_acceptances.title", "Tööalase raamistiku kinnitused")}</CardTitle>
              <div className={sectionSubClassName}>
                {t("admin.analytics.framework_acceptances.subtitle", "Viimased registreerimisel salvestatud tööalase kasutuse kinnitused.")}
              </div>
            </div>
          </div>
          <div className={docsGridClassName}>
            <KpiCard
              title={t("admin.analytics.framework_acceptances.total", "Kokku")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.documents?.frameworkAcceptances?.total || 0, localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.framework_acceptances.accepted_30d", "Kinnitatud (30p)")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.documents?.frameworkAcceptances?.accepted30d || 0, localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.framework_acceptances.signed_30d", "Raamlepingu allalaadimine salvestatud (30p)")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.documents?.frameworkAcceptances?.signedDownloaded30d || 0, localeTag)}
            />
          </div>
          <div className={tableHeaderClassName}>
            <div className={tableScrollHintClassName}>
              {t("admin.common.table_scroll_hint", "Scroll sideways on smaller screens to see all columns.")}
            </div>
          </div>
          <div className={tableDesktopWrapClassName}>
            <div className={tableWrapClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.time", "Time")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.users.table.user", "User")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.users.table.role", "Role")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.framework_acceptances.version", "Version")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.framework_acceptances.signed", "Framework agreement download")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.framework_acceptances.document", "Document")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSummary ? (
                    <tr>
                      <td className={tableCellClassName} colSpan={6}>
                        {t("admin.common.loading_data", "Loading...")}
                      </td>
                    </tr>
                  ) : (summary?.documents?.frameworkAcceptances?.recent || []).length ? (
                    summary.documents.frameworkAcceptances.recent.map((row) => (
                      <tr key={row.id}>
                        <td className={tableCellClassName}>{formatDate(row.acceptedAt, localeTag)}</td>
                        <td className={tableCellClassName}>{row.user?.email || "-"}</td>
                        <td className={tableCellClassName}>{getRoleLabel(row.roleAtAcceptance, false)}</td>
                        <td className={tableCellClassName}>{row.frameworkVersion || "-"}</td>
                        <td className={tableCellClassName}>{row.signedDocumentDownloadedAt ? t("admin.common.yes", "Yes") : t("admin.common.no", "No")}</td>
                        <td className={tableCellClassName}>{row.document?.title || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className={tableCellClassName} colSpan={6}>
                        {t("admin.analytics.table.empty", "No records found.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={mobileListClassName}>
            {loadingSummary ? (
              <div className={mobileRowCardClassName}>{t("admin.common.loading_data", "Loading...")}</div>
            ) : (summary?.documents?.frameworkAcceptances?.recent || []).length ? (
              summary.documents.frameworkAcceptances.recent.map((row) => (
                <div key={row.id} className={mobileRowCardClassName}>
                  <div className={mobileRowHeadClassName}>
                    <div>
                      <div className={mobileRowTitleClassName}>{row.user?.email || "-"}</div>
                      <div className={mobileRowSubClassName}>{formatDate(row.acceptedAt, localeTag)}</div>
                    </div>
                    <span className={usersSelectCountClassName}>{row.frameworkVersion || "-"}</span>
                  </div>
                  <div className={mobileFieldGridClassName}>
                    <MobileInfoField label={t("admin.analytics.users.table.role", "Role")} value={getRoleLabel(row.roleAtAcceptance, false)} />
                    <MobileInfoField label={t("admin.analytics.framework_acceptances.signed", "Framework agreement download")} value={row.signedDocumentDownloadedAt ? t("admin.common.yes", "Yes") : t("admin.common.no", "No")} />
                  </div>
                  <MobileInfoField label={t("admin.analytics.framework_acceptances.document", "Document")} value={row.document?.title || "-"} />
                </div>
              ))
            ) : (
              <div className={mobileRowCardClassName}>{t("admin.analytics.table.empty", "No records found.")}</div>
            )}
          </div>
        </div>
      </div>

      <div className={cardClassName} id="analytics-rag-docs">
        <div className={cardBodyClassName}>
          <div className={sectionHeadClassName}>
            <div>
              <CardTitle>{t("admin.analytics.rag_docs.title", "RAG documents")}</CardTitle>
              <div className={sectionSubClassName}>
                {t("admin.analytics.rag_docs.subtitle", "Overview of indexing and recent additions.")}
              </div>
            </div>
          </div>
          <div className={docsGridClassName}>
            <KpiCard
              title={t("admin.analytics.rag_docs.total", "Total")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.ragDocs?.total || 0, localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.failed", "Failed")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.ragDocs?.failed || 0, localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.error_30d", "With errors (30d)")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.ragDocs?.error30d || 0, localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.statuses", "Statuses")}
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : joinCounts(summary?.ragDocs?.byStatus, statusLabels, localeTag, [
                      "PENDING",
                      "PROCESSING",
                      "COMPLETED",
                      "FAILED"
                    ]) || "-"
              }
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.audience", "Audience")}
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : joinCounts(summary?.ragDocs?.byAudience, audienceLabels, localeTag, [
                      "CLIENT",
                      "SOCIAL_WORKER",
                      "BOTH"
                    ]) || "-"
              }
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.type", "Type")}
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : joinCounts(summary?.ragDocs?.byType, {}, localeTag, ["FILE", "URL"]) || "-"
              }
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.freshness_audited", "Freshness audited")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(ragFreshness?.audited || 0, localeTag)}
              meta={t("admin.analytics.rag_docs.freshness_audited_meta", "Latest RAG documents checked for source metadata freshness.")}
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.metadata_contract", "Metadata contract")}
              value={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : `${formatPercent(toNumber(ragMetadataQuality.completeness_rate) * 100, localeTag, 1)}%`
              }
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : t(
                      "admin.analytics.rag_docs.metadata_contract_meta",
                      {
                        incomplete: formatCount(ragMetadataQuality.incomplete || 0, localeTag),
                        required: formatCount(ragMetadataQuality.required_missing || 0, localeTag),
                        topMissing: joinCounts(ragMetadataQuality.missing_required_fields, {}, localeTag) || "-"
                      },
                      "Incomplete {incomplete} | missing required fields {required} | top: {topMissing}"
                    )
              }
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.metadata_by_collection", "Metadata by collection")}
              value={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : formatCount(Object.keys(ragMetadataByCollection).length, localeTag)
              }
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : ragMetadataCollectionSummary || t("admin.analytics.rag_docs.metadata_by_collection_empty", "No collection-level metadata gaps found.")
              }
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.metadata_by_file_type", "Metadata by file type")}
              value={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : formatCount(Object.keys(ragMetadataByFileType).length, localeTag)
              }
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                : ragMetadataFileTypeSummary || t("admin.analytics.rag_docs.metadata_by_file_type_empty", "No file-type metadata gaps found.")
              }
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.displayed_source_precision", "Displayed source precision")}
              value={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : `${formatPercent(toNumber(ragSourceQuality.displayed_source_precision) * 100, localeTag, 1)}%`
              }
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : t(
                      "admin.analytics.rag_docs.displayed_source_precision_meta",
                      {
                        basis: formatCount(ragSourceQuality.displayed_source_precision_basis || 0, localeTag),
                        violations: formatCount(ragSourceQuality.displayed_source_violation_count || 0, localeTag),
                        traces: formatCount(ragSourceQuality.traces_with_display_contract_violation || 0, localeTag)
                      },
                      "Displayed checked {basis} | violations {violations} | affected traces {traces}"
                    )
              }
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.retrieved_noise_filtered", "Retrieved noise filtered")}
              value={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : `${formatPercent(toNumber(ragSourceQuality.retrieved_filter_rate) * 100, localeTag, 1)}%`
              }
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : t(
                      "admin.analytics.rag_docs.retrieved_noise_filtered_meta",
                      {
                        filtered: formatCount(ragSourceQuality.retrieved_but_not_displayed_count || 0, localeTag),
                        retrieved: formatCount(ragSourceQuality.retrieved_source_count || 0, localeTag),
                        traces: formatCount(ragSourceQuality.traces_with_retrieved_but_not_displayed || 0, localeTag)
                      },
                      "Retrieved not displayed {filtered}/{retrieved} | affected traces {traces}"
                    )
              }
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.wrong_municipality_rate", "Wrong KOV rate")}
              value={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : `${formatPercent(toNumber(ragSourceQuality.wrong_municipality_rate) * 100, localeTag, 1)}%`
              }
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : t(
                      "admin.analytics.rag_docs.wrong_municipality_rate_meta",
                      {
                        wrong: formatCount(ragSourceQuality.wrong_municipality_source_count || 0, localeTag),
                        scoped: formatCount(ragSourceQuality.municipality_source_count || 0, localeTag),
                        traces: formatCount(ragSourceQuality.traces_with_wrong_municipality || 0, localeTag)
                      },
                      "Wrong KOV sources {wrong}/{scoped} | affected traces {traces}"
                    )
              }
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.freshness_errors", "Freshness errors")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(ragFreshnessSummary.errors || 0, localeTag)}
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : t(
                      "admin.analytics.rag_docs.freshness_errors_meta",
                      {
                        stale: formatCount(ragFreshnessSummary.stale || 0, localeTag),
                        missing: formatCount(ragFreshnessSummary.missing_last_checked || 0, localeTag),
                        expired: formatCount(ragFreshnessSummary.expired || 0, localeTag)
                      },
                      "Stale {stale} | missing last_checked {missing} | expired {expired}"
                    )
              }
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.freshness_warnings", "Freshness warnings")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(ragFreshnessSummary.warnings || 0, localeTag)}
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : t(
                      "admin.analytics.rag_docs.freshness_warnings_meta",
                      {
                        dueSoon: formatCount(ragFreshnessSummary.due_soon || 0, localeTag),
                        unknown: formatCount(ragFreshnessSummary.unknown_type || 0, localeTag),
                        invalidUrl: formatCount(ragQualityReasons.invalid_url || 0, localeTag),
                        missingForm: formatCount(ragQualityReasons.kov_service_missing_form_source || 0, localeTag),
                        missingContact: formatCount(ragQualityReasons.kov_service_missing_official_contact_source || 0, localeTag)
                      },
                      "Due soon {dueSoon} | unknown type {unknown} | invalid URL {invalidUrl} | missing form {missingForm} | missing contact {missingContact}"
                    )
              }
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.high_risk_answer_source_risk", "High-risk answer source risk")}
              value={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : `${formatPercent(toNumber(ragHighRiskFreshness.answer_source_stale_rate) * 100, localeTag, 1)}%`
              }
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : t(
                      "admin.analytics.rag_docs.high_risk_answer_source_risk_meta",
                      {
                        responses: formatCount(ragHighRiskFreshness.high_risk_with_answer_sources || 0, localeTag),
                        stale: formatCount(ragHighRiskFreshness.stale_answer_source_responses || 0, localeTag),
                        unknownRate: `${formatPercent(toNumber(ragHighRiskFreshness.answer_unknown_source_rate) * 100, localeTag, 1)}%`
                      },
                      "Answer-source responses {responses} | stale {stale} | unknown {unknownRate}"
                    )
              }
            />
            <KpiCard
              title={t("admin.analytics.rag_docs.high_risk_displayed_source_risk", "High-risk displayed source risk")}
              value={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : `${formatPercent(toNumber(ragHighRiskFreshness.displayed_source_stale_rate) * 100, localeTag, 1)}%`
              }
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : t(
                      "admin.analytics.rag_docs.high_risk_displayed_source_risk_meta",
                      {
                        responses: formatCount(ragHighRiskFreshness.high_risk_with_displayed_sources || 0, localeTag),
                        stale: formatCount(ragHighRiskFreshness.stale_displayed_source_responses || 0, localeTag),
                        unknownRate: `${formatPercent(toNumber(ragHighRiskFreshness.displayed_unknown_source_rate) * 100, localeTag, 1)}%`
                      },
                      "Displayed-source responses {responses} | stale {stale} | unknown {unknownRate}"
                    )
              }
            />
          </div>
          {!loadingSummary && ragFreshnessIssues.length > 0 ? (
            <SectionAlert
              tone={toNumber(ragFreshnessSummary.errors) > 0 ? "critical" : "warn"}
              message={t(
                "admin.analytics.rag_docs.freshness_queue_alert",
                {
                  count: formatCount(ragFreshnessIssues.length, localeTag)
                },
                "Quality queue contains {count} RAG sources that need metadata or freshness review."
              )}
            />
          ) : null}
          {!loadingSummary && ragHighRiskIssues.length > 0 ? (
            <SectionAlert
              tone={toNumber(ragHighRiskFreshness.stale_answer_source_responses) > 0 ? "critical" : "warn"}
              message={t(
                "admin.analytics.rag_docs.high_risk_queue_alert",
                {
                  count: formatCount(ragHighRiskIssues.length, localeTag)
                },
                "High-risk source risk queue contains {count} answer/display source issues."
              )}
            />
          ) : null}
          <div className={tableHeaderClassName}>
            <div>
              <CardTitle>
                {t("admin.analytics.rag_docs.high_risk_source_queue", "High-risk source risk")}
              </CardTitle>
              <div className={sectionSubClassName}>
                {t(
                  "admin.analytics.rag_docs.high_risk_source_queue_subtitle",
                  "Sources that appeared in high-risk answers or displayed source panels and have stale, missing or unknown freshness status."
                )}
              </div>
            </div>
            <div className={tableScrollHintClassName}>
              {t("admin.common.table_scroll_hint", "Scroll sideways on smaller screens to see all columns.")}
            </div>
          </div>
          <div className={tableDesktopWrapClassName}>
            <div className={tableWrapClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.layer", "Layer")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.status", "Status")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.title", "Title")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.type", "Type")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.reason", "Reason")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSummary ? (
                    <tr>
                      <td className={tableCellClassName} colSpan={5}>
                        {t("admin.common.loading_data", "Loading...")}
                      </td>
                    </tr>
                  ) : ragHighRiskIssues.length ? (
                    ragHighRiskIssues.map((item, index) => (
                      <tr key={`${item.layer || "layer"}-${item.source_id || item.title || item.issue || "issue"}-${index}`}>
                        <td className={tableCellClassName}>{highRiskSourceLayerLabels[item.layer] || item.layer || "-"}</td>
                        <td className={tableCellClassName}>
                          <div>{freshnessSeverityLabels[item.severity] || item.severity || "-"}</div>
                          <div className={cellSubClassName}>
                            {freshnessStatusLabels[item.freshness_status] || item.issue || item.freshness_status || "-"}
                          </div>
                        </td>
                        <td className={tableCellClassName}>
                          <div>{item.title || item.source_id || t("admin.analytics.table.untitled", "(untitled)")}</div>
                          <div className={cellSubClassName}>{item.source_id || "-"}</div>
                        </td>
                        <td className={tableCellClassName}>{item.source_type || "-"}</td>
                        <td className={tableCellClassName}>
                          {(Array.isArray(item.reasons) ? item.reasons.join(", ") : item.issue || "").slice(0, 120) || "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className={tableCellClassName} colSpan={5}>
                        {t("admin.analytics.rag_docs.high_risk_source_queue_empty", "No high-risk source freshness issues found.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={mobileListClassName}>
            {loadingSummary ? (
              <div className={mobileRowCardClassName}>{t("admin.common.loading_data", "Loading...")}</div>
            ) : ragHighRiskIssues.length ? (
              ragHighRiskIssues.map((item, index) => (
                <div key={`${item.layer || "layer"}-${item.source_id || item.title || item.issue || "issue"}-mobile-${index}`} className={mobileRowCardClassName}>
                  <div className={mobileRowHeadClassName}>
                    <div>
                      <div className={mobileRowTitleClassName}>{item.title || item.source_id || t("admin.analytics.table.untitled", "(untitled)")}</div>
                      <div className={mobileRowSubClassName}>{item.source_id || "-"}</div>
                    </div>
                    <span className={usersSelectCountClassName}>{highRiskSourceLayerLabels[item.layer] || item.layer || "-"}</span>
                  </div>
                  <div className={mobileFieldGridClassName}>
                    <MobileInfoField
                      label={t("admin.analytics.table.status", "Status")}
                      value={freshnessStatusLabels[item.freshness_status] || item.issue || item.freshness_status || "-"}
                    />
                    <MobileInfoField label={t("admin.analytics.table.type", "Type")} value={item.source_type || "-"} />
                  </div>
                  <MobileInfoField
                    label={t("admin.analytics.table.reason", "Reason")}
                    value={(Array.isArray(item.reasons) ? item.reasons.join(", ") : item.issue || "") || "-"}
                  />
                </div>
              ))
            ) : (
              <div className={mobileRowCardClassName}>
                {t("admin.analytics.rag_docs.high_risk_source_queue_empty", "No high-risk source freshness issues found.")}
              </div>
            )}
          </div>
          <div className={tableHeaderClassName}>
            <div>
              <CardTitle>
                {t("admin.analytics.rag_docs.quality_queue", "RAG quality queue")}
              </CardTitle>
              <div className={sectionSubClassName}>
                {t(
                  "admin.analytics.rag_docs.quality_queue_subtitle",
                  "Prioritized source metadata, freshness, URL, form and contact issues from the latest audited RAG documents."
                )}
              </div>
            </div>
            <div className={tableScrollHintClassName}>
              {t("admin.common.table_scroll_hint", "Scroll sideways on smaller screens to see all columns.")}
            </div>
          </div>
          <div className={tableDesktopWrapClassName}>
            <div className={tableWrapClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.status", "Status")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.title", "Title")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.type", "Type")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.rag_docs.last_checked", "Last checked")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.rag_docs.age", "Age")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.fix", "Fix")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.reason", "Reason")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSummary ? (
                    <tr>
                      <td className={tableCellClassName} colSpan={7}>
                        {t("admin.common.loading_data", "Loading...")}
                      </td>
                    </tr>
                  ) : ragFreshnessIssues.length ? (
                    ragFreshnessIssues.map((item, index) => (
                      <tr key={`${item.source_id || item.document_id || item.title || "issue"}-${index}`}>
                        <td className={tableCellClassName}>
                          <div>{freshnessSeverityLabels[item.severity] || item.severity || "-"}</div>
                          <div className={cellSubClassName}>
                            {freshnessStatusLabels[item.freshness_status] || item.freshness_status || "-"}
                          </div>
                        </td>
                        <td className={tableCellClassName}>
                          <div>{item.title || item.source_id || item.document_id || t("admin.analytics.table.untitled", "(untitled)")}</div>
                          <div className={cellSubClassName}>{item.source_id || item.document_id || "-"}</div>
                        </td>
                        <td className={tableCellClassName}>{item.source_type || "-"}</td>
                        <td className={tableCellClassName}>{item.last_checked || "-"}</td>
                        <td className={tableCellClassName}>{formatDays(item.age_days, localeTag)}</td>
                        <td className={tableCellClassName}>
                          <div>{formatRemediationAction(item)}</div>
                          <div className={cellSubClassName}>{formatRemediationTarget(item)}</div>
                          {item.remediation?.target?.admin_href ? (
                            <button
                              type="button"
                              onClick={() => openRemediationTarget(item)}
                            >
                              {t("admin.analytics.rag_docs.open_fix_target", "Open target")}
                            </button>
                          ) : null}
                        </td>
                        <td className={tableCellClassName}>
                          {(Array.isArray(item.reasons) ? item.reasons.join(", ") : "").slice(0, 120) || "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className={tableCellClassName} colSpan={7}>
                        {t("admin.analytics.rag_docs.quality_queue_empty", "No RAG source freshness issues found in the audited set.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={mobileListClassName}>
            {loadingSummary ? (
              <div className={mobileRowCardClassName}>{t("admin.common.loading_data", "Loading...")}</div>
            ) : ragFreshnessIssues.length ? (
              ragFreshnessIssues.map((item, index) => (
                <div key={`${item.source_id || item.document_id || item.title || "issue"}-mobile-${index}`} className={mobileRowCardClassName}>
                  <div className={mobileRowHeadClassName}>
                    <div>
                      <div className={mobileRowTitleClassName}>
                        {item.title || item.source_id || item.document_id || t("admin.analytics.table.untitled", "(untitled)")}
                      </div>
                      <div className={mobileRowSubClassName}>{item.source_id || item.document_id || "-"}</div>
                    </div>
                    <span className={usersSelectCountClassName}>
                      {freshnessSeverityLabels[item.severity] || item.severity || "-"}
                    </span>
                  </div>
                  <div className={mobileFieldGridClassName}>
                    <MobileInfoField
                      label={t("admin.analytics.table.status", "Status")}
                      value={freshnessStatusLabels[item.freshness_status] || item.freshness_status || "-"}
                    />
                    <MobileInfoField label={t("admin.analytics.table.type", "Type")} value={item.source_type || "-"} />
                    <MobileInfoField label={t("admin.analytics.rag_docs.last_checked", "Last checked")} value={item.last_checked || "-"} />
                    <MobileInfoField label={t("admin.analytics.rag_docs.age", "Age")} value={formatDays(item.age_days, localeTag)} />
                    <MobileInfoField label={t("admin.analytics.table.fix", "Fix")} value={formatRemediationAction(item)} />
                  </div>
                  <MobileInfoField
                    label={t("admin.analytics.rag_docs.fix_target", "Fix target")}
                    value={formatRemediationTarget(item)}
                  />
                  {item.remediation?.target?.admin_href ? (
                    <button
                      type="button"
                      onClick={() => openRemediationTarget(item)}
                    >
                      {t("admin.analytics.rag_docs.open_fix_target", "Open target")}
                    </button>
                  ) : null}
                  <MobileInfoField
                    label={t("admin.analytics.table.reason", "Reason")}
                    value={(Array.isArray(item.reasons) ? item.reasons.join(", ") : "") || "-"}
                  />
                </div>
              ))
            ) : (
              <div className={mobileRowCardClassName}>
                {t("admin.analytics.rag_docs.quality_queue_empty", "No RAG source freshness issues found in the audited set.")}
              </div>
            )}
          </div>
          <div className={tableHeaderClassName}>
            <div className={tableScrollHintClassName}>
              {t("admin.common.table_scroll_hint", "Scroll sideways on smaller screens to see all columns.")}
            </div>
          </div>
          <div className={tableDesktopWrapClassName}>
            <div className={tableWrapClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.time", "Time")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.title", "Title")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.status", "Status")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.type", "Type")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.audience", "Audience")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.table.source", "Source")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSummary ? (
                    <tr>
                      <td className={tableCellClassName} colSpan={6}>
                        {t("admin.common.loading_data", "Loading...")}
                      </td>
                    </tr>
                  ) : (summary?.ragDocs?.recent || []).length ? (
                    summary.ragDocs.recent.map(doc => (
                      <tr key={doc.id}>
                        <td className={tableCellClassName}>{formatDate(doc.insertedAt || doc.createdAt, localeTag)}</td>
                        <td className={tableCellClassName}>{doc.title || t("admin.analytics.table.untitled", "(untitled)")}</td>
                        <td className={tableCellClassName}>{statusLabels[doc.status] || doc.status || "-"}</td>
                        <td className={tableCellClassName}>{doc.type || "-"}</td>
                        <td className={tableCellClassName}>{audienceLabels[doc.audience] || doc.audience || "-"}</td>
                        <td className={tableCellClassName}>
                          {(doc.sourceUrl || doc.fileName || "-").toString().slice(0, 90)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className={tableCellClassName} colSpan={6}>
                        {t("admin.analytics.table.empty", "No records found.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={mobileListClassName}>
            {loadingSummary ? (
              <div className={mobileRowCardClassName}>{t("admin.common.loading_data", "Loading...")}</div>
            ) : (summary?.ragDocs?.recent || []).length ? (
              summary.ragDocs.recent.map(doc => (
                <div key={doc.id} className={mobileRowCardClassName}>
                  <div className={mobileRowHeadClassName}>
                    <div>
                      <div className={mobileRowTitleClassName}>{doc.title || t("admin.analytics.table.untitled", "(untitled)")}</div>
                      <div className={mobileRowSubClassName}>{formatDate(doc.insertedAt || doc.createdAt, localeTag)}</div>
                    </div>
                    <span className={usersSelectCountClassName}>{statusLabels[doc.status] || doc.status || "-"}</span>
                  </div>
                  <div className={mobileFieldGridClassName}>
                    <MobileInfoField label={t("admin.analytics.table.type", "Type")} value={doc.type || "-"} />
                    <MobileInfoField
                      label={t("admin.analytics.table.audience", "Audience")}
                      value={audienceLabels[doc.audience] || doc.audience || "-"}
                    />
                  </div>
                  <MobileInfoField
                    label={t("admin.analytics.table.source", "Source")}
                    value={(doc.sourceUrl || doc.fileName || "-").toString().slice(0, 140)}
                  />
                </div>
              ))
            ) : (
              <div className={mobileRowCardClassName}>{t("admin.analytics.table.empty", "No records found.")}</div>
            )}
          </div>
        </div>
      </div>

      <div className={cardClassName} id="analytics-billing">
        <div className={cardBodyClassName}>
          <div className={sectionHeadClassName}>
            <div>
              <CardTitle>{t("admin.analytics.billing.title", "Subscriptions and payments")}</CardTitle>
              <div className={sectionSubClassName}>
                {t("admin.analytics.billing.subtitle", "Payment flows and subscription activity over the last 30 days.")}
              </div>
            </div>
          </div>

          {loadingSummary ? (
            <SectionAlert tone="info" message={t("admin.common.loading_data", "Loading...")} />
          ) : paymentAlerts.length ? (
            <div>
              {paymentAlerts.map((alert, index) => (
                <SectionAlert
                  key={`${alert.code || "alert"}-${index}`}
                  tone={alert.severity || "info"}
                  message={`${t(`admin.analytics.billing.alerts.severity.${alert.severity || "info"}`, "Info")}: ${t(
                    `admin.analytics.billing.alerts.items.${alert.code || "unknown"}`,
                    {
                      value: formatPercent(alert.value || 0, localeTag),
                      threshold: formatPercent(alert.threshold || 0, localeTag)
                    },
                    "Billing alert."
                  )}`}
                />
              ))}
            </div>
          ) : (
            <SectionAlert tone="info" message={t("admin.analytics.billing.alerts.none", "No billing alerts.")} />
          )}

          <div className={billingSummaryGridClassName}>
            <KpiCard
              title={t("admin.analytics.billing.active_subscriptions", "Active subscriptions")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.billing?.activeSubscriptions || 0, localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.billing.new_subscriptions_30d", "New subscriptions (30d)")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.billing?.newSubscriptions30d || 0, localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.billing.cancellations_30d", "Cancellations (30d)")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatCount(summary?.billing?.canceledSubscriptions30d || 0, localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.billing.paid_amount_30d", "Paid amount (30d)")}
              value={loadingSummary ? t("admin.common.loading", "Loading...") : formatMoney(summary?.billing?.paidAmount30d || 0, "EUR", localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.billing.payment_statuses_30d", "Payment statuses (30d)")}
              meta={
                loadingSummary
                  ? t("admin.common.loading", "Loading...")
                  : joinCounts(summary?.billing?.paymentsByStatus30d, {}, localeTag, [
                      "PAID",
                      "INITIATED",
                      "FAILED",
                      "CANCELED",
                      "REFUNDED"
                    ]) || "-"
              }
            />
          </div>

          <div className={billingPipelineGridClassName}>
            <KpiCard
              title={t("admin.analytics.billing.pipeline.checkout_ready", "Checkout ready (30d)")}
              value={formatCount(paymentPipeline.checkoutCreated || 0, localeTag)}
              meta={t(
                "admin.analytics.billing.pipeline.from_init",
                { percent: formatPercent(paymentPipeline.checkoutCreateRatePct || 0, localeTag) },
                "{percent}% from init"
              )}
            />
            <KpiCard
              title={t("admin.analytics.billing.pipeline.webhook_paid", "Webhook paid (30d)")}
              value={formatCount(paymentPipeline.webhookPaid || 0, localeTag)}
              meta={t(
                "admin.analytics.billing.pipeline.from_checkout",
                { percent: formatPercent(paymentPipeline.paidFromCheckoutRatePct || 0, localeTag) },
                "{percent}% from checkout"
              )}
            />
            <KpiCard
              title={t("admin.analytics.billing.pipeline.callback_success", "Callback success (30d)")}
              value={formatCount(paymentPipeline.callbackSuccess || 0, localeTag)}
              meta={t(
                "admin.analytics.billing.pipeline.callback_share",
                { percent: formatPercent(paymentPipeline.callbackSuccessFromCheckoutRatePct || 0, localeTag) },
                "{percent}% callback success"
              )}
            />
            <KpiCard
              title={t("admin.analytics.billing.pipeline.webhook_errors", "Webhook errors (30d)")}
              value={formatCount(paymentPipeline.webhookTechErrorCount || 0, localeTag)}
              meta={t(
                "admin.analytics.billing.pipeline.breakdown",
                {
                  failed: formatCount(paymentPipeline.webhookFailed || 0, localeTag),
                  canceled: formatCount(paymentPipeline.webhookCanceled || 0, localeTag),
                  refunded: formatCount(paymentPipeline.webhookRefunded || 0, localeTag)
                },
                "Failed {failed} | Canceled {canceled} | Refunded {refunded}"
              )}
            />
          </div>

          <div className={tableHeaderClassName}>
            <div className={tableScrollHintClassName}>
              {t("admin.common.table_scroll_hint", "Scroll sideways on smaller screens to see all columns.")}
            </div>
          </div>
          <div className={tableDesktopWrapClassName}>
            <div className={tableWrapClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.billing.table.time", "Time")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.billing.table.status", "Status")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.billing.table.amount", "Amount")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.billing.table.provider", "Provider")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.billing.table.paid_at", "Paid at")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSummary ? (
                    <tr>
                      <td className={tableCellClassName} colSpan={5}>
                        {t("admin.common.loading_data", "Loading...")}
                      </td>
                    </tr>
                  ) : (summary?.billing?.recentPayments || []).length ? (
                    summary.billing.recentPayments.map(payment => (
                      <tr key={payment.id}>
                        <td className={tableCellClassName}>{formatDate(payment.createdAt, localeTag)}</td>
                        <td className={tableCellClassName}>{payment.status || "-"}</td>
                        <td className={tableCellClassName}>{formatMoney(payment.amount || 0, payment.currency || "EUR", localeTag)}</td>
                        <td className={tableCellClassName}>{payment.provider || "-"}</td>
                        <td className={tableCellClassName}>{payment.paidAt ? formatDate(payment.paidAt, localeTag) : "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className={tableCellClassName} colSpan={5}>
                        {t("admin.analytics.billing.table.empty", "No records found.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={mobileListClassName}>
            {loadingSummary ? (
              <div className={mobileRowCardClassName}>{t("admin.common.loading_data", "Loading...")}</div>
            ) : (summary?.billing?.recentPayments || []).length ? (
              summary.billing.recentPayments.map(payment => (
                <div key={payment.id} className={mobileRowCardClassName}>
                  <div className={mobileRowHeadClassName}>
                    <div>
                      <div className={mobileRowTitleClassName}>
                        {formatMoney(payment.amount || 0, payment.currency || "EUR", localeTag)}
                      </div>
                      <div className={mobileRowSubClassName}>{formatDate(payment.createdAt, localeTag)}</div>
                    </div>
                    <span className={usersSelectCountClassName}>{payment.status || "-"}</span>
                  </div>
                  <div className={mobileFieldGridClassName}>
                    <MobileInfoField
                      label={t("admin.analytics.billing.table.provider", "Provider")}
                      value={payment.provider || "-"}
                    />
                    <MobileInfoField
                      label={t("admin.analytics.billing.table.paid_at", "Paid at")}
                      value={payment.paidAt ? formatDate(payment.paidAt, localeTag) : "-"}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className={mobileRowCardClassName}>{t("admin.analytics.billing.table.empty", "No records found.")}</div>
            )}
          </div>
        </div>
      </div>

      <div className={cardClassName} id="analytics-users">
        <div className={cardBodyClassName}>
          <div className={sectionHeadClassName}>
            <div>
              <CardTitle>{t("admin.analytics.users.title", "Users, costs and limits")}</CardTitle>
              <div className={sectionSubClassName}>
                {t("admin.analytics.users.subtitle", "Per-user 30 day usage, estimated cost and active limits.")}
              </div>
            </div>
            <div className={cellSubClassName}>
              {t("admin.analytics.users.actions.selected_count", { count: selectedUserIds.length }, "Selected: {count}")}
            </div>
          </div>

          <div className={usersSummaryGridClassName}>
            <KpiCard
              title={t("admin.analytics.users.summary.users", "Users in table")}
              value={loadingUsers ? t("admin.common.loading", "Loading...") : formatCount(visibleUserRows.length, localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.users.summary.estimated_cost", "Estimated cost (30d)")}
              value={loadingUsers ? t("admin.common.loading", "Loading...") : formatMoney(usersAnalytics?.totals?.estimatedCostEur || 0, "EUR", localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.users.summary.paid_amount", "Paid amount (30d)")}
              value={loadingUsers ? t("admin.common.loading", "Loading...") : formatMoney(usersAnalytics?.totals?.paidAmountEur || 0, "EUR", localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.users.summary.budget_capacity", "Budget capacity")}
              value={loadingUsers ? t("admin.common.loading", "Loading...") : formatMoney(usersAnalytics?.totals?.budgetCapacityEur || 0, "EUR", localeTag)}
            />
            <KpiCard
              title={t("admin.analytics.users.summary.near_limits", "Near limits")}
              value={loadingUsers ? t("admin.common.loading", "Loading...") : formatCount(usersAnalytics?.totals?.nearLimitUsersCount || 0, localeTag)}
            />
          </div>

          <form className={toolbarPrimaryClassName} onSubmit={handleUsersSearch}>
            <input
              className={inputClassName}
              value={usersQueryDraft}
              onChange={event => setUsersQueryDraft(event.target.value)}
              placeholder={t("admin.analytics.users.table.user", "User")}
              aria-label={t("admin.analytics.users.table.user", "User")}
            />
            <Button variant="primary" className={actionButtonClassName} type="submit" disabled={loadingUsers}>
              {t("admin.common.refresh", "Search")}
            </Button>
            <Button
              variant="primary"
              className={actionButtonClassName}
              type="button"
              onClick={handleUsersSearchClear}
              disabled={loadingUsers}
            >
              {t("buttons.cancel", "Clear")}
            </Button>
          </form>

          <div className={usersSelectBarClassName}>
            <div>
              <div>
                <label className={cellSubClassName} htmlFor="analytics-bulk-email-target">
                  {t("admin.analytics.users.actions.email_target", "Email target")}
                </label>
                <DocumentsDropdown
                  className={compactDropdownClassName}
                  id="analytics-bulk-email-target"
                  value={emailTarget}
                  onChange={nextValue => {
                    invalidateBulkEmailPreview();
                    setEmailTarget(nextValue === "all" ? "all" : "selected");
                  }}
                  options={emailTargetOptions}
                  ariaLabel={t("admin.analytics.users.actions.email_target", "Email target")}
                  disabled={sendingUsersEmail || deletingUsers}
                />
              </div>
              <div className={usersSelectActionsClassName}>
                <Button
                  size="sm"
                  variant="primary"
                  className={actionButtonClassName}
                  onClick={toggleAllVisibleUsers}
                  disabled={loadingUsers || !visibleUserIds.length}
                >
                  {allVisibleSelected
                    ? t("admin.analytics.users.actions.clear_visible", "Clear visible")
                    : t("admin.analytics.users.actions.select_visible", "Select visible")}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  className={actionButtonClassName}
                  onClick={handleDeleteSelectedUsers}
                  disabled={deletingUsers || !selectedUserIds.length}
                >
                  {deletingUsers
                    ? t("admin.analytics.users.actions.deleting", "Deleting...")
                    : t("admin.analytics.users.actions.delete_selected", "Delete selected")}
                </Button>
              </div>
            </div>
            <div className={usersSelectActionsClassName}>
              <span className={usersSelectCountClassName}>
                {t("admin.analytics.users.actions.selected_count", { count: selectedUserIds.length }, "Selected: {count}")}
              </span>
              <span className={usersSelectCountClassName}>
                {t(
                  "admin.analytics.users.actions.selected_visible",
                  { count: selectedVisibleCount },
                  "Selected from visible: {count}"
                )}
              </span>
            </div>
          </div>

          <SectionAlert tone={usersNotice?.tone} message={usersNotice?.message} />

          <div className={emailSendBarClassName}>
            <div className={emailSendHeadClassName}>
              <CardTitle>{t("admin.analytics.users.actions.send_email", "Send email")}</CardTitle>
              <div className={emailSendHintClassName}>
                {t(
                  "admin.analytics.users.actions.email_target_hint",
                  {
                    mode:
                      emailTarget === "all"
                        ? t("admin.analytics.users.actions.email_all", "All users")
                        : t("admin.analytics.users.actions.email_selected", "Selected users")
                  },
                  "Current target: {mode}"
                )}
              </div>
            </div>
            <div>
              <label className={cellSubClassName} htmlFor="analytics-email-subject">
                {t("admin.analytics.users.actions.email_subject", "Email subject")}
              </label>
              <input
                id="analytics-email-subject"
                className={inputClassName}
                value={bulkEmailSubject}
                onChange={event => {
                  invalidateBulkEmailPreview();
                  setBulkEmailSubject(event.target.value);
                }}
                placeholder={t("admin.analytics.users.actions.email_subject_ph", "Enter subject")}
                maxLength={180}
              />
            </div>
            <div>
              <label className={cellSubClassName} htmlFor="analytics-email-text">
                {t("admin.analytics.users.actions.email_text", "Email text")}
              </label>
              <textarea
                id="analytics-email-text"
                className={textAreaClassName}
                value={bulkEmailText}
                onChange={event => {
                  invalidateBulkEmailPreview();
                  setBulkEmailText(event.target.value);
                }}
                placeholder={t("admin.analytics.users.actions.email_text_ph", "Write a message...")}
                maxLength={8000}
              />
            </div>
            <div>
              <label className={cellSubClassName} htmlFor="analytics-email-reason">
                {t("admin.analytics.dangerous.reason", "Reason")}
              </label>
              <textarea
                id="analytics-email-reason"
                className={textAreaClassName}
                value={bulkEmailReason}
                onChange={event => {
                  invalidateBulkEmailPreview();
                  setBulkEmailReason(event.target.value);
                }}
                placeholder={t("admin.analytics.dangerous.reason_placeholder", "Explain why this action is needed")}
                maxLength={500}
                required
              />
            </div>
            <Button
              variant="primary"
              className={actionButtonClassName}
              onClick={handlePreviewBulkEmail}
              disabled={sendingUsersEmail || deletingUsers || bulkEmailReason.trim().length < 3}
            >
              {sendingUsersEmail
                ? t("admin.analytics.dangerous.previewing", "Previewing...")
                : t("admin.analytics.dangerous.preview", "Preview impact")}
            </Button>
            {bulkEmailPreview ? (
              <div>
                <p>
                  {t(
                    "admin.analytics.dangerous.type_confirmation",
                    { confirmation: bulkEmailPreview.confirmation },
                    "Type exactly: {confirmation}"
                  )}
                </p>
                <input
                  className={inputClassName}
                  value={bulkEmailConfirmation}
                  onChange={event => setBulkEmailConfirmation(event.target.value)}
                  aria-label={t("admin.analytics.dangerous.confirmation", "Written confirmation")}
                  autoComplete="off"
                />
                <Button
                  variant="danger"
                  className={actionButtonClassName}
                  onClick={handleSendBulkEmail}
                  disabled={sendingUsersEmail || bulkEmailConfirmation !== bulkEmailPreview.confirmation}
                >
                  {sendingUsersEmail
                    ? t("admin.analytics.users.actions.sending", "Sending...")
                    : t("admin.analytics.users.actions.send_email", "Send email")}
                </Button>
              </div>
            ) : null}
          </div>
          <div className={tableHeaderClassName}>
            <div className={tableScrollHintClassName}>
              {t("admin.common.table_scroll_hint", "Scroll sideways on smaller screens to see all columns.")}
            </div>
          </div>
          <div className={tableDesktopWrapClassName}>
            <div className={tableWrapClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>
                      <input
                        type="checkbox"
                        className={checkboxClassName}
                        checked={allVisibleSelected}
                        onChange={toggleAllVisibleUsers}
                        aria-label={t("admin.analytics.users.actions.select_visible", "Select visible")}
                      />
                    </th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.users.table.user", "User")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.users.table.role", "Role")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.users.table.subscription", "Subscription")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.users.table.usage_30d", "Usage (30d)")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.users.table.cost_30d", "Cost estimate (30d)")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.users.table.limits", "Limits")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.users.table.paid_30d", "Paid (30d)")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td className={tableCellClassName} colSpan={8}>
                        {t("admin.common.loading_data", "Loading...")}
                      </td>
                    </tr>
                  ) : visibleUserRows.length ? (
                    visibleUserRows.map(row => (
                      <tr key={row.userId}>
                        <td className={tableCellClassName}>
                          <input
                            type="checkbox"
                            className={checkboxClassName}
                            checked={selectedUserIds.includes(row.userId)}
                            onChange={() => toggleUserSelection(row.userId)}
                            aria-label={t(
                              "admin.analytics.users.actions.select_user",
                              { user: row.email || row.userId },
                              "Select user {user}"
                            )}
                          />
                        </td>
                        <td className={tableCellClassName}>
                          <div>{row.email || row.userId}</div>
                          <div className={cellSubClassName}>{row.userId}</div>
                        </td>
                        <td className={tableCellClassName}>
                          <div>{getRoleLabel(row.role, row.isAdmin)}</div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.table.admin", "Admin")}:{" "}
                            {row.isAdmin ? t("admin.common.yes", "Yes") : t("admin.common.no", "No")}
                          </div>
                        </td>
                        <td className={tableCellClassName}>
                          <div>{row?.subscription?.status || "-"}</div>
                          <div className={cellSubClassName}>
                            {row?.subscription?.isActive
                              ? t("admin.analytics.users.active", "Active")
                              : t("admin.analytics.users.inactive", "Inactive")}
                          </div>
                          <div className={cellSubClassName}>{row?.subscription?.plan || "-"}</div>
                        </td>
                        <td className={tableCellClassName}>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.usage.chat", "Chat")}: {formatCount(row?.usage?.chatRequests || 0, localeTag)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.usage.rag", "RAG")}: {formatCount(row?.usage?.ragSearches || 0, localeTag)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.usage.stt", "STT")}: {formatCount(row?.usage?.sttRequests || 0, localeTag)} /{" "}
                            {formatMinutes(row?.usage?.sttMinutes || 0, localeTag, 2)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.usage.tts", "TTS")}: {formatCount(row?.usage?.ttsRequests || 0, localeTag)} /{" "}
                            {formatMinutes(row?.usage?.ttsMinutes || 0, localeTag, 2)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.usage.analyze", "Analyses (30d)")}:{" "}
                            {formatCount(row?.usage?.analyses30d || 0, localeTag)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.usage.analyze_today", "Analyses today")}:{" "}
                            {formatCount(row?.usage?.analysesToday || 0, localeTag)}
                          </div>
                        </td>
                        <td className={tableCellClassName}>
                          <div>{formatMoney(row?.costs?.totalEur || 0, "EUR", localeTag)}</div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.usage.chat", "Chat")}: {formatMoney(row?.costs?.chatEur || 0, "EUR", localeTag)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.usage.rag", "RAG")}: {formatMoney(row?.costs?.ragEur || 0, "EUR", localeTag)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.usage.stt", "STT")}: {formatMoney(row?.costs?.sttEur || 0, "EUR", localeTag)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.usage.tts", "TTS")}: {formatMoney(row?.costs?.ttsEur || 0, "EUR", localeTag)}
                          </div>
                        </td>
                        <td className={tableCellClassName}>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.limits.plan_amount", "Monthly fee")}:{" "}
                            {row.isAdmin ? "-" : formatMoney(row?.limits?.planAmountEur || 0, "EUR", localeTag)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.limits.analyze_daily", "Analyze/day")}:{" "}
                            {formatCount(row?.limits?.analyzeDaily || 0, localeTag)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.limits.analyze_usage_today", "Used today")}:{" "}
                            {formatCount(row?.limits?.analyzeToday || 0, localeTag)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.limits.analyze_remaining", "Remaining today")}:{" "}
                            {formatCount(row?.limits?.analyzeRemainingToday || 0, localeTag)}
                          </div>
                          <UsageBar value={row?.limits?.analyzeUtilizationPct || 0} />
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.limits.monthly_budget", "Monthly budget")}:{" "}
                            {formatMoney(row?.budget?.monthlyEur || 0, "EUR", localeTag)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.limits.remaining_budget", "Remaining budget")}:{" "}
                            {formatMoney(row?.budget?.remainingEur || 0, "EUR", localeTag)}
                          </div>
                          <UsageBar value={row?.budget?.utilizationPct || 0} />
                          <div className={cellSubClassName}>
                            {t("admin.analytics.users.limits.utilization", "Utilization")}:{" "}
                            {formatPercent(row?.budget?.utilizationPct || 0, localeTag, 1)}%
                          </div>
                        </td>
                        <td className={tableCellClassName}>{formatMoney(row?.paidAmount30dEur || 0, "EUR", localeTag)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className={tableCellClassName} colSpan={8}>
                        {t("admin.analytics.users.table.empty", "No users found.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={mobileListClassName}>
            {loadingUsers ? (
              <div className={mobileRowCardClassName}>{t("admin.common.loading_data", "Loading...")}</div>
            ) : visibleUserRows.length ? (
              visibleUserRows.map(row => (
                <div key={row.userId} className={mobileRowCardClassName}>
                  <div className={mobileRowHeadClassName}>
                    <div>
                      <input
                        type="checkbox"
                        className={checkboxClassName}
                        checked={selectedUserIds.includes(row.userId)}
                        onChange={() => toggleUserSelection(row.userId)}
                        aria-label={t(
                          "admin.analytics.users.actions.select_user",
                          { user: row.email || row.userId },
                          "Select user {user}"
                        )}
                      />
                      <div>
                        <div className={mobileRowTitleClassName}>{row.email || row.userId}</div>
                        <div className={mobileRowSubClassName}>{row.userId}</div>
                      </div>
                    </div>
                    <span className={usersSelectCountClassName}>{getRoleLabel(row.role, row.isAdmin)}</span>
                  </div>
                  <div className={mobileFieldGridClassName}>
                  <MobileInfoField
                    label={t("admin.analytics.users.table.subscription", "Subscription")}
                    value={
                        <>
                          <div className={compactMetricLeadValueClassName}>{row?.subscription?.status || "-"}</div>
                          <div className={cellSubClassName}>
                            {row?.subscription?.isActive
                              ? t("admin.analytics.users.active", "Active")
                              : t("admin.analytics.users.inactive", "Inactive")}
                          </div>
                          <div className={cellSubClassName}>{row?.subscription?.plan || "-"}</div>
                        </>
                      }
                    />
                    <MobileInfoField
                      label={t("admin.analytics.users.table.paid_30d", "Paid (30d)")}
                      value={formatMoney(row?.paidAmount30dEur || 0, "EUR", localeTag)}
                    />
                  </div>
                  <MobileInfoField
                    label={t("admin.analytics.users.table.usage_30d", "Usage (30d)")}
                    value={
                      <CompactMetricGrid
                        items={[
                          {
                            label: t("admin.analytics.users.usage.chat", "Chat"),
                            value: formatCount(row?.usage?.chatRequests || 0, localeTag)
                          },
                          {
                            label: t("admin.analytics.users.usage.rag", "RAG"),
                            value: formatCount(row?.usage?.ragSearches || 0, localeTag)
                          },
                          {
                            label: t("admin.analytics.users.usage.stt", "STT"),
                            value: `${formatCount(row?.usage?.sttRequests || 0, localeTag)} / ${formatMinutes(row?.usage?.sttMinutes || 0, localeTag, 2)}`
                          },
                          {
                            label: t("admin.analytics.users.usage.tts", "TTS"),
                            value: `${formatCount(row?.usage?.ttsRequests || 0, localeTag)} / ${formatMinutes(row?.usage?.ttsMinutes || 0, localeTag, 2)}`
                          },
                          {
                            label: t("admin.analytics.users.usage.analyze", "Analyses (30d)"),
                            value: formatCount(row?.usage?.analyses30d || 0, localeTag)
                          },
                          {
                            label: t("admin.analytics.users.usage.analyze_today", "Analyses today"),
                            value: formatCount(row?.usage?.analysesToday || 0, localeTag)
                          }
                        ]}
                      />
                    }
                  />
                  <MobileInfoField
                    label={t("admin.analytics.users.table.cost_30d", "Cost estimate (30d)")}
                    value={
                      <>
                        <div className={compactMetricLeadValueClassName}>{formatMoney(row?.costs?.totalEur || 0, "EUR", localeTag)}</div>
                        <CompactMetricGrid
                          items={[
                            {
                              label: t("admin.analytics.users.usage.chat", "Chat"),
                              value: formatMoney(row?.costs?.chatEur || 0, "EUR", localeTag)
                            },
                            {
                              label: t("admin.analytics.users.usage.rag", "RAG"),
                              value: formatMoney(row?.costs?.ragEur || 0, "EUR", localeTag)
                            },
                            {
                              label: t("admin.analytics.users.usage.stt", "STT"),
                              value: formatMoney(row?.costs?.sttEur || 0, "EUR", localeTag)
                            },
                            {
                              label: t("admin.analytics.users.usage.tts", "TTS"),
                              value: formatMoney(row?.costs?.ttsEur || 0, "EUR", localeTag)
                            }
                          ]}
                        />
                      </>
                    }
                  />
                  <MobileInfoField
                    label={t("admin.analytics.users.table.limits", "Limits")}
                    value={
                      <div>
                        <CompactMetricGrid
                          items={[
                            {
                              label: t("admin.analytics.users.limits.plan_amount", "Monthly fee"),
                              value: row.isAdmin ? "-" : formatMoney(row?.limits?.planAmountEur || 0, "EUR", localeTag)
                            },
                            {
                              label: t("admin.analytics.users.limits.analyze_daily", "Analyze/day"),
                              value: formatCount(row?.limits?.analyzeDaily || 0, localeTag)
                            },
                            {
                              label: t("admin.analytics.users.limits.analyze_usage_today", "Used today"),
                              value: formatCount(row?.limits?.analyzeToday || 0, localeTag)
                            },
                            {
                              label: t("admin.analytics.users.limits.analyze_remaining", "Remaining today"),
                              value: formatCount(row?.limits?.analyzeRemainingToday || 0, localeTag)
                            }
                          ]}
                        />
                        <UsageBar value={row?.limits?.analyzeUtilizationPct || 0} />
                        <CompactMetricGrid
                          items={[
                            {
                              label: t("admin.analytics.users.limits.monthly_budget", "Monthly budget"),
                              value: formatMoney(row?.budget?.monthlyEur || 0, "EUR", localeTag)
                            },
                            {
                              label: t("admin.analytics.users.limits.remaining_budget", "Remaining budget"),
                              value: formatMoney(row?.budget?.remainingEur || 0, "EUR", localeTag)
                            },
                            {
                              label: t("admin.analytics.users.limits.utilization", "Utilization"),
                              value: `${formatPercent(row?.budget?.utilizationPct || 0, localeTag, 1)}%`
                            }
                          ]}
                        />
                        <UsageBar value={row?.budget?.utilizationPct || 0} />
                      </div>
                    }
                  />
                </div>
              ))
            ) : (
              <div className={mobileRowCardClassName}>{t("admin.analytics.users.table.empty", "No users found.")}</div>
            )}
          </div>

          <div className={cellSubClassName}>
            {t(
              "admin.analytics.users.note",
              {
                chat: toNumber(usersAnalytics?.costModel?.chatRequestEur || 0).toFixed(4),
                rag: toNumber(usersAnalytics?.costModel?.ragSearchEur || 0).toFixed(4),
                stt: toNumber(usersAnalytics?.costModel?.sttPerMinuteEur || 0).toFixed(4),
                tts: toNumber(usersAnalytics?.costModel?.ttsPerMinuteEur || 0).toFixed(4),
                budget: toNumber(usersAnalytics?.costModel?.monthlyBudgetEur || 0).toFixed(2),
                budgetClient: toNumber(usersAnalytics?.costModel?.monthlyBudgetClientEur || 0).toFixed(2),
                budgetWorker: toNumber(usersAnalytics?.costModel?.monthlyBudgetWorkerEur || 0).toFixed(2)
              },
              "Cost model note."
            )}
          </div>
        </div>
      </div>

      <div className={cardClassName} id="analytics-ai-costs">
        <div className={cardBodyClassName}>
          <div className={sectionHeadClassName}>
            <div>
              <CardTitle>{t("admin.analytics.ai_costs.title", "AI kuluaktiivsus")}</CardTitle>
              <div className={sectionSubClassName}>
                {t(
                  "admin.analytics.ai_costs.subtitle",
                  "ChatLogi-põhine OpenAI, RAG-i, TTS-i ja STT jälgitavus."
                )}
              </div>
            </div>
          </div>

          <SectionAlert
            tone="info"
            message={
              getAiCoverageNote(aiCosts?.coverage?.note)
            }
          />

          <SectionAlert
            tone="info"
            message={
              aiCosts?.unit_model
                ? `${aiCosts.unit_model.version}: ${getAiUnitModelNote(aiCosts.unit_model.note)}`
                : `v2: ${getAiUnitModelNote()}`
            }
          />

          <MetricListCard title={t("admin.analytics.ai_costs.guide.title", "Kuidas seda lugeda")} items={aiAdminGuideItems} stacked />

          <div className={usersSummaryGridClassName}>
            {aiCostCards.map(card => (
              <KpiCard key={card.title} title={card.title} value={card.value} meta={card.meta} />
            ))}
          </div>

          <div className={usersSummaryGridClassName}>
            {aiThresholdCards.map(card => (
              <KpiCard key={card.title} title={card.title} value={card.value} />
            ))}
          </div>

          <div className={platformGridClassName}>
            <MetricListCard title={t("admin.analytics.ai_costs.average_usage", "Keskmine kasutus")} items={aiCostAverageItems} stacked />
            <MetricListCard title={t("admin.analytics.ai_costs.approx.title", "Ligikaudne EUR vaade")} items={aiApproxCostItems} stacked />
            <MetricListCard title={t("admin.analytics.ai_costs.attribution.title", "Omistamise täielikkus")} items={aiAttributionItems} stacked />
            {aiCostBreakdownCards.map(card => (
              <MetricListCard
                key={card.title}
                title={card.title}
                stacked
                items={
                  card.items.length
                    ? card.items
                    : [
                        {
                          label: t("admin.analytics.table.empty", "No records found."),
                          value: "-"
                        }
                      ]
                }
              />
            ))}
          </div>

          <div className={tableHeaderClassName}>
            <div className={tableScrollHintClassName}>
              {t("admin.common.table_scroll_hint", "Scroll sideways on smaller screens to see all columns.")}
            </div>
          </div>
          <div className={tableDesktopWrapClassName}>
            <div className={tableWrapClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.features.route", "Marsruut")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.features.stage", "Etapp")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.units", "Sisemised kasutusühikud")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.features.events", "Sündmused")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.features.direct", "Otsene")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.features.estimated", "Hinnanguline")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.coverage.label", "Kaetus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAiCosts ? (
                    <tr>
                      <td className={tableCellClassName} colSpan={7}>
                        {t("admin.common.loading_data", "Loading...")}
                      </td>
                    </tr>
                  ) : (aiCosts?.top_features || []).length ? (
                    aiCosts.top_features.map(row => (
                      <tr key={`${row.route}-${row.stage}`}>
                        <td className={tableCellClassName}>{row.route || "-"}</td>
                        <td className={tableCellClassName}>{row.stage || "-"}</td>
                        <td className={tableCellClassName}>{formatPercent(row.internal_usage_units || 0, localeTag, 1)}</td>
                        <td className={tableCellClassName}>{formatCount(row.events || 0, localeTag)}</td>
                        <td className={tableCellClassName}>{formatCount(row.direct_usage_events || 0, localeTag)}</td>
                        <td className={tableCellClassName}>{formatCount(row.estimated_usage_events || 0, localeTag)}</td>
                        <td className={tableCellClassName}>
                          {getCoverageLabel(row.coverage_complete)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className={tableCellClassName} colSpan={7}>
                        {t("admin.analytics.table.empty", "No records found.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={mobileListClassName}>
            {loadingAiCosts ? (
              <div className={mobileRowCardClassName}>{t("admin.common.loading_data", "Loading...")}</div>
            ) : (aiCosts?.top_features || []).length ? (
              aiCosts.top_features.map(row => (
                <div key={`${row.route}-${row.stage}`} className={mobileRowCardClassName}>
                  <div className={mobileRowHeadClassName}>
                    <div>
                      <div className={mobileRowTitleClassName}>{row.route || "-"}</div>
                      <div className={mobileRowSubClassName}>{row.stage || "-"}</div>
                    </div>
                    <span className={usersSelectCountClassName}>{formatCount(row.events || 0, localeTag)}</span>
                  </div>
                  <div className={mobileFieldGridClassName}>
                    <MobileInfoField
                      label={t("admin.analytics.ai_costs.units", "Sisemised kasutusühikud")}
                      value={formatPercent(row.internal_usage_units || 0, localeTag, 1)}
                    />
                    <MobileInfoField
                      label={t("admin.analytics.ai_costs.features.direct", "Otsene")}
                      value={formatCount(row.direct_usage_events || 0, localeTag)}
                    />
                    <MobileInfoField
                      label={t("admin.analytics.ai_costs.features.estimated", "Hinnanguline")}
                      value={formatCount(row.estimated_usage_events || 0, localeTag)}
                    />
                  </div>
                  <MobileInfoField
                    label={t("admin.analytics.ai_costs.coverage.label", "Kaetus")}
                    value={getCoverageLabel(row.coverage_complete)}
                  />
                </div>
              ))
            ) : (
              <div className={mobileRowCardClassName}>{t("admin.analytics.table.empty", "No records found.")}</div>
            )}
          </div>

          <div className={tableHeaderClassName}>
            <div className={sectionSubClassName}>
              {t("admin.analytics.ai_costs.users_title", "Kasutajate eelarvejälgimine")}
            </div>
          </div>
          <div className={tableDesktopWrapClassName}>
            <div className={tableWrapClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.users.table.user", "User")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.users.table.role", "Role")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.package", "Pakett")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.units", "Sisemised kasutusühikud")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.budget_units", "Eelarveühikud / kuu")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.utilization", "Kasutusmäär")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.threshold.label", "Lävend")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.coverage.label", "Kaetus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAiCosts ? (
                    <tr>
                      <td className={tableCellClassName} colSpan={8}>
                        {t("admin.common.loading_data", "Loading...")}
                      </td>
                    </tr>
                  ) : (aiCosts?.top_users || []).length ? (
                    aiCosts.top_users.map(row => (
                      <tr key={row.user_id}>
                        <td className={tableCellClassName}>
                          <div>{row.email || row.user_id || "-"}</div>
                          <div className={cellSubClassName}>{row.user_id || "-"}</div>
                        </td>
                        <td className={tableCellClassName}>{getRoleLabel(row.role, false)}</td>
                        <td className={tableCellClassName}>{row.package || "-"}</td>
                        <td className={tableCellClassName}>
                          <div>{formatPercent(row.internal_usage_units || 0, localeTag, 1)}</div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.ai_costs.approx.short", "Ligik.")}:{" "}
                            {formatMoney(row.approximate_cost_eur || 0, "EUR", localeTag)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.ai_costs.features.direct", "Otsene")}:{" "}
                            {formatPercent(row.internal_usage_units_direct || 0, localeTag, 1)}
                          </div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.ai_costs.features.estimated", "Hinnanguline")}:{" "}
                            {formatPercent(row.internal_usage_units_estimated || 0, localeTag, 1)}
                          </div>
                        </td>
                        <td className={tableCellClassName}>{formatPercent(row.budget_units_monthly || 0, localeTag, 1)}</td>
                        <td className={tableCellClassName}>{`${formatPercent(row.utilization_pct || 0, localeTag, 1)}%`}</td>
                        <td className={tableCellClassName}>{getThresholdLabel(row.threshold_state)}</td>
                        <td className={tableCellClassName}>
                          <div>{getCoverageLabel(row.coverage_complete)}</div>
                          <div className={cellSubClassName}>{row.coverage_note ? getAiCoverageNote(row.coverage_note) : "-"}</div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className={tableCellClassName} colSpan={8}>
                        {t("admin.analytics.table.empty", "No records found.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={mobileListClassName}>
            {loadingAiCosts ? (
              <div className={mobileRowCardClassName}>{t("admin.common.loading_data", "Loading...")}</div>
            ) : (aiCosts?.top_users || []).length ? (
              aiCosts.top_users.map(row => (
                <div key={row.user_id} className={mobileRowCardClassName}>
                  <div className={mobileRowHeadClassName}>
                    <div>
                      <div className={mobileRowTitleClassName}>{row.email || row.user_id || "-"}</div>
                      <div className={mobileRowSubClassName}>{row.user_id || "-"}</div>
                    </div>
                    <span className={usersSelectCountClassName}>{getThresholdLabel(row.threshold_state)}</span>
                  </div>
                  <div className={mobileFieldGridClassName}>
                    <MobileInfoField label={t("admin.analytics.users.table.role", "Role")} value={getRoleLabel(row.role, false)} />
                    <MobileInfoField label={t("admin.analytics.ai_costs.package", "Pakett")} value={row.package || "-"} />
                    <MobileInfoField
                      label={t("admin.analytics.ai_costs.units", "Sisemised kasutusühikud")}
                      value={
                        <>
                          <div>{formatPercent(row.internal_usage_units || 0, localeTag, 1)}</div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.ai_costs.approx.short", "Ligik.")}:{" "}
                            {formatMoney(row.approximate_cost_eur || 0, "EUR", localeTag)}
                          </div>
                        </>
                      }
                    />
                    <MobileInfoField
                      label={t("admin.analytics.ai_costs.budget_units", "Eelarveühikud / kuu")}
                      value={formatPercent(row.budget_units_monthly || 0, localeTag, 1)}
                    />
                  </div>
                  <MobileInfoField
                    label={t("admin.analytics.ai_costs.utilization", "Kasutusmäär")}
                    value={`${formatPercent(row.utilization_pct || 0, localeTag, 1)}%`}
                  />
                  <MobileInfoField
                    label={t("admin.analytics.ai_costs.coverage.label", "Kaetus")}
                    value={`${getCoverageLabel(row.coverage_complete)}${row.coverage_note ? ` | ${getAiCoverageNote(row.coverage_note)}` : ""}`}
                  />
                </div>
              ))
            ) : (
              <div className={mobileRowCardClassName}>{t("admin.analytics.table.empty", "No records found.")}</div>
            )}
          </div>

          <div className={tableHeaderClassName}>
            <div className={sectionSubClassName}>
              {t("admin.analytics.ai_costs.packages_title", "Pakettide eelarvejälgimine")}
            </div>
          </div>
          <div className={tableDesktopWrapClassName}>
            <div className={tableWrapClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.package", "Pakett")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.package_users", "Kasutajad")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.units", "Sisemised kasutusühikud")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.budget_units", "Eelarveühikud / kuu")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.utilization", "Kasutusmäär")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.threshold.label", "Lävend")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.ai_costs.coverage.label", "Kaetus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAiCosts ? (
                    <tr>
                      <td className={tableCellClassName} colSpan={7}>
                        {t("admin.common.loading_data", "Loading...")}
                      </td>
                    </tr>
                  ) : (aiCosts?.package_budget_tracking || []).length ? (
                    aiCosts.package_budget_tracking.map(row => (
                      <tr key={row.package}>
                        <td className={tableCellClassName}>{row.package || "-"}</td>
                        <td className={tableCellClassName}>{formatCount(row.users || 0, localeTag)}</td>
                        <td className={tableCellClassName}>
                          <div>{formatPercent(row.internal_usage_units || 0, localeTag, 1)}</div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.ai_costs.approx.short", "Ligik.")}:{" "}
                            {formatMoney(row.approximate_cost_eur || 0, "EUR", localeTag)}
                          </div>
                        </td>
                        <td className={tableCellClassName}>{formatPercent(row.budget_units_monthly || 0, localeTag, 1)}</td>
                        <td className={tableCellClassName}>{`${formatPercent(row.utilization_pct || 0, localeTag, 1)}%`}</td>
                        <td className={tableCellClassName}>{getThresholdLabel(row.threshold_state)}</td>
                        <td className={tableCellClassName}>
                          <div>{getCoverageLabel(row.coverage_complete)}</div>
                          <div className={cellSubClassName}>{row.coverage_note ? getAiCoverageNote(row.coverage_note) : "-"}</div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className={tableCellClassName} colSpan={7}>
                        {t("admin.analytics.table.empty", "No records found.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={mobileListClassName}>
            {loadingAiCosts ? (
              <div className={mobileRowCardClassName}>{t("admin.common.loading_data", "Loading...")}</div>
            ) : (aiCosts?.package_budget_tracking || []).length ? (
              aiCosts.package_budget_tracking.map(row => (
                <div key={row.package} className={mobileRowCardClassName}>
                  <div className={mobileRowHeadClassName}>
                    <div>
                      <div className={mobileRowTitleClassName}>{row.package || "-"}</div>
                      <div className={mobileRowSubClassName}>
                        {t("admin.analytics.ai_costs.package_users", "Kasutajad")}: {formatCount(row.users || 0, localeTag)}
                      </div>
                    </div>
                    <span className={usersSelectCountClassName}>{getThresholdLabel(row.threshold_state)}</span>
                  </div>
                  <div className={mobileFieldGridClassName}>
                    <MobileInfoField
                      label={t("admin.analytics.ai_costs.units", "Sisemised kasutusühikud")}
                      value={
                        <>
                          <div>{formatPercent(row.internal_usage_units || 0, localeTag, 1)}</div>
                          <div className={cellSubClassName}>
                            {t("admin.analytics.ai_costs.approx.short", "Ligik.")}:{" "}
                            {formatMoney(row.approximate_cost_eur || 0, "EUR", localeTag)}
                          </div>
                        </>
                      }
                    />
                    <MobileInfoField
                      label={t("admin.analytics.ai_costs.budget_units", "Eelarveühikud / kuu")}
                      value={formatPercent(row.budget_units_monthly || 0, localeTag, 1)}
                    />
                  </div>
                  <MobileInfoField
                    label={t("admin.analytics.ai_costs.utilization", "Kasutusmäär")}
                    value={`${formatPercent(row.utilization_pct || 0, localeTag, 1)}%`}
                  />
                  <MobileInfoField
                    label={t("admin.analytics.ai_costs.coverage.label", "Kaetus")}
                    value={`${getCoverageLabel(row.coverage_complete)}${row.coverage_note ? ` | ${getAiCoverageNote(row.coverage_note)}` : ""}`}
                  />
                </div>
              ))
            ) : (
              <div className={mobileRowCardClassName}>{t("admin.analytics.table.empty", "No records found.")}</div>
            )}
          </div>
        </div>
      </div>

      <div className={cardClassName} id="analytics-logs">
        <div className={cardBodyClassName}>
          <div className={sectionHeadClassName}>
            <div>
              <CardTitle>{t("admin.analytics.logs.title", "Logs")}</CardTitle>
              <div className={sectionSubClassName}>
                {t("admin.analytics.logs.subtitle", "Latest events with filters.")}
              </div>
            </div>
          </div>

          <div className={logsToolbarClassName}>
            <DocumentsDropdown
              className={dropdownClassName}
              value={eventFilter}
              onChange={value => {
                invalidateLogsPreview();
                setEventFilter(value);
              }}
              options={eventFilterOptions}
              ariaLabel={t("admin.analytics.logs.filter.all_events", "All events")}
            />
            <DocumentsDropdown
              className={compactDropdownClassName}
              value={isCrisisFilter}
              onChange={value => {
                invalidateLogsPreview();
                setIsCrisisFilter(value);
              }}
              options={crisisFilterOptions}
              ariaLabel={t("admin.analytics.logs.filter.crisis_all", "Crisis: all")}
            />
            <Button
              size="sm"
              variant="danger"
              className={actionButtonClassName}
              onClick={() => handlePreviewLogDeletion(false)}
              disabled={deletingLogs || !canDeleteFilteredLogs || logsReason.trim().length < 3}
            >
              {deletingLogs
                ? t("admin.analytics.logs.actions.deleting", "Deleting...")
                : t("admin.analytics.logs.actions.preview_filtered", "Preview filtered log deletion")}
            </Button>
            <Button
              size="sm"
              variant="danger"
              className={actionButtonClassName}
              onClick={() => handlePreviewLogDeletion(true)}
              disabled={deletingLogs || logsReason.trim().length < 3}
            >
              {deletingLogs
                ? t("admin.analytics.logs.actions.deleting", "Deleting...")
                : t("admin.analytics.logs.actions.preview_all", "Preview deletion of all logs")}
            </Button>
          </div>

          <div>
            <label className={cellSubClassName} htmlFor="analytics-logs-reason">
              {t("admin.analytics.dangerous.reason", "Reason")}
            </label>
            <textarea
              id="analytics-logs-reason"
              className={textAreaClassName}
              value={logsReason}
              onChange={event => {
                invalidateLogsPreview();
                setLogsReason(event.target.value);
              }}
              placeholder={t("admin.analytics.dangerous.reason_placeholder", "Explain why this action is needed")}
              maxLength={500}
              required
            />
          </div>

          {logsPreview ? (
            <div>
              <p>
                {t(
                  "admin.analytics.dangerous.type_confirmation",
                  { confirmation: logsPreview.confirmation },
                  "Type exactly: {confirmation}"
                )}
              </p>
              <input
                className={inputClassName}
                value={logsConfirmation}
                onChange={event => setLogsConfirmation(event.target.value)}
                aria-label={t("admin.analytics.dangerous.confirmation", "Written confirmation")}
                autoComplete="off"
              />
              <Button
                size="sm"
                variant="danger"
                className={actionButtonClassName}
                onClick={handleDeleteLogs}
                disabled={deletingLogs || logsConfirmation !== logsPreview.confirmation}
              >
                {deletingLogs
                  ? t("admin.analytics.logs.actions.deleting", "Deleting...")
                  : t("admin.analytics.dangerous.execute", "Confirm action")}
              </Button>
            </div>
          ) : null}

          <SectionAlert tone={logsNotice?.tone} message={logsNotice?.message} />

          <div className={tableHeaderClassName}>
            <div className={tableScrollHintClassName}>
              {t("admin.common.table_scroll_hint", "Scroll sideways on smaller screens to see all columns.")}
            </div>
          </div>
          <div className={tableDesktopWrapClassName}>
            <div className={tableWrapClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.logs.table.time", "Time")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.logs.table.event", "Event")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.logs.table.role", "Role")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.logs.table.crisis", "Crisis")}</th>
                    <th className={tableHeadCellClassName}>{t("admin.analytics.logs.table.meta", "Meta")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingEvents ? (
                    <tr>
                      <td className={tableCellClassName} colSpan={5}>
                        {t("admin.common.loading_data", "Loading...")}
                      </td>
                    </tr>
                  ) : events.length ? (
                    events.map(row => (
                      <tr key={row.id}>
                        <td className={tableCellClassName}>{formatDate(row.createdAt, localeTag)}</td>
                        <td className={tableCellClassName}>{eventLabels[row.event] || row.event || "-"}</td>
                        <td className={tableCellClassName}>{getRoleLabel(row.role, false)}</td>
                        <td className={tableCellClassName}>
                          {row?.data?.isCrisis ? t("admin.common.yes", "Yes") : t("admin.common.no", "No")}
                        </td>
                        <td className={tableCellClassName}>{summarizeEventMeta(row?.data)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className={tableCellClassName} colSpan={5}>
                        {t("admin.analytics.logs.table.empty", "No records found.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className={mobileListClassName}>
            {loadingEvents ? (
              <div className={mobileRowCardClassName}>{t("admin.common.loading_data", "Loading...")}</div>
            ) : events.length ? (
              events.map(row => (
                <div key={row.id} className={mobileRowCardClassName}>
                  <div className={mobileRowHeadClassName}>
                    <div>
                      <div className={mobileRowTitleClassName}>{eventLabels[row.event] || row.event || "-"}</div>
                      <div className={mobileRowSubClassName}>{formatDate(row.createdAt, localeTag)}</div>
                    </div>
                    <span className={usersSelectCountClassName}>{getRoleLabel(row.role, false)}</span>
                  </div>
                  <div className={mobileFieldGridClassName}>
                    <MobileInfoField
                      label={t("admin.analytics.logs.table.crisis", "Crisis")}
                      value={row?.data?.isCrisis ? t("admin.common.yes", "Yes") : t("admin.common.no", "No")}
                    />
                  </div>
                  <MobileInfoField label={t("admin.analytics.logs.table.meta", "Meta")} value={summarizeEventMeta(row?.data)} />
                </div>
              ))
            ) : (
              <div className={mobileRowCardClassName}>{t("admin.analytics.logs.table.empty", "No records found.")}</div>
            )}
          </div>
        </div>
      </div>

      <div className={cardClassName}>
        <div className={cardBodyClassName}>
          <div className={sectionHeadClassName}>
            <div>
              <CardTitle>{t("admin.analytics.reset.title", "Prelaunch reset")}</CardTitle>
              <div className={sectionSubClassName}>
                {t("admin.analytics.reset.subtitle", "Run targeted cleanup actions before launch.")}
              </div>
            </div>
          </div>

          <div>
            <label className={cellSubClassName} htmlFor="analytics-reset-reason">
              {t("admin.analytics.dangerous.reason", "Reason")}
            </label>
            <textarea
              id="analytics-reset-reason"
              className={textAreaClassName}
              value={resetReason}
              onChange={event => {
                invalidateResetPreview();
                setResetReason(event.target.value);
              }}
              placeholder={t("admin.analytics.dangerous.reason_placeholder", "Explain why this action is needed")}
              maxLength={500}
              required
            />
          </div>

          <div className={resetActionGridClassName}>
            {PRELAUNCH_RESET_ACTIONS.map(item => {
              const isRunning = runningResetAction === item.value;
              return (
                <Button
                  key={item.value}
                  size="sm"
                  variant="danger"
                  className={resetActionButtonClassName}
                  onClick={() => handlePreviewReset(item.value)}
                  disabled={Boolean(runningResetAction) || resetReason.trim().length < 3}
                >
                  {isRunning
                    ? t("admin.analytics.dangerous.previewing", "Previewing...")
                    : t(item.labelKey, item.value)}
                </Button>
              );
            })}
          </div>

          {resetPreview ? (
            <div>
              <p>
                {t(
                  "admin.analytics.dangerous.impact",
                  { count: toNumber(resetPreview.total || 0) },
                  "Affected records: {count}."
                )}
              </p>
              <p>
                {t(
                  "admin.analytics.dangerous.type_confirmation",
                  { confirmation: resetPreview.confirmation },
                  "Type exactly: {confirmation}"
                )}
              </p>
              <input
                className={inputClassName}
                value={resetConfirmation}
                onChange={event => setResetConfirmation(event.target.value)}
                aria-label={t("admin.analytics.dangerous.confirmation", "Written confirmation")}
                autoComplete="off"
              />
              <Button
                size="sm"
                variant="danger"
                className={resetActionButtonClassName}
                onClick={handleRunReset}
                disabled={
                  Boolean(runningResetAction) ||
                  resetPreview.executionAllowed === false ||
                  resetConfirmation !== resetPreview.confirmation
                }
              >
                {runningResetAction
                  ? t("admin.analytics.reset.running", "Running...")
                  : t("admin.analytics.dangerous.execute", "Confirm action")}
              </Button>
            </div>
          ) : null}

          <SectionAlert tone={resetNotice?.tone} message={resetNotice?.message} />
        </div>
      </div>
    </div>
  );
}
