export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { ADMIN_VIEW_ROLE_COOKIE, normalizeAdminViewRole } from "@/lib/adminViewRole";
import { isAdmin } from "@/lib/authz";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";

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

function localeFromRequest(request) {
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

function applyRoleCookie(response, viewRole) {
  const normalized = normalizeAdminViewRole(viewRole);
  const cookieOptions = {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30
  };

  if (normalized) {
    response.cookies.set(ADMIN_VIEW_ROLE_COOKIE, normalized, cookieOptions);
    return response;
  }

  response.cookies.set(ADMIN_VIEW_ROLE_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0
  });
  return response;
}

export async function PUT(request) {
  const locale = localeFromRequest(request);
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id) {
    return errorJson("api.common.unauthorized", 401, locale);
  }
  if (!isAdmin(session.user)) {
    return errorJson("api.common.forbidden", 403, locale);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorJson("documents.errors.invalid_payload", 400, locale);
  }

  const requestedViewRole =
    body?.viewRole == null || body?.viewRole === ""
      ? null
      : normalizeAdminViewRole(body.viewRole);

  if (body?.viewRole != null && body?.viewRole !== "" && !requestedViewRole) {
    return errorJson("documents.errors.invalid_payload", 400, locale);
  }

  const response = json({
    ok: true,
    user: {
      role: "ADMIN",
      effectiveRole: requestedViewRole || "SOCIAL_WORKER",
      adminViewRole: requestedViewRole,
      isAdmin: true,
      isRoleViewActive: Boolean(requestedViewRole)
    }
  });

  return applyRoleCookie(response, requestedViewRole);
}
