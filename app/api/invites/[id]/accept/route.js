import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { getRolePlanKey, normalizeSubscriptionRole } from "@/lib/subscriptionPlans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_ACCEPT = 20;
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

async function hasActiveSubscriptionTx(tx, userId) {
  if (!userId) return false;
  const now = new Date();
  const sub = await tx.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ validUntil: null }, { validUntil: { gt: now } }]
    },
    select: { id: true }
  });
  return Boolean(sub);
}

async function hasSponsorCapacity(tx, roomId) {
  const count = await tx.roomMember.count({
    where: {
      roomId,
      billingSource: "SPONSORED_BY_HOST",
      leftAt: null
    }
  });
  return count < SPONSORED_MEMBER_LIMIT;
}

function addOneMonth(date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
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

  const tokenHash = hashToken(tokenRaw);

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

      if (!invite) {
        throw fail("api.invites.invite_not_found", 404, "INVITE_NOT_FOUND");
      }

      const now = new Date();
      if (invite.status === "PENDING_PAYMENT") {
        throw fail(
          "api.invites.invite_payment_pending",
          409,
          "INVITE_PAYMENT_PENDING"
        );
      }

      if (invite.status !== "SENT" || invite.expiresAt <= now) {
        throw fail("api.invites.invite_expired", 410, "INVITE_EXPIRED");
      }

      if (invite.useCount >= invite.maxUses) {
        throw fail("api.invites.invite_used", 410, "INVITE_EXHAUSTED");
      }

      if (invite.inviteeEmail) {
        const inviteEmail = invite.inviteeEmail.trim().toLowerCase();
        if (!userEmail || inviteEmail !== userEmail) {
          throw fail("api.invites.invite_email_mismatch", 403, "INVITE_EMAIL_MISMATCH");
        }
      }

      const existingMember = await tx.roomMember.findFirst({
        where: {
          roomId: invite.roomId,
          userId: auth.userId,
          leftAt: null
        },
        select: {
          billingSource: true
        }
      });
      if (existingMember) {
        return {
          ok: true,
          roomId: invite.roomId,
          billing_source: existingMember.billingSource || "SELF"
        };
      }

      const userActive =
        auth.role === "ADMIN" ? true : await hasActiveSubscriptionTx(tx, auth.userId);

      let billingSource = "SELF";
      let sponsorUserId = null;
      let sponsorOrgId = null;

      const inviteRole = invite.sponsoredRole
        ? normalizeSubscriptionRole(invite.sponsoredRole)
        : null;

      if (
        invite.paymentMode === "SPONSORED_BY_HOST" &&
        inviteRole &&
        !auth.isAdmin &&
        normalizeSubscriptionRole(auth.role) !== inviteRole
      ) {
        throw fail(
          "api.invites.invite_role_mismatch",
          409,
          "INVITE_ROLE_MISMATCH"
        );
      }

      if (!userActive) {
        if (invite.paymentMode === "SELF_PAID") {
          throw fail(
            "api.invites.subscription_required",
            402,
            "SUBSCRIPTION_REQUIRED"
          );
        }

        if (invite.paymentMode === "SPONSORED_BY_HOST") {
          if (!invite.sponsoredPaidAt) {
            throw fail(
              "api.invites.invite_payment_pending",
              409,
              "INVITE_PAYMENT_PENDING"
            );
          }

          const capacity = await hasSponsorCapacity(tx, invite.roomId);
          if (!capacity) {
            throw fail(
              "invite.error.sponsor_capacity_full",
              409,
              "SPONSOR_CAPACITY_FULL"
            );
          }

          billingSource = "SPONSORED_BY_HOST";
          sponsorUserId = invite.sponsoredByUserId || invite.room?.ownerId;
          sponsorOrgId = invite.sponsoredByOrgId || null;

          const existingSubscription = await tx.subscription.findFirst({
            where: { userId: auth.userId },
            orderBy: [{ updatedAt: "desc" }]
          });
          const validUntil = addOneMonth(now);
          const plan =
            invite.sponsoredPlan ||
            getRolePlanKey(inviteRole || normalizeSubscriptionRole(auth.role));

          if (existingSubscription) {
            await tx.subscription.update({
              where: { id: existingSubscription.id },
              data: {
                status: "ACTIVE",
                plan,
                billingSource: "SPONSORED_BY_HOST",
                sponsorUserId,
                inviteId: invite.id,
                validUntil,
                nextBilling: null,
                canceledAt: null
              }
            });
          } else {
            await tx.subscription.create({
              data: {
                userId: auth.userId,
                status: "ACTIVE",
                plan,
                billingSource: "SPONSORED_BY_HOST",
                sponsorUserId,
                inviteId: invite.id,
                validUntil,
                nextBilling: null
              }
            });
          }
        }
      }

      await tx.roomMember.upsert({
        where: {
          roomId_userId: {
            roomId: invite.roomId,
            userId: auth.userId
          }
        },
        create: {
          roomId: invite.roomId,
          userId: auth.userId,
          role: "MEMBER",
          displayName: displayName || undefined,
          billingSource,
          sponsorUserId,
          sponsorOrgId,
          joinedAt: now
        },
        update: {
          leftAt: null,
          billingSource,
          sponsorUserId,
          sponsorOrgId,
          ...(displayName ? { displayName } : {})
        }
      });

      const nextUseCount = invite.useCount + 1;
      await tx.invite.update({
        where: { id: invite.id },
        data: {
          useCount: nextUseCount,
          status: nextUseCount >= invite.maxUses ? "ACCEPTED" : "SENT",
          acceptedBillingSource: billingSource,
          acceptedByUserId: auth.userId
        }
      });

      return {
        ok: true,
        roomId: invite.roomId,
        billing_source: billingSource
      };
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
