"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSpeech } from "@/components/chat/hooks/useSpeech";
import { useI18n } from "@/components/i18n/I18nProvider";

/* Kõnetuvastuse vastust oodatakse kuni nii kaua; kliendi enda ajapiir on 90 s. */
const WAITING_MAX_MS = 95_000;

/**
 * Dikteerimine kirje vormis.
 *
 * Kasutab platvormi enda kõnetuvastust (`useSpeech` ja `/api/stt`), sama mida
 * vestlus: mikrofoni loa küsimine, vaikuse äratundmine, salvestuse pikkuse piir
 * ja kordussaatmise võti on juba seal. Tekst LISATAKSE väljale ja inimene loeb
 * selle enne salvestamist üle; helisalvestist ei hoita.
 *
 * Eraldi komponent, et `useSpeech` oleks lehel ainult seal, kus dikteerimist
 * päriselt pakutakse.
 *
 * „Muudan tekstiks" on näha lõpetamise vajutusest kuni tekst (või viga) kohale
 * jõuab: kõnetuvastus võtab mõne sekundi ja ilma selleta ei oleks näha, kas
 * midagi toimub.
 */
export default function HomeCareDictation({ onText, disabled = false, describedBy }) {
  const { t, locale } = useI18n();
  const [waiting, setWaiting] = useState(false);
  const waitingTimer = useRef(null);

  const stopWaiting = useCallback(() => {
    if (waitingTimer.current) clearTimeout(waitingTimer.current);
    waitingTimer.current = null;
    setWaiting(false);
  }, []);

  const handleText = useCallback(
    (spoken) => {
      stopWaiting();
      onText?.(spoken);
    },
    [onText, stopWaiting]
  );

  const speech = useSpeech({ locale, onAppendText: handleText, t });

  useEffect(
    () => () => {
      if (waitingTimer.current) clearTimeout(waitingTimer.current);
    },
    []
  );

  const toggle = () => {
    if (speech.recording) {
      /* Lõpetamine: salvestus läheb tekstiks muutmisele. */
      setWaiting(true);
      if (waitingTimer.current) clearTimeout(waitingTimer.current);
      waitingTimer.current = setTimeout(stopWaiting, WAITING_MAX_MS);
    } else {
      stopWaiting();
    }
    speech.handleMic();
  };

  const showWaiting = waiting && !speech.recording && !speech.recordingError;

  return (
    <div className="hc-field">
      <div className="hc-row">
        <button
          className={`hc-btn${speech.recording ? " hc-btn--danger" : " hc-btn--quiet"}`}
          type="button"
          onClick={toggle}
          disabled={disabled || showWaiting}
          aria-pressed={speech.recording}
          aria-describedby={describedBy}
        >
          {speech.recording ? t("home_care.dictation.stop") : t("home_care.dictation.start")}
        </button>
        {speech.recording ? (
          <button className="hc-btn hc-btn--quiet" type="button" onClick={speech.cancelRecording}>
            {t("home_care.dictation.discard")}
          </button>
        ) : null}
      </div>
      {speech.recording ? (
        <p className="hc-hint" role="status">
          {t("home_care.dictation.listening")}
        </p>
      ) : null}
      {showWaiting ? (
        <p className="hc-hint" role="status">
          {t("home_care.dictation.transcribing")}
        </p>
      ) : null}
      {speech.recordingError ? (
        <p className="hc-error" role="alert">
          {speech.recordingError}
        </p>
      ) : null}
      {speech.voiceNotice && !speech.recordingError ? (
        <p className="hc-hint" role="status">
          {speech.voiceNotice}
        </p>
      ) : null}
    </div>
  );
}
