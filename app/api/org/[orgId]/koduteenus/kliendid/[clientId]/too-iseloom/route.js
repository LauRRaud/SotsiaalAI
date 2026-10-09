import { clearWorkNature, setWorkNature } from "@/lib/homeCare/workNature";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Töö iseloomu märge kliendi juurde: liigid, põhjus ja ülevaatuse päev. Ainult hooldusjuht; eelmine märge lõpeb. */
export async function PUT(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await setWorkNature(auth.context, clientId, body)) });
    }
  );
}

/** Märke mahavõtmine: töö ei ole enam selline. Rida jääb ajalukku. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      return orgJson({ ok: true, ...(await clearWorkNature(auth.context, clientId)) });
    }
  );
}
