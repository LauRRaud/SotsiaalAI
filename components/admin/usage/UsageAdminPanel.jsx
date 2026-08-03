"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Dropdown from "@/components/ui/Dropdown";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import AdminHelpButton from "@/components/admin/AdminHelpButton";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

const PERIODS = ["DAILY", "WEEKLY", "MONTHLY", "LIFETIME"];
const METRICS = [
  "CHAT_ASSISTANT_REPLY", "DOCUMENT_GENERATE", "DOCUMENT_REFINE", "FILE_ANALYZE",
  "DEEP_RESEARCH_RUN", "RAG_SEARCH", "STT_SECONDS", "TTS_CHARS", "STORAGE_BYTES"
];

function clonePlan(plan) {
  return plan ? {
    ...plan,
    price: String(plan.price ?? "0.00"),
    entitlements: (plan.entitlements || []).map(item => ({
      ...item,
      enabled: item.enabled !== false,
      softLimit: item.softLimit ?? "",
      hardLimit: item.hardLimit ?? ""
    }))
  } : null;
}

function entitlementFor(plan, metric) {
  return plan?.entitlements?.find(item => item.metric === metric) || {
    metric,
    enabled: false,
    period: "MONTHLY",
    softLimit: "",
    hardLimit: ""
  };
}

export default function UsageAdminPanel() {
  const { t, locale } = useI18n();
  const [plans, setPlans] = useState([]);
  const [planAudit, setPlanAudit] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [draft, setDraft] = useState(null);
  const [planReason, setPlanReason] = useState("");
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [notice, setNotice] = useState(null);
  const [userQuery, setUserQuery] = useState("");
  const [userResult, setUserResult] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [mutatingAccess, setMutatingAccess] = useState(false);
  const [accessReason, setAccessReason] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState({
    metric: "CHAT_ASSISTANT_REPLY",
    enabled: true,
    period: "MONTHLY",
    softLimit: "",
    hardLimit: "",
    validUntil: "",
    reason: ""
  });

  const loadPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const response = await fetch("/api/admin/usage/plans", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(resolveApiMessage({ payload, t }));
      setPlans(payload.plans || []);
      setPlanAudit(payload.audit || []);
      setSelectedPlanId(current => current || payload.plans?.[0]?.id || "");
    } catch (error) {
      setNotice({ tone: "error", text: error?.message || t("admin.usage.errors.plans_load") });
    } finally {
      setLoadingPlans(false);
    }
  }, [t]);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  useEffect(() => {
    setDraft(clonePlan(plans.find(plan => plan.id === selectedPlanId)));
    setPlanReason("");
  }, [plans, selectedPlanId]);

  const selectedPlan = useMemo(
    () => plans.find(plan => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  const updateEntitlement = (metric, patch) => {
    setDraft(current => {
      if (!current) return current;
      const next = METRICS.map(key => ({ ...entitlementFor(current, key) }));
      const index = next.findIndex(item => item.metric === metric);
      next[index] = { ...next[index], ...patch };
      return { ...current, entitlements: next };
    });
  };

  const savePlan = async event => {
    event.preventDefault();
    if (!draft || savingPlan) return;
    setSavingPlan(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/usage/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Accept-Language": locale },
        body: JSON.stringify({
          planId: draft.id,
          price: draft.price,
          reason: planReason,
          entitlements: METRICS.map(metric => entitlementFor(draft, metric))
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(resolveApiMessage({ payload, t }));
      setNotice({ tone: "success", text: t("admin.usage.plan_saved", { version: payload.plan.version }) });
      setSelectedPlanId(payload.plan.id);
      await loadPlans();
    } catch (error) {
      setNotice({ tone: "error", text: error?.message || t("admin.usage.errors.plan_save") });
    } finally {
      setSavingPlan(false);
    }
  };

  const findUser = useCallback(async (event) => {
    event?.preventDefault?.();
    const q = userQuery.trim();
    if (!q) return;
    setLoadingUser(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/usage/users?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(resolveApiMessage({ payload, t }));
      setUserResult(payload);
    } catch (error) {
      setUserResult(null);
      setNotice({ tone: "error", text: error?.message || t("admin.usage.errors.user_load") });
    } finally {
      setLoadingUser(false);
    }
  }, [t, userQuery]);

  const changeAccess = async action => {
    if (!userResult?.user?.id || mutatingAccess || !accessReason.trim()) return;
    setMutatingAccess(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/usage/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Accept-Language": locale },
        body: JSON.stringify({ userId: userResult.user.id, action, reason: accessReason })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(resolveApiMessage({ payload, t }));
      setUserResult(payload.detail);
      setAccessReason("");
      setNotice({ tone: "success", text: t(action === "suspend" ? "admin.usage.user_suspended" : "admin.usage.user_resumed") });
    } catch (error) {
      setNotice({ tone: "error", text: error?.message || t("admin.usage.errors.user_action") });
    } finally {
      setMutatingAccess(false);
    }
  };

  const saveOverride = async event => {
    event.preventDefault();
    if (!userResult?.user?.id || savingOverride) return;
    setSavingOverride(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/usage/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": locale },
        body: JSON.stringify({
          ...overrideDraft,
          userId: userResult.user.id,
          validUntil: overrideDraft.validUntil ? new Date(overrideDraft.validUntil).toISOString() : null
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(resolveApiMessage({ payload, t }));
      setNotice({ tone: "success", text: t("admin.usage.override_saved") });
      await findUser();
    } catch (error) {
      setNotice({ tone: "error", text: error?.message || t("admin.usage.errors.override_save") });
    } finally {
      setSavingOverride(false);
    }
  };

  const endOverride = async id => {
    const reason = window.prompt(t("admin.usage.override_end_reason"));
    if (!reason) return;
    setSavingOverride(true);
    try {
      const response = await fetch("/api/admin/usage/overrides", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Accept-Language": locale },
        body: JSON.stringify({ id, reason })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(resolveApiMessage({ payload, t }));
      setNotice({ tone: "success", text: t("admin.usage.override_ended") });
      await findUser();
    } catch (error) {
      setNotice({ tone: "error", text: error?.message || t("admin.usage.errors.override_end") });
    } finally {
      setSavingOverride(false);
    }
  };

  return (
    <section className="usage-admin" id="admin-usage-controls" aria-labelledby="admin-usage-title">
      <header className="usage-admin__header">
        <div>
          <p>{t("admin.usage.eyebrow")}</p>
          <h2 id="admin-usage-title">{t("admin.usage.title")}</h2>
        </div>
        <Button type="button" onClick={loadPlans} disabled={loadingPlans}>{t("admin.common.refresh")}</Button>
        <AdminHelpButton
          label={t("admin.analytics.help.aria")}
          text={t("admin.analytics.help.section_usage_controls")}
        />
      </header>

      {notice ? <div className="usage-admin__notice" data-tone={notice.tone} role="status">{notice.text}</div> : null}

      <div className="usage-admin__layout">
        <section className="usage-admin__surface" aria-labelledby="usage-plans-title">
          <div className="usage-admin__section-head">
            <div><h3 id="usage-plans-title">{t("admin.usage.plans_title")}</h3><p>{t("admin.usage.plans_help")}</p></div>
            <Dropdown
              ariaLabel={t("admin.usage.plans_title")}
              value={selectedPlanId}
              onChange={setSelectedPlanId}
              options={plans.map(plan => ({ value: plan.id, label: `${plan.name} · v${plan.version}` }))}
            />
          </div>
          {draft ? (
            <Form onSubmit={savePlan} className="usage-admin__form">
              <div className="usage-admin__plan-meta">
                <label>{t("admin.usage.price")}<Input data-variant inputMode="decimal" value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })} /></label>
                <span>{t("admin.usage.subscriptions", { count: selectedPlan?._count?.subscriptions || 0 })}</span>
              </div>
              <div className="usage-admin__entitlements">
                {METRICS.map(metric => {
                  const item = entitlementFor(draft, metric);
                  return (
                    <fieldset key={metric} className="usage-admin__entitlement">
                      <legend>{t(`profile.usage.metrics.${metric}`)}</legend>
                      <label className="usage-admin__toggle"><Checkbox bare checked={item.enabled} onChange={enabled => updateEntitlement(metric, { enabled })} />{t("admin.usage.enabled")}</label>
                      <label>{t("admin.usage.period")}<Dropdown ariaLabel={t("admin.usage.period")} value={item.period} onChange={period => updateEntitlement(metric, { period })} options={PERIODS.map(period => ({ value: period, label: t(`profile.usage.periods.${period}`) }))} /></label>
                      <label>{t("admin.usage.soft_limit")}<Input data-variant inputMode="numeric" value={item.softLimit} onChange={event => updateEntitlement(metric, { softLimit: event.target.value })} /></label>
                      <label>{t("admin.usage.hard_limit")}<Input data-variant inputMode="numeric" value={item.hardLimit} onChange={event => updateEntitlement(metric, { hardLimit: event.target.value })} /></label>
                    </fieldset>
                  );
                })}
              </div>
              <label>{t("admin.usage.change_reason")}<textarea data-variant value={planReason} onChange={event => setPlanReason(event.target.value)} required /></label>
              <div className="usage-admin__actions"><Button type="submit" disabled={savingPlan}>{savingPlan ? t("admin.common.saving") : t("admin.usage.create_version")}</Button></div>
            </Form>
          ) : <p>{loadingPlans ? t("admin.common.loading_data") : t("admin.usage.no_plans")}</p>}
          {planAudit.length ? (
            <div className="usage-admin__audit">
              <h4>{t("admin.usage.change_history")}</h4>
              {planAudit.map(item => <article key={item.id}><strong>{item.meta?.reason || item.resourceId}</strong><span>v{item.meta?.previousVersion} → v{item.meta?.newVersion} · {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</span></article>)}
            </div>
          ) : null}
        </section>

        <section className="usage-admin__surface" aria-labelledby="usage-overrides-title">
          <div className="usage-admin__section-head"><div><h3 id="usage-overrides-title">{t("admin.usage.overrides_title")}</h3><p>{t("admin.usage.overrides_help")}</p></div></div>
          <Form className="usage-admin__search" onSubmit={findUser}>
            <Input data-variant value={userQuery} onChange={event => setUserQuery(event.target.value)} placeholder={t("admin.usage.user_search_placeholder")} />
            <Button type="submit" disabled={loadingUser}>{t("admin.usage.find_user")}</Button>
          </Form>
          {userResult?.user ? (
            <div className="usage-admin__user">
              <div className="usage-admin__identity"><strong>{userResult.user.email || userResult.user.id}</strong><span>{userResult.user.role} · {userResult.snapshot?.plan?.name}</span></div>
              <dl className="usage-admin__user-facts">
                <div><dt>{t("admin.usage.user_id")}</dt><dd>{userResult.user.id}</dd></div>
                <div><dt>{t("admin.usage.email_verified")}</dt><dd>{userResult.user.emailVerified ? t("admin.common.yes") : t("admin.common.no")}</dd></div>
                <div><dt>{t("admin.usage.active_sessions")}</dt><dd>{userResult.user.activeSessions}</dd></div>
                <div><dt>{t("admin.usage.last_activity")}</dt><dd>{userResult.user.lastActivityAt ? new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(userResult.user.lastActivityAt)) : "-"}</dd></div>
              </dl>
              {userResult.user.suspension ? <div className="usage-admin__suspension"><strong>{t("admin.usage.suspended")}</strong><span>{userResult.user.suspension.reason}</span></div> : null}
              {!userResult.user.isAdmin ? (
                <div className="usage-admin__access-controls">
                  <label>{t("admin.usage.access_reason")}<Input data-variant value={accessReason} onChange={event => setAccessReason(event.target.value)} /></label>
                  <Button type="button" disabled={mutatingAccess || !accessReason.trim()} onClick={() => changeAccess(userResult.user.suspension ? "resume" : "suspend")}>
                    {t(userResult.user.suspension ? "admin.usage.resume_user" : "admin.usage.suspend_user")}
                  </Button>
                </div>
              ) : null}
              <div className="usage-admin__metric-strip">
                {(userResult.snapshot?.metrics || []).filter(item => item.metric !== "RAG_SEARCH").map(item => <span key={item.metric} data-state={item.state}>{t(`profile.usage.metrics.${item.metric}`)} {item.consumed}/{item.hardLimit}</span>)}
              </div>
              <Form className="usage-admin__override-form" onSubmit={saveOverride}>
                <label>{t("admin.usage.metric")}<Dropdown ariaLabel={t("admin.usage.metric")} value={overrideDraft.metric} onChange={metric => setOverrideDraft({ ...overrideDraft, metric })} options={METRICS.map(metric => ({ value: metric, label: t(`profile.usage.metrics.${metric}`) }))} /></label>
                <label>{t("admin.usage.period")}<Dropdown ariaLabel={t("admin.usage.period")} value={overrideDraft.period} onChange={period => setOverrideDraft({ ...overrideDraft, period })} options={PERIODS.map(period => ({ value: period, label: t(`profile.usage.periods.${period}`) }))} /></label>
                <label>{t("admin.usage.soft_limit")}<Input data-variant inputMode="numeric" value={overrideDraft.softLimit} onChange={event => setOverrideDraft({ ...overrideDraft, softLimit: event.target.value })} /></label>
                <label>{t("admin.usage.hard_limit")}<Input data-variant inputMode="numeric" value={overrideDraft.hardLimit} onChange={event => setOverrideDraft({ ...overrideDraft, hardLimit: event.target.value })} required /></label>
                <label>{t("admin.usage.valid_until")}<Input data-variant type="datetime-local" value={overrideDraft.validUntil} onChange={event => setOverrideDraft({ ...overrideDraft, validUntil: event.target.value })} /></label>
                <label className="usage-admin__reason">{t("admin.usage.reason")}<textarea data-variant value={overrideDraft.reason} onChange={event => setOverrideDraft({ ...overrideDraft, reason: event.target.value })} required /></label>
                <div className="usage-admin__actions"><Button type="submit" disabled={savingOverride}>{t("admin.usage.add_override")}</Button></div>
              </Form>
              <div className="usage-admin__override-list">
                {(userResult.overrides || []).map(item => {
                  const active = !item.validUntil || new Date(item.validUntil) > new Date();
                  return <article key={item.id} data-active={active ? "true" : "false"}><div><strong>{t(`profile.usage.metrics.${item.metric}`)}</strong><p>{item.reason}</p></div><span>{item.hardLimit ?? "-"} · {item.period}</span>{active ? <Button type="button" onClick={() => endOverride(item.id)} disabled={savingOverride}>{t("admin.usage.end_override")}</Button> : null}</article>;
                })}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
