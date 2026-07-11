"use client";

import { useEffect, useRef, useState } from "react";

/* Loendur jookseb 0 → value (mänguline "juhtimiskeskuse" tunne).
   prefers-reduced-motion korral hüppab kohe lõppväärtusele. */
function useCountUp(target) {
  const numericTarget = Number(target);
  const isNumber = Number.isFinite(numericTarget);
  const [shown, setShown] = useState(isNumber ? 0 : target);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!isNumber) {
      setShown(target);
      return undefined;
    }
    if (
      typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      setShown(numericTarget);
      return undefined;
    }
    const duration = 600;
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(numericTarget * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isNumber, numericTarget, target]);

  return shown;
}

function StatCard({ card }) {
  const shown = useCountUp(card.value);
  const total = Number(card.total);
  const value = Number(card.value);
  const hasBar = Number.isFinite(total) && total > 0 && Number.isFinite(value);
  const share = hasBar ? Math.max(0, Math.min(1, value / total)) : 0;

  return (
    <div className="ra-stat" data-tone={card.tone || "neutral"}>
      <span className="ra-stat-label">{card.label}</span>
      <span className="ra-stat-value">{shown}</span>
      {hasBar ? (
        <span className="ra-stat-bar" role="presentation">
          <span className="ra-stat-bar-fill" style={{ width: `${Math.round(share * 100)}%` }} />
        </span>
      ) : null}
      {card.hint ? <span className="ra-stat-hint">{card.hint}</span> : null}
    </div>
  );
}

/* KOV ülevaate statistika — üks väärtus kaardi kohta (varem renderdus
   card.value KAKS korda järjest → "78" paistis "7878"). tone värvib
   vasaku helendava serva ja progressiriba (ra-stat[data-tone]). */
export default function KovSummaryCards({ cards = [] }) {
  if (!cards.length) return null;

  return (
    <div className="ra-stats">
      {cards.map(card => (
        <StatCard key={card.key} card={card} />
      ))}
    </div>
  );
}
