import { retractEntry } from "@/lib/homeCare/entries";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Tühistus. POST, mitte DELETE: tegu vajab keha (põhjus) ja ei kustuta midagi;
 * rida jääb alles ja tekst läheb parandusjälge.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "entry_write", rateLimit: 120, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const entryId = await readParam(context, "entryId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await retractEntry(auth.context, clientId, entryId, body)) });
    }
  );
}
