import { prisma } from "@/lib/prisma"
import { redactObject, safeError } from "@/lib/privacy/safeError"

function normalizeOptionalText(value, max = 240) {
  const text = String(value || "").trim()
  if (!text) return null
  return text.length > max ? text.slice(0, max) : text
}

function auditRowData({
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
  return {
    actorUserId: normalizeOptionalText(actorUserId),
    targetUserId: normalizeOptionalText(targetUserId),
    action: normalizedAction,
    resourceType: normalizeOptionalText(resourceType, 120),
    resourceId: normalizeOptionalText(resourceId, 240),
    ipAddress: normalizeOptionalText(ipAddress, 120),
    userAgent: normalizeOptionalText(userAgent, 500),
    meta: meta && typeof meta === "object" ? redactObject(meta) : null
  }
}

/**
 * KOHUSTUSLIK auditikirje (SOL-FIELD-03).
 *
 * Kaks vahet `logDataAudit`-ist ja mõlemad on sihilikud:
 *
 * 1. **`db` on süstitav.** Ilma selleta kirjutas audit ALATI moodulitaseme
 *    globaalse ühenduse kaudu — ka siis, kui põhitoiming käis süstitud
 *    tehingukliendis. Põhiseis ja tema tõend võisid nii sattuda eri ühendusse ja
 *    eri commit'i tulemusse. Testides tähendas sama viga seda, et fake-DB-ga
 *    roheline test proovis vaikselt päris andmebaasi kirjutada.
 * 2. **Viga VISATAKSE.** „Kes selle tegi" ei ole telemeetria. Kui tõendit ei saa
 *    kirjutada, ei tohi toiming vaikselt õnnestuda — kutsuja paneb ta samasse
 *    tehingusse ja viga pöörab põhitoimingu tagasi.
 *
 * Tühi `action` on siin VIGA, mitte vaikne `null`: kohustuslikku kirjet ei tohi
 * saada „täidetuks" kirjaveaga.
 */
export async function writeDataAudit({ db = prisma, ...entry } = {}) {
  const data = auditRowData(entry)
  if (!data) {
    const error = new Error("data-audit: action is required")
    error.code = "DATA_AUDIT_ACTION_REQUIRED"
    throw error
  }
  return db.dataAuditLog.create({ data })
}

/**
 * Best-effort auditikirje: viga logitakse ja neelatakse.
 *
 * See on õige valik ainult siis, kui kirje puudumine EI muuda toimingut
 * tõendamatuks — nt taustakäigu loendur, mille juures tagasipööramine teeks
 * rohkem kahju (juba saadetud e-kiri läheks teist korda). Kõik muu kasutagu
 * `writeDataAudit`-i.
 */
export async function logDataAudit(entry = {}) {
  try {
    return await writeDataAudit(entry)
  } catch (error) {
    // Tegevuseta kutse oli ka varem vaikne `null`, mitte logirida.
    if (error?.code === "DATA_AUDIT_ACTION_REQUIRED") return null
    try {
      console.error("[data-audit] write failed", safeError(error))
    } catch {}
    return null
  }
}
