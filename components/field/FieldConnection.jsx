"use client";

/**
 * FieldConnection — välitöö ühenduse seis.
 *
 * MIKS. Seis oli riba paneeli sisu ülaservas, mis kerides kleepus kohale
 * (`position: sticky`) ja jäi vormi peale: ettevalmistusvormis kattis see
 * eesmärgi välja (kujundusaudit K04). Välitöö leping (FIELD-A0 ptk 7.2) nõuab,
 * et võrguolek oleks alati näha. Alati näha on kiirmenüü, mitte paneeli sisu:
 *
 *  - kiirmenüüs lehe nime kõrval on lühike märk („Võrgus", „Saatmata 3",
 *    „Võrguta"). See ei kata kunagi sisu ja on pöidla ulatuses;
 *  - kui midagi vajab tähelepanu (võrguta, saatmata üksused, vead, sisselogimine),
 *    on täislause ka lehe sisu alguses tavalise teatena, mis kerib koos sisuga;
 *  - ekraanilugeja kuuleb muutust `aria-live` teatest (mitte role="status":
 *    ühine lehekiht joonistab iga status-rolliga elemendi teatekastina).
 *
 * Lehel, kus kiirmenüüd ei ole, seisab teade alati sisu alguses.
 *
 * Märk joonistatakse doki pessa (`components/stage/DockSteps.jsx`), kuhu
 * sammudega lehed panevad oma sammud; välitöö lehtedel samme seal ei ole.
 *
 * Seisu reegel: connectionState.js. Kujundus: fieldConnection.module.css.
 */

import { createPortal } from "react-dom";

import { useDockStepsSlot } from "@/components/stage/DockSteps";

import { fieldConnectionState } from "./connectionState";
import styles from "./fieldConnection.module.css";

export default function FieldConnection({ t, online, pendingCount = 0, failedCount = 0, needsLogin = false }) {
  const { slot, hasDock } = useDockStepsSlot();
  const state = fieldConnectionState({ online, pendingCount, failedCount, needsLogin });

  const sentence = [
    state.key === "offline"
      ? t("field.sync.offline")
      : state.pending
        ? t("field.sync.onlinePending").replace("{count}", String(state.pending))
        : t("field.sync.online"),
    state.failed ? t("field.sync.failed").replace("{count}", String(state.failed)) : "",
    state.needsLogin ? t("field.sync.needsLogin") : ""
  ]
    .filter(Boolean)
    .join(" · ");
  const short =
    state.key === "offline"
      ? t("field.sync.short.offline")
      : state.key === "failed"
        ? t("field.sync.short.failed").replace("{count}", String(state.failed))
        : state.key === "pending"
          ? t("field.sync.short.pending").replace("{count}", String(state.pending))
          : t("field.sync.short.online");

  const chip =
    hasDock && slot
      ? createPortal(
          <>
            <span className={`${styles.divider} gc-shortcut-divider`} aria-hidden="true" />
            <span className={styles.chip} data-state={state.key} title={sentence}>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.chipText}>{short}</span>
            </span>
          </>,
          slot
        )
      : null;

  return (
    <>
      {chip}
      {state.attention || !hasDock ? (
        <p className={styles.notice} data-state={state.key} aria-live="polite">
          {sentence}
        </p>
      ) : (
        <p className="sr-only" aria-live="polite">
          {sentence}
        </p>
      )}
    </>
  );
}
