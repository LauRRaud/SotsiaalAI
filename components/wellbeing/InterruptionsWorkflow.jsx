"use client";

/**
 * Katkestused: sammud ühisel sammuvormil.
 *
 * Kirjeldus (sammud, küsimused, signaalid, valmis tekstid): `forms/interruptionsForm.js`.
 * Kuju ja kujundus: `WellbeingStepForm.jsx` ja selle kõrval olev CSS-moodul.
 */

import { interruptionsForm } from "./forms/interruptionsForm";
import WellbeingStepForm from "./WellbeingStepForm";

export default function InterruptionsWorkflow({ onNavigate }) {
  return <WellbeingStepForm definition={interruptionsForm} onNavigate={onNavigate} />;
}
