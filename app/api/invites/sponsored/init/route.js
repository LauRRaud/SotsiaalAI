import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { PaymentProvider, PaymentStatus } from "@/generated/prisma/client";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import {
  createMaksekeskusCheckout,
  makeProviderPaymentId
} from "@/lib/payments/maksekeskus";
import { getInviteSponsoredPaymentKind } from "@/lib/payments/recurring";
import { ROOM_ORIGIN_TYPES, buildRoomOrigin } from "@/lib/rooms/origin";
import {
  formatEuroAmount,
  getRolePlanDescription,
  getRolePlanKey,
  getSponsoredInviteAmount,
  normalizeSubscriptionRole
} from "@/lib/subscriptionPlans";
import { isSubscriptionActive } from "@/lib/subscriptionStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_INVITES = 10;
const SPONSORED_MEMBER_LIMIT = 50;
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
  const list = Array.isArray(emails) ? emails : String(emails).split(/[,;\n\r]/);

  return [
    ...new Set(
      list
        .map((email) => String(email || "").trim().toLowerCase())
        .filter(Boolean)
    )
  ];
}

function normalizeDisplayName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 80);
}

function isTruthyFlag(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
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
  } catch {}
}

async function ensureRoom(userId, roomId, roomTitle, ownerDisplayName, locale) {
  if (roomId) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw fail("api.rooms.not_found", 404, "ROOM_NOT_FOUND");
    }
    await ensureOwnerMembership(room.id, room.ownerId, ownerDisplayName);
    return {
      room,
      created: false
    };
  }

  const trimmedTitle = typeof roomTitle === "string" ? roomTitle.trim() : "";
  if (trimmedTitle) {
    const room = await prisma.room.create({
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
    return {
      room,
      created: true
    };
  }

  const existing = await prisma.room.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" }
  });
  if (existing) {
    await ensureOwnerMembership(existing.id, existing.ownerId, ownerDisplayName);
    return {
      room: existing,
      created: false
    };
  }

  const fallbackTitle = serverT(locale, "rooms.fallback_title", undefined, "Room");
  const room = await prisma.room.create({
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
  return {
    room,
    created: true
  };
}

async function requireRoomRole({
  userId,
  roomId,
  allowedRoles,
  roomTitle,
  ownerDisplayName,
  locale
}) {
  const roomResult = await ensureRoom(
    userId,
    roomId,
    roomTitle,
    ownerDisplayName,
    locale
  );
  const room = roomResult.room;

  if (room.ownerId === userId) {
    return {
      room,
      membership: { role: "OWNER" },
      roomCreated: roomResult.created
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

  return {
    room,
    membership,
    roomCreated: roomResult.created
  };
}

async function hasActiveSubscription(userId) {
  if (!userId) return false;
  const now = new Date();
  const active = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ validUntil: null }, { validUntil: { gt: now } }]
    },
    select: { id: true }
  });
  return Boolean(active);
}

async function inviteeHasActiveSubscription(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return false;

  const invitee = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive"
      }
    },
    select: {
      subscriptions: {
        orderBy: [{ updatedAt: "desc" }],
        take: 5,
        select: {
          status: true,
          validUntil: true
        }
      }
    }
  });

  return Boolean(
    invitee?.subscriptions?.some((subscription) => isSubscriptionActive(subscription))
  );
}

async function hasSponsorCapacity(roomId) {
  const count = await prisma.roomMember.count({
    where: {
      roomId,
      billingSource: "SPONSORED_BY_HOST",
      leftAt: null
    }
  });
  return count < SPONSORED_MEMBER_LIMIT;
}

function resolveUrl(request, envValue, fallbackPath) {
  const direct = String(envValue || "").trim();
  if (direct) {
    try {
      return new URL(direct).toString();
    } catch {}
  }

  try {
    return new URL(fallbackPath, request.url).toString();
  } catch {
    return "";
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
    `invites:sponsored:init:${auth.userId}:${ip}`,
    RATE_LIMIT_INVITES,
    RATE_LIMIT_WINDOW_MS
  );
  if (!limit.allowed) {
    return errorJson("invite.error.rate_limited", 429, locale, {
      code: "RATE_LIMITED"
    });
  }

  const emails = normalizeEmails(payload?.emails);
  if (emails.length !== 1) {
    return errorJson("invite.error.sponsored_single_email_required", 400, locale, {
      code: "SPONSORED_SINGLE_EMAIL_REQUIRED"
    });
  }

  const targetRole = normalizeSubscriptionRole(payload?.targetRole);
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

  if (!isTruthyFlag(payload?.acceptedTerms)) {
    return errorJson("invite.error.checkout_terms_required", 400, locale, {
      code: "CHECKOUT_TERMS_REQUIRED"
    });
  }

  try {
    const sponsorHasPlan = auth.isAdmin ? true : await hasActiveSubscription(auth.userId);
    if (!sponsorHasPlan) {
      return errorJson("invite.error.sponsor_plan_required", 409, locale, {
        code: "SPONSOR_PLAN_REQUIRED"
      });
    }

    if (await inviteeHasActiveSubscription(emails[0])) {
      return errorJson("invite.error.invitee_active_subscription", 409, locale, {
        code: "INVITEE_ACTIVE_SUBSCRIPTION"
      });
    }

    const roomCheck = await requireRoomRole({
      userId: auth.userId,
      roomId: roomId || undefined,
      roomTitle,
      ownerDisplayName: hostDisplayName,
      allowedRoles: ["OWNER", "MODERATOR"],
      locale
    });

    if (hostDisplayName) {
      await prisma.roomMember.upsert({
        where: {
          roomId_userId: {
            roomId: roomCheck.room.id,
            userId: auth.userId
          }
        },
        create: {
          roomId: roomCheck.room.id,
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

    const hasCapacity = await hasSponsorCapacity(roomCheck.room.id);
    if (!hasCapacity) {
      return errorJson("invite.error.sponsor_capacity_full", 409, locale, {
        code: "SPONSOR_CAPACITY_FULL"
      });
    }

    const plan = getRolePlanKey(targetRole);
    const amount = getSponsoredInviteAmount(targetRole).toFixed(2);
    const currency = String(process.env.SUBSCRIPTION_CURRENCY || "EUR")
      .trim()
      .toUpperCase();
    const { hash } = randomToken();
    const expiresAt = new Date(
      Date.now() +
        Math.max(
          1,
          Number(payload?.expires_in_hours ?? payload?.expiresInHours ?? 168)
        ) *
          3600 *
          1000
    );

    const invite = await prisma.invite.create({
      data: {
        roomId: roomCheck.room.id,
        inviterId: auth.userId,
        inviteeEmail: emails[0],
        tokenHash: hash,
        status: "PENDING_PAYMENT",
        paymentMode: "SPONSORED_BY_HOST",
        sponsoredByUserId: auth.userId,
        sponsoredRole: targetRole,
        sponsoredPlan: plan,
        expiresAt,
        maxUses: 1
      },
      select: {
        id: true,
        roomId: true
      }
    });

    let paymentRecord = null;

    try {
      const providerPaymentId = makeProviderPaymentId(auth.userId);
      paymentRecord = await prisma.payment.create({
        data: {
          subscriptionId: null,
          inviteId: invite.id,
          userId: auth.userId,
          provider: PaymentProvider.MAKSEKESKUS,
          kind: getInviteSponsoredPaymentKind(),
          providerPaymentId,
          amount,
          currency,
          status: PaymentStatus.INITIATED,
          raw: {
            flow: "invite_sponsored_init",
            inviteId: invite.id,
            inviteeEmail: emails[0],
            targetRole,
            amount,
            oneMonthOnly: true,
            locale,
            checkoutConsent: true
          }
        },
        select: {
          id: true,
          providerPaymentId: true
        }
      });

      const returnUrl = resolveUrl(
        request,
        process.env.MAKSEKESKUS_SPONSORED_INVITE_RETURN_URL,
        `/api/invites/sponsored/callback?inviteId=${encodeURIComponent(invite.id)}&roomId=${encodeURIComponent(invite.roomId)}`
      );
      const cancelUrl = resolveUrl(
        request,
        process.env.MAKSEKESKUS_SPONSORED_INVITE_CANCEL_URL,
        `/api/invites/sponsored/callback?inviteId=${encodeURIComponent(invite.id)}&roomId=${encodeURIComponent(invite.roomId)}`
      );
      const webhookUrl = resolveUrl(
        request,
        process.env.MAKSEKESKUS_WEBHOOK_URL,
        "/api/subscription/webhook"
      );

      const checkout = await createMaksekeskusCheckout({
        providerPaymentId,
        amount,
        currency,
        locale,
        returnUrl,
        cancelUrl,
        webhookUrl,
        customerEmail: auth.email,
        description: getRolePlanDescription(targetRole, locale),
        merchantData: {
          flow: "invite_sponsored_init",
          paymentId: paymentRecord.id,
          inviteId: invite.id,
          roomId: invite.roomId,
          targetRole,
        },
        ip,
      });

      const finalProviderPaymentId =
        checkout.providerPaymentId || providerPaymentId;

      await prisma.payment.update({
        where: { id: paymentRecord.id },
        data: {
          providerPaymentId: finalProviderPaymentId,
          raw: {
            flow: "invite_sponsored_init",
            inviteId: invite.id,
            inviteeEmail: emails[0],
            targetRole,
            amount,
            oneMonthOnly: true,
            locale,
            checkoutConsent: true,
            checkout: checkout.raw || null
          }
        }
      });

      return ok({
        inviteId: invite.id,
        roomId: invite.roomId,
        checkoutUrl: checkout.checkoutUrl,
        targetRole,
        amount,
        amountLabel: formatEuroAmount(Number(amount), locale),
        plan
      });
    } catch (error) {
      if (paymentRecord?.id) {
        try {
          await prisma.payment.update({
            where: { id: paymentRecord.id },
            data: {
              status: PaymentStatus.FAILED,
              raw: {
                flow: "invite_sponsored_init",
                inviteId: invite.id,
                error: error?.message || "checkout_create_failed"
              }
            }
          });
        } catch {}
      }

      await prisma.invite.update({
        where: { id: invite.id },
        data: {
          status: "REVOKED"
        }
      });

      if (roomCheck.roomCreated) {
        try {
          await prisma.room.delete({
            where: { id: roomCheck.room.id }
          });
        } catch {}
      }

      throw error;
    }
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

    console.error("[invites sponsored init] failed", safeError(error));
    return errorJson("api.subscription.checkout_create_failed", 500, locale, {
      code: "SPONSORED_INVITE_INIT_FAILED"
    });
  }
}
