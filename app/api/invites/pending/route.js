import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { acceptInviteWithinTx } from "@/lib/invites/acceptInviteCore";
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

async function requireVerifiedUser() {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) return { auth: null, reason: "unauthorized" };

    const row = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, emailVerified: true }
    });

    const email = String(session.user.email || row?.email || "")
      .trim()
      .toLowerCase();

    const auth = {
      userId: session.user.id,
      role: session.user.role,
      isAdmin: Boolean(session.user.isAdmin),
      email
    };

    // Kinnitatud e-post = e-posti omandi tõend. See ASENDAB meililingi
    // tokeni turvarolli id-põhisel rajal — ilma selleta saaks keegi
    // registreeruda võõra e-postiga ja haarata sponsoreeritud kutse.
    if (!row?.emailVerified) return { auth, reason: "email_unverified" };
    if (!email) return { auth, reason: "email_unverified" };

    return { auth, reason: null };
  } catch {
    return { auth: null, reason: "unauthorized" };
  }
}

/*
  Ootel kutse = sihitud (inviteeEmail seatud), sponsori poolt makstud,
  SENT, kehtiv, kasutamata. Ainult need, mille vastuvõtt aktiveerib kohe
  tellimuse — nii jääb bänneri lubadus ("liitu ja aktiveeri") ausaks.
  SELF_PAID kutseid siin ei kuvata (need eeldavad kasutaja oma tellimust).
*/
async function findPendingInvitesForEmail(email) {
  const now = new Date();
  const candidates = await prisma.invite.findMany({
    where: {
      inviteeEmail: email,
      status: "SENT",
      paymentMode: "SPONSORED_BY_HOST",
      sponsoredPaidAt: { not: null },
      expiresAt: { gt: now }
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      maxUses: true,
      useCount: true,
      expiresAt: true,
      paymentMode: true,
      room: { select: { id: true, title: true } }
    }
  });

  return candidates
    .filter((invite) => invite.useCount < invite.maxUses)
    .map((invite) => ({
      id: invite.id,
      roomId: invite.room?.id || null,
      roomTitle: invite.room?.title || "",
      paymentMode: invite.paymentMode,
      expiresAt: invite.expiresAt
    }));
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const { auth, reason } = await requireVerifiedUser();

  if (!auth) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  // Kinnitamata e-post: ei paljasta kutseid, aga anna ausalt teada seis
  // (klient võib kuvada "kinnita enne e-post"). Mitte viga — tühi nimekiri.
  if (reason === "email_unverified") {
    return json({ ok: true, emailVerified: false, invites: [] });
  }

  try {
    const invites = await findPendingInvitesForEmail(auth.email);
    return json({ ok: true, emailVerified: true, invites });
  } catch (error) {
    console.error("[invites pending GET] failed", safeError(error));
    return errorJson("api.invites.load_failed", 500, locale, {
      code: "INVITES_LOAD_FAILED"
    });
  }
}

export async function POST(request) {
  let payload = {};
  try {
    payload = await request.json();
  } catch {
    // empty payload is allowed
  }

  const locale = localeFromRequest(request, payload?.locale || payload?.lang);
  const { auth, reason } = await requireVerifiedUser();

  if (!auth) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  if (reason === "email_unverified") {
    return errorJson("api.invites.email_unverified", 403, locale, {
      code: "EMAIL_UNVERIFIED"
    });
  }

  const inviteId = String(payload?.id ?? payload?.invite_id ?? payload?.inviteId ?? "").trim();
  if (!inviteId) {
    return errorJson("api.common.invalid_request", 400, locale, {
      code: "MISSING_INVITE_ID"
    });
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT 1 FROM "Invite"
        WHERE "id" = ${inviteId}
        FOR UPDATE
      `;

      const invite = await tx.invite.findUnique({
        where: { id: inviteId },
        include: { room: true }
      });

      if (!invite) {
        const err = new Error("api.invites.invite_not_found");
        err.status = 404;
        err.messageKey = "api.invites.invite_not_found";
        err.code = "INVITE_NOT_FOUND";
        throw err;
      }

      // Id-põhine rada NÕUAB sihitud kutset + täpset e-posti ühtimist.
      // Avatud (inviteeEmail == null) kutset ei tohi id järgi vastu võtta —
      // muidu saaks id-d ära arvata. acceptInviteWithinTx kontrollib
      // ühtimist ainult siis, kui inviteeEmail on seatud, seega väravame
      // siin selgelt.
      if (!invite.inviteeEmail) {
        const err = new Error("api.invites.invite_email_mismatch");
        err.status = 403;
        err.messageKey = "api.invites.invite_email_mismatch";
        err.code = "INVITE_EMAIL_MISMATCH";
        throw err;
      }

      return acceptInviteWithinTx({
        tx,
        invite,
        auth,
        userEmail: auth.email,
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

    console.error("[invites pending POST] failed", safeError(error));
    return errorJson("api.invites.accept_failed", 500, locale, {
      code: "INVITE_ACCEPT_FAILED"
    });
  }
}
