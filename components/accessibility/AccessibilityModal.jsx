"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useRouter } from "next/navigation";
import CenteredScrollPicker from "@/components/CenteredScrollPicker";
import OptionCard from "@/components/ui/OptionCard";
import { getAmbientMode, setAmbientMode } from "@/components/room/AmbientAudio";
export default function AccessibilityModal({
  onClose,
  prefs,
  onSave,
  onPreview,
  onPreviewEnd,
  requireInitialSelection = false,
}) {
  const boxRef = useRef(null);
  const firstFocusRef = useRef(null);
  const scrollRef = useRef(null);
  const {
    t,
    locale,
    setLocale,
    setMessages
  } = useI18n();
  const a11yTitleLine1 = t("profile.preferences.title_line1");
  const a11yTitleLine2 = t("profile.preferences.title_line2");
  const router = useRouter();
  const normalizeUiProfile = value =>
    value === "mac" ? "mac" : value === "lg" || value === "xl" ? "lg" : "sm";
  const initialUiScale = requireInitialSelection ? null : prefs.uiScale || "md";
  const initialUiProfile = requireInitialSelection ? null : prefs.uiProfile || normalizeUiProfile(prefs.uiScale);
  const initialLang = requireInitialSelection ? null : locale || "et";
  const initialContrast = requireInitialSelection ? null : prefs.contrast || "normal";
  const initialTheme = requireInitialSelection
    ? null
    : ["light", "mid", "dark"].includes(prefs.theme)
      ? prefs.theme
      : "mid";
  const [uiScale, setUiScale] = useState(initialUiScale);
  const [uiProfile, setUiProfile] = useState(initialUiProfile);
  const [contrast, setContrast] = useState(initialContrast);
  const [reduceMotion, setReduceMotion] = useState(!!prefs.reduceMotion);
  /* Taustaheli (tellija 06.07 öö): rakendub KOHE, elab localStorage's,
     mitte a11y-prefsides — sõltumatu salvestusnupust */
  const [ambient, setAmbient] = useState("a");
  useEffect(() => {
    setAmbient(getAmbientMode());
  }, []);
  const chooseAmbient = (value) => {
    setAmbient(value);
    setAmbientMode(value);
  };
  const [reduceTransparency, setReduceTransparency] = useState(!!prefs.reduceTransparency);
  const [theme, setTheme] = useState(initialTheme);
  const [lang, setLang] = useState(initialLang);
  const [scrollPad, setScrollPad] = useState(0);
  const [scrollPadTop, setScrollPadTop] = useState(0);
  const [scrollPadBottom, setScrollPadBottom] = useState(0);
  const [hasUserStartedScroll, setHasUserStartedScroll] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const initViewportModeRef = useRef(null);
  const initialScrollTopRef = useRef(0);
  const hasInitialScrollTopRef = useRef(false);
  const initialFirstStepAlignDoneRef = useRef(false);
  const originalLocaleRef = useRef(locale);
  const previewedLangRef = useRef(null);
  const saveDisabled =
    requireInitialSelection &&
    (!lang || !contrast || !uiScale || !uiProfile || !theme);
  useEffect(() => {
    setUiScale(current => current ?? initialUiScale);
    setUiProfile(current => current ?? initialUiProfile);
    setContrast(current => current ?? initialContrast);
    setReduceMotion(!!prefs.reduceMotion);
    setReduceTransparency(!!prefs.reduceTransparency);
    setTheme(current => current ?? initialTheme);
  }, [initialContrast, initialTheme, initialUiProfile, initialUiScale, prefs]);
  useEffect(() => {
    let canceled = false;
    async function applyLanguageMessages(targetLocale) {
      try {
        const LOADERS = {
          et: () => import("@/messages/et.json"),
          ru: () => import("@/messages/ru.json"),
          en: () => import("@/messages/en.json")
        };
        const mod = await (LOADERS[targetLocale] ? LOADERS[targetLocale]() : LOADERS.et());
        if (!canceled) {
          setMessages(mod?.default || {});
          previewedLangRef.current = targetLocale;
        }
      } catch {}
    }
    if (lang && lang !== originalLocaleRef.current) {
      applyLanguageMessages(lang);
    } else if (lang === originalLocaleRef.current) {
      applyLanguageMessages(originalLocaleRef.current);
      previewedLangRef.current = null;
    }
    return () => {
      canceled = true;
    };
  }, [lang, setMessages]);
  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") {
          e.stopImmediatePropagation();
        }
        onClose?.();
        return;
      }
      if (e.key === "Tab" && boxRef.current) {
        const nodes = boxRef.current.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
        const focusables = Array.from(nodes).filter(n => n.offsetWidth > 0 || n.offsetHeight > 0);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  useEffect(() => {
    const target = firstFocusRef.current;
    if (!target || typeof target.focus !== "function") return;
    try {
      target.focus({
        preventScroll: true
      });
    } catch {
      target.focus();
    }
  }, []);
  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || typeof window === "undefined") return;
    const updatePad = () => {
      const steps = Array.from(scrollEl.querySelectorAll(".csp-step"));
      const firstStep = steps[0] || null;
      const lastStep = steps[steps.length - 1] || firstStep;
      if (!firstStep || !lastStep) return;
      const firstH = firstStep.getBoundingClientRect().height || 0;
      const lastH = lastStep.getBoundingClientRect().height || 0;
      const viewH = Math.max(0, scrollEl.clientHeight || 0);
      if (!viewH || !firstH || !lastH) return;
      const targetCenter = viewH / 2 - (isMobileViewport ? 5 : 0);
      const nextPadTopBase = Math.max(0, Math.floor(targetCenter - firstH / 2));
      const nextPadBottomBase = Math.max(
        0,
        Math.floor(viewH - targetCenter - lastH / 2),
      );
      const nextPad = Math.max(0, Math.floor((viewH - firstH) / 2));
      setScrollPad(prev => prev === nextPad ? prev : nextPad);
      setScrollPadTop(prev => prev === nextPadTopBase ? prev : nextPadTopBase);
      setScrollPadBottom(prev => prev === nextPadBottomBase ? prev : nextPadBottomBase);
    };
    updatePad();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePad) : null;
    ro?.observe(scrollEl);
    window.addEventListener("resize", updatePad);
    return () => {
      ro?.disconnect?.();
      window.removeEventListener("resize", updatePad);
    };
  }, [isMobileViewport]);
  const {
    getItemClassName,
    scrollToIndex
  } = CenteredScrollPicker({
    containerRef: scrollRef,
    itemSelector: ".csp-step",
    reduceMotion,
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
    pauseSettleWhileTouch: isMobileViewport
  });
  const getA11yStepClassName = index =>
    isMobileViewport ? getItemClassName(index) : "";
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
      }
      setHasUserStartedScroll(false);
      hasInitialScrollTopRef.current = true;
      initialScrollTopRef.current = scrollEl.scrollTop || 0;
      initialFirstStepAlignDoneRef.current = true;
    };
    resetToFirstStep();
    const rafA = requestAnimationFrame(resetToFirstStep);
    const rafB = requestAnimationFrame(() => requestAnimationFrame(resetToFirstStep));
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
      hasInitialScrollTopRef.current = true;
      initialScrollTopRef.current = scrollEl.scrollTop || 0;
      initialFirstStepAlignDoneRef.current = true;
    };
    const raf = requestAnimationFrame(alignToFirst);
    return () => cancelAnimationFrame(raf);
  }, [scrollPadTop, scrollPadBottom, hasUserStartedScroll, scrollToIndex, isMobileViewport]);
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const onScroll = () => {
      const top = scrollEl.scrollTop || 0;
      if (!hasInitialScrollTopRef.current) {
        hasInitialScrollTopRef.current = true;
        initialScrollTopRef.current = top;
      }
      const delta = Math.abs(top - initialScrollTopRef.current);
      const thresholdOn = isMobileViewport ? 14 : 8;
      if (delta > thresholdOn) {
        setHasUserStartedScroll(prev => prev || true);
      }
    };
    onScroll();
    scrollEl.addEventListener("scroll", onScroll, {
      passive: true
    });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [isMobileViewport]);
  const stopInside = e => e.stopPropagation();
  const save = async () => {
    if (saveDisabled) return;
    onSave?.({
      uiScale: uiScale || prefs.uiScale || "md",
      uiProfile: uiProfile || prefs.uiProfile || normalizeUiProfile(prefs.uiScale),
      contrast: contrast || prefs.contrast || "normal",
      reduceMotion,
      reduceTransparency,
      theme: theme || prefs.theme || "mid"
    });
    if (typeof window !== "undefined" && lang && lang !== locale) {
      setLocale(lang);
      try {
        const LOADERS = {
          et: () => import("@/messages/et.json"),
          ru: () => import("@/messages/ru.json"),
          en: () => import("@/messages/en.json")
        };
        const mod = await (LOADERS[lang] ? LOADERS[lang]() : LOADERS.et());
        setMessages(mod?.default || {});
      } catch {}
      try {
        const current = `${window.location.pathname}${window.location.search || ""}${window.location.hash || ""}`;
        router.replace(current, {
          scroll: false
        });
        router.refresh();
      } catch {}
    }
    onPreviewEnd?.();
    onClose?.();
  };
  useEffect(() => {
    onPreview?.({
      uiScale: uiScale || prefs.uiScale || "md",
      uiProfile: uiProfile || prefs.uiProfile || normalizeUiProfile(prefs.uiScale),
      contrast: contrast || prefs.contrast || "normal",
      reduceMotion,
      reduceTransparency,
      theme: theme || prefs.theme || "mid"
    });
  }, [contrast, onPreview, prefs.contrast, prefs.theme, prefs.uiProfile, prefs.uiScale, reduceMotion, reduceTransparency, theme, uiProfile, uiScale]);
  useEffect(() => () => {
    onPreviewEnd?.();
  }, [onPreviewEnd]);
  useEffect(() => () => {
    try {
      const orig = originalLocaleRef.current;
      if (previewedLangRef.current && orig !== previewedLangRef.current) {
        const LOADERS = {
          et: () => import("@/messages/et.json"),
          ru: () => import("@/messages/ru.json"),
          en: () => import("@/messages/en.json")
        };
        const loader = LOADERS[orig] || LOADERS.et;
        loader().then(mod => setMessages(mod?.default || {})).catch(() => {});
      }
    } catch {}
  }, [setMessages]);
  return <>
      <div onClick={onClose} role="presentation" aria-hidden="true" />

      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="a11y-title" onClick={stopInside} tabIndex={-1}>
        <div aria-hidden="false">
          <h2 id="a11y-title">
            <span>{a11yTitleLine1}</span>
            <span>{a11yTitleLine2}</span>
          </h2>
        </div>

        <div ref={scrollRef} style={{
        "--csp-pad": `${scrollPad}px`,
        "--csp-pad-top": `${scrollPadTop || scrollPad}px`,
        "--csp-pad-bottom": `${scrollPadBottom || scrollPad}px`,
        "--csp-center-offset": `${isMobileViewport ? -5 : 0}px`
      }} tabIndex={0} aria-label={t("profile.preferences.title")}>
          <fieldset className={`csp-step ${getA11yStepClassName(0)}`.trim()}>
            <legend>
              {t("accessibility.language")}
            </legend>
            <div>
              <OptionCard
                inputRef={firstFocusRef}
                type="radio"
                name="lg"
                value="et"
                checked={lang === "et"}
                onChange={() => setLang("et")}
              >
                <span>{t("accessibility.options.language.et")}</span>
              </OptionCard>
              <OptionCard
                type="radio"
                name="lg"
                value="ru"
                checked={lang === "ru"}
                onChange={() => setLang("ru")}
              >
                <span>{t("accessibility.options.language.ru")}</span>
              </OptionCard>
              <OptionCard
                type="radio"
                name="lg"
                value="en"
                checked={lang === "en"}
                onChange={() => setLang("en")}
              >
                <span>{t("accessibility.options.language.en")}</span>
              </OptionCard>
            </div>
          </fieldset>

          <fieldset className={`csp-step ${getA11yStepClassName(1)}`.trim()}>
            <legend>
              {t("accessibility.contrast")}
            </legend>
            <div>
              <OptionCard type="radio" name="ct" value="normal" checked={contrast === "normal"} onChange={() => setContrast("normal")}>
                <span>{t("accessibility.options.contrast.normal")}</span>
              </OptionCard>
              <OptionCard type="radio" name="ct" value="hc" checked={contrast === "hc"} onChange={() => setContrast("hc")}>
                <span>{t("accessibility.options.contrast.hc")}</span>
              </OptionCard>
            </div>
          </fieldset>

          <fieldset className={`csp-step ${getA11yStepClassName(2)}`.trim()}>
            <legend>
              {t("accessibility.text_scale")}
            </legend>
            <div>
              <OptionCard type="radio" name="ts" value="sm" checked={uiScale === "sm"} onChange={() => setUiScale("sm")}>
                <span>{t("accessibility.options.text_scale.sm")}</span>
              </OptionCard>
              <OptionCard type="radio" name="ts" value="md" checked={uiScale === "md"} onChange={() => setUiScale("md")}>
                <span>{t("accessibility.options.text_scale.md")}</span>
              </OptionCard>
              <OptionCard type="radio" name="ts" value="lg" checked={uiScale === "lg"} onChange={() => setUiScale("lg")}>
                <span>{t("accessibility.options.text_scale.lg")}</span>
              </OptionCard>
              <OptionCard type="radio" name="ts" value="xl" checked={uiScale === "xl"} onChange={() => setUiScale("xl")}>
                <span>{t("accessibility.options.text_scale.xl")}</span>
              </OptionCard>
            </div>
          </fieldset>

          <fieldset className={`csp-step ${getA11yStepClassName(3)}`.trim()}>
            <legend>
              {t("accessibility.theme")}
            </legend>
            <div>
              {/* LUKUS (07.07): platvorm avaldab ainult "Hämar" (mid).
                  Hele/Öö on karkass (Fable 5 viimistleb) — kuni siis on
                  valik peidetud ja runtime sunnib alati mid'i. */}
              <OptionCard type="radio" name="theme" value="mid" checked={theme === "mid"} onChange={() => setTheme("mid")}>
                <span>{t("accessibility.options.theme.mid")}</span>
              </OptionCard>
            </div>
          </fieldset>

          <fieldset className={`csp-step ${getA11yStepClassName(4)}`.trim()}>
            <legend>
              {t("accessibility.screen_profile")}
            </legend>
            <div>
              <OptionCard type="radio" name="sp" value="sm" checked={uiProfile === "sm"} onChange={() => setUiProfile("sm")}>
                <span>{t("accessibility.options.screen_profile.sm")}</span>
              </OptionCard>
              <OptionCard type="radio" name="sp" value="mac" checked={uiProfile === "mac"} onChange={() => setUiProfile("mac")}>
                <span>{t("accessibility.options.screen_profile.mac")}</span>
              </OptionCard>
              <OptionCard type="radio" name="sp" value="lg" checked={uiProfile === "lg"} onChange={() => setUiProfile("lg")}>
                <span>{t("accessibility.options.screen_profile.lg")}</span>
              </OptionCard>
            </div>
          </fieldset>

          <fieldset className={`csp-step ${getA11yStepClassName(5)}`.trim()}>
            <legend>{t("accessibility.motion")}</legend>
            <div>
              <OptionCard
                type="checkbox"
                checked={reduceMotion}
                onChange={e => setReduceMotion(e.target.checked)}
              >
                <span>{t("accessibility.options.motion.reduce")}</span>
              </OptionCard>
              <OptionCard
                type="checkbox"
                checked={reduceTransparency}
                onChange={e => setReduceTransparency(e.target.checked)}
              >
                <span>{t("accessibility.options.transparency.reduce")}</span>
              </OptionCard>
            </div>
          </fieldset>

          <fieldset className={`csp-step ${getA11yStepClassName(6)}`.trim()}>
            <legend>{t("accessibility.ambient")}</legend>
            <div>
              <OptionCard type="radio" name="amb" value="off" checked={ambient === "off"} onChange={() => chooseAmbient("off")}>
                <span>{t("accessibility.options.ambient.off")}</span>
              </OptionCard>
              <OptionCard type="radio" name="amb" value="a" checked={ambient === "a"} onChange={() => chooseAmbient("a")}>
                <span>{t("accessibility.options.ambient.a")}</span>
              </OptionCard>
              <OptionCard type="radio" name="amb" value="b" checked={ambient === "b"} onChange={() => chooseAmbient("b")}>
                <span>{t("accessibility.options.ambient.b")}</span>
              </OptionCard>
              <OptionCard type="radio" name="amb" value="c" checked={ambient === "c"} onChange={() => chooseAmbient("c")}>
                <span>{t("accessibility.options.ambient.c")}</span>
              </OptionCard>
            </div>
          </fieldset>

          <div className={`csp-step ${getA11yStepClassName(7)}`.trim()}>
              <Button
              type="button"
              variant="primary"
              onClick={save}
              aria-label={t("accessibility.save")}
              disabled={saveDisabled}
            >
              <span>{t("accessibility.save")}</span>
            </Button>
          </div>
        </div>
      </div>
    </>;
}
