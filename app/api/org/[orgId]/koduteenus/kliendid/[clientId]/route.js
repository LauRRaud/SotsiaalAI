import { openClient, updateClient } from "@/lib/homeCare/clients";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kliendi leht. Avamine jätab jälje (`CareClientAccess`). */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.open_failed" }, async (auth) => {
    const clientId = await readParam(context, "clientId");
    return orgJson({ ok: true, ...(await openClient(auth.context, clientId)) });
  });
}

/** Kliendi andmete muutmine. Ainult hooldusjuht; nõuab nähtud versiooni. */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await updateClient(auth.context, clientId, body)) });
    }
  );
}
