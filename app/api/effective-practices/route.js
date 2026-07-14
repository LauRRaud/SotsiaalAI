import { json } from "@/lib/documents/server";
import {
  createEffectivePracticeCandidate,
  listEffectivePracticeWorkspace
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
    const workspace = await listEffectivePracticeWorkspace(auth, {
      q: url.searchParams.get("q") || "",
      practiceType: url.searchParams.get("practiceType") || "",
      maturity: url.searchParams.get("maturity") || "",
      environment: url.searchParams.get("environment") || "",
      sort: url.searchParams.get("sort") || "updated"
    });
    return json({ ok: true, ...workspace });
  } catch (error) {
    return effectivePracticeErrorResponse(error, locale, "[effective-practices] workspace load failed");
  }
}

export async function POST(request) {
  const locale = effectivePracticeLocale(request);
  try {
    const auth = await requireEffectivePracticeAuth();
    const body = await request.json().catch(() => ({}));
    const candidate = await createEffectivePracticeCandidate(auth, body);
    return json({ ok: true, candidate }, 201);
  } catch (error) {
    return effectivePracticeErrorResponse(error, locale, "[effective-practices] candidate create failed");
  }
}
