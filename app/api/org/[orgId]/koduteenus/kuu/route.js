import { getMonthSummary } from "@/lib/homeCare/provided";

import { homeCareRoute, orgJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kuu kokkuvõte hooldusjuhile: osutatud aeg otsustatud mahu kõrval, töötajate aeg, ära jäänud käigud. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const month = new URL(request.url).searchParams.get("kuu") || undefined;
    return orgJson({ ok: true, ...(await getMonthSummary(auth.context, { month })) });
  });
}
