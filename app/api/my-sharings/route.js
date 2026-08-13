import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { loadMySharings } from "@/lib/mySharings";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = localeFromRequest(request);
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = String(session?.user?.id || "").trim();
  if (!userId) return errorJson("api.common.unauthorized", 401, locale);

  try {
    const section = String(new URL(request.url).searchParams.get("section") || "").trim() || null;
    const cursor = String(new URL(request.url).searchParams.get("cursor") || "").trim() || null;
    const sharings = await loadMySharings(userId, {
      sections: section,
      cursors: section && cursor ? { [section]: cursor } : {}
    });
    return json({ ok: true, sharings });
  } catch (error) {
    console.error("[my-sharings] load failed", safeError(error));
    const status = [400, 401, 403].includes(Number(error?.status)) ? Number(error.status) : 500;
    const messageKey = status === 400
      ? "my_sharings.errors.invalid_section"
      : status === 401
        ? "api.common.unauthorized"
        : status === 403
          ? "api.common.forbidden"
          : "my_sharings.errors.load_failed";
    return errorJson(messageKey, status, locale);
  }
}
