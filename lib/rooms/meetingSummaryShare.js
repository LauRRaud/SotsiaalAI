import { prisma } from "@/lib/prisma";

// U10: connect a specialist-confirmed MEETING_SUMMARY artifact to a shared room.
// The only thing shared is the CONFIRMED (FINAL) summary the specialist owns.
// This resolver enforces that boundary; the room-message route then posts the
// content through its existing membership / privacy / rate-limit / broadcast
// pipeline, so no new permission model is introduced.

function shareError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const MEETING_SUMMARY_SHARE_ROLES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER", "ADMIN"]);

export function canShareMeetingSummaryRole(role) {
  return MEETING_SUMMARY_SHARE_ROLES.has(String(role || "").trim().toUpperCase());
}

/**
 * Resolves the shareable content of a confirmed meeting-summary artifact.
 *
 * @throws 404 when the artifact is missing or not owned by the requester
 *   (foreign artifacts are indistinguishable from missing ones — no leak);
 * @throws 400 when the artifact is not a MEETING_SUMMARY or has no content;
 * @throws 409 when the summary has not been confirmed (status !== FINAL) —
 *   only specialist-confirmed summaries may reach the room.
 */
export async function resolveShareableMeetingSummary(userId, artifactId, { db = prisma, role } = {}) {
  const ownerId = String(userId || "").trim();
  const id = String(artifactId || "").trim();
  if (!ownerId || !id) {
    throw shareError("api.common.not_found", 404);
  }
  if (!canShareMeetingSummaryRole(role)) {
    throw shareError("api.common.forbidden", 403);
  }

  const artifact = await db.agentArtifact.findFirst({
    where: { id, ownerId },
    select: { id: true, type: true, status: true, content: true, title: true }
  });

  if (!artifact) {
    throw shareError("api.common.not_found", 404);
  }
  if (artifact.type !== "MEETING_SUMMARY") {
    throw shareError("api.rooms.summary_wrong_type", 400);
  }
  if (artifact.status !== "FINAL") {
    throw shareError("api.rooms.summary_not_confirmed", 409);
  }

  const content = String(artifact.content || "").trim();
  if (!content) {
    throw shareError("api.rooms.summary_empty", 400);
  }

  return { id: artifact.id, title: artifact.title || null, content };
}

/** Tagasiühilduv kuju: ainult sisu (marsruut vajab lisaks ka id/pealkirja). */
export async function resolveConfirmedMeetingSummaryContent(userId, artifactId, options = {}) {
  const summary = await resolveShareableMeetingSummary(userId, artifactId, options);
  return summary.content;
}
