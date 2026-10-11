import { addRepresentative } from "@/lib/homeCare/representatives";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Uus esindusõiguse kirje: kes tohib kliendi eest otsustada, mis alusel ja mis ulatuses. Ainult hooldusjuht. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await addRepresentative(auth.context, clientId, body)) }, 201);
    }
  );
}
