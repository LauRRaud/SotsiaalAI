export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { safeError } from "@/lib/privacy/safeError";
import { usageSnapshotService } from "@/lib/usage/snapshot";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

function requestLocale(request) {
  return normalizeServerLocale(request.headers.get("accept-language")) || "en";
}

export async function GET(request) {
  const locale = requestLocale(request);
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id) {
    const messageKey = "api.common.unauthorized";
    return json({
      ok: false,
      messageKey,
      message: serverT(locale, messageKey, undefined, messageKey)
    }, 401);
  }

  try {
    const snapshot = await usageSnapshotService.getUserSnapshot(session.user.id);
    return json({ ok: true, ...snapshot });
  } catch (error) {
    const errorDetails = safeError(error);
    console.error("[me/usage GET] failed", errorDetails);
    return json({
      ok: false,
      messageKey: "api.common.usage_load_failed",
      message: serverT(locale, "api.common.usage_load_failed", undefined, "Usage could not be loaded."),
      ...(process.env.NODE_ENV !== "production" ? { debug: errorDetails } : {})
    }, error?.code === "USAGE_USER_NOT_FOUND" ? 404 : 500);
  }
}
