import { getWeekPlan } from "@/lib/homeCare/dayPlan";

import { homeCareRoute, orgJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Hooldusjuhi nädalaplaan: käigud ja plaanitud aeg töötaja ja päeva kaupa. `?nadal=` on mis tahes selle nädala päev. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const week = new URL(request.url).searchParams.get("nadal") || undefined;
    return orgJson({ ok: true, ...(await getWeekPlan(auth.context, { week })) });
  });
}
