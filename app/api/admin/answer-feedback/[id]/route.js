import { NextResponse } from "next/server";
import { requireChatUser, CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { answerFeedbackAdminResolve } from "@/lib/answerFeedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { status, body } = await answerFeedbackAdminResolve(request, id, { authenticate: requireChatUser });
  return NextResponse.json(body, { status, headers: CHAT_NO_STORE_HEADERS });
}
