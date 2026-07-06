import { prisma } from "@/lib/prisma"
import { redactObject, safeError } from "@/lib/privacy/safeError"

function normalizeOptionalText(value, max = 240) {
  const text = String(value || "").trim()
  if (!text) return null
  return text.length > max ? text.slice(0, max) : text
}

export async function logDataAudit({
  actorUserId = null,
  targetUserId = null,
  action,
  resourceType = null,
  resourceId = null,
  ipAddress = null,
  userAgent = null,
  meta = null
} = {}) {
  const normalizedAction = normalizeOptionalText(action, 120)
  if (!normalizedAction) return null

  try {
    return await prisma.dataAuditLog.create({
      data: {
        actorUserId: normalizeOptionalText(actorUserId),
        targetUserId: normalizeOptionalText(targetUserId),
        action: normalizedAction,
        resourceType: normalizeOptionalText(resourceType, 120),
        resourceId: normalizeOptionalText(resourceId, 240),
        ipAddress: normalizeOptionalText(ipAddress, 120),
        userAgent: normalizeOptionalText(userAgent, 500),
        meta: meta && typeof meta === "object" ? redactObject(meta) : null
      }
    })
  } catch (error) {
    try {
      console.error("[data-audit] write failed", safeError(error))
    } catch {}
    return null
  }
}
