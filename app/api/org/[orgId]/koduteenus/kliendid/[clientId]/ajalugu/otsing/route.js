import { searchHistory } from "@/lib/homeCare/importedHistory";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Otsing imporditud ajaloost. POST, sest otsisõna ei tohi jääda aadressi ega logidesse. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "history_search", rateLimit: 60, fallbackKey: "home_care.errors.search_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await searchHistory(auth.context, clientId, body)) });
    }
  );
}
