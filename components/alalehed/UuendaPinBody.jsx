"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizePath } from "@/lib/localizePath";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";
import LoginModal from "@/components/LoginModal";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

export default function UuendaPinBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, data: session } = useSession();
  const { t, locale } = useI18n();
  const ringRef = useRef(null);

  const PIN_MIN = 4;
  const PIN_MAX = 8;
  const [currentPin, setCurrentPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);

  const backLabel = t("buttons.back_previous");
  const returnToProfile = searchParams?.get("return") === "profile";
  const returnToOrbitMenu = returnToProfile && searchParams?.get("orbit") === "1";
  const profileReturnPath = localizePath(returnToOrbitMenu ? "/profiil?orbit=1" : "/vestlus?profile=1", locale);
  const handleBack = () =>
    returnToProfile
      ? pushWithTransition(router, profileReturnPath)
      : typeof window !== "undefined" && window.history.length > 1
        ? backWithTransition(router)
        : pushWithTransition(router, localizePath("/profiil", locale));
  const pinLabel = t("profile.new_pin_label");
  const currentPinLabel = t("profile.current_pin_label");
  const confirmPinLabel = t("profile.confirm_pin_label");
  const usernameLabel = t("profile.email");
  const usernameAutoFill = session?.user?.email || "";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (status !== "authenticated") {
      setError(t("profile.login_to_view"));
      setLoginOpen(true);
      return;
    }

    const currentClean = currentPin.replace(/\D/g, "").slice(0, PIN_MAX);
    const nextClean = nextPin.replace(/\D/g, "").slice(0, PIN_MAX);
    const confirmClean = confirmPin.replace(/\D/g, "").slice(0, PIN_MAX);

    if (!currentClean) {
      setError(t("profile.errors.current_pin_required"));
      return;
    }
    if (!nextClean || !confirmClean) {
      setError(t("profile.errors.pin_required"));
      return;
    }
    if (!/^\d{4,8}$/.test(nextClean)) {
      setError(
        t("profile.errors.pin_invalid", {
          min: PIN_MIN,
          max: PIN_MAX
        })
      );
      return;
    }
    if (nextClean !== confirmClean) {
      setError(t("profile.errors.pin_mismatch"));
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
          currentPassword: currentClean,
          password: nextClean,
          locale
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.ok === false) {
        setError(
          resolveApiMessage({
            payload,
            t,
            fallbackKey: "profile.update_failed"
          })
        );
        return;
      }
      setCurrentPin("");
      setNextPin("");
      setConfirmPin("");
      setSuccess(t("profile.success_pin_updated"));
    } catch (err) {
      console.error("update pin error", err);
      setError(t("profile.server_unreachable"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section lang={locale}>
      <div ref={ringRef}>
        <BackButton
          onClick={handleBack}
          ariaLabel={backLabel}
        />
        <div>
          <h1>
            {t("profile.change_password_cta")}
          </h1>
        </div>
        <div>
          {status === "unauthenticated" ? <div>
              <p role="alert">
                {t("profile.login_to_view")}
              </p>
              <Button type="button" variant="primary" onClick={() => setLoginOpen(true)}>
                <span>{t("auth.login.title")}</span>
              </Button>
            </div> : <Form onSubmit={handleSubmit} autoComplete="on" noValidate validate={false} aria-busy={loading ? "true" : "false"}>
              <label htmlFor="pin-username" className="sr-only">
                {usernameLabel}
              </label>
              <Input id="pin-username" name="username" type="text" autoComplete="username" value={usernameAutoFill} readOnly tabIndex={-1} className="sr-only" />
              <label htmlFor="current-pin" className="sr-only">
                {currentPinLabel}
              </label>
              {/* Servahelk EI OLE enam siin. Need kolm välja olid mähitud
                  <SpecularButton> sisse — WebGL-lõuend igaühe ümber — ja just
                  see tegi PIN-lehest erandi: mujal platvormil helki ei olnud.
                  Nüüd tuleb ta vaikimisi igale väljale (tokens.css
                  --input-spec + SpecularHighlight app/layout.js's), seega
                  siit see mähis kaob ja koos temaga kolm igavest rAF-tsüklit. */}
              <Input type="password" id="current-pin" name="current-pin" placeholder={currentPinLabel} value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX))} required minLength={PIN_MIN} maxLength={PIN_MAX} autoComplete="current-password" disabled={loading} />
              <label htmlFor="next-pin" className="sr-only">
                {pinLabel}
              </label>
              <Input type="password" id="next-pin" name="next-pin" placeholder={pinLabel} value={nextPin} onChange={e => setNextPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX))} required minLength={PIN_MIN} maxLength={PIN_MAX} autoComplete="new-password" disabled={loading} />
              <label htmlFor="confirm-pin" className="sr-only">
                {confirmPinLabel}
              </label>
              <Input type="password" id="confirm-pin" name="confirm-pin" placeholder={confirmPinLabel} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX))} required minLength={PIN_MIN} maxLength={PIN_MAX} autoComplete="new-password" disabled={loading} />
              {error ? <p role="alert">
                  {error}
                </p> : null}
              {!error && success ? <p role="status">
                  {success}
                </p> : null}
              <div>
                <Button type="submit" variant="primary" disabled={loading}>
                  <span>{loading ? t("profile.saving") : t("buttons.save")}</span>
                </Button>
              </div>
            </Form>}
        </div>
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} suppressRedirect onAuthSuccess={() => {
      setLoginOpen(false);
      router.refresh();
    }} />
    </section>
  );
}
