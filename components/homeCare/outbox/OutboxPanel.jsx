"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

import { formatDateTime } from "../homeCareClient";
import { useHomeCareOutbox } from "../homeCareOutbox";
import { OUTBOX_LIMIT, outboxFull, outboxNotice, outboxPending, outboxRows } from "./outboxRows";
import { OutboxListView, OutboxNoticeRow } from "./OutboxViews";

/**
 * Seadmes ootavad kirjed uuel kihil: lause vaate kohal ja loend omaette vaatena.
 *
 * Lause on näha ainult siis, kui midagi ootab. Ootel kirje saadetakse ise, kui
 * ühendus taastub; „Saada kohe" on selleks, et inimene ei peaks ootama.
 *
 * Vana kihi lehed, mis ei ole veel väikesed vaated, näitavad sama järjekorda
 * kastina (`../HomeCareOutbox.jsx`), kuni nende ühik tuleb.
 */

/** Lause vaate kohal; tühi, kui midagi ei oota. `onOpen` avab loendi vaate. */
export function OutboxNotice({ ownerId, onOpen }) {
  const { t, locale } = useI18n();
  const { items, manager } = useHomeCareOutbox(ownerId, { locale });
  const notice = manager ? outboxNotice(items, { t }) : null;
  return notice ? <OutboxNoticeRow notice={notice} open={t("home_care.outbox.open")} onOpen={onOpen} /> : null;
}

/**
 * Ootavate kirjete loend. Kirje, mis ise teele ei lähe, saab uuesti teele
 * panna või seadmest kustutada; kustutamine küsib teist vajutust samal nupul,
 * sest see on ainus koht, kus tehtud töö saab päriselt kaduda.
 *
 * Kellaaeg loendis on SEADME kell (millal salvestamist vajutati). Päevikusse
 * jõuab sündmuse aeg serveri arvutatuna.
 *
 * `back`: { label, onBack } viib tagasi sinna, kust tuldi.
 */
export default function OutboxPanel({ ownerId, timeZone, back }) {
  const { t, locale } = useI18n();
  const { items, flushing, manager } = useHomeCareOutbox(ownerId, { locale });
  /* Kirje, mille kustutamise esimene vajutus on tehtud. */
  const [armedKey, setArmedKey] = useState("");

  const rows = manager
    ? outboxRows(items, {
        t,
        moment: (value) => formatDateTime(value, timeZone),
        message: (messageKey) => resolveApiMessage({ payload: { messageKey }, t, fallbackKey: "home_care.errors.save_failed" })
      })
    : [];

  return (
    <OutboxListView
      title={t("home_care.outbox.title", { count: rows.length })}
      rows={rows}
      retry={{
        label: t("home_care.outbox.retry"),
        busy: flushing,
        onRetry: (key) => {
          setArmedKey("");
          if (!flushing) manager.retry(key);
        }
      }}
      remove={{
        armedKey,
        label: t("home_care.outbox.delete"),
        confirm: t("home_care.outbox.delete_armed"),
        consequence: t("home_care.outbox.delete_note"),
        onPress: (key) => {
          if (armedKey !== key) {
            setArmedKey(key);
            return;
          }
          setArmedKey("");
          manager.discard(key);
        }
      }}
      done={t("home_care.outbox.done")}
      problem={outboxFull(items) ? t("home_care.outbox.full", { limit: OUTBOX_LIMIT }) : ""}
      hint={t("home_care.outbox.hint")}
      send={manager && outboxPending(items) ? { label: flushing ? t("home_care.outbox.sending") : t("home_care.outbox.send_now"), busy: flushing, onSend: () => (flushing ? null : manager.flush()) } : null}
      back={back}
    />
  );
}
