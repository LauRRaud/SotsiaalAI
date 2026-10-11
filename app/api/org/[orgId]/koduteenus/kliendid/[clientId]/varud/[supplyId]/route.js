import { markSupply, untrackSupply } from "@/lib/homeCare/supplies";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Varu seisu märkimine (`state`: ENOUGH, LOW või OUT; soovi korral `note`). Igaüks, kes tohib kliendi lehte avada. */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "supply_write", rateLimit: 120, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const supplyId = await readParam(context, "supplyId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await markSupply(auth.context, clientId, supplyId, body)) });
    }
  );
}

/** Varu jälgimise lõpetamine. Ainult hooldusjuht; rida ja seisude ajalugu jäävad alles. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const supplyId = await readParam(context, "supplyId");
      return orgJson({ ok: true, ...(await untrackSupply(auth.context, clientId, supplyId)) });
    }
  );
}
