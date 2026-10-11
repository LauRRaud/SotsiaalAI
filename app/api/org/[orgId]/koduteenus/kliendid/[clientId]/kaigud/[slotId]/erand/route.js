import { cancelVisit, moveVisit, restoreVisit } from "@/lib/homeCare/dayPlan";
import { CareVisitChangeKind } from "@/lib/homeCare/constants";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Ühe päeva erand: käigu ümbertõstmine (`kind: MOVED`) või ärajätmine (`kind: CANCELLED`). Ainult hooldusjuht. */
export async function PUT(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 120, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const slotId = await readParam(context, "slotId");
      const body = await readJsonBody(request);
      const run = body?.kind === CareVisitChangeKind.CANCELLED ? cancelVisit : moveVisit;
      return orgJson({ ok: true, ...(await run(auth.context, clientId, slotId, body)) });
    }
  );
}

/** Erandi tagasivõtmine: käik on jälle nii, nagu mustris. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 120, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const slotId = await readParam(context, "slotId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await restoreVisit(auth.context, clientId, slotId, body)) });
    }
  );
}
