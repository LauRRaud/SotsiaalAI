import { openClientWithReason } from "@/lib/homeCare/clients";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Meeskonda mittekuuluv hooldaja avab kliendi lehe põhjusega. Luba kehtib
 * asutuse kalendripäeva lõpuni ja jätab rea nii avamislogisse kui auditisse.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_reason", rateLimit: 30, fallbackKey: "home_care.errors.open_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await openClientWithReason(auth.context, clientId, body)) }, 201);
    }
  );
}
