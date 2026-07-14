import { NextResponse } from "next/server";
import { requireChatUser, CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { createSourceFeedback, listOwnSourceFeedback, parseSourceFeedbackJsonBody } from "@/lib/sourceFeedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: CHAT_NO_STORE_HEADERS });
}

export async function GET() {
  const auth = await requireChatUser();
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);
  const items = await listOwnSourceFeedback(auth.userId);
  return json({ ok: true, items });
}

export async function POST(request) {
  const auth = await requireChatUser();
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);
  try {
    const body = await parseSourceFeedbackJsonBody(request);
    const result = await createSourceFeedback(auth.userId, body);
    return json({ ok: true, ...result }, result.duplicate ? 200 : 201);
  } catch (error) {
    const isPublic = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500;
    return json({ ok: false, message: `source_feedback.${isPublic ? error.code : "FAILED"}` }, isPublic ? error.status : 500);
  }
}
