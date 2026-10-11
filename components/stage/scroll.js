/**
 * Kerimise reeglid sammulaval.
 *
 * Rull ja libistus teenivad kõigepealt sisu: kuni mõni kerivkast sihtmärgi ja
 * dokumendi vahel saab selles suunas kerida, kerib see. Alles siis vahetub
 * samm (`StepFlight`) või vaate sees olev küsimus (nt eelpöördumise
 * eluvaldkonnad).
 */

/** Kas mõni kerivkast sihtmärgi ja dokumendi vahel saab selles suunas veel kerida? */
export function ancestorCanScroll(start, delta) {
  let node = start instanceof Element ? start : null;
  while (node && node !== document.documentElement) {
    if (node.scrollHeight > node.clientHeight + 1) {
      const overflowY = window.getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        if (delta < 0 && node.scrollTop > 0) return true;
        if (delta > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

/** Kas sihtmärk on tekstiväli? Seal ei tohi nooled ega libistus sammu vahetada. */
export function isTypingTarget(target) {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}
