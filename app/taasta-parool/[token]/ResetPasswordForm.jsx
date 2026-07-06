"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizePath } from "@/lib/localizePath";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import BackButton from "@/components/ui/BackButton";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { getFooterNote } from "@/lib/footerNote";

export default function ResetPasswordForm({
  token
}) {
  const router = useRouter();
  const {
    t,
    locale
  } = useI18n();
  const PIN_MIN = 4;
  const PIN_MAX = 8;
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const backLabel = t("buttons.back_home");
  const handleClose = () =>
    pushWithTransition(router, localizePath("/", locale));
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      backWithTransition(router);
      return;
    }
    handleClose();
  };
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!pin || !confirm) {
      setError(t("auth.resetForm.errors.required"));
      return;
    }
    if (pin !== confirm) {
      setError(t("auth.resetForm.errors.mismatch"));
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setError(t("auth.resetForm.errors.pinLength", {
        min: PIN_MIN,
        max: PIN_MAX
      }));
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token,
          pin,
          locale
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(resolveApiMessage({
          payload,
          t,
          fallbackKey: "auth.resetForm.errors.updateFailed"
        }));
        return;
      }
      setSuccess(true);
      setPin("");
      setConfirm("");
      router.refresh();
    } catch (err) {
      console.error("password reset update error", err);
      setError(t("auth.resetForm.errors.server"));
    } finally {
      setLoading(false);
    }
  }
  return (
    <section lang={locale}>
      <div>
        <BackButton
          onClick={handleBack}
          ariaLabel={backLabel}
        />
        <h1>{t("auth.resetForm.title")}</h1>
        <div>
          {success ? (
            <div>
              <p>
                {t("auth.resetForm.success")}
              </p>
              <Button
                type="button"
                onClick={handleClose}
                variant="primary"
                size="lg"
              >
                {t("buttons.back_home")}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} autoComplete="off">
              <label htmlFor="pin" className="sr-only">
                {t("auth.resetForm.fields.pin", { min: PIN_MIN, max: PIN_MAX })}
              </label>
              <Input
                type="password"
                id="pin"
                name="pin"
                size="lg"
                placeholder={t("auth.resetForm.fields.pin", { min: PIN_MIN, max: PIN_MAX })}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX))}
                required
                minLength={PIN_MIN}
                autoComplete="new-password"
                disabled={loading}
              />
              <label htmlFor="confirm" className="sr-only">
                {t("auth.resetForm.fields.confirm")}
              </label>
              <Input
                type="password"
                id="confirm"
                name="confirm"
                size="lg"
                placeholder={t("auth.resetForm.fields.confirm")}
                value={confirm}
                onChange={e => setConfirm(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX))}
                required
                minLength={PIN_MIN}
                autoComplete="new-password"
                disabled={loading}
              />
              {error && (
                <p role="alert">
                  {error}
                </p>
              )}
              <div>
                <Button type="submit" variant="primary" size="lg" disabled={loading}>
                  {loading ? t("auth.resetForm.submitting") : t("auth.resetForm.submit")}
                </Button>
              </div>
            </form>
          )}
          <footer>{getFooterNote()}</footer>
        </div>
      </div>
    </section>
  );
}
