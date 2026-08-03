"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PrivacyShieldIcon, TermsDocIcon } from "@/components/brand/icons/CardIcons";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";

const copy = {
  title: "KOV piloodi koondvaade",
  privacy:
    "Koondvaade ei kuva üksiktöötajate vastuseid, vabatekste, kliendiandmeid ega väikese grupi detaile. Detailid avatakse ainult siis, kui miinimumgrupi lävi on täidetud.",
  viewContext: "Mida vaatan",
  scope: "Skoop",
  period: "Periood",
  decisionSummary: "Otsustaja kokkuvõte",
  primaryRecommendation: "Esimene kokkulepe",
  decisionFocus: "Arutelu fookus",
  pilotScope: "Piloot",
  roleGroup: "Rolligrupp",
  workflowType: "Töövoog",
  periodStart: "Algus",
  periodEnd: "Lõpp",
  aggregationLevel: "Tase",
  refresh: "Värskenda",
  csv: "CSV",
  sampleSize: "Valim",
  recordCount: "Kirjeid",
  minimumGroupSize: "Miinimumgrupp",
  status: "Staatus",
  suppressed: "Summutatud",
  open: "Avatud",
  suppressedNotice:
    "Andmed on summutatud, sest valim on alla miinimumgrupi. Väikese tiimi tulemusi ei kuvata äratuntaval kujul.",
  metrics: "Mõõdikud",
  rows: "rida",
  metric: "Metric",
  value: "Väärtus",
  noMetrics:
    "Mõõdikuid ei kuvata. Kui valim on alla miinimumgrupi, jäävad detailid privaatsuse tõttu peidetuks.",
  report: "Piloodi aruanne",
  print: "Prindivaade",
  xlsx: "XLSX",
  signalLoad: "Signaalikoormus",
  priorities: "Töökorralduslikud prioriteedid",
  agreements: "Soovitatavad kokkulepped",
  noPriorities: "Prioriteete ei kuvata enne, kui miinimumgrupi lävi on täidetud.",
  noAgreements: "Soovitatavad kokkulepped tekivad korduvate koormusmustrite põhjal.",
  redSignals: "Punased",
  yellowSignals: "Kollased",
  greenSignals: "Rohelised"
};

const aggregationLevelOptions = ["role_group", "organization", "municipality"];

function metricLabel(metricKey) {
  return String(metricKey || "")
    .replaceAll("_", " ")
    .replaceAll(".", " / ");
}

function formatMetricValue(metric) {
  const value = Number(metric?.metricValue || 0);
  if (String(metric?.metricKey || "").endsWith(".share")) {
    return `${Math.round(value * 1000) / 10}%`;
  }
  return String(value);
}

function buildPilotAggregateUrl({ pilotId, roleGroup, workflowType, periodStart, periodEnd, aggregationLevel, format }) {
  const params = new URLSearchParams();
  if (pilotId) params.set("pilotId", pilotId);
  if (roleGroup) params.set("roleGroup", roleGroup);
  if (workflowType) params.set("workflowType", workflowType);
  if (periodStart) params.set("periodStart", periodStart);
  if (periodEnd) params.set("periodEnd", periodEnd);
  if (aggregationLevel) params.set("aggregationLevel", aggregationLevel);
  if (format) params.set("format", format);
  return `/api/wellbeing/pilot/aggregate${params.size ? `?${params.toString()}` : ""}`;
}

function periodLabel(periodStart, periodEnd) {
  if (periodStart && periodEnd) return `${periodStart} kuni ${periodEnd}`;
  if (periodStart) return `alates ${periodStart}`;
  if (periodEnd) return `kuni ${periodEnd}`;
  return "Kõik piloodi andmed";
}

function scopeMeta(scope) {
  if (!scope) return "Admini vabafilter";
  if (scope.municipalityId) return `KOV: ${scope.municipalityId}`;
  if (scope.organizationId) return `Organisatsioon: ${scope.organizationId}`;
  return scope.scopeType || "role_group";
}

export default function WellbeingPilotClient({ allowedRoleGroups = [], pilotScopes = [], isAdmin = false }) {
  const normalizedPilotScopes = useMemo(() => (
    Array.isArray(pilotScopes) ? pilotScopes.filter((scope) => scope?.id) : []
  ), [pilotScopes]);
  const [pilotId, setPilotId] = useState(normalizedPilotScopes[0]?.id || "");
  const selectedPilotScope = normalizedPilotScopes.find((scope) => scope.id === pilotId) || normalizedPilotScopes[0] || null;
  const scopedRoleGroups = Array.isArray(selectedPilotScope?.roleGroups) ? selectedPilotScope.roleGroups : allowedRoleGroups;
  const [roleGroup, setRoleGroup] = useState(scopedRoleGroups[0] || "");
  const [workflowType, setWorkflowType] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [aggregationLevel, setAggregationLevel] = useState("role_group");
  const [dataset, setDataset] = useState(null);
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const hasPilotScopes = normalizedPilotScopes.length > 0;
  const hasFixedRoleGroups = scopedRoleGroups.length > 0;

  useEffect(() => {
    if (!hasPilotScopes) return;
    if (!normalizedPilotScopes.some((scope) => scope.id === pilotId)) {
      setPilotId(normalizedPilotScopes[0]?.id || "");
    }
  }, [hasPilotScopes, normalizedPilotScopes, pilotId]);

  useEffect(() => {
    if (!hasFixedRoleGroups) return;
    if (!scopedRoleGroups.includes(roleGroup)) {
      setRoleGroup(scopedRoleGroups[0] || "");
    }
  }, [hasFixedRoleGroups, roleGroup, scopedRoleGroups]);

  const filters = useMemo(() => ({
    pilotId: pilotId.trim(),
    roleGroup: roleGroup.trim(),
    workflowType: workflowType.trim(),
    periodStart,
    periodEnd,
    aggregationLevel
  }), [aggregationLevel, periodEnd, periodStart, pilotId, roleGroup, workflowType]);

  const loadAggregate = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch(buildPilotAggregateUrl(filters), {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Piloodi koondandmestiku laadimine ebaõnnestus.");
      setDataset(payload.dataset);
      setReport(payload.report || null);
      setStatus("ready");
    } catch (loadError) {
      setError(loadError?.message || "Piloodi koondandmestiku laadimine ebaõnnestus.");
      setStatus("error");
    }
  }, [filters]);

  useEffect(() => {
    loadAggregate();
  }, [loadAggregate]);

  const csvUrl = buildPilotAggregateUrl({ ...filters, format: "csv" });
  const printUrl = buildPilotAggregateUrl({ ...filters, format: "report-html" });
  const xlsxUrl = buildPilotAggregateUrl({ ...filters, format: "xlsx" });
  const metrics = dataset?.metrics || [];
  const currentMunicipalityId = selectedPilotScope?.municipalityId || "";
  const currentPeriodLabel = periodLabel(periodStart, periodEnd);
  const currentScopeMeta = currentMunicipalityId ? `KOV: ${currentMunicipalityId}` : scopeMeta(selectedPilotScope);

  return (
    <div>
      <section>
        <div>
          <div>
            <PrivacyShieldIcon width={22} height={22} />
          </div>
          <h1>{copy.title}</h1>
          <p>
            {copy.privacy}
          </p>
        </div>
      </section>

      <section>
        <div>
          <PrivacyShieldIcon width={18} height={18} />
          <h2>{copy.viewContext}</h2>
        </div>
        <div>
          <ContextCard label={copy.pilotScope} value={selectedPilotScope?.name || "Admini vaade"} />
          <ContextCard label={copy.scope} value={currentScopeMeta} />
          <ContextCard label={copy.period} value={currentPeriodLabel} />
          <ContextCard label={copy.roleGroup} value={roleGroup || "Kõik lubatud rolligrupid"} />
        </div>
      </section>

      <section>
        <div>
          {hasPilotScopes ? (
            <label>
              {copy.pilotScope}
              <Dropdown
                value={pilotId}
                onChange={setPilotId}
                ariaLabel={copy.pilotScope}
                options={normalizedPilotScopes.map((scope) => ({ value: scope.id, label: scope.name }))}
              />
            </label>
          ) : null}
          <label>
            {copy.roleGroup}
            {hasFixedRoleGroups ? (
              <Dropdown
                value={roleGroup}
                onChange={setRoleGroup}
                ariaLabel={copy.roleGroup}
                options={scopedRoleGroups.map((group) => ({ value: group, label: group }))}
              />
            ) : (
              <input value={roleGroup} onChange={(event) => setRoleGroup(event.target.value)} placeholder={isAdmin ? "nt child_protection" : "piloodi rolligrupp"} disabled={!isAdmin} />
            )}
          </label>
          <label>
            {copy.workflowType}
            <input value={workflowType} onChange={(event) => setWorkflowType(event.target.value)} placeholder="nt quick-check" />
          </label>
          <label>
            {copy.periodStart}
            <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
          </label>
          <label>
            {copy.periodEnd}
            <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
          </label>
          <label>
            {copy.aggregationLevel}
            <Dropdown
              value={aggregationLevel}
              onChange={setAggregationLevel}
              ariaLabel={copy.aggregationLevel}
              options={aggregationLevelOptions.map((option) => ({ value: option, label: option }))}
            />
          </label>
        </div>
        <div>
          <Button type="button" variant="primary" onClick={loadAggregate} disabled={status === "loading"}>
            {copy.refresh}
          </Button>
          <Button as="a" href={csvUrl} variant="primary">
            {copy.csv}
          </Button>
          <Button as="a" href={printUrl} target="_blank" rel="noreferrer" variant="primary">
            {copy.print}
          </Button>
          <Button as="a" href={xlsxUrl} variant="primary">
            {copy.xlsx}
          </Button>
        </div>
      </section>

      <section aria-live="polite">
        <div>
          <MetricCard label={copy.sampleSize} value={dataset?.sampleSize ?? "-"} />
          <MetricCard label={copy.recordCount} value={dataset?.recordCount ?? "-"} />
          <MetricCard label={copy.minimumGroupSize} value={dataset?.minimumGroupSize ?? "-"} />
          <MetricCard label={copy.status} value={dataset?.suppressed ? copy.suppressed : copy.open} tone={dataset?.suppressed ? "warning" : "ok"} />
        </div>
        {error ? <p>{error}</p> : null}
      {dataset?.suppressed ? (
          <p>
            {copy.suppressedNotice}
          </p>
        ) : null}
      </section>

      <section>
        <div>
          <TermsDocIcon width={18} height={18} />
          <h2>{copy.report}</h2>
        </div>
        <p>
          {report?.privacyNotice || copy.noPriorities}
        </p>
        <div>
          <div>
            <span>{copy.decisionSummary}</span>
            <strong>{report?.executiveSummary?.statusLabel || "-"}</strong>
            <p>{report?.decisionSummary || copy.noPriorities}</p>
          </div>
          <div>
            <span>{copy.primaryRecommendation}</span>
            <strong>{report?.primaryRecommendation?.title || copy.noAgreements}</strong>
            {report?.primaryRecommendation?.description ? (
              <p>{report.primaryRecommendation.description}</p>
            ) : null}
          </div>
        </div>
        {(report?.decisionFocus || []).length > 0 ? (
          <div>
            <h3>{copy.decisionFocus}</h3>
            <div>
              {report.decisionFocus.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        ) : null}
        <div>
          <div>
            <h3>{copy.signalLoad}</h3>
            <div>
              <SignalPill label={copy.redSignals} value={report?.signal?.redCount ?? "-"} tone="red" />
              <SignalPill label={copy.yellowSignals} value={report?.signal?.yellowCount ?? "-"} tone="yellow" />
              <SignalPill label={copy.greenSignals} value={report?.signal?.greenCount ?? "-"} tone="green" />
            </div>
          </div>
          <div>
            <h3>{copy.priorities}</h3>
            {(report?.priorities || []).length > 0 ? (
              <div>
                {report.priorities.map((priority) => (
                  <ReportItem key={priority.metricKey} eyebrow={priority.categoryLabel} title={priority.label} meta={`${priority.count}/${priority.sampleSize}`} />
                ))}
              </div>
            ) : (
              <p>{copy.noPriorities}</p>
            )}
          </div>
        </div>
        <div>
          <h3>{copy.agreements}</h3>
          {(report?.recommendedAgreements || []).length > 0 ? (
            <div>
              {report.recommendedAgreements.map((item) => (
                <ReportItem key={item.key} title={item.title} meta={item.description} />
              ))}
            </div>
          ) : (
            <p>{copy.noAgreements}</p>
          )}
        </div>
      </section>

      <section>
        <div>
          <h2>{copy.metrics}</h2>
          <span>{metrics.length} {copy.rows}</span>
        </div>
        {metrics.length > 0 ? (
          <div>
            <table>
              <thead>
                <tr>
                  <th>{copy.metric}</th>
                  <th>{copy.value}</th>
                  <th>{copy.sampleSize}</th>
                  <th>{copy.aggregationLevel}</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.metricKey}>
                    <td>{metricLabel(metric.metricKey)}</td>
                    <td>{formatMetricValue(metric)}</td>
                    <td>{metric.sampleSize}</td>
                    <td>{metric.aggregationLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            {copy.noMetrics}
          </p>
        )}
      </section>
    </div>
  );
}

function SignalPill({ label, value, tone }) {
  return (
    <div data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReportItem({ eyebrow, title, meta }) {
  return (
    <article>
      {eyebrow ? <span>{eyebrow}</span> : null}
      <strong>{title}</strong>
      {meta ? <span>{meta}</span> : null}
    </article>
  );
}

function ContextCard({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricCard({ label, value, tone = "neutral" }) {
  return (
    <div data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
