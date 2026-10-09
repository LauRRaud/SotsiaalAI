import { correctEntry } from "@/lib/homeCare/entries";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Parandus: põhjus on kohustuslik ja vana sisu jääb parandusjälge. */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "entry_write", rateLimit: 120, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const entryId = await readParam(context, "entryId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await correctEntry(auth.context, clientId, entryId, body)) });
    }
  );
}
