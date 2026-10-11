/**
 * Vastuvõtja tööjärg: mis rühmas saabunud eelpöördumine on ja kui kaua see on oodanud.
 *
 * Pärast saatmist on eelpöördumise `status` vastuvõtja töövoo seis
 * (lib/preInquiries.js: SENT = saabunud ja vastu võtmata, READY = vastu võetud,
 * ARCHIVED = vastuvõtja arhiveeris). Vastuvõtja vaade näitas seda toore koodina
 * („READY") ja ühe pika loendina ilma järjekorrata. Tööjärg ütleb kolm asja:
 *  - `new`       uus: saabunud, keegi ei ole vastu võtnud; `days` = mitu täispäeva oodanud
 *  - `mine`      minu töös: vastu võetud; `contact` = järgmise kontakti seis
 *                (`none` määramata, `due` täna või möödas, `later` ees)
 *  - `archived`  arhiveeritud
 *  - `none`      saatmata rida ei ole kellegi vastuvõtus (admini proovivaade näeb ka
 *                enda mustandeid); tööjärjes seda ei ole
 *
 * Järjekord: uued ees (kõige kauem oodanu esimesena), siis minu töös (lähim
 * kontakt esimesena, määramata lõpus), siis arhiiv (värskeim esimesena).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const PRE_INQUIRY_RECEIVER_GROUPS = Object.freeze(["new", "mine", "archived"]);

function toTime(value) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/* Kuupäev ilma kellaajata (YYYY-MM-DD) võrdluseks; ajatsoonina kasutaja oma päev. */
function dayKey(value) {
  const time = toTime(value);
  if (time === null) return "";
  const date = new Date(time);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function preInquiryReceiverState(inquiry, { now = Date.now() } = {}) {
  const status = String(inquiry?.status || "").toUpperCase();
  const nowTime = toTime(now) ?? Date.now();
  /* Sama piir, mille server vastuvõtja tegevustele seab (lib/preInquiries.js: „not_sent"). */
  if (!inquiry?.sentAt && status !== "SENT") return { group: "none" };
  if (status === "ARCHIVED") return { group: "archived" };
  if (inquiry?.openedAt || status === "READY") {
    const contactDay = inquiry?.nextContactOn ? String(inquiry.nextContactOn).slice(0, 10) : "";
    const contact = !contactDay ? "none" : contactDay <= dayKey(nowTime) ? "due" : "later";
    return { group: "mine", at: inquiry?.openedAt || null, contact, contactOn: contactDay || null };
  }
  const arrived = toTime(inquiry?.sentAt) ?? toTime(inquiry?.updatedAt);
  return {
    group: "new",
    at: inquiry?.sentAt || null,
    days: arrived === null ? 0 : Math.max(0, Math.floor((nowTime - arrived) / DAY_MS))
  };
}

/** Tööjärg: read rühma kaupa õiges järjekorras ja iga rühma arv. */
export function preInquiryReceiverQueue(inquiries, { now = Date.now() } = {}) {
  const rows = (Array.isArray(inquiries) ? inquiries : []).map((inquiry) => ({
    inquiry,
    state: preInquiryReceiverState(inquiry, { now })
  }));
  const time = (value) => toTime(value) ?? 0;
  const order = {
    new: (a, b) => time(a.inquiry.sentAt || a.inquiry.updatedAt) - time(b.inquiry.sentAt || b.inquiry.updatedAt),
    mine: (a, b) => {
      const left = a.state.contactOn || "9999-99-99";
      const right = b.state.contactOn || "9999-99-99";
      return left === right ? time(b.inquiry.updatedAt) - time(a.inquiry.updatedAt) : left < right ? -1 : 1;
    },
    archived: (a, b) => time(b.inquiry.updatedAt) - time(a.inquiry.updatedAt)
  };
  const groups = {};
  for (const group of PRE_INQUIRY_RECEIVER_GROUPS) {
    groups[group] = rows.filter((row) => row.state.group === group).sort(order[group]);
  }
  return groups;
}
