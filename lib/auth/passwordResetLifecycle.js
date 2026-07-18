import { hash } from "bcrypt";

export const RESET_IDENTIFIER_PREFIX = "password-reset:";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

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

async function deleteToken(db, verificationToken) {
  await db.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: verificationToken.identifier,
        token: verificationToken.token
      }
    }
  });
}

/**
 * Consumes a validated password-reset token and applies the new PIN.
 *
 * The reset is atomic and fail-closed: in a single transaction it sets the new
 * passwordHash, bumps sessionVersion (revoking every issued JWT) and clears the
 * full prior session surface — Session, TrustedDevice, LoginTempToken and
 * EmailOtpCode — then consumes the one-time token. A reset therefore always
 * ends every other logged-in device, exactly like `logout-all`.
 *
 * db is any Prisma-shaped client (real or injected fake), so the flow is unit
 * testable without a database. hashPin/now are injectable for the same reason.
 */
export async function resetPasswordWithToken({
  db,
  token,
  pin,
  identifierPrefix = RESET_IDENTIFIER_PREFIX,
  hashPin = (value) => hash(value, 12),
  now = () => new Date()
}) {
  const verificationToken = await db.verificationToken.findFirst({
    where: {
      token,
      identifier: {
        startsWith: identifierPrefix
      }
    }
  });

  if (!verificationToken) {
    return failure("api.auth.reset.token_invalid", 400);
  }

  if (verificationToken.expires < now()) {
    await deleteToken(db, verificationToken);
    return failure("api.auth.reset.token_expired", 410);
  }

  const email = normalizeEmail(
    String(verificationToken.identifier || "").replace(identifierPrefix, "")
  );
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    await deleteToken(db, verificationToken);
    return failure("api.auth.reset.user_not_found", 404);
  }

  const passwordHash = await hashPin(pin);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 }
      }
    });
    await tx.trustedDevice.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.loginTempToken.deleteMany({ where: { userId: user.id } });
    await tx.emailOtpCode.deleteMany({ where: { userId: user.id } });
    await tx.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: verificationToken.identifier,
          token: verificationToken.token
        }
      }
    });
  });

  return { ok: true, userId: user.id, email };
}
