"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";
import { REGISTRATION_OPEN } from "@/lib/publicRegistration";
import Input from "@/components/ui/Input";
import AppLink from "@/components/ui/Link";
import Checkbox from "@/components/ui/Checkbox";
import Form from "@/components/ui/Form";
const MODAL_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(", ");
function focusElementWithoutScroll(element) {
  if (!element?.focus) return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function resetInputHorizontalScroll(element) {
  if (!element) return;
  const reset = () => {
    try {
      element.scrollLeft = 0;
    } catch {}
  };
  reset();
  if (typeof window !== "undefined") {
    window.requestAnimationFrame(reset);
  }
}

function renderOtpTitle(title) {
  const words = String(title || "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return title;
  const splitAt = Math.ceil(words.length / 2);
  return (
    <>
      {words.slice(0, splitAt).join(" ")}
      <br />
      {words.slice(splitAt).join(" ")}
    </>
  );
}

export default function LoginModal({
  open,
  onClose,
  suppressRedirect = false,
  onAuthSuccess,
  prefillStoredEmail = true
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    status,
    data: session
  } = useSession();
  const {
    t,
    locale
  } = useI18n();
  const resolveAuthApiMessage = useCallback((payload, fallbackKey = "auth.login.error.generic") => resolveApiMessage({
    payload,
    t,
    fallbackKey,
    fallbackText: t(fallbackKey)
  }), [t]);
  const defaultNextUrl = localizePath("/vestlus", locale);
  const toRelative = u => {
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "http://local";
      const url = new URL(u, base);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return typeof u === "string" ? u : defaultNextUrl;
    }
  };
  const nextUrl = toRelative(searchParams?.get("next") || defaultNextUrl);
  const resetRequestPath = useMemo(() => {
    const raw = String(t("routes.password_reset_path") || "").trim();
    const base = raw.startsWith("/") ? raw : "/taasta-parool";
    return localizePath(base || "/taasta-parool", locale);
  }, [locale, t]);
  const PIN_MIN = 4;
  const PIN_MAX = 8;
  const LOGIN_EMAIL_KEY = "sotsiaalai:lastLoginEmail";
  const LOGIN_KEYPAD_LAYOUT_KEY = "sotsiaalai:login:keypadLayout";
  const LOGIN_NATIVE_KEYBOARD_KEY = "sotsiaalai:login:useNativeKeyboard";
  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /Android|iPhone|iPad|iPod/i.test(ua);
  }, []);
  const [step, setStep] = useState("pin");
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [emailMask, setEmailMask] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [deviceName, setDeviceName] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [_invalidCredentials, setInvalidCredentials] = useState(false);
  /* Setterit kasutavad resetIconState/markPin* — väärtust ennast ei loeta */
  const [, setSubmitIconState] = useState("idle");
  /* E-posti väli on ALATI nähtav — ka siis, kui e-post on meeles
     (tellija 07.07: peitmis-"lahendust" ei soovita ÜLDSE; mäletatud
     aadress täidetakse nähtavasse välja eeltäidetuna) */
  const [storedEmail, setStoredEmail] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [emailErrorVisual, setEmailErrorVisual] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButtonRef = useRef(null);
  const helpPopoverRef = useRef(null);
  const [useNativeKeyboard, setUseNativeKeyboard] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const v = window.localStorage.getItem(LOGIN_NATIVE_KEYBOARD_KEY);
      if (v === "true") return true;
      if (v === "false") return false;
    } catch {}
    return false;
  });
  const [keypadLayout, setKeypadLayout] = useState(() => {
    if (typeof window === "undefined") return "phone";
    try {
      const v = window.localStorage.getItem(LOGIN_KEYPAD_LAYOUT_KEY);
      if (v === "numpad" || v === "phone") return v;
    } catch {}
    return "phone";
  });
  const boxRef = useRef(null);
  const shellRef = useRef(null);
  const emailInputRef = useRef(null);
  const hiddenInputRef = useRef(null);
  const mobilePinInputRef = useRef(null);
  const keypadRefs = useRef([]);
  const emailHintIdRef = useRef(`login-email-hint-${Math.random().toString(36).slice(2, 10)}`);
  const pinHintIdRef = useRef(`login-pin-hint-${Math.random().toString(36).slice(2, 10)}`);
  const loginCompletionStartedRef = useRef(false);
  const touchStartRef = useRef(null);
  const suppressNativeBlurSubmitRef = useRef(false);
  const zeroLongPressTimerRef = useRef(null);
  const zeroLongPressFiredRef = useRef(false);
  const timeoutIdsRef = useRef(new Set());
  const registerTimeout = useCallback((callback, delay = 0) => {
    if (typeof window === "undefined") return null;
    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);
      callback();
    }, delay);
    timeoutIdsRef.current.add(timeoutId);
    return timeoutId;
  }, []);
  const clearRegisteredTimeout = useCallback(timeoutId => {
    if (timeoutId == null || typeof window === "undefined") return;
    window.clearTimeout(timeoutId);
    timeoutIdsRef.current.delete(timeoutId);
  }, []);
  const [zeroKeyMode, setZeroKeyMode] = useState("digit");
  const isOtpStep = step === "otp";
  const hasMessage = Boolean(error || info && !isOtpStep);
  const messageText = error ? error : info && !isOtpStep ? info : "";
  const showHeaderMessage = false;
  const showPinMessage = !isOtpStep && hasMessage;
  const otpInlineError = isOtpStep && error ? error : "";
  const managedByExternalAuthSuccess =
    suppressRedirect && typeof onAuthSuccess === "function";
  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current;
    return () => {
      timeoutIds.forEach(timeoutId => {
        window.clearTimeout(timeoutId);
      });
      timeoutIds.clear();
    };
  }, []);
  const keypadKeysPhone = useMemo(() => ["1", "2", "3", "4", "5", "6", "7", "8", "9", "help", "zero", "submit"], []);
  const keypadKeysNumpad = useMemo(() => ["7", "8", "9", "4", "5", "6", "1", "2", "3", "help", "zero", "submit"], []);
  const keypadKeys = useMemo(() => {
    if (isMobile) return keypadKeysPhone;
    return keypadLayout === "numpad" ? keypadKeysNumpad : keypadKeysPhone;
  }, [isMobile, keypadLayout, keypadKeysNumpad, keypadKeysPhone]);
  const otpDeadlineLabel = useMemo(() => {
    if (!otpExpiresAt) return "";
    try {
      return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(otpExpiresAt));
    } catch {
      return "";
    }
  }, [otpExpiresAt, locale]);
  useEffect(() => {
    if (!open) {
      setHelpOpen(false);
      return;
    }
    if (step !== "pin") setHelpOpen(false);
  }, [open, step]);
  useEffect(() => {
    const root = document.documentElement;
    document.body.classList.toggle("login-modal-open", open);
    root.classList.toggle("login-modal-open", open);
    return () => {
      document.body.classList.remove("login-modal-open");
      root.classList.remove("login-modal-open");
    };
  }, [open]);
  useEffect(() => {
    if (typeof document === "undefined" || !open) return;
    const main = document.getElementById("main");
    const bg = document.querySelector("[data-bg-layer]");
    const modal = boxRef.current;
    const prevMainAriaHidden = main?.getAttribute("aria-hidden") ?? null;
    const prevMainInert = main ? Boolean(main.inert) : false;
    const prevBgAriaHidden = bg?.getAttribute("aria-hidden") ?? null;
    if (main) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && main.contains(active) && modal instanceof HTMLElement) {
        try {
          modal.focus({
            preventScroll: true
          });
        } catch {
          try {
            modal.focus();
          } catch {}
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
    if (bg) {
      bg.setAttribute("aria-hidden", "true");
    }
    return () => {
      if (main) {
        if (prevMainAriaHidden == null) {
          main.removeAttribute("aria-hidden");
        } else {
          main.setAttribute("aria-hidden", prevMainAriaHidden);
        }
        main.inert = prevMainInert;
      }
      if (bg) {
        if (prevBgAriaHidden == null) {
          bg.removeAttribute("aria-hidden");
        } else {
          bg.setAttribute("aria-hidden", prevBgAriaHidden);
        }
      }
    };
  }, [open]);
  useEffect(() => {
    if (pinLoading) setHelpOpen(false);
  }, [pinLoading]);
  useEffect(() => {
    if (!helpOpen) return;
    const onPointerDown = e => {
      const pop = helpPopoverRef.current;
      const btn = helpButtonRef.current;
      if (pop && pop.contains(e.target)) return;
      if (btn && btn.contains(e.target)) return;
      setHelpOpen(false);
    };
    const onKeyDown = e => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [helpOpen]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = e => {
      if (e.key !== "Escape") return;
      if (helpOpen) return;
      e.preventDefault();
      onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [helpOpen, onClose, open]);
  const getModalFocusableElements = useCallback(() => {
    const modal = boxRef.current;
    if (!modal) return [];
    const elements = Array.from(modal.querySelectorAll(MODAL_FOCUSABLE_SELECTOR));
    return elements.filter(el => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      if (el.hasAttribute("inert")) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = e => {
      if (e.key !== "Tab") return;
      const modal = boxRef.current;
      if (!modal) return;
      const focusable = getModalFocusableElements();
      if (focusable.length === 0) {
        e.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!modal.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [getModalFocusableElements, open]);
  const resetIconState = useCallback(() => {
    setSubmitIconState("idle");
    setInvalidCredentials(false);
  }, []);
  const markPinError = useCallback(() => {
    setSubmitIconState("error");
  }, []);
  const markPinSuccess = useCallback(() => {
    setSubmitIconState("success");
  }, []);
  const rememberKnownEmail = useCallback(email => {
    if (!prefillStoredEmail) {
      setStoredEmail("");
      setEmailValue("");
      return;
    }
    try {
      window.localStorage.setItem(LOGIN_EMAIL_KEY, email);
    } catch {}
    setStoredEmail(email);
    setEmailValue(email);
  }, [prefillStoredEmail]);
  const focusKeypadIndex = idx => {
    const list = keypadRefs.current || [];
    const el = list[idx];
    if (el && typeof el.focus === "function") {
      el.focus();
      return true;
    }
    return false;
  };
  const handleKeypadKeyDown = (e, idx) => {
    const cols = 3;
    const total = keypadKeys.length;
    const rows = Math.ceil(total / cols);
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const start = row * cols;
      const end = start + cols - 1;
      const next = idx === end ? start : idx + 1;
      focusKeypadIndex(Math.min(next, total - 1));
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const start = row * cols;
      const end = start + cols - 1;
      const next = idx === start ? end : idx - 1;
      focusKeypadIndex(Math.min(next, total - 1));
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const newRow = (row + 1) % rows;
      const next = newRow * cols + col;
      focusKeypadIndex(Math.min(next, total - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const newRow = (row - 1 + rows) % rows;
      const next = newRow * cols + col;
      focusKeypadIndex(Math.min(next, total - 1));
    }
  };
  useEffect(() => {
    if (!open) return;
    if (status === "authenticated" && session) {
      if (managedByExternalAuthSuccess) return;
      onClose?.();
      if (!suppressRedirect) {
        router.replace(nextUrl);
        router.refresh();
      }
    }
  }, [
    open,
    status,
    session,
    nextUrl,
    router,
    onClose,
    suppressRedirect,
    managedByExternalAuthSuccess
  ]);
  useEffect(() => {
    if (open) return;
    setStep("pin");
    setPinValue("");
    setPinError(false);
    setTempToken("");
    loginCompletionStartedRef.current = false;
    setStoredEmail("");
    setOtpExpiresAt(null);
    setRememberDevice(true);
    setDeviceName("");
    setEmailMask("");
    setError("");
    setInfo("");
    setPinLoading(false);
    setOtpLoading(false);
    setResendLoading(false);
    setEmailValue("");
    setEmailErrorVisual(false);
    setSubmitIconState("idle");
    setInvalidCredentials(false);
    setHelpOpen(false);
    setZeroKeyMode("digit");
  }, [open]);
  /* Mäletatud e-post eeltäidetakse NÄHTAVASSE välja — väli ise jääb
     alati ekraanile (tellija 07.07: varasem "peida kui meeles" oli
     põhjus, miks väli näis kadunud) */
  useEffect(() => {
    if (!open || isOtpStep) return;
    if (!prefillStoredEmail) {
      setStoredEmail("");
      setEmailValue("");
      if (emailInputRef.current) emailInputRef.current.value = "";
      return;
    }
    try {
      const stored = window.localStorage.getItem(LOGIN_EMAIL_KEY) || "";
      setStoredEmail(stored);
      setEmailValue(stored);
      if (emailInputRef.current) emailInputRef.current.value = stored;
    } catch {}
  }, [open, isOtpStep, prefillStoredEmail]);
  useEffect(() => {
    if (!open) return;
    if (step !== "pin") return;
    try {
      const savedLayout = window.localStorage.getItem(LOGIN_KEYPAD_LAYOUT_KEY);
      if (savedLayout === "phone" || savedLayout === "numpad") setKeypadLayout(savedLayout);
      const savedNative = window.localStorage.getItem(LOGIN_NATIVE_KEYBOARD_KEY);
      if (savedNative === "true" || savedNative === "false") {
        setUseNativeKeyboard(savedNative === "true");
      } else if (isMobile) {
        setUseNativeKeyboard(false);
      }
    } catch {
      if (isMobile) setUseNativeKeyboard(false);
    }
  }, [open, step, isMobile]);
  useEffect(() => {
    if (!open) return;
    try {
      window.localStorage.setItem(LOGIN_KEYPAD_LAYOUT_KEY, keypadLayout);
    } catch {}
  }, [open, keypadLayout]);
  useEffect(() => {
    if (!open) return;
    try {
      window.localStorage.setItem(LOGIN_NATIVE_KEYBOARD_KEY, String(useNativeKeyboard));
    } catch {}
  }, [open, useNativeKeyboard]);
  useEffect(() => {
    if (!open) return;
    if (isOtpStep) {
      registerTimeout(() => {
        focusElementWithoutScroll(boxRef.current);
        boxRef.current?.scrollTo?.({ top: 0, behavior: "auto" });
        boxRef.current
          ?.querySelector?.(".login-modal-shell")
          ?.scrollTo?.({ top: 0, behavior: "auto" });
      }, 0);
      return;
    }
    const target = emailInputRef.current;
    if (target && typeof target.focus === "function") {
      registerTimeout(() => {
        focusElementWithoutScroll(target);
        resetInputHorizontalScroll(target);
      }, 0);
    }
  }, [open, isOtpStep, registerTimeout]);
  const finishLogin = useCallback(async token => {
    if (!token) {
      markPinError();
      setError(t("auth.login.error.generic"));
      return false;
    }
    const login = await signIn("credentials", {
      temp_login_token: token,
      redirect: false,
      callbackUrl: nextUrl
    });
    if (login?.error) {
      markPinError();
      setError(t("auth.login.error.generic"));
      return false;
    }
    markPinSuccess();
    if (typeof onAuthSuccess === "function") {
      onAuthSuccess();
    }
    if (!managedByExternalAuthSuccess) {
      onClose?.();
    }
    if (!suppressRedirect) {
      router.replace(nextUrl);
      router.refresh();
    }
    return true;
  }, [
    markPinError,
    markPinSuccess,
    nextUrl,
    onAuthSuccess,
    onClose,
    router,
    suppressRedirect,
    t,
    managedByExternalAuthSuccess
  ]);
  const submitPinStep = useCallback(async () => {
    setError("");
    setInfo("");
    setPinError(false);
    setEmailErrorVisual(false);
    resetIconState();
    const emailInput = boxRef.current?.querySelector('input[name="email"]');
    const email = String(emailInput?.value || storedEmail || "").trim().toLowerCase();
    const pin = pinValue.replace(/\s+/g, "");
    if (!email) {
      markPinError();
      setPinValue("");
      setEmailErrorVisual(true);
      setError(t("auth.login.error.email_required"));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      markPinError();
      setPinValue("");
      setEmailErrorVisual(true);
      setError(t("auth.login.error.email_invalid"));
      return;
    }
    if (!pin) {
      markPinError();
      setPinError(true);
      return;
    }
    if (!new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)) {
      markPinError();
      setError(t("auth.login.error.pin_invalid", {
        min: PIN_MIN,
        max: PIN_MAX
      }));
      return;
    }
    setPinLoading(true);
    setPinValue("");
    try {
      const res = await fetch("/api/auth/login-step1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          pin,
          locale
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = String(payload?.code || "").toUpperCase();
        markPinError();
        if (code === "EMAIL_NOT_FOUND") {
          setEmailErrorVisual(true);
        }
        if (code === "PIN_INCORRECT" || code === "INVALID_CREDENTIALS") {
          rememberKnownEmail(email);
          setInvalidCredentials(true);
          setSubmitIconState("error");
        }
        setError(resolveAuthApiMessage(payload, "auth.login.error.generic"));
        return;
      }
      if (payload?.temp_login_token) setTempToken(payload.temp_login_token);
      if (payload?.status === "success" && payload?.temp_login_token) {
        rememberKnownEmail(email);
        markPinSuccess();
        await finishLogin(payload.temp_login_token);
        return;
      }
      if (payload?.status === "need_2fa" && payload?.temp_login_token) {
        rememberKnownEmail(email);
        markPinSuccess();
        setStep("otp");
        loginCompletionStartedRef.current = false;
        setEmailMask(payload.email_mask || email);
        setOtpExpiresAt(payload.otp_expires_at || null);
        setInfo(payload?.otp_reason === "trusted_device_expired" ? t("auth.login.otp_trusted_device_expired") : "");
        return;
      }
      markPinError();
      setError(resolveAuthApiMessage(payload, "auth.login.error.generic"));
    } catch (err) {
      console.error("login-step1 error", err);
      markPinError();
      setError(t("auth.login.error.generic"));
    } finally {
      setPinLoading(false);
    }
  }, [PIN_MAX, PIN_MIN, finishLogin, locale, markPinError, markPinSuccess, pinValue, rememberKnownEmail, resolveAuthApiMessage, resetIconState, storedEmail, t]);
  const handlePinInputChange = useCallback(e => {
    if (step !== "pin") return;
    const raw = typeof e?.target?.value === "string" ? e.target.value : "";
    const next = raw.replace(/\D/g, "").slice(0, PIN_MAX);
    setPinValue(next);
    resetIconState();
    setError("");
    setPinError(false);
  }, [PIN_MAX, resetIconState, step]);
  const onHiddenKeyDown = useCallback(e => {
    if (step !== "pin") return;
    const isPinFieldEvent = hiddenInputRef.current && e.target === hiddenInputRef.current;
    if (e.key === "Enter") {
      e.preventDefault();
      submitPinStep();
      return;
    }
    if (isPinFieldEvent) return;
    if (e.key === "Backspace") {
      e.preventDefault();
      setPinValue(p => p.slice(0, -1));
      resetIconState();
      setError("");
      setPinError(false);
      return;
    }
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      setPinValue(p => p.length >= PIN_MAX ? p : `${p}${e.key}`);
      resetIconState();
      setError("");
      setPinError(false);
    }
  }, [step, PIN_MAX, resetIconState, submitPinStep]);
  useEffect(() => {
    if (!open || step !== "pin") return;
    if (isMobile) return;
    const tid = registerTimeout(() => {
      const emailField = emailInputRef.current;
      if (emailField && document.activeElement === emailField) return;
      const hasEmail = emailField && emailField.value.trim().length > 0;
      if (hasEmail) hiddenInputRef.current?.focus?.();
    }, 0);
    const keyListener = e => {
      if (step !== "pin") return;
      const target = e.target;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || target?.isContentEditable;
      const isHidden = hiddenInputRef.current && target === hiddenInputRef.current;
      if (isEditable && !isHidden) return;
      if (isHidden) return;
      onHiddenKeyDown(e);
    };
    window.addEventListener("keydown", keyListener);
    return () => {
      clearRegisteredTimeout(tid);
      window.removeEventListener("keydown", keyListener);
    };
  }, [clearRegisteredTimeout, isMobile, onHiddenKeyDown, open, registerTimeout, step]);
  const appendDigit = digit => {
    if (step !== "pin") return;
    setPinValue(p => p.length >= PIN_MAX ? p : `${p}${digit}`);
    setError("");
    resetIconState();
    setPinError(false);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(8);
      } catch {}
    }
  };
  const deleteOneDigit = useCallback((emitHaptic = false) => {
    if (step !== "pin") return;
    setPinValue(p => p.slice(0, -1));
    setError("");
    resetIconState();
    setPinError(false);
    if (emitHaptic && typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(6);
      } catch {}
    }
  }, [resetIconState, step]);
  const handleBackspace = useCallback(() => {
    deleteOneDigit(true);
  }, [deleteOneDigit]);
  const handleKeypadTouchStart = e => {
    if (step !== "pin") return;
    const t0 = e.touches && e.touches[0];
    if (!t0) return;
    touchStartRef.current = {
      x: t0.clientX,
      y: t0.clientY
    };
  };
  const handleKeypadTouchEnd = e => {
    if (step !== "pin") return;
    const start = touchStartRef.current;
    if (!start) return;
    const t1 = e.changedTouches && e.changedTouches[0] || null;
    if (!t1) return;
    const dx = t1.clientX - start.x;
    const dy = t1.clientY - start.y;
    if (dx < -30 && Math.abs(dy) < 25) {
      handleBackspace();
    }
    touchStartRef.current = null;
  };
  const stopZeroHoldActions = useCallback(() => {
    if (zeroLongPressTimerRef.current) {
      clearTimeout(zeroLongPressTimerRef.current);
      zeroLongPressTimerRef.current = null;
    }
  }, []);
  const startZeroLongPress = useCallback(() => {
    if (step !== "pin") return;
    zeroLongPressFiredRef.current = false;
    stopZeroHoldActions();
    zeroLongPressTimerRef.current = setTimeout(() => {
      zeroLongPressFiredRef.current = true;
      setZeroKeyMode("backspace");
      setPinValue("");
      setError("");
      resetIconState();
      setPinError(false);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(10);
        } catch {}
      }
    }, 430);
  }, [resetIconState, step, stopZeroHoldActions]);
  const cancelZeroLongPress = useCallback(() => {
    stopZeroHoldActions();
    setZeroKeyMode("digit");
  }, [stopZeroHoldActions]);
  useEffect(() => () => {
    stopZeroHoldActions();
  }, [stopZeroHoldActions]);
  const submitOtpStep = useCallback(async () => {
    if (!tempToken) {
      setError(t("auth.login.error.generic"));
      return false;
    }
    setOtpLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login-step2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          temp_login_token: tempToken,
          remember_device: rememberDevice,
          device_name: rememberDevice ? deviceName : "",
          locale
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(resolveAuthApiMessage(payload, "auth.login.error.generic"));
        return false;
      }
      if (payload?.status === "verified") {
        return await finishLogin(payload?.temp_login_token || tempToken);
      }
      setError(resolveAuthApiMessage(payload, "auth.login.error.generic"));
      return false;
    } catch (err) {
      console.error("login-step2 error", err);
      setError(t("auth.login.error.generic"));
      return false;
    } finally {
      setOtpLoading(false);
    }
  }, [
    deviceName,
    finishLogin,
    locale,
    rememberDevice,
    resolveAuthApiMessage,
    t,
    tempToken
  ]);
  useEffect(() => {
    if (!isOtpStep || !tempToken || !open || otpLoading) return undefined;
    let stopped = false;
    let intervalId = null;

    const checkStatus = async () => {
      if (stopped || loginCompletionStartedRef.current) return;
      try {
        const res = await fetch("/api/auth/login-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            temp_login_token: tempToken,
            locale
          })
        });
        const payload = await res.json().catch(() => ({}));
        if (stopped || loginCompletionStartedRef.current) return;
        if (!res.ok) {
          setError(resolveAuthApiMessage(payload, "auth.login.error.generic"));
          return;
        }
        if (payload?.status === "verified") {
          loginCompletionStartedRef.current = true;
          setInfo(t("auth.login.email_link_verified"));
          const ok = await submitOtpStep();
          if (!ok) loginCompletionStartedRef.current = false;
        }
      } catch (err) {
        console.error("login-status error", err);
      }
    };

    checkStatus();
    intervalId = window.setInterval(checkStatus, 2000);
    return () => {
      stopped = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [
    isOtpStep,
    locale,
    open,
    otpLoading,
    resolveAuthApiMessage,
    submitOtpStep,
    t,
    tempToken
  ]);
  const handleResendOtp = async () => {
    if (!tempToken) return;
    setResendLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/login-resend-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          temp_login_token: tempToken,
          locale
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(resolveAuthApiMessage(payload, "auth.login.error.generic"));
        return;
      }
      setOtpExpiresAt(payload?.otp_expires_at || null);
      setInfo(t("auth.login.otp_resent", {
        email: payload?.email_mask || emailMask || ""
      }));
    } catch (err) {
      console.error("login-resend-otp error", err);
      setError(t("auth.login.error.generic"));
    } finally {
      setResendLoading(false);
    }
  };
  const resetToPinStep = () => {
    setStep("pin");
    setPinValue("");
    setTempToken("");
    loginCompletionStartedRef.current = false;
    setOtpExpiresAt(null);
    setInfo("");
    setError("");
    setRememberDevice(true);
    setZeroKeyMode("digit");
    resetIconState();
    setPinError(false);
  };
  /* Mäletatud e-post täidetakse otse nähtavasse välja */
  useEffect(() => {
    if (!open || !storedEmail) return;
    const node = emailInputRef.current;
    if (node && !node.value) {
      node.value = storedEmail;
      setEmailValue(storedEmail);
    }
  }, [open, storedEmail]);
  const focusMobilePinInput = useCallback(() => {
    if (!isMobile) return;
    const node = mobilePinInputRef.current;
    if (!node) return;
    const runFocus = () => {
      try {
        node.focus({
          preventScroll: true
        });
      } catch {
        try {
          node.focus();
        } catch {}
      }
      try {
        const len = (node.value || "").length;
        node.setSelectionRange?.(len, len);
      } catch {}
    };
    runFocus();
    requestAnimationFrame(runFocus);
    registerTimeout(runFocus, 80);
  }, [isMobile, registerTimeout]);
  const toggleKeypad = () => {
    if (isMobile) {
      const nextUseNativeKeyboard = !useNativeKeyboard;
      flushSync(() => setUseNativeKeyboard(nextUseNativeKeyboard));
      if (nextUseNativeKeyboard) {
        suppressNativeBlurSubmitRef.current = false;
        focusMobilePinInput();
      } else {
        try {
          suppressNativeBlurSubmitRef.current = true;
          mobilePinInputRef.current?.blur?.();
          registerTimeout(() => {
            suppressNativeBlurSubmitRef.current = false;
          }, 120);
        } catch {}
      }
      return;
    }
    setKeypadLayout(p => p === "phone" ? "numpad" : "phone");
  };
  const clearButtonFocus = useCallback(target => {
    if (!(target instanceof HTMLElement)) return;
    requestAnimationFrame(() => {
      try {
        target.blur();
      } catch {}
    });
  }, []);
  const clearPointerKeyFocus = useCallback(e => {
    clearButtonFocus(e?.currentTarget);
  }, [clearButtonFocus]);
  const triggerKeypadBounce = useCallback(target => {
    if (!(target instanceof HTMLElement)) return;
    target.classList.add("pin-keypad__button--bounce");
    target.style.animationName = "none";
    void target.offsetWidth;
    target.style.animationName = "";
  }, []);
  if (!open) return null;
  const currentEmailValue = String(
    emailInputRef.current?.value ||
      emailValue ||
      storedEmail ||
      ""
  )
    .trim()
    .toLowerCase();
  const stopInside = e => e.stopPropagation();
  const helpSubmitHint =
    locale === "en"
      ? "To sign in, press"
      : locale === "ru"
        ? "Чтобы войти, нажмите"
        : "Sisenemiseks vajuta";
  return createPortal(<>
      <div ref={boxRef} id="login-modal" tabIndex={-1} role="dialog" aria-modal="true" aria-label={isOtpStep ? t("auth.login.otp_title") : t("auth.login.title")} onClick={stopInside}>
        <div ref={shellRef} className="login-modal-shell">
          <button className="login-modal-close" onClick={onClose} aria-label={t("buttons.close")} type="button" />

          <div>
            <div className={`login-modal-title${isOtpStep ? " login-modal-title--otp" : ""}`}>
              {isOtpStep
                ? renderOtpTitle(t("auth.login.otp_title"))
                : t("auth.login.title")}
            </div>
            <div role={error ? "alert" : showHeaderMessage ? "status" : undefined} aria-live={error ? "assertive" : showHeaderMessage ? "polite" : undefined} aria-atomic="true" aria-hidden={!showHeaderMessage} hidden={!showHeaderMessage}>
              {showHeaderMessage ? messageText : null}
            </div>
          </div>

        {!isOtpStep && <Form onSubmit={e => {
        e.preventDefault();
        submitPinStep();
      }} autoComplete="off">
            <div id={emailHintIdRef.current} className="sr-only">
              {t("auth.email_icon_hint")}
            </div>
            <Input aria-label={t("profile.email")} name="username" type="email" autoComplete="username" value={currentEmailValue} readOnly tabIndex={-1} className="sr-only" />

            <div>
              {<label className="login-email-label">
                  <Input type="email" name="email" ref={emailInputRef} size="md" aria-label={t("auth.email_placeholder")} aria-describedby={emailHintIdRef.current} aria-invalid={emailErrorVisual ? "true" : "false"} placeholder={t("auth.email_placeholder")} autoComplete="username" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} onFocus={e => {
              resetInputHorizontalScroll(e.currentTarget);
            }} onMouseDown={e => {
              const node = emailInputRef.current;
              if (node && document.activeElement !== node) {
                e.preventDefault();
                node.focus();
                resetInputHorizontalScroll(node);
              }
            }} onKeyDown={e => {
              if (e.key === "Enter") e.preventDefault();
            }} onChange={e => {
              setEmailValue(e.target.value || "");
              setEmailErrorVisual(false);
              resetIconState();
              setError("");
            }} />
                </label>}
            </div>

            <div id={pinHintIdRef.current} className="sr-only">
              {t("auth.login.pin_hint")}
            </div>

            {}
            {!isMobile && <Input aria-label={t("auth.pin_placeholder")} ref={hiddenInputRef} value={pinValue} inputMode="numeric" pattern={`\\d{${PIN_MIN},${PIN_MAX}}`} maxLength={PIN_MAX} style={{ position: "fixed", left: "-10000px", top: 0, height: 1, width: 1, opacity: 0, caretColor: "transparent" }} tabIndex={-1} type="password" autoComplete="current-password" onKeyDown={onHiddenKeyDown} onInput={handlePinInputChange} onChange={handlePinInputChange} aria-describedby={pinHintIdRef.current} aria-hidden="true" />}

            {}
            {isMobile && <Input ref={mobilePinInputRef} aria-label={t("auth.pin_placeholder")} value={pinValue} inputMode="numeric" pattern={`\\d{${PIN_MIN},${PIN_MAX}}`} maxLength={PIN_MAX} type="tel" autoComplete="off" enterKeyHint="go" tabIndex={-1} aria-hidden="true" onChange={handlePinInputChange} onInput={handlePinInputChange} onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            suppressNativeBlurSubmitRef.current = true;
            registerTimeout(() => {
              suppressNativeBlurSubmitRef.current = false;
            }, 220);
            submitPinStep();
          }
        }} onBlur={() => {
          if (suppressNativeBlurSubmitRef.current) return;
          if (step !== "pin" || !isMobile || !useNativeKeyboard || pinLoading) return;
          const pin = pinValue.replace(/\s+/g, "");
          if (!new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)) return;
          registerTimeout(() => {
            if (suppressNativeBlurSubmitRef.current) return;
            if (typeof document !== "undefined" && document.activeElement === mobilePinInputRef.current) return;
            submitPinStep();
          }, 0);
        }} aria-describedby={pinHintIdRef.current} style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0.01,
          width: 2,
          height: 2,
          zIndex: 101,
          background: "transparent",
          border: "none",
          padding: 0,
          margin: 0,
          caretColor: "transparent"
        }} />}

        {!(isMobile && useNativeKeyboard) && <div aria-hidden="false" onTouchStart={handleKeypadTouchStart} onTouchEnd={handleKeypadTouchEnd} onTouchCancel={handleKeypadTouchEnd}>
                <div role="group" aria-label={t("auth.pin_placeholder")}>
                  {keypadKeys.map((key, idx) => {
              if (key === "blank") {
                return <span key={"blank-" + String(idx)} aria-hidden="true" />;
              }
              if (key === "help") {
                const label = t("auth.login.forgot");
                return <button key={"help-" + String(idx)} type="button" className="login-keypad-btn" ref={el => {
                  keypadRefs.current[idx] = el;
                  helpButtonRef.current = el;
                }} onKeyDown={e => handleKeypadKeyDown(e, idx)} onPointerDown={e => {
                  triggerKeypadBounce(e.currentTarget);
                }} onPointerUp={clearPointerKeyFocus} onPointerCancel={clearPointerKeyFocus} onClick={e => {
                  setHelpOpen(p => !p);
                  if (e.detail !== 0) clearButtonFocus(e.currentTarget);
                }} disabled={pinLoading} aria-label={label} aria-haspopup="dialog" aria-expanded={helpOpen}>
                          {t("symbols.question")}
                        </button>;
              }
              if (key === "submit") {
                const label = t("auth.login.submit");
                return <button key={"submit-" + String(idx)} type="button" className="login-keypad-btn" ref={el => keypadRefs.current[idx] = el} onKeyDown={e => {
                  handleKeypadKeyDown(e, idx);
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    submitPinStep();
                  }
                }} onPointerDown={e => {
                  triggerKeypadBounce(e.currentTarget);
                }} onPointerUp={clearPointerKeyFocus} onPointerCancel={clearPointerKeyFocus} onClick={e => {
                  submitPinStep();
                  if (e.detail !== 0) clearButtonFocus(e.currentTarget);
                }} disabled={pinLoading} aria-label={label}>
                          {/* PIN-edenemise täpid nupu ringil — iga
                              sisestatud number süütab ühe (vana
                              platvormi efekt, tellija 07.07 tagasi) */}
                          <span className="login-pin-dots" aria-hidden="true" data-error={pinError ? "1" : "0"}>
                            {Array.from({ length: PIN_MAX }, (_, i) => {
                              const a = ((-90 + i * (360 / PIN_MAX)) * Math.PI) / 180;
                              return <span key={i} data-on={i < pinValue.length ? "1" : "0"} style={{
                                left: `calc(50% + ${(Math.cos(a) * 41).toFixed(2)}%)`,
                                top: `calc(50% + ${(Math.sin(a) * 41).toFixed(2)}%)`
                              }} />;
                            })}
                          </span>
                          <svg className="login-submit-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                            <path d="m9.5 6 6 6-6 6" />
                          </svg>
                        </button>;
              }
              const isZeroKey = key === "zero";
              const digitToAppend = isZeroKey ? "0" : key;
              const digitLabel = isZeroKey ? zeroKeyMode === "backspace" ? t("auth.login.clear") : t("auth.login.key", {
                digit: 0
              }) : t("auth.login.key", {
                digit: key
              });
              return <button key={key + String(idx)} type="button" className="login-keypad-btn" ref={el => keypadRefs.current[idx] = el} onKeyDown={e => handleKeypadKeyDown(e, idx)} onPointerDown={e => {
                triggerKeypadBounce(e.currentTarget);
                if (isZeroKey) startZeroLongPress();
              }} onPointerUp={e => {
                clearPointerKeyFocus(e);
                if (isZeroKey) cancelZeroLongPress();
              }} onPointerCancel={e => {
                clearPointerKeyFocus(e);
                if (isZeroKey) cancelZeroLongPress();
              }} onPointerLeave={() => {
                if (isZeroKey) cancelZeroLongPress();
              }} onClick={e => {
                if (isZeroKey && zeroLongPressFiredRef.current) {
                  zeroLongPressFiredRef.current = false;
                  setZeroKeyMode("digit");
                  if (e.detail !== 0) clearButtonFocus(e.currentTarget);
                  return;
                }
                if (isZeroKey) {
                  appendDigit(digitToAppend);
                  if (e.detail !== 0) clearButtonFocus(e.currentTarget);
                  return;
                }
                appendDigit(digitToAppend);
                if (e.detail !== 0) clearButtonFocus(e.currentTarget);
              }} disabled={pinLoading} aria-label={digitLabel}>
                        {isZeroKey ? zeroKeyMode === "backspace" ? <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
                            <path d="M13.2 7.35H5.35l2.8-2.35L7.2 4.05 3.1 8l4.1 3.95L8.15 11l-2.8-2.35h7.85z" fill="currentColor" />
                          </svg> : <span aria-hidden="true">
                            {digitToAppend}
                          </span> : key}
                      </button>;
            })}
                </div>

                {helpOpen && <div ref={helpPopoverRef} role="dialog" aria-modal="false" aria-label={t("auth.login.forgot")} className="login-help-popover">
                    <button type="button" className="login-help-close-btn" aria-label={t("buttons.close")} onClick={() => setHelpOpen(false)}>
                      {t("symbols.times")}
                    </button>

                    <div>
                      <div className="login-help-submit-hint">
                        <span>{helpSubmitHint}</span>
                        <span className="login-help-submit-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                            <path d="m9.5 6 6 6-6 6" />
                          </svg>
                        </span>
                      </div>
                      <div>
                        {t("auth.login.help_hold_zero_before")}{" "}
                        <strong>{0}</strong>{" "}
                        {t("auth.login.help_hold_zero_after")}.
                      </div>
                      <div>
                        {t("auth.login.help_wrong_pin_note")}
                      </div>

                      <AppLink href={resetRequestPath} variant="brand" onClick={() => {
                        setHelpOpen(false);
                        onClose?.();
                      }}>
                        {t("auth.login.forgot")}
                      </AppLink>
                    </div>
                  </div>}
              </div>}

            {}
            {/* Teatel on ALATI reserveeritud rida (login-pin-msg) —
                "Vale PIN." ilmumine ei venita kaarti (tellija 07.07) */}
            <div className="login-pin-msg" role={error ? "alert" : showPinMessage ? "status" : undefined} aria-live={error ? "assertive" : showPinMessage ? "polite" : undefined} aria-atomic="true" aria-hidden={!showPinMessage}>
              {showPinMessage ? messageText : null}
            </div>

            <div>
              <button type="button" className="login-keypad-toggle-link pin-layout-toggle" onClick={e => {
                toggleKeypad();
                if (e.detail !== 0) clearButtonFocus(e.currentTarget);
              }} aria-label={isMobile ? t("auth.login.toggle_keypad_mobile_aria") : t("auth.login.toggle_keypad_desktop_aria")}>
                {t("auth.login.toggle_keypad")}
              </button>
            </div>
          </Form>}

        {isOtpStep && <Form className="login-otp-content" onSubmit={e => {
        e.preventDefault();
      }}>
            <div className="login-otp-copy">
                {info && <p role="status">
                    {info}
                  </p>}
                <p>
                  {t("auth.login.otp_description", {
                email: emailMask || ""
              })}
                </p>
                <p>
                  {t("auth.login.otp_spam_hint")}
                </p>
                {otpDeadlineLabel && <p id="otp-deadline">
                    {t("auth.login.otp_expires", {
                time: otpDeadlineLabel
              })}
                  </p>}
                <p className="login-otp-waiting" role="status">
                  {otpLoading ? t("auth.login.email_link_completing") : t("auth.login.email_link_waiting")}
                </p>
            </div>

            {otpInlineError ? <p id="otp-inline-error" role="alert">
                {otpInlineError}
              </p> : null}

            <div>
              <Checkbox
                id="remember-device"
                name="remember-device"
                checked={rememberDevice}
                onChange={next => setRememberDevice(next)}
                label={t("auth.login.remember_device")}
              />
            </div>
            {rememberDevice ? (
              <div>
                <Input
                  id="trusted-device-name"
                  type="text"
                  name="trusted-device-name"
                  autoComplete="off"
                  maxLength={60}
                  value={deviceName}
                  onChange={e => setDeviceName(e.target.value)}
                  placeholder={t("auth.login.device_name_placeholder")}
                  aria-label={t("auth.login.device_name_label")}
                />
              </div>
            ) : null}

            <div>
              <div className="login-otp-actions">
                <button
                  type="button"
                  className="login-otp-action-link"
                  onPointerUp={clearPointerKeyFocus}
                  onPointerCancel={clearPointerKeyFocus}
                  onClick={e => {
                    handleResendOtp();
                    if (e.detail !== 0) clearButtonFocus(e.currentTarget);
                  }}
                  disabled={resendLoading}
                >
                  {resendLoading ? t("auth.login.resending") : t("auth.login.resend")}
                </button>
                <button
                  type="button"
                  className="login-otp-action-link"
                  onPointerUp={clearPointerKeyFocus}
                  onPointerCancel={clearPointerKeyFocus}
                  onClick={e => {
                    resetToPinStep();
                    if (e.detail !== 0) clearButtonFocus(e.currentTarget);
                  }}
                >
                  {t("auth.login.otp_back")}
                </button>
              </div>
            </div>
          </Form>}

        {!isOtpStep ? (
          <div className="login-register-row">
            {REGISTRATION_OPEN ? (
              <a
                className="login-register-link"
                href={localizePath("/registreerimine", locale)}
              >
                {t("auth.login.register_link")}
              </a>
            ) : (
              /* T10 E3: suletud seis samast tõeallikast mis server; selgitus
                 on nähtav tekst, mitte ainult title-tooltip. */
              <span className="login-register-link" role="note">
                {t("auth.login.register_link_closed")}
                <span className="login-register-closed-note">
                  {t("auth.register.closed_notice")}
                </span>
              </span>
            )}
          </div>
        ) : null}

        </div>
      </div>
    </>, document.body);
  }
