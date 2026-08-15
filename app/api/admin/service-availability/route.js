import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import {
  dispatchServiceAvailabilityReminders,
  listServiceAvailabilityAdminRows
} from "@/lib/serviceAvailabilityReminders";
import { safeError } from "@/lib/privacy/safeError";
import { isSameOriginRequest } from "@/lib/security/sameOriginRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireAdmin() {
  const session = await getServerSession(authConfig).catch(() => null);
  return assertAdmin(session);
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const authz = await requireAdmin();
  if (!authz.ok) return errorJson(authz.message, authz.status || 403, locale);
  try {
    const rows = await listServiceAvailabilityAdminRows();
    return json({ ok: true, rows });
  } catch (error) {
    console.error("[admin/service-availability] load failed", safeError(error));
    return errorJson("admin.service_availability.errors.load_failed", 500, locale);
  }
}

export async function POST(request) {
  const locale = localeFromRequest(request);
  const authz = await requireAdmin();
  if (!authz.ok) return errorJson(authz.message, authz.status || 403, locale);
  if (!isSameOriginRequest(request)) return errorJson("api.common.forbidden", 403, locale);
  try {
    const summary = await dispatchServiceAvailabilityReminders();
    return json({ ok: true, summary });
  } catch (error) {
    console.error("[admin/service-availability] dispatch failed", safeError(error));
    return errorJson("admin.service_availability.errors.dispatch_failed", 500, locale);
  }
}
