import { flagRelativeDoubt } from "@/lib/homeCare/relatives";

import { homeCareRoute, orgJson, readParam } from "../../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** „Klient ei mäleta, et lubas": kahtluse märge lähedase rea juurde. Kliendi meeskond ja hooldusjuht. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const relativeId = await readParam(context, "relativeId");
      return orgJson({ ok: true, ...(await flagRelativeDoubt(auth.context, clientId, relativeId)) });
    }
  );
}
