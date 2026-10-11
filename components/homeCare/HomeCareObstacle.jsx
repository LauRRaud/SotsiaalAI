"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * „Mul on takistus" (K3-e): hooldaja teatab hooldusjuhile, et tänane päev ei lähe plaani
 * järgi. Viis valikut, vaba teksti ei ole: põhjust lähemalt kirjutama ei pea. Teade ise
 * käike ei muuda; hooldusjuht näeb seda oma päevaplaanis koos tegemata käikudega.
 *
 * Kaks sammu (valik ja saatmine), et juhuslik puudutus teadet ei saadaks.
 *
 * Siin on olek ja päringud; vaated on failis ./day/DayViews.jsx (teate rida ja
 * nupud vaate „Täna" all servas, valik omaette vaates).
 */
export function useHomeCareObstacle({ organizationId, initial = null }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [obstacle, setObstacle] = useState(initial);
  const [kind, setKind] = useState("");

  /* Valik algab alati tühjalt: eelmise korra valik ega tõrge ei jää ette. */
  const start = () => {
    setKind("");
    setError("");
  };

  /* Tagastab, kas teade läks teele: vaade sulgub ainult õnnestumise korral. */
  const report = async () => {
    if (!kind) return false;
    const result = await call(`${homeCareBase(organizationId)}/takistus`, {
      method: "POST",
      body: { kind },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setObstacle(result.data.obstacle || null);
    return true;
  };

  const withdraw = async () => {
    const result = await call(`${homeCareBase(organizationId)}/takistus/${encodeURIComponent(obstacle.id)}`, {
      method: "DELETE",
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setObstacle(result.data.obstacle || null);
  };

  return { obstacle, kind, setKind, busy, error, start, report, withdraw };
}
