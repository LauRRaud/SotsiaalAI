import { updateActivity } from "@/lib/homeCare/activities";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Toimingu nimi, rühm, selgitus, järjekord; arhiveerimine ja taastamine. Ainult kogu asutuse hooldusjuht. */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const activityId = await readParam(context, "activityId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await updateActivity(auth.context, activityId, body)) });
    }
  );
}
