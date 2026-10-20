/**
 * Tugikontaktide halduse reeglid ilma joonistamiseta (toe osa, haldur).
 *
 * Arenduskava §5.8: töötaja ei tohi olla sunnitud pöörduma just oma otsese juhi
 * poole, seega peab asutusel olema vähemalt üks alternatiivne tugitee. Haldur
 * lisab siin tugi- ja turvakontakte; juhiseos (otsene juht) ei ole kontakt ja
 * seda siin ei määrata. Teenusekiht: `lib/org/support.js`.
 */

import { contactTypeKey, personLabel } from "./supportRules.js";

/** Kontaktiliigid, mida haldur lisab. */
export const ADDABLE_CONTACT_TYPES = Object.freeze(["ALTERNATE_SUPPORT", "SAFETY_CONTACT"]);

/** Haldusvaate sammud: praegused kontaktid ja uue lisamine. */
export const CONTACT_STEPS = Object.freeze(["list", "add"]);

/** Kontakti rida: kes ja mis tee. */
export function contactRows(contacts, { t }) {
  return (Array.isArray(contacts) ? contacts : []).map((contact) => ({
    id: String(contact.contactId || ""),
    title: personLabel(contact, { t }),
    sub: t(contactTypeKey(contact.contactType))
  }));
}

/** Liikmed, keda saab valitud liiki kontaktiks lisada (sama liiki kontakt jääb välja). */
export function candidateOptions(candidates, contacts, contactType, { t }) {
  const taken = new Set(
    (Array.isArray(contacts) ? contacts : []).filter((contact) => contact.contactType === contactType).map((contact) => contact.membershipId)
  );
  return (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate?.membershipId && !taken.has(candidate.membershipId))
    .map((candidate) => ({ value: candidate.membershipId, label: personLabel(candidate, { t }) }));
}

/** Lisatud kontakt halduri loendisse: nimi tuleb kandidaatide loendist. */
export function addedContact(contact, candidates) {
  const person = (Array.isArray(candidates) ? candidates : []).find((candidate) => candidate.membershipId === contact?.membershipId) || {};
  return {
    contactId: contact.id,
    contactType: contact.contactType,
    membershipId: contact.membershipId,
    jobTitle: person.jobTitle || null,
    firstName: person.firstName || null,
    lastName: person.lastName || null
  };
}
