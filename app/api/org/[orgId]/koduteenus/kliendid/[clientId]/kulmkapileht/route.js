import { getFridgeSheet } from "@/lib/homeCare/fridgeSheet";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Külmkapileht prinditava dokumendina. POST, sest asutuse telefoninumber tuleb päringu
 * kehas (aadressiribale seda ei panda); midagi ei salvestata. Hooldusjuht ja kliendi meeskond.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "door_tag_document", rateLimit: 60, fallbackKey: "home_care.errors.open_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await getFridgeSheet(auth.context, clientId, body)) });
    }
  );
}
