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
import { ROOM_ORIGIN_TYPES, buildRoomOrigin } from "@/lib/rooms/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_INVITES = 10;

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

function ok(payload = {}, status = 200) {
  return json(
    {
      ok: true,
      ...payload
    },
    status
  );
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

function fail(messageKey, status = 400, code = "") {
  const error = new Error(messageKey);
  error.status = status;
  error.messageKey = messageKey;
  error.code = code;
  return error;
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

function normalizeEmails(emails) {
  if (!emails) return [];
  const list = Array.isArray(emails)
    ? emails
    : String(emails).split(/[,;\n\r]/);

  return [
    ...new Set(
      list
        .map((email) => String(email || "").trim().toLowerCase())
        .filter(Boolean)
    )
  ];
}

function normalizeRelationship(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "COLLEAGUE") return "COLLEAGUE";
  if (raw === "CLIENT") return "CLIENT";
  return null;
}

function normalizePaymentMode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "SPONSORED" || raw === "SPONSORED_BY_HOST") {
    return "SPONSORED_BY_HOST";
  }
  if (raw === "SELF_PAID") return "SELF_PAID";
  return "SELF_PAID";
}

function normalizeDisplayName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 80);
}

async function ensureOwnerMembership(roomId, ownerId, ownerDisplayName) {
  try {
    await prisma.roomMember.upsert({
      where: {
        roomId_userId: {
          roomId,
          userId: ownerId
        }
      },
      create: {
        roomId,
        userId: ownerId,
        role: "OWNER",
        displayName: ownerDisplayName || undefined
      },
      update: {
        role: "OWNER",
        leftAt: null,
        ...(ownerDisplayName ? { displayName: ownerDisplayName } : {})
      }
    });
  } catch {
    // non-blocking sync
  }
}

async function ensureRoom(userId, roomId, roomTitle, ownerDisplayName, locale) {
  if (roomId) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw fail("api.rooms.not_found", 404, "ROOM_NOT_FOUND");
    }
    await ensureOwnerMembership(room.id, room.ownerId, ownerDisplayName);
    return room;
  }

  const trimmedTitle = typeof roomTitle === "string" ? roomTitle.trim() : "";
  if (trimmedTitle) {
    return prisma.room.create({
      data: {
        ownerId: userId,
        title: trimmedTitle,
        ...buildRoomOrigin({
          originType: ROOM_ORIGIN_TYPES.MANUAL_INVITE
        }),
        members: {
          create: {
            userId,
            role: "OWNER",
            displayName: ownerDisplayName || undefined
          }
        }
      }
    });
  }

  const existing = await prisma.room.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" }
  });
  if (existing) {
    await ensureOwnerMembership(existing.id, existing.ownerId, ownerDisplayName);
    return existing;
  }

  const fallbackTitle = serverT(locale, "rooms.fallback_title", undefined, "Room");
  return prisma.room.create({
    data: {
      ownerId: userId,
      title: fallbackTitle,
      ...buildRoomOrigin({
        originType: ROOM_ORIGIN_TYPES.MANUAL_INVITE
      }),
      members: {
        create: {
          userId,
          role: "OWNER",
          displayName: ownerDisplayName || undefined
        }
      }
    }
  });
}

async function requireRoomRole({
  userId,
  roomId,
  allowedRoles,
  roomTitle,
  ownerDisplayName,
  locale
}) {
  const room = await ensureRoom(
    userId,
    roomId,
    roomTitle,
    ownerDisplayName,
    locale
  );

  if (room.ownerId === userId) {
    return {
      room,
      membership: { role: "OWNER" }
    };
  }

  const membership = await prisma.roomMember.findFirst({
    where: {
      roomId: room.id,
      userId,
      leftAt: null
    }
  });

  if (!membership || !allowedRoles.includes(membership.role)) {
    throw fail("api.common.forbidden", 403, "FORBIDDEN");
  }

  return { room, membership };
}

async function resolveSponsor(room) {
  return {
    userId: room.ownerId,
    orgId: null
  };
}

function buildJoinLink(token) {
  const base = resolveBaseUrl() || "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/join?token=${encodeURIComponent(token)}`;
}

async function sendInviteEmail({
  to,
  token,
  roomTitle,
  inviterName,
  locale,
  template
}) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) {
    throw fail("api.invites.email_from_missing", 500, "EMAIL_FROM_MISSING");
  }

  const joinLink = buildJoinLink(token);
  const keyRoot = template === "resend" ? "email.invite.resend" : "email.invite.create";
  const mailer = getMailer(template === "resend" ? "invite-resend" : "invite");

  await mailer.sendMail({
    to,
    from,
    subject: serverT(locale, `${keyRoot}.subject`, { roomTitle }),
    text: serverT(locale, `${keyRoot}.text`, {
      inviterName,
      roomTitle,
      joinLink
    }),
    html: serverT(locale, `${keyRoot}.html`, {
      inviterName,
      roomTitle,
      joinLink
    })
  });
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  const url = new URL(request.url);
  const roomId = String(
    url.searchParams.get("room_id") ||
      url.searchParams.get("roomId") ||
      ""
  ).trim();

  if (!roomId) {
    return errorJson("api.common.invalid_request", 400, locale, {
      code: "MISSING_ROOM_ID"
    });
  }

  try {
    const roomCheck = await requireRoomRole({
      userId: auth.userId,
      roomId,
      allowedRoles: ["OWNER", "MODERATOR"],
      locale
    });

    const invites = await prisma.invite.findMany({
      where: { roomId: roomCheck.room.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        inviteeEmail: true,
        status: true,
        expiresAt: true,
        maxUses: true,
        useCount: true,
        relationshipType: true,
        paymentMode: true,
        createdAt: true,
        acceptedBillingSource: true,
        acceptedByUserId: true
      }
    });

    return ok({
      roomId: roomCheck.room.id,
      invites
    });
  } catch (error) {
    if (error?.status) {
      return errorJson(
        error.messageKey || "api.invites.load_failed",
        error.status,
        locale,
        {
          code: error.code
        }
      );
    }

    console.error("[invites GET] failed", safeError(error));
    return errorJson("api.invites.load_failed", 500, locale, {
      code: "INVITES_LOAD_FAILED"
    });
  }
}

export async function POST(request) {
  const auth = await requireUser();
  if (!auth) {
    return errorJson("api.common.unauthorized", 401, localeFromRequest(request));
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorJson("api.common.invalid_json", 400, localeFromRequest(request), {
      code: "INVALID_JSON"
    });
  }

  const locale = localeFromRequest(request, payload?.locale || payload?.lang);
  const ip = getRequestIpFromRequest(request);
  const limit = consumeRateLimit(
    `invites:create:${auth.userId}:${ip}`,
    RATE_LIMIT_INVITES,
    RATE_LIMIT_WINDOW_MS
  );
  if (!limit.allowed) {
    return errorJson("invite.error.rate_limited", 429, locale, {
      code: "RATE_LIMITED"
    });
  }

  const emails = normalizeEmails(payload?.emails);
  if (!emails.length) {
    return errorJson("invite.error.emails_required", 400, locale, {
      code: "EMAILS_REQUIRED"
    });
  }

  const roomId = String(payload?.room_id ?? payload?.roomId ?? "").trim();
  const roomTitle =
    typeof payload?.room_title === "string"
      ? payload.room_title
      : typeof payload?.roomTitle === "string"
        ? payload.roomTitle
        : "";
  const hostDisplayName = normalizeDisplayName(
    payload?.host_display_name ?? payload?.hostDisplayName ?? ""
  );

  if (!roomId && !String(roomTitle || "").trim()) {
    return errorJson("invite.room_title_required", 400, locale, {
      code: "ROOM_TITLE_REQUIRED"
    });
  }

  if (!roomId && !hostDisplayName) {
    return errorJson("invite.host_name_required", 400, locale, {
      code: "HOST_NAME_REQUIRED"
    });
  }

  try {
    const roomCheck = await requireRoomRole({
      userId: auth.userId,
      roomId: roomId || undefined,
      roomTitle,
      ownerDisplayName: hostDisplayName,
      allowedRoles: ["OWNER", "MODERATOR"],
      locale
    });

    const room = roomCheck.room;

    if (hostDisplayName) {
      await prisma.roomMember.upsert({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId: auth.userId
          }
        },
        create: {
          roomId: room.id,
          userId: auth.userId,
          role: roomCheck.membership?.role || "OWNER",
          displayName: hostDisplayName
        },
        update: {
          displayName: hostDisplayName,
          leftAt: null
        }
      });
    }

    const relationshipType = normalizeRelationship(
      payload?.relationship_type || payload?.relationshipType
    );
    const paymentMode = normalizePaymentMode(
      payload?.payment_mode || payload?.paymentMode
    );

    const mailLocale =
      normalizeServerLocale(payload?.lang || payload?.language || payload?.locale) ||
      locale;

    const expiresHoursRaw = Number(
      payload?.expires_in_hours ?? payload?.expiresInHours ?? 168
    );
    const expiresHours = Number.isFinite(expiresHoursRaw)
      ? Math.max(1, expiresHoursRaw)
      : 168;

    const maxUsesRaw = Number(payload?.max_uses ?? payload?.maxUses ?? 1);
    const maxUses = Number.isFinite(maxUsesRaw) ? Math.max(1, maxUsesRaw) : 1;

    const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000);
    const sponsor = await resolveSponsor(room);

    if (paymentMode === "SPONSORED_BY_HOST") {
      return errorJson("invite.error.sponsored_checkout_required", 409, locale, {
        code: "SPONSORED_CHECKOUT_REQUIRED"
      });
    }

    const created = [];

    for (const email of emails) {
      const { raw, hash } = randomToken();
      const invite = await prisma.invite.create({
        data: {
          roomId: room.id,
          inviterId: auth.userId,
          inviteeEmail: email,
          tokenHash: hash,
          status: "SENT",
          relationshipType: relationshipType || undefined,
          paymentMode,
          sponsoredByUserId: sponsor.userId,
          sponsoredByOrgId: sponsor.orgId,
          expiresAt,
          maxUses,
          useCount: 0
        },
        select: {
          id: true,
          inviteeEmail: true,
          status: true,
          expiresAt: true,
          maxUses: true,
          useCount: true,
          relationshipType: true,
          paymentMode: true,
          createdAt: true
        }
      });

      created.push({ ...invite, token: raw });

      try {
        await sendInviteEmail({
          to: email,
          token: raw,
          roomTitle: room.title || serverT(locale, "rooms.fallback_title", undefined, "Room"),
          inviterName: auth.email || "SotsiaalAI",
          locale: mailLocale,
          template: "create"
        });
      } catch (mailError) {
        console.error("[invite email] failed", safeError(mailError));
      }
    }

    return ok({
      roomId: room.id,
      invites: created.map(({ token: _token, ...rest }) => rest)
    });
  } catch (error) {
    if (error?.status) {
      return errorJson(
        error.messageKey || "api.invites.create_failed",
        error.status,
        locale,
        {
          code: error.code
        }
      );
    }

    console.error("[invites POST] failed", safeError(error));
    return errorJson("api.invites.create_failed", 500, locale, {
      code: "INVITES_CREATE_FAILED"
    });
  }
}
