import { json } from "@/lib/documents/server";
import {
  listEffectivePracticeCapabilities,
  manageEffectivePracticeCapability
} from "@/lib/effectivePractices";
import {
  effectivePracticeErrorResponse,
  effectivePracticeLocale,
  requireEffectivePracticeAuth
} from "@/lib/effectivePracticeApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = effectivePracticeLocale(request);
  try {
    const auth = await requireEffectivePracticeAuth();
    const url = new URL(request.url);
    const page = await listEffectivePracticeCapabilities(auth, {
      limit: url.searchParams.get("limit") || "100",
      cursor: url.searchParams.get("cursor") || ""
    });
    return json({ ok: true, capabilities: page.items, pageInfo: page.pageInfo });
  } catch (error) {
    return effectivePracticeErrorResponse(error, locale, "[effective-practices] capability list failed");
  }
}

export async function POST(request) {
  const locale = effectivePracticeLocale(request);
  try {
    const auth = await requireEffectivePracticeAuth();
    const body = await request.json().catch(() => ({}));
    const capability = await manageEffectivePracticeCapability(auth, body);
    return json({ ok: true, capability });
  } catch (error) {
    return effectivePracticeErrorResponse(error, locale, "[effective-practices] capability change failed");
  }
}
