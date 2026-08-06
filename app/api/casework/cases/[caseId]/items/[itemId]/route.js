import { json } from "@/lib/documents/server";
import { unlinkCaseWorkItem } from "@/lib/casework/caseWorkItem";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Seose eemaldamine (E6 operatsioon 5).
 *
 * Ligipääsmatut seost EI SAA eemaldada ja vastus on 404 — õnnestumine
 * kinnitaks tema olemasolu (leping L3).
 */
export async function DELETE(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:unlink", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId, itemId } = await params;
    await unlinkCaseWorkItem({ ownerUserId: guard.userId, caseWorkAssistId: caseId, itemId });
    return json({ ok: true });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
