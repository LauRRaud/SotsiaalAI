import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";

function localeFromRequest(req) {
  const url = new URL(req.url);
  const fromQuery = normalizeServerLocale(url.searchParams.get("locale"));
  if (fromQuery) return fromQuery;

  const fromHeader =
    normalizeServerLocale(req.headers.get("x-ui-locale")) ||
    normalizeServerLocale(req.headers.get("x-locale")) ||
    normalizeServerLocale(req.headers.get("accept-language"));

  return fromHeader || "en";
}

export function json(data, status = 200, extraHeaders = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      ...extraHeaders
    }
  });
}

export function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json(
    {
      ok: false,
      messageKey,
      message: translated,
      ...extras
    },
    status
  );
}

export async function requireKovAdminSession(request) {
  const locale = localeFromRequest(request);
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);

  if (!authz.ok) {
    return {
      ok: false,
      locale,
      response: errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale)
    };
  }

  return {
    ok: true,
    locale,
    session
  };
}
