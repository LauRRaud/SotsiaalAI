import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { openTurn } from "@/lib/rag-v2/pilot/packed-json";
import { turnTrace } from "@/lib/rag-v2/pilot/turn-trace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// The admin's view of one turn as data (ADR-158): the same trace /admin/rag/chat-trace/<turnId> shows, for analysis.
// Only a turn of the admin's own conversations; the vector is not read.
export async function GET(request, { params }) {
  const locale = localeFromRequest(request);
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  if (!authz.ok) return errorJson(authz.message, authz.status || 403, locale);
  const { turnId } = await params;
  const id = String(turnId || "");
  if (!id || !session.user.id) return errorJson("api.common.bad_request", 400, locale);
  try {
    const row = await prisma.m4PilotTurn.findFirst({ where: { id, chatTurn: { userId: session.user.id } }, omit: { vector: true } });
    if (!row) return errorJson("api.common.not_found", 404, locale);
    return json({ ok: true, trace: turnTrace(openTurn(row)) });
  } catch (error) {
    console.error("[admin/rag/chat-trace] load failed", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}
