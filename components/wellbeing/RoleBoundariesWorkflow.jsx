"use client";

/**
 * Rollipiirid: sammud ühisel sammuvormil.
 *
 * Kirjeldus (sammud, küsimused, signaalid, valmis tekstid): `forms/roleBoundariesForm.js`.
 * Kuju ja kujundus: `WellbeingStepForm.jsx` ja selle kõrval olev CSS-moodul.
 */

import { roleBoundariesForm } from "./forms/roleBoundariesForm";
import WellbeingStepForm from "./WellbeingStepForm";

export default function RoleBoundariesWorkflow({ onNavigate }) {
  return <WellbeingStepForm definition={roleBoundariesForm} onNavigate={onNavigate} />;
}
