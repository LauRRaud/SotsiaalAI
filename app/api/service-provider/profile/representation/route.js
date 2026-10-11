import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { isAdmin, roleFromSession } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { isSameOriginRequest } from "@/lib/security/sameOriginRequest";
import { announceRepresentationConfirmed, announceRepresentationLinkSent } from "@/lib/serviceProviderProfileNotices";
import { consumeServiceProviderProfileRateLimit } from "@/lib/serviceProviderProfileBoundary";
import {
  RepresentationLinkError,
  confirmRepresentationByLink,
  describeRepresentationForOwner,
  describeRepresentationLink,
  requestRepresentationLink
} from "@/lib/serviceProviderRepresentation";
import { sendRepresentationLinkEmail } from "@/lib/serviceProviderRepresentationMail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* Teenuseprofiili esindusõiguse kinnituslink.
   GET   seis ja (lingiga tulles) kas link kehtib sellel kontol; midagi ei muuda.
   POST  { email }  saadab lingi asutuse e-postile, mis on äriregistris kirjas.
   PUT   { token }  kinnitab lingiga. Otsus on eraldi päring, mitte lingi avamine: postkasti
         turvakontroll ega eelvaade ei tohi kinnitust anda. */
const PUBLIC_KEYS = new Set(["api.common.unauthorized", ...Object.values(RepresentationLinkError)]);

async function requireProvider() {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return { ok: false, status: 401, message: "api.common.unauthorized" };
  if (!isAdmin(session.user) && roleFromSession(session) !== "SERVICE_PROVIDER") {
    return { ok: false, status: 403, message: "api.common.forbidden" };
  }
  return { ok: true, userId };
}

async function limited(operation, userId, locale) {
  const limit = await consumeServiceProviderProfileRateLimit({ operation, userId });
  if (limit.allowed) return null;
  return errorJson("api.common.rate_limited", 429, locale, { retryAfterSeconds: limit.retryAfterSeconds }, {
    "Retry-After": String(limit.retryAfterSeconds)
  });
}

function failure(error, fallbackKey, locale, tag) {
  if (PUBLIC_KEYS.has(error?.message)) {
    const status = Number(error?.status) || 400;
    return errorJson(error.message, status, locale, error?.details ? { details: error.details } : {});
  }
  console.error(`[service-provider-representation] ${tag} failed`, safeError(error));
  return errorJson(fallbackKey, 500, locale);
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const auth = await requireProvider();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);
  try {
    const blocked = await limited("profile:read", auth.userId, locale);
    if (blocked) return blocked;
    const token = new URL(request.url).searchParams.get("token") || "";
    const state = await describeRepresentationForOwner(auth.userId);
    const link = token ? await describeRepresentationLink({ ownerId: auth.userId, token }) : null;
    return json({ ok: true, state, link });
  } catch (error) {
    return failure(error, "service_provider_profile.errors.load_failed", locale, "load");
  }
}

export async function POST(request) {
  const locale = localeFromRequest(request);
  const auth = await requireProvider();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);
  if (!isSameOriginRequest(request)) return errorJson("api.common.forbidden", 403, locale);
  try {
    const blocked = await limited("representation:request", auth.userId, locale);
    if (blocked) return blocked;
    const body = await request.json().catch(() => ({}));
    const result = await requestRepresentationLink(
      { ownerId: auth.userId, email: body?.email, locale },
      { sendMail: sendRepresentationLinkEmail }
    );
    /* Konto omanik saab teate (platvormis ja e-kirjana), et kinnitus ootab asutuse postkastis. */
    await announceRepresentationLinkSent({ ownerId: auth.userId, sentAt: result.sentAt });
    return json({ ok: true, delivery: result.delivery, expiresAt: result.expiresAt });
  } catch (error) {
    return failure(error, RepresentationLinkError.MAIL_FAILED, locale, "request");
  }
}

export async function PUT(request) {
  const locale = localeFromRequest(request);
  const auth = await requireProvider();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);
  if (!isSameOriginRequest(request)) return errorJson("api.common.forbidden", 403, locale);
  try {
    const blocked = await limited("representation:confirm", auth.userId, locale);
    if (blocked) return blocked;
    const body = await request.json().catch(() => ({}));
    const result = await confirmRepresentationByLink({ ownerId: auth.userId, token: body?.token });
    await announceRepresentationConfirmed({ ownerId: auth.userId, method: result.method, confirmedAt: result.confirmedAt, locale });
    return json({ ok: true, state: result });
  } catch (error) {
    return failure(error, "service_provider_profile.errors.save_failed", locale, "confirm");
  }
}
