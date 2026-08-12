import { prisma } from "@/lib/prisma";
import { redactObject, safeError } from "@/lib/privacy/safeError";

const PAYMENT_LOG_ENABLED = process.env.PAYMENT_LOG_ENABLED !== "0";
const PAYMENT_DB_LOG_ENABLED = process.env.PAYMENT_DB_LOG_ENABLED !== "0";
const MAX_VALUE_LENGTH = 300;
const SENSITIVE_PAYMENT_LOG_KEY_RE = /^(authorization|cookie|password|token|accessToken|refreshToken|apiKey|secret|raw|body|payload|audioBuffer|file|content|text|messageContent)$/i;

function clip(value) {
  const text = String(value ?? "");
  if (text.length <= MAX_VALUE_LENGTH) return text;
  return `${text.slice(0, MAX_VALUE_LENGTH)}...`;
}

function normalizePayload(payload = {}) {
  const out = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (SENSITIVE_PAYMENT_LOG_KEY_RE.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (value == null) {
      out[key] = value;
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = typeof value === "string" ? clip(value) : value;
      continue;
    }
    if (value instanceof Error) {
      out[key] = safeError(value);
      continue;
    }
    const redacted = redactObject(value);
    try {
      out[key] = clip(JSON.stringify(redacted));
    } catch {
      out[key] = clip(String(redacted));
    }
  }
  return out;
}

/**
 * SOL-PAY-08 — AUDIT PEAB COMMIT'IMA KOOS OTSUSEGA.
 *
 * MIS OLI VALESTI. `logPaymentAudit()` kirjutas `ChatLog` rea GLOBAALSE Prisma
 * kliendiga ja neelas DB-vea; webhook kutsus teda lukustatud tehingu sees ilma
 * `await`-ita. Kolm tagajärge, kõik vaiksed: audit võis joosta enne põhitehingu
 * commit'i · kirjeldada muudatust, mis rollback'is kadus · või kaduda ise pärast
 * edukat makse- ja õigusemuutust. `ChatLog` on best-effort telemeetria, mitte
 * finantsledger.
 *
 * MIS SIIN ON. Kaks kihti ja nende vahe on nüüd nimes:
 *
 *   · **`writePaymentAudit(tx, …)`** — PÜSIV jälg `DataAuditLog`-is, kirjutatud
 *     SAMA tehinguga, mis kannab otsust. Ta on `await`-itud ja tema viga pöörab
 *     tehingu tagasi: otsus ja tema jälg jõustuvad koos või mitte kumbki.
 *   · **`logPaymentEvent`/`logPaymentAudit`** — telemeetria (konsool + `ChatLog`),
 *     millest elavad admini loendurid. Ta jääb best-effort'iks ja tehingust
 *     VÄLJA — nii nagu telemeetria peabki.
 *
 * `logPaymentAudit()` üksi ei ole enam auditijälg. Kui otsus toimub tehingus,
 * kutsutakse `writePaymentAudit(tx, …)`, mis teeb mõlemad.
 */
export async function writePaymentAudit(tx, entry = {}) {
  if (!tx?.dataAuditLog?.create) {
    throw new Error("writePaymentAudit vajab tehingut (tx), mitte globaalset klienti");
  }

  const action = String(entry.action || "").slice(0, 80);
  const meta = {
    result: String(entry.result || "").slice(0, 120),
    ...(entry.subscriptionId ? { subscriptionId: String(entry.subscriptionId) } : {}),
    ...(entry.inviteId ? { inviteId: String(entry.inviteId) } : {}),
    ...(entry.billingMethodId ? { billingMethodId: String(entry.billingMethodId) } : {}),
    ...(entry.roomId ? { roomId: String(entry.roomId) } : {}),
    ...(entry.reason ? { reason: String(entry.reason).slice(0, 120) } : {})
  };

  await tx.dataAuditLog.create({
    data: {
      actorUserId: entry.actorUserId ? String(entry.actorUserId) : null,
      targetUserId: entry.userId ? String(entry.userId) : null,
      action: `payment.${action}`,
      resourceType: entry.paymentId ? "Payment" : entry.subscriptionId ? "Subscription" : "Payment",
      resourceId: entry.paymentId ? String(entry.paymentId) : entry.subscriptionId ? String(entry.subscriptionId) : null,
      meta
    }
  });

  // Telemeetria jääb best-effort'iks ja tehingust välja (admini loendurid).
  logPaymentAudit(entry);
}

/**
 * Minimeeritud makse-TELEMEETRIA. Sisaldab ainult tegevust, tulemust ja seotud
 * ID-sid — mitte kunagi provideri payload'i, tokenit ega maksevahendi sisu.
 *
 * NB: see EI OLE püsiv auditijälg (vt `writePaymentAudit`).
 */
export function logPaymentAudit({
  action,
  result,
  paymentId,
  subscriptionId,
  inviteId,
  billingMethodId,
  roomId,
  userId,
  reason
} = {}) {
  return logPaymentEvent("payment_audit", {
    action: String(action || "").slice(0, 80),
    result: String(result || "").slice(0, 80),
    ...(paymentId ? { paymentId: String(paymentId) } : {}),
    ...(subscriptionId ? { subscriptionId: String(subscriptionId) } : {}),
    ...(inviteId ? { inviteId: String(inviteId) } : {}),
    ...(billingMethodId ? { billingMethodId: String(billingMethodId) } : {}),
    ...(roomId ? { roomId: String(roomId) } : {}),
    ...(userId ? { userId: String(userId) } : {}),
    ...(reason ? { reason: String(reason).slice(0, 120) } : {})
  });
}

export async function logPaymentEvent(event, payload = {}) {
  if (!PAYMENT_LOG_ENABLED) return;
  const eventName = String(event || "").trim();
  if (!eventName) return;

  const normalizedPayload = normalizePayload(payload);
  const line = {
    ts: new Date().toISOString(),
    event: eventName,
    ...normalizedPayload
  };

  try {
    console.log(`[payments] ${JSON.stringify(line)}`);
  } catch {
    try {
      console.log("[payments] event", eventName);
    } catch {}
  }

  if (!PAYMENT_DB_LOG_ENABLED) return;

  try {
    await prisma.chatLog.create({
      data: {
        event: eventName,
        role: "payment",
        userId: normalizedPayload?.userId || null,
        data: normalizedPayload
      }
    });
  } catch (err) {
    try {
      console.error("[payments][db-log] failed", {
        event: eventName,
        error: safeError(err)
      });
    } catch {}
  }
}
