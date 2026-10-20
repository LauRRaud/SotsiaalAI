"use client";

/**
 * Minu tugivõimalused: sammud ühisel sammuvormil.
 *
 * Kirjeldus (sammud, valikud, signaalid, valmis tekstid): `forms/supportMeasuresForm.js`.
 * Kuju ja kujundus: `WellbeingStepForm.jsx` ja selle kõrval olev CSS-moodul.
 */

import { supportMeasuresForm } from "./forms/supportMeasuresForm";
import WellbeingStepForm from "./WellbeingStepForm";

export default function SupportMeasuresWorkflow({ onNavigate }) {
  return <WellbeingStepForm definition={supportMeasuresForm} onNavigate={onNavigate} />;
}
