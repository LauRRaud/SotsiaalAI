"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";

import { localizePath } from "@/lib/localizePath";

import RagRowMenu from "./RagRowMenu";

const ACCEPTANCE_DISPOSITIONS = [
  ["not_published", { et: "Pole KOV veebis avaldatud", en: "Not published on municipal site" }],
  ["not_applicable", { et: "Ei kohaldu", en: "Not applicable" }],
  ["checked_missing_form", { et: "Kontrollitud, vorm puudub", en: "Checked, form missing" }],
  ["deadline_not_published", { et: "Kontrollitud, tähtaega ei avaldata", en: "Checked, deadline not published" }]
];

const SOURCE_PACKAGE_COPY = {
  et: {
    summary: [
      ["total", "Kokku"],
      ["active", "Aktiivsed"],
      ["needsReview", "Vajab tegevust"],
      ["pending", "Ootel"],
      ["infoWarnings", "Infohoiatused"],
      ["reviewed", "Üle vaadatud"],
      ["archived", "Arhiveeritud"],
      ["missingForms", "Puuduvad vormid"],
      ["missingContacts", "Puuduvad kontaktid"],
      ["missingLegalBasis", "Puuduv õiguslik alus"]
    ],
    title: "Lähtepaketid",
    municipalityFilter: "KOV filter",
    refresh: "Värskenda",
    showInfoWarnings: "Näita infohoiatusi",
    showArchived: "Näita arhiveerituid",
    defaultQueue: "Vaikimisi kuvatakse ainult aktiivsed blokeerivad ja ülevaatust vajavad probleemid.",
    loading: "Laen...",
    loadingDetails: "Laen detaile...",
    empty: "Aktiivseid lähtepakettide ülevaatuse ridu ei ole.",
    optionalReviewNote: "Ülevaatuse märkus (valikuline)",
    errors: {
      loadFailed: "Lähtepakettide laadimine ebaõnnestus",
      detailFailed: "Lähtepaketi detailide laadimine ebaõnnestus",
      actionFailed: "Ülevaatuse toiming ebaõnnestus",
      acceptFailed: "Puuduse aktsepteerimine ebaõnnestus"
    },
    columns: {
      title: "Pealkiri",
      municipality: "KOV",
      type: "Tüüp",
      status: "Staatus",
      review: "Ülevaatus",
      missing: "Puudused",
      version: "Versioon",
      active: "Aktiivne",
      lastBuilt: "Viimati koostatud",
      actions: "Tegevused"
    },
    actions: {
      markReviewed: "Märgi üle vaadatuks",
      archive: "Arhiveeri",
      restoreActive: "Taasta aktiivseks",
      recompute: "Arvuta uuesti",
      saving: "Salvestan",
      fix: "Paranda"
    },
    detail: {
      package: "Pakett",
      reviewFlags: "ülevaatuse märgid",
      reviewQueue: "Ülevaatuse järjekord",
      noReviewReasons: "Ülevaatuse põhjuseid ei ole.",
      repairLocation: "Parandamise koht",
      attribution: "Viidatavuse loetavus",
      attributionFlags: "Viidatavuse märgid",
      gapSummary: "Lünkade kokkuvõte",
      sections: "Jaotised",
      sources: "Allikad",
      reviewHistory: "Ülevaatuse ajalugu",
      noReviewHistory: "Ülevaatuse ajalugu veel ei ole.",
      packageAttribution: "paketi viidatavus",
      highRiskAttribution: "kõrge riski viidatavus",
      checked: "kontrollitud",
      notChecked: "kontrollimata",
      accepted: "aktsepteeritud",
      itemId: "kirje id",
      reason: "põhjus",
      to: "->"
    },
    boolean: {
      yes: "jah",
      no: "ei"
    },
    severity: {
      blocker: "blokeeriv",
      review: "ülevaatus",
      info: "info"
    },
    reviewStatus: {
      pending: "ootel",
      reviewed: "üle vaadatud",
      archived: "arhiveeritud"
    }
  },
  en: {
    summary: [
      ["total", "Total"],
      ["active", "Active"],
      ["needsReview", "Needs action"],
      ["pending", "Pending"],
      ["infoWarnings", "Info warnings"],
      ["reviewed", "Reviewed"],
      ["archived", "Archived"],
      ["missingForms", "Missing forms"],
      ["missingContacts", "Missing contacts"],
      ["missingLegalBasis", "Missing legal basis"]
    ],
    title: "Source packages",
    municipalityFilter: "Municipality filter",
    refresh: "Refresh",
    showInfoWarnings: "Show info warnings",
    showArchived: "Show archived",
    defaultQueue: "Default queue: only active blocker and review issues.",
    loading: "Loading...",
    loadingDetails: "Loading details...",
    empty: "No active SourcePackage review rows.",
    optionalReviewNote: "Optional review note",
    errors: {
      loadFailed: "Source package load failed",
      detailFailed: "Source package detail load failed",
      actionFailed: "Review action failed",
      acceptFailed: "Accept action failed"
    },
    columns: {
      title: "Title",
      municipality: "Municipality",
      type: "Type",
      status: "Status",
      review: "Review",
      missing: "Missing",
      version: "Version",
      active: "Active",
      lastBuilt: "Last built",
      actions: "Actions"
    },
    actions: {
      markReviewed: "Mark reviewed",
      archive: "Archive",
      restoreActive: "Restore active",
      recompute: "Recompute",
      saving: "Saving",
      fix: "Fix"
    },
    detail: {
      package: "Package",
      reviewFlags: "review flags",
      reviewQueue: "Review queue",
      noReviewReasons: "No review reasons.",
      repairLocation: "Repair location",
      attribution: "Attribution readability",
      attributionFlags: "Attribution flags",
      gapSummary: "Gap summary",
      sections: "Sections",
      sources: "Sources",
      reviewHistory: "Review history",
      noReviewHistory: "No review history yet.",
      packageAttribution: "package attribution",
      highRiskAttribution: "high risk attribution",
      checked: "checked",
      notChecked: "not checked",
      accepted: "accepted",
      itemId: "item id",
      reason: "reason",
      to: "to"
    },
    boolean: {
      yes: "yes",
      no: "no"
    },
    severity: {
      blocker: "blocker",
      review: "review",
      info: "info"
    },
    reviewStatus: {
      pending: "pending",
      reviewed: "reviewed",
      archived: "archived"
    }
  }
};

function isEstonian(locale) {
  return String(locale || "").toLowerCase().startsWith("et");
}

function getCopy(locale) {
  return SOURCE_PACKAGE_COPY[isEstonian(locale) ? "et" : "en"];
}

function formatDate(value, localeTag = "en-US") {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString(localeTag);
}

function flagList(flags = {}) {
  return Object.entries(flags)
    .filter(([, value]) => value === true)
    .map(([key]) => key.replaceAll("_", " "));
}

function countBy(items = [], predicate) {
  return items.filter(predicate).length;
}

function formatSectionName(value) {
  return String(value || "").replaceAll("_", " ");
}

function effectiveReviewStatus(item = {}) {
  if (item.status === "archived" || item.active !== true) return "archived";
  const actionable = Array.isArray(item.actionableReviewReasons) ? item.actionableReviewReasons : [];
  if (!actionable.length && String(item.reviewStatus || "") === "pending") return "reviewed";
  if (item.reviewStatus === "reviewed") return "reviewed";
  return "pending";
}

function reviewStatusLabel(status, copy) {
  const normalized = String(status || "pending").trim() || "pending";
  return copy.reviewStatus[normalized] || formatSectionName(normalized);
}

function effectiveReviewLabel(item = {}, copy) {
  const effective = effectiveReviewStatus(item);
  const raw = String(item.reviewStatus || "pending").trim() || "pending";
  if (effective === raw) return reviewStatusLabel(effective, copy);
  return `${reviewStatusLabel(effective, copy)} (${copy === SOURCE_PACKAGE_COPY.et ? "algne" : "raw"}: ${reviewStatusLabel(raw, copy)})`;
}

function isArchivedItem(item = {}) {
  return item.status === "archived" || item.active !== true || effectiveReviewStatus(item) === "archived";
}

function activeActionableReasons(item = {}) {
  if (isArchivedItem(item)) return [];
  return Array.isArray(item.actionableReviewReasons) ? item.actionableReviewReasons : [];
}

function activeInfoReasons(item = {}) {
  if (isArchivedItem(item)) return [];
  return Array.isArray(item.infoReviewReasons) ? item.infoReviewReasons : [];
}

function shouldShowItem(item = {}, { showInfoWarnings = false, showArchived = false } = {}) {
  if (isArchivedItem(item)) return showArchived;
  if (activeActionableReasons(item).length) return true;
  return showInfoWarnings && activeInfoReasons(item).length > 0;
}

export default function RagAdminSourcePackagesScreen({ locale = "en" }) {
  const copy = getCopy(locale);
  const localeTag = isEstonian(locale) ? "et-EE" : "en-US";
  const searchParams = useSearchParams();
  const municipalityId = String(searchParams?.get("municipalityId") || "").trim();
  const [items, setItems] = useState([]);
  const [detailsById, setDetailsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [acceptBusyKey, setAcceptBusyKey] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [detailLoadingId, setDetailLoadingId] = useState("");
  const [showInfoWarnings, setShowInfoWarnings] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "100" });
      if (municipalityId) query.set("municipalityId", municipalityId);

      const res = await fetch(`/api/admin/rag/source-packages?${query.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data?.ok !== true) throw new Error(data?.message || copy.errors.loadFailed);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [copy.errors.loadFailed, municipalityId]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => ({
    total: items.length,
    active: countBy(items, item => item.active === true),
    needsReview: countBy(items, item => activeActionableReasons(item).length > 0),
    pending: countBy(items, item => activeActionableReasons(item).length > 0),
    infoWarnings: countBy(items, item => activeInfoReasons(item).length > 0),
    reviewed: countBy(items, item => effectiveReviewStatus(item) === "reviewed"),
    archived: countBy(items, item => effectiveReviewStatus(item) === "archived"),
    missingForms: countBy(items, item => item.reviewFlags?.missing_forms),
    missingContacts: countBy(items, item => item.reviewFlags?.missing_contacts),
    missingLegalBasis: countBy(items, item => item.reviewFlags?.missing_legal_basis)
  }), [items]);

  const visibleItems = useMemo(
    () => items.filter(item => shouldShowItem(item, { showInfoWarnings, showArchived })),
    [items, showArchived, showInfoWarnings]
  );

  async function loadDetail(id) {
    setDetailLoadingId(id);
    try {
      const res = await fetch(`/api/admin/rag/source-packages/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data?.ok !== true) throw new Error(data?.message || copy.errors.detailFailed);
      setDetailsById(current => ({ ...current, [id]: data.item || null }));
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setDetailLoadingId("");
    }
  }

  async function toggleExpanded(id) {
    if (expandedId === id) {
      setExpandedId("");
      return;
    }
    setExpandedId(id);
    if (!detailsById[id]) await loadDetail(id);
  }

  async function runAction(id, action) {
    setBusyId(`${id}:${action}`);
    setError("");
    try {
      const needsNote = action !== "recompute";
      const reviewNote = needsNote ? window.prompt(copy.optionalReviewNote, "") ?? "" : "";
      const res = await fetch(`/api/admin/rag/source-packages/${encodeURIComponent(id)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNote })
      });
      const data = await res.json();
      if (!res.ok || data?.ok !== true) throw new Error(data?.message || copy.errors.actionFailed);
      setDetailsById(current => ({ ...current, [id]: data.item || null }));
      await load();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusyId("");
    }
  }

  async function acceptReason(id, reason, disposition) {
    const key = `${id}:${reason.code}:${disposition}`;
    setAcceptBusyKey(key);
    setError("");
    try {
      const reviewNote = window.prompt(copy.optionalReviewNote, "") ?? "";
      const res = await fetch(`/api/admin/rag/source-packages/${encodeURIComponent(id)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept_gap",
          acceptedReasonCode: reason.code,
          acceptedDisposition: disposition,
          reviewNote
        })
      });
      const data = await res.json();
      if (!res.ok || data?.ok !== true) throw new Error(data?.message || copy.errors.acceptFailed);
      setDetailsById(current => ({ ...current, [id]: data.item || null }));
      await load();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setAcceptBusyKey("");
    }
  }

  const summaryTone = key => {
    if (key === "needsReview" || key === "pending") return summary[key] > 0 ? "warn" : "neutral";
    if (key.startsWith("missing")) return summary[key] > 0 ? "err" : "neutral";
    if (key === "reviewed" || key === "active") return "ok";
    return "neutral";
  };

  return (
    <div className="ra-shell-flow">
      <section className="ra-stats ra-stats--mini" aria-label={copy.title}>
        {copy.summary.map(([key, label]) => (
          <div key={key} className="ra-stat" data-tone={summaryTone(key)}>
            <span className="ra-stat-label">{label}</span>
            <span className="ra-stat-value">{summary[key]}</span>
          </div>
        ))}
      </section>

      <section className="ra-card">
        <div className="ra-card-head">
          <div>
            <h2 className="ra-card-title">{copy.title}</h2>
            {municipalityId ? (
              <p className="ra-card-sub">{copy.municipalityFilter}: <span className="ra-mono">{municipalityId}</span></p>
            ) : null}
          </div>
          <Button type="button" variant="primary" size="sm" onClick={load} disabled={loading}>
            {copy.refresh}
          </Button>
        </div>
        <div className="ra-toolbar">
          <Checkbox
            checked={showInfoWarnings}
            onChange={setShowInfoWarnings}
            label={copy.showInfoWarnings}
          />
          <Checkbox
            checked={showArchived}
            onChange={setShowArchived}
            label={copy.showArchived}
          />
          <div className="ra-toolbar-meta">
            <span>{copy.defaultQueue}</span>
          </div>
        </div>

        {error ? (
          <div role="alert" className="ra-alert">{error}</div>
        ) : null}
        {loading ? <div className="ra-empty">{copy.loading}</div> : null}

        <div className="ra-tablewrap">
          <table className="ra-table">
            <thead>
              <tr>
                <th>{copy.columns.title}</th>
                <th>{copy.columns.municipality}</th>
                <th>{copy.columns.type}</th>
                <th>{copy.columns.status}</th>
                <th>{copy.columns.review}</th>
                <th>{copy.columns.missing}</th>
                <th>{copy.columns.version}</th>
                <th>{copy.columns.active}</th>
                <th>{copy.columns.lastBuilt}</th>
                <th>{copy.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map(item => {
                const detail = detailsById[item.id] || item;
                const flags = flagList(detail.reviewFlags);
                const expanded = expandedId === item.id;
                const effectiveReview = effectiveReviewStatus(item);
                const reasons = Array.isArray(item.reviewReasons) ? item.reviewReasons : [];
                const visibleReasons = reasons.filter(reason =>
                  showInfoWarnings || showArchived || reason.severity !== "info" || reason.accepted
                );
                return (
                  <Fragment key={item.id}>
                    <tr data-selected={expanded ? "true" : undefined}>
                      <td>
                        <button type="button" className="ra-rowlink" onClick={() => toggleExpanded(item.id)}>
                          <span className="ra-td-main">{item.title || item.packageId}</span>
                        </button>
                      </td>
                      <td className="ra-mono">{item.municipalityId || "-"}</td>
                      <td>{item.packageType || "-"}</td>
                      <td>{formatSectionName(item.status)}</td>
                      <td>{effectiveReviewLabel(item, copy)}</td>
                      <td>
                        {visibleReasons.length ? (
                          <div className="ra-chiprow">
                            {visibleReasons.map(reason => (
                              <span
                                key={reason.code}
                                className="ra-chip"
                                data-tone={reason.accepted ? "dim" : reason.severity === "blocker" ? "err" : reason.severity === "review" ? "warn" : "dim"}
                              >
                                {copy.severity[reason.severity] || reason.severity}: {formatSectionName(reason.code)}{reason.accepted ? ` ${copy.detail.accepted}` : ""}
                              </span>
                            ))}
                          </div>
                        ) : "-"}
                      </td>
                      <td>{item.version}</td>
                      <td>{item.active ? copy.boolean.yes : copy.boolean.no}</td>
                      <td className="ra-td-sub">{formatDate(item.lastBuiltAt, localeTag)}</td>
                      <td>
                        <div className="ra-actions" style={{ flexWrap: "nowrap" }}>
                          <Button
                            type="button"
                            variant="primary"
                            size="2xs"
                            disabled={!!busyId || effectiveReview === "reviewed" || effectiveReview === "archived"}
                            onClick={() => runAction(item.id, "mark_reviewed")}
                          >
                            {busyId === `${item.id}:mark_reviewed` ? copy.actions.saving : copy.actions.markReviewed}
                          </Button>
                          <RagRowMenu
                            ariaLabel={`${copy.columns.actions}: ${item.title || item.packageId}`}
                            items={[
                              {
                                key: "archive",
                                label: busyId === `${item.id}:archive` ? copy.actions.saving : copy.actions.archive,
                                onSelect: () => runAction(item.id, "archive"),
                                disabled: !!busyId || effectiveReview === "archived"
                              },
                              {
                                key: "restore",
                                label: busyId === `${item.id}:restore_active` ? copy.actions.saving : copy.actions.restoreActive,
                                onSelect: () => runAction(item.id, "restore_active"),
                                disabled: !!busyId || item.active === true
                              },
                              {
                                key: "recompute",
                                label: busyId === `${item.id}:recompute` ? copy.actions.saving : copy.actions.recompute,
                                onSelect: () => runAction(item.id, "recompute"),
                                disabled: !!busyId
                              }
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr key={`${item.id}-detail`}>
                        <td colSpan={10}>
                          {detailLoadingId === item.id && !detailsById[item.id] ? (
                            <div className="ra-empty">{copy.loadingDetails}</div>
                          ) : (
                          <div className="ra-grid" style={{ padding: "0.4rem 0" }}>
                            <div className="ra-col-6 ra-form">
                              <div className="ra-label">{copy.detail.package}</div>
                              <div className="ra-mono">packageId: {detail.packageId}</div>
                              <div className="ra-mono">canonicalItemId: {detail.canonicalItemId}</div>
                              <div className="ra-td-sub">{copy.detail.reviewFlags}: {flags.length ? flags.join(", ") : "-"}</div>
                              <div className="ra-form">
                                <div className="ra-label">{copy.detail.reviewQueue}</div>
                                <div className="ra-changes">
                                  {(detail.reviewReasons || []).length ? (
                                    detail.reviewReasons.map(reason => (
                                      <div key={reason.code} className="ra-change">
                                        <div className="ra-chiprow">
                                          <span className="ra-chip" data-tone={reason.accepted ? "dim" : reason.severity === "blocker" ? "err" : "warn"}>
                                            {copy.severity[reason.severity] || reason.severity}
                                          </span>
                                          {reason.accepted ? <span className="ra-chip" data-tone="dim">{copy.detail.accepted}</span> : null}
                                          <span>{reason.label}</span>
                                        </div>
                                        <div>{copy.detail.itemId}: {reason.repair?.canonicalItemId || detail.canonicalItemId || "-"}</div>
                                        <div>{copy.detail.repairLocation}: {reason.repair?.fileHint || "-"}</div>
                                        <div>
                                          sourceKeys: {(reason.repair?.sourceKeys || []).join(", ") || "-"}
                                        </div>
                                        <div className="ra-actions">
                                          <Button as="a" href={localizePath(reason.repair?.kovHref || "/admin/rag/kov", locale)} variant="primary" size="sm">
                                            {copy.actions.fix}
                                          </Button>
                                          {reason.acceptable && !reason.accepted ? ACCEPTANCE_DISPOSITIONS.map(([value, labels]) => (
                                            <Button
                                              key={value}
                                              type="button"
                                              variant="primary"
                                              size="sm"
                                              disabled={!!acceptBusyKey}
                                              onClick={() => acceptReason(item.id, reason, value)}
                                            >
                                              {acceptBusyKey === `${item.id}:${reason.code}:${value}` ? copy.actions.saving : labels[isEstonian(locale) ? "et" : "en"]}
                                            </Button>
                                          )) : null}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="ra-td-sub">{copy.detail.noReviewReasons}</div>
                                  )}
                                </div>
                              </div>
                              <div className="ra-form">
                                <div className="ra-label">{copy.detail.attribution}</div>
                                <div className="ra-chiprow">
                                  <span className="ra-chip" data-tone={detail.packageAttributionChecked ? "ok" : "warn"}>
                                    {copy.detail.packageAttribution}: {detail.packageAttributionChecked ? copy.detail.checked : copy.detail.notChecked}
                                  </span>
                                  <span className="ra-chip" data-tone={detail.highRiskAttributionChecked ? "ok" : "warn"}>
                                    {copy.detail.highRiskAttribution}: {detail.highRiskAttributionChecked ? copy.detail.checked : copy.detail.notChecked}
                                  </span>
                                </div>
                                <div>
                                  <div className="ra-label">{copy.detail.attributionFlags}</div>
                                  <div className="ra-chiprow">
                                    {(detail.attributionFlags || []).length ? (
                                      detail.attributionFlags.map(flag => (
                                        <span key={flag} className="ra-chip" data-tone="warn">{formatSectionName(flag)}</span>
                                      ))
                                    ) : (
                                      <span className="ra-td-sub">-</span>
                                    )}
                                  </div>
                                </div>
                                <div className="ra-changes">
                                  {Object.entries(detail.sectionAttributionSummary || {}).map(([section, info]) => (
                                    <div key={section} className="ra-change">
                                      <div>
                                        {formatSectionName(section)}{" "}
                                        <span className="ra-mono">{info?.evidence_strength || "unknown"}</span>
                                      </div>
                                      <div>
                                        {(info?.evidence_statuses || []).map(status => formatSectionName(status)).join(", ") || "-"}
                                      </div>
                                      <div>
                                        sources: {(info?.source_ids || []).join(", ") || "-"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="ra-form">
                                <div className="ra-label">{copy.detail.gapSummary}</div>
                                <div className="ra-changes">
                                  {Object.entries(detail.gapSummary || {}).map(([section, gap]) => (
                                    <div key={section} className="ra-change">
                                      <div>
                                        {formatSectionName(section)}{" "}
                                        <span className="ra-mono">{gap?.status || "unknown"}</span>
                                      </div>
                                      <div>
                                        {copy.detail.reason}: {formatSectionName(gap?.likelyReason) || "-"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="ra-col-6 ra-form">
                              <div>
                                <div className="ra-label">{copy.detail.sections}</div>
                                <div className="ra-kv">
                                  {Object.entries(detail.sectionSummary || {}).map(([key, value]) => (
                                    <div key={key}>
                                      <span>{key}</span>
                                      <span>{value?.count || 0}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="ra-label">{copy.detail.sources}</div>
                                <div className="ra-changes">
                                  {(detail.sourceMembership || []).map(source => (
                                    <div key={source.source_id} className="ra-change">
                                      <div className="ra-mono">{source.source_id}</div>
                                      <div>
                                        {source.source_type || "-"} | {(source.sections || []).join(", ") || "-"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="ra-label">{copy.detail.reviewHistory}</div>
                                <div className="ra-changes">
                                  {(detail.history || []).length ? (
                                    detail.history.map(entry => (
                                      <div key={entry.id} className="ra-change">
                                        <div>
                                          {entry.action} · <span className="ra-td-sub">{formatDate(entry.createdAt, localeTag)}</span>
                                          {entry.actor ? <span className="ra-td-sub"> · {entry.actor}</span> : null}
                                        </div>
                                        <div>
                                          {entry.fromStatus || "-"} / {entry.fromReviewStatus || "-"} / {entry.fromActive ? "active" : "inactive"} {copy.detail.to} {entry.toStatus || "-"} / {entry.toReviewStatus || "-"} / {entry.toActive ? "active" : "inactive"}
                                        </div>
                                        {entry.note ? <div>{entry.note}</div> : null}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="ra-td-sub">{copy.detail.noReviewHistory}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {!loading && !visibleItems.length ? (
                <tr>
                  <td colSpan={10} className="ra-td-sub" style={{ textAlign: "center", padding: "1.6rem" }}>
                    {copy.empty}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
