"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { PAPER_SHEET_PARTS } from "@/lib/journey/paperSheet";

/**
 * Paberleht: inimene valib, mis osad tema Teekonnast prinditavale lehele lähevad,
 * ja avab lehe uuel vahelehel (brauseri „Prindi" teeb sellest paberi või PDF-i).
 *
 * Valik on aadressis (`?osad=`), mitte serveris: lehte ei salvestata kuhugi ja
 * iga avamine teeb selle Teekonna praegusest seisust uuesti.
 *
 * Märgistus on lihtne nagu ülejäänud Teekonna lehel; kujundus tuleb eraldi.
 */
export default function JourneyPaperSheet({ journey, locale = "et", t }) {
  const [parts, setParts] = useState(() => [...PAPER_SHEET_PARTS]);
  const journeyId = journey?.id || "";
  /* Keel läheb aadressi: uuel vahelehel avatud lingil ei ole rakenduse keelepäist. */
  const href = `/api/journeys/${encodeURIComponent(journeyId)}/paberleht?osad=${encodeURIComponent(parts.join(","))}&lang=${encodeURIComponent(locale)}`;

  const toggle = (part) =>
    setParts((current) => (current.includes(part) ? current.filter((item) => item !== part) : PAPER_SHEET_PARTS.filter((item) => item === part || current.includes(item))));

  return (
    <section id="teekond-paberleht">
      <h2>{t("journey.paper_ui.title", "Paberleht")}</h2>
      <p>{t("journey.paper_ui.intro", "Prindi oma Teekond ühele lehele, et see kohtumisele kaasa võtta. Vali, mis lehele läheb.")}</p>
      <div>
        {PAPER_SHEET_PARTS.map((part) => (
          <Checkbox
            key={part}
            id={`journey-paper-${part}`}
            checked={parts.includes(part)}
            onChange={() => toggle(part)}
            label={t(`journey.paper_ui.parts.${part}`, part)}
          />
        ))}
      </div>
      <p>{t("journey.paper_ui.never", "Ettevaatlikke tähelepanekuid lehele ei panda. Lehel on alati ruumi käsitsi märkmeteks.")}</p>
      {parts.length ? (
        <Button as="a" href={href} target="_blank" rel="noopener noreferrer">
          {t("journey.paper_ui.open", "Ava prinditav leht")}
        </Button>
      ) : (
        <p role="status">{t("journey.paper_ui.none", "Vali vähemalt üks osa.")}</p>
      )}
    </section>
  );
}
