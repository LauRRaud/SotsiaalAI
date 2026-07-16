import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const PREVIEW_TTL_MS = 5 * 60 * 1000;
const MAX_REASON_LENGTH = 500;
const MAX_BULK_USER_IDS = 500;

export class DangerousActionError extends Error {
  constructor(messageKey, status = 400, code = "DANGEROUS_ACTION_REJECTED") {
    super(code);
    this.name = "DangerousActionError";
    this.messageKey = messageKey;
    this.status = status;
    this.code = code;
  }
}

function reject(messageKey, code, status = 400) {
  throw new DangerousActionError(messageKey, status, code);
}

function normalizeReason(value) {
  const reason = String(value || "").trim();
  if (reason.length < 3 || reason.length > MAX_REASON_LENGTH) {
    reject("api.admin.analytics.dangerous_reason_required", "DANGEROUS_REASON_REQUIRED");
  }
  return reason;
}

function requireExecutionFields({ reason, confirmation, previewToken }) {
  const normalizedReason = normalizeReason(reason);
  if (!String(confirmation || "").trim()) {
    reject("api.admin.analytics.dangerous_confirmation_required", "DANGEROUS_CONFIRMATION_REQUIRED");
  }
  if (!String(previewToken || "").trim()) {
    reject("api.admin.analytics.dangerous_preview_required", "DANGEROUS_PREVIEW_REQUIRED");
  }
  return normalizedReason;
}

function resolvePreviewSecret(env = process.env) {
  const secret = String(
    env.ADMIN_DANGEROUS_ACTION_PREVIEW_SECRET ||
      env.NEXTAUTH_SECRET ||
      env.AUTH_SECRET ||
      ""
  ).trim();
  if (secret) return secret;
  if (String(env.NODE_ENV || "").toLowerCase() !== "production") {
    return "sotsiaalai-local-dangerous-action-preview";
  }
  reject("api.admin.analytics.dangerous_gate_unavailable", "DANGEROUS_GATE_UNAVAILABLE", 503);
}

function stableFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sign(encodedPayload, secret) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createPreview({ kind, fingerprint, impact, confirmation, now = new Date(), env = process.env }) {
  const expiresAt = new Date(now.getTime() + PREVIEW_TTL_MS);
  const payload = {
    v: 1,
    kind,
    fingerprint: stableFingerprint(fingerprint),
    impact: Number(impact || 0),
    confirmation,
    expiresAt: expiresAt.toISOString()
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload, resolvePreviewSecret(env));
  return {
    confirmation,
    previewToken: `${encodedPayload}.${signature}`,
    previewExpiresAt: expiresAt.toISOString()
  };
}

function assertPreview({
  kind,
  fingerprint,
  impact,
  expectedConfirmation,
  confirmation,
  previewToken,
  now = new Date(),
  env = process.env
}) {
  if (String(confirmation || "").trim() !== expectedConfirmation) {
    reject("api.admin.analytics.dangerous_confirmation_invalid", "DANGEROUS_CONFIRMATION_INVALID");
  }

  const [encodedPayload, signature, extra] = String(previewToken || "").split(".");
  if (!encodedPayload || !signature || extra) {
    reject("api.admin.analytics.dangerous_preview_invalid", "DANGEROUS_PREVIEW_INVALID");
  }

  const expectedSignature = sign(encodedPayload, resolvePreviewSecret(env));
  if (!safeEqual(signature, expectedSignature)) {
    reject("api.admin.analytics.dangerous_preview_invalid", "DANGEROUS_PREVIEW_INVALID");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    reject("api.admin.analytics.dangerous_preview_invalid", "DANGEROUS_PREVIEW_INVALID");
  }

  if (
    payload?.v !== 1 ||
    payload?.kind !== kind ||
    payload?.fingerprint !== stableFingerprint(fingerprint) ||
    Number(payload?.impact) !== Number(impact || 0) ||
    payload?.confirmation !== expectedConfirmation
  ) {
    reject("api.admin.analytics.dangerous_preview_stale", "DANGEROUS_PREVIEW_STALE");
  }

  const expiresAt = new Date(payload.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    reject("api.admin.analytics.dangerous_preview_stale", "DANGEROUS_PREVIEW_STALE");
  }
}

function requestAuditFields(request) {
  return {
    ipAddress: request?.headers?.get?.("x-forwarded-for") || request?.headers?.get?.("x-real-ip") || null,
    userAgent: request?.headers?.get?.("user-agent") || null
  };
}

function sumCounts(items) {
  return Object.values(items || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

const RESET_DEFINITIONS = Object.freeze({
  clear_logs: {
    count: async db => ({ ChatLog: await db.chatLog.count() }),
    execute: async db => ({ ChatLog: Number((await db.chatLog.deleteMany({})).count || 0) })
  },
  clear_conversations: {
    count: async db => ({
      ConversationMessage: await db.conversationMessage.count(),
      ConversationRun: await db.conversationRun.count(),
      Conversation: await db.conversation.count()
    }),
    execute: async db => ({
      ConversationMessage: Number((await db.conversationMessage.deleteMany({})).count || 0),
      ConversationRun: Number((await db.conversationRun.deleteMany({})).count || 0),
      Conversation: Number((await db.conversation.deleteMany({})).count || 0)
    })
  },
  clear_rooms: {
    count: async db => ({
      RoomMessage: await db.roomMessage.count(),
      Invite: await db.invite.count(),
      RoomMember: await db.roomMember.count(),
      Room: await db.room.count()
    }),
    execute: async db => ({
      RoomMessage: Number((await db.roomMessage.deleteMany({})).count || 0),
      Invite: Number((await db.invite.deleteMany({})).count || 0),
      RoomMember: Number((await db.roomMember.deleteMany({})).count || 0),
      Room: Number((await db.room.deleteMany({})).count || 0)
    })
  },
  clear_auth_tokens: {
    count: async db => ({
      VerificationToken: await db.verificationToken.count(),
      LoginTempToken: await db.loginTempToken.count(),
      EmailOtpCode: await db.emailOtpCode.count(),
      TrustedDevice: await db.trustedDevice.count()
    }),
    execute: async db => ({
      VerificationToken: Number((await db.verificationToken.deleteMany({})).count || 0),
      LoginTempToken: Number((await db.loginTempToken.deleteMany({})).count || 0),
      EmailOtpCode: Number((await db.emailOtpCode.deleteMany({})).count || 0),
      TrustedDevice: Number((await db.trustedDevice.deleteMany({})).count || 0)
    })
  },
  clear_usage_metrics: {
    count: async db => ({
      UsageEvent: await db.usageEvent.count(),
      UsageReservation: await db.usageReservation.count(),
      UsageBucket: await db.usageBucket.count()
    }),
    execute: async db => ({
      UsageEvent: Number((await db.usageEvent.deleteMany({})).count || 0),
      UsageReservation: Number((await db.usageReservation.deleteMany({})).count || 0),
      UsageBucket: Number((await db.usageBucket.deleteMany({})).count || 0)
    })
  },
  clear_billing: {
    count: async db => ({
      Payment: await db.payment.count(),
      Subscription: await db.subscription.count()
    }),
    execute: async db => ({
      Payment: Number((await db.payment.deleteMany({})).count || 0),
      Subscription: Number((await db.subscription.deleteMany({})).count || 0)
    })
  }
});

function resetDefinition(action) {
  const normalizedAction = String(action || "").trim().toLowerCase();
  const definition = RESET_DEFINITIONS[normalizedAction];
  if (!definition) {
    reject("api.admin.analytics.reset_invalid_action", "RESET_INVALID_ACTION");
  }
  return { action: normalizedAction, definition };
}

function resetConfirmation(action, total) {
  return `RESET ${action.toUpperCase()} ${Number(total || 0)}`;
}

export function isProductionResetEnabled(env = process.env) {
  if (String(env.NODE_ENV || "").trim().toLowerCase() !== "production") return true;
  return ["1", "true", "yes"].includes(
    String(env.ADMIN_ANALYTICS_RESET_ENABLED_IN_PRODUCTION || "").trim().toLowerCase()
  );
}

export async function previewResetAction({ db, body, now = new Date(), env = process.env }) {
  const { action, definition } = resetDefinition(body?.action);
  const reason = normalizeReason(body?.reason);
  const counts = await definition.count(db);
  const total = sumCounts(counts);
  return {
    action,
    counts,
    total,
    executionAllowed: isProductionResetEnabled(env),
    ...createPreview({
      kind: "analytics_reset",
      fingerprint: { action, reason },
      impact: total,
      confirmation: resetConfirmation(action, total),
      now,
      env
    })
  };
}

export async function executeResetAction({
  db,
  body,
  actorUserId,
  request,
  now = new Date(),
  env = process.env
}) {
  const { action, definition } = resetDefinition(body?.action);
  const reason = requireExecutionFields(body || {});

  return db.$transaction(async tx => {
    const counts = await definition.count(tx);
    const total = sumCounts(counts);
    assertPreview({
      kind: "analytics_reset",
      fingerprint: { action, reason },
      impact: total,
      expectedConfirmation: resetConfirmation(action, total),
      confirmation: body?.confirmation,
      previewToken: body?.previewToken,
      now,
      env
    });

    if (!isProductionResetEnabled(env)) {
      reject("api.admin.analytics.reset_disabled_in_production", "RESET_DISABLED_IN_PRODUCTION", 403);
    }

    const deleted = await definition.execute(tx);
    const deletedTotal = sumCounts(deleted);
    await tx.dataAuditLog.create({
      data: {
        actorUserId,
        action: "ADMIN_ANALYTICS_RESET_COMPLETED",
        resourceType: "AdminAnalyticsReset",
        resourceId: action,
        ...requestAuditFields(request),
        meta: {
          reason,
          resetAction: action,
          previewedCount: total,
          deletedCount: deletedTotal,
          deleted,
          result: "success"
        }
      }
    });
    return { action, deleted, total: deletedTotal };
  });
}

function normalizeLogDeletion(body = {}) {
  const event = String(body.event || "").trim();
  const crisis = String(body.isCrisis || "all").trim().toLowerCase();
  const isCrisis = crisis === "true" || crisis === "false" ? crisis : "all";
  const deleteAll = body.all === true;
  if (!deleteAll && !event && isCrisis === "all") {
    reject("api.admin.analytics.events_delete_invalid_payload", "EVENTS_DELETE_INVALID_PAYLOAD");
  }
  const where = {};
  if (!deleteAll && event) where.event = event;
  if (!deleteAll && (isCrisis === "true" || isCrisis === "false")) {
    where.data = { path: ["isCrisis"], equals: isCrisis === "true" };
  }
  return {
    deleteAll,
    event: deleteAll ? "" : event,
    isCrisis: deleteAll ? "all" : isCrisis,
    where
  };
}

function logDeletionConfirmation(count) {
  return `DELETE LOGS ${Number(count || 0)}`;
}

export async function previewLogDeletion({ db, body, now = new Date(), env = process.env }) {
  const normalized = normalizeLogDeletion(body);
  const reason = normalizeReason(body?.reason);
  const count = await db.chatLog.count({ where: normalized.where });
  const fingerprint = {
    all: normalized.deleteAll,
    event: normalized.event,
    isCrisis: normalized.isCrisis,
    reason
  };
  return {
    target: normalized.deleteAll ? "all" : "filtered",
    filters: { event: normalized.event, isCrisis: normalized.isCrisis },
    count,
    ...createPreview({
      kind: "analytics_log_delete",
      fingerprint,
      impact: count,
      confirmation: logDeletionConfirmation(count),
      now,
      env
    })
  };
}

export async function executeLogDeletion({
  db,
  body,
  actorUserId,
  request,
  now = new Date(),
  env = process.env
}) {
  const normalized = normalizeLogDeletion(body);
  const reason = requireExecutionFields(body || {});
  const fingerprint = {
    all: normalized.deleteAll,
    event: normalized.event,
    isCrisis: normalized.isCrisis,
    reason
  };

  return db.$transaction(async tx => {
    const count = await tx.chatLog.count({ where: normalized.where });
    assertPreview({
      kind: "analytics_log_delete",
      fingerprint,
      impact: count,
      expectedConfirmation: logDeletionConfirmation(count),
      confirmation: body?.confirmation,
      previewToken: body?.previewToken,
      now,
      env
    });
    const deletedCount = Number((await tx.chatLog.deleteMany({ where: normalized.where })).count || 0);
    await tx.dataAuditLog.create({
      data: {
        actorUserId,
        action: "ADMIN_ANALYTICS_LOGS_DELETED",
        resourceType: "ChatLog",
        resourceId: normalized.deleteAll ? "all" : "filtered",
        ...requestAuditFields(request),
        meta: {
          reason,
          targetType: normalized.deleteAll ? "all" : "filtered",
          filters: { event: normalized.event || null, isCrisis: normalized.isCrisis },
          previewedCount: count,
          deletedCount,
          result: "success"
        }
      }
    });
    return { deletedCount };
  });
}

function normalizeIds(value) {
  const uniqueIds = new Set();
  for (const raw of Array.isArray(value) ? value : []) {
    const id = String(raw || "").trim();
    if (id) uniqueIds.add(id);
    if (uniqueIds.size >= MAX_BULK_USER_IDS) break;
  }
  return Array.from(uniqueIds).sort();
}

function normalizeBulkEmailInput(body = {}) {
  const target = String(body.target || "").trim().toLowerCase() === "all" ? "all" : "selected";
  const subject = String(body.subject || "").trim();
  const text = String(body.text || "").trim();
  const selectedIds = normalizeIds(body.userIds);
  if (!subject || !text) {
    reject("api.admin.analytics.users_email_invalid_payload", "USERS_EMAIL_INVALID_PAYLOAD");
  }
  if (subject.length > 180 || text.length > 8000) {
    reject("api.admin.analytics.users_email_too_large", "USERS_EMAIL_TOO_LARGE");
  }
  if (target === "selected" && !selectedIds.length) {
    reject("api.admin.analytics.users_email_no_recipients", "USERS_EMAIL_NO_RECIPIENTS");
  }
  return { target, subject, text, selectedIds };
}

async function resolveBulkRecipients(db, input) {
  const where = input.target === "all"
    ? { email: { not: null } }
    : { id: { in: input.selectedIds }, email: { not: null } };
  const rows = await db.user.findMany({
    where,
    orderBy: { id: "asc" },
    select: { id: true, email: true }
  });
  const emails = [];
  const seen = new Set();
  for (const row of rows) {
    const email = String(row?.email || "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
    if (emails.length >= MAX_BULK_USER_IDS) break;
  }
  if (!emails.length) {
    reject("api.admin.analytics.users_email_no_recipients", "USERS_EMAIL_NO_RECIPIENTS", 404);
  }
  return emails;
}

function bulkEmailFingerprint(input) {
  return {
    target: input.target,
    selectedIds: input.target === "selected" ? input.selectedIds : [],
    contentHash: createHash("sha256").update(`${input.subject}\n${input.text}`).digest("hex")
  };
}

function bulkEmailConfirmation(count) {
  return `SEND BULK EMAIL ${Number(count || 0)}`;
}

export async function previewBulkEmail({ db, body, now = new Date(), env = process.env }) {
  const input = normalizeBulkEmailInput(body);
  const reason = normalizeReason(body?.reason);
  const recipientEmails = await resolveBulkRecipients(db, input);
  const recipientCount = recipientEmails.length;
  return {
    target: input.target,
    recipientCount,
    ...createPreview({
      kind: "analytics_bulk_email",
      fingerprint: { ...bulkEmailFingerprint(input), reason },
      impact: recipientCount,
      confirmation: bulkEmailConfirmation(recipientCount),
      now,
      env
    })
  };
}

export async function executeBulkEmail({
  db,
  mailer,
  from,
  body,
  actorUserId,
  now = new Date(),
  env = process.env
}) {
  const input = normalizeBulkEmailInput(body);
  const reason = requireExecutionFields(body || {});
  const recipientEmails = await resolveBulkRecipients(db, input);
  const recipientCount = recipientEmails.length;
  assertPreview({
    kind: "analytics_bulk_email",
    fingerprint: { ...bulkEmailFingerprint(input), reason },
    impact: recipientCount,
    expectedConfirmation: bulkEmailConfirmation(recipientCount),
    confirmation: body?.confirmation,
    previewToken: body?.previewToken,
    now,
    env
  });

  const sender = String(from || "").trim();
  if (!sender) {
    reject("api.admin.analytics.email_from_missing", "EMAIL_FROM_MISSING", 500);
  }

  const failed = [];
  for (const to of recipientEmails) {
    try {
      await mailer.sendMail({
        to,
        from: sender,
        subject: input.subject,
        text: input.text,
        html: textToHtml(input.text)
      });
    } catch (error) {
      failed.push({ email: to, error: String(error?.message || "send_failed") });
    }
  }

  const sentCount = recipientCount - failed.length;
  await db.dataAuditLog.create({
    data: {
      actorUserId,
      action: "ADMIN_ANALYTICS_BULK_EMAIL_SENT",
      resourceType: "User",
      resourceId: input.target,
      meta: {
        reason,
        targetType: input.target,
        recipientCount,
        result: {
          status: failed.length === 0 ? "success" : sentCount > 0 ? "partial" : "failed",
          sentCount,
          failedCount: failed.length
        }
      }
    }
  });

  return {
    target: input.target,
    requestedCount: recipientCount,
    sentCount,
    failedCount: failed.length,
    failed
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(value) {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map(line => escapeHtml(line.trimEnd()));
  return `<div>${lines.map(line => (line ? `<p>${line}</p>` : "<p>&nbsp;</p>")).join("")}</div>`;
}
