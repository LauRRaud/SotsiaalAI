import { requestTransport } from "@/lib/homeCare/transport";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** „Telli transport": soov hooldusjuhi nimekirja. Kliendi meeskond ja hooldusjuht. Sõitu ennast platvorm ei telli. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 30, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await requestTransport(auth.context, clientId, body)) }, 201);
    }
  );
}
