import { prisma } from "../prisma.js"
import { buildDocumentAuditRecord } from "./auditShared.js"
import { safeError } from "@/lib/privacy/safeError"

function buildConsoleAuditPayload(event, payload = {}) {
  return {
    event,
    at: new Date().toISOString(),
    userId: payload.userId || payload.ownerId || null,
    documentId: payload.documentId || null,
    artifactId: payload.artifactId || null,
    kind: payload.kind || null,
    mime: payload.mime || null,
    size: Number.isFinite(Number(payload.size)) ? Number(payload.size) : null,
    action: payload.action || null,
    status: payload.status || null
  }
}

export async function logDocumentsAudit(event, payload = {}) {
  if (!event) return

  const record = buildDocumentAuditRecord(event, payload)

  try {
    console.info("[documents][audit]", buildConsoleAuditPayload(event, payload))
  } catch {}

  if (!record) return

  try {
    await prisma.documentAudit.create({
      data: record
    })
  } catch (error) {
    try {
      console.error("[documents][audit][db] failed", {
        event,
        error: safeError(error)
      })
    } catch {}
  }
}
