import { endRelative } from "@/lib/homeCare/relatives";

import { homeCareRoute, orgJson, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Lähedase eemaldamine: klient võttis loa tagasi või inimest enam ei ole. Rida jääb ajalukku lõpuga. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const relativeId = await readParam(context, "relativeId");
      return orgJson({ ok: true, ...(await endRelative(auth.context, clientId, relativeId)) });
    }
  );
}
