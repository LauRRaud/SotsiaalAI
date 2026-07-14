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
    const workspace = await listEffectivePracticeWorkspace(auth);
    return json({
      ok: true,
      practices: workspace.practices
    });
  } catch (error) {
    return effectivePracticeErrorResponse(error, locale, "[effective-practices] legacy list failed");
  }
}

export async function POST(request) {
  const locale = effectivePracticeLocale(request);
  try {
    const auth = await requireEffectivePracticeAuth();
    const body = await request.json().catch(() => ({}));
    const practice = await createEffectivePracticeCandidate(auth, body);
    return json({
      ok: true,
      practice
    }, 201);
  } catch (error) {
    return effectivePracticeErrorResponse(error, locale, "[effective-practices] legacy create failed");
  }
}
