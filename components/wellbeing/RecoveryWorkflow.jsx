"use client";

/**
 * Taastumine (24-72h taastumisplaan): sammud ühisel sammuvormil.
 *
 * Kirjeldus (sammud, küsimused, signaalid, valmis tekstid): `forms/recoveryForm.js`.
 * Kuju ja kujundus: `WellbeingStepForm.jsx` ja selle kõrval olev CSS-moodul.
 */

import { recoveryForm } from "./forms/recoveryForm";
import WellbeingStepForm from "./WellbeingStepForm";

export default function RecoveryWorkflow({ onNavigate }) {
  return <WellbeingStepForm definition={recoveryForm} onNavigate={onNavigate} />;
}
