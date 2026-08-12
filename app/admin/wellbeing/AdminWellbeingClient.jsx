"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdminSlidersIcon, PrivacyShieldIcon } from "@/components/brand/icons/CardIcons";
import Button from "@/components/ui/Button";
import { shouldSettleRequest } from "@/lib/chat/sidebarListState";
import Checkbox from "@/components/ui/Checkbox";
import Dropdown from "@/components/ui/Dropdown";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";

/* Skoobi tasemed on serveri enda võtmed (`role_group` jne) ja neid näidatakse
   admini vaates TEADLIKULT toorel kujul — see on tehniline vaade, kus silt
   peab kattuma sellega, mida API tagastab. */
const SCOPE_LEVELS = Object.freeze(["role_group", "organization", "municipality"]);
const PILOT_SCOPE_TYPES = Object.freeze(["municipality", "organization", "role_group"]);

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


/* SOL-WB-06: periood ei ole vabalt nihutatav vahemik, vaid valik fikseeritud
   võrgust. Kaks lubatud perioodi erinevad alati terve kuu, kvartali või aasta
   võrra — ühe inimese võrra erinevat paari, mille lahutamine tema signaalid
   välja annaks, ei ole olemas. */
function periodOptions(now = new Date()) {
  const year = now.getFullYear();
  const options = [{ value: "all", label: "Kõik" }];
  for (const offset of [0, 1]) {
    for (let quarter = 4; quarter >= 1; quarter -= 1) {
      options.push({ value: `quarter:${year - offset}:${quarter}`, label: `${year - offset} Q${quarter}` });
    }
    options.push({ value: `year:${year - offset}:0`, label: `${year - offset}` });
  }
  for (let month = 12; month >= 1; month -= 1) {
    options.push({
      value: `month:${year}:${month}`,
      label: `${year}-${String(month).padStart(2, "0")}`
    });
  }
  return options;
}

function periodParams(period) {
  const [periodKind, periodYear, periodIndex] = String(period || "all").split(":");
  if (periodKind === "all") return { periodKind: "all" };
  return { periodKind, periodYear, periodIndex };
}

function buildAggregateUrl({ roleGroup, workflowType, period, aggregationLevel, format }) {
  const params = new URLSearchParams();
  if (roleGroup) params.set("roleGroup", roleGroup);
  if (workflowType) params.set("workflowType", workflowType);
  for (const [key, value] of Object.entries(periodParams(period))) {
    if (value) params.set(key, value);
  }
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
  const [period, setPeriod] = useState("all");
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
    period,
    aggregationLevel
  }), [aggregationLevel, period, roleGroup, workflowType]);

  /* SOL-WB-14 sama klass admini pinnal: aeglane vastus kirjutas ekraanile
     eelmise filtri koondi, samal ajal kui valikud näitasid juba uut. */
  const abortRef = useRef(null);

  const loadAggregate = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const isCurrent = () => shouldSettleRequest(abortRef.current, controller);

    setStatus("loading");
    setError("");
    try {
      const response = await fetch(buildAggregateUrl(filters), {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Koondandmestiku laadimine ebaõnnestus.");
      if (!isCurrent()) return;
      setDataset(payload.dataset);
      setStatus("ready");
    } catch (loadError) {
      if (loadError?.name === "AbortError" || !isCurrent()) return;
      setError(loadError?.message || "Koondandmestiku laadimine ebaõnnestus.");
      setStatus("error");
    }
  }, [filters]);

  useEffect(() => {
    loadAggregate();
    return () => abortRef.current?.abort();
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

  /* SOL-WB-12: ligipääsu äravõtmine ja piloodi sulgemine kuuluvad tavapärasesse
     haldusvoogu. Ilma nendeta ei saanud valesti lisatud, rolli vahetanud või
     lahkunud vaatajat üldse eemaldada — ja seda tundlike koondite peal. */
  const revokePilotViewer = useCallback(async (pilotScopeId, email) => {
    setPilotStatus("saving");
    setPilotError("");
    try {
      const response = await fetch(buildPilotScopeViewersUrl(pilotScopeId), {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Vaataja eemaldamine ebaõnnestus.");
      await loadPilotScopes();
    } catch (revokeError) {
      setPilotError(revokeError?.message || "Vaataja eemaldamine ebaõnnestus.");
      setPilotStatus("error");
    }
  }, [loadPilotScopes]);

  const setPilotScopeActive = useCallback(async (pilotScopeId, active) => {
    setPilotStatus("saving");
    setPilotError("");
    try {
      const response = await fetch(buildPilotScopesUrl(), {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ pilotScopeId, active })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Piloodi muutmine ebaõnnestus.");
      await loadPilotScopes();
    } catch (updateError) {
      setPilotError(updateError?.message || "Piloodi muutmine ebaõnnestus.");
      setPilotStatus("error");
    }
  }, [loadPilotScopes]);

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
            <Input value={roleGroup} onChange={(event) => setRoleGroup(event.target.value)} placeholder="nt child_protection" />
          </label>
          <label>
            Töövoog
            <Input value={workflowType} onChange={(event) => setWorkflowType(event.target.value)} placeholder="nt quick-check" />
          </label>
          <label>
            Periood
            <Dropdown
              value={period}
              onChange={setPeriod}
              ariaLabel="Periood"
              options={periodOptions()}
            />
          </label>
          <label>
            Tase
            <Dropdown
              value={aggregationLevel}
              onChange={setAggregationLevel}
              ariaLabel="Tase"
              options={SCOPE_LEVELS.map((value) => ({ value, label: value }))}
            />
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

        <Form onSubmit={createPilotScope}>
          <div>
            <label>
              Nimi
              <Input value={pilotForm.name} onChange={(event) => updatePilotForm("name", event.target.value)} placeholder="nt Tartu KOV piloot" required />
            </label>
            <label>
              Skoobi tüüp
              <Dropdown
                value={pilotForm.scopeType}
                onChange={(next) => updatePilotForm("scopeType", next)}
                ariaLabel="Skoobi tüüp"
                options={PILOT_SCOPE_TYPES.map((value) => ({ value, label: value }))}
              />
            </label>
            <label>
              KOV tunnus
              <Input value={pilotForm.municipalityId} onChange={(event) => updatePilotForm("municipalityId", event.target.value)} placeholder="nt tartu_linn" />
            </label>
            <label>
              Organisatsioon
              <Input value={pilotForm.organizationId} onChange={(event) => updatePilotForm("organizationId", event.target.value)} placeholder="organisatsiooni tunnus" />
            </label>
          </div>
          <div>
            <label>
              Rolligrupid
              <Input value={pilotForm.roleGroups} onChange={(event) => updatePilotForm("roleGroups", event.target.value)} placeholder="child_protection, family_support" required />
            </label>
            <label>
              Vaatajate e-postid
              <Input value={pilotForm.viewerEmails} onChange={(event) => updatePilotForm("viewerEmails", event.target.value)} placeholder="kov@example.test" />
            </label>
            <label>
              Miinimum
              <Input type="number" min="3" value={pilotForm.minimumGroupSize} onChange={(event) => updatePilotForm("minimumGroupSize", event.target.value)} />
            </label>
          </div>
          <div>
            <label>
              Algus
              <Input type="date" value={pilotForm.startsAt} onChange={(event) => updatePilotForm("startsAt", event.target.value)} />
            </label>
            <label>
              Lõpp
              <Input type="date" value={pilotForm.endsAt} onChange={(event) => updatePilotForm("endsAt", event.target.value)} />
            </label>
            <Checkbox
              checked={pilotForm.active}
              onChange={(checked) => updatePilotForm("active", checked)}
              label="Aktiivne piloot"
            />
          </div>
          <div>
            <Button type="submit" variant="primary" disabled={pilotStatus === "saving"}>
              Lisa piloot
            </Button>
            {pilotError ? <span>{pilotError}</span> : null}
          </div>
        </Form>

        <Form onSubmit={addPilotViewer}>
          <label>
            Piloot
            <Dropdown
              value={selectedPilotScopeId}
              onChange={setSelectedPilotScopeId}
              ariaLabel="Piloot"
              placeholder="Vali piloot"
              emptyLabel="Pilootskoope ei ole"
              options={pilotScopes.map((scope) => ({ value: scope.id, label: scope.name }))}
            />
          </label>
          <label>
            Vaataja e-post
            <Input type="email" value={viewerEmail} onChange={(event) => setViewerEmail(event.target.value)} placeholder="kov@example.test" />
          </label>
          <Button type="submit" variant="primary" disabled={!selectedPilotScopeId || !viewerEmail.trim() || pilotStatus === "saving"}>
            Lisa vaataja
          </Button>
        </Form>

        <div>
          {pilotScopes.length > 0 ? pilotScopes.map((scope) => (
            <article key={scope.id}>
              <strong>{scope.name}</strong>
              <span>{scope.scopeType} · min {scope.minimumGroupSize} · {scope.active ? "aktiivne" : "peatatud"}</span>
              <span>{(scope.roleGroups || []).join(", ")}</span>
              <div>
                {(scope.viewerEmails || []).length > 0 ? (scope.viewerEmails || []).map((email) => (
                  <span key={email}>
                    {email}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => revokePilotViewer(scope.id, email)}
                      disabled={pilotStatus === "saving"}
                    >
                      Eemalda
                    </Button>
                  </span>
                )) : <span>Vaatajaid ei ole.</span>}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setPilotScopeActive(scope.id, !scope.active)}
                disabled={pilotStatus === "saving"}
              >
                {scope.active ? "Peata piloot" : "Ava piloot"}
              </Button>
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
