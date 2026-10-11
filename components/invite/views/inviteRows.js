/**
 * Kutse lehe reeglid ILMA JSX-ita: vaadete loend ja seis, puuduva asja leidmine
 * enne saatmist, saadetud kutsete read ja seisu sõnad.
 *
 * MIKS OMA FAIL. Kuni need otsused elasid vormi JSX-is (`../InviteModal.jsx`),
 * ei saanud neid testida: mis on enne saatmist puudu ja millises vaates seda
 * parandada saab, millal on kutsel tegevused ja mis sõnaga seisu näidatakse.
 * Siin on puhtad funktsioonid; leht hoiab olekut ja teeb päringud, vaated
 * (`./InviteViews.jsx`) ainult joonistavad.
 *
 * TOORES VÄÄRTUS EI JÕUA EKRAANILE. Vana loend kirjutas kutse seisu välja nii,
 * nagu see andmebaasis on (`SENT`, `REVOKED`). Iga seis saab siin kataloogist
 * sõna; tundmatu seis annab üldise sildi, mitte sisemise koodi.
 */

import { INVITE_RELATIONSHIP_CLIENT, sponsoredRolesForInviteRelationship } from "@/lib/invites/participantTypes";

export const PAYMENT_SELF = "SELF_PAID";
export const PAYMENT_HOST = "SPONSORED_BY_HOST";

/** Vaated selles järjekorras, nagu kutse kokku pannakse. Igal on kataloogis nimi ja lühinimi (`invite.views.<võti>`). */
export const INVITE_VIEW_KEYS = Object.freeze(["room", "who", "emails", "send", "sent"]);

/**
 * Ruumi vaade on ainult siis, kui kutsega luuakse uus ruum. Olemasolevasse
 * ruumi kutsudes (ja pärast esimest saatmist) ruumi nime enam ei küsita.
 * Saadetud kutsete vaade on ainult siis, kui ruum on olemas: enne esimest
 * saatmist ei ole ruumi ega kutseid ja samm viiks tühja loendi juurde.
 */
export function inviteViewKeys({ hasRoom = false } = {}) {
  return INVITE_VIEW_KEYS.filter((key) => (hasRoom ? key !== "room" : key !== "sent"));
}

/** Aadressid väljalt: koma, semikoolon või reavahetus eraldab; kordused jäävad välja. */
export function parseEmails(raw) {
  if (!raw) return [];
  const list = String(raw)
    .split(/[,;\n\r]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(list)];
}

export function formatEuroAmount(amount, locale = "et") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${Number(amount || 0).toFixed(2)} EUR`;
  }
}

/** Kataloogis on nupu tekst läbivate suurtähtedega („SAADA KUTSE"); nupul on see tavalise lausena. */
export function sentenceCase(text, locale = "et") {
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) return text;
  if (raw !== raw.toUpperCase()) return text;
  const lower = raw.toLocaleLowerCase(locale || "et");
  return `${lower.charAt(0).toLocaleUpperCase(locale || "et")}${lower.slice(1)}`;
}

/** Valitud seos kehtib ainult siis, kui kutsuja roll seda lubab; ainus lubatud seos on vaikimisi valitud. */
export function effectiveChoice(allowed, chosen) {
  const list = Array.isArray(allowed) ? allowed : [];
  if (list.includes(chosen)) return chosen;
  return list.length === 1 ? list[0] : "";
}

export function relationshipLabelKey(type) {
  return type === INVITE_RELATIONSHIP_CLIENT ? "invite.participant.client" : "invite.participant.professional";
}

export const SPONSORED_ROLE_KEYS = Object.freeze({
  CLIENT: "invite.sponsored.role.client",
  SOCIAL_WORKER: "invite.sponsored.role.worker",
  SERVICE_PROVIDER: "invite.sponsored.role.provider"
});

/**
 * Mille eest kutsuja tasub: üks kuu KUTSUTU rolli ligipääsu, seega kannab iga
 * valik oma rolli kuutellimuse summat. `amountOf(roll)` annab summa.
 */
export function sponsoredRoleOptions(relationshipType, { t, locale, amountOf }) {
  return sponsoredRolesForInviteRelationship(relationshipType).map((value) => ({
    value,
    label: `${t(SPONSORED_ROLE_KEYS[value])} · ${formatEuroAmount(amountOf(value), locale)}`
  }));
}

/* Enne saatmist kontrollitavad asjad: teate võti ja vaade, kus seda parandada saab. */
const PROBLEMS = Object.freeze({
  relationship: { key: "invite.error.relationship_required", view: "who" },
  emails: { key: "invite.error.emails_required", view: "emails" },
  roomTitle: { key: "invite.room_title_required", view: "room" },
  hostName: { key: "invite.host_name_required", view: "room" },
  singleEmail: { key: "invite.error.sponsored_single_email_required", view: "emails" },
  plan: { key: "invite.error.sponsor_plan_required", view: "send" },
  checkoutClosed: { key: "invite.error.checkout_temporarily_disabled", view: "send" },
  terms: { key: "invite.error.checkout_terms_required", view: "send" }
});
export const INVITE_PROBLEM_KEYS = Object.freeze(Object.values(PROBLEMS).map((problem) => problem.key));

/**
 * Mis on enne saatmist puudu. Järjekord on sama mis vanal vormil. Vastuses on
 * ka vaade: leht viib inimese sinna, kus puuduv asi on, ja ütleb seal, mis see on.
 * @returns {{ key: string, view: string } | null}
 */
export function inviteProblem({
  hasRoom = false,
  relationshipType = "",
  emails = [],
  roomTitle = "",
  hostName = "",
  paymentMode = PAYMENT_SELF,
  targetRole = null,
  checkoutClosed = false,
  agreed = false
} = {}) {
  if (!relationshipType) return PROBLEMS.relationship;
  if (!emails.length) return PROBLEMS.emails;
  if (!hasRoom && !String(roomTitle).trim()) return PROBLEMS.roomTitle;
  if (!hasRoom && !String(hostName).trim()) return PROBLEMS.hostName;
  if (paymentMode !== PAYMENT_HOST) return null;
  if (emails.length !== 1) return PROBLEMS.singleEmail;
  if (!targetRole) return PROBLEMS.plan;
  if (checkoutClosed) return PROBLEMS.checkoutClosed;
  if (!agreed) return PROBLEMS.terms;
  return null;
}

/** Mis takistab valikut „Tasun tema eest": seos peab olema valitud ja aadresse tohib olla üks. */
export function sponsorProblem({ relationshipType = "", emails = [] } = {}) {
  if (!relationshipType) return PROBLEMS.relationship;
  if (emails.length > 1) return PROBLEMS.singleEmail;
  return null;
}

/* Serveri keeldumise võti ütleb, millise vaate asi see on; muu viga jääb saatmise vaatesse. */
const SERVER_ERROR_VIEWS = Object.freeze({
  "invite.error.relationship_required": "who",
  "invite.error.relationship_not_allowed": "who",
  "invite.error.emails_required": "emails",
  "invite.error.sponsored_single_email_required": "emails",
  "invite.error.invitee_active_subscription": "emails",
  "invite.room_title_required": "room",
  "invite.host_name_required": "room"
});

/** Vaade, kuhu serveri viga kuulub. Ruumi vaadet ei ole, kui ruum on juba olemas. */
export function inviteErrorView(messageKey, viewKeys = INVITE_VIEW_KEYS) {
  const view = SERVER_ERROR_VIEWS[String(messageKey || "")] || "send";
  return viewKeys.includes(view) ? view : "send";
}

/** Sammu numbri heledus kiirmenüüs ja vaates „Kõik sammud". */
export function inviteViewStates({ roomTitle = "", hostName = "", relationshipType = "", emails = [], inviteCount = 0 } = {}) {
  const title = String(roomTitle).trim();
  const name = String(hostName).trim();
  return {
    room: title && name ? "done" : title || name ? "partial" : "empty",
    who: relationshipType ? "done" : "empty",
    emails: emails.length ? "done" : "empty",
    send: "empty",
    sent: inviteCount ? "done" : "empty"
  };
}

const STATUS = Object.freeze({
  PENDING_PAYMENT: { key: "invite.status.pending_payment", tone: "wait" },
  SENT: { key: "invite.status.sent", tone: "wait" },
  ACCEPTED: { key: "invite.status.accepted", tone: "ok" },
  EXPIRED: { key: "invite.status.expired", tone: "quiet" },
  REVOKED: { key: "invite.status.revoked", tone: "quiet" }
});
/** Andmebaasi seisud (`InviteStatus`), millel on kataloogis sõna. */
export const INVITE_STATUSES = Object.freeze(Object.keys(STATUS));
export const INVITE_STATE_KEYS = Object.freeze([
  ...Object.values(STATUS).map((entry) => entry.key),
  "invite.status.accepted_self",
  "invite.status.accepted_sponsored",
  "invite.status.unknown"
]);

/**
 * Kutse seis ja mida sellega teha saab.
 *
 * Saadetud kutset saab uuesti saata ja tühistada. Kutse, mille kehtivus on
 * läbi, on andmebaasis endiselt „saadetud", aga uuesti saatmisest server
 * keeldub: selline rida näitab seisu „Aegunud" ja uuesti saatmise nuppu ei ole.
 */
export function inviteState(invite, now = Date.now()) {
  const status = String(invite?.status || "").trim().toUpperCase();
  if (status === "ACCEPTED" && invite?.acceptedBillingSource) {
    return {
      key: invite.acceptedBillingSource === "SELF" ? "invite.status.accepted_self" : "invite.status.accepted_sponsored",
      tone: "ok",
      canResend: false,
      canRevoke: false
    };
  }
  if (status === "SENT") {
    const expiresAt = invite?.expiresAt ? new Date(invite.expiresAt).getTime() : NaN;
    const expired = Number.isFinite(expiresAt) && expiresAt <= now;
    return expired
      ? { ...STATUS.EXPIRED, canResend: false, canRevoke: true }
      : { ...STATUS.SENT, canResend: true, canRevoke: true };
  }
  const known = STATUS[status];
  return { key: known?.key || "invite.status.unknown", tone: known?.tone || "quiet", canResend: false, canRevoke: false };
}

/**
 * Saadetud kutsete read: aadress, kes tasub, seis ja kas tegevused on olemas.
 * Lehe fail lisab reale tegevused (uuesti saatmine, tühistamine).
 */
export function inviteRows(invites, { t, now = Date.now() } = {}) {
  return (Array.isArray(invites) ? invites : []).map((invite) => {
    const state = inviteState(invite, now);
    return {
      id: String(invite.id),
      email: String(invite.inviteeEmail || ""),
      payer: t(invite.paymentMode === PAYMENT_HOST ? "invite.payer.host" : "invite.payer.self"),
      state: t(state.key),
      tone: state.tone,
      canResend: state.canResend,
      canRevoke: state.canRevoke
    };
  });
}
