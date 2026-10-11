"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import OrgPart from "./OrgPart";
import { ExportView } from "./settings/SettingsViews";
import { exportFileName, stampOf } from "./settings/settingsRules";
import { useOrgApi } from "./useOrgApi";

/**
 * Ekspordivaade.
 *
 * VÄLJAJÄTUD ON KUVATUD, mitte peidetud. Kui organisatsioon laadib oma andmed
 * alla, peab ta nägema ka seda, MIDA seal ei ole — muidu tekib mulje, et see
 * fail on kõik, mis platvormil tema inimeste kohta on.
 *
 * KUJU (11.10). Üks väike vaade (`./settings/SettingsViews.jsx`, `ExportView`):
 * mis väljavõttes on, mis ei ole, allalaadimine ja tee tagasi seadetesse.
 * Kiirmenüüs kannab leht seadete osa all nime „Väljavõte".
 */
export default function OrgExportClient({ context }) {
  const { t } = useI18n();
  const router = useRouter();
  const { call, busy, error } = useOrgApi();
  const [generatedAt, setGeneratedAt] = useState("");
  const sending = useRef(false);

  const organizationId = context.organization.id;

  const download = useCallback(async () => {
    /* Topeltvajutus ei koosta kahte faili. */
    if (sending.current) return;
    sending.current = true;
    try {
      const payload = await call(`/api/org/${organizationId}/eksport`, {
        fallbackKey: "org.errors.export_failed"
      });
      if (!payload?.export) return;

      setGeneratedAt(payload.export.generatedAt);
      const blob = new Blob([JSON.stringify(payload.export, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFileName(organizationId, payload.export.generatedAt);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      sending.current = false;
    }
  }, [call, organizationId]);

  const settingsHref = `/org/${organizationId}/seaded`;

  return (
    <OrgPart context={context} part="settings" partLabel={t("org.settings.tabs.export")}>
      <ExportView
        t={t}
        generated={stampOf(generatedAt)}
        notice={error ? { tone: "risk", text: error } : null}
        download={{ busy, onDownload: download }}
        back={{
          href: settingsHref,
          onBack: (event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            router.push(settingsHref);
          }
        }}
      />
    </OrgPart>
  );
}
