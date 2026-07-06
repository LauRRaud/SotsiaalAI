import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
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

export async function GET(req) {
  const locale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale);
  }

  try {
    const url = new URL(req.url);
    const params = url.searchParams;

    const limitRaw = Number(params.get("limit"));
    const offsetRaw = Number(params.get("offset"));
    const daysRaw = Number(params.get("days"));
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);
    const event = params.get("event") || undefined;
    const role = params.get("role") || undefined;
    const crisisParam = params.get("isCrisis");
    const sinceDays = Math.min(180, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 30));
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    const where = {
      createdAt: { gte: since }
    };

    if (event) where.event = event;
    if (role) where.role = role;
    if (crisisParam === "true" || crisisParam === "false") {
      where.data = {
        path: ["isCrisis"],
        equals: crisisParam === "true"
      };
    }

    const items = await prisma.chatLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        createdAt: true,
        event: true,
        role: true,
        userId: true,
        data: true
      }
    });

    return json({ ok: true, items });
  } catch {
    return errorJson("api.admin.analytics.events_load_failed", 500, locale, {
      debugCode: "ADMIN_ANALYTICS_EVENTS_GET_FAILED"
    });
  }
}

export async function DELETE(req) {
  const locale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const event = String(body?.event || "").trim();
    const crisisParam = String(body?.isCrisis || "all").trim().toLowerCase();
    const deleteAll = body?.all === true;

    if (!deleteAll && !event && crisisParam === "all") {
      return errorJson("api.admin.analytics.events_delete_invalid_payload", 400, locale);
    }

    const where = {};
    if (event) where.event = event;
    if (crisisParam === "true" || crisisParam === "false") {
      where.data = {
        path: ["isCrisis"],
        equals: crisisParam === "true"
      };
    }

    const result = await prisma.chatLog.deleteMany({ where });
    return json({
      ok: true,
      deletedCount: Number(result?.count || 0)
    });
  } catch (error) {
    console.error("admin analytics events DELETE failed", error);
    return errorJson("api.admin.analytics.events_delete_failed", 500, locale, {
      debugCode: "ADMIN_ANALYTICS_EVENTS_DELETE_FAILED"
    });
  }
}
