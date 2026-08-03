"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import LoginModal from "@/components/LoginModal";
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider";
import ModalConfirm from "@/components/ui/ModalConfirm";
import Modal from "@/components/ui/Modal";
import { useI18n } from "@/components/i18n/I18nProvider";
import HelpListingsPanel from "@/components/chat/HelpListingsPanel";
import { getHelpUiText } from "@/components/chat/helpUiText";
import { localizePath } from "@/lib/localizePath";
import { pushWithTransition } from "@/lib/routeTransition";
import { clearStaleScrollLock } from "@/lib/scrollLock";
import { getFooterNote } from "@/lib/footerNote";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import UsageOverview from "@/components/profile/UsageOverview";
import DataExportPanel from "@/components/profile/DataExportPanel";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import Input from "@/components/ui/Input";

const CHAT_SKIP_ENTRY_SETTLE_KEY = "sotsiaalai:chat:skip-entry-settle";
const CHAT_BACK_HOVER_ARM_KEY = "sotsiaalai:chat:back-hover-arm-on-move";
const MOBILE_VIEWPORT_QUERY = "(max-width: 768px)";
const COARSE_POINTER_QUERY = "(hover: none) and (pointer: coarse)";

function detectMobileProfileMenu() {
  if (typeof window === "undefined") return false;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const uaMobile =
    Boolean(typeof navigator !== "undefined" && "userAgentData" in navigator && navigator.userAgentData?.mobile) ||
    /Android|iPhone|iPad|iPod|Windows Phone|IEMobile|Opera Mini|Mobile/i.test(ua);
  const matchWidth = window.matchMedia?.(MOBILE_VIEWPORT_QUERY)?.matches;
  const matchCoarse = window.matchMedia?.(COARSE_POINTER_QUERY)?.matches;
  return Boolean(uaMobile || matchWidth || matchCoarse || window.innerWidth <= 768);
}

const ROLE_SHORT_KEYS = {
  ADMIN: "profile.role_short.admin",
  SOCIAL_WORKER: "profile.role_short.worker",
  SERVICE_PROVIDER: "profile.role_short.provider",
  CLIENT: "profile.role_short.client"
};

function normalizeProfileRole(value, fallback = "CLIENT") {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "ADMIN") return "ADMIN";
  if (normalized === "SOCIAL_WORKER") return "SOCIAL_WORKER";
  if (normalized === "SERVICE_PROVIDER") return "SERVICE_PROVIDER";
  if (normalized === "CLIENT") return "CLIENT";
  return fallback;
}

function ProfileShell({
  locale,
  children,
  role = "region",
  ariaLabelledby,
  ariaLabel,
  innerRef,
  embedded = false,
  footerNote
}) {
  return (
    <div role={role} aria-labelledby={ariaLabelledby} aria-label={ariaLabel} ref={innerRef} lang={embedded ? locale : undefined}>
      {children}
      {footerNote ? (
        <footer>
          <span>{footerNote}</span>
        </footer>
      ) : null}
    </div>
  );
}

export default function ProfiilBody({
  initialProfile = null,
  embedded = false,
  isActive = true,
  onBack
}) {
  const router = useRouter();
  const {
    data: session,
    status
  } = useSession();
  const {
    prefs,
    setPrefs,
    openModal: openA11y
  } = useAccessibility();
  const {
    t,
    locale
  } = useI18n();
  const footerNote = getFooterNote();
  const initialProfileUser = initialProfile?.user && typeof initialProfile.user === "object"
    ? initialProfile.user
    : initialProfile && typeof initialProfile === "object"
      ? initialProfile
      : null;
  const [profileUser, setProfileUser] = useState(initialProfileUser);
  const [_hasPassword, setHasPassword] = useState(!!initialProfileUser?.hasPassword);
  const [showDelete, setShowDelete] = useState(false);
  const [showDeleteChoice, setShowDeleteChoice] = useState(false);
  const [deletePin, setDeletePin] = useState("");
  const [loading, setLoading] = useState(!initialProfile);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletionOutcome, setDeletionOutcome] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [loggingOutEverywhere, setLoggingOutEverywhere] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [showLogoutAll, setShowLogoutAll] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  // Keep the first render deterministic for SSR hydration; reconcile on mount.
  const [isMobileProfileMenu, setIsMobileProfileMenu] = useState(false);
  const [profileHelpPanel, setProfileHelpPanel] = useState(null);
  const [profileHelpPanelClosing, setProfileHelpPanelClosing] = useState(false);
  const [profileHelpPanelState, setProfileHelpPanelState] = useState({
    items: [],
    nextOffset: null,
    loading: false,
    error: ""
  });
  const helpUi = useMemo(() => getHelpUiText(t), [t]);
  const profileHelpPanelCloseTimerRef = useRef(null);
  useEffect(() => {
    clearStaleScrollLock();
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateViewport = () => {
      setIsMobileProfileMenu(detectMobileProfileMenu());
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);
  const searchParams = useSearchParams();
  const registrationReason = searchParams?.get("reason");
  /* Karusselli "Konto seaded" kaart avab /profiil?sektsioon=konto —
     siis näitab paneel AINULT kontotoiminguid (mitte legacy-menüüd,
     mille sihtkohad on karussellis juba eraldi kaartidena). */
  const kontoSection =
    String(searchParams?.get("sektsioon") || "").trim() === "konto";
  const usageSection =
    String(searchParams?.get("sektsioon") || "").trim() === "kasutus";
  /* Konto-pere ⓘ: selgitused elavad info-lehel, mitte vormis. Marsruudi-
     kaart PanelFrame'is seda ei kata — /profiil eristub ainult ?sektsioon
     väärtuse poolest. ÜKS kutse kahe asemel: kaks `usePanelInfoSlot`-i
     kirjutaksid sama slot'i ja järjekord otsustaks võitja — siin otsustab
     sektsioon, mis on niikuinii üksteist välistav. */
  usePanelInfoSlot({
    infoId: kontoSection ? "account_settings" : usageSection ? "usage" : null,
    active: kontoSection || usageSection
  });
  const isAuthed = status === "authenticated" || !!session?.user;
  const currentTheme = prefs?.theme === "light" ? "light" : "dark";
  const isHighContrast = prefs?.contrast === "hc";
  const currentMode = isHighContrast ? "hc" : currentTheme;
  const actualRole = normalizeProfileRole(
    profileUser?.role || session?.user?.role || (session?.user?.isAdmin ? "ADMIN" : "CLIENT"),
    session?.user?.isAdmin ? "ADMIN" : "CLIENT"
  );
  const roleLabel = t(ROLE_SHORT_KEYS[actualRole] || "profile.role_short.unknown");
  const trustedDevices = Array.isArray(profileUser?.trustedDevices)
    ? profileUser.trustedDevices
    : [];
  const trustedDeviceNames = trustedDevices
    .map((device, index) => device?.name || t("profile.devices.item", { number: index + 1 }))
    .filter(Boolean)
    .join(", ");
  const currentTrustedDeviceIndex = trustedDevices.findIndex((device) => device?.isCurrentDevice);
  const currentTrustedDevice =
    currentTrustedDeviceIndex >= 0 ? trustedDevices[currentTrustedDeviceIndex] : null;
  const currentDeviceName =
    currentTrustedDevice?.name ||
    (currentTrustedDevice ? t("profile.devices.item", { number: currentTrustedDeviceIndex + 1 }) : "");
  const profileContainerRef = useRef(null);
  useEffect(() => () => {
    if (profileHelpPanelCloseTimerRef.current) {
      window.clearTimeout(profileHelpPanelCloseTimerRef.current);
      profileHelpPanelCloseTimerRef.current = null;
    }
  }, []);
  useEffect(() => {
    if (status !== "unauthenticated") return;
    if (embedded && !isActive) return;
    setLoginOpen(true);
  }, [embedded, isActive, status]);
  useEffect(() => {
    if (embedded && !isActive) setLoginOpen(false);
  }, [embedded, isActive]);
  const modeSequence = ["light", "dark", "hc"];
  const currentModeIndex = modeSequence.indexOf(currentMode);
  const nextMode = modeSequence[(currentModeIndex + 1 + modeSequence.length) % modeSequence.length];
  const nextModeLabel = t(`profile.theme_mode.${nextMode}`);
  const handleModeSwitch = useCallback(() => {
    setPrefs?.({
      theme: nextMode === "hc" ? "dark" : nextMode,
      contrast: nextMode === "hc" ? "hc" : "normal"
    });
  }, [nextMode, setPrefs]);
  const shouldReduceMotion = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      if (document?.documentElement?.dataset?.reduceMotion === "1") return true;
      return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    } catch {
      return false;
    }
  }, []);
  const closeProfileHelpPanel = useCallback(() => {
    if (profileHelpPanelClosing) return;
    if (profileHelpPanelCloseTimerRef.current) {
      window.clearTimeout(profileHelpPanelCloseTimerRef.current);
      profileHelpPanelCloseTimerRef.current = null;
    }
    const finishClose = () => {
      setProfileHelpPanelClosing(false);
      setProfileHelpPanel(null);
      setProfileHelpPanelState({
        items: [],
        nextOffset: null,
        loading: false,
        error: ""
      });
    };
    if (shouldReduceMotion()) {
      finishClose();
      return;
    }
    setProfileHelpPanelClosing(true);
    profileHelpPanelCloseTimerRef.current = window.setTimeout(() => {
      finishClose();
      profileHelpPanelCloseTimerRef.current = null;
    }, 540);
  }, [profileHelpPanelClosing, shouldReduceMotion]);
  const loadProfileHelpPanel = useCallback(async (panelConfig, options = {}) => {
    if (!panelConfig) return;
    const append = options?.append === true;
    const requestedOffset = Number(options?.offset);
    const offset = append
      ? (Number.isFinite(requestedOffset) ? requestedOffset : 0)
      : 0;

    setProfileHelpPanelState(prev => ({
      ...prev,
      loading: true,
      error: append ? prev.error : ""
    }));

    try {
      const search = new URLSearchParams({
        kind: panelConfig.kind,
        scope: "mine",
        status: "OPEN",
        locale,
        limit: "10"
      });
      if (offset > 0) search.set("offset", String(offset));
      const response = await fetch(`/api/help/listings?${search.toString()}`, {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(helpUi.loadFailed);
      }
      setProfileHelpPanelState(prev => ({
        items: append ? [...prev.items, ...(payload?.items || [])] : (payload?.items || []),
        nextOffset: payload?.nextOffset ?? null,
        loading: false,
        error: ""
      }));
    } catch (err) {
      setProfileHelpPanelState(prev => ({
        ...prev,
        loading: false,
        error: err?.message || helpUi.loadFailed
      }));
    }
  }, [helpUi.loadFailed, locale]);
  useEffect(() => {
    if (!profileHelpPanel) return;
    void loadProfileHelpPanel(profileHelpPanel);
  }, [loadProfileHelpPanel, profileHelpPanel]);
  const navigateFromOrbit = useCallback(path => {
    const href = localizePath(path, locale);
    const navigate = () => {
      pushWithTransition(router, href);
    };
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(navigate);
      return;
    }
    navigate();
  }, [locale, router]);
  const menuItems = useMemo(() => [{
    key: "theme",
    label: nextModeLabel,
    onClick: handleModeSwitch
  }, {
    key: "pin",
    label: t("profile.change_password_cta"),
    onClick: () => navigateFromOrbit(isMobileProfileMenu ? "/uuenda-pin?return=profile&orbit=1" : `/uuenda-pin${embedded ? "?return=profile" : ""}`)
  }, {
    key: "email",
    label: t("profile.update_email_cta"),
    onClick: () => navigateFromOrbit(isMobileProfileMenu ? "/uuenda-epost?return=profile&orbit=1" : `/uuenda-epost${embedded ? "?return=profile" : ""}`)
  }, {
    key: "account",
    label: t("profile.account_settings"),
    onClick: () => {
      setError("");
      setShowAccountSettings(true);
    }
  }, {
    key: "usage",
    label: t("profile.usage.title"),
    onClick: () => setShowUsage(true)
  }, {
    key: "sharings",
    label: t("profile.my_sharings"),
    onClick: () => navigateFromOrbit("/minu-jagamised")
  }, {
    key: "subscription",
    label: t("profile.manage_subscription"),
    onClick: () => navigateFromOrbit(isMobileProfileMenu ? "/tellimus?return=profile&orbit=1" : `/tellimus${embedded ? "?return=profile" : ""}`)
  }, {
    key: "preferences",
    label: t("profile.preferences.title"),
    onClick: () => {
      openA11y?.();
    }
  }], [embedded, handleModeSwitch, isMobileProfileMenu, navigateFromOrbit, nextModeLabel, openA11y, t]);
  const handleBack = useCallback(() => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }
    try {
      window.sessionStorage.setItem(CHAT_SKIP_ENTRY_SETTLE_KEY, "1");
      window.sessionStorage.setItem(CHAT_BACK_HOVER_ARM_KEY, "1");
    } catch {}
    pushWithTransition(router, localizePath("/vestlus", locale));
  }, [locale, onBack, router]);
  const handleLogout = async () => {
    if (loggingOut) return;
    setError("");
    setLoggingOut(true);
    try {
      await signOut({
        callbackUrl: localizePath("/", locale)
      });
    } catch (err) {
      console.error("profile logout", err);
      setError(t("profile.server_unreachable"));
    } finally {
      setLoggingOut(false);
    }
  };
  const handleLogoutAll = async () => {
    if (loggingOutEverywhere) return;
    setError("");
    setLoggingOutEverywhere(true);
    try {
      const res = await fetch("/api/profile/logout-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale
        },
        body: JSON.stringify({ locale })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(resolveApiMessage({
          payload,
          t,
          fallbackKey: "profile.logout_all_failed"
        }));
        return;
      }
      setShowLogoutAll(false);
      await signOut({
        callbackUrl: localizePath("/", locale)
      });
    } catch (err) {
      console.error("profile logout-all", err);
      setError(t("profile.logout_all_failed"));
    } finally {
      setLoggingOutEverywhere(false);
    }
  };
  useEffect(() => {
    if (embedded && !isActive) return;
    if (status === "loading") return;
    if (status !== "authenticated") {
      setProfileUser(null);
      setLoading(false);
      setLoadFailed(false);
      return;
    }
    if (initialProfile) {
      setProfileUser(initialProfileUser);
      setHasPassword(!!initialProfileUser?.hasPassword);
      setLoadFailed(false);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoadFailed(false);
        const res = await fetch("/api/profile", {
          cache: "no-store"
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(payload?.error || payload?.message || t("profile.load_failed"));
          setLoadFailed(true);
          return;
        }
        setProfileUser(payload?.user || null);
        setHasPassword(!!payload?.user?.hasPassword);
      } catch (err) {
        console.error("profile GET", err);
        setError(t("profile.server_unreachable"));
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [embedded, initialProfile, initialProfileUser, isActive, status, t]);
  if (deletionOutcome) {
    return <ProfileShell locale={locale} embedded={embedded} ariaLabel={t("profile.title")} footerNote={footerNote}>
        <div role="status" aria-live="polite">
          <h1>{t(deletionOutcome === "pending" ? "profile.delete_pending_title" : "profile.delete_done_title")}</h1>
          <p>{t(deletionOutcome === "pending" ? "profile.delete_pending_body" : "profile.delete_done_body")}</p>
          <div>
            <Button type="button" variant="primary" onClick={() => { window.location.href = localizePath("/", locale); }}>
              <span>{t("profile.delete_continue")}</span>
            </Button>
          </div>
        </div>
      </ProfileShell>;
  }
  if (isAuthed && (status === "loading" && !initialProfile || loading)) {
    /* Laadimisel EI tohi kest tühi olla. PanelFrame'i ootamisvärav laseb
       akna lahti hiljemalt 450 ms pärast, profiilipäring kestab kauem —
       sisuta kest tähendas, et ekraanile jäi seletamatu tühi kastike
       (omanik 26.07: „kui lehte laeb, siis on need lehed väga imelikud ja
       väikesed"). Nüüd ütleb aken ausalt, et ta laeb. */
    return (
      <ProfileShell locale={locale} embedded={embedded} ariaLabel={t("profile.title")} footerNote={footerNote}>
        <p className="konto-identity" role="status">{t("profile.loading")}</p>
      </ProfileShell>
    );
  }
  if (!isAuthed) {
    const reason = registrationReason || "not-logged-in";
    const reasonText = reason === "no-sub" ? t("profile.login_to_manage_sub") : t("profile.login_to_view");
    return <>
        <ProfileShell locale={locale} embedded={embedded} ariaLabel={t("profile.title")} footerNote={footerNote}>
          <p>{reasonText}</p>
          <div>
            <BackButton
              onClick={embedded ? handleBack : () => setLoginOpen(true)}
              ariaLabel={embedded ? t("profile.back_to_chat") : t("auth.login.title")}
            />
          </div>
        </ProfileShell>

        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </>;
  }
  if (loadFailed) {
    return <ProfileShell locale={locale} ariaLabel={t("profile.title")} embedded={embedded} footerNote={footerNote}>
        <div>
          <div role="alert">
            {error || t("profile.load_failed")}
          </div>
        </div>
      </ProfileShell>;
  }
  return <ProfileShell locale={locale} ariaLabel={t("profile.title")} innerRef={profileContainerRef} embedded={embedded} footerNote={footerNote}>
      {kontoSection ? (
        <>
          <h1 className="konto-title">{t("profile.account_settings")}</h1>
          <p className="konto-identity">
            {roleLabel}
            {profileUser?.email ? ` · ${profileUser.email}` : ""}
          </p>
          <DataExportPanel active={isActive} />
          {/* Iga toiming on ÜKS rida: mida ta teeb (vasakul, ühelt joonelt
              loetav lause) ja nupp (paremal). Vana virn pani nupu ja tema
              seletuse teineteise alla keskele — omanik 26.07. */}
          <section className="konto-card" aria-label={t("profile.account_settings")}>
            <div className="konto-row">
              <p className="konto-hint konto-row__text">
                {currentDeviceName
                  ? t("profile.logout_hint_device", { device: currentDeviceName })
                  : t("profile.logout_hint")}
              </p>
              <Button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut || loggingOutEverywhere || deleting}
              >
                {t("profile.logout")}
              </Button>
            </div>
            <div className="konto-row">
              <p className="konto-hint konto-row__text">
                {trustedDeviceNames
                  ? t("profile.logout_all_hint_devices", { devices: trustedDeviceNames })
                  : t("profile.logout_all_hint")}
              </p>
              <Button
                type="button"
                onClick={() => {
                  setError("");
                  setShowLogoutAll(true);
                }}
                disabled={loggingOut || loggingOutEverywhere || deleting}
              >
                {t("profile.logout_all_devices")}
              </Button>
            </div>
            <div className="konto-row konto-row--danger">
              <p className="konto-hint konto-row__text">{t("profile.delete_account_hint")}</p>
              <Button
                type="button"
                onClick={() => {
                  setError("");
                  setDeleting(false);
                  setDeletePin("");
                  setShowDeleteChoice(true);
                }}
                disabled={loggingOut || loggingOutEverywhere || deleting}
              >
                <span>{t("profile.delete_account")}</span>
              </Button>
            </div>
          </section>
        </>
      ) : usageSection ? (
        <>
          <h1 className="konto-title">{t("profile.usage.title")}</h1>
          <UsageOverview
            onManageSubscription={() => navigateFromOrbit("/tellimus?return=profile")}
          />
        </>
      ) : (
        <>
          <div>
            <span>{roleLabel}</span>
          </div>

          <div>
            <BackButton onClick={handleBack} ariaLabel={t("profile.back_to_chat")} />
            <button type="button" onClick={handleLogout} disabled={loggingOut} aria-label={t("profile.logout")}>
              {t("profile.logout_short")}
            </button>
          </div>

          <nav aria-label={t("profile.title")}>
            <ul>
              {menuItems.map((item) => (
                <li key={item.key}>
                  <button type="button" onClick={item.onClick}>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}

      <div>
        {error && !showDelete && <div role="alert">
            {error}
          </div>}
      </div>

      {showUsage ? (
        <Modal
          open
          onClose={() => setShowUsage(false)}
          aria-label={t("profile.usage.title")}
        >
          <div className="usage-modal__header">
            <BackButton
              onClick={() => setShowUsage(false)}
              ariaLabel={t("buttons.back")}
            />
            <h2>{t("profile.usage.title")}</h2>
          </div>
          <UsageOverview
            active={showUsage}
            onManageSubscription={() => {
              setShowUsage(false);
              navigateFromOrbit(isMobileProfileMenu ? "/tellimus?return=profile&orbit=1" : `/tellimus${embedded ? "?return=profile" : ""}`);
            }}
          />
        </Modal>
      ) : null}

      {showAccountSettings ? (
        <Modal
          open
          onClose={() => setShowAccountSettings(false)}
          closeOnOverlayClick={!loggingOut && !loggingOutEverywhere && !deleting}
          aria-label={t("profile.account_settings")}
        >
          <div>
            <BackButton
              onClick={() => setShowAccountSettings(false)}
              ariaLabel={t("buttons.back")}
            />
            <div>
              <h2>{t("profile.account_settings")}</h2>
            </div>
          </div>
          <div>
              <section>
                <DataExportPanel active={showAccountSettings} />
              </section>
              <section>
                <div>
                  <Button
                    type="button"
                    onClick={async () => {
                      setShowAccountSettings(false);
                      await handleLogout();
                    }}
                    disabled={loggingOut || loggingOutEverywhere || deleting}
                  >
                    {t("profile.logout")}
                  </Button>
                  <p>
                    {currentDeviceName
                      ? t("profile.logout_hint_device", { device: currentDeviceName })
                      : t("profile.logout_hint")}
                  </p>
                </div>
              </section>
              <section>
                <div>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowAccountSettings(false);
                      setError("");
                      setShowLogoutAll(true);
                    }}
                    disabled={loggingOut || loggingOutEverywhere || deleting}
                  >
                    {t("profile.logout_all_devices")}
                  </Button>
                  <p>
                    {trustedDeviceNames
                      ? t("profile.logout_all_hint_devices", { devices: trustedDeviceNames })
                      : t("profile.logout_all_hint")}
                  </p>
                </div>
              </section>
              <section>
                <div>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowAccountSettings(false);
                      setError("");
                      setDeleting(false);
                      setDeletePin("");
                      setShowDeleteChoice(true);
                    }}
                    disabled={loggingOut || loggingOutEverywhere || deleting}
                  >
                    <span>{t("profile.delete_account")}</span>
                  </Button>
                  <p>{t("profile.delete_account_hint")}</p>
                </div>
              </section>
          </div>
        </Modal>
      ) : null}

      {showDeleteChoice ? (
        <Modal
          open
          onClose={() => setShowDeleteChoice(false)}
          aria-label={t("profile.delete_account")}
        >
          <div className="konto-delete-choice">
            <h2 className="konto-delete-choice__title">{t("profile.delete_account")}</h2>
            {/* The copy is obtained while still signed in: once deletion runs,
                access closes immediately (T02) and the ZIP can no longer be
                downloaded. This step never starts the deletion itself. */}
            <p>{t("profile.data_export.delete_choice")}</p>
            <div className="konto-delete-choice__actions">
              <Button
                type="button"
                onClick={() => {
                  setShowDeleteChoice(false);
                  setError("");
                  setShowAccountSettings(true);
                }}
              >
                {t("profile.data_export.delete_copy")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowDeleteChoice(false);
                  setError("");
                  setDeleting(false);
                  setDeletePin("");
                  setShowDelete(true);
                }}
              >
                {t("profile.data_export.delete_without_copy")}
              </Button>
              <Button type="button" onClick={() => setShowDeleteChoice(false)}>
                {t("buttons.cancel")}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
      {showDelete && <ModalConfirm message={t("profile.delete_confirm")} confirmLabel={deleting ? t("profile.deleting") : t("profile.delete_account")} cancelLabel={t("buttons.cancel")} onConfirm={async () => {
      if (deleting) return;
      setError("");
      const normalizedDeletePin = deletePin.replace(/\D/g, "");
      if (!normalizedDeletePin) {
        setError(t("profile.errors.current_pin_required"));
        return;
      }
      setDeleting(true);
      try {
        const res = await fetch("/api/profile", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            currentPassword: normalizedDeletePin,
            locale
          })
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(resolveApiMessage({
            payload,
            t,
            fallbackKey: "profile.delete_failed"
          }));
          setDeleting(false);
          return;
        }
        setDeletePin("");
        setShowDelete(false);
        // 202 = access already suspended but privacy cleanup is still queued;
        // 200 = deletion finished. End the session, then show an anonymous
        // localized confirmation. No deletionJobId or account data is surfaced.
        setDeletionOutcome(res.status === 202 ? "pending" : "done");
        await signOut({ redirect: false });
      } catch (err) {
        console.error("profile DELETE", err);
        setError(t("profile.server_unreachable"));
        setDeleting(false);
      }
    }} onCancel={() => {
      if (deleting) return;
      setDeletePin("");
      setShowDelete(false);
    }} disabled={deleting}>
        <div>
          <label htmlFor="delete-current-pin" className="sr-only">
            {t("profile.current_pin_label")}
          </label>
          <Input
            id="delete-current-pin"
            name="delete-current-pin"
            type="password"
            autoComplete="current-password"
            inputMode="numeric"
            placeholder={t("profile.current_pin_label")}
            value={deletePin}
            onChange={(e) => setDeletePin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            disabled={deleting}
            aria-describedby={error ? "profile-delete-error" : undefined}
          />
        </div>
        {error ? (
          <p id="profile-delete-error" role="alert">
            {error}
          </p>
        ) : null}
    </ModalConfirm>}
      {showLogoutAll ? (
        <ModalConfirm
          message={t("profile.logout_all_confirm")}
          confirmLabel={loggingOutEverywhere ? t("profile.logging_out_all") : t("profile.logout_all_devices")}
          cancelLabel={t("buttons.cancel")}
          onConfirm={handleLogoutAll}
          onCancel={() => {
            if (loggingOutEverywhere) return;
            setShowLogoutAll(false);
          }}
          disabled={loggingOutEverywhere}
        />
      ) : null}
      {profileHelpPanel ? (
        <HelpListingsPanel
          locale={locale}
          title={profileHelpPanel.title}
          side="right"
          items={profileHelpPanelState.items}
          loading={profileHelpPanelState.loading}
          error={profileHelpPanelState.error}
          nextOffset={profileHelpPanelState.nextOffset}
          emptyText={profileHelpPanel.emptyText}
          isClosing={profileHelpPanelClosing}
          onClose={closeProfileHelpPanel}
          onBackToProfile={closeProfileHelpPanel}
          onLoadMore={() => loadProfileHelpPanel(profileHelpPanel, { append: true, offset: profileHelpPanelState.nextOffset })}
        />
      ) : null}
    </ProfileShell>;
}
