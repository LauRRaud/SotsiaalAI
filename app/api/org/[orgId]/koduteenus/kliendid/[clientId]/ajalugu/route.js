import { importHistory } from "@/lib/homeCare/importedHistory";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Kliendi senise päeviku ületoomine ühe tekstina. Ainult hooldusjuht.
 * Tekst on päringu kehas ja seda ei logita.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "history_import", rateLimit: 10, fallbackKey: "home_care.errors.import_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await importHistory(auth.context, clientId, body)) }, 201);
    }
  );
}
