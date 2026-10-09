import { handleChangeSignal } from "@/lib/homeCare/changes";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Hooldusjuht vastab märkamisele: mida tehti (`outcome`) ja soovi korral märkus (`note`). */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "card_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const signalId = await readParam(context, "signalId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await handleChangeSignal(auth.context, signalId, body)) });
    }
  );
}
