import { createDecision, getDecisions } from "@/lib/homeCare/decisions";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Otsus ja maht: täna kehtiv otsus kõigile, kes tohivad kliendi lehte avada; kõik otsused hooldusjuhile. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.open_failed" }, async (auth) => {
    const clientId = await readParam(context, "clientId");
    return orgJson({ ok: true, ...(await getDecisions(auth.context, clientId)) });
  });
}

/** Uus otsus kliendi juurde. Ainult hooldusjuht. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await createDecision(auth.context, clientId, body)) }, 201);
    }
  );
}
