import { addMoneyEntry } from "@/lib/homeCare/money";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kliendi sularaha rida: sain kliendilt, kulutasin või tagastasin. Arvestus, mitte makse; hoidja on kirjutaja ise. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "money_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await addMoneyEntry(auth.context, clientId, body)) }, 201);
    }
  );
}
