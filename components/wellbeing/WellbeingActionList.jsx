"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";

/**
 * Soovitatud järgmised sammud töövormi tulemuse all.
 *
 * Pealkiri ja põhjendus on eraldi ridadel (ActionCard); varem olid need ühe
 * pillnupu sees kokku kirjutatud.
 */
export default function WellbeingActionList({ actions = [], actionRoutes = {}, onNavigate }) {
  const { t } = useI18n();
  if (!actions.length) return null;

  return (
    <ActionCardGrid label={t("wellbeing.quick_check.result.next_steps")}>
      {actions.map((action) => (
        <ActionCard
          key={action.workflowType}
          title={action.label}
          description={action.reason}
          onClick={() => onNavigate?.(actionRoutes[action.workflowType] || "/tooheaolu")}
        />
      ))}
    </ActionCardGrid>
  );
}
