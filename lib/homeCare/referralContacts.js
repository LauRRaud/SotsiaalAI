/**
 * KODUTEENUS K5-c — „Kuhu suunata" (kava II.3.7 punkt 5).
 *
 * Klient küsib hooldajalt asju, mis ei ole hooldaja töö. Hooldajal on telefonis lühike
 * loend sellest, kuhu inimene suunata: nimi, telefon ja millal sinna pöörduda. Loendit
 * peab asutus ise: numbrid ja lahtiolekuajad muutuvad ning neid ei tohi koodi kirjutada.
 *
 * Loeb iga koduteenuse liige; muudab kogu asutuse hooldusjuht (üksuse hooldusjuht ei
 * kirjuta kogu asutuse loendit üle). Ridu ei muudeta ega kustutata: uus loend lõpetab
 * eelmise read.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, forbidden } from "../org/errors.js";

import { assertHomeCareContext, coordinatorScope, membershipDisplayName } from "./access.js";
import { HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { phoneHref } from "./phone.js";
import { asObject, normalizeLine } from "./validation.js";

/** Telefoninumbris on lubatud numbrid, tühikud, pluss, sulud ja sidekriips; vähemalt kolm numbrit. */
const PHONE_PATTERN = /^[0-9+() -]+$/;

/** Sisend on ridade loend; tühja nimega rida jäetakse välja, järjekord jääb. Puhas funktsioon. */
export function normalizeReferralContacts(rawContacts) {
  if (!Array.isArray(rawContacts)) throw badRequest("home_care.errors.referrals_invalid");
  const contacts = [];
  for (const raw of rawContacts) {
    const row = asObject(raw);
    const name = normalizeLine(row.name, HOME_CARE_LIMITS.REFERRAL_NAME_MAX);
    const phone = normalizeLine(row.phone, HOME_CARE_LIMITS.REFERRAL_PHONE_MAX) || null;
    const note = normalizeLine(row.note, HOME_CARE_LIMITS.REFERRAL_NOTE_MAX) || null;
    if (!name) {
      /* Rida, kus on number või selgitus, aga nime ei ole, on poolik, mitte tühi. */
      if (phone || note) throw badRequest("home_care.errors.referral_name_required");
      continue;
    }
    if (phone && (!PHONE_PATTERN.test(phone) || !phoneHref(phone))) throw badRequest("home_care.errors.referral_phone_invalid");
    contacts.push({ name, phone, note });
  }
  if (contacts.length > HOME_CARE_LIMITS.REFERRALS_MAX) {
    throw badRequest("home_care.errors.referrals_too_many", { limit: HOME_CARE_LIMITS.REFERRALS_MAX });
  }
  return contacts;
}

/** Asutuse kehtiv loend järjekorras. */
export async function loadReferralContactsWithin(tx, organizationId) {
  const rows = await tx.careReferralContact.findMany({
    where: { organizationId, endedAt: null },
    select: { id: true, position: true, name: true, phone: true, note: true },
    orderBy: [{ position: "asc" }]
  });
  return rows.map((row) => ({ id: row.id, position: row.position, name: row.name, phone: row.phone || null, note: row.note || null }));
}

/** Loend koduteenuse avalehele: read ja kas vaataja tohib neid muuta. */
export async function getReferralContacts(context, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  return {
    referrals: await loadReferralContactsWithin(db, context.organization.id),
    canEditReferrals: Boolean(coordinatorScope(context)?.wholeOrg)
  };
}

/**
 * Salvestab loendi tervikuna: eelmised read lõpevad ja uued tekivad. Tühi loend tähendab,
 * et loendit enam ei ole. Kui loend ei muutunud, ei tehta midagi.
 */
export async function saveReferralContacts(context, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  if (!coordinatorScope(context)?.wholeOrg) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  const contacts = normalizeReferralContacts(asObject(input).contacts);
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    /* Kaks samaaegset salvestust ei tohi kumbki pooleldi peale jääda: asutuse rida lukku. */
    await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
    const current = await loadReferralContactsWithin(tx, organizationId);
    const same =
      current.length === contacts.length &&
      current.every((row, index) => row.name === contacts[index].name && row.phone === contacts[index].phone && row.note === contacts[index].note);
    if (same) return { referrals: current, canEditReferrals: true };

    const membershipId = context.membership?.id || null;
    await tx.careReferralContact.updateMany({ where: { organizationId, endedAt: null }, data: { endedAt: now, endedByMembershipId: membershipId } });
    if (contacts.length) {
      const createdByName = await membershipDisplayName(tx, context);
      await tx.careReferralContact.createMany({
        data: contacts.map((contact, index) => ({
          organizationId,
          position: index + 1,
          name: contact.name,
          phone: contact.phone,
          note: contact.note,
          createdByMembershipId: membershipId,
          createdByName,
          createdAt: now
        }))
      });
    }
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_REFERRALS_CHANGED,
      resourceType: OrgAuditResource.CARE_REFERRAL_LIST,
      resourceId: organizationId,
      meta: { organizationId, change: contacts.length ? "saved" : "cleared" }
    });
    return { referrals: await loadReferralContactsWithin(tx, organizationId), canEditReferrals: true };
  });
}
