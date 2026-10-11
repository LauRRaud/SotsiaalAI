import { endRepresentative } from "@/lib/homeCare/representatives";

import { homeCareRoute, orgJson, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Esindusõiguse kirje lõpetamine: õigus lõppes, võeti tagasi või pandi kirja ekslikult. Rida jääb alles. Ainult hooldusjuht. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const representativeId = await readParam(context, "representativeId");
      return orgJson({ ok: true, ...(await endRepresentative(auth.context, clientId, representativeId)) });
    }
  );
}
