import { draftChronology } from "@/lib/homeCare/chronology";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kronoloogia mustand: ajavahemiku kirjed hooldusjuhile ülevaatamiseks. Midagi ei salvestata peale avamisjälje. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "chronology_draft", rateLimit: 30, fallbackKey: "home_care.errors.list_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, draft: await draftChronology(auth.context, clientId, body) });
    }
  );
}
