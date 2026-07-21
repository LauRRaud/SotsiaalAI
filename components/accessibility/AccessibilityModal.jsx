"use client";

/**
 * AccessibilityModal — keele ja ligipääsetavuse eelistused JAAMALENNUNA.
 *
 * Omanik 21.07: „keele ja ligipääsetavuse leht pidi olema sektsioonide kaupa
 * ja läbi lennatav, nagu registreeru leht." Varem elasid kõik kaheksa
 * sektsiooni ÜHES keritavas konteineris (CenteredScrollPicker) ja jaama-
 * fookus töötas ainult mobiilis — desktopil oli see tavaline nimekiri.
 *
 * Nüüd: iga sektsioon on oma jaam sügavuses ja kaamera lendab nende vahel
 * (sama mootor mis /registreerimine ja Kovisioon: useStationFlight).
 * Erinevus registrist: siin EI OLE väravat — eelistused ei ole järjestikune
 * vorm, vaid üheksa iseseisvat valikut, seega dokk lubab hüpata kuhu tahes.
 *
 * Stiilikiht: app/styles/a11y-flight.css (.a11f-*). Kaardi kest ja
 * valikukaartide materjal jäävad a11y-modal.css-i (.csp-step).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useRouter } from "next/navigation";
import OptionCard from "@/components/ui/OptionCard";
import ChevronIcon from "@/components/brand/icons/ChevronIcon";
import useStationFlight from "@/components/register/useStationFlight";
import { getAmbientMode, setAmbientMode } from "@/components/room/AmbientAudio";

/* Jaamad samas järjekorras nagu varem sektsioonid. Viimane on Salvesta —
   sama muster mis registri väraval (teekonna lõpus on tegu, mitte valik). */
const STATIONS = [
  { key: "language", legend: "accessibility.language" },
  { key: "contrast", legend: "accessibility.contrast" },
  { key: "text_scale", legend: "accessibility.text_scale" },
  { key: "theme", legend: "accessibility.theme" },
  { key: "screen_profile", legend: "accessibility.screen_profile" },
  { key: "plain_language", legend: "accessibility.plain_language.title" },
  { key: "motion", legend: "accessibility.motion" },
  { key: "ambient", legend: "accessibility.ambient" },
  { key: "save", legend: "profile.preferences.title" },
];

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
  const stageRef = useRef(null);
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
  const [plainLanguage, setPlainLanguage] = useState(prefs.plainLanguage === true);
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
  const originalLocaleRef = useRef(locale);
  const previewedLangRef = useRef(null);
  const saveDisabled =
    requireInitialSelection &&
    (!lang || !contrast || !uiScale || !uiProfile || !theme);

  /* ---------- jaamalend ---------- */
  const { dollyRef, planeProps, activeIndex, mode, flyTo } = useStationFlight({
    count: STATIONS.length,
    parallax: true,
  });
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const goTo = useCallback(
    (index) => {
      const clamped = Math.max(0, Math.min(index, STATIONS.length - 1));
      if (clamped === activeIndexRef.current) return;
      flyTo(clamped);
    },
    [flyTo]
  );

  useEffect(() => {
    setUiScale(current => current ?? initialUiScale);
    setUiProfile(current => current ?? initialUiProfile);
    setContrast(current => current ?? initialContrast);
    setPlainLanguage(prefs.plainLanguage === true);
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
        /* Mitteaktiivsed jaamad on inert — nad on DOM-is ja neil on
           paigutuskast (visibility:hidden), seega offsetWidth üksi ei
           filtreeri neid välja ja lõks arvutaks vale viimase elemendi. */
        const focusables = Array.from(nodes).filter(
          n => !n.closest("[inert]") && (n.offsetWidth > 0 || n.offsetHeight > 0)
        );
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

  /* Saabumisel fookus jaama esimesele juhtelemendile ([data-autofocus];
     OptionCardi puhul label → sisemine input). Ainult jaamavahetusel,
     mitte mount'il — seal teeb selle juba firstFocusRef. */
  const prevIndexRef = useRef(activeIndex);
  useEffect(() => {
    if (prevIndexRef.current === activeIndex) return;
    prevIndexRef.current = activeIndex;
    const delay = mode === "3d" ? 420 : 80;
    const timer = window.setTimeout(() => {
      const host = stageRef.current?.querySelector(
        '.a11f-plane[data-active="1"] [data-autofocus]'
      );
      const target = host?.matches?.("label") ? host.querySelector("input") : host;
      if (target && !target.disabled) target.focus({ preventScroll: true });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeIndex, mode]);

  /* Keris ja svaip lava kohal = lend järgmisele jaamale (sama žest mis
     Kovisioonis). Sisemine keritav sisu kerib enne, kui seda on. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const cooldown = { until: 0 };

    const innerCanScroll = (target, delta) => {
      let node = target;
      while (node && node !== el) {
        if (node.nodeType === 1) {
          const oy = getComputedStyle(node).overflowY;
          if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 1) {
            const atTop = node.scrollTop <= 0;
            const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
            if (delta < 0 && !atTop) return true;
            if (delta > 0 && !atBottom) return true;
          }
        }
        node = node.parentElement;
      }
      return false;
    };

    const fly = (dir, stamp) => {
      if (stamp < cooldown.until) return;
      const next = activeIndexRef.current + dir;
      if (next < 0 || next > STATIONS.length - 1) return;
      flyTo(next);
      cooldown.until = stamp + 560;
    };

    const onWheel = (event) => {
      if (Math.abs(event.deltaY) < 4) return;
      if (innerCanScroll(event.target, event.deltaY)) return;
      event.preventDefault();
      fly(event.deltaY > 0 ? 1 : -1, event.timeStamp);
    };

    let startY = 0;
    let startX = 0;
    let startTarget = null;
    const onTouchStart = (event) => {
      startY = event.touches[0].clientY;
      startX = event.touches[0].clientX;
      startTarget = event.target;
    };
    const onTouchEnd = (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dy = startY - touch.clientY;
      const dx = startX - touch.clientX;
      if (Math.abs(dy) < 56 || Math.abs(dx) > Math.abs(dy)) return;
      if (innerCanScroll(startTarget, dy)) return;
      fly(dy > 0 ? 1 : -1, event.timeStamp);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [flyTo]);

  const stopInside = e => e.stopPropagation();
  const save = async () => {
    if (saveDisabled) return;
    onSave?.({
      uiScale: uiScale || prefs.uiScale || "md",
      uiProfile: uiProfile || prefs.uiProfile || normalizeUiProfile(prefs.uiScale),
      contrast: contrast || prefs.contrast || "normal",
      plainLanguage,
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
      plainLanguage,
      reduceMotion,
      reduceTransparency,
      theme: theme || prefs.theme || "mid"
    });
  }, [contrast, onPreview, plainLanguage, prefs.contrast, prefs.theme, prefs.uiProfile, prefs.uiScale, reduceMotion, reduceTransparency, theme, uiProfile, uiScale]);
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

  const stationLabel = (station) => t(station.legend);
  const positionLine = t("room.position")
    .replace("{current}", String(activeIndex + 1))
    .replace("{total}", String(STATIONS.length));

  const renderStation = (station) => {
    switch (station.key) {
      case "language":
        return (
          <fieldset className="csp-step">
            <legend>{t("accessibility.language")}</legend>
            <div>
              <OptionCard
                inputRef={firstFocusRef}
                data-autofocus=""
                type="radio"
                name="lg"
                value="et"
                checked={lang === "et"}
                onChange={() => setLang("et")}
              >
                <span>{t("accessibility.options.language.et")}</span>
              </OptionCard>
              <OptionCard type="radio" name="lg" value="ru" checked={lang === "ru"} onChange={() => setLang("ru")}>
                <span>{t("accessibility.options.language.ru")}</span>
              </OptionCard>
              <OptionCard type="radio" name="lg" value="en" checked={lang === "en"} onChange={() => setLang("en")}>
                <span>{t("accessibility.options.language.en")}</span>
              </OptionCard>
            </div>
          </fieldset>
        );
      case "contrast":
        return (
          <fieldset className="csp-step">
            <legend>{t("accessibility.contrast")}</legend>
            <div>
              <OptionCard data-autofocus="" type="radio" name="ct" value="normal" checked={contrast === "normal"} onChange={() => setContrast("normal")}>
                <span>{t("accessibility.options.contrast.normal")}</span>
              </OptionCard>
              <OptionCard type="radio" name="ct" value="hc" checked={contrast === "hc"} onChange={() => setContrast("hc")}>
                <span>{t("accessibility.options.contrast.hc")}</span>
              </OptionCard>
            </div>
          </fieldset>
        );
      case "text_scale":
        return (
          <fieldset className="csp-step">
            <legend>{t("accessibility.text_scale")}</legend>
            <div>
              {["sm", "md", "lg", "xl"].map((size, i) => (
                <OptionCard
                  key={size}
                  {...(i === 0 ? { "data-autofocus": "" } : {})}
                  type="radio"
                  name="ts"
                  value={size}
                  checked={uiScale === size}
                  onChange={() => setUiScale(size)}
                >
                  <span>{t(`accessibility.options.text_scale.${size}`)}</span>
                </OptionCard>
              ))}
            </div>
          </fieldset>
        );
      case "theme":
        return (
          <fieldset className="csp-step">
            <legend>{t("accessibility.theme")}</legend>
            <div>
              {/* LUKUS (07.07): platvorm avaldab ainult "Hämar" (mid).
                  Hele/Öö on karkass (Fable 5 viimistleb) — kuni siis on
                  valik peidetud ja runtime sunnib alati mid'i. */}
              <OptionCard data-autofocus="" type="radio" name="theme" value="mid" checked={theme === "mid"} onChange={() => setTheme("mid")}>
                <span>{t("accessibility.options.theme.mid")}</span>
              </OptionCard>
            </div>
          </fieldset>
        );
      case "screen_profile":
        return (
          <fieldset className="csp-step">
            <legend>{t("accessibility.screen_profile")}</legend>
            <div>
              {["sm", "mac", "lg"].map((value, i) => (
                <OptionCard
                  key={value}
                  {...(i === 0 ? { "data-autofocus": "" } : {})}
                  type="radio"
                  name="sp"
                  value={value}
                  checked={uiProfile === value}
                  onChange={() => setUiProfile(value)}
                >
                  <span>{t(`accessibility.options.screen_profile.${value}`)}</span>
                </OptionCard>
              ))}
            </div>
          </fieldset>
        );
      case "plain_language":
        return (
          <fieldset className="csp-step">
            <legend>{t("accessibility.plain_language.title")}</legend>
            <div>
              <OptionCard
                data-autofocus=""
                type="checkbox"
                checked={plainLanguage}
                onChange={event => setPlainLanguage(event.target.checked)}
              >
                <span>{t("accessibility.plain_language.option")}</span>
                <small>{t("accessibility.plain_language.description")}</small>
              </OptionCard>
            </div>
          </fieldset>
        );
      case "motion":
        return (
          <fieldset className="csp-step">
            <legend>{t("accessibility.motion")}</legend>
            <div>
              <OptionCard
                data-autofocus=""
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
        );
      case "ambient":
        return (
          <fieldset className="csp-step">
            <legend>{t("accessibility.ambient")}</legend>
            <div>
              {["off", "a", "b", "c"].map((value, i) => (
                <OptionCard
                  key={value}
                  {...(i === 0 ? { "data-autofocus": "" } : {})}
                  type="radio"
                  name="amb"
                  value={value}
                  checked={ambient === value}
                  onChange={() => chooseAmbient(value)}
                >
                  <span>{t(`accessibility.options.ambient.${value}`)}</span>
                </OptionCard>
              ))}
            </div>
          </fieldset>
        );
      case "save":
      default:
        return (
          <div className="csp-step a11f-save">
            <p className="a11f-save-title">{t("profile.preferences.title")}</p>
            <Button
              data-autofocus=""
              type="button"
              variant="primary"
              onClick={save}
              aria-label={t("accessibility.save")}
              disabled={saveDisabled}
            >
              <span>{t("accessibility.save")}</span>
            </Button>
          </div>
        );
    }
  };

  return <>
      {/* Loor katab lennu ajal terve ekraani — kaardirivi ei tohi taga
          paista (omanik 21.07). Klõps loorile sulgeb, nagu varemgi. */}
      <div className="a11f-veil" onClick={onClose} role="presentation" aria-hidden="true" />

      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="a11y-title" onClick={stopInside} tabIndex={-1}>
        <div aria-hidden="false">
          <h2 id="a11y-title">
            <span>{a11yTitleLine1}</span>
            <span>{a11yTitleLine2}</span>
          </h2>
        </div>

        <p className="sr-only" aria-live="polite">
          {`${positionLine} — ${stationLabel(STATIONS[activeIndex] || STATIONS[0])}`}
        </p>

        {/* Lennulava: jaamad seisavad sügavuses, kaamera lendab nende vahel.
            Plaanid peavad olema dolly OTSESED lapsed (perspective, §3). */}
        <div className="a11f-stage" data-mode={mode} ref={stageRef}>
          <div className="a11f-dolly" ref={dollyRef}>
            {STATIONS.map((station, index) => (
              <section
                key={station.key}
                {...planeProps(index)}
                className="a11f-plane"
                data-station={station.key}
                aria-label={stationLabel(station)}
              >
                {renderStation(station)}
              </section>
            ))}
          </div>
        </div>

        {/* Dokk = ruumi kaardimenüü DNA (carousel.css .gc-shortcut-*).
            Erinevalt registrist EI OLE ühtegi jaama lukus: eelistused on
            iseseisvad valikud, mitte järjestikune vorm. */}
        <nav className="a11f-dock gc-shortcut-menu" aria-label={t("profile.preferences.title")}>
          <button
            type="button"
            className="gc-shortcut gc-shortcut--back"
            data-on="0"
            disabled={activeIndex === 0}
            onClick={() => goTo(activeIndex - 1)}
            aria-label={t("buttons.back")}
          >
            <span className="gc-shortcut-icon" aria-hidden="true">
              <ChevronIcon direction="left" />
            </span>
            <span className="gc-shortcut-tooltip" aria-hidden="true">
              {t("buttons.back")}
            </span>
          </button>
          <span className="gc-shortcut-divider" aria-hidden="true" />
          <div className="gc-shortcut-track">
            {STATIONS.map((station, index) => {
              const label = stationLabel(station);
              const isActive = index === activeIndex;
              return (
                <button
                  key={station.key}
                  type="button"
                  className="gc-shortcut"
                  data-on={isActive ? "1" : "0"}
                  data-state={isActive ? "active" : "open"}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={label}
                  onClick={() => goTo(index)}
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
      </div>
    </>;
}
