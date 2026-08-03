"use client";


import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Form from "@/components/ui/Form";
import LoginModal from "@/components/LoginModal";
import { localizePath } from "@/lib/localizePath";
import { pushWithTransition } from "@/lib/routeTransition";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import styles from "./join.module.css";

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
  const [roomTitle, setRoomTitle] = useState("");
  const [inviteResolved, setInviteResolved] = useState(false);
  const token = searchParams.get("token");
  const inviteId = searchParams.get("invite");
  // Kaks rada: meililingi RAW token VÕI sisseloginud kasutaja ootel-kutse id.
  const hasInvite = Boolean(token || inviteId);

  useEffect(() => {
    setStatusMsg("");
    setError("");
  }, [token, inviteId]);

  // Id-põhine rada: sisseloginud kasutaja kutse laetakse ootel-nimekirjast,
  // et näidata ruumi nime ja väravada, et kutse tõesti kuulub kasutajale.
  useEffect(() => {
    if (!inviteId || token) {
      setInviteResolved(true);
      return;
    }
    if (status !== "authenticated") {
      setInviteResolved(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/invites/pending", {
          headers: { Accept: "application/json" }
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const match = Array.isArray(data?.invites)
          ? data.invites.find((entry) => entry?.id === inviteId)
          : null;
        if (match) {
          setRoomTitle(match.roomTitle || "");
          setError("");
        } else if (data?.emailVerified === false && data?.hasPending) {
          // Kinnitamata e-post: kutse on olemas, aga liitumiseks vaja kinnitust.
          setError(t("join.verify_email_first"));
        } else {
          setError(t("join.invite_not_pending"));
        }
      } catch {
        if (!cancelled) setError(t("join.error"));
      } finally {
        if (!cancelled) setInviteResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteId, token, status, t]);

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
      const res = token
        ? await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ display_name: trimmedName, locale })
          })
        : await fetch("/api/invites/pending", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: inviteId, display_name: trimmedName, locale })
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

  const heading = roomTitle
    ? t("join.heading_room", { room: roomTitle })
    : t("join.heading");

  return (
    <section lang={locale} className={styles.wrap}>
      <h1 className={styles.heading}>
        {hasInvite ? heading : t("join.missing_title")}
      </h1>
      {!hasInvite ? (
        <p className={styles.lead}>
          {t("join.missing_description")}
        </p>
      ) : (
        <>
          <p className={styles.lead}>
            {t("join.lead")}
          </p>
          {status !== "authenticated" ? (
            <div className={styles.signinBlock}>
              <p className={styles.lead}>
                {t("join.signin_prompt")}
              </p>
              <Button type="button" onClick={() => setLoginOpen(true)}>
                {t("join.signin")}
              </Button>
            </div>
          ) : (
            <Form className={styles.form} onSubmit={handleSubmit}>
              <p className={styles.loggedIn}>
                {t("join.logged_in_as", {
                  email: session?.user?.email || session?.user?.id
                })}
              </p>
              <label className={styles.label} htmlFor="join-display-name">
                {t("join.name_label")}
              </label>
              <Input
                id="join-display-name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                disabled={busy || !inviteResolved}
              />
              <div className={styles.actions}>
                <Button type="submit" disabled={busy || !inviteResolved}>
                  {busy ? t("join.joining") : t("join.join_button")}
                </Button>
              </div>
            </Form>
          )}
          {statusMsg ? (
            <p className={styles.status} role="status">
              {statusMsg}
            </p>
          ) : null}
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} suppressRedirect />
    </section>
  );
}
