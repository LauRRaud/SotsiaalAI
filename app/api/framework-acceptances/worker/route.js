export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Role } from "@/generated/prisma/client";
import { authConfig } from "@/auth";
import {
  createOrGetCurrentWorkerFrameworkAcceptance,
  getCurrentWorkerFrameworkAcceptanceStatus,
  serializeFrameworkAcceptanceStatus
} from "@/lib/frameworkAcceptances/server";
import { isFrameworkAcceptanceSchemaError } from "@/lib/frameworkAcceptanceCompat";
import { normalizeOptionalTimestamp } from "@/lib/frameworkAcceptances";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";
import { getRequestIpFromRequest } from "@/lib/request-ip";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(payload = {}, status = 200) {
  return NextResponse.json(
    {
      ok: status < 400,
      ...payload
    },
    {
      status,
      headers: NO_STORE_HEADERS
    }
  );
}

function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json(
    {
      messageKey,
      message: translated,
      error: translated,
      ...extras
    },
    status
  );
}

function localeFromRequest(request, bodyLocale) {
  const direct = normalizeServerLocale(bodyLocale);
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

async function getCurrentUser(session) {
  const userId = session?.user?.id;
  if (!userId) return null;

  return prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      id: true,
      email: true,
      role: true,
      isAdmin: true
    }
  });
}

function isWorkerEligible(user) {
  return Boolean(
    user &&
      (user.role === Role.SOCIAL_WORKER ||
        user.role === Role.SERVICE_PROVIDER ||
        user.isAdmin === true)
  );
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const session = await getServerSession(authConfig).catch(() => null);
  const user = await getCurrentUser(session);

  if (!user) {
    return json({
      authenticated: false,
      eligible: false,
      acceptance: serializeFrameworkAcceptanceStatus(null)
    });
  }

  if (!isWorkerEligible(user)) {
    return json({
      authenticated: true,
      eligible: false,
      acceptance: serializeFrameworkAcceptanceStatus(null)
    });
  }

  try {
    const acceptance = await getCurrentWorkerFrameworkAcceptanceStatus(user.id);
    return json({
      authenticated: true,
      eligible: true,
      acceptance
    });
  } catch (error) {
    if (isFrameworkAcceptanceSchemaError(error)) {
      return json({
        authenticated: true,
        eligible: true,
        acceptance: serializeFrameworkAcceptanceStatus(null),
        schemaMissing: true
      });
    }
    console.error("[framework-acceptance] status failed", error);
    return errorJson("documents.framework_acceptance.load_failed", 500, locale);
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale);
  const session = await getServerSession(authConfig).catch(() => null);
  const user = await getCurrentUser(session);

  if (!user) {
    return errorJson("api.common.unauthorized", 401, locale);
  }

  if (!isWorkerEligible(user)) {
    return errorJson("documents.framework_acceptance.worker_only", 403, locale);
  }

  try {
    const reviewDocumentOpenedAt = normalizeOptionalTimestamp(body?.frameworkReviewOpenedAt);
    const signedDocumentDownloadedAt = normalizeOptionalTimestamp(body?.frameworkSignedDownloadedAt);
    const ipAddress = getRequestIpFromRequest(request);
    const userAgent = String(request.headers.get("user-agent") || "").trim() || null;

    const result = await createOrGetCurrentWorkerFrameworkAcceptance({
      user,
      locale,
      ipAddress,
      userAgent,
      reviewDocumentOpenedAt,
      signedDocumentDownloadedAt
    });

    return json(
      {
        created: result.created,
        acceptance: serializeFrameworkAcceptanceStatus(result.acceptance)
      },
      result.created ? 201 : 200
    );
  } catch (error) {
    if (isFrameworkAcceptanceSchemaError(error)) {
      return errorJson("documents.framework_acceptance.save_failed", 503, locale, {
        schemaMissing: true
      });
    }
    console.error("[framework-acceptance] create failed", error);
    return errorJson("documents.framework_acceptance.save_failed", 500, locale);
  }
}
