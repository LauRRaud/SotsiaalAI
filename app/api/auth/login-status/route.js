export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOpaqueToken } from "@/lib/auth/pin-login";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { serverT, normalizeServerLocale } from "@/lib/i18n/serverMessages";
import { safeError } from "@/lib/privacy/safeError";

const LOGIN_STATUS_RATE_LIMIT_WINDOW_MS = Number(
  process.env.LOGIN_STATUS_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000
);
const LOGIN_STATUS_RATE_LIMIT_PER_IP = Number(
  process.env.LOGIN_STATUS_RATE_LIMIT_PER_IP || 180
);
const LOGIN_STATUS_RATE_LIMIT_PER_TOKEN = Number(
  process.env.LOGIN_STATUS_RATE_LIMIT_PER_TOKEN || 120
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

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale);

  try {
    const rawToken = String(body?.temp_login_token || "").trim();
    const ip = getRequestIpFromRequest(request);

    const ipLimit = consumeRateLimit(
      `login-status:ip:${ip}`,
      LOGIN_STATUS_RATE_LIMIT_PER_IP,
      LOGIN_STATUS_RATE_LIMIT_WINDOW_MS
    );
    if (!ipLimit.allowed) {
      return errorJson("api.auth.login.rate_limited", 429, locale, {
        code: "RATE_LIMITED"
      });
    }

    if (rawToken) {
      const tokenKey = hashOpaqueToken(rawToken).slice(0, 20);
      const tokenLimit = consumeRateLimit(
        `login-status:token:${tokenKey}`,
        LOGIN_STATUS_RATE_LIMIT_PER_TOKEN,
        LOGIN_STATUS_RATE_LIMIT_WINDOW_MS
      );
      if (!tokenLimit.allowed) {
        return errorJson("api.auth.login.rate_limited", 429, locale, {
          code: "RATE_LIMITED"
        });
      }
    }

    if (!rawToken) {
      return errorJson("api.auth.login.missing_fields", 400, locale, {
        code: "MISSING_FIELDS"
      });
    }

    const loginToken = await prisma.loginTempToken.findUnique({
      where: { tokenHash: hashOpaqueToken(rawToken) },
      select: {
        requiresOtp: true,
        otpVerifiedAt: true,
        expiresAt: true,
        usedAt: true
      }
    });

    if (!loginToken || loginToken.usedAt) {
      return errorJson("api.auth.login.token_invalid", 400, locale, {
        code: "TOKEN_INVALID"
      });
    }

    if (loginToken.expiresAt <= new Date()) {
      return errorJson("api.auth.login.token_expired", 400, locale, {
        code: "TOKEN_EXPIRED"
      });
    }

    if (!loginToken.requiresOtp || loginToken.otpVerifiedAt) {
      return json({
        status: "verified",
        temp_login_token: rawToken
      });
    }

    return json({
      status: "pending"
    });
  } catch (error) {
    console.error("login-status error", safeError(error));
    return errorJson("api.auth.login.verify_failed", 500, locale, {
      code: "VERIFY_FAILED"
    });
  }
}
