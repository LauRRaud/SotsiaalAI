import { errorJson } from "@/lib/documents/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";

const PUBLIC_MESSAGES = new Set([
  "api.common.unauthorized",
  "api.common.forbidden",
  "api.common.not_found",
  "api.common.invalid_request",
  "journeys.errors.not_found",
  "privacy.confirmation_required",
  "pre_inquiries.errors.situation_required",
  "pre_inquiries.errors.correction_required",
  "pre_inquiries.errors.topic_too_long",
  "pre_inquiries.errors.situation_too_long",
  "pre_inquiries.errors.generated_draft_too_long",
  "pre_inquiries.errors.user_edited_draft_too_long",
  "pre_inquiries.errors.assistant_message_too_long",
  "pre_inquiries.errors.assessment_too_large",
  "pre_inquiries.errors.assessment_municipality_too_long",
  "pre_inquiries.errors.active_limit_reached",
  "pre_inquiries.errors.invalid_action_key",
  "pre_inquiries.errors.action_key_conflict",
  "pre_inquiries.errors.invalid_cursor",
  "pre_inquiries.errors.invalid_status_transition",
  "pre_inquiries.errors.internal_recipient_required",
  "pre_inquiries.errors.invalid_service_selection",
  "pre_inquiries.errors.service_selection_required",
  "pre_inquiries.errors.recipient_channel_changed",
  "pre_inquiries.errors.recipient_locked_by_room",
  "pre_inquiries.errors.sent_cannot_be_edited",
  "pre_inquiries.errors.archived_cannot_be_edited",
  "pre_inquiries.errors.opened_cannot_be_edited",
  "pre_inquiries.errors.edit_conflict",
  "pre_inquiries.errors.next_contact_invalid",
  "pre_inquiries.errors.not_sent",
  "pre_inquiries.errors.open_conflict",
  "pre_inquiries.errors.recalled_cannot_be_corrected",
  "pre_inquiries.errors.external_cannot_be_corrected",
  "pre_inquiries.errors.correction_requires_open",
  "pre_inquiries.errors.correction_conflict",
  "pre_inquiries.errors.external_cannot_be_recalled",
  "pre_inquiries.errors.already_opened",
  "pre_inquiries.errors.not_recallable",
  "pre_inquiries.errors.recall_conflict",
  "pre_inquiries.errors.download_conflict",
  "pre_inquiries.errors.reopen_requires_archived",
  "pre_inquiries.errors.reopen_conflict",
  "pre_inquiries.errors.internal_cannot_email",
  "pre_inquiries.errors.recipient_email_required",
  "pre_inquiries.errors.external_confirmation_conflict",
  "pre_inquiries.errors.room_requires_platform_recipient",
  "pre_inquiries.errors.room_requires_acceptance"
]);

export const PRE_INQUIRY_LIMITS = Object.freeze({
  create: Object.freeze({ limit: 20, windowMs: 10 * 60_000 }),
  assist: Object.freeze({ limit: 30, windowMs: 60_000 }),
  correction: Object.freeze({ limit: 12, windowMs: 10 * 60_000 }),
  send: Object.freeze({ limit: 12, windowMs: 10 * 60_000 }),
  mutate: Object.freeze({ limit: 60, windowMs: 10 * 60_000 })
});

export function publicPreInquiryError(error, fallback = "pre_inquiries.errors.save_failed") {
  const requestedStatus = Number(error?.status);
  const requestedMessage = String(error?.message || "");
  const allowedStatus = [400, 401, 403, 404, 409, 413, 429].includes(requestedStatus);
  if (!allowedStatus || !PUBLIC_MESSAGES.has(requestedMessage)) {
    return { status: 500, messageKey: fallback, payload: {} };
  }
  return {
    status: requestedStatus,
    messageKey: requestedMessage,
    payload: error?.privacyPayload && typeof error.privacyPayload === "object" ? error.privacyPayload : {}
  };
}

export function preInquiryErrorJson(error, locale, fallback) {
  const publicError = publicPreInquiryError(error, fallback);
  return errorJson(publicError.messageKey, publicError.status, locale, publicError.payload);
}

export function preInquiryRateLimitDecision({ action = "mutate", userId, ip, consume = consumeRateLimit }) {
  const config = PRE_INQUIRY_LIMITS[action] || PRE_INQUIRY_LIMITS.mutate;
  const normalizedUser = String(userId || "anonymous").trim() || "anonymous";
  const normalizedIp = String(ip || "unknown").trim() || "unknown";
  const userResult = consume(`pre-inquiry:${action}:user:${normalizedUser}`, config.limit, config.windowMs);
  const ipResult = consume(`pre-inquiry:${action}:ip:${normalizedIp}`, config.limit * 3, config.windowMs);
  const allowed = userResult.allowed && ipResult.allowed;
  const retryAfterSec = allowed ? 0 : Math.max(userResult.retryAfterSec || 0, ipResult.retryAfterSec || 0, 1);
  const remaining = Math.max(0, Math.min(userResult.remaining ?? 0, ipResult.remaining ?? 0));
  return {
    allowed,
    retryAfterSec,
    remaining,
    headers: {
      "Retry-After": String(retryAfterSec),
      "X-RateLimit-Limit": String(config.limit),
      "X-RateLimit-Remaining": String(remaining)
    }
  };
}

export function enforcePreInquiryRateLimit(request, { action, userId } = {}) {
  const decision = preInquiryRateLimitDecision({
    action,
    userId,
    ip: getRequestIpFromRequest(request)
  });
  if (decision.allowed) return null;
  const response = errorJson("api.errors.rate_limited", 429);
  for (const [name, value] of Object.entries(decision.headers)) response.headers.set(name, value);
  return response;
}
