import { getCoordinatorOverview } from "@/lib/homeCare/overview";

import { homeCareRoute, orgJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Hooldusjuhi ülevaade: uued kirjed, lugemata teated, lahtised erijuhtumid. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) =>
    orgJson({ ok: true, overview: await getCoordinatorOverview(auth.context) })
  );
}
