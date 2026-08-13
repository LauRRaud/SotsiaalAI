import {
  createPracticeReflectionForUser,
  listPracticeReflectionsForUser
} from "@/lib/reflection/records";
import { safeError } from "@/lib/privacy/safeError";
import { reflectionErrorResponse, reflectionJson, requireReflectionApiUser } from "./_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireReflectionApiUser(request);
  if (!auth.ok) return auth.response;

  const requestUrl = new URL(request.url);
  try {
    const result = await listPracticeReflectionsForUser(auth.userId, {
      sourceKind: requestUrl.searchParams.get("sourceKind"),
      sourceId: requestUrl.searchParams.get("sourceId"),
      take: requestUrl.searchParams.get("take"),
      cursor: requestUrl.searchParams.get("cursor")
    });
    return reflectionJson({ ok: true, reflections: result.items, page: result.page });
  } catch (error) {
    console.error("[reflection] list failed", safeError(error));
    return reflectionErrorResponse(error, "reflection.errors.list_failed");
  }
}

export async function POST(request) {
  const auth = await requireReflectionApiUser(request);
  if (!auth.ok) return auth.response;

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return reflectionJson({ ok: false, message: "reflection.errors.invalid_payload" }, 400);
  }

  try {
    const { reflection, replayed } = await createPracticeReflectionForUser(auth.userId, payload, {
      idempotencyKey: request.headers.get("Idempotency-Key")
    });
    return reflectionJson({ ok: true, reflection, replayed }, replayed ? 200 : 201);
  } catch (error) {
    console.error("[reflection] create failed", safeError(error));
    return reflectionErrorResponse(error, "reflection.errors.create_failed");
  }
}
