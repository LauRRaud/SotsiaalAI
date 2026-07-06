"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useId } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import OptionCard from "@/components/ui/OptionCard";
import RichText from "@/components/i18n/RichText";
import Button from "@/components/ui/Button";
import { localizePath } from "@/lib/localizePath";
import CenteredScrollPicker from "@/components/CenteredScrollPicker";
import useSmoothWheelProxy from "@/components/ui/useSmoothWheelProxy";
import {
  WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY,
  WORKER_FRAMEWORK_REGISTER_CONTEXT_STORAGE_KEY,
  WORKER_FRAMEWORK_REVIEW_STORAGE_KEY,
  WORKER_FRAMEWORK_SIGNED_DOWNLOAD_STORAGE_KEY,
  WORKER_FRAMEWORK_VERSION,
} from "@/lib/frameworkAcceptances";
import { pushWithTransition } from "@/lib/routeTransition";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
// Funktsionaalne klass: CenteredScrollPicker kasutab ".register-step" itemSelector'ina.
const registerStepClassName = "register-step";
const isRegistrationOpen = !["false", "0", "off"].includes(
  String(process.env.NEXT_PUBLIC_REGISTRATION_OPEN || "false")
    .trim()
    .toLowerCase(),
);
const REGISTER_DRAFT_STORAGE_KEY = "sotsiaalai_register_draft";
const initialForm = {
  email: "",
  pin: "",
  role: "",
  workerUse: "",
  frameworkAck: false,
  agree: false,
  guideAck: false,
};
const REGISTER_ROLE_OPTIONS = ["CLIENT", "SOCIAL_WORKER", "SERVICE_PROVIDER"];
const PROFESSIONAL_ROLE_VALUES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER"]);

function isProfessionalRole(role) {
  return PROFESSIONAL_ROLE_VALUES.has(String(role || "").trim().toUpperCase());
}

function roleLabelKey(role) {
  const normalized = String(role || "").trim().toUpperCase();
  if (normalized === "SERVICE_PROVIDER") return "role.provider";
  if (normalized === "SOCIAL_WORKER") return "role.worker";
  return "role.client";
}

function normalizeDraftForm(draft) {
  if (!draft || typeof draft !== "object") return null;
  return {
    email: typeof draft.email === "string" ? draft.email : "",
    pin: typeof draft.pin === "string" ? draft.pin.replace(/\D/g, "").slice(0, 8) : "",
    role: REGISTER_ROLE_OPTIONS.includes(draft.role) ? draft.role : "",
    workerUse: draft.workerUse === "ORG_IDENTIFIABLE" ? "ORG_IDENTIFIABLE" : "",
    frameworkAck: draft.frameworkAck === true,
    agree: draft.agree === true,
    guideAck: draft.guideAck === true,
  };
}

function normalizeRegistrationRoleParam(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "specialist" || raw === "worker" || raw === "social_worker") {
    return "SOCIAL_WORKER";
  }
  if (raw === "provider" || raw === "service_provider" || raw === "teenuseosutaja") {
    return "SERVICE_PROVIDER";
  }
  if (raw === "client" || raw === "citizen") {
    return "CLIENT";
  }
  return "";
}

export default function RegistreerimineBody({}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const lockedRole = normalizeRegistrationRoleParam(searchParams?.get("role"));
  const isRoleLocked = Boolean(lockedRole);
  const ringRef = useRef(null);
  const scrollRef = useRef(null);
  const handleClose = () => {
    pushWithTransition(router, localizePath("/", locale));
  };
  const openFrameworkPage = (overrides = {}) => {
    if (typeof window !== "undefined") {
      const liveForm = {
        ...form,
        ...overrides,
        email: document.getElementById("email")?.value || form.email,
        pin: document.getElementById("pin")?.value || form.pin,
        role:
          document.querySelector('input[name="role"]:checked')?.value ||
          overrides.role ||
          form.role ||
          "SOCIAL_WORKER",
        agree:
          document.querySelector('input[name="agree"]')?.checked ??
          form.agree,
        guideAck:
          document.querySelector('input[name="guideAck"]')?.checked ??
          form.guideAck,
      };
      const timestamp =
        window.sessionStorage.getItem(WORKER_FRAMEWORK_REVIEW_STORAGE_KEY) ||
        new Date().toISOString();
      window.sessionStorage.setItem(
        WORKER_FRAMEWORK_REVIEW_STORAGE_KEY,
        timestamp,
      );
      setFrameworkReviewOpenedAt(timestamp);
      window.sessionStorage.setItem(WORKER_FRAMEWORK_REGISTER_CONTEXT_STORAGE_KEY, "1");
      window.sessionStorage.setItem(
        REGISTER_DRAFT_STORAGE_KEY,
        JSON.stringify({
          ...liveForm,
          role: isProfessionalRole(liveForm.role) ? liveForm.role : "SOCIAL_WORKER",
          workerUse: "ORG_IDENTIFIABLE",
        }),
      );
    }
    router.push(localizePath("/tooalase-kasutuse-raamistik", locale));
  };
  const PIN_MIN = 4;
  const PIN_MAX = 8;
  const [form, setForm] = useState(initialForm);
  const [draftReady, setDraftReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    pin: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const showSuccessState = Boolean(successMessage);
  const [frameworkReviewOpenedAt, setFrameworkReviewOpenedAt] = useState("");
  const [frameworkSignedDownloadedAt, setFrameworkSignedDownloadedAt] =
    useState("");
  const [scrollPad, setScrollPad] = useState(0);
  const [scrollPadTop, setScrollPadTop] = useState(0);
  const [scrollPadBottom, setScrollPadBottom] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasUserStartedScroll, setHasUserStartedScroll] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const initViewportModeRef = useRef(null);
  const initialScrollTopRef = useRef(0);
  const hasInitialScrollTopRef = useRef(false);
  const initialFirstStepAlignDoneRef = useRef(false);
  const roleLabelId = useId();
  const roleHintId = useId();
  const emailErrorId = useId();
  const pinErrorId = useId();
  const roleLabelText = t("auth.register.role_label_question");
  const isProfessionalUser = isProfessionalRole(form.role);
  const requiresFramework =
    isProfessionalUser && form.workerUse === "ORG_IDENTIFIABLE";
  const hasConfirmedFramework = requiresFramework && form.frameworkAck;
  const roleStepIndex = 0;
  const emailStepIndex = 1;
  const pinStepIndex = 2;
  const agreementStepIndex = 3;
  const guideStepIndex = 4;
  const workerStepIndex = 5;
  const submitStepIndex = isProfessionalUser ? 6 : 5;
  const proxyWheelToRegisterScroll = useSmoothWheelProxy({
    scrollRef,
    disabled: isMobileViewport,
    // Hiir sisu (nupud/väljad) kohal → natiivne keritav ala kerib ise;
    // proxy sekkub AINULT väljaspool keritavat ala (tellija: elementide
    // peal ei saanud alla kerida)
    passthroughNativeTargets: true,
  });

  useEffect(() => {
    if (!draftReady || !lockedRole) return;

    setForm((prev) => ({
      ...prev,
      role: lockedRole,
      workerUse: isProfessionalRole(lockedRole) ? prev.workerUse : "",
      frameworkAck: isProfessionalRole(lockedRole) ? prev.frameworkAck : false,
    }));
  }, [draftReady, lockedRole]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const nextValue =
      name === "pin"
        ? value.replace(/\D/g, "").slice(0, PIN_MAX)
        : type === "checkbox"
          ? checked
          : value;
    setForm((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(name === "role" && !isProfessionalRole(nextValue)
        ? {
            workerUse: "",
            frameworkAck: false,
          }
        : null),
      ...(name === "workerUse" && nextValue !== "ORG_IDENTIFIABLE"
        ? {
            frameworkAck: false,
          }
        : null),
    }));
    if (name === "email" || name === "pin") {
      setFieldErrors((prev) =>
        prev[name]
          ? {
              ...prev,
              [name]: "",
            }
          : prev,
      );
    }
  }
  const handleRoleSelect = (role) => {
    setForm((prev) => ({
      ...prev,
      role,
      ...(!isProfessionalRole(role)
        ? {
            workerUse: "",
            frameworkAck: false,
          }
        : null),
    }));
  };
  const handleRoleKeyDown = (event, role) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const currentIndex = Math.max(0, REGISTER_ROLE_OPTIONS.indexOf(role));
    const direction = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
    const nextIndex =
      (currentIndex + direction + REGISTER_ROLE_OPTIONS.length) % REGISTER_ROLE_OPTIONS.length;
    handleRoleSelect(REGISTER_ROLE_OPTIONS[nextIndex]);
  };
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({
      email: "",
      pin: "",
    });
    setSuccessMessage("");
    if (!isRegistrationOpen) {
      setError(t("auth.register.closed_notice"));
      return;
    }
    const email = form.email.trim().toLowerCase();
    const pin = form.pin.replace(/\D/g, "");
    const jumpToStep = (index) => {
      scrollToIndex(index);
    };
    if (!form.role) {
      setError(t("auth.register.error.role_required"));
      jumpToStep(roleStepIndex);
      return;
    }
    if (!email) {
      setFieldErrors((prev) => ({
        ...prev,
        email: t("profile.email_update.error_email_required"),
      }));
      jumpToStep(emailStepIndex);
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFieldErrors((prev) => ({
        ...prev,
        email: t("profile.email_update.error_email_invalid"),
      }));
      jumpToStep(emailStepIndex);
      return;
    }
    if (!pin) {
      setFieldErrors((prev) => ({
        ...prev,
        pin: t("profile.email_update.error_pin_required"),
      }));
      jumpToStep(pinStepIndex);
      return;
    }
    if (pin.length < PIN_MIN || pin.length > PIN_MAX) {
      setFieldErrors((prev) => ({
        ...prev,
        pin: t("profile.email_update.error_pin_length", {
          min: PIN_MIN,
          max: PIN_MAX,
        }),
      }));
      jumpToStep(pinStepIndex);
      return;
    }
    if (requiresFramework && !form.frameworkAck) {
      setError(t("auth.register.error.framework_ack_required"));
      jumpToStep(workerStepIndex);
      return;
    }
    if (!form.agree || !form.guideAck) {
      setError(t("auth.register.error.agree_required"));
      jumpToStep(!form.agree ? agreementStepIndex : guideStepIndex);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          pin,
          role: form.role,
          workerUse: form.workerUse,
          frameworkAck: form.frameworkAck,
          frameworkVersion: WORKER_FRAMEWORK_VERSION,
          frameworkReviewOpenedAt: frameworkReviewOpenedAt || null,
          frameworkSignedDownloadedAt: frameworkSignedDownloadedAt || null,
          locale,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const resolvedMessage = resolveApiMessage({
          payload,
          t,
          fallbackKey: "auth.register.error.failed",
        });
        if (
          payload?.code === "INVALID_EMAIL" ||
          payload?.code === "EMAIL_IN_USE" ||
          payload?.messageKey === "api.auth.register.invalid_email" ||
          payload?.messageKey === "api.auth.register.email_in_use"
        ) {
          setFieldErrors((prev) => ({
            ...prev,
            email: resolvedMessage,
          }));
          jumpToStep(emailStepIndex);
          return;
        }
        if (
          payload?.code === "PIN_INVALID" ||
          payload?.messageKey === "api.auth.register.pin_invalid"
        ) {
          setFieldErrors((prev) => ({
            ...prev,
            pin: resolvedMessage,
          }));
          jumpToStep(pinStepIndex);
          return;
        }
        setError(resolvedMessage);
        return;
      }
      setSuccessMessage(
        t("auth.register.success_message", {
          email,
        }),
      );
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY);
        window.sessionStorage.removeItem(WORKER_FRAMEWORK_REGISTER_CONTEXT_STORAGE_KEY);
        window.sessionStorage.removeItem(WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY);
        window.sessionStorage.removeItem(WORKER_FRAMEWORK_REVIEW_STORAGE_KEY);
        window.sessionStorage.removeItem(
          WORKER_FRAMEWORK_SIGNED_DOWNLOAD_STORAGE_KEY,
        );
      }
      setFrameworkReviewOpenedAt("");
      setFrameworkSignedDownloadedAt("");
      setForm((prev) => ({
        ...initialForm,
        role: prev.role,
      }));
      router.refresh();
    } catch (err) {
      console.error("Register error", err);
      setError(t("profile.server_unreachable"));
    } finally {
      setSubmitting(false);
    }
  }
  const {
    canScrollUp,
    canScrollDown,
    getItemClassName,
    scrollToIndex,
  } = CenteredScrollPicker({
    containerRef: scrollRef,
    itemSelector: ".register-step",
    applyItemVisibility: isMobileViewport,
    neighborDistance: isMobileViewport ? 2 : 1,
    lockWheelToSteps: false,
    settleOnScroll: false,
    applyEdgeVisibility: !isMobileViewport,
    edgeVisibilityMin: 0.06,
    enableArrowKeys: isMobileViewport,
    allowArrowKeysInInputs: true,
    captureArrowKeys: isMobileViewport,
    settleMs: isMobileViewport ? 420 : 360,
    maxStepPerSettle: isMobileViewport ? 99 : 1,
    wheelCooldownMs: isMobileViewport ? 300 : 340,
    minWheelDelta: isMobileViewport ? 10 : 16,
    manageHiddenFocus: isMobileViewport,
    pauseSettleOnInputFocus: isMobileViewport,
    pauseSettleWhileTouch: isMobileViewport,
  });
  const getRegisterStepClassName = (index) =>
    isMobileViewport ? getItemClassName(index) : "";
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawDraft = window.sessionStorage.getItem(REGISTER_DRAFT_STORAGE_KEY);
    const registerFrameworkAck =
      window.sessionStorage.getItem(WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY) === "1";
    if (rawDraft || registerFrameworkAck) {
      try {
        const parsedDraft = rawDraft ? JSON.parse(rawDraft) : null;
        const nextDraft = normalizeDraftForm(parsedDraft) || initialForm;
        setForm({
          ...initialForm,
          ...nextDraft,
          ...(registerFrameworkAck
            ? {
                role: isProfessionalRole(nextDraft.role) ? nextDraft.role : "SOCIAL_WORKER",
                workerUse: "ORG_IDENTIFIABLE",
                frameworkAck: true,
              }
            : null),
        });
      } catch {
        if (registerFrameworkAck) {
          setForm((prev) => ({
            ...prev,
            role: isProfessionalRole(prev.role) ? prev.role : "SOCIAL_WORKER",
            workerUse: "ORG_IDENTIFIABLE",
            frameworkAck: true,
          }));
        }
      }
    }
    setDraftReady(true);
    setFrameworkReviewOpenedAt(
      window.sessionStorage.getItem(WORKER_FRAMEWORK_REVIEW_STORAGE_KEY) || "",
    );
    setFrameworkSignedDownloadedAt(
      window.sessionStorage.getItem(
        WORKER_FRAMEWORK_SIGNED_DOWNLOAD_STORAGE_KEY,
      ) || "",
    );
  }, []);
  useEffect(() => {
    if (typeof window === "undefined" || showSuccessState || !draftReady) return;
    window.sessionStorage.setItem(REGISTER_DRAFT_STORAGE_KEY, JSON.stringify(form));
  }, [draftReady, form, showSuccessState]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobileViewport(query.matches);
    apply();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", apply);
      return () => query.removeEventListener("change", apply);
    }
    query.addListener(apply);
    return () => query.removeListener(apply);
  }, []);
  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || typeof window === "undefined") return;
    const updatePad = () => {
      const steps = Array.from(scrollEl.querySelectorAll(".register-step"));
      const firstStep = steps[0] || null;
      const lastStep = steps[steps.length - 1] || firstStep;
      if (!firstStep || !lastStep) return;
      const firstH = firstStep.getBoundingClientRect().height || 0;
      const lastH = lastStep.getBoundingClientRect().height || 0;
      const viewH = Math.max(0, scrollEl.clientHeight || 0);
      if (!viewH || !firstH || !lastH) return;
      const targetCenter = viewH / 2 - 5;
      const nextPadTopBase = Math.max(0, Math.floor(targetCenter - firstH / 2));
      const nextPadBottomBase = Math.max(
        0,
        Math.floor(viewH - targetCenter - lastH / 2),
      );
      const nextPad = Math.max(0, Math.floor((viewH - firstH) / 2));
      setScrollPad((prev) => (prev === nextPad ? prev : nextPad));
      setScrollPadTop((prev) => (prev === nextPadTopBase ? prev : nextPadTopBase));
      setScrollPadBottom((prev) =>
        prev === nextPadBottomBase ? prev : nextPadBottomBase,
      );
    };
    updatePad();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updatePad)
        : null;
    ro?.observe(scrollEl);
    window.addEventListener("resize", updatePad);
    return () => {
      ro?.disconnect?.();
      window.removeEventListener("resize", updatePad);
    };
  }, [isMobileViewport, isRoleLocked]);
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || typeof window === "undefined") return;
    const mode = isMobileViewport ? "mobile" : "desktop";
    if (initViewportModeRef.current === mode) return;
    initViewportModeRef.current = mode;
    initialFirstStepAlignDoneRef.current = false;
    const resetToFirstStep = () => {
      scrollEl.scrollTop = 0;
      if (isMobileViewport) {
        scrollToIndex(0, "auto");
      } else {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: "auto",
        });
      }
      setIsScrolled(false);
      setHasUserStartedScroll(false);
      hasInitialScrollTopRef.current = true;
      initialScrollTopRef.current = scrollEl.scrollTop || 0;
      initialFirstStepAlignDoneRef.current = true;
    };
    resetToFirstStep();
    const rafA = requestAnimationFrame(resetToFirstStep);
    const rafB = requestAnimationFrame(() =>
      requestAnimationFrame(resetToFirstStep),
    );
    const settleTimer = window.setTimeout(resetToFirstStep, 120);
    return () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
      window.clearTimeout(settleTimer);
    };
  }, [scrollToIndex, isMobileViewport]);
  useEffect(() => {
    if (
      !isMobileViewport ||
      hasUserStartedScroll ||
      initialFirstStepAlignDoneRef.current
    ) {
      return;
    }
    const scrollEl = scrollRef.current;
    if (!scrollEl || typeof window === "undefined") return;
    const alignToFirst = () => {
      scrollToIndex(0, "auto");
      setIsScrolled(false);
      hasInitialScrollTopRef.current = true;
      initialScrollTopRef.current = scrollEl.scrollTop || 0;
      initialFirstStepAlignDoneRef.current = true;
    };
    const raf = requestAnimationFrame(alignToFirst);
    return () => cancelAnimationFrame(raf);
  }, [scrollPadTop, scrollPadBottom, hasUserStartedScroll, scrollToIndex, isMobileViewport]);
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || typeof window === "undefined") return;
    const onScroll = () => {
      const top = scrollEl.scrollTop || 0;
      if (!hasInitialScrollTopRef.current) {
        hasInitialScrollTopRef.current = true;
        initialScrollTopRef.current = top;
      }
      const delta = Math.abs(top - initialScrollTopRef.current);
      const thresholdOn = isMobileViewport ? 14 : 8;
      const thresholdOff = isMobileViewport ? 9 : 5;
      if (delta > thresholdOn) {
        setHasUserStartedScroll((prev) => prev || true);
      }
      setIsScrolled((prev) => {
        const next = prev ? delta > thresholdOff : delta > thresholdOn;
        return prev === next ? prev : next;
      });
    };
    onScroll();
    scrollEl.addEventListener("scroll", onScroll, {
      passive: true,
    });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
    };
  }, [isMobileViewport]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      pushWithTransition(router, localizePath("/", locale));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, locale]);
  const handleWorkerUseToggle = (checked) => {
    if (checked) {
      const registerFrameworkAck =
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY) === "1";
      setForm((prev) => ({
        ...prev,
        workerUse: "ORG_IDENTIFIABLE",
        frameworkAck: registerFrameworkAck,
      }));
      if (!registerFrameworkAck) {
        openFrameworkPage({
          role: isProfessionalRole(form.role) ? form.role : "SOCIAL_WORKER",
          workerUse: "ORG_IDENTIFIABLE",
          frameworkAck: false,
        });
      }
      return;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(WORKER_FRAMEWORK_REGISTER_CONTEXT_STORAGE_KEY);
      window.sessionStorage.removeItem(WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY);
      window.sessionStorage.removeItem(WORKER_FRAMEWORK_REVIEW_STORAGE_KEY);
      window.sessionStorage.removeItem(
        WORKER_FRAMEWORK_SIGNED_DOWNLOAD_STORAGE_KEY,
      );
    }
    setFrameworkReviewOpenedAt("");
    setFrameworkSignedDownloadedAt("");
    setForm((prev) => ({
      ...prev,
      workerUse: "",
      frameworkAck: false,
    }));
  };
  return (
    <section lang={locale} className="register-page">
      <div
        ref={ringRef}
        className="register-ring"
        data-scrolled={hasUserStartedScroll && isScrolled ? "1" : "0"}
        onWheel={proxyWheelToRegisterScroll}
      >
        {showSuccessState ? (
          <>
            <div className="register-title">
              <h1>
                {t("auth.register.title")}
              </h1>
            </div>
            <div className="register-success">
              <div role="status">
                <p>
                  {successMessage}
                </p>
              </div>
              <div>
                <Button
                  type="button"
                  onClick={handleClose}
                >
                  <span>{t("buttons.back_home")}</span>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="register-title">
              <h1>
                {t("auth.register.title")}
              </h1>
            </div>

            <>
              {canScrollUp ? (
                <div className="register-cue" aria-hidden="true" />
              ) : null}
              {canScrollDown ? (
                <div className="register-cue" aria-hidden="true" data-scroll-cue={!isScrolled ? "1" : "0"} />
              ) : null}
            </>

            <div className="register-scrollwrap">
              <div
                ref={scrollRef}
                className="register-scroll"
                style={{
                  "--csp-pad": `${scrollPad}px`,
                  "--csp-pad-top": `${scrollPadTop || scrollPad}px`,
                  "--csp-pad-bottom": `${scrollPadBottom || scrollPad}px`,
                  "--csp-center-offset": `${isMobileViewport ? -5 : 0}px`,
                  overflowAnchor: "none",
                }}
                tabIndex={0}
                aria-label={t("auth.register.title")}
              >
                <form
                  onSubmit={handleSubmit}
                  autoComplete="on"
                  noValidate
                >
              <section
                className={`${registerStepClassName} ${getRegisterStepClassName(roleStepIndex)}`}
              >
                {!isRegistrationOpen ? (
                  <div role="status">
                    {t("auth.register.closed_notice")}
                  </div>
                ) : null}
                {!isRoleLocked ? (
                  <>
                    <div id={roleLabelId} className="register-question">
                      {roleLabelText}
                    </div>
                    <div
                      role="radiogroup"
                      aria-labelledby={roleLabelId}
                      aria-describedby={roleHintId}
                    >
                      <div id={roleHintId} className="sr-only">
                        {t("auth.register.role_hint")}
                      </div>
                      {REGISTER_ROLE_OPTIONS.map((role) => (
                        <button
                          key={role}
                          type="button"
                          role="radio"
                          aria-checked={form.role === role}
                          data-checked={form.role === role ? "true" : "false"}
                          onClick={() => handleRoleSelect(role)}
                          onKeyDown={(event) => handleRoleKeyDown(event, role)}
                        >
                          <span>
                            {t(roleLabelKey(role))}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div aria-label={t(roleLabelKey(lockedRole))}>
                    <span>
                      {t(roleLabelKey(lockedRole))}
                    </span>
                  </div>
                )}
              </section>

              <section
                className={`${registerStepClassName} ${getRegisterStepClassName(emailStepIndex)}`}
              >
                <div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder={fieldErrors.email ? "" : t("auth.email_placeholder")}
                    value={form.email}
                    onChange={handleChange}
                    required
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={fieldErrors.email ? "true" : "false"}
                    aria-describedby={fieldErrors.email ? emailErrorId : undefined}
                  />
                  {fieldErrors.email ? (
                    <span id={emailErrorId} className="register-field-error">
                      {fieldErrors.email}
                    </span>
                  ) : null}
                </div>
              </section>

              <section
                className={`${registerStepClassName} ${getRegisterStepClassName(pinStepIndex)}`}
              >
                <div>
                  <input
                    type="text"
                    id="pin"
                    name="pin"
                    placeholder={
                      fieldErrors.pin
                        ? ""
                        : t("auth.register.pin_placeholder", {
                            min: PIN_MIN,
                            max: PIN_MAX,
                          })
                    }
                    value={form.pin}
                    onChange={handleChange}
                    required
                    minLength={PIN_MIN}
                    maxLength={PIN_MAX}
                    autoComplete="new-password"
                    inputMode="numeric"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    pattern={`\\d{${PIN_MIN},${PIN_MAX}}`}
                    aria-invalid={fieldErrors.pin ? "true" : "false"}
                    aria-describedby={fieldErrors.pin ? pinErrorId : undefined}
                  />
                  {fieldErrors.pin ? (
                    <span id={pinErrorId} className="register-field-error">
                      {fieldErrors.pin}
                    </span>
                  ) : null}
                </div>
              </section>

              <section
                className={`${registerStepClassName} ${getRegisterStepClassName(agreementStepIndex)}`}
              >
                <OptionCard
                  type="checkbox"
                  name="agree"
                  checked={form.agree}
                  onChange={handleChange}
                >
                  <RichText
                    value={t("auth.register.agreement")}
                    replacements={{
                      terms: {
                        open: `<a href="${localizePath("/kasutustingimused", locale)}">`,
                        close: "</a>",
                      },
                      privacy: {
                        open: `<a href="${localizePath("/privaatsustingimused", locale)}">`,
                        close: "</a>",
                      },
                    }}
                  />
                </OptionCard>
              </section>

              <section
                className={`${registerStepClassName} ${getRegisterStepClassName(guideStepIndex)}`}
              >
                <OptionCard
                  type="checkbox"
                  name="guideAck"
                  checked={form.guideAck}
                  onChange={handleChange}
                >
                  <RichText
                    value={t("auth.register.guide_ack")}
                    replacements={{
                      guide: {
                        open: `<a href="${localizePath("/kasutusjuhend", locale)}">`,
                        close: "</a>",
                      },
                      guide1: {
                        open: `<a href="${localizePath("/kasutusjuhend", locale)}">`,
                        close: "</a>",
                      },
                      guide2: {
                        open: `<a href="${localizePath("/kasutusjuhend", locale)}">`,
                        close: "</a>",
                      },
                    }}
                  />
                </OptionCard>
              </section>

              {isProfessionalUser ? (
                <section
                  className={`${registerStepClassName} ${getRegisterStepClassName(workerStepIndex)}`}
                >
                  <div>
                    <OptionCard
                      type="checkbox"
                      name="workerUseOrg"
                      checked={hasConfirmedFramework}
                      onChange={(e) => handleWorkerUseToggle(e.target.checked)}
                    >
                      {t("auth.register.worker_use_org")}
                    </OptionCard>
                  </div>
                </section>
              ) : null}

                  <section
                    className={`${registerStepClassName} ${getRegisterStepClassName(submitStepIndex)}`}
                  >
                    {!isRegistrationOpen && (
                      <div role="status">
                        {t("auth.register.closed_notice")}
                      </div>
                    )}
                    {error && (
                      <div role="alert">
                        {error}
                      </div>
                    )}
                    <div className="register-submit">
                      <Button
                        type="submit"
                        disabled={submitting || !isRegistrationOpen}
                      >
                        <span>
                          {t("auth.register.submit")}
                        </span>
                      </Button>
                    </div>
                  </section>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
