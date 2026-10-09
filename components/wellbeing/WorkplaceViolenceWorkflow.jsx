"use client";

/**
 * Töövägivald: sammud ühisel sammuvormil.
 *
 * Kirjeldus (sammud, küsimused, signaalid, valmis tekstid): `forms/workplaceViolenceForm.js`.
 * Kuju ja kujundus: `WellbeingStepForm.jsx` ja selle kõrval olev CSS-moodul.
 */

import { workplaceViolenceForm } from "./forms/workplaceViolenceForm";
import WellbeingStepForm from "./WellbeingStepForm";

export default function WorkplaceViolenceWorkflow({ onNavigate }) {
  return <WellbeingStepForm definition={workplaceViolenceForm} onNavigate={onNavigate} />;
}
