import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import {
  DangerousActionError,
  executeResetAction,
  previewResetAction
} from "@/lib/admin/dangerousAnalyticsActions";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}

function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
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

export async function POST(req) {
  const locale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const result = dryRun
      ? await previewResetAction({ db: prisma, body })
      : await executeResetAction({
          db: prisma,
          body,
          actorUserId: session.user.id,
          request: req
        });
    return json({ ok: true, dryRun, ...result });
  } catch (error) {
    if (error instanceof DangerousActionError) {
      return errorJson(error.messageKey, error.status, locale, { debugCode: error.code });
    }
    console.error("admin analytics reset POST failed", error);
    return errorJson("api.admin.analytics.reset_failed", 500, locale, {
      debugCode: "ADMIN_ANALYTICS_RESET_POST_FAILED"
    });
  }
}
