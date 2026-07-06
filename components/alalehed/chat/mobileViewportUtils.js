function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toNonNegativePixel(value) {
  return Math.max(0, Math.round(toFiniteNumber(value, 0)));
}

const MOBILE_KEYBOARD_ACTIVE_THRESHOLD = 56;

function resolveViewportExtent({
  currentViewportExtent,
  visualViewportHeight,
  visualViewportOffsetTop,
  layoutViewportHeight
}) {
  const explicitExtent = toNonNegativePixel(currentViewportExtent);
  if (explicitExtent > 0) return explicitExtent;

  const visualHeight = toFiniteNumber(visualViewportHeight, 0);
  if (visualHeight > 0) {
    return toNonNegativePixel(visualHeight + toFiniteNumber(visualViewportOffsetTop, 0));
  }

  return toNonNegativePixel(layoutViewportHeight);
}

function resolveMaxKeyboardOffset({ baselineViewportExtent, layoutViewportHeight }) {
  const viewport = Math.max(
    toNonNegativePixel(baselineViewportExtent),
    toNonNegativePixel(layoutViewportHeight)
  );
  return Math.round(viewport * 0.55);
}

function resolveFallbackKeyboardOffset({
  baselineViewportExtent,
  baselineContainerHeight,
  currentViewportExtent,
  currentContainerHeight,
  layoutViewportHeight
}) {
  const rawOffset = Math.max(
    toNonNegativePixel(toFiniteNumber(layoutViewportHeight, 0) - currentViewportExtent),
    toNonNegativePixel(toFiniteNumber(baselineViewportExtent, 0) - currentViewportExtent)
  );
  const layoutHandledOffset =
    toFiniteNumber(baselineContainerHeight, 0) > 0 &&
    toFiniteNumber(currentContainerHeight, 0) > 0 &&
    toNonNegativePixel(currentContainerHeight) <= currentViewportExtent + 8
      ? toNonNegativePixel(toFiniteNumber(baselineContainerHeight, 0) - toFiniteNumber(currentContainerHeight, 0))
      : 0;

  return Math.max(0, rawOffset - layoutHandledOffset);
}

export function resolveMobileChatKeyboardOffset(metrics = {}) {
  const currentViewportExtent = resolveViewportExtent(metrics);
  const maxReasonable = resolveMaxKeyboardOffset(metrics);
  if (currentViewportExtent <= 0 || maxReasonable <= 0) return 0;

  const containerBottom = toFiniteNumber(metrics.currentContainerBottom, Number.NaN);
  const viewportOverlapOffset = Number.isFinite(containerBottom)
    ? toNonNegativePixel(containerBottom - currentViewportExtent)
    : Number.NaN;

  const offset = Number.isFinite(viewportOverlapOffset)
    ? viewportOverlapOffset
    : resolveFallbackKeyboardOffset({
        ...metrics,
        currentViewportExtent
      });

  return Math.min(offset, maxReasonable);
}

export function resolveMobileChatKeyboardVisibilityOffset(metrics = {}) {
  const visualHeight = toNonNegativePixel(metrics.visualViewportHeight);
  if (visualHeight <= 0) return 0;

  const layoutViewportHeight = Math.max(
    toNonNegativePixel(metrics.baselineViewportExtent),
    toNonNegativePixel(metrics.layoutViewportHeight),
    toNonNegativePixel(metrics.windowInnerHeight)
  );
  const maxReasonable = resolveMaxKeyboardOffset({
    baselineViewportExtent: layoutViewportHeight,
    layoutViewportHeight
  });
  if (layoutViewportHeight <= 0 || maxReasonable <= 0) return 0;

  return Math.min(
    toNonNegativePixel(layoutViewportHeight - visualHeight),
    maxReasonable
  );
}

export function resolveStableMobileAppHeight(metrics = {}) {
  const visualExtent = resolveViewportExtent({
    visualViewportHeight: metrics.visualViewportHeight,
    visualViewportOffsetTop: metrics.visualViewportOffsetTop,
    layoutViewportHeight: 0
  });
  const measuredLayoutHeight = Math.max(
    toNonNegativePixel(metrics.windowInnerHeight),
    toNonNegativePixel(metrics.documentElementClientHeight),
    visualExtent
  );
  const previousStableLayoutHeight = toNonNegativePixel(
    metrics.previousStableLayoutHeight
  );
  const rawKeyboardOffset = toNonNegativePixel(metrics.rawKeyboardOffset);
  const stabilizeForKeyboard = metrics.stabilizeForKeyboard === true;
  const keyboardActive =
    stabilizeForKeyboard &&
    Boolean(metrics.isEditable) &&
    rawKeyboardOffset > MOBILE_KEYBOARD_ACTIVE_THRESHOLD;

  if (!keyboardActive) return measuredLayoutHeight;
  return Math.max(measuredLayoutHeight, previousStableLayoutHeight);
}
