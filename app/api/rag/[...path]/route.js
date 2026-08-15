import { getServerSession } from "next-auth";
import { randomUUID } from "node:crypto";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";
import { writeDataAudit } from "@/lib/privacy/audit";
import {
  authorizeRagProxyAction,
  resolveRagProxyAction,
  validateRagMutationOrigin
} from "@/lib/rag/adminProxyPolicy";
import { executeAuditedRagOperation } from "@/lib/rag/adminProxyExecution";
import { isRagProxyBodyLimitError, limitRagProxyBody } from "@/lib/rag/proxyBodyLimit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { consumeRateLimit } from "@/lib/rate-limit";
import { RAG_SERVICE_KEY } from "@/lib/server/ragAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RAW_RAG_HOST = (process.env.RAG_INTERNAL_HOST || "127.0.0.1:8000").trim();
function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

const RAG_TIMEOUT_MS = readPositiveNumber(process.env.RAG_TIMEOUT_MS, 30_000);
const RAG_PROXY_MAX_BODY_BYTES = readPositiveNumber(
  process.env.RAG_REQUEST_MAX_BYTES,
  Math.ceil(readPositiveNumber(process.env.RAG_SERVER_MAX_MB, 20) * 1024 * 1024 * 4 / 3) + 1024 * 1024
);
const ALLOW_EXTERNAL = process.env.ALLOW_EXTERNAL_RAG === "1";
const RAG_PROXY_RATE_LIMIT_WINDOW_MS = readPositiveNumber(process.env.RAG_PROXY_RATE_LIMIT_WINDOW_MS, 60_000);
const RAG_PROXY_RATE_LIMIT_MAX = readPositiveNumber(process.env.RAG_PROXY_RATE_LIMIT_MAX, 120);

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade",
  "transfer-encoding"
]);

const SAFE_FORWARD_REQ_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "range",
  "if-none-match",
  "if-modified-since",
  "if-range"
];

function normalizeBaseFromHost(host) {
  const trimmed = String(host || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "http://127.0.0.1:8000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function isLocalHostHostPort(hostport) {
  return /^(127\.0\.0\.1|localhost|\[?::1\]?)(:\d+)?$/i.test(hostport || "");
}

function isLocalBaseUrl(url) {
  try {
    const parsed = new URL(url);
    return isLocalHostHostPort(parsed.host);
  } catch {
    return false;
  }
}

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

function errorJson(messageKey, status = 400, locale = "en", extras = {}, headers = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return new Response(
    JSON.stringify({
      ok: false,
      messageKey,
      message: translated,
      ...extras
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
        ...headers
      }
    }
  );
}

function buildTargetUrl(req, segmentsInput) {
  const incoming = new URL(req.url);
  const segments = Array.isArray(segmentsInput) ? [...segmentsInput] : [];
  if (segments[0] === "query") segments[0] = "search";
  const subPath = segments.map(segment => encodeURIComponent(segment)).join("/");
  const base = normalizeBaseFromHost(RAW_RAG_HOST).replace(/\/+$/, "");
  const path = (`/${subPath}`).replace(/\/{2,}/g, "/");
  return `${base}${path}${incoming.search}`;
}

function requestHasBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return false;
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) === 0) return false;
  return true;
}

async function proxy(req, ctx = {}) {
  const locale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale);
  }

  const userId = session?.user?.id || "anonymous";
  const ip = getRequestIpFromRequest(req);
  const limit = consumeRateLimit(
    `rag-proxy:${userId}:${ip}`,
    RAG_PROXY_RATE_LIMIT_MAX,
    RAG_PROXY_RATE_LIMIT_WINDOW_MS
  );

  if (!limit.allowed) {
    return errorJson(
      "api.rag.rate_limited",
      429,
      locale,
      { retryAfterSec: limit.retryAfterSec },
      { "Retry-After": String(limit.retryAfterSec) }
    );
  }

  let resolvedParams = ctx?.params;
  if (resolvedParams && typeof resolvedParams.then === "function") {
    resolvedParams = await resolvedParams;
  }

  const paramSegments = Array.isArray(resolvedParams?.path) ? resolvedParams.path : [];
  const proxyAction = resolveRagProxyAction(req.method, paramSegments);
  if (!proxyAction) {
    return errorJson("api.common.not_found", 404, locale);
  }

  let ragAdminCapability = "NONE";
  try {
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { ragAdminCapability: true }
    });
    ragAdminCapability = actor?.ragAdminCapability || "NONE";
  } catch {
    return errorJson("api.rag.capability_check_failed", 500, locale, {
      debugCode: "RAG_PROXY_CAPABILITY_CHECK_FAILED"
    });
  }

  if (!authorizeRagProxyAction(ragAdminCapability, proxyAction)) {
    return errorJson("api.common.forbidden", 403, locale);
  }
  if (!validateRagMutationOrigin({
    method: req.method,
    url: req.url,
    origin: req.headers.get("origin")
  })) {
    return errorJson("api.common.forbidden", 403, locale, {
      debugCode: "RAG_PROXY_ORIGIN_REQUIRED"
    });
  }

  const declaredBodyBytes = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredBodyBytes) && declaredBodyBytes > RAG_PROXY_MAX_BODY_BYTES) {
    return errorJson("api.rag.request_too_large", 413, locale, {
      debugCode: "RAG_PROXY_REQUEST_TOO_LARGE"
    });
  }

  if (!RAG_SERVICE_KEY) {
    return errorJson("api.rag.service_key_missing", 500, locale, {
      debugCode: "RAG_PROXY_KEY_MISSING"
    });
  }

  const base = normalizeBaseFromHost(RAW_RAG_HOST);
  if (!ALLOW_EXTERNAL && !isLocalBaseUrl(base)) {
    return errorJson("api.rag.external_host_not_allowed", 503, locale, {
      debugCode: "RAG_PROXY_EXTERNAL_HOST_BLOCKED"
    });
  }

  const target = buildTargetUrl(req, paramSegments);
  const operationId = randomUUID();
  const auditBase = {
    actorUserId: userId,
    action: "rag_proxy_operation_started",
    resourceType: "RagDocument",
    resourceId: proxyAction.targetDocumentId || proxyAction.path,
    ipAddress: ip,
    userAgent: req.headers.get("user-agent"),
    meta: {
      operationId,
      operation: proxyAction.name,
      method: proxyAction.method,
      path: proxyAction.path,
      requiredCapability: proxyAction.requiredCapability,
      actorCapability: ragAdminCapability,
      outcome: "started"
    }
  };
  const headers = new Headers();
  headers.set("X-API-Key", RAG_SERVICE_KEY);

  for (const name of SAFE_FORWARD_REQ_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const body = requestHasBody(req) ? limitRagProxyBody(req.body, RAG_PROXY_MAX_BODY_BYTES) : undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);

  let res;
  try {
    res = await executeAuditedRagOperation({
      auditBase,
      writeAudit: writeDataAudit,
      fetchUpstream: () => fetch(target, {
        method: req.method,
        headers,
        body,
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
        ...(body ? { duplex: "half" } : {})
      })
    });
  } catch (error) {
    if (isRagProxyBodyLimitError(error)) {
      return errorJson("api.rag.request_too_large", 413, locale, {
        debugCode: "RAG_PROXY_REQUEST_TOO_LARGE"
      });
    }
    if (error?.code === "RAG_PROXY_AUDIT_START_FAILED" || error?.code === "RAG_PROXY_AUDIT_RESULT_FAILED") {
      return errorJson("api.rag.audit_failed", 500, locale, {
        debugCode: error.code
      });
    }
    const isAbort = error?.code === "RAG_PROXY_TIMEOUT";
    return errorJson(
      isAbort ? "api.rag.proxy_timeout" : "api.rag.proxy_error",
      isAbort ? 504 : 502,
      locale,
      { debugCode: error?.code || "RAG_PROXY_FETCH_FAILED" }
    );
  } finally {
    clearTimeout(timer);
  }

  const responseHeaders = new Headers();
  res.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) responseHeaders.set(key, value);
  });

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("text/event-stream")) {
    responseHeaders.set("Cache-Control", "no-cache, no-transform");
    responseHeaders.set("X-Accel-Buffering", "no");
  } else {
    responseHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    responseHeaders.set("Pragma", "no-cache");
    responseHeaders.set("Expires", "0");
  }

  return new Response(res.body, {
    status: res.status,
    headers: responseHeaders
  });
}

export async function GET(req, ctx) {
  return proxy(req, ctx);
}

export async function POST(req, ctx) {
  return proxy(req, ctx);
}

export async function PUT(req, ctx) {
  return proxy(req, ctx);
}

export async function PATCH(req, ctx) {
  return proxy(req, ctx);
}

export async function DELETE(req, ctx) {
  return proxy(req, ctx);
}

export async function HEAD(req, ctx) {
  return proxy(req, ctx);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET,POST,DELETE,HEAD,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range, If-None-Match, If-Modified-Since, If-Range, Accept-Language",
      "Access-Control-Max-Age": "600"
    }
  });
}
