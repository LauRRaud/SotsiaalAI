"use client";

/**
 * Tööpiirid: sammud ühisel sammuvormil.
 *
 * Kirjeldus (sammud, küsimused, signaalid, valmis tekstid): `forms/workBoundariesForm.js`.
 * Kuju ja kujundus: `WellbeingStepForm.jsx` ja selle kõrval olev CSS-moodul.
 */

import { workBoundariesForm } from "./forms/workBoundariesForm";
import WellbeingStepForm from "./WellbeingStepForm";

export default function WorkBoundariesWorkflow({ onNavigate }) {
  return <WellbeingStepForm definition={workBoundariesForm} onNavigate={onNavigate} />;
}
