"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminSlidersIcon, PrivacyShieldIcon } from "@/components/brand/icons/CardIcons";
import Button from "@/components/ui/Button";

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

function buildAggregateUrl({ roleGroup, workflowType, periodStart, periodEnd, aggregationLevel, format }) {
  const params = new URLSearchParams();
  if (roleGroup) params.set("roleGroup", roleGroup);
  if (workflowType) params.set("workflowType", workflowType);
  if (periodStart) params.set("periodStart", periodStart);
  if (periodEnd) params.set("periodEnd", periodEnd);
  if (aggregationLevel) params.set("aggregationLevel", aggregationLevel);
  if (format) params.set("format", format);
  return `/api/admin/wellbeing/aggregate${params.size ? `?${params.toString()}` : ""}`;
}

function buildPilotScopesUrl() {
  return "/api/admin/wellbeing/pilots";
}

function buildPilotScopeViewersUrl(pilotScopeId) {
  return `/api/admin/wellbeing/pilots/${encodeURIComponent(pilotScopeId)}/viewers`;
}

export default function AdminWellbeingClient() {
  const [roleGroup, setRoleGroup] = useState("");
  const [workflowType, setWorkflowType] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [aggregationLevel, setAggregationLevel] = useState("role_group");
  const [dataset, setDataset] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [pilotScopes, setPilotScopes] = useState([]);
  const [pilotStatus, setPilotStatus] = useState("idle");
  const [pilotError, setPilotError] = useState("");
  const [pilotForm, setPilotForm] = useState({
    name: "",
    scopeType: "municipality",
    municipalityId: "",
    organizationId: "",
    roleGroups: "",
    viewerEmails: "",
    minimumGroupSize: "3",
    startsAt: "",
    endsAt: "",
    active: true
  });
  const [selectedPilotScopeId, setSelectedPilotScopeId] = useState("");
  const [viewerEmail, setViewerEmail] = useState("");

  const filters = useMemo(() => ({
    roleGroup: roleGroup.trim(),
    workflowType: workflowType.trim(),
    periodStart,
    periodEnd,
    aggregationLevel
  }), [aggregationLevel, periodEnd, periodStart, roleGroup, workflowType]);

  const loadAggregate = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch(buildAggregateUrl(filters), {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Koondandmestiku laadimine ebaõnnestus.");
      setDataset(payload.dataset);
      setStatus("ready");
    } catch (loadError) {
      setError(loadError?.message || "Koondandmestiku laadimine ebaõnnestus.");
      setStatus("error");
    }
  }, [filters]);

  useEffect(() => {
    loadAggregate();
  }, [loadAggregate]);

  const loadPilotScopes = useCallback(async () => {
    setPilotStatus("loading");
    setPilotError("");
    try {
      const response = await fetch(buildPilotScopesUrl(), {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Pilootide laadimine ebaonnestus.");
      setPilotScopes(Array.isArray(payload.pilotScopes) ? payload.pilotScopes : []);
      if (!selectedPilotScopeId && payload.pilotScopes?.[0]?.id) {
        setSelectedPilotScopeId(payload.pilotScopes[0].id);
      }
      setPilotStatus("ready");
    } catch (loadError) {
      setPilotError(loadError?.message || "Pilootide laadimine ebaonnestus.");
      setPilotStatus("error");
    }
  }, [selectedPilotScopeId]);

  useEffect(() => {
    loadPilotScopes();
  }, [loadPilotScopes]);

  const updatePilotForm = useCallback((field, value) => {
    setPilotForm((current) => ({ ...current, [field]: value }));
  }, []);

  const createPilotScope = useCallback(async (event) => {
    event.preventDefault();
    setPilotStatus("saving");
    setPilotError("");
    try {
      const response = await fetch(buildPilotScopesUrl(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(pilotForm)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Piloodi salvestamine ebaonnestus.");
      setPilotForm({
        name: "",
        scopeType: "municipality",
        municipalityId: "",
        organizationId: "",
        roleGroups: "",
        viewerEmails: "",
        minimumGroupSize: "3",
        startsAt: "",
        endsAt: "",
        active: true
      });
      await loadPilotScopes();
    } catch (saveError) {
      setPilotError(saveError?.message || "Piloodi salvestamine ebaonnestus.");
      setPilotStatus("error");
    }
  }, [loadPilotScopes, pilotForm]);

  const addPilotViewer = useCallback(async (event) => {
    event.preventDefault();
    if (!selectedPilotScopeId || !viewerEmail.trim()) return;
    setPilotStatus("saving");
    setPilotError("");
    try {
      const response = await fetch(buildPilotScopeViewersUrl(selectedPilotScopeId), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: viewerEmail })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Vaataja lisamine ebaõnnestus.");
      setViewerEmail("");
      await loadPilotScopes();
    } catch (saveError) {
      setPilotError(saveError?.message || "Vaataja lisamine ebaõnnestus.");
      setPilotStatus("error");
    }
  }, [loadPilotScopes, selectedPilotScopeId, viewerEmail]);

  const csvUrl = buildAggregateUrl({ ...filters, format: "csv" });
  const metrics = dataset?.metrics || [];

  return (
    <div>
      <section>
        <div>
          <div>
            <PrivacyShieldIcon width={22} height={22} />
          </div>
          <h1>Tööheaolu koondandmestik</h1>
          <p>
            Admini tööpind KOV-piloodi anonüümsete koondnäitajate kontrolliks. Alla miinimumgrupi läve detailseid mõõdikuid ei näidata.
          </p>
        </div>
      </section>

      <section>
        <div>
          <label>
            Rolligrupp
            <input value={roleGroup} onChange={(event) => setRoleGroup(event.target.value)} placeholder="nt child_protection" />
          </label>
          <label>
            Töövoog
            <input value={workflowType} onChange={(event) => setWorkflowType(event.target.value)} placeholder="nt quick-check" />
          </label>
          <label>
            Algus
            <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
          </label>
          <label>
            Lõpp
            <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
          </label>
          <label>
            Tase
            <select value={aggregationLevel} onChange={(event) => setAggregationLevel(event.target.value)}>
              <option value="role_group">role_group</option>
              <option value="organization">organization</option>
              <option value="municipality">municipality</option>
            </select>
          </label>
        </div>
        <div>
          <Button type="button" variant="primary" onClick={loadAggregate} disabled={status === "loading"}>
            Värskenda
          </Button>
          <Button as="a" href={csvUrl} variant="primary">
            CSV
          </Button>
        </div>
      </section>

      <section>
        <div>
          <div>
            <AdminSlidersIcon width={18} height={18} />
            <h2>Piloodi skoobid</h2>
          </div>
          <Button type="button" variant="primary" onClick={loadPilotScopes} disabled={pilotStatus === "loading"}>
            Laadi
          </Button>
        </div>

        <form onSubmit={createPilotScope}>
          <div>
            <label>
              Nimi
              <input value={pilotForm.name} onChange={(event) => updatePilotForm("name", event.target.value)} placeholder="nt Tartu KOV piloot" required />
            </label>
            <label>
              Skoobi tüüp
              <select value={pilotForm.scopeType} onChange={(event) => updatePilotForm("scopeType", event.target.value)}>
                <option value="municipality">municipality</option>
                <option value="organization">organization</option>
                <option value="role_group">role_group</option>
              </select>
            </label>
            <label>
              KOV tunnus
              <input value={pilotForm.municipalityId} onChange={(event) => updatePilotForm("municipalityId", event.target.value)} placeholder="nt tartu_linn" />
            </label>
            <label>
              Organisatsioon
              <input value={pilotForm.organizationId} onChange={(event) => updatePilotForm("organizationId", event.target.value)} placeholder="organisatsiooni tunnus" />
            </label>
          </div>
          <div>
            <label>
              Rolligrupid
              <input value={pilotForm.roleGroups} onChange={(event) => updatePilotForm("roleGroups", event.target.value)} placeholder="child_protection, family_support" required />
            </label>
            <label>
              Vaatajate e-postid
              <input value={pilotForm.viewerEmails} onChange={(event) => updatePilotForm("viewerEmails", event.target.value)} placeholder="kov@example.test" />
            </label>
            <label>
              Miinimum
              <input type="number" min="3" value={pilotForm.minimumGroupSize} onChange={(event) => updatePilotForm("minimumGroupSize", event.target.value)} />
            </label>
          </div>
          <div>
            <label>
              Algus
              <input type="date" value={pilotForm.startsAt} onChange={(event) => updatePilotForm("startsAt", event.target.value)} />
            </label>
            <label>
              Lõpp
              <input type="date" value={pilotForm.endsAt} onChange={(event) => updatePilotForm("endsAt", event.target.value)} />
            </label>
            <label>
              <input type="checkbox" checked={pilotForm.active} onChange={(event) => updatePilotForm("active", event.target.checked)} />
              Aktiivne piloot
            </label>
          </div>
          <div>
            <Button type="submit" variant="primary" disabled={pilotStatus === "saving"}>
              Lisa piloot
            </Button>
            {pilotError ? <span>{pilotError}</span> : null}
          </div>
        </form>

        <form onSubmit={addPilotViewer}>
          <label>
            Piloot
            <select value={selectedPilotScopeId} onChange={(event) => setSelectedPilotScopeId(event.target.value)}>
              <option value="">Vali piloot</option>
              {pilotScopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.name}</option>)}
            </select>
          </label>
          <label>
            Vaataja e-post
            <input type="email" value={viewerEmail} onChange={(event) => setViewerEmail(event.target.value)} placeholder="kov@example.test" />
          </label>
          <Button type="submit" variant="primary" disabled={!selectedPilotScopeId || !viewerEmail.trim() || pilotStatus === "saving"}>
            Lisa vaataja
          </Button>
        </form>

        <div>
          {pilotScopes.length > 0 ? pilotScopes.map((scope) => (
            <article key={scope.id}>
              <strong>{scope.name}</strong>
              <span>{scope.scopeType} · min {scope.minimumGroupSize}</span>
              <span>{(scope.roleGroups || []).join(", ")}</span>
              <span>{(scope.viewerEmails || []).join(", ")}</span>
            </article>
          )) : (
            <p>Piloodi skoobid puuduvad.</p>
          )}
        </div>
      </section>

      <section aria-live="polite">
        <div>
          <MetricCard label="Valim" value={dataset?.sampleSize ?? "-"} />
          <MetricCard label="Kirjeid" value={dataset?.recordCount ?? "-"} />
          <MetricCard label="Miinimumgrupp" value={dataset?.minimumGroupSize ?? "-"} />
          <MetricCard label="Staatus" value={dataset?.suppressed ? "Summutatud" : "Avatud"} tone={dataset?.suppressed ? "warning" : "ok"} />
        </div>
        {error ? <p>{error}</p> : null}
        {dataset?.suppressed ? (
          <p>
            Andmed on summutatud, sest valim on alla miinimumgrupi. Detailseid töö nõudmiste, ressursside ja riskide võtmeid ei kuvata.
          </p>
        ) : null}
      </section>

      <section>
        <div>
          <h2>Mõõdikud</h2>
          <span>{metrics.length} rida</span>
        </div>
        {metrics.length > 0 ? (
          <div>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Väärtus</th>
                  <th>Valim</th>
                  <th>Tase</th>
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
            Mõõdikuid ei kuvata. Kui valim on alla miinimumgrupi, jäävad detailid privaatsuse tõttu peidetuks.
          </p>
        )}
      </section>
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
