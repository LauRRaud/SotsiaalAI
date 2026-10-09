import { listEntryRevisions } from "@/lib/homeCare/entries";

import { homeCareRoute, orgJson, readParam } from "../../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kirje parandusjälg autorile ja hooldusjuhile. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const clientId = await readParam(context, "clientId");
    const entryId = await readParam(context, "entryId");
    return orgJson({ ok: true, ...(await listEntryRevisions(auth.context, clientId, entryId)) });
  });
}
