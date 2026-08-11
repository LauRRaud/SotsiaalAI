import { compare, hash } from "bcrypt";
import { isValidPin, normalizePin } from "@/lib/auth/pin-login";
import { createPendingEmailChange } from "@/lib/profile/emailChange";
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
  onEmailChangeRequested,
  onPinChanged,
  verifyCurrentPassword = verifyCurrentProfilePassword,
  reauthOptions,
  hashPin = (pin) => hash(pin, 12),
  createPendingChange = createPendingEmailChange,
  now = () => new Date()
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

  const sensitiveChange = emailChanged || Boolean(normalizedPin);

  // Passwordless step-up (E3): an account without a PIN cannot change its email
  // or PIN on the strength of a session alone; it must first create a PIN via the
  // existing recovery flow. The client cannot bypass this with a flag.
  if (sensitiveChange && !current.passwordHash) {
    return failure("profile.errors.pin_setup_required", 409, {
      code: "PIN_SETUP_REQUIRED"
    });
  }

  // Re-auth + rate limit (E1) before any sensitive change.
  if (sensitiveChange) {
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

  // Email change (E2): verify-then-swap. The login identity (current.email),
  // its verification status and sessions all stay untouched here. A pending
  // change is recorded and only the NEW address is emailed a confirmation link.
  let emailChangeRequested = false;
  if (emailChanged) {
    const existing = await db.user.findUnique({ where: { email: nextEmail } });
    if (existing && existing.id !== userId) {
      return failure("profile.email_update.error_email_in_use", 409);
    }
    const conflictingPending = await db.pendingEmailChange.findFirst({
      where: { newEmail: nextEmail, userId: { not: userId }, expiresAt: { gt: now() } }
    });
    if (conflictingPending) {
      return failure("profile.email_update.error_email_in_use", 409);
    }

    const pending = await createPendingChange({
      db,
      userId,
      newEmail: nextEmail,
      request,
      now
    });
    emailChangeRequested = true;
    if (onEmailChangeRequested) {
      await onEmailChangeRequested({
        userId,
        newEmail: nextEmail,
        token: pending.token,
        expiresAt: pending.expiresAt
      });
    }
  }

  // PIN change: immediate, and it ends the WHOLE prior credential surface in one
  // transaction — exactly what a password reset and an email change already do.
  //
  // Bumping sessionVersion alone was not enough (SOL-AUTH-07): a login started
  // with the OLD PIN leaves a LoginTempToken behind, and its consumption reads
  // the user's CURRENT sessionVersion. Someone who knew the old PIN could begin
  // signing in, finish the second factor after the rotation and receive a fresh,
  // fully valid session — the rotation looked like it revoked everything and did
  // not. Trusted devices go too: the PIN is the first factor, and a remembered
  // device is precisely the thing that lets a holder of it skip the second.
  let pinChanged = false;
  if (normalizedPin) {
    const passwordHash = await hashPin(normalizedPin);
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          sessionVersion: { increment: 1 }
        }
      });
      await tx.loginTempToken.deleteMany({ where: { userId } });
      await tx.emailOtpCode.deleteMany({ where: { userId } });
      await tx.trustedDevice.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
    });
    pinChanged = true;
    if (onPinChanged) {
      await onPinChanged({ email: current.email });
    }
  }

  return {
    ok: true,
    user: {
      email: current.email,
      role: undefined
    },
    requiresReauth: pinChanged,
    emailChangeRequested,
    pendingEmail: emailChangeRequested ? nextEmail : null
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
