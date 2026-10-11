import { assignIncident, listIncidentAssignees } from "@/lib/homeCare/incidents";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kes saab selle kliendi erijuhtumi eest vastutada. Ainult hooldusjuht. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const clientId = await readParam(context, "clientId");
    return orgJson({ ok: true, ...(await listIncidentAssignees(auth.context, clientId)) });
  });
}

/** Vastutaja määramine või mahavõtmine (`membershipId: null`). Ainult hooldusjuht. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "entry_write", rateLimit: 120, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const entryId = await readParam(context, "entryId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await assignIncident(auth.context, clientId, entryId, body)) });
    }
  );
}
