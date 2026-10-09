import { getDayPlan } from "@/lib/homeCare/dayPlan";

import { homeCareRoute, orgJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Hooldusjuhi päevaplaan: käigud töötaja kaupa, määramata käigud ja nädala arvud. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const day = new URL(request.url).searchParams.get("paev") || undefined;
    return orgJson({ ok: true, ...(await getDayPlan(auth.context, { day })) });
  });
}
