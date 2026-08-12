/**
 * T25 ORG-PROFILE-SUPPORT-V1 — organisatsiooni eksport (E10).
 *
 * MIDA EKSPORT SISALDAB (arenduskava §E10, §D7 „organisatsioonile kuuluv
 * töövara on piiratud loend"): struktuur, liikmesused, kutsed, õigused, kohad,
 * moodulid, tugikontaktid, vastuvõtu METAANDMED ja haldusaudit.
 *
 * MIDA EKSPORT EI SISALDA — ja see on selle faili kogu mõte:
 *   - kasutajate GDPR-andmekoopiaid (§4: „organisatsiooni eksport ei sisalda
 *     kasutajate GDPR-andmekoopiaid ega privaatobjekte"). Org-eksport ja
 *     inimese andmekoopia on ERI RAJAD ja peavadki jääma eri radadeks;
 *   - ühtegi tööheaolu toeavalduse SNAPSHOT'i. Organisatsioon näeb, ET talle
 *     avaldusi saadeti — mitte MIDA seal kirjas oli. Eksport ei tohi olla
 *     tagauks sinna, kuhu UI ei luba;
 *   - eelpöördumiste sisu. Postkastikirje kannab viidet ja seisu, seda me
 *     ekspordime; pöörduja tekst jääb pöördujale;
 *   - vestlusi, dokumente, refleksiooni, mentorlust, supervisiooni, kovisiooni.
 *
 * Eksport kannab MANIFESTI: mis on sees, mis on teadlikult väljas ja miks.
 * Ilma selleta ei saa vastuvõtja teada, kas midagi on puudu või välja jäetud.
 */

import prisma from "@/lib/prisma";

import { listAllOrgAuditEvents } from "./audit.js";

export const EXPORT_SCHEMA_VERSION = "1.0";

/** Väljajätud on osa lepingust, mitte tehniline puudujääk — nad on manifestis. */
export const EXPORT_EXCLUSIONS = Object.freeze([
  "wellbeing_support_share_snapshots",
  "wellbeing_records",
  "pre_inquiry_content",
  "conversations",
  "user_documents",
  "practice_reflections",
  "supervision",
  "mentoring",
  "covision",
  "user_gdpr_copies",
  "usage_metrics"
]);

function person(user) {
  if (!user) return null;
  return {
    email: user.email || null,
    firstName: user.profile?.firstName || null,
    lastName: user.profile?.lastName || null
  };
}

/**
 * Koostab organisatsiooni ekspordi.
 *
 * Kutsuja peab olema kontrollinud `ORG_OWNER` õiguse — see funktsioon EI TEE
 * õiguskontrolli, sest ta on andmekiht. Route teeb värava.
 */
export async function buildOrganizationExport(organizationId, { db = prisma, now = new Date() } = {}) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      displayName: true,
      legalName: true,
      registryCode: true,
      legalKind: true,
      municipalityId: true,
      status: true,
      defaultLocale: true,
      timezone: true,
      verifiedAt: true,
      activatedAt: true,
      suspendedAt: true,
      archivedAt: true,
      createdAt: true
    }
  });
  if (!organization) return null;

  const [modules, units, memberships, invites, seatPlans, supportContacts, inboxItems, auditEvents] =
    await Promise.all([
      db.organizationModule.findMany({
        where: { organizationId },
        select: { moduleKey: true, status: true, validFrom: true, validUntil: true, reason: true }
      }),
      db.organizationUnit.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          parentUnitId: true,
          depth: true,
          sortOrder: true,
          archivedAt: true
        },
        orderBy: [{ depth: "asc" }, { sortOrder: "asc" }]
      }),
      db.organizationMembership.findMany({
        where: { organizationId },
        select: {
          id: true,
          status: true,
          seatRole: true,
          jobTitle: true,
          startedAt: true,
          endedAt: true,
          endedReason: true,
          user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
          units: {
            select: { unitId: true, isPrimary: true, startedAt: true, endedAt: true }
          },
          capabilityGrants: {
            select: {
              capability: true,
              scopeType: true,
              scopeUnitId: true,
              validFrom: true,
              validUntil: true,
              revokedAt: true,
              reason: true
            }
          },
          reportingAsMember: {
            select: { managerMembershipId: true, validFrom: true, validUntil: true }
          }
        }
      }),
      db.organizationInvite.findMany({
        where: { organizationId },
        select: {
          email: true,
          status: true,
          seatRole: true,
          capabilityTemplate: true,
          jobTitle: true,
          expiresAt: true,
          acceptedAt: true,
          declinedAt: true,
          revokedAt: true,
          createdAt: true
        }
      }),
      db.organizationSeatPlan.findMany({
        where: { organizationId },
        select: {
          seatRole: true,
          seatLimit: true,
          unitPriceCents: true,
          currency: true,
          billingInterval: true,
          source: true,
          priceReason: true,
          status: true,
          validFrom: true,
          validUntil: true,
          assignments: {
            select: { membershipId: true, status: true, startedAt: true, endedAt: true, endedReason: true }
          }
        }
      }),
      db.organizationSupportContact.findMany({
        where: { organizationId },
        select: {
          membershipId: true,
          unitId: true,
          contactType: true,
          validFrom: true,
          validUntil: true
        }
      }),
      /* AINULT METAANDMED. `sourceId` on viide, mitte sisu — ja seda me
         ekspordime teadlikult, et organisatsioon saaks oma töö seisu jälile.
         Pöördumise TEKST siin puudub ja ei tohi kunagi tekkida. */
      db.organizationInboxItem.findMany({
        where: { organizationId },
        select: {
          id: true,
          sourceType: true,
          sourceId: true,
          status: true,
          unitId: true,
          receivedAt: true,
          lastTransitionAt: true,
          dueAt: true,
          closedAt: true,
          closedReason: true,
          assignments: {
            select: {
              assigneeMembershipId: true,
              status: true,
              assignedAt: true,
              acceptedAt: true,
              rejectedAt: true,
              endedAt: true,
              supersedesAssignmentId: true
            }
          }
        }
      }),
      listAllOrgAuditEvents(organizationId, { pageSize: 200, db })
    ]);

  /* Toeavaldustest AINULT LOENDUS JA SEIS — mitte ükski snapshot. See on
     ainus koht ekspordis, kus tööheaolu üldse mainitakse, ja ta on tahtlikult
     sisutu: organisatsioon näeb, et tuge küsiti, mitte mida küsiti. */
  const supportShareCounts = await db.wellbeingSupportShare.groupBy({
    by: ["status"],
    where: { organizationId },
    _count: { _all: true }
  });

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    manifest: {
      includes: [
        "organization",
        "modules",
        "units",
        "memberships",
        "capability_grants",
        "reporting_lines",
        "invites",
        "seat_plans",
        "seat_assignments",
        "support_contacts",
        "inbox_metadata",
        "work_assignments",
        "admin_audit"
      ],
      excludes: [...EXPORT_EXCLUSIONS],
      note:
        "Organisatsiooni eksport sisaldab haldus- ja töövara. Kasutajate " +
        "privaatsed objektid ja isiklikud andmekoopiad on eraldi rada ning " +
        "neid siin ei ole.",
      integrity: {
        adminAudit: {
          complete: true,
          rowCount: auditEvents.length
        }
      }
    },
    organization,
    modules,
    units,
    memberships: memberships.map((membership) => ({
      id: membership.id,
      status: membership.status,
      seatRole: membership.seatRole,
      jobTitle: membership.jobTitle,
      startedAt: membership.startedAt,
      endedAt: membership.endedAt,
      endedReason: membership.endedReason,
      person: person(membership.user),
      units: membership.units,
      capabilityGrants: membership.capabilityGrants,
      reportingLines: membership.reportingAsMember
    })),
    invites,
    seatPlans,
    supportContacts,
    inboxItems,
    supportShareSummary: supportShareCounts.map((row) => ({
      status: row.status,
      count: row._count._all
    })),
    auditEvents
  };
}

/**
 * Ekspordi valvur: tõendab, et väljund EI SISALDA keelatud võtmeid.
 *
 * See ei ole paranoia — eksport on ainus koht, kus kogu organisatsiooni andmed
 * ühte objekti kokku pannakse, ja seetõttu ainus koht, kus üks hooletu `select`
 * lekitaks kõik korraga. Valvurit kutsub nii route kui test.
 */
export const FORBIDDEN_EXPORT_KEYS = Object.freeze([
  "sharedSnapshotJson",
  "sourceDraftId",
  "sourceRecordId",
  "situation",
  "generatedDraft",
  "userEditedDraft",
  "assessmentState",
  "receiverNote",
  "computedSignal",
  "riskMarkers",
  "loadFactors",
  "standardizedFields",
  "tokenHash",
  "passwordHash"
]);

export function assertExportIsClean(payload) {
  const blob = JSON.stringify(payload || {});
  const found = FORBIDDEN_EXPORT_KEYS.filter((key) => blob.includes(`"${key}"`));
  if (found.length) {
    const error = new Error(`Organisation export contains forbidden keys: ${found.join(", ")}`);
    error.code = "ORG_EXPORT_LEAK";
    error.status = 500;
    throw error;
  }
  return true;
}
