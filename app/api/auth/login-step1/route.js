export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import {
  normalizeEmail,
  normalizePin,
  isValidPin,
  maskEmail,
  generateOpaqueToken,
  hashOpaqueToken,
  fingerprintUserAgent,
  computeIpFromHeaders,
  computeIpRange,
  DEVICE_COOKIE_NAME,
  TEMP_LOGIN_TOKEN_MINUTES,
  summarizeUserAgent,
  formatSecurityEventTime
} from "@/lib/auth/pin-login";
import { getMailer } from "@/lib/mailer";
import {
  buildLoginConfirmUrl,
  sendLoginLinkEmail
} from "@/lib/auth/login-email-link";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getTrustedRequestIp } from "@/lib/request-ip";
import { authenticatePinAttempt } from "@/lib/auth/pinLoginAttempt";
import { serverT, normalizeServerLocale } from "@/lib/i18n/serverMessages";

const LOGIN_STEP1_RATE_LIMIT_WINDOW_MS = Number(
  process.env.LOGIN_STEP1_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000
);
const LOGIN_STEP1_RATE_LIMIT_PER_IP = Number(
  process.env.LOGIN_STEP1_RATE_LIMIT_PER_IP || 60
);
const LOGIN_STEP1_RATE_LIMIT_PER_EMAIL = Number(
  process.env.LOGIN_STEP1_RATE_LIMIT_PER_EMAIL || 12
);

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache"
};
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?$/i;

/** Üks ainus credential-vastus. Täpne põhjus jääb serverilogisse, mitte kliendile. */
function invalidCredentials(locale, reason) {
  if (reason) console.warn("login-step1 rejected", { reason });
  return errorJson("api.auth.login.invalid_credentials", 401, locale, {
    code: "INVALID_CREDENTIALS"
  });
}

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

function sanitizeEmail(email) {
  const normalized = normalizeEmail(email);
  return normalized || "";
}

function parseHostFromHeaderValue(value) {
  const raw = String(value || "")
    .split(",")[0]
    .trim();
  if (!raw) return "";

  try {
    return new URL(raw).host || "";
  } catch {
    return raw;
  }
}

function isLocalDevelopmentRequest(request) {
  if (process.env.NODE_ENV !== "development") return false;

  const hostCandidates = [
    request?.headers?.get("x-forwarded-host"),
    request?.headers?.get("host"),
    request?.headers?.get("origin"),
    request?.headers?.get("referer"),
    process.env.NEXTAUTH_URL,
    process.env.AUTH_URL,
    process.env.APP_URL
  ];

  return hostCandidates.some((value) =>
    LOCAL_HOST_RE.test(parseHostFromHeaderValue(value))
  );
}

async function createTempLoginToken({
  userId,
  requiresOtp,
  userAgent,
  ipAddress,
  trustedDeviceId
}) {
  const token = generateOpaqueToken(32);
  const emailLinkToken = requiresOtp ? generateOpaqueToken(32) : null;
  const expiresAt = new Date(Date.now() + TEMP_LOGIN_TOKEN_MINUTES * 60 * 1000);

  await prisma.loginTempToken.create({
    data: {
      userId,
      tokenHash: hashOpaqueToken(token),
      emailLinkTokenHash: emailLinkToken ? hashOpaqueToken(emailLinkToken) : null,
      requiresOtp: Boolean(requiresOtp),
      expiresAt,
      userAgent,
      ipAddress,
      trustedDeviceId: trustedDeviceId || null
    }
  });

  return { token, emailLinkToken, expiresAt };
}

async function sendNewDeviceAlertEmail(email, locale, { userAgent, ipAddress } = {}) {
  const mailer = getMailer("login-device-alert");
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  const isDev = process.env.NODE_ENV === "development";

  if (!from) {
    if (isDev) return;
    throw new Error("api.auth.login.email_from_missing");
  }

  const values = {
    device: summarizeUserAgent(userAgent),
    ip: ipAddress || "-",
    time: formatSecurityEventTime(locale, new Date())
  };

  try {
    if (!isDev) {
      await mailer.sendMail({
        to: email,
        from,
        subject: serverT(locale, "email.auth.login_device_alert.subject", values),
        text: serverT(locale, "email.auth.login_device_alert.text", values),
        html: serverT(locale, "email.auth.login_device_alert.html", values)
      });
    }
  } catch (error) {
    console.error("[login-device-alert] send failed", safeError(error));
    if (!isDev) throw error;
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale);

  try {
    const email = sanitizeEmail(body?.email);
    const pin = normalizePin(body?.pin);
    const ipAddress = computeIpFromHeaders(request.headers) || "unknown";
    // Turvaotsuses kõlbab AINULT usaldatud edge-proxy normaliseeritud väärtus; `ipAddress`
    // ülal jääb rea ja hoiatuskirja kirjelduseks, sest seda saab klient ise kirjutada.
    const trustedIp = getTrustedRequestIp(request.headers);

    // Mälupõhine piir jääb odavaks EELVÄRAVAKS (ei puuduta andmebaasi), aga ta EI OLE enam
    // brute-force'i kaitse: ta ei jagune instantside vahel ja kaob restardil (SOL-AUTH-09).
    const ipLimit = consumeRateLimit(
      `login-step1:ip:${ipAddress}`,
      LOGIN_STEP1_RATE_LIMIT_PER_IP,
      LOGIN_STEP1_RATE_LIMIT_WINDOW_MS
    );
    if (!ipLimit.allowed) {
      return errorJson("api.auth.login.rate_limited", 429, locale, {
        code: "RATE_LIMITED"
      });
    }

    if (email) {
      const emailLimit = consumeRateLimit(
        `login-step1:email:${email}`,
        LOGIN_STEP1_RATE_LIMIT_PER_EMAIL,
        LOGIN_STEP1_RATE_LIMIT_WINDOW_MS
      );
      if (!emailLimit.allowed) {
        return errorJson("api.auth.login.rate_limited", 429, locale, {
          code: "RATE_LIMITED"
        });
      }
    }

    if (!isValidPin(pin)) {
      // Vormiviga PIN-i kuju kohta ei ole katse ega ütle konto kohta midagi — ta ei tohi
      // kuluta katseid ega kanda credential-vastust.
      return errorJson("api.auth.login.pin_invalid", 400, locale, {
        code: "PIN_INVALID"
      });
    }

    // PIN-katse otsus elab marsruudist väljas (`lib/auth/pinLoginAttempt.js`): püsiv piir,
    // üks credential-vastus ja üks ajastus käivad kokku ja neid ei saa siin testida, sest
    // see fail impordib `next/headers`. Sama põhjus mis SOL-AUTH-08/-11-l.
    const attempt = await authenticatePinAttempt({
      db: prisma,
      email,
      pin,
      trustedIp
    });

    if (attempt.outcome === "rate_limited") {
      return errorJson("api.auth.login.rate_limited", 429, locale, {
        code: "RATE_LIMITED",
        retry_after_sec: attempt.retryAfterSec
      });
    }

    if (attempt.outcome !== "ok") {
      return invalidCredentials(locale, attempt.reason);
    }

    const user = attempt.user;

    const userAgent = request.headers.get("user-agent") || "";
    const fingerprint = fingerprintUserAgent(userAgent);
    const ipRange = computeIpRange(ipAddress);
    const cookieStore = await cookies();
    const deviceCookie = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
    const now = new Date();

    let trustedDevice = null;
    let trustedDeviceCandidate = null;

    if (deviceCookie) {
      const deviceTokenHash = hashOpaqueToken(deviceCookie);
      const candidate = await prisma.trustedDevice.findFirst({
        where: {
          userId: user.id,
          deviceTokenHash
        }
      });
      trustedDeviceCandidate = candidate;
      if (candidate && candidate.expiresAt > now) {
        const fingerprintMatch =
          !candidate.userAgentFingerprint ||
          candidate.userAgentFingerprint === fingerprint;
        // Mobile carriers rotate IP ranges often, so do not treat IP drift
        // alone as a reason to invalidate an otherwise valid trusted device.
        if (fingerprintMatch) {
          trustedDevice = candidate;
          await prisma.trustedDevice.update({
            where: { id: candidate.id },
            data: {
              lastUsedAt: now,
              ...(ipRange && candidate.ipRange !== ipRange ? { ipRange } : {})
            }
          });
        }
      }
    }

    const bypassForAdmins =
      String(process.env.LOGIN_OTP_BYPASS_FOR_ADMINS || "").toLowerCase() ===
      "true";
    const bypassEmails = String(process.env.LOGIN_OTP_BYPASS_EMAILS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const isBypassEmail = bypassEmails.includes((user.email || "").toLowerCase());
    const isLocalAdminBypass = isLocalDevelopmentRequest(request) && Boolean(user.isAdmin);
    const allowBypass =
      isLocalAdminBypass ||
      (bypassForAdmins && Boolean(user.isAdmin)) ||
      isBypassEmail;

    const requiresOtp = !trustedDevice && !allowBypass;
    const otpReason =
      requiresOtp &&
      trustedDeviceCandidate &&
      trustedDeviceCandidate.expiresAt <= now
        ? "trusted_device_expired"
        : undefined;

    const { token, emailLinkToken, expiresAt } = await createTempLoginToken({
      userId: user.id,
      requiresOtp,
      userAgent,
      ipAddress,
      trustedDeviceId: trustedDevice?.id
    });

    if (!requiresOtp) {
      return json({
        status: "success",
        temp_login_token: token,
        expires_at: expiresAt.toISOString()
      });
    }

    try {
      if (!trustedDevice) {
        await sendNewDeviceAlertEmail(user.email, locale, { userAgent, ipAddress });
      }
    } catch (mailError) {
      console.error("login-step1 device alert send failed", safeError(mailError));
    }

    // Kirja saatmine on siin VÄRAV, mitte kõrvaltoiming: ilma kohale jõudnud
    // lingita ei saa teist faktorit läbida, ja puuduva kanoonilise baas-URL-i
    // korral VISKAB `buildLoginConfirmUrl` (SOL-AUTH-12) — vana kood tuletas
    // origini kliendi Host-päisest ja saatis selle konto aadressile. Viga läheb
    // üldisesse catch'i: kasutaja saab 500, mitte lingi ründaja domeenile.
    await sendLoginLinkEmail(
      user.email,
      buildLoginConfirmUrl(emailLinkToken, locale),
      locale
    );

    return json({
      status: "need_2fa",
      temp_login_token: token,
      email_mask: maskEmail(user.email),
      otp_expires_at: expiresAt.toISOString(),
      otp_reason: otpReason
    });
  } catch (error) {
    console.error("login-step1 error", safeError(error));
    return errorJson("api.auth.login.step1_failed", 500, locale, {
      code: "LOGIN_FAILED"
    });
  }
}
