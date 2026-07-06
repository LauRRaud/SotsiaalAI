export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { hash } from "bcrypt";
import { prisma } from "@/lib/prisma";
import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { serverT, normalizeServerLocale } from "@/lib/i18n/serverMessages";
import { localizePath } from "@/lib/localizePath";
import { safeError } from "@/lib/privacy/safeError";

const TOKEN_EXPIRY_MINUTES = Number(process.env.RESET_TOKEN_MINUTES || 60);
const RESET_RATE_LIMIT_WINDOW_MS = Number(
  process.env.RESET_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000
);
const RESET_RATE_LIMIT_POST_PER_IP = Number(
  process.env.RESET_RATE_LIMIT_POST_PER_IP || 20
);
const RESET_RATE_LIMIT_POST_PER_EMAIL = Number(
  process.env.RESET_RATE_LIMIT_POST_PER_EMAIL || 5
);
const RESET_RATE_LIMIT_PUT_PER_IP = Number(
  process.env.RESET_RATE_LIMIT_PUT_PER_IP || 40
);
const RESET_RATE_LIMIT_PUT_PER_TOKEN = Number(
  process.env.RESET_RATE_LIMIT_PUT_PER_TOKEN || 10
);
const RESET_IDENTIFIER_PREFIX = "password-reset:";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

const mailer = getMailer("password-reset");

function ok(payload = {}) {
  return NextResponse.json(
    {
      ok: true,
      ...payload
    },
    { headers: NO_STORE_HEADERS }
  );
}

function err(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return NextResponse.json(
    {
      ok: false,
      messageKey,
      message: translated,
      error: translated,
      ...extras
    },
    {
      status,
      headers: NO_STORE_HEADERS
    }
  );
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function buildResetIdentifier(email) {
  return `${RESET_IDENTIFIER_PREFIX}${normalizeEmail(email)}`;
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

function buildResetUrl(token, locale = "en") {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    throw new Error("api.auth.reset.base_url_missing");
  }
  const resetPath = serverT(locale, "routes.password_reset_path", undefined, "/taasta-parool");
  const normalizedPath = String(resetPath || "/taasta-parool").startsWith("/")
    ? String(resetPath || "/taasta-parool")
    : `/${String(resetPath || "taasta-parool")}`;
  const tokenPath = normalizedPath.endsWith("/")
    ? `${normalizedPath}${token}`
    : `${normalizedPath}/${token}`;
  const localized = localizePath(tokenPath, locale);
  return `${baseUrl.replace(/\/$/, "")}${localized}`;
}

async function sendResetEmail(to, resetUrl, locale) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) {
    throw new Error("api.auth.reset.email_from_missing");
  }

  await mailer.sendMail({
    to,
    from,
    subject: serverT(locale, "email.auth.reset.subject", {
      minutes: TOKEN_EXPIRY_MINUTES
    }),
    text: serverT(locale, "email.auth.reset.text", {
      resetUrl,
      minutes: TOKEN_EXPIRY_MINUTES
    }),
    html: serverT(locale, "email.auth.reset.html", {
      resetUrl,
      minutes: TOKEN_EXPIRY_MINUTES
    })
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale || body?.lang);

  try {
    const email = normalizeEmail(body?.email);
    const ip = getRequestIpFromRequest(request);

    const ipLimit = consumeRateLimit(
      `reset-post:ip:${ip}`,
      RESET_RATE_LIMIT_POST_PER_IP,
      RESET_RATE_LIMIT_WINDOW_MS
    );
    if (!ipLimit.allowed) {
      return err("api.auth.reset.rate_limited_request", 429, locale);
    }

    if (email) {
      const emailLimit = consumeRateLimit(
        `reset-post:email:${email}`,
        RESET_RATE_LIMIT_POST_PER_EMAIL,
        RESET_RATE_LIMIT_WINDOW_MS
      );
      if (!emailLimit.allowed) {
        return err("api.auth.reset.rate_limited_request", 429, locale);
      }
    }

    if (!email || !email.includes("@")) {
      return err("api.auth.reset.invalid_email", 400, locale);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return ok();

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);
    const identifier = buildResetIdentifier(email);

    await prisma.verificationToken.create({
      data: {
        identifier,
        token,
        expires
      }
    });

    const resetUrl = buildResetUrl(token, locale);
    try {
      await sendResetEmail(email, resetUrl, locale);
      await prisma.verificationToken.deleteMany({
        where: {
          identifier,
          NOT: { token }
        }
      });
    } catch (sendError) {
      console.error("password reset email send failed", safeError(sendError));
    }

    return ok();
  } catch (error) {
    console.error("password reset POST error", safeError(error));
    return err("api.auth.reset.request_failed", 500, locale);
  }
}

export async function PUT(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale || body?.lang);

  try {
    const token = String(body?.token || "").trim();
    const pinRaw = String(body?.pin ?? body?.password ?? "").trim();
    const ip = getRequestIpFromRequest(request);

    const ipLimit = consumeRateLimit(
      `reset-put:ip:${ip}`,
      RESET_RATE_LIMIT_PUT_PER_IP,
      RESET_RATE_LIMIT_WINDOW_MS
    );
    if (!ipLimit.allowed) {
      return err("api.auth.reset.rate_limited_update", 429, locale);
    }

    if (token) {
      const tokenKey = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex")
        .slice(0, 20);
      const tokenLimit = consumeRateLimit(
        `reset-put:token:${tokenKey}`,
        RESET_RATE_LIMIT_PUT_PER_TOKEN,
        RESET_RATE_LIMIT_WINDOW_MS
      );
      if (!tokenLimit.allowed) {
        return err("api.auth.reset.rate_limited_update", 429, locale);
      }
    }

    const pin = pinRaw.replace(/\s+/g, "");
    if (!token || !pin) {
      return err("api.auth.reset.missing_token_or_pin", 400, locale);
    }
    if (!/^\d{4,8}$/.test(pin)) {
      return err("api.auth.reset.pin_invalid", 400, locale);
    }

    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token,
        identifier: {
          startsWith: RESET_IDENTIFIER_PREFIX
        }
      }
    });
    if (!verificationToken) {
      return err("api.auth.reset.token_invalid", 400, locale);
    }

    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token
          }
        }
      });
      return err("api.auth.reset.token_expired", 410, locale);
    }

    const email = normalizeEmail(
      String(verificationToken.identifier || "").replace(RESET_IDENTIFIER_PREFIX, "")
    );
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token
          }
        }
      });
      return err("api.auth.reset.user_not_found", 404, locale);
    }

    const passwordHash = await hash(pin, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash }
      });
      await tx.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token
          }
        }
      });
    });

    return ok({ requiresReauth: true });
  } catch (error) {
    console.error("PIN reset PUT error", safeError(error));
    return err("api.auth.reset.update_failed", 500, locale);
  }
}
