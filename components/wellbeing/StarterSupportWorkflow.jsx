"use client";

/**
 * Alustaja tugi: sammud ühisel sammuvormil.
 *
 * Kirjeldus (sammud, küsimused, signaalid, valmis tekstid): `forms/starterSupportForm.js`.
 * Kuju ja kujundus: `WellbeingStepForm.jsx` ja selle kõrval olev CSS-moodul.
 */

import { starterSupportForm } from "./forms/starterSupportForm";
import WellbeingStepForm from "./WellbeingStepForm";

export default function StarterSupportWorkflow({ onNavigate }) {
  return <WellbeingStepForm definition={starterSupportForm} onNavigate={onNavigate} />;
}
