import { getMonthStatements } from "@/lib/homeCare/monthStatement";

import { homeCareRoute, orgJson, readJsonBody } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Kliendi kuulehed prinditava dokumendina (`month`, soovi korral `clientId`, `part` ja `phone`).
 * POST, sest väljaandmisest jääb auditirida; päevikut see ei muuda. Ainult hooldusjuht.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "door_tag_document", rateLimit: 60, fallbackKey: "home_care.errors.list_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await getMonthStatements(auth.context, body)) });
    }
  );
}
