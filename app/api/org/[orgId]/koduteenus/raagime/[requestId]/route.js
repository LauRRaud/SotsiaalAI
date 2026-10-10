import { handleTalk } from "@/lib/homeCare/talkRequests";

import { homeCareRoute, orgJson, readParam } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Hooldusjuht märgib, et töötajaga on räägitud. Mida räägiti, ei küsita ega salvestata. */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const requestId = await readParam(context, "requestId");
      return orgJson({ ok: true, ...(await handleTalk(auth.context, requestId)) });
    }
  );
}
