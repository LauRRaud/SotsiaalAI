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
  taipamata, et tal on ootel sponsoreeritud kutse. Tuvastame kutse
  kinnitatud e-posti järgi (GET /api/invites/pending) ja suuname sama
  nimeküsimise vormi juurde (/join?invite=<id>), mis aktiveerib tellimuse.

  Ei sõltu meililinkidest ega suunamisketist — töötab olenemata sellest,
  kuidas konto tekkis.
*/
export default function PendingInviteBanner() {
  const { status } = useSession();
  const { t, locale } = useI18n();
  const [invite, setInvite] = useState(null);
  const [dismissed, setDismissed] = useState(false);

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
        if (first) setInvite(first);
      } catch {
        // vaikne — bänner on abistav lisa, mitte kriitiline rada
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (!invite || dismissed) return null;

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
        <button
          type="button"
          className={styles.dismiss}
          aria-label={t("pendingInvite.dismiss")}
          onClick={() => setDismissed(true)}
        >
          <span aria-hidden="true">{t("symbols.times")}</span>
        </button>
        <p className={styles.title}>{t("pendingInvite.title")}</p>
        <p className={styles.body}>{body}</p>
        <AppLink href={joinHref} className={styles.action} prefetch={false}>
          {t("pendingInvite.join")}
        </AppLink>
      </div>
    </div>
  );
}
