/**
 * Tugikontaktide halduse reeglid ilma joonistamiseta (toe osa, haldur).
 *
 * Arenduskava §5.8: töötaja ei tohi olla sunnitud pöörduma just oma otsese juhi
 * poole, seega peab asutusel olema vähemalt üks alternatiivne tugitee. Haldur
 * lisab siin tugi- ja turvakontakte ning määrab liikmete otsese juhi (juhiseos ei
 * ole kontakt, vaid eraldi seos). Teenusekiht: `lib/org/support.js`.
 */

import { contactTypeKey, personLabel } from "./supportRules.js";

/** Kontaktiliigid, mida haldur lisab. */
export const ADDABLE_CONTACT_TYPES = Object.freeze(["ALTERNATE_SUPPORT", "SAFETY_CONTACT"]);

/** Haldusvaate sammud: praegused kontaktid, uue lisamine ja otsene juht. */
export const CONTACT_STEPS = Object.freeze(["list", "add", "manager"]);

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

/* --- Otsene juht ----------------------------------------------------------------
   Juhiseos EI ANNA sisuõigusi (arenduskava §5.4): juht on ainult üks saaja, kelle
   töötaja võib toeavaldusele valida. Üks kehtiv seos liikme kohta; uus seos lõpetab
   vana (teenusekiht). Vaade valib ühe liikme korraga, et ta mahuks ka suure
   asutuse puhul paneeli. */

const labelOf = (candidates, membershipId, { t }) => {
  const person = (Array.isArray(candidates) ? candidates : []).find((candidate) => candidate.membershipId === membershipId);
  return person ? personLabel(person, { t }) : "";
};

/** Liikmed valikuks: `[{ value, label }]`, soovi korral üks välja jäetud. */
export function memberOptions(candidates, { t, except = "" } = {}) {
  return (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate?.membershipId && candidate.membershipId !== except)
    .map((candidate) => ({ value: candidate.membershipId, label: personLabel(candidate, { t }) }));
}

/** Liikme kehtiv otsene juht: `{ membershipId, label }` või null. */
export function currentManager(lines, candidates, memberMembershipId, { t }) {
  const line = (Array.isArray(lines) ? lines : []).find((entry) => entry.memberMembershipId === memberMembershipId);
  return line ? { membershipId: line.managerMembershipId, label: labelOf(candidates, line.managerMembershipId, { t }) } : null;
}

/** Seosed pärast määramist: liikme vana seos asendub. */
export function withReportingLine(lines, memberMembershipId, managerMembershipId) {
  return [
    ...(Array.isArray(lines) ? lines : []).filter((entry) => entry.memberMembershipId !== memberMembershipId),
    { memberMembershipId, managerMembershipId }
  ];
}

export function withoutReportingLine(lines, memberMembershipId) {
  return (Array.isArray(lines) ? lines : []).filter((entry) => entry.memberMembershipId !== memberMembershipId);
}

/** Mitmel aktiivsel liikmel on otsene juht määratud ja mitmel mitte. */
export function reportingSummary(lines, candidates) {
  const members = new Set((Array.isArray(candidates) ? candidates : []).map((candidate) => candidate.membershipId));
  const assigned = new Set((Array.isArray(lines) ? lines : []).map((entry) => entry.memberMembershipId).filter((id) => members.has(id)));
  return { assigned: assigned.size, missing: members.size - assigned.size };
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
