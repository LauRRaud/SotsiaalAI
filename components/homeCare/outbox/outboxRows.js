/**
 * Seadmes ootavate kirjete reeglid ilma joonistamiseta: mida ütleb teate rida
 * vaate kohal ja mis seisab iga ootava kirje real.
 *
 * Järjekord ise (hoidla, saatmine, kordused) on failis `../homeCareOutbox.js`
 * ja selle reeglid failis `lib/homeCare/outbox.js`; siin on ainult see, mida
 * vaated (`./OutboxViews.jsx`) näitavad.
 */

import { OUTBOX_LIMIT, OutboxState, isBlocked, needsPerson, outboxSummary, previewText } from "@/lib/homeCare/outbox";

/**
 * Teate lause vaate kohal: `{ title, line, wait }` või null (midagi ei oota).
 * Kirje, mis ei lähe ise teele (server lükkas tagasi, ligipääs puudub), teeb
 * lause tugevamaks: see vajab inimese sammu.
 */
export function outboxNotice(items, { t }) {
  const summary = outboxSummary(items);
  if (!summary.total) return null;
  return {
    title: t("home_care.outbox.title", { count: summary.total }),
    line: summary.attention ? t("home_care.outbox.line_attention", { count: summary.attention }) : t("home_care.outbox.line_pending"),
    /* Tugevam äärejoon: mõni kirje ei lähe ise teele. */
    wait: summary.attention > 0
  };
}

/**
 * Ootavate kirjete read: `[{ key, name, chip: { text, wait }, written, text, reason, hint, canRetry, canDelete }]`.
 *
 * KIRJE, MILLE SERVER TAGASI LÜKKAS, jääb seadmesse koos täistekstiga: inimene
 * saab teksti kopeerida ja kirje uuesti kirjutada. LIGIPÄÄSUTA KIRJE (asendaja
 * luba lõppes, inimene eemaldati meeskonnast) jääb ootele ja seda proovitakse
 * edasi, aga rida näitab täisteksti ja ütleb, mida teha. Muu kirje ootab
 * ühendust: real on teksti algus.
 *
 * `moment` vormindab SEADME kellaaja (millal salvestamist vajutati); `message`
 * annab viimase katse vea lause võtme järgi.
 */
export function outboxRows(items, { t, moment, message }) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const attention = item.state === OutboxState.ATTENTION;
    const blocked = isBlocked(item);
    const stuck = needsPerson(item);
    const text = item.payload?.body?.text || "";
    const reason = item.lastMessageKey || attention ? message(item.lastMessageKey || "") : "";
    return {
      key: item.clientRequestId,
      name: item.unreadable ? t("home_care.outbox.unreadable") : item.payload?.clientName || "",
      chip: {
        text: blocked ? t("home_care.outbox.item_blocked") : stuck ? t("home_care.outbox.item_attention") : t("home_care.outbox.item_pending"),
        wait: stuck
      },
      /* Aeg antakse arvuna: vigane väärtus seadme salvestises annab tühja rea, mitte erindi. */
      written: t("home_care.outbox.written_at", { time: moment(item.queuedAtMs) }),
      text: item.unreadable ? "" : stuck ? text : previewText(text),
      reason: reason ? t("home_care.outbox.last_error", { message: reason }) : "",
      hint: attention ? t("home_care.outbox.attention_hint") : blocked ? t("home_care.outbox.blocked_hint") : "",
      /* Tagasi lükatud kirje saab uuesti teele panna, kui põhjus on kõrvaldatud; kirje võti ja ooteaja algus jäävad samaks. */
      canRetry: attention,
      /* Kustutada saab ainult kirjet, mis ise teele ei lähe: see on ainus koht, kus tehtud töö saab päriselt kaduda. */
      canDelete: stuck
    };
  });
}

/** Kas seadme järjekord on täis: uusi kirjeid ootele panna ei saa. */
export function outboxFull(items) {
  return outboxSummary(items).total >= OUTBOX_LIMIT;
}

/** Kas on kirjeid, mida saab kohe saata (ootavad ühendust). */
export function outboxPending(items) {
  return outboxSummary(items).pending > 0;
}

export { OUTBOX_LIMIT };
