/**
 * JUHTUM-V1 (CASEWORK-P7) — vead.
 *
 * MITTEPALJASTAV MUSTER: võõras juhtum ja OLEMATU juhtum annavad MÕLEMAD 404.
 * Töötajate juhtumid on üksteise suhtes täielikult eraldatud (leping L2) ja 403
 * ütleks „selline juhtum on olemas, aga sina ei tohi" — see lekiks fakti, et
 * mingi ID eksisteerib, ja koos sildiga oleks see fakt inimese kohta. Sama
 * muster mis Teenuspäevikul ja T07 owner-404-l.
 *
 * ERAND on `conflict`: teda kasutatakse ainult siis, kui juhtum on kasutajale
 * JUBA nähtav (ta on omanik) ja takistus on seisund, mitte ligipääs.
 */

export class CaseWorkError extends Error {
  constructor(status, messageKey, details) {
    super(messageKey);
    this.name = "CaseWorkError";
    this.status = status;
    this.messageKey = messageKey;
    if (details) this.details = details;
  }
}

/** Juhtum puudub VÕI kasutaja ei tohi teada, et ta olemas on. */
export function notFound(messageKey = "casework.errors.not_found") {
  return new CaseWorkError(404, messageKey);
}

export function badRequest(messageKey = "casework.errors.invalid_input", details) {
  return new CaseWorkError(400, messageKey, details);
}

/**
 * Seisukonflikt: juhtum on nähtav, aga toiming ei ole selles seisus lubatud
 * (nt kirjutamine `READ_ONLY` juhtumisse või keelatud retention-siire).
 */
export function conflict(messageKey = "casework.errors.conflict", details) {
  return new CaseWorkError(409, messageKey, details);
}

/**
 * Funktsioon on välja lülitatud (L19). **404, mitte 403** — väljas värav
 * tähendab, et funktsiooni ei ole olemas, ja 403 kinnitaks tema olemasolu.
 */
export function featureDisabled() {
  return new CaseWorkError(404, "casework.errors.not_found");
}
