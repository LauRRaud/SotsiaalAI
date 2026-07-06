"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import RichText from "@/components/i18n/RichText";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { localizePath } from "@/lib/localizePath";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

export default function UnustasinParooliBody() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const {
    t,
    locale
  } = useI18n();
  const errorId = error ? "reset-error" : undefined;
  const title = t("auth.reset.title");
  const backLabel = t("buttons.back_previous");
  const searchParams = useSearchParams();
  const returnToProfile = searchParams?.get("return") === "profile";
  const profileReturnPath = localizePath("/vestlus?profile=1", locale);
  const handleBack = () => returnToProfile ? pushWithTransition(router, profileReturnPath) : typeof window !== "undefined" && window.history.length > 1 ? backWithTransition(router) : pushWithTransition(router, localizePath("/", locale));
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email) {
      setError(t("auth.reset.error.required"));
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          locale
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(resolveApiMessage({
          payload,
          t,
          fallbackKey: "auth.reset.error.failed"
        }));
        return;
      }
      setSubmitted(true);
    } catch (err) {
      console.error("password reset request error", err);
      setError(t("auth.reset.error.server"));
    } finally {
      setLoading(false);
    }
  }
  return <section lang={locale}>
      <div>
        <BackButton onClick={handleBack} ariaLabel={backLabel} />
        <div>
          <h1>
            {title}
          </h1>
        </div>
        <div>
          {submitted ? <RichText as="div" value={t("auth.reset.success")} /> : <form onSubmit={handleSubmit} autoComplete="off" aria-busy={loading ? "true" : "false"}>
              <label htmlFor="email" className="sr-only">
                {t("profile.email")}
              </label>
              <input type="email" id="email" name="email" placeholder={t("auth.email_placeholder")} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" disabled={loading} aria-invalid={error ? "true" : "false"} aria-describedby={errorId} />
              {error && <p id={errorId} role="alert">
                  {error}
                </p>}
              <div>
                <Button type="submit" variant="primary" disabled={loading}>
                  <span>
                    {loading ? t("auth.reset.submitting") : t("auth.reset.submit")}
                  </span>
                </Button>
              </div>
            </form>}
        </div>
      </div>
    </section>;
}
