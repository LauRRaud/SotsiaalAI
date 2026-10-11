import { closeKey, handOverKey } from "@/lib/homeCare/keys";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Võtme üleandmine (`toMembershipId`; tühi = kontorisse) või lõpetamine (`outcome`:
 * `RETURNED` või `LOST`). Üle annab hooldusjuht või võtme praegune hoidja; lõpetab
 * hooldusjuht.
 */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const keyId = await readParam(context, "keyId");
      const body = await readJsonBody(request);
      const run = body?.outcome ? closeKey : handOverKey;
      return orgJson({ ok: true, ...(await run(auth.context, clientId, keyId, body)) });
    }
  );
}
