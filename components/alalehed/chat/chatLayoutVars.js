const CHAT_LAYOUT_BASE_VARS = Object.freeze({
  "--chat-diameter": "var(--profile-diameter)",
  "--chat-window-inline-gap": "clamp(1.8rem, calc(var(--chat-diameter) * 0.038), 3rem)",
  "--chat-window-max-w":
    "min(calc(clamp(28.75rem, calc(var(--chat-diameter) * 0.71), 41.5rem) - 0.55rem), calc(100% - var(--chat-window-inline-gap) - 0.55rem))",
  "--chat-window-shift-x": "calc(clamp(0.22rem, calc(var(--chat-diameter) * 0.008), 0.42rem) + 0.28rem)",
  "--chat-window-top-offset": "clamp(0.45rem, 1.1vh, 0.85rem)",
  "--chat-window-pad-top": "1.25rem",
  "--chat-window-pad-bottom": "calc(clamp(2.2rem, 4.5dvh, 3.4rem) + 2.35rem)",
  "--chat-window-top-safe": "5.35rem",
  "--chat-window-bottom-gap": "-4.6rem",
  "--chat-window-main-bottom-overlap": "clamp(-5.2rem, -9vh, -3.6rem)",
  "--chat-window-fade-top": "clamp(1.08rem, 2.65vh, 1.85rem)",
  "--chat-window-fade-bottom": "clamp(2.7rem, 6.5vh, 4.25rem)",
  "--chat-window-shift-y": "clamp(1.95rem, 4.15vh, 3.05rem)",
  "--chat-window-main-offset": "0rem",
  "--chat-scroll-down-offset": "-0.86rem",
  "--chat-content-top-offset": "5.2rem",
  "--chat-content-spacer": "7.4rem",
  "--chat-content-bottom-spacer": "0.35rem",
  "--chat-window-scroll-top-fade-start": "0.56rem",
  "--chat-window-scroll-top-fade-mid": "1.16rem",
  "--chat-window-scroll-top-fade-end": "2.05rem",
  "--chat-input-shift": "calc(clamp(2.45rem, 5.4dvh, 3.55rem) + 1.25rem)",
  "--chat-input-focus-shift": "0.85rem",
  "--chat-window-focus-shift": "0rem",
  "--chat-inputbar-left-pull": "-1.1rem",
  "--chat-attach-left-pull": "-1.15rem",
  "--chat-hpad-left": "var(--chat-hpad)",
  "--chat-hpad-right": "var(--chat-hpad)",
  "--chat-composer-side-control-size": "3.15rem",
  "--chat-composer-main-control-size": "3.34rem",
  "--chat-composer-send-control-size": "3rem",
  "--chat-composer-send-icon-size": "1.1rem",
  "--chat-composer-plus-icon-size": "2.32rem",
  "--chat-composer-listen-icon-size": "2.05rem",
  "--chat-composer-mic-icon-size": "2rem",
  "--chat-send-btn-scale": "0.965",
  "--chat-send-btn-shift-x": "0rem",
  "--chat-send-btn-shift-y": "0rem",
  "--chat-input-max-w":
    "min(clamp(calc(14.9 * var(--base-rem)), calc(var(--chat-window-max-w) * 0.54), calc(19 * var(--base-rem))), calc(var(--chat-window-max-w) - clamp(calc(4.9 * var(--base-rem)), calc(var(--chat-diameter) * 0.092), calc(6.2 * var(--base-rem)))))",
  "--chat-composer-bottom-gap": "clamp(1.9rem, 4.6vh, 3rem)",
  "--chat-ai-offset": "clamp(1.35rem, 3vw, 2.4rem)",
  "--chat-hpad": "clamp(2.2rem, calc(var(--chat-diameter) * 0.06), 3.4rem)",
  "--hud-edge": "clamp(1.05rem, 2.5vw, 1.55rem)",
  "--hud-icon": "clamp(3.08rem, calc(var(--chat-diameter) * 0.061), 3.32rem)",
  "--hud-edge-safe": "calc(var(--hud-edge) + env(safe-area-inset-top, 0px))",
  "--hud-edge-left": "env(safe-area-inset-left, 0px)",
  "--hud-edge-right": "env(safe-area-inset-right, 0px)",
  "--glass-edge-left": "clamp(0.1rem, 1.2vw, 0.8rem)",
  "--glass-edge-right": "clamp(0.1rem, 1.2vw, 0.8rem)",
  "--rail-inset": "0.2rem",
  "--chat-back-inset": "clamp(0.2rem, 1vw, 0.6rem)",
  "--chat-nav-top": "50%",
  "--chat-pad-top": "clamp(1.6rem, 4.2vw, 2.6rem)",
  "--chat-pad-bottom": "clamp(3.2rem, 7vh, 5rem)",
  "--chat-logo-height": "clamp(12rem, 32vw, 26rem)",
  "--chat-logo-y": "clamp(5.2rem, 23vh, 12.2rem)",
  "--chat-mobile-back-top": "var(--mobile-header-control-top, 0.2rem)",
  "--chat-mobile-back-size": "4.4rem",
  "--chat-mobile-show-size": "3.78rem",
  "--chat-mobile-show-icon-size": "3.46rem",
  "--chat-mobile-rail-size": "clamp(3.1rem, 10.2vw, 3.55rem)",
  "--chat-mobile-hud-center-y": "calc(var(--chat-mobile-back-top) + (var(--chat-mobile-back-size) / 2))",
  "--chat-mobile-show-top": "calc(var(--chat-mobile-hud-center-y) - (var(--chat-mobile-show-size) / 2))",
  "--chat-mobile-rail-top": "calc(var(--chat-mobile-hud-center-y) - (var(--chat-mobile-rail-size) / 2))",
  "--inputbar-h": "3.08rem"
});

const CHAT_LAYOUT_MOBILE_VARS = Object.freeze({
  "--chat-window-shift-x": "clamp(-0.34rem, -0.14vw, -0.12rem)",
  "--chat-window-top-offset": "clamp(-0.32rem, -0.65vh, -0.16rem)",
  "--chat-window-pad-top": "clamp(0.32rem, 1vh, 0.65rem)",
  "--chat-window-pad-bottom": "calc(env(safe-area-inset-bottom, 0px) + 3.95rem)",
  "--chat-window-top-safe": "3.65rem",
  "--chat-window-bottom-gap": "0.18rem",
  "--chat-window-shift-y": "clamp(1.95rem, 5.4vh, 2.8rem)",
  "--chat-window-main-offset": "clamp(0.72rem, 2.2vh, 1.02rem)",
  "--chat-window-mobile-extra-height": "1.05rem",
  "--chat-window-mobile-width-right": "0.28rem",
  "--chat-window-bottom-safe": "0rem",
  "--chat-window-fade-top": "clamp(1.85rem, 5.2vh, 2.85rem)",
  "--chat-window-top-text-fade-extra": "3.2rem",
  "--chat-window-scroll-top-fade-start": "0.46rem",
  "--chat-window-scroll-top-fade-mid": "0.98rem",
  "--chat-window-scroll-top-fade-end": "1.65rem",
  "--chat-window-fade-bottom": "clamp(3.05rem, 8.6vh, 4.7rem)",
  "--chat-scroll-down-offset": "-2.6rem",
  "--chat-content-top-offset": "1.7rem",
  "--chat-content-spacer": "2.35rem",
  "--chat-content-bottom-spacer": "0.8rem",
  "--chat-input-shift": "0rem",
  "--chat-inputbar-left-pull": "0rem",
  "--chat-attach-left-pull": "0rem",
  "--chat-hpad-left": "clamp(0.7rem, 3vw, 1rem)",
  "--chat-hpad-right": "clamp(0.7rem, 3vw, 1rem)",
  "--chat-hpad": "calc(max(var(--hud-edge-left), var(--hud-edge-right)) + var(--hud-icon) + 0.05rem)",
  "--chat-ai-offset": "clamp(2.2rem, 8vw, 3.6rem)",
  "--hud-edge": "clamp(0.55rem, 3vw, 0.95rem)",
  "--hud-icon": "clamp(2.65rem, 12vw, 3rem)",
  "--chat-nav-top": "clamp(2.8rem, 11vw, 4.2rem)",
  "--chat-pad-top": "clamp(0.75rem, 2vh, 1.1rem)",
  "--chat-pad-bottom": "clamp(0.5rem, 1.8vh, 0.9rem)",
  "--chat-logo-height": "clamp(9rem, 52vw, 18rem)",
  "--chat-logo-y": "clamp(3.6rem, 24vh, 9.4rem)",
  "--chat-mobile-back-top": "var(--mobile-header-control-top, 0.2rem)",
  "--chat-mobile-back-size": "4.4rem",
  "--chat-mobile-show-size": "3.78rem",
  "--chat-mobile-show-icon-size": "3.46rem",
  "--chat-mobile-rail-size": "clamp(3.1rem, 10.2vw, 3.55rem)",
  "--chat-mobile-hud-center-y": "calc(var(--chat-mobile-back-top) + (var(--chat-mobile-back-size) / 2))",
  "--chat-mobile-show-top": "calc(var(--chat-mobile-hud-center-y) - (var(--chat-mobile-show-size) / 2))",
  "--chat-mobile-rail-top": "calc(var(--chat-mobile-hud-center-y) - (var(--chat-mobile-rail-size) / 2))"
});

const CHAT_LAYOUT_MOBILE_OVERRIDES = Object.freeze({
  "--chat-window-pad-top": "clamp(0.32rem, 1vh, 0.65rem)",
  "--chat-content-top-offset": "1.7rem",
  "--chat-content-spacer": "2.35rem",
  "--chat-content-bottom-spacer": "0.8rem"
});

const CHAT_LAYOUT_DESKTOP_FOCUS_OVERRIDES = Object.freeze({
  "--chat-focus-diameter-scale": "1.06",
  "--ring-scale": "1",
  "--ring-fit-pad": "calc(1.3 * var(--base-rem))",
  "--ring-ui-reserve": "calc(2 * var(--base-rem))",
  "--ring-ui-reserve-page": "calc(2 * var(--base-rem))",
  "--ring-base-min": "calc(36 * var(--base-rem))",
  "--ring-base-max": "calc(52 * var(--base-rem))",
  "--ring-desktop-max": "calc(55 * var(--base-rem))",
  "--ring-diameter":
    "min(var(--ring-max), max(calc(40 * var(--base-rem)), calc(var(--ring-diameter-default) * var(--chat-focus-diameter-scale, 1.06))))",
  "--chat-diameter": "var(--ring-diameter, var(--ring-diameter-default))",
  "--chat-window-inline-gap": "clamp(1.1rem, calc(var(--chat-diameter) * 0.022), 1.9rem)",
  "--chat-window-max-w":
    "min(calc(clamp(31rem, calc(var(--chat-diameter) * 0.78), 45rem) - 0.5rem), calc(100% - var(--chat-window-inline-gap) - 0.5rem))",
  "--chat-window-shift-x": "calc(clamp(0.16rem, calc(var(--chat-diameter) * 0.005), 0.3rem) + 0.4rem)",
  "--chat-window-shift-y": "clamp(-1.65rem, -3.1vh, -0.85rem)",
  "--chat-window-pad-top": "clamp(1.05rem, 2.3vh, 1.75rem)",
  "--chat-window-top-safe": "clamp(2.15rem, 4.6vh, 3.35rem)",
  "--chat-window-pad-bottom": "calc(clamp(1.25rem, 2.8dvh, 2rem) + 1.15rem)",
  "--chat-window-top-offset": "clamp(1.55rem, 3.25vh, 2.35rem)",
  "--chat-window-bottom-gap": "1.25rem",
  "--chat-window-stack-shift": "calc(clamp(4rem, 7vh, 6rem) + 3.6rem)",
  "--chat-window-bottom-extend": "calc(clamp(16rem, 26vh, 20rem) + 3.6rem)",
  "--chat-scroll-button-shift": "calc(clamp(6rem, 10vh, 8rem) + 6.2rem)",
  "--chat-scroll-button-lift": "clamp(0.8rem, 1.4vh, 1.2rem)",
  "--chat-scroll-down-offset": "0.35rem",
  "--chat-window-fade-top-focus": "clamp(0.92rem, 2.08vh, 1.46rem)",
  "--chat-window-scroll-top-fade-start-focus": "0.42rem",
  "--chat-window-scroll-top-fade-mid-focus": "0.84rem",
  "--chat-window-scroll-top-fade-end-focus": "1.5rem",
  "--chat-window-fade-bottom-focus": "clamp(2.72rem, 6.55vh, 4.25rem)",
  "--chat-input-row-gap": "clamp(2.6rem, 5.6vh, 3.9rem)",
  "--chat-composer-side-control-size": "3.3rem",
  "--chat-composer-main-control-size": "3.48rem",
  "--chat-composer-send-control-size": "3rem",
  "--chat-composer-send-icon-size": "1.1rem",
  "--chat-composer-plus-icon-size": "2.42rem",
  "--chat-composer-listen-icon-size": "2.14rem",
  "--chat-composer-mic-icon-size": "2rem",
  "--chat-send-btn-scale": "0.965",
  "--chat-send-btn-shift-x": "0rem",
  "--chat-send-btn-shift-y": "0rem",
  "--chat-send-btn-expanded-shift-x": "0.22rem",
  "--chat-send-btn-expanded-shift-y": "0.16rem",
  "--chat-input-max-w":
    "min(clamp(calc(20 * var(--base-rem)), calc(var(--chat-window-max-w) * 0.87), calc(31.5 * var(--base-rem))), calc(var(--chat-window-max-w) - clamp(calc(1.35 * var(--base-rem)), calc(var(--chat-diameter) * 0.026), calc(2.25 * var(--base-rem)))))",
  "--chat-composer-bottom-gap": "clamp(1.2rem, 3.1vh, 2.05rem)",
  "--chat-input-focus-shift": "-1.75rem",
  "--chat-hpad-right": "clamp(0.5rem, calc(var(--chat-diameter) * 0.018), 1rem)",
  "--chat-content-top-offset": "clamp(1.4rem, 3.4vh, 2.6rem)",
  "--chat-content-spacer": "clamp(2.4rem, 5.2vh, 3.9rem)",
  "--chat-content-bottom-spacer": "0.6rem",
  "--hud-icon": "clamp(3.16rem, calc(var(--chat-diameter) * 0.063), 3.45rem)"
});

const CHAT_LAYOUT_DESKTOP_WORKSPACE_OVERRIDES = Object.freeze({
  "--chat-pad-top": "clamp(0.35rem, 1.1vh, 0.72rem)",
  "--chat-pad-bottom": "0rem"
});

const MOBILE_VIEWPORT_QUERY = "(max-width: 768px)";
const COARSE_POINTER_QUERY = "(hover: none) and (pointer: coarse)";

function detectMobileViewport() {
  if (typeof window === "undefined") return false;
  const width = Math.max(0, window.innerWidth || 0);
  const height = Math.max(0, window.innerHeight || 0);
  const shortestSide = Math.min(width, height);
  const matchWidth = window.matchMedia?.(MOBILE_VIEWPORT_QUERY)?.matches;
  const matchCoarse = window.matchMedia?.(COARSE_POINTER_QUERY)?.matches;
  const likelyPortraitTouchViewport =
    Boolean(matchCoarse) &&
    width > 0 &&
    height > width &&
    width <= 1024 &&
    shortestSide <= 900;

  return Boolean(matchWidth || width <= 768 || likelyPortraitTouchViewport);
}

function resolveChatLayoutVars({
  isMobile,
  focusActive,
  workspaceOpen = false
}) {
  const useDesktopExpandedRing = !isMobile && (focusActive || workspaceOpen);

  return {
    ...CHAT_LAYOUT_BASE_VARS,
    ...(isMobile ? CHAT_LAYOUT_MOBILE_VARS : null),
    ...(isMobile ? CHAT_LAYOUT_MOBILE_OVERRIDES : null),
    ...(useDesktopExpandedRing ? CHAT_LAYOUT_DESKTOP_FOCUS_OVERRIDES : null),
    ...(!isMobile && workspaceOpen ? CHAT_LAYOUT_DESKTOP_WORKSPACE_OVERRIDES : null)
  };
}

export { detectMobileViewport, resolveChatLayoutVars };
