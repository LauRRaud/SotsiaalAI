import { createWorkBoundariesRecordForUser } from "@/lib/wellbeing/records";
import { requireWellbeingApiUser, wellbeingErrorResponse, wellbeingJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { record, deduplicated } = await createWorkBoundariesRecordForUser(auth.userId, body);
    return wellbeingJson({
      ok: true,
      record,
      ...(deduplicated ? { deduplicated: true } : {})
    }, deduplicated ? 200 : 201);
  } catch (error) {
    return wellbeingErrorResponse(error, { label: "work-boundaries save failed" });
  }
}
