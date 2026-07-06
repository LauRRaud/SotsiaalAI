"use client";


import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import LoginModal from "@/components/LoginModal";
import { localizePath } from "@/lib/localizePath";
import { pushWithTransition } from "@/lib/routeTransition";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

export default function JoinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t, locale } = useI18n();
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const token = searchParams.get("token");

  useEffect(() => {
    setStatusMsg("");
    setError("");
  }, [token]);

  const joinErrorText = t("join.error");

  async function accept() {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError(t("join.name_required"));
      return;
    }
    setBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          display_name: trimmedName,
          locale
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        const msg = resolveApiMessage({
          payload: data,
          t,
          fallbackKey: "join.error",
          fallbackText: joinErrorText
        });
        throw new Error(msg);
      }
      setStatusMsg(t("join.success"));
      if (data?.roomId) {
        pushWithTransition(
          router,
          localizePath(`/vestlus?roomId=${encodeURIComponent(data.roomId)}`, locale)
        );
      } else {
        pushWithTransition(router, localizePath("/vestlus", locale));
      }
    } catch (err) {
      setError(err?.message || joinErrorText);
    } finally {
      setBusy(false);
    }
  }

  const handleSubmit = event => {
    event.preventDefault();
    accept();
  };

  return (
    <section lang={locale}>
      <div>
        <h1>
          {token ? t("join.heading") : t("join.missing_title")}
        </h1>
        <div>
          {!token ? (
            <p>
              {t("join.missing_description")}
            </p>
          ) : (
            <>
              <p>
                {t("join.lead")}
              </p>
              {status !== "authenticated" ? (
                <div>
                  <p>
                    {t("join.signin_prompt")}
                  </p>
                  <Button type="button" onClick={() => setLoginOpen(true)}>
                    {t("join.signin")}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <p>
                    {t("join.logged_in_as", {
                      email: session?.user?.email || session?.user?.id
                    })}
                  </p>
                  <label htmlFor="join-display-name">
                    {t("join.name_label")}
                  </label>
                  <Input
                    id="join-display-name"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    disabled={busy}
                  />
                  <div>
                    <Button type="submit" disabled={busy}>
                      {busy ? t("join.joining") : t("join.join_button")}
                    </Button>
                  </div>
                </form>
              )}
              {statusMsg ? (
                <p role="status">
                  {statusMsg}
                </p>
              ) : null}
              {error ? (
                <p role="alert">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} suppressRedirect />
      </div>
    </section>
  );
}
