/**
 * T25 ORG-PROFILE-SUPPORT-V1 — juhiseosed ja tugikontaktid (E4 saba + E9 alus).
 *
 * KAKS INVARIANTI, mis on selle faili mõte:
 *
 *   1. JUHISEOS EI ANNA SISUÕIGUSI (arenduskava §5.4). Otsene juht on
 *      TOEAVALDUSE VAIKEADRESSAAT, mitte capability. Seda seost ei tohi
 *      kasutada üheski õiguskontrollis — `lib/org/accessContext.js` ei impordi
 *      seda faili ja ei tohi hakata importima.
 *
 *   2. ALTERNATIIVNE TUGITEE ON KOHUSTUSLIK. Töötaja ei tohi olla sunnitud
 *      pöörduma just oma otsese juhi poole — inimene, kelle pärast tugi vaja
 *      on, võib olla just tema juht. `assertAlternateSupportExists` on värav,
 *      mille professionaalse toe moodul peab läbima.
 */

import prisma from "@/lib/prisma";

import { OrganizationMembershipStatus } from "./constants.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "./audit.js";

export const SupportContactType = Object.freeze({
  DIRECT_MANAGER: "DIRECT_MANAGER",
  ALTERNATE_SUPPORT: "ALTERNATE_SUPPORT",
  SAFETY_CONTACT: "SAFETY_CONTACT"
});

export const SUPPORT_CONTACT_TYPES = Object.freeze(Object.values(SupportContactType));

async function requireActiveMembership(tx, organizationId, membershipId, messageKey) {
  const membership = await tx.organizationMembership.findFirst({
    where: { id: membershipId, organizationId, status: OrganizationMembershipStatus.ACTIVE },
    select: { id: true, userId: true }
  });
  if (!membership) throw notFound(messageKey || "org.errors.membership_not_found");
  return membership;
}

/**
 * Määrab liikmele otsese juhi. Vana seos LÕPETATAKSE (`validUntil`), mitte ei
 * kustutata — kes kellele millal allus, on auditeeritav fakt.
 */
export async function setReportingLine(
  organizationId,
  { actorUserId, memberMembershipId, managerMembershipId },
  { db = prisma, now = new Date() } = {}
) {
  if (memberMembershipId === managerMembershipId) throw badRequest("org.errors.reporting_self");

  return db.$transaction(async (tx) => {
    const member = await requireActiveMembership(tx, organizationId, memberMembershipId);
    const manager = await requireActiveMembership(tx, organizationId, managerMembershipId);

    const current = await tx.organizationReportingLine.findFirst({
      where: { memberMembershipId, validUntil: null },
      select: { id: true, managerMembershipId: true }
    });
    if (current?.managerMembershipId === managerMembershipId) {
      throw conflict("org.errors.reporting_unchanged");
    }
    if (current) {
      await tx.organizationReportingLine.update({
        where: { id: current.id },
        data: { validUntil: now }
      });
    }

    const created = await tx.organizationReportingLine.create({
      data: { memberMembershipId, managerMembershipId, createdByUserId: actorUserId, validFrom: now }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      targetUserId: member.userId,
      action: OrgAuditAction.REPORTING_LINE_SET,
      resourceType: OrgAuditResource.REPORTING_LINE,
      resourceId: created.id,
      meta: { organizationId, membershipId: memberMembershipId, managerMembershipId: manager.id }
    });

    return created;
  });
}

export async function endReportingLine(
  organizationId,
  memberMembershipId,
  { actorUserId },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    await requireActiveMembership(tx, organizationId, memberMembershipId);
    const current = await tx.organizationReportingLine.findFirst({
      where: { memberMembershipId, validUntil: null },
      select: { id: true }
    });
    if (!current) throw notFound("org.errors.reporting_not_found");

    const updated = await tx.organizationReportingLine.update({
      where: { id: current.id },
      data: { validUntil: now }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.REPORTING_LINE_ENDED,
      resourceType: OrgAuditResource.REPORTING_LINE,
      resourceId: current.id,
      meta: { organizationId, membershipId: memberMembershipId }
    });

    return updated;
  });
}

export async function addSupportContact(
  organizationId,
  { actorUserId, membershipId, contactType, unitId = null },
  { db = prisma } = {}
) {
  if (!SUPPORT_CONTACT_TYPES.includes(contactType)) throw badRequest("org.errors.invalid_contact_type");

  return db.$transaction(async (tx) => {
    const membership = await requireActiveMembership(tx, organizationId, membershipId);
    if (unitId) {
      const unit = await tx.organizationUnit.findFirst({
        where: { id: unitId, organizationId, status: "ACTIVE" },
        select: { id: true }
      });
      if (!unit) throw notFound("org.errors.unit_not_found");
    }

    const existing = await tx.organizationSupportContact.findFirst({
      where: { organizationId, membershipId, contactType, validUntil: null },
      select: { id: true }
    });
    if (existing) throw conflict("org.errors.support_contact_exists");

    const created = await tx.organizationSupportContact.create({
      data: { organizationId, membershipId, contactType, unitId, createdByUserId: actorUserId }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      targetUserId: membership.userId,
      action: OrgAuditAction.SUPPORT_CONTACT_ADDED,
      resourceType: OrgAuditResource.SUPPORT_CONTACT,
      resourceId: created.id,
      meta: { organizationId, membershipId, contactType, unitId }
    });

    return created;
  });
}

export async function endSupportContact(
  organizationId,
  contactId,
  { actorUserId },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const contact = await tx.organizationSupportContact.findFirst({
      where: { id: contactId, organizationId, validUntil: null },
      select: { id: true, contactType: true, membershipId: true }
    });
    if (!contact) throw notFound("org.errors.support_contact_not_found");

    /* Viimast alternatiivset tugiteed EI SAA eemaldada, kui professionaalse
       toe moodul on aktiivne: siis jääks ainsaks teeks otsene juht ja §5.8
       nõue oleks vaikselt rikutud. */
    if (contact.contactType === SupportContactType.ALTERNATE_SUPPORT) {
      const moduleActive = await tx.organizationModule.findFirst({
        where: { organizationId, moduleKey: "PROFESSIONAL_SUPPORT", status: "ACTIVE" },
        select: { id: true }
      });
      if (moduleActive) {
        const remaining = await tx.organizationSupportContact.count({
          where: {
            organizationId,
            contactType: SupportContactType.ALTERNATE_SUPPORT,
            validUntil: null,
            id: { not: contactId }
          }
        });
        if (remaining === 0) throw conflict("org.errors.last_alternate_support");
      }
    }

    const updated = await tx.organizationSupportContact.update({
      where: { id: contactId },
      data: { validUntil: now }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.SUPPORT_CONTACT_ENDED,
      resourceType: OrgAuditResource.SUPPORT_CONTACT,
      resourceId: contactId,
      meta: { organizationId, membershipId: contact.membershipId, contactType: contact.contactType }
    });

    return updated;
  });
}

/**
 * Kellele see inimene saab toeavalduse saata?
 *
 * Loend on TÖÖTAJA valik, mitte organisatsiooni oma: otsene juht on ainult
 * ÜKS variant kolmest ja teda ei eelvalita. Arenduskava §5.4: „töötaja võib toe
 * saatmisel valida organisatsiooni määratud alternatiivse tugikontakti".
 */
export async function listSupportRecipients(organizationId, membershipId, { db = prisma } = {}) {
  const [line, contacts] = await Promise.all([
    db.organizationReportingLine.findFirst({
      where: { memberMembershipId: membershipId, validUntil: null },
      select: {
        managerMembershipId: true,
        manager: {
          select: {
            id: true,
            jobTitle: true,
            status: true,
            user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } }
          }
        }
      }
    }),
    db.organizationSupportContact.findMany({
      where: { organizationId, validUntil: null },
      select: {
        id: true,
        contactType: true,
        membershipId: true,
        membership: {
          select: {
            id: true,
            jobTitle: true,
            status: true,
            user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } }
          }
        }
      }
    })
  ]);

  const toEntry = (membership, contactType, contactId = null) => {
    const firstName = membership.user?.profile?.firstName || null;
    const lastName = membership.user?.profile?.lastName || null;
    return {
      membershipId: membership.id,
      contactType,
      contactId,
      jobTitle: membership.jobTitle || null,
      firstName,
      lastName,
      /*
       * E-post tuleb kaasa AINULT siis, kui nimi puudub. Ilma selleta kuvas
       * valik nimeta liikme kohal „—" ja saatja ei saanud teada, KELLELE ta
       * oma tööheaolu kokkuvõtte saadab — see teeb §9 teadliku nõusoleku
       * võimatuks. Nimega liikme e-posti me siin ei saada: saaja tuvastamine
       * on saatja õigus, kontaktandmete loend ei ole.
       */
      email: firstName || lastName ? null : membership.user?.email || null
    };
  };

  const entries = [];
  if (line?.manager && line.manager.status === OrganizationMembershipStatus.ACTIVE) {
    entries.push(toEntry(line.manager, SupportContactType.DIRECT_MANAGER));
  }
  for (const contact of contacts) {
    if (!contact.membership || contact.membership.status !== OrganizationMembershipStatus.ACTIVE) continue;
    // Iseendale toeavaldust saata ei saa.
    if (contact.membershipId === membershipId) continue;
    entries.push(toEntry(contact.membership, contact.contactType, contact.id));
  }

  // Sama inimene võib olla korraga juht ja tugikontakt — kuvame ta üks kord.
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.membershipId}:${entry.contactType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Värav professionaalse toe mooduli aktiveerimisele (arenduskava §5.8):
 * „vähemalt üks alternatiivne tugitee, kui organisatsioon aktiveerib
 * professionaalse toe mooduli".
 */
export async function assertAlternateSupportExists(organizationId, { db = prisma } = {}) {
  const count = await db.organizationSupportContact.count({
    where: {
      organizationId,
      contactType: SupportContactType.ALTERNATE_SUPPORT,
      validUntil: null,
      membership: { status: OrganizationMembershipStatus.ACTIVE }
    }
  });
  if (count === 0) throw conflict("org.errors.alternate_support_required");
  return true;
}
