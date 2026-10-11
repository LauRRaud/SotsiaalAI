"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { OUTBOX_LIMIT, OutboxState, isBlocked, needsPerson, outboxSummary, previewText } from "@/lib/homeCare/outbox";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

import { formatDateTime } from "./homeCareClient";
import { useHomeCareOutbox } from "./homeCareOutbox";

/**
 * Seadmes ootel kirjed: riba koduteenuse avalehel ja kliendi lehel.
 *
 * Riba on näha ainult siis, kui midagi ootab. Ootel kirje saadetakse ise, kui
 * ühendus taastub; nupp „Saada kohe" on selleks, et inimene ei peaks ootama.
 *
 * KIRJE, MILLE SERVER TAGASI LÜKKAS, jääb seadmesse koos täistekstiga: inimene
 * saab teksti kopeerida ja kirje uuesti kirjutada. Kustutamine on kahe
 * sammuga, sest see on ainus koht, kus tehtud töö saab päriselt kaduda.
 *
 * LIGIPÄÄSUTA KIRJE (403 või 404: asendaja luba lõppes, inimene eemaldati
 * meeskonnast, koduteenus on hetkeks suletud) jääb ootele ja seda proovitakse
 * edasi, aga riba näitab täisteksti ja ütleb, mida teha: muidu ootaks kirje
 * vaikselt ühendust, mis on tegelikult olemas.
 *
 * TAGASI LÜKATUD KIRJE saab uuesti teele panna („Proovi uuesti"), kui põhjus on
 * kõrvaldatud; kirje võti ja ooteaja algus jäävad samaks.
 *
 * Kellaaeg loendis on SEADME kell (millal salvestamist vajutati). Päevikusse
 * jõuab sündmuse aeg serveri arvutatuna.
 */
export default function HomeCareOutbox({ ownerId, timeZone }) {
  const { t, locale } = useI18n();
  const { items, flushing, manager } = useHomeCareOutbox(ownerId, { locale });
  const [confirming, setConfirming] = useState("");

  if (!manager || items.length === 0) return null;
  const summary = outboxSummary(items);

  return (
    <section className="hc-section hc-section--card" aria-live="polite">
      <h2 className="hc-section-title">{t("home_care.outbox.title", { count: summary.total })}</h2>
      <p className="hc-hint">{t("home_care.outbox.hint")}</p>

      <ul className="hc-list hc-list--plain">
        {items.map((item) => {
          const attention = item.state === OutboxState.ATTENTION;
          const blocked = isBlocked(item);
          const stuck = needsPerson(item);
          const text = item.payload?.body?.text || "";
          const reason =
            item.lastMessageKey || attention
              ? resolveApiMessage({
                  payload: { messageKey: item.lastMessageKey || "" },
                  t,
                  fallbackKey: "home_care.errors.save_failed"
                })
              : "";
          return (
            <li key={item.clientRequestId} className="hc-entry">
              <div className="hc-entry__head">
                <span className="hc-entry__author">
                  {item.unreadable ? t("home_care.outbox.unreadable") : item.payload?.clientName || ""}
                </span>
                <span className={`hc-badge${stuck ? " hc-badge--warn" : ""}`}>
                  {blocked
                    ? t("home_care.outbox.item_blocked")
                    : stuck
                      ? t("home_care.outbox.item_attention")
                      : t("home_care.outbox.item_pending")}
                </span>
              </div>
              {/* Aeg antakse arvuna: vigane väärtus seadme salvestises annab tühja rea, mitte erindi. */}
              <p className="hc-entry__meta">
                {t("home_care.outbox.written_at", { time: formatDateTime(item.queuedAtMs, timeZone) })}
              </p>
              {item.unreadable ? null : (
                <p className="hc-entry__text">{stuck ? text : previewText(text)}</p>
              )}
              {reason ? <p className="hc-entry__meta">{t("home_care.outbox.last_error", { message: reason })}</p> : null}
              {attention ? <p className="hc-hint">{t("home_care.outbox.attention_hint")}</p> : null}
              {blocked ? <p className="hc-hint">{t("home_care.outbox.blocked_hint")}</p> : null}
              {stuck ? (
                <div className="hc-row">
                  {attention && confirming !== item.clientRequestId ? (
                    <button
                      className="hc-btn"
                      type="button"
                      onClick={() => manager.retry(item.clientRequestId)}
                      disabled={flushing}
                    >
                      {t("home_care.outbox.retry")}
                    </button>
                  ) : null}
                  {confirming === item.clientRequestId ? (
                    <>
                      <button
                        className="hc-btn hc-btn--danger"
                        type="button"
                        onClick={() => {
                          setConfirming("");
                          manager.discard(item.clientRequestId);
                        }}
                      >
                        {t("home_care.outbox.delete_confirm")}
                      </button>
                      <button className="hc-btn" type="button" onClick={() => setConfirming("")}>
                        {t("home_care.outbox.keep")}
                      </button>
                    </>
                  ) : (
                    <button
                      className="hc-btn hc-btn--quiet"
                      type="button"
                      onClick={() => setConfirming(item.clientRequestId)}
                    >
                      {t("home_care.outbox.delete")}
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {summary.total >= OUTBOX_LIMIT ? (
        <p className="hc-notice hc-notice--warn">{t("home_care.outbox.full", { limit: OUTBOX_LIMIT })}</p>
      ) : null}

      {summary.pending > 0 ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--primary" type="button" onClick={() => manager.flush()} disabled={flushing}>
            {flushing ? t("home_care.outbox.sending") : t("home_care.outbox.send_now")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
