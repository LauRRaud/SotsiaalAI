import { NextResponse } from "next/server";
import { requireChatUser, CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { sourceFeedbackOwnList, sourceFeedbackPost } from "@/lib/sourceFeedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = ({ status, body }) => NextResponse.json(body, { status, headers: CHAT_NO_STORE_HEADERS });

export async function GET(request) {
  return json(await sourceFeedbackOwnList(request, { authenticate: requireChatUser }));
}

export async function POST(request) {
  return json(await sourceFeedbackPost(request, { authenticate: requireChatUser }));
}
