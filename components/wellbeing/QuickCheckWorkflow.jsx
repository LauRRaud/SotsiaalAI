"use client";

/**
 * Kiirkontroll: viis sammu ühisel sammuvormil.
 *
 * Kirjeldus (sammud, küsimused, signaalid): `forms/quickCheckForm.js`.
 * Kuju ja kujundus: `WellbeingStepForm.jsx` ja selle kõrval olev CSS-moodul.
 */

import { quickCheckForm } from "./forms/quickCheckForm";
import WellbeingStepForm from "./WellbeingStepForm";

export default function QuickCheckWorkflow({ onNavigate }) {
  return <WellbeingStepForm definition={quickCheckForm} onNavigate={onNavigate} />;
}
