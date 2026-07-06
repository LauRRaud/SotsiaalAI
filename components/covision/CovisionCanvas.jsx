"use client";

/**
 * CovisionCanvas — kovisiooni TÄISEKRAANI lõuend (tellija 06.07 öö):
 * juhtumilõuendi sektsioonid on vabalt LIIGUTATAVAD kaardid suurel
 * pinnal; kaartide asukohad püsivad localStorage's juhtumi kaupa;
 * ETAPIRIBA tõstab aktiivse etapi kaardid esile (teised vaibuvad).
 * Puhas esitluskiht — sisu/äriloogika tuleb CovisionPage'ist läbi
 * sections-massiivi.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_PREFIX = "sotsiaalai:covision-canvas:";

/* Kovisiooni klassikalised etapid → sektsioonide id-d */
export const COVISION_STAGES = [
  { key: "all", labelKey: "covision.canvas.stage_all", fallback: "Kõik", sections: null },
  { key: "case", labelKey: "covision.canvas.stage_case", fallback: "1 · Juhtumi esitlus", sections: ["s1", "s2", "s3", "s4", "s5"] },
  { key: "questions", labelKey: "covision.canvas.stage_questions", fallback: "2 · Küsimused", sections: ["s6"] },
  { key: "reflections", labelKey: "covision.canvas.stage_reflections", fallback: "3 · Peegeldused", sections: ["s7"] },
  { key: "suggestions", labelKey: "covision.canvas.stage_suggestions", fallback: "4 · Ettepanekud", sections: ["s8"] },
  { key: "closing", labelKey: "covision.canvas.stage_closing", fallback: "5 · Sammud ja kokkuvõte", sections: ["s9", "s10", "s11"] },
];

/* Vaikepaigutus: kolm veergu, loogiline lugemisjärjekord */
const DEFAULT_LAYOUT = {
  s1: { x: 24, y: 24 }, s2: { x: 24, y: 210 }, s3: { x: 24, y: 470 },
  s4: { x: 404, y: 24 }, s5: { x: 404, y: 290 },
  s6: { x: 784, y: 24 }, s7: { x: 784, y: 300 },
  s8: { x: 1164, y: 24 }, s9: { x: 1164, y: 300 },
  s10: { x: 404, y: 556 }, s11: { x: 784, y: 576 },
};

function loadLayout(caseId) {
  if (typeof window === "undefined" || !caseId) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + caseId);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function CovisionCanvas({ caseId, sections, stage = "all", t }) {
  const [layout, setLayout] = useState({});
  const [dragId, setDragId] = useState(null);
  const surfaceRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    setLayout(loadLayout(caseId));
  }, [caseId]);

  const persist = useCallback(
    (next) => {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + caseId, JSON.stringify(next));
      } catch {}
    },
    [caseId]
  );

  const activeStage = COVISION_STAGES.find((s) => s.key === stage) || COVISION_STAGES[0];
  const highlighted = useMemo(
    () => (activeStage.sections ? new Set(activeStage.sections) : null),
    [activeStage]
  );

  const positionOf = (id) => layout[id] || DEFAULT_LAYOUT[id] || { x: 24, y: 24 };

  const onPointerDown = useCallback((event, id) => {
    if (event.button != null && event.button !== 0) return;
    const card = event.currentTarget.closest("[data-canvas-card]");
    if (!card) return;
    event.preventDefault();
    const surface = surfaceRef.current;
    const rect = card.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    dragRef.current = {
      id,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      surfaceLeft: surfaceRect.left + (surface.scrollLeft || 0) * 0,
      surfaceTop: surfaceRect.top,
    };
    setDragId(id);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
  }, []);

  const onPointerMove = useCallback((event) => {
    const drag = dragRef.current;
    const surface = surfaceRef.current;
    if (!drag || !surface) return;
    const surfaceRect = surface.getBoundingClientRect();
    const x = Math.max(0, event.clientX - surfaceRect.left + surface.scrollLeft - drag.offsetX);
    const y = Math.max(0, event.clientY - surfaceRect.top + surface.scrollTop - drag.offsetY);
    setLayout((prev) => ({ ...prev, [drag.id]: { x: Math.round(x), y: Math.round(y) } }));
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragId(null);
    setLayout((prev) => {
      persist(prev);
      return prev;
    });
  }, [persist]);

  const resetLayout = useCallback(() => {
    setLayout({});
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + caseId);
    } catch {}
  }, [caseId]);

  return (
    <div className="covision-canvas" data-dragging={dragId ? "1" : "0"}>
      <div
        ref={surfaceRef}
        className="covision-canvas-surface"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="covision-canvas-plane">
          {sections.map((section) => {
            const pos = positionOf(section.id);
            const dimmed = highlighted ? !highlighted.has(section.id) : false;
            return (
              <article
                key={section.id}
                data-canvas-card
                data-dim={dimmed ? "1" : "0"}
                data-active-drag={dragId === section.id ? "1" : "0"}
                className="covision-card"
                style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
              >
                <header
                  className="covision-card-head"
                  onPointerDown={(event) => onPointerDown(event, section.id)}
                  title={t?.("covision.canvas.drag_hint", "Lohista kaarti") || "Lohista kaarti"}
                >
                  <span>{section.title}</span>
                </header>
                <div className="covision-card-body">{section.node}</div>
              </article>
            );
          })}
        </div>
      </div>
      <button type="button" data-variant="default" className="covision-canvas-reset" onClick={resetLayout}>
        {t?.("covision.canvas.reset_layout", "Taasta paigutus") || "Taasta paigutus"}
      </button>
    </div>
  );
}
