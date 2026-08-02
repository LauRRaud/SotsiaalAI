/**
 * T25 ORG-FOUNDATION-V1 — organisatsioonikihi vead.
 *
 * MITTEPALJASTAV MUSTER (arenduskava §6): võõras organisatsioon, võõras üksus ja
 * võõras liikmesus annavad 404, MITTE 403. 403 ütleks „see asi on olemas, aga
 * sina ei tohi" — see on infoleke kahe organisatsiooni vahel. 403 kasutame ainult
 * siis, kui kasutaja NÄEB objekti niikuinii (on liige), aga tal puudub konkreetne
 * capability.
 */

export class OrgError extends Error {
  constructor(status, messageKey, details) {
    super(messageKey);
    this.name = "OrgError";
    this.status = status;
    this.messageKey = messageKey;
    if (details) this.details = details;
  }
}

/** Ressurss puudub VÕI kasutaja ei tohi teada, et ta olemas on. */
export function notFound(messageKey = "org.errors.not_found") {
  return new OrgError(404, messageKey);
}

/** Kasutaja on liige, aga tal puudub nõutav capability või skoop. */
export function forbidden(messageKey = "org.errors.forbidden", details) {
  return new OrgError(403, messageKey, details);
}

export function badRequest(messageKey = "org.errors.invalid_payload", details) {
  return new OrgError(400, messageKey, details);
}

/** Olekusiire või invariant ei luba toimingut (nt arhiveeritud organisatsioon). */
export function conflict(messageKey = "org.errors.conflict", details) {
  return new OrgError(409, messageKey, details);
}

export function unauthorized(messageKey = "api.common.unauthorized") {
  return new OrgError(401, messageKey);
}

export function isOrgError(error) {
  return error instanceof OrgError;
}
