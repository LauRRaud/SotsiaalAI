/**
 * T25 ORG-FOUNDATION-V1 — organisatsiooni haldussündmuste audit.
 *
 * Kannab arenduskava §E11 nõuet: „haldustoimingud `DataAuditLog` või selle
 * kanoonilise järglase kaudu". Kasutame olemasolevat `DataAuditLog`-i, mitte uut
 * paralleelset auditit — kaks auditi-tõde on halvem kui üks.
 *
 * MIDA SIIA EI KIRJUTATA (arenduskava §4, §7.4, §11.8):
 *   - mitte ühtegi privaatobjekti sisu ega viidet;
 *   - mitte ühtegi kasutusmõõdikut („viimati aktiivne", vestluste arv);
 *   - mitte täisaadresse — kutse e-post maskeeritakse.
 * Auditi eesmärk on tõendada HALDUSTOIMINGUT, mitte jälgida inimest.
 *
 * MIKS MITTE `emitDomainEvent`: U1 sündmuste registri (`lib/events/registry.js`)
 * on suletud valideeritud registriga ja oma gate'i (`U1_OUTBOX_ENABLED`) taga.
 * Org-sündmuste lisamine sinna on mõttekas siis, kui neil on päris SAAJA
 * (kutse-teavitus, töö määramine) — see tuleb viiluga, mis selle saaja loob.
 */

import prisma from "@/lib/prisma";

export const OrgAuditAction = Object.freeze({
  ORGANIZATION_CREATED: "org.organization_created",
  ORGANIZATION_UPDATED: "org.organization_updated",
  ORGANIZATION_STATUS_CHANGED: "org.organization_status_changed",
  MODULE_ACTIVATED: "org.module_activated",
  MODULE_SUSPENDED: "org.module_suspended",
  UNIT_CREATED: "org.unit_created",
  UNIT_UPDATED: "org.unit_updated",
  UNIT_MOVED: "org.unit_moved",
  UNIT_ARCHIVED: "org.unit_archived",
  INVITE_CREATED: "org.invite_created",
  INVITE_REVOKED: "org.invite_revoked",
  INVITE_ACCEPTED: "org.invite_accepted",
  INVITE_DECLINED: "org.invite_declined",
  MEMBER_SUSPENDED: "org.member_suspended",
  MEMBER_REACTIVATED: "org.member_reactivated",
  MEMBER_ENDED: "org.member_ended",
  MEMBER_UNIT_CHANGED: "org.member_unit_changed",
  CAPABILITY_GRANTED: "org.capability_granted",
  CAPABILITY_REVOKED: "org.capability_revoked",
  // T25 viil B — rahastus
  SEAT_PLAN_CREATED: "org.seat_plan_created",
  SEAT_PLAN_UPDATED: "org.seat_plan_updated",
  SEAT_PLAN_ENDED: "org.seat_plan_ended",
  SEAT_ASSIGNED: "org.seat_assigned",
  SEAT_RELEASED: "org.seat_released",
  CLIENT_SPONSORSHIP_CREATED: "org.client_sponsorship_created",
  CLIENT_SPONSORSHIP_REVOKED: "org.client_sponsorship_revoked",
  CLIENT_SPONSORSHIP_ACCEPTED: "org.client_sponsorship_accepted",
  CLIENT_SPONSORSHIP_DECLINED: "org.client_sponsorship_declined",
  // T25 viil B — vastuvõtt
  INBOX_ITEM_RECEIVED: "org.inbox_item_received",
  INBOX_ITEM_TRANSITIONED: "org.inbox_item_transitioned",
  WORK_ASSIGNED: "org.work_assigned",
  WORK_ACCEPTED: "org.work_accepted",
  WORK_REJECTED: "org.work_rejected",
  WORK_HANDED_OVER: "org.work_handed_over",
  // T25 viil C — tugi ja profiil
  REPORTING_LINE_SET: "org.reporting_line_set",
  REPORTING_LINE_ENDED: "org.reporting_line_ended",
  SUPPORT_CONTACT_ADDED: "org.support_contact_added",
  SUPPORT_CONTACT_ENDED: "org.support_contact_ended",
  /* Toeavalduse audit kannab AINULT fakti ja ID-d. Mitte kunagi
     `sharedSnapshotJson` sisu ega ühtegi välja sellest (arenduskava §D8). */
  SUPPORT_SHARE_SENT: "org.support_share_sent",
  SUPPORT_SHARE_OPENED: "org.support_share_opened",
  SUPPORT_SHARE_RECALLED: "org.support_share_recalled",
  SUPPORT_SHARE_CORRECTED: "org.support_share_corrected",
  SUPPORT_SHARE_CLOSED: "org.support_share_closed",
  PROFILE_CONVERTED_TO_ORGANIZATION: "org.profile_converted_to_organization",
  PROFILE_EDITOR_CHANGED: "org.profile_editor_changed"
});

export const ORG_AUDIT_ACTIONS = Object.freeze(Object.values(OrgAuditAction));

export const OrgAuditResource = Object.freeze({
  ORGANIZATION: "ORGANIZATION",
  UNIT: "ORGANIZATION_UNIT",
  MEMBERSHIP: "ORGANIZATION_MEMBERSHIP",
  INVITE: "ORGANIZATION_INVITE",
  CAPABILITY_GRANT: "ORGANIZATION_CAPABILITY_GRANT",
  MODULE: "ORGANIZATION_MODULE",
  // T25 viil B
  SEAT_PLAN: "ORGANIZATION_SEAT_PLAN",
  SEAT_ASSIGNMENT: "ORGANIZATION_SEAT_ASSIGNMENT",
  CLIENT_SPONSORSHIP: "ORGANIZATION_CLIENT_SPONSORSHIP",
  INBOX_ITEM: "ORGANIZATION_INBOX_ITEM",
  WORK_ASSIGNMENT: "ORGANIZATION_WORK_ASSIGNMENT",
  // T25 viil C
  REPORTING_LINE: "ORGANIZATION_REPORTING_LINE",
  SUPPORT_CONTACT: "ORGANIZATION_SUPPORT_CONTACT",
  SUPPORT_SHARE: "WELLBEING_SUPPORT_SHARE",
  SERVICE_PROFILE: "SERVICE_PROVIDER_PROFILE"
});

/**
 * `mari.maasikas@vald.ee` → `m***@vald.ee`. Domeen jääb, sest tema järgi
 * tuvastab administraator oma organisatsiooni kutse; kohalik osa mitte.
 */
export function maskEmail(email) {
  const value = String(email || "").trim();
  const at = value.indexOf("@");
  if (at <= 0) return "***";
  return `${value.slice(0, 1)}***${value.slice(at)}`;
}

/**
 * Meta lubatud võtmed. Kõik muu visatakse ära — see on valge nimekiri, sest
 * musta nimekirja unustatakse täiendada ja siis lekib esimene uus väli.
 */
const ALLOWED_META_KEYS = new Set([
  "organizationId",
  "unitId",
  "parentUnitId",
  "previousParentUnitId",
  "membershipId",
  "inviteId",
  "capability",
  "scopeType",
  "scopeUnitId",
  "seatRole",
  "moduleKey",
  "fromStatus",
  "toStatus",
  "emailMasked",
  "reason",
  "templateKey",
  "depth",
  // T25 viil B. NB siin EI OLE `sourceId`-d ega ühtegi sisuvälja: audit
  // ütleb, ET töö määrati, mitte MIS töös kirjas on.
  "seatPlanId",
  "seatLimit",
  "unitPriceCents",
  "assignmentId",
  "inboxItemId",
  "sourceType",
  "fromInboxStatus",
  "toInboxStatus",
  "sponsorshipId",
  "used",
  "requested",
  // T25 viil C. NB siin EI OLE `sharedSnapshotJson`, `sourceRecordId` ega
  // ühtegi tööheaolu välja: audit ütleb, ET avaldus saadeti, mitte MIS seal on.
  "managerMembershipId",
  "contactType",
  "shareId",
  "profileId",
  "ownershipMode"
]);

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== "object") return undefined;
  const clean = {};
  for (const [key, value] of Object.entries(meta)) {
    if (!ALLOWED_META_KEYS.has(key)) continue;
    if (value === undefined || value === null) continue;
    clean[key] = typeof value === "string" ? value.slice(0, 500) : value;
  }
  return Object.keys(clean).length ? clean : undefined;
}

/**
 * Kirjutab auditirea. Kutsu ALATI sama tehingu sees, mis muudatuse tegi —
 * eraldi kirjutus võib ebaõnnestuda ja jätta muudatuse jäljetuks.
 *
 * @param {Object} tx Prisma tehinguklient (või `prisma` väljaspool tehingut).
 */
export async function writeOrgAudit(tx, { actorUserId, targetUserId = null, action, resourceType, resourceId, meta }) {
  const db = tx || prisma;
  return db.dataAuditLog.create({
    data: {
      actorUserId: actorUserId || null,
      targetUserId: targetUserId || null,
      action,
      resourceType,
      resourceId: resourceId || null,
      meta: sanitizeMeta(meta)
    }
  });
}

/**
 * Organisatsiooni auditiprojektsioon `/org/[orgId]/audit` jaoks.
 *
 * KAKS PIIRI, mis teevad sellest org-auditi, mitte platvormi auditi:
 *   1. ainult `org.*` toimingud — ükski muu `DataAuditLog` rida siit läbi ei tule;
 *   2. ainult selle organisatsiooni ressursid — filtreerime `meta.organizationId`
 *      järgi, mitte kasutaja järgi.
 *
 * E0 leid L10: `DataAuditLog`-il ei ole `resourceType`/`resourceId` indeksit,
 * seega see päring skaneerib. Viilu A mahus on read vähesed; kui org-audit muutub
 * kuumaks vaateks, tuleb lisada indeks või eraldi projektsioonitabel.
 */
export async function listOrgAuditEvents(organizationId, { take = 100, db = prisma } = {}) {
  const rows = await db.dataAuditLog.findMany({
    where: {
      action: { in: ORG_AUDIT_ACTIONS },
      meta: { path: ["organizationId"], equals: organizationId }
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(Number(take) || 100, 1), 200),
    select: {
      id: true,
      createdAt: true,
      action: true,
      resourceType: true,
      resourceId: true,
      actorUserId: true,
      meta: true
    }
  });

  /* Projektsioon ei sisalda `targetUserId`-d ega IP/User-Agenti: organisatsiooni
     auditivaade näitab, MIDA tehti, mitte kust ja millise seadmega. */
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    actorUserId: row.actorUserId,
    meta: row.meta || null
  }));
}
