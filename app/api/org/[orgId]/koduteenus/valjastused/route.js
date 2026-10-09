import { listChronologyReleases } from "@/lib/homeCare/chronology";

import { homeCareRoute, orgJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Väljastuste tööloend hooldusjuhi skoobis: andmed dokumendi kohta, mitte selle sisu. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const params = new URL(request.url).searchParams;
    const page = await listChronologyReleases(auth.context, {
      clientId: params.get("clientId") || undefined,
      cursor: params.get("cursor") || undefined
    });
    return orgJson({ ok: true, releases: page });
  });
}
