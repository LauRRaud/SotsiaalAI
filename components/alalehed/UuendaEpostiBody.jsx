"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizePath } from "@/lib/localizePath";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";
import LoginModal from "@/components/LoginModal";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

export default function UuendaEpostiBody() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const {
    t,
    locale
  } = useI18n();
  const ringRef = useRef(null);
  const PIN_MIN = 4;
  const PIN_MAX = 8;
  const [currentEmail, setCurrentEmail] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const errorId = error ? "update-email-error" : undefined;
  const backLabel = t("buttons.back_previous");
  const pinPlaceholder = t("profile.email_update.pin_placeholder");
  const usernameLabel = t("profile.email");
  const usernameAutoFill =
    (currentEmail || session?.user?.email || email || "").trim().toLowerCase();
  const searchParams = useSearchParams();
  const returnToProfile = searchParams?.get("return") === "profile";
  const returnToOrbitMenu = returnToProfile && searchParams?.get("orbit") === "1";
  const profileReturnPath = localizePath(returnToOrbitMenu ? "/profiil?orbit=1" : "/vestlus?profile=1", locale);
  const handleBack = () => returnToProfile ? pushWithTransition(router, profileReturnPath) : typeof window !== "undefined" && window.history.length > 1 ? backWithTransition(router) : pushWithTransition(router, localizePath("/profiil", locale));
  useEffect(() => {
    if (status !== "authenticated") return;
    let isActive = true;
    const loadCurrentEmail = async () => {
      try {
        const res = await fetch("/api/profile", {
          cache: "no-store"
        });
        const payload = await res.json().catch(() => ({}));
        if (!isActive) return;
        if (res.ok) {
          setCurrentEmail(payload?.user?.email || "");
          setPendingEmail(payload?.user?.pendingEmailChange?.email || "");
        }
      } catch (err) {
        console.error("update email profile load", err);
      }
    };
    loadCurrentEmail();
    return () => {
      isActive = false;
    };
  }, [status]);
  useEffect(() => {
    if (status !== "unauthenticated") return;
    setError("");
  }, [status]);
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (status !== "authenticated") {
      setError(t("profile.login_to_view"));
      setLoginOpen(true);
      return;
    }
    const nextEmail = email.trim().toLowerCase();
    const pinClean = pin.replace(/\D/g, "");
    if (!nextEmail) {
      setError(t("profile.email_update.error_email_required"));
      return;
    }
    if (!nextEmail.includes("@")) {
      setError(t("profile.email_update.error_email_invalid"));
      return;
    }
    if (!pinClean) {
      setError(t("profile.email_update.error_pin_required"));
      return;
    }
    if (pinClean.length < PIN_MIN || pinClean.length > PIN_MAX) {
      setError(t("profile.email_update.error_pin_length", {
        min: PIN_MIN,
        max: PIN_MAX
      }));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: nextEmail,
          currentPassword: pinClean,
          locale
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.ok === false) {
        setError(resolveApiMessage({
          payload,
          t,
          fallbackKey: "profile.email_update.error_failed"
        }));
        return;
      }
      setPendingEmail(payload?.pendingEmail || nextEmail);
      setEmail("");
      setPin("");
    } catch (err) {
      console.error("update email error", err);
      setError(t("profile.email_update.error_failed"));
    } finally {
      setLoading(false);
    }
  }
  async function handleResend() {
    setActionBusy("resend");
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/profile/email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.ok === false) {
        setError(resolveApiMessage({ payload, t, fallbackKey: "profile.email_update.error_failed" }));
        return;
      }
      setNotice(t("profile.email_update.resent"));
    } catch (err) {
      console.error("resend email change", err);
      setError(t("profile.email_update.error_failed"));
    } finally {
      setActionBusy("");
    }
  }
  async function handleCancel() {
    setActionBusy("cancel");
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/profile/email-change", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.ok === false) {
        setError(resolveApiMessage({ payload, t, fallbackKey: "profile.email_update.error_failed" }));
        return;
      }
      setPendingEmail("");
      setEmail("");
      setPin("");
      setNotice(t("profile.email_update.cancelled"));
    } catch (err) {
      console.error("cancel email change", err);
      setError(t("profile.email_update.error_failed"));
    } finally {
      setActionBusy("");
    }
  }
  const unauthenticated = status === "unauthenticated";
  return <section lang={locale}>
      <div ref={ringRef}>
        <BackButton onClick={handleBack} ariaLabel={backLabel} />
        <div>
          <h1>
            {t("profile.email_update.title")}
          </h1>
        </div>
        <div>
          {unauthenticated ? <div>
              <p>
                {t("profile.login_to_view")}
              </p>
              <Button type="button" variant="primary" onClick={() => setLoginOpen(true)}>
                <span>{t("auth.login.title")}</span>
              </Button>
            </div> : pendingEmail ? <div aria-live="polite">
              <h2>{t("profile.email_update.pending_title")}</h2>
              <p>
                {t("profile.email_update.pending_body", { email: pendingEmail })}
              </p>
              <p>
                {t("profile.email_update.pending_hint")}
              </p>
              {notice && <p role="status">{notice}</p>}
              {error && <p id={errorId} role="alert">{error}</p>}
              <div>
                <Button type="button" variant="primary" onClick={handleResend} disabled={actionBusy !== ""}>
                  <span>
                    {actionBusy === "resend" ? t("profile.email_update.resending") : t("profile.email_update.resend")}
                  </span>
                </Button>
                <Button type="button" variant="secondary" onClick={handleCancel} disabled={actionBusy !== ""}>
                  <span>
                    {actionBusy === "cancel" ? t("profile.email_update.cancelling") : t("profile.email_update.cancel")}
                  </span>
                </Button>
              </div>
            </div> : <Form onSubmit={handleSubmit} autoComplete="on" aria-busy={loading ? "true" : "false"}>
              <input aria-label={usernameLabel} id="email-username" name="username" type="email" autoComplete="username" value={usernameAutoFill} readOnly tabIndex={-1} className="sr-only" />
              <label htmlFor="current-email" className="sr-only">
                {t("profile.email_update.current_placeholder")}
              </label>
              <input type="email" id="current-email" name="current-email" placeholder={t("profile.email_update.current_placeholder")} value={currentEmail} readOnly aria-readonly="true" autoComplete="username" inputMode="email" />
              <label htmlFor="email" className="sr-only">
                {t("profile.email_update.new_placeholder")}
              </label>
              <input type="email" id="email" name="email" placeholder={t("profile.email_update.new_placeholder")} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" inputMode="email" disabled={loading} aria-invalid={error ? "true" : "false"} aria-describedby={errorId} />
              <label htmlFor="pin" className="sr-only">
                {t("profile.email_update.pin_placeholder")}
              </label>
              <input type="password" id="pin" name="pin" placeholder={pinPlaceholder} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX))} required minLength={PIN_MIN} maxLength={PIN_MAX} autoComplete="current-password" disabled={loading} />
              {error && <p id={errorId} role="alert">
                  {error}
                </p>}
              <div>
                <Button type="submit" variant="primary" disabled={loading}>
                  <span>
                    {loading ? t("profile.email_update.submitting") : t("profile.email_update.submit")}
                  </span>
                </Button>
              </div>
            </Form>}
        </div>
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} suppressRedirect onAuthSuccess={() => {
      setLoginOpen(false);
      router.refresh();
    }} />
    </section>;
}
