import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { isFrameworkAcceptanceSchemaError } from "@/lib/frameworkAcceptanceCompat";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;
const DEFAULT_PERIOD_DAYS = 365;
const MAX_PERIOD_DAYS = 3650;

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

function normalizeString(value) {
  return String(value || "").trim();
}

function serializeAcceptance(row) {
  return {
    id: row.id,
    userId: row.userId,
    userEmail: row.user?.email || null,
    roleAtAcceptance: row.roleAtAcceptance,
    frameworkKey: row.frameworkKey,
    frameworkVersion: row.frameworkVersion,
    acceptanceType: row.acceptanceType,
    acceptanceSource: row.acceptanceSource,
    locale: row.locale,
    acceptedAt: row.acceptedAt?.toISOString?.() || null,
    reviewDocumentOpenedAt: row.reviewDocumentOpenedAt?.toISOString?.() || null,
    signedDocumentDownloadedAt: row.signedDocumentDownloadedAt?.toISOString?.() || null,
    document: row.document
      ? {
          id: row.document.id,
          title: row.document.title,
          createdAt: row.document.createdAt?.toISOString?.() || null
        }
      : null
  };
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
    const q = normalizeString(params.get("q"));
    const frameworkKey = normalizeString(params.get("frameworkKey"));
    const daysRaw = Number(params.get("days"));
    const limitRaw = Number(params.get("limit"));
    const offsetRaw = Number(params.get("offset"));

    const periodDays = Math.min(
      MAX_PERIOD_DAYS,
      Math.max(1, Number.isFinite(daysRaw) ? daysRaw : DEFAULT_PERIOD_DAYS)
    );
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT));
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const where = {
      acceptedAt: { gte: since },
      ...(frameworkKey ? { frameworkKey } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q, mode: "insensitive" } },
              { frameworkKey: { contains: q, mode: "insensitive" } },
              { frameworkVersion: { contains: q, mode: "insensitive" } },
              { acceptanceType: { contains: q, mode: "insensitive" } },
              { acceptanceSource: { contains: q, mode: "insensitive" } },
              { userId: { contains: q, mode: "insensitive" } },
              { user: { email: { contains: q, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    const [total, signedDownloads, items] = await Promise.all([
      prisma.frameworkAcceptance.count({ where }),
      prisma.frameworkAcceptance.count({
        where: {
          ...where,
          signedDocumentDownloadedAt: { not: null }
        }
      }),
      prisma.frameworkAcceptance.findMany({
        where,
        orderBy: [{ acceptedAt: "desc" }, { createdAt: "desc" }],
        skip: offset,
        take: limit,
        select: {
          id: true,
          userId: true,
          frameworkKey: true,
          frameworkVersion: true,
          acceptanceType: true,
          acceptanceSource: true,
          roleAtAcceptance: true,
          locale: true,
          acceptedAt: true,
          reviewDocumentOpenedAt: true,
          signedDocumentDownloadedAt: true,
          createdAt: true,
          user: {
            select: {
              email: true
            }
          },
          document: {
            select: {
              id: true,
              title: true,
              createdAt: true
            }
          }
        }
      })
    ]);

    return json({
      ok: true,
      total,
      signedDownloads,
      offset,
      limit,
      periodDays,
      hasMore: offset + items.length < total,
      items: items.map(serializeAcceptance)
    });
  } catch (error) {
    if (isFrameworkAcceptanceSchemaError(error)) {
      return json({
        ok: true,
        total: 0,
        signedDownloads: 0,
        offset: 0,
        limit: DEFAULT_LIMIT,
        periodDays: DEFAULT_PERIOD_DAYS,
        hasMore: false,
        items: [],
        schemaMissing: true
      });
    }
    console.error("admin framework acceptances GET failed", error);
    return errorJson("api.admin.analytics.summary_load_failed", 500, locale, {
      debug: process.env.NODE_ENV !== "production" ? String(error?.message || error) : undefined
    });
  }
}
