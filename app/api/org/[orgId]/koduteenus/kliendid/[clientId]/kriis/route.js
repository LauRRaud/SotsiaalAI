import { clearCrisisProfile, setCrisisProfile } from "@/lib/homeCare/crisis";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kriisivalmiduse hinnang kliendi juurde: aste, sõltuvused, kes saab aidata. Ainult hooldusjuht; eelmine hinnang lõpeb. */
export async function PUT(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await setCrisisProfile(auth.context, clientId, body)) });
    }
  );
}

/** Hinnangu mahavõtmine. Rida jääb ajalukku. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      return orgJson({ ok: true, ...(await clearCrisisProfile(auth.context, clientId)) });
    }
  );
}
