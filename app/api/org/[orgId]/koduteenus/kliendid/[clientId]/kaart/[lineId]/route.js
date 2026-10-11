import { endCardLine, replaceCardLine } from "@/lib/homeCare/clients";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const OPTIONS = { write: true, rateScope: "card_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" };

/** Rea muutmine: vana rida lõpetatakse ja uus tuleb samale kohale. */
export async function PATCH(request, context) {
  return homeCareRoute(request, context, OPTIONS, async (auth) => {
    const clientId = await readParam(context, "clientId");
    const lineId = await readParam(context, "lineId");
    const body = await readJsonBody(request);
    return orgJson({ ok: true, ...(await replaceCardLine(auth.context, clientId, lineId, body)) });
  });
}

export async function DELETE(request, context) {
  return homeCareRoute(request, context, OPTIONS, async (auth) => {
    const clientId = await readParam(context, "clientId");
    const lineId = await readParam(context, "lineId");
    return orgJson({ ok: true, ...(await endCardLine(auth.context, clientId, lineId)) });
  });
}
