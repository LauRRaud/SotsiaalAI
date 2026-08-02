"use client";

/**
 * OMA KUUPÄEVAVÄLI — natiivse `<input type="date">` asemel.
 *
 * MIKS ÜLDSE OMA. Natiivsel väljal on kaks viga, mida lehelt EI SAA parandada:
 *
 *   1. KEEL. Kalendri paneeli keel tuleb BRAUSERI liidesekeelest, mitte lehe
 *      `lang`-ist. Eestikeelsel lehel avanes ingliskeelses Chrome'is
 *      ingliskeelne kalender ja `lang="et"` ei muutnud seda — ta mõjutab ainult
 *      välja enda kuvaformaati.
 *   2. KUJUNDUS. `color-scheme: dark` teeb paneeli tumedaks, aga ei anna talle
 *      klaasi, raadiust ega platvormi värve. Ülejäänut ei saa CSS-iga puutuda.
 *
 * KUUNIMED TULEVAD `Intl`-IST, mitte sõnastikust: nii on nad õiges keeles ja
 * õiges käändes kõigis kolmes keeles ilma, et keegi peaks 12 nime × 3 keelt
 * käsitsi hooldama.
 *
 * VÄÄRTUS JÄÄB ISO-KUJUSSE (`AAAA-KK-PP` või `AAAA-KK`). Vorm, server ja testid
 * näevad täpselt sama, mida natiivne väli andis — see ei ole uus andmekuju,
 * vaid uus VALIJA.
 *
 * `mode="month"` annab kuuvalija (12 kuud + aasta), `mode="date"` päevakalendri.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

function pad(value) {
  return String(value).padStart(2, "0");
}

function toIsoDate(year, monthIndex, day) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function parseValue(value, mode) {
  const raw = String(value || "");
  if (mode === "month") {
    if (!ISO_MONTH.test(raw)) return null;
    const [year, month] = raw.split("-").map(Number);
    return { year, monthIndex: month - 1, day: 1 };
  }
  if (!ISO_DATE.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  return { year, monthIndex: month - 1, day };
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Nädala esimene päev on ESMASPÄEV. `Intl` ei anna seda kõigis brauserites
 * (`weekInfo` on osaliselt toetatud) ja Eestis ei alga nädal pühapäevaga —
 * vale algus nihutaks terve kuu ühe veeru võrra ja seda ei märkaks keegi enne,
 * kui ta vale kuupäeva valib.
 */
const FIRST_WEEKDAY = 1;

function leadingBlanks(year, monthIndex) {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return (firstDay - FIRST_WEEKDAY + 7) % 7;
}

export default function DateField({
  name,
  value,
  onChange,
  mode = "date",
  required = false,
  disabled = false,
  className = "",
  ariaLabel = null
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseValue(value, mode), [value, mode]);
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    year: parsed?.year ?? today.getFullYear(),
    monthIndex: parsed?.monthIndex ?? today.getMonth()
  }));
  const rootRef = useRef(null);
  const dialogId = useId();

  /* Kursor järgib välist väärtust: kui vorm täidetakse eeltäitest (Välitöö
     sild), peab kalender avanema seal, kus kuupäev on — mitte tänases kuus. */
  useEffect(() => {
    if (parsed) setCursor({ year: parsed.year, monthIndex: parsed.monthIndex });
  }, [parsed]);

  const monthNames = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale || "et", { month: "long" });
    return Array.from({ length: 12 }, (_, index) =>
      formatter.format(new Date(Date.UTC(2026, index, 1)))
    );
  }, [locale]);

  const weekdayNames = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale || "et", { weekday: "short" });
    /* 2026-01-05 oli esmaspäev — ankur, et nädalapäevad algaksid esmaspäevast
       sõltumata sellest, mida `Intl` ise esimeseks peab. */
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(Date.UTC(2026, 0, 5 + index)))
    );
  }, [locale]);

  const label = useMemo(() => {
    if (!parsed) return t("date_field.empty", "");
    if (mode === "month") return `${monthNames[parsed.monthIndex]} ${parsed.year}`;
    return new Intl.DateTimeFormat(locale || "et", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date(Date.UTC(parsed.year, parsed.monthIndex, parsed.day)));
  }, [locale, mode, monthNames, parsed, t]);

  const close = useCallback(() => setOpen(false), []);

  /* Väljaspoole klõps ja Escape sulgevad. Ilma nendeta jääks paneel lahti ja
     kataks vormi, mida kasutaja järgmisena täita tahab. */
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) close();
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [close, open]);

  const emit = useCallback(
    (next) => {
      onChange?.(next);
      close();
    },
    [close, onChange]
  );

  const shiftMonth = useCallback((delta) => {
    setCursor((current) => {
      const total = current.year * 12 + current.monthIndex + delta;
      return { year: Math.floor(total / 12), monthIndex: ((total % 12) + 12) % 12 };
    });
  }, []);

  const days = useMemo(() => {
    const count = daysInMonth(cursor.year, cursor.monthIndex);
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [cursor]);

  const todayIso = toIsoDate(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className={["df", className].filter(Boolean).join(" ")} ref={rootRef}>
      {/* VÄÄRTUS ON PEIDETUD VÄLJAL, mitte komponendi olekus üksi: vorm,
          `required`-valideerimine ja testid näevad täpselt sama nime ja sama
          ISO-kuju, mida natiivne väli andis. */}
      <input type="hidden" name={name} value={value || ""} />

      <button
        type="button"
        className="sl-input df-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-label={ariaLabel || undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={parsed ? "" : "df-placeholder"}>{label}</span>
        <span aria-hidden="true" className="df-caret" />
      </button>

      {/* `required` ilma natiivse väljata: tühi väärtus ütleb seda ise, sest
          brauseri oma teadet siin enam ei tule. */}
      {required && !parsed ? <span className="df-required">{t("date_field.required", "")}</span> : null}

      {open ? (
        <div className="df-pop" id={dialogId} role="dialog" aria-modal="false" aria-label={label}>
          <div className="df-head">
            <button
              type="button"
              className="df-nav"
              onClick={() => (mode === "month" ? shiftMonth(-12) : shiftMonth(-1))}
              aria-label={t("date_field.previous", "")}
            >
              ‹
            </button>
            <span className="df-title">
              {mode === "month" ? cursor.year : `${monthNames[cursor.monthIndex]} ${cursor.year}`}
            </span>
            <button
              type="button"
              className="df-nav"
              onClick={() => (mode === "month" ? shiftMonth(12) : shiftMonth(1))}
              aria-label={t("date_field.next", "")}
            >
              ›
            </button>
          </div>

          {mode === "month" ? (
            <div className="df-months">
              {monthNames.map((monthName, index) => {
                const iso = `${cursor.year}-${pad(index + 1)}`;
                return (
                  <button
                    key={monthName}
                    type="button"
                    className={`df-cell${value === iso ? " is-selected" : ""}`}
                    onClick={() => emit(iso)}
                  >
                    {monthName}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="df-week" aria-hidden="true">
                {weekdayNames.map((day) => (
                  <span key={day} className="df-weekday">
                    {day}
                  </span>
                ))}
              </div>
              <div className="df-grid">
                {Array.from({ length: leadingBlanks(cursor.year, cursor.monthIndex) }, (_, index) => (
                  <span key={`blank-${index}`} className="df-blank" />
                ))}
                {days.map((day) => {
                  const iso = toIsoDate(cursor.year, cursor.monthIndex, day);
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={[
                        "df-cell",
                        value === iso ? "is-selected" : "",
                        iso === todayIso ? "is-today" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-current={iso === todayIso ? "date" : undefined}
                      onClick={() => emit(iso)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* „Täna" on kõige sagedasem valik: teenuskirje tehakse enamasti
              samal päeval ja siis ei pea kalendrist midagi otsima. */}
          {mode === "date" ? (
            <button type="button" className="df-today" onClick={() => emit(todayIso)}>
              {t("date_field.today", "")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
