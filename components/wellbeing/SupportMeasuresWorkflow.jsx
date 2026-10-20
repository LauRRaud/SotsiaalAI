"use client";

/**
 * Minu tugivõimalused: sammud ühisel sammuvormil.
 *
 * Kirjeldus (sammud, valikud, signaalid, valmis tekstid): `forms/supportMeasuresForm.js`.
 * Kuju ja kujundus: `WellbeingStepForm.jsx` ja selle kõrval olev CSS-moodul.
 *
 * Kui töötaja asutus on oma tugimeetmed kirjeldanud (`/org/<id>/tugi`), on
 * „mis on olemas" eeltäidetud. Vorm joonistatakse alles pärast seda päringut:
 * hilinev eeltäide ei tohi kirjutada üle seda, mida inimene juba märkis.
 * Päringu tõrge ei peata tööriista — siis on vorm ilma eeltäiteta.
 */

import { useEffect, useMemo, useState } from "react";

import { supportMeasuresForm, supportMeasuresFormWithOrganizations } from "./forms/supportMeasuresForm";
import WellbeingStepForm from "./WellbeingStepForm";

export default function SupportMeasuresWorkflow({ onNavigate }) {
  const [organizations, setOrganizations] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/wellbeing/support-measures/organization", { headers: { Accept: "application/json" }, signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setOrganizations(Array.isArray(payload?.organizations) ? payload.organizations : []))
      .catch((error) => {
        if (error?.name !== "AbortError") setOrganizations([]);
      });
    return () => controller.abort();
  }, []);

  const definition = useMemo(
    () => (organizations ? supportMeasuresFormWithOrganizations(organizations) : supportMeasuresForm),
    [organizations]
  );

  if (!organizations) return null;
  return <WellbeingStepForm definition={definition} onNavigate={onNavigate} />;
}
