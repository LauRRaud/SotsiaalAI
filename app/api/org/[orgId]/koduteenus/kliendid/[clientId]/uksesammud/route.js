import { saveDoorSteps } from "@/lib/homeCare/doorSteps";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kliendiga kokku lepitud sammud, kui uks ei avane: kogu loend korraga (`steps`). Meeskond ja hooldusjuht. */
export async function PUT(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "card_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await saveDoorSteps(auth.context, clientId, body)) });
    }
  );
}
