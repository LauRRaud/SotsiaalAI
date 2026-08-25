"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { kindLabel, formatDate, formatFileSize } from "@/lib/documents/presentation";
import { localizePath } from "@/lib/localizePath";

export default function DocumentDetailPage({ documentId }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  usePanelInfoSlot({ infoId: "documents", title: t("documents.detail_title", "Dokument") });
  const [state, setState] = useState({ loading: true, document: null, error: "" });

  const load = useCallback(async () => {
    setState({ loading: true, document: null, error: "" });
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.document) {
        throw new Error(payload?.message || t("documents.errors.not_found"));
      }
      setState({ loading: false, document: payload.document, error: "" });
    } catch (error) {
      setState({
        loading: false,
        document: null,
        error: error?.message || t("documents.errors.not_found")
      });
    }
  }, [documentId, t]);

  useEffect(() => { void load(); }, [load]);

  const document = state.document;
  return (
    <main className="feature-page feature-page__surface feature-page--document-detail" data-dock-scroll-behavior="recede">
      <SubpageHeader
        showBack={false}
        onBack={() => router.push(localizePath("/documents", locale))}
      >
        {t("documents.detail_title", "Dokument")}
      </SubpageHeader>
      {state.loading ? <p role="status">{t("documents.loading")}</p> : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
      {document ? (
        <Panel className="document-detail-card" variant="secondary" padding="md">
          <h1>{document.title || document.originalName}</h1>
          <dl>
            <dt>{t("documents.form.kind_label")}</dt>
            <dd>{kindLabel(document.kind, t)}</dd>
            <dt>{t("documents.file_label")}</dt>
            <dd>{document.originalName}</dd>
            <dt>{t("documents.updated_at")}</dt>
            <dd>{formatDate(document.updatedAt, locale)}</dd>
            <dt>{t("documents.size_label")}</dt>
            <dd>{formatFileSize(document.size)}</dd>
          </dl>
          <Button
            as="a"
            href={`/api/documents/${encodeURIComponent(document.id)}/download`}
            size="sm"
          >
            {t("documents.actions.download")}
          </Button>
        </Panel>
      ) : null}
    </main>
  );
}
