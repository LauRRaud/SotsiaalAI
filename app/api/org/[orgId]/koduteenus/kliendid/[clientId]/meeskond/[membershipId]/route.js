import { removeTeamMember } from "@/lib/homeCare/clients";

import { homeCareRoute, orgJson, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Eemaldab töötaja meeskonnast (rida lõpetatakse, ajalugu jääb). */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "team_write", rateLimit: 120, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const membershipId = await readParam(context, "membershipId");
      return orgJson({ ok: true, ...(await removeTeamMember(auth.context, clientId, membershipId)) });
    }
  );
}
