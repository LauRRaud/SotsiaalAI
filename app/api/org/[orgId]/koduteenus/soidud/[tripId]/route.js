import { retractTrip } from "@/lib/homeCare/trips";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Eksliku sõidu tühistamine põhjusega (`reason`). Rida jääb alles. */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const tripId = await readParam(context, "tripId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await retractTrip(auth.context, tripId, body)) });
    }
  );
}
