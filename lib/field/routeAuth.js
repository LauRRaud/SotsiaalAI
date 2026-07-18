/**
 * FIELD-V1 route helpers: session + role gate and no-store JSON responses.
 * The field shell is a professional surface — CLIENT accounts get 404 on the
 * whole API (the shell's existence is not their concern, and 404 keeps the
 * surface consistent with the owner-scoped not-found contract).
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";

export const FIELD_NO_STORE_HEADERS = Object.freeze({
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "X-Content-Type-Options": "nosniff",
  Pragma: "no-cache",
  Expires: "0"
});

const FIELD_ROLES = new Set(["ADMIN", "SOCIAL_WORKER", "SERVICE_PROVIDER"]);

export function fieldJson(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: FIELD_NO_STORE_HEADERS });
}

export async function requireFieldUser() {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return { ok: false, status: 401, message: "api.common.unauthorized" };
  const role = String(session?.user?.role || "").trim().toUpperCase();
  if (!FIELD_ROLES.has(role)) return { ok: false, status: 404, message: "api.common.not_found" };
  return { ok: true, userId, role, session };
}

export function fieldErrorResponse(error, fallbackKey = "field.errors.request_failed") {
  const status = Number(error?.status) || 500;
  const message = status >= 500 ? fallbackKey : error?.message || fallbackKey;
  const payload = { ok: false, message };
  if (error?.extras && status < 500) Object.assign(payload, error.extras);
  return fieldJson(payload, status);
}
