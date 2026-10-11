import { applyClientImport } from "@/lib/homeCare/clientImport";

import { homeCareRoute, orgJson, readJsonBody } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Klientide nimekirja sissetoomine. Server loeb tabeli uuesti ja teeb kava
 * uuesti; brauseri eelvaadet ei usaldata. Ainult hooldusjuht.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_import", rateLimit: 6, fallbackKey: "home_care.errors.import_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await applyClientImport(auth.context, body)) }, 201);
    }
  );
}
