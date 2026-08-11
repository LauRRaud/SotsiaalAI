import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { deliverInviteEmail } from "@/lib/invites/inviteEmailDelivery";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import {
  canInviteRelationshipType,
  normalizeInviteRelationshipType
} from "@/lib/invites/participantTypes";
import { requireInviteRoomRole } from "@/lib/invites/roomAccess";

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

/* SOL-INV-02: ruumivärav elab nüüd ÜHES kohas (`lib/invites/roomAccess.js`) ja
   ta ei kirjuta enne autoriseerimist mitte midagi. Siin seisis tema koopia,
   teine elas `app/api/invites/sponsored/init`-is. */
function requireRoomRole(args) {
  return requireInviteRoomRole({ db: prisma, ...args });
}

async function resolveSponsor(room) {
  return {
    userId: room.ownerId,
    orgId: null
  };
}

/* SOL-INV-03: kirja EHITAMINE ja SAATMINE kolisid `lib/invites/inviteEmailDelivery.js`-i,
   sisu renderdus `lib/payments/emailOutbox.js`-i. Siin seisis oma teostus, mis
   neelas vea logisse ja jättis vastuse ausalt ütlemata, kas kiri läks. */

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
      // E4 (audit kutseõigus): AINULT ruumi omanik kutsub. MODERATOR/MEMBER
      // saab 403 — sponsoreeritud kasutus käib sponsori Subscription'i kaudu
      // (audit 20.4: liikmesuse sponsor-väljad on informatiivsed, mitte õigusi andvad).
      allowedRoles: ["OWNER"],
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

  const relationshipValue = payload?.relationship_type ?? payload?.relationshipType;
  const relationshipType = normalizeInviteRelationshipType(relationshipValue);
  if (relationshipValue != null && !relationshipType) {
    return errorJson("invite.error.relationship_required", 400, locale, {
      code: "INVALID_RELATIONSHIP_TYPE"
    });
  }
  if (relationshipType && !canInviteRelationshipType(auth.role, relationshipType)) {
    return errorJson("invite.error.relationship_not_allowed", 403, locale, {
      code: "RELATIONSHIP_NOT_ALLOWED"
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
      // E4 (audit kutseõigus): AINULT ruumi omanik kutsub. MODERATOR/MEMBER
      // saab 403 — sponsoreeritud kasutus käib sponsori Subscription'i kaudu
      // (audit 20.4: liikmesuse sponsor-väljad on informatiivsed, mitte õigusi andvad).
      allowedRoles: ["OWNER"],
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

      /* SOL-INV-03: iga adressaadi tulemus öeldakse VÄLJA. Vana kood neelas
         mailer'i vea logisse ja vastas kõigi kohta ühetaoliselt „loodud" —
         mitmest aadressist võisid mõned kirjad kohale jõuda ja teised mitte. */
      const emailDelivery = await deliverInviteEmail({
        db: prisma,
        kind: "create",
        inviteId: invite.id,
        toEmail: email,
        tokenRaw: raw,
        tokenHash: hash,
        roomTitle: room.title || serverT(locale, "rooms.fallback_title", undefined, "Room"),
        inviterName: auth.email || "SotsiaalAI",
        locale: mailLocale
      });

      created.push({ ...invite, emailDelivery });
    }

    return ok({
      roomId: room.id,
      invites: created,
      // Kokkuvõte kliendile: kas mõni adressaat vajab tähelepanu.
      emailDeliveryPending: created.filter(entry => entry.emailDelivery !== "sent").length
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
