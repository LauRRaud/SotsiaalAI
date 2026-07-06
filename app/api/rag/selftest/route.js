import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { DEFAULT_MODEL } from "@/lib/chat/settings";
import { logOpenAIUsage } from "@/lib/openaiUsage";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { RAG_SERVICE_KEY } from "@/lib/server/ragAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RAW_RAG_HOST = (process.env.RAG_INTERNAL_HOST || "127.0.0.1:8000").trim();
function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

const RAG_TIMEOUT_MS = readPositiveNumber(process.env.RAG_TIMEOUT_MS, 30_000);
const ALLOW_EXTERNAL = process.env.ALLOW_EXTERNAL_RAG === "1";
const LOCAL_HOST_RE = /^(127\.0\.0\.1|localhost|\[?::1\]?)(:\d+)?$/i;

function normalizeBaseFromHost(host) {
  const trimmed = String(host || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "http://127.0.0.1:8000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function isLocalBaseUrl(url) {
  try {
    const parsed = new URL(url);
    return LOCAL_HOST_RE.test(parsed.host);
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

function createStepError(messageKey, detail = "") {
  const err = new Error(messageKey);
  err.messageKey = messageKey;
  err.detail = detail;
  return err;
}

async function ragFetch(path, init = {}) {
  const base = normalizeBaseFromHost(RAW_RAG_HOST);

  if (!ALLOW_EXTERNAL && !isLocalBaseUrl(base)) {
    throw createStepError("api.rag.external_host_not_allowed");
  }

  if (!RAG_SERVICE_KEY) {
    throw createStepError("api.rag.service_key_missing");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);

  try {
    const headers = new Headers(init.headers);
    headers.set("X-API-Key", RAG_SERVICE_KEY);
    headers.set("Content-Type", headers.get("Content-Type") || "application/json");

    const res = await fetch(`${base}${path}`, {
      method: init.method || "GET",
      body: init.body,
      cache: "no-store",
      headers,
      signal: controller.signal
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      throw createStepError(
        data?.messageKey || "api.rag.selftest.backend_error",
        data?.message || `HTTP_${res.status}`
      );
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createStepError("api.rag.proxy_timeout");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function runStep(steps, locale, nameKey, fn) {
  const step = {
    nameKey,
    name: serverT(locale, nameKey, undefined, nameKey),
    ok: false
  };

  try {
    const detail = await fn();
    step.ok = true;
    if (detail) step.detail = String(detail).slice(0, 160);
  } catch (error) {
    const messageKey = error?.messageKey || error?.message || "api.rag.selftest.unknown_error";
    step.ok = false;
    step.errorKey = messageKey;
    step.error = serverT(locale, messageKey, undefined, messageKey);
    if (error?.detail) step.errorDetail = String(error.detail).slice(0, 240);
  }

  steps.push(step);
  return step.ok;
}

export async function POST(req) {
  const locale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale);
  }

  const steps = [];

  await runStep(steps, locale, "api.rag.selftest.step_connection", async () => {
    await ragFetch("/documents?limit=1");
    return serverT(locale, "api.rag.selftest.step_ok", undefined, "OK");
  });

  await runStep(steps, locale, "api.rag.selftest.step_search", async () => {
    await ragFetch("/search", {
      method: "POST",
      body: JSON.stringify({
        query: serverT(locale, "api.rag.selftest.sample_query", undefined, "hello"),
        top_k: 1
      })
    });
    return serverT(locale, "api.rag.selftest.step_ok", undefined, "OK");
  });

  await runStep(steps, locale, "api.rag.selftest.step_openai", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw createStepError("api.rag.selftest.openai_key_missing");

    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const startedAt = Date.now();
    const response = await client.responses.create({
      model: DEFAULT_MODEL,
      text: {
        verbosity: "low"
      },
      reasoning: {
        effort: "low"
      },
      input: serverT(locale, "api.rag.selftest.openai_prompt", undefined, "Reply briefly: OK")
    });
    await logOpenAIUsage({
      response,
      model: DEFAULT_MODEL,
      route: "api/rag/selftest",
      stage: "rag_selftest",
      latencyMs: Date.now() - startedAt
    });

    const text = response?.output_text ? response.output_text.trim() : "";
    if (!text) throw createStepError("api.rag.selftest.openai_empty_response");

    return text;
  });

  return json({
    ok: steps.every(step => step.ok),
    steps
  });
}
