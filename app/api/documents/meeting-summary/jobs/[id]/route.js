import {
  assertMeetingSummaryAccess,
  getMeetingSummaryJobSnapshot,
  getMeetingSummaryJobResult,
} from "@/lib/documents/meetingSummaryJobs";
import { errorJson, json, localeFromRequest, requireDocumentUser } from "@/lib/documents/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, { params }) {
  const locale = localeFromRequest(request);
  const auth = await requireDocumentUser();
  if (!auth?.ok) {
    return errorJson(auth?.message || "api.common.unauthorized", auth?.status || 401, locale, {
      redirect: auth?.redirect,
      requireSubscription: auth?.requireSubscription,
    });
  }

  const jobId = String((await params)?.id || "").trim();
  const job = await getMeetingSummaryJobSnapshot(jobId);
  if (!job) {
    return json(
      {
        ok: false,
        messageKey: "documents.agent_workspace.meeting_summary.not_found",
        message: "documents.agent_workspace.meeting_summary.not_found",
      },
      404
    );
  }
  if (!assertMeetingSummaryAccess(job, auth.userId)) {
    return errorJson("api.common.forbidden", 403, locale);
  }

  return json({
    ok: true,
    job: await getMeetingSummaryJobResult(jobId),
  });
}
