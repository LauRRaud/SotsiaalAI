const LINE_SCROLL_STEP = 56;
const PAGE_SCROLL_RATIO = 0.88;

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest("a, button, input, textarea, select, summary, [role='button'], [contenteditable='true']"));
}

export function handlePolicyScrollKeyDown(event) {
  const node = event.currentTarget;
  if (!(node instanceof HTMLElement) || node.scrollHeight <= node.clientHeight) return;

  const pageStep = Math.max(LINE_SCROLL_STEP * 3, Math.round(node.clientHeight * PAGE_SCROLL_RATIO));

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      node.scrollBy({ top: LINE_SCROLL_STEP });
      break;
    case "ArrowUp":
      event.preventDefault();
      node.scrollBy({ top: -LINE_SCROLL_STEP });
      break;
    case "PageDown":
      event.preventDefault();
      node.scrollBy({ top: pageStep });
      break;
    case "PageUp":
      event.preventDefault();
      node.scrollBy({ top: -pageStep });
      break;
    case "Home":
      event.preventDefault();
      node.scrollTo({ top: 0 });
      break;
    case "End":
      event.preventDefault();
      node.scrollTo({ top: node.scrollHeight });
      break;
    case " ":
      event.preventDefault();
      node.scrollBy({ top: event.shiftKey ? -pageStep : pageStep });
      break;
    default:
      break;
  }
}

export function focusPolicyScrollArea(event) {
  if (isInteractiveTarget(event.target)) return;
  const node = event.currentTarget;
  if (node instanceof HTMLElement) {
    node.focus({ preventScroll: true });
  }
}
