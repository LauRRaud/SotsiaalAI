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
