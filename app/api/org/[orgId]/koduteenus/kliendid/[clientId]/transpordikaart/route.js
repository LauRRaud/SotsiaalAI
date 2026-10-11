import { getTransportCard } from "@/lib/homeCare/transport";

import { homeCareRoute, orgJson, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Transpordikaart prinditava dokumendina transpordi korraldajale. POST, sest väljaandmisest
 * jääb auditirida. Hooldusjuht ja kliendi meeskond.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "door_tag_document", rateLimit: 60, fallbackKey: "home_care.errors.open_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      return orgJson({ ok: true, ...(await getTransportCard(auth.context, clientId)) });
    }
  );
}
