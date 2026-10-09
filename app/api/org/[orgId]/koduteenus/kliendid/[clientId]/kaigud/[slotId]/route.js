import { changeSlot, endSlot } from "@/lib/homeCare/slots";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Korduva käigu aeg, kestus, töötaja või märkus alates tänasest. Ainult hooldusjuht; nõuab nähtud versiooni. */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const slotId = await readParam(context, "slotId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await changeSlot(auth.context, clientId, slotId, body)) });
    }
  );
}

/** Korduva käigu lõpetamine (tänasest enam ei kehti). Möödunud päevade plaan jääb alles. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const slotId = await readParam(context, "slotId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await endSlot(auth.context, clientId, slotId, body)) });
    }
  );
}
