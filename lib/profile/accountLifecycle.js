import { compare, hash } from "bcrypt";
import { isValidPin, normalizePin } from "@/lib/auth/pin-login";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";

export const PROFILE_CURRENT_PASSWORD_RATE_LIMIT = 10;
export const PROFILE_CURRENT_PASSWORD_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function failure(messageKey, status, extras = {}) {
  return {
    ok: false,
    error: {
      messageKey,
      status,
      extras
    }
  };
}

function reauthFailure(result) {
  if (result.reason === "rate_limited") {
    return failure("api.common.rate_limited", 429, { code: "RATE_LIMITED" });
  }

  if (result.reason === "required") {
    return failure("profile.errors.current_pin_required", 400, {
      code: "CURRENT_PASSWORD_REQUIRED"
    });
  }

  return failure("profile.errors.current_pin_invalid", 401, {
    code: "CURRENT_PASSWORD_INVALID"
  });
}

export async function verifyCurrentProfilePassword({
  operation,
  userId,
  request,
  passwordHash,
  currentPassword,
  comparePin = compare,
  consume = consumeRateLimit
}) {
  const ip = getRequestIpFromRequest(request);
  const bucket = consume(
    `profile-current-password:${operation}:${userId}:${ip}`,
    PROFILE_CURRENT_PASSWORD_RATE_LIMIT,
    PROFILE_CURRENT_PASSWORD_RATE_LIMIT_WINDOW_MS
  );

  if (!bucket.allowed) {
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterSec: bucket.retryAfterSec
    };
  }

  if (!currentPassword) {
    return { ok: false, reason: "required" };
  }

  const currentOk = await comparePin(normalizePin(currentPassword), passwordHash);
  return currentOk ? { ok: true } : { ok: false, reason: "invalid" };
}

export async function updateProfileForUser({
  db,
  userId,
  request,
  nextEmail,
  nextPassword,
  currentPassword,
  onEmailChanged,
  verifyCurrentPassword = verifyCurrentProfilePassword,
  reauthOptions,
  hashPin = (pin) => hash(pin, 12)
}) {
  if (!nextEmail && !nextPassword) {
    return failure("profile.errors.no_changes", 400);
  }

  const current = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      passwordHash: true
    }
  });

  if (!current) {
    return failure("profile.errors.user_not_found", 404);
  }

  const emailChanged = Boolean(nextEmail && nextEmail !== current.email);
  if (nextEmail && !nextEmail.includes("@")) {
    return failure("profile.email_update.error_email_invalid", 400);
  }

  let normalizedPin;
  if (nextPassword) {
    normalizedPin = nextPassword.replace(/\s+/g, "");
    if (!isValidPin(normalizedPin)) {
      return failure("profile.errors.pin_invalid", 400, { code: "PIN_INVALID" });
    }
  }

  const requiresReauth = emailChanged || Boolean(normalizedPin);
  if (requiresReauth && current.passwordHash) {
    const reauth = await verifyCurrentPassword({
      ...reauthOptions,
      operation: "put",
      userId,
      request,
      passwordHash: current.passwordHash,
      currentPassword
    });
    if (!reauth.ok) return reauthFailure(reauth);
  }

  const data = {};
  if (emailChanged) {
    const existing = await db.user.findUnique({ where: { email: nextEmail } });
    if (existing && existing.id !== userId) {
      return failure("profile.email_update.error_email_in_use", 409);
    }

    data.email = nextEmail;
    data.emailVerified = null;
    data.emailVerificationSentAt = null;
  }

  if (normalizedPin) {
    data.passwordHash = await hashPin(normalizedPin);
  }

  if (Object.keys(data).length === 0) {
    return {
      ok: true,
      user: {
        email: current.email,
        role: undefined
      },
      requiresReauth: false,
      emailChanged: false
    };
  }

  if (requiresReauth) {
    data.sessionVersion = { increment: 1 };
  }

  const updated = await db.user.update({
    where: { id: userId },
    data,
    select: {
      email: true,
      role: true
    }
  });

  if (emailChanged && onEmailChanged) {
    await onEmailChanged(updated.email);
  }

  return {
    ok: true,
    user: updated,
    requiresReauth,
    emailChanged
  };
}

export async function deleteProfileForUser({
  db,
  userId,
  request,
  currentPassword,
  deleteUser,
  onAccountDeleted,
  verifyCurrentPassword = verifyCurrentProfilePassword,
  reauthOptions
}) {
  const current = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      passwordHash: true
    }
  });

  if (!current) {
    return failure("profile.errors.user_not_found", 404);
  }

  if (current.passwordHash) {
    const reauth = await verifyCurrentPassword({
      ...reauthOptions,
      operation: "delete",
      userId,
      request,
      passwordHash: current.passwordHash,
      currentPassword
    });
    if (!reauth.ok) return reauthFailure(reauth);
  }

  const deletion = await deleteUser({
    actorUserId: userId,
    targetUserId: userId,
    reason: "profile_delete",
    ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent") || null
  });

  if (deletion.ok && current.email && onAccountDeleted) {
    await onAccountDeleted(current.email);
  }

  return {
    ok: true,
    deletion
  };
}
