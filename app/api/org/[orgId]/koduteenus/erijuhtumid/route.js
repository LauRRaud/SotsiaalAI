import { listIncidents } from "@/lib/homeCare/incidents";

import { homeCareRoute, orgJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Erijuhtumite register hooldusjuhi skoobis: seis, liik, ajavahemik, klient. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const params = new URL(request.url).searchParams;
    const page = await listIncidents(auth.context, {
      status: params.get("status") || undefined,
      type: params.get("type") || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
      clientId: params.get("clientId") || undefined,
      cursor: params.get("cursor") || undefined,
      take: params.get("take") || undefined
    });
    return orgJson({ ok: true, incidents: page });
  });
}
