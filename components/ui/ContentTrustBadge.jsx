"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { getContentTrustState } from "@/lib/contentTrustState";

export default function ContentTrustBadge({ generatedText, editedText, currentText, userConfirmed }) {
  const { t } = useI18n();
  const state = getContentTrustState({ generatedText, editedText, currentText, userConfirmed });
  const labels = {
    ai_draft: t("content_trust.ai_draft", "AI mustand"),
    human_edited: t("content_trust.human_edited", "Inimese muudetud"),
    human_confirmed: t("content_trust.human_confirmed", "Inimese kinnitatud")
  };
  return (
    <span className="content-trust-badge" data-content-trust={state} role="status" aria-label={labels[state]}>
      <span aria-hidden="true" />
      {labels[state]}
    </span>
  );
}
