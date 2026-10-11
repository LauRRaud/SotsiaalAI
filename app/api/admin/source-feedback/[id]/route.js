import { NextResponse } from "next/server";
import { requireChatUser, CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { sourceFeedbackAdminResolve } from "@/lib/sourceFeedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { status, body } = await sourceFeedbackAdminResolve(request, id, { authenticate: requireChatUser });
  return NextResponse.json(body, { status, headers: CHAT_NO_STORE_HEADERS });
}
