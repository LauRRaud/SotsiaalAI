import { getSharingCard } from "@/lib/homeCare/relatives";

import { homeCareRoute, orgJson, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Jagamiskaart prinditava dokumendina kliendi koju. Midagi ei salvestata. Hooldusjuht ja kliendi meeskond. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "door_tag_document", rateLimit: 60, fallbackKey: "home_care.errors.open_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      return orgJson({ ok: true, ...(await getSharingCard(auth.context, clientId)) });
    }
  );
}
