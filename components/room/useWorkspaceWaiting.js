"use client";

import { useEffect, useState } from "react";

/**
 * Mis Töölaual täna ootab: arvud tööriistade kaupa.
 *
 * Allikas on olemasolev päring /api/workspace/continuity (sama, millest
 * tööpaneel loeb „Jätka siit" rea). Server arvestab vaate rolli ise (halduri
 * S/P/T lüliti), seepärast küsitakse rolli vahetudes uuesti.
 *
 * Tõrke korral märke lihtsalt ei ole: toas seisavad siis kõik tööriistad
 * väikeste märkidena ja leht töötab edasi. Viimane vastus jääb rolli kaupa
 * meelde, et tuppa tagasi tulles ei vilguks suured kaardid väikesteks ja
 * tagasi.
 */
const lastByRole = new Map();

export default function useWorkspaceWaiting(enabled, role) {
  const roleKey = String(role || "");
  const [badges, setBadges] = useState(() => lastByRole.get(roleKey) || null);

  useEffect(() => {
    if (!enabled) return undefined;
    setBadges(lastByRole.get(roleKey) || null);
    const controller = new AbortController();
    fetch("/api/workspace/continuity", {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" }
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!payload || payload.ok !== true || typeof payload.badges !== "object") return;
        lastByRole.set(roleKey, payload.badges);
        setBadges(payload.badges);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [enabled, roleKey]);

  return badges;
}
