"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import AccessibilityProvider from "@/components/accessibility/AccessibilityProvider";
import I18nProvider from "@/components/i18n/I18nProvider";
import { clearStaleScrollLock } from "@/lib/scrollLock";

function RouteScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const clearIfStale = () => {
      clearStaleScrollLock();
    };
    clearIfStale();
    const timers = [80, 220, 520].map(delay => window.setTimeout(clearIfStale, delay));
    window.addEventListener("resize", clearIfStale);
    window.addEventListener("orientationchange", clearIfStale);
    window.addEventListener("pageshow", clearIfStale);
    window.addEventListener("focus", clearIfStale);
    window.visualViewport?.addEventListener("resize", clearIfStale);
    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      window.removeEventListener("resize", clearIfStale);
      window.removeEventListener("orientationchange", clearIfStale);
      window.removeEventListener("pageshow", clearIfStale);
      window.removeEventListener("focus", clearIfStale);
      window.visualViewport?.removeEventListener("resize", clearIfStale);
    };
  }, [pathname]);

  return null;
}
export default function Providers({
  children,
  initialLocale = "et",
  messages = {},
  session = null,
  initialA11yPrefs = null
}) {
  return <SessionProvider session={session} refetchOnWindowFocus={false}>
      <I18nProvider initialLocale={initialLocale} messages={messages}>
        <AccessibilityProvider initialPrefs={initialA11yPrefs}>
          <RouteScrollReset />
          {children}
        </AccessibilityProvider>
      </I18nProvider>
    </SessionProvider>;
}
