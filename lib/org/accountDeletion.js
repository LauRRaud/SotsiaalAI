/** Organisatsiooniliikmesuste fail-closed lõpetamine konto kustutuse tehingus. */

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "./audit.js";
import { conflict } from "./errors.js";
import { isLastActiveOwner, lockMembershipRow, lockOrganizationRow } from "./members.js";

async function assertReadyWithinTransaction(userId, db) {
  const memberships = await db.organizationMembership.findMany({
    where: { userId, status: { not: "ENDED" } },
    select: { id: true, organizationId: true },
    orderBy: [{ organizationId: "asc" }, { id: "asc" }]
  });
  for (const candidate of memberships) {
    await lockOrganizationRow(db, candidate.organizationId);
    await lockMembershipRow(db, candidate.id);
    const current = await db.organizationMembership.findFirst({
      where: { id: candidate.id, organizationId: candidate.organizationId, userId, status: { not: "ENDED" } },
      select: { id: true, organizationId: true }
    });
    if (!current) continue;
    if (await isLastActiveOwner(db, current.organizationId, current.id)) {
      throw conflict("org.errors.last_owner_cannot_leave", {
        organizationId: current.organizationId,
        membershipId: current.id
      });
    }
    const liveWork = await db.organizationWorkAssignment.count({
      where: { assigneeMembershipId: current.id, status: { in: ["PENDING", "ACCEPTED"] } }
    });
    if (liveWork > 0) {
      throw conflict("org.errors.membership_has_live_work", {
        organizationId: current.organizationId,
        membershipId: current.id,
        liveWork
      });
    }
  }
  return { ok: true };
}

export async function assertOrganizationAccountDeletionReady(userId, { db } = {}) {
  if (!userId) return { ok: true };
  if (typeof db?.$transaction !== "function") throw new TypeError("database transaction is required");
  return db.$transaction((tx) => assertReadyWithinTransaction(userId, tx));
}

export async function offboardOrganizationMembershipsForAccountDeletion(
  userId,
  { db, now = new Date() } = {}
) {
  if (!userId) return { membershipsEnded: 0, membershipsErased: 0 };
  const memberships = await db.organizationMembership.findMany({
    where: { userId },
    select: { id: true, organizationId: true },
    orderBy: [{ organizationId: "asc" }, { id: "asc" }]
  });
  const counts = { membershipsEnded: 0, membershipsErased: 0 };

  for (const candidate of memberships) {
    // Sama lukuprotokoll mis endMembership(): org enne liikmesust.
    await lockOrganizationRow(db, candidate.organizationId);
    await lockMembershipRow(db, candidate.id);
    const membership = await db.organizationMembership.findFirst({
      where: { id: candidate.id, organizationId: candidate.organizationId, userId },
      select: { id: true, organizationId: true, userId: true, status: true, seatRole: true }
    });
    // Retry või teine serialiseeritud offboarding jõudis ette.
    if (!membership) continue;

    if (membership.status !== "ENDED") {
      if (await isLastActiveOwner(db, membership.organizationId, membership.id)) {
        throw conflict("org.errors.last_owner_cannot_leave", {
          organizationId: membership.organizationId,
          membershipId: membership.id
        });
      }
      const liveWork = await db.organizationWorkAssignment.count({
        where: {
          assigneeMembershipId: membership.id,
          status: { in: ["PENDING", "ACCEPTED"] }
        }
      });
      if (liveWork > 0) {
        throw conflict("org.errors.membership_has_live_work", {
          organizationId: membership.organizationId,
          membershipId: membership.id,
          liveWork
        });
      }

      await db.organizationSeatAssignment.updateMany({
        where: { membershipId: membership.id, status: { not: "ENDED" } },
        data: { status: "ENDED", endedAt: now, endedReason: "org.reason.account_deleted" }
      });
      await db.organizationCapabilityGrant.updateMany({
        where: { membershipId: membership.id, revokedAt: null },
        data: { revokedAt: now, revokedByUserId: userId }
      });
      await db.organizationMembershipUnit.updateMany({
        where: { membershipId: membership.id, endedAt: null },
        data: { endedAt: now }
      });
      await writeOrgAudit(db, {
        actorUserId: userId,
        targetUserId: userId,
        action: OrgAuditAction.MEMBER_ENDED,
        resourceType: OrgAuditResource.MEMBERSHIP,
        resourceId: membership.id,
        meta: {
          organizationId: membership.organizationId,
          membershipId: membership.id,
          reason: "account_deleted"
        }
      });
      counts.membershipsEnded += 1;
    }

    await db.organizationMembership.update({
      where: { id: membership.id },
      data: {
        status: "ENDED",
        endedAt: membership.status === "ENDED" ? undefined : now,
        endedReason: membership.status === "ENDED" ? undefined : "org.reason.account_deleted",
        userId: null,
        userErasedAt: now
      }
    });
    await writeOrgAudit(db, {
      actorUserId: userId,
      targetUserId: userId,
      action: OrgAuditAction.MEMBER_IDENTITY_ERASED,
      resourceType: OrgAuditResource.MEMBERSHIP,
      resourceId: membership.id,
      meta: {
        organizationId: membership.organizationId,
        membershipId: membership.id,
        reason: "account_deleted"
      }
    });
    counts.membershipsErased += 1;
  }

  return counts;
}
