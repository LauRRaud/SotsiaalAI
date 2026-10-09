"use client";

/**
 * Tööprotsessid: sammud ühisel sammuvormil.
 *
 * Kirjeldus (sammud, küsimused, signaalid, valmis tekstid): `forms/workProcessesForm.js`.
 * Kuju ja kujundus: `WellbeingStepForm.jsx` ja selle kõrval olev CSS-moodul.
 */

import { workProcessesForm } from "./forms/workProcessesForm";
import WellbeingStepForm from "./WellbeingStepForm";

export default function WorkProcessesWorkflow({ onNavigate }) {
  return <WellbeingStepForm definition={workProcessesForm} onNavigate={onNavigate} />;
}
