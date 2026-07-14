import { NextResponse } from "next/server";
import { requireChatUser, CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { listAdminSourceFeedback } from "@/lib/sourceFeedback";

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: CHAT_NO_STORE_HEADERS });
}

export async function GET(request) {
  const auth = await requireChatUser({ includeRole: true });
  if (!auth.ok || (!auth.isAdmin && auth.role !== "ADMIN")) return json({ ok: false, message: "api.common.not_found" }, 404);
  const status = new URL(request.url).searchParams.get("status");
  return json({ ok: true, items: await listAdminSourceFeedback({ status }) });
}
