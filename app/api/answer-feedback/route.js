import { NextResponse } from "next/server";
import { requireChatUser, CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { answerFeedbackOwnList, answerFeedbackPost } from "@/lib/answerFeedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = ({ status, body }) => NextResponse.json(body, { status, headers: CHAT_NO_STORE_HEADERS });

export async function GET(request) {
  return json(await answerFeedbackOwnList(request, { authenticate: requireChatUser }));
}

export async function POST(request) {
  return json(await answerFeedbackPost(request, { authenticate: requireChatUser }));
}
