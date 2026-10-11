import { getCallCounts } from "@/lib/homeCare/calls";

import { homeCareRoute, orgJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kõnede loendur: arvud kuu, teema ja helistaja kaupa. Ainult hooldusjuht; vastuses ei ole nimesid ega teksti. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const month = new URL(request.url).searchParams.get("kuu") || undefined;
    return orgJson({ ok: true, ...(await getCallCounts(auth.context, { month })) });
  });
}
