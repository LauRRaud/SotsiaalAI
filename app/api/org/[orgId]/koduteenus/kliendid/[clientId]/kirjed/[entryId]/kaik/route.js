import { addIncidentUpdate, getIncidentTrail } from "@/lib/homeCare/incidents";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Erijuhtumi käik: hooldusjuhile kõik read, autorile tema enda täiendused. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const clientId = await readParam(context, "clientId");
    const entryId = await readParam(context, "entryId");
    return orgJson({ ok: true, ...(await getIncidentTrail(auth.context, clientId, entryId)) });
  });
}

/** Täiendus erijuhtumile (autor või hooldusjuht). Kirje tekst ei muutu. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "entry_write", rateLimit: 120, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const entryId = await readParam(context, "entryId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await addIncidentUpdate(auth.context, clientId, entryId, body)) }, 201);
    }
  );
}
