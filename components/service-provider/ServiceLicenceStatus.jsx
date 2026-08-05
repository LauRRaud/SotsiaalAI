"use client";

/* A4 — teenuse tegevusloa seis osutaja enda vaates.

   Eraldi failis, sest `WorkspaceFeaturePage.jsx` on üle 5000 rea ja see plokk
   peab jääma eraldi testitavaks ja muudetavaks.

   KOLM REEGLIT, mis siin jõustuvad:

   1. Vaade EI TÕLGENDA seisu. Nii tekst kui toon tulevad serverist
      (`lib/mtr/statusText.js`) — siin ei ole ühtki `if (status === ...)`.
   2. Kuupäev tuleb MÄRGISELT, mitte viimaselt katselt. Kui märgis püsib
      vanema tõendi najal, on „kontrollitud" kuupäev selle tõendi oma.
   3. Tõrge ei kustuta seise. Ebaõnnestunud kontroll jätab varasema pildi
      alles ja ütleb seda — tühi ekraan oleks vale info.
*/

import { useCallback, useState } from "react";

function readText(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function readTextWithVars(t, key, vars, fallback = "") {
  return typeof t === "function" ? t(key, vars, fallback) : fallback;
}

export function formatLicenceDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("et-EE", { dateStyle: "long", timeZone: "Europe/Tallinn" }).format(date);
}

const ENDPOINT = "/api/service-provider/profile/licence-check";

/** Loaseisude laadimine, käsitsi kontroll ja jahtumisaeg ühes kohas. */
export function useServiceLicenceStatuses({ t }) {
  const [statuses, setStatuses] = useState(() => new Map());
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");

  const applyRows = useCallback((payload) => {
    const rows = Array.isArray(payload?.services) ? payload.services : [];
    setStatuses(new Map(rows.map((row) => [row.serviceId, row])));
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch(ENDPOINT, { cache: "no-store" });
      if (!response.ok) {
        /* 404 = profiili veel ei ole; see ei ole tõrge, mida osutajale näidata. */
        if (response.status !== 404) {
          setNotice(readText(t, "service_provider_profile.licence.internal.load_failed", "Tegevusloa seise ei saanud laadida."));
        }
        return;
      }
      applyRows(await response.json().catch(() => ({})));
    } catch {
      setNotice(readText(t, "service_provider_profile.licence.internal.load_failed", "Tegevusloa seise ei saanud laadida."));
    }
  }, [applyRows, t]);

  const recheck = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setNotice("");
    try {
      const response = await fetch(ENDPOINT, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 429) {
        setNotice(
          readTextWithVars(t, "service_provider_profile.licence.internal.cooldown", {
            time: formatLicenceDate(payload?.retryAfter)
          })
        );
        return;
      }
      /* 3. reegel: iga muu tõrge JÄTAB senised seisud alles. Varem asendas
         tühi vastus need tühja kaardiga ja osutaja nägi valet pilti. */
      if (!response.ok) {
        setNotice(
          readText(
            t,
            "service_provider_profile.licence.internal.check_failed",
            "Tegevusloa kontrolli ei saanud teha. Varasemad seisud jäid alles."
          )
        );
        return;
      }
      applyRows(payload);
    } catch {
      setNotice(
        readText(
          t,
          "service_provider_profile.licence.internal.check_failed",
          "Tegevusloa kontrolli ei saanud teha. Varasemad seisud jäid alles."
        )
      );
    } finally {
      setChecking(false);
    }
  }, [applyRows, checking, t]);

  /* Profiili salvestamine teeb teenustele delete + create, seega hinnangud
     kaovad kaskaadis. Vana märgis ei tohi ekraanile jääda. */
  const reset = useCallback(() => setStatuses(new Map()), []);

  return { statuses, checking, notice, load, recheck, reset };
}

export default function ServiceLicenceStatus({ t, row }) {
  if (!row) return null;
  const badge = row.badge || null;
  const internal = row.internal || null;
  const publicHidden = !badge || badge.visibility === "INTERNAL_ONLY" || !badge.key;

  return (
    <div
      className="service-profile-licence"
      /* Seis JA toon tulevad märgiselt: aegunud „kontrollitud" ei tohi CSS-is
         positiivsena kujuneda ainult salvestatud staatuse põhjal. */
      data-status={badge?.status || row.publicStatus || "UNKNOWN"}
      data-tone={badge?.tone || "NEUTRAL"}
    >
      <p className="service-profile-licence__heading">
        {readText(t, "service_provider_profile.licence.internal.heading", "Tegevusloa kontroll")}
      </p>
      {internal?.key ? <p className="service-profile-licence__state">{readText(t, internal.key, "")}</p> : null}
      {internal?.reasonKey ? <p className="service-profile-licence__reason">{readText(t, internal.reasonKey, "")}</p> : null}
      {row.registryCodeUsed ? (
        <p className="service-profile-licence__meta">
          {readTextWithVars(t, "service_provider_profile.licence.internal.checked_with", {
            registryCode: row.registryCodeUsed
          })}
        </p>
      ) : null}
      {internal?.actionKey ? <p className="service-profile-licence__action">{readText(t, internal.actionKey, "")}</p> : null}
      <p className="service-profile-licence__public">
        {publicHidden
          ? readText(
              t,
              "service_provider_profile.licence.internal.mapping_required",
              "Teenuse liik pole veel tegevusloa kontrolliga seotud"
            )
          : readTextWithVars(t, badge.key, {
              /* 2. reegel: kuupäev MÄRGISELT, mitte viimaselt katselt. */
              date: formatLicenceDate(badge.params?.date || row.verifiedAt),
              activity: badge.params?.activity || ""
            })}
      </p>
      {!publicHidden && badge.caveatKey ? (
        <p className="service-profile-licence__caveat">{readText(t, badge.caveatKey, "")}</p>
      ) : null}
    </div>
  );
}
