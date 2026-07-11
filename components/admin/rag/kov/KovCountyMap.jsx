"use client";

import { useMemo } from "react";

import { kovItemNeedsAttention } from "./useKovAdminController";

/* Eesti skemaatiline plaat-kaart: 15 maakonda ligikaudu geograafilises
   asetuses (positsioonid rag-admin.css [data-county] reeglites; kitsal
   ekraanil voolab tavaliseks võrgustikuks). Plaat = filter: klikk piirab
   tabeli selle maakonnaga, teine klikk vabastab. Arvutus käib KÕIGI
   kirjete pealt (kaart on ülevaade, mitte filtri tulemus). */
export default function KovCountyMap({ items = [], county, onCountyChange, et = true }) {
  const tiles = useMemo(() => {
    const byCounty = new Map();
    for (const item of items) {
      const name = String(item.county || "").trim() || (et ? "Määramata" : "Unassigned");
      const current = byCounty.get(name) || { name, total: 0, ready: 0, attention: 0 };
      current.total += 1;
      const readiness = item?.combinedReadiness?.state;
      if (readiness === "BOTH_READY" || readiness === "BOTH_INGESTED") current.ready += 1;
      if (kovItemNeedsAttention(item)) current.attention += 1;
      byCounty.set(name, current);
    }
    return [...byCounty.values()].sort((a, b) => a.name.localeCompare(b.name, "et"));
  }, [et, items]);

  if (!tiles.length) return null;

  return (
    <div className="ra-card">
      <div className="ra-card-head">
        <div>
          <h2 className="ra-card-title">{et ? "Maakonnakaart" : "County map"}</h2>
          <p className="ra-card-sub">
            {et
              ? "Klikk maakonnal filtreerib tabeli; helendav täpp = maakonnas on tähelepanu vajavaid KOV-e."
              : "Click a county to filter the table; a glowing dot marks counties with municipalities needing attention."}
          </p>
        </div>
        <span className="ra-chip" data-tone="dim">
          {et ? `${items.length} KOV-i` : `${items.length} municipalities`}
        </span>
      </div>
      <div className="ra-map">
        {tiles.map(tile => {
          const slug = tile.name.toLowerCase();
          const isActive = county === tile.name;

          return (
            <button
              type="button"
              key={tile.name}
              className="ra-map-tile"
              data-county={slug}
              data-active={isActive ? "true" : undefined}
              data-attention={tile.attention > 0 ? "true" : undefined}
              aria-pressed={isActive}
              title={
                et
                  ? `${tile.name}: ${tile.ready}/${tile.total} valmis${tile.attention ? `, ${tile.attention} vajab tähelepanu` : ""}`
                  : `${tile.name}: ${tile.ready}/${tile.total} ready${tile.attention ? `, ${tile.attention} need attention` : ""}`
              }
              onClick={() => onCountyChange(isActive ? "ALL" : tile.name)}
            >
              <span className="ra-map-name">{tile.name.replace(/maa$/i, "")}</span>
              <span className="ra-map-count">
                {tile.ready}<small>/{tile.total}</small>
              </span>
              <span className="ra-stat-bar" role="presentation">
                <span
                  className="ra-stat-bar-fill"
                  style={{ width: `${tile.total ? Math.round((tile.ready / tile.total) * 100) : 0}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
