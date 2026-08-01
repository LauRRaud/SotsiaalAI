"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";

import { useOrgApi } from "./useOrgApi";

/**
 * Pöörduja sponsorluse vastuvõtt.
 *
 * KAKS SAMMU: eelvaade ei muuda midagi, nõustumine on eraldi tegu. Klikkimine
 * ei tekita tellimust ega sidet organisatsiooniga.
 *
 * Vaates EI OLE ühtegi organisatsiooni tööruumi elementi: pöörduja ei saa
 * liikmesust, ei näe struktuuri ega liikmeid. Ta näeb ainult seda, kes ja
 * mille eest maksab — ja mida see EI tähenda.
 */
export default function OrgSponsorshipClient() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { call, busy, error } = useOrgApi();
  const [preview, setPreview] = useState(null);
  const [done, setDone] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!token) return undefined;
    (async () => {
      const payload = await call(`/api/org/sponsorlus?token=${encodeURIComponent(token)}`, {
        fallbackKey: "org.errors.invite_invalid"
      });
      if (!cancelled && payload?.preview) setPreview(payload.preview);
    })();
    return () => {
      cancelled = true;
    };
  }, [call, token]);

  const respond = useCallback(
    async (action) => {
      const payload = await call("/api/org/sponsorlus", {
        method: "POST",
        body: { token, action },
        fallbackKey: "org.errors.invite_invalid"
      });
      if (!payload) return;
      setDone(action === "accept" ? t("org.sponsorship.accepted") : t("org.sponsorship.declined"));
      setPreview(null);
    },
    [call, t, token]
  );

  const price = preview
    ? new Intl.NumberFormat(locale || "et", {
        style: "currency",
        currency: preview.currency || "EUR",
        minimumFractionDigits: 2
      }).format((Number(preview.unitPriceCents) || 0) / 100)
    : null;

  return (
    <section className="ow-shell">
      <header className="ow-header">
        <div>
          <h1 className="ow-title">{t("org.sponsorship.previewHeading")}</h1>
          <p className="ow-subtitle">{t("org.sponsorship.previewIntro")}</p>
        </div>
      </header>

      {done ? <p className="ow-notice ow-notice--privacy">{done}</p> : null}

      {preview ? (
        <div className="ow-card">
          <dl className="ow-meta">
            <div>
              <dt className="ow-meta__term">{t("org.sponsorship.payer")}</dt>
              <dd className="ow-meta__value">{preview.organization.displayName}</dd>
            </div>
            <div>
              <dt className="ow-meta__term">{t("org.sponsorship.price")}</dt>
              <dd className="ow-meta__value">{price}</dd>
            </div>
          </dl>

          <p className="ow-notice ow-notice--privacy">{t("org.sponsorship.notice")}</p>

          <div className="ow-actions">
            <Button type="button" onClick={() => respond("accept")} disabled={busy}>
              {t("org.sponsorship.accept")}
            </Button>
            <Button type="button" onClick={() => respond("decline")} disabled={busy}>
              {t("org.sponsorship.decline")}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="ow-notice ow-notice--warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
