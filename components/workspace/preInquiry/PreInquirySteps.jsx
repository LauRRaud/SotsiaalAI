"use client";

/**
 * PreInquirySteps — eelpöördumise sammud all kiirmenüüs.
 *
 * Varem oli sammude rida klaaspaneeli ülaosas tekstireana („1Täpsusta
 * eelinfot2Eelinfo ülevaade…") ja selle kohal täislaiuses nupp „Uus". Nüüd on
 * sammud seal, kus kõigil sammudega lehtedel: all kiirmenüüs (`StepRail`), ja
 * „Uus eelpöördumine" on riba lõpus plussmärgina. Paneel jääb sisu jaoks.
 *
 * `steps`: [{ key, label, short }]; `activeId` on aktiivse sammu võti.
 *
 * Kujundus: sammuriba oma (components/stage/StepRail.module.css).
 */

import StepRail from "@/components/stage/StepRail";
import { usePanelInfoView } from "@/components/ui/PanelInfoSlot";

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

export default function PreInquirySteps({ steps, activeId, onSelect, label, stepLabel, newLabel, onNew }) {
  const infoOpen = usePanelInfoView().open;
  return (
    <StepRail
      steps={steps}
      activeIndex={steps.findIndex((step) => step.key === activeId)}
      hidden={infoOpen}
      label={label}
      stepLabel={stepLabel}
      onSelect={(index) => onSelect?.(steps[index].key)}
      end={
        onNew ? (
          <button type="button" className="gc-shortcut" data-on="0" aria-label={newLabel} title={newLabel} onClick={onNew}>
            <span className="gc-shortcut-icon" aria-hidden="true">
              <PlusIcon />
            </span>
          </button>
        ) : null
      }
    />
  );
}
