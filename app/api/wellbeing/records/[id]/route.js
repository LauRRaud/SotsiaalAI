import {
  deleteWellbeingRecordForUser,
  getWellbeingRecordForUser
} from "@/lib/wellbeing/records";
import { listWellbeingOutputDraftsForRecord } from "@/lib/wellbeing/supportDrafts";
import { requireWellbeingApiUser, wellbeingErrorResponse, wellbeingJson } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "");
}

export async function GET(request, context) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const id = await readId(context);
    const record = await getWellbeingRecordForUser(auth.userId, id);
    if (!record) {
      return wellbeingJson({ ok: false, message: "wellbeing.errors.record_not_found" }, 404);
    }
    const drafts = await listWellbeingOutputDraftsForRecord(auth.userId, id);
    return wellbeingJson({ ok: true, record, drafts });
  } catch (error) {
    return wellbeingErrorResponse(error, { label: "record detail failed" });
  }
}

export async function DELETE(request, context) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const id = await readId(context);
    /* SOL-WB-16: mustandite saatus on kutsuja TEADLIK valik, mitte vaikimisi
       otsus. Liides küsib seda siis, kui kirjel mustandeid on. */
    const deleteDrafts = new URL(request.url).searchParams.get("drafts") === "delete";
    const { deleted, draftsDeleted } = await deleteWellbeingRecordForUser(auth.userId, id, { deleteDrafts });
    if (!deleted) {
      return wellbeingJson({ ok: false, message: "wellbeing.errors.record_not_found" }, 404);
    }
    return wellbeingJson({ ok: true, deleted: true, draftsDeleted });
  } catch (error) {
    return wellbeingErrorResponse(error, { label: "record delete failed" });
  }
}
