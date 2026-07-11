export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashOpaqueToken,
  maskEmail,
  generateOpaqueToken
} from "@/lib/auth/pin-login";
import {
  buildLoginConfirmUrl,
  sendLoginLinkEmail
} from "@/lib/auth/login-email-link";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { serverT, normalizeServerLocale } from "@/lib/i18n/serverMessages";
import { safeError } from "@/lib/privacy/safeError";

const LOGIN_RESEND_RATE_LIMIT_WINDOW_MS = Number(
  process.env.LOGIN_RESEND_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000
);
const LOGIN_RESEND_RATE_LIMIT_PER_IP = Number(
  process.env.LOGIN_RESEND_RATE_LIMIT_PER_IP || 30
);
const LOGIN_RESEND_RATE_LIMIT_PER_TOKEN = Number(
  process.env.LOGIN_RESEND_RATE_LIMIT_PER_TOKEN || 6
);

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache"
};

function json(payload, status = 200) {
  return NextResponse.json(
    {
      ok: status < 400,
      ...payload
    },
    {
      status,
      headers: NO_STORE_HEADERS
    }
  );
}

function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json(
    {
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

async function fetchToken(rawToken) {
  if (!rawToken) return null;
  const tokenHash = hashOpaqueToken(rawToken);
  return prisma.loginTempToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      requiresOtp: true,
      expiresAt: true,
      usedAt: true,
      otpVerifiedAt: true,
      emailLinkTokenHash: true
    }
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale);

  try {
    const rawToken = String(body?.temp_login_token || "").trim();
    const ip = getRequestIpFromRequest(request);

    const ipLimit = consumeRateLimit(
      `login-resend:ip:${ip}`,
      LOGIN_RESEND_RATE_LIMIT_PER_IP,
      LOGIN_RESEND_RATE_LIMIT_WINDOW_MS
    );
    if (!ipLimit.allowed) {
      return errorJson("api.auth.login.rate_limited", 429, locale, {
        code: "RATE_LIMITED"
      });
    }

    if (rawToken) {
      const tokenKey = hashOpaqueToken(rawToken).slice(0, 20);
      const tokenLimit = consumeRateLimit(
        `login-resend:token:${tokenKey}`,
        LOGIN_RESEND_RATE_LIMIT_PER_TOKEN,
        LOGIN_RESEND_RATE_LIMIT_WINDOW_MS
      );
      if (!tokenLimit.allowed) {
        return errorJson("api.auth.login.rate_limited", 429, locale, {
          code: "RATE_LIMITED"
        });
      }
    }

    if (!rawToken) {
      return errorJson("api.auth.login.resend_missing_token", 400, locale, {
        code: "MISSING_FIELDS"
      });
    }

    const loginToken = await fetchToken(rawToken);
    if (
      !loginToken ||
      loginToken.usedAt ||
      loginToken.otpVerifiedAt ||
      !loginToken.requiresOtp ||
      loginToken.expiresAt <= new Date()
    ) {
      return errorJson("api.auth.login.resend_token_invalid", 400, locale, {
        code: "TOKEN_INVALID"
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: loginToken.userId },
      select: { email: true, accessSuspendedAt: true }
    });
    if (!user?.email || user.accessSuspendedAt) {
      return errorJson("api.auth.login.user_missing", 404, locale, {
        code: "USER_MISSING"
      });
    }

    const emailLinkToken = generateOpaqueToken(32);
    await prisma.loginTempToken.update({
      where: { id: loginToken.id },
      data: {
        emailLinkTokenHash: hashOpaqueToken(emailLinkToken)
      }
    });

    await sendLoginLinkEmail(
      user.email,
      buildLoginConfirmUrl(request, emailLinkToken, locale),
      locale
    );

    return json({
      status: "resent",
      email_mask: maskEmail(user.email),
      otp_expires_at: loginToken.expiresAt.toISOString()
    });
  } catch (error) {
    console.error("login-resend-otp error", safeError(error));
    return errorJson("api.auth.login.resend_failed", 500, locale, {
      code: "RESEND_FAILED"
    });
  }
}
