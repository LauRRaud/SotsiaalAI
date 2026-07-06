import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_RESEND = 20;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

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

function localeFromRequest(request, directLocale) {
  const direct = normalizeServerLocale(directLocale);
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
    if (!session?.user?.id) return null;

    return {
      userId: session.user.id,
      email: session.user.email
    };
  } catch {
    return null;
  }
}

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("base64");
}

function randomToken() {
  const raw = crypto.randomBytes(48).toString("base64url");
  return {
    raw,
    hash: hashToken(raw)
  };
}

function buildJoinLink(token) {
  const base = resolveBaseUrl() || "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/join?token=${encodeURIComponent(token)}`;
}

async function resolveInviteId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.id || "").trim();
}

async function sendInviteEmail({ to, token, roomTitle, inviterName, locale }) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) {
    throw new Error("api.invites.email_from_missing");
  }

  const joinLink = buildJoinLink(token);
  const mailer = getMailer("invite-resend");

  await mailer.sendMail({
    to,
    from,
    subject: serverT(locale, "email.invite.resend.subject", { roomTitle }),
    text: serverT(locale, "email.invite.resend.text", {
      inviterName,
      roomTitle,
      joinLink
    }),
    html: serverT(locale, "email.invite.resend.html", {
      inviterName,
      roomTitle,
      joinLink
    })
  });
}

export async function POST(request, { params }) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }

  const locale = localeFromRequest(request, body?.locale || body?.lang);
  const auth = await requireUser();
  if (!auth) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  const id = await resolveInviteId(params);
  if (!id) {
    return errorJson("api.invites.missing_id", 400, locale, {
      code: "MISSING_ID"
    });
  }

  const ip = getRequestIpFromRequest(request);
  const limit = consumeRateLimit(
    `invites:resend:${auth.userId}:${ip}`,
    RATE_LIMIT_RESEND,
    RATE_LIMIT_WINDOW_MS
  );
  if (!limit.allowed) {
    return errorJson("invite.error.rate_limited", 429, locale, {
      code: "RATE_LIMITED"
    });
  }

  try {
    const invite = await prisma.invite.findUnique({
      where: { id },
      include: { room: true }
    });

    if (!invite) {
      return errorJson("api.invites.invite_not_found", 404, locale, {
        code: "INVITE_NOT_FOUND"
      });
    }

    if (invite.status !== "SENT") {
      return errorJson("api.invites.only_pending_resend", 400, locale, {
        code: "ONLY_PENDING_RESEND"
      });
    }

    const membership = await prisma.roomMember.findFirst({
      where: {
        roomId: invite.roomId,
        userId: auth.userId,
        leftAt: null
      }
    });

    if (!(invite.room.ownerId === auth.userId || ["OWNER", "MODERATOR"].includes(membership?.role))) {
      return errorJson("api.common.forbidden", 403, locale, {
        code: "FORBIDDEN"
      });
    }

    if (invite.expiresAt <= new Date()) {
      return errorJson("api.invites.invite_expired", 410, locale, {
        code: "INVITE_EXPIRED"
      });
    }

    const { raw, hash } = randomToken();
    await sendInviteEmail({
      to: invite.inviteeEmail,
      token: raw,
      roomTitle: invite.room?.title || serverT(locale, "rooms.fallback_title", undefined, "Room"),
      inviterName: auth.email || "SotsiaalAI",
      locale
    });

    await prisma.invite.update({
      where: { id },
      data: {
        tokenHash: hash,
        status: "SENT"
      }
    });

    return json({
      ok: true,
      id
    });
  } catch (error) {
    console.error("[invite resend] failed", safeError(error));

    if (
      typeof error?.message === "string" &&
      error.message.startsWith("api.invites.")
    ) {
      return errorJson(error.message, 500, locale, {
        code: "INVITE_RESEND_CONFIG_ERROR"
      });
    }

    return errorJson("api.invites.resend_failed", 500, locale, {
      code: "INVITE_RESEND_FAILED"
    });
  }
}
