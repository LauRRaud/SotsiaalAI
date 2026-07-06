import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { createHelpMatchAndRoom } from "@/lib/help";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

async function requireUser() {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) return null;
    return {
      userId: session.user.id
    };
  } catch {
    return null;
  }
}

export async function POST(request) {
  const auth = await requireUser();
  if (!auth) {
    return json({ ok: false, message: "api.common.unauthorized" }, 401);
  }

  const payload = await request.json().catch(() => ({}));

  try {
    const match = await createHelpMatchAndRoom({
      requestId: payload?.requestId,
      offerId: payload?.offerId,
      initiatedByUserId: auth.userId
    });

    return json({
      ok: true,
      match
    });
  } catch (error) {
    const status = error?.code === "HELP_MATCH_NOT_COMPATIBLE" ? 409 : 400;
    return json({
      ok: false,
      message: error?.code || "HELP_MATCH_CREATE_FAILED"
    }, status);
  }
}
