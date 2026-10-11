import { closePrecondition } from "@/lib/homeCare/preconditions";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Eeltingimuse lõpetamine: `outcome` on `DONE` (täidetud) või `DROPPED` (ei ole enam vaja). Ainult hooldusjuht. */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const preconditionId = await readParam(context, "preconditionId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await closePrecondition(auth.context, clientId, preconditionId, body)) });
    }
  );
}
