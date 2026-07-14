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
    const sharings = await loadMySharings(userId);
    return json({ ok: true, sharings });
  } catch (error) {
    console.error("[my-sharings] load failed", safeError(error));
    return errorJson("my_sharings.errors.load_failed", 500, locale);
  }
}
