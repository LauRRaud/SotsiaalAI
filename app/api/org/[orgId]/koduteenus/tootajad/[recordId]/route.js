import { endWorkerRecord } from "@/lib/homeCare/workerRecords";

import { homeCareRoute, orgJson, readParam } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Rea eemaldamine töötaja kaardilt (ekslik või asendatud). Rida jääb ajalukku lõpuga. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const recordId = await readParam(context, "recordId");
      return orgJson({ ok: true, ...(await endWorkerRecord(auth.context, recordId)) });
    }
  );
}
