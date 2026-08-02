"use client";

/**
 * Registreerimine = jaamalend: iga vormisamm on ruumis hõljuv jaam,
 * valik lennutab kaamera järgmise juurde. Kerimist EI OLE — edasi
 * viib vastamine, tagasi dokk. Mootor: useStationFlight (flight-effect
 * adaptsioon, jaama-target); kest: PanelFrame canvas-režiim; stiilid:
 * app/styles/register-flight.css (.rgf-*).
 *
 * Vormiloogika (mustand sessionStorage'is, raamistiku-detour,
 * /api/register leping, veakoodide kaardistus) on endise keritava
 * vormi omaga identne — muutus ainult lavastus.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import OptionCard from "@/components/ui/OptionCard";
import RichText from "@/components/i18n/RichText";
import Button from "@/components/ui/Button";
import { localizePath } from "@/lib/localizePath";
/* Sama nool mis ruumi ja ligipääsetavuse dokis — Tagasi on üks žest. */
import { BackArrowIcon } from "@/components/brand/icons/CardIcons";
import useStationFlight from "@/components/register/useStationFlight";
import {
  WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY,
  WORKER_FRAMEWORK_REGISTER_CONTEXT_STORAGE_KEY,
  WORKER_FRAMEWORK_REVIEW_STORAGE_KEY,
  WORKER_FRAMEWORK_SIGNED_DOWNLOAD_STORAGE_KEY,
  WORKER_FRAMEWORK_VERSION,
} from "@/lib/frameworkAcceptances";
import { pushWithTransition } from "@/lib/routeTransition";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { REGISTRATION_OPEN } from "@/lib/publicRegistration";

/* Avatus tuleb ühest serveri tõeallikast (lib/publicRegistration.js) —
   klient ei ole autoriteet. Admin saab lehe paigutust serveripoolse
   rollikontrolli järel vaadata, kuid vormi esitada ei saa. */
const isRegistrationOpen = REGISTRATION_OPEN;
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
/* Linnukese-jaamad lendavad edasi väikese pausiga, et valik jõuaks
   visuaalselt kohale enne kaamera liikumist. */
const AUTO_ADVANCE_MS = 240;

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
  const stageRef = useRef(null);
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
  const roleLabelId = useId();
  const roleHintId = useId();
  const emailErrorId = useId();
  const pinErrorId = useId();
  const isProfessionalUser = isProfessionalRole(form.role);
  const requiresFramework =
    isProfessionalUser && form.workerUse === "ORG_IDENTIFIABLE";
  const hasConfirmedFramework = requiresFramework && form.frameworkAck;

  /* Jaamade järjekord ehitatakse olekust: lukustatud roll jätab
     rollijaama vahele (roll = chip dokis); töökasutuse jaam ainult
     professionaalirollidel; edu-jaam lisandub pärast õnnestumist. */
  const stations = useMemo(() => {
    const list = [];
    if (!isRoleLocked) list.push("role");
    list.push("email", "pin", "agree", "guide");
    if (isProfessionalUser) list.push("worker");
    list.push("gate");
    if (showSuccessState) list.push("success");
    return list;
  }, [isRoleLocked, isProfessionalUser, showSuccessState]);

  /* parallax: hiir nihutab kadumispunkti (omanik 21.07) */
  const { dollyRef, planeProps, activeIndex, mode, flyTo } = useStationFlight({
    parallax: true,
    count: stations.length,
    initialIndex: 0,
  });

  /* Kõik navigeerimine käib siit läbi: ootel auto-lend tühistatakse,
     siht püsib jaamaloendi piires. */
  const advanceTimerRef = useRef(0);
  const goTo = useCallback(
    (index, opts) => {
      window.clearTimeout(advanceTimerRef.current);
      const clamped = Math.max(0, Math.min(index, stations.length - 1));
      flyTo(clamped, opts);
    },
    [flyTo, stations.length],
  );
  const scheduleAdvance = useCallback(
    (toIndex) => {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = window.setTimeout(() => {
        flyTo(Math.max(0, Math.min(toIndex, stations.length - 1)));
      }, AUTO_ADVANCE_MS);
    },
    [flyTo, stations.length],
  );
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), []);

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

  /* Puhas valik (nooleklahvid liiguvad valikute vahel ILMA lennuta);
     klikk/Enter valib JA lendab edasi. */
  const selectRole = (role) => {
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
  const handleRoleSelect = (role, stationIdx) => {
    selectRole(role);
    scheduleAdvance(stationIdx + 1);
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
    selectRole(REGISTER_ROLE_OPTIONS[nextIndex]);
  };

  /* Linnuke → väike paus → auto-lend; lahtivõtmine jätab paigale. */
  const handleAckChange = (e, stationIdx) => {
    handleChange(e);
    if (e.target.checked) scheduleAdvance(stationIdx + 1);
    else window.clearTimeout(advanceTimerRef.current);
  };

  /* Vaikne valiidsuskontroll tühikäigu-autolennuks (vigu EI kuvata —
     need ilmuvad ainult Enteril/kerimisel/esitamisel). */
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailComplete = EMAIL_REGEX.test(form.email.trim().toLowerCase());
  const pinDigits = form.pin.replace(/\D/g, "");
  const isPinComplete = pinDigits.length >= PIN_MIN && pinDigits.length <= PIN_MAX;

  /* Sisendjaamad valideeritakse ENNE lendu — vigasena ei lenda. */
  const validateEmailStation = () => {
    const email = form.email.trim().toLowerCase();
    if (!email) {
      setFieldErrors((prev) => ({
        ...prev,
        email: t("profile.email_update.error_email_required"),
      }));
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFieldErrors((prev) => ({
        ...prev,
        email: t("profile.email_update.error_email_invalid"),
      }));
      return false;
    }
    return true;
  };
  const validatePinStation = () => {
    const pin = form.pin.replace(/\D/g, "");
    if (!pin) {
      setFieldErrors((prev) => ({
        ...prev,
        pin: t("profile.email_update.error_pin_required"),
      }));
      return false;
    }
    if (pin.length < PIN_MIN || pin.length > PIN_MAX) {
      setFieldErrors((prev) => ({
        ...prev,
        pin: t("profile.email_update.error_pin_length", {
          min: PIN_MIN,
          max: PIN_MAX,
        }),
      }));
      return false;
    }
    return true;
  };
  const advanceFrom = (stationKey, stationIdx) => {
    if (stationKey === "email" && !validateEmailStation()) return;
    if (stationKey === "pin" && !validatePinStation()) return;
    goTo(stationIdx + 1);
  };

  /* Tühikäigu-autolend (tellija 16.07: „ei taha Edasi-nuppu pidevalt
     vajutada"): kui e-post/PIN on valiidne ja tippimises tekib paus,
     lennatakse ise edasi. Iga klahvivajutus nullib taimeri; Enter ja
     kerimine jäävad kiiremaks teeks. Autolend AINULT siis, kui väärtus
     on SELLES jaamas muutunud — tagasi tulles (dokk/viga) ei röövita
     kasutajat kohe edasi. */
  const arrivalValuesRef = useRef({ email: "", pin: "" });
  useEffect(() => {
    arrivalValuesRef.current = { email: form.email, pin: form.pin };
    // Snapshot jaamavahetusel JA mustandi taastumisel (draftReady) —
    // taastatud väärtus ei tohi paista „tipituna" ja autolendu käivitada.
    // Form-deps lisamine nullaks valvuri.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, draftReady]);
  useEffect(() => {
    if (!draftReady) return;
    const key = stations[activeIndex];
    const typedHere =
      key === "email"
        ? form.email !== arrivalValuesRef.current.email
        : key === "pin"
          ? form.pin !== arrivalValuesRef.current.pin
          : false;
    const ready =
      typedHere &&
      ((key === "email" && isEmailComplete) || (key === "pin" && isPinComplete));
    if (!ready) return;
    const idx = activeIndex;
    const timer = window.setTimeout(() => {
      goTo(idx + 1);
    }, key === "email" ? 1150 : 1000);
    return () => window.clearTimeout(timer);
  }, [draftReady, stations, activeIndex, form.email, form.pin, isEmailComplete, isPinComplete, goTo]);

  /* Enter teeb igal jaamal õige asja: väraval esitab, mujal liigub
     edasi (valideerides). Nii ei pääse vormi natiivne submit kunagi
     poolelt jaamalt läbi. */
  function handleFormSubmit(e) {
    e.preventDefault();
    const key = stations[activeIndex];
    if (key === "gate") {
      void doSubmit();
      return;
    }
    if (key && key !== "success") advanceFrom(key, activeIndex);
  }

  const jumpToStation = (key) => {
    const idx = stations.indexOf(key);
    if (idx >= 0) goTo(idx);
  };

  async function doSubmit() {
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
    if (!form.role) {
      setError(t("auth.register.error.role_required"));
      jumpToStation("role");
      return;
    }
    if (!email) {
      setFieldErrors((prev) => ({
        ...prev,
        email: t("profile.email_update.error_email_required"),
      }));
      jumpToStation("email");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFieldErrors((prev) => ({
        ...prev,
        email: t("profile.email_update.error_email_invalid"),
      }));
      jumpToStation("email");
      return;
    }
    if (!pin) {
      setFieldErrors((prev) => ({
        ...prev,
        pin: t("profile.email_update.error_pin_required"),
      }));
      jumpToStation("pin");
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
      jumpToStation("pin");
      return;
    }
    if (requiresFramework && !form.frameworkAck) {
      setError(t("auth.register.error.framework_ack_required"));
      jumpToStation("worker");
      return;
    }
    if (!form.agree || !form.guideAck) {
      setError(t("auth.register.error.agree_required"));
      jumpToStation(!form.agree ? "agree" : "guide");
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
          termsPrivacyAck: form.agree === true,
          guideAck: form.guideAck === true,
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
          jumpToStation("email");
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
          jumpToStation("pin");
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

  /* Mustandi taastus + raamistiku-detourist naasmine (verbatim leping
     endise vormiga). Naasmisel lennatakse otse töökasutuse jaama. */
  const pendingDetourReturnRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawDraft = window.sessionStorage.getItem(REGISTER_DRAFT_STORAGE_KEY);
    const registerFrameworkAck =
      window.sessionStorage.getItem(WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY) === "1";
    const registerContext =
      window.sessionStorage.getItem(WORKER_FRAMEWORK_REGISTER_CONTEXT_STORAGE_KEY) === "1";
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
    if (registerContext) pendingDetourReturnRef.current = true;
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
    if (!pendingDetourReturnRef.current || !draftReady) return;
    const idx = stations.indexOf("worker");
    if (idx >= 0) {
      pendingDetourReturnRef.current = false;
      goTo(idx, { drift: true });
    }
  }, [draftReady, stations, goTo]);
  useEffect(() => {
    if (typeof window === "undefined" || showSuccessState || !draftReady) return;
    window.sessionStorage.setItem(REGISTER_DRAFT_STORAGE_KEY, JSON.stringify(form));
  }, [draftReady, form, showSuccessState]);

  /* Õnnestumine = lend väravast LÄBI edu-jaama (teekond jätkub). */
  useEffect(() => {
    if (!showSuccessState) return;
    const idx = stations.indexOf("success");
    if (idx >= 0 && activeIndex !== idx) goTo(idx);
  }, [showSuccessState, stations, activeIndex, goTo]);

  /* Saabumisel fookus jaama esimesele juhtelemendile ([data-autofocus];
     OptionCardi puhul label → sisemine input). Ainult jaamavahetusel,
     mitte mount'il — leht ei röövi fookust. */
  const prevIndexRef = useRef(activeIndex);
  useEffect(() => {
    if (prevIndexRef.current === activeIndex) return;
    prevIndexRef.current = activeIndex;
    /* Fookus tuleb kohale lennu lõpupoole (~2/3 kestusest), et ta ei hüppaks
       veel lendavale jaamale. Käib lennutempoga kaasa: lend ~0,51 s. */
    const delay = mode === "3d" ? 350 : 80;
    const timer = window.setTimeout(() => {
      const host = stageRef.current?.querySelector(
        '.rgf-plane[data-active="1"] [data-autofocus]',
      );
      const target = host?.matches?.("label") ? host.querySelector("input") : host;
      if (target && !target.disabled) target.focus({ preventScroll: true });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeIndex, mode]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      pushWithTransition(router, localizePath("/", locale));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, locale]);

  /* Kerimine/svaip = jaamavahetus (tellija 16.07): alla kerides või
     üles svaibates edasi (SAMA valideerimine mis Enteril — vigasena ei
     lenda), üles kerides tagasi. Diskreetne samm cooldown'iga; värav
     EI esita kerimisega kunagi; edu-jaamas kerimine lukus. Ref hoiab
     värske oleku, listener registreeritakse üks kord. */
  const wheelNavRef = useRef(() => {});
  wheelNavRef.current = (dir) => {
    if (showSuccessState) return;
    if (dir > 0) {
      const key = stations[activeIndex];
      if (!key || key === "gate" || key === "success") return;
      advanceFrom(key, activeIndex);
      return;
    }
    if (activeIndex > 0) goTo(activeIndex - 1);
  };
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let acc = 0;
    let lockUntil = 0;
    const step = (dir) => {
      /* Lukk käib useStationFlight tempoga kaasa (lend ~0,51 s) — ooteaeg ja
         lend peavad püsima ühes mõõdus, muidu jääb keris seisma ka siis, kui
         lend on ammu maandunud (omanik 02.08). */
      lockUntil = performance.now() + 440;
      acc = 0;
      wheelNavRef.current(dir);
    };
    const onWheel = (e) => {
      /* Lava ei keri kunagi natiivselt — kogu ratas on navigatsioon. */
      e.preventDefault();
      if (performance.now() < lockUntil) {
        acc = 0;
        return;
      }
      acc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (Math.abs(acc) < 42) return;
      step(acc > 0 ? 1 : -1);
    };
    let touchY = null;
    let touchX = null;
    const onTouchStart = (e) => {
      touchY = e.touches[0]?.clientY ?? null;
      touchX = e.touches[0]?.clientX ?? null;
    };
    const onTouchEnd = (e) => {
      if (touchY == null) return;
      const endY = e.changedTouches[0]?.clientY ?? touchY;
      const endX = e.changedTouches[0]?.clientX ?? touchX;
      const dy = touchY - endY;
      const dx = Math.abs((touchX ?? endX) - endX);
      touchY = null;
      touchX = null;
      if (Math.abs(dy) < 64 || Math.abs(dy) < dx * 1.4) return;
      if (performance.now() < lockUntil) return;
      step(dy > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

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

  const activeStationKey = stations[Math.min(activeIndex, stations.length - 1)];
  const stepAnnouncement = t("auth.register.step_announce", {
    current: Math.min(activeIndex, stations.length - 1) + 1,
    total: stations.length,
    label: t(`auth.register.steps.${activeStationKey}`),
  });

  function renderStation(key, i) {
    const props = planeProps(i);
    if (key === "role") {
      return (
        <section key={key} {...props}>
          <div id={roleLabelId} className="rgf-question">
            {t("auth.register.role_label_question")}
          </div>
          <div
            className="rgf-controls"
            role="radiogroup"
            aria-labelledby={roleLabelId}
            aria-describedby={roleHintId}
          >
            <div id={roleHintId} className="sr-only">
              {t("auth.register.role_hint")}
            </div>
            {REGISTER_ROLE_OPTIONS.map((role, optionIdx) => (
              <button
                key={role}
                type="button"
                role="radio"
                aria-checked={form.role === role}
                data-checked={form.role === role ? "true" : "false"}
                data-autofocus={optionIdx === 0 ? "" : undefined}
                onClick={() => handleRoleSelect(role, i)}
                onKeyDown={(event) => handleRoleKeyDown(event, role)}
              >
                <span>{t(roleLabelKey(role))}</span>
              </button>
            ))}
          </div>
        </section>
      );
    }
    if (key === "email") {
      return (
        <section key={key} {...props}>
          <label className="rgf-question" htmlFor="email">
            {t("auth.register.email_question")}
          </label>
          <div className="rgf-controls">
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
              data-autofocus=""
              aria-invalid={fieldErrors.email ? "true" : "false"}
              aria-describedby={fieldErrors.email ? emailErrorId : undefined}
            />
            {fieldErrors.email ? (
              <span id={emailErrorId} className="rgf-field-error">
                {fieldErrors.email}
              </span>
            ) : null}
          </div>
        </section>
      );
    }
    if (key === "pin") {
      return (
        <section key={key} {...props}>
          <label className="rgf-question" htmlFor="pin">
            {t("auth.register.pin_question")}
          </label>
          <div className="rgf-controls">
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
              data-autofocus=""
              aria-invalid={fieldErrors.pin ? "true" : "false"}
              aria-describedby={fieldErrors.pin ? pinErrorId : undefined}
            />
            {fieldErrors.pin ? (
              <span id={pinErrorId} className="rgf-field-error">
                {fieldErrors.pin}
              </span>
            ) : null}
          </div>
        </section>
      );
    }
    if (key === "agree") {
      return (
        <section key={key} {...props}>
          <div className="rgf-question">{t("auth.register.steps.agree")}</div>
          <div className="rgf-controls">
            <OptionCard
              type="checkbox"
              name="agree"
              checked={form.agree}
              onChange={(e) => handleAckChange(e, i)}
              data-autofocus=""
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
          </div>
        </section>
      );
    }
    if (key === "guide") {
      return (
        <section key={key} {...props}>
          <div className="rgf-question">{t("auth.register.steps.guide")}</div>
          <div className="rgf-controls">
            <OptionCard
              type="checkbox"
              name="guideAck"
              checked={form.guideAck}
              onChange={(e) => handleAckChange(e, i)}
              data-autofocus=""
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
          </div>
        </section>
      );
    }
    if (key === "worker") {
      return (
        <section key={key} {...props}>
          <div className="rgf-question">{t("auth.register.steps.worker")}</div>
          <div className="rgf-controls">
            <OptionCard
              type="checkbox"
              name="workerUseOrg"
              checked={hasConfirmedFramework}
              onChange={(e) => handleWorkerUseToggle(e.target.checked)}
              data-autofocus=""
            >
              {t("auth.register.worker_use_org")}
            </OptionCard>
            <p className="rgf-hint">{t("auth.register.optional_hint")}</p>
          </div>
          <div className="rgf-next">
            <Button type="button" onClick={() => goTo(i + 1)}>
              <span>{t("auth.register.next")}</span>
            </Button>
          </div>
        </section>
      );
    }
    if (key === "gate") {
      return (
        <section key={key} {...props}>
          <div className="rgf-question">{t("auth.register.gate_question")}</div>
          <dl className="rgf-summary">
            <div className="rgf-summary-row">
              <dt>{t("auth.register.steps.role")}</dt>
              <dd>{form.role ? t(roleLabelKey(form.role)) : "—"}</dd>
            </div>
            <div className="rgf-summary-row">
              <dt>{t("auth.register.steps.email")}</dt>
              <dd>{form.email.trim() || "—"}</dd>
            </div>
            <div className="rgf-summary-row">
              <dt>{t("auth.register.steps.pin")}</dt>
              <dd
                aria-label={t("auth.register.pin_masked", {
                  count: form.pin.length,
                })}
              >
                {form.pin ? "•".repeat(form.pin.length) : "—"}
              </dd>
            </div>
          </dl>
          {!isRegistrationOpen ? (
            <p className="rgf-gate-status" role="status">
              {t("auth.register.closed_notice")}
            </p>
          ) : null}
          {error ? (
            <p className="rgf-gate-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="rgf-submit">
            <Button
              type="submit"
              disabled={submitting || !isRegistrationOpen}
              data-autofocus=""
            >
              <span>{t("auth.register.submit")}</span>
            </Button>
          </div>
        </section>
      );
    }
    if (key === "success") {
      return (
        <section key={key} {...props}>
          <div className="rgf-success">
            <div role="status">
              <p>{successMessage}</p>
            </div>
            <div>
              <Button type="button" onClick={handleClose} data-autofocus="">
                <span>{t("buttons.back_home")}</span>
              </Button>
            </div>
          </div>
        </section>
      );
    }
    return null;
  }

  return (
    <section
      lang={locale}
      ref={stageRef}
      className="rgf-stage"
      data-mode={mode}
      data-flown={activeIndex > 0 ? "1" : "0"}
    >
      <div className="rgf-top">
        <h1 className="rgf-title">{t("auth.register.title")}</h1>
        {!isRegistrationOpen ? (
          <p className="rgf-closed-note">{t("auth.register.closed_notice")}</p>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {stepAnnouncement}
      </p>
      {/* Vorm ON dolly: perspective nõuab, et plaanid oleksid tema
          OTSESED lapsed (vahekiht lamendaks 3D — flight-effect §3). */}
      <form
        ref={dollyRef}
        className="rgf-dolly"
        onSubmit={handleFormSubmit}
        autoComplete="on"
        noValidate
        aria-label={t("auth.register.title")}
      >
        {stations.map((key, i) => renderStation(key, i))}
      </form>
      {/* Dokk = ruumi kaardimenüü DNA (carousel.css .gc-shortcut-*):
          sama riba, täpid ja laienev caps-pill nagu avalehe menüüs.
          .rgf-dock annab ainult positsiooni ja oleku-nüansid. */}
      {!showSuccessState ? (
        <nav className="rgf-dock gc-shortcut-menu" aria-label={t("auth.register.progress_label")}>
          {isRoleLocked ? (
            <span className="rgf-dock-chip">{t(roleLabelKey(lockedRole))}</span>
          ) : null}
          <button
            type="button"
            className="gc-shortcut gc-shortcut--back"
            data-on="0"
            disabled={activeIndex === 0}
            onClick={() => goTo(activeIndex - 1)}
            aria-label={t("buttons.back")}
          >
            <span className="gc-shortcut-icon" aria-hidden="true">
              <BackArrowIcon />
            </span>
            <span className="gc-shortcut-tooltip" aria-hidden="true">
              {t("buttons.back")}
            </span>
          </button>
          <span className="gc-shortcut-divider" aria-hidden="true" />
          <div className="gc-shortcut-track">
            {stations.map((key, i) => {
              const state =
                i < activeIndex ? "done" : i === activeIndex ? "active" : "future";
              const label = t(`auth.register.steps.${key}`);
              return (
                <button
                  key={key}
                  type="button"
                  className="gc-shortcut"
                  data-on={state === "active" ? "1" : "0"}
                  data-state={state}
                  disabled={state === "future"}
                  aria-current={state === "active" ? "step" : undefined}
                  aria-label={t("auth.register.step_announce", {
                    current: i + 1,
                    total: stations.length,
                    label,
                  })}
                  onClick={() => {
                    if (state === "done") goTo(i);
                  }}
                >
                  <span className="gc-shortcut-icon" aria-hidden="true">
                    <span className="gc-shortcut-mark" />
                  </span>
                  <span className="gc-shortcut-text" aria-hidden="true">
                    {label}
                  </span>
                  <span className="gc-shortcut-tooltip" aria-hidden="true">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}
    </section>
  );
}
