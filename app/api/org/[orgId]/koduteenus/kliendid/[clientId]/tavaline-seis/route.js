import { saveUsualState } from "@/lib/homeCare/changes";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kliendi tavaline seis valdkondade kaupa (`areas`): muutunud valdkonna eelmine tekst lõpeb. Meeskond ja hooldusjuht. */
export async function PUT(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "card_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await saveUsualState(auth.context, clientId, body)) });
    }
  );
}
