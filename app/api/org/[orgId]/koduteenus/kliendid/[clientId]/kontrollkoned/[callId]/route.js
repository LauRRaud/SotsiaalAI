import { retractControlCall } from "@/lib/homeCare/controlCalls";

import { homeCareRoute, orgJson, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Ekslikult kirja pandud kontrollkõne tühistamine. Rida jääb alles. Ainult hooldusjuht. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const callId = await readParam(context, "callId");
      return orgJson({ ok: true, ...(await retractControlCall(auth.context, clientId, callId)) });
    }
  );
}
