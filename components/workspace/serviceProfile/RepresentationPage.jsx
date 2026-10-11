"use client";

/**
 * Asutuse kinnitamine (`/teenuseprofiil/kinnitus`): teenuseosutaja tõendab, et registrikoodiga
 * teenuseprofiil on selle asutuse oma.
 *
 * Kaks sisenemist samale lehele:
 *  - ilma lingita: seis ja vorm, millega saata kinnituslink asutuse e-postile, mis on
 *    äriregistris kirjas;
 *  - e-kirja lingiga (`?token=`): üks nupp „Kinnitan". Lingi avamine üksi midagi ei kinnita.
 *
 * Igal seisul on oma väike vaade (`representationView` failis ./representationRules.js). Reeglid
 * ja päringud on serveris: lib/serviceProviderRepresentation.js.
 * Kujundus: teenuseprofiili ühine profile.module.css; ehitusklotsid kaustast components/stage.
 */

import { useCallback, useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import { useI18n } from "@/components/i18n/I18nProvider";
import LoginModal from "@/components/LoginModal";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";

import { Notice } from "./ProfileFields";
import styles from "./profile.module.css";
import { representationView } from "./representationRules";

const API = "/api/service-provider/profile/representation";
const LINK_DAYS = 7;

function dateText(value, locale) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export default function RepresentationPage() {
  const { t, locale } = useI18n();
  const { status } = useSession();
  const searchParams = useSearchParams();
  const token = String(searchParams?.get("token") || "").trim();
  const fieldId = useId();
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState(null);
  const [link, setLink] = useState(null);
  const [forbidden, setForbidden] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const tr = useCallback((key, vars) => t(`service_provider_profile.representation.${key}`, vars || {}), [t]);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(token ? `${API}?token=${encodeURIComponent(token)}` : API, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setForbidden(resolveApiMessage({ payload, t, fallbackKey: "service_provider_profile.errors.load_failed" }));
        return;
      }
      setForbidden("");
      setState(payload?.state || null);
      setLink(payload?.link || null);
    } catch {
      setForbidden(t("service_provider_profile.errors.load_failed"));
    } finally {
      setLoaded(true);
    }
  }, [t, token]);

  useEffect(() => {
    if (status === "authenticated") void load();
    if (status === "unauthenticated") setLoaded(true);
  }, [status, load]);

  async function send(event) {
    event?.preventDefault?.();
    if (busy) return;
    setError("");
    setSent(false);
    if (!email.trim().includes("@")) {
      setError(t("service_provider_profile.errors.representation_email_invalid"));
      return;
    }
    setBusy("send");
    try {
      const response = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        setError(resolveApiMessage({ payload, t, fallbackKey: "service_provider_profile.errors.representation_mail_failed" }));
        return;
      }
      setEmail("");
      setSent(true);
      await load();
    } catch {
      setError(t("service_provider_profile.errors.representation_mail_failed"));
    } finally {
      setBusy("");
    }
  }

  async function confirm() {
    if (busy) return;
    setError("");
    setBusy("confirm");
    try {
      const response = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        setError(resolveApiMessage({ payload, t, fallbackKey: "service_provider_profile.errors.representation_link_invalid" }));
        return;
      }
      setDone(true);
      await load();
    } catch {
      setError(t("service_provider_profile.errors.save_failed"));
    } finally {
      setBusy("");
    }
  }

  const view = representationView({
    session: status,
    loaded,
    forbidden: Boolean(forbidden),
    hasToken: Boolean(token),
    done,
    state,
    link
  });
  const title = tr("title");
  const profileHref = localizePath("/teenuseprofiil", locale);
  const organization = state?.registryCode
    ? tr("organization", { name: state.organizationName || "", code: state.registryCode })
    : "";
  const toProfile = (
    <Button as="a" href={profileHref} size="sm" variant="secondary">
      {tr("open_profile")}
    </Button>
  );

  let panel = null;
  if (view === "wait") {
    panel = (
      <StepPanel title={title}>
        <p className={styles.quiet} aria-live="polite">{tr("loading")}</p>
      </StepPanel>
    );
  } else if (view === "login") {
    panel = (
      <StepPanel
        title={title}
        lead={tr("lead")}
        actions={
          <Button type="button" size="sm" variant="primary" onClick={() => setLoginOpen(true)}>
            {t("auth.login.title")}
          </Button>
        }
      >
        <p className={styles.quiet}>{tr("login_needed")}</p>
      </StepPanel>
    );
  } else if (view === "forbidden") {
    panel = (
      <StepPanel title={title}>
        <Notice tone="risk" alert>{forbidden}</Notice>
      </StepPanel>
    );
  } else if (view === "name") {
    /* Nimi ei vasta äriregistrile: kinnitada ei saa enne, kui profiil on parandatud. */
    const vars = { name: state?.organizationName || "", code: state?.registryCode || "", registerName: state?.registerName || "" };
    panel = (
      <StepPanel title={title} question={tr("name_title")} actions={toProfile}>
        <Notice tone="risk" alert>
          {state?.nameCheck === "code_not_listed"
            ? tr("code_not_listed", vars)
            : state?.registerName
              ? tr("name_mismatch", vars)
              : tr("name_mismatch_hidden", vars)}
        </Notice>
      </StepPanel>
    );
  } else if (view === "done" || view === "confirmed") {
    panel = (
      <StepPanel title={title} question={organization} actions={toProfile}>
        <p className={styles.quiet} aria-live="polite">
          {view === "done" ? tr("link_done") : tr("confirmed", { date: dateText(state?.confirmedAt, locale) })}
        </p>
      </StepPanel>
    );
  } else if (view === "link") {
    panel = (
      <StepPanel
        title={title}
        question={tr("link_title")}
        note={error || null}
        actions={
          <Button type="button" size="sm" variant="primary" aria-busy={busy === "confirm" ? "true" : undefined} disabled={Boolean(busy)} onClick={confirm}>
            {busy === "confirm" ? tr("link_confirming") : tr("link_confirm")}
          </Button>
        }
      >
        <p className={styles.quiet}>{tr("link_body", { name: link?.organizationName || "", code: link?.registryCode || "" })}</p>
      </StepPanel>
    );
  } else if (view === "no_profile") {
    panel = (
      <StepPanel title={title} lead={tr("lead")} actions={toProfile}>
        <p className={styles.quiet}>{tr("no_profile")}</p>
      </StepPanel>
    );
  } else {
    /* Vorm: saada kinnituslink. Kehtetu lingiga tulles on sama vorm teatega ees. */
    const pending = state?.pendingLink || null;
    panel = (
      <StepPanel
        title={title}
        question={organization}
        lead={tr("how")}
        note={error || tr("other_way")}
        actions={
          <Button type="submit" form={`${fieldId}-form`} size="sm" variant="primary" aria-busy={busy === "send" ? "true" : undefined} disabled={Boolean(busy)}>
            {busy === "send" ? tr("sending") : tr("send")}
          </Button>
        }
      >
        <form id={`${fieldId}-form`} className={styles.stack} onSubmit={send} noValidate>
          {view === "link_invalid" ? <Notice tone="risk" alert>{tr("link_invalid")}</Notice> : null}
          {sent ? (
            <Notice>{tr("sent", { days: LINK_DAYS })}</Notice>
          ) : pending ? (
            <Notice tone="wait">{tr("pending", { date: dateText(pending.sentAt, locale), until: dateText(pending.expiresAt, locale) })}</Notice>
          ) : null}
          <div className={styles.field} data-size="lg">
            <label className={styles.fieldLabel} htmlFor={fieldId}>{tr("email_label")}</label>
            <Input
              id={fieldId}
              type="email"
              inputMode="email"
              autoComplete="off"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <span className={styles.fieldHint}>{tr("email_hint")}</span>
          </div>
        </form>
      </StepPanel>
    );
  }

  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <div className={styles.surface}>{panel}</div>
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        suppressRedirect
        onAuthSuccess={() => {
          setLoginOpen(false);
          setLoaded(false);
        }}
      />
    </>
  );
}
