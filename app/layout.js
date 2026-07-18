import "./styles/globals.css";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { Exo_2 } from "next/font/google";
import Providers from "./providers";
import ViewportLayoutSetter from "@/components/ViewportLayoutSetter";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";
import RoomStage from "@/components/room/RoomStage";
import PanelFrame from "@/components/room/PanelFrame";
import { PanelInfoSlotProvider } from "@/components/ui/PanelInfoSlot";
import SkipLink from "@/components/room/SkipLink";
import AmbientAudio from "@/components/room/AmbientAudio";
import LiquidCursor from "@/components/brand/LiquidCursor";
import SpecularHighlight from "@/components/glass/SpecularHighlight";
import GlassFilters from "@/components/glass/GlassFilters";
import { authConfig } from "@/auth";

// Exo 2 = platvormi läbiv font (logo font); toetab kirillitsat (vene) ja
// latin-ext'i (eesti š/ž) — kõik tekstid, nupud, pealkirjad ühes kirjas
// (tellija 07.07). Variable wght-font → kõik kaalud saadaval.
const fontExo2 = Exo_2({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-exo2",
  display: "swap"
});
const ICON_VERSION = "v20260712";
const UI_SCALE_STORAGE_KEY = "sotsiaalai.uiScale";
const UI_PROFILE_STORAGE_KEY = "sotsiaalai.uiProfile";
const ROOM_ARRIVAL_COMPLETE_COOKIE = "sotsiaalai_room_arrival_complete";
const UI_SCALE_INIT_SCRIPT = `(function () {
  var SCALE_KEY = ${JSON.stringify(UI_SCALE_STORAGE_KEY)};
  var PROFILE_KEY = ${JSON.stringify(UI_PROFILE_STORAGE_KEY)};
  function normalizeTextScale(value) {
    if (value === "sm" || value === "md" || value === "lg" || value === "xl") return value;
    return null;
  }
  function normalizeProfile(value) {
    if (value === "mac") return "mac";
    if (value === "lg" || value === "xl") return "lg";
    if (value === "sm" || value === "md") return "sm";
    return null;
  }
  function resolveTextScale(value) {
    if (value === "sm") return 0.9375;
    if (value === "lg") return 1.125;
    if (value === "xl") return 1.25;
    return 1;
  }
  function resolveProfileScale(value) {
    var profile = normalizeProfile(value);
    if (profile === "lg") return 1.25;
    if (profile === "mac") return 1.18;
    return 1;
  }
  function apply(textScale, profile) {
    var root = document.documentElement;
    if (!root) return;
    var resolvedTextScale = normalizeTextScale(textScale) || "md";
    var resolvedProfile = normalizeProfile(profile) || normalizeProfile(resolvedTextScale) || "sm";
    root.style.setProperty(
      "--ui-scale",
      String(resolveTextScale(resolvedTextScale) * resolveProfileScale(resolvedProfile))
    );
    root.setAttribute("data-text-scale", resolvedTextScale);
    root.setAttribute("data-ui-scale", resolvedProfile);
    root.setAttribute("data-ui-profile", resolvedProfile);
    root.setAttribute("data-ui-scale-auto", "0");
  }
  var textScale = null;
  var profile = null;
  try {
    textScale = normalizeTextScale(window.localStorage.getItem(SCALE_KEY));
  } catch {}
  try {
    profile = normalizeProfile(window.localStorage.getItem(PROFILE_KEY));
  } catch {}
  if (!textScale || !profile) {
    try {
      var rawPrefs = window.localStorage.getItem("a11y_prefs");
      var prefs = rawPrefs ? JSON.parse(rawPrefs) : null;
      textScale = normalizeTextScale((prefs && (prefs.uiScale || prefs.textScale)) || null);
      profile = normalizeProfile((prefs && (prefs.uiProfile || prefs.screenProfile || prefs.uiScale || prefs.textScale)) || null);
    } catch {}
  }
  apply(textScale || "md", profile || null);
})();`;
const THEME_INIT_SCRIPT = `(function () {
  var root = document.documentElement;
  if (!root) return;
  function normalizeTheme(value) {
    // Kolm tonaalset teemat: light (Hele) / mid (Hämar, vaikimisi) / dark (Öö).
    if (value === "light" || value === "mid" || value === "dark") return value;
    // Legacy tagasiühilduvus: vanad väärtused → lähim uus.
    if (value === "night" || value === "mono") return "dark";
    return null;
  }
  function readPrefs() {
    try {
      var raw = window.localStorage.getItem("a11y_prefs");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function readTheme(prefs) {
    var theme = normalizeTheme(prefs && prefs.theme);
    if (!theme) {
      try {
        theme = normalizeTheme(window.localStorage.getItem("theme"));
      } catch {}
    }
    return theme || normalizeTheme(root.getAttribute("data-theme-mode")) || "mid";
  }
  function resolveChromeColor(theme, contrast) {
    // Brauserikroom järgib teema tooni (Hämar = stseeni loojang).
    if (contrast === "hc") return "#0c0703";
    if (theme === "light") return "#f4f2ee";
    if (theme === "dark") return "#0c0703";
    return "#140b07";
  }
  function ensureMeta(name) {
    var meta = document.querySelector('meta[name="' + name + '"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", name);
      document.head.appendChild(meta);
    }
    return meta;
  }
  function applyHomeFlag() {
    var pathname = window.location && window.location.pathname ? window.location.pathname : "/";
    var normalized = pathname.replace(/^\\/(et|ru|en)(?=\\/|$)/, "") || "/";
    if (normalized === "/") root.setAttribute("data-initial-page", "home");
    else root.removeAttribute("data-initial-page");
  }
  var prefs = readPrefs();
  var contrast = (prefs && prefs.contrast) || root.getAttribute("data-contrast") || "normal";
  // LUKUS (07.07): ainult "Hämar" (mid) avaldatud. Hele/Öö = karkass
  // (Fable 5) — sunni mid, et salvestatud light/dark ei vilguks laadimisel.
  // (readTheme/normalizeTheme jäetud alles Fable 5 taasavamiseks.)
  var theme = contrast === "hc" ? "dark" : "mid";
  root.setAttribute("data-theme-mode", contrast === "hc" ? "dark" : theme);
  root.setAttribute("data-contrast", contrast);
  if (prefs) {
    root.setAttribute("data-reduce-motion", prefs.reduceMotion ? "1" : "0");
    root.setAttribute(
      "data-reduce-transparency",
      (prefs.reduceTransparency == null ? prefs.reduceMotion : prefs.reduceTransparency) ? "1" : "0"
    );
  }
  root.classList.toggle("theme-light", contrast !== "hc" && theme === "light");
  root.classList.toggle("theme-mid", contrast !== "hc" && theme === "mid");
  root.classList.toggle("theme-dark", contrast === "hc" || theme === "dark");
  ensureMeta("theme-color").setAttribute("content", resolveChromeColor(theme, contrast));
  ensureMeta("apple-mobile-web-app-status-bar-style").setAttribute(
    "content",
    theme === "light" ? "default" : "black-translucent"
  );
  applyHomeFlag();
})();`;
const LAYOUT_INIT_SCRIPT = `(function () {
  var root = document.documentElement;
  if (!root) return;
  var HOME_BG_SCROLL_KEY = "sotsiaalai:home-background-scroll-y";
  var HOME_BG_RESET_KEY = "sotsiaalai:home-background-reset-on-return";
  var HOME_BG_RESET_PATHS = {
    "/kasutusjuhend": true,
    "/kasutustingimused": true,
    "/privaatsustingimused": true
  };
  function normalizePath(value) {
    var raw = String(value || "/").split("#")[0].split("?")[0] || "/";
    if (raw.charAt(0) !== "/") raw = "/" + raw;
    return raw.replace(/^\\/(et|ru|en)(?=\\/|$)/, "") || "/";
  }
  function isMobileViewport() {
    try {
      return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
    } catch {}
    return window.innerWidth <= 768;
  }
  function syncLayoutFlag() {
    if (isMobileViewport()) {
      root.setAttribute("data-layout", "mobile");
    } else {
      root.removeAttribute("data-layout");
    }
  }
  function markHomeBackgroundReset(event) {
    if (normalizePath(window.location && window.location.pathname) !== "/") return;
    var target = normalizePath(event && event.detail && event.detail.href);
    if (!HOME_BG_RESET_PATHS[target]) return;
    try {
      window.sessionStorage.setItem(HOME_BG_RESET_KEY, "1");
      window.sessionStorage.removeItem(HOME_BG_SCROLL_KEY);
    } catch {}
  }
  function resetHomeBackgroundReturn() {
    if (normalizePath(window.location && window.location.pathname) !== "/") return;
    try {
      if (window.sessionStorage.getItem(HOME_BG_RESET_KEY) !== "1") return;
      window.sessionStorage.removeItem(HOME_BG_RESET_KEY);
      window.sessionStorage.removeItem(HOME_BG_SCROLL_KEY);
    } catch {
      return;
    }
    var homeRoot = document.querySelector(".homepage-root");
    homeRoot && homeRoot.scrollTo && homeRoot.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.scrollTo && window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    var bgLayer = document.querySelector("[data-bg-layer]");
    bgLayer && bgLayer.style.setProperty("--saai-bends-opacity", "0.78");
  }
  function scheduleHomeBackgroundReset() {
    resetHomeBackgroundReturn();
    window.requestAnimationFrame(resetHomeBackgroundReturn);
    window.setTimeout(resetHomeBackgroundReturn, 120);
    window.setTimeout(resetHomeBackgroundReturn, 360);
  }
  syncLayoutFlag();
  scheduleHomeBackgroundReset();
  window.requestAnimationFrame(syncLayoutFlag);
  window.addEventListener("resize", syncLayoutFlag);
  window.visualViewport && window.visualViewport.addEventListener("resize", syncLayoutFlag);
  window.addEventListener("sotsiaalai:route-transition", markHomeBackgroundReset);
  window.addEventListener("pageshow", function () {
    syncLayoutFlag();
    scheduleHomeBackgroundReset();
  });
  window.addEventListener("load", function () {
    syncLayoutFlag();
    scheduleHomeBackgroundReset();
  });
})();`;
export const metadata = {
  title: "SotsiaalAI",
  description: "Platvormil on kaks rollipõhist tehisintellekti assistenti: üks sotsiaalvaldkonna spetsialistidele ja teine eluküsimusega pöördujatele.",
  manifest: `/site.webmanifest?${ICON_VERSION}`,
  icons: {
    icon: [{
      url: `/favicon-16x16.png?${ICON_VERSION}`,
      sizes: "16x16",
      type: "image/png"
    }, {
      url: `/favicon-32x32.png?${ICON_VERSION}`,
      sizes: "32x32",
      type: "image/png"
    }, {
      url: `/icons/icon-192-${ICON_VERSION}.png`,
      sizes: "192x192",
      type: "image/png"
    }, {
      url: `/icons/icon-512-${ICON_VERSION}.png`,
      sizes: "512x512",
      type: "image/png"
    }, {
      url: `/favicon.ico?${ICON_VERSION}`
    }],
    shortcut: `/icons/icon-192-${ICON_VERSION}.png`,
    apple: `/apple-touch-icon-${ICON_VERSION}.png`
  }
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#140b07" },
    { media: "(prefers-color-scheme: dark)", color: "#140b07" }
  ]
};
const MESSAGES = {
  et: () => import("@/messages/et.json"),
  ru: () => import("@/messages/ru.json"),
  en: () => import("@/messages/en.json")
};
function normalizeUiProfile(uiProfile) {
  if (uiProfile === "mac") return "mac";
  if (uiProfile === "lg" || uiProfile === "xl") return "lg";
  return "sm";
}
function normalizeTextScale(uiScale) {
  if (uiScale === "sm" || uiScale === "md" || uiScale === "lg" || uiScale === "xl") return uiScale;
  return "md";
}
function parseA11yPrefs(jar) {
  const raw = jar.get("a11y_prefs")?.value;
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    const contrast = obj?.contrast;
    // LUKUS (07.07): ainult "Hämar" (mid) avaldatud. Hele/Öö = karkass
    // (Fable 5) — cookie'sse salvestatud light/dark ei taasaktiveeru.
    return {
      uiScale: obj?.uiScale ?? obj?.textScale,
      uiProfile: obj?.uiProfile ?? obj?.screenProfile ?? obj?.uiScale ?? obj?.textScale,
      contrast,
      reduceMotion: !!obj?.reduceMotion,
      reduceTransparency: obj?.reduceTransparency == null ? !!obj?.reduceMotion : !!obj?.reduceTransparency,
      theme: contrast === "hc" ? "dark" : "mid"
    };
  } catch {
    return null;
  }
}
export default async function RootLayout({
  children
}) {
  const jar = await cookies();
  const cookieLocale = jar.get("NEXT_LOCALE")?.value;
  const locale = ["et", "ru", "en"].includes(cookieLocale || "") ? cookieLocale : "et";
  let messages = {};
  try {
    messages = (await MESSAGES[locale]()).default ?? {};
  } catch {}
  const session = await getServerSession(authConfig).catch(() => null);
  /* Session-cookie without Max-Age: the arrival flow runs once per browser
     session, independent of how long the user has been signed in. */
  const initiallyCompletedRoomArrival =
    jar.get(ROOM_ARRIVAL_COMPLETE_COOKIE)?.value === "1";
  const initialA11yPrefs = parseA11yPrefs(jar);
  const initialTheme = initialA11yPrefs?.theme || "mid";
  const initialUiProfile = normalizeUiProfile(initialA11yPrefs?.uiProfile);
  const initialTextScale = normalizeTextScale(initialA11yPrefs?.uiScale);
  return <html lang={locale} data-theme-mode={initialTheme} data-ui-scale={initialUiProfile} data-ui-profile={initialUiProfile} data-text-scale={initialTextScale} data-ui-scale-auto="0" data-contrast={initialA11yPrefs?.contrast || "normal"} data-reduce-motion={initialA11yPrefs?.reduceMotion ? "1" : "0"} data-reduce-transparency={initialA11yPrefs?.reduceTransparency ? "1" : "0"} className={`${initialTheme === "light" ? "theme-light" : initialTheme === "dark" ? "theme-dark" : "theme-mid"} ${fontExo2.variable}`.trim()} suppressHydrationWarning>
      <head>
        <meta
          name="format-detection"
          content="telephone=no, email=no, address=no, date=no"
        />
        <script
          id="app-layout-init"
          dangerouslySetInnerHTML={{ __html: LAYOUT_INIT_SCRIPT }}
        />
        {/* Toores inline <script> (mitte next/script beforeInteractive): käivitub
            parse-ajal enne esimest värvimist ja hüdrateerub 1:1 — next/script
            inline-variant renderdaks React'i kaudu käivitamatu skriptisõlme
            (React 19 "Encountered a script tag" hoiatus) + duplikaadi head'i. */}
        <script
          id="ui-scale-init"
          dangerouslySetInnerHTML={{ __html: UI_SCALE_INIT_SCRIPT }}
        />
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="app-root">
        {/* Liquid glass serva-refraktsiooni SVG-filter (#lg-bend) —
            viidatakse glass.css backdrop-filteritest */}
        <GlassFilters />
        <Providers initialLocale={locale} messages={messages} session={session} initialA11yPrefs={initialA11yPrefs}>
          <ViewportLayoutSetter />
          <ServiceWorkerRegistrar />
          <LiquidCursor />
          <SpecularHighlight />
          <SkipLink />
          <AmbientAudio />
          <RoomStage initiallyCompletedArrival={initiallyCompletedRoomArrival} />
          <main id="main" role="main" tabIndex={-1}>
            {/* Provider mähib PanelFrame'i JA lapsi: leht registreerib ⓘ sisu,
                PanelFrame'i ainus nurga-ⓘ loeb selle (components/ui/PanelInfoSlot). */}
            <PanelInfoSlotProvider>
              <PanelFrame>{children}</PanelFrame>
            </PanelInfoSlotProvider>
          </main>
        </Providers>
      </body>
    </html>;
}
