import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { ragRetiredPayload } from "@/lib/rag/retired";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  const headers = { "Cache-Control": "no-store" };
  if (!authz.ok) {
    return NextResponse.json({ ok: false, messageKey: authz.message }, { status: authz.status || 403, headers });
  }
  // Manual health check reports the actual lifecycle state without provider calls.
  return NextResponse.json({ ...ragRetiredPayload(), state: "retired", steps: [] }, { status: 503, headers });
}
