export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashOpaqueToken,
  fingerprintUserAgent,
  computeIpFromHeaders,
  computeIpRange,
  buildDeviceCookie,
  DEVICE_COOKIE_NAME,
  TRUSTED_DEVICE_DAYS,
  normalizeTrustedDeviceName
} from "@/lib/auth/pin-login";
import {
  LoginAttemptClaimError,
  verifyLoginAttempt
} from "@/lib/auth/loginAttemptVerification";
import { consumeRateLimit } from "@/lib/rate-limit";
import { serverT, normalizeServerLocale } from "@/lib/i18n/serverMessages";
import { safeError } from "@/lib/privacy/safeError";

const LOGIN_STEP2_RATE_LIMIT_WINDOW_MS = Number(
  process.env.LOGIN_STEP2_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000
);
const LOGIN_STEP2_RATE_LIMIT_PER_IP = Number(
  process.env.LOGIN_STEP2_RATE_LIMIT_PER_IP || 60
);
const LOGIN_STEP2_RATE_LIMIT_PER_TOKEN = Number(
  process.env.LOGIN_STEP2_RATE_LIMIT_PER_TOKEN || 15
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

async function fetchLoginToken(rawToken) {
  if (!rawToken) return null;
  const tokenHash = hashOpaqueToken(rawToken);
  return prisma.loginTempToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      requiresOtp: true,
      otpVerifiedAt: true,
      expiresAt: true,
      usedAt: true,
      trustedDeviceId: true,
      user: {
        select: {
          role: true,
          isAdmin: true
        }
      }
    }
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale);

  try {
    const rawToken = String(body?.temp_login_token || "").trim();
    const rememberDevice = Boolean(body?.remember_device);
    const deviceName = normalizeTrustedDeviceName(body?.device_name);
    const ipAddress = computeIpFromHeaders(request.headers) || "unknown";

    const ipLimit = consumeRateLimit(
      `login-step2:ip:${ipAddress}`,
      LOGIN_STEP2_RATE_LIMIT_PER_IP,
      LOGIN_STEP2_RATE_LIMIT_WINDOW_MS
    );
    if (!ipLimit.allowed) {
      return errorJson("api.auth.login.rate_limited", 429, locale, {
        code: "RATE_LIMITED"
      });
    }

    if (rawToken) {
      const tokenKey = hashOpaqueToken(rawToken).slice(0, 20);
      const tokenLimit = consumeRateLimit(
        `login-step2:token:${tokenKey}`,
        LOGIN_STEP2_RATE_LIMIT_PER_TOKEN,
        LOGIN_STEP2_RATE_LIMIT_WINDOW_MS
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

    const loginToken = await fetchLoginToken(rawToken);
    if (!loginToken) {
      return errorJson("api.auth.login.token_invalid", 400, locale, {
        code: "TOKEN_INVALID"
      });
    }

    const now = new Date();
    if (loginToken.expiresAt <= now || loginToken.usedAt) {
      return errorJson("api.auth.login.token_expired", 400, locale, {
        code: "TOKEN_EXPIRED"
      });
    }

    if (loginToken.requiresOtp && !loginToken.otpVerifiedAt) {
      return errorJson("api.auth.login.email_link_pending", 409, locale, {
        code: "EMAIL_LINK_PENDING"
      });
    }

    const userAgent = request.headers.get("user-agent") || "";
    const fingerprint = fingerprintUserAgent(userAgent);
    const ipRange = computeIpRange(ipAddress);
    const deviceExpiresAt = new Date(
      Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000
    );

    let deviceToken = null;
    try {
      ({ deviceToken } = await verifyLoginAttempt({
        db: prisma,
        loginToken,
        rememberDevice,
        deviceName,
        fingerprint,
        ipRange,
        deviceExpiresAt,
        now
      }));
    } catch (claimError) {
      if (claimError instanceof LoginAttemptClaimError) {
        // The attempt already settled (or already handed out its one device).
        // A used login attempt is not an error the caller can fix by retrying.
        return errorJson("api.auth.login.token_expired", 400, locale, {
          code: "TOKEN_EXPIRED"
        });
      }
      throw claimError;
    }

    const response = json({
      status: "verified",
      temp_login_token: rawToken
    });

    if (deviceToken) {
      const cookie = buildDeviceCookie(deviceToken);
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    } else if (!loginToken.trustedDeviceId) {
      // Only clear the cookie when this attempt never had a device — otherwise a
      // later remember_device=false call would strip the one it just issued.
      response.cookies.set(DEVICE_COOKIE_NAME, "", {
        path: "/",
        maxAge: 0
      });
    }

    return response;
  } catch (error) {
    console.error("login-step2 error", safeError(error));
    return errorJson("api.auth.login.verify_failed", 500, locale, {
      code: "VERIFY_FAILED"
    });
  }
}
