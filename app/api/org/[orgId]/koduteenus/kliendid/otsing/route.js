import { searchClients } from "@/lib/homeCare/clients";

import { homeCareRoute, orgJson, readJsonBody } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Otsing nime järgi. POST, mitte GET: kliendi nimi ei tohi sattuda URL-i ega
 * sealt proxy- ja ligipääsulogidesse.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "client_search", rateLimit: 60, fallbackKey: "home_care.errors.search_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await searchClients(auth.context, body)) });
    }
  );
}
