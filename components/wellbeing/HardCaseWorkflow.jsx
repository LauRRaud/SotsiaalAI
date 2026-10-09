"use client";

/**
 * Raske juhtum: sammud ühisel sammuvormil.
 *
 * Kirjeldus (sammud, küsimused, signaalid, valmis tekstid): `forms/hardCaseForm.js`.
 * Kuju ja kujundus: `WellbeingStepForm.jsx` ja selle kõrval olev CSS-moodul.
 */

import { hardCaseForm } from "./forms/hardCaseForm";
import WellbeingStepForm from "./WellbeingStepForm";

export default function HardCaseWorkflow({ onNavigate }) {
  return <WellbeingStepForm definition={hardCaseForm} onNavigate={onNavigate} />;
}
