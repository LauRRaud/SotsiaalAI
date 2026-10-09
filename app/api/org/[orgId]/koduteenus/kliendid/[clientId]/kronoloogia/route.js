import { createChronologyRelease } from "@/lib/homeCare/chronology";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Kronoloogia väljastus: tööloendi rida ja dokumendi read (hetkekoopiad).
 * Ainult hooldusjuht, kelle skoobis klient on.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "chronology_write", rateLimit: 20, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      const result = await createChronologyRelease(auth.context, clientId, body);
      return orgJson({ ok: true, ...result }, result.repeated ? 200 : 201);
    }
  );
}
