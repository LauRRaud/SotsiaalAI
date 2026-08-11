import { generateOpaqueToken, hashOpaqueToken, normalizeEmail } from "@/lib/auth/pin-login";
import { getRequestIpFromRequest } from "@/lib/request-ip";

export const EMAIL_CHANGE_TTL_MS =
  Number(process.env.EMAIL_CHANGE_HOURS || 24) * 60 * 60 * 1000;

function requestUserAgent(request) {
  const ua = request?.headers?.get?.("user-agent");
  return ua ? String(ua).slice(0, 300) : null;
}

/**
 * Mints a confirmation secret without touching the database.
 *
 * Preparing and persisting are separate steps on purpose (SOL-AUTH-06): a resend
 * must be able to put the letter in the post BEFORE it invalidates the link the
 * user may already be holding. Only the caller knows whether delivery succeeded.
 */
export function prepareEmailChangeToken({
  generateToken = () => generateOpaqueToken(32),
  hashToken = hashOpaqueToken,
  now = () => new Date(),
  ttlMs = EMAIL_CHANGE_TTL_MS
} = {}) {
  const token = generateToken();
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(now().getTime() + ttlMs)
  };
}

/**
 * Writes (or replaces) the single pending email change for a user. Only the
 * sha256 token hash is persisted. The login identity (User.email) is untouched
 * here — the swap happens only on confirmation.
 *
 * This is the point of no return for any previously emailed link: the row is
 * unique per user, so writing a new hash silently retires the old one.
 */
export async function persistPendingEmailChange({
  db,
  userId,
  newEmail,
  tokenHash,
  expiresAt,
  request
}) {
  const requestedIp = request ? getRequestIpFromRequest(request) : null;
  const requestedUa = requestUserAgent(request);

  await db.pendingEmailChange.upsert({
    where: { userId },
    create: { userId, newEmail, tokenHash, expiresAt, requestedIp, requestedUa },
    update: { newEmail, tokenHash, expiresAt, requestedIp, requestedUa }
  });

  return { tokenHash, expiresAt, newEmail };
}

/**
 * Prepare + persist in one call, for the first request in a flow, where there is
 * no previously issued link to protect.
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
  const prepared = prepareEmailChangeToken({ generateToken, hashToken, now, ttlMs });
  await persistPendingEmailChange({
    db,
    userId,
    newEmail,
    tokenHash: prepared.tokenHash,
    expiresAt: prepared.expiresAt,
    request
  });

  return { ...prepared, newEmail };
}

export async function cancelPendingEmailChange({ db, userId }) {
  await db.pendingEmailChange.deleteMany({ where: { userId } });
}

/**
 * Takes the row lock the confirmation decides on. It must come BEFORE the read:
 * a check on an unlocked row measures a moment that is already over by the time
 * it decides. Injectable so unit tests can run against a plain fake client.
 */
async function defaultLockPendingRow(tx, tokenHash) {
  await tx.$queryRaw`SELECT 1 FROM "PendingEmailChange" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
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
  now = () => new Date(),
  lockPendingRow = defaultLockPendingRow
}) {
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "invalid" };
  }

  const tokenHash = hashToken(token.trim());

  // Everything — lock, read, every check and the consumption — happens in one
  // transaction. The checks used to run on an unlocked snapshot and the write
  // carried only the row id, so a resend could replace the token on that same
  // row while this request was in flight and the stale request would still win,
  // swapping to the older address and destroying the fresh token (SOL-AUTH-05).
  return db.$transaction(async (tx) => {
    await lockPendingRow(tx, tokenHash);

    const pending = await tx.pendingEmailChange.findUnique({ where: { tokenHash } });
    if (!pending) {
      return { ok: false, reason: "invalid" };
    }

    // Every consumption below is conditional on the exact hash we read. `id`
    // alone is not identity here: the row is unique per user and a resend
    // rewrites it in place.
    const consume = () =>
      tx.pendingEmailChange.deleteMany({ where: { id: pending.id, tokenHash } });

    if (pending.expiresAt < now()) {
      await consume();
      return { ok: false, reason: "expired" };
    }

    const user = await tx.user.findUnique({
      where: { id: pending.userId },
      select: { id: true, email: true }
    });
    if (!user) {
      await consume();
      return { ok: false, reason: "invalid" };
    }

    // Race: the target address may have been claimed by another account since the
    // request. Re-check uniqueness inside confirmation and refuse rather than clash.
    const clash = await tx.user.findUnique({ where: { email: pending.newEmail } });
    if (clash && clash.id !== user.id) {
      await consume();
      return { ok: false, reason: "conflict" };
    }

    const consumed = await consume();
    if (Number(consumed?.count || 0) !== 1) {
      return { ok: false, reason: "invalid" };
    }

    const oldEmail = user.email;
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: pending.newEmail,
        emailVerified: now(),
        emailVerificationSentAt: null,
        sessionVersion: { increment: 1 }
      }
    });
    await tx.trustedDevice.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.loginTempToken.deleteMany({ where: { userId: user.id } });
    await tx.emailOtpCode.deleteMany({ where: { userId: user.id } });

    return { ok: true, userId: user.id, oldEmail, newEmail: pending.newEmail };
  });
}

export { normalizeEmail };
