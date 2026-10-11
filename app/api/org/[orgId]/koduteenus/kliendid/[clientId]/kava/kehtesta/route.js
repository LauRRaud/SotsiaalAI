import { activateCarePlan } from "@/lib/homeCare/carePlans";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Mustandi kehtestamine: sellest saab kehtiv kava, eelmine jääb alles kui asendatud. Ainult hooldusjuht. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 30, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await activateCarePlan(auth.context, clientId, body)) });
    }
  );
}
