/**
 * KODUTEENUS K1 — sisendi normaliseerimine.
 *
 * Käsitsi normaliseerijad nagu mujal repos (valideerimisteeki ei ole). Kõik
 * kontrollid tehakse ENNE tehingut. Tundmatu väli jäetakse kõrvale; vale
 * väärtus on 400 koos tõlkevõtmega. Tekst on lihttekst: HTML-i ei puhastata,
 * vaade renderdab selle tekstina.
 */

import { createHash } from "node:crypto";

import { badRequest } from "../org/errors.js";

import {
  CARE_ACCESS_REASONS,
  CARE_CARD_LINE_KINDS,
  CARE_CLIENT_STATUSES,
  CARE_CONTACT_MODES,
  CARE_ENTRY_KINDS,
  CARE_INCIDENT_ACTIONS,
  CARE_INCIDENT_STATUSES,
  CARE_INCIDENT_TYPES,
  CareContactMode,
  CareEntryKind,
  HOME_CARE_LIMITS
} from "./constants.js";

const ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;
const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeText(value, max, { required = false, errorKey } = {}) {
  const text = typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
  if (!text) {
    if (required) throw badRequest(errorKey || "home_care.errors.text_required");
    return null;
  }
  if (text.length > max) throw badRequest("home_care.errors.text_too_long", { limit: max });
  return text;
}

/** Üherealine väli: reavahetused ja korduvad tühikud üheks tühikuks. */
export function normalizeLine(value, max, options) {
  const text = normalizeText(typeof value === "string" ? value.replace(/\s+/g, " ") : value, max, options);
  return text;
}

export function normalizeId(value, errorKey = "home_care.errors.invalid_id") {
  const id = String(value ?? "").trim();
  if (!ID_PATTERN.test(id)) throw badRequest(errorKey);
  return id;
}

export function normalizeOptionalId(value, errorKey) {
  if (value === undefined || value === null || value === "") return null;
  return normalizeId(value, errorKey);
}

export function normalizeEnum(value, allowed, errorKey, { fallback } = {}) {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text && fallback !== undefined) return fallback;
  if (!allowed.includes(text)) throw badRequest(errorKey);
  return text;
}

export function normalizeVersion(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) throw badRequest("home_care.errors.version_required");
  return version;
}

export function normalizeRequestId(value) {
  if (value === undefined || value === null || value === "") return null;
  const id = String(value).trim();
  if (!REQUEST_ID_PATTERN.test(id)) throw badRequest("home_care.errors.invalid_request_id");
  return id;
}

function parseDate(value, errorKey) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) throw badRequest(errorKey);
  return date;
}

/**
 * Sündmuse aeg. Puudumisel `now`. Tulevikku lubame ainult kellade erinevuse
 * jagu: kirje sündmusest, mis ei ole veel juhtunud, on sisestusviga.
 */
export function normalizeOccurredAt(value, now) {
  if (value === undefined || value === null || value === "") return new Date(now);
  const date = parseDate(value, "home_care.errors.invalid_occurred_at");
  if (date.getTime() > now.getTime() + HOME_CARE_LIMITS.OCCURRED_AT_FUTURE_SKEW_MS) {
    throw badRequest("home_care.errors.occurred_at_in_future");
  }
  return date;
}

export function normalizeOptionalDate(value, errorKey = "home_care.errors.invalid_date") {
  if (value === undefined || value === null || value === "") return null;
  return parseDate(value, errorKey);
}

/** Kalendripäev kujul AAAA-KK-PP → { year, month, day } või null. */
export function normalizeIsoDay(value) {
  if (value === undefined || value === null || value === "") return null;
  const match = ISO_DAY_PATTERN.exec(String(value).trim());
  if (!match) throw badRequest("home_care.errors.invalid_date");
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() !== parts.month - 1 ||
    check.getUTCDate() !== parts.day
  ) {
    throw badRequest("home_care.errors.invalid_date");
  }
  return parts;
}

export function normalizeClientInput(input = {}, { partial = false } = {}) {
  const data = {};
  if (!partial || input.displayName !== undefined) {
    data.displayName = normalizeLine(input.displayName, HOME_CARE_LIMITS.DISPLAY_NAME_MAX, {
      required: true,
      errorKey: "home_care.errors.name_required"
    });
  }
  if (input.internalCode !== undefined) {
    data.internalCode = normalizeLine(input.internalCode, HOME_CARE_LIMITS.INTERNAL_CODE_MAX);
  }
  if (input.address !== undefined) data.address = normalizeLine(input.address, HOME_CARE_LIMITS.ADDRESS_MAX);
  if (input.contactPhone !== undefined) {
    data.contactPhone = normalizeLine(input.contactPhone, HOME_CARE_LIMITS.PHONE_MAX);
  }
  if (input.contactNote !== undefined) {
    data.contactNote = normalizeText(input.contactNote, HOME_CARE_LIMITS.CONTACT_NOTE_MAX);
  }
  if (input.unitId !== undefined) data.unitId = normalizeOptionalId(input.unitId, "home_care.errors.invalid_unit");
  return data;
}

export function normalizeStatusInput(input = {}) {
  return {
    status: normalizeEnum(input.status, CARE_CLIENT_STATUSES, "home_care.errors.invalid_status"),
    statusNote: normalizeLine(input.statusNote, HOME_CARE_LIMITS.STATUS_NOTE_MAX)
  };
}

export function normalizeCardLineInput(input = {}) {
  return {
    kind: normalizeEnum(input.kind, CARE_CARD_LINE_KINDS, "home_care.errors.invalid_card_kind"),
    text: normalizeLine(input.text, HOME_CARE_LIMITS.CARD_LINE_TEXT_MAX, {
      required: true,
      errorKey: "home_care.errors.card_text_required"
    })
  };
}

function normalizeIncidentActions(value, now) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw badRequest("home_care.errors.invalid_incident_actions");
  const seen = new Set();
  const actions = [];
  for (const item of value.slice(0, CARE_INCIDENT_ACTIONS.length)) {
    const code = normalizeEnum(item?.code, CARE_INCIDENT_ACTIONS, "home_care.errors.invalid_incident_actions");
    if (seen.has(code)) continue;
    seen.add(code);
    const at = item?.at ? parseDate(item.at, "home_care.errors.invalid_incident_actions") : now;
    actions.push({ code, at: at.toISOString() });
  }
  return actions.length ? actions : null;
}

/**
 * Päevikukirje sisu. Erijuhtumi väljad loetakse ainult liigi INCIDENT korral;
 * muul liigil jäetakse need vaikselt kõrvale, et vormi vahetus ei tekitaks
 * „pooleldi erijuhtumit".
 */
export function normalizeEntryInput(input = {}, { now }) {
  const kind = normalizeEnum(input.kind, CARE_ENTRY_KINDS, "home_care.errors.invalid_entry_kind", {
    fallback: CareEntryKind.NOTE
  });
  const data = {
    kind,
    contactMode: normalizeEnum(input.contactMode, CARE_CONTACT_MODES, "home_care.errors.invalid_contact_mode", {
      fallback: CareContactMode.VISIT
    }),
    text: normalizeText(input.text, HOME_CARE_LIMITS.ENTRY_TEXT_MAX, {
      required: true,
      errorKey: "home_care.errors.entry_text_required"
    }),
    occurredAt: normalizeOccurredAt(input.occurredAt, now),
    deviceCreatedAt: normalizeOptionalDate(input.deviceCreatedAt),
    companionMembershipId: normalizeOptionalId(input.companionMembershipId, "home_care.errors.invalid_companion"),
    incidentType: null,
    incidentAssessment: null,
    incidentActions: null
  };

  if (kind === CareEntryKind.INCIDENT) {
    data.incidentType = normalizeEnum(input.incidentType, CARE_INCIDENT_TYPES, "home_care.errors.invalid_incident_type");
    data.incidentAssessment = normalizeText(input.incidentAssessment, HOME_CARE_LIMITS.ASSESSMENT_MAX);
    data.incidentActions = normalizeIncidentActions(input.incidentActions, now);
  }
  return data;
}

export function normalizeReason(value) {
  return normalizeText(value, HOME_CARE_LIMITS.REASON_MAX, {
    required: true,
    errorKey: "home_care.errors.reason_required"
  });
}

export function normalizeAccessReasonInput(input = {}) {
  return {
    reasonCode: normalizeEnum(input.reasonCode, CARE_ACCESS_REASONS, "home_care.errors.access_reason_required"),
    reason: normalizeLine(input.reason, HOME_CARE_LIMITS.ACCESS_REASON_MAX)
  };
}

export function normalizeIncidentStatusInput(input = {}) {
  return {
    status: normalizeEnum(input.status, CARE_INCIDENT_STATUSES, "home_care.errors.invalid_incident_status"),
    note: normalizeText(input.note, HOME_CARE_LIMITS.ASSESSMENT_MAX)
  };
}

export function normalizeSearchQuery(value) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (text.length < HOME_CARE_LIMITS.SEARCH_MIN) throw badRequest("home_care.errors.search_too_short");
  return text.slice(0, HOME_CARE_LIMITS.SEARCH_MAX);
}

/**
 * Kordussaatmise võrdlus: sama võti + sama sisu on kordus, sama võti + muu sisu
 * on konflikt. Räsi arvutatakse normaliseeritud sisust kindlas võtmejärjekorras.
 */
export function entryRequestHash(clientId, data) {
  const canonical = JSON.stringify([
    clientId,
    data.kind,
    data.contactMode,
    data.text,
    data.occurredAt.toISOString(),
    data.companionMembershipId || null,
    data.incidentType || null,
    data.incidentAssessment || null,
    data.incidentActions || null
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
