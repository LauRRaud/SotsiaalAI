import { markWellbeingRecommendationForUser } from "@/lib/wellbeing/checkpoint";
import { requireWellbeingApiUser, wellbeingErrorResponse, wellbeingJson } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "");
}

/* Soovituse „tehtud" märge. `done: false` võtab märke tagasi — see on kasutaja
   oma märkmik, mitte ülesandehaldur, seega tagasivõtmine peab olema sama lihtne
   kui märkimine. */
export async function POST(request, context) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const id = await readId(context);
    const body = await request.json().catch(() => ({}));
    await markWellbeingRecommendationForUser(auth.userId, id, body);
    return wellbeingJson({ ok: true });
  } catch (error) {
    return wellbeingErrorResponse(error, { label: "recommendation mark failed" });
  }
}
