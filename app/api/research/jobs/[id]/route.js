import { NextResponse } from "next/server";
import { requireResearchAuth } from "@/lib/research/auth";
import {
  assertResearchAccess,
  cancelResearchJob,
  getResearchJob,
  getResearchJobResult,
  getResearchJobSnapshot,
} from "@/lib/research/jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

function errorJson(messageKey, status = 400) {
  return json(
    {
      ok: false,
      messageKey,
      message: messageKey,
    },
    status
  );
}

async function getResearchJobId(params) {
  const resolvedParams = await params;
  return String(resolvedParams?.id || "").trim();
}

async function getAndAuthorizeJob(params, userId) {
  const jobId = await getResearchJobId(params);
  const job = getResearchJob(jobId) || await getResearchJobSnapshot(jobId);
  if (!job) {
    return { ok: false, response: errorJson("research.error.not_found", 404) };
  }
  if (!assertResearchAccess(job, userId)) {
    return { ok: false, response: errorJson("api.common.forbidden", 403) };
  }
  return { ok: true, jobId, job };
}

export async function GET(_req, { params }) {
  const auth = await requireResearchAuth();
  if (!auth.ok) {
    return json(
      {
        ok: false,
        messageKey: auth.message,
        message: auth.message,
        requireSubscription: auth.requireSubscription,
        redirect: auth.redirect,
      },
      auth.status
    );
  }
  const check = await getAndAuthorizeJob(params, auth.userId);
  if (!check.ok) return check.response;
  return json({
    ok: true,
    job: await getResearchJobResult(check.jobId),
  });
}

export async function DELETE(_req, { params }) {
  const auth = await requireResearchAuth();
  if (!auth.ok) {
    return json(
      {
        ok: false,
        messageKey: auth.message,
        message: auth.message,
        requireSubscription: auth.requireSubscription,
        redirect: auth.redirect,
      },
      auth.status
    );
  }
  const check = await getAndAuthorizeJob(params, auth.userId);
  if (!check.ok) return check.response;
  await cancelResearchJob(check.job, "research.error.cancelled");
  return json({ ok: true, status: "cancelled" });
}
