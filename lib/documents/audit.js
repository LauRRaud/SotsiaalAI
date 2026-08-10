import { prisma } from "../prisma.js"
import { buildDocumentAuditRecord, isMappedAuditEvent } from "./auditShared.js"
import { safeError } from "@/lib/privacy/safeError"

function buildConsoleAuditPayload(event, payload = {}) {
  return {
    event,
    at: new Date().toISOString(),
    userId: payload.userId || payload.ownerId || null,
    documentId: payload.documentId || null,
    artifactId: payload.artifactId || null,
    conversationId: payload.conversationId || null,
    messageId: payload.messageId || null,
    kind: payload.kind || null,
    mime: payload.mime || null,
    format: payload.format || null,
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

  if (!record) {
    /* SOL-DOC-09: kaardistamata sündmus oli varem VAIKNE — kutse nägi välja nagu audit, aga rida
       ei tekkinud kunagi. Vaikus on siin kõige halvem seis: koodilugeja usub, et jälg on olemas.
       Best-effort logi ei tohi kohustusliku jälje eest vastutada (selleks on `writeDocumentAudit`),
       aga puuduv kaardistus peab olema NÄHTAV. */
    if (!isMappedAuditEvent(event)) {
      try {
        console.error("[documents][audit] unmapped event, no row written", { event })
      } catch {}
    }
    return
  }

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

/**
 * KOHUSTUSLIK auditijälg (SOL-DOC-09). Erinevalt `logDocumentsAudit`-ist ei neela see midagi:
 * kaardistamata sündmus ja kirjutuse viga VISKAVAD, ja `db` on süstitav, seega jälg saab olla
 * samas tehingus toiminguga, mida ta kirjeldab. Kui jälg on osa lubadusest, siis ei tohi ta
 * kaduda vaikselt.
 */
export async function writeDocumentAudit(event, payload = {}, { db = prisma } = {}) {
  const record = buildDocumentAuditRecord(event, payload)
  if (!record) {
    const error = new Error(`documents audit event is not mapped: ${String(event)}`)
    error.code = "DOCUMENTS_AUDIT_UNMAPPED"
    throw error
  }
  return db.documentAudit.create({ data: record })
}
