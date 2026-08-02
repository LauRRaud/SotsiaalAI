/**
 * T25 ORG-PROFILE-SUPPORT-V1 — teenuseosutaja organisatsiooniprofiil (E8).
 *
 * KAKS REŽIIMI (arenduskava §5.9):
 *   SOLO         — kuulub ühele `ownerId` kasutajale (senine ja vaikimisi käitumine);
 *   ORGANIZATION — kuulub kontrollitud organisatsioonile, toimetamine capability kaudu.
 *
 * MIS SIIN EI MUUTU: `publicSlug`, teenused, teenuskohad, kontrolliajad ja
 * avalik ajalugu säilivad üleminekul MUUTUMATUNA. Üleminek on omandi, mitte
 * sisu muutus — avalik projektsioon ei tohi seetõttu üldse liikuda.
 *
 * JAGATUD KONTOT EI TEKI: iga muudatus jääb konkreetse kasutaja auditisse.
 * Mitu toimetajat tähendab mitut inimest oma nimega, mitte üht ühiskontot.
 */

import prisma from "@/lib/prisma";

import {
  OrganizationCapability,
  OrganizationMembershipStatus,
  OrganizationStatus
} from "./constants.js";
import { badRequest, conflict, forbidden, notFound } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "./audit.js";
import { hasCapability } from "./accessContext.js";

export const OwnershipMode = Object.freeze({
  SOLO: "SOLO",
  ORGANIZATION: "ORGANIZATION"
});

/**
 * Teisendab solo-profiili organisatsiooni profiiliks.
 *
 * KAHEPOOLNE KINNITUS ÜHES TEHINGUS (§5.9): „solo→org üleminek nõuab profiili
 * omaniku ja org-i omaniku kinnitust ühes tehingus".
 *   - `ownerConfirmed` — profiili senine omanik nõustub omandi loovutamisega;
 *   - kutsuja peab olema organisatsioonis `ORG_OWNER`.
 * Kumbki üksi ei piisa. Ilma selleta saaks kas organisatsioon võtta kellegi
 * profiili või inimene suruda oma profiili organisatsioonile.
 */
export async function convertProfileToOrganization(
  context,
  { profileId, ownerConfirmed },
  { db = prisma } = {}
) {
  if (ownerConfirmed !== true) throw badRequest("org.errors.profile_owner_confirmation_required");
  if (!hasCapability(context, OrganizationCapability.ORG_OWNER)) {
    throw forbidden("org.errors.missing_capability", { capability: OrganizationCapability.ORG_OWNER });
  }

  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { status: true }
    });
    if (organization?.status !== OrganizationStatus.ACTIVE) {
      throw conflict("org.errors.organization_not_writable");
    }

    const profile = await tx.serviceProviderProfile.findUnique({
      where: { id: profileId },
      select: { id: true, ownerId: true, ownershipMode: true, organizationId: true, publicSlug: true }
    });
    if (!profile) throw notFound("org.errors.profile_not_found");
    if (profile.ownershipMode === OwnershipMode.ORGANIZATION) {
      throw conflict("org.errors.profile_already_organization");
    }

    /* Kinnituse annab profiili OMANIK. Kutsuja peab olema kas omanik ise või
       tegutsema omaniku kinnitusel — kontrollime, et kutsuja ON omanik, sest
       teistmoodi ei ole „omaniku kinnitus" tõendatav ühe päringu sees. */
    if (!profile.ownerId || profile.ownerId !== context.userId) {
      throw forbidden("org.errors.profile_owner_must_confirm");
    }

    const taken = await tx.serviceProviderProfile.findFirst({
      where: { organizationId, ownershipMode: OwnershipMode.ORGANIZATION },
      select: { id: true }
    });
    if (taken) throw conflict("org.errors.organization_profile_exists");

    const updated = await tx.serviceProviderProfile.update({
      where: { id: profileId },
      data: {
        ownershipMode: OwnershipMode.ORGANIZATION,
        organizationId
        /* `ownerId` JÄÄB ALLES päritoluna: kes profiili lõi, on auditi fakt.
           Osaline unikaalindeks kehtib ainult SOLO-režiimis, seega see ei
           blokeeri sama inimese uut solo-profiili. */
      }
    });

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.PROFILE_CONVERTED_TO_ORGANIZATION,
      resourceType: OrgAuditResource.SERVICE_PROFILE,
      resourceId: profileId,
      meta: { organizationId, profileId, ownershipMode: OwnershipMode.ORGANIZATION }
    });

    return updated;
  });
}

/**
 * Kas see kontekst tohib organisatsiooni teenuseprofiili toimetada?
 *
 * `SERVICE_PROFILE_EDITOR` on org-skoobiga capability ja nõuab
 * `SERVICE_DELIVERY` moodulit — moodulinõuet kontrollib juba
 * `resolveOrgAccessContext`, seega siin piisab capability't küsida.
 */
export function canEditOrganizationProfile(context) {
  return hasCapability(context, OrganizationCapability.SERVICE_PROFILE_EDITOR);
}

export function assertCanEditOrganizationProfile(context) {
  if (!canEditOrganizationProfile(context)) {
    throw forbidden("org.errors.missing_capability", {
      capability: OrganizationCapability.SERVICE_PROFILE_EDITOR
    });
  }
  return true;
}

/**
 * Leiab profiili, mida see kontekst tohib toimetada.
 *
 * Võõra organisatsiooni profiil annab 404, mitte 403 — profiili olemasolu on
 * org-sisene fakt, kuni ta ei ole avalikult publitseeritud.
 */
export async function requireEditableOrganizationProfile(context, { db = prisma } = {}) {
  assertCanEditOrganizationProfile(context);
  const profile = await db.serviceProviderProfile.findFirst({
    where: {
      organizationId: context.organization.id,
      ownershipMode: OwnershipMode.ORGANIZATION
    }
  });
  if (!profile) throw notFound("org.errors.profile_not_found");
  return profile;
}

/**
 * Optimistlik lukk mitme toimetaja jaoks (§11.6 „kaks toimetajat, CAS-konflikt").
 *
 * Kaks inimest võivad sama profiili korraga avada. Kes teisena salvestab, EI
 * TOHI esimese muudatust vaikselt üle kirjutada — ta saab 409 ja näeb, et
 * vahepeal on muudetud.
 */
export async function updateOrganizationProfile(
  context,
  { profileId, expectedUpdatedAt, data },
  { db = prisma } = {}
) {
  assertCanEditOrganizationProfile(context);
  if (!expectedUpdatedAt) throw badRequest("org.errors.profile_version_required");

  return db.$transaction(async (tx) => {
    const profile = await tx.serviceProviderProfile.findFirst({
      where: {
        id: profileId,
        organizationId: context.organization.id,
        ownershipMode: OwnershipMode.ORGANIZATION
      },
      select: { id: true, updatedAt: true }
    });
    if (!profile) throw notFound("org.errors.profile_not_found");

    const expected = new Date(expectedUpdatedAt);
    if (!Number.isFinite(expected.getTime())) throw badRequest("org.errors.profile_version_required");

    const result = await tx.serviceProviderProfile.updateMany({
      where: { id: profileId, updatedAt: expected },
      data
    });
    if (result.count !== 1) throw conflict("org.errors.profile_version_conflict");

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.PROFILE_EDITOR_CHANGED,
      resourceType: OrgAuditResource.SERVICE_PROFILE,
      resourceId: profileId,
      meta: { organizationId: context.organization.id, profileId }
    });

    return tx.serviceProviderProfile.findUnique({ where: { id: profileId } });
  });
}

/**
 * Kes tohivad organisatsiooni profiili toimetada — nimeliselt.
 *
 * §5.9: „iga muudatus jääb konkreetse kasutaja auditisse; jagatud kontot ei
 * looda". See loend on selle nõude nähtav pool: toimetajad on inimesed, mitte
 * roll ühiskonto taga.
 */
export async function listProfileEditors(organizationId, { db = prisma, now = new Date() } = {}) {
  const grants = await db.organizationCapabilityGrant.findMany({
    where: {
      capability: OrganizationCapability.SERVICE_PROFILE_EDITOR,
      revokedAt: null,
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      membership: { organizationId, status: OrganizationMembershipStatus.ACTIVE }
    },
    select: {
      membershipId: true,
      membership: {
        select: {
          id: true,
          jobTitle: true,
          user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } }
        }
      }
    }
  });

  return grants.map((grant) => ({
    membershipId: grant.membershipId,
    jobTitle: grant.membership?.jobTitle || null,
    email: grant.membership?.user?.email || null,
    firstName: grant.membership?.user?.profile?.firstName || null,
    lastName: grant.membership?.user?.profile?.lastName || null
  }));
}

/**
 * Avaliku projektsiooni regressioonikaitse (§11.6: „avalik projektsioon ei leki
 * sisemisi liikmeid ega auditit").
 *
 * Organisatsiooni profiil paistab avalikult TÄPSELT samamoodi kui solo-profiil.
 * Omandirežiim, organisatsiooni ID ja toimetajad EI OLE avalik info.
 */
export function toPublicProfileProjection(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    organizationName: profile.organizationName,
    organizationType: profile.organizationType,
    registryCode: profile.registryCode,
    shortDescription: profile.shortDescription,
    longDescription: profile.longDescription,
    services: profile.services,
    serviceCategories: profile.serviceCategories,
    targetGroups: profile.targetGroups,
    serviceArea: profile.serviceArea,
    county: profile.county,
    address: profile.address,
    phone: profile.phone,
    email: profile.email,
    website: profile.website,
    languages: profile.languages,
    accessibilityInfo: profile.accessibilityInfo,
    feeType: profile.feeType,
    status: profile.status,
    publicSlug: profile.publicSlug,
    publishedAt: profile.publishedAt,
    checkedAt: profile.checkedAt
  };
}
