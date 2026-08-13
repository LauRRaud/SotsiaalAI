import { undoPracticeReflectionDeletionForUser } from "@/lib/reflection/records";
import { safeError } from "@/lib/privacy/safeError";
import { reflectionErrorResponse, reflectionJson, requireReflectionApiUser } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context) {
  const auth = await requireReflectionApiUser(request, { allowWithoutSubscription: true });
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const id = String(params?.id || "");
  try {
    const result = await undoPracticeReflectionDeletionForUser(auth.userId, id);
    if (!result.restored) {
      return reflectionJson({ ok: false, message: "reflection.errors.record_missing" }, 404);
    }
    return reflectionJson({ ok: true });
  } catch (error) {
    console.error("[reflection] undo delete failed", safeError(error));
    return reflectionErrorResponse(error, "reflection.errors.undo_failed");
  }
}
