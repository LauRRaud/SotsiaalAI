"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";

const HIDDEN_METRICS = new Set(["RAG_SEARCH"]);
const LOCALE_TAGS = { et: "et-EE", en: "en-GB", ru: "ru-RU" };

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCount(value, locale) {
  return new Intl.NumberFormat(LOCALE_TAGS[locale] || locale).format(asNumber(value));
}

function formatMetricValue(metric, value, locale, t) {
  const amount = asNumber(value);
  if (metric === "STORAGE_BYTES") {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let unitIndex = 0;
    let scaled = amount;
    while (scaled >= 1024 && unitIndex < units.length - 1) {
      scaled /= 1024;
      unitIndex += 1;
    }
    return `${new Intl.NumberFormat(LOCALE_TAGS[locale] || locale, {
      maximumFractionDigits: unitIndex > 1 ? 1 : 0
    }).format(scaled)} ${units[unitIndex]}`;
  }
  if (metric === "STT_SECONDS") {
    const minutes = Math.round(amount / 60);
    return t("profile.usage.units.minutes", { count: formatCount(minutes, locale) });
  }
  if (metric === "TTS_CHARS") {
    return t("profile.usage.units.characters", { count: formatCount(amount, locale) });
  }
  return formatCount(amount, locale);
}

function formatDate(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale] || locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function planLabel(planKey, fallback, t) {
  const translated = t(`profile.usage.plans.${planKey}`, "");
  return translated || fallback || planKey;
}

export default function UsageOverview({ active = true, onManageSubscription }) {
  const { t, locale } = useI18n();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetch("/api/me/usage", {
      cache: "no-store",
      headers: { "Accept-Language": locale },
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || t("profile.usage.load_failed"));
        }
        setSnapshot(payload);
      })
      .catch((fetchError) => {
        if (fetchError?.name !== "AbortError") {
          setError(fetchError?.message || t("profile.usage.load_failed"));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [active, locale, t]);

  const visibleMetrics = useMemo(
    () => (snapshot?.metrics || []).filter((item) => !HIDDEN_METRICS.has(item.metric)),
    [snapshot]
  );

  if (loading && !snapshot) {
    return <div className="usage-overview" aria-busy="true"><p>{t("profile.usage.loading")}</p></div>;
  }

  if (error && !snapshot) {
    return <div className="usage-overview"><div role="alert">{error}</div></div>;
  }

  if (!snapshot) return null;

  const plan = snapshot.plan || {};
  const price = asNumber(plan.price);
  const priceText = plan.key === "admin_internal"
    ? t("profile.usage.internal")
    : snapshot.subscription?.billingSource === "SPONSORED_BY_HOST"
      ? t("profile.usage.sponsored")
      : price === 0
        ? t("profile.usage.free")
        : t("profile.usage.per_month", {
        price: new Intl.NumberFormat(LOCALE_TAGS[locale] || locale, {
          style: "currency",
          currency: plan.currency || "EUR"
        }).format(price)
      });
  const billingDate = snapshot.subscription?.nextBilling || snapshot.subscription?.validUntil;

  return (
    <section className="usage-overview" aria-labelledby="usage-overview-title">
      <div className="usage-overview__intro">
        <div>
          <p className="usage-overview__eyebrow">{t("profile.usage.active_plan")}</p>
          <h3 id="usage-overview-title">{planLabel(plan.key, plan.name, t)}</h3>
        </div>
        <strong>{priceText}</strong>
      </div>

      {billingDate ? (
        <p className="usage-overview__billing">
          {snapshot.subscription?.nextBilling
            ? t("profile.usage.next_billing", { date: formatDate(billingDate, locale) })
            : t("profile.usage.access_until", { date: formatDate(billingDate, locale) })}
        </p>
      ) : null}

      {visibleMetrics.length ? (
        <div className="usage-overview__metrics">
          {visibleMetrics.map((item) => {
            const used = formatMetricValue(item.metric, item.consumed, locale, t);
            const limit = formatMetricValue(item.metric, item.hardLimit, locale, t);
            return (
              <article className="usage-meter" data-state={item.state} key={item.metric}>
                <div className="usage-meter__line">
                  <h4>{t(`profile.usage.metrics.${item.metric}`)}</h4>
                  <span>{t("profile.usage.used_of", { used, limit })}</span>
                </div>
                <div
                  className="usage-meter__track"
                  role="progressbar"
                  aria-label={t(`profile.usage.metrics.${item.metric}`)}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={Math.round(item.percentage)}
                >
                  <span style={{ width: `${Math.max(0, Math.min(100, item.percentage))}%` }} />
                </div>
                <div className="usage-meter__meta">
                  <span>{t(`profile.usage.periods.${item.period}`)}</span>
                  {item.resetAt ? <span>{t("profile.usage.resets", { date: formatDate(item.resetAt, locale) })}</span> : null}
                </div>
                {item.state !== "normal" ? (
                  <p className="usage-meter__notice">{t(`profile.usage.states.${item.state}`)}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="usage-overview__empty">
          <p>{t("profile.usage.free_description")}</p>
        </div>
      )}

      {plan.key !== "admin_internal" ? (
        <div className="usage-overview__action">
          <Button type="button" onClick={onManageSubscription}>
            {price === 0 ? t("profile.usage.compare_plans") : t("profile.manage_subscription")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
