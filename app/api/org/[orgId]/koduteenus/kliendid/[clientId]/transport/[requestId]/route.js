import { answerTransport, withdrawTransport } from "@/lib/homeCare/transport";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Hooldusjuhi vastus soovile: korraldatud (kellaaeg, märkus) või ei saa (põhjus). */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const requestId = await readParam(context, "requestId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await answerTransport(auth.context, clientId, requestId, body)) });
    }
  );
}

/** Soovi või korraldatud sõidu tagasivõtmine. Rida jääb alles. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const requestId = await readParam(context, "requestId");
      return orgJson({ ok: true, ...(await withdrawTransport(auth.context, clientId, requestId)) });
    }
  );
}
