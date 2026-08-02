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
/* Tagasi kannab SAMA noolt mis ruumi dokk (BackArrowIcon, 24-ruudustik).
   ChevronIcon on karusselli servanool: tema ruudustik on 4,8 × 8,6 ja
   joon 1,45 selle sees — samas ringis loeb see hoopis jämedama ja
   kõrgema nooleks (omanik 25.07: "nool on vale keele omas"). */
import { BackArrowIcon } from "@/components/brand/icons/CardIcons";
import useStationFlight from "@/components/register/useStationFlight";
import {
  AMBIENT_MODES,
  getAmbientMode,
  setAmbientMode,
} from "@/components/room/AmbientAudio";

/* Jaamad samas järjekorras nagu varem sektsioonid. Viimane on Salvesta —
   sama muster mis registri väraval (teekonna lõpus on tegu, mitte valik). */
const STATIONS = [
  { key: "language", legend: "accessibility.language" },
  { key: "contrast", legend: "accessibility.contrast" },
  { key: "text_scale", legend: "accessibility.text_scale" },
  { key: "theme", legend: "accessibility.theme" },
  { key: "screen_profile", legend: "accessibility.screen_profile" },
  { key: "motion", legend: "accessibility.motion" },
  { key: "ambient", legend: "accessibility.ambient" },
  { key: "save", legend: "profile.preferences.title" },
];

/* Valik = edasiliikumine (omanik 02.08: „kui teen valiku, siis võiks ise
   järgmise valiku juurde minna"). Kehtib ühevalikuliste jaamade kohta, kus
   üks klõps TEEB valiku valmis. Välja jäävad teadlikult kaks:
   - „liikumine" = kaks sõltumatut linnukest, esimene klõps ei ole veel
     lõplik valik → äralend katkestaks teise linnukese;
   - „taustaheli" = kuulamisjaam, kus meloodiaid võrreldakse omavahel. */
const AUTO_ADVANCE_STATIONS = new Set([
  "language",
  "contrast",
  "text_scale",
  "theme",
  "screen_profile",
]);
/* Napp viide, et kasutaja jõuaks oma valikut süttimas näha, enne kui
   kaamera liikuma hakkab (lend ise algab ease-in'iga aeglaselt). Käib
   lennutempoga kaasa — 02.08 tõmmatud 380 → 260 ms. */
const AUTO_ADVANCE_DELAY_MS = 260;

/* Auto-edasi AINULT osutiga tehtud valikul. Klaviatuuriga käiakse
   raadionuppude vahel nooltega ja OptionCard „valib" iga vahepeatuse
   (kutsub .click()) — automaatne äralend teeks jaama läbivaatamise
   võimatuks. Sünteetilisel klõpsul on detail === 0, päris hiire- ja
   puuteklõpsul ≥ 1. */
const isPointerChoice = (event) => (event?.nativeEvent?.detail ?? 0) > 0;

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
    /* Modaal on väiksem, ekraanikeskne pind kui /registreerimine — täis
       34px-nihe (ja ka pool sellest) mõjus siin liiga tugevana (omanik
       24.07). Vaid veerand algsest: napp ruumivihje, lava jääb paigale. */
    parallaxRange: 8,
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

  /* Valiku järgne iselend (vt AUTO_ADVANCE_STATIONS). Uus valik samas
     jaamas lükkab lendu edasi, mitte ei kuhja lende üksteise otsa. */
  const advanceTimerRef = useRef(null);
  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current == null) return;
    window.clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = null;
  }, []);
  const advanceAfterChoice = useCallback(() => {
    clearAdvanceTimer();
    const from = activeIndexRef.current;
    if (from >= STATIONS.length - 1) return;
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      /* Kasutaja võis vahepeal ise doki või kerimisega mujale lennata —
         siis ei tohi vana valik teda enam kaasa tõmmata. */
      if (activeIndexRef.current !== from) return;
      goTo(from + 1);
    }, AUTO_ADVANCE_DELAY_MS);
  }, [clearAdvanceTimer, goTo]);
  useEffect(() => clearAdvanceTimer, [clearAdvanceTimer]);

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
  /* Keri-vihje (sama sõnatu nooleke mis avalehel, room.css .room-hint):
     nähtav ainult ENNE esimest lendu ja kaob JÄÄDAVALT, niipea kui
     kasutaja on korra edasi liikunud (omanik 26.07: „kaob ära pärast
     esmast kerimist, kui on jõutud järgmise seadeni") — ei tule tagasi,
     kui kasutaja hiljem esimesele jaamale naaseb. */
  const [scrollHintDismissed, setScrollHintDismissed] = useState(false);
  useEffect(() => {
    if (prevIndexRef.current === activeIndex) return;
    prevIndexRef.current = activeIndex;
    setScrollHintDismissed(true);
    /* Fookus tuleb kohale lennu lõpupoole (~2/3 kestusest), et ta ei hüppaks
       veel lendavale jaamale. Käib lennutempoga kaasa: lend ~0,51 s. */
    const delay = mode === "3d" ? 350 : 80;
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
      /* Ooteaeg ≥ lennu kestus (~510 ms): järgmine kerimisnõks ei katkestaks
         pooleliolevat lendu — just katkestatud lend nägi kerides välja nii,
         et nupud „kaovad koledalt ära" (omanik 25.07). See arv PEAB käima
         lennutempoga kaasa: vahe ooteaja ja lennu vahel on surnud aeg, kus
         keris ei tee midagi, ja just see luges „uimasena" (omanik 02.08). */
      cooldown.until = stamp + 540;
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

  /* Väljapääs (omanik 25.07: „tagasi nupp ei tööta kui ma avan selle juba
     hiljem — peab minema lõpuni ja salvestama"). Loor on täisekraanilise
     dialoogi ALL (a11y-modal.css z-index), seega tema klõps ei jõua kohale
     ja Escape jäi ainsaks väljapääsuks. Esimesel jaamal ei ole kuhu tagasi
     lennata → seal saab tagasi-noolest sulgemisnupp. Esmakülastusel (kus
     eelistused alles valitakse) jääb ta endiselt lukku: seal ON teekond. */
  const backIsExit = activeIndex === 0 && !requireInitialSelection;
  const backLabel = backIsExit ? t("buttons.close") : t("buttons.back");

  const stationLabel = (station) => t(station.legend);
  const positionLine = t("room.position")
    .replace("{current}", String(activeIndex + 1))
    .replace("{total}", String(STATIONS.length));

  const renderStation = (station) => {
    /* Iga valik käib siit läbi: setter jookseb alati, iselend ainult
       ühevalikulistes jaamades ja ainult osutiga tehtud valikul. */
    const onPick = (apply) => (event) => {
      apply(event);
      if (!AUTO_ADVANCE_STATIONS.has(station.key)) return;
      if (!isPointerChoice(event)) return;
      advanceAfterChoice();
    };
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
                onChange={onPick(() => setLang("et"))}
              >
                <span>{t("accessibility.options.language.et")}</span>
              </OptionCard>
              <OptionCard type="radio" name="lg" value="ru" checked={lang === "ru"} onChange={onPick(() => setLang("ru"))}>
                <span>{t("accessibility.options.language.ru")}</span>
              </OptionCard>
              <OptionCard type="radio" name="lg" value="en" checked={lang === "en"} onChange={onPick(() => setLang("en"))}>
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
              <OptionCard data-autofocus="" type="radio" name="ct" value="normal" checked={contrast === "normal"} onChange={onPick(() => setContrast("normal"))}>
                <span>{t("accessibility.options.contrast.normal")}</span>
              </OptionCard>
              <OptionCard type="radio" name="ct" value="hc" checked={contrast === "hc"} onChange={onPick(() => setContrast("hc"))}>
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
                  onChange={onPick(() => setUiScale(size))}
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
              <OptionCard data-autofocus="" type="radio" name="theme" value="mid" checked={theme === "mid"} onChange={onPick(() => setTheme("mid"))}>
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
                  onChange={onPick(() => setUiProfile(value))}
                >
                  <span>{t(`accessibility.options.screen_profile.${value}`)}</span>
                </OptionCard>
              ))}
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
                onChange={onPick(e => setReduceMotion(e.target.checked))}
              >
                <span>{t("accessibility.options.motion.reduce")}</span>
              </OptionCard>
              <OptionCard
                type="checkbox"
                checked={reduceTransparency}
                onChange={onPick(e => setReduceTransparency(e.target.checked))}
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
              {["off", ...AMBIENT_MODES].map((value, i) => (
                <OptionCard
                  key={value}
                  {...(i === 0 ? { "data-autofocus": "" } : {})}
                  type="radio"
                  name="amb"
                  value={value}
                  checked={ambient === value}
                  onChange={onPick(() => chooseAmbient(value))}
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
          paista (omanik 21.07). NB: dialoog ise on täisekraanil ja loorist
          KÕRGEMAL (a11y-modal.css z-index), seega see onClick praktikas ei
          käivitu — nähtavad väljapääsud on doki tagasi/sulge-nupp ja Esc. */}
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
          {/* Keri-vihje: sama peen joon + libisev täpp + mikrosilt mis
              avalehel (room.css .room-hint), ainult enne esimest lendu. */}
          {!scrollHintDismissed ? (
            <div className="a11f-scroll-hint" aria-hidden="true">
              <span className="a11f-scroll-hint-track">
                <span className="a11f-scroll-hint-dot" />
              </span>
              <span className="a11f-scroll-hint-label">{t("room.scroll_label")}</span>
            </div>
          ) : null}
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
                {/* Iseseisvad valikud, mitte järjestikune vorm (omanik 24.07:
                    „teade, et valmima ei pea"). Vihje elab VALIKUTE ALL, mitte
                    ekraani ülaservas, ja AINULT liikumise-jaamas — omanik 25.07:
                    „see väike tekst ei ole igal pool, ainult selle valiku all".
                    Igal jaamal korrates muutub ta müraks; ühes kohas loeb ta
                    kogu modaali kohta. */}
                {station.key === "motion" && (
                  <p className="a11f-optional-hint">{t("accessibility.optional_hint")}</p>
                )}
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
            disabled={activeIndex === 0 && !backIsExit}
            onClick={() => (backIsExit ? onClose?.() : goTo(activeIndex - 1))}
            aria-label={backLabel}
          >
            <span className="gc-shortcut-icon" aria-hidden="true">
              <BackArrowIcon />
            </span>
            <span className="gc-shortcut-tooltip" aria-hidden="true">
              {backLabel}
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
