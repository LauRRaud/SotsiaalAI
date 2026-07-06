export const runtime = "nodejs";

import crypto from "node:crypto";
import { hash } from "bcrypt";
import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import {
  WORKER_FRAMEWORK_ACCEPTANCE_SOURCE,
  WORKER_FRAMEWORK_ACCEPTANCE_TYPE,
  WORKER_FRAMEWORK_KEY,
  WORKER_FRAMEWORK_VERSION,
  normalizeOptionalTimestamp
} from "@/lib/frameworkAcceptances";
import { createFrameworkAcceptanceDocument } from "@/lib/frameworkAcceptances/server";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";

const ROLE_MAP = {
  specialist: Role.SOCIAL_WORKER,
  worker: Role.SOCIAL_WORKER,
  social_worker: Role.SOCIAL_WORKER,
  socialworker: Role.SOCIAL_WORKER,
  provider: Role.SERVICE_PROVIDER,
  service_provider: Role.SERVICE_PROVIDER,
  serviceprovider: Role.SERVICE_PROVIDER,
  teenuseosutaja: Role.SERVICE_PROVIDER,
  client: Role.CLIENT,
  citizen: Role.CLIENT
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const REGISTER_RATE_LIMIT_WINDOW_MS = Number(
  process.env.REGISTER_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000
);
const REGISTER_RATE_LIMIT_PER_IP = Number(process.env.REGISTER_RATE_LIMIT_PER_IP || 20);
const REGISTER_RATE_LIMIT_PER_EMAIL = Number(
  process.env.REGISTER_RATE_LIMIT_PER_EMAIL || 4
);
const REGISTRATION_OPEN = !["false", "0", "off"].includes(
  String(process.env.REGISTRATION_OPEN || "false").trim().toLowerCase()
);
const EMAIL_VERIFY_IDENTIFIER_PREFIX = "email-verify:";

function json(payload = {}, status = 200) {
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

function normalizeEmail(input) {
  const normalized = String(input || "").trim().toLowerCase();
  return normalized.length > EMAIL_MAX
    ? normalized.slice(0, EMAIL_MAX)
    : normalized;
}

function buildEmailVerifyIdentifier(email) {
  return `${EMAIL_VERIFY_IDENTIFIER_PREFIX}${normalizeEmail(email)}`;
}

function validEmail(value) {
  return !!value && value.length <= EMAIL_MAX && EMAIL_RE.test(value);
}

function normalizePin(input) {
  return String(input || "")
    .trim()
    .replace(/\s+/g, "");
}

function validPin(pin) {
  return typeof pin === "string" && /^\d{4,8}$/.test(pin);
}

function normalizeRole(input) {
  if (!input) return Role.CLIENT;
  const key = String(input)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const mapped = ROLE_MAP[key] ?? Role.CLIENT;
  return mapped === Role.ADMIN ? Role.CLIENT : mapped;
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

function buildVerifyUrl(email, token, locale) {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) return "";

  const params = new URLSearchParams({ email, token });
  if (locale) params.set("locale", locale);

  return `${baseUrl.replace(/\/$/, "")}/api/verify-email?${params.toString()}`;
}

async function sendVerificationEmail(email, verifyUrl, locale) {
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
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale);

  try {
    if (!REGISTRATION_OPEN) {
      return errorJson("api.auth.register.closed", 403, locale, {
        code: "REGISTER_DISABLED"
      });
    }

    const email = normalizeEmail(body?.email);
    const pin = normalizePin(body?.pin ?? body?.password);
    const role = normalizeRole(body?.role);
    const workerUse = String(body?.workerUse || "").trim().toUpperCase();
    const frameworkAck = body?.frameworkAck === true;
    const frameworkVersion =
      String(body?.frameworkVersion || "").trim() || WORKER_FRAMEWORK_VERSION;
    const frameworkReviewOpenedAt = normalizeOptionalTimestamp(body?.frameworkReviewOpenedAt);
    const frameworkSignedDownloadedAt = normalizeOptionalTimestamp(body?.frameworkSignedDownloadedAt);
    const ip = getRequestIpFromRequest(request);
    const userAgent = String(request.headers.get("user-agent") || "").trim() || null;
    const isProfessionalRole =
      role === Role.SOCIAL_WORKER || role === Role.SERVICE_PROVIDER;
    const requiresFramework = isProfessionalRole && workerUse === "ORG_IDENTIFIABLE";

    const ipLimit = consumeRateLimit(
      `register:ip:${ip}`,
      REGISTER_RATE_LIMIT_PER_IP,
      REGISTER_RATE_LIMIT_WINDOW_MS
    );
    if (!ipLimit.allowed) {
      return errorJson("api.auth.register.rate_limited", 429, locale, {
        code: "RATE_LIMITED"
      });
    }

    if (email) {
      const emailLimit = consumeRateLimit(
        `register:email:${email}`,
        REGISTER_RATE_LIMIT_PER_EMAIL,
        REGISTER_RATE_LIMIT_WINDOW_MS
      );
      if (!emailLimit.allowed) {
        return errorJson("api.auth.register.rate_limited", 429, locale, {
          code: "RATE_LIMITED"
        });
      }
    }

    if (!validEmail(email)) {
      return errorJson("api.auth.register.invalid_email", 400, locale, {
        code: "INVALID_EMAIL"
      });
    }

    if (!validPin(pin)) {
      return errorJson("api.auth.register.pin_invalid", 400, locale, {
        code: "PIN_INVALID"
      });
    }

    if (requiresFramework && !frameworkAck) {
      return errorJson("auth.register.error.framework_ack_required", 400, locale, {
        code: "FRAMEWORK_ACK_REQUIRED"
      });
    }

    const passwordHash = await hash(pin, 12);
    let createdUser = null;
    let frameworkAcceptance = null;

    try {
      await prisma.$transaction(async (tx) => {
        createdUser = await tx.user.create({
          data: {
            email,
            passwordHash,
            role,
            subscriptions: {
              create: {}
            }
          }
        });

        if (requiresFramework) {
          frameworkAcceptance = await tx.frameworkAcceptance.create({
            data: {
              userId: createdUser.id,
              frameworkKey: WORKER_FRAMEWORK_KEY,
              frameworkVersion,
              acceptanceType: WORKER_FRAMEWORK_ACCEPTANCE_TYPE,
              acceptanceSource: WORKER_FRAMEWORK_ACCEPTANCE_SOURCE,
              roleAtAcceptance: role,
              locale,
              ipAddress: ip || null,
              userAgent,
              acceptedAt: new Date(),
              reviewDocumentOpenedAt: frameworkReviewOpenedAt,
              signedDocumentDownloadedAt: frameworkSignedDownloadedAt
            }
          });
        }
      });
    } catch (error) {
      if (error && typeof error === "object" && error.code === "P2002") {
        return errorJson("api.auth.register.email_in_use", 409, locale, {
          code: "EMAIL_IN_USE"
        });
      }
      throw error;
    }

    if (createdUser && frameworkAcceptance) {
      try {
        await createFrameworkAcceptanceDocument({
          acceptance: frameworkAcceptance,
          user: createdUser,
          locale
        });
      } catch (documentError) {
        console.error("[register] framework acceptance document creation failed", safeError(documentError));
      }
    }

    try {
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
      if (!verifyUrl) {
        console.warn("[register] verify email skipped: base URL is not configured");
      } else {
        try {
          await sendVerificationEmail(email, verifyUrl, locale);
          await prisma.verificationToken.deleteMany({
            where: {
              identifier,
              NOT: { token }
            }
          });
          await prisma.user.update({
            where: { email },
            data: { emailVerificationSentAt: new Date() }
          });
        } catch (sendError) {
          console.error("register verification email send failed", safeError(sendError));
        }
      }
    } catch (verifyError) {
      console.error("register verification flow failed", safeError(verifyError));
    }

    return json({}, 201);
  } catch (error) {
    console.error("register POST error", safeError(error));
    return errorJson("api.auth.register.failed", 500, locale, {
      code: "REGISTER_FAILED"
    });
  }
}
