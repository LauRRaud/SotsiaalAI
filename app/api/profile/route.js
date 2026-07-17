export const runtime = "nodejs";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { resolveSessionRoleState } from "@/lib/authz";
import {
  DEVICE_COOKIE_NAME,
  getActiveSessionMaxForUser,
  getTrustedDeviceMaxForUser,
  hashOpaqueToken
} from "@/lib/auth/pin-login";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { deleteUserWithPrivacyCleanup } from "@/lib/privacy/userDeletion";
import { safeError } from "@/lib/privacy/safeError";
import { deleteProfileForUser, updateProfileForUser } from "@/lib/profile/accountLifecycle";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};
const EMAIL_VERIFY_IDENTIFIER_PREFIX = "email-verify:";

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json(
    {
      ok: false,
      messageKey,
      message: translated,
      error: translated,
      ...extras
    },
    status
  );
}

function localeFromRequest(request, bodyLocale) {
  const direct = normalizeServerLocale(bodyLocale);
  if (direct) return direct;

  const raw = String(request?.headers?.get("accept-language") || "");
  const parts = raw
    .split(",")
    .map((part) => part.split(";")[0].trim())
    .filter(Boolean);

  for (const part of parts) {
    const normalized = normalizeServerLocale(part);
    if (normalized) return normalized;
  }

  return "en";
}

async function requireUser() {
  try {
    const session = await getServerSession(authConfig);
    const userId = session?.user?.id;
    if (!userId) return null;
    return {
      session,
      userId
    };
  } catch {
    return null;
  }
}

function buildVerifyUrl(email, token, locale) {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    throw new Error("api.auth.verify.base_url_missing");
  }

  const params = new URLSearchParams({ email, token });
  if (locale) params.set("locale", locale);

  return `${baseUrl.replace(/\/$/, "")}/api/verify-email?${params.toString()}`;
}

function buildEmailVerifyIdentifier(email) {
  return `${EMAIL_VERIFY_IDENTIFIER_PREFIX}${String(email || "").trim().toLowerCase()}`;
}

async function sendVerificationEmail(email, locale) {
  const token = crypto.randomBytes(32).toString("hex");
  const hours = Number(process.env.EMAIL_VERIFY_HOURS || 24);
  const expires = new Date(Date.now() + hours * 60 * 60 * 1000);
  const identifier = buildEmailVerifyIdentifier(email);

  await prisma.verificationToken.create({
    data: {
      identifier,
      token,
      expires
    }
  });

  const verifyUrl = buildVerifyUrl(email, token, locale);
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) {
    throw new Error("api.auth.verify.email_from_missing");
  }

  const mailer = getMailer("email-verify");
  await mailer.sendMail({
    to: email,
    from,
    subject: serverT(locale, "email.auth.verify.subject"),
    text: serverT(locale, "email.auth.verify.text", { verifyUrl }),
    html: serverT(locale, "email.auth.verify.html", { verifyUrl })
  });

  await prisma.verificationToken.deleteMany({
    where: {
      identifier,
      NOT: { token }
    }
  });

  try {
    await prisma.user.update({
      where: { email },
      data: { emailVerificationSentAt: new Date() }
    });
  } catch {
    // do not fail profile update if metadata update fails
  }
}

async function sendAccountDeletedEmail(email, locale) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) {
    throw new Error("api.auth.account_deleted.email_from_missing");
  }

  const mailer = getMailer("account-deleted");
  await mailer.sendMail({
    to: email,
    from,
    subject: serverT(locale, "email.auth.account_deleted.subject"),
    text: serverT(locale, "email.auth.account_deleted.text"),
    html: serverT(locale, "email.auth.account_deleted.html")
  });
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const ctx = await requireUser();
  if (!ctx) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        email: true,
        role: true,
        isAdmin: true,
        passwordHash: true,
        trustedDevices: {
          where: {
            expiresAt: {
              gt: new Date()
            }
          },
          select: {
            id: true,
            name: true,
            deviceTokenHash: true,
            ipRange: true,
            expiresAt: true,
            lastUsedAt: true,
            createdAt: true
          },
          orderBy: [
            {
              lastUsedAt: "desc"
            },
            {
              createdAt: "desc"
            }
          ]
        }
      }
    });

    if (!user) {
      return errorJson("profile.errors.user_not_found", 404, locale);
    }

    const roleState = resolveSessionRoleState(ctx.session, request.cookies);
    const currentDeviceToken = request.cookies.get(DEVICE_COOKIE_NAME)?.value;
    const currentDeviceHash = currentDeviceToken ? hashOpaqueToken(currentDeviceToken) : null;

    return json({
      ok: true,
      user: {
        email: user.email,
        role: user.role,
        effectiveRole: roleState.effectiveRole,
        adminViewRole: roleState.adminViewRole,
        isAdmin: roleState.isAdmin,
        isRoleViewActive: roleState.isRoleViewActive,
        hasPassword: !!user.passwordHash,
        activeSessionLimit: getActiveSessionMaxForUser(user),
        trustedDeviceLimit: getTrustedDeviceMaxForUser(user),
        trustedDevices: user.trustedDevices.map((device) => ({
          id: device.id,
          name: device.name,
          ipRange: device.ipRange,
          createdAt: device.createdAt?.toISOString?.() || null,
          lastUsedAt: device.lastUsedAt?.toISOString?.() || null,
          expiresAt: device.expiresAt?.toISOString?.() || null,
          isCurrentDevice: Boolean(currentDeviceHash && device.deviceTokenHash === currentDeviceHash)
        }))
      }
    });
  } catch (error) {
    console.error("profile GET error", safeError(error));
    return errorJson("profile.load_failed", 500, locale);
  }
}

export async function PUT(request) {
  const ctx = await requireUser();
  const locale = localeFromRequest(request);

  if (!ctx) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const requestLocale = localeFromRequest(request, body?.locale || body?.lang);
    const nextEmail =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined;
    const nextPassword =
      typeof body?.password === "string" ? body.password.trim() : undefined;
    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : undefined;

    const result = await updateProfileForUser({
      db: prisma,
      userId: ctx.userId,
      request,
      nextEmail,
      nextPassword,
      currentPassword,
      onEmailChanged: async (email) => {
        try {
          await sendVerificationEmail(email, requestLocale);
        } catch (sendError) {
          console.error("profile verification email send failed", safeError(sendError));
        }
      }
    });

    if (!result.ok) {
      return errorJson(
        result.error.messageKey,
        result.error.status,
        requestLocale,
        result.error.extras
      );
    }

    return json({
      ok: true,
      user: result.user,
      requiresReauth: result.requiresReauth
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return errorJson("profile.email_update.error_email_in_use", 409, locale);
    }

    console.error("profile PUT error", safeError(error));
    return errorJson("profile.update_failed", 500, locale);
  }
}

export async function DELETE(request) {
  const fallbackLocale = localeFromRequest(request);
  const ctx = await requireUser();
  if (!ctx) {
    return errorJson("api.common.unauthorized", 401, fallbackLocale);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const requestLocale = localeFromRequest(request, body?.locale || body?.lang);
    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : undefined;

    const result = await deleteProfileForUser({
      db: prisma,
      userId: ctx.userId,
      request,
      currentPassword,
      deleteUser: deleteUserWithPrivacyCleanup,
      onAccountDeleted: async (email) => {
        try {
          await sendAccountDeletedEmail(email, requestLocale);
        } catch (sendError) {
          console.error("profile account-deleted email send failed", safeError(sendError));
        }
      }
    });

    if (!result.ok) {
      return errorJson(
        result.error.messageKey,
        result.error.status,
        requestLocale,
        result.error.extras
      );
    }

    const { deletion } = result;

    return json({
      ok: true,
      deleted: deletion.ok,
      pending: deletion.pending === true,
      deletionJobId: deletion.deletionJobId || null
    }, deletion.pending ? 202 : 200);
  } catch (error) {
    if (error?.code === "P2025") {
      return errorJson("profile.errors.user_not_found", 404, fallbackLocale);
    }

    console.error("profile DELETE error", safeError(error));
    return errorJson("profile.delete_failed", 500, fallbackLocale);
  }
}
