"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSpeech } from "@/components/chat/hooks/useSpeech";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SMALL } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import Button from "@/components/ui/Button";

import styles from "./entry/entry.module.css";

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
 *
 * `hint`: selgitus nupu all (uue kirje sammudes; kirje paranduses jääb see ära,
 * et vaade mahuks telefoni ekraanile). `describedBy`: kutsuja enda selgituse ID,
 * kui ta näitab selgitust ise.
 */
export default function HomeCareDictation({ onText, disabled = false, describedBy, hint = "" }) {
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

  /* Seisu read on `aria-live`, mitte role="status": ühine lehekiht joonistab iga status-rolliga elemendi teatekastina. */
  return (
    <div className={styles.dictation}>
      <div className={styles.dictationRow}>
        <Button
          {...SMALL}
          className={speech.recording ? shared.armed : undefined}
          data-dictation={speech.recording ? "stop" : "start"}
          onClick={toggle}
          disabled={disabled || showWaiting}
          aria-pressed={speech.recording}
          aria-describedby={describedBy}
        >
          {speech.recording ? t("home_care.dictation.stop") : t("home_care.dictation.start")}
        </Button>
        {speech.recording ? (
          <Button {...SMALL} data-dictation="discard" onClick={speech.cancelRecording}>
            {t("home_care.dictation.discard")}
          </Button>
        ) : null}
      </div>
      {speech.recording ? (
        <p className={shared.hint} aria-live="polite">
          {t("home_care.dictation.listening")}
        </p>
      ) : null}
      {showWaiting ? (
        <p className={shared.hint} aria-live="polite">
          {t("home_care.dictation.transcribing")}
        </p>
      ) : null}
      {speech.recordingError ? (
        <p className={shared.notice} data-tone="risk" role="alert">
          {speech.recordingError}
        </p>
      ) : null}
      {speech.voiceNotice && !speech.recordingError ? (
        <p className={shared.hint} aria-live="polite">
          {speech.voiceNotice}
        </p>
      ) : null}
      {hint && !speech.recording && !showWaiting ? <p className={shared.hint}>{hint}</p> : null}
    </div>
  );
}
