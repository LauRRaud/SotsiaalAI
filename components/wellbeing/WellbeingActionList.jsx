"use client";

import Button from "@/components/ui/Button";

export default function WellbeingActionList({ actions = [], actionRoutes = {}, onNavigate }) {
  if (!actions.length) return null;

  return (
    <div aria-label="Soovitatud järgmised sammud">
      {actions.map((action) => (
        <Button
          key={action.workflowType}
          type="button"
          className="wellbeing-choice-btn"
          onClick={() => onNavigate?.(actionRoutes[action.workflowType] || "/tooheaolu")}
        >
          <span>{action.label}</span>
          {action.reason ? <small>{action.reason}</small> : null}
        </Button>
      ))}
    </div>
  );
}
