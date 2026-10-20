"use client";

/**
 * Nädala peegeldus: sammud ühisel sammuvormil.
 *
 * Kirjeldus (sammud, küsimused, signaalid, valmis tekst): `forms/weeklyReflectionForm.js`.
 * Kuju ja kujundus: `WellbeingStepForm.jsx` ja selle kõrval olev CSS-moodul.
 */

import { weeklyReflectionForm } from "./forms/weeklyReflectionForm";
import WellbeingStepForm from "./WellbeingStepForm";

export default function WeeklyReflectionWorkflow({ onNavigate }) {
  return <WellbeingStepForm definition={weeklyReflectionForm} onNavigate={onNavigate} />;
}
