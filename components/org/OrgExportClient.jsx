"use client";

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";

import OrgHeader from "./OrgHeader";
import { useOrgApi } from "./useOrgApi";

/**
 * Ekspordivaade.
 *
 * VÄLJAJÄTUD ON KUVATUD, mitte peidetud. Kui organisatsioon laadib oma andmed
 * alla, peab ta nägema ka seda, MIDA seal ei ole — muidu tekib mulje, et see
 * fail on kõik, mis platvormil tema inimeste kohta on.
 */
export default function OrgExportClient({ context }) {
  const { t } = useI18n();
  const { call, busy, error } = useOrgApi();
  const [generatedAt, setGeneratedAt] = useState("");

  const organizationId = context.organization.id;

  const download = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/eksport`, {
      fallbackKey: "org.errors.export_failed"
    });
    if (!payload?.export) return;

    setGeneratedAt(payload.export.generatedAt);
    const blob = new Blob([JSON.stringify(payload.export, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `organisatsioon-${organizationId}-${payload.export.generatedAt.slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [call, organizationId]);

  return (
    <section className="ow-shell">
      <OrgHeader context={context} />

      <div className="ow-card">
        <h2 className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.exportView.heading")}
        </h2>
        <p className="ow-subtitle">{t("org.exportView.intro")}</p>
        <p className="ow-notice ow-notice--privacy">{t("org.exportView.excludes")}</p>
        <div className="ow-actions">
          <Button type="button" onClick={download} disabled={busy}>
            {t("org.exportView.download")}
          </Button>
        </div>
        {generatedAt ? (
          <p className="ow-empty">
            {t("org.exportView.generated")}: {new Date(generatedAt).toISOString().slice(0, 19).replace("T", " ")}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="ow-notice ow-notice--warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
