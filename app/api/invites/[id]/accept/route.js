import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import {
  acceptInviteWithinTx,
  hashInviteToken
} from "@/lib/invites/acceptInviteCore";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_ACCEPT = 20;
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
      role: session.user.role,
      isAdmin: Boolean(session.user.isAdmin),
      email: session.user.email
    };
  } catch {
    return null;
  }
}

async function resolveInviteToken(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.id || "").trim();
}

export async function POST(request, { params }) {
  const tokenRaw = await resolveInviteToken(params);

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    // empty payload is allowed
  }

  const locale = localeFromRequest(request, payload?.locale || payload?.lang);

  if (!tokenRaw) {
    return errorJson("api.invites.missing_token", 400, locale, {
      code: "MISSING_TOKEN"
    });
  }

  const auth = await requireUser();
  if (!auth) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  const ip = getRequestIpFromRequest(request);
  const limit = consumeRateLimit(
    `invites:accept:${auth.userId}:${ip}`,
    RATE_LIMIT_ACCEPT,
    RATE_LIMIT_WINDOW_MS
  );
  if (!limit.allowed) {
    return errorJson("invite.error.rate_limited", 429, locale, {
      code: "RATE_LIMITED"
    });
  }

  const displayNameRaw =
    typeof payload?.display_name === "string"
      ? payload.display_name
      : typeof payload?.displayName === "string"
        ? payload.displayName
        : "";
  const displayName = displayNameRaw.trim().slice(0, 80) || null;

  const userEmailRow = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true }
  });
  const userEmail = String(auth.email || userEmailRow?.email || "")
    .trim()
    .toLowerCase();

  const tokenHash = hashInviteToken(tokenRaw);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT 1 FROM "Invite"
        WHERE "tokenHash" = ${tokenHash}
        FOR UPDATE
      `;

      const invite = await tx.invite.findUnique({
        where: { tokenHash },
        include: { room: true }
      });

      // Ühine vastuvõtu-tuum (vt lib/invites/acceptInviteCore.js) — sama
      // loogika mida kasutab ka ootel-kutse (id-põhine) rada.
      return acceptInviteWithinTx({
        tx,
        invite,
        auth,
        userEmail,
        displayName,
        now: new Date()
      });
    });

    return json(result, 200);
  } catch (error) {
    if (error?.status) {
      return errorJson(
        error.messageKey || "api.invites.accept_failed",
        error.status,
        locale,
        {
          code: error.code
        }
      );
    }

    console.error("[invite accept] failed", safeError(error));
    return errorJson("api.invites.accept_failed", 500, locale, {
      code: "INVITE_ACCEPT_FAILED"
    });
  }
}
