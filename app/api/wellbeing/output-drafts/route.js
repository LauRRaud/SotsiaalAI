import {
  createWellbeingOutputDraftForUser,
  listWellbeingOutputDraftsForUser
} from "@/lib/wellbeing/supportDrafts";
import { safeError } from "@/lib/privacy/safeError";
import { requireWellbeingApiUser, wellbeingJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  const requestUrl = new URL(request.url);
  try {
    const drafts = await listWellbeingOutputDraftsForUser(auth.userId, {
      outputType: requestUrl.searchParams.get("outputType"),
      recipientType: requestUrl.searchParams.get("recipientType"),
      take: requestUrl.searchParams.get("take")
    });
    return wellbeingJson({ ok: true, drafts });
  } catch (error) {
    console.error("[wellbeing] output draft list failed", safeError(error));
    return wellbeingJson({ ok: false, message: "wellbeing.errors.output_drafts_failed" }, 500);
  }
}

export async function POST(request) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const draft = await createWellbeingOutputDraftForUser(auth.userId, body);
    return wellbeingJson({ ok: true, draft }, 201);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[wellbeing] output draft create failed", safeError(error));
    }
    return wellbeingJson({
      ok: false,
      message: error?.message || "wellbeing.errors.output_draft_failed"
    }, status);
  }
}
