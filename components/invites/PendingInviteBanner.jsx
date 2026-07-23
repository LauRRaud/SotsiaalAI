"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import AppLink from "@/components/ui/Link";
import { localizePath } from "@/lib/localizePath";
import styles from "./PendingInviteBanner.module.css";

/*
  Ootel-kutse teade platvormi hub'is (RoomStage kaardikarussell). PROP-põhine:
  RoomStage pärib ootel-kutse seisu üks kord ja annab siia (sama andmet
  kasutab ka RUUMID-kaardi badge). Elab hub-vaates, EI eellaadimisstseeni
  küljes — naastes on alati näha (omanik 23.07).

  KAKS olekut:
    1. invite (kinnitatud e-post + ootel kutse) → "Liitu" (/join?invite=<id>).
    2. needsVerify (kinnitamata e-post + ootel kutse) → "Kinnita esmalt e-post"
       + "Saada kinnituskiri uuesti".
*/
export default function PendingInviteBanner({
  invite = null,
  needsVerify = false,
  sessionEmail = ""
}) {
  const { t, locale } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  const [resendState, setResendState] = useState("idle"); // idle | sending | sent

  async function resendVerification() {
    if (!sessionEmail || resendState === "sending") return;
    setResendState("sending");
    try {
      await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sessionEmail, locale })
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
              {t("pendingInvite.verify_sent", { email: sessionEmail || "" })}
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
