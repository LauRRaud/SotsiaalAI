"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import useT from "@/components/i18n/useT";
import InstallAppLink from "@/components/pwa/InstallAppLink";
import Button from "@/components/ui/Button";
import {
  detectPwaEnvironment,
  nextInstallSnoozeAt,
  PWA_INSTALL_CONFIRMED_KEY,
  PWA_INSTALL_SNOOZE_KEY,
  shouldShowInstallPromotion,
} from "@/lib/pwa/installExperience";

const PROMOTION_DELAY_MS = 1800;

function readSnoozedUntil() {
  try {
    return Number(window.localStorage.getItem(PWA_INSTALL_SNOOZE_KEY) || 0);
  } catch {
    return 0;
  }
}

function readInstallConfirmed() {
  try {
    return window.localStorage.getItem(PWA_INSTALL_CONFIRMED_KEY) === "1";
  } catch {
    return false;
  }
}

export default function InstallPromotion({ authenticated = false, suppressed = false }) {
  const pathname = usePathname();
  const t = useT();
  const [available, setAvailable] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [installConfirmed, setInstallConfirmed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [shownThisLoad, setShownThisLoad] = useState(false);

  useEffect(() => {
    const syncAvailability = () => {
      const displayStandalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        window.navigator?.standalone === true;
      const environment = detectPwaEnvironment({
        userAgent: navigator.userAgent || "",
        vendor: navigator.vendor || "",
        platform: navigator.userAgentData?.platform || navigator.platform || "",
        maxTouchPoints: navigator.maxTouchPoints,
      });

      setStandalone(displayStandalone);
      setAvailable(
        !displayStandalone &&
          Boolean(
            window.__deferredPWAInstallPrompt ||
              environment.isIOS ||
              environment.isMobile ||
              environment.isMacSafari
          )
      );
    };

    const onInstalled = () => {
      try {
        window.localStorage.setItem(PWA_INSTALL_CONFIRMED_KEY, "1");
      } catch {}
      setInstallConfirmed(true);
      setVisible(false);
      syncAvailability();
    };

    setSnoozedUntil(readSnoozedUntil());
    setInstallConfirmed(readInstallConfirmed());
    syncAvailability();
    window.addEventListener("pwa-install-prompt-ready", syncAvailability);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-install-prompt-ready", syncAvailability);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (shownThisLoad) return undefined;
    const eligible = shouldShowInstallPromotion({
      authenticated,
      available: available && !installConfirmed,
      pathname,
      standalone,
      suppressed,
      snoozedUntil,
    });
    if (!eligible) {
      setVisible(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setShownThisLoad(true);
      setVisible(true);
    }, PROMOTION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [authenticated, available, installConfirmed, pathname, shownThisLoad, snoozedUntil, standalone, suppressed]);

  useEffect(() => {
    if (suppressed) setVisible(false);
  }, [suppressed]);

  const dismiss = useCallback(() => {
    const next = nextInstallSnoozeAt();
    try {
      window.localStorage.setItem(PWA_INSTALL_SNOOZE_KEY, String(next));
    } catch {}
    setSnoozedUntil(next);
    setVisible(false);
  }, []);

  const handleInstallChoice = useCallback(
    (outcome) => {
      if (outcome === "accepted") {
        try {
          window.localStorage.setItem(PWA_INSTALL_CONFIRMED_KEY, "1");
        } catch {}
        setInstallConfirmed(true);
        setVisible(false);
        return;
      }
      dismiss();
    },
    [dismiss]
  );

  if (!visible) return null;

  return (
    <aside className="pwa-install-promotion" aria-labelledby="pwa-promotion-title">
      <div className="sr-only" aria-live="polite">
        {t("pwa.promotion_announcement")}
      </div>
      <div className="pwa-install-promotion-copy">
        <strong id="pwa-promotion-title">{t("pwa.promotion_title")}</strong>
      </div>
      <div className="pwa-install-promotion-actions">
        <InstallAppLink
          variant="quickIcon"
          className="pwa-install-promotion-action"
          showWhenUnavailable
          onInstallChoice={handleInstallChoice}
        >
          {t("pwa.promotion_cta")}
        </InstallAppLink>
        <Button type="button" variant="secondary" className="pwa-install-later" onClick={dismiss}>
          {t("pwa.promotion_later")}
        </Button>
      </div>
    </aside>
  );
}
