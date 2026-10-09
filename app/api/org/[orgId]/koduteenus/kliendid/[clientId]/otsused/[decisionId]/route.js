import { retractDecision, updateDecision } from "@/lib/homeCare/decisions";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Otsuse kirje parandamine. Ainult hooldusjuht; nõuab nähtud versiooni. */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const decisionId = await readParam(context, "decisionId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await updateDecision(auth.context, clientId, decisionId, body)) });
    }
  );
}

/** Ekslikult sisestatud otsuse tühistamine. Rida jääb alles ja on hooldusjuhile näha. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 30, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const decisionId = await readParam(context, "decisionId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await retractDecision(auth.context, clientId, decisionId, body)) });
    }
  );
}
