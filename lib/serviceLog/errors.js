/**
 * TEENUSPÄEVIK-V1 — vead.
 *
 * MITTEPALJASTAV MUSTER: võõras teenuskirje ja OLEMATU teenuskirje annavad
 * MÕLEMAD 404. Osutajate kirjed on üksteise suhtes täielikult eraldatud ja 403
 * ütleks „selline kirje on olemas, aga sina ei tohi" — see lekiks konkurendile
 * fakti, et mingi ID eksisteerib. Sama muster, mis T25-l ja T07 owner-404-l.
 */

export class ServiceLogError extends Error {
  constructor(status, messageKey, details) {
    super(messageKey);
    this.name = "ServiceLogError";
    this.status = status;
    this.messageKey = messageKey;
    if (details) this.details = details;
  }
}

/** Ressurss puudub VÕI kasutaja ei tohi teada, et ta olemas on. */
export function notFound(messageKey = "service_log.errors.not_found") {
  return new ServiceLogError(404, messageKey);
}

export function badRequest(messageKey = "service_log.errors.invalid_input", details) {
  return new ServiceLogError(400, messageKey, details);
}

/**
 * Seisukonflikt: kirje on olemas ja nähtav, aga toiming ei ole lubatud.
 * Peamine kasutus on 7-aastase säilituse kustutuskeeld — seal EI OLE 404 õige,
 * sest kasutaja näeb kirjet ja tal on õigus teada, MIKS ta seda kustutada ei saa.
 */
export function conflict(messageKey = "service_log.errors.conflict", details) {
  return new ServiceLogError(409, messageKey, details);
}
