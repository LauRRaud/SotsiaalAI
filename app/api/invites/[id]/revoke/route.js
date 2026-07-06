import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REVOKE = 30;

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
      userId: session.user.id
    };
  } catch {
    return null;
  }
}

async function resolveInviteId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.id || "").trim();
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
    `invites:revoke:${auth.userId}:${ip}`,
    RATE_LIMIT_REVOKE,
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

    await prisma.invite.update({
      where: { id },
      data: { status: "REVOKED" }
    });

    return json({
      ok: true,
      id,
      status: "REVOKED"
    });
  } catch (error) {
    console.error("[invite revoke] failed", safeError(error));
    return errorJson("api.invites.revoke_failed", 500, locale, {
      code: "INVITE_REVOKE_FAILED"
    });
  }
}
