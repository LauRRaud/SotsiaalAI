"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import AppLink from "@/components/ui/Link";
import { localizePath } from "@/lib/localizePath";
import styles from "./PendingInviteBanner.module.css";

/*
  Ootel-kutse bänner. Püüab kinni Juhtum B: kasutaja registreerus/logis
  sisse otse (mitte kutselingilt) ja maandub vestluses ilma tellimuseta,
  taipamata, et tal on ootel sponsoreeritud kutse.

  KAKS olekut (23.07 leid päris-testist — test3 logis sisse KINNITAMATA
  e-postiga → bänner vaikis, sest ootel-rada nõuab kinnitatud e-posti):
    1. Kinnitatud e-post + ootel kutse → "Liitu" (/join?invite=<id>).
    2. Kinnitamata e-post + ootel kutse → "Kinnita esmalt e-post" +
       "Saada kinnituskiri uuesti" (link-liitumine töötab ka kinnitamata,
       aga id-rada nõuab omanditõendit = kinnitust, sest annab ligipääsu
       privaatsele ruumile).
*/
export default function PendingInviteBanner() {
  const { status, data: session } = useSession();
  const { t, locale } = useI18n();
  const [invite, setInvite] = useState(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [resendState, setResendState] = useState("idle"); // idle | sending | sent

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/invites/pending", {
          headers: { Accept: "application/json" }
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const first = Array.isArray(data?.invites) ? data.invites[0] : null;
        if (first) {
          setInvite(first);
        } else if (data?.emailVerified === false && data?.hasPending) {
          setNeedsVerify(true);
        }
      } catch {
        // vaikne — bänner on abistav lisa, mitte kriitiline rada
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  async function resendVerification() {
    const email = session?.user?.email;
    if (!email || resendState === "sending") return;
    setResendState("sending");
    try {
      await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale })
      });
    } catch {
      // POST /api/verify-email vastab alati üldiselt; vaikne
    } finally {
      setResendState("sent");
    }
  }

  if (dismissed) return null;
  if (!invite && !needsVerify) return null;

  const dismissBtn = (
    <button
      type="button"
      className={styles.dismiss}
      aria-label={t("pendingInvite.dismiss")}
      onClick={() => setDismissed(true)}
    >
      <span aria-hidden="true">{t("symbols.times")}</span>
    </button>
  );

  // Olek 2: kinnitamata e-post
  if (!invite && needsVerify) {
    return (
      <div className={styles.wrap} role="status" aria-live="polite">
        <div className={styles.card}>
          {dismissBtn}
          <p className={styles.title}>{t("pendingInvite.title")}</p>
          {resendState === "sent" ? (
            <p className={styles.body}>
              {t("pendingInvite.verify_sent", {
                email: session?.user?.email || ""
              })}
            </p>
          ) : (
            <>
              <p className={styles.body}>{t("pendingInvite.verify_body")}</p>
              <button
                type="button"
                className={styles.action}
                onClick={resendVerification}
                disabled={resendState === "sending"}
              >
                {resendState === "sending"
                  ? t("pendingInvite.verify_sending")
                  : t("pendingInvite.verify_action")}
              </button>
              <p className={styles.hint}>{t("pendingInvite.verify_spam_hint")}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Olek 1: kinnitatud e-post + ootel kutse
  const roomTitle = String(invite.roomTitle || "").trim();
  const body = roomTitle
    ? t("pendingInvite.body", { room: roomTitle })
    : t("pendingInvite.body_no_room");
  const joinHref = localizePath(
    `/join?invite=${encodeURIComponent(invite.id)}`,
    locale
  );

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.card}>
        {dismissBtn}
        <p className={styles.title}>{t("pendingInvite.title")}</p>
        <p className={styles.body}>{body}</p>
        <AppLink href={joinHref} className={styles.action} prefetch={false}>
          {t("pendingInvite.join")}
        </AppLink>
      </div>
    </div>
  );
}
