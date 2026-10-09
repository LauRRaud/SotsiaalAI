import { searchEntries } from "@/lib/homeCare/entries";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Otsing kliendi päevikust, mis arvestab sõnavorme. POST, mitte GET: otsisõna
 * võib sisaldada nime või terviseinfot ega tohi sattuda URL-i ja sealt proxy-
 * ning ligipääsulogidesse. Midagi ei kirjutata peale avamisjälje.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "entry_search", rateLimit: 60, fallbackKey: "home_care.errors.search_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, entries: await searchEntries(auth.context, clientId, body) });
    }
  );
}
