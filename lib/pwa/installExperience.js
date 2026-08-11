export const PWA_INSTALL_SNOOZE_KEY = "sotsiaalai:pwa-install-snoozed-until";
export const PWA_INSTALL_CONFIRMED_KEY = "sotsiaalai:pwa-install-confirmed";
export const PWA_INSTALL_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

const IOS_OTHER_BROWSER_PATTERN = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i;

export function detectPwaEnvironment({
  userAgent = "",
  vendor = "",
  platform = "",
  maxTouchPoints = 0,
} = {}) {
  const isIOS =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && Number(maxTouchPoints) > 1);
  const isSafariEngine =
    /Safari/i.test(userAgent) && /Apple Computer/i.test(vendor);
  const isIOSSafari = isIOS && isSafariEngine && !IOS_OTHER_BROWSER_PATTERN.test(userAgent);
  const isMacSafari = /Mac/i.test(platform) && !isIOS && isSafariEngine;

  return {
    isIOS,
    isIOSSafari,
    isMacSafari,
    isMobile: Boolean(isIOS || /Android|Mobile/i.test(userAgent)),
  };
}

export function shouldUseNativeInstallPrompt({ deferredPrompt, isIOS }) {
  return Boolean(deferredPrompt && !isIOS);
}

export function isMeaningfulInstallPath(pathname = "") {
  const path = String(pathname || "").split("?")[0];
  if (!path || path === "/") return false;

  return ![
    "/autorilt",
    "/hinnastus",
    "/kasutusjuhend",
    "/kasutustingimused",
    "/meist",
    "/privaatsustingimused",
    "/registreerimine",
    "/taasta-parool",
    "/voimalused",
  ].some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`));
}

export function shouldShowInstallPromotion({
  authenticated = false,
  available = false,
  pathname = "",
  standalone = false,
  suppressed = false,
  snoozedUntil = 0,
  now = Date.now(),
} = {}) {
  return Boolean(
    authenticated &&
      available &&
      !standalone &&
      !suppressed &&
      isMeaningfulInstallPath(pathname) &&
      Number(snoozedUntil || 0) <= now
  );
}

export function nextInstallSnoozeAt(now = Date.now()) {
  return Number(now) + PWA_INSTALL_SNOOZE_MS;
}
