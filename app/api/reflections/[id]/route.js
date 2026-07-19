import {
  deletePracticeReflectionForUser,
  getPracticeReflectionForUser,
  updatePracticeReflectionForUser
} from "@/lib/reflection/records";
import { safeError } from "@/lib/privacy/safeError";
import { reflectionErrorResponse, reflectionJson, requireReflectionApiUser } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, context) {
  const auth = await requireReflectionApiUser(request);
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const id = String(params?.id || "");
  try {
    const reflection = await getPracticeReflectionForUser(auth.userId, id);
    if (!reflection) {
      return reflectionJson({ ok: false, message: "reflection.errors.record_missing" }, 404);
    }
    return reflectionJson({ ok: true, reflection });
  } catch (error) {
    console.error("[reflection] get failed", safeError(error));
    return reflectionErrorResponse(error, "reflection.errors.load_failed");
  }
}

export async function PATCH(request, context) {
  const auth = await requireReflectionApiUser(request);
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const id = String(params?.id || "");
  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return reflectionJson({ ok: false, message: "reflection.errors.invalid_payload" }, 400);
  }

  try {
    const { reflection } = await updatePracticeReflectionForUser(auth.userId, id, payload);
    return reflectionJson({ ok: true, reflection });
  } catch (error) {
    console.error("[reflection] update failed", safeError(error));
    return reflectionErrorResponse(error, "reflection.errors.update_failed");
  }
}

export async function DELETE(request, context) {
  const auth = await requireReflectionApiUser(request);
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const id = String(params?.id || "");
  try {
    const result = await deletePracticeReflectionForUser(auth.userId, id);
    if (!result.deleted) {
      return reflectionJson({ ok: false, message: "reflection.errors.record_missing" }, 404);
    }
    return reflectionJson({ ok: true });
  } catch (error) {
    console.error("[reflection] delete failed", safeError(error));
    return reflectionErrorResponse(error, "reflection.errors.delete_failed");
  }
}
