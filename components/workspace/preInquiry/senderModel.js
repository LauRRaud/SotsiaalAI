/**
 * Pöörduja eelpöördumise lehe otsused ILMA JSX-ita: mis vaade mis seisus pöördumisele
 * avaneb, mida saadetud pöördumise lugemisvaade näitab ja mida seal teha saab.
 *
 * MIKS OMA FAIL. Leht avas iga pöördumise muutmisvormina, ka saadetud ja vastu võetud oma:
 * inimene nägi teksti välja ja nuppu „Saada platvormis" pöördumisel, mille server muutmisele
 * suletud oli. Kuni otsus elas lehe joonistuse vahel, ei saanud seda testida.
 *
 * SERVERI REEGLID, mida siinne otsus järgib (lib/preInquiries.js):
 *  - muuta saab ainult saatmata pöördumist (`updatePreInquiry`: SENT, ARCHIVED, avatud ja
 *    parandusega asendatud pöördumine annavad 409);
 *  - tagasi võtta saab platvormis saadetud pöördumist, kuni saaja ei ole seda avanud
 *    (`recallPreInquiry`);
 *  - parandust saab saata pärast avamist (`sendPreInquiryCorrection`);
 *  - ühise ruumi saab avada pärast vastuvõtmist (`ensureRoomForPreInquiry`);
 *  - arhiveeritud saatmata pöördumise saab taasavada (`reopenPreInquiry`).
 * Tagasivõtmine ja parandus tehakse lehel „Minu jagamised"; siit viib sinna link.
 *
 * Seisu reegel on üks: lib/preInquirySenderState.js (sama, mida näitab Teekond).
 */

import { preInquirySenderState, preInquirySenderTone } from "@/lib/preInquirySenderState";

export const SHARINGS_PATH = "/minu-jagamised";

/* Vaated, millest pöörduja lava koosneb, kui ta loeb saadetud pöördumist või vaatab loendit. */
export const SENT_FLOW_KEYS = Object.freeze(["sent_state", "sent_text", "saved"]);
export const LIST_FLOW_KEYS = Object.freeze(["saved"]);

const upper = (value) => String(value || "").toUpperCase();

/** Kas pöörduja saab pöördumist muuta (sama värav mis serveri `updatePreInquiry`). */
export function senderCanEdit(inquiry) {
  if (!inquiry) return true;
  const status = upper(inquiry.status);
  if (status === "SENT" || status === "ARCHIVED") return false;
  return !inquiry.openedAt && !inquiry.supersededById;
}

/** Mis vaates pöörduja pöördumine avaneb: `edit` (muutmine) või `read` (lugemisvaade). */
export function senderOpenMode(inquiry) {
  return senderCanEdit(inquiry) ? "edit" : "read";
}

/**
 * Lava sammud töövoo järgi. `sent` on lugemisvaade, `list` avaekraanilt avatud loend;
 * muu on koostamise töövoog (`journey` lisab Teekonna sammu, `hasDomains` eluvaldkonnad).
 */
export function senderFlowKeys(workflowMode, { hasDomains = false } = {}) {
  if (workflowMode === "sent") return [...SENT_FLOW_KEYS];
  if (workflowMode === "list") return [...LIST_FLOW_KEYS];
  return [
    ...(workflowMode === "journey" ? ["journey"] : []),
    "path",
    "situation",
    "who",
    "urgency",
    ...(hasDomains ? ["domains"] : []),
    "context",
    "assistant",
    "review",
    "recipient",
    "text",
    "send",
    "saved"
  ];
}

/* Mis lause ütleb, mis edasi saab. Võti kataloogis: `views.sent.next.<võti>`. */
const NEXT_BY_STATE = Object.freeze({
  sent_waiting: "waiting",
  accepted: "accepted",
  answered: "answered",
  sent_external: "external",
  recalled: "recalled",
  replaced: "replaced",
  archived: "archived"
});

/**
 * Saadetud (või muul põhjusel muutmisele suletud) pöördumise lugemisvaade.
 *
 *   state      seis nii, nagu pöörduja seda näeb: `{ key, at?, days?, tone }`
 *   recipient  kellele: asutuse nimi või valitud kontakti nimi
 *   channel    `platform`, `email` või `none` (saatmata)
 *   sentAt     millal saadeti (`null`, kui ei saadetud)
 *   situation  inimese kirjeldus
 *   text       pöördumise tekst, kui see erineb kirjeldusest (muidu tühi)
 *   next       võti lausele „mis edasi saab" (`views.sent.next.<võti>`)
 *   actions    mida siin teha saab:
 *     room     ava ühine vestlusruum (saaja on vastu võtnud)
 *     recall   server lubaks tagasi võtta (tehakse lehel „Minu jagamised")
 *     correct  server lubaks saata paranduse (samal lehel)
 *     reopen   arhiveeritud saatmata pöördumise saab taasavada muutmiseks
 */
export function sentInquiryView(inquiry, { now = Date.now() } = {}) {
  const base = preInquirySenderState(inquiry, { now });
  const state = { ...base, tone: preInquirySenderTone(base.key) };
  const internal = upper(inquiry?.deliveryChannel) === "INTERNAL";
  const sent = Boolean(inquiry?.sentAt);
  const live = sent && !inquiry?.recalledAt;
  const situation = String(inquiry?.situation || "").trim();
  const draft = String(inquiry?.userEditedDraft || inquiry?.generatedDraft || "").trim();
  return {
    state,
    recipient: String(inquiry?.recipientOrganization?.displayName || inquiry?.selectedRecipientName || inquiry?.recipientEntry?.title || "").trim(),
    channel: !sent ? "none" : internal ? "platform" : "email",
    sentAt: inquiry?.sentAt || null,
    situation,
    text: draft && draft !== situation ? draft : "",
    next: NEXT_BY_STATE[state.key] || "",
    actions: {
      room: live && internal && Boolean(inquiry?.openedAt),
      recall: live && internal && !inquiry?.openedAt && upper(inquiry?.status) === "SENT",
      correct:
        live &&
        internal &&
        Boolean(inquiry?.openedAt) &&
        !inquiry?.supersededById &&
        Boolean(inquiry?.recipientOwnerId || inquiry?.recipientOrganizationId),
      reopen: !sent && !inquiry?.openedAt && upper(inquiry?.status) === "ARCHIVED"
    }
  };
}

/**
 * Loendi vastus (`GET /api/pre-inquiries`) kannab pöörduja ridadel vastuste arvu, aga muutmise,
 * alla laadimise ja taasavamise vastused mitte. Kui selline vastus asendab loendi rea, jääks
 * „vastatud" seis vahele: siin jäetakse varem teada olnud arv alles.
 */
export function keepReplyFacts(previous, next) {
  if (!next || !previous || next.replyCount !== undefined || previous.replyCount === undefined) return next;
  return { ...next, replyCount: previous.replyCount, lastReplyAt: previous.lastReplyAt ?? null };
}

/**
 * Asendab loendis ühe rea serveri vastusega (`next`), nii et varem teada olnud vastuste arv
 * jääb alles. `toFront`: rida läheb loendi algusesse (salvestamine, lingist avatud rida);
 * muidu jääb oma kohale. Rida, mida loendis ei olnud, lisatakse ainult `toFront` korral.
 */
export function replaceInquiryRow(list, next, { toFront = false } = {}) {
  const rows = Array.isArray(list) ? list : [];
  if (!next?.id) return rows;
  const previous = rows.find((item) => item.id === next.id) || null;
  const merged = keepReplyFacts(previous, next);
  if (toFront) return [merged, ...rows.filter((item) => item.id !== next.id)];
  return rows.map((item) => (item.id === next.id ? merged : item));
}

/** Mitu pöördumist pöördujal on: avaekraani rida „Minu eelpöördumised". */
export function senderListCounts(inquiries) {
  const list = Array.isArray(inquiries) ? inquiries : [];
  const sent = list.filter((inquiry) => inquiry?.sentAt).length;
  return { total: list.length, sent, unsent: list.length - sent };
}
