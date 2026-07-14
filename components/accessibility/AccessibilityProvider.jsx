"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useI18n } from "@/components/i18n/I18nProvider";
const AccessibilityModal = dynamic(() => import("./AccessibilityModal"), {
  ssr: false,
  loading: () => null
});
const A11yContext = createContext(null);
const DEFAULT_PREFS = {
  uiScale: "md",
  uiProfile: "sm",
  contrast: "normal",
  plainLanguage: false,
  reduceMotion: false,
  reduceTransparency: false,
  theme: "mid"
};
const UI_SCALE_VALUES = new Set(["sm", "md", "lg", "xl"]);
const UI_PROFILE_VALUES = new Set(["sm", "mac", "lg"]);
const UI_SCALE_STORAGE_KEY = "sotsiaalai.uiScale";
const UI_PROFILE_STORAGE_KEY = "sotsiaalai.uiProfile";
let themeSwitchClearTimer = null;

function resolveThemeChromeColor(theme, contrast = "normal") {
  if (contrast === "hc") return "#0c0703";
  if (theme === "light") return "#f4f2ee";
  if (theme === "dark") return "#0c0703";
  return "#140b07"; // mid (Hämar) = stseeni loojang
}

function ensureMetaTag(name) {
  if (typeof document === "undefined") return null;
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  return meta;
}

function syncThemeChrome(prefs) {
  if (typeof document === "undefined") return;
  const contrast = prefs?.contrast || DEFAULT_PREFS.contrast;
  const theme = contrast === "hc" ? "dark" : normalizeTheme(prefs?.theme);
  const themeColor = resolveThemeChromeColor(theme, contrast);
  ensureMetaTag("theme-color")?.setAttribute("content", themeColor);
  ensureMetaTag("apple-mobile-web-app-status-bar-style")?.setAttribute(
    "content",
    theme === "light" ? "default" : "black-translucent"
  );
}

function parseUIScale(uiScale) {
  if (!uiScale || typeof uiScale !== "string") return null;
  return UI_SCALE_VALUES.has(uiScale) ? uiScale : null;
}

function normalizeUIScale(uiScale) {
  return parseUIScale(uiScale) || DEFAULT_PREFS.uiScale;
}

function parseUIProfile(uiProfile) {
  if (!uiProfile || typeof uiProfile !== "string") return null;
  if (UI_PROFILE_VALUES.has(uiProfile)) return uiProfile;
  if (uiProfile === "md") return "sm";
  if (uiProfile === "xl") return "lg";
  return null;
}

function normalizeUIProfile(uiProfile) {
  return parseUIProfile(uiProfile) || DEFAULT_PREFS.uiProfile;
}

function resolveUIScaleValue(uiScale, uiProfile) {
  const normalized = normalizeUIScale(uiScale);
  const textFactor =
    normalized === "sm"
      ? 0.9375
      : normalized === "lg"
        ? 1.125
        : normalized === "xl"
          ? 1.25
          : 1;
  const profile = normalizeUIProfile(uiProfile);
  const profileFactor = profile === "lg" ? 1.25 : profile === "mac" ? 1.18 : 1;
  return profileFactor * textFactor;
}
const THEME_VALUES = ["light", "mid", "dark"];
function isKnownThemeValue(theme) {
  // Praegused (light/mid/dark) + legacy väärtused, mille normalizeTheme oskab kaardistada.
  return THEME_VALUES.includes(theme) || theme === "night" || theme === "mono";
}
function normalizeTheme() {
  // LUKUS (07.07): platvorm avaldab ainult "Hämar" (mid). Hele/Öö
  // tokenid on karkass (Fable 5 viimistleb) — kuni siis sunnib runtime
  // ALATI mid'i, et salvestatud/legacy väärtused (light/dark/night/mono)
  // ega cookie ei aktiveeriks poolikut teemat. HC-baas (dark) tuleb
  // effectiveTheme'ist, mitte siit.
  return "mid";
}
/* Efektiivne teemaväärtus: kõrgkontrast sunnib alati "dark" baasi. */
function effectiveTheme(prefs) {
  return prefs?.contrast === "hc" ? "dark" : normalizeTheme(prefs?.theme);
}
function resolveThemeFromDom(html) {
  const attrTheme = html.getAttribute("data-theme-mode");
  if (THEME_VALUES.includes(attrTheme)) return attrTheme;
  if (attrTheme === "night" || attrTheme === "mono") return normalizeTheme(attrTheme);
  for (const v of THEME_VALUES) {
    if (html.classList.contains(`theme-${v}`)) return v;
  }
  return null;
}
function matchesThemeClasses(html, prefs) {
  const theme = effectiveTheme(prefs);
  return THEME_VALUES.every(
    (v) => html.classList.contains(`theme-${v}`) === (v === theme)
  );
}
const DEV = process.env.NODE_ENV !== "production";
const A11Y_DEBUG = process.env.NEXT_PUBLIC_A11Y_DEBUG === "1";
function getCookie(name) {
  if (typeof document === "undefined") return null;
  const v = document.cookie.split("; ").find(row => row.startsWith(name + "="));
  return v ? decodeURIComponent(v.split("=")[1]) : null;
}
function setCookie(name, value, maxAgeSec = 60 * 60 * 24 * 365) {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(value);
  document.cookie = `${name}=${encoded}; path=/; max-age=${maxAgeSec}; SameSite=Lax`;
}
function readPrefsFromCookie() {
  try {
    const raw = getCookie("a11y_prefs");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const uiScale = normalizeUIScale(obj?.uiScale ?? obj?.textScale);
    const uiProfile = normalizeUIProfile(obj?.uiProfile ?? obj?.screenProfile ?? obj?.uiScale ?? obj?.textScale);
    const contrast = obj?.contrast || DEFAULT_PREFS.contrast;
    const plainLanguage = obj?.plainLanguage === true;
    const reduceMotion = !!obj?.reduceMotion;
    const reduceTransparency = obj?.reduceTransparency == null ? reduceMotion : !!obj?.reduceTransparency;
    let theme = normalizeTheme(obj?.theme);
    if (contrast === "hc") theme = "dark";
    return {
      uiScale,
      uiProfile,
      contrast,
      plainLanguage,
      reduceMotion,
      reduceTransparency,
      theme
    };
  } catch {
    return null;
  }
}
function readStoredUIScale() {
  if (typeof window === "undefined") return null;
  try {
    const fromKey = parseUIScale(window.localStorage.getItem(UI_SCALE_STORAGE_KEY));
    if (fromKey) return fromKey;
  } catch {}
  try {
    const rawPrefs = window.localStorage.getItem("a11y_prefs");
    const prefs = rawPrefs ? JSON.parse(rawPrefs) : null;
    const fromPrefs = parseUIScale((prefs && (prefs.uiScale || prefs.textScale)) || null);
    if (fromPrefs) return fromPrefs;
  } catch {}
  return null;
}
function readStoredUIProfile() {
  if (typeof window === "undefined") return null;
  try {
    const fromKey = parseUIProfile(window.localStorage.getItem(UI_PROFILE_STORAGE_KEY));
    if (fromKey) return fromKey;
  } catch {}
  try {
    const rawPrefs = window.localStorage.getItem("a11y_prefs");
    const prefs = rawPrefs ? JSON.parse(rawPrefs) : null;
    const fromPrefs = parseUIProfile((prefs && (prefs.uiProfile || prefs.screenProfile || prefs.uiScale || prefs.textScale)) || null);
    if (fromPrefs) return fromPrefs;
  } catch {}
  return null;
}
function readInitialPrefsFromDom() {
  if (typeof document === "undefined") return {
    ...DEFAULT_PREFS
  };
  const html = document.documentElement;
  const contrast = html.getAttribute("data-contrast") || DEFAULT_PREFS.contrast;
  let theme = resolveThemeFromDom(html) || DEFAULT_PREFS.theme;
  if (contrast !== "hc") {
    try {
      const storedTheme = window.localStorage.getItem("theme");
      if (isKnownThemeValue(storedTheme)) {
        theme = normalizeTheme(storedTheme);
      }
    } catch {}
  } else {
    theme = "dark";
  }
  const storedUIScale = readStoredUIScale();
  const storedUIProfile = readStoredUIProfile();
  const domReduceMotion = html.getAttribute("data-reduce-motion") === "1";
  const reduceTransparencyAttr = html.getAttribute("data-reduce-transparency");
  const fromDataset = {
    uiScale: normalizeUIScale(storedUIScale ?? html.getAttribute("data-text-scale")),
    uiProfile: normalizeUIProfile(storedUIProfile ?? html.getAttribute("data-ui-profile") ?? html.getAttribute("data-ui-scale")),
    contrast,
    plainLanguage: html.getAttribute("data-plain-language") === "1",
    reduceMotion: domReduceMotion,
    reduceTransparency: reduceTransparencyAttr == null ? domReduceMotion : reduceTransparencyAttr === "1",
    theme
  };
  const hasCookie = !!getCookie("a11y_prefs");
  if (!hasCookie) {
    try {
      const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      if (prefersReduced) fromDataset.reduceMotion = true;
    } catch {}
  }
  return fromDataset;
}
function applyPrefsToDom(prefs) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const uiScale = normalizeUIScale(prefs.uiScale);
  const uiProfile = normalizeUIProfile(prefs.uiProfile ?? uiScale);
  const nextContrast = prefs.contrast || DEFAULT_PREFS.contrast;
  const hadContrast = html.getAttribute("data-contrast") || DEFAULT_PREFS.contrast;
  html.setAttribute("data-ui-scale", uiProfile);
  html.setAttribute("data-ui-profile", uiProfile);
  html.setAttribute("data-text-scale", uiScale);
  html.setAttribute("data-ui-scale-auto", "0");
  html.setAttribute("data-contrast", nextContrast);
  html.setAttribute("data-plain-language", prefs.plainLanguage === true ? "1" : "0");
  html.setAttribute("data-reduce-motion", prefs.reduceMotion ? "1" : "0");
  html.setAttribute("data-reduce-transparency", prefs.reduceTransparency ? "1" : "0");
  html.style.setProperty("--ui-scale", String(resolveUIScaleValue(uiScale, uiProfile)));
  const theme = effectiveTheme({ theme: prefs.theme, contrast: nextContrast });
  html.setAttribute("data-theme-mode", theme);
  const hadThemeClass = THEME_VALUES.find((v) => html.classList.contains(`theme-${v}`)) || null;
  const themeChanged = hadContrast !== nextContrast || hadThemeClass !== theme;
  if (themeChanged) {
    html.setAttribute("data-theme-switching", "1");
  }
  for (const v of THEME_VALUES) {
    html.classList.toggle(`theme-${v}`, v === theme);
  }
  syncThemeChrome({ ...prefs, theme, contrast: prefs.contrast || DEFAULT_PREFS.contrast });
  if (themeChanged && typeof window !== "undefined") {
    if (themeSwitchClearTimer) window.clearTimeout(themeSwitchClearTimer);
    themeSwitchClearTimer = window.setTimeout(() => {
      if (typeof document === "undefined") return;
      document.documentElement.removeAttribute("data-theme-switching");
      themeSwitchClearTimer = null;
    }, 240);
  } else if (!themeChanged) {
    html.removeAttribute("data-theme-switching");
  }
}
function buildInitialPrefs(initialPrefs) {
  const domPrefs = typeof document !== "undefined" ? readInitialPrefsFromDom() : null;
  if (initialPrefs) {
    const contrast = initialPrefs.contrast || DEFAULT_PREFS.contrast;
    const theme = normalizeTheme(domPrefs?.theme ?? initialPrefs.theme);
    return {
      ...DEFAULT_PREFS,
      ...initialPrefs,
      ...(domPrefs || null),
      uiScale: normalizeUIScale(initialPrefs.uiScale ?? domPrefs?.uiScale),
      uiProfile: normalizeUIProfile(initialPrefs.uiProfile ?? domPrefs?.uiProfile ?? initialPrefs.uiScale ?? domPrefs?.uiScale),
      contrast,
      plainLanguage: (initialPrefs.plainLanguage ?? domPrefs?.plainLanguage) === true,
      reduceMotion: !!(initialPrefs.reduceMotion ?? domPrefs?.reduceMotion),
      reduceTransparency: !!(initialPrefs.reduceTransparency ?? domPrefs?.reduceTransparency ?? initialPrefs.reduceMotion ?? domPrefs?.reduceMotion),
      theme: contrast === "hc" ? "dark" : theme
    };
  }
  return domPrefs
    ? {
        ...DEFAULT_PREFS,
        ...domPrefs,
        uiScale: normalizeUIScale(domPrefs.uiScale),
        uiProfile: normalizeUIProfile(domPrefs.uiProfile ?? domPrefs.uiScale),
        plainLanguage: domPrefs.plainLanguage === true
      }
    : {
        ...DEFAULT_PREFS
      };
}
function AccessibilityProvider({
  children,
  initialPrefs = null
}) {
  const [prefs, setPrefsState] = useState(() => buildInitialPrefs(initialPrefs));
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [modalMode, setModalMode] = useState("standard");
  const hydratedRef = useRef(false);
  const applyingRef = useRef(false);
  const prefsRef = useRef(prefs);
  const lastOpenerRef = useRef(null);
  const liveRef = useRef(null);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const navInProgressRef = useRef(false);
  const prevClassNameRef = useRef(null);
  const openTimerRef = useRef(null);
  const enforceTimerRef = useRef(null);
  const {
    t
  } = useI18n();
  const promptedOnceRef = useRef(false);
  const initialIsHomeRef = useRef(pathname === "/");
  const logDev = useCallback((label, payload) => {
    if (!DEV || !A11Y_DEBUG || typeof window === "undefined") return;
    // Hook point for optional debug tooling without noisy console output.
    const sink = window.__A11Y_DEBUG_LOGGER;
    if (typeof sink !== "function") return;
    const now = typeof performance !== "undefined" ? performance.now().toFixed(1) : "0";
    sink(label, {
      t: now,
      ...payload
    });
  }, []);
  const safeApplyPrefsToDom = useCallback((next, reason) => {
    applyingRef.current = true;
    if (DEV && typeof window !== "undefined") {
      logDev("applyPrefsToDom", {
        reason,
        prefs: next,
        pathname: pathnameRef.current
      });
    }
    applyPrefsToDom(next);
    if (typeof queueMicrotask === "function") {
      queueMicrotask(() => {
        applyingRef.current = false;
      });
    } else if (typeof window !== "undefined") {
      window.setTimeout(() => {
        applyingRef.current = false;
      }, 0);
    } else {
      applyingRef.current = false;
    }
  }, [logDev]);
  const scheduleOpenModal = useCallback(reason => {
    if (typeof window === "undefined") return;
    if (openTimerRef.current) {
      const {
        id,
        type
      } = openTimerRef.current;
      if (type === "idle" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(id);
      } else {
        window.clearTimeout(id);
      }
      openTimerRef.current = null;
    }
    const attempt = () => {
      if (navInProgressRef.current) {
        openTimerRef.current = {
          id: window.setTimeout(attempt, 120),
          type: "timeout"
        };
        return;
      }
      logDev("modal-open", {
        reason,
        pathname: pathnameRef.current
      });
      setModalMode("first-visit");
      setOpen(true);
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(attempt, {
        timeout: 500
      });
      openTimerRef.current = {
        id,
        type: "idle"
      };
    } else {
      openTimerRef.current = {
        id: window.setTimeout(attempt, 80),
        type: "timeout"
      };
    }
  }, [logDev]);
  useEffect(() => {
    return () => {
      if (!openTimerRef.current || typeof window === "undefined") return;
      const {
        id,
        type
      } = openTimerRef.current;
      if (type === "idle" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(id);
      } else {
        window.clearTimeout(id);
      }
      openTimerRef.current = null;
    };
  }, []);
  useEffect(() => {
    pathnameRef.current = pathname;
    navInProgressRef.current = true;
    const timeout = window.setTimeout(() => {
      navInProgressRef.current = false;
    }, 320);
    return () => window.clearTimeout(timeout);
  }, [pathname]);
  useLayoutEffect(() => {
    const domPrefs = readInitialPrefsFromDom();
    const cookiePrefs = readPrefsFromCookie();
    const initial = cookiePrefs ? {
      ...domPrefs,
      ...cookiePrefs,
      theme: domPrefs.theme ?? cookiePrefs.theme
    } : domPrefs;
    initial.uiScale = normalizeUIScale(cookiePrefs?.uiScale ?? domPrefs.uiScale);
    initial.uiProfile = normalizeUIProfile(cookiePrefs?.uiProfile ?? domPrefs.uiProfile ?? initial.uiScale);
    initial.plainLanguage = (cookiePrefs?.plainLanguage ?? domPrefs.plainLanguage) === true;
    if (initial.contrast === "hc") initial.theme = "dark";
    setPrefsState(initial);
    safeApplyPrefsToDom(initial, "init");
    hydratedRef.current = true;
    setPrefsHydrated(true);
    const hasCookie = !!cookiePrefs;
    if (!hasCookie && initialIsHomeRef.current) {
      promptedOnceRef.current = true;
      scheduleOpenModal("init-home");
    }
  }, [safeApplyPrefsToDom, scheduleOpenModal]);
  useEffect(() => {
    const hasCookie = !!getCookie("a11y_prefs");
    if (!hasCookie && pathname === "/" && !promptedOnceRef.current) {
      promptedOnceRef.current = true;
      scheduleOpenModal("route-home");
    }
  }, [pathname, scheduleOpenModal]);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  useLayoutEffect(() => {
    if (!hydratedRef.current) return;
    if (typeof document === "undefined") return;
    const hasExpectedThemeClasses = matchesThemeClasses(document.documentElement, prefs);
    if (hasExpectedThemeClasses) return;
    safeApplyPrefsToDom(prefs, "prefs-route-sync");
  }, [prefs, pathname, safeApplyPrefsToDom]);
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const html = document.documentElement;
    const observer = new MutationObserver(() => {
      const current = html.className;
      if (current === prevClassNameRef.current) return;
      const prev = prevClassNameRef.current || "";
      const hadLight = prev.split(" ").includes("theme-light");
      const hasLight = html.classList.contains("theme-light");
      logDev("html.className change", {
        pathname: pathnameRef.current,
        navigating: navInProgressRef.current,
        prev,
        next: current,
        addedThemeLight: !hadLight && hasLight,
        removedThemeLight: hadLight && !hasLight
      });
      prevClassNameRef.current = current;
      if (applyingRef.current) return;
      const snapshot = prefsRef.current;
      if (snapshot) {
        const hasExpectedThemeClasses = matchesThemeClasses(html, snapshot);
        if (!hasExpectedThemeClasses) {
          logDev("html.className mismatch", {
            pathname: pathnameRef.current,
            expectedTheme: snapshot.contrast === "hc" ? "dark" : snapshot.theme,
            actualThemeLight: hasLight
          });
          const apply = () => {
            enforceTimerRef.current = null;
            safeApplyPrefsToDom(snapshot, "observer-enforce");
          };
          if (navInProgressRef.current && typeof window !== "undefined") {
            if (enforceTimerRef.current) window.clearTimeout(enforceTimerRef.current);
            enforceTimerRef.current = window.setTimeout(apply, 400);
            return;
          }
          if (enforceTimerRef.current) {
            window.clearTimeout(enforceTimerRef.current);
            enforceTimerRef.current = null;
          }
          apply();
          return;
        }
        if (enforceTimerRef.current) {
          window.clearTimeout(enforceTimerRef.current);
          enforceTimerRef.current = null;
        }
      }
    });
    prevClassNameRef.current = html.className;
    observer.observe(html, {
      attributes: true,
      attributeFilter: ["class"]
    });
    return () => {
      observer.disconnect();
      if (enforceTimerRef.current) {
        window.clearTimeout(enforceTimerRef.current);
        enforceTimerRef.current = null;
      }
    };
  }, [logDev, safeApplyPrefsToDom]);
  const announce = useCallback(msg => {
    if (!msg) return;
    if (typeof document === "undefined") return;
    const node = liveRef.current;
    if (!node) return;
    node.textContent = "";
    setTimeout(() => {
      node.textContent = msg;
    }, 50);
  }, []);
  const setPrefs = useCallback(next => {
    const merged = {
      ...DEFAULT_PREFS,
      ...prefs,
      ...next
    };
    merged.uiScale = normalizeUIScale(merged.uiScale);
    merged.uiProfile = normalizeUIProfile(merged.uiProfile ?? merged.uiScale);
    merged.plainLanguage = merged.plainLanguage === true;
    merged.theme = normalizeTheme(merged.theme);
    if (merged.contrast === "hc") {
      merged.theme = "dark";
    }
    prefsRef.current = merged;
    setPrefsState(merged);
    safeApplyPrefsToDom(merged, "setPrefs");
    try {
      localStorage.setItem("a11y_prefs", JSON.stringify(merged));
    } catch {}
    try {
      const cookiePrefs = {
        ...merged
      };
      delete cookiePrefs.uiScale;
      delete cookiePrefs.textScale;
      setCookie("a11y_prefs", JSON.stringify(cookiePrefs));
    } catch {}
    try {
      localStorage.setItem(UI_SCALE_STORAGE_KEY, merged.uiScale);
    } catch {}
    try {
      localStorage.setItem(UI_PROFILE_STORAGE_KEY, merged.uiProfile);
    } catch {}
    try {
      if (THEME_VALUES.includes(merged.theme)) {
        localStorage.setItem("theme", merged.theme);
      }
    } catch {}
    announce(t("profile.preferences.saved"));
  }, [prefs, announce, t, safeApplyPrefsToDom]);
  const previewPrefs = useCallback(partial => {
    const preview = {
      ...DEFAULT_PREFS,
      ...prefs,
      ...partial
    };
    preview.uiScale = normalizeUIScale(preview.uiScale);
    preview.uiProfile = normalizeUIProfile(preview.uiProfile ?? preview.uiScale);
    preview.plainLanguage = preview.plainLanguage === true;
    preview.theme = normalizeTheme(preview.theme);
    if (preview.contrast === "hc") {
      preview.theme = "dark";
    }
    safeApplyPrefsToDom(preview, "preview");
  }, [prefs, safeApplyPrefsToDom]);
  const resetPreview = useCallback(() => {
    const current = prefsRef.current || prefs;
    safeApplyPrefsToDom(current, "resetPreview");
  }, [prefs, safeApplyPrefsToDom]);
  const openModal = useCallback(() => {
    try {
      lastOpenerRef.current = document.activeElement;
    } catch {}
    setModalMode("standard");
    setOpen(true);
  }, []);
  const closeModal = useCallback(() => {
    setOpen(false);
    resetPreview();
    setModalMode("standard");
    setTimeout(() => {
      const el = lastOpenerRef.current;
      if (el && typeof el.focus === "function") {
        try {
          el.focus();
        } catch {}
      }
    }, 0);
  }, [resetPreview]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const main = document.getElementById("main");
    const bg = document.querySelector("[data-bg-layer]");
    const body = document.body;
    if (open) {
      if (main) {
        const active = document.activeElement;
        if (active instanceof HTMLElement && main.contains(active)) {
          const modalRoot = document.querySelector('[role="dialog"][aria-modal="true"]');
          if (modalRoot instanceof HTMLElement && typeof modalRoot.focus === "function") {
            try {
              modalRoot.focus({
                preventScroll: true
              });
            } catch {
              try {
                modalRoot.focus();
              } catch {}
            }
          }
          if (document.activeElement === active) {
            try {
              active.blur();
            } catch {}
          }
        }
        main.setAttribute("aria-hidden", "true");
        main.inert = true;
      }
      if (bg) bg.setAttribute("aria-hidden", "true");
      const prev = {
        overflow: body.style.overflow,
        position: body.style.position,
        width: body.style.width,
        top: body.style.top,
        touchAction: body.style.touchAction
      };
      const scrollY = window.scrollY || 0;
      body.dataset.a11yScrollLock = "1";
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.width = "100%";
      body.style.touchAction = "none";
      return () => {
        if (main) {
          main.removeAttribute("aria-hidden");
          main.inert = false;
        }
        if (bg) bg.removeAttribute("aria-hidden");
        if (body.dataset.a11yScrollLock) {
          delete body.dataset.a11yScrollLock;
          body.style.overflow = prev.overflow;
          body.style.position = prev.position;
          body.style.width = prev.width;
          body.style.top = prev.top;
          body.style.touchAction = prev.touchAction;
          const y = Math.max(0, scrollY);
          window.scrollTo(0, y);
        }
      };
    }
  }, [open]);
  const value = useMemo(() => ({
    prefs,
    setPrefs,
    openModal,
    closeModal,
    isModalOpen: open,
    announce,
    hydrated: prefsHydrated
  }), [prefs, setPrefs, openModal, closeModal, open, announce, prefsHydrated]);
  return <A11yContext.Provider value={value}>
      {}
      <div aria-live="polite" aria-atomic="true" style={{
      position: "absolute",
      width: 1,
      height: 1,
      overflow: "hidden",
      clip: "rect(0 0 0 0)"
    }} ref={liveRef} />
      {}
      {children}
      {}
      {open && <AccessibilityModal onClose={closeModal} prefs={prefs} onSave={setPrefs} onPreview={previewPrefs} onPreviewEnd={resetPreview} requireInitialSelection={modalMode === "first-visit"} />}
    </A11yContext.Provider>;
}
export default AccessibilityProvider;
export function useAccessibility() {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
}
