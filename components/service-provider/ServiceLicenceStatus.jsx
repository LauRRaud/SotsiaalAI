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
import { formatLicenceRetryAfter, formatLicenceVerifiedDate } from "@/lib/mtr/licenceCooldown";

function readText(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function readTextWithVars(t, key, vars, fallback = "") {
  return typeof t === "function" ? t(key, vars, fallback) : fallback;
}

const ENDPOINT = "/api/service-provider/profile/licence-check";
const BINDING_ENDPOINT = "/api/service-provider/profile/licence-binding";

/** Loaseisude laadimine, teenuse liigi kinnitamine, käsitsi kontroll ja jahtumisaeg ühes kohas. */
export function useServiceLicenceStatuses({ t, locale = "et" }) {
  const [statuses, setStatuses] = useState(() => new Map());
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  /* Teenuse liik: mida saab valida, mis on kinnitatud ja mis on valitud, aga veel kinnitamata. */
  const [kinds, setKinds] = useState([]);
  const [bindings, setBindings] = useState(() => new Map());
  const [hasRegistryCode, setHasRegistryCode] = useState(true);
  const [choices, setChoices] = useState(() => new Map());
  const [editingIds, setEditingIds] = useState(() => new Set());
  const [confirmingId, setConfirmingId] = useState("");

  const applyRows = useCallback((payload) => {
    const rows = Array.isArray(payload?.services) ? payload.services : [];
    setStatuses(new Map(rows.map((row) => [row.serviceId, row])));
  }, []);

  const applyBindings = useCallback((payload) => {
    setKinds(Array.isArray(payload?.kinds) ? payload.kinds : []);
    const rows = Array.isArray(payload?.bindings) ? payload.bindings : [];
    setBindings(new Map(rows.map((row) => [row.serviceId, row])));
    setHasRegistryCode(payload?.hasRegistryCode !== false);
  }, []);

  const load = useCallback(async () => {
    try {
      const [response, bindingResponse] = await Promise.all([
        fetch(ENDPOINT, { cache: "no-store" }),
        fetch(BINDING_ENDPOINT, { cache: "no-store" })
      ]);
      /* 404 = profiili veel ei ole; see ei ole tõrge, mida osutajale näidata. */
      if ([response, bindingResponse].some((entry) => !entry.ok && entry.status !== 404)) {
        setNotice(readText(t, "service_provider_profile.licence.internal.load_failed", "Tegevusloa seise ei saanud laadida."));
      }
      if (response.ok) applyRows(await response.json().catch(() => ({})));
      if (bindingResponse.ok) applyBindings(await bindingResponse.json().catch(() => ({})));
    } catch {
      setNotice(readText(t, "service_provider_profile.licence.internal.load_failed", "Tegevusloa seise ei saanud laadida."));
    }
  }, [applyBindings, applyRows, t]);

  const choose = useCallback((serviceId, serviceKey) => {
    setChoices((current) => new Map(current).set(serviceId, serviceKey || ""));
  }, []);

  const forget = useCallback((serviceId) => {
    setChoices((current) => {
      const next = new Map(current);
      next.delete(serviceId);
      return next;
    });
    setEditingIds((current) => {
      const next = new Set(current);
      next.delete(serviceId);
      return next;
    });
  }, []);

  /* Kinnitatud liigiga teenusel on valik peidus, kuni inimene tahab seda muuta. */
  const editKind = useCallback(
    (serviceId, on) => {
      if (!on) return forget(serviceId);
      /* Eelmise kontrolli teade (nt jahtumisaeg) käib seisu, mitte liigi valiku kohta. */
      setNotice("");
      setEditingIds((current) => new Set(current).add(serviceId));
    },
    [forget]
  );

  /* Kinnitamine seob liigi ja käivitab kohe esimese kontrolli. Kontroll ootab
     registri taga (umbes pool minutit), seepärast on nupul oma ooteseis. */
  const confirm = useCallback(
    async (serviceId) => {
      if (confirmingId || !serviceId) return;
      const chosen = choices.get(serviceId);
      if (chosen === undefined) return;
      setConfirmingId(serviceId);
      setNotice("");
      const failed = readText(t, "service_provider_profile.licence.internal.bind_failed", "Teenuse liiki ei saanud kinnitada.");
      try {
        const response = await fetch(BINDING_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerServiceId: serviceId, serviceKey: chosen || null })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          /* Server ütleb piirangu ja keeldumise oma lausega; muu tõrge saab üldise. */
          setNotice(payload?.message && payload.message !== payload.messageKey ? payload.message : failed);
          return;
        }
        applyRows(payload);
        applyBindings(payload);
        forget(serviceId);
        if (payload.checkError) {
          setNotice(
            readText(
              t,
              "service_provider_profile.licence.internal.bind_check_pending",
              "Liik on kinnitatud, aga kontrolli ei saanud kohe teha. Vajuta „Kontrolli uuesti”."
            )
          );
        }
      } catch {
        setNotice(failed);
      } finally {
        setConfirmingId("");
      }
    },
    [applyBindings, applyRows, choices, confirmingId, forget, t]
  );

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
            time: formatLicenceRetryAfter(payload?.retryAfter, locale)
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
  }, [applyRows, checking, locale, t]);

  /* Profiili salvestamine võib hinnangu kustutada (registrikood, asutuse nimi
     või teenuse sisu muutus). Vana märgis ei tohi ekraanile jääda. */
  const reset = useCallback(() => setStatuses(new Map()), []);

  /** Ühe teenuse liigi valiku seis vaate jaoks. */
  const kindState = useCallback(
    (serviceId) => {
      const binding = serviceId ? bindings.get(serviceId) || null : null;
      const saved = binding?.serviceKey || "";
      const chosen = serviceId && choices.has(serviceId) ? choices.get(serviceId) : binding?.currentSelectable === false ? "" : saved;
      return {
        known: Boolean(binding),
        saved,
        chosen,
        editing: !saved || editingIds.has(serviceId),
        currentLabel: binding?.currentLabel || "",
        /* Admini seotud liik, mida osutaja ise valida ei saa (nt teenus, mis luba ei vaja). */
        otherLabel: binding && binding.currentSelectable === false ? binding.currentLabel || "" : "",
        suggestions: binding?.suggestions || [],
        changed: Boolean(serviceId) && choices.has(serviceId) && choices.get(serviceId) !== saved,
        confirming: Boolean(serviceId) && confirmingId === serviceId
      };
    },
    [bindings, choices, confirmingId, editingIds]
  );

  return {
    statuses,
    checking,
    notice,
    load,
    recheck,
    reset,
    kinds,
    hasRegistryCode,
    kindState,
    choose,
    editKind,
    confirm,
    confirmingAny: Boolean(confirmingId)
  };
}

export default function ServiceLicenceStatus({ t, locale = "et", row }) {
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
              date: formatLicenceVerifiedDate(badge.params?.date || row.verifiedAt, locale),
              activity: badge.params?.activity || ""
            })}
      </p>
      {!publicHidden && badge.caveatKey ? (
        <p className="service-profile-licence__caveat">{readText(t, badge.caveatKey, "")}</p>
      ) : null}
    </div>
  );
}
