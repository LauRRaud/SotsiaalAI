import { NextResponse } from "next/server";
import { requireChatUser, CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { resolveSourceFeedback } from "@/lib/sourceFeedback";

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: CHAT_NO_STORE_HEADERS });
}

export async function PATCH(request, { params }) {
  const auth = await requireChatUser({ includeRole: true });
  if (!auth.ok || (!auth.isAdmin && auth.role !== "ADMIN")) return json({ ok: false, message: "api.common.not_found" }, 404);
  try {
    const { id } = await params;
    const item = await resolveSourceFeedback(auth.userId, String(id || ""), await request.json());
    return json({ ok: true, item });
  } catch (error) {
    const isPublic = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500;
    return json({ ok: false, message: `source_feedback.${isPublic ? error.code : "FAILED"}` }, isPublic ? error.status : 500);
  }
}
