"use client";

import { useState } from "react";

import ChoiceChips from "@/components/stage/ChoiceChips";
import Button from "@/components/ui/Button";
import { PAPER_SHEET_PARTS } from "@/lib/journey/paperSheet";

import shared from "./journey.module.css";

/**
 * Paberleht: inimene valib, mis osad tema Teekonnast prinditavale lehele lähevad,
 * ja avab lehe uuel vahelehel (brauseri „Prindi" teeb sellest paberi või PDF-i).
 *
 * Valik on aadressis (`?osad=`), mitte serveris: lehte ei salvestata kuhugi ja
 * iga avamine teeb selle Teekonna praegusest seisust uuesti.
 *
 * KUJU (10.10). See on laua osa „Paberleht ja andmed" sisu: lehe osad on
 * ühelaiused märkelahtrid ja lehe avamine on nende all. Prinditavat lehte ennast
 * ei ole muudetud.
 */
export default function JourneyPaperSheet({ journey, locale = "et", t }) {
  const [parts, setParts] = useState(() => [...PAPER_SHEET_PARTS]);
  const journeyId = journey?.id || "";
  /* Keel läheb aadressi: uuel vahelehel avatud lingil ei ole rakenduse keelepäist. */
  const href = `/api/journeys/${encodeURIComponent(journeyId)}/paberleht?osad=${encodeURIComponent(parts.join(","))}&lang=${encodeURIComponent(locale)}`;

  const toggle = (part) =>
    setParts((current) => (current.includes(part) ? current.filter((item) => item !== part) : PAPER_SHEET_PARTS.filter((item) => item === part || current.includes(item))));

  return (
    <div className={shared.stack}>
      <p className={shared.quiet}>{t("journey.paper_ui.intro", "Prindi oma Teekond ühele lehele, et see kohtumisele kaasa võtta. Vali, mis lehele läheb.")}</p>
      <ChoiceChips
        label={t("journey.paper_ui.title", "Paberleht")}
        labelHidden
        options={PAPER_SHEET_PARTS.map((part) => ({ value: part, label: t(`journey.paper_ui.parts.${part}`, "") }))}
        values={parts}
        onToggle={toggle}
        columns={3}
        keepColumns
      />
      <p className={shared.small}>{t("journey.paper_ui.never", "Ettevaatlikke tähelepanekuid lehele ei panda. Lehel on alati ruumi käsitsi märkmeteks.")}</p>
      <div>
        {parts.length ? (
          <Button as="a" href={href} target="_blank" rel="noopener noreferrer" size="sm" variant="primary" data-paper-open="1">
            {t("journey.paper_ui.open", "Ava prinditav leht")}
          </Button>
        ) : (
          <p className={shared.quiet} aria-live="polite">
            {t("journey.paper_ui.none", "Vali vähemalt üks osa.")}
          </p>
        )}
      </div>
    </div>
  );
}
