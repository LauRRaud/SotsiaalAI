export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import {
  cancelPendingEmailChange,
  createPendingEmailChange
} from "@/lib/profile/emailChange";
import { safeError } from "@/lib/privacy/safeError";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";

const RESEND_RATE_LIMIT_WINDOW_MS = Number(
  process.env.EMAIL_CHANGE_RESEND_RATE_WINDOW_MS || 60 * 60 * 1000
);
const RESEND_RATE_LIMIT_PER_USER = Number(
  process.env.EMAIL_CHANGE_RESEND_RATE_PER_USER || 5
);

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

function errorJson(messageKey, status, locale, extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json(
    { ok: false, messageKey, message: translated, error: translated, ...extras },
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

function buildEmailChangeConfirmUrl(token, locale) {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    throw new Error("api.auth.verify.base_url_missing");
  }
  const params = new URLSearchParams({ token });
  if (locale) params.set("locale", locale);
  return `${baseUrl.replace(/\/$/, "")}/api/profile/email-change/confirm?${params.toString()}`;
}

async function sendEmailChangeConfirmLink(newEmail, token, locale) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) {
    throw new Error("api.auth.verify.email_from_missing");
  }
  const confirmUrl = buildEmailChangeConfirmUrl(token, locale);
  const mailer = getMailer("email-change-confirm");
  await mailer.sendMail({
    to: newEmail,
    from,
    subject: serverT(locale, "email.account.email_change_confirm.subject"),
    text: serverT(locale, "email.account.email_change_confirm.text", { confirmUrl }),
    html: serverT(locale, "email.account.email_change_confirm.html", { confirmUrl })
  });
}

async function requireUserId() {
  try {
    const session = await getServerSession(authConfig);
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

// Resend the confirmation link for the current pending email change.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale || body?.lang);

  const userId = await requireUserId();
  if (!userId) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  try {
    const ip = getRequestIpFromRequest(request);
    const limit = consumeRateLimit(
      `email-change-resend:${userId}:${ip}`,
      RESEND_RATE_LIMIT_PER_USER,
      RESEND_RATE_LIMIT_WINDOW_MS
    );
    if (!limit.allowed) {
      return errorJson("api.common.rate_limited", 429, locale, { code: "RATE_LIMITED" });
    }

    const pending = await prisma.pendingEmailChange.findUnique({ where: { userId } });
    if (!pending || pending.expiresAt <= new Date()) {
      return errorJson("profile.email_update.no_pending", 404, locale, {
        code: "NO_PENDING_CHANGE"
      });
    }

    const refreshed = await createPendingEmailChange({
      db: prisma,
      userId,
      newEmail: pending.newEmail,
      request
    });

    try {
      await sendEmailChangeConfirmLink(pending.newEmail, refreshed.token, locale);
    } catch (sendError) {
      console.error("email-change resend send failed", safeError(sendError));
    }

    return json({
      ok: true,
      pendingEmail: pending.newEmail,
      expiresAt: refreshed.expiresAt.toISOString()
    });
  } catch (error) {
    console.error("email-change resend error", safeError(error));
    return errorJson("profile.update_failed", 500, locale);
  }
}

// Cancel the pending email change before it is confirmed.
export async function DELETE(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale || body?.lang);

  const userId = await requireUserId();
  if (!userId) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  try {
    await cancelPendingEmailChange({ db: prisma, userId });
    return json({ ok: true });
  } catch (error) {
    console.error("email-change cancel error", safeError(error));
    return errorJson("profile.update_failed", 500, locale);
  }
}
