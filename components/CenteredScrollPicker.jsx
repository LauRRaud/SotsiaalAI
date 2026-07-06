"use client";

import { useCallback, useRef } from "react";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * CenteredScrollPicker (strip-faas).
 *
 * Vana implementatsioon oli kohandatud scroll-wheel picker (wheel/keyboard-nav,
 * settle, inert, portal, edge-visibility, positsioneerimine). See kõik oli ESITUS
 * ja on eemaldatud — uue visuaali teeb Fable 5.
 *
 * Alles on AINULT funktsionaalne liides, mida call-saidid tegelikult tarbivad:
 *   - scrollToIndex(index)  : hüppa vastava sammu juurde (nt valideerimisvea korral)
 *   - getItemClassName()    : sammu baasklass (ei kanna enam active/neighbor/hidden olekut)
 *   - canScrollUp/Down      : chevron-vihjed (esitus — nüüd alati false)
 *
 * Väärtuse valik (rollid, keel, kontrast, PIN jne) ei toimu SIIN — selle
 * renderdavad call-saidid ise natiivsete radio/checkbox/input elementidega.
 * See komponent liigutas ainult samme; valiku-loogika call-saitides EI muutu.
 *
 * Kõiki ülejäänud propse (neighborDistance, lockWheelToSteps, settleOnScroll,
 * wheelCooldownMs jne) ignoreeritakse teadlikult, et call-saidid ei katkeks.
 */
export default function CenteredScrollPicker({
  containerRef,
  itemSelector = null,
} = {}) {
  // Hoiab bindItemRef'iga seotud DOM-node'id (kui call-sait neid kasutab).
  const itemRefs = useRef([]);

  const bindItemRef = useCallback((index) => {
    return (node) => {
      itemRefs.current[index] = node || null;
    };
  }, []);

  const getItems = useCallback(() => {
    const boundItems = itemRefs.current.filter(Boolean);
    if (boundItems.length) return boundItems;
    const container = containerRef?.current;
    if (container && itemSelector) {
      return Array.from(container.querySelectorAll(itemSelector));
    }
    return [];
  }, [containerRef, itemSelector]);

  // Funktsionaalne: hüppa sammu juurde. Kasutab natiivset scrollIntoView'd
  // (nt RegistreerimineBody valideerimisvea korral jumpToStep).
  const scrollToIndex = useCallback(
    (idx) => {
      const items = getItems();
      if (!items.length) return;
      const target = items[clamp(idx, 0, items.length - 1)];
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "center", inline: "nearest" });
      }
    },
    [getItems],
  );

  // Baasklass ilma active/neighbor/hidden olekuta (olek oli esitus).
  const getItemClassName = useCallback(() => "csp-item", []);
  const getItemState = useCallback(() => "active", []);

  return {
    activeIndex: 0,
    canScrollUp: false,
    canScrollDown: false,
    scrollDirection: "idle",
    bindItemRef,
    getItemState,
    getItemClassName,
    scrollToIndex,
    recompute: () => {},
    lastSettledIndexRef: itemRefs,
  };
}
