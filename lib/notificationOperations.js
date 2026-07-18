import prisma from "@/lib/prisma";

const OPERATIONAL_STATUSES = Object.freeze(["UNKNOWN", "FAILED"]);

export function serializeNotificationOperation(row) {
  if (!row || !OPERATIONAL_STATUSES.includes(row.emailStatus)) return null;
  return {
    id: row.id,
    type: row.type,
    emailStatus: row.emailStatus,
    emailAttempts: Number(row.emailAttempts || 0),
    emailNextAttemptAt: row.emailNextAttemptAt || null,
    emailLastErrorCode: row.emailLastErrorCode || null,
    createdAt: row.createdAt
  };
}

export async function listNotificationOperations({ db = prisma, limit = 50 } = {}) {
  const take = Math.max(1, Math.min(Number(limit) || 50, 100));
  const rows = await db.notificationEvent.findMany({
    where: { emailStatus: { in: OPERATIONAL_STATUSES } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take,
    select: {
      id: true,
      type: true,
      emailStatus: true,
      emailAttempts: true,
      emailNextAttemptAt: true,
      emailLastErrorCode: true,
      createdAt: true
    }
  });
  return rows.map(serializeNotificationOperation).filter(Boolean);
}

export async function requeueNotificationOperation(id, { db = prisma, now = new Date() } = {}) {
  const eventId = String(id || "").trim();
  if (!eventId || eventId.length > 240) {
    throw Object.assign(new Error("Invalid notification operation id"), { status: 400 });
  }
  const result = await db.notificationEvent.updateMany({
    where: { id: eventId, emailStatus: { in: OPERATIONAL_STATUSES } },
    data: {
      emailStatus: "RETRY",
      emailAttempts: 0,
      emailNextAttemptAt: now,
      emailClaimedAt: null,
      emailLastErrorCode: null
    }
  });
  if (result.count !== 1) throw Object.assign(new Error("Notification operation not found"), { status: 404 });
  return { requeued: 1 };
}
