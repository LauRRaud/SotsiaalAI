"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import useT from "@/components/i18n/useT";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  detectPwaEnvironment,
  shouldUseNativeInstallPrompt,
} from "@/lib/pwa/installExperience";

function InstallHintIcon({ children }) {
  return (
    <span aria-hidden="true">
      {children}
    </span>
  );
}

function ShareIcon() {
  return (
    <InstallHintIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 14.8V3.7" />
        <path d="M8.15 7.55 12 3.7l3.85 3.85" />
        <path d="M5.25 8.95v9.25a2.2 2.2 0 0 0 2.2 2.2h9.1a2.2 2.2 0 0 0 2.2-2.2V8.95" />
      </svg>
    </InstallHintIcon>
  );
}

function MoreIcon() {
  return (
    <InstallHintIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 8.5 12 16l7.5-7.5" />
      </svg>
    </InstallHintIcon>
  );
}

function AddToHomeIcon() {
  return (
    <InstallHintIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="3.5" width="17" height="17" rx="3.4" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    </InstallHintIcon>
  );
}

function InstallInlineToken({ children }) {
  return (
    <span>
      {children}
    </span>
  );
}

function InstallHintSteps({ items }) {
  return (
    <ol>
      {items.map((item, index) => (
        <li key={index}>
          <span>
            {index + 1}.
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

export default function InstallAppLink({
  variant = "list",
  heading,
  className,
  mobilePopoverPreferAbove = false,
  installTarget = "auto",
  ariaLabel,
  tabIndex,
  showWhenUnavailable = false,
  allowDesktopInstructions = true,
  showInstalledState = false,
  onAvailabilityChange,
  onInstallChoice,
  children
}) {
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(false);
  const [isMacSafari, setIsMacSafari] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpPopoverPlacement, setHelpPopoverPlacement] = useState(null);
  const triggerRef = useRef(null);
  const helpPopoverRef = useRef(null);

  const t = useT();
  const { locale } = useI18n();
  const resolvedHeading = heading || t("pwa.heading");
  const installCtaMobile = t("pwa.cta_mobile");
  const installCtaDesktop = t("pwa.cta_desktop");
  const iosHint = t("pwa.instructions.ios");
  const androidHint = t("pwa.instructions.android");
  const iosOtherBrowserHint = t("pwa.instructions.ios_other_browser");
  const macHint = t("pwa.instructions.mac");
  const desktopHint = t("pwa.instructions.desktop");
  const desktopHintNode = <span>{isMacSafari ? macHint : desktopHint}</span>;

  const iosHintNode = locale === "et" ? (
    <InstallHintSteps
      items={[
        <>
          {t("pwa.instructions.ios_steps.step_1_prefix")}{" "}
          <InstallInlineToken>
            <span>&quot;{t("pwa.instructions.ios_steps.share_label")}</span>
            <ShareIcon />
            <span>&quot;</span>
          </InstallInlineToken>
        </>,
        <>
          {t("pwa.instructions.ios_steps.step_2_prefix")}{" "}
          <InstallInlineToken>
            <span>&quot;{t("pwa.instructions.ios_steps.more_label")}</span>
            <MoreIcon />
            <span>&quot;</span>
          </InstallInlineToken>
        </>,
        <>
          {t("pwa.instructions.ios_steps.step_3_prefix")}{" "}
          <InstallInlineToken>
            <span>&quot;{t("pwa.instructions.ios_steps.add_home_label")}</span>
            <AddToHomeIcon />
            <span>&quot;</span>
          </InstallInlineToken>
        </>
      ]}
    />
  ) : iosHint;
  const androidHintNode = locale === "et" ? (
    <InstallHintSteps
      items={[
        <>
          {t("pwa.instructions.android_steps.step_1_prefix")} &quot;{t("pwa.instructions.android_steps.menu_label")}&quot;
        </>,
        <>
          {t("pwa.instructions.android_steps.step_2_prefix")} &quot;{t("pwa.instructions.android_steps.add_home_label")} {" "}<AddToHomeIcon />&quot;
        </>
      ]}
    />
  ) : androidHint;
  const mobileHintNode = isIOS
    ? isIOSSafari
      ? iosHintNode
      : iosOtherBrowserHint
    : androidHintNode;

  useEffect(() => {
    if (!helpOpen) return;

    const onPointerDown = (event) => {
      const pop = helpPopoverRef.current;
      const trigger = triggerRef.current;
      if (pop?.contains(event.target)) return;
      if (trigger?.contains(event.target)) return;
      setHelpOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") setHelpOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [helpOpen]);

  useLayoutEffect(() => {
    if (!helpOpen || variant === "station" || typeof window === "undefined") {
      setHelpPopoverPlacement(null);
      return undefined;
    }

    const updatePlacement = () => {
      const trigger = triggerRef.current;
      const popover = helpPopoverRef.current;
      if (!trigger || !popover) return;

      const margin = 12;
      const gap = 10;
      const rect = trigger.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(popRect.width || 0, viewportWidth - margin * 2);
      const centerX = rect.left + rect.width / 2;
      const left = Math.min(
        Math.max(centerX, margin + width / 2),
        viewportWidth - margin - width / 2
      );
      const spaceBelow = viewportHeight - rect.bottom - gap - margin;
      const spaceAbove = rect.top - gap - margin;
      const fitsBelow = spaceBelow >= popRect.height;
      const fitsAbove = spaceAbove >= popRect.height;
      const shouldPreferAbove =
        mobilePopoverPreferAbove &&
        (window.matchMedia?.("(max-width: 768px)")?.matches || isIOS);
      const placeAbove =
        shouldPreferAbove ? (fitsAbove || spaceAbove > 0) : (!fitsBelow && (fitsAbove || spaceAbove > spaceBelow));
      const top = placeAbove
        ? Math.max(rect.top - gap - popRect.height, margin)
        : Math.min(rect.bottom + gap, viewportHeight - margin - popRect.height);

      setHelpPopoverPlacement({
        top,
        left,
        width
      });
    };

    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(updatePlacement);
    });

    const onScroll = () => {
      window.requestAnimationFrame(updatePlacement);
    };
    const onResize = () => {
      window.requestAnimationFrame(updatePlacement);
    };

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [helpOpen, isIOS, mobilePopoverPreferAbove, variant]);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);

    try {
      const ua = navigator.userAgent || "";
      const vendor = navigator.vendor || "";
      const platform =
        navigator.userAgentData?.platform || navigator.platform || "";
      const environment = detectPwaEnvironment({
        userAgent: ua,
        vendor,
        platform,
        maxTouchPoints: navigator.maxTouchPoints,
      });

      setIsIOS(environment.isIOS);
      setIsIOSSafari(environment.isIOSSafari);
      setIsMacSafari(environment.isMacSafari);
      setIsMobileDevice(environment.isMobile);
    } catch {}

    const syncStoredPrompt = () => {
      const existing =
        typeof window !== "undefined" ? window.__deferredPWAInstallPrompt : undefined;
      if (existing) {
        setDeferredPrompt(existing);
        setCanInstall(true);
      }
    };
    syncStoredPrompt();

    const onBeforeInstall = e => {
      if (!e.defaultPrevented) e.preventDefault();
      try {
        window.__deferredPWAInstallPrompt = e;
      } catch {}
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    const onInstalled = () => {
      try {
        window.__deferredPWAInstallPrompt = null;
      } catch {}
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("pwa-install-prompt-ready", syncStoredPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("pwa-install-prompt-ready", syncStoredPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const installAvailable =
    !isStandalone &&
    Boolean(
      canInstall ||
        isIOS ||
        isMobileDevice ||
        (allowDesktopInstructions && isMacSafari)
    );

  useEffect(() => {
    onAvailabilityChange?.({
      available: installAvailable,
      isIOS,
      isStandalone,
    });
  }, [installAvailable, isIOS, isStandalone, onAvailabilityChange]);

  const handleClick = useCallback(
    async e => {
      e.preventDefault();
      const isMobile =
        installTarget === "mobile"
          ? true
          : installTarget === "desktop"
            ? false
            : isMobileDevice || isIOS;

      if (shouldUseNativeInstallPrompt({ deferredPrompt, isIOS })) {
        deferredPrompt.prompt();
        let outcome = "dismissed";
        try {
          const choice = await deferredPrompt.userChoice;
          outcome = choice?.outcome || outcome;
        } finally {
          try {
            window.__deferredPWAInstallPrompt = null;
          } catch {}
          setDeferredPrompt(null);
          setCanInstall(false);
          onInstallChoice?.(outcome);
        }
        return;
      }

      if (isMobile) {
        setHelpOpen((current) => !current);
        return;
      }

      if (!allowDesktopInstructions) return;

      const message = isMobile
        ? isIOS
          ? iosHint
          : androidHint
        : isMacSafari
          ? macHint
          : desktopHint;

      if (message) {
        setHelpOpen((current) => !current);
      }
    },
    [
      androidHint,
      deferredPrompt,
      desktopHint,
      iosHint,
      isIOS,
      isMobileDevice,
      isMacSafari,
      installTarget,
      allowDesktopInstructions,
      macHint,
      onInstallChoice,
    ]
  );

  const keepInstalledState = showInstalledState || variant === "station";
  if (isStandalone) {
    if (!keepInstalledState) return null;
    return (
      <div className="pwa-install-station" data-state="installed">
        <strong>{t("pwa.installed_heading")}</strong>
        <p>{t("pwa.installed_body")}</p>
      </div>
    );
  }

  const shouldHideDesktopInstall =
    !showWhenUnavailable &&
    installTarget === "auto" &&
    !isMobileDevice &&
    !isIOS &&
    !canInstall;
  if (shouldHideDesktopInstall) return null;

  const isMobileInstallTarget =
    installTarget === "mobile"
      ? true
      : installTarget === "desktop"
        ? false
        : isMobileDevice || isIOS;
  const installCta = isMobileInstallTarget ? installCtaMobile : installCtaDesktop;

  const helpBody = (
    <div className="pwa-install-help-body">
      {isMobileInstallTarget ? mobileHintNode : desktopHintNode}
    </div>
  );
  const helpInline =
    helpOpen && variant === "station" ? (
      <div ref={helpPopoverRef} className="pwa-install-inline-help" role="status">
        {helpBody}
      </div>
    ) : null;
  const helpPopover =
    helpOpen && variant !== "station" && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={helpPopoverRef}
            className="pwa-install-help"
            role="dialog"
            aria-modal="false"
            aria-label={isMobileInstallTarget ? t("pwa.cta_mobile") : t("pwa.cta_desktop")}
            style={
              helpPopoverPlacement
                ? {
                    position: "fixed",
                    top: `${helpPopoverPlacement.top}px`,
                    left: `${helpPopoverPlacement.left}px`,
                    width: `${helpPopoverPlacement.width}px`,
                    transform: "translateX(-50%)"
                  }
                : {
                    position: "fixed",
                    top: "-10000px",
                    left: "-10000px",
                    transform: "translateX(-50%)"
                  }
            }
          >
        <button
          type="button"
          className="pwa-install-help-close"
          aria-label={t("buttons.close")}
          onClick={() => setHelpOpen(false)}
        >
              {t("symbols.times")}
            </button>
            {helpBody}
          </div>,
          document.body
        )
      : null;

  if (variant === "station") {
    return (
      <div className="pwa-install-station" data-state={canInstall ? "ready" : "manual"}>
        <p className="pwa-install-station-lead">{t("pwa.fullscreen_body")}</p>
        <button
          type="button"
          ref={triggerRef}
          className="pwa-install-action"
          data-autofocus=""
          onClick={handleClick}
          aria-expanded={helpOpen || undefined}
        >
          {t("pwa.install_short")}
        </button>
        {helpInline}
      </div>
    );
  }

  if (variant === "quickIcon") {
    return (
      <>
        <button
          type="button"
          ref={triggerRef}
          className={className || "pwa-install-action"}
          onClick={handleClick}
          aria-label={ariaLabel || installCta}
          tabIndex={tabIndex}
        >
          {children || installCta}
        </button>
        {helpPopover}
      </>
    );
  }

  if (variant === "section") {
    return (
      <section className="pwa-install-section">
        <p>
          <strong>{resolvedHeading}</strong>
        </p>
        <p>
          <button type="button" className="pwa-install-action" ref={triggerRef} onClick={handleClick}>
            {installCta}
          </button>
          {helpPopover}
        </p>
      </section>
    );
  }

  if (variant === "row") {
    return (
      <span className="pwa-install-row">
        <button
          type="button"
          ref={triggerRef}
          className={className || "pwa-install-action"}
          onClick={handleClick}
        >
          {installCta}
        </button>
        {helpPopover}
      </span>
    );
  }

  return (
    <li className="pwa-install-list-item">
      <button type="button" className="pwa-install-action" ref={triggerRef} onClick={handleClick}>
        {installCta}
      </button>
      {helpPopover}
    </li>
  );
}
