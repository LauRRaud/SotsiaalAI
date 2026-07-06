"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const LINE_SCROLL_STEP = 34;
const PAGE_SCROLL_RATIO = 0.72;

function getScrollBottomDistance(node) {
  return Math.max(0, node.scrollHeight - node.clientHeight - node.scrollTop);
}

function isInteractiveTarget(target) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "a, button, input, textarea, select, summary, [role='button'], [contenteditable='true']"
      )
    )
  );
}

const ConversationView = memo(function ConversationView({
  t,
  chatWindowRef,
  isStreamingAny,
  hiddenCount,
  pageSize,
  onRevealOlder,
  canHideOlder,
  onHideOlder,
  onJumpToBottom,
  messageItems,
  windowClassName: windowClassNameProp,
  mainClassName: mainClassNameProp,
  onWindowDoubleClick,
  focusActive = false,
  isMobile = false,
  isLightTheme: _isLightTheme = false,
  hasConversationSources: _hasConversationSources = false,
  conversationSourcesCount: _conversationSourcesCount = 0,
  toggleSourcesPanel: _toggleSourcesPanel,
  showSourcesPanel: _showSourcesPanel = false,
  sourcesPulse: _sourcesPulse = false,
  sourcesButtonRef: _sourcesButtonRef
}) {
  const [showScrollDown, setShowScrollDown] = useState(false);
  const isUserAtBottom = useRef(true);
  const shouldAnchorBottomRef = useRef(true);
  const mountedRef = useRef(false);
  const contentEndRef = useRef(null);
  const revealOlderLockRef = useRef(false);
  const hiddenCountRef = useRef(hiddenCount);
  const onRevealOlderRef = useRef(onRevealOlder);
  const scrollToBottom = useCallback(() => {
    const node = chatWindowRef?.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    isUserAtBottom.current = true;
    shouldAnchorBottomRef.current = true;
  }, [chatWindowRef]);
  useEffect(() => {
    hiddenCountRef.current = hiddenCount;
    revealOlderLockRef.current = false;
  }, [hiddenCount]);
  useEffect(() => {
    onRevealOlderRef.current = onRevealOlder;
  }, [onRevealOlder]);
  const updateScrollState = useCallback(() => {
    const node = chatWindowRef?.current;
    if (!node) {
      isUserAtBottom.current = true;
      shouldAnchorBottomRef.current = true;
      setShowScrollDown(false);
      return;
    }
    const maxScrollable = Math.max(0, node.scrollHeight - node.clientHeight);
    const hasOverflow = maxScrollable > 8;
    let hasHiddenContentBelow = hasOverflow;
    const contentEndNode = contentEndRef.current;
    if (contentEndNode) {
      const viewportBottom = node.getBoundingClientRect().bottom;
      const contentBottom = contentEndNode.getBoundingClientRect().bottom;
      hasHiddenContentBelow = contentBottom - viewportBottom > 12;
    }
    const atBottom = !hasOverflow || !hasHiddenContentBelow;
    const nearScrollBottom = getScrollBottomDistance(node) <= Math.max(72, node.clientHeight * 0.12);
    isUserAtBottom.current = atBottom;
    shouldAnchorBottomRef.current = atBottom || nearScrollBottom;
    setShowScrollDown(hasOverflow && hasHiddenContentBelow);

    const nearTopThreshold = Math.max(48, node.clientHeight * 0.08);
    if (
      hiddenCountRef.current > 0 &&
      node.scrollTop <= nearTopThreshold &&
      !revealOlderLockRef.current
    ) {
      revealOlderLockRef.current = true;
      onRevealOlderRef.current?.();
    }
  }, [chatWindowRef]);
  useEffect(() => {
    const node = chatWindowRef?.current;
    if (!node) return;
    function handleScroll() {
      updateScrollState();
    }
    node.addEventListener("scroll", handleScroll, {
      passive: true
    });
    const frame = window.requestAnimationFrame(updateScrollState);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateScrollState();
          })
        : null;
    resizeObserver?.observe(node);
    if (contentEndRef.current) {
      resizeObserver?.observe(contentEndRef.current);
    }
    window.addEventListener("resize", updateScrollState);
    return () => {
      node.removeEventListener("scroll", handleScroll);
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [chatWindowRef, updateScrollState]);
  useEffect(() => {
    const node = chatWindowRef?.current;
    if (!node) return;

    const shouldStickToBottom = !mountedRef.current || isUserAtBottom.current;

    if (shouldStickToBottom) {
      const frame = window.requestAnimationFrame(() => {
        scrollToBottom();
        updateScrollState();
      });
      return () => window.cancelAnimationFrame(frame);
    }

    updateScrollState();
  }, [chatWindowRef, messageItems, hiddenCount, canHideOlder, scrollToBottom, updateScrollState]);
  useLayoutEffect(() => {
    const node = chatWindowRef?.current;
    if (!node) return;
    const shouldAnchorBottom =
      isUserAtBottom.current ||
      shouldAnchorBottomRef.current ||
      getScrollBottomDistance(node) <= Math.max(96, node.clientHeight * 0.16);
    if (!shouldAnchorBottom) return;

    let frame = 0;
    const deadline = performance.now() + 620;
    const keepAnchored = () => {
      scrollToBottom();
      updateScrollState();
      if (performance.now() < deadline) {
        frame = window.requestAnimationFrame(keepAnchored);
      }
    };

    frame = window.requestAnimationFrame(keepAnchored);
    return () => window.cancelAnimationFrame(frame);
  }, [chatWindowRef, focusActive, isMobile, scrollToBottom, updateScrollState]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const focusScrollArea = useCallback(event => {
    if (isInteractiveTarget(event.target)) return;
    const node = event.currentTarget;
    if (node instanceof HTMLElement && document.activeElement !== node) {
      node.focus({ preventScroll: true });
    }
  }, []);
  const handleScrollKeyDown = useCallback(event => {
    const node = event.currentTarget;
    if (!(node instanceof HTMLElement) || node.scrollHeight <= node.clientHeight) return;

    const pageStep = Math.max(
      LINE_SCROLL_STEP * 3,
      Math.round(node.clientHeight * PAGE_SCROLL_RATIO)
    );

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
  }, []);
  const mergedMainClassName = mainClassNameProp || undefined;
  const mergedWindowClassName = windowClassNameProp || undefined;
  return <main className={mergedMainClassName}>
      <div id="chat-window" className={mergedWindowClassName} onDoubleClick={onWindowDoubleClick}>
        <div id="chat-window-scroll" ref={chatWindowRef} role="region" aria-label={t("chat.aria.messages")} aria-live="polite" aria-busy={isStreamingAny ? "true" : "false"} tabIndex={0} onKeyDown={handleScrollKeyDown} onMouseDown={focusScrollArea} onWheel={focusScrollArea}>
          <div aria-hidden="true" />

          {hiddenCount > 0 ? <div>
              <button type="button" onClick={onRevealOlder}>
                {t("chat.show_older")} (+{Math.min(pageSize, hiddenCount)}){" "}
                {hiddenCount} {t("chat.left")}
              </button>
            </div> : null}

          {messageItems}

          {canHideOlder ? <div>
              <button type="button" onClick={onHideOlder}>
                {t("chat.show_recent")}
              </button>
            </div> : null}

          <div ref={contentEndRef} aria-hidden="true" />
          <div aria-hidden="true" />
        </div>
      </div>

      {showScrollDown ? <button onClick={onJumpToBottom} aria-label={t("chat.scroll_to_bottom")} title={t("chat.scroll_to_bottom_title")} aria-controls="chat-window-scroll">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9l8 8 8-8" />
          </svg>
        </button> : null}
    </main>;
});
export default ConversationView;
