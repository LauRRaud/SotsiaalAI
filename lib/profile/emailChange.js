import { generateOpaqueToken, hashOpaqueToken, normalizeEmail } from "@/lib/auth/pin-login";
import { getRequestIpFromRequest } from "@/lib/request-ip";

export const EMAIL_CHANGE_TTL_MS =
  Number(process.env.EMAIL_CHANGE_HOURS || 24) * 60 * 60 * 1000;

function requestUserAgent(request) {
  const ua = request?.headers?.get?.("user-agent");
  return ua ? String(ua).slice(0, 300) : null;
}

/**
 * Creates (or replaces) the single pending email change for a user. Only the
 * sha256 token hash is persisted; the raw opaque token is returned so the caller
 * can email a confirmation link to the NEW address. The login identity
 * (User.email) is untouched here — the swap happens only on confirmation.
 */
export async function createPendingEmailChange({
  db,
  userId,
  newEmail,
  request,
  generateToken = () => generateOpaqueToken(32),
  hashToken = hashOpaqueToken,
  now = () => new Date(),
  ttlMs = EMAIL_CHANGE_TTL_MS
}) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(now().getTime() + ttlMs);
  const requestedIp = request ? getRequestIpFromRequest(request) : null;
  const requestedUa = requestUserAgent(request);

  await db.pendingEmailChange.upsert({
    where: { userId },
    create: { userId, newEmail, tokenHash, expiresAt, requestedIp, requestedUa },
    update: { newEmail, tokenHash, expiresAt, requestedIp, requestedUa }
  });

  return { token, tokenHash, expiresAt, newEmail };
}

export async function cancelPendingEmailChange({ db, userId }) {
  await db.pendingEmailChange.deleteMany({ where: { userId } });
}

/**
 * Confirms a pending email change from the token in the emailed link. Fail-closed:
 * an invalid, expired, foreign or competing token changes nothing and never reveals
 * whether an account exists. On success it atomically swaps the login identity to the
 * new (now verified) address, consumes the pending row and revokes every prior
 * session surface — because the login identity changed.
 *
 * Returns { ok:true, userId, oldEmail, newEmail } or { ok:false, reason }.
 */
export async function confirmEmailChangeByToken({
  db,
  token,
  hashToken = hashOpaqueToken,
  now = () => new Date()
}) {
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "invalid" };
  }

  const tokenHash = hashToken(token.trim());
  const pending = await db.pendingEmailChange.findUnique({ where: { tokenHash } });
  if (!pending) {
    return { ok: false, reason: "invalid" };
  }

  if (pending.expiresAt < now()) {
    await db.pendingEmailChange.deleteMany({ where: { id: pending.id } });
    return { ok: false, reason: "expired" };
  }

  const user = await db.user.findUnique({
    where: { id: pending.userId },
    select: { id: true, email: true }
  });
  if (!user) {
    await db.pendingEmailChange.deleteMany({ where: { id: pending.id } });
    return { ok: false, reason: "invalid" };
  }

  // Race: the target address may have been claimed by another account since the
  // request. Re-check uniqueness inside confirmation and refuse rather than clash.
  const clash = await db.user.findUnique({ where: { email: pending.newEmail } });
  if (clash && clash.id !== user.id) {
    await db.pendingEmailChange.deleteMany({ where: { id: pending.id } });
    return { ok: false, reason: "conflict" };
  }

  const oldEmail = user.email;

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: pending.newEmail,
        emailVerified: now(),
        emailVerificationSentAt: null,
        sessionVersion: { increment: 1 }
      }
    });
    await tx.pendingEmailChange.delete({ where: { id: pending.id } });
    await tx.trustedDevice.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.loginTempToken.deleteMany({ where: { userId: user.id } });
    await tx.emailOtpCode.deleteMany({ where: { userId: user.id } });
  });

  return { ok: true, userId: user.id, oldEmail, newEmail: pending.newEmail };
}

export { normalizeEmail };
