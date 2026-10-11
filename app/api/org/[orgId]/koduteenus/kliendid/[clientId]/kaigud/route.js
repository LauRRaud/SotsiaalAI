import { createSlots, getClientSlots } from "@/lib/homeCare/slots";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Käigumuster: kliendi korduvad käigud nädalas. Loeb igaüks, kes tohib kliendi lehte avada. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.open_failed" }, async (auth) => {
    const clientId = await readParam(context, "clientId");
    return orgJson({ ok: true, ...(await getClientSlots(auth.context, clientId)) });
  });
}

/** Uus korduv käik igale valitud nädalapäevale. Ainult hooldusjuht. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await createSlots(auth.context, clientId, body)) }, 201);
    }
  );
}
