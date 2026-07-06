import { prisma } from "@/lib/prisma";
import { redactObject, safeError } from "@/lib/privacy/safeError";
export async function logEvent(event, payload = {}) {
  if (!event) return;
  try {
    await prisma.chatLog.create({
      data: {
        event,
        role: payload.role || null,
        userId: payload.userId || null,
        data: redactObject(payload)
      }
    });
  } catch (err) {
    try {
      console.error("[chat][logEvent] failed", {
        event,
        error: safeError(err)
      });
    } catch {}
  }
}
