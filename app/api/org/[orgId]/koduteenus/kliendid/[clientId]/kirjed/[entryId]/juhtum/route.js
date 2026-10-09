import { setIncidentStatus } from "@/lib/homeCare/entries";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Erijuhtumi seis (uus, ülevaatamisel, suletud). Ainult hooldusjuht. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "entry_write", rateLimit: 120, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const entryId = await readParam(context, "entryId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await setIncidentStatus(auth.context, clientId, entryId, body)) });
    }
  );
}
