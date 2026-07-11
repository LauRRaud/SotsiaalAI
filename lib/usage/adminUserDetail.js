import { prisma } from "../prisma.js";
import { usageSnapshotService } from "./snapshot.js";

function maskEmail(value) {
  const email = String(value || "").trim();
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  const visible = local.length > 2 ? `${local[0]}***${local.at(-1)}` : `${local[0]}***`;
  return `${visible}@${domain}`;
}

function iso(value) {
  return value?.toISOString?.() || value || null;
}

export async function getAdminUsageUserDetail(query, db = prisma) {
  const q = String(query || "").trim();
  if (!q) return null;
  const user = await db.user.findFirst({
    where: { OR: [{ id: q }, { email: { equals: q, mode: "insensitive" } }] },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      role: true,
      isAdmin: true,
      createdAt: true,
      accessSuspendedAt: true,
      accessSuspendedReason: true,
      accessSuspendedByUserId: true
    }
  });
  if (!user) return null;

  const now = new Date();
  const [snapshot, overrides, sessionCount, lastChat, lastUsage, deletionJobs, audit] = await Promise.all([
    usageSnapshotService.getUserSnapshot(user.id, { now }),
    db.userEntitlementOverride.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    db.session.count({ where: { userId: user.id, expires: { gt: now } } }),
    db.chatLog.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.usageEvent.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.dataDeletionJob.findMany({
      where: { targetUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, resourceType: true, status: true, attempts: true, lastError: true, createdAt: true, updatedAt: true }
    }),
    db.dataAuditLog.findMany({
      where: { targetUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, resourceType: true, resourceId: true, createdAt: true, meta: true }
    })
  ]);

  const activityDates = [lastChat?.createdAt, lastUsage?.createdAt].filter(Boolean).map(value => new Date(value));
  const lastActivityAt = activityDates.length
    ? new Date(Math.max(...activityDates.map(value => value.getTime())))
    : null;

  return {
    user: {
      id: user.id,
      email: maskEmail(user.email),
      emailVerified: Boolean(user.emailVerified),
      role: user.role,
      isAdmin: user.isAdmin,
      createdAt: iso(user.createdAt),
      activeSessions: sessionCount,
      lastActivityAt: iso(lastActivityAt),
      suspension: user.accessSuspendedAt ? {
        suspendedAt: iso(user.accessSuspendedAt),
        reason: user.accessSuspendedReason,
        actorUserId: user.accessSuspendedByUserId
      } : null
    },
    snapshot,
    overrides: overrides.map(item => ({
      ...item,
      softLimit: item.softLimit?.toString() ?? null,
      hardLimit: item.hardLimit?.toString() ?? null
    })),
    deletionJobs,
    audit
  };
}
