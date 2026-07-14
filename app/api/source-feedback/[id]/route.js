import { NextResponse } from "next/server";
import { requireChatUser, CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { getOwnSourceFeedback } from "@/lib/sourceFeedback";

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: CHAT_NO_STORE_HEADERS });
}

export async function GET(_request, { params }) {
  const auth = await requireChatUser();
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);
  try {
    const { id } = await params;
    return json({ ok: true, item: await getOwnSourceFeedback(auth.userId, String(id || "")) });
  } catch (error) {
    return json({ ok: false, message: "api.common.not_found" }, error?.status || 500);
  }
}
