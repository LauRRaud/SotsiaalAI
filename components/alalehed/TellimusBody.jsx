"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import RichText from "@/components/i18n/RichText";
import LoginModal from "@/components/LoginModal";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
const emailReplacement = {
  email: {
    open: `<a href="mailto:info@sotsiaal.ai">`,
    close: "</a>"
  }
};
const subscriptionCheckoutDisabled = ["false", "0", "off"].includes(
  String(process.env.NEXT_PUBLIC_SUBSCRIPTION_CHECKOUT_OPEN || "false")
    .trim()
    .toLowerCase(),
);

let maksekeskusScriptPromise = null;

function loadMaksekeskusCheckoutScript(scriptUrl) {
  const src = String(scriptUrl || "").trim();
  if (!src) {
    return Promise.reject(new Error("missing_script_url"));
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("browser_only"));
  }
  if (window.Maksekeskus?.Checkout) {
    return Promise.resolve(window.Maksekeskus);
  }
  if (maksekeskusScriptPromise) {
    return maksekeskusScriptPromise;
  }

  maksekeskusScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Maksekeskus), {
        once: true
      });
      existing.addEventListener("error", () => reject(new Error("script_load_failed")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve(window.Maksekeskus);
    script.onerror = () => {
      maksekeskusScriptPromise = null;
      reject(new Error("script_load_failed"));
    };
    document.head.appendChild(script);
  });

  return maksekeskusScriptPromise;
}

export default function TellimusBody() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [subActive, setSubActive] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [planRole, setPlanRole] = useState("CLIENT");
  const [monthlyAmountLabel, setMonthlyAmountLabel] = useState("");
  const [subscriptionMeta, setSubscriptionMeta] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [checkoutAgreed, setCheckoutAgreed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const {
    t,
    locale
  } = useI18n();
  const backLabel = t("buttons.back_previous");
  const searchParams = useSearchParams();
  const paymentState = String(searchParams?.get("payment") || "").toLowerCase();
  const returnToProfile = searchParams?.get("return") === "profile";
  const returnToOrbitMenu = returnToProfile && searchParams?.get("orbit") === "1";
  const reason = String(searchParams?.get("reason") || "").toLowerCase();
  const isVerifiedEntry = reason === "email-verified";
  const isAuthed = status === "authenticated" || !!session?.user;
  const errorText = String(error || "");
  const suppressError =
    /(makseteenuse\\s+pakk|maksepakkuja\\s+ei\\s+ole\\s+seadistatud|payment provider\\s+is\\s+not\\s+configured|платежн.*не\\s+настро)/i.test(
      errorText
    );
  const providerConfigError = suppressError ? errorText : "";
  const visibleError = errorText && !suppressError ? errorText : "";
  const sponsoredEndsSoon = Boolean(subscriptionMeta?.isSponsored && subscriptionMeta?.sponsorEndsSoon);
  const sponsoredExpired = Boolean(subscriptionMeta?.isSponsored && subscriptionMeta?.sponsorExpired);
  const sponsorDaysLeft = Number(subscriptionMeta?.daysLeft || 0);
  const localeDateFormat = locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "et-EE";
  const sponsorValidUntil = subscriptionMeta?.validUntil
    ? new Date(subscriptionMeta.validUntil).toLocaleDateString(localeDateFormat)
    : "";
  const validUntilDate = sponsorValidUntil;
  const nextBillingDate = subscriptionMeta?.nextBilling
    ? new Date(subscriptionMeta.nextBilling).toLocaleDateString(localeDateFormat)
    : sponsorValidUntil;
  const nextRetryDate = subscriptionMeta?.nextRetryAt
    ? new Date(subscriptionMeta.nextRetryAt).toLocaleDateString(localeDateFormat)
    : "";
  const isPastDue = Boolean(subscriptionMeta?.isPastDue);
  const willRetry = Boolean(subscriptionMeta?.willRetry);
  const cancelAtPeriodEnd = Boolean(subscriptionMeta?.cancelAtPeriodEnd);
  const hasStatusNotice = Boolean(sponsoredExpired || isPastDue || info || visibleError);
  const checkoutAgreementReplacements = {
    terms: {
      open: `<a href="${localizePath("/kasutustingimused", locale)}">`,
      close: "</a>"
    },
    privacy: {
      open: `<a href="${localizePath("/privaatsustingimused", locale)}">`,
      close: "</a>"
    }
  };
  const planRoleLabel =
    planRole === "SERVICE_PROVIDER"
      ? t("role.provider")
      : planRole === "SOCIAL_WORKER"
        ? t("role.worker")
        : t("role.client");
  const subscriptionInfoText = monthlyAmountLabel
    ? t("subscription.info_priced", {
        role: planRoleLabel,
        amount: monthlyAmountLabel
      })
    : t("subscription.info");
  const sponsoredInfoText = t("subscription.sponsored_info");
  const recurringTitle = t("subscription.checkout.recurring_title", "SotsiaalAI kuutellimus");
  const recurringDescription = t("subscription.checkout.recurring_description", {
    role: planRoleLabel,
    amount: monthlyAmountLabel || ""
  });
  const recurringConfirmation = t(
    "subscription.checkout.recurring_confirmation",
    "Kinnitan, et nõustun korduva kuumaksega ja volitan SotsiaalAI-d võtma igakuise makse sama kaardiga kuni tellimuse tühistamiseni."
  );
  const subscriptionActiveSummary = monthlyAmountLabel
    ? t("subscription.active.summary_priced", {
        role: planRoleLabel,
        amount: monthlyAmountLabel
      })
    : t("subscription.active.summary");
  const profileReturnPath = localizePath(returnToOrbitMenu ? "/profiil?orbit=1" : "/vestlus?profile=1", locale);
  const handleBack = () => {
    if (closing) return;
    setClosing(true);
    if (returnToProfile) {
      pushWithTransition(router, profileReturnPath);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      backWithTransition(router);
      return;
    }
    pushWithTransition(router, localizePath("/", locale));
  };
  useEffect(() => {
    if (status !== "unauthenticated") return;
    if (!isVerifiedEntry) return;
    setLoginOpen(true);
  }, [isVerifiedEntry, status]);
  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      delete window.sotsiaalaiMaksekeskusCompleted;
      delete window.sotsiaalaiMaksekeskusCancelled;
    };
  }, []);
  useEffect(() => {
    if (paymentState === "success") {
      setError("");
      setInfo(t("subscription.payment.confirmation_pending"));
      return;
    }
    if (paymentState === "pending") {
      setError("");
      setInfo(t("subscription.payment.pending"));
      return;
    }
    if (paymentState === "failed" || paymentState === "canceled") {
      setInfo("");
      setError(t("subscription.error.payment_failed"));
      return;
    }
    setInfo("");
  }, [paymentState, t]);
  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthed) {
      setLoading(false);
      setSubActive(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/subscription", {
          cache: "no-store"
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(resolveApiMessage({
            payload,
            t,
            fallbackKey: "subscription.error.load_failed"
          }));
          return;
        }
        const status = String(payload?.subscription?.status || "").toUpperCase();
        setSubActive(Boolean(payload?.subscription?.isActive) || status === "ACTIVE");
        setPlanRole(String(payload?.user?.planRole || payload?.user?.role || "CLIENT").toUpperCase());
        setMonthlyAmountLabel(String(payload?.user?.monthlyAmountLabel || "").trim());
        setSubscriptionMeta(payload?.subscription || null);
      } catch (err) {
        console.error("subscription GET", err);
        setError(t("profile.server_unreachable"));
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthed, status, t]);
  async function handleActivate() {
    if (subscriptionCheckoutDisabled) {
      setError(t("subscription.error.checkout_temporarily_disabled"));
      return;
    }
    if (!checkoutAgreed) {
      setError(t("subscription.checkout.error_required"));
      return;
    }
    try {
      setProcessing(true);
      setError("");
      setInfo("");
      const res = await fetch("/api/subscription/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          locale,
          acceptedTerms: checkoutAgreed
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(resolveApiMessage({
          payload,
          t,
          fallbackKey: "subscription.error.payment_start"
        }));
        return;
      }
      if (payload?.checkoutMode === "iframe_recurring") {
        const publishableKey = String(payload?.publishableKey || "").trim();
        const transactionId = String(payload?.transactionId || "").trim();
        const scriptUrl = String(payload?.scriptUrl || "").trim();

        if (!publishableKey || !transactionId || !scriptUrl) {
          setError(t("subscription.error.payment_start"));
          return;
        }

        await loadMaksekeskusCheckoutScript(scriptUrl);
        if (!window.Maksekeskus?.Checkout?.initialize || !window.Maksekeskus?.Checkout?.open) {
          setError(t("subscription.error.payment_start"));
          return;
        }

        window.sotsiaalaiMaksekeskusCompleted = () => {
          setError("");
          setInfo(t("subscription.payment.confirmation_pending"));
        };
        window.sotsiaalaiMaksekeskusCancelled = () => {
          setProcessing(false);
          setInfo("");
          setError(t("subscription.error.payment_failed"));
        };

        window.Maksekeskus.Checkout.initialize({
          key: publishableKey,
          transaction: transactionId,
          email: session?.user?.email || undefined,
          clientName: session?.user?.name || undefined,
          locale,
          recurringTitle,
          recurringDescription,
          recurringConfirmation,
          recurringChecked: false,
          recurringRequired: true,
          completed: "sotsiaalaiMaksekeskusCompleted",
          cancelled: "sotsiaalaiMaksekeskusCancelled",
          backdropClose: false
        });
        window.Maksekeskus.Checkout.open();
        return;
      }
      setError(t("subscription.error.payment_start"));
    } catch (err) {
      console.error("activate", err);
      setError(t("subscription.error.payment_start"));
    } finally {
      setProcessing(false);
    }
  }
  async function handleCancelSubscription() {
    try {
      setCancelBusy(true);
      setCancelError("");
      const res = await fetch("/api/subscription", {
        method: "DELETE"
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCancelError(resolveApiMessage({
          payload,
          t,
          fallbackKey: "api.subscription.cancel_failed"
        }));
        return;
      }
      if (payload?.subscription) {
        setSubscriptionMeta(payload.subscription);
      }
      setCancelConfirm(false);
    } catch (err) {
      console.error("subscription cancel", err);
      setCancelError(t("profile.server_unreachable"));
    } finally {
      setCancelBusy(false);
    }
  }
  if (loading) {
    return <section lang={locale}>
        <div>
          <SubpageHeader
            onBack={handleBack}
            backAriaLabel={backLabel}
          >
            {t("subscription.title")}
          </SubpageHeader>
          <div>
            <p aria-live="polite">
              {t("subscription.loading")}
            </p>
          </div>
        </div>
      </section>;
  }
  if (!isAuthed) {
    const reasonText = isVerifiedEntry
      ? t(
          "subscription.login_after_email_verify",
          "E-post on kinnitatud. Logi sisse, et jätkata tellimuse aktiveerimisega."
        )
      : t("profile.login_to_manage_sub");
    return <section lang={locale}>
        <div aria-hidden={loginOpen ? "true" : undefined}>
          <SubpageHeader
            onBack={handleBack}
            backAriaLabel={backLabel}
          >
            {t("subscription.title")}
          </SubpageHeader>
          <div>
            <p>
              {reasonText}
            </p>
            <div>
              <Button type="button" variant="primary" onClick={() => setLoginOpen(true)}>
                {t("auth.login.title")}
              </Button>
            </div>
          </div>
        </div>

        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          suppressRedirect
          onAuthSuccess={() => {
            setLoginOpen(false);
            router.refresh();
          }}
          prefillStoredEmail={!isVerifiedEntry}
        />
      </section>;
  }
  return <section lang={locale}>
      <div>
        <SubpageHeader
          onBack={handleBack}
          backAriaLabel={backLabel}
        >
          {t("subscription.title")}
        </SubpageHeader>
        <div>
          {subActive ? <>
              <div id="cancel-note">
                <div>
                  <p>
                    {subscriptionActiveSummary}
                  </p>
                  <p aria-live="polite">
                    {sponsoredEndsSoon
                      ? t("subscription.active.sponsored_ending_soon", {
                          days: sponsorDaysLeft,
                          date: sponsorValidUntil
                        })
                      : subscriptionMeta?.isSponsored
                        ? t("subscription.active.sponsored_note", {
                            date: sponsorValidUntil
                          })
                        : cancelAtPeriodEnd
                          ? t("subscription.active.cancel_at_period_end_note", {
                              date: validUntilDate
                            })
                          : t("subscription.active.recurring_note", {
                              date: nextBillingDate
                            })}
                  </p>
                </div>
                <div>
                  <Button type="button" variant="primary" aria-describedby="cancel-note" onClick={() => pushWithTransition(router, returnToProfile ? profileReturnPath : localizePath("/profiil", locale))}>
                    {t("subscription.button.open_profile")}
                  </Button>
                  {!subscriptionMeta?.isSponsored && !cancelAtPeriodEnd && !cancelConfirm ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={cancelBusy}
                      onClick={() => {
                        setCancelError("");
                        setCancelConfirm(true);
                      }}
                    >
                      {t("subscription.button.cancel")}
                    </Button>
                  ) : null}
                </div>
                {cancelConfirm && !cancelAtPeriodEnd ? (
                  <div>
                    <p>
                      {t("subscription.cancel.confirm_text", {
                        date: validUntilDate
                      })}
                    </p>
                    <div>
                      <Button type="button" variant="danger" disabled={cancelBusy} aria-busy={cancelBusy} onClick={handleCancelSubscription}>
                        {cancelBusy ? t("subscription.button.processing_cancel") : t("subscription.button.cancel_confirm")}
                      </Button>
                      <Button type="button" variant="secondary" disabled={cancelBusy} onClick={() => setCancelConfirm(false)}>
                        {t("subscription.button.cancel_keep")}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {cancelError ? (
                  <p role="alert" aria-live="assertive">
                    {cancelError}
                  </p>
                ) : null}
              </div>
            </> : <>
              <div id="checkout-consent">
                <div>
                  <div id="billing-info">
                    <RichText as="div" value={subscriptionInfoText} replacements={emailReplacement} />
                    <p>
                      {sponsoredInfoText}
                    </p>
                    {hasStatusNotice ? (
                      <div>
                        {isPastDue ? (
                          <div role="status" aria-live="polite">
                            <p>{t("subscription.past_due.title")}</p>
                            <p>
                              {willRetry
                                ? t("subscription.past_due.retrying", {
                                    date: nextRetryDate
                                  })
                                : t("subscription.past_due.ended")}
                            </p>
                            <p>{t("subscription.past_due.support")}</p>
                          </div>
                        ) : null}
                        {sponsoredExpired ? <p aria-live="polite">
                            {t("subscription.active.sponsored_expired")}
                          </p> : null}
                        {info && <p aria-live="polite">
                            {info}
                          </p>}
                        {visibleError && <p role="alert" aria-live="assertive">
                            {visibleError}
                          </p>}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <p>
                      {t("subscription.checkout.title")}
                    </p>
                    <div>
                      <Checkbox
                        id="subscription-consent"
                        name="subscriptionConsent"
                        checked={checkoutAgreed}
                        disabled={processing}
                        onChange={(next) => setCheckoutAgreed(next)}
                        label={<RichText as="span" value={t("subscription.checkout.agreement")} replacements={checkoutAgreementReplacements} />}
                      />
                    </div>
                    <p>
                      {t("subscription.checkout.details")}
                    </p>
                    {providerConfigError ? <p role="alert" aria-live="assertive">
                        {providerConfigError}
                      </p> : null}
                    <div>
                      <Button type="button" variant="primary" disabled={subscriptionCheckoutDisabled || processing || !checkoutAgreed} aria-disabled={subscriptionCheckoutDisabled || processing || !checkoutAgreed} aria-busy={processing} aria-describedby="billing-info checkout-consent" onClick={handleActivate}>
                        {processing ? t("subscription.button.processing") : t("subscription.button.activate")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>}
        </div>
      </div>
    </section>;
}
