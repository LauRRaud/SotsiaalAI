export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { retryDeletionJob } from "@/lib/privacy/retryDeletionJob";

const HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: HEADERS });

async function requireAdmin() {
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  return { session, authz };
}

export async function GET(request) {
  const { authz } = await requireAdmin();
  if (!authz.ok) return json({ ok: false, messageKey: authz.message }, authz.status || 403);
  try {
    const url = new URL(request.url);
    const status = String(url.searchParams.get("status") || "active").trim().toLowerCase();
    const where = status === "all" ? {} : { status: { in: ["pending", "failed"] } };
    const [jobs, counts] = await Promise.all([
      prisma.dataDeletionJob.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 200,
        select: {
          id: true, createdAt: true, updatedAt: true, actorUserId: true, targetUserId: true,
          action: true, resourceType: true, resourceId: true, externalRef: true,
          status: true, attempts: true, lastError: true
        }
      }),
      prisma.dataDeletionJob.groupBy({ by: ["status"], _count: { _all: true } })
    ]);
    return json({
      ok: true,
      jobs,
      counts: Object.fromEntries(counts.map(item => [item.status, item._count._all]))
    });
  } catch (error) {
    console.error("[admin/usage/deletion-jobs GET]", safeError(error));
    return json({ ok: false, messageKey: "api.admin.usage.deletion_jobs_load_failed" }, 500);
  }
}

export async function POST(request) {
  const { session, authz } = await requireAdmin();
  if (!authz.ok) return json({ ok: false, messageKey: authz.message }, authz.status || 403);
  try {
    const body = await request.json();
    const job = await retryDeletionJob({
      jobId: body?.jobId,
      actorUserId: session.user.id,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent")
    });
    if (job.status !== "done") {
      return json({
        ok: false,
        messageKey: "api.admin.usage.deletion_job_retry_failed",
        job
      }, 409);
    }
    return json({ ok: true, job });
  } catch (error) {
    console.error("[admin/usage/deletion-jobs POST]", safeError(error));
    return json({
      ok: false,
      messageKey: error?.code === "DELETION_JOB_NOT_FOUND" ? "api.admin.usage.deletion_job_not_found" : "api.admin.usage.deletion_job_retry_failed"
    }, error?.code === "DELETION_JOB_NOT_FOUND" ? 404 : error instanceof TypeError ? 400 : 500);
  }
}
