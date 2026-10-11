import { getDaySheet } from "@/lib/homeCare/daySheet";

import { homeCareRoute, orgJson, readJsonBody } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Päevaleht prinditava dokumendina (`day`, soovi korral `membershipId`). POST, sest
 * väljaandmisest jääb auditirida; plaani ennast see ei muuda. Ainult hooldusjuht.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "door_tag_document", rateLimit: 60, fallbackKey: "home_care.errors.list_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await getDaySheet(auth.context, body)) });
    }
  );
}
