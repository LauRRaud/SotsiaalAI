import { NextResponse } from "next/server";
import { requireChatUser, CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { sourceFeedbackAdminList } from "@/lib/sourceFeedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { status, body } = await sourceFeedbackAdminList(request, { authenticate: requireChatUser });
  return NextResponse.json(body, { status, headers: CHAT_NO_STORE_HEADERS });
}
