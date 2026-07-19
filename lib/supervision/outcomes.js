import { notFound, requireSupervisionUser, resolveDb } from "./shared.js";
import { serializePersonalOutcome } from "./serializersPrivate.js";

/**
 * M12 isiklikud püsiväljundid (Q2.4 read 27) — AINULT omanik (ka mitte
 * superviisor teiste omi; ADMIN ei loe). Eraldi privaat-serializer.
 */

export async function listOutcomes({ session }, options = {}) {
  const db = resolveDb(options);
  const { userId } = requireSupervisionUser(session);
  const outcomes = await db.supervisionPersonalOutcome.findMany({
    where: { ownerUserId: userId },
    orderBy: [{ createdAt: "desc" }]
  });
  return { ok: true, outcomes: outcomes.map(serializePersonalOutcome) };
}

export async function getOutcome({ outcomeId, session }, options = {}) {
  const db = resolveDb(options);
  const { userId } = requireSupervisionUser(session);
  const id = String(outcomeId || "").trim();
  if (!id) throw notFound();
  const outcome = await db.supervisionPersonalOutcome.findFirst({ where: { id, ownerUserId: userId } });
  if (!outcome) throw notFound();
  return { ok: true, outcome: serializePersonalOutcome(outcome) };
}
