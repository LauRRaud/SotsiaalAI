import { discardCarePlanDraft, getCarePlans, saveCarePlanDraft } from "@/lib/homeCare/carePlans";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Hoolduskava: kehtiv kava kõigile, kes tohivad kliendi lehte avada; mustand ja varasemad hooldusjuhile. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.open_failed" }, async (auth) => {
    const clientId = await readParam(context, "clientId");
    return orgJson({ ok: true, ...(await getCarePlans(auth.context, clientId)) });
  });
}

/** Mustandi salvestamine tervikuna. Ainult hooldusjuht; olemasolev mustand nõuab nähtud versiooni. */
export async function PUT(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await saveCarePlanDraft(auth.context, clientId, body)) });
    }
  );
}

/** Mustandi äraviskamine. Kehtivat ega varasemaid kavasid see ei puuduta. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await discardCarePlanDraft(auth.context, clientId, body)) });
    }
  );
}
