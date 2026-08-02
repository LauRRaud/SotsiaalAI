/**
 * T25 ORG-FOUNDATION-V1 — organisatsiooni kutsed.
 *
 * MIKS ERALDI MUDEL, mitte olemasolev `Invite` (E0 leid L3): `Invite.roomId` on
 * NOT NULL ja Cascade — tänane kutse ei saa eksisteerida ilma ruumita.
 * Organisatsiooni liikmesus ei ole ruum ja teda ei tohi ruumi külge siduda.
 * Olemasolevat ruumikutset EI muudeta ebamääraseks üldkutseks.
 *
 * TURVANÕUDED (arenduskava §5.5, §11.2), mis kõik peavad failima SULETULT:
 *   - vale e-post → kutse ei rakendu;
 *   - aegunud token → ei rakendu;
 *   - korduskasutus → ei rakendu;
 *   - revoke → ei rakendu;
 *   - e-posti domeen EI tekita liikmesust;
 *   - vastuvõtt on TEADLIK nõustumine, mitte lingile klikkimise kõrvalmõju.
 */

import crypto from "node:crypto";

import {
  CAPABILITY_TEMPLATES,
  INVITE_TTL_DAYS,
  OrganizationInviteStatus,
  isOrganizationSeatRole
} from "./constants.js";
import { badRequest } from "./errors.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/** Sama räsi kui olemasoleval ruumikutsel — üks muster kogu koodibaasis. */
export function hashInviteToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken)).digest("base64");
}

export function createInviteToken() {
  const raw = crypto.randomBytes(48).toString("base64url");
  return { raw, hash: hashInviteToken(raw) };
}

/**
 * E-post normaliseeritakse ainult võrdlemiseks (trim + lowercase). Salvestame
 * kasutaja kirjutatud kuju, aga otsustame normaliseeritu järgi — muidu tekiks
 * kaks kutset ühele inimesele.
 */
export function normalizeInviteEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value || !EMAIL_PATTERN.test(value)) throw badRequest("org.errors.invalid_email");
  return value;
}

export function inviteExpiryFrom(now = new Date(), days = INVITE_TTL_DAYS) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Kas kutse on VASTUVÕETAV? Tagastab põhjuse, mitte ainult tõeväärtuse — kutsuja
 * otsustab, kui palju sellest kasutajale näidatakse. Vale e-posti korral EI
 * öelda, millisele aadressile kutse käis.
 */
export function evaluateInvite(invite, { acceptingEmail, now = new Date() } = {}) {
  if (!invite) return { ok: false, reason: "NOT_FOUND" };
  if (invite.status === OrganizationInviteStatus.REVOKED) return { ok: false, reason: "REVOKED" };
  if (invite.status === OrganizationInviteStatus.ACCEPTED) return { ok: false, reason: "ALREADY_USED" };
  if (invite.status === OrganizationInviteStatus.DECLINED) return { ok: false, reason: "DECLINED" };
  if (invite.status === OrganizationInviteStatus.EXPIRED) return { ok: false, reason: "EXPIRED" };
  if (invite.status !== OrganizationInviteStatus.PENDING) return { ok: false, reason: "NOT_PENDING" };
  if (!invite.expiresAt || new Date(invite.expiresAt) <= now) return { ok: false, reason: "EXPIRED" };

  /* E-post peab klappima. Domeenipõhist automaatliitumist EI OLE (§13
     „automaatne töötaja lisamine e-posti domeeni järgi" on ulatusest väljas). */
  if (acceptingEmail !== undefined) {
    const normalized = String(acceptingEmail || "").trim().toLowerCase();
    if (!normalized || normalized !== String(invite.email || "").trim().toLowerCase()) {
      return { ok: false, reason: "EMAIL_MISMATCH" };
    }
  }
  return { ok: true, reason: null };
}

/** Iga mitte-ok põhjus annab sama kasutajanähtava sõnumi peale aegumise. */
export function inviteRejectionMessageKey(reason) {
  return reason === "EXPIRED" ? "org.errors.invite_expired" : "org.errors.invite_invalid";
}

export function resolveCapabilityTemplate(templateKey) {
  if (!templateKey) return CAPABILITY_TEMPLATES.MEMBER;
  const template = CAPABILITY_TEMPLATES[templateKey];
  if (!template) throw badRequest("org.errors.unknown_capability_template");
  return template;
}

/**
 * Kutse EELVAADE — see, mida kutsutu näeb ENNE nõustumist (arenduskava §5.5:
 * „kutse eelvaade näitab organisatsiooni, üksust, hinnastatavat rolli ja
 * kavandatud õigusi").
 *
 * Ei sisalda kutsuja isikuandmeid, teiste liikmete arvu ega ühtegi org-sisest
 * fakti peale selle, millega inimene nõustuma hakkab.
 */
export function toInvitePreview(invite) {
  const template = CAPABILITY_TEMPLATES[invite.capabilityTemplate] || CAPABILITY_TEMPLATES.MEMBER;
  return {
    organization: {
      displayName: invite.organization?.displayName || null,
      legalKind: invite.organization?.legalKind || null
    },
    unit: invite.primaryUnit ? { id: invite.primaryUnit.id, name: invite.primaryUnit.name } : null,
    seatRole: invite.seatRole,
    jobTitle: invite.jobTitle || null,
    capabilityTemplate: template.key,
    capabilities: [...template.capabilities],
    expiresAt: invite.expiresAt
  };
}

export function assertInviteInput({ email, seatRole, capabilityTemplate }) {
  const normalizedEmail = normalizeInviteEmail(email);
  if (!isOrganizationSeatRole(seatRole)) throw badRequest("org.errors.invalid_seat_role");
  const template = resolveCapabilityTemplate(capabilityTemplate);
  return { email: normalizedEmail, seatRole, template };
}
