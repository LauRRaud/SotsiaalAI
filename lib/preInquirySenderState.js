/**
 * Mida pöörduja oma eelpöördumise seisu kohta näeb.
 *
 * Andmebaasi olek (`status`) on töövoo sisemine seis ja pöördujale eksitav:
 * kui vastuvõtja märgib pöördumise vastuvõetuks, saab oleku väärtuseks READY,
 * mida pöörduja nägi sõnadega „valmis ülevaatamiseks", nagu ootaks asi veel
 * tema enda järel. Pöördujale loeb muu: kas see on saadetud, kas keegi on selle
 * vastu võtnud ja kui kaua see on oodanud.
 *
 * Seis arvutatakse väljadest, mida server autorile niikuinii annab
 * (`serializePreInquiry` failis lib/preInquiries.js): status, deliveryChannel,
 * sentAt, openedAt, recalledAt, externalSendConfirmedAt.
 *
 * Tagastab `{ key, at?, days? }`:
 *  - draft          koostamisel
 *  - ready          salvestatud, saatmata
 *  - downloaded     alla laaditud
 *  - sent_waiting   saadetud platvormis, vastu võtmata; `days` = mitu täispäeva oodanud
 *  - accepted       vastuvõtja on vastu võtnud; `at` = millal
 *  - sent_external  saadetud e-kirjaga; platvorm vastuvõttu ei näe
 *  - recalled       saatja võttis tagasi
 *  - archived       arhiveeritud
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function toTime(value) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function preInquirySenderState(inquiry, { now = Date.now() } = {}) {
  if (!inquiry) return { key: "draft" };
  const status = String(inquiry.status || "DRAFT");
  const sentAt = toTime(inquiry.sentAt);
  const openedAt = toTime(inquiry.openedAt);

  if (toTime(inquiry.recalledAt)) return { key: "recalled", at: inquiry.recalledAt };
  if (status === "ARCHIVED") return { key: "archived" };

  if (inquiry.deliveryChannel === "EXTERNAL_EMAIL") {
    if (toTime(inquiry.externalSendConfirmedAt) || status === "SENT") {
      return { key: "sent_external", at: inquiry.externalSendConfirmedAt || inquiry.sentAt || null };
    }
  } else if (sentAt) {
    if (openedAt) return { key: "accepted", at: inquiry.openedAt };
    const nowTime = toTime(now) ?? Date.now();
    return { key: "sent_waiting", at: inquiry.sentAt, days: Math.max(0, Math.floor((nowTime - sentAt) / DAY_MS)) };
  }

  if (status === "DOWNLOADED") return { key: "downloaded" };
  if (status === "READY") return { key: "ready" };
  if (status === "SENT") return { key: "sent_waiting", at: inquiry.sentAt || null, days: 0 };
  return { key: "draft" };
}

/** Toon seisu märgile: ok (vastu võetud), wait (ootab), quiet (muu). */
export function preInquirySenderTone(key) {
  if (key === "accepted") return "ok";
  if (key === "sent_waiting" || key === "sent_external") return "wait";
  return "quiet";
}
